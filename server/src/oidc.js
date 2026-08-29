/**
 * ENTRA SIGN-ON (V-14).
 *
 * The committee's security seat asked how identity works, and the answer
 * was "a local password, or a session handed over by SDP". For a listed
 * company that means joiners and leavers are managed twice and MFA is
 * managed nowhere.
 *
 * This is the authorization-code flow with PKCE against Microsoft Entra.
 * Three decisions worth stating:
 *
 *   · DENY UNKNOWNS. A successful sign-in at the tenant is not an account
 *     here. The email must already match an active app_user, exactly as
 *     the SDP bridge requires. Meridian never provisions from a token —
 *     grants are somebody's deliberate act.
 *
 *   · The id_token is read WITHOUT re-verifying its signature, which is
 *     sound only because of how it is obtained: a direct back-channel
 *     call from this server to the tenant's token endpoint over TLS, with
 *     the client secret. OIDC Core §3.1.3.7 permits TLS server validation
 *     in place of signature checking for exactly this case. If this ever
 *     moves to an implicit or front-channel flow, that stops being true
 *     and JWKS verification becomes mandatory.
 *
 *   · Nothing here is enabled by default. With no tenant configured every
 *     entry point answers "not configured" rather than half-working.
 */

import crypto from "node:crypto";

/** Short-lived state, keyed by the opaque value sent to the tenant. */
const PENDING = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

export function oidcConfig() {
  const tenant = process.env.MERIDIAN_OIDC_TENANT;
  const clientId = process.env.MERIDIAN_OIDC_CLIENT_ID;
  const clientSecret = process.env.MERIDIAN_OIDC_CLIENT_SECRET;
  const redirect = process.env.MERIDIAN_OIDC_REDIRECT;
  if (!tenant || !clientId || !clientSecret || !redirect) return null;
  return {
    tenant, clientId, clientSecret, redirect,
    authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

export const oidcEnabled = () => oidcConfig() !== null;

function sweepPending() {
  const now = Date.now();
  for (const [k, v] of PENDING) if (now > v.expires) PENDING.delete(k);
}

/** Begin: returns the URL to send the browser to. */
export function beginSignIn() {
  const cfg = oidcConfig();
  if (!cfg) return null;
  sweepPending();
  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  PENDING.set(state, { verifier, expires: Date.now() + STATE_TTL_MS });

  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirect,
    response_mode: "query",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${cfg.authorize}?${q}`;
}

/** The claims we are prepared to believe, from a token we fetched ourselves. */
export function readIdToken(idToken) {
  const parts = String(idToken ?? "").split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const email = claims.email || claims.preferred_username || claims.upn || null;
    return email ? { email: String(email).trim(), name: claims.name ?? "", claims } : null;
  } catch {
    return null;
  }
}

/**
 * Finish: exchange the code and return the verified email, or a reason.
 * The caller decides whether that email is allowed to be anybody here.
 */
export async function completeSignIn({ code, state }) {
  const cfg = oidcConfig();
  if (!cfg) return { error: "not_configured" };
  sweepPending();
  const pending = state ? PENDING.get(state) : null;
  if (!pending) return { error: "bad_state" };
  PENDING.delete(state);          // one use only
  if (!code) return { error: "no_code" };

  let res;
  try {
    res = await fetch(cfg.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: cfg.redirect,
        code_verifier: pending.verifier,
      }),
    });
  } catch (e) {
    return { error: "unreachable", detail: String(e?.message ?? e) };
  }
  if (!res.ok) {
    return { error: "token_rejected", detail: String(await res.text()).slice(0, 300) };
  }
  const body = await res.json().catch(() => null);
  const identity = body && readIdToken(body.id_token);
  if (!identity) return { error: "no_identity" };
  return { email: identity.email, name: identity.name };
}

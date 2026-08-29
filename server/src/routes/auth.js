/** Sign in, sign out, who am I. */

import { Router } from "express";
import { many, query } from "../db.js";
import { audited } from "../audit.js";
import {
  login, logout, logoutOthers, publicUser, cookieOptions, SESSION_COOKIE, HttpError,
  setPassword, verifyPassword, bridgeSession,
} from "../auth.js";
import { oidcEnabled, beginSignIn, completeSignIn } from "../oidc.js";

const r = Router();

/* ── sign-in rate limit (AMDEC C-06, committee release blocker) ───────
   scrypt already costs an attacker ~150 ms per guess; this bounds the
   sustained rate as well: 10 failures per identity+address per 15 min,
   answered 429 with the wait stated. In-memory on purpose — a restart
   forgiving the counters is acceptable, a table of attacker input is not. */
const ATTEMPTS = new Map();               // key → { n, until }
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 10;
function attemptKey(req, email) {
  return `${String(email ?? "").trim().toLowerCase()}|${req.ip ?? ""}`;
}
function tooMany(key) {
  const a = ATTEMPTS.get(key);
  if (!a) return 0;
  if (Date.now() > a.until) { ATTEMPTS.delete(key); return 0; }
  return a.n >= LIMIT ? Math.ceil((a.until - Date.now()) / 60000) : 0;
}
function recordFailure(key) {
  const a = ATTEMPTS.get(key);
  if (!a || Date.now() > a.until) ATTEMPTS.set(key, { n: 1, until: Date.now() + WINDOW_MS });
  else a.n++;
  if (ATTEMPTS.size > 10_000) ATTEMPTS.clear();   // bound the map, crudely and safely
}

r.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new HttpError(400, "Email and password are required");
    const key = attemptKey(req, email);
    const wait = tooMany(key);
    if (wait) throw new HttpError(429, `Too many sign-in attempts — try again in about ${wait} minute${wait === 1 ? "" : "s"}`);
    let token, user;
    try {
      ({ token, user } = await login(email, password, req.get("user-agent") ?? ""));
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) recordFailure(key);
      throw e;
    }
    ATTEMPTS.delete(key);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    await audited(
      { id: user.id, displayName: user.displayName, role: user.role },
      { action: "Signed in", entity: "app_user", entityId: user.id },
      async () => null
    );
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

r.post("/logout", async (req, res, next) => {
  try {
    if (req.user) {
      await audited(req.user, { action: "Signed out", entity: "app_user", entityId: req.user.id },
        async () => null);
    }
    await logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.get("/me", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not signed in" });
    /* While deputising, what the client mirrors is the EFFECTIVE
       authority — role and grants of the absent person — plus who is
       being covered, so the screen can say so out loud. */
    res.json({ user: {
      ...publicUser(req.user._row, req.user.grantRows),
      displayName: req.user.displayName,
      role: req.user.role,
      grants: { programmes: [...req.user.grants.programmes], sites: [...req.user.grants.sites] },
      actingFor: req.user.actingForUserId ?? null,
    } });
  } catch (e) {
    next(e);
  }
});

/** The sign-in screen lists the seeded DEMONSTRATION accounts so the
    system is usable on first run. Never returns a password or a hash.

    S-03 — and never returns anything else. This runs before the session
    wall by necessity (it feeds the sign-in screen), so the filter belongs
    in the SQL, not in the caller: on a real book it answers with an empty
    list, because publishing "who works here, with which role, over which
    sites" to anyone who can reach the port is a free target list for
    phishing and password spraying — and it undoes the deliberate work
    login() does to keep account existence unknowable. */
const DEMO_DOMAIN = "@meridian.example";
r.get("/accounts", async (_req, res, next) => {
  try {
    const rows = await many(
      `SELECT u.id, u.email, u.display_name, u.role,
              coalesce(string_agg(coalesce(g.programme_id, g.site_id), ', ' ORDER BY 1), '') AS scope
         FROM app_user u
         LEFT JOIN access_grant g ON g.user_id = u.id
        WHERE u.active AND u.email LIKE $1
        GROUP BY u.id, u.email, u.display_name, u.role
        ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'group' THEN 1 WHEN 'site' THEN 2 ELSE 3 END, u.display_name`,
      ["%" + DEMO_DOMAIN]
    );
    res.json({
      /* Production-safe login screen (adoption committee I4): the README
         sentence about seed passwords must render only where seed
         accounts actually exist. */
      seeded: rows.length > 0,
      accounts: rows.map((x) => ({
        email: x.email, name: x.display_name, role: x.role, scope: x.scope,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** Self-service password change — and the landing step of the forced
    first-sign-in change (adoption committee I4). Proving the current
    password keeps a walked-away-from session from being hijacked into a
    permanent takeover. */
r.post("/password", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Sign in to continue");
    const { current, next: newPw } = req.body ?? {};
    if (!current || !newPw) throw new HttpError(400, "Current and new password are both required");
    const row = await many(`SELECT pw_hash, pw_salt FROM app_user WHERE id = $1`, [req.user.id]);
    const ok = row.length && await verifyPassword(current, row[0].pw_hash, row[0].pw_salt);
    if (!ok) throw new HttpError(403, "The current password is not right");
    await setPassword(req.user.id, newPw, { mustChange: false });
    await logoutOthers(req.user.id, req.sessionToken);
    await audited(req.user,
      { action: "Password changed", entity: "app_user", entityId: req.user.id,
        detail: "other sessions ended" },
      async () => null);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ── acting for an absent colleague (R-02) ────────────────────────────
   The deputy chooses to act; the server verifies the absence that names
   them, TODAY, and re-verifies on every subsequent request. Nothing is
   widened: while acting, the session carries the absent person's
   authority instead of the deputy's own, and every audit row is labelled
   with both names. */

r.post("/actas", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Sign in to continue");
    const target = String(req.body?.userId ?? "");
    if (!target) throw new HttpError(400, "Say whose duties you are covering");
    if (target === req.user.id) throw new HttpError(400, "You cannot deputise for yourself");
    const justified = await many(
      `SELECT a.id FROM person_absence a
         JOIN app_user absent ON absent.person_id = a.person_id AND absent.active
        WHERE absent.id = $1 AND a.deputy_id = $2
          AND CURRENT_DATE BETWEEN a.starts_on AND a.ends_on`,
      [target, req.user.personId]);
    if (!justified.length) {
      throw new HttpError(403, "No current absence names you as this person's deputy");
    }
    await query(`UPDATE session SET acting_for = $2 WHERE token = $1`, [req.sessionToken, target]);
    await audited(req.user,
      { action: "Deputising started", entity: "app_user", entityId: target,
        detail: `${req.user.displayName} covers for ${target}` },
      async () => null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/actas", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Sign in to continue");
    await query(`UPDATE session SET acting_for = NULL WHERE token = $1`, [req.sessionToken]);
    await audited(req.user,
      { action: "Deputising ended", entity: "app_user", entityId: req.user.id },
      async () => null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Who could I cover for, right now? Drawn on the personal surface. */
r.get("/actas/available", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Sign in to continue");
    const rows = req.user.personId ? await many(
      `SELECT u.id, u.display_name, a.ends_on, a.reason
         FROM person_absence a
         JOIN app_user u ON u.person_id = a.person_id AND u.active
        WHERE a.deputy_id = $1 AND CURRENT_DATE BETWEEN a.starts_on AND a.ends_on
        ORDER BY a.ends_on`,
      [req.user.personId]) : [];
    res.json({
      actingFor: req.user.actingForUserId ?? null,
      available: rows.map((x) => ({ userId: x.id, name: x.display_name, until: x.ends_on, reason: x.reason })),
    });
  } catch (e) { next(e); }
});

/** R-11 — the recipient owns the language and the cadence. */
r.patch("/preferences", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Sign in to continue");
    const patch = {};
    if (req.body?.locale !== undefined) {
      if (!["", "en", "fr"].includes(req.body.locale)) throw new HttpError(400, "Locale is en, fr or empty");
      patch.locale = req.body.locale;
    }
    if (req.body?.notifyPref !== undefined) {
      if (!["immediate", "daily", "weekly", "off"].includes(req.body.notifyPref)) {
        throw new HttpError(400, "Notification preference is immediate, daily, weekly or off");
      }
      patch.notify_pref = req.body.notifyPref;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing recognised to change");
    const sets = Object.keys(patch).map((k, i) => `${k} = $${i + 2}`).join(", ");
    await query(`UPDATE app_user SET ${sets}, row_version = row_version + 1 WHERE id = $1`,
      [req.user.id, ...Object.values(patch)]);
    await audited(req.user,
      { action: "Preferences changed", entity: "app_user", entityId: req.user.id,
        detail: Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(" · ") },
      async () => null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── Entra sign-on (V-14) ─────────────────────────────────────────────
   Configured or not, these answer honestly. Deny-unknowns throughout: a
   successful sign-in at the tenant is not an account here. */

r.get("/oidc/status", (_req, res) => {
  res.json({ enabled: oidcEnabled() });
});

r.get("/oidc/start", (_req, res, next) => {
  try {
    const url = beginSignIn();
    if (!url) throw new HttpError(503, "Entra sign-on is not configured on this instance");
    res.redirect(url);
  } catch (e) { next(e); }
});

r.get("/oidc/callback", async (req, res, next) => {
  try {
    if (!oidcEnabled()) throw new HttpError(503, "Entra sign-on is not configured on this instance");
    const out = await completeSignIn({ code: req.query.code, state: req.query.state });
    if (out.error) {
      /* Back to the front door with a reason, not a stack trace: the
         person at the browser cannot act on either, but support can. */
      return res.redirect("/?sso=" + encodeURIComponent(out.error));
    }
    /* The same rule the SDP bridge enforces: the address must already be
       an active account. Meridian provisions nobody from a token. */
    const session = await bridgeSession(out.email, "entra");
    if (!session) return res.redirect("/?sso=not_provisioned");
    res.cookie(session.cookieName, session.token, session.cookieOptions);
    res.redirect("/");
  } catch (e) { next(e); }
});

export default r;

/**
 * V-14 — Entra sign-on.
 *
 * The tenant itself cannot be reached from a test, and should not be.
 * What IS testable is everything that decides whether a sign-in becomes a
 * session here: that an unconfigured instance says so rather than
 * half-working, that state is single-use, and that a valid token for an
 * unknown address still gets nobody in.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, client } from "./harness.js";
import { oidcEnabled, oidcConfig, beginSignIn, completeSignIn, readIdToken } from "../src/oidc.js";
import { bridgeSession } from "../src/auth.js";

before(async () => { await boot(); });
after(shutdown);

const ENV = ["MERIDIAN_OIDC_TENANT", "MERIDIAN_OIDC_CLIENT_ID",
  "MERIDIAN_OIDC_CLIENT_SECRET", "MERIDIAN_OIDC_REDIRECT"];
const configure = () => {
  process.env.MERIDIAN_OIDC_TENANT = "contoso.onmicrosoft.com";
  process.env.MERIDIAN_OIDC_CLIENT_ID = "client-123";
  process.env.MERIDIAN_OIDC_CLIENT_SECRET = "secret-456";
  process.env.MERIDIAN_OIDC_REDIRECT = "https://meridian.example/api/auth/oidc/callback";
};
const unconfigure = () => { for (const k of ENV) delete process.env[k]; };

test("an unconfigured instance says so, and offers nothing", async () => {
  unconfigure();
  assert.equal(oidcEnabled(), false);
  assert.equal(oidcConfig(), null);
  assert.equal(beginSignIn(), null);
  assert.deepEqual(await completeSignIn({ code: "x", state: "y" }), { error: "not_configured" });

  const c = client();
  const status = await c.get("/api/auth/oidc/status");
  assert.equal(status.status, 200);
  assert.equal(status.body.enabled, false);
  const start = await c.get("/api/auth/oidc/start");
  assert.equal(start.status, 503, "and the entry point refuses rather than redirecting nowhere");
});

test("a configured instance builds an authorize URL with PKCE", () => {
  configure();
  assert.equal(oidcEnabled(), true);
  const url = beginSignIn();
  const u = new URL(url);
  assert.match(u.origin + u.pathname, /login\.microsoftonline\.com\/contoso/);
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.ok(u.searchParams.get("code_challenge"), "a challenge is sent, never the verifier");
  assert.ok(u.searchParams.get("state"));
  assert.match(u.searchParams.get("scope"), /openid/);
  unconfigure();
});

test("state is single-use and unknown state is refused", async () => {
  configure();
  const url = new URL(beginSignIn());
  const state = url.searchParams.get("state");

  assert.deepEqual(await completeSignIn({ code: "c", state: "never-issued" }), { error: "bad_state" },
    "a state we did not issue buys nothing");

  /* Consuming it reaches the tenant, which is unreachable here — the
     point is that the SECOND attempt fails on state, not on the network:
     a replayed callback is dead even if the first one worked. */
  const first = await completeSignIn({ code: "c", state });
  assert.notEqual(first.error, "bad_state", "the first use consumed a valid state");
  const second = await completeSignIn({ code: "c", state });
  assert.deepEqual(second, { error: "bad_state" }, "and it cannot be replayed");
  unconfigure();
});

test("claims are read from the token the server fetched itself", () => {
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const tok = (payload) => `x.${encode(payload)}.y`;
  assert.equal(readIdToken(tok({ email: "a.person@endeavour.example" })).email, "a.person@endeavour.example");
  assert.equal(readIdToken(tok({ preferred_username: "b@x.example" })).email, "b@x.example",
    "Entra sends the address under more than one claim");
  assert.equal(readIdToken(tok({ sub: "nobody" })), null, "no address, no identity");
  assert.equal(readIdToken("not-a-token"), null);
  assert.equal(readIdToken(undefined), null);
});

test("a valid tenant identity is still nobody here unless the account exists", async () => {
  /* The rule that matters most: Entra says who you are, Meridian says
     whether you are anybody HERE. */
  assert.equal(await bridgeSession("someone.new@endeavour.example"), null,
    "an unknown address provisions nothing");
  const known = await bridgeSession("admin@meridian.example", "entra");
  assert.ok(known && known.token, "a known, active account gets a session");
});

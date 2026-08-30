/** R1.1, R1.7, R1.8 — authentication. */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, client, as, ACCOUNTS } from "./harness.js";
import { hashPassword, verifyPassword, sessionKey } from "../src/auth.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

describe("authentication", () => {
  test("R1.1 · every data route is closed to anonymous callers", async () => {
    const c = client();
    for (const path of ["/api/bootstrap", "/api/audit", "/api/meetings/series", "/api/admin/users"]) {
      const r = await c.get(path);
      assert.equal(r.status, 401, `${path} should be 401 without a session`);
    }
  });

  test("R1.1 · a wrong password is refused", async () => {
    const c = client();
    const r = await c.post("/api/auth/login", {
      email: ACCOUNTS.admin[0], password: "not-the-password",
    });
    assert.equal(r.status, 401);
    assert.match(r.body.error, /not recognised/i);
  });

  test("an unknown address fails the same way as a wrong password", async () => {
    const c = client();
    const r = await c.post("/api/auth/login", {
      email: "nobody@meridian.example", password: "whatever-goes-here",
    });
    assert.equal(r.status, 401);
    // Identical message: the response must not disclose which accounts exist.
    assert.match(r.body.error, /not recognised/i);
  });

  test("a valid sign-in returns the user and opens a session", async () => {
    const c = client();
    const user = await c.login(...ACCOUNTS.siteGRU);
    assert.equal(user.role, "site");
    assert.deepEqual(user.grants.sites, ["GRU"]);
    const me = await c.get("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, "U-SILVA");
  });

  test("R1.7 · no response ever carries a password hash or salt", async () => {
    const c = await as("admin");
    const me = await c.get("/api/auth/me");
    const users = await c.get("/api/admin/users");
    const accounts = await c.get("/api/auth/accounts");
    for (const payload of [me.text, users.text, accounts.text]) {
      assert.doesNotMatch(payload, /pw_hash|pw_salt|passwordHash/i);
    }
  });

  test("R1.7 · scrypt hashing is salted and verifies only the right password", async () => {
    const a = await hashPassword("correct-horse-battery");
    const b = await hashPassword("correct-horse-battery");
    assert.notEqual(a.salt, b.salt, "each hash gets its own salt");
    assert.notEqual(a.hash, b.hash, "same password must not produce the same hash");
    assert.equal(await verifyPassword("correct-horse-battery", a.hash, a.salt), true);
    assert.equal(await verifyPassword("Correct-horse-battery", a.hash, a.salt), false);
    assert.equal(await verifyPassword("", a.hash, a.salt), false);
  });

  test("a password shorter than eight characters is refused", async () => {
    await assert.rejects(() => hashPassword("short"), /at least 8/);
  });

  test("R1.8 · logout invalidates the session server-side", async () => {
    const c = await as("pmo");
    assert.equal((await c.get("/api/bootstrap")).status, 200);
    const cookieBefore = c.cookie;
    await c.post("/api/auth/logout");
    assert.equal((await c.get("/api/bootstrap")).status, 401);

    // Replaying the old cookie must not work either — the row is gone.
    const token = cookieBefore.split("=")[1];
    const row = await one(`SELECT token_hash FROM session WHERE token_hash = $1`,
      [sessionKey(token)]);
    assert.equal(row, null, "the session row should be deleted, not just the cookie");
  });

  /* S-14 — what is in the row must not be usable as a cookie. */
  test("S-14 · the session table holds a fingerprint, never the token", async () => {
    const c = await as("pmo");
    const token = c.cookie.split("=")[1];
    const row = await one(
      `SELECT token_hash FROM session WHERE token_hash = $1`, [sessionKey(token)]);
    assert.ok(row, "the live session is found by the fingerprint of its token");
    assert.notEqual(row.token_hash, token, "the stored value is not the cookie");
    assert.match(row.token_hash, /^[0-9a-f]{64}$/, "it is a SHA-256 digest");

    /* And the row's own contents, replayed as a cookie, open nothing —
       which is the whole point of hashing it. */
    const thief = client();
    thief.present(`meridian_sid=${row.token_hash}`);
    assert.equal((await thief.get("/api/bootstrap")).status, 401,
      "someone holding the table must not be holding the sessions");
  });

  test("R1.8 · sessions carry an expiry", async () => {
    const c = await as("groupCBP");
    const token = c.cookie.split("=")[1];
    const row = await one(`SELECT expires_at FROM session WHERE token_hash = $1`,
      [sessionKey(token)]);
    assert.ok(row, "session row exists");
    assert.ok(new Date(row.expires_at) > new Date(), "expiry is in the future");
  });

  test("a deactivated account cannot sign in, and its sessions end", async () => {
    const admin = await as("admin");
    const victim = client();
    await victim.login(...ACCOUNTS.viewerGRU);
    assert.equal((await victim.get("/api/bootstrap")).status, 200);

    const users = await admin.get("/api/admin/users");
    const target = users.body.users.find((u) => u.email === ACCOUNTS.viewerGRU[0]);
    const off = await admin.patch(`/api/admin/users/${target.id}`, {
      active: false, version: target.version,
    });
    assert.equal(off.status, 200);

    assert.equal((await victim.get("/api/bootstrap")).status, 401, "live session ends immediately");
    const retry = await client().post("/api/auth/login", {
      email: ACCOUNTS.viewerGRU[0], password: ACCOUNTS.viewerGRU[1],
    });
    assert.equal(retry.status, 403);
    assert.match(retry.body.error, /disabled/i);
  });
});

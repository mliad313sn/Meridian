/**
 * Test harness.
 *
 * Every suite gets its own in-memory PostgreSQL — PGlite with no data
 * directory — migrated and seeded from scratch. No shared state between
 * files, no server to leave running, no fixtures to keep in sync with the
 * schema, because the fixtures *are* the seed the application ships with.
 */

import { connect, close, migrate } from "../src/db.js";
import { seed } from "../src/seed.js";
import { buildApp } from "../src/index.js";

let server = null;
let base = "";

export async function boot({ today = "2026-08-28" } = {}) {
  await connect({ dataDir: null, url: null });
  await migrate({ silent: true });
  await seed({ force: true, today });
  const app = buildApp();
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  return { base };
}

export async function shutdown() {
  if (server) await new Promise((r) => server.close(r));
  server = null;
  await close();
}

/** A client that keeps its own cookie jar, so several users can be
    signed in at once inside one test. */
export function client() {
  let cookie = "";
  /* `extra` carries per-call headers — X-Lang, so a suite can ask for the
     same refusal in French without a second client (V-10). */
  const call = async (method, path, body, extra) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(extra ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(";");
      if (pair.startsWith("meridian_sid=")) cookie = pair;
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };

  return {
    get: (p, x) => call("GET", p, undefined, x),
    post: (p, b, x) => call("POST", p, b ?? {}, x),
    patch: (p, b, x) => call("PATCH", p, b ?? {}, x),
    del: (p, x) => call("DELETE", p, undefined, x),
    async login(email, password) {
      const r = await call("POST", "/api/auth/login", { email, password });
      if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.text}`);
      return r.body.user;
    },
    get cookie() { return cookie; },
    clear() { cookie = ""; },
  };
}

/** The seeded accounts, by the role they exercise. */
export const ACCOUNTS = {
  admin:      ["admin@meridian.example", "meridian-admin-2026"],
  pmo:        ["r.kaur@meridian.example", "pmo-director-2026"],
  groupCBP:   ["e.lindqvist@meridian.example", "programme-cbp-2026"],
  groupDCH:   ["p.marchetti@meridian.example", "programme-dch-2026"],
  groupDAI:   ["f.okonkwo@meridian.example", "programme-dai-2026"],
  siteGRU:    ["g.silva@meridian.example", "site-gru-2026"],
  siteYYZ:    ["t.nakamura@meridian.example", "site-yyz-2026"],
  siteSIN:    ["y.tanaka@meridian.example", "site-sin-2026"],
  viewerLIS:  ["n.rahimi@meridian.example", "viewer-lis-2026"],
  viewerGRU:  ["q.mbeki@meridian.example", "viewer-gru-2026"],
};

/** `as(null)` gives a client that never signed in — the sign-in screen's
    own view of the application, which some controls have to serve. */
export async function as(who) {
  const c = client();
  if (who !== null) await c.login(...ACCOUNTS[who]);
  return c;
}

/** Projects the seed governs at group level vs site level. */
export const GROUP_PROJECT = "PRJ-101"; // Payments Core Migration, KRK, group
export const SITE_PROJECT_GRU = "PRJ-136"; // LATAM Localisation, GRU, site
export const SITE_PROJECT_YYZ = "PRJ-112"; // Branch Teller Replacement, YYZ, site

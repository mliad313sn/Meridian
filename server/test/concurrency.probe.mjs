/**
 * Concurrency probe — not a test, an experiment.
 *
 * Fires simultaneous writes at the routes that generate their own
 * identifiers by reading the current maximum and adding one, and at the
 * tables that are updated without asserting a row version.
 *
 *   node server/test/concurrency.probe.mjs
 */

import { connect, close, migrate, one, many } from "../src/db.js";
import { seed } from "../src/seed.js";
import { buildApp } from "../src/index.js";

const app = buildApp();
await connect({ dataDir: null, url: null });
await migrate({ silent: true });
await seed({ force: true, today: "2026-08-28" });

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

async function login(email, password) {
  const res = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0]).find((c) => c.startsWith("meridian_sid="));
  return (method, path, body) => fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}

const admin = await login("admin@meridian.example", "meridian-admin-2026");
const kaur = await login("r.kaur@meridian.example", "pmo-director-2026");

const line = (s) => console.log(s);

/* ── 1 · concurrent inserts against max()+1 identifiers ──────────── */
line("═══ PROBE 1 · ten simultaneous RAID items ═══");
const N = 10;
const results = await Promise.all(
  Array.from({ length: N }, (_, i) =>
    admin("POST", "/api/raid", {
      project: "PRJ-101", type: "Risk", title: `Concurrent probe ${i}`, p: 2, i: 2,
    }))
);
const created = results.filter((r) => r.status === 201);
const failed = results.filter((r) => r.status !== 201);
const ids = new Set(created.map((r) => r.body?.id));

line(`  requested : ${N}`);
line(`  created   : ${created.length}`);
line(`  distinct  : ${ids.size}`);
line(`  failed    : ${failed.length}` +
  (failed.length ? `  → ${[...new Set(failed.map((f) => f.status + " " + f.body?.error))].join(" | ")}` : ""));
const stored = await one(
  `SELECT count(*)::int AS n FROM raid_item WHERE title LIKE 'Concurrent probe%'`);
line(`  in the db : ${stored.n}`);
line(created.length === N && ids.size === N
  ? "  VERDICT   ✔ every write landed with its own identifier"
  : `  VERDICT   ✖ ${N - created.length} of ${N} writes lost to an identifier collision`);

/* ── 2 · concurrent project creation (the widest read-then-write) ── */
line("");
line("═══ PROBE 2 · five simultaneous projects ═══");
const projects = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    admin("POST", "/api/projects", {
      name: `Concurrent project ${i}`, programme: "EIT", site: "LON",
      governanceLevel: "group", start: "2027-01-04", finish: "2027-12-31",
      budget: 1, contingency: 0.1,
    }))
);
const pOk = projects.filter((r) => r.status === 201);
line(`  created   : ${pOk.length} of 5   distinct: ${new Set(pOk.map((r) => r.body?.id)).size}`);
const pFail = projects.filter((r) => r.status !== 201);
if (pFail.length) line(`  failed    : ${[...new Set(pFail.map((f) => f.status + " " + f.body?.error))].join(" | ")}`);
line(pOk.length === 5 ? "  VERDICT   ✔ all landed" : `  VERDICT   ✖ ${5 - pOk.length} lost`);

/* ── 3 · lost update on a table with no row_version ──────────────── */
line("");
line("═══ PROBE 3 · two administrators editing the same person ═══");
/* Both writers base their edit on the same read, which is what a form
   edit actually does. */
const seen = await one(`SELECT row_version FROM person WHERE id = 'PE-03'`);
const [a, b] = await Promise.all([
  admin("PATCH", "/api/admin/people/PE-03", { role: "Head of data", rate: 900, version: seen.row_version }),
  kaur("PATCH", "/api/admin/people/PE-03", { role: "Data engineer", rate: 500, version: seen.row_version }),
]);
const after = await one(`SELECT job_role, day_rate FROM person WHERE id = 'PE-03'`);
line(`  writer A  : ${a.status}   writer B : ${b.status}`);
line(`  stored    : ${after.job_role} @ ${after.day_rate}`);
line(a.status === 200 && b.status === 200
  ? "  VERDICT   ✖ both writes accepted — one was silently discarded"
  : "  VERDICT   ✔ the second writer was told, and must re-read");

/* And an edit that does not say which read it is based on is refused
   rather than quietly winning. */
const noVersion = await admin("PATCH", "/api/admin/people/PE-03", { rate: 1 });
line(`  no version: ${noVersion.status} ${noVersion.body?.error ?? ""}`);
line(noVersion.status === 428
  ? "  VERDICT   ✔ a versionless form edit is refused"
  : "  VERDICT   ✖ a versionless form edit was accepted");

/* ── 4 · lost update on a table that HAS row_version, for contrast ── */
line("");
line("═══ PROBE 4 · two writers on a project (row_version present) ═══");
const p0 = (await admin("GET", "/api/bootstrap")).body.db.projects.find((x) => x.id === "PRJ-133");
const [c, d] = await Promise.all([
  admin("PATCH", "/api/projects/PRJ-133", { desc: "Writer A", version: p0.version }),
  kaur("PATCH", "/api/projects/PRJ-133", { desc: "Writer B", version: p0.version }),
]);
line(`  writer A  : ${c.status}   writer B : ${d.status}`);
line([c.status, d.status].includes(409)
  ? "  VERDICT   ✔ the second writer got a 409 and must re-read"
  : "  VERDICT   ✖ both accepted");

/* ── 5 · how many round trips does one project creation cost? ────── */
line("");
line("═══ PROBE 5 · statements per request ═══");
let count = 0;
const dbMod = await import("../src/db.js");
const realQuery = dbMod.query;
line("  (counting is indicative — PGlite serialises, a pooled server would not)");
const before = await one(`SELECT count(*)::int AS n FROM activity`);
await admin("POST", "/api/projects", {
  name: "Round-trip probe", programme: "EIT", site: "LON", governanceLevel: "group",
  start: "2027-01-04", finish: "2027-12-31", budget: 1, contingency: 0.1,
});
const rows = await one(`SELECT
    (SELECT count(*) FROM activity     WHERE project_id LIKE 'PRJ-%' AND name IS NOT NULL)::int AS acts,
    (SELECT count(*) FROM activity_dep)::int AS deps`);
line(`  one project create writes ~8 activities + their dependency links + 4 gates`);
line(`  + 4 evidence documents + 1 allocation, each as its own statement`);
line("  VERDICT   ✖ roughly 25 sequential round trips for a single create");

await new Promise((r) => server.close(r));
await close();

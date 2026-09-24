/**
 * FX-11 (docs/41) — Monte Carlo schedule risk, and D-41.01 / D-41.02.
 *
 * Three halves.
 *
 *   1. The simulator, on cases worked by hand in the comments BEFORE the
 *      assertion: equal estimates collapse onto the plan; a single
 *      triangular (2, 4, 6) stage has its median at 4 days; a seed is a
 *      result; a branch that can never be longest is never critical.
 *   2. D-41.01 on the whole demonstration book, with the frozen 5.28.0
 *      engine: a book with no estimate computes exactly as before — and
 *      so does a book with an estimate on EVERY stage, because an
 *      estimate is read by the simulator only.
 *   3. The routes: rbac `risk.run`, the stored run read-only, no date
 *      moved (D-41.02), the estimate written on both doors, the timing
 *      budget on the book's largest project.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { query } from "../src/db.js";
import { Engine, days } from "../../shared/engine.js";
import { Engine as Engine528 } from "./fixtures/engine-5.28.0.js";
import { simulate, triangular, mulberry32, estimateOf, MAX_ITERATIONS } from "../../shared/montecarlo.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

const rows = (r) => r.rows ?? r;

/* ── 1 · the simulator, by hand ─────────────────────────────────── */

describe("FX-11 · the simulator, on cases worked by hand", () => {
  /* A 10d ─┐
              ├─► C 5d      day 0 = 1 Jan; C starts when A ends (day 10),
     B  4d ─┘               ends day 15 = 16 Jan. B has 6 days of float. */
  const net = (over = {}) => [
    { id: "A", start: "2026-01-01", end: "2026-01-11", deps: [], ...over.A },
    { id: "B", start: "2026-01-01", end: "2026-01-05", deps: [], ...over.B },
    { id: "C", start: "2026-01-11", end: "2026-01-16", deps: ["A", "B"], ...over.C },
  ];

  test("the triangular inverse CDF: u = 0 → o, u = 1 → p, u = F(m) → m; mulberry32 is a fixed sequence", () => {
    assert.equal(triangular(0, 2, 4, 6), 2);
    assert.equal(triangular(1, 2, 4, 6), 6);
    assert.equal(triangular(0.5, 2, 4, 6), 4, "(2, 4, 6) is symmetric: F(4) = 0.5");
    // F(x) = (x − o)² / ((p − o)(m − o)) below the mode: u = 0.125 → (x − 2)² = 1 → x = 3
    assert.equal(triangular(0.125, 2, 4, 6), 3);
    const r1 = mulberry32(42), r2 = mulberry32(42);
    const a = [r1(), r1(), r1()], b = [r2(), r2(), r2()];
    assert.deepEqual(a, b);
    assert.ok(a.every((x) => x >= 0 && x < 1));
  });

  test("an estimate is all three, in order — anything else is no estimate", () => {
    assert.deepEqual(estimateOf({ durOptimistic: 2, durMostLikely: 4, durPessimistic: 6 }), { o: 2, m: 4, p: 6 });
    assert.equal(estimateOf({ durOptimistic: 2, durMostLikely: 4, durPessimistic: null }), null);
    assert.equal(estimateOf({ durOptimistic: 5, durMostLikely: 4, durPessimistic: 6 }), null);
    assert.equal(estimateOf({}), null);
  });

  test("all three estimates equal to the plan → P50 = P80 = P90 = the deterministic finish, 16 Jan", () => {
    const acts = net({ A: { durOptimistic: 10, durMostLikely: 10, durPessimistic: 10 },
                       B: { durOptimistic: 4, durMostLikely: 4, durPessimistic: 4 },
                       C: { durOptimistic: 5, durMostLikely: 5, durPessimistic: 5 } });
    const r = simulate(acts, { seed: 7, iterations: 500 });
    assert.equal(r.deterministic, "2026-01-16");
    assert.equal(r.p50, "2026-01-16"); assert.equal(r.p80, "2026-01-16"); assert.equal(r.p90, "2026-01-16");
    assert.deepEqual(r.histogram, [["2026-01-16", 500]], "one bin: every run is the plan");
    assert.equal(r.estimated, 3);
    assert.deepEqual(r.criticality, { A: 1, B: 0, C: 1 });
  });

  test("one stage, triangular (2, 4, 6), 10 000 runs, seed 7: P50 = 4 days, P80 = P90 = 5", () => {
    /* By hand. Upper half: F(x) = 1 − (6 − x)² / 8.
         median: F(4) = 0.5                         → 4 days
         P80:    (6 − x)² = 1.6 → x = 4.74 → rounds to 5 (the scheduler counts whole days)
         P90:    (6 − x)² = 0.8 → x = 5.11 → rounds to 5
         P(duration rounds to 2) = F(2.5) = 0.5² / 8 = 3.1 %  (≈ 312 runs of 10 000) */
    const acts = [{ id: "X", start: "2026-01-01", end: "2026-01-05", deps: [],
      durOptimistic: 2, durMostLikely: 4, durPessimistic: 6 }];
    const r = simulate(acts, { seed: 7, iterations: 10000 });
    assert.equal(r.iterations, MAX_ITERATIONS);
    assert.equal(days("2026-01-01", r.p50), 4);
    assert.equal(days("2026-01-01", r.p80), 5);
    assert.equal(days("2026-01-01", r.p90), 5);
    const two = r.histogram.find(([d]) => d === "2026-01-03")[1];
    assert.ok(Math.abs(two - 312.5) < 60, `≈ 3.1 % of runs at 2 days, got ${two}`);
    const total = r.histogram.reduce((n, [, c]) => n + c, 0);
    assert.equal(total, 10000);
  });

  test("reproducible: the same seed gives the same result, key for key; another seed does not", () => {
    const acts = net({ A: { durOptimistic: 8, durMostLikely: 10, durPessimistic: 14 },
                       B: { durOptimistic: 6, durMostLikely: 8, durPessimistic: 12 } });
    const one = simulate(acts, { seed: 123456, iterations: 3000 });
    const two = simulate(acts, { seed: 123456, iterations: 3000 });
    assert.deepEqual(two, one);
    const other = simulate(acts, { seed: 654321, iterations: 3000 });
    assert.notDeepEqual(other.histogram, one.histogram);
  });

  test("criticality: a branch that can never be longest is never critical; one that sometimes is, sometimes", () => {
    /* B at most 6 days, A at least 8: B is never on the path (index 0),
       A and C always (index 1). */
    const never = simulate(net({ A: { durOptimistic: 8, durMostLikely: 10, durPessimistic: 14 },
                                 B: { durOptimistic: 3, durMostLikely: 4, durPessimistic: 6 } }), { seed: 3, iterations: 2000 });
    assert.equal(never.criticality.B, 0);
    assert.equal(never.criticality.A, 1);
    assert.equal(never.criticality.C, 1);
    /* B (6, 8, 12) against A (8, 10, 14): B is longest — or tied — on a
       minority of runs, so 0 < index(B) < index(A). */
    const some = simulate(net({ A: { durOptimistic: 8, durMostLikely: 10, durPessimistic: 14 },
                                B: { durOptimistic: 6, durMostLikely: 8, durPessimistic: 12 } }), { seed: 3, iterations: 2000 });
    assert.ok(some.criticality.B > 0 && some.criticality.B < some.criticality.A, JSON.stringify(some.criticality));
    assert.equal(some.criticality.C, 1);
  });

  test("the rows given are never written (D-41.02), and finished work does not vary", () => {
    const acts = net({ A: { durOptimistic: 8, durMostLikely: 10, durPessimistic: 14, actualStart: "2026-01-01",
                            actualFinish: "2026-01-11" } });
    const frozen = JSON.stringify(acts);
    Object.freeze(acts); acts.forEach(Object.freeze);
    const r = simulate(acts, { seed: 9, iterations: 200 });
    assert.equal(JSON.stringify(acts), frozen);
    assert.equal(r.estimated, 0, "A is finished: its actuals are the facts");
    assert.equal(r.p90, r.deterministic);
  });

  test("iterations are capped at 10 000", () => {
    const r = simulate(net(), { seed: 1, iterations: 50000 });
    assert.equal(r.iterations, 10000);
  });
});

/* ── 2 · D-41.01 on the whole book ──────────────────────────────── */

describe("D-41.01 · estimates move no number the engine computes", () => {
  let book;
  before(async () => { book = (await (await as("admin")).get("/api/admin/export")).body; });
  const copy = () => JSON.parse(JSON.stringify(book));
  const KEPT = ["critical", "float", "projEnd", "es", "ef", "ls", "lf"];
  const kept = (cp) => Object.fromEntries(KEPT.map((k) => [k, cp[k]]));

  test("the seeded book carries no estimate — the claim is about a book that uses none", () => {
    assert.ok(book.activities.length >= 40);
    assert.ok(book.activities.every((a) => a.durOptimistic === null && a.durMostLikely === null && a.durPessimistic === null));
    assert.deepEqual(book.riskRuns, []);
  });

  test("with no estimate, and with an estimate on EVERY stage: metrics, roll and critical path equal 5.28.0", () => {
    const none = copy(), all = copy(), frozen = copy();
    for (const a of all.activities) {
      const d = Math.max(1, days(a.start, a.end));
      Object.assign(a, { durOptimistic: d * 0.8, durMostLikely: d, durPessimistic: d * 1.6 });
    }
    for (const db of [none, all]) {
      for (const p of book.projects) {
        assert.deepEqual(Engine.metrics(db, p.id), Engine528.metrics(frozen, p.id), p.id);
        assert.deepEqual(kept(Engine.criticalPath(db, p.id)), Engine528.criticalPath(frozen, p.id), p.id);
      }
      assert.deepEqual(Engine.roll(db, db.projects), Engine528.roll(frozen, frozen.projects));
    }
  });

  test("equal estimates on the book's largest project: every percentile is the engine's own finish", () => {
    const db = copy();
    const sizes = db.projects.map((p) => [p.id, Engine.activities(db, p.id).length]).sort((a, b) => b[1] - a[1]);
    const pid = sizes[0][0];
    for (const a of db.activities.filter((x) => x.project === pid)) {
      const d = Math.max(1, days(a.start, a.end));
      Object.assign(a, { durOptimistic: d, durMostLikely: d, durPessimistic: d });
    }
    const cp = Engine.criticalPath(db, pid);
    const finish = Object.values(cp.dates).map((x) => x.ef).sort().at(-1);
    const r = simulate(Engine.activities(db, pid), { seed: 5, iterations: 300 });
    assert.equal(r.deterministic, finish);
    assert.equal(r.p50, finish); assert.equal(r.p80, finish); assert.equal(r.p90, finish);
    for (const id of cp.critical) assert.equal(r.criticality[id], 1, id);
  });

  test("10 000 runs on the book's largest project finish under one second", () => {
    const db = copy();
    const sizes = db.projects.map((p) => [p.id, Engine.activities(db, p.id).length]).sort((a, b) => b[1] - a[1]);
    const [pid, n] = sizes[0];
    for (const a of db.activities.filter((x) => x.project === pid)) {
      const d = Math.max(1, days(a.start, a.end));
      Object.assign(a, { durOptimistic: d * 0.8, durMostLikely: d, durPessimistic: d * 1.6 });
    }
    const acts = Engine.activities(db, pid);
    const p = Engine.project(db, pid);
    /* Measured in CPU time as well as wall time: `npm test` runs every
       suite at once, and a wall clock shared with seventy other files
       measures the machine, not the simulator. */
    const t0 = performance.now(), c0 = process.cpuUsage();
    const r = simulate(acts, { calendar: Engine.calendarFor(db, p), statusDate: p.statusDate || null, seed: 42, iterations: 10000 });
    const ms = performance.now() - t0, c = process.cpuUsage(c0), cpu = (c.user + c.system) / 1000;
    console.log(`# FX-11 timing: ${pid}, ${n} stages, 10 000 runs in ${ms.toFixed(0)} ms wall, ${cpu.toFixed(0)} ms CPU ` +
      `(P50 ${r.p50}, P80 ${r.p80}, P90 ${r.p90})`);
    assert.equal(r.iterations, 10000);
    assert.ok(cpu < 1000, `${cpu.toFixed(0)} ms of CPU`);
    assert.ok(r.p50 <= r.p80 && r.p80 <= r.p90);
  });
});

/* ── 3 · the routes ─────────────────────────────────────────────── */

describe("FX-11 · written and run through the routes", () => {
  let pmo, admin;
  const P = GROUP_PROJECT;
  before(async () => { pmo = await as("pmo"); admin = await as("admin"); });
  const fresh = async () => (await pmo.get("/api/bootstrap")).body.db;
  const stagesOf = async (pid) => (await fresh()).activities.filter((a) => a.project === pid)
    .sort((a, b) => a.stage - b.stage);
  const plan = async () => rows(await query(
    `SELECT id, start_date, end_date, base_start, base_end, pct, actual_start, actual_finish, row_version
       FROM activity ORDER BY id`));

  test("no estimate anywhere: a run is refused, and says where to give one", async () => {
    const r = await pmo.post(`/api/projects/${P}/risk-runs`, { seed: 1, iterations: 500 });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /three estimates/);
  });

  test("the estimate: all three or none, in order, versioned and audited; null clears it", async () => {
    const [a1] = await stagesOf(P);
    const half = await pmo.patch("/api/activities/" + a1.id, { durOptimistic: 3, version: a1.version });
    assert.equal(half.status, 400);
    const disorder = await pmo.patch("/api/activities/" + a1.id,
      { durOptimistic: 9, durMostLikely: 4, durPessimistic: 12, version: a1.version });
    assert.equal(disorder.status, 400);
    const ok = await pmo.patch("/api/activities/" + a1.id,
      { durOptimistic: 20, durMostLikely: 30, durPessimistic: 50, version: a1.version });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.version, a1.version + 1);
    let b = (await stagesOf(P))[0];
    assert.deepEqual([b.durOptimistic, b.durMostLikely, b.durPessimistic], [20, 30, 50]);
    // a partial write keeps the stored others, and must still be in order
    const part = await pmo.patch("/api/activities/" + a1.id, { durPessimistic: 60, version: b.version });
    assert.equal(part.status, 200, part.text);
    b = (await stagesOf(P))[0];
    assert.equal(b.durPessimistic, 60);
    const stale = await pmo.patch("/api/activities/" + a1.id, { durPessimistic: 70, version: a1.version });
    assert.equal(stale.status, 409);
    const clear = await pmo.patch("/api/activities/" + a1.id,
      { durOptimistic: null, durMostLikely: null, durPessimistic: null, version: b.version });
    assert.equal(clear.status, 200);
    b = (await stagesOf(P))[0];
    assert.equal(b.durMostLikely, null);
    // the database holds the rule whatever path writes
    await assert.rejects(() => query(`UPDATE activity SET dur_optimistic = 5 WHERE id = $1`, [a1.id]), /activity_estimate_whole/);
    await assert.rejects(() => query(
      `UPDATE activity SET dur_optimistic = 5, dur_most_likely = 4, dur_pessimistic = 6 WHERE id = $1`, [a1.id]), /activity_estimate_ordered/);
  });

  test("a run: stored with seed, iterations, who and when; the same seed gives the same numbers; no date moves", async () => {
    for (const a of await stagesOf(P)) {
      const d = Math.max(1, days(a.start, a.end));
      const r = await pmo.patch("/api/activities/" + a.id,
        { durOptimistic: Math.round(d * 0.8), durMostLikely: d, durPessimistic: Math.round(d * 1.5), version: a.version });
      assert.equal(r.status, 200, r.text);
    }
    const before = await plan();
    const one = await pmo.post(`/api/projects/${P}/risk-runs`, { seed: 20260928, iterations: 2000 });
    assert.equal(one.status, 201, one.text);
    assert.match(one.body.id, /^MCR-\d+$/);
    assert.ok(one.body.p50 <= one.body.p80 && one.body.p80 <= one.body.p90);
    const two = await pmo.post(`/api/projects/${P}/risk-runs`, { seed: 20260928, iterations: 2000 });
    assert.equal(two.status, 201);
    for (const k of ["deterministic", "p50", "p80", "p90", "histogram", "criticality"]) {
      assert.deepEqual(two.body[k], one.body[k], k);
    }
    assert.deepEqual(await plan(), before, "D-41.02: no activity row moved, not even its version");

    const list = await admin.get(`/api/projects/${P}/risk-runs`);
    assert.equal(list.status, 200);
    const run = list.body.runs.find((x) => x.id === one.body.id);
    assert.equal(run.seed, 20260928); assert.equal(run.iterations, 2000);
    assert.equal(run.distribution, "triangular");
    assert.ok(run.ranByName, "who ran it"); assert.ok(run.ranAt, "when");
    assert.equal(run.p80, one.body.p80);
    assert.equal(run.deterministicFinish, one.body.deterministic);
    assert.deepEqual(run.criticality, one.body.criticality);
    // the deterministic finish is the critical path's own
    const d = await fresh();
    const cp = Engine.criticalPath(d, P);
    assert.equal(run.deterministicFinish, Object.values(cp.dates).map((x) => x.ef).sort().at(-1));
    const audit = (await admin.get("/api/audit?entity=project&entityId=" + P)).body;
    assert.ok(JSON.stringify(audit).includes("Schedule risk run"), "the run is on the audit trail");
    // the export carries it
    const exp = (await admin.get("/api/admin/export")).body;
    assert.ok(exp.riskRuns.some((x) => x.id === one.body.id && x.p80 === one.body.p80));
  });

  test("read-only once stored: no route rewrites one, the database refuses", async () => {
    const id = rows(await query(`SELECT id FROM risk_run LIMIT 1`))[0].id;
    assert.equal((await admin.patch(`/api/projects/${P}/risk-runs/${id}`, { seed: 2 })).status, 404);
    assert.equal((await admin.del(`/api/projects/${P}/risk-runs/${id}`)).status, 404);
    await assert.rejects(() => query(`UPDATE risk_run SET p80 = p80 + 1 WHERE id = $1`, [id]), /read-only/);
  });

  test("bounds: 100 to 10 000 runs, a whole seed", async () => {
    assert.equal((await pmo.post(`/api/projects/${P}/risk-runs`, { iterations: 50 })).status, 400);
    assert.equal((await pmo.post(`/api/projects/${P}/risk-runs`, { iterations: 20000 })).status, 400);
    assert.equal((await pmo.post(`/api/projects/${P}/risk-runs`, { seed: -4 })).status, 400);
    const auto = await pmo.post(`/api/projects/${P}/risk-runs`, { iterations: 100 });
    assert.equal(auto.status, 201, "no seed: one is chosen, and stored");
    assert.ok(auto.body.seed >= 1);
  });

  test("authority: risk.run is project write scope; reading is project read", async () => {
    const site = await as("siteGRU");
    assert.equal((await site.post(`/api/projects/${P}/risk-runs`, { seed: 1 })).status, 403,
      "a site lead can only read a group-governed project");
    const viewer = await as("viewerGRU");
    assert.equal((await viewer.post(`/api/projects/${SITE_PROJECT_GRU}/risk-runs`, { seed: 1 })).status, 403);
    assert.equal((await viewer.get(`/api/projects/${SITE_PROJECT_GRU}/risk-runs`)).status, 200);
    // on its own site's project the site lead may run (once a stage is estimated)
    const [a] = (await (await site.get("/api/bootstrap")).body.db.activities.filter((x) => x.project === SITE_PROJECT_GRU))
      .sort((x, y) => x.stage - y.stage);
    const est = await site.patch("/api/activities/" + a.id,
      { durOptimistic: 5, durMostLikely: 8, durPessimistic: 15, version: a.version });
    assert.equal(est.status, 200, est.text);
    const own = await site.post(`/api/projects/${SITE_PROJECT_GRU}/risk-runs`, { seed: 11, iterations: 500 });
    assert.equal(own.status, 201, own.text);

    const row = { id: "P", programme_id: "PG", site_id: "GRU", governance_level: "site" };
    const lead = { active: true, role: "site", grants: [{ scope_kind: "site", site_id: "GRU" }] };
    const other = { active: true, role: "site", grants: [{ scope_kind: "site", site_id: "YYZ" }] };
    const reader = { active: true, role: "viewer", grants: [] };
    assert.equal(can(lead, "risk.run", { project: row }).ok, true);
    assert.equal(can(other, "risk.run", { project: row }).ok, false);
    assert.equal(can(reader, "risk.run", { project: row }).ok, false);
  });

  test("/api/v1 · a scheduler writes the three estimates under its own id; half an estimate is refused", async () => {
    const key = (await admin.post("/api/admin/integrations",
      { name: "Risk bridge", scopes: "read:portfolio,write:portfolio", purpose: "test" })).body.key;
    const c = client();
    const put = (path, body) => c.put(path, body, { "X-API-Key": key });
    const a = (await stagesOf(P))[1];
    assert.equal((await put("/api/v1/activities/RB-2", { activity: a.id })).status, 201, "bound");
    const r = await put("/api/v1/activities/RB-2", { durOptimistic: 4, durMostLikely: 6, durPessimistic: 11 });
    assert.equal(r.status, 200, r.text);
    const b = (await stagesOf(P)).find((x) => x.id === a.id);
    assert.deepEqual([b.durOptimistic, b.durMostLikely, b.durPessimistic], [4, 6, 11]);
    const half = await put("/api/v1/activities/RB-2", { durOptimistic: null, durMostLikely: 3 });
    assert.equal(half.status, 400);
  });
});

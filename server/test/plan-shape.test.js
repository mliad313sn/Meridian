/**
 * docs/41 wave A2 — FX-05 (the work breakdown), FX-06 (the Gantt's write
 * path), FX-07 (named baselines).
 *
 * The first block is D-41.01: with no parent set anywhere, every number
 * the engine gives on the seeded book is the number 5.28.0 gave. It is
 * proved against a frozen copy of the 5.28.0 engine
 * (fixtures/engine-5.28.0.js, `git show 7f3dd7a:shared/engine.js`), run on
 * the same book the product serves — not against numbers typed by hand,
 * which would only prove the author copied them correctly.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { query } from "../src/db.js";
import { Engine, wbsRows, rollupWbs, leavesOf } from "../../shared/engine.js";
import { Engine as Frozen } from "./fixtures/engine-5.28.0.js";
import { can } from "../../shared/rbac.js";

const rows = (r) => r.rows ?? r;
/* A Set does not survive deepEqual as data; its members do. */
const plain = (cp) => ({ ...cp, critical: [...cp.critical].sort() });

/* ── pure engine: worked examples, by hand ─────────────────────────── */
describe("FX-05 · the breakdown, computed", () => {
  const leaf = (id, over) => ({ id, project: "X", name: id, stage: 0, parentId: null,
    start: "2026-01-01", end: "2026-01-11", baseStart: "2026-01-01", baseEnd: "2026-01-11",
    weight: 0, pct: 0, owner: null, deps: [], ...over });

  test("a summary's window, weight and progress come from its children (worked example)", () => {
    /* P has A (weight .30, 50 %, 1–11 Jan) and B (weight .10, 100 %, 5–21 Jan).
       ⇒ P runs 1 Jan → 21 Jan, weighs .30 + .10 = .40,
         and is (.30 × 50 + .10 × 100) / .40 = 62.5 → 63 % done.
       Its stored weight (.9) and progress (7 %) are ignored. */
    const acts = [
      leaf("P", { stage: 0, weight: 0.9, pct: 7, start: "2025-06-01", end: "2027-01-01" }),
      leaf("A", { stage: 1, parentId: "P", weight: 0.3, pct: 50 }),
      leaf("B", { stage: 2, parentId: "P", weight: 0.1, pct: 100, start: "2026-01-05", end: "2026-01-21",
        baseStart: "2026-01-06", baseEnd: "2026-01-25" }),
    ];
    const [p, a, b] = wbsRows(acts);
    assert.equal(p.summary, true);
    assert.equal(p.a.start, "2026-01-01");
    assert.equal(p.a.end, "2026-01-21");
    assert.equal(p.a.baseStart, "2026-01-01");
    assert.equal(p.a.baseEnd, "2026-01-25");
    assert.equal(p.a.weight, 0.4);
    assert.equal(p.a.pct, 63);
    assert.deepEqual(p.a.deps, [], "a summary carries no link");
    assert.deepEqual([p.outline, a.outline, b.outline], ["1", "1.1", "1.2"]);
    assert.deepEqual([a.depth, b.depth], [1, 1]);
  });

  test("outline numbering over three levels: 1, 1.1, 1.1.1, 1.2, 2", () => {
    const acts = [
      leaf("T2", { stage: 5 }),
      leaf("Z", { stage: 3, parentId: "Y", weight: 0.2, pct: 40 }),
      leaf("Y", { stage: 2, parentId: "X" }),
      leaf("X", { stage: 1 }),
      leaf("W", { stage: 4, parentId: "X", weight: 0.2, pct: 0 }),
    ];
    const out = wbsRows(acts).map((r) => [r.a.id, r.outline, r.depth, r.summary]);
    assert.deepEqual(out, [
      ["X", "1", 0, true], ["Y", "1.1", 1, true], ["Z", "1.1.1", 2, false],
      ["W", "1.2", 1, false], ["T2", "2", 0, false],
    ]);
    // X = (Z .2 × 40 + W .2 × 0) / .4 = 20 %; weight is the leaves', not Y's again
    const x = wbsRows(acts)[0].a;
    assert.equal(x.weight, 0.4);
    assert.equal(x.pct, 20);
  });

  test("a flat list is returned untouched — the same array (D-41.01)", () => {
    const flat = [leaf("A"), leaf("B")];
    assert.equal(leavesOf(flat), flat);
    assert.equal(rollupWbs(flat), flat);
  });

  test("a cycle (refused by the database) is broken, not looped on", () => {
    const acts = [leaf("A", { parentId: "B" }), leaf("B", { parentId: "A" })];
    const out = wbsRows(acts);
    assert.equal(out.length, 2);
  });

  test("no double count: a summary over two leaves leaves every EV figure where it was", () => {
    const base = {
      statusDate: "2026-07-01",
      settings: { autoRag: true, amberSpi: 0.95, redSpi: 0.9, amberCpi: 0.95, redCpi: 0.9 },
      projects: [{ id: "X", start: "2026-01-01", finish: "2026-12-31", budget: 100,
        contingency: 0, contingencyUsed: 0 }],
      ledger: [{ project: "X", period: "2026-06", amount: 50 }],
      people: [], sites: [], programmes: [], milestones: [],
    };
    const leaves = [
      { id: "A1", project: "X", name: "First", stage: 1, start: "2026-01-01", end: "2026-06-30",
        baseStart: "2026-01-01", baseEnd: "2026-06-30", weight: 0.5, pct: 100, deps: [] },
      { id: "A2", project: "X", name: "Second", stage: 2, start: "2026-07-01", end: "2026-12-31",
        baseStart: "2026-07-01", baseEnd: "2026-12-31", weight: 0.5, pct: 0, deps: ["A1"] },
    ];
    const flat = { ...base, activities: leaves };
    /* The summary's figures are what rollupWbs derives: weight 1.0, 50 %.
       Counted as a stage, it would add 1.0 × 50 % × 100 = 50 to EV. */
    const tree = { ...base, activities: rollupWbs([
      { id: "S", project: "X", name: "All", stage: 0, parentId: null, start: "2026-01-01",
        end: "2026-12-31", baseStart: "2026-01-01", baseEnd: "2026-12-31", weight: 0, pct: 0, deps: [] },
      ...leaves.map((a) => ({ ...a, parentId: "S" })),
    ]) };
    assert.equal(tree.activities[0].weight, 1, "the summary does carry the leaves' weight on screen");
    const m0 = Engine.metrics(flat, "X"), m1 = Engine.metrics(tree, "X");
    assert.equal(m0.ev, 50);
    for (const k of ["pv", "ev", "ac", "spi", "cpi", "eac", "pctComplete", "plannedComplete", "forecastFinish"]) {
      assert.equal(m1[k], m0[k], k + " moved when a summary was added");
    }
    assert.deepEqual(plain(Engine.criticalPath(tree, "X")), plain(Engine.criticalPath(flat, "X")));
    assert.deepEqual(Engine.curve(tree, tree.projects), Engine.curve(flat, flat.projects));
  });
});

/* ── the product ────────────────────────────────────────────────────── */
describe("A2 on the seeded book", () => {
  let admin, viewer, siteGRU, book;
  before(async () => {
    await boot();
    admin = await as("admin");
    viewer = await as("viewerGRU");
    siteGRU = await as("siteGRU");
    book = (await admin.get("/api/admin/export")).body;
  });
  after(shutdown);

  test("D-41.01 · no parent anywhere: metrics, roll-up, critical path and curve equal 5.28.0's", () => {
    assert.ok(book.activities.length > 20 && book.activities.every((a) => a.parentId === null));
    for (const p of book.projects) {
      assert.deepEqual(Engine.metrics(book, p.id), Frozen.metrics(book, p.id), "metrics " + p.id);
      /* 5.29.0 (A1) adds keys to criticalPath (freeFloat, negative, calendar,
         dates…) by contract; the seven 5.28.0 keys must still be equal. */
      const frozenCp = plain(Frozen.criticalPath(book, p.id));
      const cpNow = plain(Engine.criticalPath(book, p.id));
      assert.deepEqual(Object.fromEntries(Object.keys(frozenCp).map((k) => [k, cpNow[k]])), frozenCp, "critical path " + p.id);
      assert.deepEqual(Engine.depBreaches(book, p.id), Frozen.depBreaches(book, p.id), "breaches " + p.id);
    }
    assert.deepEqual(Engine.roll(book, book.projects), Frozen.roll(book, book.projects));
    assert.deepEqual(Engine.curve(book, book.projects), Frozen.curve(book, book.projects));
    assert.deepEqual(Engine.crossDepBreaches(book, book.projects), Frozen.crossDepBreaches(book, book.projects));
  });

  const stages = async (pid) => rows(await query(
    `SELECT id, parent_id, weight::float AS weight, pct, row_version, start_date, end_date
       FROM activity WHERE project_id = $1 ORDER BY stage`, [pid]));
  const boot_ = async () => (await admin.get("/api/bootstrap")).body.db;

  test("FX-05 · a stage rolls up: its weight passes to the child, the budget is carried once", async () => {
    const pid = SITE_PROJECT_GRU;
    const [s1, s2] = await stages(pid);
    // s1 must have no link and no progress to become a summary
    await query(`DELETE FROM activity_dep WHERE activity_id = $1 OR predecessor_id = $1`, [s1.id]);
    await query(`UPDATE activity SET pct = 0 WHERE id = $1`, [s1.id]);
    await query(`DELETE FROM activity_dep WHERE activity_id = $1 OR predecessor_id = $1`, [s2.id]);
    const before_ = Engine.metrics(await boot_(), pid);
    const totalWeight = (await stages(pid)).reduce((n, a) => n + a.weight, 0);

    const r = await admin.patch(`/api/activities/${s2.id}/parent`, { parent: s1.id, version: s2.row_version });
    assert.equal(r.status, 200, r.text);
    const [a1, a2] = await stages(pid);
    assert.equal(a2.parent_id, s1.id);
    assert.equal(a1.weight, 0, "the summary keeps no weight of its own");
    assert.equal(+(a2.weight).toFixed(4), +(s1.weight + s2.weight).toFixed(4), "its weight went to the child");

    const db = await boot_();
    const leaves = Engine.activities(db, pid);
    assert.ok(Math.abs(leaves.reduce((n, a) => n + a.weight, 0) - totalWeight) < 1e-9,
      "the leaves still carry the whole budget, once");
    const after_ = Engine.metrics(db, pid);
    /* The summary is shown with the child's weight and progress; counted
       as a stage too, EV would hold the child's share twice. It is the
       leaves' sum exactly — and, the parent having done nothing, the
       child's progress now carries the parent's share: that is the only
       move, and it is the one asked for. */
    const leafEv = leaves.reduce((n, a) => n + a.weight * (a.pct / 100) * after_.bac, 0);
    assert.ok(Math.abs(after_.ev - leafEv) < 1e-9, "EV is the leaves' sum, nothing counted twice");
    assert.ok(Math.abs((after_.ev - before_.ev) - s1.weight * (s2.pct / 100) * after_.bac) < 1e-6);
    assert.equal(after_.ac, before_.ac);
    assert.equal(after_.bac, before_.bac);
    const sum = db.activities.find((a) => a.id === s1.id);
    const kid = db.activities.find((a) => a.id === s2.id);
    assert.equal(sum.start, kid.start, "the summary's window is its child's");
    assert.equal(sum.end, kid.end);
    assert.equal(sum.pct, kid.pct);
    assert.ok(!Engine.activities(db, pid).some((a) => a.id === s1.id), "the summary is not a stage the numbers read");
    const audit = rows(await query(
      `SELECT action FROM audit_event WHERE entity_id = $1 ORDER BY id DESC LIMIT 1`, [s2.id]));
    assert.equal(audit[0]?.action, "Stage moved in the breakdown");
  });

  test("FX-05 · the refusals: stale version, cycle, other project, links, progress, reader", async () => {
    const pid = SITE_PROJECT_GRU;
    const [s1, s2, s3] = await stages(pid);
    assert.equal((await admin.patch(`/api/activities/${s3.id}/parent`, { parent: s1.id, version: s3.row_version - 1 || 99 })).status, 409);
    assert.equal((await admin.patch(`/api/activities/${s3.id}/parent`, { parent: s1.id })).status, 428);
    const cyc = await admin.patch(`/api/activities/${s1.id}/parent`, { parent: s2.id, version: s1.row_version });
    assert.equal(cyc.status, 400, cyc.text);
    assert.match(cyc.body.error, /own children/);
    const other = rows(await query(`SELECT id FROM activity WHERE project_id = $1 LIMIT 1`, [GROUP_PROJECT]))[0];
    const cross = await admin.patch(`/api/activities/${s3.id}/parent`, { parent: other.id, version: s3.row_version });
    assert.equal(cross.status, 400);
    // s3 has links in the seed: it cannot become a summary
    const links = rows(await query(`SELECT count(*)::int AS n FROM activity_dep WHERE activity_id = $1 OR predecessor_id = $1`, [s3.id]))[0].n;
    if (links > 0) {
      const s4 = (await stages(pid))[3];
      const lk = await admin.patch(`/api/activities/${s4.id}/parent`, { parent: s3.id, version: s4.row_version });
      assert.equal(lk.status, 400);
      assert.match(lk.body.error, /summary stage carries none/);
    }
    assert.equal((await viewer.patch(`/api/activities/${s3.id}/parent`, { parent: null, version: s3.row_version })).status, 403);
    // the database holds the same rules for every other path
    await assert.rejects(() => query(`UPDATE activity SET parent_id = $2 WHERE id = $1`, [s1.id, s2.id]), /own ancestor/);
    await assert.rejects(() => query(`UPDATE activity SET parent_id = $2 WHERE id = $1`, [s3.id, other.id]), /its own project/);
    await assert.rejects(() => query(`INSERT INTO activity_dep (activity_id, predecessor_id) VALUES ($1, $2)`, [s3.id, s1.id]),
      /summary stage carries no dependency link/);
  });

  test("FX-05 · a summary's dates and progress are not entered, and it is not removed with children", async () => {
    const pid = SITE_PROJECT_GRU;
    const [s1] = await stages(pid);
    const r = await admin.patch(`/api/activities/${s1.id}`, { pct: 40, version: s1.row_version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /summary stage/);
    const renamed = await admin.patch(`/api/activities/${s1.id}`, { name: "Discovery (summary)", version: s1.row_version });
    assert.equal(renamed.status, 200, "its name is still its own");
    assert.equal((await admin.del(`/api/activities/${s1.id}`)).status, 409);
  });

  test("FX-05 · back to the top level: the summary becomes a stage again, over the window it showed", async () => {
    const pid = SITE_PROJECT_GRU;
    const [s1, s2] = await stages(pid);
    const r = await admin.patch(`/api/activities/${s2.id}/parent`, { parent: null, version: s2.row_version });
    assert.equal(r.status, 200, r.text);
    const [a1, a2] = await stages(pid);
    assert.equal(a2.parent_id, null);
    assert.equal(a1.start_date, s2.start_date);
    assert.equal(a1.end_date, s2.end_date);
    assert.ok(a1.row_version > s1.row_version);
  });

  test("FX-07 · a named baseline copies the plan and never moves the governed baseline", async () => {
    const pid = SITE_PROJECT_GRU;
    const gov0 = rows(await query(`SELECT id, base_start, base_end FROM activity WHERE project_id = $1 ORDER BY id`, [pid]));
    const r = await admin.post(`/api/projects/${pid}/baselines`, { name: "Approved plan", reason: "Gate 2 sign-off" });
    assert.equal(r.status, 201, r.text);
    const gov1 = rows(await query(`SELECT id, base_start, base_end FROM activity WHERE project_id = $1 ORDER BY id`, [pid]));
    assert.deepEqual(gov1, gov0, "base_start / base_end untouched");
    const list = (await viewer.get(`/api/projects/${pid}/baselines`));
    assert.equal(list.status, 200, "a reader may compare");
    const snap = list.body.baselines.find((b) => b.id === r.body.id);
    assert.equal(snap.name, "Approved plan");
    assert.equal(snap.reason, "Gate 2 sign-off");
    assert.equal(snap.rows.length, gov0.length);
    assert.ok(snap.takenByName);
    assert.equal(list.body.max, 11);
    // what the export carries
    const exp = (await admin.get("/api/admin/export")).body;
    assert.ok(exp.baselines.some((b) => b.id === r.body.id && b.rows.length === gov0.length));
  });

  test("FX-07 · read-only once taken: no route rewrites one, the database refuses", async () => {
    const id = rows(await query(`SELECT id FROM baseline_snapshot LIMIT 1`))[0].id;
    assert.equal((await admin.patch(`/api/projects/${SITE_PROJECT_GRU}/baselines/${id}`, { name: "x", version: 1 })).status, 404);
    assert.equal((await admin.del(`/api/projects/${SITE_PROJECT_GRU}/baselines/${id}`)).status, 404);
    await assert.rejects(() => query(`UPDATE baseline_snapshot SET name = 'rewritten' WHERE id = $1`, [id]), /read-only once taken/);
    await assert.rejects(() => query(`UPDATE baseline_snapshot_row SET end_date = end_date + 1 WHERE snapshot_id = $1`, [id]), /read-only once taken/);
  });

  test("FX-07 · authority (rbac baseline.snapshot), a name, a reason, no duplicate, eleven at most", async () => {
    const pid = SITE_PROJECT_GRU;
    assert.equal((await viewer.post(`/api/projects/${pid}/baselines`, { name: "V", reason: "r" })).status, 403);
    // a site lead holds project write authority on its own site-governed project
    const own = await siteGRU.post(`/api/projects/${pid}/baselines`, { name: "Site lead's", reason: "weekly" });
    assert.equal(own.status, 201, own.text);
    // …and none on a group-governed one, which it can only read
    assert.equal((await siteGRU.post(`/api/projects/${GROUP_PROJECT}/baselines`, { name: "S", reason: "r" })).status, 403);
    assert.equal((await admin.post(`/api/projects/${pid}/baselines`, { name: "", reason: "r" })).status, 400);
    assert.equal((await admin.post(`/api/projects/${pid}/baselines`, { name: "No reason" })).status, 400);
    assert.equal((await admin.post(`/api/projects/${pid}/baselines`, { name: "Approved plan", reason: "again" })).status, 409);
    const have = rows(await query(`SELECT count(*)::int AS n FROM baseline_snapshot WHERE project_id = $1`, [pid]))[0].n;
    for (let i = have; i < 11; i++) {
      assert.equal((await admin.post(`/api/projects/${pid}/baselines`, { name: "BL " + i, reason: "fill" })).status, 201);
    }
    const twelfth = await admin.post(`/api/projects/${pid}/baselines`, { name: "BL 12", reason: "one too many" });
    assert.equal(twelfth.status, 409);
    await assert.rejects(() => query(
      `INSERT INTO baseline_snapshot (id, project_id, name) VALUES ('BSL-X', $1, 'direct')`, [pid]), /eleven/);
  });

  test("FX-07 · the rbac case: project write authority, and nothing less", () => {
    const row = { id: "P", programme_id: "PG", site_id: "GRU", governance_level: "site" };
    const site = { active: true, role: "site", grants: [{ scope_kind: "site", site_id: "GRU" }] };
    const other = { active: true, role: "site", grants: [{ scope_kind: "site", site_id: "YYZ" }] };
    const reader = { active: true, role: "viewer", grants: [] };
    assert.equal(can(site, "baseline.snapshot", { project: row }).ok, true);
    assert.equal(can(other, "baseline.snapshot", { project: row }).ok, false);
    assert.equal(can(reader, "baseline.snapshot", { project: row }).ok, false);
    assert.equal(can(site, "project.baseline", { project: row }).ok, false,
      "moving the governed baseline stays group work");
  });

  test("FX-06 · the drag writes through the audited stage route, with its version, and a stale one is 409", async () => {
    const pid = SITE_PROJECT_GRU;
    const a = (await stages(pid)).find((x) => x.parent_id === null);
    const moved = await admin.patch(`/api/activities/${a.id}`, {
      start: "2026-09-02", end: "2026-10-02", version: a.row_version });
    assert.equal(moved.status, 200, moved.text);
    const stale = await admin.patch(`/api/activities/${a.id}`, {
      start: "2026-09-03", end: "2026-10-03", version: a.row_version });
    assert.equal(stale.status, 409, "the bar that was dragged on an old copy snaps back");
    assert.equal((await viewer.patch(`/api/activities/${a.id}`, { start: "2026-09-04", version: moved.body.version })).status, 403);
  });

  test("FX-05 · the import keeps a three-level tree, and refuses a parent in another project", async () => {
    const exp = (await admin.get("/api/admin/export")).body;
    const acts = exp.activities.filter((a) => a.project === GROUP_PROJECT);
    const [x, y, z] = acts;
    for (const s of [x, y, z]) exp.activities.find((a) => a.id === s.id).deps = [];
    for (const a of exp.activities) a.deps = (a.deps ?? []).filter((d) => d !== x.id && d !== y.id);
    exp.activities.find((a) => a.id === y.id).parentId = x.id;
    exp.activities.find((a) => a.id === z.id).parentId = y.id;
    const r = await admin.post("/api/admin/import", { db: exp });
    assert.equal(r.status, 200, r.text);
    const back = (await admin.get("/api/admin/export")).body.activities;
    assert.equal(back.find((a) => a.id === y.id).parentId, x.id);
    assert.equal(back.find((a) => a.id === z.id).parentId, y.id);
    const tree = Engine.wbs({ activities: back }, GROUP_PROJECT);
    assert.deepEqual(tree.filter((r_) => [x.id, y.id, z.id].includes(r_.a.id)).map((r_) => r_.outline), ["1", "1.1", "1.1.1"]);
    assert.equal(rows(await query(`SELECT weight::float AS w FROM activity WHERE id = $1`, [x.id]))[0].w, 0,
      "a summary is stored without a weight of its own");

    const bad_ = structuredClone(exp);
    bad_.activities.find((a) => a.id === z.id).parentId = book.activities.find((a) => a.project === SITE_PROJECT_GRU).id;
    const refused = await admin.post("/api/admin/import", { db: bad_ });
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /its own project/);
  });
});

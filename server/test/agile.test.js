/**
 * FX-14 · SPRINTS, VELOCITY, BURNDOWN, BURNUP, AND THE HYBRID PLAN
 * (docs/41, seat S3 — FitAdapt delivers in sprints).
 *
 * The arithmetic is proved first, on examples worked by hand, so each
 * test is a specification and not a snapshot of what the code happened
 * to return. Then the constitution:
 *
 *   · D-41.01 — a project without sprints is unchanged: `Engine.metrics`
 *     for every project, `Engine.roll` and `Engine.criticalPath` on the
 *     seeded book are deep-equal to the numbers measured on 5.28.0
 *     (fixtures/engine-5.28.0.json, produced at commit 7f3dd7a before any
 *     of this code existed) — before sprints exist, and after sprints,
 *     points and stage links have been written with the option off;
 *   · the hybrid option, on, feeds the SAME `pct` the engine already
 *     reads: the metrics equal the 5.28.0 engine run on the book with that
 *     one stage's % replaced by done points / total points;
 *   · every act is authorised in shared/rbac.js, audited, and versioned.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, shutdown, as, client, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { one, many, query } from "../src/db.js";
import { loadPortfolio } from "../src/portfolio.js";
import { Engine } from "../../shared/engine.js";
import { can } from "../../shared/rbac.js";
import {
  velocity, burndown, burnup, itemProgress, closingPlan, daysBetween,
} from "../../shared/agile.js";
import { engineSnapshot } from "./fixtures/engine-snapshot.js";

const BASELINE = JSON.parse(readFileSync(new URL("./fixtures/engine-5.28.0.json", import.meta.url), "utf8"));
const ADMIN = { id: "T", role: "admin", active: true, grants: { programmes: new Set(), sites: new Set() } };
const book = () => loadPortfolio(ADMIN);

/* ── 1 · the arithmetic, by hand ─────────────────────────────────── */

describe("FX-14 · velocity", () => {
  const s = (id, end, donePoints, state = "closed") => ({ id, project: "P", name: id, end, state, donePoints });

  test("three sprints delivering 20, 25 and 30 points → a velocity of 25", () => {
    const v = velocity([s("S1", "2026-07-10", 20), s("S2", "2026-07-24", 25), s("S3", "2026-08-07", 30)], "P");
    assert.equal(v.average, 25);                     // (20 + 25 + 30) / 3
    assert.equal(v.basis, 3);
    assert.deepEqual(v.window, ["S1", "S2", "S3"]);
  });

  test("the LAST three closed sprints: 10, 20, 25, 30 → 25, and order is by end date, not by list", () => {
    const v = velocity([s("S4", "2026-08-21", 30), s("S1", "2026-07-10", 10),
      s("S3", "2026-08-07", 25), s("S2", "2026-07-24", 20)], "P");
    assert.deepEqual(v.window, ["S2", "S3", "S4"]);
    assert.equal(v.average, 25);                     // (20 + 25 + 30) / 3, S1's 10 falls out
  });

  test("open sprints and other projects do not count; fewer than three is said; none is no velocity", () => {
    const v = velocity([s("S1", "2026-07-10", 12), s("S2", "2026-07-24", null, "active"),
      { ...s("X1", "2026-07-10", 99), project: "Q" }], "P");
    assert.equal(v.average, 12);
    assert.equal(v.basis, 1);
    assert.equal(velocity([s("S2", "2026-07-24", null, "active")], "P").average, null,
      "no sprint has closed: there is no velocity, not a velocity of 0");
  });
});

describe("FX-14 · burndown and burnup", () => {
  const sprint = { id: "IT-1", project: "P", start: "2026-08-24", end: "2026-08-28" };
  const items = [
    { id: "A", project: "P", iteration: "IT-1", column: "done", points: 5, doneAt: "2026-08-25T10:00:00.000Z", created: "2026-08-24" },
    { id: "B", project: "P", iteration: "IT-1", column: "done", points: 3, doneAt: "2026-08-27T16:00:00.000Z", created: "2026-08-24" },
    { id: "C", project: "P", iteration: "IT-1", column: "progress", points: 2, doneAt: null, created: "2026-08-26" },
    { id: "Z", project: "P", iteration: null, column: "backlog", points: 8, doneAt: null, created: "2026-08-20" },
  ];

  test("scope 10; 5 done on the 25th, 3 on the 27th → 10, 5, 5, 2; the 28th is not measured yet", () => {
    const b = burndown(sprint, items, "2026-08-27");
    assert.equal(b.scope, 10);                        // A 5 + B 3 + C 2; Z is not in the sprint
    assert.deepEqual(b.series.map((d) => d.remaining), [10, 5, 5, 2, null]);
    assert.deepEqual(b.series.map((d) => d.ideal), [10, 7.5, 5, 2.5, 0]);   // 10 → 0 over four steps
    assert.equal(b.series[4].why, "future", "a day without data says so; it is not interpolated");
    assert.equal(b.remaining, 2);
  });

  test("a done item with no date is done today, not on a day nobody recorded", () => {
    const withUndated = [...items,
      { id: "D", project: "P", iteration: "IT-1", column: "done", points: 4, doneAt: null, created: "2026-08-24" }];
    const b = burndown(sprint, withUndated, "2026-08-27");
    assert.equal(b.scope, 14);
    assert.deepEqual(b.series.map((d) => d.remaining), [14, 9, 9, 2, null]);  // D's 4 land on the 27th
    assert.deepEqual(b.series.map((d) => !!d.partial), [true, true, true, false, false]);
    assert.deepEqual(b.undated, ["D"]);
    assert.equal(b.undatedPoints, 4);
  });

  test("an unestimated item adds nothing and is named", () => {
    const b = burndown(sprint, [...items,
      { id: "U", project: "P", iteration: "IT-1", column: "backlog", points: null, created: "2026-08-24" }], "2026-08-27");
    assert.equal(b.scope, 10);
    assert.deepEqual(b.unestimated, ["U"]);
  });

  test("burnup: scope 8, 8, 10 and done 0, 5, 5 from the 24th to the 26th", () => {
    const u = burnup(items.filter((i) => i.id !== "Z"), "P", "2026-08-26");
    assert.deepEqual(u.series.map((d) => d.day), ["2026-08-24", "2026-08-25", "2026-08-26"]);
    assert.deepEqual(u.series.map((d) => d.scope), [8, 8, 10]);   // C (2) is created on the 26th
    assert.deepEqual(u.series.map((d) => d.done), [0, 5, 5]);     // B is done on the 27th, after today
    assert.equal(u.scope, 10);
    assert.equal(u.done, 5);
  });

  test("days are counted both ends included", () => {
    assert.deepEqual(daysBetween("2026-08-30", "2026-09-02"), ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
    assert.deepEqual(daysBetween("2026-09-02", "2026-08-30"), []);
  });
});

describe("FX-14 · the hybrid link and the close, decided before anything is written", () => {
  test("5 of 8 points done → 63 % (62.5, rounded to the whole per cent the stage holds)", () => {
    const m = itemProgress([
      { id: "A", activity: "S", column: "done", points: 5 },
      { id: "B", activity: "S", column: "review", points: 3 },
      { id: "C", activity: "T", column: "done", points: 13 },
    ], "S");
    assert.deepEqual(m, { pct: 63, done: 5, total: 8, items: 2, why: null });
  });

  test("nothing to measure is not 0 %: no item, or no points, answers null with the reason", () => {
    assert.equal(itemProgress([], "S").pct, null);
    assert.match(itemProgress([], "S").why, /no linked items/);
    const noPoints = itemProgress([{ id: "A", activity: "S", column: "done", points: null }], "S");
    assert.equal(noPoints.pct, null);
    assert.match(noPoints.why, /no points/);
  });

  test("a close says where the unfinished go, and to a planned sprint of the same project only", () => {
    const it = { id: "IT-1", project: "P", state: "active" };
    const its = [it, { id: "IT-2", project: "P", state: "planned" }, { id: "IT-3", project: "Q", state: "planned" },
      { id: "IT-0", project: "P", state: "closed" }];
    const items = [
      { id: "A", iteration: "IT-1", column: "done", points: 5 },
      { id: "B", iteration: "IT-1", column: "progress", points: 3 },
      { id: "C", iteration: "IT-1", column: "backlog", points: null },
    ];
    assert.equal(closingPlan(it, items, its, undefined).ok, false, "unsaid is refused, not guessed");
    assert.equal(closingPlan(it, items, its, "IT-3").ok, false, "another project's sprint");
    assert.equal(closingPlan(it, items, its, "IT-0").ok, false, "a closed sprint");
    assert.deepEqual(closingPlan(it, items, its, "IT-2"), { ok: true, donePoints: 5, carried: ["B", "C"], to: "IT-2" });
    assert.deepEqual(closingPlan(it, items, its, "backlog"), { ok: true, donePoints: 5, carried: ["B", "C"], to: "backlog" });
  });
});

/* ── 2 · the constitution, on the seeded book ────────────────────── */

before(async () => { await boot(); });
after(shutdown);

describe("FX-14 · D-41.01 — a book without sprints is 5.28.0 to the number", () => {
  test("Engine.metrics (every project), Engine.roll and Engine.criticalPath equal 5.28.0", async () => {
    const db = await book();
    assert.equal(db.statusDate, "2026-08-28", "the snapshot was taken on this status date");
    assert.deepEqual(engineSnapshot(db), BASELINE);
    assert.deepEqual(db.iterations, [], "the seeded book holds no sprint");
    assert.ok(db.activities.every((a) => a.progressFromItems === false && a.pct === a.reportedPct));
  });
});

describe("FX-14 · sprints through the session routes", () => {
  let group, site, viewer, IT1, IT2, items;
  const P = GROUP_PROJECT;       // PRJ-101, group-governed, programme CBP

  before(async () => {
    group = await as("groupCBP");
    site = await as("siteGRU");
    viewer = await as("viewerLIS");
    items = (await group.get("/api/bootstrap")).body.db.items.filter((i) => i.project === P);
  });

  test("authority is decided in rbac: the project's writers plan sprints, no one else", async () => {
    const p = { id: P, governance_level: "group", programme_id: "CBP", site_id: "KRK" };
    assert.equal(can({ role: "group", active: true, grants: { programmes: new Set(["CBP"]), sites: new Set() } },
      "iteration.write", { project: p }).ok, true);
    const siteDenied = can({ role: "site", active: true, grants: { programmes: new Set(), sites: new Set(["GRU"]) } },
      "iteration.write", { project: p });
    assert.equal(siteDenied.ok, false);
    assert.match(siteDenied.why, /group-governed|outside your authority/);
    const body = { project: P, name: "Sprint 1", start: "2026-08-10", end: "2026-08-21" };
    assert.equal((await site.post("/api/iterations", body)).status, 403);
    /* This viewer's grant does not reach PRJ-101: out of scope answers
       exactly as absent does (B2), 404 — never a write either way. */
    assert.equal((await viewer.post("/api/iterations", body)).status, 404);
    assert.equal(can({ role: "viewer", active: true, grants: { programmes: new Set(["CBP"]), sites: new Set() } },
      "iteration.write", { project: p }).ok, false, "a viewer writes nothing, ever (R1.5)");
  });

  test("a sprint is created, audited, and refused without dates or with them reversed", async () => {
    assert.equal((await group.post("/api/iterations", { project: P, name: "x" })).status, 400);
    const rev = await group.post("/api/iterations", { project: P, name: "x", start: "2026-08-21", end: "2026-08-10" });
    assert.equal(rev.status, 400);
    assert.match(rev.body.error, /cannot end before it starts/);
    const r = await group.post("/api/iterations",
      { project: P, name: "Sprint 1", start: "2026-08-17", end: "2026-08-28", goal: "Retry storm contained" });
    assert.equal(r.status, 201, r.text);
    IT1 = r.body.id;
    const r2 = await group.post("/api/iterations", { project: P, name: "Sprint 2", start: "2026-08-31", end: "2026-09-11" });
    IT2 = r2.body.id;
    const ev = await one(`SELECT * FROM audit_event WHERE entity = 'iteration' AND entity_id = $1`, [IT1]);
    assert.equal(ev.action, "Sprint added");
  });

  test("starting: one active sprint per project — the second is refused by name, and a stale version is a 409", async () => {
    const it1 = await one(`SELECT row_version FROM iteration WHERE id = $1`, [IT1]);
    assert.equal((await group.patch(`/api/iterations/${IT1}`, { state: "active" })).status, 428, "no version, no write");
    const ok = await group.patch(`/api/iterations/${IT1}`, { state: "active", version: it1.row_version });
    assert.equal(ok.status, 200, ok.text);
    const stale = await group.patch(`/api/iterations/${IT1}`, { goal: "x", version: it1.row_version });
    assert.equal(stale.status, 409);
    const second = await group.patch(`/api/iterations/${IT2}`, { state: "active", version: 1 });
    assert.equal(second.status, 400);
    assert.match(second.body.error, new RegExp(`${IT1}.*is the active sprint`));
    /* …and the database holds it too, whatever path writes. */
    await assert.rejects(() => query(`UPDATE iteration SET state = 'active' WHERE id = $1`, [IT2]), /unique|duplicate/i);
    const closed = await group.patch(`/api/iterations/${IT2}`, { state: "closed", version: 1 });
    assert.equal(closed.status, 400, "a PATCH does not close: the close says where the unfinished go");
    assert.equal((await one(`SELECT action FROM audit_event WHERE entity_id = $1 ORDER BY id DESC LIMIT 1`, [IT1])).action,
      "Sprint started");
  });

  test("planning items: points (null = not estimated), the sprint, and done_at following the column", async () => {
    const [a, b, c] = items;
    const plan = async (it, body) => {
      const v = (await one(`SELECT row_version FROM work_item WHERE id = $1`, [it.id])).row_version;
      return group.patch(`/api/workitems/${it.id}`, { ...body, version: v });
    };
    assert.equal((await plan(a, { iteration: IT1, points: 5 })).status, 200);
    assert.equal((await plan(b, { iteration: IT1, points: 3 })).status, 200);
    assert.equal((await plan(c, { iteration: IT1, points: null })).status, 200);
    assert.equal((await one(`SELECT points FROM work_item WHERE id = $1`, [c.id])).points, null);
    assert.equal((await plan(c, { points: -1 })).status, 400, "points are never negative");
    assert.equal((await one(`SELECT action FROM audit_event WHERE entity_id = $1 ORDER BY id DESC LIMIT 1`, [a.id])).action,
      "Work item planned");
    /* another project's sprint is refused */
    const other = (await (await as("siteGRU")).get("/api/bootstrap")).body.db.items.find((i) => i.project === SITE_PROJECT_GRU);
    if (other) {
      const admin = await as("admin");
      const v = (await one(`SELECT row_version FROM work_item WHERE id = $1`, [other.id])).row_version;
      const wrong = await admin.patch(`/api/workitems/${other.id}`, { iteration: IT1, version: v });
      assert.equal(wrong.status, 400);
      assert.match(wrong.body.error, /No such sprint on this project/);
    }
    // into Done stamps when; out of Done clears it
    assert.equal((await plan(a, { column: "done" })).status, 200);
    const stamped = await one(`SELECT done_at FROM work_item WHERE id = $1`, [a.id]);
    assert.ok(stamped.done_at, "moving into Done stamps the moment");
    assert.equal((await plan(b, { column: "done" })).status, 200);
    assert.equal((await plan(b, { column: "review" })).status, 200);
    assert.equal((await one(`SELECT done_at FROM work_item WHERE id = $1`, [b.id])).done_at, null, "out of Done, no date");
  });

  test("with the option OFF, sprints, points and stage links move no number (D-41.01)", async () => {
    const acts = (await book()).activities.filter((x) => x.project === P);
    const admin = await as("admin");
    for (const it of items.slice(0, 2)) {
      const v = (await one(`SELECT row_version FROM work_item WHERE id = $1`, [it.id])).row_version;
      assert.equal((await admin.patch(`/api/workitems/${it.id}`, { activity: acts[0].id, version: v })).status, 200);
    }
    // the item's points changed above (5, 3, null) — the engine does not read items
    assert.deepEqual(engineSnapshot(await book()), BASELINE);
  });

  test("with the option ON, the stage's % is done / total points, fed into the SAME path the engine reads", async () => {
    const before = await book();
    const act = before.activities.filter((x) => x.project === P)[0];
    const admin = await as("admin");
    // a typed % on a measured stage would be a second answer
    const flag = await admin.patch(`/api/activities/${act.id}`, { progressFromItems: true, version: act.version });
    assert.equal(flag.status, 200, flag.text);
    const after = await book();
    const a2 = after.activities.find((x) => x.id === act.id);
    // linked: items[0] 5 points, Done; items[1] 3 points, In review → 5 / 8 = 62.5 → 63
    assert.equal(a2.progressFromItems, true);
    assert.deepEqual(a2.progressItems, { done: 5, total: 8, items: 2 });
    assert.equal(a2.pct, 63);
    assert.equal(a2.reportedPct, act.pct, "the stored figure is kept, and travels");
    /* The same path: the 5.28.0 engine on the book with ONLY that
       stage's % replaced gives exactly the numbers the book now gives. */
    const expected = { ...before, activities: before.activities.map((x) => (x.id === act.id ? { ...x, pct: 63 } : x)) };
    assert.deepEqual(Engine.metrics(after, P), Engine.metrics(expected, P));
    assert.deepEqual(Engine.roll(after, after.projects).ev, Engine.roll(expected, expected.projects).ev);
    // …and no other project moved
    const snap = engineSnapshot(after);
    for (const id of Object.keys(BASELINE.metrics)) {
      if (id !== P) assert.deepEqual(snap.metrics[id], BASELINE.metrics[id], id);
    }
    const typed = await admin.patch(`/api/activities/${act.id}`, { pct: 90, version: a2.version });
    assert.equal(typed.status, 409);
    assert.match(typed.body.error, /measured from the points of its work items/);
    const off = await admin.patch(`/api/activities/${act.id}`, { progressFromItems: false, version: a2.version });
    assert.equal(off.status, 200);
    assert.deepEqual(engineSnapshot(await book()), BASELINE, "off again, 5.28.0 again");
  });

  test("closing: refused unsaid, then the unfinished go to the next sprint and the points delivered are recorded", async () => {
    const v = () => one(`SELECT row_version FROM iteration WHERE id = $1`, [IT1]).then((x) => x.row_version);
    const unsaid = await group.post(`/api/iterations/${IT1}/close`, { version: await v() });
    assert.equal(unsaid.status, 400);
    assert.match(unsaid.body.error, /where the unfinished items go/);
    const stale = await group.post(`/api/iterations/${IT1}/close`, { version: (await v()) - 1, unfinished: IT2 });
    assert.equal(stale.status, 409);
    const r = await group.post(`/api/iterations/${IT1}/close`,
      { version: await v(), unfinished: IT2, closedOn: "2026-08-28" });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.donePoints, 5);                        // items[0], 5 points, Done
    assert.deepEqual(r.body.carried.sort(), [items[1].id, items[2].id].sort());
    const moved = await many(`SELECT id, iteration_id FROM work_item WHERE id = ANY($1)`, [[items[1].id, items[2].id]]);
    assert.ok(moved.every((m) => m.iteration_id === IT2));
    const ev = await one(`SELECT * FROM audit_event WHERE entity_id = $1 AND action = 'Sprint closed'`, [IT1]);
    assert.ok(ev, "the close is on the trail");
    const db = await book();
    assert.equal(db.iterations.find((x) => x.id === IT1).donePoints, 5);
    assert.equal(velocity(db.iterations, P).average, 5);
  });

  test("a closed sprint is a record: not edited, not removed, takes no new item", async () => {
    const it = await one(`SELECT row_version FROM iteration WHERE id = $1`, [IT1]);
    assert.equal((await group.patch(`/api/iterations/${IT1}`, { goal: "rewritten", version: it.row_version })).status, 409);
    assert.equal((await group.del(`/api/iterations/${IT1}`)).status, 409);
    const v = (await one(`SELECT row_version FROM work_item WHERE id = $1`, [items[3].id])).row_version;
    const late = await group.patch(`/api/workitems/${items[3].id}`, { iteration: IT1, version: v });
    assert.equal(late.status, 400);
    assert.match(late.body.error, /is closed/);
  });

  test("removing a planned sprint returns its items to the backlog and names them on the trail", async () => {
    const r = await group.del(`/api/iterations/${IT2}`);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.returnedToBacklog.length, 2);
    const back = await many(`SELECT iteration_id FROM work_item WHERE id = ANY($1)`, [r.body.returnedToBacklog]);
    assert.ok(back.every((x) => x.iteration_id === null));
    const ev = await one(`SELECT before_json FROM audit_event WHERE entity_id = $1 AND action = 'Sprint removed'`, [IT2]);
    assert.deepEqual(ev.before_json.items, r.body.returnedToBacklog);
  });
});

describe("FX-14 · /api/v1 — a tracker pushes sprints and points", () => {
  let KEY;
  const c = client();
  const put = (path, body) => c.put(path, body, { "X-API-Key": KEY });

  before(async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/admin/integrations", { name: "Jira sync", scopes: "read:portfolio,write:portfolio", purpose: "test" });
    KEY = r.body.key;
  });

  test("a sprint by its own id; items planned into it by that id; a close that says where", async () => {
    const s1 = await put("/api/v1/iterations/JIRA-S7", { project: SITE_PROJECT_GRU, name: "Sprint 7",
      start: "2026-08-17", end: "2026-08-28", state: "active" });
    assert.equal(s1.status, 201, s1.text);
    const again = await put("/api/v1/iterations/JIRA-S7", { name: "Sprint 7" });
    assert.equal(again.status, 200);
    assert.equal(again.body.version, 1, "the same body twice writes nothing");
    const w = await put("/api/v1/workitems/JIRA-101", { project: SITE_PROJECT_GRU, title: "PIX QR payments",
      points: 8, iteration: "JIRA-S7", column: "done" });
    assert.equal(w.status, 201, w.text);
    const row = await one(`SELECT * FROM work_item WHERE id = $1`, [w.body.id]);
    assert.equal(row.iteration_id, s1.body.id);
    assert.ok(row.done_at, "created in Done: stamped");
    const w2 = await put("/api/v1/workitems/JIRA-102", { project: SITE_PROJECT_GRU, title: "Boleto reconciliation",
      points: null, iteration: "JIRA-S7" });
    assert.equal(w2.status, 201);
    assert.equal((await put("/api/v1/workitems/JIRA-103", { project: SITE_PROJECT_GRU, title: "x", points: -2 })).status, 400);
    assert.equal((await put("/api/v1/iterations/JIRA-S7", { state: "closed" })).status, 400, "unsaid is refused");
    const closed = await put("/api/v1/iterations/JIRA-S7", { state: "closed", unfinished: "backlog" });
    assert.equal(closed.status, 200, closed.text);
    const it = await one(`SELECT * FROM iteration WHERE id = $1`, [s1.body.id]);
    assert.equal(it.state, "closed");
    assert.equal(it.done_points, 8);
    assert.equal((await one(`SELECT iteration_id FROM work_item WHERE id = $1`, [w2.body.id])).iteration_id, null);
    const twice = await put("/api/v1/iterations/JIRA-S7", { state: "closed", unfinished: "backlog" });
    assert.equal(twice.status, 200, "the same close sent twice is the record already held");
    assert.equal((await put("/api/v1/iterations/JIRA-S7", { goal: "rewrite history" })).status, 409);
  });

  test("a stage measured from its items refuses a pushed %", async () => {
    const act = await one(`SELECT id, row_version FROM activity WHERE project_id = $1 ORDER BY id LIMIT 1`, [SITE_PROJECT_GRU]);
    await query(`UPDATE activity SET progress_from_items = true WHERE id = $1`, [act.id]);
    const r = await put("/api/v1/activities/SCHED-1", { activity: act.id, pct: 40 });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /measured from the points of its work items/);
    await query(`UPDATE activity SET progress_from_items = false WHERE id = $1`, [act.id]);
  });

  test("the contract declares the sprint collection and the item's new fields", async () => {
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": KEY })).body;
    assert.ok(doc.paths["/api/v1/iterations/{externalId}"]?.put, "PUT /api/v1/iterations is published");
    const unknown = await put("/api/v1/iterations/JIRA-S9", { project: SITE_PROJECT_GRU, sprintName: "x" });
    assert.equal(unknown.status, 400, "a field the collection does not declare is refused (REQ-19)");
  });
});

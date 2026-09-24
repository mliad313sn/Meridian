/**
 * FX-15 (docs/41, wave D) — the programme master schedule, typed
 * cross-project links, and D-41.01.
 *
 * Four halves.
 *
 *   1. D-41.01 — the demonstration book (every cross_dep FS/0 after 067)
 *      through the frozen 5.28.0 engine and today's: `crossDepBreaches`,
 *      `metrics` and the seven original `criticalPath` keys are equal; and
 *      the scheduler's new multi-calendar mode, given one calendar for
 *      every activity, computes exactly what the one-calendar mode does.
 *   2. Worked examples, computed by hand in the comments BEFORE the
 *      assertion: two projects, A.last → B.first SS+3; the programme
 *      finish, the chain, the float the link consumes; each project on its
 *      own calendar.
 *   3. Authority: a link binds two plans, so rbac asks for both sides, and
 *      the refusal names the side that is not the caller's.
 *   4. The routes: create typed, edit under the version read, 409 stale,
 *      and the export carries type and lag but not the serial.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { Engine } from "../../shared/engine.js";
import { Engine as Engine528 } from "./fixtures/engine-5.28.0.js";
import { schedule } from "../../shared/schedule.js";
/* FX-15 — the programme run is its own module (shared/programme.js), not
   an Engine method, so the web bundle loads it with the master schedule
   (D-41.03); the same function, called the same way. */
import { programmeSchedule } from "../../shared/programme.js";
import { can } from "../../shared/rbac.js";
import { many, one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

const book = async (c) => (await c.get("/api/bootstrap")).body.db;

/* ── 1 · D-41.01 ──────────────────────────────────────────────────── */

describe("D-41.01 · every cross-project link FS/0 reads as 5.28.0 did", () => {
  let exported;
  before(async () => {
    exported = (await (await as("admin")).get("/api/admin/export")).body;
  });
  const copy = () => JSON.parse(JSON.stringify(exported));
  const KEPT = ["critical", "float", "projEnd", "es", "ef", "ls", "lf"];
  const kept = (cp) => Object.fromEntries(KEPT.map((k) => [k, cp[k]]));

  test("the seeded links are there, and every one reads FS with no lag", () => {
    assert.ok(exported.crossDeps.length >= 5);
    assert.ok(exported.crossDeps.every((c) => c.type === "FS" && c.lag === 0), "067's defaults");
    assert.ok(exported.crossDeps.every((c) => !("id" in c)), "the serial is not book data");
  });

  test("Engine.crossDepBreaches — the whole portfolio, equal to 5.28.0", () => {
    const before = copy(), now = copy();
    const strip = (list) => list.map((b) => [b.dep.from, b.dep.fromStage, b.dep.to, b.dep.toStage, b.overlap, b.agreed]);
    assert.deepEqual(strip(Engine.crossDepBreaches(now, now.projects)),
      strip(Engine528.crossDepBreaches(before, before.projects)));
  });

  test("Engine.metrics and the seven criticalPath keys — every project, equal to 5.28.0", () => {
    const before = copy(), now = copy();
    for (const p of exported.projects) {
      assert.deepEqual(Engine.metrics(now, p.id), Engine528.metrics(before, p.id), p.id);
      assert.deepEqual(kept(Engine.criticalPath(now, p.id)), Engine528.criticalPath(before, p.id), p.id);
    }
  });

  test("a programme of one project is that project's own schedule — the multi-calendar mode is the identity", () => {
    const db = copy();
    let compared = 0;
    for (const p of db.projects) {
      const cp = Engine.criticalPath(db, p.id);
      const ps = programmeSchedule(db, p.programme, [p]).result;
      for (const k of ["es", "ef", "ls", "lf", "float", "freeFloat"]) assert.deepEqual(ps[k], cp[k], `${p.id} ${k}`);
      assert.deepEqual([...ps.critical].sort(), [...cp.critical].sort(), p.id);
      compared += Object.keys(cp.es).length;
    }
    assert.ok(compared >= 40);
  });

  test("the same, with a Monday–Friday calendar and a holiday: `calendars` all one = `calendar`", () => {
    const db = copy();
    const cal = { workdays: 62, holidays: ["2026-12-25", "2026-05-01"] };
    for (const p of db.projects) {
      const acts = Engine.activities(db, p.id);
      if (!acts.length) continue;
      const one_ = schedule(acts, { calendar: cal, statusDate: "2026-08-28" });
      const many_ = schedule(acts, { calendars: Object.fromEntries(acts.map((a) => [a.id, cal])), statusDate: "2026-08-28" });
      for (const k of ["es", "ef", "ls", "lf", "float", "freeFloat", "dates", "late", "missed"]) {
        assert.deepEqual(many_[k], one_[k], `${p.id} ${k}`);
      }
    }
  });

  test("nothing about the per-project numbers moves when the programme is scheduled", () => {
    const db = copy();
    const before = db.projects.map((p) => kept(Engine.criticalPath(db, p.id)));
    for (const pr of db.programmes) programmeSchedule(db, pr.id);
    assert.deepEqual(db.projects.map((p) => kept(Engine.criticalPath(db, p.id))), before);
    assert.deepEqual(db, copy(), "D-41.02 — the computation wrote nothing into the book");
  });
});

/* ── 2 · worked examples ──────────────────────────────────────────── */

const act = (id, project, stage, start, end, deps = []) =>
  ({ id, project, stage, name: id, start, end, baseStart: start, baseEnd: end, weight: 0.5, pct: 0, deps });
const two = (link, extra = {}) => ({
  projects: [
    { id: "PA", name: "A", programme: "PG", site: "S1", start: "2026-01-01", finish: "2026-01-21", ...extra.PA },
    { id: "PB", name: "B", programme: "PG", site: "S2", start: "2026-01-05", finish: "2026-01-25", ...extra.PB },
  ],
  sites: [{ id: "S1" }, { id: "S2" }], programmes: [{ id: "PG" }], calendars: extra.calendars ?? [],
  activities: extra.activities ?? [
    act("A1", "PA", 0, "2026-01-01", "2026-01-11"),               // 10 days
    act("A2", "PA", 1, "2026-01-11", "2026-01-21", ["A1"]),       // 10 days, FS after A1 — A's last stage
    act("B1", "PB", 0, "2026-01-05", "2026-01-10"),               //  5 days — B's first stage
    act("B2", "PB", 1, "2026-01-10", "2026-01-20", ["B1"]),       // 10 days, FS after B1
    act("B3", "PB", 2, "2026-01-05", "2026-01-25"),               // 20 days, free-standing
  ],
  crossDeps: link ? [{ from: "PA", fromStage: 1, to: "PB", toStage: 0, label: "hand-over", ...link }] : [],
});

describe("FX-15 · A.last → B.first SS+3, by hand", () => {
  /* Day 0 = 1 Jan 2026, calendar days (no calendar anywhere).
       A1 0→10, A2 10→20.
       On its own, B: B1 4→9, B2 9→19, B3 4→24 → B finishes day 24 (25 Jan);
         B1 and B2 have 24 − 19 = 5 days of float, B3 none.
       With A2 → B1 SS+3: B1 cannot start before A2.es + 3 = 13 (14 Jan),
         so B1 13→18, B2 18→28; B3 stays 4→24.
       Programme finish = day 28 = 29 Jan 2026.
       Backward from 28: B2 ls 18 (float 0), B1 lf 18 ls 13 (float 0),
         A2 lf = B1.ls − 3 + 10 = 20 → float 0, A1 float 0, B3 lf 28 → float 4.
       Chain: A1 → (FS) A2 → (SS+3, across) B1 → (FS) B2.
       B is pushed 29 Jan − 25 Jan = 4 days; B1 and B2 lose their 5 days
       of float → float consumed 5. A is not moved and loses nothing. */
  test("the programme finish, the chain and the float the link consumes", () => {
    const ps = programmeSchedule(two({ type: "SS", lag: 3 }), "PG");
    assert.equal(ps.finish, "2026-01-29");
    assert.deepEqual(ps.chain.map((c) => c.id), ["A1", "A2", "B1", "B2"]);
    assert.deepEqual(ps.chain.map((c) => c.via && [c.via.type, c.via.lag, c.via.cross]),
      [null, ["FS", 0, false], ["SS", 3, true], ["FS", 0, false]]);
    assert.equal(ps.chain[2].es, "2026-01-14", "B1 starts A2.start + 3 days");
    const r = ps.result;
    assert.deepEqual([r.es.B1, r.ef.B1, r.es.B2, r.ef.B2], [13, 18, 18, 28]);
    assert.deepEqual([r.float.A1, r.float.A2, r.float.B1, r.float.B2, r.float.B3], [0, 0, 0, 0, 4]);
    const [pa, pb] = ps.projects;
    assert.deepEqual([pa.finish, pa.ownFinish, pa.pushed, pa.floatConsumed], ["2026-01-21", "2026-01-21", 0, 0]);
    assert.deepEqual([pb.finish, pb.ownFinish, pb.pushed, pb.floatConsumed], ["2026-01-29", "2026-01-25", 4, 5]);
    assert.ok(pa.onChain && pb.onChain);
  });

  test("the same link as FS/0 (a link written before 067): B1 waits for A2 to finish", () => {
    /* B1 20→25, B2 25→35: finish day 35 = 5 Feb 2026; B pushed 11 days. */
    for (const link of [{}, { type: "FS", lag: 0 }]) {
      const ps = programmeSchedule(two(link), "PG");
      assert.equal(ps.finish, "2026-02-05");
      assert.equal(ps.projects[1].pushed, 11);
      assert.equal(ps.chain[2].via.type, "FS");
    }
  });

  test("without a link, the programme is its projects side by side: nothing pushed, nothing consumed", () => {
    const ps = programmeSchedule(two(null), "PG");
    assert.equal(ps.finish, "2026-01-25");
    assert.ok(ps.projects.every((p) => p.pushed === 0 && p.floatConsumed === 0));
    assert.ok(ps.chain.every((c) => !c.via?.cross));
  });

  test("an SS link is not a breach, whatever it overlaps — only FS says “after it ends”", () => {
    /* The five-day tolerance of O-7 reads FS: B1 starts 16 days before A2
       ends. As FS/0 that is a breach; as SS+3 it is the plan. */
    const agreedAfter = (db) => { db.activities.find((a) => a.id === "B1").baseStart = "2026-01-21"; return db; };
    const fs = agreedAfter(two({ type: "FS", lag: 0 }));
    assert.equal(Engine.crossDepBreaches(fs, fs.projects).length, 1);
    const ss = agreedAfter(two({ type: "SS", lag: 3 }));
    assert.equal(Engine.crossDepBreaches(ss, ss.projects).length, 0);
  });

  test("a project outside the run is left out and named, never guessed", () => {
    const db = two({ type: "SS", lag: 3 });
    const ps = programmeSchedule(db, "PG", [db.projects[1]]);
    assert.equal(ps.outside.length, 1);
    assert.equal(ps.finish, "2026-01-25", "B alone");
  });
});

describe("FX-15 · each project keeps its own calendar", () => {
  /* Monday 5 Jan 2026. A works Monday–Friday; B works every day.
     A1: 5 working days from Mon 5 Jan → Mon…Fri, finishes (the day after)
     Sat 10 Jan. B1 (2 days, B's calendar) FS+0 after A1: starts Sat 10 Jan
     — a day A does not work but B does — and finishes Mon 12 Jan.
     With FS+2, the lag counts in B's days: starts Mon 12 Jan. */
  const mixed = (lag, calA, calB) => ({
    projects: [
      { id: "PA", name: "A", programme: "PG", site: "S1", calendar: calA },
      { id: "PB", name: "B", programme: "PG", site: "S2", calendar: calB },
    ],
    sites: [{ id: "S1" }, { id: "S2" }], programmes: [{ id: "PG" }],
    calendars: [{ id: "MF", workdays: 62, holidays: [] }, { id: "ALL", workdays: 127, holidays: [] }],
    activities: [act("A1", "PA", 0, "2026-01-05", "2026-01-10"), act("B1", "PB", 0, "2026-01-01", "2026-01-03")],
    crossDeps: [{ from: "PA", fromStage: 0, to: "PB", toStage: 0, type: "FS", lag }],
  });

  test("Mon–Fri feeding every-day: B starts on A's Saturday", () => {
    const ps = programmeSchedule(mixed(0, "MF", "ALL"), "PG");
    assert.deepEqual([ps.result.dates.A1.es, ps.result.dates.A1.ef], ["2026-01-05", "2026-01-10"]);
    assert.deepEqual([ps.result.dates.B1.es, ps.result.dates.B1.ef], ["2026-01-10", "2026-01-12"]);
    assert.equal(ps.finish, "2026-01-12");
    assert.deepEqual([ps.result.float.A1, ps.result.float.B1], [0, 0], "both on the chain, in their own days");
  });

  test("the lag counts in the successor's working days: FS+2 → Mon 12 Jan", () => {
    const ps = programmeSchedule(mixed(2, "MF", "ALL"), "PG");
    assert.equal(ps.result.dates.B1.es, "2026-01-12");
    assert.equal(ps.finish, "2026-01-14");
  });

  test("every-day feeding Mon–Fri: A works Saturday, B starts the Monday after, and A owns the Sunday", () => {
    /* A1 (every day) 6 days: works Mon 5 … Sat 10, finish index Sun 11.
       B (Mon–Fri) starts the next of ITS working days: Mon 12 Jan, 2 days
       → Mon, Tue, finish index Wed 14 Jan. Backward: B1 must start Mon 12,
       so A1 may finish as late as the day B still reads as Monday's start
       — through Sunday, which A works: A1 has 1 day of float, B1 none. */
    const db = mixed(0, "ALL", "MF");
    db.activities[0].end = "2026-01-11";
    const ps = programmeSchedule(db, "PG");
    assert.equal(ps.result.dates.B1.es, "2026-01-12");
    assert.equal(ps.result.dates.B1.ef, "2026-01-14");
    assert.deepEqual([ps.result.float.A1, ps.result.float.B1], [1, 0]);
    assert.deepEqual(ps.chain.map((c) => c.id), ["B1"], "A1 does not drive: B waits for its own Monday");
  });
});

/* ── 3 · authority, both sides ────────────────────────────────────── */

describe("FX-15 · a link binds two plans: rbac asks both sides", () => {
  const siteGRU = { id: 9, role: "site", active: true, grants: [{ scope_kind: "site", site_id: "GRU", power: "write" }] };
  const mine = { id: "PRJ-136", programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  const theirs = { id: "PRJ-101", programme_id: "CBP", site_id: "KRK", governance_level: "group" };

  test("a site lead cannot bind another project, whichever end it is — and the refusal names it", () => {
    for (const [from, to] of [[mine, theirs], [theirs, mine]]) {
      const v = can(siteGRU, "crossdep.write", { from, to });
      assert.equal(v.ok, false);
      assert.match(v.why, /PRJ-101/);
      assert.match(v.why, /both projects/);
    }
    assert.equal(can(siteGRU, "schedule.write", { project: mine }).ok, true, "while planning its own is allowed");
  });

  test("both ends writable: allowed; an end missing: refused", () => {
    const other = { ...mine, id: "PRJ-199" };
    assert.equal(can(siteGRU, "crossdep.write", { from: mine, to: other }).ok, true);
    assert.equal(can(siteGRU, "crossdep.write", { from: mine }).ok, false);
  });
});

/* ── 4 · the routes ───────────────────────────────────────────────── */

describe("FX-15 · typed links through the audited routes", () => {
  let id;
  test("create SS+3 between two projects; the book carries type, lag, version and the id to edit it by", async () => {
    const admin = await as("admin");
    const made = await admin.post("/api/crossdeps", {
      from: GROUP_PROJECT, fromStage: 1, to: SITE_PROJECT_GRU, toStage: 0,
      type: "SS", lag: 3, label: "FX-15 probe",
    });
    assert.equal(made.status, 201, made.text);
    id = made.body.id;
    const link = (await book(admin)).crossDeps.find((d) => d.label === "FX-15 probe");
    assert.deepEqual([link.id, link.type, link.lag, link.version], [id, "SS", 3, 1]);
    const audit = await one(`SELECT detail FROM audit_event WHERE action = 'Cross-project dependency added' ORDER BY id DESC LIMIT 1`);
    assert.match(audit.detail, /SS\+3d/);
  });

  test("a type that is not one is refused, not coerced", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/crossdeps", { from: GROUP_PROJECT, fromStage: 2, to: SITE_PROJECT_GRU, toStage: 0, type: "XX" });
    assert.equal(r.status, 400);
    const l = await admin.post("/api/crossdeps", { from: GROUP_PROJECT, fromStage: 2, to: SITE_PROJECT_GRU, toStage: 0, lag: 1.5 });
    assert.equal(l.status, 400);
  });

  test("edit under the version read: FF−2; a stale version is 409; no version is 428", async () => {
    const admin = await as("admin");
    const ok = await admin.patch("/api/crossdeps/" + id, { type: "FF", lag: -2, version: 1 });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.version, 2);
    const row = await one(`SELECT type, lag_days, row_version FROM cross_dep WHERE id = $1`, [id]);
    assert.deepEqual([row.type, row.lag_days, row.row_version], ["FF", -2, 2]);
    assert.equal((await admin.patch("/api/crossdeps/" + id, { lag: 5, version: 1 })).status, 409);
    assert.equal((await admin.patch("/api/crossdeps/" + id, { lag: 5 })).status, 428);
  });

  test("a site lead of one side cannot edit, add or remove a link to the other — 403, naming it", async () => {
    const gru = await as("siteGRU");
    const edit = await gru.patch("/api/crossdeps/" + id, { lag: 0, version: 2 });
    assert.equal(edit.status, 403);
    assert.match(edit.body.error, new RegExp(GROUP_PROJECT));
    const add = await gru.post("/api/crossdeps", { from: SITE_PROJECT_GRU, fromStage: 0, to: GROUP_PROJECT, toStage: 3, type: "SS" });
    assert.equal(add.status, 403);
    assert.match(add.body.error, new RegExp(GROUP_PROJECT));
    assert.equal((await gru.del("/api/crossdeps/" + id)).status, 403);
    const still = await one(`SELECT type, lag_days FROM cross_dep WHERE id = $1`, [id]);
    assert.deepEqual([still.type, still.lag_days], ["FF", -2], "nothing moved");
  });

  test("the export carries the type and the lag; a merge of it moves no version", async () => {
    const admin = await as("admin");
    const exported = (await admin.get("/api/admin/export")).body;
    const link = exported.crossDeps.find((d) => d.label === "FX-15 probe");
    assert.deepEqual([link.type, link.lag, "id" in link], ["FF", -2, false]);
    const r = await admin.post("/api/admin/import?mode=merge", { db: exported });
    assert.equal(r.status, 200, r.text);
    const rows = await many(`SELECT type, lag_days, row_version FROM cross_dep WHERE label = 'FX-15 probe'`);
    assert.deepEqual(rows.map((x) => [x.type, x.lag_days, x.row_version]), [["FF", -2, 2]]);
  });

  test("the database refuses an unknown type even where no route checks", async () => {
    await assert.rejects(() => one(`UPDATE cross_dep SET type = 'XS' WHERE id = $1`, [id]), /cross_dep_type_known|check/i);
  });
});

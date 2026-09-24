/**
 * FX-01…FX-04 (docs/41, wave A1) — the schedule engine, and D-41.01.
 *
 * Two halves.
 *
 *   1. D-41.01 — the demonstration book, exported, run through the 5.28.0
 *      engine (a byte copy of shared/engine.js at 7f3dd7a, frozen in
 *      fixtures/) and through today's: `metrics` for every project,
 *      `roll` over all of them and `criticalPath` for every project must
 *      be deep-equal. No link type, lag, calendar, constraint, actual or
 *      status date is set in the seed, so this is exactly the claim "a
 *      book that uses none of it reads as it did".
 *
 *   2. Worked examples, computed by hand in the comments BEFORE the
 *      assertion — a specification, not a snapshot of what the code
 *      happened to print.
 *
 * Index convention (shared/schedule.js): day 0 is the earliest planned
 * start; a duration is end − start; with a calendar both count working
 * days.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client } from "./harness.js";
import { Engine } from "../../shared/engine.js";
import { Engine as Engine528 } from "./fixtures/engine-5.28.0.js";
import { schedule, clock, linksOf, workdaysBetween } from "../../shared/schedule.js";

before(async () => { await boot(); });
after(shutdown);

/* ── 1 · D-41.01 on the whole demonstration book ─────────────────── */

describe("D-41.01 · the seeded book computes exactly as 5.28.0 did", () => {
  let book;
  before(async () => {
    const admin = await as("admin");
    book = (await admin.get("/api/admin/export")).body;
  });

  const copy = () => JSON.parse(JSON.stringify(book));
  const KEPT = ["critical", "float", "projEnd", "es", "ef", "ls", "lf"];
  const kept = (cp) => Object.fromEntries(KEPT.map((k) => [k, cp[k]]));

  test("the book has projects, stages and links to compare", () => {
    assert.ok(book.projects.length >= 10);
    assert.ok(book.activities.length >= 40);
    assert.ok(book.activities.some((a) => a.deps.length), "some stages have predecessors");
    // and none of the new fields is set — the claim is about a book that uses none of them
    assert.ok(book.activities.every((a) => a.links.every((l) => l.type === "FS" && l.lag === 0)));
    assert.ok(book.projects.every((p) => p.calendar === null && p.statusDate === null));
    assert.deepEqual(book.calendars, []);
  });

  test("Engine.metrics — every project, deep-equal", () => {
    const before = copy(), now = copy();
    for (const p of book.projects) {
      assert.deepEqual(Engine.metrics(now, p.id), Engine528.metrics(before, p.id), p.id);
    }
  });

  test("Engine.roll — the whole portfolio, deep-equal", () => {
    const before = copy(), now = copy();
    assert.deepEqual(Engine.roll(now, now.projects), Engine528.roll(before, before.projects));
  });

  test("Engine.criticalPath — every project, deep-equal on every 5.28.0 key", () => {
    const before = copy(), now = copy();
    let compared = 0;
    for (const p of book.projects) {
      const was = Engine528.criticalPath(before, p.id);
      const is = Engine.criticalPath(now, p.id);
      assert.deepEqual(kept(is), was, p.id);
      // the additions say "nothing is wrong" on a book that sets nothing
      assert.deepEqual(is.negative, [], p.id);
      assert.equal(is.calendar, null, p.id);
      compared += Object.keys(was.es).length;
    }
    assert.ok(compared >= 40, "every stage of the book was compared");
  });

  test("the attention list and the dependency breaches are unchanged too", () => {
    const before = copy(), now = copy();
    assert.deepEqual(Engine.decisions(now, now.projects), Engine528.decisions(before, before.projects));
    for (const p of book.projects) {
      const strip = (list) => list.map((b) => [b.activity.id, b.predecessor.id, b.overlap, b.agreed]);
      assert.deepEqual(strip(Engine.depBreaches(now, p.id)), strip(Engine528.depBreaches(before, p.id)), p.id);
    }
  });
});

/* ── 2 · worked examples ─────────────────────────────────────────── */

/* A starts Monday 5 Jan 2026 and lasts 5 days (end 10 Jan). B lasts 3. */
const A = (over = {}) => ({ id: "A", start: "2026-01-05", end: "2026-01-10", deps: [], ...over });
const B = (link, over = {}) => ({ id: "B", start: "2026-01-12", end: "2026-01-15",
  deps: link ? ["A"] : [], links: link ? [{ pred: "A", ...link }] : [], ...over });

describe("FX-01 · four link types, lag and lead", () => {
  test("FS+0 — B starts when A finishes: B.es = 5, B.ef = 8", () => {
    const r = schedule([A(), B({ type: "FS", lag: 0 })]);
    assert.equal(r.es.B, 5); assert.equal(r.ef.B, 8);
    assert.equal(r.projEnd, 8);
    assert.deepEqual([...r.critical].sort(), ["A", "B"]);
  });

  test("FS+3 — three days of lag: B.es = 5 + 3 = 8", () => {
    const r = schedule([A(), B({ type: "FS", lag: 3 })]);
    assert.equal(r.es.B, 8); assert.equal(r.ef.B, 11);
    assert.equal(r.float.A, 0, "the lag is on the path");
  });

  test("FS−2 — a two-day lead: B.es = 5 − 2 = 3", () => {
    const r = schedule([A(), B({ type: "FS", lag: -2 })]);
    assert.equal(r.es.B, 3); assert.equal(r.ef.B, 6);
  });

  test("SS+2 — B starts two days after A starts: B.es = 0 + 2 = 2", () => {
    /* projEnd = max(A.ef 5, B.ef 5) = 5. Backward: B.lf = 5, B.ls = 2;
       A.lf = min(B.ls − 2 + 5, projEnd) = 5 → A.ls 0. Both float 0. */
    const r = schedule([A(), B({ type: "SS", lag: 2 })]);
    assert.equal(r.es.B, 2); assert.equal(r.ef.B, 5);
    assert.equal(r.float.A, 0); assert.equal(r.float.B, 0);
  });

  test("FF+1 — B finishes a day after A finishes: B.ef = 6, so B.es = 3", () => {
    const r = schedule([A(), B({ type: "FF", lag: 1 })]);
    assert.equal(r.ef.B, 6); assert.equal(r.es.B, 3);
    assert.equal(r.lf.A, 5, "A.lf = B.lf − 1 = 5");
  });

  test("SF+4 — B finishes four days after A starts: B.ef = 4, B.es = 1; A still bounds the end", () => {
    /* projEnd = A.ef = 5. B.lf = 5, float 1. A.lf = min(B.lf − 4 + 5 = 6,
       projEnd 5) = 5: an SS/SF predecessor is bounded by the project end
       too, or A would carry float that moves the finish. */
    const r = schedule([A(), B({ type: "SF", lag: 4 })]);
    assert.equal(r.es.B, 1); assert.equal(r.ef.B, 4);
    assert.equal(r.float.B, 1); assert.equal(r.float.A, 0);
  });

  test("links default to FS/0, and `deps` stays the list of predecessors", () => {
    assert.deepEqual(linksOf({ deps: ["X", "Y"], links: [{ pred: "Y", type: "SS", lag: 2 }] }),
      [{ pred: "X", type: "FS", lag: 0 }, { pred: "Y", type: "SS", lag: 2 }]);
    const db = { activities: [{ id: "Z", project: "P", start: "2026-01-01", end: "2026-01-02", deps: [] }] };
    const [z] = Engine.activities(db, "P");
    assert.deepEqual(z.links, []);
    assert.equal(z.constraint, null); assert.equal(z.deadline, null);
    assert.equal(z.actualStart, null); assert.equal(z.actualFinish, null); assert.equal(z.remaining, null);
  });
});

describe("FX-02 · working calendars", () => {
  /* Monday–Friday, with Wednesday 7 January a holiday. */
  const cal = { workdays: 62, holidays: [{ date: "2026-01-07", label: "Holiday" }] };

  test("a week with a weekend and a holiday counts four working days", () => {
    // Mon 5, Tue 6, (Wed 7 holiday), Thu 8, Fri 9 — Sat 10 and Sun 11 are not counted
    assert.equal(workdaysBetween("2026-01-05", "2026-01-12", cal), 4);
    assert.equal(workdaysBetween("2026-01-05", "2026-01-12", null), 7, "without a calendar, 7 calendar days");
  });

  test("durations and lags count working days, and dates land on working days", () => {
    /* A: Mon 5 → Mon 12, 4 working days. B: Mon 12 → Thu 15, 3 working
       days, FS+1. Indices: Mon5=0 Tue6=1 Thu8=2 Fri9=3 Mon12=4 Tue13=5
       Wed14=6 Thu15=7. B.es = 4 + 1 = 5 → Tuesday 13; B.ef = 8, i.e. the
       day after working day 7 (Thu 15) → Friday 16. */
    const r = schedule([A({ end: "2026-01-12" }), B({ type: "FS", lag: 1 })], { calendar: cal });
    assert.equal(r.ef.A, 4);
    assert.equal(r.es.B, 5); assert.equal(r.ef.B, 8);
    assert.equal(r.dates.B.es, "2026-01-13");
    assert.equal(r.dates.B.ef, "2026-01-16");
    assert.equal(r.dates.A.ef, "2026-01-10", "A's last working day is Friday 9: it is finished by Saturday");
  });

  test("the clock is monotone and round-trips its own indices", () => {
    const c = clock("2026-01-05", cal);
    for (let n = -20; n < 40; n++) {
      assert.equal(c.idx(c.startOf(n)), n, "startOf " + n);
      assert.equal(c.idx(c.finishOf(n)), n, "finishOf " + n);
      const d = new Date(c.startOf(n) + "T00:00:00Z").getUTCDay();
      assert.ok(d !== 0 && d !== 6 && c.startOf(n) !== "2026-01-07", "a start is a working day");
    }
  });

  test("a project inherits its site's calendar, then the group default, and says which", () => {
    const db = {
      calendars: [{ id: "CAL-A", name: "Site", workdays: 62, holidays: [] },
                  { id: "CAL-G", name: "Group", workdays: 127, holidays: [], isDefault: true }],
      sites: [{ id: "S1", calendar: "CAL-A" }, { id: "S2", calendar: null }],
      projects: [{ id: "P1", site: "S1", calendar: null }, { id: "P2", site: "S2", calendar: null },
                 { id: "P3", site: "S1", calendar: "CAL-G" }],
      activities: [],
    };
    assert.equal(Engine.calendarFor(db, db.projects[0]).id, "CAL-A");
    assert.equal(Engine.calendarFor(db, db.projects[1]).id, "CAL-G");
    assert.equal(Engine.calendarFor(db, db.projects[2]).id, "CAL-G");
    assert.equal(Engine.criticalPath(db, "P1").calendar, "CAL-A");
    assert.equal(Engine.calendarFor({ ...db, calendars: [] }, db.projects[0]), null, "no calendar: calendar days");
  });
});

describe("FX-03 · constraints and deadlines", () => {
  /* A (5d, from day 0) → B (3d) FS. Without constraint B.es = 5, ef = 8.
     Day n is 5 Jan + n. */
  const run = (constraint, over = {}) =>
    schedule([A(), B({ type: "FS", lag: 0 }, { constraint, ...over })]);

  test("SNET 12 Jan (day 7) pushes B's early start to 7", () => {
    const r = run({ type: "SNET", date: "2026-01-12" });
    assert.equal(r.es.B, 7); assert.equal(r.ef.B, 10);
  });

  test("SNLT 7 Jan (day 2) leaves the early dates and shows −3 days of float on the chain", () => {
    /* B.lf = min(8, 2 + 3) = 5, B.ls = 2, float 2 − 5 = −3; A.lf = B.ls = 2, float −3. */
    const r = run({ type: "SNLT", date: "2026-01-07" });
    assert.equal(r.es.B, 5, "the early start is not rewritten");
    assert.equal(r.float.B, -3); assert.equal(r.float.A, -3);
    assert.deepEqual(r.negative.sort(), ["A", "B"]);
  });

  test("FNET 20 Jan (day 15): B.es = 15 − 3 = 12", () => {
    const r = run({ type: "FNET", date: "2026-01-20" });
    assert.equal(r.es.B, 12); assert.equal(r.ef.B, 15);
  });

  test("FNLT 11 Jan (day 6): B.lf = 6, float 3 − 5 = −2", () => {
    const r = run({ type: "FNLT", date: "2026-01-11" });
    assert.equal(r.lf.B, 6); assert.equal(r.float.B, -2);
  });

  test("MSO 15 Jan (day 10) fixes B's start; MSO before its predecessor ends puts the negative float on A", () => {
    const late = run({ type: "MSO", date: "2026-01-15" });
    assert.equal(late.es.B, 10); assert.equal(late.float.B, 0);
    /* MSO 7 Jan (day 2): B.es = 2, ef = 5 = projEnd. B.ls = 2 → A.lf = 2, A.ls = −3: float −3. */
    const early = run({ type: "MSO", date: "2026-01-07" });
    assert.equal(early.es.B, 2); assert.equal(early.float.B, 0); assert.equal(early.float.A, -3);
    assert.deepEqual(early.negative, ["A"]);
  });

  test("MFO 20 Jan (day 15): B.ef = 15, B.es = 12", () => {
    const r = run({ type: "MFO", date: "2026-01-20" });
    assert.equal(r.ef.B, 15); assert.equal(r.es.B, 12); assert.equal(r.lf.B, 15);
  });

  test("a deadline of 9 Jan (day 4) on B is missed by 4 days: float −4, named in `missed`", () => {
    const r = run(null, { deadline: "2026-01-09" });
    assert.equal(r.es.B, 5, "a deadline never moves the early dates");
    assert.equal(r.float.B, -4);
    assert.deepEqual(r.missed, ["B"]);
  });

  test("a violated constraint reaches the attention list with the activity's name", () => {
    const db = {
      statusDate: "2026-01-05", settings: { capacityAlerts: false },
      projects: [{ id: "P", name: "Pilot", site: "S" }], sites: [{ id: "S" }],
      activities: [
        { id: "A", project: "P", name: "Pour", start: "2026-01-05", end: "2026-01-10", deps: [] },
        { id: "B", project: "P", name: "Cure", start: "2026-01-12", end: "2026-01-15", deps: ["A"],
          deadline: "2026-01-09" }],
      crs: [], raid: [], milestones: [], docs: [], findings: [], objections: [],
    };
    const d = Engine.decisions(db, db.projects).find((x) => x.kind === "Schedule");
    assert.ok(d, "a Schedule item");
    assert.match(d.title, /Cure/);
    assert.match(d.meta, /1 deadline\(s\) missed/);
  });
});

describe("FX-04 · free float, actuals and the status date", () => {
  test("free float: B can slip 0 days without moving D, but 3 in total", () => {
    /* A 5d and B 2d from day 0; C 3d after A and B; D 1d after B only.
       C.es = 5, projEnd = 8. D.es = 2, D.ef = 3, D float = free float = 5.
       B.lf = min(C.ls 5, D.ls 7) = 5 → total float 3; free float
       = min(C.es − B.ef = 3, D.es − B.ef = 0) = 0. */
    const r = schedule([
      { id: "A", start: "2026-01-05", end: "2026-01-10", deps: [] },
      { id: "B", start: "2026-01-05", end: "2026-01-07", deps: [] },
      { id: "C", start: "2026-01-10", end: "2026-01-13", deps: ["A", "B"] },
      { id: "D", start: "2026-01-07", end: "2026-01-08", deps: ["B"] },
    ]);
    assert.equal(r.float.B, 3); assert.equal(r.freeFloat.B, 0);
    assert.equal(r.float.D, 5); assert.equal(r.freeFloat.D, 5);
    assert.equal(r.freeFloat.A, 0);
  });

  test("an activity finished early releases its successor from the status date, not from the plan", () => {
    /* Status 12 Jan = day 7. A actually ran 5 → 9 Jan (day 4). B has not
       started: it cannot start before the status date, so B.es = 7; it
       was planned to start on 9 Jan, before the status date, so it is late. */
    const r = schedule([
      A({ actualStart: "2026-01-05", actualFinish: "2026-01-09" }),
      B({ type: "FS", lag: 0 }, { start: "2026-01-09", end: "2026-01-12" }),
    ], { statusDate: "2026-01-12" });
    assert.equal(r.ef.A, 4);
    assert.equal(r.es.B, 7); assert.equal(r.ef.B, 10);
    assert.deepEqual(r.late, ["B"]);
    assert.ok(!r.critical.has("A"), "a finished activity is not on the path any more");
  });

  test("an activity in progress finishes `remaining` days after the status date", () => {
    // B started 9 Jan (day 4), 2 days remain at the status date (day 7): ef = 7 + 2 = 9
    const r = schedule([
      A({ actualStart: "2026-01-05", actualFinish: "2026-01-09" }),
      B({ type: "FS", lag: 0 }, { actualStart: "2026-01-09", remaining: 2 }),
    ], { statusDate: "2026-01-12" });
    assert.equal(r.es.B, 4); assert.equal(r.ef.B, 9);
  });

  test("no status date: nothing is clamped, nothing is late", () => {
    const r = schedule([A(), B({ type: "FS", lag: 0 }, { start: "2026-01-01" })]);
    assert.deepEqual(r.late, []);
  });

  /* engine.test.js's fixture: two halves of 2026, weight .5 each, BAC 100. */
  const evm = (statusDate) => ({
    statusDate: "2026-07-01",
    settings: { autoRag: true, amberSpi: .95, redSpi: .9, amberCpi: .95, redCpi: .9 },
    projects: [{ id: "X", start: "2026-01-01", finish: "2026-12-31", budget: 100,
      contingency: 0, contingencyUsed: 0, statusDate }],
    activities: [
      { id: "A1", project: "X", start: "2026-01-01", end: "2026-06-30", baseStart: "2026-01-01",
        baseEnd: "2026-06-30", weight: .5, pct: 100, deps: [] },
      { id: "A2", project: "X", start: "2026-07-01", end: "2026-12-31", baseStart: "2026-07-01",
        baseEnd: "2026-12-31", weight: .5, pct: 0, deps: ["A1"] }],
    ledger: [{ project: "X", amount: 50 }],
  });

  test("EVM at the project's status date: PV = 50 + 50 × 92/183 on 1 October", () => {
    /* A2 is planned 1 Jul → 31 Dec, 183 days; 1 Oct is 92 days in. */
    const m = Engine.metrics(evm("2026-10-01"), "X");
    assert.equal(m.ev, 50);
    assert.ok(Math.abs(m.pv - (50 + 50 * 92 / 183)) < 1e-9, String(m.pv));
  });

  test("…and without one, the portfolio date exactly as before (PV = 50)", () => {
    const now = Engine.metrics(evm(null), "X");
    const was = Engine528.metrics(evm(null), "X");
    assert.equal(now.pv, 50);
    assert.deepEqual(now, was);
  });
});

/* ── 3 · the routes: rbac, audit, version, refusals ───────────────── */

describe("FX-01…FX-04 · written through the routes", () => {
  let pmo, db, acts;
  const P = "PRJ-101";
  before(async () => {
    pmo = await as("pmo");
    db = (await pmo.get("/api/bootstrap")).body.db;
    acts = db.activities.filter((a) => a.project === P).sort((a, b) => a.stage - b.stage);
  });
  const fresh = async () => (await pmo.get("/api/bootstrap")).body.db;
  const act = (d, id) => d.activities.find((a) => a.id === id);

  test("a typed link with lag replaces the predecessor list, bumps the version and is audited", async () => {
    const [a1, a2] = acts;
    const r = await pmo.patch("/api/activities/" + a2.id,
      { links: [{ pred: a1.id, type: "SS", lag: 3 }], version: a2.version });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.version, a2.version + 1);
    const d = await fresh();
    assert.deepEqual(act(d, a2.id).links, [{ pred: a1.id, type: "SS", lag: 3 }]);
    assert.deepEqual(act(d, a2.id).deps, [a1.id], "deps is still the list of predecessors");
    // SS+3: A2 starts three days after A1 starts
    const cp = Engine.criticalPath(d, P);
    assert.equal(cp.es[a2.id], cp.es[a1.id] + 3);
    const audit = (await pmo.get("/api/audit?entity=activity&entityId=" + a2.id)).body;
    const rows = audit.rows ?? audit.events ?? audit;
    assert.ok(JSON.stringify(rows).includes("SS+3d"), "the audit line names the typed link");
    const stale = await pmo.patch("/api/activities/" + a2.id, { links: [], version: a2.version });
    assert.equal(stale.status, 409, "a stale version is refused");
  });

  test("a link that closes a loop, a foreign stage or an unknown type is refused, nothing written", async () => {
    const d = await fresh();
    const [a1, a2] = [act(d, acts[0].id), act(d, acts[1].id)];
    const loop = await pmo.patch("/api/activities/" + a1.id, { links: [{ pred: a2.id }], version: a1.version });
    assert.equal(loop.status, 400); assert.match(loop.body.error, /loop/);
    const foreign = d.activities.find((a) => a.project !== P);
    const other = await pmo.patch("/api/activities/" + a1.id, { links: [{ pred: foreign.id }], version: a1.version });
    assert.equal(other.status, 400);
    const type = await pmo.patch("/api/activities/" + a1.id, { links: [{ pred: acts[2].id, type: "XX" }], version: a1.version });
    assert.equal(type.status, 400);
    assert.equal(act(await fresh(), a1.id).version, a1.version, "no refusal moved the version");
  });

  test("constraint, deadline, actuals and remaining — and the refusals that keep them honest", async () => {
    const a3 = act(await fresh(), acts[2].id);
    const noDate = await pmo.patch("/api/activities/" + a3.id, { constraintType: "FNLT", version: a3.version });
    assert.equal(noDate.status, 400);
    const noStart = await pmo.patch("/api/activities/" + a3.id, { actualFinish: "2026-03-01", version: a3.version });
    assert.equal(noStart.status, 400);
    const ok = await pmo.patch("/api/activities/" + a3.id, {
      constraintType: "FNLT", constraintDate: "2026-02-01", deadline: "2026-02-15",
      actualStart: a3.start, remaining: 12, version: a3.version });
    assert.equal(ok.status, 200, ok.text);
    const b = act(await fresh(), a3.id);
    assert.deepEqual(b.constraint, { type: "FNLT", date: "2026-02-01" });
    assert.equal(b.deadline, "2026-02-15"); assert.equal(b.actualStart, a3.start); assert.equal(b.remaining, 12);
  });

  test("calendar.manage: group creates, a site lead is refused, a calendar in use cannot be removed", async () => {
    const site = await as("siteGRU");
    const refused = await site.post("/api/calendars", { name: "Site try" });
    assert.equal(refused.status, 403);
    const made = await pmo.post("/api/calendars", { name: "Krakow office", workdays: 62,
      holidays: [{ date: "2026-12-25", label: "Christmas" }, { date: "2026-12-26", label: "St Stephen" }] });
    assert.equal(made.status, 201, made.text);
    const id = made.body.id;
    let d = await fresh();
    const cal = d.calendars.find((c) => c.id === id);
    assert.equal(cal.workdays, 62); assert.equal(cal.holidays.length, 2);
    const p = d.projects.find((x) => x.id === P);
    const set = await pmo.patch("/api/projects/" + P, { calendar: id, statusDate: "2026-08-28", version: p.version });
    assert.equal(set.status, 200, set.text);
    d = await fresh();
    assert.equal(Engine.criticalPath(d, P).calendar, id);
    assert.equal(d.projects.find((x) => x.id === P).statusDate, "2026-08-28");
    const inUse = await pmo.del("/api/calendars/" + id);
    assert.equal(inUse.status, 409); assert.match(inUse.body.error, new RegExp(P));
    const upd = await pmo.patch("/api/calendars/" + id, { holidays: [], version: cal.version });
    assert.equal(upd.status, 200, upd.text);
    const back = d.projects.find((x) => x.id === P);
    await pmo.patch("/api/projects/" + P, { calendar: null, statusDate: null, version: back.version });
    const gone = await pmo.del("/api/calendars/" + id);
    assert.equal(gone.status, 200, gone.text);
    const bad = await pmo.patch("/api/projects/" + P, { calendar: "CAL-NOPE", version: back.version + 1 });
    assert.equal(bad.status, 400);
  });

  test("/api/v1 · a scheduler reports actuals and typed links under its own id", async () => {
    const admin = await as("admin");
    const key = (await admin.post("/api/admin/integrations",
      { name: "P6 bridge", scopes: "read:portfolio,write:portfolio", purpose: "test" })).body.key;
    const c = client();
    const put = (path, body) => c.put(path, body, { "X-API-Key": key });
    const [a1, , , a4] = acts;
    assert.equal((await put("/api/v1/activities/P6-4", { activity: a4.id })).status, 201, "bound");
    const r = await put("/api/v1/activities/P6-4", { actualStart: a4.start, links: [{ pred: a1.id, type: "FF", lag: -2 }] });
    assert.equal(r.status, 200, r.text);
    const b = act(await fresh(), a4.id);
    assert.equal(b.actualStart, a4.start);
    assert.deepEqual(b.links, [{ pred: a1.id, type: "FF", lag: -2 }]);
    const unknown = await put("/api/v1/activities/P6-4", { lagDays: 3 });
    assert.equal(unknown.status, 400, "a field the contract does not declare is refused");
  });

  /* FitAdapt DF-13 (field return on 5.36.0): the call that BINDS an
     external id to a stage answered 201 and silently dropped everything
     but `pct` — actual start and finish, remaining, links, name. The early
     return predated FX-04; the same body sent a second time was then
     applied, so a sync's first run wrote nothing of what it was given and
     its second run wrote it all. */
  test("/api/v1 · the call that binds a stage also records what it carries (DF-13), and a re-send writes nothing (DF-14)", async () => {
    const admin = await as("admin");
    const key = (await admin.post("/api/admin/integrations",
      { name: "Repo sync", scopes: "read:portfolio,write:portfolio", purpose: "test" })).body.key;
    const c = client();
    const put = (path, body) => c.put(path, body, { "X-API-Key": key });
    const a2 = acts[1];
    const body = { activity: a2.id, actualStart: a2.start, remaining: 3, name: a2.name + " (tracked)" };
    const first = await put("/api/v1/activities/REPO-2", body);
    assert.equal(first.status, 201, first.text);
    assert.equal(first.body.created, true);
    const b = act(await fresh(), a2.id);
    assert.equal(b.actualStart, a2.start, "the actual start sent with the binding is recorded");
    assert.equal(b.remaining, 3, "and the remaining days");
    assert.equal(b.name, a2.name + " (tracked)", "and the name");
    /* DF-14 — the same body again is the same report: nothing moves. It
       used to write a new version and a "Stage updated" row every time. */
    const again = await put("/api/v1/activities/REPO-2", body);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.body.created, false);
    assert.equal(act(await fresh(), a2.id).version, b.version, "an unchanged re-send writes nothing");
    // a measurement with its own time is the same measurement when re-sent …
    const m = { pct: 40, source: "repo", measuredAt: "2026-03-05T10:00:00.000Z" };
    const r1 = await put("/api/v1/activities/REPO-2", m);
    assert.equal(r1.status, 200, r1.text);
    const r2 = await put("/api/v1/activities/REPO-2", m);
    assert.equal(r2.body.version, r1.body.version, "the same figure, source and time is the same report");
    // … but a figure re-sent without a time is a new measurement, taken now
    const r3 = await put("/api/v1/activities/REPO-2", { pct: 40, source: "repo" });
    assert.ok(r3.body.version > r2.body.version, "no measuredAt: measured again, now");
    // binding alone still answers created and changes nothing but the link
    const a3 = act(await fresh(), acts[2].id);
    const bare = await put("/api/v1/activities/REPO-3", { activity: a3.id });
    assert.equal(bare.status, 201, bare.text);
    const a3after = act(await fresh(), a3.id);
    assert.equal(a3after.actualStart, a3.actualStart);
    assert.equal(a3after.name, a3.name);
  });
});

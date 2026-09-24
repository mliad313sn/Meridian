/**
 * FX-08 bis — resource work, weekly load, planned cost and the leveler
 * count WORKING days when the activity's project has a working calendar
 * (FX-02, resolved as the CPM resolves it: project → site → group default
 * → none).
 *
 * The pure half is hand-worked on one calendar: Monday to Friday, with
 * Monday 6 July 2026 a holiday. The weeks on screen start Mon 29 Jun and
 * Mon 6 Jul:
 *
 *        Jun 29 30 | Jul 1  2  3  4  5 | 6  7  8  9 10 11 12 | 13
 *            Mo Tu |     We Th Fr Sa Su| Mo Tu We Th Fr Sa Su| Mo
 *   working  ✓  ✓  |     ✓  ✓  ✓  ·  · | H  ✓  ✓  ✓  ✓  ·  · | ✓
 *
 * so the week of 29 Jun holds 5 working days and the week of 6 Jul 4.
 *
 * The book half is D-41.01: the seeded book has no calendar, and on it
 * (enriched in memory with assignments and rates, so the proof is not
 * vacuous) every figure equals the one the frozen 5.36.0 module computes
 * (fixtures/resources-5.36.0.js, `git show 0687333:shared/resources.js`).
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown } from "./harness.js";
import { loadPortfolio } from "../src/portfolio.js";
import { Engine } from "../../shared/engine.js";
import * as Live from "../../shared/resources.js";
import * as Frozen from "./fixtures/resources-5.36.0.js";

const {
  workingDuration, assignmentWork, calendarOf, resourceLoad, overallocations,
  plannedCost, costCurve, forecasts, proposeLeveling,
} = Live;

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} ≠ ${b}`);

const CAL = { id: "CAL-MF", name: "Mon–Fri, 6 Jul off", workdays: 62, holidays: ["2026-07-06"], isDefault: false };

function book(over = {}) {
  return {
    statusDate: "2026-07-01",
    settings: { autoRag: true, amberSpi: 0.95, redSpi: 0.9, amberCpi: 0.95, redCpi: 0.9, capacityCeiling: 100 },
    sites: [{ id: "S1", city: "Here" }],
    people: [], projects: [], activities: [], allocations: [], absences: [],
    assignments: [], rates: [], ledger: [], milestones: [], calendars: [CAL],
    ...over,
  };
}
const project = (id, extra = {}) => ({ id, name: "Project " + id, site: "S1", start: "2026-06-01",
  finish: "2026-12-31", budget: 1, contingency: 0, contingencyUsed: 0, rank: null, calendar: CAL.id, ...extra });
const activity = (id, projectId, start, end, extra = {}) => ({ id, project: projectId, name: id,
  stage: 0, start, end, baseStart: start, baseEnd: end, weight: 1, pct: 0, deps: [], origin: "local",
  version: 1, ...extra });
const P = { id: "P", name: "P. Full", role: "Fitter", site: "S1", availability: 100, rate: 800 };
const asg = (id, act, units, extra = {}) => ({ id, activity: act, person: "P", role: null, units, work: null, ...extra });
const demands = (db, weeks = 2) => resourceLoad(db, { weeks }).rows[0].cells.map((c) => c.demand);
const noCalendar = (db) => ({ ...db, calendars: [] });

describe("FX-08 bis · the calendar is the CPM's", () => {
  test("project, else site, else group default, else none — exactly Engine.calendarFor", () => {
    const G = { id: "CAL-G", name: "Group", workdays: 62, holidays: [], isDefault: true };
    const S = { id: "CAL-S", name: "Site", workdays: 126, holidays: [] };
    const db = book({
      calendars: [CAL, G, S],
      sites: [{ id: "S1", calendar: "CAL-S" }, { id: "S2", calendar: null }],
      projects: [project("OWN", { site: "S1" }), project("SITE", { site: "S1", calendar: null }),
        project("DEF", { site: "S2", calendar: null })],
    });
    for (const [pid, want] of [["OWN", "CAL-MF"], ["SITE", "CAL-S"], ["DEF", "CAL-G"]]) {
      const a = activity("A-" + pid, pid, "2026-06-29", "2026-07-04");
      assert.equal(calendarOf(db, a).id, want, pid);
      assert.equal(calendarOf(db, a), Engine.calendarFor(db, Engine.project(db, pid)), pid + " is the CPM's calendar");
    }
    const none = book({ calendars: [], projects: [project("X", { calendar: null })] });
    assert.equal(calendarOf(none, activity("A", "X", "2026-06-29", "2026-07-04")), null, "no calendar anywhere: calendar days");
  });
});

describe("FX-08 bis · a person-day lands only on a working day", () => {
  test("Fri 3 Jul → Tue 7 Jul: 4 calendar days, 1 working day (Sat, Sun off, Mon 6 Jul a holiday)", () => {
    const a = activity("A", "X", "2026-07-03", "2026-07-07");
    assert.equal(workingDuration(a.start, a.end), 4, "Fri, Sat, Sun, Mon — the 5.36.0 count");
    assert.equal(workingDuration(a.start, a.end, CAL), 1, "Friday only");
    assert.equal(workingDuration(a.start, a.end, { ...CAL, holidays: [] }), 2, "Friday and Monday without the holiday");

    const w = assignmentWork(asg("1", "A", 100), a, CAL);
    assert.equal(w.duration, 1); near(w.work, 1, "work at 100 %"); near(w.perDay, 1, "per working day");
    near(assignmentWork(asg("1", "A", 100), a).work, 4, "5.36.0 read 4 person-days");

    /* The weekly split. Week of 29 Jun: the Friday — 1 person-day of the
       week's 5 working days = 0.2 FTE. Week of 6 Jul: nothing (the
       holiday, and Tuesday is the end). 5.36.0 put 3/7 and 1/7 there. */
    const db = book({ people: [P], projects: [project("X")], activities: [a], assignments: [asg("1", "A", 100)] });
    const [w1, w2] = demands(db);
    near(w1, 1 / 5, "week of 29 Jun"); near(w2, 0, "week of 6 Jul");
    near(w1 * 5 + w2 * 4, 1, "the weeks hold the whole work, and no more");
    const [c1, c2] = demands(noCalendar(db));
    near(c1, 3 / 7, "5.36.0 week of 29 Jun"); near(c2, 1 / 7, "5.36.0 week of 6 Jul");
  });

  test("100 % over a full working week is 1.0 FTE, not 5/7", () => {
    const db = book({ people: [P], projects: [project("X")],
      activities: [activity("A", "X", "2026-06-29", "2026-07-04")], assignments: [asg("1", "A", 100)] });
    const [w1] = demands(db, 1);
    near(w1, 1, "five working days of five");
    near(demands(noCalendar(db), 1)[0], 5 / 7, "5.36.0: five days of seven");
  });
});

describe("FX-08 bis · over-allocation counted on working days", () => {
  test("a weekend spill that read as over in calendar days is gone — and the over lands in the week that works", () => {
    /* A: Mon 29 Jun → Sat 4 Jul, 100 %  (5 calendar days, 5 working).
       B: Sat 4 Jul → Sat 11 Jul, 150 %  (7 calendar days: Sat, Sun, Mon
          holiday, Tue–Fri → 4 working days; work 1.5 × 4 = 6, not 10.5).
         calendar days (5.36.0)   week 29 Jun  5/7 + 1.5 × 2/7 = 8/7 ≈ 1.143  OVER
                                  week 6 Jul   1.5 × 5/7 = 15/14 ≈ 1.071   OVER
         working days             week 29 Jun  5/5 + 0 = 1.0               at capacity, not over
                                  week 6 Jul   1.5 × 4/4 = 1.5              OVER */
    const db = book({ people: [P], projects: [project("X"), project("Y")],
      activities: [activity("A", "X", "2026-06-29", "2026-07-04"), activity("B", "Y", "2026-07-04", "2026-07-11")],
      assignments: [asg("1", "A", 100), asg("2", "B", 150)] });
    near(assignmentWork(db.assignments[1], db.activities[1], CAL).work, 6, "B's work");
    const cells = resourceLoad(db, { weeks: 2 }).rows[0].cells;
    near(cells[0].demand, 1, "week of 29 Jun"); assert.equal(cells[0].over, false);
    near(cells[1].demand, 1.5, "week of 6 Jul"); assert.equal(cells[1].over, true);
    const old = resourceLoad(noCalendar(db), { weeks: 2 }).rows[0].cells;
    near(old[0].demand, 8 / 7, "5.36.0 week of 29 Jun"); assert.equal(old[0].over, true);
    near(old[1].demand, 15 / 14, "5.36.0 week of 6 Jul"); assert.equal(old[1].over, true);
    assert.deepEqual(overallocations(db, { weeks: 2 }).map((o) => o.week), ["2026-07-06"]);
    assert.deepEqual(overallocations(noCalendar(db), { weeks: 2 }).map((o) => o.week), ["2026-06-29", "2026-07-06"]);
  });

  test("10 person-days typed over two weeks that hold 9 working days: over in both, invisible in calendar days", () => {
    /* Mon 29 Jun → Mon 13 Jul: 14 calendar days, 9 working (5 + 4, the
       holiday). 10/9 ≈ 1.111 FTE on each working day → both weeks over.
       In calendar days: 10/14 ≈ 0.714 a week — nobody is over. */
    const db = book({ people: [P], projects: [project("X")],
      activities: [activity("A", "X", "2026-06-29", "2026-07-13")], assignments: [asg("1", "A", 100, { work: 10 })] });
    const cells = resourceLoad(db, { weeks: 2 }).rows[0].cells;
    near(cells[0].demand, 10 / 9, "week of 29 Jun"); near(cells[1].demand, 10 / 9, "week of 6 Jul");
    assert.ok(cells.every((c) => c.over));
    const old = resourceLoad(noCalendar(db), { weeks: 2 }).rows[0].cells;
    near(old[0].demand, 10 / 14, "5.36.0"); assert.ok(old.every((c) => !c.over));
  });

  test("dated absences keep their meaning: the week's availability is still its share of seven days present", () => {
    const db = book({ people: [P], projects: [project("X")],
      activities: [activity("A", "X", "2026-06-29", "2026-07-04")], assignments: [asg("1", "A", 100)],
      absences: [{ id: "ABS", person: "P", from: "2026-06-29", to: "2026-06-30" }] });
    const c = resourceLoad(db, { weeks: 1 }).rows[0].cells[0];
    near(c.available, 5 / 7, "two days away, as before"); near(c.demand, 1, "the work is on working days");
    assert.equal(c.over, true);
  });
});

describe("FX-08 bis · planned cost on working days only", () => {
  test("Mon 29 Jun → Wed 8 Jul at 800 a day: 6 working days = 4 800, June 1 600 and July 3 200", () => {
    /* 9 calendar days: 29, 30 Jun; 1, 2, 3, 4, 5, 6, 7 Jul. Working: 29,
       30 Jun; 1, 2, 3, 7 Jul = 6 (the weekend and the holiday carry no
       work, so no cost). 5.36.0 priced 9 days: 7 200 (July 5 600). */
    const db = book({ people: [P], projects: [project("X")],
      activities: [activity("A", "X", "2026-06-29", "2026-07-08")], assignments: [asg("1", "A", 100)] });
    const pc = plannedCost(db, db.activities[0]);
    near(pc.cost, 0.0048, "planned cost, in millions"); assert.equal(pc.complete, true);
    near(pc.lines[0].work, 6, "work"); near(pc.lines[0].byMonth["2026-06"], 0.0016, "June");
    near(pc.lines[0].byMonth["2026-07"], 0.0032, "July");
    const old = plannedCost(noCalendar(db), db.activities[0]);
    near(old.cost, 0.0072, "5.36.0"); near(old.lines[0].byMonth["2026-07"], 0.0056, "5.36.0 July");

    const f = forecasts(db, "X");
    near(f.plannedCost, 0.0048, "the EAC reads the same figure"); near(f.etc, 0.0048, "nothing done: ETC = planned");
    const curve = costCurve(db, "X").months;
    near(curve.find((m) => m.period === "2026-06").planned, 0.0016, "S-curve June, cumulative");
    near(curve.find((m) => m.period === "2026-07").planned, 0.0048, "S-curve July, cumulative");
  });
});

describe("FX-08 bis · the leveler keeps working days", () => {
  const X1 = () => activity("X1", "X", "2026-06-29", "2026-07-04");
  const Y1 = () => activity("Y1", "Y", "2026-06-29", "2026-07-04");
  const two = (extra = []) => book({ people: [P], projects: [project("X", { rank: 1 }), project("Y", { rank: 2 })],
    activities: [X1(), Y1(), ...extra], assignments: [asg("1", "X1", 100), asg("2", "Y1", 100)] });

  test("the lower priority moves past the week — to the first working day, with its five working days kept", () => {
    /* Both at 100 % in the week of 29 Jun: 2.0 FTE. Y (rank 2) is delayed.
       Pushed 7 days it would start on Mon 6 Jul, the holiday: it starts
       Tue 7 Jul, and its 5 working days (7, 8, 9, 10, 13 Jul) end it on
       Tue 14 Jul. Its work stays 5 person-days. In calendar days (5.36.0)
       it goes to Mon 6 Jul → Sat 11 Jul — 4 working days on this calendar. */
    const db = two();
    const r = proposeLeveling(db, { weeks: 4 });
    assert.equal(r.before, 1); assert.equal(r.after, 0);
    assert.equal(r.moves.length, 1);
    const m = r.moves[0];
    assert.equal(m.activity, "Y1"); assert.equal(m.kind, "delay");
    assert.deepEqual(m.to, { start: "2026-07-07", end: "2026-07-14" });
    assert.equal(workingDuration(m.to.start, m.to.end, CAL), 5, "five working days, as before the move");
    near(assignmentWork(db.assignments[1], { ...db.activities[1], ...m.to }, CAL).work, 5, "the work does not change");
    assert.equal(r.effects[0].finishAfter, "2026-07-14");
    assert.deepEqual(db.activities[1].start, "2026-06-29", "D-41.02 — the book is not written");
    const old = proposeLeveling(noCalendar(db), { weeks: 4 }).moves[0];
    assert.deepEqual(old.to, { start: "2026-07-06", end: "2026-07-11" }, "5.36.0");
  });

  test("inside float, float is counted in working days — the unit the CPM gives it in", () => {
    /* Y0 (unassigned) runs Mon 29 Jun → Sat 1 Aug: 34 calendar days, 24
       working (5 weeks × 5, less the holiday). Y1 has 5, so its total float
       is 19 working days, and the move to Tue 7 Jul uses 5 of them (29 Jun
       → 7 Jul: 29, 30, 1, 2, 3 — the holiday is not a day of float). */
    const db = two([activity("Y0", "Y", "2026-06-29", "2026-08-01")]);
    assert.equal(Engine.criticalPath(db, "Y").float.Y1, 19);
    const r = proposeLeveling(db, { weeks: 4 });
    const m = r.moves.find((x) => x.activity === "Y1");
    assert.equal(m.kind, "float"); assert.match(m.reason, /19 d/);
    assert.deepEqual(m.to, { start: "2026-07-07", end: "2026-07-14" });
    assert.equal(r.effects[0].slipDays, 0, "inside float: the finish does not move");
  });
});

describe("FX-08 bis · an activity wholly on days off: no division by zero, a flag", () => {
  /* Sat 4 Jul → Tue 7 Jul: Saturday, Sunday and the Monday holiday — 3
     calendar days, 0 working. The CPM gives it one working day and puts it
     on Tue 7 Jul (schedule.js, Math.max(1, …)); the resource side does
     not invent that day: it counts 0, divides by nothing, and flags it. */
  const off = () => activity("OFF", "X", "2026-07-04", "2026-07-07");

  test("working duration 0 → computed work 0, per day 0 (not NaN, not Infinity), offCalendar", () => {
    const a = off();
    assert.equal(workingDuration(a.start, a.end, CAL), 0);
    const w = assignmentWork(asg("1", "OFF", 100), a, CAL);
    assert.deepEqual(w, { duration: 0, units: 100, computed: 0, work: 0, overridden: false, perDay: 0, offCalendar: true });
    const typed = assignmentWork(asg("1", "OFF", 100, { work: 2 }), a, CAL);
    assert.equal(typed.work, 2, "a typed work is kept"); assert.equal(typed.perDay, 0, "…but lands on no day");
    assert.equal(typed.offCalendar, true);
    assert.equal(assignmentWork(asg("1", "OFF", 100), a).offCalendar, undefined, "without a calendar: 3 days, no flag");
  });

  test("the load holds no NaN and names it; the cost refuses to price it; the bottom-up EAC says why", () => {
    const db = book({ people: [P], projects: [project("X")], activities: [off()],
      assignments: [asg("1", "OFF", 100, { work: 2 })] });
    const load = resourceLoad(db, { weeks: 2 });
    assert.ok(load.rows[0].cells.every((c) => c.demand === 0 && !c.over && Number.isFinite(c.demand)));
    assert.deepEqual(load.offCalendar, [{ id: "1", activity: "OFF", person: "P", role: null }]);
    assert.equal(resourceLoad(noCalendar(db), { weeks: 2 }).offCalendar, undefined, "no calendar, no key");

    const pc = plannedCost(db, db.activities[0]);
    assert.equal(pc.cost, 0); assert.equal(pc.complete, false, "no day to price is not a price of 0");
    assert.equal(pc.lines[0].offCalendar, true);
    const f = forecasts(db, "X");
    assert.equal(f.gap, "calendar"); assert.equal(f.etc, null);
    const bottomUp = f.methods.find((m) => m.key === "bottomUp");
    assert.equal(bottomUp.value, null); assert.match(bottomUp.why, /non-working days/);
  });
});

/* ── D-41.01 on the seeded book ─────────────────────────────────────── */

const ADMIN = { id: "x", role: "admin", active: true, displayName: "t" };

/** The seed ships no assignment and no rate; without some, "nothing
    moved" would prove nothing. Deterministic: the same book every run. */
function enrich(db) {
  const people = [...db.people].sort((a, b) => a.id.localeCompare(b.id));
  const acts = [...db.activities].sort((a, b) => a.id.localeCompare(b.id));
  const assignments = [];
  acts.forEach((a, i) => {
    const p = people[i % Math.min(people.length, 7)];
    assignments.push({ id: "T-" + i, activity: a.id, person: p.id, role: null,
      units: [50, 80, 100, 120, 150][i % 5], work: i % 6 === 0 ? (i % 9) + 1.5 : null, note: "" });
    if (i % 4 === 0) assignments.push({ id: "T-R" + i, activity: a.id, person: null, role: "Engineer", units: 60, work: null, note: "" });
  });
  const rates = [
    { id: "RT-1", person: null, role: "Engineer", dayRate: 900, currency: "USD", fx: 1, from: "2025-01-01", to: null },
    { id: "RT-2", person: people[0].id, role: null, dayRate: 1100, currency: "EUR", fx: 1.08, from: "2025-01-01", to: "2027-12-31" },
    { id: "RT-3", person: people[1].id, role: null, dayRate: 1000, currency: "USD", fx: 1, from: "2025-01-01", to: "2026-06-30" },
    { id: "RT-4", person: people[1].id, role: null, dayRate: 1250, currency: "USD", fx: 1, from: "2026-07-01", to: null },
  ];
  return { ...db, assignments: [...(db.assignments ?? []), ...assignments], rates: [...(db.rates ?? []), ...rates] };
}

function figures(M, db) {
  const acts = new Map(db.activities.map((a) => [a.id, a]));
  const earliest = db.activities.map((a) => a.start).sort()[0];
  return JSON.parse(JSON.stringify({
    work: db.assignments.map((x) => M.assignmentWork(x, acts.get(x.activity))),
    load: M.resourceLoad(db, { weeks: 26 }),
    loadAll: M.resourceLoad(db, { weeks: 120, from: earliest }),
    over: M.overallocations(db, { weeks: 26 }),
    cost: db.activities.map((a) => M.plannedCost(db, a)),
    curve: db.projects.map((p) => M.costCurve(db, p.id)),
    eac: db.projects.map((p) => M.forecasts(db, p.id)),
    level: M.proposeLeveling(db, { weeks: 12, maxMoves: 25 }),
  }));
}

describe("FX-08 bis · D-41.01 — no calendar anywhere, every figure is 5.36.0's", () => {
  before(async () => { await boot(); });
  after(shutdown);

  test("the seeded book (+ assignments and rates in memory): resourceLoad, assignmentWork, cost, S-curve, EAC, leveling deep-equal", async () => {
    const seeded = await loadPortfolio(ADMIN);
    assert.deepEqual(seeded.calendars, [], "the seeded book has no working calendar");
    const db = enrich(seeded);
    const before = figures(Frozen, db);
    const now = figures(Live, db);

    /* Not vacuous: there is load, over-allocation, cost and a proposal. */
    assert.ok(db.assignments.length > 40, "assignments: " + db.assignments.length);
    assert.ok(before.over.length > 0, "somebody is over");
    assert.ok(before.cost.some((c) => c.complete && c.cost > 0), "something is costed");
    assert.ok(before.eac.some((e) => e.plannedCost > 0), "a bottom-up figure exists");
    assert.ok(before.level.moves.length > 0, "the leveler proposes moves");

    for (const k of Object.keys(before)) assert.deepEqual(now[k], before[k], k + " moved");
    assert.deepEqual(now, before);
  });
});

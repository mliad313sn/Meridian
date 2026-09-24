/**
 * docs/41 wave B — FX-08 (assignments, over-allocation), FX-09 (leveling
 * proposed, never imposed) and FX-10 (rates, S-curve, three EACs, TCPI).
 *
 * The pure half is written against hand-computed fixtures (the
 * specification); the API half boots the seeded book and proves D-41.01
 * (no existing number moves) and D-41.02 (a proposal writes nothing).
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, shutdown, as, client, GROUP_PROJECT, SITE_PROJECT_GRU, SITE_PROJECT_YYZ } from "./harness.js";
import { one } from "../src/db.js";
import { loadPortfolio } from "../src/portfolio.js";
import { Engine } from "../../shared/engine.js";
import {
  workingDuration, assignmentWork, weekAvailability, resourceLoad, overallocations,
  overallocationSignal, rateFor, plannedCost, costCurve, forecasts, proposeLeveling,
} from "../../shared/resources.js";

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} ≠ ${b}`);

/** The smallest book the functions read. Status date Wed 1 Jul 2026, so
    the first week on screen is the one starting Mon 29 Jun. */
function book(over = {}) {
  return {
    statusDate: "2026-07-01",
    settings: { autoRag: true, amberSpi: 0.95, redSpi: 0.9, amberCpi: 0.95, redCpi: 0.9, capacityCeiling: 100 },
    sites: [{ id: "S1", city: "Here" }],
    people: [], projects: [], activities: [], allocations: [], absences: [],
    assignments: [], rates: [], ledger: [], milestones: [],
    ...over,
  };
}
const project = (id, extra = {}) => ({ id, name: "Project " + id, site: "S1", start: "2026-06-01",
  finish: "2026-12-31", budget: 1, contingency: 0, contingencyUsed: 0, rank: null, ...extra });
const activity = (id, projectId, start, end, extra = {}) => ({ id, project: projectId, name: id,
  stage: 0, start, end, baseStart: start, baseEnd: end, weight: 1, pct: 0, deps: [], origin: "local",
  version: 1, ...extra });

describe("FX-08 · work = duration × units, through one helper", () => {
  test("10 days at 60 % is 6 person-days; a typed work wins", () => {
    const a = activity("A", "X", "2026-07-06", "2026-07-16");
    assert.equal(workingDuration(a.start, a.end), 10, "calendar days until FX-02's calendars land");
    const w = assignmentWork({ units: 60, work: null }, a);
    near(w.work, 6, "work"); near(w.perDay, 0.6, "per day");
    const o = assignmentWork({ units: 60, work: 4 }, a);
    assert.equal(o.overridden, true);
    near(o.work, 4, "override"); near(o.perDay, 0.4, "override per day");
  });
});

describe("FX-08 · over-allocation against effective availability, week by week", () => {
  /* The hand-worked example of the brief. R works 4 weeks on / 2 off, so
     the directory says 50 % available (012). Two activities of two
     projects, 14 days each from Mon 29 Jun, R at 60 % on both:
       week of 29 Jun  demand 0.6 + 0.6 = 1.2 FTE, available 0.5
                       → 120 % of a 0.5 FTE person = 240 % of availability → OVER
       week of 6 Jul   R is on rotation leave all week (dated absence)
                       → available 0, work still booked → OVER, no ratio
       week of 13 Jul  both activities have ended → 0, not over */
  const R = { id: "R", name: "R. Rotation", role: "Fitter", site: "S1", availability: 50, rotation: "4/2" };
  const db = () => book({
    people: [R],
    projects: [project("X"), project("Y")],
    activities: [activity("XA", "X", "2026-06-29", "2026-07-13"), activity("YA", "Y", "2026-06-29", "2026-07-13")],
    assignments: [
      { id: "ASG-1", activity: "XA", person: "R", role: null, units: 60, work: null },
      { id: "ASG-2", activity: "YA", person: "R", role: null, units: 60, work: null },
    ],
    absences: [{ id: "ABS-1", person: "R", from: "2026-07-06", to: "2026-07-12", reason: "rotation" }],
  });

  test("0.5 FTE on rotation, two assignments at 60 % in one week → 1.2 of 0.5 → over-allocated", () => {
    const load = resourceLoad(db(), { weeks: 3 });
    assert.deepEqual(load.cols, ["2026-06-29", "2026-07-06", "2026-07-13"]);
    const [w1, w2, w3] = load.rows[0].cells;
    near(w1.demand, 1.2, "demand"); near(w1.available, 0.5, "available");
    near(w1.ratio, 2.4, "ratio"); assert.equal(w1.over, true);
    assert.equal(w1.sources.length, 2);
    assert.equal(w2.absentDays, 7); assert.equal(w2.available, 0);
    assert.equal(w2.ratio, null, "nothing to divide by"); assert.equal(w2.over, true, "work booked on a week away");
    assert.equal(w3.demand, 0); assert.equal(w3.over, false);
    assert.equal(overallocations(db(), { weeks: 3 }).length, 2);
  });

  test("where effectiveFte was unwired: Engine.capacity saw none of it", () => {
    /* No project allocation, so the capacity the product had reads 0 %
       for R — neither the rotation nor the two activities reach it. */
    const cap = Engine.capacity(db(), 3);
    assert.equal(cap.rows[0].cells[0].load, 0);
    assert.equal(Engine.overAllocated(db(), 3).length, 0);
  });

  test("availability is capped by a dated absence, never reduced twice", () => {
    const d = db();
    near(weekAvailability(d, R, "2026-06-29").available, 0.5, "on site");
    near(weekAvailability(d, R, "2026-07-06").available, 0, "on rotation leave");
    const F = { id: "F", name: "F. Full", availability: 100 };
    const two = book({ absences: [{ person: "F", from: "2026-06-29", to: "2026-06-30" }] });
    near(weekAvailability(two, F, "2026-06-29").available, 5 / 7, "two days of leave");
    const P = { id: "P", name: "P. Part", availability: 50 };
    const partTwo = book({ absences: [{ person: "P", from: "2026-06-29", to: "2026-06-30" }] });
    near(weekAvailability(partTwo, P, "2026-06-29").available, 0.5, "min(0.5, 5/7) — the annual average already holds leave");
  });

  test("an assignment refines its project's allocation — never counted on top of it", () => {
    const A = { id: "A", name: "A. Alloc", availability: 100 };
    const d = book({
      people: [A], projects: [project("X"), project("Z")],
      activities: [activity("XA", "X", "2026-06-29", "2026-07-13")],
      allocations: [
        { id: "1", person: "A", project: "X", from: "2026-06-01", to: "2026-09-30", pct: 50 },
        { id: "2", person: "A", project: "Z", from: "2026-06-01", to: "2026-09-30", pct: 30 },
      ],
      assignments: [{ id: "ASG-1", activity: "XA", person: "A", units: 40 }],
    });
    const cell = resourceLoad(d, { weeks: 1 }).rows[0].cells[0];
    near(cell.demand, 0.7, "0.4 on X by assignment + 0.3 on Z by allocation; X's 50 % is not added");
    assert.deepEqual(cell.sources.map((s) => s.kind).sort(), ["allocation", "assignment"]);
  });

  test("a role assignment is unstaffed demand, and the signal names who is over", () => {
    const d = db();
    d.assignments.push({ id: "ASG-3", activity: "XA", person: null, role: "Welder", units: 100 });
    const load = resourceLoad(d, { weeks: 1 });
    assert.deepEqual(load.roles.map((r) => r.role), ["Welder"]);
    near(load.roles[0].cells[0].demand, 1, "a full week of a welder nobody is named for");
    const sig = overallocationSignal(d, null, { weeks: 3 });
    assert.equal(sig.count, 1); assert.equal(sig.weeks, 2);
    assert.deepEqual(sig.people, ["R. Rotation"]);
    assert.equal(overallocationSignal(book(), null, { weeks: 3 }), null, "nobody over, no signal");
  });
});

describe("FX-10 · rates, planned cost, S-curve, three EACs and the TCPI", () => {
  test("person beats role beats the directory; a rate that changes mid-activity is honoured", () => {
    const P = { id: "P", name: "P", role: "Engineer", rate: 700 };
    const d = book({
      people: [P, { id: "Q", name: "Q", role: "Engineer", rate: 0 }],
      rates: [
        { id: "RATE-1", person: null, role: "Engineer", dayRate: 4000, currency: "USD", fx: 1, from: "2026-01-01", to: "2026-06-30" },
        { id: "RATE-2", person: null, role: "Engineer", dayRate: 6000, currency: "USD", fx: 1, from: "2026-07-01", to: null },
        { id: "RATE-3", person: "P", role: null, dayRate: 5000, currency: "EUR", fx: 1.1, from: "2026-07-01", to: null },
      ],
    });
    assert.equal(rateFor(d, { person: "P" }, "2026-07-02").source, "person");
    assert.equal(rateFor(d, { person: "P" }, "2026-06-15").source, "role", "the person's own rate starts in July");
    assert.equal(rateFor(d, { person: "Q" }, "2026-06-15").dayRate, 4000);
    assert.equal(rateFor(book({ people: [P] }), { person: "P" }, "2026-06-15").source, "directory");
    assert.equal(rateFor(book({ people: [{ id: "Z", rate: 0 }] }), { person: "Z" }, "2026-06-15"), null);

    /* 10 days from Fri 26 Jun at 50 % by role: 5 days at 4 000 and 5 at
       6 000 → 0.5 × (5 × 4 000 + 5 × 6 000) = 25 000 = 0.025 M. */
    const a = activity("A", "X", "2026-06-26", "2026-07-06");
    d.assignments = [{ id: "ASG-1", activity: "A", person: null, role: "Engineer", units: 50 }];
    const pc = plannedCost(d, a);
    near(pc.cost, 0.025, "planned cost in millions"); assert.equal(pc.complete, true);
    near(pc.lines[0].byMonth["2026-06"], 0.01, "June"); near(pc.lines[0].byMonth["2026-07"], 0.015, "July");
    /* The person's EUR rate converts at the fx posed on the line:
       10 d × 100 % in July × 5 000 × 1.1 = 55 000. */
    const july = activity("B", "X", "2026-07-06", "2026-07-16");
    d.assignments = [{ id: "ASG-2", activity: "B", person: "P", units: 100 }];
    near(plannedCost(d, july).cost, 0.055, "EUR at 1.1");
  });

  /* BAC 0.1 M (100 000). One activity of 20 days, 10 of them elapsed on
     the status date → PV = 0.05; 40 % done → EV = 0.04; cost lines
     AC = 0.05. So CPI = 0.8, SPI = 0.8. One person at 100 % for the 20
     days at 5 000 a day → planned cost 0.1 M, ETC = 0.1 × 60 % = 0.06.
       EAC (CPI)        0.1 / 0.8                     = 0.125
       EAC (CPI × SPI)  0.05 + (0.1 − 0.04) / 0.64    = 0.14375
       EAC (bottom-up)  0.05 + 0.06                   = 0.11
       TCPI             (0.1 − 0.04) / (0.1 − 0.05)   = 1.2
       TCPI to EAC(CPI) (0.1 − 0.04) / (0.125 − 0.05) = 0.8 */
  const evm = () => book({
    people: [{ id: "P", name: "P", role: "Engineer", rate: 0 }],
    projects: [project("E", { budget: 0.1, start: "2026-06-21", finish: "2026-07-11" })],
    activities: [activity("E1", "E", "2026-06-21", "2026-07-11", { pct: 40 })],
    assignments: [{ id: "ASG-1", activity: "E1", person: "P", units: 100 }],
    rates: [{ id: "RATE-1", person: "P", dayRate: 5000, currency: "USD", fx: 1, from: "2026-01-01", to: null }],
    ledger: [{ id: "1", project: "E", period: "2026-06", amount: 0.05 }],
  });

  test("EAC three ways and TCPI, computed by hand", () => {
    const f = forecasts(evm(), "E");
    near(f.pv, 0.05, "PV"); near(f.ev, 0.04, "EV"); near(f.ac, 0.05, "AC");
    near(f.cpi, 0.8, "CPI"); near(f.spi, 0.8, "SPI");
    const by = Object.fromEntries(f.methods.map((m) => [m.key, m]));
    near(by.cpi.value, 0.125, "EAC (CPI)");
    near(by.cpiSpi.value, 0.14375, "EAC (CPI × SPI)");
    near(by.bottomUp.value, 0.11, "EAC (bottom-up)");
    near(f.plannedCost, 0.1, "planned cost"); near(f.etc, 0.06, "ETC");
    near(f.tcpi, 1.2, "TCPI"); near(f.tcpiEac, 0.8, "TCPI to EAC");
    assert.deepEqual(f.methods.map((m) => m.label), [
      "EAC = BAC / CPI", "EAC = AC + (BAC − EV) / (CPI × SPI)", "EAC = AC + ETC (bottom-up)"]);
    /* Engine.metrics(...).eac is untouched: BAC/CPI, the first method. */
    near(Engine.metrics(evm(), "E").eac, by.cpi.value, "the existing EAC is the CPI method");
  });

  test("the S-curve reads Engine.curve: BCWS, BCWP, ACWP and the planned cost by month", () => {
    const c = costCurve(evm(), "E");
    assert.equal(c.measured, true);
    assert.deepEqual(c.months.map((m) => m.period), ["2026-06", "2026-07"]);
    const base = Engine.curve(evm(), [evm().projects[0]]);
    assert.deepEqual(c.months.map((m) => [m.bcws, m.bcwp, m.acwp]), base.map((m) => [m.pv, m.ev, m.ac]));
    /* 10 days in June and 10 in July at 5 000: 0.05 then 0.1 cumulative. */
    near(c.months[0].planned, 0.05, "June planned"); near(c.months[1].planned, 0.1, "cumulative July");
  });

  test("MER-04 — no budget: null and “nothing measured”, never a number", () => {
    const d = evm(); d.projects[0].budget = 0;
    const f = forecasts(d, "E");
    assert.equal(f.measured, false);
    assert.match(f.why, /Nothing measured/);
    for (const k of ["bac", "ev", "ac", "cpi", "spi", "etc", "tcpi", "tcpiEac", "plannedCost"]) assert.equal(f[k], null, k);
    for (const m of f.methods) { assert.equal(m.value, null, m.key); assert.match(m.why, /Nothing measured/); }
    assert.deepEqual(costCurve(d, "E").months, []);
  });

  test("a method that cannot be computed says why instead of inventing a figure", () => {
    const d = evm(); d.assignments = [];
    const f = forecasts(d, "E");
    const bu = f.methods.find((m) => m.key === "bottomUp");
    assert.equal(bu.value, null); assert.match(bu.why, /No costed assignment/);
    d.assignments = [{ id: "ASG-9", activity: "E1", person: null, role: "Unpriced", units: 100 }];
    const g = forecasts(d, "E").methods.find((m) => m.key === "bottomUp");
    assert.equal(g.value, null); assert.match(g.why, /no rate on some days/);
    /* One activity costed and another with work left and nobody on it:
       an ETC over the first alone is not the cost of finishing. */
    const p = evm();
    p.activities.push(activity("E2", "E", "2026-07-11", "2026-07-21", { weight: 0 }));
    const partial = forecasts(p, "E");
    assert.equal(partial.gap, "partial");
    assert.equal(partial.methods.find((m) => m.key === "bottomUp").value, null);
    near(partial.plannedCost, 0.1, "what IS costed is still stated");
  });
});

describe("FX-09 · leveling proposes, never imposes", () => {
  /* L is full-time. X (rank 1) has XA, 14 days from 29 Jun, L at 60 %.
     Y (rank 2) has YA, 7 days from 29 Jun, L at 60 %, then YB after it
     (finish-to-start), and YZ, 28 days, which nobody works — so YA carries
     float: 28 − (7 + 4) = 17 days.
     Week of 29 Jun: 0.6 + 0.6 = 1.2 > 1.0 → over.
     YA is the lower priority (rank 2, and more float). +7 days lands it on
     XA's second week (still 1.2); +14 clears it: YA 13 → 20 Jul, YB pushed
     to 20 → 24 Jul, inside the float — Y still finishes on 27 Jul. */
  const L = { id: "L", name: "L. Level", availability: 100 };
  const db = (over = {}) => book({
    people: [L],
    projects: [project("X", { rank: 1 }), project("Y", { rank: 2 })],
    activities: [
      activity("XA", "X", "2026-06-29", "2026-07-13"),
      activity("YA", "Y", "2026-06-29", "2026-07-06"),
      activity("YB", "Y", "2026-07-06", "2026-07-10", { deps: ["YA"] }),
      activity("YZ", "Y", "2026-06-29", "2026-07-27"),
    ],
    assignments: [
      { id: "ASG-1", activity: "XA", person: "L", units: 60 },
      { id: "ASG-2", activity: "YA", person: "L", units: 60 },
    ],
    ...over,
  });

  test("inside float first: the lower-priority activity moves, its successor follows, no finish moves", () => {
    const d = db();
    const frozen = JSON.stringify(d);
    const p = proposeLeveling(d, { weeks: 4 });
    assert.equal(JSON.stringify(d), frozen, "the book it was given is untouched (D-41.02)");
    assert.equal(p.before, 1); assert.equal(p.after, 0);
    const byId = Object.fromEntries(p.moves.map((m) => [m.activity, m]));
    assert.deepEqual(Object.keys(byId).sort(), ["YA", "YB"]);
    assert.deepEqual(byId.YA.to, { start: "2026-07-13", end: "2026-07-20" });
    assert.equal(byId.YA.kind, "float"); assert.match(byId.YA.reason, /Within total float \(17 d\)/);
    assert.deepEqual(byId.YB.to, { start: "2026-07-20", end: "2026-07-24" });
    assert.equal(byId.YB.kind, "pushed");
    assert.deepEqual(p.effects, [{ project: "Y", name: "Project Y", finishBefore: "2026-07-27",
      finishAfter: "2026-07-27", slipDays: 0 }]);
  });

  test("then by delaying the lower priority, and the finish it costs is stated", () => {
    const d = db({ activities: [
      activity("XA", "X", "2026-06-29", "2026-07-13"),
      activity("YA", "Y", "2026-06-29", "2026-07-06"),
    ] });
    const p = proposeLeveling(d, { weeks: 4 });
    assert.equal(p.moves.length, 1);
    assert.equal(p.moves[0].activity, "YA");
    assert.equal(p.moves[0].kind, "delay");
    assert.match(p.moves[0].reason, /lower priority \(rank 2, float 0 d\)/);
    assert.equal(p.moves[0].shiftDays, 14);
    assert.deepEqual(p.effects, [{ project: "Y", name: "Project Y", finishBefore: "2026-07-06",
      finishAfter: "2026-07-20", slipDays: 14 }]);
  });

  test("relieving one person by overloading another is not a resolution", () => {
    /* M (0.5 FTE) also works YA at 40 %, and YW in the week of 13 Jul at
       40 %. YA at +14 d would put M at 0.8 of 0.5 that week — worse for
       the book than L's 0.2 it relieves — so the leveler goes on to +21 d,
       past YA's float of 17 d: a delay, said as such. */
    const M = { id: "M", name: "M. Half", availability: 50 };
    const d = db();
    d.people.push(M);
    d.activities.push(activity("YW", "Y", "2026-07-13", "2026-07-20"));
    d.assignments.push({ id: "ASG-3", activity: "YA", person: "M", units: 40 },
                       { id: "ASG-4", activity: "YW", person: "M", units: 40 });
    const ya = proposeLeveling(d, { weeks: 4 }).moves.find((m) => m.activity === "YA");
    assert.deepEqual(ya.to, { start: "2026-07-20", end: "2026-07-27" });
    assert.equal(ya.kind, "delay");
  });

  test("it moves only what it may: authority, started work and synchronised stages stay put", () => {
    const p = proposeLeveling(db(), { weeks: 4, movable: (a) => a.project !== "Y" });
    assert.ok(p.moves.length > 0);
    assert.ok(p.moves.every((m) => m.project !== "Y"), "nothing of Y, which the caller may not move");
    assert.deepEqual(p.moves.map((m) => m.activity), ["XA"]);

    const started = db();
    started.activities.forEach((a) => { if (a.id === "YA" || a.id === "XA") a.pct = 10; });
    const q = proposeLeveling(started, { weeks: 4 });
    assert.deepEqual(q.moves, []);
    assert.equal(q.unresolved.length, 1);
    assert.match(q.unresolved[0].why, /Nothing this week may move/);

    const synced = db();
    synced.activities.forEach((a) => { a.origin = "sdp"; });
    assert.deepEqual(proposeLeveling(synced, { weeks: 4 }).moves, []);
  });
});

/* ── the API: D-41.01 and D-41.02 on the seeded book ───────────────── */

const ADMIN = { id: "x", role: "admin", active: true, displayName: "t" };
const BASE = JSON.parse(readFileSync(new URL("./engine-5.28.0.json", import.meta.url), "utf8"));
function engineNumbers(db) {
  const strip = (m) => { const { project, ...rest } = m; return { id: project.id, ...rest }; };
  const metrics = Object.fromEntries(db.projects.map((p) => [p.id, strip(Engine.metrics(db, p.id))]));
  const { metrics: _m, ...roll } = Engine.roll(db, db.projects);
  const criticalPath = Object.fromEntries(db.projects.map((p) => {
    const c = Engine.criticalPath(db, p.id);
    /* The seven keys 5.28.0 returned; 5.29.0 adds others by contract. */
    const { critical, float, projEnd, es, ef, ls, lf } = c;
    return [p.id, { critical: [...critical].sort(), float, projEnd, es, ef, ls, lf }];
  }));
  return JSON.parse(JSON.stringify({ statusDate: db.statusDate, metrics, roll, criticalPath }));
}

describe("the book: assignments, rates and leveling through the routes", () => {
  before(async () => { await boot(); });
  after(shutdown);

  let person, act101, act112;

  test("D-41.01 — Engine.metrics, Engine.roll and Engine.criticalPath equal 5.28.0 before and after", async () => {
    assert.deepEqual(engineNumbers(await loadPortfolio(ADMIN)), BASE,
      "the seeded book must still produce 5.28.0's numbers (server/test/engine-5.28.0.json)");

    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    person = db.people.find((p) => !db.allocations.some((a) => a.person === p.id));
    assert.ok(person, "the seed has somebody on no project");
    act101 = db.activities.find((a) => a.project === GROUP_PROJECT);
    act112 = db.activities.find((a) => a.project === SITE_PROJECT_YYZ);
    for (const [a, units] of [[act101, 80], [act112, 70]]) {
      const r = await admin.post("/api/assignments", { activity: a.id, person: person.id, units });
      assert.equal(r.status, 201, r.text);
    }
    assert.equal((await admin.post("/api/assignments", { activity: act101.id, role: "Architect", units: 50, work: 12 })).status, 201);
    for (const body of [
      { role: person.role || "Engineer", dayRate: 900, currency: "USD", from: "2026-01-01" },
      { person: person.id, dayRate: 1100, currency: "EUR", fx: 1.08, from: "2026-01-01", to: "2027-12-31" },
    ]) {
      const r = await admin.post("/api/rates", body);
      assert.equal(r.status, 201, r.text);
    }
    const after = await loadPortfolio(ADMIN);
    assert.equal(after.assignments.length, 3); assert.equal(after.rates.length, 2);
    assert.deepEqual(engineNumbers(after), BASE, "assignments and rates are additive — nothing already computed moves");
    /* …and every new figure computed on that book leaves it as it was. */
    for (const p of after.projects) { forecasts(after, p.id); costCurve(after, p.id); }
    resourceLoad(after, { weeks: 12 });
    assert.deepEqual(engineNumbers(after), BASE);
  });

  test("an assignment: units 1–200, a person OR a role, a version on every change", async () => {
    const admin = await as("admin");
    for (const [body, why] of [
      [{ activity: act101.id, person: person.id, units: 0 }, /1 to 200/],
      [{ activity: act101.id, person: person.id, units: 201 }, /1 to 200/],
      [{ activity: act101.id, person: person.id, role: "Engineer" }, /OR a role/],
      [{ activity: act101.id }, /person or a role/],
      [{ activity: act101.id, person: person.id, work: -1 }, /person-days/],
    ]) {
      const r = await admin.post("/api/assignments", body);
      assert.equal(r.status, 400, JSON.stringify(body)); assert.match(r.body.error, why);
    }
    const row = await one(`SELECT * FROM assignment WHERE activity_id = $1 AND person_id = $2`, [act101.id, person.id]);
    assert.equal((await admin.patch("/api/assignments/" + row.id, { units: 90 })).status, 428, "no version, no write");
    const ok = await admin.patch("/api/assignments/" + row.id, { units: 90, work: 5, version: row.row_version });
    assert.equal(ok.status, 200, ok.text);
    const stale = await admin.patch("/api/assignments/" + row.id, { units: 95, version: row.row_version });
    assert.equal(stale.status, 409);
    const back = await admin.patch("/api/assignments/" + row.id, { units: 80, work: null, version: ok.body.version });
    assert.equal(back.status, 200);
    assert.equal((await one(`SELECT work_days FROM assignment WHERE id = $1`, [row.id])).work_days, null,
      "work: null gives the computed work back");
  });

  test("authority — a viewer assigns nothing, a site lead only their own site's people, rates are group money", async () => {
    const gru = await as("siteGRU");
    const db = (await gru.get("/api/bootstrap")).body.db;
    const gruAct = db.activities.find((a) => a.project === SITE_PROJECT_GRU);
    const viewer = await as("viewerGRU");
    const v = await viewer.post("/api/assignments", { activity: gruAct.id, role: "Tester" });
    assert.equal(v.status, 403, "a viewer who can see the stage is refused by name");
    assert.equal((await (await as("viewerLIS")).post("/api/assignments", { activity: act101.id, role: "Tester" })).status, 404,
      "one who cannot see it is told it does not exist (R1.10)");
    const own = db.people.find((p) => p.site === "GRU");
    const other = db.people.find((p) => p.site !== "GRU");
    assert.equal((await gru.post("/api/assignments", { activity: gruAct.id, person: own.id, units: 50 })).status, 201);
    const refused = await gru.post("/api/assignments", { activity: gruAct.id, person: other.id, units: 50 });
    assert.equal(refused.status, 403); assert.match(refused.body.error, /another site/);
    assert.equal((await gru.post("/api/assignments", { activity: act101.id, role: "Tester" })).status, 403,
      "a group-governed project is read-only to a site lead");
    const rate = await gru.post("/api/rates", { role: "Tester", dayRate: 500, from: "2026-01-01" });
    assert.equal(rate.status, 403); assert.match(rate.body.error, /group-level/);
    const group = await as("groupCBP");
    const g = await group.post("/api/rates", { role: "Tester", dayRate: 500, currency: "usd", from: "2026-01-01" });
    assert.equal(g.status, 201, g.text);
    const r = await one(`SELECT * FROM rate WHERE id = $1`, [g.body.id]);
    assert.equal(r.currency, "USD");
    const bad = await group.patch("/api/rates/" + r.id, { to: "2025-01-01", version: r.row_version });
    assert.equal(bad.status, 400); assert.match(bad.body.error, /before it takes effect/);
    assert.equal((await group.patch("/api/rates/" + r.id, { dayRate: 550, version: r.row_version })).status, 200);
    assert.equal((await group.del("/api/rates/" + r.id)).status, 200);
  });

  let proposal, levelA, levelB;
  test("D-41.02 — computing a proposal writes zero rows", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    /* A second full-time person on nothing, so the only load is the probe's. */
    const free = db.people.find((p) => p.id !== person.id && (p.availability ?? 100) === 100 &&
      !db.allocations.some((a) => a.person === p.id) && !db.absences.some((a) => a.person === p.id));
    assert.ok(free, "the seed has a second full-timer on no project");
    /* Two stages after the status date (Fri 28 Aug), that person at 100 %
       on both in the week of 31 Aug: 2.0 FTE of 1.0. */
    for (const [projectId, end] of [[GROUP_PROJECT, "2026-09-14"], [SITE_PROJECT_YYZ, "2026-09-07"]]) {
      const r = await admin.post("/api/activities", { project: projectId, name: "Levelling probe", start: "2026-08-31", end, weight: 0.01 });
      assert.equal(r.status, 201, r.text);
      if (projectId === GROUP_PROJECT) levelA = r.body.id; else levelB = r.body.id;
      assert.equal((await admin.post("/api/assignments", { activity: r.body.id, person: free.id, units: 100 })).status, 201);
    }
    const count = async () => (await one(`SELECT count(*)::int AS n FROM audit_event`)).n;
    const versions = async () => (await one(`SELECT sum(row_version)::int AS v, count(*)::int AS n FROM activity`));
    const [a0, v0] = [await count(), await versions()];
    const r = await admin.get("/api/leveling/proposal?weeks=6");
    assert.equal(r.status, 200, r.text);
    assert.equal(await count(), a0, "not one audit row");
    assert.deepEqual(await versions(), v0, "not one activity touched");
    proposal = r.body;
    const mine = proposal.moves.filter((m) => [levelA, levelB].includes(m.activity));
    assert.equal(mine.length, 1, JSON.stringify(proposal.moves));
    for (const m of proposal.moves) {
      assert.ok(m.from.start && m.to.start && m.reason && Number.isInteger(m.version), JSON.stringify(m));
    }
    assert.ok(proposal.effects.some((e) => e.project === mine[0].project));
  });

  test("applying: authority first, all or nothing on a stale version, one audit row per activity", async () => {
    const move = proposal.moves.find((m) => [levelA, levelB].includes(m.activity));
    const body = { moves: [{ activity: move.activity, start: move.to.start, end: move.to.end, version: move.version }],
                   reason: "Levelling the probe" };
    /* Refused either way: 403 when the account sees the stage, 404 when it
       does not (R1.10 — an out-of-scope stage does not exist for it). */
    assert.ok([403, 404].includes((await (await as("viewerLIS")).post("/api/leveling/apply", body)).status));
    assert.ok([403, 404].includes((await (await as("viewerGRU")).post("/api/leveling/apply", body)).status));
    if (move.project === GROUP_PROJECT) {
      assert.equal((await (await as("siteGRU")).post("/api/leveling/apply", body)).status, 403);
    }
    const admin = await as("admin");
    const stale = await admin.post("/api/leveling/apply",
      { moves: [{ ...body.moves[0], version: move.version + 5 }] });
    assert.equal(stale.status, 409);
    assert.equal((await one(`SELECT start_date FROM activity WHERE id = $1`, [move.activity])).start_date, move.from.start,
      "nothing moved");
    const ok = await admin.post("/api/leveling/apply", body);
    assert.equal(ok.status, 200, ok.text);
    const row = await one(`SELECT start_date, end_date, row_version FROM activity WHERE id = $1`, [move.activity]);
    assert.deepEqual([row.start_date, row.end_date], [move.to.start, move.to.end]);
    assert.equal(row.row_version, move.version + 1);
    const trail = await one(
      `SELECT count(*)::int AS n FROM audit_event WHERE action = 'Activity levelled' AND entity_id = $1`, [move.activity]);
    assert.equal(trail.n, 1);
    const again = await admin.get("/api/leveling/proposal?weeks=6");
    assert.ok(!again.body.moves.some((m) => [levelA, levelB].includes(m.activity)), "the conflict it solved is gone");
  });

  test("the contract writes an assignment under the integration's own id", async () => {
    const admin = await as("admin");
    const key = (await admin.post("/api/admin/integrations", { name: "Planner", scopes: "write:portfolio", purpose: "test" })).body.key;
    const c = client();
    const put = (id, b) => c.put("/api/v1/assignments/" + id, b, { "X-API-Key": key });
    const made = await put("MSP-1", { activity: act112.id, person: person.id, units: 50 });
    assert.equal(made.status, 201, made.text);
    assert.equal((await put("MSP-1", { units: 50 })).body.created, false);
    const upd = await put("MSP-1", { units: 75, version: made.body.version });
    assert.equal(upd.status, 200, upd.text);
    assert.equal((await put("MSP-1", { units: 80, version: made.body.version })).status, 409);
    assert.equal((await put("MSP-2", { activity: act112.id, colour: "red" })).status, 400, "an undeclared field is refused");
    const row = await one(`SELECT * FROM assignment WHERE external_id = 'MSP-1'`);
    assert.equal(row.units, 75);
  });
});

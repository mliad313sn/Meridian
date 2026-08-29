/**
 * R3.* — the engine is behaviour-frozen (D-05).
 *
 * These tests pin the arithmetic the committee reviewed in the v4 build.
 * They are written against hand-computable fixtures rather than the seed,
 * so a failure says "the formula changed", not "the data moved".
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Engine, GATES, days, iso, addDays } from "../../shared/engine.js";

/** Smallest portfolio that still exercises PV, EV, AC and the guards. */
function fixture(over = {}) {
  const settings = {
    autoRag: true, gateLock: true, ccb: true, capacityAlerts: true, benefitTrack: true,
    ccbThreshold: 0.25, ccbWeeks: 2,
    amberSpi: 0.95, redSpi: 0.90, amberCpi: 0.95, redCpi: 0.90,
    escalateExposure: 15, pmoExposure: 8, issueAgeDays: 10, capacityCeiling: 100,
    ...over.settings,
  };
  return {
    statusDate: "2026-07-01",
    settings,
    sites: [{ id: "S1", city: "Here", tz: 0 }],
    programmes: [{ id: "P1", name: "Programme" }],
    people: [{ id: "PE-1", name: "A. Person", role: "PM", site: "S1", rate: 500 }],
    projects: [{
      id: "X", name: "Test", programme: "P1", site: "S1", governanceLevel: "group",
      pm: "PE-1", method: "Waterfall",
      start: "2026-01-01", finish: "2026-12-31", baselineFinish: "2026-12-31",
      budget: 100, contingency: 10, contingencyUsed: 0,
      phase: "Execution", gate: 0, healthOverride: null, closed: false,
      ...over.project,
    }],
    /* Two halves of the year, equal weight. On 1 July the first is fully
       planned and the second not started, so PV is exactly half of BAC. */
    activities: over.activities ?? [
      { id: "A1", project: "X", name: "First half", stage: 0,
        start: "2026-01-01", end: "2026-06-30", baseStart: "2026-01-01", baseEnd: "2026-06-30",
        weight: 0.5, pct: 100, owner: "PE-1", deps: [] },
      { id: "A2", project: "X", name: "Second half", stage: 1,
        start: "2026-07-01", end: "2026-12-31", baseStart: "2026-07-01", baseEnd: "2026-12-31",
        weight: 0.5, pct: 0, owner: "PE-1", deps: ["A1"] },
    ],
    milestones: over.milestones ?? [],
    ledger: over.ledger ?? [{ project: "X", period: "2026-06", amount: 50 }],
    raid: over.raid ?? [],
    crs: over.crs ?? [],
    docs: over.docs ?? [],
    items: [], columns: [],
    allocations: over.allocations ?? [],
    narrative: {},
  };
}

describe("earned value (R3.1)", () => {
  test("PV, EV and AC come out of the plan, the progress and the ledger", () => {
    const m = Engine.metrics(fixture(), "X");
    assert.equal(m.bac, 100);
    assert.equal(m.pv, 50, "half the plan is due by 1 July");
    assert.equal(m.ev, 50, "the first half is reported complete");
    assert.equal(m.ac, 50, "the ledger holds 50");
    assert.equal(m.spi, 1);
    assert.equal(m.cpi, 1);
    assert.equal(m.sv, 0);
    assert.equal(m.cv, 0);
  });

  test("an overspend moves CPI, EAC and VAC together and consistently", () => {
    const m = Engine.metrics(fixture({ ledger: [{ project: "X", period: "2026-06", amount: 62.5 }] }), "X");
    assert.equal(m.ac, 62.5);
    assert.equal(m.cpi, 0.8, "50 earned for 62.5 spent");
    assert.equal(m.eac, 125, "BAC / CPI");
    assert.equal(m.vac, -25, "BAC − EAC");
    // TCPI: work remaining over money remaining.
    assert.equal(Number(m.tcpi.toFixed(4)), Number(((100 - 50) / (100 - 62.5)).toFixed(4)));
  });

  test("a schedule slip moves SPI and pushes the forecast finish out", () => {
    const late = fixture();
    late.activities[0].pct = 60;                       // 30 earned, 50 planned
    const m = Engine.metrics(late, "X");
    assert.equal(m.ev, 30);
    assert.equal(m.spi, 0.6);
    assert.ok(m.slipDays > 100, "SPI 0.6 should stretch the remaining half-year materially");
    assert.equal(m.health.rag, "R");
  });

  test("R3.2 · the too-early guard suppresses indices that would be noise", () => {
    /* One per cent of the plan elapsed and a rounding error of spend: the
       raw ratio would read CPI 0.10 and paint a healthy project red. */
    const early = fixture({
      activities: [{
        id: "A1", project: "X", name: "Mobilisation", stage: 0,
        start: "2026-06-25", end: "2026-12-31", baseStart: "2026-06-25", baseEnd: "2026-12-31",
        weight: 1, pct: 1, owner: "PE-1", deps: [],
      }],
      ledger: [{ project: "X", period: "2026-06", amount: 0.4 }],
    });
    const m = Engine.metrics(early, "X");
    assert.equal(m.measurable, false);
    assert.equal(m.spi, 1, "indices report 1.00 rather than nonsense");
    assert.equal(m.cpi, 1);
    assert.equal(m.health.rag, "G");
    assert.match(m.health.why, /too early/i);
  });

  test("the guard releases as soon as the plan is genuinely under way", () => {
    const m = Engine.metrics(fixture(), "X");
    assert.equal(m.measurable, true);
  });

  test("a project with no activities reports zero rather than dividing by nothing", () => {
    const empty = fixture({ activities: [], ledger: [] });
    const m = Engine.metrics(empty, "X");
    assert.equal(m.pv, 0);
    assert.equal(m.ev, 0);
    assert.equal(m.spi, 1);
    assert.equal(m.cpi, 1);
    assert.ok(Number.isFinite(m.eac));
  });
});

describe("RAG (R3.4)", () => {
  const at = (spi, cpi) => {
    const db = fixture({ ledger: [{ project: "X", period: "2026-06", amount: 50 / cpi }] });
    db.activities[0].pct = spi * 100;
    return Engine.metrics(db, "X").health;
  };

  test("green inside tolerance, amber then red as the indices fall", () => {
    assert.equal(at(1.0, 1.0).rag, "G");
    assert.equal(at(0.93, 1.0).rag, "A");
    assert.equal(at(0.88, 1.0).rag, "R");
    assert.equal(at(1.0, 0.93).rag, "A");
    assert.equal(at(1.0, 0.85).rag, "R");
  });

  test("the worse of the two indices decides", () => {
    assert.equal(at(1.05, 0.85).rag, "R", "a healthy schedule does not rescue a failing cost line");
  });

  test("a manual override wins and carries its reason", () => {
    const db = fixture({ project: { healthOverride: "R", healthOverrideWhy: "Vendor has gone quiet" } });
    const h = Engine.metrics(db, "X").health;
    assert.equal(h.rag, "R");
    assert.equal(h.derived, false);
    assert.match(h.why, /vendor/i);
  });

  test("with automatic status off, judgement applies rather than arithmetic", () => {
    const db = fixture({ settings: { autoRag: false } });
    db.activities[0].pct = 10;
    const h = Engine.metrics(db, "X").health;
    assert.equal(h.rag, "G");
    assert.match(h.why, /judgement/i);
  });
});

describe("roll-up (R3.7)", () => {
  test("two red projects cannot average into a green portfolio", () => {
    const db = fixture();
    db.projects.push({ ...db.projects[0], id: "Y", name: "Second" });
    db.activities.push(
      { ...db.activities[0], id: "B1", project: "Y", pct: 40 },
      { ...db.activities[1], id: "B2", project: "Y", deps: ["B1"] },
    );
    db.ledger.push({ project: "Y", period: "2026-06", amount: 60 });
    const roll = Engine.roll(db, db.projects);
    assert.equal(roll.count, 2);
    assert.equal(roll.red, 1);
    // The aggregate is dragged toward the failing project, not away from it.
    assert.ok(roll.spi < 1, "aggregate SPI reflects the slip");
    assert.equal(roll.bac, 200);
  });
});

describe("critical path (R3.3)", () => {
  const chain = () => fixture({
    activities: [
      { id: "A", project: "X", name: "A", stage: 0, start: "2026-01-01", end: "2026-02-01",
        baseStart: "2026-01-01", baseEnd: "2026-02-01", weight: .25, pct: 100, deps: [] },
      { id: "B", project: "X", name: "B", stage: 1, start: "2026-02-01", end: "2026-04-01",
        baseStart: "2026-02-01", baseEnd: "2026-04-01", weight: .25, pct: 100, deps: ["A"] },
      // A short parallel branch that finishes early: it must carry float.
      { id: "C", project: "X", name: "C", stage: 2, start: "2026-02-01", end: "2026-02-10",
        baseStart: "2026-02-01", baseEnd: "2026-02-10", weight: .25, pct: 100, deps: ["A"] },
      { id: "D", project: "X", name: "D", stage: 3, start: "2026-04-01", end: "2026-06-01",
        baseStart: "2026-04-01", baseEnd: "2026-06-01", weight: .25, pct: 50, deps: ["B", "C"] },
    ],
  });

  test("the long chain is critical and the short branch is not", () => {
    const cp = Engine.criticalPath(chain(), "X");
    assert.ok(cp.critical.has("A"));
    assert.ok(cp.critical.has("B"));
    assert.ok(cp.critical.has("D"));
    assert.ok(!cp.critical.has("C"), "C finishes long before D needs it");
    assert.ok(cp.float.C > 0, "and therefore carries float");
    assert.equal(cp.float.B, 0);
  });

  test("the topological order never visits a task before its predecessor", () => {
    const db = chain();
    const order = Engine.topo(db.activities).map((a) => a.id);
    assert.ok(order.indexOf("A") < order.indexOf("B"));
    assert.ok(order.indexOf("B") < order.indexOf("D"));
    assert.ok(order.indexOf("C") < order.indexOf("D"));
  });

  test("designed fast-track overlap is not reported as a breach", () => {
    const db = fixture({
      activities: [
        { id: "A", project: "X", name: "A", stage: 0, start: "2026-01-01", end: "2026-03-01",
          baseStart: "2026-01-01", baseEnd: "2026-03-01", weight: .5, pct: 100, deps: [] },
        // The baseline already agreed a 28-day overlap; the plan holds it.
        { id: "B", project: "X", name: "B", stage: 1, start: "2026-02-01", end: "2026-05-01",
          baseStart: "2026-02-01", baseEnd: "2026-05-01", weight: .5, pct: 20, deps: ["A"] },
      ],
    });
    assert.equal(Engine.depBreaches(db, "X").length, 0);
  });

  test("an overlap deeper than the baseline agreed is reported", () => {
    const db = fixture({
      activities: [
        { id: "A", project: "X", name: "A", stage: 0, start: "2026-01-01", end: "2026-03-01",
          baseStart: "2026-01-01", baseEnd: "2026-03-01", weight: .5, pct: 100, deps: [] },
        // Baseline agreed no overlap; the plan now starts two months early.
        { id: "B", project: "X", name: "B", stage: 1, start: "2026-01-01", end: "2026-05-01",
          baseStart: "2026-03-01", baseEnd: "2026-05-01", weight: .5, pct: 20, deps: ["A"] },
      ],
    });
    const breaches = Engine.depBreaches(db, "X");
    assert.equal(breaches.length, 1);
    assert.equal(breaches[0].activity.id, "B");
    assert.ok(breaches[0].overlap > 50);
  });
});

describe("RAID (R3.6)", () => {
  const item = (p, i, over = {}) => ({
    id: "R1", project: "X", type: "Risk", title: "t", p, i,
    status: "Open", opened: "2026-06-01", ...over,
  });

  test("exposure is probability times impact, banded", () => {
    assert.equal(Engine.exposure(item(4, 5)), 20);
    assert.equal(Engine.exposureBand(item(4, 5)), "Critical");
    assert.equal(Engine.exposureBand(item(3, 4)), "High");
    assert.equal(Engine.exposureBand(item(2, 2)), "Medium");
    assert.equal(Engine.exposureBand(item(1, 2)), "Low");
  });

  test("escalation follows the configured thresholds", () => {
    const db = fixture();
    assert.equal(Engine.escalation(db, item(4, 5)).level, "Steering", "20 ≥ 15");
    assert.equal(Engine.escalation(db, item(3, 3)).level, "PMO", "9 ≥ 8");
    assert.equal(Engine.escalation(db, item(1, 2)).level, "Project");
    assert.equal(Engine.escalation(db, item(4, 5, { status: "Closed" })).level, "Closed");
  });

  test("an issue left open past the age limit escalates on age alone", () => {
    const db = fixture();
    const old = item(1, 2, { type: "Issue", opened: "2026-06-01" }); // 30 days by 1 July
    assert.equal(Engine.escalation(db, old).level, "PMO");
    const fresh = item(1, 2, { type: "Issue", opened: "2026-06-29" });
    assert.equal(Engine.escalation(db, fresh).level, "Project");
  });
});

describe("gates (R3.5)", () => {
  /* R-01 — an approved document counts as evidence only when it points
     at an artefact, so the fixture carries the link a real approval
     leaves behind. */
  const withDocs = (statuses) => fixture({
    milestones: [{ id: "M1", project: "X", name: GATES[0].name, date: "2026-07-20", gate: 1, kind: "gate" }],
    docs: statuses.map((s, i) => ({
      id: "D" + i, project: "X", name: "Evidence " + i, type: "Charter",
      gate: 1, status: s, rev: "1.0", updated: "2026-06-01",
      uri: s === "Approved" ? "https://docs.meridian.example/evidence/D" + i + ".pdf" : "",
    })),
  });

  test("an approved document with no artefact is not evidence (R-01)", () => {
    const db = withDocs(["Approved", "Approved"]);
    db.docs[1].uri = "";   // approved, but pointing at nothing
    const st = Engine.gateStatus(db, "X", 1);
    assert.equal(st.approved, 1, "the label does not count");
    assert.equal(st.ready, false);
    assert.equal(st.outstanding.length, 1, "and the empty one is named outstanding");
    assert.equal(Engine.canAdvance(db, "X").ok, false, "the gate does not clear on paperwork nobody can open");
  });

  test("a gate with every document approved is ready", () => {
    const st = Engine.gateStatus(withDocs(["Approved", "Approved"]), "X", 1);
    assert.equal(st.ready, true);
    assert.equal(st.outstanding.length, 0);
    assert.equal(st.state, "Ready", "dated inside 45 days with evidence complete");
  });

  test("an outstanding document puts the gate at risk and blocks the advance", () => {
    const db = withDocs(["Approved", "Draft"]);
    const st = Engine.gateStatus(db, "X", 1);
    assert.equal(st.ready, false);
    assert.equal(st.outstanding.length, 1);
    assert.equal(st.state, "At risk");

    const advance = Engine.canAdvance(db, "X");
    assert.equal(advance.ok, false);
    assert.match(advance.reason, /1 evidence item outstanding/);
  });

  test("with gate locking off the advance is allowed and says so", () => {
    const db = withDocs(["Draft"]);
    db.settings.gateLock = false;
    const advance = Engine.canAdvance(db, "X");
    assert.equal(advance.ok, true);
    assert.match(advance.reason, /locking is off/i);
  });

  test("a gate whose date has passed with evidence outstanding is overdue", () => {
    const db = withDocs(["Draft"]);
    db.milestones[0].date = "2026-06-01";
    assert.equal(Engine.gateStatus(db, "X", 1).state, "Overdue");
  });
});

describe("change routing", () => {
  test("magnitude decides the authority", () => {
    const db = fixture();
    assert.equal(Engine.route(db, { cost: 0.1, weeks: 1 }).authority, "Change authority");
    assert.equal(Engine.route(db, { cost: 0.6, weeks: 0 }).authority, "Steering committee");
    assert.equal(Engine.route(db, { cost: 0, weeks: 3 }).authority, "Steering committee");
    assert.equal(Engine.route(db, { cost: -0.6, weeks: 0 }).authority, "Steering committee",
      "a large descope is as much a decision as a large addition");
  });

  test("with the board switched off the project manager decides", () => {
    const db = fixture({ settings: { ccb: false } });
    assert.equal(Engine.route(db, { cost: 5, weeks: 20 }).authority, "Project manager");
  });
});

describe("capacity", () => {
  const db = () => fixture({
    allocations: [
      { id: "1", person: "PE-1", project: "X", from: "2026-06-01", to: "2026-09-01", pct: 80 },
      { id: "2", person: "PE-1", project: "X", from: "2026-06-15", to: "2026-08-01", pct: 50 },
    ],
  });

  test("overlapping allocations add up week by week", () => {
    const cap = Engine.capacity(db(), 4);
    assert.equal(cap.rows.length, 1);
    assert.equal(cap.rows[0].cells[0].load, 130, "80 + 50 in the overlap");
    assert.equal(cap.rows[0].peak, 130);
  });

  test("someone over the ceiling for two consecutive weeks is flagged", () => {
    assert.equal(Engine.overAllocated(db(), 4).length, 1);
  });

  test("a single week over the ceiling is not enough to raise an alert", () => {
    const one = fixture({
      allocations: [
        { id: "1", person: "PE-1", project: "X", from: "2026-06-29", to: "2026-07-03", pct: 130 },
      ],
    });
    assert.equal(Engine.overAllocated(one, 4).length, 0);
  });
});

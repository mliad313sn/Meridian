/**
 * REQ-24 (RT365 V-5) — WHAT WE CHOOSE NOT TO DO.
 *
 * « Choosing what not to do is where a portfolio creates most of its
 * value. Meridian ranks nothing today; demand carries no score. »
 *
 * The first block of tests is the one that matters most, and it is
 * deliberately first. A rank is an ordinal: `#1` looks confident whether
 * or not anything is behind it, which makes a ranking the most dangerous
 * place in this product for the mistake REQ-33 was written to end. So
 * these hold the ABSENCES — what happens to a row, and to a line, whose
 * inputs nobody has recorded — before anything holds the arithmetic.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import {
  prioritise, PRIORITY_TEXT, INPUTS, DEFAULT_WEIGHTS,
  formatScore, formatFte, formatInput, formatShare,
} from "../../shared/prioritise.js";

/* ── a fixture book, small enough to hold in the head ───────────────
   One programme, two people (a pool of exactly 2.00 FTE), and a horizon
   of 100 days from the status date so an allocation running the whole
   window is exactly 1.00 FTE. */

const HORIZON = 100;
const FULL = { from: "2026-01-01", to: "2026-04-10" };   // the whole horizon

const complete = (over = {}) => ({
  asAt: "2026-01-01", horizonDays: HORIZON,
  weighting: { ...DEFAULT_WEIGHTS },
  ceiling: 100, envelope: 0,
  programmes: [{ id: "PR", name: "Programme" }],
  people: [{ availability: 100 }, { availability: 100 }],
  projects: [], cases: [], raid: [], allocations: [], demand: [],
  ...over,
});

/** A project that carries all four inputs, so a test can remove one. */
function full(id, { benefit = 10, confidence = 4, p = 2, i = 2, pct = 50 } = {}) {
  return {
    projects: [{ id, name: id, programme: "PR", closed: false, budget: 1 }],
    cases: [{ project: id, expectedBenefit: benefit, valueConfidence: confidence }],
    raid: [{ project: id, p, i, status: "Open" }],
    allocations: [{ project: id, pct, ...FULL }],
  };
}
const merge = (...parts) => {
  const out = { projects: [], cases: [], raid: [], allocations: [] };
  for (const x of parts) for (const k of Object.keys(out)) out[k].push(...(x[k] ?? []));
  return out;
};

/* ═══════════════════════════════════════════════════════════════════
   1 · THE ABSENCES — the single thing most likely to be wrong
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-24 · an input nobody recorded is not a zero", () => {

  test("a project with no business case has no claimed value — it is not placed, not placed last, and not placed first", () => {
    const rich = full("RICH", { benefit: 100 });
    const poor = full("POOR", { benefit: 1 });
    /* NOTHING says what NOTHING is worth: no case row at all. */
    const none = full("NONE");
    none.cases = [];
    const r = prioritise(complete(merge(rich, poor, none)));

    assert.equal(r.counts.ranked, 2);
    assert.deepEqual(r.ranked.map((x) => x.id), ["RICH", "POOR"]);
    /* Not at the bottom of the order… */
    assert.ok(!r.ranked.some((x) => x.id === "NONE"), "an unscored row is not in the order");
    /* …and not at the top of it either. It is not IN it. */
    const row = r.notPlaced.find((x) => x.id === "NONE");
    assert.equal(row.rank, null, "no rank at all — not a rank of last");
    assert.equal(row.score, null, "no score at all — not a score of zero");
    assert.equal(row.state, "N");
    assert.deepEqual(row.missing, ["value", "confidence"]);
    assert.equal(row.inputs.value.why, PRIORITY_TEXT.noCase);
    assert.equal(formatScore(row), "—", "and it formats as an em dash, never 0.0");
  });

  test("a business case with a summary and no number claims no value", () => {
    const one = full("A");
    one.cases = [{ project: "A", expectedBenefit: null, valueConfidence: 3 }];
    const r = prioritise(complete(one));
    assert.equal(r.counts.ranked, 0);
    assert.equal(r.notPlaced[0].inputs.value.why, PRIORITY_TEXT.noCaseBenefit);
  });

  test("confidence is never invented — an unrecorded confidence keeps the row out of the order", () => {
    const one = full("A", { confidence: null });
    one.cases = [{ project: "A", expectedBenefit: 10, valueConfidence: null }];
    const r = prioritise(complete(one));
    assert.equal(r.counts.ranked, 0);
    assert.deepEqual(r.notPlaced[0].missing, ["confidence"]);
    assert.equal(r.notPlaced[0].inputs.confidence.why, PRIORITY_TEXT.noConfidence);
    assert.equal(r.notPlaced[0].inputs.confidence.raw, null, "not a 3, not a mean, nothing");
  });

  test("a RAID register that was never written has no exposure; one that is written and closed has an exposure of zero", () => {
    const never = full("NEVER");
    never.raid = [];                                    // nobody has ever looked
    const closed = full("CLOSED");
    closed.raid = [{ project: "CLOSED", p: 5, i: 5, status: "Closed" }];   // looked, and shut

    const r = prioritise(complete(merge(never, closed)));

    const n = r.notPlaced.find((x) => x.id === "NEVER");
    assert.equal(n.inputs.exposure.state, "N");
    assert.equal(n.inputs.exposure.raw, null);
    assert.equal(n.inputs.exposure.why, PRIORITY_TEXT.noRaidRegister);

    const c = r.ranked.find((x) => x.id === "CLOSED");
    assert.ok(c, "an empty-but-written register is a measurement, so the row IS ranked");
    assert.equal(c.inputs.exposure.state, "measured");
    assert.equal(c.inputs.exposure.raw, 0);
    assert.equal(c.inputs.exposure.open, 0);
    assert.equal(c.inputs.exposure.items, 1);
  });

  test("a project nobody is allocated to has no known capacity — and it is not zero", () => {
    const one = full("A");
    one.allocations = [];
    const r = prioritise(complete(one));
    assert.equal(r.counts.ranked, 0);
    assert.deepEqual(r.notPlaced[0].missing, ["capacity"]);
    assert.equal(r.notPlaced[0].inputs.capacity.why, PRIORITY_TEXT.noAllocation);
    assert.equal(r.notPlaced[0].fte, null);
    assert.equal(formatFte(r.notPlaced[0].fte), "—");
  });

  test("allocations that all fall outside the horizon are a real zero, because somebody did say who does the work", () => {
    const one = full("A");
    one.allocations = [{ project: "A", pct: 100, from: "2027-01-01", to: "2027-06-01" }];
    const r = prioritise(complete(one));
    assert.equal(r.counts.ranked, 1);
    assert.equal(r.ranked[0].inputs.capacity.state, "measured");
    assert.equal(r.ranked[0].fte, 0);
  });

  test("a request whose benefit is only words claims no value — prose is not a number", () => {
    const r = prioritise(complete({
      demand: [{ id: "DEM-1", title: "Ask", programme: "PR", status: "New",
                 estCost: 2, expectedBenefit: null, valueConfidence: 4,
                 estFte: 0.5, raidProbability: 2, raidImpact: 3 }],
    }));
    assert.equal(r.counts.ranked, 0);
    assert.equal(r.notPlaced[0].inputs.value.why, PRIORITY_TEXT.noDemandBenefit);
  });

  test("with no people in the book there is no capacity line, and no row is marked below one", () => {
    const r = prioritise(complete({ ...full("A"), people: [] }));
    assert.equal(r.capacity.state, "N");
    assert.equal(r.capacity.why, PRIORITY_TEXT.noPeople);
    assert.equal(r.cut.state, "N");
    assert.equal(r.cut.lastAbove, null);
    assert.equal(r.ranked[0].funded, null, "not false — there is no line to be below");
  });

  test("with every weight zero nothing is ranked, and the module says why rather than ordering on nothing", () => {
    const r = prioritise(complete({
      ...full("A"), weighting: { value: 0, confidence: 0, exposure: 0, capacity: 0 },
    }));
    assert.equal(r.weighting.state, "N");
    assert.equal(r.weighting.why, PRIORITY_TEXT.weightsZero);
    assert.equal(r.counts.ranked, 0);
    assert.equal(r.notPlaced[0].why, PRIORITY_TEXT.weightsZero);
  });

  test("a weighting nobody has looked at says so — it is applied, and it is not passed off as the group's", () => {
    const shipped = prioritise(complete(full("A")));
    assert.equal(shipped.weighting.reviewed, false);
    assert.deepEqual(
      INPUTS.map((k) => shipped.weighting[k]),
      INPUTS.map((k) => DEFAULT_WEIGHTS[k]));

    const chosen = prioritise(complete({
      ...full("A"),
      weighting: { ...DEFAULT_WEIGHTS, setBy: "R Kaur (group)", setOn: "2026-02-02", note: "why" },
    }));
    assert.equal(chosen.weighting.reviewed, true);
    assert.equal(chosen.weighting.setBy, "R Kaur (group)");
  });

  test("no money line is drawn when a ranked row carries no cost — an understated total would put the line in the wrong place", () => {
    const a = full("A"); a.projects[0].budget = 4;
    const b = full("B"); b.projects[0].budget = null;
    const r = prioritise(complete({ ...merge(a, b), envelope: 5 }));
    assert.equal(r.money.state, "N");
    assert.equal(r.money.why, PRIORITY_TEXT.costUnknown);
    assert.equal(r.money.costUnknown, 1);
    for (const row of r.ranked) assert.equal(row.cumulativeCost, null);
  });

  test("no envelope agreed means no money line, and nothing is invented in its place", () => {
    const r = prioritise(complete(full("A")));
    assert.equal(r.money.state, "N");
    assert.equal(r.money.why, PRIORITY_TEXT.noEnvelope);
    assert.equal(r.money.envelope, null);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2 · THE SCORE — every input visible, and the row rebuilds it
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-24 · the score can be rebuilt from the row", () => {

  test("the four contributions add up to the score, on every ranked row", () => {
    const r = prioritise(complete(merge(
      full("A", { benefit: 20, confidence: 5, p: 1, i: 1, pct: 20 }),
      full("B", { benefit: 5, confidence: 2, p: 5, i: 5, pct: 100 }),
      full("C", { benefit: 12, confidence: 3, p: 3, i: 2, pct: 60 }))));
    for (const row of r.ranked) {
      const sum = INPUTS.reduce((a, k) => a + row.inputs[k].contribution, 0);
      assert.ok(Math.abs(sum - row.score) < 0.35,
        `${row.id}: contributions ${sum} should rebuild the score ${row.score}`);
      for (const k of INPUTS) {
        assert.ok(row.inputs[k].points >= 0 && row.inputs[k].points <= 100);
      }
    }
  });

  test("value and confidence pull up; exposure and the people it takes push down", () => {
    const base = { benefit: 10, confidence: 3, p: 3, i: 3, pct: 50 };
    const pick = (rows, id) => rows.find((x) => x.id === id).score;

    const value = prioritise(complete(merge(full("LO", base), full("HI", { ...base, benefit: 20 }))));
    assert.ok(pick(value.ranked, "HI") > pick(value.ranked, "LO"), "more claimed value ranks higher");

    const conf = prioritise(complete(merge(full("LO", base), full("HI", { ...base, confidence: 5 }))));
    assert.ok(pick(conf.ranked, "HI") > pick(conf.ranked, "LO"), "more confidence ranks higher");

    const risk = prioritise(complete(merge(full("SAFE", base), full("RISKY", { ...base, p: 5, i: 5 }))));
    assert.ok(pick(risk.ranked, "SAFE") > pick(risk.ranked, "RISKY"), "more exposure ranks lower");

    const cost = prioritise(complete(merge(full("CHEAP", base), full("HEAVY", { ...base, pct: 100 }))));
    assert.ok(pick(cost.ranked, "CHEAP") > pick(cost.ranked, "HEAVY"), "more people ranks lower");
  });

  test("exposure is the engine's own probability × impact, and the worst OPEN item is the one that counts", () => {
    const one = full("A");
    one.raid = [
      { project: "A", p: 5, i: 5, status: "Closed" },   // shut: does not count
      { project: "A", p: 4, i: 3, status: "Open" },     // 12
      { project: "A", p: 2, i: 2, status: "Open" },     // 4
    ];
    const r = prioritise(complete(one));
    assert.equal(r.ranked[0].inputs.exposure.raw, 12);
    assert.equal(r.ranked[0].inputs.exposure.open, 2);
    assert.equal(r.ranked[0].inputs.exposure.items, 3);
  });

  test("a request and a live project are ranked on one list, against one another", () => {
    const r = prioritise(complete({
      ...full("PRJ-A", { benefit: 5, confidence: 2, p: 4, i: 4, pct: 100 }),
      demand: [{ id: "DEM-1", title: "Cheap certain win", programme: "PR", status: "New",
                 estCost: 1, expectedBenefit: 20, valueConfidence: 5,
                 estFte: 0.2, raidProbability: 1, raidImpact: 1 }],
    }));
    assert.equal(r.counts.ranked, 2);
    assert.equal(r.ranked[0].id, "DEM-1", "a cheap certain win outranks an expensive doubtful one");
    assert.equal(r.ranked[0].kind, "demand");
    assert.equal(r.ranked[1].kind, "project");
  });

  test("a converted or declined request is not a candidate — it is already counted, or already answered", () => {
    const d = (id, status) => ({ id, title: id, programme: "PR", status,
      estCost: 1, expectedBenefit: 5, valueConfidence: 3, estFte: 0.1,
      raidProbability: 1, raidImpact: 1 });
    const r = prioritise(complete({
      demand: [d("NEW", "New"), d("OK", "Approved"), d("NO", "Declined"), d("GONE", "Converted")],
    }));
    assert.deepEqual(r.ranked.map((x) => x.id).sort(), ["NEW", "OK"]);
  });

  test("a closed project competes for nothing and is not a candidate", () => {
    const one = full("DONE");
    one.projects[0].closed = true;
    const r = prioritise(complete(one));
    assert.equal(r.counts.candidates, 0);
  });

  test("the order is deterministic: score, then the larger claim, then the identifier", () => {
    // identical on every input, so only the tie-break can separate them
    const same = { benefit: 10, confidence: 3, p: 2, i: 2, pct: 50 };
    const r = prioritise(complete(merge(full("B", same), full("A", same), full("C", same))));
    assert.deepEqual(r.ranked.map((x) => x.id), ["A", "B", "C"]);
    const again = prioritise(complete(merge(full("C", same), full("A", same), full("B", same))));
    assert.deepEqual(again.ranked.map((x) => x.id), ["A", "B", "C"]);
  });

  test("the formatters return an em dash rather than inventing a number", () => {
    assert.equal(formatScore(null), "—");
    assert.equal(formatScore({ state: "N", score: null }), "—");
    assert.equal(formatFte(null), "—");
    assert.equal(formatInput("value", { state: "N", raw: null }), "—");
    assert.equal(formatInput("confidence", { state: "measured", raw: 4 }), "4/5");
    assert.equal(formatShare(null), "—");
    assert.equal(formatShare(0.4), "40%");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 · THE LINE — where the people, or the money, run out
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-24 · the capacity line", () => {

  test("the pool is the group's people at their availability, up to the ceiling it set", () => {
    const r = prioritise(complete({
      ...full("A", { pct: 50 }),
      people: [{ availability: 100 }, { availability: 50 }],   // 1.5 FTE
    }));
    assert.equal(r.capacity.pool, 1.5);
    assert.equal(r.capacity.people, 2);
    assert.equal(r.capacity.ceiling, 100);
  });

  test("capacity held by work outside the ranking is deducted before the line is drawn", () => {
    const ranked = full("IN", { pct: 50 });
    const orphan = full("OUT", { pct: 100 });
    orphan.cases = [];                       // cannot be placed, and still consumes
    const r = prioritise(complete(merge(ranked, orphan)));
    assert.equal(r.capacity.pool, 2);
    assert.equal(r.capacity.held, 1, "OUT's people are busy whether or not it was scored");
    assert.equal(r.capacity.available, 1);
  });

  test("the cut falls where the running capacity passes what is available, and the row says so", () => {
    // three rows of 1.00 FTE each against a pool of 2.00
    const a = full("A", { benefit: 30, pct: 100 });
    const b = full("B", { benefit: 20, pct: 100 });
    const c = full("C", { benefit: 10, pct: 100 });
    const r = prioritise(complete(merge(a, b, c)));

    assert.deepEqual(r.ranked.map((x) => x.id), ["A", "B", "C"]);
    assert.deepEqual(r.ranked.map((x) => x.cumulativeFte), [1, 2, 3]);
    assert.deepEqual(r.ranked.map((x) => x.funded), [true, true, false]);
    assert.equal(r.cut.state, "measured");
    assert.equal(r.cut.lastAbove, 2, "the line falls after #2");
    assert.equal(r.cut.boundBy, "capacity");
    assert.equal(r.cut.why, PRIORITY_TEXT.lineCapacity);
    assert.equal(r.cut.above, 2);
    assert.equal(r.cut.below, 1);
  });

  test("everything fitting is said as everything fitting, not as a line at the end", () => {
    const r = prioritise(complete(merge(full("A", { pct: 20 }), full("B", { pct: 20 }))));
    assert.equal(r.cut.why, PRIORITY_TEXT.everythingFits);
    assert.equal(r.cut.boundBy, null);
    assert.equal(r.cut.below, 0);
  });

  test("when work outside the ranking already eats the pool, nothing is above the line and the screen says why", () => {
    const inside = full("IN", { pct: 50 });
    const hog = full("HOG", { pct: 100 });
    const hog2 = full("HOG2", { pct: 100 });
    hog.cases = []; hog2.cases = [];                 // both unplaceable, both busy
    const r = prioritise(complete(merge(inside, hog, hog2)));
    assert.equal(r.capacity.available, 0);
    assert.equal(r.capacity.exhausted, true);
    assert.equal(r.cut.why, PRIORITY_TEXT.noCapacityLeft);
    assert.equal(r.ranked[0].funded, false);
  });

  test("the money line binds when it runs out before the people do, and the row names which", () => {
    const a = full("A", { benefit: 30, pct: 10 }); a.projects[0].budget = 4;
    const b = full("B", { benefit: 20, pct: 10 }); b.projects[0].budget = 4;
    const r = prioritise(complete({ ...merge(a, b), envelope: 5 }));
    assert.equal(r.money.state, "measured");
    assert.deepEqual(r.ranked.map((x) => x.funded), [true, false]);
    assert.equal(r.cut.boundBy, "money");
    assert.equal(r.cut.why, PRIORITY_TEXT.lineMoney);
  });

  test("a programme's list is a filter of the group's order, not a second ranking with its own line", () => {
    const a = full("A", { benefit: 30, pct: 100 });
    const b = full("B", { benefit: 20, pct: 100 });
    const c = full("C", { benefit: 10, pct: 100 });
    b.projects[0].programme = "PR2";
    const r = prioritise(complete({
      ...merge(a, b, c),
      programmes: [{ id: "PR", name: "One" }, { id: "PR2", name: "Two" }],
    }));
    const one = r.programmes.find((p) => p.id === "PR");
    const two = r.programmes.find((p) => p.id === "PR2");
    assert.deepEqual(one.ranked.map((x) => x.rank), [1, 3], "the group's ranks, kept");
    assert.deepEqual(two.ranked.map((x) => x.rank), [2]);
    assert.equal(one.ranked[1].funded, false, "and the group's line, kept");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   4 · THE ROUTES — read it, change a weight, and find it in the trail
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-24 · the ranking over the wire", () => {
  before(async () => { await boot(); });
  after(shutdown);

  test("the seeded book ranks nothing and says, row by row, exactly what is missing", async () => {
    const g = await as("groupCBP");
    const r = await g.get("/api/prioritisation");
    assert.equal(r.status, 200);
    assert.equal(r.body.counts.ranked, 0);
    assert.ok(r.body.counts.notPlaced > 0);
    for (const row of r.body.notPlaced) {
      assert.ok(row.missing.length, "a not-placed row names what it is missing");
      for (const k of row.missing) assert.ok(row.inputs[k].why, `${row.id}.${k} says why`);
    }
    assert.equal(r.body.weighting.reviewed, false, "nobody has reviewed the shipped weights yet");
  });

  test("a project reaches the order once its four inputs exist, and leaves it when one is withdrawn", async () => {
    const admin = await as("admin");
    const before = await admin.get("/api/prioritisation");
    const wasRanked = before.body.ranked.length;

    const put = await admin.put(`/api/projects/${GROUP_PROJECT}/case`, {
      summary: "Card scheme mandate: the alternative is a fine.",
      expectedCost: 8, expectedBenefit: 14, valueConfidence: 4,
    });
    assert.ok([200, 201].includes(put.status), put.text);

    const after = await admin.get("/api/prioritisation");
    const row = after.body.ranked.find((x) => x.id === GROUP_PROJECT);
    assert.ok(row, "it is now in the order");
    assert.equal(after.body.ranked.length, wasRanked + 1);
    assert.equal(row.inputs.value.raw, 14);
    assert.equal(row.inputs.confidence.raw, 4);
    assert.equal(row.inputs.value.source, PRIORITY_TEXT.valueFromCase);

    /* Withdrawing the confidence takes it back OUT of the order — it does
       not leave it ranked on a number nobody stands behind any more. */
    const bc = after.body.ranked.find((x) => x.id === GROUP_PROJECT);
    assert.ok(bc);
    const book = await admin.get("/api/bootstrap");
    const cs = book.body.db.businessCases.find((c) => c.project === GROUP_PROJECT);
    const drop = await admin.put(`/api/projects/${GROUP_PROJECT}/case`, {
      summary: cs.summary, expectedCost: cs.expectedCost,
      expectedBenefit: cs.expectedBenefit, valueConfidence: "", version: cs.version,
    });
    assert.equal(drop.status, 200, drop.text);
    const back = await admin.get("/api/prioritisation");
    const gone = back.body.notPlaced.find((x) => x.id === GROUP_PROJECT);
    assert.ok(gone, "out of the order again");
    assert.deepEqual(gone.missing, ["confidence"]);
  });

  test("a request carries the four inputs, and they survive the round trip", async () => {
    const g = await as("groupCBP");
    const made = await g.post("/api/demand", {
      title: "Second X-ray line", benefitNote: "throughput",
      estCost: 2, expectedBenefit: 6, valueConfidence: 3,
      estFte: 0.75, raidProbability: 2, raidImpact: 4,
    });
    assert.equal(made.status, 201, made.text);
    const list = await g.get("/api/demand");
    const d = list.body.demand.find((x) => x.id === made.body.id);
    assert.equal(d.expectedBenefit, 6);
    assert.equal(d.valueConfidence, 3);
    assert.equal(d.estFte, 0.75);
    assert.equal(d.raidProbability, 2);
    assert.equal(d.raidImpact, 4);

    const rank = await g.get("/api/prioritisation");
    const row = [...rank.body.ranked, ...rank.body.notPlaced].find((x) => x.id === d.id);
    assert.ok(row, "and it is a candidate for the group's capacity");
    assert.equal(row.inputs.exposure.raw, 8, "probability × impact, the engine's own");
  });

  test("a confidence outside 1–5 is refused rather than quietly clamped", async () => {
    const g = await as("groupCBP");
    const r = await g.post("/api/demand", { title: "Bad", valueConfidence: 9 });
    assert.equal(r.status, 400);
    assert.match(r.body.error ?? r.text, /1 to 5/);
  });

  test("converting an approved request carries its claimed value and its confidence onto the case", async () => {
    const g = await as("groupCBP");
    const made = await g.post("/api/demand", {
      title: "Weighbridge replacement", benefitNote: "less queueing",
      estCost: 3, expectedBenefit: 9, valueConfidence: 4,
    });
    const d0 = (await g.get("/api/demand")).body.demand.find((x) => x.id === made.body.id);
    const ok = await g.patch(`/api/demand/${made.body.id}`, {
      status: "Approved", decisionNote: "Fits the plan", version: d0.version });
    assert.equal(ok.status, 200, ok.text);
    const conv = await g.post(`/api/demand/${made.body.id}/convert`, {
      name: "Weighbridge replacement", programme: "CBP", site: "KRK",
      start: "2026-09-01", finish: "2027-03-01" });
    assert.equal(conv.status, 201, conv.text);

    const book = await g.get("/api/bootstrap");
    const bc = book.body.db.businessCases.find((c) => c.project === conv.body.id);
    assert.ok(bc, "the conversion writes a case");
    assert.equal(bc.expectedBenefit, 9, "the number came across, not only the words");
    assert.equal(bc.valueConfidence, 4);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   5 · THE WEIGHTING — who may set it, and what the trail keeps
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-24 · changing a weight re-ranks, and is audited", () => {
  before(async () => { await boot(); });
  after(shutdown);

  /** Two projects that swap places when value stops outweighing capacity. */
  async function twoRankedProjects(admin) {
    await admin.put("/api/projects/PRJ-101/case", {
      summary: "Big claim, heavy team.", expectedCost: 9,
      expectedBenefit: 40, valueConfidence: 3 });
    await admin.put("/api/projects/PRJ-112/case", {
      summary: "Small claim, light team.", expectedCost: 2,
      expectedBenefit: 4, valueConfidence: 5 });
  }

  test("only group level may set the weighting — a site lead is refused, and told whose call it is", async () => {
    const site = await as("siteGRU");
    const r = await site.patch("/api/prioritisation/weighting", { value: 90, note: "mine" });
    assert.equal(r.status, 403);
    assert.match(r.body.error ?? r.text, /answers for the cut it draws/);
  });

  test("a viewer is refused it too, like every other write", async () => {
    const v = await as("viewerGRU");
    const r = await v.patch("/api/prioritisation/weighting", { value: 90, note: "mine" });
    assert.equal(r.status, 403);
  });

  test("a weighting with no reason is refused — an order whose reason is not written is a verdict", async () => {
    const g = await as("groupCBP");
    const w = (await g.get("/api/prioritisation")).body.weighting;
    const r = await g.patch("/api/prioritisation/weighting", {
      value: 50, version: w.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error ?? r.text, /Say why these weights/);
  });

  test("every weight zero is refused — a weighting has to weigh something", async () => {
    const g = await as("groupCBP");
    const w = (await g.get("/api/prioritisation")).body.weighting;
    const r = await g.patch("/api/prioritisation/weighting", {
      value: 0, confidence: 0, exposure: 0, capacity: 0,
      note: "nothing matters", version: w.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error ?? r.text, /weigh something/);
  });

  test("changing a weight re-ranks immediately, and the audit says what it was and what it became", async () => {
    const admin = await as("admin");
    await twoRankedProjects(admin);
    const g = await as("groupCBP");

    const before = (await g.get("/api/prioritisation")).body;
    const order = before.ranked.map((x) => x.id);
    assert.deepEqual(order.slice(0, 2), ["PRJ-101", "PRJ-112"],
      "value at 40 puts the big claim first");
    assert.equal(before.weighting.value, 40);

    const set = await g.patch("/api/prioritisation/weighting", {
      value: 0, confidence: 50, exposure: 0, capacity: 50,
      note: "This year we buy certainty and cheapness, not size.",
      version: before.weighting.version });
    assert.equal(set.status, 200, set.text);

    const after = (await g.get("/api/prioritisation")).body;
    assert.equal(after.weighting.value, 0);
    assert.equal(after.weighting.confidence, 50);
    assert.equal(after.weighting.reviewed, true, "and it is no longer the shipped default");
    assert.equal(after.weighting.setBy.includes("group"), true);
    assert.notDeepEqual(after.ranked.map((x) => x.id).slice(0, 2), order.slice(0, 2),
      "the order moved because the weights moved");
    assert.equal(after.ranked[0].id, "PRJ-112");

    /* The point of the exercise: six months later, the only thing that
       can explain a rank that moved is this row. */
    const trail = await g.get("/api/audit?limit=20");
    assert.equal(trail.status, 200);
    const row = trail.body.events.find((e) => e.action === "Prioritisation weighting set");
    assert.ok(row, "the change is in the trail");
    assert.match(row.detail, /value 40 → 0/);
    assert.match(row.detail, /confidence 20 → 50/);
    /* Both drivers already decode jsonb; a plain JSON string round-trips
       as a bare string. Same rule as `jsonValue` in the serialiser. */
    const img = (v) => (typeof v === "string" ? JSON.parse(v) : v);
    const was = img(row.before_json), became = img(row.after_json);
    assert.equal(was.value, 40);
    assert.equal(became.value, 0);
    assert.equal(became.note, "This year we buy certainty and cheapness, not size.");
  });

  test("a stale version is refused, like every other mutable row", async () => {
    const g = await as("groupCBP");
    const w = (await g.get("/api/prioritisation")).body.weighting;
    const r = await g.patch("/api/prioritisation/weighting", {
      value: 10, note: "again", version: w.version - 1 });
    assert.equal(r.status, 409);
  });

  test("a weight outside 0–100 is refused rather than clamped", async () => {
    const g = await as("groupCBP");
    const w = (await g.get("/api/prioritisation")).body.weighting;
    const r = await g.patch("/api/prioritisation/weighting", {
      value: 140, note: "louder", version: w.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error ?? r.text, /whole number from 0 to 100/);
  });

  test("a viewer may READ the ranking — it discloses nothing the pipeline page did not", async () => {
    const v = await as("viewerGRU");
    const r = await v.get("/api/prioritisation");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.ranked));
  });
});

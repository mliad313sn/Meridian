/**
 * FX-12 (docs/41) — PORTFOLIO SCENARIOS.
 *
 *   1. The arithmetic, proved by hand on a book small enough to hold in
 *      the head: what a shift moves, what a cancel releases, what the
 *      envelope line and the monthly capacity become.
 *   2. D-41.02 — S9's test: create, edit, compute and compare a scenario,
 *      and every live table holds exactly what it held (row count AND
 *      content), with no audit row about any live entity.
 *   3. D-41.01 — no existing number moves: Engine.metrics for every
 *      project, Engine.roll and Engine.criticalPath on the seeded book are
 *      deep-equal before and after, and a scenario with no change puts
 *      the live book beside itself.
 *   4. The promotion: no decision → refused; a proposed one → refused; a
 *      decision ratified by the scenario's author → refused; a change the
 *      account could not make by hand → refused; a live row moved since →
 *      409 naming it; the happy path writes each change as its own
 *      audited mutation.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { many, one, query } from "../src/db.js";
import { Engine } from "../../shared/engine.js";
import { can, canApplyScenario } from "../../shared/rbac.js";
import { moveSpan, moveDate, applyScenario, position, compareScenario } from "../../shared/scenario.js";

/* ══════════════════════════════════════════════════════════════════
   1 · the arithmetic, by hand
   ══════════════════════════════════════════════════════════════════ */

const AS_AT = "2026-08-28";   // a Friday; its week starts Monday 24 August

/** Two projects, one person, one allocation — every number below is
    worked out from this and nothing else. */
function fixture() {
  return {
    statusDate: AS_AT,
    settings: { autoRag: true, amberSpi: 0.95, redSpi: 0.9, amberCpi: 0.95, redCpi: 0.9,
                capacityCeiling: 100, capexEnvelope: 10 },
    programmes: [{ id: "PG", name: "Programme" }], sites: [{ id: "S" }],
    people: [{ id: "PE-1", name: "A. Person", site: "S", availability: 100 }],
    projects: [
      // not started: fit 4, value 4, risk 2, effort 2 → V-04 score 4+4+4+4 = 16
      { id: "P1", name: "Alpha", programme: "PG", site: "S", start: "2026-09-01", finish: "2026-12-31",
        baselineFinish: "2026-12-31", budget: 6, contingency: 0, contingencyUsed: 0, closed: false,
        fit: 4, value: 4, risk: 2, effort: 2, rank: null, version: 3 },
      // under way, unscored (sorts after P1), 2 M already spent
      { id: "P2", name: "Beta", programme: "PG", site: "S", start: "2026-06-01", finish: "2026-10-31",
        baselineFinish: "2026-10-31", budget: 5, contingency: 0, contingencyUsed: 0, closed: false,
        fit: null, value: null, risk: null, effort: null, rank: null, version: 7 },
    ],
    activities: [
      { id: "A1", project: "P1", start: "2026-09-01", end: "2026-10-01", baseStart: "2026-09-01",
        baseEnd: "2026-10-01", weight: 1, pct: 0, deps: [], version: 1 },
      { id: "A2", project: "P2", start: "2026-06-01", end: "2026-10-31", baseStart: "2026-06-01",
        baseEnd: "2026-10-31", weight: 1, pct: 50, deps: [], version: 1 },
    ],
    milestones: [{ id: "M1", project: "P1", date: "2026-12-31", done: false, version: 1 }],
    ledger: [{ project: "P2", amount: 2 }],
    allocations: [{ id: "1", person: "PE-1", project: "P1", from: "2026-09-01", to: "2026-09-30", pct: 100, version: 1 }],
    benefits: [{ id: "B1", project: "P1", title: "Faster onboarding", realiseOn: "2027-01-31",
                 status: "Forecast", actual: null, unit: "days", target: 3, version: 1 }],
    businessCases: [], raid: [], commitments: [],
  };
}

describe("FX-12 · what a shift moves (worked by hand)", () => {
  test("a row not started moves whole: 1 → 10 Sep, +2 weeks, is 15 → 24 Sep", () => {
    assert.deepEqual(moveSpan("2026-09-01", "2026-09-10", 14, AS_AT), { start: "2026-09-15", end: "2026-09-24" });
  });
  test("a row under way keeps its start and moves its end: 1 Aug → 10 Sep, +2 weeks, ends 24 Sep", () => {
    assert.deepEqual(moveSpan("2026-08-01", "2026-09-10", 14, AS_AT), { start: "2026-08-01", end: "2026-09-24" });
  });
  test("a row that ended before the status date is history, and stays", () => {
    assert.equal(moveSpan("2026-07-01", "2026-08-01", 14, AS_AT), null);
  });
  test("an acceleration never makes work start before the status date: 10 → 20 Sep, −4 weeks, is 28 Aug → 7 Sep", () => {
    // −28 days would start it on 13 Aug; it is held at 28 Aug (−13 days) and keeps its 10 days
    assert.deepEqual(moveSpan("2026-09-10", "2026-09-20", -28, AS_AT), { start: "2026-08-28", end: "2026-09-07" });
  });
  test("a date under the same rule: a milestone on 31 Dec, +4 weeks, is 28 Jan", () => {
    assert.equal(moveDate("2026-12-31", 28, AS_AT), "2027-01-28");
    assert.equal(moveDate("2026-08-01", 28, AS_AT), null, "a past date does not move");
  });
});

describe("FX-12 · the comparison, worked by hand on a two-project book", () => {
  const book = () => ({ db: fixture(), weighting: { value: 40, confidence: 20, exposure: 20, capacity: 20, version: 1 }, demand: [] });

  test("the envelope line: 10 M against 6 + 5 = 11 M demanded — P1 inside, P2 outside, 1 M over", () => {
    const pos = position(fixture(), {});
    assert.equal(pos.totals.envelope, 10);
    assert.equal(pos.totals.demanded, 11);
    assert.equal(pos.totals.headroom, -1);
    assert.equal(pos.projects.find((p) => p.id === "P1").inEnvelope, true);
    assert.equal(pos.projects.find((p) => p.id === "P2").inEnvelope, false);
  });

  test("cancel P2: its budget falls to the 2 M spent, it leaves the queue, and the envelope has 4 M of room", () => {
    const cmp = compareScenario(book(), [{ id: "C1", seq: 0, kind: "cancel", project: "P2" }]);
    assert.equal(cmp.totals.scenario.demanded, 6);
    assert.equal(cmp.totals.scenario.headroom, 4);
    assert.equal(cmp.totals.delta.headroom, 5);
    assert.equal(cmp.totals.scenario.sunk, 2);
    assert.equal(cmp.totals.scenario.bac, 6, "the roll-up counts what still runs");
    const p2 = cmp.rows.find((r) => r.id === "P2");
    assert.equal(p2.scenario.state, "Cancelled");
    assert.equal(p2.scenario.budget, 2);
    assert.deepEqual(cmp.plan[0].mutations, [
      { entity: "project", id: "P2", version: 7, set: { budget: 2 }, before: { budget: 5 } },
    ]);
  });

  test("shift P1 by +4 weeks: every open row of P1 moves 28 days, the baseline does not", () => {
    const cmp = compareScenario(book(), [{ id: "C1", seq: 0, kind: "shift", project: "P1", weeks: 4 }]);
    const p1 = cmp.rows.find((r) => r.id === "P1");
    assert.equal(p1.delta.finishDays, 28);
    assert.equal(p1.scenario.finish, "2027-01-28");
    const m = Object.fromEntries(cmp.plan[0].mutations.map((x) => [x.entity + ":" + x.id, x.set]));
    assert.deepEqual(m, {
      "project:P1": { start: "2026-09-29", finish: "2027-01-28" },
      "activity:A1": { start: "2026-09-29", end: "2026-10-29" },
      "milestone:M1": { date: "2027-01-28" },
      "allocation:1": { from: "2026-09-29", to: "2026-10-28" },
      "benefit:B1": { realiseOn: "2027-02-28" },
    });
    assert.deepEqual(cmp.benefits, [{ id: "B1", project: "P1", title: "Faster onboarding",
      live: "2027-01-31", scenario: "2027-02-28", withdrawn: false, days: 28 }]);
  });

  /* The engine's weekly load (weeks start on Monday), folded by the month
     each week starts in. 100 % from 1 to 30 Sep is active in the weeks of
     31 Aug, 7, 14, 21 and 28 Sep: August (24 Aug idle, 31 Aug busy) is
     0.5 FTE, September (four busy weeks) 1.0. Moved to 29 Sep → 28 Oct,
     only the week of 28 Sep is busy in September (0.25), and all four
     October weeks are (1.0). */
  test("capacity by month: Aug 0.5 → 0, Sep 1.0 → 0.25, Oct 0 → 1.0 FTE", () => {
    const cmp = compareScenario(book(), [{ id: "C1", seq: 0, kind: "shift", project: "P1", weeks: 4 }]);
    const by = Object.fromEntries(cmp.capacity.map((c) => [c.month, [c.live, c.scenario]]));
    assert.deepEqual(by["2026-08"], [0.5, 0]);
    assert.deepEqual(by["2026-09"], [1, 0.25]);
    assert.deepEqual(by["2026-10"], [0, 1]);
    assert.equal(cmp.capacity[0].pool, 1, "one person at 100 % availability under a 100 % ceiling");
  });

  test("the envelope and a budget are levers too: envelope 12, P1 at 4 → 9 demanded, 3 of room", () => {
    const cmp = compareScenario(book(), [
      { id: "C1", seq: 0, kind: "envelope", amount: 12 },
      { id: "C2", seq: 1, kind: "budget", project: "P1", amount: 4 },
    ]);
    assert.equal(cmp.totals.scenario.envelope, 12);
    assert.equal(cmp.totals.scenario.demanded, 9);
    assert.equal(cmp.totals.scenario.headroom, 3);
    assert.equal(cmp.rows.find((r) => r.id === "P2").scenario.inEnvelope, true, "P2 now fits under the line");
  });

  test("D-41.02 · the book passed in is not touched by the computation", () => {
    const b = book();
    const frozen = JSON.stringify(b);
    compareScenario(b, [
      { id: "C1", seq: 0, kind: "shift", project: "P1", weeks: 4 },
      { id: "C2", seq: 1, kind: "cancel", project: "P2" },
      { id: "C3", seq: 2, kind: "envelope", amount: 3 },
      { id: "C4", seq: 3, kind: "weight", input: "value", weight: 90 },
    ]);
    assert.equal(JSON.stringify(b), frozen);
  });

  test("a change on a closed or unknown project is named, not applied", () => {
    const b = book();
    b.db.projects[1].closed = true;
    const s = applyScenario(b, [{ id: "C1", kind: "cancel", project: "P2" }, { id: "C2", kind: "shift", project: "NOPE", weeks: 1 }]);
    assert.deepEqual(s.plan.map((p) => p.issue), ["closed", "not-in-book"]);
  });
});

describe("FX-12 · the rules live in shared/rbac.js", () => {
  const mk = (role, programmes = []) => ({ id: "U", role, active: true, personId: "PE-9",
    grants: { programmes: new Set(programmes), sites: new Set(), reviews: { programmes: new Set(), projects: new Set() } } });
  test("scenario.read / write / apply are group level: a site account and a viewer get none of them", () => {
    for (const a of ["scenario.read", "scenario.write", "scenario.apply"]) {
      assert.equal(can(mk("group"), a).ok, true, a);
      assert.equal(can(mk("admin"), a).ok, true, a);
      assert.equal(can(mk("site"), a).ok, false, a);
      assert.equal(can(mk("viewer"), a).ok, false, a);
    }
  });
  test("canApplyScenario: no decision, a proposed one, a dependent ratifier, the author as ratifier — each refused", () => {
    const g = mk("group", ["CBP"]);
    assert.equal(canApplyScenario(g, {}).code, 409);
    assert.equal(canApplyScenario(g, { decision: { id: "D", status: "Proposed" } }).code, 409);
    const self = canApplyScenario(g, { decision: { id: "D", status: "Ratified", decidedBy: "PE-1", ratifiedBy: "PE-1" } });
    assert.equal(self.code, 403);
    const nobody = canApplyScenario(g, { decision: { id: "D", status: "Ratified", decidedBy: "PE-1", ratifiedBy: null } });
    assert.equal(nobody.code, 403, "a decision born Ratified with no ratifier named was not ratified by anyone");
    const author = canApplyScenario(g, { authorPerson: "PE-2",
      decision: { id: "D", status: "Ratified", decidedBy: "PE-1", ratifiedBy: "PE-2" } });
    assert.equal(author.code, 403);
    const ok = canApplyScenario(g, { authorPerson: "PE-3",
      decision: { id: "D", status: "Ratified", decidedBy: "PE-1", ratifiedBy: "PE-2" } });
    assert.equal(ok.ok, true);
  });
  test("each change is held to its own action: an envelope needs settings.write, a project outside the grant is refused", () => {
    const g = mk("group", ["CBP"]);
    const d = { id: "D", status: "Ratified", decidedBy: "PE-1", ratifiedBy: "PE-2" };
    const env = canApplyScenario(g, { decision: d, changes: [{ id: "C", kind: "envelope" }] });
    assert.equal(env.ok, false);
    assert.match(env.why, /settings\.write/);
    const far = canApplyScenario(g, { decision: d, changes: [{ id: "C", kind: "shift",
      project: { id: "PX", programme_id: "DCH", site_id: "LIS", governance_level: "group" } }] });
    assert.equal(far.ok, false);
    assert.match(far.why, /project\.write/);
  });
});

/* ══════════════════════════════════════════════════════════════════
   2–4 · against the seeded book, through the API
   ══════════════════════════════════════════════════════════════════ */

describe("FX-12 · through the API", () => {
  let admin, cbp, dch, site;
  before(async () => {
    await boot();
    admin = await as("admin");
    cbp = await as("groupCBP");      // E. Lindqvist, PE-15, programmes CBP + EIT
    dch = await as("groupDCH");      // P. Marchetti, PE-16, programme DCH
    site = await as("siteGRU");
  });
  after(shutdown);

  /* Every table of the schema, with a content digest. `session` and
     `usage_daily` are the two that a READ moves — who is signed in, and
     the adoption counter that counts screens opened (A-08) — neither is
     the book, and both move on any GET. The audit trail is compared by
     entity: a scenario's own rows are expected, nothing else is. */
  const MOVED_BY_READING = new Set(["session", "usage_daily"]);
  const SCENARIO_TABLES = new Set(["scenario", "scenario_change", "id_counter"]);
  async function liveState() {
    const tables = (await many(
      `SELECT table_name AS t FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)).map((r) => r.t);
    const out = {};
    for (const t of tables) {
      if (MOVED_BY_READING.has(t) || SCENARIO_TABLES.has(t) || t === "audit_event") continue;
      const r = await one(`SELECT count(*)::int AS n, md5(COALESCE(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM ${t} x`);
      out[t] = `${r.n}:${r.h}`;
    }
    const a = await one(`SELECT count(*)::int AS n FROM audit_event
                          WHERE entity NOT IN ('scenario', 'scenario_change')`);
    out["audit_event (live entities)"] = a.n;
    return out;
  }

  async function engineNumbers(client) {
    const db = (await client.get("/api/bootstrap")).body.db;
    return {
      metrics: db.projects.map((p) => Engine.metrics(db, p.id)),
      roll: Engine.roll(db, db.projects),
      critical: db.projects.map((p) => {
        const c = Engine.criticalPath(db, p.id);
        return { ...c, critical: [...c.critical].sort() };
      }),
    };
  }

  let scnA = null;
  test("D-41.02 · create, edit, compute and compare a scenario: no live table and no live audit row moves", async () => {
    const before_ = await liveState();
    const numbers = await engineNumbers(cbp);

    const created = await cbp.post("/api/scenarios", { name: "Defer the payments core a quarter", note: "S2's question" });
    assert.equal(created.status, 201, created.text);
    scnA = created.body.id;
    const list0 = (await cbp.get("/api/scenarios")).body.scenarios;
    const s0 = list0.find((x) => x.id === scnA);
    assert.equal((await cbp.patch("/api/scenarios/" + scnA, { note: "Edited", version: s0.version })).status, 200);

    for (const c of [
      { kind: "shift", project: "PRJ-101", weeks: 13 },
      { kind: "cancel", project: "PRJ-104" },
      { kind: "budget", project: "PRJ-107", amount: 7.5 },
      { kind: "envelope", amount: 30 },
      { kind: "weight", input: "value", weight: 60 },
    ]) {
      const r = await cbp.post(`/api/scenarios/${scnA}/changes`, c);
      assert.equal(r.status, 201, `${c.kind}: ${r.text}`);
    }
    const s1 = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === scnA);
    const shift = s1.changes.find((c) => c.kind === "shift");
    assert.equal((await cbp.patch("/api/scenario-changes/" + shift.id, { weeks: 12, version: shift.version })).status, 200);

    const cmp = await cbp.get(`/api/scenarios/${scnA}/compare`);
    assert.equal(cmp.status, 200, cmp.text);
    assert.ok(cmp.body.changed >= 3, "the comparison sees the changes");
    const row101 = cmp.body.rows.find((r) => r.id === "PRJ-101");
    assert.equal(row101.delta.finishDays, 84, "12 weeks later");
    assert.equal(cmp.body.totals.scenario.envelope, 30);
    assert.equal(cmp.body.rows.find((r) => r.id === "PRJ-104").scenario.state, "Cancelled");

    assert.deepEqual(await liveState(), before_, "a scenario never writes the live book");
    assert.deepEqual(await engineNumbers(cbp), numbers, "D-41.01 — no existing number moved");
    const own = await many(`SELECT action FROM audit_event WHERE entity IN ('scenario', 'scenario_change') ORDER BY id`);
    assert.ok(own.length >= 8, "the scenario's own work is on the trail");
  });

  test("D-41.01 · a scenario with no change puts the live book beside itself", async () => {
    const r = await cbp.post("/api/scenarios", { name: "Nothing changes" });
    const cmp = (await cbp.get(`/api/scenarios/${r.body.id}/compare`)).body;
    assert.equal(cmp.changed, 0);
    assert.deepEqual(cmp.totals.live, cmp.totals.scenario);
    for (const row of cmp.rows) assert.deepEqual(row.live, row.scenario, row.id);
    assert.equal((await cbp.del("/api/scenarios/" + r.body.id)).status, 200, "a Draft nobody decided on is removed");
  });

  test("a site account and a viewer see no scenario and write none", async () => {
    assert.equal((await site.get("/api/scenarios")).status, 403);
    assert.equal((await site.post("/api/scenarios", { name: "x" })).status, 403);
    const viewer = await as("viewerLIS");
    assert.equal((await viewer.get("/api/scenarios")).status, 403);
    assert.equal((await viewer.get(`/api/scenarios/${scnA}/compare`)).status, 403);
  });

  /* A scenario to promote: one shift of a CBP project, written by CBP. */
  let scnB, decB;
  test("apply without a decision is refused, 409, with the reason", async () => {
    scnB = (await cbp.post("/api/scenarios", { name: "Defer PRJ-101 four weeks" })).body.id;
    assert.equal((await cbp.post(`/api/scenarios/${scnB}/changes`, { kind: "shift", project: "PRJ-101", weeks: 4 })).status, 201);
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === scnB);
    const r = await cbp.post(`/api/scenarios/${scnB}/apply`, { version: s.version });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /no decision/i);
  });

  test("recording the decision freezes the scenario; a proposed decision does not apply it", async () => {
    const d = await cbp.post("/api/decisions", { headline: "Defer PRJ-101 four weeks", rationale: "Make room",
      decidedBy: "PE-15", status: "Proposed", scenarioId: scnB });
    assert.equal(d.status, 201, d.text);
    decB = d.body.id;
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === scnB);
    assert.equal(s.status, "Proposed");
    assert.deepEqual(s.decisions.map((x) => x.id), [decB]);
    const edit = await cbp.post(`/api/scenarios/${scnB}/changes`, { kind: "shift", project: "PRJ-125", weeks: 1 });
    assert.equal(edit.status, 409, "what is decided is what will be applied");
    const r = await cbp.post(`/api/scenarios/${scnB}/apply`, { version: s.version });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Proposed/);
    const log = (await cbp.get("/api/decisions/log")).body.minuted.find((x) => x.id === decB);
    assert.equal(log.scenario, scnB, "the register names the scenario");
  });

  test("the decider does not ratify it (REQ-49); someone independent does, and the author applies it", async () => {
    assert.equal((await cbp.post(`/api/decisions/${decB}/ratify`, { version: 1 })).status, 403);
    const rat = await dch.post(`/api/decisions/${decB}/ratify`, { version: 1 });
    assert.equal(rat.status, 200, rat.text);

    const before_ = await one(`SELECT finish_date, row_version FROM project WHERE id = 'PRJ-101'`);
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === scnB);
    const r = await cbp.post(`/api/scenarios/${scnB}/apply`, { version: s.version });
    assert.equal(r.status, 200, r.text);
    const after_ = await one(`SELECT finish_date, row_version FROM project WHERE id = 'PRJ-101'`);
    const days = (new Date(after_.finish_date) - new Date(before_.finish_date)) / 86400000;
    assert.equal(days, 28, "the live finish moved four weeks");
    assert.equal(after_.row_version, before_.row_version + 1, "under row_version");
    const audit = await many(`SELECT action, entity, entity_id, detail FROM audit_event
                               WHERE action = 'Scenario change applied' AND entity_id = 'PRJ-101'`);
    assert.equal(audit.length, 1);
    assert.match(audit[0].detail, new RegExp(`${scnB}.*${decB}`));
    const again = await cbp.post(`/api/scenarios/${scnB}/apply`, { version: r.body.version });
    assert.equal(again.status, 409, "applied once");
  });

  test("a decision ratified by the scenario's own author does not promote it", async () => {
    const id = (await dch.post("/api/scenarios", { name: "Marchetti's what-if" })).body.id;
    await dch.post(`/api/scenarios/${id}/changes`, { kind: "shift", project: "PRJ-101", weeks: 2 });
    const d = (await cbp.post("/api/decisions", { headline: "Defer again", decidedBy: "PE-15",
      status: "Proposed", scenarioId: id })).body.id;
    assert.equal((await dch.post(`/api/decisions/${d}/ratify`, { version: 1 })).status, 200,
      "the register lets the author ratify: they neither decided nor recorded it");
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === id);
    const r = await cbp.post(`/api/scenarios/${id}/apply`, { version: s.version });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /author/);
  });

  test("a change the account could not make by hand is refused by name", async () => {
    const id = (await cbp.post("/api/scenarios", { name: "Raise the envelope" })).body.id;
    await cbp.post(`/api/scenarios/${id}/changes`, { kind: "envelope", amount: 50 });
    const d = (await cbp.post("/api/decisions", { headline: "Raise the envelope", decidedBy: "PE-15",
      status: "Proposed", scenarioId: id })).body.id;
    await dch.post(`/api/decisions/${d}/ratify`, { version: 1 });
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === id);
    const r = await cbp.post(`/api/scenarios/${id}/apply`, { version: s.version });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /settings\.write/);
    const ok = await admin.post(`/api/scenarios/${id}/apply`, { version: s.version });
    assert.equal(ok.status, 200, ok.text);
    const env = await one(`SELECT value FROM app_setting WHERE key = 'capexEnvelope'`);
    assert.equal(Number(typeof env.value === "string" ? JSON.parse(env.value) : env.value), 50);
  });

  test("a live row moved since the change was written is a 409 that names it", async () => {
    const id = (await cbp.post("/api/scenarios", { name: "Trim PRJ-125" })).body.id;
    await cbp.post(`/api/scenarios/${id}/changes`, { kind: "budget", project: "PRJ-125", amount: 1 });
    const d = (await cbp.post("/api/decisions", { headline: "Trim PRJ-125", decidedBy: "PE-15",
      status: "Proposed", scenarioId: id })).body.id;
    await dch.post(`/api/decisions/${d}/ratify`, { version: 1 });
    const p = await one(`SELECT row_version FROM project WHERE id = 'PRJ-125'`);
    assert.equal((await admin.patch("/api/projects/PRJ-125", { desc: "edited meanwhile", version: p.row_version })).status, 200);
    const s = (await cbp.get("/api/scenarios")).body.scenarios.find((x) => x.id === id);
    const r = await cbp.post(`/api/scenarios/${id}/apply`, { version: s.version });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /PRJ-125/);
    const w = await cbp.post(`/api/scenarios/${id}/withdraw`, { version: s.version });
    assert.equal(w.status, 200, "a scenario that will not be applied is withdrawn, and stays on the record");
    assert.equal((await cbp.del("/api/scenarios/" + id)).status, 409, "a decision names it: not deleted");
  });
});

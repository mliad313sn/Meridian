/**
 * NEW-04 (docs/36) · KODO's registers have a write route.
 *
 * Requirements (MER-03), evidence (MER-11), findings (MER-05), seats and
 * their incompatibilities (MER-06), objections (MER-07) — and the three
 * decision fields and the gate-bound cadence the meetings route wrote or
 * refused and no screen showed (MER-07, MER-10).
 *
 * Each register is walked the way goal.md §F3 asks: create → read back →
 * update every field → read back → remove or reverse → read back. Then
 * the authority each one was given in shared/rbac.js, and KODO's rules,
 * quoted from its report:
 *   « a finding closes on re-test evidence, never on a merged fix »
 *   « a waiver needs a reason »
 *   « a constraint that refuses a person holding two incompatible seats »
 *   « a proposal carries unless a seat records a reasoned objection »
 *   « canAdvance returns false while any veto-holding seat has an open
 *     objection in the gate's domain »
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, SITE_PROJECT_GRU, GROUP_PROJECT } from "./harness.js";
import { one } from "../src/db.js";
import { Engine } from "../../shared/engine.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

const book = async (c) => (await c.get("/api/bootstrap")).body.db;
const find = async (c, coll, id) => (await book(c))[coll].find((x) => x.id === id);

/* PRJ-136 is a site-governed project at GRU, in programme DCH: Silva (site
   GRU) delivers it, Marchetti (group, DCH) is the programme office above
   it, Mbeki is a GRU viewer. */
const P = SITE_PROJECT_GRU;

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-03 · a requirement is stated, corrected, waived and removed from a session", () => {
  let id;
  test("create → read back", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post("/api/requirements", {
      project: P, statement: "A PIX payment settles within 10 s", source: "BACEN Res. 1/2020 art. 4",
      priority: "S", verification: "Load test at 50 tps", gate: 2, owner: "PE-19",
    });
    assert.equal(r.status, 201, r.text);
    id = r.body.id;
    const q = await find(silva, "requirements", id);
    assert.equal(q.statement, "A PIX payment settles within 10 s");
    assert.equal(q.source, "BACEN Res. 1/2020 art. 4");
    assert.equal(q.priority, "S");
    assert.equal(q.verification, "Load test at 50 tps");
    assert.equal(q.verifiedBy, "", "the method promised is not the proof produced");
    assert.equal(q.gate, 2);
    assert.equal(q.owner, "PE-19");
    assert.equal(q.status, "Not started");
    assert.equal(q.version, 1);
  });

  test("update every field → read back; Done names its proof, not its method", async () => {
    const silva = await as("siteGRU");
    let q = await find(silva, "requirements", id);
    const early = await silva.patch("/api/requirements/" + id, { status: "Done", version: q.version });
    assert.equal(early.status, 400, "Done with only a method is a requirement declared verified because someone wrote how it would be");
    assert.match(early.body.error, /Verified by/);
    const r = await silva.patch("/api/requirements/" + id, {
      statement: "A PIX payment settles within 8 s", source: "BACEN Res. 1/2020 art. 5", priority: "M",
      verification: "Load test at 80 tps", verifiedBy: "run:perf-2026-09-01#412", gate: 3,
      owner: "PE-16", status: "Done", version: q.version,
    });
    assert.equal(r.status, 200, r.text);
    q = await find(silva, "requirements", id);
    assert.deepEqual(
      [q.statement, q.source, q.priority, q.verification, q.verifiedBy, q.gate, q.owner, q.status, q.version],
      ["A PIX payment settles within 8 s", "BACEN Res. 1/2020 art. 5", "M", "Load test at 80 tps",
       "run:perf-2026-09-01#412", 3, "PE-16", "Done", 2]);
    const stale = await silva.patch("/api/requirements/" + id, { priority: "C", version: 1 });
    assert.equal(stale.status, 409, "row_version is asserted");
    const none = await silva.patch("/api/requirements/" + id, { priority: "C" });
    assert.equal(none.status, 428, "a write that names no version is refused, not waved through");
  });

  test("a waiver needs a reason AND the programme office — the deliverer does not waive its own requirement", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    let q = await find(silva, "requirements", id);
    const mine = await silva.patch("/api/requirements/" + id, { status: "Waived", waiverReason: "Out of scope", version: q.version });
    assert.equal(mine.status, 403, mine.text);
    const bare = await marchetti.patch("/api/requirements/" + id, { status: "Waived", version: q.version });
    assert.equal(bare.status, 400);
    assert.match(bare.body.error, /waiver says why/);
    const ok = await marchetti.patch("/api/requirements/" + id,
      { status: "Waived", waiverReason: "PIX instant rail descoped to wave 2 (DEC-014)", version: q.version });
    assert.equal(ok.status, 200, ok.text);
    q = await find(silva, "requirements", id);
    assert.equal(q.status, "Waived");
    assert.equal(q.waiverReason, "PIX instant rail descoped to wave 2 (DEC-014)");
    const reword = await silva.patch("/api/requirements/" + id, { waiverReason: "whatever", version: q.version });
    assert.equal(reword.status, 403, "the reason a waiver stands on is not reworded by the deliverer");
    const a = await one(`SELECT action FROM audit_event WHERE entity = 'requirement' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [id]);
    assert.equal(a.action, "Requirement waived");
  });

  test("authority: a viewer, and a site lead on a group project, are refused; out of scope is 404", async () => {
    const mbeki = await as("viewerGRU");
    assert.equal((await mbeki.post("/api/requirements", { project: P, statement: "x" })).status, 403);
    const silva = await as("siteGRU");
    assert.equal((await silva.post("/api/requirements", { project: GROUP_PROJECT, statement: "x" })).status, 403);
    const yyz = await as("siteYYZ");
    assert.equal((await yyz.post("/api/requirements", { project: P, statement: "x" })).status, 404,
      "a project outside scope answers as absent (B2)");
    assert.equal((await silva.post("/api/requirements", { project: P, statement: "   " })).status, 400);
    assert.equal((await silva.post("/api/requirements", { project: P, statement: "x", priority: "Z" })).status, 400);
  });

  test("remove → read back", async () => {
    const silva = await as("siteGRU");
    assert.equal((await silva.del("/api/requirements/" + id)).status, 200);
    assert.equal(await find(silva, "requirements", id), undefined);
    assert.equal((await silva.del("/api/requirements/" + id)).status, 404);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-11 · evidence that is not a document", () => {
  let id;
  test("create → read back → update every field → read back → remove", async () => {
    const silva = await as("siteGRU");
    const noSource = await silva.post("/api/evidence", { project: P, name: "CI 4711" });
    assert.equal(noSource.status, 400, "a proof with neither a document nor an address is an assertion");
    const prose = await silva.post("/api/evidence", { project: P, name: "CI", uri: "it passed on Tuesday" });
    assert.equal(prose.status, 400, "prose is not a locator (D-8)");
    const r = await silva.post("/api/evidence", {
      project: P, kind: "ci_run", name: "CI 4711", uri: "https://ci.example/run/4711",
      digest: "sha256:ab12", gate: 2, loop: 1, capturedOn: "2026-08-20", capturedBy: "PE-19",
    });
    assert.equal(r.status, 201, r.text);
    id = r.body.id;
    let e = await find(silva, "evidence", id);
    assert.deepEqual([e.kind, e.name, e.uri, e.digest, e.gate, e.loop, e.capturedOn, e.capturedBy, e.document],
      ["ci_run", "CI 4711", "https://ci.example/run/4711", "sha256:ab12", 2, 1, "2026-08-20", "PE-19", null]);
    const doc = (await book(silva)).docs.find((d) => d.project === P);
    const u = await silva.patch("/api/evidence/" + id, {
      kind: "test_report", name: "Traceability report 4712", uri: "git:kodo/tools@a1b2c3d",
      digest: "sha256:cd34", gate: 3, loop: 2, capturedOn: "2026-08-22", capturedBy: "PE-16",
      document: doc.id, version: e.version,
    });
    assert.equal(u.status, 200, u.text);
    e = await find(silva, "evidence", id);
    assert.deepEqual([e.kind, e.name, e.uri, e.digest, e.gate, e.loop, e.capturedOn, e.capturedBy, e.document, e.version],
      ["test_report", "Traceability report 4712", "git:kodo/tools@a1b2c3d", "sha256:cd34", 3, 2, "2026-08-22", "PE-16", doc.id, 2]);
    const both = await silva.patch("/api/evidence/" + id, { uri: "", document: null, version: e.version });
    assert.equal(both.status, 400, "removing both sources leaves an assertion");
    const mbeki = await as("viewerGRU");
    assert.equal((await mbeki.patch("/api/evidence/" + id, { name: "x", version: e.version })).status, 403);
    assert.equal((await silva.del("/api/evidence/" + id)).status, 200);
    assert.equal(await find(silva, "evidence", id), undefined);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-05 · a finding closes on re-test evidence, never on a merged fix", () => {
  let id, retest, before;
  test("create → read back", async () => {
    const silva = await as("siteGRU");
    const req = await silva.post("/api/requirements", { project: P, statement: "Keyboard users can leave the palette" });
    const r = await silva.post("/api/findings", {
      project: P, requirement: req.body.id, gate: 2, loop: 1,
      observedFact: "Esc does not close the palette", whyItMatters: "A keyboard user is trapped",
      severity: "S2", owner: "PE-19", proposedFix: "Esc closes", raisedOn: "2026-08-10", retestOn: "2026-08-24",
    });
    assert.equal(r.status, 201, r.text);
    id = r.body.id;
    const f = await find(silva, "findings", id);
    assert.deepEqual([f.requirement, f.gate, f.loop, f.observedFact, f.whyItMatters, f.severity, f.owner,
      f.proposedFix, f.raisedOn, f.retestOn, f.status, f.closedEvidence],
      [req.body.id, 2, 1, "Esc does not close the palette", "A keyboard user is trapped", "S2", "PE-19",
       "Esc closes", "2026-08-10", "2026-08-24", "Open", null]);
    assert.equal((await silva.post("/api/findings", { project: P, observedFact: "" })).status, 400,
      "a finding states what was observed");
    assert.equal((await silva.post("/api/findings", { project: P, observedFact: "x", status: "Closed" })).status, 400,
      "a finding is not born closed");
  });

  test("update every field → read back", async () => {
    const silva = await as("siteGRU");
    let f = await find(silva, "findings", id);
    const r = await silva.patch("/api/findings/" + id, {
      observedFact: "Esc does not close the palette in Firefox", whyItMatters: "A child at the keyboard is stuck",
      severity: "S1", owner: "PE-16", proposedFix: "Handle keydown on the document", requirement: null,
      gate: 3, loop: 2, raisedOn: "2026-08-11", retestOn: "2026-08-25", status: "Re-test", version: f.version,
    });
    assert.equal(r.status, 200, r.text);
    f = await find(silva, "findings", id);
    assert.deepEqual([f.observedFact, f.whyItMatters, f.severity, f.owner, f.proposedFix, f.requirement,
      f.gate, f.loop, f.raisedOn, f.retestOn, f.status, f.version],
      ["Esc does not close the palette in Firefox", "A child at the keyboard is stuck", "S1", "PE-16",
       "Handle keydown on the document", null, 3, 2, "2026-08-11", "2026-08-25", "Re-test", 2]);
    const patchClose = await silva.patch("/api/findings/" + id, { status: "Closed", version: f.version });
    assert.equal(patchClose.status, 400, "Closed is not a status one types");
  });

  test("it cannot close without evidence, nor on evidence captured before it was raised", async () => {
    const silva = await as("siteGRU");
    let f = await find(silva, "findings", id);
    const bare = await silva.post(`/api/findings/${id}/close`, { version: f.version });
    assert.equal(bare.status, 400);
    assert.match(bare.body.error, /re-test evidence, never on a merged fix/);
    before = (await silva.post("/api/evidence", { project: P, name: "Merged PR 88", uri: "https://git.example/pr/88", capturedOn: "2026-08-05" })).body.id;
    const early = await silva.post(`/api/findings/${id}/close`, { evidence: before, version: f.version });
    assert.equal(early.status, 400, "evidence older than the finding is the fix, not its re-test");
    const other = (await (await as("pmo")).post("/api/evidence",
      { project: "PRJ-140", name: "elsewhere", uri: "https://ci.example/x", capturedOn: "2026-08-26" }));
    assert.equal(other.status, 201, other.text);
    {
      const foreign = await silva.post(`/api/findings/${id}/close`, { evidence: other.body.id, version: f.version });
      assert.equal(foreign.status, 400, "another project's evidence closes nothing here");
    }
    retest = (await silva.post("/api/evidence", { project: P, kind: "ci_run", name: "Re-test run 4720",
      uri: "https://ci.example/run/4720", capturedOn: "2026-08-26" })).body.id;
    const ok = await silva.post(`/api/findings/${id}/close`, { evidence: retest, version: f.version });
    assert.equal(ok.status, 200, ok.text);
    f = await find(silva, "findings", id);
    assert.equal(f.status, "Closed");
    assert.equal(f.closedEvidence, retest);
    /* The database, not only the route, refuses a closure with no proof. */
    await assert.rejects(() => one(`UPDATE finding SET closed_evidence_id = NULL WHERE id = $1 RETURNING id`, [id]),
      /finding_closed_needs_evidence|check/i);
  });

  test("the evidence a closure rests on is frozen; the closure is reversed by reopening, not by deleting", async () => {
    const silva = await as("siteGRU");
    const e = await find(silva, "evidence", retest);
    assert.equal((await silva.patch("/api/evidence/" + retest, { uri: "https://ci.example/run/9999", version: e.version })).status, 409);
    assert.equal((await silva.del("/api/evidence/" + retest)).status, 409);
    assert.equal((await silva.del("/api/findings/" + id)).status, 409, "a closed finding is a record");
    let f = await find(silva, "findings", id);
    const re = await silva.post(`/api/findings/${id}/reopen`, { version: f.version });
    assert.equal(re.status, 200, re.text);
    f = await find(silva, "findings", id);
    assert.equal(f.status, "Open");
    assert.equal(f.closedEvidence, null);
    const a = await one(`SELECT before_json FROM audit_event WHERE entity = 'finding' AND entity_id = $1 AND action = 'Finding reopened'`, [id]);
    assert.match(JSON.stringify(a.before_json), new RegExp(retest), "the trail keeps what it had been closed on");
  });

  test("a waiver needs a reason, and group level", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    let f = await find(silva, "findings", id);
    assert.equal((await silva.post(`/api/findings/${id}/waive`, { reason: "meh", version: f.version })).status, 403);
    const bare = await marchetti.post(`/api/findings/${id}/waive`, { reason: "  ", version: f.version });
    assert.equal(bare.status, 400);
    const ok = await marchetti.post(`/api/findings/${id}/waive`,
      { reason: "Firefox is not a supported browser for the kiosk build", version: f.version });
    assert.equal(ok.status, 200, ok.text);
    f = await find(silva, "findings", id);
    assert.equal(f.status, "Waived");
    assert.equal(f.waiverReason, "Firefox is not a supported browser for the kiosk build");
    assert.equal((await silva.post(`/api/findings/${id}/reopen`, { version: f.version })).status, 403,
      "lifting a waiver is the waiver's authority");
    assert.equal((await marchetti.post(`/api/findings/${id}/reopen`, { version: f.version })).status, 200);
  });

  test("an open finding raised in error is removed; a viewer can do none of it", async () => {
    const silva = await as("siteGRU");
    const mbeki = await as("viewerGRU");
    assert.equal((await mbeki.post("/api/findings", { project: P, observedFact: "x" })).status, 403);
    assert.equal((await mbeki.del("/api/findings/" + id)).status, 403);
    assert.equal((await silva.del("/api/findings/" + id)).status, 200);
    assert.equal(await find(silva, "findings", id), undefined);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-06 · seats, vetoes, and the segregation of duties", () => {
  let safety, designer;
  test("create → read back → update every field → read back; group level only", async () => {
    const silva = await as("siteGRU");
    assert.equal((await silva.post("/api/seats", { name: "x" })).status, 403, "a seat is not the deliverer's to create");
    const kaur = await as("pmo");
    const r = await kaur.post("/api/seats", { name: "Child safety officer", person: "PE-19",
      domain: "child safety", vetoDomain: "child safety", observer: false });
    assert.equal(r.status, 201, r.text);
    safety = r.body.id;
    let s = await find(kaur, "seats", safety);
    assert.deepEqual([s.name, s.person, s.domain, s.vetoDomain, s.observer, s.active, s.version],
      ["Child safety officer", "PE-19", "child safety", "child safety", false, true, 1]);
    const marchetti = await as("groupDCH");
    const u = await marchetti.patch("/api/seats/" + safety, { name: "Child safety, privacy & compliance",
      person: "PE-14", domain: "safety and privacy", vetoDomain: "", observer: true, active: false, version: s.version });
    assert.equal(u.status, 200, u.text);
    s = await find(kaur, "seats", safety);
    assert.deepEqual([s.name, s.person, s.domain, s.vetoDomain, s.observer, s.active, s.version],
      ["Child safety, privacy & compliance", "PE-14", "safety and privacy", null, true, false, 2]);
    const back = await marchetti.patch("/api/seats/" + safety, { name: "Child safety officer", person: "PE-19", vetoDomain: "child safety",
      observer: false, active: true, version: s.version });
    assert.equal(back.status, 200, back.text);
    designer = (await kaur.post("/api/seats", { name: "Mechanics designer", domain: "game design" })).body.id;
  });

  test("two seats declared incompatible cannot be held by one person — a clear 400, not a 500", async () => {
    const kaur = await as("pmo");
    const decl = await kaur.post(`/api/seats/${safety}/conflicts`, { other: designer, reason: "who refuses a mechanic did not design it" });
    assert.equal(decl.status, 201, decl.text);
    let s = await find(kaur, "seats", safety);
    assert.deepEqual(s.incompatibleWith, [designer]);
    assert.deepEqual(s.conflicts, [{ other: designer, reason: "who refuses a mechanic did not design it" }]);
    assert.deepEqual((await find(kaur, "seats", designer)).incompatibleWith, [safety], "the edge is symmetric");
    const d = await find(kaur, "seats", designer);
    const clash = await kaur.patch("/api/seats/" + designer, { person: "PE-19", version: d.version });
    assert.equal(clash.status, 400, clash.text);
    assert.match(clash.body.error, /Segregation of duties/);
    assert.match(clash.body.error, /Child safety officer/);
    assert.equal((await find(kaur, "seats", designer)).person, null, "nothing was written");
    assert.equal((await kaur.post(`/api/seats/${safety}/conflicts`, { other: designer })).status, 409, "declared once");
    assert.equal((await kaur.post(`/api/seats/${safety}/conflicts`, { other: safety })).status, 400);
  });

  test("…and the rule holds from the other end: declaring the clash after one person holds both is refused too", async () => {
    const kaur = await as("pmo");
    const a = (await kaur.post("/api/seats", { name: "Architect", person: "PE-16" })).body.id;
    const b = (await kaur.post("/api/seats", { name: "Design authority", person: "PE-16" })).body.id;
    const late = await kaur.post(`/api/seats/${a}/conflicts`, { other: b, reason: "no self-review" });
    assert.equal(late.status, 400, late.text);
    assert.match(late.body.error, /Segregation of duties/);
    assert.equal((await one(`SELECT count(*)::int AS n FROM seat_conflict WHERE seat_id IN ($1,$2)`, [a, b])).n, 0,
      "neither half of the edge was kept");
    assert.equal((await kaur.del("/api/seats/" + b)).status, 200);
    assert.equal((await kaur.del("/api/seats/" + a)).status, 200);
  });

  test("an incompatibility is removed, both halves at once", async () => {
    const kaur = await as("pmo");
    const extra = (await kaur.post("/api/seats", { name: "Observer seat", observer: true })).body.id;
    assert.equal((await kaur.post(`/api/seats/${designer}/conflicts`, { other: extra })).status, 201);
    assert.equal((await kaur.del(`/api/seats/${extra}/conflicts/${designer}`)).status, 200);
    assert.deepEqual((await find(kaur, "seats", designer)).incompatibleWith, [safety]);
    assert.equal((await kaur.del("/api/seats/" + extra)).status, 200);
    assert.equal(await find(kaur, "seats", extra), undefined);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-07 · an objection has a reason, an owner and a clock — and a veto objection stops the gate", () => {
  let dec, obj, safetySeat;
  before(async () => {
    const kaur = await as("pmo");
    safetySeat = (await book(kaur)).seats.find((s) => s.name === "Child safety officer").id;
    const marchetti = await as("groupDCH");
    const d = await marchetti.post("/api/decisions", { headline: "Leaderboards compare children by class",
      projectId: P, decidedBy: "PE-16", rationale: "Engagement", reversalCost: "high" });
    assert.equal(d.status, 201, d.text);
    dec = d.body.id;
  });

  test("an objection without a reason is refused: it is a vote, not an objection", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post(`/api/decisions/${dec}/objections`, { reason: "   " });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /not an objection, it is a vote/);
  });

  test("a seat's objection is raised by its holder — not by anyone borrowing its veto", async () => {
    const yyz = await as("siteYYZ");
    const borrowed = await yyz.post(`/api/decisions/${dec}/objections`, { seat: safetySeat, reason: "No" });
    assert.ok([403, 404].includes(borrowed.status), borrowed.text);
    const mbeki = await as("viewerGRU");
    assert.equal((await mbeki.post(`/api/decisions/${dec}/objections`, { reason: "No" })).status, 403,
      "a viewer writes nothing, not even dissent (R1.5)");
  });

  test("raise → read back (with a one-working-week clock) → reword → read back", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post(`/api/decisions/${dec}/objections`, { seat: safetySeat,
      reason: "Ranking children against classmates harms the weakest readers", raisedOn: "2026-08-24" });
    assert.equal(r.status, 201, r.text);
    obj = r.body.id;
    let o = await find(silva, "objections", obj);
    assert.deepEqual([o.decision, o.seat, o.domain, o.state, o.raisedOn, o.escalatesOn, o.raisedBy],
      [dec, safetySeat, "child safety", "open", "2026-08-24", "2026-08-31", "PE-19"]);
    const u = await silva.patch("/api/objections/" + obj, { reason: "Ranking by class harms the weakest readers",
      domain: "child safety — G2", escalatesOn: "2026-09-02", version: o.version });
    assert.equal(u.status, 200, u.text);
    o = await find(silva, "objections", obj);
    assert.deepEqual([o.reason, o.domain, o.escalatesOn, o.version],
      ["Ranking by class harms the weakest readers", "child safety — G2", "2026-09-02", 2]);
    const marchetti = await as("groupDCH");
    const back = await marchetti.patch("/api/objections/" + obj, { domain: "child safety", version: o.version });
    assert.equal(back.status, 200, "group level may minute a correction for the objector");
    const yyz = await as("siteYYZ");
    assert.ok([403, 404].includes((await yyz.patch("/api/objections/" + obj, { reason: "x", version: 3 })).status));
  });

  test("the veto blocks the phase advance with evidence or without; resolving it unblocks", async () => {
    const silva = await as("siteGRU");
    const blocked = await silva.patch(`/api/projects/${P}/phase`, {});
    assert.equal(blocked.status, 409, blocked.text);
    assert.match(blocked.body.error, /Child safety officer holds a veto/);
    let db = await book(silva);
    assert.equal(Engine.canAdvance(db, P).vetoes.length, 1);

    /* The person who took the decision does not answer the objection to it. */
    const marchetti = await as("groupDCH");
    let o = await find(silva, "objections", obj);
    const own = await marchetti.post(`/api/objections/${obj}/resolve`, { resolution: "Overruled", version: o.version });
    assert.equal(own.status, 403, own.text);
    assert.match(own.body.error, /you took the decision/);
    assert.equal((await silva.post(`/api/objections/${obj}/resolve`, { resolution: "x", version: o.version })).status, 403,
      "answering an objection is the level above the room");
    const kaur = await as("pmo");
    const bare = await kaur.post(`/api/objections/${obj}/resolve`, { resolution: " ", version: o.version });
    assert.equal(bare.status, 400);
    const ok = await kaur.post(`/api/objections/${obj}/resolve`,
      { resolution: "Leaderboards are per child against their own history, never against the class", version: o.version });
    assert.equal(ok.status, 200, ok.text);
    db = await book(silva);
    const advance = Engine.canAdvance(db, P);
    assert.equal(advance.vetoes, undefined, "no veto left");
    assert.doesNotMatch(advance.reason, /veto/);
    const after = await silva.patch(`/api/projects/${P}/phase`, {});
    assert.ok(after.status !== 409 || !/veto/.test(after.body.error), after.text);
  });

  test("escalate and withdraw are the objector's (or the programme office's); a withdrawn objection stays on the record", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post(`/api/decisions/${dec}/objections`, { reason: "The class ranking is visible to parents" });
    const id = r.body.id;
    let o = await find(silva, "objections", id);
    assert.equal(o.seat, null);
    const yyz = await as("siteYYZ");
    assert.ok([403, 404].includes((await yyz.post(`/api/objections/${id}/withdraw`, { version: o.version })).status));
    assert.equal((await silva.post(`/api/objections/${id}/escalate`, { version: o.version })).status, 200);
    o = await find(silva, "objections", id);
    assert.equal(o.state, "escalated");
    assert.equal((await silva.post(`/api/objections/${id}/withdraw`, { version: o.version })).status, 200);
    o = await find(silva, "objections", id);
    assert.equal(o.state, "withdrawn", "withdrawn, never deleted");
    assert.equal((await silva.post(`/api/objections/${id}/withdraw`, { version: o.version })).status, 409);
  });

  test("a seat an objection was lodged in is retired, not deleted", async () => {
    const kaur = await as("pmo");
    const del = await kaur.del("/api/seats/" + safetySeat);
    assert.equal(del.status, 409);
    assert.match(del.body.error, /retire the seat/);
  });

  test("the decision register shows reversal cost; objections are listed against their decision", async () => {
    const kaur = await as("pmo");
    const log = (await kaur.get("/api/decisions/log")).body.minuted.find((x) => x.id === dec);
    assert.equal(log.reversalCost, "high");
    const db = await book(kaur);
    assert.equal(db.objections.filter((o) => o.decision === dec).length, 2);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-07 · a decision's reversal cost, supersession and source evidence reach the record", () => {
  test("a meeting decision writes all three, and the register reads the supersession", async () => {
    const kaur = await as("pmo");
    const series = (await kaur.get("/api/meetings/series")).body.series.find((s) => s.canWrite && s.next);
    const occ = series.next.id;
    await kaur.post(`/api/meetings/occurrences/${occ}/open`, {});
    const ev = (await kaur.post("/api/evidence", { project: P, name: "Panel notes", uri: "https://docs.example/panel", capturedOn: "2026-08-20" })).body.id;
    const first = await kaur.post(`/api/meetings/occurrences/${occ}/decisions`, { headline: "Publish the item bank under CC BY-SA",
      projectId: P, reversalCost: "high", sourceEvidence: ev });
    assert.equal(first.status, 201, first.text);
    const second = await kaur.post(`/api/meetings/occurrences/${occ}/decisions`, { headline: "Publish the item bank under CC BY",
      projectId: P, reversalCost: "medium", supersedes: first.body.id });
    assert.equal(second.status, 201, second.text);
    const detail = (await kaur.get(`/api/meetings/occurrences/${occ}`)).body;
    const d1 = detail.decisions.find((d) => d.id === first.body.id);
    const d2 = detail.decisions.find((d) => d.id === second.body.id);
    assert.deepEqual([d1.reversalCost, d1.sourceEvidence], ["high", ev]);
    assert.deepEqual([d2.reversalCost, d2.supersedes], ["medium", first.body.id]);
    const log = (await kaur.get("/api/decisions/log")).body.minuted.find((x) => x.id === second.body.id);
    assert.equal(log.supersedes, first.body.id, "a supersession minuted in a room is visible in the register");
    assert.equal((await kaur.post(`/api/meetings/occurrences/${occ}/decisions`, { headline: "x", reversalCost: "enormous" })).status, 400);
    assert.equal((await kaur.post(`/api/meetings/occurrences/${occ}/decisions`, { headline: "y", supersedes: "DEC-NOPE" })).status, 400);
  });

  test("a decision outside a meeting takes a reversal cost and its source evidence", async () => {
    const marchetti = await as("groupDCH");
    const ev = (await marchetti.post("/api/evidence", { project: P, name: "Legal memo", uri: "https://docs.example/memo", capturedOn: "2026-08-21" })).body.id;
    const r = await marchetti.post("/api/decisions", { headline: "Descope the public gallery", projectId: P,
      decidedBy: "PE-16", reversalCost: "low", sourceEvidence: ev });
    assert.equal(r.status, 201, r.text);
    const log = (await marchetti.get("/api/decisions/log")).body.minuted.find((x) => x.id === r.body.id);
    assert.deepEqual([log.reversalCost, log.sourceEvidence], ["low", ev]);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("MER-10 · a series can be convened per gate or ad hoc", () => {
  test("create per_gate with its gate → read back → update → a per_gate series without a gate is refused", async () => {
    const kaur = await as("pmo");
    const none = await kaur.post("/api/meetings/series", { name: "G3 review", cadence: "per_gate", scopeKind: "group" });
    assert.equal(none.status, 400, "« per gate » that names no gate designates no meeting");
    const r = await kaur.post("/api/meetings/series", { name: "G3 readiness review", cadence: "per_gate", gateN: 3, scopeKind: "group" });
    assert.equal(r.status, 201, r.text);
    let s = (await kaur.get("/api/meetings/series/" + r.body.id + "/occurrences")).body.series;
    assert.deepEqual([s.cadence, s.gateN], ["per_gate", 3]);
    const u = await kaur.patch("/api/meetings/series/" + r.body.id, { cadence: "ad_hoc", version: s.version });
    assert.equal(u.status, 200, u.text);
    s = (await kaur.get("/api/meetings/series/" + r.body.id + "/occurrences")).body.series;
    assert.deepEqual([s.cadence, s.gateN], ["ad_hoc", null]);
    assert.equal((await kaur.post("/api/meetings/series", { name: "x", cadence: "fortnightly", scopeKind: "group" })).status, 400);
  });

  test("closing an event-driven meeting schedules no calendar successor", async () => {
    const kaur = await as("pmo");
    const r = await kaur.post("/api/meetings/series", { name: "Safety board", cadence: "ad_hoc", scopeKind: "group" });
    const occ = await kaur.post(`/api/meetings/series/${r.body.id}/occurrences`, { meetsOn: "2026-09-01" });
    assert.equal(occ.status, 201, occ.text);
    await kaur.post(`/api/meetings/occurrences/${occ.body.id}/open`, {});
    const closed = await kaur.post(`/api/meetings/occurrences/${occ.body.id}/close`, {});
    assert.equal(closed.status, 200, closed.text);
    assert.equal(closed.body.next, null);
    const n = await one(`SELECT count(*)::int AS n FROM meeting_occurrence WHERE series_id = $1`, [r.body.id]);
    assert.equal(n.n, 1);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("NEW-04 · the authority decisions, read from shared/rbac.js", () => {
  const u = (role, extra = {}) => ({ role, active: true, personId: "PE-X",
    grants: { programmes: new Set(extra.programmes ?? []), sites: new Set(extra.sites ?? []) }, ...extra.more });
  const siteProj = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  test("assurance is project work; waiving and seats are group work; the decider never resolves", () => {
    assert.equal(can(u("site", { sites: ["GRU"] }), "assurance.write", { project: siteProj }).ok, true);
    assert.equal(can(u("site", { sites: ["GRU"] }), "waiver.grant", { project: siteProj }).ok, false);
    assert.equal(can(u("group", { programmes: ["DCH"] }), "waiver.grant", { project: siteProj }).ok, true);
    assert.equal(can(u("group", { programmes: ["CBP"] }), "waiver.grant", { project: siteProj }).ok, false);
    assert.equal(can(u("group"), "seat.manage").ok, true);
    assert.equal(can(u("site", { sites: ["GRU"] }), "seat.manage").ok, false);
    assert.equal(can(u("viewer"), "objection.raise", {}).ok, false);
    assert.equal(can(u("site", { sites: ["GRU"] }), "objection.raise", { seat_person: "PE-OTHER" }).ok, false);
    assert.equal(can(u("site", { sites: ["GRU"] }), "objection.raise", { seat_person: "PE-X" }).ok, true);
    assert.equal(can(u("group"), "objection.resolve", { decided_by: "PE-X" }).ok, false);
    assert.equal(can(u("group"), "objection.resolve", { decided_by: "PE-Y" }).ok, true);
    assert.equal(can(u("site", { sites: ["GRU"] }), "objection.own", { raised_by: "PE-X" }).ok, true);
    assert.equal(can(u("site", { sites: ["GRU"] }), "objection.own", { raised_by: "PE-Y" }).ok, false);
  });
});

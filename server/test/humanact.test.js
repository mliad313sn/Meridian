/**
 * D-36.15 · A STANDING HUMAN ACT HOLDS THE GATE IT BLOCKS
 *           (REQ-13, second half · D-33.14 · migration 059)
 *
 * RT365 keeps a table of standing human acts, H-nn, with a "Blocks gate"
 * column and one rule: "an action stays here until its evidence file
 * exists". D-36.15 makes such an act a RAID Dependency with category
 * "Human act", an owner, a review date, the gate it blocks
 * (`blocksGate`) and the locator it closes on (`closureEvidence`).
 *
 * What these tests hold:
 *   - an open blocking act holds its gate — Engine.canAdvance refuses,
 *     and the refusal names the act and its owner; the phase route
 *     refuses with the same words;
 *   - a risk linked to the same gate does NOT (I-8: informative, never
 *     blocking) — only the explicit flag on a dependency holds;
 *   - closing a blocking act without evidence is a 400, on the screen
 *     route and on the contract alike; prose and an untrusted host are
 *     refused as a decision's evidence is;
 *   - closing it on its evidence lifts the hold;
 *   - the contract carries both fields, and the OpenAPI document says so;
 *   - the engine's numbers (EVM, roll-up, gate evidence counts) are the
 *     same before and after: a hold is a rule, not a number (D-05).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { boot, shutdown, as, client, GROUP_PROJECT } from "./harness.js";
import { one } from "../src/db.js";
import { WRITE_BODIES } from "../src/v1write.js";
import { closureEvidenceRefusal } from "../src/evidence.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

const P = GROUP_PROJECT;
let admin, db0, gate0, owner, advance0, snapshot0, KEY;
const c = client();
const put = (path, body) => c.put(path, body, { "X-API-Key": KEY });
const book = async () => (await admin.get("/api/bootstrap")).body.db;

/** Every number the engine produces for the book that a hold could touch. */
function numbers(db) {
  const projects = db.projects.map((p) => p.id);
  return {
    /* The whole metrics object of every project, as the engine returns it. */
    metrics: projects.map((id) => JSON.parse(JSON.stringify(Engine.metrics(db, id)))),
    roll: Engine.roll(db, db.projects),
    gates: projects.flatMap((id) => Engine.gates(db, id).map((g) => {
      const st = Engine.gateStatus(db, id, g.n);
      return { id, n: g.n, approved: st.approved, total: st.total, criteriaMet: st.criteriaMet,
        risks: st.risks.length };
    })),
    exposure: db.raid.map((r) => [r.id, Engine.exposure(r), Engine.escalation(db, r).level]),
  };
}

describe("D-36.15 · a standing human act holds the gate it blocks", () => {
  test("the book before: no row blocks, and the fields at their default change nothing", async () => {
    admin = await as("admin");
    db0 = await book();
    assert.ok(db0.raid.length, "the seed carries register rows");
    assert.ok(db0.raid.every((r) => r.blocksGate === false && r.closureEvidence === ""),
      "every existing row is read as not blocking, with no evidence (059 defaults)");
    gate0 = Engine.currentGate(db0, P);
    advance0 = Engine.canAdvance(db0, P);
    owner = db0.people[1];
    snapshot0 = numbers(db0);
    /* The same book with the two fields stripped — the shape before 059 —
       produces exactly the same numbers and the same answer at the gate. */
    const stripped = { ...db0, raid: db0.raid.map(({ blocksGate, closureEvidence, ...r }) => r) };
    assert.deepEqual(numbers(stripped), snapshot0);
    assert.deepEqual(Engine.canAdvance(stripped, P), advance0);
    assert.deepEqual(Engine.gateStatus(db0, P, gate0.n).holds, []);
  });

  test("a risk linked to the gate is read, never a lock (I-8)", async () => {
    const r = await admin.post("/api/raid", {
      type: "Risk", project: P, title: "Vendor may slip the cut-over window", p: 4, i: 4,
      owner: owner.id, gate: gate0.n,
    });
    assert.equal(r.status, 201, r.text);
    const db = await book();
    const st = Engine.gateStatus(db, P, gate0.n);
    assert.ok(st.risks.some((x) => x.id === r.body.id), "it stands against the gate");
    assert.deepEqual(st.holds, [], "and does not hold it");
    assert.deepEqual(Engine.canAdvance(db, P), advance0, "the answer at the gate is unchanged");
  });

  test("only a dependency on a project's gate can block it", async () => {
    const risk = await admin.post("/api/raid", {
      type: "Risk", project: P, title: "x", gate: gate0.n, blocksGate: true });
    assert.equal(risk.status, 400);
    assert.match(risk.body.error, /Only a dependency can block its gate/);
    const noGate = await admin.post("/api/raid", {
      type: "Dependency", project: P, title: "x", blocksGate: true });
    assert.equal(noGate.status, 400);
    assert.match(noGate.body.error, /names the gate it blocks/);
  });

  let ACT;
  test("an open blocking act holds the gate, and the refusal names the act and its owner", async () => {
    const r = await admin.post("/api/raid", {
      type: "Dependency", project: P, title: "Sponsor signs the data-sharing agreement",
      category: "Human act", owner: owner.id, review: "2026-09-10", gate: gate0.n, blocksGate: true,
    });
    assert.equal(r.status, 201, r.text);
    ACT = r.body.id;
    const db = await book();
    const row = db.raid.find((x) => x.id === ACT);
    assert.equal(row.blocksGate, true);

    const st = Engine.gateStatus(db, P, gate0.n);
    assert.deepEqual(st.holds.map((x) => x.id), [ACT], "gateStatus lists the hold");
    assert.notEqual(st.state, "Cleared");
    assert.equal(st.ready, false);

    const adv = Engine.canAdvance(db, P);
    assert.equal(adv.ok, false);
    assert.ok(adv.reason.includes(ACT), adv.reason);
    assert.ok(adv.reason.includes(owner.name), "the owner is named: " + adv.reason);
    assert.match(adv.reason, /held by human act/);
    assert.deepEqual(adv.holds.map((x) => x.id), [ACT]);

    /* The server refuses the phase advance with the same words. */
    const p = db.projects.find((x) => x.id === P);
    const phase = await admin.patch(`/api/projects/${P}/phase`, { version: p.version });
    assert.equal(phase.status, 409, phase.text);
    assert.ok(phase.body.error.includes(ACT) && phase.body.error.includes(owner.name), phase.body.error);
  });

  test("the engine's numbers are the same with the hold as without it", async () => {
    const db = await book();
    const now = numbers(db);
    /* Two rows were added (a risk and the act), so their own exposure
       entries and the gate's `risks` count grew; every other number is
       identical to the snapshot taken before either existed. */
    assert.deepEqual(now.metrics, snapshot0.metrics);
    assert.deepEqual(now.roll, snapshot0.roll);
    assert.deepEqual(now.gates.map(({ risks, ...g }) => g), snapshot0.gates.map(({ risks, ...g }) => g));
    assert.deepEqual(now.exposure.filter(([id]) => snapshot0.exposure.some(([x]) => x === id)), snapshot0.exposure);
  });

  test("closing it without evidence is a 400 — and a sentence or an untrusted host are not evidence", async () => {
    let row = (await book()).raid.find((x) => x.id === ACT);
    const bare = await admin.patch(`/api/raid/${ACT}`, { status: "Closed", version: row.version });
    assert.equal(bare.status, 400, bare.text);
    assert.match(bare.body.error, /closes on its evidence/);

    const prose = await admin.patch(`/api/raid/${ACT}`, {
      status: "Closed", closureEvidence: "the sponsor told me it was signed", version: row.version });
    assert.equal(prose.status, 400);
    assert.match(prose.body.error, /cannot be found again/);

    const elsewhere = await admin.patch(`/api/raid/${ACT}`, {
      status: "Closed", closureEvidence: "https://files.example.org/signed.pdf", version: row.version });
    assert.equal(elsewhere.status, 400);
    assert.match(elsewhere.body.error, /not a trusted document host/);

    row = await one(`SELECT status, closure_evidence FROM raid_item WHERE id = $1`, [ACT]);
    assert.deepEqual(row, { status: "Open", closure_evidence: "" }, "nothing was written");
    assert.equal(Engine.canAdvance(await book(), P).ok, false, "the hold stands");
  });

  test("closing it on its evidence lifts the hold; reopening withdraws the evidence and holds again", async () => {
    let row = (await book()).raid.find((x) => x.id === ACT);
    const ok = await admin.patch(`/api/raid/${ACT}`, {
      status: "Closed", closureEvidence: "docs/evidence/H-03.md@a1b2c3d", version: row.version });
    assert.equal(ok.status, 200, ok.text);
    let db = await book();
    row = db.raid.find((x) => x.id === ACT);
    assert.equal(row.status, "Closed");
    assert.equal(row.closureEvidence, "docs/evidence/H-03.md@a1b2c3d");
    assert.ok(row.closedOn, "the closure is dated (REQ-18)");
    assert.deepEqual(Engine.gateStatus(db, P, gate0.n).holds, []);
    assert.deepEqual(Engine.canAdvance(db, P), advance0, "the gate answers as it did before the act existed");

    const reopened = await admin.patch(`/api/raid/${ACT}`, { status: "Open", version: row.version });
    assert.equal(reopened.status, 200, reopened.text);
    db = await book();
    assert.equal(db.raid.find((x) => x.id === ACT).closureEvidence, "", "an open act has not been done");
    assert.equal(Engine.canAdvance(db, P).ok, false);

    /* A trusted host is evidence too (documentHosts, as gate evidence). */
    row = db.raid.find((x) => x.id === ACT);
    const host = String(db.settings.documentHosts).split(",")[0].trim();
    const linked = await admin.patch(`/api/raid/${ACT}`, {
      status: "Closed", closureEvidence: `https://${host}/rt365/H-03-signed.pdf`, version: row.version });
    assert.equal(linked.status, 200, linked.text);
    assert.deepEqual(Engine.canAdvance(await book(), P), advance0);
  });

  test("the database holds the rule whatever path writes", async () => {
    await assert.rejects(
      one(`UPDATE raid_item SET closure_evidence = '' WHERE id = $1 RETURNING id`, [ACT]),
      /raid_blocking_act_closed_on_evidence/);
    await assert.rejects(
      one(`UPDATE raid_item SET kind = 'Risk' WHERE id = $1 RETURNING id`, [ACT]),
      /raid_blocking_act_shape/);
  });

  test("the validator: a path, a commit, a named locator, a trusted https host", () => {
    const st = { documentHosts: "docs.example.com" };
    assert.equal(closureEvidenceRefusal("docs/evidence/H-01.md v2.0", st), null);
    assert.equal(closureEvidenceRefusal("a1b2c3d", st), null);
    assert.equal(closureEvidenceRefusal("run:12345", st), null);
    assert.equal(closureEvidenceRefusal("https://sp.docs.example.com/x.pdf", st), null);
    assert.match(closureEvidenceRefusal("http://docs.example.com/x.pdf", st), /https/);
    assert.match(closureEvidenceRefusal("https://docs.example.com/x.pdf", {}), /No trusted document hosts/);
    assert.match(closureEvidenceRefusal("", st), /closes on its evidence/);
  });
});

describe("D-36.15 · the contract carries the act (PUT /api/v1/raid)", () => {
  test("WRITE_BODIES and the published OpenAPI document declare both fields", () => {
    assert.equal(WRITE_BODIES.raid.blocksGate, "boolean");
    assert.equal(WRITE_BODIES.raid.closureEvidence, "string");
    const api = fs.readFileSync(new URL("../../docs/openapi.v1.json", import.meta.url), "utf8");
    assert.match(api, /"blocksGate"/);
    assert.match(api, /"closureEvidence"/);
    assert.match(api, /closing one without it is a 400/);
  });

  test("RT365's H-nn arrives by the contract, holds its gate, and closes on its evidence", async () => {
    const minted = await admin.post("/api/admin/integrations",
      { name: "RT365 human acts", scopes: "read:portfolio,write:portfolio", purpose: "test" });
    assert.equal(minted.status, 201, minted.text);
    KEY = minted.body.key;

    const raised = await put("/api/v1/raid/H-07", {
      project: P, type: "Dependency", category: "Human act", title: "Operator provisions the tenant",
      owner: owner.id, review: "2026-09-30", gate: gate0.n, blocksGate: true,
    });
    assert.equal(raised.status, 201, raised.text);
    const id = raised.body.id;
    let db = await book();
    assert.equal(db.raid.find((x) => x.id === id).blocksGate, true);
    const adv = Engine.canAdvance(db, P);
    assert.equal(adv.ok, false);
    assert.ok(adv.reason.includes(id) && adv.reason.includes(owner.name), adv.reason);

    const bare = await put("/api/v1/raid/H-07", { status: "Closed" });
    assert.equal(bare.status, 400, bare.text);
    assert.match(bare.body.error, /closes on its evidence/);
    const typo = await put("/api/v1/raid/H-07", { blocksGate: "yes" });
    assert.equal(typo.status, 400);

    const closed = await put("/api/v1/raid/H-07", {
      status: "Closed", closureEvidence: "docs/evidence/H-07.md@9f8e7d6" });
    assert.equal(closed.status, 200, closed.text);

    /* Read back through the contract's own read. */
    const read = await c.get("/api/v1/portfolio", { "X-API-Key": KEY });
    assert.equal(read.status, 200);
    const row = read.body.portfolio.raid.find((x) => x.externalId === "H-07");
    assert.equal(row.blocksGate, true);
    assert.equal(row.closureEvidence, "docs/evidence/H-07.md@9f8e7d6");
    assert.equal(row.status, "Closed");
    db = await book();
    assert.deepEqual(Engine.canAdvance(db, P), advance0, "the hold lifted");

    /* A past act loaded already closed carries its evidence, or is refused. */
    const pastBare = await put("/api/v1/raid/H-01", {
      project: P, type: "Dependency", title: "Board approves the charter", gate: gate0.n,
      blocksGate: true, status: "Closed", closedOn: "2026-06-01" });
    assert.equal(pastBare.status, 400, pastBare.text);
    const past = await put("/api/v1/raid/H-01", {
      project: P, type: "Dependency", title: "Board approves the charter", gate: gate0.n,
      blocksGate: true, status: "Closed", closedOn: "2026-06-01",
      closureEvidence: "commit:4c5d6e7" });
    assert.equal(past.status, 201, past.text);
  });
});

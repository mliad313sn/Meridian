/**
 * REQ-49 (RT365) — a decision recorded through the session route is held
 * to the same segregation of duties as one written through the contract.
 *
 * Two defects, one rule:
 *
 *   1. `POST /api/decisions` accepted `ratifiedBy` as free text: no lookup
 *      in the directory, no independence check. The person who took a
 *      decision could ratify it, or a name nobody can find could — and
 *      since 5.15 that ratification is dated and read by the signals.
 *   2. The contract's own check compared the ratifier (a PERSON id) with
 *      the recording ACCOUNT id: two id spaces that never meet, so "the
 *      hand that recorded it does not also ratify it" never fired.
 *
 * Both doors now read `canRatifyDecision` in shared/rbac.js with the
 * recorder's person, and each refusal says why.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* groupCBP is E. Lindqvist, person PE-15. */
const decision = (over = {}) => ({
  headline: "REQ-49 probe", rationale: "…", decidedBy: "PE-01", decidedOn: "2026-08-20",
  projectId: GROUP_PROJECT, status: "Ratified", ...over,
});

describe("REQ-49 · the session route ratifies under the contract's rule", () => {
  test("the person who decided cannot ratify it — 403, and the refusal says why", async () => {
    const r = await (await as("groupCBP")).post("/api/decisions", decision({ ratifiedBy: "PE-01" }));
    assert.equal(r.status, 403, r.text);
    assert.match(r.body.error, /decided does not also ratify/);
  });

  test("the recording account's own person cannot ratify it — 403", async () => {
    const r = await (await as("groupCBP")).post("/api/decisions", decision({ ratifiedBy: "PE-15" }));
    assert.equal(r.status, 403, r.text);
    assert.match(r.body.error, /recorded this decision does not also ratify/);
  });

  test("a ratifier nobody can find in the directory is refused — 400", async () => {
    const r = await (await as("groupCBP")).post("/api/decisions", decision({ ratifiedBy: "Comité d'investissement" }));
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /ratifiedBy: no active person/);
  });

  test("an independent person ratifies, and is stored as a person, not a text", async () => {
    const r = await (await as("groupCBP")).post("/api/decisions", decision({ ratifiedBy: "PE-07" }));
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT ratified_by FROM meeting_decision WHERE id = $1`, [r.body.id]);
    assert.equal(row.ratified_by, "PE-07");
  });

  test("a proposed decision with no ratifier is still recorded", async () => {
    const r = await (await as("groupCBP")).post("/api/decisions", decision({ status: "Proposed" }));
    assert.equal(r.status, 201, r.text);
  });
});

describe("REQ-49 · the contract's own check now compares like with like", () => {
  test("the person behind the recording account cannot ratify through the contract", async () => {
    const admin = await as("admin");
    const key = await admin.post("/api/admin/integrations", { name: "REQ-49 ratify", scopes: ["write:meetings", "read:meetings"] });
    assert.equal(key.status, 201, key.text);
    const c = await as(null);
    const h = { "X-API-Key": key.body.key };
    const made = await c.put("/api/v1/decisions/REQ49-1", {
      headline: "REQ-49 contract probe", council: "ARB", decidedOn: "2026-08-20", status: "Proposed",
    }, h);
    assert.equal(made.status, 201, made.text);
    /* The recording hand is an account; the ratifier is a person. Give the
       decision a recorder who IS somebody (groupCBP's account, person
       PE-15): before REQ-49 the rule compared PE-15 with the account id
       U-LIND and let PE-15 ratify their own record. */
    await one(`UPDATE meeting_decision SET recorded_by = 'U-LIND' WHERE id = $1 RETURNING id`, [made.body.id]);
    const self = await c.put("/api/v1/decisions/REQ49-1", { status: "Ratified", ratifiedBy: "PE-15" }, h);
    assert.equal(self.status, 403, self.text);
    assert.match(self.body.error, /recorded this decision does not also ratify/);
    const other = await c.put("/api/v1/decisions/REQ49-1", { status: "Ratified", ratifiedBy: "PE-07" }, h);
    assert.equal(other.status, 200, other.text);
  });
});

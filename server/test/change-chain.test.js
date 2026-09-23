/**
 * PR-04 · EACH STEP OF A CHANGE CHAIN HAS ITS OWN SIGNATORY  (D-36.11)
 *
 * The comité de recette (docs/32) found that a change request's approval
 * chain showed four roles and let one person sign all four: the roles
 * were labels, not authorities, and the segregation of duties only kept
 * the raiser out. The Product Owner decided that every step needs a
 * distinct signatory — the person behind the account, or the account
 * itself when it represents nobody — and that the rule is independence,
 * not level: an administrator is held to it too.
 *
 * Each test raises its own request, so none depends on another's chain.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, SITE_PROJECT_GRU } from "./harness.js";
import { query, one } from "../src/db.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

const REASON = (n) => new RegExp(`you signed step ${n} of this request — a different person signs each step`);

/* A small request on GRU's site project: under the threshold, so the
   site, the DCH programme office and the administrators may all decide
   it — which is what lets the chain be walked by distinct people. */
async function raise(by, title) {
  const r = await by.post("/api/change", { project: SITE_PROJECT_GRU, title, cost: 0.05, weeks: 1 });
  assert.equal(r.status, 201, r.text);
  return r.body.id;
}

async function stepsOf(id) {
  return (await query(`SELECT seq, state, decided_by, decided_by_person FROM change_step
                        WHERE cr_id = $1 ORDER BY seq`, [id])).rows;
}

/* An extra account, provisioned the way a customer would, that has
   proved its password (an admin-created account writes nothing before). */
async function provision(admin, { email, role, grants, personId = null }) {
  const pw = "chain-probe-2026";
  const made = await admin.post("/api/admin/users",
    { email, displayName: email.split("@")[0], role, password: pw, personId, grants });
  assert.equal(made.status, 201, made.text);
  const c = client();
  assert.equal((await c.post("/api/auth/login", { email, password: pw })).status, 200);
  assert.equal((await c.post("/api/auth/password", { current: pw, next: pw + "-mine" })).status, 200);
  return c;
}

describe("PR-04 · one signatory per step, over HTTP", () => {
  test("the same person approving two steps is refused 403, and the refusal says which step", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const id = await raise(silva, "PR-04 probe — twice");

    const first = await marchetti.post(`/api/change/${id}/approve`, { comment: "step one" });
    assert.equal(first.status, 200, first.text);
    const twice = await marchetti.post(`/api/change/${id}/approve`, { comment: "step two" });
    assert.equal(twice.status, 403, twice.text);
    assert.match(twice.body.error, REASON(1));

    const steps = await stepsOf(id);
    assert.equal(steps[0].state, "done");
    assert.equal(steps[1].state, "current", "the refused signature did not move the chain");
    assert.equal(steps[1].decided_by, null);
  });

  test("a second, independent person approves the next step — and the signer is recorded", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const kaur = await as("pmo");
    const id = await raise(silva, "PR-04 probe — relay");

    assert.equal((await marchetti.post(`/api/change/${id}/approve`, {})).status, 200);
    const second = await kaur.post(`/api/change/${id}/approve`, {});
    assert.equal(second.status, 200, second.text);

    const steps = await stepsOf(id);
    assert.deepEqual(steps.slice(0, 2).map((s) => [s.decided_by, s.decided_by_person]),
      [["U-MARC", "PE-16"], ["U-KAUR", "PE-14"]],
      "each signed step names the account and the person behind it (056)");
    assert.equal(steps[2].state, "current");

    // Neither of the two signs the third step.
    const back = await marchetti.post(`/api/change/${id}/approve`, {});
    assert.equal(back.status, 403);
    assert.match(back.body.error, REASON(1));
    const back2 = await kaur.post(`/api/change/${id}/approve`, {});
    assert.equal(back2.status, 403);
    assert.match(back2.body.error, REASON(2));
  });

  test("the raiser still cannot approve any step", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const id = await raise(silva, "PR-04 probe — raiser");
    const self = await silva.post(`/api/change/${id}/approve`, {});
    assert.equal(self.status, 403);
    assert.match(self.body.error, /you raised this request/);
    assert.equal((await marchetti.post(`/api/change/${id}/approve`, {})).status, 200);
    const selfLater = await silva.post(`/api/change/${id}/approve`, {});
    assert.equal(selfLater.status, 403, "nor a later one");
    assert.match(selfLater.body.error, /you raised this request/);
  });

  test("an administrator is held to it too — the rule is independence, not level", async () => {
    const marchetti = await as("groupDCH");
    const admin = await as("admin");
    const id = await raise(marchetti, "PR-04 probe — admin");
    const first = await admin.post(`/api/change/${id}/approve`, {});
    assert.equal(first.status, 200, first.text);
    const twice = await admin.post(`/api/change/${id}/approve`, {});
    assert.equal(twice.status, 403, "an administrator does not sign a second step: " + twice.text);
    assert.match(twice.body.error, REASON(1));
  });

  test("an administrator signing its OWN request (break-glass) still signs one step only", async () => {
    const admin = await as("admin");
    const id = await raise(admin, "PR-04 probe — break-glass");
    assert.equal((await admin.post(`/api/change/${id}/approve`, {})).status, 200,
      "the raiser exemption is break-glass, and stays");
    const twice = await admin.post(`/api/change/${id}/approve`, {});
    assert.equal(twice.status, 403);
    assert.match(twice.body.error, REASON(1));
  });

  test("'person' is the person behind the account: a second account of the same person is refused", async () => {
    const admin = await as("admin");
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    // A second account for P. Marchetti (PE-16), with the same programme.
    const alias = await provision(admin, {
      email: "marchetti.alias@meridian.example", role: "group", personId: "PE-16",
      grants: [{ kind: "programme", target: "DCH" }],
    });
    const id = await raise(silva, "PR-04 probe — two accounts, one person");
    assert.equal((await marchetti.post(`/api/change/${id}/approve`, {})).status, 200);
    const other = await alias.post(`/api/change/${id}/approve`, {});
    assert.equal(other.status, 403, "one person, two accounts, is still one signatory: " + other.text);
    assert.match(other.body.error, REASON(1));
  });

  test("an account with no person is its own identity", async () => {
    const admin = await as("admin");            // U-ADMIN represents nobody
    const silva = await as("siteGRU");
    const id = await raise(silva, "PR-04 probe — personless");
    assert.equal((await admin.post(`/api/change/${id}/approve`, {})).status, 200);
    const s = await stepsOf(id);
    assert.equal(s[0].decided_by, "U-ADMIN");
    assert.equal(s[0].decided_by_person, null);
    const twice = await admin.post(`/api/change/${id}/approve`, {});
    assert.equal(twice.status, 403);
    assert.match(twice.body.error, REASON(1));
  });

  test("a chain walks to the end with four distinct signatories", async () => {
    const admin = await as("admin");
    const silva = await as("siteGRU");
    const fourth = await provision(admin, {
      email: "dch.controller@meridian.example", role: "group",
      grants: [{ kind: "programme", target: "DCH" }],
    });
    const id = await raise(silva, "PR-04 probe — full chain");
    const chain = [await as("groupDCH"), await as("pmo"), admin, fourth];
    let last;
    for (const who of chain) {
      last = await who.post(`/api/change/${id}/approve`, {});
      assert.equal(last.status, 200, last.text);
    }
    assert.equal(last.body.applied, true);
    const cr = await one(`SELECT status FROM change_request WHERE id = $1`, [id]);
    assert.equal(cr.status, "Approved");
  });

  test("steps signed before 056 with no recorded signer block nobody", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const id = await raise(silva, "PR-04 probe — history");
    /* History as the seed and old imports hold it: signed, dated, and no
       signer recorded. The rule does not guess who that was. */
    await query(`UPDATE change_step SET state = 'done', decided_on = '2026-01-10',
                        decided_by = NULL, decided_by_person = NULL
                  WHERE cr_id = $1 AND seq = 0`, [id]);
    await query(`UPDATE change_step SET state = 'current' WHERE cr_id = $1 AND seq = 1`, [id]);
    const r = await marchetti.post(`/api/change/${id}/approve`, {});
    assert.equal(r.status, 200, r.text);
  });

  test("a rejection ends the chain, so a step-one signer may still reject a later step", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const id = await raise(silva, "PR-04 probe — reject");
    assert.equal((await marchetti.post(`/api/change/${id}/approve`, {})).status, 200);
    const r = await marchetti.post(`/api/change/${id}/reject`, { comment: "on reflection" });
    assert.equal(r.status, 200, r.text);
    const steps = await stepsOf(id);
    assert.equal(steps[1].state, "rejected");
    assert.equal(steps[1].decided_by, "U-MARC");
  });

  test("the export carries who signed each step, so the screen can read the rule", async () => {
    const silva = await as("siteGRU");
    const marchetti = await as("groupDCH");
    const id = await raise(silva, "PR-04 probe — export");
    assert.equal((await marchetti.post(`/api/change/${id}/approve`, {})).status, 200);
    const db = (await silva.get("/api/bootstrap")).body.db;
    const cr = db.crs.find((c) => c.id === id);
    assert.equal(cr.steps[0].by, "PE-16");
    assert.equal(cr.steps[0].byUser, "U-MARC");
    assert.equal(cr.steps[1].by, null);
  });
});

describe("PR-04 · the rule in rbac.js", () => {
  const project = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  const threshold = { cost: 0.25, weeks: 2 };
  const base = { project, cost_delta: 0.05, weeks_delta: 1, threshold, raised_by: "PE-99", raised_by_user: "U-X" };
  const grp = { id: "U-MARC", role: "group", active: true, personId: "PE-16",
    grants: { programmes: new Set(["DCH"]), sites: new Set() } };
  const adm = { id: "U-ADMIN", role: "admin", active: true, personId: null,
    grants: { programmes: new Set(), sites: new Set() } };

  test("an approval without the chain's signers fails CLOSED — for admin too", () => {
    const v = can(grp, "change.approve", base);
    assert.equal(v.ok, false);
    assert.match(v.why, /signatures already on this request were not loaded/);
    assert.equal(can(adm, "change.approve", base).ok, false);
  });

  test("person match, account match, deputy match; null signer matches nobody", () => {
    const signed = (s) => can(grp, "change.approve", { ...base, signers: [s] });
    assert.match(signed({ seq: 2, person: "PE-16", user: "U-OTHER" }).why, REASON(3));
    assert.match(signed({ seq: 0, person: null, user: "U-MARC" }).why, REASON(1));
    assert.equal(signed({ seq: 0, person: null, user: null }).ok, true);
    assert.equal(signed({ seq: 0, person: "PE-01", user: "U-OTHER" }).ok, true);
    const deputy = { ...grp, id: "U-DEP", personId: "PE-50", actingForPersonId: "PE-16" };
    assert.match(can(deputy, "change.approve", { ...base, signers: [{ seq: 0, person: "PE-16", user: "U-MARC" }] }).why,
      REASON(1), "a deputy acting for the step-one signer is that signer too");
  });

  test("admin: held to the distinct signatory, not to the raiser (break-glass)", () => {
    assert.equal(can(adm, "change.approve", { ...base, raised_by_user: "U-ADMIN", signers: [] }).ok, true);
    assert.match(can(adm, "change.approve", { ...base, signers: [{ seq: 0, person: null, user: "U-ADMIN" }] }).why, REASON(1));
  });

  test("a rejection is not held to it", () => {
    assert.equal(can(grp, "change.approve",
      { ...base, decision: "reject" }).ok, true);
  });
});

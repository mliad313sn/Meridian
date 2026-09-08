/**
 * PM-05 · LES PARTIES PRENANTES — PM-11 · LE PLAN DE COMMUNICATION (I-10)
 * Retour de terrain RT365 (docs/33, M-12), sur deux lignes du registre de
 * conformité (docs/26).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

describe("PM-05 · le registre des parties prenantes", () => {
  let ID;
  test("le chef de site nomme un régulateur sur SON projet — pas une personne de l'annuaire, et c'est permis", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post("/api/stakeholders", {
      project: SITE_PROJECT_GRU, name: "Banco Central do Brasil", organisation: "Regulator", role: "Supervisor",
      interest: 5, influence: 5, attitude: "Sceptic", engagement: "Consult", note: "Wants the DPIA before go-live",
    });
    assert.equal(r.status, 201, r.text);
    ID = r.body.id;
    assert.match(ID, /^STK-\d+$/);
    const db = (await silva.get("/api/bootstrap")).body.db;
    const s = db.stakeholders.find((x) => x.id === ID);
    assert.equal(s.person, null);
    assert.equal(s.attitude, "Sceptic");
    assert.equal(s.interest, 5);
    assert.equal((await silva.post("/api/stakeholders", { project: SITE_PROJECT_GRU, name: "  " })).status, 400);
    assert.equal((await silva.post("/api/stakeholders", { project: GROUP_PROJECT, name: "x" })).status, 403,
      "un projet groupe n'est pas le sien");
  });

  test("l'attitude change et la piste garde avant/après ; les valeurs hors vocabulaire sont refusées", async () => {
    const silva = await as("siteGRU");
    const db = (await silva.get("/api/bootstrap")).body.db;
    const s = db.stakeholders.find((x) => x.id === ID);
    const bad = await silva.patch("/api/stakeholders/" + ID, { attitude: "Furious", version: s.version });
    assert.equal(bad.status, 400);
    const ok = await silva.patch("/api/stakeholders/" + ID, { attitude: "Supporter", engagement: "Partner", version: s.version });
    assert.equal(ok.status, 200, ok.text);
    const a = await one(`SELECT before_json, after_json FROM audit_event WHERE entity = 'stakeholder' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [ID]);
    assert.match(JSON.stringify(a.before_json), /Sceptic/);
    assert.match(JSON.stringify(a.after_json), /Supporter/);
    const viewer = await as("viewerGRU");
    assert.equal((await viewer.patch("/api/stakeholders/" + ID, { note: "x", version: 2 })).status, 403);
    assert.equal((await silva.del("/api/stakeholders/" + ID)).status, 200);
  });
});

describe("PM-11 · le plan de communication", () => {
  test("une ligne par audience, avec sa prochaine échéance, lue à l'écran", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const r = await pmo.post("/api/comms", {
      project: p.id, audience: "Branch managers, Toronto", purpose: "cutover weekend and what changes on Monday",
      channel: "town hall", frequency: "once, T-14", owner: p.pm, nextOn: "2026-08-01",
    });
    assert.equal(r.status, 201, r.text);
    const db2 = (await pmo.get("/api/bootstrap")).body.db;
    const c = db2.comms.find((x) => x.id === r.body.id);
    assert.equal(c.nextOn, "2026-08-01");
    assert.equal(c.owner, p.pm);
    const upd = await pmo.patch("/api/comms/" + c.id, { nextOn: "2026-09-15", frequency: "monthly", version: c.version });
    assert.equal(upd.status, 200, upd.text);
    assert.equal((await pmo.post("/api/comms", { project: p.id, audience: "" })).status, 400);
    assert.equal((await pmo.del("/api/comms/" + c.id)).status, 200);
    assert.equal((await pmo.del("/api/comms/" + c.id)).status, 404);
  });
});

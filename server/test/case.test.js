/**
 * PM-03 · Le cas d'affaire, tenu comme un enregistrement.
 *
 * La chaîne demande → cas d'affaire → bénéfice → revue était rompue en
 * son milieu : le cas n'existait que comme type de document. Ces tests
 * tiennent ce qui la referme :
 *
 *   · qui paie écrit et reconfirme ; qui livre ne fait ni l'un ni l'autre ;
 *   · la reconfirmation est un acte daté, à un jalon, signé ;
 *   · un cas modifié après reconfirmation le DIT — la reconfirmation ne
 *     couvre plus le texte présent ;
 *   · on ne reconfirme pas le vide.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

const CASE = {
  summary: "Réduire de moitié le délai de localisation des campagnes LATAM.",
  expectedCost: 1.8, expectedBenefit: 0.9,
  basis: "Trois campagnes 2025, coût moyen constaté par le contrôle de gestion.",
};

describe("PM-03 · qui paie écrit", () => {
  test("un chef de site n'écrit pas la justification qu'il exécute", async () => {
    const site = await as("siteGRU");
    const r = await site.put(`/api/projects/${SITE_PROJECT_GRU}/case`, CASE);
    assert.equal(r.status, 403);
    assert.match(r.body.error, /group-level authority/i);
  });

  test("le groupe écrit le cas, avec ses deux chiffres et leur base", async () => {
    const group = await as("groupDCH");
    const r = await group.put(`/api/projects/${SITE_PROJECT_GRU}/case`, CASE);
    assert.equal(r.status, 201, r.text);

    const admin = await as("admin");
    const bc = (await admin.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    assert.ok(bc, "le cas revient dans le livre");
    assert.equal(bc.expectedCost, 1.8, "en millions, comme tout l'écran");
    assert.equal(bc.expectedBenefit, 0.9);
    assert.match(bc.basis, /contrôle de gestion/);
    assert.equal(bc.reconfirmedOn, null, "écrit n'est pas reconfirmé");
    assert.equal(bc.staleSinceReconfirm, false);
  });

  test("un cas sans justification est refusé — les chiffres ne suffisent pas", async () => {
    const group = await as("groupDCH");
    const r = await group.put(`/api/projects/${SITE_PROJECT_GRU}/case`,
      { summary: "   ", expectedCost: 2 });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /justification/i);
  });
});

describe("PM-03 · la justification continue", () => {
  test("reconfirmer est un acte daté, à un jalon, signé — et tracé", async () => {
    const group = await as("groupDCH");
    const bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    const r = await group.post(`/api/projects/${SITE_PROJECT_GRU}/case/reconfirm`,
      { gate: 2, version: bc.version });
    assert.equal(r.status, 200, r.text);

    const row = await one(
      `SELECT reconfirmed_gate, reconfirmed_on, reconfirmed_by
         FROM business_case WHERE project_id = $1`, [SITE_PROJECT_GRU]);
    assert.equal(row.reconfirmed_gate, 2);
    assert.ok(row.reconfirmed_on && row.reconfirmed_by, "daté et signé");

    const trail = await one(
      `SELECT action, detail FROM audit_event WHERE action = 'Business case reconfirmed'
        ORDER BY id DESC LIMIT 1`);
    assert.match(trail.detail, /still worth doing, at gate 2/);
  });

  test("le site ne reconfirme pas non plus", async () => {
    const site = await as("siteGRU");
    const admin = await as("admin");
    const bc = (await admin.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    const r = await site.post(`/api/projects/${SITE_PROJECT_GRU}/case/reconfirm`,
      { gate: 2, version: bc.version });
    assert.equal(r.status, 403,
      "« cela vaut encore la peine » est la parole de qui paie, pas de qui livre");
  });

  test("modifié après reconfirmation, le cas le dit", async () => {
    const group = await as("groupDCH");
    let bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    const r = await group.put(`/api/projects/${SITE_PROJECT_GRU}/case`,
      { ...CASE, expectedCost: 2.4, version: bc.version });
    assert.equal(r.status, 200, r.text);

    bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    assert.equal(bc.expectedCost, 2.4);
    assert.equal(bc.staleSinceReconfirm, true,
      "la reconfirmation d'hier ne couvre pas le chiffre d'aujourd'hui");
    assert.equal(bc.reconfirmedGate, 2,
      "…mais l'acte passé n'est pas effacé : il a eu lieu, il est daté");
  });

  test("on ne reconfirme pas un cas qui n'existe pas", async () => {
    const group = await as("groupCBP");
    /* PRJ-101 (CBP) n'a pas de cas d'affaire. */
    const r = await group.post(`/api/projects/PRJ-101/case/reconfirm`, { gate: 1, version: 1 });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /write it first/i,
      "reconfirmer le vide est le geste de complaisance que PM-03 ferme");
  });
});

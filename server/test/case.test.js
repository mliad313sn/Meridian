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

  test("REQ-22 · un jalon ne se franchit pas sur un cas non reconfirmé à CE jalon", async () => {
    const group = await as("groupDCH");
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    /* Le projet porte un cas, reconfirmé au jalon 2 par les tests
       ci-dessus — et rien au jalon 3. */
    const gates = db.milestones
      .filter((m) => m.project === SITE_PROJECT_GRU && m.kind === "gate" && !m.done)
      .sort((a, b) => a.gate - b.gate);
    const next = gates.find((m) => m.gate === 3) ?? gates[0];
    assert.ok(next, "il reste un jalon de gouvernance à franchir");

    const refused = await group.patch(`/api/milestones/${next.id}`,
      { done: true, acceptedBy: db.people[0].id, version: next.version });
    assert.equal(refused.status, 409, refused.text);
    assert.match(refused.body.error, new RegExp(`not been reconfirmed at gate ${next.gate}`),
      "et le refus dit quoi faire, pas seulement non");
    assert.match(refused.body.error, /reconfirm the case at this gate first/);

    /* Reconfirmé à CE jalon, le même geste passe. */
    let bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    const ok = await group.post(`/api/projects/${SITE_PROJECT_GRU}/case/reconfirm`,
      { gate: next.gate, verdict: "Continue", version: bc.version });
    assert.equal(ok.status, 200, ok.text);
    /* L'écart avec la reconfirmation précédente est ce qui rend le geste
       utile plutôt que rituel. */
    assert.equal(ok.body.delta.sinceGate, 2);
    assert.equal(typeof ok.body.delta.cost, "number");

    const after = (await admin.get("/api/bootstrap")).body.db.milestones.find((m) => m.id === next.id);
    const passed = await group.patch(`/api/milestones/${next.id}`,
      { done: true, acceptedBy: db.people[0].id, version: after.version });
    assert.equal(passed.status, 200, passed.text);

    /* Et la suite se lit : une ligne par jalon, avec les deux chiffres
       qu'elle a vus. */
    const rec = (await admin.get("/api/bootstrap")).body.db.caseReconfirmations
      .filter((r) => r.project === SITE_PROJECT_GRU);
    assert.ok(rec.length >= 1);
    const atGate = rec.find((r) => r.gate === next.gate);
    assert.ok(atGate, "la reconfirmation de ce jalon est dans le livre");
    assert.equal(atGate.verdict, "Continue");
    assert.equal(typeof atGate.expectedCost, "number", "en millions, comme tout l'écran");
  });

  test("REQ-22 · « arrêter » n'est pas décoratif : le jalon suivant est refusé", async () => {
    const group = await as("groupDCH");
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const next = db.milestones
      .filter((m) => m.project === SITE_PROJECT_GRU && m.kind === "gate" && !m.done)
      .sort((a, b) => a.gate - b.gate)[0];
    if (!next) return;                       // le livre a franchi toute son échelle

    const bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    const stop = await group.post(`/api/projects/${SITE_PROJECT_GRU}/case/reconfirm`,
      { gate: next.gate, verdict: "Stop", note: "The venue withdrew the fine regime.", version: bc.version });
    assert.equal(stop.status, 200, stop.text);

    const refused = await group.patch(`/api/milestones/${next.id}`,
      { done: true, acceptedBy: db.people[0].id, version: next.version });
    assert.equal(refused.status, 409, refused.text);
    assert.match(refused.body.error, /decided to end/);
  });

  test("REQ-22 · la reconfirmation suit l'échelle du programme, pas les quatre jalons de 2024", async () => {
    const group = await as("groupDCH");
    const bc = (await group.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === SITE_PROJECT_GRU);
    /* La 028 bornait à `BETWEEN 1 AND 4` : un programme à six jalons ne
       pouvait pas reconfirmer son cas aux jalons 5 et 6, et la contrainte
       refusait la ligne sans rien expliquer. */
    const r = await group.post(`/api/projects/${SITE_PROJECT_GRU}/case/reconfirm`,
      { gate: 99, version: bc.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /on this project's ladder/);
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

/**
 * V-15 — porter la promesse par-dessus la conversion.
 *
 * Rapport de terrain RT365 : « La route copie les quatre notes,
 * `est_cost → budget` et `detail → description`, et laisse tomber
 * `benefit_note` — le champ dont le commentaire de schéma dit "ce à quoi
 * ça SERT, dans les mots du demandeur" — et ne crée aucun cas d'affaire.
 * L'en-tête de la 028 décrit la chaîne demande → cas → bénéfice → revue ;
 * la conversion est l'endroit où cette chaîne se rompt, au moment exact
 * où l'argent est engagé et où la justification est la plus fraîche. »
 */
describe("V-15 · la demande devient un projet, et sa promesse la suit", () => {
  test("le cas est créé, porte les mots du demandeur et cite la demande", async () => {
    const pmo = await as("pmo");
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;

    const d = await pmo.post("/api/demand", {
      title: "Retire the overnight reconciliation",
      detail: "Two people spend every morning on it.",
      benefitNote: "So that nobody starts their day undoing last night.",
      estCost: 0.6, programme: db.programmes[0].id, site: db.sites[0].id,
    });
    assert.equal(d.status, 201, d.text);
    const raised = (await pmo.get("/api/demand")).body.demand.find((x) => x.id === d.body.id);
    const ok = await pmo.patch(`/api/demand/${d.body.id}`, { status: "Approved", version: raised.version });
    assert.equal(ok.status, 200, ok.text);

    const conv = await pmo.post(`/api/demand/${d.body.id}/convert`, {
      start: "2026-10-01", finish: "2027-03-31", governanceLevel: "group",
    });
    assert.equal(conv.status, 201, conv.text);

    const bc = (await admin.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === conv.body.id);
    assert.ok(bc, "la chaîne demande → cas ne se rompt plus à son premier maillon");
    assert.equal(bc.summary, "So that nobody starts their day undoing last night.",
      "les mots du demandeur, pas une reformulation");
    assert.equal(bc.expectedCost, 0.6, "et ce que la demande estimait, en millions");
    assert.match(bc.basis, new RegExp(d.body.id), "le cas se relit jusqu'à la demande qui l'a justifié");
    assert.equal(bc.reconfirmedOn, null, "porté n'est pas reconfirmé");
  });

  test("une demande sans promesse donne un brouillon qui le dit, jamais une justification inventée", async () => {
    const pmo = await as("pmo");
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;

    const d = await pmo.post("/api/demand", {
      title: "Replace the tape library", detail: "It is out of support.",
      estCost: 0.2, programme: db.programmes[0].id, site: db.sites[0].id,
    });
    assert.equal(d.status, 201, d.text);
    const raised2 = (await pmo.get("/api/demand")).body.demand.find((x) => x.id === d.body.id);
    await pmo.patch(`/api/demand/${d.body.id}`, { status: "Approved", version: raised2.version });
    const conv = await pmo.post(`/api/demand/${d.body.id}/convert`, {
      start: "2026-10-01", finish: "2027-01-31", governanceLevel: "group",
    });
    assert.equal(conv.status, 201, conv.text);

    const bc = (await admin.get("/api/bootstrap")).body.db.businessCases
      .find((c) => c.project === conv.body.id);
    assert.ok(bc, "la conversion réussit quand même");
    assert.match(bc.summary, /stated no benefit/,
      "le brouillon dit qu'il en est un — fabriquer une justification serait pire que n'en avoir aucune");
    assert.match(bc.summary, /before the next gate/);
  });
});

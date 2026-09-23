/**
 * (docs/36 NEW-03 — this file was written as governance.test.js on the
 * KODO line and REPLACED the seventeen segregation-of-duties tests that
 * file held. Both now stand: those are back in governance.test.js, these
 * live here.)
 *
 * MER-05, 06, 07, 08, 09, 10, 11 — ce qu'une revue produit, qui a le
 * droit de dire non, et ce qu'une décision coûte à défaire.
 *
 * Les sept constats venaient du même comité de recette et disaient la
 * même chose : Meridian tenait un PORTEFEUILLE et ne tenait pas encore
 * une GOUVERNANCE. Le portefeuille répond « où en est-on ». La
 * gouvernance répond « qui a décidé, sur quelle preuve, contre quel
 * avis, et que coûterait le retour en arrière ».
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, client } from "./harness.js";
import { Engine } from "../../shared/engine.js";

let base;
before(async () => { ({ base } = await boot()); });
after(shutdown);

async function admin() {
  const c = client();
  await c.post("/api/auth/login",
    { email: "admin@meridian.example", password: "meridian-admin-2026" });
  return c;
}

function book(over = {}) {
  return {
    orgName: "TEST", statusDate: "2026-08-28", currencyUnit: "millions",
    sites: [{ id: "S1", city: "Ici", tz: 0 }],
    people: [{ id: "PE-1", name: "A. Personne", role: "PM", site: "S1", rate: 0 },
             { id: "PE-2", name: "B. Personne", role: "QA", site: "S1", rate: 0 }],
    programmes: [{ id: "P1", name: "Programme", managerId: "PE-1" }],
    projects: [{
      id: "X", name: "Projet", programme: "P1", site: "S1",
      governanceLevel: "group", pm: "PE-1", method: "Hybrid",
      start: "2026-01-01", finish: "2026-12-31", budget: 4,
      phase: "Execution", gate: 1, closed: false,
    }],
    activities: [], milestones: [], ledger: [], raid: [], crs: [],
    docs: [], items: [], columns: [], allocations: [],
    ...over,
  };
}

describe("MER-09 · la monnaie dit son unité", () => {
  test("un livre qui ne déclare pas son unité est refusé, et le refus explique", async () => {
    const c = await admin();
    const { currencyUnit, ...noUnit } = book();
    const r = await c.post("/api/admin/import", { db: noUnit });
    assert.equal(r.status, 400);
    /* Le refus doit nommer le champ ET la conséquence : « 4 vaut quatre
       millions dans une lecture et quatre euros dans l'autre » est ce
       qui fait comprendre pourquoi deviner n'est pas une option. */
    assert.match(r.body.error, /currencyUnit/);
    assert.match(r.body.error, /millions/);
  });

  test("« units » et « millions » ne chargent pas le même budget", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({ currencyUnit: "millions" }) });
    const inM = (await c.get("/api/bootstrap")).body.db.projects.find(p => p.id === "X").budget;

    await c.post("/api/admin/import", { db: book({ currencyUnit: "units" }) });
    const inUnits = (await c.get("/api/bootstrap")).body.db.projects.find(p => p.id === "X").budget;

    /* C'est exactement la corruption silencieuse que le constat
       décrivait : un facteur d'un million entre deux lectures du même
       chiffre. Elle est maintenant DÉCLARÉE, donc elle n'arrive plus
       par accident. */
    assert.equal(inM, 4);
    assert.equal(Math.round(inUnits * 1_000_000), 4);
  });

  test("un livre exporté d'ici se réimporte : il dit son unité", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book() });
    const exported = (await c.get("/api/admin/export")).body;
    assert.equal(exported.currencyUnit, "millions");
    const back = await c.post("/api/admin/import", { db: exported });
    assert.equal(back.status, 200);
  });
});

describe("MER-08 · l'import à blanc et la fusion", () => {
  test("une simulation n'écrit rien et dit ce qu'elle écrirait", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book() });
    const before = (await c.get("/api/bootstrap")).body.db.projects.length;

    const dry = await c.post("/api/admin/import?dryRun=1",
      { db: book({ projects: [...book().projects,
        { id: "Y", name: "Autre", programme: "P1", site: "S1", governanceLevel: "site",
          pm: "PE-1", method: "Hybrid", start: "2026-01-01", finish: "2026-12-31",
          budget: 1, phase: "Initiation", gate: 1, closed: false }] }) });

    assert.equal(dry.status, 200);
    assert.equal(dry.body.dryRun, true);
    assert.equal(dry.body.counts.projects, 2);
    const after = (await c.get("/api/bootstrap")).body.db.projects.length;
    assert.equal(after, before, "une simulation qui écrit n'est pas une simulation");
  });

  test("la simulation subit les contraintes : elle refuse ce que l'import refuserait", async () => {
    const c = await admin();
    const dry = await c.post("/api/admin/import?dryRun=1", { db: book({
      findings: [{ id: "F-1", project: "X", observedFact: "vu", severity: "S2",
                   raisedOn: "2026-08-01", status: "Closed" }],
    }) });
    assert.equal(dry.status, 200);
    /* LE constat : un constat se ferme sur une preuve de re-test, jamais
       sur un correctif fusionné. La simulation le dit AVANT que
       quiconque ait détruit le livre en place. */
    assert.equal(dry.body.rejects.length, 1);
    assert.match(dry.body.rejects[0].reason, /re-test evidence/);
  });

  test("la fusion met à jour par identifiant et laisse survivre le reste", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({
      projects: [...book().projects,
        { id: "KEEP", name: "Saisi à la main", programme: "P1", site: "S1",
          governanceLevel: "site", pm: "PE-1", method: "Hybrid",
          start: "2026-01-01", finish: "2026-12-31", budget: 1,
          phase: "Initiation", gate: 1, closed: false }] }) });

    const merged = await c.post("/api/admin/import?mode=merge", { db: book({
      projects: [{ ...book().projects[0], name: "Projet, renommé" }] }) });
    assert.equal(merged.status, 200);

    const after = (await c.get("/api/bootstrap")).body.db.projects;
    assert.equal(after.find(p => p.id === "X").name, "Projet, renommé");
    assert.ok(after.find(p => p.id === "KEEP"),
      "la fusion existe précisément pour que ceci survive à une régénération");
  });
});

describe("MER-05 · un constat n'est ni un risque ni une leçon", () => {
  test("un constat fait l'aller-retour, fait observé et conséquence séparés", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({
      evidence: [{ id: "EV-1", project: "X", kind: "ci_run", name: "CI 4711",
                   uri: "https://ci.example/4711", capturedOn: "2026-08-20" }],
      findings: [{ id: "F-1", project: "X", observedFact: "La palette ne se ferme pas au clavier",
                   whyItMatters: "Un enfant au clavier reste enfermé dans la palette",
                   severity: "S2", owner: "PE-2", proposedFix: "Échap ferme",
                   raisedOn: "2026-08-01", retestOn: "2026-09-01", status: "Re-test" }],
    }) });
    const db = (await c.get("/api/bootstrap")).body.db;
    const f = db.findings.find(x => x.id === "F-1");
    assert.equal(f.observedFact, "La palette ne se ferme pas au clavier");
    assert.equal(f.whyItMatters, "Un enfant au clavier reste enfermé dans la palette");
    assert.equal(f.severity, "S2");
    assert.equal(f.retestOn, "2026-09-01");
    /* Il n'a PAS de probabilité, et c'est le sujet du constat : un
       risque ne s'est pas produit, un constat si. */
    assert.equal(f.p, undefined);
  });

  test("un constat sévère et ouvert monte dans la liste d'attention", () => {
    const db = { statusDate: "2026-09-19", projects: [], milestones: [], docs: [],
                 settings: { gateLock: false, capacityAlerts: false },
                 raid: [], crs: [], exceptions: [], findings: [
      { id: "F-1", project: "X", observedFact: "vu", severity: "S1",
        status: "Open", retestOn: "2026-09-01" },
      { id: "F-2", project: "X", observedFact: "vu aussi", severity: "S3", status: "Open" },
      { id: "F-3", project: "X", observedFact: "réglé", severity: "S1", status: "Closed" },
    ] };
    const feed = Engine.decisions(db, db.projects).filter(a => a.kind === "Review finding");
    assert.deepEqual(feed.map(a => a.entityId), ["F-1"]);
    assert.equal(feed[0].urgent, true, "re-test dépassé et S1");
  });

  test("un élément de travail garde sa source et son score", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({
      columns: [{ id: "todo", name: "À faire", wip: 0 }],
      items: [{ id: "WI-1", project: "X", column: "todo", title: "Réduire le temps de démarrage",
                source: "panel enfants", score: 42.5, scoreMethod: "RICE" }],
    }) });
    const db = (await c.get("/api/bootstrap")).body.db;
    const i = db.items.find(x => x.id === "WI-1");
    assert.equal(i.source, "panel enfants");
    assert.equal(Number(i.score), 42.5);
    assert.equal(i.scoreMethod, "RICE");
  });
});

describe("MER-06 · l'autorité est une donnée, vetos et cumuls compris", () => {
  test("une personne ne peut pas tenir deux sièges incompatibles", async () => {
    const c = await admin();
    /* La séparation des devoirs : l'agent qui doit pouvoir refuser un
       mécanisme ne peut pas être celui qui l'a conçu. La base le refuse,
       donc c'est vrai même quand personne ne regarde. */
    const r = await c.post("/api/admin/import", { db: book({
      seats: [
        { id: "SE-13", name: "Sécurité des enfants", person: "PE-1",
          domain: "safety", vetoDomain: "safety", incompatibleWith: ["SE-09"] },
        { id: "SE-09", name: "Architecte", person: "PE-1", domain: "architecture" },
      ],
    }) });
    assert.equal(r.status, 400, "le cumul doit échouer, et le refus doit se lire");
    assert.match(r.body.error, /Segregation of duties|two incompatible seats/i);
  });

  test("un veto ouvert bloque le franchissement même quand la preuve est complète", () => {
    const db = {
      statusDate: "2026-09-19",
      /* Un seul jalon déclaré, pour que « le jalon courant » soit
         celui dont la preuve est complète : le sujet du test est le
         veto, pas le choix du jalon. */
      settings: { gateLock: true, gates: [{ n: 1, name: "Revue de conception" }] },
      projects: [{ id: "X", name: "Projet", loop: 1 }],
      docs: [{ id: "D-1", project: "X", gate: 1, status: "Approved", loop: 1,
               type: "Assurance", uri: "https://docs.example/d1" }],
      milestones: [{ id: "M-1", project: "X", gate: 1, date: "2026-01-01", loop: 1 }],
      /* Le siège 13 du comité KODO tient son veto À CHAQUE jalon : un
         domaine, pas un numéro de porte. */
      seats: [{ id: "SE-13", name: "Child safety officer", person: "PE-1",
                domain: "child safety", vetoDomain: "child safety" }],
      objections: [{ id: "OBJ-1", decision: "DEC-001", seat: "SE-13", domain: "child safety",
                     reason: "Le mécanisme compare les enfants entre eux", state: "open" }],
    };
    // La preuve EST complète : c'est ce qui rend le test intéressant.
    assert.equal(Engine.gateStatus(db, "X", 1, 1).state, "Cleared");
    const out = Engine.canAdvance(db, "X");
    assert.equal(out.ok, false);
    assert.match(out.reason, /Child safety officer/);
    assert.match(out.reason, /compare les enfants/);
    /* Et la levée de l'objection rend le franchissement possible : le
       veto n'est pas un blocage permanent, c'est une question ouverte. */
    db.objections[0].state = "resolved";
    assert.equal(Engine.canAdvance(db, "X").ok, true);
  });
});

describe("MER-07 · l'objection, le coût de retour, la supersession", () => {
  test("une objection sans raison est refusée : c'est un vote, pas une objection", async () => {
    const c = await admin();
    const dry = await c.post("/api/admin/import?dryRun=1", { db: book({
      objections: [{ id: "OBJ-1", decision: "DEC-001", reason: "   " }],
    }) });
    assert.equal(dry.body.rejects.length, 1);
    assert.match(dry.body.rejects[0].reason, /not an objection/);
  });

  test("une objection non résolue a une horloge et monte sur l'ordre du jour", () => {
    const db = { statusDate: "2026-09-19", projects: [], milestones: [], docs: [],
                 settings: { gateLock: false, capacityAlerts: false },
                 raid: [], crs: [], exceptions: [], findings: [], objections: [
      { id: "OBJ-1", decision: "DEC-001", domain: "safety", state: "open",
        reason: "Non", escalatesOn: "2026-09-10" },
      { id: "OBJ-2", decision: "DEC-002", domain: "safety", state: "withdrawn", reason: "Non" },
    ] };
    const feed = Engine.decisions(db, db.projects).filter(a => a.kind === "Objection");
    assert.deepEqual(feed.map(a => a.entityId), ["OBJ-1"]);
    assert.equal(feed[0].urgent, true, "l'échéance d'escalade est passée");
  });
});

describe("MER-02 · un jalon peut porter sur plus qu'un projet", () => {
  /* Une autorisation de mise en service franchit pour un programme
     entier. La découper par projet la rend fausse : chaque projet se
     déclare franchi pendant que la revue qui les concerne tous ne s'est
     pas tenue. */
  const scoped = () => ({
    statusDate: "2026-09-19",
    settings: { gateLock: true, gates: [{ n: 1, name: "Mise en service", scope: "programme" }] },
    projects: [{ id: "X", name: "Un", programme: "P1", loop: 1 },
               { id: "Y", name: "Deux", programme: "P1", loop: 1 }],
    docs: [
      { id: "D-1", project: "X", gate: 1, status: "Approved", loop: 1,
        uri: "https://docs.example/d1" },
      { id: "D-2", project: "Y", gate: 1, status: "Draft", loop: 1,
        uri: "https://docs.example/d2" },
    ],
    milestones: [{ id: "M-1", project: "X", gate: 1, date: "2026-01-01", loop: 1 },
                 { id: "M-2", project: "Y", gate: 1, date: "2026-01-01", loop: 1 }],
  });

  test("le projet prêt ne franchit pas seul un jalon de programme", () => {
    const db = scoped();
    // Vu comme un jalon de projet, X est franchi.
    assert.equal(Engine.gateStatus(db, "X", 1, 1).state, "Cleared");
    // Vu à sa vraie portée, il ne l'est pas : Y n'a pas la sienne.
    assert.equal(Engine.scopedGateStatus(db, "X", 1, 1, "programme").state, "Overdue");
    assert.equal(Engine.canAdvance(db, "X").ok, false);
  });

  test("le refus nomme la pièce manquante ET le projet qui la doit", () => {
    const out = Engine.canAdvance(scoped(), "X");
    assert.ok(out.items.length, "un refus sans pièce nommée est inutilisable");
    assert.equal(out.items[0].projectName, "Deux");
  });

  test("le jalon franchit quand chaque projet de la portée porte sa preuve", () => {
    const db = scoped();
    db.docs[1].status = "Approved";
    assert.equal(Engine.scopedGateStatus(db, "X", 1, 1, "programme").state, "Cleared");
  });

  test("sans portée déclarée, rien ne change : un jalon reste un jalon de projet", () => {
    const db = scoped();
    db.settings.gates = [{ n: 1, name: "Mise en service" }];
    assert.equal(Engine.gateModel(db)[0].scope, "project");
    assert.equal(Engine.currentGate(db, "X").state, "Cleared");
  });
});

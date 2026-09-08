/**
 * I-3 · L'ÉCHELLE DE JALONS DU PROGRAMME — I-4 · LES CRITÈRES D'UN JALON
 * (retour de terrain RT365, docs/33 · M-04 · M-06)
 *
 * Le premier programme réel avait six portes A–F et a dû les poser comme
 * jalons ordinaires À CÔTÉ des quatre de Meridian ; et « voir preuve
 * 0/1 » ne disait pas quel critère la preuve satisfait ni qui l'a revu.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { many, one } from "../src/db.js";
import { GATES, normaliseGateModel, parseGateLadder, formatGateLadder, Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

const LADDER = [
  { name: "Gate A — Discovery", owner: "Product Owner", evidence: "approved charter, personas, measurable outcomes", at: 0.08 },
  { name: "Gate B — Design", owner: "ARB", evidence: "threat model, data flows, ADRs", at: 0.25 },
  { name: "Gate C — Sim", owner: "IVA", evidence: "broker sandbox certification, deterministic risk tests", at: 0.45 },
  { name: "Gate D — Shadow", owner: "IVA", evidence: "independent quant validation, security assessment", at: 0.6 },
  { name: "Gate E — Pilot", owner: "Board", evidence: "capital envelope, runtime monitoring", at: 0.8 },
  { name: "Gate F — GA", owner: "Board", evidence: "no unresolved critical, release dossier", at: 0.95 },
];

describe("I-3 · l'échelle est une donnée du programme", () => {
  test("la validation partagée refuse ce qui cloche, et dit lequel", () => {
    assert.equal(normaliseGateModel(null), null, "null = l'échelle par défaut");
    assert.equal(normaliseGateModel([]), null);
    assert.throws(() => normaliseGateModel([{ name: "", at: 0.2 }]), /Gate 1 needs a name/);
    assert.throws(() => normaliseGateModel([{ name: "A", at: 0.5 }, { name: "B", at: 0.4 }]), /after the previous/);
    assert.throws(() => normaliseGateModel([{ name: "A", at: 1 }]), /between 0 and 1/);
    const m = normaliseGateModel(LADDER);
    assert.equal(m.length, 6);
    assert.deepEqual(m.map((g) => g.n), [1, 2, 3, 4, 5, 6]);
    /* Le texte tapé par l'administrateur fait l'aller-retour. */
    const back = parseGateLadder(formatGateLadder(m));
    assert.deepEqual(back.map((g) => [g.name, g.at]), m.map((g) => [g.name, g.at]));
    assert.equal(parseGateLadder("   "), null);
    assert.throws(() => parseGateLadder("Only a name"), /between 0 and 1/);
  });

  test("un programme déclare six portes ; un projet neuf y naît avec six jalons, six preuves, ses critères", async () => {
    const admin = await as("admin");
    const bad = await admin.post("/api/admin/programmes", { id: "RBT", name: "RoboTrader", gateModel: [{ name: "x", at: 2 }] });
    assert.equal(bad.status, 400); assert.match(bad.body.error, /between 0 and 1/);
    const r = await admin.post("/api/admin/programmes", { id: "RBT", name: "RoboTrader", gateModel: LADDER });
    assert.equal(r.status, 201, r.text);
    const db = (await admin.get("/api/bootstrap")).body.db;
    const pr = db.programmes.find((x) => x.id === "RBT");
    assert.equal(pr.gateModel.length, 6, "le sérialiseur expose l'échelle");
    assert.equal(pr.gateModel[5].name, "Gate F — GA");
    const site = db.sites[0].id;
    const made = await admin.post("/api/projects", {
      name: "E01 Foundation", programme: "RBT", site, governanceLevel: "group",
      start: "2026-09-07", finish: "2027-06-30",
    });
    assert.equal(made.status, 201, made.text);
    const gates = await many(`SELECT name, gate, due_date FROM milestone WHERE project_id = $1 AND kind = 'gate' ORDER BY gate`, [made.body.id]);
    assert.equal(gates.length, 6);
    assert.equal(gates[0].name, "Gate A — Discovery");
    assert.equal(gates[5].name, "Gate F — GA");
    assert.ok(gates[0].due_date < gates[5].due_date);
    const docs = await many(`SELECT gate, doc_type FROM document WHERE project_id = $1 ORDER BY gate`, [made.body.id]);
    assert.equal(docs.length, 6);
    assert.equal(docs[5].doc_type, "Closure", "la dernière porte est la clôture, quel que soit son rang");
    const crit = await many(`SELECT gate, text FROM gate_criterion WHERE project_id = $1 ORDER BY gate, seq`, [made.body.id]);
    assert.equal(crit.filter((c) => c.gate === 1).length, 3, "trois preuves attendues → trois critères posés");
    assert.equal(crit[0].text, "Approved charter");
    /* Le moteur parcourt l'échelle du programme. */
    const db2 = (await admin.get("/api/bootstrap")).body.db;
    assert.equal(Engine.gates(db2, made.body.id).length, 6);
    assert.equal(Engine.gates(db2, GROUP_PROJECT), GATES, "un programme sans échelle garde les quatre de toujours");
    assert.equal(Engine.currentGate(db2, made.body.id).name, "Gate A — Discovery");
    assert.equal(Engine.maxGates(db2), 6);
  });

  test("changer l'échelle ensuite ne réécrit pas les projets ; la vider revient au défaut", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const pr = db.programmes.find((x) => x.id === "RBT");
    const r = await admin.patch("/api/admin/programmes/RBT", { gateModel: null, version: pr.version });
    assert.equal(r.status, 200, r.text);
    const db2 = (await admin.get("/api/bootstrap")).body.db;
    assert.equal(db2.programmes.find((x) => x.id === "RBT").gateModel, null);
    const proj = db2.projects.find((p) => p.programme === "RBT");
    assert.equal(db2.milestones.filter((m) => m.project === proj.id && m.kind === "gate").length, 6, "les jalons déjà nés restent");
  });
});

describe("I-4 · un critère se pose d'avance et se constate par un nom", () => {
  let PROJ, CRIT, DOC;
  test("poser, reformuler, relier une preuve", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    PROJ = db.projects.find((p) => p.id === GROUP_PROJECT);
    assert.equal(db.criteria.filter((c) => c.project === PROJ.id).length, 0, "un projet d'avant n'a aucun critère — rien ne change pour lui");
    const r = await pmo.post("/api/criteria", { project: PROJ.id, gate: 1, text: "the charter names a sponsor and a budget owner" });
    assert.equal(r.status, 201, r.text);
    CRIT = r.body.id;
    assert.match(CRIT, /^GC-\d+$/);
    DOC = db.docs.find((d) => d.project === PROJ.id && d.gate === 1);
    const c1 = await pmo.patch(`/api/criteria/${CRIT}`, { text: "The charter names a sponsor AND a budget owner", document: DOC.id, version: 1 });
    assert.equal(c1.status, 200, c1.text);
    const other = db.docs.find((d) => d.project && d.project !== PROJ.id);
    const wrong = await pmo.patch(`/api/criteria/${CRIT}`, { document: other.id, version: 2 });
    assert.equal(wrong.status, 400, "une preuve d'un autre projet ne se relie pas");
  });

  test("le jalon n'est plus prêt tant que le critère n'est pas tenu ; le tenir exige un réviseur indépendant", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const st = Engine.gateStatus(db, PROJ.id, 1);
    assert.equal(st.criteria.length, 1);
    assert.equal(st.criteriaMet, 0);
    assert.equal(st.ready, false);
    const adv = Engine.canAdvance(db, PROJ.id);
    if (!adv.ok) assert.match(adv.reason, /criterion|evidence/);
    const noWho = await pmo.patch(`/api/criteria/${CRIT}`, { met: true, version: 2 });
    assert.equal(noWho.status, 400); assert.match(noWho.body.error, /reviewedBy/);
    const doc = await one(`SELECT owner_id FROM document WHERE id = $1`, [DOC.id]);
    if (doc.owner_id) {
      const self = await pmo.patch(`/api/criteria/${CRIT}`, { met: true, reviewedBy: doc.owner_id, version: 2 });
      assert.equal(self.status, 400, "le propriétaire de la preuve ne constate pas son propre critère");
      assert.match(self.body.error, /independent/);
    }
    const reviewer = db.people.find((x) => x.id !== doc.owner_id);
    const ok = await pmo.patch(`/api/criteria/${CRIT}`, { met: true, reviewedBy: reviewer.id, version: 2 });
    assert.equal(ok.status, 200, ok.text);
    const db2 = (await pmo.get("/api/bootstrap")).body.db;
    const c = db2.criteria.find((x) => x.id === CRIT);
    assert.equal(c.met, true); assert.equal(c.reviewedBy, reviewer.id); assert.ok(c.reviewedOn);
    assert.equal(Engine.gateStatus(db2, PROJ.id, 1).criteriaMet, 1);
    const audit = await one(`SELECT action FROM audit_event WHERE entity = 'gate_criterion' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [CRIT]);
    assert.equal(audit.action, "Gate criterion met");
  });

  test("un critère tenu ne se retire pas ; le site ne constate pas une preuve de gouvernance groupe", async () => {
    const pmo = await as("pmo");
    const del = await pmo.del(`/api/criteria/${CRIT}`);
    assert.equal(del.status, 409);
    const silva = await as("siteGRU");
    const db = (await silva.get("/api/bootstrap")).body.db;
    const c = db.criteria.find((x) => x.id === CRIT);
    assert.ok(c, "lisible depuis le site (projet groupe visible)");
    const r = await silva.patch(`/api/criteria/${CRIT}`, { met: false, version: c.version });
    assert.equal(r.status, 403);
    /* La lectrice voit son site ; sur un projet qu'elle voit, le refus
       est un 403 ; sur un projet hors de ses habilitations, l'existence
       même n'est pas divulguée (R1.10 : 404, jamais 403). */
    const viewer = await as("viewerGRU");
    const { SITE_PROJECT_GRU } = await import("./harness.js");
    assert.equal((await viewer.post("/api/criteria", { project: SITE_PROJECT_GRU, gate: 1, text: "x" })).status, 403);
    assert.equal((await viewer.post("/api/criteria", { project: PROJ.id, gate: 1, text: "x" })).status, 404);
  });
});

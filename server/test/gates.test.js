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

describe("REQ-14 · une date de jalon dit sur quoi elle repose (RT365 D-057)", () => {
  test("une position n'est jamais manquée ni en retard ; un engagement l'est comme avant", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const r = await pmo.post("/api/milestones", {
      project: p.id, name: "Gate C — Sim (placeholder)", date: "2026-01-15",
      dateBasis: "placeholder", condition: "the capacity model, measured at gate B",
    });
    assert.equal(r.status, 201, r.text);
    const bad = await pmo.post("/api/milestones", { project: p.id, name: "x", date: "2026-01-15", dateBasis: "guess" });
    assert.equal(bad.status, 400);
    const db2 = (await pmo.get("/api/bootstrap")).body.db;
    const ms = db2.milestones.find((m) => m.id === r.body.id);
    assert.equal(ms.dateBasis, "placeholder");
    assert.match(ms.condition, /capacity/);
    /* L'ordre du jour : la date est passée, et pourtant PAS « MANQUÉ ». */
    const { buildAgenda } = await import("../../shared/meetings.js");
    const agenda = buildAgenda(db2, { id: "MS-GRP-W", cadence: "weekly", scopeKind: "group" }, { meetsOn: "2026-01-20" }, []);
    const flat = JSON.stringify(agenda.sections.find((s) => s.key === "milestones") ?? {});
    assert.ok(!/MISSED · Gate C — Sim/.test(flat), "une position n'est pas un manquement");
    /* Devenue un engagement, la même date est manquée. */
    const c = await pmo.patch("/api/milestones/" + ms.id, { dateBasis: "committed", version: ms.version });
    assert.equal(c.status, 200, c.text);
    const db3 = (await pmo.get("/api/bootstrap")).body.db;
    const agenda2 = buildAgenda(db3, { id: "MS-GRP-W", cadence: "weekly", scopeKind: "group" }, { meetsOn: "2026-01-20" }, []);
    assert.ok(/MISSED · Gate C — Sim/.test(JSON.stringify(agenda2.sections.find((s) => s.key === "milestones"))));
  });

  test("un jalon de gouvernance en position n'est ni Overdue ni Cleared par le calendrier seul", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const g1 = db.milestones.find((m) => m.project === p.id && m.gate === 1);
    const { Engine } = await import("../../shared/engine.js");
    const before = Engine.gateStatus(db, p.id, 1).state;
    const r = await pmo.patch("/api/milestones/" + g1.id, { dateBasis: "placeholder", condition: "sponsor's decision", version: g1.version });
    assert.equal(r.status, 200, r.text);
    const db2 = (await pmo.get("/api/bootstrap")).body.db;
    const st = Engine.gateStatus(db2, p.id, 1);
    assert.equal(st.placeholder, true);
    assert.ok(["Unscheduled"].includes(st.state), `${before} → ${st.state}`);
    assert.match(st.condition, /sponsor/);
    /* Et par l'API d'écriture, le même vocabulaire. */
    const admin = await as("admin");
    const made = await admin.post("/api/admin/integrations", { name: "Roadmap", scopes: "write:portfolio" });
    const { client } = await import("./harness.js");
    const c = client();
    const put = await c.put("/api/v1/milestones/GATE-F", { project: p.id, name: "Gate F — GA", date: "2027-06-30", dateBasis: "placeholder", condition: "no unresolved critical" }, { "X-API-Key": made.body.key });
    assert.equal(put.status, 201, put.text);
    const db3 = (await admin.get("/api/bootstrap")).body.db;
    assert.equal(db3.milestones.find((m) => m.id === put.body.id).dateBasis, "placeholder");
  });
});

/**
 * V-13 / E-1 — ce que la 036 a libéré, et que deux tables n'avaient pas
 * suivi. Rapport de terrain RT365 : « Brider en silence les deux
 * contrôles de plus grande valeur au jalon 4 est PIRE que de ne pas
 * avoir d'échelle configurable, parce que la panne est invisible jusqu'à
 * ce que quelqu'un essaie. »
 */
describe("V-13 · les objets de valeur et d'apprentissage suivent l'échelle", () => {
  test("un enseignement se rattache aux jalons 5 et 6 d'une échelle qui en compte six", async () => {
    const admin = await as("admin");
    /* Son propre programme : un test plus haut retire délibérément
       l'échelle de RBT pour montrer que la retirer ne réécrit rien, et
       s'appuyer sur l'état d'un autre test est comment on mesure autre
       chose que ce qu'on croit. */
    const db0 = (await admin.get("/api/bootstrap")).body.db;
    const pr = await admin.post("/api/admin/programmes", { id: "SIXG", name: "Six gates", gateModel: LADDER });
    assert.equal(pr.status, 201, pr.text);
    const made = await admin.post("/api/projects", {
      name: "Runs on six", programme: "SIXG", site: db0.sites[0].id,
      governanceLevel: "group", start: "2026-09-07", finish: "2027-06-30",
    });
    assert.equal(made.status, 201, made.text);
    const p = { id: made.body.id };

    for (const g of [5, 6]) {
      const r = await admin.post("/api/lessons", {
        project: p.id, gate: g, category: "Governance",
        title: `Tagged to gate ${g}`, recommendation: "Read it at the same gate next time.",
      });
      assert.equal(r.status, 201, r.text);
      const row = await one(`SELECT gate_n FROM lesson WHERE id = $1`, [r.body.id]);
      assert.equal(row.gate_n, g, "la contrainte de la 024 bridait à 4 et refusait la ligne");
    }
    /* Au-delà de l'échelle déclarée, le refus nomme la borne. */
    const over = await admin.post("/api/lessons", {
      project: p.id, gate: 7, title: "Beyond the ladder", recommendation: "x",
    });
    assert.equal(over.status, 400);
    assert.match(over.body.error, /1\.\.6/);
  });

  test("un livre à quatre jalons n'est pas touché", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => !["RBT", "SIXG", "LATE"].includes(x.programme));
    const ok = await admin.post("/api/lessons", {
      project: p.id, gate: 4, title: "Still four here", recommendation: "x",
    });
    assert.equal(ok.status, 201, ok.text);
    const over = await admin.post("/api/lessons", {
      project: p.id, gate: 5, title: "Not on this ladder", recommendation: "x",
    });
    assert.equal(over.status, 400);
    assert.match(over.body.error, /1\.\.4/);
  });
});

/**
 * E-1 — RT365 corrige ici son propre compte rendu et le nôtre : la
 * 5.10.0 ne dresse PAS deux échelles, `scaffoldProject` en lit une
 * seule ; le doublon de leur livre venait de leur chargeur. La demande,
 * plus étroite, est celle-ci : « une organisation réelle adopte un outil
 * avec des projets déjà dedans, et sans chemin de reprise, tout adoptant
 * précoce reste indéfiniment sur l'échelle par défaut, et "quel jalon
 * vient ensuite" est indéfiniment faux pour lui. » Ils demandent le
 * signal de lecture, moins cher que la reprise.
 */
describe("E-1 · un projet dit sous quelle échelle il a été dressé", () => {
  test("déclarer une échelle après coup ne réécrit rien, et se voit", async () => {
    const admin = await as("admin");
    /* Un programme SANS échelle : son projet naît sur les quatre par défaut. */
    const pr = await admin.post("/api/admin/programmes", { id: "LATE", name: "Ladder declared late" });
    assert.equal(pr.status, 201, pr.text);
    const db0 = (await admin.get("/api/bootstrap")).body.db;
    const made = await admin.post("/api/projects", {
      id: "LATE-1", name: "Adopted before the ladder", programme: "LATE",
      site: db0.sites[0].id, start: "2026-09-07", finish: "2026-12-18", governanceLevel: "group",
    });
    assert.equal(made.status, 201, made.text);

    let p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === made.body.id);
    assert.equal(p.scaffoldedGates, 4, "il a été dressé sur les quatre jalons par défaut");
    assert.equal(p.ladderDiffers, false, "et son programme n'en déclarait pas d'autre");
    const before = (await many(`SELECT id, due_date FROM milestone WHERE project_id = $1 AND kind = 'gate'`, [p.id]));
    assert.equal(before.length, 4);

    /* Le programme déclare six jalons APRÈS coup. */
    const prog = (await admin.get("/api/bootstrap")).body.db.programmes.find((x) => x.id === "LATE");
    const upd = await admin.patch("/api/admin/programmes/LATE", { gateModel: LADDER, version: prog.version });
    assert.equal(upd.status, 200, upd.text);

    const after = (await many(`SELECT id, due_date FROM milestone WHERE project_id = $1 AND kind = 'gate'`, [p.id]));
    assert.deepEqual(after.map((m) => m.id), before.map((m) => m.id),
      "036 est claire : une échelle modifiée ne réécrit pas les projets existants");

    p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === made.body.id);
    assert.equal(p.scaffoldedGates, 4);
    assert.equal(p.ladderDiffers, true,
      "…mais le produit le DIT maintenant, au lieu de laisser « quel jalon vient ensuite » être faux en silence");
  });
});

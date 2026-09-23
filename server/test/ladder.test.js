/**
 * REQ-27 · V-8 — UN PROJET DÉJÀ NÉ PASSE SUR L'ÉCHELLE DE SON PROGRAMME
 * (retour de terrain RT365)
 *
 * Le cas mesuré par RT365, reconstruit ici tel qu'ils l'ont vécu : seize
 * projets dressés AVANT que leur programme porte une échelle, six portes
 * A–F posées à la main À CÔTÉ des quatre de Meridian, et « dix jalons là
 * où six étaient voulus » — déposé comme un défaut, pas comme une
 * préférence.
 *
 * Ce que ces tests tiennent :
 *   · l'essai à blanc dit ce qui sera adopté, créé, retiré, AVANT l'acte ;
 *   · l'adoption LIE un jalon existant à un barreau, elle n'en ajoute pas
 *     un second à côté ;
 *   · un jalon que la nouvelle échelle ne reconnaît pas est RETIRÉ, jamais
 *     supprimé — et jamais en silence quand il porte une acceptation ou
 *     une preuve déposée ;
 *   · l'acte est idempotent, et le second passage du chargeur n'écrit rien
 *     de créant ;
 *   · l'autorité est décidée dans shared/rbac.js, et nulle part ailleurs.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, ACCOUNTS } from "./harness.js";
import { one, many } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* L'échelle réelle de RBT : six portes, dev → sim → shadow → paper →
   pilote → GA. */
const SIX = [
  { name: "Gate A — Dev",    owner: "Product Owner", evidence: "design note, unit evidence", at: 0.10 },
  { name: "Gate B — Sim",    owner: "ARB",           evidence: "simulation dossier",         at: 0.25 },
  { name: "Gate C — Shadow", owner: "IVA",           evidence: "shadow run report",          at: 0.40 },
  { name: "Gate D — Paper",  owner: "IVA",           evidence: "paper trading record",       at: 0.55 },
  { name: "Gate E — Pilot",  owner: "Board",         evidence: "capital envelope",           at: 0.75 },
  { name: "Gate F — GA",     owner: "Board",         evidence: "release dossier",            at: 0.92 },
];

let SITE = null, PM = null, PERSON = null;

/** A project born under a programme that declares no ladder: the default four. */
async function bornOnFour(admin, progId, projectName, site = SITE) {
  const made = await admin.post("/api/admin/programmes", { id: progId, name: progId + " programme" });
  assert.equal(made.status, 201, made.text);
  const p = await admin.post("/api/projects", {
    name: projectName, programme: progId, site, governanceLevel: "group",
    start: "2026-01-05", finish: "2026-12-18", pm: PM,
  });
  assert.equal(p.status, 201, p.text);
  return p.body.id;
}

/** Declare the six-gate ladder on a programme that already has projects. */
async function declareSix(admin, progId, ladder = SIX) {
  const pr = await one(`SELECT row_version FROM programme WHERE id = $1`, [progId]);
  const r = await admin.patch(`/api/admin/programmes/${progId}`,
    { gateModel: ladder, version: pr.row_version });
  assert.equal(r.status, 200, r.text);
}

const gatesOf = (pid) =>
  many(`SELECT id, name, gate, kind, retired_gate, done, accepted_by, acceptance_criteria, due_date
          FROM milestone WHERE project_id = $1 ORDER BY COALESCE(gate, 99), due_date, id`, [pid]);

describe("REQ-27 · l'essai à blanc dit ce qu'il fera avant de le faire", () => {
  let PID = null, PLAN = null;

  test("le livre de RT365, reconstruit : quatre portes par défaut, six posées à côté, une acceptée avec preuve", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    SITE = db.sites[0].id; PM = db.people[0].id; PERSON = db.people[1].id;

    PID = await bornOnFour(admin, "RBT", "E01 Foundation");

    /* Le projet est né sur les quatre par défaut, et le signal de lecture
       de la 043 le dit. */
    const born = await one(`SELECT scaffolded_gates FROM project WHERE id = $1`, [PID]);
    assert.equal(born.scaffolded_gates, 4);
    assert.equal((await gatesOf(PID)).filter((m) => m.kind === "gate").length, 4);

    /* La porte 3 est datée, acceptée par une personne nommée, et sa
       preuve est déposée : c'est CELLE-LÀ qui rend la migration
       dangereuse, et le test existe pour elle. */
    const g3 = (await gatesOf(PID)).find((m) => m.gate === 3);
    const v = await one(`SELECT row_version FROM milestone WHERE id = $1`, [g3.id]);
    const acc = await admin.patch(`/api/milestones/${g3.id}`, {
      acceptanceCriteria: "Operations acceptance signed", done: true,
      acceptedBy: PERSON, version: v.row_version,
    });
    assert.equal(acc.status, 200, acc.text);

    const doc = await one(`SELECT id, row_version FROM document WHERE project_id = $1 AND gate = 3`, [PID]);
    const app = await admin.patch(`/api/documents/${doc.id}`, {
      uri: "https://docs.meridian.example/rbt/e01/readiness.pdf",
      status: "Approved", version: doc.row_version,
    });
    assert.equal(app.status, 200, app.text);

    /* Et les six portes réelles, posées à la main comme jalons ordinaires
       — le contournement que RT365 a dû inventer. */
    for (const g of SIX) {
      const r = await admin.post("/api/milestones", {
        project: PID, name: g.name.replace(" — ", " - "),   // la même échelle, un tiret d'un autre clavier
        date: "2026-0" + Math.min(9, SIX.indexOf(g) + 2) + "-15",
      });
      assert.equal(r.status, 201, r.text);
    }
    const all = await gatesOf(PID);
    assert.equal(all.length, 10, "dix jalons là où six étaient voulus — la mesure de RT365");

    await declareSix(admin, "RBT");
  });

  test("l'essai à blanc nomme ce qui sera adopté, créé, retiré — et ce qu'il faut reconnaître", async () => {
    const admin = await as("admin");
    const r = await admin.get(`/api/projects/${PID}/ladder`);
    assert.equal(r.status, 200, r.text);
    PLAN = r.body;

    assert.equal(PLAN.refusal, null);
    assert.equal(PLAN.onLadder, false, "le projet n'est pas encore sur l'échelle");
    assert.equal(PLAN.ladder.declared, true);
    assert.equal(PLAN.ladder.gates, 6);
    assert.equal(PLAN.scaffoldedGates, 4, "043 dit encore sous quelle échelle il a été dressé");

    assert.deepEqual(PLAN.summary, { adopt: 6, create: 0, retire: 4 });
    /* Adopté = LIÉ, pas ajouté à côté : chaque barreau désigne un jalon
       qui existe déjà, et aucun barreau n'est créé. */
    assert.deepEqual(PLAN.adopt.map((a) => a.rung), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(PLAN.adopt.map((a) => a.name), SIX.map((g) => g.name));
    assert.ok(PLAN.adopt.every((a) => a.was.kind === "milestone" && a.was.gate === null),
      "ce sont bien les six jalons ordinaires posés à la main");
    assert.equal(PLAN.create.length, 0);

    /* Les quatre de Meridian n'ont aucun barreau dans la nouvelle
       échelle : ce sont les dangereux, et l'essai les nomme. */
    assert.deepEqual(PLAN.retire.map((x) => x.gate), [1, 2, 3, 4]);
    const three = PLAN.retire.find((x) => x.gate === 3);
    assert.equal(three.acknowledge, true);
    /* Des CODES, pas de la prose : cette liste se dessine dans un écran lu
       en français et en espagnol (R-15). */
    assert.deepEqual(three.carries, [
      { what: "done" },
      { what: "accepted", who: PERSON },
      { what: "evidence", count: 1 },
    ]);
    assert.deepEqual(PLAN.acknowledgeRequired, [three.ref],
      "seule la porte qui porte une signature ou une preuve exige d'être reconnue");
    /* Une porte vide se retire sans cérémonie — rien n'y a été déposé. */
    assert.equal(PLAN.retire.find((x) => x.gate === 1).acknowledge, false);
  });

  test("l'essai à blanc n'écrit rien : le livre est identique après", async () => {
    const before = await gatesOf(PID);
    const admin = await as("admin");
    await admin.get(`/api/projects/${PID}/ladder`);
    await admin.get(`/api/projects/${PID}/ladder`);
    assert.deepEqual(await gatesOf(PID), before);
  });

  test("l'acte refuse tant qu'une porte signée n'est pas reconnue, et dit quoi envoyer", async () => {
    const admin = await as("admin");
    const r = await admin.post(`/api/projects/${PID}/ladder`, { version: PLAN.version });
    assert.equal(r.status, 409, r.text);
    assert.match(r.body.error, /acceptance or a filed evidence citation/);
    assert.match(r.body.error, /Nothing is deleted/);
    assert.match(r.body.error, new RegExp("acknowledge: .*" + PLAN.acknowledgeRequired[0]));
    /* Un refus n'écrit rien. */
    assert.equal((await gatesOf(PID)).filter((m) => m.kind === "gate").length, 4);
  });

  test("l'acte sans version est refusé — l'essai à blanc en donne une", async () => {
    const admin = await as("admin");
    const r = await admin.post(`/api/projects/${PID}/ladder`, { acknowledge: PLAN.acknowledgeRequired });
    assert.equal(r.status, 428, r.text);
  });

  test("une reconnaissance que le plan ne connaît pas est refusée comme périmée", async () => {
    const admin = await as("admin");
    const r = await admin.post(`/api/projects/${PID}/ladder`,
      { version: PLAN.version, acknowledge: [...PLAN.acknowledgeRequired, "PRJ-999-G9"] });
    assert.equal(r.status, 409, r.text);
    assert.match(r.body.error, /no longer part of it/);
  });

  test("l'acte : six adoptés, zéro créé, quatre retirés — et il rend les nombres qu'il a faits", async () => {
    const admin = await as("admin");
    const r = await admin.post(`/api/projects/${PID}/ladder`,
      { version: PLAN.version, acknowledge: PLAN.acknowledgeRequired });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.applied.adopted, 6);
    assert.equal(r.body.applied.created, 0);
    assert.equal(r.body.applied.retired, 4);
    assert.equal(r.body.applied.gates, 6);
    assert.match(r.body.note, /6 milestone\(s\) adopted, 0 rung\(s\) created, 4 gate\(s\) retired/);
  });

  test("le livre relu : six barreaux, dix lignes, aucun doublon", async () => {
    const all = await gatesOf(PID);
    const rungs = all.filter((m) => m.kind === "gate");
    assert.equal(rungs.length, 6, "exactement l'échelle du programme");
    assert.deepEqual(rungs.map((m) => m.gate), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(rungs.map((m) => m.name), SIX.map((g) => g.name),
      "l'orthographe de l'échelle fait autorité — le tiret d'un autre clavier est réconcilié");
    assert.equal(all.length, 10, "rien n'a été supprimé, et rien n'a été ajouté");

    /* Les quatre retirées : entières, hors échelle, et elles disent quel
       barreau elles occupaient (047). */
    const retired = all.filter((m) => m.retired_gate !== null);
    assert.equal(retired.length, 4);
    assert.ok(retired.every((m) => m.kind === "milestone" && m.gate === null));
    assert.deepEqual(retired.map((m) => m.retired_gate).sort(), [1, 2, 3, 4]);

    /* La porte acceptée a TOUT gardé : sa date, son acceptation, son
       accepteur, ses critères. */
    const three = retired.find((m) => m.retired_gate === 3);
    assert.equal(three.done, true);
    assert.equal(three.accepted_by, PERSON);
    assert.equal(three.acceptance_criteria, "Operations acceptance signed");

    /* Et sa preuve déposée : gardée, approuvée, son adresse intacte — et
       hors échelle, pour qu'elle ne devienne pas la preuve d'un AUTRE
       barreau (gate 0, le sens que document.gate porte depuis la 002). */
    const doc = await one(
      `SELECT gate, status, uri FROM document WHERE project_id = $1 AND status = 'Approved'`, [PID]);
    assert.equal(doc.status, "Approved");
    assert.equal(doc.uri, "https://docs.meridian.example/rbt/e01/readiness.pdf");
    assert.equal(doc.gate, 0, "hors échelle, jamais rattachée au barreau 3 de la nouvelle échelle");

    /* Et le signal de lecture de la 043 dit désormais la vérité. */
    const p = await one(`SELECT scaffolded_gates FROM project WHERE id = $1`, [PID]);
    assert.equal(p.scaffolded_gates, 6);
  });

  test("l'essai à blanc dit aussi ce qu'un PRÉCÉDENT passage avait retiré", async () => {
    const admin = await as("admin");
    const plan = (await admin.get(`/api/projects/${PID}/ladder`)).body;
    assert.equal(plan.previouslyRetired.length, 4,
      "047 garde le barreau qu'un jalon retiré occupait, et l'essai le rend lisible");
    assert.deepEqual(plan.previouslyRetired.map((m) => m.retiredGate), [1, 2, 3, 4]);
    assert.ok(plan.previouslyRetired.every((m) => m.name && m.milestone && m.date));
  });

  test("le moteur lit six barreaux et un seul jalon par barreau", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const ms = db.milestones.filter((m) => m.project === PID && m.kind === "gate");
    assert.equal(ms.length, 6);
    for (let n = 1; n <= 6; n++) {
      assert.equal(ms.filter((m) => m.gate === n).length, 1, `un seul jalon au barreau ${n}`);
    }
  });

  test("l'acte est idempotent : le second passage ne change rien et le dit", async () => {
    const admin = await as("admin");
    const before = await gatesOf(PID);
    const plan = (await admin.get(`/api/projects/${PID}/ladder`)).body;
    assert.equal(plan.onLadder, true);
    assert.deepEqual(plan.summary, { adopt: 6, create: 0, retire: 0 });

    const r = await admin.post(`/api/projects/${PID}/ladder`, { version: plan.version });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(
      { a: r.body.applied.adopted, c: r.body.applied.created, x: r.body.applied.retired },
      { a: 0, c: 0, x: 0 });
    assert.match(r.body.note, /already on its programme's ladder — nothing was written/);
    assert.deepEqual(await gatesOf(PID), before, "pas une ligne n'a bougé");
  });

  test("la piste d'audit porte l'acte, ses nombres et ce qui a été retiré", async () => {
    const admin = await as("admin");
    const rows = (await admin.get("/api/audit?limit=20")).body.events;
    const moved = rows.find((x) => x.action === "Project moved onto its programme's gate ladder");
    assert.ok(moved, "l'acte est consigné");
    assert.equal(moved.entity_id, PID);
    assert.match(moved.detail, /6 adopted · 0 created · 4 retired/);
    const after = typeof moved.after_json === "string" ? JSON.parse(moved.after_json) : moved.after_json;
    assert.equal(after.gates, 6);
    const before = typeof moved.before_json === "string" ? JSON.parse(moved.before_json) : moved.before_json;
    assert.equal(before.scaffoldedGates, 4);
    assert.equal(before.retired.length, 4);

    /* Le second passage n'a rien écrit, et la piste ne prétend PAS le
       contraire (la leçon du 100 % ON TRACK, REQ-33). */
    const noop = rows.find((x) => /already on its programme's ladder, nothing written/.test(x.action));
    assert.ok(noop, "un acte qui n'écrit rien se consigne comme tel");
    assert.match(noop.detail, /0 adopted · 0 created · 0 retired/);
  });

  test("le second passage du chargeur ne fait aucune écriture créante", async () => {
    const admin = await as("admin");
    const mint = await admin.post("/api/admin/integrations",
      { name: "RT365 ladder loader", scopes: "read:portfolio,write:portfolio", purpose: "test" });
    assert.equal(mint.status, 201, mint.text);
    const KEY = mint.body.key;
    const c = client();
    const rungs = (await gatesOf(PID)).filter((m) => m.kind === "gate");
    const count = async () =>
      (await one(`SELECT count(*)::int AS n FROM milestone WHERE project_id = $1`, [PID])).n;

    const n0 = await count();
    /* Premier passage : chaque porte du chargeur ADOPTE le barreau qui
       lui correspond, par son identifiant Meridian. */
    for (const m of rungs) {
      const r = await c.put(`/api/v1/milestones/GATE-${m.gate}`,
        { adopt: m.id, name: m.name, date: m.due_date }, { "X-API-Key": KEY });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.body.created, false, "adopter n'est pas créer");
    }
    assert.equal(await count(), n0, "premier passage : aucune ligne créée");

    /* Second passage : identique, et toujours rien de créé. */
    for (const m of rungs) {
      const r = await c.put(`/api/v1/milestones/GATE-${m.gate}`,
        { name: m.name, date: m.due_date }, { "X-API-Key": KEY });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.body.created, false);
    }
    assert.equal(await count(), n0, "second passage : aucune écriture créante");
  });
});

describe("REQ-27 · les barreaux qui manquent sont dressés comme à la naissance", () => {
  let PID = null;

  test("quatre adoptés, deux créés — avec leur preuve en brouillon et les critères de l'échelle", async () => {
    const admin = await as("admin");
    /* Un programme qui déclare d'abord QUATRE barreaux, puis six : les
       quatre premiers noms ne bougent pas, deux s'ajoutent. */
    const four = SIX.slice(0, 4);
    const made = await admin.post("/api/admin/programmes",
      { id: "RBS", name: "RoboTrader shadow", gateModel: four });
    assert.equal(made.status, 201, made.text);
    const p = await admin.post("/api/projects", {
      name: "E02 Shadow", programme: "RBS", site: SITE, governanceLevel: "group",
      start: "2026-02-02", finish: "2026-11-30", pm: PM,
    });
    assert.equal(p.status, 201, p.text);
    PID = p.body.id;
    assert.equal((await gatesOf(PID)).length, 4);

    await declareSix(admin, "RBS", SIX);

    const plan = (await admin.get(`/api/projects/${PID}/ladder`)).body;
    assert.deepEqual(plan.summary, { adopt: 4, create: 2, retire: 0 });
    assert.deepEqual(plan.create.map((c) => c.rung), [5, 6]);
    assert.deepEqual(plan.create.map((c) => c.name), ["Gate E — Pilot", "Gate F — GA"]);
    assert.equal(plan.acknowledgeRequired.length, 0, "rien de signé ne quitte l'échelle");

    const r = await admin.post(`/api/projects/${PID}/ladder`, { version: plan.version });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.applied.adopted, 0, "les quatre étaient déjà à leur barreau, sous leur nom");
    assert.equal(r.body.applied.created, 2);
    assert.equal(r.body.applied.retired, 0);

    const rungs = (await gatesOf(PID)).filter((m) => m.kind === "gate");
    assert.equal(rungs.length, 6);
    assert.deepEqual(rungs.map((m) => m.gate), [1, 2, 3, 4, 5, 6]);

    /* Un barreau créé est dressé exactement comme sur un projet né sous
       cette échelle : son jalon, sa preuve en brouillon, ses critères. */
    for (const n of [5, 6]) {
      const d = await many(`SELECT id, status FROM document WHERE project_id = $1 AND gate = $2`, [PID, n]);
      assert.equal(d.length, 1, `le barreau ${n} a sa preuve en brouillon`);
      assert.equal(d[0].status, "Draft");
      const c = await many(`SELECT id FROM gate_criterion WHERE project_id = $1 AND gate = $2`, [PID, n]);
      assert.ok(c.length >= 1, `le barreau ${n} porte les critères que l'échelle déclare`);
    }
    /* Et un barreau ADOPTÉ n'en reçoit pas : l'outil n'invente pas un
       artefact que personne n'a déposé, et ne pose pas d'attente neuve
       sur une porte que le projet fait tourner depuis un an. */
    const c1 = await many(`SELECT id FROM gate_criterion WHERE project_id = $1 AND gate = 1`, [PID]);
    assert.equal(c1.length, 2, "les critères du barreau 1 sont ceux de sa naissance, pas de nouveaux");
  });

  test("relancé, il ne crée rien de plus", async () => {
    const admin = await as("admin");
    const before = await gatesOf(PID);
    const docs = (await one(`SELECT count(*)::int AS n FROM document WHERE project_id = $1`, [PID])).n;
    const crit = (await one(`SELECT count(*)::int AS n FROM gate_criterion WHERE project_id = $1`, [PID])).n;
    const plan = (await admin.get(`/api/projects/${PID}/ladder`)).body;
    assert.equal(plan.onLadder, true);
    const r = await admin.post(`/api/projects/${PID}/ladder`, { version: plan.version });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(await gatesOf(PID), before);
    assert.equal((await one(`SELECT count(*)::int AS n FROM document WHERE project_id = $1`, [PID])).n, docs);
    assert.equal((await one(`SELECT count(*)::int AS n FROM gate_criterion WHERE project_id = $1`, [PID])).n, crit);
  });
});

describe("REQ-27 · les refus disent quoi faire ensuite", () => {
  test("un projet clos ne se déplace pas — et le refus dit l'alternative", async () => {
    const admin = await as("admin");
    const pid = await bornOnFour(admin, "RBC", "E03 Closed");
    await declareSix(admin, "RBC");
    const v = await one(`SELECT row_version FROM project WHERE id = $1`, [pid]);
    await many(`UPDATE project SET closed = true, row_version = row_version + 1 WHERE id = $1`, [pid]);
    const plan = (await admin.get(`/api/projects/${pid}/ladder`)).body;
    assert.match(plan.refusal, /is closed/);
    assert.match(plan.refusal, /Reopen the project/);
    assert.deepEqual(plan.summary, { adopt: 0, create: 0, retire: 0 });
    const r = await admin.post(`/api/projects/${pid}/ladder`, { version: v.row_version + 1 });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Reopen the project/);
  });

  test("une version périmée est refusée, et rien n'est écrit", async () => {
    const admin = await as("admin");
    const pid = await bornOnFour(admin, "RBV", "E04 Version");
    await declareSix(admin, "RBV");
    const before = await gatesOf(pid);
    const r = await admin.post(`/api/projects/${pid}/ladder`, { version: 99 });
    assert.equal(r.status, 409, r.text);
    assert.match(r.body.error, /Read it again/);
    assert.deepEqual(await gatesOf(pid), before);
  });

  test("un projet qui n'existe pas répond 404", async () => {
    const admin = await as("admin");
    assert.equal((await admin.get("/api/projects/PRJ-000/ladder")).status, 404);
    assert.equal((await admin.post("/api/projects/PRJ-000/ladder", { version: 1 })).status, 404);
  });
});

describe("REQ-27 · l'autorité est décidée dans shared/rbac.js", () => {
  let PID = null;

  test("le bureau de programme habilité le fait ; le site, jamais ; le lecteur, jamais", async () => {
    const admin = await as("admin");
    /* Sur le site que le lecteur habilité VOIT, pour que son refus soit
       un refus d'autorité et non une invisibilité (R1.10). */
    PID = await bornOnFour(admin, "RBA", "E05 Authority", "LIS");
    await declareSix(admin, "RBA");

    /* Un chef de site voit le projet (il est gouverné au groupe) et se
       voit refuser l'acte ET sa répétition — avec la phrase qui dit qui
       le fait à sa place. */
    const site = await as("siteGRU");
    const dry = await site.get(`/api/projects/${PID}/ladder`);
    assert.equal(dry.status, 403, dry.text);
    assert.match(dry.body.error, /declared on the programme/);
    assert.match(dry.body.error, /ask your programme office/);
    const act = await site.post(`/api/projects/${PID}/ladder`, { version: 1 });
    assert.equal(act.status, 403);

    /* Le lecteur voit le projet et n'écrit jamais rien (R1.5). */
    const viewer = await as("viewerLIS");
    const vr = await viewer.get(`/api/projects/${PID}/ladder`);
    assert.equal(vr.status, 403, vr.text);
    assert.match(vr.body.error, /read-only account/);

    /* Un compte groupe SANS habilitation sur ce programme le voit (la
       vue groupe est le portefeuille) et ne peut pas l'y faire passer. */
    const other = await as("groupCBP");
    const refused = await other.get(`/api/projects/${PID}/ladder`);
    assert.equal(refused.status, 403, refused.text);
    assert.match(refused.body.error, /outside your grant/);
  });

  test("un compte groupe habilité sur le programme le fait", async () => {
    const admin = await as("admin");
    /* On donne à E. Lindqvist l'habilitation sur RBA, comme un
       administrateur le ferait. */
    const users = (await admin.get("/api/admin/users")).body.users;
    const her = users.find((u) => u.email === ACCOUNTS.groupCBP[0]);
    const g = await admin.post(`/api/admin/users/${her.id}/grants`,
      { kind: "programme", target: "RBA" });
    assert.equal(g.status, 201, g.text);

    const she = await as("groupCBP");
    const plan = (await she.get(`/api/projects/${PID}/ladder`)).body;
    assert.equal(plan.refusal, null);
    const r = await she.post(`/api/projects/${PID}/ladder`,
      { version: plan.version, acknowledge: plan.acknowledgeRequired });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.applied.gates, 6);
    const rungs = (await gatesOf(PID)).filter((m) => m.kind === "gate");
    assert.equal(rungs.length, 6);
  });
});

/**
 * I-2 · L'API D'ÉCRITURE — retour de terrain RT365 (docs/33, M-05, INT-13, I-5)
 *
 * Le premier intégrateur réel a écrit par les routes de session du
 * navigateur et encodé son identité dans les titres. Ces tests tiennent
 * le contrat qui le remplace : identité externe par intégration, création
 * puis mise à jour par le même PUT, mêmes règles métier que l'écran,
 * portées d'écriture distinctes, clé d'idempotence, provenance de
 * l'avancement, décisions immuables, actions en salle ouverte.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client } from "./harness.js";
import { one, many } from "../src/db.js";
import { purgeIdempotencyKeys } from "../src/v1write.js";

before(async () => { await boot(); });
after(shutdown);

let KEY, MEET_KEY, READ_KEY, INT_ID, PM, SITE, PROG;
const c = client();
const put = (path, body, headers = {}) => c.put(path, body, { "X-API-Key": KEY, ...headers });

async function mint(admin, name, scopes) {
  const r = await admin.post("/api/admin/integrations", { name, scopes, purpose: "test" });
  assert.equal(r.status, 201, r.text);
  return r.body;
}

describe("I-2 · la serrure avant la porte", () => {
  test("trois clés : écriture portefeuille, écriture réunions, lecture seule", async () => {
    const admin = await as("admin");
    const a = await mint(admin, "RT365 ledgers", "read:portfolio,write:portfolio");
    KEY = a.key; INT_ID = a.id;
    MEET_KEY = (await mint(admin, "RT365 weekly", "write:meetings")).key;
    READ_KEY = (await mint(admin, "Power BI", "read:portfolio")).key;
    const db = (await admin.get("/api/bootstrap")).body.db;
    PM = db.people[0].id; SITE = db.sites[0].id; PROG = db.programmes[0].id;
  });

  test("une clé de lecture n'écrit pas ; une clé portefeuille ne consigne pas de décision", async () => {
    const r = await c.put("/api/v1/projects/E01", { name: "x" }, { "X-API-Key": READ_KEY });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /write:portfolio/);
    const d = await put("/api/v1/decisions/D-001", { headline: "x" });
    assert.equal(d.status, 403);
    assert.match(d.body.error, /write:meetings/);
    assert.equal((await c.put("/api/v1/projects/E01", { name: "x" })).status, 401, "sans clé, 401");
  });

  test("la découverte liste les écritures et leur portée", async () => {
    const r = await c.get("/api/v1/", { "X-API-Key": KEY });
    assert.equal(r.status, 200);
    const paths = r.body.endpoints.map((e) => e.method + " " + e.path);
    assert.ok(paths.includes("PUT /api/v1/projects/:externalId"));
    assert.equal(r.body.endpoints.find((e) => e.path.includes("decisions")).scope, "write:meetings");
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": KEY })).body;
    const p = doc.paths["/api/v1/milestones/:externalId"].put;
    assert.ok(p.requestBody.content["application/json"].schema.properties.acceptanceCriteria, "le corps est décrit");
    assert.equal(p["x-required-scope"], "write:portfolio");
  });
});

describe("I-2 · le projet, par son identifiant externe", () => {
  test("PUT crée (201) puis met à jour (200) — même identité, une seule ligne", async () => {
    const r1 = await put("/api/v1/projects/E01", {
      name: "E01 Foundation & identity", programme: PROG, site: SITE, governanceLevel: "group",
      pm: PM, start: "2026-09-07", finish: "2026-12-18", desc: "Epic E01", budget: 1.2,
    });
    assert.equal(r1.status, 201, r1.text);
    assert.equal(r1.body.created, true);
    assert.equal(r1.body.externalId, "E01");
    const id = r1.body.id;
    assert.match(id, /^PRJ-\d+$/);

    const r2 = await put("/api/v1/projects/E01", { name: "E01 Foundation and identity", finish: "2027-01-15" });
    assert.equal(r2.status, 200, r2.text);
    assert.equal(r2.body.created, false);
    assert.equal(r2.body.id, id, "la même ligne");
    assert.equal(r2.body.version, 2);

    const row = await one(`SELECT name, finish_date, external_source, external_id, budget FROM project WHERE id = $1`, [id]);
    assert.equal(row.name, "E01 Foundation and identity");
    assert.equal(row.finish_date, "2027-01-15");
    assert.equal(row.external_source, INT_ID);
    assert.equal(row.external_id, "E01");
    assert.equal(Number(row.budget), 1_200_000, "l'argent en millions est stocké en unités exactes");
    /* Le squelette de l'écran : étapes, jalons de gouvernance, preuves. */
    const acts = await many(`SELECT id FROM activity WHERE project_id = $1`, [id]);
    assert.ok(acts.length > 0, "les étapes sont échafaudées comme à l'écran");
    const gates = await many(`SELECT id FROM milestone WHERE project_id = $1 AND kind = 'gate'`, [id]);
    assert.ok(gates.length >= 4);
  });

  test("le PUT sans changement est un no-op qui rend la même version ; l'audit nomme l'intégration", async () => {
    const r = await put("/api/v1/projects/E01", {});
    assert.equal(r.status, 200);
    assert.equal(r.body.version, 2);
    const audit = await many(`SELECT user_label, detail FROM audit_event WHERE entity = 'project' AND entity_id = $1 ORDER BY id DESC`, [r.body.id]);
    assert.match(audit[0].user_label, /RT365 ledgers/);
    assert.match(audit[0].detail, /\(E01\)/, "la piste porte l'identifiant externe");
  });

  test("les refus disent quoi corriger : programme inconnu, dates inversées, version périmée", async () => {
    const a = await put("/api/v1/projects/E02", { name: "x", programme: "NOPE", site: SITE, start: "2026-01-01", finish: "2026-02-01" });
    assert.equal(a.status, 400); assert.match(a.body.error, /programme/);
    const b = await put("/api/v1/projects/E02", { name: "x", programme: PROG, site: SITE, start: "2026-03-01", finish: "2026-02-01" });
    assert.equal(b.status, 400); assert.match(b.body.error, /finish before it starts/);
    const stale = await put("/api/v1/projects/E01", { name: "y", version: 1 });
    assert.equal(stale.status, 409); assert.match(stale.body.error, /stale/);
  });

  test("deux intégrations peuvent dire « E01 » sans se marcher dessus", async () => {
    const admin = await as("admin");
    const other = (await mint(admin, "Another ledger", "write:portfolio")).key;
    const r = await c.put("/api/v1/projects/E01", {
      name: "Someone else's E01", programme: PROG, site: SITE, start: "2026-01-01", finish: "2026-06-01",
    }, { "X-API-Key": other });
    assert.equal(r.status, 201, r.text);
    const rows = await many(`SELECT id FROM project WHERE external_id = 'E01'`);
    assert.equal(rows.length, 2);
  });
});

describe("I-2 · jalons, registre, décisions, actions — les règles de l'écran", () => {
  test("un jalon par identifiant externe, sur le projet par SON identifiant externe ; PM-04 tenu", async () => {
    const r = await put("/api/v1/milestones/GATE-B", {
      project: "E01", name: "Gate B", date: "2026-10-30",
      acceptanceCriteria: "threat model, data flows, ADRs, capacity model",
    });
    assert.equal(r.status, 201, r.text);
    const noAcc = await put("/api/v1/milestones/GATE-B", { done: true });
    assert.equal(noAcc.status, 400, "des critères posés exigent un accepteur nommé");
    assert.match(noAcc.body.error, /acceptedBy/);
    const ok = await put("/api/v1/milestones/GATE-B", { done: true, acceptedBy: PM });
    assert.equal(ok.status, 200, ok.text);
    const row = await one(`SELECT done, accepted_by, acceptance_criteria FROM milestone WHERE id = $1`, [r.body.id]);
    assert.equal(row.done, true);
    assert.equal(row.accepted_by, PM);
    const audit = await one(`SELECT action FROM audit_event WHERE entity = 'milestone' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [r.body.id]);
    assert.equal(audit.action, "Milestone accepted");
  });

  test("un risque avec sa cible résiduelle, son jalon et sa revue ; par nom de personne", async () => {
    const owner = (await one(`SELECT name FROM person WHERE id = $1`, [PM])).name;
    const r = await put("/api/v1/raid/O-11", {
      project: "E01", type: "Dependency", title: "Broker sandbox access", detail: "Owner: SRE. Needed by: Gate C.",
      p: 3, i: 4, tp: 2, ti: 4, response: "Monitor", owner, review: "2026-10-01", gate: 2,
    });
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT kind, owner_id, target_probability, gate, review_on, external_id FROM raid_item WHERE id = $1`, [r.body.id]);
    assert.equal(row.kind, "Dependency");
    assert.equal(row.owner_id, PM, "le nom exact suffit");
    assert.equal(row.target_probability, 2);
    assert.equal(row.gate, 2);
    assert.equal(row.review_on, "2026-10-01");
    const closed = await put("/api/v1/raid/O-11", { status: "Closed" });
    assert.equal(closed.status, 200);
    assert.equal((await one(`SELECT status FROM raid_item WHERE id = $1`, [r.body.id])).status, "Closed");
    const badKind = await put("/api/v1/raid/O-12", { project: "E01", title: "x", type: "Gap" });
    assert.equal(badKind.status, 400, "un type inconnu est refusé, pas deviné");
  });

  test("une décision est immuable : même PUT = 200 même ligne ; PUT différent = 409", async () => {
    const h = { "X-API-Key": MEET_KEY };
    const d1 = await c.put("/api/v1/decisions/D-049", {
      headline: "Meridian is the portfolio and rhythm system", decidedBy: PM, decidedOn: "2026-09-08",
      rationale: "ledgers stay the truth", alternatives: "Meridian as the only system (rejected)",
    }, h);
    assert.equal(d1.status, 201, d1.text);
    const again = await c.put("/api/v1/decisions/D-049", {
      headline: "Meridian is the portfolio and rhythm system", decidedBy: PM, decidedOn: "2026-09-08",
      rationale: "ledgers stay the truth",
    }, h);
    assert.equal(again.status, 200);
    assert.equal(again.body.id, d1.body.id);
    const changed = await c.put("/api/v1/decisions/D-049", { headline: "Something else", decidedBy: PM }, h);
    assert.equal(changed.status, 409);
    assert.match(changed.body.error, /supersedes/);
    const d2 = await c.put("/api/v1/decisions/D-050", {
      headline: "Meridian gets a write API", decidedBy: PM, supersedes: "D-049",
    }, h);
    assert.equal(d2.status, 201, d2.text);
    assert.equal((await one(`SELECT supersedes FROM meeting_decision WHERE id = $1`, [d2.body.id])).supersedes, d1.body.id,
      "supersedes accepte l'identifiant externe de l'intégration");
    const noWho = await c.put("/api/v1/decisions/D-051", { headline: "x" }, h);
    assert.equal(noWho.status, 400); assert.match(noWho.body.error, /decidedBy/);
  });

  test("une action naît dans une salle OUVERTE — jamais ailleurs, et l'API n'ouvre rien", async () => {
    const h = { "X-API-Key": MEET_KEY };
    const nowhere = await c.put("/api/v1/actions/H-28", { title: "Stand up Meridian for real", owner: PM }, h);
    assert.equal(nowhere.status, 400);
    const pmo = await as("pmo");
    const occs = (await pmo.get("/api/meetings/series/MS-GRP-W/occurrences")).body.occurrences;
    const scheduled = occs.find((o) => o.status === "scheduled");
    const closedOne = occs.find((o) => o.status === "closed");
    if (closedOne) {
      const c1 = await c.put("/api/v1/actions/H-28", { title: "x", occurrence: closedOne.id }, h);
      assert.equal(c1.status, 409, "une salle close est un procès-verbal");
    }
    const notOpen = await c.put("/api/v1/actions/H-28", { title: "x", series: "MS-SIN-M" }, h);
    assert.equal(notOpen.status, 409, "pas d'occurrence ouverte → 409, et la chaire l'ouvre, pas l'API");
    if (scheduled.status !== "open") await pmo.post(`/api/meetings/occurrences/${scheduled.id}/open`, {});
    /* « E01 » appartient à l'intégration des grands livres, pas à celle
       de l'hebdomadaire : l'identité externe est PAR intégration. Une
       autre clé désigne le projet par son identifiant Meridian. */
    const foreign = await c.put("/api/v1/actions/H-28", { title: "x", project: "E01", series: "MS-GRP-W" }, h);
    assert.equal(foreign.status, 400, "l'identifiant externe d'une autre intégration n'existe pas pour celle-ci");
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    const ok = await c.put("/api/v1/actions/H-28", {
      title: "Stand up Meridian for real", detail: "PostgreSQL, backup, second instance", owner: PM,
      project: pid, dueDate: "2026-10-15", series: "MS-GRP-W",
    }, h);
    assert.equal(ok.status, 201, ok.text);
    const done = await c.put("/api/v1/actions/H-28", { status: "Done" }, h);
    assert.equal(done.status, 200, done.text);
    const row = await one(`SELECT status, closed_at, project_id FROM meeting_action WHERE id = $1`, [ok.body.id]);
    assert.equal(row.status, "Done");
    assert.ok(row.closed_at);
    assert.ok(row.project_id, "le projet est résolu par son identifiant externe");
  });
});

describe("I-5 · l'avancement remonté porte sa provenance", () => {
  test("lier un identifiant à une étape, puis remonter un pourcentage mesuré", async () => {
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    const stage = await one(`SELECT id, pct FROM activity WHERE project_id = $1 ORDER BY stage LIMIT 1`, [pid]);
    const unbound = await put("/api/v1/activities/JIRA-EPIC-7", { pct: 40 });
    assert.equal(unbound.status, 400); assert.match(unbound.body.error, /activity/);
    const bind = await put("/api/v1/activities/JIRA-EPIC-7", { activity: stage.id });
    assert.equal(bind.status, 201, bind.text);
    const prog = await put("/api/v1/activities/JIRA-EPIC-7", { pct: 40, source: "Jira · epic 7 · 12/30 stories", measuredAt: "2026-09-08T06:00:00Z" });
    assert.equal(prog.status, 200, prog.text);
    const row = await one(`SELECT pct, progress_source, progress_at FROM activity WHERE id = $1`, [stage.id]);
    assert.equal(row.pct, 40);
    assert.match(row.progress_source, /Jira/);
    assert.match(String(row.progress_at), /2026-09-08/);
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const a = db.activities.find((x) => x.id === stage.id);
    assert.equal(a.progressSource.startsWith("Jira"), true, "l'écran lit la provenance");
    assert.equal(a.externalId, "JIRA-EPIC-7");
    const over = await put("/api/v1/activities/JIRA-EPIC-7", { pct: 140 });
    assert.equal(over.status, 400);
    const taken = await put("/api/v1/activities/JIRA-EPIC-8", { activity: stage.id });
    assert.equal(taken.status, 409, "une étape déjà liée ne se relie pas à un autre identifiant");
  });

  test("un élément de travail par identifiant externe, colonne par nom", async () => {
    const r = await put("/api/v1/workitems/RT-123", { project: "E01", title: "Idempotency on submit", column: "backlog", points: 5, priority: "P1" });
    assert.equal(r.status, 201, r.text);
    const col = await one(`SELECT id FROM board_column ORDER BY seq DESC LIMIT 1`);
    const moved = await put("/api/v1/workitems/RT-123", { column: col.id });
    assert.equal(moved.status, 200, moved.text);
    assert.equal((await one(`SELECT column_id FROM work_item WHERE id = $1`, [r.body.id])).column_id, col.id);
    assert.equal((await put("/api/v1/workitems/RT-123", { column: "no-such-column" })).status, 400);
    const audit = await one(`SELECT action FROM audit_event WHERE entity = 'work_item' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [r.body.id]);
    assert.ok(audit);
  });
});

describe("INT-13 · Idempotency-Key", () => {
  test("même clé + même corps = réponse rejouée ; même clé + autre corps = 422 ; une autre intégration ne voit pas ma clé", async () => {
    const body = { project: "E01", title: "Data licence", type: "Dependency" };
    const first = await put("/api/v1/raid/O-20", body, { "Idempotency-Key": "run-42" });
    assert.equal(first.status, 201, first.text);
    const replay = await put("/api/v1/raid/O-20", body, { "Idempotency-Key": "run-42" });
    assert.equal(replay.status, 201, "le statut enregistré est rejoué tel quel");
    assert.equal(replay.body.id, first.body.id);
    assert.equal(replay.body.created, true);
    const rows = await many(`SELECT id FROM raid_item WHERE external_id = 'O-20'`);
    assert.equal(rows.length, 1, "aucun doublon");
    const other = await put("/api/v1/raid/O-20", { ...body, title: "Data licence — renewed" }, { "Idempotency-Key": "run-42" });
    assert.equal(other.status, 422);
    const meet = await c.put("/api/v1/decisions/D-060", { headline: "x", decidedBy: PM }, { "X-API-Key": MEET_KEY, "Idempotency-Key": "run-42" });
    assert.equal(meet.status, 201, "la clé est propre à chaque intégration");
    const kept = await many(`SELECT integration_id FROM idempotency_key WHERE key = 'run-42'`);
    assert.equal(kept.length, 2);
    assert.equal(await purgeIdempotencyKeys(0), 2, "la purge efface ce qui a passé l'âge");
  });
});


describe("second round · what the counsellors found (docs/33 §5)", () => {
  test("adopt: an existing row created on a screen takes the integration's id — once", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => !x.externalId);
    const r = await put("/api/v1/projects/LEGACY-1", { adopt: p.id, desc: "adopted" });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.id, p.id, "no duplicate: the existing project is the row");
    const row = await one(`SELECT external_id, description FROM project WHERE id = $1`, [p.id]);
    assert.equal(row.external_id, "LEGACY-1");
    assert.equal(row.description, "adopted");
    const twice = await put("/api/v1/projects/LEGACY-2", { adopt: p.id });
    assert.equal(twice.status, 409, "bound to another external id");
    const ghost = await put("/api/v1/projects/LEGACY-3", { adopt: "PRJ-000" });
    assert.equal(ghost.status, 400);
    /* The scaffolded gate milestone becomes reachable: "Gate 1 passed" lands on
       the milestone the engine reads, not on a plain one beside it (O-75). */
    const gate1 = db.milestones.find((m) => m.project === p.id && m.gate === 1);
    const g = await put("/api/v1/milestones/GATE-1", { adopt: gate1.id, done: true, acceptedBy: PM });
    assert.equal(g.status, 200, g.text);
    assert.equal((await one(`SELECT done, kind FROM milestone WHERE id = $1`, [gate1.id])).kind, "gate");
  });

  test("cr on raid and decisions resolves a change request by Meridian id", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    const cr = db.crs[0];
    const other = await put("/api/v1/raid/O-30", { project: pid, title: "x", cr: cr.id });
    assert.equal(other.status, 400, "a change of another project does not link");
    assert.match(other.body.error, /project/);
    const own = await put("/api/v1/raid/O-31", { project: cr.project, title: "linked", cr: cr.id, gate: 2 });
    assert.equal(own.status, 201, own.text);
    assert.equal((await one(`SELECT cr_id FROM raid_item WHERE id = $1`, [own.body.id])).cr_id, cr.id);
    const badGate = await put("/api/v1/raid/O-32", { project: cr.project, title: "x", gate: 9 });
    assert.equal(badGate.status, 400); assert.match(badGate.body.error, /4 gates/);
    const notInt = await put("/api/v1/raid/O-33", { project: cr.project, title: "x", gate: "abc" });
    assert.equal(notInt.status, 400);
    const d = await c.put("/api/v1/decisions/D-070", { headline: "with a change", decidedBy: PM, project: cr.project, cr: cr.id }, { "X-API-Key": MEET_KEY });
    assert.equal(d.status, 201, d.text);
  });

  test("measuredAt garbage is a 400, not a 500; an intrusive milestone in a freeze is refused like on the screen", async () => {
    const bad = await put("/api/v1/activities/JIRA-EPIC-7", { pct: 50, measuredAt: "yesterday-ish" });
    assert.equal(bad.status, 400); assert.match(bad.body.error, /measuredAt/);
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    const proj = db.projects.find((x) => x.id === pid);
    /* Classify the project as plant work and declare a freeze at its site. */
    const cls = await admin.patch(`/api/projects/${pid}/plant`, { impact: "plant", version: proj.version });
    assert.equal(cls.status, 200, cls.text);
    const win = await admin.post("/api/windows", { site: proj.site, label: "Year-end freeze", from: "2026-12-20", to: "2027-01-05" });
    assert.equal(win.status, 201, win.text);
    const refused = await put("/api/v1/milestones/CUTOVER", { project: "E01", name: "Cutover", date: "2026-12-24", intrusive: true });
    assert.equal(refused.status, 409, refused.text);
    assert.match(refused.body.error, /freeze/i);
    const fine = await put("/api/v1/milestones/CUTOVER", { project: "E01", name: "Cutover", date: "2027-01-10", intrusive: true });
    assert.equal(fine.status, 201, fine.text);
  });

  test("a created project on the default ladder advances like before; on a declared ladder its criteria hold the gate", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    assert.equal(db.criteria.filter((x) => x.project === pid).length, 0, "no surprise criteria on the default four gates (D-33.13)");
    const { Engine } = await import("../../shared/engine.js");
    const before = Engine.canAdvance(db, pid);
    assert.doesNotMatch(before.reason, /criterion/);
    const lad = await admin.post("/api/admin/programmes", { id: "LAD", name: "Laddered",
      gateModel: [{ name: "Gate A", owner: "PO", evidence: "charter; personas", at: 0.2 }, { name: "Gate B", owner: "ARB", evidence: "threat model", at: 0.7 }] });
    assert.equal(lad.status, 201, lad.text);
    const made = await put("/api/v1/projects/LAD-1", { name: "Laddered one", programme: "LAD", site: SITE, start: "2026-09-01", finish: "2027-03-01" });
    assert.equal(made.status, 201, made.text);
    const db2 = (await admin.get("/api/bootstrap")).body.db;
    const crit = db2.criteria.filter((x) => x.project === made.body.id && x.gate === 1);
    assert.equal(crit.length, 2, "the evidence list, split on comma and semicolon");
    assert.match(Engine.canAdvance(db2, made.body.id).reason, /criterion/);
    /* Criteria on the contract: adopt the scaffolded one, find it met by a named reviewer. */
    const r = await put("/api/v1/criteria/GA-C1", { adopt: crit[0].id, met: true, reviewedBy: PM });
    assert.equal(r.status, 200, r.text);
    const posed = await put("/api/v1/criteria/GA-C9", { project: "LAD-1", gate: 1, text: "measurable outcomes agreed" });
    assert.equal(posed.status, 201, posed.text);
    assert.equal((await put("/api/v1/criteria/GA-C10", { project: "LAD-1", gate: 3, text: "x" })).status, 400, "gate 3 does not exist on a two-gate ladder");
    const noWho = await put("/api/v1/criteria/GA-C9", { met: true });
    assert.equal(noWho.status, 400);
    const db3 = (await admin.get("/api/bootstrap")).body.db;
    assert.equal(Engine.gateStatus(db3, made.body.id, 1).criteriaMet, 1);
  });

  test("a decision's substance is immutable, its state lives: council, evidence link, Proposed → Ratified", async () => {
    const h = { "X-API-Key": MEET_KEY };
    const d = await c.put("/api/v1/decisions/D-052", {
      headline: "Model gateway is the only route to a model provider", council: "ARB", decidedOn: "2026-09-08",
      provenance: "[Committee]", status: "Proposed", evidenceUri: "https://github.com/mliad313sn/RT365/blob/x/docs/DECISION_LOG.md",
    }, h);
    assert.equal(d.status, 201, d.text);
    const row = await one(`SELECT council, status, decided_by, evidence_uri FROM meeting_decision WHERE id = $1`, [d.body.id]);
    assert.equal(row.council, "ARB"); assert.equal(row.status, "Proposed"); assert.equal(row.decided_by, null);
    const ratified = await c.put("/api/v1/decisions/D-052", { status: "Ratified", ratifiedBy: "Compliance Agent" }, h);
    assert.equal(ratified.status, 200, ratified.text);
    const after = await one(`SELECT status, ratified_by FROM meeting_decision WHERE id = $1`, [d.body.id]);
    assert.equal(after.status, "Ratified"); assert.equal(after.ratified_by, "Compliance Agent");
    const audit = await one(`SELECT action, before_json, after_json FROM audit_event WHERE entity = 'meeting_decision' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [d.body.id]);
    assert.equal(audit.action, "Decision ratified");
    assert.match(JSON.stringify(audit.before_json), /Proposed/);
    const moved = await c.put("/api/v1/decisions/D-052", { decidedOn: "2026-09-09" }, h);
    assert.equal(moved.status, 409, "the date is substance");
    const badUri = await c.put("/api/v1/decisions/D-053", { headline: "x", council: "ARB", evidenceUri: "javascript:1" }, h);
    assert.equal(badUri.status, 400);
    const long = await c.put("/api/v1/decisions/D-054", { headline: "x".repeat(600), council: "ARB" }, h);
    assert.equal(long.status, 201, "a long headline is kept, not truncated at 300");
  });

  test("an omitted version is true last-writer-wins; a sent version is asserted", async () => {
    const pid = (await one(`SELECT id FROM project WHERE external_source = $1 AND external_id = 'E01'`, [INT_ID])).id;
    const v = (await one(`SELECT row_version FROM project WHERE id = $1`, [pid])).row_version;
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === pid);
    const screen = await admin.patch("/api/projects/" + pid, { desc: "edited on the screen", version: p.version });
    assert.equal(screen.status, 200, screen.text);
    const sync = await put("/api/v1/projects/E01", { desc: "edited by the sync, no version" });
    assert.equal(sync.status, 200, "no version sent → the source is the master, no phantom 409");
    assert.equal(sync.body.version, v + 2);
    const stale = await put("/api/v1/projects/E01", { desc: "x", version: v });
    assert.equal(stale.status, 409);
    assert.equal((await put("/api/v1/projects/E01", { desc: "x", version: "abc" })).status, 400);
  });

  test("Idempotency-Key: key order does not matter; a refused request frees its key", async () => {
    const a = await put("/api/v1/raid/O-40", { project: "E01", title: "Ordered", type: "Issue" }, { "Idempotency-Key": "k-40" });
    assert.equal(a.status, 201, a.text);
    const b = await put("/api/v1/raid/O-40", { type: "Issue", title: "Ordered", project: "E01" }, { "Idempotency-Key": "k-40" });
    assert.equal(b.status, 201); assert.equal(b.body.id, a.body.id);
    const bad = await put("/api/v1/raid/O-41", { project: "E01", title: "x", type: "Gap" }, { "Idempotency-Key": "k-41" });
    assert.equal(bad.status, 400);
    const fixed = await put("/api/v1/raid/O-41", { project: "E01", title: "x", type: "Issue" }, { "Idempotency-Key": "k-41" });
    assert.equal(fixed.status, 201, "the refused request did not burn the key");
  });
});

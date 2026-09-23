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
import { purgeIdempotencyKeys, assertKnownBody, WRITE_BODIES } from "../src/v1write.js";
import { mountedRoutes } from "../src/openapi.js";

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
    /* Deux routes portent désormais « decisions » — l'écriture et la
       lecture (REQ-15) — et chacune dit SA portée : elles sont le miroir
       l'une de l'autre, pas la même. */
    const find = (m, path) => r.body.endpoints.find((e) => e.method === m && e.path === path);
    assert.equal(find("PUT", "/api/v1/decisions/:externalId").scope, "write:meetings");
    assert.equal(find("GET", "/api/v1/decisions").scope, "read:meetings");
    assert.equal(find("GET", "/api/v1/actions").scope, "read:meetings");
    assert.equal(find("PUT", "/api/v1/benefits/:externalId").scope, "write:portfolio");
    assert.equal(find("PUT", "/api/v1/business-case/:externalId").scope, "write:portfolio");
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": KEY })).body;
    /* OpenAPI nomme un paramètre `{nom}` ; la découverte, elle, rend les
       routes telles que le routeur les monte. */
    const p = doc.paths["/api/v1/milestones/{externalId}"].put;
    assert.ok(p.requestBody.content["application/json"].schema.properties.acceptanceCriteria, "le corps est décrit");
    assert.equal(p["x-required-scope"], "write:portfolio");
    /* REQ-02 tient sur cet en-tête : il doit être DÉCLARÉ, pas seulement
       raconté en prose, sans quoi aucun client engendré ne l'expose. */
    assert.ok(p.parameters.some((x) => x.name === "Idempotency-Key" && x.in === "header"),
      "l'en-tête d'idempotence est déclaré comme paramètre");
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
    /* REQ-19 — la re-passe se démontre désormais avec le corps RÉEL,
       celui qu'un chargeur renvoie à chaque tour, et non plus avec `{}` :
       un corps qui ne nomme rien à écrire n'est plus une requête (voir
       « REQ-19 » plus bas). La propriété testée ne bouge pas d'un pouce —
       réécrire les mêmes valeurs ne change rien, ne fait pas bouger la
       version et n'écrit pas de piste — et elle est maintenant vérifiée
       sur le chemin qui compte, celui où `changedOnly` travaille. */
    const same = {
      name: "E01 Foundation and identity", programme: PROG, site: SITE, governanceLevel: "group",
      pm: PM, start: "2026-09-07", finish: "2027-01-15", desc: "Epic E01", budget: 1.2,
    };
    const before = await many(`SELECT id FROM audit_event WHERE entity = 'project'`);
    const r = await put("/api/v1/projects/E01", same);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.version, 2, "la re-passe identique n'incrémente rien");
    const after = await many(`SELECT id FROM audit_event WHERE entity = 'project'`);
    assert.equal(after.length, before.length, "et n'écrit pas une ligne de piste de plus");

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
    /* H-3 — un ratifieur en texte libre n'en est pas un : la ligne n'était
       confrontée à rien, et une seule clé proposait puis ratifiait. */
    const invented = await c.put("/api/v1/decisions/D-052", { status: "Ratified", ratifiedBy: "Compliance Agent" }, h);
    assert.equal(invented.status, 400, "un ratifieur inventé est refusé");
    assert.match(invented.body.error, /ratifiedBy/);
    const nobody = await c.put("/api/v1/decisions/D-052", { status: "Ratified" }, h);
    assert.equal(nobody.status, 400, "ratifier sans nommer qui ratifie est refusé");
    const ratified = await c.put("/api/v1/decisions/D-052", { status: "Ratified", ratifiedBy: PM }, h);
    assert.equal(ratified.status, 200, ratified.text);
    const after = await one(`SELECT status, ratified_by FROM meeting_decision WHERE id = $1`, [d.body.id]);
    assert.equal(after.status, "Ratified"); assert.equal(after.ratified_by, PM);
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

  /* ── troisième tour · ce que le comité a trouvé sur la 5.10.0 bâtie ── */

  test("H-2 · a refused request binds nothing: adopt commits with the write or not at all", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const victim = db.projects.find((x) => !x.externalId);
    /* L'adoption ouvrait sa propre transaction et la validait avant la
       validation de la requête : un 400 saisissait définitivement une
       ligne à laquelle l'intégration n'avait jamais réussi à écrire. */
    const refused = await put("/api/v1/projects/SEIZE-1", { adopt: victim.id, pm: "no-such-person-zzz" });
    assert.equal(refused.status, 400, refused.text);
    const row = await one(`SELECT external_source, external_id FROM project WHERE id = $1`, [victim.id]);
    assert.equal(row.external_id, null, "la requête refusée n'a rien lié");
    assert.equal(row.external_source, null);
    const events = await many(
      `SELECT id FROM audit_event WHERE entity = 'project' AND entity_id = $1 AND action = 'Row adopted'`, [victim.id]);
    assert.equal(events.length, 0, "et n'a rien inscrit à la piste");
    /* La même requête, valide, lie bien. */
    const ok = await put("/api/v1/projects/SEIZE-1", { adopt: victim.id, desc: "now adopted" });
    assert.equal(ok.status, 200, ok.text);
    assert.equal((await one(`SELECT external_id FROM project WHERE id = $1`, [victim.id])).external_id, "SEIZE-1");
  });

  test("H-3 · the person who decided does not also ratify", async () => {
    const h = { "X-API-Key": MEET_KEY };
    const d = await c.put("/api/v1/decisions/D-080",
      { headline: "Self-service ratification", decidedBy: PM, status: "Proposed" }, h);
    assert.equal(d.status, 201, d.text);
    const self = await c.put("/api/v1/decisions/D-080", { status: "Ratified", ratifiedBy: PM }, h);
    assert.equal(self.status, 403, "la ségrégation des tâches vaut ici comme pour un changement");
    assert.match(self.body.error, /second pair of eyes/);
  });

  test("M-1/M-2 · a decision is a versioned row: adopt works, and a stale version is refused", async () => {
    const admin = await as("admin");
    const h = { "X-API-Key": MEET_KEY };
    /* Une décision consignée à l'écran, comme celles que le premier
       intégrateur a déjà écrites AVANT que l'identité externe existe.
       `adopt` dessus partait en 500 : la table n'avait pas de
       `row_version` et l'adoption l'incrémente. */
    const screen = await admin.post("/api/decisions",
      { headline: "Recorded on a screen, adopted later", council: "ARB" });
    assert.equal(screen.status, 201, screen.text);
    const a = await c.put("/api/v1/decisions/LEG-1", { adopt: screen.body.id }, h);
    assert.equal(a.status, 200, a.text);
    assert.equal(a.body.id, screen.body.id, "pas de doublon");
    assert.equal((await one(`SELECT external_id FROM meeting_decision WHERE id = $1`, [screen.body.id])).external_id, "LEG-1");
    const made = await c.put("/api/v1/decisions/D-081",
      { headline: "Versioned state", council: "ARB", status: "Proposed" }, h);
    assert.equal(made.status, 201, made.text);
    const v = made.body.version;
    const okv = await c.put("/api/v1/decisions/D-081", { status: "Ratified", ratifiedBy: PM, version: v }, h);
    assert.equal(okv.status, 200, okv.text);
    assert.equal(okv.body.version, v + 1, "la version rendue est réelle, pas un 1 littéral");
    const stale = await c.put("/api/v1/decisions/D-081", { provenance: "[late]", version: v }, h);
    assert.equal(stale.status, 409, "deux intégrations en concurrence ne s'écrasent plus en silence");
  });

  test("integrator · a rationale with a trailing newline stays idempotent, and a created criterion says so", async () => {
    const h = { "X-API-Key": MEET_KEY };
    const body = { headline: "Trailing whitespace", council: "ARB", rationale: "Because of X.\n" };
    const one_ = await c.put("/api/v1/decisions/D-082", body, h);
    assert.equal(one_.status, 201, one_.text);
    /* La création élaguait, la comparaison d'immuabilité non : le re-PUT
       octet pour octet identique repartait en 409. */
    const two = await c.put("/api/v1/decisions/D-082", body, h);
    assert.equal(two.status, 200, two.text);
    assert.equal(two.body.created, false);

    /* Poser et constater d'un seul PUT reste UNE création. */
    const crit = await put("/api/v1/criteria/CRIT-BORN", { project: "E01", gate: 1, text: "posed and met at once", met: false });
    assert.equal(crit.status, 201, crit.text);
    assert.equal(crit.body.created, true, "une ligne qui n'existait pas est créée, pas mise à jour");
  });

  test("H-1 · removing an integration does not write its signing secret into the trail", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Webhook holder", "read:portfolio");
    const row0 = await one(`SELECT row_version FROM integration WHERE id = $1`, [made.id]);
    const set = await admin.patch("/api/admin/integrations/" + made.id,
      { webhookUrl: "https://x.example/hook", webhookSecret: "S3CRET-SIGNING-KEY", version: row0.row_version });
    assert.equal(set.status, 200, set.text);
    assert.equal((await one(`SELECT webhook_secret FROM integration WHERE id = $1`, [made.id])).webhook_secret,
      "S3CRET-SIGNING-KEY", "le secret est bien posé — sans quoi l'épreuve ci-dessous ne prouve rien");
    const gone = await admin.del("/api/admin/integrations/" + made.id);
    assert.equal(gone.status, 200, gone.text);
    const ev = await one(
      `SELECT before_json FROM audit_event WHERE entity = 'integration' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [made.id]);
    const written = JSON.stringify(ev.before_json);
    assert.ok(!written.includes("S3CRET-SIGNING-KEY"), "le secret de signature ne part pas dans une piste que rien ne corrige");
    assert.match(written, /redacted/);
  });

  /* ── REQ-15 / REQ-20 · la valeur sur le contrat, et la relecture ─── */

  test("REQ-15 · what you wrote reads back: the decision register and the actions, under their own scope", async () => {
    const admin = await as("admin");
    const readKey = await mint(admin, "Reconciler", "read:meetings");
    const h = { "X-API-Key": readKey.key };

    const made = await c.put("/api/v1/decisions/D-090",
      { headline: "Readable back", council: "ARB", rationale: "Because a write you cannot read is not a contract." },
      { "X-API-Key": MEET_KEY });
    assert.equal(made.status, 201, made.text);

    const reg = await c.get("/api/v1/decisions", h);
    assert.equal(reg.status, 200, reg.text);
    const mine = reg.body.decisions.find((d) => d.externalId === "D-090");
    assert.ok(mine, "the row an integration wrote is findable by its own identifier");
    assert.equal(mine.id, made.body.id);
    assert.equal(mine.headline, "Readable back");
    assert.equal(mine.council, "ARB");
    assert.ok(mine.version >= 1, "and carries the version an update asserts");

    const acts = await c.get("/api/v1/actions", h);
    assert.equal(acts.status, 200, acts.text);
    assert.ok(Array.isArray(acts.body.actions));
    /* `raisedInStatus` est ce qui dit à un synchroniseur qu'une action
       vit dans une salle close — la minute qu'une re-passe écraserait. */
    for (const a of acts.body.actions) assert.ok("raisedInStatus" in a);

    /* La portée est réellement séparée : une clé de portefeuille, même en
       écriture, ne lit pas la gouvernance. */
    assert.equal((await c.get("/api/v1/decisions", { "X-API-Key": KEY })).status, 403);
    assert.equal((await c.get("/api/v1/actions", { "X-API-Key": KEY })).status, 403);
    assert.equal((await c.get("/api/v1/decisions", {})).status, 401);
  });

  test("REQ-20 · a benefit round-trips every field, keeps its own unit, and adopts a row born on a screen", async () => {
    const admin = await as("admin");
    const before = (await admin.get("/api/bootstrap")).body.db;
    const proj = before.projects[0].id;

    const made = await put("/api/v1/benefits/BEN-EXT-1", {
      project: "E01", kind: "Availability", title: "Fewer trading halts",
      detail: "Measured on the venue's own feed", measure: "halts per quarter", unit: "halts",
      baseline: 12, target: 3, owner: PM, realiseOn: "2027-03-31",
    });
    assert.equal(made.status, 201, made.text);

    /* Un réalisé sans date de mesure est refusé : un chiffre que personne
       ne peut situer un an plus tard n'est pas une mesure. */
    const undated = await put("/api/v1/benefits/BEN-EXT-1", { actual: 5 });
    assert.equal(undated.status, 400, undated.text);
    assert.match(undated.body.error, /measuredOn/);

    const measured = await put("/api/v1/benefits/BEN-EXT-1",
      { actual: 5, measuredOn: "2026-12-31", status: "Partially realised" });
    assert.equal(measured.status, 200, measured.text);

    const row = await one(`SELECT * FROM benefit WHERE id = $1`, [made.body.id]);
    assert.equal(row.kind, "Availability");
    assert.equal(row.title, "Fewer trading halts");
    assert.equal(row.measure, "halts per quarter");
    assert.equal(row.unit, "halts");
    /* SON unité, jamais divisée par le million comme l'argent. */
    assert.equal(Number(row.baseline), 12);
    assert.equal(Number(row.target), 3);
    assert.equal(Number(row.actual), 5);
    assert.equal(row.owner_id, PM);
    assert.equal(row.status, "Partially realised");
    assert.equal(row.external_id, "BEN-EXT-1");

    /* Idempotence : la même écriture ne crée rien et n'invente pas une version. */
    const again = await put("/api/v1/benefits/BEN-EXT-1", { actual: 5, measuredOn: "2026-12-31", status: "Partially realised" });
    assert.equal(again.status, 200);
    assert.equal(again.body.created, false);
    assert.equal(again.body.version, measured.body.version, "rien n'a changé, la version non plus");

    /* Et il se relit là où l'écran le lit. */
    const seen = (await admin.get("/api/bootstrap")).body.db.benefits.find((x) => x.externalId === "BEN-EXT-1");
    assert.ok(seen, "le bénéfice écrit par le contrat est celui que l'écran montre");
    assert.equal(seen.actual, 5);

    /* `adopt` : une ligne née à l'écran prend l'identité de la source. */
    const screen = await admin.post("/api/benefits", { project: proj, kind: "Cost", title: "Born on a screen" });
    assert.equal(screen.status, 201, screen.text);
    const adopted = await put("/api/v1/benefits/BEN-EXT-2", { adopt: screen.body.id, target: 9 });
    assert.equal(adopted.status, 200, adopted.text);
    assert.equal(adopted.body.id, screen.body.id, "pas de doublon");
    assert.equal((await one(`SELECT external_id FROM benefit WHERE id = $1`, [screen.body.id])).external_id, "BEN-EXT-2");

    const kind = await put("/api/v1/benefits/BEN-EXT-3", { project: "E01", title: "x", kind: "Vibes" });
    assert.equal(kind.status, 400, "un genre inventé est refusé, pas coercé");
  });

  test("REQ-20 · the business case is written by the contract, in millions, one per project", async () => {
    const first = await put("/api/v1/business-case/CASE-E01", {
      project: "E01", summary: "The venue fines us for every halt; the fix pays for itself in a year.",
      expectedCost: 1.5, expectedBenefit: 4.25, basis: "Two years of fine notices, and the vendor quote.",
    });
    assert.equal(first.status, 201, first.text);
    const row = await one(`SELECT * FROM business_case WHERE id = $1`, [first.body.id]);
    /* L'argent est en millions à l'entrée et en unités entières en base,
       la même conversion qu'à l'écran. */
    assert.equal(Number(row.expected_cost), 1_500_000);
    assert.equal(Number(row.expected_benefit), 4_250_000);
    assert.equal(row.external_id, "CASE-E01");
    assert.equal(row.updated_on, null, "écrire n'est pas réviser");

    const revised = await put("/api/v1/business-case/CASE-E01", { expectedBenefit: 3.1 });
    assert.equal(revised.status, 200, revised.text);
    const after = await one(`SELECT * FROM business_case WHERE id = $1`, [first.body.id]);
    assert.equal(Number(after.expected_benefit), 3_100_000);
    assert.ok(after.updated_on, "réviser repose la date que la reconfirmation regarde");

    /* Un projet n'a qu'UN cas : le second dit lequel adopter plutôt que
       de heurter une contrainte d'unicité sans rien expliquer. */
    const second = await put("/api/v1/business-case/CASE-E01-BIS", { project: "E01", summary: "A second case" });
    assert.equal(second.status, 400, second.text);
    assert.match(second.body.error, /adopt/);

    const negative = await put("/api/v1/business-case/CASE-E02", { project: "E02", summary: "x", expectedCost: -1 });
    assert.equal(negative.status, 400);
  });

  test("integrator · a re-run that changes nothing writes nothing: no audit event, no version bump", async () => {
    const body = { project: "E01", type: "Issue", title: "Unchanged between runs",
                   detail: "The ledger did not move.", p: 3, i: 3, status: "Open" };
    const made = await put("/api/v1/raid/O-NOOP", body);
    assert.equal(made.status, 201, made.text);
    const events = async () => (await many(
      `SELECT id FROM audit_event WHERE entity = 'raid_item' AND entity_id = $1`, [made.body.id])).length;
    const after = await events();
    const v = (await one(`SELECT row_version FROM raid_item WHERE id = $1`, [made.body.id])).row_version;

    /* Le patch était bâti des champs ENVOYÉS, pas des champs MODIFIÉS :
       une re-passe identique écrivait un événement et incrémentait la
       version de chaque ligne — mesuré par l'intégrateur à 285 lignes et
       285 événements pour un chargement qui n'avait rien changé. */
    for (let i = 0; i < 3; i++) {
      const again = await put("/api/v1/raid/O-NOOP", body);
      assert.equal(again.status, 200, again.text);
      assert.equal(again.body.created, false);
      assert.equal(again.body.version, v, "la version ne bouge pas sous les pieds d'un lecteur");
    }
    assert.equal(await events(), after, "et la piste ne se remplit pas de non-événements");

    /* Un vrai changement, lui, s'écrit et s'audite comme avant. */
    const moved = await put("/api/v1/raid/O-NOOP", { ...body, p: 5 });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.version, v + 1);
    assert.equal(await events(), after + 1);
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

/**
 * V-4 — la promesse contre le réalisé, sur la même ligne, sans jamais
 * convertir une unité en une autre.
 *
 * Rapport de terrain RT365 : « Le produit sait dire combien de bénéfices
 * ont été promis, mesurés et statués, il sait dire ce que le cas
 * attendait, et il ne met jamais les deux sur la même ligne. » Et leur
 * critère d'acceptation porte une interdiction explicite : **aucune
 * conversion monétaire dérivée n'apparaît nulle part**.
 */
describe("V-4 · ce qui a été promis, contre ce qui a été mesuré", () => {
  test("le rapport confronte les deux moitiés, en unités mêlées, sans rien convertir", async () => {
    const admin = await as("admin");
    const readKey = await mint(admin, "Value reader", "read:portfolio");
    const h = { "X-API-Key": readKey.key };

    /* Son propre projet : E01 porte déjà un cas écrit par un test plus
       haut, et un projet n'en a qu'un. */
    const mk = await put("/api/v1/projects/V4-PRJ", {
      name: "Mixed units", programme: PROG, site: SITE, pm: PM,
      start: "2026-09-07", finish: "2027-06-30", budget: 2,
    });
    assert.equal(mk.status, 201, mk.text);

    /* Un bénéfice en argent, un autre en heures : ils ne s'additionnent pas. */
    const wc = await put("/api/v1/business-case/CASE-V4", {
      project: "V4-PRJ", summary: "Fewer halts pays for itself.", expectedCost: 2, expectedBenefit: 5,
    });
    assert.equal(wc.status, 201, wc.text);
    const wm = await put("/api/v1/benefits/BEN-V4-MONEY", {
      project: "V4-PRJ", kind: "Cost", title: "Fines avoided", unit: "$M",
      baseline: 0, target: 4, actual: 3, measuredOn: "2026-08-31",
    });
    assert.equal(wm.status, 201, wm.text);
    const wh = await put("/api/v1/benefits/BEN-V4-HOURS", {
      project: "V4-PRJ", kind: "Availability", title: "Operator hours returned", unit: "hours",
      baseline: 0, target: 900, actual: 450, measuredOn: "2026-08-31",
    });
    assert.equal(wh.status, 201, wh.text);

    /* Le rapport parle en identifiants Meridian ; « E01 » est le nom que
       l'intégration donne à SA ligne. On résout par le cas qu'on vient
       d'écrire, comme le ferait un appelant. */
    const caseRow = await one(`SELECT project_id FROM business_case WHERE external_id = $1`, ["CASE-V4"]);
    const pid = caseRow.project_id;

    const r = await c.get("/api/v1/value", h);
    assert.equal(r.status, 200, r.text);
    const row = r.body.value.rows.find((x) => x.project === pid);
    assert.ok(row, "le projet est une ligne du rapport");
    assert.ok(row.case, "avec ce que le cas a promis");
    assert.equal(row.case.expectedBenefit, 5);
    assert.equal(row.benefits.length, 2, "et chaque bénéfice, dans SON unité");

    const hours = row.benefits.find((b) => b.unit === "hours");
    assert.equal(hours.actual, 450);
    assert.equal(hours.money, false, "des heures ne sont pas de l'argent");
    assert.equal(Math.round(hours.attainment * 100), 50);

    const t = r.body.value.totals;
    /* La règle qui compte : le total n'additionne QUE l'argent, et dit
       tout haut ce qu'il a laissé dehors. */
    assert.equal(t.moneyBenefitsCounted, 1);
    assert.ok(t.excludedBenefits >= 1);
    assert.ok(t.excludedUnits.includes("hours"),
      "les unités écartées sont nommées, pas silencieusement absentes");
    /* Et nulle part une conversion : aucun total ne peut valoir la somme
       des deux chiffres, qui ne sont pas additionnables. */
    assert.notEqual(t.moneyActual, 3 + 450);

    /* Les deux silences se voient. */
    const noCase = r.body.value.rows.find((x) => x.benefitsWithoutCase);
    const noBenefit = r.body.value.rows.find((x) => x.caseWithoutBenefits);
    assert.ok(noCase || noBenefit || r.body.value.rows.some((x) => x.neither),
      "un projet sans cas, ou sans bénéfice, est visible comme tel plutôt qu'absent");

    /* Une clé sans la portée est refusée comme partout ailleurs. */
    assert.equal((await c.get("/api/v1/value", { "X-API-Key": MEET_KEY })).status, 403);
  });

  test("une promesse dont la date est passée porte son âge de revue", async () => {
    const admin = await as("admin");
    const readKey = await mint(admin, "Value reader 2", "read:portfolio");
    const late0 = await put("/api/v1/benefits/BEN-V4-LATE", {
      project: "V4-PRJ", kind: "Production", title: "Throughput", unit: "tonnes",
      baseline: 100, target: 140, realiseOn: "2026-01-31",
    });
    assert.equal(late0.status, 201, late0.text);
    const caseRow = await one(`SELECT project_id FROM business_case WHERE external_id = $1`, ["CASE-V4"]);
    const r = await c.get("/api/v1/value", { "X-API-Key": readKey.key });
    const row = r.body.value.rows.find((x) => x.project === caseRow.project_id);
    const late = row.benefits.find((b) => b.title === "Throughput");
    assert.ok(late.reviewAgeDays > 0, "elle attend d'être mesurée depuis un nombre de jours");
    assert.equal(late.actual, null);
    assert.ok(row.overdue >= 1);
  });
});

/**
 * REQ-19 (retour de terrain RT365, D-10) — « une écriture refuse un corps
 * qu'elle ne comprend pas, plutôt que de rendre 200 et d'auditer autre
 * chose ».
 *
 * Ce qui était mesuré contre 5.12.0 : `sponsor` et `acceptanceCriteria`
 * sur un projet, `status: "Closed"` sur un projet, `category` sur une
 * ligne de registre — quatre 200, `version` inchangée, rien d'écrit. Le
 * dernier tiers de la demande est le plus important : aucune ligne
 * d'audit pour un acte qui n'a pas eu lieu.
 */
describe("REQ-19 · un corps que la collection ne comprend pas est refusé", () => {
  const KEY_FOR = (collection) =>
    (collection === "decisions" || collection === "actions" ? MEET_KEY : KEY);

  test("le projet du terrain, écrit d'abord comme il doit l'être", async () => {
    const r = await put("/api/v1/projects/REQ19-P", {
      name: "REQ-19 subject", programme: PROG, site: SITE, pm: PM,
      start: "2026-01-05", finish: "2026-12-18", budget: 1,
    });
    assert.equal(r.status, 201, r.text);
  });

  /* Les QUATRE champs que le terrain a mesurés — `sponsor`,
     `acceptanceCriteria`, `status` sur un projet, `category` sur une
     ligne de registre — ne sont plus refusés : la 045 les a faits
     RÉELS, et c'est ce qui rend la sévérité tenable (voir les blocs
     REQ-18 / REQ-19 / REQ-13 plus bas, qui prouvent qu'ils s'écrivent).
     Ce test-ci garde l'autre moitié : un champ que le contrat ne déclare
     PAS est refusé, et le refus dit quoi envoyer à la place. */
  test("un champ hors contrat est refusé, et le refus nomme ce qui est accepté", async () => {
    const two = await put("/api/v1/projects/REQ19-P", { health: "AMBER", phase: "Closure" });
    assert.equal(two.status, 400, two.text);
    assert.match(two.body.error, /projects does not accept "health", "phase"/);
    /* Le refus n'est utile que s'il dit la suite : ce qui EST accepté,
       et où lire le contrat entier. */
    assert.match(two.body.error, /accepts: adopt, name, programme, site/);
    assert.match(two.body.error, /openapi\.json/);
    assert.match(two.body.error, /nothing was written/);

    const cat = await put("/api/v1/raid/REQ19-R", {
      project: "REQ19-P", type: "Risk", title: "model drift", severity: "high",
    });
    assert.equal(cat.status, 400, cat.text);
    assert.match(cat.body.error, /raid does not accept "severity"/);
    /* Et la ligne n'existe pas : un refus à la création ne crée rien à
       moitié. */
    assert.equal(await one(`SELECT id FROM raid_item WHERE external_id = $1`, ["REQ19-R"]), null);
  });

  test("aucune ligne d'audit, aucune version, pour un acte qui n'a pas eu lieu", async () => {
    const row = await one(`SELECT id, row_version FROM project WHERE external_id = $1`, ["REQ19-P"]);
    const before = await many(
      `SELECT id FROM audit_event WHERE entity = 'project' AND entity_id = $1`, [row.id]);

    for (const body of [{ rag: "R" }, { closed: true }, { health: "AMBER" }]) {
      assert.equal((await put("/api/v1/projects/REQ19-P", body)).status, 400);
    }

    const after = await many(
      `SELECT id FROM audit_event WHERE entity = 'project' AND entity_id = $1`, [row.id]);
    assert.equal(after.length, before.length, "un refus n'écrit pas de piste");
    const now = await one(`SELECT row_version FROM project WHERE id = $1`, [row.id]);
    assert.equal(now.row_version, row.row_version, "et ne fait pas bouger la version sous le lecteur");
  });

  test("un corps vide — ou qui ne porte que `version` — est refusé", async () => {
    const empty = await put("/api/v1/projects/REQ19-P", {});
    assert.equal(empty.status, 400, empty.text);
    assert.match(empty.body.error, /names nothing to write/);
    /* `version` asserte ce qu'on écrase ; elle n'est pas un changement. */
    const onlyVersion = await put("/api/v1/projects/REQ19-P", { version: 1 });
    assert.equal(onlyVersion.status, 400, onlyVersion.text);
    assert.match(onlyVersion.body.error, /names nothing to write/);
    /* Et la liste proposée ne conseille pas d'envoyer `version` seule. */
    assert.ok(!/send at least one of:[^.]*version/.test(onlyVersion.body.error));
  });

  /**
   * Le test qui compte autant que le changement : ce qui passait hier
   * passe encore. Chaque champ DÉCLARÉ de chaque collection traverse le
   * garde — s'il en refusait un seul, toute intégration qui l'envoie
   * casserait, et c'est exactement le prix d'un garde mal posé.
   */
  test("chaque champ déclaré, sur chaque collection, traverse le garde", async () => {
    for (const [collection, shape] of Object.entries(WRITE_BODIES)) {
      const body = Object.fromEntries(Object.keys(shape).map((k) => [k, "x"]));
      assert.doesNotThrow(() => assertKnownBody(collection, body),
        `${collection} refuse un champ qu'il déclare`);
      /* Et un par un, pour que le message d'échec nomme le coupable.
         `version` est écartée de ce tour-là : seule, elle ne demande
         aucune écriture, et c'est le test suivant qui tient cette
         règle-ci. */
      for (const k of Object.keys(shape).filter((x) => x !== "version")) {
        assert.doesNotThrow(() => assertKnownBody(collection, { [k]: "x" }),
          `${collection}.${k} est déclaré et refusé`);
      }
    }
    /* Le contrat publié dit la même chose que le garde : ni plus, ni
       moins. Une propriété de plus dans OpenAPI serait une promesse que
       le serveur refuse ; une de moins, un champ accepté que personne ne
       peut découvrir. */
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": KEY })).body;
    for (const [collection, shape] of Object.entries(WRITE_BODIES)) {
      const schema = doc.paths[`/api/v1/${collection}/{externalId}`]
        .put.requestBody.content["application/json"].schema;
      assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(shape).sort(),
        `${collection} : la description et le garde ne disent pas la même chose`);
      assert.equal(schema.additionalProperties, false,
        `${collection} : le contrat publié doit dire que le corps est clos`);
    }
    /* Une écriture normale, elle, passe toujours — le garde ne s'est pas
       mis en travers du chemin qu'il protège. */
    const ok = await put("/api/v1/projects/REQ19-P", { desc: "still writable", version: 1 });
    assert.equal(ok.status, 200, ok.text);
  });

  test("chaque PUT monté déclare son corps, et refuse ce qu'il ne reconnaît pas", async () => {
    const puts = mountedRoutes().filter((r) => r.method === "PUT");
    assert.ok(puts.length >= 10, "les écritures sont montées");
    for (const { path } of puts) {
      const collection = /^\/api\/v1\/([^/]+)\/:externalId$/.exec(path)?.[1];
      assert.ok(collection && WRITE_BODIES[collection],
        `${path} est montée sans corps déclaré — le garde de REQ-19 la laisserait passer`);
      const r = await c.put(`/api/v1/${collection}/REQ19-GUARD`, { notAField: 1 },
        { "X-API-Key": KEY_FOR(collection) });
      assert.equal(r.status, 400, `${path} : ${r.text}`);
      assert.match(r.body.error, new RegExp(`${collection} does not accept "notAField"`));
    }
  });

  test("un corps refusé ne consomme pas la clé d'idempotence", async () => {
    const key = { "Idempotency-Key": "REQ19-K1" };
    const refused = await put("/api/v1/projects/REQ19-K", { name: "x", health: "AMBER" }, key);
    assert.equal(refused.status, 400, refused.text);
    /* Le refus est posé AVANT la réservation : la même clé, corrigée,
       reprend son travail au lieu de répondre 422 « clé déjà employée
       pour une autre requête ». */
    const fixed = await put("/api/v1/projects/REQ19-K", {
      name: "REQ-19 idempotent", programme: PROG, site: SITE,
      start: "2026-02-02", finish: "2026-11-30",
    }, key);
    assert.equal(fixed.status, 201, fixed.text);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 * REQ-18 · REQ-19 · REQ-13 — retour de terrain RT365, troisième tour.
 *
 * L'intégrateur a RÉÉCRIT `meridian_sync.py` contre le contrat publié,
 * puis a MESURÉ ce qu'il ne pouvait toujours pas faire. Trois pertes
 * silencieuses, toutes du même genre : 200 sur un corps non écrit.
 *
 *   REQ-18  « status: Closed répond 200 et se relit close pendant que
 *            closed_on reste null ».
 *   REQ-19  « dateBasis sur un projet est accepté et abandonné » ; et
 *            derrière : sponsor, acceptanceCriteria, status: Closed.
 *   REQ-13  une catégorie libre sur une ligne de registre.
 *
 * Chacun se prouve de la même façon : on écrit par le contrat, ET ON
 * RELIT. Un test qui ne relit pas aurait rendu vert exactement l'état
 * que le terrain a mesuré.
 * ═══════════════════════════════════════════════════════════════════
 */
describe("REQ-18 · une ligne de registre dit quand, et par qui, elle s'est close", () => {
  test("clore par le contrat écrit la date et le nom — la perte mesurée", async () => {
    const raised = await put("/api/v1/raid/REQ18-A", {
      project: "REQ19-P", type: "Risk", title: "supplier lead time", p: 4, i: 4,
    });
    assert.equal(raised.status, 201, raised.text);

    /* Le geste EXACT que le terrain a mesuré : `status: "Closed"`, seul. */
    const closed = await put("/api/v1/raid/REQ18-A", { status: "Closed" });
    assert.equal(closed.status, 200, closed.text);

    const row = await one(
      `SELECT status, closed_on, closed_by FROM raid_item WHERE external_id = $1`, ["REQ18-A"]);
    assert.equal(row.status, "Closed");
    assert.ok(row.closed_on, "REQ-18 : la date de clôture du grand livre n'est plus perdue");
  });

  test("le synchroniseur donne SA date et SON nom, et ils sont relus tels quels", async () => {
    const r = await put("/api/v1/raid/REQ18-B", {
      project: "REQ19-P", type: "Issue", title: "permit lapsed",
      status: "Closed", closedOn: "2026-03-17", closedBy: PM,
    });
    assert.equal(r.status, 201, r.text);
    const row = await one(
      `SELECT status, closed_on, closed_by FROM raid_item WHERE external_id = $1`, ["REQ18-B"]);
    assert.equal(String(row.closed_on).slice(0, 10), "2026-03-17");
    assert.equal(row.closed_by, PM);

    /* Et le portefeuille les rend : un champ écrit qui n'atteint aucun
       lecteur est la même perte, déplacée d'un cran. */
    const db = (await c.get("/api/v1/portfolio", { "X-API-Key": KEY })).body.portfolio;
    const item = db.raid.find((x) => x.externalId === "REQ18-B");
    assert.equal(String(item.closedOn).slice(0, 10), "2026-03-17");
    assert.equal(item.closedBy, PM);
  });

  test("rouvrir efface la clôture — une ligne ouverte n'a pas de date de clôture", async () => {
    const r = await put("/api/v1/raid/REQ18-B", { status: "Open" });
    assert.equal(r.status, 200, r.text);
    const row = await one(
      `SELECT status, closed_on, closed_by FROM raid_item WHERE external_id = $1`, ["REQ18-B"]);
    assert.equal(row.status, "Open");
    assert.equal(row.closed_on, null);
    assert.equal(row.closed_by, null);
  });

  test("une date de clôture sans clôture est refusée, et le refus dit le geste", async () => {
    const r = await put("/api/v1/raid/REQ18-A2", {
      project: "REQ19-P", type: "Risk", title: "no closure here", closedOn: "2026-03-17",
    });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /belong to a closure/);
  });

  test("l'écran clôt de la même façon : la date, et la personne derrière le compte", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const target = db.raid.find((x) => x.status === "Open" && x.project);
    const before = await one(`SELECT closed_on FROM raid_item WHERE id = $1`, [target.id]);
    assert.equal(before.closed_on, null);

    const r = await admin.patch("/api/raid/" + target.id, { status: "Closed", version: target.version });
    assert.equal(r.status, 200, r.text);
    const row = await one(
      `SELECT status, closed_on, closed_by FROM raid_item WHERE id = $1`, [target.id]);
    assert.equal(row.status, "Closed");
    assert.ok(row.closed_on, "le chemin de l'écran portait le MÊME trou, et ne le porte plus");

    /* Et le geste est audité, comme toute mutation. */
    const trail = await many(
      `SELECT action FROM audit_event WHERE entity = 'raid_item' AND entity_id = $1 ORDER BY id DESC`,
      [target.id]);
    assert.equal(trail[0].action, "Item closed");
  });
});

describe("REQ-13 · une catégorie libre sur une ligne de registre", () => {
  test("la catégorie s'écrit par le contrat, se relit, et ne touche pas au genre RAID", async () => {
    const r = await put("/api/v1/raid/REQ13-A", {
      project: "REQ19-P", type: "Dependency", title: "MOC sign-off", category: "regulatory",
    });
    assert.equal(r.status, 201, r.text);
    const row = await one(
      `SELECT kind, category FROM raid_item WHERE external_id = $1`, ["REQ13-A"]);
    assert.equal(row.category, "regulatory");
    /* `kind` reste le contrat que le moteur lit : la catégorie s'ajoute
       à côté, elle ne s'y substitue pas. */
    assert.equal(row.kind, "Dependency");

    const db = (await c.get("/api/v1/portfolio", { "X-API-Key": KEY })).body.portfolio;
    assert.equal(db.raid.find((x) => x.externalId === "REQ13-A").category, "regulatory");
  });

  test("l'écran la saisit aussi, et la relit", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects[0];
    const made = await admin.post("/api/raid", {
      project: p.id, type: "Assumption", title: "REQ-13 on the screen", category: "supply",
    });
    assert.equal(made.status, 201, made.text);
    const back = (await admin.get("/api/bootstrap")).body.db.raid.find((x) => x.id === made.body.id);
    assert.equal(back.category, "supply");
  });
});

describe("REQ-19 · une date de projet dit sur quoi elle repose", () => {
  test("dateBasis et condition ne sont plus acceptés puis abandonnés", async () => {
    const r = await put("/api/v1/projects/REQ19-P", {
      dateBasis: "placeholder", condition: "after the capacity model at gate C",
    });
    assert.equal(r.status, 200, r.text);
    const row = await one(
      `SELECT date_basis, condition FROM project WHERE external_id = $1`, ["REQ19-P"]);
    assert.equal(row.date_basis, "placeholder");
    assert.equal(row.condition, "after the capacity model at gate C");

    const db = (await c.get("/api/v1/portfolio", { "X-API-Key": KEY })).body.portfolio;
    const p = db.projects.find((x) => x.externalId === "REQ19-P");
    assert.equal(p.dateBasis, "placeholder");
    assert.equal(p.condition, "after the capacity model at gate C");
  });

  test("une base inconnue est refusée, et le refus nomme les deux valeurs", async () => {
    const r = await put("/api/v1/projects/REQ19-P", { dateBasis: "guess" });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /committed or placeholder/);
  });

  test("sponsor et acceptanceCriteria s'écrivent, et le sponsor est une personne de l'annuaire", async () => {
    const r = await put("/api/v1/projects/REQ19-P", {
      sponsor: PM, acceptanceCriteria: "Both sites cut over and the ledger reconciles",
    });
    assert.equal(r.status, 200, r.text);
    const row = await one(
      `SELECT sponsor_id, acceptance_criteria FROM project WHERE external_id = $1`, ["REQ19-P"]);
    assert.equal(row.sponsor_id, PM);
    assert.match(row.acceptance_criteria, /reconciles/);

    /* Un sponsor qui ne résout pas n'est pas une responsabilité. */
    const nobody = await put("/api/v1/projects/REQ19-P", { sponsor: "The Board" });
    assert.equal(nobody.status, 400, nobody.text);
    assert.match(nobody.body.error, /sponsor: no active person/);
  });

  test("status: Closed clôt réellement — et sous les trois signatures de PM-08", async () => {
    /* Sans les deux noms, le refus dit lesquels : c'est la règle de
       l'écran, et une route d'intégration n'est pas une porte dérobée. */
    const bare = await put("/api/v1/projects/REQ19-P", { status: "Closed" });
    assert.equal(bare.status, 400, bare.text);
    assert.match(bare.body.error, /opsAcceptedBy/);

    const half = await put("/api/v1/projects/REQ19-P", { status: "Closed", opsAcceptedBy: PM });
    assert.equal(half.status, 400, half.text);
    assert.match(half.body.error, /benefitsTo/);

    const ok = await put("/api/v1/projects/REQ19-P", {
      status: "Closed", opsAcceptedBy: PM, benefitsTo: PM, closureNote: "handed to operations",
    });
    assert.equal(ok.status, 200, ok.text);
    const row = await one(
      `SELECT id, closed, phase, closed_on, ops_accepted_by, benefits_owner_id, closure_note
         FROM project WHERE external_id = $1`, ["REQ19-P"]);
    assert.equal(row.closed, true);
    assert.equal(row.phase, "Closed");
    assert.ok(row.closed_on, "REQ-19 : `project.closed_on` existait depuis la 032 et l'API ne l'écrivait jamais");
    assert.equal(row.ops_accepted_by, PM);
    assert.equal(row.benefits_owner_id, PM);
    assert.match(row.closure_note, /handed to operations/);

    /* Et la clôture porte son propre nom dans la piste. */
    const trail = await many(
      `SELECT action FROM audit_event WHERE entity = 'project' AND entity_id = $1 ORDER BY id DESC`,
      [row.id]);
    assert.equal(trail[0].action, "Project closed");
  });

  test("un projet clos ne se rouvre pas par cette route, et le refus dit quoi faire", async () => {
    const r = await put("/api/v1/projects/REQ19-P", { status: "Open" });
    assert.equal(r.status, 409, r.text);
    assert.match(r.body.error, /closure is signed and dated/);
  });

  test("on ne naît pas clos : la clôture est un acte daté à elle seule", async () => {
    const r = await put("/api/v1/projects/REQ19-NEW", {
      name: "born closed", programme: PROG, site: SITE,
      start: "2026-01-05", finish: "2026-06-30", status: "Closed",
      opsAcceptedBy: PM, benefitsTo: PM,
    });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /not created closed/);
    assert.equal(await one(`SELECT id FROM project WHERE external_id = $1`, ["REQ19-NEW"]), null);
  });

  test("une date qui n'est qu'une position ne fait pas avancer la phase toute seule", async () => {
    /* `phaseFor` lit la fraction de fenêtre écoulée AUJOURD'HUI : sur une
       date de remplissage placée dans le passé, elle glisserait le projet
       en Closure sur une date que personne n'a promise. */
    const r = await put("/api/v1/projects/REQ19-PH", {
      name: "placeholder finish", programme: PROG, site: SITE, pm: PM,
      start: "2026-01-05", finish: "2026-12-18", budget: 1,
      dateBasis: "placeholder", condition: "after the D-057 measurement",
    });
    assert.equal(r.status, 201, r.text);
    const before = await one(`SELECT id, phase FROM project WHERE external_id = $1`, ["REQ19-PH"]);

    const moved = await put("/api/v1/projects/REQ19-PH", { start: "2024-01-05", finish: "2024-06-30" });
    assert.equal(moved.status, 200, moved.text);
    const after = await one(`SELECT phase FROM project WHERE id = $1`, [before.id]);
    assert.equal(after.phase, before.phase,
      "une position n'avance pas une phase — la porte le fait, la gouvernance le fait");
  });

  test("l'écran écrit les quatre champs, et les relit", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => !x.closed);
    const r = await admin.patch("/api/projects/" + p.id, {
      dateBasis: "placeholder", condition: "after the capacity model",
      sponsor: PM, acceptanceCriteria: "cut over at both sites",
      version: p.version,
    });
    assert.equal(r.status, 200, r.text);
    const back = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === p.id);
    assert.equal(back.dateBasis, "placeholder");
    assert.equal(back.condition, "after the capacity model");
    assert.equal(back.sponsor, PM);
    assert.equal(back.acceptanceCriteria, "cut over at both sites");
  });
});

/**
 * REQ-45 · REQ-46 · REQ-47 — LES TROIS HORLOGES QUI MANQUAIENT
 * (déposées contre nous-mêmes pendant la livraison de REQ-28)
 *
 * Les cinq signaux de gouvernance ont été écrits sans migration, sur des
 * horodatages que le livre tenait déjà. Deux d'entre eux ne pouvaient pas
 * parler sur un livre réel, et la mesure a nommé pourquoi :
 *
 *   REQ-45  une porte cochée SANS critères d'acceptation n'avait aucune
 *           date — vingt-quatre sur vingt-quatre du livre de démonstration.
 *           Le temps de cycle de porte disait « non mesuré » sur un
 *           portefeuille dont vingt-quatre portes étaient visiblement
 *           franchies.
 *   REQ-46  `raid_item.review_on` porte la PROCHAINE revue, et faire une
 *           revue avançait la date — ce qui effaçait la seule preuve
 *           qu'il y en avait eu une.
 *   REQ-47  la 039 a donné un ÉTAT et un ratifieur à une décision, et
 *           aucune date de ratification.
 *
 * Ce que ces épreuves tiennent, dans les deux sens : la donnée s'écrit
 * quand le geste a lieu, ET rien n'est rétro-daté sur ce qui s'est passé
 * avant que nous sachions le noter.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { many, one, tx } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* Le jour où l'épreuve tourne : `accepted_on` et `done_on` sont
   horodatés par l'horloge du serveur, pas par la date de statut du
   livre — la 032 fait déjà exactement cela. */
const TODAY = new Date().toISOString().slice(0, 10);

/** Un projet neuf, échafaudé sur l'échelle de son programme. */
async function freshProject(admin, name) {
  const made = await admin.post("/api/projects", {
    name, programme: "CBP", site: "LON", governanceLevel: "group", pm: "PE-01",
    start: "2026-01-05", finish: "2026-12-18", budget: 4, contingency: 0.4,
    desc: "Créé par l'épreuve.",
  });
  assert.equal(made.status, 201, made.text);
  const db = (await admin.get("/api/bootstrap")).body.db;
  return {
    project: db.projects.find((p) => p.id === made.body.id),
    gates: db.milestones.filter((m) => m.project === made.body.id && m.kind === "gate")
      .sort((a, b) => a.gate - b.gate),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   REQ-45 · UNE PORTE DIT QUAND ELLE A ÉTÉ FRANCHIE
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-45 · une porte dit quand elle a été franchie, avec ou sans critères", () => {
  test("le livre livré porte la mesure : des portes cochées, aucune date", async () => {
    const rows = await many(
      `SELECT count(*)::int AS done,
              count(*) FILTER (WHERE accepted_on IS NULL AND done_on IS NULL)::int AS undated
         FROM milestone WHERE kind = 'gate' AND done`);
    assert.ok(rows[0].done >= 20, "le livre de démonstration coche bien des portes");
    assert.equal(rows[0].undated, rows[0].done,
      "et aucune ne porte de date : c'est exactement ce que REQ-45 a mesuré, et rien n'est rétro-daté");
  });

  test("une porte SANS critères cochée aujourd'hui inscrit le jour et le nom", async () => {
    const admin = await as("admin");
    const { gates } = await freshProject(admin, "REQ-45 · porte sans critères");
    const g1 = gates[0];
    assert.equal(g1.acceptanceCriteria, "", "la porte échafaudée ne porte pas de critères");

    const r = await admin.patch(`/api/milestones/${g1.id}`, { done: true, doneBy: "PE-01", version: g1.version });
    assert.equal(r.status, 200, r.text);

    const row = await one(`SELECT done, done_on, done_by, accepted_on, accepted_by FROM milestone WHERE id = $1`, [g1.id]);
    assert.equal(row.done, true);
    assert.equal(String(row.done_on).slice(0, 10), TODAY, "le jour où elle a été cochée");
    assert.equal(row.done_by, "PE-01", "et par qui");
    /* L'acceptation garde son sens : personne n'a constaté de critères,
       donc rien n'est écrit là. C'est la distinction que la 032 tient. */
    assert.equal(row.accepted_on, null);
    assert.equal(row.accepted_by, null);
  });

  test("le registre qui connaît le vrai jour le dit ; une date qui n'est pas une date est refusée", async () => {
    const admin = await as("admin");
    const { gates } = await freshProject(admin, "REQ-45 · le vrai jour");
    const g = gates[0];
    const bad = await admin.patch(`/api/milestones/${g.id}`, { done: true, doneOn: "last tuesday", version: g.version });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /ISO date/);

    const ok = await admin.patch(`/api/milestones/${g.id}`, { done: true, doneOn: "2026-02-16", version: g.version });
    assert.equal(ok.status, 200, ok.text);
    const row = await one(`SELECT done_on FROM milestone WHERE id = $1`, [g.id]);
    assert.equal(String(row.done_on).slice(0, 10), "2026-02-16");
  });

  test("une porte AVEC critères porte les deux : l'acceptation nommée ET la coche", async () => {
    const admin = await as("admin");
    const { gates } = await freshProject(admin, "REQ-45 · porte avec critères");
    const g = gates[0];
    const withCriteria = await admin.patch(`/api/milestones/${g.id}`,
      { acceptanceCriteria: "Le rapport de recette est signé", version: g.version });
    assert.equal(withCriteria.status, 200, withCriteria.text);

    const refused = await admin.patch(`/api/milestones/${g.id}`, { done: true, version: withCriteria.body.version });
    assert.equal(refused.status, 400, "PM-04 tient toujours : des critères posés exigent un accepteur nommé");

    const done = await admin.patch(`/api/milestones/${g.id}`,
      { done: true, acceptedBy: "PE-05", version: withCriteria.body.version });
    assert.equal(done.status, 200, done.text);
    const row = await one(`SELECT done_on, done_by, accepted_on, accepted_by FROM milestone WHERE id = $1`, [g.id]);
    assert.equal(row.accepted_by, "PE-05", "qui a constaté les critères");
    assert.equal(String(row.accepted_on).slice(0, 10), TODAY);
    assert.equal(String(row.done_on).slice(0, 10), TODAY, "et le jour de la coche, qui est le même jour");
  });

  test("décocher efface les deux couples ; une porte qui n'est pas faite ne l'a pas été un jour", async () => {
    const admin = await as("admin");
    const { gates } = await freshProject(admin, "REQ-45 · décocher");
    const g = gates[0];
    const done = await admin.patch(`/api/milestones/${g.id}`, { done: true, version: g.version });
    assert.equal(done.status, 200, done.text);
    const undone = await admin.patch(`/api/milestones/${g.id}`, { done: false, version: done.body.version });
    assert.equal(undone.status, 200, undone.text);
    const row = await one(`SELECT done, done_on, done_by, accepted_on FROM milestone WHERE id = $1`, [g.id]);
    assert.equal(row.done, false);
    assert.equal(row.done_on, null);
    assert.equal(row.done_by, null);
    assert.equal(row.accepted_on, null);
  });

  test("re-cocher une porte déjà cochée ne la date pas d'aujourd'hui — rien n'est rétro-daté", async () => {
    /* Une ligne d'avant la 049 : cochée, sans date. Re-passer `done: true`
       ne doit RIEN inventer — elle a été cochée un jour que personne n'a
       noté, et nul le dit. */
    const before = await one(
      `SELECT id, row_version FROM milestone WHERE kind = 'gate' AND done AND done_on IS NULL LIMIT 1`);
    assert.ok(before, "le livre livré porte bien de telles lignes");
    const admin = await as("admin");
    const r = await admin.patch(`/api/milestones/${before.id}`, { done: true, name: "Gate 1 (retouché)", version: before.row_version });
    assert.equal(r.status, 200, r.text);
    const after = await one(`SELECT done, done_on FROM milestone WHERE id = $1`, [before.id]);
    assert.equal(after.done, true);
    assert.equal(after.done_on, null, "nul veut dire « cochée avant que nous sachions le noter »");
  });

  test("le contrat écrit la même chose, et laisse au registre source son vrai jour", async () => {
    const admin = await as("admin");
    const key = await admin.post("/api/admin/integrations",
      { name: "REQ-45", scopes: ["read:portfolio", "write:portfolio"] });
    assert.equal(key.status, 201, key.text);
    const token = key.body.key;
    const { project } = await freshProject(admin, "REQ-45 · par le contrat");

    const c = await as(null);
    const put = await c.put("/api/v1/milestones/EXT-M1",
      { project: project.id, name: "Porte externe", date: "2026-03-31", done: true,
        doneOn: "2026-03-30", doneBy: "PE-01" },
      { authorization: `Bearer ${token}` });
    assert.equal(put.status, 201, put.text);
    const row = await one(`SELECT done, done_on, done_by FROM milestone WHERE id = $1`, [put.body.id]);
    assert.equal(row.done, true);
    assert.equal(String(row.done_on).slice(0, 10), "2026-03-30");
    assert.equal(row.done_by, "PE-01");
  });

  test("la mesure que REQ-28 attend : deux barreaux datés font un temps de cycle", async () => {
    const admin = await as("admin");
    const { project, gates } = await freshProject(admin, "REQ-45 · deux barreaux");
    assert.equal(project.scaffoldedGates, 4, "le projet connaît son échelle (043)");
    const when = { 1: "2026-02-16", 2: "2026-04-27", 3: "2026-07-06" };
    for (const g of gates) {
      if (!when[g.gate]) continue;
      const r = await admin.patch(`/api/milestones/${g.id}`, { done: true, doneOn: when[g.gate], version: g.version });
      assert.equal(r.status, 200, r.text);
    }
    const rows = await many(
      `SELECT gate, done_on FROM milestone WHERE project_id = $1 AND kind = 'gate' AND done_on IS NOT NULL ORDER BY gate`,
      [project.id]);
    assert.deepEqual(rows.map((r) => [r.gate, String(r.done_on).slice(0, 10)]),
      [[1, "2026-02-16"], [2, "2026-04-27"], [3, "2026-07-06"]]);
    /* Ce que `gateCycleTime` calcule sur ces lignes : barreau par barreau,
       adjacent seulement, sur une échelle connue. Soixante-dix jours de 1
       à 2 et soixante-dix de 2 à 3 — un chiffre qui n'existait pas. */
    const cycle = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    assert.equal(cycle("2026-02-16", "2026-04-27"), 70);
    assert.equal(cycle("2026-04-27", "2026-07-06"), 70);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   REQ-46 · UNE REVUE EST UN ÉVÉNEMENT
   ═══════════════════════════════════════════════════════════════════ */

/** Une ligne de registre neuve, avec sa première revue programmée. */
async function freshItem(client, { project = GROUP_PROJECT, review = "2026-07-31" } = {}) {
  const r = await client.post("/api/raid",
    { project, type: "Risk", title: "Épreuve de revue", detail: "…", p: 3, i: 3, review });
  assert.equal(r.status, 201, r.text);
  const row = await one(`SELECT id, review_on, row_version FROM raid_item WHERE id = $1`, [r.body.id]);
  return row;
}

describe("REQ-46 · une revue est un événement, pas une date qui bouge", () => {
  test("enregistrer une revue l'inscrit ET dérive la prochaine échéance", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group);

    const r = await group.post(`/api/raid/${item.id}/reviews`,
      { on: "2026-07-28", next: "2026-10-28", by: "PE-15", note: "Rien de changé au constat.", version: item.row_version });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.body.review.reviewedOn, "2026-07-28");
    assert.equal(r.body.review.reviewedBy, "PE-15");
    assert.equal(r.body.review.dueOn, "2026-07-31", "ce qui était dû quand la revue a eu lieu");
    assert.equal(r.body.review.nextReviewOn, "2026-10-28");
    assert.equal(r.body.review.onTime, true, "faite avant l'échéance qu'elle répondait");
    assert.equal(r.body.item.review, "2026-10-28", "la colonne du registre est la PROJECTION de la revue");

    const back = await group.get(`/api/raid/${item.id}/reviews`);
    assert.equal(back.status, 200);
    assert.equal(back.body.reviews.length, 1);
    assert.equal(back.body.review, "2026-10-28");
  });

  test("LE POINT DE REQ-46 : la conformité du mois dernier redevient lisible", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group, { review: "2026-06-30" });
    let version = item.row_version;
    /* Deux revues, deux mois. Avant la 050 la seconde aurait effacé la
       première et il ne serait resté qu'une date : « conforme aujourd'hui,
       inconnaissable pour le mois dernier ». */
    for (const [on, next] of [["2026-07-15", "2026-08-15"], ["2026-08-20", "2026-11-20"]]) {
      const r = await group.post(`/api/raid/${item.id}/reviews`, { on, next, by: "PE-15", version });
      assert.equal(r.status, 201, r.text);
      version = r.body.item.version;
    }
    const evs = (await group.get(`/api/raid/${item.id}/reviews`)).body.reviews
      .slice().sort((a, b) => a.reviewedOn.localeCompare(b.reviewedOn));
    assert.equal(evs.length, 2, "les deux revues subsistent : la seconde n'a pas effacé la première");

    /* Le rejeu, tel que le signal de conformité le fera : ce qui était dû
       à une fin de mois est la prochaine échéance de la dernière revue
       ANTÉRIEURE — et, avant la première revue, l'échéance que celle-ci
       répondait. Rien n'est deviné. */
    const dueAt = (end) => {
      const before = evs.filter((e) => e.reviewedOn <= end);
      return before.length ? before[before.length - 1].nextReviewOn : evs[0].dueOn;
    };
    assert.equal(dueAt("2026-06-30"), "2026-06-30", "fin juin : l'échéance que la revue de juillet a répondue");
    assert.equal(dueAt("2026-07-31"), "2026-08-15", "fin juillet : ce que la revue du 15 avait posé");
    assert.equal(dueAt("2026-08-31"), "2026-11-20", "fin août : ce que la revue du 20 a posé");
    /* Et donc la conformité, à chaque fin de mois, sans rien inventer. */
    assert.equal(dueAt("2026-06-30") >= "2026-06-30", true);
    assert.equal(dueAt("2026-07-31") >= "2026-07-31", true);
  });

  test("une revue ne pose pas la suivante avant elle-même", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group);
    const r = await group.post(`/api/raid/${item.id}/reviews`,
      { on: "2026-08-20", next: "2026-08-01", version: item.row_version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /after the one being recorded/);
  });

  test("corriger une revue re-dérive l'échéance ; la retirer rend celle qu'elle avait trouvée", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group, { review: "2026-06-30" });
    const first = await group.post(`/api/raid/${item.id}/reviews`,
      { on: "2026-07-01", next: "2026-09-01", version: item.row_version });
    assert.equal(first.status, 201, first.text);

    const fixed = await group.patch(`/api/raid/reviews/${first.body.id}`,
      { next: "2026-09-15", note: "Échéance corrigée en séance.", version: first.body.review.version });
    assert.equal(fixed.status, 200, fixed.text);
    assert.equal(fixed.body.item.review, "2026-09-15", "la projection suit la correction");

    const gone = await group.del(`/api/raid/reviews/${first.body.id}`);
    assert.equal(gone.status, 200, gone.text);
    assert.equal(gone.body.item.review, "2026-06-30",
      "retirer la revue rend l'échéance qu'elle avait trouvée en place — pas rien du tout");
    assert.equal((await group.get(`/api/raid/${item.id}/reviews`)).body.reviews.length, 0);
  });

  test("la ligne du registre est tenue par sa version : un écran périmé ne bouge rien", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group);
    const stale = await group.post(`/api/raid/${item.id}/reviews`,
      { on: "2026-08-01", next: "2026-09-01", version: item.row_version + 5 });
    assert.equal(stale.status, 409);
    const missing = await group.post(`/api/raid/${item.id}/reviews`, { on: "2026-08-01" });
    assert.equal(missing.status, 428, "et une revue sans version du tout est refusée, pas devinée");
  });

  test("chaque geste est à la piste d'audit, avec l'avant et l'après de l'échéance", async () => {
    const group = await as("groupCBP");
    const item = await freshItem(group, { review: "2026-06-30" });
    const made = await group.post(`/api/raid/${item.id}/reviews`,
      { on: "2026-07-02", next: "2026-10-02", version: item.row_version });
    assert.equal(made.status, 201, made.text);
    await group.del(`/api/raid/reviews/${made.body.id}`);

    const admin = await as("admin");
    const trail = (await admin.get(`/api/audit?entity=raid_item&entityId=${item.id}&limit=20`)).body.events;
    const actions = trail.map((e) => e.action);
    assert.ok(actions.includes("Register item reviewed"), actions.join(", "));
    assert.ok(actions.includes("Review withdrawn"), actions.join(", "));
    const rec = trail.find((e) => e.action === "Register item reviewed");
    assert.equal(rec.before_json?.review_on ?? rec.before?.review_on, "2026-06-30");
    assert.equal(rec.after_json?.review_on ?? rec.after?.review_on, "2026-10-02");
  });

  test("qui peut consigner une revue : l'autorité du registre, décidée dans rbac.js", async () => {
    const admin = await as("admin");
    const group = await as("groupCBP");
    const site = await as("siteGRU");
    const viewer = await as("viewerGRU");

    /* Sur son propre site : oui. */
    const own = await freshItem(site, { project: SITE_PROJECT_GRU });
    const ok = await site.post(`/api/raid/${own.id}/reviews`, { on: "2026-08-01", next: "2026-09-01", version: own.row_version });
    assert.equal(ok.status, 201, ok.text);

    /* Sur un projet gouverné par le groupe : non — lecture seule (R1.6). */
    const theirs = await freshItem(group, { project: GROUP_PROJECT });
    const no = await site.post(`/api/raid/${theirs.id}/reviews`, { on: "2026-08-01", version: theirs.row_version });
    assert.equal(no.status, 403);

    /* Un lecteur ne consigne rien, nulle part. */
    const ro = await viewer.post(`/api/raid/${own.id}/reviews`, { on: "2026-08-01", version: 2 });
    assert.equal(ro.status, 403);

    /* Une ligne de PORTEFEUILLE — sans projet — est tenue au niveau groupe. */
    const wide = await admin.post("/api/raid", { type: "Risk", title: "Risque de portefeuille", p: 4, i: 4, review: "2026-07-01" });
    assert.equal(wide.status, 201, wide.text);
    const wideRow = await one(`SELECT row_version FROM raid_item WHERE id = $1`, [wide.body.id]);
    const bySite = await site.post(`/api/raid/${wide.body.id}/reviews`, { on: "2026-08-01", version: wideRow.row_version });
    assert.equal(bySite.status, 403);
    assert.match(bySite.body.error, /group level/);
    const byGroup = await group.post(`/api/raid/${wide.body.id}/reviews`,
      { on: "2026-08-01", next: "2026-11-01", version: wideRow.row_version });
    assert.equal(byGroup.status, 201, byGroup.text);
  });

  test("rien n'est rétro-daté : le livre livré n'a aucune revue inventée", async () => {
    const rows = await many(
      `SELECT count(*)::int AS n FROM raid_review v
        WHERE v.recorded_by IS NULL`);
    assert.equal(rows[0].n, 0,
      "aucune revue n'a été fabriquée par la migration pour les échéances déjà avancées");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   REQ-47 · UNE DÉCISION DIT QUAND ELLE A ÉTÉ RATIFIÉE
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-47 · une décision dit quand elle a été ratifiée", () => {
  test("les décisions déjà ratifiées gardent une date nulle — jamais rétro-datées", async () => {
    const rows = await many(
      `SELECT count(*)::int AS n FROM meeting_decision WHERE status = 'Ratified' AND ratified_on IS NULL`);
    assert.ok(rows[0].n >= 1, "le livre livré porte de telles lignes, et elles restent nulles");
  });

  test("née ratifiée : elle est en vigueur depuis le jour où elle a été prise", async () => {
    const group = await as("groupCBP");
    const r = await group.post("/api/decisions", {
      headline: "Adopter l'échelle à quatre portes", rationale: "…",
      decidedBy: "PE-15", decidedOn: "2026-06-11", projectId: GROUP_PROJECT,
      status: "Ratified", ratifiedBy: "Comité d'investissement",
    });
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT status, ratified_on FROM meeting_decision WHERE id = $1`, [r.body.id]);
    assert.equal(row.status, "Ratified");
    assert.equal(String(row.ratified_on).slice(0, 10), "2026-06-11");
  });

  test("née proposée : aucune date, et la table refuse qu'on lui en pose une", async () => {
    const group = await as("groupCBP");
    const r = await group.post("/api/decisions", {
      headline: "Retirer la passerelle de règlement héritée", council: "ARB",
      decidedOn: "2026-08-03", projectId: GROUP_PROJECT, status: "Proposed",
    });
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT status, ratified_on FROM meeting_decision WHERE id = $1`, [r.body.id]);
    assert.equal(row.status, "Proposed");
    assert.equal(row.ratified_on, null);

    /* La contrainte, et non la seule discipline des routes : une décision
       qui n'est pas ratifiée ne l'a pas été un jour. */
    await assert.rejects(
      tx((t) => t.query(`UPDATE meeting_decision SET ratified_on = $2 WHERE id = $1`, [r.body.id, "2026-08-04"])),
      /decision_ratification_dated|violates check constraint/);
  });

  test("ratifier par le contrat inscrit le jour ; revenir en arrière l'efface", async () => {
    const admin = await as("admin");
    const key = await admin.post("/api/admin/integrations",
      { name: "REQ-47", scopes: ["read:meetings", "write:meetings"] });
    const token = key.body.key;
    const auth = { authorization: `Bearer ${token}` };
    const c = await as(null);

    const made = await c.put("/api/v1/decisions/EXT-47",
      { headline: "Déplacer la bascule de Francfort", rationale: "La fenêtre d'octobre est prise.",
        decidedBy: "PE-15", decidedOn: "2026-07-02", status: "Proposed" }, auth);
    assert.equal(made.status, 201, made.text);
    assert.equal((await one(`SELECT ratified_on FROM meeting_decision WHERE id = $1`, [made.body.id])).ratified_on, null);

    const ratified = await c.put("/api/v1/decisions/EXT-47",
      { status: "Ratified", ratifiedBy: "PE-07", ratifiedOn: "2026-07-30", version: made.body.version }, auth);
    assert.equal(ratified.status, 200, ratified.text);
    const on = await one(`SELECT status, ratified_by, ratified_on FROM meeting_decision WHERE id = $1`, [made.body.id]);
    assert.equal(on.status, "Ratified");
    assert.equal(on.ratified_by, "PE-07");
    assert.equal(String(on.ratified_on).slice(0, 10), "2026-07-30");

    const back = await c.put("/api/v1/decisions/EXT-47",
      { status: "Proposed", version: ratified.body.version }, auth);
    assert.equal(back.status, 200, back.text);
    const off = await one(`SELECT status, ratified_on FROM meeting_decision WHERE id = $1`, [made.body.id]);
    assert.equal(off.status, "Proposed");
    assert.equal(off.ratified_on, null, "une décision proposée n'a pas été ratifiée un jour");
  });

  test("sans date déclarée, ratifier date du jour où le registre l'apprend", async () => {
    const admin = await as("admin");
    const key = await admin.post("/api/admin/integrations",
      { name: "REQ-47 bis", scopes: ["read:meetings", "write:meetings"] });
    const token = key.body.key;
    const auth = { authorization: `Bearer ${token}` };
    const c = await as(null);
    const made = await c.put("/api/v1/decisions/EXT-47B",
      { headline: "Geler le périmètre de la vague 3", council: "ARB", decidedOn: "2026-07-02", status: "Proposed" }, auth);
    assert.equal(made.status, 201, made.text);
    const r = await c.put("/api/v1/decisions/EXT-47B",
      { status: "Ratified", ratifiedBy: "PE-07", version: made.body.version }, auth);
    assert.equal(r.status, 200, r.text);
    const row = await one(`SELECT ratified_on FROM meeting_decision WHERE id = $1`, [made.body.id]);
    assert.equal(String(row.ratified_on).slice(0, 10), TODAY);
  });

  test("une décision de salle est en vigueur le jour où la salle a siégé", async () => {
    const group = await as("groupCBP");
    const series = (await group.get("/api/meetings/series")).body.series
      .find((s) => s.scopeKind === "group" || s.scope_kind === "group");
    assert.ok(series, "le livre livré porte une salle de groupe");
    const occs = (await group.get(`/api/meetings/series/${series.id}/occurrences`)).body.occurrences;
    const planned = occs.find((o) => o.status === "planned") ?? occs[0];
    const opened = await group.post(`/api/meetings/occurrences/${planned.id}/open`);
    assert.ok([200, 201, 409].includes(opened.status), opened.text);
    const dec = await group.post(`/api/meetings/occurrences/${planned.id}/decisions`,
      { headline: "Poursuivre la vague 2 sans condition", rationale: "Les portes 1 et 2 sont franchies." });
    assert.equal(dec.status, 201, dec.text);
    const row = await one(
      `SELECT d.status, d.ratified_on, o.meets_on FROM meeting_decision d
         JOIN meeting_occurrence o ON o.id = d.occurrence_id WHERE d.id = $1`, [dec.body.id]);
    assert.equal(row.status, "Ratified");
    assert.equal(String(row.ratified_on).slice(0, 10), String(row.meets_on).slice(0, 10),
      "pas le jour de la saisie : le jour de la séance");
  });

  test("la date sort par les trois lectures : la salle, le registre, le contrat", async () => {
    const group = await as("groupCBP");
    const made = await group.post("/api/decisions", {
      headline: "Lecture de la date de ratification", decidedBy: "PE-15",
      decidedOn: "2026-05-05", projectId: GROUP_PROJECT, status: "Ratified", ratifiedBy: "ARB",
    });
    assert.equal(made.status, 201, made.text);

    const admin = await as("admin");
    const log = (await admin.get("/api/decisions/log?limit=50")).body.minuted.find((d) => d.id === made.body.id);
    assert.equal(log.ratifiedOn, "2026-05-05", "le registre des décisions");

    const key = await admin.post("/api/admin/integrations", { name: "REQ-47 lecture", scopes: ["read:meetings"] });
    const c = await as(null);
    const v1 = await c.get("/api/v1/decisions?limit=50",
      { authorization: `Bearer ${key.body.key}` });
    assert.equal(v1.body.decisions.find((d) => d.id === made.body.id).ratifiedOn, "2026-05-05", "le contrat");
  });
});

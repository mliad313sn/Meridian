/**
 * PM-01 · Tolérances et gestion par exception.
 *
 * Le manque de gouvernance le plus lourd du produit, et le plus discret :
 * l'autorité était déléguée SANS BORNE. Meridian savait dire qu'un projet
 * virait à l'orange ; il ne savait pas dire qu'il avait franchi une
 * limite que quelqu'un avait fixée. Dans le premier cas, il faut que
 * quelqu'un remarque et accepte de porter la mauvaise nouvelle. Dans le
 * second, le dépassement remonte tout seul.
 *
 * Ces tests tiennent les cinq propriétés qui font le mécanisme :
 *
 *   · la marge est posée par le niveau AU-DESSUS, jamais par soi-même ;
 *   · le délai se mesure contre la ligne de référence, pas contre le plan
 *     courant — sinon repousser la date suffirait à n'être jamais en
 *     dépassement ;
 *   · le constat est automatique, et ne se répète pas ;
 *   · il ne se ferme jamais tout seul ;
 *   · le fermer demande une des quatre réponses, et une phrase.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { many, one, query } from "../src/db.js";
import { loadPortfolio } from "../src/portfolio.js";
import { sweepExceptions } from "../src/exceptions.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

describe("PM-01 · qui pose la borne", () => {
  test("un chef de site ne fixe pas sa propre marge", async () => {
    const site = await as("siteGRU");
    const r = await site.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 30, costPct: 10 });
    assert.equal(r.status, 403,
      "une tolérance qu'on se donne à soi-même est une intention, pas une tolérance");
    assert.match(r.body.error, /group-level authority/i);
  });

  test("le groupe la pose, et l'acte est tracé avec ses nombres", async () => {
    const group = await as("groupDCH");
    const r = await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 20, costPct: 5, benefitPct: 15, note: "Scope: no new sites." });
    assert.equal(r.status, 201, r.text);

    const trail = await one(
      `SELECT action, detail FROM audit_event WHERE entity = 'project_tolerance'
        ORDER BY id DESC LIMIT 1`);
    assert.equal(trail.action, "Tolerance set");
    assert.match(trail.detail, /20 days/);
    assert.match(trail.detail, /5% cost/);
  });

  test("une tolérance qui ne borne rien est refusée", async () => {
    const group = await as("groupDCH");
    const r = await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`, {});
    assert.equal(r.status, 400,
      "un formulaire vide serait pris plus tard pour une marge accordée");
    assert.match(r.body.error, /bound something/i);
  });

  test("en poser une nouvelle désactive la précédente, sans l'effacer", async () => {
    const group = await as("groupDCH");
    await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`, { scheduleDays: 99 });
    const rows = await many(
      `SELECT active, schedule_days FROM project_tolerance WHERE project_id = $1
        ORDER BY id`, [SITE_PROJECT_GRU]);
    assert.ok(rows.length >= 2, "l'histoire des marges se garde");
    assert.equal(rows.filter((r) => r.active).length, 1, "une seule active à la fois");
    assert.equal(rows.filter((r) => r.active)[0].schedule_days, 99);
  });
});

describe("PM-01 · ce que la marge mesure", () => {
  test("le délai se compte contre la ligne de référence, pas contre le plan courant", () => {
    /* Le point qui rend la tolérance opérante. Mesurée contre le plan
       courant, il suffirait de repousser la date pour n'être jamais en
       dépassement — c'est-à-dire exactement le geste que la
       re-planification sous contrôle du groupe existe pour encadrer. */
    const db = { benefits: [] };
    const p = { id: "P", baselineFinish: "2026-06-30", finish: "2026-12-31" };
    const m = { forecastFinish: "2026-07-31", bac: 10, eac: 10 };
    const t = Engine.tolerance(db, p, { scheduleDays: 10 }, m);
    assert.equal(t.schedule.measured, 31, "31 jours après la RÉFÉRENCE");
    assert.equal(t.schedule.breached, true);
  });

  test("une dimension non bornée rend null, pas « respectée »", () => {
    const t = Engine.tolerance({ benefits: [] }, { id: "P", baselineFinish: "2026-01-01" },
      { costPct: 5 }, { forecastFinish: "2026-01-01", bac: 10, eac: 10 });
    assert.equal(t.schedule, null,
      "n'avoir posé aucune limite n'est pas la même chose que la respecter");
    assert.equal(t.cost.breached, false);
  });

  test("le bénéfice retenu est le PLUS FAIBLE, pas la moyenne", () => {
    /* Sinon un bénéfice manqué se cache derrière un bénéfice dépassé. */
    const db = { benefits: [
      { project: "P", baseline: 0, target: 100, actual: 120 },   // 120 %
      { project: "P", baseline: 0, target: 100, actual: 40 },    // 40 %
    ] };
    const t = Engine.tolerance(db, { id: "P", baselineFinish: "2026-01-01" },
      { benefitPct: 30 }, { forecastFinish: "2026-01-01", bac: 10, eac: 10 });
    assert.equal(t.benefit.measured, 60, "60 points sous la cible, pas la moyenne");
    assert.equal(t.benefit.breached, true);
  });
});

describe("PM-01 · le constat se fait tout seul", () => {
  test("le balayage ouvre une exception, avec ses deux nombres", async () => {
    const group = await as("groupDCH");
    /* Une borne posée au hasard ne prouve rien : le projet semé peut
       être en avance, auquel cas « 0 jour de marge » n'est pas franchi et
       le test échouerait en accusant le produit. On LIT donc la mesure
       réelle, puis on pose la borne juste en dessous — le dépassement est
       alors certain, et d'un seul jour. */
    const db = await loadPortfolio({ id: "T", role: "admin", active: true,
      grants: { programmes: new Set(), sites: new Set() } });
    const p = db.projects.find((x) => x.id === SITE_PROJECT_GRU);
    const wide = Engine.tolerance(db, p, { scheduleDays: 999999 });
    assert.ok(wide && wide.schedule, "ce projet se mesure");
    const juste = Math.max(0, wide.schedule.measured - 1);

    await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: juste });
    await query(`DELETE FROM project_exception WHERE project_id = $1`, [SITE_PROJECT_GRU]);

    const out = await sweepExceptions();
    assert.ok(out.considered > 0, "il y avait au moins une marge à vérifier");

    const exc = await many(
      `SELECT * FROM project_exception WHERE project_id = $1 AND status = 'Open'`,
      [SITE_PROJECT_GRU]);
    assert.ok(exc.length > 0, "le dépassement remonte sans que personne ne le signale");
    const e = exc[0];
    assert.ok(["schedule", "cost", "benefit"].includes(e.dimension));
    assert.ok(Number(e.measured) > Number(e.allowed), "mesuré au-delà du permis");
    assert.match(e.detail, /allowed/i, "le constat se relit sans recalculer");

    const trail = await one(
      `SELECT action, user_label FROM audit_event WHERE entity = 'project_exception'
        ORDER BY id DESC LIMIT 1`);
    assert.equal(trail.action, "Exception raised");
    assert.equal(trail.user_label, "system", "personne ne l'a décidé");
  });

  test("repasser le balayage n'empile pas le même dépassement", async () => {
    const before = (await many(
      `SELECT count(*)::int AS n FROM project_exception WHERE project_id = $1`,
      [SITE_PROJECT_GRU]))[0].n;
    await sweepExceptions();
    await sweepExceptions();
    const after = (await many(
      `SELECT count(*)::int AS n FROM project_exception WHERE project_id = $1`,
      [SITE_PROJECT_GRU]))[0].n;
    assert.equal(after, before,
      "toutes les heures, cent fois la même ligne rendrait l'écran illisible");
  });

  test("elle ne se ferme pas toute seule quand la prévision revient dans la marge", async () => {
    const open = await one(
      `SELECT id FROM project_exception WHERE project_id = $1 AND status = 'Open' LIMIT 1`,
      [SITE_PROJECT_GRU]);
    assert.ok(open, "une exception est ouverte");

    /* On desserre la marge au maximum : plus aucun dépassement. */
    const group = await as("groupDCH");
    await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 99999, costPct: 99999, benefitPct: 99999 });
    await sweepExceptions();

    const still = await one(
      `SELECT status FROM project_exception WHERE id = $1`, [open.id]);
    assert.equal(still.status, "Open",
      "un dépassement qui s'efface tout seul n'a jamais eu lieu — et c'est ce qu'un comité ne doit pas pouvoir oublier");
  });
});

describe("PM-01 · la réponse", () => {
  test("le site ne statue pas sur son propre dépassement", async () => {
    const open = await one(
      `SELECT id, row_version FROM project_exception
        WHERE project_id = $1 AND status = 'Open' LIMIT 1`, [SITE_PROJECT_GRU]);
    const site = await as("siteGRU");
    const r = await site.post(`/api/exceptions/${open.id}/answer`,
      { kind: "Accepted", answer: "ça ira", version: open.row_version });
    assert.equal(r.status, 403,
      "celui qui livre vit dans la marge ; il ne statue pas sur son dépassement");
  });

  test("une réponse sans raison écrite est refusée", async () => {
    const open = await one(
      `SELECT id, row_version FROM project_exception
        WHERE project_id = $1 AND status = 'Open' LIMIT 1`, [SITE_PROJECT_GRU]);
    const group = await as("groupDCH");
    const r = await group.post(`/api/exceptions/${open.id}/answer`,
      { kind: "Accepted", answer: "   ", version: open.row_version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /what was decided/i);
  });

  test("une réponse hors des quatre est refusée", async () => {
    const open = await one(
      `SELECT id, row_version FROM project_exception
        WHERE project_id = $1 AND status = 'Open' LIMIT 1`, [SITE_PROJECT_GRU]);
    const group = await as("groupDCH");
    const r = await group.post(`/api/exceptions/${open.id}/answer`,
      { kind: "Ignored", answer: "on verra", version: open.row_version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Tolerance raised/);
  });

  test("le groupe répond, et la réponse est datée, nommée et tracée", async () => {
    const open = await one(
      `SELECT id, row_version FROM project_exception
        WHERE project_id = $1 AND status = 'Open' LIMIT 1`, [SITE_PROJECT_GRU]);
    const group = await as("groupDCH");
    const r = await group.post(`/api/exceptions/${open.id}/answer`, {
      kind: "Plan revised",
      answer: "Deux jalons décalés au T4 ; la ligne de référence sera reprise au comité du 12.",
      version: open.row_version,
    });
    assert.equal(r.status, 200, r.text);

    const row = await one(
      `SELECT status, answer_kind, answer, answered_by, answered_on
         FROM project_exception WHERE id = $1`, [open.id]);
    assert.equal(row.status, "Answered");
    assert.equal(row.answer_kind, "Plan revised");
    assert.match(row.answer, /comité du 12/);
    assert.ok(row.answered_by && row.answered_on, "on sait qui, et quand");

    const trail = await one(
      `SELECT action, detail FROM audit_event WHERE entity = 'project_exception'
         AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [open.id]);
    assert.equal(trail.action, "Exception answered");
    assert.match(trail.detail, /Plan revised/);
  });

  test("répondue, elle ne se rouvre pas au balayage suivant", async () => {
    /* La marge est de nouveau serrée : le même dépassement existe. Il ne
       doit PAS rouvrir l'exception close — sinon répondre ne servirait à
       rien et l'écran redeviendrait un flux. */
    const group = await as("groupDCH");
    await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`, { scheduleDays: 0, costPct: 0, benefitPct: 0 });
    const before = (await many(
      `SELECT count(*)::int AS n FROM project_exception
        WHERE project_id = $1 AND dimension = 'schedule'`, [SITE_PROJECT_GRU]))[0].n;
    await sweepExceptions();
    const after = (await many(
      `SELECT count(*)::int AS n FROM project_exception
        WHERE project_id = $1 AND dimension = 'schedule'`, [SITE_PROJECT_GRU]))[0].n;
    /* Une NOUVELLE exception peut légitimement s'ouvrir puisque la
       précédente est répondue — mais une seule, et la répondue reste
       répondue. */
    assert.ok(after - before <= 1, "au plus une nouvelle, jamais un flux");
    const answered = await many(
      `SELECT count(*)::int AS n FROM project_exception
        WHERE project_id = $1 AND status = 'Answered'`, [SITE_PROJECT_GRU]);
    assert.ok(answered[0].n >= 1, "ce qui a été répondu le reste");
  });
});

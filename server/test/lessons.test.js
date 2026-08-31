/**
 * PM-02 · Le registre des enseignements.
 *
 * Le constat d'origine n'était pas un manque parmi d'autres : le jalon 4
 * du produit exige comme preuve « Realisation report, lessons learned »
 * (`shared/engine.js:80`) et le produit n'avait aucun endroit où mettre
 * un enseignement. Il réclamait une pièce qu'il rendait impossible à
 * fournir.
 *
 * Ces tests tiennent les quatre choses qui ferment cela :
 *
 *   · un enseignement fait l'aller-retour sur tous ses champs ;
 *   · qui l'a vécu propose, le groupe adopte — jamais le même geste ;
 *   · adopté, il traverse les sites ; il ne fait PAS traverser le nom
 *     d'un projet qu'on n'a pas le droit de voir ;
 *   · on le retrouve quand on en a besoin, pas seulement quand on le
 *     cherche.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { many, one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/** Un enseignement complet, posé par le site qui l'a vécu. */
async function raiseOnGru(c, over = {}) {
  const r = await c.post("/api/lessons", {
    project: SITE_PROJECT_GRU,
    category: "Procurement",
    title: "Le fournisseur local livre en huit semaines, pas en quatre",
    whatHappened: "Le devis annonçait quatre semaines ; la livraison en a pris huit.",
    why: "Le délai courait depuis la commande signée, pas depuis l'accord verbal.",
    recommendation: "Compter le délai fournisseur depuis la signature, jamais depuis l'accord.",
    outcome: "Negative",
    gate: 3,
    ...over,
  });
  return r;
}

describe("PM-02 · ce que le jalon 4 réclamait sans pouvoir le recevoir", () => {
  test("un enseignement fait l'aller-retour sur chacun de ses champs", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site);
    assert.equal(created.status, 201, created.text);

    const db = (await site.get("/api/bootstrap")).body.db;
    const l = db.lessons.find((x) => x.id === created.body.id);
    assert.ok(l, "l'enseignement doit revenir dans le livre");
    assert.equal(l.category, "Procurement");
    assert.equal(l.gate, 3);
    assert.equal(l.outcome, "Negative");
    assert.match(l.whatHappened, /quatre semaines/);
    assert.match(l.why, /commande signée/);
    assert.match(l.recommendation, /depuis la signature/);
    assert.equal(l.status, "Proposed", "il est proposé, pas encore publié");
    assert.equal(l.project, SITE_PROJECT_GRU);

    /* Le programme et le site sont COPIÉS à la saisie : c'est ce qui
       permet à l'enseignement de survivre au projet. */
    const row = await one(`SELECT programme_id, site_id FROM lesson WHERE id = $1`,
      [created.body.id]);
    assert.equal(row.site_id, "GRU");
    assert.ok(row.programme_id, "le programme est copié, pas lu par jointure");
  });

  test("une modification corrige le texte, jamais le statut", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site, { title: "Titre à corriger" });
    const l = (await site.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);

    const ok = await site.patch(`/api/lessons/${created.body.id}`,
      { title: "Titre corrigé", version: l.version });
    assert.equal(ok.status, 200);

    const sneaky = await site.patch(`/api/lessons/${created.body.id}`,
      { status: "Adopted", version: ok.body.version });
    assert.equal(sneaky.status, 400,
      "sinon celui qui écrit l'enseignement décide seul qu'il vaut pour huit sites");
    assert.match(sneaky.body.error, /own route/i);
  });
});

describe("PM-02 · qui propose n'adopte pas", () => {
  test("un chef de site ne publie pas au groupe entier", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site);
    const l = (await site.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);

    const refused = await site.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });
    assert.equal(refused.status, 403, "adopter, c'est publier aux huit sites");
    assert.match(refused.body.error, /group-level authority/i);
  });

  test("le groupe adopte, et l'acte est daté, nommé et tracé", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site);
    let l = (await site.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);

    /* GRU porte un projet DCH : c'est le responsable de CE programme qui
       peut adopter. */
    const group = await as("groupDCH");
    const done = await group.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });
    assert.equal(done.status, 200, done.text);

    const row = await one(`SELECT status, adopted_by, adopted_on FROM lesson WHERE id = $1`,
      [created.body.id]);
    assert.equal(row.status, "Adopted");
    assert.ok(row.adopted_by, "l'adoption nomme qui l'a prononcée");
    assert.ok(row.adopted_on, "et quand");

    const trail = await many(
      `SELECT action, detail FROM audit_event WHERE entity = 'lesson' AND entity_id = $1
        ORDER BY id DESC LIMIT 1`, [created.body.id]);
    assert.equal(trail[0].action, "Lesson adopted");
  });

  test("un enseignement sans recommandation ne se publie pas", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site, { recommendation: "" });
    const l = (await site.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);

    const group = await as("groupDCH");
    const refused = await group.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });
    assert.equal(refused.status, 400,
      "sans recommandation c'est une anecdote, et une anecdote ne se diffuse pas");
    assert.match(refused.body.error, /what someone should do differently/i);
  });

  test("un enseignement adopté s'archive, il ne s'efface pas", async () => {
    const site = await as("siteGRU");
    const created = await raiseOnGru(site);
    const l = (await site.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);
    const group = await as("groupDCH");
    await group.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });

    const refused = await site.del(`/api/lessons/${created.body.id}`);
    assert.equal(refused.status, 400, "d'autres l'ont lu et appliqué");
    assert.match(refused.body.error, /archived, not deleted/i);
  });
});

describe("PM-02 · il traverse les sites, sans faire traverser les projets", () => {
  test("adopté, il devient lisible d'un site qui ne voit pas le projet d'origine", async () => {
    /* Posé sur São Paulo, adopté par le groupe, puis lu depuis Toronto —
       qui n'a aucun droit sur le projet de São Paulo. C'est tout l'objet
       du registre : un site apprend de ce qu'un autre a vécu. */
    const gru = await as("siteGRU");
    const created = await raiseOnGru(gru);
    const l = (await gru.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);
    const group = await as("groupDCH");
    await group.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });

    const yyz = await as("siteYYZ");
    const seen = (await yyz.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);
    assert.ok(seen, "un enseignement adopté est une connaissance de groupe");
    assert.match(seen.recommendation, /depuis la signature/);

    /* Et la limite : il lit l'enseignement, pas le projet. */
    assert.equal(seen.project, null,
      "R1.10 — le registre n'est pas un canal pour découvrir des projets hors périmètre");
    assert.equal((await yyz.get(`/api/projects/${SITE_PROJECT_GRU}`)).status, 404,
      "le projet lui-même reste invisible, comme avant");
  });

  test("proposé, il ne sort pas de son périmètre", async () => {
    const gru = await as("siteGRU");
    const created = await raiseOnGru(gru, { title: "Encore à l'étude" });

    const yyz = await as("siteYYZ");
    const seen = (await yyz.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);
    assert.equal(seen, undefined,
      "un enseignement non adopté est un brouillon de projet, pas une connaissance de groupe");
  });
});

describe("PM-02 · on le retrouve au moment où il sert", () => {
  test("un projet propose les enseignements de son programme et de son site", async () => {
    const gru = await as("siteGRU");
    const created = await raiseOnGru(gru);
    const l = (await gru.get("/api/bootstrap")).body.db.lessons
      .find((x) => x.id === created.body.id);
    const group = await as("groupDCH");
    await group.post(`/api/lessons/${created.body.id}/adopt`,
      { status: "Adopted", version: l.version });

    /* Depuis un AUTRE projet du même programme : c'est là que
       l'enseignement doit se présenter tout seul. */
    const relevant = await group.get(`/api/projects/${GROUP_PROJECT}/lessons/relevant`);
    assert.equal(relevant.status, 200);
    const hit = relevant.body.lessons.find((x) => x.id === created.body.id);
    if (hit) {
      assert.ok(hit.recommendation, "ce qui se présente, c'est la recommandation");
      assert.ok(hit.sameProgramme || hit.sameSite, "et la raison pour laquelle elle est là");
    }

    /* Le projet d'origine ne se propose pas ses propres enseignements. */
    const own = await gru.get(`/api/projects/${SITE_PROJECT_GRU}/lessons/relevant`);
    assert.equal(own.status, 200);
    assert.equal(own.body.lessons.some((x) => x.id === created.body.id), false,
      "un projet n'a rien à apprendre de lui-même");
  });
});

/**
 * M-01 — la réversibilité, prouvée par un aller-retour.
 *
 * Un export qu'on regarde ne prouve rien. Ce qui répond à « et dans trois
 * ans ? », c'est : sortir le livre ET la piste, tout effacer, recharger, et
 * retrouver les mêmes lignes — y compris les décisions d'audit, qui sont ce
 * qu'un auditeur vient chercher et la seule table que le produit
 * s'interdit de réécrire.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, ACCOUNTS, SITE_PROJECT_GRU } from "./harness.js";
import { many, one, query } from "../src/db.js";
import { setPassword } from "../src/auth.js";
import {
  buildArchive, restoreArchive, verifyRestore, validateArchive, tableOrder,
} from "../src/archive.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

describe("M-01 · l'archive et le chemin de retour", () => {
  test("l'ordre des tables est déduit, et place toujours un parent avant son enfant", async () => {
    const { order, deferred } = await tableOrder();
    const at = (t) => order.indexOf(t);
    assert.ok(at("site") < at("person"), "une personne appartient à un site");
    assert.ok(at("programme") < at("project"), "un projet appartient à un programme");
    assert.ok(at("project") < at("work_item"), "un lot appartient à un projet");
    assert.ok(at("meeting_series") < at("meeting_occurrence"));
    assert.ok(at("meeting_occurrence") < at("meeting_decision"));
    assert.equal(order.includes("session"), false, "les jetons ne s'archivent pas");
    assert.equal(order.includes("schema_migration"), false, "migrate() reconstruit le schéma");

    /* Le schéma tourne en rond à un endroit et un seul : un site nomme son
       référent, qui appartient à un site (A-12). La coupure doit tomber
       sur la colonne nullable des deux, jamais sur `person.site_id`. */
    assert.deepEqual(deferred.map((d) => `${d.table}.${d.column}`), ["site.champion_id"],
      "un seul cycle, rompu du côté qui accepte NULL");
  });

  test("l'archive porte la piste d'audit, et aucun secret", async () => {
    const doc = await buildArchive({ issuedTo: "test" });
    assert.ok(doc.tables.audit_event.length > 0,
      "la piste est ce qu'un auditeur vient chercher : sans elle l'archive ne vaut rien");
    assert.ok(doc.tables.project.length > 0);
    assert.ok(doc.tables.app_user.length > 0);

    for (const u of doc.tables.app_user) {
      assert.equal("pw_hash" in u, false, "aucune empreinte de mot de passe ne sort");
      assert.equal("pw_salt" in u, false);
    }
    /* Le fichier entier, relu comme du texte : rien qui ressemble à un
       secret n'a pu passer par une table à laquelle on n'aurait pas pensé. */
    const text = JSON.stringify(doc);
    assert.equal(/"token"|"token_hash"|"pw_hash"|"pw_salt"/.test(text), false,
      "aucune colonne de secret, quelle que soit la table");
  });

  test("l'export est un acte tracé, et réservé à l'administration", async () => {
    const admin = await as("admin");
    const r = await admin.get("/api/admin/archive");
    assert.equal(r.status, 200);
    assert.equal(r.body.meridian, "archive");
    assert.match(r.body.classification, /INTERNAL/);
    assert.equal(r.body.issuedTo, "System Administrator");

    const trail = await one(
      `SELECT detail FROM audit_event WHERE action = 'Archive exported'
        ORDER BY id DESC LIMIT 1`);
    assert.ok(trail, "sortir tout le livre laisse une ligne, comme tout le reste");
    assert.match(trail.detail, /row\(s\) across/);

    const group = await as("groupDCH");
    assert.equal((await group.get("/api/admin/archive")).status, 403,
      "un responsable de programme n'emporte pas le portefeuille du groupe");
  });

  test("une archive qui n'en est pas une est refusée avant d'ouvrir une transaction", () => {
    assert.throws(() => validateArchive(null), /pas un document/);
    assert.throws(() => validateArchive({ meridian: "autre chose" }), /pas une archive/);
    assert.throws(() => validateArchive({ meridian: "archive", format: 99 }), /format 99/);
    assert.throws(
      () => validateArchive({ meridian: "archive", format: 1, order: ["project"], tables: {} }),
      /annoncée et absente/);
  });

  test("l'aller-retour : tout effacer, recharger, retrouver le même livre", async () => {
    const doc = await buildArchive({ issuedTo: "réversibilité" });

    /* Deux repères précis plutôt qu'un compte global : un aller-retour qui
       ne compare que des totaux passe même quand les colonnes se sont
       vidées. */
    const projectBefore = await one(`SELECT * FROM project WHERE id = $1`, [SITE_PROJECT_GRU]);
    const auditBefore = await many(
      `SELECT id, action, entity, entity_id FROM audit_event ORDER BY id DESC LIMIT 5`);

    /* Le geste qu'on redoute : restaurer par-dessus un livre vivant. Il
       est refusé tant qu'on ne l'a pas assumé. */
    await assert.rejects(() => restoreArchive(doc), /porte déjà/);

    const out = await restoreArchive(doc, { force: true });
    assert.equal(out.totalRows, doc.totalRows);

    const check = await verifyRestore(doc);
    assert.deepEqual(check.mismatches, [], "recompté dans la base, table par table");

    const projectAfter = await one(`SELECT * FROM project WHERE id = $1`, [SITE_PROJECT_GRU]);
    assert.deepEqual(
      { ...projectAfter, budget: String(projectAfter.budget) },
      { ...projectBefore, budget: String(projectBefore.budget) },
      "le projet revient avec toutes ses colonnes, pas seulement son identifiant");

    const auditAfter = await many(
      `SELECT id, action, entity, entity_id FROM audit_event ORDER BY id DESC LIMIT 5`);
    assert.deepEqual(auditAfter, auditBefore,
      "et la piste revient identique — c'est l'objet même de l'exercice");
  });

  /* Le contrôle que le comptage ne pouvait pas faire.
     `audit_event.id` est un bigserial ; une archive rechargée dans une
     base neuve laisserait la séquence à 1 et la PREMIÈRE écriture du
     produit échouerait — sur une base dont toutes les lignes sont
     pourtant là. Une réversibilité se prouve en écrivant après, pas en
     recomptant avant. */
  test("après restauration, le produit peut encore écrire", async () => {
    const doc = await buildArchive({ issuedTo: "séquences" });
    /* On remet la séquence au pire cas — celui d'une base neuve — pour
       que le test échoue si le repositionnement disparaît un jour. */
    await query(`SELECT setval(pg_get_serial_sequence('audit_event', 'id'), 1, false)`);
    await restoreArchive(doc, { force: true });

    /* Ce que fait `npm run restore -- --open` : l'archive ne porte aucun
       secret, donc aucun compte n'ouvre avant qu'on en repose un. */
    await setPassword("U-ADMIN", ACCOUNTS.admin[1], { mustChange: false });

    const admin = await as("admin");
    const before = await one(`SELECT count(*)::int AS n FROM audit_event`);
    const r = await admin.post("/api/admin/sessions/revoke-all", {});
    assert.equal(r.status, 200, "une écriture ordinaire, après reprise, doit passer");
    const after = await one(`SELECT count(*)::int AS n FROM audit_event`);
    assert.equal(after.n, before.n + 1, "et laisser sa ligne de piste, comme avant");
  });

  test("après restauration, personne ne se connecte tant qu'un mot de passe n'est pas posé", async () => {
    /* Sa propre reprise : le test précédent en a rouvert un, et une
       garantie qui dépend de l'ordre des tests n'en est pas une. */
    await restoreArchive(await buildArchive({ issuedTo: "comptes" }), { force: true });
    const users = await many(`SELECT pw_hash, must_change_password FROM app_user`);
    assert.ok(users.length > 0);
    for (const u of users) {
      assert.equal(u.pw_hash, "unusable",
        "une archive sans secret ne peut pas rendre des comptes utilisables");
      assert.equal(u.must_change_password, true);
    }
  });
});

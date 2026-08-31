/**
 * INT-05 · Les vues de restitution.
 *
 * Le contrat de lecture des outils décisionnels. Trois choses à tenir :
 *
 *   · chaque vue documentée existe, chaque vue existante est documentée —
 *     un contrat qui dérive de sa doc ment à celui qui n'a que la doc ;
 *   · les vues répondent avec des données réelles, y compris la vue des
 *     décisions, dont le filtre porte des libellés qu'un grep a vérifiés :
 *     un libellé inventé ne fait pas d'erreur, il fait du VIDE — et un
 *     registre vide inspire confiance en mentant par omission ;
 *   · rien de secret n'y passe : ni empreinte, ni jeton, ni image
 *     avant/après.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { many } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

describe("INT-05 · le contrat de lecture", () => {
  test("la doc et le schéma disent les mêmes vues, dans les deux sens", async () => {
    const inDb = (await many(
      `SELECT table_name AS v FROM information_schema.views
        WHERE table_schema = 'reporting' ORDER BY table_name`)).map((r) => r.v);
    assert.ok(inDb.length >= 14, "le schéma reporting existe et porte ses vues");

    const doc = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../docs/30-vues-restitution.md"), "utf8");
    for (const v of inDb) {
      assert.ok(doc.includes("`" + v + "`"),
        `la vue reporting.${v} existe et la doc ne la nomme pas — le contrat dérive`);
    }
    const documented = [...doc.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    for (const v of documented) {
      assert.ok(inDb.includes(v),
        `la doc promet reporting.${v} et le schéma ne l'a pas — la doc ment`);
    }
  });

  test("les vues répondent sur le livre réel", async () => {
    const projects = await many(`SELECT * FROM reporting.projects`);
    assert.ok(projects.length > 0);
    assert.ok(projects[0].programme_id && projects[0].site_id);
    assert.equal("row_version" in projects[0], false,
      "la mécanique interne ne fait pas partie du contrat");

    const risks = await many(`SELECT * FROM reporting.risks WHERE project_id = $1`,
      [SITE_PROJECT_GRU]);
    assert.ok(Array.isArray(risks));

    const costs = await many(`SELECT * FROM reporting.cost_lines LIMIT 3`);
    if (costs.length) {
      assert.ok(Number(costs[0].amount) > 1000,
        "l'argent est en unités entières, pas en millions — au client de formater");
    }
  });

  test("une décision réelle atterrit dans reporting.decisions", async () => {
    /* On REJOUE une décision par la vraie route, puis on la relit dans la
       vue : c'est le test qui attrape un libellé inventé dans le filtre.
       (Le grep l'a déjà attrapé une fois, à l'écriture de la migration —
       quatre des dix libellés de la première version n'existaient pas.) */
    const group = await as("groupDCH");
    const put = await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 45, note: "test reporting" });
    assert.equal(put.status, 201, put.text);

    const seen = await many(
      `SELECT action, detail FROM reporting.decisions
        WHERE action = 'Tolerance set' ORDER BY id DESC LIMIT 1`);
    assert.equal(seen.length, 1, "la décision qu'on vient de prendre se lit dans la vue");
    assert.match(seen[0].detail, new RegExp(SITE_PROJECT_GRU));
  });

  test("rien de secret ne traverse le schéma reporting", async () => {
    const cols = await many(
      `SELECT table_name AS v, column_name AS c FROM information_schema.columns
        WHERE table_schema = 'reporting'`);
    const banned = /token|pw_hash|pw_salt|key_hash|before_json|after_json/;
    for (const { v, c } of cols) {
      assert.equal(banned.test(c), false, `reporting.${v}.${c} n'a rien à faire dans un contrat de lecture`);
    }
    const views = new Set(cols.map((x) => x.v));
    for (const forbidden of ["sessions", "integrations", "app_users", "users"]) {
      assert.equal(views.has(forbidden), false, `reporting.${forbidden} ne doit pas exister`);
    }
  });
});

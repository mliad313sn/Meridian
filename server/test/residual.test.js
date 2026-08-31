/**
 * PM-06 · Le risque résiduel, et la provision qui nomme son risque.
 *
 * Deux moitiés du même trou : sans cible résiduelle, « la mitigation
 * a-t-elle servi ? » se répond de mémoire ; et une provision tirée sans
 * nommer son risque se consomme « en général » — un comité qui demande
 * « contre quoi a-t-on dépensé la réserve ? » n'a rien à lire.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

describe("PM-06 · la cible résiduelle", () => {
  test("elle se pose à la levée, se corrige, et reste sur la même échelle", async () => {
    const admin = await as("admin");
    const made = await admin.post("/api/raid", {
      type: "Risk", project: GROUP_PROJECT,
      title: "Panne du lien satellite pendant la bascule",
      p: 4, i: 5, tp: 2, ti: 3, response: "Mitigate",
    });
    assert.equal(made.status, 201, made.text);

    let r = (await admin.get("/api/bootstrap")).body.db.raid.find((x) => x.id === made.body.id);
    assert.equal(r.tp, 2); assert.equal(r.ti, 3);
    assert.ok(r.p > r.tp, "le constat et la cible se comparent — même échelle, même règle");

    const upd = await admin.patch("/api/raid/" + made.body.id, { tp: 1, version: r.version });
    assert.equal(upd.status, 200, upd.text);
    r = (await admin.get("/api/bootstrap")).body.db.raid.find((x) => x.id === made.body.id);
    assert.equal(r.tp, 1);
  });

  test("vide reste vide — Accept n'a pas de cible, il a un constat assumé", async () => {
    const admin = await as("admin");
    const made = await admin.post("/api/raid", {
      type: "Risk", project: GROUP_PROJECT,
      title: "Retard douanier accepté", p: 2, i: 2, response: "Accept",
    });
    const r = (await admin.get("/api/bootstrap")).body.db.raid.find((x) => x.id === made.body.id);
    assert.equal(r.tp, null, "forcer un chiffre inventé serait une fausse assurance");
    assert.equal(r.ti, null);
  });
});

describe("PM-06 · la provision nomme son risque", () => {
  test("un tirage anonyme est refusé quand il y a un risque ouvert à nommer", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.05, period: "2026-09", fromContingency: true,
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /names the risk it answers/i);
    assert.match(r.body.error, /open risk/i, "le refus dit qu'il y a des risques à choisir");
  });

  test("un tirage qui nomme son risque passe, et le grand livre le garde", async () => {
    const admin = await as("admin");
    const risk = (await admin.get("/api/bootstrap")).body.db.raid
      .find((x) => x.project === GROUP_PROJECT && x.type === "Risk" && x.status === "Open");
    assert.ok(risk, "le semis porte des risques ouverts");

    const r = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.05, period: "2026-09",
      fromContingency: true, risk: risk.id,
    });
    assert.equal(r.status, 201, r.text);

    const line = await one(
      `SELECT risk_id FROM cost_line
        WHERE project_id = $1 AND from_contingency ORDER BY id DESC LIMIT 1`, [GROUP_PROJECT]);
    assert.equal(line.risk_id, risk.id,
      "« contre quoi a-t-on dépensé la réserve ? » a désormais une réponse ligne à ligne");

    const led = (await admin.get("/api/bootstrap")).body.db.ledger
      .filter((l) => l.project === GROUP_PROJECT && l.fromContingency);
    assert.ok(led.some((l) => l.risk === risk.id), "et l'écran peut le lire");
  });

  test("un risque d'un autre projet ne finance pas ce tirage", async () => {
    const admin = await as("admin");
    const other = (await admin.get("/api/bootstrap")).body.db.raid
      .find((x) => x.project && x.project !== GROUP_PROJECT && x.type === "Risk" && x.status === "Open");
    assert.ok(other, "il existe un risque ouvert ailleurs");
    const r = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.05, period: "2026-09",
      fromContingency: true, risk: other.id,
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /not an open risk on this project/i);
  });

  test("une écriture ordinaire n'exige rien — la règle porte sur la réserve", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.02, period: "2026-09",
    });
    assert.equal(r.status, 201, "le coût courant n'est pas un tirage de provision");
  });
});

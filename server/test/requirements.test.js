/**
 * MER-03 — le registre d'exigences, et MER-14 — l'identité des allocations.
 *
 * C'était le plus gros manque du produit : un portefeuille qui suit des
 * projets sans suivre ce qu'ils doivent TENIR oblige à garder les
 * exigences à côté de l'outil, ce qui est exactement la situation que
 * l'outil existe pour supprimer.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, client } from "./harness.js";

let base;
before(async () => { ({ base } = await boot()); });
after(shutdown);

async function admin() {
  const c = client();
  await c.post("/api/auth/login",
    { email: "admin@meridian.example", password: "meridian-admin-2026" });
  return c;
}

/** Le plus petit livre importable qui porte une exigence. */
function book(over = {}) {
  return {
    orgName: "TEST", statusDate: "2026-08-28",
    // MER-09 — un livre dit son unité monétaire ou l'import le refuse.
    currencyUnit: "millions",
    sites: [{ id: "S1", city: "Ici", tz: 0 }],
    people: [{ id: "PE-1", name: "A. Personne", role: "PM", site: "S1", rate: 0 }],
    programmes: [{ id: "P1", name: "Programme", managerId: "PE-1" }],
    projects: [{
      id: "X", name: "Projet", programme: "P1", site: "S1",
      governanceLevel: "group", pm: "PE-1", method: "Hybrid",
      start: "2026-01-01", finish: "2026-12-31", budget: 0,
      phase: "Execution", gate: 1, closed: false,
    }],
    activities: [], milestones: [], ledger: [], raid: [], crs: [],
    docs: [], items: [], columns: [], allocations: [],
    ...over,
  };
}

describe("le registre d'exigences (MER-03)", () => {
  test("une exigence survit à l'aller-retour, méthode et preuve séparées", async () => {
    const c = await admin();
    const r = await c.post("/api/admin/import", { db: book({
      requirements: [{
        id: "REQ-001", project: "X",
        statement: "Le programme tient hors ligne sur un appareil à 2 Go",
        source: "[Comité §11]", priority: "M",
        verification: "Essai de charge sur la matrice d'appareils",
        verifiedBy: "", gate: 3, status: "In progress", owner: "PE-1",
      }],
    }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.counts.requirements, 1);

    const boot = await c.get("/api/bootstrap");
    const req = boot.body.db.requirements.find(x => x.id === "REQ-001");
    assert.ok(req, "l'exigence revient dans le portefeuille");
    assert.equal(req.gate, 3);
    assert.equal(req.priority, "M");
    assert.equal(req.verification, "Essai de charge sur la matrice d'appareils");
    assert.equal(req.verifiedBy, "",
      "la méthode promise n'est pas la preuve produite");
  });

  test("une priorité inconnue retombe sur « Must » plutôt que de disparaître", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({
      requirements: [{ id: "REQ-002", project: "X", statement: "Quelque chose",
                       priority: "URGENT!!" }],
    }) });
    const boot = await c.get("/api/bootstrap");
    const req = boot.body.db.requirements.find(x => x.id === "REQ-002");
    assert.equal(req.priority, "M",
      "une exigence sans priorité lisible est obligatoire jusqu'à ce qu'on la déclasse exprès");
  });

  test("une dérogation sans motif est refusée", async () => {
    const c = await admin();
    const r = await c.post("/api/admin/import", { db: book({
      requirements: [{ id: "REQ-003", project: "X", statement: "Chiffrement au repos",
                       status: "Waived", waiverReason: "   " }],
    }) });
    assert.equal(r.status, 400);
    assert.match(String(r.body.error), /REQ-003/);
    assert.match(String(r.body.error), /reason/i,
      "le refus dit ce qui manque, pas « valeur invalide »");
  });

  test("une dérogation motivée passe, et le motif est conservé", async () => {
    const c = await admin();
    const r = await c.post("/api/admin/import", { db: book({
      requirements: [{ id: "REQ-004", project: "X", statement: "Chiffrement au repos",
                       status: "Waived",
                       waiverReason: "Hors périmètre v1 — décision du comité du 12 mai" }],
    }) });
    assert.equal(r.status, 200);
    const boot = await c.get("/api/bootstrap");
    const req = boot.body.db.requirements.find(x => x.id === "REQ-004");
    assert.equal(req.status, "Waived");
    assert.match(req.waiverReason, /comité du 12 mai/);
  });
});

describe("l'identité des allocations (MER-14)", () => {
  test("une allocation garde son identifiant à l'aller-retour", async () => {
    const c = await admin();
    await c.post("/api/admin/import", { db: book({
      allocations: [{ id: 4242, person: "PE-1", project: "X",
                      from: "2026-01-01", to: "2026-06-30", pct: 50 }],
    }) });
    const boot = await c.get("/api/bootstrap");
    const a = boot.body.db.allocations.find(x => String(x.id) === "4242");
    assert.ok(a, "l'identifiant fourni est honoré, comme pour toute autre table");
    assert.equal(a.pct, 50);
  });

  test("deux exports successifs donnent la même allocation, identifiant compris", async () => {
    const c = await admin();
    const source = book({
      allocations: [{ person: "PE-1", project: "X", from: "2026-01-01",
                      to: "2026-06-30", pct: 30 }],
    });
    await c.post("/api/admin/import", { db: source });
    const first = (await c.get("/api/admin/export")).body;
    await c.post("/api/admin/import", { db: first });
    const second = (await c.get("/api/admin/export")).body;
    /* NEW-19 — a replace now moves every row's `version` (the
       concurrency token) past what a screen could hold from before it,
       so that one field is compared by its own rule: strictly greater.
       Every other field, the identifier first, must be identical, which
       is the MER-14 property this test exists for. */
    const sansVersion = (xs) => xs.map(({ version, ...rest }) => rest);
    assert.deepEqual(sansVersion(second.allocations), sansVersion(first.allocations),
      "comparer deux exports ne doit pas montrer toutes les allocations comme modifiées");
    first.allocations.forEach((a, i) => assert.ok(second.allocations[i].version > a.version,
      "la version, elle, dépasse celle que tenait un écran avant le remplacement"));
  });

  test("une clé inconnue est refusée au lieu d'atterrir à zéro", async () => {
    const c = await admin();
    const r = await c.post("/api/admin/import", { db: book({
      allocations: [{ person: "PE-1", project: "X", from: "2026-01-01",
                      to: "2026-06-30", fte: 2.0 }],
    }) });
    assert.equal(r.status, 400);
    assert.match(String(r.body.error), /fte/,
      "le refus nomme le champ fautif");
    assert.match(String(r.body.error), /pct/,
      "et dit lequel attendre — sinon on a remplacé un piège par un autre");
  });
});

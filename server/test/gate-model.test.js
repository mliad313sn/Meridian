/**
 * MER-01 — le modèle de jalons est une donnée, et les jalons peuvent boucler.
 *
 * Constat d'origine : `GATES` était une constante de quatre dans
 * `shared/engine.js`. Un portefeuille à six jalons qui BOUCLENT — KODO,
 * un produit éducatif dont la revue renvoie au cahier des charges trois
 * fois avant lancement — les écrasait sur quatre, si bien que les deux
 * jalons qui bloquent réellement sa sortie devenaient de simples dates.
 *
 * Ces tests sont écrits sur des fixtures calculables à la main, comme
 * ceux du moteur : un échec doit dire « le modèle a changé », pas
 * « les données ont bougé ».
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Engine, GATES } from "../../shared/engine.js";

/** Le plus petit portefeuille qui exerce encore les jalons. */
function fixture(over = {}) {
  return {
    statusDate: "2026-07-01",
    settings: { gateLock: true, ...over.settings },
    projects: [{ id: "X", name: "Test", loop: 1, ...over.project }],
    milestones: over.milestones ?? [],
    docs: over.docs ?? [],
  };
}

const evidence = (id, gate, loop, status = "Approved") => ({
  id, project: "X", name: `Preuve ${id}`, gate, loop, status,
  uri: "https://docs.example/" + id,
});
const gateMs = (id, gate, loop, date) => ({
  id, project: "X", name: `Jalon ${gate}`, date, gate, loop, kind: "gate",
});

describe("le modèle de jalons se configure", () => {
  test("sans réglage, ce sont exactement les quatre d'origine", () => {
    const model = Engine.gateModel(fixture());
    assert.deepEqual(model.map(g => g.n), GATES.map(g => g.n));
    assert.equal(model.length, 4);
  });

  test("un portefeuille à six jalons en a six, pas quatre", () => {
    const six = [
      { n: 0, name: "G0 — Mandat" }, { n: 1, name: "G1 — Cahier des charges" },
      { n: 2, name: "G2 — Prompts" }, { n: 3, name: "G3 — Construction" },
      { n: 4, name: "G4 — Revue" }, { n: 5, name: "G5 — Marché", loopsTo: 1 },
    ];
    const model = Engine.gateModel(fixture({ settings: { gates: six } }));
    assert.equal(model.length, 6);
    assert.equal(model[5].name, "G5 — Marché");
    assert.equal(model[5].loopsTo, 1, "un jalon peut renvoyer à un autre");
  });

  test("le modèle est trié et les entrées illisibles sont écartées", () => {
    const model = Engine.gateModel(fixture({
      settings: { gates: [{ n: 3 }, { n: 1 }, { nope: true }, { n: 2 }] },
    }));
    assert.deepEqual(model.map(g => g.n), [1, 2, 3],
      "une entrée sans numéro n'est pas un jalon");
  });

  test("un réglage vide retombe sur le défaut plutôt que sur rien", () => {
    assert.equal(Engine.gateModel(fixture({ settings: { gates: [] } })).length, 4);
    assert.equal(Engine.gateModel(fixture({ settings: { gates: "oui" } })).length, 4);
  });

  test("le dernier jalon du modèle est celui qu'on rend une fois tout franchi", () => {
    const db = fixture({
      settings: { gates: [{ n: 1, name: "Un" }, { n: 2, name: "Deux" }] },
      milestones: [gateMs("M1", 1, 1, "2026-06-01"), gateMs("M2", 2, 1, "2026-06-15")],
      docs: [evidence("D1", 1, 1), evidence("D2", 2, 1)],
    });
    const g = Engine.currentGate(db, "X");
    assert.equal(g.name, "Deux", "et non le quatrième d'un modèle qui n'en a que deux");
    assert.equal(g.state, "Cleared");
  });
});

describe("les jalons bouclent", () => {
  /* La preuve du premier tour ne doit pas franchir le jalon du second :
     sinon la deuxième revue s'ouvre en se croyant déjà terminée. */
  const twoGates = [{ n: 1, name: "Un" }, { n: 2, name: "Deux" }];

  test("un projet au tour 2 ne franchit pas son jalon 1 avec la preuve du tour 1", () => {
    const db = fixture({
      settings: { gates: twoGates },
      project: { loop: 2 },
      milestones: [gateMs("M1", 1, 1, "2026-06-01")],
      docs: [evidence("D1", 1, 1)],
    });
    const g = Engine.currentGate(db, "X");
    assert.equal(g.n, 1);
    assert.equal(g.loop, 2);
    assert.notEqual(g.state, "Cleared",
      "la preuve du tour 1 ne vaut pas pour le tour 2");
  });

  test("le même projet franchit son jalon 1 avec la preuve du tour 2", () => {
    const db = fixture({
      settings: { gates: twoGates },
      project: { loop: 2 },
      milestones: [gateMs("M1", 1, 1, "2026-06-01"), gateMs("M1b", 1, 2, "2026-06-20")],
      docs: [evidence("D1", 1, 1), evidence("D2", 1, 2)],
    });
    assert.equal(Engine.gateStatus(db, "X", 1, 2).state, "Cleared",
      "la preuve du tour 2 franchit bien le jalon du tour 2");
    /* Et le jalon courant avance : il n'y a plus rien à faire au jalon 1
       de ce tour, donc le projet est attendu au jalon 2. */
    const g = Engine.currentGate(db, "X");
    assert.equal(g.n, 2);
    assert.equal(g.loop, 2);
  });

  test("ce qui n'a pas de tour est au tour 1, donc rien d'existant ne bouge", () => {
    const db = fixture({
      milestones: [{ id: "M1", project: "X", name: "J1", date: "2026-06-01", gate: 1, kind: "gate" }],
      docs: [{ id: "D1", project: "X", name: "Preuve", gate: 1, status: "Approved",
               uri: "https://docs.example/D1" }],
    });
    const st = Engine.gateStatus(db, "X", 1);
    assert.equal(st.loop, 1);
    assert.equal(st.state, "Cleared", "un livre sans tours se comporte comme avant");
  });

  test("la limite de tours n'existe que si quelqu'un l'a posée", () => {
    assert.equal(Engine.gateLoopLimit(fixture()), 0, "aucun seuil inventé");
    assert.equal(Engine.gateLoopLimit(fixture({ settings: { gateLoopLimit: 3 } })), 3);
    assert.equal(Engine.gateLoopLimit(fixture({ settings: { gateLoopLimit: -1 } })), 0);
  });
});

describe("le verrouillage de jalon suit le modèle configuré", () => {
  test("un jalon sans aucune preuve exigée le DIT, au lieu d'annoncer zéro en attente", () => {
    const db = fixture({
      settings: { gates: [{ n: 0, name: "G0 — Mandat" }] },
      milestones: [gateMs("M0", 0, 1, "2026-09-01")],
      docs: [],
    });
    const verdict = Engine.canAdvance(db, "X");
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /No evidence has been registered/,
      "« 0 en attente » et pourtant bloqué envoie chercher dans une liste vide");
    assert.doesNotMatch(verdict.reason, /^0 evidence/);
  });

  test("un jalon sans preuve bloque l'avancement, quel que soit son numéro", () => {
    const db = fixture({
      settings: { gates: [{ n: 5, name: "G5 — Marché" }] },
      milestones: [gateMs("M5", 5, 1, "2026-06-01")],
      docs: [evidence("D5", 5, 1, "Draft")],
    });
    const verdict = Engine.canAdvance(db, "X");
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /G5 — Marché/,
      "le motif nomme le jalon réel du produit, pas « Gate 4 — Benefits »");
  });
});

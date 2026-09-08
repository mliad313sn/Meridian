/**
 * REQ-28 (RT365 V-9) — LES CINQ SIGNAUX DE GOUVERNANCE.
 *
 * Ce que ce fichier surveille, dans l'ordre d'importance :
 *
 *   1. **l'absence se dit, et ne se peint pas en vert.** C'est la règle
 *      que le produit a apprise à ses dépens (REQ-33, 5.13.0) : un écran
 *      a rapporté ON TRACK 100 %, SPI 1.00, COST INDEX 1.00 pour un livre
 *      sans budget, et l'a écrit dans un instantané non modifiable. Ici,
 *      chacun des cinq a un état « pas mesuré », et chacun doit
 *      l'ATTEINDRE plutôt qu'un zéro ou un 100 %. Un portefeuille qui n'a
 *      franchi aucune porte n'a pas un délai de porte de 0 jour ;
 *   2. **une tendance a besoin de deux périodes.** Avec une seule il n'y
 *      a pas de tendance, et l'objet doit le DIRE ;
 *   3. **les échelles ne se comparent pas entre elles** (036/043) : la
 *      porte 3 d'une échelle à quatre n'est pas la porte 3 d'une échelle
 *      à six ;
 *   4. l'autorité est décidée dans shared/rbac.js, et la portée de
 *      lecture est celle du sérialiseur : ce qu'un compte ne voit pas ne
 *      compte pas dans ses chiffres.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client } from "./harness.js";
import { query, one } from "../src/db.js";
import {
  govSignals, SIGNAL_TEXT, SIGNAL_ORDER, formatSignal, formatTrend, spread, periodKeys, periodEnd,
} from "../../shared/govsignals.js";

const AS_AT = "2026-08-28";

/** Un livre nu : rien du tout, ce qui est le cas le plus révélateur. */
const emptyBook = (over = {}) => govSignals({ asAt: AS_AT, ...over });

describe("REQ-28 · rien de mesuré ne se lit comme quelque chose de bon", () => {
  test("les cinq signaux d'un livre vide sont N, avec une raison chacun", () => {
    const b = emptyBook();
    assert.deepEqual(b.order, SIGNAL_ORDER);
    assert.equal(b.order.length, 5);
    for (const key of b.order) {
      const m = b.portfolio.signals[key];
      assert.equal(m.state, "N", `${key} doit être « pas mesuré » sur un livre vide`);
      assert.equal(m.rag, "N", `${key} porte le quatrième état du moteur`);
      assert.equal(m.value, null, `${key} ne doit PAS rendre un nombre`);
      assert.equal(m.median, null);
      assert.ok(m.why && m.why.length > 10, `${key} doit dire POURQUOI`);
      assert.equal(formatSignal(m), "—", `${key} s'affiche « — », jamais 0 ni 100 %`);
      assert.equal(formatTrend(m), "—");
      assert.equal(m.trend.state, "N");
    }
  });

  test("aucun signal ne fabrique un zéro, un 100 % ou un vert", () => {
    const b = emptyBook();
    const drawn = b.order.map((k) => formatSignal(b.portfolio.signals[k]));
    assert.deepEqual(drawn, ["—", "—", "—", "—", "—"]);
    for (const k of b.order) {
      /* La faute exacte de 5.12 : un indice absent rendu 1.00, une
         couleur inventée. Aucun des cinq ne porte de couleur du tout tant
         que personne n'a convenu d'un seuil. */
      assert.equal(b.portfolio.signals[k].rag, "N");
    }
  });

  test("une porte franchie n'est pas un délai de zéro jour", () => {
    /* Le cas nommé par le comité : un projet qui n'a fermé aucune porte
       n'a PAS un délai de cycle de 0 — il n'en a pas. */
    const b = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      milestones: [{ project: "P1", gate: 1, kind: "gate", done: false, acceptedOn: null }],
    });
    const g = b.portfolio.signals.gateCycleTime;
    assert.equal(g.state, "N");
    assert.equal(g.why, SIGNAL_TEXT.noGateClosed);
    assert.notEqual(g.value, 0);
    assert.equal(g.value, null);
  });

  test("un registre d'actions vide n'a pas un âge de zéro jour", () => {
    const b = emptyBook({
      actions: [{ project: null, status: "Done", raisedOn: "2026-01-05", closedAt: "2026-02-01T09:00:00Z" }],
    });
    const a = b.portfolio.signals.actionAgeing;
    assert.equal(a.state, "N");
    assert.equal(a.why, SIGNAL_TEXT.noOpenAction);
    assert.equal(a.value, null);
    assert.equal(a.extra.closed, 1);
  });

  test("une conformité sans dénominateur n'est pas 100 %", () => {
    const closed = emptyBook({ raid: [{ project: "P1", status: "Closed", review: "2026-01-01" }] });
    const c1 = closed.portfolio.signals.raidReviewCompliance;
    assert.equal(c1.state, "N");
    assert.equal(c1.why, SIGNAL_TEXT.noOpenRaid);
    assert.equal(c1.value, null);

    const undated = emptyBook({ raid: [{ project: "P1", status: "Open", review: null }] });
    const c2 = undated.portfolio.signals.raidReviewCompliance;
    assert.equal(c2.state, "N");
    assert.equal(c2.why, SIGNAL_TEXT.noReviewDate);
    assert.equal(c2.value, null);
    assert.equal(c2.extra.unscheduled, 1, "une ligne sans date de revue se COMPTE et se dit");
  });
});

describe("REQ-28 · 1 · délai de décision — deux horloges, pas une", () => {
  const decisions = [
    /* prise en salle le 1er juin, consignée le 4 : trois jours */
    { id: "D1", project: "P1", takenOn: "2026-06-01", recordedAt: "2026-06-04T10:00:00Z", status: "Ratified" },
    /* prise hors salle le 1er juillet, consignée le 31 : trente jours */
    { id: "D2", project: "P1", takenOn: "2026-07-01", recordedAt: "2026-07-31T10:00:00Z", status: "Ratified" },
    { id: "D3", project: "P1", takenOn: "2026-07-10", recordedAt: "2026-07-20T10:00:00Z", status: "Ratified" },
  ];
  const book = () => emptyBook({ projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }], decisions });

  test("la latence va du jour où l'on a décidé au jour où le registre l'a su", () => {
    const m = book().portfolio.signals.decisionLatency;
    assert.equal(m.state, "measured");
    assert.equal(m.n, 3);
    assert.equal(m.min, 3);
    assert.equal(m.max, 30);
    assert.equal(m.median, 10);
    assert.equal(formatSignal(m), "10d");
  });

  test("une ligne consignée AVANT le jour qu'elle porte n'est pas une latence rapide", () => {
    const m = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      decisions: [{ id: "D9", project: "P1", takenOn: "2026-07-01", recordedAt: "2026-06-01T10:00:00Z" }],
    }).portfolio.signals.decisionLatency;
    assert.equal(m.state, "N", "une latence négative est une ligne illisible, pas une performance");
    assert.equal(m.extra.undatable, 1);
    assert.notEqual(m.value, 0);
  });

  test("une décision proposée n'a pas de date de ratification, et on le dit", () => {
    const m = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      decisions: [...decisions, { id: "D4", project: "P1", takenOn: "2026-08-01", recordedAt: "2026-08-02T10:00:00Z", status: "Proposed" }],
    }).portfolio.signals.decisionLatency;
    assert.equal(m.extra.awaitingRatification, 1);
    assert.equal(m.note, SIGNAL_TEXT.awaitingRatification);
  });

  test("deux mois de décisions font une tendance ; un seul n'en fait pas", () => {
    const two = book().portfolio.signals.decisionLatency.trend;
    assert.equal(two.state, "measured");
    assert.equal(two.previous, 3, "juin");
    assert.equal(two.latest, 20, "juillet : médiane de 30 et 10");
    assert.equal(two.direction, "up");
    assert.equal(two.delta, 17);

    const one = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      decisions: [decisions[0]],
    }).portfolio.signals.decisionLatency.trend;
    assert.equal(one.state, "N");
    assert.equal(one.why, SIGNAL_TEXT.trendOnePeriod);
    assert.equal(one.delta, null);
  });
});

describe("REQ-28 · 2 · l'âge des actions — la queue, pas la moyenne", () => {
  const actions = [
    { id: "A1", project: "P1", status: "Open", raisedOn: "2026-08-20", dueDate: "2026-09-01", closedAt: null },
    { id: "A2", project: "P1", status: "In progress", raisedOn: "2026-08-14", dueDate: "2026-08-01", closedAt: null },
    { id: "A3", project: "P1", status: "Open", raisedOn: "2026-08-08", dueDate: null, closedAt: null },
    /* la queue de deux ans que la moyenne cacherait */
    { id: "A4", project: "P1", status: "Open", raisedOn: "2024-08-28", dueDate: "2024-09-30", closedAt: null },
  ];
  const m = () => emptyBook({
    projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }], actions,
  }).portfolio.signals.actionAgeing;

  test("la médiane mène, et la queue voyage avec elle", () => {
    const a = m();
    assert.equal(a.state, "measured");
    assert.equal(a.n, 4);
    assert.equal(a.max, 730, "l'action de deux ans est visible sans qu'on la cherche");
    assert.equal(a.median, 17);
    assert.ok(a.p90 > a.median, "la p90 est publiée à côté de la médiane");
    assert.ok(a.mean > a.median, "un registre à moyenne saine et à queue de deux ans n'est pas sain");
  });

  test("la distribution est publiée en tranches, pas résumée en un chiffre", () => {
    const a = m();
    assert.equal(a.extra.buckets["0-30d"], 3);
    assert.equal(a.extra.buckets["over a year"], 1);
    assert.equal(a.extra.overdue, 2, "en retard sur leur échéance");
  });

  test("une clôture sans date empêche de rejouer l'histoire, et la tendance le dit", () => {
    const a = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      actions: [...actions, { id: "A5", project: "P1", status: "Done", raisedOn: "2026-05-02", closedAt: null }],
    }).portfolio.signals.actionAgeing;
    assert.equal(a.extra.undatedClosures, 1);
    assert.equal(a.trend.state, "N");
    assert.equal(a.trend.why, SIGNAL_TEXT.trendUndatedActions);
  });

  test("le registre ouvert se rejoue à la fin de chaque mois", () => {
    const a = m();
    const at = (k) => a.trend.periods.find((p) => p.key === k);
    /* En mars 2026 seule l'action d'août 2024 était ouverte. */
    assert.equal(at("2026-03").n, 1);
    assert.equal(at("2026-08").n, 4);
    assert.equal(a.trend.state, "measured");
    assert.equal(a.trend.direction, "down", "trois actions récentes font baisser la médiane");
  });
});

describe("REQ-28 · 3 · le délai de porte — une échelle n'est pas l'autre", () => {
  const four = { id: "P4", programme: "PR", scaffoldedGates: 4 };
  const six = { id: "P6", programme: "PR", scaffoldedGates: 6 };
  const g = (project, gate, acceptedOn, done = true) =>
    ({ project, gate, kind: "gate", done, acceptedOn });

  test("un barreau se mesure entre deux portes ADJACENTES et datées", () => {
    const m = emptyBook({
      projects: [four],
      milestones: [g("P4", 1, "2026-03-01"), g("P4", 2, "2026-04-10"), g("P4", 3, "2026-06-09")],
    }).portfolio.signals.gateCycleTime;
    assert.equal(m.state, "measured");
    assert.equal(m.n, 2, "1→2 et 2→3");
    assert.deepEqual(m.extra.bySteps.map((s) => s.step),
      ["4-gate ladder · 1 → 2", "4-gate ladder · 2 → 3"]);
    assert.equal(m.extra.bySteps[0].median, 40);
    assert.equal(m.extra.bySteps[1].median, 60);
    assert.equal(m.median, 50);
  });

  test("une porte sautée ne devient pas un barreau deux fois plus long", () => {
    const m = emptyBook({
      projects: [four],
      milestones: [g("P4", 1, "2026-03-01"), g("P4", 3, "2026-06-09")],
    }).portfolio.signals.gateCycleTime;
    assert.equal(m.state, "N", "1 et 3 sans 2 : ce n'est pas un délai de cycle, c'est deux et un trou");
    assert.equal(m.why, SIGNAL_TEXT.noGateClosed);
  });

  test("la porte 3 d'une échelle à quatre n'entre pas dans la même médiane que celle d'une échelle à six", () => {
    const m = emptyBook({
      projects: [four, six],
      milestones: [
        g("P4", 1, "2026-03-01"), g("P4", 2, "2026-04-10"),
        g("P6", 1, "2026-03-01"), g("P6", 2, "2026-03-11"),
      ],
    }).portfolio.signals.gateCycleTime;
    assert.equal(m.state, "N", "l'en-tête REFUSE de moyenner deux échelles");
    assert.equal(m.why, SIGNAL_TEXT.ladderMixed);
    assert.equal(m.value, null);
    assert.deepEqual(m.extra.ladders, [4, 6]);
    /* Mais chaque barreau garde sa propre médiane : on ne perd rien, on
       refuse seulement de mélanger. */
    assert.equal(m.extra.bySteps.length, 2);
    assert.equal(m.n, 2);
  });

  test("une porte cochée « faite » sans date d'acceptation n'est mesurée par rien", () => {
    const m = emptyBook({
      projects: [four],
      milestones: [g("P4", 1, null), g("P4", 2, null)],
    }).portfolio.signals.gateCycleTime;
    assert.equal(m.state, "N");
    assert.equal(m.why, SIGNAL_TEXT.gateUndated);
    assert.equal(m.extra.closedGates, 2);
    assert.equal(m.extra.closedWithoutDate, 2);
  });

  test("un projet dressé sous une échelle inconnue ne se voit pas attribuer la nôtre", () => {
    const m = emptyBook({
      projects: [{ id: "PX", programme: "PR", scaffoldedGates: null }],
      milestones: [g("PX", 1, "2026-03-01"), g("PX", 2, "2026-04-10")],
    }).portfolio.signals.gateCycleTime;
    assert.equal(m.state, "N", "la 043 a refusé de deviner ; on refuse aussi");
    assert.equal(m.why, SIGNAL_TEXT.ladderUnknown);
    assert.equal(m.extra.unknownLadder, 1, "un seul barreau, et il est illisible");
  });
});

describe("REQ-28 · 4 · la conformité de revue RAID", () => {
  const raid = [
    { project: "P1", status: "Open", review: "2026-09-30" },   // dans les temps
    { project: "P1", status: "Open", review: "2026-09-01" },   // dans les temps
    { project: "P1", status: "Open", review: "2026-08-01" },   // 27 jours de retard
    { project: "P1", status: "Open", review: null },           // jamais programmée
    { project: "P1", status: "Closed", review: "2020-01-01" }, // close : hors sujet
  ];
  const m = () => emptyBook({
    projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }], raid,
  }).portfolio.signals.raidReviewCompliance;

  test("la conformité se mesure contre la date de revue, et contre rien d'autre", () => {
    const c = m();
    assert.equal(c.state, "measured");
    assert.equal(c.extra.scheduled, 3);
    assert.equal(c.extra.onTime, 2);
    assert.equal(c.extra.overdue, 1);
    assert.equal(c.value, 0.6667);
    assert.equal(formatSignal(c), "67%");
    assert.equal(c.extra.worstOverdueDays, 27);
  });

  test("une ligne sans date de revue n'est ni conforme ni non conforme", () => {
    const c = m();
    assert.equal(c.extra.unscheduled, 1);
    assert.equal(c.n, 3, "elle n'est PAS au dénominateur");
    assert.equal(c.extra.onTime + c.extra.overdue, c.n, "ni au numérateur");
  });

  test("il n'y a pas de tendance, et c'est un constat, pas un oubli", () => {
    /* Le schéma porte la PROCHAINE date de revue et aucune trace qu'une
       revue ait eu lieu : faire la revue avance la date, ce qui efface la
       seule preuve qu'il y en avait une. */
    const c = m();
    assert.equal(c.trend.state, "N");
    assert.equal(c.trend.why, SIGNAL_TEXT.trendNoHistory);
    assert.deepEqual(c.trend.periods, []);
  });
});

describe("REQ-28 · 5 · l'âge des exceptions", () => {
  const exceptions = [
    { project: "P1", raisedOn: "2026-08-18", status: "Open", answeredOn: null },
    { project: "P1", raisedOn: "2026-06-28", status: "Open", answeredOn: null },
    { project: "P1", raisedOn: "2026-05-01", status: "Answered", answeredOn: "2026-05-11" },
  ];
  const m = (over = []) => emptyBook({
    projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
    exceptions: [...exceptions, ...over],
  }).portfolio.signals.exceptionAge;

  test("l'âge est celui des exceptions OUVERTES — une exception ne se ferme jamais toute seule", () => {
    const e = m();
    assert.equal(e.state, "measured");
    assert.equal(e.n, 2);
    assert.equal(e.min, 10);
    assert.equal(e.max, 61);
    assert.equal(e.extra.oldestOpenDays, 61);
    assert.equal(e.extra.medianAnswerDays, 10, "et le temps de réponse quand il y en a une");
  });

  test("aucune exception ouverte : il n'y a pas d'âge, pas un âge de zéro", () => {
    const e = emptyBook({
      projects: [{ id: "P1", programme: "PR", scaffoldedGates: 4 }],
      exceptions: [exceptions[2]],
    }).portfolio.signals.exceptionAge;
    assert.equal(e.state, "N");
    assert.equal(e.why, SIGNAL_TEXT.noOpenException);
    assert.equal(e.value, null);
    assert.equal(e.extra.answered, 1);
  });

  test("une réponse sans date empêche de rejouer l'histoire", () => {
    const e = m([{ project: "P1", raisedOn: "2026-02-01", status: "Withdrawn", answeredOn: null }]);
    assert.equal(e.extra.undatedAnswers, 1);
    assert.equal(e.trend.state, "N");
    assert.equal(e.trend.why, SIGNAL_TEXT.trendUndatedExceptions);
  });
});

describe("REQ-28 · les outils de mesure eux-mêmes", () => {
  test("spread() ne décrit pas ce qui n'existe pas", () => {
    assert.equal(spread([]), null);
    assert.equal(spread([null, undefined, NaN]), null);
    const s = spread([1, 2, 3, 100]);
    assert.equal(s.n, 4);
    assert.equal(s.median, 2.5);
    assert.equal(s.max, 100);
  });

  test("les périodes sont mensuelles, bornées à la date d'état", () => {
    assert.deepEqual(periodKeys("2026-01-15", 3), ["2025-11", "2025-12", "2026-01"]);
    assert.equal(periodEnd("2025-11", "2026-01-15"), "2025-11-30");
    assert.equal(periodEnd("2026-01", "2026-01-15"), "2026-01-15", "le mois courant s'arrête aujourd'hui");
  });

  test("le mois de bascule ne saute pas un mois court", () => {
    assert.deepEqual(periodKeys("2026-03-31", 2), ["2026-02", "2026-03"]);
    assert.equal(periodEnd("2026-02", "2026-03-31"), "2026-02-28");
  });
});

/* ══════════════════════════════════════════════════════════════════
   LA ROUTE — sur un vrai livre.
   ══════════════════════════════════════════════════════════════════ */

describe("REQ-28 · la route", () => {
  before(async () => { await boot({ today: AS_AT }); });
  after(shutdown);

  test("elle est derrière le mur de session comme tout /api", async () => {
    const anon = await as(null);
    assert.equal((await anon.get("/api/signals")).status, 401);
  });

  test("elle rend les cinq, pour le portefeuille et par programme", async () => {
    const admin = await as("admin");
    const r = await admin.get("/api/signals");
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.asAt, AS_AT);
    assert.deepEqual(r.body.order, SIGNAL_ORDER);
    assert.equal(r.body.periods.length, 6);
    assert.equal(r.body.periods[5], "2026-08");
    for (const key of SIGNAL_ORDER) assert.ok(r.body.portfolio.signals[key], key);
    assert.ok(r.body.programmes.length >= 4, "un bloc par programme");
    for (const p of r.body.programmes) {
      assert.ok(p.id && p.name);
      for (const key of SIGNAL_ORDER) {
        const m = p.signals[key];
        assert.ok(["measured", "N"].includes(m.state));
        if (m.state === "N") assert.equal(m.value, null, `${p.id}/${key}`);
      }
    }
  });

  test("le livre livré n'a AUCUN délai de porte, et le dit au lieu de rendre 0", async () => {
    /* Constat, pas mise en scène : la route d'acceptation n'écrit
       `accepted_on` que lorsque le jalon porte des critères de recette
       (032). Les vingt-quatre portes du livre sont cochées sans date,
       donc le délai de cycle n'est mesuré par rien. */
    const admin = await as("admin");
    const g = (await admin.get("/api/signals")).body.portfolio.signals.gateCycleTime;
    assert.equal(g.state, "N");
    assert.equal(g.why, SIGNAL_TEXT.gateUndated);
    assert.equal(g.value, null);
    assert.ok(g.extra.closedWithoutDate > 0);
    assert.equal(formatSignal(g), "—");
  });

  test("des portes datées, sur une échelle nommée, se mesurent", async () => {
    /* Une reprise réelle : le programme charge ses dates d'acceptation
       par le contrat. On les pose ici comme une reprise les poserait. */
    await query(
      `UPDATE project SET scaffolded_gates = 4 WHERE id = 'PRJ-101'`);
    await query(
      `UPDATE milestone SET accepted_on = $1::date
        WHERE project_id = 'PRJ-101' AND kind = 'gate' AND gate = 1`, ["2026-05-04"]);
    await query(
      `UPDATE milestone SET accepted_on = $1::date
        WHERE project_id = 'PRJ-101' AND kind = 'gate' AND gate = 2`, ["2026-06-13"]);

    const admin = await as("admin");
    const g = (await admin.get("/api/signals")).body.portfolio.signals.gateCycleTime;
    assert.equal(g.state, "measured", JSON.stringify(g.extra));
    assert.equal(g.n, 1);
    assert.equal(g.value, 40);
    assert.equal(formatSignal(g), "40d");
    assert.deepEqual(g.extra.ladders, [4]);
    assert.equal(g.extra.bySteps[0].step, "4-gate ladder · 1 → 2");
    /* Une seule période datée : pas de tendance, et on le dit. */
    assert.equal(g.trend.state, "N");
    assert.equal(g.trend.why, SIGNAL_TEXT.trendOnePeriod);
  });

  test("la conformité RAID du livre se recoupe avec le registre lui-même", async () => {
    const admin = await as("admin");
    const c = (await admin.get("/api/signals")).body.portfolio.signals.raidReviewCompliance;
    const row = await one(
      `SELECT count(*) FILTER (WHERE review_on IS NOT NULL) AS scheduled,
              count(*) FILTER (WHERE review_on IS NOT NULL AND review_on >= $1::date) AS ontime,
              count(*) FILTER (WHERE review_on IS NULL) AS unscheduled
         FROM raid_item WHERE status = 'Open'`, [AS_AT]);
    assert.equal(c.extra.scheduled, Number(row.scheduled));
    assert.equal(c.extra.onTime, Number(row.ontime));
    assert.equal(c.extra.unscheduled, Number(row.unscheduled));
    if (Number(row.scheduled)) {
      assert.equal(c.state, "measured");
      assert.equal(c.value, Math.round((Number(row.ontime) / Number(row.scheduled)) * 10000) / 10000);
    }
  });

  test("ce qu'un compte ne voit pas ne compte pas dans ses chiffres", async () => {
    /* DEC-001 porte sur PRJ-101 (Cracovie, groupe). Un lecteur habilité au
       seul site de São Paulo ne voit pas ce projet, donc ne voit pas cette
       décision — et son délai de décision n'est mesuré par rien plutôt que
       d'être emprunté au portefeuille. */
    const admin = await as("admin");
    const viewer = await as("viewerGRU");
    const wide = (await admin.get("/api/signals")).body.portfolio.signals;
    const narrow = (await viewer.get("/api/signals")).body.portfolio.signals;
    assert.ok(wide.decisionLatency.extra.decisions >= 1);
    assert.ok(narrow.decisionLatency.extra.decisions < wide.decisionLatency.extra.decisions,
      "le lecteur de site voit strictement moins de décisions");
    assert.ok(narrow.raidReviewCompliance.extra.items < wide.raidReviewCompliance.extra.items);
  });

  test("`months` est borné, jamais cru sur parole", async () => {
    const admin = await as("admin");
    assert.equal((await admin.get("/api/signals?months=3")).body.periods.length, 3);
    assert.equal((await admin.get("/api/signals?months=999")).body.periods.length, 24);
    assert.equal((await admin.get("/api/signals?months=0")).body.periods.length, 2);
    assert.equal((await admin.get("/api/signals?months=nonsense")).body.periods.length, 6);
  });
});

describe("REQ-28 · le contrat /api/v1", () => {
  before(async () => { await boot({ today: AS_AT }); });
  after(shutdown);

  async function mint(admin, name, scopes) {
    const r = await admin.post("/api/admin/integrations", { name, scopes, purpose: "REQ-28" });
    assert.equal(r.status, 201, r.text);
    return r.body;
  }

  test("sans clé, rien ; avec une clé sans la portée, un refus qui dit laquelle", async () => {
    const admin = await as("admin");
    const c = client();
    assert.equal((await c.get("/api/v1/signals")).status, 401);

    const weak = await mint(admin, "Piste seule", "read:audit");
    const refused = await c.get("/api/v1/signals", { "X-API-Key": weak.key });
    assert.equal(refused.status, 403);
    assert.match(refused.body.error, /read:portfolio/);
  });

  test("avec read:portfolio, le même calcul que l'écran, tamponné", async () => {
    const admin = await as("admin");
    const key = (await mint(admin, "Entrepôt gouvernance", "read:portfolio")).key;
    const c = client();
    const r = await c.get("/api/v1/signals", { "X-API-Key": key });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.contract, "v1");
    assert.ok(r.body.generatedAt);
    assert.equal(r.body.signals.asAt, AS_AT);
    assert.deepEqual(r.body.signals.order, SIGNAL_ORDER);

    /* La même sortie que l'écran : deux projections divergeraient au
       premier changement, et l'intégrateur lirait alors des chiffres que
       personne ne voit à l'écran. */
    const screen = (await admin.get("/api/signals")).body;
    assert.deepEqual(r.body.signals.portfolio, screen.portfolio);
    assert.deepEqual(r.body.signals.programmes, screen.programmes);
  });

  test("les libellés sortent en CLÉS d'i18n, jamais en anglais figé", async () => {
    const admin = await as("admin");
    const b = (await admin.get("/api/signals")).body;
    for (const key of SIGNAL_ORDER) {
      const m = b.portfolio.signals[key];
      assert.equal(m.label, SIGNAL_TEXT[key],
        "le libellé est la clé littérale que t() traduit, pas une phrase composée ici");
      if (m.why) assert.ok(Object.values(SIGNAL_TEXT).includes(m.why),
        `« ${m.why} » doit être une clé déclarée dans SIGNAL_TEXT`);
      if (m.trend.why) assert.ok(Object.values(SIGNAL_TEXT).includes(m.trend.why));
      if (m.note) assert.ok(Object.values(SIGNAL_TEXT).includes(m.note));
    }
  });
});

describe("REQ-28 · une fenêtre sans donnée n'est pas « une seule période »", () => {
  test("zéro période valuée et une seule période valuée ne disent pas la même chose", () => {
    const projects = [{ id: "P1", programme: "PR", scaffoldedGates: 4 }];
    /* Une décision d'il y a longtemps, hors de la fenêtre de trois mois :
       aucune période ne porte de valeur. */
    const none = govSignals({
      asAt: AS_AT, months: 3, projects,
      decisions: [{ id: "D1", project: "P1", takenOn: "2025-01-06", recordedAt: "2025-01-09T10:00:00Z" }],
    }).portfolio.signals.decisionLatency.trend;
    assert.equal(none.state, "N");
    assert.equal(none.why, SIGNAL_TEXT.trendNoPeriod);
    assert.equal(none.latest, null);

    const one = govSignals({
      asAt: AS_AT, months: 3, projects,
      decisions: [{ id: "D2", project: "P1", takenOn: "2026-08-03", recordedAt: "2026-08-06T10:00:00Z" }],
    }).portfolio.signals.decisionLatency.trend;
    assert.equal(one.state, "N");
    assert.equal(one.why, SIGNAL_TEXT.trendOnePeriod);
    assert.equal(one.latest, 3, "la seule période garde sa valeur ; c'est l'ÉCART qui manque");
    assert.equal(one.delta, null);
  });
});

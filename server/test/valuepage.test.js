/**
 * REQ-30 (RT365 V-11) — LA PAGE DE VALEUR, ET SON INSTANTANÉ PAR PÉRIODE.
 *
 * Ce que ce fichier surveille, dans l'ordre d'importance :
 *
 *   1. **l'absence s'écrit, et ne se peint pas en zéro.** C'est la règle
 *      que le produit a apprise à ses dépens (REQ-33, 5.13.0) : un écran
 *      a rapporté ON TRACK 100 %, SPI 1.00, COST INDEX 1.00 pour un livre
 *      sans budget, et l'a écrit dans un instantané NON MODIFIABLE. Ici
 *      la fonction écrit l'histoire : un chiffre faux l'est pour
 *      toujours. Chacune des six figures a donc un état « pas mesuré »,
 *      et la base REFUSE une ligne qui rangerait un zéro à sa place ;
 *   2. **« rien n'a été mesuré » et « la mesure était nulle » sont deux
 *      phrases différentes**, et un lecteur de décembre doit pouvoir les
 *      distinguer sur la page : un vrai zéro voyage avec sa population ;
 *   3. **l'instantané ne bouge pas** quand le livre bouge, ne se réécrit
 *      pas, et ne s'écrit qu'à la date à laquelle il est vrai ;
 *   4. l'autorité est décidée dans shared/rbac.js, et la portée de
 *      lecture est celle du sérialiseur.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { query, many, one } from "../src/db.js";
import { can } from "../../shared/rbac.js";
import {
  valuePage, formatValue, formatPopulation, FIGURE_ORDER, VALUE_TEXT, MONEY_FIELDS,
} from "../../shared/valuepage.js";

const AS_AT = "2026-08-28";

/** Un livre nu : rien du tout, ce qui est le cas le plus révélateur. */
const bareBook = (over = {}) => ({
  statusDate: AS_AT, projects: [], programmes: [], benefits: [], businessCases: [],
  raid: [], milestones: [], ledger: [], exceptions: [], tolerances: [],
  docs: [], criteria: [], settings: { pmoExposure: 8, escalateExposure: 15 },
  ...over,
});

const project = (id, over = {}) => ({
  id, name: id + " — a project", programme: "PRG", site: "GRU", governanceLevel: "site",
  budget: 10, start: "2026-01-01", finish: "2026-12-31", closed: false, phase: "Execution",
  contingency: 0, contingencyUsed: 0, ...over,
});

/* ═══════════════════════════════════════════════════════════════════
   1 · UN LIVRE VIDE NE RAPPORTE PAS DES ZÉROS
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-30 · rien de mesuré ne se lit comme quelque chose de bon", () => {
  test("les six figures d'un livre vide sont N, avec une raison chacune", () => {
    const page = valuePage(bareBook());
    assert.deepEqual(page.order, FIGURE_ORDER);
    assert.equal(page.order.length, 6);
    for (const key of page.order) {
      const f = page.figures[key];
      assert.equal(f.state, "N", `${key} doit être « pas mesuré » sur un livre vide`);
      assert.equal(f.rag, "N", `${key} porte le quatrième état du moteur`);
      assert.equal(f.value, null, `${key} ne doit PAS rendre un nombre`);
      assert.ok(f.why && f.why.length > 20, `${key} doit dire POURQUOI`);
      assert.equal(formatValue(f), "—", `${key} s'affiche « — », jamais 0 ni 100 %`);
      assert.equal(formatPopulation(f), null, "pas de dénominateur sans nombre");
    }
    assert.equal(page.scope.measured, 0);
    assert.equal(page.scope.notMeasured, 6);
  });

  test("aucune figure ne fabrique un zéro, un pourcentage ou une couleur", () => {
    const page = valuePage(bareBook());
    const drawn = page.order.map((k) => formatValue(page.figures[k]));
    assert.deepEqual(drawn, ["—", "—", "—", "—", "—", "—"]);
    for (const k of page.order) {
      assert.notEqual(page.figures[k].rag, "G", `${k} n'invente pas un vert`);
      assert.equal(page.figures[k].note, null, "pas de note quand il n'y a pas de nombre");
    }
  });

  test("un projet sans cas d'affaire ne rend pas une dépense « contre le cas » de zéro", () => {
    const page = valuePage(bareBook({
      projects: [project("PRJ-1")],
      ledger: [{ project: "PRJ-1", amount: 4.2, period: "2026-07" }],
    }));
    const f = page.figures.spendAgainstCase;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noCase);
    assert.equal(f.value, null, "4,2 M dépensés hors de tout cas ne sont pas « 0 contre le cas »");
    assert.equal(f.extra.uncased, 1, "mais la dépense hors cas est COMPTÉE à part");
    assert.equal(f.extra.uncasedSpend, 4.2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2 · « RIEN MESURÉ » ET « MESURE NULLE » SONT DEUX PHRASES
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-30 · une absence et un zéro ne se lisent pas pareil", () => {
  const withBenefit = (over) => bareBook({
    projects: [project("PRJ-1")],
    benefits: [{ id: "BEN-1", project: "PRJ-1", title: "Coût du poste", kind: "Cost",
      unit: "$M", baseline: 10, target: 6, actual: null, status: "Forecast",
      realiseOn: null, measuredOn: null, ...over }],
  });

  test("aucun bénéfice daté : pas de revue en retard — et ce n'est pas zéro en retard", () => {
    const f = valuePage(withBenefit({})).figures.overdueReviews;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noRealiseDate);
    assert.equal(f.value, null);
    assert.equal(f.extra.undated, 1, "la promesse non datée est comptée, pas oubliée");
  });

  test("des bénéfices datés dont aucun n'est en retard : un VRAI zéro, avec sa population", () => {
    const f = valuePage(withBenefit({ realiseOn: "2026-12-31" })).figures.overdueReviews;
    assert.equal(f.state, "measured");
    assert.equal(f.value, 0, "zéro en retard sur une population qui existe est un vrai zéro");
    assert.equal(f.n, 1);
    assert.equal(f.note, VALUE_TEXT.noneOverdue, "et il DIT sur quoi il a été compté");
    assert.equal(formatValue(f), "0");
    assert.match(formatPopulation(f), /of 1 dated review/);
  });

  test("une revue échue et non mesurée est en retard, avec son ancienneté", () => {
    const f = valuePage(withBenefit({ realiseOn: "2026-06-30" })).figures.overdueReviews;
    assert.equal(f.state, "measured");
    assert.equal(f.value, 1);
    assert.equal(f.extra.worstDays, 59);
    assert.equal(f.extra.list[0].title, "Coût du poste");
  });

  test("un bénéfice MESURÉ après sa date n'est pas en retard", () => {
    const f = valuePage(withBenefit({ realiseOn: "2026-06-30", actual: 7 })).figures.overdueReviews;
    assert.equal(f.value, 0);
  });

  test("aucune tolérance : le registre des exceptions ne dit pas « 0 ouverte »", () => {
    const f = valuePage(bareBook({ projects: [project("PRJ-1")] })).figures.exceptionsOpen;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noTolerance);
    assert.equal(f.value, null, "un portefeuille sans limite n'est pas un portefeuille sans dépassement");
  });

  test("une tolérance posée et rien de dépassé : zéro ouverte, et il le dit", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      tolerances: [{ id: "TOL-1", project: "PRJ-1", scheduleDays: 10, costPct: 5 }],
    })).figures.exceptionsOpen;
    assert.equal(f.state, "measured");
    assert.equal(f.value, 0);
    assert.equal(f.note, VALUE_TEXT.noExceptionOpen);
    assert.equal(f.n, 1, "compté contre le nombre de projets réellement bornés");
  });

  test("les dimensions d'exception sont comptées SUR LES LIGNES, pas sur une liste écrite ici", () => {
    /* La 042 a ajouté une quatrième dimension, « benefit-review », et le
       balayage la lève réellement. Une liste figée dans le module aurait
       compté quatre exceptions comme trois — un chiffre faux, plus petit,
       de la même famille que le zéro fabriqué. */
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      tolerances: [{ id: "TOL-1", project: "PRJ-1", scheduleDays: 10 }],
      exceptions: [
        { id: "EXC-1", project: "PRJ-1", dimension: "schedule", status: "Open", raisedOn: "2026-08-01", measured: 30, allowed: 10 },
        { id: "EXC-2", project: "PRJ-1", dimension: "benefit-review", status: "Open", raisedOn: "2026-08-10", measured: 1, allowed: 0 },
      ],
    })).figures.exceptionsOpen;
    assert.equal(f.value, 2);
    assert.deepEqual(f.extra.byDimension, { schedule: 1, "benefit-review": 1 });
  });

  test("une exception ouverte porte son âge et sa dimension", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      tolerances: [{ id: "TOL-1", project: "PRJ-1", scheduleDays: 10 }],
      exceptions: [{ id: "EXC-1", project: "PRJ-1", dimension: "schedule", status: "Open",
        raisedOn: "2026-08-01", measured: 30, allowed: 10, detail: "" }],
    })).figures.exceptionsOpen;
    assert.equal(f.value, 1);
    assert.equal(f.extra.oldestDays, 27);
    assert.equal(f.extra.byDimension.schedule, 1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 · LES QUATRE AUTRES FIGURES, ET LEUR SILENCE
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-30 · chaque figure dit ce qu'elle ne sait pas", () => {
  test("un cas sans coût attendu ne se compare pas — et le dit autrement qu'un livre sans cas", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      businessCases: [{ id: "CAS-1", project: "PRJ-1", summary: "…", expectedCost: null,
        expectedBenefit: null, staleSinceReconfirm: false, reconfirmedGate: null }],
    })).figures.spendAgainstCase;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.caseWithoutCost);
    assert.notEqual(f.why, VALUE_TEXT.noCase, "deux silences différents, deux phrases différentes");
  });

  test("un cas chiffré sans écriture au grand livre : dépense NULLE, dite comme telle", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      businessCases: [{ id: "CAS-1", project: "PRJ-1", summary: "…", expectedCost: 12,
        expectedBenefit: 4, staleSinceReconfirm: false, reconfirmedGate: null }],
    })).figures.spendAgainstCase;
    assert.equal(f.state, "measured");
    assert.equal(f.value, 0);
    assert.equal(f.note, VALUE_TEXT.noCostLine, "un nul se dit, il ne se déduit pas d'un tiret");
    assert.equal(f.extra.expectedCost, 12);
    assert.equal(f.extra.variance, 12);
    assert.equal(f.extra.share, 0);
  });

  test("la dépense hors cas ne rentre jamais dans le total du cas", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1"), project("PRJ-2")],
      businessCases: [{ id: "CAS-1", project: "PRJ-1", summary: "…", expectedCost: 12,
        expectedBenefit: 4, staleSinceReconfirm: false, reconfirmedGate: null }],
      ledger: [{ project: "PRJ-1", amount: 5 }, { project: "PRJ-2", amount: 9 }],
    })).figures.spendAgainstCase;
    assert.equal(f.value, 5, "seule la dépense des projets qui ont un cas est comparée");
    assert.equal(f.extra.uncasedSpend, 9, "et l'autre est dite à voix haute");
    assert.equal(f.note, VALUE_TEXT.someUncased);
  });

  test("un cas sans coût attendu n'entre dans AUCUN des deux totaux, et le dit", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1"), project("PRJ-2")],
      businessCases: [
        { id: "CAS-1", project: "PRJ-1", summary: "…", expectedCost: 12, expectedBenefit: 4,
          staleSinceReconfirm: false, reconfirmedGate: null },
        { id: "CAS-2", project: "PRJ-2", summary: "…", expectedCost: null, expectedBenefit: null,
          staleSinceReconfirm: false, reconfirmedGate: null },
      ],
      ledger: [{ project: "PRJ-1", amount: 5 }, { project: "PRJ-2", amount: 3 }],
    })).figures.spendAgainstCase;
    assert.equal(f.value, 5, "seule la dépense comparable est totalisée");
    assert.equal(f.extra.uncasedSpend, 0, "PRJ-2 a un cas : sa dépense n'est pas « hors cas »");
    assert.equal(f.extra.cased, 2);
    assert.equal(f.extra.casedWithCost, 1);
    assert.match(f.note, /no expected cost/, "le troisième silence est dit, pas déduit");
  });

  test("aucun bénéfice : pas de profil par statut", () => {
    const f = valuePage(bareBook({ projects: [project("PRJ-1")] })).figures.benefitsByStatus;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noBenefit);
    assert.equal(f.extra.uncased, 1);
  });

  test("des bénéfices : le compte vivant, les statuts, et ce qui n'est pas mesuré", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      benefits: [
        { id: "B1", project: "PRJ-1", title: "a", unit: "$M", status: "Realised", actual: 3, baseline: 0, target: 3 },
        { id: "B2", project: "PRJ-1", title: "b", unit: "h", status: "Forecast", actual: null },
        { id: "B3", project: "PRJ-1", title: "c", unit: "h", status: "Withdrawn", actual: null },
      ],
    })).figures.benefitsByStatus;
    assert.equal(f.value, 2, "le retiré ne compte pas dans le vivant");
    assert.equal(f.n, 3);
    assert.equal(f.extra.states.Realised, 1);
    assert.equal(f.note, VALUE_TEXT.benefitsUnmeasured);
  });

  test("aucun risque ouvert : pas d'exposition — pas une exposition de zéro", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      raid: [{ id: "R1", project: "PRJ-1", type: "Risk", title: "x", p: 4, i: 4,
        status: "Closed", opened: "2026-01-01" }],
    })).figures.topRisks;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noOpenRisk);
  });

  test("l'exposition la plus haute mène, les bandes et les problèmes voyagent avec", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      raid: [
        { id: "R1", project: "PRJ-1", type: "Risk", title: "x", p: 5, i: 4, status: "Open", opened: "2026-01-01" },
        { id: "R2", project: "PRJ-1", type: "Risk", title: "y", p: 2, i: 2, status: "Open", opened: "2026-01-01" },
        { id: "I1", project: "PRJ-1", type: "Issue", title: "z", p: 5, i: 5, status: "Open", opened: "2026-01-01" },
      ],
    })).figures.topRisks;
    assert.equal(f.value, 20, "la plus haute exposition des RISQUES");
    assert.equal(f.n, 2);
    assert.equal(f.extra.issues, 1, "les problèmes sont comptés à part, jamais tus");
    assert.equal(f.note, VALUE_TEXT.issuesOpen);
    assert.equal(f.extra.top[0].id, "R1");
    assert.equal(f.extra.top[0].band, "Critical");
  });

  test("un jalon de porte daté en PLACEHOLDER ne fait pas une porte due", () => {
    const book = bareBook({
      projects: [project("PRJ-1")],
      milestones: [{ id: "M1", project: "PRJ-1", name: "Gate 1", gate: 1, kind: "gate",
        done: false, date: "2026-09-15", dateBasis: "placeholder" }],
    });
    const f = valuePage(book).figures.gatesDue;
    assert.equal(f.state, "N");
    assert.equal(f.why, VALUE_TEXT.noGateDated);
    assert.equal(f.extra.placeholders, 1);
  });

  test("des portes engagées, aucune dans l'horizon : un vrai zéro qui dit son horizon", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      milestones: [{ id: "M1", project: "PRJ-1", name: "Gate 1", gate: 1, kind: "gate",
        done: false, date: "2027-06-01", dateBasis: "committed" }],
    })).figures.gatesDue;
    assert.equal(f.state, "measured");
    assert.equal(f.value, 0);
    assert.match(f.note, /horizon/);
    assert.match(formatPopulation(f), /within 90 days, of 1 committed gate/);
  });

  test("une porte dans l'horizon porte son état en MOTS et ce qui lui manque", () => {
    const f = valuePage(bareBook({
      projects: [project("PRJ-1")],
      milestones: [{ id: "M1", project: "PRJ-1", name: "Gate 1", gate: 1, kind: "gate",
        done: false, date: "2026-09-15", dateBasis: "committed" }],
      docs: [{ id: "D1", project: "PRJ-1", gate: 1, name: "Charter", status: "Draft", type: "Charter" }],
    })).figures.gatesDue;
    assert.equal(f.value, 1);
    assert.equal(typeof f.extra.list[0].state, "string", "un mot, pas une couleur — il doit survivre au gris");
    assert.equal(f.extra.list[0].outstanding, 1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   4 · LA PAGE SUR LE LIVRE RÉEL, PAR L'API
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-30 · la page servie, et l'instantané écrit", () => {
  before(async () => { await boot({ today: AS_AT }); });
  after(shutdown);

  let periodId = null;
  let storedExposure = null;

  test("le livre de démonstration répond honnêtement : deux mesurées, quatre absences motivées", async () => {
    const admin = await as("admin");
    const r = await admin.get("/api/valuepage");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = r.body;
    assert.equal(page.asAt, AS_AT);
    assert.equal(page.order.length, 6);
    /* Le livre semé ne porte NI cas d'affaire, NI bénéfice, NI tolérance
       (REQ-48). Quatre figures sur six doivent donc dire pourquoi elles
       se taisent — et aucune ne doit rendre un zéro à la place. */
    assert.equal(page.figures.spendAgainstCase.state, "N");
    assert.equal(page.figures.benefitsByStatus.state, "N");
    assert.equal(page.figures.overdueReviews.state, "N");
    assert.equal(page.figures.exceptionsOpen.state, "N");
    assert.equal(page.figures.topRisks.state, "measured");
    assert.equal(page.figures.gatesDue.state, "measured");
    assert.equal(page.scope.notMeasured, 4);
    for (const k of page.order) {
      const f = page.figures[k];
      if (f.state === "N") assert.ok(f.why, `${k} se tait sans raison`);
    }
    storedExposure = page.figures.topRisks.value;
    assert.ok(storedExposure > 0);
  });

  test("la portée du lecteur est celle du sérialiseur : un site voit son site", async () => {
    const admin = await as("admin");
    const site = await as("siteGRU");
    const wide = (await admin.get("/api/valuepage")).body;
    const narrow = (await site.get("/api/valuepage")).body;
    assert.equal(narrow.status, undefined);
    assert.ok(narrow.scope.projects < wide.scope.projects,
      "le chef de site ne compte pas les projets qu'il ne voit pas");
    assert.equal(narrow.mayStore, false, "et il ne peut pas déposer de page");
    assert.deepEqual(narrow.stored, [], "ni lire la liste de celles qui existent");
  });

  test("écrire un cas et un bénéfice fait passer la page du silence au chiffre", async () => {
    const admin = await as("admin");
    const wrote = await admin.put("/api/projects/" + GROUP_PROJECT + "/case", {
      summary: "Retire the mainframe payments stack before the vendor's support ends.",
      expectedCost: 12.5, expectedBenefit: 4, basis: "Vendor quote plus internal effort at day rate",
    });
    assert.equal(wrote.status, 201, JSON.stringify(wrote.body));
    const ben = await admin.post("/api/benefits", {
      project: GROUP_PROJECT, kind: "Cost", title: "Mainframe licence retired",
      measure: "Annual licence", unit: "$M", baseline: 4, target: 0,
      realiseOn: "2026-06-30",
    });
    assert.equal(ben.status, 201, JSON.stringify(ben.body));

    const page = (await admin.get("/api/valuepage")).body;
    assert.equal(page.figures.spendAgainstCase.state, "measured");
    assert.equal(page.figures.spendAgainstCase.extra.expectedCost, 12.5,
      "l'argent revient en millions, exact");
    assert.equal(page.figures.benefitsByStatus.state, "measured");
    assert.equal(page.figures.overdueReviews.state, "measured");
    assert.equal(page.figures.overdueReviews.value, 1, "une revue promise pour juin, non mesurée");
    assert.equal(page.scope.notMeasured, 1, "seules les exceptions restent muettes");
  });

  test("déposer une page est un acte de groupe, refusé au site et au lecteur", async () => {
    const site = { role: "site", active: true, grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
    const group = { role: "group", active: true, grants: { programmes: new Set(["DCH"]), sites: new Set() } };
    assert.equal(can(site, "period.close").ok, false);
    assert.equal(can(group, "period.close").ok, true);

    const admin = await as("admin");
    const closed = await admin.post("/api/periods", { label: "August 2026" });
    assert.equal(closed.status, 201, JSON.stringify(closed.body));
    periodId = closed.body.id;

    const siteClient = await as("siteGRU");
    const refused = await siteClient.post("/api/valuepage/" + periodId, {});
    assert.equal(refused.status, 403);
    const viewer = await as("viewerGRU");
    assert.equal((await viewer.post("/api/valuepage/" + periodId, {})).status, 403);
    assert.equal((await viewer.get("/api/valuepage/" + periodId)).status, 403,
      "une page déposée est un agrégat de groupe : elle ne se lit pas d'en dessous");
  });

  test("la page se dépose une fois, avec le nom de qui l'a déposée", async () => {
    const admin = await as("admin");
    const stored = await admin.post("/api/valuepage/" + periodId, {
      note: "Board pack of 3 September — first value page on the record",
    });
    assert.equal(stored.status, 201, JSON.stringify(stored.body));
    assert.equal(stored.body.figures, 6);
    assert.equal(stored.body.measured, 5);
    assert.equal(stored.body.notMeasured, 1);

    const again = await admin.post("/api/valuepage/" + periodId, {});
    assert.equal(again.status, 409, "une histoire ne se réécrit pas");
    assert.match(again.body.error, /restates/);
  });

  test("l'ABSENCE est stockée comme une absence, pas comme un zéro", async () => {
    const admin = await as("admin");
    const read = await admin.get("/api/valuepage/" + periodId);
    assert.equal(read.status, 200);
    const f = read.body.figures.exceptionsOpen;
    assert.equal(f.state, "N");
    assert.equal(f.value, null, "le zéro fabriqué est exactement la faute de 5.12");
    assert.equal(f.why, VALUE_TEXT.noTolerance);
    assert.equal(formatValue(f), "—");

    /* Et la base elle-même refuse l'inverse : une figure « pas mesurée »
       qui porterait un nombre ne peut pas être insérée. */
    await assert.rejects(
      query(`INSERT INTO report_value_figure (period_id, figure, state, unit, value, why)
             VALUES ($1,'invented','N','count',0,'')`, [periodId]),
      /value_figure_absence_is_stated|violates check|check constraint/i);
  });

  test("l'argent fait l'aller-retour exact : millions à l'écran, unités entières en base", async () => {
    const admin = await as("admin");
    const read = (await admin.get("/api/valuepage/" + periodId)).body;
    assert.equal(read.figures.spendAgainstCase.extra.expectedCost, 12.5);
    const row = await one(
      `SELECT value, detail FROM report_value_figure
        WHERE period_id = $1 AND figure = 'spendAgainstCase'`, [periodId]);
    const detail = typeof row.detail === "string" ? JSON.parse(row.detail) : row.detail;
    assert.equal(Number(detail.expectedCost), 12_500_000, "la base garde l'argent exact et entier");
    assert.ok(MONEY_FIELDS.has("expectedCost"));
  });

  test("la page déposée ne bouge pas quand le livre bouge", async () => {
    const admin = await as("admin");
    const before = (await admin.get("/api/valuepage/" + periodId)).body;
    assert.equal(before.figures.topRisks.value, storedExposure);

    /* On bouge le livre pour de bon : une tolérance posée fait passer la
       figure des exceptions de « pas mesurée » à mesurée — sur la page
       VIVANTE seulement. */
    const tol = await admin.put("/api/projects/" + GROUP_PROJECT + "/tolerance", {
      scheduleDays: 10, costPct: 5, note: "Set to exercise the exception sweep",
    });
    assert.equal(tol.status, 201, JSON.stringify(tol.body));

    const live = (await admin.get("/api/valuepage")).body;
    assert.equal(live.figures.exceptionsOpen.state, "measured", "le livre a réellement bougé");
    const after = (await admin.get("/api/valuepage/" + periodId)).body;
    assert.equal(after.figures.exceptionsOpen.state, "N",
      "août dit toujours ce qu'août disait");
    assert.equal(after.figures.exceptionsOpen.why, VALUE_TEXT.noTolerance);
  });

  test("une période close à une AUTRE date ne reçoit pas les chiffres d'aujourd'hui", async () => {
    const admin = await as("admin");
    /* Une période fraîche, close à la date du livre, et qui ne porte donc
       pas encore de page : c'est bien la DATE qui doit la refuser. */
    const fresh = await admin.post("/api/periods", { label: "August 2026 (as-at guard)" });
    assert.equal(fresh.status, 201, JSON.stringify(fresh.body));

    const moved = await admin.patch("/api/admin/settings", { statusDate: "2026-09-30" });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));

    const refused = await admin.post("/api/valuepage/" + fresh.body.id, {});
    assert.equal(refused.status, 409);
    assert.match(refused.body.error, /2026-08-28/);
    assert.match(refused.body.error, /2026-09-30/);

    await admin.patch("/api/admin/settings", { statusDate: AS_AT });
  });

  test("une page déposée ne se réécrit pas : la base refuse", async () => {
    await query(`UPDATE report_value SET projects = 999 WHERE period_id = $1`, [periodId]);
    await query(`UPDATE report_value_figure SET value = 0, state = 'measured'
                  WHERE period_id = $1 AND figure = 'exceptionsOpen'`, [periodId]);
    await query(`DELETE FROM report_value_figure WHERE period_id = $1`, [periodId]);
    await query(`DELETE FROM report_value WHERE period_id = $1`, [periodId]);

    const head = await one(`SELECT projects FROM report_value WHERE period_id = $1`, [periodId]);
    assert.ok(head, "la page est toujours là");
    assert.notEqual(Number(head.projects), 999);
    const rows = await many(
      `SELECT figure, state, value FROM report_value_figure WHERE period_id = $1`, [periodId]);
    assert.equal(rows.length, 6);
    const exc = rows.find((x) => x.figure === "exceptionsOpen");
    assert.equal(exc.state, "N");
    assert.equal(exc.value, null);
  });

  test("le dépôt laisse une trace qui dit ce qui était mesuré et ce qui ne l'était pas", async () => {
    const rows = await many(
      `SELECT action, entity, entity_id, after_json FROM audit_event
        WHERE entity = 'report_value' ORDER BY id DESC LIMIT 1`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entity_id, periodId);
    const after = typeof rows[0].after_json === "string"
      ? JSON.parse(rows[0].after_json) : rows[0].after_json;
    assert.equal(after.figures.exceptionsOpen, "N",
      "la piste dit qu'une figure était une absence, sans quoi une page de tirets " +
      "et une page de chiffres laissent la même trace");
    assert.equal(after.figures.topRisks, "measured");
  });

  test("une période sans page déposée répond 404, jamais une page vide", async () => {
    const admin = await as("admin");
    const second = await admin.post("/api/periods", { label: "August 2026 (second close)" });
    assert.equal(second.status, 201);
    const read = await admin.get("/api/valuepage/" + second.body.id);
    assert.equal(read.status, 404);
    assert.equal((await admin.get("/api/valuepage/RP-999")).status, 404);
    assert.equal((await admin.post("/api/valuepage/RP-999", {})).status, 404);
  });

  test("la liste des pages déposées nomme la période, la portée et le déposant", async () => {
    const admin = await as("admin");
    const page = (await admin.get("/api/valuepage")).body;
    const mine = page.stored.find((s) => s.period === periodId);
    assert.ok(mine, "la page déposée est listée");
    assert.equal(mine.label, "August 2026");
    assert.match(mine.storedBy, /admin/);
    assert.match(mine.scope, /administrator/);
    assert.equal(mine.notMeasured, 1);
  });

  test("le serveur et le module pur disent le même chiffre sur le même livre", async () => {
    const admin = await as("admin");
    const boot = (await admin.get("/api/bootstrap")).body.db;
    const served = (await admin.get("/api/valuepage")).body;
    const local = valuePage(boot, boot.projects, boot.statusDate);
    for (const k of FIGURE_ORDER) {
      assert.equal(local.figures[k].state, served.figures[k].state, k);
      assert.equal(local.figures[k].value, served.figures[k].value, k);
      assert.equal(local.figures[k].why, served.figures[k].why, k);
    }
    assert.equal(local.scope.projects, served.scope.projects);
  });

  test("la page porte une ligne par projet, et un tiret là où rien n'est su", async () => {
    const admin = await as("admin");
    const page = (await admin.get("/api/valuepage")).body;
    const row = page.rows.find((r) => r.project === SITE_PROJECT_GRU);
    assert.ok(row, "chaque projet visible a sa ligne");
    assert.equal(row.case, null, "ce projet n'a pas de cas");
    assert.equal(row.benefits.length, 0);
    const cased = page.rows.find((r) => r.project === GROUP_PROJECT);
    assert.equal(cased.case.expectedCost, 12.5);
    assert.ok(cased.spend === null || typeof cased.spend === "number");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   5 · LA LANGUE — le piège que la porte F5 NE PEUT PAS voir
   ───────────────────────────────────────────────────────────────────
   Les phrases de VALUE_TEXT arrivent à l'écran par une VARIABLE —
   `t(f.why)`, `t(f.label)` — et la porte F5 ne lit que les littéraux.
   Une entrée manquante ne casse donc rien : elle produit un écran à
   moitié français, et rien n'échoue. C'est exactement ce que 5.14.0 a
   vécu. Ce test-ci est la porte qui manquait.
   ═══════════════════════════════════════════════════════════════════ */

describe("REQ-30 · aucune phrase de la page ne reste en anglais", () => {
  test("chaque phrase de VALUE_TEXT a son entrée FR et ES", async () => {
    const { FR } = await import("../../web/src/lib/i18n.js");
    const { ES } = await import("../../web/src/lib/es.js");
    const missing = [];
    for (const [key, sentence] of Object.entries(VALUE_TEXT)) {
      if (!(sentence in FR)) missing.push(`FR ${key}`);
      if (!(sentence in ES)) missing.push(`ES ${key}`);
    }
    assert.deepEqual(missing, [],
      "une phrase passée par une variable est invisible à la porte F5 : elle s'ajoute à la main");
  });

  test("la population d'une figure se traduit, nombres compris", async () => {
    const { tData, setLang } = await import("../../web/src/lib/i18n.js");
    const page = valuePage(bareBook({
      projects: [project("PRJ-1")],
      benefits: [{ id: "B1", project: "PRJ-1", title: "a", unit: "h", status: "Forecast",
        actual: null, realiseOn: "2026-12-31" }],
    }));
    const sentence = formatPopulation(page.figures.overdueReviews);
    for (const lang of ["fr", "es"]) {
      setLang(lang);
      const out = tData(sentence);
      assert.notEqual(out, sentence, `« ${sentence} » n'est pas traduite en ${lang}`);
      assert.match(out, /1/, "le nombre traverse la traduction intact");
    }
    setLang("en");
  });

  test("les deux refus du dépôt sont traduits, données laissées telles quelles", async () => {
    const { say } = await import("../src/i18n.js");
    const already =
      "A value page is already stored for this reporting period, and what was reported is a record " +
      "rather than a working copy. To correct it, close a new period that restates this one and " +
      "store the value page against that, so the restatement is itself on the record: " +
      "RP-001 · August 2026 · admin";
    const asAt =
      "These figures are read from the book as it stands today, so they can only be stored against " +
      "a period closed at the book's own status date. Storing them against a period closed on " +
      "another day would file today's numbers under a date on which they were not true, and nobody " +
      "reading them later could tell. Close a period at today's status date instead: " +
      "RP-001 · August 2026 · 2026-06-30 → 2026-08-28";
    for (const lang of ["fr", "es"]) {
      for (const msg of [already, asAt]) {
        const out = say(msg, lang);
        assert.notEqual(out, msg, `refus non traduit en ${lang}`);
        assert.match(out, /RP-001 · August 2026/, "la donnée traverse la traduction intacte");
      }
    }
  });
});

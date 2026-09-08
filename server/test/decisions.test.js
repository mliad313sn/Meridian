/**
 * I-7 · LA DÉCISION COMME ENREGISTREMENT — I-8 · LE RAID RELIÉ
 * (retour de terrain RT365, docs/33)
 *
 * Le terrain a dû consigner ses décisions prises entre deux comités dans
 * une occurrence de réunion artificielle : le modèle ne connaissait que
 * la décision d'une salle. Et un risque ne savait pas dire contre quel
 * jalon il se levait ni quelle modification le portait ; sa date de
 * revue, stockée depuis la première migration, n'était lue nulle part.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";

before(async () => { await boot(); });
after(shutdown);

let DEC1 = null;

describe("I-7 · une décision hors réunion", () => {
  test("le groupe la consigne sur son projet, avec alternatives et dissension", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const risk = db.raid.find((r) => r.project === p.id && r.status === "Open");
    const ms = db.milestones.find((m) => m.project === p.id && m.gate === 2);
    const r = await pmo.post("/api/decisions", {
      headline: "Gate 2 is heard on 15 October regardless of the DPIA status",
      projectId: p.id, decidedBy: p.pm, decidedOn: "2026-08-27",
      rationale: "The architecture board cannot wait; the DPIA is a condition, not a prerequisite",
      alternatives: "Slip the gate to November (refused: three dependent projects slip with it)",
      dissent: "The site lead asked for the slip",
      raidId: risk?.id ?? null, milestoneId: ms?.id ?? null,
    });
    assert.equal(r.status, 201, r.text);
    DEC1 = r.body.id;
    assert.match(DEC1, /^DEC-\d{3}$/);

    const log = await pmo.get("/api/decisions/log");
    assert.equal(log.status, 200);
    const mine = log.body.minuted.find((d) => d.id === DEC1);
    assert.ok(mine, "elle est au registre, avec celles des salles");
    assert.equal(mine.kind, "standalone");
    assert.equal(mine.on, "2026-08-27");
    assert.match(mine.alternatives, /November/);
    assert.match(mine.dissent, /site lead/);
    assert.equal(mine.project, p.id);
    assert.equal(mine.raid, risk?.id ?? null);
    assert.equal(mine.milestone, ms?.id ?? null);
    assert.ok(mine.byName, "le décideur est nommé, pas seulement identifié");
  });

  test("elle ne se modifie ni ne s'efface — elle se remplace, en nommant l'ancienne", async () => {
    const pmo = await as("pmo");
    assert.equal((await pmo.patch("/api/decisions/" + DEC1, { headline: "x", version: 1 })).status, 404);
    assert.equal((await pmo.del("/api/decisions/" + DEC1)).status, 404);
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const r = await pmo.post("/api/decisions", {
      headline: "Gate 2 moves to 29 October after all", projectId: p.id, decidedBy: p.pm,
      supersedes: DEC1, rationale: "the board itself moved",
    });
    assert.equal(r.status, 201, r.text);
    const log = await pmo.get("/api/decisions/log");
    const next = log.body.minuted.find((d) => d.id === r.body.id);
    assert.equal(next.supersedes, DEC1);
    assert.ok(log.body.minuted.find((d) => d.id === DEC1), "l'ancienne reste au registre");
    const bad = await pmo.post("/api/decisions", {
      headline: "ghost", projectId: p.id, decidedBy: p.pm, supersedes: "DEC-999",
    });
    assert.equal(bad.status, 400);
  });

  test("un organe peut décider à la place d'une personne, avec sa preuve et sa provenance", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const r = await pmo.post("/api/decisions", {
      headline: "The architecture board keeps the current identity provider", projectId: p.id,
      council: "Architecture board", evidenceUri: "https://minutes.example/arb-2026-09-08", provenance: "[Committee]", status: "Proposed",
    });
    assert.equal(r.status, 201, r.text);
    const log = await pmo.get("/api/decisions/log");
    const mine = log.body.minuted.find((d) => d.id === r.body.id);
    assert.equal(mine.council, "Architecture board");
    assert.equal(mine.status, "Proposed");
    assert.match(mine.evidenceUri, /^https:/);
    assert.equal((await pmo.post("/api/decisions", { headline: "x", projectId: p.id, council: "ARB", evidenceUri: "ftp://x" })).status, 400);
  });

  test("les refus : sans décideur, décideur inconnu, lien vers un autre projet", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const other = db.crs.find((c) => c.project !== p.id);
    assert.equal((await pmo.post("/api/decisions", { headline: "x", projectId: p.id })).status, 400);
    assert.equal((await pmo.post("/api/decisions", { headline: "x", projectId: p.id, decidedBy: "PE-NOPE" })).status, 400);
    if (other) {
      const r = await pmo.post("/api/decisions", { headline: "x", projectId: p.id, decidedBy: p.pm, crId: other.id });
      assert.equal(r.status, 400, "une modification d'un autre projet ne se relie pas");
      assert.match(r.body.error, /this project/);
    }
  });

  test("l'autorité : le site sur un projet groupe → 403 ; la lectrice → 403 ; le site sur SON projet → 201 ; portefeuille = groupe", async () => {
    const silva = await as("siteGRU");
    const db = (await silva.get("/api/bootstrap")).body.db;
    const g = db.projects.find((x) => x.id === GROUP_PROJECT);
    const mine = db.projects.find((x) => x.id === SITE_PROJECT_GRU);
    assert.equal((await silva.post("/api/decisions", { headline: "x", projectId: g.id, decidedBy: mine.pm })).status, 403);
    assert.equal((await silva.post("/api/decisions", { headline: "x", decidedBy: mine.pm })).status, 403,
      "sans projet, c'est une décision de portefeuille — niveau groupe");
    const ok = await silva.post("/api/decisions", { headline: "Cutover on a Sunday", projectId: mine.id, decidedBy: mine.pm });
    assert.equal(ok.status, 201, ok.text);
    const viewer = await as("viewerGRU");
    assert.equal((await viewer.post("/api/decisions", { headline: "x", projectId: mine.id, decidedBy: mine.pm })).status, 403);
  });

  test("en salle aussi, alternatives et dissension sont acceptées et relues", async () => {
    const pmo = await as("pmo");
    const occs = (await pmo.get("/api/meetings/series/MS-GRP-W/occurrences")).body.occurrences;
    let occ = occs.find((o) => o.status === "open") ?? occs.find((o) => o.status === "scheduled");
    assert.ok(occ, "une occurrence à ouvrir");
    if (occ.status !== "open") {
      const o = await pmo.post(`/api/meetings/occurrences/${occ.id}/open`, {});
      assert.equal(o.status, 200, o.text);
    }
    const r = await pmo.post(`/api/meetings/occurrences/${occ.id}/decisions`, {
      headline: "Hold the envelope", rationale: "no new capex until Q4",
      alternatives: "Release 0.5M now (refused)", dissent: "DAI asked for the release",
    });
    assert.equal(r.status, 201, r.text);
    const read = await pmo.get(`/api/meetings/occurrences/${occ.id}`);
    const d = read.body.decisions.find((x) => x.id === r.body.id);
    assert.match(d.alternatives, /refused/);
    assert.match(d.dissent, /DAI/);
  });
});

describe("I-8 · le RAID relié, et sa revue à l'ordre du jour", () => {
  let RISK = null;
  test("un risque se lève contre un jalon et une modification du même projet", async () => {
    const pmo = await as("pmo");
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === GROUP_PROJECT);
    const cr = db.crs.find((c) => c.project === p.id);
    const other = db.crs.find((c) => c.project !== p.id);
    /* p2×i2 = 4 : sous les seuils d'escalade, donc l'élément n'est PAS
       déjà dessiné par la section des escalades — c'est la section des
       revues qui doit le ramener (le conseiller code a vu le test passer
       pour la mauvaise raison avec 4×4). */
    const r = await pmo.post("/api/raid", {
      type: "Risk", project: p.id, title: "DPIA not ready for gate 2", p: 2, i: 2,
      gate: 2, cr: cr?.id ?? null, review: "2026-01-05",
    });
    assert.equal(r.status, 201, r.text);
    RISK = r.body.id;
    const db2 = (await pmo.get("/api/bootstrap")).body.db;
    const item = db2.raid.find((x) => x.id === RISK);
    assert.equal(item.gate, 2);
    assert.equal(item.cr, cr?.id ?? null);
    if (other) {
      const wrong = await pmo.patch("/api/raid/" + RISK, { cr: other.id, version: item.version });
      assert.equal(wrong.status, 400, "une modification d'un autre projet ne se relie pas");
    }
    /* Le moteur compte les éléments ouverts contre le jalon. */
    const { Engine } = await import("../../shared/engine.js");
    const st = Engine.gateStatus(db2, p.id, 2);
    assert.ok(st.risks.some((x) => x.id === RISK), "gateStatus nomme les risques contre le jalon");
    assert.equal(typeof st.ready, "boolean", "l'arithmétique gelée est intacte");
  });

  test("sa date de revue passée le met à l'ordre du jour de la salle concernée", async () => {
    const pmo = await as("pmo");
    const occs = (await pmo.get("/api/meetings/series/MS-GRP-W/occurrences")).body.occurrences;
    const occ = occs.find((o) => o.status === "open") ?? occs.find((o) => o.status === "scheduled");
    if (occ.status !== "open") await pmo.post(`/api/meetings/occurrences/${occ.id}/open`, {});
    const read = await pmo.get(`/api/meetings/occurrences/${occ.id}`);
    assert.equal(read.status, 200);
    const sections = read.body.agenda.sections ?? read.body.agenda;
    const flat = JSON.stringify(sections);
    assert.ok(flat.includes(RISK), "l'élément dont la revue est due apparaît à l'ordre du jour");
    const reviews = (Array.isArray(sections) ? sections : []).find((s) => s.key === "reviews");
    assert.ok(reviews, "la section des revues existe");
    const mine = reviews.items.find((i) => i.entityId === RISK);
    assert.ok(mine, "c'est bien la section des revues qui le ramène");
    assert.match(mine.headline, /OVERDUE/);
    assert.match(mine.detail, /against gate 2/);
    const badGate = await pmo.post("/api/raid", { type: "Risk", project: GROUP_PROJECT, title: "x", gate: 9 });
    assert.equal(badGate.status, 400, "le jalon 9 n'existe pas sur une échelle à quatre");
  });
});

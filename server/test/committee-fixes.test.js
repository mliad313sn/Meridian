/**
 * docs/36 C-04 (produit) — les correctifs du comité de revue
 * documentaire (docs/32) que la branche jamais fusionnée portait, et que
 * main n'avait pas. Chacun est tenu ici par ce qu'il change réellement :
 * le client est chargé dans un DOM réel (jsdom, comme la porte F8) et
 * interrogé, pas relu à l'œil.
 *
 *   O-3  les enseignements adoptés, proposés à la création
 *   O-4  la fiche personne porte statut, fournisseur, rotation, disponibilité
 *   O-5  « Nouveau projet » sonde toutes les combinaisons
 *   O-6  natures RAID et libellés de niveau traduits (FR, ES)
 *   O-7  Engine.crossDepBreaches — additif
 *   ·    le forçage de statut (why/mode) qui répondait toujours 400
 *   ·    documentHosts enfin posé dans Administration
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { Engine, RAID_TYPES } from "../../shared/engine.js";

/* ── un DOM, posé AVANT le moindre import du client ─────────────────── */
const dom = new JSDOM(
  "<!doctype html><html><body><div id=root></div><div id=overlay></div></body></html>",
  { url: "http://localhost:4173/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "location", "history",
                 "HTMLElement", "SVGElement", "Node", "Element", "Event",
                 "CustomEvent", "getComputedStyle", "requestAnimationFrame",
                 "cancelAnimationFrame", "localStorage", "sessionStorage"]) {
  if (globalThis[k] === undefined && dom.window[k] !== undefined) globalThis[k] = dom.window[k];
}
globalThis.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { App } = await import("../../web/src/lib/state.js");
const { api } = await import("../../web/src/lib/api.js");
const { FR } = await import("../../web/src/lib/i18n.js");
const { ES } = await import("../../web/src/lib/es.js");
const { VIEWS, HEADER_ACTIONS, healthPayload, showRelevantLessons } =
  await import("../../web/src/views/index.js");
const { personPayload } = await import("../../web/src/views/administration.js");

before(async () => { await boot(); });
after(async () => { await shutdown(); });

/* ── O-5 ─────────────────────────────────────────────────────────── */

test("O-5 — un chef de site dont le site n'est pas le premier voit « Nouveau projet »", () => {
  const db = {
    programmes: [{ id: "CBP" }, { id: "DCH" }],
    sites: [{ id: "GRU" }, { id: "YYZ" }, { id: "SIN" }],
    projects: [],
  };
  App.me = { id: "U-SIN", role: "site", grants: { programmes: [], sites: ["SIN"] } };
  assert.ok(HEADER_ACTIONS.portfolio(db),
    "l'ancienne sonde ne demandait que programmes[0]/sites[0] — GRU — et cachait le bouton");
  App.me = { id: "U-NONE", role: "site", grants: { programmes: [], sites: [] } };
  assert.equal(HEADER_ACTIONS.portfolio(db), null, "sans aucun site accordé, toujours pas de bouton");
  App.me = { id: "U-DCH", role: "group", grants: { programmes: ["DCH"], sites: [] } };
  assert.ok(HEADER_ACTIONS.portfolio(db), "idem pour un programme accordé qui n'est pas le premier");
});

/* ── forçage de statut ───────────────────────────────────────────── */

test("le forçage de statut envoie la raison et sait revenir à l'automatique", async () => {
  const manual = healthPayload({ mode: "manual", rag: "R", note: "Supplier slipped twice" });
  assert.deepEqual(manual, { rag: "R", why: "Supplier slipped twice" });
  const auto = healthPayload({ mode: "auto", rag: "G", note: "" });
  assert.equal(auto.rag, null, "« automatique » se lit sur mode, pas sur rag");

  /* Et le serveur les accepte — avant, chaque forçage répondait 400. */
  const admin = await as("admin");
  const p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === GROUP_PROJECT);
  const r1 = await admin.patch(`/api/projects/${GROUP_PROJECT}/health`,
    { ...healthPayload({ mode: "manual", rag: "A", note: "Steering asked for amber" }), version: p.version });
  assert.equal(r1.status, 200, r1.text);
  const r2 = await admin.patch(`/api/projects/${GROUP_PROJECT}/health`,
    { ...healthPayload({ mode: "auto", rag: "A", note: "" }), version: r1.body.version });
  assert.equal(r2.status, 200, r2.text);
  const back = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === GROUP_PROJECT);
  assert.ok(!back.healthOverride, "le retour à l'automatique est enfin possible");
});

/* ── O-4 ─────────────────────────────────────────────────────────── */

test("O-4 — la fiche personne porte statut, fournisseur, rotation et disponibilité", async () => {
  const v = { name: "R. Okafor", role: "Field engineer", site: "GRU", rate: "650",
    employment: "contractor", supplier: "Andes Field Services", rotation: "14/14", availability: "45" };
  const body = personPayload(v);
  assert.deepEqual(
    { employment: body.employment, supplier: body.supplier, rotation: body.rotation, availability: body.availability },
    { employment: "contractor", supplier: "Andes Field Services", rotation: "14/14", availability: 45 });

  const admin = await as("admin");
  const made = await admin.post("/api/admin/people", body);
  assert.equal(made.status, 201, made.text);
  const person = (await admin.get("/api/bootstrap")).body.db.people.find((x) => x.id === made.body.id);
  assert.equal(person.rotation, "14/14");
  assert.equal(person.availability, 45);
  assert.equal(person.employment, "contractor");
  assert.equal(person.supplier, "Andes Field Services");

  /* L'arithmétique ne bouge pas : la disponibilité est déjà nette de
     rotation (012), la rotation n'est pas comptée une seconde fois. */
  assert.equal(Engine.effectiveFte(person), 0.45);
});

/* ── O-6 ─────────────────────────────────────────────────────────── */

test("O-6 — natures RAID et libellés de niveau ont leur français et leur espagnol", () => {
  const labels = [...RAID_TYPES, "Administrator", "Group", "Site", "Viewer",
    "Unrestricted, including accounts, grants and global settings",
    "Portfolio-wide read; write inside the granted programmes; money and baselines",
    "Own sites plus group projects read-only; write site-governed projects only",
    "Read-only, inside the granted scope"];
  for (const k of labels) {
    assert.ok(FR[k], `« ${k} » sans entrée FR — la porte F5 ne voit pas t(r.type)`);
    assert.ok(ES[k], `« ${k} » sans entrée ES`);
  }
  assert.equal(FR.Issue, "Problème");
});

/* ── O-7 ─────────────────────────────────────────────────────────── */

test("O-7 — un lien inter-projets glissé de plus de cinq jours est signalé, sans rien changer d'autre", () => {
  const act = (id, project, stage, start, end, baseStart, baseEnd) =>
    ({ id, project, stage, name: id, start, end, baseStart, baseEnd, deps: [], weight: 1 });
  const db = {
    projects: [{ id: "A", name: "Feeder" }, { id: "B", name: "Fed" }],
    activities: [
      act("A-A1", "A", 0, "2026-01-01", "2026-03-20", "2026-01-01", "2026-02-28"),
      act("B-A1", "B", 0, "2026-03-01", "2026-04-30", "2026-03-01", "2026-04-30"),
    ],
    crossDeps: [{ from: "A", fromStage: 0, to: "B", toStage: 0, label: "API contract" }],
  };
  const before = JSON.stringify(Engine.depBreaches(db, "A")) + JSON.stringify(Engine.depBreaches(db, "B"));
  const out = Engine.crossDepBreaches(db);
  assert.equal(out.length, 1, "B démarre 19 jours avant que A ne livre, contre 1 jour prévu");
  assert.equal(out[0].overlap, 19);
  assert.equal(out[0].fromProject.id, "A");
  assert.equal(out[0].dep.label, "API contract");
  assert.equal(JSON.stringify(Engine.depBreaches(db, "A")) + JSON.stringify(Engine.depBreaches(db, "B")),
    before, "additif : la règle intra-projet est intacte");

  /* Dans la marge de cinq jours : rien. Hors du périmètre affiché : rien. */
  db.activities[0].end = "2026-03-04";
  assert.equal(Engine.crossDepBreaches(db).length, 0);
  db.activities[0].end = "2026-03-20";
  assert.equal(Engine.crossDepBreaches(db, [{ id: "A" }]).length, 0);
});

/* ── documentHosts ──────────────────────────────────────────────── */

test("P-03 — les hôtes de preuve ont enfin un champ dans Administration", async () => {
  const admin = await as("admin");
  const me = (await admin.get("/api/auth/me")).body.user;
  const db = (await admin.get("/api/bootstrap")).body.db;
  App.me = me; App.db = db; App.ready = true;
  const node = VIEWS.admin(db);
  const host = document.getElementById("root");
  host.textContent = "";
  host.appendChild(node);
  const label = [...host.querySelectorAll("label")].find((l) => l.textContent === "Trusted evidence hosts");
  assert.ok(label, "le refus d'approbation nommait un réglage qu'aucun écran ne proposait");
  assert.ok(label.parentElement.querySelector("input"), "et le champ s'édite");

  /* Ce que le champ écrit, le serveur le tient. */
  const r = await admin.patch("/api/admin/settings", { documentHosts: "docs.example.com" });
  assert.equal(r.status, 200, r.text);
  const again = (await admin.get("/api/bootstrap")).body.db.settings.documentHosts;
  assert.equal(again, "docs.example.com");
});

/* ── O-3 ─────────────────────────────────────────────────────────── */

test("O-3 — à la création, les enseignements adoptés sont proposés", async () => {
  const realGet = api.get;
  const asked = [];
  api.get = async (p) => {
    asked.push(p);
    return { lessons: [{ id: "LL-1", title: "Freeze the chart of accounts early",
      outcome: "Negative", category: "Scope", recommendation: "Freeze it before build" }] };
  };
  try {
    await showRelevantLessons("PRJ-NEW");
  } finally { api.get = realGet; }
  assert.deepEqual(asked, ["/projects/PRJ-NEW/lessons/relevant"],
    "la route existait sans appelant");
  const overlay = document.getElementById("overlay");
  assert.match(overlay.textContent, /Before you plan/);
  assert.match(overlay.textContent, /Freeze the chart of accounts early/);
});

test("O-3 — sans enseignement pertinent, rien ne s'ouvre", async () => {
  document.getElementById("overlay").textContent = "";
  const realGet = api.get;
  api.get = async () => ({ lessons: [] });
  try { await showRelevantLessons("PRJ-EMPTY"); } finally { api.get = realGet; }
  assert.equal(document.getElementById("overlay").textContent, "");
});

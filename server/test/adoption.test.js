/**
 * R-03 · R-09 · R-10 · R-12 · R-14 — les réserves d'exploitation.
 * (R-13, la lignée documentaire, est prouvée dans preuve.test.js.)
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { many } from "../src/db.js";
import { parseCsv } from "../src/routes/importcsv.js";

before(async () => { await boot(); });
after(shutdown);

/* ── R-03 · l'effort réel ─────────────────────────────────────────── */

test("R-03 — une semaine se saisit, se corrige, se retire, et atterrit à côté du plan", async () => {
  const pm = await as("siteGRU");
  const first = await pm.post("/api/timesheets",
    { person: "PE-19", project: SITE_PROJECT_GRU, week: "2026-08-26", days: 4 });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.week, "2026-08-24", "la semaine est normalisée à son lundi");

  // corriger la même semaine = remplacer, pas dupliquer
  const again = await pm.post("/api/timesheets",
    { person: "PE-19", project: SITE_PROJECT_GRU, week: "2026-08-24", days: 3.5 });
  assert.equal(again.status, 201);
  const db = (await pm.get("/api/bootstrap")).body.db;
  const mine = db.timesheets.filter(x => x.person === "PE-19" && x.project === SITE_PROJECT_GRU);
  assert.equal(mine.length, 1, "une ligne par personne-projet-semaine");
  assert.equal(mine[0].days, 3.5);

  const bad = await pm.post("/api/timesheets",
    { person: "PE-19", project: SITE_PROJECT_GRU, week: "2026-08-24", days: 9 });
  assert.equal(bad.status, 400, "une semaine tient dans sept jours");

  const gone = await pm.del("/api/timesheets/" + mine[0].id);
  assert.equal(gone.status, 200);
});

test("R-03 — un lecteur ne saisit pas le réel d'autrui", async () => {
  const viewer = await as("viewerGRU");
  const r = await viewer.post("/api/timesheets",
    { person: "PE-19", project: SITE_PROJECT_GRU, week: "2026-08-24", days: 2 });
  assert.equal(r.status, 403);
});

/* ── R-09 · la reprise de l'existant ──────────────────────────────── */

test("R-09 — le parseur tient les guillemets, les virgules et le BOM", () => {
  const { header, records } = parseCsv('﻿a,b\r\n"x, y","il a dit ""non"""\r\n');
  assert.deepEqual(header, ["a", "b"]);
  assert.equal(records[0].a, "x, y");
  assert.equal(records[0].b, 'il a dit "non"');
});

test("R-09 — la prévisualisation refuse ligne par ligne, sans rien écrire", async () => {
  const admin = await as("admin");
  const dirty = "name,programme,site,governance,pm,start,finish,budget_m\r\n" +
    '"Bon projet",DCH,GRU,site,,2027-01-04,2027-06-30,0.2\r\n' +
    '"Site inconnu",DCH,XXX,site,,2027-01-04,2027-06-30,0.2\r\n' +
    '"Date folle",DCH,GRU,site,,demain,2027-06-30,0.2\r\n';
  const before = (await admin.get("/api/bootstrap")).body.db.projects.length;

  const prev = await admin.post("/api/import/preview", { kind: "projects", csv: dirty });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  assert.equal(prev.body.total, 3);
  assert.equal(prev.body.creatable, 1);
  assert.equal(prev.body.refused, 2);
  const l3 = prev.body.rows.find(x => x.line === 3);
  assert.match(l3.errors.join(" "), /site inconnu/, "le refus dit quoi et où");

  const after1 = (await admin.get("/api/bootstrap")).body.db.projects.length;
  assert.equal(after1, before, "la prévisualisation n'écrit rien");

  // l'application d'un fichier sale = tout ou rien
  const apply = await admin.post("/api/import/apply", { kind: "projects", csv: dirty });
  assert.equal(apply.status, 422);
  assert.match(apply.body.error, /rien n'a été écrit/);
  assert.equal((await admin.get("/api/bootstrap")).body.db.projects.length, before);
});

test("R-09 — un fichier propre s'applique en une transaction, tracée", async () => {
  const admin = await as("admin");
  const clean = "name,programme,site,governance,pm,start,finish,budget_m\r\n" +
    '"Reprise tableur A",DCH,GRU,site,PE-19,2027-02-01,2027-08-31,0.3\r\n' +
    '"Reprise tableur B",CBP,KRK,group,,2027-03-01,2027-12-15,1.1\r\n';
  const r = await admin.post("/api/import/apply", { kind: "projects", csv: clean });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.created.length, 2);

  const db = (await admin.get("/api/bootstrap")).body.db;
  assert.ok(db.projects.some(p => p.name === "Reprise tableur A"));
  const audit = await admin.get("/api/audit?action=Book%20imported%20from%20CSV&limit=3");
  assert.ok(audit.body.events.length >= 1, "le compte rendu est sur la piste");

  const site = await as("siteGRU");
  const refused = await site.post("/api/import/apply", { kind: "projects", csv: clean });
  assert.equal(refused.status, 403, "la reprise est un acte de niveau groupe");
});

test("R-09 — le modèle se télécharge, par nature", async () => {
  const admin = await as("admin");
  const t1 = await admin.get("/api/import/template?kind=people");
  assert.equal(t1.status, 200);
  assert.match(t1.text, /name,role,site/);
});

/* ── R-10 · le fichier ICS ────────────────────────────────────────── */

test("R-10 — une occurrence produit un ICS que tout agenda accepte", async () => {
  const pm = await as("siteGRU");
  const series = (await pm.get("/api/meetings/series")).body.series.find(s => s.next);
  const r = await pm.get("/api/meetings/occurrences/" + series.next.id + "/ics");
  assert.equal(r.status, 200);
  assert.match(r.text, /BEGIN:VCALENDAR/);
  assert.match(r.text, /BEGIN:VEVENT/);
  assert.match(r.text, /DTSTART:\d{8}T\d{6}/);
  assert.match(r.text, /SUMMARY:/);

  const s2 = await pm.get("/api/meetings/series/" + series.id + "/ics");
  assert.match(s2.text, /RRULE:FREQ=(WEEKLY|MONTHLY)/, "la série porte sa récurrence");
});

/* ── R-12 · restaurer depuis la piste ─────────────────────────────── */

test("R-12 — une suppression se restaure depuis son image, en ajoutant, jamais en réécrivant", async () => {
  const admin = await as("admin");
  const made = await admin.post("/api/raid",
    { project: SITE_PROJECT_GRU, type: "Risk", title: "Risque à restaurer", p: 4, i: 3 });
  const rid = made.body.id;
  await admin.del("/api/raid/" + rid);

  const ev = (await admin.get("/api/audit?action=Item%20deleted&limit=5")).body.events
    .find(e => e.entity_id === rid);
  assert.ok(ev, "la suppression est sur la piste");
  assert.equal(ev.before_json.title, "Risque à restaurer", "avec la ligne entière");

  const pm = await as("siteGRU");
  assert.equal((await pm.post("/api/audit/" + ev.id + "/restore", {})).status, 403,
    "restaurer est un acte d'administrateur");

  const r = await admin.post("/api/audit/" + ev.id + "/restore", {});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.note, /not resurrected/i, "et il dit ce qu'il ne fait pas");

  const back = (await admin.get("/api/bootstrap")).body.db.raid.find(x => x.id === rid);
  assert.ok(back, "la ligne est revenue");
  assert.equal(back.title, "Risque à restaurer");

  const twice = await admin.post("/api/audit/" + ev.id + "/restore", {});
  assert.equal(twice.status, 409, "on ne restaure pas par-dessus l'existant");

  const trace = await admin.get("/api/audit?action=Restored%20from%20the%20trail&limit=3");
  assert.ok(trace.body.events.some(e => e.entity_id === rid), "la restauration est elle-même sur la piste");
});

/* ── R-14 · la trace des consultations ────────────────────────────── */

test("R-14 — l'export et le dossier de preuve laissent une trace nominative ; la navigation, non", async () => {
  const admin = await as("admin");
  const beforeN = (await many(
    `SELECT count(*)::int AS n FROM audit_event WHERE entity = 'consultation'`))[0].n;

  await admin.get("/api/bootstrap");
  await admin.get("/api/digest");
  const mid = (await many(
    `SELECT count(*)::int AS n FROM audit_event WHERE entity = 'consultation'`))[0].n;
  assert.equal(mid, beforeN, "la navigation ordinaire n'écrit rien");

  await admin.get("/api/export/dataset");
  await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  const rows = await many(
    `SELECT action, user_label FROM audit_event WHERE entity = 'consultation' ORDER BY id DESC LIMIT 4`);
  assert.ok(rows.some(x => x.action === "Dataset export consulted"));
  assert.ok(rows.some(x => x.action === "Evidence pack consulted"));
  assert.match(rows[0].user_label, /admin/, "et la trace est nominative");
});

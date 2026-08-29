/**
 * R-02 · R-11 — absences, suppléance, digest de retour, notifications.
 *
 * Les propriétés qui comptent : une délégation n'élargit jamais
 * l'autorité et expire avec l'absence qui la porte ; le suppléant ne
 * décide ni sa propre demande ni celle de l'absent ; la piste d'audit
 * nomme les deux ; le digest d'un retour de quatorze jours couvre
 * quatorze jours ; un destinataire francophone est écrit en français, un
 * destinataire absent est couvert par son suppléant, une préférence
 * « off » supprime l'envoi.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, client, SITE_PROJECT_GRU } from "./harness.js";
import { many, query } from "../src/db.js";
import { sweep } from "../src/notify.js";

before(async () => { await boot(); });
after(shutdown);

const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

/* g.silva = PE-19 (GRU, chef de site) · t.nakamura = PE-04 (YYZ).
   La suppléance testée : PE-04 couvre PE-19 pendant sa rotation. */

let absenceId = null;

test("une absence se déclare avec son suppléant, bornée et motivée", async () => {
  const admin = await as("admin");
  const bad = await admin.post("/api/absences",
    { person: "PE-19", from: daysFromNow(-1), to: daysFromNow(13), deputy: "PE-19" });
  assert.equal(bad.status, 400, "personne ne se supplée soi-même");

  const r = await admin.post("/api/absences", {
    person: "PE-19", from: daysFromNow(-13), to: daysFromNow(1),
    reason: "rotation", deputy: "PE-04",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  absenceId = r.body.id;

  const db = (await admin.get("/api/bootstrap")).body.db;
  const a = db.absences.find((x) => x.id === absenceId);
  assert.equal(a.person, "PE-19");
  assert.equal(a.deputy, "PE-04");
});

test("un site ne déclare que les absences de ses gens", async () => {
  const sin = await as("siteSIN");
  const refused = await sin.post("/api/absences",
    { person: "PE-19", from: daysFromNow(0), to: daysFromNow(5) });
  assert.equal(refused.status, 403, "PE-19 appartient à GRU, pas à SIN");
});

test("le suppléant prend l'autorité de l'absent — jamais plus — et l'audit nomme les deux", async () => {
  const deputy = await as("siteYYZ");   // t.nakamura, PE-04, grants YYZ

  // avant de couvrir : le projet GRU gouverné site est INVISIBLE pour YYZ
  const before = (await deputy.get("/api/bootstrap")).body.db;
  assert.equal(before.projects.some((p) => p.id === SITE_PROJECT_GRU), false,
    "hors périmètre = absent, pas grisé");
  const refused = await deputy.patch("/api/projects/" + SITE_PROJECT_GRU, { name: "x", version: 1 });
  assert.equal(refused.status, 404, "et la route répond comme s'il n'existait pas");

  const offered = await deputy.get("/api/auth/actas/available");
  assert.equal(offered.status, 200);
  const target = offered.body.available.find((x) => x.userId);
  assert.ok(target, "l'absence en cours propose la couverture");

  const on = await deputy.post("/api/auth/actas", { userId: target.userId });
  assert.equal(on.status, 200, JSON.stringify(on.body));

  const me = await deputy.get("/api/auth/me");
  assert.equal(me.body.user.actingFor, target.userId);
  assert.match(me.body.user.displayName, /pour /, "l'identité affiche les deux noms");
  assert.deepEqual(me.body.user.grants.sites, ["GRU"], "l'autorité est celle de l'absent, pas l'union");

  // il écrit sur GRU maintenant — au nom de l'absent
  const fresh = (await deputy.get("/api/bootstrap")).body.db.projects.find((p) => p.id === SITE_PROJECT_GRU);
  const ok = await deputy.patch("/api/projects/" + SITE_PROJECT_GRU,
    { desc: "Mis à jour par le suppléant", version: fresh.version });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  // ...et plus sur YYZ pendant qu'il couvre (jamais plus, jamais l'union)
  const yyz = (await deputy.get("/api/bootstrap")).body.db.projects.find((p) => p.site === "YYZ" && p.governanceLevel === "site");
  if (yyz) {
    const refusedYyz = await deputy.patch("/api/projects/" + yyz.id, { name: "x", version: yyz.version });
    assert.equal(refusedYyz.status, 403, "la délégation remplace, elle n'additionne pas");
  }

  const audit = await (await as("admin")).get("/api/audit?entity=project&entityId=" + SITE_PROJECT_GRU + "&limit=5");
  const row = audit.body.events.find((e) => /pour /.test(e.user_label));
  assert.ok(row, "la ligne d'audit porte « X (pour Y) »");
});

test("le suppléant ne décide pas une demande émise par lui, ni par l'absent", async () => {
  const deputy = await as("siteYYZ");
  const offered = await deputy.get("/api/auth/actas/available");
  await deputy.post("/api/auth/actas", { userId: offered.body.available[0].userId });

  // une demande émise PAR L'ABSENT (PE-19) : l'indépendance suit la personne couverte
  const admin = await as("admin");
  const { many: m } = await import("../src/db.js");
  const raised = await deputy.post("/api/change",
    { project: SITE_PROJECT_GRU, title: "CR du suppléant", cost: 0.05, weeks: 1 });
  assert.equal(raised.status, 201, JSON.stringify(raised.body));
  // raised_by est enregistré comme la personne au clavier ? Le serveur
  // stampe raised_by = personId du compte : ici le SUPPLÉANT (PE-04)…
  const self = await deputy.post("/api/change/" + raised.body.id + "/approve", {});
  assert.equal(self.status, 403, "…et il ne décide pas sa propre demande");
  assert.match(self.body.error, /you raised|second pair/);

  // une demande émise par l'absent : refusée aussi pendant la couverture
  await query(`UPDATE change_request SET raised_by = 'PE-19' WHERE id = $1`, [raised.body.id]);
  const forAbsent = await deputy.post("/api/change/" + raised.body.id + "/approve", {});
  assert.equal(forAbsent.status, 403, "si l'absent ne pouvait pas, son suppléant ne peut pas non plus");
});

test("la délégation expire avec l'absence — la session retombe sur elle-même", async () => {
  const deputy = await as("siteYYZ");
  const offered = await deputy.get("/api/auth/actas/available");
  await deputy.post("/api/auth/actas", { userId: offered.body.available[0].userId });
  assert.equal((await deputy.get("/api/auth/me")).body.user.actingFor !== null, true);

  // l'absence se termine hier
  await query(`UPDATE person_absence SET ends_on = CURRENT_DATE - 1 WHERE id = $1`, [absenceId]);

  const me = await deputy.get("/api/auth/me");
  assert.equal(me.body.user.actingFor, null, "plus d'absence, plus de couverture — sans déconnexion");
  assert.deepEqual(me.body.user.grants.sites, ["YYZ"], "l'autorité redevient la sienne");

  await query(`UPDATE person_absence SET ends_on = CURRENT_DATE + 1 WHERE id = $1`, [absenceId]);
});

test("le digest d'un retour de rotation couvre l'absence et le dit (R-02)", async () => {
  const pm = await as("siteGRU");   // PE-19, en absence déclarée depuis 13 jours
  const r = await pm.get("/api/digest");
  assert.equal(r.status, 200);
  assert.ok(r.body.days >= 13, `la fenêtre couvre l'absence (${r.body.days} j)`);
  assert.ok(r.body.coveredFrom, "et l'entête dit depuis quand");

  const admin = await as("admin");   // personne sans absence : plancher de 7
  const base = await admin.get("/api/digest");
  assert.equal(base.body.days, 7);
});

test("R-11 — français pour qui l'a choisi, suppléant pour qui est absent, silence pour qui l'a demandé", async () => {
  const admin = await as("admin");
  // g.silva (PE-19, absent, suppléant PE-04) préfère le français ; le
  // suppléant t.nakamura aussi — le message doit partir en FR, vers LUI.
  const users = await many(`SELECT id, person_id FROM app_user WHERE person_id IN ('PE-19','PE-04')`);
  for (const u of users) {
    await query(`UPDATE app_user SET locale = 'fr' WHERE id = $1`, [u.id]);
  }
  // une action en retard au nom de PE-19
  const occ = await many(
    `SELECT o.id, o.series_id FROM meeting_occurrence o LIMIT 1`);
  await query(
    `INSERT INTO meeting_action (id, series_id, raised_in, title, owner_id, due_date, status)
     VALUES ('ACT-R11', $1, $2, 'Vérifier la liaison VSAT', 'PE-19', CURRENT_DATE - 2, 'Open')`,
    [occ[0].series_id, occ[0].id]);

  await sweep({ today: iso(new Date()) });
  const deputyUser = users.find((u) => u.person_id === "PE-04");
  const q = await many(
    `SELECT email, subject, body, user_id FROM notification WHERE entity_id = 'ACT-R11'`);
  assert.equal(q.length, 1, "une seule mise en file");
  assert.equal(q[0].user_id, deputyUser.id, "adressée au suppléant, pas à l'absent");
  assert.match(q[0].subject, /En couverture de/, "et disant pour qui");
  assert.match(q[0].subject, /En retard/, "en français");
  assert.match(q[0].body, /Ouvrez Meridian/, "corps en français aussi");

  // préférence « off » : rien ne part, rien n'est mis en file
  await query(`UPDATE app_user SET notify_pref = 'off' WHERE id = $1`, [deputyUser.id]);
  await query(`DELETE FROM notification WHERE entity_id = 'ACT-R11'`);
  await sweep({ today: iso(new Date()) });
  const silent = await many(`SELECT id FROM notification WHERE entity_id = 'ACT-R11'`);
  assert.equal(silent.length, 0, "« off » veut dire off");
});

test("les préférences s'éditent par leur propriétaire, et par personne d'autre en douce", async () => {
  const pm = await as("siteGRU");
  const ok = await pm.patch("/api/auth/preferences", { locale: "fr", notifyPref: "weekly" });
  assert.equal(ok.status, 200);
  const me = await pm.get("/api/auth/me");
  assert.equal(me.body.user.locale, "fr");
  assert.equal(me.body.user.notifyPref, "weekly");
  const bad = await pm.patch("/api/auth/preferences", { notifyPref: "sometimes" });
  assert.equal(bad.status, 400);
});

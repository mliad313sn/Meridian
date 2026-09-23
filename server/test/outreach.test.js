/**
 * O-1 / O-2 (docs/32, porté par docs/36 C-04) — ce que la remise
 * promettait sans le tenir.
 *
 * Le comité de revue documentaire a trouvé cinq natures définies que
 * rien n'émettait, une nature émise que la contrainte refusait en
 * silence (tolerance-breached, avalée par un catch — et, sur main, la
 * même chose pour benefit-review-due), et deux réglages d'abonnement —
 * la portée et la cadence — stockés puis ignorés à la remise. La branche
 * du comité n'a jamais été fusionnée ; ces tests, repris et adaptés à
 * l'arbre courant, tiennent les corrections.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { query, many, one } from "../src/db.js";
import { queue, sweep, deliver } from "../src/notify.js";
import { sweepExceptions } from "../src/exceptions.js";
import { loadPortfolio } from "../src/portfolio.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

async function boxOf(who) {
  const c = await as(who);
  const me = (await c.get("/api/auth/me")).body.user;
  return { c, me };
}

/* Un compte remis à plat : préférence immédiate, pas de silence, pas
   d'abonnement, boîte vide — pour que chaque test lise SES effets. */
async function cleanSlate(who) {
  const { c, me } = await boxOf(who);
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
  await c.patch("/api/auth/preferences", { notifyPref: "immediate" });
  await c.patch("/api/auth/quiet-hours", { from: null, to: null });
  return { c, me };
}

/* Seuls les messages de CE compte partent dans ces tests : la file des
   autres est mise de côté, sinon un envoi réussi ailleurs fausserait la
   lecture de la cadence. */
async function onlyMine(userId) {
  await query(`UPDATE notification SET state = 'suppressed' WHERE state = 'queued' AND user_id IS DISTINCT FROM $1`,
    [userId]);
}

test("053 — tolerance-breached et benefit-review-due ont enfin le droit d'exister dans la file", async () => {
  const { me } = await cleanSlate("siteGRU");
  for (const kind of ["tolerance-breached", "benefit-review-due"]) {
    const ok = await queue({
      userId: me.id, email: me.email, kind,
      subject: "Marge franchie", body: "x", dedupeKey: `outreach-${kind}`, severity: "attention",
    });
    assert.equal(ok, true, `avant 053, la contrainte refusait ${kind} et le catch avalait`);
    const row = await one(`SELECT kind FROM notification WHERE dedupe_key = $1`, [`outreach-${kind}`]);
    assert.equal(row.kind, kind);
  }
});

test("053 — le balayage d'exception prévient réellement celui qui a posé la marge", async () => {
  const group = await as("groupDCH");
  const gme = (await group.get("/api/auth/me")).body.user;
  const db = await loadPortfolio({ id: "T", role: "admin", active: true,
    grants: { programmes: new Set(), sites: new Set() } });
  const p = db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  const wide = Engine.tolerance(db, p, { scheduleDays: 999999 });
  assert.ok(wide && wide.schedule, "ce projet se mesure");
  const put = await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
    { scheduleDays: Math.max(0, wide.schedule.measured - 1) });
  assert.ok(put.status < 300, put.text);
  await query(`DELETE FROM project_exception WHERE project_id = $1`, [SITE_PROJECT_GRU]);
  await query(`DELETE FROM notification WHERE user_id = $1 AND kind = 'tolerance-breached'`, [gme.id]);

  await sweepExceptions();
  const exc = await one(
    `SELECT id FROM project_exception WHERE project_id = $1 AND status = 'Open'
       AND dimension <> 'benefit-review' LIMIT 1`, [SITE_PROJECT_GRU]);
  assert.ok(exc, "l'exception est ouverte");
  const told = await one(
    `SELECT kind, entity, entity_id, dedupe_key FROM notification
      WHERE user_id = $1 AND kind = 'tolerance-breached'`, [gme.id]);
  assert.ok(told, "celui qui a accordé la marge est prévenu — avant 053, jamais");
  assert.equal(told.entity, "project_exception");
  assert.match(told.dedupe_key, /^exception:/, "la clé NOT NULL est enfin fournie");

  /* Repasser ne double pas le message : la clé porte l'exception. */
  await sweepExceptions();
  const again = await many(
    `SELECT id FROM notification WHERE user_id = $1 AND kind = 'tolerance-breached'`, [gme.id]);
  assert.equal(again.length, 1);
});

test("O-2 — une décision renvoyée et sans réponse est due au président de la salle visée", async () => {
  const { me } = await cleanSlate("groupDCH");
  assert.ok(me.personId, "le compte porte une personne");
  await query(`DELETE FROM meeting_decision WHERE id = 'DEC-OUTREACH'`);
  await query(`DELETE FROM meeting_occurrence WHERE id = 'OCC-OUTREACH'`);
  await query(`DELETE FROM meeting_series WHERE id IN ('SER-OUT-SITE', 'SER-OUT-GROUP')`);
  await query(
    `INSERT INTO meeting_series (id, name, cadence, scope_kind, site_id)
     VALUES ('SER-OUT-SITE', 'GRU site room', 'weekly', 'site', 'GRU')`);
  await query(
    `INSERT INTO meeting_series (id, name, cadence, scope_kind, chair_id)
     VALUES ('SER-OUT-GROUP', 'Outreach group room', 'monthly', 'group', $1)`, [me.personId]);
  await query(
    `INSERT INTO meeting_occurrence (id, series_id, meets_on) VALUES ('OCC-OUTREACH', 'SER-OUT-SITE', CURRENT_DATE)`);
  await query(
    `INSERT INTO meeting_decision (id, occurrence_id, headline, referred_to_scope)
     VALUES ('DEC-OUTREACH', 'OCC-OUTREACH', 'Fund the second link', 'group')`);

  await sweep();
  const row = await one(
    `SELECT subject FROM notification
      WHERE kind = 'decision-owed' AND entity_id = 'DEC-OUTREACH' AND user_id = $1`, [me.id]);
  assert.ok(row, "la décision due est dans la boîte du président");
  assert.match(row.subject, /Fund the second link/);

  /* Répondue, elle ne se relance plus. */
  await query(`UPDATE meeting_decision SET answered_by = 'DEC-OUTREACH' WHERE id = 'DEC-OUTREACH'`);
  await query(`DELETE FROM notification WHERE kind = 'decision-owed' AND entity_id = 'DEC-OUTREACH'`);
  await sweep();
  const none = await many(
    `SELECT id FROM notification WHERE kind = 'decision-owed' AND entity_id = 'DEC-OUTREACH'`);
  assert.equal(none.length, 0, "une décision répondue n'est plus due");
  await query(`DELETE FROM meeting_series WHERE id IN ('SER-OUT-SITE', 'SER-OUT-GROUP')`);
});

test("O-2 — une préoccupation de site atteint le chef du projet groupe", async () => {
  /* Le chef doit tenir un compte pour tenir une boîte : on le lui donne,
     comme l'exploitation le ferait, plutôt que d'espérer du semis. */
  const target = await one(
    `SELECT id FROM project WHERE governance_level = 'group' AND NOT closed LIMIT 1`);
  const holder = await one(
    `SELECT person_id FROM app_user WHERE person_id IS NOT NULL AND active LIMIT 1`);
  assert.ok(target && holder, "un projet groupe et un compte incarné existent");
  await query(`UPDATE project SET pm_id = $2 WHERE id = $1`, [target.id, holder.person_id]);
  const site = await one(`SELECT id FROM site WHERE active LIMIT 1`);
  await query(`DELETE FROM raid_item WHERE id = 'RSK-OUTREACH'`);
  await query(
    `INSERT INTO raid_item (id, project_id, kind, title, origin_site, status)
     VALUES ('RSK-OUTREACH', $1, 'Risk', 'Concern raised by the site', $2, 'Open')`,
    [target.id, site.id]);

  await sweep();
  const row = await one(
    `SELECT id FROM notification
      WHERE kind = 'concern-raised' AND entity_id = 'RSK-OUTREACH'`);
  assert.ok(row, "la préoccupation est dans une boîte, pas seulement dans un registre");
  await sweep();
  const again = await many(
    `SELECT id FROM notification WHERE kind = 'concern-raised' AND entity_id = 'RSK-OUTREACH'`);
  assert.equal(again.length, 1, "une fois, pas à chaque passage");
});

test("O-2 — un site silencieux depuis trente jours est signalé à son référent", async () => {
  const { me } = await cleanSlate("siteYYZ");
  assert.ok(me.personId);
  await query(`UPDATE site SET champion_id = $1 WHERE id = 'YYZ'`, [me.personId]);
  /* Le signal d'avancement est celui de l'écran Adoption : on vieillit
     les traces du site plutôt que de les effacer. */
  await query(
    `UPDATE audit_event SET at = now() - interval '60 days'
      WHERE entity_id IN (SELECT id FROM project WHERE site_id = 'YYZ')`);
  await sweep();
  const row = await one(
    `SELECT subject FROM notification WHERE kind = 'site-quiet' AND entity_id = 'YYZ' AND user_id = $1`,
    [me.id]);
  assert.ok(row, "le référent du site est prévenu — A-12 a enfin une tâche");
});

test("O-2 — une semaine sans réel saisi se signale, une seule fois, à la personne", async () => {
  const { me } = await cleanSlate("siteGRU");
  const person = me.personId;
  assert.ok(person, "le compte de test porte une personne");
  const prj = await one(`SELECT id FROM project WHERE NOT closed LIMIT 1`);
  await query(
    `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct)
     VALUES ($1, $2, CURRENT_DATE - 30, CURRENT_DATE + 30, 50)`, [person, prj.id]);
  await query(
    `DELETE FROM timesheet WHERE person_id = $1
      AND week_start = date_trunc('week', CURRENT_DATE)::date - 7`, [person]);

  await sweep();
  const rows = await many(
    `SELECT id FROM notification WHERE kind = 'timesheet-missing' AND user_id = $1`, [me.id]);
  assert.equal(rows.length, 1, "le rappel existe");
  await sweep();
  const again = await many(
    `SELECT id FROM notification WHERE kind = 'timesheet-missing' AND user_id = $1`, [me.id]);
  assert.equal(again.length, 1, "et il ne se répète pas dans la même semaine");
});

test("O-2 — le digest part au rythme que le compte a demandé", async () => {
  const { c, me } = await cleanSlate("siteGRU");
  await c.patch("/api/auth/preferences", { notifyPref: "weekly" });
  await sweep();
  const row = await one(
    `SELECT id FROM notification WHERE kind = 'digest' AND user_id = $1`, [me.id]);
  assert.ok(row, "un compte en cadence différée reçoit son digest");
  await sweep();
  const again = await many(
    `SELECT id FROM notification WHERE kind = 'digest' AND user_id = $1`, [me.id]);
  assert.equal(again.length, 1, "un digest par période, pas par passage");
  await c.patch("/api/auth/preferences", { notifyPref: "immediate" });
});

test("O-1 — la portée d'un abonnement décide enfin de ce qui sort", async () => {
  const { c, me } = await cleanSlate("siteGRU");
  const here = await one(
    `SELECT p.id, p.site_id FROM project p
       JOIN access_grant g ON g.site_id = p.site_id AND g.user_id = $1
      WHERE NOT p.closed LIMIT 1`, [me.id]);
  assert.ok(here, "le compte GRU a un projet sur son site");
  const elsewhere = await one(
    `SELECT id FROM project WHERE site_id <> $1 AND NOT closed LIMIT 1`, [here.site_id]);

  const made = await c.post("/api/auth/subscriptions",
    { kind: "*", scopeKind: "site", scopeId: here.site_id, minSeverity: "info", cadence: "immediate" });
  assert.equal(made.status, 201);

  await queue({ userId: me.id, email: me.email, kind: "gate-blocked", severity: "info",
    subject: "Chez moi", body: "x", entity: "project", entityId: here.id,
    dedupeKey: "outreach-scope-here" });
  await queue({ userId: me.id, email: me.email, kind: "gate-blocked", severity: "info",
    subject: "Ailleurs", body: "x", entity: "project", entityId: elsewhere.id,
    dedupeKey: "outreach-scope-away" });
  await onlyMine(me.id);

  const sent = [];
  await deliver(async ({ subject }) => { sent.push(subject); });
  assert.ok(sent.includes("Chez moi"), "ce que la portée couvre sort");
  assert.ok(!sent.includes("Ailleurs"), "ce qu'elle ne couvre pas reste au centre");

  const still = await one(
    `SELECT state FROM notification WHERE dedupe_key = 'outreach-scope-away'`);
  assert.equal(still.state, "queued", "non couvert n'est pas perdu : il attend au centre");
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
});

test("O-1 — la cadence d'un abonnement est honorée à la remise", async () => {
  const { c, me } = await cleanSlate("siteGRU");
  const made = await c.post("/api/auth/subscriptions",
    { kind: "*", scopeKind: "portfolio", minSeverity: "info", cadence: "weekly" });
  assert.equal(made.status, 201);

  /* Un envoi tout frais : la période hebdomadaire n'est pas écoulée. */
  await query(
    `INSERT INTO notification (user_id, email, kind, subject, body, dedupe_key, state, sent_at)
     VALUES ($1, $2, 'digest', 'déjà parti', 'x', 'outreach-cad-prev', 'sent', now())`,
    [me.id, me.email]);
  await queue({ userId: me.id, email: me.email, kind: "action-due", severity: "info",
    subject: "Trop tôt pour repartir", body: "x", dedupeKey: "outreach-cad-1" });
  await onlyMine(me.id);

  const sent = [];
  await deliver(async ({ subject }) => { sent.push(subject); });
  assert.ok(!sent.includes("Trop tôt pour repartir"),
    "hebdomadaire veut dire un lot par semaine, pas un envoi par événement");
  const still = await one(`SELECT state FROM notification WHERE dedupe_key = 'outreach-cad-1'`);
  assert.equal(still.state, "queued", "le message attend la période, il n'est pas perdu");
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
});

test("O-1 — les heures de silence reviennent au client qui les dessine", async () => {
  const { c } = await cleanSlate("siteGRU");
  const set = await c.patch("/api/auth/quiet-hours", { from: 22, to: 6 });
  assert.equal(set.status, 200, set.text);
  const boot = (await c.get("/api/bootstrap")).body;
  assert.equal(boot.me.quietFrom, 22, "le dialogue des préférences lit ce qui est tenu");
  assert.equal(boot.me.quietTo, 6);
  await c.patch("/api/auth/quiet-hours", { from: null, to: null });
});

test("O-2 — le panneau ne dit « configuré » que si un message partirait vraiment", async () => {
  const admin = await as("admin");
  const saved = process.env.MERIDIAN_SMTP_URL;
  process.env.MERIDIAN_SMTP_URL = "smtp://mail.example.com";
  try {
    const r = await admin.get("/api/admin/notifications");
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.transport, "none",
      "MERIDIAN_SMTP_URL n'est pas un transport que ce produit porte");
  } finally {
    if (saved === undefined) delete process.env.MERIDIAN_SMTP_URL;
    else process.env.MERIDIAN_SMTP_URL = saved;
  }
});

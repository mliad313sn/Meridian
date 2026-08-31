/**
 * O-1 / O-2 (docs/32) — ce que la remise promettait sans le tenir.
 *
 * Le comité de revue documentaire a trouvé cinq natures définies que
 * rien n'émettait, une nature émise que la contrainte refusait en
 * silence (tolerance-breached, avalée par un catch), et deux réglages
 * d'abonnement — la portée et la cadence — stockés puis ignorés à la
 * remise. Ces tests tiennent les corrections.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as } from "./harness.js";
import { query, many, one } from "../src/db.js";
import { queue, sweep, deliver } from "../src/notify.js";

before(async () => { await boot(); });
after(shutdown);

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

test("027 — tolerance-breached a enfin le droit d'exister dans la file", async () => {
  const { me } = await cleanSlate("siteGRU");
  const ok = await queue({
    userId: me.id, email: me.email, kind: "tolerance-breached",
    subject: "Marge franchie", body: "x", dedupeKey: "outreach-tol-1", severity: "attention",
  });
  assert.equal(ok, true, "avant 027, la contrainte refusait et le catch avalait");
  const row = await one(
    `SELECT kind FROM notification WHERE dedupe_key = 'outreach-tol-1'`);
  assert.equal(row.kind, "tolerance-breached");
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
});

test("O-2 — une semaine sans réel saisi se signale, une seule fois", async () => {
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

  const sent = [];
  await deliver(async ({ subject }) => { sent.push(subject); });
  assert.ok(!sent.includes("Trop tôt pour repartir"),
    "hebdomadaire veut dire un lot par semaine, pas un envoi par événement");
  const still = await one(`SELECT state FROM notification WHERE dedupe_key = 'outreach-cad-1'`);
  assert.equal(still.state, "queued", "le message attend la période, il n'est pas perdu");
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
});
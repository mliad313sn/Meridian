/**
 * N-05 — le centre de notification, sa purge et son escalier.
 *
 * Le comité d'innovation a refusé de proposer le centre sans la charge
 * qui va avec : ces tests tiennent les deux ensemble, parce qu'un centre
 * livré sans son balai aggrave un constat ouvert (G-13).
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as } from "./harness.js";
import { query, many } from "../src/db.js";
import { queue, purge, escalate } from "../src/notify.js";

before(async () => { await boot(); });
after(shutdown);

async function boxOf(who) {
  const c = await as(who);
  const me = (await c.get("/api/auth/me")).body.user;
  return { c, me };
}

test("N-05 — le destinataire lit enfin sa propre boîte", async () => {
  const { c, me } = await boxOf("siteGRU");
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await queue({ userId: me.id, email: me.email, kind: "action-due",
    subject: "Une action vous attend", body: "corps", entity: "meeting_action",
    entityId: "MA-1", dedupeKey: "centre-1", severity: "attention" });

  const r = await c.get("/api/auth/notifications");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.unread, 1);
  assert.equal(r.body.items[0].subject, "Une action vous attend");
  assert.equal(r.body.items[0].severity, "attention");
});

test("N-05 — une boîte est la mienne : je ne lis pas celle d'un autre", async () => {
  const { me } = await boxOf("siteGRU");
  const other = await as("siteYYZ");
  await queue({ userId: me.id, email: me.email, kind: "action-due",
    subject: "Pour São Paulo seulement", body: "x", dedupeKey: "centre-scope",
    severity: "info" });

  const r = await other.get("/api/auth/notifications");
  assert.ok(!r.body.items.some(i => i.subject === "Pour São Paulo seulement"),
    "le centre ne lit pas le portefeuille, il lit une boîte");
});

test("N-05 — « lu » n'est pas « envoyé »", async () => {
  const { c, me } = await boxOf("siteGRU");
  const before0 = await c.get("/api/auth/notifications?unread=1");
  const id = before0.body.items[0].id;

  const marked = await c.patch("/api/auth/notifications/" + id, {});
  assert.equal(marked.status, 200);

  const row = await many(`SELECT read_at, state FROM notification WHERE id = $1`, [id]);
  assert.ok(row[0].read_at, "la lecture est enregistrée");
  assert.equal(row[0].state, "queued", "et la remise, elle, n'a pas bougé");

  const other = await as("siteYYZ");
  const stolen = await other.patch("/api/auth/notifications/" + id, {});
  assert.equal(stolen.status, 404, "on ne marque pas lu le courrier d'autrui");
});

test("N-05 — l'escalier fait monter ce qui traîne, sans rien renvoyer", async () => {
  const { me } = await boxOf("siteGRU");
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await queue({ userId: me.id, email: me.email, kind: "action-overdue",
    subject: "Vieux message", body: "x", dedupeKey: "centre-esc", severity: "info" });
  await query(`UPDATE notification SET at = now() - interval '10 days' WHERE dedupe_key = 'centre-esc'`);

  /* Sans réglage, l'escalier ne fait rien : le produit n'invente pas un
     délai que personne n'a décidé. */
  await query(`DELETE FROM app_setting WHERE key = 'notifyEscalateDays'`);
  assert.equal((await escalate()).raised, 0);

  await query(`INSERT INTO app_setting (key, value) VALUES ('notifyEscalateDays', '3'::jsonb)
               ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  const out = await escalate();
  assert.ok(out.raised >= 1);
  const row = await many(`SELECT severity FROM notification WHERE dedupe_key = 'centre-esc'`);
  assert.equal(row[0].severity, "attention", "un cran, pas un renvoi");
});

test("G-13 — la purge refuse de deviner une durée que personne n'a écrite", async () => {
  await query(`DELETE FROM app_setting WHERE key = 'notifyRetentionDays'`);
  const out = await purge();
  assert.equal(out.removed, 0);
  assert.match(out.skipped, /no retention decided/i,
    "et elle dit quel réglage manque, plutôt que de choisir à la place du mandant");
});

test("G-13 — une durée écrite, et la purge balaie ce qui a fait son temps", async () => {
  const { me } = await boxOf("siteGRU");
  await query(`INSERT INTO app_setting (key, value) VALUES ('notifyRetentionDays', '30'::jsonb)
               ON CONFLICT (key) DO UPDATE SET value = excluded.value`);

  await queue({ userId: me.id, email: me.email, kind: "digest",
    subject: "Vieux digest", body: "x", dedupeKey: "centre-purge" });
  const stamped = await many(`SELECT expires_on FROM notification WHERE dedupe_key = 'centre-purge'`);
  assert.ok(stamped[0].expires_on, "l'échéance est posée à l'écriture");

  /* Remis, et périmé. */
  await query(`UPDATE notification SET state = 'sent', sent_at = now(),
                      expires_on = CURRENT_DATE - 1 WHERE dedupe_key = 'centre-purge'`);
  const out = await purge();
  assert.ok(out.removed >= 1);
  assert.equal((await many(`SELECT 1 FROM notification WHERE dedupe_key = 'centre-purge'`)).length, 0);
});

test("G-13 — la purge ne supprime jamais ce qui n'a pas encore été dit", async () => {
  const { me } = await boxOf("siteGRU");
  await queue({ userId: me.id, email: me.email, kind: "digest",
    subject: "Jamais parti", body: "x", dedupeKey: "centre-queued" });
  await query(`UPDATE notification SET expires_on = CURRENT_DATE - 5 WHERE dedupe_key = 'centre-queued'`);
  await purge();
  assert.equal((await many(`SELECT 1 FROM notification WHERE dedupe_key = 'centre-queued'`)).length, 1,
    "supprimer un message en file perdrait le dire, pas sa trace");
});

test("N-05 — un abonnement se pose, se relit et se retire", async () => {
  const { c } = await boxOf("siteGRU");
  const made = await c.post("/api/auth/subscriptions",
    { kind: "gate-blocked", scopeKind: "site", scopeId: "GRU", minSeverity: "attention", cadence: "weekly" });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const list = await c.get("/api/auth/subscriptions");
  const sub = list.body.subscriptions.find(s => s.kind === "gate-blocked");
  assert.equal(sub.cadence, "weekly");
  assert.equal(sub.minSeverity, "attention");

  const bad = await c.post("/api/auth/subscriptions", { kind: "*", scopeKind: "site" });
  assert.equal(bad.status, 400, "un abonnement de site nomme son site");

  assert.equal((await c.del("/api/auth/subscriptions/" + sub.id)).status, 200);
});

test("N-05 — les heures de silence se règlent, et se règlent entièrement", async () => {
  const { c } = await boxOf("siteGRU");
  assert.equal((await c.patch("/api/auth/quiet-hours", { from: 22, to: 6 })).status, 200);
  assert.equal((await c.patch("/api/auth/quiet-hours", { from: 22 })).status, 400,
    "une fenêtre a deux bords");
  assert.equal((await c.patch("/api/auth/quiet-hours", { from: 25, to: 6 })).status, 400);
  assert.equal((await c.patch("/api/auth/quiet-hours", { from: null, to: null })).status, 200,
    "et se retire");
});

/* ── La file part vraiment ────────────────────────────────────────────
   Le comité de positionnement a trouvé le défaut le plus embarrassant du
   module : deliver() n'était appelé par aucun code de production, et la
   table d'abonnements de la migration 019 n'était lue par personne. Deux
   mécanismes complets dont personne n'actionnait le dernier maillon. */

test("le transport sortant reste fermé tant que le mandant n'a rien nommé", async () => {
  const { outboundTransport } = await import("../src/notify.js");
  await query(`DELETE FROM app_setting WHERE key = 'notifyHosts'`);
  assert.equal(await outboundTransport(), null, "aucun hôte nommé, aucun envoi");

  await query(`INSERT INTO app_setting (key, value) VALUES ('notifyHosts', '"hooks.example.com"'::jsonb)
               ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  const was = process.env.MERIDIAN_NOTIFY_URL;

  process.env.MERIDIAN_NOTIFY_URL = "https://ailleurs.example/hook";
  assert.equal(await outboundTransport(), null, "un hôte hors de la liste ne reçoit rien");

  process.env.MERIDIAN_NOTIFY_URL = "http://hooks.example.com/hook";
  assert.equal(await outboundTransport(), null, "et rien ne part en clair");

  process.env.MERIDIAN_NOTIFY_URL = "https://hooks.example.com/hook";
  assert.equal(typeof await outboundTransport(), "function", "nommé et en https : le canal existe");

  if (was === undefined) delete process.env.MERIDIAN_NOTIFY_URL;
  else process.env.MERIDIAN_NOTIFY_URL = was;
});

test("un abonnement décide enfin de ce qui SORT — et de rien d'autre", async () => {
  const { queue, deliver } = await import("../src/notify.js");
  const { c, me } = await boxOf("siteGRU");
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
  await c.patch("/api/auth/preferences", { notifyPref: "immediate" });
  await c.patch("/api/auth/quiet-hours", { from: null, to: null });

  /* Un abonnement qui ne veut que l'urgent. */
  const made = await c.post("/api/auth/subscriptions",
    { kind: "*", scopeKind: "portfolio", minSeverity: "urgent", cadence: "immediate" });
  assert.equal(made.status, 201);

  await queue({ userId: me.id, email: me.email, kind: "action-due",
    subject: "Simple information", body: "x", dedupeKey: "sub-info", severity: "info" });
  await queue({ userId: me.id, email: me.email, kind: "action-overdue",
    subject: "Vraiment urgent", body: "x", dedupeKey: "sub-urgent", severity: "urgent" });

  const sent = [];
  await deliver(async ({ subject }) => { sent.push(subject); });
  assert.deepEqual(sent, ["Vraiment urgent"], "seul ce qui atteint le seuil sort");

  /* Mais le centre, lui, a tout reçu : un abonnement règle ce qui sort,
     jamais ce qu'on peut venir chercher. */
  const box = await c.get("/api/auth/notifications");
  const subjects = box.body.items.map((i) => i.subject);
  assert.ok(subjects.includes("Simple information"),
    "ce qui n'est pas sorti reste consultable — sinon se désabonner rendrait aveugle");

  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);
});

test("sans aucun abonnement, la préférence globale gouverne comme avant", async () => {
  const { queue, deliver } = await import("../src/notify.js");
  const { me } = await boxOf("siteGRU");
  await query(`DELETE FROM notification WHERE user_id = $1`, [me.id]);
  await query(`DELETE FROM notification_subscription WHERE user_id = $1`, [me.id]);

  await queue({ userId: me.id, email: me.email, kind: "action-due",
    subject: "Sans abonnement", body: "x", dedupeKey: "sub-none", severity: "info" });
  const sent = [];
  await deliver(async ({ subject }) => { sent.push(subject); });
  assert.ok(sent.includes("Sans abonnement"),
    "la finesse s'ajoute, elle ne devient pas une obligation de configurer");
});

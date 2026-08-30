/**
 * NOTIFICATIONS (V-12).
 *
 * The tool used to wait to be visited. This is what goes out to find
 * people: an action falling due, a gate blocked, a decision owed, the
 * weekly digest.
 *
 * Two deliberate separations:
 *
 *   · QUEUEING is not SENDING. A site on a satellite link must not hold a
 *     request open while SMTP times out, and an instance with no mail
 *     server configured must still show people what they would have been
 *     told. Nothing here opens a socket.
 *
 *   · A message is deduplicated by what it is ABOUT, not by when it was
 *     made. `dedupe_key` carries the entity and the day, so running the
 *     sweep hourly does not nag anybody hourly.
 *
 * Delivery is `deliver()`, called by whatever transport an operator has
 * configured. With none configured the queue simply accumulates and is
 * readable in Administration — which is honest, and is what an
 * unconfigured instance should do rather than pretending to have sent.
 */

import { many, query } from "./db.js";
import { say } from "./i18n.js";

/**
 * R-02/R-11 — who a message actually goes to, and in what language.
 * If the owner is absent TODAY and their absence names a deputy with an
 * active account, the message is addressed to the deputy, prefixed so
 * nobody mistakes whose duty it is. A recipient whose preference is
 * "off" is never queued at all. The body is composed in the recipient's
 * own locale — the first email to a francophone site lead must not
 * arrive in English (R-11's exact words).
 */
async function resolveRecipient(userRow) {
  if (!userRow?.email) return null;
  if ((userRow.notify_pref ?? "immediate") === "off") return { off: true };
  if (!userRow.person_id) return { ...userRow, forWhom: null };
  const cover = await many(
    `SELECT u.id, u.email, u.locale, u.notify_pref, u.display_name
       FROM person_absence a
       JOIN app_user u ON u.person_id = a.deputy_id AND u.active
      WHERE a.person_id = $1 AND CURRENT_DATE BETWEEN a.starts_on AND a.ends_on
      ORDER BY a.ends_on LIMIT 1`, [userRow.person_id]);
  if (!cover.length) return { ...userRow, forWhom: null };
  const d = cover[0];
  if ((d.notify_pref ?? "immediate") === "off") return { off: true };
  return { user_id: d.id, email: d.email, locale: d.locale, notify_pref: d.notify_pref,
    forWhom: userRow.display_name ?? userRow.owner_name ?? null };
}
const inLocale = (msg, locale) => say(msg, locale === "fr" ? "fr" : "en");

/** Queue one message. Silently idempotent on the dedupe key. */
export async function queue({ userId, email, kind, subject, body, entity, entityId, dedupeKey,
                              severity = "info", groupKey = "", locale = "", onBehalfOf = null }) {
  if (!email) return false;
  /* N-05 — the retention date is stamped at the moment the message is
     written, from the setting the sponsor decided. No setting, no date,
     and the purge later declines to guess. */
  const r = await query(
    `INSERT INTO notification (user_id, email, kind, subject, body, entity, entity_id,
                               dedupe_key, severity, group_key, locale, on_behalf_of, expires_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             (SELECT CASE WHEN coalesce(nullif(value #>> '{}', '')::int, 0) > 0
                          THEN CURRENT_DATE + (value #>> '{}')::int
                     END
                FROM app_setting WHERE key = 'notifyRetentionDays'))
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [userId ?? null, email, kind, subject, body, entity ?? "", entityId ?? "", dedupeKey,
     severity, groupKey, locale, onBehalfOf]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * G-13 — the purge, and its refusal to guess.
 *
 * The table keeps the recipient's address, the subject AND the body. A
 * notification centre multiplies that volume by a factor nobody can bound
 * in advance, so the committee refused to ship the centre without its
 * broom. How long "who was told what" is kept is a sponsor decision: with
 * no retention written down, this declines and says which setting is
 * missing, on the pattern of documentHosts.
 */
export async function purge() {
  /* `value` est du jsonb : #>> '{}' rend le scalaire en texte, quel que
     soit qu'il ait été écrit comme nombre ou comme chaîne. */
  const s = await many(`SELECT value #>> '{}' AS v FROM app_setting WHERE key = 'notifyRetentionDays'`);
  const days = Number(s[0]?.v ?? 0);
  if (!Number.isFinite(days) || days <= 0) {
    return { removed: 0, skipped: "no retention decided — set notifyRetentionDays in Administration" };
  }
  /* Delivered messages only. Something still queued has not been said to
     anybody yet, and deleting it would lose the telling rather than the
     record of it. */
  const r = await query(
    `DELETE FROM notification
      WHERE state IN ('sent', 'suppressed', 'failed')
        AND expires_on IS NOT NULL AND expires_on < CURRENT_DATE`);
  return { removed: r.rowCount ?? 0, retentionDays: days };
}

/**
 * The escalator — the one mechanism in this lot that treats the cause.
 *
 * An unread message that is sent again teaches people to ignore it. One
 * that climbs a severity step teaches them it counts. Nothing is re-sent
 * here: only the standing of what is already in the box changes.
 */
export async function escalate() {
  const s = await many(`SELECT value #>> '{}' AS v FROM app_setting WHERE key = 'notifyEscalateDays'`);
  const days = Number(s[0]?.v ?? 0);
  if (!Number.isFinite(days) || days <= 0) return { raised: 0 };
  const r = await query(
    `UPDATE notification
        SET severity = CASE severity WHEN 'info' THEN 'attention' ELSE 'urgent' END
      WHERE read_at IS NULL
        AND severity <> 'urgent'
        AND at < now() - ($1::int * interval '1 day')`, [days]);
  return { raised: r.rowCount ?? 0, afterDays: days };
}

/**
 * Work out what everybody should be told, and queue it.
 *
 * Reads are deliberately wide and unscoped: this runs as the system, not
 * as a person, and each message is addressed to the one account entitled
 * to it. Scoping happens by WHO IS TOLD, not by what is read.
 */
export async function sweep({ today = new Date().toISOString().slice(0, 10), horizonDays = 3 } = {}) {
  const day = String(today);
  let queued = 0;

  /* Actions falling due, and actions already late. The owner is a person;
     the account is whoever carries that person_id. */
  const actions = await many(
    `SELECT a.id, a.title, a.due_date, a.status, s.name AS series_name,
            u.id AS user_id, u.email, u.locale, u.notify_pref, u.person_id,
            p.name AS owner_name
       FROM meeting_action a
       JOIN meeting_series s ON s.id = a.series_id
       LEFT JOIN person p   ON p.id = a.owner_id
       LEFT JOIN app_user u ON u.person_id = a.owner_id AND u.active
      WHERE a.status IN ('Open','In progress') AND a.due_date IS NOT NULL
        AND a.due_date <= ($1::date + $2::int)`,
    [day, horizonDays]);

  for (const a of actions) {
    const to = await resolveRecipient(a);
    if (!to || to.off || !to.email) continue;
    const loc = to.locale;
    const late = String(a.due_date) < day;
    const forPrefix = to.forWhom ? inLocale("Covering for ", loc) + to.forWhom + " — " : "";
    const subject = forPrefix + (late
      ? inLocale("Overdue: ", loc) + a.title
      : inLocale("Due ", loc) + a.due_date + ": " + a.title);
    queued += await queue({
      userId: to.user_id, email: to.email,
      kind: late ? "action-overdue" : "action-due",
      subject,
      body: `${a.title}\n\n` +
            inLocale("Raised in ", loc) + a.series_name + ". " +
            (late ? inLocale("This was due on ", loc) : inLocale("It is due on ", loc)) + a.due_date + ".\n\n" +
            inLocale("Open Meridian to update or close it.", loc),
      entity: "meeting_action", entityId: a.id,
      dedupeKey: `${late ? "overdue" : "due"}:${a.id}:${day}`,
    }) ? 1 : 0;
  }

  /* A gate that is blocked is the project manager's problem before it is
     the steering committee's. */
  const blocked = await many(
    `SELECT p.id, p.name, u.id AS user_id, u.email, u.locale, u.notify_pref, u.person_id,
            per.name AS owner_name,
            count(d.id) FILTER (WHERE d.status <> 'Approved') AS outstanding
       FROM project p
       JOIN document d ON d.project_id = p.id AND d.gate IS NOT NULL AND d.gate > 0
       LEFT JOIN app_user u ON u.person_id = p.pm_id AND u.active
       LEFT JOIN person per ON per.id = p.pm_id
      WHERE NOT p.closed
      GROUP BY p.id, p.name, u.id, u.email, u.locale, u.notify_pref, u.person_id, per.name
     HAVING count(d.id) FILTER (WHERE d.status <> 'Approved') > 0`);

  for (const b of blocked) {
    const to = await resolveRecipient(b);
    if (!to || to.off || !to.email) continue;
    const loc = to.locale;
    const forPrefix = to.forWhom ? inLocale("Covering for ", loc) + to.forWhom + " — " : "";
    queued += await queue({
      userId: to.user_id, email: to.email, kind: "gate-blocked",
      subject: forPrefix + b.name + ": " + b.outstanding + inLocale(" gate document(s) outstanding", loc),
      body: b.name + inLocale(" cannot pass its next gate while ", loc) + b.outstanding +
            inLocale(" evidence document(s) remain unapproved.", loc) + "\n\n" +
            inLocale("Open the project's document list in Meridian.", loc),
      entity: "project", entityId: b.id,
      /* Weekly, not daily: a blocked gate is a standing condition and a
         daily reminder about it is noise people learn to filter. */
      dedupeKey: `gate:${b.id}:${day.slice(0, 7)}:${Math.floor(Number(day.slice(8, 10)) / 7)}`,
    }) ? 1 : 0;
  }

  return { queued, considered: actions.length + blocked.length };
}

/**
 * Le transport sortant, et pourquoi il n'y en a qu'un.
 *
 * Le comité de positionnement a relevé le défaut le plus embarrassant de
 * ce module : `deliver()` n'était appelé par AUCUN code de production.
 * La file se remplissait, la cadence était honorée, le silence de nuit
 * calculé — et rien ne partait jamais. Un mécanisme complet dont personne
 * n'actionne le dernier maillon est un mécanisme qui n'existe pas.
 *
 * Le canal ici est le SORTANT HTTPS conçu par N-05 : un POST JSON vers
 * une adresse que le mandant a nommée, dont un connecteur Teams est le
 * premier consommateur. Il ne demande aucune dépendance nouvelle, et les
 * hôtes autorisés sont fermés par défaut comme `documentHosts`.
 *
 * Le courriel attend toujours `MERIDIAN_SMTP_URL` ET un client SMTP que
 * ce produit ne porte pas. C'est dit ici plutôt que sous-entendu : sans
 * l'un des deux canaux, la file s'accumule et se lit dans le centre —
 * ce qui reste honnête, mais n'est pas de la remise.
 */
export async function outboundTransport() {
  const rows = await many(
    `SELECT value #>> '{}' AS v FROM app_setting WHERE key = 'notifyHosts'`);
  const hosts = String(rows[0]?.v ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const url = process.env.MERIDIAN_NOTIFY_URL || "";
  if (!hosts.length || !url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:") return null;
  if (!hosts.some((h) => host === h || host.endsWith("." + h))) return null;
  return async ({ to, subject, body }) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, subject, text: body }),
    });
    if (!r.ok) throw new Error(`outbound ${r.status}`);
  };
}

/**
 * Hand the queue to a transport. `send` is `async ({to, subject, body})`
 * and should throw to mark a message failed. With no transport the queue
 * is left alone — an unconfigured instance says "queued", never "sent".
 */
export async function deliver(send, { limit = 50 } = {}) {
  if (typeof send !== "function") return { sent: 0, failed: 0, skipped: "no transport configured" };
  /* N-05 — la cadence choisie décide, et pas seulement « off ».
     « quotidien » et « hebdomadaire » étaient offerts dans les préférences
     et ne changeaient rien : tout partait à l'instant, y compris pour qui
     avait demandé un envoi par semaine. Une préférence qu'on offre sans la
     tenir coûte plus cher que de ne pas l'offrir — la personne cesse de
     croire les réglages, puis les messages.

     Un destinataire en cadence différée reçoit au plus un lot par période :
     rien ne part tant que son dernier envoi n'a pas l'âge qu'il a demandé.
     Les messages attendent en file, ils ne sont jamais perdus. */
  const rows = await many(
    `WITH last_sent AS (
       SELECT user_id, max(sent_at) AS at FROM notification
        WHERE state = 'sent' GROUP BY user_id
     ),
     /* N-05 — le silence de nuit, lu dans le fuseau du SITE de la
        personne et non du serveur : une équipe de São Paulo ne dort pas
        aux heures de Zurich. Un message émis pendant le silence n'est pas
        supprimé, il attend le matin. « urgent » passe, parce qu'un
        silence qu'on ne peut pas percer devient un silence qu'on
        désactive. */
     local AS (
       SELECT u.id AS user_id, u.quiet_from, u.quiet_to,
              extract(hour FROM (now() + (coalesce(s.tz_offset, 0) || ' hours')::interval))::int AS hour
         FROM app_user u
         LEFT JOIN person p ON p.id = u.person_id
         LEFT JOIN site   s ON s.id = p.site_id
     )
     SELECT n.id, n.email, n.subject, n.body
       FROM notification n
       LEFT JOIN app_user u ON u.id = n.user_id
       LEFT JOIN last_sent l ON l.user_id = n.user_id
       LEFT JOIN local q ON q.user_id = n.user_id
      WHERE n.state = 'queued'
        AND coalesce(u.notify_pref, 'immediate') <> 'off'
        AND (
          coalesce(u.notify_pref, 'immediate') = 'immediate'
          OR l.at IS NULL
          OR (u.notify_pref = 'daily'  AND l.at < now() - interval '1 day')
          OR (u.notify_pref = 'weekly' AND l.at < now() - interval '7 days')
        )
        AND (
          n.severity = 'urgent'
          OR q.quiet_from IS NULL
          /* la fenêtre peut enjamber minuit : 22 → 6 */
          OR NOT CASE WHEN q.quiet_from <= q.quiet_to
                      THEN q.hour >= q.quiet_from AND q.hour < q.quiet_to
                      ELSE q.hour >= q.quiet_from OR  q.hour < q.quiet_to
                 END
        )
        /* Les abonnements décident enfin de quelque chose.
           La table de 019 était écrite par l'écran et lue par personne :
           un réglage qu'on offre sans le tenir coûte plus cher que de ne
           pas l'offrir. La règle est celle que le comité a posée — un
           abonnement règle ce qui SORT, jamais ce qu'on peut venir
           chercher — donc le centre continue de tout recevoir, et seule
           la remise se laisse filtrer.

           Sans aucun abonnement, la préférence globale du compte
           gouverne, comme avant : la finesse s'ajoute, elle ne devient
           pas une obligation de configurer. */
        AND (
          NOT EXISTS (SELECT 1 FROM notification_subscription s0
                       WHERE s0.user_id = n.user_id AND s0.active)
          OR EXISTS (
            SELECT 1 FROM notification_subscription s
             WHERE s.user_id = n.user_id AND s.active
               AND (s.kind = '*' OR s.kind = n.kind)
               AND CASE s.min_severity
                     WHEN 'urgent'    THEN n.severity = 'urgent'
                     WHEN 'attention' THEN n.severity IN ('attention', 'urgent')
                     ELSE true
                   END
          )
        )
      ORDER BY n.at LIMIT $1`, [limit]);
  let sent = 0, failed = 0;
  for (const m of rows) {
    try {
      await send({ to: m.email, subject: m.subject, body: m.body });
      await query(`UPDATE notification SET state='sent', sent_at=now() WHERE id=$1`, [m.id]);
      sent++;
    } catch (e) {
      await query(`UPDATE notification SET state='failed', error=$2 WHERE id=$1`,
        [m.id, String(e?.message ?? e).slice(0, 500)]);
      failed++;
    }
  }
  return { sent, failed };
}

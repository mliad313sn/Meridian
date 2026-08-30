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
export async function queue({ userId, email, kind, subject, body, entity, entityId, dedupeKey }) {
  if (!email) return false;
  const r = await query(
    `INSERT INTO notification (user_id, email, kind, subject, body, entity, entity_id, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [userId ?? null, email, kind, subject, body, entity ?? "", entityId ?? "", dedupeKey]);
  return (r.rowCount ?? 0) > 0;
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
     )
     SELECT n.id, n.email, n.subject, n.body
       FROM notification n
       LEFT JOIN app_user u ON u.id = n.user_id
       LEFT JOIN last_sent l ON l.user_id = n.user_id
      WHERE n.state = 'queued'
        AND coalesce(u.notify_pref, 'immediate') <> 'off'
        AND (
          coalesce(u.notify_pref, 'immediate') = 'immediate'
          OR l.at IS NULL
          OR (u.notify_pref = 'daily'  AND l.at < now() - interval '1 day')
          OR (u.notify_pref = 'weekly' AND l.at < now() - interval '7 days')
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

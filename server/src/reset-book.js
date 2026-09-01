/**
 * RESET THE BOOK FOR PRODUCTION — remove the demonstration portfolio.
 *
 * The seed ships a fictional bank's book so the access model is visible
 * on first run. The day the module joins the real SDP platform, that
 * book must go: afterwards the ONLY content is what SDP synchronises
 * (sites, people, the ops-strategy programme — contracts C1/C5) plus
 * whatever real work people create here. Where SDP has no data, the
 * screen stays honestly empty.
 *
 * What is deliberately KEPT:
 *   app_user      accounts cannot be deleted once the audit trail cites
 *                 them (the append-only rules refuse the FK's SET NULL —
 *                 finding I-19). Demo accounts are DEACTIVATED instead;
 *                 pass --keep-email=<addr> for the account(s) that stay
 *                 active (default: admin@meridian.example).
 *   app_setting   the federation keys and governance settings.
 *   audit_event   append-only history, by design (R6.2).
 *   board_column  reference data fixed by the delivery method, not demo.
 *   schema        migrations are never rewound.
 *
 * Run:  node server/src/reset-book.js            (uses MERIDIAN_DATABASE_URL / DATABASE_URL / PGlite)
 *       node server/src/reset-book.js --keep-email=ops@example.com
 * Then run the SDP sync (Admin → Meridian → "Sync now", or the 05:00/05:05
 * crons) to bring the real structure in.
 */

import { connect, close, migrate, tx, many } from "./db.js";
import { record } from "./audit.js";

const KEEP = process.argv
  .filter((a) => a.startsWith("--keep-email="))
  .map((a) => a.slice("--keep-email=".length).toLowerCase());
if (!KEEP.length) KEEP.push("admin@meridian.example");

/* PR-01 (comité de recette des processus, docs/32) : cette liste était
   FIGÉE aux migrations ~013, et chaque table née depuis y échappait —
   les leçons, demandes et notifications de démonstration SURVIVAIENT à
   la mise en production (leurs clés étrangères sont SET NULL : rien ne
   casse, tout reste, en orphelin). La liste reste explicite — un geste
   destructeur mérite d'être lisible — mais elle ne peut plus pourrir :
   après le vidage, resetBook RELIT le catalogue et ÉCHOUE en nommant
   toute table métier encore non vide. La migration qui crée une table
   sans l'ajouter ici fera échouer le parcours du comité
   (journey.test.js) au lieu de laisser des restes en production.

   Ce qui est délibérément GARDÉ, avec sa raison :
     app_user          la piste d'audit cite les comptes (I-19) — désactivés
     app_setting       clés de fédération et réglages de gouvernance
     audit_event       append-only par conception (R6.2)
     board_column      référentiel de la méthode, pas de la démo
     id_counter        prérempli par les migrations (leçon M-01)
     integration       configuration d'exploitation, pas contenu de démo
     report_period /   l'histoire RAPPORTÉE est append-only ; une remise à
     report_snapshot   zéro ne réécrit pas ce qui a été présenté
     schema_migration  jamais rejoué
     session           vidée à part, en dernier */
const KEEP_TABLES = new Set([
  "app_user", "app_setting", "audit_event", "board_column", "id_counter",
  "integration", "report_period", "report_snapshot", "schema_migration",
  "session",
]);

/* Enfants avant parents ; toutes les FK croisées sont SET NULL ou CASCADE
   (vérifié au catalogue le 01/09), l'ordre n'a donc qu'une exigence :
   les tables de liaison avant leurs sujets. */
const TABLES = [
  "event_delivery", "notification_subscription", "notification",
  "timesheet", "person_absence", "commitment",
  "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
  "meeting_occurrence", "meeting_series",
  "report_narrative", "work_item", "document", "allocation",
  "change_step", "change_request",
  "project_exception", "project_tolerance", "business_case", "benefit",
  "lesson", "demand",
  "cost_line", "raid_item", "milestone",
  "cross_dep", "activity_dep", "activity", "ext_link",
  "site_window", "rollout_wave", "project",
  "access_grant", "programme", "person", "site",
  "usage_daily",
];

export async function resetBook() {
  const before = await many(
    `SELECT (SELECT count(*)::int FROM project)   AS projects,
            (SELECT count(*)::int FROM site)      AS sites,
            (SELECT count(*)::int FROM person)    AS people,
            (SELECT count(*)::int FROM app_user WHERE active) AS active_users`);
  const counts = before[0];

  await tx(async (t) => {
    for (const tbl of TABLES) await t.query(`DELETE FROM ${tbl}`);
    // Demo accounts stay as history, not as doors (see header).
    await t.query(
      `UPDATE app_user SET active = false, row_version = row_version + 1
        WHERE active AND NOT (lower(email) = ANY($1))`, [KEEP]);
    await t.query(`DELETE FROM session WHERE user_id IN
                     (SELECT id FROM app_user WHERE NOT active)`);
    /* S-10 — the account that survives the reset survives with whatever
       password it had, and on a seeded instance that password is printed
       in the README. Clearing the book is the moment production begins,
       so the surviving holder proves the password is theirs before they
       may write. Existing sessions go too: a reset is a fresh start. */
    await t.query(
      `UPDATE app_user SET must_change_password = true, row_version = row_version + 1
        WHERE active AND lower(email) = ANY($1)`, [KEEP]);
    await t.query(`DELETE FROM session`);
    /* Le garde-fou PR-01 : relire le catalogue et refuser de conclure si
       une table métier a échappé à la liste. Échouer ICI, dans la
       transaction, annule tout le vidage — mieux qu'une production à
       moitié nettoyée. */
    const inventory = await t.query(
      `SELECT table_name AS tbl FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    const listed = new Set(TABLES);
    for (const { tbl } of inventory.rows) {
      if (KEEP_TABLES.has(tbl) || listed.has(tbl)) continue;
      const { rows: [{ n }] } = await t.query(`SELECT count(*)::int AS n FROM ${tbl}`);
      if (n > 0) {
        throw new Error(
          `reset-book : la table ${tbl} (${n} ligne(s)) n'est ni vidée ni déclarée gardée — ` +
          `une migration l'a créée sans mettre cette liste à jour. Rien n'a été vidé.`);
      }
    }
    await record(t, null, {
      action: "Book reset for production",
      entity: "system", entityId: "reset-book",
      detail: `removed ${counts.projects} project(s), ${counts.sites} site(s), ` +
              `${counts.people} person(s); kept ${KEEP.join(", ")} active`,
    });
  });

  const after = await many(
    `SELECT (SELECT count(*)::int FROM app_user WHERE active) AS active_users`);
  return { removed: counts, activeUsers: after[0].active_users };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("reset-book.js")) {
  // Same resolution as mountModule: the module's own database first.
  await connect({ url: process.env.MERIDIAN_DATABASE_URL || process.env.DATABASE_URL || null });
  await migrate({ silent: true });
  const r = await resetBook();
  console.log(`Book reset. Removed ${r.removed.projects} projects / ${r.removed.sites} sites / ` +
              `${r.removed.people} people; ${r.activeUsers} active account(s) remain.`);
  console.log("Now run the SDP sync to bring the real structure in.");
  await close();
}

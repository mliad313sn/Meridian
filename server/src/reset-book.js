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

/* Children before parents; person before site (RESTRICT). ext_link goes
   with its projects but is listed for clarity. */
const TABLES = [
  "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
  "meeting_occurrence", "meeting_series",
  "report_narrative", "work_item", "document", "allocation",
  "change_step", "change_request", "raid_item", "cost_line", "milestone",
  "cross_dep", "activity_dep", "activity", "ext_link", "project",
  "access_grant", "programme", "person", "site",
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

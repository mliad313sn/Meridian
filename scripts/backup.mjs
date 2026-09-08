/**
 * `npm run backup` — take a backup of the live book (I-6 · G-01 · SaaS-03).
 *
 *   PostgreSQL (DATABASE_URL set)  pg_dump --format=custom → MERIDIAN_BACKUP_DIR
 *   PGlite                          the data directory as a .tar.gz — STOP the
 *                                   server first: PGlite is single-process.
 *
 * Schedule it (cron, Task Scheduler) and run `npm run restore-drill` on the
 * result at least monthly; /api/health reports the last proven restore.
 */
import { connect, close, engine } from "../server/src/db.js";
import { backup } from "../server/src/backup.js";

await connect();
try {
  const out = await backup();
  console.log(`  ${out.engine}  →  ${out.file}  (${(out.bytes / 1024).toFixed(0)} KB)`);
  if (engine() === "pglite") console.log("  PGlite: this backup was taken with the server stopped — keep it that way for the next one.");
} catch (e) {
  console.error(`  backup failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

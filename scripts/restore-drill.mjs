/**
 * `npm run restore-drill -- <backup file>` — prove a backup restores (I-6 · G-01).
 *
 * Reloads the file SOMEWHERE ELSE (a throwaway database on the same
 * PostgreSQL cluster, or an in-memory PGlite), recounts every table,
 * compares with the live book, times it, and records the outcome in
 * app_setting `backup.lastDrill` — which /api/health reports. Exit 0 only
 * when the counts match.
 *
 * With no file: the newest file in MERIDIAN_BACKUP_DIR.
 */
import fs from "node:fs";
import path from "node:path";
import { connect, close } from "../server/src/db.js";
import { counts, drill, record } from "../server/src/backup.js";

const dir = process.env.MERIDIAN_BACKUP_DIR || path.join(process.cwd(), "server", ".data", "backups");
let file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file && fs.existsSync(dir)) {
  const newest = fs.readdirSync(dir).filter((f) => /\.(dump|tar\.gz)$/.test(f)).sort().at(-1);
  if (newest) file = path.join(dir, newest);
}
if (!file) {
  console.error("Usage: npm run restore-drill -- <backup file>   (or run `npm run backup` first)");
  process.exit(2);
}

await connect();
try {
  const expected = await counts();
  const out = await drill({ file, expected });
  const saved = await record(out);
  console.log(`  restored ${path.basename(file)} elsewhere in ${out.restoreSeconds}s`);
  if (out.ok) console.log(`  every counted table matches the live book — recorded as the last proven restore (${saved.at})`);
  else {
    console.log("  MISMATCH after restore:");
    for (const m of out.mismatches) console.log(`    ${m.table} — live ${m.expected}, restored ${m.found}`);
  }
  process.exitCode = out.ok ? 0 : 1;
} catch (e) {
  console.error(`  drill failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

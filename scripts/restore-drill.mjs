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
import { connect, close, bookHolder } from "../server/src/db.js";
import { counts, drill, record } from "../server/src/backup.js";
import { loadEnv, resolveDataDir } from "../server/src/env.js";

/* `.env` AVANT toute lecture d'environnement — MERIDIAN_BACKUP_DIR se lit
   à la ligne suivante. Sans cela l'épreuve cherchait dans le répertoire
   par défaut, ne trouvait pas la sauvegarde qui venait d'être écrite, et
   répondait « run `npm run backup` first » à qui venait de le faire.
   (Conseiller exploitation nº 3, docs/33 §5.) */
loadEnv();

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

/* PGlite est mono-processus : ouvrir le répertoire de données pendant que
   le serveur tourne est la corruption que restart.sh existe pour éviter.
   On le demande au livre lui-même — quel processus VIVANT le tient — et
   non à une santé sur un port deviné : sur un parc, chaque locataire a le
   sien, et interroger 4173 revenait à demander à quelqu'un d'autre.
   (Conseiller exploitation nº 1, docs/33 §5.) */
if (!process.env.DATABASE_URL) {
  const dir = resolveDataDir();
  const held = bookHolder(dir);
  if (held) {
    console.error(`  process ${held} holds ${dir} and this book is PGlite — stop it first (bash scripts/restart.sh stops gracefully), then run again`);
    process.exit(2);
  }
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

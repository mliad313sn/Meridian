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
import { connect, close, engine, bookHolder } from "../server/src/db.js";
import { backup } from "../server/src/backup.js";
import { loadEnv, resolveDataDir } from "../server/src/env.js";

/* `.env` AVANT toute lecture d'environnement. connect() le chargeait, mais
   trop tard : le garde ci-dessous, MERIDIAN_BACKUP_DIR et PORT se lisent au
   chargement du module. D'où « ce livre est PGlite » sur une base
   PostgreSQL, et une sauvegarde nocturne qui sortait 2 toutes les nuits.
   (Conseiller exploitation nº 2, docs/33 §5.) */
loadEnv();

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
  const out = await backup();
  console.log(`  ${out.engine}  →  ${out.file}  (${(out.bytes / 1024).toFixed(0)} KB)`);
  if (engine() === "pglite") console.log("  PGlite: this backup was taken with the server stopped — keep it that way for the next one.");
} catch (e) {
  console.error(`  backup failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

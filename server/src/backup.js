/**
 * I-6 — LA SAUVEGARDE, ET LA RESTAURATION QUI LA PROUVE
 * (retour de terrain RT365, docs/33 · M-08 · G-01 · SaaS-03)
 *
 * SECURITY.md remet trois constats à l'exploitant : une sauvegarde
 * testée, une seconde instance, une politique écrite. Le terrain a
 * répondu que « yours to close » sans outil est un blanc dans un
 * dossier. Ce module fournit les deux gestes et la trace :
 *
 *   backup()   — PostgreSQL : pg_dump au format custom ; PGlite : le
 *                répertoire de données en archive tar (dumpDataDir).
 *   drill()    — recharge la sauvegarde AILLEURS (une base jetable, ou
 *                une instance PGlite en mémoire), recompte chaque table,
 *                chronomètre, et compare au livre vivant.
 *   record()   — écrit le résultat dans app_setting `backup.lastDrill`,
 *                que /api/health rend : une supervision voit la date de
 *                la dernière restauration ÉPROUVÉE, pas de la dernière
 *                sauvegarde espérée.
 *
 * Ce que ce module n'est pas : une archive (M-01). L'archive emporte
 * tout sans secret pour un successeur ; la sauvegarde emporte tout,
 * secrets compris, pour revenir à hier soir sur CE serveur. Elle ne
 * quitte pas le coffre.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { many, one, query, engine, native, dataDir } from "./db.js";

/* L'épreuve comptait DIX-NEUF tables sur cinquante-deux, et annonçait
   « every counted table matches ». Une sauvegarde qui avait perdu toutes
   les affectations, toutes les feuilles de temps, tous les engagements,
   tous les dossiers d'investissement ou tout le registre des parties
   prenantes sortait 0 : l'épreuve disait « bonne » d'une sauvegarde
   inexploitable. On compte donc ce que le livre contient — TOUTES ses
   tables, découvertes à l'exécution — plutôt qu'une liste écrite une
   fois et jamais rouverte. (Conseiller exploitation nº 10, docs/33 §5.) */
async function countedTables(runner = { query }) {
  const r = await runner.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`);
  return r.rows.map((x) => x.table_name);
}

/** Le compte de chaque table du livre, sur la connexion courante. */
export async function counts(runner = { query }, tables = null) {
  const list = tables ?? await countedTables(runner);
  const out = {};
  for (const t of list) {
    try { out[t] = (await runner.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n; }
    catch { out[t] = null; }
  }
  return out;
}

/** Deux comptes se comparent table par table ; l'écart nomme la table. */
export function compareCounts(expected, found) {
  const mismatches = [];
  for (const [t, n] of Object.entries(expected)) {
    if (n === null) continue;
    if (found[t] !== n) mismatches.push({ table: t, expected: n, found: found[t] ?? null });
  }
  return { ok: mismatches.length === 0, mismatches };
}

/* Le mot de passe ne passe pas par argv (visible dans `ps`) : il va dans
   PGPASSWORD, et l'adresse est donnée sans lui. */
function withoutPassword(url) {
  try {
    const u = new URL(url);
    const env = { ...process.env };
    if (u.password) { env.PGPASSWORD = decodeURIComponent(u.password); u.password = ""; }
    return { dsn: u.toString(), env };
  } catch { return { dsn: url, env: process.env }; }
}

const run = (cmd, args, { env = process.env, input = null } = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { env, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  child.on("error", reject);
  child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.trim()}`))));
  if (input) { child.stdin.write(input); child.stdin.end(); }
});

/**
 * La sauvegarde. Rend { engine, file, bytes, at }.
 *   PostgreSQL : `pg_dump -Fc` vers <dir>/meridian-<stamp>.dump
 *   PGlite     : dumpDataDir() vers <dir>/meridian-<stamp>.tar.gz
 * PGlite est mono-processus : le serveur doit être ARRÊTÉ, ou la
 * sauvegarde prise depuis son propre processus (native()).
 */
export async function backup({ dir = process.env.MERIDIAN_BACKUP_DIR || path.join(process.cwd(), "server", ".data", "backups"),
                               url = process.env.DATABASE_URL, pglite = native() } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (url) {
    const file = path.join(dir, `meridian-${stamp}.dump`);
    const { dsn, env } = withoutPassword(url);
    await run("pg_dump", ["--format=custom", "--no-owner", "--file", file, dsn], { env });
    return { engine: "postgres", file, bytes: fs.statSync(file).size, at: new Date().toISOString() };
  }
  if (!pglite) throw new Error("No PGlite instance to dump — connect() first, or set DATABASE_URL");
  const file = path.join(dir, `meridian-${stamp}.tar.gz`);
  const blob = await pglite.dumpDataDir("gzip");
  fs.writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  return { engine: "pglite", file, bytes: fs.statSync(file).size, at: new Date().toISOString() };
}

/**
 * La restauration éprouvée : recharger AILLEURS, recompter, chronométrer.
 *   PostgreSQL : une base jetable meridian_drill_<stamp> sur le même
 *                cluster (createdb / pg_restore / dropdb).
 *   PGlite     : une instance en mémoire chargée depuis l'archive.
 * `expected` est le compte du livre vivant, pris juste avant.
 */
export async function drill({ file, url = process.env.DATABASE_URL, expected = null } = {}) {
  if (!file || !fs.existsSync(file)) throw new Error(`No such backup file: ${file}`);
  const started = Date.now();
  let found;
  if (url) {
    const scratch = `meridian_drill_${Date.now().toString(36)}`;
    const base = new URL(url);
    const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
    const scratchUrl = new URL(url); scratchUrl.pathname = "/" + scratch;
    const admin = withoutPassword(adminUrl.toString());
    const target = withoutPassword(scratchUrl.toString());
    await run("createdb", ["--maintenance-db", admin.dsn, scratch], { env: admin.env });
    try {
      await run("pg_restore", ["--no-owner", "--dbname", target.dsn, file], { env: target.env });
      const { default: pg } = await import("pg");
      const client = new pg.Client({ connectionString: scratchUrl.toString() });
      await client.connect();
      try { found = await counts(client); } finally { await client.end(); }
    } finally {
      await run("dropdb", ["--maintenance-db", admin.dsn, "--if-exists", scratch], { env: admin.env }).catch(() => {});
    }
    void base;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const bytes = fs.readFileSync(file);
    const blob = new Blob([bytes], { type: "application/x-gzip" });
    const scratch = await PGlite.create({ loadDataDir: blob });
    try { found = await counts(scratch); } finally { await scratch.close(); }
  }
  const restoreSeconds = Math.round((Date.now() - started) / 100) / 10;
  const cmp = expected ? compareCounts(expected, found) : { ok: true, mismatches: [] };
  return { ok: cmp.ok, restoreSeconds, found, mismatches: cmp.mismatches, file, at: new Date().toISOString() };
}

/** Le résultat, écrit là où /api/health le lit. */
export async function record(result) {
  /* Une épreuve RATÉE rafraîchissait quand même la date, si bien qu'une
     épreuve qui échouait tous les mois avait l'air saine : date récente,
     et il fallait lire `ok` pour voir qu'elle ne prouvait rien. On garde
     donc les deux dates — la dernière tentative, et la dernière REUSSIE,
     qui est celle que la santé annonce comme « dernière restauration
     prouvée ». (Conseiller exploitation nº 7, docs/33 §5.) */
  const previous = await lastDrill();
  const value = JSON.stringify({
    at: result.at, ok: result.ok, restoreSeconds: result.restoreSeconds,
    provenAt: result.ok ? result.at : (previous?.provenAt ?? null),
    file: path.basename(result.file ?? ""), mismatches: result.mismatches ?? [],
  });
  await query(
    `INSERT INTO app_setting (key, value) VALUES ('backup.lastDrill', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [value]);
  return JSON.parse(value);
}

/** Ce que la santé a dit — pour les tests et les scripts. */
export async function lastDrill() {
  const row = await one(`SELECT value FROM app_setting WHERE key = 'backup.lastDrill'`);
  if (!row) return null;
  try { return typeof row.value === "string" ? JSON.parse(row.value) : row.value; } catch { return null; }
}

export { engine, dataDir, many };

/**
 * I-1 (retour de terrain RT365, docs/33 · M-01) — l'environnement, lu UNE
 * fois, et le répertoire de données qui a toujours une valeur.
 *
 * Le constat du terrain : « npm install && npm run seed && npm run dev »
 * donnait un livre EN MÉMOIRE. `.env.example` posait PGLITE_DIR, mais
 * rien ne chargeait `.env` ; sans la variable, PGlite s'ouvrait sans
 * répertoire, la graine partait avec le processus et le serveur
 * redémarrait vide. Quarante minutes perdues par chaque nouveau venu,
 * et une perte de données pour qui aurait tenu un vrai livre ainsi.
 *
 * Deux règles, désormais :
 *
 *   · `.env` à la racine du dépôt est chargé s'il existe, sans jamais
 *     écraser une variable déjà posée par le shell — le shell gagne ;
 *   · sans DATABASE_URL, le livre vit dans PGLITE_DIR, et PGLITE_DIR
 *     vaut `server/.data/pgdata` par défaut. La mémoire n'est plus un
 *     repli silencieux : elle se DEMANDE (MERIDIAN_EPHEMERAL=1), et le
 *     serveur le dit au démarrage et dans /api/health.
 */

import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..");
export const DEFAULT_PGLITE_DIR = join(ROOT, "server", ".data", "pgdata");

/* I-9 (M-09) — UN numéro de version, lu dans package.json, annoncé par
   /api/health et par /api/v1/openapi.json. Le terrain a trouvé 5.9.0 dans
   le paquet et 5.3.0 dans le contrat publié : deux artefacts, deux
   vérités. Un paquet livré pose MERIDIAN_VERSION ; sinon c'est celle des
   sources. */
export function packageVersion() {
  if (process.env.MERIDIAN_VERSION) return process.env.MERIDIAN_VERSION;
  try { return JSON.parse(fs.readFileSync(join(ROOT, "package.json"), "utf8")).version; }
  catch { return "dev"; }
}

let loaded = false;

/** Charge `.env` (racine du dépôt) une seule fois ; rend les clés posées. */
export function loadEnv({ file = process.env.MERIDIAN_ENV_FILE || join(ROOT, ".env") } = {}) {
  if (loaded) return [];
  loaded = true;
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const set = [];
  for (const [k, v] of Object.entries(parseEnv(text))) {
    if (process.env[k] === undefined) { process.env[k] = v; set.push(k); }
  }
  return set;
}

/** Pour les tests : oublier qu'on a chargé. */
export function resetEnvLoader() { loaded = false; }

/**
 * Où vit le livre PGlite.
 *
 *   `null`      — en mémoire, explicitement (le harnais de test, ou
 *                 MERIDIAN_EPHEMERAL=1)
 *   un chemin   — sur disque, créé s'il manque (M-02 : PGlite ne crée
 *                 pas les répertoires parents)
 *
 * `explicit` est ce que l'appelant a passé à connect() : `null` veut dire
 * « en mémoire, je sais ce que je fais » ; `undefined` veut dire « décide
 * pour moi ».
 */
export function resolveDataDir(explicit, env = process.env) {
  if (explicit === null) return null;
  if (explicit) return prepared(explicit);
  if (env.MERIDIAN_EPHEMERAL === "1") return null;
  const dir = env.PGLITE_DIR && env.PGLITE_DIR.trim() ? env.PGLITE_DIR.trim() : DEFAULT_PGLITE_DIR;
  return prepared(dir);
}

function prepared(dir) {
  const abs = resolve(ROOT, dir);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

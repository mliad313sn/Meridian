/**
 * M-01 — le chemin de retour.
 *
 *   npm run restore -- meridian-archive-2026-08-30.json
 *   npm run restore -- fichier.json --force     (écrase un livre existant)
 *   npm run restore -- fichier.json --dry-run   (lit et compte, n'écrit rien)
 *   npm run restore -- fichier.json --open admin@exemple.com
 *
 * `--open` rouvre UN compte : l'archive ne porte aucun mot de passe, donc
 * une restauration nue produit une base que personne ne peut ouvrir — ce
 * qui n'est pas une réversibilité, c'est un fichier. Le mot de passe est
 * tiré au sort et affiché une fois ; il n'entre jamais par la ligne de
 * commande, où il resterait dans l'historique du terminal de quelqu'un.
 *
 * Volontairement une commande et pas un bouton. Un export se demande à
 * l'écran ; une restauration se fait sur un serveur, par quelqu'un qui
 * sait sur quelle base il est branché, et qui a une bonne raison. Un
 * bouton « restaurer » dans l'administration est une manière d'effacer un
 * portefeuille en deux clics et une distraction.
 *
 * La base cible est celle de DATABASE_URL — ou PGlite si rien n'est posé,
 * exactement comme le serveur. Les migrations sont appliquées d'abord :
 * une archive se recharge dans un schéma à jour, jamais dans le schéma
 * qu'elle a quitté.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { connect, migrate, close, engine, one } from "../server/src/db.js";
import { setPassword } from "../server/src/auth.js";
import { restoreArchive, validateArchive, verifyRestore } from "../server/src/archive.js";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const openIdx = args.indexOf("--open");
const openEmail = openIdx >= 0 ? args[openIdx + 1] : null;
/* `--open a@b.c` consomme l'argument suivant : il ne doit pas être pris
   pour le nom du fichier. */
const file = positional.find((a) => a !== openEmail);

if (!file) {
  console.error("Usage: npm run restore -- <archive.json> [--force] [--dry-run] [--open <email>]");
  process.exit(2);
}
if (openIdx >= 0 && (!openEmail || openEmail.startsWith("--"))) {
  console.error("--open attend une adresse : --open admin@exemple.com");
  process.exit(2);
}

const full = path.resolve(file);
if (!fs.existsSync(full)) {
  console.error(`Introuvable : ${full}`);
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(full, "utf8"));
  validateArchive(doc);
} catch (e) {
  console.error(`  ${e.message}`);
  process.exit(1);
}

console.log("");
console.log(`  archive     ${path.basename(full)}`);
console.log(`  produite le ${doc.generatedAt} par ${doc.issuedTo}`);
console.log(`  contenu     ${doc.totalRows} ligne(s) · ${doc.order.length} table(s)`);
console.log(`  sans        ${doc.excludes.join(", ")}`);

if (dryRun) {
  console.log("");
  for (const t of doc.order) {
    const n = doc.tables[t].length;
    if (n) console.log(`    ${String(n).padStart(6)}  ${t}`);
  }
  console.log("\n  --dry-run : rien n'a été écrit.\n");
  process.exit(0);
}

await connect();
console.log(`  cible       ${engine()}`);
const applied = await migrate({ silent: true });
if (applied.length) console.log(`  migrations  ${applied.length} appliquée(s)`);

try {
  const out = await restoreArchive(doc, { force });
  const check = await verifyRestore(doc);

  console.log("");
  console.log(`  ${out.totalRows} ligne(s) rechargée(s).`);
  if (check.ok) {
    console.log("  Recompté dans la base : tout y est.");
  } else {
    console.log("  ÉCART APRÈS RELECTURE :");
    for (const m of check.mismatches) {
      console.log(`    ${m.table} — annoncé ${m.expected}, trouvé ${m.found}`);
    }
  }
  console.log("");
  if (openEmail) {
    const u = await one(`SELECT id, display_name FROM app_user WHERE lower(email) = lower($1)`,
      [openEmail]);
    if (!u) {
      console.log(`  --open : aucun compte ${openEmail} dans cette archive.`);
      console.log("  Aucun compte ne peut se connecter.");
    } else {
      /* 24 octets en base64url : assez pour qu'il ne se devine pas, assez
         court pour se retaper une fois. `mustChange` derrière, parce qu'il
         a été affiché sur un terminal. */
      const pw = crypto.randomBytes(18).toString("base64url");
      await setPassword(u.id, pw, { mustChange: true });
      console.log(`  Compte rouvert : ${openEmail} (${u.display_name})`);
      console.log(`  Mot de passe   : ${pw}`);
      console.log("  À changer à la première connexion — il vient de passer par un écran.");
      console.log("  Tous les autres comptes restent fermés.");
    }
  } else {
    console.log("  Aucun compte ne peut se connecter : l'archive ne portait aucun");
    console.log("  mot de passe. Rouvrez-en un avec `--open <email>`, ou posez-le");
    console.log("  depuis l'administration si vous avez déjà un accès.");
  }
  console.log("");
  await close();
  process.exit(check.ok ? 0 : 1);
} catch (e) {
  console.error(`\n  ${e.message}\n`);
  await close();
  process.exit(1);
}

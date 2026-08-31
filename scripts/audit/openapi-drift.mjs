/**
 * F9 · LA DESCRIPTION DE L'API NE DÉRIVE PAS DU CODE
 *
 * Pourquoi cette porte existe.
 *
 * Une description d'API écrite à côté du code se périme, et elle se
 * périme **en silence** : le jour où quelqu'un ajoute une route, la
 * description reste juste-mais-incomplète — ce qui est la pire des deux
 * erreurs, parce qu'elle inspire confiance et ment par omission. Un
 * intégrateur qui la lit croit tenir un contrat ; il tient un instantané.
 *
 * Cette porte compare trois choses qui doivent dire la même :
 *
 *   1. les routes RÉELLEMENT montées sous /api/v1 (lues dans le routeur) ;
 *   2. les routes DÉCRITES à la main dans `openapi.js` ;
 *   3. le fichier `docs/openapi.v1.json` publié dans le dépôt.
 *
 * Une route sans description, une description sans route, ou un fichier
 * publié qui ne correspond plus : la construction échoue. Le fichier se
 * régénère avec `npm run openapi`.
 *
 * Le fichier publié compte autant que le reste : c'est lui qu'un
 * intégrateur lit AVANT d'avoir une instance et une clé. S'il ment, on
 * n'a pas publié un contrat, on a publié une intention.
 */

import fs from "node:fs";
import path from "node:path";
import { mountedRoutes, documented, openApiDocument } from "../../server/src/openapi.js";

const root = path.resolve(import.meta.dirname, "../..");
const published = path.join(root, "docs/openapi.v1.json");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const key = (r) => `${r.method} ${r.path}`;
const mounted = mountedRoutes().map(key);
const described = documented().map(key);

const problems = [];

for (const r of mounted) {
  if (!described.includes(r)) {
    problems.push(`${r} est montée et n'est décrite nulle part — ` +
      `un intégrateur ne peut pas la connaître, et la porte refuse de la taire`);
  }
}
for (const r of described) {
  if (!mounted.includes(r)) {
    problems.push(`${r} est décrite et n'existe pas — ` +
      `la description promet une porte qui n'est pas là`);
  }
}

/* Le fichier publié. Comparé sur le contenu, la version mise de côté :
   un numéro de version qui bouge à chaque livraison ne doit pas faire
   échouer une porte qui surveille la FORME du contrat. */
const strip = (doc) => JSON.stringify({ ...doc, info: { ...doc.info, version: "" } }, null, 2);
const current = openApiDocument({ version: pkg.version });

if (!fs.existsSync(published)) {
  problems.push(`docs/openapi.v1.json est absent — lancez \`npm run openapi\``);
} else {
  const onDisk = JSON.parse(fs.readFileSync(published, "utf8"));
  if (strip(onDisk) !== strip(current)) {
    problems.push(`docs/openapi.v1.json ne correspond plus aux routes — ` +
      `lancez \`npm run openapi\` et relisez le diff avant de le commettre`);
  }
}

console.log("\n═══ F9 · la description de l'API suit les routes ═══\n");
if (!problems.length) {
  console.log(`  · ${mounted.length} route(s) sous /api/v1`);
  console.log("  · chacune décrite, chaque description montée");
  console.log("  · le fichier publié correspond\n");
} else {
  for (const p of problems) console.log(`  ✖ ${p}`);
  console.log("");
}
console.log(`${problems.length} écart(s) entre le code et son contrat.\n`);
process.exit(problems.length ? 1 : 0);

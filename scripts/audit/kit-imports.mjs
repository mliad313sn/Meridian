/**
 * F7 · TOUT AIDE DE KIT QU'UNE VUE EMPLOIE, ELLE L'IMPORTE
 *
 * Pourquoi cette porte existe.
 *
 * `web/src/views/administration.js` appelait `selectField(...)` sans
 * l'avoir importé. En JavaScript, ce n'est pas une erreur de
 * construction : c'est une `ReferenceError` levée au moment où la ligne
 * s'exécute. Le rendu de la vue est enveloppé d'un `try`, qui l'a
 * transformée en « THIS VIEW COULD NOT BE DRAWN ». Résultat : **l'écran
 * d'administration entier était impossible à ouvrir** — comptes, droits,
 * annuaire, reprise CSV, notifications — depuis la toute première
 * livraison du produit.
 *
 * Six portes, 322 tests et un balayage de 286 cas d'usage ne l'ont pas
 * vu, et c'est instructif : les tests parlent à l'API, le balayage aussi.
 * **Rien, dans tout l'outillage, ne dessinait une vue.** Une porte qui
 * mesure ce qu'on sait déjà mesurer laisse exactement ce genre de trou.
 *
 * Ce que la sonde fait, et ce qu'elle ne fait pas. Elle ne remplace pas
 * un analyseur de portée : elle prend les noms que `kit.js` exporte —
 * ceux dont l'oubli casse un écran entier — et vérifie que tout fichier
 * qui les APPELLE les a bien nommés dans son import. C'est étroit, c'est
 * mécanique, et cela ferme la classe entière de défauts dont on vient de
 * payer un exemplaire.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const kitPath = path.join(root, "web/src/ui/kit.js");
const kit = fs.readFileSync(kitPath, "utf8");

/* Les noms exportés par kit.js, tels que le bloc d'export les liste. */
const exportBlock = kit.match(/export\s*\{([\s\S]*?)\}/g) ?? [];
const exported = new Set(
  exportBlock
    .flatMap((b) => b.replace(/export\s*\{|\}/g, "").split(","))
    .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s))
);

const files = [];
for (const dir of ["web/src/views", "web/src/lib", "web/src"]) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith(".js")) files.push(path.join(full, f));
  }
}

const problems = [];

for (const file of [...new Set(files)]) {
  const src = fs.readFileSync(file, "utf8");
  if (path.resolve(file) === path.resolve(kitPath)) continue;
  if (!/from\s+["'][^"']*ui\/kit\.js["']/.test(src)) continue;

  /* Ce que ce fichier a déclaré importer de kit.js. */
  const imports = new Set();
  for (const m of src.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']*ui\/kit\.js["']/g)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) imports.add(name);
    }
  }

  /* Ce qu'il déclare lui-même sous le même nom compte aussi : une vue a
     le droit d'avoir sa propre `table()` locale. */
  const local = new Set();
  for (const m of src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
    local.add(m[1]);
  }

  /* Le corps, sans ses chaînes ni ses commentaires : un nom cité dans une
     phrase n'est pas un appel. */
  const body = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

  for (const name of exported) {
    if (imports.has(name) || local.has(name)) continue;
    /* `$` est écarté : un nom d'un seul caractère se retrouve dans trop de
       constructions légitimes pour qu'une sonde textuelle le distingue, et
       une porte qui crie à tort finit par être ignorée. */
    if (name.length < 3) continue;
    /* Un appel, pas une mention : le nom suivi d'une parenthèse, et non
       précédé d'un point (`obj.table(` est la méthode de quelqu'un). */
    const called = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`, "m");
    if (called.test(body)) {
      const line = body.split("\n").findIndex((l) => called.test(l)) + 1;
      problems.push(
        `${path.relative(root, file).replace(/\\/g, "/")}:${line} ` +
        `appelle ${name}() sans l'importer de kit.js — l'écran ne se dessinera pas`);
    }
  }
}

console.log("\n═══ F7 · les aides de kit employées sont importées ═══\n");
if (!problems.length) {
  console.log(`  · ${exported.size} aides exportées par kit.js`);
  console.log("  · chaque vue qui en appelle une l'a nommée dans son import\n");
} else {
  for (const p of problems) console.log(`  ✖ ${p}`);
  console.log("");
}
console.log(`${problems.length} import(s) manquant(s).\n`);
process.exit(problems.length ? 1 : 0);

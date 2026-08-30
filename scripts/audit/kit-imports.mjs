/**
 * F7 · TOUTE AIDE PARTAGÉE QU'UN FICHIER EMPLOIE, IL L'IMPORTE
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
 * **Rien, dans tout l'outillage, ne dessinait une vue.** (C'est F8 qui
 * dessine désormais ; celle-ci reste parce qu'elle est instantanée et
 * qu'elle nomme le fichier et la ligne plutôt que l'écran.)
 *
 * Ce que la sonde fait, et ce qu'elle ne fait pas. Elle ne remplace pas
 * un analyseur de portée : elle prend les noms exportés par les modules
 * PARTAGÉS du client — ceux dont l'oubli casse un écran entier — et
 * vérifie que tout fichier qui les APPELLE les a bien nommés dans son
 * import. Étroit, mécanique, et cela ferme la classe entière de défauts
 * dont on vient de payer un exemplaire.
 *
 * Elle couvre `kit.js` (le constructeur de DOM et ses aides), mais aussi
 * `engine.js`, `api.js`, `state.js`, `i18n.js` et `permissions.js` : le
 * même oubli sur `fmtDate` ou sur `t` casse un écran exactement de la
 * même manière, et n'aurait pas été vu par une porte qui ne regarde
 * qu'un seul module.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

/** Les modules partagés dont l'oubli d'un nom casse un rendu. */
const SHARED = [
  "web/src/ui/kit.js",
  "web/src/lib/api.js",
  "web/src/lib/i18n.js",
  "web/src/lib/state.js",
  "web/src/lib/permissions.js",
  "shared/engine.js",
];

/** Les noms qu'un module expose, par `export {…}` ou par `export function`. */
function exportsOf(src) {
  const names = new Set();
  for (const block of src.match(/export\s*\{([\s\S]*?)\}/g) ?? []) {
    for (const raw of block.replace(/export\s*\{|\}/g, "").split(",")) {
      const n = raw.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
    }
  }
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  return names;
}

const files = [];
for (const dir of ["web/src/views", "web/src/lib", "web/src", "web/src/ui"]) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith(".js")) files.push(path.join(full, f));
  }
}

const problems = [];
let checked = 0;

for (const modRel of SHARED) {
  const modPath = path.join(root, modRel);
  if (!fs.existsSync(modPath)) {
    problems.push(`${modRel} — module partagé introuvable ; la porte ne le surveille plus`);
    continue;
  }
  const exported = exportsOf(fs.readFileSync(modPath, "utf8"));
  checked += exported.size;
  const base = path.basename(modRel).replace(".", "\\.");
  const fromMod = new RegExp(`from\\s+["'][^"']*${base}["']`);
  const importFrom = new RegExp(
    `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["'][^"']*${base}["']`, "g");

  for (const file of [...new Set(files)]) {
    if (path.resolve(file) === path.resolve(modPath)) continue;
    const src = fs.readFileSync(file, "utf8");
    if (!fromMod.test(src)) continue;

    const imports = new Set();
    for (const m of src.matchAll(importFrom)) {
      for (const raw of m[1].split(",")) {
        const n = raw.trim().split(/\s+as\s+/).pop().trim();
        if (n) imports.add(n);
      }
    }

    /* Ce que le fichier déclare lui-même sous le même nom compte aussi :
       une vue a le droit d'avoir sa propre `table()` locale. */
    const local = new Set();
    for (const m of src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
      local.add(m[1]);
    }
    /* Les méthodes abrégées d'un objet littéral — `can(action) { … }` dans
       `App` — ressemblent à un appel pour une sonde textuelle. Ce sont des
       définitions ; les compter comme locales évite d'accuser un fichier
       de ne pas importer ce qu'il déclare lui-même. */
    for (const m of src.matchAll(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) {
      local.add(m[1]);
    }
    /* Et ce qu'il importe d'ailleurs sous ce nom : `money` peut venir de
       engine.js dans un fichier et de kit.js dans un autre. */
    for (const m of src.matchAll(/import\s*\{([\s\S]*?)\}\s*from/g)) {
      for (const raw of m[1].split(",")) {
        const n = raw.trim().split(/\s+as\s+/).pop().trim();
        if (n) local.add(n);
      }
    }

    /* Le corps, sans ses chaînes ni ses commentaires : un nom cité dans
       une phrase n'est pas un appel. */
    const body = src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
      .replace(/`(?:\\.|[^`\\])*`/g, "``")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");

    for (const name of exported) {
      if (imports.has(name) || local.has(name)) continue;
      /* `$` et consorts sont écartés : un nom d'un ou deux caractères se
         retrouve dans trop de constructions légitimes pour qu'une sonde
         textuelle le distingue, et une porte qui crie à tort finit par
         être ignorée. */
      if (name.length < 3) continue;
      /* Un appel, pas une mention : le nom suivi d'une parenthèse, et non
         précédé d'un point (`obj.table(` est la méthode de quelqu'un). */
      const called = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`, "m");
      if (!called.test(body)) continue;
      const line = body.split("\n").findIndex((l) => called.test(l)) + 1;
      problems.push(
        `${path.relative(root, file).replace(/\\/g, "/")}:${line} ` +
        `appelle ${name}() sans l'importer de ${path.basename(modRel)} — ` +
        `l'écran ne se dessinera pas`);
    }
  }
}

console.log("\n═══ F7 · les aides partagées employées sont importées ═══\n");
if (!problems.length) {
  console.log(`  · ${SHARED.length} modules partagés, ${checked} noms exportés`);
  console.log("  · chaque fichier qui en appelle un l'a nommé dans son import\n");
} else {
  for (const p of problems) console.log(`  ✖ ${p}`);
  console.log("");
}
console.log(`${problems.length} import(s) manquant(s).\n`);
process.exit(problems.length ? 1 : 0);

/**
 * F10 · LA VERSION NE SE CONTREDIT PAS  (I-9 · retour de terrain RT365, M-09)
 *
 * Le terrain a lu 5.9.0 dans package.json et 5.3.0 dans le contrat
 * OpenAPI publié — deux artefacts du même dépôt qui ne disaient pas la
 * même version. La porte F9 comparait la FORME du contrat en mettant le
 * numéro de côté, exprès ; personne ne comparait donc le numéro. Cette
 * porte le fait, et vérifie en même temps ce qu'une livraison doit
 * porter avant d'être étiquetée :
 *
 *   1. docs/openapi.v1.json annonce la version de package.json ;
 *   2. package-lock.json aussi ;
 *   3. CHANGELOG.md a une section « ## [x.y.z] » pour cette version —
 *      ou la version est encore en cours et la section [Unreleased]
 *      n'est pas vide ;
 *   4. le tag git de la version, s'il existe, pointe un commit qui porte
 *      cette même version (vérifié seulement quand `git` répond).
 *
 *   node scripts/audit/release-audit.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const pkg = JSON.parse(read("package.json"));
const problems = [];

/* 1 · le contrat publié */
try {
  const api = JSON.parse(read("docs/openapi.v1.json"));
  if (api.info?.version !== pkg.version) {
    problems.push(`docs/openapi.v1.json annonce ${api.info?.version}, package.json dit ${pkg.version} — ` +
      `lancez \`npm run openapi\``);
  }
} catch (e) { problems.push(`docs/openapi.v1.json illisible : ${e.message}`); }

/* 2 · le verrou des dépendances */
try {
  const lock = JSON.parse(read("package-lock.json"));
  const inLock = lock.version ?? lock.packages?.[""]?.version;
  if (inLock !== pkg.version) {
    problems.push(`package-lock.json porte ${inLock}, package.json dit ${pkg.version} — ` +
      `lancez \`npm install --package-lock-only\``);
  }
} catch (e) { problems.push(`package-lock.json illisible : ${e.message}`); }

/* 3 · le journal des versions */
const changelog = read("CHANGELOG.md");
const hasSection = new RegExp(`^## \\[${pkg.version.replace(/\./g, "\\.")}\\]`, "m").test(changelog);
const unreleased = /## \[Unreleased\]\s*\n([\s\S]*?)\n---/.exec(changelog)?.[1]?.trim() ?? "";
const unreleasedEmpty = !unreleased || /^Nothing yet\.?$/i.test(unreleased);
if (!hasSection && unreleasedEmpty) {
  problems.push(`CHANGELOG.md n'a ni section [${pkg.version}] ni contenu sous [Unreleased] — ` +
    `une version qui ne dit pas ce qu'elle change n'est pas une version`);
}

/* 4 · le tag, quand il existe */
try {
  const tag = `v${pkg.version}`;
  const tags = execSync("git tag --list", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
    .toString().split("\n").map((s) => s.trim()).filter(Boolean);
  if (tags.includes(tag)) {
    const at = execSync(`git show ${tag}:package.json`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
    const tagged = JSON.parse(at).version;
    if (tagged !== pkg.version) {
      problems.push(`le tag ${tag} pointe un package.json en ${tagged}`);
    }
    if (!hasSection) problems.push(`le tag ${tag} existe mais CHANGELOG.md n'a pas de section [${pkg.version}]`);
  }
} catch { /* pas de dépôt git (archive, paquet) : la vérification 4 ne s'applique pas */ }

console.log("\n═══ F10 · une seule version, partout ═══\n");
if (!problems.length) {
  console.log(`  · package.json, package-lock.json et docs/openapi.v1.json disent ${pkg.version}`);
  console.log(hasSection
    ? `  · CHANGELOG.md a sa section [${pkg.version}]`
    : `  · ${pkg.version} est en cours : [Unreleased] dit ce qui change`);
  console.log("");
} else {
  for (const p of problems) console.log(`  ✖ ${p}`);
  console.log("");
}
console.log(`${problems.length} contradiction(s) de version.\n`);
process.exit(problems.length ? 1 : 0);

/**
 * F6 — A-05 · l'aide au champ, comptée.
 *
 * Le comité d'adoption a mesuré 49 aides sur 22 des 58 formulaires, soit
 * 38 %, et posé deux cibles : **80 % des formulaires** en portent au
 * moins une, et **100 % des champs dont la valeur est lue par quelqu'un
 * d'autre que celui qui la saisit** — un motif de refus, une note de
 * décision, une mesure de bénéfice, une justification de re-ligne de
 * base. Ces champs-là ne sont pas des cases : ce sont des phrases que
 * quelqu'un lira des mois plus tard, sans le contexte de celui qui les a
 * écrites.
 *
 * Le comptage est ici pour la même raison que les cinq autres portes :
 * une mesure qu'on refait à la main ne se refait pas.
 *
 *   node scripts/audit/help-coverage.mjs
 */

import fs from "node:fs";
import path from "node:path";

const VIEWS = "web/src/views";
const files = fs.readdirSync(VIEWS).filter((f) => f.endsWith(".js")).map((f) => path.join(VIEWS, f));

/** Un appel de formulaire, et le texte de son corps jusqu'à sa fermeture. */
function formBodies(src) {
  const out = [];
  const re = /\b(formDialog|form)\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex, str = null;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (str) { if (c === "\\") i++; else if (c === str) str = null; }
      else if (c === '"' || c === "'" || c === "`") str = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    out.push({ at: m.index, body: src.slice(m.index, i) });
  }
  return out;
}

/* Les champs dont la valeur est LUE PAR UN AUTRE. Le comité en nomme
   quatre familles ; on les reconnaît par la clé du champ, qui est stable
   à travers les vues. */
const READ_BY_OTHERS = [
  "why", "reason", "rationale", "note", "headline", "detail",
  "benefitNote", "verdict", "overrideWhy", "declineReason", "comment",
];

/* Un formulaire d'édition réutilise souvent les champs de son formulaire
   de création — `fields: benefitFields(...)`. L'aide est alors écrite une
   fois, dans la fonction partagée, et compter le formulaire comme nu
   dirait le contraire de la vérité. On suit donc l'appel. */
function helpThroughHelpers(body, allSrc) {
  for (const m of body.matchAll(/fields\s*:\s*(\w+)\s*\(/g)) {
    const fn = m[1];
    const def = new RegExp(`function\\s+${fn}\\s*\\(|const\\s+${fn}\\s*=`);
    const at = allSrc.search(def);
    if (at < 0) continue;
    /* La fonction tient dans les 3 000 caractères qui suivent sa
       déclaration — assez pour toutes celles de ce codebase. */
    if (/\bhint\s*:/.test(allSrc.slice(at, at + 3000))) return true;
  }
  return false;
}

let forms = 0, withHelp = 0, criticalTotal = 0, criticalWithHelp = 0;
const bare = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const { body } of formBodies(src)) {
    /* Un formulaire est un appel qui déclare des champs. Les autres
       usages de form() (une confirmation sans champ) ne comptent pas. */
    if (!/\bfields\s*:/.test(body)) continue;
    forms++;
    if (/\bhint\s*:/.test(body) || helpThroughHelpers(body, src)) withHelp++;

    for (const fm of body.matchAll(/\{\s*key\s*:\s*"([^"]+)"([\s\S]*?)\}/g)) {
      const key = fm[1];
      if (!READ_BY_OTHERS.includes(key)) continue;
      criticalTotal++;
      if (/\bhint\s*:/.test(fm[2])) criticalWithHelp++;
      else bare.push(`${path.basename(f)} · ${key}`);
    }
  }
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 100);
console.log("═══ F6 · couverture de l'aide au champ (A-05) ═══\n");
console.log(`  formulaires portant au moins une aide : ${withHelp} / ${forms}  (${pct(withHelp, forms)} %, cible 80 %)`);
console.log(`  champs lus par un autre, aidés        : ${criticalWithHelp} / ${criticalTotal}  (${pct(criticalWithHelp, criticalTotal)} %, cible 100 %)`);

let problems = 0;
if (pct(withHelp, forms) < 80) {
  console.log(`\n  ✖ sous la cible de 80 % : ${forms - withHelp} formulaire(s) sans aucune aide`);
  problems++;
}
if (bare.length) {
  console.log("\n  ✖ champs dont un autre lira la valeur, sans aide :");
  bare.forEach((b) => console.log("      · " + b));
  problems++;
}
if (!problems) console.log("\n  · les deux cibles sont tenues.");
console.log(`\n${problems} problème(s) de couverture d'aide.\n`);
process.exit(problems ? 1 : 0);

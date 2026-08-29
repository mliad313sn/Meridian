/**
 * F5 — la langue ne se mélange pas (R-15).
 *
 * Le comité a mesuré 13 vues sur 18 mélangeant français et anglais DANS
 * LA MÊME TUILE. La correction est centralisée (kpiStrip et sectionHead
 * traduisent eux-mêmes ; tData() traduit les fragments composés autour de
 * nombres) ; cette porte vérifie que la couverture ne régresse pas :
 *
 *   1. chaque « aiguille » relevée par le comité — les fragments anglais
 *      trouvés dans l'interface française — est couverte par tData() ;
 *   2. les surfaces qui composent du texte le font via t()/tData(), pas
 *      en concaténant de l'anglais nu dans les tuiles.
 *
 * Ce qu'elle ne peut pas faire : rendre les vues. La mesure au navigateur
 * (boucle de re-test, /goal-reserves étape B) reste l'arbitre final ;
 * cette porte attrape la régression AVANT qu'elle atteigne la boucle.
 *
 *   node scripts/audit/i18n-audit.mjs
 */

import { tData, setLang, FR } from "../../web/src/lib/i18n.js";
import fs from "node:fs";

setLang("fr");
let problems = 0;

/* ── 1 · les aiguilles du comité, plus celles ajoutées depuis ──────── */
const NEEDLES = [
  "behind the plan", "against budget", "approved envelope", "1 funded project",
  "3 open items", "no data", "2 evidence items outstanding for Gate 1",
  "awaiting a decision", "62% of target", "not yet measured",
  "across the portfolio", "was due 2026-08-01", "(in 3 days)", "(4 days ago)",
  "spending faster than earning", "inside the envelope", "over the spend rate",
  "18d late", "2 projects below the red SPI line", "at steering level",
  "above the escalation threshold",
];
/* Uniquement des mots qui n'existent PAS en français — « plan », « budget »
   ou « rate » y sont des mots légitimes et fausseraient le détecteur. */
const EN_WORD = /\b(the|and|with|for|not|due|against|open|items?|days?|approved|outstanding|awaiting|target|measured|across|funded|evidence|late|below|level|threshold|spending|earning)\b/;

console.log("═══ F5 · couverture de traduction des fragments (R-15) ═══\n");
for (const n of NEEDLES) {
  const out = tData(n);
  if (out === n || EN_WORD.test(out)) {
    console.log(`  ✖ non couvert : « ${n} » → « ${out} »`);
    problems++;
  }
}
if (!problems) console.log(`  · ${NEEDLES.length} aiguilles couvertes par tData()`);

/* ── 2 · les tuiles ne portent pas d'anglais nu hors du canal ──────
   kpiStrip traduit `label` et `note` quand ce sont des chaînes. Un
   contournement serait de passer un NŒUD déjà composé en anglais :
   h("span", …, "x funded"). On attrape le motif le plus probable — un
   littéral anglais passé à note:/label: comme APPEL h() — sans interdire
   les nœuds légitimes (valeurs, tags). */
const files = fs.readdirSync("web/src/views").filter(f => f.endsWith(".js"))
  .map(f => "web/src/views/" + f);
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/note:\s*h\(\s*"[^"]+"\s*,[^)]*"((?:[A-Za-z][a-z]+ ){2,}[a-z]+)"/g)) {
    console.log(`  ✖ ${f}: une note composée en h() porte de l'anglais nu — « ${m[1]} » — passer par t()/tData()`);
    problems++;
  }
}

/* ── 3 · TOUT libellé passé à t() a une entrée au dictionnaire ──────
   La boucle de re-test (tour 1) a trouvé « Record effort » affiché en
   anglais dans l'interface française : le libellé était bien enveloppé
   dans t(), mais le dictionnaire n'avait pas suivi la phase 4 — et le
   repli silencieux vers l'anglais a masqué le trou jusqu'au navigateur.
   Cette section rend le trou impossible : un t("…") sans entrée FR est
   une erreur de build, pas une découverte d'utilisateur. */
function walk(dir, into) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + f.name;
    if (f.isDirectory()) walk(p, into);
    else if (f.name.endsWith(".js")) into.push(p);
  }
  return into;
}
const T_CALL = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*[),]/g;
let missing = 0;
for (const f of walk("web/src", [])) {
  if (f.endsWith("lib/i18n.js")) continue;
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(T_CALL)) {
    const q = m[1];
    const lit = q[0] === '"' ? JSON.parse(q) : q.slice(1, -1).replace(/\\'/g, "'");
    if (lit && /[A-Za-z]{2}/.test(lit) && !(lit in FR)) {
      console.log(`  ✖ ${f}: t(${JSON.stringify(lit)}) sans entrée au dictionnaire FR`);
      problems++; missing++;
    }
  }
}
if (!missing) console.log("  · chaque libellé t() du client a son entrée FR");

/* ── 4 · le dictionnaire reste sain ────────────────────────────────── */
const dupes = new Set();
const seen = new Set();
for (const k of Object.keys(FR)) {
  if (seen.has(k)) dupes.add(k);
  seen.add(k);
  if (FR[k] === "" || FR[k] == null) { console.log(`  ✖ entrée vide : « ${k} »`); problems++; }
}

console.log(`\n${problems} problème(s) de langue.\n`);
process.exit(problems ? 1 : 0);

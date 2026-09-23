/**
 * F15 · THE PUBLIC RECORD COUNTS WHAT THE TREE HOLDS  (docs/36 C-06)
 *
 * The campaign's closing test for wave 0 is "a stranger's clone matches
 * every number in the README". On 23/09 it did not: the README said twelve
 * gates when there were thirteen, SECURITY.md said "334 tests, eight static
 * gates" (there were 840 and thirteen), and CONTRIBUTING said ten. Each
 * number had been typed once, true, and never read again.
 *
 * This gate reads the numbers the three front-door documents state and
 * compares each with the tree:
 *
 *   gates    the static gates `npm run audit` runs (counted in package.json)
 *   tests    `test(` calls at the start of a line in server/test/*.test.js —
 *            the same number node --test reports today; if the two ever
 *            part, this gate's method is what must change, and it says so
 *   tables   CREATE TABLE statements across server/migrations
 *   migrations  the highest migration number ("001–053")
 *
 * A number written in words ("thirteen gates") counts too. A historical
 * number is allowed only on a line that says it is history (a version or a
 * date on the same line), because "816 on the 5.17.0 tree" is true forever.
 *
 *   node scripts/audit/public-record.mjs
 */

import fs from "node:fs";

const FILES = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const num = (w) => (/^\d+$/.test(w) ? Number(w) : WORDS[w.toLowerCase()]);

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const auditCmd = pkg.scripts.audit;
const tests = fs.readdirSync("server/test").filter((f) => f.endsWith(".test.js"))
  .map((f) => fs.readFileSync(`server/test/${f}`, "utf8"))
  .reduce((n, src) => n + (src.match(/^\s*test\(/gm) ?? []).length, 0);
const migrations = fs.readdirSync("server/migrations").filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const truth = {
  gates: (auditCmd.match(/node scripts\/audit\/\S+\.mjs/g) ?? []).length + (auditCmd.includes("audit:views") ? 1 : 0),
  tests,
  tables: migrations.map((f) => fs.readFileSync(`server/migrations/${f}`, "utf8"))
    .reduce((n, s) => n + (s.match(/CREATE TABLE/g) ?? []).length, 0),
  lastMigration: migrations.at(-1).slice(0, 3),
};

const N = "(\\d+|" + Object.keys(WORDS).join("|") + ")";
const CLAIMS = [
  { what: "gates", re: new RegExp(`\\b${N}\\s+(?:static\\s+)?gates\\b`, "gi") },
  { what: "tests", re: new RegExp(`\\b${N}\\s+tests\\b`, "gi") },
  { what: "tables", re: new RegExp(`\\b${N}[- ]tables?\\b`, "gi") },
];
const HISTORY = /\b(?:v?\d+\.\d+\.\d+|\d{2}\/\d{2}(?:\/\d{4})?|20\d\d-\d\d-\d\d)\b/;

console.log("\n═══ F15 · the public record counts what the tree holds ═══\n");
console.log(`  · the tree: ${truth.gates} static gates · ${truth.tests} tests · ${truth.tables} tables · migrations 001–${truth.lastMigration}`);

const wrong = [];
let read = 0;
/* Read as one text, not line by line: "fails on twelve static⏎gates" is a
   claim split by a line wrap, and the first version of this gate read the
   README line by line and did not see it (measured, 23/09). */
for (const file of FILES) {
  const text = fs.readFileSync(file, "utf8");
  const lineOf = (at) => text.slice(0, at).split("\n").length;
  const lineText = (at) => text.split("\n")[lineOf(at) - 1];
  for (const { what, re } of CLAIMS) {
    for (const m of text.matchAll(re)) {
      const n = num(m[1]);
      if (n === undefined) continue;
      read++;
      if (n === truth[what]) continue;
      if (HISTORY.test(lineText(m.index))) continue;
      wrong.push(`${file}:${lineOf(m.index)} says ${m[0].replace(/\s+/g, " ").trim()} — the tree has ${truth[what]}`);
    }
  }
  for (const m of text.matchAll(/\b001[–-](\d{3})\b/g)) {
    read++;
    if (m[1] !== truth.lastMigration) wrong.push(`${file}:${lineOf(m.index)} says migrations 001–${m[1]} — the tree ends at ${truth.lastMigration}`);
  }
}

wrong.forEach((w) => console.log("  ✖ " + w));
console.log(`\n  · ${read} number(s) read in ${FILES.join(", ")}`);
console.log(`\n${wrong.length} number(s) the tree does not hold.`);
if (wrong.length) process.exit(1);

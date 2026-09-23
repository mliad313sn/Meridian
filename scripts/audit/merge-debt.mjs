/**
 * F14 · NO PROVEN LINE WAITS ON A BRANCH  (docs/36 C-05)
 *
 * On 23/09/2026 the product anyone cloned (main, 5.9.0) could not import
 * its own export, while four unreleased lines carried the fix. The oldest
 * had waited 23 days; the RT365 line held 20 commits and 770 tests that
 * nobody who cloned could reach, and three field programmes had each
 * rediscovered defects another had already fixed. Every gate was green on
 * every branch, because no gate asked the one question that mattered:
 * *is anything proven still waiting to reach the default branch?*
 *
 * This gate asks it. A remote branch is MERGE DEBT when all three hold:
 *
 *   · it is ahead of the default branch (it carries commits main does not);
 *   · those commits touch product code (server/, shared/, web/, scripts/,
 *     package.json) — a branch of notes is not a product nobody can reach;
 *   · its tip is older than seven days.
 *
 * Debt fails the build and is named: branch, age, commits ahead. A branch
 * that must NOT be merged — its content was carried over by other means —
 * is declared in docs/superseded-branches.json with the tip it was judged
 * at and the docs/36 line that judged it. A new commit on that branch is
 * a new tip, and it is debt again until someone looks.
 *
 * No network is used: it reads the refs the checkout has. CI fetches all
 * of them (fetch-depth: 0). Without the default branch it exits 2, like
 * F12, rather than report a comparison it did not make.
 *
 *   node scripts/audit/merge-debt.mjs [--now YYYY-MM-DD] [--days 7]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const NOW = arg("--now") ? new Date(arg("--now") + "T23:59:59Z") : new Date();
const DAYS = Number(arg("--days") ?? 7);
const PRODUCT = /^(server|shared|web|scripts)\/|^package(-lock)?\.json$/;

const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };

console.log("\n═══ F14 · no proven line waits on a branch ═══\n");

const base = ["origin/main", "main"].find((r) => tryGit("rev-parse", "--verify", "-q", r + "^{commit}"));
if (!base) {
  console.log("  ✖ the default branch is not in this checkout — nothing was compared.");
  console.log("\n2 · comparison not possible — this is not a pass. Fetch it (fetch-depth: 0 in CI).");
  process.exit(2);
}

const superseded = new Map(
  JSON.parse(fs.readFileSync("docs/superseded-branches.json", "utf8")).branches
    .map((b) => [b.branch, b]));

const refs = (tryGit("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin") ?? "")
  .split("\n").filter((r) => r && r !== "origin/HEAD" && r !== "origin" && r !== base);

let debt = 0, ahead = 0, declared = 0;
for (const ref of refs) {
  const n = Number(tryGit("rev-list", "--count", `${base}..${ref}`) ?? 0);
  if (!n) continue;
  ahead++;
  const branch = ref.replace(/^origin\//, "");
  const tip = git("rev-parse", ref);
  const when = new Date(git("log", "-1", "--format=%cI", ref));
  const age = Math.floor((NOW - when) / 86400000);
  const files = (tryGit("diff", "--name-only", `${base}...${ref}`) ?? "").split("\n").filter(Boolean);
  const product = files.filter((f) => PRODUCT.test(f)).length;
  const s = superseded.get(branch);
  const line = `${branch} — ${n} commit(s) ahead, tip ${tip.slice(0, 7)} ${age} day(s) old, ${product} product file(s)`;
  if (s && s.tip === tip) { declared++; console.log(`  · superseded: ${line} (${s.line}: ${s.reason})`); continue; }
  if (s) console.log(`  ! ${branch} was declared superseded at ${s.tip.slice(0, 7)} and has moved since`);
  if (!product) { console.log(`  · notes only: ${line}`); continue; }
  if (age <= DAYS) { console.log(`  · in flight: ${line}`); continue; }
  debt++;
  console.log(`  ✖ MERGE DEBT: ${line}`);
}

console.log(`\n  · ${refs.length} remote branch(es) read against ${base}; ${ahead} ahead; ${declared} declared superseded`);
console.log(`\n${debt} line(s) of merge debt.`);
if (debt) {
  console.log("A proven line reaches main through a pull request, or it is declared superseded in\n" +
    "docs/superseded-branches.json with the docs/36 line that decided it.");
  process.exit(1);
}

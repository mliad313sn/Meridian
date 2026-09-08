/**
 * The Product Owner's review of the RT365 repository (docs/33 §4).
 *
 *   node scripts/rt365-review.mjs [--repo owner/name] [--dir <clone dir>]
 *
 * Fetches EVERY branch of the field repository (the default branch is not
 * where its Meridian material lives), extracts every line that names
 * Meridian — assessment findings M-nn / I-nn, RAID rows O-nn, human acts
 * H-nn, decisions D-nnn, ADRs — and prints what docs/requests/rt365.json
 * does not yet carry, so that a request written over there cannot go
 * unseen over here. Network is needed; the script says so when it is not.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const repo = opt("--repo", "mliad313sn/RT365");
const dir = opt("--dir", path.join(os.tmpdir(), "meridian-rt365-review"));
const root = path.resolve(import.meta.dirname, "..");
const register = JSON.parse(fs.readFileSync(path.join(root, "docs/requests/rt365.json"), "utf8"));

const sh = (cmd, cwd = dir) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

if (!fs.existsSync(path.join(dir, ".git"))) {
  fs.mkdirSync(dir, { recursive: true });
  try { sh(`git clone --quiet --depth 1 --no-single-branch https://github.com/${repo} .`); }
  catch (e) { console.error(`cannot reach ${repo}: ${e.message.split("\n")[0]}`); process.exit(2); }
} else {
  try { sh("git fetch --quiet --depth 1 origin '+refs/heads/*:refs/remotes/origin/*'"); }
  catch (e) { console.error(`cannot fetch ${repo}: ${e.message.split("\n")[0]}`); process.exit(2); }
}

const branches = sh("git for-each-ref --format='%(refname:short) %(objectname:short)' refs/remotes/origin")
  .split("\n").map((l) => l.trim().replace(/'/g, "")).filter(Boolean)
  .map((l) => { const [ref, sha] = l.split(" "); return { ref, sha }; })
  .filter((b) => !b.ref.endsWith("/HEAD"));

const known = new Set(register.requests.flatMap((r) => r.origin));
const ID = /\b(M-\d{2}|I-\d{1,2}|O-\d{2,3}|H-\d{2}|D-\d{3}|ADR-\d{3}|PR-\d{2})\b/g;
const seen = new Map();   // id → { where, text }

for (const b of branches) {
  let files;
  try { files = sh(`git ls-tree -r --name-only ${b.ref}`).split("\n").filter(Boolean); } catch { continue; }
  for (const f of files) {
    if (!/\.(md|py|json|yaml|yml|txt)$/i.test(f)) continue;
    let text;
    try { text = sh(`git show ${b.ref}:${f}`); } catch { continue; }
    if (!/meridian/i.test(text)) continue;
    for (const line of text.split("\n")) {
      if (!/meridian/i.test(line)) continue;
      for (const m of line.matchAll(ID)) {
        const id = m[1];
        if (!seen.has(id)) seen.set(id, { where: `${b.ref}:${f}`, text: line.trim().slice(0, 160) });
      }
    }
  }
}

console.log(`\n═══ RT365 review · ${repo} · ${branches.length} branch(es) ═══\n`);
for (const b of branches) console.log(`  · ${b.ref} @ ${b.sha}`);
console.log(`\n  register: ${register.requests.length} request(s), reviewed ${register.source.reviewedAt} at ${register.source.commit.slice(0, 7)}`);

const missing = [...seen.entries()].filter(([id]) => !known.has(id) && !/^(D-|ADR-|PR-)/.test(id));
const context = [...seen.entries()].filter(([id]) => /^(D-|ADR-|PR-)/.test(id) && !known.has(id));
if (!missing.length) console.log("\n  · every M / I / O / H line that names Meridian is in the register");
else {
  console.log(`\n  ✖ ${missing.length} line(s) name Meridian and are NOT in the register:`);
  for (const [id, { where, text }] of missing) console.log(`    ${id}  (${where})\n        ${text}`);
}
if (context.length) {
  console.log(`\n  · decisions / ADRs naming Meridian, for context (${context.length}):`);
  for (const [id, { where }] of context) console.log(`    ${id}  (${where})`);
}
const head = branches.find((b) => b.ref.includes(register.source.branch.split("/").pop()));
if (head && !register.source.commit.startsWith(head.sha)) {
  console.log(`\n  ! ${register.source.branch} moved: register reviewed ${register.source.commit.slice(0, 7)}, branch is at ${head.sha} — read the diff`);
}
console.log("");
process.exit(missing.length ? 1 : 0);

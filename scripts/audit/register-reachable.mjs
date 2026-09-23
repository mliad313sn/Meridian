/**
 * F12 · WHAT THE REGISTER CALLS DONE, AN ADOPTER CAN REACH  (REQ-32 · RT365)
 *
 * The field repository cloned the default branch, followed the README and
 * got 5.9.0: no `docs/requests/` at all, a seed that reported success and
 * wrote nothing to disk, `Cannot GET /`, and a published admin password
 * that answered 401. Twenty-three requests in this register say `done`
 * and name the files that made them true. Every one of those files was on
 * a branch. Their sentence, and it is the right one: *a strength they
 * cannot reach is not a strength they will believe.*
 *
 * Nothing here would have noticed. F10 checks that one version is stated
 * everywhere; F11 checks that the register matches its published shape.
 * Neither asks the only question an adopter asks — whether the branch
 * they clone carries the thing the register says was delivered. This gate
 * asks it.
 *
 * WHAT IT READS. Every `delivered` and `measure` entry on a request whose
 * status is `done`. Those fields are prose, not path lists — they hold
 * "server/src/portfolio.js (ladderDiffers)", "PUT /api/v1/benefits/
 * {externalId}" and "17 files" side by side — so a token counts as a path
 * claim only when its first segment is a real top-level entry of the
 * repository — with one deliberate exception: a token carrying a source
 * extension is judged wherever it points, anchored or not, because
 * otherwise deleting the last file under `server/` would retire every
 * claim about it in silence. A token with an extension must name a file;
 * one without (`server/migrations/042`, `docs/en/`) must match a directory
 * or prefix a filename beside it. Entries that hold no path are counted as
 * prose, out loud, so this gate's number is never mistaken for the number
 * of lines in the register.
 *
 * WHAT IT DECIDES. Two faults, never confused:
 *
 *   MISSING   named by no tree the gate can see — the register names a
 *             file that is not there. A failure on every branch, because
 *             it is a false claim wherever it is read.
 *   UNMERGED  in this working tree, absent from the default branch —
 *             built, and unreachable by anyone who clones. This is
 *             REQ-32's fault, and where the gate runs decides the
 *             verdict: on the default branch it fails, because that is
 *             what an adopter gets; on a branch ahead of it, it is the
 *             merge debt this branch carries — reported, counted, named
 *             with the commit distance, exit 0, because a branch is
 *             allowed to be ahead. `--strict` fails anywhere, which is
 *             how you ask "would the default branch be honest today?"
 *             from wherever you happen to be standing. A tag build
 *             (GITHUB_REF_TYPE=tag) is strict without being asked: a tag
 *             is a release claim, and `v5.10.0` was tagged on a commit
 *             the default branch did not carry.
 *
 * WHAT IT DOES WHEN IT CANNOT SEE THE DEFAULT BRANCH. It says so in its
 * header, in its summary and in its exit code, and it never reports a
 * clean comparison it did not make. No network is used or needed: the ref
 * is read from the local object store, and when this checkout IS the
 * default branch there is nothing to fetch — the working tree is the
 * answer. A shallow single-branch checkout of some other branch cannot
 * answer the question at all; that exits 2, distinct from a violation,
 * and names the ways to fix it.
 *
 *   node scripts/audit/register-reachable.mjs
 *   node scripts/audit/register-reachable.mjs --strict
 *   MERIDIAN_DEFAULT_BRANCH=main node scripts/audit/register-reachable.mjs
 *   MERIDIAN_DEFAULT_BRANCH=. node scripts/audit/register-reachable.mjs   # "this tree is it"
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "docs/requests");
const SCHEMA_ID = "meridian-request-register/1";
const STATUS = "done";
/* A tag is a release claim, and a release claim about work that is not on
   the default branch is the exact fault REQ-32 names — `v5.10.0` was
   tagged on an unmerged commit and the register still reads
   `released: false` on every line. So a tag build is strict whether or
   not anyone remembered to ask for it. */
const onTag = process.env.GITHUB_REF_TYPE === "tag";
const strict = process.argv.includes("--strict") || onTag;

/* Extensions that make a token a claim about one file rather than a
   prefix. Explicit on purpose: `raid_item.cr_id` and
   `activity.progress_source` are column names, never filenames. */
const EXT = /\.(js|mjs|cjs|sql|json|md|yml|yaml|css|html|ts|sh|ps1|py)$/;

const git = (...a) => execFileSync("git", a, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
const lines = (s) => (s ?? "").split("\n").filter(Boolean);

/* ── 1 · which branch is the default one, and can this checkout see it? ──
   In order: an explicit assertion, an explicit override, the recorded
   symref, the conventional names. Whatever answers, the gate prints
   where the answer came from — that sentence is half the point of it. */
const ASSERT_HERE = process.env.MERIDIAN_DEFAULT_BRANCH?.trim() === ".";
const inRepo = tryGit("rev-parse", "--git-dir") !== null;

function resolveDefault() {
  if (ASSERT_HERE) return { ref: null, how: "MERIDIAN_DEFAULT_BRANCH=. — this tree is asserted to be the default branch" };
  if (!inRepo) return { ref: null, how: "no git repository — an exported source tree has no branches" };

  const tries = [];
  const env = process.env.MERIDIAN_DEFAULT_BRANCH?.trim();
  if (env) tries.push([env, `MERIDIAN_DEFAULT_BRANCH=${env}`]);
  const cfg = tryGit("config", "--get", "meridian.defaultBranch")?.trim();
  if (cfg) tries.push([cfg, `git config meridian.defaultBranch=${cfg}`]);
  const base = process.env.GITHUB_BASE_REF?.trim();
  if (base) tries.push([`origin/${base}`, `GITHUB_BASE_REF=${base}`], [base, `GITHUB_BASE_REF=${base}`]);
  const sym = tryGit("symbolic-ref", "--short", "refs/remotes/origin/HEAD")?.trim();
  if (sym) tries.push([sym, `refs/remotes/origin/HEAD -> ${sym}`]);
  tries.push(
    ["origin/main", "the conventional name origin/main"],
    ["origin/master", "the conventional name origin/master"],
    ["main", "the local branch main"],
    ["master", "the local branch master"],
  );

  for (const [ref, how] of tries) {
    const sha = tryGit("rev-parse", "--verify", "--quiet", `${ref}^{commit}`)?.trim();
    if (sha) return { ref, sha, how };
  }
  return { ref: null, how: "no branch named main or master is present in this checkout" };
}

const def = resolveDefault();

/* Every file this working tree holds — the tracked list when there is a
   repository, a walk when there is not. Both checks then ask the same
   question of two lists, which is what keeps MISSING and UNMERGED apart. */
function walk(rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "dist") continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const hereFiles = new Set(inRepo ? lines(tryGit("ls-files")) : walk());

/* ── 2 · what to compare against ────────────────────────────────────── */
let mode, thereFiles = null, ahead = 0, behind = 0;
const headSha = inRepo ? tryGit("rev-parse", "HEAD")?.trim() : null;

if (ASSERT_HERE) {
  mode = "on-default";
  thereFiles = hereFiles;
} else if (def.ref) {
  const ls = tryGit("ls-tree", "-r", "--name-only", def.ref);
  if (ls === null) {
    mode = "unreachable";
  } else {
    thereFiles = new Set(lines(ls));
    const c = tryGit("rev-list", "--left-right", "--count", `${def.ref}...HEAD`)?.trim().split(/\s+/);
    behind = Number(c?.[0] ?? 0);
    ahead = Number(c?.[1] ?? 0);
    mode = def.sha === headSha || ahead === 0 ? "on-default" : "ahead";
  }
} else {
  mode = "unreachable";
}

/* ── 3 · does a tree satisfy a claim ────────────────────────────────── */
const satisfies = (files, rel, exact) => {
  if (files.has(rel)) return true;
  if (exact) return false;
  const d = path.posix.dirname(rel), b = path.posix.basename(rel);
  for (const f of files) {
    if (f.startsWith(`${rel}/`)) return true;                                  // a directory
    if (path.posix.dirname(f) === d && path.posix.basename(f).startsWith(b)) return true;  // a filename prefix
  }
  return false;
};

/* ── 4 · the anchors, so prose stays prose ──────────────────────────── */
const anchors = new Set([...hereFiles, ...(thereFiles ?? [])].map((f) => f.split("/")[0]));

/** Pull repository path claims out of one free-form register string. */
function claimsIn(text) {
  const out = [];
  for (let tok of String(text).split(/[\s,;]+/)) {
    tok = tok.replace(/^[("'[`]+/, "").replace(/[)"'\].,;:`]+$/, "").split("#")[0].replace(/\/+$/, "");
    if (!tok.includes("/")) continue;
    if (tok.startsWith("/") || /[{}*?:<>|]/.test(tok)) continue;   // API routes, globs, placeholders
    /* A token carrying a source extension is a claim about one file and is
       judged as one wherever it points — anchoring it to a top-level entry
       that still exists would mean a DELETION quietly retired the claim,
       which is the exact silence this gate exists to break. A token with no
       extension is a prefix, and those are loose enough that they must be
       anchored or every sentence with a slash in it becomes a finding. */
    const exact = EXT.test(tok);
    if (!exact && !anchors.has(tok.split("/")[0])) continue;
    out.push({ rel: tok, exact });
  }
  return out;
}

/* ── 5 · read every register, judge every done request ──────────────── */
console.log(`\n═══ F12 · every ${STATUS} request names files the default branch carries ═══\n`);

const missing = [];   // named nowhere — a false claim on any branch
const unmerged = [];  // built here, absent there — REQ-32's fault
let done = 0, claims = 0, prose = 0;

const registers = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "register.schema.json").sort()
  : [];

if (!registers.length) {
  console.log("  ✖ docs/requests/ holds no register — there is nothing to hold the branch to");
  console.log("\n1 unreachable claim(s): a repository that answers a field repository keeps its register in the tree.\n");
  process.exit(1);
}

for (const f of registers) {
  const rel = `docs/requests/${f}`;
  let register;
  try { register = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
  catch (e) { missing.push(`${rel} is not readable JSON: ${e.message}`); continue; }
  if (register.$schema !== SCHEMA_ID) continue;   // F11 owns that complaint

  for (const r of register.requests ?? []) {
    if (r.status !== STATUS) continue;
    done++;
    for (const [field, values] of [["delivered", r.delivered ?? []], ["measure", r.measure ? [r.measure] : []]]) {
      for (const v of values) {
        const found = claimsIn(v);
        if (!found.length) { prose++; continue; }
        for (const { rel: p, exact } of found) {
          claims++;
          if (thereFiles && satisfies(thereFiles, p, exact)) continue;
          const hereToo = satisfies(hereFiles, p, exact);
          (hereToo ? unmerged : missing).push(`${rel} · ${r.id} (${field}): ${p}`);
        }
      }
    }
  }
}

/* ── 6 · say what was compared, then what was found ─────────────────── */
const compared = {
  "on-default": () => `this tree — it IS the default branch${def.ref ? ` (${def.ref} @ ${def.sha.slice(0, 7)})` : ""}, and it is what an adopter clones`,
  ahead: () => `${def.ref} @ ${def.sha.slice(0, 7)} — ${ahead} commit(s) behind this branch${behind ? `, ${behind} ahead of it` : ""}`,
  unreachable: () => "NOTHING — the default branch is not present in this checkout",
}[mode]();

console.log(`  · compared against: ${compared}`);
console.log(`  · resolved by:      ${def.how}`);
if (strict) console.log(`  · verdict:          strict${onTag ? " — this is a tag build, and a tag is a release claim" : " (--strict)"}`);
console.log(`  · read:             ${registers.join(", ")} — ${done} request(s) marked ${STATUS}`);
console.log(`  · claims:           ${claims} path claim(s), ${prose} entr(y/ies) held no path and were read as prose`);

if (mode === "unreachable") {
  console.log("\n  ✖ nothing was compared. This gate does not report a clean default branch it could not read.\n");
  console.log("2 · comparison not possible — this is not a pass.");
  console.log("Fetch the branch (`git fetch origin main`, or check out with fetch-depth: 0), name it with");
  console.log("MERIDIAN_DEFAULT_BRANCH=main, or assert this tree is it with MERIDIAN_DEFAULT_BRANCH=.\n");
  process.exit(2);
}

if (missing.length) {
  console.log("\n  named by the register and carried by no tree:");
  for (const m of missing) console.log(`  ✖ ${m}`);
}
if (unmerged.length) {
  const mark = mode === "on-default" || strict ? "✖" : "!";
  console.log(`\n  built here and absent from ${def.ref ?? "the default branch"} — an adopter cannot reach these:`);
  for (const u of unmerged) console.log(`  ${mark} ${u}`);
}
if (!missing.length && !unmerged.length) {
  console.log(`\n  · every path the ${done} ${STATUS} request(s) name is on the default branch`);
}

const fatal = missing.length + (mode === "on-default" || strict ? unmerged.length : 0);
const owed = !fatal && unmerged.length ? `, ${unmerged.length} owed to ${def.ref}` : "";
console.log(`\n${fatal} unreachable claim(s)${owed}.`);

if (mode === "ahead" && unmerged.length && !strict) {
  console.log(`\nThis branch is ${ahead} commit(s) ahead of ${def.ref} and is allowed to be. The count above is merge`);
  console.log("debt, not a defect: what the register promises and the default branch does not yet carry. It");
  console.log("becomes a failure the moment this lands there, and `--strict` makes it one here and now.");
  console.log("REQ-32: merge to the default branch and push the tag.");
}
if (fatal) {
  console.log("\nA request is `done` when the default branch carries what it names. Merge the work, or move");
  console.log("the request back to `partial` and say in `remaining` what is not there yet.");
}
console.log("");
process.exit(fatal ? 1 : 0);

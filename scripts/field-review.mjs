/**
 * The Product Owner's review of a FIELD REPOSITORY (docs/35, docs/33 §4).
 *
 *   node scripts/field-review.mjs [--register docs/requests/<name>.json]…
 *                                 [--repo owner/name] [--remote <url|path>]
 *                                 [--vocabulary "M-\d{2},I-\d{1,2}"] [--context "D-\d{3}"]
 *                                 [--dir <clone dir>]
 *
 * With no --register it reviews every register in docs/requests/, which is
 * how a SECOND field repository joins the loop: it files a register, and
 * the next round reads it — no code here knows its name.
 *
 * For each register: fetch EVERY branch of the field repository (the
 * default branch is not where the material lives), read every line that
 * names Meridian, extract the ids of the vocabulary THAT REGISTER declares
 * (`source.vocabulary` — RT365's M/I/O/H is one field's convention, not
 * this script's), and print what the register does not yet carry, so that
 * a request written over there cannot go unseen over here. Network is
 * needed unless --remote points at a local path; the script says so when
 * it is not there.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validate } from "./lib/jsonschema.mjs";

const root = path.resolve(import.meta.dirname, "..");
const REGISTERS = path.join(root, "docs/requests");
const SCHEMA_ID = "meridian-request-register/1";
const schema = JSON.parse(fs.readFileSync(path.join(REGISTERS, "register.schema.json"), "utf8"));

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const all = (k) => argv.reduce((out, a, i) => (a === k ? [...out, argv[i + 1]] : out), []);
const list = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);

const registers = all("--register").length
  ? all("--register").map((f) => path.resolve(root, f))
  : fs.readdirSync(REGISTERS).filter((f) => f.endsWith(".json") && f !== "register.schema.json")
      .sort().map((f) => path.join(REGISTERS, f));

/* Les noms de branches et de fichiers viennent d'un dépôt TIERS : jamais
   dans un shell, toujours en arguments (le conseiller code a nommé le
   fichier `x$(curl …|sh).md`). Le nom du dépôt et son URL viennent de la
   même source et suivent la même règle. */
const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

/** A vocabulary is a list of unanchored patterns; a bad one is named, not ignored. */
function vocabularyRe(patterns, what, where) {
  if (!patterns?.length) return null;
  try { return new RegExp(`\\b(${patterns.join("|")})\\b`, "g"); }
  catch (e) { throw new Error(`${where}: the ${what} vocabulary is not a usable pattern — ${e.message}`); }
}

function review(file) {
  const rel = path.relative(root, file);
  const register = JSON.parse(fs.readFileSync(file, "utf8"));
  if (register.$schema !== SCHEMA_ID) {
    console.error(`${rel}: not a ${SCHEMA_ID} register`);
    return 2;
  }
  /* Reviewing a register whose shape is wrong would report absences that
     are really typing errors. The gate (F11) says the same thing in CI. */
  const invalid = validate(schema, register);
  if (invalid.length) {
    console.error(`${rel}: does not match ${SCHEMA_ID} — ${invalid.length} violation(s), ` +
      `run \`node scripts/audit/register-schema.mjs\``);
    return 2;
  }

  const repo = opt("--repo", register.source.repository);
  const remote = opt("--remote", register.source.remote ?? `https://github.com/${repo}`);
  const requestPatterns = list(opt("--vocabulary")) ?? register.source.vocabulary?.request;
  const contextPatterns = list(opt("--context")) ?? register.source.vocabulary?.context ?? [];
  if (!requestPatterns?.length) {
    console.error(`${rel}: no id vocabulary — declare source.vocabulary.request, or pass --vocabulary`);
    return 2;
  }
  const requestRe = vocabularyRe(requestPatterns, "request", rel);
  const contextRe = vocabularyRe(contextPatterns, "context", rel);

  /* Un répertoire fixe dans /tmp est devinable : un tiers peut l'avoir
     créé avant nous. Sans --dir on clone dans un répertoire neuf, et on
     le rend. */
  const given = opt("--dir");
  const slug = repo.replace(/[^A-Za-z0-9._-]+/g, "-");
  const dir = given ? path.resolve(given, slug)      // --dir is a workspace: one clone per field repository
                    : fs.mkdtempSync(path.join(os.tmpdir(), "meridian-field-review-"));
  try {
    if (!fs.existsSync(path.join(dir, ".git"))) {
      fs.mkdirSync(dir, { recursive: true });
      /* `--` : le remote vient d'un fichier de configuration, il ne doit
         pas pouvoir se faire passer pour une option de git. */
      try { git(dir, "clone", "--quiet", "--depth", "1", "--no-single-branch", "--", remote, "."); }
      catch (e) { console.error(`cannot reach ${repo} at ${remote}: ${e.message.split("\n")[0]}`); return 2; }
    } else {
      try { git(dir, "fetch", "--quiet", "--depth", "1", "origin", "+refs/heads/*:refs/remotes/origin/*"); }
      catch (e) { console.error(`cannot fetch ${repo} at ${remote}: ${e.message.split("\n")[0]}`); return 2; }
    }
    return read({ register, rel, repo, dir, requestRe, contextRe,
                  vocabulary: { request: requestPatterns, context: contextPatterns } });
  } finally {
    if (!given) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function read({ register, rel, repo, dir, requestRe, contextRe, vocabulary }) {
  /* `refs/remotes/origin/HEAD` shortens to `origin`, so the symbolic ref
     has to be recognised on its full name or the default branch is counted
     twice — a local clone creates it where a shallow GitHub clone does not. */
  const branches = git(dir, "for-each-ref", "--format=%(refname) %(refname:short) %(objectname:short)", "refs/remotes/origin")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [full, ref, sha] = l.split(" "); return { full, ref, sha }; })
    .filter((b) => !b.full.endsWith("/HEAD"));

  const known = new Set(register.requests.flatMap((r) => r.origin));
  const seen = new Map();      // id → { where, text }
  const context = new Map();

  for (const b of branches) {
    let files;
    try { files = git(dir, "ls-tree", "-r", "--name-only", b.ref).split("\n").filter(Boolean); } catch { continue; }
    for (const f of files) {
      if (!/\.(md|py|json|yaml|yml|txt)$/i.test(f)) continue;
      let text;
      try { text = git(dir, "show", `${b.ref}:${f}`); } catch { continue; }
      if (!/meridian/i.test(text)) continue;
      for (const line of text.split("\n")) {
        if (!/meridian/i.test(line)) continue;
        const at = { where: `${b.ref}:${f}`, text: line.trim().slice(0, 160) };
        for (const m of line.matchAll(requestRe)) if (!seen.has(m[1])) seen.set(m[1], at);
        if (contextRe) for (const m of line.matchAll(contextRe)) if (!context.has(m[1])) context.set(m[1], at);
      }
    }
  }

  console.log(`\n═══ field review · ${repo} · ${branches.length} branch(es) · ${rel} ═══\n`);
  for (const b of branches) console.log(`  · ${b.ref} @ ${b.sha}`);
  console.log(`\n  register: ${register.requests.length} request(s), v${register.registerVersion}, ` +
    `reviewed ${register.source.reviewedAt} at ${register.source.commit.slice(0, 7)}`);
  console.log(`  vocabulary: ${vocabulary.request.join("  ")}` +
    (vocabulary.context.length ? `   · context: ${vocabulary.context.join("  ")}` : ""));

  const missing = [...seen.entries()].filter(([id]) => !known.has(id));
  const forContext = [...context.entries()].filter(([id]) => !known.has(id) && !seen.has(id));
  if (!missing.length) console.log(`\n  · every line that names Meridian with a declared id is in ${rel}`);
  else {
    console.log(`\n  ✖ ${missing.length} line(s) name Meridian and are NOT in the register:`);
    for (const [id, { where, text }] of missing) console.log(`    ${id}  (${where})\n        ${text}`);
  }
  if (forContext.length) {
    console.log(`\n  · decisions / records naming Meridian, for context (${forContext.length}):`);
    for (const [id, { where }] of forContext) console.log(`    ${id}  (${where})`);
  }

  /* Une demande sans identifiant est invisible au motif ci-dessus. Depuis le
     commit relu, on liste donc aussi chaque FICHIER modifié qui nomme
     Meridian : c'est à lire, pas à compter. */
  const head = branches.find((b) => b.ref.includes(register.source.branch.split("/").pop()));
  if (head) {
    let changed = [];
    try {
      changed = git(dir, "diff", "--name-only", register.source.commit, head.ref).split("\n").filter(Boolean)
        .filter((f) => { try { return /meridian/i.test(git(dir, "show", `${head.ref}:${f}`)); } catch { return false; } });
    } catch { /* le commit relu n'est plus joignable en clone superficiel : dit ci-dessous */ }
    if (changed.length) {
      console.log(`\n  ! ${changed.length} file(s) changed since ${register.source.commit.slice(0, 7)} name Meridian — ` +
        `read them, a request may carry no id:`);
      for (const f of changed) console.log(`    ${f}`);
    }
    if (!register.source.commit.startsWith(head.sha)) {
      console.log(`\n  ! ${register.source.branch} moved: register reviewed ${register.source.commit.slice(0, 7)}, ` +
        `branch is at ${head.sha} — read the diff`);
    }
  }
  console.log("");
  return missing.length ? 1 : 0;
}

let worst = 0;
for (const file of registers) {
  try { worst = Math.max(worst, review(file)); }
  catch (e) { console.error(`${path.relative(root, file)}: ${e.message}`); worst = Math.max(worst, 2); }
}
process.exit(worst);

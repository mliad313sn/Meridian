#!/usr/bin/env node
/**
 * field-init — write a starter request register for a field repository.
 *
 * REQ-31 (RT365's V-12) asked for "a documented schema AND command" that
 * let a second repository file its register and see its requests tracked,
 * without Meridian-specific code in that repository. The schema was
 * published (docs/requests/register.schema.json), the review command was
 * already generic (npm run review:field), and docs/35 §6 documented the
 * five steps — but step 1 read "copy an existing register", which is not
 * a command, and copying RT365's means inheriting RT365's forty-four
 * requests and deleting them by hand.
 *
 * This writes the file instead, and writes it valid: the output passes
 * F11 (register-schema) and F12 (register-reachable) the moment it lands.
 *
 * It will not invent your findings. `requests` carries `minItems: 1` on
 * purpose — a register with nothing in it is not a register, it is a
 * placeholder that makes the loop look adopted — so the command requires
 * your first finding and refuses without it. Everything it cannot know it
 * asks for; nothing it writes is a guess.
 *
 *   node scripts/field-init.mjs \
 *     --repo acme/atlas-programme \
 *     --branch delivery/2026-q1 \
 *     --commit 3f9a1c2 \
 *     --vocabulary 'ATL-\d+' \
 *     --origin ATL-014 \
 *     --first 'Cost lines cannot be corrected without deleting the period'
 *
 * Options:
 *   --repo        owner/name of the field repository            (required)
 *   --branch      the branch the findings live on               (required)
 *   --commit      the commit read, 7-40 hex                     (required)
 *   --vocabulary  regex for your own ids, repeatable            (required)
 *   --origin      your own id this first request answers        (required)
 *   --first       the title of your first finding               (required)
 *   --context     regex for ids that are context, not requests  (repeatable)
 *   --document    a document the round was read from            (repeatable)
 *   --remote      clone URL, when your forge is not GitHub
 *   --out         where to write (default docs/requests/<name>.json)
 *   --force       overwrite an existing register
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── 1 · read the arguments, keeping repeats ────────────────────────── */

const BOOLEAN = new Set(["force"]);

const argv = process.argv.slice(2);
const opts = Object.create(null);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) die(`unexpected argument ${JSON.stringify(a)} — every value follows a --flag`);
  const key = a.slice(2);
  if (BOOLEAN.has(key)) { (opts[key] ??= []).push(true); continue; }
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) die(`--${key} needs a value`);
  i++;
  (opts[key] ??= []).push(value);
}
const one = (k) => (opts[k] ? opts[k][opts[k].length - 1] : undefined);
const many = (k) => opts[k] ?? [];

function die(message) {
  console.error(`\nfield-init: ${message}\n`);
  console.error("  node scripts/field-init.mjs --repo owner/name --branch <b> --commit <sha> \\");
  console.error("    --vocabulary 'ABC-\\d+' --origin ABC-001 --first 'what you found'\n");
  process.exit(1);
}

/* ── 2 · refuse what we cannot know ─────────────────────────────────── */

const repo = one("repo");
const branch = one("branch");
const commit = one("commit");
const vocabulary = many("vocabulary");
const origin = many("origin");
const first = one("first");

if (!repo) die("--repo is required: the register says which repository filed it");
if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) die(`--repo ${JSON.stringify(repo)} is not owner/name`);
if (!branch) die("--branch is required: the material is almost never on the default branch");
if (!commit) die("--commit is required: the review diffs your branch against it");
if (!/^[0-9a-f]{7,40}$/i.test(commit)) die(`--commit ${JSON.stringify(commit)} is not 7-40 hex characters`);
if (!vocabulary.length) die("--vocabulary is required: the review reads your ids rather than knowing them");
for (const v of vocabulary) { try { new RegExp(v); } catch { die(`--vocabulary ${JSON.stringify(v)} is not a regular expression`); } }
if (!first) die("--first is required: a register carries at least one request, because a register with nothing in it is not a register");
if (!origin.length) die("--origin is required: it is the join between your ledger and this one — which of your ids this request answers");

const today = new Date().toISOString().slice(0, 10);
const name = repo.split("/")[1];
const out = one("out") ?? path.join("docs/requests", `${name}.json`);
const abs = path.resolve(root, out);
if (fs.existsSync(abs) && !("force" in opts)) {
  die(`${out} already exists — pass --force to overwrite it, or --out to write elsewhere.\n` +
      `  A register is a ledger: overwriting one loses every answer written in it.`);
}

/* ── 3 · the register ───────────────────────────────────────────────── */

const documents = many("document");

const register = {
  $schema: "meridian-request-register/1",
  source: {
    repository: repo,
    ...(one("remote") ? { remote: one("remote") } : {}),
    branch,
    commit: commit.toLowerCase(),
    documents: documents.length ? documents : [
      "— name the documents this round was read from, so a reader can go and check —",
    ],
    reviewedAt: today,
    vocabulary: {
      request: vocabulary,
      ...(many("context").length ? { context: many("context") } : {}),
      note: "Ids matching `request` become requests here; `context` ids are printed for the reader and never counted as missing.",
    },
  },
  productOwner: {
    charter: "docs/33-retour-terrain-rt365.md#1",
    command: ".claude/commands/product-owner.md",
  },
  channel: {
    /* The issue tracker of the ANSWERING repository — a request is answered
       where the work is done, not where it was found. */
    issues: "https://github.com/mliad313sn/Meridian/issues",
    rule: "One issue per request. A request is answered on its issue, and the answer is what moves `accepted`.",
    acceptance: {
      done: "Meridian says the work landed, names the files, and names the test or gate that proves it.",
      accepted: "The requester re-tested it and says it answers the request. Only the requester writes this.",
      notAccepted: "The requester could answer and has not yet.",
      cannotAnswerYet: "The requester is not in a position to answer — the work is not reachable to them, or they have not re-tested.",
      released: "A tag carries it, on a branch anyone cloning gets.",
    },
    escalation: "A disagreement is written in both registers rather than settled in one.",
  },
  registerVersion: 1,
  requests: [
    {
      id: "REQ-01",
      origin,
      title: first,
      status: "open",
      version: null,
      decidedOn: null,
      delivered: [],
      measure: null,
      remaining: null,
      issue: null,
      accepted: null,
      released: false,
      history: [{ at: today, registerVersion: 1, status: "open" }],
    },
  ],
};

fs.mkdirSync(path.dirname(abs), { recursive: true });
fs.writeFileSync(abs, JSON.stringify(register, null, 2) + "\n", "utf8");

/* ── 4 · say what is true, and what is still the adopter's to write ─── */

console.log(`\n═══ ${out} written — register version 1, one request ═══\n`);
console.log(`  repository   ${repo}`);
console.log(`  branch       ${branch} @ ${register.source.commit}`);
console.log(`  vocabulary   ${vocabulary.join("  ")}`);
console.log(`  REQ-01       ${first}`);
console.log(`               answers ${origin.join(", ")}\n`);
console.log("  Still yours to write, and the gates will not write them for you:");
if (!documents.length) console.log("    · source.documents — the documents this round was read from");
console.log("    · one request per further finding (REQ-02, REQ-03, …)");
console.log("    · one issue per request on the answering repository, then its number in `issue`\n");
console.log("  Prove it now:");
console.log("    node scripts/audit/register-schema.mjs      # the shape");
console.log("    node scripts/audit/register-reachable.mjs   # nothing claims done that cannot be found");
console.log(`    npm run review:field -- --register ${out}\n`);
console.log("  No code was written into your repository, and none into ours.\n");

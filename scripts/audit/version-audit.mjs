/**
 * Coordination check: every client PATCH on a versioned entity must name
 * the version it is based on, and every server PATCH must require one.
 *
 * The backend review found that `Number(body.version ?? row.row_version)`
 * is an unfailable check — it asserts the value the request just read.
 * It was fixed on the administration routes and left everywhere else,
 * which is the kind of half-closure a cross-committee pass exists to
 * catch.
 *
 *   node scripts/audit/version-audit.mjs
 */

import fs from "node:fs";
import { migrationSchema } from "./lib/schema.mjs";

/* REQ-52 — the files and tables this gate reads are derived, not named.
   It named three views, three routers and sixteen tables; a view file,
   a router or a versioned table added after it was written was a write
   path it never looked at. */
const walkJs = (dir, into = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walkJs(p, into);
    else if (e.name.endsWith(".js")) into.push(p);
  }
  return into;
};

/** Read the argument list of a call, balancing quotes and brackets. */
function callArgs(src, start) {
  let i = start, depth = 1, out = "", str = null, esc = false;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (str) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === str) str = null;
      out += c;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; out += c; continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) { depth--; if (!depth) break; }
    out += c;
  }
  return out;
}

let problems = 0;

/* ── client side ──────────────────────────────────────────────────── */
console.log("═══ client PATCH calls that do not name a version ═══");
const clientFiles = walkJs("web/src").sort();
for (const f of clientFiles) {
  const s = fs.readFileSync(f, "utf8");
  const re = /\.\s*patch\(/g;
  let m;
  while ((m = re.exec(s))) {
    const args = callArgs(s, m.index + m[0].length);
    const path = (args.match(/["'`]([^"'`]*)["'`]/) || [])[1] ?? "?";
    /* `app_setting` and `board_column` are not read-modify-write on a row
       another person may be holding open: a settings toggle and a WIP
       limit are single-field switches whose last value is the intended
       one. They are excluded deliberately, not overlooked. */
    if (/\/admin\/(settings|columns)/.test(path)) continue;
    /* Marquer un message lu, et régler ses heures de silence, ne sont pas
       davantage des lectures-modifications-écritures : `notification`
       n'est pas versionnée, marquer lu est idempotent — `coalesce(read_at,
       now())` — et deux onglets qui le font en même temps veulent la même
       chose. Exclus délibérément, comme au-dessus. */
    if (/\/auth\/(notifications|quiet-hours)/.test(path)) continue;
    /* REQ-52 — seen the first time this gate read main.js (it read three
       view files). `/auth/preferences` is quiet-hours' neighbour: the
       signed-in account's own language and digest cadence, on its own
       app_user row, written by nobody else — there is no second writer
       for a version to protect against. Exempt for the same reason. */
    if (/^\/auth\/preferences$/.test(path)) continue;
    if (!/\bversion\b\s*:/.test(args)) {
      console.log(`  ✖ ${f.split("/").pop().padEnd(20)} ${path}`);
      problems++;
    }
  }
}
if (!problems) console.log("  none");

/* ── server side ──────────────────────────────────────────────────── */
console.log("\n═══ server PATCH routes on versioned tables that accept a missing version ═══");
/* Every table that carries `row_version`, read from the migrations. */
const VERSIONED = migrationSchema().versioned;

let serverProblems = 0;
for (const f of walkJs("server/src/routes").sort()) {
  const s = fs.readFileSync(f, "utf8");
  const re = /^r\.patch\(\s*"([^"]+)"/gm;
  let m;
  while ((m = re.exec(s))) {
    // the body of this route, up to the next top-level r.<verb>(
    const rest = s.slice(m.index);
    const end = rest.slice(1).search(/^r\.(get|post|patch|put|delete)\(/m);
    const body = end === -1 ? rest : rest.slice(0, end + 1);
    if (!/updateVersioned\(/.test(body)) continue;          // not a versioned write
    const table = (body.match(/updateVersioned\(t,\s*"(\w+)"/) || [])[1];
    if (!VERSIONED.has(table)) continue;
    if (/requiredVersion\(/.test(body)) continue;           // already strict
    console.log(`  ✖ ${f.split("/").pop().padEnd(20)} PATCH ${m[1].padEnd(28)} → ${table}`);
    serverProblems++;
  }
}
if (!serverProblems) console.log("  none");

const total = problems + serverProblems;
console.log(`\n${total} unversioned write path(s).`);
if (total) {
  console.log("A version fallback to the just-read row is not a concurrency check.");
  console.log("See docs/09-backend-review.md finding 3.");
  process.exitCode = 1;
}

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
const clientFiles = ["web/src/views/index.js", "web/src/views/meetings.js",
                     "web/src/views/administration.js"];
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
    if (!/\bversion\b\s*:/.test(args)) {
      console.log(`  ✖ ${f.split("/").pop().padEnd(20)} ${path}`);
      problems++;
    }
  }
}
if (!problems) console.log("  none");

/* ── server side ──────────────────────────────────────────────────── */
console.log("\n═══ server PATCH routes on versioned tables that accept a missing version ═══");
const VERSIONED = new Set([
  "project", "activity", "milestone", "raid_item", "change_request",
  "allocation", "document", "work_item", "person", "site", "programme",
  "board_column", "app_user", "meeting_series", "meeting_occurrence",
  "meeting_action",
]);

let serverProblems = 0;
for (const f of ["server/src/routes/portfolio.js", "server/src/routes/meetings.js",
                 "server/src/routes/admin.js"]) {
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

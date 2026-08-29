/*
 * Every call the client makes, matched against every route the server
 * defines. A mismatch is a button that 404s in the user's hands.
 *
 * Paths are reconstructed from the source expression, so
 *   a.patch("/projects/" + p.id + "/health", …)
 * is understood as PATCH /projects/:id/health rather than as three
 * separate fragments.
 */
import fs from "node:fs";

const clientFiles = [
  "web/src/views/index.js", "web/src/views/meetings.js",
  "web/src/main.js", "web/src/lib/api.js", "web/src/ui/login.js",
  "web/src/views/administration.js",
];

/** Read the first argument expression of a call, balancing parens/quotes. */
function firstArg(src, i) {
  let depth = 1, out = "", str = null, esc = false;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (str) {
      if (esc) { esc = false; out += c; continue; }
      if (c === "\\") { esc = true; out += c; continue; }
      if (c === str) str = null;
      out += c; continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; out += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") { depth--; if (!depth) break; }
    if (c === "," && depth === 1) break;
    out += c;
  }
  return out;
}

/** "/projects/" + p.id + "/health"  →  /projects/:id/health */
function toPattern(expr) {
  const parts = [];
  let rest = expr.trim();
  const re = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
  let last = 0, m;
  while ((m = re.exec(rest))) {
    const between = rest.slice(last, m.index);
    if (/[A-Za-z0-9_)\]]/.test(between.replace(/[\s+]/g, ""))) parts.push(":id");
    else if (parts.length && /\+/.test(between)) parts.push(":id");
    parts.push(m[1] ?? m[2] ?? m[3]);
    last = m.index + m[0].length;
  }
  const tail = rest.slice(last);
  if (/[A-Za-z0-9_)\]]/.test(tail.replace(/[\s+]/g, ""))) parts.push(":id");
  let p = parts.join("");
  p = p.replace(/\?.*$/, "");                  // query strings
  p = p.replace(/\/+(?=\/)/g, "/");
  p = p.replace(/\/$/, "/:id");                // trailing slash means an id followed
  p = p.replace(/\/:id\/:id/g, "/:id");
  return p;
}

const calls = new Map();
for (const f of clientFiles) {
  const s = fs.readFileSync(f, "utf8");
  const re = /\b\w+\.(get|post|patch|put|del|delete)\(/g;
  let m;
  while ((m = re.exec(s))) {
    const verb = (m[1] === "del" ? "delete" : m[1]).toUpperCase();
    const arg = firstArg(s, m.index + m[0].length);
    if (!/["'`]\//.test(arg)) continue;         // not a path call
    const key = `${verb} ${toPattern(arg)}`;
    if (!calls.has(key)) calls.set(key, `${f.split("/").pop()}`);
  }
}

/* federationService.js (/v1) is deliberately absent: it is the
   machine-facing contract surface for SDP, and no browser button calls
   it — this audit is about buttons that 404 in a user's hands. */
const mounts = { portfolio: "", meetings: "/meetings", admin: "/admin", auth: "/auth", federation: "/federation", importcsv: "/import" };
const served = new Set();
for (const [f, prefix] of Object.entries(mounts)) {
  const s = fs.readFileSync(`server/src/routes/${f}.js`, "utf8");
  for (const m of s.matchAll(/^r\.(get|post|patch|put|delete)\(\s*"([^"]+)"/gm)) {
    served.add(`${m[1].toUpperCase()} ${(prefix + m[2]).replace(/\/:[a-zA-Z]+/g, "/:id")}`);
  }
}

const broken = [...calls].filter(([k]) => !served.has(k));
const unused = [...served].filter((s) => !calls.has(s));

console.log(`client call sites: ${calls.size}   server routes: ${served.size}\n`);
console.log("── CLIENT CALLS WITH NO MATCHING ROUTE (buttons that 404) ──");
broken.length ? broken.forEach(([k, f]) => console.log(`  ✖ ${k}   (${f})`)) : console.log("  none");
console.log("\n── ROUTES NO CLIENT CODE CALLS ──");
unused.length ? unused.forEach((u) => console.log(`  · ${u}`)) : console.log("  none");

/* A client call with no route is a button that 404s in someone hands, so
   it fails the build. An uncalled route is a question, not a fault. */
if (broken.length) process.exitCode = 1;

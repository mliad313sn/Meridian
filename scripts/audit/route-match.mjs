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
import { servedRoutes, unmountedRouterFiles } from "../../server/src/routemap.js";

/* REQ-52 — every client file, walked, not six of them named. A screen
   written in a seventh file was a set of buttons this gate never read. */
function walk(dir, into = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, into);
    else if (e.name.endsWith(".js")) into.push(p);
  }
  return into;
}
const clientFiles = walk("web/src").sort();

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

/* REQ-52 — the served routes are read from the app buildApp() builds
   (server/src/routemap.js), not from a map of router files typed here.
   That map was the blind spot: `signals` was missing from it for a
   release, and every button calling it was reported as a 404 while the
   route existed and answered. A router the app mounts is now seen
   because the app mounts it, and a router file the app does NOT mount
   fails below, by name.

   The browser calls through api.js, which prefixes `/api`; so only the
   routes under /api are buttons' targets, and they are keyed without it.
   federationService (/v1) is outside /api on purpose — another system's
   door, no button calls it. */
const served = new Set();
for (const { method, path } of servedRoutes()) {
  if (!path.startsWith("/api/")) continue;
  served.add(`${method} ${path.slice(4).replace(/\/:[a-zA-Z]+/g, "/:id")}`);
}
const unmounted = await unmountedRouterFiles();

const broken = [...calls].filter(([k]) => !served.has(k));
/* /api/v1 is the machines' contract (F9 holds it); a route there that no
   button calls is its purpose, not a question. */
const unused = [...served].filter((s) => !calls.has(s) && !/^\w+ \/v1(\/|$)/.test(s));

console.log(`client call sites: ${calls.size}   server routes: ${served.size}\n`);
console.log("── CLIENT CALLS WITH NO MATCHING ROUTE (buttons that 404) ──");
broken.length ? broken.forEach(([k, f]) => console.log(`  ✖ ${k}   (${f})`)) : console.log("  none");
console.log("\n── ROUTES NO CLIENT CODE CALLS ──");
unused.length ? unused.forEach((u) => console.log(`  · ${u}`)) : console.log("  none");

console.log("\n── ROUTER FILES THE APP NEVER MOUNTS ──");
unmounted.length ? unmounted.forEach((f) => console.log(`  ✖ ${f}`)) : console.log("  none");

/* A client call with no route is a button that 404s in someone hands, so
   it fails the build. An uncalled route is a question, not a fault. A
   router file nobody mounts is every one of its routes answering 404. */
if (broken.length || unmounted.length) process.exitCode = 1;

/**
 * F8 · CHAQUE ÉCRAN SE DESSINE, POUR CHAQUE RÔLE
 *
 * Pourquoi cette porte existe.
 *
 * L'écran d'administration levait une `ReferenceError` au rendu — un
 * `selectField` employé sans être importé — et le `try` de la coquille la
 * transformait en « This view could not be drawn ». Comptes, droits,
 * annuaire, reprise CSV, notifications : inaccessibles **depuis la
 * première livraison du produit**. Sept comités, 334 tests, sept portes
 * et un balayage de 286 cas d'usage ne l'avaient pas vu, pour une raison
 * simple : les tests parlent à l'API, le balayage aussi, et **rien ne
 * dessinait une vue**.
 *
 * F7 ferme un cas particulier — les aides de `kit.js` employées sans
 * import. Celle-ci ferme la classe : elle appelle réellement chaque vue,
 * avec le livre réel du rôle réel, dans un DOM réel (jsdom), et échoue
 * sur toute exception. C'est ce que la coquille fait au démarrage, moins
 * l'humain qui regarde.
 *
 *   npm run audit:views
 *
 * Ce qu'elle ne fait pas : elle ne clique rien et ne juge aucune
 * apparence. Une vue qui se dessine peut encore être fausse. Elle répond
 * à une seule question — « cet écran s'ouvre-t-il ? » — à laquelle
 * personne ne répondait.
 */

import { JSDOM } from "jsdom";
import { connect, migrate, close } from "../../server/src/db.js";
import { seed } from "../../server/src/seed.js";
import { buildApp } from "../../server/src/index.js";

/* ── un DOM, posé AVANT le moindre import du client ─────────────────── */

const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>",
  { url: "http://localhost:4173/", pretendToBeVisual: true });

for (const k of ["window", "document", "navigator", "location", "history",
                 "HTMLElement", "SVGElement", "Node", "Element", "Event",
                 "CustomEvent", "getComputedStyle", "requestAnimationFrame",
                 "cancelAnimationFrame", "matchMedia", "localStorage",
                 "sessionStorage", "ResizeObserver", "IntersectionObserver"]) {
  if (globalThis[k] === undefined && dom.window[k] !== undefined) {
    globalThis[k] = dom.window[k];
  }
}
/* jsdom n'implémente ni l'un ni l'autre ; une vue qui en dépend ne doit
   pas faire échouer la porte pour cette raison-là. */
globalThis.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const ROLES = [
  ["admin", "admin@meridian.example", "meridian-admin-2026"],
  ["group", "e.lindqvist@meridian.example", "programme-cbp-2026"],
  ["site", "g.silva@meridian.example", "site-gru-2026"],
  ["viewer", "n.rahimi@meridian.example", "viewer-lis-2026"],
];

process.env.MERIDIAN_ENV_FILE ??= "/nonexistent/.env";
await connect({ dataDir: null, url: null });
await migrate({ silent: true });
await seed({ force: true, today: "2026-08-28" });

const server = buildApp().listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

/* Importés après le DOM : ces modules touchent `localStorage` et
   `document` dès leur évaluation. */
const { App, NAV, TITLES, ROUTES, ROUTE_ROLES } = await import("../../web/src/lib/state.js");
const { VIEWS } = await import("../../web/src/views/index.js");

const { ROLES: RBAC_ROLES } = await import("../../shared/rbac.js");
const { MANUAL, firstStepsFor } = await import("../../web/src/ui/guide.js");

const names = Object.keys(VIEWS).sort();
const failures = [];
let drawn = 0;

/* ── REQ-52 — the lists that name screens and roles, held together ────
   This gate draws every view VIEWS names, for every role it names. A
   role it did not name was never drawn for; a screen VIEWS holds and the
   navigation does not offer (or that has no title, or that a hash cannot
   open) was a screen nobody could reach, and each list only saw itself.
   Every one of them is now held against the product's own: VIEWS for
   the screens, shared/rbac.js for the roles. */
const same = (label, list, truth) => {
  for (const x of truth) if (!list.includes(x)) failures.push({ role: "(lists)", view: x, message: `absent from ${label}` });
  for (const x of list) if (!truth.includes(x)) failures.push({ role: "(lists)", view: x, message: `in ${label} and not a screen VIEWS draws` });
};
const navKeys = NAV.flatMap((g) => g.items.map(([k]) => k));
same("NAV (web/src/lib/state.js)", navKeys, names);
same("TITLES (web/src/lib/state.js)", Object.keys(TITLES), names);
same("ROUTES (web/src/lib/state.js)", ROUTES, names);
for (const [view, roles] of Object.entries(ROUTE_ROLES)) {
  if (!names.includes(view)) failures.push({ role: "(lists)", view, message: "in ROUTE_ROLES and not a screen VIEWS draws" });
  for (const r of roles) if (!RBAC_ROLES.includes(r)) failures.push({ role: r, view, message: "ROUTE_ROLES names a role shared/rbac.js does not" });
}
const drawnRoles = ROLES.map(([r]) => r);
for (const r of RBAC_ROLES) if (!drawnRoles.includes(r)) failures.push({ role: r, view: "(every screen)", message: "a role shared/rbac.js defines and this gate never draws for — add an account to ROLES" });
for (const r of drawnRoles) if (!RBAC_ROLES.includes(r)) failures.push({ role: r, view: "(every screen)", message: "drawn for, and not a role shared/rbac.js defines" });
/* The guide's links: a first step or a manual entry pointing at a screen
   that no longer exists sends someone to the portfolio instead. */
const links = [
  ...MANUAL.flatMap((s) => s.items.map((i) => ["manual", i.where])),
  ...RBAC_ROLES.flatMap((r) => firstStepsFor(r).map((i) => [`first steps · ${r}`, i.go])),
];
for (const [where, href] of links) {
  if (!href) continue;
  const view = /^#\/([^/]+)/.exec(href)?.[1];
  if (!view || !names.includes(view)) failures.push({ role: "(guide)", view: String(href), message: `${where} links to a screen VIEWS does not draw` });
}

for (const [role, email, password] of ROLES) {
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 200) {
    failures.push({ role, view: "(connexion)", message: `login ${login.status}` });
    continue;
  }
  const cookie = (login.headers.getSetCookie() ?? [])
    .find((c) => c.startsWith("meridian_sid="))?.split(";")[0];

  const me = (await login.json()).user;
  const boot = await (await fetch(`${base}/api/bootstrap`, { headers: { cookie } })).json();

  App.me = me;
  App.db = boot.db;
  App.ready = true;

  for (const name of names) {
    /* La vue « project » n'a de sens qu'ouverte sur un projet, comme
       depuis le portefeuille ; les autres se dessinent sur l'état par
       défaut, qui est celui qu'on obtient en cliquant dans la barre. */
    App.ui.view = name;
    App.ui.project = boot.db.projects[0]?.id ?? null;
    App.ui.boardProject = boot.db.projects[0]?.id ?? null;

    try {
      const node = VIEWS[name](App.db);
      if (!node) throw new Error("la vue n'a rien rendu");
      /* Rendu pour de bon dans le document : une vue qui construit un
         nœud invalide échoue à l'insertion, pas à la construction. */
      const host = document.getElementById("root");
      host.textContent = "";
      host.appendChild(node);
      drawn++;
    } catch (e) {
      failures.push({ role, view: name, message: String(e?.message ?? e) });
    }
  }
}

await new Promise((r) => server.close(r));
await close();

console.log("\n═══ F8 · chaque écran se dessine, pour chaque rôle ═══\n");
if (!failures.length) {
  console.log(`  · ${names.length} écrans × ${ROLES.length} rôles`);
  console.log(`  · NAV, TITLES, ROUTES, ROUTE_ROLES, les rôles et ${links.length} liens du guide tenus contre VIEWS et rbac.js`);
  console.log(`  · ${drawn} rendus, aucune exception\n`);
} else {
  for (const f of failures) {
    console.log(`  ✖ ${f.view} · ${f.role} — ${f.message}`);
  }
  console.log("");
}
console.log(`${failures.length} écran(s) impossible(s) à dessiner.\n`);
process.exit(failures.length ? 1 : 0);

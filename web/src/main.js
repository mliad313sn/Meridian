/**
 * Shell — navigation, header, command palette, boot.
 *
 * Carried over from the v4 build with three changes the committee asked
 * for: a sign-in gate in front of it (F-01), navigation that only offers
 * what the account may reach (R7.3), and a Meetings section (D-04).
 */

import "./styles.css";
import { h, clear, icon, $, dialog, formDialog, searchBox, selectField, openDialogCount } from "./ui/kit.js";
import { renderLogin } from "./ui/login.js";
import { App, go, readRoute, routeAllowed, toast, bindEngine, reportError } from "./lib/state.js";
import { t, getLang, setLang } from "./lib/i18n.js";
import { api, setUnauthenticatedHandler } from "./lib/api.js";
import { Engine } from "../../shared/engine.js";
import { VIEWS, HEADER_ACTIONS, initials } from "./views/index.js";

bindEngine(Engine);

/* ── navigation ───────────────────────────────────────────────────── */

/* Which roles see which entry lives in ROUTE_ROLES beside the routes, so
   that hiding an entry and refusing the route it points at cannot drift
   apart (R7.3 — an entry an account cannot use is not there). "My site"
   is the site lead's governance surface; "Programmes" the group PMO's;
   "My week" is everyone's landing (2026-08-28 governance + UX
   committees). */
const NAV = [
  { label: "Deliver", items: [
    ["my", "My week"],
    ["inbox", "Notifications"],
    ["portfolio", "Portfolio"],
    ["roadmap", "Roadmap"],
    ["pipeline", "Pipeline"],
    ["programmes", "Programmes"],
    ["mysite", "My site"],
    ["project", "Project overview"],
    ["schedule", "Schedule"], ["board", "Board"]] },
  { label: "Control", items: [
    ["risk", "Risks & issues"], ["budget", "Budget & cost"],
    ["change", "Change requests"], ["resources", "Resources"]] },
  { label: "Govern", items: [["meetings", "Meetings"]] },
  { label: "Record", items: [
    ["documents", "Documents"], ["reports", "Reports"], ["locations", "Locations"]] },
  { label: "System", items: [["admin", "Administration"]] },
];

const TITLES = {
  my: ["Deliver", "My week"],
  inbox: ["Deliver", "Notification centre"],
  portfolio: ["Portfolio", "Executive portfolio view"],
  roadmap: ["Deliver", "Portfolio roadmap"],
  pipeline: ["Deliver", "Demand & prioritisation"],
  programmes: ["Deliver", "Programme governance"],
  mysite: ["Deliver", "My site"],
  project: ["Project", null],
  schedule: ["Schedule", "Integrated master schedule"],
  board: ["Delivery", "Work board"],
  risk: ["Control", "Risks & issues"],
  budget: ["Control", "Budget & earned value"],
  change: ["Control", "Change requests"],
  resources: ["Control", "Resource capacity"],
  meetings: ["Govern", "Meetings & decisions"],
  documents: ["Record", "Document library"],
  reports: ["Record", "Status reporting"],
  locations: ["Record", "Delivery locations"],
  admin: ["System", "Governance & administration"],
};

/** An entry an account has no use for is not there — not greyed (R7.3). */
function navFor(me) {
  return NAV
    .map((g) => ({ ...g, items: g.items.filter(([key]) => routeAllowed(key, me)) }))
    .filter((g) => g.items.length);
}

function badges(db) {
  const scoped = App.scopedProjects().map((p) => p.id);
  return {
    risk: db.raid.filter((r) => r.status === "Open" && Engine.escalation(db, r).level === "Steering").length,
    change: db.crs.filter((c) => c.status === "Pending" && scoped.includes(c.project)).length,
    documents: db.docs.filter((d) => d.status !== "Approved" && (!d.project || scoped.includes(d.project))).length,
    resources: db.settings.capacityAlerts ? Engine.overAllocated(db, 8).length : 0,
    board: db.items.filter((i) => i.column === "progress" && scoped.includes(i.project)).length,
    meetings: App.meetingBadge ?? 0,
    /* N-05 — le seul badge qui ne se calcule pas sur le livre : ma boîte
       est une boîte, pas une lecture du portefeuille. Le compte arrive
       avec le bootstrap et se rafraîchit avec lui. */
    inbox: App.me?.unread ?? 0,
  };
}

function sidebar(db) {
  const b = badges(db);
  const me = App.me;
  const person = Engine.person(db, me.personId);
  return h("aside", { class: "sidebar" + (App.ui.sidebarOpen ? " open" : "") },
    h("div", { class: "brand" },
      h("div", { class: "brand-row" },
        h("span", { class: "brand-mark" }),
        h("span", { class: "brand-name" }, db.orgName)),
      h("div", { class: "kicker", style: "margin-top:5px" }, t("Portfolio management office"))),

    /* R-07 — sixteen flat entries became four collapsible working modes,
       the active view's group always open. Nothing is removed; a closed
       group carries the sum of its badges so nothing urgent hides. */
    h("nav", { class: "nav", "aria-label": t("Sections") },
      ...navFor(me).map((g) => {
        const holdsActive = g.items.some(([key]) => App.ui.view === key);
        const open = holdsActive || App.ui.navOpen === g.label;
        const badgeSum = g.items.reduce((n, [key]) => n + (b[key] || 0), 0);
        return h("div", null,
          h("button", {
            class: "nav-group kicker", "aria-expanded": String(open),
            style: "display:flex;width:100%;align-items:center;gap:6px;background:none;border:0;cursor:pointer;text-align:left",
            onClick: () => { App.set({ navOpen: open && !holdsActive ? null : g.label }); },
          },
            h("span", { style: "flex:1" }, t(g.label)),
            !open && badgeSum ? h("span", { class: "nav-badge" }, String(badgeSum)) : null,
            h("span", { class: "xs muted" }, open ? "▾" : "▸")),
          ...(open ? g.items.map(([key, label]) => {
            const on = App.ui.view === key;
            const n = b[key];
            return h("button", {
              class: "nav-item" + (on ? " on" : ""),
              onClick: () => go("#/" + key),
              "aria-current": on ? "page" : null,
            },
              h("span", { class: "lbl" }, t(label)),
              n ? h("span", { class: "nav-badge" }, String(n)) : null);
          }) : []));
      })),

    h("div", { class: "who" },
      h("span", { class: "avatar" }, initials(me.name)),
      h("div", { style: "line-height:1.3;min-width:0;flex:1" },
        h("div", { class: "strong truncate", style: "font-size:12.5px" }, me.name),
        h("div", { class: "xs muted truncate" }, scopeSentence(db, me))),
      /* Bilingual UI (sponsor decision): the toggle names the language it
         SWITCHES TO — the reader who needs it cannot read the current one. */
      h("button", {
        class: "btn btn-ghost", style: "font-size:11px;font-weight:700;letter-spacing:.05em",
        title: getLang() === "fr" ? "Switch to English" : "Passer en français",
        "aria-label": getLang() === "fr" ? "Switch to English" : "Passer en français",
        onClick: () => { setLang(getLang() === "fr" ? "en" : "fr"); App.emit(); },
      }, getLang() === "fr" ? "EN" : "FR"),
      /* R-11 — the recipient owns the language of their emails and the
         cadence; one small dialog, saved on the account. */
      h("button", {
        class: "btn btn-ghost", title: t("Notification preferences"),
        "aria-label": t("Notification preferences"), onClick: prefsDialog,
      }, icon("bellish", 14) ?? "✉"),
      h("button", {
        class: "btn btn-ghost", title: themeTitle(), "aria-label": themeTitle(),
        onClick: cycleTheme,
      }, icon(currentTheme() === "dark" ? "sun" : "moon", 14)),
      h("button", {
        class: "btn btn-ghost", title: t("Sign out"), "aria-label": t("Sign out"),
        onClick: signOut,
      }, icon("logout", 14))));
}

/* ── theme ────────────────────────────────────────────────────────────
   Three states, not two: follow the operating system, or override it in
   either direction. A control room that is dark at 07:00 because the
   laptop says so is not a preference anyone asked for. */

const THEME_KEY = "meridian-theme";

function storedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function currentTheme() {
  const stored = storedTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function themeTitle() {
  const s = storedTheme();
  return s ? `Theme: ${s} — click to follow the system` : "Theme: following the system";
}
export function applyTheme() {
  const stored = storedTheme();
  if (stored === "light" || stored === "dark") {
    document.documentElement.setAttribute("data-theme", stored);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
function cycleTheme() {
  const order = [null, "light", "dark"];
  const next = order[(order.indexOf(storedTheme()) + 1) % order.length];
  try {
    if (next) localStorage.setItem(THEME_KEY, next);
    else localStorage.removeItem(THEME_KEY);
  } catch { /* a private window still gets the session-local switch */ }
  applyTheme();
  App.emit();
}

/** What this account actually holds, in words rather than a role name. */
function scopeSentence(db, me) {
  if (me.role === "admin") return "Administrator · unrestricted";
  const names = [
    ...me.grants.programmes.map((id) => (db.programmes.find((p) => p.id === id) || {}).name || id),
    ...me.grants.sites.map((id) => (db.sites.find((s) => s.id === id) || {}).city || id),
  ];
  if (!names.length) return me.role === "viewer" ? "Viewer · read-only" : `${me.role} · no grants held`;
  return `${me.role === "viewer" ? "Viewer" : me.role === "group" ? "Group" : "Site"} · ${names.join(", ")}`;
}

function header(db) {
  const [kicker, fixedTitle] = TITLES[App.ui.view] ?? ["", ""];
  let title = t(fixedTitle);
  if (App.ui.view === "project") {
    title = (Engine.project(db, App.ui.project) || {}).name || t("Project overview");
  }

  /* R7.3 — a control the account has no authority for is absent, not
     greyed out. C2's condition: do not show people doors they cannot open. */
  const action = HEADER_ACTIONS[App.ui.view]?.(db);

  const filters = App.ui.view === "meetings" ? [] : [
    searchBox(App.ui.q, "Filter projects", (v) => App.set({ q: v })),
    selectField("Programme", App.ui.scope,
      [{ value: "all", label: "All programmes" }]
        .concat(db.programmes.map((p) => ({ value: p.id, label: p.name }))),
      (v) => App.set({ scope: v }), "168px"),
    selectField("Site", App.ui.siteScope,
      [{ value: "all", label: "All sites" }]
        .concat(db.sites.map((x) => ({ value: x.id, label: x.city }))),
      (v) => App.set({ siteScope: v }), "126px"),
    selectField("Health", App.ui.healthScope,
      [{ value: "all", label: "Any" }, { value: "G", label: "Green" },
       { value: "A", label: "Amber" }, { value: "R", label: "Red" }],
      (v) => App.set({ healthScope: v }), "100px"),
  ];

  return h("header", { class: "hdr" },
    h("button", {
      class: "btn btn-ghost menu-btn", "aria-label": "Open navigation",
      onClick: () => { App.ui.sidebarOpen = !App.ui.sidebarOpen; App.emit(); },
    }, icon("menu", 18)),
    /* R-06 — the view title is the page's ONE h1 (heading navigation
       needs its entry point), and the document title follows it, which is
       what a screen reader announces on every change of page. */
    h("div", { class: "hdr-title" },
      h("div", { class: "kicker" }, t(kicker)),
      (() => {
        document.title = title + " · Meridian IT-PMO";
        return h("h1", null, title);
      })()),
    h("div", { class: "hdr-actions" },
      ...filters,
      h("button", { class: "btn", title: t("Search everything (Ctrl-K)"), onClick: palette },
        icon("search", 13)),
      /* Help reachable by mouse, from every view (adoption committee I3):
         a shortcut only a shortcut can open is a secret, not help. */
      h("button", { class: "btn", title: t("Help — how Meridian works"), "aria-label": t("Help"), onClick: helpDialog }, "?"),
      action
        ? h("button", { class: "btn btn-primary", onClick: action.run }, icon("plus", 13), t(action.label))
        : null));
}

/* ── command palette ──────────────────────────────────────────────── */

function palette() {
  const db = App.db;
  const entries = [];
  navFor(App.me).forEach((g) => g.items.forEach(([k, l]) =>
    entries.push({ kind: "Go to", label: l, meta: g.label, run: () => go("#/" + k) })));
  db.projects.forEach((p) => entries.push({
    kind: "Project", label: p.name,
    meta: p.id + " · " + (Engine.site(db, p.site) || {}).city + " · " + p.governanceLevel,
    run: () => go("#/project/" + p.id),
  }));
  db.raid.forEach((r) => entries.push({
    kind: r.type, label: r.title, meta: r.id + " · exposure " + Engine.exposure(r),
    run: () => go("#/risk/" + r.id),
  }));
  db.crs.forEach((c) => entries.push({
    kind: "Change", label: c.title, meta: c.id + " · " + c.status,
    run: () => go("#/change/" + c.id),
  }));
  db.people.forEach((p) => entries.push({
    kind: "Person", label: p.name, meta: p.role + " · " + (Engine.site(db, p.site) || {}).city,
    run: () => go("#/resources"),
  }));
  db.docs.forEach((d) => entries.push({
    kind: "Document", label: d.name, meta: (d.project || "Portfolio") + " · " + d.status,
    run: () => go("#/documents"),
  }));
  /* A-03 — the two teaching surfaces are commands like any other, so
     Ctrl-K is a second way back to them from anywhere in the product. */
  entries.push({ kind: t("Help"), label: t("Start here — what this account is for"),
    meta: t("Orientation"), run: () => startHere(true) });
  entries.push({ kind: t("Help"), label: t("How Meridian works"),
    meta: t("Health, gates, scope, referrals"), run: helpDialog });
  entries.push({ kind: "Action", label: t("Sign out"), meta: "Session", run: signOut });

  let sel = 0;
  let shown = entries.slice(0, 40);
  const list = h("div", { class: "cmd-list" });
  const input = h("input", {
    class: "cmd-in", placeholder: "Search projects, people, risks, changes…",
    "aria-label": "Search everything",
  });

  const draw = () => {
    clear(list);
    if (!shown.length) {
      list.appendChild(h("div", { class: "cmd-item" },
        h("span", { class: "muted small" }, "Nothing matches. Try a project code or a person's name.")));
      return;
    }
    shown.forEach((e, i) => list.appendChild(h("div", {
      class: "cmd-item" + (i === sel ? " on" : ""),
      onMouseenter: () => { sel = i; draw(); },
      onClick: () => { close(); e.run(); },
    },
      h("span", { class: "kicker", style: "width:74px;flex:none" }, e.kind),
      h("div", { class: "sp" },
        h("div", { class: "strong small truncate" }, e.label),
        h("div", { class: "xs muted truncate" }, e.meta)))));
    const on = list.querySelector(".cmd-item.on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  };

  const filter = () => {
    const t = input.value.trim().toLowerCase();
    shown = (t
      ? entries.filter((e) => (e.label + " " + e.meta + " " + e.kind).toLowerCase().includes(t))
      : entries).slice(0, 40);
    sel = 0;
    draw();
  };
  input.addEventListener("input", filter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === "Enter" && shown[sel]) { e.preventDefault(); const r = shown[sel].run; close(); r(); }
  });

  const back = h("div", { class: "backdrop", style: "align-items:flex-start;padding-top:10vh" },
    h("div", { class: "cmd" }, input, list));
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  back.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  function close() { back.remove(); }
  $("#overlay").appendChild(back);
  draw();
  setTimeout(() => input.focus(), 20);
}

/**
 * A-02 — la page qui explique le produit, dans la langue de qui la lit.
 *
 * Elle était intégralement en anglais, et le dialogue d'accueil — lui
 * traduit — y envoyait le lecteur francophone. Quelqu'un qui suit en
 * français le conseil que l'outil vient de lui donner ne doit pas tomber
 * sur une page qu'il ne lira pas : il ne redemande jamais deux fois.
 *
 * A-03 — et elle donne accès à « Par où commencer », qui ne s'ouvrait
 * qu'une fois dans la vie d'un compte et devenait irrécupérable.
 */
function helpDialog() {
  const rows = [
    ["Ctrl-K / ⌘K", t("Search everything — projects, people, risks, changes, documents")],
    ["?", t("This list")],
    ["Esc", t("Close a dialog")],
    [t("Drag a Gantt bar"), t("Move a stage; drag its edge to change the length")],
    ["← →", t("On a Gantt bar, nudge a day; with shift, a week")],
    ["← →", t("On a board card, move it between columns")],
    [t("Double-click"), t("Edit a Gantt stage or a board card")],
  ];
  const HOW = [
    [t("Health (RAG)"), t("Green/Amber/Red is derived from schedule and cost indices — hover any dot to read WHY. A manual override always carries a written reason.")],
    [t("Gates"), t("A project advances phase only when the next gate's evidence documents are approved. Overriding a gate is a recorded governance exception.")],
    [t("Your scope"), t("You see and edit what your grants name. A group programme delivered at your site is readable, never editable — raise a CONCERN on it instead.")],
    [t("Decisions & referrals"), t("A site meeting refers what is above its authority; the group agenda picks it up automatically and its decision retires the referral.")],
    [t("Prioritisation score"), t("Fit, value and risk pull a project up the queue; effort pulls it down. The score only ranks — it never decides. A hand-placed rank overrules it, for when the room does.")],
  ];
  const line = ([k, v]) =>
    h("div", { style: "display:flex;gap:14px;padding:8px 0;border-bottom:1px solid var(--rule-1)" },
      h("span", { class: "tag tag-out", style: "min-width:130px;justify-content:flex-start" }, k),
      h("span", { class: "small" }, v));
  const body = h("div", null,
    h("div", { class: "kicker" }, t("How Meridian works")),
    ...HOW.map(line),
    h("div", { style: "height:14px" }),
    h("div", { class: "kicker" }, t("Keyboard & direct manipulation")),
    ...rows.map(line),
    h("div", { style: "height:14px" }),
    h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" },
      h("button", { class: "btn btn-sm", onClick: () => { App.emit("close-dialogs"); startHere(true); } },
        t("Start here — what this account is for")),
      h("span", { class: "xs muted" }, t("Reopen the orientation for your role, at any time"))),
    h("p", { class: "xs muted", style: "margin-top:14px" },
      t("Need access or a grant changed? Any account marked ADMIN on the sign-in screen's directory can help.")));
  dialog({ title: t("Help"), kicker: "Meridian IT-PMO", body });
}

/* ── render ───────────────────────────────────────────────────────── */

let signedIn = false;

function render() {
  const root = $("#root");
  if (!signedIn) return;
  if (!App.ready) {
    clear(root);
    root.appendChild(h("div", { class: "sec", style: "padding:40px" },
      h("div", { class: "kicker" }, "Meridian"), h("h3", null, "Loading the portfolio…")));
    return;
  }

  const db = App.db;
  clear(root);
  const view = VIEWS[App.ui.view] ?? VIEWS.portfolio;
  let body;
  try {
    body = view(db);
  } catch (e) {
    console.error(e);
    body = h("div", { class: "sec" },
      h("div", { class: "kicker acc" }, "This view could not be drawn"),
      h("p", { class: "small muted" }, String(e && e.message)));
  }

  root.appendChild(h("div", { class: "app" },
    sidebar(db),
    h("main", { class: "main" },
      header(db),
      h("div", { class: "scroll", id: "scroll" }, body))));
}

async function signOut() {
  try { await api.logout(); } catch { /* the cookie is going either way */ }
  signedIn = false;
  App.db = null;
  App.me = null;
  App.ready = false;
  /* Leave no route behind: the next person to sign in on this browser
     should land on their own first screen, not on the last one this
     account was looking at. */
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  renderLogin($("#root"), onSignedIn);
}

async function onSignedIn() {
  signedIn = true;
  App.ready = false;
  render();
  try {
    await App.load();
    /* A one-site account lands scoped to its grant (site committee G4):
       nothing about "all sites" is their default reality. */
    if (App.me.role === "site" && App.me.grants.sites.length === 1 && App.ui.siteScope === "all") {
      App.ui.siteScope = App.me.grants.sites[0];
    }
    /* No hash yet → land on the personal surface (UX committee): the
       first screen answers "what must I do", not "how is the group". */
    if (!location.hash && App.me.personId) location.hash = "#/my";
    readRoute();
    render();
    if (App.me.mustChangePassword) forcePasswordChange();
    else startHere();
  } catch (e) {
    reportError(e, "Could not load the portfolio");
  }
}

/* Adoption committee I4 — an admin-provisioned password is not yours
   until you change it. The dialog cannot be dismissed into the app;
   the only exits are a new password or signing out. */
function forcePasswordChange() {
  return formDialog({
    /* No corner X, no Escape, no click-away: the server refuses every
       write from this session until the password is the holder's own, so
       a dialog that could be dismissed would only hide that refusal. */
    dismissible: false,
    /* Labels reach formDialog untranslated — it calls t() itself. */
    cancelLabel: "Sign out",
    onCancel: signOut,
    title: t("Choose your own password"), kicker: t("First sign-in"),
    fields: [
      { key: "current", label: t("The password you were given"), type: "password" },
      { key: "next", label: t("Your new password (8+ characters)"), type: "password" },
    ],
    saveLabel: "Set password",
    onSave: async (v) => {
      if (!v.next || v.next.length < 8) { toast(t("Could not complete: ") + t("Set password"), "Use at least 8 characters", true); return false; }
      const ok = await App.write(t("Password changed"), (a) => a.post("/auth/password", { current: v.current, next: v.next }),
        { detail: t("It is yours now"), refresh: false });
      if (ok !== false) App.me.mustChangePassword = false;
      return ok;
    },
  });
}

/* R-11 — language of the messages, and how often they come. */
function prefsDialog() {
  formDialog({
    title: t("Notification preferences"), kicker: App.me.name,
    fields: [
      { key: "locale", label: t("Language of my emails"), type: "select",
        value: App.me.locale ?? "", options: [
          { value: "", label: t("Follow the interface") },
          { value: "fr", label: "Français" }, { value: "en", label: "English" }] },
      { key: "notifyPref", label: t("Cadence"), type: "select",
        value: App.me.notifyPref ?? "immediate", options: [
          { value: "immediate", label: t("As things happen") },
          { value: "daily", label: t("Daily") }, { value: "weekly", label: t("Weekly") },
          { value: "off", label: t("Nothing by email") }] },
    ],
    saveLabel: "Save preferences",
    onSave: async (v) => {
      const ok = await App.write(t("Preferences saved"),
        (a) => a.patch("/auth/preferences", { locale: v.locale, notifyPref: v.notifyPref }),
        { refresh: false });
      if (ok !== false) { App.me.locale = v.locale; App.me.notifyPref = v.notifyPref; }
      return ok;
    },
  });
}

/**
 * Role-aware orientation (adoption committee I2, reworked for A-03).
 *
 * It used to be a one-time ticket: shown once at first sign-in, its
 * "don't show again" box ticked BY DEFAULT, reachable from nowhere else.
 * Closing it by reflex lost it for good — and a promotion to another role
 * never showed the three lines written for that role, because the account
 * was already on the seen list.
 *
 * Now: the box starts unticked, the page can be reopened from Help or the
 * command palette at any time, and the memory records the ROLE it was
 * read for — so a change of role brings it back once, unasked.
 */
const START_KEY = "meridian-started";
function startHere(forced = false) {
  let seen;
  try { seen = JSON.parse(localStorage.getItem(START_KEY) || "[]"); } catch { seen = []; }
  const mark = App.me.id + ":" + App.me.role;
  if (!forced && seen.includes(mark)) return;
  const BY_ROLE = {
    admin: "You hold the whole system: accounts, grants, sites and programmes live under Administration. If this book is empty, the Portfolio view shows you the setup path.",
    group: "You govern programmes: start at Programmes for your slate's health and decisions owed, and chair your series under Meetings. Money and baselines are yours alone.",
    site: "Your site is the centre: My site shows what you run, what the group lands on you, and your people's load. Update progress from a project's Stage plan — and raise a concern on any group project at your site.",
    viewer: "You read everything in your scope. Portfolio for the headline, Reports for the narrative — nothing here will let you change a record.",
  };
  /* Held by reference, and read from onClose. The earlier version looked
     the checkbox up by id after the dialog had already removed itself
     from the document, so the answer was never recorded and the dialog
     greeted the same person at every sign-in. */
  /* Unticked: dismissing a box you have not read should not be the same
     act as saying you no longer need it. */
  const remember = h("input", { type: "checkbox" });
  dialog({
    title: t("Start here"), kicker: t("Welcome to Meridian"),
    body: h("div", null,
      h("p", { class: "small", style: "max-width:52ch" }, t(BY_ROLE[App.me.role] || BY_ROLE.viewer)),
      h("p", { class: "small muted", style: "max-width:52ch" },
        t("Ctrl-K searches everything; the ? button in the header explains how health, gates and scope work.")),
      h("p", { class: "xs muted", style: "max-width:52ch" },
        t("You can reopen this page at any time from Help.")),
      h("label", { class: "small", style: "display:flex;gap:8px;align-items:center;margin-top:10px" },
        remember,
        t("Don't show this again"))),
    onClose: () => {
      if (!remember.checked) return;
      try { localStorage.setItem(START_KEY, JSON.stringify(seen.concat(mark))); } catch { /* private window */ }
    },
  });
}

/* ── boot ─────────────────────────────────────────────────────────── */

App.on(() => { if (!openDialogCount()) render(); });

setUnauthenticatedHandler(() => {
  if (!signedIn) return;
  signedIn = false;
  App.ready = false;
  toast("Your session has ended", "Sign in again to continue", true);
  renderLogin($("#root"), onSignedIn);
});

window.addEventListener("hashchange", () => { readRoute(); render(); });

window.addEventListener("keydown", (e) => {
  if (!signedIn) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); }
  else if (e.key === "?" && !/input|textarea|select/i.test(e.target.tagName)) {
    e.preventDefault();
    helpDialog();
  }
});

applyTheme();
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => { applyTheme(); if (App.ready) render(); });

(async function boot() {
  try {
    await api.me();          // a live cookie means we are already in
    await onSignedIn();
  } catch {
    renderLogin($("#root"), onSignedIn);
  }
})();

export { palette, helpDialog };

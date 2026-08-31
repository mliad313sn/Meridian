/**
 * Client state.
 *
 * `App.db` is a read-only mirror of what the server let this user see.
 * Nothing writes to it directly: `App.write()` calls the API and then
 * re-reads the book, so the screen can only ever show a state the server
 * agreed to. That is deliberately less clever than the v4 build's local
 * mutation, and deliberately impossible to get out of step.
 */

import { api, ApiError } from "./api.js";
import { t } from "./i18n.js";
import { can as rbacCan, canWriteProject as rbacWrite, canSeeProject } from "./permissions.js";

/* ── N-06 · l'instantané de lecture ──────────────────────────────────
   Un seul emplacement, portant le compte : changer d'utilisateur ou se
   déconnecter l'efface, sur le patron déjà écrit pour le cache de vue.
   Tout écart ici est silencieux par conception — un navigateur en mode
   privé, un quota plein ou une politique d'entreprise ne doivent jamais
   empêcher l'application de démarrer. */
const SNAP_KEY = "meridian-snapshot";
function saveSnapshot(userId, db, me) {
  if (!userId) return;
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify({
      who: userId, at: new Date().toISOString(), db, me,
    }));
  } catch { /* pas de place, pas d'instantané — l'application fonctionne */ }
}
function readSnapshot() {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.db && s?.me ? s : null;
  } catch { return null; }
}
export function clearSnapshot() {
  try { localStorage.removeItem(SNAP_KEY); } catch { /* rien à faire */ }
}

export const App = {
  db: null,
  me: null,
  ready: false,
  busy: false,
  /* Non nul = ce qui est à l'écran vient de l'instantané, et porte
     l'heure à laquelle il a été pris. La coquille en fait un bandeau. */
  offline: null,

  ui: {
    view: "portfolio", param: null,
    scope: "all",
    siteScope: "all",
    healthScope: "all",
    q: "",
    sort: { key: "name", dir: 1 },
    project: null,
    boardProject: null,
    boardAssignee: "",
    raidFilter: "All", raidCell: null,
    cr: null,
    ganttZoom: "month", ganttProject: "all",
    docFilter: "All",
    meetingSeries: null,
    meetingOccurrence: null,
    auditFilter: {},
    /* V-02 — null is "live"; an id renders Reports from what was frozen
       at that period's close. */
    period: null,
    /* R-07 — one nav group open at a time besides the active view's own. */
    navOpen: null,
    sidebarOpen: false,
    /* A-10 — les écrans réellement ouverts par cette personne, pour que
       les premiers pas se cochent sur un fait plutôt que sur une case.
       De session, pas de compte : ce n'est pas une donnée de gestion,
       et personne d'autre n'a à savoir ce que quelqu'un a regardé. */
    seenViews: new Set(),
  },

  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach((f) => f()); },

  /** Session-only state: filters, selections, which pane is open. */
  set(patch) { Object.assign(this.ui, patch); this.emit(); },

  /* ── loading ────────────────────────────────────────────────────── */

  /**
   * N-06 — la survie hors ligne, en LECTURE SEULE.
   *
   * À Houndé, la liaison satellite tombe. Le responsable informatique de
   * site n'a pas demandé à écrire hors ligne : il a demandé à pouvoir
   * encore lire ce qu'il savait il y a une heure. Le livre est petit
   * (~16 Ko au transfert), on le garde donc à chaque chargement réussi.
   *
   * Rien n'est mis en file. Deux raisons, chacune suffisante : la
   * concurrence de ce produit repose sur `row_version`, qui ne peut pas
   * être honorée contre un livre qu'on n'a pas relu ; et une écriture
   * rejouée plus tard porterait sur la piste un horodatage qui n'est pas
   * celui de l'acte. Mieux vaut un outil qui refuse honnêtement qu'un
   * outil qui promet une synchronisation qu'il ne peut pas tenir.
   *
   * L'instantané porte le compte : A-03 a rappelé qu'un poste partagé de
   * salle de conduite suit tout le monde, et il est effacé à la
   * déconnexion comme le cache de vue l'est déjà.
   */
  async load() {
    try {
      const { db, me } = await api.bootstrap();
      this.db = db;
      this.me = me;
      this.offline = null;
      this.ready = true;
      this.seedSelections();
      saveSnapshot(me?.id, db, me);
      this.emit();
      return db;
    } catch (e) {
      const snap = readSnapshot();
      /* Un instantané ne remplace pas une session : si le serveur répond
         « pas authentifié », il faut se reconnecter, pas lire un cache. */
      if (!snap || e?.status === 401) throw e;
      this.db = snap.db;
      this.me = snap.me;
      this.offline = snap.at;
      this.ready = true;
      this.seedSelections();
      this.emit();
      return snap.db;
    }
  },

  /** Sensible first selections, so no view opens on nothing. */
  seedSelections() {
    const first = this.db.projects[0];
    if (!this.ui.project || !this.db.projects.some((p) => p.id === this.ui.project)) {
      this.ui.project = first?.id ?? null;
    }
    if (!this.ui.boardProject || !this.db.projects.some((p) => p.id === this.ui.boardProject)) {
      const withItems = this.db.projects.find((p) => this.db.items.some((i) => i.project === p.id));
      this.ui.boardProject = (withItems ?? first)?.id ?? null;
    }
    if (!this.ui.cr || !this.db.crs.some((c) => c.id === this.ui.cr)) {
      const pending = this.db.crs.find((c) => c.status === "Pending");
      this.ui.cr = (pending ?? this.db.crs[0])?.id ?? null;
    }
    /* R4.4 — a site user lands on their own site rather than scrolling
       past eleven programmes that are not theirs (A3's condition). */
    if (this.ui.siteScope === "all" && this.me?.role === "site" && this.me.grants.sites.length === 1) {
      this.ui.siteScope = this.me.grants.sites[0];
    }
  },

  /**
   * The single write path.
   *
   * `work` performs the API call; on success the book is re-read so every
   * derived number on screen comes from the server's copy, not from a
   * guess about what the server did.
   */
  /* R-08 — refresh just what a write touched. The whole-book reload made
     the screen honest and made every save cost the whole book over a
     satellite link. `touch` names the collections the write changed; the
     server answers with those alone, from the same serialiser, so the
     invariant holds: nothing on screen the server did not agree to. */
  async refreshCollections(keys) {
    const r = await api.get("/collections?keys=" + encodeURIComponent(keys.join(",")));
    for (const [k, v] of Object.entries(r.collections ?? {})) {
      if (Array.isArray(v)) this.db[k] = v;
      else if (k === "statusDate") this.db.statusDate = v;
    }
    this.seedSelections();
    this.emit();
  },

  /* The daily writes and the collection each one touches. Declared once,
     on the stable English labels, so twenty call sites did not need to
     learn a new option — and a label not listed keeps the full reload,
     which is the safe default for anything the server recalculates. */
  TOUCH_BY_LABEL: {
    "Stage updated": ["activities"], "Stage added": ["activities"], "Stage removed": ["activities"],
    "Milestone added": ["milestones"], "Milestone updated": ["milestones"], "Milestone removed": ["milestones"],
    "RAID item raised": ["raid"], "RAID item updated": ["raid"], "RAID item deleted": ["raid"],
    "Item closed": ["raid"], "Item reopened": ["raid"],
    "Item moved": ["items"], "Work item added": ["items"], "Work item updated": ["items"], "Work item deleted": ["items"],
    "Document added": ["docs"], "Document updated": ["docs"], "Document deleted": ["docs"],
    "Document approved": ["docs"], "Document in review": ["docs"],
    "Absence declared": ["absences"], "Absence withdrawn": ["absences"],
    "Window declared": ["windows"], "Window withdrawn": ["windows"],
    /* PM-02 — le registre est une collection comme une autre ; adopter
       change une ligne, pas le portefeuille. */
    "Lesson raised": ["lessons"], "Lesson updated": ["lessons"],
    "Lesson removed": ["lessons"], "Lesson adopted": ["lessons"],
  },

  async write(label, work, { detail, quiet, refresh = true, touch = null, rethrow = false } = {}) {
    if (touch === null && refresh === true) touch = this.TOUCH_BY_LABEL[label] ?? null;
    /* A write dropped because another is in flight must SAY so (UX
       committee): silence here read as "saved" to a fast typist. */
    if (this.busy) {
      toast(t("One moment"), t("Another change is still saving — try again in a second"), true);
      return false;
    }
    this.busy = true;
    this.emit();
    try {
      const result = await work(api);
      this.lastWriteError = null;
      /* The write has COMMITTED by here. A re-read that fails afterwards
         is a stale screen, not a failed save — reporting it as failure
         invites the user to press Save again and book the cost twice. */
      if (touch && touch.length) {
        try { await this.refreshCollections(touch); }
        catch { await this.load().catch((e) => reportError(e, t("Refreshing the book"))); }
      } else if (refresh) {
        try { await this.load(); }
        catch (e) { reportError(e, t("Refreshing the book")); }
      }
      if (!quiet) toast(label, detail);
      return result ?? true;
    } catch (e) {
      this.lastWriteError = e;   // dialogs read this to keep the failure conversation local
      /* rethrow = the caller (a dialog) owns the failure conversation and
         keeps the user's typed input alive; the toast would only shout
         over it. Refresh-on-stale still runs — the resolution for a
         conflict is the same whoever reports it. */
      if (!rethrow) reportError(e, label);
      // A conflict — or a request that never named its version — means
      // our copy is stale. Refreshing is the resolution for both.
      if (e instanceof ApiError && e.isStale) await this.load().catch(() => {});
      if (rethrow) throw e;
      return false;
    } finally {
      this.busy = false;
      this.emit();
    }
  },

  /* ── authority, mirrored from the server for rendering only ─────── */

  /** R7.3 — controls the user has no authority for are absent, not greyed.
      N-06 — et hors ligne, personne n'a d'autorité d'écriture : ce qui
      est à l'écran vient d'un instantané, donc aucune commande d'écriture
      n'est dessinée. La règle R7.3 fait le reste sans code nouveau — pas
      un bouton grisé qui échouerait, un bouton qui n'existe pas. */
  can(action, resource) {
    if (this.offline) return false;
    return rbacCan(this.me, action, resource).ok;
  },
  canWrite(project) {
    if (this.offline) return false;
    return rbacWrite(this.me, project);
  },
  canSee(project) {
    return canSeeProject(this.me, project);
  },
  get isViewer() { return this.me?.role === "viewer"; },
  get isAdmin() { return this.me?.role === "admin"; },

  /* ── scoped selectors the views share ───────────────────────────── */

  scopedProjects() {
    const { scope, siteScope, healthScope, q } = this.ui;
    let list = this.db.projects.slice();
    if (scope !== "all") list = list.filter((p) => p.programme === scope);
    if (siteScope !== "all") list = list.filter((p) => p.site === siteScope);
    if (healthScope !== "all") {
      list = list.filter((p) => Engine().metrics(this.db, p.id).health.rag === healthScope);
    }
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((p) =>
        (p.name + " " + p.id + " " + personName(this.db, p.pm)).toLowerCase().includes(t));
    }
    return list;
  },

  scopeLabel() {
    const bits = [];
    if (this.ui.scope !== "all") {
      bits.push((this.db.programmes.find((x) => x.id === this.ui.scope) || {}).name);
    }
    if (this.ui.siteScope !== "all") {
      bits.push((this.db.sites.find((x) => x.id === this.ui.siteScope) || {}).city);
    }
    if (this.ui.healthScope !== "all") {
      bits.push({ G: "Green", A: "Amber", R: "Red" }[this.ui.healthScope]);
    }
    return bits.length ? bits.join(" · ") : "All programmes, all sites";
  },

  /** The project row shape the permission mirror expects. */
  projectRow(p) {
    return p && {
      programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel,
    };
  },
};

/* Late-bound so this module has no import cycle with the engine. */
let _engine = null;
export function bindEngine(e) { _engine = e; }
function Engine() { return _engine; }
function personName(db, id) { return (db.people.find((p) => p.id === id) || {}).name || "—"; }

/* ── toasts ───────────────────────────────────────────────────────── */

export function toast(title, detail, warn) {
  const box = document.getElementById("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast" + (warn ? " warn" : "");
  const body = document.createElement("div");
  body.style.flex = "1";
  const b = document.createElement("b");
  b.textContent = title;
  body.appendChild(b);
  if (detail) {
    const d = document.createElement("div");
    d.className = "small";
    d.style.cssText = "opacity:.8;margin-top:2px";
    d.textContent = detail;
    body.appendChild(d);
  }
  const close = document.createElement("button");
  close.className = "bare";
  close.setAttribute("aria-label", "Dismiss");
  close.style.opacity = ".7";
  close.textContent = "✕";
  close.onclick = () => el.remove();
  el.append(body, close);
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, warn ? 5200 : 3400);
}

export function reportError(e, context) {
  if (e instanceof ApiError && e.isUnauthenticated) return; // the handler takes over
  const detail = e instanceof ApiError ? e.message : "Unexpected error";
  /* A failure toast must never lead with the success label — "Stage
     updated · Conflict" reads as saved (UX committee). Say what did
     NOT happen, then why. */
  const title = context ? t("Could not complete: ") + context : t("That did not go through");
  toast(title, detail === "Unexpected error" ? t("Unexpected error") : detail, true);
  if (!(e instanceof ApiError)) console.error(e);
}

/* ── routing ──────────────────────────────────────────────────────── */

export const ROUTES = [
  "my", "inbox", "portfolio", "roadmap", "pipeline", "programmes", "mysite", "project",
  "schedule", "board", "risk", "budget", "change", "resources", "meetings",
  "documents", "reports", "lessons", "locations", "adoption", "admin",
];

/* Views an account has no use for are absent from the navigation (R7.3),
   which is a matter of what is drawn — a typed hash, or one left in the
   address bar by whoever signed in before, reaches them anyway. The
   server refuses the data either way; this keeps the screen honest. */
export const ROUTE_ROLES = {
  programmes: ["admin", "group"],
  /* A-08 — la mesure de l'adoption est une lecture de gouvernance :
     même autorité que le registre des décisions. */
  adoption: ["admin", "group"],
  mysite: ["site"],
  admin: ["admin"],
};
export function routeAllowed(view, me) {
  const roles = ROUTE_ROLES[view];
  return !roles || (me && roles.includes(me.role));
}

export function go(hash) {
  location.hash = hash.startsWith("#") ? hash : "#/" + hash;
}

export function readRoute() {
  const raw = (location.hash || "#/portfolio").replace(/^#\/?/, "");
  const [view, param] = raw.split("/");
  let v = ROUTES.includes(view) ? view : "portfolio";
  if (!routeAllowed(v, App.me)) v = "portfolio";
  App.ui.view = v;
  App.ui.seenViews.add(v);
  App.ui.param = param ? decodeURIComponent(param) : null;
  if (v === "project" && param) App.ui.project = param;
  if (v === "change" && param) App.ui.cr = param;
  if (v === "board" && param) App.ui.boardProject = param;
  if (v === "meetings" && param) App.ui.meetingOccurrence = param;
  App.ui.sidebarOpen = false;
}

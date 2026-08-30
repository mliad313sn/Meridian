/**
 * VIEWS — the twelve screens of the v4 build, carried over, plus the
 * Meetings module the committee added (D-04).
 *
 * The render code is the original. What changed is the write path: every
 * `App.mutate(label, d => …)` that edited a local object is now
 * `App.write(label, api => …)` that calls the server and re-reads the
 * book. And every control that writes is wrapped in an authority check,
 * so an account without the authority never sees the button (R7.3).
 */

import {
  h, s, frag, clear, $, icon, dialog, confirmDialog, form, formDialog,
  table, sortRows, sortableTable, ragDot, meter, kpiStrip, sectionHead,
  tag, chip, statusTag, avatar, searchBox, selectField, emptyState,
  sparkline, curveChart, legend, fold, safeHref,
} from "../ui/kit.js";
import { App, go, toast, reportError } from "../lib/state.js";
import { api, saveText, download } from "../lib/api.js";
import { t, tData } from "../lib/i18n.js";
import {
  Engine, D, iso, days, addDays, addMonths, workdays, startOfWeek, isoWeek,
  fmtDate, fmtDateLong, fmtMon, monthKey, money, signedMoney, cash, pct, idx,
  clamp, sum, uniq, by, GATES, PHASES, RAID_TYPES, RESPONSES, DOC_TYPES,
  RAG_LABEL, MONTHS, DAY,
} from "../../../shared/engine.js";

import { meetingsView, invalidateMeetings } from "./meetings.js";
import { accessPanel, directoryPanel, referencePanel, federationPanel, notificationsPanel, importPanel, invalidateAdmin } from "./administration.js";

export const Views = {};

/**
 * Which governance levels this account may set.
 *
 * A site lead can only ever create or keep a site-level project; letting
 * them promote one to group would be letting them grant themselves group
 * authority (R1.6), so the option is simply not offered.
 */
function governanceOptions(p) {
  const all = [
    { value: "group", label: "Group — run by the group across sites" },
    { value: "site", label: "Site — owned by the lead site" },
  ];
  if (App.me.role === "admin") return all;
  if (App.me.role === "group") return all;
  return all.filter((o) => o.value === "site");
}

/* ── small shared helpers ─────────────────────────────────────────── */

export const initials = (name) =>
  String(name || "?").split(/[\s.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const csvEscape = (v) => {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
const toCSV = (rows, cols) =>
  [cols.map((c) => csvEscape(c.label)).join(",")]
    .concat(rows.map((r) => cols.map((c) => csvEscape(c.get(r))).join(",")))
    .join("\n");

const closeDialog = () => { const b = $(".backdrop"); if (b) b.remove(); };

/** The project row shape the shared permission module expects. */
const asRow = (p) => p && {
  programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel,
};
/** May the signed-in account write to this project? */
export const mayWrite = (p) => App.canWrite(asRow(p));
/** May it perform this specific action on this project? */
export const may = (action, p) => App.can(action, { project: asRow(p) });
/** ADR-8 — rows the SDP sync owns are read-only mirrors here. */
const fromSdp = (x) => x && x.origin === "sdp";

/**
 * The create button a view puts in its own header.
 *
 * R7.3 again: these were drawn unconditionally, so a read-only account was
 * offered "Raise change" and "Add document" on screens it can only read.
 * The answer already exists — HEADER_ACTIONS is what the app shell asks —
 * so the view asks the same question rather than repeating the rule and
 * getting it wrong a second time. Declared before HEADER_ACTIONS and used
 * only at render time, which is long after the module has evaluated.
 */
function primaryAction(view, db) {
  const a = HEADER_ACTIONS[view] && HEADER_ACTIONS[view](db);
  return a ? h("button", { class: "btn btn-sm btn-primary", onClick: a.run },
                 icon("plus", 12), t(a.label)) : null;
}


/** An index cell that says "too early" rather than printing noise. */
function indexCell(m, key, amber) {
  if (!m.measurable) return h("span", { class: "mono muted", title: "Too early to measure — less than 2% of the plan has been spent" }, "—");
  const v = m[key];
  return h("span", { class: "mono", style: v < amber ? "color:var(--sig-amber);font-weight:600" : null }, idx(v));
}

/* ── live side-data the rail and My week share ─────────────────────────
   Views render synchronously from the bootstrap book; these two extras
   (my meeting actions, the week's digest) arrive by fetch, cached per
   book load, and re-render on landing. A failure is carried as a failure,
   so the block says so rather than reporting nothing happened. */
const live = { tag: null, who: null, data: {} };
/** A list that arrived as a failure, so the empty state can say which. */
const failedList = () => Object.assign([], { failed: true });
function liveFetch(key, fetcher, unwrap) {
  /* Keyed on the book AND the account: signing out and in as someone else
     replaces both, and a response still in flight for the previous one
     must never land in the new one's cache. Keys are open — a reported
     period is cached under its own id — so the whole map is dropped
     rather than a fixed list of names nulled. */
  if (live.tag !== App.db || live.who !== (App.me?.id ?? null)) {
    live.tag = App.db;
    live.who = App.me?.id ?? null;
    live.data = {};
  }
  if (live.data[key] != null) return live.data[key];
  const tag = live.tag, who = live.who;
  live.data[key] = [];   // in flight → render empty once, then re-render with data
  const settle = (value) => {
    if (live.tag !== tag || live.who !== who) return;   // answered for a book we have left
    live.data[key] = value;
    App.emit();
  };
  fetcher()
    .then((r) => settle(unwrap(r) || []))
    /* Recording [] made a dropped request indistinguishable from a quiet
       week: the panel then made a positive claim about governance data it
       never received. */
    .catch(() => settle(failedList()));
  return live.data[key];
}
const myOpenActions = () =>
  liveFetch("actions", () => api.get("/meetings/actions?status=Open"), (r) => (r.actions || [])
    /* A person-less account owns nothing; without this, `null === null`
       hands it every unowned action in the book. */
    .filter((a) => App.me.personId && a.ownerId === App.me.personId));
const weekDigest = () => liveFetch("digest", () => api.get("/digest"), (r) => r.entries);
/* N-05 — ma boîte. Elle ne lit pas le livre : le serveur filtre sur mon
   compte et rien d'autre, et le client n'a donc rien à filtrer non plus. */
const myInbox = () => liveFetch("inbox", () => api.get("/auth/notifications?limit=80"),
  (r) => (r.items || []).map((n) => ({ ...n, unread: !n.readAt })));

/* ── first-run: the empty production book (adoption committee I1) ─────
   An empty book must read as "the rollout has begun", never as a broken
   product — and never advise widening filters there is nothing behind. */
function emptyBookPanel(db) {
  /* A-04 — the very first screen anybody sees was in English while its
     French had already been written and never called. The translations
     were there; the calls were not. */
  if (App.me.role !== "admin") {
    return h("section", { class: "sec", style: "max-width:60ch;margin:40px auto" },
      h("div", { class: "kicker" }, t("Being set up")),
      h("h3", null, t("This portfolio has no projects yet")),
      h("p", { class: "small muted" },
        t("Your administrator is building the book — sites, programmes and accounts come first. " +
          "You will see your slate here the moment something is granted to you. " +
          "If you expected access already, any account marked ADMIN on the sign-in directory can grant it.")));
  }
  const steps = [
    { done: db.sites.length > 0, label: t("Add your first site"), hint: t("Administration → Sites"), go: () => go("#/admin") },
    { done: db.programmes.length > 0, label: t("Add a programme"), hint: t("Administration → Programmes"), go: () => go("#/admin") },
    { done: db.people.length > 0, label: t("Add people"), hint: t("Administration → Directory"), go: () => go("#/admin") },
    { done: false, label: t("Create accounts & grants"), hint: t("Administration → Accounts — a group/site account needs a grant to see anything"), go: () => go("#/admin") },
    { done: db.projects.length > 0, label: t("Create the first project"), hint: t("The New project button appears here once a site and a programme exist"), go: () => go("#/portfolio") },
  ];
  return h("section", { class: "sec", style: "max-width:64ch;margin:40px auto" },
    h("div", { class: "kicker" }, t("First run")),
    h("h3", null, t("Set up the portfolio")),
    h("p", { class: "small muted", style: "margin-bottom:14px" },
      t("The book is empty — this is the setup order. Each step ticks itself as the data arrives. " +
        "Connected to an SDP dashboard? Its sync fills sites, people and the ops-strategy programme for you.")),
    ...steps.map((s, i) => h("div", { class: "list-row linkish", onClick: s.go, tabindex: 0,
        onKeydown: (e) => e.key === "Enter" && s.go() },
      h("span", { class: "num", style: "width:26px;flex:none;color:" + (s.done ? "var(--sig-green, #2c7)" : "var(--muted)") },
        s.done ? "✓" : String(i + 1)),
      h("div", { style: "min-width:0" },
        h("div", { class: "strong small" }, s.label),
        h("div", { class: "xs muted" }, s.hint)))));
}

/* ── Portfolio ────────────────────────────────────────────────────── */
Views.portfolio = (db) => {
  if (!db.projects.length) return emptyBookPanel(db);
  const list = App.scopedProjects();
  const roll = Engine.roll(db, list);
  const openRisks = db.raid.filter(r => r.status === "Open" && r.type === "Risk" &&
    (!r.project || list.some(p => p.id === r.project)));
  const escalated = openRisks.filter(r => Engine.escalation(db, r).level === "Steering");

  /* ADR-10 — budget-less strategy mirrors (the SDP ops programme) are outside
     EVM by rule, not by zero: they contribute nothing to Σ and are counted
     apart, so "funded" keeps meaning funded. */
  const funded = list.filter((p) => p.budget > 0).length;
  const unfunded = list.length - funded;
  const kpis = kpiStrip([
    { label: t("Portfolio value"), value: money(roll.bac),
      note: funded + " funded project" + (funded === 1 ? "" : "s") +
            (unfunded ? " · " + unfunded + " strategy (no budget)" : "") },
    { label: t("On track"), value: roll.count ? Math.round(roll.green / roll.count * 100) + "%" : "—", note: roll.green + " green · " + roll.amber + " amber · " + roll.red + " red" },
    { label: t("Schedule index"), value: idx(roll.spi), note: roll.spi < 1 ? "behind the plan" : "at or ahead of plan", accent: roll.spi < db.settings.amberSpi },
    { label: t("Cost index"), value: idx(roll.cpi), note: roll.cpi < 1 ? "spending faster than earning" : "inside the envelope", accent: roll.cpi < db.settings.amberCpi },
    { label: t("Forecast variance"), value: signedMoney(roll.vac), note: "against " + money(roll.bac) + " approved", accent: roll.vac < 0 },
    { label: t("Open risks"), value: String(openRisks.length), note: escalated.length + " above the escalation threshold", accent: escalated.length > 0 },
  ]);

  const cols = [
    { key: "name", label: "Project", sort: r => r.p.name, get: r => h("div", null,
        h("div", { class: "strong" }, r.p.name),
        h("div", { class: "xs muted" }, r.p.id + " · " + (Engine.programme(db, r.p.programme) || {}).name + " · " + Engine.personName(db, r.p.pm))) },
    { key: "site", label: "Site", sort: r => r.p.site, get: r => h("span", { class: "small" }, (Engine.site(db, r.p.site) || {}).city) },
    { key: "phase", label: "Phase", sort: r => r.p.phase, get: r => h("span", { class: "small" }, r.p.phase) },
    { key: "health", label: "Health", sort: r => ({ R: 0, A: 1, G: 2 })[r.m.health.rag],
      get: r => h("span", { title: r.m.health.why }, ragDot(r.m.health.rag)) },
    { key: "pct", label: "Progress", sort: r => r.pctShown, width: "128px", get: r => h("div", null,
        h("div", { class: "bar-lbl mono" }, h("span", null, pct(r.pctShown)),
          r.p.budget > 0 ? h("span", null, pct(r.m.plannedComplete) + " plan") : h("span", null, "reported")),
        meter(r.pctShown, r.pctShown < r.m.plannedComplete - 0.05 && r.p.budget > 0 ? "var(--color-accent)" : "var(--color-text)", "thin")) },
    /* ADR-10 — no earned-value index exists without a budget; a 1.00 there
       would read as "on plan", which nothing measured. */
    { key: "spi", label: "SPI", align: "r", sort: r => r.m.spi, get: r => r.p.budget > 0 ? indexCell(r.m, "spi", db.settings.amberSpi) : h("span", { class: "mono muted", title: "No budget — outside EVM" }, "—") },
    { key: "cpi", label: "CPI", align: "r", sort: r => r.m.cpi, get: r => r.p.budget > 0 ? indexCell(r.m, "cpi", db.settings.amberCpi) : h("span", { class: "mono muted", title: "No budget — outside EVM" }, "—") },
    { key: "finish", label: "Finish", align: "r", sort: r => r.p.finish, get: r => h("div", null,
        h("div", { class: "mono small" }, fmtDate(r.p.finish)),
        r.m.slipDays > 7 ? h("div", { class: "xs bad strong" }, "forecast +" + r.m.slipDays + "d") : null) },
  ];
  const rows = list.map(p => {
    const m = Engine.metrics(db, p.id);
    /* A budget-less strategy mirror has no EV to derive progress from —
       its progress IS the weight-averaged reported pct of its stages
       (for the SDP ops programme: exactly the objective's progress_pct). */
    const acts = db.activities.filter(a => a.project === p.id);
    const wsum = acts.reduce((n, a) => n + Number(a.weight), 0);
    const reported = wsum ? acts.reduce((n, a) => n + Number(a.weight) * a.pct, 0) / wsum / 100 : 0;
    return { p, m, id: p.id, pctShown: p.budget > 0 ? m.pctComplete : reported };
  });

  const register = h("section", { class: "l sec" },
    sectionHead(t("Project register"), App.scopeLabel(),
      h("button", { class: "btn btn-sm", onClick: () => exportCSV(rows) }, icon("download", 12), "CSV"),
      primaryAction("portfolio", db)),
    sortableTable({ cols, rows, onRow: r => go("#/project/" + r.p.id),
      empty: { title: t("No projects match this scope"), body: t("Widen the programme, site or health filter in the header.") } }));

  /* right rail */
  const decisions = Engine.decisions(db);
  const rail = h("aside", { class: "sec" },
    sectionHead(t("Decisions owed"), decisions.length + " open"),
    h("div", { style: "margin-bottom:22px" }, decisions.length ? decisions.slice(0, 6).map(d =>
      h("div", { class: "list-row linkish", onClick: d.go, tabindex: 0, onKeydown: e => e.key === "Enter" && d.go() },
        h("span", { class: "mark" + (d.urgent ? " mark-acc" : "") }),
        h("div", { style: "min-width:0" },
          h("div", { class: "kicker" }, d.kind),
          h("div", { class: "strong small", style: "margin:2px 0 1px" }, d.title),
          h("div", { class: "xs muted" }, d.meta)))) :
      h("div", { class: "small muted" }, "Nothing is waiting on a decision. The next gate is " + fmtDate((Engine.horizon(db, 1)[0] || {}).date) + ".")),

    /* Your action debt follows you out of the Meetings screen (UX
       committee, value I-4) — an owner who never opens Meetings still
       meets their actions here. */
    (() => {
      const mine = myOpenActions();
      if (!mine.length) return null;
      return h("div", null,
        h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead(t("My open actions"), String(mine.length)),
        h("div", { style: "margin-bottom:22px" }, mine.slice(0, 5).map(a =>
          h("div", { class: "list-row linkish", onClick: () => go("#/meetings") },
            h("span", { class: "mark" + (a.dueDate && a.dueDate < db.statusDate ? " mark-acc" : "") }),
            h("div", { style: "min-width:0" },
              h("div", { class: "strong small" }, a.title),
              h("div", { class: "xs muted" },
                (a.seriesName ? a.seriesName + " · " : "") +
                (a.dueDate ? "due " + fmtDate(a.dueDate) : "no date")))))));
    })(),

    /* The week's movement, from the audit trail (UX committee, value
       I-2): what flipped, slipped, was approved or was raised — the
       diff people used to keep last week's spreadsheet to see. */
    (() => {
      const dg = weekDigest();
      if (!dg.length) return null;
      return h("div", null,
        h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead(t("This week"), t("last 7 days")),
        h("div", { style: "margin-bottom:22px" }, dg.slice(0, 6).map(e =>
          h("div", { class: "list-row" },
            h("div", { style: "min-width:0" },
              h("div", { class: "kicker" }, e.action + (e.entityId ? " · " + e.entityId : "")),
              h("div", { class: "xs muted" }, e.detail ? String(e.detail).slice(0, 90) : ""),
              h("div", { class: "xs muted" }, String(e.at).slice(0, 10) + " · " + e.by))))));
    })(),

    h("hr", { class: "hr" }),
    h("div", { style: "height:18px" }),
    sectionHead(t("Next on the calendar")),
    h("div", { style: "margin-bottom:22px" }, Engine.horizon(db, 6).map(m =>
      h("div", { class: "list-row", style: "gap:12px;cursor:pointer", onClick: () => go("#/project/" + m.project) },
        h("div", { class: "num", style: "width:52px;flex:none;font-size:12px;letter-spacing:.04em" },
          fmtDate(m.date).slice(0, 6).toUpperCase()),
        h("div", { style: "min-width:0" },
          h("div", { class: "strong small" }, m.name),
          h("div", { class: "xs muted" }, m.projectName))))),

    h("hr", { class: "hr" }),
    h("div", { style: "height:18px" }),
    sectionHead(t("Programme mix")),
    h("div", null, db.programmes.map(pr => {
      const ps = list.filter(p => p.programme === pr.id);
      if (!ps.length) return null;
      const r = Engine.roll(db, ps);
      const w = n => (n / ps.length * 100) + "%";
      return h("div", { style: "padding:11px 0;border-bottom:1px solid var(--rule-1);cursor:pointer",
        onClick: () => App.set({ scope: App.ui.scope === pr.id ? "all" : pr.id }) },
        h("div", { style: "display:flex;align-items:baseline;gap:8px" },
          h("div", { class: "strong small", style: "flex:1" }, pr.name),
          h("div", { class: "mono small" }, money(r.bac))),
        h("div", { class: "mix", style: "margin:6px 0 4px" },
          h("i", { style: { width: w(r.green), background: "var(--color-text)" } }),
          h("i", { style: { width: w(r.amber), background: "var(--sig-amber)" } }),
          h("i", { style: { width: w(r.red), background: "var(--color-accent)" } })),
        h("div", { class: "xs muted" }, ps.length + " projects · SPI " + idx(r.spi) + " · CPI " + idx(r.cpi)));
    })));

  return h("div", null, kpis, h("div", { class: "split" }, register, rail));
};

/* ── My week — the personal landing (UX committee, daily-1) ────────────
   One screen answering "what must I do", assembled from data the
   bootstrap already carries plus one actions call. Every row deep-links;
   every list has an honest empty state. */
/* ── N-05 · le centre de notification ─────────────────────────────────
   Trois choses seulement s'y font : voir ce qui m'attend, marquer lu, et
   suivre le lien vers l'objet. Agir sur l'objet passe par sa propre
   route, avec son contrôle d'autorité et son audit — un centre qui
   écrirait par un chemin parallèle serait un contournement de rbac.js
   déguisé en commodité. */
const SEV_TONE = { urgent: "tag-red", attention: "tag-amber", info: "tag-out" };

Views.inbox = () => {
  const items = myInbox();
  const failed = items.failed;
  const unread = items.filter((n) => n.unread);
  const shown = App.ui.inboxAll ? items : unread;

  const openIt = (n) => {
    /* Marquer lu et aller voir : deux gestes que personne ne veut faire
       séparément. La lecture ne change que MA ligne. */
    if (n.unread) {
      api.patch("/auth/notifications/" + n.id, {})
        .then(() => { delete live.data.inbox; App.emit(); })
        .catch(() => {});
    }
    const to = { meeting_action: "#/meetings", document: "#/documents",
      change_request: "#/change", project: "#/project/" + n.entityId,
      raid_item: "#/risk", milestone: "#/schedule" }[n.entity];
    if (to) go(to);
  };

  return h("div", null,
    kpiStrip([
      { label: t("Unread"), value: String(unread.length),
        note: failed ? t("could not be loaded") : t("addressed to you"), accent: unread.length > 0 },
      { label: t("Needs attention"), value: String(unread.filter((n) => n.severity !== "info").length),
        note: t("attention or urgent") },
      { label: t("In the box"), value: String(items.length), note: t("kept for the retention period") },
    ]),
    sectionHead(t("What is waiting for you"),
      unread.length ? null : t("Nothing unread — this is what a quiet week looks like."),
      unread.length
        ? h("button", { class: "btn btn-sm", onClick: () => {
            /* La boîte n'est pas une collection du livre : elle vit dans
               le cache `live`, qu'on vide pour la relire. */
            api.post("/auth/notifications/read-all", {})
              .then(() => { delete live.data.inbox; App.emit(); })
              .catch(() => toast(t("That did not go through"), "", true));
          } }, t("Mark all read"))
        : null),
    h("label", { class: "small", style: "display:flex;gap:8px;align-items:center;margin:6px 0 12px" },
      h("input", { type: "checkbox", checked: !!App.ui.inboxAll,
        onChange: (e) => App.set({ inboxAll: e.target.checked }) }),
      t("Show what I have already read")),

    shown.length === 0
      ? emptyState(t("Nothing here"),
          t("Messages arrive when something is due, blocked, or owed to you. Your subscriptions decide what also reaches you by email."))
      : h("div", { class: "list" }, ...shown.map((n) => h("div", {
          class: "list-row linkish", tabindex: 0,
          onClick: () => openIt(n), onKeydown: (e) => e.key === "Enter" && openIt(n),
          style: n.unread ? "font-weight:600" : "opacity:.72",
        },
        tag(t(n.severity), SEV_TONE[n.severity] ?? "tag-out"),
        h("div", { style: "min-width:0;flex:1" },
          h("div", { class: "small truncate" }, tData(n.subject)),
          h("div", { class: "xs muted" },
            fmtDate(String(n.at).slice(0, 10)),
            n.onBehalfOf ? " · " + t("on behalf of ") + n.onBehalfOf : "",
            n.state === "queued" ? " · " + t("not sent yet") : "")),
        n.unread ? tag(t("new"), "tag-out") : null))),
  );
};

Views.my = (db) => {
  const me = App.me.personId;
  /* An account with no person owns nothing. Comparing against a null
     personId would otherwise match every unowned row in the book and
     present another site's ownerless risks as this person's week. */
  const mine = (owner) => me != null && owner === me;
  const asOf = db.statusDate;
  const in14 = (d) => d && d >= asOf && days(asOf, d) <= 14;
  const myActs = myOpenActions();
  const myRaid = db.raid.filter(r => r.status === "Open" && mine(r.owner));
  const myMs = db.milestones.filter(m => !m.done && mine(m.owner) && (in14(m.date) || m.date < asOf));
  const myStages = db.activities.filter(a => mine(a.owner) && a.pct < 100 && in14(a.end));
  const myProjects = db.projects.filter(p => mine(p.pm) && !p.closed);
  const dg = weekDigest();

  const rowList = (items, empty) => items.length
    ? h("div", { style: "margin-bottom:20px" }, items)
    : h("div", { class: "small muted", style: "margin-bottom:20px" }, empty);

  /* R-02 — the cover banner. If somebody's absence names me deputy, the
     offer is HERE, on the landing surface; while covering, the fact is
     said out loud with one way to stop. */
  const actas = liveFetch("actas", () => api.get("/auth/actas/available"), (r) =>
    Object.assign(r.available || [], { actingFor: r.actingFor ?? null }));
  const coverBanner = App.me.actingFor
    ? h("div", { class: "drop-hint", style: "margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap" },
        h("span", { class: "strong" }, t("You are covering for an absent colleague.")),
        h("span", { class: "small muted" }, t("Their authority, their slate — every act is recorded with both names.")),
        h("button", { class: "btn btn-sm", onClick: async () => {
          await api.del("/auth/actas"); await App.load();
        } }, t("Stop covering")))
    : actas.length
    ? h("div", { class: "drop-hint", style: "margin-bottom:16px" },
        h("div", { class: "strong", style: "margin-bottom:6px" }, t("You are named as deputy")),
        ...actas.map((x) => h("div", { class: "list-row", style: "align-items:center" },
          h("div", { style: "flex:1" },
            h("span", { class: "small strong" }, x.name),
            h("span", { class: "xs muted" }, " · " + t(x.reason) + t(" until ") + fmtDate(x.until))),
          h("button", { class: "btn btn-sm btn-primary", onClick: async () => {
            const ok = await App.write(t("Covering started"), (a) => a.post("/auth/actas", { userId: x.userId }),
              { detail: x.name, refresh: false });
            if (ok !== false) await App.load();
          } }, t("Cover for them")))))
    : null;

  const left = h("section", { class: "l sec" },
    coverBanner,
    sectionHead(t("Actions you owe"), myActs.length + " open"),
    rowList(myActs.slice(0, 8).map(a =>
      h("div", { class: "list-row linkish", onClick: () => go("#/meetings") },
        h("span", { class: "mark" + (a.dueDate && a.dueDate < asOf ? " mark-acc" : "") }),
        h("div", { style: "min-width:0" },
          h("div", { class: "strong small" }, a.title),
          h("div", { class: "xs muted" },
            (a.seriesName ? a.seriesName + " · " : "") +
            (a.dueDate ? (a.dueDate < asOf ? "OVERDUE — was due " : "due ") + fmtDate(a.dueDate) : "no date"))))),
      myActs.failed
        ? t("Your actions could not be loaded — refresh to try again.")
        : me == null
        ? t("This account is not linked to a person, so nothing is owed to you by name.")
        : t("Nothing on your plate from the meetings register.")),

    h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead(t("Your risks & issues"), myRaid.length + " open"),
    rowList(myRaid.slice(0, 6).map(r =>
      h("div", { class: "list-row linkish", onClick: () => go("#/risk/" + r.id) },
        h("span", { class: "mark" + (r.review && r.review <= asOf ? " mark-acc" : "") }),
        h("div", { style: "min-width:0" },
          h("div", { class: "strong small" }, r.id + " · " + r.title),
          h("div", { class: "xs muted" },
            "Exposure " + Engine.exposure(r) +
            (r.review ? " · review " + (r.review <= asOf ? "DUE — " : "") + fmtDate(r.review) : ""))))),
      t("No open register items carry your name.")),

    h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead(t("Due in the next fortnight"), (myMs.length + myStages.length) + " item" + (myMs.length + myStages.length === 1 ? "" : "s")),
    rowList([
      ...myMs.map(m => h("div", { class: "list-row linkish", onClick: () => go("#/project/" + m.project) },
        h("span", { class: "mark" + (m.date < asOf ? " mark-acc" : "") }),
        h("div", { style: "min-width:0" },
          h("div", { class: "strong small" }, "◇ " + m.name),
          h("div", { class: "xs muted" }, (Engine.project(db, m.project) || {}).name + " · " +
            (m.date < asOf ? "MISSED — was " : "") + fmtDate(m.date))))),
      ...myStages.map(a => h("div", { class: "list-row linkish", onClick: () => go("#/project/" + a.project) },
        h("span", { class: "mark" }),
        h("div", { style: "min-width:0" },
          h("div", { class: "strong small" }, a.name + " — " + a.pct + "%"),
          h("div", { class: "xs muted" }, (Engine.project(db, a.project) || {}).name + " · ends " + fmtDate(a.end))))),
    ], t("Nothing of yours lands in the next two weeks.")));

  const rail = h("aside", { class: "sec" },
    sectionHead(t("Your projects"), String(myProjects.length)),
    rowList(myProjects.map(p => {
      const m = Engine.metrics(db, p.id);
      return h("div", { class: "list-row linkish", onClick: () => go("#/project/" + p.id) },
        h("span", { title: m.health.why }, ragDot(m.health.rag)),
        h("div", { style: "min-width:0;margin-left:8px" },
          h("div", { class: "strong small" }, p.name),
          h("div", { class: "xs muted" }, p.id + " · " + p.phase +
            (m.slipDays > 7 ? " · +" + m.slipDays + "d forecast" : ""))));
    }), t("You manage no open projects.")),

    h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead(t("This week in your book"), t("last 7 days")),
    rowList(dg.slice(0, 8).map(e =>
      h("div", { class: "list-row" },
        h("div", { style: "min-width:0" },
          h("div", { class: "kicker" }, e.action + (e.entityId ? " · " + e.entityId : "")),
          h("div", { class: "xs muted" }, String(e.at).slice(0, 10) + " · " + e.by)))),
      dg.failed
        ? t("This week's movement could not be loaded — refresh to try again.")
        : t("Quiet week — nothing in your scope moved.")));

  return h("div", { class: "split" }, left, rail);
};

/* ── Programme governance (governance committee, group-2) ─────────────
   Grants, visibility and authority all key on programmes; this is the
   surface where a programme is finally GOVERNED as a unit: owner, roll,
   decisions owed, risk posture — one card per programme you hold. */
Views.programmes = (db) => {
  const mine = App.me.role === "admin"
    ? db.programmes
    : db.programmes.filter(pr => App.me.grants.programmes.includes(pr.id));
  if (!mine.length) {
    return emptyState(t("No programmes granted to this account"),
      "A group account governs the programmes named in its grants — ask an administrator.");
  }
  return h("div", null, ...mine.map(pr => {
    const projects = db.projects.filter(p => p.programme === pr.id && !p.closed);
    const roll = Engine.roll(db, projects);
    const owed = Engine.decisions(db, projects);
    const risk = Engine.riskProfile(db, projects, { unassigned: false });
    const manager = db.people.find(x => x.id === pr.managerId);
    const funded = projects.filter(p => p.budget > 0).length;
    return h("section", { class: "sec", style: "margin-bottom:18px" },
      sectionHead(pr.name,
        (manager ? "managed by " + manager.name : "no programme manager named") +
        " · sponsor " + (pr.sponsor || "—"),
        h("button", { class: "btn btn-sm", onClick: () => { App.set({ scope: pr.id }); go("#/portfolio"); } }, "Open in portfolio")),
      kpiStrip([
        { label: "Projects", value: String(projects.length),
          note: funded + " funded" + (projects.length - funded ? " · " + (projects.length - funded) + " strategy" : "") },
        { label: "Value", value: money(roll.bac), note: signedMoney(roll.vac) + " forecast variance", accent: roll.vac < 0 },
        { label: "On track", value: roll.count ? Math.round(roll.green / roll.count * 100) + "%" : "—",
          note: roll.green + "G · " + roll.amber + "A · " + roll.red + "R" },
        { label: "Decisions owed", value: String(owed.length),
          note: owed.filter(d => d.urgent).length + " urgent", accent: owed.some(d => d.urgent) },
        { label: "Risk posture", value: String(risk.open),
          note: risk.steering + " at steering level · " + risk.pmo + " at PMO level", accent: risk.steering > 0 },
        /* V-01 — the sponsor's question, on the same row as the money.
           "Projects with nothing promised" is the number that says whether
           this programme is governed by value or only by cost. */
        (() => {
          const vp = Engine.valueProfile(db, projects);
          return { label: t("Value promised"),
            value: vp.total ? String(vp.total) : "—",
            note: vp.uncased
              ? vp.uncased + t(" project(s) promise nothing")
              : vp.decided
                ? vp.met + t(" of ") + vp.decided + t(" benefits met")
                : vp.measured + t(" measured, none ruled on yet"),
            accent: vp.uncased > 0 };
        })(),
      ]),
      owed.length ? h("div", { style: "margin-top:12px" },
        ...owed.slice(0, 4).map(d =>
          h("div", { class: "list-row linkish", onClick: () => d.route && go(d.route) },
            h("span", { class: "mark" + (d.urgent ? " mark-acc" : "") }),
            h("div", { style: "min-width:0" },
              h("div", { class: "kicker" }, d.kind),
              h("div", { class: "strong small" }, d.title),
              h("div", { class: "xs muted" }, d.meta))))) : null);
  }));
};

/* ── My site (governance committee, site-1) ───────────────────────────
   The site lead's slate as a surface, not a filter state: what you run,
   what the group lands on you, your people's load split by who put it
   there, and your open register — concerns included. */
Views.mysite = (db) => {
  const siteIds = App.me.grants.sites;
  if (!siteIds.length) {
    return emptyState(t("No site granted to this account"),
      "A site account governs the sites named in its grants — ask an administrator.");
  }
  return h("div", null, ...siteIds.map(sid => {
    const site = db.sites.find(s => s.id === sid);
    const here = db.projects.filter(p => p.site === sid && !p.closed);
    const own = here.filter(p => p.governanceLevel === "site");
    const landed = here.filter(p => p.governanceLevel === "group");
    const ids = new Set(here.map(p => p.id));
    const raid = db.raid.filter(r => r.status === "Open" && r.project && ids.has(r.project));
    const myPeople = new Set(db.people.filter(pp => pp.site === sid).map(pp => pp.id));
    const allocs = db.allocations.filter(a => myPeople.has(a.person));
    const fte = (list2) => Math.round(sum(list2, a => a.pct) / 100 * 10) / 10;
    const groupIds = new Set(db.projects.filter(p => p.governanceLevel === "group").map(p => p.id));
    /* "Your own projects" means the open site-governed projects on THIS
       slate. Taking the complement of group work counted a person lent to
       another site — or to a project long closed — as load you carry. */
    const ownIds = new Set(own.map(p => p.id));
    const groupDemand = allocs.filter(a => groupIds.has(a.project));
    const ownDemand = allocs.filter(a => ownIds.has(a.project));

    const projRow = (p, writable) => {
      const m = Engine.metrics(db, p.id);
      return h("div", { class: "list-row linkish", onClick: () => go("#/project/" + p.id) },
        h("span", { title: m?.health.why }, ragDot(m?.health.rag)),
        h("div", { style: "flex:1;min-width:0;margin-left:8px" },
          h("div", { class: "strong small" }, p.name),
          h("div", { class: "xs muted" }, p.id + " · " + p.phase + " · " + Engine.personName(db, p.pm))),
        writable ? null : h("span", { class: "tag tag-out" }, t("group-run")),
        /* The concern belongs to the programme it is about. Offering it
           once per site sent every concern to whichever group project
           happened to be listed first. */
        !writable && App.can("concern.raise", { project: asRow(p) })
          ? h("button", {
              class: "btn btn-sm", style: "margin-left:8px",
              title: "Record a concern on this group programme at your site",
              onClick: (e) => { e.stopPropagation(); newRaid(db, p.id); },
            }, icon("plus", 12), t("Raise concern"))
          : null);
    };

    return h("section", { class: "sec", style: "margin-bottom:18px" },
      sectionHead(site ? site.city : sid, t("your slate and what lands on it")),
      kpiStrip([
        { label: t("Your projects"), value: String(own.length), note: t("site-governed — yours to run") },
        { label: t("Group programmes here"), value: String(landed.length), note: t("read-only; concerns are your channel") },
        { label: t("Your people on group work"), value: fte(groupDemand) + " FTE",
          note: fte(ownDemand) + " FTE on your own projects", accent: fte(groupDemand) > fte(ownDemand) },
        { label: t("Open register"), value: String(raid.length),
          note: raid.filter(r => r.originSite === sid).length + " concern" + (raid.filter(r => r.originSite === sid).length === 1 ? "" : "s") + " you raised" },
      ]),
      h("div", { class: "split", style: "margin-top:14px" },
        h("div", null,
          sectionHead(t("Yours to run"), String(own.length)),
          own.length ? h("div", null, ...own.map(p => projRow(p, true)))
            : h("div", { class: "small muted" }, t("No site-governed projects here yet.")),
          h("div", { style: "height:18px" }),
          sectionHead(t("Landing on your site"), String(landed.length)),
          landed.length ? h("div", null, ...landed.map(p => projRow(p, false)))
            : h("div", { class: "small muted" }, t("No group programmes are delivering here right now."))),
        h("aside", null,
          /* R-02 — the site keeps its own people's absences, next to the
             register they will stop feeding while away. */
          (() => {
            const away = (db.absences ?? []).filter(a => myPeople.has(a.person) && a.to >= db.statusDate)
              .sort((x, y) => String(x.from).localeCompare(String(y.from)));
            return h("div", { style: "margin-bottom:20px" },
              sectionHead(t("Absences & cover"), away.length ? away.length + t(" ahead") : t("none declared"),
                App.can("absence.write", { site_id: sid })
                  ? h("button", { class: "btn btn-sm", onClick: () => declareAbsence(db, sid) },
                      icon("plus", 12), t("Declare"))
                  : null),
              away.length
                ? h("div", null, ...away.slice(0, 6).map(a => h("div", { class: "list-row", style: "align-items:center" },
                    h("div", { style: "flex:1;min-width:0" },
                      h("div", { class: "strong small" }, Engine.personName(db, a.person)),
                      h("div", { class: "xs muted" },
                        t(a.reason) + " · " + fmtDate(a.from) + " → " + fmtDate(a.to) +
                        (a.deputy ? " · " + t("covered by ") + Engine.personName(db, a.deputy)
                                  : " · " + t("nobody covers")))),
                    !a.deputy ? h("span", { class: "tag tag-accent", title: t("Decisions will wait until they return") }, "!") : null,
                    App.can("absence.write", { site_id: sid })
                      ? h("button", { class: "btn btn-xs btn-ghost", title: t("Withdraw"),
                          onClick: () => App.write(t("Absence withdrawn"), (x) => x.del("/absences/" + a.id),
                            { detail: Engine.personName(db, a.person) }) }, icon("trash", 11))
                      : null)))
                : h("div", { class: "small muted" },
                    t("No absence is declared. A decision owed to somebody on rotation waits in silence — declare the roster and name who covers.")));
          })(),
          sectionHead(t("Open risks & issues"), String(raid.length)),
          raid.length ? h("div", null, ...raid.slice(0, 8).map(r =>
            h("div", { class: "list-row linkish", onClick: () => go("#/risk/" + r.id) },
              h("span", { class: "mark" + (Engine.escalation(db, r).level === "Steering" ? " mark-acc" : "") }),
              h("div", { style: "min-width:0" },
                h("div", { class: "kicker" }, r.type + " · " + r.id + (r.originSite ? " · concern from " + r.originSite : "")),
                h("div", { class: "strong small" }, r.title),
                h("div", { class: "xs muted" }, "Exposure " + Engine.exposure(r) + " · " + Engine.escalation(db, r).why)))))
            : h("div", { class: "small muted" }, t("Register is clear for this site.")))));
  }));
};

function exportCSV(rows) {
  const csv = toCSV(rows, [
    { label: "ID", get: r => r.p.id }, { label: "Project", get: r => r.p.name },
    { label: "Programme", get: r => r.p.programme }, { label: "Site", get: r => r.p.site },
    { label: "Phase", get: r => r.p.phase }, { label: "Health", get: r => r.m.health.rag },
    { label: "BAC $M", get: r => r.m.bac.toFixed(2) }, { label: "AC $M", get: r => r.m.ac.toFixed(2) },
    { label: "EV $M", get: r => r.m.ev.toFixed(2) }, { label: "SPI", get: r => idx(r.m.spi) },
    { label: "CPI", get: r => idx(r.m.cpi) }, { label: "EAC $M", get: r => r.m.eac.toFixed(2) },
    { label: "Finish", get: r => r.p.finish }, { label: "Forecast finish", get: r => r.m.forecastFinish },
  ]);
  saveText("meridian-portfolio-" + App.db.statusDate + ".csv", csv, "text/csv");
  toast("Register exported", rows.length + " projects as CSV");
}

function projectFields(db, p) {
  return [
    { key: "name", label: "Project name", required: true, span: 2, value: p ? p.name : "" },
    { key: "programme", label: "Programme", type: "select", value: p ? p.programme : db.programmes[0].id,
      options: db.programmes.map(x => ({ value: x.id, label: x.name })) },
    { key: "site", label: "Lead site", type: "select", value: p ? p.site : db.sites[0].id,
      options: db.sites.map(x => ({ value: x.id, label: x.city + " · " + x.region })) },
    { key: "governanceLevel", label: "Governance", type: "select",
      value: p ? p.governanceLevel : (App.me.role === "site" ? "site" : "group"),
      options: governanceOptions(p),
      hint: t("A group project is run by the group and is read-only to a site. A site project belongs to its site.") },
    { key: "pm", label: "Project manager", type: "select", value: p ? p.pm : db.people[0].id,
      options: db.people.map(x => ({ value: x.id, label: x.name + " — " + x.role })) },
    { key: "method", label: "Delivery method", type: "select", value: p ? p.method : "Hybrid", options: ["Waterfall", "Agile", "Hybrid"] },
    { key: "start", label: "Start", type: "date", required: true, value: p ? p.start : iso(db.statusDate) },
    { key: "finish", label: "Planned finish", type: "date", required: true, value: p ? p.finish : iso(addMonths(db.statusDate, 12)),
      validate: (v, st) => D(v) <= D(st.start) ? "Finish must fall after the start" : "" },
    { key: "budget", label: "Budget ($M)", type: "number", step: 0.1, min: 0.1, required: true, value: p ? p.budget : 1 },
    { key: "contingency", label: "Contingency ($M)", type: "number", step: 0.05, min: 0, value: p ? p.contingency : 0.1 },
    { key: "desc", label: "What this delivers", type: "textarea", span: 2, rows: 3, value: p ? p.desc : "" },
  ];
}

function newProject(db) {
  formDialog({
    title: "New project", kicker: "Register", wide: true, fields: projectFields(db, null), saveLabel: "Create project",
    /* The schedule, gates, evidence and the PM's allocation are built by
       the server, so a project created here is identical to one seeded. */
    onSave: async (v) => {
      const id = await App.write("Project created", async (a) => {
        const r = await a.post("/projects", {
          name: v.name, programme: v.programme, site: v.site,
          governanceLevel: v.governanceLevel, pm: v.pm, method: v.method,
          start: v.start, finish: v.finish, budget: +v.budget,
          contingency: +v.contingency || 0, desc: v.desc,
        });
        return r.id;
      }, { detail: v.name });
      if (id && id !== true) go("#/project/" + id);
      return id;
    },
  });
}

function editProject(db, p) {
  formDialog({
    title: "Edit project", kicker: p.id, wide: true, fields: projectFields(db, p), saveLabel: "Save changes",
    onSave: (v) => App.write("Project updated", (a) => a.patch("/projects/" + p.id, {
      name: v.name, programme: v.programme, site: v.site,
      governanceLevel: v.governanceLevel, pm: v.pm, method: v.method,
      start: v.start, finish: v.finish, budget: +v.budget,
      contingency: +v.contingency || 0, desc: v.desc, version: p.version,
    }), { detail: p.id + " · " + v.name }),
  });
}

/* Re-stretching a project's activities when its window moves used to
   happen here. It is business logic, so it moved to the server
   (server/src/wbs.js) and PATCH /projects/:id performs it. */

/* ── Project ──────────────────────────────────────────────────────── */
Views.project = (db) => {
  const p = Engine.project(db, App.ui.project) || db.projects[0];
  if (!p) return emptyState(t("No projects in the book"), "Create one from the portfolio view.");
  const m = Engine.metrics(db, p.id);
  const gate = Engine.currentGate(db, p.id);
  const advance = Engine.canAdvance(db, p.id);
  const raid = db.raid.filter(r => r.project === p.id && r.status === "Open");
  const team = db.allocations.filter(a => a.project === p.id);
  const acts = Engine.activities(db, p.id);
  const cp = Engine.criticalPath(db, p.id);

  const head = h("section", { class: "sec band" },
    h("div", { style: "display:flex;gap:26px;align-items:flex-start;flex-wrap:wrap" },
      h("div", { style: "flex:1;min-width:280px" },
        h("div", { style: "display:flex;align-items:center;gap:10px;flex-wrap:wrap" },
          h("h3", null, p.name),
          tag(p.method, "tag-out"), tag(p.phase, "tag-ink"),
          h("span", { title: m.health.why }, ragDot(m.health.rag))),
        h("div", { class: "xs muted", style: "margin-top:5px" },
          p.id + " · " + (Engine.programme(db, p.programme) || {}).name + " · " +
          (Engine.site(db, p.site) || {}).city + " · managed by " + Engine.personName(db, p.pm)),
        h("p", { class: "small", style: "margin:10px 0 0;max-width:64ch;color:var(--muted)" }, p.desc)),
      h("div", { style: "width:270px;flex:none" },
        h("div", { class: "kicker" }, "Completion"),
        /* ADR-10 — without a budget there is no earned value to derive
           completion from; show the weight-averaged reported progress. */
        (() => {
          const wsum = acts.reduce((n, a) => n + Number(a.weight), 0);
          const shown = p.budget > 0 ? m.pctComplete
            : (wsum ? acts.reduce((n, a) => n + Number(a.weight) * a.pct, 0) / wsum / 100 : 0);
          return h("div", null,
            h("div", { style: "display:flex;align-items:baseline;gap:9px;margin:4px 0 6px" },
              h("span", { class: "num", style: "font-size:32px" }, pct(shown)),
              h("span", { class: "small muted" }, p.budget > 0 ? "plan " + pct(m.plannedComplete) : "reported")),
            meter(shown, p.budget > 0 && m.pctComplete < m.plannedComplete - 0.05 ? "var(--color-accent)" : "var(--color-text)"));
        })(),
        h("div", { class: "xs muted", style: "display:flex;justify-content:space-between;margin-top:6px" },
          h("span", null, "Start " + fmtDate(p.start)),
          h("span", null, "Finish " + fmtDate(p.finish))),
        m.slipDays > 3 ? h("div", { class: "xs bad strong", style: "margin-top:4px" },
          "Forecast " + fmtDate(m.forecastFinish) + " — " + m.slipDays + " days late at the current rate") : null)),
    h("div", { class: "btn-row", style: "margin-top:16px" },
      mayWrite(p) && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => editProject(db, p) }, icon("pencil", 12), "Edit project")
        : null,
      h("button", { class: "btn btn-sm", onClick: () => go("#/schedule/" + p.id) }, t("Open schedule")),
      h("button", { class: "btn btn-sm", onClick: () => go("#/board/" + p.id) }, t("Open board")),
      /* The PM's weekly typing becomes a sendable artifact (UX committee,
         value I-1): every figure matches this screen, or the button lies. */
      h("button", { class: "btn btn-sm", title: "Copy a Markdown status snippet for email or chat",
        onClick: () => copyStatus(db, p, m) }, t("Copy status")),
      /* V-15 — everything about this project, as at a date, as one file. */
      h("button", { class: "btn btn-sm", title: t("Everything on the record for this project, as at a date"),
        onClick: () => evidencePack(db, p) }, t("Evidence pack")),
      mayWrite(p) && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => setHealth(db, p) }, t("Set status"))
        : null,
      may("project.baseline", p) && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => rebaseline(db, p, m) }, t("Re-baseline"))
        : null,
      may("project.gate", p) && !fromSdp(p)
        ? h("button", { class: "btn btn-sm btn-primary", disabled: !advance.ok, title: advance.reason,
            onClick: () => advancePhase(db, p) }, t("Advance phase"), icon("arrowRight", 12))
        : null),
    /* Say why the controls are missing rather than leaving a bare page —
       "read-only" is information, an empty toolbar is a puzzle. */
    fromSdp(p)
      ? h("div", { class: "xs muted", style: "margin-top:10px;max-width:60ch" },
          "This project mirrors an SDP roadmap objective. Progress, dates and status arrive " +
          "by synchronisation; they are edited in the SDP dashboard, not here. RAID items, " +
          "documents and steering milestones remain Meridian's own.")
      : !mayWrite(p)
      ? h("div", { class: "xs muted", style: "margin-top:10px;max-width:60ch" },
          p.governanceLevel === "group" && App.me.role === "site"
            ? t("This is a group-governed project. Your site holds read access to it; changes are made at group level.")
            : App.isViewer
              ? t("This account is read-only.")
              : "This project sits outside the programmes and sites granted to your account.")
      : null);

  /* ADR-10 — a budget-less project (an SDP strategy mirror) shows "—", never
     "$0.00M" or a phantom index: outside EVM by rule, not by zero. */
  const stats = p.budget > 0 ? kpiStrip([
    { label: "Budget", value: money(m.bac), note: "approved envelope" },
    { label: "Actual cost", value: money(m.ac), note: "to " + fmtDate(db.statusDate) },
    { label: "Earned value", value: money(m.ev), note: "work booked as done" },
    { label: "SPI", value: m.measurable ? idx(m.spi) : "—", note: !m.measurable ? "too early to measure" : m.spi < 1 ? "behind plan" : "ahead of plan", accent: m.measurable && m.spi < db.settings.amberSpi },
    { label: "CPI", value: m.measurable ? idx(m.cpi) : "—", note: !m.measurable ? "too early to measure" : m.cpi < 1 ? "over the spend rate" : "under the spend rate", accent: m.measurable && m.cpi < db.settings.amberCpi },
    { label: "Forecast", value: money(m.eac), note: signedMoney(m.vac) + " against budget", accent: m.vac < 0 },
  ]) : kpiStrip([
    { label: "Budget", value: "—", note: "no budget — outside EVM and cost roll-ups" },
    { label: "Progress",
      value: (() => {
        const wsum = acts.reduce((n, a) => n + Number(a.weight), 0);
        return pct(wsum ? acts.reduce((n, a) => n + Number(a.weight) * a.pct, 0) / wsum / 100 : 0);
      })(),
      note: "reported by the source system" },
    { label: "SPI", value: "—", note: "not measured on a budget-less project" },
    { label: "CPI", value: "—", note: "not measured on a budget-less project" },
  ]);

  /* milestones + gate evidence */
  const canPlan = may("schedule.write", p);
  const milestones = Engine.milestones(db, p.id).map(ms => {
    const g = ms.gate ? Engine.gateStatus(db, p.id, ms.gate) : null;
    const late = D(ms.date) < D(db.statusDate);
    const state = g ? g.state : (late ? "Cleared" : "Planned");
    return h("div", { class: "step" },
      h("span", { class: "step-i " + (state === "Cleared" ? "ok" : state === "At risk" || state === "Overdue" ? "no" : "wait") },
        ms.gate ? "G" + ms.gate : "◇"),
      h("div", { style: "flex:1;min-width:0" },
        h("div", { class: "strong small" }, ms.name),
        h("div", { class: "xs muted" }, Engine.personName(db, ms.owner) + " · " + fmtDate(ms.date) +
          (g ? " · evidence " + g.approved + "/" + g.total : ""))),
      h("div", { style: "text-align:right" }, statusTag(state),
        ms.gate && g && g.outstanding.length
          ? h("div", { class: "xs linkish muted", style: "margin-top:4px", onClick: () => go("#/documents") }, "see evidence")
          : null,
        /* Gates belong to the governance model and are not editable here;
           a hand-placed milestone is the project's own and is. */
        canPlan && ms.kind !== "gate" && ms.origin !== "sdp"
          ? h("div", { class: "btn-row", style: "margin-top:5px;justify-content:flex-end" },
              h("button", { class: "btn btn-xs btn-ghost", title: "Edit milestone",
                onClick: () => editMilestone(db, ms) }, icon("pencil", 11)),
              h("button", { class: "btn btn-xs btn-ghost", title: "Remove milestone",
                onClick: () => removeMilestone(db, ms) }, icon("trash", 11)))
          : null));
  });

  const raidRows = raid.sort((a, b) => Engine.exposure(b) - Engine.exposure(a)).slice(0, 6).map(r =>
    h("div", { class: "list-row linkish", onClick: () => go("#/risk/" + r.id) },
      h("span", { class: "mark" + (r.type === "Issue" || Engine.exposureBand(r) === "Critical" ? " mark-acc" : "") }),
      h("div", { style: "min-width:0" },
        h("div", { class: "kicker" }, r.type + " · " + r.id),
        h("div", { class: "strong small", style: "margin:2px 0 1px" }, r.title),
        h("div", { class: "xs muted" }, "P" + r.p + "×I" + r.i + " = " + Engine.exposure(r) + " · " + r.response +
          " · " + Engine.personName(db, r.owner) + " · review " + fmtDate(r.review)))));

  const left = h("section", { class: "l sec" },
    sectionHead("Milestones & gates", gate.name + " is next",
      may("schedule.write", p)
        ? h("button", { class: "btn btn-sm", onClick: () => addMilestone(db, p) }, icon("plus", 12), "Milestone")
        : null),
    h("div", { style: "margin-bottom:8px" }, milestones),
    !advance.ok ? h("div", { class: "drop-hint", style: "margin-top:12px" },
      h("span", { class: "strong" }, t("Phase advance is blocked. ")), tData(advance.reason),
      h("div", { style: "margin-top:8px" }, h("button", { class: "btn btn-xs", onClick: () => go("#/documents") }, t("Open the evidence list")))) : null,

    /* R-07 — the weekly read (milestones, gates, the blocked banner)
       stays open; the quarterly read folds, each fold saying what it
       holds. Nothing is removed. */
    h("div", { style: "height:20px" }),
    (() => {
      const vp = Engine.valueProfile(db, [p]);
      return fold(t("Value"),
        vp.total ? vp.measured + t(" of ") + vp.live + t(" measured") : t("nothing promised yet"),
        false, valueBlock(db, p));
    })(),
    fold(t("Plant & rollout"),
      (p.plantImpact ?? "none") === "none" ? t("business systems only") : t(IMPACT_LABEL[p.plantImpact]),
      false, plantBlock(db, p)),
    fold(t("Stage plan"),
      acts.length + t(" stages") + " · " + cp.critical.size + t(" on the critical path"),
      false,
      sectionHead("Stage plan", acts.length + " stages · " + cp.critical.size + " on the critical path",
        may("schedule.write", p) && !fromSdp(p)
          ? h("button", { class: "btn btn-sm", onClick: () => addActivity(db, p, acts) }, icon("plus", 12), "Stage")
          : null),
      stagePlanTable()));

  function stagePlanTable() {
    return table({
      cols: [
        { key: "n", label: "Stage", get: a => h("div", null,
            h("span", { class: "strong small" }, a.name),
            cp.critical.has(a.id) ? h("span", { class: "tag tag-accent", style: "margin-left:7px" }, "critical") : null) },
        { key: "w", label: "Weight", align: "r", get: a => h("span", { class: "mono small" }, pct(a.weight)) },
        { key: "s", label: "Window", get: a => h("span", { class: "mono small" }, fmtDate(a.start) + " → " + fmtDate(a.end)) },
        { key: "f", label: "Float", align: "r", get: a => h("span", { class: "mono small" }, (cp.float[a.id] || 0) + "d") },
        { key: "p", label: "Progress", width: "110px", get: a => h("div", null,
            h("div", { class: "bar-lbl mono" }, h("span", null, a.pct + "%")),
            meter(a.pct / 100, cp.critical.has(a.id) ? "var(--color-accent)" : "var(--color-text)", "thin")) },
        { key: "e", label: "", align: "r", get: a => may("schedule.write", p) && a.origin !== "sdp"
            ? h("div", { class: "btn-row" },
                h("button", { class: "btn btn-xs", onClick: () => editActivity(db, a) }, "Edit"),
                h("button", { class: "btn btn-xs btn-ghost", title: "Remove this stage",
                  onClick: () => removeActivity(db, a) }, icon("trash", 11)))
            : null },
      ], rows: acts,
    });
  }

  const rail = h("aside", { class: "sec" },
    sectionHead("Open RAID", raid.length + " items",
      may("raid.write", p)
        ? h("button", { class: "btn btn-sm", onClick: () => newRaid(db, p.id) }, icon("plus", 12), "Add")
        : null),
    h("div", { style: "margin-bottom:20px" }, raid.length ? raidRows : h("div", { class: "small muted" }, "Nothing open against this project.")),
    h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead("Team & allocation", team.length + " people",
      may("allocation.write", p)
        ? h("button", { class: "btn btn-sm", onClick: () => assignPerson(db, p.id) }, icon("plus", 12), "Assign")
        : null),
    h("div", { style: "margin-bottom:20px" }, team.map(a => {
      const person = Engine.person(db, a.person);
      if (!person) return null;
      return h("div", { class: "list-row", style: "align-items:center" },
        avatar(db, a.person),
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "strong small" }, person.name),
          h("div", { class: "xs muted" }, person.role + " · " + (Engine.site(db, person.site) || {}).city)),
        h("span", { class: "mono small strong" }, a.pct + "%"),
        h("button", { class: "btn btn-xs btn-ghost", title: "Remove from project",
          hidden: !may("allocation.write", p) || undefined,
          onClick: () => App.write("Assignment removed", (x) => x.del("/allocations/" + a.id),
            { detail: person.name + " off " + p.id }) }, icon("x", 12)));
    })),
    h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead("Cost position"),
    h("div", { class: "card" },
      h("div", { class: "card-kicker" }, "Contingency"),
      h("div", { style: "display:flex;align-items:baseline;gap:8px;margin:5px 0 7px" },
        h("span", { class: "num", style: "font-size:22px" }, cash(m.contingencyLeft)),
        h("span", { class: "small muted" }, "of " + cash(p.contingency) + " left")),
      meter(m.contingencyPct, m.contingencyPct > 0.6 ? "var(--color-accent)" : "var(--color-text)", "thin"),
      h("div", { class: "xs muted", style: "margin-top:7px" },
        pct(m.contingencyPct) + " drawn at " + pct(m.pctComplete) + " complete")),
    h("div", { style: "height:12px" }),
    h("div", { class: "small" },
      h("div", { style: "display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule-1)" },
        h("span", { class: "muted" }, "Cost variance"), h("span", { class: "mono strong", style: m.cv < 0 ? "color:var(--sig-red)" : null }, signedMoney(m.cv))),
      h("div", { style: "display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule-1)" },
        h("span", { class: "muted" }, "Schedule variance"), h("span", { class: "mono strong", style: m.sv < 0 ? "color:var(--sig-red)" : null }, signedMoney(m.sv))),
      h("div", { style: "display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule-1)" },
        h("span", { class: "muted" }, "To-complete index"), h("span", { class: "mono strong" }, idx(m.tcpi)))),
    h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sdpPanel(db, p));

  return h("div", null, head, stats, h("div", { class: "split" }, left, rail));
};

/* ── SDP operations panel (federation, ADR-5/6/11) ────────────────────
   The changes and actions the operations dashboard runs land here as
   read-only cards, linked to this project by a PM. The card is a cached
   display copy — SDP stays the system of record — and a stale badge says
   the feeds no longer return the item. */

function sdpPanel(db, p) {
  const links = (db.extLinks || []).filter((l) => l.project === p.id);
  const SRC_LABEL = { change: "Change", meetings: "Meeting action", inspection: "Inspection", report: "Report action" };

  const rows = links.map((l) => h("div", { class: "list-row", style: "align-items:flex-start" },
    h("span", { class: "mark" + (l.source === "change" && /failed|backed/i.test(l.status) ? " mark-acc" : "") }),
    h("div", { style: "flex:1;min-width:0" },
      h("div", { class: "kicker" }, (SRC_LABEL[l.source] ?? l.source) + " · " + l.extId +
        (l.activity ? " · pinned to " + l.activity : "")),
      h("div", { class: "strong small", style: "margin:2px 0 1px" }, l.title || l.extId),
      h("div", { class: "xs muted" },
        [l.status, l.kind, l.risk ? "risk " + l.risk : null,
         l.windowStart ? fmtDate(l.windowStart) + " → " + fmtDate(l.due) : l.due ? "due " + fmtDate(l.due) : null]
          .filter(Boolean).join(" · ")),
      l.stale ? h("div", { class: "xs", style: "color:var(--sig-amber);margin-top:2px" },
        "No longer in the SDP feed — closed there, or removed") : null),
    mayWrite(p)
      ? h("div", { class: "btn-row", style: "flex:none" },
          h("button", { class: "btn btn-xs btn-ghost", title: "Pin into a stage",
            onClick: () => repinSdpLink(db, p, l) }, icon("pencil", 11)),
          h("button", { class: "btn btn-xs btn-ghost", title: "Unlink from this project",
            onClick: () => App.write("SDP link removed", (a) => a.del("/federation/links/" + l.id),
              { detail: l.extId + " ⇸ " + p.id }) }, icon("x", 12)))
      : null));

  return h("div", null,
    sectionHead("SDP operations", links.length + " linked item" + (links.length === 1 ? "" : "s"),
      mayWrite(p)
        ? h("button", { class: "btn btn-sm", onClick: () => openSdpPicker(db, p) }, icon("plus", 12), "Link item")
        : null),
    h("div", null, rows.length ? rows : h("div", { class: "small muted" },
      "No SDP changes or actions are linked to this project.")),
    links.length
      ? h("div", { class: "btn-row", style: "margin-top:10px" },
          h("button", { class: "btn btn-xs", title: "Re-read the SDP feeds for this site and refresh every card",
            onClick: () => App.write("SDP link caches refreshed",
              (a) => a.post("/federation/refresh", { site: p.site }),
              { detail: "site " + p.site }) }, "Refresh from SDP"))
      : null);
}

function repinSdpLink(db, p, l) {
  const acts = Engine.activities(db, p.id);
  formDialog({
    title: "Pin into a stage", kicker: l.extId,
    fields: [
      { key: "activity", label: "Stage", type: "select", value: l.activity ?? "",
        options: [{ value: "", label: "Project level" }]
          .concat(acts.map((a) => ({ value: a.id, label: a.name }))) },
    ],
    saveLabel: "Save pin",
    onSave: (v) => App.write("SDP link re-pinned",
      (a) => a.patch("/federation/links/" + l.id, { activity: v.activity || null, version: l.version }),
      { detail: l.extId + " → " + (v.activity || "project level") }),
  });
}

function openSdpPicker(db, p) {
  const already = new Set((db.extLinks || []).filter((l) => l.project === p.id).map((l) => l.extId));
  const acts = Engine.activities(db, p.id);
  let feed = "changes";
  let activityPin = "";

  const list = h("div", { style: "max-height:340px;overflow:auto;margin-top:10px" });
  const note = h("div", { class: "xs muted", style: "margin-top:8px" });

  const draw = (items, configured) => {
    clear(list);
    if (!configured) {
      list.appendChild(h("div", { class: "small muted", style: "padding:12px 0" },
        "The SDP link is not configured. An administrator sets the SDP address and key under Administration → SDP federation."));
      return;
    }
    const open = items.filter((it) => !already.has(it.id));
    if (!open.length) {
      list.appendChild(h("div", { class: "small muted", style: "padding:12px 0" },
        "Nothing open at " + p.site + " that is not already linked."));
      return;
    }
    for (const it of open) {
      const isChange = feed === "changes";
      list.appendChild(h("div", { class: "list-row", style: "align-items:flex-start" },
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "kicker" }, it.id + (isChange && it.emergency ? " · EMERGENCY" : "")),
          h("div", { class: "strong small", style: "margin:2px 0 1px" }, isChange ? it.subject : it.title),
          h("div", { class: "xs muted" }, isChange
            ? [it.stage, it.status, it.risk ? "risk " + it.risk : null, it.change_type,
               it.scheduled_start ? fmtDate(it.scheduled_start) + " → " + fmtDate(it.scheduled_end) : null]
                .filter(Boolean).join(" · ")
            : [it.status, it.owner ? "owner " + it.owner : null,
               it.due_date ? "due " + fmtDate(it.due_date) : null, it.origin_label]
                .filter(Boolean).join(" · "))),
        h("button", { class: "btn btn-xs btn-primary", onClick: () => {
          closeDialog();
          App.write("SDP item linked", (a) => a.post("/federation/links", {
            project: p.id,
            source: isChange ? "change" : it.source,
            extId: it.id,
            title: isChange ? it.subject : it.title,
            status: isChange ? [it.stage, it.status].filter(Boolean).join(" · ") : it.status,
            kind: isChange ? (it.change_type ?? "") : (it.origin_label ?? ""),
            risk: isChange ? (it.risk ?? "") : "",
            due: isChange ? (it.scheduled_end ?? null) : (it.due_date ?? null),
            windowStart: isChange ? (it.scheduled_start ?? null) : null,
            activity: activityPin || null,
          }), { detail: it.id + " → " + p.id });
        } }, "Link")));
    }
  };

  const load = async () => {
    clear(list);
    list.appendChild(h("div", { class: "small muted", style: "padding:12px 0" }, "Reading the SDP feed…"));
    try {
      const r = feed === "changes"
        ? await api.get("/federation/sdp/changes?site=" + encodeURIComponent(p.site))
        : await api.get("/federation/sdp/actions?site=" + encodeURIComponent(p.site));
      draw(feed === "changes" ? (r.changes ?? []) : (r.actions ?? []), r.configured);
      note.textContent = r.configured
        ? "Live from SDP · site " + p.site + " · requester and technician names never cross."
        : "";
    } catch (e) {
      clear(list);
      list.appendChild(h("div", { class: "small muted", style: "padding:12px 0" },
        "SDP did not answer — try again, or check the federation settings."));
    }
  };

  dialog({
    title: "Link an SDP item", kicker: p.id + " · " + p.site,
    body: h("div", null,
      h("div", { class: "btn-row" },
        h("button", { class: "btn btn-sm btn-primary", onClick: (e) => {
          feed = "changes";
          e.target.classList.add("btn-primary");
          e.target.nextElementSibling?.classList?.remove("btn-primary");
          load();
        } }, "Open changes"),
        h("button", { class: "btn btn-sm", onClick: (e) => {
          feed = "actions";
          e.target.classList.add("btn-primary");
          e.target.previousElementSibling?.classList?.remove("btn-primary");
          load();
        } }, "Open actions")),
      acts.length ? h("div", { style: "margin-top:10px" },
        h("label", { class: "xs muted" }, "Pin into a stage (optional)"),
        (() => {
          const sel = h("select", { class: "in", style: "margin-top:4px" },
            h("option", { value: "" }, "Project level"),
            ...acts.map((a) => h("option", { value: a.id }, a.name)));
          sel.addEventListener("change", () => { activityPin = sel.value; });
          return sel;
        })()) : null,
      list, note),
  });
  load();
}

/* One-click per-project status snippet (UX committee, value I-1). */
function copyStatus(db, p, m) {
  const funded = p.budget > 0;
  const raid = db.raid.filter(r => r.project === p.id && r.status === "Open")
    .sort((a, b) => Engine.exposure(b) - Engine.exposure(a));
  const nextMs = db.milestones.filter(x => x.project === p.id && !x.done)
    .sort(by("date"))[0];
  const L = [];
  L.push(`**${p.name}** (${p.id}) — status as at ${db.statusDate}`);
  L.push("");
  L.push(`- Health: **${m.health.rag === "G" ? "Green" : m.health.rag === "A" ? "Amber" : "Red"}** — ${m.health.why}`);
  L.push(`- Progress: ${funded ? pct(m.pctComplete) + " complete vs " + pct(m.plannedComplete) + " planned" : pct((() => {
      const acts = db.activities.filter(a => a.project === p.id);
      const w = sum(acts, a => Number(a.weight));
      return w ? sum(acts, a => Number(a.weight) * a.pct) / w / 100 : 0;
    })()) + " reported (no budget — outside EVM)"}`);
  if (funded) L.push(`- SPI ${m.measurable ? idx(m.spi) : "—"} · CPI ${m.measurable ? idx(m.cpi) : "—"}${m.measurable ? "" : " (too early to measure)"}`);
  L.push(`- Finish: planned ${fmtDate(p.finish)}${m.slipDays > 3 ? `, forecast ${fmtDate(m.forecastFinish)} (+${m.slipDays}d)` : " — on forecast"}`);
  if (raid.length) {
    L.push(`- Top register items:`);
    raid.slice(0, 3).forEach(r => L.push(`  - ${r.id} ${r.title} (exposure ${Engine.exposure(r)})`));
  }
  if (nextMs) L.push(`- Next milestone: ${nextMs.name} — ${fmtDate(nextMs.date)}`);
  L.push("");
  L.push(`_From Meridian IT-PMO._`);
  const md = L.join("\n");
  const done = () => toast("Status copied", p.id + " — paste it into email or chat");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(md).then(done, () => { saveText("status-" + p.id + ".md", md, "text/markdown"); });
  } else {
    saveText("status-" + p.id + ".md", md, "text/markdown");
  }
}

function setHealth(db, p) {
  const m = Engine.metrics(db, p.id);
  formDialog({
    title: "Set project status", kicker: p.id,
    fields: [
      { key: "mode", label: "Status source", type: "select", value: p.healthOverride ? "manual" : "auto",
        options: [{ value: "auto", label: "Derived from SPI and CPI" }, { value: "manual", label: "Set by the project manager" }] },
      { key: "rag", label: "Manual status", type: "select", value: p.healthOverride || m.health.rag,
        options: [{ value: "G", label: "Green" }, { value: "A", label: "Amber" }, { value: "R", label: "Red" }] },
      { key: "note", label: "Reason for the call", type: "textarea", span: 2, rows: 2, value: "" },
    ],
    extra: h("div", { class: "small muted" }, "Derived status right now: " + RAG_LABEL[m.health.rag] + " — " + m.health.why),
    saveLabel: "Set status",
    onSave: (v) => App.write("Project status set", (a) => a.patch("/projects/" + p.id + "/health", {
      rag: v.rag === "auto" ? null : v.rag, why: v.why, version: p.version,
    }), { detail: v.rag === "auto" ? "Back to automatic" : v.why }),
  });
}

function advancePhase(db, p) {
  const i = PHASES.indexOf(p.phase);
  if (i >= PHASES.length - 1) return toast("Already closed", p.id + " has nowhere further to go");
  const next = PHASES[i + 1];
  confirmDialog({
    title: "Advance to " + next + "?", confirmLabel: "Advance phase",
    message: p.name + " moves from " + p.phase + " to " + next + ".",
    detail: Engine.canAdvance(db, p.id).reason,
  }).then(ok => ok && App.write("Phase advanced",
    (a) => a.patch("/projects/" + p.id + "/phase", { version: p.version }),
    { detail: p.id + " → " + next }));
}

function addMilestone(db, p) {
  formDialog({
    title: "Add milestone", kicker: p.id,
    fields: [
      { key: "name", label: "Milestone", required: true, span: 2 },
      { key: "date", label: "Date", type: "date", required: true, value: iso(addMonths(db.statusDate, 1)) },
      { key: "owner", label: "Owner", type: "select", value: p.pm, options: db.people.map(x => ({ value: x.id, label: x.name })) },
      /* V-03 — the flag that makes the site's freeze calendar apply. */
      { key: "intrusive", label: t("Touches the plant"), type: "checkbox", span: 2, value: false,
        hint: t("A cutover, a switch-over, anything a change freeze is about") },
    ],
    saveLabel: "Add milestone",
    onSave: (v) => App.write("Milestone added", (a) => a.post("/milestones", {
      project: p.id, name: v.name, date: v.date, owner: v.owner, intrusive: !!v.intrusive,
    }), { detail: v.name + " · " + fmtDate(v.date) }),
  });
}

function editActivity(db, a) {
  formDialog({
    title: "Edit stage", kicker: a.project + " · " + a.name,
    fields: [
      { key: "name", label: "Stage", required: true, span: 2, value: a.name },
      { key: "start", label: "Start", type: "date", required: true, value: a.start },
      { key: "end", label: "End", type: "date", required: true, value: a.end,
        validate: (v, st) => D(v) <= D(st.start) ? "End must fall after the start" : "" },
      { key: "pct", label: "Progress (%)", type: "number", min: 0, max: 100, value: a.pct },
      { key: "owner", label: "Owner", type: "select", value: a.owner, options: db.people.map(x => ({ value: x.id, label: x.name })) },
    ],
    saveLabel: "Save stage",
    onSave: (v) => App.write("Stage updated", (x) => x.patch("/activities/" + a.id, {
      name: v.name, start: v.start, end: v.end, pct: +v.pct, owner: v.owner, version: a.version,
    }), { detail: v.name }),
  });
}

/**
 * Re-baseline.
 *
 * Re-planning moves the plan; re-baselining moves what the plan is
 * measured against, and therefore erases the variance the portfolio has
 * been reporting. It is a group-level act with a deliberately blunt
 * confirmation, because the number that disappears is the one steering
 * has been watching.
 */
function rebaseline(db, p, m) {
  formDialog({
    title: "Re-baseline " + p.id, kicker: "Group authority", wide: true,
    fields: [
      { key: "baselineFinish", label: "New baseline finish", type: "date", required: true,
        value: p.finish,
        validate: (v) => (D(v) < D(p.start) ? "The baseline cannot precede the start" : "") },
      { key: "rebaseActivities", label: "Re-baseline every stage to its current plan",
        type: "checkbox", span: 2,
        hint: t("Sets each stage's baseline window to where it sits today. Schedule variance resets to zero.") },
      { key: "why", label: "Why the baseline is moving", type: "textarea", rows: 3, span: 2, required: true,
        hint: t("This is the record steering reads when it asks why the variance disappeared.") },
    ],
    extra: h("div", { class: "banner-warn", style: "padding:11px 13px;border-radius:var(--r)" },
      h("div", { class: "strong small warn" }, "Current variance will be erased"),
      h("div", { class: "xs muted", style: "margin-top:3px" },
        "Today: forecast " + fmtDate(m.forecastFinish) +
        (m.slipDays > 0 ? " — " + m.slipDays + " days beyond the committed date" : " — inside the committed date") +
        " · SPI " + (m.measurable ? idx(m.spi) : "—"))),
    saveLabel: "Re-baseline",
    onSave: (v) => App.write("Project re-baselined", (a) => a.patch("/projects/" + p.id + "/baseline", {
      baselineFinish: v.baselineFinish,
      rebaseActivities: !!v.rebaseActivities,
      version: p.version,
    }), { detail: p.id + " → " + fmtDate(v.baselineFinish) + " · " + v.why }),
  });
}

/* ── stages ───────────────────────────────────────────────────────── */

function addActivity(db, p, acts) {
  const last = acts[acts.length - 1];
  formDialog({
    title: "Add a stage", kicker: p.id, wide: true,
    fields: [
      { key: "name", label: "Stage", required: true, span: 2 },
      { key: "start", label: "Start", type: "date", required: true,
        value: last ? last.end : p.start },
      { key: "end", label: "End", type: "date", required: true,
        value: p.finish,
        validate: (v, st) => (D(v) < D(st.start) ? "The end must follow the start" : "") },
      { key: "weight", label: "Share of budget (%)", type: "number", min: 1, max: 90, value: 5,
        hint: t("Taken proportionally from the existing stages, so the shares still sum to 100%.") },
      { key: "owner", label: "Owner", type: "select", value: p.pm,
        options: db.people.map((x) => ({ value: x.id, label: x.name })) },
    ],
    saveLabel: "Add stage",
    onSave: (v) => App.write("Stage added", (a) => a.post("/activities", {
      project: p.id, name: v.name, start: v.start, end: v.end,
      weight: Number(v.weight) / 100, owner: v.owner,
      deps: last ? [last.id] : [],
    }), { detail: v.name }),
  });
}

function removeActivity(db, a) {
  confirmDialog({
    title: "Remove “" + a.name + "”?",
    message: "Its share of the budget is returned to the remaining stages.",
    detail: a.pct > 0
      ? "This stage reports " + a.pct + "% progress — the server will refuse until that is set back to zero."
      : "No progress has been reported against it.",
    confirmLabel: "Remove stage", danger: true,
  }).then((ok) => ok && App.write("Stage removed",
    (x) => x.del("/activities/" + a.id), { detail: a.name }));
}

/* ── milestones ───────────────────────────────────────────────────── */

function editMilestone(db, ms) {
  formDialog({
    title: "Edit milestone", kicker: ms.project,
    fields: [
      { key: "name", label: "Milestone", required: true, span: 2, value: ms.name },
      { key: "date", label: "Date", type: "date", required: true, value: ms.date },
      { key: "owner", label: "Owner", type: "select", value: ms.owner ?? "",
        options: db.people.map((x) => ({ value: x.id, label: x.name })) },
      { key: "done", label: "Achieved", type: "checkbox", span: 2, value: !!ms.done },
      { key: "intrusive", label: t("Touches the plant"), type: "checkbox", span: 2, value: !!ms.intrusive,
        hint: t("A cutover, a switch-over, anything a change freeze is about") },
    ],
    saveLabel: "Save milestone",
    onSave: (v) => App.write("Milestone updated", (a) => a.patch("/milestones/" + ms.id, {
      name: v.name, date: v.date, owner: v.owner || null, done: !!v.done,
      intrusive: !!v.intrusive, version: ms.version,
    }), { detail: v.name }),
  });
}

function removeMilestone(db, ms) {
  confirmDialog({
    title: "Remove “" + ms.name + "”?",
    message: "It disappears from the schedule, the horizon and every future agenda.",
    confirmLabel: "Remove milestone", danger: true,
  }).then((ok) => ok && App.write("Milestone removed",
    (a) => a.del("/milestones/" + ms.id), { detail: ms.name }));
}

/* ── cost corrections ─────────────────────────────────────────────── */

/**
 * A posting is never edited or deleted — actual cost has to keep
 * reconciling to the sum of the ledger. It is corrected the way a ledger
 * has always been corrected: an equal and opposite entry that names what
 * it reverses. Both lines stay on the record.
 */
function reverseCost(db, line) {
  const p = Engine.project(db, line.project);
  formDialog({
    title: "Reverse this posting", kicker: line.project + " · " + line.period,
    fields: [
      { key: "reason", label: "Why it is being reversed", required: true, span: 2, rows: 2,
        type: "textarea",
        hint: t("Both the original and the reversal stay visible; this is what explains the pair.") },
    ],
    extra: h("div", { class: "drop-hint" },
      h("div", { class: "small strong" }, cash(line.amount) +
        (line.fromContingency ? " · drawn from contingency" : "")),
      h("div", { class: "xs muted", style: "margin-top:2px" },
        (line.note || "no note") + " · booked " + (line.bookedOn ? fmtDate(line.bookedOn) : line.period))),
    saveLabel: "Post the reversal",
    onSave: (v) => App.write("Cost posting reversed",
      (a) => a.post("/cost/" + line.id + "/reverse", { reason: v.reason }),
      { detail: cash(-line.amount) + " against " + line.project }),
  });
}

/* ── cross-project dependencies ───────────────────────────────────── */

function manageCrossDeps(db) {
  const links = db.crossDeps ?? [];
  const writable = db.projects.filter((p) => may("schedule.write", p));
  const close = () => { const b = $(".backdrop"); if (b) b.remove(); };

  const stageOptions = (projectId) =>
    Engine.activities(db, projectId).map((a) => ({ value: String(a.stage), label: a.name }));

  dialog({
    title: "Cross-project dependencies", kicker: "Integrated master schedule", wide: true,
    body: h("div", null,
      h("p", { class: "small muted", style: "margin:0 0 14px;max-width:66ch" },
        "A link is a commitment between two projects, so it needs write authority over both ends. " +
        "Links you can see but not change are listed without a control."),
      links.length
        ? table({
            cols: [
              { key: "f", label: "Predecessor", get: (d) => h("div", null,
                  h("div", { class: "small strong" }, (Engine.project(db, d.from) || {}).name ?? d.from),
                  h("div", { class: "xs muted" }, "stage " + (d.fromStage + 1))) },
              { key: "t", label: "Successor", get: (d) => h("div", null,
                  h("div", { class: "small strong" }, (Engine.project(db, d.to) || {}).name ?? d.to),
                  h("div", { class: "xs muted" }, "stage " + (d.toStage + 1))) },
              { key: "l", label: "What passes", get: (d) => h("span", { class: "small" }, d.label || "—") },
              { key: "x", label: "", align: "r", get: (d) => {
                  const both = may("schedule.write", Engine.project(db, d.from)) &&
                               may("schedule.write", Engine.project(db, d.to));
                  return both
                    ? h("button", { class: "btn btn-xs btn-danger", onClick: () => {
                        close();
                        App.write("Dependency removed", (a) => a.del("/crossdeps/" + d.id),
                          { detail: d.from + " → " + d.to });
                      } }, "Remove")
                    : h("span", { class: "xs muted" }, "not yours");
                } },
            ],
            rows: links,
          })
        : h("div", { class: "drop-hint" }, "No cross-project links recorded."),

      writable.length >= 2
        ? h("div", { style: "margin-top:18px" },
            h("hr", { class: "hr" }),
            h("div", { style: "height:14px" }),
            h("button", { class: "btn btn-primary btn-sm", onClick: () => { close(); newCrossDep(db, writable, stageOptions); } },
              icon("plus", 12), "Link two projects"))
        : h("p", { class: "xs muted", style: "margin-top:14px" },
            "Adding a link needs write authority over both projects.")),
  });
}

function newCrossDep(db, writable, stageOptions) {
  const first = writable[0];
  const second = writable.find((p) => p.id !== first.id) ?? first;
  formDialog({
    title: "Link two projects", kicker: "Cross-project dependency", wide: true,
    fields: [
      { key: "from", label: "Predecessor project", type: "select", value: first.id,
        options: writable.map((p) => ({ value: p.id, label: p.id + " · " + p.name })) },
      { key: "fromStage", label: "Delivers at stage", type: "select", value: "0",
        options: stageOptions(first.id) },
      { key: "to", label: "Successor project", type: "select", value: second.id,
        options: writable.map((p) => ({ value: p.id, label: p.id + " · " + p.name })) },
      { key: "toStage", label: "Needed by stage", type: "select", value: "0",
        options: stageOptions(second.id) },
      { key: "label", label: "What passes between them", span: 2,
        placeholder: "e.g. Fraud scoring API" },
    ],
    saveLabel: "Create link",
    onSave: (v) => {
      if (v.from === v.to) return toast("Pick two different projects", "", true);
      return App.write("Dependency added", (a) => a.post("/crossdeps", {
        from: v.from, fromStage: Number(v.fromStage),
        to: v.to, toStage: Number(v.toStage), label: v.label,
      }), { detail: v.from + " → " + v.to });
    },
  });
}

function assignPerson(db, projectId) {
  const p = Engine.project(db, projectId);
  const taken = db.allocations.filter(a => a.project === projectId).map(a => a.person);
  const free = db.people.filter(x => !taken.includes(x.id));
  if (!free.length) return toast("Everyone is already assigned", "No unassigned people left in the directory");
  formDialog({
    title: "Assign to " + p.name, kicker: projectId,
    fields: [
      { key: "person", label: "Person", type: "select", span: 2, value: free[0].id,
        options: free.map(x => ({ value: x.id, label: x.name + " — " + x.role + " · " + (Engine.site(db, x.site) || {}).city })) },
      { key: "pct", label: "Allocation (%)", type: "number", min: 5, max: 100, step: 5, value: 50, required: true },
      { key: "from", label: "From", type: "date", value: p.start },
      { key: "to", label: "To", type: "date", value: p.finish, span: 2 },
    ],
    saveLabel: "Assign",
    onSave: (v) => {
      const cap = Engine.capacity(db, 8);
      const row = cap.rows.find(r => r.person.id === v.person);
      const willPeak = (row ? row.peak : 0) + (+v.pct);
      App.write("Person assigned", (a) => a.post("/allocations", {
        person: v.person, project: projectId, pct: +v.pct, from: v.from, to: v.to,
      }), { detail: Engine.personName(db, v.person) + " at " + v.pct + "% on " + projectId });
      if (db.settings.capacityAlerts && willPeak > db.settings.capacityCeiling)
        toast("Over capacity", Engine.personName(db, v.person) + " now peaks at " + willPeak + "%", true);
    },
  });
}
/* ── Schedule (Gantt) · Board ─────────────────────────────────────── */

/* Pixels per day at each zoom level. */
const ZOOM = { quarter: 0.55, month: 1.7, week: 6.2 };

/* Which projects start expanded. The v4 build named two projects here;
   with the register scoped per account that would expand nothing for
   most people, so the schedule opens collapsed and remembers what the
   user opened. */
App.ui.ganttOpen = {};
App.ui.ganttBaseline = true;
App.ui.ganttCritical = false;

Views.schedule = (db) => {
  if (App.ui.param && Engine.project(db, App.ui.param)) App.ui.ganttProject = App.ui.param;
  const scoped = App.scopedProjects();
  const shown = App.ui.ganttProject === "all" ? scoped : scoped.filter(p => p.id === App.ui.ganttProject);
  if (!shown.length) return h("div", { class: "sec" },
    emptyState(t("Nothing in this scope"), "No project matches the current programme, site or health filter."));

  const min = shown.reduce((a, p) => D(p.start) < D(a) ? p.start : a, shown[0].start);
  const max = shown.reduce((a, p) => D(p.finish) > D(a) ? p.finish : a, shown[0].finish);
  const from = addDays(startOfWeek(min), -7), to = addDays(max, 21);
  const span = days(from, to);
  const ppd = ZOOM[App.ui.ganttZoom];
  const width = Math.max(760, Math.round(span * ppd));
  const x = (d) => days(from, d) * ppd;

  /* ── ticks ─────────────────────────────────────────────────────── */
  const ticks = [];
  if (App.ui.ganttZoom === "week") {
    let w = startOfWeek(from);
    while (D(w) < D(to)) { ticks.push({ at: x(w), label: "W" + isoWeek(w) }); w = addDays(w, 7); }
  } else {
    let mth = D(monthKey(from) + "-01");
    while (mth < D(to)) {
      ticks.push({ at: x(mth), label: (App.ui.ganttZoom === "quarter" && mth.getUTCMonth() % 3 !== 0) ? "" : fmtMon(mth) });
      mth = addMonths(mth, 1);
    }
  }

  /* ── rows ──────────────────────────────────────────────────────── */
  const rows = [];
  shown.forEach(p => {
    const m = Engine.metrics(db, p.id);
    const cp = Engine.criticalPath(db, p.id);
    const open = !!App.ui.ganttOpen[p.id];
    rows.push({ kind: "project", p, m, cp, open });
    if (open) {
      Engine.activities(db, p.id).forEach(a => {
        if (App.ui.ganttCritical && !cp.critical.has(a.id)) return;
        rows.push({ kind: "act", p, a, cp, critical: cp.critical.has(a.id) });
      });
    }
  });
  const yOf = (i) => i * 38;
  const actIndex = {};
  rows.forEach((r, i) => { if (r.kind === "act") actIndex[r.a.id] = i; });

  /* ── bar interaction ───────────────────────────────────────────── */
  function makeBar(r, i) {
    const a = r.a;
    const left = x(a.start), w = Math.max(10, x(a.end) - x(a.start));
    const done = a.pct >= 100, planned = D(a.start) > D(db.statusDate);
    /* Planned progress for this stage today — a bar only turns red when the
       work behind it has actually slipped, so the accent stays meaningful. */
    const elapsed = clamp(days(a.start, db.statusDate) / Math.max(1, days(a.start, a.end)), 0, 1);
    const behind = !planned && !done && a.pct < elapsed * 100 - 12;
    const bar = h("div", {
      class: "gbar " + (planned ? "plan" : "done") + (behind ? " behind" : "") + (r.critical ? " crit" : ""),
      style: { left: left + "px", width: w + "px" },
      title: a.name + " · " + fmtDate(a.start) + " → " + fmtDate(a.end) + " · " + a.pct + "% ("
        + Math.round(elapsed * 100) + "% planned) · float " + (r.cp.float[a.id] || 0) + "d"
        + (r.critical ? " · on the critical path" : ""),
      tabindex: 0,
      onKeydown: (e) => {
        const step = e.shiftKey ? 7 : 1;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? step : -step;
          commit(a, dir, dir);
        }
      },
    },
      h("span", { class: "prog", style: { width: (done ? 100 : a.pct) + "%" } }),
      h("span", { style: "position:relative" }, a.name),
      h("span", { class: "grip l", "data-grip": "l" }),
      h("span", { class: "grip r", "data-grip": "r" }));

    let drag = null;
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const grip = e.target.dataset ? e.target.dataset.grip : null;
      drag = { x0: e.clientX, start: a.start, end: a.end, grip, left, w };
      bar.setPointerCapture(e.pointerId);
      bar.classList.add("dragging");
      e.preventDefault();
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dd = Math.round((e.clientX - drag.x0) / ppd);
      if (drag.grip === "l") {
        const nl = drag.left + dd * ppd, nw = drag.w - dd * ppd;
        if (nw > 8) { bar.style.left = nl + "px"; bar.style.width = nw + "px"; }
      } else if (drag.grip === "r") {
        const nw = drag.w + dd * ppd;
        if (nw > 8) bar.style.width = nw + "px";
      } else {
        bar.style.left = (drag.left + dd * ppd) + "px";
      }
    });
    const finish = (e) => {
      if (!drag) return;
      const dd = Math.round((e.clientX - drag.x0) / ppd);
      const d0 = drag.grip === "r" ? 0 : dd;
      const d1 = drag.grip === "l" ? 0 : dd;
      drag = null;
      bar.classList.remove("dragging");
      if (d0 || d1) commit(a, d0, d1); else App.emit();
    };
    bar.addEventListener("pointerup", finish);
    bar.addEventListener("pointercancel", finish);
    bar.addEventListener("dblclick", () => editActivity(db, a));
    return bar;
  }

  function commit(a, dStart, dEnd) {
    const ns = iso(addDays(a.start, dStart)), ne = iso(addDays(a.end, dEnd));
    if (days(ns, ne) < 1) return toast("Too short", "A stage needs at least a day");
    /* Dragging a bar is a write like any other, so it goes through the
       API and the audit trail. The breach warning is raised afterwards,
       against the book the server sent back rather than a local guess. */
    App.write("Schedule changed",
      (x) => x.patch("/activities/" + a.id, { start: ns, end: ne, version: a.version }),
      { detail: a.name + " → " + fmtDate(ns) + " – " + fmtDate(ne), quiet: true })
      .then((ok) => {
        if (!ok) return;
        const breaches = Engine.depBreaches(App.db, a.project);
        const mine = breaches.find(b => b.activity.id === a.id || b.predecessor.id === a.id);
        if (mine) toast("Dependency broken", mine.activity.name + " now starts " + mine.overlap + " days before " + mine.predecessor.name + " ends", true);
        else toast("Schedule changed", a.name + " moved to " + fmtDate(ns));
      });
  }

  /* ── row rendering ─────────────────────────────────────────────── */
  const rowEls = rows.map((r, i) => {
    if (r.kind === "project") {
      const left = x(r.p.start), w = Math.max(12, x(r.p.finish) - x(r.p.start));
      const fLeft = x(r.p.finish), fW = Math.max(0, x(r.m.forecastFinish) - x(r.p.finish));
      const ms = Engine.milestones(db, r.p.id);
      return h("div", { class: "gantt-row", style: "background:var(--color-neutral-100)" },
        h("div", { class: "gantt-name", style: "display:flex;align-items:center;gap:7px" },
          h("button", { class: "bare", style: "width:14px;flex:none;opacity:.6",
            "aria-label": (r.open ? "Collapse " : "Expand ") + r.p.name,
            onClick: () => { App.ui.ganttOpen[r.p.id] = !r.open; App.emit(); } },
            icon(r.open ? "chevronDown" : "chevronRight", 12)),
          h("div", { style: "min-width:0;flex:1" },
            h("div", { class: "strong small truncate" }, r.p.name),
            h("div", { class: "xs muted" }, r.p.id + " · " + (Engine.site(db, r.p.site) || {}).city)),
          ragDot(r.m.health.rag, false)),
        h("div", { class: "gantt-track" },
          h("div", { style: { position: "absolute", left: left + "px", width: w + "px", top: "12px", height: "14px", background: "var(--color-text)" } },
            h("span", { style: { position: "absolute", left: 0, top: 0, bottom: 0, background: "var(--color-neutral-500)", width: pct(r.m.pctComplete) } })),
          fW > 2 ? h("div", { title: "Forecast overrun " + r.m.slipDays + " days",
            style: { position: "absolute", left: fLeft + "px", width: fW + "px", top: "12px", height: "14px", background: "repeating-linear-gradient(45deg,var(--color-accent) 0 4px,transparent 4px 8px)" } }) : null,
          ...ms.map(msn => h("div", {
            class: "gmile" + (msn.gate && Engine.gateStatus(db, r.p.id, msn.gate).state === "At risk" ? " late" : ""),
            style: { left: (x(msn.date) - 7) + "px", top: "11px", width: "11px", height: "11px" },
            title: msn.name + " · " + fmtDate(msn.date) }))));
    }
    const a = r.a;
    return h("div", { class: "gantt-row" },
      h("div", { class: "gantt-name", style: "padding-left:22px;display:flex;align-items:center" },
        h("div", { style: "min-width:0" },
          h("div", { class: "small truncate" }, a.name),
          h("div", { class: "xs muted" }, fmtDate(a.start) + " → " + fmtDate(a.end) + " · " + a.pct + "%"))),
      h("div", { class: "gantt-track" },
        App.ui.ganttBaseline && (a.baseStart !== a.start || a.baseEnd !== a.end)
          ? h("div", { class: "gbase", title: "Baseline " + fmtDate(a.baseStart) + " → " + fmtDate(a.baseEnd),
              style: { left: x(a.baseStart) + "px", width: Math.max(6, x(a.baseEnd) - x(a.baseStart)) + "px" } }) : null,
        makeBar(r, i)));
  });

  /* ── dependency overlay ────────────────────────────────────────── */
  const links = [];
  rows.forEach((r, i) => {
    if (r.kind !== "act") return;
    r.a.deps.forEach(dep => {
      const j = actIndex[dep];
      if (j === undefined) return;
      const preAct = rows[j].a;
      links.push({ x1: x(preAct.end), y1: yOf(j) + 19, x2: x(r.a.start), y2: yOf(i) + 19, crit: r.critical && rows[j].critical });
    });
  });
  (db.crossDeps || []).forEach(cd => {
    const fromId = cd.from + "-A" + (cd.fromStage + 1), toId = cd.to + "-A" + (cd.toStage + 1);
    const i = actIndex[fromId], j = actIndex[toId];
    if (i === undefined || j === undefined) return;
    links.push({ x1: x(rows[i].a.end), y1: yOf(i) + 19, x2: x(rows[j].a.start), y2: yOf(j) + 19, cross: true, label: cd.label });
  });
  const overlay = s("svg", { class: "gdep", width, height: yOf(rows.length), viewBox: `0 0 ${width} ${yOf(rows.length)}` },
    ...links.map(l => {
      /* Where the successor starts before the predecessor ends — normal
         fast-tracking — a straight elbow would double back on itself, so
         the link drops into the gutter between the two rows instead. */
      let d;
      if (l.x2 - l.x1 >= 18) {
        const midX = l.x2 - 9;
        d = `M ${l.x1} ${l.y1} H ${midX} V ${l.y2} H ${l.x2}`;
      } else {
        const gutter = (l.y1 + l.y2) / 2 + (l.y2 > l.y1 ? -13 : 13);
        d = `M ${l.x1} ${l.y1} h 8 V ${gutter} H ${l.x2 - 8} V ${l.y2} H ${l.x2}`;
      }
      return s("g", null,
        s("path", { d, fill: "none", stroke: l.cross ? "var(--color-accent)" : "var(--color-neutral-500)",
          "stroke-width": l.cross ? 2 : 1.5, "stroke-dasharray": l.cross ? "5 3" : null }),
        s("polygon", { points: `${l.x2},${l.y2} ${l.x2 - 5},${l.y2 - 3.5} ${l.x2 - 5},${l.y2 + 3.5}`,
          fill: l.cross ? "var(--color-accent)" : "var(--color-neutral-500)" }));
    }));

  /* Month gridlines drawn to the same scale as the bars, behind everything. */
  const gridLines = s("svg", { width, height: yOf(rows.length),
    style: "position:absolute;left:250px;top:0;pointer-events:none;z-index:0" },
    ...ticks.map(t => s("line", { x1: t.at, y1: 0, x2: t.at, y2: yOf(rows.length),
      stroke: "var(--rule-1)", "stroke-width": 1 })));

  const grid = h("div", { class: "gantt", style: { width: (250 + width) + "px" } },
    h("div", { class: "gantt-hd" },
      h("div", { class: "gantt-name kicker" }, "Project / stage"),
      h("div", { class: "gantt-axis", style: { width: width + "px", position: "relative" } },
        ...ticks.map(t => h("div", { class: "kicker",
          style: { position: "absolute", left: t.at + "px", top: "7px", "border-left": "1px solid var(--rule-1)", "padding-left": "4px", "font-size": "9px" } }, t.label)))),
    h("div", { style: "position:relative" },
      gridLines,
      h("div", { style: { position: "absolute", left: "250px", top: 0, width: width + "px", height: yOf(rows.length) + "px", "pointer-events": "none" } },
        h("div", { class: "gtoday", style: { left: x(db.statusDate) + "px" }, title: "Today" }),
        overlay),
      ...rowEls));

  const controls = h("div", { class: "sec-tight band", style: "display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap" },
    selectField("Schedule", App.ui.ganttProject,
      [{ value: "all", label: "All projects in scope" }].concat(scoped.map(p => ({ value: p.id, label: p.id + " · " + p.name }))),
      v => App.set({ ganttProject: v }), "260px"),
    h("div", { class: "field" }, h("label", null, "Zoom"),
      h("div", { class: "seg" }, ...["quarter", "month", "week"].map(z =>
        h("button", { class: "seg-opt" + (App.ui.ganttZoom === z ? " on" : ""), onClick: () => App.set({ ganttZoom: z }) },
          z[0].toUpperCase() + z.slice(1))))),
    h("div", { class: "field" }, h("label", null, "Show"),
      h("div", { class: "chips" },
        chip("Baseline", App.ui.ganttBaseline, () => App.set({ ganttBaseline: !App.ui.ganttBaseline })),
        chip("Critical path only", App.ui.ganttCritical, () => App.set({ ganttCritical: !App.ui.ganttCritical })))),
    h("div", { style: "flex:1" }),
    h("button", { class: "btn btn-sm", onClick: () => manageCrossDeps(db) },
      icon("arrowRight", 12), "Cross-project links"),
    h("div", { class: "small muted", style: "max-width:260px;text-align:left" },
      "Drag a bar to move it, drag an edge to change its length, double-click to edit. Arrow keys nudge a day, shift-arrow a week."));

  const breaches = shown.flatMap(p => Engine.depBreaches(db, p.id));
  const banner = breaches.length ? h("div", { class: "sec-tight band banner-warn" },
    h("div", { class: "strong small warn" }, breaches.length + " dependency breach" + (breaches.length === 1 ? "" : "es") + " in this view"),
    h("div", { class: "xs muted" }, breaches.slice(0, 3).map(b =>
      b.activity.name + " starts " + b.overlap + "d before " + b.predecessor.name + " ends").join(" · "))) : null;

  return h("div", null, controls, banner,
    h("div", { class: "sec", style: "overflow-x:auto;padding-top:0" }, grid),
    h("div", { class: "sec-tight", style: "padding-top:0" },
      legend([
        { color: "var(--color-text)", label: "In flight or complete" },
        { color: "var(--color-neutral-300)", label: "Not started" },
        { color: "var(--color-accent)", label: "Critical path · cross-project link · today" },
        { color: "var(--color-neutral-400)", label: "Baseline" },
      ])));
};

/* ── Board ────────────────────────────────────────────────────────── */
Views.board = (db) => {
  const scoped = App.scopedProjects();
  const boardProjects = App.ui.boardProject === "all" ? scoped : scoped.filter(p => p.id === App.ui.boardProject);
  const ids = boardProjects.map(p => p.id);
  const filter = { assignee: App.ui.boardAssignee || null };
  const all = db.items.filter(i => ids.includes(i.project) && (!filter.assignee || i.assignee === filter.assignee));

  const wipBreaches = db.columns.filter(c => c.wip > 0 && all.filter(i => i.column === c.id).length > c.wip);
  const donePts = sum(all.filter(i => i.column === "done"), i => i.points);
  const totalPts = sum(all, i => i.points);

  const controls = h("div", { class: "sec-tight band", style: "display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap" },
    selectField("Board", App.ui.boardProject,
      [{ value: "all", label: "All projects in scope" }].concat(scoped.map(p => ({ value: p.id, label: p.id + " · " + p.name }))),
      v => App.set({ boardProject: v }), "260px"),
    selectField("Assignee", App.ui.boardAssignee,
      [{ value: "", label: "Everyone" }].concat(uniq(all.map(i => i.assignee)).filter(Boolean).map(a => ({ value: a, label: Engine.personName(db, a) }))),
      v => App.set({ boardAssignee: v }), "180px"),
    h("div", { style: "flex:1" }),
    h("div", { style: "text-align:left" },
      h("div", { class: "kicker" }, "Work in this view"),
      h("div", { class: "small strong mono" }, all.length + " items · " + totalPts + " points · " + (totalPts ? Math.round(donePts / totalPts * 100) : 0) + "% done")),
    primaryAction("board", db));

  const banner = wipBreaches.length ? h("div", { class: "sec-tight band banner-warn" },
    h("div", { class: "strong small warn" }, "Work-in-progress limit exceeded in " + wipBreaches.map(c => c.name.toLowerCase()).join(", ")),
    h("div", { class: "xs muted" }, "Finish something before starting more — limits are set per column in administration.")) : null;

  const board = h("div", { class: "board" }, ...db.columns.map(col => {
    const items = all.filter(i => i.column === col.id);
    const over = col.wip > 0 && items.length > col.wip;
    const colEl = h("div", { class: "col" },
      h("div", { class: "col-hd" },
        h("span", { class: "n" }, col.name),
        h("span", { class: "small mono " + (over ? "wip-over" : "muted") },
          col.wip > 0 ? items.length + " / " + col.wip : String(items.length))),
      h("div", { class: "col-body", style: "min-height:80px" },
        ...items.map(it => card(it)),
        items.length ? null : h("div", { class: "drop-hint" }, "Nothing here. Drag an item across, or add one.")));

    colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.classList.add("over"); });
    colEl.addEventListener("dragleave", () => colEl.classList.remove("over"));
    colEl.addEventListener("drop", (e) => {
      e.preventDefault(); colEl.classList.remove("over");
      const id = e.dataTransfer.getData("text/plain");
      moveItem(db, id, col.id);
    });
    return colEl;
  }));

  function card(it) {
    const el = h("div", { class: "kcard " + it.priority.toLowerCase(), draggable: "true", tabindex: 0,
      onDblclick: () => editItem(db, it),
      onKeydown: (e) => {
        const i = db.columns.findIndex(c => c.id === it.column);
        if (e.key === "ArrowRight" && i < db.columns.length - 1) { e.preventDefault(); moveItem(db, it.id, db.columns[i + 1].id); }
        if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); moveItem(db, it.id, db.columns[i - 1].id); }
        if (e.key === "Enter") editItem(db, it);
      } },
      h("div", { class: "kcard-t" }, it.title),
      h("div", { class: "kcard-m" },
        avatar(db, it.assignee, "sm"),
        h("span", { class: "sp mono" }, it.id + (App.ui.boardProject === "all" ? " · " + it.project.replace("PRJ-", "") : "")),
        tag(it.priority, it.priority === "P1" ? "tag-accent" : it.priority === "P2" ? "" : "tag-out"),
        h("span", { class: "mono strong" }, it.points)));
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", it.id); el.classList.add("drag"); });
    el.addEventListener("dragend", () => el.classList.remove("drag"));
    return el;
  }

  const stats = h("div", { class: "sec-tight band-1", style: "display:flex;gap:32px;flex-wrap:wrap" },
    ...db.columns.map(c => {
      const items = all.filter(i => i.column === c.id);
      return h("div", null,
        h("div", { class: "kicker" }, c.name),
        h("div", { class: "num", style: "font-size:19px" }, sum(items, i => i.points)),
        h("div", { class: "xs muted" }, items.length + " items"));
    }),
    h("div", { style: "flex:1" }),
    h("div", { style: "min-width:180px" },
      h("div", { class: "kicker" }, "Completed"),
      h("div", { style: "display:flex;align-items:baseline;gap:8px" },
        h("span", { class: "num", style: "font-size:19px" }, donePts + " pts"),
        h("span", { class: "small muted" }, "of " + totalPts)),
      meter(totalPts ? donePts / totalPts : 0, "var(--color-text)", "thin")));

  return h("div", null, controls, banner, stats, board);
};

function moveItem(db, itemId, colId) {
  const it = db.items.find(i => i.id === itemId);
  if (!it || it.column === colId) return;
  const col = db.columns.find(c => c.id === colId);
  const count = db.items.filter(i => i.column === colId && i.project === it.project).length;
  const doMove = () => App.write("Item moved", (a) => a.patch("/workitems/" + itemId, {
    column: colId, version: (App.db.items.find((x) => x.id === itemId) || {}).version,
  }), { quiet: true });

  if (col.wip > 0 && count >= col.wip) {
    confirmDialog({
      title: col.name + " is at its limit",
      message: col.name + " holds " + count + " items against a limit of " + col.wip + ".",
      detail: "Moving " + it.id + " in breaks the limit. Finishing something already in the column is usually the better move.",
      confirmLabel: "Move anyway", danger: true,
    }).then(ok => ok && doMove());
  } else doMove();
}

function itemFields(db, it, defaultProject) {
  return [
    { key: "title", label: "Item", required: true, span: 2, value: it ? it.title : "" },
    { key: "project", label: "Project", type: "select", value: it ? it.project : defaultProject,
      options: db.projects.map(p => ({ value: p.id, label: p.id + " · " + p.name })) },
    { key: "assignee", label: "Assignee", type: "select", value: it ? it.assignee : db.people[0].id,
      options: db.people.map(p => ({ value: p.id, label: p.name + " — " + p.role })) },
    { key: "points", label: "Points", type: "number", min: 1, max: 21, value: it ? it.points : 3 },
    { key: "priority", label: "Priority", type: "select", value: it ? it.priority : "P2", options: ["P1", "P2", "P3"] },
    { key: "column", label: "Column", type: "select", value: it ? it.column : "backlog",
      options: db.columns.map(c => ({ value: c.id, label: c.name })), span: 2 },
  ];
}

function newItem(db, defaultProject) {
  if (!db.projects.length) return toast("No projects yet");
  formDialog({
    title: "New work item", kicker: "Board", fields: itemFields(db, null, defaultProject || db.projects[0].id),
    saveLabel: "Add item",
    onSave: (v) => App.write("Work item added", (a) => a.post("/workitems", {
      project: v.project, column: v.column, title: v.title,
      assignee: v.assignee, points: +v.points, priority: v.priority,
    }), { detail: v.title }),
  });
}

function editItem(db, it) {
  formDialog({
    title: "Edit work item", kicker: it.id, fields: itemFields(db, it),
    saveLabel: "Save item",
    extra: h("button", { class: "btn btn-sm btn-danger", onClick: () => {
      confirmDialog({ title: "Delete " + it.id + "?", message: it.title, confirmLabel: "Delete", danger: true })
        .then(ok => { if (ok) { App.write("Work item deleted", (a) => a.del("/workitems/" + it.id), { detail: it.id }); closeDialog(); } });
    } }, icon("trash", 12), "Delete item"),
    onSave: (v) => App.write("Work item updated", (a) => a.patch("/workitems/" + it.id, {
      project: v.project, column: v.column, title: v.title, assignee: v.assignee,
      points: +v.points, priority: v.priority, version: it.version,
    }), { detail: v.title }),
  });
}
/* ── Risks & issues · Budget · Change control · Resources ─────────────────────────────────────── */
Views.risk = (db) => {
  if (App.ui.param) {
    const r = db.raid.find(x => x.id === App.ui.param);
    if (r) { setTimeout(() => raidDetail(db, r), 0); App.ui.param = null; }
  }
  const scoped = App.scopedProjects().map(p => p.id);
  const f = App.ui.raidFilter;
  const cell = App.ui.raidCell;

  let list = db.raid.filter(r => !r.project || scoped.includes(r.project));
  if (f === "Risks") list = list.filter(r => r.type === "Risk");
  else if (f === "Issues") list = list.filter(r => r.type === "Issue");
  else if (f === "Assumptions") list = list.filter(r => r.type === "Assumption");
  else if (f === "Dependencies") list = list.filter(r => r.type === "Dependency");
  else if (f === "Escalated") list = list.filter(r => Engine.escalation(db, r).level === "Steering");
  else if (f === "Closed") list = list.filter(r => r.status === "Closed");
  if (f !== "Closed") list = list.filter(r => r.status === "Open");
  if (cell) list = list.filter(r => r.p === cell.p && r.i === cell.i);

  const cols = [
    { key: "id", label: "Ref", sort: r => r.id, width: "78px", get: r =>
        h("span", { class: "mono small strong", style: r.type === "Issue" ? "color:var(--sig-red)" : null }, r.id) },
    { key: "title", label: "Title", sort: r => r.title, get: r => h("div", null,
        h("div", { class: "strong" }, r.title),
        h("div", { class: "xs muted" }, (r.project ? r.project + " · " + (Engine.project(db, r.project) || {}).name : "Portfolio-wide") + " · " + r.type)) },
    { key: "pi", label: "P × I", align: "c", sort: r => Engine.exposure(r), width: "62px",
      get: r => h("span", { class: "mono small" }, r.p + " × " + r.i) },
    { key: "exp", label: "Exposure", align: "c", sort: r => Engine.exposure(r), width: "92px", get: r => {
        const band = Engine.exposureBand(r);
        return tag(band, band === "Critical" ? "tag-accent" : band === "High" ? "tag-soft" : band === "Medium" ? "" : "tag-out"); } },
    { key: "esc", label: "Heard by", sort: r => Engine.escalation(db, r).level, get: r => {
        const e = Engine.escalation(db, r);
        return h("span", { class: "small", title: e.why, style: e.level === "Steering" ? "font-weight:700;color:var(--sig-red)" : null }, e.level); } },
    { key: "resp", label: "Response", sort: r => r.response, get: r => h("span", { class: "small" }, r.response) },
    { key: "owner", label: "Owner", sort: r => Engine.personName(db, r.owner), get: r => h("span", { class: "small" }, Engine.personName(db, r.owner)) },
    { key: "review", label: "Review", align: "r", sort: r => r.review, get: r => {
        const late = D(r.review) < D(db.statusDate);
        return h("span", { class: "mono small", style: late ? "color:var(--sig-red);font-weight:700" : null }, fmtDate(r.review)); } },
  ];

  const filters = ["All", "Risks", "Issues", "Assumptions", "Dependencies", "Escalated", "Closed"];
  const left = h("section", { class: "l sec" },
    h("div", { class: "sec-hd" },
      h("div", { class: "chips" }, ...filters.map(x => chip(x, f === x, () => App.set({ raidFilter: x, raidCell: null })))),
      h("span", { class: "sp" }),
      cell ? chip("P" + cell.p + " × I" + cell.i + " ✕", true, () => App.set({ raidCell: null })) : null,
      primaryAction("risk", db)),
    sortableTable({ cols, rows: list, onRow: r => raidDetail(db, r),
      empty: { title: "Nothing matches this filter", body: "The register is clear for this combination of type, scope and cell." } }),
    h("div", { class: "small muted", style: "margin-top:10px" },
      tData(list.length + " shown · " + db.raid.filter(r => r.status === "Open").length + " open across the whole book")));

  /* heat matrix */
  const counts = {};
  db.raid.filter(r => r.status === "Open" && (!r.project || scoped.includes(r.project)))
    .forEach(r => { const k = r.p + "-" + r.i; counts[k] = (counts[k] || 0) + 1; });
  const cellBg = (e) => e >= 15 ? "var(--sig-red)" : e >= 9 ? "var(--sig-amber)"
    : e >= 4 ? "var(--sig-amber-soft)" : "var(--color-surface)";
  const gridCells = [];
  for (let prob = 5; prob >= 1; prob--) {
    gridCells.push(h("div", { class: "grid-cell head" }, String(prob)));
    for (let imp = 1; imp <= 5; imp++) {
      const n = counts[prob + "-" + imp] || 0;
      const e = prob * imp;
      const on = cell && cell.p === prob && cell.i === imp;
      gridCells.push(h("div", {
        class: "grid-cell", title: "Probability " + prob + " × impact " + imp + " = " + e + (n ? " · " + n + " open" : " · empty"),
        style: { background: cellBg(e), color: e >= 9 ? "var(--on-solid)" : "var(--color-text)",
          outline: on ? "2px solid var(--color-accent)" : null, "outline-offset": "-2px" },
        onClick: () => App.set({ raidCell: n ? { p: prob, i: imp } : null, raidFilter: "All" }),
      }, n ? String(n) : ""));
    }
  }
  gridCells.push(h("div", { class: "grid-cell head" }));
  for (let imp = 1; imp <= 5; imp++) gridCells.push(h("div", { class: "grid-cell head" }, String(imp)));

  const responses = RESPONSES.map(r => ({ r, n: db.raid.filter(x => x.status === "Open" && x.response === r).length })).filter(x => x.n);

  const rail = h("aside", { class: "sec" },
    sectionHead("Exposure matrix", "open items, probability × impact"),
    h("div", { style: "display:grid;grid-template-columns:26px repeat(5,1fr);gap:2px" }, ...gridCells),
    h("div", { class: "xs muted", style: "margin-top:6px;display:flex;justify-content:space-between" },
      h("span", null, "↑ probability"), h("span", null, "impact →")),
    h("div", { class: "xs muted", style: "margin-top:8px" }, "Click a populated cell to filter the register."),

    h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead("Escalation thresholds"),
    h("div", null,
      [{ n: "Steering committee", r: "Exposure at or above " + db.settings.escalateExposure },
       { n: "PMO", r: "Exposure at or above " + db.settings.pmoExposure + ", or an issue open more than " + db.settings.issueAgeDays + " days" },
       { n: "Project", r: "Everything else, reviewed on the " + db.settings.cadence.toLowerCase().split("—")[0].trim() + " cycle" }]
      .map(t => h("div", { class: "list-row" },
        h("span", { class: "mark" }),
        h("div", null, h("div", { class: "strong small" }, t.n), h("div", { class: "xs muted" }, t.r))))),
    h("div", { style: "margin-top:10px" },
      h("button", { class: "btn btn-sm", onClick: () => go("#/admin") }, "Change thresholds")),

    h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead("Response mix", "open items"),
    h("div", null, responses.map(x => h("div", { style: "padding:6px 0;border-bottom:1px solid var(--rule-1);display:flex;gap:10px;align-items:center" },
      h("span", { class: "small strong", style: "width:78px" }, x.r),
      h("span", { style: "flex:1" }, meter(x.n / Math.max(...responses.map(y => y.n)), "var(--color-text)", "thin")),
      h("span", { class: "mono small" }, x.n)))));

  return h("div", { class: "split" }, left, rail);
};

function raidDetail(db, r) {
  const e = Engine.escalation(db, r);
  dialog({
    title: r.title, kicker: r.type + " · " + r.id + " · " + (r.project || "Portfolio-wide"), wide: true,
    body: h("div", null,
      h("div", { class: "kpis", style: "grid-template-columns:repeat(4,1fr);border-bottom:0;margin-bottom:14px" },
        h("div", { class: "kpi", style: "padding:0 14px 0 0" }, h("div", { class: "kicker" }, "Exposure"),
          h("div", { class: "kpi-v", style: "font-size:24px" }, String(Engine.exposure(r))),
          h("div", { class: "kpi-n" }, Engine.exposureBand(r))),
        h("div", { class: "kpi", style: "padding:0 14px" }, h("div", { class: "kicker" }, "Response"),
          h("div", { class: "kpi-v", style: "font-size:24px" }, r.response), h("div", { class: "kpi-n" }, r.status)),
        h("div", { class: "kpi", style: "padding:0 14px" }, h("div", { class: "kicker" }, "Owner"),
          h("div", { class: "kpi-v", style: "font-size:19px" }, Engine.personName(db, r.owner)),
          h("div", { class: "kpi-n" }, "opened " + fmtDate(r.opened))),
        h("div", { class: "kpi", style: "padding:0 0 0 14px;border-right:0" }, h("div", { class: "kicker" }, "Heard by"),
          h("div", { class: "kpi-v", style: "font-size:19px" }, e.level), h("div", { class: "kpi-n" }, e.why))),
      h("hr", { class: "hr" }),
      h("p", { style: "margin:14px 0" }, r.detail || "No detail recorded."),
      h("div", { class: "small muted" }, "Next review " + fmtDateLong(r.review))),
    actions: (close) => [
      h("button", { class: "btn btn-sm btn-danger", onClick: () => {
        confirmDialog({ title: "Delete " + r.id + "?", message: r.title, confirmLabel: "Delete", danger: true })
          .then(ok => { if (ok) { App.write("RAID item deleted", (a) => a.del("/raid/" + r.id), { detail: r.id }); close(); } });
      } }, "Delete"),
      h("button", { class: "btn btn-sm", onClick: () => { close(); editRaid(db, r); } }, icon("pencil", 12), "Edit"),
      r.status === "Open"
        ? h("button", { class: "btn btn-sm btn-primary", onClick: () => {
            App.write("Item closed", (a) => a.patch("/raid/" + r.id, { status: "Closed", version: r.version }), { detail: r.id + " · " + r.title });
            close(); } }, icon("check", 12), "Close item")
        : h("button", { class: "btn btn-sm", onClick: () => {
            App.write("Item reopened", (a) => a.patch("/raid/" + r.id, { status: "Open", version: r.version }), { detail: r.id });
            close(); } }, "Reopen"),
    ],
  });
}

function raidFields(db, r, projectId) {
  return [
    { key: "type", label: "Type", type: "select", value: r ? r.type : "Risk", options: RAID_TYPES },
    { key: "project", label: "Project", type: "select", value: r ? (r.project || "") : (projectId || ""),
      options: [{ value: "", label: "Portfolio-wide" }].concat(db.projects.map(p => ({ value: p.id, label: p.id + " · " + p.name }))) },
    { key: "title", label: "Title", required: true, span: 2, value: r ? r.title : "" },
    { key: "p", label: "Probability (1–5)", type: "number", min: 1, max: 5, required: true, value: r ? r.p : 3 },
    { key: "i", label: "Impact (1–5)", type: "number", min: 1, max: 5, required: true, value: r ? r.i : 3 },
    /* R-07 — the standing-up path is type, project, title, P×I. The rest
       folds; defaults are sensible, and an edit re-opens what is filled. */
    { key: "detail", label: "Detail", type: "textarea", span: 2, rows: 3, value: r ? r.detail : "", advanced: true },
    { key: "response", label: "Response", type: "select", value: r ? r.response : "Mitigate", options: RESPONSES, advanced: true },
    { key: "owner", label: "Owner", type: "select", value: r ? r.owner : db.currentUser, options: db.people.map(p => ({ value: p.id, label: p.name })), advanced: true },
    { key: "review", label: "Next review", type: "date", value: r ? r.review : iso(addDays(db.statusDate, 14)), span: 2, advanced: true },
  ];
}

/* ── the auditor's pack, and the BI extract (V-15 / V-16) ──────────── */

function evidencePack(db, p) {
  formDialog({
    title: t("Evidence pack"), kicker: p.id, wide: true,
    fields: [
      { key: "asOf", label: t("As at"), type: "date", value: db.statusDate, span: 2,
        hint: t("Everything on the record up to this date — leave today's date for current state") },
    ],
    saveLabel: "Build the pack",
    extra: h("div", { class: "small muted", style: "max-width:60ch" },
      t("The trail is append-only, so a pack built today for a date in the past says exactly what it said then.")),
    onSave: async (v) => {
      try {
        const r = await api.get("/projects/" + p.id + "/evidence?asOf=" + encodeURIComponent(v.asOf));
        saveText("evidence-" + p.id + "-" + v.asOf + ".md", r.markdown, "text/markdown");
        toast(t("Evidence pack built"), r.events + t(" recorded event(s)"));
        return true;
      } catch (e) {
        reportError(e, t("Evidence pack"));
        return false;
      }
    },
  });
}

async function exportDataset() {
  try {
    const r = await api.get("/export/dataset");
    const cols = r.rows.length ? Object.keys(r.rows[0]) : [];
    const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...r.rows.map((row) => cols.map((c) => cell(row[c])).join(","))].join("\r\n");
    saveText("meridian-dataset-" + r.asAt + ".csv", "﻿" + csv, "text/csv");
    toast(t("Dataset exported"), r.rows.length + t(" project row(s)"));
  } catch (e) {
    reportError(e, t("Dataset export"));
  }
}

/* ── commitments: money promised, not yet spent (V-05) ──────────────── */

const COMMITMENT_STATES = ["Open", "Part received", "Received", "Cancelled"];

function commitmentsBlock(db, list) {
  const ids = new Set(list.map(p => p.id));
  const rows = (db.commitments ?? []).filter(c => ids.has(c.project))
    .sort((a, b) => String(b.raisedOn).localeCompare(String(a.raisedOn)));
  const openOnes = rows.filter(c => ["Open", "Part received"].includes(c.status));
  const writable = list.find(p => App.can("cost.write", { project: asRow(p) }));

  return h("div", null,
    sectionHead(t("Commitments"),
      openOnes.length
        ? money(sum(openOnes, c => c.amount)) + t(" on ") + openOnes.length + t(" open order(s)")
        : t("nothing committed"),
      writable
        ? h("button", { class: "btn btn-sm", onClick: () => addCommitment(db, list) },
            icon("plus", 12), t("Raise a commitment"))
        : null),
    rows.length
      ? table({
          cols: [
            { key: "r", label: t("Reference"), get: c => h("div", null,
                h("span", { class: "strong small" }, c.reference),
                h("div", { class: "xs muted" }, [c.supplier, c.desc].filter(Boolean).join(" · "))) },
            { key: "p", label: t("Project"), get: c => h("span", { class: "small linkish",
                onClick: () => go("#/project/" + c.project) }, (Engine.project(db, c.project) || {}).name ?? c.project) },
            { key: "k", label: t("Type"), get: c => h("span", { class: "tag tag-out" }, t(c.kind)) },
            { key: "a", label: t("Amount"), align: "r", get: c => h("div", null,
                h("span", { class: "mono small strong" }, money(c.amount)),
                c.currency && c.currency !== "USD"
                  ? h("div", { class: "xs muted" }, c.currency + " @ " + c.fx)
                  : null) },
            { key: "d", label: t("Expected"), get: c => h("span", { class: "mono small" },
                c.expectedOn ? fmtDate(c.expectedOn) : "—") },
            { key: "s", label: t("Status"), get: c => statusTag(
                c.status === "Received" ? "Cleared" : c.status === "Cancelled" ? "At risk" : "Planned") },
            { key: "e", label: "", align: "r", get: c =>
                App.can("cost.write", { project: asRow(Engine.project(db, c.project) ?? {}) })
                  ? h("button", { class: "btn btn-xs", onClick: () => editCommitment(db, c) }, t("Edit"))
                  : null },
          ], rows,
        })
      : h("div", { class: "small muted", style: "max-width:64ch" },
          t("Nothing is committed. A purchase order raised is money gone from the envelope months before it becomes a cost line — recording it here is what stops the budget looking healthier than it is.")));
}

function commitmentFields(db, list, c) {
  return [
    { key: "project", label: t("Project"), type: "select", required: true, value: c?.project ?? list[0]?.id ?? "",
      options: list.map(p => ({ value: p.id, label: p.name })) },
    { key: "reference", label: t("Purchase order"), required: true, value: c?.reference ?? "" },
    { key: "supplier", label: t("Supplier"), value: c?.supplier ?? "" },
    { key: "amount", label: t("Amount (M)"), type: "number", step: "any", required: true, value: c?.amount ?? "" },
    { key: "kind", label: t("Type"), type: "select", value: c?.kind ?? "capex",
      options: [{ value: "capex", label: t("capex") }, { value: "opex", label: t("opex") }] },
    { key: "currency", label: t("Currency"), value: c?.currency ?? "USD" },
    { key: "fx", label: t("Rate to reporting currency"), type: "number", step: "any", value: c?.fx ?? 1,
      hint: t("As at the date it was raised — the ledger does not revalue its own history") },
    { key: "expectedOn", label: t("Expected"), type: "date", value: c?.expectedOn ?? "" },
    { key: "description", label: t("What it buys"), type: "textarea", rows: 2, span: 2, value: c?.desc ?? "" },
  ];
}

function addCommitment(db, list) {
  const mine = list.filter(p => App.can("cost.write", { project: asRow(p) }));
  formDialog({
    title: t("Raise a commitment"), kicker: t("Committed money"), wide: true,
    fields: commitmentFields(db, mine, null), saveLabel: "Raise commitment",
    onSave: (v) => App.write(t("Commitment raised"), (a) => a.post("/commitments", {
      project: v.project, reference: v.reference, supplier: v.supplier, amount: v.amount,
      kind: v.kind, currency: v.currency, fx: v.fx, expectedOn: v.expectedOn, description: v.description,
    }), { detail: v.reference }),
  });
}

function editCommitment(db, c) {
  formDialog({
    title: t("Edit ") + c.reference, kicker: c.id, wide: true,
    fields: [
      ...commitmentFields(db, [Engine.project(db, c.project) ?? { id: c.project, name: c.project }], c)
        .filter(f => f.key !== "project"),
      { key: "status", label: t("Status"), type: "select", value: c.status, options: COMMITMENT_STATES,
        hint: t("Received means it has become a cost line — it stops counting as committed") },
    ],
    saveLabel: "Save commitment",
    onSave: (v) => App.write(t("Commitment updated"), (a) => a.patch("/commitments/" + c.id, {
      reference: v.reference, supplier: v.supplier, amount: v.amount, kind: v.kind,
      currency: v.currency, fx: v.fx, expectedOn: v.expectedOn, description: v.description,
      status: v.status, version: c.version,
    }), { detail: c.reference }),
  });
}

/* ── Roadmap (V-08) and the dependency network (V-11) ─────────────────
   The surface the brief asked for and the model never had: what lands
   when, by programme, across quarters — with the links that will move it
   drawn underneath rather than remembered by one person. */

function quartersFrom(start, count) {
  const out = [];
  const d = D(start);
  let y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth() / 3);
  for (let i = 0; i < count; i++) {
    out.push({ y, q, label: "Q" + (q + 1) + " " + String(y).slice(2),
      from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`,
      to: `${q === 3 ? y + 1 : y}-${String(q === 3 ? 1 : q * 3 + 4).padStart(2, "0")}-01` });
    q++; if (q > 3) { q = 0; y++; }
  }
  return out;
}

Views.roadmap = (db) => {
  const list = App.scopedProjects();
  if (!db.projects.length) return emptyBookPanel(db);
  const QN = 8;
  const qs = quartersFrom(db.statusDate, QN);
  const span = { from: qs[0].from, to: qs[QN - 1].to };

  const byProgramme = db.programmes
    .map(pr => ({ pr, items: list.filter(p => p.programme === pr.id && !p.closed) }))
    .filter(g => g.items.length);

  /* A bar per project across the quarter grid, with its gates and any
     intrusive milestone marked — the two things that move a roadmap. */
  const bar = (p) => {
    const s = D(p.start) < D(span.from) ? span.from : p.start;
    const e = D(p.finish) > D(span.to) ? span.to : p.finish;
    const total = days(span.from, span.to) || 1;
    const left = Math.max(0, days(span.from, s) / total) * 100;
    const width = Math.max(1.5, days(s, e) / total * 100);
    const m = Engine.metrics(db, p.id);
    const gates = db.milestones.filter(x => x.project === p.id && x.gate && !x.done &&
      x.date >= span.from && x.date <= span.to);
    const cuts = db.milestones.filter(x => x.project === p.id && x.intrusive && !x.done &&
      x.date >= span.from && x.date <= span.to);
    return h("div", { class: "list-row linkish", style: "align-items:center;gap:10px",
      onClick: () => go("#/project/" + p.id) },
      h("div", { style: "width:190px;flex:none;min-width:0" },
        h("div", { class: "strong small truncate" }, p.name),
        h("div", { class: "xs muted truncate" },
          (Engine.site(db, p.site) || {}).city + " · " + p.phase)),
      h("div", { style: "flex:1;position:relative;height:26px" },
        h("div", { style: "position:absolute;inset:0;display:grid;grid-template-columns:repeat(" + QN + ",1fr)" },
          ...qs.map(() => h("div", { style: "border-left:1px solid var(--rule-1)" }))),
        h("div", { title: p.name + " · " + fmtDate(p.start) + " → " + fmtDate(p.finish),
          style: "position:absolute;top:7px;height:12px;border-radius:3px;left:" + left + "%;width:" + width +
            "%;background:" + (m?.health.rag === "R" ? "var(--sig-red)"
              : m?.health.rag === "A" ? "var(--sig-amber)" : "var(--sig-green)") }),
        ...gates.map(g => h("div", { title: "G" + g.gate + " · " + g.name + " · " + fmtDate(g.date),
          style: "position:absolute;top:4px;width:9px;height:18px;border-left:2px solid var(--color-text);left:" +
            (days(span.from, g.date) / total * 100) + "%" })),
        ...cuts.map(c => h("div", { title: t("Touches the plant") + " · " + c.name + " · " + fmtDate(c.date),
          style: "position:absolute;top:2px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--color-accent);left:" +
            (days(span.from, c.date) / total * 100) + "%" }))));
  };

  const header = h("div", { style: "display:flex;gap:10px;align-items:center;margin-bottom:6px" },
    h("div", { style: "width:190px;flex:none" }, h("div", { class: "kicker" }, t("Project"))),
    h("div", { style: "flex:1;display:grid;grid-template-columns:repeat(" + QN + ",1fr)" },
      ...qs.map(q => h("div", { class: "kicker", style: "border-left:1px solid var(--rule-1);padding-left:5px" }, q.label))));

  /* V-11 — the links, as a list of what waits on what. A diagram would
     look better and read worse at eleven projects across five sites. */
  const links = (db.crossDeps ?? []).map(d => ({
    d, from: Engine.project(db, d.from), to: Engine.project(db, d.to),
  })).filter(x => x.from && x.to);

  return h("div", null,
    kpiStrip([
      { label: t("In flight"), value: String(list.filter(p => !p.closed).length), note: t("across the horizon") },
      { label: t("Landing this quarter"), value: String(db.milestones.filter(m =>
          !m.done && m.date >= qs[0].from && m.date < qs[0].to && list.some(p => p.id === m.project)).length),
        note: qs[0].label },
      { label: t("Plant cutovers ahead"), value: String(db.milestones.filter(m =>
          m.intrusive && !m.done && m.date >= db.statusDate && list.some(p => p.id === m.project)).length),
        note: t("intrusive work on the horizon") },
      { label: t("Cross-project links"), value: String(links.length),
        note: t("dependencies between projects"), accent: links.length > 0 },
    ]),
    h("section", { class: "sec", style: "margin-top:16px" },
      sectionHead(t("Roadmap"), qs[0].label + " – " + qs[QN - 1].label),
      header,
      ...byProgramme.map(g => h("div", { style: "margin-bottom:14px" },
        h("div", { class: "kicker acc", style: "margin:10px 0 4px" }, g.pr.name),
        ...g.items.map(bar))),
      byProgramme.length ? null : h("div", { class: "small muted" }, t("Nothing in flight in your scope."))),

    h("section", { class: "sec", style: "margin-top:16px" },
      sectionHead(t("What waits on what"), links.length + t(" cross-project links")),
      links.length
        ? table({
            cols: [
              { key: "f", label: t("This project"), get: x => h("div", null,
                  h("span", { class: "strong small linkish", onClick: () => go("#/project/" + x.from.id) }, x.from.name),
                  h("div", { class: "xs muted" }, x.d.fromStage || "—")) },
              { key: "w", label: "", width: "40px", get: () => h("span", { class: "xs muted" }, "→") },
              { key: "t", label: t("waits for"), get: x => h("div", null,
                  h("span", { class: "strong small linkish", onClick: () => go("#/project/" + x.to.id) }, x.to.name),
                  h("div", { class: "xs muted" }, x.d.toStage || "—")) },
              { key: "l", label: t("Because"), get: x => h("span", { class: "small muted" }, x.d.label || "—") },
              { key: "r", label: t("Risk"), align: "r", get: x => {
                  const a = Engine.metrics(db, x.to.id);
                  return a && a.slipDays > 7
                    ? h("span", { class: "tag tag-accent" }, a.slipDays + t("d late upstream"))
                    : h("span", { class: "xs muted" }, "—");
                } },
            ], rows: links,
          })
        : h("div", { class: "small muted", style: "max-width:62ch" },
            t("No project in your scope waits on another. Links are made on a project's schedule."))));
};

/* ── Pipeline: what was asked for, and what we will do (V-13 / V-04) ── */

Views.pipeline = (db) => {
  const demand = liveFetch("demand", () => api.get("/demand"), (r) => r.demand);
  const list = App.scopedProjects().filter(p => !p.closed);
  const pri = Engine.prioritise(db, list, db.settings.capexEnvelope);
  const open = demand.filter(d => ["New", "Triaged"].includes(d.status));

  /* A-06 — le nombre qui trace la ligne de flottaison budgétaire dit d'où
     il vient. Un arbitrage qu'on ne sait pas expliquer dans la salle n'est
     pas un arbitrage, c'est un verdict : la décomposition est donc lisible
     sur CHAQUE ligne portant un score, sans quitter l'écran. */
  const scoreCell = (x) => {
    const s = Engine.priority(x);
    if (s == null) {
      return h("span", { class: "xs muted",
        title: t("Four notes are needed — fit, value, risk and effort. An unscored project sorts last, not worst.") },
        t("unscored"));
    }
    const why = `${t("Fit")} ${x.fit} + ${t("Value")} ${x.value} + (6 − ${t("Risk")} ${x.risk})`
      + ` + (6 − ${t("Effort")} ${x.effort}) = ${s} · ${t("Risk and effort pull the score down")}`;
    return h("span", { class: "mono small strong", style: "cursor:help", title: why }, String(s));
  };

  return h("div", null,
    kpiStrip([
      { label: t("Awaiting a decision"), value: String(open.length),
        note: demand.failed ? t("could not be loaded") : t("raised and not yet decided"), accent: open.length > 0 },
      { label: t("Approved, not started"), value: String(demand.filter(d => d.status === "Approved").length),
        note: t("ready to become projects") },
      { label: t("Declined"), value: String(demand.filter(d => d.status === "Declined").length),
        note: t("with the reason on the record") },
      { label: t("Demanded"), value: money(pri.demanded),
        note: pri.envelope ? t("against an envelope of ") + money(pri.envelope) : t("no envelope agreed"),
        accent: pri.over > 0 },
      { label: t("Below the line"), value: String(pri.unfunded),
        note: pri.over ? money(pri.over) + t(" over the envelope") : t("everything fits"), accent: pri.unfunded > 0 },
    ]),

    h("section", { class: "sec", style: "margin-top:16px" },
      sectionHead(t("Requests"), open.length + t(" awaiting a decision"),
        App.can("demand.raise")
          ? h("button", { class: "btn btn-sm", onClick: () => raiseDemand(db) }, icon("plus", 12), t("Raise a request"))
          : null),
      demand.length
        ? table({
            cols: [
              { key: "t", label: t("Request"), get: d => h("div", null,
                  h("div", { class: "strong small" }, d.title),
                  h("div", { class: "xs muted" }, d.id + " · " + d.raisedBy + " · " + fmtDate(d.raisedOn) +
                    (d.sponsor ? " · " + t("sponsor ") + d.sponsor : ""))) },
              { key: "b", label: t("For"), get: d => h("span", { class: "small muted" }, d.benefitNote || "—") },
              { key: "c", label: t("Estimate"), align: "r", get: d => h("span", { class: "mono small" },
                  d.estCost == null ? "—" : money(d.estCost)) },
              { key: "s", label: t("Score"), align: "r", get: scoreCell },
              { key: "st", label: t("Status"), get: d => h("div", null,
                  statusTag(d.status === "Approved" ? "Cleared" : d.status === "Declined" ? "At risk"
                    : d.status === "Converted" ? "Cleared" : "Planned"),
                  d.decisionNote ? h("div", { class: "xs muted", style: "margin-top:3px;max-width:34ch" }, d.decisionNote) : null) },
              { key: "a", label: "", align: "r", get: d => App.can("demand.decide")
                  ? h("div", { class: "btn-row" },
                      h("button", { class: "btn btn-xs", onClick: () => decideDemand(db, d) }, t("Decide")),
                      d.status === "Approved" && !d.project
                        ? h("button", { class: "btn btn-xs btn-primary", onClick: () => convertDemand(db, d) }, t("Make it a project"))
                        : null)
                  : null },
            ], rows: demand.slice(0, 40),
            empty: t("Nothing has been asked for yet."),
          })
        : h("div", { class: "small muted", style: "max-width:64ch" },
            demand.failed
              ? t("The request list could not be loaded — refresh to try again.")
              : t("Nothing has been asked for yet. A request records what somebody wants and why, before anyone plans it — and a decline keeps its reason where the person who asked can read it."))),

    h("section", { class: "sec", style: "margin-top:16px" },
      sectionHead(t("The queue"),
        pri.envelope
          ? money(pri.demanded) + t(" demanded against ") + money(pri.envelope)
          : t("no capital envelope agreed"),
        App.can("priority.write")
          ? h("button", { class: "btn btn-sm", onClick: () => setEnvelope(db) }, t("Set the envelope"))
          : null),
      pri.unscored
        ? h("div", { class: "drop-hint", style: "margin-bottom:10px;max-width:64ch" },
            pri.unscored + t(" project(s) carry no score, so the queue cannot rank them. They sort last rather than worst."))
        : null,
      table({
        cols: [
          { key: "n", label: "#", align: "r", width: "40px", get: (r, i) => h("span", { class: "mono small muted" }, String(i + 1)) },
          { key: "p", label: t("Project"), get: r => h("div", null,
              h("span", { class: "strong small linkish", onClick: () => go("#/project/" + r.project.id) }, r.project.name),
              h("div", { class: "xs muted" }, (Engine.programme(db, r.project.programme) || {}).name)) },
          { key: "s", label: t("Score"), align: "r", get: r => scoreCell(r.project) },
          { key: "c", label: t("Cost"), align: "r", get: r => h("span", { class: "mono small" }, money(r.cost)) },
          { key: "cum", label: t("Running total"), align: "r", get: r => h("span", {
              class: "mono small" + (r.funded ? "" : " bad") }, money(r.cumulative)) },
          { key: "f", label: t("Line"), get: r => r.funded
              ? h("span", { class: "tag tag-out" }, t("above"))
              : h("span", { class: "tag tag-accent" }, t("below")) },
          { key: "e", label: "", align: "r", get: r => App.can("priority.write")
              ? h("button", { class: "btn btn-xs", onClick: () => scoreProject(db, r.project) }, t("Score"))
              : null },
        ],
        rows: pri.rows,
        rowClass: r => r.funded ? "" : "muted-row",
        empty: t("Nothing in flight to rank."),
      })));
};

function demandFields(db, d, deciding) {
  const base = [
    { key: "title", label: t("What is being asked for"), required: true, span: 2, value: d?.title ?? "" },
    { key: "sponsor", label: t("Sponsor"), value: d?.sponsor ?? "",
      hint: t("The business person who wants this, not the person building it") },
    { key: "estCost", label: t("Rough cost (M)"), type: "number", step: "any", value: d?.estCost ?? "" },
    { key: "programme", label: t("Programme"), type: "select", value: d?.programme ?? "",
      options: [{ value: "", label: "—" }, ...db.programmes.map(x => ({ value: x.id, label: x.name }))] },
    { key: "site", label: t("Site"), type: "select", value: d?.site ?? "",
      options: [{ value: "", label: "—" }, ...db.sites.map(x => ({ value: x.id, label: x.city }))] },
    { key: "benefitNote", label: t("What the business gets"), type: "textarea", rows: 2, span: 2,
      value: d?.benefitNote ?? "", hint: t("In production, availability, cost or compliance terms") },
    { key: "detail", label: t("Detail"), type: "textarea", rows: 3, span: 2, value: d?.detail ?? "" },
  ];
  if (!deciding) return base;
  const s = (k, label) => ({ key: k, label, type: "select", value: String(d?.[k] ?? ""),
    options: [{ value: "", label: "—" }, "1", "2", "3", "4", "5"] });
  return [
    { key: "status", label: t("Decision"), type: "select", required: true, value: d?.status ?? "New",
      options: ["New", "Triaged", "Approved", "Declined"] },
    { key: "decisionNote", label: t("Reason"), type: "textarea", rows: 2, span: 2, value: d?.decisionNote ?? "",
      hint: t("Required to decline — the person who asked will read this") },
    s("fit", t("Strategic fit 1–5")), s("value", t("Value 1–5")),
    s("risk", t("Risk 1–5 (5 = worst)")), s("effort", t("Effort 1–5 (5 = hardest)")),
  ];
}

function raiseDemand(db) {
  formDialog({
    title: t("Raise a request"), kicker: t("Pipeline"), wide: true,
    fields: demandFields(db, null, false), saveLabel: "Raise request",
    onSave: async (v) => {
      const ok = await App.write(t("Request raised"), (a) => a.post("/demand", {
        title: v.title, sponsor: v.sponsor, estCost: v.estCost, programme: v.programme,
        site: v.site, benefitNote: v.benefitNote, detail: v.detail,
      }), { detail: v.title, refresh: false });
      if (ok !== false) { delete live.data.demand; App.emit(); }
      return ok;
    },
  });
}

function decideDemand(db, d) {
  formDialog({
    title: t("Decide: ") + d.title, kicker: d.id, wide: true,
    fields: demandFields(db, d, true), saveLabel: "Record the decision",
    onSave: async (v) => {
      const ok = await App.write(t("Decision recorded"), (a) => a.patch("/demand/" + d.id, {
        status: v.status, decisionNote: v.decisionNote,
        fit: v.fit, value: v.value, risk: v.risk, effort: v.effort, version: d.version,
      }), { detail: v.status, refresh: false });
      if (ok !== false) { delete live.data.demand; App.emit(); }
      return ok;
    },
  });
}

function convertDemand(db, d) {
  formDialog({
    title: t("Make it a project"), kicker: d.id, wide: true,
    fields: [
      { key: "name", label: t("Project name"), required: true, span: 2, value: d.title },
      { key: "programme", label: t("Programme"), type: "select", required: true, value: d.programme ?? "",
        options: db.programmes.map(x => ({ value: x.id, label: x.name })) },
      { key: "site", label: t("Site"), type: "select", required: true, value: d.site ?? "",
        options: db.sites.map(x => ({ value: x.id, label: x.city })) },
      { key: "governanceLevel", label: t("Governed at"), type: "select", value: "site",
        options: [{ value: "site", label: t("Site") }, { value: "group", label: t("Group") }] },
      { key: "pm", label: t("Project manager"), type: "select", value: "",
        options: [{ value: "", label: "—" }, ...db.people.map(x => ({ value: x.id, label: x.name }))] },
      { key: "start", label: t("Start"), type: "date", required: true, value: db.statusDate },
      { key: "finish", label: t("Finish"), type: "date", required: true, value: iso(addMonths(db.statusDate, 9)),
        validate: (v, st) => D(v) <= D(st.start) ? t("A project cannot finish before it starts") : "" },
    ],
    saveLabel: "Create the project",
    onSave: async (v) => {
      const ok = await App.write(t("Project created from the request"), (a) => a.post("/demand/" + d.id + "/convert", {
        name: v.name, programme: v.programme, site: v.site, governanceLevel: v.governanceLevel,
        pm: v.pm, start: v.start, finish: v.finish,
      }), { detail: v.name });
      if (ok !== false) { delete live.data.demand; App.emit(); }
      return ok;
    },
  });
}

function scoreProject(db, p) {
  const s = (k, label) => ({ key: k, label, type: "select", value: String(p[k] ?? ""),
    options: [{ value: "", label: "—" }, "1", "2", "3", "4", "5"] });
  formDialog({
    title: t("Score ") + p.name, kicker: p.id, wide: true,
    fields: [
      s("fit", t("Strategic fit 1–5")), s("value", t("Value 1–5")),
      s("risk", t("Risk 1–5 (5 = worst)")), s("effort", t("Effort 1–5 (5 = hardest)")),
      { key: "rank", label: t("Hand-placed rank"), type: "number", min: 1, value: p.rank ?? "",
        hint: t("Leave blank to let the score decide. A rank overrules it — for when the room does.") },
    ],
    saveLabel: "Set priority",
    onSave: (v) => App.write(t("Priority set"), (a) => a.patch("/projects/" + p.id + "/priority", {
      fit: v.fit, value: v.value, risk: v.risk, effort: v.effort, rank: v.rank, version: p.version,
    }), { detail: p.name }),
  });
}

function setEnvelope(db) {
  formDialog({
    title: t("The capital envelope"), kicker: t("Prioritisation"),
    fields: [
      { key: "capexEnvelope", label: t("Envelope (M)"), type: "number", step: "any",
        value: db.settings.capexEnvelope ?? 0,
        hint: t("What the group has to spend. Zero means none agreed, and nothing falls below the line.") },
    ],
    saveLabel: "Set envelope",
    onSave: (v) => App.write(t("Envelope set"), (a) => a.patch("/admin/settings", {
      capexEnvelope: Number(v.capexEnvelope) || 0,
    }), { detail: money(Number(v.capexEnvelope) || 0) }),
  });
}

/* ── the plant, and where this lands (V-03 / V-06) ────────────────────
   What the project reaches into, whether management of change has
   released it, and the sites it goes live at one at a time. */

const WAVE_STATES = ["Planned", "In progress", "Live", "Held", "Cancelled"];
const PLANT_IMPACTS = ["none", "plant", "safety"];
const IMPACT_LABEL = { none: "Business systems only", plant: "Touches plant systems", safety: "Safety-related" };

function plantBlock(db, p) {
  const waves = (db.waves ?? []).filter(w => w.project === p.id)
    .sort((a, b) => a.seq - b.seq || String(a.site).localeCompare(String(b.site)));
  const impact = p.plantImpact ?? "none";
  const mayWriteP = App.can("project.write", { project: asRow(p) });
  const live = waves.filter(w => w.status === "Live").length;

  /* The freezes ahead at the sites this project touches — the dates a
     cutover cannot be planned into without a release. */
  const touched = new Set([p.site, ...waves.map(w => w.site)]);
  const freezes = (db.windows ?? [])
    .filter(w => w.kind === "freeze" && touched.has(w.site) && w.to >= db.statusDate)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)))
    .slice(0, 4);

  return h("div", null,
    sectionHead(t("Plant & rollout"),
      impact === "none" ? t("business systems only") : t(IMPACT_LABEL[impact]),
      mayWriteP && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => classifyPlant(db, p) }, t("Classify"))
        : null),

    h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px" },
      h("span", { class: "tag " + (impact === "safety" ? "tag-accent" : impact === "plant" ? "tag-ink" : "tag-out") },
        t(IMPACT_LABEL[impact])),
      impact !== "none"
        ? (p.mocApprovedOn
            ? h("span", { class: "xs muted" },
                t("Management of change ") + p.mocRef + t(" released ") + fmtDate(p.mocApprovedOn) +
                (p.mocApprovedBy ? t(" by ") + p.mocApprovedBy : ""))
            : h("span", { class: "xs bad strong" }, t("No management-of-change release — intrusive work inside a site freeze will be refused")))
        : null,
      impact !== "none" && App.can("moc.approve", { project: asRow(p), pm_id: p.pm })
        ? h("button", { class: "btn btn-xs", onClick: () => releaseMoc(db, p) },
            p.mocApprovedOn ? t("Revise release") : t("Release"))
        : null),

    freezes.length
      ? h("div", { class: "drop-hint", style: "margin-bottom:14px;max-width:64ch" },
          h("span", { class: "strong" }, t("Freezes ahead: ")),
          freezes.map(w => (Engine.site(db, w.site) || {}).city + " " +
            fmtDate(w.from) + "–" + fmtDate(w.to)).join(" · "))
      : null,

    sectionHead(t("Sites in this rollout"),
      waves.length ? live + t(" live of ") + waves.length : t("not a multi-site rollout"),
      App.can("wave.write", { project: asRow(p) }) && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => addWave(db, p) }, icon("plus", 12), t("Site"))
        : null),
    waves.length
      ? h("div", null, ...waves.map(w => {
          const site = Engine.site(db, w.site) || {};
          return h("div", { class: "list-row", style: "align-items:center" },
            h("span", { class: "step-i " + (w.status === "Live" ? "ok" : w.status === "Held" ? "no" : "wait"),
              style: "flex:none" }, String(w.seq)),
            h("div", { style: "flex:1;min-width:0;margin-left:8px" },
              h("div", { class: "strong small" }, site.city ?? w.site),
              h("div", { class: "xs muted" },
                [w.plannedOn ? t("planned ") + fmtDate(w.plannedOn) : "",
                 w.actualOn ? t("live ") + fmtDate(w.actualOn) : "",
                 site.readiness && site.readiness !== "Unknown" ? t("site ") + t(site.readiness).toLowerCase() : "",
                 w.note].filter(Boolean).join(" · "))),
            statusTag(w.status === "Live" ? "Cleared" : w.status === "Held" ? "At risk" : "Planned"),
            App.can("wave.write", { project: asRow(p) })
              ? h("div", { class: "btn-row", style: "margin-left:8px" },
                  h("button", { class: "btn btn-xs btn-ghost", title: t("Edit wave"),
                    onClick: () => editWave(db, w) }, icon("pencil", 11)),
                  h("button", { class: "btn btn-xs btn-ghost", title: t("Remove wave"),
                    onClick: () => App.write(t("Wave removed"), (a) => a.del("/waves/" + w.id),
                      { detail: site.city ?? w.site }) }, icon("trash", 11)))
              : null);
        }))
      : h("div", { class: "small muted" },
          t("This project lands at one site. Add a site to track it as a wave-by-wave rollout.")));
}

/* The plant's calendar, on the locations board (V-03). Shutdowns are when
   intrusive work is welcome; freezes are when it is refused. */
function windowsBlock(db) {
  const wins = (db.windows ?? [])
    .filter(w => w.to >= db.statusDate)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const mySites = db.sites.filter(s => App.can("window.write", { site_id: s.id }));

  return h("div", null,
    sectionHead(t("Shutdowns & change freezes"),
      wins.length ? wins.length + t(" ahead") : t("none declared"),
      mySites.length
        ? h("button", { class: "btn btn-sm", onClick: () => addWindow(db, mySites) },
            icon("plus", 12), t("Declare"))
        : null),
    wins.length
      ? h("div", null, ...wins.slice(0, 10).map(w => {
          const site = Engine.site(db, w.site) || {};
          const open = w.kind === "shutdown";
          return h("div", { class: "list-row", style: "align-items:center" },
            h("span", { class: "mark" + (open ? "" : " mark-acc") }),
            h("div", { style: "flex:1;min-width:0" },
              h("div", { class: "strong small" }, (site.city ?? w.site) + " · " + w.label),
              h("div", { class: "xs muted" },
                fmtDate(w.from) + " → " + fmtDate(w.to) + " · " +
                (open ? t("intrusive work welcome") : t("intrusive work refused")) +
                (w.detail ? " · " + w.detail : ""))),
            App.can("window.write", { site_id: w.site })
              ? h("button", { class: "btn btn-xs btn-ghost", title: t("Withdraw"),
                  onClick: () => App.write(t("Window withdrawn"), (a) => a.del("/windows/" + w.id),
                    { detail: w.label }) }, icon("trash", 11))
              : null);
        }))
      : h("div", { class: "small muted", style: "max-width:62ch" },
          t("No shutdown or freeze is on the calendar. Until one is, nothing stops a cutover being planned into production hours.")));
}

function addWindow(db, mySites) {
  formDialog({
    title: t("Declare a window"), kicker: t("Site calendar"), wide: true,
    fields: [
      { key: "site", label: t("Site"), type: "select", required: true, value: mySites[0]?.id ?? "",
        options: mySites.map(s => ({ value: s.id, label: s.city })) },
      { key: "kind", label: t("Kind"), type: "select", value: "freeze",
        options: [{ value: "freeze", label: t("Change freeze — intrusive work refused") },
          { value: "shutdown", label: t("Shutdown — intrusive work welcome") }] },
      { key: "label", label: t("What the site calls it"), required: true, span: 2 },
      { key: "from", label: t("From"), type: "date", required: true, value: db.statusDate },
      { key: "to", label: t("To"), type: "date", required: true, value: db.statusDate,
        validate: (v, st) => D(v) < D(st.from) ? t("A window cannot end before it starts") : "" },
      { key: "detail", label: t("Detail"), type: "textarea", rows: 2, span: 2 },
    ],
    saveLabel: "Declare",
    onSave: (v) => App.write(t("Window declared"), (a) => a.post("/windows", {
      site: v.site, kind: v.kind, label: v.label, from: v.from, to: v.to, detail: v.detail,
    }), { detail: v.label }),
  });
}

/* R-03 — one number a week, and no more than that. */
function effortDialog(db) {
  formDialog({
    title: t("Record effort"), kicker: t("Actual, not planned"),
    fields: [
      { key: "person", label: t("Person"), type: "select", required: true, value: db.people[0]?.id ?? "",
        options: db.people.map(p => ({ value: p.id, label: p.name })) },
      { key: "project", label: t("Project"), type: "select", required: true, value: db.projects[0]?.id ?? "",
        options: db.projects.filter(p => !p.closed).map(p => ({ value: p.id, label: p.name })) },
      { key: "week", label: t("Any day of that week"), type: "date", required: true, value: db.statusDate,
        hint: t("Stored against the Monday of the week you pick") },
      { key: "days", label: t("Days spent"), type: "number", min: 0, max: 7, step: 0.5, required: true, value: "" },
    ],
    saveLabel: "Record effort",
    onSave: (v) => App.write(t("Effort recorded"), (a) => a.post("/timesheets", {
      person: v.person, project: v.project, week: v.week, days: +v.days,
    }), { detail: v.days + " j", touch: ["timesheets"] }),
  });
}

/* R-02 — declare an absence with its deputy. */
function declareAbsence(db, sid) {
  const people = db.people.filter(p => p.site === sid);
  formDialog({
    title: t("Declare an absence"), kicker: t("Rotation & cover"), wide: true,
    fields: [
      { key: "person", label: t("Who is away"), type: "select", required: true, value: people[0]?.id ?? "",
        options: people.map(p => ({ value: p.id, label: p.name })) },
      { key: "reason", label: t("Reason"), type: "select", value: "rotation",
        options: [{ value: "rotation", label: t("rotation") }, { value: "leave", label: t("leave") },
          { value: "training", label: t("training") }, { value: "unavailable", label: t("unavailable") }] },
      { key: "from", label: t("From"), type: "date", required: true, value: db.statusDate },
      { key: "to", label: t("To"), type: "date", required: true, value: db.statusDate,
        validate: (v, st) => D(v) < D(st.from) ? t("An absence cannot end before it starts") : "" },
      { key: "deputy", label: t("Who covers"), type: "select", value: "",
        options: [{ value: "", label: t("Nobody — decisions wait") },
          ...db.people.map(p => ({ value: p.id, label: p.name }))],
        hint: t("The deputy acts with the absent person's authority — never more — and the record names both.") },
      { key: "note", label: t("Note"), span: 2, value: "" },
    ],
    saveLabel: "Declare absence",
    onSave: (v) => App.write(t("Absence declared"), (a) => a.post("/absences", {
      person: v.person, from: v.from, to: v.to, reason: v.reason,
      deputy: v.deputy || null, note: v.note,
    }), { detail: Engine.personName(db, v.person) }),
  });
}

function classifyPlant(db, p) {
  formDialog({
    title: t("What does this reach into?"), kicker: p.id,
    fields: [
      { key: "impact", label: t("Plant impact"), type: "select", value: p.plantImpact ?? "none",
        options: PLANT_IMPACTS.map(v => ({ value: v, label: t(IMPACT_LABEL[v]) })), span: 2,
        hint: t("Anything above 'business systems only' brings the site's change freezes into force") },
    ],
    saveLabel: "Classify",
    onSave: (v) => App.write(t("Plant impact classified"), (a) =>
      a.patch("/projects/" + p.id + "/plant", { impact: v.impact, version: p.version }),
      { detail: t(IMPACT_LABEL[v.impact]) }),
  });
}

function releaseMoc(db, p) {
  formDialog({
    title: t("Release intrusive work"), kicker: p.id, wide: true,
    fields: [
      { key: "ref", label: t("Management-of-change reference"), required: true, span: 2,
        value: p.mocRef ?? "", hint: t("The MOC this was raised under in the site's own process") },
    ],
    saveLabel: "Release",
    extra: h("div", { class: "small muted", style: "max-width:60ch" },
      t("This records that management of change has released the project's intrusive work. Cutovers may then be dated inside a site freeze, and the release is on the record with your name against it.")),
    onSave: (v) => App.write(t("Management of change released"), (a) =>
      a.patch("/projects/" + p.id + "/moc", { ref: v.ref, release: true, version: p.version }),
      { detail: v.ref }),
  });
}

function waveFields(db, p, w) {
  return [
    { key: "site", label: t("Site"), type: "select", required: true, value: w?.site ?? "",
      options: [{ value: "", label: "—" }, ...db.sites.map(s => ({ value: s.id, label: s.city }))] },
    { key: "seq", label: t("Wave"), type: "number", min: 1, value: w?.seq ?? 1 },
    { key: "plannedOn", label: t("Planned"), type: "date", value: w?.plannedOn ?? "" },
    { key: "actualOn", label: t("Went live"), type: "date", value: w?.actualOn ?? "" },
    { key: "status", label: t("Status"), type: "select", value: w?.status ?? "Planned", options: WAVE_STATES },
    { key: "note", label: t("Note"), span: 2, value: w?.note ?? "" },
  ];
}

function addWave(db, p) {
  formDialog({
    title: t("Add a site to this rollout"), kicker: p.id, wide: true,
    fields: waveFields(db, p, null).filter(f => f.key !== "actualOn" && f.key !== "status"),
    saveLabel: "Add site",
    onSave: (v) => App.write(t("Site added to the rollout"), (a) => a.post("/waves", {
      project: p.id, site: v.site, seq: +v.seq, plannedOn: v.plannedOn, note: v.note,
    }), { detail: v.site }),
  });
}

function editWave(db, w) {
  formDialog({
    title: t("Edit rollout wave"), kicker: w.project + " · " + w.site, wide: true,
    fields: waveFields(db, null, w).filter(f => f.key !== "site"),
    saveLabel: "Save wave",
    onSave: (v) => App.write(t("Rollout wave updated"), (a) => a.patch("/waves/" + w.id, {
      seq: +v.seq, plannedOn: v.plannedOn, actualOn: v.actualOn,
      status: v.status, note: v.note, version: w.version,
    }), { detail: w.site }),
  });
}

/* ── the reported record (V-02) ───────────────────────────────────────
   A closed period is what the board was told, frozen. It is fetched, not
   recomputed — the whole point is that it does not move when the book
   does. Selecting one switches the table below it from live figures to
   reported ones, and says so in as many words. */

function periodBlock(db) {
  const periods = liveFetch("periods", () => api.get("/periods"), (r) => r.periods);
  const chosen = App.ui.period;
  const snap = chosen
    ? liveFetch("snapshot:" + chosen, () => api.get("/periods/" + chosen), (r) => r.snapshot)
    : null;
  const meta = periods.find((p) => p.id === chosen);

  if (!periods.length) {
    return h("div", { class: "small muted no-print", style: "margin-top:14px;max-width:64ch" },
      periods.failed
        ? t("The reporting periods could not be loaded — refresh to try again.")
        : t("No period has been closed yet. Everything on this page is computed from the book as it stands right now, which means it will read differently tomorrow. Closing a period writes down what was reported, so it can be produced again."));
  }

  const options = [{ value: "", label: t("Live — as the book stands now") },
    ...periods.map((p) => ({ value: p.id, label: p.label + (p.restates ? t(" · restatement") : "") }))];

  return h("div", { style: "margin-top:16px" },
    h("div", { class: "no-print", style: "display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap" },
      selectField(t("Reported period"), chosen ?? "", options,
        (v) => { App.set({ period: v || null }); }),
      meta
        ? h("div", { class: "xs muted", style: "padding-bottom:7px;max-width:52ch" },
            t("Closed ") + fmtDate(String(meta.closedAt).slice(0, 10)) + t(" by ") + meta.closedBy +
            t(" · as at ") + fmtDate(meta.statusDate) + " · " + meta.projects + t(" project(s)") +
            (meta.restates ? t(" · restates ") + meta.restates : ""))
        : null),
    meta && meta.note
      ? h("div", { class: "small muted", style: "margin-top:8px;max-width:64ch" }, meta.note)
      : null,
    chosen && snap
      ? h("div", { style: "margin-top:14px" },
          h("div", { class: "kicker acc" },
            t("Reported figures — frozen at close, not recalculated")),
          snap.failed
            ? h("div", { class: "small muted" }, t("That period could not be loaded — refresh to try again."))
            : table({
                cols: [
                  { key: "n", label: t("Project"), get: s => h("div", null,
                      h("span", { class: "strong small" }, s.name),
                      h("div", { class: "xs muted" }, s.project + " · " + (s.phase ?? "—"))) },
                  { key: "h", label: t("Health"), get: s => h("span", { title: s.ragWhy }, ragDot(s.rag)) },
                  { key: "g", label: t("Gate"), get: s => h("span", { class: "xs muted" },
                      (s.gate ? "G" + s.gate : "—") + (s.gateState ? " · " + s.gateState : "")) },
                  { key: "b", label: t("Budget"), align: "r", get: s => h("span", { class: "mono small" }, s.bac ? money(s.bac) : "—") },
                  { key: "s", label: "SPI", align: "r", get: s => h("span", { class: "mono small" }, s.measurable && s.spi != null ? idx(s.spi) : "—") },
                  { key: "c", label: "CPI", align: "r", get: s => h("span", { class: "mono small" }, s.measurable && s.cpi != null ? idx(s.cpi) : "—") },
                  { key: "e", label: t("Forecast"), align: "r", get: s => h("span", { class: "mono small" }, s.bac ? money(s.eac) : "—") },
                  { key: "f", label: t("Finish"), get: s => h("span", { class: "mono small" },
                      fmtDate(s.forecastFinish ?? s.finish)) },
                  { key: "r", label: t("Risks"), align: "r", get: s => h("span", { class: "mono small" },
                      String(s.openRisks) + (s.steeringRisks ? " · " + s.steeringRisks + "↑" : "")) },
                  { key: "v", label: t("Benefits"), align: "r", get: s => h("span", { class: "mono small" },
                      s.benefitsPromised
                        ? s.benefitsMet + "/" + s.benefitsPromised
                        : "—") },
                ],
                rows: snap,
                empty: t("Nothing was in scope for you in that period."),
              }))
      : null);
}

function closePeriod(db) {
  const periods = liveFetch("periods", () => api.get("/periods"), (r) => r.periods);
  formDialog({
    title: t("Close the reporting period"), kicker: t("Record of record"), wide: true,
    fields: [
      { key: "label", label: t("What the board will call this period"), required: true, span: 2,
        value: fmtMon(db.statusDate), hint: t("August 2026, Q3 FY26, Week 35 — whatever the pack is titled") },
      { key: "restates", label: t("Restates"), type: "select", value: "",
        options: [{ value: "", label: t("Nothing — an ordinary close") },
          ...periods.map((p) => ({ value: p.id, label: p.label }))],
        hint: t("Correcting a period already closed? Name it. The original stays on the record.") },
      { key: "note", label: t("Note for the record"), type: "textarea", rows: 2, span: 2, value: "",
        hint: t("Why this close reads as it does — read back months later by people who were not there") },
    ],
    saveLabel: "Close the period",
    extra: h("div", { class: "small muted", style: "max-width:60ch" },
      t("Every project you can see is written down as it stands today, at the portfolio's status date. Closed periods cannot be edited or deleted — a correction is a new period that names this one.")),
    onSave: async (v) => {
      const ok = await App.write(t("Period closed"), (a) => a.post("/periods", {
        label: v.label, note: v.note, restates: v.restates || null,
      }), { detail: v.label });
      /* The list is cached per book; a new period has to invalidate it or
         the selector will not show what was just closed. */
      if (ok !== false) { delete live.data.periods; App.set({ period: null }); }
      return ok;
    },
  });
}

/* ── value: what was promised, what was measured (V-01) ───────────────
   The section that turns a cost report into a value report. A benefit
   carries its own unit, so nothing here is money-formatted; and an
   unmeasured benefit renders as "not yet measured", never as zero. */

const BENEFIT_KINDS = ["Production", "Availability", "Cost", "Risk", "Compliance"];
const VERDICTS = ["Met", "Partly met", "Missed"];

/** "82 → 95 %" — the numbers a sponsor reads, in the benefit's own unit.
    Empty when nothing has been promised numerically yet: "— → —" looks
    like a measurement that failed rather than one nobody has made. */
function benefitFigure(b) {
  if (b.baseline == null && b.target == null) return "";
  const u = b.unit ? " " + b.unit : "";
  const n = (v) => (v == null ? "—" : String(v));
  return n(b.baseline) + " → " + n(b.target) + u;
}

function valueBlock(db, p) {
  const list = (db.benefits ?? []).filter(b => b.project === p.id);
  const may = (action) => App.can(action, { project: asRow(p) });
  const vp = Engine.valueProfile(db, [p]);

  const rows = list.map(b => {
    const att = Engine.attainment(b);
    /* personName answers "—" for nobody, which would read here as an
       owner called "—" rather than as an unowned benefit. */
    const owner = b.owner ? Engine.personName(db, b.owner) : "";
    return h("div", { class: "list-row", style: "align-items:flex-start" },
      h("span", { class: "mark" + (b.status === "Missed" ? " mark-acc" : "") }),
      h("div", { style: "flex:1;min-width:0" },
        h("div", { class: "kicker" }, b.kind + " · " + b.id),
        h("div", { class: "strong small", style: "margin:2px 0 1px" }, b.title),
        h("div", { class: "xs muted" },
          [b.measure, benefitFigure(b),
           b.realiseOn ? t("due ") + fmtDate(b.realiseOn) : "",
           owner].filter(Boolean).join(" · ")),
        b.detail ? h("div", { class: "xs muted", style: "margin-top:3px;max-width:60ch" }, b.detail) : null),
      h("div", { style: "text-align:right;flex:none;min-width:132px" },
        statusTag(b.status),
        h("div", { class: "xs muted", style: "margin-top:4px" },
          b.actual == null
            ? t("not yet measured")
            : t("measured ") + b.actual + (b.unit ? " " + b.unit : "") +
              (att == null ? "" : " · " + pct(att) + t(" of target"))),
        may("benefit.write")
          ? h("div", { class: "btn-row", style: "margin-top:5px;justify-content:flex-end" },
              h("button", { class: "btn btn-xs btn-ghost", title: t("Edit benefit"),
                onClick: () => editBenefit(db, b) }, icon("pencil", 11)),
              h("button", { class: "btn btn-xs btn-ghost", title: t("Remove benefit"),
                onClick: () => removeBenefit(db, b) }, icon("trash", 11)))
          : null));
  });

  return h("div", null,
    sectionHead(t("Value"),
      list.length
        ? vp.measured + t(" of ") + vp.live + t(" measured")
        : t("nothing promised yet"),
      may("benefit.write") && !fromSdp(p)
        ? h("button", { class: "btn btn-sm", onClick: () => addBenefit(db, p) },
            icon("plus", 12), t("Benefit"))
        : null),
    list.length
      ? h("div", null, ...rows)
      : h("div", { class: "drop-hint", style: "margin-top:4px;max-width:64ch" },
          h("span", { class: "strong" }, t("This project has no stated benefit. ")),
          t("Until one is recorded with a baseline, a target and an owner, the portfolio can say this project was run well but not that it was worth doing.")),

    /* The verdict. Group-level by rule — the team that delivered measures
       the benefit; somebody else rules on it. */
    h("div", { style: "margin-top:16px" },
      p.pirVerdict
        ? h("div", { class: "card" },
            h("div", { class: "card-kicker" }, t("Post-implementation review")),
            h("div", { style: "display:flex;align-items:baseline;gap:9px;margin:5px 0 4px" },
              statusTag(p.pirVerdict === "Met" ? "Cleared" : p.pirVerdict === "Missed" ? "At risk" : "Ready"),
              h("span", { class: "strong small" }, t(p.pirVerdict)),
              h("span", { class: "xs muted" }, fmtDate(p.pirOn))),
            p.pirNote ? h("div", { class: "small muted", style: "max-width:62ch" }, p.pirNote) : null,
            may("benefit.review")
              ? h("div", { class: "btn-row", style: "margin-top:9px" },
                  h("button", { class: "btn btn-xs", onClick: () => recordReview(db, p) }, t("Revise verdict")))
              : null)
        : may("benefit.review")
        ? h("button", { class: "btn btn-sm", onClick: () => recordReview(db, p) },
            t("Record the post-implementation review"))
        : null));
}

function benefitFields(db, b) {
  return [
    { key: "kind", label: t("Type"), type: "select", options: BENEFIT_KINDS, value: b?.kind ?? "Cost", required: true },
    { key: "title", label: t("Benefit"), value: b?.title ?? "", required: true, span: 2,
      hint: t("What the business gets — in its words, not the project's") },
    { key: "measure", label: t("Measure"), value: b?.measure ?? "",
      hint: t("Plant availability, cost per ounce, hours lost…") },
    { key: "unit", label: t("Unit"), value: b?.unit ?? "", hint: "%, US$/oz, h" },
    /* R-07 — state the benefit in two moves: name it now, number it when
       the numbers are known. The chiffrage folds behind "More detail". */
    { key: "owner", label: t("Benefit owner"), type: "select", value: b?.owner ?? "",
      options: [{ value: "", label: "—" }, ...db.people.map(x => ({ value: x.id, label: x.name }))],
      hint: t("The person accountable for the number, not for the project") },
    { key: "baseline", label: t("Baseline"), type: "number", step: "any", value: b?.baseline ?? "",
      hint: t("Where it stands today"), advanced: true },
    { key: "target", label: t("Target"), type: "number", step: "any", value: b?.target ?? "", advanced: true },
    { key: "actual", label: t("Measured actual"), type: "number", step: "any", value: b?.actual ?? "",
      hint: t("Leave blank until it has been measured"), advanced: true },
    { key: "realiseOn", label: t("Realised by"), type: "date", value: b?.realiseOn ?? "", advanced: true },
    { key: "measuredOn", label: t("Measured on"), type: "date", value: b?.measuredOn ?? "", advanced: true },
    { key: "detail", label: t("How it will be measured"), type: "textarea", rows: 2, span: 2,
      value: b?.detail ?? "", advanced: true },
  ];
}

function addBenefit(db, p) {
  formDialog({
    title: t("State a benefit"), kicker: p.id, wide: true,
    fields: benefitFields(db, null), saveLabel: "Add benefit",
    onSave: (v) => App.write(t("Benefit added"), (a) => a.post("/benefits", {
      project: p.id, kind: v.kind, title: v.title, detail: v.detail,
      measure: v.measure, unit: v.unit,
      baseline: v.baseline, target: v.target, actual: v.actual,
      owner: v.owner, realiseOn: v.realiseOn, measuredOn: v.measuredOn,
    }), { detail: v.title }),
  });
}

function editBenefit(db, b) {
  formDialog({
    title: t("Edit ") + b.id, kicker: b.kind, wide: true,
    fields: benefitFields(db, b), saveLabel: "Save benefit",
    onSave: (v) => App.write(t("Benefit updated"), (a) => a.patch("/benefits/" + b.id, {
      kind: v.kind, title: v.title, detail: v.detail, measure: v.measure, unit: v.unit,
      baseline: v.baseline, target: v.target, actual: v.actual,
      owner: v.owner, realiseOn: v.realiseOn, measuredOn: v.measuredOn,
      version: b.version,
    }), { detail: b.id }),
  });
}

async function removeBenefit(db, b) {
  const ok = await confirmDialog({
    title: t("Remove this benefit?"), message: b.title, danger: true,
    confirmLabel: t("Remove"),
    detail: t("A benefit that was promised and then withdrawn is usually better marked Withdrawn than deleted — the register keeps the promise visible."),
  });
  if (!ok) return;
  App.write(t("Benefit removed"), (a) => a.del("/benefits/" + b.id), { detail: b.id });
}

function recordReview(db, p) {
  formDialog({
    title: t("Post-implementation review"), kicker: p.id, wide: true,
    fields: [
      { key: "verdict", label: t("Verdict"), type: "select", required: true,
        value: p.pirVerdict ?? "Met", options: VERDICTS,
        hint: t("Measured against what the benefits promised") },
      { key: "note", label: t("Reason"), type: "textarea", rows: 3, span: 2, value: p.pirNote ?? "",
        hint: t("Required for anything short of Met — the committee has to be able to read it back") },
    ],
    saveLabel: "Record review",
    onSave: (v) => App.write(t("Review recorded"), (a) => a.patch("/projects/" + p.id + "/review", {
      verdict: v.verdict, note: v.note, version: p.version,
    }), { detail: v.verdict }),
  });
}

function newRaid(db, projectId) {
  formDialog({
    title: "Raise a RAID item", kicker: "Register", wide: true, fields: raidFields(db, null, projectId),
    saveLabel: "Raise item",
    onSave: async (v) => {
      const ok = await App.write("RAID item raised", (a) => a.post("/raid", {
        type: v.type, project: v.project || null, title: v.title, detail: v.detail,
        p: +v.p, i: +v.i, response: v.response, owner: v.owner, review: v.review,
      }), { detail: v.title });
      if (ok !== false) {
        const exposure = v.p * v.i;
        if (exposure >= db.settings.escalateExposure)
          toast("Escalated to the steering committee", "Exposure " + exposure + " is at or above the threshold of " + db.settings.escalateExposure, true);
      }
      return ok;
    },
  });
}

function editRaid(db, r) {
  formDialog({
    title: "Edit " + r.id, kicker: r.type, wide: true, fields: raidFields(db, r),
    saveLabel: "Save item",
    onSave: (v) => App.write("RAID item updated", (a) => a.patch("/raid/" + r.id, {
      title: v.title, detail: v.detail, p: +v.p, i: +v.i, response: v.response,
      owner: v.owner, review: v.review, status: v.status, version: r.version,
    }), { detail: r.id }),
  });
}

/* ── Budget & earned value ────────────────────────────────────────── */
Views.budget = (db) => {
  const list = App.scopedProjects();
  const roll = Engine.roll(db, list);
  const series = Engine.curve(db, list);

  /* V-05 — the four numbers finance asks for. Committed money is gone
     from the envelope long before it is a cost line, so "budget minus
     actuals" flatters every project that has raised a purchase order. */
  const mp = Engine.moneyPosition(db, list);
  const moneyStrip = kpiStrip([
    { label: t("Budget"), value: money(mp.budget), note: t("approved envelope") },
    { label: t("Spent"), value: money(mp.spent),
      note: t("capex ") + money(mp.capex.spent) + t(" · opex ") + money(mp.opex.spent) },
    { label: t("Committed"), value: money(mp.committed),
      note: mp.openCommitments + t(" open purchase order(s)"), accent: mp.overCommitted },
    { label: t("Free"), value: money(mp.free),
      note: mp.overCommitted ? t("spent and committed exceed the budget") : t("uncommitted and unspent"),
      accent: mp.free < 0 },
    { label: t("Currencies"), value: mp.currencies.length ? String(mp.currencies.length) : "—",
      note: mp.currencies.join(" · ") || t("nothing booked yet") },
  ]);

  const strip = kpiStrip([
    { label: "BAC", value: money(roll.bac), note: "budget at completion" },
    { label: "AC", value: money(roll.ac), note: "actual cost booked" },
    { label: "EV", value: money(roll.ev), note: "value earned" },
    { label: "CV", value: signedMoney(roll.cv), note: roll.cv < 0 ? "spent ahead of value" : "value ahead of spend", accent: roll.cv < 0 },
    { label: "EAC", value: money(roll.eac), note: "forecast at completion", accent: roll.eac > roll.bac },
    { label: "VAC", value: signedMoney(roll.vac), note: "variance at completion", accent: roll.vac < 0 },
  ]);

  /* ADR-10 — budget-less strategy mirrors carry no ledger and no EVM; a row
     of $0.00 in a money table reads as "funded and spent nothing", which is
     a lie. They are outside this view, and the exclusion is said out loud. */
  const unfundedRows = list.filter((p) => !(p.budget > 0));
  const rows = list.filter((p) => p.budget > 0).map(p => Engine.metrics(db, p.id));
  const cols = [
    { key: "name", label: "Project", sort: m => m.project.name, get: m => h("div", null,
        h("div", { class: "strong" }, m.project.name),
        h("div", { class: "xs muted" }, m.project.id + " · " + (Engine.site(db, m.project.site) || {}).city)) },
    { key: "bac", label: "Budget", align: "r", sort: m => m.bac, get: m => h("span", { class: "mono" }, money(m.bac)) },
    { key: "ac", label: "Actual", align: "r", sort: m => m.ac, get: m => h("span", { class: "mono" }, money(m.ac)) },
    { key: "ev", label: "Earned", align: "r", sort: m => m.ev, get: m => h("span", { class: "mono" }, money(m.ev)) },
    { key: "cv", label: "CV", align: "r", sort: m => m.cv, get: m => h("span", { class: "mono strong", style: m.cv < 0 ? "color:var(--sig-red)" : null }, signedMoney(m.cv)) },
    { key: "cpi", label: "CPI", align: "r", sort: m => m.cpi, get: m => indexCell(m, "cpi", db.settings.amberCpi) },
    { key: "eac", label: "EAC", align: "r", sort: m => m.eac, get: m => h("span", { class: "mono" }, money(m.eac)) },
    { key: "vac", label: "VAC", align: "r", sort: m => m.vac, get: m => h("span", { class: "mono strong", style: m.vac < 0 ? "color:var(--sig-red)" : null }, signedMoney(m.vac)) },
    { key: "cont", label: "Contingency", align: "r", sort: m => m.contingencyPct, width: "104px", get: m => h("div", null,
        h("div", { class: "bar-lbl mono" }, h("span", null, cash(m.contingencyLeft)), h("span", null, pct(m.contingencyPct))),
        meter(m.contingencyPct, m.contingencyPct > 0.6 ? "var(--color-accent)" : "var(--color-text)", "thin")) },
    /* R7.3 — cost.write is group-only (A5: the ledger reconciles to the
       group GL), so this row was offering every viewer and site lead a
       posting the server would refuse. */
    { key: "act", label: "", align: "r", get: m => !may("cost.write", Engine.project(db, m.project)) ? null
        : h("button", { class: "btn btn-xs", onClick: () => bookCost(db, m.project) }, "Book cost") },
  ];
  const footer = h("tr", null,
    h("td", null, "Portfolio total"),
    h("td", { class: "r mono" }, money(roll.bac)), h("td", { class: "r mono" }, money(roll.ac)),
    h("td", { class: "r mono" }, money(roll.ev)),
    h("td", { class: "r mono", style: roll.cv < 0 ? "color:var(--sig-red)" : null }, signedMoney(roll.cv)),
    h("td", { class: "r mono" }, idx(roll.cpi)), h("td", { class: "r mono" }, money(roll.eac)),
    h("td", { class: "r mono", style: roll.vac < 0 ? "color:var(--sig-red)" : null }, signedMoney(roll.vac)),
    h("td"), h("td"));

  /* Twelve projects all post in the same month, so a flat "last 12" only ever
     showed the current period. Walk back period by period instead, and say
     which periods are actually on screen. */
  const mine = db.ledger.filter(l => list.some(p => p.id === l.project));
  const periods = uniq(mine.map(l => l.period)).sort((a, b) => b.localeCompare(a));
  const ledger = [];
  const covered = [];
  for (const per of periods) {
    if (ledger.length >= 12) break;
    covered.push(per);
    ledger.push(...mine.filter(l => l.period === per).sort((a, b) => b.amount - a.amount));
  }
  const ledgerNote = covered.length === 1
    ? fmtMon(covered[0] + "-01")
    : fmtMon(covered[covered.length - 1] + "-01") + " – " + fmtMon(covered[0] + "-01");

  return h("div", null,
    moneyStrip,
    h("div", { style: "height:10px" }),
    strip,
    h("div", { class: "split" },
      h("section", { class: "l sec" },
        commitmentsBlock(db, list),
        h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Cost performance by project", App.scopeLabel(),
          h("button", { class: "btn btn-sm", onClick: () => exportEVM(rows) }, icon("download", 12), "CSV")),
        sortableTable({ cols, rows, footer, onRow: m => go("#/project/" + m.project.id),
          empty: { title: "No projects in scope", body: "Widen the filters to see cost performance." } }),
        unfundedRows.length
          ? h("div", { class: "xs muted", style: "margin-top:8px" },
              unfundedRows.length + " strategy project" + (unfundedRows.length === 1 ? "" : "s") +
              " without budget (" + unfundedRows.map((p) => p.id).join(", ") +
              ") — outside EVM and this table by rule, not by zero.")
          : null,
        h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Planned, earned and actual", "portfolio, by month"),
        curveChart(series),
        legend([
          { color: "var(--color-neutral-500)", label: "Planned value" },
          { color: "var(--color-text)", label: "Earned value" },
          { color: "var(--color-accent)", label: "Actual cost · today" },
        ])),
      h("aside", { class: "sec" },
        sectionHead("Where the overrun sits"),
        h("div", { style: "margin-bottom:20px" }, rows.filter(m => m.vac < -0.01).sort((a, b) => a.vac - b.vac).slice(0, 5).map(m =>
          h("div", { class: "list-row linkish", onClick: () => go("#/project/" + m.project.id) },
            h("span", { class: "mark mark-bad" }),
            h("div", { style: "flex:1;min-width:0" },
              h("div", { class: "strong small" }, m.project.name),
              h("div", { class: "xs muted" }, "CPI " + idx(m.cpi) + " · EAC " + money(m.eac))),
            h("span", { class: "mono strong small bad" }, signedMoney(m.vac)))).concat(
          rows.every(m => m.vac >= -0.01) ? [h("div", { class: "small muted" }, "Every project forecasts inside its envelope.")] : [])),
        h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Cost postings", ledgerNote),
        h("div", null, ledger.map(l => {
          const proj = Engine.project(db, l.project);
          return h("div", { class: "list-row", style: "align-items:center;gap:10px;padding:6px 0" },
            h("span", { class: "mono small muted", style: "width:62px;flex:none" }, l.period),
            h("div", { style: "flex:1;min-width:0" },
              h("div", { class: "small truncate" }, (proj || {}).name || l.project),
              l.note ? h("div", { class: "xs muted truncate" }, l.note) : null),
            l.fromContingency ? h("span", { class: "tag tag-out" }, "contingency") : null,
            h("span", { class: "mono small strong", style: l.amount < 0 ? "color:var(--sig-red)" : null },
              cash(l.amount)),
            /* Corrections are reversing entries, never edits — the ledger
               has to keep reconciling to actual cost (A5). */
            proj && !l.reversal && may("cost.write", proj)
              ? h("button", { class: "btn btn-xs btn-ghost", title: "Reverse this posting",
                  onClick: () => reverseCost(db, l) }, icon("x", 11))
              : null);
        })),
        h("div", { style: "height:18px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Contingency across the book"),
        h("div", { class: "card" },
          h("div", { class: "card-kicker" }, "Drawn"),
          h("div", { class: "num", style: "font-size:26px;margin:4px 0 6px" },
            cash(sum(list, p => p.contingencyUsed)) + " of " + cash(sum(list, p => p.contingency))),
          meter(sum(list, p => p.contingency) ? sum(list, p => p.contingencyUsed) / sum(list, p => p.contingency) : 0, "var(--color-accent)", "thin"),
          h("div", { class: "xs muted", style: "margin-top:7px" },
            "Portfolio is " + pct(roll.bac ? roll.ev / roll.bac : 0) + " complete by value")))));
};

function exportEVM(rows) {
  saveText("meridian-evm-" + App.db.statusDate + ".csv", toCSV(rows, [
    { label: "ID", get: m => m.project.id }, { label: "Project", get: m => m.project.name },
    { label: "BAC", get: m => m.bac.toFixed(3) }, { label: "PV", get: m => m.pv.toFixed(3) },
    { label: "EV", get: m => m.ev.toFixed(3) }, { label: "AC", get: m => m.ac.toFixed(3) },
    { label: "SPI", get: m => idx(m.spi) }, { label: "CPI", get: m => idx(m.cpi) },
    { label: "EAC", get: m => m.eac.toFixed(3) }, { label: "VAC", get: m => m.vac.toFixed(3) },
    { label: "TCPI", get: m => idx(m.tcpi) },
  ]), "text/csv");
  toast("Earned value exported", rows.length + " projects as CSV");
}

function bookCost(db, p) {
  formDialog({
    title: "Book cost to " + p.name, kicker: p.id,
    fields: [
      { key: "period", label: "Period", type: "month", value: monthKey(db.statusDate), required: true },
      { key: "amount", label: "Amount ($M)", type: "number", step: 0.01, required: true, value: 0.1 },
      { key: "contingency", label: "Draw from contingency", type: "checkbox", span: 2,
        hint: t("Contingency draws are reported separately from the approved envelope.") },
      { key: "note", label: "Note", span: 2, value: "" },
    ],
    saveLabel: "Book cost",
    onSave: (v) => App.write("Cost booked", (a) => a.post("/cost", {
      project: p.id, amount: +v.amount, period: v.period,
      note: v.note, fromContingency: !!v.contingency,
    }), { detail: cash(+v.amount) + (v.contingency ? " from contingency" : "") + " on " + p.id }),
  });
}

/* ── Change control ───────────────────────────────────────────────── */
Views.change = (db) => {
  const scoped = App.scopedProjects().map(p => p.id);
  const crs = db.crs.filter(c => scoped.includes(c.project));
  /* A link to a specific request is an explicit ask and beats the header
     filter: following one from an agenda or an email used to land on
     whatever happened to be first in the current scope, with the URL
     still naming the request the reader wanted. */
  const cur = crs.find(c => c.id === App.ui.cr)
    ?? db.crs.find(c => c.id === App.ui.cr)
    ?? crs[0];
  const pending = crs.filter(c => c.status === "Pending");

  const cols = [
    { key: "id", label: "Ref", sort: c => c.id, width: "70px", get: c => h("span", { class: "mono small strong" }, c.id) },
    { key: "title", label: "Change", sort: c => c.title, get: c => h("div", null,
        h("div", { class: "strong" }, c.title),
        h("div", { class: "xs muted" }, c.project + " · raised " + fmtDate(c.raised) + " by " + Engine.personName(db, c.raisedBy))) },
    { key: "cost", label: "Cost", align: "r", sort: c => c.cost, get: c => h("span", { class: "mono small strong", style: c.cost > 0 ? "color:var(--sig-red)" : null }, (c.cost > 0 ? "+" : "") + cash(c.cost)) },
    { key: "sched", label: "Schedule", align: "r", sort: c => c.weeks, get: c => h("span", { class: "mono small" }, c.weeks === 0 ? "—" : (c.weeks > 0 ? "+" : "") + c.weeks + " wk") },
    { key: "auth", label: "Authority", sort: c => Engine.route(db, c).authority, get: c => h("span", { class: "small", title: Engine.route(db, c).why }, Engine.route(db, c).authority) },
    { key: "status", label: "Status", align: "r", sort: c => c.status, get: c => statusTag(c.status) },
  ];

  const left = h("section", { class: "l sec" },
    sectionHead("Change requests", pending.length + " awaiting a decision",
      primaryAction("change", db)),
    sortableTable({ cols, rows: crs, selected: c => cur && c.id === cur.id,
      onRow: c => { App.set({ cr: c.id }); go("#/change/" + c.id); },
      empty: { title: "No changes in this scope", body: "Raise one when scope, cost or dates need to move." } }),
    h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
    sectionHead(t("Net effect of approved changes")),
    h("div", { style: "display:flex;gap:34px;flex-wrap:wrap" },
      h("div", null, h("div", { class: "kicker" }, t("Cost")),
        h("div", { class: "num", style: "font-size:22px" }, cash(sum(crs.filter(c => c.status === "Approved"), c => c.cost)))),
      h("div", null, h("div", { class: "kicker" }, t("Schedule")),
        h("div", { class: "num", style: "font-size:22px" }, sum(crs.filter(c => c.status === "Approved"), c => c.weeks) + " wk")),
      h("div", null, h("div", { class: "kicker" }, t("Approved")),
        h("div", { class: "num", style: "font-size:22px" }, crs.filter(c => c.status === "Approved").length + t(" of ") + crs.length)),
      h("div", null, h("div", { class: "kicker" }, t("Rejected")),
        h("div", { class: "num", style: "font-size:22px" }, String(crs.filter(c => c.status === "Rejected").length)))));

  const rail = cur ? crDetail(db, cur) : h("aside", { class: "sec" }, h("div", { class: "small muted" }, "Select a change request."));
  return h("div", { class: "split" }, left, rail);
};

function crDetail(db, c) {
  const route = Engine.route(db, c);
  const p = Engine.project(db, c.project);
  const m = p ? Engine.metrics(db, p.id) : null;
  const stage = Engine.crStage(c);

  const facts = [
    { k: "Cost impact", v: (c.cost > 0 ? "+" : "") + cash(c.cost) },
    { k: "Schedule", v: c.weeks === 0 ? "No change" : (c.weeks > 0 ? "+" : "") + c.weeks + " weeks" },
    { k: "Risk delta", v: c.riskDelta },
    { k: "Funding", v: c.funding },
  ];

  return h("aside", { class: "sec" },
    h("div", { class: "kicker" }, c.id + " · " + c.project),
    h("h4", { style: "margin:5px 0 8px" }, c.title),
    h("div", { style: "display:flex;gap:8px;align-items:center;margin-bottom:12px" },
      statusTag(c.status),
      h("span", { class: "xs muted" }, "raised " + fmtDate(c.raised) + " by " + Engine.personName(db, c.raisedBy))),
    h("p", { class: "small", style: "margin:0 0 14px;color:var(--muted)" }, c.desc),

    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule-1);margin-bottom:16px" },
      ...facts.map(f => h("div", { style: "background:var(--color-bg);padding:9px 10px 9px 0" },
        h("div", { class: "kicker" }, f.k),
        h("div", { class: "num", style: "font-size:16px;margin-top:3px" }, f.v)))),

    h("div", { class: "card", style: "margin-bottom:16px" },
      h("div", { class: "card-kicker" }, "Routing rule"),
      h("div", { class: "strong small", style: "margin:4px 0 2px" }, route.authority),
      h("div", { class: "xs muted" }, route.why)),

    sectionHead("Approval path"),
    h("div", { style: "margin-bottom:14px" }, c.steps.map((st, i) =>
      h("div", { class: "step" },
        h("span", { class: "step-i " + (st.state === "done" ? "ok" : st.state === "rejected" ? "no" : st.state === "current" ? "" : "wait") },
          st.state === "done" ? "✓" : st.state === "rejected" ? "✕" : String(i + 1)),
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "strong small" }, st.role),
          h("div", { class: "xs muted" }, st.note + (st.when ? " · " + fmtDate(st.when) : ""))),
        h("span", { class: "xs muted" }, st.state === "current" ? "with them now" : st.state)))),

    /* R7.3 — the decision controls were drawn for anyone who could see a
       pending request, including a viewer and a site lead looking at a
       group programme. The server refused them, so nothing leaked; but
       offering an action that will be refused is the thing both the
       design and the operational committee ruled out. Approving is also
       gated on magnitude, so it is asked separately from editing. */
    c.status === "Pending" ? h("div", { class: "btn-row" },
      p && App.can("change.approve", {
        project: asRow(p),
        cost_delta: c.cost, weeks_delta: c.weeks,
        threshold: { cost: db.settings.ccbThreshold, weeks: db.settings.ccbWeeks },
      })
        ? h("button", { class: "btn btn-sm btn-primary", onClick: () => approveStep(db, c) },
            icon("check", 12), stage === c.steps.length - 1 ? "Approve change" : "Approve step")
        : null,
      p && App.can("change.approve", {
        project: asRow(p),
        cost_delta: c.cost, weeks_delta: c.weeks,
        threshold: { cost: db.settings.ccbThreshold, weeks: db.settings.ccbWeeks },
      })
        ? h("button", { class: "btn btn-sm btn-danger", onClick: () => rejectCR(db, c) }, "Reject")
        : null,
      p && may("change.raise", p)
        ? h("button", { class: "btn btn-sm", onClick: () => editCR(db, c) }, "Edit")
        : null,
      p && may("change.raise", p)
        ? h("button", { class: "btn btn-sm btn-ghost", onClick: () => withdrawCR(db, c) }, "Withdraw")
        : null,
      p && !may("change.raise", p)
        ? h("div", { class: "xs muted", style: "max-width:56ch" },
            App.isViewer
              ? t("This account is read-only.")
              : "This request sits on a project outside your authority — " +
                Engine.route(db, c).authority.toLowerCase() + " decides it.")
        : null) :
      h("div", { class: "small muted" },
        c.status === "Approved"
          ? "Approved and applied. " + (p ? p.name + " now carries " + money(p.budget) + " and finishes " + fmtDate(p.finish) + "." : "")
          : "Rejected — no impact was applied."),

    m ? h("div", null, h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead(t("Effect on ") + p.id),
      h("div", { class: "small" },
        row(t("Budget now"), money(m.bac)),
        row(t("If approved"), money(m.bac + (c.status === "Pending" ? c.cost : 0))),
        row(t("Finish now"), fmtDate(p.finish)),
        row(t("If approved"), fmtDate(addDays(p.finish, c.status === "Pending" ? c.weeks * 7 : 0))),
        row(t("Contingency left"), cash(m.contingencyLeft)))) : null);

  function row(k, v) {
    return h("div", { style: "display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule-1)" },
      h("span", { class: "muted" }, k), h("span", { class: "mono strong" }, v));
  }
}

function approveStep(db, c) {
  const stage = Engine.crStage(c);
  const last = stage === c.steps.length - 1;
  const doIt = () => App.write(last ? "Change approved" : "Approval step cleared",
    (a) => a.post("/change/" + c.id + "/approve", {}), { detail: c.id });

  if (last) {
    confirmDialog({
      title: "Approve " + c.id + "?",
      message: c.title,
      detail: "Approving applies " + (c.cost > 0 ? "+" : "") + cash(c.cost) + " to the budget and moves the finish date by " + c.weeks + " weeks.",
      confirmLabel: "Approve and apply",
    }).then(ok => ok && doIt());
  } else doIt();
}

function rejectCR(db, c) {
  confirmDialog({ title: "Reject " + c.id + "?", message: c.title, confirmLabel: "Reject change", danger: true,
    detail: "No cost or schedule impact will be applied." })
    .then(ok => ok && App.write("Change rejected", (a) => a.post("/change/" + c.id + "/reject", {}),
      { detail: c.id }));
}

/* Applying an approved change — moving the budget or the finish date —
   happens inside the approval transaction on the server, so the decision
   and its effect cannot come apart (POST /change/:id/approve). */

function crFields(db, c) {
  return [
    { key: "title", label: "What is changing", required: true, span: 2, value: c ? c.title : "" },
    { key: "project", label: "Project", type: "select", value: c ? c.project : db.projects[0].id,
      options: db.projects.map(p => ({ value: p.id, label: p.id + " · " + p.name })) },
    { key: "raisedBy", label: "Raised by", type: "select", value: c ? c.raisedBy : db.currentUser,
      options: db.people.map(p => ({ value: p.id, label: p.name })) },
    { key: "cost", label: "Cost impact ($M)", type: "number", step: 0.01, value: c ? c.cost : 0 },
    { key: "weeks", label: "Schedule impact (weeks)", type: "number", step: 1, value: c ? c.weeks : 0 },
    { key: "funding", label: "Funding source", type: "select", value: c ? c.funding : "Project",
      options: ["Project", "Programme", "Contingency", "Run budget", "n/a"] },
    { key: "riskDelta", label: "Risk delta", value: c ? c.riskDelta : "0", hint: t("e.g. −1 High") },
    { key: "desc", label: "Why", type: "textarea", span: 2, rows: 3, value: c ? c.desc : "" },
  ];
}

function newCR(db) {
  formDialog({
    title: "Raise a change request", kicker: "Change control", wide: true, fields: crFields(db, null),
    saveLabel: "Raise change",
    onSave: (v) => {
      const draft = { cost: +v.cost, weeks: +v.weeks };
      const route = Engine.route(db, draft);
      App.write("Change raised", (a) => a.post("/change", {
        project: v.project, title: v.title, desc: v.desc, raisedBy: v.raisedBy,
        cost: +v.cost, weeks: +v.weeks, funding: v.funding,
      }), { detail: v.title });
      App.set({ cr: db.crs[0].id });
      toast("Routed to " + route.authority, route.why);
    },
  });
}

/** Withdrawing is for a request that should never have been raised;
    a decided one stays on the record. */
function withdrawCR(db, c) {
  confirmDialog({
    title: "Withdraw " + c.id + "?",
    message: c.title,
    detail: "The request is removed entirely. A request that was decided cannot be withdrawn — reverse it with a new one.",
    confirmLabel: "Withdraw request", danger: true,
  }).then(ok => ok && App.write("Change request withdrawn",
    (a) => a.del("/change/" + c.id), { detail: c.id }));
}

function editCR(db, c) {
  formDialog({
    title: "Edit " + c.id, kicker: "Change control", wide: true, fields: crFields(db, c), saveLabel: "Save change",
    onSave: (v) => App.write("Change updated", (a) => a.patch("/change/" + c.id, {
      title: v.title, desc: v.desc, cost: +v.cost, weeks: +v.weeks,
      funding: v.funding, version: c.version,
    }), { detail: c.id }),
  });
}

/* ── Resources ────────────────────────────────────────────────────── */
App.ui.resSite = "all";
Views.resources = (db) => {
  const weeks = 10;
  const cap = Engine.capacity(db, weeks);
  const rows = App.ui.resSite === "all" ? cap.rows : cap.rows.filter(r => r.person.site === App.ui.resSite);
  const over = Engine.overAllocated(db, weeks);
  const ceiling = db.settings.capacityCeiling;
  const bench = Engine.bench(db, weeks);
  const unassigned = db.people.filter(p => !db.allocations.some(a => a.person === p.id));

  const strip = kpiStrip([
    { label: "Bench", value: bench.toFixed(1) + " FTE", note: "unallocated capacity this week" },
    { label: "Over-allocated", value: String(over.length), note: "people above " + ceiling + "% for two weeks or more", accent: over.length > 0 },
    { label: "Utilisation",
      value: cap.rows.length ? Math.round(sum(cap.rows, r => r.avg) / cap.rows.length) + "%" : "—",
      note: cap.rows.length ? "average across " + cap.rows.length + " people" : "no people in the directory yet" },
    { label: "Unassigned", value: String(unassigned.length), note: "people with no project" },
    /* V-09 — headcount is not capacity. Rotation, leave and the day job
       are what stand between the two. */
    { label: t("Effective capacity"),
      value: db.people.length ? sum(db.people, p => Engine.effectiveFte(p)).toFixed(1) + " FTE" : "—",
      note: db.people.length
        ? db.people.filter(p => (p.availability ?? 100) < 100).length + t(" on reduced availability")
        : t("no people yet") },
    { label: t("Contractors"),
      value: String(db.people.filter(p => p.employment === "contractor").length),
      note: t("of ") + db.people.length + t(" people") },
  ]);

  const heat = h("table", { class: "heat" },
    h("thead", null, h("tr", null,
      h("th", { class: "n" }, "Person"),
      ...cap.cols.map(w => h("th", null, "W" + isoWeek(w))),
      h("th", null, "Peak"))),
    h("tbody", null, ...rows.map(r => h("tr", null,
      h("td", { class: "n" },
        h("div", { class: "strong small" }, r.person.name),
        h("div", { class: "xs muted" }, r.person.role + " · " + (Engine.site(db, r.person.site) || {}).city)),
      ...r.cells.map(c => h("td", null, h("div", {
        class: "heat-c",
        title: r.person.name + " · week of " + fmtDate(c.week) + " · " + c.load + "%" + (c.projects.length ? " · " + uniq(c.projects).join(", ") : " · free"),
        style: { background: c.load > ceiling ? "var(--color-accent)"
            : c.load === ceiling ? "var(--color-neutral-300)"
            : c.load >= 60 ? "var(--color-neutral-200)" : "var(--color-neutral-100)",
          color: c.load > ceiling ? "var(--on-solid)" : "var(--color-text)" },
        onClick: () => personDetail(db, r.person, c),
      }, c.load ? c.load + "%" : "—"))),
      h("td", null, h("div", { class: "heat-c", style: "background:transparent;font-weight:800" }, r.peak + "%"))))));

  const demand = db.projects.map(p => {
    const team = db.allocations.filter(a => a.project === p.id);
    return { p, fte: sum(team, a => a.pct) / 100, people: team.length };
  }).sort((a, b) => b.fte - a.fte);
  const peakDemand = Math.max(0, ...demand.map(x => x.fte));

  return h("div", null, strip,
    h("div", { class: "split" },
      h("section", { class: "l sec" },
        sectionHead("Capacity by person", "next " + weeks + " weeks · ceiling " + ceiling + "%",
          selectField("Site", App.ui.resSite,
            [{ value: "all", label: "All sites" }].concat(db.sites.map(x => ({ value: x.id, label: x.city }))),
            v => App.set({ resSite: v }), "150px")),
        h("div", { class: "scrollx" }, heat),
        over.length ? h("div", { class: "drop-hint", style: "margin-top:14px" },
          h("span", { class: "strong warn" }, over.length + " people are over the ceiling for two consecutive weeks or more: "),
          over.map(o => o.person.name).join(", "),
          h("div", { class: "xs muted", style: "margin-top:6px" },
            db.settings.capacityAlerts ? "Capacity alerts are on — resource managers are notified." : "Capacity alerts are off. Turn them on in administration to notify resource managers.")) : null),
      h("aside", { class: "sec" },
        sectionHead("Demand by project", "full-time equivalents",
          /* R-03 — the actual, beside the plan: one number a week. */
          (() => {
            const writable = db.projects.find(pp => App.can("allocation.write", { project: asRow(pp) }));
            return writable
              ? h("button", { class: "btn btn-sm", onClick: () => effortDialog(db) }, t("Record effort"))
              : null;
          })()),
        (() => {
          /* Plan vs réel sur les quatre dernières semaines, en jours. */
          const cut = iso(addDays(db.statusDate, -28));
          const recent = (db.timesheets ?? []).filter(x => x.week >= cut);
          if (!recent.length) return h("div", { class: "xs muted", style: "margin-bottom:10px;max-width:40ch" },
            t("No actual effort has been recorded yet — the numbers below are the plan, and only the plan."));
          const actualDays = sum(recent, x => x.days);
          return h("div", { class: "small", style: "margin-bottom:10px" },
            h("span", { class: "mono strong" }, actualDays.toFixed(1) + " j"),
            t(" of actual effort recorded over the last four weeks, beside the planned FTE below."));
        })(),
        /* Whose demand is it? A site lead reading their people's load must
           see how much of it the GROUP landed on them versus their own
           slate (site committee, G2) — the label carries the answer. */
        (() => {
          const single = App.ui.resSite !== "all" ? App.ui.resSite : null;
          if (!single) return null;
          const mine = new Set(db.people.filter(pp => pp.site === single).map(pp => pp.id));
          const allocs = db.allocations.filter(a => mine.has(a.person));
          const groupIds = new Set(db.projects.filter(p => p.governanceLevel === "group").map(p => p.id));
          /* Positively this site's own open projects — not "everything
             that is not group work", which swept in loans to other sites. */
          const ownIds = new Set(db.projects
            .filter(p => p.site === single && p.governanceLevel === "site" && !p.closed)
            .map(p => p.id));
          const g = sum(allocs.filter(a => groupIds.has(a.project)), a => a.pct) / 100;
          const s = sum(allocs.filter(a => ownIds.has(a.project)), a => a.pct) / 100;
          return h("div", { class: "small", style: "margin-bottom:12px" },
            h("span", { class: "mono strong" }, s.toFixed(1) + " FTE"), " on this site's own projects · ",
            h("span", { class: "mono strong" }, g.toFixed(1) + " FTE"), " drawn by group programmes");
        })(),
        h("div", { style: "margin-bottom:20px" }, demand.slice(0, 8).map(d =>
          h("div", { style: "padding:8px 0;border-bottom:1px solid var(--rule-1);cursor:pointer", onClick: () => go("#/project/" + d.p.id) },
            h("div", { style: "display:flex;gap:8px;align-items:baseline" },
              h("span", { class: "small strong", style: "flex:1;min-width:0" }, d.p.name),
              d.p.governanceLevel === "group" ? h("span", { class: "tag tag-out" }, "group") : null,
              h("span", { class: "mono small" }, d.fte.toFixed(1) + " FTE")),
            /* Math.max of an empty list is -Infinity, and every FTE can
               legitimately be zero before anyone is allocated. */
            meter(peakDemand ? d.fte / peakDemand : 0, "var(--color-text)", "thin")))),
        h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Unassigned people", unassigned.length + " available"),
        h("div", null, unassigned.length ? unassigned.map(p =>
          h("div", { class: "list-row", style: "align-items:center" },
            avatar(db, p.id),
            h("div", { style: "flex:1;min-width:0" },
              h("div", { class: "strong small" }, p.name),
              h("div", { class: "xs muted" }, p.role + " · " + (Engine.site(db, p.site) || {}).city)))) :
          h("div", { class: "small muted" }, "Everyone in the directory is on something.")))));
};

function personDetail(db, person, cell) {
  const allocs = db.allocations.filter(a => a.person === person.id);
  dialog({
    title: person.name, kicker: person.role + " · " + (Engine.site(db, person.site) || {}).city,
    body: h("div", null,
      h("div", { class: "small muted", style: "margin-bottom:12px" },
        "Week of " + fmtDateLong(cell.week) + " · allocated " + cell.load + "% against a " + db.settings.capacityCeiling + "% ceiling"),
      allocs.length ? table({
        cols: [
          { key: "p", label: "Project", get: a => h("div", null,
              h("div", { class: "strong small" }, (Engine.project(db, a.project) || {}).name || a.project),
              h("div", { class: "xs muted" }, a.project)) },
          { key: "w", label: "Window", get: a => h("span", { class: "mono small" }, fmtDate(a.from) + " → " + fmtDate(a.to)) },
          { key: "pct", label: "Allocation", align: "r", get: a => h("span", { class: "mono strong" }, a.pct + "%") },
          /* R7.3 — an assignment is edited or ended by whoever may write
             allocations on that project, not by everyone who can read the
             person's drawer. */
          { key: "x", label: "", align: "r", get: a => !may("allocation.write", Engine.project(db, a.project)) ? null
            : h("div", { class: "btn-row", style: "justify-content:flex-end" },
              h("button", { class: "btn btn-xs", onClick: () => editAllocation(db, a) }, "Edit"),
              h("button", { class: "btn btn-xs btn-ghost", onClick: () => App.write("Assignment removed", (x) => x.del("/allocations/" + a.id), { detail: person.name + " off " + a.project }) }, icon("x", 11))) },
        ], rows: allocs,
      }) : emptyState(t("No allocations"), person.name + " is not on any project."),
      h("div", { class: "small muted", style: "margin-top:14px" }, "Day rate " + person.rate.toLocaleString() + " · " + person.role)),
  });
}

function editAllocation(db, a) {
  formDialog({
    title: "Edit allocation", kicker: Engine.personName(db, a.person) + " · " + a.project,
    fields: [
      { key: "pct", label: "Allocation (%)", type: "number", min: 5, max: 100, step: 5, required: true, value: a.pct },
      { key: "from", label: "From", type: "date", value: a.from },
      { key: "to", label: "To", type: "date", value: a.to, span: 2 },
    ],
    saveLabel: "Save allocation",
    onSave: (v) => App.write("Allocation changed", (x) => x.patch("/allocations/" + a.id, {
      pct: +v.pct, from: v.from, to: v.to, version: a.version,
    }), { detail: Engine.personName(App.db, a.person) }),
  });
}
/* ── Documents · Reports · Locations · Administration ─────────────────────────────────────── */
App.ui.docGate = "all"; App.ui.docStatus = "all"; App.ui.docQ = "";
Views.documents = (db) => {
  const scoped = App.scopedProjects().map(p => p.id);
  let docs = db.docs.filter(d => !d.project || scoped.includes(d.project));
  if (App.ui.docGate !== "all") docs = docs.filter(d => String(d.gate) === App.ui.docGate);
  if (App.ui.docStatus !== "all") docs = docs.filter(d => d.status === App.ui.docStatus);
  if (App.ui.docQ) {
    const t = App.ui.docQ.toLowerCase();
    docs = docs.filter(d => (d.name + " " + (d.project || "") + " " + d.type).toLowerCase().includes(t));
  }

  /* R7.3 — the row actions were drawn for everyone who could see the
     document, so a read-only account was offered "Approve" on a control
     it may not touch. A portfolio-wide document has no project to scope
     against; it follows the same rule the section head does. */
  const mayEditDoc = (d) => d.project
    ? may("document.write", Engine.project(db, d.project))
    : ["admin", "group"].includes(App.me.role);

  const cols = [
    { key: "name", label: "Document", sort: d => d.name, get: d => h("div", null,
        h("div", { class: "strong" }, d.name),
        h("div", { class: "xs muted" }, (d.project ? d.project + " · " + (Engine.project(db, d.project) || {}).name : "Portfolio-wide") + " · " + d.type)) },
    { key: "gate", label: "Gate", align: "c", sort: d => d.gate, width: "62px", get: d => tag("G" + d.gate, "tag-out") },
    { key: "owner", label: "Owner", sort: d => Engine.personName(db, d.owner), get: d => h("span", { class: "small" }, Engine.personName(db, d.owner)) },
    { key: "rev", label: "Rev", align: "c", sort: d => d.rev, width: "56px", get: d => h("div", null,
        h("span", { class: "mono small" }, "v" + d.rev),
        d.supersedes ? h("div", { class: "xs muted", title: t("Replaces ") + d.supersedes }, "↤ " + d.supersedes) : null) },
    /* R-01 — the artefact is a column, because a document without one is
       a label, and the screen should read that way too. */
    /* S-01 — a stored link is data until proven to be a location. Anything
       that is not http(s) is shown as text, never as an href: the server
       refuses to store other schemes, and this refuses to render one that
       ever got past it. */
    { key: "uri", label: t("Artefact"), align: "c", width: "110px", sort: d => (d.uri ? 1 : 0), get: d => d.uri
        ? (safeHref(d.uri)
          ? h("span", { style: "display:inline-flex;gap:6px;align-items:center" },
              h("a", { href: d.uri, target: "_blank", rel: "noopener noreferrer", class: "small linkish",
                title: d.uri, onClick: (e) => e.stopPropagation() }, t("open")),
              /* N-07 — le contrôle de vie, montré comme un FAIT à côté du
                 lien. Il ne touche pas au statut : un jalon approuvé le
                 reste, et quelqu'un qui sait où vit la pièce va vérifier. */
              d.probeState === "unreachable"
                ? h("span", { class: "xs", style: "color:var(--sig-red)",
                    title: t("The last check did not reach this link. The approval is untouched.") }, "⚠")
                : d.probeState === "forbidden"
                ? h("span", { class: "xs muted",
                    title: t("The check was refused access — the piece may well be there.") }, "🔒")
                : d.probeState === "ok"
                ? h("span", { class: "xs", style: "color:var(--sig-green)",
                    title: t("Answered at the last check: ") + (d.probedAt ? fmtDate(String(d.probedAt).slice(0, 10)) : "") }, "✓")
                : null)
          : h("span", { class: "xs", style: "color:var(--sig-amber)", title: d.uri }, t("unsafe link")))
        : h("span", { class: "xs", style: "color:var(--sig-amber)", title: t("No artefact — an approval will be refused") }, "—") },
    { key: "updated", label: "Updated", align: "r", sort: d => d.updated, get: d => h("span", { class: "mono small" }, fmtDate(d.updated)) },
    { key: "status", label: "Status", align: "c", sort: d => d.status, width: "96px", get: d => statusTag(d.status) },
    { key: "act", label: "", align: "r", width: "160px", get: d => !mayEditDoc(d) ? null
      : h("div", { class: "btn-row", style: "justify-content:flex-end" },
        d.status !== "Approved" ? h("button", { class: "btn btn-xs btn-primary", onClick: () => setDocStatus(db, d, "Approved") }, t("Approve")) : null,
        d.status === "Draft" ? h("button", { class: "btn btn-xs", onClick: () => setDocStatus(db, d, "In review") }, t("Submit")) : null,
        d.status === "Approved" ? h("button", { class: "btn btn-xs", onClick: () => reviseDoc(db, d) }, t("New revision")) : null,
        h("button", { class: "btn btn-xs btn-ghost", onClick: () => editDoc(db, d) }, icon("pencil", 11))) },
  ];

  const gateBoard = App.scopedProjects().map(p => {
    const gs = GATES.map(g => Engine.gateStatus(db, p.id, g.n));
    const cur = Engine.currentGate(db, p.id);
    return h("div", { style: "padding:11px 0;border-bottom:1px solid var(--rule-1);cursor:pointer", onClick: () => go("#/project/" + p.id) },
      h("div", { style: "display:flex;gap:8px;align-items:baseline" },
        h("span", { class: "strong small", style: "flex:1;min-width:0" }, p.name),
        h("span", { class: "xs muted" }, cur.name.split("—")[0].trim())),
      h("div", { style: "display:flex;gap:3px;margin-top:6px" }, ...gs.map(g =>
        h("div", { title: "Gate " + g.gate + " · " + g.approved + " of " + g.total + " approved · " + g.state,
          style: { flex: 1, height: "7px", borderRadius: "2px",
            background: g.state === "Cleared" ? "var(--sig-green)"
              : g.state === "At risk" || g.state === "Overdue" ? "var(--sig-red)"
              : g.ready ? "var(--sig-green-line)" : "var(--color-surface-2)" } }))),
      h("div", { class: "xs muted", style: "margin-top:4px" },
        tData(sum(gs, g => g.approved) + " of " + sum(gs, g => g.total) + " evidence items approved")));
  });

  return h("div", { class: "split" },
    h("section", { class: "l sec" },
      h("div", { class: "sec-hd" },
        searchBox(App.ui.docQ, "Search documents", v => App.set({ docQ: v })),
        selectField("Gate", App.ui.docGate, [{ value: "all", label: "All gates" }, ...GATES.map(g => ({ value: String(g.n), label: "Gate " + g.n }))], v => App.set({ docGate: v }), "130px"),
        selectField(t("Status"), App.ui.docStatus,
          [{ value: "all", label: t("All statuses") },
           { value: "Draft", label: t("Draft") }, { value: "In review", label: t("In review") },
           { value: "Approved", label: t("Approved") }], v => App.set({ docStatus: v }), "140px"),
        h("span", { class: "sp" }),
        primaryAction("documents", db)),
      sortableTable({ cols, rows: docs,
        empty: { title: "No documents match", body: "Clear the search or widen the gate and status filters." } }),
      h("div", { class: "small muted", style: "margin-top:10px" },
        tData(docs.length + " shown · " + docs.filter(d => d.status === "Approved").length + " approved · " +
        docs.filter(d => d.status !== "Approved").length + " outstanding"))),
    h("aside", { class: "sec" },
      sectionHead("Gate evidence", "by project"),
      h("div", { style: "margin-bottom:18px" }, gateBoard),
      h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("The gate model"),
      h("div", null, GATES.map(g => h("div", { class: "list-row" },
        h("span", { class: "step-i", style: "flex:none" }, String(g.n)),
        h("div", null,
          h("div", { class: "strong small" }, g.name),
          h("div", { class: "xs muted" }, g.evidence),
          h("div", { class: "xs muted" }, "Owned by " + g.owner))))),
      h("div", { class: "card", style: "margin-top:16px" },
        h("div", { class: "card-kicker" }, "Gate locking"),
        h("div", { class: "small", style: "margin-top:4px" },
          db.settings.gateLock
            ? t("On — a project cannot advance a phase until every evidence item for its next gate is approved.")
            : t("Off — phases can advance with evidence outstanding.")),
        h("button", { class: "btn btn-xs", style: "margin-top:9px", onClick: () => go("#/admin") }, "Change in administration"))));
};

function setDocStatus(db, d, status) {
  App.write("Document " + status.toLowerCase(),
    (a) => a.patch("/documents/" + d.id, { status, version: d.version }),
    { detail: d.name });
  if (status === "Approved" && d.project) {
    const g = Engine.gateStatus(App.db, d.project, d.gate);
    if (g.ready) toast("Gate evidence complete", "Gate " + d.gate + " for " + d.project + " is ready to be heard");
  }
}
function reviseDoc(db, d) {
  App.write("New revision", (a) => a.post("/documents/" + d.id + "/revise", {}),
    { detail: d.name });
}
function docFields(db, d) {
  return [
    { key: "name", label: "Document", required: true, span: 2, value: d ? d.name : "" },
    { key: "project", label: "Project", type: "select", value: d ? (d.project || "") : "",
      options: [{ value: "", label: "Portfolio-wide" }].concat(db.projects.map(p => ({ value: p.id, label: p.id + " · " + p.name }))) },
    { key: "type", label: "Type", type: "select", value: d ? d.type : "Design", options: DOC_TYPES },
    { key: "gate", label: "Gate", type: "select", value: d ? String(d.gate) : "1", options: GATES.map(g => ({ value: String(g.n), label: g.name })) },
    { key: "owner", label: "Owner", type: "select", value: d ? d.owner : db.currentUser, options: db.people.map(p => ({ value: p.id, label: p.name })) },
    { key: "rev", label: "Revision", value: d ? d.rev : "0.1" },
    { key: "status", label: "Status", type: "select", value: d ? d.status : "Draft", options: ["Draft", "In review", "Approved"] },
    /* R-01 — the artefact itself. Free while drafting; required and
       host-checked by the server the moment anybody approves. */
    { key: "uri", label: t("Evidence link"), span: 2, value: d ? (d.uri ?? "") : "",
      placeholder: "https://…",
      hint: t("Where the piece actually lives. Approval is refused without it, and changing it after approval sends the document back to review.") },
  ];
}
function newDoc(db) {
  formDialog({ title: "Add document", kicker: "Library", wide: true, fields: docFields(db, null), saveLabel: "Add document",
    onSave: (v) => App.write("Document added", (a) => a.post("/documents", {
      name: v.name, project: v.project || null, type: v.type, gate: +v.gate,
      owner: v.owner, rev: v.rev || "0.1", status: v.status, uri: v.uri,
    }), { detail: v.name }) });
}
function editDoc(db, d) {
  formDialog({ title: "Edit document", kicker: d.id, wide: true, fields: docFields(db, d), saveLabel: "Save document",
    extra: h("button", { class: "btn btn-sm btn-danger", onClick: () => {
      confirmDialog({ title: "Delete " + d.name + "?", message: "Gate evidence lists will change.", confirmLabel: "Delete", danger: true })
        .then(ok => { if (ok) { App.write("Document deleted", (a) => a.del("/documents/" + d.id), { detail: d.name }); closeDialog(); } });
    } }, icon("trash", 12), "Delete"),
    onSave: (v) => App.write("Document updated", (a) => a.patch("/documents/" + d.id, {
      name: v.name, project: v.project || null, type: v.type, gate: +v.gate,
      owner: v.owner, rev: v.rev, status: v.status, uri: v.uri, version: d.version,
    }), { detail: v.name }) });
}

/* ── Status reporting ─────────────────────────────────────────────── */
Views.reports = (db) => {
  const list = App.scopedProjects();
  const roll = Engine.roll(db, list);
  const st = db.settings;
  const openRaid = db.raid.filter(r => r.status === "Open" && (!r.project || list.some(p => p.id === r.project)));
  const worst = openRaid.reduce((a, r) => Math.max(a, Engine.exposure(r)), 0);
  const pendingCRs = db.crs.filter(c => c.status === "Pending" && list.some(p => p.id === c.project));

  /* An average can sit comfortably in green while two projects are on fire.
     The portfolio line takes the worse of the aggregate and the spread. */
  const ms = list.map(p => Engine.metrics(db, p.id)).filter(m => m.measurable);
  const redSched = ms.filter(m => m.spi < st.redSpi).length;
  const redCost = ms.filter(m => m.cpi < st.redCpi).length;
  const band = (v, red, amber, nRed) =>
    v < red || nRed >= 2 ? "R" : v < amber || nRed >= 1 ? "A" : "G";
  const spread = (n, what) => n ? " · " + n + " project" + (n === 1 ? "" : "s") + " below the red " + what + " line" : "";

  const rag = [
    { dim: "Schedule", rag: band(roll.spi, st.redSpi, st.amberSpi, redSched),
      note: "Portfolio SPI " + idx(roll.spi) + spread(redSched, "SPI") },
    { dim: "Cost", rag: band(roll.cpi, st.redCpi, st.amberCpi, redCost),
      note: "CPI " + idx(roll.cpi) + " · forecast " + signedMoney(roll.vac) + " against budget" + spread(redCost, "CPI") },
    { dim: "Scope", rag: pendingCRs.length > 2 ? "A" : "G",
      note: pendingCRs.length + " change requests awaiting a decision" },
    { dim: "Risk", rag: worst >= st.escalateExposure ? "R" : worst >= st.pmoExposure ? "A" : "G",
      note: openRaid.length + " open items · highest exposure " + worst },
  ];

  const done = [];
  db.milestones.filter(m => list.some(p => p.id === m.project))
    .filter(m => days(m.date, db.statusDate) >= 0 && days(m.date, db.statusDate) <= 35)
    .sort(by("date")).slice(0, 5)
    .forEach(m => done.push(m.name + " — " + (Engine.project(db, m.project) || {}).name + ", " + fmtDate(m.date)));
  const next = Engine.horizon(db, 5).map(m => m.name + " — " + m.projectName + ", " + fmtDate(m.date));
  const moved = openRaid.sort((a, b) => Engine.exposure(b) - Engine.exposure(a)).slice(0, 4)
    .map(r => r.id + " " + r.title + " — exposure " + Engine.exposure(r) + ", " + Engine.escalation(db, r).level.toLowerCase() + " level");
  const financial = [
    "Portfolio CPI " + idx(roll.cpi) + " against a " + idx(st.amberCpi) + " amber threshold",
    "Contingency " + pct(sum(list, p => p.contingency) ? sum(list, p => p.contingencyUsed) / sum(list, p => p.contingency) : 0) +
      " consumed at " + pct(roll.bac ? roll.ev / roll.bac : 0) + " complete by value",
    "Forecast at completion " + money(roll.eac) + " against " + money(roll.bac) + " approved (" + signedMoney(roll.vac) + ")",
  ];

  const blocks = [
    { key: "achieved", title: "Achieved this period", items: done.length ? done : ["No milestones landed in the last five weeks."] },
    { key: "planned", title: "Planned next period", items: next.length ? next : ["Nothing dated in the horizon."] },
    { key: "risks", title: "Risks & issues moved", items: moved.length ? moved : ["Register is clear."] },
    { key: "financial", title: "Financial position", items: financial },
  ];

  const decision = pendingCRs[0];

  const report = h("section", { class: "sec", style: "max-width:900px" },
    h("div", { style: "display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap" },
      h("div", { style: "flex:1;min-width:260px" },
        h("div", { class: "kicker" }, "Executive status report · week " + isoWeek(db.statusDate) + " · " + db.orgName),
        h("h3", { style: "margin:6px 0 0" }, "Portfolio status — week ending " + fmtDateLong(db.statusDate)),
        h("div", { class: "small muted", style: "margin-top:5px" },
          App.scopeLabel() + " · " + roll.count + " projects · " + money(roll.bac) + " · reporting cadence " + st.cadence)),
      h("div", { class: "btn-row no-print" },
        h("button", { class: "btn btn-sm", onClick: () => window.print() }, icon("printer", 12), "Print"),
        h("button", { class: "btn btn-sm", onClick: () => exportReport(db, list, rag, blocks) }, icon("download", 12), "Markdown"),
        /* V-16 — one flat row per project, so the portfolio can sit beside
           production and finance data instead of being retyped into it. */
        h("button", { class: "btn btn-sm", title: t("One flat row per project, for the group's own reporting"),
          onClick: () => exportDataset() }, icon("download", 12), t("Dataset")),
        App.can("period.close")
          ? h("button", { class: "btn btn-sm btn-primary", onClick: () => closePeriod(db) },
              icon("check", 12), t("Close the period"))
          : null)),

    /* V-02 — the reported record. Everything above this line is computed
       live; a closed period is what was actually said, and it is read
       here rather than recomputed. */
    periodBlock(db),

    h("div", { style: "height:20px" }), h("hr", { class: "hr" }), h("div", { style: "height:20px" }),

    h("div", { style: "display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule-1)" },
      ...rag.map(r => h("div", { style: "background:var(--color-bg);padding:14px 14px 14px 0" },
        h("div", { class: "kicker" }, r.dim),
        h("div", { style: "display:flex;align-items:center;gap:8px;margin:7px 0 5px" },
          h("span", { class: "dot", style: { width: "14px", height: "14px",
            background: r.rag === "R" ? "var(--sig-red)" : r.rag === "A" ? "var(--sig-amber)" : "var(--sig-green)" } }),
          h("span", { class: "num", style: "font-size:16px" }, RAG_LABEL[r.rag])),
        h("div", { class: "xs muted" }, tData(r.note))))),

    h("div", { style: "height:24px" }),
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:26px" },
      ...blocks.map(b => h("div", null,
        h("div", { style: "display:flex;align-items:baseline;gap:8px" },
          h("h5", { style: "font-size:12px;letter-spacing:.1em;text-transform:uppercase" }, t(b.title)),
          h("span", { class: "sp", style: "flex:1" }),
          /* The narrative is what the group tells the board; a site lead
             reads it and a viewer reads it, neither writes it. */
          ["admin", "group"].includes(App.me.role)
            ? h("button", { class: "btn btn-xs btn-ghost no-print", onClick: () => editBlock(db, b) }, icon("pencil", 11))
            : null),
        h("hr", { class: "hr", style: "margin:6px 0 10px" }),
        h("ul", { style: "margin:0;padding-left:17px" },
          /* R-15 — the generated narrative lines are composed around live
             numbers; hand-edited narrative passes through untouched. */
          ...((db.narrative[b.key] || b.items.map(tData)).map(i => h("li", { class: "small", style: "margin-bottom:6px" }, i))))))),

    h("div", { style: "height:26px" }),
    sectionHead("Project detail"),
    table({
      cols: [
        { key: "n", label: "Project", get: m => h("div", null, h("div", { class: "strong small" }, m.project.name),
            h("div", { class: "xs muted" }, m.project.id + " · " + (Engine.site(db, m.project.site) || {}).city)) },
        { key: "h", label: "RAG", align: "c", get: m => ragDot(m.health.rag) },
        { key: "p", label: "Complete", align: "r", get: m => h("span", { class: "mono small" }, pct(m.pctComplete)) },
        { key: "s", label: "SPI", align: "r", get: m => indexCell(m, "spi", db.settings.amberSpi) },
        { key: "c", label: "CPI", align: "r", get: m => indexCell(m, "cpi", db.settings.amberCpi) },
        { key: "e", label: "EAC", align: "r", get: m => h("span", { class: "mono small" }, money(m.eac)) },
        { key: "f", label: "Forecast finish", align: "r", get: m => h("span", { class: "mono small", style: m.slipDays > 7 ? "color:var(--sig-red);font-weight:700" : null }, fmtDate(m.forecastFinish)) },
      ],
      rows: roll.metrics, onRow: m => go("#/project/" + m.project.id),
    }),

    decision ? h("div", { class: "poster", style: "margin-top:26px" },
      h("div", { class: "kicker", style: "color:#fff;opacity:.75" }, "Decision requested of the " + Engine.route(db, decision).authority.toLowerCase()),
      h("h3", { style: "margin:8px 0 6px;color:#fff" }, decision.id + " — " + decision.title),
      h("div", { class: "small", style: "opacity:.9;max-width:60ch" }, decision.desc),
      h("div", { class: "small", style: "margin-top:10px;font-weight:600" },
        (decision.cost > 0 ? "+" : "") + cash(decision.cost) + " · " + (decision.weeks > 0 ? "+" : "") + decision.weeks + " weeks · funded from " + decision.funding.toLowerCase()),
      h("button", { class: "btn btn-sm no-print", style: "margin-top:16px;background:#fff;border-color:#fff;color:var(--color-accent-800)",
        onClick: () => go("#/change/" + decision.id) }, "Open the request")) : null,

    /* Value position (Endeavour committee, V-01) — deliberately ABOVE the
       risk strip: the first question a sponsor asks of a portfolio report
       is what it returned, not what it is afraid of. */
    h("div", { style: "height:26px" }),
    sectionHead(t("Value position"), t("what the portfolio promised, and what has been measured")),
    (() => {
      const vp = Engine.valueProfile(db, list);
      return kpiStrip([
        { label: t("Benefits promised"), value: String(vp.live),
          note: vp.total - vp.live ? (vp.total - vp.live) + t(" withdrawn") : t("across the portfolio") },
        { label: t("Measured"), value: String(vp.measured),
          note: vp.live ? Math.round(vp.measured / vp.live * 100) + t("% of what was promised") : "—" },
        { label: t("Attainment"), value: vp.attainment == null ? "—" : pct(vp.attainment),
          note: vp.attainment == null ? t("nothing measured yet") : t("of target, on measured benefits"),
          accent: vp.attainment != null && vp.attainment < 0.8 },
        { label: t("Met"), value: vp.decided ? vp.met + " / " + vp.decided : "—",
          note: vp.decided ? t("ruled on at group level") : t("none ruled on yet") },
        { label: t("Promising nothing"), value: String(vp.uncased),
          note: t("projects with no stated benefit"), accent: vp.uncased > 0 },
      ]);
    })(),

    /* Risk posture against appetite (governance committee, group-5). */
    h("div", { style: "height:26px" }),
    sectionHead(t("Risk posture"), "open exposure against the portfolio's appetite lines"),
    (() => {
      const rp = Engine.riskProfile(db, list);
      return kpiStrip([
        { label: "Open items", value: String(rp.open), note: "risks and issues in scope" },
        { label: "Critical", value: String(rp.bands.Critical), note: "exposure 15+", accent: rp.bands.Critical > 0 },
        { label: "High", value: String(rp.bands.High), note: "exposure 9–14" },
        { label: "At steering level", value: String(rp.steering), note: "at or above " + rp.appetite.steering, accent: rp.steering > 0 },
        { label: "At PMO level", value: String(rp.pmo), note: rp.appetite.pmo + "–" + (rp.appetite.steering - 1) + " band" },
      ]);
    })(),

    /* The decision register (governance committee, group-3): what was
       DECIDED — approvals, overrides, re-baselines, governance moves and
       minuted meeting decisions — with who and under which authority.
       Group level and above, like the audit trail it reads. */
    ...(["admin", "group"].includes(App.me.role) ? [
      h("div", { style: "height:26px" }),
      sectionHead("Decision register", "consequential decisions, newest first"),
      (() => {
        const reg = liveFetch("register", () => api.get("/decisions/log"), (r) => {
          const controls = (r.register || []).map(x => ({
            on: String(x.at).slice(0, 10), what: x.action + " · " + x.entity_id,
            detail: x.detail, by: x.by, scope: "control",
          }));
          const minuted = (r.minuted || []).map(x => ({
            on: String(x.on).slice(0, 10),
            what: (x.referred ? "REFERRED to " + x.referred + " · " : "Decision · ") + x.headline,
            detail: x.series + (x.rationale ? " — " + x.rationale : ""), by: x.by || "—", scope: x.scope,
          }));
          return controls.concat(minuted).sort((a, b) => b.on.localeCompare(a.on)).slice(0, 30);
        });
        return reg.length
          ? table({
              cols: [
                { key: "on", label: "Date", width: "92px", get: x => h("span", { class: "mono small" }, x.on) },
                { key: "what", label: "Decision", get: x => h("div", null,
                    h("div", { class: "strong small" }, x.what),
                    x.detail ? h("div", { class: "xs muted" }, String(x.detail).slice(0, 110)) : null) },
                { key: "by", label: "By", get: x => h("span", { class: "small" }, x.by) },
              ],
              rows: reg,
            })
          : h("div", { class: "small muted" }, reg.failed
              ? "The decision register could not be loaded — refresh to try again."
              : "No consequential decisions recorded yet.");
      })(),
    ] : []));

  return report;
};

function editBlock(db, b) {
  formDialog({
    title: b.title, kicker: "Report narrative",
    fields: [{ key: "text", label: "One item per line", type: "textarea", rows: 7, span: 2,
      value: (db.narrative[b.key] || b.items).join("\n") }],
    saveLabel: "Save narrative",
    extra: h("button", { class: "btn btn-sm", onClick: () => {
      App.write("Narrative reset", (a) => a.put("/narrative/" + b.key, { lines: null }), { detail: b.title });
      $(".backdrop") && $(".backdrop").remove();
    } }, "Reset to generated text"),
    onSave: (v) => App.write("Narrative edited", (a) => a.put("/narrative/" + b.key, {
      lines: v.text.split("\n").map((x) => x.trim()).filter(Boolean),
    }), { detail: b.title }),
  });
}

function exportReport(db, list, rag, blocks) {
  const roll = Engine.roll(db, list);
  const L = [];
  L.push("# " + db.orgName + " — portfolio status, week ending " + fmtDateLong(db.statusDate));
  L.push("");
  L.push(App.scopeLabel() + " · " + roll.count + " projects · " + money(roll.bac) + " approved");
  L.push("");
  L.push("| Dimension | Status | Note |");
  L.push("| --- | --- | --- |");
  rag.forEach(r => L.push("| " + r.dim + " | " + RAG_LABEL[r.rag] + " | " + r.note + " |"));
  L.push("");
  blocks.forEach(b => {
    L.push("## " + b.title);
    (db.narrative[b.key] || b.items).forEach(i => L.push("- " + i));
    L.push("");
  });
  L.push("## Project detail");
  L.push("| Project | RAG | Complete | SPI | CPI | EAC | Forecast finish |");
  L.push("| --- | --- | --- | --- | --- | --- | --- |");
  roll.metrics.forEach(m => L.push("| " + m.project.name + " | " + RAG_LABEL[m.health.rag] + " | " + pct(m.pctComplete) +
    " | " + idx(m.spi) + " | " + idx(m.cpi) + " | " + money(m.eac) + " | " + fmtDate(m.forecastFinish) + " |"));
  saveText("meridian-status-" + db.statusDate + ".md", L.join("\n"), "text/markdown");
  toast("Report exported", "Markdown, ready to paste into the pack");
}

/* ── Locations ────────────────────────────────────────────────────── */
Views.locations = (db) => {
  const roll = Engine.siteRollup(db);
  const ceiling = db.settings.capacityCeiling;
  const now = new Date();

  const cols = [
    { key: "city", label: "Site", sort: r => r.site.city, get: r => h("div", null,
        h("div", { class: "strong" }, r.site.city),
        h("div", { class: "xs muted" }, r.site.region + " · " + r.site.role)) },
    { key: "clock", label: "Local", align: "c", sort: r => r.site.tz, get: r => h("div", null,
        h("div", { class: "clock", style: "font-size:14px" }, Engine.siteClock(r.site, now)),
        h("div", { class: "xs muted" }, r.site.tzName)) },
    { key: "people", label: "People", align: "r", sort: r => r.site.headcount, get: r => h("span", { class: "mono" }, String(r.site.headcount)) },
    { key: "projects", label: "Projects", align: "r", sort: r => r.projects.length, get: r => h("span", { class: "mono" }, String(r.projects.length)) },
    { key: "value", label: "Led value", align: "r", sort: r => r.load, get: r => h("span", { class: "mono" }, money(r.load)) },
    { key: "util", label: "Utilisation", sort: r => r.util, width: "130px", get: r => h("div", null,
        h("div", { class: "bar-lbl mono" }, h("span", null, r.util + "%"), h("span", null, r.util > ceiling ? "over" : r.util < 75 ? "light" : "")),
        meter(Math.min(r.util, 130) / 130, r.util > ceiling ? "var(--color-accent)" : r.util < 75 ? "var(--color-neutral-400)" : "var(--color-text)", "thin")) },
    { key: "health", label: "Delivery", align: "c", sort: r => r.roll.red, get: r => r.projects.length
        ? h("div", { class: "mix", style: "width:70px" },
            h("i", { style: { width: (r.roll.green / r.projects.length * 100) + "%", background: "var(--color-text)" } }),
            h("i", { style: { width: (r.roll.amber / r.projects.length * 100) + "%", background: "var(--sig-amber)" } }),
            h("i", { style: { width: (r.roll.red / r.projects.length * 100) + "%", background: "var(--color-accent)" } }))
        : h("span", { class: "xs muted" }, "—") },
    /* Governance load per slate (governance committee, group-4): what
       each site OWES, not only what it runs. */
    /* V-07 — what the site actually is. A rollout plan depends on the
       link and the readiness far more than on the time zone. */
    { key: "ready", label: t("Readiness"), sort: r => r.site.readiness ?? "",
      get: r => h("div", null,
        h("span", { class: "tag " + (r.site.readiness === "Ready" ? "tag-ink"
          : r.site.readiness === "Not ready" ? "tag-accent" : "tag-out") },
          t(r.site.readiness ?? "Unknown")),
        r.site.linkMbps != null
          ? h("div", { class: "xs muted", style: "margin-top:3px" },
              r.site.linkMbps + " Mbps" + (r.site.linkKind ? " · " + r.site.linkKind : ""))
          : null) },
    { key: "owes", label: "Owes", align: "r", sort: r => r.decisions + r.escalated,
      get: r => (r.decisions || r.escalated)
        ? h("div", { style: "display:flex;gap:5px;justify-content:flex-end" },
            r.decisions ? h("span", { class: "tag tag-out", title: r.decisions + " decision(s) waiting on this slate" }, r.decisions + " dec") : null,
            r.escalated ? h("span", { class: "tag tag-accent", title: r.escalated + " steering-level risk(s)" }, r.escalated + " esc") : null)
        : h("span", { class: "xs muted" }, "—") },
  ];

  /* follow-the-sun overlap */
  const sites = db.sites;
  const overlap = h("table", { class: "heat" },
    h("thead", null, h("tr", null, h("th", { class: "n" }, "Overlap (hours)"), ...sites.map(x => h("th", null, x.id)))),
    h("tbody", null, ...sites.map(a => h("tr", null,
      h("td", { class: "n" }, h("span", { class: "small strong" }, a.city)),
      ...sites.map(b => {
        if (a.id === b.id) return h("td", null, h("div", { class: "heat-c", style: "background:var(--color-neutral-200);color:var(--muted)" }, "—"));
        const ov = Engine.overlapHours(a, b);
        return h("td", null, h("div", { class: "heat-c",
          title: a.city + " and " + b.city + " share " + ov.toFixed(1) + " working hours",
          style: { background: ov <= 0 ? "var(--sig-red)" : ov < 3 ? "var(--sig-amber-soft)" : "var(--color-surface)",
            color: ov <= 0 ? "var(--on-solid)" : "var(--color-text)" } }, ov > 0 ? ov.toFixed(1) : "0"));
      })))));

  const noOverlap = [];
  sites.forEach((a, i) => sites.slice(i + 1).forEach(b => { if (Engine.overlapHours(a, b) <= 0) noOverlap.push(a.city + " / " + b.city); }));

  return h("div", null,
    kpiStrip([
      { label: "Sites", value: String(db.sites.length), note: uniq(db.projects.map(p => p.site)).length + " leading delivery" },
      { label: "People", value: String(sum(db.sites, s => s.headcount)), note: "across every location" },
      { label: "Widest gap",
        value: db.sites.length
          ? (Math.max(...db.sites.map(s => s.tz)) - Math.min(...db.sites.map(s => s.tz))) + " h"
          : "—",
        note: "between the extreme time zones" },
      { label: "Pairs with no overlap", value: String(noOverlap.length), note: "need asynchronous handover", accent: noOverlap.length > 0 },
      { label: "Portfolio value", value: money(sum(db.projects, p => p.budget)), note: "led from these sites" },
    ]),
    h("div", { class: "split" },
      h("section", { class: "l sec" },
        sectionHead("Delivery locations", "utilisation against a " + ceiling + "% ceiling"),
        sortableTable({ cols, rows: roll, onRow: r => siteDetail(db, r) }),
        h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        windowsBlock(db),

        h("div", { style: "height:26px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Working-hour overlap", "09:00–17:30 local, both ends"),
        h("div", { class: "scrollx" }, overlap),
        noOverlap.length ? h("div", { class: "drop-hint", style: "margin-top:12px" },
          h("span", { class: "strong warn" }, "No shared working hours: "), noOverlap.join(" · "),
          h("div", { class: "xs muted", style: "margin-top:5px" }, "Work crossing these pairs has to hand over in writing, not in a call.")) : null),
      h("aside", { class: "sec" },
        sectionHead("Where the work is"),
        h("div", { style: "margin-bottom:20px" }, roll.slice().sort((a, b) => b.load - a.load).map(r =>
          h("div", { style: "padding:9px 0;border-bottom:1px solid var(--rule-1);cursor:pointer", onClick: () => siteDetail(db, r) },
            h("div", { style: "display:flex;gap:8px;align-items:baseline" },
              h("span", { class: "small strong", style: "flex:1" }, r.site.city),
              h("span", { class: "mono small" }, money(r.load))),
            meter(r.load / Math.max(0.1, Math.max(...roll.map(x => x.load))), "var(--color-text)", "thin"),
            h("div", { class: "xs muted", style: "margin-top:4px" },
              r.projects.length + " projects · " + r.site.headcount + " people · " + r.util + "% utilised")))),
        h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        sectionHead("Clocks", "right now"),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px" },
          ...db.sites.map(sit => {
            const hh = +Engine.siteClock(sit, now).slice(0, 2);
            const working = hh >= 9 && hh < 18;
            return h("div", { style: "padding:9px 0;border-bottom:1px solid var(--rule-1)" },
              h("div", { class: "clock", style: { "font-size": "17px", color: working ? "var(--color-text)" : "var(--muted)" } }, Engine.siteClock(sit, now)),
              h("div", { class: "xs muted" }, sit.city + " · " + (working ? "at work" : "closed")));
          })))));
};

function siteDetail(db, r) {
  const people = db.people.filter(p => p.site === r.site.id);
  dialog({
    title: r.site.city, kicker: r.site.region + " · " + r.site.tzName + " · " + Engine.siteClock(r.site, new Date()) + " local", wide: true,
    body: h("div", null,
      h("p", { class: "small muted", style: "margin:0 0 14px" }, r.site.role),
      h("div", { class: "kpis", style: "grid-template-columns:repeat(4,1fr);border-bottom:0;margin-bottom:16px" },
        h("div", { class: "kpi", style: "padding-left:0" }, h("div", { class: "kicker" }, "People"), h("div", { class: "kpi-v", style: "font-size:22px" }, String(r.site.headcount))),
        h("div", { class: "kpi" }, h("div", { class: "kicker" }, "Projects led"), h("div", { class: "kpi-v", style: "font-size:22px" }, String(r.projects.length))),
        h("div", { class: "kpi" }, h("div", { class: "kicker" }, "Value"), h("div", { class: "kpi-v", style: "font-size:22px" }, money(r.load))),
        h("div", { class: "kpi", style: "border-right:0" }, h("div", { class: "kicker" }, "Utilisation"), h("div", { class: "kpi-v", style: "font-size:22px" }, r.util + "%"))),
      h("hr", { class: "hr" }), h("div", { style: "height:14px" }),
      r.projects.length ? table({
        cols: [
          { key: "n", label: "Project", get: p => h("span", { class: "strong small" }, p.name) },
          { key: "ph", label: "Phase", get: p => h("span", { class: "small" }, p.phase) },
          { key: "h", label: "Health", align: "c", get: p => ragDot(Engine.metrics(db, p.id).health.rag) },
          { key: "b", label: "Budget", align: "r", get: p => h("span", { class: "mono small" }, money(p.budget)) },
        ], rows: r.projects, onRow: p => { $(".backdrop") && $(".backdrop").remove(); go("#/project/" + p.id); },
      }) : emptyState(t("No projects led here"), r.site.city + " contributes people to projects led elsewhere."),
      h("div", { style: "height:18px" }),
      sectionHead("Directory", people.length + " people"),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" }, ...people.map(p =>
        h("div", { style: "display:flex;gap:9px;align-items:center;padding:6px 0;border-bottom:1px solid var(--rule-1)" },
          avatar(db, p.id, "sm"),
          h("div", { style: "min-width:0" },
            h("div", { class: "small strong" }, p.name),
            h("div", { class: "xs muted" }, p.role)))))),
  });
}

/* ── Administration ───────────────────────────────────────────────── */

Views.admin = (db) => {
  const st = db.settings;
  const toggles = [
    ["autoRag", "Automatic RAG status", "Derive project health from SPI and CPI rather than the project manager's judgement."],
    ["gateLock", "Lock gate progression", "Block a phase advance until every evidence document for the next gate is approved."],
    ["ccb", "Change control board required", "Route any change above the thresholds below to the steering committee."],
    ["capacityAlerts", "Capacity alerts", "Warn when an assignment takes someone past the ceiling for two weeks or more."],
    ["benefitTrack", "Post-closure benefits tracking", "Keep benefit measures open for twelve months after Gate 4."],
  ];

  const switchRow = ([key, name, desc]) => {
    const on = st[key];
    return h("div", { class: "list-row", style: "align-items:flex-start;gap:14px" },
      h("div", { style: "flex:1;min-width:0" },
        h("div", { class: "strong small" }, name),
        h("div", { class: "xs muted" }, desc)),
      h("button", { class: "switch" + (on ? " on" : ""), role: "switch", "aria-checked": String(on), "aria-label": name,
        onClick: () => App.write(name + (on ? " turned off" : " turned on"),
          (a) => a.patch("/admin/settings", { [key]: !on }), { quiet: true }) },
        h("span", { class: "knob" })));
  };

  const num = (key, label, hint, step, min, max) => h("div", { class: "field" },
    h("label", null, label),
    h("input", { class: "input input-sm", type: "number", value: st[key], step: step || 0.01, min, max,
      onChange: (e) => App.write(label + " changed",
        (a) => a.patch("/admin/settings", { [key]: +e.target.value }),
        { detail: label + " → " + e.target.value, quiet: true }) }),
    hint ? h("div", { class: "xs muted" }, hint) : null);

  const dataSize = JSON.stringify(db).length;

  return h("div", { class: "split-2" },
    h("section", { class: "sec" },
      sectionHead("Governance rules", "these change how the whole book behaves"),
      h("div", { style: "margin-bottom:22px" }, toggles.map(switchRow)),

      h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("Thresholds"),
      h("div", { class: "form-grid" },
        num("amberSpi", "Amber SPI", "below this, projects turn amber", 0.01, 0, 2),
        num("redSpi", "Red SPI", "below this, projects turn red", 0.01, 0, 2),
        num("amberCpi", "Amber CPI", "cost index amber line", 0.01, 0, 2),
        num("redCpi", "Red CPI", "cost index red line", 0.01, 0, 2),
        num("ccbThreshold", "Steering threshold ($M)", "changes above this go to steering", 0.05, 0),
        num("ccbWeeks", "Steering threshold (weeks)", "or a schedule impact this large", 1, 0),
        num("escalateExposure", "Steering exposure", "P × I at or above this is heard by steering", 1, 1, 25),
        num("pmoExposure", "PMO exposure", "P × I at or above this is heard by the PMO", 1, 1, 25),
        num("issueAgeDays", "Issue age (days)", "an issue open longer than this escalates", 1, 1),
        num("capacityCeiling", "Capacity ceiling (%)", "allocation above this counts as over", 5, 50, 150)),

      h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("Reporting"),
      h("div", { class: "form-grid" },
        h("div", { class: "field" }, h("label", null, "Organisation name"),
          h("input", { class: "input input-sm", value: db.orgName,
            onChange: e => App.write("Organisation renamed",
              (a) => a.patch("/admin/settings", { orgName: e.target.value || "MERIDIAN" }),
              { detail: e.target.value }) })),
        h("div", { class: "field" }, h("label", null, "Status date"),
          h("input", { class: "input input-sm", type: "date", value: db.statusDate,
            onChange: e => App.write("Status date moved",
              (a) => a.patch("/admin/settings", { statusDate: e.target.value }),
              { detail: fmtDateLong(e.target.value) }) }),
          h("div", { class: "xs muted" }, "Every metric is measured as at this date")),
        h("div", { class: "field full" }, h("label", null, "Reporting cadence"),
          h("select", { class: "input input-sm", value: st.cadence,
            onChange: e => App.write("Cadence changed",
              (a) => a.patch("/admin/settings", { cadence: e.target.value }),
              { detail: e.target.value }) },
            ...["Weekly — Monday 09:00", "Weekly — Friday 16:00", "Fortnightly — Wednesday 10:00", "Monthly — first working day"]
              .map(o => h("option", { value: o, selected: o === st.cadence }, o))))),

      h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("Board columns", "work-in-progress limits"),
      h("div", null, db.columns.map(c => h("div", { class: "list-row", style: "align-items:center" },
        h("div", { style: "flex:1" }, h("div", { class: "strong small" }, c.name),
          h("div", { class: "xs muted" }, c.wip > 0 ? "Limit " + c.wip + " items" : "No limit")),
        h("input", { class: "input input-sm", type: "number", min: 0, max: 40, value: c.wip, style: "width:78px",
          onChange: e => App.write("WIP limit changed",
            (a) => a.patch("/admin/columns/" + c.id, { wip: +e.target.value }),
            { detail: c.name + " → " + (+e.target.value || "no limit"), quiet: true }) }))))),

    h("section", { class: "sec" },
      /* Was a table of five job titles counted by regex — an access model
         the system does not implement. Replaced by the four levels it does
         enforce, and the real accounts holding them. */
      accessPanel(db),

      h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      directoryPanel(db),

      h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      importPanel(),

      h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      notificationsPanel(),

      referencePanel(db) ? h("div", null,
        h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        referencePanel(db)) : null,

      federationPanel() ? h("div", null,
        h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
        federationPanel()) : null,

      h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("The gate model", "evidence required at each gate"),
      table({
        cols: [
          { key: "n", label: "Gate", align: "c", width: "46px", get: g => h("span", { class: "num" }, String(g.n)) },
          { key: "name", label: "Gate", get: g => h("span", { class: "strong small" }, g.name.split("—")[1].trim()) },
          { key: "e", label: "Evidence", get: g => h("span", { class: "xs muted" }, g.evidence) },
          { key: "o", label: "Owner", align: "r", get: g => h("span", { class: "small" }, g.owner) },
        ], rows: GATES,
      }),

      h("div", { style: "height:22px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      sectionHead("Data", "held in PostgreSQL · every change attributed and audited"),
      h("div", { class: "btn-row", style: "margin-bottom:12px" },
        h("button", { class: "btn btn-sm", onClick: () => exportAll(db) }, icon("download", 12), "Export book"),
        /* Export is a read (data.export); replacing or wiping the book is
           not. Both were drawn for anyone who reached this screen. */
        App.can("data.import", {})
          ? h("button", { class: "btn btn-sm", onClick: importAll }, icon("upload", 12), "Import book")
          : null,
        /* The single-file build kept a 25-deep undo stack over its own
           local copy. With several people writing to one database that is
           not undo, it is one person silently reverting another. What
           replaced it: the audit trail below shows who changed what, and
           money is corrected by a reversing posting rather than erased. */
        App.isAdmin
          ? h("button", { class: "btn btn-sm btn-danger", onClick: resetAll }, icon("trash", 12), "Reset to seed")
          : null),
      h("div", { class: "small muted", style: "margin-bottom:22px" },
        (dataSize / 1024).toFixed(0) + " KB · " + db.projects.length + " projects · " + db.activities.length + " stages · " +
        db.raid.length + " RAID items · " + db.docs.length + " documents · " + db.items.length + " work items · " +
        db.allocations.length + " allocations · " + db.ledger.length + " cost postings"),

      h("hr", { class: "hr" }), h("div", { style: "height:18px" }),
      auditPanel()));
};

function exportAll(db) {
  download("/admin/export", "meridian-pmo-" + db.statusDate + ".json");
  toast("Book exported", "Full database as JSON");
}

function importAll() {
  const input = h("input", { type: "file", accept: "application/json,.json", style: "display:none" });
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (e) { return toast("Import failed", "That file is not valid JSON", true); }
      if (!parsed || !Array.isArray(parsed.projects))
        return toast("Import failed", "No project register found in that file", true);
      App.write("Book imported", (a) => a.post("/admin/import", { db: parsed }),
        { detail: parsed.projects.length + " projects" });
    };
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 60000);
}

function resetAll() {
  confirmDialog({
    title: "Reset to the seed book?",
    message: "Every change you have made is discarded and the opening portfolio is rebuilt.",
    detail: "Export first if you want to keep this state.",
    confirmLabel: "Reset everything", danger: true,
  }).then((ok) => {
    if (!ok) return;
    App.write("Portfolio reset", (a) => a.post("/admin/reset", {}),
      { detail: "The opening book has been rebuilt" });
  });
}
/* ── Data — export, import, reset ─────────────────────────────────────── */


/* ── Meetings (D-04) ──────────────────────────────────────────────── */
Views.meetings = (db) => meetingsView(db);

/* ── header actions ───────────────────────────────────────────────────
   R7.3 — a control the account has no authority for is absent, not
   greyed out. Each entry returns null when the account cannot do it, and
   the shell simply does not draw a button. */

const firstWritable = (db) => db.projects.find((p) => mayWrite(p)) ?? null;

export const HEADER_ACTIONS = {
  /* The permission probe needs a real site and programme to ask about —
     on an empty book the old probe asked about `undefined` and silently
     hid the button from everyone but admin (adoption committee B1). */
  portfolio: (db) => db.programmes.length && db.sites.length && App.can("project.create", {
    programme_id: db.programmes[0].id, site_id: db.sites[0].id,
    governance_level: App.me.role === "site" ? "site" : "group",
  }) ? { label: "New project", run: () => newProject(db) } : null,

  my: () => null,          // the personal surface reads; it does not create
  programmes: (db) => HEADER_ACTIONS.portfolio(db),
  mysite: (db) => HEADER_ACTIONS.portfolio(db),

  schedule: (db) => HEADER_ACTIONS.portfolio(db),

  project: (db) => {
    const p = Engine.project(db, App.ui.project);
    return p && may("change.raise", p) && !fromSdp(p)
      ? { label: "Raise change", run: () => newCR(db) } : null;
  },

  board: (db) => {
    const p = Engine.project(db, App.ui.boardProject) ?? firstWritable(db);
    return p && may("workitem.write", p)
      ? { label: "New item", run: () => newItem(db, p.id) } : null;
  },

  risk: (db) => firstWritable(db) || ["admin", "group"].includes(App.me.role)
    ? { label: "Raise item", run: () => newRaid(db, null) } : null,

  budget: (db) => {
    const p = db.projects.find((x) => may("cost.write", x));
    return p ? { label: "Book cost", run: () => bookCost(db, Engine.project(db, App.ui.project) ?? p) } : null;
  },

  change: (db) => HEADER_ACTIONS.project(db) ?? (firstWritable(db)
    ? { label: "Raise change", run: () => newCR(db) } : null),

  resources: (db) => {
    const p = db.projects.find((x) => may("allocation.write", x));
    return p ? { label: "Assign person", run: () => assignPerson(db, App.ui.project ?? p.id) } : null;
  },

  documents: (db) => firstWritable(db) || ["admin", "group"].includes(App.me.role)
    ? { label: "Add document", run: () => newDoc(db) } : null,

  meetings: () => null,   // the meeting screen carries its own controls

  reports: (db) => ({ label: "Export report", run: () => exportReportFromView(db) }),
  locations: (db) => ({ label: "Export book", run: () => exportAll(db) }),
  admin: (db) => App.isAdmin ? { label: "Export book", run: () => exportAll(db) } : null,
};

/* The reports view builds its own rag/blocks; the header shortcut just
   scrolls there rather than duplicating that derivation. */
function exportReportFromView(db) {
  go("#/reports");
  setTimeout(() => {
    const btn = document.querySelector('[data-export-report]');
    if (btn) btn.click();
    else toast("Open the report", "Use the Markdown button on the report itself");
  }, 60);
}

export const VIEWS = Views;
export { invalidateMeetings };


/* ── audit trail (R6.1–R6.3) ──────────────────────────────────────────
   The v4 build kept its trail inside the same mutable object it audited,
   capped at 400 rows and attributed to one hard-coded person. This reads
   the real table: append-only, attributed to the account that acted, and
   visible at group level and above. */

const auditState = { events: null, loading: false, filter: "" };

export function invalidateAudit() { auditState.events = null; }

function auditPanel() {
  if (!App.can("audit.read")) {
    return h("div", null,
      sectionHead("Audit trail", "not visible at this level"),
      h("p", { class: "small muted", style: "max-width:60ch" },
        "Every change in this system is recorded against the account that made it. " +
        "The trail is readable at group level and above."));
  }

  if (auditState.events === null && !auditState.loading) {
    auditState.loading = true;
    api.get("/audit?limit=200")
      .then((r) => { auditState.events = r.events; })
      .catch((e) => { auditState.events = []; reportError(e, "Could not load the audit trail"); })
      .finally(() => { auditState.loading = false; App.emit(); });
  }

  const events = auditState.events ?? [];
  const q = auditState.filter.trim().toLowerCase();
  const shown = (q
    ? events.filter((e) => (e.action + " " + e.detail + " " + e.user_label + " " + e.entity_id)
        .toLowerCase().includes(q))
    : events).slice(0, 80);

  return h("div", null,
    sectionHead("Audit trail",
      auditState.events === null ? "loading…" : events.length + " most recent entries",
      searchBox(auditState.filter, "Filter the trail",
        (v) => { auditState.filter = v; App.emit(); })),
    h("div", { style: "max-height:360px;overflow-y:auto" },
      shown.length
        ? shown.map((e) => h("div", { class: "audit" },
            h("time", null, String(e.at).slice(0, 10) + " " + String(e.at).slice(11, 16)),
            h("div", { style: "min-width:0;flex:1" },
              h("span", { class: "strong" }, e.action),
              e.detail ? h("span", { class: "muted" }, " — " + e.detail) : null,
              h("div", { class: "xs muted" },
                e.user_label + (e.entity_id ? " · " + e.entity + " " + e.entity_id : ""))),
            /* R-12 — a deletion carrying its full image can be replayed.
               Restoring is adding; the trail records the restoration too. */
            App.isAdmin && /deleted|removed|withdrawn/i.test(e.action) && e.before_json && e.before_json.id
              ? h("button", { class: "btn btn-xs", title: t("Re-create this row exactly as its image holds it"),
                  onClick: async () => {
                    const ok = await App.write(t("Restored from the trail"),
                      (a) => a.post("/audit/" + e.id + "/restore", {}), { detail: e.entity_id });
                    if (ok !== false) invalidateAudit();
                  } }, t("Restore"))
              : null))
        : h("p", { class: "small muted" },
            auditState.events === null ? "Reading the trail…" : "Nothing matches that filter.")));
}

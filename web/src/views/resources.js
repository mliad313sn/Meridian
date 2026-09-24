/**
 * RESOURCES AND COSTS — the screens of docs/41 wave B.
 *
 *   FX-08  each person's load against the part of each week they are
 *          actually available, the assignments that make it, the rates
 *          that price it;
 *   FX-09  a leveling PROPOSAL read from the server (which writes nothing
 *          to compute it), and the application of the moves a person
 *          ticks — each an audited activity update;
 *   FX-10  the S-curve and the estimate at completion three ways, each
 *          named by its formula, and the TCPI.
 *
 * Every figure comes from `shared/resources.js`; this file draws and asks
 * `App.can` — it decides nothing. Hooked into the Resources, Budget and
 * Portfolio views of index.js by one call each. Its sentences are short
 * on purpose: each is carried three times (EN key, FR, ES) over a
 * satellite link (S6's weight budget, D-41.03).
 */

import { h, dialog, formDialog, table, sectionHead, emptyState, tag, selectField, curveChart, legend, fold } from "../ui/kit.js";
import { App, go, reportError } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t, tData } from "../lib/i18n.js";
import { Engine, fmtDate, isoWeek, money, signedMoney, idx } from "../../../shared/engine.js";
import {
  resourceLoad, assignmentWork, plannedCost, forecasts, overallocationSignal,
} from "../../../shared/resources.js";

const WEEKS = 10;
/* The fields rbac reads, from the serialiser's shape (index.js asRow). */
const row = (p) => p && ({ id: p.id, programme_id: p.programme, site_id: p.site,
  governance_level: p.governanceLevel, closed: p.closed });
const personRow = (db, id) => {
  const p = Engine.person(db, id);
  return p ? { id: p.id, site_id: p.site } : undefined;
};
const projectOf = (db, activityId) => {
  const a = db.activities.find((x) => x.id === activityId);
  return a ? Engine.project(db, a.project) : null;
};
const canAssign = (db, x) => App.can("allocation.write",
  { project: row(projectOf(db, x.activity)), person: x.person ? personRow(db, x.person) : undefined });
const d1 = (v) => (Math.round(v * 10) / 10) + " " + t("d");
const m3 = (v) => money(v, 3);
const who = (db, x) => x.person ? Engine.personName(db, x.person) : tag(t("Role") + " · " + x.role, "tag-out");
const xBtn = (onClick) => h("button", { class: "btn btn-xs btn-ghost", "aria-label": t("Remove"), onClick }, "×");

/* ── FX-08 · load against effective availability ─────────────────── */

export function loadSection(db) {
  const load = resourceLoad(db, { weeks: WEEKS });
  const site = App.ui.resSite ?? "all";
  const rows = load.rows.filter((r) => (site === "all" || r.person.site === site) &&
    r.cells.some((c) => c.demand > 0));
  const over = rows.filter((r) => r.overWeeks > 0);
  const canLevel = db.projects.some((p) => App.can("schedule.level", { project: row(p) }));

  const heat = h("table", { class: "heat" },
    h("thead", null, h("tr", null, h("th", { class: "n" }, t("Person")),
      ...load.cols.map((w) => h("th", null, "W" + isoWeek(w))))),
    h("tbody", null, ...rows.map((r) => h("tr", null,
      h("td", { class: "n" },
        h("div", { class: "strong small" }, r.person.name),
        h("div", { class: "xs muted" }, r.fte.toFixed(2) + " FTE" + (r.person.rotation ? " · " + r.person.rotation : ""))),
      ...r.cells.map((c) => h("td", null, h("div", {
        class: "heat-c",
        title: fmtDate(c.week) + " · " + c.demand.toFixed(2) + " / " + c.available.toFixed(2) + " FTE",
        style: { background: c.over ? "var(--color-accent)" : c.demand > 0 ? "var(--color-neutral-200)" : "var(--color-neutral-100)",
          color: c.over ? "var(--on-solid)" : "var(--color-text)" },
      }, c.demand <= 0 ? "—" : c.ratio === null ? t("away") : Math.round(c.ratio * 100) + "%")))))));

  return h("section", { class: "sec", style: "margin-top:26px" },
    sectionHead(t("Load against effective availability"), t("work ÷ available FTE, absences deducted"),
      canLevel ? h("button", { class: "btn btn-sm", onClick: () => levelingDialog() }, t("Propose leveling")) : null),
    rows.length ? h("div", { class: "scrollx" }, heat) : emptyState(t("No assignments yet"), ""),
    over.length ? h("div", { class: "drop-hint", style: "margin-top:12px" },
      h("span", { class: "strong warn" }, t("Over-allocation") + ": "),
      over.map((r) => r.person.name + " (" + r.overWeeks + " W)").join(", ")) : null);
}

/** The attention-list item (Portfolio rail), or null. */
export function overallocationItem(db, projects) {
  const s = overallocationSignal(db, projects, { weeks: WEEKS });
  if (!s) return null;
  return { kind: t("Over-allocation"), urgent: false, route: s.route, go: () => go(s.route),
    title: s.count + " " + t("person(s) over their availability"),
    meta: s.people.slice(0, 3).join(", ") + " · " + s.weeks + " W" };
}

/* ── FX-09 · the proposal and its application ────────────────────── */

async function levelingDialog() {
  let p;
  try { p = await api.get("/leveling/proposal?weeks=12"); }
  catch (e) { reportError(e, t("Leveling proposal")); return; }
  const chosen = new Set(p.moves.map((m) => m.activity));
  const range = (r) => h("span", { class: "mono small" }, fmtDate(r.start) + " → " + fmtDate(r.end));
  const body = h("div", null,
    h("p", { class: "small", style: "margin:0 0 12px" }, t("Nothing has moved yet.")),
    p.moves.length ? table({ cols: [
      { key: "x", label: "", width: "28px", get: (m) => h("input", { type: "checkbox", checked: true, "aria-label": m.activity,
        onChange: (e) => (e.target.checked ? chosen.add(m.activity) : chosen.delete(m.activity)) }) },
      { key: "a", label: t("Activity"), get: (m) => h("div", null, h("div", { class: "strong small" }, m.name),
          h("div", { class: "xs muted" }, m.project + " · " + m.activity)) },
      { key: "f", label: t("From"), get: (m) => range(m.from) },
      { key: "t", label: t("To"), get: (m) => range(m.to) },
      { key: "r", label: t("Why"), get: (m) => h("span", { class: "small" }, tData(m.reason)) },
    ], rows: p.moves }) : emptyState(t("Nothing to propose"), ""),
    ...p.effects.map((e) => h("div", { class: "small", style: "margin-top:8px" }, e.name + " · " + t("finish") + " " +
      fmtDate(e.finishBefore) + " → " + fmtDate(e.finishAfter) + (e.slipDays ? " (+" + d1(e.slipDays) + ")" : ""))));

  dialog({
    title: t("Leveling proposal"), kicker: p.before + " → " + p.after + " " + t("over-allocated week(s)"), wide: true, body,
    actions: (shut) => [
      h("button", { class: "btn", onClick: () => shut() }, t("Close")),
      p.moves.length ? h("button", { class: "btn btn-primary", onClick: async () => {
        const moves = p.moves.filter((m) => chosen.has(m.activity))
          .map((m) => ({ activity: m.activity, start: m.to.start, end: m.to.end, version: m.version }));
        if (moves.length && await App.write(t("Leveling applied"), (x) => x.post("/leveling/apply", { moves }),
          { touch: ["activities"], detail: String(moves.length) })) shut();
      } }, t("Apply selected moves")) : null,
    ],
  });
}

/* ── FX-08 · assignments ─────────────────────────────────────────── */

export function assignmentsSection(db) {
  const acts = new Map(db.activities.map((a) => [a.id, a]));
  const site = App.ui.resSite ?? "all";
  const list = (db.assignments ?? []).filter((x) => acts.has(x.activity) && (site === "all" ||
    (x.person ? Engine.person(db, x.person)?.site : Engine.project(db, acts.get(x.activity).project)?.site) === site));
  const canAdd = db.projects.some((p) => App.can("allocation.write", { project: row(p) }));
  const cols = [
    { key: "a", label: t("Activity"), get: (x) => { const a = acts.get(x.activity); return h("div", null,
        h("div", { class: "strong small" }, a.name),
        h("div", { class: "xs muted" }, a.project + " · " + fmtDate(a.start) + " → " + fmtDate(a.end))); } },
    { key: "w", label: t("Who"), get: (x) => who(db, x) },
    { key: "u", label: t("Units"), align: "r", get: (x) => x.units + "%" },
    { key: "k", label: t("Work"), align: "r", get: (x) => {
        const w = assignmentWork(x, acts.get(x.activity));
        return d1(w.work) + (w.overridden ? " *" : "");
      } },
    { key: "c", label: t("Planned cost"), align: "r", get: (x) => {
        const pc = plannedCost({ ...db, assignments: [x] }, acts.get(x.activity));
        return pc.complete ? m3(pc.cost) : "—";
      } },
    { key: "x", label: "", align: "r", get: (x) => !canAssign(db, x) ? null
        : h("div", { class: "btn-row", style: "justify-content:flex-end" },
          h("button", { class: "btn btn-xs", onClick: () => editAssignment(db, x) }, t("Edit")),
          xBtn(() => removeAssignment(db, x))) },
  ];
  return h("section", { class: "sec", style: "margin-top:26px" },
    sectionHead(t("Assignments"), t("* typed work"),
      canAdd ? h("button", { class: "btn btn-sm", onClick: () => editAssignment(db, null) }, t("Assign")) : null),
    list.length ? table({ cols, rows: list })
      : emptyState(t("No assignments yet"), ""));
}

function removeAssignment(db, x) {
  return App.write(t("Assignment removed"), (a) => a.del("/assignments/" + x.id),
    { touch: ["assignments"], detail: x.activity });
}

function editAssignment(db, x) {
  const ids = new Set(db.projects.filter((p) => App.can("allocation.write", { project: row(p) })).map((p) => p.id));
  const activities = db.activities.filter((a) => ids.has(a.project));
  const fields = [
    ...(x ? [] : [{ key: "activity", label: t("Activity"), type: "select", required: true, span: 2,
      options: [{ value: "", label: "—" }, ...activities.map((a) => ({ value: a.id, label: a.project + " · " + a.name }))] }]),
    { key: "person", label: t("Person"), type: "select", value: x?.person ?? "",
      options: [{ value: "", label: "—" }, ...db.people.filter((p) => p.active !== false).map((p) => ({ value: p.id, label: p.name }))] },
    { key: "role", label: t("Role"), value: x?.role ?? "", hint: t("A person or a role, never both.") },
    { key: "units", label: t("Units (%)"), type: "number", min: 1, max: 200, step: 5, required: true, value: x?.units ?? 100,
      hint: t("50 = half-time, 200 = two people.") },
    { key: "work", label: t("Work (person-days)"), type: "number", min: 0, step: 0.5, value: x?.work ?? "",
      hint: t("Empty = duration × units.") },
    { key: "note", label: t("Note"), type: "textarea", span: 2, value: x?.note ?? "", advanced: true,
      hint: t("Shifts, conditions.") },
  ];
  formDialog({
    title: x ? t("Edit") : t("Assign"), kicker: x ? x.activity : "", fields, saveLabel: t("Save"),
    onSave: (v) => {
      const role = String(v.role ?? "").trim();
      if (!v.person === !role) { App.lastWriteError = new Error(t("A person or a role, never both.")); return false; }
      const body = { person: v.person || null, role: v.person ? null : role, units: +v.units,
        work: v.work === "" || v.work == null ? null : +v.work, note: v.note ?? "" };
      return x
        ? App.write(t("Assignment updated"), (a) => a.patch("/assignments/" + x.id, { ...body, version: x.version }),
            { touch: ["assignments"], rethrow: true })
        : App.write(t("Assignment added"), (a) => a.post("/assignments", { ...body, activity: v.activity }),
            { touch: ["assignments"], rethrow: true });
    },
  });
}

/* ── FX-10 · rates ───────────────────────────────────────────────── */

export function ratesSection(db) {
  const rates = db.rates ?? [];
  const may = App.can("rate.write");
  const cols = [
    { key: "w", label: t("Who"), get: (r) => who(db, r) },
    { key: "r", label: t("Day rate"), align: "r", get: (r) => r.dayRate + " " + r.currency },
    { key: "d", label: t("From"), get: (r) => fmtDate(r.from) + " → " + (r.to ? fmtDate(r.to) : "…") },
    { key: "x", label: "", align: "r", get: (r) => !may ? null
        : h("div", { class: "btn-row", style: "justify-content:flex-end" },
          h("button", { class: "btn btn-xs", onClick: () => editRate(db, r) }, t("Edit")),
          xBtn(() => removeRate(r))) },
  ];
  return fold(t("Rates"), t("person › role › directory"), false,
    may ? h("button", { class: "btn btn-sm", style: "margin-bottom:8px", onClick: () => editRate(db, null) }, t("Add rate")) : null,
    rates.length ? table({ cols, rows: rates }) : emptyState(t("No rates yet"), ""));
}

function removeRate(r) {
  return App.write(t("Rate removed"), (a) => a.del("/rates/" + r.id), { touch: ["rates"], detail: r.id });
}

function editRate(db, r) {
  formDialog({
    title: r ? t("Edit") : t("Add rate"), kicker: t("Rates"), saveLabel: t("Save"),
    fields: [
      { key: "person", label: t("Person"), type: "select", value: r?.person ?? "",
        options: [{ value: "", label: "—" }, ...db.people.map((p) => ({ value: p.id, label: p.name }))] },
      { key: "role", label: t("Role"), value: r?.role ?? "", hint: t("A person or a role, never both.") },
      { key: "dayRate", label: t("Day rate"), type: "number", min: 0, step: 10, required: true, value: r?.dayRate ?? "",
        hint: t("Whole units of the currency.") },
      { key: "currency", label: t("Currency"), value: r?.currency ?? "USD" },
      { key: "fx", label: "FX", type: "number", min: 0, step: 0.0001, value: r?.fx ?? 1, advanced: true,
        hint: t("Per unit, in the reporting currency.") },
      { key: "from", label: t("From"), type: "date", required: true, value: r?.from ?? App.db.statusDate },
      { key: "to", label: t("To"), type: "date", value: r?.to ?? "" },
      { key: "note", label: t("Note"), type: "textarea", span: 2, value: r?.note ?? "", advanced: true,
        hint: t("Its source (contract).") },
    ],
    onSave: (v) => {
      const body = { person: v.person || null, role: v.person ? null : String(v.role ?? "").trim(), dayRate: +v.dayRate,
        currency: v.currency, fx: +v.fx || 1, from: v.from, to: v.to || null, note: v.note ?? "" };
      return r
        ? App.write(t("Rate updated"), (a) => a.patch("/rates/" + r.id, { ...body, version: r.version }), { touch: ["rates"], rethrow: true })
        : App.write(t("Rate set"), (a) => a.post("/rates", body), { touch: ["rates"], rethrow: true });
    },
  });
}

/* ── FX-10 · the S-curve and the three EACs ──────────────────────── */

export function costSection(db, list) {
  if (!list.length) return null;
  const pid = list.some((p) => p.id === App.ui.costProject) ? App.ui.costProject
    : (list.find((p) => p.budget > 0) ?? list[0]).id;
  const f = forecasts(db, pid);
  const head = sectionHead(t("Estimate at completion, three ways"), "",
    selectField(t("Project"), pid, list.map((x) => ({ value: x.id, label: x.id + " · " + x.name })),
      (v) => App.set({ costProject: v }), "230px"));
  /* MER-04 — no budget: no figure, and the page says so. */
  if (f.bac === null) return h("div", null, head, emptyState(t("Nothing measured"), "BAC — (MER-04)"));
  /* The module says why at length (shared/resources.js); the screen says
     it in three words, which is all a row has room for. */
  const early = t("too early to measure");
  const whyOf = (m) => m.key !== "bottomUp" ? early
    : f.gap === "none" ? t("no costed assignment") : f.gap === "partial" ? t("not every activity is costed") : t("a rate is missing");
  return h("div", null, head,
    table({ cols: [
      { key: "m", label: t("Method"), get: (m) => h("span", { class: "mono small" }, m.label) },
      { key: "v", label: "EAC", align: "r", get: (m) => m.value === null
          ? h("span", { class: "small muted" }, "— " + whyOf(m)) : h("span", { class: "mono strong" }, m3(m.value)) },
      { key: "vac", label: "VAC", align: "r", get: (m) => m.value === null ? "—" : signedMoney(f.bac - m.value) },
    ], rows: f.methods }),
    h("div", { class: "small", style: "margin-top:10px" },
      "TCPI (BAC) " + idx(f.tcpi) + " · TCPI (EAC) " + idx(f.tcpiEac) +
      " · " + t("Planned cost") + " " + (f.plannedCost === null ? "—" : m3(f.plannedCost)) +
      (f.etc === null ? "" : " · ETC " + m3(f.etc))),
    h("div", { style: "height:14px" }),
    /* BCWS / BCWP / ACWP by month — `costCurve` is this same curve
       (Engine.curve) plus the bottom-up planned cost, which the text
       above already totals; the chart reads the engine directly. */
    curveChart(Engine.curve(db, [Engine.project(db, pid)])),
    legend([
      { color: "var(--color-neutral-500)", label: "BCWS" },
      { color: "var(--color-text)", label: "BCWP" },
      { color: "var(--color-accent)", label: "ACWP" },
    ]));
}

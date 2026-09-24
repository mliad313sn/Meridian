/**
 * FX-12 (docs/41) — the Scenarios view: « et si… ? », side by side.
 *
 * The list of the group's what-if copies, the editor of the one selected,
 * and its comparison with the live book. The numbers are the server's
 * (GET /scenarios/:id/compare runs shared/scenario.js on the book this
 * reader may see); this file draws them and decides nothing. Every
 * control asks shared/rbac.js the question the server will ask (R7.3) —
 * `canApplyScenario` included, so the screen says WHY a scenario cannot
 * be applied yet, in the server's words.
 *
 * Nothing here writes the live book except « Apply », which the server
 * refuses without a decision ratified by someone independent (D-41.02).
 */

import { h, formDialog, confirmDialog, table, sectionHead, tag, kpiStrip, emptyState } from "../ui/kit.js";
import { App, reportError } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t, tData } from "../lib/i18n.js";
import { Engine, fmtDate, money, signedMoney, idx } from "../../../shared/engine.js";
import { canApplyScenario } from "../lib/permissions.js";

const S = { list: null, loading: false, selected: null, cmp: null, key: null, all: false, who: null };

function load() {
  if (S.loading) return;
  S.loading = true;
  api.get("/scenarios")
    .then((r) => { S.list = r.scenarios ?? []; })
    .catch((e) => { S.list = []; reportError(e, t("Scenarios")); })
    .finally(() => { S.loading = false; App.emit(); });
}

function loadCompare(sc) {
  const key = sc.id + sc.version + sc.changes.map((c) => c.id + c.version).join();
  if (S.key === key) return;
  S.key = key; S.cmp = null;
  api.get("/scenarios/" + sc.id + "/compare")
    .then((r) => { if (S.key === key) S.cmp = r; })
    .catch((e) => { S.cmp = { error: e.message }; })
    .finally(() => App.emit());
}

async function act(label, work, detail) {
  const ok = await App.write(label, work, { detail, refresh: false });
  if (ok !== false) { S.list = null; S.key = null; }
  App.emit();
  return ok;
}

const KIND = { shift: "Defer or accelerate", cancel: "Cancel", budget: "Budget", envelope: "Envelope (M)", weight: "Weight" };
const INPUT = { value: "Claimed value", confidence: "Confidence", exposure: "Exposure", capacity: "Capacity" };
const name = (db, id) => (id ? (Engine.project(db, id)?.name ?? id) : "—");
const sgn = (n, u = "") => (n == null ? "—" : (n > 0 ? "+" : "") + n + u);
const days = (n) => (n ? sgn(n, " d") : "—");
const md = (n) => (n ? signedMoney(n) : "—");
const yn = (v) => (v == null ? "—" : v ? "✓" : "✗");
const pair = (a, b, f = (v) => (v == null ? "—" : String(v))) => f(a) + " → " + f(b);
const date = (v) => (v ? fmtDate(v) : "—");

function describe(db, c) {
  if (c.kind === "shift") return name(db, c.project) + " · " + sgn(c.weeks, " wk");
  if (c.kind === "budget") return name(db, c.project) + " · " + money(c.amount);
  if (c.kind === "envelope") return money(c.amount);
  if (c.kind === "weight") return t(INPUT[c.input] ?? c.input) + " · " + c.weight;
  return name(db, c.project);
}

/* ── the view ─────────────────────────────────────────────────────── */

export function scenariosView(db) {
  if (!App.can("scenario.read")) {
    return h("div", { class: "card" }, emptyState(t("Scenarios"), t("Scenarios are the group's what-if copies of the portfolio; they never change the live book.")));
  }
  if (S.who !== App.me?.id) Object.assign(S, { who: App.me?.id, list: null, selected: null, key: null });
  if (S.list === null) load();
  const list = S.list ?? [];
  const sel = list.find((x) => x.id === S.selected) ?? list[0] ?? null;
  if (sel) loadCompare(sel);

  return h("div", null,
    h("div", { class: "card" },
      sectionHead(t("Scenarios"), t("what-if copies of the portfolio, never written to the live book"),
        App.can("scenario.write") ? h("button", { class: "btn btn-sm btn-primary", onClick: () => editScenario(null) }, t("New scenario")) : null),
      table({
        cols: [
          { key: "n", label: t("Scenario"), get: (x) => h("span", { class: "strong small" }, x.id + " · " + x.name) },
          { key: "s", label: t("Status"), get: (x) => tag(t(x.status), x.status === "Applied" ? "tag-ink" : "tag-out") },
          { key: "c", label: "#", align: "r", get: (x) => String(x.changes.length) },
          { key: "d", label: t("Decision"), get: (x) => x.decisions?.length ? x.decisions[0].id + " · " + t(x.decisions[0].status) : "—" },
          { key: "b", label: t("Created"), get: (x) => (x.createdByName ?? "—") + " · " + date(x.createdOn) },
        ],
        rows: list,
        onRow: (x) => { S.selected = x.id; App.emit(); },
        selected: (x) => sel && x.id === sel.id,
        empty: t("No scenario yet — draft one to ask what if, without touching the live book."),
      })),
    sel ? editor(db, sel) : null,
    sel ? comparison(db, sel) : null);
}

/* ── the editor ───────────────────────────────────────────────────── */

function editor(db, sc) {
  const mayWrite = App.can("scenario.write");
  const canEdit = sc.status === "Draft" && mayWrite;
  const d = sc.decisions?.find((x) => x.status === "Ratified") ?? sc.decisions?.[0] ?? null;
  const verdict = canApplyScenario(App.me, { decision: d, recorderPerson: d?.recorderPerson, authorPerson: sc.createdByPerson });
  const canApplyIt = App.can("scenario.apply") && ["Draft", "Proposed"].includes(sc.status);

  return h("div", { class: "card", style: "margin-top:14px" },
    sectionHead(sc.id + " · " + sc.name, t(sc.status),
      canEdit ? h("button", { class: "btn btn-sm", onClick: () => editScenario(sc) }, t("Edit")) : null,
      canEdit && sc.changes.length ? h("button", { class: "btn btn-sm", onClick: () => proposeScenario(db, sc) }, t("Propose for decision")) : null,
      canApplyIt ? h("button", { class: "btn btn-sm btn-primary", onClick: () => applyScenarioNow(sc) }, t("Apply to the live book")) : null,
      mayWrite && sc.status === "Proposed" ? h("button", { class: "btn btn-sm btn-ghost", onClick: () => withdrawScenario(sc) }, t("Withdraw")) : null,
      canEdit && !sc.decisions?.length ? h("button", { class: "btn btn-sm btn-ghost", onClick: () => removeScenario(sc) }, t("Remove")) : null),
    canApplyIt && !verdict.ok ? h("p", { class: "small muted" }, "⚠ " + tData(verdict.why)) : null,
    canEdit ? h("div", { class: "btn-row", style: "margin-bottom:10px;flex-wrap:wrap" },
      ...Object.keys(KIND).map((k) => h("button", { class: "btn btn-xs", onClick: () => editChange(db, sc, k, null) }, "+ " + t(KIND[k])))) : null,
    table({
      cols: [
        { key: "k", label: t("Change"), get: (c) => h("span", { class: "strong small" }, t(KIND[c.kind])) },
        { key: "w", label: "", get: (c) => h("div", { class: "small" }, describe(db, c), c.note ? h("div", { class: "xs muted" }, c.note) : null) },
        { key: "x", label: "", align: "r", get: (c) => !canEdit ? null : h("div", { class: "btn-row", style: "justify-content:flex-end" },
            c.kind !== "cancel" ? h("button", { class: "btn btn-xs btn-ghost", onClick: () => editChange(db, sc, c.kind, c) }, t("Edit")) : null,
            h("button", { class: "btn btn-xs btn-ghost", onClick: () => removeChange(c) }, t("Remove"))) },
      ],
      rows: sc.changes,
      empty: t("No change yet."),
    }));
}

function editScenario(sc) {
  formDialog({
    title: sc ? sc.id : t("New scenario"), kicker: t("Scenario"),
    fields: [
      { key: "name", label: t("Name"), required: true, span: 2, value: sc?.name ?? "", hint: t("The question it asks, in a few words.") },
      { key: "note", label: t("Note"), type: "textarea", span: 2, value: sc?.note ?? "", hint: t("Why it is asked — for whoever reads the comparison.") },
    ],
    onSave: (v) => act(t("Scenario saved"),
      (a) => (sc ? a.patch("/scenarios/" + sc.id, { name: v.name, note: v.note, version: sc.version })
        : a.post("/scenarios", { name: v.name, note: v.note }).then((r) => { S.selected = r.id; return r; })), v.name),
  });
}

function editChange(db, sc, kind, c) {
  const f = [];
  if (!c && kind !== "envelope" && kind !== "weight") {
    const open = db.projects.filter((p) => !p.closed).map((p) => ({ value: p.id, label: p.id + " · " + p.name }));
    f.push({ key: "project", label: t("Project"), type: "select", required: true, span: 2, value: open[0]?.value ?? "", options: open,
      hint: t("If the project changes before the scenario is applied, applying it is refused.") });
  }
  if (kind === "shift") {
    f.push({ key: "weeks", label: t("Weeks"), type: "number", step: 1, min: -104, max: 104, required: true, value: c?.weeks ?? 13,
      hint: t("+ defers, − accelerates. Only work after the status date moves; the baseline never does.") });
  }
  if (kind === "budget" || kind === "envelope") {
    f.push({ key: "amount", label: t(kind === "budget" ? "Budget" : "Envelope (M)"), type: "number", step: "any", min: 0, required: true,
      value: c?.amount ?? "", hint: t("In millions — the new total, not an increment.") });
  }
  if (kind === "weight") {
    if (!c) f.push({ key: "input", label: t("Weight"), type: "select", value: "value",
      options: Object.entries(INPUT).map(([value, l]) => ({ value, label: t(l) })) });
    f.push({ key: "weight", label: "0–100", type: "number", step: 1, min: 0, max: 100, required: true, value: c?.weight ?? 40 });
  }
  f.push({ key: "note", label: t("Note"), type: "textarea", span: 2, value: c?.note ?? "",
    hint: kind === "cancel" ? t("Spend stops at what is spent; future allocations and benefits are released.")
      : t("What this change assumes.") });

  formDialog({
    title: t(KIND[kind]), kicker: sc.id, fields: f,
    onSave: (v) => {
      const body = { note: v.note ?? "", weeks: v.weeks, amount: v.amount, weight: v.weight };
      return c ? act(t("Scenario saved"), (a) => a.patch("/scenario-changes/" + c.id, { ...body, version: c.version }))
        : act(t("Scenario saved"), (a) => a.post("/scenarios/" + sc.id + "/changes", { ...body, kind, project: v.project, input: v.input }));
    },
  });
}

async function removeChange(c) {
  if (await confirmDialog({ title: t("Remove"), message: t(KIND[c.kind]), confirmLabel: t("Remove") })) {
    act(t("Scenario saved"), (a) => a.del("/scenario-changes/" + c.id));
  }
}

async function removeScenario(sc) {
  if (await confirmDialog({ title: t("Remove"), message: sc.name, danger: true, confirmLabel: t("Remove") })) {
    act(t("Scenario saved"), (a) => a.del("/scenarios/" + sc.id), sc.name);
  }
}

async function withdrawScenario(sc) {
  if (await confirmDialog({ title: t("Withdraw"), message: sc.name, confirmLabel: t("Withdraw") })) {
    act(t("Scenario saved"), (a) => a.post("/scenarios/" + sc.id + "/withdraw", { version: sc.version }), sc.name);
  }
}

function proposeScenario(db, sc) {
  formDialog({
    title: t("Propose for decision"), kicker: sc.id,
    fields: [
      { key: "headline", label: t("Decision"), required: true, span: 2, value: sc.name,
        hint: t("Recorded in the decision register; the scenario is frozen as decided.") },
      { key: "rationale", label: t("Note"), type: "textarea", span: 2, value: sc.note ?? "", hint: t("Why it is asked — for whoever reads the comparison.") },
      { key: "decidedBy", label: t("Decided by"), type: "select", value: App.me.personId ?? "",
        options: db.people.map((p) => ({ value: p.id, label: p.name })),
        hint: t("Someone else ratifies it: not the decider, not the recorder, not the scenario's author.") },
    ],
    onSave: (v) => act(t("Scenario saved"), (a) => a.post("/decisions", {
      headline: v.headline, rationale: v.rationale, decidedBy: v.decidedBy, status: "Proposed", scenarioId: sc.id }), sc.name),
  });
}

async function applyScenarioNow(sc) {
  if (await confirmDialog({ title: t("Apply to the live book"), message: sc.name,
    detail: t("Each change becomes its own audited write, under the version it was drafted against."), confirmLabel: t("Apply to the live book") })) {
    act(t("Apply to the live book"), (a) => a.post("/scenarios/" + sc.id + "/apply", { version: sc.version }), sc.name);
  }
}

/* ── the comparison ───────────────────────────────────────────────── */

function comparison(db, sc) {
  const c = S.cmp;
  if (!c || c.error) return h("div", { class: "card", style: "margin-top:14px" }, h("p", { class: "small muted" }, c?.error ?? "…"));
  const L = c.totals.live, X = c.totals.scenario, D = c.totals.delta;
  return h("div", { class: "card", style: "margin-top:14px" },
    sectionHead(t("Live and scenario, side by side"), date(c.asAt)),
    /* The tile holds the scenario's number; its note, the live one and
       the difference — "live → scenario" in the tile's type size does not
       fit a column. */
    kpiStrip([
      ["Projects", "projects"], ["BAC", "bac", money], ["EAC", "eac", money],
      ["Room in the envelope", "headroom", money], ["Above the line", "aboveLine"],
      ["Expected benefit", "expectedBenefit", money], ["Peak FTE", "peakFte", idx], ["Last finish", "lastFinish", date],
    ].map(([label, k, f = (v) => (v == null ? "—" : String(v))]) => ({
      label, value: f(X[k]),
      note: "← " + f(L[k]) + (D[k] ? "  (" + (k === "lastFinish" ? days(D[k]) : f === money ? md(D[k]) : sgn(D[k])) + ")" : ""),
      accent: k === "headroom" && X[k] != null && X[k] < 0,
    }))),
    sectionHead(t("Projects"), "",
      h("button", { class: "btn btn-xs btn-ghost", onClick: () => { S.all = !S.all; App.emit(); } }, S.all ? "Δ" : t("Show all"))),
    table({
      cols: [
        { key: "p", label: t("Project"), get: (r) => h("span", { class: "strong small" }, r.id + " · " + r.name + (r.scenario.state === "Cancelled" ? " ✗" : "")) },
        { key: "f", label: t("Finish"), get: (r) => pair(r.live.finish, r.scenario.finish, date) + " (" + days(r.delta.finishDays) + ")" },
        { key: "b", label: t("Budget"), align: "r", get: (r) => md(r.delta.budget) },
        { key: "e", label: "EAC", align: "r", get: (r) => md(r.delta.eac) },
        { key: "r", label: "#", align: "c", get: (r) => pair(r.live.rank, r.scenario.rank) },
        { key: "l", label: t("Above the line"), align: "c", get: (r) => pair(yn(r.live.aboveLine), yn(r.scenario.aboveLine)) },
        { key: "v", label: t("Envelope (M)"), align: "c", get: (r) => pair(yn(r.live.inEnvelope), yn(r.scenario.inEnvelope)) },
      ],
      rows: S.all ? c.rows : c.rows.filter((r) => r.changed),
      empty: t("No change yet."),
    }),
    sectionHead(t("Capacity"), "FTE"),
    table({
      cols: [
        { key: "m", label: "", get: (m) => m.month },
        { key: "p", label: t("Pool"), align: "r", get: (m) => idx(m.pool) },
        { key: "l", label: t("Live"), align: "r", get: (m) => idx(m.live) },
        { key: "s", label: t("Scenario"), align: "r", get: (m) => h("span", { class: m.scenario > m.pool ? "strong" : "" }, idx(m.scenario)) },
      ],
      rows: c.capacity,
    }),
    c.benefits.length ? table({
      cols: [
        { key: "b", label: t("Benefits"), get: (b) => name(db, b.project) + " · " + b.title },
        { key: "d", label: "", get: (b) => (b.withdrawn ? t("Withdrawn") : pair(b.live, b.scenario, date) + " (" + days(b.days) + ")") },
      ],
      rows: c.benefits,
    }) : null);
}

/**
 * SPRINTS — the board's agile layer (docs/41 FX-14, seat S3).
 *
 * Everything the board needs to run in sprints, in one module so the
 * board view only calls in: a sprint filter, sprint planning (backlog →
 * sprint), start and close, velocity, a burndown for the sprint and a
 * burnup for the project — the charts drawn by hand in SVG with `s()`,
 * no library (D-41.03).
 *
 * The arithmetic is shared/agile.js, the same the server and the tests
 * run. Authority is asked of rbac through `App.can("iteration.write")`:
 * a control the account may not use is absent, not greyed (R7.3).
 */

import { h, s, formDialog, confirmDialog, sectionHead, kpiStrip, tag, legend, emptyState, selectField } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { t } from "../lib/i18n.js";
import { fmtDate, iso, addDays } from "../../../shared/engine.js";
import { velocity, burndown, burnup, pointsOf, isDone } from "../../../shared/agile.js";

/** t() with {named} slots: the sentence is translated whole, then filled. */
const tf = (key, vars) => Object.entries(vars).reduce((o, [k, v]) => o.split("{" + k + "}").join(v), t(key));

export const sprintsOf = (db, projectId) => (db.iterations ?? []).filter((x) => x.project === projectId);
const canPlan = (db, id) => {
  const p = db.projects.find((x) => x.id === id);
  return !!p && App.can("iteration.write", { project: { id, governance_level: p.governanceLevel,
    programme_id: p.programme, site_id: p.site } });
};
const STATE = { planned: "Planned", active: "Active", closed: "Closed" };
const named = (x) => x.name + " · " + t(STATE[x.state]);
const pts = (items) => items.reduce((n, i) => n + (pointsOf(i) ?? 0), 0);
const BACKLOG = () => ({ value: "", label: t("Backlog — in no sprint") });

/* ── board hooks ─────────────────────────────────────────────────── */

/** The sprint filter on the board: all work, the backlog, or one sprint. */
export function sprintSelect(db, projectId) {
  const list = sprintsOf(db, projectId);
  return list.length ? selectField(t("Sprint"), App.ui.boardSprint ?? "",
    [{ value: "", label: t("All work") }, { ...BACKLOG(), value: "backlog" }]
      .concat(list.map((x) => ({ value: x.id, label: named(x) }))),
    (v) => App.set({ boardSprint: v }), "200px") : null;
}

/** Whether an item is in the board's sprint filter. */
export function inSprint(item) {
  const f = App.ui.boardSprint;
  return !f || (f === "backlog" ? !item.iteration : item.iteration === f);
}

/** The item dialog's two planning fields: its sprint and the stage it delivers. */
export function itemPlanningFields(db, it, projectId) {
  const project = it ? it.project : projectId;
  return [
    { key: "iteration", label: t("Sprint"), type: "select", value: it?.iteration ?? "",
      hint: t("Empty is the backlog. A closed sprint takes no new item."),
      options: [BACKLOG()].concat(sprintsOf(db, project)
        .filter((x) => x.state !== "closed" || x.id === it?.iteration).map((x) => ({ value: x.id, label: named(x) }))) },
    { key: "activity", label: t("Delivers stage"), type: "select", value: it?.activity ?? "",
      hint: t("The stage this item delivers. A stage measured from its items reads its progress from their points."),
      options: [{ value: "", label: "—" }]
        .concat(db.activities.filter((a) => a.project === project).map((a) => ({ value: a.id, label: a.name }))) },
  ];
}
export const itemPlanningBody = (v) => ({ iteration: v.iteration || null, activity: v.activity || null });

/** The stage dialog: the hybrid option, and a % that is typed only when it is off. */
export function stageProgressField(a) {
  const m = a.progressItems ?? {};
  return { key: "progressFromItems", label: t("Measure progress from the board"), type: "checkbox", span: 2,
    value: a.progressFromItems === true,
    hint: a.progressFromItems
      ? tf("Now {pct}%: {done} of {total} points done. The typed {reported}% returns if you turn this off.",
        { pct: a.pct, done: m.done ?? 0, total: m.total ?? 0, reported: a.reportedPct })
      : t("On: done points ÷ total points of the work items linked to this stage, instead of the typed %.") };
}
/** What to send: the % only when it is typed, before and after this save. */
export const stageProgressBody = (a, v) => (v.progressFromItems || a.progressFromItems
  ? { progressFromItems: !!v.progressFromItems } : { progressFromItems: false, pct: +v.pct });

/* ── the panel under the board ──────────────────────────────────── */

export function sprintPanel(db, projectId) {
  const p = db.projects.find((x) => x.id === projectId);
  if (!p) return h("section", { class: "sec" }, sectionHead("Sprints"),
    emptyState(t("Choose one project"), t("Sprints belong to a project: pick one in the Board selector.")));
  const may = canPlan(db, p.id);
  const list = sprintsOf(db, p.id);
  const items = db.items.filter((i) => i.project === p.id);
  const active = list.find((x) => x.state === "active");
  const focus = list.find((x) => x.id === App.ui.boardSprint) ?? active ?? list.find((x) => x.state === "planned");
  const v = velocity(list, p.id);
  /* The later of the book's status date and today: an item moved to Done
     this morning is on the board already, and a chart that stopped at a
     status date set last week would contradict the card beside it. */
  const today = [db.statusDate, iso(new Date())].sort().pop();
  const bd = focus && burndown(focus, items, today);
  const bu = burnup(items, p.id, today);

  return h("section", { class: "sec", "aria-label": t("Sprints") },
    sectionHead("Sprints", p.id,
      may ? h("button", { class: "btn btn-sm", onClick: () => editSprint(db, p, null) }, t("New sprint")) : null),
    kpiStrip([
      { label: "Velocity", value: v.average === null ? "—" : String(Math.round(v.average * 10) / 10),
        note: v.basis ? tf("points per sprint, last {n} closed", { n: v.basis }) : t("no sprint closed yet") },
      { label: "Active sprint", value: active ? active.name : "—",
        note: active ? fmtDate(active.start) + " → " + fmtDate(active.end) : "" },
      { label: "Remaining", value: bd ? String(bd.remaining) : "—", note: bd ? focus.name + " · " + bd.scope : "" },
      { label: "Not estimated", value: String(items.filter((i) => pointsOf(i) === null).length),
        note: t("items with no points are in no chart") },
    ]),
    list.length ? h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" },
      h("tbody", null, ...list.map((x) => {
        const mine = items.filter((i) => i.iteration === x.id);
        return h("tr", null,
          h("td", null, h("div", { class: "strong" }, x.name), h("div", { class: "xs muted" }, x.goal)),
          h("td", { class: "mono small" }, fmtDate(x.start) + " → " + fmtDate(x.end)),
          h("td", null, tag(t(STATE[x.state]), x.state === "active" ? "tag-accent" : x.state === "closed" ? "tag-ink" : "tag-out")),
          h("td", { class: "mono small" }, x.state === "closed" ? tf("{n} delivered", { n: x.donePoints })
            : pts(mine.filter(isDone)) + " / " + pts(mine)),
          h("td", { class: "r", style: "white-space:nowrap" }, ...sprintActions(db, p, x, list)));
      })))) : emptyState(t("No sprint yet"), t("A project without sprints works exactly as before.")),
    focus && focus.state !== "closed" ? planning(p, focus, items, may) : null,
    h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:18px" },
      bd ? chart(t("Burndown") + " · " + focus.name, bd.scope, bd.series,
        [["ideal", "var(--color-neutral-400)", "Ideal"], ["remaining", "var(--color-text)", "Remaining"]], note(bd)) : null,
      bu.series.length ? chart(t("Burnup") + " · " + p.id, bu.scope, bu.series,
        [["scope", "var(--color-neutral-500)", "Scope"], ["done", "var(--color-text)", "Done"]], note(bu)) : null,
      v.sprints.length ? chart(t("Velocity"), Math.max(...v.sprints.map((x) => x.donePoints)),
        v.sprints.map((x) => ({ day: x.name, done: x.donePoints, avg: v.average })),
        [["avg", "var(--color-accent)", "Average of the last three"], ["done", "var(--color-text)", "Delivered"]]) : null));
}

function sprintActions(db, p, x, list) {
  if (x.state === "closed" || !canPlan(db, p.id)) return [];
  const btn = (label, onClick, ghost) => h("button", { class: "btn btn-xs" + (ghost ? " btn-ghost" : ""), onClick }, t(label));
  return [
    x.state === "planned" && !list.some((y) => y.state === "active")
      ? btn("Start", () => App.write("Sprint started",
        (a) => a.patch("/iterations/" + x.id, { state: "active", version: x.version }), { detail: x.name })) : null,
    btn("Close", () => closeSprint(db, p, x, list)),
    btn("Edit", () => editSprint(db, p, x), true),
    btn("Remove", () => confirmDialog({ title: x.name, confirmLabel: t("Remove"), danger: true,
      message: t("Its items go back to the backlog.") })
      .then((ok) => ok && App.write("Sprint removed", (a) => a.del("/iterations/" + x.id), { detail: x.name })), true),
  ];
}

function editSprint(db, p, x) {
  const start = x?.start ?? db.statusDate;
  formDialog({
    title: t(x ? "Edit sprint" : "New sprint"), kicker: p.id,
    fields: [
      { key: "name", label: t("Sprint"), required: true, span: 2, value: x?.name ?? "" },
      { key: "start", label: t("Start"), type: "date", required: true, value: start },
      { key: "end", label: t("End"), type: "date", required: true, value: x?.end ?? iso(addDays(start, 13)),
        validate: (v, st) => (v < st.start ? t("A sprint cannot end before it starts") : "") },
      { key: "goal", label: t("Sprint goal"), type: "textarea", span: 2, value: x?.goal ?? "",
        hint: t("What the team commits to — read at the review by people who were not there.") },
    ],
    saveLabel: t("Save sprint"),
    onSave: (v) => App.write(x ? "Sprint updated" : "Sprint added", (a) => x
      ? a.patch("/iterations/" + x.id, { ...v, version: x.version })
      : a.post("/iterations", { project: p.id, ...v }), { detail: v.name }),
  });
}

function closeSprint(db, p, x, list) {
  const left = db.items.filter((i) => i.iteration === x.id && !isDone(i));
  const next = list.filter((y) => y.state === "planned");
  formDialog({
    title: t("Close sprint") + " · " + x.name, kicker: p.id,
    fields: [{ key: "unfinished", label: t("Unfinished items go to"), type: "select", span: 2,
      value: next[0]?.id ?? "backlog",
      hint: tf("{n} items not Done ({points} points). Closing records the points delivered, which velocity reads.",
        { n: left.length, points: pts(left) }),
      options: [{ value: "backlog", label: t("Backlog") }].concat(next.map((y) => ({ value: y.id, label: y.name }))) }],
    saveLabel: t("Close sprint"),
    onSave: (v) => App.write("Sprint closed",
      (a) => a.post("/iterations/" + x.id + "/close", { unfinished: v.unfinished, version: x.version }), { detail: x.name }),
  });
}

/* Backlog → sprint, one click per item, each a versioned write. */
function planning(p, focus, items, may) {
  const col = (title, list, to, arrow) => h("div", { class: "col", style: "flex:1;min-width:240px" },
    h("div", { class: "col-hd" }, h("span", { class: "n" }, title), h("span", { class: "small mono muted" }, pts(list))),
    h("div", { class: "col-body" }, ...list.map((it) => h("div", { class: "kcard", style: "cursor:default" },
      h("div", { class: "kcard-t" }, it.title),
      h("div", { class: "kcard-m" }, h("span", { class: "sp mono" }, it.id),
        h("span", { class: "mono strong" }, pointsOf(it) ?? "—"),
        may && !isDone(it) ? h("button", { class: "btn btn-xs", "aria-label": it.id + " → " + (to ? focus.name : t("Backlog")),
          onClick: () => App.write("Work item planned",
            (a) => a.patch("/workitems/" + it.id, { iteration: to, version: it.version }), { detail: it.title, quiet: true }) }, arrow)
          : null)))));
  return h("div", { style: "margin-top:18px" },
    h("div", { class: "kicker" }, t("Sprint planning")),
    h("div", { class: "board", style: "padding:0;gap:16px" },
      col(t("Backlog"), items.filter((i) => !i.iteration && !isDone(i)), focus.id, "→"),
      col(focus.name, items.filter((i) => i.iteration === focus.id), null, "←")));
}

/* ── the charts, by hand ─────────────────────────────────────────── */

const W = 420, H = 170, L = 30, T = 8, B = 20;

/** A grid, day ticks and polylines that BREAK where a value is null — a
    day without data is a gap, never a line drawn through it. */
function chart(title, max, rows, lines, foot) {
  const n = rows.length, top = Math.max(1, max, ...rows.map((r) => r.avg ?? 0));
  const x = (i) => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - 24);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const txt = (a, b, str, anchor) => s("text", { x: a, y: b, "font-size": 9, fill: "var(--muted)",
    "font-family": "IBM Plex Mono", "text-anchor": anchor }, str);
  const step = Math.ceil(n / 6);
  return h("div", null, h("div", { class: "kicker" }, title),
    s("svg", { width: "100%", height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": title },
      ...[0, 0.5, 1].map((f) => s("g", null,
        s("line", { x1: L, x2: W - 8, y1: y(top * f), y2: y(top * f), stroke: "var(--rule-1)" }),
        txt(2, y(top * f) + 3, Math.round(top * f)))),
      ...rows.map((r, i) => (i % step ? null
        : txt(x(i), H - 5, /^\d{4}-/.test(r.day) ? r.day.slice(8) + "/" + r.day.slice(5, 7) : r.day.slice(0, 9), "middle"))),
      ...lines.flatMap(([key, color], k) => {
        const runs = [[]];
        rows.forEach((r, i) => (r[key] == null ? runs.push([]) : runs[runs.length - 1].push(x(i) + "," + y(r[key]))));
        return runs.filter((r) => r.length).map((r) => r.length === 1
          ? s("circle", { cx: r[0].split(",")[0], cy: r[0].split(",")[1], r: 2.5, fill: color })
          : s("polyline", { points: r.join(" "), fill: "none", stroke: color, "stroke-width": 2,
            "stroke-dasharray": k === 0 ? "4 3" : null }));
      })),
    legend(lines.map(([, color, label]) => ({ color, label: t(label) }))), foot);
}
function note(x) {
  const out = [];
  if (x.series.some((d) => d.remaining === null)) out.push(t("Days after today have no data yet."));
  if (x.undatedPoints) out.push(tf("{n} points were done on a day nobody recorded: they count on the last day, not before.", { n: x.undatedPoints }));
  return out.length ? h("div", { class: "xs muted" }, out.join(" ")) : null;
}

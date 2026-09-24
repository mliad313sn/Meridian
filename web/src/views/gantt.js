/**
 * PLAN VIEWS — docs/41 wave A2, drawn by hand (D-41.03: no chart or Gantt
 * library; `s()` is kit.js's `h()` in the SVG namespace).
 *
 *   FX-05  the work breakdown: outline numbers, folding summaries, moving
 *          a stage under another (`planTree`, `moveStage`)
 *   FX-06  the Gantt: bars by date, milestones as diamonds, links by type,
 *          the critical path, the baseline ghost, the status date, folding;
 *          a bar is dragged — or moved with the arrow keys and Enter — only
 *          where rbac says this account may plan the project (`ganttBlock`)
 *   FX-07  named baselines: take one, compare the plan with one, or one
 *          with another (`baselinesFold`)
 *
 * Every write goes through App.write → the audited routes, with the row's
 * version. Nothing here decides authority: it asks App.can.
 */

import { h, s, icon, formDialog, table, fold } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { Engine, D, iso, days, addDays, fmtDate, fmtMon, pct, wbsRows } from "../../../shared/engine.js";

/* The same row shape rbac reads everywhere (index.js `asRow`). */
const asRow = (p) => p && { id: p.id, programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel };
const mayPlan = (p) => App.can("schedule.write", { project: asRow(p) }) && p.origin !== "sdp";
const movable = (p, r) => mayPlan(p) && !r.summary && r.a.origin !== "sdp";

/* ── what stays put across a re-render ─────────────────────────────── */
/* The screen is redrawn from the book after every write; a folded
   summary, an open fold and the Gantt's scroll are the reader's, not the
   book's, so they are kept here. */
const folded = new Set();
const openFolds = new Map();
const scrollAt = new Map();
let notice = null;          // { project, text, at } — said once, after a refused move
const redraws = new Set();

function redrawAll() {
  for (const f of [...redraws]) { if (f.el.isConnected) f.draw(); else redraws.delete(f); }
}
function live(el, draw) { const f = { el, draw }; redraws.add(f); draw(); return el; }
function toggleFold(id) { if (folded.has(id)) folded.delete(id); else folded.add(id); redrawAll(); }

/** A fold that keeps its open state when the view is redrawn. */
export function keptFold(key, title, sub, fill, openByDefault = false) {
  if (!openFolds.has(key)) openFolds.set(key, openByDefault);
  const body = h("div");
  const d = fold(title, sub, openFolds.get(key), body);
  let filled = false;
  const fillOnce = () => { if (!filled) { filled = true; fill(body); } };
  if (d.open) fillOnce();
  d.addEventListener("toggle", () => { openFolds.set(key, d.open); if (d.open) fillOnce(); });
  return d;
}

/** The project's breakdown, folded summaries hiding what is under them. */
export function planRows(db, p) {
  const rows = wbsRows(db.activities.filter((a) => a.project === p.id));
  const out = [];
  let hideBelow = null;
  for (const r of rows) {
    if (hideBelow !== null) { if (r.depth > hideBelow) continue; hideBelow = null; }
    out.push(r);
    if (r.summary && folded.has(r.a.id)) hideBelow = r.depth;
  }
  return out;
}

/** The name cell of a breakdown row: outline number, indent, fold arrow. */
export function wbsName(r, extra) {
  return h("div", { style: `display:flex;align-items:center;gap:6px;padding-left:${r.depth * 14}px` },
    r.summary
      ? h("button", { class: "btn btn-xs btn-ghost", "aria-expanded": String(!folded.has(r.a.id)),
          title: r.a.name,
          onClick: () => toggleFold(r.a.id) }, folded.has(r.a.id) ? "▸" : "▾")
      : h("span", { style: "width:22px;display:inline-block" }),
    h("span", { class: "mono xs muted" }, r.outline),
    h("span", { class: r.summary ? "strong small" : "small" }, r.a.name),
    extra ?? null);
}

/** FX-05 — the stage plan as a tree; `cols(r)` are the caller's columns. */
export function planTree(db, p, cols) {
  const el = h("div");
  return live(el, () => {
    el.replaceChildren(table({ cols, rows: planRows(db, p) }));
  });
}

/* ── FX-05 · moving a stage in the breakdown ──────────────────────── */

export function moveStage(db, a) {
  const rows = wbsRows(db.activities.filter((x) => x.project === a.project));
  const mine = rows.find((r) => r.a.id === a.id);
  /* Not itself, nothing under it, and nothing that carries a link: a
     summary carries none (the server says the same, 062). */
  const under = new Set();
  const walk = (id) => rows.filter((r) => r.a.parentId === id).forEach((r) => { under.add(r.a.id); walk(r.a.id); });
  walk(a.id);
  const linked = new Set(db.activities.filter((x) => x.project === a.project)
    .flatMap((x) => ((x.deps ?? []).length ? [x.id, ...x.deps] : [])));
  const options = [{ value: "", label: t("— top level —") }].concat(rows
    .filter((r) => r.a.id !== a.id && !under.has(r.a.id) && (r.summary || !linked.has(r.a.id)))
    .map((r) => ({ value: r.a.id, label: r.outline + " · " + r.a.name })));
  formDialog({
    title: t("Move in the breakdown"), kicker: a.project + " · " + (mine?.outline ?? "") + " " + a.name,
    fields: [
      { key: "parent", label: t("Rolls up into"), type: "select", span: 2, value: a.parentId ?? "", options,
        hint: t("A stage with stages under it is a summary: its figures come from them, it has no link, and its weight passes to the first stage put under it.") },
    ],
    saveLabel: t("Move"),
    onSave: (v) => App.write("Stage moved", (x) => x.patch("/activities/" + a.id + "/parent", {
      parent: v.parent || null, version: a.version,
    }), { detail: a.name, touch: ["activities"] }),
  });
}

/* ── FX-06 · the Gantt ─────────────────────────────────────────────── */

const ROW = 26, HEAD = 30, LABEL = 210;
/* A name longer than the label column is cut, not spilled over the bars;
   the whole name is the bar's own title. */
const cut = (s_, depth = 0) => { const n = 30 - depth * 2; return s_.length > n ? s_.slice(0, n - 1) + "…" : s_; };

/** The links of a stage: typed when the engine carries them (A1), FS otherwise. */
const linksOf = (a) => a.links ?? (a.deps ?? []).map((pred) => ({ pred, type: "FS", lag: 0 }));

export function ganttBlock(db, p) {
  const el = h("div", { class: "gantt", "data-gantt": p.id });
  return live(el, () => drawGantt(el, db, p));
}

/** The Gantt in a fold that stays as the reader left it; open at first. */
export function ganttFold(db, p) {
  const n = db.activities.filter((a) => a.project === p.id).length;
  return h("section", { class: "sec" },
    keptFold("gantt:" + p.id, t("Gantt"), n + " " + t("stages"),
      (body) => body.appendChild(ganttBlock(db, p)), true));
}

function drawGantt(el, db, p) {
  const rows = planRows(db, p);
  const ms = Engine.milestones(db, p.id);
  const cp = Engine.criticalPath(db, p.id);
  const dates = [p.start, p.finish, db.statusDate,
    ...rows.flatMap((r) => [r.a.start, r.a.end, r.a.baseStart, r.a.baseEnd]),
    ...ms.map((m) => m.date)].filter(Boolean).sort();
  if (!rows.length) {
    el.replaceChildren(h("div", { class: "small muted" }, t("No stages to draw yet.")));
    return;
  }
  const from = addDays(dates[0], -5), to = addDays(dates[dates.length - 1], 6);
  const span = Math.max(1, days(from, to));
  const ppd = Math.max(3, Math.min(24, Math.round(1100 / span)));
  const W = span * ppd;
  const X = (d) => days(from, d) * ppd;
  const lines = [...rows.map((r) => ({ kind: "stage", r })), ...ms.map((m) => ({ kind: "ms", m }))];
  const H = HEAD + lines.length * ROW + 4;
  const yOf = new Map();
  lines.forEach((l, i) => { if (l.kind === "stage") yOf.set(l.r.a.id, HEAD + i * ROW); });
  const canPlan = mayPlan(p);

  /* month grid and labels */
  const grid = [];
  for (let m = D(iso(from).slice(0, 7) + "-01"); m <= D(to); m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    const x = X(m);
    if (x < 0) continue;
    grid.push(s("line", { x1: x, x2: x, y1: 0, y2: H, stroke: "var(--rule-1)" }),
      s("text", { x: x + 4, y: 18, "font-size": 10, fill: "var(--muted)" }, fmtMon(m)));
  }
  const status = X(db.statusDate);

  /* the bars */
  const bars = [];
  lines.forEach((l, i) => {
    const y = HEAD + i * ROW;
    if (l.kind === "ms") {
      const m = l.m, x = X(m.date), c = y + ROW / 2;
      /* <title> is both the tooltip and the accessible name. */
      bars.push(s("g", { tabindex: 0, role: "img", class: "gantt-ms" },
        s("title", null, m.name + " · " + fmtDate(m.date)),
        s("polygon", { points: `${x},${c - 7} ${x + 7},${c} ${x},${c + 7} ${x - 7},${c}`,
          fill: m.done ? "var(--color-text)" : m.gate ? "var(--color-accent)" : "var(--color-surface)",
          stroke: m.gate ? "var(--color-accent)" : "var(--color-text)", "stroke-width": 1.5 })));
      return;
    }
    const r = l.r, a = r.a;
    const x1 = X(a.start), x2 = Math.max(X(a.end), x1 + 3);
    const crit = !r.summary && cp.critical.has(a.id);
    const label = a.name + " · " + fmtDate(a.start) + " → " + fmtDate(a.end) + " · " + a.pct + "%" +
      (crit ? " · " + t("critical") : "") + (r.summary ? " · " + t("summary") : "");
    const ghost = a.baseStart && a.baseEnd
      ? s("rect", { x: X(a.baseStart), y: y + ROW - 8, width: Math.max(2, X(a.baseEnd) - X(a.baseStart)), height: 4,
          fill: "var(--color-neutral-400)", opacity: 0.6, class: "gantt-base" })
      : null;
    const body = r.summary
      ? [s("rect", { x: x1, y: y + 7, width: x2 - x1, height: 6, fill: "var(--color-text)" }),
         s("polygon", { points: `${x1},${y + 13} ${x1 + 6},${y + 13} ${x1},${y + 19}`, fill: "var(--color-text)" }),
         s("polygon", { points: `${x2},${y + 13} ${x2 - 6},${y + 13} ${x2},${y + 19}`, fill: "var(--color-text)" })]
      : [s("rect", { x: x1, y: y + 5, width: x2 - x1, height: 12, rx: 2,
            fill: crit ? "var(--color-accent-200)" : "var(--color-neutral-200)",
            stroke: crit ? "var(--color-accent)" : "var(--color-neutral-500)" }),
         s("rect", { x: x1, y: y + 5, width: (x2 - x1) * a.pct / 100, height: 12, rx: 2,
            fill: crit ? "var(--color-accent)" : "var(--color-neutral-600)" })];
    const mv = movable(p, r);
    const g = s("g", { tabindex: 0, role: mv ? "button" : "img",
      "data-stage": a.id, class: "gantt-bar" + (crit ? " crit" : "") + (mv ? " movable" : ""),
      style: mv ? "cursor:ew-resize;touch-action:none" : null },
      s("title", null, label), ...body);
    if (mv) wireMove(g, p, a, ppd);
    bars.push(ghost, g);
  });

  /* the links, by type: FS end→start, SS start→start, FF end→end, SF start→end */
  const arrows = [];
  const byId = new Map(rows.map((r) => [r.a.id, r.a]));
  for (const r of rows) {
    if (r.summary) continue;
    for (const ln of linksOf(r.a)) {
      const pre = byId.get(ln.pred);
      if (!pre || !yOf.has(pre.id)) continue;
      const fromEnd = ln.type === "FS" || ln.type === "FF" || !ln.type;
      const toEnd = ln.type === "FF" || ln.type === "SF";
      const xa = fromEnd ? Math.max(X(pre.end), X(pre.start) + 3) : X(pre.start);
      const xb = toEnd ? Math.max(X(r.a.end), X(r.a.start) + 3) : X(r.a.start);
      const ya = yOf.get(pre.id) + 11, yb = yOf.get(r.a.id) + 11;
      const out = fromEnd ? xa + 6 : xa - 6, into = toEnd ? xb + 6 : xb - 6;
      const onPath = cp.critical.has(pre.id) && cp.critical.has(r.a.id);
      arrows.push(s("path", { d: `M${xa},${ya} H${out} V${(ya + yb) / 2} H${into} V${yb} H${xb}`, fill: "none",
        stroke: onPath ? "var(--color-accent)" : "var(--color-neutral-500)", "stroke-width": onPath ? 1.5 : 1,
        "marker-end": "url(#gantt-arrow)", "data-link": (ln.type ?? "FS") + (ln.lag ? (ln.lag > 0 ? "+" : "") + ln.lag : "") },
        s("title", null, pre.name + " → " + r.a.name + " · " + (ln.type ?? "FS") + (ln.lag ? " " + (ln.lag > 0 ? "+" : "") + ln.lag + t("d") : ""))));
    }
  }

  const chart = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "group",
    "aria-label": t("Gantt") + " · " + p.name, style: "display:block;font-family:var(--font-ui)" },
    s("defs", null, s("marker", { id: "gantt-arrow", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto" },
      s("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--color-neutral-600)" }))),
    ...grid, ...bars.filter(Boolean), ...arrows,
    s("line", { x1: status, x2: status, y1: HEAD - 6, y2: H, stroke: "var(--sig-red)", "stroke-width": 1.5, "stroke-dasharray": "4 3", class: "gantt-status" }),
    s("text", { x: status + 3, y: H - 5, "font-size": 9, fill: "var(--sig-red)" }, t("status date") + " " + fmtDate(db.statusDate)));

  const labels = s("svg", { width: LABEL, height: H, style: "display:block;flex:none", role: "presentation" },
    ...lines.map((l, i) => {
      const y = HEAD + i * ROW + 16;
      if (l.kind === "ms") return s("text", { x: 8, y, "font-size": 11, fill: "var(--muted)" }, "◇ " + cut(l.m.name));
      const r = l.r;
      const text = s("text", { x: 8 + r.depth * 12 + (r.summary ? 12 : 0), y, "font-size": 11,
        "font-weight": r.summary ? 600 : 400, fill: "var(--color-text)" }, r.outline + "  " + cut(r.a.name, r.depth));
      return r.summary
        ? s("g", { style: "cursor:pointer", onClick: () => toggleFold(r.a.id) },
            s("text", { x: 6 + r.depth * 12, y, "font-size": 11, fill: "var(--muted)" }, folded.has(r.a.id) ? "▸" : "▾"), text)
        : text;
    }));

  const scroller = h("div", { style: "overflow-x:auto;flex:1;min-width:0", class: "gantt-scroll",
    onScroll: (e) => scrollAt.set(p.id, e.currentTarget.scrollLeft) }, chart);
  const said = notice && notice.project === p.id && Date.now() - notice.at < 20000 ? notice.text : "";
  notice = null;
  el.replaceChildren(
    h("div", { class: "xs muted", style: "display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px" },
      h("span", { style: "color:var(--color-accent)" }, "▬ " + t("critical path")),
      h("span", null, "▔ " + t("baseline")),
      h("span", { style: "color:var(--sig-red)" }, "┆ " + t("status date")),
      canPlan ? h("span", null, t("Drag a bar, or focus it and press ← → then Enter.")) : h("span", null, t("Read only."))),
    said ? h("div", { class: "small", role: "alert", "data-gantt-notice": "", style: "margin-bottom:8px;padding:7px 10px;border:1px solid var(--sig-red);border-radius:6px;color:var(--sig-red)" }, said) : "",
    h("div", { style: "display:flex;border:1px solid var(--rule-1);border-radius:var(--r)" }, labels, scroller));
  const keep = scrollAt.get(p.id);
  scroller.scrollLeft = keep ?? Math.max(0, status - 240);
}

/** Drag, or arrow keys and Enter: both write through the audited stage route. */
function wireMove(g, p, a, ppd) {
  let shift = 0, drag = null;
  const show = () => g.setAttribute("transform", shift ? `translate(${shift * ppd},0)` : "");
  const commit = async () => {
    const n = shift;
    if (!n) return;
    const start = iso(addDays(a.start, n)), end = iso(addDays(a.end, n));
    const ok = await App.write("Stage updated", (x) => x.patch("/activities/" + a.id, { start, end, version: a.version }),
      { detail: a.name + " → " + fmtDate(start) + " – " + fmtDate(end) });
    /* The screen was redrawn from the book: the keyboard goes back to the
       same stage's bar, wherever it now stands. */
    setTimeout(() => document.querySelector(`[data-gantt] [data-stage="${a.id}"]`)?.focus(), 0);
    if (ok === false) {
      /* Refused: the bar goes back to where the book has it, and says why. */
      const e = App.lastWriteError;
      notice = { project: p.id, at: Date.now(),
        text: e && (e.status === 409 || e.isStale)
          ? t("A newer version was saved — the bar is back where the book has it.")
          : ((e && e.message) || t("That change was not saved.")) };
      shift = 0; show();
      redrawAll();
    }
  };
  g.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, id: e.pointerId };
    g.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  g.addEventListener("pointermove", (e) => {
    if (!drag) return;
    shift = Math.round((e.clientX - drag.x) / ppd);
    show();
  });
  const end = () => { if (!drag) return; drag = null; commit(); };
  g.addEventListener("pointerup", end);
  g.addEventListener("pointercancel", () => { drag = null; shift = 0; show(); });
  g.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { shift += e.key === "ArrowLeft" ? -1 : 1; show(); e.preventDefault(); }
    else if (e.key === "Enter") { commit(); e.preventDefault(); }
    else if (e.key === "Escape") { shift = 0; show(); }
  });
}

/* ── FX-07 · named baselines ───────────────────────────────────────── */

const snaps = new Map();    // project → { baselines, max } as last read
const choice = new Map();   // project → { left, right }

export function baselinesFold(db, p) {
  return keptFold("baselines:" + p.id, t("Named baselines"),
    null, (body) => live(body, () => drawBaselines(body, db, p)));
}

function load(p, body) {
  snaps.set(p.id, "loading");
  api.get("/projects/" + p.id + "/baselines")
    .then((r) => snaps.set(p.id, r))
    .catch((e) => snaps.set(p.id, { error: e.message }))
    .finally(() => { if (body.isConnected) redrawAll(); });
}

function drawBaselines(body, db, p) {
  const got = snaps.get(p.id);
  if (!got) { load(p, body); }
  if (!got || got === "loading") { body.replaceChildren(h("div", { class: "small muted" }, "…")); return; }
  if (got.error) { body.replaceChildren(h("div", { class: "small muted" }, got.error)); return; }
  const list = got.baselines;
  const may = App.can("baseline.snapshot", { project: asRow(p) }) && p.origin !== "sdp";
  const c = choice.get(p.id) ?? { left: "current" };
  /* A choice that names no baseline (none yet, or read before the last
     one was taken) falls on the latest. */
  if (!list.some((b) => b.id === c.right)) c.right = list.length ? list[list.length - 1].id : "";
  choice.set(p.id, c);
  const opts = (withCurrent) => [
    ...(withCurrent ? [{ value: "current", label: t("Current plan") }] : []),
    ...list.map((b) => ({ value: b.id, label: b.name + " · " + fmtDate(b.takenAt) })),
  ];
  const pick = (key, withCurrent) => h("select", { class: "input", style: "max-width:260px", "aria-label": key === "left" ? t("Compare") : t("against"),
    onChange: (e) => { c[key] = e.target.value; redrawAll(); } },
    ...opts(withCurrent).map((o) => h("option", { value: o.value, selected: o.value === c[key] }, o.label)));

  body.replaceChildren(
    h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px" },
      h("span", { class: "small" }, list.length + " " + t("of") + " " + got.max + " " + t("named baselines kept")),
      may && list.length < got.max
        ? h("button", { class: "btn btn-sm", onClick: () => takeBaseline(p) }, icon("plus", 12), t("Take baseline"))
        : null),
    h("div", { class: "xs muted", style: "margin-bottom:10px;max-width:70ch" },
      t("Read-only once taken. Taking one never moves the governed baseline.")),
    list.length
      ? h("div", null,
          h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px" },
            h("span", { class: "small" }, t("Compare")), pick("left", true), h("span", { class: "small" }, t("against")), pick("right", false)),
          compareTable(db, p, list, c),
          h("div", { class: "xs muted", style: "margin-top:8px" }, ...list.map((b) =>
            h("div", null, h("span", { class: "strong" }, b.name), " · " + fmtDate(b.takenAt) + " · " + (b.takenByName || "—") + " — " + b.reason))))
      : h("div", { class: "small muted" }, t("No named baseline yet.")));
}

/** Stages as a picture holds them, as rows the breakdown can read. */
function side(db, p, list, id) {
  if (id === "current") return db.activities.filter((a) => a.project === p.id);
  const b = list.find((x) => x.id === id);
  const stage = new Map(db.activities.map((a) => [a.id, a.stage]));
  return (b?.rows ?? []).map((r) => ({ id: r.activity, project: p.id, name: r.name, parentId: r.parent,
    stage: stage.get(r.activity) ?? 999, start: r.start, end: r.end, baseStart: r.start, baseEnd: r.end,
    weight: r.weight, pct: 0 }));
}

function compareTable(db, p, list, c) {
  const now = new Map(wbsRows(side(db, p, list, c.left)).map((r) => [r.a.id, r]));
  const then = new Map(wbsRows(side(db, p, list, c.right)).map((r) => [r.a.id, r]));
  const ids = [...new Set([...now.keys(), ...then.keys()])];
  const rows = ids.map((id) => ({ id, n: now.get(id), o: then.get(id) }))
    .sort((x, y) => ((x.n ?? x.o).outline).localeCompare((y.n ?? y.o).outline, undefined, { numeric: true }));
  const delta = (a, b) => {
    if (!a || !b) return "";
    const d = days(b, a);
    return d === 0 ? "0" : (d > 0 ? "+" : "−") + Math.abs(d) + t("d");
  };
  /* then → now, and the slip in days (later is red) */
  const moved = (k) => (x) => h("span", { class: "mono small" },
    fmtDate(x.o?.a[k]) + " → " + fmtDate(x.n?.a[k]) + " ",
    h("span", { style: x.n && x.o && days(x.o.a[k], x.n.a[k]) > 0 ? "color:var(--sig-red)" : null }, delta(x.n?.a[k], x.o?.a[k])));
  return table({
    cols: [
      { key: "n", label: t("Stage"), get: (x) => h("span", { class: "small" }, (x.n ?? x.o).outline + " · " + (x.n ?? x.o).a.name,
          " ", !x.o ? h("span", { class: "tag" }, t("added since")) : !x.n ? h("span", { class: "tag" }, t("removed since")) : null) },
      { key: "s", label: t("Start"), get: moved("start") },
      { key: "e", label: t("Finish"), get: moved("end") },
      { key: "w", label: t("Weight"), align: "r", get: (x) => h("span", { class: "mono small" },
          (x.o ? pct(x.o.a.weight, 1) : "—") + " → " + (x.n ? pct(x.n.a.weight, 1) : "—")) },
    ],
    rows,
  });
}

function takeBaseline(p) {
  formDialog({
    title: t("Take baseline"), kicker: p.id + " · " + p.name,
    fields: [
      { key: "name", label: t("Name"), required: true, span: 2,
        hint: t("What it is a picture of, e.g. “Approved plan”. Once per project.") },
      { key: "reason", label: t("Why it is being taken"), type: "textarea", rows: 3, span: 2, required: true,
        hint: t("Read by whoever compares against it later.") },
    ],
    saveLabel: t("Take baseline"),
    onSave: (v) => App.write("Baseline taken", (x) => x.post("/projects/" + p.id + "/baselines", { name: v.name, reason: v.reason }),
      { detail: p.id + " · " + v.name, refresh: false }).then((ok) => { if (ok !== false) { snaps.delete(p.id); redrawAll(); } return ok; }),
  });
}

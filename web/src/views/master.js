/**
 * FX-15 (docs/41, wave D) — the programme master schedule, loaded the
 * first time a programme's schedule is opened (gantt.js `masterBlock`;
 * D-41.03: the bundle every site downloads stays under its cap).
 *
 * Not a second Gantt: the programme run is turned into a spec — lines,
 * links, the critical chain — and drawn by gantt.js `renderGantt`, the
 * renderer the project Gantt, the SVG file and the printed report use.
 */

import { h, table } from "../ui/kit.js";
import { t } from "../lib/i18n.js";
import { Engine, fmtDate } from "../../../shared/engine.js";
import { programmeSchedule } from "../../../shared/programme.js";
import { renderGantt, live, folded, planRows, linksOf } from "./gantt.js";

/**
 * The programme's projects as summary bars, their stages folded under
 * them, the links between projects as dashed arrows by type, and the
 * programme's critical chain — drawn at the dates the PROGRAMME run
 * computes (each project on its own calendar), with each stage's own
 * dates as the thin bar under it. Read only: a stage is moved in its
 * project's Gantt, where its authority is asked.
 */
export function masterBlock(db, pr, projects) {
  const el = h("div", { class: "gantt", "data-master": pr.id });
  return live(el, () => drawMaster(el, db, pr, projects));
}

function drawMaster(el, db, pr, projects) {
  const ps = programmeSchedule(db, pr.id, projects);
  const list = projects.filter((p) => p.programme === pr.id);
  const when = (id) => {
    const d = ps.result.dates[id];
    return d ? { start: d.es, end: d.ef } : null;
  };
  const span = (leaves) => {
    const ws = leaves.map((a) => when(a.id)).filter(Boolean);
    return ws.length ? { start: ws.map((w) => w.start).sort()[0], end: ws.map((w) => w.end).sort().pop() } : null;
  };
  const lines = [], visible = new Map();   // stage id → the line that stands for it
  for (const p of list) {
    const leaves = Engine.activities(db, p.id);
    const w = span(leaves);
    if (!w) continue;
    const pid = "prj:" + p.id;
    const mine = ps.projects.find((x) => x.id === p.id);
    lines.push({ kind: "stage", r: { a: { id: pid, name: p.id + " · " + p.name, pct: Engine.metrics(db, p.id).pctComplete ?? 0 },
      depth: 0, outline: "", summary: true, at: w,
      ghost: mine?.ownFinish ? { start: p.start, end: mine.ownFinish } : null } });
    for (const a of leaves) visible.set(a.id, pid);
    if (folded.has(pid)) continue;
    for (const r of planRows(db, p)) {
      const rw = r.summary ? span(r.leaves) : when(r.a.id);
      if (!rw) continue;
      lines.push({ kind: "stage", r: { ...r, depth: r.depth + 1, at: rw,
        ghost: { start: r.a.start, end: r.a.end } } });
      /* outline order: a summary stands for its leaves until they are
         drawn themselves — and stays standing for them when folded */
      for (const x of r.summary ? r.leaves : [r.a]) visible.set(x.id, r.a.id);
    }
  }
  if (!lines.length) {
    el.replaceChildren(h("div", { class: "small muted" }, t("No stages to draw yet.")));
    return;
  }
  const chain = ps.chain.map((c) => c.id);
  const step = new Map(chain.map((id, i) => [id, i]));
  const links = [], seen = new Set();
  const add = (l) => {
    const pred = visible.get(l.pred), succ = visible.get(l.succ);
    if (!pred || !succ || pred === succ) return;
    const k = pred + ">" + succ + ">" + l.type + l.lag;
    if (seen.has(k)) return;
    seen.add(k);
    links.push({ ...l, pred, succ });
  };
  for (const p of list) {
    for (const a of Engine.activities(db, p.id)) {
      for (const ln of linksOf(a)) {
        add({ pred: ln.pred, succ: a.id, type: ln.type, lag: ln.lag,
          onPath: step.has(a.id) && step.get(a.id) === step.get(ln.pred) + 1 });
      }
    }
  }
  for (const l of ps.links) {
    for (const [f, tt] of l.pairs) {
      add({ pred: f, succ: tt, type: l.type, lag: l.lag, cross: true,
        onPath: step.has(tt) && step.get(tt) === step.get(f) + 1 });
    }
  }
  const onChain = new Set(chain);
  el.replaceChildren(
    masterSummary(db, ps, list),
    h("div", { "data-master-gantt": pr.id }));
  renderGantt(el.lastChild, {
    key: "master:" + pr.id, label: t("Master schedule") + " · " + pr.name,
    lines, extent: [], critical: onChain, links, statusDate: db.statusDate,
    movable: () => null,
    legend: [
      h("span", { style: "color:var(--color-accent)" }, "▬ " + t("programme critical chain")),
      h("span", { style: "color:var(--color-accent)" }, "╌ " + t("between projects")),
      h("span", null, "▔ " + t("as the project plans it")),
      h("span", { style: "color:var(--sig-red)" }, "┆ " + t("status date")),
      h("span", null, t("Read only."))],
  });
}

/** The three numbers the master schedule exists for, above the chart. */
function masterSummary(db, ps, list) {
  const name = (id) => (list.find((p) => p.id === id) || {}).name || id;
  const cross = ps.chain.filter((c) => c.via?.cross).length;
  return h("div", { style: "margin-bottom:12px" },
    h("div", { style: "display:flex;flex-wrap:wrap;gap:22px;margin-bottom:10px" },
      h("div", null, h("div", { class: "kicker" }, t("Programme finish")),
        h("div", { class: "mono strong", "data-programme-finish": ps.finish ?? "" }, fmtDate(ps.finish))),
      h("div", null, h("div", { class: "kicker" }, t("Critical chain")),
        h("div", { class: "mono strong" }, ps.chain.length + " " + t("stages") + " · " + cross + " " + t("links between projects")))),
    ps.chain.length ? h("div", { class: "xs", style: "margin-bottom:10px;line-height:1.7", "data-chain": "" },
      ...ps.chain.flatMap((c, i) => [
        i ? h("span", { class: "muted" }, " → " + (c.via ? c.via.type + (c.via.lag ? (c.via.lag > 0 ? "+" : "") + c.via.lag + t("d") : "") + " " : "") ) : null,
        h("span", { class: c.via?.cross ? "strong" : null, style: "white-space:nowrap" }, c.project + " · " + c.name)]).filter(Boolean))
      : null,
    table({
      cols: [
        { key: "p", label: t("Project"), get: (x) => h("span", { class: "small" }, x.id + " · " + name(x.id) + (x.onChain ? " ●" : "")) },
        { key: "o", label: t("On its own"), get: (x) => h("span", { class: "mono small" }, fmtDate(x.ownFinish)) },
        { key: "f", label: t("In the programme"), get: (x) => h("span", { class: "mono small" }, fmtDate(x.finish)) },
        { key: "s", label: t("Pushed by links"), align: "r", get: (x) => h("span", { class: "mono small", style: x.pushed > 0 ? "color:var(--sig-red)" : null },
            x.pushed > 0 ? "+" + x.pushed + t("d") : "0") },
        { key: "c", label: t("Float consumed"), align: "r", get: (x) => h("span", { class: "mono small" }, x.floatConsumed ? x.floatConsumed + t("d") : "0") },
      ],
      rows: ps.projects,
    }),
    ps.outside.length ? h("div", { class: "xs muted", style: "margin-top:6px" },
      ps.outside.length + " " + t("link(s) leave this programme or your scope and are not scheduled here.")) : null);
}

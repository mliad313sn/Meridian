/**
 * SCHEDULE RISK — the drawn half of docs/41 FX-11: P-dates, the finish
 * histogram, the criticality index and the run dialog. Split from risk.js
 * and loaded only when the "Schedule risk" fold opens (D-41.03: the
 * bundle every site downloads over a satellite link stays under its cap).
 */

import { h, s, formDialog, table } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { Engine, days, fmtDate } from "../../../shared/engine.js";
import { riskRuns, asRow, hasEstimate, KEYS, draw } from "./risk.js";

export function view(body, db, p, acts, got) {
  const may = App.can("risk.run", { project: asRow(p) }) && p.origin !== "sdp";
  const estimated = acts.filter(hasEstimate).length;
  const runs = got.runs;
  const last = runs[runs.length - 1];
  return h("div", { "data-risk": p.id },
    h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px" },
      h("span", { class: "small" }, estimated + " / " + acts.length + " " + t("stages estimated") +
        " · " + t("triangular distribution")),
      may && estimated
        ? h("button", { class: "btn btn-sm", "data-risk-run": "", onClick: () => runDialog(body, db, p, acts, got.max) }, t("Run simulation"))
        : null),
    h("div", { class: "xs muted", style: "margin-bottom:12px;max-width:74ch" },
      estimated
        ? t("Each run samples every estimated stage and reschedules the plan with its links and calendar. A stored run is read-only and never moves a date.")
        : t("No stage carries three estimates yet — Edit stage › More detail.")),
    last ? runView(db, p, last) : h("div", { class: "small muted" }, t("No simulation run yet.")),
    runs.length > 1 ? h("div", { style: "margin-top:14px" },
      h("div", { class: "xs muted", style: "margin-bottom:6px" }, t("Earlier runs")),
      table({
        cols: [
          { key: "at", label: t("Run"), get: (x) => h("span", { class: "small" }, fmtDate(x.ranAt) + " · " + (x.ranByName || "—")) },
          { key: "seed", label: t("Seed"), align: "r", get: (x) => h("span", { class: "mono small" }, x.seed + " × " + x.iterations) },
          ...["p50", "p80", "p90"].map((k) => ({ key: k, label: k.toUpperCase(), get: (x) => h("span", { class: "mono small" }, fmtDate(x[k])) })),
        ],
        rows: runs.slice(0, -1).reverse(),
      })) : null);
}

/** One run: the four dates, the histogram, the criticality. */
export function runView(db, p, x) {
  const slip = (d) => {
    const n = days(x.deterministicFinish, d);
    return n ? " (" + (n > 0 ? "+" : "−") + Math.abs(n) + t("d") + ")" : "";
  };
  const kpi = (label, d, strong) => h("div", { class: "card", style: "padding:10px 12px;min-width:130px" },
    h("div", { class: "card-kicker" }, label),
    h("div", { class: "mono" + (strong ? " strong" : ""), style: "font-size:16px;margin-top:3px" }, fmtDate(d)),
    d !== x.deterministicFinish ? h("div", { class: "xs muted" }, slip(d).trim()) : null);
  return h("div", { "data-risk-run-view": x.id },
    h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px" },
      kpi(t("Critical path ends"), x.deterministicFinish), kpi("P50", x.p50), kpi("P80", x.p80, true), kpi("P90", x.p90)),
    h("div", { class: "xs muted", style: "margin-bottom:10px" },
      x.id + " · " + fmtDate(x.ranAt) + " · " + (x.ranByName || "—") + " · " + t("seed") + " " + x.seed + " · " +
      x.iterations + " " + t("runs") + " · " + x.estimated + " " + t("stages estimated") +
      (x.statusDate ? " · " + t("status date") + " " + fmtDate(x.statusDate) : "")),
    h("div", { style: "display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start" },
      histogram(x), criticality(db, x)));
}

const W = 380, HH = 150, PAD = 24;

/** The finish dates, one bar per day, with the percentiles marked. */
export function histogram(x) {
  const bins = x.histogram;
  if (!bins.length) return null;
  const first = bins[0][0], lastDay = bins[bins.length - 1][0];
  const span = Math.max(1, days(first, lastDay) + 1);
  const bw = (W - 2 * PAD) / span;
  const top = Math.max(...bins.map((b) => b[1]));
  const X = (d) => PAD + days(first, d) * bw;
  const mark = (d, label, color) => d && s("g", null,
    s("line", { x1: X(d) + bw / 2, x2: X(d) + bw / 2, y1: 14, y2: HH - PAD, stroke: color, "stroke-width": 1.5, "stroke-dasharray": "3 2" }),
    s("text", { x: X(d) + bw / 2 + 2, y: 12, "font-size": 9, fill: color }, label));
  return s("svg", { width: W, height: HH, viewBox: `0 0 ${W} ${HH}`, role: "img", class: "risk-hist",
      "aria-label": t("Finish date histogram") + " · P50 " + fmtDate(x.p50) + " · P80 " + fmtDate(x.p80) + " · P90 " + fmtDate(x.p90),
      style: "display:block;max-width:100%;font-family:var(--font-ui)" },
    s("line", { x1: PAD, x2: W - PAD, y1: HH - PAD, y2: HH - PAD, stroke: "var(--rule-2)" }),
    ...bins.map(([d, n]) => s("rect", { x: X(d), y: HH - PAD - (HH - PAD - 20) * n / top, width: Math.max(1, bw - 1),
      height: (HH - PAD - 20) * n / top, fill: "var(--color-neutral-400)" },
      s("title", null, fmtDate(d) + " · " + n + " " + t("runs")))),
    mark(x.deterministicFinish, t("plan"), "var(--muted)"),
    mark(x.p50, "P50", "var(--color-text)"), mark(x.p80, "P80", "var(--color-accent)"), mark(x.p90, "P90", "var(--sig-red)"),
    s("text", { x: PAD, y: HH - 8, "font-size": 9, fill: "var(--muted)" }, fmtDate(first)),
    s("text", { x: W - PAD, y: HH - 8, "font-size": 9, fill: "var(--muted)", "text-anchor": "end" }, fmtDate(lastDay)));
}

/** Share of runs on which each stage was critical, highest first. */
export function criticality(db, x) {
  const rows = Object.entries(x.criticality).sort((a, b) => b[1] - a[1] || (a[0] > b[0] ? 1 : -1)).slice(0, 12);
  if (!rows.length) return null;
  const name = (id) => (db.activities.find((a) => a.id === id) || {}).name || id;
  const RH = 18, LW = 150, BW = 170;
  return s("svg", { width: LW + BW + 44, height: rows.length * RH + 20, role: "img", class: "risk-crit",
      "aria-label": t("Criticality index"), style: "display:block;max-width:100%;font-family:var(--font-ui)" },
    s("text", { x: 0, y: 11, "font-size": 10, fill: "var(--muted)" }, t("Criticality index")),
    ...rows.flatMap(([id, v], i) => {
      const y = 18 + i * RH;
      const nm = name(id);
      return [
        s("text", { x: 0, y: y + 11, "font-size": 10, fill: "var(--color-text)" }, nm.length > 24 ? nm.slice(0, 23) + "…" : nm),
        s("rect", { x: LW, y: y + 3, width: BW, height: 10, fill: "var(--color-neutral-200)" }),
        s("rect", { x: LW, y: y + 3, width: BW * v, height: 10, fill: v >= 0.5 ? "var(--color-accent)" : "var(--color-neutral-500)" },
          s("title", null, nm + " · " + Math.round(v * 100) + "%")),
        s("text", { x: LW + BW + 4, y: y + 12, "font-size": 10, fill: "var(--color-text)" }, Math.round(v * 100) + "%"),
      ];
    }));
}

function runDialog(body, db, p, acts, max) {
  formDialog({
    title: t("Run simulation"), kicker: p.id + " · " + p.name,
    fields: [
      { key: "iterations", label: t("Runs"), type: "number", min: 100, max, value: 2000, required: true,
        hint: t("How many times the plan is sampled — at most 10,000.") },
      { key: "seed", label: t("Seed"), type: "number", min: 1, value: "",
        hint: t("Empty: a new one. The same seed on the same plan gives the same result.") },
    ],
    saveLabel: t("Run simulation"),
    onSave: (v) => App.write("Schedule risk run", (x) => x.post("/projects/" + p.id + "/risk-runs", {
      iterations: Number(v.iterations), seed: v.seed === "" ? null : Number(v.seed),
    }), { detail: p.id, refresh: false }).then((ok) => {
      if (ok !== false) { riskRuns(p.id, true); draw(body, db, p, acts); }
      return ok;
    }),
  });
}


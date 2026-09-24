/**
 * SCHEDULE RISK — the screen of docs/41 FX-11, drawn by hand (D-41.03:
 * no chart library; `s()` is kit.js's `h()` in the SVG namespace).
 *
 *   estimateFields / estimateBody   the three-point estimate, in the stage
 *                                   form's "More detail"
 *   riskFold                        the project's "Schedule risk" fold: run
 *                                   a simulation, P50/P80/P90, the finish
 *                                   histogram and the criticality index
 *   riskRuns                        the stored runs of a project, read once
 *                                   and shared with the printable report
 *
 * The simulation runs on the server (shared/montecarlo.js through the one
 * scheduler) and is stored there, seeded: this module only asks for it
 * and draws what came back. Authority is App.can("risk.run"); nothing
 * here decides who may do what. A run never moves a date (D-41.02).
 */

import { h, s, formDialog, table } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { Engine, days, fmtDate } from "../../../shared/engine.js";
import { keptFold } from "./gantt.js";

export const asRow = (p) => p && { id: p.id, programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel };
export const KEYS = ["durOptimistic", "durMostLikely", "durPessimistic"];
export const hasEstimate = (a) => a.durOptimistic != null && a.durMostLikely != null && a.durPessimistic != null;

/* ── the stage form ──────────────────────────────────────────────── */

export function estimateFields(a) {
  const n = { type: "number", min: 0, max: 3650, step: 0.5, advanced: true };
  const all = (st) => {
    const set = KEYS.filter((k) => st[k] !== "" && st[k] != null).length;
    if (set && set < 3) return t("All three durations, or none.");
    if (set === 3 && !(+st.durOptimistic <= +st.durMostLikely && +st.durMostLikely <= +st.durPessimistic)) {
      return t("Optimistic ≤ most likely ≤ pessimistic.");
    }
    return "";
  };
  return [
    { ...n, key: "durOptimistic", label: t("Optimistic (days)"), value: a.durOptimistic ?? "",
      hint: t("Three-point estimate for the schedule risk run: the shortest this stage could take. Working days under a calendar."),
      validate: (v, st) => all(st) },
    { ...n, key: "durMostLikely", label: t("Most likely (days)"), value: a.durMostLikely ?? "",
      hint: t("The duration you would bet on."), validate: (v, st) => all(st) },
    { ...n, key: "durPessimistic", label: t("Pessimistic (days)"), value: a.durPessimistic ?? "",
      hint: t("The longest it could reasonably take. Empty, all three: the planned duration, fixed."),
      validate: (v, st) => all(st) },
  ];
}

/** Sent only when it changed, so an ordinary edit says nothing about estimates. */
export function estimateBody(v, a) {
  const val = (k) => (v[k] === "" || v[k] == null ? null : Number(v[k]));
  return KEYS.some((k) => val(k) !== (a[k] ?? null)) ? Object.fromEntries(KEYS.map((k) => [k, val(k)])) : {};
}

/* ── the stored runs ─────────────────────────────────────────────── */

const cache = new Map();   // project → Promise<{ runs, max, distribution }>
export function riskRuns(projectId, fresh = false) {
  if (fresh || !cache.has(projectId)) {
    const p = api.get("/projects/" + projectId + "/risk-runs");
    p.catch(() => cache.delete(projectId));
    cache.set(projectId, p);
  }
  return cache.get(projectId);
}

/* ── the fold ────────────────────────────────────────────────────── */

export function riskFold(db, p) {
  const acts = Engine.activities(db, p.id);
  const n = acts.filter(hasEstimate).length;
  return keptFold("risk:" + p.id, t("Schedule risk"),
    n + " / " + acts.length + " " + t("stages estimated"), (body) => draw(body, db, p, acts));
}

export function draw(body, db, p, acts) {
  body.replaceChildren(h("div", { class: "small muted" }, "…"));
  riskRuns(p.id).then((got) => {
    return import("./risk-view.js").then((m) => body.replaceChildren(m.view(body, db, p, acts, got)));
  }, (e) => body.replaceChildren(h("div", { class: "small muted" }, e.message)));
}


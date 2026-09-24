/**
 * PRINTABLE SCHEDULE REPORT — docs/41 FX-16.
 *
 * The steering committee used to receive screenshots. This builds one
 * print-ready status pack for a project — the Gantt, the milestones,
 * negative float, the variance to the governed baseline and to a named
 * baseline the reader chooses, the latest P80 when a risk run exists —
 * and hands it to the browser's own print dialog ("Save as PDF"). No
 * server-side renderer, no external service: a print stylesheet
 * (styles.css, `body.printing-pack`) shows the pack and nothing else.
 *
 * The Gantt is the Gantt of the screen, drawn by the same renderer in
 * its standalone mode (gantt.js `ganttSvg`), not a second drawing.
 *
 * Bilingual: the reader picks the pack's language (the interface's by
 * default); every label goes through t() and has its FR and ES entries.
 * The footer carries the classification line every export of the
 * product carries (INTERNAL, issued to whom, share inside the group).
 */

import { h, formDialog } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { api } from "../lib/api.js";
import { t, getLang, setLang, LANGS } from "../lib/i18n.js";
import { Engine, days, fmtDate, iso } from "../../../shared/engine.js";
import { ganttSvg, classification } from "./gantt.js";
export { classification };
import { riskRuns } from "./risk.js";

const signed = (n) => (n == null ? "—" : n === 0 ? "0" : (n > 0 ? "+" : "−") + Math.abs(n) + t("d"));

export async function scheduleReport(db, p) {
  const [bl, rk] = await Promise.all([
    api.get("/projects/" + p.id + "/baselines").catch(() => ({ baselines: [] })),
    riskRuns(p.id).catch(() => ({ runs: [] })),
  ]);
  const snaps = bl.baselines ?? [];
  formDialog({
    title: t("Schedule report"), kicker: p.id + " · " + p.name,
    fields: [
      { key: "lang", label: t("Language"), type: "select", value: getLang(),
        options: LANGS.map((l) => ({ value: l.code, label: l.name })),
        hint: t("The language the pack is printed in.") },
      { key: "against", label: t("Named baseline"), type: "select", value: snaps.length ? snaps[snaps.length - 1].id : "",
        options: [{ value: "", label: t("— none —") }].concat(snaps.map((b) => ({ value: b.id, label: b.name + " · " + fmtDate(b.takenAt) }))),
        hint: t("Its dates are compared with the plan, beside the governed baseline.") },
    ],
    saveLabel: t("Print"),
    onSave: (v) => {
      const was = getLang();
      let pack;
      try {
        setLang(v.lang);
        pack = buildPack(db, p, snaps.find((b) => b.id === v.against) ?? null, (rk.runs ?? []).at(-1) ?? null);
        pack.setAttribute("lang", v.lang);
      } finally { setLang(was); }
      printPack(pack);
      return true;
    },
  });
}

/** Put the pack in the page, print it, take it away again. */
export function printPack(pack) {
  document.querySelectorAll(".print-pack").forEach((x) => x.remove());
  document.body.appendChild(pack);
  document.body.classList.add("printing-pack");
  const done = () => {
    document.body.classList.remove("printing-pack");
    pack.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 50);
}

/** The pack itself: plain elements, styled for paper by `.print-pack`. */
export function buildPack(db, p, snap, run) {
  const cp = Engine.criticalPath(db, p.id);
  const acts = Engine.activities(db, p.id);
  const ms = Engine.milestones(db, p.id);
  const name = (id) => (acts.find((a) => a.id === id) || {}).name || id;
  const foot = classification(db);
  const svg = ganttSvg(db, p, { width: 760 });
  if (svg) { svg.setAttribute("width", "100%"); svg.removeAttribute("height"); }
  const cpFinish = Object.values(cp.dates).map((d) => d.ef).sort().at(-1);

  const tbl = (head, rows) => rows.length
    ? h("table", null, h("thead", null, h("tr", null, ...head.map((x) => h("th", null, x)))),
        h("tbody", null, ...rows.map((r) => h("tr", null, ...r.map((c) => h("td", null, c))))))
    : h("p", { class: "pp-none" }, t("None."));
  const sec = (title, ...kids) => h("section", { class: "pp-sec" }, h("h2", null, title), ...kids);

  const neg = acts.filter((a) => cp.negative.includes(a.id) || cp.missed.includes(a.id));
  const byBase = acts.filter((a) => a.baseEnd).map((a) => [a, days(a.baseEnd, a.end)]);
  const snapRows = snap ? snap.rows.filter((r) => acts.some((a) => a.id === r.activity)) : [];

  return h("div", { class: "print-pack", "data-print-pack": p.id },
    h("header", { class: "pp-head" },
      h("div", { class: "pp-kicker" }, t("Schedule report") + " · " + t("status date") + " " + fmtDate(db.statusDate)),
      h("h1", null, p.id + " · " + p.name),
      h("div", { class: "pp-keys" },
        h("span", null, t("Planned finish") + " : " + fmtDate(p.finish)),
        h("span", null, t("Baseline finish") + " : " + fmtDate(p.baselineFinish)),
        h("span", null, t("Critical path ends") + " : " + fmtDate(cpFinish)),
        run
          ? h("span", { class: "pp-p80" }, "P80 : " + fmtDate(run.p80) + " (P50 " + fmtDate(run.p50) + " · P90 " + fmtDate(run.p90) +
              " · " + run.id + ", " + fmtDate(run.ranAt) + ", " + t("seed") + " " + run.seed + ")")
          : h("span", null, "P80 : " + t("no risk run")))),
    svg ? h("div", { class: "pp-gantt" }, svg) : null,
    sec(t("Milestones"), tbl([t("Milestone"), t("Date"), t("Baseline"), t("Variance"), t("Done")],
      ms.map((m) => [m.name, fmtDate(m.date), fmtDate(m.baseDate), signed(m.baseDate ? days(m.baseDate, m.date) : null),
        m.done ? "✓" : ""]))),
    sec(t("Negative float"), tbl([t("Stage"), t("Float"), t("Deadline")],
      neg.map((a) => [name(a.id), signed(cp.float[a.id]), a.deadline ? fmtDate(a.deadline) + (cp.missed.includes(a.id) ? " ✖" : "") : ""]))),
    sec(t("Variance to the governed baseline"), tbl([t("Stage"), t("Baseline"), t("Plan"), t("Variance")],
      byBase.map(([a, d]) => [a.name, fmtDate(a.baseStart) + " → " + fmtDate(a.baseEnd), fmtDate(a.start) + " → " + fmtDate(a.end), signed(d)]))),
    snap
      ? sec(t("Variance to a named baseline") + " — " + snap.name + " (" + fmtDate(snap.takenAt) + ")",
          tbl([t("Stage"), t("Baseline"), t("Plan"), t("Variance")],
            snapRows.map((r) => {
              const a = acts.find((x) => x.id === r.activity);
              return [a.name, fmtDate(r.start) + " → " + fmtDate(r.end), fmtDate(a.start) + " → " + fmtDate(a.end), signed(days(r.end, a.end))];
            })))
      : null,
    h("footer", { class: "pp-foot" }, foot));
}

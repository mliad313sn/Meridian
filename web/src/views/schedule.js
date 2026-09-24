/**
 * SCHEDULE ENGINE — the screens of docs/41 wave A1 (FX-01…FX-04).
 *
 * Kept out of index.js on purpose: the project view only asks this module
 * for fields, columns and one signal block, so the screens of the other
 * waves can grow there without colliding with this one.
 *
 *   stageScheduleFields   predecessors (typed, with lag), constraint,
 *                         deadline, actuals, remaining — in the stage form
 *   stageScheduleBody     the same, as the PATCH body the route checks
 *   stageScheduleCols     free float and the stage's schedule flags
 *   scheduleSignals       missed deadlines, negative float, late stages
 *   projectScheduleFields calendar picker and status date on the project
 *   calendarsPanel        the working calendars (calendar.manage)
 *
 * Authority is read from shared/rbac.js through App.can; nothing here
 * decides who may do what. Strings are short on purpose: each one is
 * shipped three times (EN, FR, ES) over a satellite link (S6, D-41.03).
 */

import { h, formDialog, confirmDialog, table, sectionHead, tag } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { t } from "../lib/i18n.js";
import { Engine, fmtDate, D } from "../../../shared/engine.js";
import { CONSTRAINT_TYPES, linksOf } from "../../../shared/schedule.js";

/* ── predecessors, in the planner's own notation ─────────────────── */

/** A stage's short code inside its project: PRJ-101-A3 → A3. */
const code = (a) => (a.id.startsWith(a.project + "-") ? a.id.slice(a.project.length + 1) : a.id);

/** "A1, A2 SS+3, A3 FF-2" — FS/0 is written as the bare code. */
export function formatLinks(a, acts) {
  return linksOf(a).map((l) => {
    const p = acts.find((x) => x.id === l.pred);
    const c = p ? code(p) : l.pred;
    return l.type === "FS" && !l.lag ? c : c + " " + l.type + (l.lag ? (l.lag > 0 ? "+" : "") + l.lag : "");
  }).join(", ");
}

/** The inverse: { links } or { error } — the server checks again (loops included). */
export function parseLinks(text, a, acts) {
  const out = [];
  for (const raw of String(text ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    const m = raw.match(/^([A-Za-z0-9_.-]+?)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*[dj]?)?$/i);
    const p = m && acts.find((x) => x.id !== a.id && (code(x).toUpperCase() === m[1].toUpperCase() || x.id === m[1]));
    if (!p || out.some((l) => l.pred === p.id)) return { error: t("Unknown or repeated predecessor") + " — " + raw };
    out.push({ pred: p.id, type: (m[2] || "FS").toUpperCase(), lag: m[4] ? Number(m[3] + m[4]) : 0 });
  }
  return { links: out };
}

/* ── the stage form ──────────────────────────────────────────────── */

export function stageScheduleFields(db, a) {
  const acts = Engine.activities(db, a.project);
  const adv = { advanced: true, type: "date" };
  return [
    { key: "links", label: t("Predecessors"), span: 2, value: formatLinks(a, acts), placeholder: "A1, A2 SS+3, A3 FF-2",
      hint: t("Code, then type and lag in days: A2 SS+3. FS is the default; negative is a lead.") + " " +
        acts.filter((x) => x.id !== a.id).map(code).join(", "),
      validate: (v) => parseLinks(v, a, acts).error || "" },
    { key: "constraintType", label: t("Date constraint"), type: "select", advanced: true,
      value: a.constraint?.type ?? "ASAP", options: CONSTRAINT_TYPES,
      hint: t("SNET/SNLT start no earlier/later than, FNET/FNLT finish, MSO/MFO must start/finish on. Never moves your dates: an unmet one shows as negative float.") },
    { ...adv, key: "constraintDate", label: t("Constraint date"), value: a.constraint?.date ?? "",
      hint: t("Required unless ASAP."),
      validate: (v, st) => (st.constraintType && st.constraintType !== "ASAP" && !v ? t("Required unless ASAP.") : "") },
    { ...adv, key: "deadline", label: t("Deadline"), value: a.deadline ?? "",
      hint: t("Missing it is flagged; it never moves the plan.") },
    { ...adv, key: "actualStart", label: t("Actual start"), value: a.actualStart ?? "",
      hint: t("When the work really began; the stage is then scheduled from its actuals.") },
    { ...adv, key: "actualFinish", label: t("Actual finish"), value: a.actualFinish ?? "",
      hint: t("When the work really ended — after the actual start."),
      validate: (v, st) => (v && (!st.actualStart || D(v) < D(st.actualStart)) ? t("When the work really ended — after the actual start.") : "") },
    { key: "remaining", label: t("Remaining (days)"), type: "number", min: 0, advanced: true, value: a.remaining ?? "",
      hint: t("Counted from the status date. Empty: the planned duration.") },
  ];
}

export function stageScheduleBody(v, a, db) {
  const acts = Engine.activities(db, a.project);
  const typed = v.constraintType && v.constraintType !== "ASAP";
  const body = {
    constraintType: v.constraintType || "ASAP", constraintDate: typed ? v.constraintDate || null : null,
    deadline: v.deadline || null, actualStart: v.actualStart || null, actualFinish: v.actualFinish || null,
    remaining: v.remaining === "" || v.remaining == null ? null : Number(v.remaining),
  };
  /* the list is sent only when it changed: replacing it is its own audit line */
  if ((v.links ?? "") !== formatLinks(a, acts)) body.links = parseLinks(v.links, a, acts).links;
  return body;
}

/* ── the project's stage table and its signals ───────────────────── */

export const stageScheduleCols = (cp) => [
  { key: "ff", label: t("Free float"), align: "r",
    get: (a) => h("span", { class: "mono small" }, (cp.freeFloat[a.id] ?? 0) + "d") },
  { key: "sf", label: "", get: (a) => h("span", null,
      cp.missed.includes(a.id) ? tag(t("Deadline"), "tag-accent")
        : cp.negative.includes(a.id) ? tag(t("Negative float"), "tag-accent") : null,
      cp.late.includes(a.id) ? tag(t("Late"), "tag-soft") : null,
      a.constraint ? tag(a.constraint.type + " " + fmtDate(a.constraint.date), "tag-out") : null) },
];

/** Does this project carry anything the schedule should shout about? */
export const scheduleAlarm = (cp) => cp.missed.length + cp.negative.length + cp.late.length > 0;

export function scheduleSignals(db, p, cp) {
  const name = (id) => (db.activities.find((a) => a.id === id) || {}).name;
  const cal = (db.calendars ?? []).find((c) => c.id === cp.calendar);
  const neg = cp.negative.filter((id) => !cp.missed.includes(id));
  const lines = [
    cp.missed.length && h("div", { class: "small bad strong" }, t("Deadline") + " ✖ " + cp.missed.map(name).join(", ")),
    neg.length && h("div", { class: "small bad" }, t("Negative float") + " : " + neg.map((id) => name(id) + " " + cp.float[id] + "d").join(", ")),
    cp.late.length && h("div", { class: "small warn" }, t("Late") + " (" + fmtDate(p.statusDate) + ") : " + cp.late.map(name).join(", ")),
  ].filter(Boolean);
  return h("div", null,
    h("div", { class: "xs muted", style: "margin-bottom:8px" },
      (cal ? t("Working calendar") + " : " + cal.name : t("Calendar days")) +
      (p.statusDate ? " · " + t("Status date") + " " + fmtDate(p.statusDate) : "")),
    lines.length ? h("div", { class: "banner-warn", role: "status",
      style: "padding:9px 12px;border-radius:var(--r);margin-bottom:10px" }, ...lines) : null);
}

/* ── the project form: calendar and status date ──────────────────── */

const calendarOptions = (db, none) => [{ value: "", label: none }]
  .concat((db.calendars ?? []).map((c) => ({ value: c.id, label: c.name })));

export const projectScheduleFields = (db, p) => [
  { key: "calendar", label: t("Working calendar"), type: "select", advanced: true, value: p?.calendar ?? "",
    options: calendarOptions(db, t("Inherited")),
    hint: t("Durations and lags count its working days. Inherited: the site's, else the group default, else calendar days.") },
  { key: "statusDate", label: t("Status date"), type: "date", advanced: true, value: p?.statusDate ?? "",
    hint: t("Schedule and earned value are measured at it. Empty: the portfolio's.") },
];

export const projectScheduleBody = (v) => ({ calendar: v.calendar || null, statusDate: v.statusDate || null });

/** The site form's picker (administration.js). */
export const siteCalendarField = (db, s) => ({ key: "calendar", label: t("Working calendar"), type: "select",
  value: s.calendar ?? "", options: calendarOptions(db, t("Inherited")),
  hint: t("Durations and lags count its working days. Inherited: the site's, else the group default, else calendar days.") });

/* ── working calendars (FX-02) ───────────────────────────────────── */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function calendarDialog(c) {
  const mask = c ? c.workdays : 62;
  const toText = (c?.holidays ?? []).map((x) => x.date + " " + x.label).join("\n");
  const parse = (text) => String(text ?? "").split("\n").map((x) => x.trim()).filter(Boolean)
    .map((l) => ({ date: l.slice(0, 10), label: l.slice(11).trim() }));
  formDialog({
    title: c ? c.name : t("Working calendar"), kicker: c ? c.id : t("Working calendar"), wide: true,
    fields: [
      { key: "name", label: t("Name"), required: true, span: 2, value: c?.name ?? "",
        hint: t("The site, country or roster it describes.") },
      ...DAYS.map((d, i) => ({ key: "d" + i, label: t(d), type: "checkbox", value: !!((mask >> i) & 1) })),
      { key: "holidays", label: t("Non-working days"), type: "textarea", rows: 6, span: 2, value: toText,
        placeholder: "2026-12-25 Christmas", hint: t("One per line: YYYY-MM-DD, then a label."),
        validate: (v) => (parse(v).every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date)) ? "" : t("One per line: YYYY-MM-DD, then a label.")) },
      { key: "isDefault", label: t("Group default"), type: "checkbox", span: 2, value: !!c?.isDefault,
        hint: t("For every project whose site names none. One default only.") },
      { key: "note", label: t("Note"), type: "textarea", rows: 2, span: 2, value: c?.note ?? "",
        hint: t("The agreement or roster these days come from.") },
    ],
    saveLabel: t("Save"),
    onSave: (v) => {
      const body = { name: v.name, workdays: DAYS.reduce((m, _, i) => m | (v["d" + i] ? 1 << i : 0), 0),
        holidays: parse(v.holidays), isDefault: !!v.isDefault, note: v.note ?? "" };
      return App.write(c ? "Calendar updated" : "Calendar created",
        (a) => (c ? a.patch("/calendars/" + c.id, { ...body, version: c.version }) : a.post("/calendars", body)),
        { detail: v.name, rethrow: true });
    },
  });
}

export function calendarsPanel(db) {
  const cals = db.calendars ?? [];
  const manage = App.can("calendar.manage", {});
  if (!cals.length && !manage) return null;
  const usedBy = (c) => db.projects.filter((p) => p.calendar === c.id).length + db.sites.filter((s) => s.calendar === c.id).length;
  const cell = (v) => h("span", { class: "small" }, v);
  return h("div", null,
    sectionHead(t("Working calendars"), t("Without one, a project counts calendar days."),
      manage ? h("button", { class: "btn btn-sm", onClick: () => calendarDialog(null) }, t("Add")) : null),
    table({
      cols: [
        { key: "n", label: t("Name"), get: (c) => cell(c.name + (c.isDefault ? " · " + t("Group default") : "")) },
        { key: "w", label: t("Working days"), get: (c) => cell(DAYS.filter((_, i) => (c.workdays >> i) & 1).map(t).join(" ")) },
        { key: "h", label: t("Non-working days"), align: "r", get: (c) => cell(String(c.holidays.length)) },
        { key: "u", label: t("Used by"), align: "r", get: (c) => cell(String(usedBy(c))) },
        { key: "e", label: "", align: "r", get: (c) => manage ? h("div", { class: "btn-row" },
            h("button", { class: "btn btn-xs", onClick: () => calendarDialog(c) }, t("Edit")),
            h("button", { class: "btn btn-xs btn-ghost", onClick: () => confirmDialog({
              title: t("Remove") + " " + c.name, message: t("Refused while a project or a site uses it."),
              confirmLabel: t("Remove"), danger: true,
            }).then((ok) => ok && App.write("Calendar removed", (a) => a.del("/calendars/" + c.id), { detail: c.name })) },
              t("Remove"))) : null },
      ],
      rows: cals,
      empty: { title: t("Working calendars"), body: t("Without one, a project counts calendar days.") },
    }));
}

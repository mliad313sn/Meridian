/**
 * FX-13 · MS PROJECT IN AND OUT — the MSPDI mapping (docs/41 §3).
 *
 * MSPDI is the XML schema MS Project has read and written since 2003
 * (namespace http://schemas.microsoft.com/project). This module is the
 * whole mapping, and it is PURE: no database, no request, no clock. The
 * routes (routes/mspdi.js) read the book, call it, and write what it says
 * through the audited path; the tests call it directly.
 *
 *   parseXml(text)              a tolerant parser for the MSPDI subset
 *   toMspdi(db, projectId, o)   a project of the served book → XML text
 *   readMspdi(text)             XML text → a neutral plan + what it could not say
 *   resolveImport(plan, ctx)    that plan against the directory, the calendars
 *                               and the ladder → the rows a NEW project gets,
 *                               and the report that names every loss
 *
 * No dependency: the writer is string building with escaping, the parser
 * is ~80 lines. The format we accept is a contract, not a library
 * (the same choice as the CSV reader, routes/importcsv.js).
 *
 * ── How Meridian's dates become MS Project's ────────────────────────
 *
 * A Meridian stage runs over [start, end): `end` is the day its successor
 * may start (FS/0 puts the successor's start ON the predecessor's end,
 * shared/schedule.js), so its last working day is the day before. MS
 * Project writes the last working day itself, at the end of the day:
 *
 *     Meridian start 2026-03-02, end 2026-03-07
 *     MSPDI    Start 2026-03-02T08:00:00, Finish 2026-03-06T17:00:00
 *
 * Every date that closes something — a finish, a finish constraint, a
 * deadline, an actual finish, a baseline finish, the project finish —
 * follows that rule both ways; every date that opens something follows
 * the start rule. So the round trip gives back the stored dates to the
 * day, and the engine's indices with them.
 *
 * A project with no working calendar counts calendar days (D-41.01). It
 * is exported with a seven-day calendar, so MS Project counts the same
 * days, and a seven-day calendar with no exception is read back as "no
 * calendar" — the two are the same clock (shared/schedule.js `clock`).
 *
 * A duration is working time: days × MinutesPerDay (480). A lag is in
 * tenths of a minute (MSPDI's unit): 1 day = 4800, LagFormat 7 (days).
 */

import { clock } from "../../shared/schedule.js";
import { Engine } from "../../shared/engine.js";
import { assignmentWork, workingDuration } from "../../shared/resources.js";

export const NS = "http://schemas.microsoft.com/project";
export const MINUTES_PER_DAY = 480;
const DAY_START = "08:00:00";
const DAY_FINISH = "17:00:00";

/* MSPDI's link types: 0 FF, 1 FS, 2 SF, 3 SS. */
export const LINK_OUT = { FF: 0, FS: 1, SF: 2, SS: 3 };
export const LINK_IN = { 0: "FF", 1: "FS", 2: "SF", 3: "SS" };
/* MSPDI's constraints: 0 ASAP, 1 ALAP, 2 MSO, 3 MFO, 4 SNET, 5 SNLT, 6 FNET, 7 FNLT. */
export const CONSTRAINT_OUT = { ASAP: 0, MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };
export const CONSTRAINT_IN = { 0: "ASAP", 1: "ALAP", 2: "MSO", 3: "MFO", 4: "SNET", 5: "SNLT", 6: "FNET", 7: "FNLT" };
const FINISH_CONSTRAINTS = new Set(["FNET", "FNLT", "MFO"]);
/* Duration and lag formats that count elapsed (calendar) time, estimated
   ("?") variants included. 19/20 and 51/52 are percentages (lags only). */
const ELAPSED_FORMATS = new Set([4, 6, 8, 10, 12, 20, 36, 38, 40, 42, 44, 52]);
const PERCENT_FORMATS = new Set([19, 20, 51, 52]);

/* The custom fields Meridian writes. MS Project shows them under their
   alias; the reader recognises them BY THE ALIAS, never by the field id,
   so a planner who moved them to other slots loses nothing. */
const FIELD = {
  weight: { id: 188743767, name: "Number1", alias: "Meridian weight" },
};
const TEXT_FIELD_IDS = [188743731, 188743734, 188743737, 188743740, 188743743,
  188743746, 188743747, 188743748, 188743749, 188743750];
const baselineField = (n) => ({ id: TEXT_FIELD_IDS[n - 1], name: "Text" + n, alias: "Meridian baseline " + n });
const BASELINE_ALIAS = /^Meridian baseline (\d{1,2})$/;

/* ═══════════════════════════════════════════════════════════════════
   Dates
   ═══════════════════════════════════════════════════════════════════ */

const DAY = 86400000;
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T00:00:00Z"));

/** A day that opens something → an MSPDI start. */
export const startOut = (d) => `${d}T${DAY_START}`;
/** A day that closes [start, end) → the MSPDI finish: the day before, end of day.
    A zero-length span finishes when it starts. */
export const finishOut = (end, start) => (start && end <= start) ? `${start}T${DAY_START}` : `${addDays(end, -1)}T${DAY_FINISH}`;

const datePart = (dt) => (typeof dt === "string" && isIso(dt.slice(0, 10)) ? dt.slice(0, 10) : null);
const timePart = (dt) => (typeof dt === "string" && dt.length >= 19 ? dt.slice(11, 19) : "00:00:00");

/** An MSPDI start → the day that opens. A start at or after the end of the
    working day is the next day's (MS Project writes such starts rarely). */
export function startIn(dt, dayFinish = DAY_FINISH) {
  const d = datePart(dt);
  if (!d) return null;
  return timePart(dt) >= dayFinish ? addDays(d, 1) : d;
}
/** An MSPDI finish → the day after the last day worked. A finish at or
    before the start of the working day already IS that day after. */
export function finishIn(dt, startDt = null, dayStart = DAY_START) {
  const d = datePart(dt);
  if (!d) return null;
  if (startDt && datePart(startDt) && dt <= startDt) return startIn(startDt);
  return timePart(dt) > dayStart ? addDays(d, 1) : d;
}

/* ═══════════════════════════════════════════════════════════════════
   Durations — ISO 8601, as MSPDI writes them: PT16H0M0S
   ═══════════════════════════════════════════════════════════════════ */

export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `PT${Math.floor(m / 60)}H${m % 60}M0S`;
}
/** Minutes, or null when the text is not a duration. A day (D) is 24 h,
    a week 7 days, as ISO counts them — MS Project writes hours only. */
export function parseDuration(s) {
  const m = /^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
    .exec(String(s ?? "").trim());
  if (!m) return null;
  const n = (i) => Number(m[i] ?? 0);
  const minutes = n(2) * 525600 + n(3) * 43200 + n(4) * 10080 + n(5) * 1440 + n(6) * 60 + n(7) + n(8) / 60;
  return (m[1] ? -1 : 1) * minutes;
}

/* ═══════════════════════════════════════════════════════════════════
   XML — a writer and a tolerant reader
   ═══════════════════════════════════════════════════════════════════ */

/* Characters XML 1.0 cannot carry at all are dropped, not escaped. */
// eslint-disable-next-line no-control-regex
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const xmlEscape = (v) => String(v ?? "").replace(INVALID, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** A tiny element builder: el("Task", [el("UID", 1), …]) or el("Name", "x"). */
function el(name, content) {
  if (content === null || content === undefined) return "";
  if (Array.isArray(content)) {
    const inner = content.filter(Boolean).join("");
    return `<${name}>${inner}</${name}>`;
  }
  return `<${name}>${xmlEscape(content)}</${name}>`;
}

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
function decode(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]*);/g, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10FFFF ? String.fromCodePoint(cp) : "";
    }
    return ENTITIES[e] ?? m;   // an entity the document declares is not expanded (no entity bombs)
  });
}

/**
 * The MSPDI subset of XML: elements, attributes, text, CDATA, comments,
 * processing instructions, a DOCTYPE (skipped — its entities are never
 * expanded), the five predefined entities and character references.
 * Prefixes are kept in `name` and dropped in `local`, so
 * `<ms:Task>` and `<Task xmlns="…">` read the same.
 *
 * Tolerant where MS Project files vary (whitespace, prefixes, a stray end
 * tag), strict where tolerance would invent data: an unterminated tag or
 * a document that ends inside an element is refused.
 */
export function parseXml(src, { maxDepth = 128, maxLength = 40 * 1024 * 1024 } = {}) {
  let s = String(src ?? "");
  if (s.length > maxLength) throw new Error("The file is larger than an MS Project plan should be");
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  const doc = { name: "#document", local: "#document", attrs: {}, children: [], text: "" };
  const stack = [doc];
  const top = () => stack[stack.length - 1];
  const text = (t) => { if (stack.length > 1) top().text += decode(t); };
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) { text(s.slice(i)); break; }
    if (lt > i) text(s.slice(i, lt));
    if (s.startsWith("<!--", lt)) {
      const e = s.indexOf("-->", lt + 4);
      if (e < 0) throw new Error("A comment is never closed");
      i = e + 3; continue;
    }
    if (s.startsWith("<![CDATA[", lt)) {
      const e = s.indexOf("]]>", lt + 9);
      if (e < 0) throw new Error("A CDATA section is never closed");
      if (stack.length > 1) top().text += s.slice(lt + 9, e);
      i = e + 3; continue;
    }
    if (s.startsWith("<?", lt)) {
      const e = s.indexOf("?>", lt + 2);
      if (e < 0) throw new Error("A processing instruction is never closed");
      i = e + 2; continue;
    }
    if (s.startsWith("<!", lt)) {
      let j = lt + 2, depth = 0;
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      i = j + 1; continue;
    }
    if (s[lt + 1] === "/") {
      const e = s.indexOf(">", lt);
      if (e < 0) throw new Error("An end tag is never closed");
      const name = s.slice(lt + 2, e).trim();
      /* tolerant: close up to the matching element; a stray end tag is ignored */
      const at = stack.map((x) => x.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
      i = e + 1; continue;
    }
    let j = lt + 1, q = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === ">") break;
    }
    if (j >= s.length) throw new Error("A tag is never closed");
    let body = s.slice(lt + 1, j);
    const selfClose = body.endsWith("/");
    if (selfClose) body = body.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(body);
    if (!m) throw new Error("A tag has no name");
    const name = m[1];
    const attrs = {};
    for (const a of body.slice(name.length).matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
    }
    const node = { name, local: name.includes(":") ? name.slice(name.indexOf(":") + 1) : name, attrs, children: [], text: "" };
    top().children.push(node);
    if (!selfClose) {
      stack.push(node);
      if (stack.length > maxDepth) throw new Error("The document nests deeper than an MS Project plan does");
    }
    i = j + 1;
  }
  if (stack.length > 1) throw new Error(`The document ends inside <${top().name}> — the file is incomplete`);
  const root = doc.children[0];
  if (!root) throw new Error("The file holds no XML element");
  return root;
}

const kids = (node, name) => (node ? node.children.filter((c) => c.local === name) : []);
const kid = (node, name) => (node ? node.children.find((c) => c.local === name) ?? null : null);
const txt = (node, name) => { const k = kid(node, name); return k ? k.text.trim() : null; };
const int = (node, name, dflt = null) => { const v = txt(node, name); const n = v === null || v === "" ? NaN : Number(v); return Number.isFinite(n) ? n : dflt; };
const flag = (node, name) => { const v = txt(node, name); return v === "1" || v === "true"; };

/* ═══════════════════════════════════════════════════════════════════
   EXPORT — a project of the served book → MSPDI
   ═══════════════════════════════════════════════════════════════════ */

const SEVEN_DAYS = { name: "Meridian — calendar days (7/7)", workdays: 127, holidays: [] };

function calendarXml(uid, cal) {
  const mask = Number(cal.workdays) & 127;
  const hours = [el("WorkingTime", [el("FromTime", "08:00:00"), el("ToTime", "12:00:00")]),
    el("WorkingTime", [el("FromTime", "13:00:00"), el("ToTime", "17:00:00")])];
  const week = [1, 2, 3, 4, 5, 6, 7].map((dt) => {
    const works = (mask >> (dt - 1)) & 1;
    return el("WeekDay", [el("DayType", dt), el("DayWorking", works), works ? el("WorkingTimes", hours) : ""]);
  });
  const hol = [...(cal.holidays ?? [])].map((h) => (typeof h === "string" ? { date: h, label: "" } : h))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  /* The 2003 form (a WeekDay of type 0) and the 2007+ form (Exceptions):
     MS Project writes both, and older readers know only the first. */
  const old = hol.map((h) => el("WeekDay", [el("DayType", 0), el("DayWorking", 0),
    el("TimePeriod", [el("FromDate", `${h.date}T00:00:00`), el("ToDate", `${h.date}T23:59:00`)])]));
  const exceptions = hol.map((h) => el("Exception", [el("EnteredByOccurrences", 0),
    el("TimePeriod", [el("FromDate", `${h.date}T00:00:00`), el("ToDate", `${h.date}T23:59:00`)]),
    el("Occurrences", 1), h.label ? el("Name", h.label) : "", el("Type", 1), el("DayWorking", 0)]));
  return el("Calendar", [el("UID", uid), el("Name", cal.name || "Calendar"), el("IsBaseCalendar", 1),
    el("IsBaselineCalendar", 0), el("BaseCalendarUID", -1),
    el("WeekDays", [...week, ...old]), exceptions.length ? el("Exceptions", exceptions) : ""]);
}

/**
 * The MSPDI document for one project of `db` (the served, scoped book —
 * what the screen shows). `opts.baselines` are the project's named
 * baselines (portfolio.js loadBaselines), oldest first; the first ten go
 * to Baseline1…Baseline10, the governed baseline to Baseline 0.
 */
export function toMspdi(db, projectId, { baselines = [], now = null } = {}) {
  const p = Engine.project(db, projectId);
  if (!p) throw new Error("No such project");
  const cal = Engine.calendarFor(db, p);
  const calendar = cal ? { name: cal.name, workdays: cal.workdays, holidays: cal.holidays ?? [] } : SEVEN_DAYS;
  const clk = clock(p.start, cal ? { workdays: cal.workdays, holidays: cal.holidays ?? [] } : null);
  const span = (a, b) => (a && b && b > a ? Math.max(0, clk.span(a, b)) : 0);
  const person = (id) => (db.people ?? []).find((x) => x.id === id) ?? null;

  const rows = Engine.wbs(db, projectId);                 // outline order, summaries computed
  const milestones = Engine.milestones(db, projectId);
  const named = baselines.filter((b) => b.project === projectId).slice(0, 10);

  /* UIDs in outline order; milestones after the stages, by date. */
  const uidOf = new Map();
  rows.forEach((r, i) => uidOf.set(r.a.id, i + 1));
  milestones.forEach((m, i) => uidOf.set("M:" + m.id, rows.length + i + 1));

  const byId = new Map(rows.map((r) => [r.a.id, r.a]));
  const baselineXml = (n, start, end) => el("Baseline", [el("Number", n), el("Start", startOut(start)),
    el("Finish", finishOut(end, start)), el("Duration", fmtDuration(span(start, end) * MINUTES_PER_DAY)),
    el("DurationFormat", 7)]);
  const snapRow = (b, id) => b.rows.find((x) => x.activity === id);

  const taskXml = [];
  /* Task 0 — the project summary task, as MS Project writes it. It carries
     the governed finish as its Baseline 0 and the names of the named
     baselines, which MSPDI has no other place for. */
  taskXml.push(el("Task", [
    el("UID", 0), el("ID", 0), el("Name", p.name), el("Type", 1), el("IsNull", 0),
    el("WBS", 0), el("OutlineNumber", 0), el("OutlineLevel", 0),
    el("Start", startOut(p.start)), el("Finish", finishOut(p.finish, p.start)),
    el("Duration", fmtDuration(span(p.start, p.finish) * MINUTES_PER_DAY)), el("DurationFormat", 7),
    el("Summary", 1), el("Milestone", 0),
    el("Baseline", [el("Number", 0), el("Start", startOut(p.start)),
      el("Finish", finishOut(p.baselineFinish || p.finish, p.start))]),
    ...named.map((b, i) => el("ExtendedAttribute", [el("FieldID", baselineField(i + 1).id), el("Value", b.name)])),
  ]));

  rows.forEach((r) => {
    const a = r.a;
    const links = r.summary ? [] : (a.links ?? (a.deps ?? []).map((pred) => ({ pred, type: "FS", lag: 0 })));
    const c = a.constraint && a.constraint.type !== "ASAP" ? a.constraint : null;
    const cDate = c ? (FINISH_CONSTRAINTS.has(c.type) ? finishOut(c.date) : startOut(c.date)) : null;
    const owner = a.owner ? person(a.owner) : null;
    taskXml.push(el("Task", [
      el("UID", uidOf.get(a.id)), el("ID", uidOf.get(a.id)), el("Name", a.name),
      el("Type", 1), el("IsNull", 0),
      el("WBS", r.outline), el("OutlineNumber", r.outline), el("OutlineLevel", r.depth + 1),
      el("Priority", 500),
      el("Start", startOut(a.start)), el("Finish", finishOut(a.end, a.start)),
      el("Duration", fmtDuration(span(a.start, a.end) * MINUTES_PER_DAY)), el("DurationFormat", 7),
      a.remaining !== null && a.remaining !== undefined && !r.summary
        ? el("RemainingDuration", fmtDuration(Number(a.remaining) * MINUTES_PER_DAY)) : "",
      el("Summary", r.summary ? 1 : 0), el("Milestone", 0),
      el("PercentComplete", Math.round(Number(a.pct) || 0)),
      el("ConstraintType", c ? CONSTRAINT_OUT[c.type] : 0),
      cDate ? el("ConstraintDate", cDate) : "",
      a.deadline ? el("Deadline", finishOut(a.deadline)) : "",
      a.actualStart ? el("ActualStart", startOut(a.actualStart)) : "",
      a.actualFinish ? el("ActualFinish", finishOut(a.actualFinish, a.actualStart)) : "",
      owner ? el("Contact", owner.name) : "",
      el("CalendarUID", -1),
      ...links.filter((l) => uidOf.has(l.pred)).map((l) => el("PredecessorLink", [
        el("PredecessorUID", uidOf.get(l.pred)), el("Type", LINK_OUT[l.type] ?? 1), el("CrossProject", 0),
        el("LinkLag", Math.round(Number(l.lag) || 0) * MINUTES_PER_DAY * 10), el("LagFormat", 7)])),
      el("ExtendedAttribute", [el("FieldID", FIELD.weight.id), el("Value", r.summary ? 0 : Number(a.weight) || 0)]),
      baselineXml(0, a.baseStart ?? a.start, a.baseEnd ?? a.end),
      ...named.map((b, i) => {
        const x = snapRow(b, a.id);
        return x ? baselineXml(i + 1, x.start, x.end) : "";
      }),
    ]));
  });

  milestones.forEach((m) => {
    const owner = m.owner ? person(m.owner) : null;
    taskXml.push(el("Task", [
      el("UID", uidOf.get("M:" + m.id)), el("ID", uidOf.get("M:" + m.id)), el("Name", m.name),
      el("Type", 1), el("IsNull", 0),
      el("WBS", String(rows.filter((r) => r.depth === 0).length + milestones.indexOf(m) + 1)),
      el("OutlineNumber", String(rows.filter((r) => r.depth === 0).length + milestones.indexOf(m) + 1)),
      el("OutlineLevel", 1), el("Priority", 500),
      el("Start", startOut(m.date)), el("Finish", startOut(m.date)),
      el("Duration", fmtDuration(0)), el("DurationFormat", 7),
      el("Summary", 0), el("Milestone", 1),
      el("PercentComplete", m.done ? 100 : 0), el("ConstraintType", 0),
      owner ? el("Contact", owner.name) : "",
      el("CalendarUID", -1),
      el("Baseline", [el("Number", 0), el("Start", startOut(m.baseDate ?? m.date)),
        el("Finish", startOut(m.baseDate ?? m.date)), el("Duration", fmtDuration(0))]),
    ]));
  });

  /* Resources: the people and roles this project's stages are assigned to. */
  const actIds = new Set(rows.map((r) => r.a.id));
  const asgs = (db.assignments ?? []).filter((x) => actIds.has(x.activity));
  const resUid = new Map();
  const resources = [];
  for (const x of asgs) {
    const key = x.person ? "P:" + x.person : "R:" + x.role;
    if (resUid.has(key)) continue;
    const uid = resources.length + 1;
    resUid.set(key, uid);
    const who = x.person ? person(x.person) : null;
    resources.push(el("Resource", [
      el("UID", uid), el("ID", uid), el("Name", who ? who.name : x.role),
      el("Type", 1), el("IsNull", 0), el("IsGeneric", who ? 0 : 1),
      who && who.role ? el("Group", who.role) : "",
      el("MaxUnits", "1.00"),
    ]));
  }
  let asgUid = 0;
  const assignments = asgs.map((x) => {
    const a = byId.get(x.activity);
    const w = assignmentWork(x, a, cal);   // FX-08 bis — on the working days of the calendar exported with it
    return el("Assignment", [
      el("UID", ++asgUid), el("TaskUID", uidOf.get(x.activity)),
      el("ResourceUID", resUid.get(x.person ? "P:" + x.person : "R:" + x.role)),
      el("Units", (Number(x.units) / 100).toString()),
      el("Work", fmtDuration(w.work * MINUTES_PER_DAY)),
      el("Start", startOut(a.start)), el("Finish", finishOut(a.end, a.start)),
      x.note ? el("Notes", x.note) : "",
    ]);
  });

  const attrs = [FIELD.weight, ...named.map((_, i) => baselineField(i + 1))]
    .map((f) => el("ExtendedAttribute", [el("FieldID", f.id), el("FieldName", f.name), el("Alias", f.alias)]));

  const body = [
    el("SaveVersion", 14),
    el("Name", `${p.id}.xml`), el("Title", p.name),
    p.pm && person(p.pm) ? el("Manager", person(p.pm).name) : "",
    el("ScheduleFromStart", 1),
    el("StartDate", startOut(p.start)), el("FinishDate", finishOut(p.finish, p.start)),
    el("CalendarUID", 1),
    el("DefaultStartTime", DAY_START), el("DefaultFinishTime", DAY_FINISH),
    el("MinutesPerDay", MINUTES_PER_DAY),
    el("MinutesPerWeek", MINUTES_PER_DAY * [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + ((calendar.workdays >> d) & 1), 0)),
    el("DaysPerMonth", 20),
    el("DurationFormat", 7), el("WorkFormat", 2),
    p.statusDate ? el("StatusDate", `${p.statusDate}T${DAY_FINISH}`) : "",
    now ? el("LastSaved", String(now).slice(0, 19)) : "",
    el("ExtendedAttributes", attrs),
    el("Calendars", [calendarXml(1, calendar)]),
    el("Tasks", taskXml),
    el("Resources", resources),
    el("Assignments", assignments),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="${NS}">${body}</Project>\n`;
}

/* ═══════════════════════════════════════════════════════════════════
   IMPORT, step 1 — MSPDI → a neutral plan and what it cannot say
   ═══════════════════════════════════════════════════════════════════ */

/** The report's vocabulary. `level`:
      blocking     — nothing is written until it is resolved
      ignored      — the element is not imported
      approximated — imported, but not exactly as MS Project had it
      mapped       — imported, and here is where it went            */
const item = (level, code, subject, detail) => ({ level, code, subject: String(subject ?? ""), detail });

export const REPORT_DETAIL = {
  badXml: "The file is not an MS Project XML (MSPDI) document",
  notMspdi: "The file is XML, but its root is not an MS Project <Project>",
  noTasks: "The file holds no task",
  tooMany: "The file holds more than 5000 tasks — split the plan",
  loop: "The links form a loop — a plan with a loop has no start",
  summaryLink: "A link to or from a summary task — Meridian links the tasks under a summary, never the summary itself",
  milestoneLink: "A link to or from a milestone — a Meridian milestone carries no dependency link; its date is kept",
  crossProjectLink: "A link to another project — not imported",
  unknownLink: "A link to a task that is not in the file — not imported",
  elapsedLag: "Elapsed lag — converted to whole days",
  percentLag: "Lag given as a percentage — converted to whole days of the predecessor's duration",
  fractionalLag: "Lag of part of a day — rounded to whole days",
  hugeLag: "Lag beyond ten years — not imported",
  elapsedDuration: "Elapsed duration — kept as its dates; Meridian counts working days on the project calendar",
  fractionalDuration: "Duration of part of a day — Meridian schedules in whole days",
  alap: "As late as possible — imported as as soon as possible (Meridian has no ALAP)",
  constraintNoDate: "Constraint without a date — imported as as soon as possible",
  taskCalendar: "Task calendar — ignored; the task follows the project calendar",
  inactiveTask: "Inactive task — not imported",
  nestedMilestone: "Milestone inside a summary — placed at project level (a Meridian milestone has no parent)",
  milestoneWithDuration: "Milestone with a duration — imported as a milestone on its start date",
  emptySummary: "Summary with no task under it — imported as a plain task",
  gateMatched: "Milestone matched to the gate of the same name — the gate takes its date",
  gateNotPassed: "Gate marked complete in the file — imported as not yet passed: passing a gate is a Meridian act, on its evidence",
  actualFinishNoStart: "Actual finish without an actual start — the planned start is taken as the actual start",
  materialResource: "Material resource — not imported (Meridian assigns people and roles)",
  costResource: "Cost resource — not imported",
  resourceRates: "Resource cost rates — not imported; day rates live in Meridian's rate table (group level)",
  resourceCalendar: "Resource calendar — not imported",
  resourcePerson: "Resource matched to a person in the directory",
  resourceRole: "Resource not found in the directory — assigned as a role",
  resourceAmbiguous: "Several people in the directory carry this name — assigned as a role",
  unitsClamped: "Assignment units outside 1–200 % — clamped",
  assignmentDropped: "Assignment of a resource that is not imported — not imported",
  assignmentOrphan: "Assignment to a task or resource that is not in the file — not imported",
  costs: "Costs and fixed costs — not imported; Meridian's ledger holds costs",
  notes: "Task notes — not imported",
  extendedAttribute: "Custom field — not imported",
  weightsDerived: "Weights derived from durations — the file carries no Meridian weight",
  baselineNamed: "MS Project baseline imported as a named baseline",
  baselineUnnamed: "MS Project baselines carry no name — named after their number",
  baselineMeta: "Who took a baseline, when, why, and each stage's weight in it are not carried — the import is recorded instead, with today's weights",
  managerUnknown: "Project manager not found in the directory — none set",
  workingHours: "Working hours within the day — not imported; Meridian schedules whole days",
  workingException: "Exception that makes a day a working one — not imported (Meridian holds non-working days only)",
  recurringException: "Recurring calendar exception — not imported; add its days to the calendar",
  ownerUnknown: "Contact not found in the directory — no owner set",
  calendarInherit: "Working calendar identical to the one the project inherits — inherited",
  calendarReuse: "Working calendar identical to an existing one — reused",
  calendarCreate: "New working calendar — created with the project",
  calendarNeedsAuthority: "This working calendar does not exist in Meridian, and creating one needs group authority — ask your programme office to create it first",
  noCalendar: "No working calendar in the file — calendar days",
};
const R = (level, code, subject) => item(level, code, subject, REPORT_DETAIL[code]);

/**
 * Read an MSPDI document into a neutral plan: tasks by UID with their
 * parent UID, links, the project calendar, resources, assignments,
 * baselines — plus the report of what the reading itself had to drop or
 * approximate. Nothing here knows the directory or the database.
 */
export function readMspdi(text) {
  const report = [];
  let root;
  try { root = parseXml(text); }
  catch (e) { return { ok: false, report: [item("blocking", "badXml", String(e.message ?? e), REPORT_DETAIL.badXml)] }; }
  if (root.local !== "Project") return { ok: false, report: [R("blocking", "notMspdi", root.name)] };

  const minutesPerDay = int(root, "MinutesPerDay", MINUTES_PER_DAY) || MINUTES_PER_DAY;
  const dayStart = txt(root, "DefaultStartTime") || DAY_START;
  const dayFinish = txt(root, "DefaultFinishTime") || DAY_FINISH;
  const fin = (dt, st) => finishIn(dt, st, dayStart);
  const sta = (dt) => startIn(dt, dayFinish);

  /* custom field definitions: field id → alias (or name) */
  const aliasOf = new Map();
  for (const x of kids(kid(root, "ExtendedAttributes"), "ExtendedAttribute")) {
    const id = txt(x, "FieldID");
    if (id) aliasOf.set(id, txt(x, "Alias") || txt(x, "FieldName") || id);
  }
  const ignoredFields = new Set();

  /* ── calendars ─────────────────────────────────────────────────── */
  const calendars = new Map();
  for (const c of kids(kid(root, "Calendars"), "Calendar")) {
    const uid = txt(c, "UID");
    const base = txt(c, "BaseCalendarUID");
    let workdays = 0, hoursOdd = false;
    const holidays = new Map();
    const dropped = [];
    const days = (from, to, label) => {
      const a = datePart(from), b = datePart(to) ?? a;
      if (!a) return;
      let d = a, n = 0;
      while (d <= b && n < 3660) { holidays.set(d, label); d = addDays(d, 1); n++; }
    };
    for (const w of kids(kid(c, "WeekDays"), "WeekDay")) {
      const type = int(w, "DayType", -1);
      const working = flag(w, "DayWorking");
      if (type >= 1 && type <= 7) {
        if (working) {
          workdays |= 1 << (type - 1);
          const mins = kids(kid(w, "WorkingTimes"), "WorkingTime").reduce((n, t) => {
            const f = txt(t, "FromTime"), to = txt(t, "ToTime");
            if (!f || !to) return n;
            const m = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
            return n + ((m(to) || 1440) - m(f));
          }, 0);
          if (mins && mins !== minutesPerDay) hoursOdd = true;
        }
      } else if (type === 0) {
        const tp = kid(w, "TimePeriod");
        if (working) dropped.push(R("ignored", "workingException", `${txt(c, "Name") ?? uid} · ${datePart(txt(tp, "FromDate")) ?? "?"}`));
        else days(txt(tp, "FromDate"), txt(tp, "ToDate"), "");
      }
    }
    for (const x of kids(kid(c, "Exceptions"), "Exception")) {
      const tp = kid(x, "TimePeriod");
      const name = txt(x, "Name") ?? "";
      const label = `${txt(c, "Name") ?? uid} · ${name || datePart(txt(tp, "FromDate")) || "?"}`;
      if (flag(x, "DayWorking")) { dropped.push(R("ignored", "workingException", label)); continue; }
      const type = int(x, "Type", 1);
      if (type !== 1) { dropped.push(R("ignored", "recurringException", label)); continue; }
      days(txt(tp, "FromDate"), txt(tp, "ToDate"), name);
    }
    calendars.set(uid, {
      uid, name: txt(c, "Name") || "Calendar " + uid, base: base && base !== "-1" ? base : null,
      isBase: txt(c, "IsBaseCalendar") !== "0",
      workdays, hasWeek: kids(kid(c, "WeekDays"), "WeekDay").some((w) => int(w, "DayType", 0) >= 1),
      holidays: [...holidays].map(([date, label]) => ({ date, label })).sort((a, b) => (a.date < b.date ? -1 : 1)),
      hoursOdd, dropped,
    });
  }
  /* A derived calendar takes its base's week when it declares none. */
  const effective = (uid, seen = new Set()) => {
    const c = calendars.get(uid);
    if (!c || seen.has(uid)) return null;
    seen.add(uid);
    const b = c.base ? effective(c.base, seen) : null;
    const hol = new Map([...(b?.holidays ?? []), ...c.holidays].map((h) => [h.date, h.label]));
    return { name: c.name, workdays: c.hasWeek ? c.workdays : (b?.workdays ?? 62),
      holidays: [...hol].map(([date, label]) => ({ date, label })).sort((x, y) => (x.date < y.date ? -1 : 1)),
      hoursOdd: c.hoursOdd || !!b?.hoursOdd, dropped: [...(b?.dropped ?? []), ...c.dropped] };
  };
  const projCalUid = txt(root, "CalendarUID");
  let calendar = projCalUid ? effective(projCalUid) : null;
  if (calendar) {
    report.push(...calendar.dropped);
    if (calendar.hoursOdd) report.push(R("approximated", "workingHours", calendar.name));
    if (!calendar.workdays) calendar = null;
  }

  /* ── tasks ─────────────────────────────────────────────────────── */
  const taskNodes = kids(kid(root, "Tasks"), "Task");
  const tasks = [];
  const levelStack = [];
  let projectTask = null;
  const ignoredUids = new Set();
  const notes = [], costs = [];
  for (const t of taskNodes) {
    if (flag(t, "IsNull")) continue;
    const uid = txt(t, "UID");
    if (uid === null) continue;
    const level = int(t, "OutlineLevel", 1);
    const name = txt(t, "Name") ?? "";
    const exts = new Map();
    for (const x of kids(t, "ExtendedAttribute")) {
      const alias = aliasOf.get(txt(x, "FieldID")) ?? txt(x, "FieldID");
      exts.set(alias, txt(x, "Value"));
    }
    if (uid === "0" || level === 0) {
      projectTask = { name, exts, baseline0: kids(t, "Baseline").find((b) => int(b, "Number") === 0) ?? null };
      continue;
    }
    for (const alias of exts.keys()) {
      if (alias !== FIELD.weight.alias && !BASELINE_ALIAS.test(alias)) ignoredFields.add(alias);
    }
    if (txt(t, "Active") === "0") { ignoredUids.add(uid); report.push(R("ignored", "inactiveTask", name)); continue; }
    while (levelStack.length && levelStack[levelStack.length - 1].level >= level) levelStack.pop();
    const parent = levelStack.length ? levelStack[levelStack.length - 1].uid : null;
    levelStack.push({ level, uid });

    const startDt = txt(t, "Start"), finishDt = txt(t, "Finish");
    const durMin = parseDuration(txt(t, "Duration"));
    const durFmt = int(t, "DurationFormat", 7);
    const cType = CONSTRAINT_IN[int(t, "ConstraintType", 0)] ?? "ASAP";
    const cDt = txt(t, "ConstraintDate");
    const baselines = {};
    for (const b of kids(t, "Baseline")) {
      const n = int(b, "Number");
      const bs = txt(b, "Start"), bf = txt(b, "Finish");
      if (n === null || n < 0 || n > 10 || !datePart(bs)) continue;
      baselines[n] = { start: sta(bs), end: bf ? fin(bf, bs) : sta(bs), day: datePart(bs) };
    }
    const task = {
      uid, name, level, parent,
      summary: flag(t, "Summary"), milestone: flag(t, "Milestone"),
      /* a milestone is a point: MS Project often puts it at the END of a
         day (17:00, the finish of what it follows) — the day is its date */
      milestoneDate: datePart(startDt),
      start: sta(startDt), end: finishDt ? fin(finishDt, startDt) : sta(startDt),
      durationMinutes: durMin, elapsed: ELAPSED_FORMATS.has(durFmt),
      pct: Math.max(0, Math.min(100, Math.round(int(t, "PercentComplete", 0) ?? 0))),
      constraint: cType, constraintDate: cDt ? (FINISH_CONSTRAINTS.has(cType) ? fin(cDt) : sta(cDt)) : null,
      deadline: txt(t, "Deadline") ? fin(txt(t, "Deadline")) : null,
      actualStart: txt(t, "ActualStart") ? sta(txt(t, "ActualStart")) : null,
      actualFinish: txt(t, "ActualFinish") ? fin(txt(t, "ActualFinish"), txt(t, "ActualStart")) : null,
      remainingMinutes: parseDuration(txt(t, "RemainingDuration")),
      contact: txt(t, "Contact") || null,
      weight: exts.has(FIELD.weight.alias) ? Number(exts.get(FIELD.weight.alias)) : null,
      taskCalendar: (txt(t, "CalendarUID") ?? "-1") !== "-1",
      baselines,
      links: kids(t, "PredecessorLink").map((l) => ({
        pred: txt(l, "PredecessorUID"), type: LINK_IN[int(l, "Type", 1)] ?? "FS",
        cross: flag(l, "CrossProject"), lag: int(l, "LinkLag", 0) ?? 0, lagFormat: int(l, "LagFormat", 7),
      })),
    };
    if (!task.start) continue;
    if (txt(t, "Notes")) notes.push(name);
    if ((Number(txt(t, "Cost")) || 0) > 0 || (Number(txt(t, "FixedCost")) || 0) > 0) costs.push(name);
    tasks.push(task);
  }
  if (notes.length) report.push(R("ignored", "notes", notes.join(", ")));
  if (costs.length) report.push(R("ignored", "costs", costs.join(", ")));
  for (const f of ignoredFields) report.push(R("ignored", "extendedAttribute", f));

  /* ── resources and assignments ─────────────────────────────────── */
  const resources = [];
  for (const r of kids(kid(root, "Resources"), "Resource")) {
    if (flag(r, "IsNull")) continue;
    const uid = txt(r, "UID");
    const name = txt(r, "Name") ?? "";
    if (uid === null || uid === "0" && !name) continue;   // MS Project's placeholder resource
    const type = int(r, "Type", 1);
    const rates = ["StandardRate", "OvertimeRate", "CostPerUse"].some((k) => (Number(txt(r, k)) || 0) > 0) ||
      kids(kid(r, "Rates"), "Rate").some((x) => (Number(txt(x, "StandardRate")) || 0) > 0);
    resources.push({
      uid, name, type: type === 0 ? "material" : type === 2 ? "cost" : "work",
      email: (txt(r, "EmailAddress") || "").toLowerCase() || null,
      generic: flag(r, "IsGeneric"), group: txt(r, "Group") || "", rates,
      calendar: (txt(r, "CalendarUID") ?? "-1") !== "-1",
    });
  }
  const assignments = [];
  for (const x of kids(kid(root, "Assignments"), "Assignment")) {
    const res = txt(x, "ResourceUID");
    if (res === null || Number(res) < 0) continue;    // -65535: MS Project's "unassigned"
    const units = Number(txt(x, "Units"));
    assignments.push({
      task: txt(x, "TaskUID"), resource: res,
      units: Number.isFinite(units) ? units : 1,
      workMinutes: parseDuration(txt(x, "Work")),
      note: txt(x, "Notes") ?? "",
    });
  }

  /* ── the project ───────────────────────────────────────────────── */
  const baselineNames = {};
  if (projectTask) {
    for (const [alias, v] of projectTask.exts) {
      const m = BASELINE_ALIAS.exec(alias);
      if (m && v) baselineNames[Number(m[1])] = v;
    }
  }
  const pStart = txt(root, "StartDate");
  const pFinish = txt(root, "FinishDate");
  const b0 = projectTask?.baseline0;
  const project = {
    name: txt(root, "Title") || projectTask?.name || (txt(root, "Name") ?? "").replace(/\.(xml|mpp)$/i, "") || "Imported plan",
    start: pStart ? sta(pStart) : null,
    finish: pFinish ? fin(pFinish, pStart) : null,
    baselineFinish: b0 && txt(b0, "Finish") ? fin(txt(b0, "Finish"), txt(b0, "Start") || pStart) : null,
    statusDate: datePart(txt(root, "StatusDate")),
    manager: txt(root, "Manager") || null,
  };
  return {
    ok: true, minutesPerDay, project, calendar, tasks, resources, assignments,
    baselineNames, ignoredUids, report,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   IMPORT, step 2 — the plan against Meridian: the rows of a NEW project
   ═══════════════════════════════════════════════════════════════════ */

const rungKey = (s) => String(s ?? "").replace(/[‐-―−]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
const calKey = (c) => (!c || ((Number(c.workdays) & 127) === 127 && !(c.holidays ?? []).length))
  ? "none" : `${Number(c.workdays) & 127}|${(c.holidays ?? []).map((h) => (typeof h === "string" ? h : h.date)).sort().join(",")}`;

/**
 * `ctx`:
 *   people      [{ id, name, email? }] active directory
 *   calendars   [{ id, name, workdays, holidays }]
 *   inherited   the calendar a new project at the chosen site inherits, or null
 *   ladder      [{ n, name }] the gates the new project will be scaffolded with
 *   mayCreateCalendar  whether the account holds calendar.manage
 *
 * Returns `{ ok, report, rows }` — `ok` false when a blocking item stands.
 * `rows` uses the file's task UIDs as keys; the route turns them into ids.
 */
export function resolveImport(plan, ctx) {
  if (!plan.ok) return { ok: false, report: plan.report, rows: null };
  const report = [...plan.report];
  const tasks = plan.tasks;
  if (!tasks.length) report.push(R("blocking", "noTasks", plan.project.name));
  if (tasks.length > 5000) report.push(R("blocking", "tooMany", String(tasks.length)));
  const mpd = plan.minutesPerDay;
  const byUid = new Map(tasks.map((t) => [t.uid, t]));

  /* ── the calendar ──────────────────────────────────────────────── */
  const wanted = plan.calendar ? { name: plan.calendar.name, workdays: plan.calendar.workdays, holidays: plan.calendar.holidays } : null;
  if (!plan.calendar) report.push(R("mapped", "noCalendar", "—"));
  const key = calKey(wanted);
  let calendar;
  if (calKey(ctx.inherited) === key) {
    calendar = { mode: "inherit", id: null };
    report.push(R("mapped", "calendarInherit", ctx.inherited?.name ?? wanted?.name ?? "—"));
  } else {
    const same = (ctx.calendars ?? []).find((c) => calKey(c) === key);
    if (same) {
      calendar = { mode: "reuse", id: same.id };
      report.push(R("mapped", "calendarReuse", `${wanted?.name ?? "—"} → ${same.name}`));
    } else {
      calendar = { mode: "create", id: null, name: wanted?.name ?? SEVEN_DAYS.name,
        workdays: wanted ? wanted.workdays : 127, holidays: wanted ? wanted.holidays : [] };
      report.push(ctx.mayCreateCalendar
        ? R("mapped", "calendarCreate", calendar.name)
        : R("blocking", "calendarNeedsAuthority", calendar.name));
    }
  }
  const workCal = wanted && key !== "none" ? { workdays: wanted.workdays, holidays: wanted.holidays } : null;
  const clk = clock(tasks[0]?.start ?? "2000-01-01", workCal);
  const workdays = (t) => (t.end > t.start ? Math.max(0, clk.span(t.start, t.end)) : 0);

  /* ── which tasks are stages, summaries, milestones ─────────────── */
  const hasChildren = new Set(tasks.filter((t) => t.parent).map((t) => t.parent));
  const milestones = [];
  const stages = [];
  for (const t of tasks) {
    if (t.milestone && !hasChildren.has(t.uid)) {
      if (t.parent && byUid.has(t.parent)) report.push(R("approximated", "nestedMilestone", t.name));
      if (t.end > t.start && (t.durationMinutes ?? 0) > 0) report.push(R("approximated", "milestoneWithDuration", t.name));
      milestones.push(t);
      continue;
    }
    stages.push(t);
  }
  const stageUids = new Set(stages.map((t) => t.uid));
  /* A parent is the nearest ancestor that is a stage (a milestone is never a parent). */
  const parentOf = (t) => {
    let p = t.parent;
    while (p && !stageUids.has(p)) p = byUid.get(p)?.parent ?? null;
    return p;
  };
  const summaryUids = new Set(stages.map(parentOf).filter(Boolean));
  for (const t of stages) {
    if (t.summary && !summaryUids.has(t.uid)) report.push(R("approximated", "emptySummary", t.name));
  }
  const leaves = stages.filter((t) => !summaryUids.has(t.uid));

  for (const t of stages) {
    if (t.elapsed) report.push(R("approximated", "elapsedDuration", t.name));
    else if (t.durationMinutes !== null && !summaryUids.has(t.uid) && Math.abs(t.durationMinutes / mpd - Math.round(t.durationMinutes / mpd)) > 1e-6) {
      report.push(R("approximated", "fractionalDuration", t.name));
    }
    if (t.taskCalendar) report.push(R("ignored", "taskCalendar", t.name));
    if (t.constraint === "ALAP") report.push(R("approximated", "alap", t.name));
    else if (t.constraint !== "ASAP" && !t.constraintDate) report.push(R("approximated", "constraintNoDate", t.name));
    if (t.actualFinish && !t.actualStart) report.push(R("approximated", "actualFinishNoStart", t.name));
  }

  /* ── people: by e-mail, then by name; else a role ──────────────── */
  const people = ctx.people ?? [];
  const findPerson = (name, email) => {
    if (email) {
      const hit = people.find((p) => p.email && p.email.toLowerCase() === email);
      if (hit) return { person: hit };
    }
    const k = rungKey(name);
    if (!k) return {};
    const hits = people.filter((p) => rungKey(p.name) === k);
    return hits.length === 1 ? { person: hits[0] } : hits.length > 1 ? { ambiguous: true } : {};
  };

  /* ── weights: carried, else from durations ─────────────────────── */
  const carried = leaves.length > 0 && leaves.every((t) => Number.isFinite(t.weight));
  let weightOf;
  if (carried) weightOf = (t) => Math.max(0, Math.min(1, Number(t.weight)));
  else {
    const total = leaves.reduce((n, t) => n + Math.max(1, workdays(t)), 0) || 1;
    weightOf = (t) => Math.round(Math.max(1, workdays(t)) / total * 10000) / 10000;
    if (leaves.length) report.push(R("approximated", "weightsDerived", plan.project.name));
  }

  /* ── stages ────────────────────────────────────────────────────── */
  const owners = new Set();
  const activities = stages.map((t, i) => {
    const summary = summaryUids.has(t.uid);
    let owner = null;
    if (t.contact) {
      const f = findPerson(t.contact, null);
      if (f.person) owner = f.person.id;
      else if (!owners.has(t.contact)) { owners.add(t.contact); report.push(R("ignored", "ownerUnknown", t.contact)); }
    }
    const b0 = t.baselines[0];
    const ctype = t.constraint === "ALAP" || !t.constraintDate ? "ASAP" : t.constraint;
    const actualStart = t.actualStart ?? (t.actualFinish ? t.start : null);
    const actualFinish = t.actualFinish && actualStart && t.actualFinish < actualStart ? actualStart : t.actualFinish;
    /* What remains matters to the engine once work has started (an actual
       start or reported progress); a Meridian export carries it wherever
       it was set, and gets it back. */
    const remainingApplies = carried || !!actualStart || t.pct > 0;
    return {
      key: t.uid, name: t.name.slice(0, 200) || "(unnamed task)", stage: i,
      parentKey: parentOf(t),
      start: t.start, end: t.end < t.start ? t.start : t.end,
      baseStart: b0?.start ?? t.start, baseEnd: b0 && b0.end >= b0.start ? b0.end : (t.end < t.start ? t.start : t.end),
      /* A summary is stored with no weight and no progress of its own (062). */
      weight: summary ? 0 : weightOf(t), pct: summary ? 0 : t.pct,
      owner,
      constraintType: summary ? "ASAP" : ctype, constraintDate: summary || ctype === "ASAP" ? null : t.constraintDate,
      deadline: summary ? null : t.deadline,
      actualStart: summary ? null : actualStart, actualFinish: summary ? null : actualFinish,
      remaining: !summary && remainingApplies && t.remainingMinutes !== null && t.remainingMinutes >= 0
        ? Math.min(3650, Math.round(t.remainingMinutes / mpd)) : null,
    };
  });

  /* ── links: between stages that are not summaries ──────────────── */
  const links = [];
  const milestoneUids = new Set(milestones.map((m) => m.uid));
  for (const t of tasks) {
    for (const l of t.links) {
      const label = `${byUid.get(l.pred)?.name ?? l.pred} → ${t.name}`;
      if (l.cross) { report.push(R("ignored", "crossProjectLink", label)); continue; }
      if (plan.ignoredUids.has(l.pred) || plan.ignoredUids.has(t.uid)) continue;
      if (!byUid.has(l.pred)) { report.push(R("ignored", "unknownLink", label)); continue; }
      if (milestoneUids.has(l.pred) || milestoneUids.has(t.uid)) { report.push(R("ignored", "milestoneLink", label)); continue; }
      if (summaryUids.has(l.pred) || summaryUids.has(t.uid)) { report.push(R("ignored", "summaryLink", label)); continue; }
      if (links.some((x) => x.succKey === t.uid && x.predKey === l.pred)) continue;
      let lag;
      if (PERCENT_FORMATS.has(l.lagFormat)) {
        const pred = byUid.get(l.pred);
        lag = Math.round((l.lag / 10) / 100 * workdays(pred));
        report.push(R("approximated", "percentLag", label));
      } else if (ELAPSED_FORMATS.has(l.lagFormat)) {
        lag = Math.round(l.lag / 10 / 1440);
        report.push(R("approximated", "elapsedLag", label));
      } else {
        const exact = l.lag / 10 / mpd;
        lag = Math.round(exact);
        if (Math.abs(exact - lag) > 1e-6) report.push(R("approximated", "fractionalLag", label));
      }
      if (Math.abs(lag) > 3650) { report.push(R("ignored", "hugeLag", label)); continue; }
      links.push({ succKey: t.uid, predKey: l.pred, type: l.type, lag });
    }
  }
  /* a loop has no early start: refuse it rather than write it */
  const preds = new Map();
  for (const l of links) { if (!preds.has(l.succKey)) preds.set(l.succKey, []); preds.get(l.succKey).push(l.predKey); }
  const state = new Map();
  const cyclic = (u) => {
    if (state.get(u) === 1) return true;
    if (state.get(u) === 2) return false;
    state.set(u, 1);
    const hit = (preds.get(u) ?? []).some(cyclic);
    state.set(u, 2);
    return hit;
  };
  const looped = [...preds.keys()].find((u) => cyclic(u));
  if (looped) report.push(R("blocking", "loop", byUid.get(looped)?.name ?? looped));

  /* ── milestones, and the gates of the same name ────────────────── */
  const gatesLeft = new Map((ctx.ladder ?? []).map((g) => [rungKey(g.name), g]));
  const mrows = milestones.map((m) => {
    const g = gatesLeft.get(rungKey(m.name));
    if (g) {
      gatesLeft.delete(rungKey(m.name));
      report.push(R("mapped", "gateMatched", m.name));
      if (m.pct >= 100) report.push(R("approximated", "gateNotPassed", m.name));
    }
    let owner = null;
    if (m.contact) {
      const f = findPerson(m.contact, null);
      if (f.person) owner = f.person.id;
      else if (!owners.has(m.contact)) { owners.add(m.contact); report.push(R("ignored", "ownerUnknown", m.contact)); }
    }
    return { key: m.uid, name: m.name.slice(0, 200) || "(unnamed milestone)", date: m.milestoneDate ?? m.start,
      baseDate: m.baselines[0]?.day ?? m.milestoneDate ?? m.start, done: !g && m.pct >= 100, owner, gate: g ? g.n : null };
  });

  /* ── resources and assignments ─────────────────────────────────── */
  const resOut = new Map();
  for (const r of plan.resources) {
    if (r.type !== "work") { report.push(R("ignored", r.type === "material" ? "materialResource" : "costResource", r.name)); continue; }
    if (r.rates) report.push(R("ignored", "resourceRates", r.name));
    if (r.calendar) report.push(R("ignored", "resourceCalendar", r.name));
    if (!r.generic) {
      const f = findPerson(r.name, r.email);
      if (f.person) { resOut.set(r.uid, { person: f.person.id, role: "" }); report.push(R("mapped", "resourcePerson", `${r.name} → ${f.person.name}`)); continue; }
      if (f.ambiguous) report.push(R("approximated", "resourceAmbiguous", r.name));
      else report.push(R("approximated", "resourceRole", r.name));
    }
    resOut.set(r.uid, { person: null, role: (r.name || r.group || "Resource").slice(0, 120) });
  }
  const resTypes = new Map(plan.resources.map((r) => [r.uid, r.type]));
  const stageKeys = new Set(activities.map((a) => a.key));
  const actByKey = new Map(activities.map((a) => [a.key, a]));
  const asgs = [];
  for (const x of plan.assignments) {
    const who = resOut.get(x.resource);
    const tname = byUid.get(x.task)?.name ?? x.task;
    if (!who) {
      report.push(resTypes.has(x.resource)
        ? R("ignored", "assignmentDropped", tname)
        : R("ignored", "assignmentOrphan", tname));
      continue;
    }
    if (!stageKeys.has(x.task)) { report.push(R("ignored", "assignmentOrphan", tname)); continue; }
    let units = Math.round(x.units * 100);
    if (units < 1 || units > 200) { report.push(R("approximated", "unitsClamped", tname)); units = Math.max(1, Math.min(200, units)); }
    const a = actByKey.get(x.task);
    /* FX-08 bis — the work Meridian will compute on the project's calendar
       (the one resolved above), so a file whose Work is duration × units
       comes in as computed, not as typed. */
    const computed = workingDuration(a.start, a.end, workCal) * units / 100;
    const typed = x.workMinutes === null ? null : Math.round(x.workMinutes / mpd * 100) / 100;
    asgs.push({ actKey: x.task, person: who.person, role: who.role, units,
      work: typed === null || Math.abs(typed - computed) < 0.01 ? null : typed, note: x.note.slice(0, 500) });
  }

  /* ── baselines 1…10 → named baselines ──────────────────────────── */
  const snapshots = [];
  let unnamed = false;
  for (let n = 1; n <= 10; n++) {
    const rows = activities.filter((a) => byUid.get(a.key).baselines[n]).map((a) => {
      const b = byUid.get(a.key).baselines[n];
      return { actKey: a.key, start: b.start, end: b.end < b.start ? b.start : b.end };
    });
    if (!rows.length) continue;
    const name = plan.baselineNames[n] || `MS Project baseline ${n}`;
    if (!plan.baselineNames[n]) unnamed = true;
    snapshots.push({ n, name: name.slice(0, 120), rows });
    report.push(R("mapped", "baselineNamed", `Baseline ${n} → ${name}`));
  }
  if (unnamed) report.push(R("approximated", "baselineUnnamed", plan.project.name));
  if (snapshots.length) report.push(R("approximated", "baselineMeta", plan.project.name));

  const starts = activities.map((a) => a.start).concat(mrows.map((m) => m.date)).filter(Boolean).sort();
  const ends = activities.map((a) => a.end).concat(mrows.map((m) => m.date)).filter(Boolean).sort();
  const start = plan.project.start ?? starts[0] ?? null;
  let finish = plan.project.finish ?? ends[ends.length - 1] ?? start;
  if (start && finish && finish < start) finish = start;

  let pm = null;
  if (plan.project.manager) {
    const f = findPerson(plan.project.manager, null);
    if (f.person) pm = f.person.id;
    else report.push(R("ignored", "managerUnknown", plan.project.manager));
  }

  const ok = !report.some((x) => x.level === "blocking");
  return {
    ok, report,
    rows: {
      project: { name: plan.project.name.slice(0, 200), start, finish,
        baselineFinish: plan.project.baselineFinish && plan.project.baselineFinish >= start ? plan.project.baselineFinish : finish,
        statusDate: plan.project.statusDate, pm },
      calendar, activities, links, milestones: mrows, assignments: asgs, snapshots,
    },
    counts: {
      tasks: activities.length, summaries: summaryUids.size, milestones: mrows.length,
      links: links.length, assignments: asgs.length, baselines: snapshots.length,
      holidays: calendar.mode === "create" ? calendar.holidays.length : 0,
    },
  };
}

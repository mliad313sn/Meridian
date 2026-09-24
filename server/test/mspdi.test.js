/**
 * FX-13 · MS PROJECT IN AND OUT  (docs/41 §3, wave D)
 *
 * Three things, in the order a planner meets them:
 *
 *   1. The mapping, by hand-worked example — the dates, the durations,
 *      the lags, the XML reader (namespaces, entities, CDATA, a DOCTYPE
 *      whose entities must NOT be expanded).
 *   2. A file shaped like MS Project 2016's own output, imported field by
 *      field, with its report naming every element it drops or bends.
 *   3. F13 · MSPDI — the round trip, in the family of roundtrip.test.js:
 *      a Meridian project carrying every schedule feature (typed links
 *      with lag, a working calendar with holidays, every constraint, a
 *      deadline, actuals and remaining, a three-level breakdown, owners,
 *      person and role assignments with typed and computed work, two
 *      named baselines, gates and a milestone) goes out as MSPDI and comes
 *      back as a NEW project that is the same plan — tree, links, dates,
 *      engine numbers — except what the import report names.
 *
 * And the constitution: import asks `project.create` (a site lead imports
 * at their own site), a calendar Meridian does not have needs
 * `calendar.manage`, a dry run writes nothing, the real import writes one
 * audited transaction of NEW rows and moves no existing number (D-41.01).
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, shutdown, as } from "./harness.js";
import { query } from "../src/db.js";
import {
  parseXml, readMspdi, fmtDuration, parseDuration, startOut, finishOut, startIn, finishIn,
  LINK_OUT, REPORT_DETAIL,
} from "../src/mspdi.js";
import { Engine } from "../../shared/engine.js";
import { MSPDI_FR, MSPDI_ES } from "../src/i18n-mspdi.js";

const FIXTURE = readFileSync(new URL("./fixtures/ms-project-2016.xml", import.meta.url), "utf8");

before(async () => { await boot(); });
after(shutdown);

const count = async (sql) => Number((await query(sql)).rows[0].n);
const bookOf = async (c) => (await c.get("/api/bootstrap")).body.db;

/* ═══════════════════════════════════════════════════════════════════
   1 · the mapping, worked by hand
   ═══════════════════════════════════════════════════════════════════ */

describe("FX-13 · the mapping, by worked example", () => {
  test("a stage [2 Mar, 7 Mar) is Start 2 Mar 08:00, Finish 6 Mar 17:00 — and comes back to the day", () => {
    /* Meridian's end is the day the successor may start (FS/0 puts it ON
       the end); MS Project writes the last day worked, at its close. */
    assert.equal(startOut("2026-03-02"), "2026-03-02T08:00:00");
    assert.equal(finishOut("2026-03-07", "2026-03-02"), "2026-03-06T17:00:00");
    assert.equal(startIn("2026-03-02T08:00:00"), "2026-03-02");
    assert.equal(finishIn("2026-03-06T17:00:00", "2026-03-02T08:00:00"), "2026-03-07");
    /* a zero-length stage finishes when it starts, both ways */
    assert.equal(finishOut("2026-03-02", "2026-03-02"), "2026-03-02T08:00:00");
    assert.equal(finishIn("2026-03-02T08:00:00", "2026-03-02T08:00:00"), "2026-03-02");
    /* a finish at the start of a day already is that day-after */
    assert.equal(finishIn("2026-03-05T08:00:00", "2026-03-02T08:00:00"), "2026-03-05");
    /* a start at the close of a day is the next day's */
    assert.equal(startIn("2026-03-06T17:00:00"), "2026-03-07");
  });

  test("durations are working time: 5 days = PT40H0M0S at 480 minutes a day", () => {
    assert.equal(fmtDuration(5 * 480), "PT40H0M0S");
    assert.equal(fmtDuration(450), "PT7H30M0S");
    assert.equal(parseDuration("PT40H0M0S"), 2400);
    assert.equal(parseDuration("PT7H30M0S"), 450);
    assert.equal(parseDuration("P1DT2H"), 1560);
    assert.equal(parseDuration("-PT8H0M0S"), -480);
    assert.equal(parseDuration("forty hours"), null);
  });

  test("link types and lags: SS+2d is Type 3, LinkLag 9600; FF−1d is Type 0, LinkLag −4800 (tenths of a minute)", () => {
    assert.deepEqual(LINK_OUT, { FF: 0, FS: 1, SF: 2, SS: 3 });
    assert.equal(2 * 480 * 10, 9600);
    const plan = readMspdi(FIXTURE);
    const byName = new Map(plan.tasks.map((t) => [t.name, t]));
    assert.deepEqual(byName.get("Software configuration").links.map(({ type, lag, lagFormat }) => ({ type, lag, lagFormat })),
      [{ type: "SS", lag: 9600, lagFormat: 7 }]);
    assert.deepEqual(byName.get("Factory acceptance test (réception usine)").links.map(({ type, lag }) => ({ type, lag })),
      [{ type: "FF", lag: -4800 }]);
  });

  test("the reader: prefixes dropped, entities and character references decoded, CDATA kept, comments skipped", () => {
    const root = parseXml(`<?xml version="1.0"?>
      <!-- saved by a tool -->
      <p:Project xmlns:p="http://schemas.microsoft.com/project">
        <p:Tasks><p:Task a="1" b='x &amp; y'><p:Name>A &amp; B &#233;&#x2014; &lt;x&gt;</p:Name>
          <p:Notes><![CDATA[<b>bold</b> & raw]]></p:Notes><p:Empty/></p:Task></p:Tasks>
      </p:Project>`);
    assert.equal(root.local, "Project");
    const task = root.children[0].children[0];
    assert.equal(task.local, "Task");
    assert.deepEqual(task.attrs, { a: "1", b: "x & y" });
    assert.equal(task.children[0].text, "A & B é— <x>");
    assert.equal(task.children[1].text, "<b>bold</b> & raw");
    assert.equal(task.children[2].local, "Empty");
  });

  test("the reader never expands an entity a document declares (no entity bomb), and refuses a truncated file", () => {
    const root = parseXml(`<!DOCTYPE Project [<!ENTITY boom "BOOM BOOM">]><Project><Name>&boom;</Name></Project>`);
    assert.equal(root.children[0].text, "&boom;");
    assert.throws(() => parseXml("<Project><Tasks><Task>"), /ends inside/);
    assert.throws(() => parseXml("<Project><Task"), /never closed/);
    assert.equal(readMspdi("not xml at all").report[0].code, "badXml");
    assert.equal(readMspdi("<Plan/>").report[0].code, "notMspdi");
  });
});

describe("FX-13 · the report speaks the reader's language", () => {
  test("every sentence of the report has its French and its Spanish", () => {
    const missing = Object.values(REPORT_DETAIL).filter((en) => !MSPDI_FR[en] || !MSPDI_ES[en]);
    assert.deepEqual(missing, []);
  });

  test("a dry run asked in French answers in French; the audit record would stay in English", async () => {
    const lead = await as("groupDCH");
    const r = await lead.post("/api/import/mspdi", { xml: FIXTURE, dryRun: true, programme: "DCH", site: "GRU" }, { "x-lang": "fr" });
    assert.equal(r.status, 200);
    const inactive = r.body.report.find((x) => x.code === "inactiveTask");
    assert.equal(inactive.detail, "Tâche inactive — non importée");
    const refused = await lead.post("/api/import/mspdi", { xml: "<Plan/>", programme: "DCH", site: "GRU" }, { "x-lang": "es" });
    assert.equal(refused.status, 422);
    assert.match(refused.body.error, /^No se importó nada — El archivo es XML/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2 · authority, and a dry run writes nothing
   ═══════════════════════════════════════════════════════════════════ */

describe("FX-13 · who may import, and the dry run", () => {
  test("a viewer is refused; a site lead is refused another site's project", async () => {
    const viewer = await as("viewerGRU");
    const r1 = await viewer.post("/api/import/mspdi", { xml: FIXTURE, dryRun: true, programme: "DCH", site: "GRU" });
    assert.equal(r1.status, 403);
    const silva = await as("siteGRU");
    const r2 = await silva.post("/api/import/mspdi", { xml: FIXTURE, dryRun: true, programme: "DCH", site: "YYZ" });
    assert.equal(r2.status, 403);
    const r3 = await silva.post("/api/import/mspdi", { xml: FIXTURE, dryRun: true, programme: "DCH", site: "GRU", governanceLevel: "group" });
    assert.equal(r3.status, 403, "a site lead cannot create a group project, by import or by hand");
  });

  test("a site lead's dry run at their site says the calendar needs group authority — and the real import writes nothing", async () => {
    const silva = await as("siteGRU");
    const before = await Promise.all(["project", "activity", "work_calendar", "audit_event"].map((t) => count(`SELECT count(*) AS n FROM ${t}`)));
    const dry = await silva.post("/api/import/mspdi", { xml: FIXTURE, dryRun: true, programme: "DCH", site: "GRU" });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.dryRun, true);
    assert.equal(dry.body.ok, false);
    assert.deepEqual(dry.body.report.filter((x) => x.level === "blocking").map((x) => [x.code, x.subject]),
      [["calendarNeedsAuthority", "Standard"]]);
    const real = await silva.post("/api/import/mspdi", { xml: FIXTURE, programme: "DCH", site: "GRU" });
    assert.equal(real.status, 422);
    assert.match(real.body.error, /Nothing was imported/);
    const after = await Promise.all(["project", "activity", "work_calendar", "audit_event"].map((t) => count(`SELECT count(*) AS n FROM ${t}`)));
    assert.deepEqual(after, before, "neither the dry run nor the refused import wrote a row");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3 · a file shaped like MS Project 2016's, field by field
   ═══════════════════════════════════════════════════════════════════ */

describe("FX-13 · an MS Project 2016 file comes in", () => {
  let id = null, db = null, report = null;
  before(async () => {
    const lead = await as("groupDCH");
    const r = await lead.post("/api/import/mspdi", { xml: FIXTURE, programme: "DCH", site: "GRU" });
    assert.equal(r.status, 201, r.text);
    id = r.body.id;
    report = r.body.report;
    db = await bookOf(lead);
  });

  test("the report names every element ignored or approximated", () => {
    const named = report.filter((x) => x.level !== "mapped").map((x) => `${x.level} ${x.code} · ${x.subject}`).sort();
    assert.deepEqual(named, [
      "approximated alap · Documentation",
      "approximated baselineMeta · Mill PLC upgrade",
      "approximated baselineUnnamed · Mill PLC upgrade",
      "approximated elapsedDuration · Concrete curing",
      "approximated resourceRole · Contractor Z",
      "approximated weightsDerived · Mill PLC upgrade",
      "ignored assignmentDropped · Site installation",
      "ignored costs · Site installation",
      "ignored extendedAttribute · Cost centre",
      "ignored inactiveTask · Commissioning review",
      "ignored materialResource · Cable (m)",
      "ignored milestoneLink · Site installation → Plant handover",
      "ignored notes · Site installation",
      "ignored ownerUnknown · Unknown Planner",
      "ignored resourceCalendar · Silva, G.",
      "ignored resourceRates · Silva, G.",
      "ignored taskCalendar · Documentation",
    ]);
    for (const x of report) assert.equal(x.detail, REPORT_DETAIL[x.code], "every item carries its sentence");
  });

  test("the project: name, window, status date, manager by name, and the calendar with its holiday", () => {
    const p = Engine.project(db, id);
    assert.equal(p.name, "Mill PLC upgrade");
    assert.equal(p.start, "2026-03-02");
    assert.equal(p.finish, "2026-04-14");      // last day worked 13 Apr → the day after
    assert.equal(p.statusDate, "2026-03-20");
    assert.equal(p.pm, "PE-01");               // <Manager>D. Osei</Manager>
    assert.equal(p.method, "Waterfall");
    const cal = Engine.calendarFor(db, p);
    assert.equal(cal.name, "Standard");
    assert.equal(cal.workdays, 62);             // Monday to Friday
    assert.deepEqual(cal.holidays, [{ date: "2026-04-06", label: "Easter Monday" }]);
  });

  test("tasks: the summary becomes a parent, dates to the day, constraints, deadline, actuals, remaining", () => {
    const rows = Engine.wbs(db, id);
    const at = (name) => rows.find((r) => r.a.name === name);
    assert.deepEqual(rows.map((r) => [r.outline, r.a.name, r.summary]), [
      ["1", "Design & build", true],
      ["1.1", "Detailed design", false],
      ["1.2", "Panel fabrication", false],
      ["1.3", "Software configuration", false],
      ["1.4", "Factory acceptance test (réception usine)", false],
      ["1.5", "Concrete curing", false],
      ["2", "Site installation", false],
      ["3", "Documentation", false],
    ]);
    const s = at("Design & build").a;
    assert.deepEqual([s.start, s.end], ["2026-03-02", "2026-03-21"], "a summary's dates are its children's");
    const d = at("Detailed design").a;
    assert.deepEqual([d.start, d.end, d.pct, d.actualStart, d.actualFinish, d.owner],
      ["2026-03-02", "2026-03-07", 100, "2026-03-02", "2026-03-07", "PE-06"]);   // Contact M. Fischer
    const f = at("Panel fabrication").a;
    assert.deepEqual([f.start, f.end, f.pct, f.actualStart, f.actualFinish, f.remaining],
      ["2026-03-09", "2026-03-21", 40, "2026-03-09", null, 6]);                 // PT48H = 6 days
    assert.deepEqual(f.links, [{ pred: at("Detailed design").a.id, type: "FS", lag: 0 }]);
    const sw = at("Software configuration").a;
    assert.deepEqual(sw.links, [{ pred: f.id, type: "SS", lag: 2 }]);
    assert.deepEqual(sw.constraint, { type: "SNET", date: "2026-03-11" });
    const fat = at("Factory acceptance test (réception usine)").a;
    assert.deepEqual(fat.links, [{ pred: sw.id, type: "FF", lag: -1 }]);
    assert.equal(fat.deadline, "2026-03-28");      // 27 Mar 17:00, the day-after rule
    assert.deepEqual([fat.start, fat.end], ["2026-03-17", "2026-03-20"]);
    const site = at("Site installation").a;
    assert.equal(site.parentId, null);
    assert.deepEqual(site.constraint, { type: "MSO", date: "2026-03-30" });
    assert.deepEqual([site.start, site.end], ["2026-03-30", "2026-04-14"]);   // ten working days over Easter Monday
    assert.equal(at("Documentation").a.constraint, null, "ALAP comes in as ASAP, and the report says so");
    const curing = at("Concrete curing").a;
    assert.deepEqual([curing.start, curing.end, curing.actualFinish], ["2026-03-02", "2026-03-05", "2026-03-05"]);
  });

  test("the engine reads the imported plan on its calendar: SS+2 and FF−1 give the dates MS Project gave", () => {
    const idOf = (name) => db.activities.find((a) => a.project === id && a.name === name).id;
    /* Planned, before any progress (no status date): Software
       configuration starts two working days after Panel fabrication
       starts (Mon 9 → Wed 11) and runs 8 working days to Fri 20 (end
       Sat 21); FAT finishes one working day before it — Thu 19, so its
       end is Fri 20. Site installation is held on its MSO date and runs
       ten working days over Easter Monday. */
    const planned = { ...db, projects: db.projects.map((p) => (p.id === id ? { ...p, statusDate: null } : p)) };
    const cp = Engine.criticalPath(planned, id);
    assert.equal(cp.dates[idOf("Software configuration")].es, "2026-03-11");
    assert.equal(cp.dates[idOf("Software configuration")].ef, "2026-03-21");
    assert.equal(cp.dates[idOf("Factory acceptance test (réception usine)")].ef, "2026-03-20");
    assert.equal(cp.dates[idOf("Factory acceptance test (réception usine)")].es, "2026-03-17");
    assert.equal(cp.dates[idOf("Site installation")].es, "2026-03-30");
    assert.equal(cp.dates[idOf("Site installation")].ef, "2026-04-14");
    /* At the file's status date (Fri 20 Mar), unstarted work cannot
       start in the past (FX-04): the configuration, not begun, moves to
       the status date. The imported status date is live. */
    const live = Engine.criticalPath(db, id);
    assert.equal(live.dates[idOf("Software configuration")].es, "2026-03-20");
  });

  test("weights come from working durations when the file carries none; they sum to one", () => {
    const leaves = Engine.activities(db, id);
    const w = Object.fromEntries(leaves.map((a) => [a.name, a.weight]));
    assert.equal(w["Detailed design"], 0.1163);          // 5 of 43 working days
    assert.equal(w["Panel fabrication"], 0.2326);        // 10 of 43
    assert.equal(w["Site installation"], 0.2326);        // 10 of 43, Easter Monday not counted
    assert.ok(Math.abs(leaves.reduce((n, a) => n + a.weight, 0) - 1) < 0.001);
  });

  test("milestones: an ordinary one, and one that bears a gate's name gives the gate its date", () => {
    const ms = Engine.milestones(db, id).map((m) => [m.name, m.date, m.gate]);
    assert.ok(ms.some(([n, d, g]) => n === "Plant handover" && d === "2026-04-13" && g === null));
    assert.ok(ms.some(([n, d, g]) => n === "Gate 3 — Readiness" && d === "2026-03-27" && g === 3));
    assert.equal(ms.filter(([n]) => n === "Gate 3 — Readiness").length, 1, "no duplicate of the gate");
  });

  test("assignments: by e-mail, by name, a generic resource as a role; work kept where it differs", () => {
    const acts = new Map(db.activities.filter((a) => a.project === id).map((a) => [a.id, a.name]));
    const asg = db.assignments.filter((x) => acts.has(x.activity))
      .map((x) => [acts.get(x.activity), x.person, x.role, x.units, x.work, x.note]).sort();
    assert.deepEqual(asg, [
      ["Detailed design", "PE-19", null, 100, null, ""],                   // Silva, G. — by e-mail; 40 h = computed
      ["Factory acceptance test (réception usine)", null, "Contractor Z", 100, null, ""],
      ["Panel fabrication", null, "Electrician", 200, 20, "Two-person crew"], // 160 h = 20 d ≠ 12 d × 2
      ["Software configuration", "PE-03", null, 50, 4, ""],                // S. Ibarra — by name
    ]);
  });

  test("Baseline 0 is the governed baseline; Baseline 1 a named baseline", async () => {
    const d = db.activities.find((a) => a.project === id && a.name === "Detailed design");
    assert.deepEqual([d.baseStart, d.baseEnd], ["2026-03-02", "2026-03-07"]);
    const lead = await as("groupDCH");
    const b = (await lead.get(`/api/projects/${id}/baselines`)).body.baselines;
    assert.deepEqual(b.map((x) => x.name), ["MS Project baseline 1"]);
    assert.deepEqual(b[0].rows.map((r) => [r.activity, r.start, r.end]), [[d.id, "2026-02-23", "2026-02-28"]]);
    assert.match(b[0].reason, /Imported from MS Project \(Baseline 1\)/);
  });

  test("the import is one audited act, under the account that did it", async () => {
    const rows = (await query(`SELECT user_id, action, detail FROM audit_event WHERE entity = 'project' AND entity_id = $1`, [id])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, "Project imported from MS Project");
    assert.equal(rows[0].user_id, "U-MARC");
    assert.match(rows[0].detail, /8 stage\(s\), 2 milestone\(s\), 4 link\(s\), 4 assignment\(s\), 1 baseline\(s\)/);
  });

  test("now the calendar exists, the site lead's import reuses it and goes through", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post("/api/import/mspdi", { xml: FIXTURE, programme: "DCH", site: "GRU", name: "Mill PLC upgrade — site copy" });
    assert.equal(r.status, 201, r.text);
    assert.deepEqual(r.body.report.filter((x) => x.code.startsWith("calendar")).map((x) => x.code), ["calendarReuse"]);
    const db2 = await bookOf(silva);
    assert.equal(Engine.project(db2, r.body.id).name, "Mill PLC upgrade — site copy");
    assert.equal(Engine.project(db2, r.body.id).calendar, Engine.project(db, id).calendar);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   4 · F13 · MSPDI — Meridian → MS Project → Meridian
   ═══════════════════════════════════════════════════════════════════ */

/* Every schedule feature the engine reads, given a value that is not its
   default, on one project (the F13 ENRICH idea: a round trip only proves
   what the book holds). */
const SRC = "PRJ-101";
const ENRICH = [
  `INSERT INTO work_calendar (id, name, work_days, note) VALUES ('CAL-FX13', 'Kraków site', 62, 'probe')`,
  `INSERT INTO work_calendar_exception (calendar_id, on_date, label)
   VALUES ('CAL-FX13', '2026-05-01', 'Labour Day'), ('CAL-FX13', '2026-11-11', 'Independence Day')`,
  `UPDATE project SET calendar_id = 'CAL-FX13', status_date = '2026-08-20' WHERE id = '${SRC}'`,
  `UPDATE activity SET actual_start = start_date, actual_finish = start_date + 10, pct = 100 WHERE id = '${SRC}-A1'`,
  `UPDATE activity SET actual_start = start_date, remaining_days = 12, pct = 35 WHERE id = '${SRC}-A2'`,
  `UPDATE activity SET constraint_type = 'SNET', constraint_date = start_date + 1, deadline = end_date + 5, owner_id = 'PE-03' WHERE id = '${SRC}-A3'`,
  `UPDATE activity SET constraint_type = 'FNLT', constraint_date = end_date + 2, owner_id = NULL WHERE id = '${SRC}-A4'`,
  `UPDATE activity SET constraint_type = 'MSO', constraint_date = start_date WHERE id = '${SRC}-A5'`,
  `UPDATE activity SET constraint_type = 'MFO', constraint_date = end_date WHERE id = '${SRC}-A6'`,
  `UPDATE activity SET constraint_type = 'SNLT', constraint_date = start_date + 3 WHERE id = '${SRC}-A7'`,
  `UPDATE activity SET constraint_type = 'FNET', constraint_date = end_date - 1, base_start = start_date - 7 WHERE id = '${SRC}-A8'`,
  /* three typed links with lag (and leads) */
  `UPDATE activity_dep SET type = 'SS', lag_days = -2 WHERE (activity_id, predecessor_id) =
     (SELECT activity_id, predecessor_id FROM activity_dep WHERE activity_id LIKE '${SRC}-%' ORDER BY activity_id, predecessor_id LIMIT 1)`,
  `UPDATE activity_dep SET type = 'FF', lag_days = 3 WHERE (activity_id, predecessor_id) =
     (SELECT activity_id, predecessor_id FROM activity_dep WHERE activity_id LIKE '${SRC}-%' ORDER BY activity_id, predecessor_id OFFSET 1 LIMIT 1)`,
  `UPDATE activity_dep SET type = 'SF', lag_days = 1 WHERE (activity_id, predecessor_id) =
     (SELECT activity_id, predecessor_id FROM activity_dep WHERE activity_id LIKE '${SRC}-%' ORDER BY activity_id, predecessor_id OFFSET 2 LIMIT 1)`,
  /* a three-level breakdown: a summary over a summary over a stage, and a
     sibling stage linked SS+3 to it */
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct)
   VALUES ('FX13-S1', '${SRC}', 'Cut-over programme', 50, '2026-09-01', '2026-10-15', '2026-09-01', '2026-10-15', 0, 0)`,
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct, parent_id)
   VALUES ('FX13-S2', '${SRC}', 'Rehearsals', 51, '2026-09-01', '2026-09-20', '2026-09-01', '2026-09-20', 0, 0, 'FX13-S1')`,
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct, parent_id, owner_id)
   VALUES ('FX13-L1', '${SRC}', 'Dress rehearsal & rollback', 52, '2026-09-01', '2026-09-20', '2026-08-25', '2026-09-14', 0.05, 20, 'FX13-S2', 'PE-01')`,
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct, parent_id)
   VALUES ('FX13-L2', '${SRC}', 'Go-live weekend', 53, '2026-09-24', '2026-10-15', '2026-09-24', '2026-10-15', 0.03, 0, 'FX13-S1')`,
  `INSERT INTO activity_dep (activity_id, predecessor_id, type, lag_days) VALUES ('FX13-L2', 'FX13-L1', 'SS', 3)`,
  /* a person with typed work and a note, a role computed, a person computed */
  `INSERT INTO assignment (id, activity_id, person_id, role_label, units, work_days, note)
   VALUES ('ASG-FX1', '${SRC}-A2', 'PE-01', '', 60, 7.5, 'Night shift only'),
          ('ASG-FX2', 'FX13-L1', NULL, 'Welder', 150, NULL, ''),
          ('ASG-FX3', '${SRC}-A3', 'PE-03', '', 100, NULL, '')`,
  /* two named baselines, the second one moved */
  `INSERT INTO baseline_snapshot (id, project_id, name, taken_at, taken_by, reason)
   VALUES ('BSL-FX1', '${SRC}', 'Approved plan', '2026-06-01T09:00:00Z', 'U-ADMIN', 'Gate 2 sign-off'),
          ('BSL-FX2', '${SRC}', 'After re-plan 1', '2026-07-01T09:00:00Z', 'U-ADMIN', 'Vendor slip')`,
  `INSERT INTO baseline_snapshot_row (snapshot_id, activity_id, name, parent_id, start_date, end_date, weight)
   SELECT 'BSL-FX1', id, name, parent_id, start_date, end_date, weight FROM activity WHERE project_id = '${SRC}'`,
  `INSERT INTO baseline_snapshot_row (snapshot_id, activity_id, name, parent_id, start_date, end_date, weight)
   SELECT 'BSL-FX2', id, name, parent_id, start_date + 7, end_date + 9, weight FROM activity WHERE project_id = '${SRC}'`,
  /* an ordinary milestone, passed, whose date moved from its baseline */
  `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, done)
   VALUES ('${SRC}-MFX', '${SRC}', 'Data centre cut-over', '2026-10-10', '2026-10-03', NULL, 'milestone', 'PE-01', true)`,
];

/* The plan as the screen and the engine read it, keyed by outline number
   (the identity a plan keeps across the round trip; ids are new). */
function planView(db, pid, baselines) {
  const rows = Engine.wbs(db, pid);
  const outline = new Map(rows.map((r) => [r.a.id, r.outline]));
  const p = Engine.project(db, pid);
  const cal = Engine.calendarFor(db, p);
  const cp = Engine.criticalPath(db, pid);
  const m = Engine.metrics(db, pid);
  const byOutline = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [outline.get(k), v]));
  return {
    project: { name: p.name, start: p.start, finish: p.finish, baselineFinish: p.baselineFinish,
      statusDate: p.statusDate, pm: p.pm },
    calendar: cal ? { workdays: cal.workdays, holidays: cal.holidays } : null,
    stages: rows.map((r) => {
      const a = r.a;
      return {
        outline: r.outline, depth: r.depth, summary: r.summary, name: a.name,
        start: a.start, end: a.end, baseStart: a.baseStart, baseEnd: a.baseEnd,
        weight: a.weight, pct: a.pct, owner: a.owner ?? null,
        constraint: a.constraint ?? null, deadline: a.deadline ?? null,
        actualStart: a.actualStart ?? null, actualFinish: a.actualFinish ?? null, remaining: a.remaining ?? null,
        links: (r.summary ? [] : a.links ?? []).map((l) => ({ pred: outline.get(l.pred), type: l.type, lag: l.lag }))
          .sort((x, y) => (x.pred < y.pred ? -1 : 1)),
      };
    }),
    milestones: Engine.milestones(db, pid).map((x) => ({ name: x.name, date: x.date, baseDate: x.baseDate,
      gate: x.gate ?? null, done: !!x.done, owner: x.owner ?? null })),
    assignments: (db.assignments ?? []).filter((x) => outline.has(x.activity))
      .map((x) => ({ stage: outline.get(x.activity), person: x.person, role: x.role, units: x.units, work: x.work, note: x.note }))
      .sort((x, y) => (x.stage + (x.person ?? x.role) < y.stage + (y.person ?? y.role) ? -1 : 1)),
    /* named baselines: name and rows. Who took one, when, why, and each
       stage's weight in it are named losses (report: baselineMeta). */
    baselines: baselines.map((b) => ({ name: b.name,
      rows: b.rows.map((r) => ({ stage: outline.get(r.activity), name: r.name,
        parent: r.parent ? outline.get(r.parent) : null, start: r.start, end: r.end }))
        .sort((x, y) => (x.stage < y.stage ? -1 : 1)) })),
    engine: {
      es: byOutline(cp.es), ef: byOutline(cp.ef), ls: byOutline(cp.ls), lf: byOutline(cp.lf),
      float: byOutline(cp.float), freeFloat: byOutline(cp.freeFloat), dates: byOutline(cp.dates),
      critical: [...cp.critical].map((x) => outline.get(x)).sort(),
      negative: cp.negative.map((x) => outline.get(x)).sort(), missed: cp.missed.map((x) => outline.get(x)).sort(),
      late: cp.late.map((x) => outline.get(x)).sort(), projEnd: cp.projEnd, origin: cp.origin,
      /* earned value from the schedule: planned and earned to date, and
         their ratio. (The engine's own SPI also needs actual cost to be
         "measurable" — the ledger is not schedule data and MSPDI does
         not carry it.) */
      pv: m.pv, ev: m.ev, evOverPv: m.pv > 0 ? m.ev / m.pv : null,
    },
  };
}

describe("F13 · MSPDI — a Meridian plan goes to MS Project and comes back the same", () => {
  let before = null, after = null, report = null, newId = null, xml = null, othersBefore = null, admin = null;

  const othersOf = (db, skip) => Object.fromEntries(db.projects.filter((p) => !skip.has(p.id))
    .map((p) => [p.id, { m: Engine.metrics(db, p.id), cp: Engine.criticalPath(db, p.id) }]));

  test("the enriched project goes out and comes back as a new project", async () => {
    for (const sql of ENRICH) await query(sql);
    admin = await as("admin");
    const db0 = await bookOf(admin);
    const p0 = Engine.project(db0, SRC);
    before = planView(db0, SRC, (await admin.get(`/api/projects/${SRC}/baselines`)).body.baselines);
    othersBefore = othersOf(db0, new Set());

    const ex = await admin.get(`/api/projects/${SRC}/mspdi`);
    assert.equal(ex.status, 200);
    xml = ex.text;
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"/);
    assert.match(xml, /<Project xmlns="http:\/\/schemas.microsoft.com\/project">/);

    const r = await admin.post("/api/import/mspdi", { xml, programme: p0.programme, site: p0.site,
      governanceLevel: p0.governanceLevel, budget: p0.budget, method: p0.method });
    assert.equal(r.status, 201, r.text);
    newId = r.body.id;
    report = r.body.report;
    const db1 = await bookOf(admin);
    after = planView(db1, newId, (await admin.get(`/api/projects/${newId}/baselines`)).body.baselines);

    /* D-41.01 — the import made new rows only: every other project's
       numbers, the source's included, are what they were. */
    assert.deepEqual(othersOf(db1, new Set([newId])), othersBefore);
  });

  test("nothing is ignored or approximated except what the report names", () => {
    const named = report.filter((x) => x.level !== "mapped").map((x) => x.code);
    assert.deepEqual([...new Set(named)].sort(), ["baselineMeta", "gateNotPassed"], JSON.stringify(report, null, 1));
    assert.ok(report.some((x) => x.code === "calendarReuse"), "the source's own calendar is found again, not duplicated");
    assert.equal(report.filter((x) => x.code === "gateMatched").length, 4);
    assert.deepEqual(report.filter((x) => x.code === "resourcePerson").map((x) => x.subject).sort(),
      ["D. Osei → D. Osei", "S. Ibarra → S. Ibarra"]);
  });

  test("the enrichment is really there — the gate is not passing on defaults", () => {
    const s = before.stages;
    assert.ok(s.some((x) => x.summary && x.depth === 1), "a summary under a summary");
    assert.deepEqual([...new Set(s.flatMap((x) => x.links.map((l) => l.type)))].sort(), ["FF", "FS", "SF", "SS"]);
    assert.ok(s.some((x) => x.links.some((l) => l.lag < 0)) && s.some((x) => x.links.some((l) => l.lag > 0)));
    assert.deepEqual([...new Set(s.map((x) => x.constraint?.type).filter(Boolean))].sort(),
      ["FNET", "FNLT", "MFO", "MSO", "SNET", "SNLT"]);
    assert.ok(s.some((x) => x.deadline) && s.some((x) => x.actualFinish) && s.some((x) => x.remaining !== null));
    assert.ok(s.some((x) => x.baseStart !== x.start));
    assert.equal(before.calendar.holidays.length, 2);
    assert.equal(before.baselines.length, 2);
    assert.ok(before.assignments.some((x) => x.work !== null) && before.assignments.some((x) => x.role));
    assert.ok(before.milestones.some((x) => x.done && x.baseDate !== x.date));
    assert.ok(before.engine.critical.length > 0);
  });

  test("the project, its calendar, its tree, links, constraints and actuals are the same", () => {
    assert.deepEqual(after.project, before.project);
    assert.deepEqual(after.calendar, before.calendar);
    assert.deepEqual(after.stages, before.stages);
  });

  test("milestones and gates, assignments and named baselines are the same", () => {
    /* A gate's passing is not carried: it is a governance act on its
       evidence, and the report names each gate it concerns
       (gateNotPassed). Everything else about a gate — its date, its
       baseline date, its owner, its rank — comes back. */
    const passed = before.milestones.filter((x) => x.gate && x.done).map((x) => x.name).sort();
    assert.deepEqual(report.filter((x) => x.code === "gateNotPassed").map((x) => x.subject).sort(), passed);
    assert.ok(passed.length > 0, "the source has passed gates, so the rule is exercised");
    const unpassed = (list) => list.map((x) => (x.gate ? { ...x, done: false } : x));
    assert.deepEqual(after.milestones, unpassed(before.milestones));
    assert.deepEqual(after.assignments, before.assignments);
    assert.deepEqual(after.baselines, before.baselines);
  });

  test("the engine computes the same schedule — the Gantt is the same Gantt", () => {
    assert.deepEqual(after.engine, before.engine);
  });

  test("and a second trip changes nothing at all: the plan that came back is a fixed point", async () => {
    const again = (await admin.get(`/api/projects/${newId}/mspdi`)).text;
    const p1 = Engine.project(await bookOf(admin), newId);
    const r = await admin.post("/api/import/mspdi", { xml: again, programme: p1.programme, site: p1.site,
      governanceLevel: p1.governanceLevel, budget: p1.budget, method: p1.method });
    assert.equal(r.status, 201, r.text);
    assert.deepEqual(r.body.report.filter((x) => x.level !== "mapped").map((x) => x.code), ["baselineMeta"],
      "no gate is passed any more, so nothing but the baselines' metadata is left to name");
    const third = planView(await bookOf(admin), r.body.id, (await admin.get(`/api/projects/${r.body.id}/baselines`)).body.baselines);
    assert.deepEqual(third, after);
    /* and the file is the same file, but for when and under which id it was written */
    const strip = (s) => s.replace(/<LastSaved>[^<]*<\/LastSaved>/, "").replace(/<Name>PRJ-\d+\.xml<\/Name>/, "");
    assert.equal(strip((await admin.get(`/api/projects/${r.body.id}/mspdi`)).text), strip(again));
  });

  test("the export is a read: it needs to see the project, and it is noted in the trail (R-14)", async () => {
    const lis = await as("viewerLIS");
    const mine = new Set((await bookOf(lis)).projects.map((p) => p.id));
    const hidden = (await bookOf(admin)).projects.find((p) => !mine.has(p.id));
    assert.ok(hidden, "the LIS viewer does not see every project");
    assert.equal((await lis.get(`/api/projects/${hidden.id}/mspdi`)).status, 404);
    const seen = [...mine][0];
    const n0 = await count(`SELECT count(*) AS n FROM audit_event WHERE action = 'MS Project export consulted'`);
    const r = await lis.get(`/api/projects/${seen}/mspdi`);
    assert.equal(r.status, 200);
    assert.match(r.text, /<Tasks>/);
    assert.equal(await count(`SELECT count(*) AS n FROM audit_event WHERE action = 'MS Project export consulted'`), n0 + 1);
  });
});

/**
 * FX-13 · MS PROJECT IN AND OUT — the two doors (docs/41 §3).
 *
 *   GET  /projects/:id/mspdi   the project as an MS Project XML (MSPDI) file
 *   POST /import/mspdi         an MSPDI file → a NEW project; `dryRun: true`
 *                              answers the report and writes nothing
 *
 * The mapping is server/src/mspdi.js (pure). Here: who may, and the write.
 *
 * ── Authority ────────────────────────────────────────────────────────
 * Export is a read of one project: `project.read` (you see it) and
 * `data.export`, and it is noted in the trail as a consultation (R-14),
 * like the evidence pack and the dataset.
 *
 * Import creates ONE project, so it asks exactly what creating a project
 * by hand asks: `project.create` on the chosen programme, site and
 * governance level — a site lead imports a site project at their own
 * site, a programme lead a project of their programme. Not `data.import`:
 * that one replaces or bulk-loads the portfolio and is group level; an
 * MS Project plan is one project, and refusing it to the site lead who
 * may create that very project by hand would only send them to retype it.
 * A calendar the portfolio does not have yet is created with the project
 * only when the account also holds `calendar.manage` (group level, FX-02);
 * otherwise the dry run says so and nothing is written.
 *
 * ── The write ────────────────────────────────────────────────────────
 * One audited transaction, like the book import and the CSV import: all
 * or nothing. Only NEW rows (D-41.01): a project, its stages, links,
 * milestones, assignments, named baselines, and a calendar when one must
 * be created. The gates are scaffolded from the programme's ladder as for
 * every new project; a milestone of the file that bears a gate's name
 * gives that gate its date. Nothing existing is read for writing, so
 * there is no row_version to assert: every row written is born here.
 */

import { Router } from "express";
import { many, one, tx, allocateId, insertMany } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited, record } from "../audit.js";
import { HttpError } from "../auth.js";
import { say, localeOf } from "../i18n.js";
import { loadPortfolio, loadBaselines, projectFor, fromM } from "../portfolio.js";
import { scaffoldProject, resolveLadder } from "../wbs.js";
import { toMspdi, readMspdi, resolveImport } from "../mspdi.js";

const r = Router();
const bad = (msg) => { throw new HttpError(400, msg); };
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}

/* ── export ───────────────────────────────────────────────────────── */

r.get("/projects/:id/mspdi", async (req, res, next) => {
  try {
    const p = await projectFor(req.params.id);
    if (!p || !canSeeProject(req.user, p)) throw new HttpError(404, "No such project");
    gate(req.user, "project.read", { project: p });
    gate(req.user, "data.export");
    const db = await loadPortfolio(req.user);
    const xml = toMspdi(db, p.id, { baselines: await loadBaselines([p.id]), now: new Date().toISOString() });
    await tx(async (t) => record(t, req.user, {
      action: "MS Project export consulted", entity: "consultation", entityId: p.id }));   // R-14
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${p.id}.xml"`);
    res.send(xml);
  } catch (e) { next(e); }
});

/* ── import ───────────────────────────────────────────────────────── */

/** Everything the resolution reads, fetched BEFORE the transaction opens
    (PGlite is one connection: a module-level query from inside a
    transaction waits for it, forever — routes/portfolio.js says why). */
async function importContext(user, programme, site) {
  const [people, calRows, calDays, siteRow, dflt, prog, portfolioGates] = await Promise.all([
    many(`SELECT p.id, p.name, (SELECT min(lower(u.email)) FROM app_user u WHERE u.person_id = p.id) AS email
            FROM person p WHERE p.active ORDER BY p.id`),
    many(`SELECT id, name, work_days FROM work_calendar ORDER BY id`),
    many(`SELECT calendar_id, on_date FROM work_calendar_exception ORDER BY calendar_id, on_date`),
    one(`SELECT calendar_id FROM site WHERE id = $1`, [site]),
    one(`SELECT id FROM work_calendar WHERE is_default`),
    one(`SELECT gate_model FROM programme WHERE id = $1`, [programme]),
    one(`SELECT value FROM app_setting WHERE key = 'gates'`),
  ]);
  const calendars = calRows.map((c) => ({
    id: c.id, name: c.name, workdays: Number(c.work_days),
    holidays: calDays.filter((d) => d.calendar_id === c.id).map((d) => String(d.on_date).slice(0, 10)),
  }));
  const inheritedId = siteRow?.calendar_id ?? dflt?.id ?? null;
  /* NEW-26 — the ladder the create will write, programme then portfolio. */
  const ladder = resolveLadder(prog?.gate_model, portfolioGates?.value);
  return {
    people, calendars, ladder,
    inherited: calendars.find((c) => c.id === inheritedId) ?? null,
    mayCreateCalendar: can(user, "calendar.manage", {}).ok,
  };
}

r.post("/import/mspdi", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.programme || !b.site) bad("An imported plan becomes a project: choose its programme and its site");
    const level = b.governanceLevel === "group" ? "group" : "site";
    gate(req.user, "project.create", { programme_id: b.programme, site_id: b.site, governance_level: level });
    if (typeof b.xml !== "string" || !b.xml.trim()) bad("Paste or choose the MS Project XML file (File → Save As → XML in MS Project)");
    const known = await Promise.all([
      one(`SELECT id FROM programme WHERE id = $1`, [String(b.programme)]),
      one(`SELECT id FROM site WHERE id = $1`, [String(b.site)]),
      b.pm ? one(`SELECT id FROM person WHERE id = $1 AND active`, [String(b.pm)]) : null,
    ]);
    if (!known[0]) bad(`No such programme: ${b.programme}`);
    if (!known[1]) bad(`No such site: ${b.site}`);
    if (b.pm && !known[2]) bad("The project manager must be an active person in the directory");
    const method = ["Waterfall", "Agile", "Hybrid"].includes(b.method) ? b.method : "Waterfall";

    const ctx = await importContext(req.user, b.programme, b.site);
    const out = resolveImport(readMspdi(b.xml), ctx);
    if (out.rows) {
      const name = String(b.name ?? "").trim();
      if (name) out.rows.project.name = name.slice(0, 200);
      if (!out.rows.project.start) {
        out.ok = false;
        out.report.push({ level: "blocking", code: "noTasks", subject: out.rows.project.name,
          detail: "The file holds no task" });
      }
    }
    /* What the person is TOLD is in their language; what is RECORDED
       (the audit row below) stays in English (i18n.js). */
    const locale = localeOf(req);
    const told = out.report.map((x) => ({ ...x, detail: say(x.detail, locale) }));
    const answer = { ok: out.ok, report: told, counts: out.counts ?? null,
      project: out.rows ? { name: out.rows.project.name, start: out.rows.project.start,
        finish: out.rows.project.finish } : null };
    if (b.dryRun === true || b.dryRun === "true") return res.json({ dryRun: true, ...answer });
    if (!out.ok) {
      const first = told.find((x) => x.level === "blocking");
      return res.status(422).json({ ...answer,
        error: say("Nothing was imported — ", locale) + (first?.detail ?? "") + (first?.subject ? ` (${first.subject})` : "") });
    }

    const rows = out.rows;
    let id = null;
    await audited(req.user,
      () => ({ action: "Project imported from MS Project", entity: "project", entityId: id,
        detail: `${rows.project.name} · ${out.counts.tasks} stage(s), ${out.counts.milestones} milestone(s), ` +
          `${out.counts.links} link(s), ${out.counts.assignments} assignment(s), ${out.counts.baselines} baseline(s)` +
          ` · ${out.report.filter((x) => x.level === "ignored").length} ignored, ` +
          `${out.report.filter((x) => x.level === "approximated").length} approximated`,
        after: { counts: out.counts, report: out.report.filter((x) => x.level !== "mapped") } }),
      async (t) => {
        /* the calendar, when the portfolio has none identical */
        let calendarId = rows.calendar.mode === "reuse" ? rows.calendar.id : null;
        if (rows.calendar.mode === "create") {
          calendarId = await allocateId(t, "CAL");
          await t.query(`INSERT INTO work_calendar (id, name, work_days, is_default, note) VALUES ($1,$2,$3,false,$4)`,
            [calendarId, rows.calendar.name.slice(0, 120) || "Imported calendar", rows.calendar.workdays,
             "Imported from MS Project"]);
          await insertMany(t, "work_calendar_exception", ["calendar_id", "on_date", "label"],
            rows.calendar.holidays.map((h) => ({ calendar_id: calendarId, on_date: h.date, label: String(h.label ?? "").slice(0, 120) })));
        }

        id = await allocateId(t, "PRJ", { step: 3 });
        const project = { id, name: rows.project.name, programme: b.programme, site: b.site,
          pm: b.pm || rows.project.pm || null, method, start: rows.project.start, finish: rows.project.finish };
        await t.query(
          `INSERT INTO project
             (id, name, programme_id, site_id, governance_level, pm_id, method,
              start_date, finish_date, baseline_finish, budget, contingency,
              description, phase, calendar_id, status_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,'Initiation',$13,$14)`,
          [id, project.name, b.programme, b.site, level, project.pm, method,
           project.start, project.finish, rows.project.baselineFinish,
           fromM(Number(b.budget) >= 0 ? Number(b.budget) : 0),
           "Imported from MS Project", calendarId, rows.project.statusDate]);
        /* gates, their evidence, the PM's allocation — not the template stages */
        await scaffoldProject(t, project, { template: false });

        const idOf = new Map(rows.activities.map((a, i) => [a.key, `${id}-A${i + 1}`]));
        await insertMany(t, "activity",
          ["id", "project_id", "name", "stage", "parent_id", "start_date", "end_date", "base_start", "base_end",
           "weight", "pct", "owner_id", "constraint_type", "constraint_date", "deadline",
           "actual_start", "actual_finish", "remaining_days"],
          rows.activities.map((a) => ({
            id: idOf.get(a.key), project_id: id, name: a.name, stage: a.stage,
            parent_id: a.parentKey ? idOf.get(a.parentKey) : null,
            start_date: a.start, end_date: a.end, base_start: a.baseStart, base_end: a.baseEnd,
            weight: a.weight, pct: a.pct, owner_id: a.owner ?? null,
            constraint_type: a.constraintType, constraint_date: a.constraintDate, deadline: a.deadline,
            actual_start: a.actualStart, actual_finish: a.actualFinish, remaining_days: a.remaining,
          })));
        await insertMany(t, "activity_dep", ["activity_id", "predecessor_id", "type", "lag_days"],
          rows.links.map((l) => ({ activity_id: idOf.get(l.succKey), predecessor_id: idOf.get(l.predKey),
            type: l.type, lag_days: l.lag })));

        for (const m of rows.milestones) {
          if (m.gate) {
            await t.query(`UPDATE milestone SET due_date = $2, base_date = $3, owner_id = COALESCE($4, owner_id)
                            WHERE id = $1`, [`${id}-G${m.gate}`, m.date, m.baseDate, m.owner]);
            continue;
          }
          const n = await allocateId(t, "MS");
          await t.query(
            `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, done)
             VALUES ($1,$2,$3,$4,$5,NULL,'milestone',$6,$7)`,
            [id + "-M" + n.split("-")[1], id, m.name, m.date, m.baseDate, m.owner ?? null, m.done]);
        }

        for (const x of rows.assignments) {
          const asg = await allocateId(t, "ASG", { pad: 3 });
          await t.query(
            `INSERT INTO assignment (id, activity_id, person_id, role_label, units, work_days, note)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [asg, idOf.get(x.actKey), x.person, x.person ? "" : x.role, x.units, x.work, x.note]);
        }

        const names = new Set();
        const actByKey = new Map(rows.activities.map((a) => [a.key, a]));
        for (const s of rows.snapshots) {
          let name = s.name, k = 2;
          while (names.has(name)) name = `${s.name} (${k++})`;
          names.add(name);
          const bsl = await allocateId(t, "BSL");
          await t.query(
            `INSERT INTO baseline_snapshot (id, project_id, name, taken_by, reason) VALUES ($1,$2,$3,$4,$5)`,
            [bsl, id, name, req.user.id, `Imported from MS Project (Baseline ${s.n})`]);
          await insertMany(t, "baseline_snapshot_row",
            ["snapshot_id", "activity_id", "name", "parent_id", "start_date", "end_date", "weight"],
            s.rows.map((x) => {
              const a = actByKey.get(x.actKey);
              return { snapshot_id: bsl, activity_id: idOf.get(x.actKey), name: a.name,
                parent_id: a.parentKey ? idOf.get(a.parentKey) : null,
                start_date: x.start, end_date: x.end, weight: a.weight };
            }));
        }
      });
    res.status(201).json({ id, ...answer });
  } catch (e) { next(e); }
});

export default r;

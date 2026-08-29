/**
 * Meeting animation routes (D-04, R5.*).
 *
 * The rule that shapes this file: while an occurrence is **open** its
 * agenda is computed live from portfolio state, and when it is **closed**
 * that agenda is written down (R5.8). After the close, the meeting is a
 * historical record — portfolio movement the following week cannot alter
 * what the committee actually discussed, and neither can anyone else.
 */

import { Router } from "express";
import { many, one, tx, allocateId, insertMany, requiredVersion } from "../db.js";
import { can } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { loadPortfolio } from "../portfolio.js";
import {
  buildAgenda, renderMinutes, seriesProjects, seriesLabel,
  nextOccurrenceDate, periodLabel,
} from "../../../shared/meetings.js";
import { iso, D, addDays, Engine } from "../../../shared/engine.js";

const r = Router();

/* ── helpers ──────────────────────────────────────────────────────── */

const scopeOf = (s) => ({
  scope_kind: s.scope_kind, programme_id: s.programme_id, site_id: s.site_id,
});
const toSeries = (s) => ({
  id: s.id, name: s.name, cadence: s.cadence, scopeKind: s.scope_kind,
  programmeId: s.programme_id, siteId: s.site_id, chairId: s.chair_id,
  weekday: s.weekday, startTime: s.start_time, timeboxMin: s.timebox_min,
  active: s.active, version: s.row_version,
});
const toOccurrence = (o) => ({
  id: o.id, seriesId: o.series_id, meetsOn: o.meets_on, periodLabel: o.period_label,
  status: o.status,
  /* Who opened and closed it, not only when. A governance record that
     cannot name the chair is not a governance record. */
  openedAt: o.opened_at, openedBy: o.opened_by,
  closedAt: o.closed_at, closedBy: o.closed_by,
  notes: o.notes, version: o.row_version,
});

async function series(id) {
  const s = await one(`SELECT * FROM meeting_series WHERE id = $1`, [id]);
  if (!s) throw new HttpError(404, "No such meeting series");
  return s;
}
async function occurrence(id) {
  const o = await one(`SELECT * FROM meeting_occurrence WHERE id = $1`, [id]);
  if (!o) throw new HttpError(404, "No such meeting");
  return o;
}
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
function readable(user, s) {
  const v = can(user, "meeting.read", { scope: scopeOf(s) });
  if (!v.ok) throw new HttpError(404, "No such meeting series");
  return s;
}

/** Open actions for a series, newest occurrence first, with owner names. */
async function openActions(seriesId) {
  const rows = await many(
    `SELECT a.*, p.name AS owner_name
       FROM meeting_action a
       LEFT JOIN person p ON p.id = a.owner_id
      WHERE a.series_id = $1 AND a.status IN ('Open','In progress')
      ORDER BY a.due_date NULLS LAST, a.id`,
    [seriesId]
  );
  return rows.map((a) => ({
    id: a.id, title: a.title, detail: a.detail, ownerId: a.owner_id,
    ownerName: a.owner_name, projectId: a.project_id, dueDate: a.due_date,
    status: a.status, raisedIn: a.raised_in, version: a.row_version,
  }));
}

/**
 * This series' open actions PLUS (governance committee, rhythm-2) open
 * actions from BROADER-scope series whose project sits in this series'
 * slate — an action raised at group steering against a site's project
 * lands on that site's own weekly, tagged with its origin, instead of
 * living only in the group agenda and the owner's memory.
 */
async function openActionsFor(s) {
  const own = await openActions(s.id);
  if (s.scope_kind === "group") return own;

  const scopeSql = s.scope_kind === "site"
    ? `bs.scope_kind IN ('group','programme') AND pr.site_id = $2`
    : `bs.scope_kind = 'group' AND pr.programme_id = $2`;
  const key = s.scope_kind === "site" ? s.site_id : s.programme_id;
  const inherited = await many(
    `SELECT a.*, p.name AS owner_name, bs.name AS origin_name
       FROM meeting_action a
       LEFT JOIN person p ON p.id = a.owner_id
       JOIN meeting_series bs ON bs.id = a.series_id
       JOIN project pr ON pr.id = a.project_id
      WHERE a.series_id <> $1 AND a.status IN ('Open','In progress')
        AND ${scopeSql}
      ORDER BY a.due_date NULLS LAST, a.id`,
    [s.id, key]
  );
  return own.concat(inherited.map((a) => ({
    id: a.id, title: a.title, detail: a.detail, ownerId: a.owner_id,
    ownerName: a.owner_name, projectId: a.project_id, dueDate: a.due_date,
    status: a.status, raisedIn: a.raised_in, version: a.row_version,
    origin: a.origin_name,
  })));
}

/**
 * The connective tissue between levels (governance committee):
 *   referrals       — decisions a narrower series referred UP to this
 *                     series' scope, still unanswered here
 *   levelDecisions  — for a GROUP series: what site/programme rooms
 *                     decided since this series last closed a meeting
 */
/**
 * Which unanswered referrals belong to THIS room.
 *
 * A referral names a LEVEL, not a room. Matching on the level alone puts
 * São Paulo's escalation on every programme's agenda — and lets any of
 * them retire it on São Paulo's behalf. The target is resolved the way
 * the rest of the model resolves a slate: by the referred decision's own
 * project, or failing that by the sites that host the programme's work.
 * `s2` is the referring series; callers join it.
 */
function referralScope(s, n = 1) {
  if (s.scope_kind === "group") return { sql: `d.referred_to_scope = 'group'`, params: [] };
  if (s.scope_kind !== "programme") return { sql: "false", params: [] };
  return {
    sql: `d.referred_to_scope = 'programme' AND (
            EXISTS (SELECT 1 FROM project pr
                     WHERE pr.id = d.project_id AND pr.programme_id = $${n})
            OR (d.project_id IS NULL AND s2.site_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM project pr2
                   WHERE pr2.site_id = s2.site_id AND pr2.programme_id = $${n})))`,
    params: [s.programme_id],
  };
}

async function governanceExtras(s) {
  if (s.scope_kind === "site") return {};
  const rs = referralScope(s, 1);
  const referrals = await many(
    `SELECT d.id, d.headline, d.rationale, o.meets_on, s2.name AS series_name
       FROM meeting_decision d
       JOIN meeting_occurrence o ON o.id = d.occurrence_id
       JOIN meeting_series s2 ON s2.id = o.series_id
      WHERE ${rs.sql} AND d.answered_by IS NULL
      ORDER BY o.meets_on DESC LIMIT 20`,
    rs.params
  );
  let levelDecisions = [];
  if (s.scope_kind === "group") {
    const last = await one(
      `SELECT meets_on FROM meeting_occurrence
        WHERE series_id = $1 AND status = 'closed'
        ORDER BY meets_on DESC LIMIT 1`, [s.id]);
    levelDecisions = await many(
      `SELECT d.id, d.headline, o.meets_on, s2.name AS series_name, per.name AS decided_by_name
         FROM meeting_decision d
         JOIN meeting_occurrence o ON o.id = d.occurrence_id
         JOIN meeting_series s2 ON s2.id = o.series_id
         LEFT JOIN person per ON per.id = d.decided_by
        WHERE s2.scope_kind IN ('site','programme')
          AND d.referred_to_scope IS NULL
          AND o.meets_on > $1
        ORDER BY o.meets_on DESC LIMIT 20`,
      [last?.meets_on ?? "1970-01-01"]);
  }
  return {
    referrals: referrals.map((rf) => ({
      id: rf.id, headline: rf.headline, rationale: rf.rationale,
      meetsOn: rf.meets_on, seriesName: rf.series_name,
    })),
    levelDecisions: levelDecisions.map((d) => ({
      id: d.id, headline: d.headline, meetsOn: d.meets_on,
      seriesName: d.series_name, decidedByName: d.decided_by_name,
    })),
  };
}

/** Agenda: frozen rows when closed, computed live otherwise (R5.2/R5.8). */
async function agendaFor(user, s, o) {
  if (o.status === "closed") {
    const rows = await many(
      `SELECT * FROM agenda_item WHERE occurrence_id = $1 ORDER BY seq`, [o.id]);
    const bySection = new Map();
    for (const it of rows) {
      /* Rows frozen before migration 007 carry no key; the title is the
         only thing they ever had, so it stands in for one. */
      const key = it.section_key ?? it.section;
      if (!bySection.has(key)) {
        bySection.set(key, { key, title: it.section, items: [], timeboxMin: 0, seq: bySection.size + 1 });
      }
      const sec = bySection.get(key);
      sec.items.push({ headline: it.headline, detail: it.detail, entity: it.entity,
                       entityId: it.entity_id, urgent: it.urgent === true });
      sec.timeboxMin = Math.max(sec.timeboxMin, it.timebox_min);
    }
    return { sections: [...bySection.values()], frozen: true, asOf: o.meets_on,
             scope: null, timebox: s.timebox_min };
  }
  const db = await loadPortfolio(user);
  return {
    ...buildAgenda(db, toSeries(s), toOccurrence(o), await openActionsFor(s),
      await governanceExtras(s)),
    frozen: false,
  };
}

/* ── series ───────────────────────────────────────────────────────── */

r.get("/series", async (req, res, next) => {
  try {
    const rows = await many(`SELECT * FROM meeting_series WHERE active ORDER BY cadence, name`);
    const visible = rows.filter((s) => can(req.user, "meeting.read", { scope: scopeOf(s) }).ok);
    const db = await loadPortfolio(req.user);

    const out = [];
    for (const s of visible) {
      const next = await one(
        `SELECT * FROM meeting_occurrence
          WHERE series_id = $1 AND status <> 'closed'
          ORDER BY meets_on LIMIT 1`, [s.id]);
      const last = await one(
        `SELECT * FROM meeting_occurrence
          WHERE series_id = $1 AND status = 'closed'
          ORDER BY meets_on DESC LIMIT 1`, [s.id]);
      const openCount = await one(
        `SELECT count(*)::int AS n FROM meeting_action
          WHERE series_id = $1 AND status IN ('Open','In progress')`, [s.id]);
      out.push({
        ...toSeries(s),
        scopeLabel: seriesLabel(db, toSeries(s)),
        projectCount: seriesProjects(db, toSeries(s)).length,
        canWrite: can(req.user, "meeting.write", { scope: scopeOf(s) }).ok,
        next: next ? toOccurrence(next) : null,
        last: last ? toOccurrence(last) : null,
        openActions: openCount?.n ?? 0,
      });
    }
    res.json({ series: out });
  } catch (e) { next(e); }
});

r.post("/series", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const kind = ["group", "programme", "site"].includes(b.scopeKind) ? b.scopeKind : null;
    if (!kind) throw new HttpError(400, "A series needs a scope: group, programme or site");
    if (!b.name) throw new HttpError(400, "A series needs a name");
    const scope = {
      scope_kind: kind,
      programme_id: kind === "programme" ? b.programmeId : null,
      site_id: kind === "site" ? b.siteId : null,
    };
    if (kind === "programme" && !scope.programme_id) throw new HttpError(400, "Name the programme");
    if (kind === "site" && !scope.site_id) throw new HttpError(400, "Name the site");
    gate(req.user, "series.manage", { scope });

    const cadence = b.cadence === "monthly" ? "monthly" : "weekly";
    const id = "MS-" + Date.now().toString(36).toUpperCase().slice(-6);
    await audited(req.user,
      { action: "Meeting series created", entity: "meeting_series", entityId: id, detail: b.name },
      async (t) => t.query(
        `INSERT INTO meeting_series
           (id, name, cadence, scope_kind, programme_id, site_id, chair_id, weekday, start_time, timebox_min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, b.name, cadence, kind, scope.programme_id, scope.site_id,
         b.chairId ?? req.user.personId, Math.max(0, Math.min(6, Number(b.weekday ?? 1))),
         b.startTime ?? "09:00", Number(b.timeboxMin ?? (cadence === "monthly" ? 60 : 25))]));
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/series/:id", async (req, res, next) => {
  try {
    const s = await series(req.params.id);
    gate(req.user, "series.manage", { scope: scopeOf(s) });
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.chairId !== undefined) patch.chair_id = b.chairId || null;
    if (b.weekday !== undefined) patch.weekday = Math.max(0, Math.min(6, Number(b.weekday)));
    if (b.startTime !== undefined) patch.start_time = b.startTime;
    if (b.timeboxMin !== undefined) patch.timebox_min = Math.max(5, Number(b.timeboxMin));
    if (b.active !== undefined) patch.active = !!b.active;

    const { updateVersioned } = await import("../db.js");
    const out = await audited(req.user,
      { action: "Meeting series updated", entity: "meeting_series", entityId: s.id, detail: b.name ?? s.name },
      async (t) => updateVersioned(t, "meeting_series", s.id, requiredVersion(b, "series"), patch));
    if (!out.ok) throw new HttpError(409, "Someone else changed this series — reload and try again");
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── occurrences ──────────────────────────────────────────────────── */

r.get("/series/:id/occurrences", async (req, res, next) => {
  try {
    const s = readable(req.user, await series(req.params.id));
    const rows = await many(
      `SELECT * FROM meeting_occurrence WHERE series_id = $1 ORDER BY meets_on DESC LIMIT 40`,
      [s.id]);
    res.json({ series: toSeries(s), occurrences: rows.map(toOccurrence) });
  } catch (e) { next(e); }
});

/** Schedule the next occurrence of a series (or a named date). */
r.post("/series/:id/occurrences", async (req, res, next) => {
  try {
    const s = await series(req.params.id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    const date = req.body?.meetsOn ??
      nextOccurrenceDate({ cadence: s.cadence, weekday: s.weekday }, iso(addDays(new Date(), 1)));
    const id = s.id + "-" + String(date).replace(/-/g, "");

    const clash = await one(
      `SELECT id FROM meeting_occurrence WHERE series_id = $1 AND meets_on = $2`, [s.id, date]);
    if (clash) return res.json({ id: clash.id, existing: true });

    await audited(req.user,
      { action: "Meeting scheduled", entity: "meeting_occurrence", entityId: id,
        detail: `${s.name} — ${date}` },
      async (t) => t.query(
        `INSERT INTO meeting_occurrence (id, series_id, meets_on, period_label, status)
         VALUES ($1,$2,$3,$4,'scheduled')`,
        [id, s.id, date, periodLabel({ cadence: s.cadence }, date)]));
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/** Everything a chair needs to run the meeting, in one response. */
r.get("/occurrences/:id", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = readable(req.user, await series(o.series_id));
    const [agenda, attendance, decisions, actions, raisedHere, people] = await Promise.all([
      agendaFor(req.user, s, o),
      many(`SELECT a.*, p.name AS person_name, p.job_role, d.name AS deputy_for_name
              FROM meeting_attendance a
              JOIN person p ON p.id = a.person_id
              LEFT JOIN person d ON d.id = a.deputy_for
             WHERE a.occurrence_id = $1 ORDER BY p.name`, [o.id]),
      many(`SELECT d.*, p.name AS decided_by_name
              FROM meeting_decision d LEFT JOIN person p ON p.id = d.decided_by
             WHERE d.occurrence_id = $1 ORDER BY d.recorded_at`, [o.id]),
      openActionsFor(s),
      many(`SELECT a.*, p.name AS owner_name
              FROM meeting_action a LEFT JOIN person p ON p.id = a.owner_id
             WHERE a.raised_in = $1 ORDER BY a.id`, [o.id]),
      many(`SELECT id, name, job_role, site_id FROM person WHERE active ORDER BY name`),
    ]);

    res.json({
      series: toSeries(s),
      occurrence: toOccurrence(o),
      canWrite: can(req.user, "meeting.write", { scope: scopeOf(s) }).ok,
      agenda,
      attendance: attendance.map((a) => ({
        personId: a.person_id, personName: a.person_name, role: a.job_role,
        state: a.state, deputyFor: a.deputy_for,
        deputyForName: a.deputy_for_name ?? null,
      })),
      decisions: decisions.map((d) => ({
        id: d.id, headline: d.headline, rationale: d.rationale, projectId: d.project_id,
        crId: d.cr_id, decidedBy: d.decided_by, decidedByName: d.decided_by_name,
        recordedBy: d.recorded_by, recordedAt: d.recorded_at,
        referredTo: d.referred_to_scope ?? null, answeredBy: d.answered_by ?? null,
      })),
      openActions: actions,
      actionsRaisedHere: raisedHere.map((a) => ({
        id: a.id, title: a.title, ownerId: a.owner_id, ownerName: a.owner_name,
        dueDate: a.due_date, status: a.status, projectId: a.project_id,
        closedIn: a.closed_in, version: a.row_version,
      })),
      people: people.map((p) => ({ id: p.id, name: p.name, role: p.job_role, site: p.site_id })),
    });
  } catch (e) { next(e); }
});

r.post("/occurrences/:id/open", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = await series(o.series_id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    if (o.status === "closed") throw new HttpError(409, "This meeting is closed");

    await audited(req.user,
      { action: "Meeting opened", entity: "meeting_occurrence", entityId: o.id,
        detail: `${s.name} — ${o.meets_on}` },
      async (t) => t.query(
        `UPDATE meeting_occurrence
            SET status='open', opened_at=now(), opened_by=$2, row_version=row_version+1
          WHERE id=$1`, [o.id, req.user.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * Close: freeze the agenda, stamp the closer, and schedule the next
 * occurrence so the series never goes quiet (R5.8).
 */
r.post("/occurrences/:id/close", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = await series(o.series_id);
    gate(req.user, "meeting.close", { scope: scopeOf(s) });
    if (o.status === "closed") throw new HttpError(409, "This meeting is already closed");

    const agenda = await agendaFor(req.user, s, o);
    const nextDate = nextOccurrenceDate(
      { cadence: s.cadence, weekday: s.weekday },
      iso(addDays(o.meets_on, s.cadence === "weekly" ? 1 : 1))
    );
    const nextId = s.id + "-" + nextDate.replace(/-/g, "");

    await audited(req.user,
      { action: "Meeting closed", entity: "meeting_occurrence", entityId: o.id,
        detail: `${s.name} — ${o.meets_on}; agenda frozen with ${agenda.sections.length} sections` },
      async (t) => {
        /* A monthly steering agenda runs to forty-odd items. Freezing it
           one row at a time held the transaction open for forty round
           trips at the exact moment a room full of people is waiting for
           the button to respond. One statement. */
        let seq = 0;
        const rows = agenda.sections.flatMap((sec) =>
          sec.items.map((it) => ({
            occurrence_id: o.id,
            seq: seq++,
            section: sec.title,
            section_key: sec.key ?? sec.title,
            headline: it.headline,
            detail: it.detail ?? "",
            entity: it.entity ?? "",
            entity_id: it.entityId ?? "",
            timebox_min: sec.timeboxMin ?? 0,
            urgent: !!it.urgent,
          })));
        await insertMany(t, "agenda_item",
          ["occurrence_id", "seq", "section", "section_key", "headline", "detail",
           "entity", "entity_id", "timebox_min", "urgent"],
          rows);
        await t.query(
          `UPDATE meeting_occurrence
              SET status='closed', closed_at=now(), closed_by=$2, notes=$3, row_version=row_version+1
            WHERE id=$1`,
          [o.id, req.user.id, String(req.body?.notes ?? o.notes ?? "").slice(0, 4000)]);
        await t.query(
          `INSERT INTO meeting_occurrence (id, series_id, meets_on, period_label, status)
           VALUES ($1,$2,$3,$4,'scheduled')
           ON CONFLICT (series_id, meets_on) DO NOTHING`,
          [nextId, s.id, nextDate, periodLabel({ cadence: s.cadence }, nextDate)]);
      });
    res.json({ ok: true, next: { id: nextId, meetsOn: nextDate } });
  } catch (e) { next(e); }
});

r.post("/occurrences/:id/attendance", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = await series(o.series_id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    if (o.status === "closed") throw new HttpError(409, "This meeting is closed — attendance is fixed");

    const rows = Array.isArray(req.body?.attendance) ? req.body.attendance : [];
    const states = new Set(["present", "apologies", "absent", "deputy"]);

    await audited(req.user,
      { action: "Attendance recorded", entity: "meeting_occurrence", entityId: o.id,
        detail: `${rows.filter((x) => x.state === "present").length} present of ${rows.length}` },
      async (t) => {
        await t.query(`DELETE FROM meeting_attendance WHERE occurrence_id = $1`, [o.id]);
        for (const a of rows) {
          if (!a.personId || !states.has(a.state)) continue;
          await t.query(
            `INSERT INTO meeting_attendance (occurrence_id, person_id, state, deputy_for)
             VALUES ($1,$2,$3,$4)`,
            [o.id, a.personId, a.state, a.deputyFor ?? null]);
        }
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** R5.5 — a decision belongs to the meeting that took it, permanently. */
r.post("/occurrences/:id/decisions", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = await series(o.series_id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    if (o.status === "closed") throw new HttpError(409, "This meeting is closed — its decisions are final");
    if (o.status !== "open") throw new HttpError(409, "Open the meeting before recording decisions");
    const b = req.body ?? {};
    if (!b.headline) throw new HttpError(400, "A decision needs a headline");

    /* Referral (governance committee, rhythm-1): a room may record
       "this is beyond us — refer up" instead of a decision. Only a
       narrower room refers upward; the group room decides or nothing. */
    let referredTo = null;
    if (b.refer) {
      if (s.scope_kind === "group") throw new HttpError(400, "The group room has no one to refer to — record a decision");
      referredTo = b.referTo === "programme" && s.scope_kind === "site" ? "programme" : "group";
    }
    /* Answering: a decision recorded in a broader room may name the
       referral it answers, which retires it from future agendas. */
    let answers = null;
    if (b.answers) {
      /* The same predicate the agenda uses, so a room can only retire a
         referral it was actually shown. */
      const rs = referralScope(s, 2);
      const rf = await one(
        `SELECT d.id FROM meeting_decision d
           JOIN meeting_occurrence o2 ON o2.id = d.occurrence_id
           JOIN meeting_series s2 ON s2.id = o2.series_id
          WHERE d.id = $1 AND d.answered_by IS NULL AND ${rs.sql}`,
        [String(b.answers), ...rs.params]);
      if (!rf) throw new HttpError(400, "That referral does not exist, is not this room's to answer, or is already answered");
      answers = rf.id;
    }

    let id = null;
    await audited(req.user,
      () => ({ action: referredTo ? "Decision referred to " + referredTo : "Decision recorded",
               entity: "meeting_decision", entityId: id, detail: b.headline }),
      async (t) => {
        id = await allocateId(t, "DEC", { pad: 3 });
        await t.query(
        `INSERT INTO meeting_decision
           (id, occurrence_id, headline, rationale, project_id, cr_id, decided_by, recorded_by, referred_to_scope)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, o.id, String(b.headline).slice(0, 300), String(b.rationale ?? "").slice(0, 4000),
         b.projectId ?? null, b.crId ?? null, b.decidedBy ?? s.chair_id, req.user.id, referredTo]);
        if (answers) {
          /* Still-unanswered is re-checked here: the lookup above runs
             outside this transaction (PGlite serialises one connection,
             so reading from inside it deadlocks), which leaves a window
             for two rooms to answer the same referral. */
          await t.query(
            `UPDATE meeting_decision SET answered_by = $2
              WHERE id = $1 AND answered_by IS NULL`, [answers, id]);
        }
      });
    res.status(201).json({ id, referredTo });
  } catch (e) { next(e); }
});

/** R5.6 — an action outlives its meeting and follows the owner forward. */
r.post("/occurrences/:id/actions", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = await series(o.series_id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    if (o.status === "closed") throw new HttpError(409, "This meeting is closed");
    const b = req.body ?? {};
    if (!b.title) throw new HttpError(400, "An action needs a title");

    let id = null;
    await audited(req.user,
      () => ({ action: "Action raised", entity: "meeting_action", entityId: id, detail: b.title }),
      async (t) => {
        id = await allocateId(t, "ACT", { pad: 3 });
        return t.query(
        `INSERT INTO meeting_action
           (id, series_id, raised_in, title, detail, owner_id, project_id, due_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Open')`,
        [id, s.id, o.id, String(b.title).slice(0, 300), String(b.detail ?? "").slice(0, 2000),
         b.ownerId ?? null, b.projectId ?? null, b.dueDate ?? null]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/actions/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM meeting_action WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such action");
    const s = await series(a.series_id);
    gate(req.user, "meeting.write", { scope: scopeOf(s) });
    const b = req.body ?? {};
    const patch = {};
    if (b.title !== undefined) patch.title = String(b.title).slice(0, 300);
    if (b.detail !== undefined) patch.detail = String(b.detail).slice(0, 2000);
    if (b.ownerId !== undefined) patch.owner_id = b.ownerId || null;
    if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
    if (b.status !== undefined) {
      const ok = ["Open", "In progress", "Done", "Cancelled"];
      if (!ok.includes(b.status)) throw new HttpError(400, "Unknown action status");
      patch.status = b.status;
      if (b.status === "Done" || b.status === "Cancelled") {
        patch.closed_at = new Date().toISOString();
        if (b.closedIn) patch.closed_in = b.closedIn;
      }
    }
    const { updateVersioned } = await import("../db.js");
    const out = await audited(req.user,
      { action: b.status ? "Action " + b.status.toLowerCase() : "Action updated",
        entity: "meeting_action", entityId: a.id, detail: b.title ?? a.title },
      async (t) => updateVersioned(t, "meeting_action", a.id, requiredVersion(b, "action"), patch));
    if (!out.ok) throw new HttpError(409, "Someone else changed this action — reload and try again");
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/** Every action assigned to a person, across every series they appear in. */
r.get("/actions", async (req, res, next) => {
  try {
    const owner = req.query.owner ?? req.user.personId;
    const rows = await many(
      `SELECT a.*, s.name AS series_name, s.scope_kind, s.programme_id, s.site_id,
              p.name AS owner_name
         FROM meeting_action a
         JOIN meeting_series s ON s.id = a.series_id
         LEFT JOIN person p ON p.id = a.owner_id
        WHERE ($1::text IS NULL OR a.owner_id = $1)
          AND ($2::text IS NULL OR a.status = $2)
        ORDER BY a.due_date NULLS LAST, a.id`,
      [owner ?? null, req.query.status ?? null]
    );
    const visible = rows.filter((x) =>
      can(req.user, "meeting.read", {
        scope: { scope_kind: x.scope_kind, programme_id: x.programme_id, site_id: x.site_id },
      }).ok);
    res.json({
      actions: visible.map((a) => ({
        id: a.id, title: a.title, detail: a.detail, ownerId: a.owner_id, ownerName: a.owner_name,
        projectId: a.project_id, dueDate: a.due_date, status: a.status,
        seriesId: a.series_id, seriesName: a.series_name, version: a.row_version,
      })),
    });
  } catch (e) { next(e); }
});

/** R5.7 — minutes as Markdown, generated from the occurrence. */
r.get("/occurrences/:id/minutes", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = readable(req.user, await series(o.series_id));
    const db = await loadPortfolio(req.user);
    const [agenda, attendance, decisions, actions] = await Promise.all([
      agendaFor(req.user, s, o),
      many(`SELECT a.*, p.name AS person_name, d.name AS deputy_for_name
              FROM meeting_attendance a
              JOIN person p ON p.id = a.person_id
              LEFT JOIN person d ON d.id = a.deputy_for
             WHERE a.occurrence_id = $1 ORDER BY p.name`, [o.id]),
      many(`SELECT d.*, p.name AS decided_by_name, u.display_name AS recorded_by_name
              FROM meeting_decision d
              LEFT JOIN person p ON p.id = d.decided_by
              LEFT JOIN app_user u ON u.id = d.recorded_by
             WHERE d.occurrence_id = $1 ORDER BY d.recorded_at`, [o.id]),
      many(`SELECT a.*, p.name AS owner_name FROM meeting_action a
              LEFT JOIN person p ON p.id = a.owner_id
             WHERE a.raised_in = $1 ORDER BY a.id`, [o.id]),
    ]);

    /* Minutes name people, not identifiers: who closed the meeting, who
       deputised for whom, and who wrote each decision down. Six months
       later that is the whole value of the record. */
    const closer = o.closed_by
      ? await one(`SELECT display_name FROM app_user WHERE id = $1`, [o.closed_by])
      : null;

    const md = renderMinutes({
      db, series: toSeries(s),
      occurrence: { ...toOccurrence(o), closedByName: closer?.display_name ?? null },
      agenda,
      attendance: attendance.map((a) => ({
        personName: a.person_name, state: a.state, deputyForName: a.deputy_for_name ?? null,
      })),
      decisions: decisions.map((d) => ({
        headline: d.headline, rationale: d.rationale, projectId: d.project_id,
        crId: d.cr_id, decidedByName: d.decided_by_name,
        recordedByName: d.recorded_by_name, recordedAt: d.recorded_at,
      })),
      actions: actions.map((a) => ({
        title: a.title, ownerName: a.owner_name, dueDate: a.due_date, status: a.status,
      })),
    });

    if (req.query.format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition",
        `attachment; filename="minutes-${o.id}.md"`);
      return res.send(md);
    }
    res.json({ markdown: md });
  } catch (e) { next(e); }
});

/* ── the calendar file (R-10) ─────────────────────────────────────────
   The meetings module organised a rhythm that depended on a rhythm kept
   in Outlook — two sources of truth for the same meeting. An ICS file is
   the one format every calendar accepts and needs no connector: one
   VEVENT per occurrence, or the series with its recurrence rule. */

const icsEscape = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;")
  .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (day, time) => String(day).replace(/-/g, "") + "T" +
  String(time ?? "09:00").replace(":", "") + "00";

function icsFile(events) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meridian IT-PMO//FR", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    L.push("BEGIN:VEVENT",
      "UID:" + e.uid + "@meridian",
      "DTSTART:" + e.start,
      "DURATION:PT" + (e.minutes ?? 30) + "M",
      "SUMMARY:" + icsEscape(e.summary),
      e.rrule ? "RRULE:" + e.rrule : null,
      e.description ? "DESCRIPTION:" + icsEscape(e.description) : null,
      "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.filter(Boolean).join("\r\n") + "\r\n";
}

r.get("/occurrences/:id/ics", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = readable(req.user, await series(o.series_id));
    const body = icsFile([{
      uid: o.id, start: icsDate(o.meets_on, s.start_time), minutes: s.timebox_min,
      summary: s.name,
      description: "Ordre du jour et dossier de séance dans Meridian : " +
        (process.env.MERIDIAN_PUBLIC_URL ?? "http://localhost:4173") + "/#/meetings/" + o.id,
    }]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${o.id}.ics"`);
    res.send(body);
  } catch (e) { next(e); }
});

r.get("/series/:id/ics", async (req, res, next) => {
  try {
    const s = readable(req.user, await series(req.params.id));
    const next_ = await one(
      `SELECT meets_on FROM meeting_occurrence WHERE series_id = $1 AND status <> 'closed'
        ORDER BY meets_on LIMIT 1`, [s.id]);
    const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][s.weekday ?? 1];
    const body = icsFile([{
      uid: s.id, start: icsDate(next_?.meets_on ?? new Date().toISOString().slice(0, 10), s.start_time),
      minutes: s.timebox_min, summary: s.name,
      rrule: s.cadence === "weekly" ? "FREQ=WEEKLY;BYDAY=" + BYDAY
                                    : "FREQ=MONTHLY;BYDAY=1" + BYDAY,
      description: "Série Meridian " + s.id,
    }]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${s.id}.ics"`);
    res.send(body);
  } catch (e) { next(e); }
});

/**
 * The pre-meeting pack (UX committee, value I-3): what the chair sends
 * BEFORE the call — agenda, open actions with owners, and the slate's
 * RAG table, as one Markdown document. Minutes exist after close; this
 * is its mirror on the other side of the meeting.
 */
r.get("/occurrences/:id/pack", async (req, res, next) => {
  try {
    const o = await occurrence(req.params.id);
    const s = readable(req.user, await series(o.series_id));
    const db = await loadPortfolio(req.user);
    const agenda = await agendaFor(req.user, s, o);
    const actions = await openActionsFor(s);
    const projects = seriesProjects(db, toSeries(s));

    const L = [];
    L.push(`# ${s.name} — meeting pack`);
    L.push("");
    L.push(`**${seriesLabel(db, toSeries(s))}** · ${o.meets_on} · timebox ${agenda.timebox} min`);
    L.push("");
    L.push("## Agenda");
    L.push("");
    (agenda.sections || []).forEach((sec) => {
      L.push(`### ${sec.seq}. ${sec.title}  *(${sec.timeboxMin} min${sec.ifTimeAllows ? ", if time allows" : ""})*`);
      L.push("");
      sec.items.forEach((it) => {
        L.push(`- ${it.urgent ? "**" + it.headline + "**" : it.headline}`);
        if (it.detail) L.push(`  ${it.detail}`);
      });
      L.push("");
    });
    L.push("## Open actions");
    L.push("");
    if (!actions.length) L.push("_Register is clear._");
    else {
      L.push("| Action | Owner | Due | Status |");
      L.push("|--------|-------|-----|--------|");
      actions.forEach((a) => L.push(
        `| ${a.title}${a.origin ? " _(from " + a.origin + ")_" : ""} | ${a.ownerName || "—"} | ${a.dueDate || "—"} | ${a.status} |`));
    }
    L.push("");
    L.push("## The slate");
    L.push("");
    L.push("| Project | Site | Phase | Health | Why |");
    L.push("|---------|------|-------|--------|-----|");
    projects.forEach((p) => {
      const m = Engine.metrics(db, p.id);
      L.push(`| ${p.name} | ${p.site} | ${p.phase} | ${m.health.rag} | ${m.health.why} |`);
    });
    L.push("");
    /* A pack pulled after the meeting closed is half history and half
       today: the agenda is the frozen record, the actions and the slate
       are current. Saying so is the difference between a document and a
       document that misleads the person settling a dispute with it. */
    L.push(agenda.frozen
      ? `_Meridian IT-PMO — the agenda above is the record frozen when this meeting closed on ${agenda.asOf}; the open actions and the slate are current state._`
      : `_Generated by Meridian IT-PMO from portfolio state as at ${agenda.asOf}._`);
    const md = L.join("\n");

    if (req.query.format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="pack-${o.id}.md"`);
      return res.send(md);
    }
    res.json({ markdown: md });
  } catch (e) { next(e); }
});

export default r;

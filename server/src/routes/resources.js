/**
 * RESOURCES AND COSTS — docs/41 wave B (FX-08, FX-09, FX-10).
 *
 * The routes of the portfolio router's pattern, in a file of their own:
 * resolve the resource → ask rbac.can → mutate inside `audited()` → answer
 * the fresh row version, 409 on a stale one.
 *
 *   /assignments   FX-08 — who works on which activity, at what units
 *   /rates         FX-10 — the price of a day, by person or by role
 *   /leveling/*    FX-09 — a proposal that writes nothing (D-41.02), and
 *                  the audited application of the moves a person selects
 *
 * The arithmetic lives in `shared/resources.js`, pure, so the screen and
 * the proposal read the same numbers.
 */

import { Router } from "express";
import { one, updateVersioned, allocateId, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited, record } from "../audit.js";
import { HttpError } from "../auth.js";
import { loadPortfolio, projectFor } from "../portfolio.js";
import { D, days } from "../../../shared/engine.js";
import { proposeLeveling } from "../../../shared/resources.js";

const r = Router();

const bad = (msg) => { throw new HttpError(400, msg); };
const conflict = (out) => {
  if (!out.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return out;
};
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
/** An activity and its project, 404 when either is out of the caller's sight. */
async function activityFor(id, user) {
  const a = id ? await one(`SELECT * FROM activity WHERE id = $1`, [String(id)]) : null;
  if (!a) throw new HttpError(404, "No such activity");
  const p = await projectFor(a.project_id);
  if (!p || !canSeeProject(user, p)) throw new HttpError(404, "No such activity");
  return { a, p };
}
const isoDay = (v, what) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(D(s).getTime())) bad(`${what} must be an ISO date (YYYY-MM-DD)`);
  return s;
};

/* ── FX-08 · assignments ──────────────────────────────────────────────
   The permission is the allocation's: whoever may put a person on a
   project may say what they do on it. A role assignment names no person,
   so only the project is asked. */

export function assignmentUnits(v) {
  const n = Math.round(Number(v ?? 100));
  if (!Number.isFinite(n) || n < 1 || n > 200) bad("Units are a whole percentage from 1 to 200");
  return n;
}
export function assignmentWorkDays(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) bad("Work is a number of person-days, 0 or more — leave it empty to compute it");
  return n;
}
/** Exactly one of a person and a role. */
export async function assignee(b) {
  const person = b.person ? String(b.person) : "";
  const role = b.role ? String(b.role).trim().slice(0, 120) : "";
  if (!person && !role) bad("An assignment names a person or a role");
  if (person && role) bad("An assignment names a person OR a role — not both");
  if (!person) return { person: null, role };
  const row = await one(`SELECT id, site_id, active FROM person WHERE id = $1`, [person]);
  if (!row) throw new HttpError(404, "No such person");
  if (!row.active) bad("That person has left — assign an active person, or a role");
  return { person: row, role: "" };
}

r.post("/assignments", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const { a, p } = await activityFor(b.activity, req.user);
    const who = await assignee(b);
    gate(req.user, "allocation.write", { project: p, person: who.person ?? undefined });
    const units = assignmentUnits(b.units);
    const work = assignmentWorkDays(b.work);
    let id = null;
    await audited(req.user,
      () => ({ action: "Assignment added", entity: "assignment", entityId: id,
               detail: `${who.person?.id ?? who.role} on ${a.id} at ${units}%` +
                       (work !== null ? ` · work ${work} d` : "") }),
      async (t) => {
        id = await allocateId(t, "ASG", { pad: 3 });
        return t.query(
          `INSERT INTO assignment (id, activity_id, person_id, role_label, units, work_days, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, a.id, who.person?.id ?? null, who.role, units, work, String(b.note ?? "").slice(0, 2000)]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/assignments/:id", async (req, res, next) => {
  try {
    const x = await one(`SELECT * FROM assignment WHERE id = $1`, [req.params.id]);
    if (!x) throw new HttpError(404, "No such assignment");
    const { p } = await activityFor(x.activity_id, req.user);
    const b = req.body ?? {};
    const patch = {};
    let person = x.person_id ? await one(`SELECT id, site_id FROM person WHERE id = $1`, [x.person_id]) : null;
    if (b.person !== undefined || b.role !== undefined) {
      const who = await assignee({ person: b.person ?? null, role: b.role ?? null });
      patch.person_id = who.person?.id ?? null;
      patch.role_label = who.role;
      /* Moving the work to another person is allocating that person: the
         site-lead rule is asked of the new one too. */
      if (who.person) gate(req.user, "allocation.write", { project: p, person: who.person });
    }
    gate(req.user, "allocation.write", { project: p, person: person ?? undefined });
    if (b.units !== undefined) patch.units = assignmentUnits(b.units);
    if (b.work !== undefined) patch.work_days = assignmentWorkDays(b.work);
    if (b.note !== undefined) patch.note = String(b.note ?? "").slice(0, 2000);
    const out = await audited(req.user,
      { action: "Assignment updated", entity: "assignment", entityId: x.id,
        detail: `${x.activity_id} · ${patch.person_id ?? x.person_id ?? patch.role_label ?? x.role_label}`,
        before: { person: x.person_id, role: x.role_label, units: x.units, work: x.work_days },
        after: { person: patch.person_id ?? x.person_id, role: patch.role_label ?? x.role_label,
                 units: patch.units ?? x.units, work: patch.work_days !== undefined ? patch.work_days : x.work_days } },
      async (t) => conflict(await updateVersioned(t, "assignment", x.id, requiredVersion(b, "assignment"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/assignments/:id", async (req, res, next) => {
  try {
    const x = await one(`SELECT * FROM assignment WHERE id = $1`, [req.params.id]);
    if (!x) throw new HttpError(404, "No such assignment");
    const { p } = await activityFor(x.activity_id, req.user);
    const person = x.person_id ? await one(`SELECT id, site_id FROM person WHERE id = $1`, [x.person_id]) : null;
    gate(req.user, "allocation.write", { project: p, person: person ?? undefined });
    await audited(req.user,
      { action: "Assignment removed", entity: "assignment", entityId: x.id,
        detail: `${x.person_id ?? x.role_label} off ${x.activity_id}`, before: { ...x } },
      async (t) => t.query(`DELETE FROM assignment WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── FX-10 · rates ────────────────────────────────────────────────────
   Group money (rbac `rate.write`). A person OR a role, a day rate in whole
   units of its currency, the fx posed on the line, and the dates it holds. */

async function rateBody(b, row = null) {
  const out = {};
  if (b.person !== undefined || b.role !== undefined || !row) {
    const person = b.person ? String(b.person) : "";
    const role = b.role ? String(b.role).trim().slice(0, 120) : "";
    if (!person && !role) bad("A rate prices a person or a role");
    if (person && role) bad("A rate prices a person OR a role — not both");
    if (person && !(await one(`SELECT id FROM person WHERE id = $1`, [person]))) throw new HttpError(404, "No such person");
    out.person_id = person || null;
    out.role_label = role;
  }
  if (b.dayRate !== undefined || !row) {
    const n = Number(b.dayRate);
    if (!Number.isFinite(n) || n < 0) bad("A day rate is a number, 0 or more, in whole units of its currency");
    out.day_rate = n;
  }
  if (b.currency !== undefined) {
    const c = String(b.currency || "USD").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) bad("A currency is a three-letter code (USD, EUR, XOF…)");
    out.currency = c;
  }
  if (b.fx !== undefined) {
    const n = Number(b.fx);
    if (!Number.isFinite(n) || n <= 0) bad("The exchange rate is a positive number — reporting-currency units per unit of this currency");
    out.fx_rate = n;
  }
  if (b.from !== undefined || !row) {
    const f = isoDay(b.from, "The start of the rate");
    if (!f) bad("A rate needs the date it takes effect");
    out.effective_from = f;
  }
  if (b.to !== undefined) out.effective_to = isoDay(b.to, "The end of the rate");
  const from = out.effective_from ?? row?.effective_from;
  const to = out.effective_to !== undefined ? out.effective_to : row?.effective_to;
  if (to && from && D(to) < D(from)) bad("A rate cannot end before it takes effect");
  if (b.note !== undefined) out.note = String(b.note ?? "").slice(0, 2000);
  return out;
}

r.post("/rates", async (req, res, next) => {
  try {
    gate(req.user, "rate.write");
    const b = req.body ?? {};
    const v = await rateBody(b);
    let id = null;
    await audited(req.user,
      () => ({ action: "Rate set", entity: "rate", entityId: id,
               detail: `${v.person_id ?? v.role_label} · ${v.day_rate} ${v.currency ?? "USD"}/d from ${v.effective_from}` }),
      async (t) => {
        id = await allocateId(t, "RATE", { pad: 3 });
        return t.query(
          `INSERT INTO rate (id, person_id, role_label, day_rate, currency, fx_rate, effective_from, effective_to, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, v.person_id, v.role_label, v.day_rate, v.currency ?? "USD", v.fx_rate ?? 1,
           v.effective_from, v.effective_to ?? null, v.note ?? ""]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/rates/:id", async (req, res, next) => {
  try {
    gate(req.user, "rate.write");
    const x = await one(`SELECT * FROM rate WHERE id = $1`, [req.params.id]);
    if (!x) throw new HttpError(404, "No such rate");
    const b = req.body ?? {};
    const patch = await rateBody(b, x);
    const out = await audited(req.user,
      { action: "Rate updated", entity: "rate", entityId: x.id, detail: x.person_id ?? x.role_label,
        before: { day_rate: Number(x.day_rate), currency: x.currency, effective_from: x.effective_from, effective_to: x.effective_to },
        after: { ...patch } },
      async (t) => conflict(await updateVersioned(t, "rate", x.id, requiredVersion(b, "rate"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/rates/:id", async (req, res, next) => {
  try {
    gate(req.user, "rate.write");
    const x = await one(`SELECT * FROM rate WHERE id = $1`, [req.params.id]);
    if (!x) throw new HttpError(404, "No such rate");
    await audited(req.user,
      { action: "Rate removed", entity: "rate", entityId: x.id, detail: x.person_id ?? x.role_label, before: { ...x } },
      async (t) => t.query(`DELETE FROM rate WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── FX-09 · leveling ─────────────────────────────────────────────────
   D-41.02: the proposal is a READ. It is computed on the book this
   account may see, and moves only what this account may move
   (`schedule.level`, the same authority as moving the bar by hand), so
   the proposal never offers a move the application would refuse. */

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

r.get("/leveling/proposal", async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    const projects = new Map(db.projects.map((p) => [p.id, p]));
    const asRow = (p) => ({ id: p.id, programme_id: p.programme, site_id: p.site,
      governance_level: p.governanceLevel, closed: p.closed });
    const movable = (a) => {
      const p = projects.get(a.project);
      return !!p && can(req.user, "schedule.level", { project: asRow(p) }).ok;
    };
    const proposal = proposeLeveling(db, {
      weeks: clampInt(req.query.weeks, 1, 52, 12),
      from: isoDay(req.query.from, "from") ?? undefined,
      movable,
    });
    res.json({ statusDate: db.statusDate, ...proposal });
  } catch (e) { next(e); }
});

/* Applying: each selected move is its own audited activity update, under
   the row_version the proposal read — one audit row per activity (and one
   naming the whole application), all in ONE transaction: a leveling half applied is a plan nobody proposed, so
   a stale version or a refusal on any move leaves every activity as it
   was. Authority is asked of every move before anything is written. */
r.post("/leveling/apply", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const list = Array.isArray(b.moves) ? b.moves : [];
    if (!list.length) bad("Select at least one move to apply");
    if (list.length > 200) bad("At most 200 moves are applied at once");
    const reason = String(b.reason ?? "").trim().slice(0, 500);
    const seen = new Set();
    const rows = [];
    for (const m of list) {
      const id = String(m?.activity ?? "");
      if (seen.has(id)) bad(`${id} appears twice in the moves`);
      seen.add(id);
      const { a, p } = await activityFor(id, req.user);
      gate(req.user, "schedule.level", { project: p });
      if (a.origin === "sdp") {
        throw new HttpError(403, `${a.id} is synchronised from the SDP roadmap — it is edited there, not in Meridian`);
      }
      const start = isoDay(m.start, "start"), end = isoDay(m.end, "end");
      if (!start || !end) bad(`${a.id}: a move names its new start and end`);
      if (D(end) < D(start)) bad(`${a.id}: a stage cannot end before it starts`);
      rows.push({ a, start, end, version: requiredVersion(m, "activity") });
    }
    const out = await audited(req.user,
      (done) => ({ action: "Leveling applied", entity: "activity", entityId: "",
        detail: `${done.length} move(s): ${done.map((d) => d.activity).join(", ")}` +
                (reason ? ` — ${reason}` : "") }),
      async (t) => {
      const done = [];
      for (const { a, start, end, version } of rows) {
        const v = conflict(await updateVersioned(t, "activity", a.id, version,
          { start_date: start, end_date: end }));
        await record(t, req.user, {
          action: "Activity levelled", entity: "activity", entityId: a.id,
          detail: `${a.name}: ${a.start_date} → ${start} (${days(a.start_date, start)} d)` +
                  (reason ? ` — ${reason}` : ""),
          before: { start: a.start_date, end: a.end_date },
          after: { start, end },
        });
        done.push({ activity: a.id, version: v.version });
      }
      return done;
    });
    res.json({ applied: out });
  } catch (e) { next(e); }
});

export default r;

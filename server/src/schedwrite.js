/**
 * FX-01…FX-04 (docs/41, 061) — what a write may say about a stage's
 * schedule, checked once for every door: the screen's routes
 * (routes/portfolio.js) and the /api/v1 contract (v1write.js).
 *
 *   linksFor       a typed predecessor list — same project, no self, no
 *                  duplicate, no loop
 *   trackingPatch  constraint, deadline, actuals and remaining, as columns
 *   calendarRef    a calendar a project or a site may name
 *   bumpVersion    the row_version assertion for a write whose substance
 *                  lives in another table (the link list, the holidays)
 */

import { many, one } from "./db.js";
import { HttpError } from "./auth.js";
import { D } from "../../shared/engine.js";
import { LINK_TYPES, CONSTRAINT_TYPES } from "../../shared/schedule.js";

const bad = (msg) => { throw new HttpError(400, msg); };

/** An ISO day, or null when absent; malformed is refused, never coerced. */
function isoDay(v, what) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(D(s).getTime())) {
    bad(`${what} must be an ISO date (YYYY-MM-DD)`);
  }
  return s;
}

export const linkLabel = (l) => `${l.pred} ${l.type}${l.lag ? (l.lag > 0 ? "+" : "") + l.lag + "d" : ""}`;

/** UPDATE … row_version + 1 under the version the caller read — for a
    write whose substance is in another table (the link list). */
export async function bumpVersion(t, table, id, version) {
  const r2 = await t.query(
    `UPDATE ${table} SET row_version = row_version + 1 WHERE id = $1 AND row_version = $2 RETURNING row_version`,
    [id, version]);
  return r2.rows.length ? { ok: true, version: r2.rows[0].row_version } : { ok: false };
}

/**
 * A typed predecessor list, checked: each predecessor is a stage of the
 * same project, named once, never the stage itself, and the whole network
 * stays acyclic — a loop has no early start, and the engine would answer
 * NaN rather than refuse.
 */
export async function linksFor(a, raw) {
  if (!Array.isArray(raw)) bad("links is a list of { pred, type, lag }");
  if (raw.length > 50) bad("A stage has at most 50 predecessors");
  const siblings = await many(`SELECT id FROM activity WHERE project_id = $1`, [a.project_id]);
  const ids = new Set(siblings.map((x) => x.id));
  const seen = new Set();
  const out = raw.map((l) => {
    const pred = String(l?.pred ?? "");
    if (!ids.has(pred)) bad(`No stage ${pred || "(blank)"} in this project — a predecessor is a stage of the same project`);
    if (pred === a.id) bad("A stage cannot be its own predecessor");
    if (seen.has(pred)) bad(`${pred} is named twice — one link per predecessor`);
    seen.add(pred);
    const type = l?.type === undefined || l?.type === null || l?.type === "" ? "FS" : String(l.type).toUpperCase();
    if (!LINK_TYPES.includes(type)) bad(`A link type is ${LINK_TYPES.join(", ")} — not ${l.type}`);
    const lag = l?.lag === undefined || l?.lag === null || l?.lag === "" ? 0 : Number(l.lag);
    if (!Number.isInteger(lag) || Math.abs(lag) > 3650) bad("A lag is a whole number of days, negative for a lead, within ten years");
    return { pred, type, lag };
  });
  /* the rest of the project's network, with this stage's list replaced */
  const edges = await many(
    `SELECT d.activity_id, d.predecessor_id FROM activity_dep d JOIN activity x ON x.id = d.activity_id
      WHERE x.project_id = $1 AND d.activity_id <> $2`, [a.project_id, a.id]);
  const predsOf = new Map();
  for (const e of edges) {
    if (!predsOf.has(e.activity_id)) predsOf.set(e.activity_id, []);
    predsOf.get(e.activity_id).push(e.predecessor_id);
  }
  predsOf.set(a.id, out.map((l) => l.pred));
  /* does `from` reach `a` by walking predecessors? then a → … → from → a */
  const reaches = (from, stack = new Set()) => {
    if (from === a.id) return true;
    if (stack.has(from)) return false;
    stack.add(from);
    return (predsOf.get(from) ?? []).some((x) => reaches(x, stack));
  };
  for (const l of out) {
    if (reaches(l.pred)) bad(`Linking ${l.pred} before ${a.id} closes a loop — ${a.id} already comes before it`);
  }
  return out;
}

/** The constraint, deadline and actuals a stage body carries, as columns. */
export function trackingPatch(b, a) {
  const patch = {};
  if (b.constraintType !== undefined || b.constraintDate !== undefined) {
    const type = String(b.constraintType ?? a.constraint_type ?? "ASAP").toUpperCase() || "ASAP";
    if (!CONSTRAINT_TYPES.includes(type)) bad(`A constraint is one of ${CONSTRAINT_TYPES.join(", ")}`);
    const date = type === "ASAP" ? null
      : isoDay(b.constraintDate !== undefined ? b.constraintDate : a.constraint_date, "constraintDate");
    if (type !== "ASAP" && !date) bad(`${type} needs a date — "as soon as possible" is the only constraint without one`);
    patch.constraint_type = type;
    patch.constraint_date = date;
  }
  if (b.deadline !== undefined) patch.deadline = isoDay(b.deadline, "deadline");
  if (b.actualStart !== undefined) patch.actual_start = isoDay(b.actualStart, "actualStart");
  if (b.actualFinish !== undefined) patch.actual_finish = isoDay(b.actualFinish, "actualFinish");
  const started = "actual_start" in patch ? patch.actual_start : a.actual_start;
  const finished = "actual_finish" in patch ? patch.actual_finish : a.actual_finish;
  if (finished && !started) bad("An actual finish needs an actual start — when did the work begin?");
  if (finished && started && D(finished) < D(started)) bad("The actual finish cannot come before the actual start");
  if (b.remaining !== undefined) {
    if (b.remaining === null || b.remaining === "") patch.remaining_days = null;
    else {
      const n = Number(b.remaining);
      if (!Number.isInteger(n) || n < 0 || n > 3650) bad("Remaining is a whole number of days, zero or more");
      patch.remaining_days = n;
    }
  }
  return patch;
}

/** A calendar a project or a site may name: an existing one, or none. */
export async function calendarRef(v) {
  if (v === null || v === "" || v === undefined) return null;
  const c = await one(`SELECT id FROM work_calendar WHERE id = $1`, [String(v)]);
  if (!c) bad(`No such calendar: ${v}`);
  return c.id;
}


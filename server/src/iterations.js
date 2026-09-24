/**
 * FX-14 — sprints and the work item's links, the rules both doors share.
 *
 * A person plans sprints on the board (routes/iterations.js); a CI or a
 * Jira-like tracker pushes them through PUT /api/v1/iterations and
 * /api/v1/workitems (v1write.js). The two doors apply the same rules, so
 * they are written once, here:
 *
 *   · a sprint is dated, belongs to one project, and moves planned →
 *     active → closed. One active sprint per project (the database holds
 *     it too — 065's partial unique index);
 *   · a sprint closes through `closeIteration` only, which says where the
 *     unfinished items go (the backlog or a PLANNED sprint of the same
 *     project — never silently) and records the points delivered;
 *   · a closed sprint is a record: it is not edited, reopened or removed;
 *   · an item's sprint and stage belong to the item's project;
 *   · `done_at` is stamped on the move INTO Done and cleared on the move
 *     out, wherever the move comes from.
 */

import { one } from "./db.js";
import { HttpError } from "./auth.js";
import { D } from "../../shared/engine.js";
import { DONE_COLUMN, closingPlan } from "../../shared/agile.js";

const bad = (msg) => { throw new HttpError(400, msg); };

export function isoDay(v, what) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(D(s).getTime())) {
    bad(`${what} must be an ISO date (YYYY-MM-DD)`);
  }
  return s;
}

/**
 * The fields of a sprint a body may set, validated. `existing` is the row
 * being changed (null on a create). A state change to `closed` is refused
 * here: closing says where the unfinished items go, so it has its own act.
 */
export async function iterationPatch(b, existing, projectId) {
  const patch = {};
  if (existing?.state === "closed") {
    throw new HttpError(409, "This sprint is closed — a closed sprint is a record of what was delivered, and is not edited");
  }
  if (b.name !== undefined) {
    const name = String(b.name ?? "").trim().slice(0, 120);
    if (!name) bad("A sprint needs a name");
    patch.name = name;
  }
  if (b.start !== undefined) patch.starts_on = isoDay(b.start, "start") ?? bad("A sprint needs a start date");
  if (b.end !== undefined) patch.ends_on = isoDay(b.end, "end") ?? bad("A sprint needs an end date");
  const start = patch.starts_on ?? existing?.starts_on;
  const end = patch.ends_on ?? existing?.ends_on;
  if (start && end && String(end).slice(0, 10) < String(start).slice(0, 10)) bad("A sprint cannot end before it starts");
  if (b.goal !== undefined) patch.goal = String(b.goal ?? "").slice(0, 1000);
  if (b.state !== undefined && b.state !== (existing?.state ?? "planned")) {
    if (b.state === "closed") {
      bad("A sprint is closed by its close action, which says where its unfinished items go — the backlog or the next sprint");
    }
    if (!["planned", "active"].includes(b.state)) bad("A sprint is planned, active or closed");
    if (b.state === "active") await assertNoOtherActive(projectId, existing?.id ?? null);
    patch.state = b.state;
  }
  return patch;
}

export async function assertNoOtherActive(projectId, exceptId) {
  const other = await one(
    `SELECT id, name FROM iteration WHERE project_id = $1 AND state = 'active' AND id <> $2`,
    [projectId, exceptId ?? ""]);
  if (other) {
    bad(`${other.id} · ${other.name} is the active sprint of this project — close it before starting another`);
  }
}

/**
 * An item's sprint and stage, resolved and checked against the item's
 * project. `undefined` leaves a link alone; "" or null clears it.
 * `lookup(table, ref)` resolves an id (and, on /api/v1, the caller's own
 * external ids).
 */
export async function itemLinks(b, projectId, lookup = async (table, ref) => ref) {
  const out = {};
  if (b.iteration !== undefined) {
    if (b.iteration === null || b.iteration === "" || b.iteration === "backlog") out.iteration_id = null;
    else {
      const id = await lookup("iteration", String(b.iteration));
      const it = id ? await one(`SELECT * FROM iteration WHERE id = $1`, [id]) : null;
      if (!it || it.project_id !== projectId) bad(`No such sprint on this project: ${b.iteration}`);
      if (it.state === "closed") bad(`${it.id} · ${it.name} is closed — plan the item in the backlog or a sprint that is not closed`);
      out.iteration_id = it.id;
    }
  }
  if (b.activity !== undefined) {
    if (b.activity === null || b.activity === "") out.activity_id = null;
    else {
      const id = await lookup("activity", String(b.activity));
      const a = id ? await one(`SELECT id, project_id FROM activity WHERE id = $1`, [id]) : null;
      if (!a || a.project_id !== projectId) bad(`No such stage on this project: ${b.activity}`);
      out.activity_id = a.id;
    }
  }
  return out;
}

/** Points: a whole number ≥ 0, or null — nobody has estimated it. */
export function pointsValue(v, fallback) {
  if (v === undefined) return fallback;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) bad("Points are a whole number, zero or more — or empty when not estimated");
  return Math.round(n);
}

/** `done_at` follows the column: stamped on the move into Done, cleared out of it. */
export function doneStamp(fromColumn, toColumn) {
  if (toColumn === undefined || toColumn === fromColumn) return {};
  if (toColumn === DONE_COLUMN) return { done_at: new Date().toISOString() };
  if (fromColumn === DONE_COLUMN) return { done_at: null };
  return {};
}

/**
 * Close a sprint, inside the caller's transaction `t`: record the points
 * it delivered, send its unfinished items where `to` says, bump every row
 * it touches. Returns what was done, for the trail.
 */
export async function closeIteration(t, it, to, closedOn) {
  const rows = (await t.query(
    `SELECT id, column_id, points, iteration_id FROM work_item WHERE iteration_id = $1 ORDER BY id`, [it.id])).rows;
  const siblings = (await t.query(
    `SELECT id, project_id, state FROM iteration WHERE project_id = $1`, [it.project_id])).rows;
  const plan = closingPlan(
    { id: it.id, project: it.project_id, state: it.state },
    rows.map((r) => ({ id: r.id, column: r.column_id, points: r.points === null ? null : Number(r.points), iteration: r.iteration_id })),
    siblings.map((s) => ({ id: s.id, project: s.project_id, state: s.state })),
    to);
  if (!plan.ok) bad(plan.why);
  const target = plan.to === "backlog" ? null : plan.to;
  if (plan.carried.length) {
    await t.query(
      `UPDATE work_item SET iteration_id = $2, row_version = row_version + 1 WHERE id = ANY($1)`,
      [plan.carried, target]);
  }
  const r = await t.query(
    `UPDATE iteration SET state = 'closed', done_points = $2, closed_on = $3, row_version = row_version + 1
      WHERE id = $1 AND row_version = $4 RETURNING row_version`,
    [it.id, plan.donePoints, closedOn, it.row_version]);
  if (!r.rows.length) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return { version: r.rows[0].row_version, donePoints: plan.donePoints, carried: plan.carried, to: plan.to };
}

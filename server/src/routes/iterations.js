/**
 * FX-14 (docs/41, S3) — sprints, written from a session.
 *
 * Plan a sprint on a project, start it, close it. Every act is an
 * ordinary project write under `iteration.write` (decided in
 * shared/rbac.js), audited, and versioned: a stale version is a 409.
 *
 * Closing is its own act because it does two things a PATCH cannot say:
 * it records the points the sprint delivered (the figure velocity reads,
 * frozen like a closed period), and it sends the unfinished items
 * somewhere — the backlog or a planned sprint, chosen explicitly. A close
 * that does not say where is refused rather than guessed.
 *
 * Planning an item into a sprint is a PATCH of the item
 * (`/workitems/:id`, `iteration`), in routes/portfolio.js beside the
 * board's other item writes.
 */

import { Router } from "express";
import { one, allocateId, updateVersioned, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor } from "../portfolio.js";
import { iterationPatch, closeIteration, isoDay } from "../iterations.js";

const r = Router();

const bad = (msg) => { throw new HttpError(400, msg); };
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
/* Out of scope answers exactly as absent does (B2): 404, never 403. */
async function project(id, user) {
  const p = id ? await projectFor(String(id)) : null;
  if (!p || !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
async function iteration(id, user) {
  const it = await one(`SELECT * FROM iteration WHERE id = $1`, [String(id)]);
  if (!it) throw new HttpError(404, "No such sprint");
  const p = await project(it.project_id, user);
  gate(user, "iteration.write", { project: p });
  return { it, p };
}
const label = (it) => `${it.id} · ${it.name}`;

r.post("/iterations", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "iteration.write", { project: p });
    if (!b.start || !b.end) bad("A sprint needs a start and an end date");
    const patch = await iterationPatch({ name: b.name ?? "", start: b.start, end: b.end, goal: b.goal ?? "",
      state: b.state ?? "planned" }, null, p.id);
    let id = null;
    await audited(req.user,
      () => ({ action: "Sprint added", entity: "iteration", entityId: id,
        detail: `${patch.name} (${patch.starts_on} → ${patch.ends_on}) on ${p.id}`,
        after: { ...patch } }),
      async (t) => {
        id = await allocateId(t, "IT");
        return t.query(
          `INSERT INTO iteration (id, project_id, name, starts_on, ends_on, goal, state)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, p.id, patch.name, patch.starts_on, patch.ends_on, patch.goal ?? "", patch.state ?? "planned"]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/iterations/:id", async (req, res, next) => {
  try {
    const { it } = await iteration(req.params.id, req.user);
    const b = req.body ?? {};
    const version = requiredVersion(b, "sprint");
    const patch = await iterationPatch(b, it, it.project_id);
    const started = patch.state === "active";
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, it[k]]));
    const out = await audited(req.user,
      { action: started ? "Sprint started" : "Sprint updated", entity: "iteration", entityId: it.id,
        detail: label({ ...it, ...patch }), before, after: { ...patch } },
      async (t) => {
        const w = await updateVersioned(t, "iteration", it.id, version, patch);
        if (!w.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
        return w;
      });
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* Close: `unfinished` is "backlog" or the id of a planned sprint of the
   same project. `closedOn` defaults to today. */
r.post("/iterations/:id/close", async (req, res, next) => {
  try {
    const { it } = await iteration(req.params.id, req.user);
    const b = req.body ?? {};
    const version = requiredVersion(b, "sprint");
    const closedOn = isoDay(b.closedOn, "closedOn") ?? new Date().toISOString().slice(0, 10);
    let done = null;
    await audited(req.user,
      () => ({ action: "Sprint closed", entity: "iteration", entityId: it.id,
        detail: `${label(it)} — ${done.donePoints} points delivered; ` +
          (done.carried.length ? `${done.carried.length} unfinished to ${done.to}` : "nothing unfinished"),
        before: { state: it.state },
        after: { state: "closed", donePoints: done.donePoints, closedOn, carried: done.carried, to: done.to } }),
      async (t) => {
        done = await closeIteration(t, { ...it, row_version: version }, b.unfinished, closedOn);
        return done;
      });
    res.json({ version: done.version, donePoints: done.donePoints, carried: done.carried, to: done.to });
  } catch (e) { next(e); }
});

/* A planned or active sprint may be removed; its items return to the
   backlog (065: ON DELETE SET NULL), and the trail names them. A closed
   sprint is a record and stays. */
r.delete("/iterations/:id", async (req, res, next) => {
  try {
    const { it } = await iteration(req.params.id, req.user);
    if (it.state === "closed") {
      throw new HttpError(409, "This sprint is closed — a closed sprint is a record of what was delivered, and stays");
    }
    const items = (await one(
      `SELECT coalesce(array_agg(id ORDER BY id), '{}') AS ids FROM work_item WHERE iteration_id = $1`, [it.id])).ids;
    await audited(req.user,
      { action: "Sprint removed", entity: "iteration", entityId: it.id, detail: label(it),
        before: { ...it, items } },
      async (t) => {
        if (items.length) {
          await t.query(`UPDATE work_item SET row_version = row_version + 1 WHERE iteration_id = $1`, [it.id]);
        }
        return t.query(`DELETE FROM iteration WHERE id = $1`, [it.id]);
      });
    res.json({ ok: true, returnedToBacklog: items });
  } catch (e) { next(e); }
});

export default r;

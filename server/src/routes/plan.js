/**
 * PLAN ROUTES — docs/41 wave A2.
 *
 *   FX-05  PATCH /activities/:id/parent   a stage rolls up into another
 *   FX-07  GET   /projects/:id/baselines  the named baselines of a project
 *          POST  /projects/:id/baselines  take one
 *
 * Kept in their own router so the schedule's existing routes are not
 * rewritten to carry them. The same constitution: authority from
 * shared/rbac.js, every write through audited(), the stage's row_version
 * asserted, 409 on a stale one.
 *
 * There is no route that changes or removes a named baseline. It is a
 * photograph: read-only once taken (the database refuses a rewrite, 062).
 */

import { Router } from "express";
import { many, one, updateVersioned, allocateId, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor, loadBaselines } from "../portfolio.js";

const r = Router();
const bad = (msg) => { throw new HttpError(400, msg); };

async function project(id, user) {
  const p = await projectFor(id);
  if (!p || !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
function conflict(result) {
  if (!result.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return result;
}

/* ── FX-05 · the work breakdown ─────────────────────────────────────── */

/**
 * Give a stage a parent, or take it back to the top level.
 *
 * A stage that receives its FIRST child becomes a summary: its own weight
 * passes to that child (so the leaves still carry the whole budget and
 * the earned value does not move) and it must have no reported progress
 * and no dependency link — a summary's progress is its children's, and
 * it carries no link. A summary that loses its LAST child becomes a
 * plain stage again, of weight zero, over the window it last showed.
 */
r.patch("/activities/:id/parent", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM activity WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such stage");
    const p = await project(a.project_id, req.user);
    gate(req.user, "schedule.write", { project: p });
    if (a.origin === "sdp") {
      throw new HttpError(403, "This stage is synchronised from the SDP roadmap — it is edited there, not in Meridian");
    }
    const b = req.body ?? {};
    const version = requiredVersion(b, "stage");
    const to = b.parent === undefined || b.parent === null || b.parent === "" ? null : String(b.parent);
    if (to === a.id) bad("A stage cannot roll up into itself");

    let parent = null;
    let becomesSummary = false;
    if (to) {
      parent = await one(`SELECT * FROM activity WHERE id = $1`, [to]);
      if (!parent) bad("No such parent stage");
      if (parent.project_id !== a.project_id) bad("A stage rolls up into a stage of its own project");
      /* Never its own ancestor: walk up from the new parent. */
      const up = await many(
        `WITH RECURSIVE up(id, parent_id) AS (
           SELECT id, parent_id FROM activity WHERE id = $1
           UNION SELECT x.id, x.parent_id FROM activity x JOIN up ON x.id = up.parent_id)
         SELECT id FROM up`, [to]);
      if (up.some((x) => x.id === a.id)) {
        bad(`${to} is inside ${a.id} — a stage cannot roll up into one of its own children`);
      }
      const links = await one(
        `SELECT count(*)::int AS n FROM activity_dep WHERE activity_id = $1 OR predecessor_id = $1`, [to]);
      if (links.n > 0) {
        bad(`${parent.name} has dependency links, and a summary stage carries none — remove its links first, or link its children instead`);
      }
      const hasKids = await one(`SELECT 1 AS x FROM activity WHERE parent_id = $1 LIMIT 1`, [to]);
      becomesSummary = !hasKids;
      if (becomesSummary && parent.pct > 0) {
        bad(`${parent.name} has reported ${parent.pct}% — a summary's progress is computed from its children. ` +
            "Set it to 0% first, and report the progress on the stages under it");
      }
    }
    const from = a.parent_id ?? null;
    if (from === to) {
      return res.json({ version: a.row_version, unchanged: true });
    }
    const lastChild = from
      ? (await one(`SELECT count(*)::int AS n FROM activity WHERE parent_id = $1`, [from])).n === 1
      : false;

    const out = await audited(req.user,
      { action: "Stage moved in the breakdown", entity: "activity", entityId: a.id,
        detail: `${a.name}: ${from ?? "top level"} → ${to ?? "top level"}`,
        before: { parent: from }, after: { parent: to } },
      async (t) => {
        const patch = { parent_id: to };
        if (becomesSummary) patch.weight = +(Number(a.weight) + Number(parent.weight)).toFixed(4);
        const rv = conflict(await updateVersioned(t, "activity", a.id, version, patch));
        if (becomesSummary) {
          await t.query(
            `UPDATE activity SET weight = 0, pct = 0, row_version = row_version + 1 WHERE id = $1`, [to]);
        }
        if (lastChild) {
          /* The former summary keeps the window it showed, so the plan
             does not jump when its last child leaves. */
          await t.query(
            `UPDATE activity SET start_date = $2, end_date = $3, row_version = row_version + 1 WHERE id = $1`,
            [from, a.start_date, a.end_date]);
        }
        return rv;
      });
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── FX-07 · named baselines ─────────────────────────────────────────── */

export const MAX_BASELINES = 11;

r.get("/projects/:id/baselines", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.read", { project: p });
    res.json({ baselines: await loadBaselines([p.id]), max: MAX_BASELINES });
  } catch (e) { next(e); }
});

/**
 * Take a named baseline: every stage's start, end and weight as they
 * stand now. It never touches base_start / base_end — the governed
 * baseline moves only through the change chain.
 */
r.post("/projects/:id/baselines", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "baseline.snapshot", { project: p });
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim().slice(0, 120);
    if (!name) bad("A baseline needs a name — what it is the picture of (\"Approved plan\", \"After re-plan 2\")");
    const reason = String(b.reason ?? "").trim().slice(0, 500);
    if (!reason) bad("Say why this baseline is being taken — it is what someone comparing against it will read");
    const n = (await one(`SELECT count(*)::int AS n FROM baseline_snapshot WHERE project_id = $1`, [p.id])).n;
    if (n >= MAX_BASELINES) {
      throw new HttpError(409, `This project already keeps ${MAX_BASELINES} named baselines, the most a project holds`);
    }
    if (await one(`SELECT 1 AS x FROM baseline_snapshot WHERE project_id = $1 AND name = $2`, [p.id, name])) {
      throw new HttpError(409, `This project already has a baseline named "${name}" — baselines are never overwritten; choose another name`);
    }
    let id = null;
    await audited(req.user,
      () => ({ action: "Baseline taken", entity: "project", entityId: p.id, detail: `${id} · ${name} — ${reason}` }),
      async (t) => {
        id = await allocateId(t, "BSL");
        await t.query(
          `INSERT INTO baseline_snapshot (id, project_id, name, taken_by, reason) VALUES ($1,$2,$3,$4,$5)`,
          [id, p.id, name, req.user.id, reason]);
        await t.query(
          `INSERT INTO baseline_snapshot_row (snapshot_id, activity_id, name, parent_id, start_date, end_date, weight)
           SELECT $1, id, name, parent_id, start_date, end_date, weight FROM activity WHERE project_id = $2`,
          [id, p.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

export default r;

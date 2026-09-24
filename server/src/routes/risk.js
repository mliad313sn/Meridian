/**
 * SCHEDULE RISK ROUTES — docs/41 FX-11.
 *
 *   GET  /projects/:id/risk-runs   the stored Monte Carlo runs of a project (project.read)
 *   POST /projects/:id/risk-runs   run one and store it                     (risk.run)
 *
 * The simulation is computed HERE, on the book this account may see, by
 * the pure module shared/montecarlo.js — never taken from the browser:
 * a stored result that a client could have typed would not be a result.
 * Seed and iterations are stored with it, so anyone can run it again and
 * get the same numbers.
 *
 * D-41.02 — the only write is the run's own row. No date moves. There is
 * no route that changes or removes a run: it is read-only once stored
 * (the database refuses a rewrite, 066).
 */

import { Router } from "express";
import { allocateId } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor, loadPortfolio, loadRiskRuns } from "../portfolio.js";
import { Engine } from "../../../shared/engine.js";
import { simulate, MAX_ITERATIONS, DISTRIBUTION } from "../../../shared/montecarlo.js";

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

r.get("/projects/:id/risk-runs", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.read", { project: p });
    res.json({ runs: await loadRiskRuns([p.id]), max: MAX_ITERATIONS, distribution: DISTRIBUTION });
  } catch (e) { next(e); }
});

r.post("/projects/:id/risk-runs", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "risk.run", { project: p });
    const b = req.body ?? {};
    const iterations = b.iterations === undefined || b.iterations === null || b.iterations === ""
      ? 2000 : Number(b.iterations);
    if (!Number.isInteger(iterations) || iterations < 100 || iterations > MAX_ITERATIONS) {
      bad(`Iterations is a whole number from 100 to ${MAX_ITERATIONS}`);
    }
    let seed = b.seed === undefined || b.seed === null || b.seed === "" ? null : Number(b.seed);
    if (seed !== null && (!Number.isInteger(seed) || seed < 1 || seed > 4294967295)) {
      bad("A seed is a whole number from 1 to 4294967295 — the same seed gives the same result");
    }
    if (seed === null) seed = 1 + Math.floor(Math.random() * 2147483646);

    const db = await loadPortfolio(req.user);
    const pp = Engine.project(db, p.id);
    const acts = Engine.activities(db, p.id);
    if (!acts.length) bad("This project has no stage to simulate");
    const out = simulate(acts, {
      calendar: Engine.calendarFor(db, pp), statusDate: pp.statusDate || null, seed, iterations,
    });
    if (!out.estimated) {
      bad("No stage of this project carries three estimates — give at least one stage its optimistic, " +
        "most likely and pessimistic durations (Edit stage › More detail), or every run is the plan itself");
    }

    let id = null;
    await audited(req.user,
      () => ({ action: "Schedule risk run", entity: "project", entityId: p.id,
        detail: `${id} · seed ${out.seed} · ${out.iterations} runs · P50 ${out.p50} · P80 ${out.p80} · P90 ${out.p90}` }),
      async (t) => {
        id = await allocateId(t, "MCR");
        await t.query(
          `INSERT INTO risk_run (id, project_id, ran_by, seed, iterations, distribution, status_date, estimated,
                                 deterministic_finish, p50, p80, p90, histogram, criticality)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
          [id, p.id, req.user.id, out.seed, out.iterations, DISTRIBUTION, pp.statusDate || db.statusDate || null,
           out.estimated, out.deterministic, out.p50, out.p80, out.p90,
           JSON.stringify(out.histogram), JSON.stringify(out.criticality)]);
      });
    res.status(201).json({ id, ...out });
  } catch (e) { next(e); }
});

export default r;

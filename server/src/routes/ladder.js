/**
 * REQ-27 (RT365 V-8) · A PROJECT ALREADY IN THE BOOK MOVES ONTO ITS
 * PROGRAMME'S GATE LADDER — a dry run, and then an act.
 *
 * ── Why this is not a background migration ─────────────────────────
 *
 * D-33.2 is not negotiable and this router exists because of it, not in
 * spite of it: declaring a gate ladder on a programme DOES NOT rewrite
 * the projects that already exist. Their gates are dated, their evidence
 * is filed, and both would move under people's feet.
 *
 * So the move is an EXPLICIT ACT: somebody with the authority asks for
 * it, on ONE named project, and sees what it will do before it does it.
 *
 *   GET  /api/projects/:id/ladder   the dry run. Reads nothing but says
 *                                   everything: which milestones are
 *                                   adopted, which rungs are created,
 *                                   and which gates leave the ladder.
 *   POST /api/projects/:id/ladder   the act. One transaction, one audit
 *                                   row, the counts it actually did.
 *
 * The two share ONE computation (`planLadderMove` in wbs.js), for the
 * same reason `/api/signals` and `/api/v1/signals` share one: two
 * projections diverge at the first change, and an operator would then be
 * reading a preview of something else. The act does not trust the plan
 * the caller read either — it recomputes it inside its own transaction
 * and applies THAT. What the caller's request carries is a version and
 * an acknowledgement, and both are checked against the fresh plan.
 *
 * ── Authority ──────────────────────────────────────────────────────
 *
 * `ladder.migrate`, decided in shared/rbac.js like everything else. The
 * reasoning is `exception.sweep`'s: the level that sets a margin is the
 * level that checks it. A gate ladder is declared on the PROGRAMME, so
 * moving a project onto one is programme-office work, bounded by the
 * programme grant — never a site's, because a site does not own the
 * process the ladder encodes.
 *
 * The DRY RUN asks for the same action as the act. It is a read, but
 * what it reads out is the consequence of a write: which accepted gate,
 * carrying which filed evidence, would leave the ladder. Whoever may not
 * perform the act has no business being handed its rehearsal.
 *
 * ── This router is session-only, on purpose ────────────────────────
 *
 * There is deliberately no /api/v1 door. `adopt` on PUT /api/v1/milestones
 * already lets an integration bind its own rows to the scaffolded ones,
 * one at a time, by their predictable ids — that is a loader's job and it
 * is idempotent. Moving a whole project onto a different ladder retires
 * gates that carry a named person's acceptance; that is a governance
 * decision with a person's name on it, and an integration key does not
 * have one.
 */

import { Router } from "express";
import { query, many, requiredVersion, PreconditionRequired } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor } from "../portfolio.js";
import { planLadderMove, applyLadderMove, publicPlan, LADDER_REFUSAL, LadderConflict } from "../wbs.js";

const r = Router();

/**
 * Resolve and authorise. A project outside the caller's SIGHT answers
 * 404 exactly as one that does not exist (B2) — 403 would confirm it is
 * real. A project the caller can see but may not move answers 403 with
 * the sentence rbac.js wrote, which names who does it instead.
 */
async function entitled(req) {
  const p = await projectFor(req.params.id);
  if (!p) throw new HttpError(404, "No such project");
  if (!canSeeProject(req.user, p)) throw new HttpError(404, "No such project");
  const verdict = can(req.user, "ladder.migrate", { project: p });
  if (!verdict.ok) throw new HttpError(403, verdict.why);
  return p;
}

/**
 * The gates a PREVIOUS move already took off this project's ladder.
 *
 * `milestone.retired_gate` (047) is the whole point of that column: a row
 * that stopped being a rung keeps everything it had, and this is what
 * still says which rung it held. An operator reading the dry run needs it
 * — "four gates already left this ladder once" is the difference between
 * a first migration and a second one — and so does the screen that draws
 * the retired rows next to the live ladder.
 */
async function previouslyRetired(projectId) {
  const rows = await many(
    `SELECT id, name, retired_gate, due_date FROM milestone
      WHERE project_id = $1 AND retired_gate IS NOT NULL
      ORDER BY retired_gate`, [projectId]);
  return rows.map((m) => ({
    milestone: m.id, name: m.name, retiredGate: m.retired_gate, date: m.due_date,
  }));
}

/* ── the dry run ──────────────────────────────────────────────────────
   Read only, and read OUTSIDE a transaction on purpose: db.js refuses a
   module-level call issued while one is open, and this endpoint has no
   business holding one. */
r.get("/projects/:id/ladder", async (req, res, next) => {
  try {
    await entitled(req);
    const plan = await planLadderMove({ query }, req.params.id);
    if (!plan) throw new HttpError(404, "No such project");
    res.json({ ...publicPlan(plan), previouslyRetired: await previouslyRetired(req.params.id) });
  } catch (e) { next(e); }
});

/* ── the act ─────────────────────────────────────────────────────────
   One transaction: it either moves the project onto the ladder or it
   does nothing at all. */
r.post("/projects/:id/ladder", async (req, res, next) => {
  try {
    const p = await entitled(req);
    const b = req.body ?? {};
    const version = requiredVersion(b, "ladder move");
    const acknowledge = Array.isArray(b.acknowledge) ? b.acknowledge.map(String) : [];

    /* The plan the caller read is a rehearsal; the plan that is applied
       is the one computed inside this transaction, against the rows this
       transaction holds. Anything else is a promise about a book that
       has since moved. */
    let plan = null;
    const done = await audited(req.user,
      (out) => ({
        /* The trail says what HAPPENED, not what was asked for. An act
           that found the project already on the ladder wrote nothing, and
           a row claiming a migration would be the 5.13.0 defect again in
           the one place it can never be corrected (REQ-33). */
        action: out.alreadyOnLadder
          ? "Ladder move asked for — project already on its programme's ladder, nothing written"
          : "Project moved onto its programme's gate ladder",
        entity: "project", entityId: p.id,
        detail: out.adopted + " adopted · " + out.created + " created · " +
                out.retired + " retired — " + plan.programme +
                " (" + plan.ladder.gates + " gates)",
        before: { scaffoldedGates: plan.scaffoldedGates,
                  retired: plan.retire.map((x) => ({ milestone: x.milestone, gate: x.gate, name: x.name, carries: x.carries })) },
        after: { gates: plan.ladder.gates,
                 adopted: plan.adopt.map((x) => ({ rung: x.rung, milestone: x.milestone, was: x.was })),
                 created: plan.create.map((x) => ({ rung: x.rung, name: x.name, date: x.date })),
                 acknowledged: acknowledge },
      }),
      async (t) => {
        plan = await planLadderMove(t, p.id);
        if (!plan) throw new HttpError(404, "No such project");
        if (plan.refusal) throw new HttpError(409, plan.refusal);
        if (plan.version !== version) {
          throw new HttpError(409,
            "Someone else changed this project since you read the dry run — nothing was written. " +
            "Read it again (GET /api/projects/" + p.id + "/ladder) and repeat the act with the version it gives.");
        }

        /* Never silently. Every gate that would leave the ladder carrying
           an acceptance or a filed evidence citation has to be named by
           the caller — and a name the fresh plan does not know means the
           caller is acting on a rehearsal that no longer holds. */
        const refs = new Set(plan.retire.map((x) => x.ref));
        const unknown = acknowledge.filter((a) => !refs.has(a));
        if (unknown.length) throw new HttpError(409, LADDER_REFUSAL.stale(unknown));
        const missing = plan.acknowledgeRequired.filter((a) => !acknowledge.includes(a));
        if (missing.length) throw new HttpError(409, LADDER_REFUSAL.unacknowledged(missing));

        if (plan.onLadder) {
          /* Already there. Saying "migrated 6" here would be reporting a
             move that did not happen (REQ-33's lesson), so it reports
             zeros and says so in as many words. */
          return { adopted: 0, created: 0, retired: 0, rebound: 0, posed: 0, filed: 0,
                   gates: plan.ladder.gates, acknowledged: 0, alreadyOnLadder: true };
        }
        return await applyLadderMove(t, plan, { acknowledge });
      });

    res.json({
      ...publicPlanAfter(plan),
      previouslyRetired: await previouslyRetired(p.id),
      applied: done,
      note: done.alreadyOnLadder
        ? "This project was already on its programme's ladder — nothing was written."
        : `${done.adopted} milestone(s) adopted, ${done.created} rung(s) created, ${done.retired} gate(s) retired.`,
    });
  } catch (e) {
    if (e instanceof LadderConflict) return next(new HttpError(409, e.message));
    if (e instanceof PreconditionRequired) return next(e);
    next(e);
  }
});

/** The plan as the act saw it, so the caller can compare what it read
    with what was actually in front of the transaction. */
function publicPlanAfter(plan) {
  const p = publicPlan(plan);
  return { plan: p, project: p.project, programme: p.programme };
}

export default r;

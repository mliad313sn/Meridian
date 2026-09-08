/**
 * REQ-28 (RT365 V-9) — THE READ: governance quality signals.
 *
 * Two doors onto one computation (`shared/govsignals.js`), for the same
 * reason `/api/v1/portfolio` serves the screen's own serialiser: two
 * projections would diverge at the first change, and the integrator would
 * then be reading numbers nobody sees on the page.
 *
 *   GET /api/signals       the browser's door — cookie session, and the
 *                          rows narrowed to what this account may see.
 *   GET /api/v1/signals    the machines' door — an integration key
 *                          carrying `read:portfolio`.
 *
 * ── Why this router is mounted before the session wall ─────────────
 *
 * `/api/v1` is mounted in index.js BEFORE `requireUser()`, because the
 * caller there is a machine and not a person. A router that has to serve
 * both doors therefore has to sit on the same side of that wall, and put
 * the wall back on its own session route explicitly — which is what
 * `requireUser()` below does. `requirePasswordChanged()` is not needed:
 * it lets every GET through by design.
 *
 * ── Authority ──────────────────────────────────────────────────────
 *
 * `portfolio.read`, asked of `shared/rbac.js` through `require$` like
 * every other read in the product. No new action was added, and that is a
 * decision rather than an omission:
 *
 *   · nothing here is a new power. Every row this endpoint touches — the
 *     decisions of a room, the actions carried forward, the gates, the
 *     RAID register, the exceptions the sweep raised — is already
 *     readable by an account that can open the portfolio page;
 *   · what leaves this route is a COUNT and a NUMBER OF DAYS. No
 *     headline, no rationale, no title, no owner, no person. There is no
 *     sentence in the response that a reader could not already read;
 *   · and `portfolio.read` is narrowed by the query itself, which is
 *     exactly how rbac.js says that action is meant to work.
 *
 * Scope is the serialiser's, not a new one: `loadPortfolio` already
 * refuses to put an out-of-scope project, milestone, RAID row or
 * exception into the object (R1.10), so those four metrics inherit their
 * scope from it. Decisions and actions are not in the serialiser, so they
 * are read here with the SAME rule the serialiser applies to
 * portfolio-wide RAID: a row attached to a project the account may see,
 * or a row attached to no project at all.
 */

import { Router } from "express";
import { many } from "../db.js";
import { loadPortfolio } from "../portfolio.js";
import { requireUser } from "../auth.js";
import { require$ } from "../../../shared/rbac.js";
import { requireIntegration } from "../integrations.js";
import { govSignals } from "../../../shared/govsignals.js";

const r = Router();

/** How many monthly periods the trend spans. Six months of a monthly
    committee is five movements — enough to see a direction, short enough
    that a reorganisation eighteen months ago does not flatten it. */
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

function monthsOf(req) {
  const asked = Number(req.query.months);
  if (!Number.isFinite(asked)) return DEFAULT_MONTHS;
  return Math.min(MAX_MONTHS, Math.max(2, Math.floor(asked)));
}

/**
 * The decisions this account may see, reduced to their two clocks.
 *
 * `taken_on` is the day the decision was TAKEN — the meeting's own date
 * when it belongs to a room, and `decided_on` when it does not (migration
 * 034 made that second anchor possible and its CHECK guarantees one of
 * the two is present). `recorded_at` is the day the register learned of
 * it. Nothing else is selected: this endpoint has no business carrying a
 * headline or a rationale out of the meetings module.
 */
async function decisionsFor(ids) {
  return (await many(
    `SELECT d.id, d.project_id,
            COALESCE(o.meets_on, d.decided_on) AS taken_on,
            d.recorded_at, d.status
       FROM meeting_decision d
       LEFT JOIN meeting_occurrence o ON o.id = d.occurrence_id
      WHERE d.project_id IS NULL OR d.project_id = ANY($1)`,
    [ids]
  )).map((d) => ({
    id: d.id, project: d.project_id ?? null,
    takenOn: d.taken_on ?? null, recordedAt: d.recorded_at ?? null,
    status: d.status ?? "Ratified",
  }));
}

/**
 * The actions, reduced to when they were raised, whether they are still
 * open, and when they closed.
 *
 * `raised_on` is the DATE OF THE MEETING that raised the action, not the
 * moment its row appeared: an action loaded through the write contract
 * has a `created_at` of the afternoon of the import, and an ageing built
 * on that would report a two-year-old action as new the day a programme
 * migrates into Meridian. `created_at` remains the fallback for the case
 * `raised_in` cannot supply — which the schema makes impossible today,
 * and which costs nothing to survive.
 */
async function actionsFor(ids) {
  return (await many(
    `SELECT a.id, a.project_id, a.status, a.due_date, a.closed_at,
            COALESCE(o.meets_on, a.created_at::date) AS raised_on
       FROM meeting_action a
       LEFT JOIN meeting_occurrence o ON o.id = a.raised_in
      WHERE a.project_id IS NULL OR a.project_id = ANY($1)`,
    [ids]
  )).map((a) => ({
    id: a.id, project: a.project_id ?? null, status: a.status,
    raisedOn: a.raised_on ?? null, dueDate: a.due_date ?? null,
    closedAt: a.closed_at ?? null,
  }));
}

/** Everything the pure computation needs, gathered for one reader. */
async function signalsFor(user, months) {
  const db = await loadPortfolio(user);
  const ids = db.projects.map((p) => p.id);
  /* Read before nothing and inside nothing: these are plain reads, and
     db.js refuses a module-level call issued while a transaction is open.
     There is no transaction here — this endpoint writes nothing at all. */
  const [decisions, actions] = await Promise.all([decisionsFor(ids), actionsFor(ids)]);
  return govSignals({
    asAt: db.statusDate, months,
    programmes: db.programmes, projects: db.projects,
    milestones: db.milestones, raid: db.raid, exceptions: db.exceptions,
    decisions, actions,
  });
}

/* ── the browser's door ───────────────────────────────────────────── */
r.get("/signals", requireUser(), require$("portfolio.read"), async (req, res, next) => {
  try {
    res.json(await signalsFor(req.user, monthsOf(req)));
  } catch (e) { next(e); }
});

/* ── the machines' door ────────────────────────────────────────────────
   `read:portfolio`, not `read:meetings`. INT-02 separated the two so that
   a warehouse pulling the numbers does not carry the governance content
   away with them — and content is exactly what this endpoint does not
   emit. What crosses here is five aggregates over rows the same key
   already receives in full from `/api/v1/portfolio`; requiring a second
   scope for a strictly smaller disclosure would tell an integrator
   something untrue about what they are being given. */
r.get("/v1/signals", requireIntegration("read:portfolio"), async (req, res, next) => {
  try {
    res.json({
      contract: "v1",
      generatedAt: new Date().toISOString(),
      signals: await signalsFor(req.user, monthsOf(req)),
    });
  } catch (e) { next(e); }
});

export default r;

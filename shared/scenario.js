/**
 * FX-12 (docs/41) — PORTFOLIO SCENARIOS: « et si… ? », computed, never written.
 *
 * S2's question — « et si on reportait PRJ-118 d'un trimestre ? » — was
 * answered in a spreadsheet, off the record. A scenario is a named set of
 * changes over the live portfolio:
 *
 *   shift     defer (+weeks) or accelerate (−weeks) a project
 *   cancel    stop a project: spend stops at what is spent, its people
 *             and its future benefits are released
 *   budget    a project's budget becomes `amount` (millions)
 *   envelope  the capex envelope becomes `amount` (millions)
 *   weight    one ranking weight (REQ-24) becomes `weight`
 *
 * ── D-41.02, the rule this file is written under ─────────────────────
 *
 * NOTHING HERE WRITES THE BOOK. `applyScenario` takes a structured clone
 * of the book and changes the clone; `position` reads a book and returns
 * numbers; `compareScenario` runs `position` on the live book and on the
 * changed clone and puts them side by side. The live object a caller
 * passes in is deep-equal before and after (scenario.test.js holds it).
 *
 * No arithmetic of its own either: the numbers are the engine's
 * (`Engine.metrics`, `roll`, `prioritise`, `capacity`, `valueReport`,
 * `moneyPosition`, `effectiveFte`) and the ranking's (`prioritise` from
 * shared/prioritise.js), re-run on the clone. A scenario that computed
 * its own EAC would be a second opinion the committee would then argue
 * with; this one can only disagree with the live book because a change
 * made it disagree.
 *
 * ── What a shift moves, and what it does not ─────────────────────────
 *
 * A shift moves the project's REMAINING work, as a planner would:
 *   · a row wholly in the past (it ended before the status date) stays;
 *   · a row not started yet moves whole, and never to before the status
 *     date (an acceleration cannot make work have started yesterday);
 *   · a row under way keeps its start and moves its end, never to before
 *     the status date.
 * Rows: the project window, its stages, its open milestones, its
 * allocations, and its open benefits' realisation dates. The BASELINE
 * never moves — re-planning is not re-baselining (A1), and the variance a
 * shift creates is exactly what the comparison exists to show.
 *
 * ── What a cancel does ───────────────────────────────────────────────
 *
 * The budget falls to what has been spent (the ledger's actual cost), the
 * allocations still running end at the status date and those not started
 * are released, and the open future benefits are withdrawn. In the
 * comparison the project leaves the queue and the envelope. Closing the
 * RECORD is not a scenario's to do: it stays the closure gate's three
 * signatures (PM-08), so applying a cancel leaves the project open, with
 * no spend, no people and no promise, until that gate closes it.
 *
 * ── The plan ─────────────────────────────────────────────────────────
 *
 * Every change is also returned as the row mutations it would perform —
 * `{ entity, id, version, set, before }` or `{ …, remove: true }` — so the
 * server's apply writes exactly what the comparison showed, and asserts
 * the version of every row it touches. The plan is data; this file never
 * executes it.
 */

import { Engine, D, iso, addDays, days, sum, monthKey, addMonths } from "./engine.js";
import { prioritise, INPUTS } from "./prioritise.js";

export const CHANGE_KINDS = ["shift", "cancel", "budget", "envelope", "weight"];
export const SCENARIO_STATUS = ["Draft", "Proposed", "Applied", "Withdrawn"];
export const WEIGHT_INPUTS = INPUTS;

/** The kinds that name a project. */
export const PROJECT_KINDS = new Set(["shift", "cancel", "budget"]);

/** How far ahead the comparison reads capacity and value, in months. */
export const HORIZON_MONTHS = 12;

const clone = (v) => (typeof structuredClone === "function"
  ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const round6 = (v) => Math.round(Number(v) * 1e6) / 1e6;
const later = (a, b) => (D(a) >= D(b) ? a : b);

/**
 * Where a dated row goes when its project moves by `n` days, seen from
 * `asAt`. Null when the row does not move.
 */
export function moveSpan(start, end, n, asAt) {
  if (!end || !n) return null;
  if (D(end) < D(asAt)) return null;                       // done: history stays
  if (start && D(start) >= D(asAt)) {                      // not started: moves whole
    const s = later(iso(addDays(start, n)), asAt);
    const eff = days(start, s);
    if (!eff) return null;
    return { start: s, end: iso(addDays(end, eff)) };
  }
  const e = later(iso(addDays(end, n)), asAt);             // under way: the end moves
  return e === iso(D(end)) ? null : { start, end: e };
}

/** A single date (a milestone, a benefit) under the same rule. */
export function moveDate(date, n, asAt) {
  if (!date || !n || D(date) < D(asAt)) return null;
  const d = later(iso(addDays(date, n)), asAt);
  return d === iso(D(date)) ? null : d;
}

const OPEN_BENEFIT = (b) => b.actual == null && !["Realised", "Missed", "Withdrawn"].includes(b.status);

/* ═══════════════════════════════════════════════════════════════════
   APPLY — on a copy
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @param book {
 *   db         the serialiser's book (server/src/portfolio.js shape)
 *   weighting  loadWeighting() shape: { value, confidence, exposure, capacity, version, … }
 * }
 * @param changes [{ id, seq, kind, project, weeks, amount, input, weight }]
 * @returns { db, weighting, cancelled: Set, plan: [{ change, mutations, issue }] }
 */
export function applyScenario(book, changes = []) {
  const db = clone(book.db);
  db.settings = { ...(db.settings ?? {}) };
  const weighting = book.weighting ? { ...book.weighting } : null;
  const asAt = db.statusDate;
  const cancelled = new Set();
  const plan = [];

  const ordered = [...changes].sort((a, b) =>
    (Number(a.seq ?? 0) - Number(b.seq ?? 0)) || String(a.id).localeCompare(String(b.id)));

  const set = (step, entity, row, patch) => {
    const before = {};
    for (const k of Object.keys(patch)) before[k] = row[k] ?? null;
    step.mutations.push({ entity, id: row.id, version: row.version ?? null, set: patch, before });
    Object.assign(row, patch);
  };

  for (const c of ordered) {
    const step = { change: c, mutations: [], issue: null };
    plan.push(step);
    const p = PROJECT_KINDS.has(c.kind) ? db.projects.find((x) => x.id === c.project) : null;
    if (PROJECT_KINDS.has(c.kind)) {
      if (!p) { step.issue = "not-in-book"; continue; }
      if (p.closed) { step.issue = "closed"; continue; }
      if (cancelled.has(p.id)) { step.issue = "cancelled"; continue; }
    }

    switch (c.kind) {
      case "shift": {
        const n = Math.round(Number(c.weeks)) * 7;
        if (!Number.isFinite(n) || !n) { step.issue = "no-move"; break; }
        const win = moveSpan(p.start, p.finish, n, asAt);
        if (win) set(step, "project", p, { start: win.start, finish: win.end });
        for (const a of db.activities.filter((x) => x.project === p.id)) {
          const m = moveSpan(a.start, a.end, n, asAt);
          if (m) set(step, "activity", a, { start: m.start, end: m.end });
        }
        for (const m of db.milestones.filter((x) => x.project === p.id && !x.done)) {
          const d = moveDate(m.date, n, asAt);
          if (d) set(step, "milestone", m, { date: d });
        }
        for (const a of db.allocations.filter((x) => x.project === p.id)) {
          const m = moveSpan(a.from, a.to, n, asAt);
          if (m) set(step, "allocation", a, { from: m.start, to: m.end });
        }
        for (const b of (db.benefits ?? []).filter((x) => x.project === p.id && OPEN_BENEFIT(x))) {
          const d = moveDate(b.realiseOn, n, asAt);
          if (d) set(step, "benefit", b, { realiseOn: d });
        }
        break;
      }
      case "cancel": {
        cancelled.add(p.id);
        const spent = round6(sum((db.ledger ?? []).filter((l) => l.project === p.id), (l) => Number(l.amount)));
        if (round6(p.budget) !== spent) set(step, "project", p, { budget: spent });
        for (const a of [...db.allocations.filter((x) => x.project === p.id)]) {
          if (D(a.to) < D(asAt)) continue;                                   // finished
          if (D(a.from) >= D(asAt)) {                                        // not started: released
            step.mutations.push({ entity: "allocation", id: a.id, version: a.version ?? null,
              remove: true, before: { ...a } });
            db.allocations = db.allocations.filter((x) => x !== a);
          } else if (a.to !== asAt) {
            set(step, "allocation", a, { to: asAt });                        // running: ends today
          }
        }
        for (const b of (db.benefits ?? []).filter((x) => x.project === p.id && OPEN_BENEFIT(x))) {
          set(step, "benefit", b, { status: "Withdrawn" });
        }
        break;
      }
      case "budget": {
        const v = round6(c.amount);
        if (round6(p.budget) !== v) set(step, "project", p, { budget: v });
        break;
      }
      case "envelope": {
        const v = round6(c.amount);
        const was = round6(db.settings.capexEnvelope ?? 0);
        if (v !== was) {
          step.mutations.push({ entity: "setting", id: "capexEnvelope", version: null,
            set: { value: v }, before: { value: was } });
          db.settings.capexEnvelope = v;
        }
        break;
      }
      case "weight": {
        if (!weighting) { step.issue = "no-weighting"; break; }
        if (!INPUTS.includes(c.input)) { step.issue = "unknown-input"; break; }
        const w = Math.max(0, Math.min(100, Math.round(Number(c.weight))));
        if (Number(weighting[c.input]) !== w) {
          step.mutations.push({ entity: "weighting", id: "default", version: weighting.version ?? null,
            set: { [c.input]: w }, before: { [c.input]: weighting[c.input] } });
          weighting[c.input] = w;
        }
        break;
      }
      default:
        step.issue = "unknown-kind";
    }
  }
  return { db, weighting, cancelled, plan };
}

/* ═══════════════════════════════════════════════════════════════════
   POSITION — what a book says, in the numbers S2 compares
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @param db        a book
 * @param opts {
 *   weighting      the ranking weights
 *   demand         the open requests, in shared/prioritise.js's shape
 *   cancelled      ids stopped by the scenario (they leave the queue)
 *   horizonMonths  how far capacity and value are read (default 12)
 * }
 */
export function position(db, { weighting = null, demand = [], cancelled = new Set(), horizonMonths = HORIZON_MONTHS } = {}) {
  const asAt = db.statusDate;
  const open = db.projects.filter((p) => !p.closed);
  const going = open.filter((p) => !cancelled.has(p.id));
  const envelope = Number(db.settings?.capexEnvelope ?? 0);

  /* the money: the roll-up over what still runs, and the envelope line */
  const roll = Engine.roll(db, going);
  const queue = Engine.prioritise(db, going, envelope);
  const queueOf = new Map(queue.rows.map((r) => [r.project.id, r]));
  const money = Engine.moneyPosition(db, going);
  const sunk = sum(open.filter((p) => cancelled.has(p.id)), (p) =>
    sum((db.ledger ?? []).filter((l) => l.project === p.id), (l) => Number(l.amount)));

  /* the ranking (REQ-24) and the line where people or money run out */
  const ranking = prioritise({
    asAt, horizonDays: 180, weighting,
    ceiling: db.settings?.capacityCeiling, envelope,
    programmes: db.programmes, people: db.people,
    projects: db.projects.map((p) => (cancelled.has(p.id) ? { ...p, closed: true } : p)),
    cases: db.businessCases ?? [], raid: db.raid ?? [], allocations: db.allocations ?? [],
    demand,
  });
  const rankOf = new Map(ranking.ranked.filter((r) => r.kind === "project").map((r) => [r.id, r]));

  /* capacity by month: the engine's weekly load, folded into months */
  const weeks = Math.ceil((horizonMonths * 31) / 7) + 1;
  const cap = Engine.capacity(db, weeks, asAt);
  const ceiling = Number(db.settings?.capacityCeiling ?? 100);
  const pool = round6(sum(db.people ?? [], (p) => Engine.effectiveFte(p) * (ceiling / 100)));
  const first = monthKey(asAt);
  const lastMonth = monthKey(addMonths(D(first + "-01"), horizonMonths - 1));
  const months = new Map();
  cap.cols.forEach((w, i) => {
    const k = monthKey(w);
    if (k < first || k > lastMonth) return;
    if (!months.has(k)) months.set(k, { month: k, weeks: 0, load: 0, over: new Set() });
    const m = months.get(k);
    m.weeks += 1;
    for (const r of cap.rows) {
      const load = r.cells[i].load;
      m.load += load;
      if (load > ceiling) m.over.add(r.person.id);
    }
  });
  const capacity = [...months.values()].map((m) => ({
    month: m.month,
    demandFte: round6(m.load / 100 / Math.max(1, m.weeks)),
    poolFte: pool,
    overPeople: m.over.size,
  }));

  /* value: what the cases claim, and which benefits fall due when */
  const value = Engine.valueReport(db, going, asAt);
  const until = iso(addMonths(D(asAt), horizonMonths));
  const goingIds = new Set(going.map((p) => p.id));
  const openBenefits = (db.benefits ?? []).filter((b) => goingIds.has(b.project) && OPEN_BENEFIT(b));
  const dueIn = openBenefits.filter((b) => b.realiseOn && D(b.realiseOn) >= D(asAt) && D(b.realiseOn) <= D(until));

  const projects = open.map((p) => {
    const m = Engine.metrics(db, p.id);
    const q = queueOf.get(p.id);
    const r = rankOf.get(p.id);
    const mine = openBenefits.filter((b) => b.project === p.id && b.realiseOn);
    const next = mine.length ? mine.map((b) => b.realiseOn).sort()[0] : null;
    return {
      id: p.id, name: p.name, programme: p.programme, site: p.site,
      state: cancelled.has(p.id) ? "Cancelled" : "Live",
      start: p.start, finish: p.finish,
      forecastFinish: m ? m.forecastFinish : null,
      budget: p.budget, eac: m ? m.eac : null,
      rank: r ? r.rank : null, aboveLine: r ? r.funded : null,
      inEnvelope: q ? q.funded : null,
      nextBenefit: next,
      benefitsDue: dueIn.filter((b) => b.project === p.id).length,
    };
  });

  const finishes = projects.filter((p) => p.state === "Live").map((p) => p.finish).filter(Boolean).sort();
  return {
    asAt,
    projects,
    capacity,
    benefits: openBenefits.map((b) => ({ id: b.id, project: b.project, title: b.title, realiseOn: b.realiseOn ?? null })),
    totals: {
      projects: going.length,
      bac: roll.bac, eac: roll.eac, vac: roll.vac, spi: roll.spi, cpi: roll.cpi,
      sunk: round6(sunk),
      envelope: envelope || null,
      demanded: queue.demanded,
      headroom: envelope ? round6(envelope - queue.demanded) : null,
      inEnvelope: queue.funded, outsideEnvelope: queue.unfunded,
      committed: money.committed, free: money.free,
      aboveLine: ranking.cut.above, belowLine: ranking.cut.below, lineState: ranking.cut.state,
      expectedBenefit: value.totals.expectedBenefit,
      benefitsDue: dueIn.length,
      peakFte: capacity.length ? Math.max(...capacity.map((c) => c.demandFte)) : null,
      overMonths: capacity.filter((c) => c.demandFte > pool).length,
      overPeople: capacity.length ? Math.max(...capacity.map((c) => c.overPeople)) : 0,
      lastFinish: finishes.length ? finishes[finishes.length - 1] : null,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   COMPARE — live and scenario, side by side
   ═══════════════════════════════════════════════════════════════════ */

const diff = (a, b) => (a == null || b == null || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))
  ? null : round6(Number(b) - Number(a)));
const dayDiff = (a, b) => (a && b ? days(a, b) : null);

/**
 * @param book { db, weighting, demand }
 * @param changes the scenario's changes
 */
export function compareScenario(book, changes = []) {
  const demand = book.demand ?? [];
  const live = position(book.db, { weighting: book.weighting, demand });
  const s = applyScenario(book, changes);
  const scen = position(s.db, { weighting: s.weighting, demand, cancelled: s.cancelled });

  const byId = new Map(scen.projects.map((p) => [p.id, p]));
  const rows = live.projects.map((a) => {
    const b = byId.get(a.id) ?? a;
    const delta = {
      finishDays: dayDiff(a.finish, b.finish),
      forecastDays: dayDiff(a.forecastFinish, b.forecastFinish),
      budget: diff(a.budget, b.budget),
      eac: diff(a.eac, b.eac),
      rank: diff(a.rank, b.rank),
      aboveLine: a.aboveLine === b.aboveLine ? null : b.aboveLine,
      inEnvelope: a.inEnvelope === b.inEnvelope ? null : b.inEnvelope,
      benefitsDue: diff(a.benefitsDue, b.benefitsDue),
    };
    const changed = a.state !== b.state || Object.values(delta).some((v) => v !== null && v !== 0);
    return { id: a.id, name: a.name, programme: a.programme, live: a, scenario: b, delta, changed };
  });

  const totals = { live: live.totals, scenario: scen.totals, delta: {} };
  for (const k of Object.keys(live.totals)) {
    totals.delta[k] = k === "lastFinish"
      ? dayDiff(live.totals[k], scen.totals[k])
      : typeof live.totals[k] === "number" || typeof scen.totals[k] === "number"
        ? diff(live.totals[k], scen.totals[k]) : null;
  }

  const capOf = new Map(scen.capacity.map((c) => [c.month, c]));
  const capacity = live.capacity.map((c) => {
    const x = capOf.get(c.month) ?? c;
    return { month: c.month, pool: c.poolFte, live: c.demandFte, scenario: x.demandFte,
      delta: diff(c.demandFte, x.demandFte), liveOver: c.overPeople, scenarioOver: x.overPeople };
  });

  const benOf = new Map(scen.benefits.map((b) => [b.id, b]));
  const benefits = live.benefits
    .map((b) => ({ ...b, scenario: benOf.get(b.id)?.realiseOn ?? null, withdrawn: !benOf.has(b.id) }))
    .filter((b) => b.withdrawn || b.scenario !== b.realiseOn)
    .map((b) => ({ id: b.id, project: b.project, title: b.title, live: b.realiseOn,
      scenario: b.withdrawn ? null : b.scenario, withdrawn: b.withdrawn,
      days: b.withdrawn ? null : dayDiff(b.realiseOn, b.scenario) }));

  return {
    asAt: live.asAt,
    rows, totals, capacity, benefits,
    plan: s.plan.map((p) => ({ change: p.change.id ?? null, kind: p.change.kind,
      issue: p.issue, mutations: p.mutations })),
    changed: rows.filter((r) => r.changed).length,
  };
}

export default compareScenario;

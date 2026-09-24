/**
 * RESOURCES AND COSTS — docs/41 wave B: FX-08, FX-09, FX-10.
 *
 * Pure, like the engine: no database, no Express, no DOM. The server calls
 * it on the book it loaded, the browser on the book it holds, the tests on
 * a fixture. It READS `shared/engine.js` and never edits it: D-41.01 says
 * every existing number stays where it is, so everything here is a NEW
 * function returning NEW figures beside the old ones — `Engine.metrics`,
 * `Engine.roll`, `Engine.capacity` and `Engine.criticalPath` are called,
 * never changed.
 *
 * ── FX-08 · who is on what, and who is over ─────────────────────────
 *
 * Where `effectiveFte` was unwired. `Engine.effectiveFte` (V-09) has said
 * since 012 what a person is actually available for — the fraction of a
 * year left after rotation, leave and the day job. `Engine.capacity`
 * (engine.js, "capacity") never called it: it sums the raw `allocation.pct`
 * of each week and compares the total with one flat `capacityCeiling` for
 * everybody, so a fly-in engineer at 0.5 FTE booked at 100 % read as
 * exactly "at ceiling". Its only callers were the portfolio pool in
 * `shared/prioritise.js` and the "Effective capacity" tile of the
 * Resources screen — a number printed beside the heat map, never inside
 * it. `Engine.capacity` stays as it is (its numbers feed the existing
 * alert and its tests); `resourceLoad` below is the capacity that honours
 * effective availability AND the dated absences of 015, week by week.
 *
 * ── FX-09 · leveling proposes, a human applies (D-41.02) ─────────────
 *
 * `proposeLeveling` returns a list of moves and their effect on each
 * project's finish. It writes nothing — it cannot: it has no handle on
 * anything but the object it was given, and it copies what it shifts.
 *
 * ── FX-10 · rates, planned cost, the S-curve and three EACs ──────────
 *
 * MER-04 holds: no budget, no number. Every figure that needs a scale is
 * `null` without one, and says "nothing measured" rather than 0.
 */

import { Engine, D, iso, addDays, days, startOfWeek, monthKey, sum } from "./engine.js";

/* ── durations: ONE helper ───────────────────────────────────────────
   Calendar days, exactly as the CPM counts them today (engine.js
   criticalPath: `Math.max(1, days(a.start, a.end))`). When the working
   calendars of wave A1 (FX-02) land, this is the one place that learns
   about them: every duration, work and cost figure below reads it. */
export function workingDuration(start, end /* , calendar — FX-02 */) {
  return Math.max(1, days(start, end));
}
/** The days an activity occupies: [start, start + duration). */
const spanOf = (a) => ({ from: D(a.start), n: workingDuration(a.start, a.end) });
const overlap = (fromA, nA, fromB, nB) => {
  const a0 = D(fromA).getTime(), a1 = a0 + nA * 86400000;
  const b0 = D(fromB).getTime(), b1 = b0 + nB * 86400000;
  return Math.max(0, Math.round((Math.min(a1, b1) - Math.max(a0, b0)) / 86400000));
};

/** Work = duration × units, unless a work was typed, which then wins.
    `perDay` is the share of a person-day spent on each day of the span
    — an FTE. */
export function assignmentWork(asg, activity) {
  const duration = workingDuration(activity.start, activity.end);
  const units = Number(asg.units ?? 100);
  const computed = duration * units / 100;
  const overridden = asg.work !== null && asg.work !== undefined && asg.work !== "";
  const work = overridden ? Number(asg.work) : computed;
  return { duration, units, computed, work, overridden, perDay: work / duration };
}

/* ── FX-08 · availability, week by week ──────────────────────────────
   `availability` (012) is an annual average that ALREADY includes rotation
   and leave. A dated absence (015) says WHICH week that time falls in. So
   the week is capped at the share of it the person is present, rather
   than reduced a second time: 0.5 FTE on a full week on site is 0.5; on a
   week of rotation leave it is 0; a full-timer with two days' leave is
   5/7. Multiplying the two would count the same rotation twice — the
   double count `effectiveFte` itself refuses (V-09). */
export function weekAvailability(db, person, week) {
  const fte = Engine.effectiveFte(person);
  const w0 = D(week);
  const mine = (db.absences ?? []).filter((a) => a.person === person.id);
  let absent = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(w0, i);
    if (mine.some((a) => D(a.from) <= d && d <= D(a.to ?? a.from))) absent++;
  }
  const present = (7 - absent) / 7;
  return { fte, absentDays: absent, present, available: Math.min(fte, present) };
}

const EPS = 1e-9;

/**
 * Weekly load per person, across every project the book holds.
 *
 * Demand in a week = each assignment's FTE × the share of the week its
 * activity occupies, plus — for a project on which the person has NO
 * assignment yet — the project allocation's percentage, active in that
 * week by the rule `Engine.capacity` uses. An assignment refines an
 * allocation on the same project; it is never counted on top of it.
 *
 * Over-allocated = demand above 100 % of the week's effective
 * availability. A person absent all week with work booked is over, with
 * no ratio (there is nothing to divide by).
 */
export function resourceLoad(db, { weeks = 10, from } = {}) {
  const start = startOfWeek(from || db.statusDate);
  const cols = Array.from({ length: weeks }, (_, i) => iso(addDays(start, i * 7)));
  const acts = new Map((db.activities ?? []).map((a) => [a.id, a]));
  const asgs = (db.assignments ?? []).filter((x) => acts.has(x.activity));

  const rows = (db.people ?? []).map((person) => {
    const mine = asgs.filter((x) => x.person === person.id).map((x) => {
      const a = acts.get(x.activity);
      return { asg: x, activity: a, ...assignmentWork(x, a), span: spanOf(a) };
    });
    const assigned = new Set(mine.map((m) => m.activity.project));
    const allocs = (db.allocations ?? []).filter((a) => a.person === person.id && !assigned.has(a.project));

    const cells = cols.map((week) => {
      const wEnd = addDays(week, 7);
      const sources = [];
      for (const m of mine) {
        const n = overlap(m.span.from, m.span.n, week, 7);
        if (!n) continue;
        sources.push({ kind: "assignment", id: m.asg.id, activity: m.activity.id,
          project: m.activity.project, units: m.units, fte: m.perDay * n / 7 });
      }
      for (const a of allocs) {
        if (!(D(a.from) < wEnd && D(a.to) >= D(week))) continue;
        sources.push({ kind: "allocation", id: a.id, project: a.project, units: a.pct, fte: a.pct / 100 });
      }
      const demand = sum(sources, (s) => s.fte);
      const av = weekAvailability(db, person, week);
      const ratio = av.available > EPS ? demand / av.available : null;
      const over = demand > EPS && demand > av.available + EPS;
      return { week, demand, available: av.available, fte: av.fte, absentDays: av.absentDays,
               ratio, over, sources };
    });
    const ratios = cells.map((c) => c.ratio).filter((r) => r !== null);
    return { person, fte: Engine.effectiveFte(person), cells,
             peak: ratios.length ? Math.max(...ratios) : null,
             overWeeks: cells.filter((c) => c.over).length };
  });

  /* A role assignment has no person to load: it is demand nobody has been
     named for yet, shown as such. */
  const roleDemand = new Map();
  for (const x of asgs.filter((y) => !y.person && y.role)) {
    const a = acts.get(x.activity);
    const w = assignmentWork(x, a), s = spanOf(a);
    if (!roleDemand.has(x.role)) roleDemand.set(x.role, cols.map((week) => ({ week, demand: 0 })));
    roleDemand.get(x.role).forEach((c) => { c.demand += w.perDay * overlap(s.from, s.n, c.week, 7) / 7; });
  }
  const roles = [...roleDemand.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([role, cells]) => ({ role, cells }));

  return { cols, rows, roles };
}

/** Every (person, week) above 100 % of effective availability. */
export function overallocations(db, opts) {
  const load = resourceLoad(db, opts);
  const out = [];
  for (const r of load.rows) {
    for (const c of r.cells) {
      if (c.over) out.push({ person: r.person, week: c.week, demand: c.demand,
        available: c.available, ratio: c.ratio, sources: c.sources });
    }
  }
  return out;
}

/**
 * The signal, in the shape the attention lists already read
 * (`Engine.decisions`): kind, title, meta, route. Null when nobody is
 * over — an empty list is not a signal. The English here is a key for
 * `t()` at the call site, like every label of `shared/govsignals.js`.
 */
export function overallocationSignal(db, projects, opts) {
  const ids = projects ? new Set(projects.map((p) => p.id)) : null;
  const hits = overallocations(db, opts).filter((o) =>
    !ids || o.sources.some((s) => ids.has(s.project)));
  if (!hits.length) return null;
  const people = [...new Map(hits.map((o) => [o.person.id, o.person])).values()];
  return {
    kind: "Over-allocation", count: people.length, weeks: hits.length,
    people: people.map((p) => p.name), urgent: false,
    route: "#/resources", entity: "resource", entityId: "",
  };
}

/* ── FX-10 · rates ───────────────────────────────────────────────────
   Person first, then role, then the directory's `day_rate` — the rule
   that existed before the rate table, which the table EXTENDS rather than
   replaces. Effective dates are inclusive; the latest start wins. The
   directory rate is in the reporting currency. */
const effective = (r, d) => D(r.from) <= d && (!r.to || d <= D(r.to));
export function rateFor(db, { person, role }, date) {
  const d = D(date);
  const pick = (rows) => rows.filter((r) => effective(r, d))
    .sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : String(a.id).localeCompare(String(b.id))))[0];
  const rates = db.rates ?? [];
  const p = person ? (db.people ?? []).find((x) => x.id === person) : null;
  const own = person ? pick(rates.filter((r) => r.person === person)) : null;
  if (own) return { dayRate: Number(own.dayRate), currency: own.currency, fx: Number(own.fx ?? 1), source: "person", id: own.id };
  const roleName = role || p?.role || "";
  const byRole = roleName ? pick(rates.filter((r) => !r.person && r.role === roleName)) : null;
  if (byRole) return { dayRate: Number(byRole.dayRate), currency: byRole.currency, fx: Number(byRole.fx ?? 1), source: "role", id: byRole.id };
  if (p && Number(p.rate) > 0) return { dayRate: Number(p.rate), currency: null, fx: 1, source: "directory", id: null };
  return null;
}

const M = 1_000_000;

/**
 * Planned cost of one activity from its assignments × rates, in millions
 * (the unit every money figure of the book is in). Walked day by day, so a
 * rate that changes mid-activity is honoured. `complete` is false when an
 * assignment found no rate on some day: that day is uncosted, and a total
 * missing part of its input says so rather than passing for the whole.
 */
export function plannedCost(db, activity) {
  const lines = (db.assignments ?? []).filter((x) => x.activity === activity.id).map((x) => {
    const w = assignmentWork(x, activity);
    let cost = 0, uncostedDays = 0;
    const byMonth = {};
    for (let i = 0; i < w.duration; i++) {
      const d = addDays(activity.start, i);
      const r = rateFor(db, { person: x.person, role: x.role }, d);
      if (!r) { uncostedDays++; continue; }
      const c = w.perDay * r.dayRate * r.fx / M;
      cost += c;
      const k = monthKey(d);
      byMonth[k] = (byMonth[k] ?? 0) + c;
    }
    return { assignment: x, work: w.work, cost, uncostedDays, byMonth };
  });
  return {
    activity: activity.id, cost: sum(lines, (l) => l.cost), lines, assigned: lines.length > 0,
    complete: lines.length > 0 && lines.every((l) => l.uncostedDays === 0),
  };
}

const NOTHING = "Nothing measured — no budget, so there is no scale to measure against";

/**
 * The S-curve of one project by month: BCWS (planned value), BCWP
 * (earned value) and ACWP (actual cost from the cost lines), cumulative —
 * read from `Engine.curve`, the portfolio's own monthly curve, so the two
 * cannot disagree — plus the planned cost from assignments × rates,
 * cumulative. No budget: no curve (MER-04).
 */
export function costCurve(db, projectId) {
  const p = Engine.project(db, projectId);
  if (!p) return null;
  if (!(p.budget > 0)) return { measured: false, why: NOTHING, months: [] };
  const plan = {};
  for (const a of Engine.activities(db, projectId)) {
    for (const l of plannedCost(db, a).lines) {
      for (const [k, v] of Object.entries(l.byMonth)) plan[k] = (plan[k] ?? 0) + v;
    }
  }
  const anyPlan = Object.keys(plan).length > 0;
  let run = 0;
  const keys = Object.keys(plan).sort();
  const months = Engine.curve(db, [p]).map((m) => {
    run = sum(keys.filter((k) => k <= m.period), (k) => plan[k]);
    return { period: m.period, bcws: m.pv, bcwp: m.ev, acwp: m.ac, planned: anyPlan ? run : null };
  });
  return { measured: true, why: "", months };
}

/**
 * Estimate at completion, three ways, each named — and the TCPI.
 *
 *   EAC (CPI)        BAC / CPI
 *   EAC (CPI × SPI)  AC + (BAC − EV) / (CPI × SPI)
 *   EAC (bottom-up)  AC + ETC, ETC = Σ planned cost × (1 − % complete)
 *                    over the project's costed assignments
 *   TCPI             (BAC − EV) / (BAC − AC)
 *
 * Read from `Engine.metrics` — its BAC, PV, EV, AC, SPI and CPI — so the
 * figures here and the ones the screens already show are the same
 * figures. `Engine.metrics(...).eac` is untouched (it is BAC/CPI with a
 * fall back to BAC); these are new fields beside it. A method that cannot
 * be computed is null WITH its reason.
 */
export function forecasts(db, projectId) {
  const m = Engine.metrics(db, projectId);
  if (!m) return null;
  const methods = (values, whys) => METHODS.map(([key, label], i) =>
    ({ key, label, value: values[i], why: values[i] === null ? whys[i] : "" }));
  if (!(m.bac > 0)) {
    return {
      measured: false, why: NOTHING, bac: null, pv: null, ev: null, ac: null, cpi: null, spi: null,
      etc: null, plannedCost: null, tcpi: null, tcpiEac: null, gap: null,
      methods: methods([null, null, null], [NOTHING, NOTHING, NOTHING]),
    };
  }
  const { bac, pv, ev, ac, cpi, spi } = m;
  const early = "Too early to measure — less than 2% of the plan has been spent";
  const eacCpi = cpi !== null && cpi > 0.01 ? bac / cpi : null;
  const eacCpiSpi = cpi !== null && spi !== null && cpi * spi > 0.0001 ? ac + (bac - ev) / (cpi * spi) : null;

  /* Bottom-up needs the WHOLE remaining plan costed: an ETC summed over
     the one activity somebody happened to assign would read as the cost
     of finishing the project, and it is not. Every activity with work
     left must carry an assignment, and every assignment a rate. */
  const all = Engine.activities(db, projectId).map((a) => ({ a, pc: plannedCost(db, a) }));
  const costs = all.filter((c) => c.pc.assigned);
  const gap = !costs.length ? "none"
    : all.some((c) => c.a.pct < 100 && !c.pc.assigned) ? "partial"
    : costs.every((c) => c.pc.complete) ? "" : "rate";
  const planned = costs.length ? sum(costs, (c) => c.pc.cost) : null;
  const etc = gap ? null : sum(costs, (c) => c.pc.cost * (1 - c.a.pct / 100));

  const tcpi = bac - ac > 0.0001 ? (bac - ev) / (bac - ac) : null;
  const tcpiEac = eacCpi !== null && eacCpi - ac > 0.0001 ? (bac - ev) / (eacCpi - ac) : null;
  return {
    measured: m.measurable, why: m.measurable ? "" : early,
    bac, pv, ev, ac, cpi, spi, etc, plannedCost: planned, tcpi, tcpiEac, gap,
    methods: methods([eacCpi, eacCpiSpi, etc !== null ? ac + etc : null],
      [early, early, BOTTOM_UP_GAP[gap] ?? ""]),
  };
}
const BOTTOM_UP_GAP = {
  none: "No costed assignment on this project",
  partial: "An activity with work left has no assignment",
  rate: "An assignment has no rate on some days",
};
const METHODS = [
  ["cpi", "EAC = BAC / CPI"],
  ["cpiSpi", "EAC = AC + (BAC − EV) / (CPI × SPI)"],
  ["bottomUp", "EAC = AC + ETC (bottom-up)"],
];

/* ── FX-09 · the leveler ─────────────────────────────────────────────
   Proposed, never imposed (D-41.02).

   The order a planner would take:
     1. inside total float — a move that costs no project its finish;
     2. then by delaying the LOWER-priority activity: priority is the
        project's rank where one is set (1 is first), then total float (the
        more float, the lower the priority), then the identifier, so two
        runs on the same book propose the same moves.

   Only an activity that may move is moved: `movable(activity)` is the
   caller's authority (the route passes rbac's `schedule.level`), and on
   top of it the rules the screens already follow — not synchronised from
   the SDP roadmap, and not started (0 % — a stage with progress has
   begun, and moving its start would rewrite what happened). A successor that has to follow (finish-to-start, the only link
   type the engine knows) must be movable too, or the move is not made.

   Returns the moves, their effect on each project's finish, and the
   conflicts it could not resolve — with the reason. */
export function proposeLeveling(db, { weeks = 12, from, movable = () => true, maxShiftDays = 182, maxMoves = 200 } = {}) {
  const original = new Map((db.activities ?? []).map((a) => [a.id, a]));
  const acts = new Map([...original].map(([id, a]) => [id, { ...a }]));
  const work = { ...db, activities: [...acts.values()] };
  const opts = { weeks, from };

  const floatOf = {};
  for (const pid of new Set([...original.values()].map((a) => a.project))) {
    Object.assign(floatOf, Engine.criticalPath(db, pid).float);
  }
  const rankOf = (pid) => {
    const r = Engine.project(db, pid)?.rank;
    return r === null || r === undefined ? Infinity : Number(r);
  };
  const may = (a) => a && a.origin !== "sdp" && Number(a.pct) === 0 && movable(original.get(a.id));
  const successors = (id) => [...acts.values()].filter((x) => (x.deps ?? []).includes(id));
  const shifted = (id) => days(original.get(id).start, acts.get(id).start);

  /* The plan of a shift: the activity by k days, and each finish-to-start
     successor by what the gap before it cannot absorb. Null when some
     activity it would have to move may not move. */
  const planShift = (id, k, plan = new Map()) => {
    const a = acts.get(id);
    if (!may(a)) return null;
    if (k <= (plan.get(id) ?? 0)) return plan;   // reached twice (a diamond): the larger push holds
    plan.set(id, k);
    for (const s of successors(id)) {
      const gap = Math.max(0, days(a.end, s.start));
      const push = k - gap;
      if (push > 0 && !planShift(s.id, push, plan)) return null;
    }
    return plan;
  };
  const apply = (plan, sign = 1) => {
    for (const [id, k] of plan) {
      const a = acts.get(id);
      a.start = iso(addDays(a.start, sign * k));
      a.end = iso(addDays(a.end, sign * k));
    }
  };
  /* A move is judged by EXCESS — the FTE above what each person is
     available for, summed over the weeks and over everybody who works on
     what the move shifts, so relieving one person by overloading another
     is not a resolution — and over the horizon AND
     as far as a move and the longest activity may reach, so pushing work
     past the edge of the screen never counts as resolving it. Excess, not
     a count of weeks: moving one of three stacked activities out of a week
     helps even when the week stays over. */
  const longest = Math.max(0, ...[...original.values()].map((a) => workingDuration(a.start, a.end)));
  const reach = { weeks: weeks + Math.ceil((maxShiftDays + longest) / 7) + 1, from };
  const excess = (pids) => sum(
    resourceLoad({ ...work, people: (work.people ?? []).filter((p) => pids.has(p.id)) }, reach).rows,
    (r) => sum(r.cells, (c) => (c.over ? c.demand - c.available : 0)));
  const workers = (ids) => new Set((work.assignments ?? [])
    .filter((x) => x.person && ids.includes(x.activity)).map((x) => x.person));

  const reasons = new Map();
  const unresolved = [];
  const skip = new Set();
  const before = overallocations(work, opts).length;
  let moves = 0;

  while (moves < maxMoves) {
    const conflict = overallocations(work, opts).find((o) => !skip.has(o.person.id + "|" + o.week));
    if (!conflict) break;
    const key = conflict.person.id + "|" + conflict.week;
    const cands = [...new Set(conflict.sources.filter((s) => s.kind === "assignment").map((s) => s.activity))]
      .map((id) => acts.get(id)).filter(may)
      .sort((a, b) => (rankOf(b.project) - rankOf(a.project)) ||
        ((floatOf[b.id] ?? 0) - (floatOf[a.id] ?? 0)) || String(a.id).localeCompare(String(b.id)));
    if (!cands.length) {
      unresolved.push({ person: conflict.person.id, week: conflict.week, ratio: conflict.ratio,
        why: "Nothing this week may move: started, synchronised or outside your authority" });
      skip.add(key);
      continue;
    }
    let done = null;
    for (const phase of ["float", "delay"]) {
      for (const a of cands) {
        const left = phase === "float" ? (floatOf[a.id] ?? 0) - shifted(a.id) : maxShiftDays - shifted(a.id);
        const clear = Math.max(1, days(a.start, addDays(conflict.week, 7)));
        for (let k = clear; k <= left; k += 7) {
          const plan = planShift(a.id, k);
          if (!plan) break;
          const pids = workers([...plan.keys()]);
          pids.add(conflict.person.id);
          const was = excess(pids);
          apply(plan);
          if (excess(pids) < was - EPS) { done = { a, plan, phase, k }; break; }
          apply(plan, -1);
        }
        if (done) break;
      }
      if (done) break;
    }
    if (!done) {
      unresolved.push({ person: conflict.person.id, week: conflict.week, ratio: conflict.ratio,
        why: "No move within " + maxShiftDays + " days helps" });
      skip.add(key);
      continue;
    }
    moves++;
    for (const [id] of done.plan) {
      if (id === done.a.id) {
        const p = Engine.project(db, done.a.project);
        reasons.set(id, done.phase === "float"
          ? { kind: "float", why: "Within total float (" + (floatOf[id] ?? 0) + " d)" }
          : { kind: "delay", why: "Delayed: lower priority (rank " + (p?.rank ?? "none") + ", float " + (floatOf[id] ?? 0) + " d)" });
      } else if (!reasons.has(id)) {
        reasons.set(id, { kind: "pushed", why: "Pushed by its predecessor " + done.a.id });
      }
    }
  }

  const list = [...acts.values()].filter((a) => a.start !== original.get(a.id).start).map((a) => {
    const o = original.get(a.id);
    const r = reasons.get(a.id) ?? { kind: "pushed", why: "Pushed by a predecessor" };
    return { activity: a.id, project: a.project, name: a.name,
      from: { start: o.start, end: o.end }, to: { start: a.start, end: a.end },
      shiftDays: days(o.start, a.start), kind: r.kind, reason: r.why, version: o.version };
  }).sort((x, y) => x.project.localeCompare(y.project) || x.from.start.localeCompare(y.from.start) || x.activity.localeCompare(y.activity));

  const touched = [...new Set(list.map((m) => m.project))].sort();
  const finishOf = (arr, pid) => arr.filter((a) => a.project === pid).map((a) => a.end).sort().pop() ?? null;
  const effects = touched.map((pid) => {
    const b = finishOf([...original.values()], pid), a = finishOf([...acts.values()], pid);
    return { project: pid, name: Engine.project(db, pid)?.name ?? pid,
      finishBefore: b, finishAfter: a, slipDays: b && a ? days(b, a) : 0 };
  });
  return { moves: list, effects, unresolved, before, after: overallocations(work, opts).length };
}

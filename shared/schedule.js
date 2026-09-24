/**
 * SCHEDULE — the pure critical-path scheduler (docs/41 FX-01…FX-04).
 *
 * No database, no DOM, no import: the server, the browser, the tests and
 * the Monte Carlo line (FX-11) call the same function with the same
 * arguments and get the same numbers.
 *
 * ── Signature ────────────────────────────────────────────────────────
 *
 *   schedule(acts, { calendar, statusDate } = {}) → {
 *     es, ef, ls, lf,   { [id]: index }   early/late start and finish
 *     float,            { [id]: index }   total float  (ls − es)
 *     freeFloat,        { [id]: index }   free float   (never above total float, never below 0)
 *     critical,         Set<id>           float ≤ 0, not complete
 *     negative,         [id]              float < 0, not complete (a constraint or deadline is violated)
 *     missed,           [id]              early finish past the deadline
 *     late,             [id]              behind the status date (should have started / finished)
 *     projEnd,          index             the latest early finish
 *     origin,           ISO date | null   index 0 (the earliest planned start)
 *     dates,            { [id]: { es, ef, ls, lf } }   the four indices as ISO dates
 *     calendar,         the calendar used, or null
 *   }
 *
 *   acts        [{ id, start, end,                 ISO dates (end − start = duration)
 *                  deps?: [id],                     predecessors (the 5.28.0 field)
 *                  links?: [{ pred, type, lag }],   type FS|SS|FF|SF, lag in days (negative = lead)
 *                  constraint?: { type, date } | null,  SNET|SNLT|FNET|FNLT|MSO|MFO (ASAP = null)
 *                  deadline?: ISO | null,
 *                  actualStart?, actualFinish?: ISO | null,
 *                  remaining?: days | null,         counted from the status date
 *                  pct?: 0…100,
 *                  duration?: days }]               overrides end − start (Monte Carlo samples)
 *   calendar    { workdays: bitmask (bit 0 = Sunday … bit 6 = Saturday), holidays: [ISO | { date }] }
 *               or null: every day counts, exactly as 5.28.0 did.
 *   statusDate  ISO or null. With it: unstarted work cannot start before it, `remaining` counts
 *               from it, and `late` is measured against it. Without it: nothing of the sort.
 *
 * Indices are days from `origin` — calendar days without a calendar,
 * working days with one. Durations and lags are counted in the same unit.
 *
 * ── D-41.01 ──────────────────────────────────────────────────────────
 *
 * Every link FS with lag 0, no calendar, no constraint, no deadline, no
 * actual and no status date is the 5.28.0 algorithm to the day: the same
 * topological order, the same "an activity with predecessors starts when
 * the last of them finishes, one without starts on its own date", the
 * same backward pass. server/test/schedule-engine.test.js holds the whole
 * demonstration book against a frozen copy of the 5.28.0 engine.
 *
 * A constraint never rewrites a date anyone typed. It bounds the early or
 * the late pass, and a violation shows as negative float.
 */

const DAY = 86400000;
/* The 5.28.0 `D()` parse, to the letter: an ISO day is UTC midnight. */
const T = (v) => (v instanceof Date ? v.getTime()
  : new Date(v + (String(v).length === 10 ? "T00:00:00Z" : "")).getTime());
const MID = (t) => Math.floor(t / DAY) * DAY;
const ISO = (t) => new Date(t).toISOString().slice(0, 10);

export const LINK_TYPES = ["FS", "SS", "FF", "SF"];
export const CONSTRAINT_TYPES = ["ASAP", "SNET", "SNLT", "FNET", "FNLT", "MSO", "MFO"];
/** Monday to Friday. Bit 0 is Sunday, as `Date#getUTCDay` counts. */
export const WEEKDAYS_MON_FRI = 62;

/** The dependency list of an activity, typed: `links` where they say so, FS/0 for the rest. */
export function linksOf(a) {
  const deps = a.deps ?? [];
  const typed = new Map((a.links ?? []).map((l) => [l.pred, l]));
  return deps.map((pred) => {
    const l = typed.get(pred);
    return { pred, type: LINK_TYPES.includes(l?.type) ? l.type : "FS", lag: Number(l?.lag) || 0 };
  });
}

/**
 * A clock over a calendar: date ↔ index, from `origin`.
 * Without a calendar it is plain calendar-day arithmetic.
 */
export function clock(origin, calendar) {
  if (!calendar) {
    /* 5.28.0: `Math.round((t − origin) / DAY)` and `days(a, b)`, unchanged */
    const o = typeof origin === "number" ? origin : T(origin);
    const idx = (d) => Math.round((T(d) - o) / DAY);
    const at = (n) => ISO(o + n * DAY);
    return { idx, startOf: at, finishOf: at, span: (a, b) => Math.round((T(b) - T(a)) / DAY) };
  }
  const o = MID(typeof origin === "number" ? origin : T(origin));
  const mask = Number(calendar.workdays) & 127;
  if (!mask) throw new Error("A working calendar needs at least one working weekday");
  const works = (t) => (mask >> new Date(t).getUTCDay()) & 1;
  const perWeek = [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + ((mask >> d) & 1), 0);
  const hol = [...new Set((calendar.holidays ?? []).map((h) => T(typeof h === "string" ? h : h.date)))]
    .filter(works).sort((a, b) => a - b);
  const below = (t) => { let lo = 0, hi = hol.length; while (lo < hi) { const m = (lo + hi) >> 1; if (hol[m] < t) lo = m + 1; else hi = m; } return lo; };
  /* working days in [a, b), a ≤ b, in O(1) plus two binary searches */
  const count = (a, b) => {
    const n = Math.round((b - a) / DAY), full = Math.floor(n / 7);
    let c = full * perWeek;
    const wd0 = new Date(a + full * 7 * DAY).getUTCDay();
    for (let r = 0; r < n % 7; r++) c += (mask >> ((wd0 + r) % 7)) & 1;
    return c - (below(b) - below(a));
  };
  const idxT = (t0) => { const t = MID(t0); return t >= o ? count(o, t) : 0 - count(t, o); };
  /* smallest day whose index reaches k (idxT is non-decreasing) */
  const reach = (k) => {
    const pad = Math.ceil((Math.abs(k) + 1) * 7 / perWeek) + hol.length + 14;
    let lo = -pad, hi = pad;
    while (lo < hi) { const m = Math.floor((lo + hi) / 2); if (idxT(o + m * DAY) >= k) hi = m; else lo = m + 1; }
    return o + lo * DAY;
  };
  return {
    idx: (d) => idxT(T(d)),
    /* the working day that carries index n */
    startOf: (n) => ISO(reach(n + 1) - DAY),
    /* the day after the last working day before index n */
    finishOf: (n) => ISO(reach(n)),
    span: (a, b) => idxT(T(b)) - idxT(T(a)),
  };
}

/** Topological order, predecessors first — the 5.28.0 walk, kept to the letter. */
export function topo(acts) {
  const byId = Object.fromEntries(acts.map(a => [a.id, a]));
  const seen = new Set(), out = [];
  const visit = (a) => {
    if (!a || seen.has(a.id)) return;
    seen.add(a.id);
    (a.deps ?? []).forEach(d => visit(byId[d]));
    out.push(a);
  };
  acts.forEach(visit);
  return out;
}

export function schedule(acts, { calendar = null, statusDate = null } = {}) {
  const byId = Object.fromEntries(acts.map(a => [a.id, a]));
  const es = {}, ef = {}, ls = {}, lf = {};
  const empty = { es, ef, ls, lf, float: {}, freeFloat: {}, critical: new Set(), negative: [], missed: [],
    late: [], projEnd: 0, origin: null, dates: {}, calendar: calendar ?? null };
  if (!acts.length) return empty;

  const originT = Math.min(...acts.map(a => T(a.start)));
  const origin = ISO(originT);
  const c = clock(originT, calendar);
  const sd = statusDate ? c.idx(statusDate) : null;
  const dur = (a) => Number.isFinite(a.duration) ? Math.max(0, Math.round(a.duration))
    : Math.max(1, c.span(a.start, a.end));
  const cType = (a) => (a.constraint && CONSTRAINT_TYPES.includes(a.constraint.type) && a.constraint.type !== "ASAP" && a.constraint.date)
    ? a.constraint.type : null;
  const cIdx = (a) => c.idx(a.constraint.date);
  const actualStartOf = (a) => a.actualStart ?? (a.actualFinish ? a.start : null);
  const complete = (a) => !!a.actualFinish;
  const started = (a) => !!actualStartOf(a) || Number(a.pct) > 0;
  const links = Object.fromEntries(acts.map(a => [a.id, linksOf(a).filter(l => byId[l.pred])]));
  const succs = Object.fromEntries(acts.map(a => [a.id, []]));
  acts.forEach(a => links[a.id].forEach(l => succs[l.pred].push({ succ: a.id, type: l.type, lag: l.lag })));

  /* ── forward pass ─────────────────────────────────────────────── */
  const order = topo(acts);
  order.forEach(a => {
    const d = dur(a);
    const as = actualStartOf(a);
    if (as) {
      es[a.id] = c.idx(as);
      if (complete(a)) ef[a.id] = Math.max(es[a.id], c.idx(a.actualFinish));
      else if (a.remaining != null && sd != null) ef[a.id] = Math.max(es[a.id], sd) + Math.max(0, Number(a.remaining));
      else ef[a.id] = es[a.id] + d;
      return;
    }
    const ps = links[a.id];
    let s = ps.length ? Math.max(...ps.map(l => {
      switch (l.type) {
        case "SS": return es[l.pred] + l.lag;
        case "FF": return ef[l.pred] + l.lag - d;
        case "SF": return es[l.pred] + l.lag - d;
        default:   return ef[l.pred] + l.lag;
      }
    })) : c.idx(a.start);
    const ct = cType(a);
    if (ct === "SNET") s = Math.max(s, cIdx(a));
    else if (ct === "FNET") s = Math.max(s, cIdx(a) - d);
    else if (ct === "MSO") s = cIdx(a);
    else if (ct === "MFO") s = cIdx(a) - d;
    /* Unstarted work does not start in the past of the status date — unless a mandatory date holds it. */
    if (sd != null && !started(a) && ct !== "MSO" && ct !== "MFO") s = Math.max(s, sd);
    es[a.id] = s;
    ef[a.id] = s + (started(a) && a.remaining != null && sd != null
      ? Math.max(0, Math.max(s, sd) - s + Number(a.remaining)) : d);
  });
  const projEnd = Math.max(...acts.map(a => ef[a.id]));

  /* ── backward pass ────────────────────────────────────────────── */
  [...order].reverse().forEach(a => {
    const span = ef[a.id] - es[a.id];
    if (complete(a)) { ls[a.id] = es[a.id]; lf[a.id] = ef[a.id]; return; }
    const ss = succs[a.id];
    let f = ss.length ? Math.min(...ss.map(x => {
      switch (x.type) {
        case "SS": return ls[x.succ] - x.lag + span;
        case "FF": return lf[x.succ] - x.lag;
        case "SF": return lf[x.succ] - x.lag + span;
        default:   return ls[x.succ] - x.lag;
      }
    })) : projEnd;
    /* An SS or SF predecessor can finish after its successor, so it is
       bounded by the project end as well. With FS/0 links the successor
       bound is already ≤ projEnd and this changes nothing (D-41.01). */
    f = Math.min(f, projEnd);
    const ct = cType(a);
    if (ct === "SNLT" || ct === "MSO") f = Math.min(f, cIdx(a) + span);
    else if (ct === "FNLT" || ct === "MFO") f = Math.min(f, cIdx(a));
    if (a.deadline) f = Math.min(f, c.idx(a.deadline));
    lf[a.id] = f;
    ls[a.id] = f - span;
  });

  const float = {}, freeFloat = {};
  acts.forEach(a => { float[a.id] = ls[a.id] - es[a.id]; });
  acts.forEach(a => {
    const ss = succs[a.id];
    const room = ss.length ? Math.min(...ss.map(x => {
      switch (x.type) {
        case "SS": return es[x.succ] - x.lag - es[a.id];
        case "FF": return ef[x.succ] - x.lag - ef[a.id];
        case "SF": return ef[x.succ] - x.lag - es[a.id];
        default:   return es[x.succ] - x.lag - ef[a.id];
      }
    })) : projEnd - ef[a.id];
    freeFloat[a.id] = complete(a) ? 0 : Math.max(0, Math.min(room, float[a.id]));
  });

  const open = acts.filter(a => !complete(a));
  const dates = {};
  acts.forEach(a => {
    dates[a.id] = { es: c.startOf(es[a.id]), ef: c.finishOf(ef[a.id]), ls: c.startOf(ls[a.id]), lf: c.finishOf(lf[a.id]) };
  });
  return {
    es, ef, ls, lf, float, freeFloat,
    critical: new Set(open.filter(a => float[a.id] <= 0).map(a => a.id)),
    negative: open.filter(a => float[a.id] < 0).map(a => a.id),
    missed: open.concat(acts.filter(complete)).filter(a => a.deadline && ef[a.id] > c.idx(a.deadline)).map(a => a.id),
    /* late: should have started, or should have finished, by the status
       date — a stage reported at 100 % is done even without an actual finish */
    late: statusDate ? open.filter(a => !(Number(a.pct) >= 100) &&
      ((!started(a) && T(a.start) < T(statusDate)) || T(a.end) < T(statusDate))).map(a => a.id) : [],
    projEnd, origin, dates, calendar: calendar ?? null,
  };
}

/** Working days in [a, b) under a calendar — calendar days without one. */
export function workdaysBetween(a, b, calendar) {
  return clock(T(a), calendar).span(a, b);
}

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
 * ── FX-15 · several calendars in one run (a programme) ───────────────
 *
 *   schedule(acts, { calendars, statusDates })
 *
 *   calendars   { [id]: calendar | null } — each activity on its own
 *               calendar (its project's). When given, `calendar` is not read.
 *   statusDates { [id]: ISO | null } — each activity's status date (its
 *               project's); an id not named reads `statusDate`.
 *
 * The same two passes, not a copy of them. Each activity's es/ef/ls/lf,
 * float and free float are in ITS OWN working days (from the shared
 * `origin`); a link is read across by date — the predecessor's finish (or
 * start) is a day, and the successor counts from the next of its own
 * working days, its lag in its own working days. `projEnd` is then the
 * calendar-day index of the latest finish, and `dates` gives every index
 * as an ISO date. With every activity on one calendar the numbers are
 * those of `{ calendar }` (a test says so).
 *
 *   driving     { [id]: [pred id] } — the links that set each start (with
 *               or without `calendars`), for walking a critical chain back.
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

export function schedule(acts, { calendar = null, statusDate = null, calendars = null, statusDates = null } = {}) {
  const byId = Object.fromEntries(acts.map(a => [a.id, a]));
  const es = {}, ef = {}, ls = {}, lf = {};
  const empty = { es, ef, ls, lf, float: {}, freeFloat: {}, critical: new Set(), negative: [], missed: [],
    late: [], projEnd: 0, origin: null, dates: {}, calendar: calendar ?? null, driving: {} };
  if (!acts.length) return empty;

  const originT = Math.min(...acts.map(a => T(a.start)));
  const origin = ISO(originT);
  const c = clock(originT, calendar);
  /* FX-15 — one clock per activity when `calendars` is given (a programme:
     each project on its own calendar). Without it every activity reads the
     one clock `c` and every conversion below is the identity, so the
     passes compute exactly what they computed before (D-41.01). */
  const multi = !!calendars;
  const clocks = new Map();
  const ck = !multi ? () => c : (a) => {
    const cal = calendars[a.id] ?? null;
    if (!clocks.has(cal)) clocks.set(cal, clock(originT, cal));
    return clocks.get(cal);
  };
  /* The shared axis of a multi-calendar run is the calendar day from `origin`.
     W: a calendar-day index → a's working index (the next working day at or after it);
     S: a's working index → the calendar day that carries it (a start);
     F: a's working index → the day after the last working day before it (a finish). */
  const cd = (d) => Math.round((T(d) - originT) / DAY);
  const W = (a, i) => ck(a).idx(ISO(originT + i * DAY));
  const S = (a, k) => cd(ck(a).startOf(k));
  const F = (a, k) => cd(ck(a).finishOf(k));
  /* A bound stated in x's working days, read in a's: the latest day on
     which x still reads k, counted in a's working days. */
  const across = multi ? (a, x, k) => W(a, S(x, k)) : (a, x, k) => k;
  /* where a predecessor starts and finishes, in a's working days */
  const gF = (p) => (ef[p.id] === es[p.id] ? S(p, es[p.id]) : F(p, ef[p.id]));
  const preS = multi ? (a, id) => W(a, S(byId[id], es[id])) : (a, id) => es[id];
  const preF = multi ? (a, id) => W(a, gF(byId[id])) : (a, id) => ef[id];
  const statusOf = multi && statusDates
    ? (a) => (statusDates[a.id] !== undefined ? statusDates[a.id] : statusDate) : () => statusDate;
  const sdOf = (a) => { const d = statusOf(a); return d ? ck(a).idx(d) : null; };
  const dur = (a) => Number.isFinite(a.duration) ? Math.max(0, Math.round(a.duration))
    : Math.max(1, ck(a).span(a.start, a.end));
  const cType = (a) => (a.constraint && CONSTRAINT_TYPES.includes(a.constraint.type) && a.constraint.type !== "ASAP" && a.constraint.date)
    ? a.constraint.type : null;
  const cIdx = (a) => ck(a).idx(a.constraint.date);
  const actualStartOf = (a) => a.actualStart ?? (a.actualFinish ? a.start : null);
  const complete = (a) => !!a.actualFinish;
  const started = (a) => !!actualStartOf(a) || Number(a.pct) > 0;
  const links = Object.fromEntries(acts.map(a => [a.id, linksOf(a).filter(l => byId[l.pred])]));
  const succs = Object.fromEntries(acts.map(a => [a.id, []]));
  acts.forEach(a => links[a.id].forEach(l => succs[l.pred].push({ succ: a.id, type: l.type, lag: l.lag })));
  const driving = {};

  /* ── forward pass ─────────────────────────────────────────────── */
  const order = topo(acts);
  order.forEach(a => {
    const d = dur(a);
    const as = actualStartOf(a);
    const sd = sdOf(a);
    driving[a.id] = [];
    if (as) {
      es[a.id] = ck(a).idx(as);
      if (complete(a)) ef[a.id] = Math.max(es[a.id], ck(a).idx(a.actualFinish));
      else if (a.remaining != null && sd != null) ef[a.id] = Math.max(es[a.id], sd) + Math.max(0, Number(a.remaining));
      else ef[a.id] = es[a.id] + d;
      return;
    }
    const ps = links[a.id];
    const cand = ps.map(l => {
      switch (l.type) {
        case "SS": return preS(a, l.pred) + l.lag;
        case "FF": return preF(a, l.pred) + l.lag - d;
        case "SF": return preS(a, l.pred) + l.lag - d;
        default:   return preF(a, l.pred) + l.lag;
      }
    });
    let s = ps.length ? Math.max(...cand) : ck(a).idx(a.start);
    /* FX-15 — the links that set this start (before any constraint), so a
       chain can be walked back along them. Read only: it moves nothing. */
    driving[a.id] = ps.filter((l, i) => cand[i] === s).map(l => l.pred);
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
  /* One clock: the latest early finish, in its units. Several: the latest
     finish on the shared calendar-day axis, read in each activity's own
     working days where it bounds that activity. */
  const projEnd = multi ? Math.max(...acts.map(a => gF(a))) : Math.max(...acts.map(a => ef[a.id]));
  const endOf = multi ? (a) => W(a, projEnd) : () => projEnd;

  /* ── backward pass ────────────────────────────────────────────── */
  [...order].reverse().forEach(a => {
    const span = ef[a.id] - es[a.id];
    if (complete(a)) { ls[a.id] = es[a.id]; lf[a.id] = ef[a.id]; return; }
    const ss = succs[a.id];
    let f = ss.length ? Math.min(...ss.map(x => {
      const X = byId[x.succ];
      switch (x.type) {
        case "SS": return across(a, X, ls[x.succ] - x.lag) + span;
        case "FF": return across(a, X, lf[x.succ] - x.lag);
        case "SF": return across(a, X, lf[x.succ] - x.lag) + span;
        default:   return across(a, X, ls[x.succ] - x.lag);
      }
    })) : endOf(a);
    /* An SS or SF predecessor can finish after its successor, so it is
       bounded by the project end as well. With FS/0 links the successor
       bound is already ≤ projEnd and this changes nothing (D-41.01). */
    f = Math.min(f, endOf(a));
    const ct = cType(a);
    if (ct === "SNLT" || ct === "MSO") f = Math.min(f, cIdx(a) + span);
    else if (ct === "FNLT" || ct === "MFO") f = Math.min(f, cIdx(a));
    if (a.deadline) f = Math.min(f, ck(a).idx(a.deadline));
    lf[a.id] = f;
    ls[a.id] = f - span;
  });

  const float = {}, freeFloat = {};
  acts.forEach(a => { float[a.id] = ls[a.id] - es[a.id]; });
  acts.forEach(a => {
    const ss = succs[a.id];
    const room = ss.length ? Math.min(...ss.map(x => {
      const X = byId[x.succ];
      switch (x.type) {
        case "SS": return across(a, X, es[x.succ] - x.lag) - es[a.id];
        case "FF": return across(a, X, ef[x.succ] - x.lag) - ef[a.id];
        case "SF": return across(a, X, ef[x.succ] - x.lag) - es[a.id];
        default:   return across(a, X, es[x.succ] - x.lag) - ef[a.id];
      }
    })) : endOf(a) - ef[a.id];
    freeFloat[a.id] = complete(a) ? 0 : Math.max(0, Math.min(room, float[a.id]));
  });

  const open = acts.filter(a => !complete(a));
  const dates = {};
  acts.forEach(a => {
    const k = ck(a);
    dates[a.id] = { es: k.startOf(es[a.id]), ef: k.finishOf(ef[a.id]), ls: k.startOf(ls[a.id]), lf: k.finishOf(lf[a.id]) };
  });
  return {
    es, ef, ls, lf, float, freeFloat,
    critical: new Set(open.filter(a => float[a.id] <= 0).map(a => a.id)),
    negative: open.filter(a => float[a.id] < 0).map(a => a.id),
    missed: open.concat(acts.filter(complete)).filter(a => a.deadline && ef[a.id] > ck(a).idx(a.deadline)).map(a => a.id),
    /* late: should have started, or should have finished, by the status
       date — a stage reported at 100 % is done even without an actual finish */
    late: open.filter(a => {
      const sd = statusOf(a);
      return sd && !(Number(a.pct) >= 100) && ((!started(a) && T(a.start) < T(sd)) || T(a.end) < T(sd));
    }).map(a => a.id),
    projEnd, origin, dates, calendar: calendar ?? null, driving,
  };
}

/** Working days in [a, b) under a calendar — calendar days without one. */
export function workdaysBetween(a, b, calendar) {
  return clock(T(a), calendar).span(a, b);
}

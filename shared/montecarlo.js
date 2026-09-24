/**
 * MONTE CARLO — schedule risk (docs/41 FX-11).
 *
 * No database, no DOM: a pure function over the same activity rows the
 * critical path reads. It does NOT schedule anything itself — every run
 * calls the one scheduler, `schedule(acts, { calendar, statusDate })` of
 * ./schedule.js, with a sampled `duration` on each estimated activity.
 * There is one forward pass in the product, and this is not a second one.
 *
 * ── Signature ────────────────────────────────────────────────────────
 *
 *   simulate(acts, { calendar, statusDate, seed, iterations }) → {
 *     seed, iterations,             as used (iterations clamped to 1…10 000)
 *     estimated,                    how many activities carried three estimates
 *     deterministic,                ISO date — the finish with no sampling
 *     p50, p80, p90,                ISO dates — nearest-rank percentiles of the finish
 *     histogram,                    [[ISO date, runs]] — one bin per finish day, in date order
 *     criticality,                  { [id]: share of runs on the critical path, 0…1, 4 dp }
 *   }
 *
 *   acts   the scheduler's rows (Engine.activities), each optionally with
 *          durOptimistic ≤ durMostLikely ≤ durPessimistic (days — working
 *          days under a calendar, like every duration). An activity
 *          without the three keeps its planned duration in every run.
 *
 * ── Why triangular, not PERT-beta ────────────────────────────────────
 *
 * The triangular draw is exact from ONE uniform number by its inverse
 * CDF — no gamma sampler, no rejection loop — so a seed maps to one
 * sequence of durations that anyone can recompute by hand, which is what
 * "reproducible" has to mean for a steering committee. It is also the
 * cautious reading of a three-point estimate: its mean (o + m + p) / 3
 * gives the pessimistic tail three times the pull PERT's (o + 4m + p) / 6
 * does, and a planner's "worst case" is usually the part that is
 * under-estimated. The distribution is named on the screen.
 *
 * ── D-41.02 ──────────────────────────────────────────────────────────
 *
 * The rows given are never written: the simulator samples into its own
 * copies. A stored run is a record of a computation, and moves no date.
 */

import { schedule } from "./schedule.js";

export const MAX_ITERATIONS = 10000;
export const DISTRIBUTION = "triangular";

/** mulberry32 — a 32-bit seeded generator; the same seed gives the same sequence everywhere. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The triangular inverse CDF: u ∈ [0, 1) → a duration in [o, p], mode m. */
export function triangular(u, o, m, p) {
  if (p <= o) return o;
  const f = (m - o) / (p - o);
  return u < f ? o + Math.sqrt(u * (p - o) * (m - o)) : p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

/** Three estimates, or null when the activity has none (or an unusable set). */
export function estimateOf(a) {
  const o = a.durOptimistic, m = a.durMostLikely, p = a.durPessimistic;
  if (o == null || m == null || p == null) return null;
  const [x, y, z] = [Number(o), Number(m), Number(p)];
  if (![x, y, z].every(Number.isFinite) || x < 0 || x > y || y > z) return null;
  return { o: x, m: y, p: z };
}

/** Nearest rank: the smallest value with at least q of the runs at or below it. */
const rank = (sorted, q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];

export function simulate(acts, { calendar = null, statusDate = null, seed = 1, iterations = 1000 } = {}) {
  const n = Math.max(1, Math.min(MAX_ITERATIONS, Math.round(Number(iterations)) || 1));
  const s = (Math.round(Number(seed)) >>> 0) || 1;
  const opts = { calendar, statusDate };
  const empty = { seed: s, iterations: n, estimated: 0, deterministic: null, p50: null, p80: null, p90: null,
    histogram: [], criticality: {} };
  if (!acts.length) return empty;

  /* The finish of one run: the date of the latest early finish. */
  const finishOf = (r) => {
    const last = acts.find((a) => r.ef[a.id] === r.projEnd);
    return { idx: r.projEnd, date: r.dates[last.id].ef };
  };
  const base = schedule(acts, opts);
  const det = finishOf(base);

  /* Our own copies: `duration` is written on these, never on the rows given. */
  const work = acts.map((a) => ({ ...a }));
  /* Work already finished does not vary (its actuals are the facts). */
  const draws = acts.map((a, i) => { const e = a.actualFinish ? null : estimateOf(a); return e && { i, ...e }; })
    .filter(Boolean);

  const rnd = mulberry32(s);
  const onPath = Object.fromEntries(acts.map((a) => [a.id, 0]));
  const finishes = new Array(n);
  const dateAt = new Map([[det.idx, det.date]]);
  for (let k = 0; k < n; k++) {
    for (const d of draws) work[d.i].duration = triangular(rnd(), d.o, d.m, d.p);
    const r = draws.length ? schedule(work, opts) : base;
    for (const id of r.critical) onPath[id]++;
    finishes[k] = r.projEnd;
    if (!dateAt.has(r.projEnd)) dateAt.set(r.projEnd, finishOf(r).date);
  }

  const sorted = finishes.slice().sort((x, y) => x - y);
  const counts = new Map();
  for (const f of sorted) counts.set(f, (counts.get(f) ?? 0) + 1);
  const round4 = (v) => Math.round(v * 10000) / 10000;
  return {
    seed: s, iterations: n, estimated: draws.length,
    deterministic: det.date,
    p50: dateAt.get(rank(sorted, 0.5)),
    p80: dateAt.get(rank(sorted, 0.8)),
    p90: dateAt.get(rank(sorted, 0.9)),
    histogram: [...counts].map(([idx, c]) => [dateAt.get(idx), c]),
    criticality: Object.fromEntries(acts.map((a) => [a.id, round4(onPath[a.id] / n)])),
  };
}

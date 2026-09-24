/**
 * AGILE — sprints, velocity, burndown, burnup, and the hybrid link
 * (docs/41 FX-14, seat S3).
 *
 * Pure: no database, no DOM. The server serialises with it, the browser
 * draws with it and the tests hold it to hand-worked examples, so the
 * number a chart shows and the number a test proves are one computation.
 *
 * Three rules run through every function here:
 *
 *   · an item with no points (`null`) is UNESTIMATED, not a one-point
 *     item and not a zero-point one. It adds nothing to a sum and is
 *     counted, by name, beside it;
 *   · a day without data is written as such (`remaining: null`, with the
 *     reason), never interpolated from its neighbours;
 *   · an item done on a day nobody recorded (`doneAt: null`, done before
 *     065 or imported without it) is done — the book says so today — but
 *     it is not placed on a past day. It is counted on the last known day
 *     and reported as `undated`.
 *
 * Nothing here writes. The hybrid option (`itemProgress`) PROPOSES a
 * percentage; the serialiser puts it in the stage's `pct`, the one field
 * the engine's physical-progress path (5.9.1) already reads.
 */

export const DONE_COLUMN = "done";
export const ITERATION_STATES = ["planned", "active", "closed"];

const DAY = 86400000;
const dayOf = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
const toTime = (d) => Date.parse(d + "T00:00:00Z");
const nextDay = (d) => new Date(toTime(d) + DAY).toISOString().slice(0, 10);

/** A number of points, or null when nobody has estimated it. */
export const pointsOf = (item) =>
  item && Number.isFinite(item.points) && item.points >= 0 ? item.points : null;
export const isDone = (item) => item?.column === DONE_COLUMN;

const sumPoints = (items) => items.reduce((n, i) => n + (pointsOf(i) ?? 0), 0);
const unestimated = (items) => items.filter((i) => pointsOf(i) === null).map((i) => i.id);

/** Every day from `from` to `to`, both included (ISO dates). */
export function daysBetween(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  for (let d = from; d <= to; d = nextDay(d)) out.push(d);
  return out;
}

/**
 * Velocity — the points each CLOSED sprint delivered, and the average of
 * the last `window` of them (3 by default).
 *
 *   20, 25, 30 delivered → 25.  Fewer closed sprints than the window →
 *   the average of those there are, and `basis` says how many. None →
 *   `average: null`: no sprint has closed, so there is no velocity.
 */
export function velocity(iterations, projectId, { window = 3 } = {}) {
  const closed = (iterations ?? [])
    .filter((s) => (!projectId || s.project === projectId) && s.state === "closed" &&
      Number.isFinite(s.donePoints))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.id < b.id ? -1 : 1));
  const last = closed.slice(-window);
  const average = last.length ? last.reduce((n, s) => n + s.donePoints, 0) / last.length : null;
  return {
    sprints: closed.map((s) => ({ id: s.id, name: s.name, end: s.end, donePoints: s.donePoints })),
    window: last.map((s) => s.id),
    basis: last.length,
    average,
  };
}

/**
 * Burndown of ONE sprint: the points still to do at the end of each day
 * of the sprint, against the ideal straight line from its scope to zero.
 *
 * Scope is the items planned in the sprint NOW (an item's arrival date in
 * the sprint is not recorded, so scope is drawn flat and says so). A day
 * after `today` has no data yet: `remaining: null, why: "future"`. When
 * some done items carry no date, the days before the last known day are
 * marked `partial` and those points land on the last known day.
 */
export function burndown(iteration, items, today) {
  if (!iteration) return null;
  const mine = (items ?? []).filter((i) => i.iteration === iteration.id);
  const scope = sumPoints(mine);
  const done = mine.filter(isDone);
  const dated = done.filter((i) => dayOf(i.doneAt));
  const undated = done.filter((i) => !dayOf(i.doneAt));
  const undatedPoints = sumPoints(undated);
  const days = daysBetween(dayOf(iteration.start), dayOf(iteration.end));
  const lastKnown = days.filter((d) => d <= today).pop() ?? null;
  const span = Math.max(1, days.length - 1);

  const series = days.map((d, k) => {
    const ideal = scope - (scope * k) / span;
    if (d > today) return { day: d, remaining: null, ideal, why: "future" };
    const burnt = sumPoints(dated.filter((i) => dayOf(i.doneAt) <= d)) +
      (d === lastKnown ? undatedPoints : 0);
    return { day: d, remaining: scope - burnt, ideal,
      partial: undatedPoints > 0 && d !== lastKnown };
  });
  return {
    iteration: iteration.id, scope, series,
    remaining: lastKnown ? series.find((x) => x.day === lastKnown).remaining : scope,
    undated: undated.map((i) => i.id), undatedPoints,
    unestimated: unestimated(mine),
  };
}

/**
 * Burnup of a project: total scope and points done, day by day, from the
 * day its first item was created to `today`. Scope grows the day an item
 * is created; done grows the day it reached Done. Undated done points are
 * counted on the last day only, and named.
 */
export function burnup(items, projectId, today) {
  const mine = (items ?? []).filter((i) => i.project === projectId);
  const created = mine.map((i) => dayOf(i.created)).filter(Boolean).sort();
  if (!mine.length || !created.length) {
    return { project: projectId, series: [], scope: 0, done: 0, undated: [], undatedPoints: 0,
      unestimated: unestimated(mine) };
  }
  const days = daysBetween(created[0] < today ? created[0] : today, today);
  const done = mine.filter(isDone);
  const dated = done.filter((i) => dayOf(i.doneAt));
  const undated = done.filter((i) => !dayOf(i.doneAt));
  const undatedPoints = sumPoints(undated);
  const last = days[days.length - 1];
  const series = days.map((d) => ({
    day: d,
    scope: sumPoints(mine.filter((i) => (dayOf(i.created) ?? d) <= d)),
    done: sumPoints(dated.filter((i) => dayOf(i.doneAt) <= d)) + (d === last ? undatedPoints : 0),
    partial: undatedPoints > 0 && d !== last,
  }));
  return {
    project: projectId, series,
    scope: series.length ? series[series.length - 1].scope : 0,
    done: series.length ? series[series.length - 1].done : 0,
    undated: undated.map((i) => i.id), undatedPoints,
    unestimated: unestimated(mine),
  };
}

/**
 * The hybrid option: a stage's physical % from the points its items have
 * delivered — done points / total points of the items linked to it,
 * rounded to the whole per cent the stage's `pct` holds.
 *
 * `pct: null` when the link cannot measure anything (no linked item, or
 * none estimated): the stage then keeps its reported %, and `why` says
 * so. The option never turns "unmeasured" into 0 %.
 */
export function itemProgress(items, activityId) {
  const linked = (items ?? []).filter((i) => i.activity === activityId);
  const total = sumPoints(linked);
  const done = sumPoints(linked.filter(isDone));
  if (!linked.length) return { pct: null, done: 0, total: 0, items: 0, why: "no linked items" };
  if (total <= 0) return { pct: null, done: 0, total: 0, items: linked.length, why: "no points on the linked items" };
  return { pct: Math.round((done / total) * 100), done, total, items: linked.length, why: null };
}

/**
 * What closing a sprint does, decided before anything is written: the
 * points it delivered (velocity's figure) and the unfinished items that
 * leave it for `to` — "backlog" or a PLANNED sprint of the same project.
 */
export function closingPlan(iteration, items, iterations, to) {
  if (!iteration) return { ok: false, why: "No such sprint" };
  if (iteration.state === "closed") return { ok: false, why: "This sprint is already closed" };
  if (to === undefined || to === null || to === "") {
    return { ok: false, why: "Say where the unfinished items go: \"backlog\" or a planned sprint of this project" };
  }
  if (to !== "backlog") {
    const next = (iterations ?? []).find((s) => s.id === to);
    if (!next || next.project !== iteration.project) return { ok: false, why: "The next sprint must be a sprint of the same project" };
    if (next.id === iteration.id) return { ok: false, why: "Unfinished items cannot stay in the sprint being closed" };
    if (next.state !== "planned") return { ok: false, why: "Unfinished items go to the backlog or to a PLANNED sprint" };
  }
  const mine = (items ?? []).filter((i) => i.iteration === iteration.id);
  return {
    ok: true,
    donePoints: sumPoints(mine.filter(isDone)),
    carried: mine.filter((i) => !isDone(i)).map((i) => i.id),
    to,
  };
}

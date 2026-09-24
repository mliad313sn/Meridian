/**
 * FX-15 (docs/41, wave D) — the programme master schedule, computed.
 *
 * Its own module, not a method of `Engine`: only the master schedule
 * (web/src/views/master.js, loaded the first time a programme's schedule
 * is opened) reads it, so it is not in the bundle every site downloads
 * (D-41.03). Pure, like the engine it builds on; the server's tests read
 * it here.
 */

import { Engine, days } from "./engine.js";
import { schedule } from "./schedule.js";

/* FX-15 — the stages a cross-project link names, as leaves: the leaves
   that carry the stage number, or — when the stage is a summary — the
   leaves under it. */
export function stageLeaves(db, projectId, stage) {
  const own = Engine.activities(db, projectId).filter(a => a.stage === stage);
  if (own.length) return own;
  const row = Engine.wbs(db, projectId).find(r => r.summary && r.a.stage === stage);
  const ids = new Set((row?.leaves ?? []).map(a => a.id));
  return Engine.activities(db, projectId).filter(a => ids.has(a.id));
}

/**
 * FX-15 — the programme master schedule: one run of the pure scheduler
 * over the leaves of every project of the programme, each on its own
 * calendar and status date, joined by the cross-project links (typed,
 * with lag — FS/0 before 067). Computed, never stored (D-41.02); the
 * per-project numbers (`criticalPath`, `metrics`) are not touched.
 *
 * `projects` narrows the run (the caller's read scope); a link with an
 * end outside it is left out, and said so in `outside`.
 *
 *   finish      ISO — the programme's finish (the latest early finish)
 *   critical    Set — leaves with no float in the PROGRAMME run
 *   chain       [{ id, project, name, es, ef, ls, lf, via }] — the
 *               programme critical chain, first to last: from the leaf
 *               that finishes the programme, back along the links that
 *               drove each start. `via` names the link that leads INTO
 *               the step ({ type, lag, cross }), null on the first.
 *   links       [{ dep, type, lag, pairs }] — each cross link resolved
 *               to [predecessor leaf, successor leaf] pairs
 *   outside     the cross links with one end outside the run
 *   projects    [{ id, finish, ownFinish, pushed, floatConsumed, onChain }]
 *               `pushed` = calendar days the links move the project's
 *               finish; `floatConsumed` = the most float any of its
 *               leaves loses to them, in the project's working days
 *   result      the scheduler's full answer, for the Gantt
 */
export function programmeSchedule(db, programmeId, projects) {
  const list = (projects ?? db.projects).filter(p => p.programme === programmeId);
  const ids = new Set(list.map(p => p.id));
  const acts = [], calendars = {}, statusDates = {}, projectOf = {}, own = {};
  for (const p of list) {
    const cal = Engine.calendarFor(db, p);
    own[p.id] = Engine.criticalPath(db, p.id);
    for (const a of Engine.activities(db, p.id)) {
      acts.push({ ...a, deps: [...(a.deps ?? [])], links: [...(a.links ?? [])] });
      calendars[a.id] = cal;
      statusDates[a.id] = p.statusDate || null;
      projectOf[a.id] = p.id;
    }
  }
  const byId = new Map(acts.map(a => [a.id, a]));
  const links = [], outside = [];
  for (const cd of db.crossDeps ?? []) {
    if (!ids.has(cd.from) || !ids.has(cd.to)) {
      if (ids.has(cd.from) || ids.has(cd.to)) outside.push(cd);
      continue;
    }
    const type = ["SS", "FF", "SF"].includes(cd.type) ? cd.type : "FS";
    const lag = Number(cd.lag) || 0;
    const pairs = [];
    for (const t of stageLeaves(db, cd.to, cd.toStage)) {
      for (const f of stageLeaves(db, cd.from, cd.fromStage)) {
        const a = byId.get(t.id);
        if (a.deps.includes(f.id)) continue;
        a.deps.push(f.id);
        a.links.push({ pred: f.id, type, lag, cross: true });
        pairs.push([f.id, t.id]);
      }
    }
    links.push({ dep: cd, type, lag, pairs });
  }
  const r = schedule(acts, { calendars, statusDates });
  const finishOf = (xs) => xs.map(a => r.dates[a.id].ef).sort().pop() ?? null;
  const finish = finishOf(acts);

  /* the chain, walked back from the leaf that finishes the programme,
     along the links that drove each start — a cross-project one first */
  const chain = [];
  let cur = acts.find(a => r.critical.has(a.id) && r.dates[a.id].ef === finish), via = null;
  while (cur && !chain.some(c => c.id === cur.id)) {
    chain.unshift({ id: cur.id, project: projectOf[cur.id], name: cur.name, ...r.dates[cur.id], via: null });
    if (via) chain[1].via = via;
    const preds = r.driving[cur.id].filter(id => r.critical.has(id));
    const next = preds.find(id => projectOf[id] !== projectOf[cur.id]) ?? preds[0];
    if (!next) break;
    const l = cur.links.find(x => x.pred === next) ?? { type: "FS", lag: 0 };
    via = { type: l.type, lag: l.lag, cross: !!l.cross };
    cur = byId.get(next);
  }
  const onChain = new Set(chain.map(c => c.id));

  const perProject = list.map(p => {
    const mine = acts.filter(a => projectOf[a.id] === p.id);
    const cp = own[p.id];
    const ownFinish = mine.map(a => cp.dates[a.id].ef).sort().pop() ?? null;
    const f = finishOf(mine);
    return { id: p.id, finish: f, ownFinish, pushed: f ? days(ownFinish, f) : 0,
      floatConsumed: Math.max(0, ...mine.map(a => cp.float[a.id] - r.float[a.id])),
      onChain: mine.some(a => onChain.has(a.id)) };
  });
  return { finish, critical: r.critical, chain, links, outside, projects: perProject, result: r };
}

/**
 * D-41.01 — the engine's numbers on the seeded book, in a form that can be
 * compared with `deepEqual` and stored as JSON.
 *
 * `metrics` for every project, `roll` over the whole book and
 * `criticalPath` for every project (its Set turned into a sorted list).
 * The JSON beside this file was produced by this function on 5.28.0
 * (commit 7f3dd7a, seeded with today = 2026-08-28) BEFORE any FX-14 code
 * existed; server/test/agile.test.js holds today's engine to it.
 */
import { Engine } from "../../../shared/engine.js";

export function engineSnapshot(db) {
  /* A metric carries its project row; the row is not a number of the
     engine, and a field another line adds to a project is not a moved
     number. It is kept as its id. */
  const plain = (v) => JSON.parse(JSON.stringify(v, (k, x) =>
    k === "project" && x && typeof x === "object" ? x.id : x));
  const metrics = {};
  const critical = {};
  for (const p of db.projects) {
    metrics[p.id] = plain(Engine.metrics(db, p.id));
    const cp = Engine.criticalPath(db, p.id);
    /* The seven keys 5.28.0 returned; 5.29.0 adds others by contract. */
    const { float, projEnd, es, ef, ls, lf } = cp;
    critical[p.id] = plain({ critical: [...cp.critical].sort(), float, projEnd, es, ef, ls, lf });
  }
  const roll = plain(Engine.roll(db, db.projects));
  return { metrics, roll, critical };
}

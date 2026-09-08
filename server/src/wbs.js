/**
 * Work-breakdown generation.
 *
 * In the v4 build, creating a project built its whole schedule in the
 * browser: activities from the method's template, the four gate
 * milestones, a draft evidence document per gate, and the PM's own
 * allocation. That is business logic, not presentation, so it lives here
 * now — one implementation, reachable from the API and from the seed.
 */

import { WBS, SLOTS } from "./seed-data.js";
import { insertMany, allocateId } from "./db.js";
import { GATES, days, addDays, iso, by, D, normaliseGateModel } from "../../shared/engine.js";
import { fromM } from "./portfolio.js";

/** Expand a project's template into dated, dependency-linked activities. */
export function activitiesFor(project) {
  const tpl = WBS[project.method] || WBS.Hybrid;
  const span = Math.max(1, days(project.start, project.finish));
  return tpl.map((t, i) => {
    const start = addDays(project.start, Math.round(t.off * span));
    const end = addDays(project.start, Math.round((t.off + t.dur) * span));
    return {
      id: `${project.id}-A${i + 1}`,
      name: t.n,
      stage: i,
      start: iso(start),
      end: iso(end),
      baseStart: iso(start),
      baseEnd: iso(end),
      weight: t.w,
      pct: 0,
      deps: t.dep.map((d) => `${project.id}-A${d + 1}`),
    };
  });
}

/** The programme's gates (I-3) — the default four unless it declares
    its own — placed proportionally across the project window. */
export function milestonesFor(project, ladder = GATES) {
  const span = Math.max(1, days(project.start, project.finish));
  return ladder.map((g) => ({
    id: `${project.id}-G${g.n}`,
    name: g.name,
    gate: g.n,
    kind: "gate",
    date: iso(addDays(project.start, Math.round(g.at * span))),
  }));
}

/** A draft evidence document per gate, so gate locking has something to read. */
export function gateDocsFor(project, ladder = GATES) {
  const last = ladder.length;
  return ladder.map((g) => ({
    id: null,   // assigned from the atomic counter by scaffoldProject
    name: (g.evidence.split(",")[0].trim() || g.name) + " — " + project.id,
    type: g.n === 1 ? "Charter" : g.n === last ? "Closure" : g.n === 2 ? "Design" : "Assurance",
    gate: g.n,
    status: "Draft",
    revision: "0.1",
  }));
}

/* I-4 — the ladder's "evidence" list becomes the gate's criteria, one per
   comma-separated item, posed in advance and waiting for a named reviewer. */
export function gateCriteriaFor(ladder = GATES) {
  const out = [];
  for (const g of ladder) {
    g.evidence.split(",").map((t) => t.trim()).filter(Boolean)
      .forEach((text, i) => out.push({ gate: g.n, seq: i, text: text[0].toUpperCase() + text.slice(1) }));
  }
  return out;
}

/**
 * Re-stretch a project's activities when its window moves.
 *
 * Progress is preserved and the baseline is not touched: moving the plan
 * is not the same as agreeing a new one, and conflating the two is how a
 * portfolio quietly loses its variance (A1).
 */
export function reschedule(project, existing) {
  const acts = existing.slice().sort(by("stage"));
  if (!acts.length) return [];
  const tpl = WBS[project.method] || WBS.Hybrid;
  const span = Math.max(1, days(project.start, project.finish));
  return acts.map((a, i) => {
    const t = tpl[a.stage] ?? tpl[Math.min(i, tpl.length - 1)];
    return {
      id: a.id,
      start: iso(addDays(project.start, Math.round(t.off * span))),
      end: iso(addDays(project.start, Math.round((t.off + t.dur) * span))),
    };
  });
}

/**
 * Write a freshly created project's schedule, gates, evidence and the
 * project manager's own allocation, inside the caller's transaction.
 *
 * This used to issue about twenty-five separate statements — one per
 * activity, per dependency link, per gate, per evidence document. On one
 * connection that is twenty-five serialised round trips; behind a pool it
 * is twenty-five network hops with a transaction held open the whole
 * time, which is exactly how a create endpoint starts showing up in the
 * slow query log. It is now five multi-row inserts.
 */
export async function scaffoldProject(t, project) {
  const acts = activitiesFor(project);
  const owner = project.pm ?? null;
  /* I-3 — the programme's ladder, read inside the caller's transaction. */
  const prog = project.programme
    ? (await t.query(`SELECT gate_model FROM programme WHERE id = $1`, [project.programme])).rows[0]
    : null;
  let ladder = GATES;
  try {
    const m = prog?.gate_model;
    const parsed = typeof m === "string" ? JSON.parse(m) : m;
    ladder = normaliseGateModel(parsed) ?? GATES;
  } catch { ladder = GATES; }

  await insertMany(t, "activity",
    ["id", "project_id", "name", "stage", "start_date", "end_date",
     "base_start", "base_end", "weight", "pct", "owner_id"],
    acts.map((a) => ({
      id: a.id, project_id: project.id, name: a.name, stage: a.stage,
      start_date: a.start, end_date: a.end,
      base_start: a.baseStart, base_end: a.baseEnd,
      weight: a.weight, pct: 0, owner_id: owner,
    })));

  const links = acts.flatMap((a) => a.deps.map((d) => ({ activity_id: a.id, predecessor_id: d })));
  await insertMany(t, "activity_dep", ["activity_id", "predecessor_id"], links,
    { onConflict: "ON CONFLICT DO NOTHING" });

  await insertMany(t, "milestone",
    ["id", "project_id", "name", "due_date", "base_date", "gate", "kind", "owner_id"],
    milestonesFor(project, ladder).map((m) => ({
      id: m.id, project_id: project.id, name: m.name,
      due_date: m.date, base_date: m.date, gate: m.gate, kind: "gate", owner_id: owner,
    })));

  /* Evidence identifiers come from the same atomic counter every other
     document uses, so a project created while someone else is adding a
     document cannot collide with them. */
  const docs = gateDocsFor(project, ladder);
  for (const d of docs) d.id = await allocateId(t, "DOC");
  await insertMany(t, "document",
    ["id", "project_id", "name", "doc_type", "gate", "owner_id", "revision", "status", "updated_on"],
    docs.map((d) => ({
      id: d.id, project_id: project.id, name: d.name, doc_type: d.type,
      gate: d.gate, owner_id: owner, revision: d.revision, status: d.status,
      updated_on: iso(new Date()),
    })));

  /* I-4 — the criteria each gate was declared with, posed at birth. */
  const crit = gateCriteriaFor(ladder);
  for (const c of crit) c.id = await allocateId(t, "GC");
  await insertMany(t, "gate_criterion",
    ["id", "project_id", "gate", "seq", "text"],
    crit.map((c) => ({ id: c.id, project_id: project.id, gate: c.gate, seq: c.seq, text: c.text })));

  if (owner) {
    await t.query(
      `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct)
       VALUES ($1,$2,$3,$4,100)`,
      [owner, project.id, project.start, project.finish]
    );
  }
  return acts;
}

/** Which phase a project's window puts it in, as at a date. */
export function phaseFor(project, today) {
  const total = Math.max(1, days(project.start, project.finish));
  const t = Math.min(1, Math.max(0, days(project.start, today) / total));
  if (t < 0.10) return "Initiation";
  if (t < 0.22) return "Design";
  if (t < 0.82) return "Execution";
  if (t < 0.94) return "Transition";
  return "Closure";
}

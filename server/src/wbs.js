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
import { insertMany, allocateId, updateVersioned } from "./db.js";
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
    g.evidence.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
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

  /* E-1 — sous quelle échelle ce projet a été dressé. La 036 pose, à
     juste titre, qu'une échelle modifiée ne réécrit pas les projets
     existants : des jalons datés et des preuves déposées ne doivent pas
     bouger sous les pieds des gens. Mais une organisation réelle adopte
     un outil avec des projets déjà dedans, et sans cela rien ne DIT
     qu'un projet suit une échelle que son programme ne déclare plus.
     On l'écrit donc, au lieu de le deviner plus tard. */
  await t.query(`UPDATE project SET scaffolded_gates = $2 WHERE id = $1`,
    [project.id, ladder.length]);

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

  /* I-4 — the criteria each gate was declared with, posed at birth — for a
     programme that DECLARED its ladder. The default four gates keep their
     old behaviour for new projects too: evidence approved clears them
     (D-33.13; the code counsellor traced eleven surprise criteria and a
     group-only clearance on every new site project). */
  const crit = ladder === GATES ? [] : gateCriteriaFor(ladder);
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

/* ═══════════════════════════════════════════════════════════════════
   REQ-27 (RT365 V-8) · A PROJECT THAT ALREADY EXISTS MOVES ONTO ITS
   PROGRAMME'S LADDER.

   Half of V-8 has been true since 5.10.0: `scaffoldProject` above reads
   the programme's ladder and only that one, so a project created under a
   programme that declares six gates gets six, never ten. What RT365
   measured — "ten milestones where six were intended" — is the OTHER
   half: their sixteen projects were scaffolded before RBT carried a gate
   model at all, and D-33.2 says, deliberately, that declaring a ladder
   does not rewrite projects that already exist. Dated gates and filed
   evidence must not move under people's feet.

   So the gap is the MIGRATION, and a migration that runs by itself would
   break the very rule that created the gap. This is therefore an
   explicit act on ONE named project: `planLadderMove` says what would
   happen, `applyLadderMove` does exactly that and nothing else.

   ── What "matches" means ───────────────────────────────────────────
   A rung is matched BY NAME, not by position. Position is not identity:
   a ladder that inserts a rung renumbers everything below it, and
   positional matching would then quietly relabel "Readiness" as
   "Shadow" and drag its filed evidence along under the new name. A name
   is what a person wrote and what the operator can check on the dry run.
   Names are compared with the spelling noise removed — case, runs of
   whitespace, and the four dashes a keyboard produces — because "Gate A
   - Discovery" and "Gate A — Discovery" are the same rung and refusing
   to see that would make the act useless on the first real book.

   ── What happens to a gate no rung matches ─────────────────────────
   It is RETIRED, never deleted. The row stays whole — its date, its
   acceptance, its accepter, its criteria, its documents — and only its
   PLACE on the ladder is gone: `kind` becomes 'milestone', `gate`
   becomes NULL, and `retired_gate` (047) records the rung it held.
   Deleting would destroy evidence; leaving it on the ladder would make
   the ladder a lie. Retiring is the third answer, and it is the only one
   that is true afterwards.

   And a retirement that carries something a person SIGNED or FILED — a
   gate marked done, an acceptance, an approved or located evidence
   document, a criterion a named reviewer found met — must be named in
   the request. Nothing is discarded either way; what the acknowledgement
   buys is that no such milestone leaves the ladder without the operator
   having read the sentence that says it will.
   ═══════════════════════════════════════════════════════════════════ */

/** Spelling noise removed. Two rungs with the same name are the same rung. */
const rungKey = (s) => String(s ?? "")
  .replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

/** The refusals of this act, in the manner of EVIDENCE_REFUSAL: what to
    do instead, never merely "no". */
export const LADDER_REFUSAL = {
  noProgramme: "This project belongs to no programme, so there is no ladder to move it onto. " +
    "Attach it to a programme in Administration → Programmes, declare that programme's gate ladder, then run this again.",
  closed: (id) => `${id} is closed. Its gates are the record of how it was governed, and moving a closed project onto a new ladder would rewrite that record. ` +
    "Reopen the project if the move is genuinely wanted, or leave it as the book it was closed as.",
  sdp: "This project is synchronised from the SDP roadmap — its schedule is edited there, not in Meridian. Move it onto its ladder in SDP and let the next sync carry it over.",
  badLadder: (why) => `This project's programme carries a gate ladder Meridian cannot read (${why}). ` +
    "Fix the ladder on the programme in Administration → Programmes, then run this again.",
  unacknowledged: (refs) =>
    `${refs.length} gate${refs.length === 1 ? "" : "s"} would leave the ladder carrying an acceptance or a filed evidence citation. ` +
    "Nothing is deleted — each one keeps its date, its acceptance and its evidence and becomes an ordinary milestone — but the act will not take " +
    `them off the ladder until you say you have read that: send acknowledge: ${JSON.stringify(refs)}.`,
  stale: (refs) =>
    `The plan has changed since you read it — ${JSON.stringify(refs)} ${refs.length === 1 ? "is" : "are"} no longer part of it. ` +
    "Read the dry run again (GET /api/projects/:id/ladder) and send the acknowledgements it lists.",
};

/** Order the candidates for one rung: the gate already at this rung, then
    any other gate milestone, then an ordinary milestone; earliest first. */
function preference(m, n) {
  if (m.kind === "gate" && m.gate === n) return 0;
  if (m.kind === "gate") return 1;
  return 2;
}

/**
 * What a milestone about to leave the ladder carries that a person put
 * there.
 *
 * CODES, not prose. This list is drawn on a screen that is read in
 * French and in Spanish, and a sentence composed here would arrive there
 * untranslatable — R-15's "the language does not mix", which F5 exists to
 * hold. The screen names each `what`; the count travels beside it.
 */
function carried(m, oldGate, docs, criteria) {
  const out = [];
  if (m?.done) out.push({ what: "done" });
  if (m?.accepted_by) out.push({ what: "accepted", who: m.accepted_by });
  else if (String(m?.acceptance_criteria ?? "").trim()) out.push({ what: "acceptanceCriteria" });
  const filed = docs.filter((d) => d.gate === oldGate &&
    (d.status === "Approved" || String(d.uri ?? "").trim()));
  if (filed.length) out.push({ what: "evidence", count: filed.length });
  const met = criteria.filter((c) => c.gate === oldGate && c.met);
  if (met.length) out.push({ what: "criteriaMet", count: met.length });
  return out;
}

/**
 * Say what moving this project onto its programme's ladder would do.
 *
 * Reads only. `q` is anything with `.query()` — the module-level handle
 * for the dry run (no transaction is open), or the `t` of the act, which
 * recomputes the plan inside its own transaction so that what it applies
 * is what it just read rather than what a caller sent it.
 *
 * @returns null when there is no such project; otherwise the plan.
 */
export async function planLadderMove(q, projectId) {
  const p = (await q.query(
    `SELECT id, name, programme_id, start_date, finish_date, pm_id, gate, closed, origin,
            scaffolded_gates, row_version
       FROM project WHERE id = $1`, [projectId])).rows[0];
  if (!p) return null;

  const prog = (await q.query(
    `SELECT id, name, gate_model FROM programme WHERE id = $1`, [p.programme_id])).rows[0] ?? null;

  const empty = (refusal) => ({
    project: p.id, name: p.name, version: p.row_version,
    programme: prog?.id ?? null, programmeName: prog?.name ?? null,
    ladder: null, scaffoldedGates: p.scaffolded_gates ?? null,
    onLadder: false, adopt: [], create: [], retire: [],
    acknowledgeRequired: [], summary: { adopt: 0, create: 0, retire: 0 },
    refusal,
  });

  if (!prog) return empty(LADDER_REFUSAL.noProgramme);
  if (p.closed) return empty(LADDER_REFUSAL.closed(p.id));
  if (p.origin === "sdp") return empty(LADDER_REFUSAL.sdp);

  let ladder = GATES, declared = false;
  try {
    const m = prog.gate_model;
    const parsed = typeof m === "string" ? JSON.parse(m) : m;
    const n = normaliseGateModel(parsed);
    if (n) { ladder = n; declared = true; }
  } catch (e) { return empty(LADDER_REFUSAL.badLadder(e.message)); }

  const ms = (await q.query(
    `SELECT * FROM milestone WHERE project_id = $1 ORDER BY due_date, id`, [p.id])).rows;
  const docs = (await q.query(
    `SELECT id, name, gate, status, uri, row_version FROM document WHERE project_id = $1`, [p.id])).rows;
  const criteria = (await q.query(
    `SELECT id, gate, text, met, row_version FROM gate_criterion WHERE project_id = $1`, [p.id])).rows;
  const raid = (await q.query(
    `SELECT id, gate, row_version FROM raid_item WHERE project_id = $1 AND gate IS NOT NULL`, [p.id])).rows;
  const lessons = (await q.query(
    `SELECT id, gate_n, row_version FROM lesson WHERE project_id = $1 AND gate_n IS NOT NULL`, [p.id])).rows;
  const cases = (await q.query(
    `SELECT id, reconfirmed_gate, row_version FROM business_case
      WHERE project_id = $1 AND reconfirmed_gate IS NOT NULL`, [p.id])).rows;

  /* ── the match, by name ──────────────────────────────────────────── */
  const claimed = new Set();
  const adopt = [], create = [];
  const dated = milestonesFor({ id: p.id, start: p.start_date, finish: p.finish_date }, ladder);
  for (const rung of ladder) {
    const want = rungKey(rung.name);
    const pool = ms.filter((m) => !claimed.has(m.id) && rungKey(m.name) === want);
    pool.sort((a, b) => preference(a, rung.n) - preference(b, rung.n) ||
      String(a.due_date).localeCompare(String(b.due_date)) || a.id.localeCompare(b.id));
    const m = pool[0];
    if (m) {
      claimed.add(m.id);
      adopt.push({
        rung: rung.n, name: rung.name, milestone: m.id,
        was: { kind: m.kind, gate: m.gate ?? null, name: m.name },
        keeps: {
          date: m.due_date, done: !!m.done, acceptedBy: m.accepted_by ?? null,
          acceptanceCriteria: !!String(m.acceptance_criteria ?? "").trim(),
        },
      });
    } else {
      create.push({
        rung: rung.n, name: rung.name,
        date: dated.find((d) => d.gate === rung.n).date,
        evidence: rung.evidence, owner: rung.owner,
      });
    }
  }

  /* ── the remap: every gate number this project uses, and where it goes
        under the new ladder. A number no adopted rung claims leaves the
        ladder (0 on a document or a criterion, NULL on a register row, a
        lesson or a reconfirmation), because otherwise it would silently
        become the evidence of a DIFFERENT rung. ─────────────────────── */
  const map = new Map();
  for (const a of adopt) {
    if (a.was.kind === "gate" && Number.isInteger(a.was.gate) && a.was.gate > 0) map.set(a.was.gate, a.rung);
  }
  const used = new Set();
  for (const m of ms) if (m.kind === "gate" && Number.isInteger(m.gate) && m.gate > 0) used.add(m.gate);
  for (const d of docs) if (d.gate > 0) used.add(d.gate);
  for (const c of criteria) if (c.gate > 0) used.add(c.gate);
  for (const rr of raid) used.add(rr.gate);
  for (const l of lessons) used.add(l.gate_n);
  for (const bc of cases) used.add(bc.reconfirmed_gate);
  if (p.gate > 0) used.add(p.gate);
  for (const n of used) if (!map.has(n)) map.set(n, 0);

  /* ── what leaves the ladder ──────────────────────────────────────── */
  const retire = [];
  for (const m of ms) {
    if (m.kind !== "gate" || claimed.has(m.id)) continue;
    const carries = carried(m, m.gate, docs, criteria);
    retire.push({
      ref: m.id, milestone: m.id, name: m.name, gate: m.gate ?? null,
      date: m.due_date, carries, acknowledge: carries.length > 0,
    });
  }
  /* A gate NUMBER that carries evidence with no milestone left on it —
     someone deleted the gate, the documents stayed. It leaves the ladder
     too, and it is named, because "never silently" has to hold for a
     citation whose milestone is already gone. */
  for (const n of [...map.keys()].sort((a, b) => a - b)) {
    if (map.get(n) !== 0) continue;
    if (retire.some((r) => r.gate === n)) continue;
    const carries = carried(null, n, docs, criteria);
    if (!carries.length && !docs.some((d) => d.gate === n) && !criteria.some((c) => c.gate === n)) continue;
    retire.push({
      ref: `gate:${n}`, milestone: null, name: `Gate ${n} — no milestone`, gate: n,
      date: null, carries, acknowledge: carries.length > 0,
    });
  }

  const remapped = [...map.entries()].filter(([from, to]) => from !== to);
  const onLadder = !create.length && !retire.length && !remapped.length &&
    adopt.every((a) => a.was.kind === "gate" && a.was.gate === a.rung && a.was.name === a.name) &&
    (p.scaffolded_gates ?? null) === ladder.length;

  return {
    project: p.id, name: p.name, version: p.row_version,
    programme: prog.id, programmeName: prog.name,
    ladder: { declared, gates: ladder.length,
              rungs: ladder.map((g) => ({ n: g.n, name: g.name, owner: g.owner, at: g.at })) },
    scaffoldedGates: p.scaffolded_gates ?? null,
    onLadder,
    adopt, create, retire,
    acknowledgeRequired: retire.filter((r) => r.acknowledge).map((r) => r.ref),
    summary: { adopt: adopt.length, create: create.length, retire: retire.length },
    refusal: null,
    /* not serialised to the caller — the act's own working set */
    _internal: { p, ladder, declared, ms, docs, criteria, raid, lessons, cases, map, claimed },
  };
}

/** The plan as it goes over the wire: everything above except the working set. */
export function publicPlan(plan) {
  if (!plan) return null;
  const { _internal, ...rest } = plan;
  return rest;
}

/**
 * Do exactly what the plan said, inside the caller's transaction.
 *
 * Returns the counts it actually performed — never a count it did not
 * verify (REQ-33's lesson: a screen that reports a number it did not
 * measure is worse than one that says nothing).
 */
export async function applyLadderMove(t, plan, { acknowledge = [] } = {}) {
  const { p, ladder, declared, docs, criteria, raid, lessons, cases, map } = plan._internal;
  const moved = (from) => map.has(from) ? map.get(from) : from;

  let adopted = 0, created = 0, retired = 0, rebound = 0, posed = 0, filed = 0;

  /* 1 · the bindings keyed by gate NUMBER move first, so that a rung
        number about to be reused is empty before anything lands on it. */
  const rebind = async (table, column, rows, key, off) => {
    for (const row of rows) {
      const from = row[key];
      const to = moved(from);
      const next = to === 0 ? off : to;
      if (next === from) continue;
      const r = await updateVersioned(t, table, String(row.id), row.row_version, { [column]: next });
      if (!r.ok) throw new LadderConflict();
      rebound++;
    }
  };
  await rebind("document", "gate", docs.filter((d) => d.gate > 0), "gate", 0);
  await rebind("gate_criterion", "gate", criteria.filter((c) => c.gate > 0), "gate", 0);
  await rebind("raid_item", "gate", raid, "gate", null);
  await rebind("lesson", "gate_n", lessons, "gate_n", null);
  await rebind("business_case", "reconfirmed_gate", cases, "reconfirmed_gate", null);

  /* 2 · what leaves the ladder. Nothing is deleted: the row keeps its
        date, its acceptance, its accepter and its evidence, and only
        stops being a rung. 047 writes down which rung it was. */
  for (const r of plan.retire) {
    if (!r.milestone) continue;                       // an orphan number: step 1 has already moved it
    const m = plan._internal.ms.find((x) => x.id === r.milestone);
    const ok = await updateVersioned(t, "milestone", m.id, m.row_version,
      { kind: "milestone", gate: null, retired_gate: m.gate ?? null });
    if (!ok.ok) throw new LadderConflict();
    retired++;
  }

  /* 3 · what is adopted: bound to its rung, never duplicated beside it.
        The ladder's spelling becomes the row's, so a second run matches
        the same milestone and writes nothing. */
  for (const a of plan.adopt) {
    const m = plan._internal.ms.find((x) => x.id === a.milestone);
    const patch = {};
    if (m.kind !== "gate") patch.kind = "gate";
    if (m.gate !== a.rung) patch.gate = a.rung;
    if (m.name !== a.name) patch.name = a.name;
    if (m.retired_gate !== null && m.retired_gate !== undefined) patch.retired_gate = null;
    if (!Object.keys(patch).length) continue;
    const ok = await updateVersioned(t, "milestone", m.id, m.row_version, patch);
    if (!ok.ok) throw new LadderConflict();
    adopted++;
  }

  /* 4 · the rungs the project does not have yet — scaffolded exactly as
        a project born under this ladder gets them: the milestone, its
        draft evidence document, and the criteria the ladder declares.
        A rung that is ADOPTED gets none of that: the ladder does not
        invent an artefact nobody filed, nor pose an expectation on a
        gate the project has been running for a year. */
  const owner = p.pm_id ?? null;
  const taken = new Set(plan._internal.ms.map((m) => m.id));
  const lastRung = ladder.length;
  for (const c of plan.create) {
    const rung = ladder.find((g) => g.n === c.rung);
    let id = `${p.id}-G${c.rung}`;
    if (taken.has(id)) {
      const n = await allocateId(t, "MS");
      id = `${p.id}-M${n.split("-")[1]}`;
    }
    taken.add(id);
    await t.query(
      `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id)
       VALUES ($1,$2,$3,$4,$4,$5,'gate',$6)`,
      [id, p.id, rung.name, c.date, rung.n, owner]);
    created++;

    const docId = await allocateId(t, "DOC");
    await t.query(
      `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on)
       VALUES ($1,$2,$3,$4,$5,$6,'0.1','Draft',$7)`,
      [docId, p.id,
       (rung.evidence.split(",")[0].trim() || rung.name) + " — " + p.id,
       rung.n === 1 ? "Charter" : rung.n === lastRung ? "Closure" : rung.n === 2 ? "Design" : "Assurance",
       rung.n, owner, iso(new Date())]);
    filed++;

    /* D-33.13 — the default four never pose criteria, on a new project or
       on a migrated one. Only a DECLARED ladder carries its own. */
    if (declared) {
      for (const crit of gateCriteriaFor([rung])) {
        const cid = await allocateId(t, "GC");
        await t.query(
          `INSERT INTO gate_criterion (id, project_id, gate, seq, text) VALUES ($1,$2,$3,$4,$5)`,
          [cid, p.id, rung.n, crit.seq, crit.text]);
        posed++;
      }
    }
  }

  /* 5 · and the project itself says which ladder it now stands on — the
        read signal 043 posed, finally true for a book that was migrated
        rather than born here. */
  const projectPatch = {};
  if ((p.scaffolded_gates ?? null) !== ladder.length) projectPatch.scaffolded_gates = ladder.length;
  const nextGate = p.gate > 0 ? moved(p.gate) : p.gate;
  if (nextGate !== p.gate) projectPatch.gate = nextGate;
  if (Object.keys(projectPatch).length) {
    const ok = await updateVersioned(t, "project", p.id, p.row_version, projectPatch);
    if (!ok.ok) throw new LadderConflict();
  }

  return { adopted, created, retired, rebound, posed, filed,
           gates: ladder.length, acknowledged: acknowledge.length };
}

/** Someone else changed one of these rows between the plan and the act. */
export class LadderConflict extends Error {
  constructor() {
    super("Someone else changed part of this project while the move was running — nothing was written. Read the dry run again and repeat the act.");
    this.status = 409;
  }
}

/**
 * FX-12 (docs/41) — PORTFOLIO SCENARIOS.
 *
 * A scenario is a named set of what-if changes over the live portfolio.
 * These routes write two tables and two only — `scenario` and
 * `scenario_change` — and their own audit rows (D-41.02: a scenario
 * never writes the live book; scenarios.test.js counts every other table
 * before and after to hold it).
 *
 *   GET    /scenarios                  the list, with the decisions naming each
 *   POST   /scenarios                  a new, empty scenario
 *   PATCH  /scenarios/:id              its name and note (Draft only)
 *   DELETE /scenarios/:id              a Draft nobody has decided on
 *   POST   /scenarios/:id/withdraw     a Proposed one that will not be applied
 *   POST   /scenarios/:id/changes      one change (Draft only)
 *   PATCH  /scenario-changes/:id       that change corrected (Draft only)
 *   DELETE /scenario-changes/:id       that change removed (Draft only)
 *   GET    /scenarios/:id/compare      live and scenario side by side (pure)
 *   POST   /scenarios/:id/apply        the promotion — see below
 *
 * PROPOSING is not here: it is recording a decision that names the
 * scenario, through the decision register's own door (POST /decisions
 * with `scenarioId`), which freezes the scenario in the same transaction.
 * RATIFYING is the register's too (POST /decisions/:id/ratify, REQ-50).
 *
 * APPLYING is the only route of this file that writes the live book, and
 * it writes it the way every other route does: rbac (canApplyScenario,
 * which holds the ratified decision, its independence and each change's
 * own action), then one transaction in which every change is its own
 * audited mutation asserting the version of every row it touches. A row
 * that moved since the scenario was written is a 409 that names it.
 */

import { Router } from "express";
import { many, one, tx, updateVersioned, allocateId, requiredVersion } from "../db.js";
import { can, canApplyScenario } from "../../../shared/rbac.js";
import { audited, record } from "../audit.js";
import { HttpError } from "../auth.js";
import {
  loadPortfolio, loadWeighting, loadDemandForRanking, loadScenarios, scenarioOut,
  scenarioChangeOut, fromM, toM, M,
} from "../portfolio.js";
import { compareScenario, CHANGE_KINDS, PROJECT_KINDS, WEIGHT_INPUTS } from "../../../shared/scenario.js";

const r = Router();

const bad = (msg) => { throw new HttpError(400, msg); };
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
  return v;
}
function conflict(result, what = "this scenario") {
  if (!result.ok) throw new HttpError(409, `Someone else changed ${what} — reload and try again`);
  return result;
}
async function scenarioRow(id) {
  const s = await one(`SELECT * FROM scenario WHERE id = $1`, [String(id)]);
  if (!s) throw new HttpError(404, "No such scenario");
  return s;
}
function assertDraft(s) {
  if (s.status !== "Draft") {
    throw new HttpError(409, s.status === "Proposed"
      ? `Scenario ${s.id} is Proposed — a decision names it, so it is frozen as decided; withdraw it and draft a new one to change it`
      : `Scenario ${s.id} is ${s.status} — it is a record now, and is not edited`);
  }
}
/** The decisions naming a scenario, most recent first. */
async function decisionsFor(ids) {
  if (!ids.length) return [];
  return many(
    `SELECT d.id, d.scenario_id, d.status, d.decided_by, d.ratified_by, d.ratified_on, d.decided_on,
            d.headline, ru.person_id AS recorder_person
       FROM meeting_decision d LEFT JOIN app_user ru ON ru.id = d.recorded_by
      WHERE d.scenario_id = ANY($1)
      ORDER BY COALESCE(d.decided_on, CURRENT_DATE) DESC, d.id DESC`, [ids]);
}
const decisionOut = (d) => ({
  id: d.id, status: d.status, headline: d.headline, decidedBy: d.decided_by ?? null,
  ratifiedBy: d.ratified_by || null, ratifiedOn: d.ratified_on ?? null,
  recorderPerson: d.recorder_person ?? null,
});

/* ── read ─────────────────────────────────────────────────────────── */

r.get("/scenarios", async (req, res, next) => {
  try {
    gate(req.user, "scenario.read");
    const db = await loadPortfolio(req.user);
    const list = await loadScenarios(db);
    const decisions = await decisionsFor(list.map((s) => s.id));
    const authors = await many(`SELECT id, display_name, person_id FROM app_user WHERE id = ANY($1)`,
      [[...new Set(list.flatMap((s) => [s.createdBy, s.appliedBy]).filter(Boolean))]]);
    const who = new Map(authors.map((a) => [a.id, a]));
    res.json({
      scenarios: list.map((s) => ({
        ...s,
        createdByName: who.get(s.createdBy)?.display_name ?? null,
        createdByPerson: who.get(s.createdBy)?.person_id ?? null,
        appliedByName: who.get(s.appliedBy)?.display_name ?? null,
        decisions: decisions.filter((d) => d.scenario_id === s.id).map(decisionOut),
      })),
    });
  } catch (e) { next(e); }
});

/** Everything the pure comparison needs, read for one reader. */
async function bookFor(user) {
  const [db, weighting, demand] = await Promise.all([
    loadPortfolio(user), loadWeighting(), loadDemandForRanking(),
  ]);
  return { db, weighting, demand };
}

r.get("/scenarios/:id/compare", async (req, res, next) => {
  try {
    gate(req.user, "scenario.read");
    const book = await bookFor(req.user);
    const [s] = await loadScenarios(book.db, { id: req.params.id });
    if (!s) throw new HttpError(404, "No such scenario");
    const out = compareScenario(book, s.changes);
    res.json({ scenario: { id: s.id, name: s.name, status: s.status, version: s.version }, ...out });
  } catch (e) { next(e); }
});

/* ── the scenario ─────────────────────────────────────────────────── */

r.post("/scenarios", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim().slice(0, 200);
    if (!name) bad("A scenario needs a name — the question it asks, in a few words");
    let id = null;
    await audited(req.user,
      () => ({ action: "Scenario created", entity: "scenario", entityId: id, detail: name }),
      async (t) => {
        id = await allocateId(t, "SCN", { pad: 3 });
        await t.query(`INSERT INTO scenario (id, name, note, created_by) VALUES ($1,$2,$3,$4)`,
          [id, name, String(b.note ?? "").slice(0, 4000), req.user.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/scenarios/:id", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const s = await scenarioRow(req.params.id);
    assertDraft(s);
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) {
      const name = String(b.name ?? "").trim().slice(0, 200);
      if (!name) bad("A scenario needs a name");
      patch.name = name;
    }
    if (b.note !== undefined) patch.note = String(b.note ?? "").slice(0, 4000);
    const out = await audited(req.user,
      { action: "Scenario updated", entity: "scenario", entityId: s.id, detail: patch.name ?? s.name },
      async (t) => conflict(await updateVersioned(t, "scenario", s.id, requiredVersion(b, "scenario"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/scenarios/:id", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const s = await scenarioRow(req.params.id);
    const named = await one(`SELECT id FROM meeting_decision WHERE scenario_id = $1 LIMIT 1`, [s.id]);
    if (named) throw new HttpError(409, `Decision ${named.id} names scenario ${s.id} — it is on the record; withdraw it instead`);
    assertDraft(s);
    const changes = await many(`SELECT * FROM scenario_change WHERE scenario_id = $1 ORDER BY seq, id`, [s.id]);
    await audited(req.user,
      { action: "Scenario removed", entity: "scenario", entityId: s.id, detail: s.name,
        before: scenarioOut(s, changes) },
      async (t) => t.query(`DELETE FROM scenario WHERE id = $1`, [s.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post("/scenarios/:id/withdraw", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const s = await scenarioRow(req.params.id);
    if (!["Draft", "Proposed"].includes(s.status)) {
      throw new HttpError(409, `Scenario ${s.id} is ${s.status} — it can no longer be withdrawn`);
    }
    const b = req.body ?? {};
    const out = await audited(req.user,
      { action: "Scenario withdrawn", entity: "scenario", entityId: s.id, detail: s.name,
        before: { status: s.status }, after: { status: "Withdrawn" } },
      async (t) => conflict(await updateVersioned(t, "scenario", s.id, requiredVersion(b, "scenario"),
        { status: "Withdrawn" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── its changes ──────────────────────────────────────────────────── */

/**
 * A change, read from a request and checked against the live book: the
 * project exists and is open, the numbers are in range, and the live
 * row's version (or value) is noted so applying can assert it.
 */
async function readChange(b, { kind, existing = null } = {}) {
  const out = {};
  if (PROJECT_KINDS.has(kind)) {
    const pid = existing ? existing.project_id : String(b.project ?? "");
    const p = await one(`SELECT id, closed, row_version, budget FROM project WHERE id = $1`, [pid]);
    if (!p) bad("That project does not exist");
    if (p.closed) bad(`Project ${p.id} is closed — a scenario moves live work`);
    out.project_id = p.id;
    out.base_version = p.row_version;
  }
  if (kind === "shift" && (b.weeks !== undefined || !existing)) {
    const w = Number(b.weeks);
    if (!Number.isInteger(w) || w === 0 || w < -104 || w > 104) {
      bad("A shift is a whole number of weeks, not zero, between -104 and 104 — positive defers, negative accelerates");
    }
    out.weeks = w;
  }
  if ((kind === "budget" || kind === "envelope") && (b.amount !== undefined || !existing)) {
    const a = Number(b.amount);
    if (b.amount === "" || b.amount === null || !Number.isFinite(a) || a < 0) bad("The amount is a number of millions, zero or more");
    out.amount = fromM(a);
  }
  if (kind === "envelope") {
    const row = await one(`SELECT value FROM app_setting WHERE key = 'capexEnvelope'`);
    let v = 0;
    try { v = Number(typeof row?.value === "string" ? JSON.parse(row.value) : row?.value ?? 0) || 0; } catch { v = 0; }
    out.base_value = fromM(v);
  }
  if (kind === "weight") {
    const input = existing ? existing.weight_input : b.input;
    if (!WEIGHT_INPUTS.includes(input)) bad("A weight change names one input: " + WEIGHT_INPUTS.join(", "));
    out.weight_input = input;
    if (b.weight !== undefined || !existing) {
      const w = Number(b.weight);
      if (!Number.isInteger(w) || w < 0 || w > 100) bad("A weight is a whole number from 0 to 100");
      out.weight = w;
    }
    const wr = await one(`SELECT row_version FROM prioritisation_weighting WHERE id = 'default'`);
    if (!wr) bad("No weighting row — the book is not migrated");
    out.base_version = wr.row_version;
  }
  if (b.note !== undefined) out.note = String(b.note ?? "").slice(0, 1000);
  return out;
}

r.post("/scenarios/:id/changes", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const s = await scenarioRow(req.params.id);
    assertDraft(s);
    const b = req.body ?? {};
    if (!CHANGE_KINDS.includes(b.kind)) bad("A change is one of: " + CHANGE_KINDS.join(", "));
    const c = await readChange(b, { kind: b.kind });

    /* One change per lever: two shifts of the same project in one
       scenario is one shift written twice, and a cancelled project has
       nothing left to shift or re-budget. */
    const held = await many(`SELECT kind, project_id, weight_input FROM scenario_change WHERE scenario_id = $1`, [s.id]);
    if (held.some((x) => x.kind === b.kind && (x.project_id ?? null) === (c.project_id ?? null) &&
        (x.weight_input ?? null) === (c.weight_input ?? null))) {
      throw new HttpError(409, "This scenario already carries that change — correct it rather than adding a second");
    }
    if (c.project_id && held.some((x) => x.project_id === c.project_id && (x.kind === "cancel" || b.kind === "cancel"))) {
      throw new HttpError(409, `Project ${c.project_id} is cancelled in this scenario, or would be — a cancelled project has nothing left to move`);
    }

    let id = null;
    await audited(req.user,
      () => ({ action: "Scenario change added", entity: "scenario_change", entityId: id,
               detail: `${s.id} · ${b.kind}${c.project_id ? " " + c.project_id : ""}` }),
      async (t) => {
        id = await allocateId(t, "SCC", { pad: 3 });
        await t.query(
          `INSERT INTO scenario_change (id, scenario_id, seq, kind, project_id, weeks, amount,
                                        weight_input, weight, base_version, base_value, note)
           VALUES ($1,$2,(SELECT COALESCE(MAX(seq), -1) + 1 FROM scenario_change WHERE scenario_id = $2),
                   $3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, s.id, b.kind, c.project_id ?? null, c.weeks ?? null, c.amount ?? null,
           c.weight_input ?? null, c.weight ?? null, c.base_version ?? null, c.base_value ?? null,
           c.note ?? ""]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/scenario-changes/:id", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const row = await one(`SELECT * FROM scenario_change WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such scenario change");
    assertDraft(await scenarioRow(row.scenario_id));
    const b = req.body ?? {};
    const c = await readChange(b, { kind: row.kind, existing: row });
    delete c.project_id;
    delete c.weight_input;
    const out = await audited(req.user,
      { action: "Scenario change updated", entity: "scenario_change", entityId: row.id,
        detail: `${row.scenario_id} · ${row.kind}${row.project_id ? " " + row.project_id : ""}`,
        before: scenarioChangeOut(row) },
      async (t) => conflict(await updateVersioned(t, "scenario_change", row.id,
        requiredVersion(b, "scenario change"), c), "this change"));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/scenario-changes/:id", async (req, res, next) => {
  try {
    gate(req.user, "scenario.write");
    const row = await one(`SELECT * FROM scenario_change WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such scenario change");
    assertDraft(await scenarioRow(row.scenario_id));
    await audited(req.user,
      { action: "Scenario change removed", entity: "scenario_change", entityId: row.id,
        detail: `${row.scenario_id} · ${row.kind}${row.project_id ? " " + row.project_id : ""}`,
        before: scenarioChangeOut(row) },
      async (t) => t.query(`DELETE FROM scenario_change WHERE id = $1`, [row.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── the promotion ────────────────────────────────────────────────── */

/* The live columns each mutation of the plan writes. Money arrives in
   millions from the plan and is stored in exact units, as everywhere. */
const COLUMNS = {
  project: { start: "start_date", finish: "finish_date", budget: "budget" },
  activity: { start: "start_date", end: "end_date" },
  milestone: { date: "due_date" },
  allocation: { from: "from_date", to: "to_date" },
  benefit: { realiseOn: "realise_on", status: "status" },
  weighting: { value: "w_value", confidence: "w_confidence", exposure: "w_exposure", capacity: "w_capacity" },
};
const TABLE = {
  project: "project", activity: "activity", milestone: "milestone",
  allocation: "allocation", benefit: "benefit", weighting: "prioritisation_weighting",
};
const MONEY = new Set(["budget"]);
const liveId = (entity, id) => (entity === "allocation" ? Number(id) : id);

r.post("/scenarios/:id/apply", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const s = await scenarioRow(req.params.id);
    const version = requiredVersion(b, "scenario");

    /* Everything the transaction needs is read before it opens (PGlite is
       one connection: a read from inside a transaction through the module
       helpers waits for the transaction that waits for it). */
    const book = await bookFor(req.user);
    const [scen] = await loadScenarios(book.db, { id: s.id });
    const decisions = await decisionsFor([s.id]);
    const decision = decisions.find((d) => d.status === "Ratified") ?? decisions[0] ?? null;
    const author = s.created_by
      ? await one(`SELECT person_id FROM app_user WHERE id = $1`, [s.created_by]) : null;
    const projectRows = new Map((await many(
      `SELECT id, programme_id, site_id, governance_level, closed, origin, row_version FROM project WHERE id = ANY($1)`,
      [[...new Set(scen.changes.map((c) => c.project).filter(Boolean))]])).map((p) => [p.id, p]));

    const verdict = canApplyScenario(req.user, {
      decision: decision && {
        id: decision.id, status: decision.status, decidedBy: decision.decided_by ?? null,
        ratifiedBy: decision.ratified_by || null,
      },
      recorderPerson: decision?.recorder_person ?? null,
      authorPerson: author?.person_id ?? null,
      changes: scen.changes.map((c) => ({ id: c.id, kind: c.kind, project: projectRows.get(c.project) ?? null })),
    });
    if (!verdict.ok) throw new HttpError(verdict.code ?? 403, verdict.why);
    if (s.status !== "Proposed") {
      throw new HttpError(409, `Scenario ${s.id} is ${s.status} — only a scenario frozen for its decision is applied`);
    }
    if (s.row_version !== version) conflict({ ok: false });

    /* The versions the scenario was written against. A live row that has
       moved since is not overwritten: the decision ratified a change to
       the book as it WAS, and the room has to see what changed first. */
    const envelopeNow = Number(book.db.settings?.capexEnvelope ?? 0);
    for (const c of scen.changes) {
      if (c.project) {
        const p = projectRows.get(c.project);
        if (!p) throw new HttpError(409, `Project ${c.project} is no longer in the book — change ${c.id} cannot be applied`);
        if (p.closed) throw new HttpError(409, `Project ${c.project} has been closed since change ${c.id} was written`);
        if (c.baseVersion != null && p.row_version !== c.baseVersion) {
          throw new HttpError(409, `Project ${c.project} changed since change ${c.id} was written ` +
            `(version ${c.baseVersion} then, ${p.row_version} now) — draft the scenario again on the book as it is`);
        }
      }
      if (c.kind === "envelope" && c.baseValue != null && Math.round(envelopeNow * M) !== Math.round(c.baseValue * M)) {
        throw new HttpError(409, `The capex envelope changed since change ${c.id} was written ` +
          `(${c.baseValue} then, ${envelopeNow} now) — draft the scenario again on the book as it is`);
      }
      if (c.kind === "weight" && c.baseVersion != null && book.weighting?.version !== c.baseVersion) {
        throw new HttpError(409, `The ranking weighting changed since change ${c.id} was written ` +
          `(version ${c.baseVersion} then, ${book.weighting?.version} now) — draft the scenario again on the book as it is`);
      }
    }

    const cmp = compareScenario(book, scen.changes);
    const changeById = new Map(scen.changes.map((c) => [c.id, c]));
    const issue = cmp.plan.find((p) => p.issue);
    if (issue) throw new HttpError(409, `Change ${issue.change} cannot be applied (${issue.issue})`);
    const today = new Date().toISOString().slice(0, 10);
    const label = `scenario ${s.id} · decision ${decision.id}`;

    let applied = 0;
    const out = await tx(async (t) => {
      const bumped = new Map();
      for (const step of cmp.plan) {
        if (!step.mutations.length) continue;
        for (const m of step.mutations) {
          const key = m.entity + ":" + m.id;
          if (m.entity === "setting") {
            await t.query(
              `INSERT INTO app_setting (key, value, updated_at) VALUES ($1,$2,now())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
              [m.id, JSON.stringify(m.set.value)]);
            continue;
          }
          const v = bumped.get(key) ?? m.version;
          if (m.remove) {
            const del = await t.query(`DELETE FROM ${TABLE[m.entity]} WHERE id = $1 AND row_version = $2 RETURNING id`,
              [liveId(m.entity, m.id), v]);
            if (!(del.rows ?? []).length) throw new HttpError(409, `${m.entity} ${m.id} changed since the comparison was read — reload and apply again`);
            continue;
          }
          const patch = {};
          for (const [k, val] of Object.entries(m.set)) {
            patch[COLUMNS[m.entity][k]] = MONEY.has(k) ? fromM(val) : val;
          }
          /* A weighting says who set it and why (REQ-24): here, the
             person applying, under the decision that ratified it. */
          if (m.entity === "weighting") {
            Object.assign(patch, { note: `Set by ${label}`, set_by: req.user.id,
              set_label: `${req.user.displayName} (${req.user.role})`, set_on: today });
          }
          const res1 = await updateVersioned(t, TABLE[m.entity], liveId(m.entity, m.id), v, patch);
          if (!res1.ok) throw new HttpError(409, `${m.entity} ${m.id} changed since the comparison was read — reload and apply again`);
          bumped.set(key, res1.version);
        }
        /* One audit row per change, on the live entity it changed, with
           the before and after of every row it touched. */
        const c = changeById.get(step.change) ?? { kind: step.kind };
        const entity = c.project ? "project" : c.kind === "weight" ? "prioritisation_weighting" : "app_setting";
        const entityId = c.project ?? (c.kind === "weight" ? "default" : "capexEnvelope");
        await record(t, req.user, {
          action: "Scenario change applied", entity, entityId,
          detail: `${c.kind}${c.project ? " " + c.project : ""}${c.weeks ? " " + (c.weeks > 0 ? "+" : "") + c.weeks + " wk" : ""} — ${label}`,
          before: step.mutations.map((m) => ({ entity: m.entity, id: m.id, ...(m.remove ? { removed: m.before } : m.before) })),
          after: step.mutations.map((m) => ({ entity: m.entity, id: m.id, ...(m.remove ? { removed: true } : m.set) })),
        });
        applied++;
      }
      const done = conflict(await updateVersioned(t, "scenario", s.id, version,
        { status: "Applied", applied_by: req.user.id, applied_on: today }));
      await record(t, req.user, { action: "Scenario applied", entity: "scenario", entityId: s.id,
        detail: `${s.name} — ${applied} change(s) under decision ${decision.id}`,
        before: { status: "Proposed" }, after: { status: "Applied", decision: decision.id } });
      return done;
    });
    res.json({ ok: true, version: out.version, applied, decision: decision.id });
  } catch (e) { next(e); }
});

export default r;

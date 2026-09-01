/**
 * Portfolio routes.
 *
 * The pattern, everywhere: resolve the resource → ask rbac.can → mutate
 * inside a transaction that also writes the audit row → return the fresh
 * row version. There is no route that skips a step, which is what makes
 * "is this action authorised?" a question with one answer rather than
 * twelve (AD-2, AD-4).
 */

import crypto from "node:crypto";
import { Router } from "express";
import { many, one, tx, updateVersioned, allocateId, insertMany, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited, readAudit, record } from "../audit.js";
import { HttpError } from "../auth.js";
import { loadPortfolio, projectFor, fromM, toM, loadSettings } from "../portfolio.js";
import { adoptionBySite } from "../adoption.js";
import { Engine, GATES, PHASES, LESSON_CATEGORIES, iso, addDays, days, D } from "../../../shared/engine.js";
import { scaffoldProject, reschedule, phaseFor } from "../wbs.js";


const r = Router();

/* ── helpers ──────────────────────────────────────────────────────── */

const bad = (msg) => { throw new HttpError(400, msg); };

/**
 * Resolve a project the caller is entitled to see.
 *
 * Visibility is checked here rather than left to the authority gate,
 * because the two failures must not be distinguishable from outside: a
 * project outside your scope answers 404 exactly as a project that does
 * not exist does. Answering 403 would confirm the project is real, which
 * is a disclosure in itself (B2's condition).
 */
async function project(id, user) {
  const p = await projectFor(id);
  if (!p) throw new HttpError(404, "No such project");
  if (user && !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
  return v;
}
function visible(user, p) {
  if (!canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
/** AD-6 — a version mismatch is a 409 the client resolves by re-reading. */
function conflict(result) {
  if (!result.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return result;
}
/**
 * ADR-8 — rows synchronised from SDP are read-only here. Two authorships
 * of the same number is how a portfolio lies, so the refusal names where
 * the truth is edited instead of failing silently.
 */
function assertLocalOrigin(row, what) {
  if (row?.origin === "sdp") {
    throw new HttpError(403,
      `This ${what} is synchronised from the SDP roadmap — it is edited there, not in Meridian`);
  }
}
/* S-05 — a number, or the refusal to pretend one was given. NaN and
   Infinity are valid `numeric` literals in PostgreSQL, and NaN compares
   GREATER than everything, so `CHECK (budget >= 0)` waves it straight
   through — after which every derived figure on that project (SPI, CPI,
   EAC, the RAG, the published period) is NaN, silently and for good. */
const num = (v, fallback = 0) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) bad("That is not a number");
  return n;
};
/* Identifiers are allocated by allocateId() inside the writing
   transaction. The read-then-compute helper that used to live here was a
   race behind any connection pool — see migration 004. */

/* ── the whole book, scoped ───────────────────────────────────────── */

r.get("/bootstrap", async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    /* N-05 — le compteur du centre. Une seule ligne, sur MA boîte : pas
       une lecture du livre, et rien qui dépende d'un périmètre. */
    const unread = await many(
      `SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]);
    res.json({
      db,
      me: {
        id: req.user.id, name: req.user.displayName, role: req.user.role,
        personId: req.user.personId,
        actingFor: req.user.actingForUserId ?? null,
        actingForPersonId: req.user.actingForPersonId ?? null,
        locale: req.user.locale ?? "", notifyPref: req.user.notifyPref ?? "immediate",
        unread: unread[0]?.n ?? 0,
        /* A-11 — le client dessine un bandeau permanent quand ceci est
           vrai : personne ne doit confondre un exercice avec le livre. */
        training: process.env.MERIDIAN_TRAINING === "1" || undefined,
        grants: {
          programmes: [...req.user.grants.programmes],
          sites: [...req.user.grants.sites],
        },
      },
    });
  } catch (e) { next(e); }
});

/* R-08 — the partial refresh behind the end of full reloads. The client
   asks for just the collections a write touched; the server rebuilds the
   book (cheap at portfolio scale — the cost was always the WIRE) and
   answers only those keys. The invariant survives intact: everything on
   screen is still what the server agreed to, because this IS the
   serialiser's output, merely trimmed. */
r.get("/collections", async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    const keys = String(req.query.keys ?? "").split(",").map((k) => k.trim()).filter(Boolean);
    const out = { statusDate: db.statusDate };
    for (const k of keys) {
      if (Array.isArray(db[k])) out[k] = db[k];
    }
    res.json({ collections: out });
  } catch (e) { next(e); }
});

/* ── projects ─────────────────────────────────────────────────────── */

r.post("/projects", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.name) bad("A project needs a name");
    if (!b.programme || !b.site) bad("A project needs a programme and a site");
    const level = b.governanceLevel === "group" ? "group" : "site";
    gate(req.user, "project.create", {
      programme_id: b.programme, site_id: b.site, governance_level: level,
    });

    if (!b.start || !b.finish) bad("A project needs a start and a finish date");
    if (D(b.finish) < D(b.start)) bad("A project cannot finish before it starts");

    let id = null;
    await audited(req.user,
      () => ({ action: "Project created", entity: "project", entityId: id, detail: b.name }),
      async (t) => {
        id = await allocateId(t, "PRJ", { step: 3 });
        const project = {
          id, name: b.name, programme: b.programme, site: b.site,
          pm: b.pm ?? null, method: b.method ?? "Hybrid",
          start: b.start, finish: b.finish,
        };
        await t.query(
          `INSERT INTO project
             (id, name, programme_id, site_id, governance_level, pm_id, method,
              start_date, finish_date, baseline_finish, budget, contingency,
              description, phase)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Initiation')`,
          [id, b.name, b.programme, b.site, level, b.pm ?? null, b.method ?? "Hybrid",
           b.start, b.finish, b.baselineFinish ?? b.finish,
           fromM(num(b.budget)), fromM(num(b.contingency)), b.desc ?? ""]
        );
        /* The schedule, the four gates, their evidence and the project
           manager's own allocation come with the project. A bare project
           row is not something anyone can run (A3). */
        await scaffoldProject(t, project);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/projects/:id", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.write", { project: p });
    assertLocalOrigin(p, "project");
    const b = req.body ?? {};

    /* A site lead may not quietly promote their project to group level —
       that would be granting themselves authority (R1.6). */
    if (b.governanceLevel && b.governanceLevel !== p.governance_level) {
      gate(req.user, "project.create", {
        programme_id: b.programme ?? p.programme_id,
        site_id: b.site ?? p.site_id,
        governance_level: b.governanceLevel,
      });
    }
    /* Moving a project between programmes or sites is a portfolio-
       structure act, not an edit (governance committee, G2): authority
       over the CURRENT slate says nothing about the DESTINATION. Same
       both-ends rule the cross-dependency routes already apply. */
    if ((b.programme !== undefined && b.programme !== p.programme_id) ||
        (b.site !== undefined && b.site !== p.site_id)) {
      gate(req.user, "project.create", {
        programme_id: b.programme ?? p.programme_id,
        site_id: b.site ?? p.site_id,
        governance_level: b.governanceLevel ?? p.governance_level,
      });
    }

    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.pm !== undefined) patch.pm_id = b.pm || null;
    if (b.method !== undefined) patch.method = b.method;
    if (b.start !== undefined) patch.start_date = b.start;
    if (b.finish !== undefined) patch.finish_date = b.finish;
    if (b.desc !== undefined) patch.description = b.desc;
    if (b.budget !== undefined) patch.budget = fromM(num(b.budget));
    if (b.contingency !== undefined) patch.contingency = fromM(num(b.contingency));
    if (b.governanceLevel !== undefined) patch.governance_level = b.governanceLevel;
    if (b.programme !== undefined) patch.programme_id = b.programme;
    if (b.site !== undefined) patch.site_id = b.site;

    /* Moving the window re-stretches the activities but leaves the
       baseline alone: re-planning is not re-baselining, and merging the
       two is how a portfolio loses its variance (A1). */
    const shifted = (b.start && b.start !== p.start_date) || (b.finish && b.finish !== p.finish_date);

    /* Read the status date BEFORE opening the transaction.
       PGlite is a single connection behind a serialising queue: a query
       issued from inside a transaction through the module-level helpers
       waits for the queue, while the queue waits for the transaction to
       finish. That is a deadlock, and it hangs the request forever
       rather than failing — so every value a transaction needs is
       fetched ahead of it. */
    const statusToday = shifted
      ? (await loadSettings()).statusDate ?? iso(new Date())
      : null;

    /* The most consequential governance events in the model get their
       own named, imaged audit rows (committee I2/G4) — "Project updated"
       with a free-text detail is not an answer to "who moved what". */
    const govChanged = b.governanceLevel !== undefined && b.governanceLevel !== p.governance_level;
    const moved = (b.programme !== undefined && b.programme !== p.programme_id) ||
                  (b.site !== undefined && b.site !== p.site_id);
    /* One PATCH can do both. The images and the detail therefore carry
       every structural change in the request — naming only the first of
       them is how "who moved what" loses the move. */
    const before = {};
    const after = {};
    const said = [];
    if (govChanged) {
      before.governance_level = p.governance_level;
      after.governance_level = b.governanceLevel;
      said.push(`${p.governance_level} → ${b.governanceLevel}`);
    }
    if (moved) {
      const toProgramme = b.programme ?? p.programme_id;
      const toSite = b.site ?? p.site_id;
      Object.assign(before, { programme_id: p.programme_id, site_id: p.site_id });
      Object.assign(after, { programme_id: toProgramme, site_id: toSite });
      said.push(`${p.programme_id}/${p.site_id} → ${toProgramme}/${toSite}`);
    }
    const auditEvent = govChanged || moved
      ? { action: govChanged ? "Governance level changed" : "Project moved",
          entity: "project", entityId: p.id, detail: said.join(" · "), before, after }
      : { action: "Project updated", entity: "project", entityId: p.id, detail: b.name ?? p.id };

    const out = await audited(req.user,
      auditEvent,
      async (t) => {
        const rv = conflict(await updateVersioned(t, "project", p.id, requiredVersion(b, "project"), patch));
        if (shifted) {
          const fresh = (await t.query(
            `SELECT id, method, start_date, finish_date FROM project WHERE id = $1`, [p.id])).rows[0];
          const acts = (await t.query(
            `SELECT id, stage FROM activity WHERE project_id = $1`, [p.id])).rows;
          const restretched = reschedule({
            id: fresh.id, method: fresh.method,
            start: fresh.start_date, finish: fresh.finish_date,
          }, acts);
          for (const m of restretched) {
            await t.query(
              `UPDATE activity SET start_date = $2, end_date = $3, row_version = row_version + 1
                WHERE id = $1`, [m.id, m.start, m.end]);
          }
          await t.query(`UPDATE project SET phase = $2 WHERE id = $1`, [
            p.id,
            phaseFor({ start: fresh.start_date, finish: fresh.finish_date }, statusToday),
          ]);
        }
        return rv;
      });
    res.json({ version: out.version, rescheduled: shifted });
  } catch (e) { next(e); }
});

/** RAG override, with the reason recorded — R3.4. */
r.patch("/projects/:id/health", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.write", { project: p });
    assertLocalOrigin(p, "project");
    const rag = req.body?.rag ?? null;
    if (rag && !["G", "A", "R"].includes(rag)) bad("Status must be G, A or R");
    const why = String(req.body?.why ?? "").slice(0, 500);
    if (rag && !why) bad("An override needs a reason — the committee has to be able to read it back");

    const out = await audited(req.user,
      { action: rag ? "Project status overridden" : "Project status returned to automatic",
        entity: "project", entityId: p.id, detail: rag ? `${rag} — ${why}` : "" },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(req.body, "status"),
        { health_override: rag, health_override_why: rag ? why : "" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/** Phase advance, subject to gate locking — R3.5. */
r.patch("/projects/:id/phase", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.gate", { project: p });
    assertLocalOrigin(p, "project");
    const db = await loadPortfolio(req.user);
    const advance = Engine.canAdvance(db, p.id);
    if (!advance.ok && !req.body?.override) throw new HttpError(409, advance.reason);
    /* A gate override is a governance exception, and exceptions carry a
       reason the committee can read back (I2) — same rule the RAG
       override has always enforced. */
    const overrideWhy = String(req.body?.overrideWhy ?? "").slice(0, 500);
    if (!advance.ok && req.body?.override) {
      gate(req.user, "project.baseline", { project: p });
      if (!overrideWhy) bad("A gate override needs a reason — the committee has to be able to read it back");
    }

    const current = db.projects.find((x) => x.id === p.id);
    const i = PHASES.indexOf(current.phase);
    const next = PHASES[Math.min(i + 1, PHASES.length - 1)];

    /* PM-08 — clore, ce sont trois signatures, pas un booléen. Sans
       exploitant nommé, le jour où ça tombe en panne c'est l'équipe
       dissoute qu'on appelle ; sans propriétaire de bénéfice, « les
       bénéfices restent au projet » veut dire « à personne ». */
    let closure = {};
    if (next === "Closed") {
      const b = req.body ?? {};
      if (!b.opsAcceptedBy) bad("Closing needs the named operations owner who takes this over");
      if (!b.benefitsTo) bad("Closing needs the named benefits owner — benefits realise AFTER closure");
      const people = await many(
        `SELECT id FROM person WHERE id = ANY($1) AND active`, [[b.opsAcceptedBy, b.benefitsTo]]);
      const found = new Set(people.map((x) => x.id));
      if (!found.has(b.opsAcceptedBy)) bad("The operations owner must be an active person in the directory");
      if (!found.has(b.benefitsTo)) bad("The benefits owner must be an active person in the directory");
      closure = {
        ops_accepted_by: b.opsAcceptedBy, benefits_owner_id: b.benefitsTo,
        closure_note: String(b.closureNote ?? "").slice(0, 2000),
        closed_on: iso(new Date()),
      };
    }

    const overridden = !advance.ok && !!req.body?.override;
    const out = await audited(req.user,
      overridden
        ? { action: "Gate overridden", entity: "project", entityId: p.id,
            detail: `${current.phase} → ${next} — ${overrideWhy}`,
            before: { phase: current.phase, blocked: advance.reason },
            after: { phase: next } }
        : { action: "Phase advanced", entity: "project", entityId: p.id,
            detail: `${current.phase} → ${next}` },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(req.body, "phase"),
        { phase: next, closed: next === "Closed", ...closure })));
    res.json({ version: out.version, phase: next });
  } catch (e) { next(e); }
});

/** Re-baseline: group authority only (GROUP_ONLY_WRITES). */
r.patch("/projects/:id/baseline", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.baseline", { project: p });
    assertLocalOrigin(p, "project");
    const finish = req.body?.baselineFinish;
    if (!finish) bad("A re-baseline needs a new baseline finish date");

    const out = await audited(req.user,
      { action: "Project re-baselined", entity: "project", entityId: p.id,
        detail: `baseline finish → ${finish}`, before: { baseline: p.baseline_finish } },
      async (t) => {
        const rv = conflict(await updateVersioned(t, "project", p.id,
          requiredVersion(req.body, "baseline"), { baseline_finish: finish }));
        if (req.body?.rebaseActivities) {
          await t.query(
            `UPDATE activity SET base_start = start_date, base_end = end_date,
                    row_version = row_version + 1
              WHERE project_id = $1`, [p.id]);
        }
        return rv;
      });
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── schedule ─────────────────────────────────────────────────────── */

r.patch("/activities/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM activity WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such activity");
    const p = await project(a.project_id, req.user);
    gate(req.user, "schedule.write", { project: p });
    assertLocalOrigin(a, "stage");
    const b = req.body ?? {};

    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.start !== undefined) patch.start_date = b.start;
    if (b.end !== undefined) patch.end_date = b.end;
    if (b.pct !== undefined) patch.pct = Math.max(0, Math.min(100, Math.round(num(b.pct))));
    if (b.owner !== undefined) patch.owner_id = b.owner || null;

    const out = await audited(req.user,
      { action: "Activity updated", entity: "activity", entityId: a.id, detail: b.name ?? a.name },
      async (t) => conflict(await updateVersioned(t, "activity", a.id, requiredVersion(b, "stage"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.post("/milestones", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "schedule.write", { project: p });
    if (!b.name || !b.date) bad("A milestone needs a name and a date");
    /* V-03 — a cutover dated into the site's freeze is refused here, at
       the moment someone plans it, rather than discovered by the plant. */
    const full = await one(
      `SELECT site_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
    await assertPlantWindow(full, { date: b.date, intrusive: !!b.intrusive });

    let id = null;
    await audited(req.user,
      () => ({ action: "Milestone added", entity: "milestone", entityId: id, detail: b.name }),
      async (t) => {
        const n = await allocateId(t, "MS");
        id = p.id + "-M" + n.split("-")[1];
        return t.query(
          `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, intrusive)
           VALUES ($1,$2,$3,$4,$4,NULL,'milestone',$5,$6)`,
          [id, p.id, b.name, b.date, b.owner ?? p.pm_id ?? null, !!b.intrusive]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/milestones/:id", async (req, res, next) => {
  try {
    const m = await one(`SELECT * FROM milestone WHERE id = $1`, [req.params.id]);
    if (!m) throw new HttpError(404, "No such milestone");
    const p = await project(m.project_id, req.user);
    gate(req.user, "schedule.write", { project: p });
    assertLocalOrigin(m, "milestone");
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.date !== undefined) patch.due_date = b.date;
    /* PM-04 — les critères se posent d'avance ; l'acceptation nomme qui
       a constaté qu'ils sont tenus. */
    if (b.acceptanceCriteria !== undefined) patch.acceptance_criteria = b.acceptanceCriteria;
    if (b.done !== undefined) {
      patch.done = !!b.done;
      const criteria = b.acceptanceCriteria !== undefined
        ? b.acceptanceCriteria : m.acceptance_criteria;
      if (patch.done && String(criteria ?? "").trim()) {
        if (!b.acceptedBy) {
          bad("This milestone has acceptance criteria — done needs the named person who checked them");
        }
        const who = await one(`SELECT id FROM person WHERE id = $1 AND active`, [b.acceptedBy]);
        if (!who) bad("The accepter must be an active person in the directory");
        patch.accepted_by = b.acceptedBy;
        patch.accepted_on = iso(new Date());
      }
      if (!patch.done) { patch.accepted_by = null; patch.accepted_on = null; }
    }
    if (b.owner !== undefined) patch.owner_id = b.owner || null;
    if (b.intrusive !== undefined) patch.intrusive = !!b.intrusive;
    /* Moving a cutover, or newly marking one as intrusive, asks the same
       freeze question the original planning did. */
    const wantsIntrusive = b.intrusive === undefined ? m.intrusive : !!b.intrusive;
    if (wantsIntrusive && (b.date !== undefined || b.intrusive !== undefined)) {
      const full = await one(
        `SELECT site_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
      await assertPlantWindow(full, { date: b.date ?? m.due_date, intrusive: true });
    }

    const out = await audited(req.user,
      { action: "Milestone updated", entity: "milestone", entityId: m.id, detail: b.name ?? m.name },
      async (t) => conflict(await updateVersioned(t, "milestone", m.id, requiredVersion(b, "milestone"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── cost ledger — group authority only (A5's condition) ──────────── */

r.post("/cost", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "cost.write", { project: p });
    assertLocalOrigin(p, "project"); // no ledger on budget-less strategy mirrors (ADR-10)
    const amount = num(b.amount);
    if (!amount) bad("A cost line needs an amount");
    const period = b.period ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) bad("Period must be YYYY-MM");

    if (b.fromContingency) gate(req.user, "contingency.release", { project: p });

    /* PM-06 — la provision est, comptablement, la somme des risques qu'on
       a accepté de porter. Un tirage nomme donc le risque qu'il finance,
       DÈS QU'il y a un risque ouvert à nommer : on ne bloque pas le
       projet sans registre, on bloque le tirage qui refuse de dire son
       nom quand il le pourrait. */
    let riskId = null;
    if (b.fromContingency) {
      const openRisks = await many(
        `SELECT id, title FROM raid_item
          WHERE project_id = $1 AND kind = 'Risk' AND status = 'Open'`, [p.id]);
      if (b.risk) {
        const hit = openRisks.find((r) => r.id === b.risk);
        if (!hit) bad("That risk is not an open risk on this project");
        riskId = hit.id;
      } else if (openRisks.length) {
        bad("A contingency draw names the risk it answers — this project has " +
            openRisks.length + " open risk(s) to choose from");
      }
    }

    await audited(req.user,
      { action: b.fromContingency ? "Contingency released" : "Cost booked",
        entity: "project", entityId: p.id,
        detail: `${amount >= 0 ? "+" : ""}${amount}M in ${period}${b.note ? " — " + b.note : ""}` },
      async (t) => {
        await t.query(
          `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note,
                                  from_contingency, created_by, kind, currency, fx_rate, amount_local, risk_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [p.id, period, b.date ?? period + "-01", fromM(amount),
           b.category ?? "Labour", b.note ?? "", !!b.fromContingency, req.user.id,
           /* V-05 — capex or opex, and the currency it was actually spent
              in with the rate AS BOOKED. A ledger that revalues its own
              history cannot be reconciled to anything. */
           b.kind === "opex" ? "opex" : "capex",
           (b.currency || "USD").toUpperCase(), num(b.fx, 1),
           b.amountLocal === undefined || b.amountLocal === "" ? null : fromM(num(b.amountLocal)),
           riskId]);
        if (b.fromContingency) {
          const row = await t.query(
            `SELECT contingency, contingency_used FROM project WHERE id = $1`, [p.id]);
          const { contingency, contingency_used } = row.rows[0];
          const next = Number(contingency_used) + fromM(Math.abs(amount));
          if (next > Number(contingency)) {
            throw new HttpError(409, "That would draw more than the contingency held on this project");
          }
          await t.query(
            `UPDATE project SET contingency_used = $2, row_version = row_version + 1 WHERE id = $1`,
            [p.id, next]);
        }
      });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * Correct a mis-posting.
 *
 * The ledger is append-only on purpose — A5's condition was that actual
 * cost always reconciles to the sum of the postings. That rule was
 * enforced without ever building the remedy, so a fat-fingered figure
 * was permanent. It is corrected the way a ledger has always been
 * corrected: with an equal and opposite entry that names what it
 * reverses. Both lines stay visible.
 */
r.post("/cost/:id/reverse", async (req, res, next) => {
  try {
    const line = await one(`SELECT * FROM cost_line WHERE id = $1`, [Number(req.params.id)]);
    if (!line) throw new HttpError(404, "No such posting");
    const p = await project(line.project_id, req.user);
    gate(req.user, "cost.write", { project: p });
    if (line.from_contingency) gate(req.user, "contingency.release", { project: p });
    if (/^Reversal of #/.test(line.note)) {
      throw new HttpError(409, "That posting is itself a reversal");
    }
    /* The reversal's note carries the reason after the reference, so this
       matches on the reference prefix rather than the whole string. */
    const already = await one(
      `SELECT id FROM cost_line WHERE project_id = $1 AND note LIKE $2`,
      [line.project_id, `Reversal of #${line.id}%`]);
    if (already) throw new HttpError(409, "That posting has already been reversed");

    const reason = String(req.body?.reason ?? "").slice(0, 300);
    await audited(req.user,
      { action: "Cost posting reversed", entity: "project", entityId: p.id,
        detail: `#${line.id} · ${Number(line.amount) / 1_000_000}M${reason ? " — " + reason : ""}` },
      async (t) => {
        await t.query(
          `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note,
                                  from_contingency, created_by)
           VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7)`,
          [line.project_id, line.period, -Number(line.amount), line.category,
           `Reversal of #${line.id}${reason ? " — " + reason : ""}`,
           line.from_contingency, req.user.id]);
        if (line.from_contingency) {
          const row = (await t.query(
            `SELECT contingency_used FROM project WHERE id = $1`, [p.id])).rows[0];
          await t.query(
            `UPDATE project SET contingency_used = GREATEST(0, $2), row_version = row_version + 1
              WHERE id = $1`,
            [p.id, Number(row.contingency_used) - Math.abs(Number(line.amount))]);
        }
      });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/* ── schedule: adding and removing a stage ────────────────────────── */

r.post("/activities", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "schedule.write", { project: p });
    // The synthetic weight-1.0 progress stage must stay alone (ADR-7).
    assertLocalOrigin(p, "project");
    if (!b.name) bad("A stage needs a name");
    if (!b.start || !b.end) bad("A stage needs a start and an end date");
    if (D(b.end) < D(b.start)) bad("A stage cannot end before it starts");

    const siblings = await many(
      `SELECT id, stage, weight FROM activity WHERE project_id = $1 ORDER BY stage`, [p.id]);
    const seq = siblings.length ? Math.max(...siblings.map((a) => a.stage)) + 1 : 0;
    const id = `${p.id}-A${seq + 1}`;
    if (siblings.some((a) => a.id === id)) bad("A stage with that identifier already exists");

    /* Weights are shares of the budget and must still sum to one, so a new
       stage takes its share from the others rather than inflating the
       project's earned value out of nothing. */
    const weight = Math.max(0, Math.min(0.9, num(b.weight, 0.05)));
    const scale = 1 - weight;

    await audited(req.user,
      { action: "Stage added", entity: "activity", entityId: id, detail: b.name },
      async (t) => {
        if (siblings.length) {
          for (const a of siblings) {
            await t.query(
              `UPDATE activity SET weight = $2, row_version = row_version + 1 WHERE id = $1`,
              [a.id, +(Number(a.weight) * scale).toFixed(4)]);
          }
        }
        await t.query(
          `INSERT INTO activity (id, project_id, name, stage, start_date, end_date,
                                 base_start, base_end, weight, pct, owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$5,$6,$7,0,$8)`,
          [id, p.id, b.name, seq, b.start, b.end,
           siblings.length ? weight : 1, b.owner ?? p.pm_id ?? null]);
        for (const dep of Array.isArray(b.deps) ? b.deps : []) {
          await t.query(
            `INSERT INTO activity_dep (activity_id, predecessor_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`, [id, dep]);
        }
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.delete("/activities/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM activity WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such stage");
    const p = await project(a.project_id, req.user);
    gate(req.user, "schedule.write", { project: p });
    assertLocalOrigin(a, "stage");
    if (a.pct > 0) {
      throw new HttpError(409, "That stage has reported progress — set it to 0% first if it really is being removed");
    }
    const rest = await many(
      `SELECT id, weight FROM activity WHERE project_id = $1 AND id <> $2`, [p.id, a.id]);
    const freed = Number(a.weight);
    const total = rest.reduce((n, x) => n + Number(x.weight), 0);

    await audited(req.user,
      { action: "Stage removed", entity: "activity", entityId: a.id,
        detail: a.name, before: { name: a.name, weight: freed } },
      async (t) => {
        await t.query(`DELETE FROM activity WHERE id = $1`, [a.id]);
        // Give the freed weight back proportionally so the shares still sum to one.
        if (total > 0) {
          for (const x of rest) {
            await t.query(
              `UPDATE activity SET weight = $2, row_version = row_version + 1 WHERE id = $1`,
              [x.id, +(Number(x.weight) + freed * (Number(x.weight) / total)).toFixed(4)]);
          }
        }
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/milestones/:id", async (req, res, next) => {
  try {
    const m = await one(`SELECT * FROM milestone WHERE id = $1`, [req.params.id]);
    if (!m) throw new HttpError(404, "No such milestone");
    const p = await project(m.project_id, req.user);
    gate(req.user, "schedule.write", { project: p });
    assertLocalOrigin(m, "milestone");
    if (m.kind === "gate") {
      throw new HttpError(409, "Gates are part of the governance model and cannot be deleted");
    }
    await audited(req.user,
      { action: "Milestone removed", entity: "milestone", entityId: m.id,
        detail: m.name, before: { ...m } },
      async (t) => t.query(`DELETE FROM milestone WHERE id = $1`, [m.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── cross-project dependencies ───────────────────────────────────────
   The thing a group PMO actually spends its week on. Both ends must be
   writable by the caller: a link is a commitment between two projects,
   and one side cannot commit the other. */

r.post("/crossdeps", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const from = await project(b.from, req.user);
    const to = await project(b.to, req.user);
    if (from.id === to.id) bad("A project cannot depend on itself");
    gate(req.user, "schedule.write", { project: from });
    gate(req.user, "schedule.write", { project: to });

    const stages = async (id) => (await many(
      `SELECT stage FROM activity WHERE project_id = $1 ORDER BY stage`, [id])).map((x) => x.stage);
    const fromStages = await stages(from.id);
    const toStages = await stages(to.id);
    const fs = num(b.fromStage, 0), ts = num(b.toStage, 0);
    if (!fromStages.includes(fs)) bad("That stage does not exist on the predecessor");
    if (!toStages.includes(ts)) bad("That stage does not exist on the successor");

    const clash = await one(
      `SELECT id FROM cross_dep WHERE from_project=$1 AND from_stage=$2 AND to_project=$3 AND to_stage=$4`,
      [from.id, fs, to.id, ts]);
    if (clash) throw new HttpError(409, "That link already exists");

    await audited(req.user,
      { action: "Cross-project dependency added", entity: "project", entityId: to.id,
        detail: `${from.id} stage ${fs} → ${to.id} stage ${ts}${b.label ? " · " + b.label : ""}` },
      async (t) => t.query(
        `INSERT INTO cross_dep (from_project, from_stage, to_project, to_stage, label)
         VALUES ($1,$2,$3,$4,$5)`, [from.id, fs, to.id, ts, String(b.label ?? "").slice(0, 120)]));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/crossdeps/:id", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM cross_dep WHERE id = $1`, [Number(req.params.id)]);
    if (!d) throw new HttpError(404, "No such dependency");
    const from = await project(d.from_project, req.user);
    const to = await project(d.to_project, req.user);
    gate(req.user, "schedule.write", { project: from });
    gate(req.user, "schedule.write", { project: to });
    await audited(req.user,
      { action: "Cross-project dependency removed", entity: "project", entityId: to.id,
        detail: `${d.from_project} → ${d.to_project}${d.label ? " · " + d.label : ""}` },
      async (t) => t.query(`DELETE FROM cross_dep WHERE id = $1`, [d.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── RAID ─────────────────────────────────────────────────────────── */

r.post("/raid", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    // A portfolio-wide item (no project) is a group-level act.
    let originSite = null;
    if (b.project) {
      const p = await project(b.project, req.user);
      /* The site concern channel (governance committee): a site lead may
         RAISE against a group programme landing on their site — the one
         legitimate voice they had nowhere to record. It arrives stamped
         with the raising site and flows into the ordinary escalation
         machinery; editing and closing stay with the project's owners. */
      const ordinary = can(req.user, "raid.write", { project: p });
      if (!ordinary.ok) {
        gate(req.user, "concern.raise", { project: p });
        const { sites } = req.user.grants;
        originSite = sites.has(p.site_id) ? p.site_id : null;
      }
    } else {
      if (!["admin", "group"].includes(req.user.role)) {
        throw new HttpError(403, "Portfolio-wide items are raised at group level");
      }
    }
    if (!b.title) bad("An item needs a title");
    const kind = ["Risk", "Issue", "Assumption", "Dependency"].includes(b.type) ? b.type : "Risk";
    const prefix = { Risk: "RSK", Issue: "ISS", Assumption: "ASM", Dependency: "DEP" }[kind];

    let id = null;
    await audited(req.user,
      () => ({ action: originSite ? `Site concern raised (${originSite})` : kind + " raised",
               entity: "raid_item", entityId: id, detail: b.title }),
      async (t) => {
        id = await allocateId(t, prefix, { pad: 2 });
        return t.query(
          `INSERT INTO raid_item
             (id, project_id, kind, title, detail, probability, impact, status, response, owner_id, opened_on, review_on, origin_site,
              target_probability, target_impact)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,CURRENT_DATE,$10,$11,$12,$13)`,
          [id, b.project || null, kind, b.title, b.detail ?? "",
           Math.max(1, Math.min(5, num(b.p, 3))), Math.max(1, Math.min(5, num(b.i, 3))),
           b.response ?? "Monitor", b.owner ?? null, b.review ?? null, originSite,
           /* PM-06 — la cible résiduelle dès la levée, quand elle est connue. */
           b.tp === undefined || b.tp === "" || b.tp === null ? null : Math.max(1, Math.min(5, num(b.tp))),
           b.ti === undefined || b.ti === "" || b.ti === null ? null : Math.max(1, Math.min(5, num(b.ti)))]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/raid/:id", async (req, res, next) => {
  try {
    const item = await one(`SELECT * FROM raid_item WHERE id = $1`, [req.params.id]);
    if (!item) throw new HttpError(404, "No such item");
    if (item.project_id) {
      const p = await project(item.project_id, req.user);
      gate(req.user, "raid.write", { project: p });
    } else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio-wide items are managed at group level");
    }
    const b = req.body ?? {};
    const patch = {};
    if (b.title !== undefined) patch.title = b.title;
    if (b.detail !== undefined) patch.detail = b.detail;
    if (b.p !== undefined) patch.probability = Math.max(1, Math.min(5, num(b.p)));
    if (b.i !== undefined) patch.impact = Math.max(1, Math.min(5, num(b.i)));
    /* PM-06 — la cible résiduelle, sur la même échelle que le constat :
       comparer exige la même règle. Vide = pas de cible, jamais zéro. */
    if (b.tp !== undefined) patch.target_probability =
      b.tp === "" || b.tp === null ? null : Math.max(1, Math.min(5, num(b.tp)));
    if (b.ti !== undefined) patch.target_impact =
      b.ti === "" || b.ti === null ? null : Math.max(1, Math.min(5, num(b.ti)));
    if (b.status !== undefined) patch.status = b.status === "Closed" ? "Closed" : "Open";
    if (b.response !== undefined) patch.response = b.response;
    if (b.owner !== undefined) patch.owner_id = b.owner || null;
    if (b.review !== undefined) patch.review_on = b.review || null;

    const out = await audited(req.user,
      { action: b.status === "Closed" ? "Item closed" : "Item updated",
        entity: "raid_item", entityId: item.id, detail: b.title ?? item.title },
      async (t) => conflict(await updateVersioned(t, "raid_item", item.id, requiredVersion(b, "register item"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/raid/:id", async (req, res, next) => {
  try {
    const item = await one(`SELECT * FROM raid_item WHERE id = $1`, [req.params.id]);
    if (!item) throw new HttpError(404, "No such item");
    if (item.project_id) {
      gate(req.user, "raid.write", { project: await project(item.project_id, req.user) });
    } else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio-wide items are managed at group level");
    }
    await audited(req.user,
      { action: "Item deleted", entity: "raid_item", entityId: item.id,
        detail: item.title, before: { ...item } },
      async (t) => t.query(`DELETE FROM raid_item WHERE id = $1`, [item.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── change control ───────────────────────────────────────────────── */

const CR_STEPS = [
  { role: "Project manager",    note: "Raised and impact-assessed" },
  { role: "Change authority",   note: "PMO review" },
  { role: "Finance",            note: "Funding release" },
  { role: "Steering committee", note: "Final approval" },
];

r.post("/change", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "change.raise", { project: p });
    // A CR moves budget/dates — on an SDP mirror those are SDP's to move.
    assertLocalOrigin(p, "project");
    if (!b.title) bad("A change request needs a title");

    let id = null;
    await audited(req.user,
      () => ({ action: "Change request raised", entity: "change_request", entityId: id, detail: b.title }),
      async (t) => {
        id = await allocateId(t, "CR");
        await t.query(
          `INSERT INTO change_request
             (id, project_id, title, description, raised_by, raised_by_user, raised_on, cost_delta,
              weeks_delta, funding, risk_delta, status)
           VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,$9,$10,'Pending')`,
          /* S-07 — who raised it is recorded, never claimed. Accepting
             b.raisedBy let a caller erase or alias the identity that the
             independence check compares against; the foreign key caught
             it, but a control should not lean on a constraint.
             PR-03 — the ACCOUNT is recorded too: a raiser with no linked
             person left raised_by NULL, and the SoD read NULL as
             "nobody", letting them decide their own request. */
          [id, p.id, b.title, b.desc ?? "", req.user.personId, req.user.id,
           fromM(num(b.cost)), Math.round(num(b.weeks)), b.funding ?? "Contingency",
           b.riskDelta ?? "0"]);
        for (let i = 0; i < CR_STEPS.length; i++) {
          await t.query(
            `INSERT INTO change_step (cr_id, seq, role_label, note, state)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, i, CR_STEPS[i].role, CR_STEPS[i].note, i === 0 ? "current" : "waiting"]);
        }
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/**
 * Edit a change request — only while it is still Pending.
 *
 * Once a step has been signed, the thing people approved has to stay the
 * thing that was approved; a CR whose cost can be edited after Finance
 * signs it is not a control, it is a form. So an edit resets the chain
 * to the first step and says so in the audit trail.
 */
r.patch("/change/:id", async (req, res, next) => {
  try {
    const cr = await one(`SELECT * FROM change_request WHERE id = $1`, [req.params.id]);
    if (!cr) throw new HttpError(404, "No such change request");
    const p = await project(cr.project_id, req.user);
    gate(req.user, "change.raise", { project: p });
    if (cr.status !== "Pending") {
      throw new HttpError(409, "This request has been decided — raise a new one instead");
    }

    const b = req.body ?? {};
    const patch = {};
    if (b.title !== undefined) patch.title = b.title;
    if (b.desc !== undefined) patch.description = b.desc;
    if (b.funding !== undefined) patch.funding = b.funding;
    if (b.riskDelta !== undefined) patch.risk_delta = b.riskDelta;
    if (b.cost !== undefined) patch.cost_delta = fromM(num(b.cost));
    if (b.weeks !== undefined) patch.weeks_delta = Math.round(num(b.weeks));

    /* Changing the magnitude can change who has to sign it (R4.5), so the
       approval chain restarts rather than carrying signatures across. */
    const magnitudeMoved =
      (b.cost !== undefined && fromM(num(b.cost)) !== Number(cr.cost_delta)) ||
      (b.weeks !== undefined && Math.round(num(b.weeks)) !== cr.weeks_delta);
    const signed = await one(
      `SELECT count(*)::int AS n FROM change_step WHERE cr_id = $1 AND state = 'done'`, [cr.id]);
    const resetChain = magnitudeMoved && (signed?.n ?? 0) > 0;

    const out = await audited(req.user,
      { action: "Change request updated", entity: "change_request", entityId: cr.id,
        detail: (b.title ?? cr.title) + (resetChain ? " — magnitude changed, approvals reset" : ""),
        before: { cost: Number(cr.cost_delta), weeks: cr.weeks_delta } },
      async (t) => {
        const rv = conflict(await updateVersioned(t, "change_request", cr.id,
          requiredVersion(b, "change request"), patch));
        if (resetChain) {
          await t.query(
            `UPDATE change_step SET state = CASE WHEN seq = 0 THEN 'current' ELSE 'waiting' END,
                    decided_by = NULL, decided_on = NULL, comment = ''
              WHERE cr_id = $1`, [cr.id]);
        }
        return rv;
      });
    res.json({ version: out.version, approvalsReset: resetChain });
  } catch (e) { next(e); }
});

/** Withdraw a request that has not been decided. */
r.delete("/change/:id", async (req, res, next) => {
  try {
    const cr = await one(`SELECT * FROM change_request WHERE id = $1`, [req.params.id]);
    if (!cr) throw new HttpError(404, "No such change request");
    const p = await project(cr.project_id, req.user);
    gate(req.user, "change.raise", { project: p });
    if (cr.status !== "Pending") {
      throw new HttpError(409, "A decided request stays on the record");
    }
    await audited(req.user,
      { action: "Change request withdrawn", entity: "change_request", entityId: cr.id,
        detail: cr.title, before: { title: cr.title, status: cr.status } },
      async (t) => t.query(`DELETE FROM change_request WHERE id = $1`, [cr.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** R4.5 — magnitude decides the authority, not the org chart alone. */
r.post("/change/:id/approve", async (req, res, next) => {
  try {
    const cr = await one(`SELECT * FROM change_request WHERE id = $1`, [req.params.id]);
    if (!cr) throw new HttpError(404, "No such change request");
    const p = visible(req.user, await project(cr.project_id, req.user));
    if (cr.status !== "Pending") throw new HttpError(409, "This request is already decided");

    const st = await loadSettings();
    gate(req.user, "change.approve", {
      project: p,
      raised_by: cr.raised_by,   // segregation of duties (I1): the raiser never decides
      raised_by_user: cr.raised_by_user, // PR-03: the ACCOUNT too — a person link is optional
      cost_delta: Number(cr.cost_delta) / 1_000_000,
      weeks_delta: cr.weeks_delta,
      threshold: { cost: st.ccbThreshold, weeks: st.ccbWeeks },
    });

    const steps = await many(`SELECT * FROM change_step WHERE cr_id = $1 ORDER BY seq`, [cr.id]);
    const current = steps.find((s) => s.state === "current");
    if (!current) throw new HttpError(409, "This request has no step awaiting a decision");
    const isLast = current.seq === steps.length - 1;

    await audited(req.user,
      { action: isLast ? "Change request approved" : "Change step signed",
        entity: "change_request", entityId: cr.id,
        detail: `${current.role_label}${req.body?.comment ? " — " + req.body.comment : ""}` },
      async (t) => {
        await t.query(
          `UPDATE change_step SET state='done', decided_by=$2, decided_on=CURRENT_DATE, comment=$3
            WHERE id = $1`, [current.id, req.user.id, String(req.body?.comment ?? "").slice(0, 500)]);
        if (!isLast) {
          await t.query(`UPDATE change_step SET state='current' WHERE cr_id=$1 AND seq=$2`,
            [cr.id, current.seq + 1]);
          return;
        }
        await t.query(
          `UPDATE change_request SET status='Approved', applied=true, row_version=row_version+1
            WHERE id=$1`, [cr.id]);

        /* Applying a change is the only place the plan moves without
           someone typing a date: the agreed cost and weeks go straight
           onto the project so the baseline and the decision cannot drift. */
        const proj = (await t.query(
          `SELECT budget, contingency, contingency_used, finish_date FROM project WHERE id=$1`,
          [cr.project_id])).rows[0];
        const patch = [];
        const params = [cr.project_id];
        if (Number(cr.cost_delta) !== 0) {
          if (cr.funding === "Contingency") {
            params.push(Number(proj.contingency_used) + Number(cr.cost_delta));
            patch.push(`contingency_used = $${params.length}`);
          } else {
            params.push(Number(proj.budget) + Number(cr.cost_delta));
            patch.push(`budget = $${params.length}`);
          }
        }
        if (cr.weeks_delta !== 0) {
          params.push(iso(addDays(proj.finish_date, cr.weeks_delta * 7)));
          patch.push(`finish_date = $${params.length}`);
        }
        if (patch.length) {
          await t.query(
            `UPDATE project SET ${patch.join(", ")}, row_version = row_version + 1 WHERE id = $1`,
            params);
        }
      });
    res.json({ ok: true, applied: isLast });
  } catch (e) { next(e); }
});

r.post("/change/:id/reject", async (req, res, next) => {
  try {
    const cr = await one(`SELECT * FROM change_request WHERE id = $1`, [req.params.id]);
    if (!cr) throw new HttpError(404, "No such change request");
    const p = visible(req.user, await project(cr.project_id, req.user));
    if (cr.status !== "Pending") throw new HttpError(409, "This request is already decided");
    const st = await loadSettings();
    gate(req.user, "change.approve", {
      project: p,
      raised_by: cr.raised_by,   // segregation holds for reject too — deciding is deciding
      raised_by_user: cr.raised_by_user, // PR-03: same account check as approve
      cost_delta: Number(cr.cost_delta) / 1_000_000,
      weeks_delta: cr.weeks_delta,
      threshold: { cost: st.ccbThreshold, weeks: st.ccbWeeks },
    });

    await audited(req.user,
      { action: "Change request rejected", entity: "change_request", entityId: cr.id,
        detail: String(req.body?.comment ?? cr.title).slice(0, 500) },
      async (t) => {
        await t.query(`UPDATE change_request SET status='Rejected', row_version=row_version+1 WHERE id=$1`, [cr.id]);
        await t.query(
          `UPDATE change_step SET state='rejected', decided_by=$2, decided_on=CURRENT_DATE, comment=$3
            WHERE cr_id=$1 AND state='current'`,
          [cr.id, req.user.id, String(req.body?.comment ?? "").slice(0, 500)]);
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── resources ────────────────────────────────────────────────────── */

r.post("/allocations", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    const person = await one(`SELECT id, site_id FROM person WHERE id = $1`, [b.person]);
    if (!person) throw new HttpError(404, "No such person");
    gate(req.user, "allocation.write", { project: p, person });
    if (!b.from || !b.to) bad("An allocation needs a start and an end date");

    await audited(req.user,
      { action: "Person allocated", entity: "project", entityId: p.id,
        detail: `${person.id} at ${num(b.pct, 50)}% from ${b.from} to ${b.to}` },
      async (t) => t.query(
        `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct, capitalised)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [person.id, p.id, b.from, b.to, Math.max(0, Math.min(200, Math.round(num(b.pct, 50)))),
         b.capitalised !== false]));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

r.patch("/allocations/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM allocation WHERE id = $1`, [Number(req.params.id)]);
    if (!a) throw new HttpError(404, "No such allocation");
    const p = await project(a.project_id, req.user);
    const person = await one(`SELECT id, site_id FROM person WHERE id = $1`, [a.person_id]);
    gate(req.user, "allocation.write", { project: p, person });
    const b = req.body ?? {};
    const patch = {};
    if (b.from !== undefined) patch.from_date = b.from;
    if (b.to !== undefined) patch.to_date = b.to;
    if (b.pct !== undefined) patch.pct = Math.max(0, Math.min(200, Math.round(num(b.pct))));
    // capitalised effort is not the same money as expensed effort (V-05)
    if (b.capitalised !== undefined) patch.capitalised = b.capitalised !== false;

    const out = await audited(req.user,
      { action: "Allocation updated", entity: "project", entityId: p.id,
        detail: `${a.person_id} → ${b.pct ?? a.pct}%` },
      async (t) => conflict(await updateVersioned(t, "allocation", a.id, requiredVersion(b, "stage"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/allocations/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM allocation WHERE id = $1`, [Number(req.params.id)]);
    if (!a) throw new HttpError(404, "No such allocation");
    const p = await project(a.project_id, req.user);
    const person = await one(`SELECT id, site_id FROM person WHERE id = $1`, [a.person_id]);
    gate(req.user, "allocation.write", { project: p, person });
    await audited(req.user,
      { action: "Allocation removed", entity: "project", entityId: p.id, detail: a.person_id },
      async (t) => t.query(`DELETE FROM allocation WHERE id = $1`, [a.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── commitments: money promised, not yet spent (V-05) ────────────────
   A purchase order is gone from the envelope months before it becomes a
   cost line. Unlike the ledger this is NOT append-only — a PO is amended
   and cancelled in the real world, and a tool that refuses to follow it
   pushes finance back into the spreadsheet it came from. */

const COMMITMENT_STATES = ["Open", "Part received", "Received", "Cancelled"];

r.post("/commitments", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "cost.write", { project: p });
    if (!b.reference) bad("A commitment needs its purchase-order reference");
    const amount = num(b.amount);
    if (!(amount > 0)) bad("A commitment needs an amount");

    let id = null;
    await audited(req.user,
      () => ({ action: "Commitment raised", entity: "commitment", entityId: id,
               detail: `${b.reference} · ${b.supplier ?? ""} · ${amount}M` }),
      async (t) => {
        id = await allocateId(t, "CMT", { pad: 3 });
        return t.query(
          `INSERT INTO commitment (id, project_id, reference, supplier, description,
                                   amount, currency, fx_rate, kind, expected_on, raised_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, p.id, b.reference, b.supplier ?? "", b.description ?? "",
           fromM(amount), (b.currency || "USD").toUpperCase(), num(b.fx, 1),
           b.kind === "opex" ? "opex" : "capex", b.expectedOn || null, req.user.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/commitments/:id", async (req, res, next) => {
  try {
    const c = await one(`SELECT * FROM commitment WHERE id = $1`, [req.params.id]);
    if (!c) throw new HttpError(404, "No such commitment");
    const p = await project(c.project_id, req.user);
    gate(req.user, "cost.write", { project: p });
    const b = req.body ?? {};
    const patch = {};
    if (b.reference !== undefined) patch.reference = b.reference;
    if (b.supplier !== undefined) patch.supplier = b.supplier;
    if (b.description !== undefined) patch.description = b.description;
    if (b.amount !== undefined) patch.amount = fromM(num(b.amount));
    if (b.currency !== undefined) patch.currency = String(b.currency || "USD").toUpperCase();
    if (b.fx !== undefined) patch.fx_rate = num(b.fx, 1);
    if (b.kind !== undefined) patch.kind = b.kind === "opex" ? "opex" : "capex";
    if (b.expectedOn !== undefined) patch.expected_on = b.expectedOn || null;
    if (b.status !== undefined) {
      if (!COMMITMENT_STATES.includes(b.status)) bad("That is not a commitment status");
      patch.status = b.status;
    }

    const out = await audited(req.user,
      { action: b.status === "Cancelled" ? "Commitment cancelled" : "Commitment updated",
        entity: "commitment", entityId: c.id, detail: b.reference ?? c.reference,
        before: { amount: c.amount, status: c.status },
        after: { amount: patch.amount ?? c.amount, status: patch.status ?? c.status } },
      async (t) => conflict(await updateVersioned(t, "commitment", c.id,
        requiredVersion(b, "commitment"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/commitments/:id", async (req, res, next) => {
  try {
    const c = await one(`SELECT * FROM commitment WHERE id = $1`, [req.params.id]);
    if (!c) throw new HttpError(404, "No such commitment");
    gate(req.user, "cost.write", { project: await project(c.project_id, req.user) });
    await audited(req.user,
      { action: "Commitment removed", entity: "commitment", entityId: c.id,
        detail: c.reference, before: { ...c } },
      async (t) => t.query(`DELETE FROM commitment WHERE id = $1`, [c.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── the actual effort (R-03) ─────────────────────────────────────────
   One number a week. The permission is the allocation's — whoever may
   put a person on a project may record what that person actually spent. */

const monday = (d) => {
  const x = D(d); const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - ((day + 6) % 7));
  return iso(x);
};

r.post("/timesheets", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    const person = await one(`SELECT id, site_id FROM person WHERE id = $1`, [b.person]);
    if (!person) throw new HttpError(404, "No such person");
    gate(req.user, "allocation.write", { project: p, person });
    const days = num(b.days);
    if (!(days >= 0 && days <= 7)) bad("A week holds between 0 and 7 days");
    const week = monday(b.week ?? new Date());

    await audited(req.user,
      { action: "Effort recorded", entity: "timesheet", entityId: `${b.person}·${p.id}·${week}`,
        detail: `${b.person} · ${p.id} · ${week} · ${days} d` },
      async (t) => t.query(
        `INSERT INTO timesheet (person_id, project_id, week_start, days, entered_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (person_id, project_id, week_start)
         DO UPDATE SET days = EXCLUDED.days, entered_by = EXCLUDED.entered_by,
                       row_version = timesheet.row_version + 1`,
        [b.person, p.id, week, days, req.user.id]));
    res.status(201).json({ ok: true, week });
  } catch (e) { next(e); }
});

r.delete("/timesheets/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM timesheet WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such entry");
    const p = await project(row.project_id, req.user);
    const person = await one(`SELECT id, site_id FROM person WHERE id = $1`, [row.person_id]);
    gate(req.user, "allocation.write", { project: p, person });
    await audited(req.user,
      { action: "Effort entry removed", entity: "timesheet", entityId: String(row.id),
        before: { person_id: row.person_id, project_id: row.project_id,
                  week_start: row.week_start, days: Number(row.days) } },
      async (t) => t.query(`DELETE FROM timesheet WHERE id = $1`, [row.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── absences and deputies (R-02) ─────────────────────────────────────
   Bounded, motivated, and optionally naming who covers. A site keeps its
   own people's absences; group keeps any — the same shape as the
   shutdown calendar, because it is the same kind of fact. */

async function personSite(personId) {
  const p = await one(`SELECT site_id FROM person WHERE id = $1`, [personId]);
  return p?.site_id ?? null;
}

r.post("/absences", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.person) bad("An absence belongs to a person");
    const siteId = await personSite(b.person);
    if (!siteId) throw new HttpError(404, "No such person");
    gate(req.user, "absence.write", { site_id: siteId });
    if (!b.from || !b.to) bad("An absence has a start and an end");
    if (D(b.to) < D(b.from)) bad("An absence cannot end before it starts");
    if (b.deputy && b.deputy === b.person) bad("Nobody deputises for themselves");
    /* G-03 — pas de motif médical : « unavailable » dit ce dont la
       suppléance a besoin, et rien qui relève de l'article 9. */
    const reason = ["rotation", "leave", "training", "unavailable"].includes(b.reason) ? b.reason : "rotation";

    let id = null;
    await audited(req.user,
      () => ({ action: "Absence declared", entity: "person_absence", entityId: id,
               detail: `${b.person} · ${b.from} → ${b.to} (${reason})` +
                       (b.deputy ? ` · deputy ${b.deputy}` : "") }),
      async (t) => {
        id = await allocateId(t, "ABS", { pad: 3 });
        return t.query(
          `INSERT INTO person_absence (id, person_id, starts_on, ends_on, reason, deputy_id, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, b.person, b.from, b.to, reason, b.deputy || null, b.note ?? ""]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/absences/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM person_absence WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such absence");
    gate(req.user, "absence.write", { site_id: await personSite(a.person_id) });
    const b = req.body ?? {};
    const patch = {};
    if (b.from !== undefined) patch.starts_on = b.from;
    if (b.to !== undefined) patch.ends_on = b.to;
    if (b.reason !== undefined) patch.reason = ["rotation", "leave", "training", "unavailable"].includes(b.reason) ? b.reason : "rotation";
    if (b.deputy !== undefined) {
      if (b.deputy && b.deputy === a.person_id) bad("Nobody deputises for themselves");
      patch.deputy_id = b.deputy || null;
    }
    if (b.note !== undefined) patch.note = b.note;
    const out = await audited(req.user,
      { action: "Absence updated", entity: "person_absence", entityId: a.id,
        detail: a.person_id, before: { ends_on: a.ends_on, deputy_id: a.deputy_id } },
      async (t) => conflict(await updateVersioned(t, "person_absence", a.id,
        requiredVersion(b, "absence"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/absences/:id", async (req, res, next) => {
  try {
    const a = await one(`SELECT * FROM person_absence WHERE id = $1`, [req.params.id]);
    if (!a) throw new HttpError(404, "No such absence");
    gate(req.user, "absence.write", { site_id: await personSite(a.person_id) });
    await audited(req.user,
      /* G-03 — l'image garde de quoi restaurer l'absence, pas la note
         libre qui l'accompagnait : la piste est ineffaçable, donc tout ce
         qu'on y écrit l'est aussi. Une note d'organisation n'a pas à être
         conservée à perpétuité et lisible au niveau groupe. */
      { action: "Absence withdrawn", entity: "person_absence", entityId: a.id,
        detail: a.person_id, before: { ...a, note: "" } },
      async (t) => t.query(`DELETE FROM person_absence WHERE id = $1`, [a.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── demand intake and prioritisation (V-13 / V-04) ───────────────────
   The funnel in front of the portfolio: what was asked for, what was
   declined and why, and the order the group intends to do the rest in.
   A decline is a decision and carries its reason like every other. */

const DEMAND_STATES = ["New", "Triaged", "Approved", "Declined", "Converted"];
const score = (v) => (v === undefined || v === null || v === "" ? null
  : Math.max(1, Math.min(5, Math.round(Number(v)))));

r.get("/demand", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read");
    const rows = await many(`SELECT * FROM demand ORDER BY raised_on DESC, id DESC LIMIT 300`);
    res.json({
      demand: rows.map((d) => ({
        id: d.id, title: d.title, detail: d.detail, sponsor: d.sponsor,
        programme: d.programme_id, site: d.site_id, benefitNote: d.benefit_note,
        estCost: d.est_cost === null ? null : toM(d.est_cost),
        raisedBy: d.raised_label, raisedOn: d.raised_on, status: d.status,
        decidedBy: d.decided_label, decidedOn: d.decided_on, decisionNote: d.decision_note,
        project: d.project_id,
        fit: d.fit_score, value: d.value_score, risk: d.risk_score, effort: d.effort_score,
        version: d.row_version,
      })),
    });
  } catch (e) { next(e); }
});

r.post("/demand", async (req, res, next) => {
  try {
    gate(req.user, "demand.raise");
    const b = req.body ?? {};
    if (!b.title) bad("A request needs a title — what is being asked for");
    let id = null;
    await audited(req.user,
      () => ({ action: "Demand raised", entity: "demand", entityId: id, detail: b.title }),
      async (t) => {
        id = await allocateId(t, "DEM", { pad: 3 });
        return t.query(
          `INSERT INTO demand (id, title, detail, sponsor, programme_id, site_id,
                               benefit_note, est_cost, raised_by, raised_label)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, b.title, b.detail ?? "", b.sponsor ?? "", b.programme || null, b.site || null,
           b.benefitNote ?? "", b.estCost === undefined || b.estCost === "" ? null : fromM(num(b.estCost)),
           req.user.id, `${req.user.displayName} (${req.user.role})`]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/demand/:id", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM demand WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such request");
    const b = req.body ?? {};
    const patch = {};

    /* Editing what was asked for is open; deciding it is not. The split
       is per-field rather than per-route so the funnel stays one object. */
    const decides = b.status !== undefined || b.decisionNote !== undefined ||
      b.fit !== undefined || b.value !== undefined || b.risk !== undefined || b.effort !== undefined;
    if (decides) gate(req.user, "demand.decide");
    else gate(req.user, "demand.raise");

    if (b.title !== undefined) patch.title = b.title;
    if (b.detail !== undefined) patch.detail = b.detail;
    if (b.sponsor !== undefined) patch.sponsor = b.sponsor;
    if (b.programme !== undefined) patch.programme_id = b.programme || null;
    if (b.site !== undefined) patch.site_id = b.site || null;
    if (b.benefitNote !== undefined) patch.benefit_note = b.benefitNote;
    if (b.estCost !== undefined) patch.est_cost = b.estCost === "" || b.estCost === null ? null : fromM(num(b.estCost));
    if (b.fit !== undefined) patch.fit_score = score(b.fit);
    if (b.value !== undefined) patch.value_score = score(b.value);
    if (b.risk !== undefined) patch.risk_score = score(b.risk);
    if (b.effort !== undefined) patch.effort_score = score(b.effort);
    if (b.status !== undefined) {
      if (!DEMAND_STATES.includes(b.status)) bad("That is not a request status");
      if (b.status === "Converted") bad("A request becomes Converted by creating its project, not by hand");
      /* A refusal that does not say why is the thing people complain
         about for years. */
      if (b.status === "Declined" && !(b.decisionNote ?? d.decision_note)) {
        bad("A decline needs its reason — the person who asked will read it");
      }
      patch.status = b.status;
      if (["Approved", "Declined"].includes(b.status)) {
        patch.decided_by = req.user.id;
        patch.decided_label = `${req.user.displayName} (${req.user.role})`;
        patch.decided_on = iso(new Date());
      }
    }
    if (b.decisionNote !== undefined) patch.decision_note = b.decisionNote;

    const out = await audited(req.user,
      { action: b.status === "Declined" ? "Demand declined"
              : b.status === "Approved" ? "Demand approved to plan"
              : "Demand updated",
        entity: "demand", entityId: d.id, detail: b.title ?? d.title,
        before: { status: d.status }, after: { status: patch.status ?? d.status } },
      async (t) => conflict(await updateVersioned(t, "demand", d.id,
        requiredVersion(b, "request"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/demand/:id", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM demand WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such request");
    gate(req.user, "demand.decide");
    if (d.status === "Converted") {
      throw new HttpError(409, "This request became a project — it stays as that project's origin");
    }
    await audited(req.user,
      { action: "Demand withdrawn", entity: "demand", entityId: d.id, detail: d.title,
        before: { title: d.title, status: d.status } },
      async (t) => t.query(`DELETE FROM demand WHERE id = $1`, [d.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Approved demand becomes a project, and the request records that it did. */
r.post("/demand/:id/convert", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM demand WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such request");
    gate(req.user, "demand.decide");
    if (d.status !== "Approved") throw new HttpError(409, "Only an approved request becomes a project");
    if (d.project_id) throw new HttpError(409, "This request already became " + d.project_id);
    const b = req.body ?? {};
    const programme = b.programme ?? d.programme_id;
    const site = b.site ?? d.site_id;
    if (!programme || !site) bad("A project needs a programme and a site");
    if (!b.start || !b.finish) bad("A project needs a start and a finish date");
    const level = b.governanceLevel === "group" ? "group" : "site";
    gate(req.user, "project.create", { programme_id: programme, site_id: site, governance_level: level });

    let id = null;
    await audited(req.user,
      () => ({ action: "Demand became a project", entity: "demand", entityId: d.id,
               detail: `${d.title} → ${id}`, after: { project_id: id } }),
      async (t) => {
        id = await allocateId(t, "PRJ", { step: 3 });
        await t.query(
          `INSERT INTO project
             (id, name, programme_id, site_id, governance_level, pm_id, method,
              start_date, finish_date, baseline_finish, budget, contingency, description, phase,
              fit_score, value_score, risk_score, effort_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,0,$11,'Initiation',$12,$13,$14,$15)`,
          [id, b.name ?? d.title, programme, site, level, b.pm ?? null, b.method ?? "Hybrid",
           b.start, b.finish, d.est_cost ?? 0, d.detail ?? "",
           d.fit_score, d.value_score, d.risk_score, d.effort_score]);
        await scaffoldProject(t, {
          id, name: b.name ?? d.title, programme, site,
          pm: b.pm ?? null, method: b.method ?? "Hybrid", start: b.start, finish: b.finish,
        });
        await t.query(
          `UPDATE demand SET status = 'Converted', project_id = $2, row_version = row_version + 1
            WHERE id = $1`, [d.id, id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/** The order the group intends to work in, against one envelope. */
r.patch("/projects/:id/priority", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "priority.write");
    const b = req.body ?? {};
    const patch = {};
    if (b.fit !== undefined) patch.fit_score = score(b.fit);
    if (b.value !== undefined) patch.value_score = score(b.value);
    if (b.risk !== undefined) patch.risk_score = score(b.risk);
    if (b.effort !== undefined) patch.effort_score = score(b.effort);
    if (b.rank !== undefined) patch.rank_seq = b.rank === "" || b.rank === null ? null : Math.round(num(b.rank));
    if (!Object.keys(patch).length) bad("Nothing recognised to change");

    const out = await audited(req.user,
      { action: "Priority set", entity: "project", entityId: p.id,
        detail: [b.fit && "fit " + b.fit, b.value && "value " + b.value,
                 b.risk && "risk " + b.risk, b.effort && "effort " + b.effort,
                 b.rank !== undefined && "rank " + b.rank].filter(Boolean).join(" · ") },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(b, "project"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── the plant's calendar, and what may not cross it (V-03) ───────────
   A freeze is the site saying "not during this". Intrusive work planned
   into one is refused unless management of change has released it — the
   control the head of Operational Technology came looking for. */

/** Freezes at a site covering a date. Read before a transaction opens. */
async function freezesCovering(siteId, on) {
  if (!siteId || !on) return [];
  return many(
    `SELECT id, label, starts_on, ends_on FROM site_window
      WHERE site_id = $1 AND kind = 'freeze' AND $2 BETWEEN starts_on AND ends_on
      ORDER BY starts_on`, [siteId, on]);
}

/**
 * The rule, in one place so every path that dates intrusive work asks the
 * same question: a milestone marked intrusive, at a site in a freeze, on
 * a project that touches the plant, needs a released MOC.
 */
async function assertPlantWindow(project, { date, intrusive }) {
  if (!intrusive) return;
  if (project.plant_impact === "none" || !project.plant_impact) return;
  if (project.moc_approved_on) return;   // released; the window is theirs to use
  const hits = await freezesCovering(project.site_id, date);
  if (!hits.length) return;
  const w = hits[0];
  throw new HttpError(409,
    `${w.label} runs ${w.starts_on} to ${w.ends_on} at this site and this project is ` +
    `classified as ${project.plant_impact} work. Move the date, or have management of ` +
    `change release it at group level.`);
}

r.post("/windows", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.site) bad("A window belongs to a site");
    gate(req.user, "window.write", { site_id: b.site });
    if (!b.label) bad("A window needs a label — what the site calls it");
    if (!b.from || !b.to) bad("A window needs a start and an end date");
    if (D(b.to) < D(b.from)) bad("A window cannot end before it starts");
    const kind = b.kind === "shutdown" ? "shutdown" : "freeze";

    let id = null;
    await audited(req.user,
      () => ({ action: kind === "freeze" ? "Change freeze declared" : "Shutdown window declared",
               entity: "site_window", entityId: id,
               detail: `${b.site} · ${b.label} · ${b.from} → ${b.to}` }),
      async (t) => {
        id = await allocateId(t, "SW", { pad: 2 });
        return t.query(
          `INSERT INTO site_window (id, site_id, kind, label, detail, starts_on, ends_on, raised_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, b.site, kind, b.label, b.detail ?? "", b.from, b.to, req.user.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/windows/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM site_window WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such window");
    gate(req.user, "window.write", { site_id: w.site_id });
    const b = req.body ?? {};
    const patch = {};
    if (b.kind !== undefined) patch.kind = b.kind === "shutdown" ? "shutdown" : "freeze";
    if (b.label !== undefined) patch.label = b.label;
    if (b.detail !== undefined) patch.detail = b.detail;
    if (b.from !== undefined) patch.starts_on = b.from;
    if (b.to !== undefined) patch.ends_on = b.to;

    const out = await audited(req.user,
      { action: "Window updated", entity: "site_window", entityId: w.id,
        detail: `${w.site_id} · ${b.label ?? w.label}`,
        before: { starts_on: w.starts_on, ends_on: w.ends_on } },
      async (t) => conflict(await updateVersioned(t, "site_window", w.id,
        requiredVersion(b, "window"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/windows/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM site_window WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such window");
    gate(req.user, "window.write", { site_id: w.site_id });
    await audited(req.user,
      { action: "Window withdrawn", entity: "site_window", entityId: w.id,
        detail: `${w.site_id} · ${w.label}`, before: { ...w } },
      async (t) => t.query(`DELETE FROM site_window WHERE id = $1`, [w.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Classify a project's reach into the plant. */
r.patch("/projects/:id/plant", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.write", { project: p });
    const impact = req.body?.impact ?? "none";
    if (!["none", "plant", "safety"].includes(impact)) bad("Impact is none, plant or safety");
    const out = await audited(req.user,
      { action: "Plant impact classified", entity: "project", entityId: p.id,
        detail: impact, before: { plant_impact: p.plant_impact ?? "none" }, after: { plant_impact: impact } },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(req.body, "project"), { plant_impact: impact })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/** Release intrusive work — group level, and never the project's own PM. */
r.patch("/projects/:id/moc", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    const full = await one(`SELECT pm_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
    gate(req.user, "moc.approve", { project: p, pm_id: full?.pm_id ?? null });
    if (!full?.plant_impact || full.plant_impact === "none") {
      bad("This project is not classified as plant or safety work — there is nothing to release");
    }
    const release = req.body?.release !== false;
    const ref = String(req.body?.ref ?? "").slice(0, 120);
    if (release && !ref) bad("A release needs the management-of-change reference it was raised under");

    const out = await audited(req.user,
      { action: release ? "Management of change released" : "Management of change withdrawn",
        entity: "project", entityId: p.id, detail: release ? ref : "",
        before: { moc_approved_on: full.moc_approved_on },
        after: { moc_approved_on: release ? iso(new Date()) : null, ref } },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(req.body, "project"),
        { moc_ref: release ? ref : "",
          moc_approved_by: release ? req.user.id : null,
          moc_approved_label: release ? `${req.user.displayName} (${req.user.role})` : "",
          moc_approved_on: release ? iso(new Date()) : null })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── rollout waves: the same thing, at five sites (V-06) ───────────── */

r.post("/waves", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "wave.write", { project: p });
    if (!b.site) bad("A wave lands at a site");
    let id = null;
    await audited(req.user,
      () => ({ action: "Rollout wave added", entity: "rollout_wave", entityId: id,
               detail: `${p.id} → ${b.site}` }),
      async (t) => {
        id = await allocateId(t, "WAVE", { pad: 3 });
        return t.query(
          `INSERT INTO rollout_wave (id, project_id, site_id, seq, planned_on, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, p.id, b.site, num(b.seq, 1), b.plannedOn || null, b.note ?? ""]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/waves/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM rollout_wave WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such wave");
    const p = await project(w.project_id, req.user);
    gate(req.user, "wave.write", { project: p });
    const b = req.body ?? {};

    /* Going live at a site IS intrusive work, so it asks the freeze
       question — the wave is where a rollout actually touches a plant. */
    if (b.status === "Live" || b.actualOn !== undefined || b.plannedOn !== undefined) {
      const full = await one(
        `SELECT site_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
      await assertPlantWindow(
        { site_id: w.site_id, plant_impact: full?.plant_impact, moc_approved_on: full?.moc_approved_on },
        { date: b.actualOn ?? b.plannedOn ?? w.planned_on, intrusive: true });
    }

    const patch = {};
    if (b.seq !== undefined) patch.seq = num(b.seq, 1);
    if (b.plannedOn !== undefined) patch.planned_on = b.plannedOn || null;
    if (b.actualOn !== undefined) patch.actual_on = b.actualOn || null;
    if (b.note !== undefined) patch.note = b.note;
    if (b.status !== undefined) {
      if (!["Planned", "In progress", "Live", "Held", "Cancelled"].includes(b.status)) {
        bad("That is not a wave status");
      }
      patch.status = b.status;
    }

    const out = await audited(req.user,
      { action: b.status === "Live" ? "Site went live" : "Rollout wave updated",
        entity: "rollout_wave", entityId: w.id, detail: `${w.project_id} · ${w.site_id}`,
        before: { status: w.status }, after: { status: patch.status ?? w.status } },
      async (t) => conflict(await updateVersioned(t, "rollout_wave", w.id,
        requiredVersion(b, "wave"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/waves/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM rollout_wave WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such wave");
    gate(req.user, "wave.write", { project: await project(w.project_id, req.user) });
    await audited(req.user,
      { action: "Rollout wave removed", entity: "rollout_wave", entityId: w.id,
        detail: `${w.project_id} · ${w.site_id}`, before: { ...w } },
      async (t) => t.query(`DELETE FROM rollout_wave WHERE id = $1`, [w.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── benefits and value realisation (V-01) ────────────────────────────
   What the project promised, in the unit the sponsor speaks, and what was
   actually measured. The numbers here are in the benefit's own `unit` —
   they are NOT money and are never scaled by 1e6. */

const BENEFIT_KINDS = ["Production", "Availability", "Cost", "Risk", "Compliance"];
const BENEFIT_STATES = ["Forecast", "Realised", "Partially realised", "Missed", "Withdrawn"];
/** Empty string and undefined both mean "not measured yet", not zero. */
const numOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

r.post("/benefits", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "benefit.write", { project: p });
    assertLocalOrigin(p, "project");
    if (!b.title) bad("A benefit needs a title");
    const kind = BENEFIT_KINDS.includes(b.kind) ? b.kind : "Cost";

    let id = null;
    await audited(req.user,
      () => ({ action: "Benefit added", entity: "benefit", entityId: id,
               detail: `${kind} — ${b.title}` }),
      async (t) => {
        id = await allocateId(t, "BEN", { pad: 2 });
        return t.query(
          `INSERT INTO benefit
             (id, project_id, kind, title, detail, measure, unit,
              baseline, target, actual, owner_id, realise_on, measured_on, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Forecast')`,
          [id, p.id, kind, b.title, b.detail ?? "", b.measure ?? "", b.unit ?? "",
           numOrNull(b.baseline), numOrNull(b.target), numOrNull(b.actual),
           b.owner || null, b.realiseOn || null, b.measuredOn || null]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/benefits/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM benefit WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such benefit");
    const p = await project(row.project_id, req.user);
    gate(req.user, "benefit.write", { project: p });
    const b = req.body ?? {};

    const patch = {};
    if (b.kind !== undefined) {
      if (!BENEFIT_KINDS.includes(b.kind)) bad("That is not a benefit type");
      patch.kind = b.kind;
    }
    if (b.title !== undefined) patch.title = b.title;
    if (b.detail !== undefined) patch.detail = b.detail;
    if (b.measure !== undefined) patch.measure = b.measure;
    if (b.unit !== undefined) patch.unit = b.unit;
    if (b.baseline !== undefined) patch.baseline = numOrNull(b.baseline);
    if (b.target !== undefined) patch.target = numOrNull(b.target);
    if (b.actual !== undefined) patch.actual = numOrNull(b.actual);
    if (b.owner !== undefined) patch.owner_id = b.owner || null;
    if (b.realiseOn !== undefined) patch.realise_on = b.realiseOn || null;
    if (b.measuredOn !== undefined) patch.measured_on = b.measuredOn || null;
    /* Withdrawing a benefit is a statement about the plan and stays with
       the project; the three VERDICT states are the reviewer's to set, so
       they arrive through the review route, never through an edit. */
    if (b.status !== undefined) {
      if (!BENEFIT_STATES.includes(b.status)) bad("That is not a benefit status");
      if (["Realised", "Partially realised", "Missed"].includes(b.status)) {
        gate(req.user, "benefit.review", { project: p });
      }
      patch.status = b.status;
    }

    const out = await audited(req.user,
      { action: b.actual !== undefined ? "Benefit measured" : "Benefit updated",
        entity: "benefit", entityId: row.id, detail: b.title ?? row.title,
        before: { actual: row.actual, status: row.status },
        after: { actual: patch.actual ?? row.actual, status: patch.status ?? row.status } },
      async (t) => conflict(await updateVersioned(t, "benefit", row.id,
        requiredVersion(b, "benefit"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/benefits/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM benefit WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such benefit");
    gate(req.user, "benefit.write", { project: await project(row.project_id, req.user) });
    await audited(req.user,
      { action: "Benefit removed", entity: "benefit", entityId: row.id,
        detail: row.title, before: { ...row } },
      async (t) => t.query(`DELETE FROM benefit WHERE id = $1`, [row.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * The post-implementation review — the answer to "was it worth doing".
 * Group-level by construction (benefit.review is a GROUP_ONLY write): the
 * people who delivered it record what was measured, and somebody else
 * says whether that counts.
 */
r.patch("/projects/:id/review", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "benefit.review", { project: p });
    const verdict = req.body?.verdict ?? null;
    if (verdict && !["Met", "Partly met", "Missed"].includes(verdict)) {
      bad("A review verdict is Met, Partly met or Missed");
    }
    const note = String(req.body?.note ?? "").slice(0, 1000);
    /* Same rule the RAG and gate overrides carry: a judgement the
       committee will read back needs its reason written down. */
    if (verdict && verdict !== "Met" && !note) {
      bad("A verdict short of 'Met' needs a reason — the committee has to be able to read it back");
    }
    const full = await one(`SELECT pir_on, pir_verdict, pir_note FROM project WHERE id = $1`, [p.id]);

    const out = await audited(req.user,
      { action: verdict ? "Post-implementation review recorded" : "Post-implementation review cleared",
        entity: "project", entityId: p.id,
        detail: verdict ? `${verdict}${note ? " — " + note : ""}` : "",
        before: { verdict: full?.pir_verdict ?? null },
        after: { verdict } },
      async (t) => conflict(await updateVersioned(t, "project", p.id,
        requiredVersion(req.body, "review"),
        { pir_verdict: verdict, pir_note: verdict ? note : "",
          pir_on: verdict ? iso(new Date()) : null })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── tolerance and exception (PM-01) ──────────────────────────────────
 *
 * L'autorité était déléguée sans borne. Le produit savait dire qu'un
 * projet virait à l'orange ; il ne savait pas dire qu'il avait franchi
 * une limite que quelqu'un avait fixée — et la différence est tout le
 * mécanisme. Dans le premier cas il faut que quelqu'un remarque et
 * accepte de porter la mauvaise nouvelle ; dans le second, le
 * dépassement remonte tout seul à celui qui a accordé la marge.
 *
 * PRINCE2 « Progress » et ISO 21502 §6.5. La marge est posée par le
 * niveau AU-DESSUS (`tolerance.set` est une écriture de groupe) et
 * l'exception est répondue par le même niveau : celui qui livre vit dans
 * la marge, il ne la fixe pas et il ne statue pas sur son dépassement.
 */

r.put("/projects/:id/tolerance", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "tolerance.set", { project: p });
    const b = req.body ?? {};

    const bound = (v, what) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) bad(`${what} must be zero or more`);
      return n;
    };
    const schedule = bound(b.scheduleDays, "A schedule tolerance");
    const cost = bound(b.costPct, "A cost tolerance");
    const benefit = bound(b.benefitPct, "A benefit tolerance");
    const note = String(b.note ?? "").slice(0, 1000);

    /* Une tolérance qui ne borne rien et ne dit rien n'est pas une
       tolérance : c'est un formulaire vide qu'on prendra plus tard pour
       une marge accordée. */
    if (schedule === null && cost === null && benefit === null && !note) {
      bad("A tolerance has to bound something, or say in words what it bounds");
    }

    let id = null;
    await audited(req.user,
      () => ({ action: "Tolerance set", entity: "project_tolerance", entityId: id,
               detail: `${p.id} — ` + ([
                 schedule !== null ? `${schedule} days` : null,
                 cost !== null ? `${cost}% cost` : null,
                 benefit !== null ? `${benefit}pt benefit` : null,
               ].filter(Boolean).join(", ") || "stated in words only") }),
      async (t) => {
        /* La précédente est désactivée, pas écrasée : on doit pouvoir
           relire plus tard sous quelle marge une décision a été prise. */
        await t.query(
          `UPDATE project_tolerance SET active = false, row_version = row_version + 1
            WHERE project_id = $1 AND active`, [p.id]);
        id = await allocateId(t, "TOL", { pad: 3 });
        return t.query(
          `INSERT INTO project_tolerance
             (id, project_id, schedule_days, cost_pct, benefit_pct, note, set_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, p.id, schedule, cost, benefit, note, req.user.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/**
 * Répondre à une exception. Quatre réponses, celles que PRINCE2 laisse au
 * niveau qui a délégué : relever la tolérance, réviser le plan, accepter
 * le dépassement, arrêter. Chacune demande une phrase — une exception
 * close sans raison écrite ne se relit pas, et c'est précisément ce
 * qu'un comité viendra relire.
 */
r.post("/exceptions/:id/answer", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM project_exception WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such exception");
    const p = await project(row.project_id, req.user);
    gate(req.user, "exception.answer", { project: p });

    const KINDS = ["Tolerance raised", "Plan revised", "Accepted", "Stopped"];
    const kind = req.body?.kind;
    if (!KINDS.includes(kind)) bad(`An answer is one of: ${KINDS.join(", ")}`);
    const answer = String(req.body?.answer ?? "").trim().slice(0, 2000);
    if (!answer) bad("Say what was decided — a committee will read this back");

    const out = await audited(req.user,
      { action: "Exception answered", entity: "project_exception", entityId: row.id,
        detail: `${row.project_id} ${row.dimension} — ${kind}: ${answer.slice(0, 120)}`,
        before: { status: row.status }, after: { status: "Answered", kind } },
      async (t) => conflict(await updateVersioned(t, "project_exception", row.id,
        requiredVersion(req.body, "exception"),
        { status: "Answered", answer_kind: kind, answer,
          answered_by: req.user.id, answered_on: iso(new Date()) })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── business case (PM-03) ────────────────────────────────────────────
 *
 * La chaîne demande → cas d'affaire → bénéfice → revue était rompue en
 * son milieu : le cas n'existait que comme type de document. Un cas par
 * projet, écrit et reconfirmé par le niveau qui paie ; la question de la
 * justification continue — « cela vaut-il ENCORE la peine ? » — devient
 * un acte daté au lieu d'une opinion de couloir.
 */

r.put("/projects/:id/case", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "case.write", { project: p });
    const b = req.body ?? {};
    if (!b.summary || !String(b.summary).trim()) {
      bad("A business case starts with the justification, in the payer's words");
    }
    const num = (v, what) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) bad(what + " must be zero or more, in millions");
      return fromM(n);
    };
    const cost = num(b.expectedCost, "The expected cost");
    const benefit = num(b.expectedBenefit, "The expected annual benefit");

    const existing = await one(
      `SELECT * FROM business_case WHERE project_id = $1`, [p.id]);

    if (!existing) {
      let id = null;
      await audited(req.user,
        () => ({ action: "Business case written", entity: "business_case", entityId: id,
                 detail: p.id + " — " + String(b.summary).slice(0, 80) }),
        async (t) => {
          id = await allocateId(t, "CAS", { pad: 3 });
          return t.query(
            `INSERT INTO business_case
               (id, project_id, summary, expected_cost, expected_benefit, basis, written_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, p.id, b.summary, cost, benefit, b.basis ?? "", req.user.id]);
        });
      return res.status(201).json({ id });
    }

    /* Modifier le cas ne retire PAS la reconfirmation passée — elle a eu
       lieu, elle est datée — mais `updated_on` avance, et le sérialiseur
       en déduit que la reconfirmation ne couvre plus le texte présent. */
    const out = await audited(req.user,
      { action: "Business case updated", entity: "business_case", entityId: existing.id,
        detail: p.id,
        before: { summary: existing.summary, cost: existing.expected_cost,
                  benefit: existing.expected_benefit },
        after: { summary: b.summary, cost, benefit } },
      async (t) => conflict(await updateVersioned(t, "business_case", existing.id,
        requiredVersion(b, "business case"),
        { summary: b.summary, expected_cost: cost, expected_benefit: benefit,
          basis: b.basis ?? existing.basis, updated_on: iso(new Date()) })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/**
 * « Oui, cela vaut encore la peine. » Au jalon N, tel jour, signé. La
 * route refuse de reconfirmer un cas qui n'existe pas — reconfirmer le
 * vide est exactement le geste de complaisance que PM-03 ferme.
 */
r.post("/projects/:id/case/reconfirm", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "case.write", { project: p });
    const existing = await one(`SELECT * FROM business_case WHERE project_id = $1`, [p.id]);
    if (!existing) bad("There is no business case to reconfirm — write it first");
    const g = Number(req.body?.gate ?? p.gate ?? 0);
    if (!(g >= 1 && g <= 4)) bad("Reconfirmation happens at a gate — 1 to 4");

    const out = await audited(req.user,
      { action: "Business case reconfirmed", entity: "business_case", entityId: existing.id,
        detail: `${p.id} — still worth doing, at gate ${g}`,
        before: { gate: existing.reconfirmed_gate, on: existing.reconfirmed_on },
        after: { gate: g } },
      async (t) => conflict(await updateVersioned(t, "business_case", existing.id,
        requiredVersion(req.body, "business case"),
        /* updated_on repasse à NULL : la reconfirmation couvre le texte
           PRÉSENT. Comparer deux dates ne suffit pas — une révision le
           même jour ne serait jamais « plus récente » qu'une
           reconfirmation du matin. L'ordre des événements se code par
           l'effacement, pas par l'horloge. */
        { reconfirmed_gate: g, reconfirmed_on: iso(new Date()), reconfirmed_by: req.user.id,
          updated_on: null })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* ── lessons (PM-02) ──────────────────────────────────────────────────
 *
 * Le jalon 4 du produit exige comme preuve « Realisation report, lessons
 * learned » et le produit n'avait aucun endroit où mettre un
 * enseignement : il réclamait une pièce qu'il rendait impossible à
 * fournir. ISO 21502 §7.17 et PRINCE2 « apprendre de l'expérience »
 * demandent la même chose, pour la raison que huit sites connaissent —
 * sans registre, la même erreur se paie une fois par site.
 *
 * Qui l'a vécu propose ; le groupe adopte. L'adoption n'est pas une
 * formalité : c'est elle qui rend l'enseignement visible AUX AUTRES
 * sites, et un registre qui ne sort pas de son projet n'apprend rien à
 * personne.
 */

r.post("/lessons", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "lesson.write", { project: p });
    assertLocalOrigin(p, "project");
    if (!b.title) bad("A lesson needs a title");
    if (b.category && !LESSON_CATEGORIES.includes(b.category)) bad("That is not a lesson category");
    const gateN = b.gate === undefined || b.gate === null || b.gate === "" ? null : Number(b.gate);
    if (gateN !== null && !(gateN >= 1 && gateN <= 4)) bad("A gate is 1, 2, 3 or 4");

    let id = null;
    await audited(req.user,
      () => ({ action: "Lesson raised", entity: "lesson", entityId: id,
               detail: `${b.category ?? "Governance"} — ${b.title}` }),
      async (t) => {
        id = await allocateId(t, "LSN", { pad: 3 });
        /* Le programme et le site sont COPIÉS depuis le projet, pas lus
           par jointure : l'enseignement doit rester classable le jour où
           le projet n'est plus là. C'est sa seule raison d'être. */
        return t.query(
          `INSERT INTO lesson
             (id, project_id, programme_id, site_id, gate_n, category, title,
              what_happened, why, recommendation, outcome, raised_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, p.id, p.programme_id, p.site_id, gateN,
           b.category ?? "Governance", b.title,
           b.whatHappened ?? "", b.why ?? "", b.recommendation ?? "",
           b.outcome === "Positive" ? "Positive" : "Negative",
           req.user.personId ?? null]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/lessons/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM lesson WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such lesson");
    const p = await project(row.project_id, req.user);
    gate(req.user, "lesson.write", { project: p });
    const b = req.body ?? {};

    const patch = {};
    if (b.category !== undefined) {
      if (!LESSON_CATEGORIES.includes(b.category)) bad("That is not a lesson category");
      patch.category = b.category;
    }
    if (b.title !== undefined) patch.title = b.title;
    if (b.whatHappened !== undefined) patch.what_happened = b.whatHappened;
    if (b.why !== undefined) patch.why = b.why;
    if (b.recommendation !== undefined) patch.recommendation = b.recommendation;
    if (b.outcome !== undefined) patch.outcome = b.outcome === "Positive" ? "Positive" : "Negative";
    if (b.gate !== undefined) {
      const g = b.gate === null || b.gate === "" ? null : Number(b.gate);
      if (g !== null && !(g >= 1 && g <= 4)) bad("A gate is 1, 2, 3 or 4");
      patch.gate_n = g;
    }
    /* `status` n'entre pas par ici. Adopter est un acte du groupe et il a
       sa route ; laisser une modification ordinaire changer le statut,
       c'est laisser celui qui a écrit l'enseignement décider qu'il vaut
       pour les huit sites. */
    if (b.status !== undefined) {
      bad("A lesson is adopted or archived through its own route, not by editing it");
    }

    const out = await audited(req.user,
      { action: "Lesson updated", entity: "lesson", entityId: row.id,
        detail: b.title ?? row.title,
        before: { title: row.title, recommendation: row.recommendation },
        after: { title: patch.title ?? row.title,
                 recommendation: patch.recommendation ?? row.recommendation } },
      async (t) => conflict(await updateVersioned(t, "lesson", row.id,
        requiredVersion(b, "lesson"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/**
 * Adoption — l'acte qui publie l'enseignement au groupe entier, ou qui
 * le range. Réservé au niveau groupe (`lesson.adopt` est dans
 * GROUP_ONLY_WRITES) : la même indépendance que la revue de bénéfice.
 * Celui qui a vécu la chose la raconte ; quelqu'un d'autre décide
 * qu'elle vaut au-delà de son projet.
 */
r.post("/lessons/:id/adopt", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM lesson WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such lesson");
    gate(req.user, "lesson.adopt", {});

    const status = req.body?.status ?? "Adopted";
    if (!["Adopted", "Archived", "Proposed"].includes(status)) {
      bad("A lesson is Proposed, Adopted or Archived");
    }
    if (status === "Adopted" && !row.recommendation) {
      /* Un enseignement sans recommandation est une anecdote. On peut la
         garder au projet ; on ne la publie pas aux huit sites. */
      bad("A lesson without a recommendation cannot be adopted — say what someone should do differently");
    }

    const out = await audited(req.user,
      { action: status === "Adopted" ? "Lesson adopted" : `Lesson set to ${status.toLowerCase()}`,
        entity: "lesson", entityId: row.id, detail: row.title,
        before: { status: row.status }, after: { status } },
      async (t) => conflict(await updateVersioned(t, "lesson", row.id,
        requiredVersion(req.body, "lesson"),
        { status,
          adopted_by: status === "Adopted" ? req.user.id : null,
          adopted_on: status === "Adopted" ? iso(new Date()) : null })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/lessons/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM lesson WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such lesson");
    gate(req.user, "lesson.write", { project: await project(row.project_id, req.user) });
    /* Un enseignement adopté a été publié au groupe : on l'archive, on ne
       l'efface pas. Effacer ce que d'autres ont lu et appliqué serait
       réécrire l'histoire, ce que ce produit refuse partout ailleurs. */
    if (row.status === "Adopted") {
      bad("An adopted lesson is archived, not deleted — others have read it");
    }
    await audited(req.user,
      { action: "Lesson removed", entity: "lesson", entityId: row.id,
        detail: row.title, before: { ...row } },
      async (t) => t.query(`DELETE FROM lesson WHERE id = $1`, [row.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * « Qu'a-t-on appris qui vaille pour CE projet ? » — la question qui
 * justifie le registre. Les enseignements adoptés du même programme ou
 * du même site, le projet lui-même exclu. Sans cette route, le registre
 * serait une archive que personne n'ouvre au bon moment.
 */
r.get("/projects/:id/lessons/relevant", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    const rows = await many(
      `SELECT * FROM lesson
        WHERE status = 'Adopted'
          AND project_id IS DISTINCT FROM $1
          AND (programme_id = $2 OR site_id = $3)
        ORDER BY outcome, raised_on DESC
        LIMIT 25`,
      [p.id, p.programme_id, p.site_id]);
    res.json({
      lessons: rows.map((l) => ({
        id: l.id, category: l.category, title: l.title, outcome: l.outcome,
        recommendation: l.recommendation, why: l.why,
        programme: l.programme_id, site: l.site_id, raisedOn: l.raised_on,
        sameProgramme: l.programme_id === p.programme_id,
        sameSite: l.site_id === p.site_id,
      })),
    });
  } catch (e) { next(e); }
});

/* ── documents ────────────────────────────────────────────────────── */

/**
 * R-01 — the artefact behind an approval. HTTPS, and a host somebody
 * deliberately trusted (`documentHosts`, comma-separated; a subdomain of
 * a trusted host counts). Empty configuration fails CLOSED with a message
 * that says what to do — an unconfigured control that waves things
 * through is the exact failure the committee blocked the product over.
 */
function assertEvidenceUri(uri, settings) {
  const raw = String(uri ?? "").trim();
  if (!raw) bad("Gate evidence needs its artefact — the link to the piece itself, not only a status");
  let u;
  try { u = new URL(raw); } catch { bad("The evidence link is not a valid URL"); }
  if (u.protocol !== "https:") bad("An evidence link is served over https, or it is not a record");
  const hosts = String(settings.documentHosts ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) {
    bad("No trusted document hosts are configured — name the group's document estate " +
        "(documentHosts, in Administration) before evidence can be approved");
  }
  const host = u.hostname.toLowerCase();
  if (!hosts.some((h) => host === h || host.endsWith("." + h))) {
    bad(`The evidence link points at ${host}, which is not a trusted document host`);
  }
  return raw;
}
const uriHash = (uri) => crypto.createHash("sha256").update(String(uri)).digest("hex");

/**
 * S-01 — the scheme check, applied the moment a link is STORED rather
 * than when it is approved.
 *
 * The trusted-host rule above is a governance control and belongs at
 * approval: a draft may legitimately point anywhere while the work is in
 * flight. But `javascript:` is not a location, it is code, and a draft
 * link is rendered as an href in the document library long before anyone
 * approves it. So the two checks separate: this one refuses anything that
 * is not http(s) at write time, for everybody, always; the host allow-list
 * still gates approval. An empty link stays legal — a document may be
 * filed before its artefact exists.
 */
function assertStorableUri(uri) {
  const raw = String(uri ?? "").trim();
  if (!raw) return "";
  let u;
  try { u = new URL(raw); } catch { bad("That link is not a valid URL"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    bad("A link points somewhere — only http and https addresses are stored");
  }
  if (raw.length > 2048) bad("That link is too long to be an address");
  return raw;
}

r.post("/documents", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (b.project) {
      const p = await project(b.project, req.user);
      gate(req.user, "document.write", { project: p });
      /* Creating is NOT approving — for anybody, including group level
         and admin. Gating the create was not enough: a group user could
         file evidence with no owner already marked Approved, so the same
         person authored and approved it in one call and no author was
         ever recorded. Approval is a separate act on an existing
         document, which is what makes it somebody's second signature. */
      if (b.status === "Approved") {
        bad("A document is filed, then approved — approving is a separate act, " +
            "so that the trail shows who wrote the evidence and who accepted it");
      }
    } else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio documents are managed at group level");
    }
    if (!b.name) bad("A document needs a name");
    let id = null;
    await audited(req.user,
      () => ({ action: "Document added", entity: "document", entityId: id, detail: b.name }),
      async (t) => {
        id = await allocateId(t, "DOC");
        return t.query(
          `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on, uri)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$9)`,
          [id, b.project || null, b.name, b.type ?? "Assurance", num(b.gate, 0),
           /* S-06 — the author is recorded, not requested. An evidence
              document filed with no owner used to approve itself: the
              independence check compares the approver to the owner, and
              an absent owner matches nobody, so the same person wrote and
              accepted the evidence. Whoever files it owns it unless they
              name somebody else. */
           b.owner || req.user.personId || null,
           b.rev ?? "0.1", b.status ?? "Draft",
           assertStorableUri(b.uri)]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/documents/:id", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM document WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such document");
    const b0 = req.body ?? {};
    if (d.project_id) {
      const p = await project(d.project_id, req.user);
      /* Approving is not editing (committee I3): setting Approved runs
         through document.approve — owner never signs their own work,
         and gate evidence on a site project needs group-level eyes. */
      if (b0.status === "Approved") {
        /* S-06 — an ownerless document is not approvable. The independence
           check compares the approver against the owner; with no owner
           there is nobody to be independent OF, and it used to fail open.
           Filing now stamps the filer, so this only catches a document
           whose owner was cleared afterwards.

           The administrator is outside it, as they are outside every
           separation-of-duties rule (a deliberate exemption, S-13): an
           administration account is not tied to a person, so it can never
           satisfy this and would simply be locked out of approving
           anything. That exemption is the reason S-13 says the real fix is
           named accounts for the real roles, not more code here. */
        if (!d.owner_id && req.user.role !== "admin") {
          bad("This document names no owner, so nobody can be a second pair of eyes on it — " +
              "name the person accountable for it, then approve");
        }
        gate(req.user, "document.approve", { project: p, owner_id: d.owner_id, gate: d.gate });
        /* Approval is a pure act. Handing the document to someone else in
           the same breath is how an owner signs their own work in two
           moves, and it leaves the trail reading as if a colleague did. */
        if (b0.owner !== undefined && (b0.owner || null) !== d.owner_id) {
          bad("Change the owner or approve the document — not both in one step");
        }
      } else {
        gate(req.user, "document.write", { project: p });
      }
      /* Re-tagging an already-approved document onto a gate would carry a
         signature it never had: approve at gate 0, then move it to gate 2
         and the gate reads ready. The new gate is approved evidence, so
         it needs the authority that approving evidence there needs. */
      if (d.status === "Approved" && b0.gate !== undefined && num(b0.gate) !== d.gate) {
        gate(req.user, "document.approve",
          { project: p, owner_id: d.owner_id, gate: num(b0.gate) });
      }
    } else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio documents are managed at group level");
    }
    const b = req.body ?? {};
    const patch = { updated_on: iso(new Date()) };
    if (b.name !== undefined) patch.name = b.name;
    if (b.type !== undefined) patch.doc_type = b.type;
    if (b.gate !== undefined) patch.gate = num(b.gate);
    if (b.owner !== undefined) patch.owner_id = b.owner || null;
    if (b.rev !== undefined) patch.revision = b.rev;
    if (b.status !== undefined) patch.status = b.status;
    if (b.uri !== undefined) patch.uri = assertStorableUri(b.uri);

    /* R-01 — approving names the artefact and freezes its address. */
    let uriChangedOnApproved = false;
    if (b.status === "Approved") {
      const st = await loadSettings();
      const finalUri = assertEvidenceUri(b.uri ?? d.uri, st);
      patch.uri = finalUri;
      patch.uri_locked_hash = uriHash(finalUri);
      patch.uri_locked_on = iso(new Date());
    } else if (b.uri !== undefined && d.status === "Approved" && patch.uri !== d.uri) {
      /* A link changed after approval is not the piece that was approved.
         The document falls back to review — visibly, on the record — and
         somebody re-approves what the link now points at. */
      uriChangedOnApproved = true;
      patch.status = "In review";
      patch.uri_locked_hash = "";
      patch.uri_locked_on = null;
    }

    const out = await audited(req.user,
      uriChangedOnApproved
        ? { action: "Evidence link changed after approval", entity: "document", entityId: d.id,
            detail: `${d.name} — back to review`,
            before: { uri: d.uri, status: d.status }, after: { uri: patch.uri, status: "In review" } }
        : { action: b.status ? "Document set to " + b.status : "Document updated",
            entity: "document", entityId: d.id, detail: b.name ?? d.name },
      async (t) => conflict(await updateVersioned(t, "document", d.id, requiredVersion(b, "document"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/**
 * A new revision supersedes rather than overwrites: the approved version
 * of a gate document has to remain findable after it is replaced, or the
 * gate evidence trail has a hole in it (A1).
 */
r.post("/documents/:id/revise", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM document WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such document");
    if (d.project_id) gate(req.user, "document.write", { project: await project(d.project_id, req.user) });
    else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio documents are managed at group level");
    }

    const parts = String(d.revision).split(".");
    const next = `${parts[0] ?? "0"}.${(parseInt(parts[1] ?? "0", 10) || 0) + 1}`;
    let id = null;
    await audited(req.user,
      () => ({ action: "New revision raised", entity: "document", entityId: id,
        detail: `${d.name} ${d.revision} → ${next}` }),
      async (t) => {
        id = await allocateId(t, "DOC");
        await t.query(
          `UPDATE document SET status='Superseded', row_version = row_version + 1 WHERE id = $1`,
          [d.id]);
        /* The lineage (R-13): the new revision carries the location it is
           expected to live at and NAMES the row it replaces. The lock is
           not carried — a new revision is unapproved by definition. */
        await t.query(
          `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on, uri, supersedes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'Draft',CURRENT_DATE,$8,$9)`,
          [id, d.project_id, d.name, d.doc_type, d.gate, d.owner_id, next, d.uri ?? "", d.id]);
      });
    res.status(201).json({ id, revision: next });
  } catch (e) { next(e); }
});

r.delete("/documents/:id", async (req, res, next) => {
  try {
    const d = await one(`SELECT * FROM document WHERE id = $1`, [req.params.id]);
    if (!d) throw new HttpError(404, "No such document");
    if (d.project_id) gate(req.user, "document.write", { project: await project(d.project_id, req.user) });
    else if (!["admin", "group"].includes(req.user.role)) {
      throw new HttpError(403, "Portfolio documents are managed at group level");
    }
    await audited(req.user,
      { action: "Document deleted", entity: "document", entityId: d.id, detail: d.name, before: { ...d } },
      async (t) => t.query(`DELETE FROM document WHERE id = $1`, [d.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── board ────────────────────────────────────────────────────────── */

r.post("/workitems", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "workitem.write", { project: p });
    if (!b.title) bad("A work item needs a title");
    let id = null;
    await audited(req.user,
      () => ({ action: "Work item added", entity: "work_item", entityId: id, detail: b.title }),
      async (t) => {
        id = await allocateId(t, "WI");
        return t.query(
          `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority, created_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE)`,
          [id, p.id, b.column ?? "backlog", b.title, b.assignee ?? null,
           num(b.points, 1), b.priority ?? "P3"]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/workitems/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM work_item WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such work item");
    const p = await project(w.project_id, req.user);
    gate(req.user, "workitem.write", { project: p });
    const b = req.body ?? {};
    const patch = {};
    if (b.title !== undefined) patch.title = b.title;
    if (b.column !== undefined) patch.column_id = b.column;
    if (b.assignee !== undefined) patch.assignee_id = b.assignee || null;
    if (b.points !== undefined) patch.points = num(b.points, 1);
    if (b.priority !== undefined) patch.priority = b.priority;

    const out = await audited(req.user,
      { action: b.column ? "Work item moved" : "Work item updated",
        entity: "work_item", entityId: w.id, detail: b.title ?? w.title },
      async (t) => conflict(await updateVersioned(t, "work_item", w.id, requiredVersion(b, "work item"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/workitems/:id", async (req, res, next) => {
  try {
    const w = await one(`SELECT * FROM work_item WHERE id = $1`, [req.params.id]);
    if (!w) throw new HttpError(404, "No such work item");
    gate(req.user, "workitem.write", { project: await project(w.project_id, req.user) });
    await audited(req.user,
      { action: "Work item deleted", entity: "work_item", entityId: w.id, detail: w.title, before: { ...w } },
      async (t) => t.query(`DELETE FROM work_item WHERE id = $1`, [w.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── report narrative ─────────────────────────────────────────────── */

r.put("/narrative/:key", async (req, res, next) => {
  try {
    if (req.user.role === "viewer") throw new HttpError(403, "read-only account");
    const key = String(req.params.key).slice(0, 40);
    const lines = Array.isArray(req.body?.lines)
      ? req.body.lines.map((x) => String(x).slice(0, 400)).filter(Boolean)
      : null;

    await audited(req.user,
      { action: lines ? "Report narrative edited" : "Report narrative reset",
        entity: "report_narrative", entityId: key },
      async (t) => {
        if (!lines) return t.query(`DELETE FROM report_narrative WHERE block_key = $1`, [key]);
        return t.query(
          `INSERT INTO report_narrative (block_key, lines, updated_by, updated_at)
           VALUES ($1,$2,$3,now())
           ON CONFLICT (block_key) DO UPDATE
             SET lines = EXCLUDED.lines, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [key, JSON.stringify(lines), req.user.id]);
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── period close: what was reported, frozen (V-02) ───────────────────
   Reports are computed live, which is right for running the portfolio and
   wrong for governing it — in June you cannot reproduce March's pack. A
   close writes the reported set down. The rows are append-only at the
   database, so a correction is a NEW period naming the one it restates
   rather than an edit nobody can see. */

r.get("/periods", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read");
    const rows = await many(
      `SELECT id, label, status_date, closed_at, closed_by_label, note, restates, projects
         FROM report_period ORDER BY status_date DESC, closed_at DESC LIMIT 60`);
    res.json({
      periods: rows.map((p) => ({
        id: p.id, label: p.label, statusDate: p.status_date, closedAt: p.closed_at,
        closedBy: p.closed_by_label, note: p.note, restates: p.restates ?? null,
        projects: p.projects,
      })),
    });
  } catch (e) { next(e); }
});

/** One period as it was reported — narrowed to what this caller may see. */
r.get("/periods/:id", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read");
    const period = await one(
      `SELECT id, label, status_date, closed_at, closed_by_label, note, restates, projects
         FROM report_period WHERE id = $1`, [req.params.id]);
    if (!period) throw new HttpError(404, "No such reporting period");
    const rows = await many(
      `SELECT * FROM report_snapshot WHERE period_id = $1 ORDER BY project_name`,
      [period.id]);

    /* A snapshot row is a historical fact, but it is still portfolio data:
       scope it the way everything else is scoped. A project that has since
       left the caller's scope is not shown to them here either. */
    const visible = rows.filter((s) => canSeeProject(req.user, {
      programme_id: s.programme_id, site_id: s.site_id,
      governance_level: s.governance_level,
    }));

    res.json({
      period: {
        id: period.id, label: period.label, statusDate: period.status_date,
        closedAt: period.closed_at, closedBy: period.closed_by_label,
        note: period.note, restates: period.restates ?? null, projects: period.projects,
      },
      snapshot: visible.map((s) => ({
        project: s.project_id, name: s.project_name,
        programme: s.programme_id, site: s.site_id, governanceLevel: s.governance_level,
        pm: s.pm_id, phase: s.phase, rag: s.rag, ragWhy: s.rag_why,
        bac: toM(s.bac), ac: toM(s.ac), ev: toM(s.ev), pv: toM(s.pv),
        eac: toM(s.eac), vac: toM(s.vac),
        spi: s.spi === null ? null : Number(s.spi),
        cpi: s.cpi === null ? null : Number(s.cpi),
        measurable: s.measurable,
        pctComplete: s.pct_complete === null ? null : Number(s.pct_complete),
        plannedComplete: s.planned_complete === null ? null : Number(s.planned_complete),
        forecastFinish: s.forecast_finish, baselineFinish: s.baseline_finish,
        finish: s.finish_date, gate: s.gate_n, gateState: s.gate_state,
        openRisks: s.open_risks, steeringRisks: s.steering_risks,
        benefitsPromised: s.benefits_promised, benefitsMeasured: s.benefits_measured,
        benefitsMet: s.benefits_met,
      })),
    });
  } catch (e) { next(e); }
});

r.post("/periods", async (req, res, next) => {
  try {
    gate(req.user, "period.close");
    const b = req.body ?? {};
    if (!b.label) bad("A reporting period needs a label — what the board will call it");
    if (b.restates) {
      const prior = await one(`SELECT id FROM report_period WHERE id = $1`, [b.restates]);
      if (!prior) bad("The period being restated does not exist");
    }

    /* Everything the closer can see, which for group level and above is
       the portfolio. Computed once, here, so every row in the period
       shares one status date and one reading of the book. */
    const db = await loadPortfolio(req.user);
    const rows = db.projects.map((p) => {
      const m = Engine.metrics(db, p.id);
      const g = Engine.currentGate(db, p.id);
      const risks = db.raid.filter((x) => x.project === p.id && x.status === "Open");
      const bens = (db.benefits ?? []).filter((x) => x.project === p.id && x.status !== "Withdrawn");
      return {
        project_id: p.id, project_name: p.name,
        programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel,
        pm_id: p.pm ?? null, phase: p.phase,
        rag: m?.health.rag ?? null, rag_why: m?.health.why ?? "",
        bac: fromM(m?.bac ?? 0), ac: fromM(m?.ac ?? 0), ev: fromM(m?.ev ?? 0),
        pv: fromM(m?.pv ?? 0), eac: fromM(m?.eac ?? 0), vac: fromM(m?.vac ?? 0),
        spi: m?.measurable ? m.spi : null,
        cpi: m?.measurable ? m.cpi : null,
        measurable: !!m?.measurable,
        pct_complete: m?.pctComplete ?? null,
        planned_complete: m?.plannedComplete ?? null,
        forecast_finish: m?.forecastFinish ?? null,
        baseline_finish: p.baselineFinish ?? null, finish_date: p.finish ?? null,
        gate_n: g?.n ?? null, gate_state: g?.state ?? null,
        open_risks: risks.length,
        steering_risks: risks.filter((x) => Engine.escalation(db, x).level === "Steering").length,
        benefits_promised: bens.length,
        benefits_measured: bens.filter((x) => x.actual != null).length,
        benefits_met: bens.filter((x) => x.status === "Realised").length,
      };
    });

    let id = null;
    await audited(req.user,
      () => ({ action: b.restates ? "Reporting period restated" : "Reporting period closed",
               entity: "report_period", entityId: id,
               detail: `${b.label} — ${rows.length} project(s) as at ${db.statusDate}` +
                       (b.restates ? ` (restates ${b.restates})` : ""),
               after: { label: b.label, statusDate: db.statusDate, projects: rows.length } }),
      async (t) => {
        id = await allocateId(t, "RP", { pad: 3 });
        await t.query(
          `INSERT INTO report_period
             (id, label, status_date, closed_by, closed_by_label, note, restates, projects)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, String(b.label).slice(0, 80), db.statusDate, req.user.id,
           `${req.user.displayName} (${req.user.role})`,
           String(b.note ?? "").slice(0, 1000), b.restates || null, rows.length]);
        if (rows.length) {
          await insertMany(t, "report_snapshot",
            ["period_id", "project_id", "project_name", "programme_id", "site_id",
             "governance_level", "pm_id", "phase", "rag", "rag_why",
             "bac", "ac", "ev", "pv", "spi", "cpi", "eac", "vac", "measurable",
             "pct_complete", "planned_complete", "forecast_finish", "baseline_finish",
             "finish_date", "gate_n", "gate_state", "open_risks", "steering_risks",
             "benefits_promised", "benefits_measured", "benefits_met"],
            rows.map((x) => ({ period_id: id, ...x })));
        }
      });
    res.status(201).json({ id, projects: rows.length, statusDate: db.statusDate });
  } catch (e) { next(e); }
});

/* ── the auditor's evidence pack (V-15) ───────────────────────────────
   "Everything about PRJ-118, as at 31 March" as one artifact. The trail
   was always there; what was missing was a way to hand it over without a
   database session and an afternoon. */

r.get("/projects/:id/evidence", async (req, res, next) => {
  try {
    const p = await project(req.params.id, req.user);
    gate(req.user, "project.read", { project: p });
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.asOf ?? "")) ? req.query.asOf : null;
    const db = await loadPortfolio(req.user);
    const proj = db.projects.find((x) => x.id === p.id);
    if (!proj) throw new HttpError(404, "No such project");
    const m = Engine.metrics(db, p.id);

    /* Everything the trail holds for this project, in order. Bounded by
       asOf where one is given, because "as at" is the whole point. */
    const events = await many(
      `SELECT at, user_label, action, entity, entity_id, detail
         FROM audit_event
        WHERE (
              (entity = 'project' AND entity_id = $1)
           OR entity_id IN (SELECT id FROM change_request WHERE project_id = $1)
           OR entity_id IN (SELECT id FROM raid_item      WHERE project_id = $1)
           OR entity_id IN (SELECT id FROM document       WHERE project_id = $1)
           OR entity_id IN (SELECT id FROM benefit        WHERE project_id = $1)
        )
        -- The OR chain MUST stay parenthesised: AND binds tighter, so an
        -- unbracketed "as at" would bound only the last branch and the
        -- pack would quietly carry events from after the date it claims.
        ${asOf ? "AND at < ($2::date + 1)" : ""}
        ORDER BY at`,
      asOf ? [p.id, asOf] : [p.id]);

    const docs = db.docs.filter((d) => d.project === p.id);
    const raid = db.raid.filter((x) => x.project === p.id);
    const crs = db.crs.filter((c) => c.project === p.id);
    const bens = (db.benefits ?? []).filter((b) => b.project === p.id);
    const periods = await many(
      `SELECT rp.id, rp.label, rp.status_date, s.rag, s.spi, s.cpi, s.eac
         FROM report_snapshot s JOIN report_period rp ON rp.id = s.period_id
        WHERE s.project_id = $1 ORDER BY rp.status_date`, [p.id]);

    const L = [];
    const rule = () => L.push("");
    L.push(`# Evidence pack — ${proj.name} (${proj.id})`);
    rule();
    L.push(`**As at:** ${asOf ?? db.statusDate}${asOf ? "" : " (current state)"}  `);
    L.push(`**Programme:** ${(Engine.programme(db, proj.programme) || {}).name ?? proj.programme}  `);
    L.push(`**Site:** ${(Engine.site(db, proj.site) || {}).city ?? proj.site}  `);
    L.push(`**Governed at:** ${proj.governanceLevel} level  `);
    L.push(`**Manager:** ${Engine.personName(db, proj.pm)}  `);
    L.push(`**Phase:** ${proj.phase}${proj.closed ? " (closed)" : ""}  `);
    L.push(`**Plant impact:** ${proj.plantImpact}` +
      (proj.mocApprovedOn ? ` · MOC ${proj.mocRef} released ${proj.mocApprovedOn} by ${proj.mocApprovedBy}` : ""));
    rule();

    L.push("## Position");
    rule();
    L.push("| Measure | Value |");
    L.push("|---|---|");
    L.push(`| Budget | ${proj.budget} M |`);
    L.push(`| Actual cost | ${m ? m.ac : "—"} M |`);
    L.push(`| Earned value | ${m ? m.ev : "—"} M |`);
    L.push(`| SPI | ${m && m.measurable ? m.spi.toFixed(2) : "—"} |`);
    L.push(`| CPI | ${m && m.measurable ? m.cpi.toFixed(2) : "—"} |`);
    L.push(`| Forecast | ${m ? m.eac : "—"} M |`);
    L.push(`| Health | ${m ? m.health.rag : "—"} — ${m ? m.health.why : ""} |`);
    rule();

    L.push("## What was promised");
    rule();
    if (!bens.length) L.push("_No benefit was stated for this project._");
    else {
      L.push("| Benefit | Measure | Baseline | Target | Actual | Status |");
      L.push("|---|---|---|---|---|---|");
      for (const b of bens) {
        L.push(`| ${b.title} | ${b.measure || "—"} ${b.unit} | ${b.baseline ?? "—"} | ${b.target ?? "—"} | ${b.actual ?? "—"} | ${b.status} |`);
      }
      if (proj.pirVerdict) {
        rule();
        L.push(`**Post-implementation review:** ${proj.pirVerdict} on ${proj.pirOn}. ${proj.pirNote}`);
      }
    }
    rule();

    L.push("## Gate evidence");
    rule();
    if (!docs.length) L.push("_No documents are filed against this project._");
    else {
      /* R-01/R-15 — the pack cites the artefact, not only the label: the
         link an auditor can open, and the address hash frozen at
         approval, which is what they compare. */
      L.push("| Document | Gate | Revision | Status | Owner | Artefact | Address hash at approval |");
      L.push("|---|---|---|---|---|---|---|");
      for (const d of docs) {
        L.push(`| ${d.name} | ${d.gate || "—"} | ${d.rev} | ${d.status} | ${Engine.personName(db, d.owner)} | ` +
          `${d.uri ? d.uri : "**none — not evidence**"} | ${d.uriHash ? d.uriHash.slice(0, 16) + "…" : "—"} |`);
      }
    }
    rule();

    L.push("## Change control");
    rule();
    if (!crs.length) L.push("_No change request was raised._");
    else {
      L.push("| Request | Cost | Weeks | Status | Steps signed |");
      L.push("|---|---|---|---|---|");
      for (const c of crs) {
        const signed = (c.steps || []).filter((s) => s.state === "done").length;
        L.push(`| ${c.id} — ${c.title} | ${c.cost} M | ${c.weeks} | ${c.status} | ${signed}/${(c.steps || []).length} |`);
      }
    }
    rule();

    L.push("## Risks and issues");
    rule();
    if (!raid.length) L.push("_The register is clear._");
    else {
      L.push("| Item | Type | Exposure | Status | Owner |");
      L.push("|---|---|---|---|---|");
      for (const x of raid) {
        L.push(`| ${x.id} — ${x.title} | ${x.type} | ${Engine.exposure(x)} | ${x.status} | ${Engine.personName(db, x.owner)} |`);
      }
    }
    rule();

    if (periods.length) {
      L.push("## As reported at each period close");
      rule();
      L.push("| Period | As at | Health | SPI | CPI | Forecast |");
      L.push("|---|---|---|---|---|---|");
      for (const q of periods) {
        L.push(`| ${q.label} | ${q.status_date} | ${q.rag ?? "—"} | ${q.spi == null ? "—" : Number(q.spi).toFixed(2)} | ${q.cpi == null ? "—" : Number(q.cpi).toFixed(2)} | ${q.eac == null ? "—" : Number(q.eac) / 1e6} M |`);
      }
      rule();
    }

    L.push("## The trail");
    rule();
    L.push(`${events.length} recorded event(s)${asOf ? ` up to ${asOf}` : ""}.`);
    rule();
    L.push("| When | Who | What | Detail |");
    L.push("|---|---|---|---|");
    for (const e of events) {
      L.push(`| ${String(e.at).slice(0, 19).replace("T", " ")} | ${e.user_label} | ${e.action} | ${String(e.detail ?? "").replace(/\|/g, "/")} |`);
    }
    rule();
    /* G-17 — ce qui sort du produit dit ce que c'est. Un dossier de
       preuve quitte l'outil et circule ensuite par courriel, par clé, par
       impression : il porte donc, sur lui, à qui il a été remis et ce
       qu'on peut en faire. Rien de cryptographique — une phrase qu'un
       lecteur comprend vaut mieux qu'un filigrane qu'il ignore. */
    L.push(`_Meridian IT-PMO · generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} for ${req.user.displayName}. ` +
      `The audit trail is append-only; these rows cannot have been edited after the fact._`);
    L.push("");
    L.push("**INTERNAL — governance evidence.** This pack names people and " +
      "decisions. Share it inside the group, or with an auditor who has asked " +
      "for it; it is not a public document.");

    const markdown = L.join("\n");
    await noteConsultation(req.user, "Evidence pack", p.id);   // R-14
    if (req.query.format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="evidence-${p.id}${asOf ? "-" + asOf : ""}.md"`);
      return res.send(markdown);
    }
    res.json({ markdown, events: events.length });
  } catch (e) { next(e); }
});

/* ── the BI extract (V-16) ────────────────────────────────────────────
   One flat row per project, so the portfolio can sit beside production
   and finance data in the group's own reporting rather than being
   retyped into it. */

r.get("/export/dataset", async (req, res, next) => {
  try {
    gate(req.user, "data.export");
    await noteConsultation(req.user, "Dataset export", "");   // R-14
    const db = await loadPortfolio(req.user);
    const rows = db.projects.map((p) => {
      const m = Engine.metrics(db, p.id);
      const g = Engine.currentGate(db, p.id);
      const raid = db.raid.filter((x) => x.project === p.id && x.status === "Open");
      const bens = (db.benefits ?? []).filter((b) => b.project === p.id && b.status !== "Withdrawn");
      const waves = (db.waves ?? []).filter((w) => w.project === p.id);
      return {
        project_id: p.id, project_name: p.name,
        programme: (Engine.programme(db, p.programme) || {}).name ?? p.programme,
        programme_id: p.programme,
        site: (Engine.site(db, p.site) || {}).city ?? p.site, site_id: p.site,
        governance_level: p.governanceLevel, manager: Engine.personName(db, p.pm),
        method: p.method, phase: p.phase, closed: p.closed ? 1 : 0,
        start_date: p.start, finish_date: p.finish, baseline_finish: p.baselineFinish,
        forecast_finish: m?.forecastFinish ?? "", slip_days: m?.slipDays ?? "",
        budget_m: p.budget, actual_cost_m: m?.ac ?? "", earned_value_m: m?.ev ?? "",
        forecast_m: m?.eac ?? "", variance_m: m?.vac ?? "",
        spi: m?.measurable ? m.spi : "", cpi: m?.measurable ? m.cpi : "",
        health: m?.health.rag ?? "", health_why: m?.health.why ?? "",
        gate: g?.n ?? "", gate_state: g?.state ?? "",
        open_risks: raid.length,
        steering_risks: raid.filter((x) => Engine.escalation(db, x).level === "Steering").length,
        benefits_promised: bens.length,
        benefits_measured: bens.filter((b) => b.actual != null).length,
        benefits_met: bens.filter((b) => b.status === "Realised").length,
        pir_verdict: p.pirVerdict ?? "",
        plant_impact: p.plantImpact, moc_released: p.mocApprovedOn ?? "",
        rollout_sites: waves.length, rollout_live: waves.filter((w) => w.status === "Live").length,
        priority_fit: p.fit ?? "", priority_value: p.value ?? "",
        priority_risk: p.risk ?? "", priority_effort: p.effort ?? "",
        priority_score: Engine.priority(p) ?? "", rank: p.rank ?? "",
        as_at: db.statusDate,
      };
    });

    if (req.query.format === "csv") {
      const cols = rows.length ? Object.keys(rows[0]) : [];
      /* Quote everything and double interior quotes — a project named
         "Ity, phase 2" must not become two columns in Excel. */
      /* S-04 — and neutralise formulas. A project may legitimately be
         named "=Ity phase 2"; a spreadsheet reads a leading =, +, - or @
         as code and will happily run it against the reader's own machine.
         A leading apostrophe makes the cell text again, which is what it
         always was — the export is data, never instructions. */
      const cell = (v) => {
        const s = String(v ?? "");
        const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      /* G-17 — un fichier qui sort dit ce qu'il est. Une ligne d'en-tête
         en commentaire plutôt qu'une colonne : elle voyage avec le
         fichier sans gêner qui l'ouvre dans un tableur, et elle nomme la
         personne à qui il a été remis. Un export anonyme se retrouve un
         jour sur une clé, et plus personne ne sait d'où il vient. */
      const stamp = `# INTERNAL — Meridian IT-PMO portfolio export · ` +
        `${db.statusDate} · issued to ${req.user.displayName} · ` +
        `${new Date().toISOString().slice(0, 10)} · share inside the group`;
      const csv = [stamp, cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="meridian-portfolio-${db.statusDate}.csv"`);
      return res.send("﻿" + csv);   // BOM, so Excel reads the accents
    }
    res.json({ asAt: db.statusDate, rows });
  } catch (e) { next(e); }
});

/* ── audit (R6.3) ─────────────────────────────────────────────────── */

r.get("/audit", async (req, res, next) => {
  try {
    gate(req.user, "audit.read");
    await noteConsultation(req.user, "Audit trail", "");   // R-14
    /* Express hands back an array for `?entity=a&entity=b` and an object
       for `?entity[x]=1`; either reaches the driver as a value no text
       column can be compared to, and answers 500 to a malformed link. */
    const str = (v) => (v === undefined || v === null ? undefined : String(v));
    const rows = await readAudit({
      user: str(req.query.user), entity: str(req.query.entity),
      entityId: str(req.query.entityId), action: str(req.query.action),
      limit: req.query.limit, before: str(req.query.before),
    });
    res.json({ events: rows });
  } catch (e) { next(e); }
});

/* ── restore from the trail (R-12) ────────────────────────────────────
   The audit trail always held the before-image of what a deletion
   removed; the product just never offered the repair it already had the
   material for. Restoring is ADDING: the row is re-inserted as it was,
   and a new audit line says it was a restoration — history is never
   rewritten. Children are not resurrected, and the answer says so. */

/* ── who looked (R-14) ────────────────────────────────────────────────
   The trail was exemplary on writes and silent on reads, and some
   obligations attach to having CONSULTED. Only the four sensitive
   surfaces are logged — evidence packs, exports, the decision register,
   the trail itself — because logging every read would drown the trail
   the control depends on. */
async function noteConsultation(user, what, entityId) {
  await tx(async (t) => record(t, user, {
    action: what + " consulted", entity: "consultation", entityId: entityId ?? "",
  }));
}

const RESTORABLE = new Set([
  "raid_item", "document", "milestone", "work_item", "benefit",
  "commitment", "rollout_wave", "site_window", "person_absence",
]);

r.post("/audit/:id/restore", async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      throw new HttpError(403, "Restoring from the trail is an administrator's act");
    }
    const ev = await one(
      `SELECT id, action, entity, entity_id, before_json FROM audit_event WHERE id = $1`,
      [req.params.id]);
    if (!ev) throw new HttpError(404, "No such audit event");
    if (!RESTORABLE.has(ev.entity)) {
      throw new HttpError(400, `A ${ev.entity} row is not restorable from the trail`);
    }
    const row = typeof ev.before_json === "string" ? JSON.parse(ev.before_json) : ev.before_json;
    if (!row || !row.id) {
      throw new HttpError(400, "This event carries no full before-image — older deletions predate the repair");
    }
    const already = await one(`SELECT 1 AS x FROM ${ev.entity} WHERE id = $1`, [row.id]);
    if (already) throw new HttpError(409, `${row.id} already exists — nothing to restore`);

    /* Column names come from our own audit image of our own table — and
       are still validated as plain identifiers before touching SQL. */
    const cols = Object.keys(row).filter((k) => /^[a-z_]+$/.test(k));
    const params = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");

    await audited(req.user,
      { action: "Restored from the trail", entity: ev.entity, entityId: row.id,
        detail: `re-created from audit event #${ev.id} (${ev.action})`,
        after: { ...row } },
      async (t) => t.query(
        `INSERT INTO ${ev.entity} (${cols.join(",")}) VALUES (${placeholders})`, params));
    res.status(201).json({ id: row.id, entity: ev.entity,
      note: "Children of the deleted row are not resurrected — only what this image held." });
  } catch (e) { next(e); }
});

/* ── "what changed since last week" (UX committee, value I-2) ─────────
   The append-only audit trail, turned from a compliance panel into the
   Monday-morning answer. Scoped to the caller's visible book — a site
   account reads its own slate's week, never the portfolio's — which is
   why this is NOT behind audit.read. */
const DIGEST_ACTIONS = [
  "Project status overridden", "Gate overridden", "Phase advanced",
  "Project re-baselined", "Governance level changed", "Project moved",
  "Change request raised", "Change request approved", "Change request rejected",
  "Risk raised", "Issue raised", "Cost booked", "Contingency released",
];

r.get("/digest", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read");
    const db = await loadPortfolio(req.user);
    const ids = db.projects.map((p) => p.id);

    /* R-02 — "this week" is FALSE for someone back from a 14-day roster.
       The window widens to cover the caller's most recent absence when it
       ended within the last few days, so the person who was away longest
       is the person whose digest reaches back furthest. Floor 7, cap 60. */
    let days = 7;
    let coveredFrom = null;
    if (req.user.personId) {
      const back = await one(
        `SELECT starts_on, ends_on FROM person_absence
          WHERE person_id = $1 AND ends_on >= CURRENT_DATE - 3 AND starts_on <= CURRENT_DATE
          ORDER BY ends_on DESC LIMIT 1`, [req.user.personId]);
      if (back) {
        const since = Math.ceil((Date.now() - D(back.starts_on).getTime()) / 86400000);
        days = Math.max(7, Math.min(60, since));
        coveredFrom = back.starts_on;
      }
    }

    if (!ids.length) return res.json({ days, coveredFrom, entries: [] });
    const rows = await many(
      `SELECT a.at, a.action, a.entity, a.entity_id, a.user_label, a.detail
         FROM audit_event a
         LEFT JOIN change_request c ON a.entity = 'change_request' AND c.id = a.entity_id
         LEFT JOIN raid_item ri     ON a.entity = 'raid_item'      AND ri.id = a.entity_id
        WHERE a.at > now() - ($3::int * interval '1 day')
          AND (a.action = ANY($1) OR a.action LIKE 'Site concern raised%')
          AND COALESCE(c.project_id, ri.project_id,
                CASE WHEN a.entity = 'project' THEN a.entity_id END) = ANY($2)
        ORDER BY a.at DESC
        LIMIT 60`,
      [DIGEST_ACTIONS, ids, days]
    );
    res.json({
      days,
      coveredFrom,
      entries: rows.map((a) => ({
        at: a.at, action: a.action, entity: a.entity, entityId: a.entity_id,
        by: a.user_label, detail: a.detail,
      })),
    });
  } catch (e) { next(e); }
});

/* ── the decision register (governance committee, G3) ─────────────────
   One surface joining what the audit trail and the meetings module each
   half-know: every consequential decision — above-threshold change
   approvals/rejections, re-baselines, gate overrides, governance moves,
   RAG overrides — plus decisions minuted in meetings, newest first.
   "Which above-threshold CRs were approved this quarter, by whom" stops
   being a SQL question. Group level and above, like the audit trail. */
const REGISTER_ACTIONS = [
  "Change request approved", "Change request rejected",
  "Project re-baselined", "Gate overridden", "Governance level changed",
  "Project moved", "Project status overridden",
];

/* A-08 — la mesure de l'adoption, au niveau groupe.
   `audit.read` la garde : c'est la même autorité que le registre des
   décisions, et pour la même raison — ce sont des chiffres sur la façon
   dont l'organisation se sert de l'outil, pas sur un projet. Ils sont
   agrégés par site et ne nomment jamais personne. */
r.get("/adoption", async (req, res, next) => {
  try {
    gate(req.user, "audit.read");
    const out = await adoptionBySite({ windowDays: Number(req.query.days) || 30 });
    res.json(out);
  } catch (e) { next(e); }
});

r.get("/decisions/log", async (req, res, next) => {
  try {
    gate(req.user, "audit.read");
    await noteConsultation(req.user, "Decision register", "");   // R-14
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const audits = await readAudit({ action: REGISTER_ACTIONS.join(","), limit });
    const minuted = await many(
      `SELECT d.id, d.headline, d.rationale, d.decided_by, d.referred_to_scope,
              o.meets_on, s.name AS series_name, s.scope_kind
         FROM meeting_decision d
         JOIN meeting_occurrence o ON o.id = d.occurrence_id
         JOIN meeting_series s ON s.id = o.series_id
        ORDER BY o.meets_on DESC, d.id DESC
        LIMIT $1`, [limit]);
    res.json({
      register: audits.map((a) => ({
        kind: "control", at: a.at, action: a.action, entity_id: a.entity_id,
        by: a.user_label, detail: a.detail,
        before: a.before_json ?? null, after: a.after_json ?? null,
      })),
      minuted: minuted.map((d) => ({
        kind: "meeting", id: d.id, headline: d.headline, rationale: d.rationale,
        by: d.decided_by, on: d.meets_on, series: d.series_name,
        scope: d.scope_kind, referred: d.referred_to_scope ?? null,
      })),
    });
  } catch (e) { next(e); }
});

export default r;

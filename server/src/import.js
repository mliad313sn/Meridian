/**
 * Book import (R2.6).
 *
 * The v4 build's export is a single JSON object in the engine's own field
 * names — which is exactly the shape the serialiser produces today. So an
 * export taken from the legacy file, or from this system, comes back in
 * without translation.
 *
 * Two things it deliberately does not import:
 *
 *   · accounts, sessions and grants — identity is not portfolio data, and
 *     a file should never be able to hand someone an administrator login;
 *   · the audit trail — history is append-only and belongs to the system
 *     that recorded it, not to whoever supplied the file (R6.2).
 */

import { tx } from "./db.js";
import { record } from "./audit.js";
import { fromM, allocationOut } from "./portfolio.js";
import { HttpError } from "./auth.js";
import { translate } from "./pgerror.js";

const PORTFOLIO_TABLES = [
  /* NEW-05 — the registers the importer did not know. Most would go by
     cascade with their project anyway; `lesson` would NOT (its project
     key is ON DELETE SET NULL, so the row survives a replace and the
     re-import collides with it), and naming every one is what makes
     "replace" mean replace rather than "whatever the cascade reaches".
     Children first: a reconfirmation before its case, an exception
     before its tolerance, a criterion before the document it cites, a
     link before the activity it points at. */
  "case_reconfirmation", "business_case", "project_exception", "project_tolerance",
  "gate_criterion", "ext_link", "benefit", "rollout_wave", "commitment", "timesheet",
  "lesson", "stakeholder", "comms_plan", "person_absence", "site_window",
  /* NEW-14 — the meeting register is book data now: an objection before
     the decision it objects to, and a review before the RAID item it
     looked at (the cascade would take it; naming it is what makes
     "replace" mean replace). */
  "decision_objection",
  "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
  "meeting_occurrence", "meeting_series",
  "raid_review",
  "seat_conflict", "seat",
  "finding", "evidence",
  "report_narrative", "work_item", "document", "allocation",
  "change_step", "change_request", "raid_item", "cost_line", "milestone",
  "requirement",
  "cross_dep", "activity_dep", "activity", "project",
  "programme", "person", "site",
];

/* NEW-20 — which table each list of the book fills. A replace deletes
   every table in PORTFOLIO_TABLES whatever the file carries, so a file
   with no meeting register (a KODO book, any export older than 5.21.0)
   erased the meeting register without a word. The dry run now says, per
   list, how many rows the database holds that the file would not bring
   back — computed from this map, before anything is deleted. */
export const BOOK_TABLES = {
  sites: "site", people: "person", programmes: "programme", projects: "project",
  activities: "activity", crossDeps: "cross_dep", milestones: "milestone",
  requirements: "requirement", crs: "change_request", raid: "raid_item", ledger: "cost_line",
  docs: "document", items: "work_item", allocations: "allocation",
  evidence: "evidence", findings: "finding", seats: "seat", objections: "decision_objection",
  windows: "site_window", absences: "person_absence", benefits: "benefit", waves: "rollout_wave",
  commitments: "commitment", timesheets: "timesheet", tolerances: "project_tolerance",
  exceptions: "project_exception", businessCases: "business_case",
  caseReconfirmations: "case_reconfirmation", lessons: "lesson", criteria: "gate_criterion",
  stakeholders: "stakeholder", comms: "comms_plan", extLinks: "ext_link",
  narrative: "report_narrative",
  meetingSeries: "meeting_series", meetings: "meeting_occurrence", decisions: "meeting_decision",
  actions: "meeting_action", raidReviews: "raid_review",
};

/** Does the file carry at least one row of this list? */
const carries = (v) => (Array.isArray(v) ? v.length > 0
  : v && typeof v === "object" ? Object.keys(v).length > 0 : false);

const clean = (v) => (v === undefined || v === "" ? null : v);
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
/* NEW-05 — a number that may be absent: absent stays absent (null), it
   does not become zero. A target probability of "none set" and one of 0
   are different statements. */
const num = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const intOrNull = (v) => (num(v) === null ? null : Math.round(Number(v)));
const origin = (v) => (v === "sdp" ? "sdp" : "local");

/* NEW-05 — references the file cannot vouch for.
   The header says it: accounts are not book data, and neither are the
   integrations (each carries a key hash). A column that names an
   `app_user` or an `integration` is therefore kept ONLY when that
   account or integration already exists in this database, and null
   otherwise — the row is book data and must come in; the name it
   carries is a pointer into a register the file does not own. On the
   product's own export the accounts are the same ones, so the pointer
   survives; from someone else's file it drops to null rather than
   failing the whole import on a foreign key. `$n` is the parameter. */
const USER = (n) => `(SELECT id FROM app_user WHERE id = $${n})`;
const INTEGRATION = (n) => `(SELECT id FROM integration WHERE id = $${n})`;

/* MER-09 — l'unité de la monnaie était implicite, et l'unité était le
   million. Dans le livre, `"budget": 4` voulait dire quatre millions ;
   rien ne le déclarait, rien ne le validait, rien ne refusait un livre
   qui s'était trompé. Un client qui migre depuis un tableur déjà libellé
   en unités importe un projet de 2,4 M€ à 2 400 000 000 000 € — et
   chaque RAG, chaque indice de coût et chaque revue de direction est
   faux pendant un mois, d'une façon qui ressemble à un bug d'affichage.

   Le livre DOIT donc dire son unité. Le refus est explicite : un import
   sans unité déclarée ne passe pas, parce qu'un import qui devine est
   exactement le mécanisme qu'on vient de décrire. */
export const CURRENCY_UNITS = ["millions", "units"];

export function moneyScale(book) {
  const u = book?.currencyUnit;
  if (!CURRENCY_UNITS.includes(u)) {
    throw new HttpError(400,
      'This book does not declare what its money means. Add "currencyUnit": ' +
      '"millions" or "units" to the file header. A budget of 4 is four million ' +
      "in one reading and four euros in the other, and importing the wrong one " +
      "corrupts every cost figure in the portfolio. A file exported by Meridian " +
      'before 5.17.0 meant millions: add "currencyUnit": "millions" to it (D-36.04).');
  }
  return u === "millions" ? fromM : (v) => Math.round(Number(v ?? 0) * 100) / 100;
}

/* Un import à blanc (MER-08). L'importateur tourne déjà dans une
   transaction : la simulation est donc LE MÊME chemin de code suivi
   d'une annulation, et non une seconde implémentation qui divergera.
   Une exception porte le résultat dehors parce que c'est ce qui
   provoque l'annulation. */
class DryRunComplete extends Error {
  constructor(payload) { super("dry run"); this.payload = payload; }
}

/* Le handle de fusion. Il ne touche QUE les insertions qui nomment une
   colonne `id` : les tables à clé composite (les arêtes
   d'incompatibilité, les présences) ou sans identifiant portent déjà
   leur propre `ON CONFLICT`, ou n'en ont pas besoin. Une insertion qui
   en déclare un est laissée intacte. */
const INSERT_HEAD = /^\s*INSERT INTO\s+(\w+)\s*\(([^)]*)\)/i;

/* NEW-16 (docs/36) — a merge rewrote rows without moving `row_version`, so
   a screen still holding the version it read before the import could
   write straight over what the import brought in: the concurrency check
   (CONTRIBUTING rule 3) held for every writer except the biggest one.

   For a table that carries `row_version`, the upsert now bumps it — but
   only when the row actually changes. A merge of a book onto itself
   rewrites every row with what it already holds; bumping those would
   send every open screen a false "someone else changed this" and would
   make two exports of an unchanged book differ (NEW-07). `versioned` is
   read from the schema at import time (`versionedTables`), never kept by
   hand: a table that gains the column is covered the day it does. */
export const bumpIfChanged = (table, cols, next) =>
  `row_version = ${table}.row_version + CASE WHEN ROW(${cols.map((c) => `${table}.${c}`).join(", ")})
     IS DISTINCT FROM ROW(${next.join(", ")}) THEN 1 ELSE 0 END`;

export async function versionedTables(t) {
  const r = await t.query(
    `SELECT table_name FROM information_schema.columns
      WHERE column_name = 'row_version' AND table_schema = current_schema()`);
  return new Set((r.rows ?? []).map((x) => x.table_name));
}

export function upsertHandle(t, versioned = new Set()) {
  return {
    ...t,
    query(sql, params) {
      const m = typeof sql === "string" ? sql.match(INSERT_HEAD) : null;
      if (!m || /ON CONFLICT/i.test(sql)) return t.query(sql, params);
      const cols = m[2].split(",").map((c) => c.trim()).filter(Boolean);
      if (!cols.includes("id")) return t.query(sql, params);
      const data = cols.filter((c) => c !== "id" && c !== "row_version");
      const sets = data.map((c) => `${c} = EXCLUDED.${c}`);
      if (!sets.length) return t.query(`${sql} ON CONFLICT (id) DO NOTHING`, params);
      const table = m[1];
      if (versioned.has(table)) sets.push(bumpIfChanged(table, data, data.map((c) => `EXCLUDED.${c}`)));
      return t.query(`${sql} ON CONFLICT (id) DO UPDATE SET ${sets.join(", ")}`, params);
    },
  };
}

/**
 * @param {object}  book
 * @param {object}  user
 * @param {object}  opts
 * @param {boolean} opts.dryRun  valider et tout annuler : rien n'est écrit
 * @param {string}  opts.mode    "replace" (défaut) ou "merge" par identifiant
 */
export async function importBook(book, user, opts = {}) {
  const counts = {};
  const dryRun = opts.dryRun === true;
  /* « replace » reste le défaut : c'est le comportement qu'ont les
     livres existants et les scripts qui les chargent. « merge » est ce
     qu'il faut quand le portefeuille est ENGENDRÉ par un système de
     référence — le nôtre l'est, et chaque régénération était jusqu'ici
     un rechargement destructif complet. */
  const mode = opts.mode === "merge" ? "merge" : "replace";
  const money = moneyScale(book);
  const rejects = [];

  /* 5.9.1 — a refused row used to answer only "One of those values is not
     in a form the system can read", with nothing in the log: on a book of
     a few hundred rows the operator could not tell which one. Every insert
     now names its table and the row's id when it fails. */
  const locate = (raw) => ({
    ...raw,
    query: (sql, params) => raw.query(sql, params).catch((e) => {
      const table = /^\s*(?:INSERT INTO|UPDATE)\s+(\w+)/i.exec(sql)?.[1];
      if (table && !e.importAt) e.importAt = `${table} ${params?.[0] ?? ""}`.trim();
      throw e;
    }),
  });
  const located = (e) => {
    if (!e.importAt) throw e;
    const known = translate(e);
    console.error(`import refused at ${e.importAt}: ${e.message}`);
    throw new HttpError(400, `${known?.message ?? "That row could not be imported"} — ${e.importAt}`);
  };

  const wouldErase = {};
  /* NEW-19 — the highest row_version each table held before the replace. */
  const versionFloor = new Map();

  const run = async (tracked) => {
    const raw = locate(tracked);
    if (mode === "replace") {
      /* NEW-20 — what the replace would erase that the file does not
         bring back, list by list, read before the delete. A list the
         file carries is replaced by it and is not "erased". */
      for (const [key, table] of Object.entries(BOOK_TABLES)) {
        if (carries(book[key])) continue;
        const r = await raw.query(`SELECT count(*)::int AS n FROM ${table}`);
        const n = r.rows?.[0]?.n ?? 0;
        if (n > 0) wouldErase[key] = n;
      }
      /* NEW-19 — a replace inserted every row at version 1, so a screen
         holding version 1 of a row that had been at 7 before the import
         could write straight over what the import brought in (and one
         holding 7 was refused for the wrong reason). The rule: after a
         replace, every row of a table is at a version strictly greater
         than ANY version that table held before it — the table's maximum
         plus one — so no version a screen read before the import can
         match. Read here, applied after the inserts below. */
      const versioned = await versionedTables(raw);
      for (const table of PORTFOLIO_TABLES) {
        if (!versioned.has(table)) continue;
        const r = await raw.query(`SELECT COALESCE(MAX(row_version), 0)::int AS m FROM ${table}`);
        versionFloor.set(table, r.rows?.[0]?.m ?? 0);
      }
      for (const table of PORTFOLIO_TABLES) await raw.query(`DELETE FROM ${table}`);
    }
    /* MER-08 · la fusion par identifiant.
       Un portefeuille est souvent ENGENDRÉ par un système de référence
       — le nôtre l'est — et chaque régénération était jusqu'ici un
       rechargement destructif complet : tout ce qui avait été saisi à
       la main entre deux régénérations disparaissait.

       La fusion ne duplique PAS les insertions. Elle enveloppe le
       handle de transaction et transforme chaque `INSERT INTO … (id, …)`
       en `… ON CONFLICT (id) DO UPDATE SET …`. Deux jeux d'insertions
       divergeraient au troisième correctif ; un seul, plus une règle
       déclarée en un seul endroit, ne le peuvent pas. */
    const t = mode === "merge" ? upsertHandle(raw, await versionedTables(raw)) : raw;
    /* NEW-16 — the in-place UPDATEs below (a site's champion, a
       document's supersession, a decision's links) rewrite a row the
       merge handle never sees, so they say their own bump. In replace
       mode the row was inserted a moment ago, and NEW-19 moves every
       replaced table past its old versions once all rows are in. */
    const bump = (table, cols, next) => (mode === "merge" ? ", " + bumpIfChanged(table, cols, next) : "");

    /* ── reference ────────────────────────────────────────────────── */
    for (const s of book.sites ?? []) {
      await t.query(
        `INSERT INTO site (id, city, region, tz_offset, tz_name, headcount, fte, charter,
                           country, legal_entity, link_mbps, link_kind, readiness, readiness_note,
                           active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [s.id, s.city, s.region ?? "", Number(s.tz ?? 0), s.tzName ?? "UTC",
         int(s.headcount), int(s.fte), s.role ?? s.charter ?? "",
         /* NEW-05 — what the site is (V-07, MC-01), not only where. */
         s.country ?? "", s.legalEntity ?? "", num(s.linkMbps), s.linkKind ?? "",
         ["Unknown", "Not ready", "Preparing", "Ready"].includes(s.readiness) ? s.readiness : "Unknown",
         s.readinessNote ?? "",
         /* NEW-18 — the book carries inactive rows too; absent means
            active, which is what every older file meant. */
         s.active !== false]);
    }
    for (const p of book.people ?? []) {
      await t.query(
        `INSERT INTO person (id, name, job_role, site_id, day_rate,
                             employment, rotation, availability, supplier, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, p.name, p.role ?? "", p.site, Number(p.rate ?? 0),
         /* NEW-05 — how this person actually works (V-09): a fly-in
            contractor on four-and-two came back as staff at 100 %. */
         p.employment === "contractor" ? "contractor" : "staff", p.rotation ?? "",
         Math.max(0, Math.min(100, int(p.availability, 100))), p.supplier ?? "",
         p.active !== false]);
    }
    // the site champion second, so the person exists (A-12)
    for (const s of book.sites ?? []) {
      if (s.champion) {
        await t.query(`UPDATE site SET champion_id = $2${bump("site", ["champion_id"], ["$2::text"])}
                        WHERE id = $1`, [s.id, s.champion]);
      }
    }
    for (const g of book.programmes ?? []) {
      await t.query(
        `INSERT INTO programme (id, name, sponsor, manager_id, gate_model, origin, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        /* NEW-05 — the programme's own ladder (I-3). Dropping it put every
           project of a six-gate programme back on the default four. */
        [g.id, g.name, g.sponsor ?? "", clean(g.managerId),
         g.gateModel == null ? null : JSON.stringify(g.gateModel), origin(g.origin),
         g.active !== false]);
    }
    for (const c of book.columns ?? []) {
      await t.query(`INSERT INTO board_column (id, name, seq, wip) VALUES ($1,$2,$3,$4)
                     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, wip = EXCLUDED.wip`,
        [c.id, c.name ?? c.label ?? c.id, (book.columns ?? []).indexOf(c), int(c.wip)]);
    }

    /* ── projects and their detail ────────────────────────────────── */
    for (const p of book.projects ?? []) {
      await t.query(
        `INSERT INTO project
           (id, name, programme_id, site_id, governance_level, pm_id, method,
            start_date, finish_date, baseline_finish, budget, contingency,
            contingency_used, description, phase, gate, health_override, closed,
            gate_loop,
            health_override_why, origin, scaffolded_gates, pir_on, pir_verdict, pir_note,
            ops_accepted_by, benefits_owner_id, closure_note, closed_on,
            date_basis, condition, sponsor_id, acceptance_criteria,
            plant_impact, moc_ref, moc_approved_on, moc_approved_label,
            fit_score, value_score, risk_score, effort_score, rank_seq,
            external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                 $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
                 $38,$39,$40,$41,$42,${INTEGRATION(43)},$44)`,
        [p.id, p.name, p.programme, p.site,
         p.governanceLevel === "group" ? "group" : "site",
         clean(p.pm), p.method ?? "Hybrid",
         p.start, p.finish, p.baselineFinish ?? p.finish,
         money(p.budget), money(p.contingency), money(p.contingencyUsed),
         p.desc ?? "", p.phase ?? "Initiation", int(p.gate),
         ["G", "A", "R"].includes(p.healthOverride) ? p.healthOverride : null,
         !!p.closed,
         Math.max(1, int(p.loop, 1)),
         /* NEW-05 — everything a project learned to say after R2.6: why
            its health was overridden, which ladder it was scaffolded on
            (E-1), its post-implementation review (V-01), the three
            signatures of its closure (PM-08), what its date rests on
            (REQ-19), what it reaches into (V-03) and where it sits in the
            queue (V-04). Each came back empty, and a closed project read
            as one nobody had accepted. `ladderDiffers` is not imported:
            the serialiser derives it from `scaffoldedGates` and the
            programme's ladder, both of which now are. */
         p.healthOverrideWhy ?? "", origin(p.origin), intOrNull(p.scaffoldedGates),
         clean(p.pirOn), ["Met", "Partly met", "Missed"].includes(p.pirVerdict) ? p.pirVerdict : null,
         p.pirNote ?? "",
         clean(p.opsAcceptedBy), clean(p.benefitsTo), p.closureNote ?? "", clean(p.closedOn),
         p.dateBasis === "placeholder" ? "placeholder" : "committed", p.condition ?? "",
         clean(p.sponsor), p.acceptanceCriteria ?? "",
         ["none", "plant", "safety"].includes(p.plantImpact) ? p.plantImpact : "none",
         p.mocRef ?? "", clean(p.mocApprovedOn), p.mocApprovedBy ?? "",
         intOrNull(p.fit), intOrNull(p.value), intOrNull(p.risk), intOrNull(p.effort),
         intOrNull(p.rank),
         clean(p.externalSource), clean(p.externalId)]);
    }
    for (const a of book.activities ?? []) {
      await t.query(
        `INSERT INTO activity (id, project_id, name, stage, start_date, end_date,
                               base_start, base_end, weight, pct, owner_id,
                               progress_source, progress_at, origin, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,${INTEGRATION(15)},$16)`,
        [a.id, a.project, a.name, int(a.stage), a.start, a.end,
         a.baseStart ?? a.start, a.baseEnd ?? a.end,
         Number(a.weight ?? 0), Math.max(0, Math.min(100, int(a.pct))), clean(a.owner),
         /* NEW-05 — who measured this progress, and when (I-5): without
            it a figure pushed by the site's scheduler reads as typed here. */
         a.progressSource ?? "", clean(a.progressAt), origin(a.origin),
         clean(a.externalSource), clean(a.externalId)]);
    }
    // dependencies second, so both ends exist
    for (const a of book.activities ?? []) {
      for (const dep of a.deps ?? []) {
        await t.query(
          `INSERT INTO activity_dep (activity_id, predecessor_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`, [a.id, dep]);
      }
    }
    for (const c of book.crossDeps ?? []) {
      /* NEW-07 — `cross_dep` has only a serial id, which the export does
         not write, so a merge inserted every edge a second time. The
         edge's identity is its two ends: the label is updated in place,
         and the edge is inserted only where it is not already drawn. In
         replace mode the table is empty and this is a plain insert. */
      const edge = [c.from, int(c.fromStage), c.to, int(c.toStage), c.label ?? ""];
      await t.query(
        `UPDATE cross_dep SET label = $5
          WHERE from_project = $1 AND from_stage = $2 AND to_project = $3 AND to_stage = $4`,
        edge);
      await t.query(
        `INSERT INTO cross_dep (from_project, from_stage, to_project, to_stage, label)
         SELECT $1::text, $2::int, $3::text, $4::int, $5::text
          WHERE NOT EXISTS (SELECT 1 FROM cross_dep
                             WHERE from_project = $1 AND from_stage = $2
                               AND to_project = $3 AND to_stage = $4)`,
        edge);
    }
    for (const m of book.milestones ?? []) {
      await t.query(
        `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind,
                                owner_id, done, gate_loop,
                                intrusive, acceptance_criteria, accepted_by, accepted_on,
                                date_basis, condition, retired_gate, origin,
                                external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                 ${INTEGRATION(19)},$20)`,
        [m.id, m.project, m.name, m.date, m.baseDate ?? m.date,
         m.gate ?? null, m.kind === "gate" ? "gate" : "milestone", clean(m.owner), !!m.done,
         Math.max(1, int(m.loop, 1)),
         /* NEW-05 — whether it stops the plant (V-03), what it must show
            and who saw it shown (PM-04), what its date is worth (REQ-14),
            and the rung it held before a ladder move retired it (REQ-27). */
         m.intrusive === true, m.acceptanceCriteria ?? "", clean(m.acceptedBy), clean(m.acceptedOn),
         m.dateBasis === "placeholder" ? "placeholder" : "committed", m.condition ?? "",
         intOrNull(m.retiredGate), origin(m.origin),
         clean(m.externalSource), clean(m.externalId)]);
    }
    /* MER-03 — les exigences. Elles arrivent APRÈS les projets parce
       qu'une exigence sans projet pour la tenir n'a personne pour la
       tenir, et la clé étrangère le dit. */
    for (const r of book.requirements ?? []) {
      const status = ["Not started", "In progress", "Done", "Waived"].includes(r.status)
        ? r.status : "Not started";
      const reason = r.waiverReason ?? "";
      if (status === "Waived" && !String(reason).trim()) {
        throw new HttpError(400,
          `Requirement ${r.id} is waived with no reason. ` +
          `A waiver without a reason is how a requirement disappears ` +
          `without anybody deciding to drop it.`);
      }
      await t.query(
        `INSERT INTO requirement
           (id, project_id, statement, source, priority, verification, verified_by,
            gate_n, status, waiver_reason, owner_id, updated_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [r.id, clean(r.project), r.statement ?? "", r.source ?? "",
         ["M", "S", "C", "W"].includes(r.priority) ? r.priority : "M",
         r.verification ?? "", r.verifiedBy ?? "",
         r.gate === undefined || r.gate === null ? null : int(r.gate),
         status, reason, clean(r.owner),
         r.updated ?? new Date().toISOString().slice(0, 10)]);
    }
    /* NEW-05 — the order is now changes, then RAID, then the ledger:
       a risk names the change that carries it (I-8), and a contingency
       draw names the risk it funds (PM-06). The old order (ledger, RAID,
       changes) could not have carried either pointer. */
    for (const c of book.crs ?? []) {
      await t.query(
        `INSERT INTO change_request (id, project_id, title, description, raised_by, raised_on,
                                     cost_delta, weeks_delta, funding, risk_delta, status, applied,
                                     raised_by_user)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${USER(13)})`,
        [c.id, c.project, c.title, c.desc ?? "", clean(c.raisedBy), c.raised,
         money(c.cost), int(c.weeks), c.funding ?? "Contingency", c.riskDelta ?? "0",
         ["Pending", "Approved", "Rejected"].includes(c.status) ? c.status : "Pending",
         !!c.applied, clean(c.raisedByUser)]);
      const steps = c.steps ?? [];
      for (let i = 0; i < steps.length; i++) {
        const st = steps[i];
        /* NEW-07 — `change_step` has no id the export writes: its identity
           is (cr_id, seq), and the merge handle only rewrites inserts that
           name an `id`. So a merge-mode import of the product's own export
           hit the unique key on the first step and answered 400. The step
           now says its own conflict rule, which is the handle's contract
           for a table without an id. */
        await t.query(
          `INSERT INTO change_step (cr_id, seq, role_label, note, state, decided_on, comment,
                                    decided_by_person, decided_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${USER(9)})
           ON CONFLICT (cr_id, seq) DO UPDATE
             SET role_label = EXCLUDED.role_label, note = EXCLUDED.note, state = EXCLUDED.state,
                 decided_on = EXCLUDED.decided_on, comment = EXCLUDED.comment,
                 decided_by_person = EXCLUDED.decided_by_person, decided_by = EXCLUDED.decided_by`,
          /* PR-04 — who signed comes back with the step: the one-signatory
             rule reads it, and a chain imported without it would let its
             signers sign again. The account resolves like every other
             account reference (an unknown one reads NULL, never a guess). */
          [c.id, i, st.role ?? "Step " + (i + 1), st.note ?? "",
           ["waiting", "current", "done", "rejected"].includes(st.state) ? st.state : "waiting",
           clean(st.when), st.comment ?? "", clean(st.by), clean(st.byUser)]);
      }
      /* The file states the whole route: on a merge, a step the database
         holds past the file's last one is not the file's route. */
      if (mode === "merge" && Array.isArray(c.steps)) {
        await t.query(`DELETE FROM change_step WHERE cr_id = $1 AND seq >= $2`, [c.id, steps.length]);
      }
    }
    for (const x of book.raid ?? []) {
      await t.query(
        `INSERT INTO raid_item (id, project_id, kind, title, detail, probability, impact,
                                status, response, owner_id, opened_on, review_on,
                                target_probability, target_impact, gate, cr_id, category,
                                closed_on, closed_by, origin_site, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 ${INTEGRATION(21)},$22)`,
        [x.id, clean(x.project), x.type ?? "Risk", x.title, x.detail ?? "",
         Math.max(1, Math.min(5, int(x.p, 1))), Math.max(1, Math.min(5, int(x.i, 1))),
         x.status === "Closed" ? "Closed" : "Open", x.response ?? "Monitor",
         clean(x.owner), x.opened, clean(x.review),
         /* NEW-05 — what the response is meant to achieve (PM-06; null
            when nothing is targeted, never an invented 1), the gate and
            change it stands against (I-8), the source register's own word
            for it (REQ-13), when and on whose word it closed (REQ-18), and
            the site that raised it. */
         num(x.tp) === null ? null : Math.max(1, Math.min(5, int(x.tp))),
         num(x.ti) === null ? null : Math.max(1, Math.min(5, int(x.ti))),
         intOrNull(x.gate), clean(x.cr), x.category ?? "",
         clean(x.closedOn), clean(x.closedBy), clean(x.originSite),
         clean(x.externalSource), clean(x.externalId)]);
    }
    /* NEW-05 — the ledger comes back as it was written. It used to be
       re-numbered and rewritten "Imported", "Labour", USD, capex, on the
       first of the month and not from contingency — so a euro opex
       contract posted on the 17th and drawn from contingency came back as
       a dollar capex labour line, and the contingency drawn read as
       unspent. The id is kept (like the allocations, MER-14) and the
       sequence follows it below.

       The ledger is append-only (CONTRIBUTING): a merge NEVER rewrites a
       posting it already holds. The same id with the same content is the
       same posting; the same id with different content is refused by
       name, because correcting a posting is a reversing entry, not an
       import. A line from a book with no ids (the v4 file) is appended
       and keeps the old defaults, which is all that file could say. */
    for (const l of book.ledger ?? []) {
      const hasId = !(l.id === undefined || l.id === null || l.id === "");
      const cols = `project_id, period, booked_on, amount, category, note, from_contingency,
                    kind, currency, fx_rate, amount_local, risk_id, created_by`;
      const vals = [l.project, l.period, clean(l.bookedOn) ?? l.period + "-01", money(l.amount),
        l.category ?? "Labour", l.note ?? "Imported", l.fromContingency === true,
        l.kind === "opex" ? "opex" : "capex", l.currency ?? "USD",
        num(l.fx) ?? 1, num(l.amountLocal) === null ? null : money(l.amountLocal),
        clean(l.risk), clean(l.createdBy)];
      if (!hasId) {
        await t.query(
          `INSERT INTO cost_line (${cols})
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${USER(13)})`, vals);
        continue;
      }
      const r = await t.query(
        `INSERT INTO cost_line (id, ${cols})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,${USER(14)})
         ON CONFLICT (id) DO NOTHING RETURNING id`, [int(l.id), ...vals]);
      if (!(r.rows ?? []).length) {
        const held = (await t.query(
          `SELECT project_id, period, amount FROM cost_line WHERE id = $1`, [int(l.id)])).rows?.[0];
        if (!held || held.project_id !== l.project || held.period !== l.period
            || Number(held.amount) !== money(l.amount)) {
          rejects.push({ table: "cost_line", id: String(l.id),
            reason: "this ledger already holds a different posting under that number — " +
                    "the ledger is append-only, correct it by a reversing entry" });
        }
      }
    }
    /* MER-14 — deux corrections sur la même table.

       1. L'identité SURVIT à l'aller-retour. `allocation` était la seule
          table dont l'export puis le réimport renumérotait chaque ligne,
          si bien que comparer deux exports montrait toujours toutes les
          allocations comme modifiées. Un contrôle que les gens
          apprennent à ignorer n'est plus un contrôle.

       2. Une clé inconnue est REFUSÉE. `pct` est un pourcentage ; un
          livre qui écrit `fte` — c'est ainsi que la plupart des outils
          de charge expriment la même idée — était accepté en silence et
          atterrissait à 0 %, donc une équipe apparaissait affectée à un
          projet sans aucune capacité dessus. C'est le mode de panne de
          MER-09 (l'unité implicite) à un deuxième endroit : le champ est
          pris, le nombre est faux, et rien ne le dit. */
    /* NEW-01 (docs/36) — the accepted keys are whatever the export
       writes, read from its serialiser, never a second hand-kept list. */
    const ALLOCATION_KEYS = new Set(Object.keys(allocationOut({})));
    for (const a of book.allocations ?? []) {
      const unknown = Object.keys(a).filter(k => !ALLOCATION_KEYS.has(k));
      if (unknown.length) {
        throw new HttpError(400,
          `Allocation for ${a.person ?? "?"} on ${a.project ?? "?"} has ` +
          `no such field: ${unknown.join(", ")}. ` +
          `An allocation is a percentage of time, in "pct".`);
      }
      if (a.id === undefined || a.id === null || a.id === "") {
        await t.query(
          `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct, capitalised)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [a.person, a.project, a.from, a.to, Math.max(0, Math.min(200, int(a.pct))),
           a.capitalised !== false]);
      } else {
        await t.query(
          `INSERT INTO allocation (id, person_id, project_id, from_date, to_date, pct, capitalised)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [int(a.id), a.person, a.project, a.from, a.to,
           Math.max(0, Math.min(200, int(a.pct))), a.capitalised !== false]);
      }
    }
    for (const d of book.docs ?? []) {
      await t.query(
        `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision,
                               status, updated_on, gate_loop, uri, uri_locked_hash, uri_locked_on,
                               probe_state, probed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [d.id, clean(d.project), d.name, d.type ?? "Assurance", int(d.gate),
         clean(d.owner), d.rev ?? "0.1",
         ["Draft", "In review", "Approved", "Superseded"].includes(d.status) ? d.status : "Draft",
         d.updated ?? new Date().toISOString().slice(0, 10),
         Math.max(1, int(d.loop, 1)),
         /* R-01 (5.9.1) — evidence is an approved document that points at
            something. Dropping the uri turned every imported approved
            document back into a label, and every cleared gate into an
            overdue one. */
         d.uri ?? "", d.uriHash ?? "", clean(d.uriLockedOn),
         /* NEW-05 — whether the link answered at the last pass (N-07): a
            fact, not a judgement, and one the next probe overwrites. */
         ["never", "ok", "unreachable", "forbidden"].includes(d.probeState) ? d.probeState : "never",
         clean(d.probedAt)]);
    }
    // supersession second, so both ends exist
    for (const d of book.docs ?? []) {
      if (d.supersedes) {
        await t.query(`UPDATE document SET supersedes = $2${bump("document", ["supersedes"], ["$2::text"])}
                        WHERE id = $1`, [d.id, d.supersedes]);
      }
    }
    for (const i of book.items ?? []) {
      await t.query(
        `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority,
                                created_on, source, score, score_method,
                                external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,${INTEGRATION(12)},$13)`,
        /* MER-05 — d'où vient cet élément et combien il vaut. Un
           arriéré d'améliorations arrive d'une revue de jalon, d'un
           panel d'enfants ou de la télémétrie, et il est noté par une
           méthode déclarée. L'import n'en gardait qu'une lettre de
           priorité, ce qui perdait les trois. */
        [i.id, i.project, i.column, i.title, clean(i.assignee),
         int(i.points, 1), i.priority ?? "P3", i.created ?? new Date().toISOString().slice(0, 10),
         i.source ?? "",
         Number.isFinite(Number(i.score)) && i.score !== null && i.score !== "" ? Number(i.score) : null,
         i.scoreMethod ?? "",
         // NEW-05 — the system that pushed it, and its name there (I-2)
         clean(i.externalSource), clean(i.externalId)]);
    }
    /* ── la gouvernance (MER-05, MER-06, MER-07, MER-11) ───────────
       L'ordre compte : une pièce de preuve avant le constat qui la
       cite, un siège avant l'objection qui le porte. */
    for (const e of book.evidence ?? []) {
      if (!e.document && !e.uri) {
        rejects.push({ table: "evidence", id: e.id,
          reason: "evidence needs a document or a URI — a proof with neither is an assertion" });
        continue;
      }
      await t.query(
        `INSERT INTO evidence (id, project_id, document_id, kind, name, uri, digest,
                               gate_n, gate_loop, captured_on, captured_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [e.id, clean(e.project), clean(e.document), e.kind ?? "document",
         e.name ?? e.id, e.uri ?? "", e.digest ?? "",
         e.gate === undefined || e.gate === null ? null : int(e.gate),
         Math.max(1, int(e.loop, 1)),
         e.capturedOn ?? new Date().toISOString().slice(0, 10), clean(e.capturedBy)]);
    }
    for (const f of book.findings ?? []) {
      /* La contrainte de base refuserait la ligne ; l'import la refuse
         d'abord, pour pouvoir DIRE laquelle et pourquoi plutôt que de
         faire échouer le fichier entier sur une erreur SQL. */
      if (f.status === "Closed" && !f.closedEvidence) {
        rejects.push({ table: "finding", id: f.id,
          reason: "a finding closes on re-test evidence, never on a merged fix" });
        continue;
      }
      await t.query(
        `INSERT INTO finding (id, project_id, requirement_id, gate_n, gate_loop,
                              observed_fact, why_it_matters, severity, owner_id,
                              proposed_fix, raised_on, retest_on, status,
                              closed_evidence_id, waiver_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [f.id, clean(f.project), clean(f.requirement),
         f.gate === undefined || f.gate === null ? null : int(f.gate),
         Math.max(1, int(f.loop, 1)),
         f.observedFact ?? "", f.whyItMatters ?? "",
         ["S1", "S2", "S3", "S4"].includes(f.severity) ? f.severity : "S3",
         clean(f.owner), f.proposedFix ?? "",
         f.raisedOn ?? new Date().toISOString().slice(0, 10), clean(f.retestOn),
         ["Open", "In progress", "Re-test", "Closed", "Waived"].includes(f.status) ? f.status : "Open",
         clean(f.closedEvidence), f.waiverReason ?? ""]);
    }
    for (const st of book.seats ?? []) {
      await t.query(
        `INSERT INTO seat (id, name, person_id, domain, veto_domain, observer, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [st.id, st.name ?? st.id, clean(st.person), st.domain ?? "",
         clean(st.vetoDomain), st.observer === true, st.active !== false]);
    }
    /* Les incompatibilités après TOUS les sièges, et symétriques : une
       arête posée dans un seul sens laisse la moitié de la séparation
       des devoirs sans effet. */
    for (const st of book.seats ?? []) {
      /* NEW-04 — the export now writes each edge with its own reason
         (`conflicts`); a hand-written book may still give the bare list
         and one reason for all of them. */
      const edges = Array.isArray(st.conflicts) && st.conflicts.length
        ? st.conflicts.map((c) => ({ other: c.other, reason: c.reason ?? "" }))
        : (st.incompatibleWith ?? []).map((other) => ({ other, reason: st.conflictReason ?? "" }));
      for (const { other, reason } of edges) {
        for (const [a, b] of [[st.id, other], [other, st.id]]) {
          await t.query(
            `INSERT INTO seat_conflict (seat_id, other_id, reason) VALUES ($1,$2,$3)
             ON CONFLICT (seat_id, other_id) DO NOTHING`,
            [a, b, reason]);
        }
      }
    }
    /* La séparation des devoirs, vérifiée UNE FOIS TOUTES LES ARÊTES
       POSÉES. Le déclencheur de base protège les écritures ultérieures,
       mais il ne peut rien voir pendant un import : au moment où le
       premier siège arrive, ni le second ni l'incompatibilité entre eux
       n'existent encore. Le refus dit qui tient quoi, plutôt que de
       laisser tomber une erreur SQL sur le fichier entier. */
    const clashes = await t.query(
      `SELECT a.name AS a_name, b.name AS b_name, p.name AS person
         FROM seat_conflict c
         JOIN seat a ON a.id = c.seat_id
         JOIN seat b ON b.id = c.other_id
         LEFT JOIN person p ON p.id = a.person_id
        WHERE a.person_id IS NOT NULL AND a.person_id = b.person_id AND a.id < b.id`);
    const clash = (clashes.rows ?? [])[0];
    if (clash) {
      throw new HttpError(400,
        `Segregation of duties: ${clash.person ?? "one person"} holds both ` +
        `${clash.a_name} and ${clash.b_name}, which this book itself declares ` +
        "incompatible. A seat that must be able to refuse a mechanism cannot be " +
        "held by the person who designed it.");
    }

    /* ── NEW-14 · the meeting register and the RAID reviews ───────────
       The export wrote none of them and a replace import deletes every
       meeting table, so an export → import erased the governance record:
       every series, meeting, frozen agenda, attendance, decision, action
       and review. They come in here, after everything they point at
       (programmes, sites, people, projects, changes, RAID, milestones,
       evidence) and before the objections, which cite a decision.

       Importing is a RESTORE, not an edit — but it does not make a state
       the product forbids:
         · an agenda is frozen when its meeting closes and computed live
           before (R5.2/R5.8): a meeting that is not closed takes no
           agenda rows, and the file's are refused by name;
         · in a merge, a meeting this database already holds CLOSED is
           final (R5.5): it is not reopened, its frozen agenda and
           attendance are not rewritten, and no decision or action is
           added to its record. Where the file's copy differs from what
           is held, `rejects` says so; where it is the same, nothing is
           said, because nothing was refused;
         · in a merge, a decision already on the record keeps its
           substance (D-33.3 — the contract refuses the same change with
           a 409): the file may move its state — status, ratification,
           evidence, links — but a different headline, rationale,
           decider, day or room is a new decision, refused by name.
       Accounts and integrations are pointers the file cannot vouch for
       (USER / INTEGRATION above). */
    const OCC_STATUS = ["scheduled", "open", "closed"];
    const ATTENDANCE = ["present", "apologies", "absent", "deputy", "observer"];
    const today = new Date().toISOString().slice(0, 10);
    const heldClosed = new Set();
    const heldDecisions = new Map();
    const heldActions = new Set();
    if (mode === "merge") {
      for (const r of (await t.query(`SELECT id FROM meeting_occurrence WHERE status = 'closed'`)).rows ?? []) {
        heldClosed.add(r.id);
      }
      const dIds = (book.decisions ?? []).map((d) => d.id).filter(Boolean);
      if (dIds.length) {
        for (const r of (await t.query(`SELECT * FROM meeting_decision WHERE id = ANY($1)`, [dIds])).rows ?? []) {
          heldDecisions.set(r.id, r);
        }
      }
      const aIds = (book.actions ?? []).map((a) => a.id).filter(Boolean);
      if (aIds.length) {
        for (const r of (await t.query(`SELECT id FROM meeting_action WHERE id = ANY($1)`, [aIds])).rows ?? []) {
          heldActions.add(r.id);
        }
      }
    }

    for (const s of book.meetingSeries ?? []) {
      const kind = ["group", "programme", "site"].includes(s.scopeKind) ? s.scopeKind : "group";
      await t.query(
        `INSERT INTO meeting_series (id, name, cadence, scope_kind, programme_id, site_id, chair_id,
                                     gate_n, weekday, start_time, timebox_min, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::timestamptz, now()))`,
        [s.id, s.name ?? s.id,
         ["weekly", "monthly", "per_gate", "ad_hoc"].includes(s.cadence) ? s.cadence : "weekly", kind,
         kind === "programme" ? clean(s.programme) : null, kind === "site" ? clean(s.site) : null,
         clean(s.chair), intOrNull(s.gate), Math.max(0, Math.min(6, int(s.weekday, 1))),
         s.startTime ?? "09:00", int(s.timeboxMin, 30), s.active !== false, clean(s.createdAt)]);
    }

    const agendaIn = (a, i) => ({
      seq: int(a.seq, i), section: a.section ?? "", sectionKey: clean(a.sectionKey),
      headline: a.headline ?? "", detail: a.detail ?? "", entity: a.entity ?? "",
      entityId: a.entityId ?? "", timeboxMin: int(a.timeboxMin), urgent: a.urgent === true,
    });
    const attendanceIn = (a) => ({
      person: a.person, state: ATTENDANCE.includes(a.state) ? a.state : "present",
      deputyFor: clean(a.deputyFor),
    });
    const byPerson = (a, b) => (a.person < b.person ? -1 : a.person > b.person ? 1 : 0);
    /* What a held, closed meeting's record says, in the book's shape —
       so a file's copy of it can be compared rather than written. */
    const heldRecord = async (id) => {
      const o = (await t.query(`SELECT status, notes FROM meeting_occurrence WHERE id = $1`, [id])).rows[0];
      const agenda = ((await t.query(
        `SELECT * FROM agenda_item WHERE occurrence_id = $1 ORDER BY seq`, [id])).rows ?? [])
        .map((a) => agendaIn({ seq: a.seq, section: a.section, sectionKey: a.section_key,
          headline: a.headline, detail: a.detail, entity: a.entity, entityId: a.entity_id,
          timeboxMin: a.timebox_min, urgent: a.urgent }, a.seq));
      const attendance = ((await t.query(
        `SELECT * FROM meeting_attendance WHERE occurrence_id = $1`, [id])).rows ?? [])
        .map((a) => attendanceIn({ person: a.person_id, state: a.state, deputyFor: a.deputy_for }))
        .sort(byPerson);
      return { status: o.status, notes: o.notes, agenda, attendance };
    };

    const finalMeetings = new Set();
    for (const m of book.meetings ?? []) {
      const status = OCC_STATUS.includes(m.status) ? m.status : "scheduled";
      if (heldClosed.has(m.id)) {
        finalMeetings.add(m.id);
        const held = await heldRecord(m.id);
        const differs = [];
        if (status !== "closed") differs.push("status " + status);
        if ((m.notes ?? "") !== held.notes) differs.push("notes");
        if (Array.isArray(m.agenda) &&
            JSON.stringify(m.agenda.map(agendaIn)) !== JSON.stringify(held.agenda)) differs.push("agenda");
        if (Array.isArray(m.attendance) &&
            JSON.stringify(m.attendance.map(attendanceIn).sort(byPerson)) !== JSON.stringify(held.attendance)) {
          differs.push("attendance");
        }
        if (differs.length) {
          rejects.push({ table: "meeting_occurrence", id: m.id,
            reason: `this database holds that meeting closed and its record is final — ` +
                    `the file's ${differs.join(", ")} not written` });
        }
        continue;
      }
      await t.query(
        `INSERT INTO meeting_occurrence (id, series_id, meets_on, period_label, status,
                                         opened_at, opened_by, closed_at, closed_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,${USER(7)},$8,${USER(9)},$10)`,
        [m.id, m.series, m.meetsOn, m.periodLabel ?? "", status,
         clean(m.openedAt), clean(m.openedBy), clean(m.closedAt), clean(m.closedBy), m.notes ?? ""]);
      /* The file states the whole of a meeting's agenda and roll, as it
         states the whole of a change's route: on a merge, what the
         database holds for this meeting is replaced by the file's. */
      if (Array.isArray(m.agenda)) {
        if (mode === "merge") await t.query(`DELETE FROM agenda_item WHERE occurrence_id = $1`, [m.id]);
        if (m.agenda.length && status !== "closed") {
          rejects.push({ table: "agenda_item", id: m.id,
            reason: `an agenda is frozen when its meeting closes; this one is ${status}, so its ` +
                    `agenda is computed live and the file's ${m.agenda.length} item(s) were not written` });
        } else {
          for (const [i, raw] of m.agenda.entries()) {
            const a = agendaIn(raw, i);
            await t.query(
              `INSERT INTO agenda_item (occurrence_id, seq, section, section_key, headline, detail,
                                        entity, entity_id, timebox_min, urgent)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (occurrence_id, seq) DO UPDATE
                 SET section = EXCLUDED.section, section_key = EXCLUDED.section_key,
                     headline = EXCLUDED.headline, detail = EXCLUDED.detail, entity = EXCLUDED.entity,
                     entity_id = EXCLUDED.entity_id, timebox_min = EXCLUDED.timebox_min,
                     urgent = EXCLUDED.urgent`,
              [m.id, a.seq, a.section, a.sectionKey, a.headline, a.detail, a.entity, a.entityId,
               a.timeboxMin, a.urgent]);
          }
        }
      }
      if (Array.isArray(m.attendance)) {
        if (mode === "merge") await t.query(`DELETE FROM meeting_attendance WHERE occurrence_id = $1`, [m.id]);
        for (const raw of m.attendance) {
          const a = attendanceIn(raw);
          await t.query(
            `INSERT INTO meeting_attendance (occurrence_id, person_id, state, deputy_for)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (occurrence_id, person_id) DO UPDATE
               SET state = EXCLUDED.state, deputy_for = EXCLUDED.deputy_for`,
            [m.id, a.person, a.state, a.deputyFor]);
        }
      }
    }

    const written = new Set();
    for (const d of book.decisions ?? []) {
      const status = ["Proposed", "Ratified"].includes(d.status) ? d.status : "Ratified";
      const row = {
        occurrence_id: clean(d.meeting), headline: d.headline ?? "", rationale: d.rationale ?? "",
        alternatives: d.alternatives ?? "", dissent: d.dissent ?? "", project_id: clean(d.project),
        decided_by: clean(d.decidedBy), decided_on: clean(d.decidedOn), council: d.council ?? "",
      };
      const held = heldDecisions.get(d.id);
      if (held) {
        const changed = Object.keys(row).filter((k) => (held[k] ?? null) !== row[k]);
        if (changed.length) {
          rejects.push({ table: "meeting_decision", id: d.id,
            reason: `a decision on the record keeps its substance — the file changes its ` +
                    `${changed.join(", ")}; record a new decision that supersedes it (D-33.3)` });
          continue;
        }
      } else if (row.occurrence_id && finalMeetings.has(row.occurrence_id)) {
        rejects.push({ table: "meeting_decision", id: d.id,
          reason: `meeting ${row.occurrence_id} is closed here and its record is final — ` +
                  `a decision is not added to it by an import` });
        continue;
      }
      await t.query(
        `INSERT INTO meeting_decision
           (id, occurrence_id, headline, rationale, alternatives, dissent, project_id, cr_id, raid_id,
            milestone_id, decided_by, decided_on, council, recorded_by, recorded_at, referred_to_scope,
            reversal_cost, source_evidence_id, evidence_uri, provenance, status, ratified_by,
            ratified_on, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,${USER(14)},COALESCE($15::timestamptz, now()),
                 $16,$17,(SELECT id FROM evidence WHERE id = $18),$19,$20,$21,$22,$23,
                 ${INTEGRATION(24)},$25)`,
        [d.id, row.occurrence_id, row.headline, row.rationale, row.alternatives, row.dissent,
         row.project_id, clean(d.cr), clean(d.raid), clean(d.milestone), row.decided_by,
         row.decided_on, row.council, clean(d.recordedBy), clean(d.recordedAt),
         ["group", "programme"].includes(d.referredTo) ? d.referredTo : null,
         ["low", "medium", "high"].includes(d.reversalCost) ? d.reversalCost : null,
         clean(d.sourceEvidence), d.evidenceUri ?? "", d.provenance ?? "", status, d.ratifiedBy ?? "",
         // a proposed decision has not been ratified on any day (049's CHECK)
         status === "Ratified" ? clean(d.ratifiedOn) : null,
         clean(d.externalSource), clean(d.externalId)]);
      written.add(d.id);
    }
    /* A decision's links to other decisions second, so both ends exist.
       Each is kept only if the decision it names is here. */
    for (const d of book.decisions ?? []) {
      if (!written.has(d.id)) continue;
      const links = [clean(d.supersedes), clean(d.supersedesId), clean(d.answeredBy)];
      if (mode === "replace" && links.every((v) => v === null)) continue;
      const next = [2, 3, 4].map((n) => `(SELECT id FROM meeting_decision WHERE id = $${n})`);
      await t.query(
        `UPDATE meeting_decision
            SET supersedes = ${next[0]}, supersedes_id = ${next[1]}, answered_by = ${next[2]}
                ${bump("meeting_decision", ["supersedes", "supersedes_id", "answered_by"], next)}
          WHERE id = $1`,
        [d.id, ...links]);
    }

    for (const a of book.actions ?? []) {
      if (!heldActions.has(a.id) && finalMeetings.has(a.raisedIn)) {
        rejects.push({ table: "meeting_action", id: a.id,
          reason: `meeting ${a.raisedIn} is closed here and its record is final — ` +
                  `an action is not added to it by an import` });
        continue;
      }
      const status = ["Open", "In progress", "Done", "Cancelled"].includes(a.status) ? a.status : "Open";
      await t.query(
        `INSERT INTO meeting_action (id, series_id, raised_in, closed_in, title, detail, owner_id,
                                     project_id, due_date, status, created_at, closed_at,
                                     external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz, now()),$12,
                 ${INTEGRATION(13)},$14)`,
        [a.id, a.series, a.raisedIn, clean(a.closedIn), a.title ?? a.id, a.detail ?? "",
         clean(a.owner), clean(a.project), clean(a.dueDate), status, clean(a.createdAt),
         clean(a.closedAt), clean(a.externalSource), clean(a.externalId)]);
    }

    /* REQ-46 — a review is an event, and the item's `review` date (already
       imported with it) is its projection: it is NOT re-derived here, so
       the item says what the file says. */
    for (const v of book.raidReviews ?? []) {
      await t.query(
        `INSERT INTO raid_review (id, raid_id, reviewed_on, reviewed_by, note, due_on, next_review_on,
                                  recorded_by, recorded_at, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,${USER(8)},COALESCE($9::timestamptz, now()),${INTEGRATION(10)},$11)`,
        [v.id, v.item, v.reviewedOn ?? today, clean(v.reviewedBy), v.note ?? "", clean(v.dueOn),
         clean(v.nextReviewOn), clean(v.recordedBy), clean(v.recordedAt),
         clean(v.externalSource), clean(v.externalId)]);
    }

    for (const o of book.objections ?? []) {
      if (!String(o.reason ?? "").trim()) {
        rejects.push({ table: "objection", id: o.id,
          reason: "an objection without a reason is not an objection, it is a vote" });
        continue;
      }
      /* NEW-14 — les décisions sont dans le livre depuis cette ligne et
         arrivent juste au-dessus. Une objection qui désigne une décision
         absente (un livre d'ailleurs, ou une décision refusée plus haut)
         reste refusée en le DISANT, plutôt que de faire échouer le
         fichier entier sur une violation de clé étrangère. */
      const parent = await t.query(`SELECT 1 FROM meeting_decision WHERE id = $1`, [o.decision]);
      if (!(parent.rows ?? []).length) {
        rejects.push({ table: "objection", id: o.id,
          reason: `decision ${o.decision} is not in this book` });
        continue;
      }
      await t.query(
        `INSERT INTO decision_objection (id, decision_id, seat_id, domain, reason,
                                         raised_on, escalates_on, state, resolution, raised_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [o.id, o.decision, clean(o.seat), o.domain ?? "", o.reason,
         o.raisedOn ?? new Date().toISOString().slice(0, 10), clean(o.escalatesOn),
         ["open", "resolved", "escalated", "withdrawn"].includes(o.state) ? o.state : "open",
         o.resolution ?? "",
         // NEW-04 — whose objection it is (055)
         clean(o.raisedBy)]);
    }

    /* ── NEW-05 · the registers the importer did not know ──────────────
       The export wrote fifteen collections this function never read, and
       a replace import deletes the projects, so the cascade erased every
       row of them: a site's shutdown calendar, who covers whom, what each
       project promised and measured, its rollout, its purchase orders,
       its timesheets, its tolerance and the exceptions raised against it,
       its business case and every gate at which it was reconfirmed, what
       it taught, its gate criteria, its stakeholders and comms plan, and
       its links to the site systems. They come in here, after everything
       they point at: sites, people, projects, activities, documents.

       Each insert names its `id`, so the merge handle turns it into an
       upsert like every other register; the one without a text id
       (timesheet) says its own conflict rule. */
    for (const w of book.windows ?? []) {
      await t.query(
        `INSERT INTO site_window (id, site_id, kind, label, detail, starts_on, ends_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [w.id, w.site, w.kind === "freeze" ? "freeze" : "shutdown", w.label ?? "", w.detail ?? "",
         w.from, w.to ?? w.from]);
    }
    for (const a of book.absences ?? []) {
      await t.query(
        `INSERT INTO person_absence (id, person_id, starts_on, ends_on, reason, deputy_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [a.id, a.person, a.from, a.to ?? a.from,
         ["rotation", "leave", "training", "unavailable"].includes(a.reason) ? a.reason : "rotation",
         clean(a.deputy), a.note ?? ""]);
    }
    /* Benefits carry their own unit — percent, hours, ounces, currency —
       and the serialiser passes them through undivided. So they are NOT
       scaled by `money` here: a 12 % availability gain is 12, not
       twelve million. */
    for (const b of book.benefits ?? []) {
      await t.query(
        `INSERT INTO benefit (id, project_id, kind, title, detail, measure, unit,
                              baseline, target, actual, owner_id, realise_on, measured_on,
                              status, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,${INTEGRATION(15)},$16)`,
        [b.id, b.project,
         ["Production", "Availability", "Cost", "Risk", "Compliance"].includes(b.kind) ? b.kind : "Production",
         b.title ?? b.id, b.detail ?? "", b.measure ?? "", b.unit ?? "",
         num(b.baseline), num(b.target), num(b.actual), clean(b.owner),
         clean(b.realiseOn), clean(b.measuredOn),
         ["Forecast", "Realised", "Partially realised", "Missed", "Withdrawn"].includes(b.status)
           ? b.status : "Forecast",
         clean(b.externalSource), clean(b.externalId)]);
    }
    for (const w of book.waves ?? []) {
      await t.query(
        `INSERT INTO rollout_wave (id, project_id, site_id, seq, planned_on, actual_on, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [w.id, w.project, w.site, int(w.seq, 1), clean(w.plannedOn), clean(w.actualOn),
         ["Planned", "In progress", "Live", "Held", "Cancelled"].includes(w.status) ? w.status : "Planned",
         w.note ?? ""]);
    }
    // money promised and not yet spent (V-05) — in millions, like the ledger
    for (const c of book.commitments ?? []) {
      await t.query(
        `INSERT INTO commitment (id, project_id, reference, supplier, description, amount,
                                 currency, fx_rate, kind, raised_on, expected_on, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [c.id, c.project, c.reference ?? "", c.supplier ?? "", c.desc ?? "", money(c.amount),
         c.currency ?? "USD", num(c.fx) ?? 1, c.kind === "opex" ? "opex" : "capex",
         c.raisedOn ?? new Date().toISOString().slice(0, 10), clean(c.expectedOn),
         ["Open", "Part received", "Received", "Cancelled"].includes(c.status) ? c.status : "Open"]);
    }
    /* A timesheet's id is a serial the export writes; it is kept, and
       the sequence follows below. Its real identity is one person, one
       project, one week (the unique key), so that is its conflict rule:
       a merge updates the week's days rather than refusing the file on
       a second row for the same week. */
    /* NEW-16 — this conflict rule is the timesheet's own, so the handle
       leaves it alone and the bump is said here. In replace mode the
       table is empty and the rule never fires. */
    const TIMESHEET_BUMP = bumpIfChanged("timesheet", ["days", "entered_by"],
      ["EXCLUDED.days", "EXCLUDED.entered_by"]);
    for (const x of book.timesheets ?? []) {
      const hasId = !(x.id === undefined || x.id === null || x.id === "");
      const row = [x.person, x.project, x.week, Math.max(0, Math.min(7, Number(x.days ?? 0))),
                   clean(x.enteredBy)];
      await t.query(
        hasId
          ? `INSERT INTO timesheet (id, person_id, project_id, week_start, days, entered_by)
             VALUES ($1,$2,$3,$4,$5,${USER(6)})
             ON CONFLICT (person_id, project_id, week_start) DO UPDATE
               SET days = EXCLUDED.days, entered_by = EXCLUDED.entered_by, ${TIMESHEET_BUMP}`
          : `INSERT INTO timesheet (person_id, project_id, week_start, days, entered_by)
             VALUES ($1,$2,$3,$4,${USER(5)})
             ON CONFLICT (person_id, project_id, week_start) DO UPDATE
               SET days = EXCLUDED.days, entered_by = EXCLUDED.entered_by, ${TIMESHEET_BUMP}`,
        hasId ? [int(x.id), ...row] : row);
    }
    /* Only the ACTIVE tolerance is exported (the serialiser says why), so
       it comes back active. An exception may cite a tolerance that has
       since been superseded and is not in the file: the pointer is kept
       only if that tolerance is here. */
    for (const x of book.tolerances ?? []) {
      await t.query(
        `INSERT INTO project_tolerance (id, project_id, schedule_days, cost_pct, benefit_pct,
                                        note, set_by, set_on)
         VALUES ($1,$2,$3,$4,$5,$6,${USER(7)},$8)`,
        [x.id, x.project, intOrNull(x.scheduleDays), num(x.costPct), num(x.benefitPct),
         x.note ?? "", clean(x.setBy), x.setOn ?? new Date().toISOString().slice(0, 10)]);
    }
    for (const x of book.exceptions ?? []) {
      await t.query(
        `INSERT INTO project_exception (id, project_id, tolerance_id, dimension, raised_on,
                                        measured, allowed, detail, status, answer_kind, answer,
                                        answered_by, answered_on)
         VALUES ($1,$2,(SELECT id FROM project_tolerance WHERE id = $3),$4,$5,$6,$7,$8,$9,$10,$11,
                 ${USER(12)},$13)`,
        [x.id, x.project, clean(x.tolerance),
         ["schedule", "cost", "benefit", "benefit-review"].includes(x.dimension) ? x.dimension : "schedule",
         x.raisedOn ?? new Date().toISOString().slice(0, 10),
         Number(x.measured ?? 0), Number(x.allowed ?? 0), x.detail ?? "",
         ["Open", "Answered", "Withdrawn"].includes(x.status) ? x.status : "Open",
         ["Tolerance raised", "Plan revised", "Accepted", "Stopped"].includes(x.answerKind)
           ? x.answerKind : null,
         x.answer ?? "", clean(x.answeredBy), clean(x.answeredOn)]);
    }
    /* The business case's two figures are in millions (`toM`), so they
       go back through `money`; absent stays absent — a case with no
       expected benefit has not said zero. */
    for (const c of book.businessCases ?? []) {
      await t.query(
        `INSERT INTO business_case (id, project_id, summary, expected_cost, expected_benefit,
                                    value_confidence, basis, written_by, written_on, updated_on,
                                    reconfirmed_gate, reconfirmed_on, reconfirmed_by,
                                    external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,${USER(8)},$9,$10,$11,$12,${USER(13)},${INTEGRATION(14)},$15)`,
        [c.id, c.project, c.summary ?? "",
         num(c.expectedCost) === null ? null : money(c.expectedCost),
         num(c.expectedBenefit) === null ? null : money(c.expectedBenefit),
         num(c.valueConfidence) === null ? null : Math.max(1, Math.min(5, int(c.valueConfidence))),
         c.basis ?? "", clean(c.writtenBy), c.writtenOn ?? new Date().toISOString().slice(0, 10),
         clean(c.updatedOn), intOrNull(c.reconfirmedGate), clean(c.reconfirmedOn),
         clean(c.reconfirmedBy), clean(c.externalSource), clean(c.externalId)]);
    }
    for (const r of book.caseReconfirmations ?? []) {
      await t.query(
        `INSERT INTO case_reconfirmation (id, case_id, project_id, gate, expected_cost,
                                          expected_benefit, verdict, note, reconfirmed_by,
                                          reconfirmed_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.id, r.case, r.project, int(r.gate, 1),
         num(r.expectedCost) === null ? null : money(r.expectedCost),
         num(r.expectedBenefit) === null ? null : money(r.expectedBenefit),
         ["Continue", "Continue with conditions", "Stop"].includes(r.verdict) ? r.verdict : "Continue",
         r.note ?? "", clean(r.reconfirmedBy),
         r.reconfirmedOn ?? new Date().toISOString().slice(0, 10)]);
    }
    /* A lesson outlives its project (PM-02), and the serialiser names the
       project only to a reader who may see it; a lesson that arrives
       without one is still a lesson. */
    for (const l of book.lessons ?? []) {
      await t.query(
        `INSERT INTO lesson (id, project_id, programme_id, site_id, gate_n, category, title,
                             what_happened, why, recommendation, outcome, raised_by, raised_on,
                             status, adopted_by, adopted_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,${USER(15)},$16)`,
        [l.id, clean(l.project), clean(l.programme), clean(l.site), intOrNull(l.gate),
         ["Scope", "Schedule", "Cost", "Risk", "Quality", "Resources", "Stakeholders",
          "Procurement", "Governance", "Technical", "Transition"].includes(l.category)
           ? l.category : "Governance",
         l.title ?? l.id, l.whatHappened ?? "", l.why ?? "", l.recommendation ?? "",
         l.outcome === "Positive" ? "Positive" : "Negative", clean(l.raisedBy),
         l.raisedOn ?? new Date().toISOString().slice(0, 10),
         ["Proposed", "Adopted", "Archived"].includes(l.status) ? l.status : "Proposed",
         clean(l.adoptedBy), clean(l.adoptedOn)]);
    }
    for (const c of book.criteria ?? []) {
      await t.query(
        `INSERT INTO gate_criterion (id, project_id, gate, seq, text, document_id, met,
                                     reviewed_by, reviewed_on, note, external_source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,${INTEGRATION(11)},$12)`,
        [c.id, c.project, int(c.gate), int(c.seq), c.text ?? "", clean(c.document),
         c.met === true, clean(c.reviewedBy), clean(c.reviewedOn), c.note ?? "",
         clean(c.externalSource), clean(c.externalId)]);
    }
    for (const x of book.stakeholders ?? []) {
      await t.query(
        `INSERT INTO stakeholder (id, project_id, person_id, name, organisation, role_label,
                                  interest, influence, attitude, engagement, owner_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [x.id, x.project, clean(x.person), x.name ?? x.id, x.organisation ?? "", x.role ?? "",
         Math.max(1, Math.min(5, int(x.interest, 3))), Math.max(1, Math.min(5, int(x.influence, 3))),
         ["Champion", "Supporter", "Neutral", "Sceptic", "Opponent"].includes(x.attitude)
           ? x.attitude : "Neutral",
         ["Inform", "Consult", "Involve", "Partner"].includes(x.engagement) ? x.engagement : "Inform",
         clean(x.owner), x.note ?? ""]);
    }
    for (const x of book.comms ?? []) {
      await t.query(
        `INSERT INTO comms_plan (id, project_id, audience, purpose, channel, frequency,
                                 owner_id, next_on, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [x.id, x.project, x.audience ?? "", x.purpose ?? "", x.channel ?? "", x.frequency ?? "",
         clean(x.owner), clean(x.nextOn), x.note ?? ""]);
    }
    /* A federation link is a display cache of another system's record
       (005); the association is ours and comes back, with when it was
       made and last synchronised. */
    for (const l of book.extLinks ?? []) {
      await t.query(
        `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, site_id,
                               title_cache, status_cache, kind_cache, risk_cache, due_cache,
                               window_start, linked_by, linked_at, synced_at, stale)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${USER(13)},$14,$15,$16)`,
        [l.id, l.source, l.extId, l.project, clean(l.activity), clean(l.site),
         l.title ?? "", l.status ?? "", l.kind ?? "", l.risk ?? "", clean(l.due),
         clean(l.windowStart), clean(l.linkedBy), clean(l.linkedAt) ?? new Date().toISOString(),
         clean(l.syncedAt), l.stale === true]);
    }

    for (const [key, lines] of Object.entries(book.narrative ?? {})) {
      await t.query(
        /* NEW-07 — keyed on its block, not an id: a merge updates the
           block rather than refusing the file on its primary key. */
        `INSERT INTO report_narrative (block_key, lines, updated_by) VALUES ($1,$2,$3)
         ON CONFLICT (block_key) DO UPDATE
           SET lines = EXCLUDED.lines, updated_by = EXCLUDED.updated_by`,
        [key, JSON.stringify(lines), user?.id ?? null]);
    }

    /* ── settings ─────────────────────────────────────────────────── */
    for (const [k, v] of Object.entries(book.settings ?? {})) {
      await t.query(
        `INSERT INTO app_setting (key, value, updated_at) VALUES ($1,$2,now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [k, JSON.stringify(v)]);
    }
    if (book.orgName) {
      await t.query(
        `INSERT INTO app_setting (key, value) VALUES ('orgName',$1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(book.orgName)]);
    }
    if (book.statusDate) {
      await t.query(
        `INSERT INTO app_setting (key, value) VALUES ('statusDate',$1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(book.statusDate)]);
    }

    for (const k of ["projects", "activities", "milestones", "requirements", "ledger", "raid", "crs", "docs", "items", "allocations",
                     "evidence", "findings", "seats", "objections",
                     // NEW-05 — the fifteen registers the import now reads
                     "windows", "absences", "benefits", "waves", "commitments", "timesheets",
                     "tolerances", "exceptions", "businessCases", "caseReconfirmations",
                     "lessons", "criteria", "stakeholders", "comms", "extLinks",
                     // NEW-14 — the meeting register and the RAID reviews
                     "meetingSeries", "meetings", "decisions", "actions", "raidReviews"]) {
      counts[k] = (book[k] ?? []).length;
    }

    /* NEW-19 — every row a replace wrote moves past the versions its
       table held before (see above). Tables that were empty keep 1. */
    for (const [table, m] of versionFloor) {
      if (m > 0) await raw.query(`UPDATE ${table} SET row_version = $1`, [m + 1]);
    }

    /* The import replaces every row, so the identifier counters have to
       follow it or the next create collides with an imported id. */
    for (const [prefix, table, where] of [
      ["PRJ","project","true"],["RSK","raid_item","id LIKE 'RSK-%'"],
      ["ISS","raid_item","id LIKE 'ISS-%'"],["ASM","raid_item","id LIKE 'ASM-%'"],
      ["DEP","raid_item","id LIKE 'DEP-%'"],["CR","change_request","true"],
      ["DOC","document","true"],["WI","work_item","true"],["PE","person","true"],
      ["REQ","requirement","true"],
      /* NEW-05 — the registers now imported mint their ids from the same
         counters (`allocateId`). Only ids of the counter's own shape are
         read, so a foreign id such as "BEN-PRJ-112-2" cannot fuse its
         digits into a number the counter would then jump to. */
      ["SW","site_window","id ~ '^SW-[0-9]+$'"],["ABS","person_absence","id ~ '^ABS-[0-9]+$'"],
      ["BEN","benefit","id ~ '^BEN-[0-9]+$'"],["WAVE","rollout_wave","id ~ '^WAVE-[0-9]+$'"],
      ["CMT","commitment","id ~ '^CMT-[0-9]+$'"],["TOL","project_tolerance","id ~ '^TOL-[0-9]+$'"],
      ["EXC","project_exception","id ~ '^EXC-[0-9]+$'"],["CAS","business_case","id ~ '^CAS-[0-9]+$'"],
      ["CRC","case_reconfirmation","id ~ '^CRC-[0-9]+$'"],["LSN","lesson","id ~ '^LSN-[0-9]+$'"],
      ["GC","gate_criterion","id ~ '^GC-[0-9]+$'"],["STK","stakeholder","id ~ '^STK-[0-9]+$'"],
      ["COM","comms_plan","id ~ '^COM-[0-9]+$'"],["XL","ext_link","id ~ '^XL-[0-9]+$'"],
      /* NEW-14 — a decision, an action and a review mint their ids from
         these (`allocateId`). A series and a meeting do not: a series is
         named `MS-<time>` and a meeting `<series>-<date>`, so there is no
         counter for either to fall behind. */
      ["DEC","meeting_decision","id ~ '^DEC-[0-9]+$'"],["ACT","meeting_action","id ~ '^ACT-[0-9]+$'"],
      ["RVW","raid_review","id ~ '^RVW-[0-9]+$'"],
    ]) {
      await t.query(
        `INSERT INTO id_counter (prefix, next_value)
         SELECT $1, COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), ''))::int, 0)
           FROM ${table} WHERE ${where}
         ON CONFLICT (prefix) DO UPDATE
           SET next_value = GREATEST(id_counter.next_value, EXCLUDED.next_value)`,
        [prefix]);
    }

    /* MER-14 — `allocation.id` est un bigserial et l'import l'honore
       désormais, donc la séquence doit suivre comme les compteurs
       ci-dessus : sans cela la prochaine allocation créée à la main
       entre en collision avec une allocation importée. */
    await t.query(
      `SELECT setval(pg_get_serial_sequence('allocation','id'),
                     GREATEST(COALESCE((SELECT MAX(id) FROM allocation), 0), 1))`);
    /* NEW-05 — the ledger and the timesheets now keep their serial ids,
       so their sequences follow the same way. The third argument keeps
       an empty table's next id at 1 rather than 2. */
    for (const table of ["cost_line", "timesheet"]) {
      await t.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),
                       COALESCE((SELECT MAX(id) FROM ${table}), 1),
                       (SELECT MAX(id) FROM ${table}) IS NOT NULL)`);
    }
    /* A milestone's id is project-scoped (`PRJ-112-M4`) but its number
       comes from one global counter — the seed's own rule, which the
       import never followed: the first milestone placed by hand after an
       import could collide with an imported one. */
    await t.query(
      `INSERT INTO id_counter (prefix, next_value)
       SELECT 'MS', COALESCE(MAX(NULLIF(substring(id from '-M([0-9]+)$'), ''))::int, 0)
         FROM milestone WHERE kind = 'milestone'
       ON CONFLICT (prefix) DO UPDATE
         SET next_value = GREATEST(id_counter.next_value, EXCLUDED.next_value)`);

    /* NEW-15 (docs/36) — a real import dropped the rows it refused by
       name and said so only on a dry run: the operator who went straight
       to "import" was told 200 and nothing else, and the trail recorded
       counts that included rows which never came in. The refusals now
       travel with the answer AND with the audit event, so "what did that
       import leave out" is readable after the fact, by someone who was
       not at the keyboard. */
    await record(t, user, {
      action: dryRun ? "Book import validated (dry run)" : "Book imported",
      entity: "system",
      detail: Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") +
        (rejects.length
          ? `; ${rejects.length} row(s) refused: ` + rejects.map((x) => `${x.table} ${x.id}`).join(", ")
          : ""),
      /* NEW-20 — and what a replace erased that the file did not carry,
         so "where did the meeting register go" has an answer in the trail. */
      after: rejects.length || Object.keys(wouldErase).length
        ? { mode, rejects, ...(Object.keys(wouldErase).length ? { erased: wouldErase } : {}) }
        : undefined,
    });

    /* La simulation s'arrête ICI, après avoir tout écrit et donc après
       avoir subi toutes les contraintes — c'est ce qui la rend utile.
       L'exception annule la transaction ; rien n'a existé. */
    if (dryRun) throw new DryRunComplete({ ok: true, dryRun: true, mode, counts, rejects, wouldErase });
  };

  try {
    await tx(run);
  } catch (e) {
    if (e instanceof DryRunComplete) return e.payload;
    located(e);
  }
  return { ok: true, dryRun: false, mode, counts, rejects, erased: wouldErase };
}

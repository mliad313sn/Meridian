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
import { fromM } from "./portfolio.js";
import { HttpError } from "./auth.js";

const PORTFOLIO_TABLES = [
  "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
  "meeting_occurrence", "meeting_series",
  "decision_objection", "seat_conflict", "seat",
  "finding", "evidence",
  "report_narrative", "work_item", "document", "allocation",
  "change_step", "change_request", "raid_item", "cost_line", "milestone",
  "requirement",
  "cross_dep", "activity_dep", "activity", "project",
  "programme", "person", "site",
];

const clean = (v) => (v === undefined || v === "" ? null : v);
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

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
      "corrupts every cost figure in the portfolio.");
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

export function upsertHandle(t) {
  return {
    ...t,
    query(sql, params) {
      const m = typeof sql === "string" ? sql.match(INSERT_HEAD) : null;
      if (!m || /ON CONFLICT/i.test(sql)) return t.query(sql, params);
      const cols = m[2].split(",").map((c) => c.trim()).filter(Boolean);
      if (!cols.includes("id")) return t.query(sql, params);
      const sets = cols.filter((c) => c !== "id").map((c) => `${c} = EXCLUDED.${c}`);
      if (!sets.length) return t.query(`${sql} ON CONFLICT (id) DO NOTHING`, params);
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

  const run = async (raw) => {
    if (mode === "replace") {
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
    const t = mode === "merge" ? upsertHandle(raw) : raw;

    /* ── reference ────────────────────────────────────────────────── */
    for (const s of book.sites ?? []) {
      await t.query(
        `INSERT INTO site (id, city, region, tz_offset, tz_name, headcount, fte, charter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [s.id, s.city, s.region ?? "", Number(s.tz ?? 0), s.tzName ?? "UTC",
         int(s.headcount), int(s.fte), s.role ?? s.charter ?? ""]);
    }
    for (const p of book.people ?? []) {
      await t.query(
        `INSERT INTO person (id, name, job_role, site_id, day_rate) VALUES ($1,$2,$3,$4,$5)`,
        [p.id, p.name, p.role ?? "", p.site, Number(p.rate ?? 0)]);
    }
    for (const g of book.programmes ?? []) {
      await t.query(
        `INSERT INTO programme (id, name, sponsor, manager_id) VALUES ($1,$2,$3,$4)`,
        [g.id, g.name, g.sponsor ?? "", clean(g.managerId)]);
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
            gate_loop)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [p.id, p.name, p.programme, p.site,
         p.governanceLevel === "group" ? "group" : "site",
         clean(p.pm), p.method ?? "Hybrid",
         p.start, p.finish, p.baselineFinish ?? p.finish,
         money(p.budget), money(p.contingency), money(p.contingencyUsed),
         p.desc ?? "", p.phase ?? "Initiation", int(p.gate),
         ["G", "A", "R"].includes(p.healthOverride) ? p.healthOverride : null,
         !!p.closed,
         Math.max(1, int(p.loop, 1))]);
    }
    for (const a of book.activities ?? []) {
      await t.query(
        `INSERT INTO activity (id, project_id, name, stage, start_date, end_date,
                               base_start, base_end, weight, pct, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [a.id, a.project, a.name, int(a.stage), a.start, a.end,
         a.baseStart ?? a.start, a.baseEnd ?? a.end,
         Number(a.weight ?? 0), Math.max(0, Math.min(100, int(a.pct))), clean(a.owner)]);
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
      await t.query(
        `INSERT INTO cross_dep (from_project, from_stage, to_project, to_stage, label)
         VALUES ($1,$2,$3,$4,$5)`,
        [c.from, int(c.fromStage), c.to, int(c.toStage), c.label ?? ""]);
    }
    for (const m of book.milestones ?? []) {
      await t.query(
        `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind,
                                owner_id, done, gate_loop)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [m.id, m.project, m.name, m.date, m.baseDate ?? m.date,
         m.gate ?? null, m.kind === "gate" ? "gate" : "milestone", clean(m.owner), !!m.done,
         Math.max(1, int(m.loop, 1))]);
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
    for (const l of book.ledger ?? []) {
      await t.query(
        `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note)
         VALUES ($1,$2,$3,$4,'Labour','Imported')`,
        [l.project, l.period, l.period + "-01", money(l.amount)]);
    }
    for (const x of book.raid ?? []) {
      await t.query(
        `INSERT INTO raid_item (id, project_id, kind, title, detail, probability, impact,
                                status, response, owner_id, opened_on, review_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [x.id, clean(x.project), x.type ?? "Risk", x.title, x.detail ?? "",
         Math.max(1, Math.min(5, int(x.p, 1))), Math.max(1, Math.min(5, int(x.i, 1))),
         x.status === "Closed" ? "Closed" : "Open", x.response ?? "Monitor",
         clean(x.owner), x.opened, clean(x.review)]);
    }
    for (const c of book.crs ?? []) {
      await t.query(
        `INSERT INTO change_request (id, project_id, title, description, raised_by, raised_on,
                                     cost_delta, weeks_delta, funding, risk_delta, status, applied)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [c.id, c.project, c.title, c.desc ?? "", clean(c.raisedBy), c.raised,
         money(c.cost), int(c.weeks), c.funding ?? "Contingency", c.riskDelta ?? "0",
         ["Pending", "Approved", "Rejected"].includes(c.status) ? c.status : "Pending",
         !!c.applied]);
      (c.steps ?? []).forEach(() => {});
      for (let i = 0; i < (c.steps ?? []).length; i++) {
        const st = c.steps[i];
        await t.query(
          `INSERT INTO change_step (cr_id, seq, role_label, note, state, decided_on, comment)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [c.id, i, st.role ?? "Step " + (i + 1), st.note ?? "",
           ["waiting", "current", "done", "rejected"].includes(st.state) ? st.state : "waiting",
           clean(st.when), st.comment ?? ""]);
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
    const ALLOCATION_KEYS = new Set(["id", "person", "project", "from", "to", "pct", "version"]);
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
          `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct)
           VALUES ($1,$2,$3,$4,$5)`,
          [a.person, a.project, a.from, a.to, Math.max(0, Math.min(200, int(a.pct)))]);
      } else {
        await t.query(
          `INSERT INTO allocation (id, person_id, project_id, from_date, to_date, pct)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [int(a.id), a.person, a.project, a.from, a.to,
           Math.max(0, Math.min(200, int(a.pct)))]);
      }
    }
    for (const d of book.docs ?? []) {
      await t.query(
        `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision,
                               status, updated_on, gate_loop)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [d.id, clean(d.project), d.name, d.type ?? "Assurance", int(d.gate),
         clean(d.owner), d.rev ?? "0.1",
         ["Draft", "In review", "Approved", "Superseded"].includes(d.status) ? d.status : "Draft",
         d.updated ?? new Date().toISOString().slice(0, 10),
         Math.max(1, int(d.loop, 1))]);
    }
    for (const i of book.items ?? []) {
      await t.query(
        `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority,
                                created_on, source, score, score_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        /* MER-05 — d'où vient cet élément et combien il vaut. Un
           arriéré d'améliorations arrive d'une revue de jalon, d'un
           panel d'enfants ou de la télémétrie, et il est noté par une
           méthode déclarée. L'import n'en gardait qu'une lettre de
           priorité, ce qui perdait les trois. */
        [i.id, i.project, i.column, i.title, clean(i.assignee),
         int(i.points, 1), i.priority ?? "P3", i.created ?? new Date().toISOString().slice(0, 10),
         i.source ?? "",
         Number.isFinite(Number(i.score)) && i.score !== null && i.score !== "" ? Number(i.score) : null,
         i.scoreMethod ?? ""]);
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
      for (const other of st.incompatibleWith ?? []) {
        for (const [a, b] of [[st.id, other], [other, st.id]]) {
          await t.query(
            `INSERT INTO seat_conflict (seat_id, other_id, reason) VALUES ($1,$2,$3)
             ON CONFLICT (seat_id, other_id) DO NOTHING`,
            [a, b, st.conflictReason ?? ""]);
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

    for (const o of book.objections ?? []) {
      if (!String(o.reason ?? "").trim()) {
        rejects.push({ table: "objection", id: o.id,
          reason: "an objection without a reason is not an objection, it is a vote" });
        continue;
      }
      /* Les réunions ne font pas partie du livre importé — l'identité et
         la tenue de séance appartiennent au système qui les a
         enregistrées. Une objection qui désigne une décision absente est
         donc refusée en le DISANT, plutôt que de faire échouer le
         fichier entier sur une violation de clé étrangère. */
      const parent = await t.query(`SELECT 1 FROM meeting_decision WHERE id = $1`, [o.decision]);
      if (!(parent.rows ?? []).length) {
        rejects.push({ table: "objection", id: o.id,
          reason: `decision ${o.decision} is not in this book` });
        continue;
      }
      await t.query(
        `INSERT INTO decision_objection (id, decision_id, seat_id, domain, reason,
                                         raised_on, escalates_on, state, resolution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [o.id, o.decision, clean(o.seat), o.domain ?? "", o.reason,
         o.raisedOn ?? new Date().toISOString().slice(0, 10), clean(o.escalatesOn),
         ["open", "resolved", "escalated", "withdrawn"].includes(o.state) ? o.state : "open",
         o.resolution ?? ""]);
    }

    for (const [key, lines] of Object.entries(book.narrative ?? {})) {
      await t.query(
        `INSERT INTO report_narrative (block_key, lines, updated_by) VALUES ($1,$2,$3)`,
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
                     "evidence", "findings", "seats", "objections"]) {
      counts[k] = (book[k] ?? []).length;
    }

    /* The import replaces every row, so the identifier counters have to
       follow it or the next create collides with an imported id. */
    for (const [prefix, table, where] of [
      ["PRJ","project","true"],["RSK","raid_item","id LIKE 'RSK-%'"],
      ["ISS","raid_item","id LIKE 'ISS-%'"],["ASM","raid_item","id LIKE 'ASM-%'"],
      ["DEP","raid_item","id LIKE 'DEP-%'"],["CR","change_request","true"],
      ["DOC","document","true"],["WI","work_item","true"],["PE","person","true"],
      ["REQ","requirement","true"],
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

    await record(t, user, {
      action: dryRun ? "Book import validated (dry run)" : "Book imported",
      entity: "system",
      detail: Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", "),
    });

    /* La simulation s'arrête ICI, après avoir tout écrit et donc après
       avoir subi toutes les contraintes — c'est ce qui la rend utile.
       L'exception annule la transaction ; rien n'a existé. */
    if (dryRun) throw new DryRunComplete({ ok: true, dryRun: true, mode, counts, rejects });
  };

  try {
    await tx(run);
  } catch (e) {
    if (e instanceof DryRunComplete) return e.payload;
    throw e;
  }
  return counts;
}

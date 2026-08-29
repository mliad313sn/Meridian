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

const PORTFOLIO_TABLES = [
  "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
  "meeting_occurrence", "meeting_series",
  "report_narrative", "work_item", "document", "allocation",
  "change_step", "change_request", "raid_item", "cost_line", "milestone",
  "cross_dep", "activity_dep", "activity", "project",
  "programme", "person", "site",
];

const clean = (v) => (v === undefined || v === "" ? null : v);
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

export async function importBook(book, user) {
  const counts = {};

  await tx(async (t) => {
    for (const table of PORTFOLIO_TABLES) await t.query(`DELETE FROM ${table}`);

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
            contingency_used, description, phase, gate, health_override, closed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [p.id, p.name, p.programme, p.site,
         p.governanceLevel === "group" ? "group" : "site",
         clean(p.pm), p.method ?? "Hybrid",
         p.start, p.finish, p.baselineFinish ?? p.finish,
         fromM(p.budget), fromM(p.contingency), fromM(p.contingencyUsed),
         p.desc ?? "", p.phase ?? "Initiation", int(p.gate),
         ["G", "A", "R"].includes(p.healthOverride) ? p.healthOverride : null,
         !!p.closed]);
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
        `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, done)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [m.id, m.project, m.name, m.date, m.baseDate ?? m.date,
         m.gate ?? null, m.kind === "gate" ? "gate" : "milestone", clean(m.owner), !!m.done]);
    }
    for (const l of book.ledger ?? []) {
      await t.query(
        `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note)
         VALUES ($1,$2,$3,$4,'Labour','Imported')`,
        [l.project, l.period, l.period + "-01", fromM(l.amount)]);
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
         fromM(c.cost), int(c.weeks), c.funding ?? "Contingency", c.riskDelta ?? "0",
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
    for (const a of book.allocations ?? []) {
      await t.query(
        `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct)
         VALUES ($1,$2,$3,$4,$5)`,
        [a.person, a.project, a.from, a.to, Math.max(0, Math.min(200, int(a.pct)))]);
    }
    for (const d of book.docs ?? []) {
      await t.query(
        `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [d.id, clean(d.project), d.name, d.type ?? "Assurance", int(d.gate),
         clean(d.owner), d.rev ?? "0.1",
         ["Draft", "In review", "Approved", "Superseded"].includes(d.status) ? d.status : "Draft",
         d.updated ?? new Date().toISOString().slice(0, 10)]);
    }
    for (const i of book.items ?? []) {
      await t.query(
        `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority, created_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [i.id, i.project, i.column, i.title, clean(i.assignee),
         int(i.points, 1), i.priority ?? "P3", i.created ?? new Date().toISOString().slice(0, 10)]);
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

    for (const k of ["projects", "activities", "milestones", "ledger", "raid", "crs", "docs", "items", "allocations"]) {
      counts[k] = (book[k] ?? []).length;
    }

    /* The import replaces every row, so the identifier counters have to
       follow it or the next create collides with an imported id. */
    for (const [prefix, table, where] of [
      ["PRJ","project","true"],["RSK","raid_item","id LIKE 'RSK-%'"],
      ["ISS","raid_item","id LIKE 'ISS-%'"],["ASM","raid_item","id LIKE 'ASM-%'"],
      ["DEP","raid_item","id LIKE 'DEP-%'"],["CR","change_request","true"],
      ["DOC","document","true"],["WI","work_item","true"],["PE","person","true"],
    ]) {
      await t.query(
        `INSERT INTO id_counter (prefix, next_value)
         SELECT $1, COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0)
           FROM ${table} WHERE ${where}
         ON CONFLICT (prefix) DO UPDATE
           SET next_value = GREATEST(id_counter.next_value, EXCLUDED.next_value)`,
        [prefix]);
    }

    await record(t, user, {
      action: "Book imported",
      entity: "system",
      detail: Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", "),
    });
  });

  return counts;
}

/**
 * REQ-30 (RT365 V-11) — THE VALUE PAGE: the read, and the one write that
 * puts a page on the record.
 *
 *   GET  /api/valuepage             the page as the book stands now, for
 *                                   this reader's scope, plus the list of
 *                                   periods that already carry a stored
 *                                   one.
 *   GET  /api/valuepage/:periodId   the page AS IT WAS STORED for that
 *                                   reporting period. Read, never
 *                                   recomputed — the whole point is that
 *                                   it does not move when the book does.
 *   POST /api/valuepage/:periodId   store it. Once.
 *
 * ── Why the write is a second act, and not part of the close ────────
 *
 * `POST /api/periods` (V-02, routes/portfolio.js) closes the period and
 * freezes the earned-value snapshot project by project. The value page
 * is stored against THAT period — `report_value.period_id` references
 * it — so there is one period concept in this product and not two, which
 * is the point migration 048 argues at length.
 *
 * It is a separate call because it is a separate statement. Closing the
 * books says "this is what the delivery position was"; storing the value
 * page says "and this is what we told the board it was worth". A group
 * office may close a period and want the value page too; nothing forces
 * it to, and a page nobody asked for is not on the record.
 *
 * ── The guard that matters most ─────────────────────────────────────
 *
 * A stored figure is permanent: `report_value` and `report_value_figure`
 * are append-only at the database, so a wrong number cannot be corrected
 * — only superseded by a new period. Two refusals follow from that, and
 * they are the reason this route is longer than it looks:
 *
 *   1. **the as-at must match.** The figures are read from the book as
 *      it stands NOW. Storing them against a period closed at a
 *      different status date would file today's numbers under March's
 *      name — and the December reader would have no way to know. So a
 *      period whose `status_date` is not the book's own status date is
 *      refused, with the two dates in the sentence;
 *   2. **once only.** A period that already carries a value page is
 *      refused. The correction path is the one V-02 established: close a
 *      NEW period that restates the old one, and store the page against
 *      that. The restatement is then itself on the record.
 *
 * ── Authority ───────────────────────────────────────────────────────
 *
 * `portfolio.read` for the live page: it is an arrangement of rows the
 * reader can already see, narrowed by `loadPortfolio` to their own
 * scope, exactly as `/api/signals` is.
 *
 * `period.close` for BOTH storing a page and reading a stored one, and
 * the second half of that is deliberate. A stored page is an aggregate
 * over the scope of whoever stored it — a group office's whole book —
 * and it carries the titles of the five risks at the top of the
 * register. Handing that to a site account would hand them, in a
 * total and in five sentences, a portfolio they may not open. The rule
 * ladder.js already applies to its dry run applies here: whoever may not
 * perform the act has no business reading its record either. The LIVE
 * page has no such problem — it is computed inside the reader's own
 * scope — and every role may read that.
 *
 * No new action was added to shared/rbac.js. `period.close` is not a
 * near-enough neighbour borrowed for convenience: it IS this act —
 * writing a row of reported history that cannot afterwards be edited —
 * and it is already group-level-and-above, portfolio-wide, and carries
 * its own case in `can()`.
 */

import { Router } from "express";
import { many, one } from "../db.js";
import { loadPortfolio, toM, fromM } from "../portfolio.js";
import { require$, can } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { valuePage, FIGURE_ORDER, MONEY_FIELDS, VALUE_TEXT } from "../../../shared/valuepage.js";

const r = Router();

/* ── money crosses the boundary in exactly one place ──────────────────
   The database keeps money exact and whole (F-07); the page reads it in
   millions. `MONEY_FIELDS` in shared/valuepage.js names every field that
   applies to, so the writer and the reader cannot drift apart — which is
   the failure mode of a conversion remembered in two files. */
const convert = (v, f) => (v === null || v === undefined ? v : f(v));

function mapMoney(value, f) {
  if (Array.isArray(value)) return value.map((x) => mapMoney(x, f));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = MONEY_FIELDS.has(k) ? convert(v, f) : mapMoney(v, f);
    }
    return out;
  }
  return value;
}

/** The figures of one page, in the rows the table stores. */
function figureRows(page) {
  return FIGURE_ORDER.map((key, i) => {
    const f = page.figures[key];
    const isMoney = f.unit === "money";
    return {
      figure: key, seq: i, state: f.state, unit: f.unit,
      /* The CHECK in 048 refuses a value on an unmeasured figure and
         refuses a missing one on a measured figure. Nothing here has to
         remember that rule — but nothing here may break it either, so
         the null is explicit rather than incidental. */
      value: f.state === "measured" ? (isMoney ? fromM(f.value) : f.value) : null,
      n: f.n ?? null,
      why: f.why ?? "",
      note: f.note ?? "",
      detail: JSON.stringify(mapMoney(f.extra ?? {}, fromM)),
    };
  });
}

/** A stored row, read back into the shape the page has in the browser. */
function figureFromRow(row) {
  const isMoney = row.unit === "money";
  const value = row.value === null || row.value === undefined ? null : Number(row.value);
  const detail = typeof row.detail === "string" ? JSON.parse(row.detail) : (row.detail ?? {});
  return {
    key: row.figure,
    label: VALUE_TEXT[row.figure] ?? row.figure,
    unit: row.unit,
    state: row.state,
    rag: row.state === "measured" ? null : "N",
    why: row.why || null,
    note: row.note || null,
    value: value === null ? null : (isMoney ? toM(value) : value),
    n: row.n === null || row.n === undefined ? null : Number(row.n),
    extra: mapMoney(detail, toM),
  };
}

/** The periods that already carry a stored value page, newest first. */
async function storedPeriods() {
  const rows = await many(
    `SELECT v.period_id, v.status_date, v.stored_at, v.stored_by_label,
            v.scope_label, v.projects, v.measured, v.not_measured, v.note,
            p.label, p.restates
       FROM report_value v JOIN report_period p ON p.id = v.period_id
      ORDER BY v.status_date DESC, v.stored_at DESC
      LIMIT 60`);
  return rows.map((v) => ({
    period: v.period_id, label: v.label, restates: v.restates ?? null,
    statusDate: v.status_date, storedAt: v.stored_at, storedBy: v.stored_by_label,
    scope: v.scope_label, projects: v.projects,
    measured: v.measured, notMeasured: v.not_measured, note: v.note,
  }));
}

/** How to describe, months later, whose book this page was computed over. */
function scopeLabel(user) {
  if (!user) return "";
  if (user.role === "admin") return "the whole book (administrator)";
  const g = user.grants ?? {};
  const programmes = [...(g.programmes ?? [])];
  const sites = [...(g.sites ?? [])];
  const parts = [];
  if (programmes.length) parts.push(`programmes ${programmes.join(", ")}`);
  if (sites.length) parts.push(`sites ${sites.join(", ")}`);
  return parts.length ? `${user.role} — ${parts.join(" · ")}` : `${user.role} — the whole book`;
}

/* ── the live page ────────────────────────────────────────────────────
   A plain read, issued outside any transaction: db.js refuses a
   module-level call made while one is open, and this endpoint writes
   nothing at all.

   The figures are computed over EVERY project the reader may see, never
   over a filtered slate: a page filtered to one programme and a snapshot
   taken over the whole book would not be the same page, and the whole
   value of the snapshot is that it is the page. */
r.get("/valuepage", require$("portfolio.read"), async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    const page = valuePage(db, db.projects, db.statusDate);
    /* The list is offered to every reader — the labels are the ones
       /api/periods already serves — but the CONTENT of a stored page is
       behind `period.close`, which is where the aggregate lives. */
    res.json({
      ...page,
      scopeLabel: scopeLabel(req.user),
      mayStore: can(req.user, "period.close").ok,
      stored: can(req.user, "period.close").ok ? await storedPeriods() : [],
    });
  } catch (e) { next(e); }
});

/* ── the stored page ─────────────────────────────────────────────────
   Read, never recomputed. Every figure comes back exactly as it was
   written — including the ones that were not measured, which come back
   as absences with their reason rather than as zeros. */
r.get("/valuepage/:periodId", require$("period.close"), async (req, res, next) => {
  try {
    const head = await one(
      `SELECT v.*, p.label, p.restates, p.closed_at, p.closed_by_label, p.note AS period_note
         FROM report_value v JOIN report_period p ON p.id = v.period_id
        WHERE v.period_id = $1`, [req.params.periodId]);
    if (!head) throw new HttpError(404, "No value page was stored for that reporting period");
    const rows = await many(
      `SELECT figure, seq, state, unit, value, n, why, note, detail
         FROM report_value_figure WHERE period_id = $1 ORDER BY seq, figure`,
      [head.period_id]);

    const figures = {};
    for (const row of rows) figures[row.figure] = figureFromRow(row);
    res.json({
      period: {
        id: head.period_id, label: head.label, restates: head.restates ?? null,
        statusDate: head.status_date, closedAt: head.closed_at,
        closedBy: head.closed_by_label, note: head.period_note,
      },
      stored: {
        at: head.stored_at, by: head.stored_by_label, scope: head.scope_label,
        projects: head.projects, measured: head.measured,
        notMeasured: head.not_measured, note: head.note,
      },
      /* The order the page was stored in, from the rows themselves, so a
         page stored before a seventh figure existed still reads in the
         order it was written rather than in today's. */
      order: rows.map((x) => x.figure),
      figures,
    });
  } catch (e) { next(e); }
});

/* ── the act ─────────────────────────────────────────────────────────
   One transaction, one audit row, and two refusals before it — see the
   head of this file for why each exists. */
r.post("/valuepage/:periodId", require$("period.close"), async (req, res, next) => {
  try {
    const period = await one(
      `SELECT id, label, status_date FROM report_period WHERE id = $1`,
      [req.params.periodId]);
    if (!period) throw new HttpError(404, "No such reporting period");

    const already = await one(
      `SELECT period_id, stored_at, stored_by_label FROM report_value WHERE period_id = $1`,
      [period.id]);
    if (already) {
      /* Refusals are composed on the server and are also the audit record
         (V-10), so they are written as a translatable PREFIX followed by
         data only — that is the shape server/src/i18n.js can carry into
         French and Spanish without translating a project's own words. */
      throw new HttpError(409,
        "A value page is already stored for this reporting period, and what was reported is a record " +
        "rather than a working copy. To correct it, close a new period that restates this one and " +
        "store the value page against that, so the restatement is itself on the record: " +
        `${period.id} · ${period.label} · ${already.stored_by_label}`);
    }

    /* Read the book BEFORE opening the transaction: db.js refuses a
       module-level read issued while one is open, and the figures are a
       read of the whole portfolio. */
    const db = await loadPortfolio(req.user);
    const statusDate = String(db.statusDate);
    const periodDate = String(period.status_date).slice(0, 10);
    if (periodDate !== statusDate) {
      throw new HttpError(409,
        "These figures are read from the book as it stands today, so they can only be stored against " +
        "a period closed at the book's own status date. Storing them against a period closed on " +
        "another day would file today's numbers under a date on which they were not true, and nobody " +
        "reading them later could tell. Close a period at today's status date instead: " +
        `${period.id} · ${period.label} · ${periodDate} → ${statusDate}`);
    }

    const page = valuePage(db, db.projects, statusDate);
    const rows = figureRows(page);
    const note = String(req.body?.note ?? "").slice(0, 1000);
    const scope = scopeLabel(req.user);

    await audited(req.user,
      () => ({
        action: "Value page stored for a reporting period",
        entity: "report_value", entityId: period.id,
        detail: `${period.label} — ${page.scope.measured} of ${rows.length} figure(s) measured, ` +
                `${page.scope.notMeasured} not measured, over ${page.scope.projects} project(s) ` +
                `as at ${statusDate}`,
        after: {
          period: period.id, statusDate, projects: page.scope.projects,
          /* The trail carries the STATE of each figure, so an auditor can
             see from the audit row alone that four of six were absences
             — without that, a page of dashes and a page of numbers leave
             the same trace. */
          figures: Object.fromEntries(rows.map((x) => [x.figure, x.state])),
        },
      }),
      async (t) => {
        await t.query(
          `INSERT INTO report_value
             (period_id, status_date, stored_by, stored_by_label, scope_label,
              projects, measured, not_measured, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [period.id, statusDate, req.user.id,
           `${req.user.displayName} (${req.user.role})`, scope,
           page.scope.projects, page.scope.measured, page.scope.notMeasured, note]);
        for (const x of rows) {
          await t.query(
            `INSERT INTO report_value_figure
               (period_id, figure, seq, state, unit, value, n, why, note, detail)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [period.id, x.figure, x.seq, x.state, x.unit, x.value, x.n, x.why, x.note, x.detail]);
        }
      });

    res.status(201).json({
      period: period.id, statusDate, figures: rows.length,
      measured: page.scope.measured, notMeasured: page.scope.notMeasured,
      projects: page.scope.projects, scope,
    });
  } catch (e) { next(e); }
});

export default r;

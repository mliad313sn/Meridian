/**
 * REQ-30 (RT365 V-11) — THE VALUE PAGE: ONE PRINTABLE PAGE THAT ANSWERS
 * "IS IT WORTH IT", AND A SNAPSHOT OF IT PER REPORTING PERIOD.
 *
 * « The portfolio view answers "is it on time and on budget"; nobody can
 *   answer "is it worth it". »
 *
 * Six figures, all of them read from objects the book already holds — the
 * business case, the benefits, the RAID register, the gate ladder, the
 * tolerance exceptions and the ledger. Nothing on this page asks anybody
 * to type anything, which is the request's own constraint.
 *
 * ── The rule that governs this file above all others ────────────────
 *
 * **This is the feature that writes history.** A snapshot exists so that
 * a claim made in March can be re-read in December, and it is stored in
 * an append-only table: a number written wrong is wrong for ever and can
 * only be corrected by a new period that says it supersedes the old one.
 *
 * The product has made exactly that mistake once already. It reported ON
 * TRACK 100 %, 16 GREEN, SCHEDULE INDEX 1.00, COST INDEX 1.00 for a book
 * with no budget, and wrote the manufactured green into `report_snapshot`
 * (REQ-33, fixed in 5.13.0 with a fourth `N` / "not measured" state and
 * formatters that return `—` rather than invent `0.00`).
 *
 * So every figure below obeys three rules without exception:
 *
 *   1. it can say **not measured**, with a reason, and it reaches for
 *      that rather than for a zero, a 100 % or a colour;
 *   2. **"nothing was measured" and "the measurement was nil" are
 *      different sentences.** A portfolio whose projects carry no
 *      business case has NO spend-against-case — not a spend of zero.
 *      A portfolio whose benefits carry no realisation date has NO
 *      overdue reviews — not zero overdue. Where a zero IS the honest
 *      answer, the figure is `measured` with the value 0 AND a note
 *      naming the population it was counted over, so the December reader
 *      can tell the two apart on the page rather than by inference;
 *   3. no figure carries a colour. Nobody has agreed what "too little
 *      benefit" is for this group, and a threshold chosen in this file
 *      would be the same fabrication REQ-33 was written to end. The
 *      numbers are stated; the judgement stays with the committee.
 *
 * ── Pure, and shared ────────────────────────────────────────────────
 *
 * Same idiom as `shared/govsignals.js` (5.14.0) and `shared/prioritise.js`
 * (REQ-24): one computation, called by the server when it writes the
 * snapshot and by the browser when it draws the page. Two projections of
 * the same number diverge at the first change, and the board would then
 * be reading a page that does not match its own record.
 *
 * The input is the SERIALISER's shape — the object `loadPortfolio()`
 * returns and `/api/bootstrap` sends — so neither side has to translate.
 * Arithmetic that belongs to the engine is imported from the engine;
 * `shared/engine.js` is behaviour-frozen and is not touched here.
 * `Engine.valueReport` (V-4) does the promise-against-measurement work
 * and is CALLED rather than re-implemented.
 *
 * ── Labels are KEYS, not English ────────────────────────────────────
 *
 * Literal-keyed i18n (web/src/lib/i18n.js): the English sentence IS the
 * key. Every `label`, `why` and `note` below is an English literal meant
 * to be passed through `t()` at the call site. They travel through a
 * VARIABLE, so gate F5 cannot see them — the entries are added to FR and
 * ES by hand, and `VALUE_TEXT` exists so that whoever wires a screen to
 * this module knows exactly which ones.
 *
 * ── Money ───────────────────────────────────────────────────────────
 *
 * Every money number that leaves this file is in MILLIONS, like the
 * engine and every screen (`toM` has already run in the serialiser). The
 * route converts back to exact whole units with `fromM` before it stores
 * anything — the database keeps money exact, the page reads it in
 * millions, and `MONEY_FIELDS` below names every field that conversion
 * applies to so the round trip is declared in one place instead of being
 * remembered in two.
 */

import { Engine, D, days, iso, money, sum } from "./engine.js";

/* The engine's own rule for "there is no number here", restated because
   engine.js does not export it and must not be edited to make it do so. */
const noNumber = (v) => v === null || v === undefined || !Number.isFinite(Number(v));

/* ── the sentences this module can say ────────────────────────────────
   Collected in one table so the person wiring the screen knows exactly
   which keys to add to FR/ES, and so no sentence is written twice in two
   slightly different ways. */
export const VALUE_TEXT = {
  block:       "What it was worth",
  strap:       "Spend against the case, benefits by status, reviews overdue, exposure, gates due and exceptions open — read from the book, nothing typed.",
  notMeasured: "Not measured",

  spendAgainstCase: "Spend against case",
  benefitsByStatus: "Benefits by status",
  overdueReviews:   "Benefit reviews overdue",
  topRisks:         "Top risk exposure",
  gatesDue:         "Gates due",
  exceptionsOpen:   "Exceptions open",

  /* why a figure has no value — an absence, never a zero */
  noProjects:       "No project is in scope for this reader",
  noCase:           "No project in scope carries a business case — there is nothing to set the spend against",
  caseWithoutCost:  "The business cases in scope state no expected cost, so spend cannot be compared with one",
  noBenefit:        "No project in scope has stated a benefit — there is nothing to report by status",
  noRealiseDate:    "No benefit carries the date it was to be realised — nothing can be overdue, which is not the same as nothing being late",
  noOpenRisk:       "No risk is open in this scope — there is no exposure to rank",
  noGateDated:      "No gate in scope carries a committed date — a placeholder is a position on a timeline, not a commitment",
  noTolerance:      "No project in scope carries a tolerance, so no exception can be raised — an empty exception register here is not a clean one",

  /* notes carried BESIDE a figure that is measured, so that a nil reads
     as a nil and never as an absence */
  noCostLine:       "No cost line has been booked against those cases — the spend is nil, not unmeasured",
  noneOverdue:      "None of the dated benefit reviews is past due",
  noneDue:          "No committed gate falls inside the horizon",
  noExceptionOpen:  "No exception is open against the tolerances that are set",
  benefitsUnmeasured: "Some benefits carry no measurement yet",
  someUncased:      "Some projects in scope carry no business case and are not in this comparison",
  someCaseUncosted: "Some business cases state no expected cost, so their spend is in no comparison either",
  issuesOpen:       "Issues are open too, and are counted apart from risks",
  placeholdersOut:  "Gates dated with a placeholder are excluded — a placeholder is not a commitment",
};

/** The six, in the order the page draws them and stores them. */
export const FIGURE_ORDER = [
  "spendAgainstCase", "benefitsByStatus", "overdueReviews",
  "topRisks", "gatesDue", "exceptionsOpen",
];

/** How far ahead "due" reaches. A quarter is the board's own horizon. */
export const GATE_HORIZON_DAYS = 90;

/** How many rows a "top" list carries onto a printed page. */
export const TOP_N = 5;

/**
 * Every field, anywhere in this module's output, that is MONEY IN
 * MILLIONS. The route converts exactly these with `fromM`/`toM` on the
 * way in and out of the database, where money is exact whole units.
 * Declared here, once, rather than remembered in the writer and again in
 * the reader.
 */
export const MONEY_FIELDS = new Set([
  "expectedCost", "expectedBenefit", "spend", "variance", "uncasedSpend", "budget",
]);

/* ── the figure envelope ──────────────────────────────────────────────
   Every figure has the same shape, measured or not, so a view never has
   to ask "does this one have a value field?". `state` is the only thing
   worth branching on, and `formatValue` does that branch once. */

function measured(key, unit, value, { n = 0, note = null, extra = {} } = {}) {
  return {
    key, label: VALUE_TEXT[key], unit,
    state: "measured",
    /* No amber, no red, and `rag` null on a measured figure: a colour
       chosen in this file would be the fabrication REQ-33 ended. */
    rag: null, why: null, note,
    value, n, extra,
  };
}

function absent(key, unit, why, { n = 0, extra = {} } = {}) {
  return {
    key, label: VALUE_TEXT[key], unit,
    /* The fourth state, spelled the way the engine spells it. A caller
       that only knows G/A/R still gets `—` from `formatValue`. */
    state: "N", rag: "N", why, note: null,
    value: null, n, extra,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   1 · SPEND AGAINST CASE
   ───────────────────────────────────────────────────────────────────
     promised   business_case.expected_cost — what the payer was told it
                would cost, at the moment the case was written (028).
     actual     the ledger, summed. Exact whole units in the table,
                millions here, and append-only: a mis-posting is
                corrected by a reversing entry, so this total is what was
                actually booked rather than what somebody decided it
                should look like.

   The comparison is made ONLY over projects that carry a case with an
   expected cost. Spend on a project with no case is real money and is
   NOT quietly folded into the total — it is counted apart, in
   `extra.uncased` / `extra.uncasedSpend`, because a portfolio that
   spends outside any case is exactly the thing this page exists to show.

   Not measurable when no project carries a case, or when the cases carry
   no expected cost. Neither of those is a spend of zero. A case that
   exists with no cost line booked against it IS a nil, and says so.
   ═══════════════════════════════════════════════════════════════════ */
function spendAgainstCase(db, projects) {
  const caseOf = new Map((db.businessCases ?? []).map((c) => [c.project, c]));
  const spendOf = new Map();
  for (const l of db.ledger ?? []) {
    spendOf.set(l.project, (spendOf.get(l.project) ?? 0) + Number(l.amount ?? 0));
  }
  const linesOf = new Map();
  for (const l of db.ledger ?? []) linesOf.set(l.project, (linesOf.get(l.project) ?? 0) + 1);

  const cased = projects.filter((p) => caseOf.has(p.id));
  const withCost = cased.filter((p) => !noNumber(caseOf.get(p.id).expectedCost));
  const uncased = projects.filter((p) => !caseOf.has(p.id));
  const uncasedSpend = sum(uncased, (p) => spendOf.get(p.id) ?? 0);

  const extra = {
    projects: projects.length,
    cased: cased.length, casedWithCost: withCost.length,
    uncased: uncased.length, uncasedSpend,
    /* Every project that has one, so the printed table can show the
       comparison line by line rather than only in total. */
    lines: withCost.map((p) => {
      const c = caseOf.get(p.id);
      const spend = spendOf.get(p.id) ?? 0;
      return {
        project: p.id, name: p.name,
        expectedCost: c.expectedCost, expectedBenefit: c.expectedBenefit,
        spend, variance: c.expectedCost - spend,
        costLines: linesOf.get(p.id) ?? 0,
        /* PM-03 / REQ-22 — a case reconfirmed at a gate and revised
           afterwards no longer covers what it says. The page must carry
           that, because a comparison against a promise nobody has stood
           behind since is worth less than it looks. */
        reconfirmedGate: c.reconfirmedGate ?? null,
        staleSinceReconfirm: !!c.staleSinceReconfirm,
      };
    }),
  };

  if (!projects.length) return absent("spendAgainstCase", "money", VALUE_TEXT.noProjects, { extra });
  if (!cased.length) return absent("spendAgainstCase", "money", VALUE_TEXT.noCase, { extra });
  if (!withCost.length) return absent("spendAgainstCase", "money", VALUE_TEXT.caseWithoutCost, { extra });

  const expectedCost = sum(withCost, (p) => caseOf.get(p.id).expectedCost);
  const expectedBenefit = sum(
    withCost.filter((p) => !noNumber(caseOf.get(p.id).expectedBenefit)),
    (p) => caseOf.get(p.id).expectedBenefit);
  const spend = sum(withCost, (p) => spendOf.get(p.id) ?? 0);
  const costLines = sum(withCost, (p) => linesOf.get(p.id) ?? 0);
  const notes = [];
  if (!costLines) notes.push(VALUE_TEXT.noCostLine);
  if (uncased.length) notes.push(VALUE_TEXT.someUncased);
  /* A case with no expected cost is in NEITHER total — not in the
     comparison, and not in the uncased spend beside it. That is a third
     silence, and it is said out loud rather than left to be worked out
     from the difference between two counts. */
  if (cased.length > withCost.length) notes.push(VALUE_TEXT.someCaseUncosted);

  return measured("spendAgainstCase", "money", spend, {
    n: withCost.length,
    note: notes.length ? notes.join(" · ") : null,
    extra: {
      ...extra, expectedCost, expectedBenefit, costLines,
      variance: expectedCost - spend,
      /* Null rather than a division by zero: a case that promised
         nothing has no "share of the case spent". */
      share: expectedCost > 0 ? spend / expectedCost : null,
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   2 · BENEFITS BY STATUS
   ───────────────────────────────────────────────────────────────────
   `Engine.valueProfile` already counts the five statuses, the measured
   set, the decided set and the mean attainment, and it is frozen. It is
   called here rather than copied.

   The headline is the LIVE count — everything not withdrawn — because
   the withdrawn ones are a different sentence and travel beside it.

   Not measurable when no benefit exists at all in scope. A portfolio
   that has promised nothing has no benefit profile; it does not have a
   profile of zeros, and the number of projects promising nothing is
   carried in `extra.uncased` so the absence is quantified rather than
   merely stated.
   ═══════════════════════════════════════════════════════════════════ */
function benefitsByStatus(db, projects) {
  const profile = Engine.valueProfile(db, projects);
  const extra = {
    states: profile.states, total: profile.total, live: profile.live,
    measured: profile.measured, decided: profile.decided, met: profile.met,
    hitRate: profile.hitRate, attainment: profile.attainment,
    uncased: profile.uncased, projects: projects.length,
  };
  if (!profile.total) return absent("benefitsByStatus", "count", VALUE_TEXT.noBenefit, { extra });
  const unmeasured = profile.live - profile.measured;
  return measured("benefitsByStatus", "count", profile.live, {
    n: profile.total,
    note: unmeasured > 0 ? VALUE_TEXT.benefitsUnmeasured : null,
    extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   3 · BENEFIT REVIEWS OVERDUE
   ───────────────────────────────────────────────────────────────────
     due       benefit.realise_on — the day the promise was to have been
               kept, stated when the benefit was written.
     kept      benefit.actual — a measurement, by somebody, of what
               actually happened.

   Overdue means the day has passed and no measurement has been recorded.
   The DENOMINATOR is the dated benefits, and it travels with the number:
   "0 of 14" and "0 of 0" are not the same statement and a tile that
   printed both as `0` would be the REQ-33 mistake in a new place.

   Not measurable when no benefit carries a realisation date at all. An
   undated promise is not late — it is unschedulable, which is worse and
   is counted separately in `extra.undated`.
   ═══════════════════════════════════════════════════════════════════ */
function overdueReviews(db, projects, asAt) {
  const ids = new Set(projects.map((p) => p.id));
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const live = (db.benefits ?? []).filter((b) => ids.has(b.project) && b.status !== "Withdrawn");
  const dated = live.filter((b) => !!b.realiseOn);
  const undated = live.length - dated.length;
  const late = dated
    .filter((b) => b.actual == null && days(b.realiseOn, asAt) > 0)
    .map((b) => ({
      id: b.id, project: b.project, projectName: nameOf.get(b.project) ?? b.project,
      title: b.title, unit: b.unit, realiseOn: b.realiseOn,
      overdueDays: days(b.realiseOn, asAt), status: b.status,
      owner: b.owner ?? null,
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const extra = {
    benefits: live.length, dated: dated.length, undated,
    worstDays: late.length ? late[0].overdueDays : null,
    list: late.slice(0, TOP_N),
  };
  if (!dated.length) return absent("overdueReviews", "count", VALUE_TEXT.noRealiseDate, { extra });
  return measured("overdueReviews", "count", late.length, {
    n: dated.length,
    note: late.length ? null : VALUE_TEXT.noneOverdue,
    extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   4 · TOP RISK EXPOSURE
   ───────────────────────────────────────────────────────────────────
     exposure  probability × impact, the engine's own arithmetic, and the
               escalation level the settings already decide.

   Risks, not the whole register: the request asks for "top risks by
   exposure", and an issue is a thing that HAS happened rather than a
   thing that might. The open issues are counted beside it so that a
   quiet risk register cannot read as a quiet portfolio.

   Register rows attached to no project are portfolio-wide risks and are
   IN — the same rule the serialiser and `Engine.riskProfile` apply — and
   `extra.portfolioWide` says how many, so nobody has to infer it.

   Not measurable when no risk is open. That is not an exposure of zero:
   zero is a score a register can genuinely produce, and an empty
   register cannot.
   ═══════════════════════════════════════════════════════════════════ */
function topRisks(db, projects, asAt) {
  const ids = new Set(projects.map((p) => p.id));
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const mine = (r) => (r.project ? ids.has(r.project) : true);
  const open = (db.raid ?? []).filter((r) => r.status === "Open" && mine(r));
  const risks = open.filter((r) => r.type === "Risk");
  const issues = open.filter((r) => r.type === "Issue");

  const scored = risks.map((r) => ({
    id: r.id, project: r.project ?? null,
    projectName: r.project ? (nameOf.get(r.project) ?? r.project) : null,
    title: r.title, type: r.type, p: r.p, i: r.i,
    exposure: Engine.exposure(r),
    band: Engine.exposureBand(r),
    level: Engine.escalation(db, r).level,
    owner: r.owner ?? null, review: r.review ?? null,
    ageDays: r.opened ? days(r.opened, asAt) : null,
  })).sort((a, b) => b.exposure - a.exposure || String(a.id).localeCompare(String(b.id)));

  const bands = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  for (const r of scored) if (bands[r.band] !== undefined) bands[r.band]++;
  const extra = {
    open: risks.length, issues: issues.length,
    portfolioWide: risks.filter((r) => !r.project).length,
    bands,
    steering: scored.filter((r) => r.level === "Steering").length,
    pmo: scored.filter((r) => r.level === "PMO").length,
    appetite: {
      pmo: db.settings?.pmoExposure ?? null,
      steering: db.settings?.escalateExposure ?? null,
    },
    top: scored.slice(0, TOP_N),
  };
  if (!scored.length) return absent("topRisks", "exposure", VALUE_TEXT.noOpenRisk, { extra });
  return measured("topRisks", "exposure", scored[0].exposure, {
    n: scored.length,
    note: issues.length ? VALUE_TEXT.issuesOpen : null,
    extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   5 · GATES DUE
   ───────────────────────────────────────────────────────────────────
     due       milestone.due_date on a milestone of kind `gate` that is
               not yet done, on the ladder its programme declares (036 /
               043 — four gates or six, whichever this programme walks).
     state     `Engine.gateStatus` — Cleared, Overdue, Ready, At risk,
               Planned, Unscheduled — a WORD, so it survives a greyscale
               print, which a dot does not.

   A gate dated with a PLACEHOLDER is excluded (REQ-14: a placeholder is
   a position on a timeline, not a commitment) and counted in
   `extra.placeholders`, because a board told "no gates due" when six
   gates carry a provisional date has been told something false.

   Not measurable when no gate in scope carries a committed date. With
   committed dates and none inside the horizon, the answer is a real
   zero and the note says over what population.
   ═══════════════════════════════════════════════════════════════════ */
function gatesDue(db, projects, asAt, horizonDays) {
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const ids = new Set(projects.map((p) => p.id));
  const gates = (db.milestones ?? []).filter((m) =>
    ids.has(m.project) && m.kind === "gate" && !m.done);
  const placeholders = gates.filter((m) => m.dateBasis === "placeholder" || !m.date).length;
  const committed = gates.filter((m) => m.date && m.dateBasis !== "placeholder");

  const until = iso(new Date(D(asAt).getTime() + horizonDays * 86400000));
  const due = committed
    .filter((m) => iso(m.date) <= until)
    .map((m) => {
      const st = Engine.gateStatus(db, m.project, m.gate);
      return {
        project: m.project, projectName: nameOf.get(m.project) ?? m.project,
        gate: m.gate, name: m.name, date: iso(m.date),
        inDays: days(asAt, m.date),
        state: st.state,
        /* What is actually missing, in words: the count of evidence
           items still outstanding and criteria not yet found met. A gate
           two weeks out with four documents outstanding is the line an
           executive page exists to put in front of somebody. */
        outstanding: st.outstanding.length,
        unmet: (st.unmet ?? []).length,
        owner: m.owner ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const extra = {
    horizonDays, gatesOpen: gates.length, committed: committed.length,
    placeholders,
    overdue: due.filter((g) => g.inDays < 0).length,
    list: due.slice(0, TOP_N),
  };
  if (!committed.length) return absent("gatesDue", "count", VALUE_TEXT.noGateDated, { extra });
  const notes = [];
  if (!due.length) notes.push(VALUE_TEXT.noneDue);
  if (placeholders) notes.push(VALUE_TEXT.placeholdersOut);
  return measured("gatesDue", "count", due.length, {
    n: committed.length,
    note: notes.length ? notes.join(" · ") : null,
    extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   6 · EXCEPTIONS OPEN
   ───────────────────────────────────────────────────────────────────
     raised    project_exception.raised_on — written by the hourly sweep
               (server/src/exceptions.js), by nobody's hand.
     open      an exception never closes by itself: the forecast may fall
               back inside the margin and the exception stays open until
               a person says what they did about it.

   THE TRAP THIS FIGURE IS BUILT AROUND. Zero open exceptions on a book
   where nobody has set a tolerance is not a portfolio in control — it is
   a portfolio with no limits to breach, and reporting "0" would be the
   REQ-33 fabrication with a different name. So the figure is NOT
   MEASURED unless at least one project in scope carries an active
   tolerance, and it says which of the two situations it is in.
   ═══════════════════════════════════════════════════════════════════ */
function exceptionsOpen(db, projects, asAt) {
  const ids = new Set(projects.map((p) => p.id));
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const tolerances = (db.tolerances ?? []).filter((x) => ids.has(x.project));
  const rows = (db.exceptions ?? []).filter((x) => ids.has(x.project));
  const open = rows.filter((x) => x.status === "Open").map((x) => ({
    id: x.id, project: x.project, projectName: nameOf.get(x.project) ?? x.project,
    dimension: x.dimension, raisedOn: x.raisedOn,
    ageDays: x.raisedOn ? days(x.raisedOn, asAt) : null,
    measured: x.measured, allowed: x.allowed, detail: x.detail,
  })).sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

  /* The dimensions are counted FROM THE ROWS, not from a list written
     here. Migration 042 added a fourth one — `benefit-review` — and a
     fixed list would have silently dropped it: a page that quietly
     counts five exceptions as four is the same class of defect as a
     fabricated zero, with a smaller number on it. */
  const byDimension = {};
  for (const x of open) byDimension[x.dimension] = (byDimension[x.dimension] ?? 0) + 1;
  const ages = open.map((x) => x.ageDays).filter((v) => !noNumber(v));
  const extra = {
    exceptions: rows.length,
    answered: rows.filter((x) => x.status === "Answered").length,
    withdrawn: rows.filter((x) => x.status === "Withdrawn").length,
    tolerances: tolerances.length,
    projectsBounded: new Set(tolerances.map((x) => x.project)).size,
    byDimension,
    oldestDays: ages.length ? Math.max(...ages) : null,
    list: open.slice(0, TOP_N),
  };
  if (!tolerances.length) return absent("exceptionsOpen", "count", VALUE_TEXT.noTolerance, { extra });
  return measured("exceptionsOpen", "count", open.length, {
    n: extra.projectsBounded,
    note: open.length ? null : VALUE_TEXT.noExceptionOpen,
    extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   THE PAGE
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @param db        the serialiser's object (loadPortfolio / bootstrap)
 * @param projects  the slate to report on; defaults to every project in
 *                  the object, which is what the executive page uses —
 *                  a page filtered to one programme and a snapshot taken
 *                  over the whole book would not be the same page.
 * @param asOf      the as-at; defaults to the book's status date, which
 *                  is what a reporting period is closed on.
 */
export function valuePage(db, projects, asOf) {
  const list = projects ?? db.projects ?? [];
  const asAt = iso(asOf ?? db.statusDate);
  const horizon = GATE_HORIZON_DAYS;

  const figures = {
    spendAgainstCase: spendAgainstCase(db, list),
    benefitsByStatus: benefitsByStatus(db, list),
    overdueReviews: overdueReviews(db, list, asAt),
    topRisks: topRisks(db, list, asAt),
    gatesDue: gatesDue(db, list, asAt, horizon),
    exceptionsOpen: exceptionsOpen(db, list, asAt),
  };

  /* V-4, called rather than copied: the promise against the measurement,
     project by project, which is the body of the printed page. */
  const report = Engine.valueReport(db, list, asAt);
  const spendOf = new Map();
  for (const l of db.ledger ?? []) {
    spendOf.set(l.project, (spendOf.get(l.project) ?? 0) + Number(l.amount ?? 0));
  }
  const riskTop = new Map();
  for (const r of (db.raid ?? [])) {
    if (r.status !== "Open" || r.type !== "Risk" || !r.project) continue;
    const e = Engine.exposure(r);
    if (!(riskTop.get(r.project) >= e)) riskTop.set(r.project, e);
  }
  /* Per project, from the register itself rather than from the figure's
     `list` — that list is capped at TOP_N because it is stored, and a
     row-per-project table built from a capped list would silently show
     "no gate due" for the seventh project. */
  const gateNext = new Map();
  for (const m of (db.milestones ?? [])) {
    if (m.kind !== "gate" || m.done || !m.date || m.dateBasis === "placeholder") continue;
    const at = iso(m.date);
    const held = gateNext.get(m.project);
    if (!held || at < held.date) {
      gateNext.set(m.project, { gate: m.gate, name: m.name, date: at, inDays: days(asAt, m.date) });
    }
  }
  const openExceptions = new Map();
  for (const x of (db.exceptions ?? [])) {
    if (x.status !== "Open") continue;
    openExceptions.set(x.project, (openExceptions.get(x.project) ?? 0) + 1);
  }

  const rows = report.rows.map((r) => ({
    ...r,
    budget: (list.find((p) => p.id === r.project) ?? {}).budget ?? null,
    spend: spendOf.has(r.project) ? spendOf.get(r.project) : null,
    /* Null, not zero: a project with no cost line has had nothing booked
       against it, and the page says `—` rather than claiming a spend of
       nought that somebody could read as "on budget". */
    topExposure: riskTop.has(r.project) ? riskTop.get(r.project) : null,
    nextGate: gateNext.get(r.project) ?? null,
    exceptionsOpen: openExceptions.get(r.project) ?? 0,
  }));

  return {
    asAt,
    horizonDays: horizon,
    order: FIGURE_ORDER,
    figures,
    rows,
    totals: report.totals,
    scope: {
      projects: list.length,
      closed: list.filter((p) => p.closed).length,
      /* How much of the page is an absence, stated as a number so that a
         reader — and a test — can see at a glance whether this book can
         answer the question at all. */
      measured: FIGURE_ORDER.filter((k) => figures[k].state === "measured").length,
      notMeasured: FIGURE_ORDER.filter((k) => figures[k].state !== "measured").length,
    },
  };
}

/* ── formatting ────────────────────────────────────────────────────────
   One branch, written once, so no caller has to remember it. It returns
   the em dash the product already uses everywhere else for "there is no
   number here" — never 0, never 100 %, never a colour. */

/** The headline of a figure, in its own unit, or `—` when not measured. */
export function formatValue(f) {
  if (!f || f.state !== "measured" || noNumber(f.value)) return "—";
  if (f.unit === "money") return money(f.value);
  return String(Math.round(Number(f.value)));
}

/**
 * The denominator, spelled out. This is the sentence that separates "no
 * benefit was measured in this period" from "the measured benefit was
 * nil", and it is a function rather than a habit so no screen can forget
 * it. `null` when the figure is not measured — there is a `why` there
 * instead, and printing both would say the same thing twice.
 */
export function formatPopulation(f) {
  if (!f || f.state !== "measured") return null;
  const e = f.extra ?? {};
  switch (f.key) {
    case "spendAgainstCase": return `${f.n} case(s) with an expected cost, of ${e.projects} project(s)`;
    case "benefitsByStatus": return `${e.live} live of ${e.total} benefit(s) stated`;
    case "overdueReviews":   return `of ${f.n} dated review(s)`;
    case "topRisks":         return `highest of ${f.n} open risk(s)`;
    case "gatesDue":         return `within ${e.horizonDays} days, of ${f.n} committed gate(s)`;
    case "exceptionsOpen":   return `against ${f.n} project(s) carrying a tolerance`;
    default: return null;
  }
}

export default valuePage;

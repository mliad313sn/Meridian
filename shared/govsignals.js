/**
 * REQ-28 (RT365 V-9) — GOVERNANCE QUALITY SIGNALS, FROM TIMESTAMPS THAT
 * ALREADY EXIST.
 *
 * « A PMO that cannot see its own throughput cannot improve it, and these
 * five are the leading indicators of a programme quietly stalling. »
 *
 * The binding constraint of the request is *no new data entry*, and it is
 * also the test of the design: every number below is read from a column
 * somebody already fills in for another reason. There is no migration in
 * this file's scope and none is reserved for it. Where a clock does not
 * exist, the metric says so — it does not borrow a neighbouring clock and
 * hope.
 *
 * ── The rule this file was written under (REQ-33, 5.13.0) ────────────
 *
 * The product once reported ON TRACK 100 %, SPI 1.00, COST INDEX 1.00 for
 * a book with no budget, and wrote that manufactured green into an
 * append-only snapshot. The fix was a fourth RAG state, `N` / "Not
 * measured", and formatters that return `—` rather than invent `0.00`.
 *
 * So: **every one of the five metrics has a not-measured state, and every
 * one of them reaches for it rather than for a zero, a 100 % or a green.**
 *   · a portfolio that has closed no gate has NO gate cycle time — it does
 *     not have a cycle time of zero, and it is not doing well;
 *   · a register with no open action has NO ageing — not an ageing of 0d;
 *   · a compliance rate over an empty denominator is not 100 %;
 *   · a trend needs two periods. With one, there is no trend, and the
 *     object says which of the two it is.
 *
 * Nothing here invents a threshold either. There is no amber and no red on
 * these five, because nobody has agreed what "too slow" is for this group,
 * and a colour this file chose on its own would be exactly the class of
 * fabrication REQ-33 was written to end. The numbers are stated; the
 * judgement stays with the committee that reads them.
 *
 * ── Pure, and shared ────────────────────────────────────────────────
 *
 * No database, no Express, no DOM: the server calls it after loading the
 * rows, the browser can call it on the book it already holds, and the test
 * calls it on a fixture. Arithmetic that belongs to the engine is imported
 * from the engine; `shared/engine.js` is behaviour-frozen and is not
 * touched here.
 *
 * ── Labels are KEYS, not English ────────────────────────────────────
 *
 * The i18n of this product is literal-keyed: the English sentence IS the
 * key, and a missing translation degrades to English rather than to a
 * broken token (web/src/lib/i18n.js). Every `label` and every `why` below
 * is therefore an English literal meant to be passed through `t()` at the
 * call site — never rendered raw beside a French number.
 */

import { D, iso, days, monthKey, pct } from "./engine.js";

/* The engine's own rule for "there is no number here", restated because
   engine.js does not export it and must not be edited to make it do so. */
const noNumber = (v) => v === null || v === undefined || !Number.isFinite(Number(v));

/* ── the sentences this module can say ────────────────────────────────
   Collected in one table so the person wiring the portfolio block knows
   exactly which keys to add to FR/ES, and so no sentence is written twice
   in two slightly different ways. */
export const SIGNAL_TEXT = {
  block:        "Governance signals",
  notMeasured:  "Not measured",

  decisionLatency:        "Decision latency",
  actionAgeing:           "Action ageing",
  gateCycleTime:          "Gate cycle time",
  raidReviewCompliance:   "RAID review compliance",
  exceptionAge:           "Exception age",

  /* why a metric has no value */
  noDecisionClock:  "No decision carries both the day it was taken and the day it was recorded",
  noOpenAction:     "No action is open — there is no ageing to measure",
  noGateClosed:     "No gate has been closed — there is no cycle time",
  gateUndated:      "Gates were closed without a recorded acceptance date",
  ladderUnknown:    "These projects were scaffolded under a gate ladder we cannot name",
  ladderMixed:      "These cycle times come from ladders of different lengths and are not comparable",
  noOpenRaid:       "No RAID item is open",
  noReviewDate:     "No open RAID item carries a review date",
  noOpenException:  "No exception is open — there is no age to measure",

  /* why a trend has no value */
  trendOnePeriod:   "One period only — a trend needs at least two",
  trendNoPeriod:    "No period in this window carries a value — there is nothing to trend",
  /* `trendNoHistory` lived here until 050. It said the register could
     not record that a review happened, which stopped being true the day
     `raid_review` existed — so it is gone rather than left reachable. A
     window with no recorded review now says `trendNoPeriod`, which is
     the honest sentence: nothing to trend, not nothing to record. */
  trendUndatedActions:    "Some actions were closed without a date, so the register cannot be replayed",
  trendUndatedExceptions: "Some exceptions were answered without a date, so the register cannot be replayed",

  /* notes carried beside a value that IS measured */
  awaitingRatification: "Some decisions are proposed and not ratified, and no ratification date is recorded",
};

/** The five, in the order the page draws them. */
export const SIGNAL_ORDER = [
  "decisionLatency", "actionAgeing", "gateCycleTime",
  "raidReviewCompliance", "exceptionAge",
];

/* ── small statistics, honest about emptiness ─────────────────────── */

/** Linear-interpolated quantile over an ascending array. Null when empty. */
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * The distribution, or null when there is nothing to describe.
 *
 * The mean is deliberately NOT the headline. RT365's own sentence: "an
 * action register with a healthy mean and a two-year tail is not healthy".
 * The median leads, p90 and max carry the tail, and both travel with the
 * number so a reader cannot see one without the other.
 */
export function spread(values) {
  const v = values.filter((x) => !noNumber(x)).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const round = (x) => (x === null ? null : Math.round(x * 10) / 10);
  return {
    n: v.length,
    min: v[0], max: v[v.length - 1],
    median: round(quantile(v, 0.5)),
    p90: round(quantile(v, 0.9)),
    mean: round(v.reduce((a, b) => a + b, 0) / v.length),
  };
}

/* ── dates ─────────────────────────────────────────────────────────── */

/** A row's date as YYYY-MM-DD, or null when it does not have one. */
export function dayOf(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = D(v);
  return Number.isFinite(d.getTime()) ? iso(d) : null;
}

/** The last `months` month keys ending at the status date, oldest first. */
export function periodKeys(asAt, months) {
  const d = D(asAt);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    let mm = m - i, yy = y;
    while (mm < 0) { mm += 12; yy -= 1; }
    out.push(`${yy}-${String(mm + 1).padStart(2, "0")}`);
  }
  return out;
}

/** The last day of a period, never later than the status date. */
export function periodEnd(key, asAt) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = dayOf(asAt);
  return today && last > today ? today : last;
}

/* ── the trend ─────────────────────────────────────────────────────────
   One rule, applied identically to all five: a trend needs two periods
   that each carry a value. One period is not a trend, and neither is a
   period whose value is absent — so `periods` keeps the empty months
   visibly empty rather than closing the gap and drawing a line through
   nothing. A metric that CANNOT have a history says so through `why`
   before the counting even starts. */
function trendOf(periods, blockedBy = null) {
  const base = { periods, latest: null, previous: null, delta: null, direction: null };
  if (blockedBy) return { ...base, state: "N", why: blockedBy };
  const valued = periods.filter((p) => !noNumber(p.value));
  if (valued.length < 2) {
    return { ...base,
      state: "N",
      why: valued.length ? SIGNAL_TEXT.trendOnePeriod : SIGNAL_TEXT.trendNoPeriod,
      latest: valued.length ? valued[valued.length - 1].value : null };
  }
  const latest = valued[valued.length - 1].value;
  const previous = valued[valued.length - 2].value;
  const delta = Math.round((latest - previous) * 10) / 10;
  return {
    state: "measured", why: null, periods, latest, previous, delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

/* ── the metric envelope ──────────────────────────────────────────── */

/**
 * Every metric has the same shape, measured or not, so a view never has
 * to ask "does this one have a value field?". `state` is the only thing
 * worth branching on, and `formatSignal` does that branch once.
 */
function measured(key, unit, dist, { extra = {}, note = null, trend, headline, n = null }) {
  return {
    key, label: SIGNAL_TEXT[key], unit,
    /* No amber, no red: nobody has agreed what "too slow" is for this
       group, and a colour chosen here would be the same fabrication
       REQ-33 ended. `rag` is null on a measured signal and `N` on one
       that is not, so a view can reuse the not-measured chip and has
       nothing to reuse for a judgement that was never made. */
    state: "measured", rag: null, why: null, note,
    n: dist ? dist.n : (n ?? 0),
    value: headline,
    median: dist ? dist.median : null,
    p90: dist ? dist.p90 : null,
    mean: dist ? dist.mean : null,
    min: dist ? dist.min : null,
    max: dist ? dist.max : null,
    extra, trend,
  };
}

function absent(key, unit, why, { extra = {}, trend, n = 0 } = {}) {
  return {
    key, label: SIGNAL_TEXT[key], unit,
    /* The fourth state, spelled the way the engine spells it. A caller
       that only knows G/A/R still gets `—` from formatSignal. */
    state: "N", rag: "N", why, note: null,
    n,
    value: null, median: null, p90: null, mean: null, min: null, max: null,
    extra,
    trend: trend ?? trendOf([], why),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   1 · DECISION LATENCY
   ───────────────────────────────────────────────────────────────────
   From WHAT moment to WHAT moment. A decision RAISED and a decision
   RECORDED are different clocks, and only one pair of them exists in
   this schema:

     taken      meeting_occurrence.meets_on when the decision belongs to a
                room, else meeting_decision.decided_on — migration 034 made
                `occurrence_id` nullable precisely so a decision taken out
                of the room could be anchored by date and decider, and the
                CHECK guarantees one of the two is there.
     recorded   meeting_decision.recorded_at — the moment the register
                learned of it.

   So this measures the REGISTER'S LAG: how long a decision lives only in
   somebody's memory before the trail carries it. That is the throughput
   signal the schema can honestly produce.

   What it is NOT, and this matters: it is not the time from a question
   being raised to it being answered. Nothing records when a decision
   became due. Nor is it time-to-ratification: migration 039 gave a
   decision a `status` and a `ratified_by`, and no ratification DATE — so
   a proposed decision's second clock cannot be read at all, and the
   metric says that in `extra.awaitingRatification` rather than quietly
   treating a proposal as a decision recorded on time.

   Not measurable when: no decision carries both dates, or the row was
   written BEFORE the day it says the decision was taken (a backdated
   import). A negative latency is not a fast PMO; it is a row we cannot
   read, and it is counted in `extra.undatable`, never floored to zero.
   ═══════════════════════════════════════════════════════════════════ */
function decisionLatency(rows, asAt, periods) {
  const obs = [];
  let undatable = 0, awaiting = 0;
  for (const d of rows) {
    if ((d.status ?? "Ratified") === "Proposed") awaiting++;
    const taken = dayOf(d.takenOn);
    const recorded = dayOf(d.recordedAt);
    if (!taken || !recorded) { undatable++; continue; }
    const lag = days(taken, recorded);
    if (lag < 0) { undatable++; continue; }
    obs.push({ lag, period: monthKey(taken) });
  }
  const extra = { decisions: rows.length, undatable, awaitingRatification: awaiting };
  const dist = spread(obs.map((o) => o.lag));
  const buckets = periods.map((k) => {
    const s = spread(obs.filter((o) => o.period === k).map((o) => o.lag));
    return { key: k, value: s ? s.median : null, n: s ? s.n : 0 };
  });
  if (!dist) return absent("decisionLatency", "days", SIGNAL_TEXT.noDecisionClock, { extra });
  return measured("decisionLatency", "days", dist, {
    extra, headline: dist.median,
    note: awaiting ? SIGNAL_TEXT.awaitingRatification : null,
    trend: trendOf(buckets),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   2 · ACTION AGEING
   ───────────────────────────────────────────────────────────────────
   The DISTRIBUTION, not the mean — RT365's own words, and the reason
   `spread()` refuses to hand back a mean without a p90 and a max beside
   it. `buckets` carries the shape a mean hides: a register whose median
   is 12 days and whose oldest item is 700 is not a healthy register.

     raised     meeting_occurrence.meets_on of the occurrence the action
                was raised in (`raised_in`, NOT NULL since migration 003).
                NOT `created_at`: that is when the ROW was written, which
                for the 285 rows RT365 loaded through the contract is the
                afternoon of the import and says nothing about the work.
                `created_at` is the fallback only if the occurrence has
                gone.
     now        the status date.

   Ageing is a property of the OPEN register: Done and Cancelled actions
   are out of it, and their closure feeds the trend instead.

   Not measurable when no action is open. That is not an ageing of zero —
   it is an empty register, and the two must not read the same on a tile.
   ═══════════════════════════════════════════════════════════════════ */
const ACTION_OPEN = new Set(["Open", "In progress"]);
const AGE_BUCKETS = [
  ["0-30d", 0, 30], ["31-90d", 31, 90], ["91-180d", 91, 180],
  ["181-365d", 181, 365], ["over a year", 366, Infinity],
];

function actionAgeing(rows, asAt, periods) {
  const today = dayOf(asAt);
  let undatedClosures = 0, overdue = 0, closed = 0;
  const openAges = [];
  const live = [];
  for (const a of rows) {
    const raised = dayOf(a.raisedOn);
    const isOpen = ACTION_OPEN.has(a.status);
    const closedOn = dayOf(a.closedAt);
    if (!isOpen) { closed++; if (!closedOn) undatedClosures++; }
    if (!raised) continue;
    live.push({ raised, closedOn, isOpen });
    if (!isOpen) continue;
    openAges.push(days(raised, today));
    const due = dayOf(a.dueDate);
    if (due && due < today) overdue++;
  }
  const dist = spread(openAges);
  const extra = {
    actions: rows.length, open: openAges.length, closed, overdue, undatedClosures,
    buckets: Object.fromEntries(AGE_BUCKETS.map(([name, lo, hi]) =>
      [name, openAges.filter((x) => x >= lo && x <= hi).length])),
  };

  /* The trend replays the open register at each month end. It can only be
     replayed when every closure carries a date — an action marked Done
     with no `closed_at` cannot be placed on either side of a month end,
     and guessing which side would fabricate the very history the trend is
     supposed to show. */
  const blocked = undatedClosures ? SIGNAL_TEXT.trendUndatedActions : null;
  const buckets = periods.map((k) => {
    const end = periodEnd(k, asAt);
    const ages = live
      .filter((x) => x.raised <= end && (x.isOpen ? true : (x.closedOn && x.closedOn > end)))
      .map((x) => days(x.raised, end));
    const s = spread(ages);
    return { key: k, value: s ? s.median : null, n: s ? s.n : 0 };
  });

  if (!dist) return absent("actionAgeing", "days", SIGNAL_TEXT.noOpenAction, { extra });
  return measured("actionAgeing", "days", dist, {
    extra, headline: dist.median, trend: trendOf(buckets, blocked),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   3 · GATE CYCLE TIME
   ───────────────────────────────────────────────────────────────────
   The ladder is a property of the PROGRAMME (migration 036) and can be
   anything from one to twelve rungs, so **gate 3 of a four-gate ladder is
   not gate 3 of a six-gate one** and the two must never land in the same
   median. Every observation therefore carries its ladder LENGTH and its
   rung, and a set that mixes lengths refuses to produce a headline.

     accepted   milestone.accepted_on — the day a named person recorded
                that the acceptance criteria were met (migration 032).
                `done` alone is a boolean with no clock; a gate ticked
                done with no acceptance date is counted in
                `extra.closedWithoutDate` and measured by nothing.
     ladder     project.scaffolded_gates — the ladder the project was
                actually dressed under (migration 043). NULL means "dressed
                before we wrote it down", and 043 refused to guess it; so
                does this. Those projects go to `extra.unknownLadder`.

   One observation is one RUNG: gate n accepted, then gate n+1 accepted.
   Adjacent only — gate 1 to gate 3 with 2 never closed is not a cycle
   time, it is two of them and a gap.

   Not measurable when no rung has both ends dated. A portfolio that has
   closed no gate has NO cycle time; it does not have a cycle time of 0d,
   and it is not doing well.
   ═══════════════════════════════════════════════════════════════════ */
function gateCycleTime(milestones, ladderOf, asAt, periods) {
  const byProject = new Map();
  let closedWithoutDate = 0, unknownLadder = 0, closedGates = 0;
  for (const m of milestones) {
    if (m.kind !== "gate" || m.gate === null || m.gate === undefined) continue;
    /* REQ-45 (049) — `acceptedOn` leads because it is the stronger claim:
       a named person found criteria posed in advance to be met. `doneOn`
       is all a criteria-less gate ever had to say, and until 049 it had
       nothing at all. A gate ticked before 049 has neither and still
       counts in `closedWithoutDate` — the sentence about it stays true. */
    const accepted = dayOf(m.acceptedOn) ?? dayOf(m.doneOn);
    if (m.done) closedGates++;
    if (m.done && !accepted) closedWithoutDate++;
    if (!accepted) continue;
    if (!byProject.has(m.project)) byProject.set(m.project, []);
    byProject.get(m.project).push({ gate: Number(m.gate), accepted });
  }

  const obs = [];
  for (const [project, gates] of byProject) {
    const ladder = ladderOf(project);
    gates.sort((a, b) => a.gate - b.gate);
    const at = new Map(gates.map((g) => [g.gate, g.accepted]));
    for (const g of gates) {
      const next = at.get(g.gate + 1);
      if (!next) continue;
      if (!Number.isFinite(ladder)) { unknownLadder++; continue; }
      obs.push({
        project, ladder, from: g.gate, to: g.gate + 1,
        step: `${ladder}-gate ladder · ${g.gate} → ${g.gate + 1}`,
        cycle: days(g.accepted, next), closedOn: next,
      });
    }
  }

  const ladders = [...new Set(obs.map((o) => o.ladder))].sort((a, b) => a - b);
  const bySteps = [...new Set(obs.map((o) => o.step))].sort().map((step) => {
    const s = spread(obs.filter((o) => o.step === step).map((o) => o.cycle));
    const one = obs.find((o) => o.step === step);
    return { step, ladder: one.ladder, from: one.from, to: one.to, n: s.n, median: s.median, max: s.max };
  });
  const extra = { closedGates, closedWithoutDate, unknownLadder, ladders, bySteps };

  if (!obs.length) {
    const why = closedWithoutDate ? SIGNAL_TEXT.gateUndated
      : unknownLadder ? SIGNAL_TEXT.ladderUnknown
      : SIGNAL_TEXT.noGateClosed;
    return absent("gateCycleTime", "days", why, { extra });
  }
  /* Mixed ladders: every rung keeps its own median in `bySteps`, and the
     headline refuses. Averaging across ladders would be arithmetic that
     means nothing, presented as if it meant something. */
  if (ladders.length > 1) {
    return absent("gateCycleTime", "days", SIGNAL_TEXT.ladderMixed, { extra, n: obs.length });
  }
  const dist = spread(obs.map((o) => o.cycle));
  const buckets = periods.map((k) => {
    const s = spread(obs.filter((o) => monthKey(o.closedOn) === k).map((o) => o.cycle));
    return { key: k, value: s ? s.median : null, n: s ? s.n : 0 };
  });
  return measured("gateCycleTime", "days", dist, {
    extra, headline: dist.median,
    note: closedWithoutDate ? SIGNAL_TEXT.gateUndated : null,
    trend: trendOf(buckets),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   4 · RAID REVIEW COMPLIANCE
   ───────────────────────────────────────────────────────────────────
     review_on  the date the register says this item is next to be looked
                at (migration 002; the agenda has read it since 034).
     now        the status date.

   Compliance is against that date, and against nothing else: of the OPEN
   items that carry a review date, how many are still inside it. A closed
   item needs no review and is not in the denominator.

   Items with NO review date are the interesting number and they are
   reported separately, as `extra.unscheduled`. They are neither compliant
   nor non-compliant — nobody said when they would be looked at — and
   folding them into either side would be the manufactured-green mistake
   in its purest form. An empty denominator gives no rate at all.

   THIS METRIC HAS NO TREND, and that is a finding rather than an
   omission: the schema records the NEXT review date and no record that a
   review ever happened. When a review is done the date is moved forward,
   which overwrites the only evidence there was. Compliance can therefore
   be stated today and cannot be stated for last month.
   ═══════════════════════════════════════════════════════════════════ */
function raidReviewCompliance(raid, reviews, asAt, periods) {
  const today = dayOf(asAt);
  const open = raid.filter((r) => r.status === "Open");
  const scheduled = open.filter((r) => dayOf(r.review));
  const overdue = scheduled.filter((r) => dayOf(r.review) < today);
  const lateBy = overdue.map((r) => days(dayOf(r.review), today));
  const worst = spread(lateBy);
  const extra = {
    items: raid.length, open: open.length,
    scheduled: scheduled.length, unscheduled: open.length - scheduled.length,
    onTime: scheduled.length - overdue.length, overdue: overdue.length,
    worstOverdueDays: worst ? worst.max : null,
    medianOverdueDays: worst ? worst.median : null,
  };
  /* REQ-46 (050) — until a review was an EVENT, this metric could state
     today and never last month: performing a review moved the due date
     forward and destroyed the only evidence there had been one. The
     trend is now replayed from the recorded reviews.

     Two judgements are written down here because they are arguable, and
     because the numbers they produce differ:

     1 · An item with NO recorded review is left out of the replay
         entirely. Its `review` column holds a date, but that is TODAY's
         date; using it as last April's due date borrows a neighbouring
         clock and hopes. The consequence is real and is stated rather
         than hidden: the headline counts today's whole open register
         and the trend counts the part that has a review history, so the
         two carry different `n` — both publish theirs, and they
         converge as reviews accumulate. The alternative reported 100 %
         for four months on the strength of a column nobody had evidence
         for, which is REQ-33 wearing a different hat.

     2 · An item closed on no recorded day is counted in
         `extra.unplaceable` and left out, rather than silencing the
         whole trend as `actionAgeing` does in the same situation. This
         metric's own doctrine is that a row we cannot judge is reported
         apart and folded into neither side — that is what `unscheduled`
         already is — and one legacy row would otherwise silence a
         metric that now has real history, permanently. */
  const byItem = new Map();
  for (const v of (reviews ?? [])) {
    if (!dayOf(v.on)) continue;
    if (!byItem.has(v.item)) byItem.set(v.item, []);
    byItem.get(v.item).push(v);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => dayOf(a.on).localeCompare(dayOf(b.on)));
  }
  extra.reviews = (reviews ?? []).length;
  extra.reviewed = byItem.size;
  extra.neverReviewed = open.filter((r) => !byItem.has(r.id)).length;
  extra.unplaceable = raid.filter(
    (r) => r.status !== "Open" && !dayOf(r.closedOn) && byItem.has(r.id)).length;

  const buckets = (periods ?? []).map((k) => {
    const end = periodEnd(k, asAt);
    let n = 0, kept = 0;
    for (const r of raid) {
      const evs = byItem.get(r.id);
      if (!evs) continue;                                  // no history to replay
      const opened = dayOf(r.opened);
      if (opened && opened > end) continue;                // not raised yet
      if (r.status !== "Open") {
        const closed = dayOf(r.closedOn);
        if (!closed || closed <= end) continue;            // closed by then, or on no day
      }
      const before = evs.filter((v) => dayOf(v.on) <= end);
      const due = before.length
        ? dayOf(before[before.length - 1].nextOn)
        : dayOf(evs[0].dueOn);                             // what it answered, before the first
      if (!due) continue;                                  // on no rhythm, neither side
      n += 1;
      if (due >= end) kept += 1;
    }
    return { key: k, value: n ? Math.round((kept / n) * 10000) / 10000 : null, n };
  });
  const noTrend = trendOf(buckets);

  if (!scheduled.length) {
    const why = open.length ? SIGNAL_TEXT.noReviewDate : SIGNAL_TEXT.noOpenRaid;
    return absent("raidReviewCompliance", "percent", why, { extra, trend: noTrend });
  }
  const rate = Math.round((extra.onTime / scheduled.length) * 10000) / 10000;
  return measured("raidReviewCompliance", "percent", null, {
    extra, n: scheduled.length, headline: rate, trend: noTrend,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   5 · EXCEPTION AGE
   ───────────────────────────────────────────────────────────────────
     raised     project_exception.raised_on — written by the hourly sweep
                (server/src/exceptions.js), by nobody's hand.
     answered   project_exception.answered_on, when somebody has said what
                they did about it.
     now        the status date.

   The age of the OPEN exceptions, because that is the number the sweep
   exists to produce: an exception never closes by itself — the forecast
   may drop back under the limit and the exception stays open until a
   person answers it. So the age of the open set is, exactly, how long the
   level that granted the margin has been silent.

   `extra.medianAnswerDays` carries the other half — how long answers take
   when they come — from raised_on to answered_on.

   Not measurable when nothing is open. A portfolio with no open exception
   has no exception age; it does not have an age of 0d.
   ═══════════════════════════════════════════════════════════════════ */
function exceptionAge(rows, asAt, periods) {
  const today = dayOf(asAt);
  const openAges = [], answerDays = [], live = [];
  let undatedAnswers = 0, answered = 0;
  for (const e of rows) {
    const raised = dayOf(e.raisedOn);
    const answeredOn = dayOf(e.answeredOn);
    const isOpen = e.status === "Open";
    if (!isOpen) { answered++; if (!answeredOn) undatedAnswers++; }
    if (!raised) continue;
    live.push({ raised, answeredOn, isOpen });
    if (isOpen) openAges.push(days(raised, today));
    else if (answeredOn) answerDays.push(days(raised, answeredOn));
  }
  const dist = spread(openAges);
  const answerSpread = spread(answerDays);
  const extra = {
    exceptions: rows.length, open: openAges.length, answered, undatedAnswers,
    medianAnswerDays: answerSpread ? answerSpread.median : null,
    oldestOpenDays: dist ? dist.max : null,
  };
  const blocked = undatedAnswers ? SIGNAL_TEXT.trendUndatedExceptions : null;
  const buckets = periods.map((k) => {
    const end = periodEnd(k, asAt);
    const ages = live
      .filter((x) => x.raised <= end && (x.isOpen ? true : (x.answeredOn && x.answeredOn > end)))
      .map((x) => days(x.raised, end));
    const s = spread(ages);
    return { key: k, value: s ? s.median : null, n: s ? s.n : 0 };
  });

  if (!dist) return absent("exceptionAge", "days", SIGNAL_TEXT.noOpenException, { extra });
  return measured("exceptionAge", "days", dist, {
    extra, headline: dist.median, trend: trendOf(buckets, blocked),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   THE FIVE, PER PROGRAMME AND FOR THE PORTFOLIO
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @param book {
 *   asAt        status date, YYYY-MM-DD
 *   months      how many monthly periods the trend spans (default 6)
 *   programmes  [{ id, name }]
 *   projects    [{ id, programme, scaffoldedGates }]        — serialiser shape
 *   milestones  [{ project, gate, kind, done, acceptedOn }] — serialiser shape
 *   raid        [{ project, status, review }]               — serialiser shape
 *   exceptions  [{ project, raisedOn, status, answeredOn }] — serialiser shape
 *   decisions   [{ id, project, takenOn, recordedAt, status }]
 *   actions     [{ id, project, raisedOn, status, dueDate, closedAt }]
 * }
 *
 * Rows with no project — the portfolio-wide RAID the legacy register
 * keeps, a decision or an action that belongs to the group rather than to
 * one delivery — count in the portfolio block and in no programme block.
 * That is the same rule `loadPortfolio` already applies to those rows,
 * and it is stated in `portfolio.extra` rather than left to be inferred.
 */
export function govSignals(book = {}) {
  const asAt = dayOf(book.asAt) ?? iso(new Date());
  const months = Number.isFinite(book.months) && book.months > 1 ? Math.floor(book.months) : 6;
  const periods = periodKeys(asAt, months);

  const projects = book.projects ?? [];
  const programmeOf = new Map(projects.map((p) => [p.id, p.programme ?? null]));
  const ladderByProject = new Map(projects.map((p) =>
    [p.id, Number.isFinite(Number(p.scaffoldedGates)) && p.scaffoldedGates !== null
      ? Number(p.scaffoldedGates) : NaN]));
  const ladderOf = (id) => (ladderByProject.has(id) ? ladderByProject.get(id) : NaN);

  const block = (keep) => {
    const own = (rows) => rows.filter((r) => keep(r.project ?? null));
    return {
      decisionLatency: decisionLatency(own(book.decisions ?? []), asAt, periods),
      actionAgeing: actionAgeing(own(book.actions ?? []), asAt, periods),
      gateCycleTime: gateCycleTime(own(book.milestones ?? []), ladderOf, asAt, periods),
      raidReviewCompliance: raidReviewCompliance(
        own(book.raid ?? []), own(book.raidReviews ?? []), asAt, periods),
      exceptionAge: exceptionAge(own(book.exceptions ?? []), asAt, periods),
    };
  };

  const programmes = (book.programmes ?? []).map((pr) => ({
    scope: "programme", id: pr.id, name: pr.name ?? pr.id,
    signals: block((projectId) => projectId !== null && programmeOf.get(projectId) === pr.id),
  }));

  return {
    asAt, months, periods, order: SIGNAL_ORDER,
    portfolio: {
      scope: "portfolio", id: null, name: null,
      signals: block(() => true),
    },
    programmes,
  };
}

/* ── formatting ────────────────────────────────────────────────────────
   One branch, written once, so no caller has to remember it. Both return
   the em dash the product already uses everywhere else for "there is no
   number here" — never 0d, never 100 %, never a colour. */

/** A day count, or `—`. Mirrors `idx()`'s rule in shared/engine.js. */
export const dayCount = (v) => (noNumber(v) ? "—" : `${Math.round(Number(v))}d`);

/** The headline of a metric, in its own unit, or `—` when not measured. */
export function formatSignal(m) {
  if (!m || m.state !== "measured" || noNumber(m.value)) return "—";
  return m.unit === "percent" ? pct(m.value, 0) : dayCount(m.value);
}

/** The movement since the previous period, or `—` when there is no trend. */
export function formatTrend(m) {
  const t = m?.trend;
  if (!t || t.state !== "measured" || noNumber(t.delta)) return "—";
  const arrow = t.direction === "up" ? "▲" : t.direction === "down" ? "▼" : "=";
  const size = m.unit === "percent" ? pct(Math.abs(t.delta), 0) : dayCount(Math.abs(t.delta));
  return t.direction === "flat" ? `= 0` : `${arrow} ${size}`;
}

export default govSignals;

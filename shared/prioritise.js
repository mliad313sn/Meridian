/**
 * REQ-24 (RT365 V-5) — WHAT WE CHOOSE NOT TO DO.
 *
 * « Choosing what not to do is where a portfolio creates most of its
 * value. Meridian ranks nothing today; demand carries no score. »
 *
 * This module scores every candidate for the group's people — the live
 * projects and the requests still in the funnel — on four inputs, orders
 * them under a weighting the group itself states, and draws the line
 * where the capacity runs out.
 *
 * ── The rule this file was written under (REQ-33, 5.13.0) ────────────
 *
 * The product once reported ON TRACK 100 %, SPI 1.00, COST INDEX 1.00
 * for a book with no budget. The fix was a fourth RAG state, `N` / "Not
 * measured", and formatters that return `—` rather than invent `0.00`.
 *
 * **A ranking is the most dangerous place in this product for that
 * mistake**, because a rank is an ordinal: `#1` looks confident whether
 * or not anything is behind it. So the central decision of this file,
 * made first and not last:
 *
 *   A ROW IS RANKED ONLY WHEN ALL FOUR OF ITS INPUTS ARE RECORDED.
 *   A row missing any of them is NOT PLACED. It is not scored zero, it
 *   is not scored full, and it does not sort last "for now" — it is not
 *   in the ordering at all. It is listed separately, it names exactly
 *   which inputs are missing, and it says where each of them is filled
 *   in. A project with no business case has no claimed value; it does
 *   not have a value of zero, and it must not sort as though it were
 *   the worst thing in the portfolio nor as though it were the best.
 *
 * The same rule, one level down, on every input:
 *
 *   · a project with NO RAID ROW AT ALL has no exposure — nobody has
 *     looked. A project whose register has rows and none of them open
 *     has an exposure of zero, and that IS a measurement;
 *   · a project with NO ALLOCATION has no known capacity consumption —
 *     nobody has said who does the work. Allocations that all fall
 *     outside the horizon give a genuine zero for that horizon;
 *   · confidence is never inferred. Either a human recorded 1–5 against
 *     the claimed value, or it is absent and the row says so;
 *   · with NO PEOPLE in the book there is no capacity, so there is no
 *     line — the ranking is still drawn and it says the line is missing,
 *     rather than marking every row "below" a limit of zero.
 *
 * ── The weighting is stated, not assumed ─────────────────────────────
 *
 * A weighting nobody can see is a supplier's opinion presented as
 * arithmetic. The four weights travel with the answer, every row carries
 * its own decomposition (raw input → points → weight share →
 * contribution), and `weighting.reviewed` says whether a human of this
 * group has ever looked at them or whether they are still the numbers
 * this software shipped with.
 *
 * ── Points are relative to the set ───────────────────────────────────
 *
 * Money, a 1–5 note, a 1–25 exposure and an FTE cannot be added. Each
 * input is put on the same 0–1 scale against the largest value in the
 * set being ranked, then weighted. That is stated on the screen, because
 * it means a row's POINTS change when the set changes, while the order
 * of any two rows against each other does not.
 *
 * ── Pure, and shared ─────────────────────────────────────────────────
 *
 * Same idiom as `shared/govsignals.js`: no database, no DOM. The server
 * calls it on the rows it just read, the browser can call it on the book
 * it already holds, and the test calls it on a fixture. Arithmetic that
 * belongs to the engine is imported from the engine — `Engine.exposure`
 * and `Engine.effectiveFte` — because two definitions of exposure is how
 * a portfolio starts disagreeing with itself. `shared/engine.js` is
 * behaviour-frozen and is not touched.
 *
 * ── Labels are KEYS, not English ─────────────────────────────────────
 *
 * Every `label` and every `why` below is an English literal meant to be
 * passed through `t()` at the call site. The i18n gate cannot see them —
 * they arrive through a variable rather than a literal `t("…")` — so
 * every one of them has been added to FR and ES by hand.
 */

import { Engine, D, iso, clamp } from "./engine.js";

/* The engine's own rule for "there is no number here", restated because
   engine.js does not export it and must not be edited to make it do so. */
const noNumber = (v) => v === null || v === undefined || !Number.isFinite(Number(v));

/* ── the sentences this module can say ──────────────────────────────
   Collected in one table so the person wiring the screen knows exactly
   which keys to add to FR/ES, and so no sentence is written twice in two
   slightly different ways. */
export const PRIORITY_TEXT = {
  block:        "Value and risk against capacity",
  notPlaced:    "Not placed",

  value:        "Claimed value",
  confidence:   "Confidence",
  exposure:     "RAID exposure",
  capacity:     "Capacity consumed",

  /* where each input is recorded — shown beside the number, so a reader
     who disagrees with it knows where to go and change it */
  valueFromCase:      "From the business case — expected benefit a year",
  valueFromDemand:    "From the request — the benefit its sponsor claims",
  confidenceFromCase: "From the business case — how far the payer trusts that figure",
  confidenceFromDemand: "From the request — how far the sponsor trusts that figure",
  exposureFromRaid:   "The worst open RAID item, probability × impact",
  exposureFromDemand: "From the request — the worst thing its sponsor expects",
  capacityFromAlloc:  "From the allocations, averaged over the horizon",
  capacityFromDemand: "From the request — the people its sponsor expects to need",

  /* why an input has no value. Each names what to do about it. */
  noCase:        "No business case — this project has never said what it is worth",
  noCaseBenefit: "The business case states no expected benefit",
  noDemandBenefit: "The request states no expected benefit — a benefit in words is not a number",
  noConfidence:  "Nobody has recorded how far this figure is trusted",
  noRaidRegister: "No RAID item has ever been logged here — the exposure is not known, and it is not zero",
  noDemandRaid:  "The request records no probability and impact for the worst thing it expects",
  noAllocation:  "Nobody is allocated to this project — what it consumes is not known, and it is not zero",
  noDemandFte:   "The request does not estimate the people it will take",

  /* the state of a row */
  rankedOn:      "Ranked on all four inputs",
  missingInputs: "Missing an input — not placed in the order, and not placed last either",

  /* the weighting */
  weighting:      "Weighting",
  weightsShipped: "These are the weights this software shipped with — nobody in this group has reviewed them",
  weightsSet:     "Set by",
  weightsZero:    "Every weight is zero — nothing is being weighed, so nothing is ranked",

  /* the line */
  line:            "Where capacity runs out",
  lineCapacity:    "Capacity runs out here",
  lineMoney:       "The capital envelope runs out here",
  noPeople:        "No person in this book carries availability — there is no capacity to rank against, so no line is drawn",
  noCapacityLeft:  "Work that is not in this ranking already consumes the whole pool — nothing here is above the line",
  noEnvelope:      "No capital envelope has been agreed — no money line is drawn",
  costUnknown:     "Some ranked rows carry no cost, so a money line would understate the demand — none is drawn",
  everythingFits:  "Everything ranked fits inside the capacity",
};

/** The four inputs, in the order the page draws them. */
export const INPUTS = ["value", "confidence", "exposure", "capacity"];

/** Which way each input pulls: `up` is better high, `down` is better low. */
export const DIRECTION = { value: "up", confidence: "up", exposure: "down", capacity: "down" };

/** The weights this software ships with, until a group states its own. */
export const DEFAULT_WEIGHTS = { value: 40, confidence: 20, exposure: 20, capacity: 20 };

/** How far ahead capacity is counted, in days, unless a caller says. */
export const DEFAULT_HORIZON = 180;

/* ── small helpers ─────────────────────────────────────────────────── */

const round1 = (v) => (noNumber(v) ? null : Math.round(Number(v) * 10) / 10);
const round3 = (v) => (noNumber(v) ? null : Math.round(Number(v) * 1000) / 1000);
const dayOf = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const d = D(v);
  return Number.isFinite(d.getTime()) ? iso(d) : null;
};

/** An input that has a number, with the raw value and where it came from. */
const has = (raw, source, note = null) =>
  ({ state: "measured", raw, why: null, source, note, points: null, contribution: null });

/** An input that has none, and the sentence that says what to do. */
const lacks = (why, source) =>
  ({ state: "N", raw: null, why, source, note: null, points: null, contribution: null });

/* ═══════════════════════════════════════════════════════════════════
   THE FOUR INPUTS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * CLAIMED VALUE — what somebody says this is worth, a year, in millions.
 *
 * For a project that is the business case's `expectedBenefit` (028/042);
 * for a request it is the number its sponsor put on it. A request whose
 * benefit is only prose has NO claimed value — `benefitNote` is words,
 * and turning words into a number here would be the fabrication this
 * file exists to refuse.
 */
function valueInput(row, caseOf) {
  if (row.kind === "demand") {
    return noNumber(row.expectedBenefit)
      ? lacks(PRIORITY_TEXT.noDemandBenefit, PRIORITY_TEXT.valueFromDemand)
      : has(Number(row.expectedBenefit), PRIORITY_TEXT.valueFromDemand);
  }
  const bc = caseOf(row.id);
  if (!bc) return lacks(PRIORITY_TEXT.noCase, PRIORITY_TEXT.valueFromCase);
  return noNumber(bc.expectedBenefit)
    ? lacks(PRIORITY_TEXT.noCaseBenefit, PRIORITY_TEXT.valueFromCase)
    : has(Number(bc.expectedBenefit), PRIORITY_TEXT.valueFromCase);
}

/**
 * CONFIDENCE — 1 to 5, recorded by a human against that claimed value.
 *
 * Never inferred, never defaulted. A claimed value nobody will stand
 * behind and a claimed value the sponsor is certain of are not the same
 * proposition, and the difference is not something arithmetic can find.
 */
function confidenceInput(row, caseOf) {
  const src = row.kind === "demand"
    ? PRIORITY_TEXT.confidenceFromDemand : PRIORITY_TEXT.confidenceFromCase;
  const raw = row.kind === "demand"
    ? row.valueConfidence
    : caseOf(row.id)?.valueConfidence;
  if (noNumber(raw)) return lacks(PRIORITY_TEXT.noConfidence, src);
  return has(clamp(Math.round(Number(raw)), 1, 5), src);
}

/**
 * RAID EXPOSURE — the worst open item, probability × impact.
 *
 * `Engine.exposure` is the one definition of that product, imported
 * rather than restated. The WORST item and not the sum, for two reasons:
 * a sum punishes the project that keeps its register honestly, and a
 * request can only ever state one worst case, so the two would not be
 * comparable on the same list.
 *
 * The absence rule is the sharp one. A project whose register is EMPTY
 * of rows has never been looked at, and that is not an exposure of zero.
 * A project whose register has rows, all of them closed, genuinely
 * carries no open exposure today — that is a measurement, and it reads
 * as a zero with the count beside it.
 */
function exposureInput(row, raidOf) {
  if (row.kind === "demand") {
    if (noNumber(row.raidProbability) || noNumber(row.raidImpact)) {
      return lacks(PRIORITY_TEXT.noDemandRaid, PRIORITY_TEXT.exposureFromDemand);
    }
    return has(Engine.exposure({ p: Number(row.raidProbability), i: Number(row.raidImpact) }),
      PRIORITY_TEXT.exposureFromDemand);
  }
  const items = raidOf(row.id);
  if (!items.length) return lacks(PRIORITY_TEXT.noRaidRegister, PRIORITY_TEXT.exposureFromRaid);
  const open = items.filter((x) => x.status === "Open");
  const worst = open.reduce((m, x) => Math.max(m, Engine.exposure(x)), 0);
  return { ...has(worst, PRIORITY_TEXT.exposureFromRaid), open: open.length, items: items.length };
}

/**
 * CAPACITY CONSUMED — mean full-time equivalents over the horizon.
 *
 * An allocation is a percentage of one person across a date range
 * (`allocation`, migration 001), so a person at 100 % for half the
 * horizon consumes half an FTE of it. That is the same unit the pool
 * below is expressed in, which is the only reason the two can be
 * compared at all.
 *
 * A live project with NO allocation row has no known consumption. That
 * is the honest reading — nobody has said who does the work — and it is
 * also the useful one: it is the sentence that makes somebody go and
 * allocate the people.
 */
function capacityInput(row, fteOf) {
  if (row.kind === "demand") {
    return noNumber(row.estFte)
      ? lacks(PRIORITY_TEXT.noDemandFte, PRIORITY_TEXT.capacityFromDemand)
      : has(Math.max(0, Number(row.estFte)), PRIORITY_TEXT.capacityFromDemand);
  }
  const f = fteOf(row.id);
  if (f === null) return lacks(PRIORITY_TEXT.noAllocation, PRIORITY_TEXT.capacityFromAlloc);
  return { ...has(round3(f.fte), PRIORITY_TEXT.capacityFromAlloc), allocations: f.n };
}

/* ── capacity arithmetic ───────────────────────────────────────────── */

/**
 * The mean FTE an allocation consumes across [from, to).
 * An allocation that overlaps half the horizon at 50 % is 0.25 FTE.
 */
function allocationFte(a, from, to, span) {
  const s = dayOf(a.from), e = dayOf(a.to);
  if (!s || !e) return 0;
  const lo = s > from ? s : from;
  const hi = e < to ? e : to;
  if (hi < lo) return 0;
  const overlap = (D(hi) - D(lo)) / 86400000 + 1;
  return (Number(a.pct ?? 0) / 100) * (Math.min(overlap, span) / span);
}

/* ═══════════════════════════════════════════════════════════════════
   THE RANKING
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @param book {
 *   asAt         status date, YYYY-MM-DD
 *   horizonDays  how far ahead capacity is counted (default 180)
 *   weighting    { value, confidence, exposure, capacity, note, setBy, setOn, version }
 *   ceiling      settings.capacityCeiling — the allocation % the group calls full
 *   envelope     settings.capexEnvelope, in millions; 0 means none agreed
 *   programmes   [{ id, name }]
 *   people       [{ id, availability }]                       — serialiser shape
 *   projects     [{ id, name, programme, site, closed, budget }]
 *   cases        [{ project, expectedBenefit, valueConfidence }]
 *   raid         [{ project, p, i, status }]
 *   allocations  [{ project, from, to, pct }]
 *   demand       [{ id, title, programme, site, status, estCost,
 *                   expectedBenefit, valueConfidence, estFte,
 *                   raidProbability, raidImpact }]
 * }
 */
export function prioritise(book = {}) {
  const asAt = dayOf(book.asAt) ?? iso(new Date());
  const horizonDays = Number.isFinite(book.horizonDays) && book.horizonDays > 0
    ? Math.floor(book.horizonDays) : DEFAULT_HORIZON;
  const from = asAt;
  const to = iso(new Date(D(asAt).getTime() + (horizonDays - 1) * 86400000));

  /* ── the weighting, and whether anyone ever chose it ─────────────── */
  const w = { ...DEFAULT_WEIGHTS };
  for (const k of INPUTS) {
    const v = book.weighting?.[k];
    if (!noNumber(v)) w[k] = Math.max(0, Math.round(Number(v)));
  }
  const wsum = INPUTS.reduce((a, k) => a + w[k], 0);
  const shares = {};
  for (const k of INPUTS) shares[k] = wsum > 0 ? w[k] / wsum : null;
  const weighting = {
    ...w, sum: wsum, shares,
    state: wsum > 0 ? "measured" : "N",
    why: wsum > 0 ? null : PRIORITY_TEXT.weightsZero,
    /* A weighting nobody has looked at is not the group's weighting. It
       is still applied — there has to be an order — but the screen says
       whose opinion it is. */
    reviewed: !!book.weighting?.setOn,
    setBy: book.weighting?.setBy ?? "",
    setOn: book.weighting?.setOn ?? null,
    note: book.weighting?.note ?? "",
    version: book.weighting?.version ?? null,
  };

  /* ── the lookups each input needs ───────────────────────────────── */
  const caseByProject = new Map((book.cases ?? []).map((c) => [c.project, c]));
  const caseOf = (id) => caseByProject.get(id) ?? null;

  const raidByProject = new Map();
  for (const x of book.raid ?? []) {
    if (!x.project) continue;               // portfolio-wide RAID is nobody's row
    if (!raidByProject.has(x.project)) raidByProject.set(x.project, []);
    raidByProject.get(x.project).push(x);
  }
  const raidOf = (id) => raidByProject.get(id) ?? [];

  const allocByProject = new Map();
  for (const a of book.allocations ?? []) {
    if (!a.project) continue;
    if (!allocByProject.has(a.project)) allocByProject.set(a.project, { n: 0, fte: 0 });
    const acc = allocByProject.get(a.project);
    acc.n += 1;
    acc.fte += allocationFte(a, from, to, horizonDays);
  }
  const fteOf = (id) => allocByProject.get(id) ?? null;

  /* ── the candidates ─────────────────────────────────────────────────
     Everything competing for the group's people: the live projects, and
     the requests still in the funnel. A CONVERTED request is not here —
     it is already present as the project it became, and counting both
     would double the demand. A DECLINED one is not here either: it has
     been chosen against, which is the answer this screen exists to
     produce. */
  const liveProjects = (book.projects ?? []).filter((p) => !p.closed);
  const openDemand = (book.demand ?? [])
    .filter((d) => ["New", "Triaged", "Approved"].includes(d.status));

  const rows = [
    ...liveProjects.map((p) => ({
      kind: "project", id: p.id, name: p.name,
      programme: p.programme ?? null, site: p.site ?? null,
      status: p.phase ?? "", cost: noNumber(p.budget) ? null : Number(p.budget),
    })),
    ...openDemand.map((d) => ({
      kind: "demand", id: d.id, name: d.title,
      programme: d.programme ?? null, site: d.site ?? null,
      status: d.status, cost: noNumber(d.estCost) ? null : Number(d.estCost),
      expectedBenefit: d.expectedBenefit, valueConfidence: d.valueConfidence,
      estFte: d.estFte, raidProbability: d.raidProbability, raidImpact: d.raidImpact,
    })),
  ];

  /* ── the four inputs on every candidate ─────────────────────────── */
  for (const r of rows) {
    r.inputs = {
      value: valueInput(r, caseOf),
      confidence: confidenceInput(r, caseOf),
      exposure: exposureInput(r, raidOf),
      capacity: capacityInput(r, fteOf),
    };
    r.missing = INPUTS.filter((k) => r.inputs[k].state !== "measured");
    /* The decision this file was written for: complete, or not placed.
       A row with three inputs out of four is not 75 % of a rank. */
    r.ranked = r.missing.length === 0 && weighting.state === "measured";
    r.state = r.ranked ? "ranked" : "N";
    r.why = r.ranked ? null
      : (weighting.state !== "measured" ? weighting.why : PRIORITY_TEXT.missingInputs);
    r.score = null; r.rank = null; r.funded = null;
    r.cumulativeFte = null; r.cumulativeCost = null;
    r.fte = r.inputs.capacity.state === "measured" ? Number(r.inputs.capacity.raw) : null;
  }

  const ranked = rows.filter((r) => r.ranked);
  const notPlaced = rows.filter((r) => !r.ranked);

  /* ── points, relative to the set being ranked ───────────────────── */
  const maxOf = (k) => ranked.reduce((m, r) => Math.max(m, Number(r.inputs[k].raw)), 0);
  const tops = { value: maxOf("value"), exposure: maxOf("exposure"), capacity: maxOf("capacity") };

  for (const r of ranked) {
    const raw = (k) => Number(r.inputs[k].raw);
    /* Higher is better: a share of the largest claim in the set. When
       NOBODY claims anything, every row scores nothing on value — which
       is true, and is not the same as everybody scoring full marks. */
    const points = {
      value: tops.value > 0 ? raw("value") / tops.value : 0,
      /* An absolute scale, not a relative one: 1 to 5 already means
         something on its own, and normalising it against the set would
         make the most-trusted row in a room of doubters look certain. */
      confidence: (raw("confidence") - 1) / 4,
      /* Lower is better, so the points are what is LEFT after the
         penalty. When nothing carries any exposure the penalty is
         nothing, and every row keeps its full points — that is a real
         reading of a set in which nobody is exposed. */
      exposure: tops.exposure > 0 ? 1 - raw("exposure") / tops.exposure : 1,
      capacity: tops.capacity > 0 ? 1 - raw("capacity") / tops.capacity : 1,
    };
    let score = 0;
    for (const k of INPUTS) {
      const p = clamp(points[k], 0, 1);
      r.inputs[k].points = Math.round(p * 1000) / 10;          // 0–100
      r.inputs[k].contribution = round1(shares[k] * p * 100);
      score += shares[k] * p * 100;
    }
    r.score = round1(score);
  }

  /* Deterministic to the last row: score, then the larger claim, then the
     identifier — so two runs on the same book give the same order and a
     re-rank after a weight change is a real movement, not a shuffle. */
  ranked.sort((a, b) =>
    (b.score - a.score) ||
    (Number(b.inputs.value.raw) - Number(a.inputs.value.raw)) ||
    String(a.id).localeCompare(String(b.id)));
  ranked.forEach((r, i) => { r.rank = i + 1; });

  notPlaced.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  /* ── the capacity pool ──────────────────────────────────────────────
     What the group HAS, in the same FTE unit the rows consume:
     everybody's availability after rotation (`Engine.effectiveFte`,
     V-09), up to the allocation ceiling the group itself set in
     settings. No people, no pool — and then no line, rather than a line
     at zero that marks the whole portfolio "below". */
  const people = book.people ?? [];
  const ceiling = noNumber(book.ceiling) ? 100 : Number(book.ceiling);
  const pool = people.reduce((a, p) => a + Engine.effectiveFte(p) * (ceiling / 100), 0);

  /* Capacity already spoken for by work that is NOT in this ranking:
     the projects that could not be placed, and anything closed that
     still carries allocations inside the horizon. Those people are busy
     whether or not their project has been scored, and a line drawn over
     the whole pool would promise capacity that does not exist. */
  const rankedIds = new Set(ranked.map((r) => r.id));
  let held = 0;
  for (const [projectId, acc] of allocByProject) {
    if (!rankedIds.has(projectId)) held += acc.fte;
  }
  held = round3(held);
  const available = round3(Math.max(0, pool - held));

  const capacity = {
    state: people.length ? "measured" : "N",
    why: people.length ? null : PRIORITY_TEXT.noPeople,
    horizonDays, from, to, ceiling,
    people: people.length,
    pool: round3(pool), held, available,
    /* Not a fabrication and not a zero: the pool is real, and it is
       already fully consumed by work outside this ranking. */
    exhausted: people.length > 0 && available <= 0,
  };

  /* ── the money line ─────────────────────────────────────────────────
     Second, and never allowed to guess. A running total that skips the
     rows with no cost would understate the demand and put the line in
     the wrong place, so a hole in the costs means no money line at
     all — stated, not silently ignored. */
  const envelope = noNumber(book.envelope) ? 0 : Number(book.envelope);
  const costHoles = ranked.filter((r) => r.cost === null).length;
  const money = {
    state: envelope > 0 && !costHoles ? "measured" : "N",
    why: envelope > 0 ? (costHoles ? PRIORITY_TEXT.costUnknown : null) : PRIORITY_TEXT.noEnvelope,
    envelope: envelope || null, costUnknown: costHoles,
  };

  /* ── the cut ────────────────────────────────────────────────────────
     Walk the order, accumulating both. A row is above the line while
     BOTH the people and the money still reach it; the first one to run
     out is what binds, and the row says which. */
  let runFte = 0, runCost = 0;
  let lastAbove = 0, boundBy = null;
  for (const r of ranked) {
    runFte = round3(runFte + (r.fte ?? 0));
    if (r.cost !== null) runCost = Math.round((runCost + r.cost) * 1e6) / 1e6;
    r.cumulativeFte = runFte;
    r.cumulativeCost = money.state === "measured" ? runCost : null;

    const overPeople = capacity.state === "measured" && runFte > available;
    const overMoney = money.state === "measured" && runCost > envelope;
    if (capacity.state !== "measured" && money.state !== "measured") {
      r.funded = null;                 // there is no line to be above or below
      r.boundBy = null;
    } else {
      r.funded = !overPeople && !overMoney;
      r.boundBy = overPeople ? "capacity" : overMoney ? "money" : null;
      if (r.funded) lastAbove = r.rank;
      else if (!boundBy) boundBy = r.boundBy;
    }
  }

  const hasLine = capacity.state === "measured" || money.state === "measured";
  const cut = {
    state: hasLine ? "measured" : "N",
    why: hasLine
      ? (capacity.exhausted ? PRIORITY_TEXT.noCapacityLeft
        : boundBy ? (boundBy === "capacity" ? PRIORITY_TEXT.lineCapacity : PRIORITY_TEXT.lineMoney)
        : PRIORITY_TEXT.everythingFits)
      : PRIORITY_TEXT.noPeople,
    /* The rank of the LAST row above the line. Zero means the line falls
       before the first row; null means there is no line. */
    lastAbove: hasLine ? lastAbove : null,
    boundBy,
    above: hasLine ? ranked.filter((r) => r.funded).length : null,
    below: hasLine ? ranked.filter((r) => r.funded === false).length : null,
    demandedFte: runFte,
    demandedCost: money.state === "measured" ? runCost : null,
  };

  /* ── per programme ──────────────────────────────────────────────────
     RT365 asked for a ranked list per programme. It is the SAME order,
     filtered — not a second ranking with its own line. People are shared
     across programmes: a per-programme pool would be a number nobody in
     this book has agreed, and inventing one is how a supplier's opinion
     gets presented as arithmetic. So each programme reads its own rows,
     each carrying the group rank and the group line it sits under. */
  const programmes = (book.programmes ?? []).map((pr) => ({
    scope: "programme", id: pr.id, name: pr.name ?? pr.id,
    ranked: ranked.filter((r) => r.programme === pr.id),
    notPlaced: notPlaced.filter((r) => r.programme === pr.id),
  }));
  const unassigned = {
    scope: "unassigned", id: null, name: null,
    ranked: ranked.filter((r) => !r.programme),
    notPlaced: notPlaced.filter((r) => !r.programme),
  };

  return {
    asAt, horizonDays, order: INPUTS, direction: DIRECTION,
    weighting, capacity, money, cut,
    ranked, notPlaced, programmes, unassigned,
    counts: {
      candidates: rows.length,
      ranked: ranked.length,
      notPlaced: notPlaced.length,
      projects: liveProjects.length,
      demand: openDemand.length,
    },
  };
}

/* ── formatting ────────────────────────────────────────────────────────
   The same em dash the rest of the product uses for "there is no number
   here" — never a 0, never a 100 %, never a colour. */

/** A score out of 100, or `—` when the row is not placed. */
export const formatScore = (r) =>
  (!r || r.state !== "ranked" || noNumber(r.score) ? "—" : Number(r.score).toFixed(1));

/** Full-time equivalents, or `—`. */
export const formatFte = (v) => (noNumber(v) ? "—" : Number(v).toFixed(2) + " FTE");

/** An input's raw number in its own unit, or `—` with the reason beside it. */
export function formatInput(key, input, money) {
  if (!input || input.state !== "measured" || noNumber(input.raw)) return "—";
  if (key === "value") return money ? money(Number(input.raw)) : String(input.raw);
  if (key === "confidence") return Number(input.raw) + "/5";
  if (key === "capacity") return formatFte(input.raw);
  return String(Math.round(Number(input.raw)));
}

/** A weight as its share of the whole, or `—` when nothing is weighed. */
export const formatShare = (w) => (noNumber(w) ? "—" : Math.round(Number(w) * 100) + "%");

export default prioritise;

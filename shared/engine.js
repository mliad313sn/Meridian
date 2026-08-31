/**
 * ENGINE — earned value, critical path, gates, RAID, capacity.
 *
 * Lifted from the v4 single-file build with its behaviour frozen (D-05 /
 * R3). Two changes only, both structural rather than behavioural:
 *
 *   · it is a module, so the server and the browser run the same code and
 *     the tests can reach it without a DOM;
 *   · `decisions()` returns a route string instead of a click handler,
 *     because the server has nowhere to navigate to.
 *
 * Everything else — including the "too early to measure" guard, the
 * five-day dependency tolerance and the worse-of-aggregate-and-spread
 * roll-up — is the original arithmetic.
 */

/* ── dates ────────────────────────────────────────────────────────── */
export const DAY = 86400000;
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function D(v) {
  return v instanceof Date ? new Date(v.getTime())
    : new Date(v + (String(v).length === 10 ? "T00:00:00Z" : ""));
}
export const iso = (d) => D(d).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(D(d).getTime() + n * DAY);
export function addMonths(d, n) { const x = D(d); x.setUTCMonth(x.getUTCMonth() + n); return x; }
export const days = (a, b) => Math.round((D(b) - D(a)) / DAY);
export const monthKey = (v) => iso(v).slice(0, 7);
export function startOfWeek(v) { const d = D(v); const wd = (d.getUTCDay() + 6) % 7; return addDays(d, -wd); }
export function isoWeek(v) {
  const d = D(v);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / DAY + 1) / 7);
}
export function workdays(a, b) {
  let n = 0; const end = D(b);
  for (let d = D(a); d < end; d = addDays(d, 1)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
export function fmtDate(v) {
  if (!v) return "—";
  const d = D(v);
  return String(d.getUTCDate()).padStart(2, "0") + " " + MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2);
}
export function fmtDateLong(v) { const d = D(v); return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
export function fmtMon(v) { const d = D(v); return MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2); }

/* ── numbers & money ──────────────────────────────────────────────── */
export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
export const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
export const uniq = (arr) => [...new Set(arr)];
export const by = (k) => (a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0);

export function money(v, dp) {
  const d = dp === undefined ? (Math.abs(v) >= 10 ? 1 : 2) : dp;
  return "$" + v.toFixed(d) + "M";
}
export function signedMoney(v) {
  const sign = v >= 0 ? "+" : "−";
  const abs = Math.abs(v);
  if (abs < 0.005) return "$0";
  return sign + (abs < 1 ? "$" + Math.round(abs * 1000) + "K" : "$" + abs.toFixed(2) + "M");
}
export function cash(v) {
  const abs = Math.abs(v);
  const str = abs < 1 ? "$" + Math.round(abs * 1000) + "K" : "$" + abs.toFixed(2).replace(/0$/, "") + "M";
  return (v < 0 ? "−" : "") + str;
}
export const pct = (v, dp = 0) => (v * 100).toFixed(dp) + "%";
export const idx = (v) => v.toFixed(2);

/* ── reference data ───────────────────────────────────────────────── */
export const GATES = [
  { n: 1, name: "Gate 1 — Mandate",          at: .08, owner: "Sponsor",             evidence: "Charter, business case, benefits map" },
  { n: 2, name: "Gate 2 — Design authority", at: .27, owner: "Architecture board",  evidence: "Architecture dossier, DPIA, cost baseline" },
  { n: 3, name: "Gate 3 — Readiness",        at: .58, owner: "Steering committee",  evidence: "Test evidence, cutover runbook, operations acceptance" },
  { n: 4, name: "Gate 4 — Benefits",         at: .88, owner: "PMO",                 evidence: "Realisation report, lessons learned" },
];
export const PHASES = ["Initiation", "Design", "Execution", "Transition", "Closure", "Closed"];
export const RAID_TYPES = ["Risk", "Issue", "Assumption", "Dependency"];
export const RESPONSES = ["Mitigate", "Avoid", "Transfer", "Accept", "Monitor", "Fix"];
/* PM-02 — où l'on ira CHERCHER un enseignement plus tard. Les onze
   domaines d'ISO 21502 §7, parce que c'est le vocabulaire dans lequel la
   question se posera : « qu'a-t-on appris sur les achats ? ». */
export const LESSON_CATEGORIES = ["Scope", "Schedule", "Cost", "Risk", "Quality",
  "Resources", "Stakeholders", "Procurement", "Governance", "Technical", "Transition"];
export const DOC_TYPES = ["Charter","Business case","Design","Assurance","Quality","Operations","Compliance","Closure","Finance"];
export const RAG_LABEL = { G: "Green", A: "Amber", R: "Red" };

/* ═══════════════════════════════════════════════════════════════════
   The engine proper. `db` is the in-memory portfolio the API serves:
   the same field names the v4 build used.
   ═══════════════════════════════════════════════════════════════════ */

export const Engine = {

  /* ── lookups ────────────────────────────────────────────────────── */
  person: (db, id) => db.people.find(p => p.id === id) || null,
  personName: (db, id) => (db.people.find(p => p.id === id) || {}).name || "—",
  project: (db, id) => db.projects.find(p => p.id === id) || null,
  site: (db, id) => db.sites.find(s => s.id === id) || null,
  programme: (db, id) => db.programmes.find(p => p.id === id) || null,
  activities: (db, id) => db.activities.filter(a => a.project === id).sort(by("start")),
  milestones: (db, id) => db.milestones.filter(m => m.project === id).sort(by("date")),

  /* ── earned value ───────────────────────────────────────────────── */
  metrics(db, projectId) {
    const p = Engine.project(db, projectId);
    if (!p) return null;
    const today = db.statusDate;
    const acts = Engine.activities(db, projectId);
    const bac = p.budget;

    let pv = 0, ev = 0;
    acts.forEach(a => {
      const plannedSpan = Math.max(1, days(a.baseStart, a.baseEnd));
      const plannedPct = clamp(days(a.baseStart, today) / plannedSpan, 0, 1);
      pv += a.weight * plannedPct * bac;
      ev += a.weight * (a.pct / 100) * bac;
    });
    const ac = sum(db.ledger.filter(l => l.project === projectId), l => l.amount);

    /* Below a couple of per cent elapsed the indices are arithmetic noise.
       Real PMOs don't report an index that early, so neither does this. */
    const measurable = pv >= bac * 0.02 && ac >= bac * 0.005;
    const spi = !measurable ? 1 : pv > 0.0001 ? ev / pv : 1;
    const cpi = !measurable ? 1 : ac > 0.0001 ? ev / ac : 1;
    const sv = ev - pv, cv = ev - ac;
    const eac = cpi > 0.01 ? bac / cpi : bac;
    const vac = bac - eac;
    const tcpi = (bac - ac) > 0.0001 ? (bac - ev) / (bac - ac) : 1;
    const pctComplete = bac > 0 ? clamp(ev / bac, 0, 1) : 0;
    const plannedComplete = bac > 0 ? clamp(pv / bac, 0, 1) : 0;

    const totalSpan = days(p.start, p.finish);
    const elapsed = clamp(days(p.start, today), 0, totalSpan);
    const remaining = Math.max(0, totalSpan - elapsed);
    const forecastFinish = iso(addDays(today, spi > 0.05 ? Math.round(remaining / spi) : remaining));
    const slipDays = days(p.finish, forecastFinish);

    const health = Engine.health(db, p, { spi, cpi, measurable });
    return {
      project: p, bac, pv, ev, ac, spi, cpi, sv, cv, eac, vac, tcpi, measurable,
      pctComplete, plannedComplete, forecastFinish, slipDays, health,
      contingencyLeft: p.contingency - p.contingencyUsed,
      contingencyPct: p.contingency > 0 ? p.contingencyUsed / p.contingency : 0,
    };
  },

  health(db, p, m) {
    if (p.healthOverride) return { rag: p.healthOverride, derived: false, why: p.healthOverrideWhy || "Set by the project manager" };
    const st = db.settings;
    if (!st.autoRag) return { rag: "G", derived: false, why: "Automatic status is off — PM judgement applies" };
    if (m.measurable === false) return { rag: "G", derived: true, why: "Too early to measure — less than 2% of the plan has been spent" };
    const s = m.spi, c = m.cpi;
    if (s < st.redSpi || c < st.redCpi)
      return { rag: "R", derived: true, why: "SPI " + idx(s) + " / CPI " + idx(c) + " — below the red threshold of " + idx(st.redSpi) };
    if (s < st.amberSpi || c < st.amberCpi)
      return { rag: "A", derived: true, why: "SPI " + idx(s) + " / CPI " + idx(c) + " — below the amber threshold of " + idx(st.amberSpi) };
    return { rag: "G", derived: true, why: "SPI " + idx(s) + " and CPI " + idx(c) + " both inside tolerance" };
  },

  roll(db, projects) {
    const ms = projects.map(p => Engine.metrics(db, p.id)).filter(Boolean);
    const bac = sum(ms, m => m.bac), pv = sum(ms, m => m.pv), ev = sum(ms, m => m.ev), ac = sum(ms, m => m.ac);
    const live = ms.filter(m => m.measurable);
    const lpv = sum(live, m => m.pv), lev = sum(live, m => m.ev), lac = sum(live, m => m.ac);
    const spi = lpv > 0.0001 ? lev / lpv : 1, cpi = lac > 0.0001 ? lev / lac : 1;
    const eac = sum(ms, m => m.eac);
    return {
      count: ms.length, bac, pv, ev, ac, spi, cpi, eac, vac: bac - eac, cv: ev - ac, sv: ev - pv,
      measured: live.length,
      green: ms.filter(m => m.health.rag === "G").length,
      amber: ms.filter(m => m.health.rag === "A").length,
      red: ms.filter(m => m.health.rag === "R").length,
      metrics: ms,
    };
  },

  /* ── critical path ──────────────────────────────────────────────── */
  criticalPath(db, projectId) {
    const acts = Engine.activities(db, projectId);
    const byId = Object.fromEntries(acts.map(a => [a.id, a]));
    const es = {}, ef = {}, ls = {}, lf = {};
    const dur = a => Math.max(1, days(a.start, a.end));
    const origin = acts.length ? Math.min(...acts.map(a => D(a.start).getTime())) : 0;
    const toDay = t => Math.round((t - origin) / DAY);

    const order = Engine.topo(acts);
    order.forEach(a => {
      const preds = a.deps.map(d => byId[d]).filter(Boolean);
      es[a.id] = preds.length ? Math.max(...preds.map(p => ef[p.id])) : toDay(D(a.start).getTime());
      ef[a.id] = es[a.id] + dur(a);
    });
    const projEnd = acts.length ? Math.max(...acts.map(a => ef[a.id])) : 0;
    [...order].reverse().forEach(a => {
      const succs = acts.filter(x => x.deps.includes(a.id));
      lf[a.id] = succs.length ? Math.min(...succs.map(s => ls[s.id])) : projEnd;
      ls[a.id] = lf[a.id] - dur(a);
    });
    const float = {}; acts.forEach(a => { float[a.id] = ls[a.id] - es[a.id]; });
    return { critical: new Set(acts.filter(a => float[a.id] <= 0).map(a => a.id)), float, projEnd, es, ef, ls, lf };
  },

  topo(acts) {
    const byId = Object.fromEntries(acts.map(a => [a.id, a]));
    const seen = new Set(), out = [];
    const visit = (a) => {
      if (!a || seen.has(a.id)) return;
      seen.add(a.id);
      a.deps.forEach(d => visit(byId[d]));
      out.push(a);
    };
    acts.forEach(visit);
    return out;
  },

  /**
   * Stages routinely overlap by design — that is fast-tracking, not a
   * breach. What matters is an overlap deeper than the baseline agreed to.
   */
  depBreaches(db, projectId) {
    const acts = Engine.activities(db, projectId);
    const byId = Object.fromEntries(acts.map(a => [a.id, a]));
    const out = [];
    acts.forEach(a => a.deps.forEach(d => {
      const pre = byId[d];
      if (!pre) return;
      const now = days(pre.end, a.start);
      const agreed = (pre.baseEnd && a.baseStart) ? days(pre.baseEnd, a.baseStart) : 0;
      if (now < Math.min(0, agreed) - 5)
        out.push({ activity: a, predecessor: pre, overlap: -now, agreed: -Math.min(0, agreed) });
    }));
    return out;
  },

  /* ── gates ──────────────────────────────────────────────────────── */
  /* R-01 — evidence is an approved document THAT POINTS AT SOMETHING.
     An approved row with no artefact behind it is a label, and counting
     labels is how a gate clears on paperwork nobody can open. The
     arithmetic below is unchanged; only what counts as evidence is. */
  isEvidence(d) {
    return d?.status === "Approved" && !!d.uri;
  },
  gateStatus(db, projectId, gateN) {
    const docs = db.docs.filter(d => d.project === projectId && d.gate === gateN);
    const approved = docs.filter(d => Engine.isEvidence(d)).length;
    const ms = db.milestones.find(m => m.project === projectId && m.gate === gateN);
    const date = ms ? ms.date : null;
    const passed = date ? D(date) <= D(db.statusDate) : false;
    return {
      gate: gateN, date, docs, approved, total: docs.length,
      ready: docs.length > 0 && approved === docs.length,
      outstanding: docs.filter(d => !Engine.isEvidence(d)),
      state: passed && approved === docs.length ? "Cleared"
           : passed ? "Overdue"
           : date && days(db.statusDate, date) <= 45 ? (approved === docs.length ? "Ready" : "At risk")
           : "Planned",
    };
  },

  currentGate(db, projectId) {
    for (const g of GATES) {
      const st = Engine.gateStatus(db, projectId, g.n);
      if (st.state !== "Cleared") return { ...g, ...st };
    }
    return { ...GATES[3], ...Engine.gateStatus(db, projectId, 4) };
  },

  canAdvance(db, projectId) {
    if (!db.settings.gateLock) return { ok: true, reason: "Gate locking is off" };
    const g = Engine.currentGate(db, projectId);
    if (g.state === "Cleared" || g.ready) return { ok: true, reason: "Evidence complete for " + g.name };
    return {
      ok: false,
      reason: g.outstanding.length + " evidence item" + (g.outstanding.length === 1 ? "" : "s") + " outstanding for " + g.name,
      items: g.outstanding,
    };
  },

  /* ── RAID ───────────────────────────────────────────────────────── */
  exposure: (r) => r.p * r.i,
  exposureBand(r) {
    const e = Engine.exposure(r);
    return e >= 15 ? "Critical" : e >= 9 ? "High" : e >= 4 ? "Medium" : "Low";
  },
  escalation(db, r) {
    const st = db.settings, e = Engine.exposure(r);
    const age = days(r.opened, db.statusDate);
    if (r.status === "Closed") return { level: "Closed", why: "Closed" };
    if (e >= st.escalateExposure) return { level: "Steering", why: "Exposure " + e + " at or above " + st.escalateExposure };
    if (r.type === "Issue" && age > st.issueAgeDays) return { level: "PMO", why: "Issue open " + age + " days" };
    if (e >= st.pmoExposure) return { level: "PMO", why: "Exposure " + e + " at or above " + st.pmoExposure };
    return { level: "Project", why: "Inside project tolerance" };
  },
  openRaid: (db, projectId) => db.raid.filter(r => r.status === "Open" && (!projectId || r.project === projectId)),

  /* ── change control ─────────────────────────────────────────────── */
  route(db, cr) {
    const st = db.settings;
    if (!st.ccb) return { authority: "Project manager", why: "Change control board is off" };
    const big = Math.abs(cr.cost) >= st.ccbThreshold || Math.abs(cr.weeks) >= st.ccbWeeks;
    return big
      ? { authority: "Steering committee", why: cash(cr.cost) + " / " + cr.weeks + " wk exceeds the " + cash(st.ccbThreshold) + " or " + st.ccbWeeks + "-week threshold" }
      : { authority: "Change authority", why: "Below the steering committee threshold" };
  },
  crStage: (cr) => cr.steps.findIndex(s => s.state === "current"),

  /* ── capacity ───────────────────────────────────────────────────── */
  capacity(db, weeks, fromDate) {
    const start = startOfWeek(fromDate || db.statusDate);
    const cols = Array.from({ length: weeks }, (_, i) => addDays(start, i * 7));
    const rows = db.people.map(person => {
      const allocs = db.allocations.filter(a => a.person === person.id);
      const cells = cols.map(w => {
        const wEnd = addDays(w, 7);
        const active = allocs.filter(a => D(a.from) < wEnd && D(a.to) >= w);
        return { week: iso(w), load: sum(active, a => a.pct), projects: active.map(a => a.project) };
      });
      return { person, cells, peak: Math.max(0, ...cells.map(c => c.load)), avg: Math.round(sum(cells, c => c.load) / cols.length) };
    });
    return { cols, rows };
  },
  overAllocated(db, weeks) {
    const cap = Engine.capacity(db, weeks || 8);
    return cap.rows.filter(r => {
      let run = 0;
      for (const c of r.cells) { run = c.load > db.settings.capacityCeiling ? run + 1 : 0; if (run >= 2) return true; }
      return false;
    });
  },
  bench(db, weeks) {
    const cap = Engine.capacity(db, weeks || 8);
    return sum(cap.rows, r => Math.max(0, 100 - r.cells[0].load)) / 100;
  },

  /* ── sites ──────────────────────────────────────────────────────── */
  siteRollup(db) {
    return db.sites.map(site => {
      const projects = db.projects.filter(p => p.site === site.id);
      const people = db.people.filter(p => p.site === site.id);
      const cap = Engine.capacity(db, 4);
      const rows = cap.rows.filter(r => r.person.site === site.id);
      const util = rows.length ? Math.round(sum(rows, r => r.avg) / rows.length) : 0;
      const roll = Engine.roll(db, projects);
      /* Governance load per site (committee G4): what each slate OWES,
         not only what it costs — decisions waiting and steering-level
         exposure, so the locations board reads as a governance board. */
      /* Governance load is what is still LIVE here. The project count and
         the value roll-up keep their long-standing meaning (everything
         ever led from this site); a closed project owes nobody a decision. */
      const live = projects.filter(p => !p.closed);
      const liveIds = new Set(live.map(p => p.id));
      const decisions = Engine.decisions(db, live).filter(d => d.entityId).length;
      const escalated = db.raid.filter(r => r.status === "Open" && r.project &&
        liveIds.has(r.project) && Engine.escalation(db, r).level === "Steering").length;
      return { site, projects, people, util, roll, load: sum(projects, p => p.budget),
               decisions, escalated };
    });
  },

  /* ── risk posture against appetite (committee G5) ───────────────────
     Exposure counts by band across a slate, with the two policy lines
     (pmoExposure / escalateExposure) called out — a portfolio's risk
     appetite as one row of numbers instead of a register to scroll. */
  /* `unassigned: false` leaves out portfolio-level items that name no
     project. A slate-level reading needs that: counted in, the same
     org-wide risks appear on every programme's card, and a programme
     with no open projects still shows a posture. */
  riskProfile(db, projects, { unassigned = true } = {}) {
    const ids = projects ? new Set(projects.map(p => p.id)) : null;
    const open = db.raid.filter(r => r.status === "Open" &&
      (r.project ? (!ids || ids.has(r.project)) : unassigned));
    const bands = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    let pmo = 0, steering = 0;
    for (const r of open) {
      const band = Engine.exposureBand(r);
      if (bands[band] !== undefined) bands[band]++;
      const x = Engine.exposure(r);
      if (x >= db.settings.escalateExposure) steering++;
      else if (x >= db.settings.pmoExposure) pmo++;
    }
    return { open: open.length, bands, pmo, steering,
             appetite: { pmo: db.settings.pmoExposure, steering: db.settings.escalateExposure } };
  },
  /* ── the finance position (V-05) ────────────────────────────────────
     Budget, spent, COMMITTED and free — the four numbers a finance
     business partner asks for, split capex from opex. Committed money is
     gone from the envelope months before it is a cost line, which is why
     "budget minus actuals" flatters every project that has raised a
     purchase order. Cancelled commitments do not count; received ones
     have become cost lines and would otherwise be counted twice. */
  moneyPosition(db, projects) {
    const ids = new Set((projects ?? []).map(p => p.id));
    const lines = (db.ledger ?? []).filter(l => ids.has(l.project));
    const open = (db.commitments ?? []).filter(c =>
      ids.has(c.project) && ["Open", "Part received"].includes(c.status));
    const by = (list, kind, field) =>
      sum(list.filter(x => (x.kind ?? "capex") === kind), x => Number(x[field] ?? 0));

    const budget = sum(projects ?? [], p => Number(p.budget ?? 0));
    const spentCapex = by(lines, "capex", "amount");
    const spentOpex = by(lines, "opex", "amount");
    const commitCapex = by(open, "capex", "amount");
    const commitOpex = by(open, "opex", "amount");
    const spent = spentCapex + spentOpex;
    const committed = commitCapex + commitOpex;

    /* Currencies actually booked against, so a portfolio run in dollars
       and francs says so rather than quietly presenting one number. */
    const currencies = [...new Set([...lines, ...open]
      .map(x => x.currency ?? "USD").filter(Boolean))].sort();

    return {
      budget, spent, committed, free: budget - spent - committed,
      capex: { spent: spentCapex, committed: commitCapex },
      opex: { spent: spentOpex, committed: commitOpex },
      openCommitments: open.length, currencies,
      overCommitted: budget > 0 && spent + committed > budget,
    };
  },

  /** V-09 — what a person is actually available for, after rotation. */
  effectiveFte(person) {
    if (!person) return 0;
    return Math.max(0, Math.min(100, Number(person.availability ?? 100))) / 100;
  },

  /* ── prioritisation (V-04) ──────────────────────────────────────────
     Four numbers a room can hold in its head. Fit and value pull up;
     risk and effort push down, so a cheap certain win outranks an
     expensive speculative one at the same value. Null when the set is
     incomplete — an unscored project is unscored, not a zero, and it
     sorts to the bottom rather than pretending to be worst. */
  priority(p) {
    if (p == null) return null;
    const { fit, value, risk, effort } = p;
    if (fit == null || value == null || risk == null || effort == null) return null;
    return Number(fit) + Number(value) + (6 - Number(risk)) + (6 - Number(effort));
  },

  /**
   * The queue, and where the money runs out. `envelope` is in millions;
   * projects are ranked by hand where a rank is given, by score
   * otherwise, and each carries the running total above it.
   */
  prioritise(db, projects, envelope) {
    const rows = (projects ?? []).map(p => ({
      project: p, score: Engine.priority(p), rank: p.rank ?? null, cost: Number(p.budget ?? 0),
    }));
    rows.sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      if (a.score == null && b.score == null) return String(a.project.name).localeCompare(String(b.project.name));
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });
    let running = 0;
    const cap = Number(envelope ?? 0);
    for (const r of rows) {
      running += r.cost;
      r.cumulative = running;
      /* Above the line while the running total still fits. With no
         envelope set nothing is below it — the tool does not invent a
         constraint nobody agreed. */
      r.funded = !cap || running <= cap;
    }
    return {
      rows, envelope: cap || null, demanded: running,
      funded: rows.filter(r => r.funded).length,
      unfunded: rows.filter(r => !r.funded).length,
      unscored: rows.filter(r => r.score == null).length,
      over: cap ? Math.max(0, running - cap) : 0,
    };
  },

  /* ── value realisation (Endeavour committee, V-01) ──────────────────
     How far a benefit travelled from its baseline toward its target.
     Written as a fraction of the intended MOVE rather than of the target,
     so it reads the same whether the number is meant to go up (plant
     availability) or down (cost per ounce): 1 is target met, above 1 is
     beaten, below 0 is worse than the day the project started. Null when
     the three numbers are not all present — an unmeasured benefit is not
     a zero, and showing it as one is how a portfolio lies. */
  attainment(b) {
    if (b == null) return null;
    const { baseline, target, actual } = b;
    if (baseline == null || target == null || actual == null) return null;
    const span = Number(target) - Number(baseline);
    if (span === 0) return Number(actual) === Number(target) ? 1 : null;
    return (Number(actual) - Number(baseline)) / span;
  },

  /** The value position across a slate: promised, measured, ruled on. */
  valueProfile(db, projects) {
    const ids = projects ? new Set(projects.map(p => p.id)) : null;
    const list = (db.benefits ?? []).filter(b => !ids || ids.has(b.project));
    const states = { Forecast: 0, Realised: 0, "Partially realised": 0, Missed: 0, Withdrawn: 0 };
    let measured = 0;
    for (const b of list) {
      if (states[b.status] !== undefined) states[b.status]++;
      if (b.actual != null) measured++;
    }
    const decided = states.Realised + states["Partially realised"] + states.Missed;
    /* Projects carrying no benefit at all. This is the number that says
       whether the portfolio is a value report or still a cost report. */
    const carrying = new Set(list.map(b => b.project));
    const uncased = (projects ?? []).filter(p => !carrying.has(p.id)).length;
    const scored = list.map(b => Engine.attainment(b)).filter(x => x != null);
    return {
      total: list.length,
      live: list.length - states.Withdrawn,
      states, measured, decided, uncased,
      met: states.Realised,
      hitRate: decided ? states.Realised / decided : null,
      attainment: scored.length ? sum(scored, x => x) / scored.length : null,
    };
  },

  overlapHours(a, b) {
    const aStart = 9 - a.tz, aEnd = 17.5 - a.tz;
    const bStart = 9 - b.tz, bEnd = 17.5 - b.tz;
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  },
  siteClock(site, now) {
    const n = now || new Date();
    const utc = n.getTime() + n.getTimezoneOffset() * 60000;
    const t = new Date(utc + site.tz * 3600000);
    return String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
  },

  /* ── board ──────────────────────────────────────────────────────── */
  columnItems: (db, projectIds, colId, filter) => db.items.filter(i =>
    i.column === colId &&
    (!projectIds || projectIds.includes(i.project)) &&
    (!filter || !filter.assignee || i.assignee === filter.assignee)),

  /* ── decisions the portfolio owes an answer to ──────────────────── */
  /* Returns a route string rather than a handler so the server can use it
     to build a meeting agenda. */
  decisions(db, projects) {
    const list = projects || db.projects;
    const ids = list.map(p => p.id);
    const out = [];
    db.crs.filter(c => c.status === "Pending" && ids.includes(c.project)).forEach(c => {
      const r = Engine.route(db, c);
      out.push({ kind: "Change request", title: c.id + " · " + c.title,
        meta: cash(c.cost) + " · " + r.authority, urgent: true,
        authority: r.authority,   // lets a site agenda mark "refer up, not decide"
        route: "#/change/" + c.id, entity: "change_request", entityId: c.id });
    });
    db.raid.filter(r => r.status === "Open" && (!r.project || ids.includes(r.project))
                        && Engine.escalation(db, r).level === "Steering").forEach(r => {
      out.push({ kind: "Escalated " + r.type.toLowerCase(), title: r.id + " · " + r.title,
        meta: "Exposure " + Engine.exposure(r) + " · " + (r.project || "Portfolio-wide"), urgent: true,
        route: "#/risk/" + r.id, entity: "raid_item", entityId: r.id });
    });
    list.forEach(p => {
      const g = Engine.currentGate(db, p.id);
      if (g.state === "At risk" || g.state === "Overdue")
        out.push({ kind: "Gate review", title: g.name + " · " + p.name,
          meta: g.outstanding.length + " evidence items outstanding", urgent: g.state === "Overdue",
          route: "#/project/" + p.id, entity: "project", entityId: p.id });
    });
    if (db.settings.capacityAlerts) {
      const over = Engine.overAllocated(db, 8);
      if (over.length) out.push({ kind: "Resourcing",
        title: over.length + " people above " + db.settings.capacityCeiling + "% for two weeks or more",
        meta: over.slice(0, 3).map(o => o.person.name).join(", "), urgent: false,
        route: "#/resources", entity: "resource", entityId: "" });
    }
    return out;
  },

  /* `asOf` matters for meetings: a milestone that is still ahead of the
     portfolio status date can already be behind the date the committee
     actually sits, and listing it under "next up" reads as a mistake. */
  horizon(db, n, projects, asOf) {
    const today = asOf || db.statusDate;
    const ids = projects ? projects.map(p => p.id) : null;
    return db.milestones
      .filter(m => D(m.date) >= D(today) && (!ids || ids.includes(m.project)))
      .sort(by("date"))
      .slice(0, n || 6)
      .map(m => ({ ...m, projectName: (Engine.project(db, m.project) || {}).name || "Portfolio" }));
  },

  curve(db, projects) {
    const ids = projects.map(p => p.id);
    const acts = db.activities.filter(a => ids.includes(a.project));
    if (!acts.length) return [];
    const from = monthKey(projects.reduce((a, p) => D(p.start) < D(a) ? p.start : a, projects[0].start));
    const to = monthKey(projects.reduce((a, p) => D(p.finish) > D(a) ? p.finish : a, projects[0].finish));
    const out = [];
    let m = D(from + "-01"); const stop = D(to + "-01");
    const bacOf = Object.fromEntries(projects.map(p => [p.id, p.budget]));
    while (m <= stop) {
      const at = iso(addMonths(m, 1));
      let pv = 0, ev = 0;
      acts.forEach(a => {
        const span = Math.max(1, days(a.baseStart, a.baseEnd));
        pv += a.weight * clamp(days(a.baseStart, at) / span, 0, 1) * bacOf[a.project];
        const rs = Math.max(1, days(a.start, a.end));
        const done = clamp(days(a.start, at) / rs, 0, 1) * (a.pct / 100) / Math.max(0.01, clamp(days(a.start, db.statusDate) / rs, 0.01, 1));
        ev += a.weight * clamp(done, 0, a.pct / 100) * bacOf[a.project];
      });
      const ac = sum(db.ledger.filter(l => ids.includes(l.project) && l.period <= monthKey(m)), l => l.amount);
      out.push({ period: monthKey(m), pv, ev: D(at) <= D(db.statusDate) ? ev : null, ac: D(m) <= D(db.statusDate) ? ac : null });
      m = addMonths(m, 1);
    }
    return out;
  },
};

export default Engine;

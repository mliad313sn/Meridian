/**
 * MEETING ANIMATION — the module the legacy build never had (D-04, R5).
 *
 * The committee's complaint, in C3's words: "the tool produces a status
 * report; it does not run the meeting." A report is a document you read
 * afterwards. An agenda is a sequence you work through, and the only
 * agenda worth having is one the portfolio writes itself (R5.2).
 *
 * Two shapes, deliberately different (R5.9):
 *
 *   weekly   — exception-only, time-boxed hard. Nothing to say about a
 *              project means the project is not on the agenda. A4's
 *              condition for supporting the module at all.
 *   monthly  — the steering pack: everything the weekly covers, plus the
 *              financial position, gate decisions and benefits.
 *
 * Sections with no content are dropped, never shown empty (R5.3).
 */

import {
  Engine, D, days, iso, addDays, fmtDate, cash, money, signedMoney, idx, pct,
  isoWeek, fmtDateLong, monthKey, sum, clamp, by, MONTHS,
} from "./engine.js";

/* ── which projects a series is about ─────────────────────────────── */

export function seriesProjects(db, series) {
  if (series.scopeKind === "programme") return db.projects.filter(p => p.programme === series.programmeId);
  if (series.scopeKind === "site") return db.projects.filter(p => p.site === series.siteId);
  return db.projects.slice();
}

export function seriesLabel(db, series) {
  if (series.scopeKind === "programme") {
    const pr = Engine.programme(db, series.programmeId);
    return pr ? pr.name : series.programmeId;
  }
  if (series.scopeKind === "site") {
    const s = Engine.site(db, series.siteId);
    return s ? s.city : series.siteId;
  }
  return "Group portfolio";
}

/* ── agenda construction ──────────────────────────────────────────── */

/**
 * @param db          portfolio snapshot
 * @param series      { id, cadence, scopeKind, programmeId, siteId, timeboxMin }
 * @param occurrence  { id, meetsOn }
 * @param openActions actions still open from earlier occurrences in this
 *                    series — PLUS, since the governance review, open
 *                    actions from broader-scope series whose project sits
 *                    in this slate, tagged with `origin` ("Group steering")
 *                    so tasking flows down visibly, not via memory.
 * @param extras      { referrals, levelDecisions } — the connective tissue
 *                    between levels (2026-08-28 governance committee):
 *                    referrals   = unanswered decisions referred UP to this
 *                                  series' scope by narrower series
 *                    levelDecisions = decisions minuted at site/programme
 *                                  level since the last group monthly
 * @returns { sections: [{ key, title, weight, items: [...] }], timebox, generatedAt }
 */
export function buildAgenda(db, series, occurrence, openActions = [], extras = {}) {
  const asOf = occurrence?.meetsOn || db.statusDate;
  const projects = seriesProjects(db, series);
  const monthly = series.cadence === "monthly";
  const sections = [];
  const referrals = extras.referrals || [];
  const levelDecisions = extras.levelDecisions || [];

  /* 1 · Actions carried forward — always first, always shown, even when
     empty, because "no open actions" is itself the thing to say (R5.6). */
  const overdue = openActions.filter(a => a.dueDate && D(a.dueDate) < D(asOf));
  sections.push({
    key: "actions",
    title: "Actions carried forward",
    weight: openActions.length ? 3 : 1,
    items: openActions.length
      ? openActions
          .slice()
          .sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1)
          .map(a => ({
            headline: a.title,
            detail: [
              a.origin ? "from " + a.origin : null,
              a.ownerName ? "Owner " + a.ownerName : "Unowned",
              a.dueDate ? "due " + fmtDate(a.dueDate) : "no date",
              D(a.dueDate || "9999-12-31") < D(asOf) ? "OVERDUE" : a.status,
            ].filter(Boolean).join(" · "),
            entity: "meeting_action", entityId: a.id,
            urgent: !!(a.dueDate && D(a.dueDate) < D(asOf)),
          }))
      : [{ headline: "No actions outstanding", detail: "Register is clear.", entity: "", entityId: "" }],
    note: overdue.length ? overdue.length + " overdue" : "",
  });

  /* 1b · Referred from delivery calls — the act of escalation the site
     chair never had. A narrower series said "this is beyond us"; it
     headlines here until a decision in this room answers it. Group and
     programme series only — a referral never travels sideways or down. */
  if (series.scopeKind !== "site" && referrals.length) {
    sections.push({
      key: "referrals",
      title: "Referred from delivery calls",
      weight: 5,
      items: referrals.map(rf => ({
        headline: rf.headline,
        detail: [rf.rationale, rf.seriesName + " · " + fmtDate(rf.meetsOn)].filter(Boolean).join(" — "),
        entity: "meeting_decision", entityId: rf.id,
        urgent: true,
      })),
    });
  }

  /* 2 · Exceptions — the substance of a weekly. Ordered worst first. */
  const metrics = projects.map(p => Engine.metrics(db, p.id)).filter(Boolean);
  const exceptions = metrics
    .filter(m => m.health.rag !== "G")
    .sort((a, b) => (a.health.rag === b.health.rag ? a.spi - b.spi : a.health.rag === "R" ? -1 : 1));
  if (exceptions.length) {
    sections.push({
      key: "exceptions",
      title: "Projects off track",
      weight: 5,
      items: exceptions.map(m => ({
        headline: (m.health.rag === "R" ? "RED · " : "AMBER · ") + m.project.name,
        detail: m.health.why +
          (m.slipDays > 7 ? " · forecast finish " + fmtDate(m.forecastFinish) + " (" + m.slipDays + "d late)" : "") +
          (m.vac < -0.005 ? " · " + signedMoney(m.vac) + " against budget" : ""),
        entity: "project", entityId: m.project.id,
        urgent: m.health.rag === "R",
      })),
    });
  }

  /* 3 · Decisions the meeting owes an answer to.
     A4's condition, made concrete: a weekly gets the six most pressing
     and a note of the rest. Twenty items in a five-minute box is not an
     agenda, it is a list nobody works through. */
  const decisions = Engine.decisions(db, projects);
  const all = decisions.filter(d => monthly || d.urgent);
  /* A site room must know which items are NOT its to take (committee
     rhythm-4): above-authority items are flagged "refer to steering"
     and kept OUTSIDE the cap, so they never crowd out decisions the
     room can actually make — but they are still said out loud. */
  const aboveAuthority = (d) => series.scopeKind !== "group" &&
    d.authority === "Steering committee";
  const decidable = all.filter(d => !aboveAuthority(d));
  const referUp = all.filter(aboveAuthority);
  const cap = monthly ? 20 : 6;
  const forHere = decidable.slice(0, cap);
  /* Referrals sit outside the decision cap, but not outside every cap:
     twenty of them in a five-minute box is the same unworkable agenda
     the cap exists to prevent, arriving through the exemption. */
  const referCap = monthly ? 8 : 3;
  const referHere = referUp.slice(0, referCap);
  const deferred = Math.max(0, decidable.length - cap);
  const unsaid = referUp.length - referHere.length;
  if (forHere.length || referHere.length) {
    sections.push({
      key: "decisions",
      title: "Decisions requested",
      weight: 5,
      note: [
        deferred ? `${deferred} further item${deferred === 1 ? "" : "s"} deferred — see the register` : "",
        unsaid ? `${unsaid} further item${unsaid === 1 ? "" : "s"} to refer upward` : "",
      ].filter(Boolean).join(" · "),
      items: [
        ...forHere.map(d => ({
          headline: d.kind + " · " + d.title,
          detail: d.meta,
          entity: d.entity, entityId: d.entityId,
          urgent: d.urgent,
        })),
        ...referHere.map(d => ({
          headline: "REFER TO STEERING · " + d.kind + " · " + d.title,
          detail: d.meta + " — above this room's authority; record a referral, not a decision",
          entity: d.entity, entityId: d.entityId,
          urgent: false,
        })),
      ],
    });
  }

  /* 4 · Milestones: missed since the last run, and landing before the next. */
  const lookBack = series.cadence === "weekly" ? 7 : 31;
  const lookOn = series.cadence === "weekly" ? 14 : 45;
  const ids = new Set(projects.map(p => p.id));
  const mAll = db.milestones.filter(m => ids.has(m.project));
  const missed = mAll.filter(m => !m.done && D(m.date) < D(asOf) && days(m.date, asOf) <= lookBack * 3);
  const soon = mAll.filter(m => !m.done && D(m.date) >= D(asOf) && days(asOf, m.date) <= lookOn);
  if (missed.length || soon.length) {
    sections.push({
      key: "milestones",
      title: "Milestones",
      weight: 3,
      items: [
        ...missed.sort(by("date")).map(m => ({
          headline: "MISSED · " + m.name,
          detail: (Engine.project(db, m.project) || {}).name + " — was due " + fmtDate(m.date) +
                  " (" + days(m.date, asOf) + " days ago)",
          entity: "milestone", entityId: m.id, urgent: true,
        })),
        ...soon.sort(by("date")).slice(0, monthly ? 12 : 6).map(m => ({
          headline: m.name,
          detail: (Engine.project(db, m.project) || {}).name + " — " + fmtDate(m.date) +
                  " (in " + days(asOf, m.date) + " days)",
          entity: "milestone", entityId: m.id, urgent: false,
        })),
      ],
    });
  }

  /* 5 · Dependency breaches — an overlap deeper than the baseline agreed. */
  const breaches = [];
  projects.forEach(p => Engine.depBreaches(db, p.id).forEach(b => breaches.push({ p, ...b })));
  if (breaches.length) {
    sections.push({
      key: "dependencies",
      title: "Schedule dependencies breached",
      weight: 2,
      items: breaches.map(b => ({
        headline: b.p.name + " · " + b.activity.name,
        detail: "starts " + b.overlap + " days before " + b.predecessor.name +
                " finishes; the baseline agreed " + b.agreed + " days of overlap",
        entity: "activity", entityId: b.activity.id, urgent: b.overlap - b.agreed > 20,
      })),
    });
  }

  /* 6 · Escalations that have not already appeared under decisions. */
  const seen = new Set(all.map(d => d.entityId));
  const raid = db.raid
    .filter(r => r.status === "Open" && (!r.project || ids.has(r.project)) && !seen.has(r.id))
    .filter(r => Engine.escalation(db, r).level === (monthly ? "Steering" : "PMO") ||
                 Engine.escalation(db, r).level === "Steering")
    .sort((a, b) => Engine.exposure(b) - Engine.exposure(a))
    .slice(0, monthly ? 10 : 5);
  if (raid.length) {
    sections.push({
      key: "raid",
      title: "Risks & issues for escalation",
      weight: 3,
      items: raid.map(r => ({
        headline: r.id + " · " + r.title,
        detail: "Exposure " + Engine.exposure(r) + " (" + Engine.exposureBand(r) + ") · " +
                Engine.escalation(db, r).why + " · owner " + Engine.personName(db, r.owner),
        entity: "raid_item", entityId: r.id,
        urgent: Engine.exposure(r) >= db.settings.escalateExposure,
      })),
    });
  }

  /* 7 · Capacity — weekly cares about the next fortnight only. */
  if (db.settings.capacityAlerts) {
    const over = Engine.overAllocated(db, monthly ? 12 : 4)
      .filter(r => series.scopeKind !== "site" || r.person.site === series.siteId);
    if (over.length) {
      sections.push({
        key: "capacity",
        title: "Resource pressure",
        weight: 2,
        items: over.slice(0, monthly ? 12 : 5).map(r => ({
          headline: r.person.name + " — peak " + r.peak + "%",
          detail: r.person.role + ", " + (Engine.site(db, r.person.site) || {}).city +
                  " · above the " + db.settings.capacityCeiling + "% ceiling for two weeks or more",
          entity: "person", entityId: r.person.id, urgent: r.peak >= 150,
        })),
      });
    }
  }

  /* ── monthly-only sections (R5.9) ───────────────────────────────── */
  if (monthly) {
    const roll = Engine.roll(db, projects);
    const conting = sum(projects, p => p.contingency);
    const contingUsed = sum(projects, p => p.contingencyUsed);
    sections.push({
      key: "financial",
      title: "Financial position",
      weight: 5,
      items: [
        { headline: "Portfolio " + money(roll.bac) + " approved · forecast " + money(roll.eac),
          detail: signedMoney(roll.vac) + " variance at completion · CPI " + idx(roll.cpi) +
                  " · SPI " + idx(roll.spi), entity: "", entityId: "",
          urgent: roll.vac < -Math.abs(roll.bac) * 0.02 },
        { headline: "Spend to date " + money(roll.ac) + " · earned " + money(roll.ev),
          detail: pct(roll.bac ? roll.ev / roll.bac : 0) + " complete by value against " +
                  pct(roll.bac ? roll.pv / roll.bac : 0) + " planned", entity: "", entityId: "" },
        { headline: "Contingency " + pct(conting ? contingUsed / conting : 0) + " consumed",
          detail: money(contingUsed) + " drawn of " + money(conting) + " held",
          entity: "", entityId: "",
          urgent: conting > 0 && contingUsed / conting > (roll.bac ? roll.ev / roll.bac : 0) + 0.15 },
        { headline: "Health spread",
          detail: roll.green + " green · " + roll.amber + " amber · " + roll.red + " red, across " +
                  roll.count + " projects (" + roll.measured + " measurable)", entity: "", entityId: "" },
      ],
    });

    const gates = projects
      .map(p => ({ p, g: Engine.currentGate(db, p.id) }))
      .filter(({ g }) => g.date && days(asOf, g.date) <= 60 && g.state !== "Cleared")
      .sort((a, b) => (a.g.date < b.g.date ? -1 : 1));
    if (gates.length) {
      sections.push({
        key: "gates",
        title: "Gate decisions due",
        weight: 4,
        items: gates.map(({ p, g }) => ({
          headline: g.name + " · " + p.name,
          detail: fmtDate(g.date) + " · " + g.state + " · " + g.approved + " of " + g.total +
                  " evidence items approved · owner " + g.owner,
          entity: "project", entityId: p.id,
          urgent: g.state === "Overdue" || g.state === "At risk",
        })),
      });
    }

    /* Decisions taken below this level since the last run (committee
       rhythm-3): the elementary assurance question a portfolio board
       asks — "what did the sites decide?" — answered on the agenda
       instead of by opening each site's minutes one by one. */
    if (series.scopeKind === "group" && levelDecisions.length) {
      sections.push({
        key: "levelDecisions",
        title: "Decisions taken at site and programme level",
        weight: 2,
        items: levelDecisions.map(d => ({
          headline: d.headline,
          detail: [d.seriesName, fmtDate(d.meetsOn), d.decidedByName ? "decided by " + d.decidedByName : null]
            .filter(Boolean).join(" · "),
          entity: "meeting_decision", entityId: d.id,
          urgent: false,
        })),
      });
    }

    if (db.settings.benefitTrack) {
      const inBenefit = projects.filter(p => p.phase === "Closure" || p.closed);
      if (inBenefit.length) {
        sections.push({
          key: "benefits",
          title: "Benefits tracking",
          weight: 2,
          items: inBenefit.map(p => {
            const g4 = Engine.gateStatus(db, p.id, 4);
            return {
              headline: p.name,
              detail: "Gate 4 " + g4.state.toLowerCase() + " · " + g4.approved + " of " + g4.total +
                      " realisation documents approved",
              entity: "project", entityId: p.id, urgent: g4.state === "Overdue",
            };
          }),
        });
      }
    }
  }

  /* 8 · Forward look — closes both cadences on something other than a problem. */
  const horizon = Engine.horizon(db, monthly ? 8 : 4, projects, asOf);
  if (horizon.length) {
    sections.push({
      key: "horizon",
      title: monthly ? "Next ninety days" : "Next up",
      weight: 1,
      items: horizon.map(m => ({
        headline: m.name,
        detail: m.projectName + " — " + fmtDate(m.date),
        entity: "milestone", entityId: m.id, urgent: false,
      })),
    });
  }

  return {
    sections: timebox(sections, series.timeboxMin || (monthly ? 60 : 20)),
    timebox: series.timeboxMin || (monthly ? 60 : 20),
    asOf,
    generatedAt: new Date().toISOString(),
    scope: seriesLabel(db, series),
    projectCount: projects.length,
  };
}

/**
 * Spread the meeting's timebox across the sections that survived, in
 * proportion to weight, with a two-minute floor. A4's condition: if the
 * agenda cannot fit in the box, the box wins and the tail is marked
 * "if time allows" rather than silently overrunning.
 */
function timebox(sections, total) {
  const live = sections.filter(s => s.items.length);
  const w = sum(live, s => s.weight) || 1;
  let spent = 0;
  return live.map((s, i) => {
    const share = Math.max(2, Math.round((s.weight / w) * total));
    const fits = spent + share <= total;
    spent += share;
    return { ...s, seq: i + 1, timeboxMin: share, ifTimeAllows: !fits };
  });
}

/* ── minutes (R5.7) ───────────────────────────────────────────────── */

/**
 * Markdown minutes from a closed (or open) occurrence. Reads from the
 * frozen agenda when one exists, so minutes of a closed meeting never
 * change even as the portfolio moves underneath them (R5.8).
 */
export function renderMinutes({ db, series, occurrence, agenda, attendance = [], decisions = [], actions = [] }) {
  const L = [];
  const scope = seriesLabel(db, series);
  const when = fmtDateLong(occurrence.meetsOn);

  L.push(`# ${series.name}`);
  L.push("");
  L.push(`**${scope}** · ${series.cadence === "weekly" ? "week " + isoWeek(occurrence.meetsOn) : monthName(occurrence.meetsOn)} · ${when}`);
  L.push(`Status: ${occurrence.status}${occurrence.closedAt
    ? " — closed " + String(occurrence.closedAt).slice(0, 16).replace("T", " ") +
      (occurrence.closedByName ? " by " + occurrence.closedByName : "")
    : ""}`);
  L.push("");

  const present = attendance.filter(a => a.state === "present" || a.state === "deputy");
  const apologies = attendance.filter(a => a.state === "apologies");
  const absent = attendance.filter(a => a.state === "absent");
  L.push("## Attendance");
  L.push("");
  const label = (a) => a.personName + (a.deputyForName ? " (for " + a.deputyForName + ")" : "");
  L.push(`**Present (${present.length}):** ${present.map(label).join(", ") || "—"}`);
  if (apologies.length) L.push(`**Apologies:** ${apologies.map(a => a.personName).join(", ")}`);
  if (absent.length) L.push(`**Absent:** ${absent.map(a => a.personName).join(", ")}`);
  L.push("");

  L.push("## Agenda");
  L.push("");
  (agenda?.sections || []).forEach(s => {
    L.push(`### ${s.seq}. ${s.title}  *(${s.timeboxMin} min${s.ifTimeAllows ? ", if time allows" : ""})*`);
    L.push("");
    s.items.forEach(it => {
      L.push(`- ${it.urgent ? "**" + it.headline + "**" : it.headline}`);
      if (it.detail) L.push(`  ${it.detail}`);
    });
    L.push("");
  });

  L.push("## Decisions");
  L.push("");
  if (!decisions.length) L.push("_No decisions recorded._");
  decisions.forEach((d, i) => {
    L.push(`**D${i + 1}. ${d.headline}**`);
    if (d.rationale) L.push(`  ${d.rationale}`);
    const bits = [];
    if (d.projectId) bits.push(d.projectId);
    if (d.crId) bits.push(d.crId);
    if (d.decidedByName) bits.push("decided by " + d.decidedByName);
    if (d.recordedByName && d.recordedByName !== d.decidedByName) bits.push("recorded by " + d.recordedByName);
    if (d.recordedAt) bits.push(String(d.recordedAt).slice(0, 10));
    if (bits.length) L.push(`  _${bits.join(" · ")}_`);
    L.push("");
  });

  L.push("## Actions");
  L.push("");
  if (!actions.length) L.push("_No actions raised._");
  if (actions.length) {
    L.push("| # | Action | Owner | Due | Status |");
    L.push("|---|--------|-------|-----|--------|");
    actions.forEach((a, i) => {
      L.push(`| A${i + 1} | ${a.title} | ${a.ownerName || "—"} | ${a.dueDate ? fmtDate(a.dueDate) : "—"} | ${a.status} |`);
    });
  }
  L.push("");
  if (occurrence.notes) {
    L.push("## Chair's notes");
    L.push("");
    L.push(occurrence.notes);
    L.push("");
  }
  L.push("---");
  L.push(`_Generated by Meridian IT-PMO from portfolio state as at ${agenda?.asOf || occurrence.meetsOn}._`);
  return L.join("\n");
}

function monthName(d) { return MONTHS[D(d).getUTCMonth()] + " " + D(d).getUTCFullYear(); }

/* ── occurrence scheduling ────────────────────────────────────────── */

/**
 * The next date a series should meet on or after `from`.
 * weekly  → the series weekday, in the same or following week
 * monthly → the same weekday in the first full week of the month
 */
export function nextOccurrenceDate(series, from) {
  const start = D(from);
  if (series.cadence === "weekly") {
    const delta = (series.weekday - start.getUTCDay() + 7) % 7;
    return iso(addDays(start, delta));
  }
  let probe = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  for (let guard = 0; guard < 24; guard++) {
    const delta = (series.weekday - probe.getUTCDay() + 7) % 7;
    const candidate = addDays(probe, delta);
    if (D(candidate) >= start) return iso(candidate);
    probe = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 1));
  }
  return iso(start);
}

export function periodLabel(series, date) {
  return series.cadence === "weekly"
    ? "Week " + isoWeek(date) + " " + D(date).getUTCFullYear()
    : monthName(date);
}

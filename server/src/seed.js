/**
 * SEED — build the opening book in PostgreSQL.
 *
 * The portfolio itself is the v4 book, unchanged, so every number the
 * committee reviewed still reads the same. What is new is everything the
 * v4 book had no room for: governance levels on projects, real user
 * accounts with real grants, and a meeting calendar with history.
 *
 * Run: npm run seed  (add --force to rebuild over an existing book)
 */

import crypto from "node:crypto";
import { connect, close, migrate, query, tx, one } from "./db.js";
import { hashPassword } from "./auth.js";
import { fromM } from "./portfolio.js";
import { GATES, iso, days, addDays, clamp, D, isoWeek } from "../../shared/engine.js";
import { nextOccurrenceDate, periodLabel } from "../../shared/meetings.js";
import * as S from "./seed-data.js";

/* Which projects the group runs, and which belong to a site (D-03 / R4.1).
   The rule the committee applied: anything crossing more than one site's
   operating model, or drawing on group contingency, is group-governed. */
const GOVERNANCE = {
  "PRJ-101": "group", "PRJ-104": "group", "PRJ-107": "group", "PRJ-112": "site",
  "PRJ-118": "group", "PRJ-121": "group", "PRJ-125": "group", "PRJ-129": "site",
  "PRJ-133": "site",  "PRJ-136": "site",  "PRJ-140": "group", "PRJ-144": "group",
};

/* Demo accounts. Passwords are seeded so the system is usable on first
   run; the administration screen exists to change them. */
const USERS = [
  { id: "U-ADMIN", email: "admin@meridian.example",  name: "System Administrator", role: "admin",  person: null,    pw: "meridian-admin-2026", grants: [] },
  { id: "U-KAUR",  email: "r.kaur@meridian.example", name: "R. Kaur",              role: "admin",  person: "PE-14", pw: "pmo-director-2026",   grants: [] },
  { id: "U-LIND",  email: "e.lindqvist@meridian.example", name: "E. Lindqvist",    role: "group",  person: "PE-15", pw: "programme-cbp-2026",  grants: [["programme","CBP"],["programme","EIT"]] },
  { id: "U-MARC",  email: "p.marchetti@meridian.example", name: "P. Marchetti",    role: "group",  person: "PE-16", pw: "programme-dch-2026",  grants: [["programme","DCH"]] },
  { id: "U-OKON",  email: "f.okonkwo@meridian.example",   name: "F. Okonkwo",      role: "group",  person: "PE-18", pw: "programme-dai-2026",  grants: [["programme","DAI"]] },
  { id: "U-SILVA", email: "g.silva@meridian.example",     name: "G. Silva",        role: "site",   person: "PE-19", pw: "site-gru-2026",       grants: [["site","GRU"]] },
  { id: "U-NAKA",  email: "t.nakamura@meridian.example",  name: "T. Nakamura",     role: "site",   person: "PE-04", pw: "site-yyz-2026",       grants: [["site","YYZ"]] },
  { id: "U-TANA",  email: "y.tanaka@meridian.example",    name: "Y. Tanaka",       role: "site",   person: "PE-17", pw: "site-sin-2026",       grants: [["site","SIN"]] },
  { id: "U-RAHI",  email: "n.rahimi@meridian.example",    name: "N. Rahimi",       role: "viewer", person: "PE-12", pw: "viewer-lis-2026",     grants: [["site","LIS"]] },
  { id: "U-MBEKI", email: "q.mbeki@meridian.example",     name: "Q. Mbeki",        role: "viewer", person: "PE-28", pw: "viewer-gru-2026",     grants: [["site","GRU"]] },
];

const MEETING_SERIES = [
  { id: "MS-GRP-W", name: "Group delivery call",            cadence: "weekly",  scope: "group",     target: null,  chair: "PE-14", weekday: 1, time: "09:00", box: 25 },
  { id: "MS-GRP-M", name: "Group steering committee",       cadence: "monthly", scope: "group",     target: null,  chair: "PE-14", weekday: 3, time: "14:00", box: 90 },
  { id: "MS-CBP-W", name: "Core Banking delivery call",     cadence: "weekly",  scope: "programme", target: "CBP", chair: "PE-15", weekday: 2, time: "10:00", box: 30 },
  { id: "MS-DCH-W", name: "Digital Channels delivery call", cadence: "weekly",  scope: "programme", target: "DCH", chair: "PE-16", weekday: 2, time: "11:30", box: 30 },
  { id: "MS-GRU-W", name: "São Paulo site call",            cadence: "weekly",  scope: "site",      target: "GRU", chair: "PE-19", weekday: 4, time: "09:30", box: 20 },
  { id: "MS-YYZ-W", name: "Toronto site call",              cadence: "weekly",  scope: "site",      target: "YYZ", chair: "PE-04", weekday: 4, time: "14:00", box: 20 },
  { id: "MS-SIN-M", name: "Singapore monthly review",       cadence: "monthly", scope: "site",      target: "SIN", chair: "PE-17", weekday: 2, time: "08:00", box: 45 },
];

export async function seed({ force = false, today = iso(new Date()) } = {}) {
  const existing = await one(`SELECT count(*)::int AS n FROM project`).catch(() => null);
  if (existing && existing.n > 0 && !force) {
    console.log(`  book already seeded (${existing.n} projects) — pass --force to rebuild`);
    return { skipped: true };
  }
  if (force) await wipe();

  await tx(async (t) => {
    /* ── reference ────────────────────────────────────────────────── */
    for (const s of S.SITES) {
      await t.query(
        `INSERT INTO site (id, city, region, tz_offset, tz_name, headcount, fte, charter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [s.id, s.city, s.region, s.tz, s.tzName, s.headcount, s.fte, s.role]
      );
    }
    for (const p of S.PEOPLE) {
      await t.query(
        `INSERT INTO person (id, name, job_role, site_id, day_rate) VALUES ($1,$2,$3,$4,$5)`,
        [p.id, p.name, p.role, p.site, p.rate]
      );
    }
    for (const g of S.PROGRAMMES) {
      await t.query(
        `INSERT INTO programme (id, name, sponsor, manager_id) VALUES ($1,$2,$3,$4)`,
        [g.id, g.name, g.sponsor, g.managerId]
      );
    }
    for (const c of S.COLUMNS) {
      await t.query(`INSERT INTO board_column (id, name, seq, wip) VALUES ($1,$2,$3,$4)`,
        [c.id, c.name, S.COLUMNS.indexOf(c), c.wip]);
    }

    /* ── projects and their generated detail ──────────────────────── */
    const projects = S.PROJECTS.map((p) => ({ ...p, programme: p.prog }));

    for (const p of projects) {
      const phase = phaseFor(p, today);
      const used = +(p.contingency * (p.perf.cost < 0.95 ? 0.42 : p.perf.cost < 1.0 ? 0.18 : 0.05)).toFixed(3);
      await t.query(
        `INSERT INTO project
           (id, name, programme_id, site_id, governance_level, pm_id, method,
            start_date, finish_date, baseline_finish, budget, contingency,
            contingency_used, description, phase, gate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [p.id, p.name, p.prog, p.site, GOVERNANCE[p.id] ?? "site", p.pm, p.method,
         p.start, p.finish, p.baseline, fromM(p.budget), fromM(p.contingency),
         fromM(used), p.desc, phase, 0]
      );

      const acts = S.genActivities(p, today);
      for (const a of acts) {
        await t.query(
          `INSERT INTO activity
             (id, project_id, name, stage, start_date, end_date, base_start, base_end,
              weight, pct, owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [a.id, a.project, a.name, a.stage, a.start, a.end, a.baseStart, a.baseEnd,
           a.weight, a.pct, a.owner]
        );
      }
      for (const a of acts) {
        for (const d of a.deps) {
          await t.query(
            `INSERT INTO activity_dep (activity_id, predecessor_id) VALUES ($1,$2)`,
            [a.id, d]
          );
        }
      }

      for (const m of S.genMilestones(p)) {
        await t.query(
          `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, done)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [m.id, m.project, m.name, m.date, m.baseDate, m.gate, m.kind, m.owner,
           D(m.date) < D(today)]
        );
      }

      for (const l of S.genLedger(p, acts, today)) {
        await t.query(
          `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [l.project, l.period, l.period + "-01", fromM(l.amount), "Labour",
           "Monthly accrual, opening book"]
        );
      }
    }

    for (const c of S.CROSS_DEPS) {
      await t.query(
        `INSERT INTO cross_dep (from_project, from_stage, to_project, to_stage, label)
         VALUES ($1,$2,$3,$4,$5)`,
        [c.from, c.fromStage, c.to, c.toStage, c.label]
      );
    }

    /* ── registers ────────────────────────────────────────────────── */
    for (const r of S.SEED_RAID) {
      await t.query(
        `INSERT INTO raid_item
           (id, project_id, kind, title, detail, probability, impact, status,
            response, owner_id, opened_on, review_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [r.id, r.project, r.type, r.title, r.detail, r.p, r.i, r.status,
         r.response, r.owner, r.opened, r.review]
      );
    }

    for (const c of S.SEED_CRS) {
      await t.query(
        `INSERT INTO change_request
           (id, project_id, title, description, raised_by, raised_on, cost_delta,
            weeks_delta, funding, risk_delta, status, applied)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [c.id, c.project, c.title, c.desc, c.raisedBy, c.raised, fromM(c.cost),
         c.weeks, c.funding, c.riskDelta, c.status, c.status === "Approved"]
      );
      for (let i = 0; i < S.CR_STEPS.length; i++) {
        const st = S.CR_STEPS[i];
        const state = c.status === "Rejected" && i === c.stage ? "rejected"
          : i < c.stage ? "done" : i === c.stage ? "current" : "waiting";
        await t.query(
          `INSERT INTO change_step (cr_id, seq, role_label, note, state, decided_on)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [c.id, i, st.role, st.note, state, i < c.stage ? iso(addDays(c.raised, i * 3)) : null]
        );
      }
    }

    /* Authored documents, then a full gate-evidence set for every project so
       gate locking has something real to read. */
    /* An approved seed document carries the link and the frozen address a
       real approval would have left (R-01) — the demo shows the control
       working, not a book that predates it. */
    const docUri = (id) => `https://docs.meridian.example/evidence/${id}.pdf`;
    const docHash = (uri) => crypto.createHash("sha256").update(uri).digest("hex");
    let dn = 101;
    for (const d of S.SEED_DOCS) {
      const id = "DOC-" + dn++;
      const uri = docUri(id);
      const approved = d.status === "Approved";
      await t.query(
        `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on,
                               uri, uri_locked_hash, uri_locked_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, d.project, d.name, d.type, d.gate, d.owner, d.rev, d.status, d.updated,
         uri, approved ? docHash(uri) : "", approved ? d.updated : null]
      );
    }
    for (const p of projects) {
      for (const g of GATES) {
        const has = S.SEED_DOCS.some((d) => d.project === p.id && d.gate === g.n);
        if (has) continue;
        const span = days(p.start, p.finish);
        const due = addDays(p.start, Math.round(g.at * span));
        const late = D(due) > D(today);
        const gid = "DOC-" + dn++;
        const guri = docUri(gid);
        await t.query(
          `INSERT INTO document (id, project_id, name, doc_type, gate, owner_id, revision, status, updated_on,
                                 uri, uri_locked_hash, uri_locked_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [gid, p.id, g.evidence.split(",")[0] + " — " + p.id, p.id,
           g.n, p.pm, late ? "0.1" : "1.0", late ? "Draft" : "Approved",
           iso(late ? today : addDays(due, -6)),
           guri, late ? "" : docHash(guri), late ? null : iso(addDays(due, -6))]
        );
      }
    }
    // fix the doc_type column, which the loop above filled with the project id
    await t.query(
      `UPDATE document SET doc_type = CASE gate
         WHEN 1 THEN 'Charter' WHEN 2 THEN 'Design' WHEN 4 THEN 'Closure' ELSE 'Assurance' END
       WHERE doc_type LIKE 'PRJ-%'`
    );

    let wn = 300;
    for (const [project, col, title, assignee, points, priority] of S.SEED_ITEMS) {
      await t.query(
        `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority, created_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        ["WI-" + wn, project, col, title, assignee, points, priority,
         iso(addDays(today, -40 + (wn % 30)))]
      );
      wn++;
    }

    for (const a of S.genAllocations(projects, today)) {
      await t.query(
        `INSERT INTO allocation (person_id, project_id, from_date, to_date, pct)
         VALUES ($1,$2,$3,$4,$5)`,
        [a.person, a.project, a.from, a.to, a.pct]
      );
    }

    /* ── settings ─────────────────────────────────────────────────── */
    const settings = {
      orgName: "MERIDIAN", statusDate: today,
      autoRag: true, gateLock: true, ccb: true, capacityAlerts: true, benefitTrack: true,
      ccbThreshold: 0.25, ccbWeeks: 2,
      amberSpi: 0.95, redSpi: 0.90, amberCpi: 0.95, redCpi: 0.90,
      escalateExposure: 15, pmoExposure: 8, issueAgeDays: 10, capacityCeiling: 100,
      cadence: "Weekly — Monday 09:00",
      /* R-01 — the demo book models a PROPERLY CONFIGURED estate: a
         trusted host, and every approved document pointing into it. */
      documentHosts: "docs.meridian.example",
    };
    for (const [k, v] of Object.entries(settings)) {
      await t.query(`INSERT INTO app_setting (key, value) VALUES ($1,$2)`, [k, JSON.stringify(v)]);
    }
  });

  /* ── users and grants (outside the big transaction: scrypt is slow) ── */
  for (const u of USERS) {
    const { hash, salt } = await hashPassword(u.pw);
    await query(
      `INSERT INTO app_user (id, email, display_name, person_id, role, pw_hash, pw_salt)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [u.id, u.email, u.name, u.person, u.role, hash, salt]
    );
    for (const [kind, target] of u.grants) {
      await query(
        `INSERT INTO access_grant (user_id, scope_kind, programme_id, site_id)
         VALUES ($1,$2,$3,$4)`,
        [u.id, kind, kind === "programme" ? target : null, kind === "site" ? target : null]
      );
    }
  }

  /* The federation service principal (migration 005). A wipe removes it
     with everything else, so the seed restores it: audit rows from
     /v1/* ingests FK onto this account. Unusable hash, inactive — no
     session can ever be minted for it. */
  await query(
    `INSERT INTO app_user (id, email, display_name, role, pw_hash, pw_salt, active)
     VALUES ('SVC-SDP', 'svc-sdp@federation.invalid', 'SDP Federation', 'viewer',
             'unusable', 'unusable', false)
     ON CONFLICT (id) DO NOTHING`
  );

  /* ── meetings: the series, plus a short history so the actions
       register has something to carry forward on day one ─────────── */
  await seedMeetings(today);

  await syncIdCounters();

  await query(
    `INSERT INTO audit_event (user_id, user_label, action, entity, detail)
     VALUES ($1,$2,$3,$4,$5)`,
    ["U-ADMIN", "System Administrator (admin)", "Portfolio book opened", "system",
     `${S.PROJECTS.length} projects across ${S.SITES.length} sites, ${USERS.length} accounts`]
  );

  console.log(`  seeded ${S.PROJECTS.length} projects · ${USERS.length} users · ${MEETING_SERIES.length} meeting series`);
  return { skipped: false };
}

async function seedMeetings(today) {
  for (const m of MEETING_SERIES) {
    await query(
      `INSERT INTO meeting_series
         (id, name, cadence, scope_kind, programme_id, site_id, chair_id, weekday, start_time, timebox_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [m.id, m.name, m.cadence, m.scope,
       m.scope === "programme" ? m.target : null,
       m.scope === "site" ? m.target : null,
       m.chair, m.weekday, m.time, m.box]
    );
  }

  /* Three closed weeklies and one closed monthly behind us, so the
     carried-forward actions section has real content the first time a
     chair opens the tool. */
  const history = [
    { series: "MS-GRP-W", back: 21 }, { series: "MS-GRP-W", back: 14 }, { series: "MS-GRP-W", back: 7 },
    { series: "MS-CBP-W", back: 7 },  { series: "MS-GRP-M", back: 26 },
  ];
  const ACTIONS = [
    { s: "MS-GRP-W", back: 21, title: "Confirm the ISO 20022 mapping backlog with the correspondent banks", owner: "PE-01", project: "PRJ-101", due: -3,  status: "Open" },
    { s: "MS-GRP-W", back: 14, title: "Bring the KYC vendor availability remediation plan to steering",       owner: "PE-02", project: "PRJ-104", due: 4,   status: "In progress" },
    { s: "MS-GRP-W", back: 14, title: "Re-sequence zero-trust wave 4 out of the quarter-end freeze",          owner: "PE-06", project: "PRJ-121", due: -1,  status: "Open" },
    { s: "MS-GRP-W", back: 7,  title: "Publish the revised settlement retry policy for review",               owner: "PE-10", project: "PRJ-101", due: 6,   status: "Open" },
    { s: "MS-GRP-W", back: 7,  title: "Close out the March disposal certificates with the vendor",            owner: "PE-08", project: "PRJ-129", due: 2,   status: "Open" },
    { s: "MS-CBP-W", back: 7,  title: "Size the dual-run reconciliation squad for CR-218",                    owner: "PE-01", project: "PRJ-101", due: 3,   status: "In progress" },
    { s: "MS-GRP-M", back: 26, title: "Reforecast portfolio contingency ahead of the Q4 funding round",       owner: "PE-25", project: null,      due: 12,  status: "Open" },
    { s: "MS-GRP-M", back: 26, title: "Agree the LATAM localisation funding split with the region",           owner: "PE-19", project: "PRJ-136", due: -5,  status: "Open" },
  ];

  const occId = (s, d) => s + "-" + d.replace(/-/g, "");
  for (const h of history) {
    const series = MEETING_SERIES.find((m) => m.id === h.series);
    const date = iso(addDays(today, -h.back));
    await query(
      `INSERT INTO meeting_occurrence
         (id, series_id, meets_on, period_label, status, opened_at, opened_by, closed_at, closed_by, notes)
       VALUES ($1,$2,$3,$4,'closed', $5, 'U-KAUR', $6, 'U-KAUR', $7)`,
      [occId(h.series, date), h.series, date,
       periodLabel({ cadence: series.cadence }, date),
       date + "T09:00:00Z", date + "T09:30:00Z",
       "Closed on the call. Actions confirmed with owners."]
    );
    // a light attendance record so the minutes read like minutes
    const chair = series.chair;
    await query(
      `INSERT INTO meeting_attendance (occurrence_id, person_id, state) VALUES ($1,$2,'present')`,
      [occId(h.series, date), chair]
    );
  }

  let an = 1;
  for (const a of ACTIONS) {
    const date = iso(addDays(today, -a.back));
    await query(
      `INSERT INTO meeting_action
         (id, series_id, raised_in, title, owner_id, project_id, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      ["ACT-" + String(an++).padStart(3, "0"), a.s, occId(a.s, date), a.title,
       a.owner, a.project, iso(addDays(today, a.due)), a.status]
    );
  }

  /* And a decision on the last monthly, so the decision log is not empty. */
  const mDate = iso(addDays(today, -26));
  await query(
    `INSERT INTO meeting_decision (id, occurrence_id, headline, rationale, project_id, decided_by, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    ["DEC-001", occId("MS-GRP-M", mDate),
     "Hold the payments cutover date pending the CR-218 dual-run decision",
     "The committee would not move the committed date on a forecast alone. The parallel-run request is to come back with a costed reconciliation plan before the date is reopened.",
     "PRJ-101", "PE-14", "U-KAUR"]
  );

  /* The next scheduled occurrence for every series, so a chair opening the
     module finds a meeting waiting rather than an empty screen. */
  for (const m of MEETING_SERIES) {
    const next = nextOccurrenceDate(
      { cadence: m.cadence, weekday: m.weekday }, iso(addDays(today, 1))
    );
    await query(
      `INSERT INTO meeting_occurrence (id, series_id, meets_on, period_label, status)
       VALUES ($1,$2,$3,$4,'scheduled')
       ON CONFLICT (series_id, meets_on) DO NOTHING`,
      [occId(m.id, next), m.id, next, periodLabel({ cadence: m.cadence }, next)]
    );
  }
}

/**
 * Advance the identifier counters past everything the seed just wrote.
 *
 * Migration 004 seeds the counters from whatever is in the tables at the
 * time it runs — which, on a fresh database, is nothing. The seed then
 * inserts DOC-101, ACT-001 and the rest without telling the counters, so
 * the first allocation after a seed collided with a seeded row and the
 * user saw a 409. The seed owns the rows, so it owns advancing the
 * counters past them.
 */
async function syncIdCounters() {
  const highest = [
    ["PRJ", "project", "id LIKE 'PRJ-%'"],
    ["RSK", "raid_item", "id LIKE 'RSK-%'"],
    ["ISS", "raid_item", "id LIKE 'ISS-%'"],
    ["ASM", "raid_item", "id LIKE 'ASM-%'"],
    ["DEP", "raid_item", "id LIKE 'DEP-%'"],
    ["CR", "change_request", "true"],
    ["DOC", "document", "true"],
    ["WI", "work_item", "true"],
    ["PE", "person", "true"],
    ["DEC", "meeting_decision", "true"],
    ["ACT", "meeting_action", "true"],
  ];
  for (const [prefix, table, where] of highest) {
    await query(
      `INSERT INTO id_counter (prefix, next_value)
       SELECT $1, COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), ''))::int, 0)
         FROM ${table} WHERE ${where}
       ON CONFLICT (prefix) DO UPDATE
         SET next_value = GREATEST(id_counter.next_value, EXCLUDED.next_value)`,
      [prefix]
    );
  }
  /* Milestone identifiers are project-scoped (`PRJ-112-M4`) but the
     number comes from one global counter, so it has to start above the
     highest suffix any project already uses — otherwise the first
     hand-placed milestone collides with a seeded one. */
  await query(
    `INSERT INTO id_counter (prefix, next_value)
     SELECT 'MS', COALESCE(MAX(NULLIF(substring(id from '-M([0-9]+)$'), ''))::int, 0)
       FROM milestone WHERE kind = 'milestone'
     ON CONFLICT (prefix) DO UPDATE
       SET next_value = GREATEST(id_counter.next_value, EXCLUDED.next_value)`
  );
}

function phaseFor(p, today) {
  const t = clamp(days(p.start, today) / days(p.start, p.finish), 0, 1);
  if (t < 0.10) return "Initiation";
  if (t < 0.22) return "Design";
  if (t < 0.82) return "Execution";
  if (t < 0.94) return "Transition";
  return "Closure";
}

async function wipe() {
  const tables = [
    "meeting_action", "meeting_decision", "meeting_attendance", "agenda_item",
    "meeting_occurrence", "meeting_series",
    "report_narrative", "work_item", "board_column", "document", "allocation",
    "change_step", "change_request", "raid_item", "cost_line", "milestone",
    "cross_dep", "activity_dep", "activity", "project",
    "session", "access_grant", "app_user", "app_setting",
    "programme", "person", "site",
  ];
  for (const tbl of tables) await query(`DELETE FROM ${tbl}`);
}

/* ── CLI ──────────────────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
    process.argv[1]?.endsWith("seed.js")) {
  const force = process.argv.includes("--force");
  console.log("Meridian IT-PMO — seeding");
  /* An async function rather than top-level await: this module is also
     reachable from the packaged build, which bundles to CommonJS. */
  (async () => {
    await connect();
    await migrate();
    await seed({ force });
    await close();
  })().catch((e) => { console.error(e); process.exit(1); });
}

export { USERS as SEED_USERS, MEETING_SERIES as SEED_SERIES, GOVERNANCE };

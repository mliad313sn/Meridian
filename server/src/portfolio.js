/**
 * PORTFOLIO SERIALISER — database rows → the shape the engine expects.
 *
 * The v4 engine reads a single `db` object with a particular set of field
 * names. Rather than rewrite the engine (D-05 says its behaviour is
 * frozen), this file translates once, here, and everything downstream —
 * server routes, browser views, tests — sees the shape it already knows.
 *
 * Two conversions happen on the way out:
 *
 *   money   the ledger holds exact whole currency units; the engine and
 *           every screen speak in millions. Divide once, here (F-07).
 *   scope   rows the user may not see never enter the object at all, so
 *           an out-of-scope project cannot leak through a view that
 *           forgot to filter (R1.10).
 */

import { many, one } from "./db.js";
import { canSeeProject, projectScopeSql } from "../../shared/rbac.js";

export const M = 1_000_000;
/** Exact whole units (what the ledger holds) → millions (what is read). */
export const toM = (v) => Number(v ?? 0) / M;
/** Millions (what the UI speaks) → exact currency units to the cent. */
export const fromM = (v) => Math.round(Number(v ?? 0) * M * 100) / 100;

const DEFAULT_SETTINGS = {
  autoRag: true, gateLock: true, ccb: true, capacityAlerts: true, benefitTrack: true,
  ccbThreshold: 0.25, ccbWeeks: 2,
  amberSpi: 0.95, redSpi: 0.90, amberCpi: 0.95, redCpi: 0.90,
  escalateExposure: 15, pmoExposure: 8, issueAgeDays: 10, capacityCeiling: 100,
  /* V-04 — the capital envelope the queue is ranked against, in millions.
     Zero means "no envelope agreed", and nothing falls below the line. */
  capexEnvelope: 0,
  cadence: "Weekly — Monday 09:00",
  orgName: "MERIDIAN",
  /* R-01 — the hosts an evidence link may point at, comma-separated.
     EMPTY FAILS CLOSED: until somebody names the group's document estate,
     nothing can be approved as evidence — the same rule the change
     thresholds follow. A link to anywhere is not a proof. */
  documentHosts: "",
  /* N-05 / G-13 — le centre de notification et sa charge.
     `notifyRetentionDays` à zéro veut dire QU'AUCUNE durée n'a été
     décidée : la purge s'abstient alors et dit quel réglage manque,
     plutôt que d'inventer combien de temps on garde la trace de ce qu'on
     a dit à qui. `notifyHosts` est fermé par défaut, comme
     `documentHosts` : sans hôte nommé, rien ne sort. */
  notifyRetentionDays: 0,
  notifyEscalateDays: 0,
  notifyWeeklyCap: 10,
  notifyHosts: "",
};

/* Both drivers already decode jsonb, but a plain JSON string round-trips
   as a bare JS string that must not be parsed again — so parse only when
   it actually looks like encoded JSON, and keep the value otherwise. */
export function jsonValue(v) {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v; }
}

export async function loadSettings() {
  const rows = await many(`SELECT key, value FROM app_setting`);
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = jsonValue(r.value);
  return out;
}

export async function statusDate(settings) {
  const s = settings || (await loadSettings());
  return s.statusDate || new Date().toISOString().slice(0, 10);
}

/**
 * The whole portfolio a user is entitled to see, in engine shape.
 * One round of queries; the joins are small enough at portfolio scale
 * that reassembling in JS is cheaper than eight correlated selects.
 */
export async function loadPortfolio(user) {
  const settings = await loadSettings();
  const scope = projectScopeSql(user, "p");

  const [sites, programmes, people, windows] = await Promise.all([
    many(`SELECT * FROM site WHERE active ORDER BY city`),
    many(`SELECT * FROM programme WHERE active ORDER BY name`),
    many(`SELECT * FROM person WHERE active ORDER BY name`),
    // the plant's own calendar (010) — a site fact, not a project one
    many(`SELECT * FROM site_window ORDER BY starts_on`),
  ]);
  // absences and deputies (015 / R-02) — a people fact, like the calendar
  const absences = await many(`SELECT * FROM person_absence ORDER BY starts_on`);

  const projectRows = await many(
    `SELECT p.* FROM project p WHERE ${scope.sql} ORDER BY p.name`,
    scope.params
  );
  const ids = projectRows.map((p) => p.id);
  const idSet = new Set(ids);

  /* Everything below hangs off the projects the user may see, so an
     out-of-scope activity or cost line has no route into the response. */
  const inScope = (sql, extra = []) =>
    ids.length ? many(sql, [ids, ...extra]) : Promise.resolve([]);

  const [
    activities, deps, milestones, ledger, raidRows, crRows, stepRows,
    allocations, docs, columns, items, crossDeps, narrativeRows, extLinks,
    benefits, waves, commitments, timesheets, lessonRows, tolerances, exceptions, caseRows,
  ] = await Promise.all([
    inScope(`SELECT * FROM activity WHERE project_id = ANY($1) ORDER BY project_id, stage`),
    inScope(`SELECT d.* FROM activity_dep d JOIN activity a ON a.id = d.activity_id
              WHERE a.project_id = ANY($1)`),
    inScope(`SELECT * FROM milestone WHERE project_id = ANY($1) ORDER BY due_date`),
    /* Individual postings, not a monthly sum. The aggregate was enough to
       compute actual cost, but it left no line to point at — so a
       mis-posting could not be corrected, which is the whole reason the
       ledger is append-only in the first place. */
    inScope(`SELECT id, project_id, period, booked_on, amount, category, note,
                    from_contingency, created_by, kind, currency, fx_rate, amount_local, risk_id
               FROM cost_line WHERE project_id = ANY($1)
              ORDER BY period, id`),
    // portfolio-wide RAID (project_id NULL) is visible to everyone in the book
    ids.length
      ? many(`SELECT * FROM raid_item WHERE project_id = ANY($1) OR project_id IS NULL ORDER BY id`, [ids])
      : many(`SELECT * FROM raid_item WHERE project_id IS NULL ORDER BY id`),
    inScope(`SELECT * FROM change_request WHERE project_id = ANY($1) ORDER BY raised_on DESC`),
    inScope(`SELECT s.* FROM change_step s JOIN change_request c ON c.id = s.cr_id
              WHERE c.project_id = ANY($1) ORDER BY s.cr_id, s.seq`),
    inScope(`SELECT * FROM allocation WHERE project_id = ANY($1)`),
    ids.length
      ? many(`SELECT * FROM document WHERE project_id = ANY($1) OR project_id IS NULL ORDER BY name`, [ids])
      : many(`SELECT * FROM document WHERE project_id IS NULL ORDER BY name`),
    many(`SELECT * FROM board_column ORDER BY seq`),
    inScope(`SELECT * FROM work_item WHERE project_id = ANY($1) ORDER BY id`),
    inScope(`SELECT * FROM cross_dep WHERE from_project = ANY($1) OR to_project = ANY($1)`),
    many(`SELECT block_key, lines FROM report_narrative`),
    // SDP federation links (005) — display caches, scoped like all else.
    inScope(`SELECT * FROM ext_link WHERE project_id = ANY($1) ORDER BY linked_at DESC`),
    // What each project promised, and what was measured (008 / V-01).
    inScope(`SELECT * FROM benefit WHERE project_id = ANY($1) ORDER BY project_id, id`),
    // the same thing, at five sites (010 / V-06)
    inScope(`SELECT * FROM rollout_wave WHERE project_id = ANY($1) ORDER BY project_id, seq, site_id`),
    // money promised and not yet spent (012 / V-05)
    inScope(`SELECT * FROM commitment WHERE project_id = ANY($1) ORDER BY raised_on DESC, id`),
    // the actual effort, one number a week (016 / R-03)
    inScope(`SELECT * FROM timesheet WHERE project_id = ANY($1) ORDER BY week_start DESC`),
    /* PM-02 — les enseignements. Seule collection du livre qui n'est PAS
       bornée aux projets visibles, et c'est délibéré : un enseignement
       ADOPTÉ est une connaissance de groupe, sinon un site n'apprend
       jamais de ce qu'un autre a vécu et le registre ne sert à rien.
       Ce qui reste borné, c'est ce qu'il RÉVÈLE : hors périmètre,
       l'enseignement se lit et le projet dont il vient ne se nomme pas
       (voir le sérialiseur). R1.10 tient : l'existence d'un projet
       hors périmètre n'est toujours pas divulguée. */
    many(`SELECT * FROM lesson
           WHERE status = 'Adopted' OR project_id = ANY($1)
           ORDER BY raised_on DESC, id`, [ids]),
    /* PM-01 — la marge accordée, et les dépassements constatés. */
    inScope(`SELECT * FROM project_tolerance
              WHERE project_id = ANY($1) AND active ORDER BY project_id`),
    inScope(`SELECT * FROM project_exception
              WHERE project_id = ANY($1) ORDER BY raised_on DESC, id`),
    /* PM-03 — la promesse contre laquelle le réalisé se relira. */
    inScope(`SELECT * FROM business_case WHERE project_id = ANY($1)`),
  ]);

  const depsByActivity = new Map();
  for (const d of deps) {
    if (!depsByActivity.has(d.activity_id)) depsByActivity.set(d.activity_id, []);
    depsByActivity.get(d.activity_id).push(d.predecessor_id);
  }
  const stepsByCr = new Map();
  for (const s of stepRows) {
    if (!stepsByCr.has(s.cr_id)) stepsByCr.set(s.cr_id, []);
    stepsByCr.get(s.cr_id).push({
      role: s.role_label, note: s.note, state: s.state,
      when: s.decided_on ?? null, comment: s.comment,
    });
  }

  const narrative = {};
  for (const n of narrativeRows) {
    narrative[n.block_key] = jsonValue(n.lines);
  }

  return {
    orgName: settings.orgName ?? "MERIDIAN",
    statusDate: await statusDate(settings),
    currentUser: user?.personId ?? null,
    viewer: user ? { id: user.id, role: user.role, name: user.displayName } : null,

    sites: sites.map((s) => ({
      id: s.id, city: s.city, region: s.region,
      /* MC-01 — G-14 exige un avis juridique « de son pays » et une
         demande RGPD arrive à UNE entité : le site sait désormais dire
         les deux. */
      country: s.country ?? "", legalEntity: s.legal_entity ?? "",
      tz: Number(s.tz_offset),
      tzName: s.tz_name, headcount: s.headcount, fte: s.fte, role: s.charter,
      // what the site actually is, not only what time it is there (V-07)
      linkMbps: s.link_mbps === null ? null : Number(s.link_mbps),
      linkKind: s.link_kind ?? "", readiness: s.readiness ?? "Unknown",
      readinessNote: s.readiness_note ?? "",
      /* A-12 — la personne du site qu'on appelle en premier. */
      champion: s.champion_id ?? null,
      version: s.row_version,
    })),

    /* The plant's calendar (V-03). Site-wide, so it is not scoped by
       project: a freeze at Houndé is a fact for everyone planning there. */
    windows: windows.map((w) => ({
      id: w.id, site: w.site_id, kind: w.kind, label: w.label, detail: w.detail,
      from: w.starts_on, to: w.ends_on, version: w.row_version,
    })),

    /* Who is away, until when, and who covers (R-02). */
    absences: absences.map((a) => ({
      id: a.id, person: a.person_id, from: a.starts_on, to: a.ends_on,
      reason: a.reason, deputy: a.deputy_id, note: a.note, version: a.row_version,
    })),

    /* One rollout, one row per site it lands at (V-06). */
    waves: waves.map((w) => ({
      id: w.id, project: w.project_id, site: w.site_id, seq: w.seq,
      plannedOn: w.planned_on, actualOn: w.actual_on, status: w.status,
      note: w.note, version: w.row_version,
    })),
    programmes: programmes.map((p) => ({
      id: p.id, name: p.name, sponsor: p.sponsor, managerId: p.manager_id,
      origin: p.origin ?? "local", version: p.row_version,
    })),
    people: people.map((p) => ({
      id: p.id, name: p.name, role: p.job_role, site: p.site_id,
      rate: Number(p.day_rate),
      /* How this person actually works (V-09): a fly-in engineer on four
         weeks on, two off is not 1.0 FTE for fifty-two weeks. */
      employment: p.employment ?? "staff", rotation: p.rotation ?? "",
      availability: p.availability ?? 100, supplier: p.supplier ?? "",
      version: p.row_version,
    })),

    projects: projectRows.map((p) => ({
      id: p.id, name: p.name, programme: p.programme_id, site: p.site_id,
      governanceLevel: p.governance_level,
      pm: p.pm_id, method: p.method,
      start: p.start_date, finish: p.finish_date, baselineFinish: p.baseline_finish,
      budget: toM(p.budget), contingency: toM(p.contingency),
      contingencyUsed: toM(p.contingency_used),
      desc: p.description, phase: p.phase, gate: p.gate,
      healthOverride: p.health_override, healthOverrideWhy: p.health_override_why,
      closed: p.closed, origin: p.origin ?? "local",
      // the post-implementation verdict, where one has been given (V-01)
      pirOn: p.pir_on ?? null, pirVerdict: p.pir_verdict ?? null, pirNote: p.pir_note ?? "",
      /* PM-08 — les trois signatures de la clôture. */
      opsAcceptedBy: p.ops_accepted_by ?? null, benefitsTo: p.benefits_owner_id ?? null,
      closureNote: p.closure_note ?? "", closedOn: p.closed_on ?? null,
      // what this reaches into, and whether it has been released (V-03)
      plantImpact: p.plant_impact ?? "none", mocRef: p.moc_ref ?? "",
      mocApprovedOn: p.moc_approved_on ?? null, mocApprovedBy: p.moc_approved_label ?? "",
      // where it sits in the queue, and why (V-04)
      fit: p.fit_score ?? null, value: p.value_score ?? null,
      risk: p.risk_score ?? null, effort: p.effort_score ?? null,
      rank: p.rank_seq ?? null,
      version: p.row_version,
    })),

    /* Benefits carry their own unit — percent, hours, ounces, currency —
       so unlike every money field above they are passed through as they
       are stored, never divided by M. */
    benefits: benefits.map((b) => ({
      id: b.id, project: b.project_id, kind: b.kind, title: b.title, detail: b.detail,
      measure: b.measure, unit: b.unit,
      baseline: b.baseline === null ? null : Number(b.baseline),
      target: b.target === null ? null : Number(b.target),
      actual: b.actual === null ? null : Number(b.actual),
      owner: b.owner_id, realiseOn: b.realise_on, measuredOn: b.measured_on,
      status: b.status, version: b.row_version,
    })),

    activities: activities.map((a) => ({
      id: a.id, project: a.project_id, name: a.name, stage: a.stage,
      start: a.start_date, end: a.end_date, baseStart: a.base_start, baseEnd: a.base_end,
      weight: Number(a.weight), pct: a.pct, owner: a.owner_id,
      deps: depsByActivity.get(a.id) ?? [],
      origin: a.origin ?? "local", version: a.row_version,
    })),

    milestones: milestones.map((m) => ({
      id: m.id, project: m.project_id, name: m.name, date: m.due_date,
      baseDate: m.base_date, gate: m.gate, kind: m.kind, owner: m.owner_id,
      done: m.done, intrusive: m.intrusive === true,
      /* PM-04 — les critères posés d'avance, et qui a constaté. */
      acceptanceCriteria: m.acceptance_criteria ?? "",
      acceptedBy: m.accepted_by ?? null, acceptedOn: m.accepted_on ?? null,
      origin: m.origin ?? "local", version: m.row_version,
    })),

    ledger: ledger.map((l) => ({
      id: String(l.id), project: l.project_id, period: l.period,
      bookedOn: l.booked_on, amount: toM(l.amount),
      category: l.category, note: l.note,
      fromContingency: l.from_contingency, createdBy: l.created_by,
      /* PM-06 — le risque que ce tirage finance. */
      risk: l.risk_id ?? null,
      // capex or opex, and what was actually spent before conversion (V-05)
      kind: l.kind ?? "capex", currency: l.currency ?? "USD",
      fx: l.fx_rate === null ? 1 : Number(l.fx_rate),
      amountLocal: l.amount_local === null ? null : toM(l.amount_local),
      reversal: /^Reversal of #/.test(l.note ?? ""),
    })),

    /* The actual effort, beside the plan and never inside it (R-03). */
    timesheets: timesheets.map((x) => ({
      id: String(x.id), person: x.person_id, project: x.project_id,
      week: x.week_start, days: Number(x.days), enteredBy: x.entered_by,
      version: x.row_version,
    })),

    /* PM-01 — la marge dans laquelle chaque projet peut travailler.
       Une seule active par projet ; les précédentes restent en base pour
       qu'on puisse relire sous quelle marge une décision a été prise. */
    tolerances: tolerances.map((x) => ({
      id: x.id, project: x.project_id,
      scheduleDays: x.schedule_days, costPct: x.cost_pct == null ? null : Number(x.cost_pct),
      benefitPct: x.benefit_pct == null ? null : Number(x.benefit_pct),
      note: x.note, setBy: x.set_by, setOn: x.set_on, version: x.row_version,
    })),

    /* Les dépassements constatés. Une exception ne se referme jamais
       toute seule : la prévision peut repasser sous la limite, elle reste
       ouverte tant que personne n'a dit ce qu'il en faisait. */
    exceptions: exceptions.map((x) => ({
      id: x.id, project: x.project_id, tolerance: x.tolerance_id,
      dimension: x.dimension, raisedOn: x.raised_on,
      measured: Number(x.measured), allowed: Number(x.allowed), detail: x.detail,
      status: x.status, answerKind: x.answer_kind, answer: x.answer,
      answeredBy: x.answered_by, answeredOn: x.answered_on, version: x.row_version,
    })),

    /* PM-03 — le cas d'affaire : la justification, ses deux chiffres,
       et si elle a été reconfirmée depuis sa dernière modification. */
    businessCases: caseRows.map((c) => ({
      id: c.id, project: c.project_id, summary: c.summary,
      expectedCost: c.expected_cost == null ? null : toM(c.expected_cost),
      expectedBenefit: c.expected_benefit == null ? null : toM(c.expected_benefit),
      basis: c.basis, writtenBy: c.written_by, writtenOn: c.written_on,
      updatedOn: c.updated_on,
      reconfirmedGate: c.reconfirmed_gate, reconfirmedOn: c.reconfirmed_on,
      reconfirmedBy: c.reconfirmed_by,
      /* Reconfirmé, puis modifié : la reconfirmation ne couvre plus ce
         qui est écrit. Codé par l'ORDRE des événements, pas par
         l'horloge : reconfirmer efface updated_on, réviser le repose —
         deux dates du même jour ne savent pas dire qui fut premier. */
      staleSinceReconfirm: !!(c.reconfirmed_on && c.updated_on),
      version: c.row_version,
    })),

    /* PM-02 — ce qu'on a appris, et qui doit survivre au projet.
       `project` n'est renseigné que si le lecteur voit déjà ce projet :
       un enseignement adopté circule dans tout le groupe, mais il ne
       sert pas de canal pour apprendre l'existence d'un projet qu'on
       n'a pas le droit de voir (R1.10). Le programme et le site, eux,
       sont de la donnée de référence que tout le monde lit déjà. */
    lessons: lessonRows.map((l) => ({
      id: l.id,
      project: idSet.has(l.project_id) ? l.project_id : null,
      programme: l.programme_id, site: l.site_id, gate: l.gate_n,
      category: l.category, title: l.title,
      whatHappened: l.what_happened, why: l.why,
      recommendation: l.recommendation, outcome: l.outcome,
      raisedBy: l.raised_by, raisedOn: l.raised_on,
      status: l.status, adoptedBy: l.adopted_by, adoptedOn: l.adopted_on,
      version: l.row_version,
    })),

    /* Money promised and not yet spent (V-05). */
    commitments: commitments.map((c) => ({
      id: c.id, project: c.project_id, reference: c.reference, supplier: c.supplier,
      desc: c.description, amount: toM(c.amount), currency: c.currency,
      fx: Number(c.fx_rate), kind: c.kind, raisedOn: c.raised_on,
      expectedOn: c.expected_on, status: c.status, version: c.row_version,
    })),

    raid: raidRows
      .filter((r) => !r.project_id || idSet.has(r.project_id))
      .map((r) => ({
        id: r.id, project: r.project_id, type: r.kind, title: r.title, detail: r.detail,
        p: r.probability, i: r.impact, status: r.status, response: r.response,
        /* PM-06 — ce que la réponse est censée OBTENIR. Nul quand la
           stratégie est Accept/Monitor : un constat assumé n'a pas de
           cible, et forcer un chiffre inventé serait une fausse
           assurance. */
        tp: r.target_probability, ti: r.target_impact,
        owner: r.owner_id, opened: r.opened_on, review: r.review_on,
        originSite: r.origin_site ?? null,   // a site concern names its raising site
        version: r.row_version,
      })),

    crs: crRows.map((c) => ({
      id: c.id, project: c.project_id, title: c.title, desc: c.description,
      raisedBy: c.raised_by, raisedByUser: c.raised_by_user, raised: c.raised_on,
      cost: toM(c.cost_delta), weeks: c.weeks_delta, funding: c.funding,
      riskDelta: c.risk_delta, status: c.status, applied: c.applied,
      steps: stepsByCr.get(c.id) ?? [],
      version: c.row_version,
    })),

    allocations: allocations.map((a) => ({
      id: String(a.id), person: a.person_id, project: a.project_id,
      from: a.from_date, to: a.to_date, pct: a.pct,
      // capitalised effort is not the same money as expensed (V-05/V-09)
      capitalised: a.capitalised !== false,
      version: a.row_version,
    })),

    docs: docs
      .filter((d) => !d.project_id || idSet.has(d.project_id))
      .map((d) => ({
        id: d.id, project: d.project_id, name: d.name, type: d.doc_type,
        gate: d.gate, owner: d.owner_id, rev: d.revision, status: d.status,
        updated: d.updated_on,
        /* R-01 / R-13 — the artefact, its frozen address, its lineage. */
        uri: d.uri ?? "", uriHash: d.uri_locked_hash ?? "",
        uriLockedOn: d.uri_locked_on ?? null, supersedes: d.supersedes ?? null,
        /* N-07 — un fait, jamais un jugement : la bibliothèque montre si
           le lien répondait au dernier passage, et le statut reste celui
           que des humains ont posé. */
        probeState: d.probe_state ?? "never", probedAt: d.probed_at ?? null,
        version: d.row_version,
      })),

    columns: columns.map((c) => ({ id: c.id, name: c.name, wip: c.wip })),

    items: items.map((i) => ({
      id: i.id, project: i.project_id, column: i.column_id, title: i.title,
      assignee: i.assignee_id, points: i.points, priority: i.priority,
      created: i.created_on, version: i.row_version,
    })),

    crossDeps: crossDeps.map((c) => ({
      from: c.from_project, fromStage: c.from_stage,
      to: c.to_project, toStage: c.to_stage, label: c.label,
    })),

    /* SDP-linked items (ext_link, 005). Read-only display caches — the
       linked system remains the record; Meridian holds the association. */
    extLinks: extLinks.map((l) => ({
      id: l.id, source: l.source, extId: l.ext_id,
      project: l.project_id, activity: l.activity_id, site: l.site_id,
      title: l.title_cache, status: l.status_cache, kind: l.kind_cache,
      risk: l.risk_cache, due: l.due_cache, windowStart: l.window_start,
      linkedBy: l.linked_by, linkedAt: l.linked_at, syncedAt: l.synced_at,
      stale: l.stale, version: l.row_version,
    })),

    settings,
    narrative,
  };
}

/** A single project row with the fields RBAC needs, or null. */
export async function projectFor(id) {
  return one(
    `SELECT id, programme_id, site_id, governance_level, closed, origin, row_version
       FROM project WHERE id = $1`,
    [id]
  );
}

/** Resolve-and-authorise helper used by the route guards. */
export async function requireVisibleProject(user, id) {
  const p = await projectFor(id);
  if (!p) return { error: 404, message: "No such project" };
  if (!canSeeProject(user, p)) return { error: 404, message: "No such project" };
  return { project: p };
}

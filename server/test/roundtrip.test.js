/**
 * F13 · THE BOOK COMES BACK  (docs/36 C-05)
 *
 * On 23/09 the product anyone cloned could not import its own export, and
 * three field programmes had each found that out for themselves. The
 * campaign's probe asked one question — does the import answer 200 — and
 * the answer turned out to be the wrong question: measured the same day,
 * the export wrote fifteen collections the importer never read, and a
 * cost line came back with a new id and the note "Imported". Every probe
 * had passed, because the seeded book holds none of those rows.
 *
 * So this gate asks three things, and none of them is "200":
 *
 *   1. Every collection the export writes is read by the importer — or it
 *      is named below, with the line that will close it, or declared not
 *      to be book data at all. Derived from the two sources, not from a
 *      hand list of collections: a collection added to the export tomorrow
 *      fails here until someone decides what the import does with it.
 *   2. Export → import → export gives back the same book, field for field,
 *      except the losses named below.
 *   3. A named loss that no longer happens FAILS too. The list can only
 *      shrink, and it shrinks in the commit that fixes it — a debt list
 *      that nobody has to update is a list that stops being true.
 *
 * The known losses belong to NEW-05 (docs/36, wave 1): the import was
 * written before those registers existed, and nobody extended it.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, shutdown, as } from "./harness.js";
import { query } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* Not book data: who is asking, and what they may see. */
const NOT_BOOK = new Set(["currentUser", "viewer"]);

/* Exported and never imported: each would be erased by an import. NEW-05
   emptied this list (15 collections, from absences to windows). It stays,
   empty, so that the next register added to the export without its
   import has somewhere to be named — and the gate still fails until it is. */
const KNOWN_LOST_COLLECTIONS = new Set([]);

/* Fields that come back different. NEW-05 emptied this list too (38
   fields: the ledger's identity and wording, a programme's ladder, a
   person's contract, a project's review, scores and date basis, …) and
   the enrichment below now gives every exported column of every imported
   table a value that is not its default, so an empty list is measured,
   not assumed. */
const KNOWN_LOST_FIELDS = new Set([]);

/* Collections the import reads that the probed book cannot hold a row of,
   each with its reason. Shrink-only, like the two lists above.
   NEW-14 emptied it: `objections` was here because an objection cites a
   meeting decision and the meeting register was not in the book, so the
   decision was never there to be cited. The register is book data now,
   and ENRICH objects to a decision it carries. */
const NOT_EXERCISED = new Set([]);

const importer = readFileSync(new URL("../src/import.js", import.meta.url), "utf8");
const read = new Set([...importer.matchAll(/\bbook\??\.(\w+)/g)].map((m) => m[1]));

/* Every leaf that differs, named by its path with indices folded.
   `skip` names keys compared elsewhere, by a rule of their own. */
function differences(a, b, path = "", out = new Map(), skip = null) {
  if (skip && skip.has(path.split(".").pop())) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const bothObjects = a && b && typeof a === "object" && typeof b === "object";
  if (bothObjects && Array.isArray(a) === Array.isArray(b) &&
      (!Array.isArray(a) || a.length === b.length)) {
    const keys = Array.isArray(a) ? a.keys() : new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) differences(a[k], b[k], Array.isArray(a) ? `${path}[]` : `${path}${path ? "." : ""}${k}`, out, skip);
    return out;
  }
  if (!out.has(path)) out.set(path, `${JSON.stringify(a)?.slice(0, 60)} → ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
}

/* A round trip only proves what the book holds, and the seeded book holds
   defaults: no expensed allocation, no euro cost line, no programme ladder
   — and not one row of fifteen registers. So before exporting, every
   imported table is given a value that is NOT its default in every column
   the export writes: an UPDATE of one seeded row where the seed has rows,
   an INSERT of one realistic row where it has none. Without this the gate
   passes on the very losses it exists to catch — measured: dropping
   `capitalised` from the import went unseen until this block existed, and
   the fifteen registers passed as "imported" on empty lists.
   The last test of this file checks the block did its job: every key of
   every collection the import reads must hold a non-empty value in at
   least one row. */
const P1 = `(SELECT min(id) FROM project)`;
const PE1 = `(SELECT min(id) FROM person)`;
const PE2 = `(SELECT max(id) FROM person)`;
const SITE = `(SELECT min(id) FROM site)`;
const USER = `(SELECT min(id) FROM app_user)`;
/* REQ-48 — the seed now writes business cases and tolerances of its own
   (CAS-001…, TOL-001…, and the EXC rows the sweep raises), and a project
   has one case. The value rows below therefore take ids of their own
   (…-901) and a project that the SEED left without a case or tolerance,
   rather than colliding with the demonstration book. The ids of this
   file's own rows are excluded so the choice does not move once they are
   written. Every field they exercise is exercised as before. */
const PV = `(SELECT min(id) FROM project
              WHERE id NOT IN (SELECT project_id FROM business_case WHERE id <> 'CAS-901')
                AND id NOT IN (SELECT project_id FROM project_tolerance WHERE id <> 'TOL-901'))`;
const ENRICH = [
  /* An integration is not book data (the import never writes one), so it
     survives the import, and every `externalSource` that names it must
     come back naming it. */
  `INSERT INTO integration (id, name, key_hash) VALUES ('INT-RT', 'Round-trip probe', 'x')`,
  `UPDATE allocation SET capitalised = false WHERE id = (SELECT min(id) FROM allocation)`,
  `UPDATE cost_line SET kind = 'opex', currency = 'EUR', fx_rate = 1.1, amount_local = round(amount * 1.1, 2),
          from_contingency = true, category = 'Contract', booked_on = (period || '-17')::date,
          note = 'Round-trip probe', created_by = ${USER},
          risk_id = (SELECT min(id) FROM raid_item)
    WHERE id = (SELECT min(id) FROM cost_line)`,
  // a correction is a reversing entry (CONTRIBUTING), and the export says which lines are
  `INSERT INTO cost_line (project_id, period, booked_on, amount, category, note)
   SELECT project_id, period, booked_on, -amount, category, 'Reversal of #' || id || ' — mis-posted'
     FROM cost_line WHERE id = (SELECT max(id) FROM cost_line)`,
  /* PR-04 — a signed step names who signed it (the person since 056,
     the account since 002), and the one-signatory rule reads both. */
  `UPDATE change_step SET comment = 'Approved subject to the vendor quote',
          decided_by = ${USER}, decided_by_person = ${PE1}
    WHERE id = (SELECT min(id) FROM change_step)`,
  `UPDATE document SET supersedes = (SELECT max(id) FROM document)
    WHERE id = (SELECT min(id) FROM document)`,
  `UPDATE work_item SET source = 'Gate 2 review', score = 42.5, score_method = 'RICE'
    WHERE id = (SELECT max(id) FROM work_item)`,
  `UPDATE project SET closed = true WHERE id = (SELECT max(id) FROM project)`,
  /* NEW-18 — a closed project still sits on the site it was delivered at,
     under the programme that ran it, after both have been closed; and a
     risk still names the leaver who owned it. The export wrote only
     ACTIVE sites, programmes and people, so each of these pointers was
     refused on the way back in. */
  `INSERT INTO site (id, city, region, tz_offset, tz_name, headcount, fte, charter, active)
   VALUES ('OLD', 'Obuasi', 'West Africa', 0, 'GMT', 12, 10, 'Closed 2025 — site office', false)`,
  `INSERT INTO programme (id, name, sponsor, manager_id, active)
   VALUES ('OLDP', 'Legacy estate exit', 'Group CFO', ${PE1}, false)`,
  `UPDATE project SET site_id = 'OLD', programme_id = 'OLDP' WHERE id = (SELECT max(id) FROM project)`,
  `INSERT INTO person (id, name, job_role, site_id, day_rate, active)
   VALUES ('PE-901', 'A. Leaver', 'Risk manager', 'OLD', 600, false)`,
  `UPDATE raid_item SET owner_id = 'PE-901' WHERE id = (SELECT max(id) FROM raid_item)`,
  `UPDATE programme SET gate_model = '[{"n":1,"name":"Idea","at":0.1,"owner":"Sponsor","evidence":"Charter"},
          {"n":2,"name":"Build","at":0.5,"owner":"PMO","evidence":"","loopsTo":1}]'::jsonb,
          origin = 'sdp'
    WHERE id = (SELECT min(id) FROM programme)`,
  `UPDATE site SET country = 'BF', legal_entity = 'Probe Mining SA', link_mbps = 12.5,
          link_kind = 'VSAT', readiness = 'Preparing', readiness_note = 'probe',
          champion_id = ${PE1}
    WHERE id = ${SITE}`,
  /* D-36.13 (060) — a team: kind 'team', and NO timezone. The absent
     timezone must come back absent (null), not as the UTC that #18 was
     about, and the kind must come back a team. */
  `INSERT INTO site (id, city, region, kind, tz_offset, tz_name, charter)
   VALUES ('SQD', 'Payments squad', '', 'team', NULL, NULL, 'A delivery squad, located nowhere')`,
  `UPDATE project SET pir_on = '2026-01-15', pir_verdict = 'Partly met', pir_note = 'probe',
          plant_impact = 'plant', moc_ref = 'MOC-1', fit_score = 3, value_score = 4, risk_score = 2,
          effort_score = 5, rank_seq = 7, closure_note = 'probe', date_basis = 'placeholder',
          condition = 'probe condition', acceptance_criteria = 'probe criteria', scaffolded_gates = 4,
          health_override = 'A', health_override_why = 'probe override', origin = 'sdp',
          ops_accepted_by = ${PE1}, benefits_owner_id = ${PE2}, closed_on = '2026-02-01',
          sponsor_id = ${PE1}, moc_approved_on = '2026-01-10', moc_approved_label = 'Plant manager',
          external_source = 'INT-RT', external_id = 'EXT-P1'
    WHERE id = ${P1}`,
  `UPDATE milestone SET intrusive = true, acceptance_criteria = 'probe', date_basis = 'placeholder',
          condition = 'probe', accepted_by = ${PE1}, accepted_on = '2026-03-02', retired_gate = 2,
          origin = 'sdp', external_source = 'INT-RT', external_id = 'EXT-M1'
    WHERE id = (SELECT min(id) FROM milestone)`,
  `UPDATE person SET employment = 'contractor', rotation = '4/2', availability = 80, supplier = 'Acme'
    WHERE id = ${PE1}`,
  `UPDATE raid_item SET target_probability = 1, target_impact = 1, category = 'probe',
          gate = 2, cr_id = (SELECT min(id) FROM change_request), closed_on = '2026-04-01',
          closed_by = ${PE1}, origin_site = ${SITE}, external_source = 'INT-RT', external_id = 'EXT-R1'
    WHERE id = (SELECT min(id) FROM raid_item)`,
  /* D-36.15 (059) — a standing human act that blocked its gate and
     closed on its evidence: the flag and the locator both come back. */
  `UPDATE raid_item SET blocks_gate = true, gate = 1, category = 'Human act', status = 'Closed',
          closed_on = '2026-05-02', closure_evidence = 'docs/evidence/H-03.md@a1b2c3d'
    WHERE id = (SELECT min(id) FROM raid_item WHERE kind = 'Dependency' AND project_id IS NOT NULL)`,
  `UPDATE activity SET progress_source = 'probe', progress_at = '2026-08-20T08:30:00Z', origin = 'sdp',
          external_source = 'INT-RT', external_id = 'EXT-A1'
    WHERE id = (SELECT min(id) FROM activity)`,
  /* FX-05 (062) — a three-level breakdown: a summary over a summary over
     a stage. The summaries are stored with no weight and no progress of
     their own and with the window their child shows, which is what the
     book carries for them and what the import stores back. */
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct)
   VALUES ('RT-W1', ${P1}, 'Round-trip summary', 90, '2026-03-02', '2026-03-20', '2026-03-02', '2026-03-20', 0, 0)`,
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct, parent_id)
   VALUES ('RT-W2', ${P1}, 'Round-trip sub-summary', 91, '2026-03-02', '2026-03-20', '2026-03-02', '2026-03-20', 0, 0, 'RT-W1')`,
  `INSERT INTO activity (id, project_id, name, stage, start_date, end_date, base_start, base_end, weight, pct, parent_id)
   VALUES ('RT-W3', ${P1}, 'Round-trip work package', 92, '2026-03-02', '2026-03-20', '2026-03-02', '2026-03-20', 0.02, 30, 'RT-W2')`,
  /* FX-07 (062) — a named baseline, with a row that names its parent. */
  `INSERT INTO baseline_snapshot (id, project_id, name, taken_at, taken_by, reason)
   VALUES ('BSL-901', ${P1}, 'Approved plan', '2026-08-01T09:00:00Z', ${USER}, 'Gate 2 sign-off')`,
  `INSERT INTO baseline_snapshot_row (snapshot_id, activity_id, name, parent_id, start_date, end_date, weight)
   SELECT 'BSL-901', id, name, parent_id, start_date, end_date, weight FROM activity WHERE project_id = ${P1}`,
  `UPDATE change_request SET raised_by_user = ${USER} WHERE id = (SELECT min(id) FROM change_request)`,
  `UPDATE document SET probe_state = 'ok', probed_at = '2026-08-21T06:00:00Z'
    WHERE id = (SELECT min(id) FROM document)`,
  `UPDATE work_item SET external_source = 'INT-RT', external_id = 'EXT-W1'
    WHERE id = (SELECT min(id) FROM work_item)`,

  /* The governance registers (MER-03/05/06/11) — empty in the seed. */
  `INSERT INTO requirement (id, project_id, statement, source, priority, verification, verified_by,
                           gate_n, status, waiver_reason, owner_id, updated_on)
   VALUES ('REQ-901', ${P1}, 'The crusher PLC reports within 2 s', 'Operations charter', 'S',
           'Site acceptance test', 'SAT-14 report', 2, 'Waived', 'Superseded by the new PLC',
           ${PE1}, '2026-05-05')`,
  `INSERT INTO evidence (id, project_id, document_id, kind, name, uri, digest, gate_n, gate_loop,
                        captured_on, captured_by)
   VALUES ('EV-901', ${P1}, (SELECT min(id) FROM document), 'ci_run', 'Nightly build 412',
           'https://ci.example/run/412', 'sha256:ab12', 2, 2, '2026-05-06', ${PE1})`,
  `INSERT INTO finding (id, project_id, requirement_id, gate_n, gate_loop, observed_fact,
                       why_it_matters, severity, owner_id, proposed_fix, raised_on, retest_on,
                       status, closed_evidence_id, waiver_reason)
   VALUES ('FND-901', ${P1}, 'REQ-901', 2, 2, 'Latency measured at 3.4 s', 'Operators act late',
           'S1', ${PE2}, 'Move the poller', '2026-05-07', '2026-05-20', 'Closed', 'EV-901',
           'Re-tested on the new PLC')`,
  /* NEW-24 — portfolio-wide rows (no project): KODO's generator emits
     requirements for modules it has no project for yet (FR-M20-01…). */
  `INSERT INTO requirement (id, project_id, statement, source, priority, verification, verified_by,
                           gate_n, status, waiver_reason, owner_id, updated_on)
   VALUES ('REQ-902', NULL, 'Every module declares its data retention', 'Group policy', 'M',
           'Document review', 'Retention register', 1, 'In progress', '', ${PE1}, '2026-05-08')`,
  `INSERT INTO evidence (id, project_id, document_id, kind, name, uri, digest, gate_n, gate_loop,
                        captured_on, captured_by)
   VALUES ('EV-902', NULL, NULL, 'document', 'Retention register v2',
           'docs/policy/retention.md@c0ffee1', 'sha256:cd34', 1, 1, '2026-05-09', ${PE1})`,
  `INSERT INTO finding (id, project_id, requirement_id, gate_n, gate_loop, observed_fact,
                       why_it_matters, severity, owner_id, proposed_fix, raised_on, retest_on,
                       status, closed_evidence_id, waiver_reason)
   VALUES ('FND-902', NULL, 'REQ-902', 1, 1, 'Two modules keep logs forever', 'Retention policy breached',
           'S2', ${PE2}, 'Add a purge job', '2026-05-10', '2026-05-24', 'Open', NULL, '')`,
  `INSERT INTO seat (id, name, person_id, domain, veto_domain, observer, active)
   VALUES ('SE-901', 'Safety officer', ${PE1}, 'safety', 'safety', true, false),
          ('SE-902', 'Architect', ${PE2}, 'architecture', NULL, false, true)`,
  `INSERT INTO seat_conflict (seat_id, other_id, reason)
   VALUES ('SE-901', 'SE-902', 'designer cannot veto own design'),
          ('SE-902', 'SE-901', 'designer cannot veto own design')`,
  /* D-36.12 — a document names the seat expected to approve it. */
  `UPDATE document SET expected_seat_id = 'SE-902' WHERE id = (SELECT min(id) FROM document)`,

  /* NEW-05 — the fifteen registers, one realistic row each. */
  `INSERT INTO site_window (id, site_id, kind, label, detail, starts_on, ends_on)
   VALUES ('SW-01', ${SITE}, 'freeze', 'Year-end freeze', 'No change to plant systems', '2026-12-15', '2027-01-05')`,
  `INSERT INTO person_absence (id, person_id, starts_on, ends_on, reason, deputy_id, note)
   VALUES ('ABS-001', ${PE1}, '2026-09-01', '2026-09-14', 'training', ${PE2}, 'HV authorisation course')`,
  `INSERT INTO benefit (id, project_id, kind, title, detail, measure, unit, baseline, target, actual,
                       owner_id, realise_on, measured_on, status, external_source, external_id)
   VALUES ('BEN-901', ${P1}, 'Availability', 'Mill availability', 'Fewer unplanned stops',
           'Monthly availability', '%', 91.5, 96, 94.25, ${PE2}, '2026-12-31', '2026-08-31',
           'Partially realised', 'INT-RT', 'EXT-B1')`,
  `INSERT INTO rollout_wave (id, project_id, site_id, seq, planned_on, actual_on, status, note)
   VALUES ('WAVE-001', ${P1}, ${SITE}, 2, '2026-10-01', '2026-10-03', 'Live', 'Cut over on night shift')`,
  `INSERT INTO commitment (id, project_id, reference, supplier, description, amount, currency, fx_rate,
                          kind, raised_on, expected_on, status)
   VALUES ('CMT-001', ${P1}, 'PO-4411', 'Acme Automation', 'PLC hardware', 250000.5, 'EUR', 1.08,
           'opex', '2026-06-01', '2026-09-30', 'Part received')`,
  `INSERT INTO timesheet (id, person_id, project_id, week_start, days, entered_by)
   VALUES (7, ${PE1}, ${P1}, '2026-08-24', 3.5, ${USER})`,
  `INSERT INTO project_tolerance (id, project_id, schedule_days, cost_pct, benefit_pct, note, set_by, set_on)
   VALUES ('TOL-901', ${PV}, 10, 7.5, 12.5, 'Board delegation', ${USER}, '2026-07-01')`,
  `INSERT INTO project_exception (id, project_id, tolerance_id, dimension, raised_on, measured, allowed,
                                 detail, status, answer_kind, answer, answered_by, answered_on)
   VALUES ('EXC-901', ${PV}, 'TOL-901', 'cost', '2026-08-02', 9.25, 7.5, 'Forecast over by 1.75 pts',
           'Answered', 'Plan revised', 'Scope of wave 3 deferred', ${USER}, '2026-08-09')`,
  `INSERT INTO business_case (id, project_id, summary, expected_cost, expected_benefit, value_confidence,
                             basis, written_by, written_on, updated_on, reconfirmed_gate,
                             reconfirmed_on, reconfirmed_by, external_source, external_id)
   VALUES ('CAS-901', ${PV}, 'Replace the crusher PLC', 1234567.89, 2500000, 4, 'Vendor quote Q-88',
           ${USER}, '2026-01-05', '2026-06-10', 2, '2026-05-01', ${USER}, 'INT-RT', 'EXT-C1')`,
  `INSERT INTO case_reconfirmation (id, case_id, project_id, gate, expected_cost, expected_benefit,
                                   verdict, note, reconfirmed_by, reconfirmed_on)
   VALUES ('CRC-001', 'CAS-901', ${PV}, 2, 1200000, 2400000.5, 'Continue with conditions',
           'Hold the contingency', ${PE1}, '2026-05-01')`,
  `INSERT INTO lesson (id, project_id, programme_id, site_id, gate_n, category, title, what_happened,
                      why, recommendation, outcome, raised_by, raised_on, status, adopted_by, adopted_on)
   VALUES ('LSN-001', ${P1}, (SELECT min(id) FROM programme), ${SITE}, 2, 'Procurement',
           'Order long-lead PLCs at gate 1', 'Hardware arrived late', 'Ordered after design freeze',
           'Order at gate 1 on a cancellable PO', 'Positive', ${PE1}, '2026-06-15', 'Adopted',
           ${USER}, '2026-06-20')`,
  `INSERT INTO gate_criterion (id, project_id, gate, seq, text, document_id, met, reviewed_by,
                              reviewed_on, note, external_source, external_id)
   VALUES ('GC-1', ${P1}, 2, 3, 'FAT passed', (SELECT min(id) FROM document), true, ${PE1},
           '2026-04-02', 'Witnessed', 'INT-RT', 'EXT-G1')`,
  `INSERT INTO stakeholder (id, project_id, person_id, name, organisation, role_label, interest,
                           influence, attitude, engagement, owner_id, note)
   VALUES ('STK-1', ${P1}, ${PE2}, 'Plant manager', 'Operations', 'Accountable', 5, 4, 'Champion',
           'Partner', ${PE1}, 'Weekly one-to-one')`,
  `INSERT INTO comms_plan (id, project_id, audience, purpose, channel, frequency, owner_id, next_on, note)
   VALUES ('COM-1', ${P1}, 'Shift supervisors', 'Cut-over readiness', 'Toolbox talk', 'Weekly',
           ${PE1}, '2026-09-07', 'French and Mooré')`,
  `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, site_id, title_cache, status_cache,
                        kind_cache, risk_cache, due_cache, window_start, linked_by, linked_at,
                        synced_at, stale)
   VALUES ('XL-1', 'inspection', 'INS-77', ${P1}, (SELECT min(id) FROM activity), ${SITE},
           'Crusher guard inspection', 'Open', 'Inspection', 'High', '2026-09-10', '2026-09-08',
           ${USER}, '2026-08-01T10:00:00Z', '2026-08-02T10:00:00Z', true)`,
  /* D-36.14 — repository references: a pull request on a stage with the
     state an integration reported, an issue on a RAID row, and a
     criterion's commit citation superseded by a second one (REQ-29). */
  `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, site_id, title_cache, url, state,
                        state_at, state_source, linked_by, external_source, external_id)
   VALUES ('XL-2', 'pull_request', 'fitadapt/app#17', ${P1},
           (SELECT min(id) FROM activity WHERE project_id = ${P1}), ${SITE}, 'Add a github source',
           'https://github.com/fitadapt/app/pull/17', 'merged', '2026-08-03T08:00:00Z', 'INT-RT',
           ${USER}, 'INT-RT', 'EXT-XL2')`,
  `INSERT INTO ext_link (id, source, ext_id, project_id, raid_id, site_id, title_cache, state, state_at, state_source)
   VALUES ('XL-3', 'issue', 'fitadapt/app#18', ${P1},
           (SELECT min(id) FROM raid_item WHERE project_id = ${P1}), ${SITE}, 'Flaky import', 'open',
           '2026-08-04T08:00:00Z', 'INT-RT')`,
  `INSERT INTO ext_link (id, source, ext_id, project_id, criterion_id, site_id, url, linked_by, superseded_at)
   VALUES ('XL-4', 'commit', 'rt365/ledger@abcdef1', ${P1}, 'GC-1', ${SITE},
           'https://github.com/rt365/ledger/commit/abcdef1', ${USER}, '2026-08-05T09:00:00Z')`,
  `INSERT INTO ext_link (id, source, ext_id, project_id, criterion_id, site_id, url, linked_by, supersedes)
   VALUES ('XL-5', 'commit', 'rt365/ledger@abcdef2', ${P1}, 'GC-1', ${SITE},
           'https://github.com/rt365/ledger/commit/abcdef2', ${USER}, 'XL-4')`,

  /* NEW-14 — the meeting register and the RAID reviews. The seed holds
     series, closed meetings with a roll, actions and one room decision;
     it holds no frozen agenda, no deputy, no per-gate series, no
     decision taken outside a room, no closed action, no review and no
     objection. One of each, every exported column given a value. */
  `INSERT INTO meeting_series (id, name, cadence, scope_kind, programme_id, site_id, chair_id, gate_n,
                              weekday, start_time, timebox_min, active)
   VALUES ('MS-G901', 'Gate 2 review board', 'per_gate', 'programme', (SELECT min(id) FROM programme),
           NULL, ${PE2}, 2, 0, '15:30', 75, false)`,
  `INSERT INTO agenda_item (occurrence_id, seq, section, section_key, headline, detail, entity,
                           entity_id, timebox_min, urgent)
   SELECT id, 0, 'Actions carried forward', 'actions', 'Overdue: confirm the ISO mapping',
          'Owner asked for a week', 'meeting_action', 'ACT-001', 10, true
     FROM meeting_occurrence WHERE status = 'closed' ORDER BY id LIMIT 1`,
  `INSERT INTO agenda_item (occurrence_id, seq, section, section_key, headline, detail, entity,
                           entity_id, timebox_min, urgent)
   SELECT id, 1, 'Decisions', 'decisions', 'Hold the cutover date', '', '', '', 5, false
     FROM meeting_occurrence WHERE status = 'closed' ORDER BY id LIMIT 1`,
  `INSERT INTO meeting_attendance (occurrence_id, person_id, state, deputy_for)
   SELECT id, ${PE2}, 'deputy', ${PE1}
     FROM meeting_occurrence WHERE status = 'closed' ORDER BY id LIMIT 1`,
  `INSERT INTO meeting_decision (id, occurrence_id, headline, rationale, alternatives, dissent,
                                project_id, cr_id, raid_id, milestone_id, decided_by, decided_on,
                                council, recorded_by, recorded_at, supersedes, supersedes_id,
                                reversal_cost, source_evidence_id, evidence_uri, provenance, status,
                                ratified_by, ratified_on, external_source, external_id)
   VALUES ('DEC-901', NULL, 'Defer wave 3 to the next freeze window', 'Plant shutdown moved',
           'Run wave 3 on nights', 'Operations would rather not', ${P1},
           (SELECT min(id) FROM change_request), (SELECT min(id) FROM raid_item),
           (SELECT min(id) FROM milestone), ${PE1}, '2026-07-14', 'Architecture board', ${USER},
           '2026-07-14T16:00:00Z', 'DEC-001', 'DEC-001', 'medium', 'EV-901',
           'https://docs.example/minutes/42', 'Board minutes 42', 'Ratified', ${PE2}, '2026-07-15',
           'INT-RT', 'EXT-D1')`,
  `UPDATE meeting_decision SET referred_to_scope = 'programme', answered_by = 'DEC-901'
    WHERE id = 'DEC-001'`,
  `UPDATE meeting_action SET status = 'Done', detail = 'Mapping confirmed with two banks',
          closed_in = (SELECT max(id) FROM meeting_occurrence WHERE status = 'closed'),
          closed_at = '2026-08-20T09:30:00Z', external_source = 'INT-RT', external_id = 'EXT-A901'
    WHERE id = 'ACT-001'`,
  `INSERT INTO raid_review (id, raid_id, reviewed_on, reviewed_by, note, due_on, next_review_on,
                           recorded_by, recorded_at, external_source, external_id)
   VALUES ('RVW-001', (SELECT min(id) FROM raid_item), '2026-08-03', ${PE1}, 'Still likely; owner chasing',
           '2026-08-01', '2026-08-17', ${USER}, '2026-08-04T07:00:00Z', 'INT-RT', 'EXT-V1')`,
  /* raised_by since 055 (NEW-04): who objected, a person of the directory. */
  `INSERT INTO decision_objection (id, decision_id, seat_id, domain, reason, raised_on, escalates_on,
                                  state, resolution, raised_by)
   VALUES ('OBJ-901', 'DEC-901', 'SE-901', 'safety', 'Night work on live plant needs a permit',
           '2026-07-15', '2026-07-22', 'resolved', 'Permit-to-work added to the plan', ${PE1})`,

  /* FX-01…FX-04 (061) — the schedule engine's inputs, none of which the
     seed sets (D-41.01): a working calendar with a holiday, made the
     group default and named by a site and a project; a project status
     date; a typed link with lag; a constraint, a deadline, actuals and
     remaining days on a stage. */
  `INSERT INTO work_calendar (id, name, work_days, is_default, note)
   VALUES ('CAL-901', 'Probe site calendar', 62, true, 'Monday to Friday, local holidays')`,
  `INSERT INTO work_calendar_exception (calendar_id, on_date, label) VALUES ('CAL-901', '2026-12-25', 'Christmas')`,
  `UPDATE site SET calendar_id = 'CAL-901' WHERE id = ${SITE}`,
  `UPDATE project SET calendar_id = 'CAL-901', status_date = '2026-08-20' WHERE id = ${P1}`,
  `UPDATE activity_dep SET type = 'SS', lag_days = -2
    WHERE (activity_id, predecessor_id) = (SELECT activity_id, predecessor_id FROM activity_dep
                                             ORDER BY activity_id, predecessor_id LIMIT 1)`,
  `UPDATE activity SET constraint_type = 'SNET', constraint_date = '2026-03-02', deadline = '2026-12-31',
          actual_start = start_date, actual_finish = start_date + 3, remaining_days = 4
    WHERE id = (SELECT min(id) FROM activity)`,
  /* docs/41 wave B (063) — an assignment of a named person with a typed
     work and a contract identity, one of a role with the work computed
     (null must come back null, not 0), and a rate by person in another
     currency with an end date beside one by role, open-ended. */
  `INSERT INTO assignment (id, activity_id, person_id, role_label, units, work_days, note,
                          external_source, external_id)
   VALUES ('ASG-901', (SELECT min(id) FROM activity), ${PE1}, '', 60, 7.5, 'Night shift only',
           'INT-RT', 'EXT-ASG1'),
          ('ASG-902', (SELECT min(id) FROM activity), NULL, 'Welder', 150, NULL, '', NULL, NULL)`,
  `INSERT INTO rate (id, person_id, role_label, day_rate, currency, fx_rate, effective_from,
                    effective_to, note)
   VALUES ('RATE-901', ${PE1}, '', 1250.5, 'EUR', 1.08, '2026-01-01', '2026-12-31', 'Framework contract 2026'),
          ('RATE-902', NULL, 'Welder', 480, 'USD', 1, '2026-03-01', NULL, '')`,
  /* FX-12 (064) — a scenario of every kind of change, applied under the
     decision that names it, and a second one still in draft. Every
     exported column given a value, the decision's link included. */
  `INSERT INTO scenario (id, name, note, status, created_by, created_on, applied_by, applied_on)
   VALUES ('SCN-901', 'Defer the core a quarter', 'Round-trip probe', 'Applied', ${USER}, '2026-07-01',
           ${USER}, '2026-07-20'),
          ('SCN-902', 'Draft what-if', '', 'Draft', ${USER}, '2026-07-02', NULL, NULL)`,
  `INSERT INTO scenario_change (id, scenario_id, seq, kind, project_id, weeks, amount, weight_input,
                               weight, base_version, base_value, note)
   VALUES ('SCC-901', 'SCN-901', 0, 'shift', ${P1}, 13, NULL, NULL, NULL, 4, NULL, 'A quarter later'),
          ('SCC-902', 'SCN-901', 1, 'budget', ${P1}, NULL, 2500000, NULL, NULL, 4, NULL, ''),
          ('SCC-903', 'SCN-901', 2, 'envelope', NULL, NULL, 30000000, NULL, NULL, NULL, 25000000, ''),
          ('SCC-904', 'SCN-901', 3, 'weight', NULL, NULL, NULL, 'value', 60, 1, NULL, ''),
          ('SCC-905', 'SCN-902', 0, 'cancel', ${P1}, NULL, NULL, NULL, NULL, 4, NULL, '')`,
  `UPDATE meeting_decision SET scenario_id = 'SCN-901' WHERE id = 'DEC-901'`,
];

describe("F13 · export → import → export", () => {
  let first, second, status, text;
  before(async () => {
    for (const sql of ENRICH) await query(sql);
    const admin = await as("admin");
    first = (await admin.get("/api/admin/export")).body;
    const r = await admin.post("/api/admin/import", { db: first });
    status = r.status; text = r.text;
    second = (await admin.get("/api/admin/export")).body;
  });

  test("the product imports its own export", () => {
    assert.equal(status, 200, text);
  });

  test("NEW-24 · a requirement, evidence or finding with no project travels and comes back", () => {
    for (const [list, id] of [["requirements", "REQ-902"], ["evidence", "EV-902"], ["findings", "FND-902"]]) {
      const a = (first[list] ?? []).find((x) => x.id === id);
      const b = (second[list] ?? []).find((x) => x.id === id);
      assert.ok(a, `${id} is in the export (it was left out: the export read only rows of visible projects)`);
      assert.ok(b, `${id} survives a replace of that export`);
      assert.equal(b.project ?? null, null, `${id} stays portfolio-wide`);
    }
  });

  test("NEW-18 · inactive sites, programmes and people travel, flagged, and stay inactive", async () => {
    assert.equal(first.sites.find((x) => x.id === "OLD")?.active, false);
    assert.equal(first.programmes.find((x) => x.id === "OLDP")?.active, false);
    assert.equal(first.people.find((x) => x.id === "PE-901")?.active, false);
    const risk = first.raid.find((x) => x.owner === "PE-901");
    assert.ok(risk, "the leaver's risk is in the book");
    assert.equal(second.raid.find((x) => x.id === risk.id)?.owner, "PE-901",
      "and comes back owned by the leaver, not refused");
    const held = await query(`SELECT
        (SELECT active FROM site WHERE id = 'OLD') AS site,
        (SELECT active FROM programme WHERE id = 'OLDP') AS prog,
        (SELECT active FROM person WHERE id = 'PE-901') AS person`);
    assert.deepEqual(held.rows?.[0] ?? held[0], { site: false, prog: false, person: false },
      "the import restores the flag: an inactive row does not come back active");
    /* …and the screens still do not offer them. */
    const boot_ = (await (await as("admin")).get("/api/bootstrap")).body.db;
    assert.ok(!boot_.sites.some((x) => x.id === "OLD"));
    assert.ok(!boot_.programmes.some((x) => x.id === "OLDP"));
    assert.ok(!boot_.people.some((x) => x.id === "PE-901"));
  });

  test("every collection the export writes is imported, or named with the line that will", () => {
    const unread = Object.keys(first).filter((k) =>
      !read.has(k) && !NOT_BOOK.has(k) && !KNOWN_LOST_COLLECTIONS.has(k));
    assert.deepEqual(unread, [],
      "the export writes these and the import never reads them — import them, or name them in " +
      "KNOWN_LOST_COLLECTIONS with the docs/36 line that closes them");
  });

  test("a collection the import now reads is struck off the known losses", () => {
    const healed = [...KNOWN_LOST_COLLECTIONS].filter((k) => read.has(k));
    assert.deepEqual(healed, [], "imported now — remove from KNOWN_LOST_COLLECTIONS");
    const gone = [...KNOWN_LOST_COLLECTIONS].filter((k) => !(k in first));
    assert.deepEqual(gone, [], "no longer exported — remove from KNOWN_LOST_COLLECTIONS");
  });

  /* NEW-19 — `version` is the one field a REPLACE must change: it is the
     concurrency token, not book data, and a replace that brought every
     row back at the version it was exported with (or at 1, before
     NEW-19) let a screen holding a pre-import version write over the
     import. So it is compared by its own rule, which is stricter than
     equality: every row that comes back is at a version strictly greater
     than the one the book was exported with. */
  const VERSION = new Set(["version"]);
  test("NEW-19 · every row comes back at a version past the one exported", () => {
    const pairs = [];
    const walk = (a, b, path) => {
      if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        a.forEach((x, i) => walk(x, b[i], `${path}[${i}]`));
      } else if (a && b && typeof a === "object" && typeof b === "object") {
        for (const k of Object.keys(a)) {
          if (k === "version" && typeof a[k] === "number") pairs.push([`${path}.${k}`, a[k], b[k]]);
          else walk(a[k], b[k], `${path}.${k}`);
        }
      }
    };
    walk(first, second, "");
    assert.ok(pairs.length > 100, "the book carries versions to compare");
    const notPast = pairs.filter(([, was, now]) => !(typeof now === "number" && now > was));
    assert.deepEqual(notPast, [], "a version a screen could hold from before the replace must not match");
  });

  test("the book comes back field for field, except the named losses", () => {
    const diff = differences(first, second, "", new Map(), VERSION);
    const unexplained = [...diff].filter(([p]) => !KNOWN_LOST_FIELDS.has(p));
    assert.deepEqual(unexplained, [],
      "these fields do not survive the round trip, and nobody has said so");
  });

  test("a named field loss that no longer happens is struck off", () => {
    const diff = differences(first, second, "", new Map(), VERSION);
    const healed = [...KNOWN_LOST_FIELDS].filter((p) => !diff.has(p));
    assert.deepEqual(healed, [], "survives now — remove from KNOWN_LOST_FIELDS");
  });

  /* NEW-05 — the round trip can only lose what the book holds. A register
     with no row, or a field that is null, empty or false in every row,
     "survives" whatever the importer does with it: that is how fifteen
     registers passed every probe on 23/09. So the probed book must hold,
     for every collection the import reads, at least one row, and for
     every field of it at least one value that is not blank. A field the
     export gains tomorrow fails here until ENRICH gives it a value. */
  test("the probed book exercises every field of every collection the import reads", () => {
    const blank = (v) => v === null || v === undefined || v === "" || v === false ||
      (Array.isArray(v) && !v.length);
    const unexercised = [];
    const walk = (rows, path) => {
      if (!rows.length) { unexercised.push(path); return; }
      const keys = new Set(rows.flatMap((r) => Object.keys(r)));
      for (const key of keys) {
        const values = rows.map((r) => r[key]);
        if (values.every(blank)) unexercised.push(`${path}[].${key}`);
        else if (values.some((v) => Array.isArray(v) && v.some((x) => x && typeof x === "object"))) {
          walk(values.flat().filter((x) => x && typeof x === "object"), `${path}[].${key}`);
        }
      }
    };
    for (const [k, rows] of Object.entries(first)) {
      if (!read.has(k) || NOT_BOOK.has(k) || !Array.isArray(rows)) continue;
      walk(rows, k);
    }
    const healed = [...NOT_EXERCISED].filter((p) => !unexercised.includes(p));
    assert.deepEqual(healed, [], "exercised now — remove from NOT_EXERCISED");
    assert.deepEqual(unexercised.filter((p) => !NOT_EXERCISED.has(p)), [],
      "these are exported and imported but the probed book holds no value for them — " +
      "give them one in ENRICH, or the round trip proves nothing about them");
  });
});

/* NEW-07 (docs/36) — the merge mode (MER-08) had never been run on the
   product's own export: `change_step` has no id the export writes, so the
   merge handle left its insert alone and the first step of the first
   change hit the (cr_id, seq) key — 400. `cross_dep` had no key at all
   and would have doubled every edge; `report_narrative` is keyed on its
   block. This runs after the suite above, on the enriched book it
   imported, so every register is exercised in merge mode too. */
describe("NEW-07 · the product's own export merges onto itself", () => {
  let before_, dry, merged, after_;
  before(async () => {
    const admin = await as("admin");
    before_ = (await admin.get("/api/admin/export")).body;
    dry = await admin.post("/api/admin/import?mode=merge&dryRun=1", { db: before_ });
    merged = await admin.post("/api/admin/import?mode=merge", { db: before_ });
    after_ = (await admin.get("/api/admin/export")).body;
  });

  test("merge-mode dry run of the product's own export answers 200", () => {
    assert.equal(dry.status, 200, dry.text);
    assert.equal(dry.body.mode, "merge");
    assert.deepEqual(dry.body.rejects, [], "nothing of its own export is refused");
  });

  test("the merge itself answers 200, and the book is unchanged by it", () => {
    assert.equal(merged.status, 200, merged.text);
    assert.deepEqual([...differences(before_, after_)], [],
      "merging a book onto itself must change nothing — no doubled edge, no rewritten posting");
  });
});

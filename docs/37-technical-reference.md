# 37 · Technical reference — description, schema, modules

**As at v5.18.0 · 2026-09-23.** This is the current-state map of the
product: what it is, the modules it is made of, every table in the
database, every capability the code carries, and what it does not yet
do. It was first written against 5.3.0 on 31/08 (the committee record is
[`40-comite-revue-documentation.md`](40-comite-revue-documentation.md))
and was brought to 5.18.0 on 23/09 from the source, not from the
changelog (docs/36, line C-04). It describes the 5.18.0 release tree
**— 5.17.0 with the C-04 product fixes** (migration 053 and the
documentation committee's fixes re-delivered): that is the tree this
document ships in. Where it disagrees with
[`03-target-architecture.md`](03-target-architecture.md), this document
describes what shipped; `03` remains the record of what was targeted.

Every number below was counted in the tree, and the way it was counted is
given beside it. If you change the product, recount; do not edit the
number by hand.

---

## 1 · Project description

**Meridian IT-PMO** is a self-hosted project portfolio management system
for a group that runs several sites: a programme office in one country,
delivery teams in others, and an auditor who will eventually ask why a
decision was taken in March. Version 5.18.0 (`package.json`), Apache-2.0,
no telemetry, no licence check, and no outbound network request in a
default installation.

It covers the portfolio lifecycle:

- demand intake and prioritisation against capacity and a capital
  envelope;
- earned value and critical path;
- stage gates on a ladder that each programme may declare (up to twelve
  gates), with verified evidence and acceptance criteria;
- RAID with dated reviews, and change control;
- resource capacity with rotation and absences;
- a multi-currency cost ledger with commitments;
- the business case, benefits and a value page;
- tolerances with automatic exceptions;
- a decision register and a lessons register;
- stakeholders and a communication plan;
- the weekly and monthly meetings that run on top of all of this,
  generated from the portfolio rather than typed into a deck.

Three principles hold everywhere in the code:

- **Authority is data, not convention.** Every authority decision is made
  once, server-side, in `shared/rbac.js`. The browser imports the same
  module only to decide what to draw.
- **The trail cannot be rewritten.** Every mutation writes an audit row
  inside its own transaction. The audit, closed-period and snapshot tables
  refuse `UPDATE` and `DELETE` at the database.
- **The meeting is generated.** Agendas are computed from live portfolio
  state and frozen verbatim when the meeting closes. Decisions and actions
  land back on the projects they concern.

A fourth principle was added by the field returns of September (RT365,
REQ-33; `docs/36` D-36.01): **an unmeasured figure is not green.** A
project with no budget, or too little of its plan spent, has health `N`
("Not measured") and SPI/CPI `null`, never 1.00 and green.

**Stack.** Node 24 with Express 5. PostgreSQL, or PGlite (PostgreSQL 16.4
compiled to WebAssembly) when no `DATABASE_URL` is set. A vanilla-ES
front end built with Vite, with no framework. There are four runtime
dependencies (`express`, `pg`, `@electric-sql/pglite`, `cookie-parser`,
read from `package.json`), and no third-party code touches a password. It
ships as source, or as a Windows service installer (`MeridianSetup.exe`:
Node SEA + winsw + IExpress).

**Interface languages.** English, French, and Spanish marked *draft*
(`LANGS` in `web/src/lib/i18n.js`: three entries, `es` with
`draft: true`). The server composes refusals in the same three languages
(`server/src/i18n.js`, `server/src/i18n-es.js`), because a refusal is the
sentence someone reads when they do not know what to do. What is
*recorded* in the audit trail stays in one language.

---

## 2 · Module map

### `shared/`: logic both sides run

| Module | What it is |
|---|---|
| `engine.js` | The portfolio arithmetic, from v4. It covers EVM (SPI/CPI/EAC/VAC/TCPI), critical path and float, gates, RAID exposure and escalation, capacity, effective FTE, tolerance measurement, benefit attainment, the value report, site clocks and the S-curve. It also holds the vocabularies: the 4 default gates, 6 phases, 4 RAID types, 11 ISO 21502 lesson categories, 9 document types and 4 health states `G/A/R/N`. Since 5.10–5.17 it also holds **the one gate model** (D-36.02): `gates()` walks the programme's ladder, else the portfolio model (`settings.gates`), else the default four. `normaliseGateModel` validates a ladder: at most `MAX_GATES = 12` rungs, each with an optional `loopsTo` (an earlier rung) and `scope` (`project`, `programme` or `portfolio`). `gateStatus` reads criteria, placeholder dates, open risks and the loop number. `scopedGateStatus` aggregates a programme- or portfolio-scoped gate. `openVetoes` reads the veto seats. |
| `rbac.js` | The single authorisation gate. `can(user, action, resource)` covers 45 named actions (`ACTIONS.length`) and 4 roles. There are 10 group-only writes and 2 admin-only actions (the `GROUP_ONLY_WRITES` and `ADMIN_ONLY` sets). An unknown role is refused. `canRatifyDecision` holds the segregation rule for ratifying a decision. |
| `meetings.js` | Agenda generation: exception-only weekly agendas, full monthly packs, referrals, cross-level action threading, time-boxing, and "register items due for review". |
| `govsignals.js` | The five governance signals (REQ-28): decision latency, action ageing, gate cycle time, RAID review compliance and exception age. Every one is read from timestamps the book already keeps. |
| `prioritise.js` | Portfolio prioritisation (REQ-24). It scores live projects and open requests on four inputs (value, confidence, exposure, capacity) under a weighting the group states, and draws the line where capacity runs out. |
| `valuepage.js` | The value page (REQ-30). It shows six figures, with no colour: spend against case, benefits by status, benefit reviews overdue, top risk exposure, gates due and exceptions open. |

### `server/`: Express 5, Node 24

| Module | What it is |
|---|---|
| `index.js` | The HTTP server, route mounting, the production start refusals, the hourly sweeps (exceptions, notifications, delivery, evidence probe, purges) and graceful stop. |
| `env.js` | Reads `.env` (repository root, never over what the shell set). Holds **the one PGlite directory resolver** `pgliteDirFor` (D-36.01 bis) and the one version number (`package.json`, or `MERIDIAN_VERSION` in a packaged build). |
| `db.js` | One adapter over two engines: `pg` when `DATABASE_URL` is set, PGlite otherwise. It applies the ordered migrations at boot and refuses a database carrying migrations the binary does not know. It writes the book-holder marker, clears stale PGlite locks, and holds `updateVersioned` (optimistic concurrency) and `allocateId`. |
| `migrate.js`, `seed.js`, `seed-data.js`, `reset-book.js` | `npm run migrate`, the demonstration book, and the command that clears it for production. `reset-book` fails loudly on any non-empty table it neither clears nor declares kept. |
| `auth.js`, `oidc.js` | scrypt with per-user salt, sessions stored as SHA-256 token hashes, the forced first-login password change, deputy (`acting_for`) sessions and sign-in rate limiting. Optional Entra ID sign-in (`MERIDIAN_OIDC_*`). |
| `audit.js`, `pgerror.js` | `audited()`: the audit row with before/after images, inside the mutation's transaction. Constraint violations are translated into 400/409 answers that name the rule. |
| `portfolio.js` | The serialiser from rows to the object the engine reads. Money is stored in whole units and divided by 1e6 at this boundary. The default settings live here. The export carries `currencyUnit: "millions"`. |
| `import.js` | The whole-book import (`POST /api/admin/import`). It refuses a book without `currencyUnit` (D-36.04). It accepts `?dryRun=1` (validate, then roll back) and `?mode=merge` (upsert by id instead of replace). Every refused row is named by table and id. |
| `v1write.js` | The write API (`PUT /api/v1/*`). Rows are upserted by the caller's own external id. It supports `adopt`, an optional `Idempotency-Key`, `version` when sent, and it refuses unknown fields. |
| `value.js`, `evidence.js`, `plant.js` | Business-case reconfirmation at a gate. The locators a decision may cite as evidence. Site freezes, which both write paths ask. |
| `notify.js`, `exceptions.js`, `probe.js`, `events.js` | The notification queue, the hourly sweep that emits eight of the eleven kinds, and delivery (kind, severity, scope, per-subscription cadence, quiet hours); the tolerance / benefit-review sweep, which emits the other two; the evidence liveness probe, which emits the last; and signed outbound events (HMAC, retried, with a readable delivery journal). |
| `backup.js`, `posture.js` | `npm run backup` / `npm run restore-drill`, with the last proven restore reported by `/api/health`. The day-one posture: which published demo password still opens an account. |
| `federation.js`, `integrations.js`, `openapi.js`, `archive.js`, `adoption.js`, `wbs.js`, `i18n.js`, `i18n-es.js` | SDP federation; named integration keys (5 scopes); the OpenAPI document; the full archive; the adoption indicators; scaffolding a project onto its ladder (and moving it onto a new one); server-side French and Spanish. |

Route files (`server/src/routes/`, 11 files): `auth`, `portfolio` (the
bulk), `meetings`, `admin`, `importcsv`, `ladder`, `signals`,
`valuepage`, `federation`, `federationService` (SDP-facing `/v1`) and
`v1` (the public contract `/api/v1`).

### `web/`: Vite, vanilla ES modules

| Module | What it is |
|---|---|
| `src/main.js` | The shell: navigation, header, language toggle, notification preferences, theme, the forced password dialog and the "Start here" page. |
| `src/ui/kit.js`, `login.js`, `guide.js` | The `h()` builder, dialogs and tables (the "Instrument" design system, light and dark). The sign-in screen. The in-app manual and the first steps for each role. |
| `src/lib/api.js`, `state.js`, `permissions.js`, `i18n.js`, `es.js` | The fetch wrapper, the app store and routes (`ROUTES`, `ROUTE_ROLES`), the read-only RBAC mirror, and the FR and ES dictionaries. |
| `src/views/index.js`, `meetings.js`, `administration.js` | The 21 screens (§7). |

### `scripts/`: build, audit, operations

`npm run audit` runs **twelve static gates**, counted from the `audit`
script in `package.json`:

| Gate | Script | What it checks |
|---|---|---|
| F1 | `route-match` | Every button calls a mounted route. |
| F2 | `crud-audit` | CRUD and audit coverage. |
| F3 | `version-audit` | Optimistic-concurrency coverage. |
| F4 | `control-audit` | Control coverage. |
| F5 | `i18n-audit` | Every language. |
| F6 | `help-coverage` | Field help. |
| F7 | `kit-imports` | Kit-import hygiene. |
| F8 | `view-render` | All 21 screens rendered as each of the 4 roles, 84 renders. |
| F9 | `openapi-drift` | The API contract matches the routes. |
| F10 | `release-audit` | One version everywhere. |
| F11 | `register-schema` | The shape of each field request register. |
| F12 | `register-reachable` | A request marked `done` names files the default branch carries. |

Beside the gates: the use-case sweep (`npm run sweep`), the Windows
packaging chain, the training instance, `backup` / `restore-drill`, the
archive restore, the admin handover, and the field-return tooling
(`field:init`, `review:field`).

---

## 3 · Database schema

**63 tables, created by 53 ordered migrations** (`server/migrations/001`
to `053`, applied automatically at boot; 053 widens a constraint and
creates no table). The SQL is identical on
PostgreSQL and PGlite. The count was taken two ways:

- `grep -iE "create table" server/migrations/*.sql` lists 63 distinct
  names.
- A fresh in-memory book, migrated, lists 64 base tables in `public`: the
  63 above plus `schema_migration`, which `db.js` creates to record which
  migrations ran.

Migration 029 also creates the schema `reporting` with **14 read-only
views** for BI tools (documented in
[`30-vues-restitution.md`](30-vues-restitution.md)). The 31/08 edition
counted 46 tables from 27 migrations. Seventeen tables arrived since, in
028, 031, 035, 037, 038, 042, 046, 048, 050, 051 and 052.

### Cross-cutting conventions

- **Optimistic concurrency.** Every versioned entity row carries
  `row_version`. An update asserts the version it read, and a mismatch is
  a 409, never a silent overwrite. A write that does not say which version
  it read is refused 428. Settings, narrative blocks and approval-chain
  steps sit outside the scheme on purpose. On `PUT /api/v1/*`, an omitted
  `version` is last-writer-wins by contract.
- **Append-only records.** `audit_event`, `report_period` and
  `report_snapshot` carry `RULE`s that turn `UPDATE` and `DELETE` into
  no-ops.
- **Atomic identifiers.** `id_counter` (one row per prefix: `PRJ`,
  `RSK`, `CR`, `DOC`, `DEC`, `EXC`, `REQ`, …) allocates with one
  `UPDATE … RETURNING`.
- **Money.** Stored as `numeric` in whole currency units, divided by 1e6
  for display. Benefits keep their own `measure` and `unit` and are never
  converted. A book file declares its unit (`currencyUnit`: `millions` or
  `units`), and an import without it is refused (D-36.04).
- **External identity.** Ten entity tables carry
  `external_source`/`external_id` (035 and later), so an integration
  writes by its own identifier: `project`, `milestone`, `raid_item`,
  `activity`, `work_item`, `meeting_decision`, `meeting_action`,
  `gate_criterion`, `benefit` and `business_case`.
- **Provenance.** `programme`, `project`, `activity` and `milestone`
  carry `origin ∈ (local, sdp)`. Rows born from the SDP sync refuse local
  edits to synced fields.
- **Unmeasured is a state.** `report_value_figure` refuses, by `CHECK`, a
  figure in state `N` that carries a value, or a measured figure without
  one.
- **Secrets are never stored in clear.** Passwords are scrypt hashes.
  Session tokens and integration and federation keys are SHA-256 hashes.
  A deleted integration's audit image is built by allow-list, so a
  webhook signing secret never reaches the trail.

### Organisation and identity

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `site` | 001 | A delivery site: city, region, time zone, headcount and FTE, charter, link quality (`link_mbps`, `link_kind`), `readiness`, `champion_id` (A-12), `country`, `legal_entity` (027). |
| `programme` | 001 | Name, sponsor, `manager_id`, `origin`, and **`gate_model`** (036): the programme's own gate ladder, up to 12 rungs, each rung optionally carrying `loopsTo` and `scope`. |
| `person` | 001 | The directory: role, site, `day_rate`, `employment`, `rotation`, `availability` %, supplier. |
| `app_user` | 001 | An account: unique e-mail, scrypt hash and salt, `role ∈ (admin, group, site, viewer)`, `must_change_password`, `locale`, `notify_pref`, quiet hours. |
| `access_grant` | 001 | One grant naming exactly one programme **or** one site (CHECK). There are no wildcard grants. |
| `session` | 001 | Server-side sessions. Only `token_hash` is kept. `acting_for` is deputy authority. |
| `audit_event` | 001 | The append-only trail, with full before/after images. |
| `app_setting` | 001 | Key/JSON settings: thresholds, CCB, envelope, `documentHosts`, `notifyHosts`, retention, org name, status date, and `gates` / `gateLoopLimit` (the portfolio gate model, 051). |
| `id_counter` | 004 | Atomic id allocation. |
| `usage_daily` | 021 | Anonymous counters for each day and kind. They count how many, never who. |
| `integration` | 025 | A named integration: key hash and hint, `scopes`, active, rotated/last used, `webhook_url` / `webhook_secret` (031). |
| `idempotency_key` | 035 | The write API's memory: `integration_id`, `key`, `request_hash`, `status`, `response_json`. Purged after thirty days. |
| `event_delivery` | 031 | The outbound event journal: `audit_id`, status, attempts, last error. A dead webhook is readable here. |

### Portfolio core

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `project` | 002 | The unit of governance. It holds `governance_level ∈ (group, site)`, the method, dates, `baseline_finish`, budget and contingency, phase, `gate`, and a health override with its reason. Later migrations added: PIR verdict (008); plant impact and MoC (010); priority scores and rank (011); closure signatures (`ops_accepted_by`, `benefits_owner_id`, `closure_note`, `closed_on`, 032); external id (035); `scaffolded_gates` (043); `date_basis` / `condition`, `sponsor_id` and `acceptance_criteria` (045, REQ-19); and `gate_loop` (051, the current turn of a looping ladder). |
| `activity` | 002 | Stages with baseline dates, `weight`, `pct`, owner, and progress provenance (`progress_source`, `progress_at`). |
| `activity_dep` | 002 | Finish-to-start links inside a project. |
| `cross_dep` | 002 | Links between projects on the integrated master schedule. |
| `milestone` | 002 | Milestones and gates (`kind`), with due and baseline dates, `intrusive`, `done`. It also carries acceptance criteria and `accepted_by` / `accepted_on` (032); `date_basis ∈ (committed, placeholder)` with `condition` (040); `retired_gate` (047); `done_on` / `done_by`, the weaker pair for a gate ticked without criteria (049); and `gate_loop` (051). |
| `cost_line` | 002 | The append-mostly ledger: period, amount, category, contingency flag, `kind` (capex/opex), currency, FX rate as booked, local amount, and the risk a contingency draw answers (030). It is corrected by reversing lines. |
| `commitment` | 012 | Money promised and not yet booked: a purchase-order reference, supplier, amount with currency and FX, and status. |
| `raid_item` | 002 | Risks, issues, assumptions and dependencies: P×I 1–5, response, owner, `review_on`, `origin_site`. Later: residual target P×I (030); `gate` and `cr_id` (034); external id; `closed_on` / `closed_by` (045, REQ-18, never back-dated); and `category`, a free label beside the fixed `kind` (045, REQ-13). |
| `raid_review` | 050 | **A review is an event** (REQ-46): `reviewed_on`, `reviewed_by`, note, `due_on`, `next_review_on`, `recorded_by`. `raid_item.review_on` is the projection of the latest one. |
| `change_request` | 002 | Change control with deltas and funding. `raised_by` is the person and `raised_by_user` the account (033, PR-03). |
| `change_step` | 002 | The routed approval chain: four ordered steps per request. |
| `allocation` | 002 | Person × project × dates × percentage, plus `capitalised`. Its id survives an export/import round trip (MER-14). |
| `document` | 002 | Gate evidence: type, gate, revision, status. Also: the `uri` on a trusted host, hash-locked at approval, and `supersedes` (014); the liveness probe state (020); and `gate_loop` (051). |
| `gate_criterion` | 037 | **Gate criteria** (I-4): what must be true at gate *n*, the document it cites, `met`, `reviewed_by` / `reviewed_on`. A gate with criteria is ready only when evidence is approved **and** every criterion has been found met by someone other than the owner of the evidence cited. |
| `board_column`, `work_item` | 002 | The delivery board: columns with WIP limits, and items. |
| `report_narrative` | 002 | Narrative blocks for the pack. |
| `ext_link` | 005 | Links to SDP items, with a PII-free display cache. |

### Governance and value

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `benefit` | 008 | A benefit in its own unit, with baseline, target, actual, `realise_on`, `measured_on` and status. The project records the measurement. The verdict is group work. |
| `business_case` | 028 | One case per project: `summary`, `expected_cost`, `expected_benefit`, `value_confidence` (1–5), `basis`, the last reconfirmation, and an external id. The case is born when a demand is converted (V-15). |
| `case_reconfirmation` | 042 | **The case reconfirmed at every gate** (REQ-22): gate, verdict (Continue, Continue with conditions, Stop), the two figures as they stood, and the named reconfirmer. A gate on a project that has a case is refused until the case has been reconfirmed at that gate. |
| `report_period` | 009 | A period close. `restates` names the period it corrects. Append-only. |
| `report_snapshot` | 009 | What the board was told, project by project. Append-only. From 5.13.0 a `N` stays `N` here. |
| `report_value`, `report_value_figure` | 048 | **The value page stored per period** (REQ-30): six figures, each `measured` with a value or `N` with a reason (CHECK). |
| `demand` | 011 | The intake funnel. Later: expected benefit, confidence, estimated FTE and P×I (046). |
| `prioritisation_weighting` | 046 | The group's weighting of the four inputs: `w_value`, `w_confidence`, `w_exposure`, `w_capacity`, with a note, who set it and when. The default is 40/20/20/20. |
| `project_tolerance` | 026 | The margin set by the level above. |
| `project_exception` | 026 | A breach recorded by the sweep. It closes only by one of four answers. There is one open exception per project and dimension (partial unique index). The dimension `benefit-review` is raised for benefits past their date and unmeasured (REQ-21). |
| `lesson` | 024 | Lessons (ISO 21502 §7.17), 11 categories, Proposed → Adopted → Archived. The gate bound follows the ladder (043, 051). |
| `site_window`, `rollout_wave` | 010 | The plant calendar (shutdown/freeze), and rollout per site. A wave is one site (044). |
| `person_absence`, `timesheet` | 015, 016 | Bounded absences with a deputy, and weekly actuals. |
| `stakeholder` | 038 | **The stakeholder register** (I-10): a person or an organisation, interest × influence (1–5), attitude, engagement, and the owner of the relationship. |
| `comms_plan` | 038 | **The communication plan**: audience, purpose, channel, frequency, owner, next date. |

### Meetings and decisions

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `meeting_series` | 003 | Cadence and scope (group/programme/site). `cadence` accepts `weekly`, `monthly`, `per_gate` (with `gate_n`) and `ad_hoc` (052, MER-10). The session route that creates a series still offers weekly and monthly only. |
| `meeting_occurrence` | 003 | Scheduled → open → closed. |
| `agenda_item` | 003 | The frozen agenda. |
| `meeting_attendance` | 003 | Present, apologies, absent, deputy, and `observer` (052: voice without vote). |
| `meeting_decision` | 003 | **The decision register.** A decision is anchored to a room, or to a named decider or deciding body and a date (034, I-7). It carries alternatives, dissent, evidence locator, provenance and `status ∈ (Proposed, Ratified)` with `ratified_by` (039). It is versioned (041) and has `ratified_on` (049, cleared by CHECK when un-ratified). `reversal_cost` and `supersedes_id` came in 052. The substance is immutable; the state is not. Note: 034's `supersedes` (text) and 052's `supersedes_id` (FK) both exist, the trace of the two lines that converged in 5.18.0. |
| `meeting_action` | 003 | Actions that outlive their occurrence. `raisedInStatus` is read back by `/api/v1/actions`. |
| `decision_objection` | 052 | An objection on a decision by a seat: domain, reason, `escalates_on`, state, resolution (MER-07). An open objection from a veto seat blocks the gate (`Engine.openVetoes`). |
| `seat` | 052 | Governance seats: person, domain, `veto_domain`, `observer` (MER-06). |
| `seat_conflict` | 052 | Pairs of incompatible seats. A trigger refuses one person holding both. |

### Requirements, evidence, findings: import only in 5.18.0

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `requirement` | 051 | The requirement register (MER-03): statement, source, priority, `verification` (the promised method) and `verified_by` (the proof), gate, status, waiver reason, owner. |
| `evidence` | 052 | Evidence that is not a document (MER-11): kind, name, uri, digest, gate and loop, captured on/by. |
| `finding` | 052 | Review findings (MER-05): the fact, why it matters, severity, owner, proposed fix, re-test date, status. A finding closes on re-test evidence (`closed_evidence_id`), never on a merged fix. |

**These registers, with seats, seat conflicts and objections, have no
write route and no screen in 5.18.0.** They enter the book through the
whole-book import only, travel in the export and the bootstrap, and are
read by the engine (vetoes block a gate). This is `docs/36` NEW-04, open
for wave 1. Say so to anyone who asks where to type a requirement.

### Notifications and federation

| Table | Migr. | Purpose and notable columns |
|---|---|---|
| `notification` | 013 | A queue, never a direct send. It holds kind, severity, the subject and body in the recipient's locale, and delivery state. `read_at` is kept separate from delivery. `dedupe_key` (unique, NOT NULL) and `group_key`, `on_behalf_of` and `expires_on` complete it. The `kind` CHECK (018, widened by **053**) admits **11 kinds**: action-due, action-overdue, gate-blocked, decision-owed, digest, concern-raised, site-quiet, timesheet-missing, evidence-unreachable, tolerance-breached and benefit-review-due. |
| `notification_subscription` | 019 | Kind × scope × minimum severity × cadence. |

---

## 4 · Functionalities

**Portfolio and performance.** Earned value is computed per project and
rolled up, as are the critical path and float and the integrated master
schedule with cross-project links. The five-day dependency rule is
checked inside each project (`Engine.depBreaches`) and across the
cross-project links (`Engine.crossDepBreaches`); the Schedule banner
counts both. RAG health comes in four states: G, A,
R and **N**, *Not measured*. `N` covers two absences that stay distinct:
"Too early to measure — less than 2% of the plan has been spent", and
"Nothing measured — no budget, so there is no scale to measure against".
A manual override needs a reason. Re-baselining is a group act. The
executive page carries the **five governance signals**. None of them is
coloured without an agreed threshold, and each says `N` with a sentence
when there is nothing to measure.

**Dates that say what they rest on.** A milestone, and since 045 a
project finish, is either *committed* or a *placeholder* waiting on a
named condition. A placeholder is drawn where it sits, but it is never
reported missed or overdue. Its gate reads `Unscheduled`.

**Stage gates, ladders and criteria.** The ladder a project walks is its
programme's (`programme.gate_model`, up to 12 gates, declared in
Administration → Programmes as one line per gate). Without one it is the
portfolio model (`settings.gates`, which only an import can set in
5.18.0). Without either it is the default four: Mandate, Design
authority, Readiness, Benefits.

A project takes its ladder when it is created. Declaring or changing a
ladder does not rewrite existing projects. Moving one project onto its
programme's ladder is a separate, dry-run-first act for the group
(`GET` then `POST /api/projects/:id/ladder`, the "Move onto the
programme's ladder" dialog).

A gate is ready when all its evidence documents are approved **and** all
its criteria have been found met by a named reviewer independent of the
evidence. Evidence approval needs an https link on a trusted host
(`documentHosts`), which is hash-locked at approval. An open veto
objection blocks the gate before evidence is even considered. A gate with
nothing registered says so: "No evidence has been registered for …".

A rung may **loop** (`loopsTo`). Evidence and milestones of an earlier
turn do not clear the current one. A rung may be **scoped** to the
programme or the whole portfolio, and then clears only when every project
in scope carries its evidence and criteria. Loops and scopes are
evaluated by the engine, but **no route or screen advances a project to
its next turn**: `gate_loop` changes only by import in 5.18.0.

**Demand and prioritisation.** The intake funnel runs raise → decide
(group) → convert. Conversion creates the project's business case from
the requester's own words. Next to it sits the capital queue against an
envelope. Portfolio prioritisation (REQ-24) scores live projects and open
requests on value, confidence, exposure and capacity under a weighting
the group sets with a written reason, and draws the line where capacity
runs out.

**Finance.** The ledger is multi-currency and append-mostly, and a
correction is a reversing line. Commitments carry a purchase-order
reference. A contingency draw must name the open risk it answers.

**Change control.** Every request runs the same four steps: project
manager, change authority, finance, steering committee. The CCB threshold
decides *who may sign*, and above it only group may. Approval applies the
deltas. The raiser never approves, whether that is compared as the person
or as the account.

**Risk (RAID).** Items have exposure bands, escalation, a residual
target, a link to a gate or a change request, a free category and a
dated closure. **Reviews are events** (`raid_review`), recorded through
`POST /api/raid/:id/reviews`. In 5.18.0 that route has no button; the
agenda asks for items whose review date has come.

**Business case and value.** One case per project, written and
reconfirmed by group. It is reconfirmed at every gate on both write
paths, and a *Stop* verdict refuses the next gate. Benefits are held in
their own units, and one past its date and unmeasured raises an
exception. The **value page** (Reports → "What it was worth") shows six
figures without colour, can be printed, and can be stored per closed
period and read back unchanged.

**Tolerances and exceptions.** The margin is set by the level above, and
an hourly sweep records breaches. "Check now" asks for the sweep at once.
An exception closes only by one of four answers.

**Decisions.** One register holds decisions taken in a meeting and
decisions taken outside one. Both carry a decider or deciding body,
alternatives, dissent, an evidence locator (http(s), a repository path, a
commit), provenance and supersession. The status is *Proposed* or
*Ratified*. Ratifying a Proposed decision later is possible only through
`PUT /api/v1/decisions`, under `canRatifyDecision`. No screen does it
(REQ-50). The session route accepts a free-text `ratifiedBy` with no
independence check (REQ-49, open, high).

**Stakeholders and communications.** Both live on the project page:
interest × influence, attitude and engagement, and a communication plan
with the next date.

**Lessons.** Proposed by whoever lived it and adopted by group. Adopted
lessons of the same programme or site are offered in a "Before you plan"
dialog right after a project is created from "New project"
(`GET /api/projects/:id/lessons/relevant`).

**Meetings.** Generated agendas (including "Register items due for
review" and "Referred from …"), attendance with deputies and observers,
decisions that are refused twice in the same room, actions, referral up,
close (frozen), minutes in Markdown, packs and ICS.

**Notifications.** The queue, the in-app centre, per-user language,
cadence, quiet hours and fine-grained subscriptions (all four in the
*Notification preferences* dialog). Every one of the **11 kinds** the
CHECK admits has an emitter (counted as `kind: "…"` in `queue()` calls):

- `notify.js` sweep: action-due, action-overdue, gate-blocked,
  decision-owed (to the chair of the room a decision was referred to),
  concern-raised (to the PM of the group project), site-quiet (to the
  site's champion), timesheet-missing (to the person only) and digest
  (at the account's cadence);
- `probe.js`: evidence-unreachable;
- `exceptions.js`: tolerance-breached (to whoever set the margin) and
  benefit-review-due (to the benefit's owner). Both carry a dedupe key,
  and a failure to queue is logged, not swallowed.

On the seeded book, one exception sweep and one notification sweep
queued `timesheet-missing` (8), `gate-blocked` (3), `tolerance-breached`
(2) and `action-overdue` (1); the other kinds need data the seed does
not hold at that date. Delivery honours kind, minimum severity, scope
(the entity resolved to its project, programme and site) and the
per-subscription cadence, one batch per period; quiet hours are read in
the site's timezone and urgent messages pass. Outbound delivery runs
hourly through a Teams webhook (`MERIDIAN_TEAMS_WEBHOOK`) or a generic
HTTPS webhook (`MERIDIAN_NOTIFY_URL`), both gated by `notifyHosts`, which
is closed by default. No SMTP client is carried. Messages are composed in
English or French only: an account cannot choose Spanish for its
messages (`PATCH /api/auth/preferences` accepts `en`, `fr` or empty) and
`inLocale` treats anything but `fr` as English (§10, NEW-13).

**Interoperability.**

- **Read.** `/api/v1` (portfolio, value, decisions, actions, audit) under
  named, scoped, rotatable keys. The OpenAPI contract is generated from
  the mounted router.
- **Write.** Ten `PUT` collections with `Idempotency-Key`.
- **Outbound.** Signed events.
- **SQL.** The `reporting.*` views.
- **Files.** CSV import with preview, and the whole-book JSON import with
  dry run and merge.
- **Federation.** SDP federation.
- **Exit.** A full archive and `npm run restore`.

**Operations.**

- `.env` loading.
- The PGlite resolver, which defaults to `server/.data/pgdata`, is
  created if missing, and is in memory only on request.
- Production start refusals.
- `/api/health` with version, engine, instance id, migration count and
  the last proven restore.
- `backup` and `restore-drill`.
- The day-one posture banner.
- The training instance.
- The field-return loop (`field:init`, `review:field`, registers in
  `docs/requests/`, gates F11–F12).

---

## 5 · API surface

202 route handlers across the 11 router files, counted as
`r.get|post|put|patch|delete(` calls in `server/src/routes/*.js`:
`portfolio` 98, `admin` 28, `auth` 19, `meetings` 17, `v1` 17,
`federation` 9, `federationService` 4, `importcsv` 3, `valuepage` 3,
`ladder` 2, `signals` 2.

| Mount | Auth | Content |
|---|---|---|
| `/api/health` | none | Version, build, engine, `ephemeral`, instance identity, migrations applied, last drill. |
| `/api/auth` | public → session | Login/logout/me, the seeded directory, password, preferences, quiet hours, deputy sessions (`actas`), OIDC, the notification centre and subscriptions. |
| `/api` (portfolio, ladder, valuepage, signals) | session + RBAC | Bootstrap and collection refresh, projects, activities, milestones, criteria, cost, commitments, RAID and reviews, change requests, allocations, timesheets, absences, demand, prioritisation and weighting, windows, waves, benefits, business case and reconfirmation, tolerance, exceptions (sweep, answer), lessons, documents, work items, narrative, periods, value page, signals, decisions, stakeholders, comms, audit, digest, adoption, dataset export, and the ladder move. |
| `/api/meetings` | session + RBAC | Series, occurrences, open/close, attendance, decisions (with referral), actions, minutes, pack, ICS. |
| `/api/admin` | admin | Users and grants, posture, sessions, integrations, notifications, settings, reference data (people, sites, programmes and their ladder, columns), archive, whole-book import/export, reset to seed. |
| `/api/import` | session, `data.import` | CSV template, preview, apply (projects, people, milestones). |
| `/api/federation`, `/v1` | admin / SDP key | SDP federation. |
| `/api/v1` | named integration key | The public contract (below). |

**The public contract.** `docs/openapi.v1.json` describes **17 paths**
(7 `GET`, 10 `PUT`) under 5 scopes: `read:portfolio`, `read:audit`,
`read:meetings`, `write:portfolio` and `write:meetings`. It is also
served at `GET /api/v1/openapi.json`. The writes are `projects`,
`milestones`, `raid`, `activities`, `workitems`, `criteria`, `benefits`
and `business-case` under `write:portfolio`, and `decisions` and
`actions` under `write:meetings`.

The rules are the same as the screens'. On top of them:

- The caller's own `externalId` is the key.
- `adopt: "<Meridian id>"` binds a row born on a screen.
- `Idempotency-Key`: the same key with the same body replays (header
  `idempotent-replayed`); the same key with another body is 422.
- An unknown field is refused 400, naming what the collection accepts.
- An unchanged re-run writes nothing.

A key never opens a session route: `GET /api/bootstrap` with a key
answers 401. One more route is mounted under the contract prefix,
**`GET /api/v1/signals`** (`read:portfolio`). It answers, but it is
missing from the published contract (§10, NEW-08).

---

## 6 · Authority model

Four roles:

- **admin**: unrestricted, and exempt from segregation of duties. This
  is a break-glass, and every such signature is marked in the audit
  trail.
- **group**: reads the whole portfolio, and writes inside its granted
  programmes.
- **site**: reads its own sites and the group projects landing there,
  and writes only site-governed projects in its granted sites.
- **viewer**: reads, and never writes.

A grant names exactly one programme or one site.

**Group-only**, whatever the project (10, from `GROUP_ONLY_WRITES`):
re-baselining, the cost ledger, contingency release, data import, the
benefit verdict, period close, lesson adoption, writing and reconfirming
the business case, setting tolerances, and answering exceptions. Group
level alone also decides demand and priority, sets the prioritisation
weighting, runs the exception sweep, moves a project onto a ladder,
releases MoC and keeps portfolio-wide RAID.

**Admin-only** (2): user management and global settings.

**Segregation of duties**, enforced where the act happens:

- the raiser of a change never approves it (person *and* account);
- the owner of a document never approves it as evidence;
- site-project gate evidence needs group approval;
- a criterion is found met by someone other than the owner of the
  evidence it cites;
- the decider and the recording account never ratify (contract path);
- the PM never releases their own MoC.

A new account's first sign-in forces a password change. Until then every
write is refused: "Choose your own password first — until you do, the
trail cannot say this was you".

---

## 7 · The 21 screens

The screens were counted from `ROUTES` in `web/src/lib/state.js` and the
21 `Views.*` definitions. *In the menu* gives the EN and FR labels as the
navigation renders them. Three screens are role-restricted
(`ROUTE_ROLES`): `programmes` and `adoption` for admin and group, `mysite`
for site, and `admin` for admin.

| View | In the menu (EN / FR) | What it shows |
|---|---|---|
| `my` | My week / Ma semaine | What is owed by you, and deputy cover ("Cover for them"). |
| `inbox` | Notifications / Notifications | The notification centre. |
| `portfolio` | Portfolio / Portefeuille | The executive view: project register, decisions owed, calendar, programme mix and the **governance signals**. |
| `roadmap` | Roadmap / Feuille de route | The timeline, and "What waits on what". |
| `pipeline` | Pipeline / Portefeuille de demandes | Requests, the capital queue, and **Value and risk against capacity** (prioritisation). |
| `programmes` | Programmes / Programmes | Programme roll-ups (admin, group). |
| `mysite` | My site / Mon site | The site cockpit: yours to run, landing on your site (with "Raise concern"), absences and cover, open risks (site). |
| `project` | Project overview / Vue projet | The project page: milestones and gates with criteria, business case, value and benefits, tolerance and exceptions, stakeholders, communication plan, plant and rollout, stage plan, open RAID, team, cost position and SDP links. |
| `schedule` | Schedule / Planning | The integrated master schedule. |
| `board` | Board / Kanban | The work board. |
| `risk` | Risks & issues / Risques & problèmes | The RAID register. |
| `budget` | Budget & cost / Budget & coûts | Commitments, cost performance, postings and contingency. |
| `change` | Change requests / Demandes de changement | Requests and their approval path. |
| `resources` | Resources / Ressources | Capacity, demand and actual effort. |
| `meetings` | Meetings / Réunions | Series, agendas, decisions, actions, attendance, minutes and packs. |
| `documents` | Documents / Documents | The evidence library and the gate model. |
| `reports` | Reports / Rapports | The **value page**, the status pack, promised against measured, value position, risk posture and the **decision register** ("Record a decision"), plus period close. |
| `lessons` | Lessons / Enseignements | The lessons register. |
| `locations` | Locations / Sites | Sites, shutdowns and freezes, overlap, clocks. |
| `adoption` | Adoption / Adoption | Per-site usage (admin, group). |
| `admin` | Administration / Administration | Rules and thresholds, evidence hosts, notifications, board columns, access, accounts, directory, CSV import, sites, programmes (and their ladder), connected systems, continuity, SDP federation, the gate model, data and audit (admin). |

---

## 8 · Deployment: every way to run it

All the ways below run the same code and the same migrations. They differ
only in where the database lives and who starts the process. The
production runbook, with PostgreSQL, backup, the second instance, the
proxy and fleets, is [`34-exploitation.md`](34-exploitation.md). The
Windows story is [`13-windows-service.md`](13-windows-service.md).

### 8.1 · Evaluation and development, from source

```bash
npm install
npm run seed     # migrate + build the demonstration book (-- --force to rebuild)
npm run dev      # builds the client if web/dist is missing, then http://localhost:4173
```

With no `DATABASE_URL`, the server runs PGlite from **the one resolver**
(`server/src/env.js`, `pgliteDirFor`), in this order:

1. An explicit in-memory request from code (`dataDir: null`, the test
   harness).
2. `MERIDIAN_EPHEMERAL=1`, or `PGLITE_DIR=:memory:` (KODO's spelling):
   the book is in memory, lost at stop. `/api/health` says
   `"ephemeral": true`, and the start line says `! book: IN MEMORY`.
3. `PGLITE_DIR` when set.
4. Otherwise **`server/.data/pgdata`**, created if missing.

A `.env` at the repository root is read by the server, the seed, the
migrations and every script. It is never read over what the shell
already set (`.env.example` lists the keys). `npm run dev:server` starts
the bare server. `npm run dev:web` is Vite with hot reload, proxying
`/api`.

Restart with `bash scripts/restart.sh`, never a hard kill. PGlite does not
do crash recovery the way a server does. Read the note on SIGTERM in §10.

### 8.2 · Production from source: Node + PostgreSQL

```bash
DATABASE_URL=postgres://user:pass@host:5432/meridian npm run migrate
DATABASE_URL=… npm run admin:handover   # or: npm run seed / npm run restore <archive>
DATABASE_URL=… npm start                # NODE_ENV=production
```

The server **refuses to start** in production:

- on PGlite, unless `MERIDIAN_ALLOW_PGLITE=1`;
- while a published demo password still opens an active account (it
  names them), unless `MERIDIAN_ALLOW_DEMO_ACCOUNTS=1`;
- on PGlite when `MERIDIAN_REQUIRE_POSTGRES=1`;
- when the database carries a migration the binary does not know.

The first two were walked for this document and refused as described.

It binds to `127.0.0.1` unless `MERIDIAN_BIND` says otherwise. Behind
HTTPS, set `MERIDIAN_SECURE_COOKIES=1`, and only behind HTTPS, or sign-in
loops.

Other optional settings:

- `MERIDIAN_NOTIFY_URL` or `MERIDIAN_TEAMS_WEBHOOK`, with `notifyHosts`,
  for outbound notifications;
- `MERIDIAN_OIDC_*` for Entra sign-in;
- `MERIDIAN_INSTANCE_ID` for fleets;
- `MERIDIAN_BACKUP_DIR` for backups;
- `documentHosts`, which must be named before any evidence can be
  approved: Administration → *Evidence* → "Trusted evidence hosts",
  closed by default.

### 8.3 · Windows service: `MeridianSetup.exe`

`npm run package:installer` builds `dist/MeridianSetup.exe`. The steps
are:

1. The client is built.
2. The server is bundled into a Node SEA executable.
3. winsw, the migrations and the scripts are added.
4. IExpress wraps the result.

Running it (double-click, or `/quiet`) self-elevates, stops any running
`MeridianITPMO` service, and unpacks to `C:\Apps\Meridian`, keeping an
existing `meridian.config.json`. It locks the directory's ACLs, then
prepares a database: an existing PostgreSQL is used, the official
binaries are installed, or it falls back to the embedded engine and says
so (`scripts/package/prepare-db.ps1`). When it configures PostgreSQL it
also writes `MERIDIAN_REQUIRE_POSTGRES=1`. Finally it registers
`MeridianITPMO` (Automatic, dependent on the database service, restart on
failure) and starts it. From a checkout, run
`powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1`.
Upgrading means running the new setup again. This path was not walked
for this document.

### 8.4 · Training instance

`npm run training` runs a separate book on `:4180`. It never touches the
real one. Use `-- --reset` to put it back and `-- --drop` to erase it.

### 8.5 · Getting data in and out, and proving you can

- **`npm run backup`**: `pg_dump` (PostgreSQL), or the data directory
  (PGlite, refused while the server holds the book).
- **`npm run restore-drill`**: restores the newest backup *elsewhere*,
  recounts every table and times it. `/api/health` then reports it as
  `lastDrillAt`. Walked on a PGlite book for this document: backup
  4.6 MB, restored in 1.1 s, every table matching.
- **Archive and restore.** Administration → "Export the archive", then
  `npm run restore <archive>` into an empty instance. This is the
  migration path and the exit.
- **Whole-book JSON.** Administration → "Import book" replaces the book.
  The same route, called directly, accepts `?dryRun=1` and
  `?mode=merge`, which the screen does not offer (merge refuses the
  product's own export: §10, NEW-07). A file without
  `currencyUnit` is refused. A book exported before 5.17.0 needs
  `"currencyUnit": "millions"` added (D-36.04).
- **CSV import.** The Administration panel: template, preview, then an
  all-or-nothing apply, for projects, people and milestones.
- **`npm run admin:handover`**: transfers the administrator account.

---

## 9 · Verification

Measured on this tree on 23/09:

- **`npm test`**: 835 tests in 164 suites, from 57 files in
  `server/test`. All pass. (816 on the 5.17.0 release tree; the C-04
  product fixes added `outreach.test.js` and `committee-fixes.test.js`.)
- **`npm run audit`**: the twelve gates of §2. F8 renders all 21 screens
  as each of the 4 roles: 84 renders.
- **`npm run sweep`**: 73 use cases in 18 domains, each run as the 4
  roles, which is 286 exercised cases on a fresh instance. It reports 11
  "points to look at", and they are the expected ones (the admin
  break-glass, and a group account acting outside its grant). The sweep
  has not grown since 5.3.0. Everything that landed between 5.10 and 5.17
  is covered by the test suites, not by the sweep.
- **`npm run verify`**: tests, build, the twelve gates, and
  `npm audit --omit=dev --audit-level=high`.

---

## 10 · Known limits in 5.18.0, found by walking this document

Each item below was reproduced against a seeded book of this tree (the
5.18.0 release tree) on 23/09. None
was fixed in the documentation pass. Each carries its identifier (NEW-06 to NEW-13) in the register of
[`36-convergence.md`](36-convergence.md).

1. **The forced password change never appears in the browser (NEW-06).**
   `/api/bootstrap` returns `me` without `mustChangePassword`
   (`/api/auth/me` has it), so the dialog in `main.js` is never opened.
   An admin-created account signs in, sees the portfolio, and has every
   write refused. No other screen changes a password.
2. **Merge-mode import fails on the product's own export (NEW-07).**
   `?dryRun=1&mode=merge` with the export answers 400 "That record
   already exists — change_step CR-…" (`change_step_cr_id_seq_key`):
   the merge handle upserts only inserts that name an `id`.
3. **`GET /api/v1/signals` is not in the published contract (NEW-08).**
   It is mounted from `routes/signals.js` and answers 200 to a key;
   F9 reads only `routes/v1.js`, so the gate cannot see it.
4. **SIGTERM does not close PGlite (NEW-09).** `db.js` registers its own
   SIGTERM and SIGINT handler at connect, and that handler calls
   `process.exit(0)` before `index.js`'s graceful `stop()` runs. After
   every stop, `postmaster.pid` is left behind, and the next start
   prints "cleared 2 stale lock file(s)".
5. **Editing a programme ladder on the screen drops loops and scopes
   (NEW-10).** The text form `name | owner | evidence | at%` carries
   neither.
6. **Two English-only or stale strings on the Administration screen
   (NEW-11).** The day-one posture banner still says "no mail transport —
   notifications queue and do not send" whenever `MERIDIAN_SMTP_URL` is
   unset (`posture.js`, `smtpConfigured`), even when a webhook is
   configured. (The Notifications panel itself now asks
   `outboundTransport()` and names the two webhooks.) And the CSV import
   panel is French in every language ("Reprise de l'existant",
   "Prévisualiser", "Appliquer").
7. **`/` answers 404 when the install path contains a dot-directory
   (NEW-12)** (for example `~/.local/…`). `res.sendFile` refuses dotfile
   segments. Setting `MERIDIAN_WEB_DIST` to a plain path works around it.
8. **Spanish notifications are unreachable (NEW-13).** The interface
   speaks Spanish, but `PATCH /api/auth/preferences` refuses `locale:
   "es"` ("Locale is en, fr or empty") and `notify.js`'s `inLocale`
   composes every non-French message in English.

**Fixed on this tree by the C-04 product half**, and walked again on
23/09: "Set status" (manual colour with its reason, and back to
"Derived from SPI and CPI"); the "New project" probe, which now asks
every programme × site (`g.silva` and `p.marchetti` see the button);
Administration → *Evidence* → "Trusted evidence hosts"; migration 053
and the dedupe keys for tolerance-breached and benefit-review-due (two
`tolerance-breached` queued after "Check now"); the five kinds that had
no emitter; quiet hours and subscriptions on a screen; delivery honouring
scope and per-subscription cadence; relevant lessons offered after
creation; employment, supplier, rotation and availability on the person
form; RAID natures and access levels translated; cross-project
dependency breaches; the Notifications panel's transport flag. These
were the 31/08 committee's P-02, P-03, O-1 to O-7 and its eighth defect
(see [`40`](40-comite-revue-documentation.md)).

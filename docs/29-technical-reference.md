# Technical reference — description, schema, modules

**As at v5.3.0 · 2026-08-31.** This document is the current-state map of
the product: what it is, the modules it is made of, every table in the
database, and every capability the code actually carries. It was produced
from a full read of the source — the 26 migrations, the shared engine,
the route surface, and the 21 screens — not from the earlier design
documents. Where it disagrees with [`03-target-architecture.md`](03-target-architecture.md),
this document describes what shipped; `03` remains the record of what was
targeted.

---

## 1 · Project description

**Meridian IT-PMO** is a self-hosted project portfolio management system
for a group that runs several sites — a programme office in one country,
delivery teams in others, an auditor who will eventually ask why a
decision was taken in March. Version 5.3.0, Apache-2.0, no telemetry, no
licence check, no outbound network request in a default installation.

It covers the full portfolio lifecycle: demand intake and capital
prioritisation, earned-value and critical-path tracking, stage gates with
verified evidence, RAID and change control, resource capacity with
rotation and absences, a multi-currency cost ledger with commitments,
benefits realisation, PRINCE2-style tolerances with automatic exception
raising, a lessons-learned register, and the weekly and monthly meetings
that run on top of all of it — generated from the portfolio rather than
typed into a deck.

Three principles the codebase holds to everywhere:

- **Authority is data, not convention.** Every authority decision is made
  once, server-side, in `shared/rbac.js`. The browser imports the same
  module only to decide what to draw.
- **The trail cannot be rewritten.** Every mutation writes an audit row
  inside its own transaction; the audit, closed-period and snapshot
  tables refuse `UPDATE` and `DELETE` at the database.
- **The meeting is generated.** Agendas are computed from live portfolio
  state, frozen verbatim when the meeting closes, and decisions and
  actions land back on the projects they concern.

**Stack:** Node 24 + Express 5, PostgreSQL (or PGlite — PostgreSQL 16.4
compiled to WebAssembly — when no `DATABASE_URL` is set), a vanilla-ES
front end built with Vite, no framework. Four runtime dependencies in
total (`express`, `pg`, `@electric-sql/pglite`, `cookie-parser`); no
third-party code touches a password. Ships as source, or as a Windows
service installer (`MeridianSetup.exe`, Node SEA + winsw + IExpress).

**Interface languages:** English and French, on both the client and the
server (refusal messages are composed server-side and are also the audit
record, so the dictionary exists on both).

---

## 2 · Module map

### `shared/` — logic both sides run

| Module | What it is |
|---|---|
| `engine.js` | The portfolio arithmetic, behaviour-frozen from v4: EVM metrics (SPI/CPI/EAC/VAC), critical path and float, gate status and advancement rules, RAID exposure and escalation, capacity bucketing, effective FTE after rotation/availability, prioritisation against a capital envelope, tolerance measurement and breach detection, benefit attainment, site clocks, the S-curve. Also the fixed vocabularies: 4 gates, 6 phases, RAID types, 11 ISO 21502 lesson categories, 9 document types. |
| `rbac.js` | The single authorisation gate: `can(user, action, resource)` over ~40 named actions, four roles (`admin`, `group`, `site`, `viewer`), grants that name exactly one programme or one site, group-only writes, admin-only writes, and the visibility rules. |
| `meetings.js` | Agenda generation: exception-only weekly agendas, full monthly steering packs, referral and cross-level action threading, section time-boxing. |

### `server/` — Express 5, Node 24

| Module | What it is |
|---|---|
| `index.js` | HTTP server and route mounting; thin on purpose. |
| `db.js` | One adapter, two engines: `pg` when `DATABASE_URL` is set, PGlite otherwise. Same SQL, same planner. Applies the ordered migrations at boot. |
| `migrate.js` | CLI for the same migrations (`npm run migrate`). |
| `auth.js` | scrypt with per-user salt, timing-safe comparison, server-side sessions stored as SHA-256 token hashes, forced first-login password change, deputy (`acting_for`) sessions. |
| `oidc.js` | Optional Entra ID sign-in (`MERIDIAN_OIDC_*`); absent from the UI until configured. |
| `audit.js` | `audited()` — the wrapper every mutation goes through: audit row with before/after images inside the mutation's transaction. |
| `rbac` (shared) + `pgerror.js` | Refusals with reasons; constraint violations translated into actionable 400/409s. |
| `portfolio.js` | The serialiser: database rows → the exact object shape the frozen engine reads. Money stored in whole units, divided by 1e6 at this boundary. Default settings live here. |
| `notify.js` | The notification pipeline: queue (never direct send), dedupe, grouping, severity, per-user locale and cadence, quiet hours in the *site's* timezone, SMTP delivery only when `MERIDIAN_SMTP_URL` is set. |
| `exceptions.js` | The hourly tolerance sweep: measures schedule/cost/benefit against the active tolerance and *records* exceptions — nobody has to volunteer bad news. |
| `probe.js` | Evidence liveness: re-checks approved document URIs; three consecutive failures alert, but a probe never changes a document's status. |
| `federation.js` + `routes/federation*.js` | SDP (IT-operations dashboard) federation: outbound pulls of actions/changes into a PII-free display cache, inbound `/v1` sync under a hashed service key. |
| `integrations.js` | Named integrations (INT-02): per-system API keys, SHA-256-hashed, scoped, rotatable, each attributed by name in the audit trail. |
| `openapi.js` | The API contract (INT-01), generated from the mounted routes; drift between routes, descriptions and the published file fails the build (gate F9). |
| `archive.js` | Reversibility (M-01): full export archive and `npm run restore` into an empty instance. |
| `adoption.js` | Adoption measurement (A-08): per-site usage indicators from data that already exists, plus the anonymous `usage_daily` counters — how many, never who. |
| `i18n.js` | Server-side French: per-request locale for refusals, notifications, minutes. |
| `import.js` / `routes/importcsv.js` | Book import (v4-compatible JSON) and CSV import with preview/apply. |
| `wbs.js`, `seed.js`, `seed-data.js`, `reset-book.js` | Schedule helpers; the demonstration book; the command that clears it for production. |

Route files: `routes/auth.js`, `routes/portfolio.js` (the bulk of the
API), `routes/meetings.js`, `routes/admin.js`, `routes/importcsv.js`,
`routes/federation.js` (admin-facing), `routes/federationService.js`
(SDP-facing `/v1`), `routes/v1.js` (public integration API `/api/v1`).

### `web/` — Vite, vanilla ES modules

| Module | What it is |
|---|---|
| `src/ui/kit.js` | The `h()` builder, dialogs, tables, charts — the "Instrument" design system, light and dark. |
| `src/ui/login.js`, `src/ui/guide.js` | Sign-in screen; the in-app first-steps guide. |
| `src/lib/api.js`, `state.js`, `permissions.js`, `i18n.js` | Fetch wrapper (401 → login, 409 → re-read), app store with collection-level refresh, the read-only RBAC mirror, the EN/FR dictionary. |
| `src/views/` | The 21 screens (§7). |

### `scripts/` — build, audit, operations

Nine static gates (`npm run audit`): route match, CRUD+audit coverage,
row-version coverage, control coverage, i18n coverage, field-help
coverage, kit-import hygiene, view render (all screens, all roles), and
OpenAPI drift. Plus the use-case sweep (286 use cases × 4 roles on a
fresh instance), the Windows packaging chain, the training instance, the
archive restore, and the admin handover.

---

## 3 · Database schema

46 tables, built by 26 ordered migrations (`server/migrations/001–026`)
applied automatically at boot. Identical SQL on PostgreSQL and PGlite.

### Cross-cutting conventions

- **Optimistic concurrency** — every mutable row carries `row_version`;
  an update asserts the version it read, a mismatch is a 409, never a
  silent overwrite.
- **Append-only records** — `audit_event`, `report_period` and
  `report_snapshot` carry database `RULE`s that turn `UPDATE` and
  `DELETE` into no-ops. History cannot be rewritten by application code.
- **Atomic identifiers** — `id_counter` (one row per prefix: `PRJ`,
  `RSK`, `CR`, `DOC`, `BEN`, `DEM`, `XL`, …) allocates ids with a single
  `UPDATE … RETURNING`, so concurrent allocations serialise.
- **Money** — `numeric` in whole currency units; the serialiser divides
  by 1e6 for display. Benefits are the deliberate exception: they carry
  their own `measure`/`unit` and are never money-converted.
- **Provenance** — `programme`, `project`, `activity`, `milestone` carry
  `origin ∈ (local, sdp)`; rows born from the SDP sync refuse local
  mutation of synced fields.
- **Secrets are never stored** — passwords are scrypt hashes, session
  tokens and integration/federation keys are stored as SHA-256 hashes
  only.

### Organisation & identity (001, 004, 021, 022, 025)

| Table | Purpose · notable columns |
|---|---|
| `site` | A delivery site: city, region, `tz_offset`/`tz_name` (drives plant windows and quiet hours), headcount/FTE, charter, network link (`link_mbps`, `link_kind`), `readiness` state, `champion_id` — the named local referent (A-12). |
| `programme` | A programme: name, sponsor, `manager_id`, `origin`. |
| `person` | The directory: role, site, `day_rate`, `employment` (staff/contractor), `rotation` ("4/2", "14/14"), `availability` %, supplier. Referenced from eleven places. |
| `app_user` | An account: unique email (case-insensitive), scrypt `pw_hash`+`pw_salt`, `role ∈ (admin, group, site, viewer)`, `must_change_password`, `locale` (en/fr), `notify_pref`, quiet hours (`quiet_from`/`quiet_to`). |
| `access_grant` | One row = one grant naming exactly one programme **or** one site (CHECK-enforced exclusivity). No wildcard grants — "all" is a property of the admin role. |
| `session` | Server-side sessions; `token_hash` (SHA-256, never the token), expiry, `acting_for` — the deputy authority, verified per request against the absence that justifies it. |
| `audit_event` | The append-only trail: who, when, action, entity, and full `before_json`/`after_json` images. `UPDATE`/`DELETE` refused by rules. |
| `app_setting` | Key/JSON settings: RAG thresholds (`amberSpi`…), CCB threshold, capital envelope, `documentHosts` (fails closed), notification retention/caps, org name, status date. |
| `id_counter` | Atomic id allocation, one row per prefix. |
| `usage_daily` | Anonymous adoption/security counters: one row per day per kind (`refusal`, `sign-in`, `sign-in-failed`, `write`). Counts how many, never who — the boundary is in the schema. |
| `integration` | Named integrations: unique name (appears in the audit trail), `key_hash`/`key_hint`, comma-separated `scopes` (empty = can do nothing), active flag, `rotated_at`, `last_used_at`. |

### Portfolio core (002, 004, 005, 008, 010, 011)

| Table | Purpose · notable columns |
|---|---|
| `project` | The unit of governance. `governance_level ∈ (group, site)` — the authority boundary, distinct from the delivery `site_id`. Method, dates + `baseline_finish`, budget/contingency (`contingency_used ≤ contingency` CHECK), phase, `gate`, health override with mandatory reason, `closed`. Extended by later migrations with: PIR verdict (`pir_on`/`pir_verdict`/`pir_note`), plant classification (`plant_impact ∈ (none, plant, safety)`) and MoC signature (`moc_*`), prioritisation scores (`fit/value/risk/effort_score` 1–5, `rank_seq`), `origin`. |
| `activity` | Schedule stages: dates + baseline dates, `weight` (share of BAC), `pct` complete, owner. |
| `activity_dep` | Finish-to-start links inside a project (self-reference forbidden). |
| `cross_dep` | Edges between projects on the integrated master schedule. |
| `milestone` | Milestones and gates (`kind`), due + baseline dates, `intrusive` flag for plant work, done. |
| `cost_line` | The append-mostly ledger: period (`YYYY-MM` CHECK), amount, category, contingency flag; corrected by reversing lines, never edits, so AC always reconciles. Finance depth (012): `kind` (capex/opex), `currency`, `fx_rate` as booked, `amount_local`. |
| `commitment` | Money promised and not yet booked (PO-shaped, editable by design): supplier, amount + currency + FX, capex/opex, status (Open → Part received → Received / Cancelled). |
| `raid_item` | Risks, Issues, Assumptions, Dependencies: 1–5 probability × impact, response, owner, review date; `project_id` NULL = portfolio-wide; `origin_site` records which site raised a concern on a group project. |
| `change_request` | Change control: cost/schedule/risk deltas, funding source, Pending → Approved/Rejected, `applied`. |
| `change_step` | The routed approval chain per CR: ordered steps, each with state, decider and comment. |
| `allocation` | Range-based resourcing: person × project × date-range × percentage (0–200), `capitalised` flag for the capex/opex split of effort. |
| `document` | Gate evidence and project documents: type, gate, revision, status (Draft → In review → Approved → Superseded). Verified-link evidence (014): `uri` (https + trusted host required at approval), `uri_locked_hash`/`uri_locked_on` (SHA-256 frozen at approval — changing the link drops the document back to In review), `supersedes` lineage. Liveness probe (020): `probe_state`/`probe_status`/`probe_fails` — never changes `status`. |
| `board_column`, `work_item` | The lightweight delivery board: columns with WIP limits, items with points and priority. |
| `report_narrative` | PMO-written narrative blocks that persist across weekly packs. |

### Governance & value (008–011, 015, 016, 024, 026)

| Table | Purpose · notable columns |
|---|---|
| `benefit` | Value realisation, deliberately not money-shaped: `kind ∈ (Production, Availability, Cost, Risk, Compliance)`, own `measure` and `unit`, baseline/target/actual in that unit, realise/measured dates, status (Forecast → Realised/Partially realised/Missed/Withdrawn). Measurement is project work; the verdict (`benefit.review`) is group work. |
| `report_period` | A period close: label, `status_date`, who closed it, `restates` — a correction is a new period naming the one it restates. Append-only by rule. |
| `report_snapshot` | What the board was told, per project per closed period: RAG + reason, the full EVM set (BAC/AC/EV/PV/SPI/CPI/EAC/VAC), progress, forecast/baseline finish, gate state, risk and benefit counts. `project_id` deliberately **not** a foreign key — the reported history outlives the project. Append-only by rule. |
| `demand` | The intake funnel: idea, sponsor, benefit note, estimated cost, 1–5 scores, status (New → Triaged → Approved/Declined → Converted); a decline carries its decider and reason; conversion records the resulting `project_id`. |
| `project_tolerance` | The delegated margin (PRINCE2 §Progress / ISO 21502 §6.5): `schedule_days`, `cost_pct`, `benefit_pct` — NULL = unbounded, zero = no margin; scope/quality/risk stated in `note`, never computed. Set by the level above; one active per project, superseded rather than overwritten. |
| `project_exception` | A breach, *recorded* by the hourly sweep, never raised by a person: dimension, `measured` vs `allowed`, Open → Answered/Withdrawn with one of PRINCE2's four answers (`Tolerance raised`, `Plan revised`, `Accepted`, `Stopped`). Partial unique index: one open exception per project per dimension, guaranteed at the database. |
| `lesson` | The lessons register (ISO 21502 §7.17): what happened / why / what to do differently, 11 categories, positive outcomes recorded too; survives its project (`ON DELETE SET NULL`, programme/site copied at entry); Proposed → Adopted (group act, visible to all sites) → Archived. |
| `site_window` | The plant calendar: `shutdown` (open for intrusive work) or `freeze` (closed to it), per site, dated. |
| `rollout_wave` | "The same thing at five sites": one row per project × site, sequence, planned/actual dates, Planned → In progress → Live/Held/Cancelled. |
| `person_absence` | Bounded, motivated absence (`rotation`, `leave`, `training`, `unavailable` — medical reasons deliberately not collected, G-03) with optional deputy. Deputy authority is capped at the absent person's own and audited under both names. |
| `timesheet` | Actual effort, minimal by design: person × project × week, a number of days. Displayed beside the plan; never rewrites the engine's arithmetic. |

### Meetings (003, 006, 007)

| Table | Purpose · notable columns |
|---|---|
| `meeting_series` | A recurring meeting: cadence (weekly/monthly), scope (`group`, `programme`, `site` — CHECK-enforced exclusivity), chair, weekday/time/timebox. Scope decides both the agenda content and who may run it. |
| `meeting_occurrence` | One run: scheduled → open → closed, with who opened/closed and when. While open, the agenda is computed live; closing freezes it. |
| `agenda_item` | The frozen agenda: ordered sections with `section_key` and `urgent` preserved (007), entity references for jumping to the item discussed. |
| `meeting_attendance` | Present / apologies / absent / deputy (with `deputy_for`). |
| `meeting_decision` | Immutable once the occurrence closes. `referred_to_scope` escalates a decision up a level; it headlines the broader series' agenda until an `answered_by` decision there resolves it. |
| `meeting_action` | Actions outlive their occurrence and chase the owner onto every subsequent agenda until closed; cross-level tasking flows down tagged with its origin. |

### Notifications (013, 018, 019)

| Table | Purpose · notable columns |
|---|---|
| `notification` | A queue, never a direct send: kind (9 kinds — action due/overdue, gate blocked, decision owed, digest, concern raised, site quiet, timesheet missing, evidence unreachable), severity (computed, never hand-set), subject/body in the recipient's locale, delivery state (queued/sent/failed/suppressed), **`read_at` separate from delivery**, `dedupe_key` (unique) and `group_key` (one message per object per day), `on_behalf_of` for deputies, `expires_on` retention date — the purge refuses to run until a retention period is configured. |
| `notification_subscription` | Fine-grained outbound preferences: kind × scope (portfolio/programme/site/project) × minimum severity × channel × cadence. The in-app centre is deliberately not subscribable — everything addressed to you always lands there. |

### Federation (005)

| Table | Purpose · notable columns |
|---|---|
| `ext_link` | Links to SDP items (meeting actions, inspection findings, report follow-ups, ITSM changes) — never copies (ADR-5): stable external id, mandatory project, optional activity pin, and a whitelisted, PII-free display cache (`title/status/kind/risk/due`) refreshed by sync, flagged `stale` when the feed no longer returns the item. |

---

## 4 · Functionalities

**Portfolio & performance.** Earned value per project and rolled up
(SPI, CPI, EAC, VAC, with a "too early to measure" guard); critical path
and float per project; an integrated master schedule with cross-project
dependencies and breach detection (five-day tolerance); RAG health,
automatic with a justified manual override; baselines and re-baselining
(group authority); S-curve and horizon views.

**Stage gates & evidence.** Four gates (Mandate, Design authority,
Readiness, Benefits), each with named evidence; gate advancement blocked
until evidence documents are Approved; approval requires an https link on
a trusted host (`documentHosts`, closed by default), hash-locked at
approval; an hourly liveness probe flags evidence that stops answering
without ever un-approving it.

**Demand & prioritisation.** An intake funnel (raise → triage → approve/
decline → convert), where a decline is a recorded decision; 1–5
fit/value/risk/effort scoring; ranking against a capital envelope with an
explicit above/below-the-line cut; hand-placed overrides preserved.

**Finance.** An append-mostly multi-currency ledger (capex/opex, FX
frozen at booking, corrections by reversing lines); commitments tracked
separately from costs; contingency draw-down bounded by the database;
capitalised vs expensed effort at the allocation level.

**Change control.** CRs with cost/schedule/risk deltas and funding
source; a routed approval chain (steps, states, comments); CCB threshold
routing; approval applies the deltas to budget, dates and contingency.

**Resources & people.** Range-based allocations bucketed into weekly
capacity; over-allocation and bench views; effective FTE after rotation
("4/2", "14/14") and availability; contractors and suppliers;
minimal weekly timesheets (actuals beside plan); absences with deputies —
a deputy acts *as* the absent person, within their authority, audited
under both names.

**Benefits & value.** Benefits in their own units (production,
availability, cost, risk, compliance), baseline/target/actual;
measurement by the project, the met/missed verdict by group
(`benefit.review`); one PIR verdict per project.

**Tolerances & management by exception.** Schedule/cost/benefit margins
set by the level above; an hourly sweep records breaches as exceptions —
measured vs allowed, on the same numbers as the screen; an exception
closes only by an answer (tolerance raised, plan revised, accepted,
stopped), never by the forecast drifting back.

**Lessons learned.** Proposed by whoever lived it, adopted by group,
surfaced by relevance (programme/site) when a new project starts;
positive lessons recorded alongside failures.

**Meetings.** Weekly exception-only agendas and monthly steering packs,
generated from live state and frozen at close; decisions (immutable once
closed), actions that chase their owner forward, attendance with
deputies; referral of a site decision up to programme/group and visible
tasking back down; minutes, printable packs, and ICS calendar feeds.

**Plant & site reality.** Shutdown/freeze windows owned by the site;
plant/safety classification of projects with an independent MoC
signature; intrusive milestones checked against windows; site readiness
and link quality; rollout waves per site.

**Notifications.** Nine kinds, queued rather than sent, deduplicated and
grouped, severity computed; an in-app centre with read/acted state; per-
user locale (EN/FR), cadence, subscriptions, and quiet hours in the
site's timezone (urgent pierces); delivery only when SMTP is configured,
with the queue visible either way; retention purge that refuses to run
unconfigured.

**Reporting & period close.** Live dashboards plus closed periods: a
close freezes per-project snapshots (append-only), a correction is a new
period that names what it restates; weekly digest; decision log; a
project status snippet exportable as Markdown.

**Interoperability.** SDP federation both ways (linked items with a
PII-free cache, inbound sync under a hashed service key); named
integrations with scoped, rotatable, hashed API keys and audit
attribution; a public `/api/v1` (portfolio read, audit read) with an
OpenAPI contract generated from the mounted routes and gated against
drift; CSV import with preview; v4-book JSON import; full archive export
and restore (`npm run restore`).

**Identity & security.** scrypt passwords, hashed session tokens, forced
first-login password change, sign-in rate limiting, optional Entra ID
(OIDC) sign-on; four roles with per-programme/per-site grants; separation
of duties (raiser ≠ approver, deliverer ≠ verdict); append-only audit
with before/after images; anonymous usage counters; GDPR-minded data
minimisation (no medical reasons, no per-person surveillance).

**Adoption & operations.** Per-site adoption indicators (accounts seen,
last progress, meetings held, actions closed, weeks entered); a named
site champion; an in-app guide; a training instance (`npm run training`)
that never touches the real book; bilingual UI and server messages;
Windows service packaging; nine static build gates and a 286-use-case ×
4-role sweep.

---

## 5 · API surface

| Mount | Auth | Content |
|---|---|---|
| `/api/auth` | public → session | login/logout/me, seeded account list, password change, preferences, quiet hours, deputy sessions (`actas`), OIDC start/callback/status, the notification centre and subscriptions. |
| `/api` (portfolio) | session + RBAC | The bulk of the API: bootstrap and collection refresh, projects (health, phase, baseline, priority, plant, MoC, review, tolerance), activities and dependencies, milestones, cost and reversals, commitments, RAID, change requests with approve/reject, allocations, timesheets, absences, demand with convert, windows, waves, benefits, exceptions answer, lessons with adopt and relevance, documents with revise, work items, narrative, periods, audit read and restore-from-audit, digest, adoption, decision log. |
| `/api/meetings` | session + RBAC | Series, occurrences, open/close, attendance, decisions, actions, minutes, printable pack, ICS feeds. |
| `/api/admin` | admin | Users, grants, passwords, session revocation, people/sites/programmes/columns, settings, integrations (issue/rotate/revoke keys), notifications sweep, import/export/reset, archive. |
| `/api/import` | session + RBAC | CSV template, preview, apply. |
| `/api/federation` | admin | SDP settings, inbound key, feed browsing, link create/pin/unlink, cache refresh. |
| `/v1` | SDP service key | SDP-facing sync: resources, links, programmes, project summaries. |
| `/api/v1` | named integration keys | The public contract: `GET /portfolio` (`read:portfolio`), `GET /audit` (`read:audit`), `GET /openapi.json`. |

Full generated contract: [`openapi.v1.json`](openapi.v1.json), also
served live at `GET /api/v1/openapi.json`.

---

## 6 · Authority model

Four roles: **admin** (unrestricted), **group** (portfolio-wide read,
write inside granted programmes), **site** (read own sites + group
projects, write only site-governed projects in granted sites), **viewer**
(read only, ever). A grant names exactly one programme or one site.

Beyond the original matrix in [`04-access-model.md`](04-access-model.md),
the action vocabulary now includes: `document.approve`, `concern.raise`,
`benefit.write`/`benefit.review`, `period.close`, `window.write`,
`wave.write`, `moc.approve`, `demand.raise`/`demand.decide`,
`priority.write`, `absence.write`, `tolerance.set`/`exception.answer`,
`lesson.write`/`lesson.adopt`.

Group-only, whatever the project: baselining, the cost ledger,
contingency release, data import, the benefit verdict, period close,
lesson adoption, setting tolerances and answering exceptions — each for
the same reason: the person who delivers does not get to rule on their
own delivery. Admin-only: user management and global settings. Service
and integration keys can never open the interactive interface — their
role is unknown to `rbac.can()`.

---

## 7 · The 21 screens

| View | What it shows |
|---|---|
| `portfolio` | The book: every project in scope with health, progress, SPI/CPI, finish vs baseline. |
| `my` | My week: my actions, my projects, my entries owed. |
| `mysite` | The site cockpit: local projects, group projects landing here, concerns, absences and deputies. |
| `programmes` | Programme roll-ups. |
| `project` | The project page: schedule, gates and evidence, RAID, change, money, benefits, tolerance, waves, SDP links, lessons. |
| `schedule` | The integrated master schedule with cross-project dependencies. |
| `board` | The delivery board (columns, WIP). |
| `risk` | The RAID register and exposure profile. |
| `roadmap` | The portfolio timeline. |
| `pipeline` | Demand intake and the ranked capital queue against the envelope. |
| `budget` | The financial position: ledger, commitments, capex/opex, currencies. |
| `change` | Change requests and their approval chains. |
| `resources` | Capacity, over-allocation, bench, rotation, timesheets. |
| `documents` | The evidence library, probe results included. |
| `reports` | The weekly/monthly pack, closed periods and restatements, digest. |
| `meetings` | Series, agendas, minutes, actions, referrals. |
| `lessons` | The lessons register: propose, adopt, search by relevance. |
| `locations` | Sites: clocks, links, readiness, windows, champions. |
| `adoption` | Per-site adoption indicators. |
| `inbox` | The notification centre. |
| `admin` | Users, grants, settings, integrations, federation, archive. |

---

## 8 · Verification

- `npm test` — 375 tests, 53 suites (all green as at this document).
- `npm run audit` — the nine static gates.
- `npm run sweep` — 286 use cases × 4 roles + 72 view renders on a fresh
  instance.
- `npm run verify` — tests + build + gates + dependency audit.

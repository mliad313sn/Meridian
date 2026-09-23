# 33 · The RT365 field return — the request register, the Product Owner, and the loop

**Opened 8 September 2026** on the sponsor's instruction: *use the feedback
from the use of Meridian on RT365 to complete Meridian's development and
address every gap; redo the exercise from time to time, because that
repository is live too.* Then, the same day: *appoint a Product Owner to
drive every improvement, with full authority to decide, able to convene
counsellors and experts as needed, who must review the RT365 repository
to make sure every new improvement is really captured and handled* — and
*put in place, on Meridian, a very detailed list of the requests the
Product Owner of Meridian is to drive, and keep communication with him to
help him upgrade Meridian.*

This document is all three: the **charter** of the Product Owner (§1),
the **request register** in detail (§3), and the **communication loop**
with the programme that raised the requests (§4). The command that runs
the loop is [`/product-owner`](../.claude/commands/product-owner.md); the
machine-readable copy of the register is
[`docs/requests/rt365.json`](requests/rt365.json).

---

## 1 · The Product Owner of Meridian

| | |
|---|---|
| **Mandate** | Drive every improvement of Meridian raised by a field return to closure, in value order, without letting one drop. |
| **Authority** | Full authority to decide on the product: what enters the register, in which order, what is refused and why, what a line means when it is done. No decision of the Product Owner is subject to a committee's approval; the committees of docs/16–32 are **counsellors**, convened when their view is needed. |
| **What the authority does not cover** | The five rules of CONTRIBUTING.md (authority in `shared/rbac.js`, every mutation audited, `row_version` on every write, migrations never edited, tests never weakened) and the frozen arithmetic of `shared/engine.js` (D-05). Those are the product's constitution; the Product Owner works inside it or opens a numbered decision that changes it in the open. |
| **Counsellors** | Any expert the line needs: a code reviewer, a PMO practitioner, a security architect, an integrator, an operator, a native speaker for a translation. Convened by the Product Owner for a line, they advise; the Product Owner decides and records. |
| **Duty of review** | On every run, **before** deciding anything: read the RT365 repository — every branch, not only the default one — for what it says about Meridian, compare it with the register, and enter what is new. A request that RT365 wrote and Meridian never saw is the Product Owner's failure, not RT365's. |
| **Duty of record** | Every request has a line in §3 with its origin, the observation, the request in detail, the decision, what was delivered with its measure, and what remains. A line without a dated measure is not closed, whatever the state of the code. |
| **Duty of communication** | §4: a response to the programme that asked, in the shape it can consume — the JSON register, the tracking issue, and this document. |
| **Definition of done for a line** | The six conditions of docs/28 §3 (migration, route, serialiser, form, test — all five; authority in rbac; `npm run verify` green with the test count up; exercised in the browser; labels translated; consigned in this register in the same commit). |

The Product Owner was exercised for the first time on 8 September 2026 by
the delivery agent under this charter; the decisions of that run are in
§5.

---

## 2 · Where the return came from, and what it measured

RT365 (`mliad313sn/RT365`, branch
`claude/project-owner-agent-setup-hi3xqu`, commit `12a20a8`; re-read at
`25b0483` the same afternoon, again at `a90b1ae` — which brought
D-057 and REQ-14 — the branch had moved six commits, filed
the twelve issues, and added E-4 "two-way Meridian link once I-2 exists"
and PC-5 "nothing real in a demo book until H-28"; and a fourth time at
`02b9e9e`, by which point RT365 had **re-tested 5.10.0**, recorded all
twelve improvements as taken, and filed a new list V-1…V-12 for this
register, read in here as REQ-20…REQ-31) decided on
8 September 2026 to run its whole project lifecycle in Meridian
(ADR-017, D-049). It cloned Meridian 5.9.0 at `77c4b49`, ran the tests
(449/449), seeded it, loaded its programme through the API — sixteen
projects, gates A–F, 86 RAID items, fourteen decisions, twenty-one
actions — exported it and took screenshots. Its assessment
(`docs/PMO_MERIDIAN_ASSESSMENT.md`) scored twelve findings M-01…M-12 and
twelve improvement points I-1…I-12 in value order; its RAID log opened
O-73…O-76 against Meridian and its human-acts register H-28.

Its verdict, kept here because it is the frame of every line below:

> Meridian is efficient as the governance and rhythm layer of a real
> programme (it replaces the spreadsheet, the deck and the untraceable
> meeting) and, at this version, not sufficient as the delivery system;
> it needs a write API and integrations to stop being a place where truth
> is re-typed.

---

## 3 · The request register

Severity as RT365 scored it. **Status**: `done` (delivered with a dated
measure), `partial` (a first slice delivered, remainder named), `open`
(accepted, not started), `refused` (with the reason), `outside` (not the
software's to close). Every `done` line names its test.

### REQ-01 · The first hour — `done` 08/09 (I-1 · M-01, M-02, M-03 · O-73)

**Observed.** `npm install && npm run seed && npm run dev` gave an
in-memory book: nothing loaded `.env`, so `PGLITE_DIR` was unset and
PGlite opened without a directory; the seed left with the process and
the server started empty. With `PGLITE_DIR` set, `ENOENT` until
`server/.data` was created by hand. `npm run dev` before `npm run build`
answered `Cannot GET /`. Cost measured by RT365: about forty minutes per
newcomer, and a lost book for anyone running a real one that way.

**Requested.** Load `.env` (or default `PGLITE_DIR`), create the data
directory, make `dev` build or proxy the client, refuse to start a
non-training instance in memory without an explicit flag.

**Delivered.**
- `server/src/env.js` — `.env` at the repository root loaded once by
  `connect()` (so the server, seed, migrations, reset, restore and every
  script see it), never over a variable the shell set; `PGLITE_DIR`
  defaults to `server/.data/pgdata`, created recursively; in-memory only
  on `MERIDIAN_EPHEMERAL=1` or an explicit `dataDir: null` (the test
  harness). `/api/health` reports `ephemeral: true` when it is so.
- `scripts/dev.mjs` — `npm run dev` builds the client when `web/dist` is
  missing (`--build` forces it) and then starts the server;
  `npm run dev:server` is the bare server. `scripts/restart.sh` uses it.
- `server/src/index.js` — with no built client, `/` answers 503 with the
  command to run, not `Cannot GET /`.
- `.env.example`, README, CONTRIBUTING rewritten for the first hour.

**Measure.** `server/test/firsthour.test.js` (9 tests): file loaded,
shell wins, default directory created with parents, empty variable is
not a path, health says ephemeral, 503 page names `npm run build`.

### REQ-02 · Write API v1 with idempotency and external ids — `done` 08/09 (I-2 · M-05 · O-74 · INT-13)

**Observed.** `/api/v1` served two reads. Every write went through the
144 session routes of the browser; RT365's sync used them, pinned the
commit, encoded its identity in titles (`[O-11] …`) and re-read the whole
book on every run to stay idempotent.

**Requested.** `PUT /api/v1/{projects,milestones,raid,decisions,actions}`
keyed by `externalId`, an `Idempotency-Key`, scoped integration keys,
OpenAPI generated from the same routes.

**Delivered.**
- Migration 035: `(external_source, external_id)` on project, milestone,
  raid_item, meeting_decision, meeting_action, activity, work_item
  (unique per integration, NULL for what humans create); `progress_source`
  and `progress_at` on activity; table `idempotency_key`.
- Two write scopes, published with the routes that honour them:
  `write:portfolio`, `write:meetings` (`server/src/integrations.js`).
- Seven upserts in `server/src/routes/v1.js` → `server/src/v1write.js`:
  `PUT /api/v1/projects/:externalId` (scaffolds schedule, gates, evidence
  and criteria like the screen), `milestones` (PM-04 enforced: criteria →
  named `acceptedBy`), `raid` (with `gate`, `cr`, residual target),
  `activities` (bind to a stage, then `pct` with `source`/`measuredAt` —
  the first slice of I-5), `workitems`, `decisions` (immutable: same PUT →
  200 same row, different → 409 "supersede it"), `actions` (in an OPEN
  occurrence, by `occurrence` or `series`; the API never opens a meeting).
  References accept a Meridian id **or** the caller's own external id;
  people accept an id or the exact name. `version` optional: asserted when
  sent, last-writer-wins when not (the source system is the master of its
  rows — documented in the contract).
- `Idempotency-Key`: per integration; same key + same body → replayed
  answer with `Idempotent-Replayed: true`; same key + other body → 422;
  purged after thirty days by the hourly sweep.
- OpenAPI: request bodies read from `WRITE_BODIES`, responses 201/400/409/422,
  discovery lists every scoped route (`GET /api/v1`); gate F9 holds;
  `docs/openapi.v1.json` regenerated; the serialiser exposes
  `externalSource`/`externalId` on every collection that carries them.
- Every write is `audited()` under the integration's name with the
  external id in the detail.

**Measure.** `server/test/writeapi.test.js` (14 tests): scopes, create
then update on one row, money exact, scaffold present, no-op version
stable, refusals with reasons, two integrations both saying "E01",
PM-04 through the API, RAID by person name, decision immutability and
supersession, actions only in open rooms, progress provenance, work
items, idempotency replay/422/isolation/purge.

**Second round (counsellors, same day).** `adopt: "<Meridian id>"` on
every collection binds an external id to a row that already exists
(created on a screen, or scaffolded) — RT365's sixteen projects and 86
register rows migrate without a duplicate, and a scaffolded gate
milestone adopted this way is where "Gate A passed" lands, on the
milestone the engine reads (O-75 for real). `PUT /api/v1/criteria/:externalId`
puts REQ-04 on the contract. A `cr` reference resolves by Meridian id
(change requests carry no external id — the first version threw).
`version` omitted is now true last-writer-wins, without a phantom 409
when someone edited between the sync's read and write. The
`Idempotency-Key` is reserved before the handler runs (two identical
concurrent requests: one runs, one waits), the body is canonicalised
(key order does not matter), and a refused request frees its key.
Invalid `gate` numbers and `measuredAt` values are 400s, not 500s or
silent coercions; an intrusive milestone in a site freeze is refused as
on the screen (V-03).

**Remaining.** `PUT` for sites, programmes, people: structure is an
administrator's act, deliberately left to the session API and CSV
import (decision D-33.4). Inbound **events** (INT-13 proper — a webhook
receiver) are not needed once the upserts are idempotent; reopened if a
source system cannot call PUT. A standing human act (RT365's H-nn) is
not a meeting action: the API raises actions only in an open room, so a
standing act is either a RAID `Dependency` with a review date, or an
action of a standing series whose occurrence the Product Owner opens
monthly — D-33.14 says which.

### REQ-03 · A gate ladder per programme — `done` 08/09 (I-3 · M-04 · O-75)

**Observed.** Four gates and six phases scaffolded on every project and
not replaceable; RT365's six gates A–F sat as plain milestones beside
Meridian's four, and evidence and phase advancement bound to the wrong
ones. A reader could take Meridian's phase for the authorised environment.

**Requested.** A configurable ladder per programme (name, order,
evidence required, authorising body), the four gates as the default.

**Delivered.**
- Migration 036: `programme.gate_model jsonb` (NULL = the default four).
- `shared/engine.js`: `normaliseGateModel` (one validator for server and
  browser, 1–12 gates, ascending positions), `parseGateLadder` /
  `formatGateLadder` (the text an administrator types: `name | owner |
  evidence, comma separated | at%`), `Engine.gates(db, projectId)`,
  `Engine.maxGates(db)`; `currentGate` walks the project's ladder. The
  arithmetic of `gateStatus` is unchanged — only the list it walks.
- `server/src/wbs.js`: a new project takes its programme's ladder —
  milestones `kind='gate'`, one evidence document per gate (the last one
  is the closure document whatever its rank), and the criteria (REQ-04).
- Administration → programme dialog: the ladder textarea, validated with
  the line that is wrong named; every screen that listed `GATES` now lists
  the project's ladder (RAID "against gate", lessons, documents, gate
  board, the gate-model section which shows every ladder by programme).
- A changed ladder does not rewrite existing projects (their gates are
  dated, their evidence filed): decision D-33.2.
- **Phases stay six** (D-33.9): the phase is the lifecycle stage the WBS
  templates and the earned-value curve are built on; the ladder maps
  onto it by position. Issue #3's title asked for "ladder and phases";
  the phases part is refused with that reason.
- **A gate passes per project** (D-33.10): each epic walks its own copy
  of the ladder, dated proportionally to its window. A programme-level
  passage is the governance project's gate — RT365's `RBT-GOV` pattern —
  and the other projects' copies are informative. The default ladder
  seeds **no criteria** (D-33.13): evidence approved clears it exactly as
  before; only a declared ladder poses criteria at birth.

**Measure.** `server/test/gates.test.js` (3 tests for I-3): validator
refusals, six-gate programme → six gate milestones, six documents, last
one Closure, criteria posed; `Engine.gates` default for older programmes;
clearing the ladder returns to the default without touching projects.

### REQ-04 · Gate criteria with reviewed evidence — `done` 08/09 (I-4 · M-06)

**Observed.** "See evidence 0/1" counted approved documents. No
requirement/criterion object; no reviewer, date or link on what a gate
demands; "which test proves this gate criterion" unanswerable.

**Requested.** A criterion table per gate, evidence rows with type, link,
hash, owner, reviewer, date; a gate cannot pass with an unreviewed
criterion.

**Delivered.**
- Migration 037: `gate_criterion` (project, gate, seq, text, document,
  met, reviewed_by, reviewed_on, note; `met ⇒ reviewed_by` by constraint).
  Documents already carried link, locked hash, owner and approver
  (R-01/R-13) — the criterion is the requirement they prove.
- Routes `POST /api/criteria`, `PATCH /api/criteria/:id`,
  `DELETE /api/criteria/:id`: posing/reformulating is `document.write`;
  finding met is `document.approve` (group eyes on site projects' gate
  evidence, as for documents), requires a named `reviewedBy` who is not
  the owner of the evidence cited; a met criterion cannot be deleted,
  only reopened.
- `Engine.gateStatus` returns `criteria`, `criteriaMet`, `unmet`; `ready`
  and `Cleared` now require evidence approved **and** every criterion
  met; with no criteria nothing changes for existing projects.
  `canAdvance` names both what is outstanding.
- Scaffold: the ladder's evidence list becomes the gate's criteria.
- Project view: "Criteria for <gate> · n/m found met" under Milestones &
  gates, with pose / edit / found met (reviewer picked, evidence owner
  excluded) / reopen / remove.

**Measure.** `server/test/gates.test.js` (3 tests for I-4): pose,
reformulate, link evidence of the same project only; gate not ready until
met; no reviewer → 400; evidence owner → 400 "independent"; met → audit
"Gate criterion met"; met cannot be removed; site cannot find met on a
group project; viewer 403 on a visible project, 404 on an invisible one.

### REQ-05 · Progress and cost from source systems — `partial` 08/09 (I-5 · M-07)

**Delivered.** The provenance slice: `PUT /api/v1/activities/:externalId`
binds a source system's id to a schedule stage and reports `pct` stamped
with `progress_source` and `progress_at`; earned value then reads
measured progress; the serialiser exposes both; the audit row carries
before/after. Work items likewise by external id.

**Remaining (open).** The connectors themselves — Jira / Azure DevOps
(INT-10), ERP actuals (INT-11), ITSM (INT-12) — and cost lines by
external id. Decision D-33.5: connectors are written **from the source
system's side** against the write API; Meridian ships the contract, not
the adapters. RT365's own sync is the first such connector.

### REQ-06 · Operate-for-real kit — `done` 08/09 (I-6 · M-08 · O-76 · H-28 · G-01 · SaaS-03/04/05)

**Delivered.**
- `server/src/backup.js`, `npm run backup`, `npm run restore-drill`:
  `pg_dump -Fc` (PostgreSQL) or `dumpDataDir` (PGlite); the drill
  restores **elsewhere** (throwaway database / in-memory PGlite), recounts
  nineteen tables against the live book, times it, and records
  `backup.lastDrill`.
- `/api/health` carries the instance identity — `instance.org`,
  `instance.id` (new setting `instanceId`, Administration → Reporting),
  `instance.migrations` — and `backup.lastDrillAt / ok / restoreSeconds`
  (SaaS-04).
- `NODE_ENV=production` refuses PGlite unless `MERIDIAN_ALLOW_PGLITE=1`
  (or training); PG-01 unchanged.
- [`docs/34-exploitation.md`](34-exploitation.md): from nothing to a
  supervised instance, backup and drill schedule, second instance (shared
  database behind a balancer, or standby), proxy and TLS, upgrade tenant by
  tenant, fleet template (SaaS-05).

**Measure.** `server/test/backup.test.js` (4 tests): dump, restore
elsewhere with identical counts and the live book untouched, mismatch
named, result read by `/api/health`; `firsthour.test.js` for the
production refusal.

**Outside the software.** The tested backup, the second instance and the
signed policy remain **acts** of RT365's operator (H-28). The tools and
the template now exist; the acts are theirs.

### REQ-07 · Decisions as first-class records — `done` 08/09 (I-7)

**Observed.** RT365's decisions D-035…D-048, taken by an accountable
owner between meetings, had to be recorded as decisions of an artificial
occurrence opened for the purpose.

**Delivered.** Migration 034: `meeting_decision.occurrence_id` nullable,
anchored by constraint either to an occurrence or to a named decider and
a date; `alternatives`, `dissent`, `decided_on`, `raid_id`,
`milestone_id`, `supersedes`. `POST /api/decisions` (project write
authority, or group level portfolio-wide); links must exist on the same
project; **no PATCH, no DELETE** — a decision that changes is a new one
naming the old one. In-meeting decisions accept alternatives and dissent
too. `GET /api/decisions/log` merges room decisions and standalone ones,
with the decider named. Decision register screen: "Record a decision"
form with hints on every field a reader will need months later.

**Second round.** RT365's decision log carries what 034 had no home for
(D-33.11, migration 039): `council` (the deciding body when it is not one
person — "ARB", "Product Owner agent under D-040"), `evidence_uri` (the
minutes, the gate report), `provenance` (their `[Committee]` /
`[Owner instruction]` tags), `status` Proposed → Ratified with
`ratified_by`. The substance (headline, rationale, alternatives,
dissent, decider, date, project) is immutable; the state lives and every
change is audited with before/after. Headlines are no longer cut at 300
characters. The screen form carries all of it.

**Measure.** `server/test/decisions.test.js` (6 tests for I-7) and the
"second round" block of `server/test/writeapi.test.js`.

### REQ-08 · RAID linked to gates and change requests, reviews on the agenda — `done` 08/09 (I-8)

**Delivered.** Migration 034: `raid_item.gate`, `raid_item.cr_id` (the
change must belong to the same project); routes and form fields;
`gateStatus.risks` lists open items against a gate and the project view
shows the count on the gate line; the agenda gains **"Register items due
for review"** — `review_on` was stored since migration 002 and read by
nobody; a review no agenda asks for does not happen. Overdue first,
capped, excluding what the agenda already drew (not what the decision cap
deferred — that was the bug the first test found).

**Measure.** `server/test/decisions.test.js` (2 tests for I-8).

### REQ-09 · Release discipline — `done` 08/09 (I-9 · M-09)

**Observed.** `package.json` 5.9.0, published OpenAPI 5.3.0; no tags, no
releases; `verify.yml` the only CI.

**Delivered.** One version everywhere: `packageVersion()` in
`server/src/env.js` feeds `/api/health` (`build: sources|packaged`) and
`/api/v1/openapi.json`; gate **F10** (`scripts/audit/release-audit.mjs`,
in `npm run audit`) fails the build when `package.json`,
`package-lock.json`, `docs/openapi.v1.json` and `CHANGELOG.md` disagree,
and checks a tag `vX.Y.Z` when one exists; `.github/workflows/release.yml`
runs `verify` on a tag and publishes a GitHub Release with the changelog
section, the OpenAPI file and the built client. The signed installer
(S-16) stays with the sponsor's certificate.

**Measure.** F10 in `npm run audit`; `firsthour.test.js` asserts health
version = package version; `integrations.test.js` asserts OpenAPI version
= health version.

**Outside.** Tags are pushed by a maintainer, not by this run.

### REQ-10 · Stakeholders, skills, suppliers, communication plan — `partial` 08/09 (I-10 · M-12 · PM-05/07/10/11/12)

**Delivered.** PM-05 stakeholder register (migration 038 `stakeholder`:
person or organisation, interest × influence 1–5, attitude, engagement
mode, relationship owner, note; attitude changes imaged in the audit) and
PM-11 communication plan (`comms_plan`: audience, message, channel,
frequency, owner, next date; overdue lines flagged on the project view).
Both folded into the project view, CRUD under `project.write`.

**Measure.** `server/test/stakeholders.test.js` (3 tests).

**Remaining (open).** PM-12 skills in capacity, PM-10 contracts and
supplier performance, PM-07 scheduling depth (lags, site calendars,
constraint types). Decision D-33.6: stay on the docs/26 register in the
order the market committee set; PM-07 is two weeks of engine work that
touches frozen arithmetic and needs its own decision.

### REQ-11 · English translation of the committee record — `done` 08/09 (I-11 · M-11)

**Delivered.** `docs/en/16…32` — seventeen files, 319 KB, produced by
four translation counsellors convened in parallel, each opening with the
line that the French original governs. README links both.

**Remaining.** A native-speaker read-through of the translation is a
counsellor's act still due — same policy as the Spanish interface (I18N-02).

### REQ-12 · Day-one security posture — `done` 08/09 (I-12 · M-10)

**Delivered.** `server/src/posture.js` measures, at boot and on demand,
which seeded demo passwords still open an active account (ten scrypt
checks); production refuses to start while any does
(`MERIDIAN_ALLOW_DEMO_ACCOUNTS=1` to override); every other environment
says it at start-up and Administration shows a banner naming the accounts
and the closed-by-default settings waiting on a decision.
`GET /api/admin/posture` is the same as JSON. The administrator
break-glass exemption (S-13) is written in the banner, on the change
request an administrator raised, and **in the audit trail** of every
self-signed step. `docs/security-policy-template.md` is the page the
operator fills in.

**Measure.** `server/test/posture.test.js` (8 tests).

### REQ-13 · The sync's own workarounds (implied requests) — `partial` 08/09

Read from `scripts/meridian_sync.py`, not from the assessment — a request
a user did not write is still a request:

| Workaround in the sync | What it implies | Handled by |
|---|---|---|
| identity in titles `[O-11] …` | external ids | REQ-02 |
| a daily occurrence opened to hold decisions | decisions outside meetings | REQ-07 |
| `RAID_KIND` maps Gap / Observation / Open item / Decision onto the four kinds | a free category on register items | **open** — D-33.7: a `category` label on RAID is accepted for the next round |
| `GATE_EVIDENCE` typed into milestone `acceptanceCriteria` | criteria per gate | REQ-04 |
| people created with `role: name` | a stakeholder who is not a resource | REQ-10 (stakeholder register) |
| dates as placeholders "until O-17" | nothing for Meridian to do | — |
| `MERIDIAN_ALLOW_DEMO` refusal on the sync side | the same refusal on the server side | REQ-12 |

### REQ-14 · A milestone date says what it rests on — `done` 08/09 (RT365 D-057, no id)

**Observed.** Found by the third re-read of RT365 (branch at `a90b1ae`,
sixteen commits after the register was opened): decision D-057 sets the
roadmap form — gate-driven sequencing with earliest-possible conditions,
**no calendar date for gates C–F**, dates only for the owner's own
committed acts or from a measured basis, weekly re-baseline; "Meridian is
the schedule of record only after H-28". Meridian required a date on
every milestone, so RT365 could only type placeholders, which the agenda
would one day report as MISSED and the engine as Overdue. A request
nobody wrote, carried by no id — exactly what the probe's "files changed
since the last review" list exists for.

**Delivered.** Migration 040: `milestone.date_basis` (`committed` |
`placeholder`) and `milestone.condition` (the predecessor or measurement
that will produce the real date). A date stays mandatory — the engine
draws, sorts and compares with it — but a placeholder is a position on
the timeline, never a promise: the agenda never marks it MISSED and
announces it as a placeholder with its condition; `gateStatus` reports
`placeholder`, `condition` and a new state `Unscheduled` instead of
Overdue/Cleared by the calendar alone; existing rows are `committed` and
unchanged. Session forms and `PUT /api/v1/milestones` carry both fields.

**Measure.** `server/test/gates.test.js` (REQ-14 block): a placeholder
past its date is not missed, the same date committed is; a gate
milestone in placeholder is `Unscheduled`; the write API speaks the same
vocabulary.

### REQ-15 · Read back what you wrote — `done` 08/09, 5.11.0 (integrator, third round)

**Observed.** The integrator rewrote `meridian_sync.py` against the
published contract and loaded RT365's whole programme through it: 285
writes, a second run with `created: 0` and no new row anywhere. Then it
could not read any of it back. `/api/v1/portfolio` carries projects,
milestones, register items and criteria — not decisions, not actions, not
meetings. Three consequences, all measured: `adopt` on a legacy decision
or action has no discovery path (the only public trace is string-matching
a headline inside `/api/v1/audit`'s `detail`); no reconciliation of what a
room decided is possible without a session; and a sync cannot see that a
human closed an action before it reopens it — the integrator marked H-01
`Done` on the screen, re-ran the sync unchanged, and watched it reopen to
`Open` with a 200. The minute of a meeting was overwritten by a stale
ledger.

**Delivered**, and not where it was asked for. The integrator proposed
`decisions` and `actions` inside `loadPortfolio`, which would have put
the decision register into the screen's own bootstrap — handing
governance to a warehouse feed carrying `read:portfolio`, and to the
roles the screens refuse it. So: `GET /api/v1/decisions` and
`GET /api/v1/actions`, under a new `read:meetings` scope that mirrors
`write:meetings`. INT-02 separated the audit trail for exactly this
reason; a decision register is the same kind of thing. Each row carries
its `externalId` — which is how `adopt` finds a row written before it had
an identity — and its `version`. Actions carry `raisedInStatus`, so a
caller knows when it is about to write `Open` over the minute of a
meeting.

**Measure.** `server/test/writeapi.test.js` (REQ-15): a decision written
by the contract is findable by its own identifier, and a `write:portfolio`
key is refused on both reads.

---

### REQ-16 · Raise an action into the next scheduled occurrence — `open` (integrator, third round)

**Observed.** After setup, the rewritten sync needs exactly two session
calls per run, every run: create the daily occurrence and open it. The
API never opens a meeting — a chair does (D-33.14, and the rule holds).
But when the chair has closed the room, a new human act is 409 with no
public remedy, while the *next* occurrence already exists and is
`scheduled`. The documented workaround (a Dependency with a review date)
writes cleanly, and then the act leaves the actions register: RT365's
H-nn rows end up split across two registers by whether a room happened to
be open.

**To deliver.** `series` + `raiseIn: "next"` on `PUT /api/v1/actions`
(`upsertAction` in `server/src/v1write.js`): attach to the next scheduled
occurrence under the integration's name, without opening it. The last
recurring session dependency goes with it.

---

### REQ-17 · A public write for structure, under a scope an administrator grants — `open` (integrator, third round)

**Observed.** D-33.4 kept sites, programmes and people as administrator
acts. The integrator's drill showed the cost: a first load still needs an
administrator's password beside the integration key — and because the
gate ladder lives on the programme, REQ-03's own prerequisite is not on
the contract at all. The objection D-33.4 raised was governance, and a
scope an administrator grants deliberately is an answer to it.

**To deliver.** A `write:structure` scope (`server/src/integrations.js`)
and `PUT /api/v1/{sites,programmes,people}`, the programme carrying
`gateModel`. To be put to the interoperability committee first, as D-33.4
said.

---

### REQ-18 · A register item records when, and by whom, it closed — `open` (integrator, third round)

**Observed.** `PUT /api/v1/raid/{id}` with `status: "Closed"` answers 200
and reads back closed — and `closed_on` stays null. There is no writable
field for when a row closed or who closed it, so the ledger's closure
date is lost on every row a sync closes. RT365 closes register items from
its own ledger.

**To deliver.** `closedOn` and `closedBy` on the RAID write body, with the
same rules the screen applies.

---

### REQ-19 · A project date says what it rests on, as a milestone's does — `open` (integrator, third round)

**Observed.** REQ-14 gave milestones `dateBasis` and `condition`, and the
integrator confirmed both round-trip exactly. Projects have no
equivalent: `dateBasis` on a project is accepted and silently dropped.
RT365's project finish dates are placeholders for the same reason its
gate dates are — D-057 sets the same rule for both.

**To deliver.** `date_basis` and `condition` on `project.finish`, read by
the same engine paths REQ-14 touched. Note the wider hygiene item behind
it: the write API accepts unknown fields everywhere and refuses none, so
`category` on a register item, `sponsor` and `acceptanceCriteria` on a
project, and `status: "Closed"` on a project all answer 200 having done
nothing. A contract that never says no teaches an integrator the wrong
thing quietly.

---

### REQ-20…REQ-31 · What RT365 asked for after re-testing 5.10.0 (V-1…V-12) — three `done`, one `partial`, eight `open`

RT365 re-ran the whole assessment against 5.10.0 (`docs/PMO.md` §4,
`docs/PMO_MERIDIAN_ASSESSMENT.md` §7): 513 tests, the first hour working
with no `.env` and no `PGLITE_DIR`, 16 projects and 122 register items
loaded in 256 writes with a clean second run. It records all twelve of
its original improvements as taken, closes M-01…M-03 and M-05 in its own
findings table, and files a **new** list — V-1…V-12 — explicitly "for
Meridian's Product Owner through the register mechanism it created". They
are read in here as REQ-20…REQ-31, in the priority RT365 gave them.

| Ours | Theirs | Priority | What it asks for |
|---|---|---|---|
| REQ-20 | V-1 | highest | **`done` 5.11.0** — business case and benefits on the write API, under the same external-id, idempotency and audit rules as the delivery collections |
| REQ-21 | V-2 | highest | **`done` 5.11.0** — a benefit past its realisation date raises an agenda item and a portfolio exception, instead of sitting in a table nothing chases |
| REQ-22 | V-3 | highest | **`done` 5.11.0** — the business case is reconfirmed at every gate, and the gate cannot pass without it |
| REQ-23 | V-4 | high | Forecast against realised, per programme, in each benefit's own units |
| REQ-24 | V-5 | high | Prioritisation by value, confidence, risk exposure and capacity, with a visible weighting |
| REQ-25 | V-6 | medium | Adoption measured per rollout wave, linked to the benefits it should move |
| REQ-26 | V-7 | medium | Lessons offered as a checklist at the gate that would use them |
| REQ-27 | V-8 | high | **One ladder per project** — see below |
| REQ-28 | V-9 | medium | Decision latency, action ageing, gate cycle time, RAID review compliance, exception age |
| REQ-29 | V-10 | medium | A gate criterion may cite a commit or a checksum, not only a mutable document |
| REQ-30 | V-11 | medium | A value dashboard, printable, snapshotted per reporting period |
| REQ-31 | V-12 | high | The loop itself packaged as a pattern a second field repository can adopt |

**The three RT365 ranked highest were taken in the same round they were
filed**, with REQ-15 beside them because the integrator ranked it highest
of its own three (5.11.0; `CHANGELOG.md`). What each answers, in RT365's
own terms:

- **V-1** — 256 delivery writes and not one benefit: both value objects
  are now on the contract, under the same eight rules as the delivery
  collections. A benefit keeps its own unit and an `actual` without a
  measurement date is refused, because a figure nobody can situate a year
  later is not a measurement.
- **V-2** — "a date in a table that nothing chases is how value reporting
  dies": an unmeasured benefit past its date now raises a portfolio
  exception, notifies the person who owns it, and lands on the next
  agenda of a board that sees the project. Closed projects count, which
  is the case that mattered.
- **V-3** — "the single highest-value control a PMO owns, and the one
  most often skipped": a gate is refused until the case has been
  reconfirmed at THAT gate, on both write paths. Reconfirming carries a
  verdict — including `Stop`, which refuses the next gate — a named
  reconfirmer, and the two figures as they stood, so the next gate reads
  the delta.

**REQ-27 (V-8) is `partial`, and it is the one this round measured
rather than accepted.** RT365 filed it as a defect: "ten milestones where
six were intended", two ladders on the same project, and "which gate are
we at" therefore unanswerable. Half of it is already true, and this round
proved it again on a running instance — a programme was declared with a
six-gate ladder, a project created under it, and the project carried
exactly six gate milestones and none of the default four
(`server/src/wbs.js#scaffoldProject` reads the programme's ladder and
nothing else). What RT365 saw is the other half: its sixteen projects
were scaffolded **before** `RBT` carried a gate model, and a declared
ladder deliberately does not rewrite projects that already exist
(D-33.2 — dated gates and filed evidence would move under people's feet).

So the gap is the **migration**, and it is accepted as a gap: an explicit
act that moves an existing project onto its programme's ladder, adopting
the milestones that already match and refusing to duplicate the rest.
Until it ships there is a working answer today — `adopt` on
`PUT /api/v1/milestones` binds RT365's `Gate A…F` rows to the scaffolded
ones by their predictable ids instead of adding to them, which the
integrator confirmed on a full load.

---

## 4 · The communication loop with RT365

The programme that raised the requests keeps its own ledgers (RAID
O-73…O-76, H-28, ADR-017, `docs/PMO_MERIDIAN_ASSESSMENT.md`). Meridian
answers in three places it can read:

1. **This register** — the detailed answer, line by line, with the test
   that proves each claim. RT365 can re-run the assessment against
   5.10.0 and strike its findings.
2. **`docs/requests/rt365.json`** — the same register as data: id,
   origin, status, version, delivered artefacts, remaining. RT365's
   tooling (or its Product Owner agent) can diff it against its own
   RAID rows without reading prose.
3. **The twelve issues RT365 filed** on `mliad313sn/Meridian` the same
   morning (issues #1–#12, one per improvement point, I-n = #n; recorded
   on its side in `docs/IMPROVEMENT_REGISTER.md` §D and RAID O-73/O-74).
   That is the channel: the Product Owner answers **on the issue** — what
   was delivered, the test that proves it, what remains — and closes it
   when the line is `done`; a `partial` line keeps its issue open with
   the remainder named. A new request from RT365 is a new issue, and a
   new REQ line here. Answers to RT365's rows:

| RT365 row | Answer |
|---|---|
| O-73 (first-run defects) | closed by REQ-01; the workaround in `docs/PMO.md` §2 can be deleted — `npm install && npm run seed && npm run dev` now does what it says |
| O-74 (read-only API, identity in titles, pinned commit) | closed by REQ-02; `meridian_sync.py` can move to `PUT /api/v1/*` with `externalId` = its own ids, an `Idempotency-Key` **per request** (a key names one request, not a run — `<run>-<id>` is the shape), `adopt` for the rows it already created by name, and pin the branch instead of a commit until `v5.10.0` is tagged |
| O-75 (two gate models) | closed by REQ-03; declare the ladder A–F on programme `RBT` and create the epics after — their gates will be A–F, with the exit evidence as criteria (REQ-04) |
| O-76 / H-28 (operate for real) | tools delivered by REQ-06; the acts remain RT365's: PostgreSQL, a scheduled `npm run backup`, a monthly `npm run restore-drill`, the policy from the template |
| D-049 "Meridian's phase machine is not used for authorisation" | can be revisited: with a six-gate ladder and criteria that require a named reviewer, Meridian's gates can carry RT365's authorisation if the Product Owner of RT365 wants one record instead of two |

| E-4 "two-way link once I-2 exists" | I-2 exists (REQ-02). The reverse direction — decisions and actions recorded in a Meridian room flowing back to the ledgers — is served by the signed outbound events (INT-04, `Decision recorded` is a governance action) and by `GET /api/v1/audit`; nothing new is needed on Meridian's side. If RT365 wants a pull endpoint shaped for ledgers, that is REQ-14 — say so on issue #2 |
| PC-5 "nothing real in a demo book until H-28" | Meridian now enforces it: production refuses to start while a demo password opens an account (REQ-12) |

**The rules of the loop** (added on the PMO counsellor's review, D-33.15):

- **Counterpart.** RT365's Program Orchestrator (docs/PMO.md) is the
  requester of record; its Product Owner agent decides on its side.
  Meridian's Product Owner answers them by name on the issue.
- **Cadence.** Scheduled, since 08/09: the Routine *Meridian Product
  Owner — RT365 field-return round* (`trig_01JCnLkW5KAv4bNx4A2x3ELn`)
  fires a fresh session every weekday at 07:00 UTC. Each firing runs the
  review probe, captures what is new, drives the highest-value open line,
  convenes the two counsellors, pushes, and answers the issues it moved.
  A round that finds nothing new says so in one line and changes nothing —
  a quiet round is a complete round, not a missed one. The sponsor can
  pause or re-time it from the Routines list; `/product-owner` still runs
  on demand between firings.
- **Acceptance.** A line is `done` when it is on the branch with its
  test; it is `accepted` when the requester says so on the issue (a
  comment, or closing it themselves); it is `released` when a version
  tag carries it. **No line is `released` yet**: `v5.10.0` is tagged
  locally on `125d16c`, but a session cannot push a tag ref — GitHub
  answers 403 on it while branch pushes succeed, on four attempts across
  three commits — so a maintainer must push the tag before the release
  workflow runs (D-33.18, D-33.30). Until then RT365 pins the branch, not
  the version. One command, from a checkout of this branch:

  ```bash
  git fetch origin claude/meridian-rt365-feedback-d6vo3i
  git tag -a v5.10.0 origin/claude/meridian-rt365-feedback-d6vo3i \
    -m "Meridian 5.10.0 — the RT365 field return, and the committee that stopped it five times"
  git push origin refs/tags/v5.10.0
  ```

  `docs/requests/rt365.json` carries all three states, and a `history`
  per line.
- **`accepted` is three-valued** (E-9, filed by RT365 against this
  register). `true` — the requester said so on the issue. `false` — the
  requester is in a position to answer and has not. `null` — the
  requester **cannot** answer yet: nothing is delivered to try, or they
  have said they cannot judge the line until they adopt the feature. All
  31 lines used to read `false`, which made a silent user and a blocked
  one identical to anyone scanning the register. Applied at
  `registerVersion` 8: the thirteen `open` lines are `null` (there is
  nothing to accept), and REQ-02, REQ-04 and REQ-05 are `null` because
  RT365 wrote that it cannot confirm them without adopting them — a real
  integration, a real gate, a connector. The schema refuses `accepted:
  false` on an `open` line, so a later round cannot re-introduce the
  confusion; `channel.acceptance` in the JSON carries the sentence for
  each state (D-33.37).
- **Escalation.** When RT365 rejects a refusal or a `done`, the line
  goes back to `open` with the objection quoted, and the sponsor of
  both repositories is the tie-breaker, named in the next D-33.n.
- **Register version.** `registerVersion` in the JSON increases on every
  round; RT365's tooling diffs against the version it last read.

**Cadence.** The Product Owner reviews RT365 on every `/product-owner`
run and at least weekly while RT365 is live. `npm run review:field`
(`scripts/field-review.mjs`; `scripts/rt365-review.mjs` is the same round
under the name RT365 has written down) fetches every branch of RT365,
extracts every line that names Meridian with the ids **the register
declares** in `source.vocabulary` — M/I findings, O RAID rows, H human
acts, D/ADR/PR for context — and prints what the JSON register does not
yet carry; the issues on this repository are read with the GitHub tools.
The register path, the repository, its clone URL and the vocabulary are
all configuration: the loop is published as a pattern in
**`docs/35-field-return-loop.md`**, its shape in
`docs/requests/register.schema.json`, and a second field repository is
reviewed end to end by `server/test/fieldreturn.test.js` (D-33.36). The
first run of the probe, minutes after the register was written, found the
branch six commits ahead — which is the whole reason the probe exists.

---

## 5 · Decision log of the Product Owner

| # | Date | Decision | Alternatives refused | Dissent |
|---|---|---|---|---|
| D-33.1 | 08/09 | Take every one of I-1…I-12, in RT365's value order, in one release (5.10.0) rather than spreading them over R5. | Alternate with the docs/26–27 registers as docs/28 prescribes (refused for this round: the field return is one coherent source and its value order is measured). | none |
| D-33.2 | 08/09 | A changed gate ladder does not rewrite existing projects. | Re-scaffold gates on change (refused: dated gates and filed evidence would move under people's feet). | none |
| D-33.3 | 08/09 | Decisions are append-only; correction is supersession. | PATCH with an audit image (refused: a decision that changes silently is the thing the register exists to prevent). | none |
| D-33.4 | 08/09 | The write API covers portfolio content, not structure (sites, programmes, people stay administrator acts and CSV import). | Full upsert of structure (deferred: a connected system creating sites is a governance question the interoperability committee should hear first). | none |
| D-33.5 | 08/09 | Connectors (Jira, ADO, ERP) are written from the source system's side against the write API; Meridian ships the contract. | Adapters inside Meridian (refused for now: every adapter is a dependency on a vendor's API and the market committee refused twenty connectors for four surfaces). | none |
| D-33.6 | 08/09 | PM-07, PM-10, PM-12 stay on the docs/26 register. | Deliver PM-12 skills as a text field (refused: a field nobody computes with is decoration). | none |
| D-33.7 | 08/09 | Accept a free `category` label on register items for the next round (from the sync's `RAID_KIND` mapping). | Extend the four kinds (refused: the four are ISO 21502's and the escalation rules read them). | none |
| D-33.8 | 08/09 | Two counsellors are convened before every push of a field-return round: a code reviewer on the diff, a PMO practitioner on the register against the delivered product. | None — the sponsor asked for it. | none |
| D-33.9 | 08/09 | Phases stay the six the WBS and EVM are built on; the programme ladder maps onto them by position. | A phase model per programme (refused: the phase drives templates and the earned-value curve — frozen arithmetic). | PMO counsellor: issue #3 said "and phases" |
| D-33.10 | 08/09 | A gate passes per project; a programme-level passage is the governance project's gate. | Programme-level gate rows (refused for now: no engine reads them; revisit if RT365 asks). | none |
| D-33.11 | 08/09 | A decision carries council, evidence link, provenance and a Proposed/Ratified state; substance immutable, state audited. | Keep 034 as is (refused: RT365's rows lost four fields). | none |
| D-33.12 | 08/09 | `adopt` on every write collection; criteria on the contract. | A migration script for existing books (refused: the API is the migration). | none |
| D-33.13 | 08/09 | The default ladder seeds no criteria; only a declared ladder does. | Seed for all (refused: the code counsellor traced eleven surprise criteria and a group-only clearance on every new site project). | none |
| D-33.14 | 08/09 | A standing human act is a RAID dependency with a review date, not a meeting action; the API keeps raising actions only in open rooms. | Actions without a room (refused: an action is what a room asked of someone). | none |
| D-33.15 | 08/09 | The loop gains a counterpart, a cadence, three acceptance states, an escalation rule and a register version (§4). | None. | PMO counsellor asked for it |
| D-33.18 | 08/09 | The review is scheduled, not remembered: a weekday Routine fires a fresh Product Owner round; and `released` waits on a maintainer's tag push, which a session cannot do (403 on a tag ref). | Rely on the next person to run `/product-owner` (refused: a duty nothing fires is a duty nobody performs — the branch moved sixteen commits between two reads on the first day). Push the tag from a session (refused: it is a permission boundary, not an obstacle to route around). | none |
| D-33.17 | 08/09 | A milestone date is mandatory but carries a basis; a placeholder is never missed or overdue. | A nullable date (refused: every screen sorts and draws by it; a null would have touched the roadmap, the Gantt, the agenda and the horizon). | none |
| D-33.16 | 08/09 | `/api/health` stays unauthenticated and names the organisation and the instance — a supervisor holds no session; the proxy can hide it. | Authenticate it (refused: fleet supervision is the point). | code counsellor noted the disclosure |

| D-33.19 | 08/09 | The full committee is convened on the release **as built**, not on the diff: a security and code reviewer over the whole surface, an operator who runs the runbook from nothing on real PostgreSQL, and an integrator who rewrites RT365's sync against the published contract. Three blocking findings stopped the tag until closed. | Review the diff only (refused: every one of the five blocking findings was in shipped code the diff had already passed — the secret in the trail, the seizure on a refused request, the self-ratification). | none |
| D-33.20 | 08/09 | An integration's webhook signing secret never reaches the audit trail: a before-image on a table that holds a credential is built by allow-list, not by spreading the row. | Redact `webhook_secret` beside `key_hash` and leave the spread (refused: the next credential column added would leak the same way, silently — the spread is the defect, not the missing name). | none |
| D-33.21 | 08/09 | The transaction boundary of a write **is the request**: `adopt` no longer commits on its own, it plans a binding that joins the caller's own write and commits or rolls back with it. | Reverse the binding on failure (refused: a compensating write is a second chance to fail, and the trail would carry a seizure and its undo rather than nothing). | none |
| D-33.22 | 08/09 | Ratifying a decision is a segregated act, decided in `shared/rbac.js` (`canRatifyDecision`): the ratifier is a named person of the directory, and is neither the decider nor the account that recorded it. `can()` also closes by default on an unknown role. | Leave ratification to the integration's scopes (refused: `/api/v1` was the only path to the state, so a single key both proposed and ratified under a free-text name — the very segregation SECURITY.md names in scope). | none |
| D-33.23 | 08/09 | The decision register becomes a versioned row (041): its state writes under `row_version` like every other mutable row, `adopt` works, and the F2 exemption text says what is true — the substance is immutable, the state is not. | Keep it unversioned and guard the adoption per table (refused: it made the write path honest-looking while two integrations still overwrote each other in silence, and the caller was handed a `version: 1` that was never true). | none |
| D-33.24 | 08/09 | The backup and the drill ask the **book** who holds it — a marker carrying the host pid, written at open and removed at stop — instead of probing a guessed port; and both read `.env` before they read anything from the environment. | Probe every port in a range (refused: it answers "is something listening", not "is this book open", which is the question). | none |
| D-33.25 | 08/09 | The drill counts every table the book holds, discovered at run time, not a list of nineteen written once. `/api/health` reports the last **proven** restore separately from the last attempt. | Extend the list to fifty-two names (refused: the next table added would fall out of the proof the same way, and nothing would say so). | none |
| D-33.26 | 08/09 | The published contract speaks OpenAPI, not Express: `{externalId}`, and the `Idempotency-Key` header declared as a parameter rather than described in prose. | Leave the prose (refused: REQ-02 rests on that header, and no generated client exposed it). | none |
| D-33.27 | 08/09 | The gaps the integrator found that are not defects — `decisions` and `actions` absent from the v1 read, no public write for structure, no way to open a meeting from the API, no closure date on a register item, a project date with no basis — are recorded as REQ-15…REQ-19 for the next round, not smuggled into a release being tagged. | Take them now (refused: five blocking findings were already open on a release that was meant to be tagged; widening it is how the next five get missed). | integrator ranked the first three as the highest-value changes |

| D-33.28 | 08/09 | RT365's post-5.10.0 list V-1…V-12 is read into this register whole, as REQ-20…REQ-31, in the priority RT365 gave it — before any of it is scheduled. | Take the three "highest" now (refused: a release with five blocking findings open was already being tagged; the register exists so that reading a request and scheduling it are separate acts). | none |
| D-33.29 | 08/09 | V-8 is answered with a measurement, not an apology: a project created under a laddered programme carries exactly that ladder (proved again on a running instance), so the accepted gap is the MIGRATION of projects scaffolded before their programme declared one — and `adopt` on milestones is the working answer until it ships. | Rewrite existing projects when a ladder is declared (refused, D-33.2: dated gates and filed evidence would move under people's feet). Close V-8 as already-done (refused: RT365 measured ten milestones where it expected six, and the number is right — what it names is real). | RT365 filed it as a defect, not a preference |

| D-33.30 | 08/09 | The tag stays a maintainer's act. Attempted again on `125d16c` once the committee's five blocking findings were closed, and refused again: branch refs push, tag refs answer 403. Four attempts on three different commits establish it as a permission boundary of the session credential, not a transient failure. The command a maintainer runs is in §4. | Route around it (refused: it is a boundary, and the proxy status shows no relay failure for the host — the remote itself refuses the ref). Ship untagged and call it released (refused: `released` in this register means a tag a third party can fetch). | none |

| D-33.31 | 08/09 | The three RT365 ranked highest (V-1, V-2, V-3) are taken in the same round they were filed, with REQ-15 beside them; the other nine wait. | Take the whole list of twelve (refused: the value of the loop is that a request is answered in days, and twelve at once is how none of them is); take none until the tag is pushed (refused: the tag is blocked on a permission boundary, and holding delivery hostage to it would let a boundary set the roadmap). | none |
| D-33.32 | 08/09 | `decisions` and `actions` are read under a NEW `read:meetings` scope, not inside `loadPortfolio` where the integrator asked for them. | Put them in the portfolio serialiser as proposed (refused: that is the screen's own bootstrap, so a decision register would reach every `read:portfolio` warehouse feed and every role the screens refuse it — INT-02 separated the audit trail for exactly this reason). | integrator ranked it their highest-value change, and this delivers it by another route |
| D-33.33 | 08/09 | Passing a gate is refused when the case has not been reconfirmed at that gate — but only where a case EXISTS. | Require a case on every project (refused: the product would demand a document it never asked for, and every book in the field would stop at its next gate). Warn instead of refusing (refused: V-3 asks for the control that is most often skipped, and a warning is how it gets skipped). | none |
| D-33.34 | 08/09 | The patch of every upsert is filtered to what actually CHANGED, not what was sent. | Leave it and document the churn (refused: 285 audit events and 285 version bumps for a load that changed nothing makes the trail unreadable and moves a version under a reader who did nothing — the trail is the product's headline claim). | integrator measured it |
| D-33.35 | 08/09 | Two gates that were looking the wrong way are fixed rather than worked around: `business_case` is declared to the CRUD gate, and the field-help gate reads a whole field with balanced braces. | Reformat the field so the existing regex could see its hint (refused: the gate would have stayed blind for every future field with inline options — the defect was the gate, and a gate nobody can trust is worse than no gate). | none |

| D-33.36 | 08/09 | The loop is published as a pattern, not kept as a script: `meridian-request-register/1` becomes a JSON Schema held by a gate (F11), the review takes the register path, the repository, the remote and the **id vocabulary** as configuration, and a fixture field repository with its own vocabulary is reviewed end to end in a test. `scripts/rt365-review.mjs` stays as the entry point RT365 has written down. | Rename the command and update our own callers only (refused: the command is written down in a repository we do not control, and a loop that renames its entry point on the field's behalf is not published). Pull in ajv for the validation (refused: four runtime dependencies is a decision this product has already made, the schema is ours, and the subset it uses is closed — a hundred lines that shout at an unknown keyword beats a dependency that silently ignores one). | none |
| D-33.37 | 08/09 | `accepted` is three-valued: `false` is a silence, `null` is an inability to answer (E-9). The `open` lines and the three RT365 named as unconfirmable-without-adoption become `null`; the schema refuses `false` on an `open` line. | Add a separate `acceptedWhy` string (refused for now: a free-text field beside a boolean is where the meaning goes to hide — the three states are the mechanic RT365 asked for, and `channel.acceptance` carries the sentences). Mark every line `null` because filing upstream is a human act on their side, H-31 (refused: that is true of all 31 and would delete the distinction the request exists to create). | RT365 filed it as a process finding for their own Product Owner as much as ours |

| D-33.38 | 08/09 | A team is composed for the consolidated report rather than one engineer taking it in order: an interoperability engineer on the reusable loop, a verification engineer on the three claims RT365 tagged `[Open]`, and the delivery engineer on the two entangled groups (ladder integrity, value verbs). | One engineer, in RT365's sequence (refused: the three `[Open]` claims are measurements, not builds, and settling them changed what was worth building — one turned out not to be a defect at all). Four parallel builders (refused: three of the four groups touch the same files, and two agents editing one tree is how a green suite hides a lost edit). | none |
| D-33.39 | 08/09 | RT365's V-8 is re-filed as they themselves re-filed it. They corrected their own record mid-report: `scaffoldProject` reads ONE ladder, and the duplicate gates in their book came from their loader. The narrower request — a book adopted before the ladder existed — is answered with the read-side signal they offered as the cheaper of two remedies. | Re-scaffold existing projects onto the new ladder (refused, and 036 refused it first: dated gates and filed evidence would move under the people who filed them). Close V-8 as not-a-defect (refused: their measurement was real and the narrower need is real). | RT365 corrected it before we did |
| D-33.40 | 08/09 | The V-4 report never converts a unit. Money-denominated benefits are summed; everything else is listed in its own unit, and the page states how many were excluded and in which units. | A portfolio value in one currency (refused, and RT365 forbade it in the acceptance criterion: a factor from tonnes or availability points to currency is a number somebody invents and everybody then quotes). | none |
| D-33.41 | 08/09 | E-6 is answered with a measurement that contradicts it, and the smaller defect it uncovered is fixed. The six tiles do rescope; the right rail did not. | Accept E-6 as filed (refused: it is not true, and a register that records a wrong finding as delivered is worse than one that argues). | verification engineer measured both states |
| D-33.42 | 08/09 | V-9 (governance quality signals) is left OPEN with a written reason rather than carried silently, on RT365's own concern 6: "fifteen more requests from an enthusiastic field repository is a way to lose your own roadmap." | Take all fifteen (refused for that reason). Drop it (refused: it is the cheapest item left and needs no new data entry). | RT365 asked us to decline with a reason rather than carry debt |

| D-33.43 | 08/09 | The consolidated report is worked by a full committee, split by what it contains: a measurement counsellor who reproduces the headline finding and surveys every surface it reaches, an adoption counsellor who clones the default branch as a stranger would, and a contract counsellor on the two write requirements. | One engineer down the list (refused: three of their nine findings were tagged `[Open]` by RT365 themselves — measurements, not builds — and settling them changed what was worth building; one was not a defect at all). | none |
| D-33.44 | 08/09 | REQ-33 is taken as filed and then some: the guard requires a budget, both indices become `null` rather than 1.00, and a FOURTH health state `N` is added. "Too early to measure" and "nothing to measure" are both absences and neither is green. | Fix the guard only (refused, and the measurement proved why: with every project unmeasurable the roll-up's own `: 1` fallbacks kept the tiles reading 1.00 — the page would have gone on lying). Keep the honest branch green (refused: it is the branch that made an unstarted programme read ON TRACK). | none |
| D-33.45 | 08/09 | The frozen period is the reason this could not wait. The manufactured green was being written into `report_snapshot`, which is append-only at the database, so a wrong number became permanent history — reproduced in one API call. | Treat REQ-33 as a display defect (refused: a display defect does not become unamendable history at the next period close). | measurement counsellor found it; RT365 could not see it |
| D-33.46 | 08/09 | RT365's REQ-37 is declined as a defect and answered as a message — and their own fallback clause is declined with it. A wave IS a site; `seq` orders the sites, and removing it would delete the order of the rollout to fix a message. | Lift the constraint (refused: it would require weakening a test that has held since V-06, and the screen would read "0 live of 3" for one site). Remove `seq` as they offered (refused, with the reason above). | RT365 asked to be told no with a reason rather than carry debt |
| D-33.47 | 08/09 | A decision may cite evidence that lives in a repository. Prose stays refused. | Accept any string (refused: their own D-10 is the argument — a 200 on a body the route did not understand teaches the caller they wrote something). Keep http(s) only (refused: it cost them nineteen decision records' evidence). | none |
| D-33.48 | 08/09 | RT365's REQ-32 becomes REQ-39 in this register, because their numbering collided with ours a second time — they wrote §2.3 to avoid exactly this and our register moved after they read it. Their ids are theirs; ours are ours; the mapping is written in each line's `origin`. | Renumber ours to match theirs (refused: seven of ours are delivered and named in a changelog). Silently accept the collision (refused: it is how a register stops being readable). | RT365 raised the risk themselves |
| D-33.49 | 08/09 | **The merge to the default branch is put to the owner, not decided here.** F12 (`register-reachable`) is delivered so the debt is counted on every audit and a tag build that claims otherwise fails — but a gate that counts merge debt is not a substitute for paying it. | Merge it from this session (refused: the branch to develop on is designated, and pushing to another is not an agent's call). Leave it unmeasured (refused: 23 lines read `done` and 42 of the files they name do not exist for anyone who clones). | RT365 ranked it above every feature, twice |
| D-33.50 | 08/09 | The owner said *proceed*, so the merge became authorised — and it is still not done. Three actions were refused by this session's own permission classifier, not by git and not by GitHub: `git merge --ff-only` onto `main`, the direct `push origin <branch>:main` fast-forward, and `git tag -a v5.13.0` locally. This is a **third, different** boundary from the tag-ref 403 of D-33.18 / D-33.30: that one is the credential, this one is the harness. Recorded rather than worked around, because a boundary you route around once is a boundary nobody can trust again. | Retry under another shape until one gets through (refused: that is bypassing the intent of a denial, whatever the letter of it). Report it as done because it was authorised (refused: authorisation is not delivery, and this register exists because that gap was worth 23 wrong lines). | REQ-39 stays open |
| D-33.51 | 08/09 | **A closure with no date is not a closure.** `raid_item` gains `closed_on` and `closed_by`, and NOTHING is back-dated: a row closed before 045 is closed on a day nobody recorded, and null says exactly that. `closed_by` names a person from the directory, not the account that pushed the button — the audit trail already carries the second, and what an auditor asks a year later is on whose word the risk was lifted. | Back-date to `opened_on` or to the migration's own date (refused: it invents a history no one lived, and a false date is worse than an honest gap). Leave it to the sync to remember (refused: their own measurement is that it cannot). | REQ-18, filed as an API defect, found to be a product defect — the screen had the same hole |
| D-33.52 | 08/09 | **A project date now says what it rests on, and the sponsor is a person.** 040 did this for a milestone; RT365 says its project finish dates are placeholders for exactly the reason its gate dates are (their D-057). The date stays mandatory — the engine draws, sorts and compares with it — what is added is what it is WORTH. The project's sponsor resolves in the directory rather than being free text, unlike a programme's. | Make the date nullable (refused: it would touch every screen and the engine's comparisons). Accept a sponsor name as text, as `programme.sponsor` does (refused: on a programme the sponsor is a title named once; on a project it is somebody you telephone, and a name that does not resolve is a string, not a responsibility). | REQ-19 |
| D-33.53 | 08/09 | **Strictness is earned by making the fields real first.** The write API now refuses a body it does not understand — naming the key, listing what is accepted, pointing at the contract, saying nothing was written. It is only safe to turn on because `sponsor`, `acceptanceCriteria`, `status` and `category` stopped being unknown in the same migration. The REQ-19 suite was re-pointed at keys genuinely outside the contract rather than relaxed. | Turn strictness on first and add the fields later (refused: it converts a silent loss into a loud one and calls that progress). Keep accepting silently (refused: their own D-10 — a 200 on a body the route did not understand teaches the caller they wrote something). | REQ-19, their D-10 |
| D-33.54 | 08/09 | **Five governance signals, and every one of them may say « not measured ».** Computed from timestamps the book already keeps: no column was added, because wanting one means not having found the timestamp that already answers the question. A programme that has closed no gates does not have a cycle time of zero and is not doing well; a compliance with no denominator is not 100 %; one period is not a trend. The median leads and the tail travels with it. | Ship the five with zeros where there is no history (refused: that is REQ-33 again, in five new places, and REQ-33 wrote a manufactured green into an append-only snapshot). Defer it a third time (refused: it was the cheapest thing left on their list and we had already deferred it twice with a reason). | REQ-28, at their priority |
| D-33.55 | 08/09 | **The agenda stops calling a placeholder finish « late ».** A project that far behind still belongs on the agenda — the verdict withdrawn is the one about the date, not the one about the project. The forecast is still printed. | Leave it, since the register column and the project header were already fixed (refused: the agenda is the one screen whose whole purpose is to send a room after something, and sending a steering meeting after a slip nobody promised not to have is the most expensive form of this defect). | found by the contract counsellor in a file outside its own wave, and closed here |
| D-33.56 | 08/09 | **A router the gate's map does not name is invisible to the gate.** F1 reported `GET /signals` as a button that 404s while the route existed and answered, because `route-match.mjs` reads a hard-coded list of router files. Added `signals` to it. | Silence the entry (refused: the gate was lying in the safe direction, and a gate that lies in either direction is not a gate). | found while wiring REQ-28's screen |
| D-33.57 | 08/09 | **Three findings filed against ourselves, from inside a feature we were delivering.** REQ-45: a gate records `accepted_on` only when it carried acceptance criteria, so a gate ticked done without them has no date at all — 24 of 24 on the shipped demonstration book, which is why one of the five new signals reads `—` on a real book. REQ-46: the RAID register holds the NEXT review date and performing a review overwrites it, so compliance is statable today and unstatable for last month, forever. REQ-47: a decision has a ratifier and no ratification date (039), so "how long does ratification take here" cannot be asked. | Report the metrics and stay quiet about why two of them cannot speak (refused: it would make the measurement look like the defect, when the defect is underneath it). Fix them inside REQ-28's wave (refused: three schema changes smuggled in beside a read-only feature is how a wave stops being reviewable). | found while building REQ-28, not filed by RT365 |
| D-33.58 | 08/09 | **None of the five governance signals carries a colour.** `rag` is null when measured and `N` when not. Nobody has agreed what « too slow » means for this group, and a threshold chosen in our own file would be precisely the fabrication RT365 caught us at in REQ-33. | Pick amber and red thresholds ourselves so the tiles look like the rest of the product (refused: a colour is a judgement, and inventing the judgement is the same act as inventing the number). | REQ-28 |
| D-33.59 | 08/09 | **The register is versioned to 11 and five lines move.** REQ-18, REQ-19, REQ-28 and REQ-31 close at 5.14.0; REQ-13 becomes `partial` — its label half is delivered and its modelling half (H-nn as dependencies) stays open on purpose, because what a register item IS deserves its own round rather than being smuggled in beside a free-text field. Three of our own findings are added as REQ-45..47, renumbered after they collided with rows this register already carried — the second time a collision has been caught by the schema gate rather than by a reader. | Mark REQ-13 done because the field shipped (refused: the request has two halves and one of them is untouched). Leave our own findings out of their register (refused: they would then measure them, and hearing it from us is the whole point of the loop). | F11 caught the collision |
| D-33.60 | 08/09 | **The seeded business cases were built, measured, and reverted.** The demonstration book carries no business case at all, so REQ-20, REQ-22 and REQ-24 all open empty on a fresh install — RT365 would meet their own highest-priority request as a blank table. Six seeded cases fixed that and turned **19 tests red**: `case.test.js` relies on PRJ-101 having no case, and `prioritise.test.js` asserts a top-two ordering that only holds on an otherwise-empty ranking. Those tests are not wrong — they are correct against the book they were written for. Filed as REQ-48 and reverted. | Edit the nineteen assertions so the new seed passes (refused: that is changing tests to fit a demonstration improvement introduced at the end of a long session — the rule says never weaken a test, and this is the shape that rule is guarding against even though each edit would look reasonable alone). Ship it anyway and note the red (refused: a green summary over a red suite is the one unrecoverable error). | the ranking still opens empty, and every row says which input it lacks |
| D-33.61 | 09/09 | **A gate that was ticked without criteria gets a weaker pair of columns, not a borrowed strong one.** `milestone.done_on` / `done_by` sit beside 032's `accepted_on` / `accepted_by` rather than widening them. 032 means *a named person found criteria posed in advance to be met*; a gate with no criteria has nothing to accept, and writing an acceptance date where nobody accepted anything erases the very distinction 032 exists to hold. | Widen `accepted_on` to every done gate (refused: a reader could then no longer tell a named acceptance from a ticked box — the same class of fabrication as REQ-33's green). Back-fill the 24 undated gates from their due date (refused: nothing is back-dated, and null means « marked before we knew to write the day down »). | REQ-45 |
| D-33.62 | 09/09 | **A RAID review is an EVENT with its own row, not two columns holding the last one.** `raid_review` keeps one row per review performed; `raid_item.review_on` stays where it is and becomes the projection of the latest row's next date rather than a substitute for it. Each event also records what was DUE when it happened, so compliance is readable from the row, the replay reaches back past the first recorded review, and withdrawing an event restores the date it found in place. | Two columns, `last_reviewed_on` / `last_reviewed_by` (refused: they answer « when was this last looked at » and not the question REQ-28 asks — the second review destroys the evidence of the first exactly as the moving date destroyed the evidence of any, so the register would gain one day of memory, not a history). Invent an outcome vocabulary for a review (refused: nobody has agreed what those outcomes are called here, and a vocabulary written in our file is the threshold-invented-in-govsignals mistake). | REQ-46 |
| D-33.63 | 09/09 | **An item never reviewed is left OUT of the compliance replay, and the trend publishes a different `n` from the headline.** Its `review_on` holds a date, but that is today's date; using it as last April's due date borrows a neighbouring clock and hopes. The consequence is stated on the screen rather than hidden: the headline counts today's whole open register, the trend counts the part that has a history, and they converge as reviews accumulate. | Use the current column as the past due date (refused, and measured before refusing: it reported 100 % for four consecutive months across twenty items on the strength of a column nobody had evidence for — REQ-33 wearing a different hat). | the counsellor measured both and brought the honest one |
| D-33.64 | 09/09 | **We made a security hole worse, in the same release, and are saying so before anyone measures it (REQ-49).** `POST /api/decisions` takes `ratifiedBy` as free text with no directory lookup and no independence check, while the contract door has enforced `canRatifyDecision` since the security round. Before REQ-47 that was an unchecked NAME beside a status; now the same route writes `ratified_on`, so an unchecked ratification is dated and feeds a governance metric. **It is filed, not fixed.** | Patch it now, at the end of the wave (refused: closing it properly changes an authority rule and the decision form, and a hurried change to an authority rule is exactly how a check ends up weakened rather than applied — it is the first item of the next wave). Leave it unsaid until the fix lands (refused: this register exists because that gap was worth twenty-three wrong lines). | REQ-49, high |
| D-33.65 | 09/09 | **`trendNoHistory` is deleted rather than left reachable.** It said the register could not record that a review had happened. Migration 050 made that false, and a sentence that is no longer true must not be a state the product can reach. A window with no recorded review now says « nothing to trend », which is a different and honest claim. One test asserted the old sentence; its premise was overtaken by the schema, so it now asserts the new truth in both directions rather than being deleted. | Leave the key defined and unreachable (refused: an unreachable false sentence is a trap for the next reader, who will assume it can still fire). | REQ-46 |
| D-33.66 | 09/09 | **The value page extends `report_period`; it does not invent a second period.** `report_snapshot` could not carry it — one row per project with fixed EV columns, while five of the six figures are portfolio aggregates belonging to no project, so widening it would put a copy of the same total on every row, permanently and append-only. Two new tables hang off the period that already exists. | A second period concept for value (refused: two calendars is how a portfolio ends up with two versions of March). Widen `report_snapshot` (refused: the duplication would be written into an append-only table and could never be taken back out). | REQ-30 |
| D-33.67 | 09/09 | **The database refuses to store an unmeasured figure carrying a zero.** `CHECK ((state = 'N' AND value IS NULL AND length(why) > 0) OR (state = 'measured' AND value IS NOT NULL))`. REQ-33 was a manufactured green written into an append-only table, where a wrong number becomes permanent history; the guard therefore belongs in the schema, not only in the code above it. A test inserts the forbidden row to prove the refusal. | Trust the module that computes the figures (refused: that module was correct in 5.9.0 too, and the green still got stored). | REQ-30, after REQ-33 |
| D-33.68 | 09/09 | **« 0 exceptions open » is refused on a book that has set no tolerance — it shows `—`.** An empty exception register on a portfolio that declared no limits is not a clean bill of health, and this is the only screen in the product that says so out loud. | Show 0, as every other product does (refused: it is the most flattering wrong number available and the exact shape of REQ-33). | REQ-30 |
| D-33.69 | 09/09 | **The forgotten-table defect is closed as a CLASS, not as an instance.** A book that had stored a value page could not be reset at all: `reset-book` fails any table it neither clears nor declares kept, and its guard fires only at reset time and only when the forgotten table holds a row — so no suite ever saw it. The new test reads both lists against the live schema and fires the moment a migration adds a table. **It found a second instance on its first run**: `case_reconfirmation`, from REQ-22's work, meaning a book with a reconfirmed business case could not be reset either, and nobody had reported it. | Add the two tables and move on (refused, and the refusal paid for itself within a minute — this repository keeps five hand-written lists with the same blind spot, and four of them cost a release in this round alone). | REQ-52, half-closed; F1 and F2 still owe theirs |

*(one line per decision, appended by each run)*

---

## 6 · The measure of this round

| | Before (5.9.0) | After (5.10.0) |
|---|---|---|
| tests | 449 | 515 |
| static gates | 9 | 10 (F10 release audit) |
| `/api/v1` routes | 4 read | 4 read + 8 write |
| migrations | 033 | 040 |
| counsellors convened | — | 4 translators, 1 code reviewer, 1 PMO practitioner — 27 findings, all fixed or decided (D-33.9…16) |
| first hour on a fresh clone | ~40 min of traps (RT365) | `npm install && npm run seed && npm run dev` |
| open RT365 rows against Meridian | O-73, O-74, O-75, O-76 | O-73/74/75 answered; O-76 tools delivered, acts theirs |

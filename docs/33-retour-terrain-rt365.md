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
`25b0483` the same afternoon — the branch had moved six commits, filed
the twelve issues, and added E-4 "two-way Meridian link once I-2 exists"
and PC-5 "nothing real in a demo book until H-28") decided on
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
- **Cadence.** Every `/product-owner` run, and at least weekly while
  RT365 is live — a Routine on this repository can fire it; the sponsor
  decides whether to schedule one.
- **Acceptance.** A line is `done` when it is on the branch with its
  test; it is `accepted` when the requester says so on the issue (a
  comment, or closing it themselves); it is `released` when a version
  tag carries it. `docs/requests/rt365.json` carries all three, and a
  `history` per line.
- **Escalation.** When RT365 rejects a refusal or a `done`, the line
  goes back to `open` with the objection quoted, and the sponsor of
  both repositories is the tie-breaker, named in the next D-33.n.
- **Register version.** `registerVersion` in the JSON increases on every
  round; RT365's tooling diffs against the version it last read.

**Cadence.** The Product Owner reviews RT365 on every `/product-owner`
run and at least weekly while RT365 is live. `scripts/rt365-review.mjs`
fetches every branch of RT365, extracts every line that names Meridian
(assessment findings, RAID rows, human acts, ADRs, the sync script) and
prints what the JSON register does not yet carry; the issues on this
repository are read with the GitHub tools. The first run of the probe,
minutes after the register was written, found the branch six commits
ahead — which is the whole reason the probe exists.

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
| D-33.16 | 08/09 | `/api/health` stays unauthenticated and names the organisation and the instance — a supervisor holds no session; the proxy can hide it. | Authenticate it (refused: fleet supervision is the point). | code counsellor noted the disclosure |

*(one line per decision, appended by each run)*

---

## 6 · The measure of this round

| | Before (5.9.0) | After (5.10.0) |
|---|---|---|
| tests | 449 | 513 |
| static gates | 9 | 10 (F10 release audit) |
| `/api/v1` routes | 4 read | 4 read + 8 write |
| migrations | 033 | 039 |
| counsellors convened | — | 4 translators, 1 code reviewer, 1 PMO practitioner — 27 findings, all fixed or decided (D-33.9…16) |
| first hour on a fresh clone | ~40 min of traps (RT365) | `npm install && npm run seed && npm run dev` |
| open RT365 rows against Meridian | O-73, O-74, O-75, O-76 | O-73/74/75 answered; O-76 tools delivered, acts theirs |

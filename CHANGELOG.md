# Changelog

Every change to Meridian is versioned, and every version says what
changed and **why it was wrong before**. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the numbering
follows [Semantic Versioning](https://semver.org/).

What the numbers mean for an application rather than a library:

- **MAJOR** — an operator has to do something before upgrading: a manual
  migration step, a configuration change, a removed command.
- **MINOR** — new capability. Migrations apply themselves at boot.
- **PATCH** — a defect closed, or a document corrected. No new capability.

Unreleased work sits under `## [Unreleased]` until it is tagged.

---

## [Unreleased]

Nothing yet.

---

## [5.10.0] — 2026-09-08

The RT365 field return (docs/33). For the first time a programme that is
not this product's own demo ran its whole lifecycle in Meridian — sixteen
projects, six gates, 86 register items, fourteen decisions, twenty-one
actions, loaded by API on 5.9.0 — and wrote down what it found: twelve
findings, twelve improvements in value order, four RAID rows against
Meridian. This release takes all twelve, under a Product Owner appointed
the same day with full authority to decide, a duty to review the field
repository on every round, and a register that answers each request
where the programme can read it (`docs/33`, `docs/requests/rt365.json`,
`/product-owner`).

### Added

- **Write API v1** (I-2 · M-05 · INT-13): `PUT /api/v1/{projects,
  milestones,raid,activities,workitems}` under `write:portfolio` and
  `PUT /api/v1/{decisions,actions}` under `write:meetings`, keyed by the
  integration's **own identifier** (`external_source`, `external_id`,
  migration 035), with an optional **`Idempotency-Key`** (same key + same
  body replays; same key + other body 422). The same rules as the screens:
  scaffolded projects, PM-04 acceptance, immutable decisions, actions only
  in an open room. OpenAPI describes every body; discovery lists every
  scoped route. Why it was wrong before: the only public surface read, so
  the first integrator wrote through 144 undocumented session routes and
  encoded its identity in titles.
- **Gate ladder per programme** (I-3 · M-04): `programme.gate_model`
  (036); a project is born with its programme's gates, evidence documents
  and criteria; the default four are unchanged for programmes that
  declare nothing. Why: six real gates had to live beside four fixed ones.
- **Gate criteria** (I-4 · M-06): `gate_criterion` (037) — posed in
  advance, found met by a named reviewer who does not own the evidence
  cited; a gate is ready only when evidence is approved **and** criteria
  are met. Why: "evidence 0/1" was a count of documents, not an answer to
  "what does this prove".
- **Decisions outside meetings** (I-7): `meeting_decision` anchored to a
  room or to a named decider and date (034), with alternatives, dissent
  and supersession; `POST /api/decisions`; one register for both. Why: a
  decision taken between two meetings had to be smuggled into an
  artificial occurrence.
- **RAID against gates and changes, reviews on the agenda** (I-8):
  `raid_item.gate`, `raid_item.cr_id`; the agenda asks for register
  items whose review date has come. Why: `review_on` had been stored since
  migration 002 and read by nobody.
- **Progress with provenance** (I-5, first slice): a source system binds
  its id to a stage and reports `pct` stamped with `progress_source` and
  `progress_at`. Why: earned value read typed percentages.
- **Stakeholder register and communication plan** (I-10 · PM-05 · PM-11,
  038): interest × influence, attitude, engagement, owner; audience,
  message, channel, frequency, next date.
- **Operate-for-real kit** (I-6 · M-08 · G-01 · SaaS-03/04/05):
  `npm run backup`, `npm run restore-drill` (restores elsewhere, recounts,
  times, records), `/api/health` with instance identity and the last
  proven restore, `docs/34-exploitation.md`, `docs/security-policy-template.md`.
- **Day-one posture** (I-12 · M-10): the seeded demo passwords are
  measured at boot; production refuses to start while one still opens an
  account; Administration shows the banner; break-glass signatures are
  marked in the audit trail. `GET /api/admin/posture`.
- **Release discipline** (I-9 · M-09): gate **F10** (`release-audit`):
  package.json, package-lock.json, docs/openapi.v1.json and CHANGELOG.md
  must agree; `release.yml` publishes a GitHub Release on a tag.
- **English committee record** (I-11 · M-11): `docs/en/16…32`.
- The **Product Owner** role: `.claude/commands/product-owner.md`,
  `scripts/rt365-review.mjs`, `docs/33` §1 and §5.

### Second round, the same day — what two counsellors found

A code reviewer and a PMO practitioner were convened on the diff and the
register before the push (docs/33 §5, D-33.8). What survived their
verification is fixed here, not filed:

- `npm test` could have wiped a cluster named by `DATABASE_URL` in a
  developer's `.env`, because the harness's explicit `url: null` fell
  through to the environment once `.env` was read. An explicit null is
  now PGlite with no fallback, and the tests never read `.env`.
- `cr` on `PUT /api/v1/raid` and `/decisions` threw (change requests
  carry no external id); resolves by Meridian id.
- The default four gates seeded criteria on every new project, which
  would have required group-level reviewers to clear gate 1 on a site
  project (D-33.13): only a declared ladder poses criteria.
- `PUT /api/v1/milestones` skipped the site-freeze refusal (V-03);
  `assertPlantWindow` moved to `server/src/plant.js` and both paths ask it.
- `adopt: "<Meridian id>"` on every write collection, and
  `PUT /api/v1/criteria/:externalId` — without them RT365's existing book
  could not migrate and REQ-04 was a screen-only control (D-33.12).
- Decisions carry `council`, `evidenceUri`, `provenance`, `status`
  Proposed/Ratified and `ratifiedBy` (migration 039, D-33.11); substance
  immutable, state audited; headlines no longer cut at 300 characters.
- `version` omitted on a write is true last-writer-wins (no phantom 409);
  the `Idempotency-Key` is reserved before the handler runs, the body is
  canonicalised, a refused request frees its key.
- Invalid `gate` numbers (non-integers, beyond the ladder) and
  `measuredAt` values are 400s; the review probe passes third-party
  branch and file names as arguments, never through a shell; `pg_dump`
  and friends get the password through `PGPASSWORD`, not `ps`; the PGlite
  backup refuses to run while the server answers.
- Two tests asserted less than the code claimed (a `[200, 400]` and an
  agenda check that passed for the wrong reason); tightened, and six
  cases added for the paths the suite did not exercise.
- Runbook (docs/34): `createuser --createdb`, first administrator via
  `admin:handover` before `npm start`, tenant `.env` named in cron,
  restore-to-live and upgrade rollback, PGlite scripts refuse while the
  server runs.

### Third re-read of RT365, the same day

- **A milestone date says what it rests on** (REQ-14, from RT365's
  decision D-057 "no calendar date for gates C–F"): `date_basis`
  committed | placeholder and `condition` (migration 040). A placeholder
  is a position, never a promise — the agenda never marks it MISSED, the
  gate state reads `Unscheduled` instead of Overdue. Existing rows are
  committed and unchanged. Found by the review probe's "files changed
  since the last review" list, which is why that list exists.

### Third round — the full committee, on the release as built

Three counsellors reviewed 5.10.0 as a finished thing rather than as a
diff: a security and code reviewer over the whole surface, an operator
who built an instance from nothing on real PostgreSQL 16 and ran the
runbook line by line, and an integrator who rewrote RT365's
`meridian_sync.py` against the published contract and loaded the whole
programme through it. Five findings blocked the tag; every one of them
was in code the earlier diff reviews had already passed.

- **An integration's webhook signing secret no longer reaches the audit
  trail.** Deleting an integration wrote `webhook_secret` in clear into
  `audit_event` — append-only, served by `/api/audit` and
  `/api/v1/audit`, readable by every group account and every `read:audit`
  key, and impossible to redact afterwards. Anyone who read it could forge
  `x-meridian-signature` on delivered events. The before-image on a table
  that holds a credential is now built by allow-list.
- **A refused request no longer seizes a row.** `adopt` opened its own
  transaction and committed the binding before the request had finished
  validating, so a `PUT` that then answered 400 permanently bound a
  project the integration had never successfully written to — with no way
  back, since a bound row refuses every other adoption. The binding now
  joins the caller's own write and commits or rolls back with it.
- **Ratifying a decision is a segregated act.** One `write:meetings` key
  could propose a decision and then ratify it, naming any free-text
  ratifier, on the only path that reaches that state. `canRatifyDecision`
  in `shared/rbac.js` now requires a named person of the directory who is
  neither the decider nor the recording account, and `can()` closes by
  default on an unrecognised role.
- **The decision register is a versioned row** (migration 041). Its state
  has been mutable since 040 while the table carried no `row_version`:
  two integrations overwrote each other in silence, the caller was handed
  a literal `version: 1` that was never true, and the documented `adopt`
  answered 500. The F2 exemption text now says what is true — the
  substance is immutable, the state is not.
- **The backup and the drill ask the book who holds it.** Both probed
  `/api/health` on a guessed port; on a fleet each tenant has its own, so
  the probe found nobody, opened a *live* PGlite data directory, deleted
  the running server's lock files and reported "this backup was taken
  with the server stopped". A marker carrying the host pid, written at
  open and removed at stop, answers the question that was actually being
  asked.

### Fixed before the tag, from the same round

- `.env` is read before anything is read from the environment.
  `loadEnv()` ran inside `connect()`, so `DATABASE_URL`, `PORT` and
  `MERIDIAN_BACKUP_DIR` were all invisible to the module-scope code that
  needed them: on PostgreSQL the nightly backup refused every night
  claiming "this book is PGlite"; the drill could not find the backup it
  had just written; and `PORT` in a tenant's `.env` was ignored, so every
  instance bound 4173 and the fleet of §8 could not work.
- `scripts/restart.sh` works on Linux. It found the listening process
  through `powershell.exe`; where the fleet actually runs, the expression
  was empty, nothing was stopped, and the script launched a *second*
  server over the same book — the corruption it exists to prevent.
- The restore drill counts every table the book holds, discovered at run
  time, instead of a list of nineteen written once. A backup that had
  lost every allocation, timesheet, commitment, business case or
  stakeholder used to exit 0.
- `/api/health` reports the last **proven** restore (`lastDrillAt`)
  separately from the last attempt (`lastAttemptAt`). A drill failing
  every month looked recent and therefore healthy.
- `MERIDIAN_INSTANCE_ID` names an instance from its `.env`, as §8 of the
  runbook already promised; the screen setting still overrides it.
- The published contract speaks OpenAPI: `{externalId}`, not Express's
  `:externalId`, so a generated client no longer sends the literal
  parameter name — and `Idempotency-Key`, which REQ-02 rests on, is
  declared as a header parameter rather than only described in prose.
- A decision's substance comparison trims what the create path trims. Any
  rationale, alternatives or dissent ending in a space or a newline — a
  markdown cell, a heredoc, a multi-line rationale — was permanently
  non-idempotent: the byte-identical re-`PUT` answered 409.
- Posing and finding a criterion met in one `PUT` reports `created: true`.
  It fell through to the update path and reported a creation as an update.
- `writeRow`'s no-version branch asserts its identifiers again, restoring
  the tripwire `db.js` exists to be.
- The runbook (docs/34) no longer tells an operator things that are not
  true: `createuser`/`createdb` run as the postgres superuser, `npm start`
  does not return, §3b drops the database before restoring, the migration
  count is 41, the rollback point for an upgrade from before 5.10.0 is
  taken with `pg_dump` because that binary has no `backup` script,
  `/api/admin/posture` needs a session, and nothing marks a restore in the
  trail — the sentence that said it did is gone.

Five gaps the integrator found that are not defects — no `decisions` or
`actions` in the v1 read, no public write for structure, no way to raise
an action into the next occurrence, no closure date on a register item,
no basis on a project date — are recorded as REQ-15…REQ-19 rather than
added to a release being tagged (D-33.27).

### Fixed

- **The first hour** (I-1 · M-01..M-03): `.env` is loaded; `PGLITE_DIR`
  defaults to `server/.data/pgdata` and is created; a book in memory must
  be asked for (`MERIDIAN_EPHEMERAL=1`) and is announced; `npm run dev`
  builds the client when missing; `/` without a built client explains
  instead of `Cannot GET /`. Why: the README's one-minute start lost the
  seed on exit and cost a newcomer forty minutes.
- `/api/health` and `/api/v1/openapi.json` report the package version
  (`build: sources|packaged`) instead of `dev` and a five-releases-old
  number.
- The agenda's exclusion set for register reviews was built from items the
  decision cap had deferred, not from items actually drawn (found by the
  first I-8 test).

### Changed

- `NODE_ENV=production` refuses PGlite unless `MERIDIAN_ALLOW_PGLITE=1`.
- `npm run dev` is `scripts/dev.mjs`; the bare server is `npm run dev:server`.
- Discovery (`GET /api/v1`) lists every scoped route, read from the
  contract; the test that pinned "one endpoint per scope" now asserts
  "every scope served, every scoped route listed".

Tests: 449 → 515; gates 9 → 10; migrations 033 → 040.

---

## [5.9.0] — 2026-09-01

The process-acceptance committee (docs/32). Eight gates and 448 tests
had looked at the product — almost always from a book already full: the
demo seed provides the world, and each test exercises its own piece in
the middle of it. Nobody had replayed, in order and in one breath, the
life of an organisation that is just starting. The committee's
instrument is `server/test/journey.test.js`: one ordered walk from the
real production gesture (`resetBook()` + proven password) through
settings, structure, accounts, demand→project, framing, money,
tolerances, RAID, change control, evidence and gates, meeting rhythm,
value and signed closure, lessons, frozen periods, integration key and
archive — 34 measures, each asserting the flow AND the refusal the
register promises. It runs in `npm test` forever.

What walking the seams found (register in docs/32):

### Fixed

- **PR-03 — change-control segregation of duties hung on an optional
  link** (migration `033`). `change_request.raised_by` stored the
  raiser's *person* id; an account with no linked person raised with
  `raised_by NULL`, and "NULL is nobody" read as "nobody ever
  self-approves" — the inverse of the rule. **The raiser could approve
  their own change request.** A fresh instance's admin account — the
  production committee account included — is exactly an account with no
  person. The request now records the raising ACCOUNT too (accounts are
  never deleted — I-19), the rbac gate compares both, history is
  backfilled from the audit trail, and the approve button honestly
  disappears for the raiser.
- **PR-02 — a PATCH with no recognisable field was a false success.**
  It answered 200 with `version: undefined`, and the audit row
  "… updated" — written in the same transaction — stood: the trail
  asserted a change that never happened. Found by sending `decision:`
  instead of `status:` on a demand. `updateVersioned()` now refuses
  (400) and the rollback takes the lying audit row with it.
- **PR-01 — `resetBook()`'s table list was frozen at migrations ~013.**
  Nothing crashed (newer FKs are SET NULL/CASCADE) but demo lessons,
  demands and notifications *survived* the production reset as orphans.
  The list is complete again — and can no longer rot: after wiping,
  resetBook re-reads the catalogue and FAILS loudly, inside the
  transaction, naming any business table left non-empty and undeclared.

### Register

- **PR-04 (open, design decision)** — a change chain's steps are role
  *labels*, not grants: one person may sign every step. Either each step
  demands a distinct signatory, or the chain owns being a single-signer
  re-reading ritual and says so on screen.
- **PR-05 (confirmed correct)** — a contingency-funded change signs all
  the way through and it is the LAST signature — the applying one — that
  refuses when the held contingency cannot cover it. The control lives
  at the moment of the act, not of the promise; now pinned by the walk.

---

## [5.8.1] — 2026-09-01

### Fixed

- **The 401 nobody translated.** `requireUser()` answered with
  `res.json()` directly, but the global error handler is the only place
  `say()` runs — so “Sign in to continue”, the very first sentence an
  unauthenticated caller reads, stayed in English whatever the reader's
  language. Found by probing the live 5.8.0 service with `X-Lang: es`
  minutes after deploying it. All session refusals in `auth.js` (and
  `/api/auth/me`) now travel through the handler; a test exercises the
  real route in the three languages. The machine-to-machine surfaces
  (`/api/v1`, federation) keep their English `unauthorized` by design —
  an API contract, not a sentence for a person.

---

## [5.8.0] — 2026-09-01

R4 — “present where people work” — pronounced. Spanish (I18N-02) was the
one line holding it back; it lands here, **as a draft**: translated by
the assistant, flagged `(draft)` on the language toggle until a native
speaker reviews it on a real deployment (committee 29 §4 — the review is
an open register line, I18N-02b, not a memory).

### Added

- **Spanish, end to end** (I18N-02). Client dictionary at full parity
  with French (1053/1053 entries, 47/47 composed-fragment patterns), and
  the server side that committee decision 29 §4 makes the price of
  entry: refusals, sign-in errors and notification texts in
  `server/src/i18n-es.js`, with `es` joining `SERVER_LANGS`. Why it was
  wrong before: the interface could be read in Spanish only up to the
  first refusal — and a refusal is exactly the sentence someone reads at
  the moment they don't know what to do.
- **The F5 gate is now multilingual.** It used to check French alone, so
  a registered language could rot silently — and Spanish already had:
  the fragment mirror carried 18 of 47 patterns (“above the escalation
  threshold” rendered in French but stayed English in Spanish). The gate
  now walks every registered language: each t() literal must exist in
  each dictionary, and each fragment table must mirror FRAG pattern for
  pattern, in the same order — the order is part of the contract.
- **`say()` walks a registry** instead of naming French. Adding the next
  server language is one line and one dictionary file.

### Fixed

- **The front door taught in English — in every language.** The browser
  pass found the sign-in screen's account directory, access-level
  paragraph, role notes, “Loading the directory…”, placeholder texts and
  the SSO not-provisioned message all hard-coded in English — French had
  the same hole, invisible because those strings never went through t().
  All wrapped and translated (FR + ES), including the admin-only
  access-model panel. The part of the product people read BEFORE they
  can do anything was precisely the part no gate was watching.

---

## [5.7.0] — 2026-08-31

R4 — “present where people work” — all but one line. Spanish (I18N-02)
alone holds the pronouncement back.

### Added

- **Signed outbound events** (INT-04, migration `031`). What makes
  Meridian *reactive* for other systems, not merely queryable. The source
  is the audit trail itself, filtered on the same governance actions as
  `reporting.decisions` — one truth, two readers, held equal by a test
  that reads the view's SQL definition. Deliveries are HMAC-signed,
  retried up to eight times, and a dead webhook is *readable* in the
  delivery journal — a subscriber failing silently is a subscriber who
  believes it is informed.
- **Closure that is signed** (PM-08, migration `032`). Closing was a
  boolean. It now takes three signatures: the named operations owner who
  takes the delivery over, the benefits owner who accepts the baton —
  benefits realise *after* closure, and left with the project they belong
  to nobody — and the closing word.
- **Milestones that are accepted, not felt** (PM-04, migration `032`).
  Criteria are written before the work; a milestone that has them can
  only be marked done by naming who checked them, and the name stays.
- **Real meeting invitations** (INT-08): `METHOD:REQUEST` with a resolved
  organizer and real attendee addresses, `SEQUENCE` so an update replaces
  instead of duplicating, `STATUS:CANCELLED` when the occurrence closes.
- **A Microsoft Teams transport** (INT-06) for the notification queue —
  behind the same closed-by-default host list as every outbound channel.
- **SharePoint/OneDrive as evidence hosts, documented** (INT-09,
  `docs/31`): the recipe, what the locked probe state can honestly say,
  and the authenticated Graph probe deferred with its reason stated.

---

## [5.6.0] — 2026-08-31

### Added

- **Residual risk, and contingency that names its risk** (PM-06,
  migration `030`). The RAID register held probability, impact and the
  response *strategy* — never what the response is meant to **achieve**.
  Without a residual target, "did the mitigation work?" is answered from
  memory. And contingency was drawn anonymously: a committee asking "what
  was the reserve spent against?" had nothing to read. Now every risk may
  carry a target P×I on the same 1–5 scale (nullable — Accept has no
  target, it has an accepted finding, and forcing an invented number
  would be false assurance), and a contingency draw **must name the open
  risk it answers** whenever there is one to name. The ledger keeps the
  link line by line.

### Changed

- Two existing tests drew contingency without naming a risk. That was
  the old world; the rule is deliberate, so the tests were brought up to
  it — openly, not weakened: what they verified (reversal, the ceiling)
  is intact, they simply draw the way the product now accepts.

---

## [5.5.0] — 2026-08-31

**R3 — “conformant, and connectable” — is pronounced.** All six lines of
the release are closed with dated measures.

### Added

- **The business case, held as a record** (PM-03, migration `028`). The
  chain demand → case → benefit → review was broken in the middle: the
  case existed only as a document *type*. One case per project, written
  and reconfirmed by the paying level alone; PRINCE2's first question —
  “is it still worth doing?” — becomes a dated act at a gate. A case
  revised after its reconfirmation says so, by event order rather than by
  clock: two dates on the same day cannot say which came first, so
  reconfirming clears the revision mark and revising sets it.
- **The reporting schema** (INT-05, migration `029`). Fourteen stable
  read-only views under `reporting.*` — Power BI, Excel, Tableau and
  Qlik connect with no connector written. No earned-value numbers in SQL
  (the frozen engine stays the single truth; dashboards read
  `/api/v1/portfolio`), no secrets, no before/after images. Documented
  column by column in `docs/30`, and a test holds doc and schema equal
  in both directions.
- **The version-skew guard** (SaaS-02). A binary older than its database
  now refuses to start, naming the migrations it does not know — instead
  of failing query by query with no message saying why. The trap was
  lived, not imagined: an admin-handover nearly applied migration 023
  under the production binary that still read the old column.

### Fixed

- Four of the ten audit-action labels in the first draft of
  `reporting.decisions` did not exist — a filter on an invented label
  returns emptiness, not an error, and an empty register inspires
  confidence while lying by omission. Caught by grep before the
  migration shipped; held by a test that replays a real decision and
  reads it back through the view.

---

## [5.4.0] — 2026-08-31

The international, SaaS and multi-tenant strategy (committee report
`docs/29`), and its first three lines.

### Added

- **The tenancy decision, written down.** Multi-tenant SaaS is
  **one instance per tenant**, not a `tenant_id` column: this product
  sells an inviolable audit trail to industrial groups that are sometimes
  competitors, and isolation by code discipline is not isolation — one
  forgotten WHERE clause would show one group's portfolio to another.
  The product was already built for instance-per-tenant without knowing
  it: a single-file binary that migrates itself, an archive that IS
  tenant portability, and per-instance settings that become per-tenant
  settings for free.
- **A language registry** (I18N-01, migration `027`). The switch was a
  hard-coded EN/FR boolean and the database constrained the list itself;
  adding Spanish would have taken one migration per language. Languages
  are now data — a dictionary plus one registry line — the switch cycles,
  and the database constrains the *shape* of a code, not the list.
  Spanish and Portuguese are next, by the geography of the target market;
  Arabic is deferred **with the reason stated** (right-to-left is an
  interface project, not a dictionary).
- **Country and legal entity on every site** (MC-01). G-14 requires
  per-country legal advice and the product could not say what country a
  site is in; a data-subject request is answered by a legal entity, and
  nothing said which one carries which site.
- **A service installation refuses PGlite** (PG-01, sponsor's
  instruction). `MERIDIAN_REQUIRE_POSTGRES=1` is written by the
  installer; a start without a real PostgreSQL then fails with a message
  that says what to do, instead of silently running a governance book on
  a single-connection trial engine.

---

## [5.3.0] — 2026-08-31

### Added

- **The API contract, published and pinned to the code** (INT-01).
  Without a published contract nothing is integrable, and an integrator
  has to read the source to guess a shape nobody promised to keep. The
  description is **generated from the mounted Express routes**, not
  written beside them: a description kept alongside code goes stale
  silently, which is the worse of the two errors — it inspires confidence
  and lies by omission. Only the prose is written by hand.
  `GET /api/v1/openapi.json` serves the running instance's own contract,
  carrying the version actually deployed and the address it was asked at;
  `docs/openapi.v1.json` is published for whoever has no instance yet.
- **A ninth gate, F9.** It compares three things that must agree: the
  routes really mounted, the routes described, and the published file. A
  route without a description, a description without a route, or a stale
  file fails the build. Proven in both directions before being trusted —
  it caught its author's own undescribed route within a minute of
  existing.

---

## [5.2.1] — 2026-08-31

### Fixed

- `scripts/deploy-local.ps1` declared the extraction failed when it had
  not. The IExpress self-extractor **returns before it has finished
  writing**, so checking for `setup.cmd` immediately afterwards finds an
  empty directory. It now waits for the file to appear and stop growing.
  Found by deploying, not by reading — the same class of defect as every
  other one this project has caught by actually running the thing.

---

## [5.2.0] — 2026-08-31

### Added

- **Tolerances and exception management** (PM-01, migration `026`). The
  heaviest governance gap in the product, and the quietest: authority was
  delegated **without a bound**. Meridian could say a project had turned
  amber; it could not say it had gone past a limit somebody set. In the
  first case a person has to notice and be willing to carry bad news; in
  the second it comes up on its own, to whoever granted the margin, who
  must answer it. Schedule, cost and benefit are measured; scope, quality
  and risk are stated in words rather than pretended to be computed.
  The schedule is measured against the baseline, never the current plan —
  otherwise moving the date would clear the breach. An exception never
  closes by itself: the forecast may come back inside the margin, and the
  overrun still happened.
- Screen for the connected systems (INT-02): issue a key, change what it
  may do, rotate it, revoke it. Without it, connecting a system meant an
  HTTP call by hand — which guarantees nobody ever rotates a key, and a
  rotation nobody dares perform is not a rotation.

### Fixed

- An integration's shadow account appeared in the list of user
  accounts, offering "Edit" and "Grants" on something that is not a
  person. Those rows exist only so the audit trail can name the
  integration rather than write "system". Accounts in the reserved
  `.invalid` domain are now excluded from the account list, and stay
  visible where they mean something.

---

## [5.1.0] — 2026-08-31

The release that made Meridian free software, and closed the defects that
preparing it for other people made visible.

### Added

- **Lessons register** (PM-02, migration `024`). The gate model demanded
  “Realisation report, lessons learned” as evidence at gate 4 and the
  product had nowhere to put a lesson: it required a document it made
  impossible to produce. Whoever lived it proposes; the programme office
  adopts, and adoption is what makes it readable at the other sites. An
  adopted lesson crosses sites without naming the project it came from,
  so it never becomes a way to discover work outside your scope.
- **Named integrations with scoped keys** (INT-02, migration `025`), and
  the first `/api/v1` surface. One key per connected system, an explicit
  scope per key, rotation, revocation, and every act attributed **by
  name** in the audit trail. A key that only reads the portfolio is
  refused on the audit trail, and told what it holds.
- **Archive and restore** (M-01). One open file carrying the whole book
  *and* the audit trail, with no secret in it — so it can be handed to an
  escrow agent or a successor without an argument. `npm run restore`
  loads it elsewhere. This is not a backup, and the code says so.
- **Continuity panel** in Administration: export the archive, or end
  every session. Both existed as routes that no screen called.
- **`npm run admin:handover`** — create the next administrator and retire
  the previous one, in that order, with the new account's password
  verified against scrypt before anything is taken away.
- **Two more build gates.** `kit-imports` checks that every shared helper
  a file calls is a helper it imported; `view-render` boots an instance
  and actually draws all 21 screens under all 4 roles.
- Apache-2.0 licence, `NOTICE`, `SECURITY.md`, `CONTRIBUTING.md` and a
  CI workflow that runs the same `npm run verify` a maintainer runs, plus
  the migrations against a real PostgreSQL 17.

### Fixed

- **Administration could not be opened. At all. Since the first release.**
  `administration.js` called `selectField` without importing it; the
  `ReferenceError` was swallowed by the view's `try` and became an empty
  screen. Seven committees, 322 passing tests, six gates and a 286-case
  sweep never saw it, because nothing in the tooling drew a view.
- **A group account could chair any site's meeting** (S-17). The code
  said the route would narrow the scope; no route ever did.
- **Session tokens were stored as they travel** (S-14). Passwords have
  been hashed since day one; the token, which opens the same doors for
  twelve hours, was not. The column is renamed rather than reused, so an
  unconverted call fails loudly instead of silently matching nobody.
- **The sign-in rate limit could be walked around** (S-15). It counted
  identity *and* address together — the one pair an attacker never has to
  keep constant. Three counters now. It was a declared release blocker
  and had no test at all; it has four.
- **The client fetched its fonts from Google on every page load.** Every
  user's browser announced its address to a third party, a site on a poor
  link paid the wait, and the offline mode — an advertised feature —
  degraded. The fonts are packaged; the content-security policy no longer
  names any third-party host, which it had been quietly permitting.
- Delivery of queued notifications was called by no production code, and
  `notification_subscription` was written by a screen and read by nobody.
- A search box rendered its own source code as placeholder text, and a
  form's default project could land on a project the account may read but
  not write — a required field impossible to fill.

### Changed

- A service principal now has an explicit branch in `projectScopeSql`.
  It saw the whole portfolio by falling through the “viewer with no
  grants” case: the right result for the wrong reason, and a rule a
  future change to the viewer case would have reversed by accident.
- `.npmrc` is no longer shipped. A public repository carrying
  `strict-ssl=false` teaches a supply-chain weakness to everyone who
  clones it.

### Security

- The repository was scanned before publication — tracked files and the
  full history — for credentials, connection strings, personal addresses
  and machine paths. The only match is the documented placeholder in
  `.env.example`.

---

## [5.0.0] — 2026-08-29

The standalone baseline: client/server on PostgreSQL, real
authentication and authorisation, an append-only audit trail, and the
meeting module. Earned value, critical path, stage gates, RAID, change
control with segregation of duties, benefits and post-implementation
review, frozen reporting periods, demand and prioritisation, resource
capacity with rotation and deputies, plant windows and management of
change, evidence probing, the notification centre, adoption measurement,
a training ground, and a bilingual interface.

The reasoning behind each of those lives in `docs/`, one report per
committee, in the order they were held.

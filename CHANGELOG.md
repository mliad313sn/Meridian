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

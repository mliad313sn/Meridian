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

### Added

- **The notification module keeps its whole promise** (O-1, O-2 —
  `docs/32`). Five kinds were defined and never emitted; the hourly
  sweep now sends them all: a referred decision still unanswered (to
  whoever chairs the room it was referred to), a concern a site raised
  on a group project (to that project's manager), a site quiet for
  thirty days (to its champion — A-12 finally has a duty, not just a
  name), a week of effort not recorded (to the person, never their
  manager), and the daily/weekly digest. The bell-icon preferences now
  carry the quiet hours and the fine-grained subscriptions the API held
  with no screen — and delivery honours all four subscription settings:
  kind, minimum severity, **scope** (the message's entity resolved to
  its project, programme and site) and **per-subscription cadence**,
  one batch per period. Six tests hold it
  (`server/test/outreach.test.js`).
- **Adopted lessons are offered at project creation** (O-3): the
  relevant-lessons endpoint finally has a caller — the moment a project
  is created, at the one point a lesson can still change the plan.
- **The person form carries what V-09 promised** (O-4): employment,
  supplier, rotation and availability, editable and shown in the
  directory. The capacity arithmetic is deliberately untouched —
  migration 012 defines availability as already net of rotation, and
  folding rotation in again would double-count it; the engine comment
  now says so instead of promising otherwise.
- **Cross-project links are tolerance-checked** (O-7):
  `Engine.crossDepBreaches` — additive, the frozen arithmetic untouched
  — applies the same five-day-past-baseline rule to the edges of the
  integrated master schedule, and the Schedule banner counts them.

### Fixed

- **Nobody was ever told a tolerance was breached.** Migration 026's
  sweep queued `tolerance-breached` — a kind migration 018's CHECK
  refused, in a call that also omitted the NOT NULL `dedupe_key`, all
  swallowed by the catch that protects the sweep: the whole
  management-by-exception mechanism stopped at its last link,
  silently. Migration 027 admits the kind, the call carries its key,
  and a test holds the insertion. A catch that protects a flow must
  never protect a constraint.
- **A site lead whose granted site was not first in the list saw no
  "New project" button** (O-5): the visibility probe asked about
  `programmes[0]`/`sites[0]` only; it now asks about every
  combination.
- **Role labels and RAID natures now speak the interface's language**
  (O-6): Lecteur, Groupe, the four RAID natures and the level
  descriptions are translated; stored values stay English, as
  everywhere.

- **The documented quick start silently discarded the book.**
  `npm run seed && npm run dev` — the README's first three commands —
  seeded an **in-memory** PGlite instance, exited, and started another,
  empty: nothing set `PGLITE_DIR` on that path, and `server/.data/pgdata`
  was only ever a promise in `.env.example`. Found by the documentation
  review committee (`docs/32`) *running* the sequence, not reading it.
  The embedded engine now defaults to `server/.data/pgdata` (created
  recursively — PGlite does not create parent directories, the second
  defect the retest found); an explicit `dataDir: null` remains an
  in-memory instance, which is the test harness's contract and can no
  longer be overridden by a stray `PGLITE_DIR`.
- **Every manual health override returned 400.** The "Set project
  status" dialog collected the reason under `note` but posted `why:
  v.why` (undefined), which the server rightly refuses — an override
  without a readable reason is not an override; and it tested
  `v.rag === "auto"` where the source select is `v.mode`, so returning
  to the automatic status was impossible. Two keys, both wrong since
  the dialog was written; also a `docs/32` finding.

### Added

- **The trusted evidence hosts, finally on a screen** (R-01 follow-up,
  `docs/32` P-03). The approval refusal named the setting — "name the
  group's document estate (`documentHosts`, in Administration)" — and
  Administration offered no field to do it: on a fresh instance no
  document could ever be approved as evidence and no gate could
  advance without a hand-made API call. Settings gains an **Evidence**
  section on the same closed-by-default pattern as the webhook hosts,
  in both languages.

### Documentation

- **A documentation review committee, and its record**
  (`docs/32-comite-revue-documentation.md`). Four independent seats —
  accuracy against the code, manual-to-screen fidelity, French
  terminology against the product's own dictionary, cross-document
  coherence — produced 71 findings on the freshly written set; each
  closed with a source citation, or converted into an open product
  finding (O-1…O-7) for the register. The stale figures are gone
  (nine gates, not eight; 375 tests, not 356; 84 view renders under
  gate F8, not "72 under sweep"), the manuals now say what exists —
  and name what exists only in the API — and the French manual speaks
  the dictionary's French (*provision*, *rectification*, *ambre*,
  *heures de silence*…), keeping the gate names in the English the
  screen actually shows. Documentation work now files under this
  heading, as the header's own PATCH rule always implied.
- **`docs/29-technical-reference.md`** — the current-state map of the
  product, written from a full read of the source rather than from the
  design documents: the project description, the 46-table database
  schema with its cross-cutting conventions, the functionality
  catalogue, the module map, the API surface, the authority model as it
  stands (the actions added since `04`), and the 21 screens. The README
  now links it, and its routes line names the federation and
  integration surfaces it had omitted.
- **Every way to deploy, in one place.** The deployment knowledge was
  scattered: the dev commands in the README, the Windows service deep
  in `docs/13`, the database fallback chain only in `prepare-db.ps1`'s
  own comments. The README gains a *Deploying it* section naming the
  four paths — evaluation from source, production from source on
  PostgreSQL, the Windows service via `MeridianSetup.exe`, and the
  training instance — and `docs/29` §8 walks each one end to end: what
  `npm run package:installer` actually builds, what the setup
  executable does step by step (elevation, upgrade-in-place, the
  kept configuration, the PostgreSQL find-install-or-fallback chain,
  the `MeridianITPMO` service), and how data moves between deployments.
- **The written user manual, in both languages** (`docs/30` EN,
  `docs/31` FR). The living manual stays where the adoption committee
  put it — inside the product, by task, self-ticking — and these are
  its written companion: for whoever evaluates Meridian without an
  account, for training, and for reading a workflow end to end before
  doing it. Role by role and workflow by workflow, from first sign-in
  to period close, each written in the product's own vocabulary in its
  language. The English one opens with the product description in five
  languages (EN, FR, PT, ES, DE) for sites and sponsors reading in
  others — the interface itself speaks English and French.

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

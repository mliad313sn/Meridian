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

## [5.27.0] — 2026-09-23

**A standing human act holds the gate it blocks** (D-36.15; RT365 REQ-13,
second half; docs/36 wave 2).

### Added

- **A RAID dependency can be marked "blocks its gate".** This is RT365's
  H-nn: category "Human act", an owner, a review date, and the gate it
  blocks. RT365's rule is that "an action stays until its evidence file
  exists". While the act is open, that gate is never ready and never
  Cleared, just as an open veto holds it (MER-06). The refusal to advance
  is a 409 that names the act and its owner: "… is held by human act
  DEP-nn · title (Owner) until it closes on its evidence".
- **The act closes only on evidence**: a repository path, a commit, a
  named locator, or an https address on a trusted `documentHosts` host
  (refused when none is configured). One rule, `humanActRefusal` in
  `server/src/evidence.js`, serves the screen routes and `PUT /api/v1/raid`,
  and migration 059's checks refuse the rest in the database. Reopening an
  act clears its evidence.
- The RAID form's "Blocks its gate" and "Closure evidence"; "Close on
  evidence" on an open blocking act; "held by human act X (owner)" on the
  gate line and the blocked banner. FR and ES.
- `PUT /api/v1/raid` accepts `blocksGate` and `closureEvidence`; the
  export and import carry both.

### Engine

No number the engine produced before changes. The flag defaults to false
on every existing row, and no metric, roll-up, exposure, escalation or
evidence count reads it; the tests compare `Engine.metrics` of every
project and `Engine.roll` before and after. The only new behaviour is the
refusal (D-05 holds).

### Measure

`humanact.test.js`, 11 tests. F13 carries a closed blocking dependency
with its evidence. Browser, PRJ-101 at Gate 3: DEP-08 raised as a blocking
act and the gate held; closing with a sentence refused; closing on
`docs/evidence/H-03.md@a1b2c3d` lifted the hold.

---

## [5.26.0] — 2026-09-23

**An evidence-review grant, not a role** (D-36.12; FitAdapt #16 · DF-10,
KODO MER-06; docs/36 wave 2).

### Added

- **An access grant carries a power: `write` (as before) or `review`.**
  FitAdapt observed that "`document.approve` requires write authority on
  the project, so an independent council member can't sign evidence
  without edit rights", and its product owner approved on the member's
  behalf, so the audit row named the wrong person. A review grant on a
  programme or a single project carries the approval of evidence and the
  reads over that scope, and nothing else: no plan, RAID, change,
  baseline, benefit or objection. It works for a viewer, so a council
  member approves in their own name. Authority stays in `shared/rbac.js`,
  where review grants are kept apart from the write grants every write
  rule reads.
- **The rules for approving evidence are unchanged**: never one's own
  document, and site-governed gate evidence still needs group level.
  Approving under a review grant is a pure act: a call that also edits
  the link, gate, name or revision is refused.
- **A document may name the seat expected to approve it** (052's seats),
  and the library, the gate board and the gate line read "waiting on seat
  A1".
- Administration: a Power column and "Add a review grant" in the grants
  dialog; the accounts list tags "review · …". FR and ES.
- Migration 058: `access_grant.power`, a `project` scope for review
  grants only, `document.expected_seat_id`. The database refuses a review
  grant on a site and a write grant on a single project.

### Changed

- Nobody sees *Approve* on their own document any more (the route
  already refused it).

### Measure

`review-grant.test.js`, 23 tests, including an exhaustive check that for
viewer, site and group accounts every action except `document.approve`
and `project.read` answers the same with and without the grant. Browser:
an administrator grants review on Data & AI to viewer N. Rahimi from the
screen; she sees "waiting on seat A1" and only *Approve*; the audit row
names her; a forced project write gets 403.

---

## [5.25.0] — 2026-09-23

**Where the work is: one typed external reference** (D-36.14; FitAdapt
#17 · DF-11, RT365 REQ-29, KODO MER-11; docs/36 wave 2).

### Added

- **A project, stage, RAID row or gate criterion can point at an issue,
  pull request, commit, CI run or artefact** by canonical ref
  (`owner/repo#123`, `owner/repo@sha`, `owner/repo/runs/id`,
  `sha256:<hex>`). FitAdapt found "nowhere to attach a GitHub PR or
  issue": `ext_link.source` accepted SDP sources only. Migration 057
  extends `ext_link` rather than adding a table; KODO's `evidence` (052)
  still holds the proof.
- **The state is reported, never fetched.** A named integration pushes
  it (open, merged, closed, passed, failed) through
  `PUT /api/v1/references/:externalId`. It reaches every live link
  citing the same thing, including links made on screen, so a GitHub
  Action needs no Meridian ids. The screen reads "as last reported by
  <integration> at <time>"; "verified" appears nowhere. A report older
  than the one held is ignored, and an identical re-push writes nothing.
  Meridian makes no outbound call.
- **A criterion's citation is part of the gate record (REQ-29).** Once
  the criterion is met or its gate is done, changing the cited ref
  creates a new version that supersedes the old one. The old one is kept,
  with who cited it, and is never edited or removed (409).
- The project page's "Where the work is" panel; session routes
  `POST`/`PATCH`/`DELETE /api/references` under `project.write`. A
  person cannot type a state. FR and ES.

### Fixed

- An SDP cache refresh treated every link at the site as SDP's, so it
  would have marked any non-SDP link stale. It reads SDP's own sources
  only, as do the SDP read-back and link routes.

### Measure

`references.test.js`, 18 tests; F13 carries four repository rows
including a superseded citation. Browser: a PR linked on screen, its
state pushed by the API and read back on screen.

---

## [5.24.0] — 2026-09-23

**The demonstration book says what it is worth, and the book survives its
own replace** (REQ-48, NEW-18, NEW-19, NEW-20; docs/36 wave 1).

### Changed

- **REQ-48 · The demonstration book carries value.** Six projects carry a
  business case (one states a cost and no benefit yet) and six
  deliberately do not; eight benefits carry baselines, targets and
  measures; two projects carry a tolerance. The seed runs the production
  tolerance sweep, so a fresh book's exceptions are found, not typed in.
  On a fresh install all six value-page figures are measured, and the
  ranking shows both an order and the not-placed worklist. Before, four
  figures read as absences and the ranking placed nothing. A book reset
  for production still reads six honest absences. The suites that
  asserted a rule through the old, empty seed now build their own
  fixture with the same assertions (`demobook.test.js` proves both
  halves).

### Fixed

- **NEW-18 · Inactive sites, programmes and people are in the book.**
  The export wrote only active rows, so a closed project on its old site,
  or a risk owned by a leaver, was refused on the way back in. They are
  now exported with `active: false` and restored as such; screens still
  offer only active rows.
- **NEW-19 · A replace import no longer resets every version to 1.** A
  screen holding version 1 of a row that had been at 7 could write over
  the import. Every row a replace writes now moves past the highest
  `row_version` its table held before, so any version read before the
  import is refused with 409.
- **NEW-20 · The import screen says what a replace erases.** A file with
  no meeting register (a KODO book, or any export older than 5.21.0)
  erased the meeting register without a word. The screen now runs the
  dry run first, lists each list the file does not carry with the rows
  it would erase ("Meeting series — 7 row(s) erased"), and offers the
  merge beside the replace. The dry run reports `wouldErase`; a real
  replace returns `erased` and records it in the audit trail.

### Measure

`demobook.test.js` and `book-replace.test.js` (6); F13 now requires every
version to come back strictly greater and adds an inactive site,
programme and person. Browser: six measured value-page figures; the
replace warning listed Meeting series 7, Meetings 12, Decisions 1,
Meeting actions 8, and Cancel left the book intact.

---

## [5.23.0] — 2026-09-23

**Each step of a change request is signed by a different person** (PR-04,
D-36.11; docs/36 wave 1).

### Changed

- **The approval chain showed four roles and let one person sign all
  four.** The roles were labels, not authorities. A person who has signed
  one step of a request now cannot sign another step of the same request
  ("you signed step N of this request — a different person signs each
  step"), and the raiser still signs none. "Person" is the person behind
  the account, or the account itself when it represents nobody: two
  accounts of one person are one signatory, and a deputy is matched for
  the person they act for. The rule is `distinctSignatory` in
  `shared/rbac.js`.
- **It holds for administrators too.** Their break-glass covers signing a
  request they raised, for one step, not signing the whole chain. The
  administration panel's sentence said an administrator "may sign every
  step"; it now says what is true (EN, FR, ES), as do SECURITY.md,
  docs/37 §6 and docs/38.
- A rejection ends the chain and is not held to the rule.
- The change request view says what the chain guarantees, no longer draws
  *Approve* for someone who already signed a step, and says why.

### Added

- Migration 056: `change_step.decided_by_person`, beside the account
  already recorded in `decided_by` since 002. Steps signed before it keep
  no person rather than an invented one, and a step with no recorded
  signer blocks nobody.
- The export and import carry who signed each step (`by`, `byUser`); F13
  checks both.

### Upgrade note

**Every four-step chain now needs four distinct authorised people.** On a
site-governed project below the threshold that means the site lead, the
programme office, the administrators, or further named accounts. The
seeded book has one group account per programme, so a demo chain needs
the administrators or new accounts to complete.

### Known limit

A deputy who signs step 1 *for* X is recorded as the deputy's own person,
so X could then sign step 2 (NEW-22, docs/36).

### Measure

`change-chain.test.js`, 15 tests. Five existing tests walk their chains
with distinct signers and assert more than before (journey §7, uat A2,
posture S-13, rbac R4.5, roundtrip ENRICH); none is weakened. Sweep: 286
cases, the same 11 points as 5.22.0. `npm run verify`: 929/929.

---

## [5.22.0] — 2026-09-23

**KODO's registers are written from the product** (NEW-04; KODO MER-03,
05, 06, 07, 10, 11; docs/36 wave 1).

### Added

- **Requirements, evidence, review findings, seats with their
  incompatibilities, and objections** get session routes
  (`server/src/routes/registers.js`), all audited, each update asserting
  `row_version`. They also get screens:
  - three folds on the project (Requirements, Evidence, Review findings);
  - *Seats and vetoes* on Meetings;
  - objections under every decision, in a meeting or in the register.
- **Authority, decided in `shared/rbac.js`, each with its reason:**
  - `assurance.write` is ordinary project work.
  - `waiver.grant` is group level: the team does not rule its own gap
    away.
  - `seat.manage` is group level.
  - `objection.raise` is open to whoever can see the decision. Only a
    seat's holder speaks in its name, so a veto cannot be borrowed.
  - `objection.resolve` is group level, and never the person who took the
    decision.
- **KODO's rules, enforced:**
  - A finding closes only on evidence of its own project, captured since
    it was raised.
  - A waiver carries its reason.
  - A requirement is *Done* only when its proof (`verified by`) is named,
    not just its method.
  - A person holding two incompatible seats is refused with a 400 naming
    both seats, whichever order the facts arrive in. Migration 055 adds
    the edge trigger the seat trigger lacked.
  - A veto objection blocks the phase advance, and resolving it lifts the
    block.
- Meeting series may be `per_gate` (with their gate) or `ad_hoc`.
  Decisions show their cost to reverse, their source evidence, and what
  they supersede.
- Migration **055**: `row_version` on evidence, finding, seat and
  objection; `raised_by` on objections; the incompatibility edge trigger.

### Fixed

- The series route silently turned `per_gate` and `ad_hoc` into
  `weekly`.
- A supersession recorded in a meeting went to `supersedes_id`, while the
  decision register reads `supersedes`, so it never appeared there.
- **The browser's permission adapter dropped `personId`.** Every "is this
  the same person" rule was therefore checked in the browser as if nobody
  were signed in.
- F2's shrink-only list asked for NEW-04's sixteen known gaps to be
  struck off the moment the routes arrived, and they are.

`server/test/registers.test.js` (28 tests). In the browser: 40 checks
across admin, group (in French), site and viewer. The viewer is offered
no control on any new section, and the site lead gets no *Waive* and no
*+ Seat*.

---

## [5.21.1] — 2026-09-23

**A gate's own list is checked against the product** (REQ-52, RT365;
NEW-08; docs/36 wave 1).

### Changed

RT365 put the class of defect in one sentence: *"a thing a list does not
name is not reported missing, it is not seen."* Every hand-written list a
gate walked is now derived from the product, or held against it:
- **F1** reads a mount table (`server/src/routemap.js`) that records every
  router the app mounts, and where. A router file that is never mounted
  fails by name. It also reads every client file, not six.
- **F2** fails on any table a migration creates that it does not name, and
  on a name no migration creates. Schema reading lives in
  `scripts/audit/lib/schema.mjs` and is checked against the live
  database, table by table and column by column. It now examines 15
  tables it never had.
  - KODO's six registers are declared, and the 16 verbs NEW-04 owes them
    sit in a dated, shrink-only `KNOWN_GAPS` list printed on every run.
  - Four fields that no screen shows are listed too:
    `notification.acted_at`, `integration.rotated_at`,
    `event_delivery.last_error` and `delivered_at`.
- **F3, F4 and F7** read every client file and every table carrying
  `row_version`: 38 tables, where the list had 16.
- **F8** holds NAV, TITLES, ROUTES, ROUTE_ROLES and the guide's 42 links
  against the screens the product draws, and its role list against
  `shared/rbac.js`. NAV and TITLES moved to `web/src/lib/state.js`.
- **F9** reads every route the app serves under `/api/v1`, not just
  `routes/v1.js`.

### Fixed

- **`GET /api/v1/signals` answered and was absent from the published
  contract** (NEW-08), because F9 read one file. It is described now, with
  scope `read:portfolio`.

Each gate was proven in both directions with a deliberate break: a scratch
table, an unmounted router, a `/api/v1` route outside `v1.js`, an
unversioned PATCH, an unguarded delete button, an unimported helper, and
a screen missing from NAV. Each break passed the old gate and fails the
new one. `server/test/gate-lists.test.js` (6 tests).

---

## [5.21.0] — 2026-09-23

**The meeting register is in the book** (NEW-14, NEW-15, NEW-16; docs/36
wave 1).

### Added

- **The book export now writes the meeting register and RAID reviews** as
  five new lists, in the book's own style:
  - `meetingSeries`;
  - `meetings`, each with its frozen agenda and attendance nested inside;
  - `decisions`, including those taken outside a meeting
    (`meeting: null`);
  - `actions`;
  - `raidReviews`.

  They are scoped as the meeting screens are. A series is written when
  `meeting.read` allows it, and decisions outside a meeting also need
  `audit.read`. A link to something the reader cannot see is written as
  null. The bootstrap every screen loads is unchanged; only the export
  uses the fuller book.
- **The import reads them in replace and merge mode.**
  - Ids are preserved, and the DEC, ACT and RVW counters follow them.
  - An account or integration this database does not hold becomes null.
  - An agenda is accepted only for a closed meeting.
  - A merge leaves a meeting this database holds closed exactly as it is.
  - A merge updates a decision's status, ratification and links, never
    its substance.

### Fixed

- **A replace import erased the meeting register** (NEW-14). The export did
  not write it, and the import deleted it. FitAdapt's own `bootstrap.mjs`
  warns "the import REPLACES the whole book, meetings included". An
  imported objection could not find its decision either, so F13's last
  exemption (`objections`) is gone. F13 is strict with **every list
  empty**.
- **A real import dropped the rows it refused by name, silently**
  (NEW-15). Only a dry run returned them. The real import now answers the
  same `{ok, dryRun, mode, counts, rejects}`, and the audit event records
  the refused rows.
- **A merge rewrote rows without bumping `row_version`** (NEW-16), so a
  screen holding the old version could still write over them. A merge
  now bumps the version on every row it actually changes. The tables are
  read from the schema, and a merge of an unchanged book moves nothing.

`server/test/book-meetings.test.js` (12 tests). Our own export imports
and merges with 200 and nothing refused, and re-exports byte-identical.
KODO's book: dry run, import and merge all 200.

---

## [5.20.2] — 2026-09-23

**Three defects found by walking the manual** (NEW-06, NEW-09, NEW-10;
docs/36 wave 1).

### Fixed

- **An account an administrator created was stuck read-only** (NEW-06).
  The server refuses every write until the holder chooses their own
  password, and the client opens that dialog when `me.mustChangePassword`
  is true. `/api/bootstrap` never sent the flag, so the dialog never
  opened and the refusal had no way out. The bootstrap carries it now,
  and drops it once the password is the holder's own. Seen in the
  browser: a freshly provisioned account opens on "Choose your own
  password".
- **SIGTERM left the book unclosed** (NEW-09). The book's own signal
  handler (`claimBook`) called `process.exit` at once, and it is
  registered before the server's orderly stop, so the process died with
  PGlite never closed. It now steps aside for whoever answers the signal.
  A script that answers nothing (seed, migrate) closes the book before
  leaving. Measured on the way: PGlite 0.2.x leaves `postmaster.pid` and
  its socket lock behind even after a clean close. The "cleared 2 stale
  lock file(s)" message at start is the engine's own behaviour, and
  `clearStaleLocks` is why it is harmless.
- **Saving a gate ladder from the screen dropped its loops and scopes**
  (NEW-10). The editor's text form had four columns. It now takes two
  optional ones, `loops to N` and `programme` or `portfolio` (D-36.02),
  and writes them back. A four-column ladder is untouched. Seen in the
  browser: a ladder with a loop and a programme-scoped gate survives an
  unchanged save.

Tests: `governance.test.js` (bootstrap flag), `shutdown.test.js` (new),
`gates.test.js` (the text form's round trip). Each fails on 5.20.1.

---

## [5.20.1] — 2026-09-23

**The product imports what it exports** (NEW-05, NEW-07; docs/36 wave 1).

### Fixed

- **The book export wrote fifteen registers the import never read:**
  site windows, absences, benefits, rollout waves, commitments,
  timesheets, tolerances, exceptions, business cases, their gate
  reconfirmations, lessons, gate criteria, stakeholders, the comms plan
  and external links. A replace import deletes the projects, so the
  cascade erased all of them. Lessons survived with their project,
  programme, site and author nulled.
- **On the registers the import did read, 85 fields came back changed.**
  38 were known when the line opened. Filling every exported column in
  the probe found 47 more. Among them:
  - cost lines were re-numbered and rewritten as "Imported" USD capex
    labour on the 1st, not from contingency;
  - programmes lost their gate ladder, and people their contract fields;
  - projects lost their review, scores, sponsor, closure signatures and
    date basis;
  - sites lost their country, link and champion;
  - risks lost their gate, change and closure.
- **All of it now comes back, field for field.**
  - Money the export writes in millions goes back through the book's
    declared unit. Benefits keep their own unit.
  - Ledger and timesheet ids are kept, and their sequences follow them.
  - Counters follow imported ids.
  - A pointer to an account or integration this database does not hold
    becomes null instead of failing the import. Neither is book data.
  - A merge never rewrites a ledger posting: a different posting under a
    held number is refused by name.
- **A merge-mode dry run of the product's own export no longer answers
  400** (NEW-07). Change steps, report narrative and cross-project edges
  now carry their own conflict rule. Before this, a merge silently
  doubled every cross-project edge.
- The export's row order is deterministic: every `ORDER BY` ends on a
  unique key. Only the order of ties changes.

Gate F13 is now strict with **both loss lists empty**. It also fails if
any exported field of an imported register holds no value in the probed
book, so an empty list is measured, not assumed. KODO's own book imports,
round-trips and dry-runs a merge, each with 200.

### Still not in the book (docs/36)

The meeting register (series, occurrences, decisions, actions) and RAID
reviews are not written by the export at all, so a replace import erases
them (NEW-14). Move a whole instance with the database backup.

---

## [5.20.0] — 2026-09-23

**The write contract records that a review happened** (REQ-51, RT365;
docs/36 wave 1).

### Added

- **`PUT /api/v1/raid-reviews/:externalId`** (`write:portfolio`). A review
  performed on a register item is an event: `item`, `by` (a person of the
  directory, required when created), `on` (today when omitted), `note`,
  and `next`, the following due date.
  - It is keyed by the integration's own id, so a sync that runs twice
    records one review.
  - Corrections re-derive the item's `review` date, and a review stays on
    the item it reviewed.
  - The body is closed (REQ-19), described in the published contract,
    audited, and read back by the screen as the same event.
- Migration **054**: `raid_review` gains `external_source` and
  `external_id`, like every contract row.
- The next-review projection moved to `server/src/raidreview.js`, so the
  screen and the contract derive the due date one way.

### Why this was wrong before

`review` on `PUT /api/v1/raid` *schedules* a review. Performing one has
been an event since 050 (REQ-46), but only a screen could write it.
RT365's `meridian_sync.py` moved the date instead, which erases the only
evidence that the review took place.

`server/test/raidreview-contract.test.js` (7 tests).

---

## [5.19.0] — 2026-09-23

**A decision is ratified from a screen, by someone independent, in their
own name** (REQ-50, RT365; docs/36 wave 1).

### Added

- **Ratify, in the decision register.** A proposed decision gets a
  *Ratify* button for exactly the people the server would let ratify it:
  - authority on the decision's project (`decision.ratify` in
    `shared/rbac.js`, group level for a portfolio-wide decision);
  - never the person who decided it;
  - never the person behind the account that recorded it (REQ-49's rule,
    read from the same file by the screen and the route).

  The person signed in ratifies as themself. There is no field to name
  somebody else, because ratifying on another's behalf is the workaround
  the field describes for gate evidence (FitAdapt DF-10). The decision
  takes effect that day, dated (REQ-47), and the act is audited
  ("Decision ratified").
- `POST /api/decisions/:id/ratify` (`row_version` asserted):
  - 400 for an account that represents nobody;
  - 403 with the rule named;
  - 409 when already ratified or stale.
- The decision register now carries each row's version, and the recorder's
  person, which the screen needs to draw the button honestly.

### Why this was wrong before

The only door from *Proposed* to *Ratified* was the integration contract.
A programme without an integration either kept its decisions *Proposed*
forever or ratified them by editing records somewhere else.

`server/test/ratify.test.js` (+7 tests). Exercised in the browser:
- E. Lindqvist, who recorded the decision, sees no button.
- R. Kaur (PE-14) sees it, confirms, and the row reads Ratified by PE-14
  today.
- The button is then gone, with no console errors.

---

## [5.18.3] — 2026-09-23

**A decision is ratified by someone independent, on both doors** (REQ-49,
RT365; docs/36 wave 1).

### Fixed

- **The session route accepted any text as a ratifier.**
  `POST /api/decisions` took `ratifiedBy` as free text, with no directory
  lookup and no independence check. The integration contract had
  enforced `canRatifyDecision` since the security round. Since 5.15 that
  unchecked name is also dated (`ratified_on`), so a ratification nobody
  independent ever saw looked like evidence of one. The route now
  resolves the ratifier in the directory (400, naming the field, when
  nobody matches). It refuses the person who took the decision and the
  person behind the recording account (403, saying which rule).
- **The contract's own independence check never fired.** It compared the
  ratifier, a *person* id, with the recording *account* id: two id spaces
  that never meet. So "the hand that recorded it does not also ratify it"
  let that hand through. `canRatifyDecision` now compares the ratifier
  with the account's person (`app_user.person_id`), on both doors.
- Two REQ-47 tests used a committee's name ("Comité d'investissement",
  "ARB") as the ratifier on the session route. Their subject is the
  ratification date, so they now name a person of the directory. A
  committee is recorded in `council`.

`server/test/ratify.test.js` (6 tests). Four of them fail on 5.18.2: the
decider ratifying, the recorder ratifying on each door, and a name
outside the directory.

---

## [5.18.2] — 2026-09-23

**The public record counts what the tree holds** (docs/36 C-06).

### Fixed

- **The front door said four things that were not true.** The README
  said twelve gates in three places (there were thirteen, fourteen with
  this release). SECURITY.md said "334 tests, eight static gates" (840,
  and fourteen). Each number had been typed once, true, and never read
  again.
- **The README's "What you are not getting" no longer promises what 5.18
  does not deliver.** It now says:
  - the JSON book import erases fifteen registers and changes 38 fields
    (NEW-05), so an instance should be moved with the database backup;
  - five registers have no screen (NEW-04);
  - no release since 5.9.0 is tagged yet.

### Added

- **F15 · the public record counts what the tree holds**
  (`scripts/audit/public-record.mjs`, in `npm run audit`). It reads every
  number that README.md, CONTRIBUTING.md and SECURITY.md state about the
  tree and compares it with the tree: gates, tests, tables, and the last
  migration. It reads each file as one text, because the first version
  read line by line and missed "twelve static⏎gates", split by a wrap. A
  number on a line that names a version or a date is history and is left
  alone.

  Proven both ways: it failed on the five stale numbers and passes once
  they are corrected. SECURITY.md now describes "every test suite"
  without a count, so that adding a test does not require editing the
  security policy.

---

## [5.18.1] — 2026-09-23

**Release becomes part of done, as two gates** (docs/36 C-05). No
product capability changes. What changes is what the build refuses.

### Added

- **F13 · the book comes back** (`server/test/roundtrip.test.js`, part of
  `npm test`). The test exports the book, imports it, and exports it
  again. The book must come back field for field, and every collection
  the export writes must be one the import reads. Before exporting, the
  gate gives one row of each imported table a non-default value in every
  column added since the importer was written. Without that, it passes on
  the very losses it exists to catch. It fails in three cases:
  - a loss nobody has named;
  - a collection added to the export and not to the import;
  - a named loss that has since been fixed. This keeps the list
    shrinking.

  It was proven in both directions:
  - the `'\D'` bug of 5.9.1 fails it;
  - dropping `capitalised` from the import fails it;
  - a loss that is fixed but left on the list fails it;
  - the restored code passes.
- **F14 · no proven line waits on a branch**
  (`scripts/audit/merge-debt.mjs`, in `npm run audit`, also run alone as
  `npm run audit:debt`). The build fails when a remote branch meets all
  three conditions, and it names the branch:
  - it carries product code;
  - it is ahead of `main`;
  - it is older than seven days.

  A branch that must not be merged is declared in
  `docs/superseded-branches.json`, pinned to its tip. A new commit on it
  makes it debt again. Proven both ways: the 23-day-old documentation
  branch fails it until it is declared, and `--now` a fortnight ahead
  turns every in-flight branch into debt.
- **A field repository can check its own register** (REQ-53, RT365).
  Run `node scripts/audit/register-schema.mjs <file>` (or
  `npm run register:check -- <file>`) from the field repository. It
  validates the file against `meridian-request-register/1` and names each
  failing request by its id. RT365's current register passes. Its v7, the
  one handed over as finished, fails with 47 violations named. The schema's
  own description now names the command.

### Why this was wrong before

On 23/09 the product anyone cloned could not import its own export, while
four unreleased lines carried the fix. Every gate was green on every
branch, because none of them asked whether proven work was stranded, or
whether the book survived its own round trip.

Building F13 measured something no probe had seen: **the export writes 15
collections the import never reads, and 38 fields do not survive the
round trip** (NEW-05). A 200 had been hiding silent data loss. Those
losses are named in the gate and are the first line of wave 1.

### Changed

- CONTRIBUTING and `/product-owner` now state that **a field-return round
  ends with a pull request to `main`, not with a branch**. The register's
  `done` means "on `main` with its test". It used to mean "on the branch".
- `.gitignore` excludes throwaway probes (`server/test/_*.test.js`) and
  agent worktrees.
- CONTRIBUTING's gate count is corrected to thirteen, counted from the
  `audit` script (it said ten).

---

## [5.18.0] — 2026-09-23

**The documentation branch, salvaged.** On 31/08 a documentation review
committee wrote a technical reference and a user manual in two languages,
and found seven product defects (O-1…O-7) plus three more while walking
the product. None of it was merged, and the branch could not be merged:
its migration 027 and its docs 29–32 reused numbers main already held.
Each fix was re-checked against 5.17.0. Nine were still missing and are
delivered here as new work; one (the in-memory quick start) had been
fixed by 5.9.1. See `docs/36` line C-04. The branch is declared
superseded, not merged.

### Fixed

- **Nobody was ever told a tolerance was breached, or that a benefit was due to be measured.** Migration 026's sweep queued `tolerance-breached`, a kind that migration 018's CHECK refused, in a call that also omitted the NOT NULL `dedupe_key`. The catch that protects the sweep swallowed both errors, so management by exception stopped at its last link, silently. The benefit-review sweep added later (`benefit-review-due`) copied the same call and the same defect. Migration 053 admits both kinds, both calls carry their key, and the catch now logs instead of staying silent. (docs/32, re-delivered by docs/36 C-04; the committee branch numbered this migration 027, which main had already used for 027_international.)
- **Every manual health override returned 400, and "back to automatic" was impossible.** The "Set project status" dialog collected the reason under `note` but posted `why: v.why` (undefined), which the server rightly refuses. It also tested `v.rag === "auto"` where the source select is `v.mode`. Both keys had been wrong since the dialog was written. (docs/32)
- **A site lead whose granted site was not first in the list saw no "New project" button** (O-5). The visibility probe asked about `programmes[0]`/`sites[0]` only; it now asks about every combination.
- **The notifications panel said "configured" for a transport the product does not carry.** It read `MERIDIAN_SMTP_URL`. It now reports whether the outbound webhook (or the Teams webhook) would actually send, and names those settings. (O-2)

### Added

- **The notification module keeps its whole promise** (O-1, O-2). Five kinds were defined in 013/018 and never emitted. The hourly sweep now sends all five:
  - a referred decision still unanswered, to the chair of the room it was referred to;
  - a concern a site raised on a group project, to that project's manager;
  - a site quiet for thirty days, to its champion (same signal as the Adoption screen);
  - a week of effort not recorded, to the person and never to their manager;
  - the daily or weekly digest.

  Delivery now honours all four subscription settings (kind, minimum severity, **scope**, and **per-subscription cadence**, one batch per period). Before, scope and cadence were stored and ignored. The bell's notification preferences now carry the quiet hours and the fine-grained subscriptions that the API held with no screen.
- **Adopted lessons are offered at project creation** (O-3). The relevant-lessons endpoint finally has a caller, at the one moment a lesson can still change the plan.
- **The person form carries employment, supplier, rotation and availability** (O-4). The API has accepted these since migration 012, but the form never offered them, so they could only arrive by CSV import. The directory shows them. The capacity arithmetic is deliberately untouched, because availability is already net of rotation.
- **Role labels and RAID natures speak the interface's language** (O-6), in French and Spanish. Stored values stay English.
- **Cross-project links are tolerance-checked** (O-7). `Engine.crossDepBreaches` applies the same five-day-past-baseline rule to the edges of the integrated master schedule, and the Schedule banner counts those breaches. The addition is purely additive: no existing engine output changes.
- **The trusted evidence hosts are on a screen** (docs/32 P-03). The approval refusal named `documentHosts`, "in Administration", but Administration had no field for it. Settings gains an **Evidence** section, closed by default like the webhook hosts.

### Documentation

- **The technical reference and the user manuals reach main** (docs/36
  C-04). They were written on 31/08 against 5.3.0, on a branch that never
  merged. They are carried over renumbered:
  - **37**: technical reference.
  - **38**: user manual (EN).
  - **39**: manuel utilisateur (FR).
  - **40**: the documentation committee's record, kept as the record of
    31/08.

  They are rewritten from the 5.18.0 source, not from this changelog:
  - the 63 tables of migrations 001–053 (the old text counted 46);
  - the gate ladder of up to twelve gates, with loops and scopes
    (D-36.02);
  - the import's dry run, merge mode and mandatory `currencyUnit`
    (D-36.04);
  - the `N` health state (D-36.01);
  - the notification kinds, all eleven now emitted.

  Every number was counted in the tree, and the documents say how. Every
  procedure was walked against a seeded book, by API and in the browser,
  21 screens × 4 roles × EN/FR. Where a procedure still fails, the manual
  says so at that point and cites its docs/36 id (NEW-06…NEW-13), rather
  than describing the intended behaviour. The README gains a *Deploying
  it* section and loses four numbers that were no longer true.
- **Why this was wrong before:** main carried no current description of
  the product at all, and the 31/08 texts described a 5.3.0 with fixes
  that had never reached main.

---

## [5.17.0] — 2026-09-23

**Convergence: the KODO line reaches main.** KODO's fifteen findings
(MER-01…MER-15) were built on `claude/dynamic-gates-and-requirements` on
19/09 and delivered to KODO as three patches it had to apply by hand.
This release carries them, joined onto the RT365 line of 5.16.0. See
`docs/36` line C-03.

### Added (from the KODO line)

- **A gate model that is configuration** (MER-01), **gates that loop**
  (`gate_loop`), and **gates scoped to a programme or the whole
  portfolio** (MER-02).
- **A requirement register** (MER-03), **review findings** that close only
  on evidence (MER-05), **seats with vetoes and incompatibilities**
  enforced by the database (MER-06), and **objections, a reversal cost
  and supersession** on decisions (MER-07).
- **Import dry run and merge mode** (MER-08). **Money that declares its
  unit** (MER-09): a book without `currencyUnit` is refused. See
  D-36.04 below for what that means for your old exports.
- Per-gate and ad hoc meeting cadence (MER-10), evidence that is not a
  document (MER-11), allocation identity kept across a round trip
  (MER-14), and an empty gate that says so (MER-15).
- Migrations **051** and **052**. They were written as 034 and 035 on a
  branch that never reached main, and were renumbered before anything
  applied them.

### Changed — where the two lines disagreed

- **One gate model (D-36.02).** RT365 answered "our gates are not your
  four" with a ladder per programme. KODO answered it with a portfolio
  model whose gates loop and may be scoped. A project now walks its
  programme's ladder if it has one, else the portfolio's, else the four
  built-in gates. Any rung of either may carry `loopsTo` and `scope`. The
  gate state keeps RT365's criteria and placeholder dates, and adds
  KODO's loop filter. A programme-scoped gate with an unmet criterion is
  not ready.
- The refusal to advance a gate says **"No evidence has been registered"**
  when nothing was ever attached, and names the pieces otherwise (MER-15
  and RT365's criteria together).
- `PGLITE_DIR=:memory:` (KODO's spelling) and `MERIDIAN_EPHEMERAL=1`
  (RT365's) both mean in-memory, in the one resolver.

### Fixed

- **NEW-01: the product could not import its own export again.** KODO's
  strict allocation check (MER-14) accepted a hand-typed list of keys,
  and the export writes `capitalised`, which was not on it. The accepted
  keys are now read from the export's own serialiser (`allocationOut`),
  so they cannot drift. `capitalised` is also imported now, where before
  it was silently dropped.
- **NEW-03: seventeen segregation-of-duties tests had been deleted.** The
  KODO line's `governance.test.js` replaced the file of the same name. The
  seventeen tests it held are restored, and KODO's tests now live in
  `review-governance.test.js`. The count showed "+18" and hid the
  deletion.
- **F2 could not see KODO's tables.** `CREATE TABLE IF NOT EXISTS` and
  `ADD COLUMN IF NOT EXISTS` were not recognised: the first hid the tables
  from the gate, and the second was read as a column named `IF`.
- The importer keeps 5.9.1's named-row refusal and evidence fields
  alongside KODO's dry run and merge mode.
- The book reset now clears KODO's six registers. RT365's REQ-52 check
  caught them the moment the two lines met.

### Operator note (D-36.04)

A book exported by Meridian **before 5.17.0** carries no `currencyUnit`
and is now refused, as KODO asked. Its money was always in millions: add
`"currencyUnit": "millions"` to the file and it imports. The refusal says
so.

---

## [5.16.0] — 2026-09-23

**Convergence: the RT365 line reaches main.** Nothing in this release is
new code. It is 5.10.0 through 5.15.0, built on
`claude/meridian-rt365-feedback-d6vo3i` between 08/09 and 09/09 and never
merged, joined onto 5.9.1. Their sections below keep the dates they were
built and now say when they were first released. See `docs/36` line C-02.

### Why this was wrong before

On 23/09 the product anyone clones (main, 5.9.0) could not import its own
export, while four unreleased lines carried the fix. Three field
programmes had each rediscovered defects another had already fixed, and
the register in `docs/requests/rt365.json` promised 66 files that main did
not carry (gate F12).

### Changed

- **One MER-04 rule (D-36.01).** 5.9.1 and the RT365 line each fixed "an
  unbudgeted project reports SPI/CPI 1.00 and green". 5.9.1 kept the
  indices at 1 and the colour green with a "no cost baseline" note.
  RT365's REQ-33 made the indices `null` and the health `N`. Main now
  carries REQ-33's rule, because an index nobody measured is not 1, and
  keeps 5.9.1's other half: percent complete falls back to the weighted
  physical progress of the plan, which *is* a measurement. 5.9.1's test
  now asserts `N` and `null`, which is stricter than `G`.
- **One first-run implementation.** `server/src/env.js` keeps the only
  resolution rule for the PGlite directory (`pgliteDirFor`).
  `resolvePgliteDir` and `DEFAULT_PGLITE_DIR` stay exported from `db.js`
  under 5.9.1's names and delegate to it. Semantics kept: `dataDir: null`
  is in-memory and wins over `PGLITE_DIR`. RT365's production start
  refusals are unchanged.
- `scripts/restart.sh`: RT365's version, which already covered lsof, fuser, ss
  and PowerShell. 5.9.1's version is a subset of it.
- The importer keeps 5.9.1's fixes: `'\\D'`, evidence fields, the bare
  book, and the named row on refusal.
- `docs/requests/rt365.json`: REQ-45, REQ-46 and REQ-47 read `open` while
  migrations 049 and 050 and their tests delivered them. They are
  corrected from the code.

---

## [5.15.0] — 2026-09-09 · built, first released in 5.16.0

Two waves in one release: the executive value page RT365 asked for, and
the three instrument defects we filed against ourselves while building
the governance signals of 5.14.0.

### Added

- **A value page for the executive** (REQ-30). Six figures — spend
  against case, benefits by status, overdue reviews, top risks by
  exposure, gates due, exceptions open — assembled from the book with
  nothing typed, printable to A4 as a board pack, and stored per
  reporting period so a claim made in March can be re-read in December.
  **No figure carries a colour**: no threshold for "too little benefit"
  has been agreed, and inventing one here is REQ-33 under a new name.
  The figure to look at is *exceptions open*, because it is a trap — a
  book with no tolerance set shows `—`, not "0 open". An empty exception
  register on a portfolio that has declared no limits is not a clean bill
  of health, and this is the only screen that says so.
- **The database now refuses to store an unmeasured figure carrying a
  zero.** `CHECK ((state = 'N' AND value IS NULL AND length(why) > 0) OR
  (state = 'measured' AND value IS NOT NULL))` — REQ-33 written into the
  schema rather than trusted to the code above it, with a test that
  inserts the forbidden row to prove the refusal.
- **A gate that was ticked without acceptance criteria records the day
  and the person** (REQ-45): `milestone.done_on` / `done_by`, a *weaker*
  pair beside 032's `accepted_on` / `accepted_by`, never a widened strong
  one. A gate with no criteria has nothing to accept, and writing an
  acceptance date where nobody accepted anything erases the distinction
  032 exists to hold.
- **A RAID review is an event with its own row** (REQ-46): `raid_review`,
  one row per review performed. `raid_item.review_on` stays and becomes
  the projection of the latest event, not a substitute for it. Two
  columns holding the last review would answer "when was this last looked
  at" and still not make last month readable.
- **A decision records when it was ratified** (REQ-47):
  `meeting_decision.ratified_on`, with a CHECK that un-ratifying clears
  it — enforced by the table rather than trusted to four routes.

### Changed

- **Two of the five governance signals can now speak.** `gateCycleTime`
  moved from `N` to a measured figure, and `raidReviewCompliance` gained
  a replayed trend. On a book where none of it has happened, every `N` is
  still an `N` with the right sentence: nothing lights up because a
  standard was loosened.
- `trendNoHistory` is **deleted**, not left unreachable. It said the
  register could not record that a review happened; migration 050 made
  that false, and a sentence that is no longer true must not be a state
  the product can reach.
- **A book that had stored a value page could not be reset at all.**
  `reset-book` fails any table it neither clears nor declares kept, and
  its guard fires only at reset time and only when the forgotten table
  holds a row. Fixed, and closed as a class: a test now reads both lists
  against the live schema and fires the moment a migration adds a table.
  It found a second instance on its first run — `case_reconfirmation`,
  from REQ-22's work, which meant a book with a reconfirmed business case
  could not be reset either.
- Gate maps taught `valuepage`, `ladder`, `raid_review`, `report_value`
  and `report_value_figure`. Five hand-written lists in this repository
  share one blind spot: a thing the list does not name is not reported
  missing, it is simply not seen (REQ-52).

### Not done, and said plainly

- **REQ-49, high, open.** `POST /api/decisions` takes `ratifiedBy` as
  free text with no directory lookup and no independence check, while the
  contract door has enforced `canRatifyDecision` since the security
  round. REQ-47 made that worse in this same release: the route now
  writes `ratified_on`, so an unchecked ratification is dated and feeds a
  governance metric. Closing it properly changes an authority rule and
  the decision form; a hurried authority change is how a check ends up
  weakened rather than applied.
- REQ-50 (no human can ratify from a screen at all), REQ-51 (the contract
  can move a review date but still cannot say a review happened) and
  REQ-48 (the demonstration book carries no business case, so four of the
  value page's six figures read as absences on a fresh install).
- `v5.15.0` is **not on the remote**, and neither is any tag past
  `v5.9.0`. Every `released: false` in the register is honest.

---

## [5.14.0] — 2026-09-08 · built, first released in 5.16.0

RT365's integrator rewrote `meridian_sync.py` against our published
contract and then **measured** what it still could not do. Everything in
this release is one of those measurements, or the screen that was missing
beside it.

### Added

- **A register item records when, and by whom, it closed** (REQ-18).
  `status: Closed` answered 200 and read back closed while `closed_on`
  stayed null — it stayed null because it did not exist. `raid_item` now
  carries `closed_on` and `closed_by`, nullable, and **nothing is
  back-dated**: a row closed before this migration is closed on a date
  nobody knows, and writing the migration's own date would invent a
  history no one lived. `closed_by` is a person from the directory, not
  the account that pushed the button — the audit trail already carries
  the second. Filed as an API defect; it was a product defect, because
  the screen had the same hole.
- **A project date says what it rests on** (REQ-19), as 040 did for a
  milestone: `committed`, or a `placeholder` that is never reported late
  until the condition producing the real date is measured. With it, the
  two fields the same round measured as *accepted and lost*: the
  **sponsor** who answers for the business case — a person, because a
  name that does not resolve in the directory is a string, not a
  responsibility — and the **acceptance criteria** that say in advance
  what finished will mean. Milestones have had theirs since 032; a
  project was closed on three signatures with no sentence saying what
  they attested.
- **A free category label on a register item** (REQ-13), implied by their
  `RAID_KIND`. `kind` stays Risk/Issue/Assumption/Dependency — it is the
  contract the engine reads and it does not open. `category` is their
  word, beside ours.
- **Five governance signals on the portfolio page** (REQ-28): decision
  latency, action ageing, gate cycle time, RAID review compliance,
  exception age — every one computed from timestamps the book already
  keeps. **No new data entry**, which was the binding constraint and also
  the test of the design: wanting a column means not having found the
  timestamp that already answers the question.
- **The field-return loop is adopted with a command** (REQ-31):
  `npm run field:init` writes a register that passes the gates the moment
  it lands. Step 1 of the pattern used to read *copy an existing
  register*, and copying RT365's means inheriting forty-four requests
  belonging to another programme and deleting them by hand.

### Changed

- **The write API refuses a body it does not understand**, naming the
  unknown key, listing what is accepted, pointing at the contract, and
  saying nothing was written. Their own D-10 is the argument: a 200 on a
  body the route did not understand teaches the caller they wrote
  something. This is only safe because the fields above were made real
  first.
- **The agenda no longer calls a placeholder finish late.** A project
  that far behind still belongs on the agenda; what is withdrawn is the
  verdict on a date nobody committed to. Saying *42d late* of a
  placeholder sends a steering meeting after a slip that does not exist.
- `route-match.mjs` (F1) reads the `signals` router. A router its map
  does not name is invisible to the gate — the readouts were drawn, the
  route answered, and F1 still called it a button that 404s. The gate was
  lying in the safe direction, but lying.

### Not done, and why

- The **H-nn half of REQ-13** — standing human acts modelled as
  dependencies with a review date — stays open. It is a modelling
  decision, not a field.
- `v5.14.0` is **not on the remote**, and neither is any earlier tag past
  `v5.9.0`. Pushing a tag ref from this session is refused HTTP 403, and
  the merge to the default branch was authorised by the owner and then
  refused by the session's own permission classifier (`docs/33` D-33.50).
  Every `released: false` in the register is honest.

---

## [5.13.0] — 2026-09-08 · built, first released in 5.16.0

RT365 consolidated two rounds into one report and handed over the most
exacting document this product has received. It measures what Meridian is
worth, it corrects its own earlier findings in three places, and it names
one defect that matters more than any feature request in it. A full
committee was convened on it (D-33.43): a measurement counsellor who
reproduced the headline finding and surveyed every surface it reaches, an
adoption counsellor who cloned the default branch as a stranger would, and
a contract counsellor on the two write requirements.

### The finding that mattered most — unmeasured is no longer green

On a book of budget-less projects with nothing reported, the executive
page read **ON TRACK 100%, 16 green, SCHEDULE INDEX 1.00 "at or ahead of
plan", COST INDEX 1.00 "inside the envelope"** — in a week when that
programme's gate was not convened and two of its exit documents were
refused. Nothing green was stored: `health`, `spi` and `cpi` were all
null in the database. The colour was manufactured at read time, because a
budget of zero satisfies `pv >= bac * 0.02 && ac >= bac * 0.005` twice —
`0 >= 0` — so the project was classified **measurable**, its indices
computed to exactly 1.00, and `health()` asserted they were "both inside
tolerance". The honest branch existed, was unreachable for such a project,
and was **also green**.

- `measurable` now requires a budget. Both indices return **`null`**
  rather than 1.00 — an index nobody measured is not one, and the product
  says `—` for a number it does not have everywhere else.
- A **fourth health state**, *not measured*, drawn grey and with its word.
  It cost no schema change. "Too early to measure" and "nothing to
  measure" are both absences, they stay distinct, and neither is green.
- **Correcting the guard alone would not have fixed the tiles.** With
  every project unmeasurable the live set is empty, and the roll-up's own
  `: 1` fallbacks kept returning 1.00 — the page would have gone on lying.
  They return `null` too, and the tile counts what is measured, saying how
  many are not.
- Three surfaces failed **green** on a value they did not recognise (the
  roadmap bar, the report tiles, the copy-status export, which printed
  "Red"); one crashed the health sort; and the meeting agenda's "projects
  off track" filter was `rag !== "G"`, which would have swept every
  unmeasured project in as AMBER. All corrected.
- **The reason this could not wait**: the manufactured green was being
  written into `report_snapshot` at period close, which is append-only at
  the database. A wrong number was becoming permanent, unamendable
  history — reproduced in one API call (D-33.45).

### Added

- **A write refuses a body it does not understand** (their REQ-19). Every
  `PUT /api/v1/*` now rejects a field the collection does not declare, and
  a body that names nothing to write, before it reserves an idempotency
  key, opens a transaction or writes an audit row. The refusal names what
  the collection *does* accept and points at the contract, and the
  published OpenAPI now says `additionalProperties: false` — the document
  states the rule the server enforces. Two latent faults fell out of
  building it: `decisions` asserted `version` without declaring it, and
  `business-case` had never had a described body because the collection
  matcher did not match a hyphen.
- **F12 · `register-reachable`** — a gate that fails when a request marked
  `done` names files the default branch does not carry. It separates a
  false claim (fails anywhere) from merge debt (reported and counted off
  the default branch), always prints what it compared against, and exits 2
  rather than passing when it cannot compare. A tag build is strict.
- **The exception sweep can be asked for** (their Q-2), and runs once at
  start rather than only on the hour. They set a tolerance, breached it,
  and saw nothing all session because there was no way to make the sweep
  run. A control nobody can watch work is a control nobody can believe.
  It stays a constat: it opens only what the numbers already say, it is
  audited under `system`, and asking twice does not stack.
- **A decision may cite evidence that lives in a repository** (their D-8).
  Nineteen of their decision records went in with an empty evidence link
  because the true evidence — a versioned file at a revision — could not
  be expressed. A repository path, a path at a commit, a bare commit and a
  named locator now join http(s). Prose is still refused: a sentence with
  no locator cannot be found again.

### Fixed

- **A rollout wave is one site, and the refusal now says so** (their
  REQ-37). Declined as a defect — it is design, held by `rbac.js`, by
  docs/14 V-06, by the screen, and by a test since V-06 — and their own
  fallback clause was declined with it: `seq` orders the *sites*, and
  removing it would delete the order of the rollout to fix a message. What
  was wrong was the message, which now says what the design is and where
  phases belong.
- **The formatters no longer invent a number.** `money(undefined)`
  rendered `$NaNM` and `idx(NaN)` rendered `NaN` — RT365 saw `# NaN` in
  the pipeline and had the grace not to file it. They return `—`, which is
  how the product says "no number" everywhere else.

### Not done, and it is the one thing they ranked above everything

Their REQ-32 — **the default branch carries what this register calls
done** — is filed here as **REQ-39**, and it is `open`. Measured on a
clean clone: `main` is 5.9.0 dated 1 September, there is no
`docs/requests/` directory at all, `npm run seed` reports success and
writes nothing to disk, `GET /` answers 404, and the published admin
password answers 401. The three first-hour defects we fixed reproduce
verbatim, because the fix was never merged. Twenty-three requests in the
register read `done`, and forty-two of the files they name do not exist
for anyone who clones.

The merge is a fast-forward with no conflicts, and the 5.9.0 → 5.13.0
upgrade was measured working against a real book with its data intact and
re-running as a no-op. What is missing is a decision and a push, and
neither is an agent's to make: the branch to develop on is designated, and
a tag ref is refused 403 from a session. F12 now counts the debt on every
`npm run audit` — but a gate that counts merge debt is not a substitute
for paying it.

---

## [5.12.0] — 2026-09-08 · built, first released in 5.16.0

RT365 consolidated its field work into two reports — one on **value**, one
on **evidence** — and they are the most exacting thing this product has
been handed. The value report's argument is a single sentence: *everything
in the model is a noun, and value gets realised by verbs.* It names five
missing verbs, each pointed at a file and a line, and it corrects its own
earlier findings in three places where reading the code changed what was
true.

A team was composed for it rather than one engineer working the list in
order (D-33.38): an interoperability engineer on the reusable loop, a
verification engineer on the three claims RT365 had honestly tagged
`[Open]` rather than asserted, and the delivery engineer on the two
entangled groups. Settling the open claims first was the right call — one
of the three turned out not to be a defect at all.

### Added

- **Forecast against realised, as one report** (V-4). `Engine.valueReport`,
  `GET /api/v1/value`, and a block on the reporting page — the same object
  in both. What the case promised sits on the same line as what the
  benefits measured, for the first time. RT365's hardest clause is held
  literally: **no derived currency conversion appears anywhere.** Each
  benefit is reported in its own unit with its attainment and how many
  days its review has been outstanding; the totals sum money-denominated
  benefits only and say out loud how many were excluded and in which
  units. A project with a case and no benefits, one with benefits and no
  case, and one with neither are each visible as such rather than absent.
- **The promise survives the conversion** (V-15). An approved demand
  becoming a project now creates its business case, carrying the
  requester's own `benefit_note` verbatim, its estimate, and a citation
  back to the request. Migration 028's header describes the chain demand →
  case → benefit → review; the conversion route was where it broke, at the
  exact moment the money is committed and the justification is freshest. A
  demand with no stated benefit still converts, and the case says so in as
  many words — a draft that admits it, never a fabricated justification.
- **Not measured is not within tolerance** (V-14). The benefit dimension
  had two answers, *within margin* and *breached*; a project that never
  measured anything produced no attainment, so no dimension, so no breach,
  and read as compliant. It now has a third: *nothing measured*, with the
  count. `breached` stays false, because it is not a breach and
  `breaches()` must not invent one. The sweep raises one exception per
  project naming how many benefits are past their date unmeasured, and
  since when.
- **The lesson and the case follow the ladder** (V-13, migration 043).
  036 freed the gate ladder to twelve and two tables did not travel with
  it. On RT365's six-gate ladder a lesson could not be tagged to gates 5
  or 6 — and the client form was already offering them, so the server
  refused what the screen invited. Their judgement was right: capping in
  silence is worse than not having the ladder configurable at all, because
  the failure is invisible until somebody tries.
- **A project says which ladder it was built on** (E-1). Declaring a
  ladder still does not rewrite existing projects — 036 is right, and
  dated gates with filed evidence must not move under the people who filed
  them — but a project now carries `scaffoldedGates`, and the screen says
  plainly, where the question is actually asked, when that is no longer
  what its programme declares. RT365 corrected its own V-8 in this report:
  `scaffoldProject` reads one ladder, and the duplicate gates in their
  book were their loader's.
- **The field-return loop is a published pattern, not an anecdote**
  (V-12). A JSON Schema for `meridian-request-register/1`, a gate that
  validates every register in CI, a review script whose register path and
  id vocabulary are configuration rather than one repository's
  conventions, a fixture second field repository reviewed end to end in a
  test, and one page of English documentation of the round.

### Fixed

- **The portfolio right rail ignored the programme filter.** Measured
  against RT365's E-6, which asked whether the executive tiles rescope:
  they do — all six, verified in a browser. The rail beside them did not,
  and listed other programmes' decisions and dates under a filter naming
  one. That is where their "Decisions owed 36" came from. Both helpers
  already took the scoped list; this view simply never passed it.
- **A milestone accepted by a named person read as PLANNED** (E-7). The
  write was always correct. The page derived state from date-versus-status-date
  and never read `done`, so it was wrong in both directions: an untouched
  milestone whose date had passed read Cleared, and a formally accepted one
  read Planned. The accepter's name had no read surface anywhere in the
  product — only the form that writes it. PM-04's control was in the table
  and not in the room.
- **The same decision could be minuted twice** (E-8). Two identical posts
  to the session route made two rows, and the minute carried the decision
  twice. The `PUT /api/v1/…/:externalId` path has been idempotent since
  I-2; the route the screen uses was not. The guard is scoped to the
  occurrence, so the same headline stays legitimately recordable in a
  later meeting — a revisited item, which is the normal case.
- **`accepted: false` and "cannot answer yet" read identically** (E-9).
  RT365 pointed out that their silence and their inability to confirm a
  feature they have not adopted looked the same in the register. `accepted`
  is now three-valued, and the schema makes the ambiguous combination
  impossible in a future round.

### Not taken, with a reason

V-9 (governance quality signals) stays open at RT365's own priority. Their
concern 6 asked us not to let their list crowd out our committees' backlog,
and to decline with a reason rather than carry debt — this round already
took four of their highest-priority items and three measured defects.
V-5, V-6, V-7, V-10 and V-11 remain open in their sequence.

---

## [5.11.0] — 2026-09-08 · built, first released in 5.16.0

RT365 re-tested 5.10.0 and filed a second list, V-1…V-12, under a heading
that named the point: *requirements for Meridian as the tool that drives
projects to business value*. Its argument was one sentence long and hard
to answer — **REQ-02 made delivery facts syncable from the field
repository; value facts still have to be typed in, so the one thing an
executive reads is the one thing that goes stale.** Their loader pushes
256 delivery writes and cannot push a single benefit.

This release takes the three RT365 ranked highest, plus the one change
the integrator ranked highest of its own three.

### Added

- **Value objects on the write API** (REQ-20 · V-1). `PUT
  /api/v1/benefits/{externalId}` and `PUT
  /api/v1/business-case/{externalId}` under `write:portfolio`, with the
  same eight rules as the delivery collections: your own identifier,
  `adopt` for a row born on a screen, `Idempotency-Key`, `version`
  asserted when sent, and audit under the integration's name. A benefit
  keeps ITS unit — percent, hours, ounces, currency — and is never
  divided by a million; an `actual` without `measuredOn` is refused,
  because a figure nobody can situate a year later is not a measurement.
  One case per project: a second is refused, naming the one to adopt.
- **The decision register and the actions are readable back** (REQ-15).
  `GET /api/v1/decisions` and `GET /api/v1/actions`, under a new
  `read:meetings` scope that mirrors `write:meetings` rather than riding
  on `read:portfolio` — INT-02 separated the audit trail so that a
  warehouse feed would not carry governance, and a decision register is
  the same. Writing without being able to read was not a contract: `adopt`
  had no discovery path for the two collections whose legacy rows exist,
  no reconciliation of what a room decided was possible without a
  session, and a sync could not see that a human had closed an action
  before it reopened it. Actions carry `raisedInStatus`, so a caller
  knows when it is about to write `Open` over the minute of a meeting.
- **The business case is reconfirmed at every gate, and the gate cannot
  pass without it** (REQ-22 · V-3). The fields have existed since
  migration 028 and nothing forced them. A gate milestone on a project
  that has a case is now refused unless the case was reconfirmed at THAT
  gate, on both write paths — the screen and `PUT /api/v1/milestones` —
  because a control on one of two paths is not a control. Reconfirming is
  a decision rather than a checkbox: a verdict (Continue, Continue with
  conditions, or **Stop**, which refuses the next gate), a named
  reconfirmer from the directory, a note, and the two figures as they
  stood, so the next gate reads the delta since the last one.
- **A benefit past its realisation date is chased, not hoped for**
  (REQ-21 · V-2). `realise_on` has been in the schema since migration 008
  and drove nothing. An unmeasured benefit whose date has passed now
  raises a portfolio exception like a tolerance breach, notifies the
  person who owns it, and appears on the next agenda of a board that sees
  the project, marked OVERDUE with its target in its own unit. Closed
  projects count — that is the normal case, and exactly why nothing ever
  chased the date.

### Fixed

- **A re-run that changes nothing now writes nothing.** Every upsert built
  its patch from the fields that were SENT rather than the fields that
  CHANGED, so an unchanged reload wrote an audit event and bumped
  `row_version` on every row it touched — the integrator measured 285 of
  each for a load that changed nothing. A trail that fills with
  non-events cannot be read, and a version that moves under a reader who
  did nothing is worse than useless. The decision path already filtered
  this way; it is now the rule for all ten collections, with a comparison
  tolerant of the shapes a driver returns (a `numeric` comes back as a
  string, a `date` as a Date).
- **Reconfirming the case updated the header and not the list.** The
  screen said "reconfirmed at gate 1" two lines above "not reconfirmed at
  any gate yet": the write touches two collections and the refresh named
  only one. Found by walking it in a browser, not by a test — both writes
  were correct on their own.
- **Migration 028 capped case reconfirmation at gate 4**, the four
  hard-wired gates of the day. Since 036 a ladder can carry twelve, so a
  programme that declared six gates could not reconfirm its case at gates
  5 and 6: the constraint refused the row without explaining itself. The
  bound now follows the project's own ladder.
- **Two gates were looking the wrong way.** `business_case` was declared
  nowhere in the CRUD gate, so neither its verbs nor its columns were ever
  checked — on a table shipped in migration 028. And the field-help gate
  read a field only as far as its first `}`, so any field whose options
  are written out in full ended before its own `hint` and was reported as
  having none; it now reads a whole field with balanced braces, which
  makes it stricter, not kinder.

---

## [5.10.0] — 2026-09-08 · built, first released in 5.16.0

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
## [5.9.1] — 2026-09-23

What running a real programme (FitAdapt) on a clean clone of `main`
found on its first day: the import could not import, the quick start
could not sign anyone in, and an unmeasured project called itself green.

### Fixed

- **Whole-book import answered 400 for every book, including Meridian's
  own export.** The identifier-counter query in `importBook()` wrote
  `'\D'` inside a template literal; JavaScript drops the backslash, so
  PostgreSQL received `regexp_replace(id, 'D', …)` and the `::int` cast
  failed on the first id. Nothing tested `POST /api/admin/import`, which
  is how it shipped. `server/test/import.test.js` now round-trips the
  seeded book. Found by running a real programme (FitAdapt) on Meridian.
- **Imported documents lost their evidence.** The import did not carry
  `uri`, `uri_locked_hash`, `uri_locked_on` or `supersedes`, so every
  approved document came back as a label with nothing behind it (R-01)
  and every cleared gate turned overdue. All four now round-trip.
- **The import refused the file `GET /api/admin/export` produces.** The
  route read only `{ db: <book> }`, the interface's envelope; it now also
  accepts the bare book the export answers.
- **The README quick start could not sign anyone in on a fresh clone.**
  With no `PGLITE_DIR` the PGlite fallback was an in-memory database:
  `npm run seed` built a book that died with its process and `npm run
  dev` started on an empty one with no accounts. The fallback is now
  `server/.data/pgdata`, as documented, and the directory is created if
  it does not exist (setting `PGLITE_DIR` to a new path used to fail with
  `ENOENT`). `dataDir: null` remains an explicit in-memory request and
  now wins over `PGLITE_DIR`, so tests never touch a developer's book.
- **`scripts/restart.sh` only worked on Windows.** It found the listener
  through `powershell.exe`; on Linux and macOS it stopped nothing and
  started a second server on the same data directory. It now uses `lsof`
  or `ss` there, sends SIGTERM, waits for the process to exit, and
  refuses to start a second server if the first is still running.
- **A refused import did not say which row.** The answer was only "One
  of those values is not in a form the system can read", and nothing
  reached the log. It now names the table and the id (`… — project
  PRJ-104`), logs the database's own message, and the transaction still
  rolls back whole.
- **A project with no cost baseline reported itself measured and green
  (MER-04).** With a zero budget the earned-value guard still passed, so
  SPI and CPI came out as 1.00 and health read "within tolerance" over a
  project nobody had measured; progress read 0% whatever the plan said.
  The engine now says there is no cost baseline, and progress falls back
  to the weighted activity progress. Ported from
  `claude/dynamic-gates-and-requirements` (44782b1), which carried the
  fix without a test and was never merged; `engine.test.js` now pins it.
  This changes a number `shared/engine.js` produces, deliberately: the
  old number was not a measurement.

### Security

- **`qs` 6.15.3 → 6.16.0** (transitive, through Express and
  `body-parser`). 6.15.3 carries two moderate advisories that reach the
  JSON and query parsers every request goes through: an array-limit
  bypass via bracket-key comma parsing (GHSA-x5fp-wj9c-mxmx) and a
  denial of service through an attacker-controlled `isBuffer`
  (GHSA-4mjr-xmp4-gh2g). `npm audit` now reports nothing, not merely
  nothing above the `high` threshold the build enforces.

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

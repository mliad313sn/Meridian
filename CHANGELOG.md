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

## [5.15.0] — 2026-09-09

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

## [5.14.0] — 2026-09-08

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

## [5.13.0] — 2026-09-08

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

## [5.12.0] — 2026-09-08

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

## [5.11.0] — 2026-09-08

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

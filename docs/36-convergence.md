# 36 · Convergence — one main, every field return closed

**Opened 23 September 2026** by the Product Owner (charter:
[docs/33 §1](33-retour-terrain-rt365.md#1--the-product-owner-of-meridian)),
running the `/goal-converge` campaign. It exists because of one measured
fact:

> On 23/09/2026 the product anyone clones (main, 5.9.0) could not import
> its own export, while four unreleased lines carried the fix. Three
> field programmes had each rediscovered defects another had already
> fixed.

The campaign has two halves, in this order and never interleaved.
**Converge** is wave 0: everything proven reaches main, released and
tagged. **Improve** is waves 1–4: every open request from the field, in
value order, each delivered straight to main.

A line is **built** when it passes on a branch. It is **done** only when
a pull request has merged it to main and a tag carries it.

---

## 1 · State, measured

Every run re-measures before deciding. The last measurement is recorded
here, and the one before it is kept for comparison.

| Run | main | Latest tag | Unmerged lines | Tests on main | Round trip on main |
|---|---|---|---|---|---|
| 23/09 (1) | 5.9.0 · 77c4b49 | v5.9.0 | 4: `fix/dogfood-import-and-first-run` (6 ahead), `claude/meridian-rt365-feedback-d6vo3i` (20 ahead, 14 days), `claude/dynamic-gates-and-requirements` (3 ahead, 4 days), `claude/project-analysis-db-schema-yph5ho` (6 ahead, 7 behind, 23 days) | 449/449, gates ok, 1 moderate advisory (`qs`) | **400** |
| 23/09 (2) | 5.9.1 · 6d8eddf (PR #14) | v5.9.0: **`v5.9.1` is not on the remote** (not in `git ls-remote`, not in the GitHub API) | 3 | 460/460, audit 0 | 200 |
| 23/09 (3) | 5.28.0 (PRs #19–#37) | v5.9.0: **no newer tag on the remote**; twenty tags owed (§5) | 1, declared superseded (`claude/project-analysis-db-schema-yph5ho`, 6 ahead, D-36.08); the three field lines are 0 ahead | 1004/1004, fourteen static gates plus F13, audit 0 | 200, strict (F13: no loss named, none found) |

---

## 2 · The lines

Each line records **Observed · Source · Decision · Delivered (commit, PR,
tag) · Measure · Remains**.

### Wave 0 — converge

#### C-01 · Release 5.9.1 — BUILT (merged; tag awaiting owner)

- **Observed**: `POST /api/admin/import` answered 400 on main's own
  export. The P3 probe measured it.
- **Source**: FitAdapt dogfooding, DF-01…DF-08, and PR #14.
- **Decision**: merge PR #14 as it stood. Before merging it passed 460/460
  tests, every gate, `npm audit` 0 and a round trip of 200.
- **Delivered**: PR #14, merged in 6d8eddf on 23/09.
- **Measure**: P3 returns 200 on main after the merge.
- **Remains**: the `v5.9.1` tag. The session's permission classifier
  refused `git tag`/`git push origin v5.9.1` ("Merge Without Review").
  The refusal was recorded, not routed around (constitution §6). The
  owner reported pushing the tag, but it is not on the remote yet. The
  DF-01…DF-08 answers on PR #14 wait for the tag.

#### C-02 · The RT365 line onto main as 5.16.0 — see §4 for status

- **Observed**: `claude/meridian-rt365-feedback-d6vo3i` carried 5.10.0 to
  5.15.0: 20 commits, 770 tests, migrations 034–050. None of it was on
  main. Gate F12 counted 66 register claims owed to main.
- **Source**: `docs/33`, `docs/requests/rt365.json`, and issue #15.
- **Decision**: D-36.01, D-36.01 bis and D-36.03 below.
- **Delivered**: the merge of `origin/main` (5.9.1) into the RT365 line,
  on the working branch. There were six conflicts, as measured:
  CHANGELOG, package.json, lockfile, `scripts/restart.sh`,
  `server/src/db.js` and `shared/engine.js`.
- **Measure**: `npm run verify` passes 781/781 (770 + 11 from 5.9.1).
  The P3 round trip returns 200. `npm audit` reports 0. F12 must read 0
  claims owed once this is on main.
- **Remains**: the tag `v5.16.0`, and the reconciliation of issues #1–13
  (§3).

#### C-03 · The KODO line onto main as 5.17.0 — BUILT, PR after C-02

- **Observed**: `claude/dynamic-gates-and-requirements` held three
  commits from 19/09 (MER-01…MER-15). KODO had to apply them to Meridian
  as three hand patches. The line has migrations 034 and 035, which
  collide with RT365's 034 and 035.
- **Source**: KODO `docs/reports/MERIDIAN_PRODUCT_REPORT.md`, read at
  8ad1d15 (`docs/requests/kodo.json`, new).
- **Decision**: D-36.02, D-36.02 bis, D-36.04 and D-36.05 below.
- **Delivered**: a merge of the KODO line onto C-02. There were six
  conflicts:
  - `db.js`: the one resolver.
  - `import.js`: KODO's importer plus 5.9.1's row locator and evidence
    fields.
  - `portfolio.js`: the union of both sides.
  - `meetings.js`: both column sets.
  - `persistence.test.js`: the migration list.
  - `engine.js`: D-36.02.

  The migrations were renamed to `051_gate_model_and_requirements` and
  `052_findings_seats_and_decisions` (constitution §3: never applied by
  main or a tag).
- **Measure**:
  - `npm test` passes 816/816. That is 781 + KODO's 18 + the 17 restored
    by NEW-03.
  - The P3 round trip returns 200, and a re-export matches the first
    export count for count.
  - **KODO's own book** (`delivery/meridian/kodo_import_payload.json`,
    unpatched) is refused 400 for its missing `currencyUnit`. That is
    KODO's own MER-09 rule. With `"currencyUnit": "millions"` added it
    returns 200: 19 projects, 136 requirements, and the six gates with G5
    looping to G1. Its own export → import round trip returns 200.
- **Remains**:
  - The `v5.17.0` tag.
  - NEW-02 and NEW-04.
  - MER-01, 03, 05, 06, 07, 08, 10 and 11 are **partial**, each with its
    remaining work stated in `kodo.json`.

#### NEW-01 · The export writes `capitalised`, the import refused it — BUILT in C-03

KODO's MER-14 refused unknown allocation keys from a hand-typed list, so
Meridian's own export came back 400 for a new reason. The accepted keys
are now `Object.keys(allocationOut({}))`, read from the serialiser the
export uses. `capitalised` is imported where it was dropped before. The
P3 round trip pins it.

#### NEW-02 · Gate 0 means two things — open, wave 1

Since migration 002, `document.gate = 0` has meant "attached to no gate".
RT365's 047 gave `gate_criterion.gate = 0` the same meaning. KODO's
portfolio model numbers its mandate gate **G0**. On KODO's book, a
document filed "for G0" is therefore also "attached to no gate". The
choice is between numbering a model from 1, and giving "no gate" a value
that cannot be a rung. The choice is left open until that decision; it
is not guessed.

#### NEW-03 · Seventeen segregation-of-duties tests deleted by the KODO line — FIXED in C-03

KODO's de3d924 wrote its governance tests into `governance.test.js`, and
the file **replaced** the one on main. The seventeen tests it held were
deleted: the raiser of a change cannot decide it, the owner never
approves their own evidence, the digest, and fourteen more. The
announced "+18 tests" hid 17 removals (constitution §1: tests never
weakened). Both files now stand. The restored tests pass against the
KODO code, so the removal hid no regression; it removed only the ability
to see one.

#### NEW-04 · KODO's registers have no write route and no screen — BUILT, PR as 5.22.0

Routes, screens, authority in `rbac.js` (six actions, each with its
reason), migration 055, 28 tests, and a browser walk across four roles.
F2's shrink-only list emptied of its sixteen NEW-04 lines, as designed.
KODO MER-05, 06, 07 and 11 are done. MER-03 (CI endpoint, bulk import)
and MER-10 (agenda from outstanding evidence) stay partial, with their
remaining work in `kodo.json`.


Requirements, evidence, findings, seats (with their incompatibilities)
and objections enter the book only through the import. KODO says so
itself (report:39-43). Gate F2 did not report it: first because it could
not parse `IF NOT EXISTS` (fixed in C-03), and then because its entity
list is hand-written and does not name them. That second cause is
REQ-52's blind spot exactly, so REQ-52 and NEW-04 close together.

#### C-04 · Salvage the documentation branch — BUILT, PR as 5.18.0

- **Observed**: `claude/project-analysis-db-schema-yph5ho` (31/08,
  forked from **5.3.0**) held a technical reference, the user manual (EN
  and FR), the documentation committee's record, and the fixes that
  committee found: O-1…O-7, the tolerance notification, the health
  override dialog and the evidence-hosts field. It could not be merged:
  its `027_notification_kinds` collides with main's `027_international`,
  and its docs 29–32 reuse numbers main holds.
- **Decision**: carried over, not merged. Each fix was re-checked against
  5.17.0 and delivered as new work (migration **053**, not 027). The
  documents were renumbered **37–40** and rewritten from the 5.18.0
  source. The branch is declared superseded in
  `docs/superseded-branches.json` (gate F14).
- **Delivered**:
  - **O-1 and O-2**: notification scope and cadence honoured, the five
    silent kinds emitted, and quiet hours and subscriptions put on a
    screen.
  - **053**: `tolerance-breached` and `benefit-review-due`, both refused
    by the CHECK and swallowed by a catch.
  - **O-3**: lessons offered at project creation.
  - **O-4**: the person form's contract fields.
  - **O-5**: the New project probe.
  - **O-6**: translated labels in FR and ES.
  - **O-7**: `Engine.crossDepBreaches`, additive.
  - The health override dialog.
  - The Evidence hosts field.
  - docs/37–40, and the README's *Deploying it* section.
- **Measure**:
  - `npm test` passes 835/835, up 19 from 816 (`outreach.test.js` 11,
    `committee-fixes.test.js` 8).
  - Every gate is green.
  - Manual procedures were walked by API and in the browser, across 21
    screens × 4 roles × EN/FR.
- **Remains**: the tag, and NEW-06…NEW-13 below, found by walking the
  manual.

#### C-05 · F13 round trip, F14 merge debt — BUILT, PR as 5.18.1

- **Observed**: no gate asked whether proven work was stranded on a
  branch, or whether the book survived its own round trip. The P3 probe
  asked only for a 200.
- **Decision**: D-36.07 and D-36.08 below.
- **Delivered**:
  - `server/test/roundtrip.test.js` (F13, 5 tests, in `npm test`).
  - `scripts/audit/merge-debt.mjs` (F14, in `npm run audit`).
  - `docs/superseded-branches.json`, which declares the documentation
    branch superseded (C-04) at 7693f6d.
  - REQ-53: `register-schema.mjs` accepts file paths.
  - The rule in CONTRIBUTING and `/product-owner`.
- **Measure**:
  - F13 is proven by three deliberate breaks (`'\D'`, `capitalised`
    dropped, a healed loss left listed), each failing, and the restored
    code passing.
  - F14 fails on the undeclared documentation branch and passes once it
    is declared. `--now 2026-10-05` turns three branches into debt.
  - `npm run verify` passes 840/840.
- **Remains**: the tag.

#### NEW-05 · The export writes what the import erases — BUILT, PR as 5.20.1

Closed with NEW-07. All 15 collections are imported. 85 fields are
restored: the 38 named, plus 47 that the full enrichment found. F13's two
loss lists are empty, and a new F13 check fails if any exported field of
an imported register holds no value in the probe. KODO's book imports,
round-trips and merges (dry run) with 200. Tests: 866 (+6).

What follows is the measurement as it stood when the line opened:


Measured on 23/09 while building F13. The export writes **15 collections
the importer never reads**: absences, benefits, business cases, case
reconfirmations, commitments, the comms plan, gate criteria, exceptions,
external links, lessons, stakeholders, timesheets, tolerances, rollout
waves and site windows. An import deletes the projects, so the cascade
erases every one of those rows.

On the collections the importer does read, **38 fields** come back
different:
- A cost line is re-numbered and rewritten as "Imported", "Labour", USD,
  capex, on the first of the month, and not from contingency.
- A programme loses its gate ladder.
- A person loses their contract fields.
- A project loses its post-implementation review, its scores, and what
  its date rests on.
- A milestone loses its acceptance criteria.
- A RAID row loses its residual target.

Every earlier round-trip probe answered 200, because the seeded book
holds none of these values. F13 now names each loss (collections and
fields) and fails on any new one. The line closes when both lists in
`server/test/roundtrip.test.js` are empty. This outranks everything else
in wave 1: it is data that cannot leave the product, and it silently
contradicts `docs/25` (reversibility).

#### NEW-06 … NEW-13 · Found by walking the manual (C-04) — open

| Id | Defect | Wave |
|---|---|---|
| NEW-14 | **BUILT (5.21.0) with NEW-15 and NEW-16.** **The meeting register and RAID reviews are not in the book.** The export writes no meeting series, occurrence, decision, action or review, and a replace import erases them. FitAdapt's `bootstrap.mjs` says so ("the import REPLACES the whole book, meetings included"), and an imported objection cannot find its decision. | 1 |
| NEW-15 | A real (non-dry-run) import drops the rows it refuses by name without returning `rejects`. Only a dry run says so. | 1 |
| NEW-16 | A merge import rewrites rows without bumping `row_version`, so a screen holding the old version can still write over them. | 1 |
| NEW-18 | **BUILT (5.24.0).** The book writes only ACTIVE sites, programmes and people, so a row that points at an inactive one (a closed project's old site, a leaver who owned a risk) is refused by the import. The refusal names it, but the row does not come back. Found with NEW-14. | 1 |
| NEW-19 | **BUILT (5.24.0), moved to wave 1 (D-36.16).** A replace import resets every `row_version` to 1. A screen holding version 1 of a row that was at 7 can then write over it. | 1 |
| NEW-20 | **BUILT (5.24.0), moved to wave 1 (D-36.16).** The import screen does not warn that a replace erases everything the file does not carry (a KODO book, or any export older than 5.21.0, has no meeting lists). Such a book should be merged. | 3 |
| NEW-17 | A merge can leave two active tolerances on one project when the file's active tolerance has a different id. | 3 |
| NEW-06 | The forced password change never opens: `/api/bootstrap` `me` carries no `mustChangePassword`, so an account an administrator created cannot change its password from any screen, and every write is refused. **BUILT (5.20.2)**: seen in the browser. | 1 |
| NEW-07 | A merge-mode dry run of the product's own export answers 400 on a duplicate `change_step` key (MER-08). **BUILT with NEW-05 (5.20.1).** | 1 |
| NEW-08 | `GET /api/v1/signals` is live and absent from the published contract: F9 reads only `routes/v1.js` (REQ-52's blind spot, a sixth time). **BUILT with REQ-52 (5.21.1).** | 1 |
| NEW-21 | Four fields no screen draws, listed by the stricter F2 as known gaps: `notification.acted_at` (nothing writes or reads it), `integration.rotated_at` (sent, not drawn), `event_delivery.last_error` and `delivered_at` (no screen calls the deliveries route, so an admin cannot see why a webhook failed). | 3 |
| NEW-22 | A deputy who signs a change step *for* X is recorded as the deputy's own person, so X can then sign the next step of the same request. Closing it needs a `decided_for_person` column. Found building PR-04; outside D-36.11's scope. | 3 |
| NEW-23 | After a grant is added from the grants dialog, the accounts list does not redraw until the page is reloaded. The grant is saved. Pre-existing; found building #16. | 3 |
| NEW-24 | **BUILT (5.28.1).** The export read requirements, evidence and findings only for visible projects, so a row with no project (KODO's FR-M20/M21 requirements) was imported, stored, left out of the next export, and erased by a replace of it without `erased` counting it. Found by the field re-run of 23/09. | 1 |
| NEW-25 | The main client bundle is at the D-41.03 cap after docs/41: 289.69 kB gzip against 289.70 kB. Four screens already load on first use (print pack, risk charts, Scenarios, master schedule, MS Project import dialog). Anything added to the main chunk must first move something else out. | 3 |
| NEW-26 | **BUILT (5.37.0).** A project created in the app was scaffolded from its programme's ladder, else the default four, and ignored the portfolio model (`settings.gates`, MER-01) that the engine governs it by. A KODO project was born with G1–G4 on a portfolio that reviews G0–G6. Scaffold and the MS Project import dialog now read programme → portfolio → default, as `Engine.gates` does. `portfolio-ladder.test.js` fails on 5.36.1. Found by the committee's re-read of the field books. | 1 |
| NEW-09 | On SIGTERM the process exits before PGlite closes (`claimBook` calls `process.exit` first). **BUILT (5.20.2)**. Corrected diagnosis: the leftover `postmaster.pid` is PGlite 0.2.x behaviour even after a clean close; the defect was the unclosed book. `shutdown.test.js` fails on 5.20.1. | 1 |
| NEW-10 | Saving a programme's gate ladder from the screen drops `loopsTo` and `scope` (D-36.02 holds in the engine and the validator, not in the form). **BUILT (5.20.2)**: optional `loops to N` and scope columns; seen in the browser. | 1 |
| NEW-11 | Administration's notifications panel still names SMTP, and the CSV import panel is French in every language. | 3 |
| NEW-12 | `/` answers 404 when the install path contains a dot-directory (`sendFile` refuses it). | 4 |
| NEW-13 | Spanish notification strings reach nobody: `inLocale` treats any non-`fr` locale as English, and `/auth/preferences` accepts only `en` and `fr`. | 3 |

#### Field re-run against 5.28.0 (P5, 23/09)

| Field | Commit | Meridian checks | Result |
|---|---|---|---|
| FitAdapt | 66c7f34 (branch `claude/vigilant-franklin-76iok4`) | `pmo/meridian/bootstrap.mjs`: export, replace import, 3 series, settings | **Refused on `currencyUnit`** (D-36.04, since 5.17.0: FitAdapt was never told, now said on DF-09); with the header, 7 projects imported and a round trip at 0 rejects |
| KODO | 8ad1d15 | 6 committed books, generator `tools/meridian_book.py` | Same refusal; with the header all merge at 0 rejects; **NEW-24** found |
| RT365 | 670bfbd (`claude/project-owner-agent-setup-hi3xqu`) | `test_meridian_sync.py`, live sync | 4/4; 367 writes, all 2xx; idempotent second run. Its script adds a second set of gate milestones (field-side: it looks for the exact name "Gate A") |

Field-side, not Meridian's: FitAdapt's and KODO's generators lack the
`currencyUnit` header; KODO's committed book is stale (136 vs 148
requirements) and its docs name `/api/v1/admin/import`, which does not
exist; RT365's sync duplicates scaffolded gates. No field repository has
a new Meridian request since its register.

#### C-06 · Refresh the public record — BUILT, PR as 5.18.2

- **Observed**: the README said twelve gates (there were thirteen),
  SECURITY.md said "334 tests, eight static gates", and "What you are not
  getting" said nothing of NEW-05, NEW-04 or the missing tags.
- **Delivered**: gate **F15** (`scripts/audit/public-record.mjs`). The
  numbers are corrected, and the README section is restated for 5.18.
- **Measure**: F15 failed on the five stale numbers (proven) and passes
  with 0. `npm run verify` is green.
- **`released` fields**: every register line stays `released: false`,
  honestly. No tag newer than `v5.9.0` exists on the remote as of this
  line, and constitution §4 says a line no tag carries is built, not done.
- **Branch deletion (proposed, not performed; the owner confirms)**:

  | Branch | State on 23/09 | Proposal |
  |---|---|---|
  | `fix/dogfood-import-and-first-run` | 0 ahead of main (PR #14 merged) | delete |
  | `claude/meridian-rt365-feedback-d6vo3i` | 0 ahead (PR #19 merged) | delete |
  | `claude/dynamic-gates-and-requirements` | 0 ahead (PR #20 merged) | delete |
  | `claude/project-analysis-db-schema-yph5ho` | 6 ahead, superseded (C-04, `docs/superseded-branches.json`) | delete, then remove its entry from the superseded list |
  | `claude/relaxed-ritchie-bps7ih` | this campaign's working branch | keep until the campaign closes |

- **Issues #1–4, #6–9, #11–13** (§3): their fixes are on `main` since
  #19 (f423a00). They stay closed, because none is on a branch any
  more. What they still lack is a tag, and that is stated once on #15,
  not eleven times.

### Waves 1–4

#### #18 · DF-12 · A site is a place or a team — BUILT, PR as 5.28.0

- **Delivered** (D-36.13): migration 060 (`site.kind`, optional
  timezone for a team, trigger refusing windows and waves at a team);
  `shared/sitekind.js`; every timezone reader checked, falling back to
  UTC for a team; Locations shows places only and names what it left out.
- **Measure**: `site-kind.test.js`, 11 tests; F13 enriched. Browser: 15
  checks.
- **Remains**: none.

#### REQ-13 · A standing human act holds its gate — BUILT, PR as 5.27.0

- **Delivered** (D-36.15): migration 059 (`blocks_gate`,
  `closure_evidence`, two database checks); `humanActRefusal` shared by
  every write path; `gateStatus`/`scopedGateStatus` return `holds`, and
  `canAdvance` refuses after vetoes and before evidence; screens and the
  contract.
- **Measure**: `humanact.test.js`, 11 tests, including identical engine
  numbers before and after. Browser: held, refused on prose, lifted on a
  locator.
- **Remains**: none. RT365 marks its H-nn rows `blocksGate` in its sync.

#### #16 · DF-10 · MER-06 · An evidence-review grant — BUILT, PR as 5.26.0

- **Delivered** (D-36.12, D-36.12 bis): migration 058; review grants in
  `rbac.js` kept apart from write grants; pure approval; the expected
  seat; the grants dialog; `docs/04` gains a review-grant section.
- **Measure**: `review-grant.test.js`, 23 tests (exhaustive
  with/without-grant comparison); the "viewers are refused everything"
  test is untouched and green. Browser: granted, approved, audited in the
  reviewer's name.
- **Remains**: NEW-23.

#### #17 · DF-11 · REQ-29 · MER-11 · One typed external reference — BUILT, PR as 5.25.0

- **Delivered** (D-36.14): migration 057 on `ext_link`; canonical refs
  normalised by the server; a state pushed by an integration, never
  fetched; citation versioning for criteria; the "Where the work is"
  panel. The SDP refresh no longer treats foreign links as its own.
- **Measure**: `references.test.js`, 18 tests; F13 enriched. Browser:
  linked on screen, reported through `/api/v1`, read back as "as last
  reported by FitAdapt GitHub Action".
- **Remains**: none. Integrated before #16 so that migrations reach
  main in number order.

#### REQ-48 · The demonstration book carries value — BUILT, PR as 5.24.0 (with NEW-18, NEW-19, NEW-20)

- **Delivered**:
  - REQ-48: six business cases, eight benefits, two tolerances, and the
    production sweep run by the seed. The suites that leaned on an empty
    seed now build their own fixture: the seed was made harmless to the
    tests first, and the cases were seeded second, as the register asked.
  - NEW-18: the export carries inactive sites, programmes and people.
  - NEW-19: a replace moves versions forward.
  - NEW-20: the screen warns before a replace, with counts.
- **Measure**: `demobook.test.js`, `book-replace.test.js` (6), F13
  stricter (versions strictly greater, inactive rows). Browser: six value
  figures measured; the replace warning seen, and Cancel changed nothing.

#### PR-04 · Each step of a change chain has its own signatory — BUILT, PR as 5.23.0

- **Observed**: one person could sign all four steps of a change
  request. The admin branch of `can()` returned before any rule, and the
  route checked only the raiser.
- **Delivered** (D-36.11):
  - `distinctSignatory` in `rbac.js`, applied to administrators too.
  - Migration 056 records the signing person beside the account.
  - The view draws *Approve* only when the rule would pass, and says why
    when it would not.
  - The export and import carry the signer of each step.
- **Measure**: `change-chain.test.js`, 15 tests. Five existing chains
  were rewalked with distinct signers, each with one more assertion
  than before. The browser was exercised: the step-1 signer sees no
  *Approve* on step 2, and a direct POST gets 403 with the reason. Sweep
  unchanged (286 cases, 11 points).
- **Remains**: NEW-22. Release note: a four-step chain needs four people.

#### REQ-51 · The contract records that a review happened — BUILT, PR as 5.20.0

- **Delivered**:
  - `PUT /api/v1/raid-reviews/:externalId`.
  - Migration 054: `raid_review` gets an external identity.
  - `raidreview.js`: one projection of the next due date for both doors.
- **Measure**: `raidreview-contract.test.js`, 7 tests. `writeapi.test.js`
  is unchanged and green (54).
- **Remains**: RT365 deleting its `meridian_sync.py` workaround is theirs
  to do. `accepted` stays null until they say so.

#### REQ-50 · Ratify from a screen, in one's own name — BUILT, PR as 5.19.0

- **Delivered**:
  - `decision.ratify` in `rbac.js`.
  - `POST /api/decisions/:id/ratify`.
  - The *Ratify* button in the decision register. It is drawn only when
    `can` **and** `canRatifyDecision` would pass for the person signed
    in.
  - One decision (D-36.10): the ratifier is always the person signed in.
- **Measure**:
  - `ratify.test.js`: +7 tests.
  - In the browser: the recorder sees no button; R. Kaur ratifies, and
    the row reads PE-14, today. No console errors.

#### REQ-49 · Ratification held to one rule on both doors — BUILT, PR as 5.18.3

- **Observed**: the session route took `ratifiedBy` as free text. While
  proving the fix, a second defect turned up: the contract's
  "recording hand" check compared a person id with an account id, so it
  never fired.
- **Delivered**: `canRatifyDecision` now compares the ratifier with the
  recorder's person. `POST /api/decisions` resolves the ratifier in the
  directory and applies the rule.
- **Measure**: `ratify.test.js`, 6 tests. Four fail on 5.18.2 and pass
  now.
- **Remains**: none for REQ-49. On the campaign's two other conditions:
  - "The signal ignores unmarked rows": no governance signal reads
    `ratified_by` (checked in `govsignals.js` and `valuepage.js`), so no
    row is counted on an unchecked name. Old rows keep their text,
    visible and not rewritten (D-36.09).
  - The ratification screen is REQ-50.

These are taken in the order of the campaign file once wave 0 is closed:
REQ-49, REQ-50, REQ-51, PR-04, REQ-48, REQ-52, then #16/DF-10/MER-06,
#18/DF-12, #17/DF-11/REQ-29/MER-11, REQ-13, then wave 3 (under the check
of `docs/23` §5 refusal 1), then wave 4.

---

## 3 · Issues closed while their fixes were only on a branch

Issues #1–4, #6–9 and #11–13 were closed on 08/09 while their fixes lived
on `claude/meridian-rt365-feedback-d6vo3i`. After C-02 merges, those
fixes are on main but no tag carries them. They are reconciled as follows.
Each issue receives a comment naming the merge and the release that will
carry it. An issue is closed as delivered only when `v5.16.0` exists.

---

## 4 · Decisions

| Id | Date | Decision | Alternatives refused | Line |
|---|---|---|---|---|
| D-36.01 | 23/09 | **One MER-04 rule on main: RT365's REQ-33.** A project with no budget has no scale, so SPI and CPI are `null` and health is `N` with "Nothing measured — no budget". In the engine (constitution §2) this changes two figures. *Before (5.9.1):* SPI 1, CPI 1, RAG `G` "No cost baseline". *After:* SPI `null`, CPI `null`, RAG `N`. 1.00 was not a measurement: nothing had been measured against a budget of zero. 5.9.1's other half stays: percent complete falls back to the weighted physical progress of the plan, which is observed. 5.9.1's MER-04 test now asserts `N` and `null`, which is stricter than `G`. | Keep 5.9.1's `G`. Refused: a green nobody earned is the defect REQ-33 was filed about, and five RT365 test files and the value page depend on `N`. Keep both, one per screen. Refused: two answers to one question is what this campaign exists to end. | C-02 |
| D-36.01 bis | 23/09 | **One first-run implementation.** The PGlite directory is resolved in one place, `env.js` (`pgliteDirFor`, pure; `resolveDataDir` creates the directory). `db.js` keeps 5.9.1's exported names (`resolvePgliteDir`, `DEFAULT_PGLITE_DIR`) as delegates, so 5.9.1's tests hold without modification. The semantics are 5.9.1's: `dataDir: null` is in-memory and wins over `PGLITE_DIR`. RT365's production start refusals are unchanged. `restart.sh` is RT365's version, which already covered lsof, fuser, ss and PowerShell. | Keep both resolvers. Refused: they already agreed on 23/09, and two copies of a rule is how they would stop agreeing. | C-02 |
| D-36.02 | 23/09 | **One gate model that holds both answers.** A project walks, in this order: its programme's ladder (RT365, `programme.gate_model`, validated by `normaliseGateModel`), else the portfolio's model (KODO, `settings.gates`), else the four of always. Any rung of either may `loopsTo` an earlier rung (MER-01) and carry a `scope` of project, programme or portfolio (MER-02); `normaliseGateModel` now validates both. Gate state is RT365's (criteria, placeholder dates, open risks) with KODO's loop filter; a scoped gate aggregates criteria too. Both representations stay: no stored row is rewritten. | Choose one representation and migrate the other into it. Refused: both are live in a field programme's book today (RT365's ladder on its PMO instance, KODO's six gates in its payload), and a migration that rewrites a field's book to fit our convergence is the cost landing on the wrong side. Portfolio model only. Refused: RT365 runs two programmes with two ladders. | C-03 |
| D-36.02 bis | 23/09 | `PGLITE_DIR=:memory:` (KODO's MER-12 spelling) is honoured by the one resolver of D-36.01 bis, beside `MERIDIAN_EPHEMERAL=1`. KODO's `pgliteStore()` is removed. | Keep KODO's resolver as a third. Refused, for the reason of D-36.01 bis. | C-03 |
| D-36.04 | 23/09 | **A book without `currencyUnit` stays refused**, exactly as KODO's MER-09 asked ("reject the import without it"), and a test pins it. The refusal now adds the one sentence an operator with an old export needs: a file exported by Meridian before 5.17.0 meant millions, so add `"currencyUnit": "millions"`. KODO is asked to add the header to its generator. | Default an absent unit to millions. Refused: it is the silent guess the requester called an S1, it would weaken a test, and the export carries no version marker that would make the guess safe. | C-03, MER-09 |
| D-36.05 | 23/09 | **C-03 converges the KODO line as built**: data, engine, import. It does not add the write routes and screens KODO's registers lack. Those are NEW-04, with REQ-52, in wave 1, and five MER lines say `partial` until then. | Build the routes inside C-03. Refused: wave 0 is convergence, and a convergence PR that also adds six CRUD surfaces cannot be reviewed as either. Mark the MER lines done because the data lands. Refused: KODO's own report says they are not. | C-03 |
| D-36.07 | 23/09 | **F13 ships strict, with the existing losses named, not fixed.** The losses are 15 collections and 38 fields (NEW-05). The gate fails on any unnamed loss and on any named loss that has been fixed, so the list only shrinks. NEW-05 becomes the first line of wave 1. | Make F13 "status 200", as the campaign's P3 probe did. Refused: it certifies an empty book, and it passed on every one of these losses. Fix NEW-05 inside C-05. Refused: rewriting the importer for 15 registers is a feature line, and the campaign keeps wave 0 to convergence. Leave F13 red until NEW-05 lands. Refused: a red main stops every other line. | C-05, NEW-05 |
| D-36.08 | 23/09 | **A branch that must not be merged is declared, not deleted.** `docs/superseded-branches.json` names it, the tip it was judged at, and the line that judged it. F14 accepts it only at that tip. Deleting the branch remains the owner's call (C-06 proposes it). | Delete the branch from this session. Refused: the owner confirms deletions (C-06). Exempt branches by name pattern. Refused: a pattern outlives the reason it was written for. | C-05, C-04 |
| D-36.09 | 23/09 | **Rows ratified by free text before REQ-49 keep their text, unmarked.** No signal or figure reads `ratified_by`. Marking would add a column, or a derived flag, that nothing reads, and rewriting the rows would invent a person. The rule changes what can be written from 5.18.3 on. | Resolve old texts to people by name match. Refused: it invents who ratified. Flag them in the API. Refused for now: no reader needs it. If a signal ever reads the ratifier, it must first separate these rows, and this decision says so. | REQ-49 |
| D-36.10 | 23/09 | **From a screen, one ratifies as oneself.** The route takes no ratifier. It records the person behind the signed-in account, and refuses an account that represents nobody. | A ratifier field, as the contract has. Refused: it is the behalf-signing the field is already working around for evidence (DF-10). The record would name one person and the act would be another's. The contract keeps its field, because an integration relays what a room decided. | REQ-50 |
| D-36.11 | 23/09 | **PR-04: each step of a change chain is signed by a different person.** Someone who signed one step cannot sign another step of the same request, and the raiser signs none. It holds for administrators too, because independence is not a level. The signer of each step is recorded from now on, and rows signed before that keep a null signer rather than an invented one. The screen says what the chain guarantees. | A single-signer "review ritual" that says so on screen. Refused: a chain whose five roles one person can sign is five labels on one decision, and the field has already paid for that shape once (DF-10, D-36.10). | PR-04 |
| D-36.12 | 23/09 | **#16 · DF-10 · MER-06: an evidence-review grant, not a role.** An access grant gains a *power*: `write` (as today) or `review`. A `review` grant on a programme or project carries `document.approve` and the reads, and nothing else: no plan, no RAID, no change, no baseline. The existing rules still apply: never one's own document, site-governed gate evidence still needs group eyes, and the audit row names the reviewer. A document may name the seat expected to approve it, so the gate shows "waiting on seat A1". Counsellor (security architect): the grant is scoped, revocable and audited, and it does not widen a viewer's reads. It is what makes FitAdapt's workaround ("the PO approves on the member's behalf") unnecessary. | A `reviewer` role. Refused: the four roles are a thesis of docs/04, and a power that exists only per scope belongs to the grant. Make council members `group`. Refused: that hands them re-baselining and change approval. | #16 |
| D-36.12 bis | 23/09 | **"The reads" of a review grant are its scope, and no further.** A viewer whose visibility is limited (a Lisbon-only viewer) reads the reviewed programme's or project's projects through the grant, because nobody can approve what they cannot open. It adds no audit trail, meetings or other scope, and a viewer who already reads the whole portfolio is not narrowed. The counsellor's "does not widen a viewer's reads" is kept in its intent: nothing is readable beyond what is to be reviewed. A review grant does not let its holder raise objections: D-36.12 says "nothing else". | Keep visibility as it was and give approval its own visibility check. Refused: a reviewer would be asked to approve evidence on a project the product will not show them. | #16 |
| D-36.13 | 23/09 | **#18 · DF-12: a site has a kind, `place` or `team`.** A team is a delivery unit with no geography: its timezone is optional, and it is left out of the Locations view, plant windows and rollout waves. It is still the unit of delegated authority, so the group/site thesis of docs/04 is untouched. The label reads "team" where the kind says so. Counsellor (PMO practitioner): a squad is governed like a site (delegated authority, its own weekly), and it is located nowhere. | Generalise `site` to "delivery unit" everywhere. Refused: plant windows and waves are the reason sites exist for the mining customer. Say "Meridian assumes places" in the README. Refused: that is a real gap, and it has a narrow fix. | #18 |
| D-36.14 | 23/09 | **#17 · DF-11 · REQ-29 · MER-11: one typed external reference.** `ext_link` (the existing link surface) gains repository sources: `issue`, `pull_request`, `commit`, `ci_run` and `artefact`. Each has a canonical `ref` (`owner/repo#123`, a commit SHA, a digest) and a cached state (open, merged, closed, passed, failed) with its time. It can be attached to a project, an activity, a RAID row or a gate criterion. Meridian stores and shows the reference, and **never fetches it or claims to have verified it**. The state is pushed in by an integration through `/api/v1` (NOTICE's promise; docs/27's four surfaces). A gate criterion that cites a commit or checksum keeps that citation: changing it after the gate is a new version, never an edit (REQ-29). | A GitHub connector that polls. Refused: it is an outbound dependency on a vendor's API, which docs/27 refused. A second evidence table. Refused: KODO's `evidence` (052) already holds the proof, and this is the link that says where the work is. | #17, REQ-29 |
| D-36.15 | 23/09 | **REQ-13 (second half): a standing human act is a RAID dependency that blocks a gate.** RT365's H-nn is a RAID `Dependency` with category "Human act", an owner and a review date (D-33.14), a `gate` it blocks, and an **evidence locator required to close it**: "an action stays until its evidence file exists". While one is open, the gate it blocks does not clear, just as an open veto holds it (MER-06). The refusal names the act and its owner. | A separate register of human acts. Refused: RT365 already syncs them as RAID rows, and a second register would split one queue in two. Informative only, never blocking. Refused: RT365's own table has a "Blocks gate" column, and a gate that clears over an open blocking act is the green nobody earned. | REQ-13 |
| D-36.16 | 23/09 | **Wave 3 is held.** `docs/23` §5 refusal 1 forbids widening before R2, and R2 is not pronounced: sponsor decisions 1–4 are open (§5). The campaign file lets a wave-3 line through only where a field is actively using it. RT365's last Meridian commit is dated 09/09, fourteen days ago, and no field register names a wave-3 line as blocking. So NEW-11, 13, 17, 21, 22 and 23 stay registered and unbuilt. NEW-19 and NEW-20 are moved to wave 1 under the campaign's own exception: a field uses the replace today (FitAdapt's `bootstrap.mjs`: "the import REPLACES the whole book, meetings included"), and both defects lose or overwrite that field's rows. | Build wave 3 because the defects are small. Refused: the refusal is about the product's breadth before its first real release, not the size of the diff. It is lifted by R2 or by a field asking, and neither has happened. | Wave 3 |
| D-36.17 | 24/09 | **Wave 3 is reshaped by the Sponsor seat.** D-36.16 held six defects under refusal 1, but that refusal covers new functions, and the owner lifted it for the FX lines. NEW-22 (a deputy's signature breaks D-36.11) and NEW-17 (a merge can leave two active tolerances) are released for building. NEW-11's SMTP half is released too (no screen may promise email before S8/S9). NEW-11 CSV, NEW-12, NEW-13, NEW-21 and NEW-23 stay held. | Keep D-36.16 whole. Refused by the Sponsor: holding correctness while shipping breadth. | Wave 3 |
| NEW-02 decision pending | 23/09 | **Gate 0 is not decided here.** KODO's own data cannot tell a document filed "for G0" from one "attached to no gate". A rule Meridian picks would be a guess about KODO's intent, so the question is put to KODO in `kodo.json` (MER-01). | Renumber G0 to G1 on import. Refused: it rewrites a field's book on a guess. | NEW-02 |
| D-36.03 | 23/09 | **C-02 is delivered as a merge of main into the RT365 line, not a commit-by-commit rebase.** The 20 commits keep their SHAs, which `docs/33` cites in about fifty places, including D-33.50 and the register's `source.commit`. The six conflicts are resolved once, in one reviewable merge commit, not up to six times across 20 replays. The line still reaches main through a pull request. | A rebase, as the campaign file says. Refused: it would invalidate every SHA the RT365 record cites, and the campaign's own rule is that a record must stay readable. | C-02 |

---

## 5 · Outside the loop — the sponsor's

These are prepared as decision packs and never marked taken on
inference. They come from `docs/23` §6, which the campaign file calls §7:

- 1–4: named accounts (S-13), real `documentHosts`, real PostgreSQL
  credential, signed RTO/RPO (G-01). These are on the critical path of
  R2, overdue since 06/09 and 13/09.
- 5–6: four policies and audit-trail retention, due 30/09.
- 7: per-country advice on time tracking.
- 8–10: SMTP and Entra third-party sheets, SMTP relay, Entra tenant, and
  the code-signing certificate (S-16).
- I18N-02b: native review of the Spanish draft.
- **The merge-and-tag permission itself.** On 23/09 this session could
  merge through the GitHub pull-request API but could not create or push
  a tag.

| Decision | Dated record that it was taken | Status |
|---|---|---|
| 1–10 | none found on 23/09; D-36.S0 on 24/09, below | see the table below |
| R2 | not pronounced (D-36.S11) | open |

**Sponsor delegation (24/09).** The owner wrote, in this session:
"i delegate all my power of sponsor to PO". From 24/09 the Product
Owner signs the sponsor's decisions, and each one below is recorded as
**"PO, by delegation of the sponsor"**. A delegation transfers the
power to *choose*. It does not create the facts some decisions are
about: real people, real domains, a secret on a real server. Those
decisions are split in two. The choice is taken here. The fact is owed
by whoever operates the instance, and the decision stays open until
that fact exists.

**Residual risk, stated once.** The sponsor and the Product Owner are
now the same seat. Decision 1 exists because independence cannot be
simulated (docs/23 §1.3). The GRC committee should therefore read every
D-36.S line as signed by the delegate, not by an independent mandator.
The owner can take any of them back by saying so.

| Id | # | Decision taken by delegation | What still has to exist | Status |
|---|--:|---|---|---|
| D-36.S0 | — | The owner's delegation is recorded verbatim above. Sponsor decisions from 24/09 are signed "PO, by delegation of the sponsor". | — | taken |
| D-36.S1 | 1 | **Rule:** nobody governs from the administration account on a real instance. Each real role (sponsor, PMO, site lead, reviewer) gets a named account tied to a person, and the demo accounts stay refused in production (`MERIDIAN_ALLOW_DEMO_ACCOUNTS` unset, docs/34). | The accounts themselves, created for real people at installation. The PO does not know who they are and does not invent them. | choice taken; **open** until the accounts exist |
| D-36.S2 | 2 | **Rule:** `documentHosts` names only the organisation's document-management (GED) domains, and nothing that is not one. | The domains. None has been given. | **open**: needs the real domain names |
| D-36.S3 | 3 | **Rule:** a unique generated password for a dedicated `meridian` role, not a superuser. It lives only in the service's environment file, never in the repository. It is rotated at every change of operator. | The password, set on the real PostgreSQL server by its operator. | choice taken; **open** until set |
| D-36.S4 | 4 | **RPO 24 h, RTO 4 h, signed.** Daily backup at 02:15 and a monthly drill (docs/34). A drill older than 45 days is an incident. No second instance: this is an accepted risk, signed here. | G-01's closing measure: one dated, timed restore drill on a machine other than production, from a backup less than 24 h old, ending on health `ok` and an identical `audit_event` count. | **taken**; G-01 closes on the drill |
| D-36.S5 | 5 | The four policies will be approved by the PO once written against `docs/security-policy-template.md`. | The four texts. Only a template with ⟨placeholders⟩ exists, and nothing unwritten can be approved. | **open** |
| D-36.S6 | 6 | **Audit trail retained 7 years**, then purged by the scheduled purge (carnet line 20). The legal basis is proposed as the organisation's duty to keep governance evidence. | Confirmation of the legal basis by counsel, together with decision 7. | finite retention **signed by the Sponsor**; the 7-year figure and the legal basis are **returned to the owner** (Sponsor seat, below) |
| D-36.S7 | 7 | No site activates individual time tracking before a written legal and social opinion for its country. This is the default already. | The per-country opinions. | **open**, by nature |
| D-36.S8 | 8 | SMTP and Entra ID are not connected before their two-page third-party sheets exist. | The sheets. | **open** |
| D-36.S9 | 9 | Follows S8. | The relay. | **open** |
| D-36.S10 | 10 | **Code-signing certificate: not bought for now.** The binary stays unsigned while it is distributed only internally, and this is accepted in writing here. Buying becomes due before the first distribution outside the organisation. Entra ID follows S8. | The tenant. | certificate **taken**; Entra open |
| D-36.S11 | R2 | **R2 is not pronounced.** Its four conditions are decisions 1–4 (docs/23 §4.1). The choices behind 1, 3 and 4 are now taken. The facts behind them (named accounts, a set password, the G-01 drill) and all of decision 2 do not exist yet. Pronouncing R2 on choices alone would be the "decision marked taken on inference" this section forbids. Wave 3 therefore stays held (D-36.16). | The four facts above. The GRC committee then pronounces "on finding, without a new session" (docs/23 §4.1). | open |

**Sponsor seat (24/09).** The owner then wrote: "create another team
member that will play the role of the sponsor with a focus on an
effective product without any legal implication". The seat is
`.claude/agents/sponsor.md`, convened with `/sponsor`. From its
creation, the Sponsor seat signs the product decisions. The PO no longer
signs its own. **Legal matters are outside that seat, and go back to the
owner.** At its first sitting (24/09), the Sponsor judged D-36.S1–S11.
The PO records each verdict as given. Where the PO disagrees, both
positions are recorded; this time there was no disagreement.

| Line | Sponsor's verdict | Condition the Sponsor set | PO |
|---|---|---|---|
| S1 named accounts | signed | real named accounts on the instance | accepts |
| S2 `documentHosts` | signed (rule) | the owner gives the real GED domains; never a public multi-tenant host | accepts |
| S3 PostgreSQL role | signed | the operator sets the password | accepts |
| S4 RPO 24 h / RTO 4 h | **reshaped** | the monthly drill restores on the same cluster (docs/34), and no second instance exists: losing the machine loses the book *and* its backups. S4 now also requires **a daily copy of the dump off the production machine**, and **the G-01 drill on another machine, timed at 4 h or less, repeated at least yearly** | accepts |
| S5 policies | **outside this seat → owner/counsel** | the approver should not be the drafter | returns it to the owner |
| S6 retention | **split** | *product, signed:* retention is finite and enforced by the scheduled purge, with the duration as a parameter. *The 7-year figure and its legal basis:* outside this seat → owner/counsel | the 7 years is withdrawn as a PO decision and returns to the owner |
| S7 time tracking per country | outside this seat → owner/counsel | the default (off) holds | returns it to the owner |
| S8 third-party sheets | outside this seat → owner/counsel | product cost: no reminders, so no support for adoption | returns it to the owner |
| S9 SMTP relay | **reshaped** | connect as soon as S8 clears; until then no screen promises email (NEW-11's SMTP half is released from the hold) | accepts |
| S10 unsigned binary | **reshaped** | not buying now is right, since no field runs the exe. But `release.yml` refuses unsigned installers, and the service runs as LocalSystem. So every internally distributed exe ships with its SHA-256 in the tagged release notes, checked at install. The certificate is bought before any second machine or any external distribution | accepts |
| S11 R2 | signed (not pronounced) | facts 1–4, then GRC | accepts |
| D-36.16 wave 3 held | **reshaped** → D-36.17 | refusal 1 (docs/23 §5) covers *new functions*, and the owner lifted it for FX. Holding defects in guarantees the product already claims reverses its purpose | accepts; see D-36.17 |

**The Sponsor's product priorities (signed 24/09).**
1. **Put 5.37.0 in the fields' hands.** The owner pushes the tags (§5,
   below). The PO turns KODO MER-12's seed → restart → sign-in into a
   test, corrects MER-01 (done: kodo.json v7), and re-runs the three
   field checks on 5.37.0. The manuals come up to 5.37.0 before any new
   user.
2. **KODO MER-03**: requirement verification on `/api/v1`, and gate
   evidence that reads requirements. KODO's words: "None of that is
   visible in Meridian."
3. **NEW-22**: a deputy's signature records whom it was for, so the
   change chain holds D-36.11's guarantee.

Held or dropped: REQ-41's session half (held); REQ-25 and REQ-26 (held
until R2: refusal 1 genuinely applies); the depth of REQ-05 and REQ-10
(dropped to docs/26); NEW-11 CSV, NEW-12, NEW-13, NEW-21, NEW-23 (held).
NEW-25 stays a standing constraint with 0.14 kB of headroom. Nothing
enforces it but a measure by hand, and that is now said here.

**The Sponsor's biggest effectiveness risk, in its words:** "Meridian
has shipped nine releases and sixteen feature lines that no field has
fetched, run or accepted: 0 of 82 lines accepted, no tag since v5.9.0.
[…] Until a tag is in the fields' hands and they re-run against it,
every 'done' is a claim, not an outcome."

**What the delegation does not change.** A delegation of sponsor power
is not a permission of this session. The session still cannot create
or push a tag. The tags below remain the owner's (or any maintainer's)
to push.

**Tags owed.** Each release below is on `main` and no tag carries it.
Every register line stays `released: false` until its tag exists
(constitution §4). The owner runs, from a clone of `main`:

| Tag | Commit on `main` | Tag | Commit on `main` |
|---|---|---|---|
| v5.9.1 | 6d8eddf | v5.20.1 | f2223cd |
| v5.16.0 | f423a00 | v5.20.2 | 2a4f249 |
| v5.17.0 | 7269fea | v5.21.0 | d82e793 |
| v5.18.0 | 3e92db5 | v5.21.1 | c92076f |
| v5.18.1 | be2df88 | v5.22.0 | 3e081c4 |
| v5.18.2 | aa5fea5 | v5.23.0 | 83c5ba7 |
| v5.18.3 | 1a597bd | v5.24.0 | 3838ea0 |
| v5.19.0 | 8d9b946 | v5.25.0 | fcadb98 |
| v5.20.0 | 11bc923 | v5.26.0 | cd372fd |
| v5.27.0 | 086f7cc | v5.28.0 | d2aef07 |
| v5.28.1 | d47e72c | v5.29.0 | 62388d5 |
| v5.30.0 | 055f8b7 | v5.31.0 | da3c38c |
| v5.32.0 | 8385530 | v5.33.0 | 8a589ed |
| v5.34.0 | 4a5288c | v5.35.0 | 8301858 |
| v5.36.0 | 0687333 | v5.36.1 | e3a2b42 |
| v5.37.0 | the squash of the 5.37.0 PR | | |

```sh
git fetch origin main
git tag -a v5.26.0 cd372fd -m "Meridian 5.26.0"   # one line per row
git push origin --tags
```


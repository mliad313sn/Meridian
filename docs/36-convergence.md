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

#### NEW-04 · KODO's registers have no write route and no screen — open, wave 1

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

#### NEW-05 · The export writes what the import erases — open, wave 1 (first)

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
| NEW-06 | The forced password change never opens: `/api/bootstrap` `me` carries no `mustChangePassword`, so an account an administrator created cannot change its password from any screen, and every write is refused. | 1 |
| NEW-07 | A merge-mode dry run of the product's own export answers 400 on a duplicate `change_step` key (MER-08). | 1 |
| NEW-08 | `GET /api/v1/signals` is live and absent from the published contract: F9 reads only `routes/v1.js` (REQ-52's blind spot, a sixth time). | 1 |
| NEW-09 | On SIGTERM the process exits before PGlite closes (`claimBook` calls `process.exit` first): `postmaster.pid` is left behind and every start clears "2 stale lock files". | 1 |
| NEW-10 | Saving a programme's gate ladder from the screen drops `loopsTo` and `scope` (D-36.02 holds in the engine and the validator, not in the form). | 1 |
| NEW-11 | Administration's notifications panel still names SMTP, and the CSV import panel is French in every language. | 3 |
| NEW-12 | `/` answers 404 when the install path contains a dot-directory (`sendFile` refuses it). | 4 |
| NEW-13 | Spanish notification strings reach nobody: `inLocale` treats any non-`fr` locale as English, and `/auth/preferences` accepts only `en` and `fr`. | 3 |

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
| 1–10 | none found on 23/09 | open |
| R2 | not pronounced | open |

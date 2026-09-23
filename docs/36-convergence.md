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

#### C-04 · Salvage the documentation branch — open

#### C-05 · F13 round trip, F14 merge debt — open

#### C-06 · Refresh the public record — open

### Waves 1–4

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

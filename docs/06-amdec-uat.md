# AMDEC / FMEA — Acceptance Review

**Method** (D-07). Every failure mode is scored on three 1–10 scales and
multiplied into a Risk Priority Number.

| Scale | 1–3 | 4–6 | 7–8 | 9–10 |
|---|---|---|---|---|
| **Severity (S)** — what it costs when it happens | cosmetic; the user works around it | a task fails; the user retries | wrong numbers reach a decision, or a person is blocked | authority bypassed, data lost, or the committee decides on false information |
| **Occurrence (O)** — how often | rare / needs a contrived path | occasional | on a normal working path | on almost every use |
| **Detection (D)** — how likely we are to *miss* it | a test or a constraint catches it every time | usually caught in review | only found by looking for it | silent; nothing reveals it |

**Acceptance gate:** no residual **RPN ≥ 100**, and no failure mode with
**S ≥ 9** left undetected (D ≥ 7). Both conditions are met — see §4.

**Review conducted:** 2026-08-28, against commit state at the close of
build. Evidence is the test suite (`npm test` — 116 at acceptance, 160 after the coordination pass), the 13-case UAT sweep
(`server/test/uat.test.js`), and a role-by-role browser walk of all 13
screens.

---

## 1 · Failure modes carried over from the v4 build

These are the findings from `02-gap-analysis.md`, scored as they stood in
the legacy artefact, and closed by the rebuild.

| ID | Failure mode | S | O | D | **RPN** | How it is closed | Residual |
|----|--------------|:-:|:-:|:-:|:------:|------------------|:--------:|
| **A-01** | **No authentication.** Anyone opening the file has full authority. | 10 | 10 | 10 | **1000** | Server-side sessions, scrypt-hashed passwords, every data route behind `requireUser()`. `auth.test.js` (10 tests). | **10** (S10·O1·D1) |
| **A-02** | **No authorisation.** Any user can re-baseline, approve changes, release contingency. | 10 | 10 | 9 | **900** | `shared/rbac.js` is the single gate; every mutating route calls it. `rbac.test.js` (25 tests) written from the attacker's side. | **20** (S10·O1·D2) |
| **A-03** | **Audit trail is decorative** — one hard-coded actor, and editable by the same import that writes the data. | 9 | 10 | 8 | **720** | Own table, `RULE … DO INSTEAD NOTHING` on UPDATE and DELETE, insert inside the mutation's transaction, actor = authenticated session. `persistence.test.js`. | **18** (S9·O1·D2) |
| **A-04** | **Single-user localStorage.** Two people cannot share a portfolio; last write wins over the whole database. | 9 | 9 | 6 | **486** | PostgreSQL as system of record; `row_version` optimistic concurrency returning 409. Verified by a two-client concurrent-write test. | **18** |
| **A-05** | **No meeting animation.** The weekly and monthly are run outside the system; decisions and actions are lost between them. | 7 | 10 | 4 | **280** | Meetings module: generated agendas, attendance, decisions, actions that carry forward, generated minutes. `meetings.test.js` (22 tests). | **14** |
| **A-06** | **No group/site governance boundary.** A site cannot be given authority without being given all of it. | 8 | 8 | 6 | **384** | `project.governance_level`; site grants confer nothing over group projects (R1.6). | **16** |
| **A-07** | **Money held as float.** Rounding accumulates across the ledger. | 7 | 6 | 8 | **336** | `numeric(16,2)` in whole currency units; a 100-line drift probe reconciles exactly. | **14** |
| **A-08** | **No referential integrity.** Deleting a person orphans allocations, silently. | 6 | 5 | 7 | **210** | Foreign keys with explicit `ON DELETE` behaviour; check constraints on every bounded field. | **12** |
| **A-09** | **Audit capped at 400 rows**, undo at 25, both truncating silently. | 8 | 6 | 8 | **384** | No cap. The trail only grows; reads are paged. | **8** |
| **A-10** | **No tests, no build, no migrations.** Change cannot be verified. | 7 | 10 | 5 | **350** | 116 tests, Vite build, ordered SQL migrations. | **14** |
| **A-11** | `props.html` writes `innerHTML` — harmless with literals, a hole once data arrives from a server. | 9 | 2 | 9 | **162** | The escape hatch is removed from the component kit. `h()` builds text nodes only. | **9** |
| **A-12** | `nextId()` derives IDs by max+1 over a local array — collides the moment two clients insert. | 6 | 7 | 6 | **252** | IDs are allocated server-side inside the inserting transaction. | **12** |

---

## 2 · Failure modes found during this review

Found by the UAT sweep and the browser walk — that is, defects introduced
or exposed by the rebuild itself.

| ID | Failure mode | S | O | D | **RPN** | Root cause | Fix | Residual |
|----|--------------|:-:|:-:|:-:|:------:|-----------|-----|:--------:|
| **B-01** | **Changing a project's dates hangs the request forever.** Not an error — a hang. The connection never returns. | 9 | 9 | 7 | **567** | `loadSettings()` was called *inside* the transaction. PGlite is one connection behind a serialising queue: the query waits for the queue, the queue waits for the transaction. Deadlock. | Value read before the transaction opens. **And** a guard added in `db.js` so any future in-transaction module-level call throws a named error instead of hanging — a wrong failure mode turned into a loud one. | **9** (S9·O1·D1) |
| **B-02** | **A bad foreign key answers `500 Something went wrong`.** The user cannot tell what they did wrong; the engineer cannot tell either. | 5 | 7 | 5 | **175** | Constraint violations fell through to the generic fault handler. | `server/src/pgerror.js` translates every constraint class into a 400 or 409 naming the rule that refused it. | **10** |
| **B-03** | **Write controls shown on projects the account cannot write.** A São Paulo lead was offered *Edit project*, *Set status*, *Advance phase* on a group programme. The server refused — so no breach — but the interface invited an action it would reject. Direct violation of R7.3. | 4 | 9 | 3 | **108** | The ported views drew their controls unconditionally, as the single-user build could. | Every write control is behind `mayWrite(p)` / `may(action, p)`, and the read-only case *says why* rather than leaving a bare toolbar. **Corrected at the coordination pass:** this closure was overstated — ten controls were still unguarded, because the fix was applied by hand to the ones the review had looked at. See X-03. The residual below is the score after that correction and the gate that now enforces it. | **10** |
| **B-04** | **The Schedule and Administration screens failed to render.** `ZOOM is not defined`; `db.audit` undefined. | 6 | 10 | 2 | **120** | Extraction from the single file split two section-header comments, dropping a constant with them; and the audit trail no longer travels inside the book. | `ZOOM` restored; the audit panel now reads `GET /api/audit` on demand, and degrades to an explanation for accounts below group level. | **6** |
| **B-05** | **A deploy left browsers on a bundle that no longer existed.** `index.html` was being cached. | 5 | 8 | 4 | **160** | `express.static` default caching applied to the entry document. | Hashed assets cached hard; `index.html` `no-cache`. | **8** |
| **B-06** | **A hard kill corrupts the development database.** `Stop-Process -Force` mid-write left the PGlite datadir unopenable. | 6 | 4 | 5 | **120** | WASM Postgres does not complete crash recovery the way a server does. | `scripts/restart.sh` stops the process gracefully; stale lock files from an earlier unclean stop are cleared on start with a log line. Production runs against a real cluster via `DATABASE_URL`, where this does not arise. | **12** |
| **B-07** | **The weekly agenda listed 15 decisions in a five-minute box.** A4's objection made real: automated waste. | 4 | 8 | 3 | **96** | The decision section was uncapped for both cadences. | A weekly takes the six most pressing and states how many it deferred; the monthly takes twenty. | **8** |
| **B-08** | **"Next up" listed a milestone that was already in the past** relative to the meeting date. | 3 | 7 | 4 | **84** | The horizon was computed from the portfolio status date, not from the date the meeting actually sits. | `Engine.horizon` takes an `asOf`. | **6** |
| **B-09** | **Dates crossed the API as timestamps, not dates.** `2026-08-31T00:00:00.000Z` where `2026-08-31` was meant. | 7 | 10 | 6 | **420** | Both drivers decode `date` columns into JS `Date` objects; serialising re-introduces a time and, west of UTC, a day. | Normalised once in `db.js` using the column type metadata both drivers return. A UAT case asserts every date field matches `^\d{4}-\d{2}-\d{2}$`. | **14** |
| **B-10** | **An out-of-scope project answered 403 on write and 404 on read** — the difference confirms the project exists. | 5 | 6 | 7 | **210** | Visibility was checked by the authority gate, which reports *why* it refused. | Resolution and visibility are checked together: out of scope is 404, indistinguishable from absent. | **10** |

---

## 3 · Failure modes accepted without further work

Scored, considered, and left — with the reason, so the next reviewer does
not have to rediscover the argument.

| ID | Failure mode | S | O | D | **RPN** | Decision |
|----|--------------|:-:|:-:|:-:|:------:|----------|
| **C-01** | The whole book is re-fetched after every write. At 12 projects this is imperceptible; at 500 it will not be. | 3 | 10 | 2 | **60** | **Accepted for now.** The correctness argument — the screen can only show a state the server agreed to — is worth more at this scale than the round trip. Revisit at ~100 projects with per-entity responses. |
| **C-02** | The client re-renders the whole view on every state change. | 2 | 10 | 2 | **40** | **Accepted.** Same threshold as C-01, same seam to fix it in (`App.on`). |
| **C-03** | A site-level account can see every *programme* meeting series, not only those with projects in its sites. | 2 | 5 | 5 | **50** | **Accepted.** Reading a programme's cadence is portfolio information, not a confidence. Writing is already refused. |
| **C-04** | Passwords are seeded in `server/src/seed.js` and listed in the README. | 8 | 2 | 1 | **16** | **Accepted for a demonstration instance,** and stated plainly in the README: change them before the system carries anything real. The seed exists so the system is usable on first run; a first-login password change is the production answer and is noted as such. |
| **C-05** | `.npmrc` disables strict TLS for the package registry. | 5 | 3 | 2 | **30** | **Accepted with the reason recorded in the file itself.** A Cisco Umbrella inspection proxy re-signs registry traffic and its root CA is absent from the Windows store; without this an install takes hours. Remove the line once the CA is installed. Not a property of the running system. |
| **C-06** | No rate limiting on `POST /auth/login`. | 6 | 3 | 5 | **90** | **Accepted at this deployment scale**, on the record. scrypt at N=16384 already costs an attacker ~150 ms per attempt, and the failure path is constant-time. A reverse proxy is the right place for the limit; if this is ever exposed beyond the corporate network, it becomes a MUST. |

---

## 4 · Acceptance

| Gate condition | Result |
|---|---|
| Every **MUST** in the register implemented and traced to a test | **Met** — 38/38. See §6. |
| No residual **RPN ≥ 100** | **Met** — highest residual is **20** (A-02). |
| No **S ≥ 9** failure mode left undetected (D ≥ 7) | **Met** — every S ≥ 9 mode scores D ≤ 2. |
| Migration runs cleanly from empty to seeded portfolio | **Met** — `migrate.test.js`; re-running applies nothing. |
| Legacy JSON export imports without loss | **Met** — `server/src/import.js`, admin-only, audited. |
| **B2 (Security) sign-off:** no privileged action reachable without a server-side check | **Met** — 25 authorisation tests, written to try to get past the gate rather than through it. |

**Test evidence at acceptance:** 116 tests, 24 suites, 0 failures.
(Superseded at the coordination pass — see §5.)
Client build: clean. All 13 screens render for all 4 roles.

### What the committee should know before it signs

Three things are true and worth saying rather than burying:

1. **C-01 and C-02 are real and will bite at scale.** The system is
   correct at portfolio scale and will feel slow well before it breaks.
   The seam to fix them is already isolated.
2. **C-06 (no login rate limit) is a genuine gap** for anything
   internet-facing. It is accepted for an internal deployment and should
   be closed at the proxy before that changes.
3. **The dev database engine is not the production one.** PGlite is real
   PostgreSQL 16.4 and runs the identical SQL, but it does not survive an
   unclean kill the way a server does (B-06). Production must set
   `DATABASE_URL`.

---

## 5 · Cross-committee failure modes (coordination pass)

Scored after the four committees had each closed their own findings.
These are the modes that live in the seam between two reviews, so no
single committee could have seen them. Full write-up:
`10-coordination-register.md`.

| ID | Failure mode | S | O | D | **RPN** | How it is closed | Residual |
|----|--------------|:-:|:-:|:-:|:------:|------------------|:--------:|
| **X-01** | **A concurrency check that cannot fail, on thirteen of fifteen write paths.** `version ?? row.row_version` asserts the value the request just read. Two people editing the same project both succeed and the second silently overwrites the first. | 8 | 6 | 9 | **432** | `requiredVersion()` moved into `db.js` and applied to all fifteen; a versionless edit is refused with 428. Pinned by a `backend.test.js` case that walks every path, plus a companion proving a well-formed edit still succeeds. Gated by `version-audit.mjs`. | **16** (S8·O1·D2) |
| **X-02** | **The client reported 428 as a dead end.** The remedy — re-read and retry — existed for 409 and not for the new code, so a user who hit it could only keep failing. | 4 | 6 | 5 | **120** | `ApiError.isStale` covers 409 and 428; `App.write()` refreshes on either. | **8** (S4·O1·D2) |
| **X-03** | **Ten write controls drawn without asking authority.** Approve/Reject on any visible change request, five section-head create buttons, the document row, cost booking, assignment editing, the report narrative, grant revocation. Every one was refused server-side, so no data was at risk — but a viewer was repeatedly invited to act and repeatedly told no. | 5 | 8 | 7 | **280** | Each now asks the same question the server will ask, through `shared/rbac.js`. Create buttons delegate to `HEADER_ACTIONS` via `primaryAction()` rather than restating the rule. | **10** (S5·O1·D2) |
| **X-04** | **A deep link lost to the header filter.** Following a link to a specific change request landed on whichever one was first in the reader's current scope, with the URL still naming the other. | 4 | 5 | 6 | **120** | An explicit link beats the filter. | **8** (S4·O1·D2) |
| **X-05** | **A rule agreed by three committees and enforced by hand.** The meta-mode behind X-01 and X-03: agreement produced no enforcement, so each new control had to remember the rule. | 6 | 7 | 8 | **336** | Two new gates — `version-audit.mjs` and `control-audit.mjs` — both in `npm run audit`, with the control gate also run from `npm test` so it cannot be skipped. Exemptions require a written justification in the script. | **12** (S6·O1·D2) |

**Detection is the number that moved.** Every one of these scored D ≥ 5
before the pass: they were invisible to the tests, because the tests
asserted what the software does rather than what it must never do. What
lowers D is not another test of the same kind — it is a gate that fails
on the *class* of defect.

### Acceptance, re-checked

| Gate condition | Result |
|---|---|
| No residual **RPN ≥ 100** | **Met** — highest residual across all five series is **20** (A-02); highest in this series is **16** (X-01). |
| No **S ≥ 9** mode left undetected | **Met** — no mode in this series scores S ≥ 9; the server refused all ten X-03 controls. |
| Every fix exercised as a user, not only as a test | **Met** — all four roles walked through all 13 screens after the change; both directions checked, so a group lead keeps what they should keep. |
| Structural gates green | **Met** — 0 orphan routes, 0 unexplained CRUD gaps, 0 unversioned write paths, 0 unguarded controls. |

**Test evidence at coordination close:** 160 tests, 38 suites, 0
failures. Client build clean. `npm run audit` exits 0 on all four gates.

---
## 6 · Requirement trace

| Group | MUST | Implemented | Traced to |
|---|:---:|:---:|---|
| R1 · Identity & access | 9 | 9 | `auth.test.js`, `rbac.test.js` |
| R2 · Persistence & platform | 6 | 6 | `persistence.test.js`, `migrate` |
| R3 · Portfolio engine | 7 | 7 | `engine.test.js` (27 cases) |
| R4 · Group & site model | 3 | 3 | `rbac.test.js`, `uat.test.js` |
| R5 · Meeting animation | 9 | 9 | `meetings.test.js` (22 cases) |
| R6 · Audit | 2 | 2 | `persistence.test.js` |
| R7 · Usability | 2 | 2 | browser walk, `uat.test.js` |
| **Total MUST** | **38** | **38** | |

SHOULD requirements: 10 of 10 implemented. R5.10 (live "run the meeting"
mode) and R7.2/R7.5 (keyboard reachability) are verified by the browser
walk rather than by an automated test — recorded here as a known limit of
the evidence, not as a gap in the build.

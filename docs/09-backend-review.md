# Backend Review — data integrity and access paths

A fourth committee, 2026-08-28: does the backend actually support the
front end and the database it sits between, or does it merely appear to?

The distinction matters because three of the five findings below were
**invisible in every test that passed** — the development engine was
hiding them.

---

## 1 · The committee

| # | Member | Standing | What they came to check |
|---|--------|----------|-------------------------|
| **K1** | **Principal engineer, platform** (chair) | on-call for the group's transactional systems | "Show me what happens under concurrency, not what happens once." |
| **K2** | **Database administrator** | owns the cluster | "Which query is going to melt this, and which index is missing." |
| **B2** | **W. Chen** — Security architect *(carried over)* | CISSP | Injection surface, secret handling. |
| **A5** | **V. Rossi** — Finance *(carried over)* | owns the ledger | "If two people post at once, is the total still right?" |
| **B4** | **U. Sharma** — Release manager *(carried over)* | owns environments | "Does dev behave like production?" |

> **B4, opening:** "You have been testing against PostgreSQL compiled to
> WebAssembly, on a single connection. Production is a pooled cluster.
> Those are not the same machine, and the difference is exactly where
> concurrency bugs live."

That turned out to be the review's central finding.

---

## 2 · Method

Findings were located mechanically, then reproduced before being fixed.

| Probe | What it does |
|---|---|
| **Injection sweep** | Every `${…}` reaching a SQL string, triaged for whether the value is server-controlled |
| **N+1 sweep** | Every `await` inside a loop, ranked by whether it sits on a request path |
| **FK index audit** | `pg_constraint` ⋈ `pg_index` — every FK column with no leading index |
| **Concurrency audit** | Every table that is UPDATEd, checked for `row_version` |
| **`server/test/concurrency.probe.mjs`** | Fires simultaneous writes and reports what actually happened |

---

## 3 · Findings

| # | Sev | Finding | How it was found | Closed by |
|---|-----|---------|------------------|-----------|
| **1** | **P0** | **Identifiers were allocated by `MAX(id) + 1`.** Ten call sites read the current maximum, computed the next value, then inserted. Behind a connection pool two requests read the same maximum and the loser gets a primary-key violation — surfaced to the user as a confusing 409 on an unrelated-looking action. | Reproduced deterministically: two readers of the same table both allocate `RSK-45`. The live probe **passed**, because PGlite serialises through one connection — the engine was hiding the bug, not the bug being absent. | An `id_counter` table and `allocateId()`: a single `UPDATE … RETURNING` inside the writing transaction, which takes a row lock so concurrent allocations queue instead of colliding. Identical behaviour on PGlite and on a pooled cluster. |
| **2** | **P0** | **Lost update on every reference table.** `person`, `site`, `programme` and `board_column` had no `row_version`, and were written with a direct `UPDATE`. Two administrators editing the same person both got a `200` and one edit vanished. | Probe 3: reproduced on the first run. | `row_version` added to all four (migration 004); every edit back through `updateVersioned()`. |
| **3** | **P0** | **The concurrency check was unfailable where it did exist.** `Number(body.version ?? row.row_version)` falls back to the value *the request itself just read*, so the assertion can never fail. It looks like a check and is not one — worse than no check, because it stops anyone looking. | Reading the fix for #2 and noticing it would not have worked. | Form edits must name the version they are based on; a request that does not is refused with **428 Precondition Required** rather than quietly winning. |
| **4** | **P1** | **Thirty-two foreign-key columns had no index.** PostgreSQL does not create them. `cross_dep.from_project`/`to_project` are filtered on every schedule load; `person` is referenced from eleven places and deactivating one — now a routine act — touched every one of them. | `pg_constraint` ⋈ `pg_index`. | **Sixteen** indexes, not thirty-two: the ones with a query predicate behind them or a realistic cascade. An index is not free, and blanket-indexing every FK is its own defect. |
| **5** | **P1** | **A statement per row on two request paths.** Creating a project wrote ~25 separate statements (activities, dependency links, gates, evidence, allocation). Closing a monthly meeting wrote one `INSERT` per agenda item — forty-odd, with the transaction open, while a room waits for the button. | N+1 sweep, ranked by request path. | `insertMany()` — one multi-row statement per table. Project creation is now five statements; the agenda freeze is one. |
| **6** | **P2** | **Six sites built SQL by interpolating an identifier.** None was injectable — every value is a server-side literal — but each is one careless refactor from being so. | Injection sweep, then triaged individually. | `assertIdentifiers()` on every path that interpolates a table or column name. A request key reaching it now throws a named error instead of quietly becoming an injection. |
| **7** | **P2** | **The connection pool had no bounds.** Every timeout defaulted to "wait forever", which is how one slow query becomes an outage: the pool fills with connections nobody will get an answer from and everything queues behind them. | Reading `openPg`. | `statement_timeout` 15s, `idle_in_transaction_session_timeout` 30s, `connectionTimeoutMillis` 5s, `idleTimeoutMillis` 30s, plus a pool `error` handler so a backend dying while idle does not take the process with it. |

### The regression the fixes caused, and what it taught

Migration 004 seeds the identifier counters from the tables as they stand
**when the migration runs** — which on a fresh database is nothing. The
seed then inserted `DOC-101`, `ACT-001` and the rest without advancing
the counters, so the first allocation after a seed collided with a seeded
row. Eight tests went red.

That is the correct behaviour for the test suite to have. The fix is that
whoever writes rows owns advancing the counters past them: both `seed.js`
and `import.js` now reconcile them, and a test asserts the counter is
never behind the highest row.

---

## 4 · What is now pinned

`server/test/backend.test.js` — 13 cases that fail if any of the above
regresses:

- twenty consecutive allocations in one prefix never collide;
- the counter is never behind the highest row any seed or import wrote;
- a failed request does not burn an identifier;
- every table an edit form writes to carries `row_version`;
- a form edit with no version is refused with 428, not accepted;
- the second of two writers on the same read gets 409, and the first
  write survives intact;
- the nine hot foreign keys have a leading index;
- an identifier that is not a plain column name is refused, including
  through `updateVersioned`;
- a multi-row insert stores `'); DROP TABLE project; --` verbatim and the
  table is still there;
- project creation and the agenda freeze use `insertMany`, not a loop.

**157 tests, 37 suites, 0 failures.** `npm run verify` (tests + build +
fitness audit) exits 0.

---

## 5 · Accepted, with reasons

| Finding | Decision |
|---|---|
| **`GET /bootstrap` returns the whole book, and every write re-reads it.** | **Accepted at this scale**, and already recorded as AMDEC C-01. Correct — the screen can only show a state the server agreed to — and imperceptible at twelve projects. The seam to fix it (per-entity responses) is isolated in `App.write`. Revisit near a hundred projects. |
| **No caching or ETag on `/bootstrap`.** | **Accepted.** It is per-user scoped and changes on every write; a cache would mostly miss. Worth revisiting together with C-01, not before. |
| **PGlite serialises everything through one connection.** | **Accepted for development, stated loudly.** It is real PostgreSQL 16.4 running the identical SQL, but it is not a pooled cluster, and this review is the evidence that the difference matters. Production must set `DATABASE_URL`. |
| **No read replica, no partitioning, no queue.** | **Accepted.** A twelve-project portfolio with a few hundred users does not need any of it, and each would add a failure mode. Simple scales; clever breaks. |
| **`audit_event` grows without bound.** | **Accepted deliberately** — R6.1 requires it, and the v4 build's 400-row cap was a defect, not a feature. Archival is an operations decision for when the table is large enough to warrant one, not a code change. |

---

## 6 · Still open

- **`cost_line` has no `row_version`** and does not need one — it is
  append-only and corrected by a reversing entry. Recorded here so the
  next reviewer does not read it as an oversight.
- **No load test.** Everything above is reasoned from structure and
  reproduced under two-writer concurrency. Nobody has run this at a
  hundred concurrent users, and the honest position is that the
  bottleneck is predicted (`/bootstrap`) rather than measured.
- **`statement_timeout` is a guess at 15 seconds.** It should be set from
  observed latency once there is any, not from a round number.

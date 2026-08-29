# Requirements Register

`MUST` = acceptance-blocking · `SHOULD` = expected · `MAY` = accepted if cheap.
**Raised by** references the committee member in `00-committee-charter.md`.
**Trace** names the automated test that proves it.

## R1 — Identity & access control

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R1.1 | MUST | Every request is authenticated. Unauthenticated access to any data route returns 401. | B2 | `auth.test.js` |
| R1.2 | MUST | Four roles: `admin`, `group`, `site`, `viewer`. | B1 | `rbac.test.js` |
| R1.3 | MUST | `group` grants name specific programmes; `site` grants name specific sites. A grant list is never implicitly "all". | A2, C1 | `rbac.test.js` |
| R1.4 | MUST | Authorisation is enforced server-side on every mutating route. Hiding a button is not enforcement. | B2 | `rbac.test.js` |
| R1.5 | MUST | `viewer` can read everything in scope and write nothing — including no comments, no status, no narrative. | B1 | `rbac.test.js` |
| R1.6 | MUST | A `site` grant confers no authority over a project whose `governance_level = 'group'`, even when that project's site matches the grant. | A2 | `rbac.test.js` |
| R1.7 | MUST | Passwords are stored as salted scrypt hashes; never reversible, never logged. | B2 | `auth.test.js` |
| R1.8 | MUST | Sessions expire; logout invalidates server-side. | B2 | `auth.test.js` |
| R1.9 | SHOULD | Only `admin` may create users or change role grants. | B2 | `rbac.test.js` |
| R1.10 | MUST | Reads are scoped too: a site user listing projects sees only projects in their sites plus group projects (read-only). | C1 | `rbac.test.js` |

## R2 — Persistence & platform

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R2.1 | MUST | PostgreSQL is the system of record. No business data in browser storage. | B3, A5 | `db.test.js` |
| R2.2 | MUST | Schema is created and evolved by ordered, idempotent SQL migrations. | B4 | `migrate.test.js` |
| R2.3 | MUST | Client and server are separate deployables communicating over HTTP/JSON. | B3 | build |
| R2.4 | MUST | Money is stored as exact numeric, never float. | A5 | `db.test.js` |
| R2.5 | MUST | Concurrent writes to the same record do not silently overwrite — optimistic concurrency via row version. | A5 | `concurrency.test.js` |
| R2.6 | SHOULD | The legacy JSON export imports without loss of any project, activity, ledger line, RAID item or CR. | B4 | `import.test.js` |
| R2.7 | MUST | Referential integrity is enforced by the database, not by hope. | B3 | `db.test.js` |

## R3 — Portfolio engine (carried over, behaviour-frozen)

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R3.1 | MUST | PV/EV/AC, SPI, CPI, SV, CV, EAC, VAC, TCPI computed exactly as the legacy engine. | A5 | `engine.test.js` |
| R3.2 | MUST | The "too early to measure" guard (PV < 2% BAC or AC < 0.5% BAC ⇒ indices report 1.00) is preserved. | A5 | `engine.test.js` |
| R3.3 | MUST | Critical path by forward/backward pass over finish-start links; float ≤ 0 is critical. | A2 | `engine.test.js` |
| R3.4 | MUST | RAG derives from SPI/CPI against configured thresholds, overridable by the PM with a recorded reason. | A1 | `engine.test.js` |
| R3.5 | MUST | Gate progression blocked while gate evidence is unapproved, when `gate_lock` is on. | A1 | `gates.test.js` |
| R3.6 | MUST | RAID exposure = probability × impact; escalation bands at the configured PMO and steering thresholds. | A1 | `engine.test.js` |
| R3.7 | MUST | Portfolio roll-up takes the worse of aggregate and spread — two red projects cannot average into green. | A1 | `engine.test.js` |

## R4 — Group & site operating model

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R4.1 | MUST | Every project declares `governance_level ∈ {group, site}`. | B1 | `db.test.js` |
| R4.2 | MUST | Group-level projects roll up across all sites; site-level projects roll up within their site and appear read-only at group. | A2 | `rbac.test.js` |
| R4.3 | MUST | A site administrator may create, edit and close site-level projects in their sites without group involvement. | C1 | `rbac.test.js` |
| R4.4 | SHOULD | Users land on the scope they own: site users default to their site's portfolio. | A3 | manual/UAT |
| R4.5 | SHOULD | Change requests above the CCB threshold on a group project route to the group change authority regardless of originating site. | A2 | `change.test.js` |

## R5 — Meeting animation *(new module — D-04)*

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R5.1 | MUST | Meeting series with cadence `weekly` or `monthly`, each with a scope (group, programme or site). | C3 | `meetings.test.js` |
| R5.2 | MUST | An occurrence's agenda is **generated from live portfolio state** — red/amber movers, milestones due, decisions pending, overdue actions, breached dependencies — not typed by hand. | C3, A1 | `meetings.test.js` |
| R5.3 | MUST | The weekly agenda is time-boxed and ordered by exception. Items with nothing to say are omitted, not shown empty. | A4 | `meetings.test.js` |
| R5.4 | MUST | Attendance is recorded per occurrence (present / apologies / absent). | C3 | `meetings.test.js` |
| R5.5 | MUST | Decisions are recorded against the occurrence, are immutable once the meeting is closed, and are searchable thereafter. | C3 | `meetings.test.js` |
| R5.6 | MUST | Actions carry owner, due date and status; open actions from prior occurrences appear at the top of the next agenda until closed. | C3 | `meetings.test.js` |
| R5.7 | MUST | Minutes are generated from the occurrence and exportable as Markdown. | C3 | `meetings.test.js` |
| R5.8 | MUST | Closing an occurrence freezes its agenda, decisions and attendance; later portfolio changes do not rewrite history. | A1, B2 | `meetings.test.js` |
| R5.9 | SHOULD | The monthly steering pack adds financial position, gate decisions due, and benefit tracking; the weekly does not. | A1 | `meetings.test.js` |
| R5.10 | SHOULD | A live "run the meeting" mode walks the agenda item by item, capturing decisions and actions in place. | C3 | manual/UAT |
| R5.11 | MUST | Only users with write authority in the meeting's scope may record decisions or close the meeting. | B2 | `meetings.test.js` |

## R6 — Audit & traceability

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R6.1 | MUST | Append-only audit row for every mutation: who, when, what entity, what changed. | B2 | `audit.test.js` |
| R6.2 | MUST | Audit rows cannot be updated or deleted through the application. | B2 | `audit.test.js` |
| R6.3 | SHOULD | Audit is filterable by user, entity and date range. | A1 | `audit.test.js` |

## R7 — Usability (end-user bench)

| ID | Pri | Requirement | Raised | Trace |
|----|-----|-------------|--------|-------|
| R7.1 | MUST | The Archivo/flat/single-accent design system is preserved verbatim. | A1, C2 | visual/UAT |
| R7.2 | SHOULD | Any project reachable in ≤ 2 clicks from landing; command palette on `⌘K`/`Ctrl-K`. | C2 | manual/UAT |
| R7.3 | SHOULD | Read-only users see no disabled write controls — the controls are absent, not greyed. | C2 | `scripts/audit/control-audit.mjs`, run from `npm run audit` and from `operations.test.js` |
| R7.4 | MUST | Every destructive action is confirmed and undoable, or confirmed and audited. | A3 | manual/UAT |
| R7.5 | SHOULD | Keyboard-reachable navigation; visible focus ring. | C2 | manual/UAT |

---

**Totals:** 48 requirements — 38 MUST, 10 SHOULD.

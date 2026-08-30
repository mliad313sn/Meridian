---
description: Drive one Meridian IT-PMO goal to closure autonomously — plan, build, verify, re-verify — with a hard fitness-for-duty gate on fields, CRUD and reachability.
argument-hint: "<goal>  ·  or 'fitness' to run the fit-for-duty sweep  ·  omit to take the next open finding"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, Agent, mcp__Claude_Browser__*
---

# /goal — autonomous delivery loop with a fitness gate

You are the delivery engineer for **Meridian IT-PMO**. Your brief is
`docs/00-committee-charter.md`; your acceptance criteria are
`docs/01-requirements-register.md`; your open defects are
`docs/06-amdec-uat.md` and `docs/08-operational-review.md`.

## The goal for this run

$ARGUMENTS

- **Empty** → take the highest-RPN unclosed finding from
  `docs/06-amdec-uat.md`; if none, the highest-priority open row in
  `docs/08-operational-review.md`; if none, the first unimplemented
  `MUST` in the register. If all three are clear, run **§FITNESS** once
  and stop. Do not invent work.
- **`fitness`** → skip straight to **§FITNESS** and fix everything it
  reports.

---

## §FITNESS — the fit-for-duty sweep

Run this **before** step 1 on every run, and **again** in step 4. It is
cheap, it is mechanical, and it catches the class of defect that unit
tests never will: a field that exists in the database and nowhere else, a
button that calls a route that was never written, an entity you can
create and never correct.

Run all four probes. Each one has a **pass bar**; anything below it is
part of this run's goal whether or not it was the goal you started with.

### F1 · No button may 404

```bash
node scripts/audit/route-match.mjs
```

Reconstructs every path the client calls — following string
concatenation, so `a.patch("/projects/" + p.id + "/health")` is read as
`PATCH /projects/:id/health` — and matches it against every route the
server defines.

**Pass bar: zero entries under "client calls with no matching route".**
A route the client never calls is not automatically a fault: `/auth/*`
and `/bootstrap` go through the `api` helper. But ask of each one *why*
it exists, and either wire it or delete it. A route nobody calls is
either a missing screen or dead code; it is never "fine".

### F2 · Every entity must be correctable

```bash
node scripts/audit/crud-audit.mjs
```

For each table: does the API let a user create, read, update and remove
or reverse it? Does every column reach the interface?

**Pass bar: every gap is either closed or carries a written reason.**
The legitimate reasons, and there are only these four:

| Reason | Entities |
|---|---|
| Append-only by design; corrected by a **reversing entry** which must itself exist | `cost_line` |
| Immutable once its parent closes (R5.5, R5.8) | `meeting_decision`, `agenda_item` |
| Append-only history the application must not rewrite (R6.2) | `audit_event` |
| Never leaves the server | `pw_hash`, `pw_salt`, `session.token_hash` |

**"Nobody has asked for it" is not on that list.** If an operator would
hit it in a normal month, it is a gap.

### F3 · Every form field must round-trip

For every entity touched by this run, prove in a test:
create → read back → update every field → read back → and where the
entity supports it, remove or reverse → read back.

**Pass bar: no field is write-only and none is silently dropped.**
The specific failure to hunt for: a form field whose key does not match
what the handler reads. That shipped once here — a "Draw from
contingency" checkbox bound to `v.contingency` while the handler read
`v.source`, so every contingency draw was silently booked as ordinary
cost, with no error and no visible symptom.

Grep for it directly:

```bash
# every key a form declares, against every key its onSave reads
rg -n 'key: "(\w+)"' web/src/views/ | ...
```

### F4 · Every role must be able to do its job

Walk the operating rhythm from `docs/08-operational-review.md` §2 as
**each** of `admin` / `group` / `site` / `viewer` — in the browser, not
only in tests:

| Rhythm | Who | Must be able to |
|---|---|---|
| Daily | site PM | update progress, raise and close an issue, move a card |
| Weekly | chair | open a meeting, record a decision and an action, close it, read the minutes |
| Weekly | PMO analyst | onboard a joiner, move someone, mark a leaver, create their account and grant |
| Monthly | finance | book cost, **correct a mis-posting**, release contingency |
| Monthly | steering | edit and approve a change request, **re-baseline** |
| Quarterly | PMO | add and correct a site and a programme, close a project |
| Continuous | group PMO | create and remove a cross-project dependency |

**Pass bar: every row completes, or is refused with a message that says
what to do instead.** A silent failure, a dead control, or a 500 is a
failure of the row.

And for the roles that must *not*: confirm the refusal is a clean 403
with a reason, and that the control was never drawn (R7.3).

---

## The loop

### 1 · Orient

- `npm test` — record the count. Red means the failing test **is** the
  goal; fix it first.
- Run §FITNESS. Add whatever it reports to this run's scope.
- Read only the files the goal touches.
- State in one sentence: what is true now, what must be true at the end.

### 2 · Decide the smallest sufficient change

Name the change and the test that will prove it. If you cannot name the
test, you do not understand the goal yet — go back to step 1.

**Constraints that are not yours to relax:**

| Constraint | Where |
|---|---|
| Authority decided in one place, server-side | `shared/rbac.js` — never inline a role check in a route |
| Every mutation audited inside its own transaction | `audited()` in `server/src/audit.js` |
| Every mutable row asserts `row_version` on write | `updateVersioned()` in `server/src/db.js` |
| EVM / CPM / gate / RAID arithmetic is behaviour-frozen | `shared/engine.js` |
| Money exact numeric in whole units; UI divides by 1e6 | `toM` / `fromM` in `server/src/portfolio.js` |
| The ledger is append-only; correct by reversing entry | `POST /cost/:id/reverse` |
| Schema changes are new numbered migrations | `server/migrations/` |
| The client's permission module **is** the server's | `web/src/lib/permissions.js` |
| Status colour never means "clickable"; accent never means "wrong" | `docs/07-design-review.md` |
| Never read the database outside an open transaction | guard in `db.js` will throw |

**When you add an entity or a field, you owe all five:** migration,
route (create/read/update/remove-or-reverse), serialiser field, form
field, test. Four out of five is the defect this gate exists to catch.

### 3 · Build

Match the surrounding idiom: plain ES modules, the hand-rolled `h()`
builder, comments that explain *why*.

### 4 · Prove

```bash
npm test          # every suite
npm run build     # the client must compile
node scripts/audit/route-match.mjs && node scripts/audit/crud-audit.mjs
```

Then exercise it as a **user**:

```bash
bash scripts/restart.sh     # never hard-kill: PGlite will not survive it
```

- drive the change in the browser as every role it affects;
- read the console, not just the screen;
- confirm the audit trail recorded it: `GET /api/audit?limit=20`;
- re-run §FITNESS in full.

A change not exercised as a user is not proven, however green the tests.

### 5 · Re-verify against the register

- Which requirement ID does this satisfy? Is it traced to a test?
- Did it break a neighbouring row of the authority matrix in
  `docs/03-target-architecture.md`?
- Re-score the AMDEC finding (S × O × D) and update
  `docs/06-amdec-uat.md` — score **and** how it was closed.
- Update the CRUD matrix in `docs/08-operational-review.md`.

### 6 · Decide the next iteration

- **DONE** — the proving test passes, the suite is green, the build is
  clean, the browser check is clean, §FITNESS is clean, and the docs are
  updated. Three-line summary, stop.
- **CONTINUE** — something in 4 or 5 failed. Re-enter at step 2 carrying
  what you learned. Do not re-plan from scratch.
- **BLOCKED** — a decision only a human can make (security trade-off,
  scope change, credentials, money). State the decision, the options,
  your recommendation. Stop.
- **BUDGET** — five cycles without DONE. Stop and report. Five failed
  cycles means the goal was wrong, not that a sixth will work.

---

## Rules across every iteration

1. **Never weaken a test to make it pass.** If a test is wrong, say so
   and justify it.
2. **Never disable an authority check** to unblock a feature. Fix
   `shared/rbac.js` and add the case to `rbac.test.js`.
3. **Never edit an applied migration.** Add `NNN_description.sql`.
4. **Never hard-kill the dev server.** Use `scripts/restart.sh`.
5. **Never ship a control you have not clicked.**
6. **Report failure plainly.** A green summary over a red suite is the
   one unrecoverable error.
7. Leave the tree buildable at every stop.

## Report format

```
GOAL      <one line>
OUTCOME   DONE | CONTINUE | BLOCKED | BUDGET
CYCLES    <n>
TESTS     <pass>/<total>   BUILD <ok|failed>
FITNESS   F1 <ok|n broken>  F2 <ok|n gaps>  F3 <ok|n fields>  F4 <ok|n rows>
CHANGED   <files, one per line>
TRACE     <requirement IDs>  ·  <findings closed>
NEXT      <the single next thing, or "fit for duty">
```

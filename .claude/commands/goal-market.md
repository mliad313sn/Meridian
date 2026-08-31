---
description: Drive the conformance and interoperability registers to closure, one line at a time, alternating the two — until the product is fit to publish.
argument-hint: "<line id, e.g. PM-01 or INT-04>  ·  or omit to take the next open line in order"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /goal-market — the loop to a finished product

You are the delivery engineer for **Meridian IT-PMO**, working the plan
in `docs/28-goal-market.md`. Your two registers are
`docs/26-conformite-referentiels.md` (13 lines, PM-nn) and
`docs/27-comite-interoperabilite.md` (13 lines, INT-nn).

## The line for this run

$ARGUMENTS

- **Empty** → take the **first line still marked `ouverte`** in the
  relevé of `docs/28-goal-market.md` §4. Do not reorder it because
  something else looks easier. The order was argued and written down.
- **A line id** → that line, and say in one sentence why it jumped the
  queue.

Never take two lines from the same register in a row. The interop
committee made that a condition of its own mandate: thirteen
integrations delivered over an incomplete content model gives a
well-wired product with nothing worth wiring.

---

## The loop

### 1 · Orient

- `npm test` — record the count. Red means the failing test **is** the
  goal.
- Read the line's row in its register: the standard that requires it,
  and **what its absence costs today**. If you cannot restate that cost
  in one sentence, you have not understood the line — read the standard,
  not just the row.
- Read only the files the line touches.

### 2 · Decide the smallest sufficient change

Name the change and the test that will prove it.

**Constraints that are not yours to relax** — the same five that hold
the rest of this codebase, plus two this plan adds:

| Constraint | Where |
|---|---|
| Authority decided in one place, server-side | `shared/rbac.js` |
| Every mutation audited inside its own transaction | `audited()` |
| Every mutable row asserts `row_version` | `updateVersioned()` |
| EVM / CPM / gate / RAID arithmetic is behaviour-frozen | `shared/engine.js` — **adding** a function is fine; changing a number it already produces is not |
| Schema changes are new numbered migrations | `server/migrations/` |
| **Every integration is closed by default, scoped, provenance-stamped and audited by name** | `docs/27` §5 — the five rules |
| **Meridian never becomes the system of record for data another system owns** | `docs/27` §1 — hold the governed projection, never the original |

**When you add an entity or a field you owe all five:** migration,
route, serialiser field, form field, test.

### 3 · Build

Match the surrounding idiom: plain ES modules, the hand-rolled `h()`
builder, comments that explain *why* and name the defect they prevent.

### 4 · Prove

```bash
npm run verify     # 8 gates; the test count must go UP
npm run sweep      # 12 documented warnings; a 13th means you changed something
```

Then exercise it **as a user**, in the browser, under every role it
affects. Read the console, not only the screen. Confirm the audit trail
recorded it.

> A change not exercised as a user is not proven, however green the
> tests. This project shipped an Administration screen that could not be
> opened at all, for its entire life, behind 322 green tests.

For an **INT** line, additionally:

- the key or address is **absent by default**, and the feature is inert
  without it — prove it by running with nothing configured;
- what it wrote carries its provenance, and the audit row **names the
  integration**, not "system";
- unplugging it breaks nothing but itself.

### 5 · Consign, in the same commit as the code

- mark the line in **its own register** (`docs/26` or `docs/27`) with the
  measure and the date;
- move its row in `docs/28` §4 from `ouverte` to closed, with the measure;
- update the README counts if they moved.

A correction delivered and not consigned is not finished. That rule
exists because it already happened here once, inside twenty-four hours.

### 6 · Decide the next iteration

- **DONE** — the six conditions of `docs/28` §3 are met. Three-line
  summary, commit, and take the next line.
- **CONTINUE** — something in 4 or 5 failed. Re-enter at step 2 carrying
  what you learned.
- **BLOCKED** — needs a decision, a credential or money. State the
  decision, the options, your recommendation. Take the **next** line
  rather than stopping the loop.
- **BUDGET** — five cycles without DONE. Stop and report. Five failed
  cycles means the line was wrong, not that a sixth will work.

---

## Rules across every iteration

1. Never weaken a test to make it pass.
2. Never disable an authority check to unblock a feature.
3. Never edit an applied migration.
4. Never ship a control you have not clicked.
5. **Report failure plainly.** A green summary over a red suite is the
   one unrecoverable error.
6. Leave the tree buildable at every stop.
7. When a measurement disagrees with the product, **suspect the
   measurement first.** It has been wrong three times in this project
   and the product twice.

## Report format

```
LINE      PM-nn | INT-nn  —  <one line>
OUTCOME   DONE | CONTINUE | BLOCKED | BUDGET
TESTS     <pass>/<total>   GATES 8/8   SWEEP <n> warnings
BROWSER   <what you drove, as which roles>
CHANGED   <files, one per line>
CONSIGNED docs/26 or docs/27 · docs/28 §4
NEXT      <the next line in order>
```

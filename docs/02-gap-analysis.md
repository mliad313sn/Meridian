# Deep Analysis — `legacy/meridian-pmo-v4.html`

4,214 lines. 393 lines CSS, ~3,800 lines JS, one file, no build, no tests.

## What is genuinely good (and is being kept)

| Area | Assessment |
|------|------------|
| **Earned-value engine** (`Engine.metrics`) | Correct. PV from baseline windows, EV from reported progress, AC from a ledger. The `measurable` guard that suppresses indices below 2% elapsed is a detail most PMO tools get wrong — it prevents a fortnight's spend from printing as CPI 0.31. **Keep verbatim.** |
| **Critical path** (`Engine.criticalPath`) | Real forward/backward pass with topological ordering, not a coloured-longest-bar trick. **Keep.** |
| **Dependency breach detection** (`depBreaches`) | Distinguishes *designed* fast-track overlap from *unplanned* overlap by comparing against the baseline lead, with 5-day tolerance. Unusually thoughtful. **Keep.** |
| **Portfolio roll-up** (`Views.reports`) | Takes the worse of aggregate and spread. Two red projects cannot average into green. **Keep.** |
| **Deterministic seed** | `rng(seed)` xorshift means a reset rebuilds the identical book. Essential for testable fixtures. **Keep, move to SQL seed.** |
| **Design system** | Coherent, restrained, accessible focus rings, `prefers-reduced-motion` honoured. **Keep verbatim (D-08).** |
| **`h()` / `s()` DOM builder** | ~40 lines, no framework, XSS-safe by default (text nodes, `html` used only with literals). **Keep — this is why the port is feasible.** |
| **Single write path** (`App.mutate`) | Every mutation goes through one function that snapshots for undo, stamps audit, persists, re-renders. **This is the seam the API client slots into.** |

## Findings — defects and gaps

Severity: **S1** blocks acceptance · **S2** significant · **S3** minor.

| # | Sev | Finding | Evidence | Requirement |
|---|-----|---------|----------|-------------|
| **F-01** | S1 | **No authentication whatsoever.** | `currentUser: "PE-14"` in `buildSeed()`; no login surface exists. | R1.1 |
| **F-02** | S1 | **No authorisation.** No role check guards any action. Every user can re-baseline, approve change requests, release contingency and delete records. | Zero occurrences of a permission predicate in 3,800 lines. | R1.2–R1.6 |
| **F-03** | S1 | **Audit trail is decorative.** Every row is attributed to `PE-14` and lives in the same mutable JSON blob it audits — a user can edit the audit trail with the JSON import. | `App.mutate` → `db.audit.unshift(...who: this.db.currentUser)`; `importAll()` replaces the whole object. | R6.1, R6.2 |
| **F-04** | S1 | **Single-user persistence.** `localStorage` under one key. Two people cannot share a portfolio; last writer wins on a whole-database granularity. | `Store` adapter, `KEY = "meridian-pmo-db-v4"`. | R2.1, R2.5 |
| **F-05** | S1 | **No meeting animation.** `settings.cadence` is a display string. There is no agenda, no attendance, no decision log, no actions register, no minutes. The Reports view produces a *document*, not a *meeting*. | `Views.reports`; `cadence: "Weekly — Monday 09:00"`. | R5.* |
| **F-06** | S2 | **No group/site governance distinction.** `project.site` is the delivery location, not an authority boundary. Nothing expresses "this is a group programme" vs "this is São Paulo's own project". | `PROJECTS[]` has `site` only. | R4.1 |
| **F-07** | S2 | **Money is float.** `budget: 8.4`, ledger amounts summed with `+`. Accumulated rounding across a 214-line ledger is real. | `sum(db.ledger..., l => l.amount)`. | R2.4 |
| **F-08** | S2 | **`ROLE_MODEL` is a lookup table that renders text.** It describes roles the system does not implement. | `docs/…` `const ROLE_MODEL = [...]` — `count:` functions only tally people, no grant is stored. | R1.2 |
| **F-09** | S2 | **Audit capped at 400 rows, undo at 25**, both silently truncating. Financial records must not evaporate. | `if (this.db.audit.length > 400) this.db.audit.length = 400;` | R6.1 |
| **F-10** | S2 | **No referential integrity.** Deleting a person leaves orphaned allocations, activity owners and CR raisers. Lookups return `"—"` and the loss is invisible. | `Engine.personName` returns `"—"` on miss. | R2.7 |
| **F-11** | S2 | **No tests, no build, no migrations.** Change cannot be verified; two engineers cannot work in parallel. | Repository state. | R2.2, R2.3 |
| **F-12** | S3 | Whole-app re-render on every mutation (`render()` clears `#root`). Fine at 12 projects; will not hold at 500. | `function render(){ clear(root); ... }` | perf |
| **F-13** | S3 | `props.html` uses `innerHTML`. Safe today (literals only) but a loaded footgun once data comes from a server. | `apply()` | R1 hardening |
| **F-14** | S3 | `nextId()` derives IDs by max+1 over the local array — collides the moment two clients insert. | `nextId` | R2.5 |
| **F-15** | S3 | Status date is `new Date()` at seed and never advances; the portfolio silently ages relative to the data. | `buildSeed()` | ops |

## Conclusion put to the committee

The **engine is production-grade; the container is a prototype.** The correct move
is not a rewrite but a **transplant**: lift the engine, the design system and the
component kit into a real application, and replace the container — persistence,
identity, authorisation, audit — with infrastructure that can bear weight. Then
add the one thing that was never there: the meeting.

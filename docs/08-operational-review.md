# Operational Review — fitness for duty

A third committee, convened 2026-08-28, to answer a question the build
committee and the design committee both skipped: **can this be operated
for a month?**

The system passed 116 tests and could not. What follows is the audit, the
gaps, and what closed them.

---

## 1 · The committee

| # | Member | Standing | Question they came to ask |
|---|--------|----------|---------------------------|
| **O1** | **PMO Operations Manager** (chair) | runs the group PMO day to day | "Walk me through a normal month." |
| **O2** | **Service desk lead** | fields every "it won't let me" call | "What will people ring me about?" |
| **O3** | **Data steward** | owns the directory and reference data | "Who fixes it when a record is wrong?" |
| **A3** | **T. Nakamura** — Site PM *(carried over)* | in the tables daily | — |
| **A5** | **V. Rossi** — Finance *(carried over)* | owns the ledger | — |
| **C3** | **Q. Mbeki** — Meeting consumer *(carried over)* | reads the minutes | — |

> **O1, opening:** "I do not want a demonstration. I want to be shown a
> joiner, a mover, a leaver, a mis-posted invoice and a re-baseline. If
> any of those needs an engineer, this is not a system, it is a prototype
> with tests."

---

## 2 · The operating rhythm, and where it broke

| Rhythm | Who | Before | After |
|---|---|:---:|:---:|
| Daily — progress, issues, board cards | Site PM | ✅ | ✅ |
| Daily — add or remove a stage | Site PM | ❌ | ✅ |
| Weekly — run the call, decisions, actions, minutes | Chair | ✅ | ✅ |
| Weekly — change the cadence, add a series | Chair | ❌ | ✅ |
| Weekly — joiner, mover, leaver | PMO analyst | ❌ | ✅ |
| Weekly — create an account, grant or revoke access | Administrator | ❌ | ✅ |
| Monthly — book actuals | Finance | ✅ | ✅ |
| Monthly — **correct a mis-posting** | Finance | ❌ | ✅ |
| Monthly — draw contingency | Finance | ❌ *(silently ignored)* | ✅ |
| Monthly — edit and approve a change request | Steering | ❌ *(404)* | ✅ |
| Monthly — **re-baseline** | Steering | ❌ | ✅ |
| Quarterly — add and correct a site or programme | PMO | ⚠️ *(create only, API-only)* | ✅ |
| Continuous — cross-project dependencies | Group PMO | ❌ *(read-only)* | ✅ |

---

## 3 · Findings

Severity: **P1** blocks normal operation · **P2** significant friction ·
**P3** minor.

| # | Sev | Finding | Evidence | Closed by |
|---|-----|---------|----------|-----------|
| **1** | P1 | **The "Edit change request" button 404s.** The client called `PATCH /change/:id`; no such route existed. | Matching all 41 client calls against all 60 routes — the only mismatch. | `PATCH /change/:id`, and `DELETE` to withdraw one. Editing a part-approved request **resets the approval chain**: a signature given for one figure must not carry to another. |
| **2** | P1 | **Administration showed a fictional access model.** A table of five *job titles* — "Portfolio director", "Team member" — counted by regex on the job description, while the system enforces four *access levels*. An administrator reading it formed a false belief about who could do what. **This was finding F-08 from the original gap analysis, which survived the rebuild.** | `ROLE_MODEL` in the admin view. | Deleted. Replaced by the four levels actually enforced, with live account counts. |
| **3** | P1 | **The entire `/admin` API had no interface.** Zero client references to users, grants, people, sites or programmes. The access model the whole system is built around was administered by curl. | grep across the client. | `web/src/views/administration.js` — accounts, grants, password reset, directory, sites, programmes. |
| **4** | P1 | **People had no lifecycle.** Add only: no role change, no rate change, no site move, no leaver. No API and no UI. | CRUD audit. | `PATCH /admin/people/:id`. Deactivating checks first for live projects, open actions and open RAID, and **names what would break** rather than breaking it — overridable deliberately with `force`. |
| **5** | P1 | **Re-baselining had no interface.** The route existed, was authorisation-gated, and nothing called it. | Route matcher. | Wired, behind a confirmation that shows the variance about to be erased and requires a written reason. |
| **6** | P1 | **The contingency checkbox did nothing.** The form field was `contingency`; the handler read `v.source`. Every contingency draw was silently booked as ordinary cost — no error, no symptom, and `contingency_used` never moved. | Reading `bookCost`. | Field name corrected; covered by a test that asserts the draw registers *and* that reversing it releases the contingency again. |
| **7** | P1 | **A mis-posted cost could not be corrected.** The ledger is append-only by design (A5's rule) — but the remedy was never built, so a fat-fingered figure was permanent. | CRUD audit. | `POST /cost/:id/reverse`. Equal and opposite entry naming what it reverses; both lines stay visible; a reversal cannot itself be reversed, nor a posting twice. |
| **8** | P2 | **Cross-project dependencies were read-only.** Drawn on the master schedule, seeded only. For a *group* PMO this is the week's work. | CRUD audit. | Full CRUD, requiring write authority over **both** ends — one project cannot commit another. |
| **9** | P2 | **Stages could not be added or removed; milestones could not be edited or deleted; sites and programmes could not be corrected.** | CRUD audit. | All wired. Stage weights are re-proportioned on add and remove so they still sum to one — otherwise earned value is invented. Gates cannot be deleted; a stage with reported progress is refused. |
| **10** | P2 | **"Undo last change" was a dead button.** `App.undo()` did not exist in the server-backed model; clicking it threw. | Browser check. | Removed, with the reason recorded: across several writers, undo is not undo — it is one person silently reverting another. The audit trail and the reversing posting replace it. |
| **11** | P3 | **The meeting record could not name its own chair.** `opened_by`, `closed_by`, `recorded_by` and `deputy_for` were stored and never surfaced. Six months later that provenance is the value of the record. | Field audit. | Surfaced through the API and into the minutes: "closed by R. Kaur", "recorded by …", "N. Rahimi (for V. Rossi)". Deputy attendance is now selectable. |

---

## 4 · The fitness gate

The findings above were all found mechanically, so the checks are now
part of the toolchain rather than a thing someone remembers to do:

```bash
npm run audit     # F1 route matching + F2 CRUD and field coverage
npm run verify    # tests + build + audit
```

**F1 — no button may 404.** `scripts/audit/route-match.mjs` reconstructs
every path the client calls, following string concatenation so
`a.patch("/projects/" + p.id + "/health")` reads as
`PATCH /projects/:id/health`, and matches against every route the server
defines. **Exits non-zero on a mismatch.**

**F2 — every entity must be correctable.**
`scripts/audit/crud-audit.mjs` checks create / update / remove-or-reverse
per table, and whether every column reaches the API contract. A gap must
be closed **or carry a written reason next to the entity**. There are
only four legitimate reasons:

| Reason | Entities |
|---|---|
| Append-only; corrected by a reversing entry that must itself exist | `cost_line` |
| Immutable once the parent closes (R5.5, R5.8) | `meeting_decision`, `agenda_item` |
| Append-only history the application must not rewrite (R6.2) | `audit_event` |
| Never leaves the server | `pw_hash`, `pw_salt`, `session.token` |

"Nobody has asked for it" is not on that list.

**F3 — every field must round-trip** and **F4 — every role must be able
to do its job** are in `.claude/commands/goal.md`, which runs all four on
every invocation.

**Current state: F1 clean, F2 zero unexplained gaps.**

---

## 5 · Verification

- **144 tests, 32 suites, 0 failures** — up from 116; the 28 new cases in
  `server/test/operations.test.js` map one-to-one onto the findings above.
- `npm run verify` (tests + build + audit) exits 0.
- Every new control clicked in the browser as the role that owns it:
  re-baseline, stage add/remove, milestone edit/delete, cost reversal,
  cross-project links, CR withdraw, account creation, grant and revoke,
  person edit, new meeting series.

### Notable behaviours the tests pin

- Editing a change request's **magnitude resets its approvals** — a
  signature given for one figure does not carry to another.
- Adding or removing a stage **re-proportions the weights** so they still
  sum to one; otherwise earned value would be created out of nothing.
- Reversing a **contingency** draw releases the contingency again.
- A cross-project link requires write authority over **both** projects.
- Deactivating someone who still holds live work is **refused with the
  list**, not silently allowed.

---

## 6 · Still open

- **Project cancellation** is close but not exact: a project is closed
  through its phase, and "cancelled" and "completed" are not
  distinguished. O1 wants a distinct terminal state; it needs a schema
  change and is not urgent.
- **Bulk reassignment on a leaver.** The system now refuses to deactivate
  someone holding live work, and names what they hold — but the operator
  still reassigns each item by hand. A "move everything to X" action is
  the obvious next step.
- **No project-level dependency view.** Cross-project links are managed
  from the master schedule; a per-project "what am I waiting on" panel
  would be more natural for a site PM.

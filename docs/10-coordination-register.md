# Coordination Register

**Purpose.** Four committees have now reviewed this build — the
constitutive committee (`00`–`06`), the design committee (`07`), the
operational committee (`08`) and the backend committee (`09`). Each
closed its own findings, and each suite passed in isolation. That is not
the same as the four sets of decisions being mutually consistent.

This register exists to answer two questions the individual reviews
cannot:

1. **Has any committee's fix quietly broken another committee's rule?**
2. **Is anything they left open tracked in one place, or in four?**

**Conducted:** 2026-08-28, after the backend review closed.
**Evidence:** 160 tests, four audit scripts, and a role-by-role browser
walk of all 13 screens as viewer, site, group and admin.

---

## 1 · Method

A cross-committee defect is, almost by definition, invisible to the
committee that caused it: it sits in the seam between two people's
scope. Reading for it does not work. So the pass was mechanical.

For each rule that more than one committee had asserted, the question
asked was **"where is this enforced, and what stops the next person
breaking it?"** Where the answer was "by hand, one site at a time", a
script was written to find every site.

That produced two new gates and eleven defects. Ten of the eleven were a
rule three people agreed on and nobody had automated.

| Rule | Asserted by | Was enforced by | Now enforced by |
|---|---|---|---|
| Every client call has a server route | operational | — | `scripts/audit/route-match.mjs` |
| Every entity has complete CRUD, or a written reason | operational | — | `scripts/audit/crud-audit.mjs` |
| Every versioned write asserts the version it read | backend | five admin routes, by hand | `scripts/audit/version-audit.mjs` |
| A control the account cannot use is **absent** (R7.3) | design, operational, backend | thirty-odd buttons, by hand | `scripts/audit/control-audit.mjs` |

All four run in `npm run audit`; the control gate also runs inside
`npm test`, so it cannot be skipped by someone who does not think to run
the audit.

---

## 2 · Cross-committee defects found and closed

### X-01 · The version check was fixed on five routes of fifteen

The backend review's finding 3 was that `Number(body.version ??
row.row_version)` is not a concurrency check — it asserts the value the
request just read, so it can never fail. It was fixed on the
administration routes that prompted it.

`version-audit.mjs` found **thirteen more**: every versioned `PATCH` in
`portfolio.js` and `meetings.js`. `requiredVersion()` moved from
`routes/admin.js` into `server/src/db.js` and is now applied to all
fifteen. A request that names no version gets **428 Precondition
Required** and a message saying so.

**Pinned by** `backend.test.js` — "a form edit that does not name its
version is refused", which walks all fifteen paths, and its companion
"the same edit succeeds once it names its version", so the check cannot
be satisfied by refusing everything.

### X-02 · The client did not know what 428 meant

X-01 introduced a status code the browser had never seen. `App.write()`
re-read the book on 409 and reported 428 as a flat error, so the user
was told "that did not go through" with no way to make it go through.

`ApiError.isStale` now covers both — a conflict and a request that named
no version have the same remedy, which is to re-read — and `App.write()`
refreshes on either.

### X-03 · Ten write controls were offered without asking authority

R7.3 — *a control the user has no authority for is absent, not greyed
out* — was agreed by the design committee, restated by the operational
committee as a fitness condition, and enforced server-side by the
backend committee. It was still applied by hand, and by this pass ten
controls had been missed:

| Where | Control | Was offered to | Now asks |
|---|---|---|---|
| Change request detail | Approve · Reject | anyone who could see a pending request | `change.approve`, including the magnitude threshold |
| Change request detail | Edit · Withdraw | same | `change.raise` on that project |
| Portfolio, board, change, documents, risk | the section-head create button | everyone, including viewers | `HEADER_ACTIONS`, via `primaryAction()` |
| Documents list | Approve · Submit · New revision · Edit | everyone | `document.write`, once per row |
| Budget register | Book cost | everyone, though `cost.write` is group-only | `cost.write` |
| Administration | Import book · Reset to seed | everyone who reached the screen | `data.import`; administrator |
| Resources drawer | Edit · end assignment | everyone | `allocation.write` on that project |
| Reports | narrative block editor | everyone | group and above |
| Administration | Revoke grant | reachable only from an admin screen | `App.isAdmin`, explicitly |

The server refused every one of these, so **nothing leaked**. What
leaked was the user's time, and their confidence that the interface
means what it shows — which is precisely the failure the design
committee named in `07 §2` as what makes an application feel generated.

The last row deserves its own sentence. Revoke was *safe*, because the
dialog could only be reached as an administrator. "You could only have
got here if you were allowed" is the exact argument that left the
change-request row unguarded. It now asks anyway.

Rather than repeat the rule per view, `primaryAction(view, db)` asks
`HEADER_ACTIONS` — the answer the app shell already computes — so a
create button's authority is decided in one place.

### X-04 · A deep link lost to the header filter

Following a link to `#/change/CR-218` from an agenda or an email landed
on whichever request happened to be first in the reader's current site
scope, with the URL still naming the one they wanted. A link to a
specific record is an explicit ask, and now beats the filter.

Found while exercising X-03 as a site lead — not by a script. Recorded
to make the point that the gates catch classes of defect, not all of
them.

---

## 3 · Consistency checks that passed

Worth recording, because a clean result is evidence too.

- **No committee's fix broke another's rule.** The design committee's
  control-absence rule and the backend committee's server-side refusal
  agree on all ten controls above, and `shared/rbac.js` is still the only
  place either one asks.
- **The engine is still behaviour-frozen.** 27 engine tests unchanged
  through four review cycles.
- **No authority check was weakened to close a finding.** Every fix in
  X-03 removes a control; not one adds a permission.
- **Over-guarding was checked in both directions.** A group lead keeps
  every control on their own programmes and correctly loses the
  assignment editor on another programme's project. Verified in the
  browser as all four roles, not inferred from the code.

---

## 4 · Consolidated open items

Everything the four committees left open, in one place, with the reason
it is open. Nothing here is a defect; each is a deliberate limit.

| # | Item | Raised by | Why it is open | Blocks release? |
|---|------|-----------|----------------|:---------------:|
| 1 | No load test — the `/bootstrap` bottleneck is predicted, not measured | backend | Needs a production-shaped dataset and a real PostgreSQL; PGlite would measure the wrong thing | No |
| 2 | `statement_timeout` is a round 15s | backend | Should be set from observed latency, which does not exist yet | No |
| 3 | `cost_line` carries no `row_version` | backend | Correct as designed — append-only, corrected by a reversing entry. Recorded so it is not read as an oversight | No |
| 4 | Project cancellation is not distinct from completion | operational | Needs a schema change; "closed" is currently reached through phase | No |
| 5 | No bulk reassignment when someone leaves | operational | Deactivation already refuses and names what they hold; reassignment is manual | No |
| 6 | No per-project dependency view | operational | Cross-project links are managed from the master schedule | No |
| 7 | Gantt bar states need a second pass | design | Wants real usage data on which state people look for first | No |
| 8 | No forced-colors / high-contrast mode | design | Token-driven, so small — nobody has asked | No |
| 9 | Icons are Lucide, not bespoke | design | Coherent with the hairline system; a nice-to-have | No |
| 10 | `strict-ssl=false`, project-scoped | build | The corporate TLS proxy's root CA is absent from the trust store. Scoped to this project with the reason recorded in `.npmrc`. **Must** be closed at the proxy before this is built elsewhere | The one item with a named external owner |
| 11 | PGlite is not the production engine | backend | Identical SQL, but it does not survive an unclean kill. Production must set `DATABASE_URL` | Deployment precondition |

Items 1–9 are enhancements. Items 10 and 11 are conditions on the
environment rather than on the code, and both have a named remedy.

---

## 5 · The gates, and what each guarantees

```bash
npm test        # 160 tests across 8 suites
npm run audit   # four structural gates, each exits non-zero on failure
npm run build   # the client compiles
```

| Gate | Guarantees | Current |
|---|---|---|
| `route-match` | No client call reaches a route that does not exist | 0 orphans |
| `crud-audit` | Every entity has complete CRUD, or a written reason | 0 unexplained gaps |
| `version-audit` | Every versioned write asserts a version the client supplied | 0 unversioned paths |
| `control-audit` | Every write control asks whether the account may | 0 unguarded controls |

Each gate carries its reason in its header comment, so the next person to
trip one is told *why the rule exists* rather than only that it failed. A
control may be exempted from the last gate solely by adding it to that
script's `ALLOWED` map **with a written justification** — the same
discipline the CRUD audit already used.

---

## 6 · The finding behind the findings

Ten of the eleven defects in this pass share one shape: **a rule several
people agreed on, enforced by hand.**

Three committees asserting R7.3 produced no more enforcement than one
committee asserting it would have. Agreement is not a mechanism. The rule
only became true of the software once a script could fail on it.

That is the durable output of this pass — not the ten fixed buttons, but
the four scripts that mean the eleventh cannot be added quietly.

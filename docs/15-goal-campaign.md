# The autonomous campaign — driving the Endeavour register to closure

`/goal` runs one goal to closure per invocation, with a five-cycle budget
and a fitness sweep at both ends. The register in
[`docs/14-endeavour-value-review.md`](14-endeavour-value-review.md) is
written to be its input.

Two forms. Use the campaign prompt to hand the whole register over; use
the per-finding form when you want to see each one land before the next
starts.

---

## The campaign prompt

Paste this as a single `/goal` invocation.

```
/goal Work the Endeavour value register in docs/14-endeavour-value-review.md to
closure, highest RPN first, one finding per cycle, without asking me between
findings.

ORDER. Take findings in the sequence recommended at the foot of that document
(V-01, V-02, V-03, then V-08+V-11, V-04, V-12, V-10, then the rest by RPN).
Deviate only if a lower finding is a hard prerequisite of a higher one — if it
is, say so in one line and do it first.

FOR EACH FINDING. Decide the smallest change that genuinely closes it, not the
smallest change that makes the symptom go away. When you add an entity or a
field you owe all five — migration, full CRUD route, serialiser field, form
field, test — and the crud-audit gate will fail you if you owe four. Then:
prove it with a test named for the finding; exercise it in the browser as every
role it touches; re-score S x O x D in the register with the residual and how it
was closed; and move on.

DEFINITION OF DONE FOR THE CAMPAIGN. No finding left with residual RPN >= 100,
and none left at S >= 9 with D >= 7. V-01, V-02 and V-03 breach the second
condition today, which is why they are first.

THE BAR THAT DOES NOT MOVE. npm run verify stays green — 193 tests and four
audit gates — at every stop. Authority decisions stay in shared/rbac.js. Every
mutation stays inside audited(). Every mutable row asserts row_version. The
engine's EVM, CPM, gate and RAID arithmetic is behaviour-frozen: extend around
it, never edit it. Schema changes are new numbered migrations, never edits to
applied ones. The client's permission module is the server's.

CONTEXT THAT SHOULD SHAPE THE DESIGN. This portfolio governs IT for gold mines
in Burkina Faso, Cote d'Ivoire and Senegal from Abidjan and London. Site leads
are francophone, often on rotation, often on a constrained link, and they are
the primary source of the data — anything that costs them time will simply not
be filled in. Plant systems stop for money and stop for safety, so a change
window is not an inconvenience, it is the constraint. The company is listed:
what the board was shown must be reproducible months later. Value is spoken in
production, availability and cost per ounce, not in story points.

WHAT I WILL JUDGE THE RESULT BY. A sponsor can ask "what did we get for the
money" and the portfolio answers with a baseline, a target and an actual. An
auditor can ask "what did the board see in March" and get exactly that. A site
lead can open one screen in French, see what is owed and by when, and be told
when it changes without opening anything.

STOP AND ASK ME only for a decision that is genuinely mine: money, credentials,
a security trade-off, or a change to the governance model itself. Otherwise
keep going. Report per the /goal format after each finding, and give me one
consolidated summary at the end: findings closed, residual scores, tests added,
and the single next thing.
```

---

## The per-finding form

Same bar, one finding at a time. Substitute the ID and its sentence.

```
/goal Close V-01 from docs/14-endeavour-value-review.md: a project carries no
business case and no benefit, so the portfolio cannot say whether the work was
worth doing.

Deliver: a benefit on a project — type (production, availability, cost, risk,
compliance), baseline metric and its value, target and its date, benefit owner,
and the measured actual after go-live; a post-implementation review recording
met / partly met / missed with a reason; realisation visible on the project, on
the programme card and in Reports; and benefits surviving into the decision
register so a steering committee can see what was promised against what landed.

Owe all five for every new field. Prove it with a test named for V-01 and drive
it in the browser as admin, group and site. Re-score V-01 in the register with
the residual and how it was closed. npm run verify stays green.
```

---

## Running it unattended

`/goal` stops at BLOCKED for anything only a human can decide and at
BUDGET after five cycles without closure — so an overnight run cannot
silently thrash. Check the register's residual column and the campaign
summary in the morning; both are written as it goes, not at the end.

Two guard rails worth knowing before you leave it running:

- **The production book is now empty.** Findings that need data to
  exercise (V-08 roadmap, V-04 prioritisation) will seed their own
  fixtures in tests. Do not let a run repopulate the live database to
  demonstrate a feature — the demo book was deliberately removed.
- **The service holds the database.** A run that needs to restart the app
  should use the dev launch config, not the installed service; stopping
  `MeridianITPMO` mid-campaign leaves the desktop shortcut pointing at
  nothing.

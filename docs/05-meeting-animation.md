# Meeting Animation — running the weekly and the monthly

The module the v4 build had no equivalent of (D-04). This is both the
design and the operating playbook.

> **C3, at the constitutive session:** "We run a weekly delivery call and
> a monthly steering committee. The tool produces a status *report*; it
> does not *run the meeting*. Nobody owns the agenda, actions are captured
> in a separate document, and last week's decisions are re-litigated
> because nobody can find them."
>
> **A4, seconding, with a condition:** "The weekly must take fifteen
> minutes. If the tool generates thirty slides nobody reads, we have
> automated waste."

Both of those shaped the design more than any requirement did.

---

## 1 · The shape

```
SERIES ─────────────────────────────────────────────────────────
  name · cadence (weekly | monthly) · scope (group | programme | site)
  chair · weekday · start time · timebox
        │
        ├── OCCURRENCE  ── scheduled → open → closed
        │     │
        │     ├── AGENDA        generated live while open;
        │     │                 frozen into rows at close
        │     ├── ATTENDANCE    present / apologies / absent / deputy
        │     ├── DECISIONS     immutable once the occurrence closes
        │     └── ACTIONS ──────┐
        │                       │  outlive the occurrence and appear at
        └── OCCURRENCE ◄────────┘  the top of every later agenda until
                                   they are closed
```

The state a meeting is in changes what the screen *means*:

| State | The agenda is | You can |
|---|---|---|
| `scheduled` | a forecast — it moves as the portfolio moves | read it, open the meeting |
| `open` | what you are working through now | record decisions, raise actions, take attendance |
| `closed` | a record | read it, read the minutes; nothing else |

---

## 2 · The agenda writes itself

No one types an agenda. `buildAgenda()` reads the portfolio as at the
meeting date and assembles, in this order:

| # | Section | Contents | Weight |
|---|---|---|:---:|
| 1 | **Actions carried forward** | every open action in the series, overdue ones marked and first | 3 |
| 2 | **Projects off track** | every amber and red project in scope, worst first, with the reason and the forecast slip | 5 |
| 3 | **Decisions requested** | pending change requests and steering-level escalations | 5 |
| 4 | **Milestones** | missed since the last run; landing before the next | 3 |
| 5 | **Schedule dependencies breached** | overlaps deeper than the baseline agreed | 2 |
| 6 | **Risks & issues for escalation** | by exposure, excluding anything already under §3 | 3 |
| 7 | **Resource pressure** | people over the ceiling for two weeks or more | 2 |
| 8 | *(monthly)* **Financial position** | BAC / EAC / VAC, CPI, SPI, contingency drawn against progress | 5 |
| 9 | *(monthly)* **Gate decisions due** | gates inside 60 days that are not cleared | 4 |
| 10 | *(monthly)* **Benefits tracking** | projects in closure and their Gate 4 evidence | 2 |
| 11 | **Next up / Next ninety days** | the forward look, so the meeting does not end on a problem | 1 |

Three rules make it an agenda rather than a report:

**Nothing to say means not on the agenda.** A section with no items is
dropped, never rendered empty. A green project does not appear at all.

**The timebox is real.** The series' minutes are divided across the
surviving sections in proportion to weight, floor of two minutes each.
Anything that does not fit is marked *if time allows* rather than
silently overrunning.

**A weekly is capped.** Six decisions, not twenty, with a note of how
many were deferred. That is A4's condition made concrete: twenty items in
a five-minute box is not an agenda, it is a list nobody works through.
(This was AMDEC finding B-07 — the first cut got it wrong.)

Every item carries `entity` / `entityId`, so clicking it opens the actual
project, change request or risk. The agenda is a way *into* the book, not
a summary that sits beside it.

---

## 3 · Weekly vs monthly

They are deliberately different documents.

**Weekly delivery call — 20-30 minutes, exception-only.** Actions,
exceptions, urgent decisions, milestones in the next fortnight, breaches,
capacity. It answers: *what has moved, and what do we have to do about it
before next week?*

**Monthly steering committee — 60-90 minutes, the pack.** Everything the
weekly covers over a longer horizon, plus the financial position, gate
decisions due, and benefits tracking. It answers: *is the portfolio
where it should be, and what are we being asked to decide?*

---

## 4 · Closing freezes history

When a chair closes an occurrence, three things happen in one
transaction:

1. the agenda as it stood is written into `agenda_item` rows;
2. the occurrence is stamped `closed`, with who closed it and when;
3. the next occurrence is scheduled, so the series never goes quiet.

After that, the occurrence refuses every write with a 409. Next week's
slippage cannot rewrite last week's minutes — which is the whole point of
minutes, and is asserted by a test that moves the portfolio underneath a
closed meeting and checks the agenda did not budge (R5.8).

---

## 5 · The playbook

**Before the call — nothing.** That is the design goal. The agenda is
current the moment you open the screen.

**At the start:** *Open the meeting*, then *Attendance*. Attendance is
recorded, not implied, because "who was in the room" is the first thing
anyone asks of a decision six months later.

**Working the agenda:** take the sections in order. Section 1 is the
actions you agreed last time — the meeting starts by holding people to
what they said, not by re-reading a status report. Click through to
anything you need to look at properly.

**When the room agrees something:** *Record a decision.* The rationale
field is not optional in spirit — the committee has to be able to read
back *why*, not just *what*. Attach the project and the change request
where they apply, and the decision becomes findable from both.

**When someone owes something:** *Raise an action* with an owner and a
date. It will be at the top of the next agenda, marked overdue if it
slips, and it will stay there until it is closed.

**At the end:** *Close the meeting*, with the chair's note if there is
one. Then *Minutes* — Markdown, ready to paste into the pack or the
channel, generated from what actually happened.

**Who may run one:** write authority over the series' own scope. A site
lead runs their site's call and reads the group's. A group manager runs
their programme's. A viewer reads everything in scope and changes nothing
(R5.11).

---

## 6 · What is deliberately not here

- **No calendar integration.** The series knows its weekday and time; it
  does not send invitations. That is a mail-system job.
- **No attendee self-service.** Attendance is recorded by the chair.
- **No editing a closed meeting, at any level.** Not even an
  administrator. A record you can revise is not a record. If something
  was wrong, it is corrected by a decision at the *next* meeting, which
  is how minutes have always worked.

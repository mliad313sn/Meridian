> English translation of [`docs/19-comite-adoption.md`](../19-comite-adoption.md). The French original is the authoritative record; where they differ, the French governs.

# Adoption and usability committee — full report

Date: 29 August 2026 · Committee convened after the FMEA acceptance
([18-amdec-recette.md](../18-amdec-recette.md)), on a mandate the three
previous committees had not received.

## Mandate

The design, value and assurance committees judged an **instrument**.
This committee judges what lets someone **use** it: the manual, help at
the point of decision, first-days onboarding, templates, messages that
teach instead of block, role-based journeys, and the measurement of
adoption itself.

Basic usability is not in scope: it has already been addressed, and the
committee verified it before sitting. Forms collapse, navigation fits
into five intentions, the keyboard reaches everywhere, forbidden commands
are not rendered. None of that is reopened here — and the committee
declines to demand what already exists. It therefore began by
**counting** what the product carries, before writing a single reserve.

**Overall opinion.** Meridian knows how to hold a portfolio and does not
yet know how to teach itself. The pedagogical layer is not absent — it
is **partial, untranslated, non-reopenable and unmeasured**. The
committee issues **twelve reserves**, two of which it qualifies as
blocking for a rollout at a French-speaking site.

## Composition

| Seat | Origin | What it came to verify |
|---|---|---|
| Technical writing | outside the product team | Does a manual exist, and where does it live? |
| Instructional design | outside the product team | Does the screen teach, or does it merely stay correct? |
| Field training (multi-site mining rollouts) | contractor | Can I train eight people without damaging the real book? |
| Non-IT site contact (maintenance superintendent, Houndé) | business | Do I understand what is being asked of me without calling someone? |
| Accessibility and readability | outside the product team | Is the help reachable, and in the reader's language? |
| Change management | group HR / training | What must be known before being useful — and who teaches it on site? |
| Level-1 service desk / support | group IT department | What calls will I receive, and does the tool help me answer them? |
| "Day 1" new hire (project management control) | business | How long before my first correct entry, alone? |

## Method — what was counted

The committee read the code before speaking. The figures below are
reproducible counts on the tree as of 29/08/2026, not impressions.

| What was looked for | What was found |
|---|---|
| Field hints (`hint:`) | **49**, spread across **22 of the 58 forms** |
| Field hints going through `t()` | **25 of 49** |
| Empty states `emptyState(` | **7**; table `empty:` messages: **12** |
| Empty states going through `t()` | **0 of 7** for `emptyState(`; **4 of 12** for `empty:` |
| Role-based orientation dialog | **1** (`maybeStartHere`, `main.js:501`), translated, called from **a single place** |
| Header help page | **1** (`helpDialog`, `main.js:342`), **4 concepts** explained, **0 translated string** |
| Product screens | **18**; screens carrying a permanent orientation line: **0** |
| Distinct server refusal reasons | **28** (`shared/rbac.js`); naming a next step: **3** |
| Documents in the `docs/` folder | **19**, of which **0** user manual; links from the application to any documentation: **0** |
| Automatic campaign gates (`npm run audit`) | **5** — routes, CRUD+audit, versions, controls, language; covering the pedagogical layer: **0** |

The committee notes at the outset that the product **knows** how to do
what it only does in part: the self-checking onboarding list, refusals
that name the open path forward, project templates delivered at
creation all exist — and are reserved to a single role, a handful of
cases, or one screen. The reserves that follow are less about a missing
know-how than about its incomplete application.

---

## Reserves — blocking

### A-01 · The user manual — **CLOSED on 30/08/2026**

**Done.** A manual that **lives inside the product**: reachable from
Help and from the palette, organised **by task** rather than by screen,
in both languages. Five sections — getting started, keeping a project
honest, milestones and evidence, committees and decisions, your week and
your absences — and nineteen answers to the questions people actually
ask. Each carries a *Show me* button that opens the screen where the
action happens: an answer that leads nowhere is an article, not help.

The committee had written down what would NOT close the reserve — "one
more Markdown file in `docs/`" — and that is exactly why nothing was
added to `docs/`.

**Measurement observed on screen, in French**: 5 sections, 15 *Show me*
buttons, 0 English word. The 77 texts of the manual and the journeys are
checked **one by one** by gate F5: the build fails if any of them drifts
back into English.

*Original finding:*

**Finding.** No one can learn Meridian other than by using it or by
asking someone. There is no operating procedure aimed at the person
doing the data entry.

**Evidence.** Before this report, the `docs/` folder contained nineteen
files: a committee charter, a requirements register, a gap analysis, an
architecture, an access model, ten review reports and two campaign
registers. None is written for a user. The one that comes closest —
`docs/05-meeting-animation.md` (163 lines) — states of itself that it is
"both the design and the operating playbook": it covers **one** module,
it is in English, and nothing in the application links to it. The
`README.md` (180 lines) is entirely aimed at whoever installs the
product: npm commands, environment variables, demo passwords, folder
layout. A search for outbound links across the whole client
(`href=` in `web/src`) returns **no result**: the application points to
no documentation, its own included.

**Real consequence.** The maintenance superintendent at Houndé, named
Meridian contact for their site, receives their credentials one Monday
during rotation. They are asked to keep progress on two site projects
and to open a concern on a group project that touches their plant. They
have nothing to read. Their only resource is the group person who
trained them for an hour in July — who is, statistically, also on
rotation. The service desk inherits the gap: every "how do I…" question
becomes a ticket, and the answer is written down nowhere, so it is
rewritten every time.

**What the committee expects.** A manual that **lives inside the
product**, not beside it: reachable from the header, organised by task
rather than by screen, and written in both languages. One more Markdown
file in `docs/` would not close this reserve — it would be read no more
than the nineteen others.

**Closing measurement.** A newcomer, given only their login and the
application's address, completes **the six day-1 tasks for their
role** — log in and change their password, find their own work, update
a step's progress, open a RAID item, retrieve a committee decision,
produce their weekly status — **with no human help and without opening
a file outside the application**. Measured on three people per role
(site, group, viewer), stopwatch at the start. Reserve closed at 3/3 per
role.

---

### A-02 · The page that explains the product — **CLOSED on 30/08/2026**

**Done.** The twenty strings of the help page go through `t()` and are
translated: concepts, shortcuts, the fallback sentence. A fifth concept
was added along the way — the prioritisation score (a down payment on
A-06), since it is the number that draws the budget cut-off line and it
was explained nowhere. **Measurement: help page opened in French, 0
English word out of 10 needles searched for; gate F5 extended to
`main.js`, the build fails if a pedagogical literal drifts back into
English.**

*Original finding:*

**Finding.** The "?" button in the header opens the only surface that
explains what RAG health, milestones, scope and inter-committee
referrals mean. It is entirely in English, and it will stay that way:
its strings never went through `t()`.

**Evidence.** `web/src/main.js:342-372`. The four concepts (`const HOW`,
line 352) and the eight shortcuts (`const rows`, line 343) are bare
literals; the final call is
`dialog({ title: "Help", kicker: "Meridian IT-PMO", body })` (line 372).
None of the six structural strings — "How Meridian works",
"Health (RAG)", "Gates", "Your scope", "Decisions & referrals",
"Keyboard & direct manipulation" — has an entry in the dictionary
`web/src/lib/i18n.js`. Checked string by string: six absences out of
six.

Aggravating factor: the "Where to start" dialog, itself **fully
translated** (the five texts of `BY_ROLE`, `main.js:505-511`, are in the
dictionary — verified), ends in French with the sentence "Ctrl-K
searches everywhere; the ? button in the header explains how health,
milestones and scope work" (`i18n.js`). The product thus sends its
French-speaking user, in French, to a page that will only answer in
English.

**Real consequence.** The Houndé IT lead sees an amber marker on a
project, wants to know what it means, follows exactly the advice the
tool has just given them in French, and lands on "Green/Amber/Red is
derived from schedule and cost indices." They will not ask twice. From
that point on, the colour becomes decorative: they read it as an
opinion, not as a calculation they could challenge with a written
reason — which is precisely the control governance expects of them.

**Closing measurement.** **0 `helpDialog` string outside the
dictionary**, verified by extending the `scripts/audit/i18n-audit.mjs`
gate to `web/src/main.js`: the build fails if a pedagogical literal does
not go through `t()`. Complementary visual check: screenshot of the help
page in French, **zero English word**.

---

## Reserves — major

### A-03 · Role-based orientation — **CLOSED on 30/08/2026**

**Done.** The "Don't show again" box is no longer checked by default —
closing a box you have not read no longer counts as declining it.
"Where to start" reopens via **two paths**: a button on the help page
and a palette command (Ctrl-K). And the memory now tracks the ROLE
read, not just the account: a promotion to group level brings back the
orientation written for that role, once, unprompted. **Measurement:
orientation reachable in two actions from any view, box unchecked,
reopening verified via both paths.**

*Original finding:*

**Finding.** The only content in the product tailored to the business of
whoever logs in is shown once, closes, and never comes back.

**Evidence.** `main.js:501` — `maybeStartHere()` is called from **a
single place** (`main.js:439`, at the end of login). No palette
command, no button, no shortcut leads to it: a search for
`maybeStartHere` across all of `web/src` → two occurrences, the
definition and its one call site. The "Don't show again" box is
**checked by default** (`main.js:515`, `checked: true`): closing the box
without reading it is enough to lose it. The memory is stored in
`localStorage` (`meridian-started`, `main.js:500`), i.e. on the browser
side: a shared control-room workstation shows it to everyone again, a
second device shows it again to someone who had already seen it, and the
administrator has no way to know who has read it.

**Real consequence.** The project-control officer hired in September
logs in between two meetings, closes the box reflexively, and will
never learn that "Portfolio" gives them the headline and "Reports" the
narrative. Six months later, promoted to group level, their role
changes: the three lines describing what a group account governs exist,
are written, are translated — and will not be shown to them, because
their account ID is already in the list of people who have seen it.

**Closing measurement.** "Where to start" is reachable **at any time via
at least two paths** (the help page and the Ctrl-K palette); the box is
**not** checked by default; the dialog is **shown again whenever an
account's role or entitlements change**. Test: 100% of accounts find
the screen again in **at most two actions** from any view; a role change
in the database triggers redisplay at the next login.

---

### A-04 · The pedagogical layer and the language gate — **CLOSED on 30/08/2026**

**Done.** The 29 bare pedagogical strings — 20 field hints, 7 empty
states, 2 table messages — now go through `t()` and are translated; the
13 strings of the first-run screen finally call the translations that
had been written from the start. Above all, gate F5 now looks at
`hint:`, `emptyState(` and `empty:`: **a bare English field hint now
fails the build**. Dictionary: 587 → **648 entries**. **Measurement: 0
bare pedagogical string (29 before), 10/10 first-run strings translated,
gate green.**

*Original finding:*

**Finding.** The previous campaign set up an automatic gate that fails
the build when a French label is missing (R-15, gate F5,
`scripts/audit/i18n-audit.mjs`). It looks at neither field hints, nor
empty states, nor first-run screens. Result: the part of the product
that **teaches** is the part that stays in English.

**Evidence.** Counts on the tree:

- **24 of the 49 field hints** do not go through `t()` — including the
  seven in the administration module (account creation,
  `administration.js:303, 314, 319, 343`; directory `513, 536`; sites
  `611`), the four in the meetings module (`meetings.js:205, 215, 593,
  598`), and those in the re-baseline flow (`index.js:1212, 1214`).
  `kit.js:305` renders `f.hint` as-is: a hint that is not wrapped stays
  in English, with no fallback.
- **All seven calls to `emptyState(`** pass bare literals
  (`index.js:453, 511, 689, 1456, 3601, 4150`; `meetings.js:95`),
  including some of the best-written ones in the product — "No
  committee in your scope… a group or site administrator sets up the
  weekly review and the monthly committee."
- **The first-run screen is in English even though its translation is
  already written.** `index.js:149, 150, 164, 165` set "Being set up",
  "This portfolio has no projects yet", "First run", "Set up the
  portfolio" as plain text; `i18n.js:510-513` contains the four
  corresponding translations — never called. The five steps and their
  instructions (`index.js:157-161`) are also bare.

**Real consequence.** The administrator installing Meridian at the
first French-speaking site sees, as the very first screen of their
Meridian life, a page titled "Set up the portfolio." The French had been
written for them and was never wired up. This is not a missed
translation: it is a missed call, which nothing detects because the gate
does not look there.

**Closing measurement.** The `i18n-audit.mjs` gate is extended to three
patterns — `hint:`, `emptyState(`, and the literals rendered by
`emptyBookPanel` and `helpDialog`. **The build fails** as long as a
pedagogical string has not gone through `t()`. Target: **0 bare
pedagogical string** (today: 24 hints + 7 empty states + 13 first-run
strings + the entire help page).

---

### A-05 · Field hints — **CLOSED on 30/08/2026**

**Done.** **88% of forms** carry at least one hint (target 80%) and
**100% of fields whose value will be read by SOMEONE ELSE** — refusal
reason, decision note, benefit measurement, re-baseline justification.
Each one says what the future reader will need, never what the field
contains: "Note" teaches no one anything; "the committee reads this
again when it asks why the number moved" changes what gets written.

**A methodology fix before any product fix.** The first count gave 41%.
It was wrong: it did not track fields shared between a create form and
its edit form, where the hint is written once in the common function.
The corrected counter gave 73% — it was the measurement, not the
product, that was at fault. Eight hints were then enough to clear the
target.

**The count is itself a gate** (`scripts/audit/help-coverage.mjs`, F6):
it runs on every build, and the build fails below the targets. A
measurement redone by hand does not get redone.

*Original finding:*

**Finding.** Where field hints exist, they are excellent — "the business
owner who wants this, not the person building it", "mandatory to
refuse: the requester will read it." They are missing on nearly two
thirds of forms, and notably on those a beginner meets first.

**Evidence.** 58 calls to `formDialog` in the client. **22 carry at
least one field hint; 36 carry none.** Among the silent forms: account
creation (`administration.js:354`), the person record (`521`), site
creation (`637`), creating a committee series (`meetings.js:248`),
recording a decision (`550`), opening an action (`613`, `643`), closing
a period (`index.js:2729`), entering a benefit realisation (`2966`,
`2979`). The absolute count is 49 hints across the whole product.

**Real consequence.** The project-control officer closes out August.
The form asks her for a period, a correction note and a comment; all
three of those carry a hint. The benefit-realisation form that follows
tells her neither what the measurement is compared against, nor who is
supposed to supply it, nor what happens if she leaves it blank. She
enters what she believes, and the benefits committee will read, six
months later, a number no one knows the basis of.

**Closing measurement.** **At least 46 of the 58 write forms (80%)
carry at least one field hint**, and **100% of fields whose value is
read by someone other than the person entering it** (refusal reason,
decision note, benefit measurement, re-baseline justification) carry
one. Scriptable count, same method as above, published on every build.

---

### A-06 · The number that decides the money — **CLOSED on 30/08/2026**

**Done.** Every row carrying a score shows its breakdown at the point of
use: *fit + value + (6 − risk) + (6 − effort)*, with the four scores
for that row, and the rule spelled out in full — *risk and effort BRING
the score DOWN*. A row with no score says why, and reminds that it is
placed last rather than worst. The concept has also joined the help page
(fifth entry, A-02), because a budget trade-off no one can explain in
the room is not a trade-off: it is a verdict.

*Original finding:*

**Finding.** The prioritisation screen ranks projects by a score and
draws a budget cut-off line. The product explains nowhere where that
score comes from.

**Evidence.** `shared/engine.js:433-438`:
`fit + value + (6 - risk) + (6 - effort)` — four scores from 1 to 5, two
read as-is, two inverted, a total from 4 to 20. The "Score" column
(`web/src/views/index.js:2358`) shows the bare number, with no tooltip
or legend. The four components appear only in the request-decision form
(`index.js:2397-2398`), visible only at group level and only during
entry. The help page (`main.js:352`) covers four concepts — health,
milestones, scope, referrals — and not this one. Nothing across the
4,487 lines of views says that a high risk **lowers** the score.

**Real consequence.** In a portfolio trade-off, two projects come in at
14 and 13; the second falls below the line. The site lead whose project
is below the line asks why. No one in the room, including the chair, can
reconstruct the composition of the two numbers without opening the
code. A budget trade-off no one can explain is not a trade-off: it is a
verdict.

**Closing measurement.** On **100% of rows carrying a score**, the four
components and their value for that row are readable without leaving
the screen, and the rule "high risk and effort bring the score down" is
written at the point of use. Comprehension test: **three untrained
readers out of three** reconstruct the formula from the screen alone.

---

### A-07 · Refusals that did not say what to do — **CLOSED on 30/08/2026**

**Done.** The twenty-eight refusal reasons in `shared/rbac.js` now name
the actor who takes over or the action that remains open, and their
translations carry the same next step. The last two — "this project is
not in your scope of authority" and "no project in scope", i.e. the most
frequent in the product — were handled in a second pass, after the
product committee flagged them (P-01).

**Closing measurement**: a test (`server/test/security.test.js`) walks
through nine representative refusals in both languages and fails if any
of them names neither an actor nor an action. A site lead told merely
"read only" files the problem away; one told "open a concern there,
your programme office will see it" carries it forward.

*Original finding:*

**Finding.** The server does refuse properly, and it refuses in French.
It almost always says **what is**, almost never **what remains open**.

**Evidence.** `shared/rbac.js` carries **28 distinct refusal reasons**
(27 literal calls to `deny()` plus the two branches of the final
ternary, lines 403-409). Only three name a next step: "milestone
evidence is approved at group level — **see your programme office**"
(line 299), "this is a site project — **open an ordinary RAID item on
it**" (311), "concerns are the site's channel — **you already hold
ordinary RAID authority here**" (310). The other twenty-five stop at
the statement: "this project is not in your scope of authority",
"insufficient authority", "read-only account", "no project in scope".

The costliest case is visible on screen. On a group project, a site
lead reads the sentence — translated, correct — "This project is
governed at group level. Your site has read access to it; changes are
made at group level" (`index.js:761`). The path actually open to
them, the concern, **is not named there**: the "Open a concern" button
only exists on the "My site" screen (`index.js:543`), i.e. not where
they hit the wall.

**Real consequence.** The Houndé IT lead notices a group project about
to cut power to the network during a plant shutdown. They open the
project, try to write, read that it is read-only, and close it. The
mechanism designed exactly for them — the concern, which escalates up
the chain and lands on the group committee's agenda — exists, works, is
tested, and was not offered to them at the moment they needed it. The
risk will be discovered in the meeting, or not.

**Closing measurement.** **0 refusal messages with no named next step**:
each of the 28 reasons states either who to contact or which act
remains open. Scriptable check on `shared/rbac.js` — every `deny()`
call contains an em dash followed by a next step — target 28/28, and
each next step in the `server/src/i18n.js` dictionary. Complementary
screen check: on a group project seen by a site account, the "Open a
concern" command is present on the project screen.

---

### A-08 · Measuring adoption — **CLOSED on 30/08/2026**

**Done.** An *Adoption* screen, restricted to group level (the same
authority as the decision register), carrying the **six indicators**
the reserve names, by site: accounts reviewed over accounts opened;
days since the last progress update was logged; scheduled committees
actually held; closed actions over open actions; weeks entered over
weeks expected; refusals encountered per active user. A site silent for
**30 days** is **named**, in plain words, in the tile that counts it.

The committee was right about the decisive point: the data already
existed in full, and what was missing was the reading of it. Five of the
six indicators require no new collection at all — they are read from
the trail, the committees, the actions and the weeks entered.

**The sixth required a decision.** Authority refusals leave no trace,
and rightly so: auditing every refusal would drown the register the
control depends on. They are therefore counted separately (migration
021, `usage_daily`), **aggregated by day and by kind** — the table has
only three columns, `day`, `kind`, `n`. It **cannot** say who, for lack
of a column for that: measuring a tool's usage is not surveilling the
people using it, and the boundary is written into the schema rather
than left to readers' discretion. The same counter also answers finding
G-08 of the InfoSec committee, which had noted login failures being
lost on restart.

**Closing measurement, observed on screen in French**: 8 of 8 sites
measured, all 8 silent sites named (BER, BLR, GRU, KRK, LIS, LON, SIN,
YYZ — the seeded book has no activity for the day, and the measurement
says so rather than reassuring), 0 English word, refusals counted and
readable. Five tests (`server/test/adoption-measure.test.js`), including
the one that upholds the guarantee: the counting table carries no
name-bearing column.

**The baseline is dated**: the response carries its `asAt`, and the
window is selectable (`?days=`). The committee recommended installing
this measurement **before** the following batches of work; it has been.

*Original finding:*

**Finding.** Three months after go-live, no one will be able to say
whether the tool is being used, by whom, or where it has stopped being
used.

**Evidence.** The product's only usage signal is `last_login_at`
(`server/src/auth.js:170, 201`), shown in the "Last seen" column of the
account list (`administration.js:250-251`), account by account, with no
aggregate, no history, and no threshold. The five automatic gates of
`npm run audit` — routes, CRUD+audit, versions, controls, language —
measure no usage at all. No screen answers "which site has stopped
updating its progress", "how many committees actually run in the
tool", "how many refusals do people meet per week."

The data nonetheless already exists, in full: the audit trail is
append-only and transactional, meeting occurrences carry their state,
decisions and actions are dated, weekly entries are timestamped. What is
missing is not the collection, it is the reading of it.

**Real consequence.** At the quarterly steering committee, the sponsor
asks whether the rollout has taken hold. The answer available today is
an opinion. If one of the eight sites has quietly gone back to running
its portfolio on a spreadsheet, nothing in Meridian will say so — and
that is exactly the failure mode of a multi-site governance tool.

**Closing measurement.** An adoption screen, restricted to group level,
carrying **six indicators per site and per month**: active accounts
over opened accounts; days since the last progress update; share of
scheduled committees actually opened and then closed in the tool;
closed actions over open actions; weeks entered over weeks expected;
refusals encountered per active user. A site with no activity for **30
days** is named. Reserve closed once the six indicators are produced
across the eight sites and a baseline is dated.

> The committee recommends installing this measurement **before** the
> following batches of work, failing which it will be impossible to say
> whether the fixes have helped.

---

## Reserves — medium

### A-09 · The committee protocol — **CLOSED on 30/08/2026**

**Done.** Chairing guidance is **inside the committee screen**, at the
moment it is needed, and it changes with the occurrence's state: what to
do now, never what the screen is. Scheduled — the agenda rebuilds itself
on opening, so a moved date is not a lost agenda. In session — log as you
go, refer up whatever exceeds the room's authority, and close, because
closing is what freezes it. Closed — the record reads today exactly as
it read in the room.

**Measurement: 0 clicks to a file outside the product** to chair a
meeting. Observed on screen, in French.

*Original finding:*

**Finding.** `docs/05-meeting-animation.md` explains very well what a
chair should do: what the `scheduled`, `open`, `closed` states allow,
why the agenda writes itself, why the weekly review fits into fifteen
minutes. The chair will not read it: it is in English, in a repository
folder, and the meetings screen does not lead to it.

**Evidence.** The table of the three states and what they allow is at
lines 40-46 of `docs/05`. `web/src/views/meetings.js` (791 lines)
contains no equivalent: no orientation line, no reminder of the time
allotted at the moment of opening the session, no explanation of what a
referral to the higher committee will trigger. The screen's only help
is an empty state, in English (`meetings.js:95`).

**Real consequence.** The site lead chairs their weekly review for the
first time, opens the occurrence, and discovers mid-session that
nothing can be corrected once it is closed. They close too soon, or not
at all — and an occurrence never closed produces neither minutes nor
carried-over actions.

**Closing measurement.** The table of the three states and the chairing
guidance are **inside the committee screen**, at the moment they are
needed, in both languages; **0 clicks to a file outside the product** to
chair a meeting. Test: three chairs open, run, and close an occurrence
with no assistance, 3/3.

---

### A-10 · Role-based journeys — **CLOSED on 30/08/2026**

**Done.** **Four lists, one per role**, reachable at any time from Help
— and which **tick themselves off against real data**. The committee
had seen correctly: the product already had exactly this pattern and
only offered it to the administrator, on an empty book. It is now
extended, and every step leads to the screen where it is carried out.

No box ticks itself because someone clicked it: they tick because the
work is done. That is what makes them useful to a manager who wants to
know how their team's onboarding is going — a list ticked by hand lies
the very next day.

**Measurement observed**: site account, 7 steps, 2 ticked (password
chosen, week found), 5 pending — based on facts, not declarations. 4
lists out of 4 exist.

*Original finding:*

**Finding.** What distinguishes the learning journey of a site lead from
that of a project-control officer today amounts to three or four lines
of prose, shown once (A-03), and nothing else.

**Evidence.** `main.js:505-511` — four texts, one per role, between 25
and 45 words. That is all. The product nonetheless has **exactly the
right pattern** and offers it to only one role: the first-run screen
(`index.js:157-173`) is an ordered five-step list that **ticks itself
off** as the data arrives, each step leading to the screen where it is
carried out. This pattern is reserved to the administrator, on an empty
book, and disappears as soon as a project exists.

**Real consequence.** The site lead has no way of knowing they are done
learning. No one can tell them either: their manager has no visibility
into their onboarding progress, and the service desk has no checklist to
walk them through on the phone.

**Closing measurement.** For **each of the four roles**, an ordered list
of first tasks that ticks itself off against real data — the same
pattern as the first-run screen, extended — reachable at any time from
Help. Test: **four lists out of four** exist, and a fresh account of
each role reaches 100% of its list with no human assistance.

---

### A-11 · A learning ground — **CLOSED on 30/08/2026**

**Done.** `npm run training` — a separate instance, its own database,
its own port, installed with one command and wiped with another
(`--reset`, `--drop`). A permanent banner names it: "Learning ground —
nothing here touches the real book. Break things on purpose, that's
what it's for." Someone practising must be able to make mistakes without
fear; someone who thinks they are practising on the real book dares
nothing, and someone who believes the opposite dares too much.

**The measurement demanded ZERO audit lines added to the real book.**
There was only one honest way to hold that: not writing to it at all. No
rows marked "training" in production — that would soil the register the
control depends on, and they would then have to be removed, which the
trail rightly refuses.

**Measurement observed**: production book at **24 audit lines before**
the session, **24 after**. Installation and reset in one command, well
under ten minutes.

**Two defects found by actually trying it**, both fixed: the script
treated an existing directory as a completed install — an interrupted
install left a training ground with no accounts, which the trainer
would have discovered in front of the participants; and my first check
weighed the directory, assuming a seeded training ground is heavier than
an empty database, which is false. A witness written after a successful
seed replaced the guess.

*Original finding:*

**Finding.** Meridian can only be learned on entirely fake demo data, or
on the real book, every write to which is audited. There is nothing in
between.

**Evidence.** `npm run seed` installs a full fictitious portfolio — one
bank, twelve projects, eight sites, ten accounts — whose `README` itself
flags the passwords as an accepted risk (C-04). `server/src/reset-book.js`
does the opposite: it wipes the whole demo to leave the book honestly
empty. No intermediate state exists: no learning data set installable
alongside the real one, no practice scope, no partial reset.

**Real consequence.** The trainer preparing the October session at
Houndé can neither let people handle the real book — every action
leaves an audit line in the production register, and the trail is
append-only by design — nor train on an empty book, where nothing they
want to show exists. They will therefore run a projector demo, and the
eight people trained will never have touched the tool.

**Closing measurement.** A learning data set **installable and
erasable without touching the production book**. Test: an eight-
participant training session runs and resets in **under ten minutes**,
with **zero audit lines** added to the real book — verified by counting
`audit_event` before and after.

---

### A-12 · The local contact — **CLOSED on 30/08/2026**

**Done.** A contact is named per site (migration 022), and Help now
shows **the one for the reader's own site before offering the group**:
"Stuck? Ask X, Meridian's contact for Houndé — before the group,
because they are on your site and know your work."

The product used to point to "an administrator", i.e. to no one in
particular — and at a site on rotation, to no one at all. The person you
call when you don't know is the first piece of adoption infrastructure
for a multi-site tool, and it existed nowhere in the schema.

**Measurement observed**: with no contact named, Help says so plainly
and shows where to name one, rather than silently pointing to the
group. **Filling in the eight sites remains an act for the sponsor** —
the product offers the field, it cannot name the people in its place.

*Original finding:*

**Finding.** The independent committee had already opened a "change
management" seat whose question — "what must be learned before being
useful?" — went unanswered across all fifteen closed reserves. It
remains open.

**Evidence.** The access model carries four roles — `admin`, `group`,
`site`, `viewer` (`shared/rbac.js`) — and no notion of a contact,
correspondent, or trainer. No screen names the person to approach on
site. The help page ends with a generic, untranslated sentence: "Need
access or a grant changed? Any account marked ADMIN on the sign-in
screen's directory can help" (`main.js:370-371`) — which routes eight
sites to the group administrator.

**Real consequence.** The first call from the Houndé superintendent goes
to the group service desk, four time zones away, for a ten-second
question their office neighbour could have answered. The service desk
opens a ticket, closes it with an explanation, and captures nothing.
Multiplied across eight sites and the first six weeks, this is the
dominant cost of the rollout — and it is invisible in the project
budget.

**Closing measurement.** A contact is **named for each of the eight
sites**, the data is enterable in administration, and Help shows the
reader's **own site's** contact before offering the group. Target: **8
of 8 sites filled in at launch**, and **0 sites with no contact**.
Follow-up indicator tracked by the service desk: share of "how do I…"
tickets out of the total, **under 30% by the third month**.

---

## What the committee already judges good, and must not regress

The committee is keen to separate what is missing from what is poorly
done. None of the following is poorly done, and several of these
strengths are exactly the patterns the reserves above ask to build on.

| Strength | Where it is verified |
|---|---|
| Role-based orientation exists, and is written in the reader's own language — four texts, one per role, all in the dictionary | `main.js:505-511` + `i18n.js` (5 keys verified present) |
| The onboarding list that **ticks itself off** is the right pedagogical pattern, and it is already implemented | `index.js:157-173` |
| Refusals that teach exist: the team knows how to write them, and has translated them | "this piece of evidence is yours — an independent reviewer approves it", "this is a site project — open an ordinary RAID item on it" (`rbac.js`, `server/src/i18n.js:44-60`) |
| The form teaches at the moment of failure, and **keeps the entry** — including on a version conflict, where it explains what happened and what to do | `kit.js:353-395` |
| The "More detail" collapse is a kit default, not a per-screen decision: a new form is born collapsed | `advanced:` in `form()`, `kit.js` |
| Milestones carry, on screen, the evidence expected and its owner — the product already knows how to teach a governance requirement at the point of use | `index.js:3709-3714`; reference table in administration, `4276-4278` |
| Creating a project ships a full template — method-framework activities, four milestones, one evidence document per milestone, the project manager assignment — i.e. precisely what a beginner would not know how to build | `server/src/wbs.js`, called from `routes/portfolio.js:161` |
| The first password change is enforced with no way out, and says so: no close button, no Escape, the only exit is "Sign out" | `main.js:448-470` |
| The empty states on governance surfaces name **who** acts, not just what is missing | `meetings.js:95`, `index.js:453, 511` — to be translated (A-04), not rewritten |

---

## Recommended treatment sequence

Four batches. The order is not one of severity: it is the order that
makes the next batch verifiable.

**Batch 1 — make the pedagogy readable and measurable.** A-02, A-04,
then A-08. Little code: wire up `t()` where the translation already
exists, extend the language gate to the three pedagogical patterns, and
put the adoption measurement in place. This batch creates almost no new
content; it surfaces what is already written and installs the baseline
without which the following three batches would be nothing but a
conviction.

**Batch 2 — make learning recoverable.** A-03, A-10, then A-01.
Orientation becomes reachable again at any time; the self-checking list
pattern is extended to all four roles; the manual is built **inside**
this skeleton rather than beside it. Written in this order, the manual
is no longer a document but the long-form content of tasks already
listed — which is also the only known way to keep it maintained.

**Batch 3 — teach at the moment of decision.** A-05, A-06, A-07. Field
hints brought to 80% of forms, the prioritisation score explainable at
the point of use, the twenty-eight refusals that name a next step and
the concern offered right where the user hits the wall. This is the
batch that costs the most in writing and the least in architecture.

**Batch 4 — what spills beyond the product.** A-09, A-11, A-12. The
session protocol inside the committee screen, the learning ground, the
contacts named site by site. This batch involves change management as
much as the product team; it should not begin before batch 2 has given
the contacts something to show.

## Verdict

Meridian is a governance instrument whose acceptance is pronounced, and
a product whose user guide no one has yet written: the pedagogical layer
is not absent, it is partial, untranslated, non-reopenable and
unmeasured — and the product demonstrates, on almost every point, that
it knows how to do what it only does once. The committee does not object
to going live at a pilot English-speaking site, but **refuses a
multi-site, French-speaking rollout** until A-01 and A-02 are closed:
sending a site lead, in French, to an English help page is a reliable
way to lose a user that no amount of engineering quality can win back
afterwards.

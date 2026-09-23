# 38 · Meridian IT-PMO — User manual

**Version 5.18.0 · 2026-09-23 · English.** The same manual exists in
French: [`39-manuel-utilisateur.md`](39-manuel-utilisateur.md). The
interface speaks English, French, and Spanish (marked *draft*). The
button next to your name shows the code of the language it will switch
to next: **FR** in English, **ES** in French, **EN** in Spanish.

**Where the living manual is.** The adoption committee ruled that "one
more Markdown file in docs/" would never be read on a mine site, so the
product carries its own guide. Press **?** in the header: **Help** holds
*Start here — what this account is for* and *Using Meridian — first steps
and answers*, organised by task, with a first-steps list for your role.
This document is the written companion. It is for someone evaluating
Meridian without an account, for training material, and for reading a
workflow end to end before doing it. When the two disagree, trust the
one inside the product.

This edition was rewritten from the 5.3.0 text of 31/08 (reviewed by the
committee in [`40-comite-revue-documentation.md`](40-comite-revue-documentation.md)).
It describes the 5.18.0 release (5.17.0 with the C-04 product fixes —
the tree it ships in). Every procedure was walked on 23/09 against a seeded
book of that tree, through the screens where it could be and through
the API where the screen does not carry it. Where a procedure **does not
work**, this manual says so at that point, with its identifier (NEW-nn) in the register of
[`36-convergence.md`](36-convergence.md), rather than describing the
intended behaviour. The list is also in
[`37-technical-reference.md` §10](37-technical-reference.md).

---

## 1 · What Meridian is

Meridian is a self-hosted project portfolio management system for a
group that runs several sites. It covers the whole life of a portfolio:

- demand and prioritisation;
- earned value and critical path;
- stage gates on your own gate ladder, with verified evidence and
  acceptance criteria;
- risks with dated reviews, and change control;
- resources with rotations and absences;
- a multi-currency ledger;
- the business case, benefits and a value page;
- tolerances with automatic exceptions;
- a decision register and a lessons register;
- stakeholders and a communication plan;
- the weekly and monthly meetings that run on top of it all, generated
  from the portfolio.

Four ideas shape everything you will touch:

- **Authority is data.** Your role, your grants and each project's
  governance level decide what you may do, in one place, on the server.
  When a button is absent, the screen usually says why in a plain
  sentence.
- **The record cannot be rewritten.** Every change is audited with its
  before and after. Closed meetings and closed reporting periods are
  frozen, and a correction is a new, visible act.
- **The meeting is generated.** You do not write agendas; the portfolio
  does. You record what was decided, and it lands back on the projects.
- **Unmeasured is not green.** A project with no budget, or with too
  little of its plan spent, shows **Not measured** (a grey dot, SPI and
  CPI "—"). It is never shown as 1.00 and green.

### 1.1 · The description, in five languages

> **English**: Meridian is free, self-hosted project portfolio
> management for multi-site organisations: earned value, stage gates
> with verified evidence, risk and change control, resource capacity,
> business case and benefits, tolerances, and governance meetings
> generated from the portfolio itself. Every change is audited and
> history cannot be rewritten. No vendor, no telemetry, no account to
> create.

> **Français** : Meridian est un outil libre et auto-hébergé de gestion
> de portefeuille de projets pour les organisations multi-sites :
> valeur acquise, jalons de contrôle avec preuve vérifiée, maîtrise des
> risques et des changements, capacité des ressources, cas d'affaire et
> bénéfices, tolérances, et réunions de gouvernance engendrées depuis le
> portefeuille lui-même. Chaque modification est auditée et
> l'historique ne peut pas être réécrit. Sans éditeur, sans télémétrie,
> sans compte à créer.

> **Português**: O Meridian é uma ferramenta livre e auto-hospedada de
> gestão de portefólio de projetos para organizações com vários sítios:
> valor agregado, marcos com evidência verificada, gestão de riscos e
> de mudanças, capacidade de recursos, caso de negócio e benefícios,
> tolerâncias e reuniões de governança geradas a partir do próprio
> portefólio. Cada alteração é auditada e o histórico não pode ser
> reescrito. Sem fornecedor, sem telemetria, sem conta a criar.
> *(Interface em inglês, francês e espanhol — este em rascunho.)*

> **Español**: Meridian es una herramienta libre y autoalojada de
> gestión de cartera de proyectos para organizaciones con varios
> sitios: valor ganado, hitos con evidencia verificada, control de
> riesgos y de cambios, capacidad de recursos, caso de negocio y
> beneficios, tolerancias y reuniones de gobernanza generadas desde la
> propia cartera. Cada cambio queda auditado y el historial no puede
> reescribirse. Sin proveedor, sin telemetría, sin cuenta que crear.
> *(Interfaz en inglés, francés y español — este último en borrador.)*

> **Deutsch**: Meridian ist ein freies, selbst gehostetes
> Projektportfolio-Management für Organisationen mit mehreren
> Standorten: Earned Value, Meilensteine mit geprüften Nachweisen,
> Risiko- und Änderungssteuerung, Ressourcenkapazität, Business Case und
> Nutzen, Toleranzen und Gremiensitzungen, die aus dem Portfolio selbst
> erzeugt werden. Jede Änderung wird auditiert; die Historie kann nicht
> umgeschrieben werden. Kein Anbieter, keine Telemetrie, kein Konto
> nötig. *(Oberfläche auf Englisch, Französisch und Spanisch — Spanisch
> als Entwurf.)*

---

## 2 · Signing in, and your first quarter of an hour

Open the address your administrator gives you. A fresh local install is
`http://localhost:4173`. On a demonstration instance the sign-in screen
lists the ten seeded accounts, and clicking a name fills in the address.
The passwords are in the README.

**If an administrator created your account**, the server refuses every
write until you choose your own password. The refusal reads "Choose your
own password first — until you do, the trail cannot say this was you".
From that moment on, the audit trail attributes actions to a person that
only that person can be.

> **Known defect (NEW-06).** The dialog that should ask for the new
> password ("Choose your own password", with "The password you were
> given" and "Your new password (8+ characters)") **does not open** in
> the browser. The start-up data omits the flag it waits for. You land on
> the portfolio, and every write you attempt is refused with the sentence
> above. Until this is fixed, the password is changed through the API
> (`POST /api/auth/password` with `current` and `next`), or the
> administrator creates the account and hands over a password that you
> change that way. Walked on 23/09: the API path works; the dialog never
> appeared.

**Start here.** On your first sign-in, a page titled *Start here*
(*Welcome to Meridian*) says in three lines what your account is for. You
can reopen it at any time from Help.

**Language.** The language button next to your name switches the
interface. The language of the messages Meridian sends you is a separate
setting. It lives in *Notification preferences* (the envelope button),
as *Language of my emails*, and defaults to *Follow the interface*.

**First steps.** Open Help (**?**), then *Using Meridian — first steps
and answers*, then **First steps**. You will find a list for your role:
choose your password, find *My week*, update a stage, raise a risk… Items
tick when the book carries the corresponding data (or, for find-your-way
steps, once you have opened the screen), not because you clicked them.

**Where things are.** The navigation has five groups. Entries your
account has no use for are absent: a viewer never sees Administration, a
site account sees *My site* and not *Programmes*.

| Group | Screens |
|---|---|
| **Deliver** | My week · Notifications · Portfolio · Roadmap · Pipeline · Programmes · My site · Project overview · Schedule · Board |
| **Control** | Risks & issues · Budget & cost · Change requests · Resources |
| **Govern** | Meetings |
| **Record** | Documents · Reports · Lessons · Locations · Adoption |
| **System** | Administration |

**My week** is everyone's landing page. It shows what is owed *by you*:
your actions, your risks and issues, what falls due in the next
fortnight, and your projects. If you are named as someone's deputy, it
also offers "Cover for them".

---

## 3 · Understanding what you may do, and why

There are four roles. The identifiers below are what Administration
shows.

| Role | In short |
|---|---|
| **admin** | Everything, including accounts, grants and settings. May sign a change request it raised — a break-glass, and each such signature is marked in the audit trail. Like everyone, it signs at most one step of a change chain: each step is signed by a different person. Keep admin accounts few, and run the portfolio from named group and site accounts. |
| **group** | Reads the whole portfolio and writes inside the programmes granted to them. The governance role: books cost, decides changes above the threshold, approves site gate evidence, sets tolerances, writes the business case, closes periods and sets the prioritisation weighting. |
| **site** | Reads their sites plus the group projects delivered there. Writes only **site-governed** projects in their granted sites. |
| **viewer** | Reads their scope and writes nothing, ever. |

Every project is governed at **group** or at **site** level. That single
fact decides who may edit it, re-baseline it, book money against it, or
approve its gate evidence. It does not matter who created the project or
where it runs.

Two consequences you will meet daily:

- **On a group-governed project delivered at your site, your controls
  are read-only**, and the refusal says so ("this is a group-governed
  project — site level is read-only here; raise a concern on it…"). Your
  voice is the **concern**. On *My site*, under *Landing on your site*,
  each group project has a **Raise concern** button. The concern appears,
  named as your site's, where the programme office will see it.
- **You never decide your own act.** The raiser of a change does not
  approve it. The owner of a document does not approve it as evidence.
  The owner of the evidence a criterion cites does not find it met. A
  site does not set its own tolerance or write its own business case.
  Where you expect a button and see none, this separation is usually why.

A refusal always states its reason, in your language. There are no
silent failures.

---

## 4 · Everyday work: projects and delivery

### Creating a project

There are two doors:

- **Pipeline.** Raise a request and have it approved, then convert it
  with "Make it a project". This is the normal route, because it keeps
  the trail from idea to project, and conversion also writes the
  project's first **business case** in the requester's own words.
- **New project.** This action sits on Portfolio, Programmes, My site
  and Schedule. A group account creates projects in its granted
  programmes; a site account creates a **site-governed** project in its
  granted sites. The button appears whenever the account may create a
  project somewhere in the book. Walked on 23/09: `g.silva` (site, São
  Paulo) and `p.marchetti` (group, Digital Channels) both see it.

The dialog asks for the project name, programme, lead site, governance,
project manager, delivery method, start, planned finish ("The date is"
a commitment or a placeholder, "Dated after" a condition), budget and
contingency, what it delivers, the sponsor and the acceptance criteria.
The programme and lead site default to the first ones in the list: a
site lead picks their own site, or the save is refused ("site is outside
your grant"). Walked on 23/09: `g.silva` created a Digital Channels
project at São Paulo from the dialog.

A new project takes its programme's **gate ladder** (§5), with its gate
milestones, their evidence documents and, when the ladder declares them,
their criteria. Its finish can be a **placeholder** waiting on a named
condition rather than a committed date (see *Dates* below). Right after
creation, if the register holds adopted lessons from the same programme
or site, a **Before you plan** dialog offers them ("Open the register",
"Noted"), at the one moment they can still change the plan. Walked on
23/09: once a São Paulo lesson had been adopted, the next project created
there opened with it. With no relevant lesson, no dialog appears.

### The project page

*Project overview* is the working surface. Pick a project and its
registers are on one page:

- milestones and gates, with the criteria of each gate;
- the business case;
- value (benefits and the post-implementation review);
- "The margin this project works inside" (tolerance and exceptions);
- stakeholders and the communication plan;
- plant and rollout;
- the stage plan;
- open RAID, the team, the cost position, and SDP operations.

Folded sections carry a summary of what they hold, such as "Business
case — none written".

Header actions include "Raise change", "Edit project", "Copy status" (a
Markdown summary for e-mail or chat) and "Evidence pack" (everything on
the record for the project, as at a date you choose, downloaded as
Markdown). They also include "Set status", "Re-baseline" and "Advance
phase". Each appears only when your account may use it.

### Progress, and what the indices mean

Update each stage's percentage in the **Stage plan**. Earned value is
computed from stage weights. The **Board** tracks work items and WIP
limits; moving a card does not report stage progress.

- **SPI** is schedule performance: below 1.0, you are late for the work
  done.
- **CPI** is cost performance: below 1.0, you are over cost for the work
  done.
- **EAC / VAC** show where the cost lands if performance holds.

Amber is at 0.95 and red at 0.90 by default (Administration →
Thresholds).

The fourth state is **Not measured**. It means one of two things, and
the dot says which when you hover it:

- "Too early to measure — less than 2% of the plan has been spent": the
  project has a budget, but less than 2% of the plan is scheduled or
  less than 0.5% of it is booked.
- "Nothing measured — no budget, so there is no scale to measure
  against": the project has no budget.

In both cases SPI and CPI show "—". "Not measured" is an answer, not a
gap, and it is never green.

Health is computed, but a project manager may override it with a written
reason. "Set status" opens *Set project status*:

1. **Status source**: *Set by the project manager*, or *Derived from SPI
   and CPI*.
2. **Manual status**: Green, Amber or Red.
3. **Reason for the call**: required for a manual status. Say what was
   decided, not that a call happened.

The reason then travels with the dot. Choosing *Derived from SPI and
CPI* removes the override. Walked on 23/09 as `g.silva` on PRJ-136: a
manual Amber with its reason was stored, and returning to the derived
status cleared it.

### Dates: committed or placeholder

A milestone's date is either **a commitment** or **a placeholder — no
calendar date yet**. The dialog field is "The date is". A placeholder is
dated after a named condition, the "Dated after" field (for example "the
capacity model at gate C"). A placeholder is drawn where it sits, but it
is never reported missed or overdue, and its gate reads **Unscheduled**.
Make it a commitment once the condition has been measured. A project's
finish can be a placeholder in the same way.

### Schedule and dependencies

Stages have dates, baseline dates and finish-to-start links, and the
critical path and float are computed. A stage that bites more than five
days deeper into its predecessor than the baseline allowed is flagged on
**Schedule**. The same rule applies to the links between projects
("Cross-project links") on the master schedule, and the banner counts
both kinds of breach. **Re-baselining is a group act.**

### Risks, issues, and the RAID register

Anything that could cost time or money belongs on **Risks & issues**
before it does ("Raise item"). It can be a risk, an issue, an assumption
or a dependency. Probability × impact (1–5 each) places it in a band, and
high exposure escalates onto steering agendas by itself. You can also
record:

- a residual target (the P×I the response aims at);
- a free **Category** in your own words;
- a link to a gate ("Against gate") or to a change request;
- the **Next review** date.

Closing an item ("Close item") records when and by whom.
Portfolio-wide items are kept by group.

**Reviews are events.** A review performed is its own dated record,
with who reviewed, a note, and the next review date, and the item's next
review date follows the latest one. The meeting agenda lists "Register
items due for review" when that date comes.

> **In 5.18.0, recording a review has no button.** It is done through the
> API (`POST /api/raid/<id>/reviews` with `on`, `next`, `by`, `note` and
> the item's `version`). Walked on 23/09: recorded, and the item's next
> review moved.

### Change requests

Raise from the project ("Raise change") or from **Change requests**,
stating what changes, the cost impact, the schedule impact in weeks, the
funding source and the reason. Every request runs the same four steps:
project manager, change authority, finance, steering committee.

The **CCB threshold** decides *who may sign*: above it, in cost or
weeks, only a group account may. It does not shorten the chain.
**Approval applies the deltas** to budget, dates and contingency. You
cannot approve what you raised, whether the rule compares the person or
the account.

Walked on 23/09: a site lead raised a request, was refused on step 1,
and a group account signed all four steps. The request read *Approved*.

### Money

**Budget & cost** carries the ledger. "Book cost" is a group act. A cost
line has a period, an amount, capex/opex, a currency and the FX rate as
booked. A draw on contingency must name the open risk it answers. A
mistake is corrected by a **reversing line**, never an edit, so the
ledger always reconciles.

**Commitments** ("Raise a commitment") are money promised but not yet
booked. Each carries a purchase-order reference, a supplier and a status.

### People, capacity, actuals, absences

**Resources** buckets allocations into weeks ("Assign person"). A
person's effective capacity is their **availability** percentage.
Rotation ("4/2", "14/14") is recorded in the directory for the planner,
not folded into the arithmetic.

**Record effort** is deliberately minimal: person, project, a day of the
week, days spent. It sits *beside* the plan, and the gap is the point.

**Absences** are declared under *My site* → "Absences & cover" →
"Declare". Each names who covers. The deputy signs in as themselves and,
from *My week*, chooses "Cover for them". They then act *for* the absent
person, within that person's authority and never more, and the trail
names both. "Stop covering" ends it.

### Stakeholders and the communication plan

On the project page:

- "Stakeholder" (dialog *Name a stakeholder*) records a person from the
  directory or an organisation, with interest and influence (1–5),
  attitude, engagement and who holds the relationship.
- "Audience" (dialog *Plan a communication*) records who hears what, by
  which channel, how often, from whom, and when next.

Walked on 23/09 as a site lead on their own project.

---

## 5 · Governance work

### Gates, the gate ladder, and criteria

**The ladder.** A programme may declare its own gate ladder of up to
**twelve** gates. Without one, a project walks the default four: *Gate 1
— Mandate*, *Gate 2 — Design authority*, *Gate 3 — Readiness*, *Gate 4 —
Benefits*. The interface shows gate names as they are declared and does
not translate them.

The ladder is declared in Administration → Programmes → *Gate ladder*,
one gate per line:

    name | owner | evidence, comma separated | position in the project window %

A project takes its ladder when it is **created**. Changing the ladder
later does not rewrite existing projects, because dated gates and filed
evidence must not move under the people who filed them. To move one
project onto its programme's current ladder, a group account opens the
project: when its ladder differs from its programme's, the gate panel
says so and offers "See what this would do". That opens **Move onto the
programme's ladder**, which shows what will be adopted, created and
retired before anything moves. A retired gate becomes an ordinary
milestone and keeps its date, acceptance and evidence.

**Loops and scopes.** A gate may **loop back** to an earlier one (a
review that sends the work back to the brief), and a gate may be
**scoped** to the whole programme or portfolio. Such a gate clears only
when every project in scope carries its evidence and criteria. In
5.18.0:

- Loops and scopes can only be declared by the API or by importing a
  book. The one-line-per-gate text on the screen carries neither.

  > **Known defect (NEW-10).** Saving a ladder from the screen **drops**
  > any loop or scope it held.
- No button moves a project onto its next turn of a loop.

**Evidence.** A gate cannot be advanced ("Advance phase") until its
evidence documents are **Approved**. Approving is a distinct power from
editing:

- The document must point at an https link on a **trusted document
  host**.
- The link is fingerprinted at approval. Changing it afterwards drops
  the document back to *In review*.
- The owner never approves their own document.
- Gate evidence on a site project is approved by group.

A background probe re-checks approved links and flags the ones that stop
answering, but it never un-approves anything. A gate with nothing
attached says so: "No evidence has been registered for …".

The trusted hosts are set by an administrator in Administration →
*Evidence* → "Trusted evidence hosts", comma separated. The list is
closed by default: with none named, no document can be approved as
evidence. The demonstration book ships with `docs.meridian.example`.
Walked on 23/09: a link on another host was refused ("… which is not a
trusted document host"), a link on the trusted host was approved, and a
second host added from the Administration field was stored.

**Criteria.** On a gate, "Criterion" (dialog *Pose a criterion*) states
in advance what must be true for the gate to pass. A criterion is then
**Found met** by a named reviewer, the "Reviewed by" field. The reviewer
may not be the owner of the evidence the criterion cites. A gate with
criteria is ready only when its evidence is approved **and** every
criterion is met. Walked on 23/09:

1. Advance was refused ("1 evidence item outstanding for Gate 1 —
   Mandate").
2. The charter was approved on the trusted host.
3. The criterion was found met by a named reviewer.
4. The phase advanced to Design.

**Vetoes.** If the book carries governance seats with a veto (imported,
see §8), an open objection from such a seat blocks the gate before
evidence is even counted, and the refusal names the seat.

### Demand and prioritisation

**Pipeline** is the funnel. Anyone who can write may **raise** a request
("Raise a request"). **Deciding** is group work, and a decline records
its reason like any decision. An approved request becomes a project with
"Make it a project", and the trail and the business case come with it.

"Set the envelope" sets the capital envelope, and **The capital queue**
shows what fits the money.

**Value and risk against capacity** is the portfolio prioritisation. It
scores live projects and open requests on four inputs: claimed
value, confidence, RAID exposure and capacity consumed. The weighting defaults to 40/20/20/20,
and the group sets it with "Set the weighting", with a written reason.
The screen draws the line where the people run out. A row missing an
input says which one. The score ranks; it never decides.

### Tolerances and exceptions

A group account sets each project's margin with "Set a margin":

- days past the baseline;
- % over budget;
- points below the benefit target;
- scope, quality and risk, *in words*.

An hourly sweep then watches the same numbers the screens show. A breach
**raises an exception by itself**. "Check now" asks for the sweep at once.
An exception closes only by an answer from the level that set the
margin: *Tolerance raised*, *Plan revised*, *Accepted* or *Stopped*.
Walked on 23/09: a tight margin on PRJ-101, then "Check now", opened two
exceptions (schedule and cost), and one was answered *Accepted*.

Whoever set the margin is told: a *tolerance breached* message ("… has
gone past the tolerance you set") lands in their Notification centre.
Walked on 23/09: two exceptions opened, and two such messages were
queued.

### Business case, benefits, and the value page

**The business case** ("Write the business case", group) says why the
project exists, its expected cost and benefit, and what the numbers rest
on. It is **reconfirmed at every gate** in the dialog *Is it still worth
doing?*, with the verdict:

- *Continue — it still holds*;
- *Continue, with conditions*;
- *Stop — it is no longer worth doing*.

The reconfirmer is named, and the figures are kept as they stood. A gate
on a project with a case is refused until the case has been reconfirmed
at that gate, and a *Stop* refuses the next one.

**Benefits** ("Benefit", dialog *State a benefit*) live in their own
units, such as tonnes, hours or cost per ounce, with baseline, target and
measured actual. The project records what was measured, and whether that
counts as met is a group verdict. A benefit whose "Realised by" date has
passed unmeasured raises an exception. The single
**post-implementation review** is recorded from the same section.

**The value page** is Reports → *What it was worth*. It shows six
figures, read from the book and never typed:

1. spend against case;
2. benefits by status;
3. benefit reviews overdue;
4. top risk exposure;
5. gates due;
6. exceptions open.

No figure carries a colour. *Exceptions open* reads "—" on a book with no
tolerance set, and does not claim "0 open". "Print this page" gives an A4
board pack. "Store this page" (group) files it against a closed reporting
period, to be read back unchanged later.

### Governance signals

Portfolio → *Governance signals* shows five clocks the book already
keeps: decision latency, action ageing, gate cycle time, RAID review
compliance and exception age. Nothing is typed for them. When there is
nothing to measure, each says so in a sentence rather than showing a
number.

### Decisions

Every decision lands in one **Decision register** (Reports), whether it
was taken in a meeting or outside one. For a decision taken outside a
meeting, use "Record a decision":

- the decision, one sentence in the past tense;
- the project, or "Portfolio-wide (group level)";
- "Decided by" (a person) or "Deciding body" (a committee);
- the date;
- **Status**: *Ratified*, or *Proposed — awaiting ratification*;
- optionally, the record of the decision (a link, a repository path or
  a commit), provenance, why, alternatives considered, dissent, the
  register item, gate or change it concerns, and the decision it
  supersedes.

A decision is never edited or deleted. A change of mind is a new
decision naming the one it supersedes.

> **In 5.18.0:** a *Proposed* decision **cannot be ratified from any
> screen** (REQ-50). Ratification exists only on the integration path
> (`PUT /api/v1/decisions`), where the ratifier must be a named person
> other than the decider and the recording account. Conversely, the
> screen route accepts a *Ratified* status with a free-text ratifier and
> no independence check (REQ-49, open). Both were walked on 23/09.

### Lessons

Whoever lived it records it with "Record a lesson": what happened, why,
and what to do differently, in one of the eleven ISO 21502 categories,
positive outcomes included. **Adopting** a lesson is a group act, and
adoption is what makes it visible to the other sites. The **Lessons**
register filters by category and status.

### Reporting, and the period close

**Reports** shows the live weekly or monthly pack, with narratives
editable in place and kept week to week. To govern rather than run, use
**Close the period** (group). Closing freezes what was reported, project
by project, so the number the board saw in March can be reproduced in
June. A closed period cannot be edited, because the database refuses.
From 5.13.0, a project that was *Not measured* is frozen as *Not
measured*, never as green. A correction is a new period that
**restates** the one it corrects.

---

## 6 · Meetings

The module the rest exists for. A **series** has a cadence (weekly or
monthly on the screen) and a scope (group, programme or site). Each run
is an **occurrence**. Walked on 23/09 on the São Paulo site call.

1. **Open the meeting.** The agenda is generated *now*, from live state.
   Weekly series get an exception-only agenda. Monthly series get the
   full steering pack. Sections with nothing in them are dropped, except
   *Actions carried forward*, which always appears. Other sections
   include "Referred from delivery calls", "Projects off track",
   "Decisions requested", "Register items due for review" and "Next up".
2. **Run it.** Take attendance: present, apologies, absent, deputy, or
   observer (voice without vote). "Record a decision": say *what was
   decided*, not that a decision happened. The same decision twice in the
   same meeting is refused. "Raise an action", with an owner and a date.
3. **Refer upward.** A decision beyond the room's authority is recorded
   with "Refer upward" (to the programme board or the group steering
   committee). It headlines the broader series' next agenda until a
   decision there answers it. Walked: a São Paulo referral appeared under
   "Referred from delivery calls" on the Digital Channels agenda.
4. **Close the meeting.** The agenda as discussed is frozen and the
   decisions become final. A decision added afterwards is refused ("This
   meeting is closed — its decisions are final"). Open actions chase
   their owner onto every later agenda. "Minutes" (Markdown), "Meeting
   pack" and the calendar entry (ICS, for the occurrence or the series)
   are one click each.

Series with a *per-gate* or *ad hoc* cadence exist in the data model.
In 5.18.0 they arrive only by import; the screen creates weekly and
monthly series.

---

## 7 · Notifications

The **Notification centre** (Deliver → Notifications) is your inbox.
Everything addressed to you lands there, always, with read and acted
state.

**What Meridian tells you**, eleven kinds in all:

- an action falling due, or overdue (to its owner);
- a gate blocked at its milestone;
- a referred decision still unanswered (to whoever chairs the room it
  was referred to);
- a concern a site raised on a group project (to that project's
  manager);
- a site quiet for thirty days (to its champion);
- a week of effort not recorded (to the person, never their manager);
- an approved evidence link that stopped answering;
- a tolerance breached (to whoever set the margin);
- a benefit past its date and not measured (to its owner);
- the digest, for accounts on a daily or weekly cadence.

Measured on 23/09 on the demonstration book: one sweep queued
*timesheet missing*, *gate blocked*, *tolerance breached* and *action
overdue* messages; the other kinds need events the seed does not hold.

**Notification preferences** (the envelope button next to your name):

- *Language of my emails*: *Follow the interface*, Français or English;
- *Cadence*: *As things happen*, *Daily*, *Weekly*, *Nothing by email*;
- **quiet hours**, "Quiet from (hour)" and "Quiet until (hour)", read in
  your site's timezone: nothing is lost, messages wait for morning, and
  urgent passes. Set both ends or neither;
- **Fine-grained subscriptions**: kind (or *Everything*) × scope
  (*Whole portfolio*, a programme, a site, one project) × minimum
  severity × cadence, added with "Add" and removed with "Remove". With
  none, the cadence governs everything; with any, only what a
  subscription covers goes out, and the centre always receives
  everything.

Walked on 23/09: the dialog shows all four; a site-scoped subscription
and quiet hours 20:00–07:00 were saved.

> **Known defect (NEW-13).** Messages are written in English or French
> only. Spanish cannot be chosen for your messages (the server refuses
> it: "Locale is en, fr or empty"), and any language other than French
> is composed in English.

Messages leave the building only through an outbound webhook an
administrator configures: a Teams webhook, or a generic HTTPS one. The
destination host must be listed in "Trusted webhook hosts", which is
closed by default. Until then, Administration → Notifications shows the
queue of exactly what would have been sent, and says whether an outbound
webhook is configured. No mail client is carried; the webhooks are the
transport.

---

## 8 · Administration (admin role)

Everything is under **System → Administration**:

- **Accounts and grants.** Create an account with at least one grant
  for a group or site account. Its first sign-in must change the
  password (see the defect in §2). Grant programmes or sites one by one,
  and deactivate. The day-one banner lists the demonstration accounts
  still opened by their published password. A production start refuses
  while any remains.

  > **Known defect (NEW-11).** The same banner says "no mail transport —
  > notifications queue and do not send" whenever `MERIDIAN_SMTP_URL` is
  > unset, even when a webhook is configured. Read the Notifications
  > panel for the real state.
- **Reference data.** People (name, job role, site, day rate,
  **employment** — staff or contractor —, **supplier**, **rotation**
  such as "4/2" or "14/14", and **availability (%)**, which is the number
  the capacity arithmetic uses; walked on 23/09), sites
  (city, region, zone, country, legal entity, headcount), programmes
  (sponsor, manager and their **Gate ladder**), and board columns.
- **Bringing existing data in.** The CSV panel is titled *Reprise de
  l'existant* in every language (a defect, NEW-11). Choose the kind (projects,
  people, milestones) and download the template. Paste the CSV or pick a
  file, then use "Prévisualiser" (preview) to read line by line what
  will be created and what refused. "Appliquer" (apply) is all or
  nothing.
- **Whole-book import and export.** "Export book" writes the book as
  JSON with `"currencyUnit": "millions"`. "Import book" **replaces** the
  book with a file. A file without `currencyUnit` is refused. A book
  exported before 5.17.0 needs `"currencyUnit": "millions"` added to its
  header. The same import, called through the API, also offers a **dry
  run** (`?dryRun=1`, which validates and writes nothing) and a **merge**
  (`?mode=merge`, which updates by identifier instead of replacing). The
  screen offers neither.
  - Walked on 23/09: the dry run of the product's own export answered
    200.
  - *Known defect (NEW-07):* the merge dry run of that same export
    answers 400 ("That record already exists — change_step …").
- **Registers that are import-only.** Requirements, non-document
  evidence, review findings, governance seats (with vetoes and
  incompatibilities) and objections on decisions have **no screen and
  no write route** in 5.18.0. They enter only with an imported book.
  They are kept, exported and enforced: an open veto blocks a gate. But
  nobody can type one in yet.
- **Settings.** RAG thresholds, the steering (CCB) threshold, the
  instance identifier, organisation name, status date, reporting
  cadence, notification retention (the purge refuses to run until a
  duration is decided), escalation and weekly cap, trusted webhook
  hosts, and **Evidence** → "Trusted evidence hosts" (see §5). The
  capital envelope is set from the Pipeline.
- **Connected systems.** Issue a named, scoped API key per integration.
  It is shown once and stored only as a fingerprint. You can change its
  scopes, rotate it or revoke it. The scopes are `read:portfolio`,
  `read:audit`, `read:meetings`, `write:portfolio` and `write:meetings`.
  Every act a key performs is audited under its name. A key writes with
  its own identifiers and an optional `Idempotency-Key`, and never opens
  the interactive interface. Walked on 23/09:
  - a first write created the project (201);
  - the same key and body replayed it;
  - the same key with another body answered 422;
  - an unknown field answered 400;
  - the key on a session route answered 401.
  The SDP federation is configured here as well.
- **Audit.** The full trail, searchable, with before and after images.
  An administrator can re-create a **deleted** register row from its
  audit image. Edits are not rolled back.
- **Continuity.** "Export the archive" (`npm run restore` reloads it
  into an empty instance: the exit door, always open) and "End every
  session", which signs out every account, yours included. For backups,
  see [`34-exploitation.md`](34-exploitation.md): `npm run backup`, then
  `npm run restore-drill`, which restores the newest backup elsewhere,
  recounts every table, and records the proof that `/api/health`
  reports. Walked on 23/09: backup taken, restored in 1.1 s, every table
  matched.
- **Adoption** (a screen of its own, admin and group): per-site usage.
  These are counts, never surveillance.

Operating Meridian (from source, on PostgreSQL, or as the Windows
service) is covered in [`37-technical-reference.md` §8](37-technical-reference.md)
and [`34-exploitation.md`](34-exploitation.md). The security posture, and
what remains yours to close, is in [`SECURITY.md`](../SECURITY.md).

---

## 9 · Practice, help, and getting unstuck

- **The training ground.** `npm run training` starts a separate practice
  book on `:4180`. It never touches the real one and resets on demand.
  Break things on purpose.
- **Help, in-app.** Press **?**: the manual by task, the field help on
  every form, and your role's first steps.
- **Your site champion.** Every site names one person to call first.
- **"Someone else changed this record — reload and try again".** Two
  people edited the same row, and Meridian refuses the silent overwrite.
  Reload, read the fresh state, and make your change again.
- **A button is missing.** Read the sentence where it would be. It names
  the authority you lack or the separation of duties in play. One
  control is missing because of a defect, not authority: the password
  dialog (§2, NEW-06).
- **Sign-in loops on a LAN install.** The instance is sending Secure
  cookies without HTTPS. The administrator unsets
  `MERIDIAN_SECURE_COOKIES`.
- **"This book does not declare what its money means".** Add
  `"currencyUnit": "millions"` (or `"units"`) to the file you are
  importing.

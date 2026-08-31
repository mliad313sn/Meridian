# Meridian IT-PMO — User manual

**Version 5.3.0 · 2026-08-31 · English.** The same manual exists in
French: [`31-manuel-utilisateur.md`](31-manuel-utilisateur.md). The
interface itself speaks both languages — switch at any time from the
menu under your name.

A note on where the *living* manual is: the adoption committee ruled
that "one more Markdown file in docs/" would never be read on a mine
site, so the product carries its own guide — **Help, inside the
application**, organised by task, with first-steps checklists that tick
themselves as your real data arrives. This document is the *written*
companion: for the person evaluating Meridian without an account yet,
for training material, and for reading a workflow end to end before
doing it. When the two disagree, trust the one inside the product — it
is generated against the running version.

---

## 1 · What Meridian is

Meridian is a self-hosted project portfolio management system for a
group that runs several sites. It covers the portfolio's whole life:
demand intake and capital prioritisation, earned value and critical
path, stage gates with verified evidence, risks and change control,
resource capacity with rotations and absences, a multi-currency cost
ledger, benefits realisation, tolerances with automatic exceptions, a
lessons register — and the weekly and monthly meetings that run on top,
generated from the portfolio rather than typed into a deck.

Three ideas shape everything you will touch:

- **Authority is data.** What you may do is decided by your role, your
  grants, and each project's governance level — in one place, on the
  server. When a button is absent, the screen says why in a plain
  sentence.
- **The record cannot be rewritten.** Every change is audited with its
  before and after; closed meetings and closed reporting periods are
  frozen. A correction is a new, visible act — never an edit.
- **The meeting is generated.** You do not write agendas; the portfolio
  does. You record what was decided, and it lands back on the projects.

### 1.1 · The description, in five languages

The interface is available in **English** and **French**. For sites and
sponsors reading in other languages:

> **English** — Meridian is free, self-hosted project portfolio
> management for multi-site organisations: earned value, stage gates
> with verified evidence, risk and change control, resource capacity,
> benefits, tolerances, and governance meetings generated from the
> portfolio itself. Every change is audited and history cannot be
> rewritten. No vendor, no telemetry, no account to create.

> **Français** — Meridian est un outil libre et auto-hébergé de gestion
> de portefeuille de projets pour les organisations multi-sites :
> valeur acquise, jalons avec preuve vérifiée, maîtrise des risques et
> des changements, capacité des ressources, bénéfices, tolérances, et
> réunions de gouvernance engendrées depuis le portefeuille lui-même.
> Chaque modification est auditée et l'historique ne peut pas être
> réécrit. Sans éditeur, sans télémétrie, sans compte à créer.

> **Português** — O Meridian é uma ferramenta livre e auto-hospedada de
> gestão de portefólio de projetos para organizações com vários sítios:
> valor agregado, marcos com evidência verificada, gestão de riscos e
> de mudanças, capacidade de recursos, benefícios, tolerâncias e
> reuniões de governança geradas a partir do próprio portefólio. Cada
> alteração é auditada e o histórico não pode ser reescrito. Sem
> fornecedor, sem telemetria, sem conta a criar. *(Interface em inglês
> e francês.)*

> **Español** — Meridian es una herramienta libre y autoalojada de
> gestión de cartera de proyectos para organizaciones con varios
> sitios: valor ganado, hitos con evidencia verificada, control de
> riesgos y de cambios, capacidad de recursos, beneficios, tolerancias
> y reuniones de gobernanza generadas desde la propia cartera. Cada
> cambio queda auditado y el historial no puede reescribirse. Sin
> proveedor, sin telemetría, sin cuenta que crear. *(Interfaz en inglés
> y francés.)*

> **Deutsch** — Meridian ist ein freies, selbst gehostetes
> Projektportfolio-Management für Organisationen mit mehreren
> Standorten: Earned Value, Meilensteine mit geprüften Nachweisen,
> Risiko- und Änderungssteuerung, Ressourcenkapazität, Nutzen,
> Toleranzen und Gremiensitzungen, die aus dem Portfolio selbst erzeugt
> werden. Jede Änderung wird auditiert; die Historie kann nicht
> umgeschrieben werden. Kein Anbieter, keine Telemetrie, kein Konto
> nötig. *(Oberfläche auf Englisch und Französisch.)*

---

## 2 · Signing in, and your first quarter of an hour

Open the address your administrator gives you (a fresh local install is
`http://localhost:4173`). On a demonstration instance the sign-in
screen lists ten seeded accounts; clicking a name fills in the address
(the passwords are in the README).

**If an administrator created your account**, your first sign-in forces
you to choose your own password. Until you do, nothing can be written —
because from that moment on, the audit trail attributes actions to a
person only that person can be.

**Language** — the menu under your name switches English ↔ French. Your
choice also decides the language of the emails Meridian sends you.

**First steps** — open **Help**. You will find a checklist *for your
role* whose items tick themselves when the real work is done (not when
you click them): choose your password, find *My week*, update a stage,
raise a risk… It is the fastest honest tour of the product.

**Where things are** — the navigation has five groups:

| Group | Screens |
|---|---|
| **Deliver** | My week · Notifications · Portfolio · Roadmap · Pipeline · Programmes · My site · Project overview · Schedule · Board |
| **Control** | Risks & issues · Budget & cost · Change requests · Resources |
| **Govern** | Meetings |
| **Record** | Documents · Reports · Lessons · Locations · Adoption |
| **System** | Administration |

Entries your account has no use for are simply absent — a viewer never
sees Administration. **My week** is everyone's landing page: what is
owed *by you* — your actions, your projects turning amber, your week of
effort not yet entered.

---

## 3 · Understanding what you may do, and why

Four roles exist:

| Role | In short |
|---|---|
| **admin** | Everything, including accounts, grants and settings. |
| **group** | Reads the whole portfolio; writes inside the programmes granted to them. The governance role: decides changes, approves evidence, closes periods, sets tolerances. |
| **site** | Reads their sites plus the group projects delivered there; writes only **site-governed** projects in their granted sites. |
| **viewer** | Reads their scope. Writes nothing, ever. |

Every project is governed at **group** or at **site** level, and that
single fact — not who created it, not where it runs — decides who may
edit it, re-baseline it, book money against it, or approve its gate.

Two consequences you will meet daily:

- On a **group-governed project delivered at your site**, your controls
  are read-only, and the screen says so in a sentence. Your voice is
  the **concern**: raise one from *My site*, and it appears — named as
  your site's — on the programme office's next agenda.
- **You never decide your own act.** The raiser of a change does not
  approve it; the deliverer of a benefit does not rule it met; the
  owner of a document does not approve it as evidence; a site does not
  set its own tolerance. Where you expect a button and see none, this
  separation is usually why — and the sentence on screen says which.

If something is refused, the refusal always states its reason, in your
language. There are no silent failures.

---

## 4 · Everyday work — projects and delivery

### Creating a project

Two doors. **Pipeline** → convert an *approved* demand — the normal
route, because it keeps the trail from idea to project. Or
**Portfolio → New project** (group level) for a project decided
elsewhere. A project carries its programme, its lead site, its
governance level, method, dates, budget and contingency.

### The project page

*Project overview* is the working surface: pick a project and every
register about it is on one page — stage plan, milestones and gates,
RAID, changes, money, benefits, documents, waves, the margin it works
inside, linked operational items, and the lessons other projects left
for it. The **status snippet** button copies a Markdown summary for
email or chat; **everything on the record** shows the project as at any
date.

### Progress, and what the indices mean

Update each stage's percentage in the **stage plan** (or move the item
on the **Board**). The engine computes earned value from stage weights:

- **SPI** — schedule performance: below 1.0, late for the work done.
- **CPI** — cost performance: below 1.0, over cost for the work done.
- **EAC / VAC** — where the cost lands if performance holds.

Thresholds (amber at 0.95, red at 0.90 by default) colour the
portfolio. A project that has spent less than 2 % of its plan shows
"—": **too early to measure** is an answer, not a gap. Health is
computed (RAG) but can be **overridden by hand with a written reason**
— the reason travels with the dot everywhere it is shown.

### Schedule and dependencies

Stages have dates, baseline dates and finish-to-start links; the
critical path and each stage's float are computed on the project.
Cross-project dependencies are drawn on **Schedule** (the integrated
master schedule); a dependency landing later than its dependent
tolerates five days, then flags. **Re-baselining is a group act** — it
moves the dates the group committed to.

### Risks, issues, and the register (RAID)

Anything that could cost time or money belongs on **Risks & issues**
before it does. Probability × impact (1–5 each) bands the exposure;
high-exposure items escalate onto steering agendas by themselves.
Portfolio-wide items (a bench shortage that belongs to no project) are
allowed. Site-raised concerns carry the site's name.

### Change requests

Raise from the project or **Change requests**: what changes, cost
delta, weeks delta, funding source. The request routes itself into an
approval chain by size — below the CCB threshold one approver, above it
the full chain — and *approval applies the deltas* to budget, dates and
contingency. You cannot approve what you raised.

### Money

**Budget & cost** carries the ledger. A cost line has a period, an
amount, capex/opex, a currency and the FX rate *as booked*. A mistake
is corrected by a **reversing line**, never an edit — the ledger must
reconcile. **Commitments** (purchase orders raised, money promised but
not yet booked) are tracked separately and count against the envelope.
Booking cost and releasing contingency are group acts.

### People, capacity, actuals, absences

**Resources** buckets range-based allocations into weeks. A person's
*effective* capacity accounts for rotation ("4/2", "14/14") and
availability; contractors are marked as such. **Timesheets** are
deliberately minimal — person, project, week, days — and sit *beside*
the plan: the gap is the point. Declare **absences** with an optional
deputy: the deputy then signs in as themselves and *acts for* the
absent person, within that person's authority and never more; the
trail names both. Notifications sent to your deputy in your name are
listed for you when you return.

---

## 5 · Governance work

### Gates and evidence

Four gates punctuate a project: **Mandate, Design authority, Readiness,
Benefits** — each demanding named evidence documents. A gate cannot be
advanced until its evidence is **Approved**, and approving is a
distinct power from editing: the document must point (https) at a real
artefact on one of the **trusted hosts** the sponsor configured, the
link is fingerprinted at approval, and changing it afterwards drops the
document back to *In review*. A background probe re-checks approved
links and flags — after three consecutive failures — evidence that no
longer answers; the flag never un-approves anything, because a satellite
link that drops for a night is not a lost proof.

### Demand and prioritisation

**Pipeline** is the funnel: anyone who can write may **raise** a
demand; **deciding** — triage, approve, decline — is group work, and a
decline records its reason like any decision. Approved demands convert
to projects with the trail intact. Score fit, value, risk and effort
(1–5 each — a model a room can hold in its head), rank against the
**capital envelope**, and see which projects fit the money and which
fall below the line. The room may overrule the score by hand-placing
rank — the score ranks, it never decides.

### Tolerances and exceptions

A group user sets each project's **margin**: days past the baseline
finish, % over budget, points under benefit target — scope, quality and
risk are *stated in words*, not pretended to be computed. From then on
an hourly sweep watches the same numbers the screens show, and a breach
**raises an exception by itself** — nobody has to carry the bad news.
An exception closes only by an **answer** from the level that granted
the margin — *Tolerance raised, Plan revised, Accepted,* or *Stopped* —
never by the forecast drifting back inside.

### Benefits and the verdict

Each project's promises live as **benefits** in their own units —
tonnes, hours of availability, cost per ounce — with baseline, target
and measured actual. The project records what was measured; whether
that counts as **met** is a group verdict (`benefit review`), and the
project's single **post-implementation review** verdict is recorded the
same way.

### Lessons

Whoever lived it records it — what happened, why, what to do
differently, in one of the eleven ISO 21502 categories, positive
outcomes included. **Adopting** a lesson is a group act: adoption is
what makes it visible to the other sites, and new projects are shown
the adopted lessons relevant to their programme and site at the start.

### Reporting, and the period close

**Reports** shows the live weekly/monthly pack — narratives editable in
place and kept week to week. To govern rather than run, **close the
period**: closing freezes what was reported, project by project, so the
number the board saw in March can be reproduced in June. A closed
period cannot be edited — the database itself refuses. A correction is
a **restatement**: a new period naming the one it corrects, on the
record. The **digest** summarises what changed since you last looked —
sized to cover a rotation away from site.

---

## 6 · Meetings

The module the rest exists for. A **series** has a cadence and a scope
(group / programme / site); each run is an **occurrence**.

1. **Open** the occurrence. The agenda is generated *now*, from live
   state: weekly series get an exception-only agenda (nothing to say
   about a project means it is not on it), monthly series get the full
   steering pack — position, gates, money, benefits. Sections with
   nothing in them are dropped, never shown empty.
2. **Run it.** Take attendance (deputies recorded as such). Record
   **decisions** — say *what was decided*, not that a decision
   happened; it will be read back months later. Record **actions** with
   an owner and a date.
3. A decision beyond the room's authority is **referred up**: it
   headlines the broader series' next agenda until a decision there
   answers it. Actions from broader series land on narrower agendas
   tagged with their origin — tasking flows down visibly.
4. **Close** the occurrence. The agenda as discussed is frozen
   verbatim; decisions become immutable; open actions chase their owner
   onto every subsequent agenda until done. **Minutes** are one click,
   and the calendar entry (**ICS**) can be downloaded for the series or
   the occurrence.

---

## 7 · Notifications

Meridian goes out to find people rather than waiting to be visited: an
action falling due, a gate blocked, a decision owed, a concern raised,
a site quiet for thirty days, a week of effort missing, an approved
evidence link no longer answering, the digest.

The **Notification centre** (Deliver → Notifications) is your inbox:
everything addressed to you lands there, always, with read and acted
state. **Subscriptions** tune what goes *out* to you by email — by
kind, scope, minimum severity and cadence — and **quiet hours** hold
messages during your night, *in your site's timezone*; urgent pierces.
Email leaves the building only once an administrator configures SMTP;
until then the centre shows exactly what would have been sent.

---

## 8 · Administration (admin role)

Everything under **System → Administration**:

- **Accounts and grants** — create accounts (first sign-in forces a
  password change), grant programmes or sites one by one, deactivate,
  revoke all sessions. People, sites (with their windows, champions and
  readiness), programmes and board columns are edited here too.
- **Settings** — RAG thresholds, CCB threshold, capital envelope,
  trusted evidence hosts (**closed by default**: until hosts are named,
  nothing can be approved as evidence), notification retention (the
  purge refuses to run until a duration is decided), organisation name,
  status date.
- **Connected systems** — issue a named, scoped API key per integration
  (shown once, stored only as a fingerprint), change its scopes, rotate
  it, revoke it. Every act a key performs is audited under its name.
  The SDP federation (operational actions and changes linked, never
  copied) is configured here as well.
- **Audit** — the full trail, searchable, with before/after images; a
  damaged row can be restored *from* its audit image, which is itself
  an audited act.
- **Archive** — export everything; `npm run restore` reloads it into an
  empty instance. This is the exit door, and it is always open.
- **Adoption** — per-site usage: accounts seen, last progress, meetings
  held, actions closed, weeks entered. Counts, never surveillance.

Operational deployment — including the Windows `.exe` installer — is
[`29-technical-reference.md` §8](29-technical-reference.md); the
security posture and what remains yours to close is
[`SECURITY.md`](../SECURITY.md).

---

## 9 · Practice, help, and getting unstuck

- **Training instance** — `npm run training` starts a separate practice
  book on `:4180` that never touches the real one, and resets on
  demand. Learn by breaking things there.
- **Help, in-app** — the manual by task, the field help on every form,
  and your role's first-steps list.
- **Your site champion** — every site names one person to call first;
  Help shows their name before suggesting the group.
- **"Somebody else changed this"** — two people edited the same row;
  Meridian refuses the silent overwrite. Re-open the item, read the
  fresh state, make your change again.
- **A button is missing** — read the sentence where it would be: it
  names the authority you lack or the separation of duties in play.
- **Sign-in loops on a LAN install** — the instance is sending Secure
  cookies without HTTPS; the administrator unsets
  `MERIDIAN_SECURE_COOKIES`. See the technical reference.

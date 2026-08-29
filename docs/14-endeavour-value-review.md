# The Endeavour committee — can Meridian govern the group, and is it worth having?

Date: 2026-08-29 · Convened after the production book was cleared: one
administrator account, no projects, no sites, no people. Everything below
is judged against the working system, not a demo.

The committee was asked two questions and answered them separately,
because they have different answers:

1. **Can Meridian govern and track projects and the roadmap at group and
   site level?** Largely yes, and in one respect better than anything on
   the market.
2. **Does it bring real value to the business?** Not yet — and the reason
   is structural, not cosmetic. Meridian can prove a project was *run
   well*. It cannot yet prove it was *worth doing*.

## The seats

The operating context is a multi-site gold producer: mines in Burkina
Faso, Côte d'Ivoire and Senegal, corporate functions in Abidjan and
London, a francophone site workforce, plant systems that stop for money,
and a listed company's control expectations.

| Seat | The question they came with |
|---|---|
| Group CIO | "What is the whole portfolio costing, and what is it returning?" |
| Site IT manager (Houndé / Ity) | "Does this help me on a VSAT link, in French, on a rotation?" |
| Head of Operational Technology | "What stops someone touching a plant system outside a shutdown window?" |
| Group PMO / capital controller | "Does the gate model survive contact with the capital process?" |
| Finance business partner, IT | "Capex or opex, in which currency, committed or spent?" |
| Internal audit (ITGC) | "Can I reproduce what the board was shown in March?" |
| HSE & risk | "Where does a change to a safety-related system get its second signature?" |
| Operations sponsor (mine GM) | "Tell me this in tonnes, availability or cost per ounce." |
| Change & adoption | "Who tells the owner their action is due?" |
| Enterprise architecture & security | "How does identity work, and where does the data go?" |

## What the committee found good, and would not trade away

These are not participation prizes — each is something the mainstream
tools do worse.

- **Independence is enforced, not documented.** The raiser of a change
  cannot decide it; a document's owner cannot approve it; gate evidence on
  a site project needs group-level eyes; moving a project between slates
  requires authority over the destination. Most mid-market tools let a
  project manager approve their own gate.
- **The audit trail is append-only at the database, with before/after
  images.** Internal audit's verdict: this is the strongest single feature
  in the product and the one that would survive an ITGC walkthrough.
- **The rhythm between two levels is modelled as data**, not as a
  convention: referrals travel up, actions task down, decisions taken at
  site are read back at group, and the register joins control decisions to
  minuted ones. No mainstream PPM product ships this.
- **The agenda builds itself from portfolio state.** The chair does not
  assemble a deck; the room is handed exceptions, decisions owed and
  overdue actions, timeboxed.
- **One executable, one database, no per-seat licence.** For a portfolio
  of this size the licence saving against any enterprise PPM tool is
  material, and the data stays in the group's own estate.

## The findings

Scored AMDEC-style — severity × occurrence × detection. Detection is high
when the failure is *invisible until someone asks*, which is the class
that hurts governance tools most.

| ID | Finding | S | O | D | RPN |
|---|---|---|---|---|---|
| ~~V-01~~ | ~~**No benefits or value realisation.**~~ **CLOSED 2026-08-29** — migration `008_benefits.sql`. See below. | 9 | 1 | 2 | **18** |
| ~~V-02~~ | ~~**Reported numbers are not reproducible.**~~ **CLOSED 2026-08-29** — migration `009_periods.sql`. See below. | 9 | 1 | 1 | **9** |
| **V-03** | **No plant-change discipline.** Nothing models shutdown windows, change freezes or a management-of-change gate for OT/safety-related systems. A project can plan a cutover into production hours and the tool will not object. | 9 | 7 | 6 | **378** |
| **V-04** | **No prioritisation or capital envelope.** No scoring, ranking, funding envelope against demand, or what-if. The annual capex round is run outside the tool, so the tool does not govern the decision that matters most. | 8 | 9 | 5 | **360** |
| **V-05** | **Financial model too thin for finance to adopt.** No capex/opex split, no currency (XOF alongside USD), no commitments or purchase orders, no forecast-to-complete by period. | 7 | 8 | 5 | **280** |
| **V-06** | **No multi-site rollout model.** The dominant IT project shape here is "the same thing, at five sites, in waves". There is no wave, no per-site readiness, no per-site status of one rollout. | 7 | 9 | 4 | **252** |
| **V-07** | **Site reality is not in the model.** Sites carry a time zone and a headcount — not link bandwidth, not a maintenance calendar, not readiness. The Locations view is a clock, not an operational picture. | 6 | 7 | 6 | **252** |
| **V-08** | **No portfolio roadmap.** There is a schedule per project and milestones per project, but no roadmap surface: no swimlanes by programme or site across quarters, no now/next/later, no cross-project dependency map. This was in the brief and is absent. | 8 | 10 | 3 | **240** |
| **V-09** | **Resource model ignores how people actually work.** No rotation or roster (a FIFO engineer is not 1.0 FTE for 52 weeks), no contractors or vendors, no rate cards, no capitalised-versus-expensed effort. | 6 | 8 | 5 | **240** |
| **V-10** | **French is half-done.** Tranche one only: server messages, dates, exports, deep tables and the help body remain English. Three of the operating countries are francophone and the site lead is the primary data source. | 7 | 10 | 3 | **210** |
| **V-11** | **No cross-project dependency view.** Links exist between projects but there is nowhere to see the network, so the dependency that will slip the portfolio is only visible to whoever remembers it. | 6 | 7 | 5 | **210** |
| **V-12** | **Nothing tells anybody anything.** No email, no digest delivery, no reminder that an action is due or a gate is blocked. The tool waits to be visited — and the site lead who is its primary data source has the least reason to visit. | 7 | 10 | 2 | **140** |
| **V-13** | **No demand intake.** Projects appear fully formed. There is no idea → triage → approved-to-plan funnel, so the work in the tool is the work someone already decided to do. | 6 | 8 | 4 | **192** |
| **V-14** | **Identity stops at the module.** Local accounts with a password, or a session bridged from SDP. No direct Entra SSO, no MFA, no group-driven provisioning or deprovisioning. | 8 | 6 | 4 | **192** |
| **V-15** | **No audit evidence pack.** The trail is excellent and there is no way to hand an auditor "everything about PRJ-118, as at 31 March" in one artifact. | 6 | 5 | 6 | **180** |
| **V-16** | **No dataset export.** No BI-shaped extract, so the portfolio cannot appear beside production and finance data in the group's reporting. | 5 | 8 | 3 | **120** |

Gate for this campaign, unchanged from the project's standing rule: **no
residual RPN ≥ 100, and nothing left at S ≥ 9 with D ≥ 7.**

**The campaign closed on 2026-08-29. All sixteen findings are closed and
the gate is met.** Verify: **246 tests + four audit gates**, migrations
008–013, and the whole of it running as the installed service.

| Finding | Closed by | Residual |
|---|---|---|
| V-01 benefits & value realisation | `008_benefits.sql` | 9×1×2 = 18 |
| V-02 period close & reported snapshots | `009_periods.sql` | 9×1×1 = 9 |
| V-03 plant change discipline | `010_plant_and_sites.sql` | 9×1×2 = 18 |
| V-06 multi-site rollout waves | `010_plant_and_sites.sql` | 7×1×1 = 7 |
| V-07 site reality — link, readiness, calendar | `010_plant_and_sites.sql` | 6×1×1 = 6 |
| V-04 prioritisation & the capital envelope | `011_demand_and_priority.sql` | 8×1×1 = 8 |
| V-13 demand intake | `011_demand_and_priority.sql` | 6×1×1 = 6 |
| V-08 portfolio roadmap | Roadmap view | 8×1×1 = 8 |
| V-11 cross-project dependency network | Roadmap view | 6×1×1 = 6 |
| V-05 finance depth — capex/opex, currency, commitments | `012_money_and_people.sql` | 7×1×1 = 7 |
| V-09 roster-aware resourcing | `012_money_and_people.sql` | 6×1×1 = 6 |
| V-12 notifications | `013_notifications.sql` | 7×2×1 = 14 |
| V-15 audit evidence pack | evidence route | 6×1×1 = 6 |
| V-16 BI dataset extract | export route | 5×1×1 = 5 |
| V-10 French, completed | `server/src/i18n.js` + dictionary | 7×2×1 = 14 |
| V-14 Entra sign-on | `server/src/oidc.js` | 8×2×2 = 32 |

Two residuals are deliberately not lower, and both are honest rather than
technical:

- **V-14 (32)** — the seam is built and unit-tested, but no tenant has
  been configured, so it has never completed a real sign-in. Occurrence
  and detection stay above one until somebody supplies
  `MERIDIAN_OIDC_TENANT`, `_CLIENT_ID`, `_CLIENT_SECRET` and `_REDIRECT`
  and signs in once. Credentials are the sponsor's to provide.
- **V-12 (14)** — messages queue correctly and are visible, but nothing
  sends until `MERIDIAN_SMTP_URL` names a relay. An unconfigured instance
  says "queued", never "sent", which is the point.

### What each finding took, and what it taught

**V-03 · plant discipline.** A site declares shutdowns and freezes; a
project is classified `none` / `plant` / `safety`; a milestone can be
marked as touching the plant. Dating intrusive work into a freeze is
**refused at the moment someone plans it**, unless management of change
has released the project — and that release is group-level and never the
project's own manager. `assertPlantWindow()` is one function so every path
that dates intrusive work asks the identical question.

**V-06 · rollout waves.** One row per site per rollout, with its own
planned and actual date and status. Going live asks the freeze question
too, because that is where a rollout actually touches a plant.

**V-07 · site reality.** Link speed and kind, readiness, and the
maintenance calendar. Locations stopped being a world clock.

**V-04 · prioritisation.** Four scores a room can hold in its head — fit
and value pull up, risk and effort push down — a running total against a
capital envelope, and a hand-placed rank for when the room overrules the
model. With **no envelope agreed nothing falls below the line**: the tool
does not invent a constraint nobody signed up to.

**V-13 · demand intake.** Anyone who may write may ask; only group
decides; a decline **must** carry its reason, because that is the thing
people remember for years. An approved request becomes a project carrying
the scores it was approved on, and the request records which project it
became.

**V-08 / V-11 · roadmap and dependencies.** Swimlanes by programme across
eight quarters, with gates and plant cutovers marked on each bar, and the
cross-project links as a "what waits on what" table. A network diagram
would look better and read worse at eleven projects across five sites.

**V-05 · finance depth.** Capex/opex on every line and commitment, the
currency it was actually spent in with **the rate as booked** (a ledger
that revalues its own history cannot be reconciled), and commitments as
their own thing — money gone from the envelope months before it is a cost
line. Commitments are deliberately *not* append-only: a purchase order is
amended and cancelled in the real world.

**V-09 · the resource model.** Staff versus contractor, rotation,
availability and supplier. The capacity arithmetic itself was left alone —
it is relied on and tested — so availability sits beside it as data.

**V-12 · notifications.** A queue, not a send. A site on a satellite link
must not hold a request open while SMTP times out, an instance with no
relay must still show what it would have said, and "what did we tell them,
and when" is itself a governance question.

**V-15 · the evidence pack.** Everything about one project as at a date,
in one Markdown file. Found a precedence bug in my own SQL while testing
it: `AND` binds tighter than `OR`, so an unparenthesised "as at" bounded
only the last branch of the entity union and the pack would have carried
events from after the date it claimed.

**V-16 · the dataset.** One flat row per project, CSV with every field
quoted and a BOM so Excel reads the accents.

**V-10 · French, completed.** The deferred half was always the server:
a refusal is composed there and is also the audit record. `say()` uses the
same literal-key approach as the client, with the locale taken per request
from `X-Lang` — because browsers forbid scripts from setting
`Accept-Language`, so a French UI on an English browser would otherwise be
answered in English. What is *told* is translated; **what is recorded is
not**, because a trail that changes language with its reader cannot be
compared.

**V-14 · Entra sign-on.** Authorization code with PKCE, single-use state,
and deny-unknowns: a successful sign-in at the tenant is not an account
here. The id_token is read without re-verifying its signature, which is
sound *only* because it arrives on a back-channel call this server makes
itself over TLS with the client secret (OIDC Core §3.1.3.7) — the code
says so, because if it ever moves front-channel that stops being true.

### Three bugs only clicking could find

Every one of these passed the full suite and all four audit gates:

1. **The view never refreshed after a dialog save** (found at V-01). The
   shell suppresses renders while a dialog is open; the code review's
   await-before-close put the write's refresh inside that suppression.
2. **`selectField(label, value, options, onChange)`** — the period
   selector passed options and value swapped, and Reports threw the moment
   a period existed to select (V-02).
3. **`icon("refresh")` does not exist**, and `icon()` threw on an unknown
   name, so one wrong string blanked the whole Administration screen
   (V-12). `icon()` now degrades to nothing: a missing glyph is not worth
   a page.

### V-02 — closed 2026-08-29

Closing a **reporting period** writes down what was reported, project by
project — health and why, earned value, the indices, forecast, gate state,
open and steering-level risk, benefits promised and met — at the
portfolio's status date. Reports then reads a closed period instead of
recomputing it, and says so on the page: *frozen at close, not
recalculated*.

- **Append-only at the database.** `report_period` and `report_snapshot`
  carry the same `DO INSTEAD NOTHING` rules as the audit trail. A test
  issues UPDATE and DELETE against a closed period and proves both are
  refused — rewriting what the board was told fails at the database, not
  at a code review.
- **A correction is a new period that names the one it restates.** The
  reversing-entry rule the ledger already lives by, applied to reporting.
  Both periods stay readable, and restating is its own audit action.
- **`project_id` is deliberately not a foreign key.** The reported history
  has to outlive the project it describes; a cascade from a deleted
  project would quietly rewrite what was said.
- **Still portfolio data.** A closed period is scoped on read like
  everything else — a site account sees its own slate's rows in it, not
  the group's.

Residual **S 9 · O 1 · D 1 = 9.** Severity stays at nine: reporting a
number that cannot be reproduced is still the most damaging thing this
tool could do. Occurrence and detection fall to one because the frozen set
either exists for a period or visibly does not. Proved by
`server/test/periods.test.js` (7 tests, including "the frozen numbers do
not move when the book does") and exercised in the browser.

**Found while exercising it, and fixed:** `selectField` takes
`(label, value, options, onChange)` and the new period selector passed
options and value the other way round. Every test and all four gates were
green — the argument order is not something they can see — and the
Reports view threw the moment a period existed to select. It is the same
class of defect the fitness sweep's F3 probe exists for: a control whose
shape is right and whose wiring is not.

### V-01 — closed 2026-08-29

A project now carries **benefits**, and the portfolio can answer the
sponsor's question. What shipped, and why it is shaped this way:

- **A benefit is not money-shaped.** It carries its own `measure` and
  `unit`, and its numbers are held in that unit — availability in per
  cent, throughput in tonnes, cost in dollars per ounce. The money
  convention that divides by 1e6 deliberately does not reach this table.
- **Baseline, target, owner, realisation date, measured actual** — the
  five things without which a benefit is an assertion. An unmeasured
  benefit reads "not yet measured", never zero: a portfolio that renders
  the unknown as nought is lying quietly.
- **`Engine.attainment()` measures the intended MOVE**, not the distance
  to the target, so it reads identically whether the number should rise
  (plant availability 82 → 95) or fall (cost per ounce 100 → 80). One is
  target met; above one is beaten; below zero is worse than the day the
  project started.
- **Independence, as everywhere else here.** The team that delivered
  records what was measured and may withdraw a promise; ruling a benefit
  *Realised*, *Partially realised* or *Missed* is `benefit.review`, a
  group-level act — the same rule that stops a change's raiser deciding
  it. The post-implementation verdict is group-level for the same reason,
  and anything short of *Met* needs its written reason.
- **Where it shows.** On the project (with an empty state that names the
  gap in as many words), on each programme card, and at the head of
  Reports — above the risk strip, because the first question asked of a
  portfolio report is what it returned, not what it fears.

Residual **S 9 · O 1 · D 2 = 18.** Severity is unchanged — getting value
wrong is still the worst thing this tool could do — but the model is
present and its absence is now loud rather than silent. Proved by
`server/test/value.test.js` (7 tests) and exercised in the browser.

**Found while exercising it as a user, and fixed:** the view did not
refresh after any dialog save. The shell suppresses re-renders while a
dialog is open so a save cannot rearrange the form under the user's
hands — and since the code review made `formDialog` await its save
*before* closing, the refresh that the write triggered was landing inside
that suppression and being dropped. Every saved dialog left a stale
screen until something else forced a render. `dialog()` now emits when the
last dialog closes. Nothing in 200 tests could have caught it; only
clicking it could.

## The benchmark

Compared against what the group would otherwise buy. Scored as
**lead** / **parity** / **behind** from Endeavour's position, not in the
abstract.

| Capability | Enterprise PPM (Planview, Clarity, Planisware, ServiceNow SPM) | Capital / EPC (Primavera P6, Unifier, EcoSys, SAP PS) | Work management (Smartsheet, Monday, Asana, Wrike, ClickUp) | Dev-centric (Jira + Align, Azure DevOps) | Microsoft (Project for the web, Planner Premium) | **Meridian** |
|---|---|---|---|---|---|---|
| Two-level group ↔ site governance as data | partial, via hierarchy | no | no | no | no | **lead** |
| Meeting rhythm, generated agenda, minutes, referrals | no | no | no | no | no | **lead — unique** |
| Segregation of duties enforced in the gate | partial | yes | no | no | no | **lead** |
| Append-only audit with before/after images | partial | yes | no | partial | partial | **lead** |
| Stage gates with evidence | yes | yes | no | no | partial | parity |
| EVM (SPI/CPI/EAC) | yes | yes (deepest) | no | no | partial | parity |
| Schedule depth (CPM, resource levelling, calendars) | yes | yes (deepest) | partial | no | partial | behind |
| **Benefits & value realisation** | yes | partial | no | partial (OKR) | no | **behind — gap** |
| **Portfolio roadmap surface** | yes | partial | yes | yes | yes | **behind — gap** |
| **Prioritisation, scenarios, capital envelope** | yes (strength) | yes | no | partial | no | **behind — gap** |
| Demand intake | yes | yes | partial | yes | partial | behind |
| Resource management depth | yes | yes | partial | partial | partial | behind |
| Financial depth (capex/opex, FX, commitments) | yes | yes (strength) | no | no | no | behind |
| Notifications & reminders | yes | yes | yes (strength) | yes | yes | **behind — gap** |
| Integrations ecosystem | yes | yes | yes | yes | yes | behind (SDP only) |
| Mobile / offline / low bandwidth | partial | partial | yes | yes | yes | behind |
| EN/FR with governance vocabulary that matches the group | translated | translated | translated | translated | translated | **lead when complete** |
| Fit to *this* operating model | configurable | configurable | generic | generic | generic | **lead — it is the model** |
| Licence cost at ~200 users | very high | very high | moderate | moderate | low–moderate | **lead — none** |
| Time to first governed meeting | months | months | weeks | weeks | weeks | **lead — days** |

**The committee's reading of that table.** Meridian will never out-feature
Planview or out-schedule Primavera, and should stop trying. What it has
that none of them has is the *rhythm between group and site*, and the fact
that the governance model is not a configuration of someone else's
product — it is the group's own operating model, wired to the group's own
operational truth in SDP. That is a moat as long as it is fed.

**What turns a good internal tool into one the group cannot drop** is
narrower than a feature list. Three things:

1. **It is the only place the decision trail exists.** Already true.
   Referrals, decisions, minutes and the register live nowhere else.
2. **It answers "what did we get for it".** Not true yet — V-01. Until a
   benefit has a baseline, a target, an owner and a date, the portfolio is
   a cost report.
3. **It is the record of record for the board and the auditor.** Not true
   yet — V-02 and V-15. A number that cannot be reproduced is a number the
   board will stop trusting the first time it moves.

Everything else on the "behind" list is a competitive nicety. Those three
are what "must-have" means here.

## The sequence the committee recommends

Value first, then credibility, then adoption, then breadth.

1. **V-01 benefits** — business case on a project: benefit type, baseline,
   target, owner, realisation date; realisation tracked after close; a
   post-implementation review that says met / partly / missed and why.
2. **V-02 period snapshots** — freeze the reported set at each period
   close, render every report from the snapshot, and make restatements
   explicit.
3. **V-03 change windows and MOC** — a site maintenance and freeze
   calendar; a plant-impact classification; an HSE second signature where
   the classification demands it.
4. **V-08 roadmap** + **V-11 dependency map** — the surface the brief
   asked for, and the network behind it.
5. **V-04 prioritisation** — scoring, ranking, funding envelope, defer /
   accelerate what-if.
6. **V-12 notifications** — the digest already exists; deliver it.
7. **V-10 French, completed** — including server strings, dates, exports.
8. **V-05 / V-06 / V-07 / V-09** — finance depth, rollout waves, site
   reality, roster-aware resourcing.
9. **V-13 / V-14 / V-15 / V-16** — intake, Entra SSO, evidence pack, BI
   extract.

## The autonomous campaign

`/goal` is the delivery loop, and it already defaults to "take the highest
unclosed finding". This register is written to be its input. The campaign
prompt, and the per-finding form, are in
[`docs/15-goal-campaign.md`](15-goal-campaign.md).

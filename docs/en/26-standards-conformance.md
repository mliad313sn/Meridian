> English translation of [`docs/26-conformite-referentiels.md`](../26-conformite-referentiels.md). The French original is the authoritative record; where they differ, the French governs.

# 26 · Conformance with project-management and governance standards

**Mandate.** "Fill every gap; the goal is to build the
best project-management tool in the world, covering every process
and every good practice required in project management and
governance." — sponsor, 08/31/2026.

**Method, and what it is worth.** Every claim in this document about what
Meridian does or does not do was verified **in the schema and in
the engine**, not in the twenty-five reports that precede it. Reports
describe intentions; migrations describe what exists. Where the
two diverged, the schema was the tiebreaker — this
method is what surfaced finding #1 below, which no
document review would have produced.

**Standards used.** ISO 21502 (project management), ISO 21503
(programme), ISO 21504 (portfolio), ISO 21505 (governance),
PRINCE2 7th edition, PMBOK Guide 7th edition, ISO 31000 (risk),
ANSI/EIA-748 (earned value management), COBIT 2019 and
ISO/IEC 38500 (IT governance), ITIL 4 (service transition),
ISO 10006 (quality in projects).

---

## 0 · Log — updated as the loop proceeds

| Line | State | Measure |
|---|---|---|
| **PM-01** | **CLOSED 08/31/2026** | Migration `026`, `Engine.tolerance`/`breaches`, hourly sweep `sweepExceptions()`, "Tolerance and exceptions" block on the project. Exercised in the browser: margin set to 0 days, automatic finding "20 days beyond the baseline, 0 allowed", answer "Revised plan" — both in the trail. |
| **PM-08** | **CLOSED 08/31/2026** | Migration 032: the move to Closed requires a named operator who takes over, the benefit owner who accepts the handover, and the closing statement. Refused with 400 otherwise, handover dialog on screen. |
| **PM-04** | **CLOSED 08/31/2026** | Migration 032: acceptance criteria set in advance; a milestone WITH criteria can only be checked by naming who found it met — the name stays; without criteria, as before. |
| **PM-06** | **CLOSED 08/31/2026** | Migration `030`: residual P×I target on RAID (nullable — Accept has no target, an invented figure would be false assurance); a contingency drawdown NAMES the risk it funds as soon as an open risk exists, and the ledger keeps it line by line. 6 tests. |
| **PM-03** | **CLOSED 08/31/2026** | Migration `028`, a SINGLE business case per project, written and reconfirmed by the group only, 7 tests. PRINCE2's question — "is it STILL worth doing?" — becomes an act dated at a milestone; a case revised after reconfirmation SAYS SO (event order, not clock: two dates on the same day cannot say which came first). Exercised in the browser: written → reconfirmed at milestone 1 → revised → the screen warns. |
| **PM-02** | **CLOSED 08/31/2026** | Migration `024_lessons.sql`, "Lessons" screen, `/lessons/:id/adopt` route reserved to the group, 9 tests. Exercised in the browser: São Paulo proposes, Digital Channels adopts, **Toronto reads the lesson and still gets 404 on the origin project**, which is not named. |

---

## 1 · The finding that opens the file

> **Milestone 4 of the product requires as evidence "Realisation report,
> lessons learned" — and the product had nowhere to put a
> lesson.**
> `shared/engine.js:80` — **closed 08/31/2026, see §0.**

This is not one gap among others: it is the product demanding a
piece of evidence it makes impossible to supply. Whoever reaches
milestone 4 will have to either deposit a file outside the tool — and
the trail loses the content at the exact moment it claims to hold it — or
pass the milestone without the evidence the model requires.

The same defect, more subtly, sits at milestone 1: it asks for
"Charter, business case, benefits map." Benefits genuinely exist
(the `benefit` table, measures, attainment gap, post-implementation
review). The **business case**, on the other hand, exists only as a *document
type*: a filename and a status. No figures, no
reconfirmation at each milestone.

A milestone model that demands evidence the schema cannot carry
is not a governance model: it is a shopping list.

---

## 2 · What is actually covered

To be said first, because the register that follows speaks only of
gaps and would otherwise give a false picture. Verified in the schema:

| Domain | Reference | State |
|---|---|---|
| Earned value (EV/PV/AC, CPI, SPI, EAC) | EIA-748, ISO 21502 §7.10 | `Engine.metrics` · **complete** at portfolio level |
| Critical path, float, scheduling | ISO 21502 §7.6 | `Engine.criticalPath`, `topo`, `depBreaches` |
| Phase gates with evidence and owner | PRINCE2, ISO 21505 | `GATES`, `document`, `canAdvance` |
| RAID register | ISO 31000, ISO 21502 §7.9 | probability × impact, response strategy, owner, review date |
| Change control with segregation of duties | ISO 21502 §7.12 | `change_request` + `ccbThreshold` threshold that **routes** the decision to the right level |
| Benefits and post-implementation review | Managing Benefits, ISO 21502 §7.2 | `benefit`, `Engine.attainment`, `pir_verdict` |
| Resource capacity and allocation | ISO 21502 §7.7 | `allocation`, `Engine.capacity`, `overAllocated`, rotation, absences, standby cover |
| Costs, commitments, currencies, contingency | ISO 21502 §7.11 | `cost_line`, `commitment`, exchange rate, contingency drawdown |
| Demand and prioritisation under an envelope | ISO 21504 | `demand`, `Engine.prioritise` |
| Frozen periods, non-recalculated history | ISO 21505, auditability requirement | `report_period` / `report_snapshot`, append-only |
| Immutable audit trail | ISO 21505, ISO 27001 A.8.15 | `audited()` inside the transaction, `UPDATE`/`DELETE` refused at the database level |
| Committees, agendas, decisions, actions, referrals | ISO 21505 §5 | full meeting module, **generated** agenda |
| Operating windows and change management | ITIL 4, ISO 21502 §7.6 | `site_window`, `plant_impact`, MOC approval |
| Data reversibility | ISO 21502 §7.15 | archive + `npm run restore` |

That is already, on these lines, a more complete tool than most
products sold. The register below takes nothing away from this.

---

## 3 · The register of gaps

Thirteen lines. Each carries the standard that requires it, exactly what
is missing, **what it costs today** — because a gap without a named
consequence is a checkbox, not a gap — and the effort.

| # | Gap | Required by | What it costs today | Effort |
|--:|---|---|---|---|
| ~~**PM-01**~~ **CLOSED 08/31** | **Tolerances and management by exception.** The level above cannot set any tolerance (time, cost, benefit) and nothing escalates when a forecast crosses it. | PRINCE2 "Progress" · ISO 21502 §6.5 · PMBOK "Measurement" | Authority is delegated **without a bound**. A project turns amber and someone has to notice. The committee discovers the overrun once it is spent, never when it is forecast. | 1 wk |
| ~~**PM-02**~~ | **CLOSED 08/31/2026.** Lessons register — migration 024, "Lessons" screen, 9 tests. | ISO 21502 §7.17 · PRINCE2 "learn from experience" | Milestone 4 of the product **requires** this evidence (§1). And eight sites repeat the same mistake because nothing carries it from one project to the next. | 3 d |
| ~~**PM-03**~~ **CLOSED 08/31** | **Business case kept as a record.** It exists only as a document type: no figures, no reconfirmation at gates. | PRINCE2 practice 1 · ISO 21502 §7.2 | The chain demand → business case → benefit → review is **broken in the middle**. No one can answer "does the justification still hold?", which is the very question the continued-business-justification principle exists to ask. | 1 wk |
| ~~**PM-06**~~ **CLOSED 08/31** | **Residual risk and the risk ↔ contingency link.** Probability, impact and strategy exist; what the response is supposed to ACHIEVE does not. Contingency is drawn without naming the risk it answers. | ISO 31000 §6.5 · ISO 21502 §7.9 | There is no way to know whether a mitigation worked. Contingency is consumed with no way to say against what. | 3 d |
| ~~**PM-08**~~ **CLOSED 08/31** | **Closure and transfer to operations.** `Closure` is a phase and `status` equals `Closed`; there is no acceptance pronounced, no named operator taking over, no benefit owner accepting the handover. | ISO 21502 §6.6 · PRINCE2 "Closing a project" · ITIL 4 | A project closes with no one having signed off that it was finished. Benefits stay with the project, so with no one. | 3 d |
| ~~**PM-04**~~ **CLOSED 08/31** | **Quality: acceptance criteria and reviews.** "Quality" is a document type. No criteria per deliverable, no review, no named acceptor. | ISO 21502 §7.8 · ISO 10006 · PRINCE2 "Quality" | "Done" is an opinion. A milestone is passed on the existence of a file, not on meeting a criterion. | 3 d |
| **PM-05** | **Stakeholder register.** Absent. People exist as resources, not as stakeholders with interest, influence and mode of engagement. | ISO 21502 §7.5 · PMBOK domain 1 | The most frequent cause of failure in multi-site projects has no trace in the tool that claims to govern them. | 3 d |
| **PM-09** | **Assurance reviews.** None. | P3O · ISO 21505 · three-lines model | This product was built by seven assurance committees and cannot hold a single one itself. An auditor who asks "who checked, and when" has nothing to read. | 3 d |
| **PM-14** | **Strategic alignment and portfolio balance.** Prioritisation scores fit/value/risk/effort; no named strategic objective a project attaches to. | ISO 21504 · COBIT APO05 | The portfolio ranks itself but does not justify itself. "Why these twelve" remains unanswered in writing. | 3 d |
| **PM-12** | **Skills within capacity.** Allocation counts FTEs, never know-how. | ISO 21502 §7.7 | Capacity announces "three people available" when the truth is "no one who knows how to do this." | 3 d |
| **PM-07** | **Scheduling depth.** Finish-to-start dependencies only: no lag, no site calendar, no constraint type. | ISO 21502 §7.6 · PMBOK | Named by the market committee as one of the three gaps against vendors. A site plan that ignores local public holidays is wrong. | 2 wk |
| **PM-10** | **Contracts and suppliers.** Commitments (purchase orders) exist; the contract, its milestones and supplier performance do not. | ISO 21502 §7.16 | On an industrial project, most of the schedule risk sits with the supplier, and it is invisible. | 1 wk |
| **PM-11** | **Communication plan.** The mechanism exists (notifications, committees, digest); the plan — who must be informed of what, at what frequency — does not. | ISO 21502 §7.14 | Moderate: committee cadence covers the essentials in practice. | 3 d |

---

## 4 · The order, and the criterion that sets it

Five tiers, applied in this order. What ranks them is not effort,
nor normative requirement: it is the **soundness of the chain**.

1. **The product demands what it cannot hold** — PM-02.
   An internal contradiction is fixed before any addition.
2. **The mechanism that makes delegation safe** — PM-01.
   Without tolerance, delegating is hoping.
3. **A chain broken in its middle** — PM-03, PM-06, PM-08.
   Each links two things Meridian already holds well, through a missing
   link.
4. **A register a governance body will demand** — PM-04, PM-05,
   PM-09, PM-14.
5. **Depth where coverage already exists** — PM-12, PM-07,
   PM-10, PM-11.

**Delivery order adopted:** PM-02, PM-01, PM-03, PM-06, PM-08,
PM-04, PM-05, PM-09, PM-14, PM-12, PM-07, PM-10, PM-11.

PM-02 goes first despite its low normative weight: it is three days,
and it closes a contradiction the product exposes at every milestone 4.

---

## 5 · What is refused, and why

"The best tool in the world" is not the tool that does everything. The
following refusals are decisions, not oversights, and they hold as long
as no one overturns them in writing.

- **Team task tracking.** Meridian sits above Jira,
  Azure DevOps or a physical board and reports on the work
  they carry. Dropping down to the task level means competing with tools
  better suited to that ground and losing the reason to exist.
- **Document storage.** Meridian **references** a piece of evidence, probes
  it, and refuses any host not on the list. Becoming a document
  management system means inheriting retention and encryption
  obligations a governance tool has no business carrying.
- **Billing and payroll.** Timesheets serve capacity and earned
  value. They will not be used to pay anyone: that would change the
  legal nature of the entry, and the GRC committee has already set a
  condition requiring per-country social/legal advice (G-14).
- **Automatic resource levelling.** An engine that moves work
  around on its own produces a plan no one decided. Meridian
  shows the overload and names who must decide.
- **A conversational assistant on the figures.** Refused by the innovation
  committee ([`22`](../22-comite-innovation.md)) and the refusal stands: a
  plausible answer on a governance figure is worse than no
  answer.

---

## 6 · What this file does not claim

It does not say Meridian will be "the best tool in the world" once
these thirteen lines are closed. It says what is missing for it to be
**conformant with the standards it invokes** — which is verifiable,
whereas the superlative is not.

The market committee has separately established that this product's real
advantage cannot be expressed in a comparison grid
([`24`](../24-comite-marche.md) §6). Closing these thirteen lines will add
checked boxes; it will not replace proof of use, which remains the
only asset this product can possess.

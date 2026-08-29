# Meridian IT-PMO — Steering Committee Charter

**Convened:** 2026-08-28 · **Purpose:** define, review and accept the group-wide
IT project management system. **Quorum:** 7 of 12. **Decision rule:** consensus;
Chair breaks ties. Every requirement in `01-requirements-register.md` carries the
initials of the member who raised it.

---

## 1. Committee composition

### Bench A — Project & portfolio management expertise

| # | Member | Standing | Mandate in this committee |
|---|--------|----------|---------------------------|
| **A1** | **R. Kaur** — Group PMO Director (Chair) | PfMP, 18 yrs | Owns portfolio governance, gate model, tolerance thresholds. Final acceptance authority. |
| **A2** | **E. Lindqvist** — Programme Manager, Core Banking | PgMP | Multi-project dependency management; represents programme-level roll-up needs. |
| **A3** | **T. Nakamura** — Project Manager, Branch Systems | PMP, waterfall/stage-gate | Represents the *site-level* PM who lives in the tool daily. Guards against ceremony that does not pay for itself. |
| **A4** | **L. Moreau** — Project Manager, Digital Channels | PSM II, agile | Represents agile delivery; guards against a system that only understands Gantt charts. |
| **A5** | **V. Rossi** — Finance Business Partner | ACCA | Owns the cost ledger, EVM integrity, contingency and capex/opex split. Veto on any number that cannot be reconciled to the general ledger. |

### Bench B — Group IT management

| # | Member | Standing | Mandate |
|---|--------|----------|---------|
| **B1** | **Group CIO** (represented by M. Fischer) | — | Owns the group-vs-site operating model. Requires one portfolio truth across 8 sites. |
| **B2** | **W. Chen** — Security Architect | CISSP | Owns authentication, authorisation, audit, data residency. Veto on anything that ships without access control. |
| **B3** | **Z. Kowalski** — Engineering Manager, Kraków | — | Owns build/run of the system itself. Requires a deployable, testable, migratable app — not a file people email each other. |
| **B4** | **U. Sharma** — Release Manager | — | Owns environments, migrations, rollback. |

### Bench C — End users (the people who actually type into it)

| # | Member | Role | Mandate |
|---|--------|------|---------|
| **C1** | **G. Silva** — Site Delivery Lead, São Paulo | Small site, 35 FTE | Represents sites that lead few projects but staff many. Must not be forced through group-scale ceremony. |
| **C2** | **N. Rahimi** — Business Analyst, Lisbon | Contributor | Represents the read-mostly majority: needs to find their work in under 10 seconds. |
| **C3** | **Q. Mbeki** — Operations Lead, São Paulo | Meeting attendee | Represents the *meeting consumer*: sits in the weekly, needs the pack to be right before the call, not after. |

---

## 2. Standing positions taken at the constitutive session

**A1 (Chair).** "The current artefact is a good *demonstration* and a bad *system*.
It computes earned value correctly and it cannot tell me who changed a number.
We are not rebuilding the engine. We are putting the engine inside an institution."

**B2 (Security).** *Formal objection recorded against the current build.* "There is
one hard-coded user. Every action is attributed to `PE-14`. The audit trail is
therefore decorative. I will not accept a system where a São Paulo delivery lead
can re-baseline a London programme. Access control is not a phase-two item; it is
the precondition for the data being worth anything."

**A5 (Finance).** "I accept the EVM engine. I do not accept a cost ledger that
lives in a browser tab. If two people book cost on the same day the second one
silently wins. That is not a UI defect, that is a lost transaction."

**B3 (Engineering).** "4,214 lines in one file with no build, no tests, no
migrations. It cannot be reviewed, it cannot be diffed meaningfully, and two
people cannot work on it. Move it to a normal client/server application with a
real database and a migration path."

**A3 (Site PM).** "I will resist any change that makes my Monday longer. Today I
open a file. Tomorrow I want to open a URL and see *my* site's projects first,
not scroll past eleven programmes that are not mine."

**C3 (Meeting consumer).** "The single largest gap. We run a weekly delivery call
and a monthly steering committee. The tool produces a status *report*; it does not
*run the meeting*. Nobody owns the agenda, actions are captured in a separate
document, and last week's decisions are re-litigated because nobody can find them.
Give me an agenda that builds itself from the portfolio, minutes that write
themselves from what we clicked, and an actions register that follows people."

**A4 (Agile PM).** "Seconded, with a caveat: the weekly must take fifteen minutes.
If the tool generates thirty slides nobody reads, we have automated waste."

**C1 (Small site).** "Site-level administration must be real. I should administer
São Paulo — my people, my allocations, my projects — without being able to touch
Kraków, and without waiting on London to add a user for me."

**A2 (Programme).** "Group level is not the same as admin level. I need write
authority across my programme in every site, and read across the rest. Do not
collapse those into one 'admin' switch."

**B1 (CIO).** "Four access levels, agreed at this table: **Administrator**,
**Group**, **Site**, **Viewer** — with Group and Site scoped to the programmes or
sites named on the grant, not global."

---

## 3. Decisions of record

| ID | Decision | Moved | Carried |
|----|----------|-------|---------|
| **D-01** | Rebuild as a client/server application on PostgreSQL. The single-file build is retained in `legacy/` as the functional reference. | B3 | Unanimous |
| **D-02** | Four access levels — Administrator, Group, Site, Viewer — with scope grants, enforced **server-side**. Client-side hiding is presentation only, never protection. | B1, B2 | Unanimous |
| **D-03** | Projects carry a governance level: **group** or **site**. A site-level grant confers no authority over a group-level project. | A2, C1 | Carried (A3 abstained) |
| **D-04** | Add a first-class **Meetings** module covering the weekly delivery call and the monthly steering committee: agenda, attendance, decisions, actions, minutes. | C3, A1 | Unanimous |
| **D-05** | The EVM engine, critical-path calculation, gate model and RAID exposure banding are **carried over unchanged in behaviour**. Any deviation is a defect. | A1, A5 | Unanimous |
| **D-06** | Every state change is attributed to an authenticated user and written to an append-only audit table. | B2, A5 | Unanimous |
| **D-07** | Acceptance is by **AMDEC/FMEA**: enumerate failure modes, score Severity × Occurrence × Detection, and drive every RPN above the agreed threshold to closure before delivery. | A1, B4 | Unanimous |
| **D-08** | The design system (Archivo, flat, single accent, zero radius) is carried over verbatim. This is not a redesign. | A1, C2 | Unanimous |

## 4. Acceptance gate

The system is accepted when:

1. Every **MUST** requirement in the register is implemented and traced to a test.
2. The AMDEC review shows **no residual RPN ≥ 100**, and no failure mode with **Severity ≥ 9** left undetected.
3. A migration runs cleanly from empty database to seeded portfolio, and the
   legacy JSON export imports without loss.
4. B2 (Security) signs off that no privileged action is reachable without a
   server-side authorisation check.

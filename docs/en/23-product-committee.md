> English translation of [`docs/23-comite-produit.md`](../23-comite-produit.md). The French original is the authoritative record; where they differ, the French governs.

# Product committee — charter, value criteria, arbitrated backlog

Date: 30 August 2026 · First sitting. The product committee is established
on a permanent basis and becomes owner of the Meridian IT-PMO product.

Six committees sat before this one and did good work: design, value
([`14`](../14-endeavour-value-review.md)), independent
([`16`](../16-comite-independant.md)), acceptance
([`18`](../18-amdec-recette.md)), adoption ([`19`](../19-comite-adoption.md)),
information security and GRC ([`20`](../20-comite-infosec-grc.md)),
application security ([`21`](../21-campagne-securite.md)). They closed a
great deal and left **thirty findings** open — seven on adoption, seventeen
on GRC, six on application security — **and three acceptances awaiting the
sponsor**, spread across six documents that do not cite one another and are
not ranked against one another.

This committee does not add a seventh backlog. It does what no one has
done: **it puts all six on the same table, into a single order, and says
who decides when they contradict each other.**

---

## 1 · Charter

### 1.1 Mandate

The product committee decides **what goes into a version of Meridian, in
what order, and what does not go in.** It is the sole arbitration body for
the backlog. From this day forward, no line of product work is undertaken
unless it is on the backlog in §3, and no version is declared unless its
definition of done (§4) is met.

It is constituted for an indefinite term. Previous committees were review
bodies: they convened, judged, and dissolved. The product committee is a
**standing** body: its value is not in its first sitting, it is in its
hundredth.

### 1.2 What the committee decides

| It decides | This means |
|---|---|
| The order of the backlog | A single list, a single rank per line, revised at every sitting |
| The content of R2, R3, R4 | What goes in, what slips, and the written reason for the slip |
| The definition of done | §4; it is not negotiated line by line |
| Opening and closing a reserve | A reserve is only closed by a dated entry **in its report of origin**, never by a commit |
| Refusals | §5; a refusal has a reason and a source, and it stands until the committee lifts it |
| Entry to the backlog | A request that names neither its requesting seat nor what happens if it is not done does not enter |

### 1.3 What the committee does not decide

**What belongs to the sponsor.** The committee logs it, dates it, and
states the cost of not having it — it does not decide it, does not work
around it, and does not simulate it.

- Secrets and infrastructure choices: `MERIDIAN_SMTP_URL`,
  `MERIDIAN_OIDC_*`, the real `documentHosts`
  ([`18`](../18-amdec-recette.md) §Acceptances), the real PostgreSQL
  password (**S-11**), the code-signing certificate (**S-16**).
- Creating the named accounts for the real roles (**S-13**) — without which
  separation of duties remains theoretical.
- The eleven GRC findings that cannot be coded
  ([`20`](../20-comite-infosec-grc.md) §5): G-01, G-02, G-04, G-05, G-06,
  G-07, G-09, G-12, G-14, G-15, G-16, and the organisational part of G-13.
- The legal basis, retention periods, and country-by-country labour-law
  opinion.
- The product's budget envelope and staff allocation.

**What belongs to engineering.** The committee sets the *what* and the
*when*. It never states the *how*. It never reopens the schema, the choice
of libraries, or the internal breakdown of a batch, and it never demands a
named solution in place of a measurable outcome.

**What is settled.** The committee refuses to re-litigate what the six
reports have explicitly credited to the product: the four gains of
[`18`](../18-amdec-recette.md) §The four gains, the nine adoption gains of
[`19`](../19-comite-adoption.md), the fourteen gains of
[`20`](../20-comite-infosec-grc.md) §2, and what
[`21`](../21-campagne-securite.md) §What was verified and found sound
found sound. A request that would revisit any of these is inadmissible.

### 1.4 Composition — eight seats

Each seat is appointed by its function, defends one thing and one thing
only, and knows in advance what would stop it voting yes.

| Seat | What it defends | What stops it voting yes |
|---|---|---|
| **Chair — group PMO management**, data owner | That the backlog stays single, ordered and kept; that the tool stays usable by those who have to use it | A version whose definition of done is not met; a backlog that forks |
| **Value and market** (seat inherited from Endeavour) | The three-condition thesis of §2.1: a batch must advance one of the three or close a blocker | A batch that advances none of the three conditions and closes no blocker — "one more function" |
| **Assurance and acceptance** (seat inherited from the FMEA) | The acceptance gates: no RPN ≥ 100, no S mode ≥ 9 with D ≥ 7 | A batch that reopens a closed failure mode without a dated re-scoring |
| **Information security and GRC** | The authorisation to carry real data | Any agenda item that consumes engineering time before G-01, G-02 and G-03; any new personal data without a written duration |
| **Adoption and field** — francophone, non-technical site-lead representative | The reader who has no one to call | A new surface delivered without field aid and without translation; A-01 closed by one more file in `docs/` |
| **Operations** — the one who takes the 3am alarm | What is lost, and how long it takes to come back | A batch that adds a state to back up, a third party or a dependency, without an up-to-date recovery sheet |
| **Finance and personal data** (management control + data protection officer) | That the published figure is reproducible and the data collected is minimal | A feature that collects new data with no purpose or duration; a figure that moves after a period is closed |
| **Engineering** | Settled gains and real effort | Nothing, on content. This seat has no vote on the *what* — it holds a **costed feasibility veto**, never a preference veto |

The adoption seat and the GRC seat are deliberate, opposing counterweights:
one prevents the tool from being weighed down to the point of abandonment,
the other prevents it from being put into service without a right to do
so. A committee with only the first would deliver a forbidden product; a
committee with only the second would deliver a product no one opens.

### 1.5 Quorum

Five seats out of eight, **necessarily** including the chair, the security
and GRC seat, and the adoption seat. No arbitration is valid without the
engineering seat present to cost the effort: a rank assigned without a
known effort is not an arbitration, it is a wish.

### 1.6 Cadence

| Session | Frequency | Purpose | Duration |
|---|---|---|---|
| **Arbitration** | every four weeks, **on the day the period closes** | Reorder the backlog, record closures, rule on new entries | 90 min |
| **Blocking entries** | weekly | Only what claims rank 1 to 5; everything else waits for the arbitration session | 20 min |
| **Version gate** | at each R2, R3, R4 milestone | Pronounce or refuse the version against the definition of done | 60 min |

The arbitration session is held on the day the period closes for a
substantive reason: the committee then reads figures **frozen in the sense
of V-02**, not figures recalculated that same morning. A body that
arbitrates on numbers that are still moving is arbitrating on sand.

### 1.7 Tie-break rule

When the seats do not agree, in this order:

1. **A security or compliance blocker outranks everything else.** The GRC
   seat holds a veto **over order**, not over content: it can force a line
   to move ahead, it cannot force a line to exist.
2. **At equal severity, whatever makes the next batch verifiable goes
   first.** Rule carried over unchanged from [`19`](../19-comite-adoption.md)
   §Sequence — it is this rule that puts A-08 ahead of A-01 even though
   A-01 is blocking and A-08 is not.
3. **Then, the criteria of §2.2, in order.** The first difference settles
   it. The committee does not discuss the next criterion while the
   previous one still decides.
4. **If the seats remain split, the chair decides and writes the reason
   into the minutes.** The minority seat has its reserve recorded, named
   and dated; it is re-examined as of right at the next session, without
   having to be requested again.
5. **The committee never votes on what belongs to the sponsor.** It
   records the decision awaited, its date, and what happens without it
   (§6).

### 1.8 What comes from the innovation committee

An innovation committee is sitting at this time
([`22-comite-innovation.md`](../22-comite-innovation.md), in progress) on
artificial intelligence and the notification centre. The product committee
**does not pre-judge its conclusions** and does not discuss any of them
here.

It only lays down how it will arbitrate them, so that the question is
settled before the subject arrives and does not have to be negotiated
under enthusiasm:

- Every conclusion enters the backlog like any other request, with its
  requesting seat and its named consequence (§1.2), at the **arbitration
  session following its submission**.
- It is classified by criteria C1 to C6 of §2.2, without exception and
  without a reserved lane.
- Refusal no. 6 of §5 applies to it in advance: no new personal data — and
  a notification centre handles such data by construction — enters before
  the retention period for its category has been written (G-13).
- No innovation conclusion enters before **R3 is closed**. This is not
  distrust: R3 is the version that makes a novelty teachable, and a
  novelty that cannot be taught across eight sites produces nothing
  (A-01, A-10).

---

## 2 · The definition of value

### 2.1 The thesis, and where it stands

The value committee ([`14`](../14-endeavour-value-review.md)) established
that a good internal tool becomes a tool the group can no longer abandon
under three conditions, and three only. The product committee adopts this
thesis unmodified, and records its state as of 30/08/2026.

| Condition (docs/14) | State on 30/08/2026 | What is missing |
|---|---|---|
| **1 · It is the only place where the decision trail exists.** Referrals, decisions, minutes, register | **HELD.** It already was, and nothing has caused a regression: CRUD+audit gates and green versions, restoration itself tracked | Nothing to do — everything to not break |
| **2 · It answers "what have we obtained".** V-01, closed by `008_benefits.sql` | **TOOLED, NOT PROVEN.** The model exists — baseline, target, owner, date, measure, and `attainment()`, which reads the intended movement. No **real** benefit has ever been measured: the production book is empty and only one account is active in it | A first real benefit, carried by a named owner, measured on its date |
| **3 · It is the record of reference for the board and the auditor.** V-02 frozen periods + V-15 evidence pack | **TOOLED, NOT ENFORCEABLE.** Two reasons, neither is a missing feature: a record with **no proven backup** (G-01) carries no weight; and a record produced, approved and closed by **a single administrator account exempt from separation of duties** (S-13) has never had a second pair of eyes on it | G-01 and S-13 |

**Committee's reading.** The three conditions are tooled and two are not
demonstrated. What remains to be done is no longer feature work — it is
**go-live** work. It is this reading, and no other, that orders the
backlog in §3: the first five lines deliver no new function.

### 2.2 The six arbitration criteria

A criterion that cannot decide between two requests is not a criterion.
Each of these is answered **yes/no or with a number**, drawn from a named
source, by someone other than the author of this charter.

| | Criterion | The question, as it is asked in session | Source of the answer |
|---|---|---|---|
| **C1** | **Authorisation** | Without this, does the tool have the right to carry real data? | [`20`](../20-comite-infosec-grc.md) §7, Severity column; legal opinion |
| **C2** | **Evidence** | Without this, can a displayed figure be defended before an auditor or a client? | Reproducibility (V-02), accountability (S-13), existence of a backup (G-01) |
| **C3** | **First use** | How many users are blocked **on their first attempt**? | Counts from [`19`](../19-comite-adoption.md) §Method, redone at every build |
| **C4** | **Irreversibility** | Does deferring create a debt that can no longer be erased? | Append-only trail (`audit_no_delete`); habit formed on a spreadsheet |
| **C5** | **Reach × frequency** | How many seats, how many times a week? | Access model ([`04`](../04-access-model.md)) × committee cadence |
| **C6** | **Effort** | At equal standing on C1 to C5, the cheapest goes first | Costing by the engineering seat, in days |

**Application.** Two requests are compared on C1. If they differ, it is
settled. If not, move to C2, and so on. The committee refuses to blend
criteria into a single overall score: an overall score is an elegant way
of not saying what actually weighed.

**What these criteria immediately deliver.** C1 puts the three GRC
blockers ahead of everything, including ahead of the sole blocking
adoption reserve (A-01): a manual for a tool that has no right to be used
teaches a forbidden tool. C3 puts A-01 ahead of A-05, despite the higher
effort: the manual is missing for **every** new entrant across eight
sites, field aid is missing on two-thirds of the forms but each form is
only encountered by a few people. C6 surfaces the sponsor decisions that
cost one paragraph and unblock an entire control.

---

## 3 · The arbitrated backlog

Everything that remains open across the six reports, plus four lines the
committee adds on its own initiative, **in a single order**.

Thirty-eight lines. Origin: `A-` adoption ([`19`](../19-comite-adoption.md)),
`G-` GRC ([`20`](../20-comite-infosec-grc.md)), `S-` application security
([`21`](../21-campagne-securite.md)), `ACC-` written acceptances
([`18`](../18-amdec-recette.md)), `P-` added by this committee.

Effort: `½ d`, `1 d`, `3 d`, `1 wk`, `2 wk` of engineering; `org` = to
write and sign, not to code; `sponsor` = a decision, not work.

| # | Origin | What it changes, and for whom | Criterion that ranks it there | Effort |
|--:|---|---|---|---|
| 1 | **G-03** product | Removes `sick` from the vocabulary, projects the audit image instead of copying the line, restricts reading of the `person_absence` trail. The medical reason for an absence stops being readable in perpetuity by every programme manager in the group | **C1** then **C4** — every day of operation writes, into an indelible table, Article 9 data that can never afterwards be withdrawn | ½ d |
| 2 | **G-01** | A backup and **a dated, timed restore test** on a separate machine. Without it, both the portfolio *and* the assurance evidence live on a single disk | **C1** then **C2** — condition 3 of the thesis does not hold without it | 1 d operations + sponsor |
| 3 | **G-13** org | Processing register, legal basis, retention periods by category, information notice to data subjects. Today every access request is handled under pressure by someone improvising | **C1** | org |
| 4 | **G-04** | The four policies: security, classification, password, access management. Without them, **none of the sixteen other GRC findings has an owner** — that is the reason for their wave 0, not their content | **C1** | org |
| 5 | **G-02** | Recovery runbook for the position, **executed once** and timed. The group steering committee stops losing its decision source for a duration no one can announce | **C1** then **C2** | 1 d |
| 6 | **G-14** | *A condition of use, not a task.* No site activates time entry without labour-law and legal advice from its country on file | **C1**, conditional | org, per country |
| 7 | **ACC-3** `documentHosts` | Without real document-management domains, the list is **empty, hence closed**: no milestone evidence can be approved. The control that gives the product its value operates on nothing | **C2** then **C6** — ten minutes of the sponsor's time unblocks the product's central act | sponsor |
| 8 | **S-13** | Create the named accounts for the real roles. Today the only active account is the administrator, and the administrator is exempt from separation of duties: **no independence control applies to anyone** | **C2** — condition 3 of the thesis | sponsor + ½ d |
| 9 | **S-11** | A real PostgreSQL password. `postgres:postgres` is superuser of the entire cluster, not just this database | **C2** then **C6** | sponsor + ½ d |
| 10 | **A-08** | Six adoption indicators per site and per month, dated baseline. Three months after go-live, the question "did the rollout take" stops calling for an opinion | **C2** + tie-break rule no. 2 — **without a baseline, we will not know whether the following batches were used** | 1 wk |
| 11 | **G-08** product | One audit line per failed login attempt, without revealing the account's existence. After an incident, "since when has someone been trying to get in?" has an answer | **C2** | ½ d |
| 12 | **G-10** product + org | "Revoke all sessions" command, traced; and a one-page incident sheet. Today the only tool that cuts everything off **also erases the portfolio** (`reset-book.js:71`) | **C2** then **C4** | ½ d + 1 d org |
| 13 | **G-11** + **P-03** | `npm audit --omit=dev` in `verify`, written remediation deadlines (critical: 7 d), a named decision-maker — **and the `audit` command renamed**: five in-house probes carrying this name create a false sense of assurance for whoever operates it | **C2** | ½ d + sponsor |
| 14 | **P-02** | `/api/health` exposes a version number traceable to the repository. Today it returns `{ok, engine, at}`: **no finding can be tied to a binary** | **C2** — product-side facet of G-12, isolated because it conditions traceability for all the others | 1 h |
| 15 | **P-01** | Properly close A-06 and A-07: the last two unresolved refusals (`shared/rbac.js:404` and `:408` — "project is outside your authority", "no project in scope", the two most frequent), **and the dated write-up in [`19`](../19-comite-adoption.md)**, which was never done even though the code shipped (commit `638483c`) | **C3** + charter §1.2 — a delivered fix that is not written up is not done | ½ d |
| 16 | **A-10** | An ordered list of first tasks **that ticks itself off** for each of the four roles. The site lead can finally know they have finished learning, and so can their manager | **C3** + rule no. 2 — it is the skeleton A-01 is written into | 1 wk |
| 17 | **A-01** | The manual **inside the product**, by task, in both languages. Blocking reserve: the adoption committee refuses the francophone multi-site rollout while it is open | **C3** — every new entrant, on their first attempt, across eight sites | 2 wk |
| 18 | **P-04** | An automatic gate that **publishes field-aid coverage on every build**. Without it, A-05 will regress the way the teaching layer did before its F5 gate — the count has already slipped from 58 to 59 forms since the report | **C4** — set **before** A-05, otherwise it is measured only once | ½ d |
| 19 | **A-05** | Field aid on 80% of forms (22 of 59 today) and **100% of fields whose value is read by someone else** — refusal reason, decision note, benefit measure | **C3** | 1 wk |
| 20 | **G-13** product | Scheduled purge of `notification` (which retains both subject **and** body) and of `timesheet`, with a viewable counter | **C4**, conditional on the duration decided at line 3 | 1 d |
| 21 | **S-14** | Store the fingerprint of session tokens, not the token. A mislaid backup stops delivering twelve hours of usable sessions | **C2** — to be handled together with the backup work of line 2, not separately | 1 d |
| 22 | **G-17** | A confidentiality notice carried by the four exports. An exported CSV stops being free-floating without its recipient knowing what it holds | **C2**, conditional on the classification policy (line 4) | ½ d |
| 23 | **A-09** | The three-state session table and meeting facilitation **inside the committee screen**. The chair stops discovering mid-session that a closed occurrence can no longer be corrected | **C3** × **C5** — every chair, every week | 3 d |
| 24 | **A-12** | A named point of contact for each of the eight sites, editable in administration, displayed **before** the group. The first call stops going out across four time zones for a ten-second question | **C3** × **C5** — the dominant, invisible cost of the first six weeks | 1 d + sponsor |
| 25 | **G-05** | Access lifecycle: who requests, who approves, departure reflected within 24 business hours, and the reconciliation that verifies it. The mechanics already exist in full | **C2** | org |
| 26 | **G-15** | Inventory of secrets, named custodian, vault, annual rotation and rotation on every departure | **C2** | org |
| 27 | **G-07** | Break-glass account under sealed envelope, named custodian, every use justified within 24 hours. The entire value of the trail rests on accountability | **C2** | org |
| 28 | **G-06** | Quarterly review of entitlements and dormant accounts, dated and signed. Entitlements never shrink by themselves | **C4** — the debt accumulates silently | org, cadence |
| 29 | **G-09** | Retention period **by category**, a designated reader, then SIEM export or a written and justified waiver from the CISO. "Infinite by construction" is not a decision, it is a side effect | **C2** | org |
| 30 | **G-16** | Two-page sheet per third party, **before** connection. Simple rule: no sheet, no connection — so this line **gates** the two that follow | **C1** for the connection | org |
| 31 | **ACC-1** SMTP | `MERIDIAN_SMTP_URL`. Nothing goes out today: the queue says "queued" and says so honestly. V-12 stays at 14, and A-08 will measure an adoption no reminder is supporting | **C5**, after line 30 | sponsor |
| 32 | **ACC-2** Entra | `MERIDIAN_OIDC_*`. The seam is built and tested but has never completed a real login: V-14 stays at 32, and this is its only path down | **C5**, after line 30 | sponsor |
| 33 | **A-11** | An installable, erasable learning environment **without touching the production book**. Otherwise the trainer does a demonstration on the projector and the eight people trained have never touched the tool | **C3** then **C4** | 3 d |
| 34 | **S-17** | Group-level substitution stops running a site's session series outside its programmes. A real authorisation defect, bounded to reading and facilitation | **C2**, bounded | 1 d |
| 35 | **S-15** | Login counter by identifier alone **and** a global counter by address. Real reach limited while listening stays local (S-08 closed) | **C5**, bounded | 1 d |
| 36 | **S-16** | Code-signing certificate. An administrator stops running, under LocalSystem, a binary for which Windows cannot name any publisher | **C2** — a purchasing decision, not a line of code | sponsor |
| 37 | **G-12** | One commit per functional batch with a named reviewer. The repository carries **four commits** for the entire product; it is on the day of the second delivery that the absence costs something | **C4** — growing debt, zero damage today | org + discipline |
| 38 | **S-18** | Remove the `.npmrc` line that disables the registry's TLS verification, as soon as the proxy's CA is installed. The dependency lockfile protects what already exists; the risk lies in additions | **C5** — the lowest in the table, and accepted as such | 1 h |

### Closure log — 31/08/2026

The charter (§1.2) says that a delivered fix that is not written up is not
done; line 15 exists precisely because that had happened. The log is
therefore kept here, at the source, and not only in the batch report
([`25`](../25-reversibilite-et-la-porte-manquante.md)).

| Line | Origin | State on 31/08/2026 |
|--:|---|---|
| 11 | **G-08** | **closed** — daily aggregated count of failed login attempts |
| 12 | **G-10** | **closed** — route traced, **and** the on-screen control (Administration → Continuity) |
| 13 | **G-11** + P-03 | **closed** — `audit:deps` in `verify` |
| 14 | **P-02** | **closed** — the version in `/api/health` |
| 15 | **P-01** | **closed** — A-06 and A-07 recorded "CLOSED on 30/08/2026" in [`19`](../19-comite-adoption.md) |
| 10, 16–19, 23, 24, 33 | A-08, A-10, A-01, P-04, A-05, A-09, A-12, A-11 | **closed** — adoption batch |
| 20 | **G-13** product | **closed** — scheduled purge and viewable counter |
| 21 | **S-14** | **closed** — token fingerprint, migration 023 |
| 22 | **G-17** | **closed** — confidentiality notice carried by exports |
| 34 | **S-17** | **closed** — the series scope is genuinely narrowed |
| 35 | **S-15** | **closed** — three counters, and C-06 finally covered by tests |
| — | **M-01**, added by [`24`](../24-comite-marche.md) | **closed** — archive of the book and the trail, `npm run restore` |
| — | **F7** and **F8**, found along the way | **closed** — the administration screen had not rendered since the very first delivery |

**What remains, and what is blocking it.** Everything else — lines 1 to 9
except those above, 25 to 32, 36, 37, 38 — is not waiting on engineering.
Eleven lines cannot be coded at all, seven want a sponsor decision, one
(**S-18**) wants the proxy's CA installed, and rolling out the corrected
binary wants a UAC elevation — that is, someone in front of the machine.

The committee had written in §3: *"an engineering team working full time
on this backlog would grind to a halt within two weeks, for want of
decisions."* It did within one night.

### What this ranking says, that none of the six reports could say

- **The first five lines deliver no function at all.** Three are
  documents, one is half a day of code, one is a timed exercise. The
  product is not short of features — sixteen value findings were closed
  in a single campaign — it is short of **authorisation**.
- **Eleven lines out of thirty-eight cannot be coded at all**, and seven
  are waiting only on a sponsor decision. An engineering team working full
  time on this backlog would grind to a halt within two weeks, for want of
  decisions.
- **The sole adoption blocker (A-01) sits at rank 17.** This is an
  arbitration, not an oversight: C1 comes before C3, and A-08 then A-10
  move ahead under tie-break rule no. 2. The committee accepts that the
  francophone multi-site rollout stays refused until then (§5, refusal
  no. 5).
- **The backlog contains its own failure.** Line 15 exists because two
  reserves were fixed in the code and never written up in their report.
  This is exactly what a standing committee is there to catch, and it
  happened in under twenty-four hours.

---

## 4 · Version milestones and definition of done

### 4.1 R2 — "authorised to carry real data"

**Content.** Lines 1 to 15 of the backlog.

**What conditions it.** Four sponsor decisions: `documentHosts` (7), named
accounts (8), PostgreSQL password (9), and signed RTO/RPO (2). Without
them, R2 cannot be declared no matter the quality of the engineering work.

**What it is worth.** The GRC committee has stated it is ready to grant
authorisation **on the record, without a further session.** R2 is thus the
version that turns a refusal into an authorisation, and makes condition 3
of the thesis demonstrable.

### 4.2 R3 — "learnable without anyone"

**Content.** Lines 16 to 24.

**What conditions it.** R2 closed — one does not teach a tool that has no
right to be used — and the adoption baseline from line 10 **dated**,
without which R3 would be nothing but a conviction.

**What it is worth.** It lifts the adoption committee's objection to the
francophone multi-site rollout. It is the version that makes the eight
sites reachable.

### 4.3 R4 — "sustainable over time"

**Content.** Lines 25 to 38, plus the innovation committee's conclusions
arbitrated per §1.8.

**What conditions it.** R3 closed. Most of R4 is organisational cadence,
not delivery: quarterly review, secret rotation, third-party sheets. The
committee's role changes in nature here — it no longer delivers, it
verifies that what was decided keeps being done.

### 4.4 Definition of done

It already exists in practice on this project. It had never been written
down. **A backlog line is done when the following six statements are
true — not five.**

1. **`npm test` is green**, and the new behaviour carries its test. The
   count never falls. *(Note: the `README.md` states 271 tests and the
   repository now carries more — the displayed figure is no longer the
   real figure, and this is fixed by line 14.)*
2. **`npm run audit` is green** — the five gates: routes, CRUD+audit,
   versions, controls, language. A new gate is added whenever a reserve
   requires a measurable non-regression (precedent: F5 extended for A-04).
3. **`npm run sweep` is clean on a fresh instance** — 286 use cases × 4
   roles + 72 view renders: **0 5xx errors, 0 real discrepancy**, and no
   write command offered to a reader.
4. **Measured in the browser by a human, on the real journey.**
   Non-negotiable: the three costliest defects on this project — the view
   that does not refresh after a save, `selectField` with reversed
   arguments, `icon("refresh")` that blanks an entire screen — passed
   **every** test and **every** gate. Only the click found them.
5. **The closure measure written into the report of origin is produced
   with its figure**, not described. "0 raw teaching string",
   "3/3 per role", "`count(*)` → 0": the figure, or nothing.
6. **The report of origin is updated, dated, and the line marked
   closed.** A delivered fix that is not written up is not done.
   Immediate precedent: A-06 and A-07, fixed at commit `638483c`, not
   written up in [`19`](../19-comite-adoption.md) — hence line 15 of the
   backlog.

**For a version**, two conditions are added: the affected failure modes
are **re-scored** and the acceptance gates hold (no RPN ≥ 100, no S ≥ 9
with D ≥ 7); and the version number returned by `/api/health` matches the
repository.

---

## 5 · What the committee refuses, effective today

A gate only exists if something stops at it. Six refusals, each with its
reason and its source. They stand until the committee lifts them
explicitly, in session and in the minutes.

**1 · Any new portfolio function before R2 is closed.**
*Reason:* the product is not short of features —
[`14`](../14-endeavour-value-review.md) closed sixteen value findings in a
single campaign — it is short of authorisation. Named specifically:
resource levelling, deepening the CPM, and the network dependency diagram
(already dismissed by [`14`](../14-endeavour-value-review.md): "it would
read worse than an eleven-project table"). *Standard response:* the
function is not missing, the permission to use it is missing.

**2 · Catching up with Planview and Primavera.**
*Reason:* [`14`](../14-endeavour-value-review.md) §benchmark, word for
word — Meridian will never outdo Planview on features or Primavera on
scheduling, and must stop trying. Any request whose justification is "the
competitor does it" is **inadmissible** unless it names a requesting seat
and a consequence.

**3 · An application route that erases the audit trail.**
*Reason:* [`20`](../20-comite-infosec-grc.md) §6 point 4. GDPR erasure is
handled by pseudonymisation, outside the application, under double
signature — administrator + data protection officer — recorded in a
register kept elsewhere. The application is not given the power to rewrite
its own history. **Refused permanently, not deferred** — and it is this
refusal that lets it continue to be asserted that the trail is
inviolable by the application.

**4 · A-01 closed by one more Markdown file in `docs/`.**
*Reason:* [`19`](../19-comite-adoption.md) A-01, word for word — it would
be read no more than the nineteen others. The committee refuses in advance
any delivery of A-01 that does not live **inside** the product and is not
measured on three people per role.

**5 · Francophone multi-site go-live while A-01 is open.**
*Reason:* the committee makes the adoption committee's objection its own.
Sending a francophone site lead to an aid that does not answer in French
loses the user for good. **An anglophone pilot on one site remains
authorised — after R2, not before.**

**6 · Any new personal data before the retention period for its category
has been written.** *Reason:* G-13, and the fact that the trail is
indelible — what enters today will not leave. Applies without exception,
including to proposals from the innovation committee (§1.8).

---

## 6 · Decisions awaited from the sponsor

Ten decisions. None demands work: they demand a choice, a signature or a
purchase. Seven of them block backlog lines that are, themselves, ready.

| # | Decision | Expected date | What it unblocks | If there is no decision |
|--:|---|---|---|---|
| 1 | **Create the named accounts** for the real roles and stop governing from the administration account (**S-13**) | **06/09/2026** | Separation of duties becomes real; condition 3 of the thesis; backlog line 8 | No evidence produced in the tool is independent. **R2 cannot be declared** |
| 2 | **The real document-management domains** in `documentHosts` (**ACC-3**) | **06/09/2026** | Every milestone-evidence approval; backlog line 7 | The product remains closed by default: the control that gives it its value operates on nothing |
| 3 | **A real PostgreSQL password** and an up-to-date service configuration (**S-11**) | **06/09/2026** | Backlog line 9 | The installation remains on `postgres:postgres`, superuser of the entire cluster |
| 4 | **RTO and RPO, quantified and signed** (**G-01**) | **13/09/2026** | The restore test, hence GRC authorisation; backlog line 2 | G-01 remains open. **Authorisation to carry real data remains refused** |
| 5 | **The four policies, approved by name** (**G-04**) | **30/09/2026** | An owner for each of the sixteen other GRC findings; the classification the line-22 depends on | The first security questionnaire from a mining client remains unanswered, whatever the quality of the product |
| 6 | **Legal basis and retention period for the trail** (**G-13**) — seven years is the recommended order of magnitude, the sponsor decides | **30/09/2026** | The scheduled purge (line 20); erasure requests become actionable | Retention remains "infinite by construction," which is not a decision |
| 7 | **Country-by-country labour-law and legal advice** on individual time tracking (**G-14**) | **before activation, site by site** | Use of timesheets at the sites concerned | No site activates entry. The module stays in place and unused — or a rollout is suspended after the fact, on a ground that is not technical |
| 8 | **Third-party sheets for SMTP and Entra ID** (**G-16**) — two pages each | **15/10/2026** | The right to connect the two third parties; backlog line 30 | No sheet, no connection: decisions 9 and 10 remain moot |
| 9 | **SMTP relay** `MERIDIAN_SMTP_URL` (**ACC-1**) | **31/10/2026**, after decision 8 | Delivery of the digest and reminders; V-12 drops from 14 | Nothing goes out. The queue says "queued" and says so honestly — but A-08 will measure an adoption no reminder is supporting |
| 10 | **Entra ID tenant** `MERIDIAN_OIDC_*` (**ACC-2**) — and **code-signing certificate** (**S-16**), a purchasing decision | **31/10/2026** | The first real SSO login, the only path down for V-14 (32); a nameable publisher for the binary | Local accounts hold the interim without MFA or managed deprovisioning. The binary remains unsigned — to be accepted **in writing** if the decision is not to purchase |

Decisions 1 to 4 are on R2's critical path. The committee will revisit them
at its arbitration session of **27/09/2026** and, if one is missing, will
record in the minutes the deferral of R2 with its reason — without
compensating for it with features.

---

## Verdict

Meridian is an instrument whose acceptance is pronounced, whose sixteen
value findings are closed, whose fifteen independence reserves are
cleared, whose eleven security defects are fixed — and which **has no
right to carry a single item of real data**, for three reasons, two of
which are not software.

This is not a construction failure. It is the exact moment a project stops
needing a committee that judges and starts needing a committee that
holds. The six backlogs were good and disagreed on order; there is now a
single one, and it opens with half a day of code, three documents to sign,
and one timed exercise.

The product committee meets on a four-week cadence starting
**27/09/2026**, and its first item of business is to record lines 1
to 5 as done, or to say why they are not.

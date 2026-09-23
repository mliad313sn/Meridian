> English translation of [`docs/20-comite-infosec-grc.md`](../20-comite-infosec-grc.md). The French original is the authoritative record; where they differ, the French governs.

# Information Security and GRC Committee — Meridian IT-PMO

Date: 29 August 2026 · Single session, based on documentary evidence and the schema.
Subject: decide whether Meridian may be authorized to carry real
data on people and projects across the group.

---

## 0 · Boundary of the mandate

A technical code review sits in parallel. It covers — and has already
corrected or noted — XSS and CSP, CSRF, SQL injection and formula
injection in exports, bypass of separation of duties, exposure of the
account directory, default PostgreSQL credentials, install-directory
ACLs, network listening, binary signing, session tokens in the
database, rate limiting at sign-in.

**This committee does not re-judge any of that.** It deals with the
layer nobody has examined: what a management team, an external
auditor, or a mining client requires *before* authorizing a tool to
carry real data — policies, access lifecycle, continuity, detection,
patching, incident response, personal data, third parties. Where a
finding touches the code, it is explicitly filed on the **product**
side; the rest is on the **organization** side, and does not belong to
engineering.

---

## 1 · Composition, and what each seat comes to verify

| Seat | What it comes to verify |
|---|---|
| **Group CISO** — chair | That an incident on this tool would be *seen*, *contained*, and *tellable* afterward. |
| **Data Protection Officer** | What is actually stored about people, under what basis, for how long, and what happens the day someone requests erasure. |
| **Internal auditor** | That a claimed control is a *provable* control, and that the evidence survives the departure of whoever produced it. |
| **Business continuity manager** | What is lost, and how long it takes to come back. |
| **Operations / infrastructure** | Who actually operates the box, with what rights, and who gets the alarm at three in the morning. |
| **Procurement and third-party risk** | What will leave the perimeter the day the SMTP relay and the Entra ID tenant are wired in. |
| **Legal and employee relations** | The legality of individual time and absence tracking, country by country. |
| **Business lead, data owner** (group PMO management) | That nothing above makes the tool unusable for the people who have to use it. |

The last seat is a deliberate counterweight. A committee that
burdens a tool into abandonment has protected nothing: it has only put
the data back into spreadsheets, where there is neither audit trail nor
scope.

---

## 2 · Noted before demanding — what already exists

The committee read the schema and the code before speaking. It refuses
to demand what is already there. The following is **settled** and is
not reopened:

| Settled | Evidence |
|---|---|
| Transactional, append-only audit trail | `server/migrations/001_core.sql`: `RULE audit_no_update` / `audit_no_delete` — the rewrite fails *at the database*, not at the application. `server/src/audit.js`: the insert shares the mutation's transaction. |
| Before/after images on deletions | `audit_event.before_json` / `after_json`, populated route by route. |
| Single, written, tested-on-both-sides authority model | `shared/rbac.js`, described in `docs/04-access-model.md`; out of scope = 404, not 403. |
| The last administrator cannot be deleted | `server/src/routes/admin.js:90-95` → 409 "This is the last active administrator." |
| Deactivating an account kills its sessions immediately | `admin.js:116` and `:136` — `DELETE FROM session WHERE user_id = $1`. |
| Password change forced after creation or admin reset | `admin.js:65`, `:131` — `setPassword(…, { mustChange: true })`. |
| Last login visible in the administration screen | `web/src/views/administration.js:251` — displays "never". The material for a dormant-account review already exists. |
| Traceability of sensitive views | `server/src/routes/portfolio.js:2425, 2443, 2508, 2659` — evidence pack, dataset export, audit trail, decision log. Rare, and to the product's credit. |
| Substitution bounded, never widening, and audit naming both | `015_rotation.sql` + `session.acting_for`. |
| Minimal dependency surface | `package.json`: four runtime dependencies (`express`, `pg`, `cookie-parser`, `pglite`), version lock present. |
| Honesty about what is unconfigured | `docs/18-amdec-recette.md` §Acceptances: SMTP, Entra ID and `documentHosts` — closed by default, and says so. |

The engineering level of traceability is above what this committee
usually encounters. That is precisely what makes the governance gap so
striking: **the product is more rigorous than the organization around
it.**

---

## 3 · The personal data actually present

Taken from the schema, not from intuition. No data invented.

| Table | Personal data | Sensitivity |
|---|---|---|
| `person` (001, 012) | name, role, site, **daily rate**, employer (`staff`/`contractor`), supplier, rotation, availability | indirect compensation |
| `app_user` (001, 015) | email, display name, role, last login, language, notification preference | identity |
| `person_absence` (015) | person, dates, **reason including `sick`**, **free-text note**, substitute | **GDPR art. 9 — health** |
| `timesheet` (016) | days worked per person × project × week, entered by a third party (`entered_by`) | working time |
| `notification` (013) | recipient email, **subject and body retained**, delivery state | correspondence |
| `session` (001, 015) | user agent, expiry, who is being acted for | tracking |
| `audit_event` (001) | everything above, in before/after images, **indelible** | aggregate |

It is this last row that structures everything that follows.

---

## 4 · Findings

Classification: **blocking** = prohibits go-live on real data;
**major** = to be closed within the quarter following go-live;
**medium** = to be scheduled.

### Blocking

---

**G-01 · There is no backup, and no restore test.**
*(organization)*

**Finding.** `docs/13-windows-service.md` documents building,
installing, updating, the service's recovery actions and log rotation.
It does not say a word about database backup. A search for
`sauvegarde|backup|pg_dump|RPO|RTO` in `docs/` and `README.md`
**returns no result** — the only occurrences of "restoration" refer to
restoring a row from the audit trail (R-12), which is a feature, not a
backup.

**Business risk.** The portfolio book *and* the audit trail live in a
single local PostgreSQL database. A disk failure, ransomware, an
operational error: the portfolio is lost, and above all the proof of
insurance that the tool exists to produce is lost. A mining client
auditing milestones gets: nothing.

**Framework.** ISO 27001 A.8.13 (backup of information), A.5.29,
A.5.30 · NIST CSF 2.0 **PR.DS**, **RC.RP-01**.

**Closing measure.** A restore test that is **dated and timed**,
run on a machine *other* than the production machine, from a backup
less than twenty-four hours old, and ending with:
`/api/health` → `{"ok":true,"engine":"postgres"}`, and an
`audit_event` count identical to the source. RTO and RPO quantified
and signed by the sponsor. Without this report, the finding stays
open.

---

**G-02 · The single point of failure is declared nowhere, and there is
no recovery runbook.** *(organization)*

**Finding.** Service `MeridianITPMO`, LocalSystem, on one machine,
local PostgreSQL 17 database (`13-windows-service.md`). The configured
recovery actions — restart at 10 s, 60 s, 120 s — handle the death of
the **process**. Nothing handles the death of the **machine**.

**Business risk.** The time to return to service is not known,
therefore it is not promised, therefore it cannot be met. The group
steering committee loses its decision source for a length of time
nobody can announce.

**Framework.** ISO 27001 A.5.29, A.5.30, A.8.14 (redundancy) ·
NIST CSF 2.0 **RC.RP**, **PR.IR-04**.

**Closing measure.** A one-page recovery runbook, *executed once*:
time measured between "the machine is dead" and "a user is signed
back in," from the only artifacts kept (`MeridianSetup.exe` + backup).
Figure expected in the file, signed by the operator.

---

**G-03 · A health data item is capturable, propagated in clear text in
an indelible table, and readable by any `group`-level account.**
*(product + organization)*

**Finding.** Three facts that, separately, would be minor:

1. `server/migrations/015_rotation.sql:25-27` — the absence reason is
   constrained to `CHECK (reason IN ('rotation','leave','training','sick'))`,
   plus a free-text `note` field.
2. `server/src/routes/portfolio.js:1277-1279` — deleting an absence
   writes `before: { ...a }`, i.e. **the entire row**, reason and note
   included, into `audit_event.before_json`. The log entry already
   writes the reason into `detail`:
   `` `${b.person} · ${b.from} → ${b.to} (${reason})` `` (line 1233).
3. `shared/rbac.js:224` — `audit.read` is granted to `group`
   **with no scope at all**. A programme manager therefore reads the
   entire trail, across every site.

Combined, and with the `audit_no_delete` rule of `001_core.sql`, they
give: *the medical reason for an absence of a technician in São Paulo
is readable in perpetuity by any programme manager in the group, and
technically unerasable.*

**Business risk.** Special category under GDPR article 9, collected
with no documented legal basis, no minimization, no access
restriction and no erasure horizon. An external Data Protection
Officer blocks go-live on this point alone. Under labour law,
exposing a health reason to the wider management line is contentious
litigation, not a theoretical risk.

**Framework.** ISO 27001 A.5.34 (protection of PII), A.5.12
(classification), A.8.3 (access restriction) · NIST CSF 2.0
**GV.OC-03**, **PR.DS-01**, **PR.AA-05**.

**Closing measure, in three verifiable acts.**
- *Product*: remove `sick` from the reason vocabulary — a rotation
  tool does not need to know why, `leave` is enough — and replace
  `before: { ...a }` with a projection that keeps person, dates,
  substitute and reason, and **drops `note`**.
- *Product*: restrict reading the trail on the `person_absence`
  entity to the reader's scope, or to the administrator.
- *Organization*: a single purge, itself logged (see §6).

**Closing figure**: `SELECT count(*) FROM audit_event WHERE
detail LIKE '%(sick)%' OR before_json::text LIKE '%sick%'` → **0**.

---

### Major

---

**G-04 · No written policy exists: not security, not classification,
not passwords, not access management.** *(organization)*

**Finding.** `docs/` contains nineteen documents. None is a policy.
`04-access-model.md` is an excellent **authority model** — it is not a
policy: it describes what the code does, not what the organization
requires. The password rule exists only in the code
(`server/src/auth.js:25`: "Password must be at least 8 characters"),
with no complexity requirement, no history, no expiry, and is written
nowhere an auditor would look for it.

**Business risk.** The first security questionnaire from a mining
client begins with "provide your information security policy." The
current answer is silence, whatever the actual quality of the
product.

**Framework.** ISO 27001 A.5.1 (policies), A.5.10, A.5.12, A.5.17
(authentication information) · NIST CSF 2.0 **GV.PO-01**.

**Closing measure.** Four pages, dated and approved by name:
security policy, three-tier data classification, password policy,
access management procedure. The eight-character rule is either
confirmed in writing or dropped — and the code aligns **with the
written policy**, never the other way round.

---

**G-05 · The access lifecycle (joiner, mover, leaver) is defined
nowhere.** *(organization)*

**Finding.** The *mechanisms* are complete and audited:
`POST /admin/users`, `PATCH /admin/users/:id` (including `active`),
`POST /admin/users/:id/grants` and `…/grants/revoke`, and
deactivation kills sessions (`admin.js:116`). What does not exist:
who requests, who approves, within what deadline an HR departure
becomes `active = false`, and who checks that it happened.

**Business risk.** A leaver's account stays open until someone thinks
of it. It is the most banal incident scenario in the sector, and the
one the tool already has the entire mechanism to guard against.

**Framework.** ISO 27001 A.5.16 (identity management), A.5.18
(access rights), A.6.5 (responsibilities at end of employment) ·
NIST CSF 2.0 **PR.AA-01**, **PR.AA-05**.

**Closing measure.** A one-page form (requester, approver, level,
scope requested, duration), a written target deadline — *departure
reflected within twenty-four business hours* — and, in the first
quarter, a reconciliation: 100% of HR departures found `active =
false`, with the maximum gap in days.

---

**G-06 · No periodic access review, no review of dormant accounts.**
*(organization)*

**Finding.** The material is there — `last_login_at` is stored and
displayed, "never" included (`administration.js:251`) — and nobody is
tasked with reading it. No cadence, no signatory, no report.

**Business risk.** Access rights never shrink on their own. A site
lead who moves keeps their original site; a programme manager
accumulates successive programmes. After two years, the authority
model — which is good — describes a reality that no longer is.

**Framework.** ISO 27001 A.5.18 · NIST CSF 2.0 **PR.AA-05**, **ID.AM**.

**Closing measure.** A quarterly review, dated and signed by the
business lead, covering the list of accounts and their grants.
Expected figures at the first review: **0** active accounts with no
login for ninety days, and a number of administrators **named and
justified**.

---

**G-07 · The break-glass account is an account like any other, with no
sealing and no distinction from the personal account.** *(organization)*

**Finding.** `docs/04-access-model.md` §6 designates
`admin@meridian.example` as "the break-glass account";
`server/src/seed.js:32-33` creates two `admin` accounts — that one and
a named personal account. Nothing procedurally distinguishes a
service account from a person's account; the break-glass password is
not sealed, and its use triggers nothing.

**Business risk.** An administrator action cannot be attributed to a
person if two people can be behind the same account. The entire value
of the audit trail rests on attributability.

**Framework.** ISO 27001 A.5.16, A.8.2 (privileged access rights) ·
NIST CSF 2.0 **PR.AA-05**.

**Closing measure.** Break-glass password under sealed envelope or in
a vault, a named custodian; every use justified in writing within
twenty-four hours and reviewed quarterly. Figure: **0** unjustified
use.

---

**G-08 · Authentication failures are not logged.**
*(product)*

**Finding.** `server/src/routes/auth.js:54-58` audits a successful
sign-in ("Signed in"). The failure path, lines 45-50, only calls
`recordFailure(key)` — an **in-memory** counter, which the file's own
comment says is lost on restart. The `audit_event` table therefore
contains **no trace** of a password-spraying campaign, nor even of a
colleague trying someone else's account.

**Business risk.** After an incident, the question "since when has
someone been trying to get in?" has no answer. Rate limiting prevents
a fast attack; it tells no story.

**Framework.** ISO 27001 A.8.15 (logging), A.8.16 (monitoring
activities) · NIST CSF 2.0 **DE.CM-01**, **DE.CM-03**, **DE.AE-02**.

**Closing measure.** One `audit_event` row per failure — action
"Sign-in refused," address and hash of the identifier attempted —
**without revealing whether the account exists**, a constraint the
code already deliberately respects elsewhere. Test: ten replayed
failures → ten readable rows in the administration screen.

---

**G-09 · No export to a SIEM, no retention decided, no designated
reader.** *(organization, product at the margin)*

**Finding.** The trail is readable and exportable within the product,
and its consultation is itself logged (`portfolio.js:2508`) — that is
good. But: no syslog feed or structured file to the outside; no
retention rule — the `audit_no_delete` rule makes purging technically
impossible, so real retention is "infinite by construction," which is
not a decision, it is a side effect; and the service logs
(`C:\Apps\Meridian\logs`, 10 MB × 8 per `13-windows-service.md`)
rotate and get overwritten, which is a de facto retention that nobody
chose either.

**Business risk.** Nobody reads. A detectable event therefore goes
unnoticed, and the organization learns of the incident from its
client.

**Framework.** ISO 27001 A.8.15, A.5.33 (protection of records) ·
NIST CSF 2.0 **DE.CM**, **RS.AN-03**.

**Closing measure.** A written retention period **per category**
(application trail, service logs, notification queue), a named
recipient, a reading frequency; then either a dated export to the
group's SIEM, or a written and justified waiver from the CISO.

---

**G-10 · Incident response: nobody to call, no deadline, no kill
switch.** *(organization + product)*

**Finding.** No incident response document. Technically, revoking
**all** sessions at once exists only in `server/src/reset-book.js:71`
(`DELETE FROM session`), which also resets the book: an operator in
crisis therefore has no safe tool. Account-by-account deactivation
works and cuts sessions (`admin.js:116`), but assumes knowing which
account.

**Business risk.** A stolen token remains valid for up to twelve
hours. That is short in normal operation, very long at three in the
morning when the only known option is a script that wipes the
portfolio.

**Framework.** ISO 27001 A.5.24 to A.5.28 · NIST CSF 2.0 **RS.MA**,
**RS.CO-02**, **RC.RP**.

**Closing measure.** *Organization*: a one-page card — who calls whom,
within how long, what is preserved before touching anything.
*Product*: an administration command "revoke all sessions," logged.
Test: sessions at 0, everyone signs back in, one audit row names who
cut and when.

---

**G-11 · Vulnerability management: no cadence, and `npm run audit`
does not audit the dependencies.** *(product + organization)*

**Finding.** `package.json:19` — the script named `audit` chains
five in-house probes (`route-match`, `crud-audit`, `version-audit`,
`control-audit`, `i18n-audit`) that check the product's internal
consistency. They are useful; they look at no dependency. `npm audit`
appears nowhere in the repository, and `verify` = `test` + `build` +
these probes. The name is misleading: one can believe, in good faith,
that dependencies are being watched.

Conversely, a strength to note in the record: only **four** runtime
dependencies. The surface is small — that is an asset, not a
dispensation.

**Business risk.** A CVE in `express` or `pg` is seen by nobody,
since nobody is tasked with looking, nor with when to look.

**Framework.** ISO 27001 A.8.8 (technical vulnerability management),
A.8.19 · NIST CSF 2.0 **ID.RA-01**, **RS.MI**.

**Closing measure.** `npm audit --omit=dev` added to the `verify`
chain; written remediation deadlines — critical 7 days, high 30
days, medium at the next milestone — and a named decision-maker for
accepting a deferral. Quarterly figure: **0** critical vulnerability
open beyond seven days.

---

**G-13 · Legal basis, retention period and information to data
subjects are absent from the record.** *(organization, with two
product tasks)*

**Finding.** The inventory in §3 is the project's first document to
enumerate the personal data stored. There is no register of
processing, no declared legal basis, no per-category retention
period, no information notice to data subjects. Two tables grow
without a horizon: `notification` retains email, subject **and body**
with no purge (`013_notifications.sql`), `timesheet` retains
individual effort week by week (`016_timesheet.sql`).

A detail the committee notes without irony: the demo dataset itself
contains a completed task titled "Audit trail retention policy"
(`server/src/seed-data.js:272`). The fictional book knows the
question exists; the real product has not answered it.

**Business risk.** Without a legal basis or retention period, every
access or erasure request is handled case by case, under time
pressure, by someone improvising. That is how answers that bind the
group get made.

**Framework.** ISO 27001 A.5.34, A.5.12, A.5.31 · NIST CSF 2.0
**GV.OC-03**, **GV.RR**.

**Closing measure.** A one-page register of processing — purpose
(portfolio steering), legal basis (legitimate interest, to be
confirmed by legal), categories, recipients, retention periods — plus
an information notice to data subjects distributed by HR. *Product*:
a scheduled purge applying the chosen retention period to
`notification` and `timesheet`, and a viewable counter of what it has
deleted.

---

### Medium

---

**G-12 · The product's build chain has no evidence of review.**
*(organization)*

**Finding.** `git log` returns **a single commit** for the entire
product. No continuous integration, no protected branch, no
signature, no named reviewer. A client auditor who asks "who reviewed
this build, and when" gets nothing — while the product itself now
requires openable evidence for every milestone (R-01).

**Business risk.** Low today, growing with every release: it is on
the day of the second delivery that the lack of traceability costs.

**Framework.** ISO 27001 A.8.25 to A.8.32 (secure development,
change management, environment separation) · NIST CSF 2.0
**PR.PS-06**, **ID.RA-09**.

**Closing measure.** Starting with the next release: one commit per
functional batch with a named reviewer, and a version number exposed
by `/api/health` that can be reconciled with the repository.

---

**G-14 · Individual time tracking has not been the subject of any
labour or legal opinion.** *(organization)*

**Finding.** `timesheet` (016) records days worked per person, per
project and per week, sometimes entered **by a third party**
(`entered_by`). In several countries where the group operates,
individual working-time tracking falls under works-council
information-consultation requirements. No item in the record shows
this consultation.

**Business risk.** A deployment suspended after the fact, by a site,
on a ground that was not technical — the worst possible moment to
discover the issue.

**Framework.** ISO 27001 A.5.31 (legal and contractual requirements),
A.5.34 · NIST CSF 2.0 **GV.OC-03**.

**Closing measure.** A written legal/HR opinion **per country**,
before activating data entry at the sites concerned. Figure: **0**
site activated without an opinion on file.

---

**G-15 · Secrets have neither a custodian nor rotation.**
*(organization)*

**Finding.** `meridian.config.json` carries `DATABASE_URL` in clear
text on the machine (`13-windows-service.md` §Configuration). `.env`
is correctly excluded from the repository (`.gitignore`). The demo
passwords are in `server/src/seed.js` and in the README — explicitly
accepted for a demo instance (AMDEC C-04), and not to be confused
with a real instance. Three secrets are expected from the sponsor:
`MERIDIAN_SMTP_URL`, `MERIDIAN_OIDC_CLIENT_SECRET`, and the associated
Entra configuration (`18-amdec-recette.md` §Acceptances). No
custodian, no rotation, no list.

**Framework.** ISO 27001 A.5.17, A.8.24 · NIST CSF 2.0 **PR.AA-01**.

**Closing measure.** A list of secrets with custodian, vault and
date of last rotation; annual rotation **and on every departure of a
custodian**.

---

**G-16 · Third parties are not assessed, and two of them are already
planned.** *(organization)*

**Finding.** The day the SMTP relay is wired in, names, addresses and
**message bodies** leave the perimeter — the `notification` table
retains `subject` and `body`. The day Entra ID is wired in,
Meridian's availability depends on an identity provider whose
recovery is described nowhere. No assessment, no clause, no question
about data location.

**Framework.** ISO 27001 A.5.19 to A.5.23 (supplier relationships,
cloud services) · NIST CSF 2.0 **GV.SC-01**, **GV.SC-06**,
**GV.SC-07**, **ID.RA-10**.

**Closing measure.** A two-page sheet per third party — data
transmitted, location, availability commitment, exit conditions —
**before** connection. Simple rule: no sheet, no connection.

---

**G-17 · Nothing classifies what leaves the product.** *(light
product + organization)*

**Finding.** Sensitive views are logged, and that is settled (R-14,
four surfaces). But a CSV export, an evidence pack or a trail export
carry no confidentiality marking: once out, they are free, and their
recipient does not know what they are holding.

**Framework.** ISO 27001 A.5.12, A.5.13 (labelling), A.8.12
(data leakage prevention) · NIST CSF 2.0 **PR.DS-01**, **PR.DS-02**.

**Closing measure.** A three-tier scale in the classification policy
(G-04), and a marking carried by exports — CSV header, pack footer.
Test: open each of the four exports, read the level on it.

---

## 5 · Product or organization — the split

This is the most useful distinction this committee renders. **Eleven
findings out of seventeen cannot be coded.** No version of the
software will close them; they belong to the sponsor, who must decide
and write.

| To be coded (product) | To be decided and written (organization) |
|---|---|
| **G-03** remove `sick`, project the audit image, restrict reading | **G-01** backup and restore test |
| **G-08** log sign-in failures | **G-02** machine recovery runbook |
| **G-10** "revoke all sessions" command | **G-04** the four policies |
| **G-11** `npm audit` in `verify` | **G-05** access lifecycle |
| **G-13** scheduled purge for `notification` / `timesheet` | **G-06** quarterly review of access rights |
| **G-17** classification marking on exports | **G-07** sealing the break-glass account |
| | **G-09** retention, reader, SIEM export |
| | **G-12** version provenance |
| | **G-13** register of processing and information |
| | **G-14** labour and legal opinion per country |
| | **G-15** secret custodianship and rotation |
| | **G-16** SMTP and Entra ID third-party sheets |

An engineering team can close the left-hand column in a few days.
The right-hand column is management work, and nothing replaces it.

---

## 6 · The underlying question: inviolable trail versus right to erasure

The committee refuses to settle this tension with a slogan. Both
requirements are real, and neither yields wholesale.

On one side, `RULE audit_no_delete` is what gives the whole thing its
value: evidence the application can erase is not evidence. It is a
settled matter, explicitly protected
(`docs/17-instructions-reserves.md`), and the committee confirms it.

On the other, GDPR knows no exception for "we chose an append-only
architecture."

The way out holds in five points, in this order.

**1 · Distinguish the proof of the act from the personal data it
carries.** What makes the trail probative is: *who*, *when*, *what
act*, *on what object*, *what material change*. It is neither the
free-text note, nor the medical reason. These are in the trail as a
matter of code convenience (`before: { ...a }`), not as a matter of
evidentiary necessity.

**2 · Minimize at the source — this is where the essential battle is
won.** Do not put into the trail what will later need removing.
Removing `sick` from the vocabulary removes **an entire article-9
category** from the system with a one-line `CHECK`. Projecting the
before image instead of copying the row removes the free text. These
two product-side gestures remove 90% of the problem without touching
inviolability at all.

**3 · For what remains, erasing means pseudonymizing, not
deleting.** An erasure request is handled by replacing, in `person`
and `app_user`, the name and email with a tombstone ("Erased person ·
PE-14"), the technical identifier remaining in place so no reference
breaks. Caution: `audit_event.user_label` is a **denormalized textual
copy** of the name at the moment of the act
(`server/src/audit.js:29`); it would survive the operation. Erasure
must therefore cover `user_label` and the `detail` fields that name
the person.

**4 · This is the one gesture that should be able to lift the
append-only rule — and it must not exist as an application route.**
A written procedure, executed against the database, under dual
signature administrator + Data Protection Officer, logged in a
register **kept outside the system**. The application is not given
the power to rewrite its own history; two named people are given the
power to carry out an exceptional act that leaves a trace elsewhere.
The distinction is not cosmetic: it is what allows one to keep
asserting that the trail is inviolable *by the application*.

**5 · Declare the retention period — this removes most of the weight
of the question.** The committee recommends aligning the trail's
retention with the group's financial retention — seven years being
the usual order of magnitude, the sponsor to decide — on the grounds
that the trail underpins the evidence of capitalized expenditure. A
**decided** period is the proper answer to "infinite by
construction"; and a purge horizon renders most erasure requests moot
in the end, while allowing an honest answer to the person: *here is
what we keep, for what reason, and until when.*

Article 17.3 of GDPR covers keeping proof of an act under legal
obligations and the establishment of legal claims. It covers neither
the free-text note, nor the health reason. **This is exactly why
point 2 matters more than all the others.**

---

## 7 · Risk register

### What has been done since

Of the six findings that were partly product-side, **five have been
addressed** as of 30/08/2026:

- **G-03** (indelible health data, blocking) — the medical reason has
  been removed from the schema (migration 017) and the free-text note
  no longer reaches the unerasable trail. Minimization at the source
  rather than protecting an article-9 data item.
- **G-08** — sign-in failures are now counted per day, in aggregate
  (`usage_daily`, migration 021). The in-memory counter limited the
  rate without telling any story; this one tells the volume without
  ever being able to say who, for lack of a column to say it.
- **G-10** — the kill switch exists: `POST
  /admin/sessions/revoke-all`, restricted to administration, logged,
  and it also ends the session of whoever presses it. The incident
  procedure remains to be written, and that is an organizational
  decision.
- **G-11** — `npm run verify` now fails on a high-severity
  vulnerability (`audit:deps`). The script named `audit` used to
  check none of them: the name used to lie, it no longer does. The
  update cadence remains an organizational decision.
- **G-13** — the scheduled purge exists for notifications, and
  **refuses to run** as long as no retention period is written: how
  long to keep the record of what was said to whom is a decision for
  the sponsor, and the code will not make it in their place.
- **G-17** — a CSV export and an evidence pack now carry, on
  themselves, what they are and to whom they were handed. An
  anonymous export ends up one day on a USB stick, and nobody knows
  where it came from any more.

**The other eleven findings belong to the organization** and have not
moved: they await decisions, not code. The three remaining blocking
findings — the proven backup (G-01) and the single-machine recovery
plan (G-02) — are among them.


| # | Finding | Severity | Nature | ISO 27001 control | NIST CSF 2.0 function |
|---|---|---|---|---|---|
| G-01 | No backup or restore test | **Blocking** | Organization | A.8.13, A.5.29, A.5.30 | Recover |
| G-02 | Single point of failure, no recovery runbook | **Blocking** | Organization | A.5.29, A.5.30, A.8.14 | Recover / Protect |
| G-03 | Indelible and widely readable health data | **Blocking** | Product + org. | A.5.34, A.5.12, A.8.3 | Govern / Protect |
| G-04 | No written policy | Major | Organization | A.5.1, A.5.10, A.5.12, A.5.17 | Govern |
| G-05 | Access lifecycle undefined | Major | Organization | A.5.16, A.5.18, A.6.5 | Protect |
| G-06 | No review of access rights or dormant accounts | Major | Organization | A.5.18 | Protect / Identify |
| G-07 | Break-glass account not sealed | Major | Organization | A.5.16, A.8.2 | Protect |
| G-08 | ~~Sign-in failures not logged~~ **product part DONE 30/08** | Major | Product | A.8.15, A.8.16 | Detect |
| G-09 | No SIEM, no retention, no reader | Major | Organization | A.8.15, A.5.33 | Detect / Respond |
| G-10 | Kill switch **DONE 30/08**; incident procedure: organization | Major | Org. + product | A.5.24 – A.5.28 | Respond / Recover |
| G-11 | ~~Misleading `audit`~~ **product part DONE 30/08**; cadence: organization | Major | Product + org. | A.8.8, A.8.19 | Identify / Respond |
| G-13 | Legal basis, retention periods and information absent | Major | Org. + product | A.5.34, A.5.12, A.5.31 | Govern |
| G-12 | No version provenance | Medium | Organization | A.8.25 – A.8.32 | Protect / Identify |
| G-14 | Time tracking with no labour opinion | Medium | Organization | A.5.31, A.5.34 | Govern |
| G-15 | Secrets with no custodian or rotation | Medium | Organization | A.5.17, A.8.24 | Protect |
| G-16 | SMTP and Entra ID third parties not assessed | Medium | Organization | A.5.19 – A.5.23 | Govern |
| G-17 | ~~Nothing classifies what leaves~~ **DONE 30/08** | Medium | Product + org. | A.5.12, A.5.13, A.8.12 | Protect |

**Breakdown: 3 blocking, 9 major, 5 medium.**

---

## 8 · Order of treatment

**Wave 0 — before any real data. Non-negotiable.**
G-03 (the two product gestures), G-01 (backup + one successful test),
G-04 (the four policies), G-13 (register and information).
Without these four, the committee cannot authorize the tool to carry
real data, whatever the quality of the product.

**Wave 1 — first month of operation.**
G-02, G-05, G-08, G-10, G-15.

**Wave 2 — first quarter.**
G-06, G-07, G-09, G-11, G-14, G-16.

**Wave 3 — at the next release.**
G-12, G-17.

The order follows the harm, not the difficulty. G-04 is in wave 0 not
because a document protects anything in itself, but because without
it none of the other findings has an owner.

---

## 9 · Verdict

**Authorization refused as things stand, for three reasons that have
nothing to do with the software.** Meridian is better instrumented
than most tools this committee examines — indelible transactional
trail, a single, tested authority model, sensitive views logged,
explicit honesty about what is not configured — but there is today
neither a proven backup, nor a recovery plan for the single machine
carrying it, nor a legal basis for a health data item that the schema
accepts and that the trail renders unerasable.

**These three points close within a few days**: two half-day product
changes, one timed restore test, and four pages signed by the
sponsor. The committee declares itself ready to grant authorization
on evidence of these measures, with no further session.

> English translation of [`docs/29-comite-international-saas.md`](../29-comite-international-saas.md). The French original is the authoritative record; where they differ, the French governs.

# 29 · International, SaaS and multi-tenant committee

**Mandate.** "Make sure Meridian works multi-country, multi-site,
and all the way to multi-tenant SaaS; drive this strategy and deliver
the best product with the best approach; identify all the
languages to cover; and make sure the application runs on the
full version of PostgreSQL." — sponsor, 08/31/2026.

**Composition — eight seats.** A group CIO of a mining company present on
three continents · a SaaS architect who operates a fleet of 400 instances ·
a data-protection lawyer (international transfers) · a
subsidiary CFO (currencies, consolidation) · a professional
translator specialising in project governance · an infrastructure
operator · the product owner ([`23`](../23-comite-produit.md)) · a
member of the GRC committee ([`20`](../20-comite-infosec-grc.md)).

---

## 1 · What is already true, verified in the schema

The committee began with the inventory, because a plan that asks again for
what already exists is a plan that has not read:

| Capability | Where, verified |
|---|---|
| Time zones per site | `site.tz_offset` + `tz_name` since 001; the night-time silence of notifications honours it |
| Multiple currencies at entry | `cost_line.currency` + `fx_rate` **at the time of the write** (012) — the rate is fixed, never recalculated |
| Full EN/FR bilingual | 986 entries, gate F5 which fails on any missing label, server-side `X-Lang` |
| Legal condition per country | G-14: no site enables time entry without social and legal advice from ITS OWN country |
| Authority per site and per programme | the entire access model (R1.*) |
| Data portability of a tenant | the archive and `npm run restore` (M-01) |

What is genuinely missing: the **country** of a site (the `region` column
is free text), the legal entity carrying it, more than two languages, and
the entire multi-instance operations layer.

---

## 2 · The fundamental decision: how to be multi-tenant

This is the heaviest decision of the mandate, and the committee took it
first because everything else follows from it. Three paths exist.

**Path A — the `tenant_id` column everywhere.** The classic SaaS approach: one
database, all customers' data, a discriminator column on every table and
a `WHERE` clause on every query.
**Refused, and firmly.** This product sells an immutable audit trail to
industrial groups that are sometimes competitors. Under path A,
**a single forgotten `WHERE` clause shows one mining group's portfolio to
another** — and this product already has more than forty
tables and hundreds of queries. The gate that would check this does
not yet exist, and the day it fails, the product would be dead.
Isolation by coding discipline is not isolation.

**Path B — one PostgreSQL schema per tenant.** Better isolation, but
the worst of both worlds operationally: a shared cluster where every
migration replays N times, entangled backups, and a version
upgrade that breaks for everyone at once.

**Path C — one instance per tenant.** A process and a database per
customer, orchestrated behind a proxy. **This is the path chosen**, and not
out of caution: because this product is already built for it, without
knowing it.

- The binary is **a single file** that applies its migrations at
  startup: provisioning a tenant means starting a process.
- Archive M-01 is **the tenant's portability**: a customer enters,
  leaves or switches hosting with one open file.
- The reporting currency, the thresholds, the trusted hosts are
  instance settings — under path C, **each group has its own**, which
  is exactly what a multi-country group requires. Under path A it would
  have had to be fully re-partitioned.
- Isolation is at the system level, not a `WHERE` clause: an
  application defect cannot cross two databases.
- Version upgrades are deployed **tenant by tenant** — we just
  lived through why that matters: migration 023 applied under an
  older binary would have knocked the service down.

> **Meridian's SaaS offering is therefore not a rewrite of the product: it is
> the business of operating a fleet of instances.** What needs to be
> built is the fleet layer — provisioning, monitoring, version
> upgrades, backups — and the few affordances the product must
> offer to be operable as a fleet. That is the SaaS-* register.

The cost, accepted: one instance per customer costs more than a row
in a shared database. The committee accepts this openly — the target
buyer is a group at 45–85 k€/yr ([`24`](../24-comite-marche.md) §5), not
self-service at €9/month. At that price, real isolation is a
selling point, not a cost.

---

## 3 · Full PostgreSQL — the sponsor's instruction, and its form

The sponsor asks that the application run on the full version of
PostgreSQL. The state of play: the Windows installer already provisions
PostgreSQL 17 (EDB download, initdb, service, generated role and
password) and this machine's production runs on it. PGlite —
PostgreSQL compiled to WebAssembly — remains the engine for the demo,
the training ground and the tests.

The committee turns the instruction into a verifiable rule rather than an
intention:

1. **PGlite is a trial engine, never an operational one.**
   Single-connection, no hot backup, fragile against hard stops —
   three properties unacceptable for a governance book.
2. **A service installation REFUSES to start on PGlite.** The
   package sets `MERIDIAN_REQUIRE_POSTGRES=1` in the service
   configuration; a startup without `DATABASE_URL` then fails with a
   message saying what to do, instead of running silently on the
   wrong engine. This is register line PG-01, delivered with this
   report.
3. `/api/health` already states the engine; the SaaS fleet will use it
   to alert on any instance not on PostgreSQL.

---

## 4 · Languages

The committee's translator asked the question in the right order: **not
"which languages," but "which mechanism."** A product that hard-codes its
list of languages pays a heavy price for each addition — and that is
exactly the current state: the switch is an EN/FR boolean, and the
database constrains `locale IN ('','en','fr')`.

**Decision 1 — the language register first.** Adding a language must
be: a dictionary, an entry in a register, nothing more. This is
line I18N-01, delivered with this report.

**Decision 2 — languages, by the real geography of the target market.**
Mining and multi-site industrial groups operate where they operate:

| Priority | Language | Why |
|---|---|---|
| delivered | **English, French** | the pilot group (West Africa) and the lingua franca |
| 1 | **Spanish** | Peru, Chile, Mexico, Argentina — the largest mining basin in the world outside English-speaking countries |
| 2 | **Portuguese** | Brazil, Mozambique, Angola |
| 3 | Arabic | North Africa, Middle East — **deferred with reason**: right-to-left writing is an entire interface undertaking (mirroring the layout, tables, charts), not a dictionary. Announcing it before knowing how to do it would be the lie this product refuses everywhere else |
| 4 | Russian, Chinese | Central Asia, financing — on request from a real customer, not before |

**Decision 3 — the translation policy, in writing.** Governance
vocabulary does not translate word for word ("baseline", "tolerance",
"earned value" have standard-defined equivalents per language — ISO 21502 is
published in Spanish). A machine- or AI-produced translation is
accepted **as a draft**, marked as such in the language
register, and a language only loses that mark after review by a
native speaker of the field. The interface can display a language as a
draft; it says so.

**Decision 4 — the server follows.** `X-Lang` and `say()` already exist; authority
refusals are already bilingual. Every language added also covers
these messages — a refusal is the worst moment to switch language.

---

## 5 · The register

Same rules as registers 26 and 27: each line states what its absence
costs.

| # | Line | What it costs today | Effort |
|--:|---|---|---|
| **PG-01** | **The service refuses PGlite.** `MERIDIAN_REQUIRE_POSTGRES=1` set by the installer; startup refused with a message. | A misconfigured installation runs SILENTLY on a single-connection engine with no backup — and it is discovered the day it is needed | **CLOSED 08/31** — real startup refused, exit code 1, message naming DATABASE_URL; the installer sets the flag, the PGlite fallback removes it |
| **I18N-01** | **The language register.** The list of languages becomes data; the switch becomes a cycle; the database constraint widens. | Every language costs surgery instead of a dictionary | **CLOSED 08/31** — LANGS + DICTS register, cycling switch, form constraint in the database (027), server SERVER_LANGS; exercised in the browser: FR→EN cycle, html lang follows |
| **MC-01** | **The site's country and legal entity.** ISO 3166 country code, legal entity carrying it. | G-14 requires advice "from its own country" and the product cannot say a site's country; a GDPR request cannot say which entity responds | **CLOSED 08/31** — migration 027, form, "br" turned into BR, entity recorded through the real dialog |
| ~~**I18N-02**~~ **CLOSED 09/01** | **Spanish.** Client dictionary 1053/1053 + fragments 47/47 (parity held by gate F5, now multilingual) + server refusals and notifications (`i18n-es.js`, `es` in SERVER_LANGS). **Draft until reviewed by a native speaker** — the `(draft)` flag stays on the switch, and the review is an open line, not a memory. | The largest mining basin outside English-speaking countries cannot deploy | 2 d |
| **I18N-02b** | **Native review of Spanish.** A native speaker reviews the 1053 entries and the 47 fragments on a real deployment; the `draft` flag falls only at this review, not before. | An unreviewed assistant translation can teach an entire site a wrong term | 1 d, with a real customer |
| **I18N-03** | **Portuguese.** Same rule. | Brazil, Mozambique, Angola | 2 d |
| **MC-02** | **Local formats.** Dates and numbers in the format of the displayed language (month labels are hard-coded English). | "03/04" reads in two different orders depending on the reader — at a milestone, that is an incident | 2 d |
| **SaaS-01** | **First startup without a console.** A fresh instance welcomes its first administrator through the screen (today: `admin-handover` on the command line). | Provisioning a tenant requires shell access — unacceptable at fleet scale | 3 d |
| ~~**SaaS-02**~~ **CLOSED 08/31** | **Version-skew guard.** The binary refuses a database carrying migrations newer than itself. | The 023 trap lived through this very morning: an old binary on a fresh database fails query by query instead of refusing outright | ½ d |
| **SaaS-03** | **Per-instance backup, proven.** Orchestrated `pg_dump` + timed restore. | This is G-01, still open — blocking BEFORE any external customer, not after | 2 d + operations |
| **SaaS-04** | **Instance identity in `/api/health`** (tenant name, engine, migrations) for fleet monitoring. | A fleet with no identity is monitored blind | ½ d |
| **SaaS-05** | **Fleet operations handbook.** Proxy, TLS, provisioning, tenant-by-tenant version upgrades, templates. | Every deployment reinvents it; the mistakes are new every time | 3 d, documentary |

**Order.** PG-01, I18N-01 and MC-01 are delivered with this report. Then,
in the [`28`](../28-goal-market.md) loop and respecting its alternation:
SaaS-02 (the trap is still hot), I18N-02, SaaS-04, MC-02, I18N-03,
SaaS-01, SaaS-03, SaaS-05.

---

## 6 · What the committee refuses

- **The `tenant_id` column** — see §2. This refusal is architectural and
  is only reopened with an argument §2 has not already weighed.
- **Announcing Arabic before knowing how to do right-to-left.**
- **Translating screen names halfway.** A language enters the register
  complete (interface, help, manual, server refusals) or not at all — round 1
  of the re-test loop already showed what a dictionary that lags
  behind costs (170 missing labels masked by the fallback).
- **A reporting "multi-currency mode."** The reporting
  currency stays ONE per instance; entries already carry their own currency and
  rate. Consolidating into several reporting currencies is a
  financial consolidation business, not project governance — an
  export to the consolidation tool (INT-05/INT-11) is the right
  boundary.

---

## 7 · What this report does not claim

It does not claim "multi-tenant" is finished once its lines are
closed: the fleet layer (SaaS-05) is an operations business that
proves itself by operating, not by shipping. And it does not claim a
language is "covered" because a dictionary exists — the
"draft" mark only lifts through a native speaker, and the committee will hold
this line even if it delays a sale.

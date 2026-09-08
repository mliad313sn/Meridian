> English translation of [`docs/24-comite-marche.md`](../24-comite-marche.md). The French original is the authoritative record; where they differ, the French governs.

# Market committee — is Meridian IT-PMO worth buying, and by whom?

Date: 30 August 2026. Eighth committee, and the first with no stake in
whether this product exists.

The seven previous ones looked at Meridian **from the inside**: is it
correct ([`06`](../06-amdec-uat.md), [`18`](../18-amdec-recette.md)), is it
safe ([`20`](../20-comite-infosec-grc.md), [`21`](../21-campagne-securite.md)),
is it usable ([`19`](../19-comite-adoption.md)), is it governable
([`16`](../16-comite-independant.md), [`23`](../23-comite-produit.md)). Each
asked the product to do what it does better.

This committee asks a question none of them asked: **would anyone buy
this, at what price, against what, and what happens if no one buys it.**
It asks for no feature. It clears no reserve. It makes no engineering
decision. It renders a market opinion, and it begins by noting that half
of what a buyer evaluates **does not exist in any of the twenty-three
preceding documents**.

---

## 1 · Composition — eight seats

Each states what it has come to verify. None comes to verify code
quality: five committees have already done that, better than this one
would.

| Seat | What it has come to verify |
|---|---|
| **PPM sector analyst** — EPPM / SPM / work-management coverage | "Which box does this product fall into, and does that box have buyers?" |
| **CIO of a mid-cap gold-mining group** — three mines, eight sites, ~200 potential users (the target customer) | "What am I replacing, and who answers when it goes down on a Sunday?" |
| **Integrator** — PPM rollouts in mining, West Africa | "How many days to bring a site onto this, and what do I lean on when I train?" |
| **Head of software procurement and third-party risk** | "Can I buy this? From whom? Under what contract? What does the vendor questionnaire come back with?" |
| **Declared competitor** — sales director of a Planview / Smartsheet reseller, invited to lose | "How do I make this bid lose?" |
| **Management controller** — total cost of ownership and key-person risk | "What does this cost over five years, and who owns the risk?" |
| **Potential reference customer** — PMO director at a second mining group | "Under what condition would I agree to be cited?" |
| **Support and operations lead** — the one who would hold the contract | "On what version, with what commitment, and who takes the call?" |

The competitor's seat is deliberate. A market committee that does not give
voice to whoever wins the deal writes a brochure, not an opinion.

---

## 2 · What the committee established before judging

No figure in this section is an impression. Everything was executed or
read off the tree as of 30/08/2026.

| Finding | Measure | Source |
|---|---|---|
| Tests | **315 tests, 38 suites, 0 failures, 47.7 s** | `npm test`, executed |
| Audit gates | **6 green**: routes, CRUD+audit, versions, controls, language (F5), field aid (F6) | `npm run audit`, executed |
| Field-aid coverage | **49 / 56 forms (88%)**, target 80%; **17 / 17 fields read by a third party (100%)** | F6 output |
| Vulnerable dependencies | **0** (`--omit=dev`, *high* threshold) | `npm run audit:deps`, executed |
| Migrations | **22** (`001_core` → `022`) | `server/migrations/` |
| Screens | **20**, across five intents | `web/src/main.js:29-48` |
| HTTP routes | **144** | count over `server/src/routes/*.js` |
| Published API spec | **0** — no OpenAPI, no Swagger | grep on the repository |
| Built client | **371 KB raw / 115.8 KB gzip** (+ 6.3 KB CSS) | `npm run build`, executed |
| French dictionary | **829 client keys + 62 server keys** | `web/src/lib/i18n.js`, `server/src/i18n.js` |
| Installer | **`dist/MeridianSetup.exe`, 34.5 MB**, dated 30/08 | `dist/` |
| Repository | **16 commits, a single author** | `git log` |
| Licence file | **none** — no `LICENSE`, no `SECURITY.md`, no `CONTRIBUTING` | repository root |
| Multi-tenancy | **none** — no tenant column across the 22 migrations | `server/migrations/` |
| Backup | **none** — `pg_dump` appears nowhere | `scripts/`, `dist/Meridian/` |
| Real usage | **0** — the production book is empty, one account active, 8 of 8 sites silent | [`19`](../19-comite-adoption.md) A-08, [`23`](../23-comite-produit.md) §2.1 |

These last two lines govern everything else in this report.

---

## 3 · The benchmark, replayed

[`14`](../14-endeavour-value-review.md) §"The benchmark" was written on
29/08, **before** the campaigns. Six columns were marked "behind — gap."
The committee re-runs the table line by line and gives the position as of
30/08, with its proof.

Three ratings, as in the original: **ahead** / **at par** / **behind**. Two
additions from this committee, because the original could not make them:
**tooled, not proven** — the function exists and no real usage has
exercised it — and **product ≠ operations**, when the software keeps its
promise and the rollout does not keep it.

| Capability | Position 29/08 | Position 30/08 | Proof |
|---|---|---|---|
| Group ↔ site governance as data | ahead | **ahead, unchanged** | `shared/rbac.js` (454 lines), 25 `rbac` tests, sweep of 286 cases × 4 roles |
| Committee cadence, generated agenda, minutes, referrals | ahead — unique | **ahead, unchanged** | `shared/meetings.js` (514 lines), 22 `meetings` tests |
| Separation of duties at the milestone | ahead | **ahead in design, nil in operation** | The rule holds (`preuve.test.js:75`, S-06 fixed); but the administrator is exempt from it and **the only active account is the administrator** (S-13). No independence control applies to anyone today |
| Append-only trail with before/after images | ahead | **ahead, reinforced** | `RULE audit_no_update` / `audit_no_delete` (001); CRUD+audit and versions gates green; health data taken out of the schema (017, G-03) |
| Milestones with evidence | at par | **ahead** | SHA-256 fingerprint frozen at approval (014), `supersedes` lineage, **and an hourly probe that re-verifies an approved link still responds** (020, `probe.test.js`, 8 tests). No competitor on the table does the third point. *Reserve*: `documentHosts` empty by default ⇒ no approval possible until the sponsor answers (ACC-3) |
| EVM (SPI/CPI/EAC) | at par | **at par, with caveats to state** | Linear EV against the baseline; **EAC = BAC/CPI, single formula**; **ETC never computed**; indices **forced to 1** below 2% progress (`shared/engine.js:121-129`); progress is a declarative percentage, with no 0/50/100 or physical measure |
| Planning depth (CPM, levelling, calendars) | behind | **behind, and refused** | Real forward/backward CPM (`engine.js:179-201`) but **FS links only** (`002_portfolio.sql:64`), **no lag**, **no date constraints**, **calendar days** — `workdays()` exists and **is never called**. No levelling. [`23`](../23-comite-produit.md) §5 refusal no. 1 names and refuses these |
| **Benefits and value realisation** | **behind — gap** | **at par, tooled not proven** | `008_benefits.sql`: type, baseline, target, measure, owner, date, PIR verdict; `attainment()` reads the fraction of the intended *movement*; 7 tests, including the separation of measure from verdict. **No real benefit has ever been measured** |
| **Portfolio roadmap** | **behind — gap** | **at par** | `web/src/views/index.js:2323-2422`: eight quarters, lanes by programme, RAG-coloured bar, governance milestones **and** intrusive milestones marked. *Reserve*: **no test covers this view** |
| **Prioritisation, scenarios, envelope** | **behind — gap** | **partially closed** | Four 1-5 scores, a score total, manual rank, running total and a waterline against `capexEnvelope` (`engine.js:445-473`, `pipeline.test.js`). **No what-if simulation**: 0 occurrences of `scenario`, `defer`, `accelerate` anywhere in the repository. The benchmark's word "scenarios" remains unmet |
| Demand intake | behind | **at par** | `demand` table, New→Converted statuses, mandatory reasoned refusal, conversion to a project preserving the thread; 5 tests, including "a site lead does not decide their own request" |
| Depth of resource management | behind | **behind, less so** | Rotation, availability, employee/contractor, supplier, capitalised effort (012); timesheets (016). But `effectiveFte()` **is not wired to `capacity()`**: load ignores availability and absences |
| Financial depth (capex/opex, FX, commitments) | behind | **partially closed** | Capex/opex on lines **and** commitments, currency and rate frozen at the line, an amendable `commitment` table, `moneyPosition()` (012, `money.test.js`). **Missing**: period-end forecast, FX reference table, rate card |
| **Notifications and reminders** | **behind — gap** | **product ≠ operations** | Built: in-app centre (018), subscriptions (019), escalation, purge, **hourly scheduler under an advisory lock** (`server/src/index.js:278-295`), 9 `centre` tests. **Not kept**: `deliver()` **is never called outside the tests** — nothing ever goes out, whatever the configuration; `MERIDIAN_SMTP_URL` exists only as a display label (`admin.js:254`); the `notification_subscription` table **is never read**; the `digest` kind is declared and never emitted |
| Integration ecosystem | behind (SDP only) | **behind, no movement** | One integration, proprietary (SDP, contracts C1–C6), **inert by default**; 144 routes and **no OpenAPI**; **no connector** for Jira, MS Project or Excel; no outbound webhook (`notifyHosts` is a setting with no emission code); CSV import **create-only**, on three objects |
| Mobile / offline / low bandwidth | behind | **behind on mobile, ahead on bandwidth** | **122 KB gzip for the entire application** — an order of magnitude below any competitor on the table, and this is the VSAT argument. Touch targets ≥ 24 px held (R-05). Read-only offline built (`web/public/sw.js` + snapshot), 6 tests — but **the service worker's effect has never been observed**, the admission is in the test itself. Three breakpoints, one bundle, no native app |
| EN/FR to the group's vocabulary | ahead *when complete* | **ahead, and proven by a gate** | 829 client keys, 62 server, notification composed in the recipient's language, **the build fails if a label falls back to English** (F5). No competitor on the table fails its build over a missing translation. *Honest reserve*: **exports are not translated** — columns and classification banner remain hardcoded English (`portfolio.js:2514, 2531`) |
| Fit to *this* operating model | ahead — it is the model | **ahead, and also the ceiling** | See §4: what makes the product unbeatable at Endeavour is exactly what makes it hard to sell elsewhere |
| Licence cost at ~200 users | ahead — nil | **ahead, now costed** | See §5 |
| Time to first governed committee | ahead — days | **contested** | The tool installs in an hour. But [`20`](../20-comite-infosec-grc.md) §9 refuses authorisation to carry real data, and [`23`](../23-comite-produit.md) §6 dates R2's opening to four sponsor decisions. **Days for the software, weeks to months for permission to use it** |

### The six lines that moved, without flattery

Four of the six "behind — gap" columns are genuinely closed:
**benefits**, **roadmap**, **intake** and **prioritisation** (except for
scenarios). A fifth, **financial depth**, is two-thirds closed. The
sixth, **notifications**, is the most interesting case in the report: the
product built more than the benchmark asked for — a centre,
subscriptions, escalation, a scheduler — and **sends nothing at all**. The
committee does not call this "closed." It calls it *product ≠
operations*, and this is a category that will come back.

### What the original table could not see

Six lines this committee adds. They are not about the software: they are
about what a buyer evaluates before opening the software.

| Capability | Competitors | **Meridian** | Proof |
|---|---|---|---|
| **A publisher** — legal entity, licence, named owner | yes | **absent** | No `LICENSE` in the repository |
| **Support contract, restoration commitment, on-call rota** | yes | **absent** | No document sets a response time; the support seat has nothing to read |
| **Response to a vendor security questionnaire** | yes | **absent** | The four policies (G-04) are not written. [`23`](../23-comite-produit.md) line 440 already says it: "the first security questionnaire from a mining client remains unanswered, whatever the quality of the product" |
| **Verifiable supply chain** | yes | **behind** | Binary **unsigned** — Windows cannot name any publisher for an executable run under LocalSystem (S-16); `.npmrc` still disables the registry's TLS verification (S-18) |
| **Customer references, published case studies** | yes | **zero** | The production book is empty and the 8 sites are silent |
| **Proven backup and restore** | yes | **absent** | `pg_dump` appears nowhere; G-01 is still open. The book **and** the trail live on a single disk |

The committee stresses the nature of this second table. **None of these
six lines is fixed by software.** Five of them are fixed by a signature or
a purchase. This is exactly the diagnosis [`23`](../23-comite-produit.md)
renders internally — "the product is not short of features, it is short
of authorisation" — and this committee finds it holds, word for word,
externally too.

---

## 4 · Positioning

### The segment on which this product wins

**An industrial multi-site group, 5 to 20 sites, 500 to 5,000 people,
whose CIO runs 10 to 40 projects a year, and whose problem is not
scheduling but keeping the decision rhythm between the group and the
site** — in two languages, over constrained links, with an audit-evidence
requirement a spreadsheet cannot meet.

Mining, cement, agro-industrial, ports, water and electricity operators in
emerging markets. The common thread is not the sector: it is the
geometry. A centre that decides and sites that execute, a satellite link
between the two, and an auditor who shows up once a year.

In this segment, Meridian holds three things no product on the table holds
together: the site → group referral modelled as data, the agenda that
builds itself from portfolio state, and 122 KB gzip that loads over a
degraded link.

### Segments not even worth competing in

- **Any bid requiring an analyst quadrant.** No coverage, no publisher.
  The scorecard fills up with "no."
- **Engineering and capital projects where the schedule is the
  deliverable.** FS links only, no lag, no calendars, no levelling.
  Primavera wins, and deserves to.
- **General-purpose collaborative work management.** Smartsheet and Monday
  do better, cheaper, and Meridian explicitly refuses to be a task
  manager.
- **Anything requiring multi-tenant SaaS, a native mobile app, an
  integration marketplace, or SOC 2.** The product has no tenant column,
  no native app, no OpenAPI. This is not a lag, it is the absence of a
  project.
- **A customer who already pays for an enterprise PPM licence and does not
  use it.** Their problem is governance discipline, not the tool. Selling
  software to this customer is selling a second shelf.

### Who buys, on what trigger, and what they are really weighing against

**The buyer is the group PMO director or the group CIO**, never the site.
The site is the user and the first obstacle, not the payer.

**The purchase trigger is almost always a failure of narrative**, not a
need for a feature: an audit remark on the decision trail, a board
question no one could answer ("what has this portfolio delivered us?"), a
steering committee that redecided the same thing three times, an IPO or a
new compliance requirement.

**And it almost never competes against a competitor.** It competes
against **a shared spreadsheet, a monthly meeting and a slide deck** —
that is, against the status quo, which is free, familiar to everyone, and
whose cost no one has ever measured. That is the real opponent, and it is
good news: against a spreadsheet, Meridian wins on the audit trail, on the
referral, on the generated agenda, and on the fact that a frozen figure
does not move again. Against Planview, it loses on the grid.

### The value proposition, in one sentence

> **"We replace the spreadsheet and the monthly meeting with a portfolio
> whose agenda builds itself, where every decision remains replayable
> before your auditor three years later, and which works in French from a
> site on a satellite link — with no per-seat licence."**

It is said cold, it fits in one breath, and each of its four claims is
proven by a test or a gate.

### The anti-proposition

The cases where the salesperson must recommend something else, and say so
immediately. A product that cannot decline a deal loses its credibility
on the next one.

| If the client says… | Recommend |
|---|---|
| "My problem is holding a three-thousand-task schedule with shutdown calendars" | Primavera P6, or MS Project. Meridian has FS links and calendar days |
| "I want everyone collaborating on their tasks" | Smartsheet or Monday. Meridian does not even draw a command an account cannot use — that is the opposite of an open collaborative tool |
| "One site, one PMO" | Project for the web and a good document template. All of Meridian's value is in the group ↔ site tension: without it, only the friction remains |
| "I need a mobile app and SSO with MFA next month" | Do not compete. SSO exists and has never completed a real login; the mobile app does not exist |
| "We already pay for Clarity, have for four years" | Do not sell software. Sell, possibly, the method: the committee cadence and the referral model can be described in thirty pages |

---

## 5 · The business models

Four scenarios. For each: what it requires that the product does not have,
and what it earns.

### A · Internal tool for the group (status quo)

**What it still requires.** The ten sponsor decisions of
[`23`](../23-comite-produit.md) §6, four of which are on R2's critical
path; the proven backup (G-01); the four policies (G-04). Nothing else.
This is the only scenario requiring no new build.

**What it earns.** A licence saving, and honesty is needed about its
order of magnitude. The committee refuses to count the saving against
Planview: this group would never have bought Planview. The realistic
alternative it would eventually have bought is **Project Plan 3 for 50 to
80 planners (~$30/user/month) or Smartsheet Business for 200 seats
(~$19 to $32/user/month)** — that is, **$20,000 to $75,000 per year** of
avoided spend, to which neither would have added the audit trail or the
referral.

**The real return is elsewhere**, and it is not monetary: it is being the
only place where the decision trail exists (condition 1 of the thesis,
held). The committee notes this and refuses to price it.

**The status-quo risk** is the worst-covered of all: one repository, one
author, no contract, no backup. The day the author stops, the group loses
its decision source and no one can say how long it takes to get it back.

### B · Product sold to other mining groups

**What it requires that the product does not have** — the six lines of
§3: entity and licence, a support contract with deadlines, a code-signing
certificate, a vendor security dossier, a callable reference, a proven
backup. Plus, on the product side: a documented version-upgrade path for
the customer (it exists and is written only in `docs/13`), and an exit
guarantee — an open export of the book **and** the trail, which today
only half exists (the administrative JSON export does not contain the
trail and has no re-import path).

What the product does **not** need to acquire, contrary to intuition:
multi-tenancy. This market wants on-premises installation. One database
per customer is a commercial advantage, not a debt.

**What it earns.** The segment is narrow and nameable: the committee
estimates **30 to 80 groups** worldwide of the right geometry (mid-cap
mining, cement and agro-industrial, 5 to 20 sites, francophone or
bilingual). Reaching **5 to 15 customers in three years** is a credible
target; beyond that, a sales team is needed, which changes the nature of
the undertaking.

### C · Open-source software with paid support

**What it requires.** A licence, a public repository, English-language
documentation, an OpenAPI, a community. None of the five exists.

**What it earns.** Little, and this is exactly the one defensible
advantage. What sets Meridian apart is not its code — 13,500 lines a good
developer would rewrite — it is **the operating model it embodies**.
Opening it up publishes for free the one thing that cannot be copied by
configuration. The committee sets this scenario aside, and not for
ideological reasons: for an asset reason.

### D · Vertical, multi-sector product

**What it requires.** Stripping out of the model everything that is
mining-specific — shutdown windows, intrusive milestones, FIFO rotations,
site-by-site rollout waves — and turning it into configuration. This is a
schema redesign, not a settings change. Plus everything scenario B
requires.

**What it earns.** A larger addressable market and a weaker proposition.
The committee notes that the advantage sold in §4 is precisely
**non-genericity**: "configurable" is the word Planview puts in its
column, and no one wins against Planview on that word.

### The recommended scenario, and its price range

**Recommendation: A for four quarters, then targeted B.** Scenario B does
not open through engineering work: it opens through a reference, and the
only reference available is Endeavour itself.

**Pricing form: a group subscription, unlimited seats.** The committee
sets aside a perpetual licence with 20% maintenance: it rewards delivery,
not presence, whereas what the product needs to learn to sell is exactly
presence.

> **€45,000 to €85,000 per year per group, unlimited seats**, plus a
> flat-rate **onboarding fee of €25,000 to €60,000** in the first year
> (eight sites, two languages, data migration, training of site leads).

**The floor.** Below €45,000, the publisher does not fund a full-time
support engineer — one is needed to hold a restoration commitment, and
three customers at €45,000 cover their fully loaded cost. A lower price
would not be aggressive, it would be unverifiable: the buyer would rightly
conclude that there is no one at the other end of the line.

**The ceiling.** Above €85,000, the buyer moves the file into a formal
tender procedure. From there they will demand the analyst quadrant, SOC
2, the mobile app and the three references — and Meridian loses on the
grid before being seen.

**Anchoring against the customer's alternative.** A comparable Planview
deal, at 200 seats, runs on the order of **$600 to $1,020 per user per
year at list price**, i.e. $120,000 to $204,000 per year, typically
discounted 25 to 40%, plus integration. Over five years, the buyer is
therefore comparing roughly **€110,000 to €250,000** for Meridian against
**€500,000 to €1,000,000** for the enterprise alternative — a factor of
four to five, with the data staying in-house. This is a gap that can be
defended in a meeting without having to lie about missing features, and
it is the only honest way to sell this product.

*(Public orders of magnitude, recorded 30/08/2026; not verifiable within
the repository and stated as such.)*

---

## 6 · The three obstacles that would kill a sale

### Obstacle 1 · The publisher does not exist

**The finding.** There is no entity, no licence, no contract, no
restoration commitment, no on-call rota, no signing certificate —
Windows cannot name any publisher for a binary installed under LocalSystem
(S-16). The repository carries sixteen commits from a single author. The
four security policies (G-04) are not written: **a mining buyer's
third-party questionnaire stops at question three.**

**What it takes to lift it.** An entity and a licence file; a one-page
support contract fixing two deadlines (acknowledgement, workaround) and a
named person; purchase of the code-signing certificate; the four policies
signed. Three months, two of paperwork and one purchase. **No line of
code.**

### Obstacle 2 · Zero real usage

**The finding.** The production book is empty, one account is active, no
benefit has ever been measured, the eight sites are silent, no restore has
ever been tested, no customer can be called. The product's own security
committee **refuses in writing** the right to carry real data
([`20`](../20-comite-infosec-grc.md) §9).

**What it takes to lift it.** Two quarters of real operation at Endeavour,
and publication of the six adoption indicators. The committee notes that
**the measuring instrument is already built** (A-08, *Adoption* screen,
dated baseline, `adoption-measure.test.js`) — it is the only commercial
asset this product can manufacture without writing a line of code, and it
cannot be manufactured any faster than six months.

### Obstacle 3 · Key-person risk, and nothing to cover it

**The finding.** One author, no published API, no trained integrator,
13,500 bespoke lines with no framework anyone else knows (a homegrown DOM
builder, no front-end library). No escrow, no second maintainer, no exit
clause. The procurement lead will ask the question in this form: *"and in
three years?"* — and today the honest answer is silence.

**What it takes to lift it.** A code escrow with a third party under a
written release condition; a second engineer able to run `npm run verify`
on a fresh machine, witnessed and dated; a reversibility clause backed by
an open export of the book **and** the trail — half of it already exists
(portfolio CSV, Markdown evidence pack, book JSON), what is missing is the
trail and a re-import path.

### The competitor's best attack

*Written by the competitor's seat, in their own voice, at their request.
The committee publishes it unsoftened.*

> I won't attack it on features. I'd lose: their audit trail is better
> than mine, their agenda builds itself, and I have nothing that resembles
> their referral model. So I don't talk about the product.
>
> I ask the buying committee three questions, in this order, and I go
> quiet.
>
> **1. "Show me the customer I can call."** There isn't one. Their own
> security committee still forbids them, in writing, from carrying real
> data. They're selling you a governance tool that has never governed.
>
> **2. "Who signs the restoration commitment, and on which version?"** No
> publisher, no contract, no tested backup — and the executable you're
> about to run with system privileges on your server, Windows can't tell
> you who wrote it.
>
> **3. "And in three years?"** One repository, one author, no published
> API, no integrator trained anywhere in the world.
>
> Then I concede what I can't deny — their committee cadence and their
> trail are excellent — and I offer to **reproduce them on my platform as
> configuration**, six weeks of services, on a platform you'll still be
> able to buy in ten years. I turn their one advantage into a line item on
> my quote, and I walk away with the deal.

**What the committee answers, and what it cannot answer.** Reproducing it
as configuration is a **technical** bluff: no one reproduces, in
parameter settings, a rule like `audit_no_delete` set at the database
level, or a separation of duties evaluated inside the milestone gate, or a
build that fails on a missing translation. But it is a bluff **that
wins**, because the difference is invisible in a tender scorecard: both
lines get checked "yes."

This is the hardest finding in this report. **Meridian's real advantage is
not expressible in the format in which purchases are decided.** It can
only be demonstrated in execution — an auditor replaying a decision from
March, a site receiving an agenda it did not prepare. Which means this
product does not sell through a tender. It sells through proof of use, to
a buyer who has already been burned by an audit — which brings us back,
again, to obstacle 2.

---

## 7 · Verdict

**Meridian is a very good piece of software that is not yet a product:
everything a buyer evaluates first — a publisher, a contract, a callable
reference, a proven backup — is absent from the twenty-three preceding
documents, while everything seven committees have refined does not show
up in a tender scorecard.** It wins today against the spreadsheet and the
monthly meeting, at an industrial multi-site group that has already been
burned by an audit; it loses against any established vendor as long as no
one can call anyone on a Sunday evening.

### The recommendation, singular and dated

> **Attempt no sale before 31 March 2027.**
>
> Until then, one thing only: put Endeavour into real operation — R2
> closed on the dates already committed by [`23`](../23-comite-produit.md)
> §6, then two quarters of use — and **publish, on 31/03/2027, the six
> adoption indicators from the A-08 screen, with their baseline dated to
> the first day.**
>
> This record, and nothing else, is the first commercial asset this
> product can own. Without it, none of the four business models is open.
> With it, three become open — and obstacle 1 then closes in three months
> of paperwork and one purchase.

The committee adds the condition on which it would be wrong, as
[`22`](../22-comite-innovation.md) has taken to doing: **if, on
31/03/2027, fewer than four of Endeavour's eight sites are active in the
tool, scenario B is to be abandoned, not deferred.** A product its own
group does not use sells to no one, and continuing to prepare it for a
market would be the most expensive way of not admitting it.

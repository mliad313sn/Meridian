> English translation of [`docs/27-comite-interoperabilite.md`](../27-comite-interoperabilite.md). The French original is the authoritative record; where they differ, the French governs.

# 27 · Interoperability committee

**Mandate.** "Make sure the product can interface with various
ecosystems, the Microsoft suite in particular; the ultimate goal is to
make it an indispensable piece of software, usable everywhere, connected to
everything that makes sense." — sponsor, 08/31/2026.

**Composition — seven seats.** An integration architect from an
industrial group · a Microsoft 365 administrator from a site · a head
of financial systems (ERP) · an operations engineer who receives
alerts · a data-protection delegate · a third-party integrator
who makes a living plugging tools together · the product owner
([`23`](../23-comite-produit.md)).

---

## 1 · What the committee refuses before proposing anything

The committee began with the question no one was asking it: **how
does a product die of interoperability?**

Unanimous answer, and it comes from the experience of six of the seven members:
**by twenty half-built connectors.** Each demoable, none
usable in production; each broken at the first version bump of the
product on the other end; and a team that spends its year repairing pipes
instead of building the product. The committee's integrator put it plainly:

> "Show me a piece of software with a page listing thirty logos. I'll
> show you a piece of software where none of the thirty works in production
> at more than one customer."

**The committee therefore explicitly refuses:**

- any list of logos as an objective;
- any connector written for one specific third-party product when a
  **generic surface** would do the same job — an SAP connector is a
  contract with SAP, a documented API is a contract with everyone;
- letting Meridian become the system of record for data another system
  owns. People, real money and tickets belong
  elsewhere. Meridian holds the **governed projection** of them, timestamped,
  with its provenance — never the original.

**The rule that follows from this, and that this whole document rests on:**

> Meridian does not need twenty connectors. It needs **four
> surfaces**, done properly, and documented well enough that an
> integrator who does not know us can plug in their ecosystem without
> writing to us.

---

## 2 · The four surfaces

| | Surface | Question it answers | State |
|---|---|---|---|
| **A** | **Identity** | Who is this person, and what can they do? | OIDC seam built, never exercised; no provisioning |
| **B** | **Reading** | What does Meridian know, and how do you read it elsewhere? | CSV, ICS, evidence pack, archive — but **no published API** |
| **C** | **Writing** | How does another system feed Meridian? | CSV import only; a single service key, without scope |
| **D** | **Presence** | How does Meridian arrive where people already are? | notification queue ready, **no transport** connected |

What the committee found already in good shape on arrival, and which
changes the size of the job: the foundation of surface C **already
exists**. `server/src/federation.js` carries `generateServiceKey()`,
`requireServiceKey()`, a service account, and keeps only
the key's fingerprint. The `ext_link` table carries the provenance of
data coming from elsewhere. There is nothing to invent in the model: there is
only to generalise it from one integration to several.

---

## 3 · The register

Thirteen lines. Same rule as the conformance register
([`26`](../26-conformite-referentiels.md)): each states what its absence
costs, failing which it is not a gap but a wish.

| # | Line | Surface | What it costs today | Effort |
|--:|---|:--:|---|---|
| ~~**INT-01**~~ **CLOSED 08/31** | **Versioned public API + OpenAPI 3.1 description**, generated from the real routes and verified by a gate. | B/C | **Nothing is integrable.** An integrator has to read the source code to guess at a contract we do not commit to honouring. This is also the second question in the competitor's attack ([`24`](../24-comite-marche.md) §6). | 1 wk |
| ~~**INT-02**~~ **CLOSED 08/31/2026** | **Named, scope-limited integrations**: a key per connected system, explicit scopes (read-only, cost-writing…), rotation, and every act traced **under the integration's name**. | C | A single key, without scope, that can do everything. No way to say "the ERP wrote this", nor to cut off one third party without cutting off the others. Opening the API without this would be a fault. | 3 d |
| **INT-03** | **Entra ID connection proven end to end**, then **SCIM 2.0 provisioning** of accounts and groups. | A | Accounts are created by hand. That is the exact difference between a pilot on one site and a rollout across eight. A departure in the directory closes nothing here — the GRC committee has already flagged this (G-05). | 1 wk |
| ~~**INT-04**~~ **CLOSED 08/31** | **Signed outbound events** on governance facts: milestone passed, exception opened, change approved, committee decision. HMAC signature, replay, delivery log. | D | Other systems can only **ask**; they cannot **react**. This is what makes Power Automate, ServiceNow or any orchestrator unusable with Meridian. | 3 d |
| ~~**INT-05**~~ **CLOSED 08/31** | **Stable, documented SQL reporting views** (`reporting.*`), read-only. | B | Power BI, Excel, Tableau and Qlik all speak PostgreSQL natively. **This is the cheapest, most useful decision-support connection there is** — and it needs no connector at all. Today an analyst must read 23 migrations to find their columns. | 3 d |
| ~~**INT-06**~~ **CLOSED 08/31** | **Microsoft Teams transport** for the notification queue (incoming webhook, adaptive card, deep link to the relevant screen). | D | The queue works and **nothing leaves it**. People are in Teams; the tool is elsewhere. This is the first adoption obstacle, not an integration one. | 2 d |
| **INT-07** | **Real SMTP** for the same queue (ACC-1). | D | Same, for those not in Teams. A setting, not a build. | sponsor |
| ~~**INT-08**~~ **CLOSED 08/31** | **True meeting invitations** (iCalendar `METHOD:REQUEST`, organiser, attendees, updates and cancellations) instead of just a feed subscription. | D | A committee does not put itself in people's calendars. They miss it, and the tool gets blamed. | 3 d |
| ~~**INT-09**~~ **CLOSED 08/31** | **SharePoint and OneDrive as evidence hosts**: proven procedure, authenticated probe, and the documentation to go with it. | B | **It already works** via link and host allowlist — but no one knows it, and the probe reads `401` where an authorised access would read the document. The gap is three-quarters documentary. | 2 d |
| **INT-10** | **Progress input from Jira and Azure DevOps**: a project links to an external board, progress and incidents flow up, provenance is stamped. | C | The promise "Meridian sits above the team tools" is kept **only by hand**. This is the double entry everyone eventually gives up on. | 1 wk |
| **INT-11** | **Financial actuals from the ERP** (SAP, Dynamics, Oracle) via surface C rather than a connector per vendor. | C | Earned value is calculated on a hand-entered cost. A wrong CPI is worse than no CPI. | 3 d |
| **INT-12** | **Coordination with ITSM** (ServiceNow and equivalents): an operating window and a change request pass in both directions. | B/C | The model already exists (`site_window`, `plant_impact`, MOC approval) and speaks to no one. | 3 d |
| **INT-13** | **Receiving inbound events**, with an idempotency key and safe replay. | C | Without idempotency, a third party that retries creates duplicates in a governance register. | 2 d |

---

## 4 · The order, and why it is not up for debate

Four lines condition all the others, and delivering them out of
order would amount to opening a door before fitting the lock.

1. **INT-02** — named, scope-limited integrations. **Before**
   opening anything. Opening an API on a single, all-powerful key
   would be the most serious security fault this product would ever have
   carried, and it would be our own doing, not an inherited oversight.
2. **INT-01** — the described, versioned API. Without it, nothing to plug into.
3. **INT-05** — the reporting views. Three days, and it opens
   the entire decision-support ecosystem without writing a connector.
4. **INT-04** — outbound events. This is what makes Meridian
   *reactive* for others, not merely queryable.

Then, by descending adoption value: INT-06, INT-08, INT-09,
INT-03, INT-13, INT-10, INT-11, INT-12, INT-07.

**INT-07 (SMTP) is out of our hands**: it is a sponsor
setting, not a build. It is on the register so it stops being
forgotten, not so it is waited on.

---

## 5 · The five rules no integration will cross

Carried over from the federation work already done, because they have
already held once, and hardened by this committee:

1. **Closed by default.** An integration does not exist until its address
   and its key are set up. No host list ships pre-filled.
2. **Explicit scope.** A key says what it can do, and nothing more.
   A financial integration does not approve a milestone.
3. **Stamped provenance.** Any data from elsewhere carries
   where it came from and when (`ext_link`), and the screen says so. A figure
   without an origin does not display as a home-grown figure.
4. **Traced under the integration's name.** The audit trail names the
   system that wrote, never an anonymous "system."
5. **Reversible.** Unplugging a third party must break nothing beyond
   what it contributed. What it wrote stays, with its provenance.

---

## 6 · The committee's position on "indispensable"

The committee was mandated to make the product indispensable. It gives
a different answer than expected, and stands by it.

**A tool does not become indispensable by plugging in everywhere. It
becomes so by being the one place a question has its answer.** For
Meridian, that question is: *"who decided what, when, on what
evidence, and does it still hold?"* None of the thirteen connections
above addresses that; they make it **reachable from the places where
people work**, which is necessary and not sufficient.

The committee therefore warns about the risk in its own mandate: thirteen
integration lines delivered while the conformance register
([`26`](../26-conformite-referentiels.md)) stays open would give a
product very well connected **to incomplete content**. It recommends
running the two registers **in alternation**, rather than one after
the other — which is exactly what the delivery loop described in
[`28`](../28-goal-market.md) organises.

**What makes no sense to connect, and which the committee sets aside:** office
suites as a plan source (a re-imported Excel Gantt chart
destroys the baseline), instant messaging as a decision channel
(a decision made in a thread has neither evidence nor an
enforceable timestamp), and any system that would require opening
Meridian to the Internet to function — the outbound connection stays
outbound.

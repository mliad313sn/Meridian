> English translation of [`docs/28-goal-market.md`](../28-goal-market.md). The French original is the authoritative record; where they differ, the French governs.

# 28 · The march to a finished product

This document is the **single logbook** for the two registers opened on
08/31/2026 — standards conformance
([`26`](../26-conformite-referentiels.md), 13 lines) and interoperability
([`27`](../27-comite-interoperabilite.md), 13 lines) — plus whatever remained
open from the product logbook ([`23`](../23-comite-produit.md)).

The command that runs it is
[`/goal-market`](../../.claude/commands/goal-market.md). This document is
the state; the command is the engine.

---

## 1 · The alternation rule

The interoperability committee set, against its own interest, the
constraint that structures the whole plan:

> Thirteen integration lines delivered while the conformance
> register stays open would give a product very well connected to
> incomplete content.

**So: one conformance line, one integration line, in
alternation.** Never two from the same register in a row, except when one
strictly conditions the other — and that case is named every time it
occurs.

---

## 2 · The three releases

### R3 — "conformant, and connectable"

| Order | Line | Register | Why here |
|--:|---|---|---|
| 1 | **PM-02** lessons register | 26 | Milestone 4 of the product requires this evidence and the product has nowhere to put it. An internal contradiction is closed before any addition. |
| 2 | **INT-02** named, scope-limited integrations | 27 | The lock before the door. Opening the API on the current single key would be the worst fault this product has ever carried. |
| 3 | **PM-01** tolerances and management by exception | 26 | The mechanism that makes delegated authority safe. The biggest missing piece of governance. |
| 4 | **INT-01** published API + OpenAPI description | 27 | Without it, nothing is integrable — and it is the second question in the competitor's attack. |
| 5 | **PM-03** business case kept as a record | 26 | Closes the chain demand → business case → benefit → review. |
| 6 | **INT-05** SQL reporting views | 27 | Three days, and Power BI, Excel, Tableau and Qlik connect without a single connector being written. |

> **R3 IS PRONOUNCED — 08/31/2026.** The six lines are closed with a
> dated measure, `npm run verify` is green (396 tests, 9 gates), the
> sweep shows no new gap, and an exception has been opened then
> answered in the browser (PM-01). The product is "conformant and
> connectable" in the sense of §2.

**Condition for pronouncing R3:** the six lines closed with a dated
measure, `npm run verify` green, `npm run sweep` with no new gap, and an
exception opened then answered **in the browser**, not only in a test.

> **Committee 29 (08/31).** The international/SaaS register
> ([`29`](../29-comite-international-saas.md) §5) enters this logbook.
> PG-01, I18N-01 and MC-01 are delivered with its report; the rest joins
> the releases below while respecting the alternation — SaaS-02 first,
> because the trap it closes (an old binary on a fresh database) was
> lived through that same morning.

### R4 — "present where people work"

SaaS-02 (version-skew guard) · PM-06 (residual risk and the link to contingency) · I18N-02 (Spanish, in draft until reviewed by a native speaker) · INT-04 (signed
outbound events) · PM-08 (closure and transfer to operations) ·
INT-06 (Teams transport) · PM-04 (acceptance criteria and quality
reviews) · INT-08 (true meeting invitations) · INT-09
(SharePoint and OneDrive as evidence hosts).

### R5 — "deployable everywhere"

SaaS-04 (instance identity) · MC-02 (local formats) · I18N-03 (Portuguese) · SaaS-01 (first startup without a console) · SaaS-03 (per-instance backup = G-01) · SaaS-05 (fleet operations handbook) · PM-05 (stakeholders) · INT-03 (Entra proven then SCIM) · PM-09
(assurance reviews) · INT-13 (idempotent receiving) · PM-14 (strategic
alignment) · INT-10 (Jira, Azure DevOps) · PM-12 (skills) ·
INT-11 (ERP actuals) · INT-12 (ITSM) · PM-07 (scheduling
depth) · PM-10 (contracts and suppliers) · PM-11 (communication
plan).

**Outside the loop, because outside our hands:** INT-07 (SMTP), ACC-2
(Entra credentials), ACC-3 (real `documentHosts`), S-16 (signing
certificate), and the eleven organisational lines of the logbook
[`23`](../23-comite-produit.md) §3. They appear here so they stop being
forgotten, not so they are waited on.

---

## 3 · The definition of done, for each line

Carried over from the product committee's charter ([`23`](../23-comite-produit.md)
§4.4), unchanged, because it has already caught a fix delivered and
not logged:

1. the migration, the route, the serialised field, the form field and
   the test — **all five**, not four;
2. authority decided in `shared/rbac.js`, never in a route;
3. `npm run verify` green: 8 gates, and the test count **rises**;
4. the action **exercised in the browser**, under every role it concerns;
5. the labels translated — gate F5 fails the build
   otherwise;
6. **the dated entry logged in the register of origin**, in the same
   commit as the code.

A line for which the six are not held is not closed, whatever the
state of the code.

---

## 4 · The log

Kept up to date by the loop, at the source, like the closure log in
[`23`](../23-comite-produit.md) §3.

| Line | Release | State | Measure |
|---|:--:|---|---|
| PM-02 | R3 | **closed 08/31** | 024 · screen · 9 tests · adopted by the group, read from another site, origin project not named |
| INT-02 | R3 | **closed 08/31** | 025 · one key per system, scopes verified, name in the trail, rotation · /api/v1 surface · 13 tests |
| PM-01 | R3 | **closed 08/31** | 026 · engine · hourly sweep · screen · 15 tests · finding and answer exercised in the browser |
| INT-01 | R3 | **closed 08/31** | `server/src/openapi.js` generated from the router · `GET /api/v1/openapi.json` · `docs/openapi.v1.json` published · **gate F9** which refuses any drift in either direction · 3 tests |
| PM-03 | R3 | **closed 08/31** | 028 · one case per project, dated reconfirmation at a milestone, staleness by event order · 7 tests · full cycle in the browser |
| INT-05 | R3 | **closed 08/31** | 029 · reporting schema, 14 views, column-by-column doc (docs/30), doc↔schema test in both directions, a replayed decision reads back in the view |
| PG-01 | 29 | **closed 08/31** | real refusal exercised, exit code 1; flag set by the installer |
| I18N-01 | 29 | **closed 08/31** | client+server language register, form constraint (027), cycle exercised in the browser |
| MC-01 | 29 | **closed 08/31** | ISO country + legal entity on the site, 027, dialog exercised ("br" → BR) |
| SaaS-02 | 29 | **closed 08/31** | migrate() refuses a database newer than the binary, naming the unknown migrations — the 023 trap, closed at the root |
| PM-06 | R4 | **closed 08/31** | 030 · residual target on RAID · contingency drawdown names its risk · 6 tests · two old-world tests brought up to standard, saying so |
| INT-04 | R4 | **closed 08/31** | 031 · HMAC-signed deliveries from the trail (same list as reporting.decisions, held by a test that reads the view definition) · replay · log · a real HTTP subscriber has verified the signature |
| INT-06 | R4 | **closed 08/31** | Teams transport (MessageCard) on the same closed-by-default host list |
| PM-08 | R4 | **closed 08/31** | 032 · Closed requires operator + benefit owner + closing statement · handover dialog |
| PM-04 | R4 | **closed 08/31** | 032 · criteria set in advance; checking requires naming who found it met |
| INT-08 | R4 | **closed 08/31** | ICS METHOD:REQUEST with a resolved ORGANIZER, real ATTENDEEs, SEQUENCE, STATUS:CANCELLED at closure |
| INT-09 | R4 | **closed 08/31** | docs/31 — the procedure, what the lock guarantees and does not guarantee, the Graph-authenticated probe deferred WITH its reason |
| I18N-02 | R4 | **closed 09/01** | client dictionary 1053/1053 (FR parity held by gate F5, now multilingual), fragment mirror 47/47 held by F5, server refusals/notifications (i18n-es.js, `es` in SERVER_LANGS), EN→FR→ES cycle and portfolio screen exercised in the browser; **draft until reviewed by a native speaker** — the `(draft)` flag stays on screen. The round also found and closed a common hole: the entry point (directory, access levels, role notes) stayed in English in EVERY language |

**R4 pronounced on 09/01** — the nine lines closed, each measured in the
browser. Spanish enters as a draft in the sense of the committee's
policy ([`29`](../29-comite-international-saas.md) §4): review by a
native speaker on a real deployment is still owed, and the line
carrying it is open on the committee's register.

*(R5 lines are recorded here as they
enter work)*

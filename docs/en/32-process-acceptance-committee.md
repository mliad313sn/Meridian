> English translation of [`docs/32-comite-recette-processus.md`](../32-comite-recette-processus.md). The French original is the authoritative record; where they differ, the French governs.

# 32 · Process acceptance committee

Formed on 09/01/2026 by sponsor mandate: "test every
process and use case, from basic settings all the way to everything
Meridian is meant to do, step by step, then address the logic defects
and gaps."

## 1 · What this committee does that the others did not

Eight gates, 414 tests, a sweep of 286 cases and seven committees have
looked at the product — but **almost always from a book already
filled**: the demo seed supplies the sites, the accounts, the
projects, and each test exercises ITS piece in the middle of a world that
already exists. No one had replayed, in order and in a single pass, the
life of an organisation starting up: empty book, first setting,
first site, first account, first request, first project, first
piece of evidence, first closure. It is in the SEAMS between processes —
what step N assumes step N-1 left behind — that the logic defects
no unit test can see are hiding.

## 2 · Seats

| Seat | Viewpoint |
|---|---|
| Director of a NEW organisation | "I just installed, I have nothing, show me the way" |
| Programme office (group) | prioritisation, thresholds, decisions, independence |
| Site lead | what can be done from below, what must be escalated |
| Financial controller | the money: budget, commitments, contingency, periods |
| Auditor | every act has a name, every refusal has a reason, nothing is erased |
| Operator | handover to operations, continuity, archive |
| Service sceptic | tries the WRONG order: closing before opening, approving one's own work |

## 3 · Method

**The instrument is executable and version-controlled**:
`server/test/journey.test.js` — a SINGLE ordered journey that starts
with the real go-live action (`resetBook()`, the one used on
08/29) and then redoes, through the real routes and under the right
roles, everything the product promises, in the order an organisation
would live it. Each step asserts two things: the flow passes, AND the
refusal the register promises is indeed enforced (against the
sceptic, against the wrong order, against self-approval).

What the journey does NOT replace: measurement in the browser (gates F8
and re-test loops) and real operations (SaaS-03/05). It fixes the
LOGIC, not the ergonomics.

## 4 · The path tested (the process inventory)

0. Go-live: book wiped, surviving account forced to change its
   password, writes blocked beforehand.
1. Basic settings: thresholds, document hosts, status date.
2. Structure: site (ISO country, legal entity), programme, people.
3. Accounts and permissions: group, site, reader; site referent.
4. Demand → prioritisation: the site proposes, the group scores, the
   envelope decides, a rejection requires its reason, conversion keeps
   the thread.
5. Framing: business case, milestones with acceptance criteria,
   activities and dependencies, baseline.
6. Resources and money: allocations, timesheets, cost
   lines, commitments.
7. Tolerances: bounds set against the baseline, exception raised by
   the sweep, group-level answer, never self-closed.
8. RAID: risk with a residual target, site→group concern,
   contingency drawdown that names its risk.
9. Change control: threshold, SoD (raiser ≠ decider),
   plant windows and MOC.
10. Evidence and governance gates: trusted host, owner ≠
    approver, phase advancement, justified waiver.
11. Committees: series, occurrence, decision, action, referral.
12. Value: benefits in their own unit, PIR, closure requiring
    operator + benefit owner + closing statement.
13. Capitalisation: lesson proposed then adopted by the group, read
    elsewhere.
14. Reporting: closed period = frozen figures, `reporting.*` views.
15. Exit: notifications, integration (key, signed events),
    full archive re-read.

## 5 · Register of findings

Kept here, at the source, one line per finding, with the closing
measure. Severity: **B** blocks an entire process · **M** major
(bypasses a rule or loses data) · **m** minor (inconsistency without loss).

| # | Sev. | Finding | State |
|--:|:--:|---|---|
| PR-01 | M | `resetBook()` had frozen its table list at around migration 013: nothing broke (recent tables' FKs are SET NULL/CASCADE) but **demo lessons, requests and notifications survived go-live**, as orphans — measured by probe: 1 demo lesson left in a "wiped" book | **closed 09/01** — list completed (39 tables, children before parents) + safeguard: after wiping, resetBook re-reads the catalogue and FAILS, naming any business table that is non-empty and not declared kept; the next forgotten migration fails the journey instead of leaking into production. Re-measured: only `id_counter` (kept on purpose) remains |

| PR-02 | M | A PATCH with NO recognised field at all responded **200 with `version: undefined`** — and the audit line "… updated", written in the same transaction, stayed: **the trail asserted a change that had not happened**. Found by sending `decision:` instead of `status:` on a request — the client believes it has decided, nothing has been decided | **closed 09/01** — `updateVersioned()` refuses (400 "Nothing recognisable to change") and the transaction rolls back EVERYTHING, the audit line included; refusal translated FR/ES; measured in the journey (step 4) |
| PR-03 | **M** | **Change-control SoD hinged on an optional link.** `change_request.raised_by` = the raiser's personId; an account with NO linked person raises with `raised_by NULL`, and `selfMatch(user, null) = false`: **the raiser was approving their own request**. A fresh instance's admin account — including the committee account in production — is exactly such an account with no linked person. Replayed in the journey: an unlinked group account signed off its own step | **closed 09/01** — migration 033: `raised_by_user` (the ACCOUNT, which always exists — I-19) set at raising time and backfilled from the audit trail; the RBAC gate ALSO compares accounts; the serialiser exposes it and the approve button disappears for the raiser instead of failing; held by the journey (step 7, pmo deliberately without a linked person) |
| PR-04 | m | Observation logged, not fixed: a change-request approval chain has several steps (displayed roles), but **the same person can sign every step** — the chain's roles are labels, not permissions. SoD only blocks the raiser | open — a design decision remains to be made: either every step requires a distinct signer, or the chain is accepted as a single-signer review ritual and the screen says so |
| PR-05 | m | Observation to the product's credit, logged for the acceptance record: a change funded from contingency is signed all the way through and it is **the last signature — the one that applies it — that refuses** if the held contingency does not cover it ("more contingency than the project holds"). The control lives at the moment of the act, not the promise — intended behaviour, now held by the journey | closed — behaviour confirmed conformant, recorded in the journey (step 7) |

## 6 · The journey's verdict

The file `server/test/journey.test.js` holds the 16 chapters in
34 measures: real go-live (resetBook + proven password change),
settings, structure, accounts, demand→project, framing, money, tolerances,
RAID and named contingency, changes with threshold and SoD,
evidence and justified waivers, committees, value and signed closure,
lessons, closed period and reporting views, integration and archive. It runs as
part of `npm test` — every future delivery replays the full life of an
organisation starting up.

*(further lines are added as rounds proceed)*

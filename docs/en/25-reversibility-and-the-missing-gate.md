> English translation of [`docs/25-reversibilite-et-la-porte-manquante.md`](../25-reversibilite-et-la-porte-manquante.md). The French original is the authoritative record; where they differ, the French governs.

# 25 · Reversibility, and the gate that was missing

**Batch delivered the night of 30-31 August 2026.** Origin: the "obstacle
3" item from the market committee ([`24`](../24-comite-marche.md) §6) and
lines 21, 34 and 35 of the arbitrated backlog
([`23`](../23-comite-produit.md) §3).

---

## 1 · What was closed

| Origin | Finding | State |
|---|---|---|
| **S-17** ([`21`](../21-campagne-securite.md)) | A group-level account could run any site's series | **closed**, 4 tests |
| **S-14** ([`21`](../21-campagne-securite.md)) | The session token was stored in plaintext | **closed**, migration 023 |
| **S-15** ([`21`](../21-campagne-securite.md)) | A single login counter, on the identity+address pair | **closed**, 4 tests |
| **M-01** ([`24`](../24-comite-marche.md) §6) | No export of the trail, no re-import path | **closed**, 7 tests |
| **F7** (found here) | The administration screen did not render | **closed**, gate added |

**G-10** (backlog line 12) had already been delivered server-side with no
screen: the control now exists.

---

## 2 · S-17 — a group-level substitute is not a master key to the building

`shared/rbac.js` decided, for a site scope:

```js
// A group user may run a site's series only where that site hosts a
// project in one of their programmes — checked by the route, which
// has the project list; here we allow and let the route narrow.
return user.role === "group";
```

The comment described a control. **No route ever enforced it.** Any
group-level account could therefore open, run and close the weekly
session of any of the eight sites — including sites where its programme
has not a single line of work.

The fix does not move the decision into the route: it makes the missing
fact — the programmes actually hosted by that site — travel along with
the series, so that `rbac.js` remains the only place where authority is
decided.

And the refusal is **closed by default**: a scope that arrives without the
list is refused, never granted. If a future request forgets the
aggregate, the room locks instead of opening. This is the exact opposite
of the default just fixed, where the absence of a control counted as
authorisation.

---

## 3 · S-14 — the password was hashed, the token was not

A session token opens the same doors as a password for twelve hours. It
was kept exactly as it travels in the cookie. A mislaid backup, a
diagnostic export, a `SELECT *` pasted into a ticket: usable sessions
were being held without ever having known a password.

The column is **renamed** `token_hash`, not reused. This is the design
point: an unconverted call then fails loudly on an unknown column,
instead of silently comparing a fingerprint to a token and matching no
one — an authentication failure is visible, and a comparison that never
finds anything is visible too, but too late and in the wrong direction.

SHA-256, not scrypt: the input is 32 bytes drawn from the CSPRNG, there is
no dictionary to slow down, and this runs on every request.

---

## 4 · S-15 — the pair an attacker does not need to keep constant

The original counter was keyed on **identity + address**. Two ordinary
attacks never trip it:

- **the sweep** — one attempt against each of the two hundred accounts in
  the directory, from a single address: no pair ever exceeds 1;
- **the distributed guess** — one account, one attempt per address from a
  rented pool: no pair exceeds 1 either.

Three counters now: the pair (10), identity alone (20), address alone
(60).

**The per-address threshold is deliberately high.** Eight mining sites
reach this server through a handful of gateways, and everyone there
shares one address: a tight threshold would be a denial of service an
attacker would be delighted to trigger. Sixty failures in fifteen minutes
from one address is not a difficult Monday morning — and it still leaves
four attempts per minute against scrypt, which is not an attack.

A successful login clears the counters for that person, **never the one
for the address**: otherwise a single valid account behind the same
gateway would erase the record of everyone else's failures.

> **A finding about ourselves.** C-06 — the login rate limit — was
> declared *delivery-blocking* by the committee, and had **no tests at
> all.** It now has four.

---

## 5 · M-01 — "and in three years?"

This is the question the market committee asked, and to which none of the
twenty-four preceding reports had an answer. Half the answer already
existed: portfolio CSV, evidence pack, book JSON. The two halves that
matter were missing — **the audit trail**, which is what an auditor comes
looking for, and **a way back**, without which an export is just a file.

```bash
# on screen: Administration → Continuity → "Export archive"
# on the command line, at the receiving end:
npm run restore -- meridian-archive-2026-08-31.json --open admin@example.com
```

### What the archive is, and what it is not

|  | archive | backup |
|---|---|---|
| Answers | "how do we take everything elsewhere, without us?" | "how do we get back to last night?" |
| Contains | the book **and the trail**, open format | everything, including secrets |
| Secrets | **none** — no token, no password fingerprint | all |
| Can leave | yes: escrow, auditor, successor | no |
| Tool | `npm run restore` | `pg_dump` / `pg_restore` |

G-01 and G-02 therefore remain entirely open: this batch does not touch
them and does not pretend to.

Accounts come back with an `unusable` fingerprint and
`must_change_password`. `--open <email>` reopens **one**, with a
randomly-drawn password displayed once — never passed as a command-line
argument, where it would remain in the terminal history.

### Three things the real drill taught, that the tests kept quiet

**1. The schema runs in a circle.** `site.champion_id → person` and
`person.site_id → site` (A-12): no table order satisfies both. The order
is derived from the foreign-key graph, and a cycle is broken **on a
nullable column**, re-set afterward. The first version cut the first
nullable edge it found — `access_grant.programme_id`, which is in no
cycle — and thereby violated the constraint requiring a programme or a
site. An edge should only be cut if its parent descends back down to its
child.

**2. An "empty" database is not empty.** The migrations pre-populate
reference tables — `id_counter` first among them. The restore hit a
key collision on a database assumed to be fresh. No test could have
caught this: the suites start from a schema that is migrated **and
seeded**, never from a schema migrated alone. It took the first real
recovery to show it.

**3. The count said everything was fine, and the database was unusable.**
`audit_event.id` is a `bigserial`. `TRUNCATE` does not reset sequences,
and an explicit `INSERT` does not advance them: reloading 5,000 audit
rows into a fresh database leaves the sequence at 1. The product's
**first write** then claims identifier 1, already taken, and fails — and
since every mutation goes through `audited()`, **nothing can be written
at all anymore.** A restored portfolio, complete, read-only, without
anyone having decided so.

> The control that was missing was not one more control: it was the
> right one. Recounting rows after a recovery proves nothing. The test
> now writes **into the product** after restoration — and deliberately
> resets the sequence to the worst case, so it fails if this
> repositioning were ever to disappear.

---

## 6 · F7 — the administration screen did not render

Going to click the two new controls, the screen answered:

> **THIS VIEW COULD NOT BE DRAWN** — `selectField is not defined`

`web/src/views/administration.js` called `selectField(...)` without
importing it. In JavaScript this is not a build error, it is a
`ReferenceError` raised at the execution of that line; the render's `try`
turned it into a blank screen. **Accounts, permissions, directory, CSV
recovery, notifications: administration could not be opened.** Since
commit `fcf8fd5` — the product's very first delivery.

Seven committees, 322 tests, six gates, and a sweep of 286 use cases had
not seen it. The reason is clear, and is worth more than the defect
itself:

> **The tests talk to the API. So does the sweep. Nothing, anywhere in
> the tooling, rendered a view.**

A gate that measures what is already known to be measurable leaves
exactly this kind of hole. The seventh gate, `npm run audit` → **F7**,
takes the names exported by the six shared client modules —
`kit.js`, `api.js`, `i18n.js`, `state.js`, `permissions.js`,
`engine.js` — that is, 89 names, and checks that every file calling one of
them has imported it by name. The same omission on `fmtDate` or on `t`
breaks a screen in exactly the same way; a gate that only looked at
`kit.js` would not have caught it.

It was tested in both directions: with the defect put back, it names it
with its line; removed, it stays silent.

## 6bis · F8 — and then screens got drawn

F7 closes a specific case: `kit.js` helpers used without an import. It
still draws no view, and F7's lesson was precisely that a gate measuring
what is already known to be measurable leaves the hole open. **F8 closes
the class.**

`npm run audit:views` starts an instance, seeds the book, logs in as each
of the four roles, and **actually calls every view** with that role's
real book, in a real DOM (jsdom, a development dependency), inserting the
produced node into the document. Any exception fails the gate, naming both
the screen AND the role.

```
  · 20 screens × 4 roles
  · 80 renders, no exceptions
```

Tested in both directions, like F7: with the historical defect put back,
it produces four lines — `admin · admin`, `admin · group`, `admin · site`,
`admin · viewer` — and falls silent as soon as it is removed.

**What it does not do, and must not be credited with.** It clicks
nothing and judges no appearance: a view that renders can still be wrong.
It answers one question only — "does this screen open?" — to which, until
that night, no one had an answer.

Also checked by hand, in a real browser, before writing the gate: all 80
renders under the four roles. Administration was the only broken screen.

---

## 7 · State at the close of the batch

```
tests      334 / 334
gates      8  (routes · CRUD+audit · versions · controls · language · aid · imports · render)
migrations 023
sweep      286 cases × 4 roles
audit deps 0 vulnerabilities
```

**What is not done, and must not be read as done:** the production binary
is still running the version from before this batch. The fixed package is
built and awaits a UAC elevation, which requires a human present
([`13`](../13-windows-service.md)).

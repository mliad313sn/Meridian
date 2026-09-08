> English translation of [`docs/21-campagne-securite.md`](../21-campagne-securite.md). The French original is the authoritative record; where they differ, the French governs.

# Application Security Campaign — Findings, Fixes, Register

Date: 29 August 2026 · Security review conducted on the accepted state
(AMDEC acceptance pronounced, [`18-amdec-recette.md`](../18-amdec-recette.md)),
through five code reviews on disjoint surfaces — authentication and
sessions, injection and data access, client and rendering,
authorization and business logic, operations and supply chain — then
through black-box probes against the running service.

This document is the register: what was found, what was proven
exploitable, what was fixed, and what remains open **along with the
decision that goes with it**. Governance reviews (policies,
continuity, GDPR) are covered by the InfoSec/GRC committee,
[`20-comite-infosec-grc.md`](../20-comite-infosec-grc.md).

## Method — and what distinguishes a finding from a remark

A security review easily produces lists of good intentions. The rule
kept here: **a finding exists only if it carries a concrete
exploitation scenario**, and a serious finding is retained only after
being **replayed against a real instance**. Four of the findings
surfaced by the reviews do not survive this test and are logged as
such — that too is a result.

Starting attack surface, measured: **four production dependencies**
(`express`, `pg`, `cookie-parser`, `@electric-sql/pglite`), **zero
known vulnerabilities** (`npm audit --omit=dev`), dependency lock
present.

## What was found, proven and fixed

| Ref | Finding | Proven | Fix |
|---|---|---|---|
| **S-06** | **A milestone proof deposited with no owner approved itself.** The independence control compares the approver against the owner; with no owner, it compares nothing and lets it through. The same account drafted and accepted the proof — exactly the control the independent committee had made blocking. | **yes**, 200 obtained | The depositor is recorded as owner (identity is no longer requested of the client); and a document with no owner is approvable by nobody, with a refusal that says what to do. |
| **S-01** | **Stored script execution.** A document's artifact link is entered freely and rendered as `href` from the draft state onward; strict validation only applied at approval. A stored `javascript:…` would execute on a colleague's click, in their origin and with their rights. | **yes**, stored (201) | Two locks: the server refuses to save anything but an http(s) address; and the DOM builder refuses to write a URL attribute whose scheme is not http(s) — one place decides, as with authority. |
| **S-09** | **Local privilege escalation.** `C:\Apps\Meridian` inherited from the disk root and granted *Modify* to `Authenticated Users`, while the service runs as LocalSystem: any standard user could replace `Meridian.exe` and obtain SYSTEM on the next restart. | **yes**, ACL confirmed on the machine | Inheritance broken, write reserved to administrators and SYSTEM, read for others — **applied to the existing install** and built into the installer for future ones. |
| **S-03** | **Directory published with no authentication.** `/api/auth/accounts` listed *all* active accounts — name, address, role, scope — to whoever could reach the port, including on a production book. This nullified the care taken by the sign-in page to keep account existence unguessable, and provided a ready-made target list. | **yes**, real account exposed | The query now only returns demo accounts; on a real book, the list is empty and the sign-in screen stays servable. |
| **S-05** | **`NaN` accepted as an amount.** PostgreSQL accepts `NaN` in `numeric`, and `NaN` compares *greater than* everything: the `budget >= 0` constraint let it through. Every value derived from the project — indices, forecast, status, published period — became unrecoverable, with no error. | **yes**, 200 obtained | An amount must be finite, otherwise the request is refused. |
| **S-04** | **Formula injection in exports.** A project name starting with `=`, `+`, `-` or `@` is interpreted as a formula by spreadsheets: the export became executable on the machine of whoever opens it. | yes (by inspection) | Any cell starting with a formula character is neutralized with an apostrophe: the export is data, never an instruction. |
| **S-02** | **No defense in depth against request forgery.** The `SameSite=Lax` cookie protects current browsers, but nothing else did: a write announcing a foreign origin was accepted. | yes (probe) | A write whose announced origin is not ours is refused. Calls with no origin (native client, monitoring) remain possible: the guarantee is consistency, not the presence of a header. |
| **S-08** | **Listening on all interfaces while announcing the opposite.** The service listened on `0.0.0.0` while the startup line said `localhost`: an install that reads like a desktop tool actually responded to the whole local network, in clear HTTP, session cookie included. | **yes**, `::` confirmed | Listens on loopback by default; opening to the network becomes an explicit choice (`MERIDIAN_BIND`), and that choice displays the matching warning if it is not paired with TLS. |
| **S-10** | **The production cleanup did not revoke the retained password.** `reset-book` deactivates demo accounts but left the retained account with whatever password it had — published in the repository on a seeded instance. | yes (by inspection) | The account that survives cleanup must change its password before writing, and all sessions drop: a cleanup is a real departure. |
| **S-11** | **Default database credentials, silent.** The package shipped `postgres:postgres` — the most guessed credential in the world, and superuser of the entire cluster, not just this database. A silent default is a default nobody fixes. | **yes**, config confirmed | **Fixed at the root, 30/08**: the package no longer ships any credential. The installer creates an application role (`meridian`, owner of its own database only) with a randomly generated password nobody has to choose or remember, and writes it into a configuration protected by the hardened ACL (S-09). Startup keeps the warning for prior installs. |
| **S-12** | **Incomplete security headers**: no content security policy, no permissions policy, no HSTS. | yes (probe) | Strict content policy (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), a permissions policy, and HSTS **only** when the deployment declares itself behind TLS — announcing it from a plaintext install would lock users out. |

Each fix carries its test in
[`server/test/security.test.js`](../../server/test/security.test.js): ten
tests that replay the attack as it used to succeed.

## What was raised and did not survive the test

Logged because a finding dismissed with no reason always comes back.

- **Forgery of a change request's originator.** The code accepted
  `raisedBy` from the client, which would have allowed erasing the
  identity the independence control compares. Replayed: refused — a
  foreign key stops the invented value. The control therefore only
  held by accident, and the code was hardened anyway (**S-07**): an
  identity is observed, it is not declared.
- **SQL injection via restore from the trail.** The route rebuilds
  columns from a `before_json` image; verified: the table is taken
  from a strict allowlist and the image never comes from an HTTP
  request, but always from a real SQL read at the moment of
  deletion. Watertight.
- **SQL injection via query parameters.** Probed on sorts, bounds and
  filters: parameterized queries throughout, numeric bounds fenced.
  No server error, no abnormal behavior.
- **Information leakage via errors.** Probed: no call stack, no SQL,
  no file path reaches the client; the header revealing the server is
  masked.

## What remains open, and the decision that goes with it

| Ref | Subject | Position |
|---|---|---|
| **S-13** | **The administrator is exempt from separation of duties** (`if (user.role === "admin") return allow()`). Documented, tested, accepted from the start — but on the production book the **only active account is administrator**, so in practice no independence control applies to anyone today. | **To be settled by the sponsor, not by engineering.** The fix is not technical: it consists of creating named accounts for the real roles (programme managers, site leads) and reserving administration for operations. As long as there is only one account, the tool cannot be its own second pair of eyes. |
| **S-14** | **Session tokens stored in plain text** in the `session` table. A database read (a mislaid backup, poorly protected replication) delivers usable sessions for up to twelve hours. | Hardening recommended (store the hash, compare hashes). Not exploitable without access that would already compromise everything; to be handled together with the GRC committee's backup workstream. |
| **S-15** | **Sign-in throttling bypassable by breadth.** The counter is keyed by address+identifier pair: trying one likely password across thirty accounts never trips it. It is also in-memory, so per process. | Recommended: a counter keyed on the identifier alone and a global counter per address. Real exposure limited as long as the application is not exposed beyond the machine (see S-08, now closed by default). |
| **S-16** | **Unsigned binary.** Injecting the package into `node.exe` invalidates the original signature and nothing rebuilds it: Windows cannot name any publisher, and an administrator has no cryptographic way to verify what they are running under LocalSystem. | Requires an organizational code-signing certificate — **a purchasing decision**, not a line of code. To be requested from the sponsor together with the SMTP relay and the Entra tenant. |
| **S-17** | **Substitution and meeting scope.** A group-level account can chair a site's meeting series outside its programmes: the code announces that the route will "narrow" the scope, and no route does. | Real but bounded authorization gap (reading and chairing a committee, not financial writes), and with no proven exploitation at this stage. To be handled at the next iteration, together with the GRC committee's measures. |
| **S-18** | **`.npmrc` disables the registry's TLS verification**, due to a corporate inspection proxy. | The dependency lock protects reproducible installs; the risk lies in added dependencies. To be removed as soon as the proxy's certificate authority is installed — this is already written in the file. |

## What was checked and found sound

Worth logging, because the value of a review lies as much in what it
did not find.

- **Passwords**: scrypt, per-user salt, constant-time comparison, and
  a dummy computation on an unknown identifier so response time does
  not betray whether an account exists. Verified by probe: 52 ms
  against 55 ms, identical message.
- **Sessions**: 256 bits of cryptographic randomness, opaque,
  verified server-side, deleted on sign-out, revoked on other devices
  on password change, swept on expiry. A forged session of the same
  length is refused.
- **Cookie**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` driven
  by deployment.
- **Rendering**: no `innerHTML`, `eval`, or string-built event
  handler anywhere in the client — the DOM builder creates text
  nodes, so server data cannot accidentally become markup.
- **Substitution**: re-checked in the database on every request,
  bounded by dates, authority *substituted* and never additive, the
  audit names both people.
- **Federation service key**: constant-time comparison, closed-fail
  when absent, and the service principal exists in no role — it can
  therefore obtain nothing through the authority control.
- **Writes**: all parameterized, all audited within the transaction
  that carries them, all versioned.
- **Administration**: lockout against self-exclusion of the last
  administrator; deactivating an account ends its sessions; every
  setting change is logged.
- **Service logs**: re-read on the real install — no secret, no
  token, no request body.

## What the sponsor must decide

Three things do not get fixed in code, and nothing will move without
them:

1. **Create named accounts** for the real roles, and stop governing
   from an administrator account (**S-13**) — this is what makes
   separation of duties real rather than theoretical.
2. **Give PostgreSQL a real password** and update the service
   configuration (**S-11**).
3. **Provide a code-signing certificate** (**S-16**), together with
   the SMTP relay and the Entra tenant already expected.

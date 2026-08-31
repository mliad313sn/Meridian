# Security policy

Meridian holds a governance record: decisions, approvals, an append-only
audit trail, and — depending on how you deploy it — personal data about
the people who deliver the work. A defect here is not cosmetic.

## Reporting a vulnerability

**Please do not open a public issue for a security defect.**

Use GitHub's private vulnerability reporting on this repository
(*Security → Report a vulnerability*). It reaches the maintainers without
becoming public, and it is the only channel we can promise to watch.

Tell us what you can of:

- what you did, precisely enough for us to repeat it;
- what happened, and what should have happened;
- the version — `GET /api/health` returns it, and it matches a commit;
- the database engine (PostgreSQL or the bundled PGlite) and how the
  instance is exposed (localhost, LAN, behind a reverse proxy).

A proof of concept helps. A working exploit is welcome and will never be
held against you.

### What to expect

This project has no company behind it and no support contract. That is
stated plainly rather than dressed up:

- we aim to acknowledge a report within **7 days**;
- we aim to say whether we can reproduce it within **30 days**;
- there is **no committed fix deadline**, because there is no one on
  call. If a defect matters to you more than that, the licence lets you
  fix it yourself, and we would rather receive the patch than the
  complaint.

We will credit you when the fix lands, unless you ask us not to.

## Scope

**In scope** — anything that lets someone:

- read or write outside the access model in `shared/rbac.js`;
- change data without the audit trail recording it, or alter the trail;
- bypass segregation of duties on approvals, gates or change decisions;
- take over a session, or authenticate as someone else;
- reach the server's host through the application;
- read another site's or another programme's portfolio.

**Out of scope**, and why:

- **The administrator exemption from segregation of duties** (finding
  S-13). `can()` returns early for `admin`, so an administrator can
  approve their own change request. This is deliberate break-glass
  behaviour, documented in `docs/21-campagne-securite.md`, and the
  countermeasure is organisational: create named accounts at the right
  level rather than running everything as an administrator. Report it if
  you find a way to *reach* it without being an administrator.
- **The seeded demonstration accounts and their passwords.** They are
  printed in the README on purpose so the access model can be seen
  working. `npm run reset-book` deactivates them; an instance carrying
  real data must not still have them.
- **Unsigned binaries** (finding S-16). `dist/MeridianSetup.exe` carries
  no Authenticode signature, so Windows cannot name a publisher. Build
  from source if that matters to you — the packaging is one command and
  is documented in `docs/13-windows-service.md`.
- Anything requiring physical access to the database server, or an
  attacker who already holds administrator rights on the host.

## What the project does to earn the claim

Every change runs `npm run verify`: 334 tests, eight static gates and a
dependency audit. Three of those gates exist specifically to keep
security properties from eroding:

- **CRUD + audit** — a mutation that does not write an audit row inside
  its own transaction does not commit;
- **versions** — every mutable row asserts `row_version`, so a second
  writer gets a 409 instead of silently overwriting;
- **controls** — a write control drawn without asking whether the account
  may perform it fails the build.

The full security history, including eleven defects found and fixed and
the reasoning behind each, is in `docs/21-campagne-securite.md` and
`docs/25-reversibilite-et-la-porte-manquante.md`. They are written in
French; the code and its comments are in English.

## Deploying it safely

Read `docs/20-comite-infosec-grc.md` before putting real data in this.
Its three blocking findings are not code defects and this project cannot
close them for you:

- **G-01** — you have no backup until you have taken one and *restored*
  it, timed, onto another machine.
- **G-02** — a single instance on a single disk is a single point of
  failure for both the portfolio and the assurance evidence.
- **G-04** — without a written security policy, none of the other
  findings has an owner.

`npm run restore` and the archive export exist so that your data is never
hostage to this project, or to us. That is a different guarantee from a
backup, and the difference is explained in `server/src/archive.js`.

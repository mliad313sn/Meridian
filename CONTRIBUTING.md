# Contributing to Meridian

Thank you for looking. This document is short on ceremony and long on the
few rules that are not negotiable, because those rules are the reason the
tool can claim to be a governance record rather than a spreadsheet with
tabs.

## Getting it running

```bash
npm install
npm run seed     # migrate, then build the opening book
npm run dev      # http://localhost:4173
```

With no `DATABASE_URL` the server runs **PGlite** — PostgreSQL compiled
to WebAssembly — from `server/.data/pgdata`. Same SQL, same planner, no
server to install. Point `DATABASE_URL` at a real cluster when you want
one; nothing else changes.

> **Do not hard-kill the dev server.** PGlite does not complete crash
> recovery the way a server does, and a `SIGKILL` mid-write leaves the
> data directory unopenable. Use `bash scripts/restart.sh`.

If your employer's proxy re-signs the npm registry's TLS certificate,
install that proxy's root CA in your trust store. Do **not** commit an
`.npmrc` that turns off `strict-ssl`: it is a supply-chain weakness, and
it would be a weakness for everyone who clones the repository rather than
just for you.

## Before you open a pull request

```bash
npm run verify
```

That is 356 tests, a client build, eight static gates and a dependency
audit. It must be green. It takes about two minutes.

`npm run sweep` exercises 286 use cases across the four roles and is
worth running when you touch authorisation. Twelve of its warnings are
documented and expected; if you see a thirteenth, you changed something.

## The five rules

These are not style preferences. Each exists because its absence produced
a real defect in this codebase, and each has a gate or a test holding it.

1. **Authority is decided in one place.** `shared/rbac.js`, server-side.
   Never inline a role check in a route. The browser imports the same
   module, but only to decide what to draw — hiding a button is not
   enforcement.

2. **Every mutation goes through `audited()`.** It writes the audit row
   inside the same transaction, so a change that is not audited does not
   commit. The `crud-audit` gate fails the build otherwise.

3. **Every mutable row asserts `row_version`.** Use `updateVersioned()`.
   `Number(body.version ?? row.row_version)` reads like a concurrency
   check and is not one — the fallback means the assertion can never
   fail, which is worse than no check because it stops anyone looking.

4. **Never edit an applied migration.** Add `NNN_description.sql`. When
   you add an entity or a field you owe all five: migration, route
   (create / read / update / remove-or-reverse), serialiser field, form
   field, test. Four out of five is the defect the gates exist to catch.

5. **Never weaken a test or disable an authority check to make something
   pass.** If a test is wrong, say so in the pull request and justify it.

Two more that are cheaper to honour than to retrofit:

- **Money is exact.** Integers in whole units server-side; the interface
  divides. `shared/engine.js` — the EVM, CPM, gate and RAID arithmetic —
  is behaviour-frozen. Changing a number it produces changes reported
  history, so it needs an explicit decision, not a refactor.
- **The ledger is append-only.** Correct a cost by a reversing entry, not
  an edit.

## User-facing text

The interface is bilingual, keyed on the English string:
`t("Sign in")` returns the French or falls back to the English itself.
So a missing translation degrades to English rather than to a broken key.

The `i18n` gate fails the build if a `t()` literal has no French entry,
and the `help-coverage` gate holds field help at 80% of forms and 100% of
fields whose value someone else reads. Add your entry to
`web/src/lib/i18n.js` in the same commit.

Write sentences, not fragments — French grammar does not assemble from
English word order.

## Commit messages

Say what changed and **why it was wrong before**. The commit log of this
project is part of its documentation; several commits are the only place
a subtle decision is explained. A message that only says what a diff
already shows is a wasted opportunity.

## Versioning — one version per change

Every change carries a version. Not one per release train: **one per
change**, so that a finding from the field can always be tied to a
build.

Before opening a pull request:

1. add your entry under `## [Unreleased]` in
   [CHANGELOG.md](CHANGELOG.md), under Added / Fixed / Changed /
   Security — say what changed **and why it was wrong before**;
2. bump `version` in `package.json` — MAJOR if an operator must act
   before upgrading, MINOR for new capability, PATCH for a defect;
3. when it merges, the version is tagged `vX.Y.Z` and `## [Unreleased]`
   becomes that version, with its date.

That number is what `GET /api/health` returns and what the packaged
binary stamps. Without it, "it was fixed in ours" and "not in mine"
cannot be told apart — which is the whole reason the field exists
(finding P-02).

## Reporting a security defect

Not here. See [SECURITY.md](SECURITY.md) — use private vulnerability
reporting, not a public issue.

## Licensing of contributions

By opening a pull request you agree that your contribution is licensed
under the Apache License 2.0, the same terms as the project. There is no
separate contributor licence agreement to sign.

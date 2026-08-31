# Meridian IT-PMO

**Project portfolio management for a group that runs several sites.**
Earned value, critical path, stage gates, RAID, change control, resource
capacity — and the weekly and monthly meetings that run on top of them,
generated from the portfolio rather than typed into a deck.

Free software, Apache-2.0. Self-hosted. No telemetry, no licence check,
no account to create. `npm install && npm run seed && npm run dev` and it
is running on your machine in about a minute.

---

## What it is for, and what it is not

Meridian is built for the situation where **authority is split between a
group function and the sites that deliver**: a programme office in one
country, delivery teams in eight others, an auditor who will eventually
ask why a decision was taken in March.

It is opinionated about three things, and they are the reason to choose
it over a generic work tracker:

- **Authority is data, not convention.** A project is governed at group
  or at site level, and that single fact decides who may re-baseline it,
  book money against it, or approve its gate. The decision is made in one
  place, server-side, and the browser imports the same module only to
  decide what to draw.
- **The trail cannot be rewritten.** Every change writes an audit row
  inside its own transaction — a change that is not audited does not
  commit — with before and after images. The table refuses `UPDATE` and
  `DELETE` at the database, not in application code.
- **The meeting is generated.** Agendas are built from what the portfolio
  actually says this week; decisions and actions land back on the
  projects they concern, and a site decision can be referred up without
  anyone re-typing it.

**It is not** a task manager, a time-and-billing system, an ITSM tool, or
an agile team board. It sits above those and reports on the work they
carry out.

## What you are not getting

Stated here rather than discovered later:

- **There is no vendor.** No support contract, no one on call, no
  service-level commitment. If it breaks on a Sunday, you fix it or you
  wait.
- **It has not yet run a real portfolio for a full year.** Read
  `docs/24-comite-marche.md`, which is an independent committee's
  assessment saying exactly that, in more detail than a vendor would.
- **The reports and committee records are in French.** The code, its
  comments and the interface are in English and French; the twenty-five
  documents in `docs/` that explain *why* each decision was taken are
  mostly French.
- **Three blocking operational findings are yours to close**, not the
  software's: a tested backup, a second instance, and a written security
  policy. See [SECURITY.md](SECURITY.md).

You are getting the source, an archive format that gets all your data
back out (`npm run restore`), and a build that fails on eight static
gates before it will let a change through.

---

## Running it

```bash
npm install
npm run seed     # migrate + build the opening book (add -- --force to rebuild)
npm run dev      # http://localhost:4173
```

That is the whole setup. With no `DATABASE_URL` the server runs
**PGlite** — PostgreSQL 16.4 compiled to WebAssembly — from
`server/.data/pgdata`. Same SQL, same planner, no server to install.

For a real cluster:

```bash
DATABASE_URL=postgres://user:pass@host:5432/meridian npm run migrate
DATABASE_URL=postgres://user:pass@host:5432/meridian npm run seed
DATABASE_URL=postgres://user:pass@host:5432/meridian npm start
```

Other commands:

```bash
npm test              # 372 tests
npm run audit         # eight gates: routes, CRUD+audit, versions, controls, language, field help, kit imports, view render
npm run verify        # tests + build + the eight gates + a dependency audit
npm run sweep         # 286 use cases × 4 roles + 72 view renders, on a fresh instance
npm run build         # build the client into web/dist
npm run package:installer  # dist/MeridianSetup.exe — Windows service installer
powershell -File scripts/deploy-local.ps1   # extract it, install it elevated, check /api/health
npm run restore       # reload an exported archive into an empty instance (M-01)
npm run training      # a separate practice instance on :4180 — never touches the real book
npm run training -- --reset   # put it back to how it started
npm run training -- --drop    # erase it
npm run dev:web       # Vite dev server with HMR, proxying /api to :4173
bash scripts/restart.sh   # restart the dev server *gracefully* — see the note below
```

> **Do not hard-kill the dev server.** PGlite does not complete crash
> recovery the way a server does; a `SIGKILL` mid-write leaves the data
> directory unopenable. Use `scripts/restart.sh`. (Stale locks from an
> earlier unclean stop are cleared automatically on the next start.)

---

## Signing in

Ten accounts are seeded so the access model is visible immediately. The
sign-in screen lists them; clicking a name fills in the address.

| Account | Level | Scope | Password |
|---|---|---|---|
| `admin@meridian.example` | admin | — | `meridian-admin-2026` |
| `r.kaur@meridian.example` | admin | — | `pmo-director-2026` |
| `e.lindqvist@meridian.example` | group | CBP, EIT | `programme-cbp-2026` |
| `p.marchetti@meridian.example` | group | DCH | `programme-dch-2026` |
| `f.okonkwo@meridian.example` | group | DAI | `programme-dai-2026` |
| `g.silva@meridian.example` | site | São Paulo | `site-gru-2026` |
| `t.nakamura@meridian.example` | site | Toronto | `site-yyz-2026` |
| `y.tanaka@meridian.example` | site | Singapore | `site-sin-2026` |
| `n.rahimi@meridian.example` | viewer | Lisbon | `viewer-lis-2026` |
| `q.mbeki@meridian.example` | viewer | São Paulo | `viewer-gru-2026` |

> ⚠️ **These are demonstration credentials.** Change them from
> Administration before this instance carries anything real. Recorded as
> an accepted risk in `docs/06-amdec-uat.md` (C-04).

**Sign in as `g.silva` to see the access model working:** nine projects
visible, one writable, Administration absent from the navigation, and a
plain sentence on every group-governed project explaining why its
controls are not there.

---

## Shape of the thing

```
shared/          engine.js   EVM · CPM · gates · RAID · capacity  (behaviour-frozen)
                 rbac.js     the one place authority is decided
                 meetings.js agenda generation and minutes

server/          src/db.js         pg | PGlite, migrations, optimistic concurrency
                 src/auth.js       scrypt, server-side sessions
                 src/audit.js      append-only, inside the mutation's transaction
                 src/portfolio.js  rows → the shape the engine reads
                 src/routes/       auth · portfolio · meetings · admin · import
                 migrations/       ordered SQL (001–026, applied at boot)
                 test/             372 tests

web/             src/ui/kit.js     h() builder, dialogs, tables, charts (from v4)
                 src/lib/          api client, state, permission mirror
                 src/views/        the 21 screens
                 src/styles.css    the "Instrument" design system, light + dark
```

**Three rules the codebase holds to.** Authority is decided once, in
`shared/rbac.js`, server-side — the browser imports the same module, but
only to decide what to draw. Every mutation goes through `audited()`,
which writes the audit row inside the same transaction, so a change that
is not audited does not commit. Every mutable row carries `row_version`,
and an update asserts the version it read — a second writer gets a 409,
never a silent overwrite.

---

## Documentation

| | |
|---|---|
| [`docs/00-committee-charter.md`](docs/00-committee-charter.md) | Who specified this and what they decided |
| [`docs/01-requirements-register.md`](docs/01-requirements-register.md) | 48 requirements, each traced to a test |
| [`docs/02-gap-analysis.md`](docs/02-gap-analysis.md) | What the v4 build got right, and its 15 defects |
| [`docs/03-target-architecture.md`](docs/03-target-architecture.md) | Architecture decisions, API surface, authority matrix |
| [`docs/04-access-model.md`](docs/04-access-model.md) | Group / site / admin / viewer, and how it is enforced |
| [`docs/05-meeting-animation.md`](docs/05-meeting-animation.md) | The meetings module and the playbook for running one |
| [`docs/06-amdec-uat.md`](docs/06-amdec-uat.md) | AMDEC/FMEA acceptance review — 22 failure modes scored and closed |
| [`docs/07-design-review.md`](docs/07-design-review.md) | Design review — why v4 read as generated, and the "Instrument" system that replaced it |
| [`docs/08-operational-review.md`](docs/08-operational-review.md) | Fitness for duty — the CRUD and field audit, 11 findings, and the gate that keeps them closed |
| [`docs/09-backend-review.md`](docs/09-backend-review.md) | Data integrity and access paths — concurrency, identifier allocation, indexes, statement volume |
| [`docs/10-coordination-register.md`](docs/10-coordination-register.md) | Cross-committee coordination register |
| [`docs/11-governance-adoption-review.md`](docs/11-governance-adoption-review.md) | Governance & adoption release — SoD, referrals, digest, bilingual EN/FR |
| [`docs/12-code-review-fixes.md`](docs/12-code-review-fixes.md) | Deep code review — approval bypasses, scope leaks, and their fixes |
| [`docs/13-windows-service.md`](docs/13-windows-service.md) | Packaging: Node SEA + winsw + IExpress, the `MeridianITPMO` service |
| [`docs/14-endeavour-value-review.md`](docs/14-endeavour-value-review.md) | Endeavour committee + market benchmark — 16 findings V-01…V-16, all closed |
| [`docs/15-goal-campaign.md`](docs/15-goal-campaign.md) | The campaign prompt that closed them |
| [`docs/16-comite-independant.md`](docs/16-comite-independant.md) | Independent committee (FR) — 15 réserves, toutes **levées** avec mesures datées, boucle de re-test |
| [`docs/17-instructions-reserves.md`](docs/17-instructions-reserves.md) | The executable commands that addressed them |
| [`docs/18-amdec-recette.md`](docs/18-amdec-recette.md) | Final AMDEC acceptance — **recette prononcée** 29/08/2026 |
| [`docs/19-comite-adoption.md`](docs/19-comite-adoption.md) | Adoption & ergonomics (FR) — 12 réserves, **toutes levées** : manuel, premiers pas, terrain |
| [`docs/20-comite-infosec-grc.md`](docs/20-comite-infosec-grc.md) | InfoSec & GRC (FR) — 17 constats, ISO 27001 / NIST CSF ; la part produit est faite |
| [`docs/21-campagne-securite.md`](docs/21-campagne-securite.md) | Security campaign (FR) — 11 defects fixed, 6 on the register |
| [`docs/22-comite-innovation.md`](docs/22-comite-innovation.md) | Innovation (FR) — AI under contract, notification centre, five ideas refused |
| [`docs/23-comite-produit.md`](docs/23-comite-produit.md) | Product committee (FR) — the charter, the criteria, and every open item on one list |
| [`docs/24-comite-marche.md`](docs/24-comite-marche.md) | Market committee (FR) — positioning, four business models, the competitor's best attack, and a dated verdict |
| [`docs/25-reversibilite-et-la-porte-manquante.md`](docs/25-reversibilite-et-la-porte-manquante.md) | S-17 · S-14 · S-15 · M-01 (archive + restore), and the gate that found Administration had never drawn |
| [`docs/26-conformite-referentiels.md`](docs/26-conformite-referentiels.md) | Conformance to ISO 21502/21504/21505, PRINCE2, PMBOK, ISO 31000 — what is covered, and 13 gaps with what each costs |
| [`docs/27-comite-interoperabilite.md`](docs/27-comite-interoperabilite.md) | Interoperability committee (FR) — four surfaces instead of twenty connectors, and why |
| [`docs/28-goal-market.md`](docs/28-goal-market.md) | The single ordered backlog to a finished product, and the loop that works it |

---

## Continuing the work

`/goal <something>` runs an autonomous plan → build → verify → re-verify
loop against this repository, bounded by the requirements register and
the AMDEC. With no argument it takes the highest-RPN open finding. It
stops at DONE, BLOCKED, or after five cycles without closure. See
[`.claude/commands/goal.md`](.claude/commands/goal.md).

---

## Licence, and using this

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). You may
run it, change it, and deploy it commercially, including inside a company
that sells something else. The patent grant is deliberate: it protects
you and it protects the people who contributed.

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to build it, and the five
  rules that are not negotiable
- [SECURITY.md](SECURITY.md) — how to report a vulnerability, what is in
  scope, and what response you can realistically expect

Third-party components and their licences are listed in
[NOTICE](NOTICE), which also states, and shows you how to verify, that a
default installation makes no outbound network request at all.

---

## Known limits

Stated plainly rather than buried; all scored in the AMDEC.

- ~~The whole book is re-fetched after every write~~ (C-01) — **closed by
  R-08**: ordinary writes refresh only their collections
  (`GET /api/collections?keys=…`), responses are gzipped, and the initial
  bootstrap transfers ~16 KB.
- ~~No rate limit on sign-in~~ (C-06) — **closed**: the standalone baseline
  carries the sign-in rate limit from the integration round.
- ~~`.npmrc` disables strict TLS for the package registry~~ (C-05, S-18)
  — **closed by not shipping it**. The workaround was one maintainer's
  corporate proxy; a public repository that carries `strict-ssl=false`
  teaches a supply-chain weakness to everyone who clones it. The file is
  now ignored, and [CONTRIBUTING.md](CONTRIBUTING.md) says to install your
  proxy's CA instead.
- **Three settings wait on the sponsor** (accepted in writing,
  `docs/18-amdec-recette.md`): `MERIDIAN_SMTP_URL` before notifications
  actually send, `MERIDIAN_OIDC_*` before Entra sign-in appears, and the
  real `documentHosts` before documents can be approved — the trusted-host
  list ships **closed by default** and says so.

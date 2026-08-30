# Meridian IT-PMO

Group-wide IT project portfolio management —
earned value, critical path, stage gates, RAID, change control, resource
capacity, and the weekly and monthly meetings that run on top of them.

> **STANDALONE RESTART BASELINE (2026-08-28).** This project is Meridian
> running fully on its own — its own PostgreSQL 17 database
> (`DATABASE_URL` → `meridian_standalone`; PGlite fallback with no env),
> served at the root of its own port. It carries everything the first
> integration round built and proved (the federation contracts C1–C6 in
> `server/src/federation.js` + `server/src/routes/federation*.js`, the
> `ext_link` store, origin provenance, sign-in rate limit, honest
> budget-less display, `npm run reset-book`) — all config-gated and inert
> until pointed at an SDP. Integration with SDP restarts from here,
> module by module; the previous integrated build remains on the
> `release/pmo-integration` branch of `sdp-dashboard` for reference.

Version 5 replaces the single-file v4 prototype (kept in
`legacy/meridian-pmo-v4.html`) with a client/server application on
PostgreSQL, real authentication and authorisation, an append-only audit
trail, and a meeting-animation module the prototype had no equivalent of.

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
npm test              # 334 tests
npm run audit         # eight gates: routes, CRUD+audit, versions, controls, language, field help, kit imports, view render
npm run verify        # tests + build + the eight gates + a dependency audit
npm run sweep         # 286 use cases × 4 roles + 72 view renders, on a fresh instance
npm run build         # build the client into web/dist
npm run package:installer  # dist/MeridianSetup.exe — Windows service installer
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
                 migrations/       ordered SQL (001–023, applied at boot)
                 test/             334 tests

web/             src/ui/kit.js     h() builder, dialogs, tables, charts (from v4)
                 src/lib/          api client, state, permission mirror
                 src/views/        the 20 screens
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

---

## Continuing the work

`/goal <something>` runs an autonomous plan → build → verify → re-verify
loop against this repository, bounded by the requirements register and
the AMDEC. With no argument it takes the highest-RPN open finding. It
stops at DONE, BLOCKED, or after five cycles without closure. See
[`.claude/commands/goal.md`](.claude/commands/goal.md).

---

## Known limits

Stated plainly rather than buried; all scored in the AMDEC.

- ~~The whole book is re-fetched after every write~~ (C-01) — **closed by
  R-08**: ordinary writes refresh only their collections
  (`GET /api/collections?keys=…`), responses are gzipped, and the initial
  bootstrap transfers ~16 KB.
- ~~No rate limit on sign-in~~ (C-06) — **closed**: the standalone baseline
  carries the sign-in rate limit from the integration round.
- **`.npmrc` disables strict TLS for the package registry** (C-05).
  A Cisco Umbrella inspection proxy re-signs registry traffic and its root
  CA is not in the Windows trust store. Remove the line once the CA is
  installed; it has no bearing on the running system.
- **Three settings wait on the sponsor** (accepted in writing,
  `docs/18-amdec-recette.md`): `MERIDIAN_SMTP_URL` before notifications
  actually send, `MERIDIAN_OIDC_*` before Entra sign-in appears, and the
  real `documentHosts` before documents can be approved — the trusted-host
  list ships **closed by default** and says so.

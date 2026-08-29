# Target Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  web/  — Vite, vanilla ES modules, design system carried over  │
│  ├── lib/api.js      fetch wrapper, 401 → login, ETag/version  │
│  ├── lib/state.js    App store; mutate() now calls the API     │
│  ├── lib/engine.js   EVM / CPM / RAID — pure, shared with tests │
│  ├── ui/*.js         h(), dialogs, tables, charts (verbatim)   │
│  └── views/*.js      12 legacy views + meetings                │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTP/JSON, cookie session
┌──────────────────────────▼─────────────────────────────────────┐
│  server/ — Node 24 + Express                                   │
│  ├── auth.js     scrypt hashing, server-side sessions          │
│  ├── rbac.js     can(user, action, resource) — the only gate   │
│  ├── audit.js    append-only, inside the same transaction      │
│  └── routes/     projects · schedule · raid · cost · change ·  │
│                  resources · docs · meetings · admin · auth    │
└──────────────────────────┬─────────────────────────────────────┘
                           │ pg
┌──────────────────────────▼─────────────────────────────────────┐
│  PostgreSQL — ordered SQL migrations, FK-enforced, numeric      │
│  money, append-only audit, row_version optimistic concurrency   │
│  dev/test: PGlite (Postgres/WASM, identical SQL, zero install)  │
└────────────────────────────────────────────────────────────────┘
```

## Key architectural decisions

**AD-1 · Transplant, don't rewrite.** The `h()` builder and the engine move
across as ES modules with no behavioural change. This preserves ~2,500 lines of
reviewed logic and makes R3 ("behaviour-frozen") checkable by diffing outputs.

**AD-2 · One authorisation gate.** `rbac.can(user, action, resource)` is the only
place authority is decided. Routes call it; the client calls a mirrored read-only
copy purely to decide what to *render*. Server decision is authoritative — the
client copy can be wrong without becoming a vulnerability.

**AD-3 · Scope is data, not code.** A grant is a row: `(user, level, programme_id
| site_id)`. Adding a site never requires a deploy.

**AD-4 · Audit inside the transaction.** The audit insert shares the transaction
with the mutation. A change that is not audited does not commit.

**AD-5 · PGlite for dev/test.** `@electric-sql/pglite` is real PostgreSQL compiled
to WASM — same parser, same planner, same SQL. Tests run with no server. Setting
`DATABASE_URL` switches the same code to `pg` against a real cluster. Migrations
are identical in both.

**AD-6 · Optimistic concurrency.** Every mutable row carries `row_version`. An
update asserts the version it read; a mismatch returns 409 and the client
re-reads. This is F-04/R2.5 closed.

**AD-7 · Money as `numeric(14,2)` in whole currency units.** The legacy model
stored millions as floats. Migration multiplies by 1,000,000 into exact numeric;
the presentation layer divides back for display, so every screen reads the same.

## API surface (all under `/api`)

| Method | Path | Authority |
|--------|------|-----------|
| `POST` | `/auth/login`, `/auth/logout`, `GET /auth/me` | public / session |
| `GET` | `/bootstrap` | any authenticated — returns the scoped portfolio |
| `GET/POST/PATCH` | `/projects[/:id]` | read: scope · write: `can('project.write')` |
| `PATCH` | `/projects/:id/health`, `/phase`, `/baseline` | write + gate rules |
| `GET/POST/PATCH` | `/activities`, `/milestones` | project write |
| `GET/POST` | `/cost` (ledger) | `can('cost.write')` — group/admin only |
| `GET/POST/PATCH` | `/raid` | project write |
| `GET/POST/PATCH` | `/change[/:id]/approve|reject` | approval requires the routed authority |
| `GET/POST/PATCH` | `/resources`, `/allocations` | site or group write |
| `GET/POST/PATCH` | `/documents` | project write |
| `GET/POST` | `/meetings/series`, `/meetings/occurrences` | scope write |
| `POST` | `/meetings/occurrences/:id/{open,close,decision,action,attendance}` | scope write |
| `GET` | `/meetings/occurrences/:id/agenda`, `/minutes` | scope read |
| `GET/POST/PATCH/DELETE` | `/admin/users`, `/admin/grants`, `/admin/settings` | `admin` only |
| `GET` | `/audit` | `admin` or `group` |

## Roles → authority matrix

| Action | admin | group *(in granted programmes)* | site *(in granted sites)* | viewer |
|--------|:-----:|:---:|:---:|:---:|
| Read portfolio (in scope) | ✓ | ✓ | ✓ | ✓ |
| Read group-level project | ✓ | ✓ | ✓ read-only | ✓ |
| Create/edit site project | ✓ | ✓ | ✓ | — |
| Create/edit group project | ✓ | ✓ | — | — |
| Re-baseline | ✓ | ✓ | — | — |
| Book cost / release contingency | ✓ | ✓ | — | — |
| Raise change request | ✓ | ✓ | ✓ | — |
| Approve change ≤ CCB threshold | ✓ | ✓ | ✓ *(site projects)* | — |
| Approve change > CCB threshold | ✓ | ✓ | — | — |
| Advance gate | ✓ | ✓ | ✓ *(site projects)* | — |
| Manage RAID | ✓ | ✓ | ✓ | — |
| Allocate people | ✓ | ✓ | ✓ *(own site's people)* | — |
| Run/close a meeting | ✓ | ✓ *(group & programme series)* | ✓ *(site series)* | — |
| Manage users & grants | ✓ | — | — | — |
| Change global settings | ✓ | — | — | — |
| Read audit | ✓ | ✓ | — | — |

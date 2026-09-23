> English translation of [`docs/30-vues-restitution.md`](../30-vues-restitution.md). The French original is the authoritative record; where they differ, the French governs.

# 30 · The reporting views — `reporting.*`

**INT-05** ([`27`](../27-comite-interoperabilite.md) §3). The `reporting`
schema is the read contract for decision-support tools:
Power BI, Excel, Tableau and Qlik all speak PostgreSQL natively, and
these fourteen views are what they read. **Names and columns are stable**:
removing or renaming one is a MAJOR change in the sense of the
[CHANGELOG](../../CHANGELOG.md) — an operator must be warned before
upgrading.

## Connecting

On the PostgreSQL instance (never on PGlite — see PG-01):

```sql
CREATE ROLE reporting_reader LOGIN PASSWORD '…';
GRANT USAGE ON SCHEMA reporting TO reporting_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO reporting_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting
  GRANT SELECT ON TABLES TO reporting_reader;
```

Then, in the tool: PostgreSQL source, the instance's database, schema
`reporting`, this role. Nothing else.

## What these views do not give, and why

- **No earned-value figures** (EV, CPI, SPI, EAC). This
  arithmetic lives in `shared/engine.js`, frozen; redoing it in SQL
  would create a second source of truth. EVM is read from `/api/v1/portfolio`,
  which comes out of the same serialiser as the screen.
- **No accounts, sessions, keys, or before/after images**
  of the trail (`before_json` can contain what a deleted row held).
  The full trail goes through the API scope `read:audit`, which is
  revoked at the key; SQL access cannot be revoked that way.
- **Money is in whole units** of the reporting currency, as in
  the database. Formatting belongs to the tool; a million divided twice
  is the kind of defect that takes six months to notice.

## The views

| View | One row per | Columns |
|---|---|---|
| `sites` | site | id, city, region, country (ISO 3166), legal_entity, tz_name, headcount, fte, active |
| `programmes` | programme | id, name, sponsor, active |
| `projects` | project | id, name, programme_id, site_id, governance_level, method, phase, gate, start_date, finish_date, baseline_finish, budget, contingency, contingency_used, health_override, closed, pir_on, pir_verdict |
| `milestones` | plan milestone | id, project_id, name, kind (gate\|milestone), gate, due_date, base_date, done |
| `risks` | RAID line | id, project_id, kind (Risk\|Issue\|Assumption\|Dependency), title, probability (1-5), impact (1-5), status, response, owner_id, opened_on, review_on, origin_site |
| `cost_lines` | ledger entry (append-only — a correction is a reversal) | id, project_id, period (YYYY-MM), booked_on, amount, category, from_contingency, kind (capex\|opex), currency, fx_rate, amount_local |
| `commitments` | commitment (purchase order) | id, project_id, reference, supplier, amount, currency, fx_rate, kind, raised_on, expected_on, status |
| `benefits` | promised benefit | id, project_id, kind, title, measure, unit, baseline, target, actual (in the benefit's OWN unit, never in currency), realise_on, measured_on, status |
| `timesheets` | week × person × project | id, project_id, person_id, week_start, days |
| `lessons` | lesson | id, project_id (can be NULL: a lesson outlives the project), programme_id, site_id, gate_n, category, title, outcome (Positive\|Negative), recommendation, status, raised_on, adopted_on |
| `tolerances` | tolerance granted (the full history; `active` marks the current one) | id, project_id, schedule_days, cost_pct, benefit_pct, set_on, active |
| `exceptions` | observed breach | id, project_id, dimension (schedule\|cost\|benefit), raised_on, measured, allowed (frozen at the finding), status, answer_kind, answered_on |
| `business_cases` | business case (one per project) | id, project_id, expected_cost, expected_benefit, written_on, updated_on, reconfirmed_gate, reconfirmed_on |
| `decisions` | governance decision | id, at, user_label, action, entity, entity_id, detail — filtered on the exact labels the routes write |

## The stability rule

Adding a column or a view: MINOR change. Removing, renaming,
changing the meaning of a column: **MAJOR**, announced in the CHANGELOG before
delivery. A test (`server/test/reporting.test.js`) holds the
correspondence between this document and the real schema: an
undocumented view or a documented view that is absent fails the build.

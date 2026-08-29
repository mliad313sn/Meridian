-- ═══════════════════════════════════════════════════════════════════
-- 002 · PORTFOLIO — projects, schedule, cost, RAID, change, resources
--
-- Column names track the legacy field names deliberately (R3: the engine
-- is behaviour-frozen, so the less translation between store and engine,
-- the fewer places behaviour can drift).
--
-- Money is numeric in whole currency units (F-07 / R2.4). The legacy book
-- carried millions as floats; the serialiser divides by 1e6 on the way out
-- so every screen still reads "$8.40M" while the ledger stays exact.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE project (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  programme_id      text NOT NULL REFERENCES programme(id) ON DELETE RESTRICT,
  site_id           text NOT NULL REFERENCES site(id)      ON DELETE RESTRICT,
  -- R4.1: the authority boundary, distinct from the delivery location.
  governance_level  text NOT NULL DEFAULT 'site'
                    CHECK (governance_level IN ('group','site')),
  pm_id             text REFERENCES person(id) ON DELETE SET NULL,
  method            text NOT NULL DEFAULT 'Hybrid'
                    CHECK (method IN ('Waterfall','Agile','Hybrid')),
  start_date        date NOT NULL,
  finish_date       date NOT NULL,
  baseline_finish   date NOT NULL,
  budget            numeric(16,2) NOT NULL DEFAULT 0,
  contingency       numeric(16,2) NOT NULL DEFAULT 0,
  contingency_used  numeric(16,2) NOT NULL DEFAULT 0,
  description       text NOT NULL DEFAULT '',
  phase             text NOT NULL DEFAULT 'Initiation',
  gate              integer NOT NULL DEFAULT 0,
  health_override   text CHECK (health_override IN ('G','A','R')),
  health_override_why text NOT NULL DEFAULT '',
  closed            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1,
  CONSTRAINT project_dates_ordered CHECK (finish_date >= start_date),
  CONSTRAINT project_budget_positive CHECK (budget >= 0 AND contingency >= 0),
  CONSTRAINT project_contingency_bounded CHECK (contingency_used <= contingency)
);
CREATE INDEX project_prog_idx ON project(programme_id);
CREATE INDEX project_site_idx ON project(site_id);
CREATE INDEX project_gov_idx  ON project(governance_level);

CREATE TABLE activity (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name          text NOT NULL,
  stage         integer NOT NULL DEFAULT 0,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  base_start    date NOT NULL,
  base_end      date NOT NULL,
  weight        numeric(6,4) NOT NULL DEFAULT 0,   -- share of BAC, 0..1
  pct           integer NOT NULL DEFAULT 0 CHECK (pct BETWEEN 0 AND 100),
  owner_id      text REFERENCES person(id) ON DELETE SET NULL,
  row_version   integer NOT NULL DEFAULT 1,
  CONSTRAINT activity_dates_ordered CHECK (end_date >= start_date)
);
CREATE INDEX activity_project_idx ON activity(project_id, stage);

-- Finish-to-start links inside one project.
CREATE TABLE activity_dep (
  activity_id      text NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  predecessor_id   text NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, predecessor_id),
  CONSTRAINT dep_not_self CHECK (activity_id <> predecessor_id)
);

-- Edges between projects, drawn on the integrated master schedule.
CREATE TABLE cross_dep (
  id          bigserial PRIMARY KEY,
  from_project text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  from_stage   integer NOT NULL,
  to_project   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  to_stage     integer NOT NULL,
  label        text NOT NULL DEFAULT '',
  CONSTRAINT cross_dep_not_self CHECK (from_project <> to_project)
);

CREATE TABLE milestone (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name        text NOT NULL,
  due_date    date NOT NULL,
  base_date   date NOT NULL,
  gate        integer,
  kind        text NOT NULL DEFAULT 'milestone' CHECK (kind IN ('gate','milestone')),
  owner_id    text REFERENCES person(id) ON DELETE SET NULL,
  done        boolean NOT NULL DEFAULT false,
  row_version integer NOT NULL DEFAULT 1
);
CREATE INDEX milestone_project_idx ON milestone(project_id, due_date);
CREATE INDEX milestone_gate_idx    ON milestone(project_id, gate);

-- ── cost ledger ────────────────────────────────────────────────────
-- Append-mostly. A booked cost is corrected by a reversing line, never
-- by an edit, so AC always reconciles to the sum of the ledger (A5).
CREATE TABLE cost_line (
  id          bigserial PRIMARY KEY,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  period      text NOT NULL,                 -- YYYY-MM, the reporting month
  booked_on   date,
  amount      numeric(16,2) NOT NULL,
  category    text NOT NULL DEFAULT 'Labour',
  note        text NOT NULL DEFAULT '',
  from_contingency boolean NOT NULL DEFAULT false,
  created_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_period_shape CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')
);
CREATE INDEX cost_project_idx ON cost_line(project_id, period);

-- ── RAID ───────────────────────────────────────────────────────────
-- project_id NULL means portfolio-wide, which the legacy register uses
-- for items like a bench shortage that belong to no single project.
CREATE TABLE raid_item (
  id           text PRIMARY KEY,
  project_id   text REFERENCES project(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('Risk','Issue','Assumption','Dependency')),
  title        text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  probability  integer NOT NULL DEFAULT 1 CHECK (probability BETWEEN 1 AND 5),
  impact       integer NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 5),
  status       text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
  response     text NOT NULL DEFAULT 'Monitor',
  owner_id     text REFERENCES person(id) ON DELETE SET NULL,
  opened_on    date NOT NULL DEFAULT CURRENT_DATE,
  review_on    date,
  row_version  integer NOT NULL DEFAULT 1
);
CREATE INDEX raid_project_idx ON raid_item(project_id, status);
CREATE INDEX raid_status_idx  ON raid_item(status);

-- ── change control ─────────────────────────────────────────────────
CREATE TABLE change_request (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  raised_by    text REFERENCES person(id) ON DELETE SET NULL,
  raised_on    date NOT NULL DEFAULT CURRENT_DATE,
  cost_delta   numeric(16,2) NOT NULL DEFAULT 0,
  weeks_delta  integer NOT NULL DEFAULT 0,
  funding      text NOT NULL DEFAULT 'Contingency',
  risk_delta   text NOT NULL DEFAULT '0',
  status       text NOT NULL DEFAULT 'Pending'
               CHECK (status IN ('Pending','Approved','Rejected')),
  applied      boolean NOT NULL DEFAULT false,
  row_version  integer NOT NULL DEFAULT 1
);
CREATE INDEX cr_project_idx ON change_request(project_id, status);

CREATE TABLE change_step (
  id          bigserial PRIMARY KEY,
  cr_id       text NOT NULL REFERENCES change_request(id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  role_label  text NOT NULL,
  note        text NOT NULL DEFAULT '',
  state       text NOT NULL DEFAULT 'waiting'
              CHECK (state IN ('waiting','current','done','rejected')),
  decided_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  decided_on  date,
  comment     text NOT NULL DEFAULT '',
  UNIQUE (cr_id, seq)
);

-- ── resources ──────────────────────────────────────────────────────
-- Range-based, as the legacy engine expects: a person is on a project
-- from a date to a date at a percentage, and the capacity view buckets
-- those ranges into weeks at read time.
CREATE TABLE allocation (
  id           bigserial PRIMARY KEY,
  person_id    text NOT NULL REFERENCES person(id)  ON DELETE CASCADE,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  from_date    date NOT NULL,
  to_date      date NOT NULL,
  pct          integer NOT NULL CHECK (pct BETWEEN 0 AND 200),
  row_version  integer NOT NULL DEFAULT 1,
  CONSTRAINT allocation_dates_ordered CHECK (to_date >= from_date)
);
CREATE INDEX allocation_person_idx  ON allocation(person_id, from_date);
CREATE INDEX allocation_project_idx ON allocation(project_id);

-- ── documents & work items ─────────────────────────────────────────
CREATE TABLE document (
  id          text PRIMARY KEY,
  project_id  text REFERENCES project(id) ON DELETE CASCADE,
  name        text NOT NULL,
  doc_type    text NOT NULL DEFAULT 'Assurance',
  gate        integer NOT NULL DEFAULT 0,
  owner_id    text REFERENCES person(id) ON DELETE SET NULL,
  revision    text NOT NULL DEFAULT '0.1',
  status      text NOT NULL DEFAULT 'Draft'
              CHECK (status IN ('Draft','In review','Approved','Superseded')),
  updated_on  date NOT NULL DEFAULT CURRENT_DATE,
  row_version integer NOT NULL DEFAULT 1
);
CREATE INDEX document_project_idx ON document(project_id, gate);

CREATE TABLE board_column (
  id    text PRIMARY KEY,
  name  text NOT NULL,
  seq   integer NOT NULL DEFAULT 0,
  wip   integer NOT NULL DEFAULT 0
);

CREATE TABLE work_item (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  column_id   text NOT NULL REFERENCES board_column(id) ON DELETE RESTRICT,
  title       text NOT NULL,
  assignee_id text REFERENCES person(id) ON DELETE SET NULL,
  points      integer NOT NULL DEFAULT 1,
  priority    text NOT NULL DEFAULT 'P3',
  created_on  date NOT NULL DEFAULT CURRENT_DATE,
  row_version integer NOT NULL DEFAULT 1
);
CREATE INDEX work_item_project_idx ON work_item(project_id, column_id);

-- Report narrative overrides, keyed by block. Portfolio-wide, so the
-- weekly pack keeps whatever the PMO director wrote last week.
CREATE TABLE report_narrative (
  block_key  text PRIMARY KEY,
  lines      jsonb NOT NULL,
  updated_by text REFERENCES app_user(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

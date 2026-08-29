-- ═══════════════════════════════════════════════════════════════════
-- 009 · PERIOD CLOSE AND REPORTED SNAPSHOTS  (committee finding V-02)
--
-- Every number on the reports screen is computed live from current data.
-- That is right for running the portfolio and wrong for governing it: in
-- June you cannot regenerate the pack the board saw in March, because the
-- inputs moved underneath it. Internal audit's phrase was "a number that
-- cannot be reproduced is a number the board stops trusting the first
-- time it moves".
--
-- So a period CLOSE freezes what was reported, project by project, and
-- the reports screen renders from the frozen set whenever a closed period
-- is selected. Two consequences are deliberate:
--
--   · the rows are append-only, like the audit trail (R6.2). A closed
--     period is a record of what was said, not a working copy;
--   · a correction is therefore a NEW period that names the one it
--     restates, so the restatement is itself on the record rather than
--     an edit nobody can see.
--
-- project_id is intentionally NOT a foreign key. The reported history has
-- to outlive the project it describes, and a cascade from a deleted
-- project would quietly rewrite what the board was told.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE report_period (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  -- the as-at the figures were computed on, which is the portfolio's
  -- status date at close, not the wall clock of the person closing it
  status_date date NOT NULL,
  closed_at   timestamptz NOT NULL DEFAULT now(),
  closed_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  closed_by_label text NOT NULL DEFAULT '',
  note        text NOT NULL DEFAULT '',
  -- a restatement names what it restates; NULL for an ordinary close
  restates    text REFERENCES report_period(id) ON DELETE SET NULL,
  projects    integer NOT NULL DEFAULT 0
);
CREATE INDEX report_period_date_idx ON report_period(status_date DESC);

CREATE TABLE report_snapshot (
  period_id         text NOT NULL REFERENCES report_period(id) ON DELETE CASCADE,
  project_id        text NOT NULL,
  project_name      text NOT NULL,
  programme_id      text,
  site_id           text,
  governance_level  text,
  pm_id             text,
  phase             text,
  rag               text,
  rag_why           text NOT NULL DEFAULT '',
  -- earned value, exactly as reported. Money in whole units like the
  -- ledger; the indices are dimensionless.
  bac numeric, ac numeric, ev numeric, pv numeric,
  spi numeric, cpi numeric, eac numeric, vac numeric,
  measurable        boolean NOT NULL DEFAULT false,
  pct_complete      numeric,
  planned_complete  numeric,
  forecast_finish   date,
  baseline_finish   date,
  finish_date       date,
  gate_n            integer,
  gate_state        text,
  open_risks        integer NOT NULL DEFAULT 0,
  steering_risks    integer NOT NULL DEFAULT 0,
  benefits_promised integer NOT NULL DEFAULT 0,
  benefits_measured integer NOT NULL DEFAULT 0,
  benefits_met      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (period_id, project_id)
);

-- Append-only, by the same rules the audit trail carries. Rewriting a
-- closed period has to fail at the database, not at a code review.
CREATE RULE period_no_update   AS ON UPDATE TO report_period   DO INSTEAD NOTHING;
CREATE RULE period_no_delete   AS ON DELETE TO report_period   DO INSTEAD NOTHING;
CREATE RULE snapshot_no_update AS ON UPDATE TO report_snapshot DO INSTEAD NOTHING;
CREATE RULE snapshot_no_delete AS ON DELETE TO report_snapshot DO INSTEAD NOTHING;

INSERT INTO id_counter (prefix, next_value) VALUES ('RP', 0);

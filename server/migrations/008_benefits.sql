-- ═══════════════════════════════════════════════════════════════════
-- 008 · BENEFITS AND VALUE REALISATION  (Endeavour committee, V-01)
--
-- The committee's finding was that the portfolio could prove a project
-- was RUN WELL and could not prove it was WORTH DOING: budget, dates and
-- effort, but no business case, no benefit, no measured outcome. A cost
-- report is always droppable; this is what makes it a value report.
--
-- A benefit is deliberately NOT money-shaped. Value here is spoken in
-- production, plant availability, hours and cost per ounce as often as in
-- currency, so a benefit carries its own `measure` and `unit` and its
-- numbers are held in THAT unit. They are never divided by 1e6 — the
-- money convention in portfolio.js does not apply to this table.
--
-- The verdict is separated from the measurement on purpose. A project
-- manager records what was measured; whether that counts as met is a
-- group-level act (`benefit.review`), for the same reason the raiser of a
-- change cannot decide it.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE benefit (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  -- The vocabulary the sponsor actually uses. "Cost" covers both saving
  -- and avoidance; the detail says which.
  kind         text NOT NULL
                 CHECK (kind IN ('Production','Availability','Cost','Risk','Compliance')),
  title        text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  -- What is counted, and in what. Without these a baseline is a number
  -- with no meaning a year later.
  measure      text NOT NULL DEFAULT '',
  unit         text NOT NULL DEFAULT '',
  baseline     numeric,
  target       numeric,
  actual       numeric,
  owner_id     text REFERENCES person(id) ON DELETE SET NULL,
  realise_on   date,
  measured_on  date,
  status       text NOT NULL DEFAULT 'Forecast'
                 CHECK (status IN ('Forecast','Realised','Partially realised','Missed','Withdrawn')),
  row_version  integer NOT NULL DEFAULT 1
);
CREATE INDEX benefit_project_idx ON benefit(project_id);
CREATE INDEX benefit_owner_idx   ON benefit(owner_id);

INSERT INTO id_counter (prefix, next_value) VALUES ('BEN', 0);

-- The post-implementation review: one verdict per project, with the
-- reason. Held on the project rather than in its own table because there
-- is exactly one, and it is the answer to a question about the project.
ALTER TABLE project ADD COLUMN pir_on date;
ALTER TABLE project ADD COLUMN pir_verdict text
  CHECK (pir_verdict IN ('Met','Partly met','Missed'));
ALTER TABLE project ADD COLUMN pir_note text NOT NULL DEFAULT '';

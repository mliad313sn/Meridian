-- ═══════════════════════════════════════════════════════════════════
-- 064 · WHAT IF IS NOT WHAT IS — portfolio scenarios  (docs/41 FX-12)
--
-- S2 (group PMO): « et si on reportait PRJ-118 d'un trimestre ? » se
-- faisait dans un tableur, hors piste. A scenario is that spreadsheet,
-- inside the product and on the record: a NAMED, ISOLATED set of changes
-- over the live portfolio —
--
--   shift     defer (+N) or accelerate (−N) a project by N weeks
--   cancel    stop a project: spend stops at what is spent, people and
--             future benefits are released (closing the record stays the
--             closure gate's job, PM-08)
--   budget    a project's budget becomes X
--   envelope  the capex envelope becomes X
--   weight    one ranking weight (REQ-24) becomes W
--
-- D-41.02 — a scenario NEVER writes the live book. These two tables are
-- the only thing a scenario writes; everything it shows is computed from
-- them by shared/scenario.js on a copy of the book held in memory.
--
-- It reaches the live book only one way: a DECISION in the decision
-- register that names it (`meeting_decision.scenario_id`), ratified under
-- REQ-49/50 by someone independent of the decider, of the account that
-- recorded it, and of the scenario's author. Applying it then performs
-- each change as its own audited mutation, asserting the row version the
-- change was written against (`base_version`, `base_value`): a live row
-- that moved since is a 409 naming it, not a silent overwrite.
--
-- Money is stored like every other amount of the book (exact currency
-- units) and read in millions by the serialiser.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE scenario (
  id          text PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  note        text NOT NULL DEFAULT '',
  -- Draft: editable · Proposed: a decision names it, frozen ·
  -- Applied: in the live book · Withdrawn: will never be applied
  status      text NOT NULL DEFAULT 'Draft'
              CHECK (status IN ('Draft', 'Proposed', 'Applied', 'Withdrawn')),
  created_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  created_on  date NOT NULL DEFAULT CURRENT_DATE,
  applied_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  applied_on  date,
  row_version integer NOT NULL DEFAULT 1,
  CONSTRAINT scenario_applied_dated CHECK ((status = 'Applied') = (applied_on IS NOT NULL))
);

CREATE TABLE scenario_change (
  id           text PRIMARY KEY,
  scenario_id  text NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  seq          integer NOT NULL DEFAULT 0,
  kind         text NOT NULL CHECK (kind IN ('shift', 'cancel', 'budget', 'envelope', 'weight')),
  project_id   text REFERENCES project(id) ON DELETE CASCADE,
  weeks        integer CHECK (weeks IS NULL OR (weeks <> 0 AND weeks BETWEEN -104 AND 104)),
  amount       numeric(18,2) CHECK (amount IS NULL OR amount >= 0),
  weight_input text CHECK (weight_input IS NULL OR weight_input IN ('value', 'confidence', 'exposure', 'capacity')),
  weight       integer CHECK (weight IS NULL OR weight BETWEEN 0 AND 100),
  -- what the live row was when this change was written: the row version
  -- (project, weighting), or the value (the envelope, a setting with no
  -- version). Applying asserts it.
  base_version integer,
  base_value   numeric(18,2),
  note         text NOT NULL DEFAULT '',
  row_version  integer NOT NULL DEFAULT 1,
  CONSTRAINT scenario_change_shape CHECK (
    (kind = 'shift'    AND project_id IS NOT NULL AND weeks IS NOT NULL) OR
    (kind = 'cancel'   AND project_id IS NOT NULL) OR
    (kind = 'budget'   AND project_id IS NOT NULL AND amount IS NOT NULL) OR
    (kind = 'envelope' AND project_id IS NULL AND amount IS NOT NULL) OR
    (kind = 'weight'   AND project_id IS NULL AND weight_input IS NOT NULL AND weight IS NOT NULL))
);
CREATE INDEX scenario_change_scenario_idx ON scenario_change(scenario_id, seq);

-- The register names the scenario it decides on. One direction only, so
-- the book imports scenarios before decisions without a cycle.
ALTER TABLE meeting_decision ADD COLUMN scenario_id text
  REFERENCES scenario(id) ON DELETE SET NULL;
CREATE INDEX meeting_decision_scenario_idx ON meeting_decision(scenario_id)
  WHERE scenario_id IS NOT NULL;

INSERT INTO id_counter (prefix, next_value) VALUES ('SCN', 0), ('SCC', 0)
  ON CONFLICT (prefix) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 066 · HOW SURE IS THE FINISH  (docs/41 wave D-slot, FX-11 · FX-16)
--
-- FX-11 · The finish date is a point. A steering committee cannot tell
--   whether it has a one-in-five or a four-in-five chance of holding.
--   A planner now says, per stage, "4 days, 3 at best, 8 at worst":
--   three estimates, in days (working days when the project has a
--   calendar, like every duration). A Monte Carlo run samples them
--   through the ONE scheduler (shared/montecarlo.js → shared/schedule.js)
--   and its result is kept here, dated, signed and seeded, so anyone can
--   recompute it and nobody can retouch it.
--
-- FX-16 · The printable schedule report has no table: it is drawn from
--   the plan, the named baselines and the latest risk run.
--
-- Everything here is ADDITIVE (D-41.01): three NULL columns on
-- `activity` — no estimate is the 5.28.0 plan, every number unchanged —
-- and one new table. D-41.02: a risk run is a record of a computation.
-- It moves no date; nothing in this file touches a row that exists.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE activity ADD COLUMN dur_optimistic  numeric;
ALTER TABLE activity ADD COLUMN dur_most_likely numeric;
ALTER TABLE activity ADD COLUMN dur_pessimistic numeric;

-- All three or none, never negative, in order. A stage with half an
-- estimate would be sampled from a shape nobody gave.
ALTER TABLE activity ADD CONSTRAINT activity_estimate_whole CHECK (
  (dur_optimistic IS NULL AND dur_most_likely IS NULL AND dur_pessimistic IS NULL) OR
  (dur_optimistic IS NOT NULL AND dur_most_likely IS NOT NULL AND dur_pessimistic IS NOT NULL));
ALTER TABLE activity ADD CONSTRAINT activity_estimate_ordered CHECK (
  dur_optimistic IS NULL OR
  (dur_optimistic >= 0 AND dur_optimistic <= dur_most_likely AND dur_most_likely <= dur_pessimistic
   AND dur_pessimistic <= 3650));

COMMENT ON COLUMN activity.dur_most_likely IS
  'FX-11 — three-point estimate (optimistic ≤ most likely ≤ pessimistic), in days; working days under a calendar. NULL: the planned duration, fixed.';

CREATE TABLE risk_run (
  id                   text PRIMARY KEY,
  project_id           text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ran_at               timestamptz NOT NULL DEFAULT now(),
  ran_by               text REFERENCES app_user(id) ON DELETE SET NULL,
  -- what makes it reproducible: the same book, seed and count give the same result
  seed                 bigint NOT NULL,
  iterations           integer NOT NULL,
  distribution         text NOT NULL DEFAULT 'triangular',
  -- the date the simulation was measured at (the project's, else the portfolio's)
  status_date          date,
  estimated            integer NOT NULL DEFAULT 0,
  deterministic_finish date,
  p50                  date,
  p80                  date,
  p90                  date,
  -- [[ISO date, runs]] and { stage id: share of runs on the critical path }
  histogram            jsonb NOT NULL DEFAULT '[]',
  criticality          jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT risk_run_iterations_bounded CHECK (iterations BETWEEN 1 AND 10000),
  CONSTRAINT risk_run_seed_bounded CHECK (seed BETWEEN 1 AND 4294967295),
  CONSTRAINT risk_run_distribution_known CHECK (distribution IN ('triangular'))
);
CREATE INDEX risk_run_project_idx ON risk_run(project_id, ran_at);

COMMENT ON TABLE risk_run IS
  'FX-11 — a stored Monte Carlo run of one project''s schedule: seed, iterations, who, when, and the result. Read-only once stored; it never moves a date (D-41.02).';

-- Read-only once stored. A rewrite that changes nothing (a merge import
-- of the product's own export upserts every row onto itself) passes.
CREATE OR REPLACE FUNCTION risk_run_frozen() RETURNS trigger AS $$
BEGIN
  IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'Risk run: a stored run is read-only — run the simulation again instead';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER risk_run_frozen_trigger
  BEFORE UPDATE ON risk_run
  FOR EACH ROW EXECUTE FUNCTION risk_run_frozen();

INSERT INTO id_counter (prefix, next_value) VALUES ('MCR', 0);

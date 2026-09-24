-- ═══════════════════════════════════════════════════════════════════
-- 062 · A PLAN HAS A SHAPE, AND A MEMORY  (docs/41 wave A2 — FX-05, FX-07)
--
-- FX-05 · the work breakdown. A project of eighty stages was a flat list
-- of eighty rows. A stage may now name a PARENT stage of the same
-- project. A stage that has children is a SUMMARY: its dates, its weight
-- and its progress are computed from its children and never entered, and
-- it carries no link of its own and no weight of its own — so the earned
-- value of a project is the sum over its LEAVES, exactly as before, and
-- nothing is counted twice (shared/engine.js, `Engine.activities`).
--
-- Rules the database holds, whatever path writes (route, import, SQL):
--   · a parent is a stage of the same project;
--   · a stage is never its own ancestor (no cycle);
--   · a stage that has children takes no dependency link, and a stage
--     that has a link cannot be given children.
-- A book in which no stage names a parent is read exactly as in 5.28.0
-- (D-41.01): the column is NULL everywhere, and every number is equal.
--
-- FX-07 · named baselines. Re-planning moved the only reference there
-- was. A project may now keep up to eleven named SNAPSHOTS of its plan
-- (MS Project's count): who took it, when, why, and each stage's start,
-- end and weight as they were. A snapshot is read-only once taken — the
-- database refuses to rewrite one — and taking one never touches
-- `activity.base_start` / `base_end`: the governed baseline, which only
-- the change chain moves.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE activity ADD COLUMN parent_id text REFERENCES activity(id);
ALTER TABLE activity ADD CONSTRAINT activity_parent_not_self
  CHECK (parent_id IS NULL OR parent_id <> id);
CREATE INDEX activity_parent_idx ON activity(parent_id);

COMMENT ON COLUMN activity.parent_id IS
  'FX-05 — the summary stage this one rolls up into, in the same project. NULL = top level. A stage with children is a summary: dates, weight and progress derived from its children, no link and no weight of its own.';

CREATE OR REPLACE FUNCTION activity_parent_guard() RETURNS trigger AS $$
DECLARE pproj text; looped boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT project_id INTO pproj FROM activity WHERE id = NEW.parent_id;
  IF pproj IS NULL THEN RETURN NEW; END IF;      -- the foreign key answers "no such stage"
  IF pproj <> NEW.project_id THEN
    RAISE EXCEPTION 'Work breakdown: a stage rolls up into a stage of its own project — % is not in %',
      NEW.parent_id, NEW.project_id;
  END IF;
  WITH RECURSIVE up(id, parent_id) AS (
    SELECT id, parent_id FROM activity WHERE id = NEW.parent_id
    UNION
    SELECT a.id, a.parent_id FROM activity a JOIN up ON a.id = up.parent_id
  )
  SELECT EXISTS (SELECT 1 FROM up WHERE id = NEW.id) INTO looped;
  IF looped THEN
    RAISE EXCEPTION 'Work breakdown: % cannot roll up into % — that would make it its own ancestor',
      NEW.id, NEW.parent_id;
  END IF;
  IF EXISTS (SELECT 1 FROM activity_dep
              WHERE activity_id = NEW.parent_id OR predecessor_id = NEW.parent_id) THEN
    RAISE EXCEPTION 'Work breakdown: % has dependency links, and a summary stage carries none — remove its links first',
      NEW.parent_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER activity_parent_trigger
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON activity
  FOR EACH ROW EXECUTE FUNCTION activity_parent_guard();

-- …and from the other end: a link to or from a summary stage.
CREATE OR REPLACE FUNCTION activity_dep_not_summary() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM activity
              WHERE parent_id IN (NEW.activity_id, NEW.predecessor_id)) THEN
    RAISE EXCEPTION 'Work breakdown: a summary stage carries no dependency link — link its children instead';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER activity_dep_not_summary_trigger
  BEFORE INSERT OR UPDATE OF activity_id, predecessor_id ON activity_dep
  FOR EACH ROW EXECUTE FUNCTION activity_dep_not_summary();

-- ── FX-07 · named snapshots ──────────────────────────────────────────
CREATE TABLE baseline_snapshot (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name        text NOT NULL,
  taken_at    timestamptz NOT NULL DEFAULT now(),
  taken_by    text REFERENCES app_user(id) ON DELETE SET NULL,
  reason      text NOT NULL DEFAULT '',
  CONSTRAINT baseline_snapshot_named CHECK (length(btrim(name)) > 0),
  CONSTRAINT baseline_snapshot_name_uniq UNIQUE (project_id, name)
);
CREATE INDEX baseline_snapshot_project_idx ON baseline_snapshot(project_id, taken_at);

-- One row per stage as it stood. No foreign key to `activity`: a
-- snapshot outlives a stage removed after it was taken, and says so.
CREATE TABLE baseline_snapshot_row (
  snapshot_id  text NOT NULL REFERENCES baseline_snapshot(id) ON DELETE CASCADE,
  activity_id  text NOT NULL,
  name         text NOT NULL,
  parent_id    text,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  weight       numeric(6,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_id, activity_id),
  CONSTRAINT baseline_row_dates_ordered CHECK (end_date >= start_date)
);

COMMENT ON TABLE baseline_snapshot IS
  'FX-07 — a named, read-only picture of a project''s plan. At most eleven per project. Never moves activity.base_start/base_end (the governed baseline).';

-- At most eleven per project.
CREATE OR REPLACE FUNCTION baseline_snapshot_cap() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM baseline_snapshot WHERE project_id = NEW.project_id) >= 11 THEN
    RAISE EXCEPTION 'Baseline snapshot: % already keeps eleven named baselines, the most a project holds', NEW.project_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER baseline_snapshot_cap_trigger
  BEFORE INSERT ON baseline_snapshot
  FOR EACH ROW EXECUTE FUNCTION baseline_snapshot_cap();

-- Read-only once taken. A rewrite that changes nothing (a merge import of
-- the product's own export upserts every row onto itself) is not a
-- rewrite, and passes.
CREATE OR REPLACE FUNCTION baseline_snapshot_frozen() RETURNS trigger AS $$
BEGIN
  IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'Baseline snapshot: a snapshot is read-only once taken — take a new one instead';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER baseline_snapshot_frozen_trigger
  BEFORE UPDATE ON baseline_snapshot
  FOR EACH ROW EXECUTE FUNCTION baseline_snapshot_frozen();
CREATE TRIGGER baseline_snapshot_row_frozen_trigger
  BEFORE UPDATE ON baseline_snapshot_row
  FOR EACH ROW EXECUTE FUNCTION baseline_snapshot_frozen();

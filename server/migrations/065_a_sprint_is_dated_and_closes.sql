-- ═══════════════════════════════════════════════════════════════════
-- 065 · SPRINTS, POINTS, AND A HYBRID PLAN THAT DOES NOT LIE
--       (docs/41 FX-14, seat S3 — FitAdapt delivers in sprints)
--
-- Meridian knew stages and percentages; FitAdapt delivers modules as
-- goal runs, sprint by sprint. This migration adds, additively:
--
--   iteration            a sprint: dated, on one project, with a goal and
--                        a state (planned → active → closed). At most ONE
--                        active sprint per project, held by the database
--                        (a partial unique index), not only by the route.
--                        A closed sprint records the points it DELIVERED
--                        at the moment it closed (`done_points`) — what
--                        velocity reads, the way a closed period is what
--                        the board was told.
--   work_item.iteration_id   the sprint the item is planned in; NULL is
--                        the backlog. Deleting a planned sprint returns
--                        its items to the backlog.
--   work_item.activity_id    the schedule stage the item delivers (the
--                        hybrid link). Same project, checked by the routes.
--   work_item.done_at    when the item reached the Done column — what a
--                        burndown is drawn from. Back-filled below from the
--                        audit trail where the trail can say it, and left
--                        NULL where it cannot: a date nobody recorded is
--                        not invented.
--   work_item.points     was NOT NULL DEFAULT 1. It becomes nullable (an
--                        item nobody has estimated is not a one-point item)
--                        and may not be negative. The default stays 1, so
--                        every existing write path writes what it wrote.
--   activity.progress_from_items   OFF by default. When on, the stage's
--                        physical % is done points / total points of the
--                        items linked to it, fed into the SAME `pct` the
--                        engine already reads (5.9.1). Off, nothing
--                        changes (D-41.01).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS iteration (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name            text NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  goal            text NOT NULL DEFAULT '',
  state           text NOT NULL DEFAULT 'planned',
  -- measured when it closed; NULL until then
  done_points     integer,
  closed_on       date,
  external_source text REFERENCES integration(id) ON DELETE SET NULL,
  external_id     text,
  row_version     integer NOT NULL DEFAULT 1,
  CONSTRAINT iteration_state_known CHECK (state IN ('planned', 'active', 'closed')),
  CONSTRAINT iteration_dates_ordered CHECK (ends_on >= starts_on),
  CONSTRAINT iteration_done_points_not_negative CHECK (done_points IS NULL OR done_points >= 0),
  -- A closed sprint says what it delivered and when it closed; an open
  -- one has delivered nothing yet that velocity may read.
  CONSTRAINT iteration_closed_is_measured CHECK (
    (state = 'closed') = (done_points IS NOT NULL AND closed_on IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS iteration_one_active_per_project
  ON iteration(project_id) WHERE state = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS iteration_external_idx
  ON iteration(external_source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS iteration_project_idx ON iteration(project_id, starts_on);

ALTER TABLE work_item ADD COLUMN IF NOT EXISTS iteration_id text REFERENCES iteration(id) ON DELETE SET NULL;
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS activity_id  text REFERENCES activity(id)  ON DELETE SET NULL;
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS done_at      timestamptz;
CREATE INDEX IF NOT EXISTS work_item_iteration_idx ON work_item(iteration_id);
CREATE INDEX IF NOT EXISTS work_item_activity_idx  ON work_item(activity_id);

ALTER TABLE work_item ALTER COLUMN points DROP NOT NULL;
ALTER TABLE work_item DROP CONSTRAINT IF EXISTS work_item_points_not_negative;
ALTER TABLE work_item ADD  CONSTRAINT work_item_points_not_negative CHECK (points IS NULL OR points >= 0);

ALTER TABLE activity ADD COLUMN IF NOT EXISTS progress_from_items boolean NOT NULL DEFAULT false;

-- ── done_at, from what the trail already knows ─────────────────────
-- A move is audited as "Work item moved" without its target column, but
-- the LAST move of an item that sits in Done today is the move into Done.
-- Items in Done with no such event (seeded, imported, created there) keep
-- NULL: done, on a day nobody recorded. The charts say so.
UPDATE work_item w
   SET done_at = (SELECT max(e.at) FROM audit_event e
                   WHERE e.entity = 'work_item' AND e.entity_id = w.id
                     AND e.action = 'Work item moved')
 WHERE w.column_id = 'done' AND w.done_at IS NULL;

INSERT INTO id_counter (prefix, next_value) VALUES ('IT', 0) ON CONFLICT (prefix) DO NOTHING;

COMMENT ON TABLE iteration IS
  'FX-14 — a sprint of one project: dated, with a goal; planned → active → closed. One active per project (partial unique index). done_points is measured at close and is what velocity reads.';
COMMENT ON COLUMN work_item.done_at IS
  'FX-14 — when the item reached Done; cleared if it leaves Done. NULL for an item done before 065 whose move the trail does not record.';
COMMENT ON COLUMN activity.progress_from_items IS
  'FX-14 — off by default. When on, the physical % of this stage is done points / total points of its linked work items, fed into the same pct the engine reads.';

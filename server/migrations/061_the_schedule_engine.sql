-- ═══════════════════════════════════════════════════════════════════
-- 061 · THE SCHEDULE ENGINE — typed links, working calendars,
--       constraints, actuals  (docs/41 wave A1: FX-01 … FX-04)
--
-- A planner writes "the pour starts 3 days after the rebar starts"
-- (SS+3), "10 working days, not counting Christmas", "must finish by
-- 31/12", "started on the 4th, 6 days to go". 5.28.0 could say none of
-- it: finish-to-start only, calendar days, no date constraint, progress
-- as a percentage and nothing else.
--
-- Everything here is ADDITIVE (D-41.01). Every default reproduces 5.28.0:
--
--   activity_dep.type        'FS'   — what every existing link was
--   activity_dep.lag_days    0
--   activity.constraint_type 'ASAP' — no constraint
--   everything else          NULL   — no calendar, no deadline, no actual,
--                                     no project status date
--
-- and server/test/schedule-engine.test.js proves the demonstration book
-- computes the same numbers, key for key, as the frozen 5.28.0 engine.
--
-- A constraint or a deadline never rewrites a date anybody typed: the
-- engine bounds its passes with them and a violation reads as negative
-- float. Nothing in this file moves a row that exists.
-- ═══════════════════════════════════════════════════════════════════

-- ── FX-01 · four link types, with lag (negative = lead) ───────────
ALTER TABLE activity_dep ADD COLUMN type text NOT NULL DEFAULT 'FS';
ALTER TABLE activity_dep ADD CONSTRAINT activity_dep_type_known
  CHECK (type IN ('FS', 'SS', 'FF', 'SF'));
ALTER TABLE activity_dep ADD COLUMN lag_days integer NOT NULL DEFAULT 0;
ALTER TABLE activity_dep ADD CONSTRAINT activity_dep_lag_bounded
  CHECK (lag_days BETWEEN -3650 AND 3650);

COMMENT ON COLUMN activity_dep.type IS
  'FX-01 — FS (finish-to-start, the default and everything before 061), SS, FF or SF.';
COMMENT ON COLUMN activity_dep.lag_days IS
  'FX-01 — days between the two ends the type names; negative is a lead. Working days when the project has a calendar.';

-- ── FX-02 · working calendars ─────────────────────────────────────
-- `work_days` is a weekday bitmask, bit 0 = Sunday … bit 6 = Saturday
-- (JavaScript's getUTCDay), so Monday–Friday is 62. One calendar may be
-- the group default; a project uses its own, else its site's, else the
-- default, else none — and none is calendar days, exactly as before.
CREATE TABLE work_calendar (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  work_days    smallint NOT NULL DEFAULT 62,
  is_default   boolean NOT NULL DEFAULT false,
  note         text NOT NULL DEFAULT '',
  row_version  integer NOT NULL DEFAULT 1,
  CONSTRAINT work_calendar_has_a_working_day CHECK (work_days BETWEEN 1 AND 127),
  CONSTRAINT work_calendar_named CHECK (length(trim(name)) > 0)
);
CREATE UNIQUE INDEX work_calendar_one_default ON work_calendar (is_default) WHERE is_default;

-- Dated non-working days (public holidays, a site's shutdown). Edited as
-- the calendar's list: replaced whole under the calendar's row_version.
CREATE TABLE work_calendar_exception (
  calendar_id  text NOT NULL REFERENCES work_calendar(id) ON DELETE CASCADE,
  on_date      date NOT NULL,
  label        text NOT NULL DEFAULT '',
  PRIMARY KEY (calendar_id, on_date)
);

-- A calendar in use cannot be deleted from under a project or a site
-- (no ON DELETE action): its schedule would change without anyone
-- having changed it. The route says which rows still use it.
ALTER TABLE project ADD COLUMN calendar_id text REFERENCES work_calendar(id);
ALTER TABLE site    ADD COLUMN calendar_id text REFERENCES work_calendar(id);
CREATE INDEX project_calendar_idx ON project(calendar_id) WHERE calendar_id IS NOT NULL;
CREATE INDEX site_calendar_idx    ON site(calendar_id)    WHERE calendar_id IS NOT NULL;

COMMENT ON COLUMN project.calendar_id IS
  'FX-02 — the working calendar this project is scheduled on. NULL: the site''s, else the group default, else calendar days.';
COMMENT ON COLUMN site.calendar_id IS
  'FX-02 — the calendar a project at this site inherits when it names none.';

-- ── FX-03 · constraints and deadlines ─────────────────────────────
ALTER TABLE activity ADD COLUMN constraint_type text NOT NULL DEFAULT 'ASAP';
ALTER TABLE activity ADD COLUMN constraint_date date;
ALTER TABLE activity ADD COLUMN deadline date;
ALTER TABLE activity ADD CONSTRAINT activity_constraint_known
  CHECK (constraint_type IN ('ASAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'));
-- ASAP carries no date; every other type needs one.
ALTER TABLE activity ADD CONSTRAINT activity_constraint_dated
  CHECK ((constraint_type = 'ASAP') = (constraint_date IS NULL));

-- ── FX-04 · actuals, remaining duration, status date ──────────────
ALTER TABLE activity ADD COLUMN actual_start date;
ALTER TABLE activity ADD COLUMN actual_finish date;
ALTER TABLE activity ADD COLUMN remaining_days integer;
ALTER TABLE activity ADD CONSTRAINT activity_actuals_ordered
  CHECK (actual_finish IS NULL OR (actual_start IS NOT NULL AND actual_finish >= actual_start));
ALTER TABLE activity ADD CONSTRAINT activity_remaining_positive
  CHECK (remaining_days IS NULL OR remaining_days >= 0);

ALTER TABLE project ADD COLUMN status_date date;

COMMENT ON COLUMN activity.remaining_days IS
  'FX-04 — days still to do, counted from the project status date. NULL: the planned duration stands.';
COMMENT ON COLUMN project.status_date IS
  'FX-04 — the date the schedule and earned value are measured at. NULL: the portfolio status date, as before 061.';

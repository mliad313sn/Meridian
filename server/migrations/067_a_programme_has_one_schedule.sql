-- ═══════════════════════════════════════════════════════════════════
-- 067 · A PROGRAMME HAS ONE SCHEDULE — typed cross-project links
--       (docs/41 wave D: FX-15)
--
-- A link between two projects was finish-to-start, and it only alerted
-- (O-7, `Engine.crossDepBreaches`). "The fraud API's integration starts
-- three days after the ledger's cut-over starts" (SS+3) did not write,
-- and nothing computed the programme's finish across the links.
--
-- ADDITIVE (D-41.01). Every existing row reads exactly as before:
--
--   cross_dep.type      'FS'  — what every existing link was
--   cross_dep.lag_days  0
--   cross_dep.row_version 1   — a link now has attributes to change
--                               (type, lag, label), so it is edited
--                               under optimistic concurrency like any
--                               other row (AD-6)
--
-- The lag counts in the SUCCESSOR's working days (its project's calendar,
-- FX-02), as an activity_dep lag does within a project. Nothing here
-- moves a date: the programme schedule is computed, never stored
-- (D-41.02).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE cross_dep ADD COLUMN type text NOT NULL DEFAULT 'FS';
ALTER TABLE cross_dep ADD CONSTRAINT cross_dep_type_known
  CHECK (type IN ('FS', 'SS', 'FF', 'SF'));
ALTER TABLE cross_dep ADD COLUMN lag_days integer NOT NULL DEFAULT 0;
ALTER TABLE cross_dep ADD CONSTRAINT cross_dep_lag_bounded
  CHECK (lag_days BETWEEN -3650 AND 3650);
ALTER TABLE cross_dep ADD COLUMN row_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN cross_dep.type IS
  'FX-15 — FS (finish-to-start, the default and everything before 067), SS, FF or SF, between the two stages.';
COMMENT ON COLUMN cross_dep.lag_days IS
  'FX-15 — days between the two ends the type names, in the successor project''s working days; negative is a lead.';

-- ═══════════════════════════════════════════════════════════════════
-- 004 · INTEGRITY & ACCESS PATHS
--
-- Three findings from the backend review, in order of how much damage
-- they do:
--
--   1. Reference tables were updated without asserting a row version,
--      so two administrators editing the same person silently discarded
--      one of the edits. Reproduced, not theorised — see
--      server/test/concurrency.probe.mjs, probe 3.
--
--   2. Identifiers were allocated by reading MAX and adding one. Under
--      a single connection that is atomic by accident; behind a pool it
--      is a race, and the loser gets a primary-key violation reported as
--      a confusing 409. The development engine was hiding it.
--
--   3. PostgreSQL does not index foreign keys automatically. Thirty-two
--      FK columns had no index; the ones below are the ones actually
--      used as a query predicate or walked on a cascade.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · optimistic concurrency on the reference tables ─────────────
ALTER TABLE person       ADD COLUMN row_version integer NOT NULL DEFAULT 1;
ALTER TABLE site         ADD COLUMN row_version integer NOT NULL DEFAULT 1;
ALTER TABLE programme    ADD COLUMN row_version integer NOT NULL DEFAULT 1;
ALTER TABLE board_column ADD COLUMN row_version integer NOT NULL DEFAULT 1;

-- ── 2 · atomic identifier allocation ───────────────────────────────
-- One row per prefix. Allocation is a single UPDATE … RETURNING, which
-- takes a row lock for the duration of the transaction, so two
-- concurrent allocations serialise instead of colliding. Boring, and it
-- behaves identically on PGlite and on a pooled cluster.
CREATE TABLE id_counter (
  prefix     text PRIMARY KEY,
  next_value integer NOT NULL
);

-- Seeded from what is already in the book, so allocation continues from
-- where the seed left off rather than from one.
INSERT INTO id_counter (prefix, next_value)
SELECT 'PRJ', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 100) FROM project
UNION ALL SELECT 'RSK', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0) FROM raid_item WHERE id LIKE 'RSK-%'
UNION ALL SELECT 'ISS', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0) FROM raid_item WHERE id LIKE 'ISS-%'
UNION ALL SELECT 'ASM', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0) FROM raid_item WHERE id LIKE 'ASM-%'
UNION ALL SELECT 'DEP', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0) FROM raid_item WHERE id LIKE 'DEP-%'
UNION ALL SELECT 'CR',  COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 100) FROM change_request
UNION ALL SELECT 'DOC', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 100) FROM document
UNION ALL SELECT 'WI',  COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 299) FROM work_item
UNION ALL SELECT 'PE',  COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0)   FROM person
UNION ALL SELECT 'DEC', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0)   FROM meeting_decision
UNION ALL SELECT 'ACT', COALESCE(MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), ''))::int, 0)   FROM meeting_action
UNION ALL SELECT 'MS',  0;

-- ── 3 · the foreign keys that are actually traversed ───────────────
-- Not all thirty-two. An index costs write amplification, so these are
-- the ones with a query predicate behind them or a cascade that would
-- otherwise sequential-scan.

-- The integrated master schedule reads these on every load.
CREATE INDEX cross_dep_from_idx ON cross_dep(from_project);
CREATE INDEX cross_dep_to_idx   ON cross_dep(to_project);

-- Every activity delete walks the link table from both ends.
CREATE INDEX activity_dep_pred_idx ON activity_dep(predecessor_id);

-- The meeting screen joins these on every occurrence read.
CREATE INDEX meeting_action_raised_idx ON meeting_action(raised_in);
CREATE INDEX meeting_attendance_person_idx ON meeting_attendance(person_id);
CREATE INDEX meeting_decision_cr_idx ON meeting_decision(cr_id);

-- A person is referenced from eleven places. Deactivating one — which
-- the directory now does routinely — touches every one of them.
CREATE INDEX activity_owner_idx   ON activity(owner_id);
CREATE INDEX milestone_owner_idx  ON milestone(owner_id);
CREATE INDEX raid_owner_idx       ON raid_item(owner_id);
CREATE INDEX document_owner_idx   ON document(owner_id);
CREATE INDEX work_item_assignee_idx ON work_item(assignee_id);
CREATE INDEX project_pm_idx       ON project(pm_id);
CREATE INDEX change_request_raised_by_idx ON change_request(raised_by);

-- The ledger grows without bound and carries the only FK to app_user on
-- a growing table; deactivating an account should not scan it.
CREATE INDEX cost_line_created_by_idx ON cost_line(created_by);

-- Scope changes cascade to grants.
CREATE INDEX access_grant_programme_idx ON access_grant(programme_id);
CREATE INDEX access_grant_site_idx      ON access_grant(site_id);

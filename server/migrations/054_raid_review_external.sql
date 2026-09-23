-- ═══════════════════════════════════════════════════════════════════
-- 054 · A RAID REVIEW HAS AN EXTERNAL IDENTITY  (REQ-51, RT365)
--
-- The write contract could move a RAID row's review date — `review` on
-- PUT /api/v1/raid — which SCHEDULES a review. It could not record that
-- a review HAPPENED: 050 made that an event (`raid_review`), and only a
-- screen could write one. RT365's sync worked around it by moving the
-- date, which erases the only evidence that a review took place — the
-- defect REQ-46 was filed to end.
--
-- A review written through the contract is keyed, like every contract
-- row, by (integration, its own id): a sync that runs twice records one
-- review, not two. Rows written on a screen carry neither, as before.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE raid_review ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE raid_review ADD COLUMN external_id text;
CREATE UNIQUE INDEX raid_review_external_idx ON raid_review(external_source, external_id)
  WHERE external_id IS NOT NULL;

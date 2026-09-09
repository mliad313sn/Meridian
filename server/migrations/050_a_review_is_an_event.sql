-- ═══════════════════════════════════════════════════════════════════
-- 050 · A REVIEW IS AN EVENT, NOT A DATE THAT MOVES  (REQ-46)
--
-- Filed against ourselves while building REQ-28.
--
-- `raid_item.review_on` holds the date the register says this item is
-- NEXT to be looked at (002; the agenda has read it since 034). When a
-- review is actually performed, the only thing that happens is that the
-- date moves forward — which OVERWRITES the only evidence that a review
-- took place. Review compliance is therefore statable today and
-- unstatable for last month, on any book, forever. Of the five
-- governance signals it is the one with no history at all, and its trend
-- says so — correctly, and permanently, until this table exists.
--
-- ── Why a table and not two columns ────────────────────────────────
--
-- The cheap fix is `last_reviewed_on` / `last_reviewed_by` beside the
-- next-due date. It answers "when was this last looked at", which is a
-- real question, and it is one row cheaper.
--
-- It does not answer the question the metric asks. REQ-28's compliance
-- signal has to be REPLAYABLE — "were we compliant last month" — and to
-- replay a point in time you need, for every item, what its next-due
-- date WAS at that moment. Two columns hold only the last review, so the
-- month before it is as unreadable as it is today; the second review
-- destroys the evidence of the first exactly as the moving date destroys
-- the evidence of any. A register that can state its compliance today
-- and not last month has not been fixed, it has been given one more day
-- of memory.
--
-- So: one row per review. It happened, on a day, by somebody, and it
-- said when the next one is due.
--
-- ── The next-due date is DERIVED, not replaced ─────────────────────
--
-- `raid_item.review_on` stays exactly where it is and keeps its meaning
-- — the engine reads it, the agenda reads it, the compliance signal
-- reads it — but it is no longer the only record. It becomes the
-- PROJECTION of the latest review's `next_review_on`: recording a review
-- writes the event and mirrors its next-due onto the item; withdrawing
-- or correcting a review re-derives the column from the events that
-- survive. Setting `review_on` directly stays what it always was, and is
-- a different act: SCHEDULING the first review is planning, and does not
-- claim anybody looked at anything.
--
-- ── What a review carries, and what it does not ────────────────────
--
-- A date, a reviewer, what was said, and when the next one is due. No
-- verdict enum: nobody has agreed what the outcomes of a RAID review are
-- called in this group, and a vocabulary invented in this file would be
-- the same fabrication as a threshold invented in govsignals.js. The
-- note is free text because the sentence is the finding.
--
-- `reviewed_by` names a PERSON of the directory, like `closed_by` (045)
-- and `accepted_by` (032): what stays on the register is the name, and
-- the audit trail already carries the account that pushed the button.
--
-- NOTHING IS BACK-DATED. No review is invented for the items whose
-- review dates have already been moved forward — those movements
-- happened on days nobody recorded, and an empty history says so. The
-- register starts remembering from here.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE raid_review (
  id              text PRIMARY KEY,
  raid_id         text NOT NULL REFERENCES raid_item(id) ON DELETE CASCADE,
  -- The day the item was looked at. Defaults to today; a register that
  -- knows the real day may state it, as `closed_on` allows (045).
  reviewed_on     date NOT NULL DEFAULT CURRENT_DATE,
  -- Who looked. A person of the directory; NULL if that person has since
  -- left and their row was removed, never because nobody was named.
  reviewed_by     text REFERENCES person(id) ON DELETE SET NULL,
  -- What the review said. Free text: the sentence IS the finding.
  note            text NOT NULL DEFAULT '',
  -- What was DUE when this review happened — the item's review_on at
  -- that moment. Three things matter about it:
  --   · compliance is readable from the row itself (reviewed_on <=
  --     due_on), without replaying the whole register;
  --   · the replay can reach BACK past the first recorded review: the
  --     due date in force before it is the one this row answered;
  --   · withdrawing a review restores it, so an event recorded in error
  --     does not leave the item with no due date at all.
  -- NULL when nothing was due — an item nobody had scheduled.
  due_on          date,
  -- When the next review is due, as this review decided. NULL means this
  -- review set no next date — the item is not on a review rhythm any
  -- more, which is a statable answer and not the same as "unknown".
  next_review_on  date,
  -- The account that recorded it, and the moment the register learned.
  -- Not the same as `reviewed_by` and not the same as `reviewed_on`: a
  -- review performed on Friday and typed in on Monday is two facts.
  recorded_by     text REFERENCES app_user(id) ON DELETE SET NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

-- The replay reads by item and by date; the compliance signal reads the
-- whole register at each month end.
CREATE INDEX raid_review_item_idx ON raid_review(raid_id, reviewed_on);
CREATE INDEX raid_review_on_idx   ON raid_review(reviewed_on);

INSERT INTO id_counter (prefix, next_value) VALUES ('RVW', 0);

COMMENT ON TABLE raid_review IS
  'One row per review actually performed on a register item. The item''s review_on is the projection of the latest row''s next_review_on, not a substitute for it (REQ-46).';
COMMENT ON COLUMN raid_item.review_on IS
  'The date the NEXT review is due. Since 050 it is derived from the latest raid_review; setting it directly schedules a review, which is not the same act as performing one (REQ-46).';

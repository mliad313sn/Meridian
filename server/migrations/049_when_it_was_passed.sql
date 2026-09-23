-- ═══════════════════════════════════════════════════════════════════
-- 049 · WHEN IT WAS PASSED, AND WHEN IT WAS RATIFIED  (REQ-45 · REQ-47)
--
-- Two clocks the product asked for and never wrote down. Both were found
-- by our own measurement counsellor while building the five governance
-- signals (REQ-28), and both are filed against ourselves: they are the
-- reason two of those five cannot speak on a real book.
--
-- ── REQ-45 · a gate records when it was passed ──────────────────────
--
-- Measured on the shipped demonstration book: TWENTY-FOUR of twenty-four
-- gates are `done = true` with no date at all. `routes/portfolio.js`
-- writes `milestone.accepted_on` only when the milestone carries
-- ACCEPTANCE CRITERIA — which is right, because that column means what
-- the 032 says it means: the day a named person recorded that criteria
-- posed in advance were MET. A gate with no criteria has nothing to
-- accept, so nothing was written, so the product cannot say when
-- twenty-four gates it draws as passed were passed. Gate cycle time
-- reports "not measured" and is telling the truth.
--
-- The fix is not to widen `accepted_on`. Writing an acceptance date
-- where nobody accepted anything would erase the distinction 032 exists
-- to hold — a reader could no longer tell a named acceptance from a
-- ticked box — and that conflation is exactly the class of fabrication
-- this round of work exists to end. So a SECOND, weaker pair:
--
--   accepted_on / accepted_by   somebody checked criteria posed in
--                               advance and found them met (032, PM-04)
--   done_on / done_by           somebody marked this milestone done, on
--                               this day. Nothing more is claimed.
--
-- A gate WITH criteria gets both, on the same day: the acceptance is
-- also a marking. A gate WITHOUT criteria gets only the second, which is
-- all that happened. Un-ticking clears the pair, as it already clears
-- the acceptance: a milestone that is not done was not done on a day.
--
-- ── REQ-47 · a decision records when it was ratified ────────────────
--
-- The 039 gave a decision a `status` (Proposed → Ratified) and a
-- `ratified_by`, and no ratification DATE. So "how long does
-- ratification take in this programme" cannot be asked at all, and
-- decision latency has to report proposed-but-unratified decisions as a
-- note beside its number rather than as a second clock.
--
-- The CHECK is the half that keeps it honest in both directions: a
-- decision that is NOT ratified carries no ratification date. Un-doing a
-- ratification therefore has to clear the date, which is the same rule
-- 045 wrote for reopening a closed register line.
--
-- ── NOTHING IS BACK-DATED, IN EITHER ───────────────────────────────
--
-- Every column here is NULLABLE and no existing row is filled. The
-- twenty-four gates already ticked were ticked on a day nobody recorded,
-- and the decisions already ratified were ratified on a day nobody
-- recorded. NULL says exactly that. Writing the migration's own date, or
-- the milestone's due date, or the decision's date, would manufacture a
-- history nobody lived — and it would then be MEASURED, which is worse
-- than a gap: gate cycle time would report a number built from our
-- invention. This is the rule 045 followed for RAID closures, restated
-- because it is the whole point of the request.
-- ═══════════════════════════════════════════════════════════════════

-- ── REQ-45 · the day a milestone was marked done, and by whom ───────
ALTER TABLE milestone ADD COLUMN done_on date;
ALTER TABLE milestone ADD COLUMN done_by text
  REFERENCES person(id) ON DELETE SET NULL;

COMMENT ON COLUMN milestone.done_on IS
  'The day this milestone was marked done, whether or not it carried acceptance criteria. NULL on a row marked done before 049 — unknown, never back-dated (REQ-45).';
COMMENT ON COLUMN milestone.done_by IS
  'The person who marked it done. Weaker than accepted_by, which names whoever found acceptance criteria met (032) — a ticked box is not an acceptance (REQ-45).';

-- ── REQ-47 · the day a decision was ratified ───────────────────────
ALTER TABLE meeting_decision ADD COLUMN ratified_on date;

ALTER TABLE meeting_decision ADD CONSTRAINT decision_ratification_dated
  CHECK (status = 'Ratified' OR ratified_on IS NULL);

COMMENT ON COLUMN meeting_decision.ratified_on IS
  'The day the status became Ratified. NULL on a row ratified before 049 — unknown, never back-dated; and NULL on a Proposed decision, which the CHECK holds (REQ-47).';

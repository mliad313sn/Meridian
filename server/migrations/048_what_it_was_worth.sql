-- ═══════════════════════════════════════════════════════════════════
-- 048 · WHAT IT WAS WORTH — the value page, stored per reporting period
--       (REQ-30 · RT365's V-11)
--
-- « The portfolio view answers "is it on time and on budget"; nobody can
--   answer "is it worth it". »
--
-- The request asks for one printable page — spend against case, benefits
-- by status, overdue reviews, top risks by exposure, gates due,
-- exceptions open — and for "a snapshot stored per reporting period so a
-- claim made in March can be re-read in December".
--
-- ── This EXTENDS the period mechanism; it does not invent a second one
--
-- Migration 009 already gave this product the concept the request names:
-- `report_period` is the reporting period, closed once, append-only, and
-- corrected only by a new period that names the one it restates.
-- `report_snapshot` freezes what was reported PROJECT BY PROJECT.
--
-- A second period concept would be a second answer to "which March?",
-- and the first argument in the room would be about which of the two is
-- the record. So there is no new period here: both tables below hang off
-- `report_period(id)`, and a value page can only ever be stored against
-- a period the existing close created.
--
-- What could not be added to `report_snapshot` is the GRAIN. That table
-- is one row per project with fixed columns of earned value; five of the
-- six figures on this page are portfolio aggregates that do not have a
-- project (the top of the risk register, the gates due across the book,
-- the benefits by status), and the sixth carries a reason for its own
-- absence. Widening a per-project table with portfolio columns would
-- have made every project row carry a copy of the same total — and
-- `report_snapshot` is append-only at the database, so a shape chosen
-- wrongly cannot be walked back on rows already written.
--
-- ── The absence is stored, not a zero (REQ-33)
--
-- This product once reported ON TRACK 100 %, SPI 1.00, COST INDEX 1.00
-- for a book with no budget and wrote that manufactured green into
-- `report_snapshot`, where it became permanent history. This table is
-- built so the same mistake cannot be made here:
--
--   · `state` is NOT NULL and admits exactly two values — a figure is
--     `measured` or it is `N`, the engine's fourth state;
--   · a CHECK enforces the pair: `N` must carry a `why` and must NOT
--     carry a value; `measured` must carry a value. A period whose
--     inputs were absent therefore stores THE ABSENCE, with its reason,
--     and the database refuses a row that stores a zero instead;
--   · `note` carries the other half — the population a real zero was
--     counted over — so that "no benefit was measured in this period"
--     and "the measured benefit was nil" cannot be read as one another
--     in December.
--
-- ── Append-only, by the same rules as 009
--
-- Written once, at a person's request, with their name on it. A
-- correction is a NEW period that restates the old one and a new value
-- page stored against that — never an edit, because an edit is exactly
-- how a wrong number becomes an unquestioned one.
--
-- Money is exact whole units here, as everywhere else in this schema;
-- the reader divides by 1e6 (`toM`). `shared/valuepage.js` names, in
-- MONEY_FIELDS, every field the conversion applies to.
-- ═══════════════════════════════════════════════════════════════════

-- The header: one value page per reporting period, and who stood behind
-- it. Separate from `report_period` because the page is stored by an act
-- of its own — possibly by a different person, at a later hour — and
-- because the SCOPE it was computed over is a property of the reader who
-- stored it, not of the period.
CREATE TABLE report_value (
  period_id       text PRIMARY KEY REFERENCES report_period(id) ON DELETE CASCADE,
  -- the as-at the figures were read on. Equal to the period's own status
  -- date by construction: the route refuses to store a page for a period
  -- closed at a different as-at, because storing today's figures under
  -- March's period is precisely the lie this table exists to prevent.
  status_date     date NOT NULL,
  stored_at       timestamptz NOT NULL DEFAULT now(),
  stored_by       text REFERENCES app_user(id) ON DELETE SET NULL,
  stored_by_label text NOT NULL DEFAULT '',
  -- whose book this page was computed over. A group lead sees their
  -- programmes and an administrator sees everything; a page read in
  -- December has to say which of those it was.
  scope_label     text NOT NULL DEFAULT '',
  projects        integer NOT NULL DEFAULT 0,
  -- how many of the six figures could be measured at all, so a reader
  -- sees at once whether the book could answer the question
  measured        integer NOT NULL DEFAULT 0,
  not_measured    integer NOT NULL DEFAULT 0,
  note            text NOT NULL DEFAULT ''
);

-- One row per figure. Six today; a seventh figure is a new row, never a
-- new column, so adding one cannot change the shape of what was already
-- written down.
CREATE TABLE report_value_figure (
  period_id  text NOT NULL REFERENCES report_value(period_id) ON DELETE CASCADE,
  figure     text NOT NULL,
  seq        integer NOT NULL DEFAULT 0,
  -- the fourth state, spelled the way the engine spells it
  state      text NOT NULL CHECK (state IN ('measured', 'N')),
  -- the unit the value is in: money (exact whole units), count, exposure
  unit       text NOT NULL DEFAULT '',
  value      numeric,
  -- the population the value was counted over — the denominator that
  -- makes a zero readable as a zero
  n          integer,
  -- why there is no value. Never empty on an unmeasured figure.
  why        text NOT NULL DEFAULT '',
  -- what travels beside a value that IS measured
  note       text NOT NULL DEFAULT '',
  -- the breakdown as reported: the lines behind the total, the five
  -- risks at the top of the register, the gates inside the horizon
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (period_id, figure),

  -- The REQ-33 rule, enforced by the database rather than by a review.
  -- An unmeasured figure may not carry a number, and must say why; a
  -- measured one must carry its number.
  CONSTRAINT value_figure_absence_is_stated CHECK (
    (state = 'N'        AND value IS NULL     AND length(why) > 0) OR
    (state = 'measured' AND value IS NOT NULL)
  )
);

CREATE INDEX report_value_figure_idx ON report_value_figure(figure, period_id);

-- Append-only, by the same rules the reported history already carries
-- (009). Rewriting what a board was told has to fail at the database,
-- not at a code review.
CREATE RULE value_no_update        AS ON UPDATE TO report_value        DO INSTEAD NOTHING;
CREATE RULE value_no_delete        AS ON DELETE TO report_value        DO INSTEAD NOTHING;
CREATE RULE value_figure_no_update AS ON UPDATE TO report_value_figure DO INSTEAD NOTHING;
CREATE RULE value_figure_no_delete AS ON DELETE TO report_value_figure DO INSTEAD NOTHING;

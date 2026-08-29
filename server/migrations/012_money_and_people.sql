-- ═══════════════════════════════════════════════════════════════════
-- 012 · FINANCE DEPTH AND THE RESOURCE MODEL  (V-05 · V-09)
--
-- V-05 · The finance business partner's three questions were "capex or
--   opex", "in which currency", and "committed or spent", and the ledger
--   could answer none of them. A cost line was an amount and a period.
--   Commitments matter most: a purchase order raised is money gone as far
--   as the envelope is concerned, months before it is a cost line.
--
-- V-09 · A fly-in engineer on four weeks on, two off is not 1.0 FTE for
--   fifty-two weeks, and a contractor is not a headcount. The capacity
--   arithmetic itself is left alone — it is relied on and tested — so
--   availability is carried as data beside it rather than folded into it.
--
-- FX is stored as the rate to the reporting currency AT THE TIME OF
-- BOOKING, on the line. A ledger that revalues its own history every time
-- the rate moves cannot be reconciled to anything.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE cost_line ADD COLUMN kind text NOT NULL DEFAULT 'capex'
  CHECK (kind IN ('capex','opex'));
ALTER TABLE cost_line ADD COLUMN currency text NOT NULL DEFAULT 'USD';
-- units of the reporting currency per unit of `currency`, as booked
ALTER TABLE cost_line ADD COLUMN fx_rate numeric NOT NULL DEFAULT 1;
-- the amount as it was actually spent, before conversion
ALTER TABLE cost_line ADD COLUMN amount_local numeric;

-- A commitment is money promised to a supplier and not yet booked. It is
-- not append-only: a purchase order is amended and cancelled in the real
-- world, and pretending otherwise would push people back into a
-- spreadsheet.
CREATE TABLE commitment (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  reference    text NOT NULL DEFAULT '',
  supplier     text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  amount       numeric NOT NULL DEFAULT 0,
  currency     text NOT NULL DEFAULT 'USD',
  fx_rate      numeric NOT NULL DEFAULT 1,
  kind         text NOT NULL DEFAULT 'capex' CHECK (kind IN ('capex','opex')),
  raised_on    date NOT NULL DEFAULT CURRENT_DATE,
  expected_on  date,
  status       text NOT NULL DEFAULT 'Open'
                 CHECK (status IN ('Open','Part received','Received','Cancelled')),
  raised_by    text REFERENCES app_user(id) ON DELETE SET NULL,
  row_version  integer NOT NULL DEFAULT 1
);
CREATE INDEX commitment_project_idx ON commitment(project_id, status);

-- ── V-09 · how people actually work ────────────────────────────────
ALTER TABLE person ADD COLUMN employment text NOT NULL DEFAULT 'staff'
  CHECK (employment IN ('staff','contractor'));
-- "4/2", "14/14", "" for an ordinary office roster
ALTER TABLE person ADD COLUMN rotation text NOT NULL DEFAULT '';
-- what fraction of a year this person is actually available for project
-- work, after rotation, leave and the day job
ALTER TABLE person ADD COLUMN availability integer NOT NULL DEFAULT 100
  CHECK (availability BETWEEN 0 AND 100);
ALTER TABLE person ADD COLUMN supplier text NOT NULL DEFAULT '';

-- Capitalised effort is not the same money as expensed effort, and
-- finance needs the split at the allocation, not at the person.
ALTER TABLE allocation ADD COLUMN capitalised boolean NOT NULL DEFAULT true;

INSERT INTO id_counter (prefix, next_value) VALUES ('CMT', 0);

-- ═══════════════════════════════════════════════════════════════════
-- 006 · TWO-LEVEL GOVERNANCE — the connective tissue between site and
-- group that the 2026-08-28 governance committee found missing.
--
-- Each series of meetings was "an excellent meeting, run twice; not yet
-- a rhythm": escalation up, tasking down and decision visibility across
-- levels had no data to travel on. Two columns carry all of it — the
-- freeze/immutability machinery (R5.5, R5.8) is untouched.
-- ═══════════════════════════════════════════════════════════════════

-- A site (or programme) meeting REFERS a decision upward instead of
-- taking it: the act of escalation the site chair never had. NULL for
-- ordinary decisions taken in the room; set = "this is beyond us —
-- steering decides", and it headlines the broader series' next agenda
-- until a decision there answers it (answered_by below).
ALTER TABLE meeting_decision ADD COLUMN referred_to_scope text
  CHECK (referred_to_scope IN ('group','programme'));
ALTER TABLE meeting_decision ADD COLUMN answered_by text
  REFERENCES meeting_decision(id) ON DELETE SET NULL;
CREATE INDEX meeting_decision_referred_idx
  ON meeting_decision(referred_to_scope) WHERE referred_to_scope IS NOT NULL;

-- A site lead's legitimate voice on a group-governed project delivered
-- at their site (concern.raise): the RAID item records WHICH site raised
-- it, so steering reads "GRU raised this", not an anonymous row.
ALTER TABLE raid_item ADD COLUMN origin_site text
  REFERENCES site(id) ON DELETE SET NULL;

-- Adoption committee I4: an admin-provisioned account arrives with a
-- password its admin knows. First sign-in forces a change, so from day
-- two the audit trail attributes to a person only that person can be.
ALTER TABLE app_user ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

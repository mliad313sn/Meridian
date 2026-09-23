-- ═══════════════════════════════════════════════════════════════════
-- 055 · KODO'S REGISTERS BECOME CORRECTABLE  (docs/36 NEW-04)
--
-- 051 and 052 landed the requirement, evidence, finding, seat and
-- objection registers as DATA: the import wrote them, the engine read
-- them, and nothing else could touch them. NEW-04 gives each a session
-- route and a screen. A register that a person corrects needs the
-- concurrency assertion every other mutable row carries (CONTRIBUTING
-- rule 3); `requirement` had it from 051, the four others did not.
--
-- ── 1. row_version on the four that lacked it ─────────────────────
-- Every existing row is at version 1: the column has a default, and
-- nothing to migrate.
--
-- `seat_conflict` does NOT get one. It is an edge with no attribute
-- worth correcting in place — an incompatibility is declared or removed,
-- both halves at once, like `cross_dep`.
--
-- ── 2. who raised an objection ────────────────────────────────────
-- An objection is the objector's word. Rewording it, escalating it or
-- withdrawing it is theirs to do (or the programme office's), so the
-- row must say whose it is. A PERSON of the directory, like every other
-- governance name on the record (`accepted_by`, `closed_by`); the audit
-- row carries the account. Rows imported before this line have none,
-- and only group level can act on them — which is the safe direction.
--
-- ── 3. the segregation of duties, from both ends ──────────────────
-- 052's trigger fires when a seat is given to a person. It cannot see
-- the other way in: declaring two seats incompatible AFTER one person
-- already holds both. The same refusal, in the same words, now guards
-- the edge too, so the rule holds whichever order the facts arrive in.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE evidence           ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE finding            ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE seat               ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE decision_objection ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;

ALTER TABLE decision_objection ADD COLUMN IF NOT EXISTS raised_by text
  REFERENCES person(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION seat_conflict_edge_guard() RETURNS trigger AS $$
DECLARE a record; b record;
BEGIN
  SELECT name, person_id INTO a FROM seat WHERE id = NEW.seat_id;
  SELECT name, person_id INTO b FROM seat WHERE id = NEW.other_id;
  IF a.person_id IS NOT NULL AND a.person_id = b.person_id THEN
    RAISE EXCEPTION
      'Segregation of duties: this person already holds %, which cannot be combined with %',
      b.name, a.name;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seat_conflict_edge_trigger ON seat_conflict;
CREATE TRIGGER seat_conflict_edge_trigger
  BEFORE INSERT ON seat_conflict
  FOR EACH ROW EXECUTE FUNCTION seat_conflict_edge_guard();

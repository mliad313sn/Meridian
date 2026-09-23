-- ═══════════════════════════════════════════════════════════════════
-- 056 · EACH STEP OF A CHANGE CHAIN HAS ITS OWN SIGNATORY  (PR-04, D-36.11)
--
-- The acceptance committee (docs/32, PR-04) found that a change
-- request's approval chain showed four roles and let ONE person sign all
-- four: the roles were labels, not authorities, and the segregation of
-- duties only kept the raiser out. The Product Owner decided (D-36.11)
-- that every step needs a distinct signatory.
--
-- "Distinct" is about the PERSON behind the account (app_user.person_id)
-- — two accounts held by one person are one signatory — and, for an
-- account that represents nobody, about the account itself.
--
-- `change_step.decided_by` has recorded the signing ACCOUNT since 002
-- (FK app_user). It keeps that meaning: renaming it and reusing the name
-- for a person would silently change what every existing reader of the
-- column gets. The PERSON is added beside it, recorded at the moment of
-- signing, as change_request did for its raiser in 033.
--
-- No backfill. A step signed before this line keeps a NULL person: the
-- account's CURRENT person link is not proof of who held it on the day,
-- and the record does not invent who signed. The rule therefore compares
-- what was recorded — the account on every signed step, the person on
-- steps signed from now on — and a step with no recorded signer at all
-- (seeded or imported history) blocks nobody.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE change_step ADD COLUMN IF NOT EXISTS decided_by_person text
  REFERENCES person(id) ON DELETE SET NULL;

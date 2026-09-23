-- ═══════════════════════════════════════════════════════════════════
-- 058 · A GRANT TO REVIEW, NOT A ROLE  (docs/36 D-36.12 · #16 · DF-10 · MER-06)
--
-- A council member who is not a project manager is asked to approve the
-- evidence of a gate. The four roles (docs/04) had one answer, and it
-- was wrong both ways: `viewer` may approve nothing, `group` may also
-- re-baseline and approve changes. FitAdapt's workaround was the product
-- owner approving "on the member's behalf" — so the audit row named the
-- wrong person, which is the one thing an approval must not do.
--
-- D-36.12 puts the power on the GRANT, because a power that exists only
-- over one scope belongs to the row that names the scope:
--
-- ── 1. access_grant.power ─────────────────────────────────────────
--   'write'  what every grant has meant since 001 (the default, so every
--            existing row keeps its meaning without being touched);
--   'review' document.approve and the reads over the scope, and nothing
--            else. The level still decides the rest: shared/rbac.js.
--
-- ── 2. a review grant may name ONE project ────────────────────────
-- A review is asked of a named person on a named project as often as on
-- a whole programme. `scope_kind` gains 'project', and only a review
-- grant may use it: a write grant on a single project is not something
-- the access model (docs/04) knows, and D-36.12 does not add it.
-- A review grant names a programme or a project, never a site: a site
-- is where work is delivered, not what a reviewer is asked to look at.
--
-- ── 3. a document may name the seat expected to approve it ────────
-- So the gate says "waiting on seat A1" instead of "waiting". A seat
-- (052) rather than a person: the seat is what the council's rule names,
-- and its holder can change without the document being edited. Naming a
-- seat grants nothing — the approver still needs the authority.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE access_grant ADD COLUMN IF NOT EXISTS power text NOT NULL DEFAULT 'write';
ALTER TABLE access_grant ADD CONSTRAINT access_grant_power_known
  CHECK (power IN ('write','review'));

ALTER TABLE access_grant ADD COLUMN IF NOT EXISTS project_id text
  REFERENCES project(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS access_grant_project_idx ON access_grant(project_id);

-- scope_kind gains 'project'. The 001 CHECK is anonymous; PostgreSQL
-- names it access_grant_scope_kind_check.
ALTER TABLE access_grant DROP CONSTRAINT IF EXISTS access_grant_scope_kind_check;
ALTER TABLE access_grant ADD CONSTRAINT access_grant_scope_kind_check
  CHECK (scope_kind IN ('programme','site','project'));

ALTER TABLE access_grant DROP CONSTRAINT grant_target_exclusive;
ALTER TABLE access_grant ADD CONSTRAINT grant_target_exclusive CHECK (
  (scope_kind = 'programme' AND programme_id IS NOT NULL AND site_id IS NULL AND project_id IS NULL) OR
  (scope_kind = 'site'      AND site_id      IS NOT NULL AND programme_id IS NULL AND project_id IS NULL) OR
  (scope_kind = 'project'   AND project_id   IS NOT NULL AND programme_id IS NULL AND site_id IS NULL)
);

-- A review grant names a programme or a project; a project grant is
-- always a review grant.
ALTER TABLE access_grant ADD CONSTRAINT grant_review_scope CHECK (
  (power = 'review' AND scope_kind IN ('programme','project')) OR
  (power = 'write'  AND scope_kind IN ('programme','site'))
);

-- One grant per scope, whatever its power: the power is what the grant
-- carries, not a second grant beside it.
DROP INDEX IF EXISTS access_grant_uniq;
CREATE UNIQUE INDEX access_grant_uniq
  ON access_grant (user_id, scope_kind, COALESCE(programme_id, site_id, project_id));

ALTER TABLE document ADD COLUMN IF NOT EXISTS expected_seat_id text
  REFERENCES seat(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 057 · ONE TYPED EXTERNAL REFERENCE  (D-36.14 · FitAdapt #17 · RT365
--       REQ-29 · KODO MER-11)
--
-- Three field programmes asked for the same thing in three words.
-- FitAdapt wants to see which pull request a stage is waiting on;
-- RT365 wants a gate criterion to cite the commit or checksum it was
-- found met on, and to keep that citation once the gate has passed;
-- KODO's evidence is "not a document". The third is already answered —
-- `evidence` (052) holds the proof. What was missing is the LINK that
-- says where the work is, and `ext_link` (005) already is Meridian's
-- link to a record another system keeps. So it gains repository
-- sources, not a second table (docs/36 D-36.14).
--
-- ── What a repository reference is ──────────────────────────────────
--
--   source      issue · pull_request · commit · ci_run · artefact
--   ext_id      the canonical ref: owner/repo#123 for an issue or a pull
--               request, owner/repo@<sha> for a commit, owner/repo/runs/<id>
--               for a CI run, sha256:<hex> for an artefact. Canonicalised
--               by the server (server/src/references.js), one spelling per
--               thing, so two people citing the same pull request cite the
--               same row key.
--   url         where a person can go and look. Stored, never fetched.
--   state       open · merged · closed · passed · failed, as last REPORTED,
--   state_at    when it was reported to be so,
--   state_source by which named integration (025). Meridian itself makes no
--               outbound call (NOTICE): the state is pushed in through
--               /api/v1, by the repository's own automation. Nothing here
--               is "verified", and no screen says it is.
--
-- It is attached to a project (mandatory, as since 005) and at most one
-- of: a stage (activity_id, since 005), a RAID row, a gate criterion.
--
-- ── REQ-29 · a citation is a record once the gate relies on it ──────
--
-- A criterion's cited reference is frozen once the criterion is found
-- met or its gate milestone is marked done. Changing it after that is a
-- NEW row that `supersedes` the old one; the old row is stamped
-- `superseded_at` and kept, readable, with who cited it and when. It is
-- never edited in place and never deleted — the gate record keeps saying
-- what was cited, and by whom. The rule is the server's; this schema
-- holds its shape: one live citation per (kind, ref, target), any number
-- of superseded ones.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE ext_link DROP CONSTRAINT ext_link_source_check;
ALTER TABLE ext_link ADD CONSTRAINT ext_link_source_check
  CHECK (source IN ('meetings','inspection','report','change',
                    'issue','pull_request','commit','ci_run','artefact'));

ALTER TABLE ext_link ADD COLUMN url           text NOT NULL DEFAULT '';
ALTER TABLE ext_link ADD COLUMN state         text NOT NULL DEFAULT ''
  CHECK (state IN ('','open','merged','closed','passed','failed'));
ALTER TABLE ext_link ADD COLUMN state_at      timestamptz;
ALTER TABLE ext_link ADD COLUMN state_source  text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE ext_link ADD COLUMN raid_id       text REFERENCES raid_item(id) ON DELETE CASCADE;
ALTER TABLE ext_link ADD COLUMN criterion_id  text REFERENCES gate_criterion(id) ON DELETE CASCADE;
ALTER TABLE ext_link ADD COLUMN supersedes    text REFERENCES ext_link(id) ON DELETE SET NULL;
ALTER TABLE ext_link ADD COLUMN superseded_at timestamptz;
-- The contract identity (035's rule): (integration, its own id).
ALTER TABLE ext_link ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE ext_link ADD COLUMN external_id     text;

-- One attachment below the project, at most.
ALTER TABLE ext_link ADD CONSTRAINT ext_link_one_target
  CHECK (num_nonnulls(activity_id, raid_id, criterion_id) <= 1);
-- An SDP item stays what 005 made it: a project- or stage-level card.
ALTER TABLE ext_link ADD CONSTRAINT ext_link_sdp_shape
  CHECK (source IN ('issue','pull_request','commit','ci_run','artefact')
         OR (raid_id IS NULL AND criterion_id IS NULL AND supersedes IS NULL
             AND superseded_at IS NULL AND state = ''));

-- 005's "one link per item per project" is SDP's rule and stays SDP's.
-- A pull request may be cited by a stage AND by a criterion of the same
-- project, so a repository reference is unique per TARGET, among the
-- live ones only (a superseded citation is history, not a duplicate).
ALTER TABLE ext_link DROP CONSTRAINT ext_link_source_ext_id_project_id_key;
CREATE UNIQUE INDEX ext_link_sdp_key ON ext_link (source, ext_id, project_id)
  WHERE source IN ('meetings','inspection','report','change');
CREATE UNIQUE INDEX ext_link_repo_live_key ON ext_link
  (source, ext_id, project_id, COALESCE(activity_id, ''), COALESCE(raid_id, ''), COALESCE(criterion_id, ''))
  WHERE superseded_at IS NULL AND source IN ('issue','pull_request','commit','ci_run','artefact');
CREATE UNIQUE INDEX ext_link_external_idx ON ext_link (external_source, external_id)
  WHERE external_id IS NOT NULL AND superseded_at IS NULL;
CREATE INDEX ext_link_raid_idx      ON ext_link (raid_id);
CREATE INDEX ext_link_criterion_idx ON ext_link (criterion_id);

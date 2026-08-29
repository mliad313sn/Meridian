-- ═══════════════════════════════════════════════════════════════════
-- 010 · PLANT DISCIPLINE, SITE REALITY, ROLLOUT WAVES
--       (Endeavour committee, V-03 · V-07 · V-06)
--
-- Three findings, one domain: what is actually true at a site.
--
-- V-03 · The head of Operational Technology's question was "what stops
--   someone touching a plant system outside a shutdown window?" and the
--   answer was nothing. A project could plan a cutover into production
--   hours and the tool would not object. Plant systems stop for money and
--   they stop for safety, so a change window is the constraint, not an
--   inconvenience — and a change to a safety-related system needs a
--   second signature that is not the delivery team's.
--
-- V-07 · Sites carried a clock and a headcount. Not a link, not a
--   maintenance calendar, not readiness. The Locations view was a world
--   clock rather than an operational picture.
--
-- V-06 · The dominant project shape here is "the same thing, at five
--   sites, in waves", and there was no wave: one project, one status, no
--   way to say Houndé is live and Ity is not.
-- ═══════════════════════════════════════════════════════════════════

-- ── V-07 · what a site actually is ─────────────────────────────────
ALTER TABLE site ADD COLUMN link_mbps      numeric;
ALTER TABLE site ADD COLUMN link_kind      text NOT NULL DEFAULT '';
ALTER TABLE site ADD COLUMN readiness      text NOT NULL DEFAULT 'Unknown'
  CHECK (readiness IN ('Unknown','Not ready','Preparing','Ready'));
ALTER TABLE site ADD COLUMN readiness_note text NOT NULL DEFAULT '';

-- ── V-03 · the calendar the plant actually runs to ─────────────────
-- A window is a period when the site is either OPEN for intrusive work
-- (a shutdown) or CLOSED to it (a freeze). Both are facts the site owns
-- and the group has to plan around.
CREATE TABLE site_window (
  id          text PRIMARY KEY,
  site_id     text NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('shutdown','freeze')),
  label       text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  raised_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  row_version integer NOT NULL DEFAULT 1,
  CHECK (ends_on >= starts_on)
);
CREATE INDEX site_window_site_idx ON site_window(site_id, starts_on);

-- What a project can do to the plant, and the independent signature that
-- releases it. `none` is the default so nothing existing is retro-flagged
-- as plant work; the classification is a deliberate act.
ALTER TABLE project ADD COLUMN plant_impact text NOT NULL DEFAULT 'none'
  CHECK (plant_impact IN ('none','plant','safety'));
ALTER TABLE project ADD COLUMN moc_ref         text NOT NULL DEFAULT '';
ALTER TABLE project ADD COLUMN moc_approved_by text REFERENCES app_user(id) ON DELETE SET NULL;
ALTER TABLE project ADD COLUMN moc_approved_label text NOT NULL DEFAULT '';
ALTER TABLE project ADD COLUMN moc_approved_on date;

-- A milestone that touches the plant is the thing a freeze is about. The
-- gate/milestone kinds are unchanged; this names the intrusive ones.
ALTER TABLE milestone ADD COLUMN intrusive boolean NOT NULL DEFAULT false;

-- ── V-06 · the same thing, at five sites ───────────────────────────
CREATE TABLE rollout_wave (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  site_id     text NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  seq         integer NOT NULL DEFAULT 1,
  planned_on  date,
  actual_on   date,
  status      text NOT NULL DEFAULT 'Planned'
                CHECK (status IN ('Planned','In progress','Live','Held','Cancelled')),
  note        text NOT NULL DEFAULT '',
  row_version integer NOT NULL DEFAULT 1,
  UNIQUE (project_id, site_id)
);
CREATE INDEX rollout_wave_project_idx ON rollout_wave(project_id, seq);

INSERT INTO id_counter (prefix, next_value) VALUES ('SW', 0), ('WAVE', 0);

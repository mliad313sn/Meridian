-- ═══════════════════════════════════════════════════════════════════
-- 060 · A SITE HAS A KIND — `place` OR `team`  (docs/36 D-36.13, #18)
--
-- FitAdapt modelled one fake site, "Distributed team", with a UTC
-- timezone that meant nothing: a squad is governed like a site (it holds
-- delegated authority, it has its own weekly) and it is located nowhere.
-- One site per squad would have made the Locations view, the plant
-- windows, the rollout waves and every timezone computation describe
-- places that do not exist.
--
-- So a site says what it is:
--
--   place  (default) a location. Everything that existed before this
--          migration is a place, and nothing about a place changes: it
--          still carries a timezone, the database now says so by a CHECK
--          rather than only by a default.
--   team   a delivery unit with no geography. Its timezone is optional
--          (NULL means "none", never "UTC"). It is left out of the
--          Locations view, and a plant window or a rollout wave cannot
--          target it — refused here, at the last line, as well as by the
--          routes, so the import and any future write path cannot plant
--          a freeze on a squad.
--
-- A team remains the unit of delegated authority: access grants,
-- site-governed projects, meetings scoped to it, absences — unchanged.
-- docs/04's group/site thesis is untouched.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE site ADD COLUMN kind text NOT NULL DEFAULT 'place';
ALTER TABLE site ADD CONSTRAINT site_kind_known CHECK (kind IN ('place', 'team'));

-- The timezone becomes optional for a team only. The defaults stay (0,
-- 'UTC') so an INSERT that names no timezone still builds a place the way
-- it always did; a team is written with explicit NULLs by the routes.
ALTER TABLE site ALTER COLUMN tz_offset DROP NOT NULL;
ALTER TABLE site ALTER COLUMN tz_name   DROP NOT NULL;
ALTER TABLE site ADD CONSTRAINT site_place_has_timezone
  CHECK (kind = 'team' OR (tz_offset IS NOT NULL AND tz_name IS NOT NULL));

COMMENT ON COLUMN site.kind IS
  'D-36.13 — place (a location, the default) or team (a delivery unit with no geography: optional timezone, no plant window, no rollout wave, not on the Locations view). Both carry delegated authority alike.';
COMMENT ON COLUMN site.tz_offset IS
  'Décalage horaire du site par rapport à UTC. Sert aux fenêtres d''usine et, depuis 019, au silence de nuit. NULL pour une équipe sans fuseau (060) : qui calcule une heure retombe alors sur le défaut du groupe, UTC.';

-- ── a window or a wave lands at a place ───────────────────────────
CREATE OR REPLACE FUNCTION site_must_be_place() RETURNS trigger AS $$
DECLARE k text; c text;
BEGIN
  SELECT kind, city INTO k, c FROM site WHERE id = NEW.site_id;
  IF k = 'team' THEN
    RAISE EXCEPTION
      'A team is not a place: % has no plant calendar and no rollout wave can land at it', c;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_window_place_trigger ON site_window;
CREATE TRIGGER site_window_place_trigger
  BEFORE INSERT OR UPDATE OF site_id ON site_window
  FOR EACH ROW EXECUTE FUNCTION site_must_be_place();

DROP TRIGGER IF EXISTS rollout_wave_place_trigger ON rollout_wave;
CREATE TRIGGER rollout_wave_place_trigger
  BEFORE INSERT OR UPDATE OF site_id ON rollout_wave
  FOR EACH ROW EXECUTE FUNCTION site_must_be_place();

-- And from the other end: a place that already holds a window or a wave
-- cannot become a team, or the rule above would hold only for the order
-- in which the facts happened to arrive.
CREATE OR REPLACE FUNCTION site_kind_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'team' AND OLD.kind IS DISTINCT FROM 'team' AND (
       EXISTS (SELECT 1 FROM site_window  WHERE site_id = NEW.id)
    OR EXISTS (SELECT 1 FROM rollout_wave WHERE site_id = NEW.id)) THEN
    RAISE EXCEPTION
      'A team is not a place: % still holds a plant window or a rollout wave — withdraw them before making it a team', NEW.city;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_kind_trigger ON site;
CREATE TRIGGER site_kind_trigger
  BEFORE UPDATE OF kind ON site
  FOR EACH ROW EXECUTE FUNCTION site_kind_guard();

-- ── the reporting view says the kind ──────────────────────────────
-- A BI reader who meets a NULL tz_name must be able to tell why. Added
-- at the end, so every existing column keeps its position.
CREATE OR REPLACE VIEW reporting.sites AS
  SELECT id, city, region, country, legal_entity, tz_name, headcount, fte, active, kind
    FROM site;

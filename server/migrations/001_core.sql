-- ═══════════════════════════════════════════════════════════════════
-- 001 · CORE — organisation, identity, access grants, audit
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE site (
  id           text PRIMARY KEY,
  city         text NOT NULL,
  region       text NOT NULL,
  tz_offset    numeric(4,2) NOT NULL DEFAULT 0,
  tz_name      text NOT NULL DEFAULT 'UTC',
  headcount    integer NOT NULL DEFAULT 0,
  fte          integer NOT NULL DEFAULT 0,
  charter      text NOT NULL DEFAULT '',
  active       boolean NOT NULL DEFAULT true
);

CREATE TABLE programme (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  sponsor      text NOT NULL DEFAULT '',
  manager_id   text,
  active       boolean NOT NULL DEFAULT true
);

CREATE TABLE person (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  job_role     text NOT NULL DEFAULT '',
  site_id      text NOT NULL REFERENCES site(id) ON DELETE RESTRICT,
  day_rate     numeric(12,2) NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true
);
CREATE INDEX person_site_idx ON person(site_id);

ALTER TABLE programme
  ADD CONSTRAINT programme_manager_fk
  FOREIGN KEY (manager_id) REFERENCES person(id) ON DELETE SET NULL;

-- ── identity ───────────────────────────────────────────────────────
-- R1.7: scrypt hash + per-user salt. The hash is never selected into
-- any response object; see server/src/auth.js publicUser().
CREATE TABLE app_user (
  id            text PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  person_id     text REFERENCES person(id) ON DELETE SET NULL,
  role          text NOT NULL CHECK (role IN ('admin','group','site','viewer')),
  pw_hash       text NOT NULL,
  pw_salt       text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  row_version   integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX app_user_email_lower_idx ON app_user (lower(email));

-- R1.3: a grant names ONE programme or ONE site. No implicit "all".
-- admin needs no grants; group/site users need at least one to see anything.
CREATE TABLE access_grant (
  id           bigserial PRIMARY KEY,
  user_id      text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  scope_kind   text NOT NULL CHECK (scope_kind IN ('programme','site')),
  programme_id text REFERENCES programme(id) ON DELETE CASCADE,
  site_id      text REFERENCES site(id) ON DELETE CASCADE,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  granted_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  CONSTRAINT grant_target_exclusive CHECK (
    (scope_kind = 'programme' AND programme_id IS NOT NULL AND site_id IS NULL) OR
    (scope_kind = 'site'      AND site_id      IS NOT NULL AND programme_id IS NULL)
  )
);
CREATE UNIQUE INDEX access_grant_uniq
  ON access_grant (user_id, scope_kind, COALESCE(programme_id, site_id));

CREATE TABLE session (
  token       text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text NOT NULL DEFAULT ''
);
CREATE INDEX session_user_idx ON session(user_id);
CREATE INDEX session_expiry_idx ON session(expires_at);

-- ── audit (R6.1, R6.2) ─────────────────────────────────────────────
-- Append-only. The rules below make UPDATE and DELETE fail at the
-- database, not at the application, so an application bug cannot
-- rewrite history.
CREATE TABLE audit_event (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     text REFERENCES app_user(id) ON DELETE SET NULL,
  user_label  text NOT NULL DEFAULT '',
  action      text NOT NULL,
  entity      text NOT NULL DEFAULT '',
  entity_id   text NOT NULL DEFAULT '',
  detail      text NOT NULL DEFAULT '',
  before_json jsonb,
  after_json  jsonb
);
CREATE INDEX audit_at_idx     ON audit_event(at DESC);
CREATE INDEX audit_user_idx   ON audit_event(user_id, at DESC);
CREATE INDEX audit_entity_idx ON audit_event(entity, entity_id, at DESC);

CREATE RULE audit_no_update AS ON UPDATE TO audit_event DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_event DO INSTEAD NOTHING;

-- ── settings ───────────────────────────────────────────────────────
CREATE TABLE app_setting (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

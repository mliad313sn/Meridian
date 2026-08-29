-- ═══════════════════════════════════════════════════════════════════
-- 005 · EXTERNAL FEDERATION — SDP links and provenance (Part B)
--
-- Two systems, one portfolio truth. SDP (the IT-operations dashboard)
-- remains the system of record for operational items — meeting actions,
-- inspection findings, report follow-ups, ITSM change requests — and for
-- the ops-strategy roadmap. Meridian never copies those as first-class
-- rows (committee ADR-5): it links them, with a whitelisted, PII-free
-- display cache that survives SDP being unreachable and is refreshed by
-- sync, never edited by hand.
-- ═══════════════════════════════════════════════════════════════════

-- ── external links ─────────────────────────────────────────────────
-- One table serves both actions (contract C2) and changes (C4), keyed by
-- SDP's stable id "<source>:<action_id|uid>" / "change:<change_id>".
-- The project is the unit of governance, so it is mandatory; an activity
-- is an optional refinement (pin a change into a schedule bar). The
-- app-level write asserts activity.project_id = ext_link.project_id —
-- deliberately no composite-FK contortion.
CREATE TABLE ext_link (
  id            text PRIMARY KEY,                       -- allocateId(t,'XL')
  source        text NOT NULL CHECK (source IN ('meetings','inspection','report','change')),
  ext_id        text NOT NULL,                          -- full stable id, e.g. 'change:100234'
  project_id    text NOT NULL REFERENCES project(id)  ON DELETE CASCADE,
  activity_id   text REFERENCES activity(id)          ON DELETE SET NULL,
  site_id       text REFERENCES site(id)              ON DELETE SET NULL,
  -- whitelisted, PII-free display cache. Refreshed from C2/C4 pulls;
  -- requester / manager / technician names never cross the wire (ADR-6).
  title_cache   text NOT NULL DEFAULT '',
  status_cache  text NOT NULL DEFAULT '',               -- status / stage / outcome bucket
  kind_cache    text NOT NULL DEFAULT '',               -- change_type or action origin label
  risk_cache    text NOT NULL DEFAULT '',
  due_cache     date,                                   -- due_date / scheduled_end
  window_start  date,                                   -- changes only: scheduled_start
  linked_by     text REFERENCES app_user(id) ON DELETE SET NULL,
  linked_at     timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz,                            -- last cache refresh
  stale         boolean NOT NULL DEFAULT false,         -- feed no longer returns ext_id
  row_version   integer NOT NULL DEFAULT 1,
  UNIQUE (source, ext_id, project_id)                   -- one link per item per project
);
CREATE INDEX ext_link_project_idx ON ext_link(project_id);
CREATE INDEX ext_link_site_idx    ON ext_link(site_id);
CREATE INDEX ext_link_ext_idx     ON ext_link(source, ext_id);
CREATE INDEX ext_link_activity_idx ON ext_link(activity_id);

INSERT INTO id_counter (prefix, next_value) VALUES ('XL', 0);

-- The SVC-SDP service account row (audit FK target) is NOT inserted
-- here: a pre-seed app_user row breaks the seed's wipe — deleting any
-- app_user fires audit_event's ON DELETE SET NULL, which the append-only
-- rules rewrite away and PostgreSQL refuses. The account is ensured
-- lazily by the /v1 guard (server/src/federation.js) and by the seed.

-- ── provenance (ADR-8) ─────────────────────────────────────────────
-- Rows born from the SDP sync carry origin='sdp'; routes refuse local
-- mutation of their synced fields, so two authorships of the same number
-- cannot exist. The 'SDP-' id namespace is reserved for derived ids —
-- allocateId prefixes can never emit it, so derived and allocated ids
-- cannot collide.
ALTER TABLE programme ADD COLUMN origin text NOT NULL DEFAULT 'local'
  CHECK (origin IN ('local','sdp'));
ALTER TABLE project   ADD COLUMN origin text NOT NULL DEFAULT 'local'
  CHECK (origin IN ('local','sdp'));
ALTER TABLE activity  ADD COLUMN origin text NOT NULL DEFAULT 'local'
  CHECK (origin IN ('local','sdp'));
ALTER TABLE milestone ADD COLUMN origin text NOT NULL DEFAULT 'local'
  CHECK (origin IN ('local','sdp'));

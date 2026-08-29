-- ═══════════════════════════════════════════════════════════════════
-- 003 · MEETINGS — the module that never existed (D-04, R5.*)
--
-- Shape of the thing: a SERIES has a cadence and a scope. Each run of
-- it is an OCCURRENCE. An occurrence's agenda is GENERATED from live
-- portfolio state while the occurrence is open (R5.2), then FROZEN into
-- agenda_item rows when it is closed (R5.8) so that later portfolio
-- movement cannot rewrite what the meeting actually discussed.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE meeting_series (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  cadence       text NOT NULL CHECK (cadence IN ('weekly','monthly')),
  -- R5.1: scope decides both the agenda content and who may run it.
  scope_kind    text NOT NULL CHECK (scope_kind IN ('group','programme','site')),
  programme_id  text REFERENCES programme(id) ON DELETE CASCADE,
  site_id       text REFERENCES site(id)      ON DELETE CASCADE,
  chair_id      text REFERENCES person(id)    ON DELETE SET NULL,
  weekday       integer NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  start_time    text NOT NULL DEFAULT '09:00',
  timebox_min   integer NOT NULL DEFAULT 30,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  row_version   integer NOT NULL DEFAULT 1,
  CONSTRAINT series_scope_exclusive CHECK (
    (scope_kind = 'group'     AND programme_id IS NULL AND site_id IS NULL) OR
    (scope_kind = 'programme' AND programme_id IS NOT NULL AND site_id IS NULL) OR
    (scope_kind = 'site'      AND site_id IS NOT NULL AND programme_id IS NULL)
  )
);

CREATE TABLE meeting_occurrence (
  id           text PRIMARY KEY,
  series_id    text NOT NULL REFERENCES meeting_series(id) ON DELETE CASCADE,
  meets_on     date NOT NULL,
  period_label text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled','open','closed')),
  opened_at    timestamptz,
  opened_by    text REFERENCES app_user(id) ON DELETE SET NULL,
  closed_at    timestamptz,
  closed_by    text REFERENCES app_user(id) ON DELETE SET NULL,
  notes        text NOT NULL DEFAULT '',
  row_version  integer NOT NULL DEFAULT 1,
  UNIQUE (series_id, meets_on)
);
CREATE INDEX occurrence_series_idx ON meeting_occurrence(series_id, meets_on DESC);

-- Frozen agenda. Written when the occurrence is closed. While the
-- occurrence is open the agenda is computed live and never stored.
CREATE TABLE agenda_item (
  id           bigserial PRIMARY KEY,
  occurrence_id text NOT NULL REFERENCES meeting_occurrence(id) ON DELETE CASCADE,
  seq          integer NOT NULL,
  section      text NOT NULL,
  headline     text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  entity       text NOT NULL DEFAULT '',
  entity_id    text NOT NULL DEFAULT '',
  timebox_min  integer NOT NULL DEFAULT 0,
  UNIQUE (occurrence_id, seq)
);

CREATE TABLE meeting_attendance (
  occurrence_id text NOT NULL REFERENCES meeting_occurrence(id) ON DELETE CASCADE,
  person_id     text NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  state         text NOT NULL DEFAULT 'present'
                CHECK (state IN ('present','apologies','absent','deputy')),
  deputy_for    text REFERENCES person(id) ON DELETE SET NULL,
  PRIMARY KEY (occurrence_id, person_id)
);

-- R5.5: immutable once the parent occurrence closes. Enforced in
-- server/src/routes/meetings.js, which refuses to write against a
-- closed occurrence, and by the audit trail on every insert.
CREATE TABLE meeting_decision (
  id            text PRIMARY KEY,
  occurrence_id text NOT NULL REFERENCES meeting_occurrence(id) ON DELETE CASCADE,
  headline      text NOT NULL,
  rationale     text NOT NULL DEFAULT '',
  project_id    text REFERENCES project(id) ON DELETE SET NULL,
  cr_id         text REFERENCES change_request(id) ON DELETE SET NULL,
  decided_by    text REFERENCES person(id) ON DELETE SET NULL,
  recorded_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_occurrence_idx ON meeting_decision(occurrence_id);
CREATE INDEX decision_project_idx    ON meeting_decision(project_id);

-- R5.6: actions outlive their occurrence and chase the owner forward
-- onto every subsequent agenda until closed.
CREATE TABLE meeting_action (
  id             text PRIMARY KEY,
  series_id      text NOT NULL REFERENCES meeting_series(id) ON DELETE CASCADE,
  raised_in      text NOT NULL REFERENCES meeting_occurrence(id) ON DELETE CASCADE,
  closed_in      text REFERENCES meeting_occurrence(id) ON DELETE SET NULL,
  title          text NOT NULL,
  detail         text NOT NULL DEFAULT '',
  owner_id       text REFERENCES person(id) ON DELETE SET NULL,
  project_id     text REFERENCES project(id) ON DELETE SET NULL,
  due_date       date,
  status         text NOT NULL DEFAULT 'Open'
                 CHECK (status IN ('Open','In progress','Done','Cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  row_version    integer NOT NULL DEFAULT 1
);
CREATE INDEX action_series_open_idx ON meeting_action(series_id, status);
CREATE INDEX action_owner_idx       ON meeting_action(owner_id, status);

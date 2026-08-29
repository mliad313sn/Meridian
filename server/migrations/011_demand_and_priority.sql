-- ═══════════════════════════════════════════════════════════════════
-- 011 · DEMAND INTAKE AND PRIORITISATION  (V-13 · V-04)
--
-- V-13 · Projects appeared in the book fully formed, so the work in the
--   tool was the work somebody had already decided to do. There was no
--   funnel: no idea, no triage, no approval to plan. The decision that
--   matters most — what we are NOT going to do — happened elsewhere and
--   left no trace here.
--
-- V-04 · And nothing ranked. No scoring, no funding envelope against
--   demand, no way to say "these eleven fit the money and these four do
--   not". The annual capital round ran outside the tool, which meant the
--   tool did not govern the decision it exists for.
--
-- Scores are 1–5 and deliberately few. A model nobody can hold in their
-- head at a prioritisation meeting is a model that gets overridden in the
-- room and then quietly ignored.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE demand (
  id           text PRIMARY KEY,
  title        text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  sponsor      text NOT NULL DEFAULT '',
  programme_id text REFERENCES programme(id) ON DELETE SET NULL,
  site_id      text REFERENCES site(id) ON DELETE SET NULL,
  -- what it is FOR, in the sponsor's words, before anyone plans anything
  benefit_note text NOT NULL DEFAULT '',
  est_cost     numeric,
  raised_by    text REFERENCES app_user(id) ON DELETE SET NULL,
  raised_label text NOT NULL DEFAULT '',
  raised_on    date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'New'
                 CHECK (status IN ('New','Triaged','Approved','Declined','Converted')),
  -- a decline is a decision, and it carries its reason like every other
  decided_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  decided_label text NOT NULL DEFAULT '',
  decided_on   date,
  decision_note text NOT NULL DEFAULT '',
  -- set when an approved demand becomes a project; the trail survives
  project_id   text REFERENCES project(id) ON DELETE SET NULL,
  row_version  integer NOT NULL DEFAULT 1
);
CREATE INDEX demand_status_idx ON demand(status, raised_on DESC);

-- ── V-04 · the few numbers a room can actually argue about ─────────
ALTER TABLE project ADD COLUMN fit_score    integer CHECK (fit_score    BETWEEN 1 AND 5);
ALTER TABLE project ADD COLUMN value_score  integer CHECK (value_score  BETWEEN 1 AND 5);
ALTER TABLE project ADD COLUMN risk_score   integer CHECK (risk_score   BETWEEN 1 AND 5);
ALTER TABLE project ADD COLUMN effort_score integer CHECK (effort_score BETWEEN 1 AND 5);
-- an explicit hand-placed order, for when the room overrules the model
ALTER TABLE project ADD COLUMN rank_seq     integer;

ALTER TABLE demand ADD COLUMN fit_score    integer CHECK (fit_score    BETWEEN 1 AND 5);
ALTER TABLE demand ADD COLUMN value_score  integer CHECK (value_score  BETWEEN 1 AND 5);
ALTER TABLE demand ADD COLUMN risk_score   integer CHECK (risk_score   BETWEEN 1 AND 5);
ALTER TABLE demand ADD COLUMN effort_score integer CHECK (effort_score BETWEEN 1 AND 5);

INSERT INTO id_counter (prefix, next_value) VALUES ('DEM', 0);

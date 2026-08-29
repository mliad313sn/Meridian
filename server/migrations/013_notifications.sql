-- ═══════════════════════════════════════════════════════════════════
-- 013 · NOTIFICATIONS  (V-12)
--
-- "Nothing tells anybody anything." The tool waited to be visited, and
-- the site lead who feeds it — francophone, on rotation, on a constrained
-- link — had the least reason to visit. An action falls due and the only
-- thing that notices is the next meeting.
--
-- The queue is a TABLE rather than a direct send, for three reasons that
-- all matter here: a site on a satellite link should not hold a request
-- open while SMTP times out; an instance with no mail server configured
-- must still show people what they would have been sent; and "what did we
-- tell them, and when" is itself a governance question.
--
-- Delivery is therefore a separate act from queueing, and a message that
-- was never sent stays visibly unsent.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE notification (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  -- who it is for: the account, plus the address as it stood then
  user_id     text REFERENCES app_user(id) ON DELETE SET NULL,
  email       text NOT NULL,
  kind        text NOT NULL
                CHECK (kind IN ('action-due','action-overdue','gate-blocked','decision-owed','digest','concern-raised')),
  subject     text NOT NULL,
  body        text NOT NULL,
  -- what it is about, so a reader can jump to it
  entity      text NOT NULL DEFAULT '',
  entity_id   text NOT NULL DEFAULT '',
  state       text NOT NULL DEFAULT 'queued'
                CHECK (state IN ('queued','sent','failed','suppressed')),
  sent_at     timestamptz,
  error       text NOT NULL DEFAULT '',
  -- the natural key that stops the same nag going out twice a day
  dedupe_key  text NOT NULL,
  UNIQUE (dedupe_key)
);
CREATE INDEX notification_state_idx ON notification(state, at DESC);
CREATE INDEX notification_user_idx  ON notification(user_id, at DESC);

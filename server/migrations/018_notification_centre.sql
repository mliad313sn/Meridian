-- ═══════════════════════════════════════════════════════════════════
-- 018 · LE CENTRE DE NOTIFICATION  (N-05, comité d'innovation)
--
-- Il existait une file d'envoi ; il n'existait pas de centre. Le
-- destinataire ne pouvait pas lire ce qui lui était adressé — la seule
-- route de lecture était montée sur l'administration — et l'état de la
-- ligne ne disait que la REMISE : en file, envoyé, échoué. Rien n'a
-- jamais dit qu'une personne avait vu quelque chose.
--
-- « Lu » n'est pas « envoyé ». C'est la raison d'être de cette migration.
--
-- Le reste répond au paragraphe que l'ergonome des systèmes d'alerte a
-- écrit en premier : un centre de notification échoue par excès, jamais
-- par défaut. D'où la gravité (portée par la ligne, calculée à
-- l'émission, jamais réglée à la main), le regroupement (un message par
-- objet et par jour plutôt qu'un par acte — la déduplication empêche la
-- répétition, le regroupement empêche la rafale), et l'échéance de
-- conservation, qui est ici parce que le comité a refusé de livrer un
-- centre sans le balai qui va avec (G-13).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE notification ADD COLUMN read_at      timestamptz;
ALTER TABLE notification ADD COLUMN acted_at     timestamptz;
ALTER TABLE notification ADD COLUMN severity     text NOT NULL DEFAULT 'info'
       CHECK (severity IN ('info', 'attention', 'urgent'));
ALTER TABLE notification ADD COLUMN group_key    text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN locale       text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN channel      text NOT NULL DEFAULT 'email'
       CHECK (channel IN ('email', 'outbound'));
-- Au retour d'absence, savoir ce qui a été adressé à son suppléant en son
-- nom — et ce qu'il en a fait. Pas une seconde boîte : une colonne.
ALTER TABLE notification ADD COLUMN on_behalf_of text REFERENCES person(id) ON DELETE SET NULL;
-- G-13 : la date au-delà de laquelle cette ligne n'a plus de raison
-- d'être conservée. Nulle tant que le mandant n'a pas écrit de durée —
-- et la purge REFUSE de s'exécuter sans elle, sur le patron de
-- documentHosts : un contrôle non configuré ne devine pas.
ALTER TABLE notification ADD COLUMN expires_on   date;

-- Le vocabulaire s'élargit : trois genres attendaient un émetteur depuis
-- 013, trois autres bouchent des trous constatés ailleurs.
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_kind_check;
ALTER TABLE notification ADD CONSTRAINT notification_kind_check CHECK (kind IN (
  'action-due', 'action-overdue', 'gate-blocked', 'decision-owed',
  'digest', 'concern-raised',
  'site-quiet',            -- aucun avancement consigné depuis 30 jours (A-08)
  'timesheet-missing',     -- une semaine sans réel saisi (R-03)
  'evidence-unreachable'   -- l'artefact approuvé ne répond plus (N-07)
));

-- La lecture du centre : ma boîte, non lue, la plus récente d'abord.
CREATE INDEX notification_unread_idx ON notification(user_id, read_at, at DESC);

COMMENT ON COLUMN notification.read_at IS
  'Quand le DESTINATAIRE a vu le message. Sans rapport avec state, qui est la remise.';
COMMENT ON COLUMN notification.expires_on IS
  'G-13 — échéance de conservation. Nulle = aucune durée décidée, la purge s''abstient.';

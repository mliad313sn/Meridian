-- ═══════════════════════════════════════════════════════════════════
-- 019 · L'ABONNEMENT, ET LE SILENCE  (N-05)
--
-- Un compte portait UNE cadence globale, et elle était ignorée à la
-- remise : « hebdomadaire » recevait comme « immédiat ». La cadence est
-- maintenant honorée (server/src/notify.js) ; cette table lui donne la
-- finesse que le terrain demande — un croisement de quatre choses :
-- l'événement, la portée, la gravité, le canal.
--
-- Deux règles de composition, écrites pour éviter la surprise :
--
--   · LE CENTRE N'EST PAS ABONNABLE. Tout ce qui m'est adressé y arrive,
--     toujours. Un abonnement règle ce qui SORT vers moi, jamais ce que
--     je peux venir chercher — quelqu'un qui se désabonne de tout doit
--     encore pouvoir constater ce qu'il a manqué.
--   · La préférence globale `notify_pref` est CONSERVÉE, comme valeur par
--     défaut d'un compte sans abonnement. Elle cesse d'être un mensonge
--     sans devenir une rupture.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE notification_subscription (
  id           text PRIMARY KEY,
  user_id      text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  -- '*' = tout genre ; sinon un genre de notification.kind
  kind         text NOT NULL DEFAULT '*',
  scope_kind   text NOT NULL DEFAULT 'portfolio'
                 CHECK (scope_kind IN ('portfolio', 'programme', 'site', 'project')),
  scope_id     text NOT NULL DEFAULT '',
  min_severity text NOT NULL DEFAULT 'info'
                 CHECK (min_severity IN ('info', 'attention', 'urgent')),
  -- 'centre' n'existe pas ici, délibérément : voir la première règle.
  channel      text NOT NULL DEFAULT 'email'
                 CHECK (channel IN ('email', 'outbound')),
  cadence      text NOT NULL DEFAULT 'immediate'
                 CHECK (cadence IN ('immediate', 'daily', 'weekly')),
  active       boolean NOT NULL DEFAULT true,
  created_on   date NOT NULL DEFAULT CURRENT_DATE,
  row_version  integer NOT NULL DEFAULT 1,
  CHECK (scope_kind = 'portfolio' OR scope_id <> ''),
  UNIQUE (user_id, kind, scope_kind, scope_id, channel)
);
CREATE INDEX notification_sub_user_idx ON notification_subscription(user_id, active);

-- Le silence de nuit, lu dans le fuseau du SITE de la personne et non du
-- serveur : une équipe de São Paulo ne dort pas aux heures de Zurich. Un
-- message émis pendant le silence n'est pas supprimé, il attend — sauf
-- « urgent », qui passe, parce qu'un silence qu'on ne peut pas percer
-- devient un silence qu'on désactive.
ALTER TABLE app_user ADD COLUMN quiet_from smallint;   -- heure locale, 0-23
ALTER TABLE app_user ADD COLUMN quiet_to   smallint;
ALTER TABLE app_user ADD CONSTRAINT app_user_quiet_check CHECK (
  (quiet_from IS NULL AND quiet_to IS NULL)
  OR (quiet_from BETWEEN 0 AND 23 AND quiet_to BETWEEN 0 AND 23)
);

-- Le fuseau appartient au site et non au compte : c'est le lieu qui
-- décide de la nuit. Il n'y a rien à ajouter — `site.tz_offset` existe
-- depuis 001 et servait déjà aux fenêtres d'arrêt d'usine. Le silence de
-- nuit s'y adosse plutôt que d'ouvrir une seconde source pour la même
-- vérité.
COMMENT ON COLUMN site.tz_offset IS
  'Décalage horaire du site par rapport à UTC. Sert aux fenêtres d''usine et, depuis 019, au silence de nuit.';

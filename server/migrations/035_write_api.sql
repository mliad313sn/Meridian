-- ═══════════════════════════════════════════════════════════════════
-- 035 · L'API D'ÉCRITURE — identités externes, clé d'idempotence  (I-2 · I-5 · INT-13)
--
-- Retour de terrain RT365 (docs/33, M-05). Le premier vrai intégrateur a
-- chargé seize projets, six jalons, 86 lignes RAID, quatorze décisions
-- et vingt et une actions — par les routes de session du navigateur,
-- parce que /api/v1 ne savait que lire. Sans identité externe, il a
-- encodé la sienne dans les titres (« [O-11] … ») et cherché ses lignes
-- par préfixe de chaîne. Sans clé d'idempotence, sa seconde exécution
-- devait relire tout le livre pour ne rien créer deux fois.
--
-- ── L'identité externe ─────────────────────────────────────────────
--
-- (external_source, external_id) : QUEL système branché, et SON nom pour
-- la ligne. La source est l'identifiant de l'intégration (stable à la
-- rotation de clé ; une intégration recréée est un autre système, et
-- ses lignes sont neuves — c'est voulu). Unique par source : deux
-- systèmes peuvent nommer « E01 » sans se marcher dessus ; un même
-- système ne peut pas avoir deux « E01 ». NULL pour tout ce que les
-- humains créent à l'écran.
--
-- ── La provenance de l'avancement (I-5, première tranche) ──────────
--
-- « L'avancement est saisi à la main ; l'EVM lit des pourcentages
-- typés. » Un avancement qui arrive d'un système de suivi porte QUI l'a
-- mesuré et QUAND. Vide = saisi par une personne dans Meridian.
--
-- ── La clé d'idempotence (INT-13) ──────────────────────────────────
--
-- Un tiers qui réessaie ne doit pas créer de doublon dans un registre de
-- gouvernance. La clé est propre à l'intégration ; la même clé avec le
-- même corps rejoue la réponse enregistrée ; la même clé avec un autre
-- corps est refusée. Le corps est gardé par son empreinte, pas en clair.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE project ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE project ADD COLUMN external_id text;
CREATE UNIQUE INDEX project_external_idx ON project(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE milestone ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE milestone ADD COLUMN external_id text;
CREATE UNIQUE INDEX milestone_external_idx ON milestone(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE raid_item ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE raid_item ADD COLUMN external_id text;
CREATE UNIQUE INDEX raid_external_idx ON raid_item(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE meeting_decision ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE meeting_decision ADD COLUMN external_id text;
CREATE UNIQUE INDEX decision_external_idx ON meeting_decision(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE meeting_action ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE meeting_action ADD COLUMN external_id text;
CREATE UNIQUE INDEX action_external_idx ON meeting_action(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE activity ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE activity ADD COLUMN external_id text;
CREATE UNIQUE INDEX activity_external_idx ON activity(external_source, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE activity ADD COLUMN progress_source text NOT NULL DEFAULT '';
ALTER TABLE activity ADD COLUMN progress_at timestamptz;

ALTER TABLE work_item ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE work_item ADD COLUMN external_id text;
CREATE UNIQUE INDEX work_item_external_idx ON work_item(external_source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE idempotency_key (
  integration_id text NOT NULL REFERENCES integration(id) ON DELETE CASCADE,
  key            text NOT NULL,
  request_hash   text NOT NULL,
  status         integer NOT NULL,
  response_json  jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, key)
);
CREATE INDEX idempotency_key_age_idx ON idempotency_key(created_at);

-- ═══════════════════════════════════════════════════════════════════
-- 034 · LA DÉCISION COMME ENREGISTREMENT, LE RAID RELIÉ  (I-7 · I-8)
--
-- Retour de terrain RT365 (docs/33). Une organisation a chargé son
-- programme dans Meridian et a dû consigner ses décisions D-035..D-048 —
-- prises par un propriétaire de produit ENTRE deux comités — comme
-- décisions d'une occurrence de réunion artificielle, ouverte pour
-- l'occasion. Le modèle ne connaissait qu'une décision : celle d'une
-- salle. Or une décision prise par qui en a l'autorité, hors salle, est
-- une décision, et elle appartient à la piste.
--
-- ── I-7 · la décision hors réunion ────────────────────────────────
--
-- `occurrence_id` devient NULLABLE. Une décision est ancrée soit à une
-- occurrence (elle a la date de la réunion), soit à une DATE et un
-- DÉCIDEUR nommés — jamais ni l'un ni l'autre (contrainte). Trois
-- champs que le terrain a réclamés parce que son registre les portait
-- et que le nôtre les perdait : les ALTERNATIVES écartées, la DISSENSION
-- exprimée, et ce que cette décision REMPLACE. Une décision ne se modifie
-- pas et ne s'efface pas — elle se remplace par une autre qui la nomme
-- (`supersedes`), comme une écriture comptable se corrige par contre-
-- passation. Et elle se relie à ce qu'elle tranche : un risque, un jalon
-- (de gouvernance ou non), une demande de modification — `cr_id`
-- existait déjà.
--
-- ── I-8 · le RAID relié ───────────────────────────────────────────
--
-- Un risque se lève CONTRE quelque chose : la condition d'un jalon de
-- gouvernance qu'il menace, la modification qui l'a créé ou qui le
-- traite. Sans ce lien, « quels risques pèsent sur le passage du jalon
-- 3 ? » se répond de mémoire. `gate` est le numéro dans l'échelle du
-- programme (comme milestone.gate) ; `cr_id` la modification. Les dates
-- de revue existaient déjà (`review_on`) et n'étaient lues nulle part :
-- l'ordre du jour les lit désormais (shared/meetings.js).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE meeting_decision ALTER COLUMN occurrence_id DROP NOT NULL;
ALTER TABLE meeting_decision ADD COLUMN decided_on date;
ALTER TABLE meeting_decision ADD COLUMN alternatives text NOT NULL DEFAULT '';
ALTER TABLE meeting_decision ADD COLUMN dissent text NOT NULL DEFAULT '';
ALTER TABLE meeting_decision ADD COLUMN raid_id text
  REFERENCES raid_item(id) ON DELETE SET NULL;
ALTER TABLE meeting_decision ADD COLUMN milestone_id text
  REFERENCES milestone(id) ON DELETE SET NULL;
ALTER TABLE meeting_decision ADD COLUMN supersedes text
  REFERENCES meeting_decision(id) ON DELETE SET NULL;
ALTER TABLE meeting_decision ADD CONSTRAINT decision_anchored
  CHECK (occurrence_id IS NOT NULL OR (decided_on IS NOT NULL AND decided_by IS NOT NULL));

CREATE INDEX meeting_decision_raid_idx ON meeting_decision(raid_id) WHERE raid_id IS NOT NULL;
CREATE INDEX meeting_decision_milestone_idx ON meeting_decision(milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX meeting_decision_standalone_idx ON meeting_decision(decided_on DESC) WHERE occurrence_id IS NULL;

ALTER TABLE raid_item ADD COLUMN gate integer
  CHECK (gate IS NULL OR gate BETWEEN 1 AND 12);
ALTER TABLE raid_item ADD COLUMN cr_id text
  REFERENCES change_request(id) ON DELETE SET NULL;
CREATE INDEX raid_gate_idx ON raid_item(project_id, gate) WHERE gate IS NOT NULL;
CREATE INDEX raid_cr_idx ON raid_item(cr_id) WHERE cr_id IS NOT NULL;

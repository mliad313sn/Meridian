-- ═══════════════════════════════════════════════════════════════════
-- 063 · AFFECTATIONS ET TAUX  (comité fonctionnel, docs/41 · vague B :
--       FX-08, FX-09, FX-10)
--
-- FX-08 · Une allocation dit « cette personne est sur ce projet à 50 % du
--   1er mars au 30 juin ». Elle ne dit pas SUR QUOI. On ne voyait donc pas
--   qu'une même personne était à 180 % la semaine du 12 : deux activités
--   de deux projets tombaient la même semaine, et la moyenne de projet les
--   lissait. Une AFFECTATION porte une activité, une personne OU un rôle
--   (quand on sait le métier avant de savoir le nom), et des unités en %
--   (1 à 200, comme MS Project). Le travail se CALCULE — durée × unités —
--   sauf si un travail est saisi, qui prime alors.
--
--   Les allocations de projet (002, 012) ne sont PAS touchées : elles
--   restent lues comme avant par la capacité existante. La charge par
--   semaine les compte là où une personne n'a encore aucune affectation
--   sur le projet, pour qu'une affectation affine une allocation sans
--   jamais la compter deux fois (shared/resources.js).
--
-- FX-09 · Le nivellement n'a pas de table. Il PROPOSE (D-41.02) ; quand un
--   humain autorisé l'applique, chaque déplacement est une mise à jour
--   d'activité auditée, sous row_version, comme à l'écran. Rien ici.
--
-- FX-10 · Un TAUX est un prix de jour, par personne ou par rôle, dans une
--   devise, sur une période d'effet. Le taux de l'annuaire (`person.
--   day_rate`, 001) reste la valeur de repli : une table de taux étend
--   cette règle, elle ne la remplace pas. Le cours de change est posé SUR
--   la ligne, comme pour une ligne de coût (012) : un taux ne se réévalue
--   pas tout seul quand le cours bouge.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE assignment (
  id              text PRIMARY KEY,
  activity_id     text NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  -- une personne nommée, OU un rôle (le métier, avant le nom) — jamais les deux
  person_id       text REFERENCES person(id) ON DELETE CASCADE,
  role_label      text NOT NULL DEFAULT '',
  -- la part d'une journée pleine, en % : 50 = mi-temps, 200 = deux personnes
  units           integer NOT NULL DEFAULT 100 CHECK (units BETWEEN 1 AND 200),
  -- le travail saisi, en jours-personne ; NULL = calculé (durée × unités)
  work_days       numeric CHECK (work_days IS NULL OR work_days >= 0),
  note            text NOT NULL DEFAULT '',
  -- I-2 — le système branché qui la tient, et SON nom pour elle
  external_source text REFERENCES integration(id) ON DELETE SET NULL,
  external_id     text,
  row_version     integer NOT NULL DEFAULT 1,
  CONSTRAINT assignment_person_or_role CHECK (
    (person_id IS NOT NULL AND role_label = '') OR
    (person_id IS NULL AND role_label <> ''))
);
CREATE INDEX assignment_activity_idx ON assignment(activity_id);
CREATE INDEX assignment_person_idx ON assignment(person_id);
CREATE UNIQUE INDEX assignment_external_idx ON assignment(external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE rate (
  id              text PRIMARY KEY,
  -- par personne, OU par rôle (le libellé de métier de l'annuaire) — jamais les deux
  person_id       text REFERENCES person(id) ON DELETE CASCADE,
  role_label      text NOT NULL DEFAULT '',
  -- prix d'une journée, en unités ENTIÈRES de la devise (comme day_rate)
  day_rate        numeric NOT NULL CHECK (day_rate >= 0),
  currency        text NOT NULL DEFAULT 'USD',
  -- unités de la devise de reporting par unité de `currency`, posé sur la ligne
  fx_rate         numeric NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
  effective_from  date NOT NULL,
  -- NULL = sans fin
  effective_to    date,
  note            text NOT NULL DEFAULT '',
  row_version     integer NOT NULL DEFAULT 1,
  CONSTRAINT rate_person_or_role CHECK (
    (person_id IS NOT NULL AND role_label = '') OR
    (person_id IS NULL AND role_label <> '')),
  CONSTRAINT rate_dates_ordered CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX rate_person_idx ON rate(person_id, effective_from);
CREATE INDEX rate_role_idx ON rate(role_label, effective_from);

INSERT INTO id_counter (prefix, next_value) VALUES ('ASG', 0);
INSERT INTO id_counter (prefix, next_value) VALUES ('RATE', 0);

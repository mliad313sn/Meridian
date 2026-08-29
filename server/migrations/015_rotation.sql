-- ═══════════════════════════════════════════════════════════════════
-- 015 · ABSENCES, SUPPLÉANCE, PRÉFÉRENCES  (comité indépendant, R-02 · R-11)
--
-- La rotation était modélisée pour la capacité (V-09) et nulle part pour
-- la responsabilité : les décisions s'arrêtaient pendant les congés de
-- rotation et l'outil n'en disait rien — le mécanisme d'arrêt de flux le
-- plus banal d'une exploitation minière, et le seul que le modèle
-- ignorait.
--
--   · une ABSENCE est bornée, motivée, et peut nommer un suppléant ;
--   · la SUPPLÉANCE est une autorité : le suppléant agit au nom de
--     l'absent, dans la limite de ce que l'absent pouvait faire — jamais
--     plus — et la piste d'audit nomme LES DEUX ;
--   · les préférences de notification appartiennent au compte : langue
--     du message et fréquence, parce que le premier courriel envoyé à un
--     chef de site francophone ne doit pas partir en anglais pendant sa
--     rotation (R-11).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE person_absence (
  id          text PRIMARY KEY,
  person_id   text NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  reason      text NOT NULL DEFAULT 'rotation'
                CHECK (reason IN ('rotation','leave','training','sick')),
  deputy_id   text REFERENCES person(id) ON DELETE SET NULL,
  note        text NOT NULL DEFAULT '',
  row_version integer NOT NULL DEFAULT 1,
  CHECK (ends_on >= starts_on),
  CHECK (deputy_id IS NULL OR deputy_id <> person_id)
);
CREATE INDEX person_absence_person_idx ON person_absence(person_id, starts_on);

-- La session d'un suppléant porte POUR QUI elle agit ; vérifiée à chaque
-- requête contre l'absence qui la justifie, jamais crue sur parole.
ALTER TABLE session ADD COLUMN acting_for text REFERENCES app_user(id) ON DELETE SET NULL;

-- R-11 — la langue et la fréquence appartiennent au destinataire.
ALTER TABLE app_user ADD COLUMN locale text NOT NULL DEFAULT ''
  CHECK (locale IN ('','en','fr'));
ALTER TABLE app_user ADD COLUMN notify_pref text NOT NULL DEFAULT 'immediate'
  CHECK (notify_pref IN ('immediate','daily','weekly','off'));

INSERT INTO id_counter (prefix, next_value) VALUES ('ABS', 0);

-- G-03 — la donnée de santé sort du système, plutôt que d'y être protégée.
--
-- Le comité InfoSec/GRC a relevé trois faits qui se conjoignent mal : une
-- absence pouvait porter le motif « sick », les suppressions écrivent la
-- ligne ENTIÈRE dans une piste que la base refuse d'effacer, et la piste
-- est lisible par tout compte de niveau groupe. Le motif médical d'un
-- technicien devenait donc lisible à perpétuité par tout responsable de
-- programme — une donnée de l'article 9 du RGPD, conservée sans base
-- légale et ineffaçable par construction.
--
-- La bonne correction n'est pas de mieux garder ce motif : c'est de ne
-- pas le collecter. La suppléance a besoin de savoir QUI est absent, QUAND
-- et QUI couvre — jamais pourquoi médicalement. « unavailable » dit
-- exactement ce dont l'outil a besoin, et rien de plus.
--
-- Les absences déjà déclarées pour ce motif sont reversées : c'est une
-- minimisation, pas une réécriture d'histoire — l'acte de déclaration
-- reste sur la piste, seule la catégorie sensible disparaît de la donnée
-- vivante.

UPDATE person_absence SET reason = 'unavailable' WHERE reason = 'sick';

ALTER TABLE person_absence DROP CONSTRAINT IF EXISTS person_absence_reason_check;
ALTER TABLE person_absence ADD CONSTRAINT person_absence_reason_check
  CHECK (reason IN ('rotation', 'leave', 'training', 'unavailable'));

COMMENT ON COLUMN person_absence.reason IS
  'Motif fonctionnel de l''absence. Jamais un motif médical : voir 017 et docs/20.';
COMMENT ON COLUMN person_absence.note IS
  'Note libre d''organisation. N''est jamais recopiée dans la piste d''audit (G-03).';

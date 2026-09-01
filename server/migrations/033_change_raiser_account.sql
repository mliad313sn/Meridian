-- 033 · PR-03 — la SoD des modifications tenait à un lien facultatif.
--
-- Le comité de recette des processus (docs/32) a rejoué le cycle complet
-- depuis un livre vide : un compte de niveau groupe SANS personne liée a
-- émis une demande de modification puis l'a APPROUVÉE lui-même. La
-- ségrégation des tâches comparait des identifiants de PERSONNE
-- (change_request.raised_by = personId de l'émetteur) ; un compte sans
-- personne émet avec raised_by NULL, et « NULL n'est personne » se lit
-- alors « personne ne s'auto-approuve jamais » — l'inverse de la règle.
-- Le compte d'administration d'une instance neuve — celui du comité en
-- production — est précisément un compte sans personne.
--
-- La demande porte désormais AUSSI le compte qui l'a émise. Le compte
-- existe toujours (I-19 : jamais supprimé), donc la comparaison ne peut
-- plus tomber sur NULL pour qui a émis par l'application.

ALTER TABLE change_request ADD COLUMN raised_by_user text
  REFERENCES app_user(id) ON DELETE SET NULL;

COMMENT ON COLUMN change_request.raised_by_user IS
  'Le COMPTE émetteur — la SoD compare des comptes, pas des personnes : '
  'toute demande émise par l''application en a un, lié ou pas à une personne.';

-- Reprise du passé : la piste d''audit a toujours su qui a émis.
UPDATE change_request cr
   SET raised_by_user = a.user_id
  FROM audit_event a
 WHERE a.entity = 'change_request'
   AND a.entity_id = cr.id
   AND a.action = 'Change request raised'
   AND cr.raised_by_user IS NULL;

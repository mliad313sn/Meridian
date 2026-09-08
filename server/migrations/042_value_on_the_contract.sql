-- 042 · La valeur devient une chose qu'un système source peut écrire,
--       et une reconfirmation qui suit l'échelle du programme.
--
-- RT365 a rejoué son évaluation sur la 5.10.0 et a écrit la phrase qui
-- fait ce fichier : « REQ-02 a rendu les faits de LIVRAISON synchronisables
-- depuis le dépôt de terrain ; les faits de VALEUR doivent toujours être
-- saisis à la main, de sorte que la seule chose que lit un dirigeant est
-- la seule chose qui se périme. » Leur chargeur pousse 256 écritures de
-- livraison et ne peut pousser un seul bénéfice (V-1).
--
-- Deux gestes ici, un par table :
--
--   · l'identité externe sur `business_case` et `benefit`, aux mêmes
--     règles que les sept collections de la 035 : la source nomme SA
--     ligne, l'unicité est par intégration, et une ligne née à l'écran
--     s'adopte plutôt que de se dupliquer ;
--
--   · la reconfirmation du cas d'affaire par jalon. La 028 la bornait à
--     `BETWEEN 1 AND 4` — les quatre jalons câblés de l'époque. Depuis la
--     036 une échelle en compte jusqu'à douze, si bien qu'un programme
--     qui déclarait six jalons ne pouvait pas reconfirmer son cas aux
--     jalons 5 et 6 : la contrainte refusait la ligne. Et une seule
--     reconfirmation était gardée, celle de la dernière fois, alors que
--     ce que demande V-3 est la SUITE — « le cas a-t-il été reconfirmé À
--     CE jalon-ci » — qu'aucune colonne unique ne peut porter.

ALTER TABLE business_case ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE business_case ADD COLUMN external_id text;
CREATE UNIQUE INDEX business_case_external_idx ON business_case(external_source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE benefit ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE benefit ADD COLUMN external_id text;
CREATE UNIQUE INDEX benefit_external_idx ON benefit(external_source, external_id) WHERE external_id IS NOT NULL;

-- La borne de la 028 devient celle de l'échelle la plus longue (036).
ALTER TABLE business_case DROP CONSTRAINT business_case_reconfirmed_gate_check;
ALTER TABLE business_case ADD CONSTRAINT business_case_reconfirmed_gate_check
  CHECK (reconfirmed_gate IS NULL OR reconfirmed_gate BETWEEN 1 AND 12);

-- Une reconfirmation par jalon, et ce qu'elle a vu : un jalon franchi
-- sans que le cas ait été reconfirmé À CE jalon est la décision
-- « continuer » que personne n'a prise. Les deux chiffres sont copiés au
-- moment du geste — c'est ce qui permet de dire l'écart avec la
-- reconfirmation précédente sans relire un historique qui n'existe pas.
CREATE TABLE case_reconfirmation (
  id               text PRIMARY KEY,
  case_id          text NOT NULL REFERENCES business_case(id) ON DELETE CASCADE,
  project_id       text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  gate             integer NOT NULL CHECK (gate BETWEEN 1 AND 12),
  -- La promesse telle qu'elle était à cet instant, en unités entières.
  expected_cost    numeric(16,2),
  expected_benefit numeric(16,2),
  -- Ce que le reconfirmant a dit : continuer, et pourquoi.
  verdict          text NOT NULL DEFAULT 'Continue'
                     CHECK (verdict IN ('Continue','Continue with conditions','Stop')),
  note             text NOT NULL DEFAULT '',
  reconfirmed_by   text REFERENCES person(id) ON DELETE SET NULL,
  reconfirmed_on   date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by      text REFERENCES app_user(id) ON DELETE SET NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1
);
-- Une seule reconfirmation vivante par (cas, jalon) : reconfirmer deux
-- fois le même jalon corrige, ne s'empile pas.
CREATE UNIQUE INDEX case_reconfirmation_gate_idx ON case_reconfirmation(case_id, gate);
CREATE INDEX case_reconfirmation_project_idx ON case_reconfirmation(project_id);

INSERT INTO id_counter (prefix, next_value) VALUES ('CRC', 0);

-- REQ-21 (V-2) · Un bénéfice dont la date de réalisation est passée sans
-- que personne l'ait mesuré est une exception de portefeuille, au même
-- titre qu'un dépassement de marge.
--
-- La 026 bornait les dimensions à schedule/cost/benefit — trois formes de
-- « le projet sort de ce qui était permis ». Il en manquait une quatrième,
-- qui n'est pas un dépassement mais une ABSENCE : la date est passée, et
-- personne n'a rien constaté. C'est celle qui coûte le plus cher, parce
-- que rien ne la signale — le projet est clos, l'équipe s'est dispersée,
-- et la promesse reste dans une table que rien ne relance.
--
-- `tolerance_id` est déjà nullable (la 026 l'a voulu ainsi) : cette
-- exception-ci n'a pas de marge derrière elle, elle a une date.
ALTER TABLE project_exception DROP CONSTRAINT project_exception_dimension_check;
ALTER TABLE project_exception ADD CONSTRAINT project_exception_dimension_check
  CHECK (dimension IN ('schedule','cost','benefit','benefit-review'));

-- ═══════════════════════════════════════════════════════════════════
-- 037 · LES CRITÈRES D'UN JALON, ET QUI A CONSTATÉ  (I-4 · retour de terrain RT365, M-06)
--
-- « Voir preuve 0/1 » était un compte de documents approuvés. Le terrain
-- (un programme réglementé, qui tient une matrice de traçabilité et des
-- quatuors de tests à côté) a demandé ce que le document ne dit pas :
-- QUEL critère cette preuve satisfait, QUI l'a revu, QUAND — de sorte
-- que « quel test prouve ce critère de porte ? » ait une réponse dans
-- l'outil qui prétend tenir la porte.
--
-- Un critère est une phrase posée d'avance sur (projet, jalon). Il est
-- tenu (`met`) par un REVISEUR nommé, à une date, et peut pointer le
-- document qui le prouve. Deux règles, tenues par la route :
--
--   · tenir un critère exige un réviseur nommé — sans nom, c'est une
--     opinion, pas un constat (même règle que l'acceptation de jalon,
--     PM-04) ;
--   · le réviseur n'est pas le propriétaire du document qu'il cite —
--     la même indépendance que l'approbation de preuve (S-06).
--
-- Le moteur lit désormais les deux : un jalon est prêt quand ses preuves
-- sont approuvées ET ses critères tenus. Sans critère posé, rien ne
-- change — les projets existants gardent le comportement d'avant.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE gate_criterion (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  gate         integer NOT NULL CHECK (gate BETWEEN 1 AND 12),
  seq          integer NOT NULL DEFAULT 0,
  text         text NOT NULL,
  document_id  text REFERENCES document(id) ON DELETE SET NULL,
  met          boolean NOT NULL DEFAULT false,
  reviewed_by  text REFERENCES person(id) ON DELETE SET NULL,
  reviewed_on  date,
  note         text NOT NULL DEFAULT '',
  row_version  integer NOT NULL DEFAULT 1,
  CONSTRAINT criterion_met_is_reviewed CHECK (NOT met OR reviewed_by IS NOT NULL)
);
CREATE INDEX gate_criterion_project_idx ON gate_criterion(project_id, gate, seq);

-- 043 · Ce que la 036 a libéré, et que deux tables n'ont pas suivi.
--
-- Rapport de terrain RT365, V-13 : « La 036 a libéré l'échelle ; les
-- objets de valeur et d'apprentissage n'ont pas voyagé avec elle. »
--
--   gate_criterion.gate     CHECK (BETWEEN 1 AND 12)   ← libéré en 037
--   business_case.reconfirmed_gate                     ← libéré en 042
--   lesson.gate_n           CHECK (BETWEEN 1 AND 4)    ← ici
--
-- Leur programme court sur six jalons (A–F). Sur une telle échelle, un
-- enseignement ne peut pas être rattaché aux jalons 5 et 6 : la
-- contrainte refuse la ligne. Et leur phrase est juste — brider en
-- silence au jalon 4 est PIRE que de ne pas avoir d'échelle
-- configurable, parce que la panne est invisible jusqu'à ce que
-- quelqu'un essaie.
ALTER TABLE lesson DROP CONSTRAINT lesson_gate_n_check;
ALTER TABLE lesson ADD CONSTRAINT lesson_gate_n_check
  CHECK (gate_n IS NULL OR gate_n BETWEEN 1 AND 12);

-- E-1 · Un livre né avant la 036 n'a aucun chemin vers l'échelle de son
--       programme, et rien ne le dit.
--
-- RT365 corrige ici notre propre compte rendu, et le leur : la 5.10.0 ne
-- pose PAS deux échelles — `scaffoldProject` en lit une seule. Le
-- doublon de leur livre venait de leur chargeur. La vraie demande est
-- plus étroite, et c'est la leur :
--
--   « La 036 dit qu'une échelle modifiée ne réécrit pas les projets
--     existants — règle délibérée et juste. Mais une organisation réelle
--     adopte un outil de portefeuille avec des projets déjà dedans. Sans
--     chemin de reprise, tout adoptant précoce reste indéfiniment sur
--     l'échelle par défaut, et « quel jalon vient ensuite » est
--     indéfiniment faux pour lui. »
--
-- Ils proposent deux issues, et demandent la moins chère : un signal de
-- LECTURE. On pose donc sur le projet l'échelle sous laquelle il a été
-- dressé. Ce qui diverge devient lisible — par l'écran, par l'API, et
-- par qui décide s'il faut reprendre.
--
-- La valeur est posée à NULL pour l'existant et non devinée : « ce
-- projet a été dressé sous une échelle que nous ne connaissons pas » est
-- vrai, et l'inventer serait un mensonge daté.
ALTER TABLE project ADD COLUMN scaffolded_gates integer;

-- Ce qui est déjà là et qu'on peut affirmer sans rien inventer : un
-- projet dont le programme ne déclare AUCUNE échelle a forcément été
-- dressé sur les quatre jalons par défaut, puisqu'il n'y en avait pas
-- d'autre à lire.
UPDATE project p SET scaffolded_gates = 4
 WHERE scaffolded_gates IS NULL
   AND EXISTS (SELECT 1 FROM programme pr WHERE pr.id = p.programme_id AND pr.gate_model IS NULL);

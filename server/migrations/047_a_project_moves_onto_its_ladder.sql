-- ═══════════════════════════════════════════════════════════════════
-- 047 · UN PROJET DÉJÀ NÉ PASSE SUR L'ÉCHELLE DE SON PROGRAMME
--        (REQ-27 · V-8 — retour de terrain RT365)
--
-- La 036 pose la règle et ne bouge pas : une échelle déclarée NE
-- RÉÉCRIT PAS les projets qui existent déjà (D-33.2). Des jalons datés
-- et des preuves déposées ne doivent pas bouger sous les pieds des
-- gens. La 043 a posé le SIGNAL DE LECTURE qui manquait
-- (`project.scaffolded_gates`) : ce qui diverge est enfin lisible.
--
-- Il manquait le CHEMIN. RT365 a mesuré « dix jalons là où six étaient
-- voulus » et l'a déposé comme un défaut, pas comme une préférence :
-- leurs seize projets ont été dressés AVANT que RBT porte une échelle,
-- et rien ne les y amenait. Le geste existe désormais — explicite, sur
-- un projet nommé, avec un essai à blanc qui dit ce qu'il fera avant de
-- le faire (server/src/routes/ladder.js).
--
-- Ce fichier ne pose que les deux colonnes que ce geste ne peut pas
-- écrire sans mentir.
--
-- ── 1 · Un jalon que la nouvelle échelle ne reconnaît pas ───────────
--
-- Un projet à six portes qui passe à quatre porte des jalons datés,
-- acceptés, avec des preuves déposées, dont la nouvelle échelle n'a
-- aucun barreau. Trois issues, et deux sont fausses :
--
--   · SUPPRIMER détruit la preuve. Non.
--   · LAISSER sur l'échelle en fait un mensonge : deux jalons au même
--     rang, ou un rang qui n'existe pas. Non.
--   · RETIRER : la ligne reste, entière — sa date, son acceptation, son
--     accepteur, ses critères, ses documents — mais elle QUITTE
--     l'échelle. Elle redevient un jalon ordinaire (`kind='milestone'`,
--     `gate` nul). Rien n'est détruit, et l'échelle ne ment pas.
--
-- Reste à ne pas perdre CE QU'ELLE ÉTAIT. C'est exactement l'argument
-- de la 043 pour `scaffolded_gates` : « sans cela rien ne DIT qu'un
-- projet suit une échelle que son programme ne déclare plus ; on
-- l'écrit donc, au lieu de le deviner plus tard ». Le rang qu'un jalon
-- retiré occupait est de la même farine — on l'écrit sur la ligne.
--
-- NULL veut dire « ce jalon n'a jamais été un barreau retiré », et
-- rien n'est rétro-rempli : aucun projet n'a encore été migré.
ALTER TABLE milestone ADD COLUMN retired_gate integer
  CHECK (retired_gate IS NULL OR retired_gate BETWEEN 1 AND 12);

COMMENT ON COLUMN milestone.retired_gate IS
  'The rung this milestone held before an explicit ladder move took it off (REQ-27). NULL: never a retired gate. The row keeps its date, its acceptance and its evidence; only its place on the ladder is gone.';

-- ── 2 · Un critère de porte a le droit de quitter l''échelle ────────
--
-- Une preuve porte déjà ce cas : `document.gate` vaut 0 depuis la 002
-- pour « document de projet, rattaché à aucune porte ». Un critère,
-- lui, était contraint à 1..12 (037, élargi en 043) : il ne pouvait
-- donc PAS suivre son jalon hors de l''échelle, et le geste n''avait
-- que deux choix, tous deux faux — le supprimer (détruire le constat
-- d''un réviseur nommé) ou le laisser sous un rang qui appartient
-- désormais à un AUTRE barreau (attribuer la preuve d''un autre).
--
-- On ouvre donc le 0, avec exactement le sens qu''il a déjà sur un
-- document : « posé sur ce projet, rattaché à aucune porte ». Le
-- moteur ne le lit pas — `Engine.gateStatus` ne compare que des rangs
-- >= 1 — donc l''arithmétique gelée ne bouge pas d''un chiffre. Le
-- critère, son texte, son `met`, son réviseur et sa date restent.
--
-- Aucune ligne existante ne vaut 0 : la contrainte s''élargit, elle ne
-- réécrit rien.
ALTER TABLE gate_criterion DROP CONSTRAINT gate_criterion_gate_check;
ALTER TABLE gate_criterion ADD CONSTRAINT gate_criterion_gate_check
  CHECK (gate BETWEEN 0 AND 12);

COMMENT ON COLUMN gate_criterion.gate IS
  'The rung this criterion is posed for. 0 means it is posed on the project and attached to no gate — the same meaning document.gate = 0 has carried since 002, and where a criterion lands when an explicit ladder move retires its rung (REQ-27).';

-- ═══════════════════════════════════════════════════════════════════
-- 032 · LA CLÔTURE QUI SE SIGNE, LE JALON QUI S'ACCEPTE  (PM-08 · PM-04)
--
-- Deux fins qui n'en étaient pas.
--
-- ── PM-08 · la clôture ─────────────────────────────────────────────
--
-- « Closure » était une phase et `closed` un booléen : un projet se
-- fermait sans que PERSONNE n'ait signé qu'il était fini. Or clore, en
-- gestion de projet, ce sont trois signatures distinctes (ISO 21502
-- §6.6, PRINCE2 « Clore un projet », ITIL 4) :
--
--   · l'EXPLOITANT nommé qui reprend ce qui a été livré — sans lui, le
--     jour où ça tombe en panne, c'est encore l'équipe projet dissoute
--     qu'on appelle ;
--   · le PROPRIÉTAIRE DE BÉNÉFICE qui accepte le relais — les bénéfices
--     se réalisent APRÈS la clôture, et « restent au projet » veut dire
--     « n'appartiennent à personne » ;
--   · le mot de la fin, écrit — ce qu'on laisse, ce qu'on n'a pas fait.
--
-- Trois colonnes sur le projet plutôt qu'une table : il n'y a qu'UNE
-- clôture par projet, et la piste d'audit porte déjà l'histoire du geste.
--
-- ── PM-04 · l'acceptation ──────────────────────────────────────────
--
-- « Terminé » était une opinion : un jalon se cochait `done` sur
-- l'existence d'un sentiment. ISO 21502 §7.8 et ISO 10006 demandent le
-- contraire — des CRITÈRES posés d'avance, et un ACCEPTEUR nommé qui
-- constate qu'ils sont tenus. La règle, tenue par la route :
--
--   un jalon SANS critères se coche comme avant (tout n'est pas une
--   recette) ; un jalon AVEC critères ne se coche qu'en nommant qui a
--   constaté — et ce nom reste.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE project ADD COLUMN ops_accepted_by text
  REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE project ADD COLUMN benefits_owner_id text
  REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE project ADD COLUMN closure_note text NOT NULL DEFAULT '';
ALTER TABLE project ADD COLUMN closed_on date;

ALTER TABLE milestone ADD COLUMN acceptance_criteria text NOT NULL DEFAULT '';
ALTER TABLE milestone ADD COLUMN accepted_by text
  REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE milestone ADD COLUMN accepted_on date;

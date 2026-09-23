-- ═══════════════════════════════════════════════════════════════════
-- 040 · UNE DATE DE JALON DIT SUR QUOI ELLE REPOSE  (REQ-14 · RT365 D-057)
--
-- Le second passage en revue du dépôt RT365 (docs/33 §4) a trouvé une
-- demande sans identifiant : sa décision D-057 pose « pas de date
-- calendaire pour les portes C–F » — la feuille de route est pilotée par
-- des CONDITIONS (le prédécesseur, la mesure qui produira la date), et
-- une date n'est écrite que pour un acte engagé ou depuis une base
-- mesurée. Meridian exigeait une date sur chaque jalon : le programme
-- n'avait d'autre choix que d'inventer des dates de remplissage, que
-- l'ordre du jour aurait un jour lues comme « MANQUÉ ».
--
-- Une date reste obligatoire — le moteur trace, trie et compare avec
-- elle, et une colonne nullable aurait touché chaque écran. Ce qui
-- s'ajoute est ce que la date VAUT : `committed` (un engagement, lu
-- comme avant) ou `placeholder` (une position sur la ligne du temps,
-- jamais un manquement — l'ordre du jour ne la dit pas manquée, le
-- moteur ne la dit pas en retard), et la CONDITION qui produira la vraie
-- date. Les lignes existantes sont `committed` : rien ne change pour
-- elles.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE milestone ADD COLUMN date_basis text NOT NULL DEFAULT 'committed'
  CHECK (date_basis IN ('committed','placeholder'));
ALTER TABLE milestone ADD COLUMN condition text NOT NULL DEFAULT '';

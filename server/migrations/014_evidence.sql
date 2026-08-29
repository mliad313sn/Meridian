-- ═══════════════════════════════════════════════════════════════════
-- 014 · LA PREUVE DE JALON PORTE UN ARTEFACT  (comité indépendant, R-01)
--
-- Le constat bloquant : la table document ne portait ni fichier, ni lien,
-- ni emplacement — un « document approuvé » était une ligne dont
-- quelqu'un avait changé le statut, et le verrouillage de jalon protégeait
-- l'approbation d'un objet vide.
--
-- Forme retenue (recommandation du comité) : le LIEN VÉRIFIÉ. Le groupe
-- possède déjà une gestion documentaire ; Meridian n'a pas à la
-- remplacer, il a à refuser d'approuver dans le vide.
--
--   · `uri` : l'emplacement de la pièce. Libre au brouillon, exigé et
--     contrôlé (https + hôte de confiance, paramètre `documentHosts`) au
--     moment de l'approbation.
--   · `uri_locked_hash` / `uri_locked_on` : l'empreinte SHA-256 de l'URI
--     et la date, figées à l'approbation. Changer ensuite le lien d'un
--     document approuvé le fait retomber « En revue » — un lien qu'on
--     change après coup n'est pas une preuve.
--   · `supersedes` (R-13) : la lignée. Une nouvelle révision nomme la
--     ligne qu'elle remplace, au lieu d'une suite d'étiquettes.
--
-- Pas de rétro-remplissage : un document approuvé sans artefact cesse de
-- compter comme preuve, ce qui est exactement l'honnêteté demandée. Le
-- jeu de démonstration est amorcé avec des liens ; un livre réel montre
-- ses jalons tels qu'ils sont.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE document ADD COLUMN uri text NOT NULL DEFAULT '';
ALTER TABLE document ADD COLUMN uri_locked_hash text NOT NULL DEFAULT '';
ALTER TABLE document ADD COLUMN uri_locked_on date;
ALTER TABLE document ADD COLUMN supersedes text REFERENCES document(id) ON DELETE SET NULL;

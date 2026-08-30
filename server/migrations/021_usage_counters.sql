-- ═══════════════════════════════════════════════════════════════════
-- 021 · CE QUE L'USAGE COMPTE  (A-08, et une part de G-08)
--
-- Le comité d'adoption demande six indicateurs. Cinq se lisent dans des
-- données qui existent déjà — la piste, les comités, les actions, les
-- semaines saisies. Le sixième, « les refus rencontrés par utilisateur
-- actif », ne se lit nulle part : un refus d'autorité ne laisse aucune
-- trace. C'est délibéré et c'était juste — auditer chaque refus noierait
-- la piste dont dépend le contrôle.
--
-- Mais ne rien compter revient à ne rien savoir, et le comité InfoSec a
-- fait le même constat pour les échecs de connexion (G-08 : un compteur
-- en mémoire, perdu au redémarrage). D'où cette table, qui est la plus
-- petite chose capable de répondre aux deux :
--
--   · UN AGRÉGAT PAR JOUR ET PAR GENRE. Aucune colonne de compte, aucune
--     adresse, aucune ressource nommée. On sait COMBIEN, jamais QUI.
--     Mesurer l'adoption d'un outil n'est pas surveiller ceux qui s'en
--     servent, et la frontière est écrite ici, dans le schéma, plutôt
--     que laissée au bon vouloir des lecteurs.
--
--   · UNE LIGNE PAR JOUR, pas une par événement : la table reste
--     minuscule quel que soit l'usage, et se purge par date sans rien
--     perdre de ce qu'elle sait.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE usage_daily (
  day    date NOT NULL DEFAULT CURRENT_DATE,
  kind   text NOT NULL
           CHECK (kind IN ('refusal', 'sign-in', 'sign-in-failed', 'write')),
  n      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

COMMENT ON TABLE usage_daily IS
  'A-08 / G-08 — comptages agrégés par jour. Jamais de qui : seulement combien.';

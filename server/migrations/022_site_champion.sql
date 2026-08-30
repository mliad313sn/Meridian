-- ═══════════════════════════════════════════════════════════════════
-- 022 · LE RÉFÉRENT DU SITE  (A-12)
--
-- « Rien ne prépare ni ne désigne le référent local. » Le produit renvoie
-- vers « un administrateur » — c'est-à-dire vers personne en
-- particulier, et sur un site en rotation, vers personne tout court.
--
-- La personne qu'on appelle quand on ne sait pas est la première
-- infrastructure d'adoption d'un outil multi-sites, et elle n'existait
-- nulle part dans le schéma. Une colonne suffit : elle nomme quelqu'un
-- qui est déjà dans l'annuaire, sur son propre site, et l'aide affiche
-- CE nom avant de proposer le groupe.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE site ADD COLUMN champion_id text REFERENCES person(id) ON DELETE SET NULL;

COMMENT ON COLUMN site.champion_id IS
  'A-12 — la personne du site qu''on appelle en premier. Nommée, pas devinée.';

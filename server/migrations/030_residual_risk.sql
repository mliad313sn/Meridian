-- ═══════════════════════════════════════════════════════════════════
-- 030 · LE RISQUE RÉSIDUEL, ET LA PROVISION QUI NOMME SON RISQUE  (PM-06)
--
-- Deux moitiés du même trou, relevées ensemble par le registre de
-- conformité (ISO 31000 §6.5, ISO 21502 §7.9) :
--
-- 1. Le registre RAID portait la probabilité, l'impact et la STRATÉGIE
--    de réponse — jamais ce que la réponse est censée OBTENIR. Sans
--    cible résiduelle, « la mitigation a-t-elle servi ? » n'a pas de
--    réponse : on compare le risque d'aujourd'hui à un souvenir.
--
-- 2. La provision se tirait sans nommer le risque auquel elle répond.
--    Elle se consommait donc « en général » — et un comité qui demande
--    « contre quoi a-t-on dépensé la réserve ? » n'avait rien à lire.
--    La provision est pourtant, comptablement, la somme des risques
--    qu'on a accepté de porter : un tirage anonyme casse ce lien.
--
-- ── Décisions ──────────────────────────────────────────────────────
--
-- La cible résiduelle est en probabilité × impact, sur la même échelle
-- 1-5 que le constat — comparer exige la même règle. NULLABLE : une
-- réponse « Accept » ou « Monitor » n'a pas de cible, elle a un constat
-- assumé, et forcer un chiffre inventé serait une fausse assurance.
--
-- `risk_id` sur la ligne de coût est NULLABLE aussi, mais la ROUTE
-- l'exige quand `from_contingency` est vrai et qu'un risque ouvert
-- existe : on ne bloque pas le projet qui n'a aucun risque enregistré,
-- on bloque le tirage qui refuse de dire son nom quand il pourrait.
-- ON DELETE SET NULL : le grand livre est en ajout seul et survit à
-- tout — y compris à la suppression du risque qu'il finançait.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE raid_item ADD COLUMN target_probability integer
  CHECK (target_probability IS NULL OR target_probability BETWEEN 1 AND 5);
ALTER TABLE raid_item ADD COLUMN target_impact integer
  CHECK (target_impact IS NULL OR target_impact BETWEEN 1 AND 5);

ALTER TABLE cost_line ADD COLUMN risk_id text
  REFERENCES raid_item(id) ON DELETE SET NULL;

CREATE INDEX cost_line_risk_idx ON cost_line(risk_id) WHERE risk_id IS NOT NULL;

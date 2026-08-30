-- ═══════════════════════════════════════════════════════════════════
-- 023 · L'EMPREINTE DU JETON, PAS LE JETON  (S-14)
--
-- La table `session` conservait le jeton tel qu'il voyage dans le
-- cookie. Le mot de passe est haché depuis le premier jour ; le jeton,
-- qui ouvre exactement les mêmes portes pendant douze heures, ne l'était
-- pas. Une sauvegarde égarée, un export de diagnostic, un
-- `SELECT * FROM session` collé dans un ticket — et l'on tient des
-- sessions utilisables sans avoir jamais connu un mot de passe.
--
-- Le jeton fait 32 octets aléatoires : il n'y a pas de dictionnaire à
-- lui opposer, donc pas besoin de scrypt ici. Un SHA-256 suffit et
-- coûte assez peu pour être calculé à chaque requête.
--
-- La colonne est RENOMMÉE plutôt que réutilisée, délibérément : tout
-- appel qui n'aurait pas été converti échoue bruyamment sur une colonne
-- inconnue, au lieu de comparer silencieusement une empreinte à un
-- jeton et de ne jamais trouver personne. Une panne d'authentification
-- se voit ; une comparaison qui ne rapproche rien se voit aussi, mais
-- trop tard et dans le mauvais sens.
--
-- Les sessions en cours sont effacées : leurs jetons en clair ne
-- correspondent à rien après le changement. Tout le monde se reconnecte
-- une fois. C'est le prix, et il est payé une seule fois.
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM session;

ALTER TABLE session RENAME COLUMN token TO token_hash;

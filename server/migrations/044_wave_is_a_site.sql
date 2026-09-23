-- 044 · REQ-37 — une vague EST un site, et le refus doit le dire.
--
-- Rapport de terrain RT365, D-3 : « `rollout_wave` porte un `seq` qu'il
-- vous interdit d'employer. Trois vagues sur un site (seq 1, 2, 3) →
-- 201, `409 That record already exists`, 409. » Mesuré ici de nouveau,
-- mot pour mot, sur 5.12.0.
--
-- Ils demandaient de trancher entre deux lectures, et c'est la seconde :
-- ce n'est pas la contrainte qui est fausse, c'est le refus qui ne dit
-- rien. Une vague est un SITE de ce déploiement — le modèle le dit
-- (`docs/14-endeavour-value-review.md:134` « one row per site per
-- rollout »), l'habilitation le dit (`shared/rbac.js:41` « the rollout
-- wave per site »), l'écran le dit (« Sites in this rollout », le bouton
-- s'appelle « Site », la ligne porte la ville et l'état du site) et un
-- test le tient depuis la V-06 (`server/test/plant.test.js:143`).
--
-- Et `seq` n'est PAS mort pour autant : il ordonne les SITES entre eux —
-- l'écran le rend comme numéro d'étape et trie dessus
-- (`web/src/views/index.js:3001,3051`), le chargement lit
-- `ORDER BY project_id, seq, site_id` (`server/src/portfolio.js:145`) et
-- l'index `rollout_wave_project_idx(project_id, seq)` existe pour ça.
-- Retirer `seq`, comme le registre le proposait au cas où, effacerait
-- l'ordre du déploiement. On ne le retire pas, et §REQ-37 du retour le
-- dit avec ses mesures.
--
-- Ce que la migration change, donc : rien à la règle, tout à ce qu'elle
-- répond. La contrainte auto-nommée par PostgreSQL
-- (`rollout_wave_project_id_site_id_key`) prend un nom que le produit a
-- choisi, parce que c'est par ce nom que `server/src/pgerror.js` traduit
-- un refus en une phrase qu'on peut suivre — c'est déjà comme cela que
-- `access_grant_uniq` et `series_scope_exclusive` parlent. Un nom
-- engendré par le moteur n'est le contrat de personne.
ALTER TABLE rollout_wave DROP CONSTRAINT rollout_wave_project_id_site_id_key;
ALTER TABLE rollout_wave ADD CONSTRAINT rollout_wave_one_per_site
  UNIQUE (project_id, site_id);

-- Le pourquoi voyage avec le schéma : qui lira cette table dans dix ans
-- sans lire ce fichier trouvera la règle et son intention au même
-- endroit.
COMMENT ON CONSTRAINT rollout_wave_one_per_site ON rollout_wave IS
  'One wave per project and site: a wave IS a site in this rollout, and seq orders the sites. Phases at a single site are milestones on the project, not waves (REQ-37).';

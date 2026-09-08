-- ═══════════════════════════════════════════════════════════════════
-- 046 · CE QU'ON CHOISIT DE NE PAS FAIRE  (REQ-24 · RT365 V-5)
--
-- « Choisir ce qu'on ne fera pas est l'endroit où un portefeuille crée le
-- plus de valeur. Meridian ne classe rien aujourd'hui ; la demande ne
-- porte aucun score. »
--
-- Le classement se fait sur quatre entrées. Trois existaient déjà et ne
-- sont pas recréées ici : la valeur revendiquée d'un projet vit dans son
-- cas d'affaire (028/042), son exposition RAID se calcule par
-- `Engine.exposure` sur le registre (001), et la capacité qu'il consomme
-- se lit dans les affectations (001) contre le plafond des réglages.
--
-- Ce qui manquait, et que cette migration ajoute, tient en deux idées.
--
-- ── 1 · UNE DEMANDE DOIT POUVOIR DIRE LES MÊMES QUATRE CHOSES ──────
--
-- La 011 a donné à la demande quatre notes de 1 à 5 (fit, value, risk,
-- effort). Ce sont des AVIS, et ils ne se comparent à rien : un projet
-- vivant n'en porte pas l'équivalent mesuré. Pour qu'une demande et un
-- projet tiennent sur la MÊME liste, la demande doit parler dans les
-- mêmes unités que le projet — un montant, une confiance, une
-- probabilité × un impact, des ETP :
--
--   expected_benefit  ce que le demandeur dit que ça rapporte par an, en
--                     unités entières comme partout ailleurs (F-07).
--                     `benefit_note` reste ce qu'il est — des MOTS — et
--                     transformer des mots en nombre serait exactement la
--                     fabrication que la REQ-33 a fermée.
--   value_confidence  1 à 5, la confiance dans CE chiffre-là. Nulle par
--                     défaut, et nulle veut dire « personne ne l'a dite »,
--                     jamais « moyenne ».
--   est_fte           les gens que ça prendra, en équivalents temps plein
--                     moyens. C'est l'unité des affectations, donc la
--                     seule qui se compare au vivier.
--   raid_probability  la pire chose que le demandeur attend, sur l'échelle
--   raid_impact       du registre RAID (1–5 × 1–5), pour que
--                     `Engine.exposure` soit LA définition de l'exposition
--                     des deux côtés de la liste et non deux définitions
--                     qui divergeront à la première correction.
--
-- Et la même confiance sur le cas d'affaire, pour le projet :
--
--   business_case.value_confidence   le bénéfice attendu de la 028 dit
--                     COMBIEN ; il ne dit pas à quel point on y croit. Un
--                     bénéfice de 12 M€ auquel personne ne tient et un
--                     bénéfice de 8 M€ qu'on signerait ne sont pas la même
--                     proposition, et aucun calcul ne peut trouver la
--                     différence — elle se saisit, ou elle est absente.
--
-- ── 2 · LA PONDÉRATION EST UNE DÉCISION, DONC UN ENREGISTREMENT ────
--
-- Une pondération que personne ne voit est l'opinion d'un fournisseur
-- présentée comme de l'arithmétique. Elle vit donc dans une ligne, avec
-- son `row_version` comme toute ligne modifiable, et chaque changement
-- passe par `audited()` — la piste dit ce que le poids VALAIT et ce qu'il
-- est DEVENU.
--
-- Une seule ligne, pour tout le groupe (`id = 'default'`), et c'est la
-- décision de conception : une pondération par programme laisserait
-- chaque programme régler les poids qui font remonter ses propres
-- projets au-dessus de la ligne. La liste est par programme ; l'ordre est
-- celui du groupe. Le niveau qui pose la pondération est celui qui répond
-- de la coupe qu'elle trace (shared/rbac.js, `priority.weighting`).
--
-- `set_on` NULL est porteur de sens : personne dans ce groupe n'a jamais
-- regardé ces poids, ce sont ceux que le logiciel a livrés — et l'écran
-- le dit au lieu de laisser croire à un arbitrage qui n'a pas eu lieu.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · la demande parle dans les unités du portefeuille ────────────
ALTER TABLE demand ADD COLUMN expected_benefit numeric(16,2);
ALTER TABLE demand ADD COLUMN value_confidence integer
  CHECK (value_confidence BETWEEN 1 AND 5);
ALTER TABLE demand ADD COLUMN est_fte numeric(8,3)
  CHECK (est_fte IS NULL OR est_fte >= 0);
ALTER TABLE demand ADD COLUMN raid_probability integer
  CHECK (raid_probability BETWEEN 1 AND 5);
ALTER TABLE demand ADD COLUMN raid_impact integer
  CHECK (raid_impact BETWEEN 1 AND 5);

-- ── … et le cas d'affaire dit à quel point on croit à son chiffre ───
ALTER TABLE business_case ADD COLUMN value_confidence integer
  CHECK (value_confidence BETWEEN 1 AND 5);

-- ── 2 · la pondération, une ligne, versionnée et auditée ────────────
CREATE TABLE prioritisation_weighting (
  id               text PRIMARY KEY,
  -- Les quatre poids. Bornés à 0–100 pièce ; c'est leur SOMME qui
  -- normalise, si bien que 40/20/20/20 et 4/2/2/2 sont la même
  -- pondération et qu'aucun écran n'a à faire l'addition pour le lecteur.
  w_value          integer NOT NULL DEFAULT 40 CHECK (w_value      BETWEEN 0 AND 100),
  w_confidence     integer NOT NULL DEFAULT 20 CHECK (w_confidence BETWEEN 0 AND 100),
  w_exposure       integer NOT NULL DEFAULT 20 CHECK (w_exposure   BETWEEN 0 AND 100),
  w_capacity       integer NOT NULL DEFAULT 20 CHECK (w_capacity   BETWEEN 0 AND 100),
  -- Pourquoi ces poids-là. Lu des mois plus tard par quelqu'un qui
  -- conteste un rang : un arbitrage sans sa raison est un verdict.
  note             text NOT NULL DEFAULT '',
  set_by           text REFERENCES app_user(id) ON DELETE SET NULL,
  set_label        text NOT NULL DEFAULT '',
  -- NULL = jamais posée par une main humaine ; l'écran le dit.
  set_on           date,
  row_version      integer NOT NULL DEFAULT 1
);

-- La ligne du groupe existe dès la migration : sans elle il n'y aurait
-- pas d'ordre du tout, et un écran vide n'apprend rien à personne. Ce
-- qu'elle porte est déclaré non revu (`set_on` NULL) jusqu'à ce que
-- quelqu'un s'en saisisse.
INSERT INTO prioritisation_weighting (id) VALUES ('default');

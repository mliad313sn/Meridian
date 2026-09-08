-- ═══════════════════════════════════════════════════════════════════
-- 045 · CE SUR QUOI UNE LIGNE REPOSE, ET QUAND ELLE S'EST CLOSE
--        (REQ-13 · REQ-18 · REQ-19 — retour de terrain RT365, 3e tour)
--
-- L'intégrateur a RÉÉCRIT `meridian_sync.py` contre le contrat publié,
-- puis a MESURÉ ce qu'il ne pouvait toujours pas faire. Trois pertes
-- silencieuses, toutes du même genre : le serveur répondait 200 sur un
-- corps qu'il n'écrivait pas.
--
-- ── REQ-18 · une ligne de registre dit QUAND, et PAR QUI, elle s'est
--             close ──────────────────────────────────────────────────
--
-- Mesuré : « `status: Closed` répond 200 et se relit close pendant que
-- `closed_on` reste nul ». Il RESTAIT nul parce qu'il n'existait pas :
-- `project.closed_on` existe depuis la 032, `raid_item` n'a jamais rien
-- eu. Une clôture sans date n'est pas une clôture — c'est un état
-- courant sans histoire, et le jour où un auditeur demande « quand ce
-- risque a-t-il été levé, et sur la parole de qui », le registre répond
-- « il est clos », ce qui n'est pas la question.
--
-- Les colonnes sont NULLABLES et RIEN N'EST RÉTRO-DATÉ. Les lignes déjà
-- closes le sont sans date connue : écrire `opened_on`, ou la date de la
-- migration, inventerait une histoire que personne n'a vécue. Nul veut
-- dire « close avant que nous sachions le noter », et c'est une réponse
-- honnête ; une date fausse n'en est pas une.
--
-- `closed_by` désigne une PERSONNE de l'annuaire, comme `accepted_by`
-- d'un jalon (032) : ce qui compte est le nom qui reste, pas le compte
-- qui a poussé le bouton — la piste d'audit porte déjà le second.
--
-- ── REQ-13 · une catégorie libre sur une ligne de registre ──────────
--
-- Impliquée par `scripts/meridian_sync.py#RAID_KIND` : leur registre
-- classe ses lignes autrement que par les quatre genres RAID (`kind`
-- reste Risk/Issue/Assumption/Dependency, il est le contrat du moteur et
-- ne s'ouvre pas). `category` est LEUR mot, libre, à côté du nôtre — un
-- champ de tri qu'aucune arithmétique ne lit.
--
-- (La seconde moitié de REQ-13 — les actes humains permanents H-nn
-- modélisés en dépendances à date de revue — reste ouverte : c'est une
-- décision de modélisation, pas un champ.)
--
-- ── REQ-19 · une date de projet dit sur quoi elle repose ────────────
--
-- La 040 l'a fait pour le jalon (REQ-14, leur D-057) : une date est soit
-- un ENGAGEMENT, soit une POSITION sur la ligne du temps qui attend la
-- mesure qui la produira. RT365 dit que ses dates de fin de projet sont
-- des remplissages pour exactement la même raison que ses dates de
-- porte. Le projet reçoit donc les deux mêmes colonnes, avec la même
-- règle : la date reste OBLIGATOIRE (le moteur trace, trie et compare
-- avec elle, et une colonne nullable toucherait chaque écran) ; ce qui
-- s'ajoute est ce qu'elle VAUT. Les lignes existantes sont `committed` :
-- rien ne change pour elles.
--
-- Et avec elles les deux champs que le même tour a mesurés « acceptés et
-- perdus » sur un projet : le SPONSOR — la personne qui répond du cas
-- d'affaire, distincte du chef de projet qui répond de la livraison — et
-- les CRITÈRES D'ACCEPTATION du projet, qui disent d'avance ce que
-- « fini » voudra dire. Le jalon a les siens depuis la 032 ; le projet
-- se clôturait sur trois signatures (PM-08) sans qu'aucune phrase n'ait
-- jamais été posée pour dire ce qu'elles constataient.
--
-- Le sponsor est une PERSONNE, comme `pm_id`, et non le texte libre que
-- `programme.sponsor` porte : sur un programme le sponsor est un rôle
-- exécutif nommé une fois pour toutes ; sur un projet c'est quelqu'un
-- qu'on appelle, et un nom qui ne résout pas dans l'annuaire n'est pas
-- une responsabilité, c'est une chaîne de caractères.
-- ═══════════════════════════════════════════════════════════════════

-- ── REQ-18 · la clôture d'une ligne de registre ─────────────────────
ALTER TABLE raid_item ADD COLUMN closed_on date;
ALTER TABLE raid_item ADD COLUMN closed_by text
  REFERENCES person(id) ON DELETE SET NULL;

COMMENT ON COLUMN raid_item.closed_on IS
  'The date this item was closed. NULL on a row closed before 045 — unknown, never back-dated (REQ-18).';

-- ── REQ-13 · le mot du système source, à côté du nôtre ──────────────
ALTER TABLE raid_item ADD COLUMN category text NOT NULL DEFAULT '';

COMMENT ON COLUMN raid_item.category IS
  'A free classification label from whoever keeps this register. kind stays the RAID contract the engine reads (REQ-13).';

-- ── REQ-19 · ce sur quoi la date de fin d''un projet repose ─────────
ALTER TABLE project ADD COLUMN date_basis text NOT NULL DEFAULT 'committed'
  CHECK (date_basis IN ('committed','placeholder'));
ALTER TABLE project ADD COLUMN condition text NOT NULL DEFAULT '';

COMMENT ON COLUMN project.date_basis IS
  'committed: the finish date is a promise. placeholder: a position on the timeline, never reported late or missed until the condition is measured (REQ-19, after 040).';

-- ── REQ-19 · qui répond du cas d''affaire, et ce que « fini » veut dire
ALTER TABLE project ADD COLUMN sponsor_id text
  REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE project ADD COLUMN acceptance_criteria text NOT NULL DEFAULT '';

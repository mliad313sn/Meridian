-- ═══════════════════════════════════════════════════════════════════
-- 034 · UN MODÈLE DE JALONS QUI SE CONFIGURE, ET LE REGISTRE
--       D'EXIGENCES QUI MANQUAIT  (MER-01, MER-03)
--
-- Deux constats venus d'un vrai portefeuille — KODO, un produit
-- éducatif à six jalons qui BOUCLENT — que Meridian ne pouvait
-- représenter ni l'un ni l'autre.
--
-- ── 1. Le modèle de jalons était une constante ────────────────────
--
-- `shared/engine.js` définissait quatre jalons en dur. Un portefeuille
-- qui en a six les écrase donc sur quatre, et les deux qui BLOQUENT
-- réellement une sortie deviennent de simples jalons de calendrier :
-- le verrouillage de jalon et la preuve de jalon ne s'y appliquent
-- plus. L'outil disait « porte franchie » d'une porte qui n'existait
-- pas dans le produit qu'il suivait.
--
-- Le modèle vit maintenant dans `app_setting.gates`. Absent, on garde
-- exactement les quatre d'origine : aucun portefeuille existant ne
-- change de comportement. C'est le même choix que `documentHosts` —
-- un réglage, pas une constante — sauf qu'ici le défaut est ouvert
-- plutôt que fermé, parce qu'un portefeuille sans modèle de jalons
-- déclaré n'est pas un portefeuille dangereux, juste un portefeuille
-- ordinaire.
--
-- ── 2. Les jalons peuvent boucler ─────────────────────────────────
--
-- Une revue qui renvoie au cahier des charges est un cycle
-- d'amélioration, pas un échec. KODO le fait trois fois avant
-- lancement. Sans numéro de tour, le jalon 1 du deuxième tour est
-- « déjà franchi » par la preuve du premier — et la deuxième revue
-- s'ouvre en se croyant terminée.
--
-- `project.gate_loop` porte le tour courant. Les preuves et les jalons
-- portent le leur. Tout ce qui existe est au tour 1 : la colonne a un
-- défaut, et rien à migrer.
--
-- ── 3. Une exigence n'existait nulle part ─────────────────────────
--
-- C'est le plus gros manque et c'était le plus visible : KODO suit 136
-- exigences, chacune avec une méthode de vérification et une barrière
-- d'intégration continue qui casse la construction si l'une se dit
-- « terminée » sans test qui la nomme. Rien de tout cela n'entrait
-- dans Meridian. Un portefeuille d'exigences devait donc être tenu
-- À CÔTÉ de l'outil de portefeuille — ce qui est exactement la
-- situation que le produit existe pour supprimer.
--
-- Décision de conception : `verification` et `verified_by` sont deux
-- colonnes distinctes. La première est la MÉTHODE promise, la seconde
-- la PREUVE produite. Les confondre est la façon dont une exigence se
-- déclare vérifiée parce que quelqu'un a écrit comment elle le serait.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 & 2 · le tour de boucle ─────────────────────────────────────
ALTER TABLE project   ADD COLUMN IF NOT EXISTS gate_loop integer NOT NULL DEFAULT 1
                      CHECK (gate_loop >= 1);
ALTER TABLE milestone ADD COLUMN IF NOT EXISTS gate_loop integer NOT NULL DEFAULT 1
                      CHECK (gate_loop >= 1);
ALTER TABLE document  ADD COLUMN IF NOT EXISTS gate_loop integer NOT NULL DEFAULT 1
                      CHECK (gate_loop >= 1);

-- Le CHECK « BETWEEN 1 AND 4 » de 024 et 028 contredit désormais un
-- modèle configurable : un portefeuille à six jalons ne peut pas
-- enregistrer un enseignement relevé au jalon 5. On garde une borne
-- basse — un numéro de jalon est positif — et on retire le plafond.
ALTER TABLE lesson        DROP CONSTRAINT IF EXISTS lesson_gate_n_check;
ALTER TABLE lesson        ADD  CONSTRAINT lesson_gate_n_check
                          CHECK (gate_n IS NULL OR gate_n >= 1);
ALTER TABLE business_case DROP CONSTRAINT IF EXISTS business_case_reconfirmed_gate_check;
ALTER TABLE business_case ADD  CONSTRAINT business_case_reconfirmed_gate_check
                          CHECK (reconfirmed_gate IS NULL OR reconfirmed_gate >= 1);

-- ── 3 · le registre d'exigences ───────────────────────────────────
CREATE TABLE IF NOT EXISTS requirement (
  id            text PRIMARY KEY,

  -- Une exigence appartient au projet qui doit la tenir. ON DELETE
  -- CASCADE, contrairement à `lesson` : un enseignement survit à son
  -- projet parce qu'il vaut pour les autres ; une exigence d'un projet
  -- supprimé n'a plus personne pour la tenir.
  project_id    text REFERENCES project(id) ON DELETE CASCADE,

  -- Ce qu'elle demande, et d'où elle vient. `source` porte la
  -- traçabilité amont — un article de contrat, une clause
  -- réglementaire, une décision — sans quoi une exigence est une
  -- opinion bien rangée.
  statement     text NOT NULL,
  source        text NOT NULL DEFAULT '',

  -- MoSCoW. Le défaut est « Must » : une exigence entrée sans priorité
  -- est traitée comme obligatoire jusqu'à ce que quelqu'un la
  -- déclasse EXPRÈS, plutôt que l'inverse.
  priority      text NOT NULL DEFAULT 'M' CHECK (priority IN ('M','S','C','W')),

  -- La méthode promise, puis la preuve produite. Voir l'en-tête.
  verification  text NOT NULL DEFAULT '',
  verified_by   text NOT NULL DEFAULT '',

  -- Le jalon auquel elle doit être tenue. Pas de plafond : le modèle
  -- est configurable.
  gate_n        integer CHECK (gate_n IS NULL OR gate_n >= 1),

  status        text NOT NULL DEFAULT 'Not started'
                CHECK (status IN ('Not started','In progress','Done','Waived')),
  -- Une dérogation SE MOTIVE. Un statut « Waived » sans raison est la
  -- façon dont une exigence disparaît sans que personne l'ait décidé,
  -- et la contrainte ci-dessous le rend impossible.
  waiver_reason text NOT NULL DEFAULT '',
  owner_id      text REFERENCES person(id) ON DELETE SET NULL,
  updated_on    date NOT NULL DEFAULT CURRENT_DATE,
  row_version   integer NOT NULL DEFAULT 1,

  CONSTRAINT requirement_waiver_needs_reason
    CHECK (status <> 'Waived' OR length(trim(waiver_reason)) > 0)
);

CREATE INDEX IF NOT EXISTS requirement_project_idx ON requirement (project_id);
CREATE INDEX IF NOT EXISTS requirement_gate_idx    ON requirement (gate_n);

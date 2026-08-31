-- ═══════════════════════════════════════════════════════════════════
-- 028 · LE CAS D'AFFAIRE, TENU COMME UN ENREGISTREMENT  (PM-03)
--
-- La chaîne demande → cas d'affaire → bénéfice → revue était rompue en
-- son milieu. La demande existe (011 : qui veut quoi, pourquoi, décidé
-- par qui). Les bénéfices existent (008 : promis, mesurés, jugés). Entre
-- les deux, le cas d'affaire n'existait que comme TYPE DE DOCUMENT — un
-- nom de fichier et un statut, aucun chiffre, aucune reconfirmation.
--
-- Or la question que PRINCE2 pose en principe premier — « la
-- justification tient-elle ENCORE ? » — ne se pose pas à l'approbation :
-- elle se pose à chaque jalon, quand le coût a bougé et que le bénéfice
-- attendu a vieilli. Un cas d'affaire qu'on ne peut pas relire ni
-- reconfirmer n'est pas une justification continue, c'est un souvenir.
--
-- ── Décisions de conception ────────────────────────────────────────
--
-- Un cas par projet (UNIQUE) : deux justifications concurrentes pour le
-- même argent est précisément ce que ce registre existe pour empêcher.
-- Les corrections passent par updateVersioned + images d'audit — le
-- CONTENU du cas évolue, l'histoire est dans la piste.
--
-- La reconfirmation est un ACTE distinct de la modification : elle
-- répond « oui, cela vaut encore la peine, au jalon N, tel jour, signé
-- untel » — et elle est bloquée si le cas a été modifié après elle
-- (l'écran le montre : reconfirmé au jalon 2, modifié depuis).
--
-- Les montants sont en unités entières de la devise de restitution,
-- comme partout (F-07) : l'interface divise par 1e6.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE business_case (
  id               text PRIMARY KEY,
  project_id       text NOT NULL UNIQUE REFERENCES project(id) ON DELETE CASCADE,

  -- La justification, dans les mots de celui qui paie — pas un plan.
  summary          text NOT NULL,
  -- Ce que ça coûtera et ce que ça doit rapporter par an, au moment où
  -- le cas est écrit. Le réalisé vit ailleurs (ledger, benefit) ; ici
  -- vit la PROMESSE, pour qu'on puisse un jour les confronter.
  expected_cost    numeric(16,2),
  expected_benefit numeric(16,2),
  -- Sur quoi les chiffres reposent. Un chiffre sans base se discute ;
  -- un chiffre avec sa base se vérifie.
  basis            text NOT NULL DEFAULT '',

  written_by       text REFERENCES app_user(id) ON DELETE SET NULL,
  written_on       date NOT NULL DEFAULT CURRENT_DATE,
  updated_on       date,

  -- La dernière reconfirmation : au jalon N, tel jour, par untel.
  reconfirmed_gate integer CHECK (reconfirmed_gate BETWEEN 1 AND 4),
  reconfirmed_on   date,
  reconfirmed_by   text REFERENCES app_user(id) ON DELETE SET NULL,

  row_version      integer NOT NULL DEFAULT 1
);

CREATE INDEX business_case_project_idx ON business_case(project_id);

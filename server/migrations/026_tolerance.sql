-- ═══════════════════════════════════════════════════════════════════
-- 026 · TOLÉRANCES ET GESTION PAR EXCEPTION  (PM-01)
--
-- Le plus gros manque de gouvernance du produit, et le plus discret :
-- l'autorité était déléguée **sans borne**.
--
-- Meridian savait dire qu'un projet virait à l'orange. Il ne savait pas
-- dire qu'il avait franchi une limite que quelqu'un avait fixée. La
-- différence n'est pas sémantique : dans le premier cas, il faut que
-- quelqu'un remarque et décide de faire remonter ; dans le second, le
-- dépassement remonte tout seul, à celui qui a posé la limite, et il
-- doit y répondre.
--
-- C'est le mécanisme de PRINCE2 (« Progress ») et d'ISO 21502 §6.5, et
-- c'est ce qui rend une délégation SÛRE : le comité de pilotage n'a pas
-- besoin de tout regarder, il a besoin qu'on le prévienne quand la marge
-- qu'il a accordée est sur le point d'être dépassée. Sans tolérance,
-- déléguer c'est espérer.
--
-- ── Ce qui est mesurable, et ce qui ne l'est pas ───────────────────
--
-- PRINCE2 pose six dimensions de tolérance. Trois se calculent ici sur
-- des nombres que le moteur produit déjà, et sont donc surveillées :
--
--   délai     la fin PRÉVUE contre la ligne de référence (jours)
--   coût      le coût final estimé contre le budget (%)
--   bénéfice  l'atteinte prévue contre la cible (points)
--
-- Trois ne se calculent pas : périmètre, qualité, risque. Elles sont
-- écrites en toutes lettres dans `note`, et ce n'est pas un pis-aller :
-- une tolérance de périmètre qu'un algorithme prétendrait mesurer serait
-- une fausse assurance. Ce qui est surveillé le dit ; ce qui ne l'est pas
-- le dit aussi.
--
-- ── Qui pose la borne ──────────────────────────────────────────────
--
-- Le niveau AU-DESSUS. `tolerance.set` est une écriture de niveau groupe
-- (voir rbac.js) : un chef de site ne fixe pas sa propre marge, sans quoi
-- ce n'est plus une tolérance, c'est une intention. Même raisonnement que
-- la revue de bénéfice et la clôture de période.
--
-- Une seule tolérance active par projet ; en poser une nouvelle
-- désactive la précédente plutôt que de l'écraser, pour qu'on puisse
-- lire plus tard sous quelle marge une décision a été prise.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE project_tolerance (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES project(id) ON DELETE CASCADE,

  -- NULL = cette dimension n'est pas bornée. Zéro = aucune marge, ce qui
  -- est une décision très différente et doit rester dicible.
  schedule_days integer CHECK (schedule_days IS NULL OR schedule_days >= 0),
  cost_pct      numeric(6,2) CHECK (cost_pct IS NULL OR cost_pct >= 0),
  benefit_pct   numeric(6,2) CHECK (benefit_pct IS NULL OR benefit_pct >= 0),
  -- Périmètre, qualité, risque : énoncés, jamais calculés.
  note          text NOT NULL DEFAULT '',

  set_by        text REFERENCES app_user(id) ON DELETE SET NULL,
  set_on        date NOT NULL DEFAULT CURRENT_DATE,
  active        boolean NOT NULL DEFAULT true,
  row_version   integer NOT NULL DEFAULT 1
);

CREATE INDEX tolerance_project_idx ON project_tolerance(project_id, active);

-- ── l'exception ────────────────────────────────────────────────────
--
-- Elle n'est pas levée par une personne : elle est CONSTATÉE par le
-- balayage horaire, sur les mêmes chiffres que l'écran. Personne ne
-- décide de faire remonter, et c'est tout l'intérêt — ce qui dépend d'un
-- porteur de mauvaise nouvelle ne remonte pas.
--
-- Elle se ferme par une RÉPONSE, jamais par une disparition : la
-- prévision peut repasser sous la limite d'elle-même, et l'exception
-- reste ouverte jusqu'à ce que quelqu'un dise ce qu'il en a fait. Un
-- dépassement qui s'efface tout seul n'a jamais eu lieu, et c'est
-- exactement ce qu'un comité ne doit pas pouvoir oublier.

CREATE TABLE project_exception (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  tolerance_id text REFERENCES project_tolerance(id) ON DELETE SET NULL,

  dimension    text NOT NULL CHECK (dimension IN ('schedule','cost','benefit')),
  raised_on    date NOT NULL DEFAULT CURRENT_DATE,
  -- Ce qui a été mesuré, et ce qui était permis : une exception qui ne
  -- porte pas ses deux nombres ne se relit pas.
  measured     numeric(12,2) NOT NULL,
  allowed      numeric(12,2) NOT NULL,
  detail       text NOT NULL DEFAULT '',

  status       text NOT NULL DEFAULT 'Open'
               CHECK (status IN ('Open','Answered','Withdrawn')),
  -- Les quatre réponses que PRINCE2 laisse au niveau qui a délégué.
  answer_kind  text CHECK (answer_kind IN
                 ('Tolerance raised','Plan revised','Accepted','Stopped')),
  answer       text NOT NULL DEFAULT '',
  answered_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  answered_on  date,

  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX exception_project_idx ON project_exception(project_id, status);
CREATE INDEX exception_open_idx    ON project_exception(status, raised_on DESC);
-- Une seule exception ouverte par projet et par dimension : le balayage
-- passe toutes les heures et ne doit pas empiler cent fois le même
-- dépassement. La contrainte le garantit à la base, pas dans le code.
CREATE UNIQUE INDEX exception_one_open_idx
  ON project_exception(project_id, dimension)
  WHERE status = 'Open';

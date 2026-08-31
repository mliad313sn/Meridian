-- ═══════════════════════════════════════════════════════════════════
-- 024 · LE REGISTRE DES ENSEIGNEMENTS  (PM-02)
--
-- Le modèle de jalons du produit exige, au jalon 4, la preuve
-- « Realisation report, lessons learned » — et le produit n'avait aucun
-- endroit où mettre un enseignement (`shared/engine.js:80`). Le jalon
-- réclamait une pièce que le schéma rendait impossible à fournir : ce
-- n'était pas un manque parmi d'autres, c'était une contradiction du
-- produit avec lui-même.
--
-- ISO 21502 §7.17 et le principe PRINCE2 « apprendre de l'expérience »
-- demandent la même chose, et pour la raison que huit sites connaissent
-- bien : sans registre, la même erreur se paie une fois par site.
--
-- ── Deux décisions de conception, et pourquoi ──────────────────────
--
-- 1. `project_id ON DELETE SET NULL`. Un enseignement doit SURVIVRE au
--    projet qui l'a produit — c'est même sa seule raison d'être. Le
--    programme et le site sont donc copiés à la saisie plutôt que lus
--    par jointure : le jour où le projet disparaît, l'enseignement reste
--    classable. Même raisonnement que `report_snapshot.project_id`, qui
--    n'est délibérément pas une clé étrangère.
--
-- 2. Un enseignement est PROPOSÉ par qui l'a vécu, et ADOPTÉ par le
--    niveau groupe. Ce n'est pas de la bureaucratie : c'est exactement
--    la thèse du produit appliquée à la connaissance. Un site constate,
--    le groupe décide que cela vaut pour tout le portefeuille. Et
--    l'adoption est ce qui rend l'enseignement visible aux AUTRES sites,
--    sans quoi un registre par site n'apprend rien à personne.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE lesson (
  id             text PRIMARY KEY,

  -- D'où il vient. Le projet peut disparaître ; le reste tient.
  project_id     text REFERENCES project(id)   ON DELETE SET NULL,
  programme_id   text REFERENCES programme(id) ON DELETE SET NULL,
  site_id        text REFERENCES site(id)      ON DELETE SET NULL,
  -- Le jalon où il a été relevé ; NULL = à la clôture ou hors jalon.
  gate_n         integer CHECK (gate_n BETWEEN 1 AND 4),

  -- Ce qu'il dit. Les trois champs sont séparés à dessein : un registre
  -- où « ce qui s'est passé » et « ce qu'il faut faire » se mélangent
  -- dans une seule case produit des anecdotes, pas des enseignements.
  category       text NOT NULL DEFAULT 'Governance'
                 CHECK (category IN ('Scope','Schedule','Cost','Risk','Quality',
                                     'Resources','Stakeholders','Procurement',
                                     'Governance','Technical','Transition')),
  title          text NOT NULL,
  what_happened  text NOT NULL DEFAULT '',
  why            text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '',
  -- Ce qui a MARCHÉ vaut d'être consigné autant que ce qui a raté ; un
  -- registre qui ne retient que les échecs n'est jamais relu.
  outcome        text NOT NULL DEFAULT 'Negative'
                 CHECK (outcome IN ('Positive','Negative')),

  raised_by      text REFERENCES person(id) ON DELETE SET NULL,
  raised_on      date NOT NULL DEFAULT CURRENT_DATE,

  -- Proposé → Adopté (visible partout) → Archivé (plus proposé aux
  -- nouveaux projets, mais jamais effacé : c'est un fait daté).
  status         text NOT NULL DEFAULT 'Proposed'
                 CHECK (status IN ('Proposed','Adopted','Archived')),
  adopted_by     text REFERENCES app_user(id) ON DELETE SET NULL,
  adopted_on     date,

  row_version    integer NOT NULL DEFAULT 1
);

CREATE INDEX lesson_project_idx   ON lesson(project_id);
CREATE INDEX lesson_status_idx    ON lesson(status);
-- La requête qui compte : « qu'a-t-on appris qui vaille pour CE projet »,
-- posée par programme et par site au démarrage d'un nouveau projet.
CREATE INDEX lesson_relevance_idx ON lesson(status, programme_id, site_id);

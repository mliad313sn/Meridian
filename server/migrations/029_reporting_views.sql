-- ═══════════════════════════════════════════════════════════════════
-- 029 · LES VUES DE RESTITUTION  (INT-05)
--
-- Power BI, Excel, Tableau et Qlik parlent tous PostgreSQL nativement :
-- le branchement décisionnel le moins cher et le plus utile qui existe
-- ne demande AUCUN connecteur — il demande un contrat. Jusqu'ici, un
-- analyste devait lire vingt-huit migrations pour trouver ses colonnes,
-- et son classeur cassait à la première évolution du schéma.
--
-- Le schéma `reporting` est ce contrat : des vues en LECTURE dont les
-- noms et colonnes sont STABLES. Les tables sous-jacentes évoluent ; les
-- vues absorbent. Casser une colonne de `reporting.*` est un changement
-- MAJEUR au sens du CHANGELOG — un exploitant doit être prévenu.
--
-- ── Ce que ces vues ne font pas, et pourquoi ───────────────────────
--
-- Elles n'exposent AUCUN nombre de valeur acquise (VA, IPC, CFE…).
-- Cette arithmétique vit dans `shared/engine.js`, gelée en comportement ;
-- la réécrire en SQL créerait une seconde vérité qui divergerait à la
-- première correction. Un tableau de bord qui veut l'EVM lit
-- `/api/v1/portfolio`, qui sort du même sérialiseur que l'écran.
--
-- Elles n'exposent ni comptes, ni sessions, ni clés, ni la piste brute
-- avec ses images avant/après (before_json peut contenir ce qu'une ligne
-- effacée contenait). La piste décisionnelle passe par sa portée d'API
-- (`read:audit`), qui se révoque ; une vue SQL ne se révoque pas à la clé.
--
-- L'argent est en UNITÉS ENTIÈRES de la devise de restitution, comme en
-- base (F-07). C'est aux outils décisionnels de formater — un million
-- divisé deux fois est le genre de défaut qu'on met six mois à voir.
--
-- ── L'accès ────────────────────────────────────────────────────────
--
-- Un rôle de lecture se crée au niveau du cluster, pas d'une migration
-- (elle se rejouerait sur PGlite où les rôles n'ont pas de sens, et un
-- CREATE ROLE échoue s'il existe). La recette, à exécuter une fois par
-- l'exploitant sur l'instance PostgreSQL :
--
--   CREATE ROLE reporting_reader LOGIN PASSWORD '…';
--   GRANT USAGE ON SCHEMA reporting TO reporting_reader;
--   GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO reporting_reader;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA reporting
--     GRANT SELECT ON TABLES TO reporting_reader;
--
-- Documentation colonne par colonne : docs/30-vues-restitution.md.
-- ═══════════════════════════════════════════════════════════════════

CREATE SCHEMA reporting;

CREATE VIEW reporting.sites AS
  SELECT id, city, region, country, legal_entity, tz_name, headcount, fte, active
    FROM site;

CREATE VIEW reporting.programmes AS
  SELECT id, name, sponsor, active FROM programme;

CREATE VIEW reporting.projects AS
  SELECT p.id, p.name, p.programme_id, p.site_id, p.governance_level,
         p.method, p.phase, p.gate, p.start_date, p.finish_date,
         p.baseline_finish, p.budget, p.contingency, p.contingency_used,
         p.health_override, p.closed, p.pir_on, p.pir_verdict
    FROM project p;

CREATE VIEW reporting.milestones AS
  SELECT id, project_id, name, kind, gate, due_date, base_date, done
    FROM milestone;

CREATE VIEW reporting.risks AS
  SELECT id, project_id, kind, title, probability, impact, status,
         response, owner_id, opened_on, review_on, origin_site
    FROM raid_item;

CREATE VIEW reporting.cost_lines AS
  SELECT id, project_id, period, booked_on, amount, category,
         from_contingency, kind, currency, fx_rate, amount_local
    FROM cost_line;

CREATE VIEW reporting.commitments AS
  SELECT id, project_id, reference, supplier, amount, currency, fx_rate,
         kind, raised_on, expected_on, status
    FROM commitment;

CREATE VIEW reporting.benefits AS
  SELECT id, project_id, kind, title, measure, unit,
         baseline, target, actual, realise_on, measured_on, status
    FROM benefit;

CREATE VIEW reporting.timesheets AS
  SELECT id, project_id, person_id, week_start, days FROM timesheet;

CREATE VIEW reporting.lessons AS
  SELECT id, project_id, programme_id, site_id, gate_n, category, title,
         outcome, recommendation, status, raised_on, adopted_on
    FROM lesson;

CREATE VIEW reporting.tolerances AS
  SELECT id, project_id, schedule_days, cost_pct, benefit_pct,
         set_on, active
    FROM project_tolerance;

CREATE VIEW reporting.exceptions AS
  SELECT id, project_id, dimension, raised_on, measured, allowed,
         status, answer_kind, answered_on
    FROM project_exception;

CREATE VIEW reporting.business_cases AS
  SELECT id, project_id, expected_cost, expected_benefit,
         written_on, updated_on, reconfirmed_gate, reconfirmed_on
    FROM business_case;

-- Les décisions telles que le registre les publie déjà à l'écran : les
-- actions de gouvernance, sans les images avant/après ni les lectures.
-- Les libellés sont EXACTEMENT ceux que les routes écrivent — vérifiés
-- par grep avant d'écrire cette liste, puis tenus par un test qui rejoue
-- une décision et la relit dans la vue : un filtre sur un libellé
-- inventé ne renvoie pas d'erreur, il renvoie du vide, et un registre
-- vide inspire confiance en mentant par omission.
CREATE VIEW reporting.decisions AS
  SELECT id, at, user_label, action, entity, entity_id, detail
    FROM audit_event
   WHERE action IN ('Change request approved', 'Change request rejected',
                    'Phase advanced', 'Gate overridden', 'Project re-baselined',
                    'Exception answered', 'Business case reconfirmed',
                    'Post-implementation review recorded',
                    'Lesson adopted', 'Tolerance set');

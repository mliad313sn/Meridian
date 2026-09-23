-- ═══════════════════════════════════════════════════════════════════
-- 035 · CE QU'UNE REVUE PRODUIT, QUI A LE DROIT DE DIRE NON, ET CE
--       QU'UNE DÉCISION COÛTE À DÉFAIRE
--       (MER-05, MER-06, MER-07, MER-10, MER-11)
--
-- Cinq constats du même comité de recette. Ils ont l'air séparés ;
-- ils ne le sont pas. Tous les cinq disent la même chose : Meridian
-- sait tenir un PORTEFEUILLE et ne sait pas encore tenir une
-- GOUVERNANCE. Le portefeuille répond « où en est-on ». La
-- gouvernance répond « qui a décidé, sur quelle preuve, contre quel
-- avis, et que coûterait le retour en arrière ».
--
-- ── 1. Un constat de revue n'est ni un risque ni une leçon ────────
--
-- Un risque ne s'est pas produit : c'est pour cela qu'il a une
-- probabilité. Un constat de revue S'EST produit. Le ranger dans le
-- registre RAID oblige à lui inventer une probabilité — ce que nous
-- avons fait, faute de mieux, et c'est faux. Une leçon se tire d'un
-- travail fini ; un constat est ouvert, porté par quelqu'un, et
-- bloquant.
--
-- La contrainte qui compte est `finding_closed_needs_evidence` :
-- un constat ne peut pas passer à « Closed » sans pièce de preuve.
-- Pas une convention, pas une étape de processus — la base refuse
-- l'écriture. C'est le même geste que la piste d'audit inaltérable,
-- appliqué à la revue.
--
-- ── 2. La preuve n'est plus toujours un document ──────────────────
--
-- La preuve d'un module logiciel est une exécution d'intégration
-- continue, un rapport de traçabilité généré, une mesure de
-- performance écrite dans un fichier. Rien de cela n'est un
-- « document avec une révision et un propriétaire ». Forcer ces
-- pièces dans `document` produit des révisions « 0.1 » qui ne
-- veulent rien dire et un propriétaire qui n'a rien écrit.
--
-- `evidence` accepte les deux : soit elle pointe un `document`, soit
-- elle porte son propre type et son URI. Une seule règle — une pièce
-- de preuve a une source vérifiable et une date.
--
-- ── 3. L'autorité est une donnée — mais il en manquait deux tiers ─
--
-- `rbac.js` connaît quatre rôles d'ACCÈS. Une gouvernance réelle a
-- des SIÈGES : un domaine, parfois un veto, et surtout des
-- incompatibilités. Le comité KODO en a quatorze, dont trois avec
-- veto bloquant et une incompatibilité dure — le siège qui doit
-- pouvoir refuser un mécanisme ne peut pas être tenu par la personne
-- qui l'a conçu. C'est la séparation des devoirs, et c'est la
-- première question de tout auditeur externe.
--
-- `seat_conflict` refuse une personne qui tiendrait deux sièges
-- incompatibles. La contrainte est dans la base, donc elle tient même
-- quand personne ne regarde.
--
-- ── 4. Une décision sans objection ni coût de retour ──────────────
--
-- `meeting_decision` avait `rationale`, soit 60 % du chemin et les
-- 60 % difficiles. Manquaient :
--
--   · l'objection — sans registre de dissensions, on ne peut pas
--     mener une gouvernance par consentement, ni siéger dans un
--     conseil qui consigne les positions minoritaires ;
--   · l'horloge d'escalade — « non résolu sous une semaine ouvrée »
--     est exactement ce qu'un outil doit pousser sur un ordre du
--     jour, et le moteur sait déjà le faire pour les actions ;
--   · le COÛT DE RETOUR. C'est la colonne pour laquelle il faut se
--     battre. Publier une banque d'items sous licence libre est
--     irréversible ; retirer une galerie publique du périmètre ne
--     l'est pas. Dans un outil qui ne consigne qu'une justification,
--     ces deux décisions se ressemblent. Elles n'ont rien à voir ;
--   · la supersession — sans elle la piste dit ce qui a été décidé,
--     jamais ce qui est vrai aujourd'hui.
--
-- ── 5. Une gouvernance n'est ni hebdomadaire ni mensuelle ─────────
--
-- Elle est déclenchée par un jalon. `per_gate` et `ad_hoc`
-- rejoignent la cadence, et une série peut se lier à un numéro de
-- jalon : le générateur d'ordre du jour — la meilleure chose de ce
-- produit — peut alors composer l'ordre du jour d'une revue de jalon
-- à partir des preuves manquantes, ce qui est la réunion la plus
-- utile qu'un bureau de projets tienne et la seule encore montée à
-- la main dans un jeu de diapositives.
-- ═══════════════════════════════════════════════════════════════════

-- ── 2 · la preuve, document ou non (MER-11) ───────────────────────
CREATE TABLE IF NOT EXISTS evidence (
  id           text PRIMARY KEY,
  project_id   text REFERENCES project(id)  ON DELETE CASCADE,
  -- Soit un document du registre, soit une pièce d'un autre genre.
  document_id  text REFERENCES document(id) ON DELETE SET NULL,
  kind         text NOT NULL DEFAULT 'document'
               CHECK (kind IN ('document','ci_run','test_report','measurement',
                               'dataset','recording','sign_off','external')),
  name         text NOT NULL,
  uri          text NOT NULL DEFAULT '',
  digest       text NOT NULL DEFAULT '',
  gate_n       integer,
  gate_loop    integer NOT NULL DEFAULT 1 CHECK (gate_loop >= 1),
  captured_on  date NOT NULL,
  captured_by  text REFERENCES person(id) ON DELETE SET NULL,
  -- Une pièce de preuve a une source vérifiable : un document du
  -- registre, ou une adresse. Une preuve sans l'une ni l'autre est une
  -- affirmation.
  CONSTRAINT evidence_has_a_source
    CHECK (document_id IS NOT NULL OR uri <> '')
);
CREATE INDEX IF NOT EXISTS evidence_project_idx ON evidence(project_id);
CREATE INDEX IF NOT EXISTS evidence_gate_idx    ON evidence(gate_n, gate_loop);

-- ── 1 · le constat de revue (MER-05) ──────────────────────────────
CREATE TABLE IF NOT EXISTS finding (
  id             text PRIMARY KEY,
  project_id     text REFERENCES project(id)     ON DELETE CASCADE,
  requirement_id text REFERENCES requirement(id) ON DELETE SET NULL,
  gate_n         integer,
  gate_loop      integer NOT NULL DEFAULT 1 CHECK (gate_loop >= 1),
  -- Le FAIT observé et la CONSÉQUENCE sont deux colonnes. Les
  -- confondre est la façon dont un constat devient une opinion.
  observed_fact  text NOT NULL,
  why_it_matters text NOT NULL DEFAULT '',
  severity       text NOT NULL DEFAULT 'S3'
                 CHECK (severity IN ('S1','S2','S3','S4')),
  owner_id       text REFERENCES person(id) ON DELETE SET NULL,
  proposed_fix   text NOT NULL DEFAULT '',
  raised_on      date NOT NULL,
  retest_on      date,
  status         text NOT NULL DEFAULT 'Open'
                 CHECK (status IN ('Open','In progress','Re-test','Closed','Waived')),
  closed_evidence_id text REFERENCES evidence(id) ON DELETE RESTRICT,
  waiver_reason  text NOT NULL DEFAULT '',
  -- LA contrainte. Un constat se ferme sur une preuve de re-test,
  -- jamais sur un correctif fusionné : « c'est corrigé » est une
  -- intention, « voici la re-exécution qui le montre » est un fait.
  CONSTRAINT finding_closed_needs_evidence
    CHECK (status <> 'Closed' OR closed_evidence_id IS NOT NULL),
  -- Et une dérogation dit pourquoi, comme la dérogation d'exigence
  -- de la migration 034.
  CONSTRAINT finding_waiver_needs_reason
    CHECK (status <> 'Waived' OR waiver_reason <> '')
);
CREATE INDEX IF NOT EXISTS finding_project_idx ON finding(project_id);
CREATE INDEX IF NOT EXISTS finding_status_idx  ON finding(status);

-- Un élément de travail vient de quelque part et vaut un score. Les
-- deux se perdaient à l'import, qui n'en gardait qu'une lettre de
-- priorité.
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS source       text NOT NULL DEFAULT '';
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS score        numeric;
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS score_method text NOT NULL DEFAULT '';
-- Un score sans méthode déclarée est un chiffre sans unité : on ne
-- peut ni le comparer ni le refaire.
ALTER TABLE work_item DROP CONSTRAINT IF EXISTS work_item_score_needs_method;
ALTER TABLE work_item ADD  CONSTRAINT work_item_score_needs_method
  CHECK (score IS NULL OR score_method <> '');

-- ── 3 · les sièges et les vetos (MER-06) ──────────────────────────
CREATE TABLE IF NOT EXISTS seat (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  person_id   text REFERENCES person(id) ON DELETE SET NULL,
  domain      text NOT NULL DEFAULT '',
  -- Un veto porte sur un DOMAINE, jamais sur tout : un siège qui peut
  -- tout bloquer n'est pas un siège, c'est une direction.
  veto_domain text,
  -- Voix sans vote. C'est un rôle de gouvernance réel, pas une
  -- absence, et la table des présences sait déjà modéliser `deputy`.
  observer    boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true
);

-- L'incompatibilité est une ARÊTE, pas une colonne : elle est
-- symétrique, et une colonne tableau laisse les deux moitiés diverger.
CREATE TABLE IF NOT EXISTS seat_conflict (
  seat_id  text NOT NULL REFERENCES seat(id) ON DELETE CASCADE,
  other_id text NOT NULL REFERENCES seat(id) ON DELETE CASCADE,
  reason   text NOT NULL DEFAULT '',
  PRIMARY KEY (seat_id, other_id),
  CONSTRAINT seat_conflict_not_self CHECK (seat_id <> other_id)
);

-- La séparation des devoirs, tenue par la base plutôt que par la
-- mémoire de quelqu'un : la même personne ne peut pas tenir deux
-- sièges déclarés incompatibles.
CREATE OR REPLACE FUNCTION seat_conflict_guard() RETURNS trigger AS $$
DECLARE clash text;
BEGIN
  IF NEW.person_id IS NULL THEN RETURN NEW; END IF;
  SELECT s.name INTO clash
    FROM seat_conflict c
    JOIN seat s ON s.id = c.other_id
   WHERE c.seat_id = NEW.id
     AND s.person_id = NEW.person_id
     AND s.id <> NEW.id
   LIMIT 1;
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION
      'Segregation of duties: this person already holds %, which cannot be combined with %',
      clash, NEW.name;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seat_conflict_trigger ON seat;
CREATE TRIGGER seat_conflict_trigger
  BEFORE INSERT OR UPDATE OF person_id ON seat
  FOR EACH ROW EXECUTE FUNCTION seat_conflict_guard();

-- ── 5 · voix sans vote, et une cadence liée au jalon (MER-06, 10) ─
ALTER TABLE meeting_attendance DROP CONSTRAINT IF EXISTS meeting_attendance_state_check;
ALTER TABLE meeting_attendance ADD  CONSTRAINT meeting_attendance_state_check
  CHECK (state IN ('present','apologies','absent','deputy','observer'));

ALTER TABLE meeting_series DROP CONSTRAINT IF EXISTS meeting_series_cadence_check;
ALTER TABLE meeting_series ADD  CONSTRAINT meeting_series_cadence_check
  CHECK (cadence IN ('weekly','monthly','per_gate','ad_hoc'));
ALTER TABLE meeting_series ADD COLUMN IF NOT EXISTS gate_n integer;
-- Une série liée à un jalon doit dire auquel, sinon « per_gate » ne
-- désigne aucune réunion.
ALTER TABLE meeting_series DROP CONSTRAINT IF EXISTS meeting_series_per_gate_needs_gate;
ALTER TABLE meeting_series ADD  CONSTRAINT meeting_series_per_gate_needs_gate
  CHECK (cadence <> 'per_gate' OR gate_n IS NOT NULL);

-- ── 4 · la décision : objection, coût de retour, supersession ─────
ALTER TABLE meeting_decision ADD COLUMN IF NOT EXISTS reversal_cost text;
ALTER TABLE meeting_decision DROP CONSTRAINT IF EXISTS meeting_decision_reversal_cost_check;
ALTER TABLE meeting_decision ADD  CONSTRAINT meeting_decision_reversal_cost_check
  CHECK (reversal_cost IS NULL OR reversal_cost IN ('low','medium','high'));
ALTER TABLE meeting_decision ADD COLUMN IF NOT EXISTS supersedes_id text
  REFERENCES meeting_decision(id) ON DELETE SET NULL;
ALTER TABLE meeting_decision ADD COLUMN IF NOT EXISTS source_evidence_id text
  REFERENCES evidence(id) ON DELETE SET NULL;
-- Une décision ne se remplace pas elle-même.
ALTER TABLE meeting_decision DROP CONSTRAINT IF EXISTS meeting_decision_not_self_superseding;
ALTER TABLE meeting_decision ADD  CONSTRAINT meeting_decision_not_self_superseding
  CHECK (supersedes_id IS NULL OR supersedes_id <> id);

CREATE TABLE IF NOT EXISTS decision_objection (
  id           text PRIMARY KEY,
  decision_id  text NOT NULL REFERENCES meeting_decision(id) ON DELETE CASCADE,
  seat_id      text REFERENCES seat(id) ON DELETE SET NULL,
  domain       text NOT NULL DEFAULT '',
  -- Le consentement porte à moins d'une objection RAISONNÉE et
  -- RELEVANT DU DOMAINE. Une objection sans raison n'est pas une
  -- objection, c'est un vote.
  reason       text NOT NULL,
  raised_on    date NOT NULL,
  escalates_on date,
  state        text NOT NULL DEFAULT 'open'
               CHECK (state IN ('open','resolved','escalated','withdrawn')),
  resolution   text NOT NULL DEFAULT '',
  CONSTRAINT objection_needs_reason CHECK (btrim(reason) <> ''),
  CONSTRAINT objection_resolved_needs_resolution
    CHECK (state <> 'resolved' OR btrim(resolution) <> '')
);
CREATE INDEX IF NOT EXISTS objection_decision_idx ON decision_objection(decision_id);
CREATE INDEX IF NOT EXISTS objection_state_idx    ON decision_objection(state);

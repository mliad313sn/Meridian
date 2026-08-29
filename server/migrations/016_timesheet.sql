-- ═══════════════════════════════════════════════════════════════════
-- 016 · L'EFFORT RÉEL  (comité indépendant, R-03)
--
-- Les affectations portaient un pourcentage PRÉVU et rien d'autre : la
-- capacité, le CPI main-d'œuvre et le coût capitalisé reposaient sur le
-- plan, jamais sur le fait. La saisie est volontairement minimale — par
-- personne, par projet, par semaine, un nombre de jours, rien de plus —
-- parce que la lourdeur tuerait l'usage qui est la raison d'être de la
-- réserve. L'arithmétique du moteur (EVM/CPM) n'est pas touchée : le
-- réel s'affiche À CÔTÉ du plan, il ne le réécrit pas.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE timesheet (
  id          bigserial PRIMARY KEY,
  person_id   text NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  project_id  text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  -- le lundi de la semaine saisie
  week_start  date NOT NULL,
  days        numeric NOT NULL CHECK (days >= 0 AND days <= 7),
  entered_by  text REFERENCES app_user(id) ON DELETE SET NULL,
  row_version integer NOT NULL DEFAULT 1,
  UNIQUE (person_id, project_id, week_start)
);
CREATE INDEX timesheet_project_idx ON timesheet(project_id, week_start);
CREATE INDEX timesheet_person_idx  ON timesheet(person_id, week_start);

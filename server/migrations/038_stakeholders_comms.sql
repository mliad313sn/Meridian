-- ═══════════════════════════════════════════════════════════════════
-- 038 · PARTIES PRENANTES ET PLAN DE COMMUNICATION  (PM-05 · PM-11 · I-10)
--
-- Retour de terrain RT365 (docs/33, M-12) sur deux lignes ouvertes du
-- registre de conformité (docs/26) :
--
--   PM-05 — « Les personnes existent comme ressources, pas comme parties
--   prenantes avec intérêt, influence et mode d'association. La cause
--   d'échec la plus fréquente des projets multi-sites n'a aucune trace
--   dans l'outil qui prétend les gouverner. » (ISO 21502 §7.5)
--
--   PM-11 — « Le mécanisme existe (notifications, comités, digest) ; le
--   plan — qui doit être informé de quoi, à quelle fréquence — non. »
--   (ISO 21502 §7.14)
--
-- Une partie prenante est une PERSONNE OU UNE ENTITÉ (un régulateur, un
-- fournisseur, un syndicat) : `person_id` est facultatif, `name` ne l'est
-- pas. Intérêt et influence sur la même échelle 1–5 que le RAID, pour
-- que la grille pouvoir/intérêt se dessine sans conversion. L'attitude
-- est un constat daté par la ligne d'audit, pas un jugement définitif.
--
-- Le plan de communication est une ligne par audience : quoi, par quel
-- canal, à quelle fréquence, qui s'en charge, et la prochaine échéance —
-- que l'ordre du jour peut relire.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE stakeholder (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  person_id     text REFERENCES person(id) ON DELETE SET NULL,
  name          text NOT NULL,
  organisation  text NOT NULL DEFAULT '',
  role_label    text NOT NULL DEFAULT '',
  interest      integer NOT NULL DEFAULT 3 CHECK (interest BETWEEN 1 AND 5),
  influence     integer NOT NULL DEFAULT 3 CHECK (influence BETWEEN 1 AND 5),
  attitude      text NOT NULL DEFAULT 'Neutral'
                CHECK (attitude IN ('Champion','Supporter','Neutral','Sceptic','Opponent')),
  engagement    text NOT NULL DEFAULT 'Inform'
                CHECK (engagement IN ('Inform','Consult','Involve','Partner')),
  owner_id      text REFERENCES person(id) ON DELETE SET NULL,
  note          text NOT NULL DEFAULT '',
  row_version   integer NOT NULL DEFAULT 1
);
CREATE INDEX stakeholder_project_idx ON stakeholder(project_id);

CREATE TABLE comms_plan (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  audience      text NOT NULL,
  purpose       text NOT NULL DEFAULT '',
  channel       text NOT NULL DEFAULT '',
  frequency     text NOT NULL DEFAULT '',
  owner_id      text REFERENCES person(id) ON DELETE SET NULL,
  next_on       date,
  note          text NOT NULL DEFAULT '',
  row_version   integer NOT NULL DEFAULT 1
);
CREATE INDEX comms_plan_project_idx ON comms_plan(project_id, next_on);

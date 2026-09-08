-- ═══════════════════════════════════════════════════════════════════
-- 039 · CE QU'UN REGISTRE DE DÉCISIONS PORTE VRAIMENT  (REQ-07, second tour)
--
-- Le conseiller PMO convoqué sur le retour de terrain (docs/33 §5,
-- D-33.11) a relu le registre de décisions de RT365 ligne à ligne contre
-- la 034 : quatre choses n'avaient pas de place.
--
--   · l'ORGANE qui décide — « ARB », « Product Owner agent under D-040 » —
--     n'est pas une personne de l'annuaire ; `decided_by` exigeait une
--     personne. `council` porte l'organe ; l'ancrage accepte l'un ou l'autre ;
--   · la PREUVE de la décision — le lien vers le compte rendu, le rapport
--     de porte — et sa PROVENANCE (« [Committee] », « [Owner instruction] ») ;
--   · l'ÉTAT : une décision proposée attend un ratifieur ; RT365 l'écrit
--     « pending (Compliance Agent) ». Proposée puis ratifiée, par qui ;
--   · un intitulé de plus de 300 caractères — les leurs le dépassent.
--
-- L'immuabilité (D-33.3) porte sur la SUBSTANCE : intitulé, motif,
-- alternatives, dissension. L'ÉTAT (statut, ratifieur, lien de preuve)
-- change — c'est la vie d'une décision, pas sa réécriture — et chaque
-- changement est une ligne d'audit avec avant/après.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE meeting_decision ADD COLUMN council text NOT NULL DEFAULT '';
ALTER TABLE meeting_decision ADD COLUMN evidence_uri text NOT NULL DEFAULT '';
ALTER TABLE meeting_decision ADD COLUMN provenance text NOT NULL DEFAULT '';
ALTER TABLE meeting_decision ADD COLUMN status text NOT NULL DEFAULT 'Ratified'
  CHECK (status IN ('Proposed','Ratified'));
ALTER TABLE meeting_decision ADD COLUMN ratified_by text NOT NULL DEFAULT '';

ALTER TABLE meeting_decision DROP CONSTRAINT decision_anchored;
ALTER TABLE meeting_decision ADD CONSTRAINT decision_anchored
  CHECK (occurrence_id IS NOT NULL
         OR (decided_on IS NOT NULL AND (decided_by IS NOT NULL OR council <> '')));

-- REQ-04 sur le contrat : un critère aussi se nomme par le système qui
-- le pose, et un critère échafaudé s'adopte.
ALTER TABLE gate_criterion ADD COLUMN external_source text REFERENCES integration(id) ON DELETE SET NULL;
ALTER TABLE gate_criterion ADD COLUMN external_id text;
CREATE UNIQUE INDEX gate_criterion_external_idx ON gate_criterion(external_source, external_id) WHERE external_id IS NOT NULL;

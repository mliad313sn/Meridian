-- ═══════════════════════════════════════════════════════════════════
-- 020 · LE CONTRÔLE DE VIE DE LA PREUVE  (N-07)
--
-- Ce constat ne vient pas d'un comité : il vient de la recette. Le mode
-- résiduel accepté sous R-01 nomme le cas exactement — « l'hôte de
-- confiance héberge des liens morts » — le note RPN 32, et l'accepte
-- faute de détection. Un an plus tard, un jalon franchi s'appuie sur une
-- preuve dont personne ne sait si elle répond encore.
--
-- 014 fige l'empreinte de l'adresse à l'approbation. Elle ne vérifie
-- jamais que l'adresse répond.
--
-- LA GARANTIE QUI COMPTE, et la raison pour laquelle ces colonnes sont
-- séparées du statut : la sonde ne change JAMAIS l'état d'un document.
-- Une coupure de liaison satellite ne doit pas désapprouver un jalon.
-- Elle produit un fait, affiché en bibliothèque et signalé au chef de
-- projet après trois échecs consécutifs. Le jugement reste humain, comme
-- partout ailleurs dans ce produit.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE document ADD COLUMN probed_at    timestamptz;
ALTER TABLE document ADD COLUMN probe_status integer;          -- code HTTP, ou nul
ALTER TABLE document ADD COLUMN probe_state  text NOT NULL DEFAULT 'never'
       CHECK (probe_state IN ('never', 'ok', 'unreachable', 'forbidden'));
-- Trois échecs de suite avant d'alerter : une liaison qui tombe une nuit
-- n'est pas une preuve perdue, et un outil qui crie au premier hoquet
-- apprend à ses lecteurs à ne plus l'écouter.
ALTER TABLE document ADD COLUMN probe_fails  integer NOT NULL DEFAULT 0;

CREATE INDEX document_probe_idx ON document(probe_state, probed_at);

COMMENT ON COLUMN document.probe_state IS
  'Résultat du dernier contrôle de vie. N''influence JAMAIS document.status (N-07).';

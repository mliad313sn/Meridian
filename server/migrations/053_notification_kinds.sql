-- ═══════════════════════════════════════════════════════════════════
-- 053 · LES NATURES QUE LE CONSTAT D'EXCEPTION N'AVAIT PAS LE DROIT
--       D'ÉCRIRE  (docs/36 C-04 — porté depuis la branche du comité de
--       revue documentaire, docs/32, où il portait le numéro 027)
--
-- 026 fait émettre « tolerance-breached » par le balayage horaire, et la
-- revue des bénéfices (plus tard) « benefit-review-due » — sans que
-- personne n'élargisse la contrainte de nature posée par 018. Chaque
-- écriture violait le CHECK ; le même appel omettait dedupe_key, NOT NULL
-- depuis 013 ; et le `catch` qui protège le constat avalait les deux
-- refus. Celui qui avait accordé la marge n'était JAMAIS prévenu : la
-- gestion par exception s'arrêtait au dernier maillon, en silence.
--
-- La branche d'origine numérotait ce correctif 027, numéro que main
-- avait déjà donné à 027_international.sql. Il prend ici le premier
-- numéro libre ; aucune migration appliquée n'est modifiée.
--
-- La leçon : un catch qui protège un flux ne doit jamais protéger une
-- contrainte. Le code porte désormais sa clé ; la contrainte s'élargit ici.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_kind_check;
ALTER TABLE notification ADD CONSTRAINT notification_kind_check CHECK (kind IN (
  'action-due', 'action-overdue', 'gate-blocked', 'decision-owed',
  'digest', 'concern-raised',
  'site-quiet', 'timesheet-missing', 'evidence-unreachable',
  'tolerance-breached',    -- 026 l'émettait ; 053 lui donne le droit d'exister
  'benefit-review-due'     -- même défaut, même sweep, même catch
));

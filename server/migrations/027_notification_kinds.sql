-- ═══════════════════════════════════════════════════════════════════
-- 027 · LA NATURE QUE LE CONSTAT D'EXCEPTION N'AVAIT PAS LE DROIT
--       D'ÉCRIRE  (comité de revue documentaire, docs/32)
--
-- 026 fait émettre « tolerance-breached » par le balayage horaire — et
-- n'a jamais élargi la contrainte de nature posée par 018. Chaque
-- écriture violait le CHECK, le `catch` qui protège le constat avalait
-- le refus, et celui qui avait accordé la marge n'était JAMAIS prévenu :
-- le mécanisme entier de la gestion par exception s'arrêtait au dernier
-- maillon, silencieusement. (Le même appel omettait dedupe_key, NOT NULL
-- depuis 013 — deux violations, zéro message, zéro erreur visible.)
--
-- La leçon est celle de la fédération : un catch qui protège un flux ne
-- doit jamais protéger une contrainte. Le code est corrigé pour porter
-- sa clé ; la contrainte s'élargit ici.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_kind_check;
ALTER TABLE notification ADD CONSTRAINT notification_kind_check CHECK (kind IN (
  'action-due', 'action-overdue', 'gate-blocked', 'decision-owed',
  'digest', 'concern-raised',
  'site-quiet', 'timesheet-missing', 'evidence-unreachable',
  'tolerance-breached'    -- 026 l'émettait ; 027 lui donne le droit d'exister
));

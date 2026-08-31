-- ═══════════════════════════════════════════════════════════════════
-- 027 · L'INTERNATIONAL COMMENCE DANS LE SCHÉMA  (I18N-01 · MC-01)
--
-- Deux verrous discrets empêchaient le produit de sortir de son couple
-- de langues et de sa géographie implicite. Ils sont dans le schéma, pas
-- dans l'interface — et c'est pour cela qu'on les lève ici.
--
-- ── 1 · La liste des langues n'est plus une contrainte en dur ──────
--
-- La 015 avait posé `CHECK (locale IN ('','en','fr'))` : ajouter
-- l'espagnol aurait exigé UNE MIGRATION PAR LANGUE, ce qui est la
-- définition même d'une liste codée au mauvais endroit. La contrainte
-- devient une contrainte de FORME (deux lettres minuscules, ou vide) :
-- la base garantit qu'un code de langue en est un, et le REGISTRE des
-- langues — quelles langues existent, lesquelles sont en brouillon —
-- vit dans le code, où il se change sans toucher au schéma
-- (web/src/lib/i18n.js, décision du comité 29 §4).
--
-- ── 2 · Un site a un pays et une entité légale ─────────────────────
--
-- Le comité GRC exigeait (G-14) qu'aucun site n'active la saisie du
-- temps « sans avis social et juridique de SON pays » — et le produit ne
-- savait pas dire le pays d'un site : `region` est du texte libre. De
-- même, une demande d'accès RGPD arrive à UNE entité juridique, et rien
-- ne disait laquelle porte quel site. Deux colonnes, pas plus :
--
--   country       ISO 3166-1 alpha-2, en majuscules, ou vide — la forme
--                 est contrainte parce qu'un code pays mal saisi est
--                 pire qu'aucun (il classe FAUX au lieu de classer pas)
--   legal_entity  le nom de l'entité porteuse, texte — les registres du
--                 commerce du monde ne se valident pas par une regex
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE app_user DROP CONSTRAINT app_user_locale_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_locale_check
  CHECK (locale = '' OR locale ~ '^[a-z]{2}$');

ALTER TABLE site ADD COLUMN country text NOT NULL DEFAULT ''
  CHECK (country = '' OR country ~ '^[A-Z]{2}$');
ALTER TABLE site ADD COLUMN legal_entity text NOT NULL DEFAULT '';

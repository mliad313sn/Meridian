-- ═══════════════════════════════════════════════════════════════════
-- 025 · LES INTÉGRATIONS NOMMÉES, À PORTÉE LIMITÉE  (INT-02)
--
-- Le comité d'interopérabilité a posé cette ligne AVANT l'API publique,
-- et il avait raison : ouvrir une interface sur la clé de fédération
-- actuelle — une seule, sans portée, capable de tout — aurait été le plus
-- grave défaut que ce produit ait jamais porté, et il aurait été de notre
-- fait plutôt qu'hérité.
--
-- Trois choses manquaient, et chacune coûte quelque chose de précis :
--
--   · une clé PAR système branché. Avec une clé unique, couper un tiers
--     coupe tous les autres, et rien ne dit lequel a écrit quoi ;
--   · une PORTÉE explicite. Une intégration financière n'a aucune raison
--     de pouvoir approuver un jalon ;
--   · un NOM dans la piste d'audit. « système » n'est pas une réponse à
--     « qui a écrit cette ligne ».
--
-- ── Ce que la table conserve, et ce qu'elle ne conserve pas ─────────
--
-- La clé n'est jamais stockée. Seule son empreinte SHA-256 l'est, comme
-- pour la clé de fédération et — depuis la migration 023 — comme pour les
-- jetons de session. La clé en clair est montrée UNE FOIS, à sa création,
-- et n'existe ensuite nulle part. `key_hint` garde ses quatre derniers
-- caractères, uniquement pour qu'un administrateur reconnaisse de quelle
-- clé on parle quand il y en a six.
--
-- ── L'attribution dans la piste ────────────────────────────────────
--
-- `audit_event.user_id` référence `app_user`. Pour qu'une écriture porte
-- le nom de l'intégration plutôt qu'un « service » anonyme, chaque
-- intégration a donc SA ligne `app_user`, inactive et sans mot de passe
-- utilisable — exactement le montage déjà éprouvé pour `SVC-SDP` dans
-- `federation.js`. Elle est créée par la route, pas par cette migration :
-- une ligne `app_user` préexistante casse le nettoyage du semis (les
-- règles d'ajout seul de la piste refusent le ON DELETE SET NULL).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE integration (
  id           text PRIMARY KEY,
  -- Le nom qui apparaîtra dans la piste d'audit. Unique, parce que deux
  -- lignes « SAP » ne répondent pas à « lequel a écrit ça ? ».
  name         text NOT NULL UNIQUE,
  purpose      text NOT NULL DEFAULT '',

  key_hash     text NOT NULL,
  key_hint     text NOT NULL DEFAULT '',
  -- Portées séparées par des virgules, vérifiées contre un vocabulaire
  -- fixe côté serveur. Vide = ne peut rien : fermé par défaut, comme la
  -- liste d'hôtes de preuve.
  scopes       text NOT NULL DEFAULT '',

  active       boolean NOT NULL DEFAULT true,
  created_by   text REFERENCES app_user(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  rotated_at   timestamptz,
  -- Quand cette clé a servi pour la dernière fois. C'est ce qui permet de
  -- révoquer sans crainte : une clé inutilisée depuis six mois est une
  -- clé qu'on peut couper.
  last_used_at timestamptz,

  row_version  integer NOT NULL DEFAULT 1
);

CREATE INDEX integration_active_idx ON integration(active);
-- La requête de chaque appel entrant : retrouver la clé présentée.
CREATE UNIQUE INDEX integration_key_idx ON integration(key_hash);

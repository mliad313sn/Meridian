-- ═══════════════════════════════════════════════════════════════════
-- 031 · LES ÉVÉNEMENTS SORTANTS SIGNÉS  (INT-04)
--
-- Jusqu'ici, les autres systèmes ne pouvaient que DEMANDER ; ils ne
-- pouvaient pas RÉAGIR. Power Automate, ServiceNow ou n'importe quel
-- orchestrateur restait aveugle à ce qui venait de se décider — un jalon
-- franchi, une exception ouverte, un changement approuvé se découvraient
-- en interrogeant, jamais en étant prévenu.
--
-- La source des événements n'est PAS une nouvelle table de faits : c'est
-- la piste d'audit elle-même, filtrée sur les mêmes actions de
-- gouvernance que la vue `reporting.decisions`. Une seule vérité, deux
-- lecteurs — inventer un deuxième flux d'événements serait fabriquer la
-- divergence qu'on reproche aux autres.
--
-- Ce qui s'ajoute est donc uniquement le JOURNAL DES LIVRAISONS : à qui
-- on a remis quoi, signé comment, réessayé combien de fois. Une ligne
-- par (événement × intégration) — deux abonnés, deux lignes, deux
-- signatures, deux histoires de réémission indépendantes.
--
-- La clé de signature vit sur l'intégration, en clair : le serveur doit
-- la TENIR pour signer (HMAC), contrairement à la clé d'API dont seule
-- l'empreinte suffit à vérifier. Elle n'est jamais renvoyée par
-- l'API — écrite, employée, jamais relue de l'extérieur.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE integration ADD COLUMN webhook_url text NOT NULL DEFAULT '';
ALTER TABLE integration ADD COLUMN webhook_secret text NOT NULL DEFAULT '';

CREATE TABLE event_delivery (
  id             bigserial PRIMARY KEY,
  integration_id text NOT NULL REFERENCES integration(id) ON DELETE CASCADE,
  audit_id       bigint NOT NULL REFERENCES audit_event(id) ON DELETE CASCADE,

  status         text NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending','Delivered','Failed')),
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  delivered_at   timestamptz,

  -- Un événement ne se livre qu'une fois par abonné ; le balayage passe
  -- toutes les heures et ne doit pas dupliquer. Tenu par la base.
  UNIQUE (integration_id, audit_id)
);

CREATE INDEX event_delivery_pending_idx ON event_delivery(status, created_at)
  WHERE status = 'Pending';

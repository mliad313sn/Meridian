/**
 * INT-04 — les événements sortants signés.
 *
 * Ce qui rend Meridian RÉACTIF pour les autres systèmes, et pas seulement
 * interrogeable. La source n'est pas un deuxième flux de faits : c'est la
 * piste d'audit, filtrée sur les mêmes actions de gouvernance que la vue
 * `reporting.decisions` — une seule vérité, deux lecteurs, et un test
 * tient les deux listes égales en lisant la définition de la vue.
 *
 * ── Le contrat de livraison ────────────────────────────────────────
 *
 * POST sur le webhook de l'intégration, corps JSON :
 *   { contract:"v1", delivery, event:{ id, at, actor, action, entity,
 *     entityId, detail } }
 *
 * En-têtes :
 *   X-Meridian-Signature : sha256=<HMAC-SHA256 hex du corps, clé =
 *                          webhook_secret de l'intégration>
 *   X-Meridian-Delivery  : l'identifiant de livraison (rejouable : même
 *                          id à chaque réémission — l'abonné déduplique)
 *
 * Le récepteur DOIT vérifier la signature : un webhook non signé se
 * usurpe avec un curl. Réponse 2xx = livré ; tout le reste = on
 * réessaie au balayage suivant, jusqu'à MAX_ATTEMPTS, puis Failed — et
 * l'échec se lit dans le journal, il ne s'évapore pas.
 */

import crypto from "node:crypto";
import { many, one, query } from "./db.js";

/* Les actions qui constituent une décision de gouvernance. La MÊME liste
   que le filtre de `reporting.decisions` (migration 029) — un test
   compare celle-ci à la définition SQL de la vue, dans les deux sens. */
export const GOVERNANCE_ACTIONS = [
  "Change request approved", "Change request rejected",
  "Phase advanced", "Gate overridden", "Project re-baselined",
  "Exception answered", "Business case reconfirmed",
  "Post-implementation review recorded",
  "Lesson adopted", "Tolerance set",
];

const MAX_ATTEMPTS = 8;

export const signBody = (secret, body) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

/** Un webhook n'est acceptable qu'en HTTPS — sauf la boucle locale,
    pour les essais. La même posture que les hôtes de preuve. */
export function acceptableWebhook(url) {
  if (!url) return true;   // vide = pas d'abonnement, jamais une erreur
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
}

/**
 * Remplit le journal : une ligne Pending par (événement de gouvernance ×
 * intégration abonnée) qui n'en a pas encore. L'unicité est tenue par la
 * base ; le balayage peut repasser sans dupliquer.
 */
async function enqueue() {
  const subs = await many(
    `SELECT id FROM integration WHERE active AND webhook_url <> ''`);
  if (!subs.length) return 0;

  const r = await query(
    `INSERT INTO event_delivery (integration_id, audit_id)
     SELECT i.id, a.id
       FROM integration i
       JOIN audit_event a ON a.action = ANY($1)
      WHERE i.active AND i.webhook_url <> ''
        /* Rien d'antérieur à l'abonnement : brancher un système ne doit
           pas lui déverser l'histoire entière — il la lira par l'API
           s'il la veut. */
        AND a.at >= i.created_at
        AND NOT EXISTS (SELECT 1 FROM event_delivery d
                         WHERE d.integration_id = i.id AND d.audit_id = a.id)`,
    [GOVERNANCE_ACTIONS]);
  return r.rowCount ?? 0;
}

/**
 * Tente les livraisons en attente. `fetchImpl` s'injecte pour les tests ;
 * en service c'est fetch, avec un délai court — un abonné lent ne doit
 * pas retenir la boucle horaire en otage.
 */
export async function sweepEvents({ fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  await enqueue();

  const pending = await many(
    `SELECT d.id, d.attempts, d.integration_id,
            i.webhook_url, i.webhook_secret, i.name,
            a.id AS audit_id, a.at, a.user_label, a.action, a.entity, a.entity_id, a.detail
       FROM event_delivery d
       JOIN integration i ON i.id = d.integration_id
       JOIN audit_event a ON a.id = d.audit_id
      WHERE d.status = 'Pending' AND i.active
      ORDER BY d.id
      LIMIT 200`);

  let delivered = 0, failed = 0;
  for (const d of pending) {
    if (!acceptableWebhook(d.webhook_url) || !d.webhook_url) continue;

    const body = JSON.stringify({
      contract: "v1",
      delivery: String(d.id),
      event: {
        id: String(d.audit_id), at: d.at, actor: d.user_label,
        action: d.action, entity: d.entity, entityId: d.entity_id, detail: d.detail,
      },
    });

    let ok = false, error = "";
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetchImpl(d.webhook_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-meridian-signature": signBody(d.webhook_secret, body),
          "x-meridian-delivery": String(d.id),
        },
        body, signal: ctl.signal,
      });
      clearTimeout(timer);
      ok = res.ok;
      if (!ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = String(e?.message ?? e).slice(0, 200);
    }

    if (ok) {
      await query(
        `UPDATE event_delivery SET status = 'Delivered', attempts = attempts + 1,
                delivered_at = now(), last_error = '' WHERE id = $1`, [d.id]);
      delivered++;
    } else {
      const attempts = d.attempts + 1;
      /* L'échec définitif se CONSTATE, il ne s'évapore pas : le journal
         le garde avec sa dernière erreur, et l'écran des intégrations
         peut le montrer. Un webhook mort en silence est un abonné qui
         croit être au courant. */
      await query(
        `UPDATE event_delivery
            SET status = $2, attempts = $3, last_error = $4
          WHERE id = $1`,
        [d.id, attempts >= MAX_ATTEMPTS ? "Failed" : "Pending", attempts, error]);
      failed++;
    }
  }
  return { delivered, failed, pending: pending.length };
}

/** Le journal d'une intégration, pour l'écran d'administration. */
export async function deliveriesOf(integrationId, limit = 30) {
  return many(
    `SELECT d.id, d.status, d.attempts, d.last_error, d.created_at, d.delivered_at,
            a.action, a.entity, a.entity_id, a.detail
       FROM event_delivery d JOIN audit_event a ON a.id = d.audit_id
      WHERE d.integration_id = $1
      ORDER BY d.id DESC LIMIT $2`, [integrationId, limit]);
}

/**
 * INT-02 — les intégrations nommées, à portée limitée.
 *
 * La serrure avant la porte. `federation.js` avait déjà le bon montage
 * pour UNE intégration : une clé dont on ne garde que l'empreinte, un
 * principal sans mot de passe et sans session, et un rôle `service` que
 * `rbac.can()` ne connaît pas — de sorte qu'une clé ne peut jamais ouvrir
 * l'interface interactive. Ce module généralise ce montage à plusieurs
 * systèmes branchés, et ajoute ce qui manquait : une portée, et un nom
 * dans la piste d'audit.
 *
 * ── La règle qui gouverne tout le fichier ──────────────────────────
 *
 * Une clé dit ce qu'elle peut, et rien de plus. Une portée absente n'est
 * pas « tout » : c'est « rien ». Le comité d'interopérabilité en a fait
 * sa règle n° 1, et c'est la même que celle des hôtes de preuve, qui
 * partent fermés et le disent.
 */

import { many, one, query } from "./db.js";
import { sha256hex, generateServiceKey } from "./federation.js";

/**
 * Le vocabulaire des portées.
 *
 * Il ne contient QUE ce que des routes servent réellement aujourd'hui.
 * Déclarer `write:cost` avant qu'une route l'honore reviendrait à publier
 * une porte qui n'existe pas et à laisser croire qu'elle est gardée. Les
 * portées d'écriture arriveront avec les intégrations qui les demandent
 * — INT-10 (Jira, Azure DevOps) et INT-11 (réalisé ERP) — et pas avant.
 */
export const SCOPES = {
  "read:portfolio": "Read the portfolio — projects, schedule, money, risks, benefits",
  "read:audit": "Read the audit trail — every recorded decision and change",
};

export const scopeList = () => Object.keys(SCOPES);

/** Une portée écrite par un humain est-elle une portée que nous servons ? */
export function normaliseScopes(input) {
  const asked = String(input ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = asked.filter((s) => !SCOPES[s]);
  if (unknown.length) {
    throw new Error(`Unknown scope(s): ${unknown.join(", ")}. Known: ${scopeList().join(", ")}`);
  }
  /* Dédoublonné et ordonné, pour que deux intégrations aux mêmes droits
     se lisent identiquement dans la liste. */
  return [...new Set(asked)].sort().join(",");
}

/**
 * Le principal d'une intégration. Même construction que
 * `servicePrincipal()` : rôle `service`, aucune habilitation, aucun mot
 * de passe. `projectScopeSql` lui accorde explicitement le portefeuille
 * entier (voir rbac.js) ; ce qui le borne est sa portée, pas son
 * périmètre.
 *
 * `displayName` porte le nom de l'intégration : c'est lui qui atterrit
 * dans `audit_event.user_label`, et c'est toute la différence entre
 * « système » et « SAP — réalisé financier ».
 */
export function integrationPrincipal(row) {
  return {
    id: row.id,
    displayName: row.name,
    role: "service",
    active: true,
    grants: { programmes: new Set(), sites: new Set() },
    /* Lu par le garde ci-dessous, jamais par rbac : la portée est une
       propriété de la CLÉ, pas de l'autorité métier. */
    scopes: String(row.scopes ?? "").split(",").filter(Boolean),
  };
}

/**
 * La piste d'audit référence `app_user`. Pour qu'une écriture porte le
 * nom de l'intégration, celle-ci a donc sa ligne — inactive, mot de passe
 * inutilisable, exactement comme `SVC-SDP`. Aucune session ne peut être
 * frappée pour elle : `login()` exige `active` et un scrypt valide.
 */
async function ensureIntegrationAccount(id, name, runner) {
  await runner.query(
    `INSERT INTO app_user (id, email, display_name, role, pw_hash, pw_salt, active)
     VALUES ($1, $2, $3, 'viewer', 'unusable', 'unusable', false)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [id, `${id.toLowerCase()}@integration.invalid`, name]);
}

/* ── cycle de vie ─────────────────────────────────────────────────── */

export async function listIntegrations() {
  return many(
    `SELECT id, name, purpose, key_hint, scopes, active,
            created_by, created_at, rotated_at, last_used_at, row_version,
            webhook_url,
            /* Le secret ne sort JAMAIS ; l'écran n'a besoin que de savoir
               s'il y en a un. */
            (webhook_secret <> '') AS webhook_secret_set
       FROM integration ORDER BY name`);
}

/**
 * Crée une intégration et rend la clé EN CLAIR — la seule fois où elle
 * existera. L'appelant doit la montrer et ne pas la conserver.
 */
export async function createIntegration({ id, name, purpose, scopes, createdBy }, t) {
  const runner = t ?? { query };
  const { plain, hash } = generateServiceKey();
  const normalised = normaliseScopes(scopes);
  /* Sur la poignée de transaction, pas sur `query` : cette fonction est
     appelée DEPUIS `audited()`, et le garde de db.js refuse — à raison —
     toute lecture ou écriture hors de la transaction ouverte. Le compte
     et l'intégration naissent donc ensemble, ou pas du tout. */
  await ensureIntegrationAccount(id, name, runner);
  await runner.query(
    `INSERT INTO integration (id, name, purpose, key_hash, key_hint, scopes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, name, purpose ?? "", hash, plain.slice(-4), normalised, createdBy ?? null]);
  return { key: plain, hint: plain.slice(-4), scopes: normalised };
}

/** Une nouvelle clé pour la même intégration ; l'ancienne cesse à l'instant. */
export async function rotateIntegrationKey(id, t) {
  const runner = t ?? { query };
  const { plain, hash } = generateServiceKey();
  const r = await runner.query(
    `UPDATE integration
        SET key_hash = $2, key_hint = $3, rotated_at = now(),
            row_version = row_version + 1
      WHERE id = $1`,
    [id, hash, plain.slice(-4)]);
  if (!r.rowCount) return null;
  return { key: plain, hint: plain.slice(-4) };
}

/* ── le garde ─────────────────────────────────────────────────────── */

/**
 * `requireIntegration("read:portfolio")` — le garde des routes `/v1`.
 * Appelé sans argument, il n'exige qu'une clé valable.
 *
 * Trois refus, et tous les trois répondent **exactement pareil** à qui
 * n'a pas de clé valable : une clé inconnue, une clé révoquée et une
 * intégration inexistante donnent le même 401 sans détail. Un scanner
 * n'apprend pas si une clé a existé. Seule la PORTÉE insuffisante donne
 * un 403 explicite — parce que là, l'appelant est authentifié et a
 * besoin de savoir ce qui lui manque pour le demander.
 */
export function requireIntegration(scope) {
  return async (req, res, next) => {
    try {
      const presented = req.get("X-API-Key") ?? bearer(req);
      if (!presented) return res.status(401).json({ error: "unauthorized" });

      const row = await one(
        `SELECT * FROM integration WHERE key_hash = $1`, [sha256hex(presented)]);
      /* La comparaison porte sur une empreinte déjà calculée et indexée :
         l'égalité est faite par la base sur 64 caractères hexadécimaux,
         pas sur le secret. Il n'y a pas de fuite de temps à protéger ici
         — contrairement à la fédération, qui compare deux tampons en
         mémoire et utilise `timingSafeEqual` pour cette raison. */
      if (!row || !row.active) return res.status(401).json({ error: "unauthorized" });

      const scopes = String(row.scopes ?? "").split(",").filter(Boolean);
      /* Sans portée demandée, le garde vérifie seulement que la clé est
         valable et vivante : c'est ce dont la route de découverte a
         besoin, pour qu'un intégrateur puisse lire CE QUI LUI MANQUE
         sans écrire à un administrateur. */
      if (scope && !scopes.includes(scope)) {
        return res.status(403).json({
          error: `this key does not carry the "${scope}" scope`,
          held: scopes,
        });
      }

      /* Sans await : savoir qu'une clé sert ne doit pas ralentir l'appel,
         et perdre une horodate au profit du débit est un compromis qu'on
         assume — ce n'est pas la piste d'audit, c'est un indicateur
         d'exploitation. */
      query(`UPDATE integration SET last_used_at = now() WHERE id = $1`, [row.id])
        .catch(() => {});

      req.integration = row;
      req.user = integrationPrincipal(row);
      next();
    } catch (e) { next(e); }
  };
}

function bearer(req) {
  const h = req.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

export { sha256hex };

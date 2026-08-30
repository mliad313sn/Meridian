/**
 * N-07 — LE CONTRÔLE DE VIE DE LA PREUVE.
 *
 * Une preuve de jalon approuvée pointe vers un artefact. `014_evidence`
 * fige l'empreinte de cette adresse au moment de l'approbation ; rien ne
 * vérifie ensuite que l'adresse répond encore. C'est le mode résiduel que
 * la recette a accepté faute de détection, et voici la détection.
 *
 * Trois règles qui décident de tout ce fichier :
 *
 *   · LA SONDE NE JUGE PAS. Elle ne change jamais `document.status`. Une
 *     liaison satellite qui tombe la nuit ne doit pas désapprouver un
 *     jalon au matin. Elle produit un fait ; un humain en tire une
 *     conclusion.
 *
 *   · ELLE N'OUVRE AUCUN FLUX NOUVEAU. Elle n'interroge que des hôtes
 *     déjà présents dans `documentHosts` — le flux sortant que le mandant
 *     a autorisé, exercé dans l'autre sens. Hôtes vides = rien à sonder,
 *     et elle le dit plutôt que de se taire.
 *
 *   · ELLE NE CRIE PAS AU PREMIER HOQUET. Trois échecs consécutifs avant
 *     d'avertir le chef de projet, par le centre de notification.
 */

import { many, query } from "./db.js";
import { queue } from "./notify.js";

/** Les hôtes de confiance, tels que R-01 les a définis. */
async function trustedHosts() {
  const rows = await many(`SELECT value #>> '{}' AS v FROM app_setting WHERE key = 'documentHosts'`);
  return String(rows[0]?.v ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

const onTrustedHost = (uri, hosts) => {
  try {
    const u = new URL(uri);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return hosts.some((h) => host === h || host.endsWith("." + h));
  } catch { return false; }
};

/**
 * Un appel, et ce qu'on en conclut.
 *
 * `HEAD` d'abord : on demande si la pièce est là, pas son contenu — la
 * sonde ne rapatrie jamais un document. Certains serveurs refusent HEAD
 * sans que la pièce manque, d'où le repli sur un GET dont on abandonne le
 * corps aussitôt.
 */
async function probeOne(uri, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const attempt = async (method) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(uri, { method, redirect: "follow", signal: ctl.signal });
      return r.status;
    } finally { clearTimeout(timer); }
  };
  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 501) status = await attempt("GET");
    if (status >= 200 && status < 300) return { state: "ok", status };
    /* 401 et 403 ne disent pas que la pièce a disparu : ils disent que la
       sonde n'y a pas droit. C'est une information différente, et la
       confondre avec une perte ferait crier l'outil sur des preuves
       parfaitement en place derrière une authentification. */
    if (status === 401 || status === 403) return { state: "forbidden", status };
    return { state: "unreachable", status };
  } catch {
    return { state: "unreachable", status: null };
  }
}

/**
 * Sonder les preuves approuvées, et ne dire que ce qui est établi.
 *
 * Renvoie de quoi consigner le chiffre que le comité a demandé : la part
 * des preuves approuvées dont le lien a répondu.
 */
export async function probeEvidence({ limit = 40, fetchImpl = fetch, alertAfter = 3 } = {}) {
  const hosts = await trustedHosts();
  if (!hosts.length) {
    return { probed: 0, ok: 0, skipped: "no trusted document hosts configured — nothing to probe" };
  }

  /* Les plus anciennement sondées d'abord : un passage régulier finit par
     couvrir la bibliothèque entière sans jamais la parcourir d'un coup. */
  const docs = await many(
    `SELECT d.id, d.uri, d.name, d.project_id, d.probe_fails,
            u.id AS user_id, u.email, u.locale, u.notify_pref, p.id AS person_id
       FROM document d
       LEFT JOIN project pr ON pr.id = d.project_id
       LEFT JOIN person  p  ON p.id  = pr.pm_id
       LEFT JOIN app_user u ON u.person_id = p.id AND u.active
      WHERE d.status = 'Approved' AND d.uri <> ''
      ORDER BY d.probed_at NULLS FIRST
      LIMIT $1`, [limit]);

  let probed = 0, ok = 0, unreachable = 0, alerted = 0;
  for (const d of docs) {
    if (!onTrustedHost(d.uri, hosts)) continue;   // hors du flux autorisé
    const r = await probeOne(d.uri, { fetchImpl });
    probed++;
    if (r.state === "ok") ok++;
    if (r.state === "unreachable") unreachable++;

    const fails = r.state === "ok" ? 0 : Number(d.probe_fails ?? 0) + 1;
    await query(
      `UPDATE document
          SET probed_at = now(), probe_status = $2, probe_state = $3, probe_fails = $4
        WHERE id = $1`, [d.id, r.status, r.state, fails]);

    /* Le seuil, et une seule fois : le message porte le jour dans sa clé,
       donc un passage horaire ne harcèle personne. */
    if (r.state === "unreachable" && fails >= alertAfter && d.email) {
      const day = new Date().toISOString().slice(0, 10);
      const said = await queue({
        userId: d.user_id, email: d.email, kind: "evidence-unreachable",
        severity: "attention", entity: "document", entityId: d.id,
        subject: `Evidence link is not answering: ${d.name}`,
        body: `${d.name}\n\n${d.uri}\n\n` +
              `The last ${fails} checks did not reach it. The document's approval is ` +
              `untouched — nothing has been withdrawn. Somebody who knows where the ` +
              `piece lives should confirm it is still there.`,
        dedupeKey: `evidence-unreachable:${d.id}:${day}`,
      });
      if (said) alerted++;
    }
  }
  return { probed, ok, unreachable, alerted,
           reachedPct: probed ? Math.round((ok / probed) * 100) : null };
}

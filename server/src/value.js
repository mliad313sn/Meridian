/**
 * REQ-22 (V-3) — le cas d'affaire, confronté à chaque jalon.
 *
 * RT365, après son second passage : « `business_case` porte déjà les
 * champs de reconfirmation ; rien ne les impose. La décision
 * continuer/arrêter à chaque jalon est le contrôle de plus grande valeur
 * qu'un bureau de projets détienne, et c'est celui qu'on saute le plus
 * souvent. »
 *
 * Le contrôle vit ici, et non dans une route, pour la raison que le
 * conseiller code avait déjà relevée sur le gel d'usine : le jalon
 * s'écrit par DEUX chemins — l'écran et `PUT /api/v1/milestones` — et un
 * contrôle posé sur un seul n'est pas un contrôle.
 *
 * Ce qui est refusé est étroit et nommé : franchir un JALON DE
 * GOUVERNANCE d'un projet QUI A UN CAS, sans que ce cas ait été
 * reconfirmé À CE jalon. Un projet sans cas n'est pas concerné — le
 * produit ne réclame pas une pièce qu'il n'a pas demandée — et rouvrir
 * un jalon ne demande rien.
 */
import { one, many } from "./db.js";
import { HttpError } from "./auth.js";
import { toM } from "./portfolio.js";

/** Les reconfirmations d'un projet, la plus récente d'abord. */
export async function reconfirmationsFor(projectId) {
  if (!projectId) return [];
  return many(
    `SELECT r.*, p.name AS by_name
       FROM case_reconfirmation r
       LEFT JOIN person p ON p.id = r.reconfirmed_by
      WHERE r.project_id = $1
      ORDER BY r.gate`, [projectId]);
}

/**
 * L'écart avec la reconfirmation précédente : c'est ce qui rend le geste
 * utile plutôt que rituel. Sans lui, « reconfirmé » ne dit pas si la
 * promesse a bougé de dix pour cent ou de moitié entre deux jalons.
 */
export function deltaAgainst(previous, cost, benefit) {
  if (!previous) return null;
  const was = { cost: previous.expected_cost, benefit: previous.expected_benefit };
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    sinceGate: previous.gate,
    cost: num(cost) === null || num(was.cost) === null ? null : toM(num(cost) - num(was.cost)),
    benefit: num(benefit) === null || num(was.benefit) === null ? null : toM(num(benefit) - num(was.benefit)),
  };
}

/**
 * Le refus, à poser AVANT d'ouvrir la transaction d'écriture : lire la
 * base pendant qu'une transaction est ouverte est ce que le garde de
 * db.js refuse, et à juste titre.
 */
export async function assertCaseReconfirmed(project, milestone, { done }) {
  if (!done) return;                          // rouvrir ne demande rien
  if (milestone.kind !== "gate") return;      // un jalon ordinaire n'est pas une décision de continuer
  if (milestone.done) return;                 // déjà franchi : on ne redemande pas
  const gateNo = Number(milestone.gate);
  if (!(gateNo >= 1)) return;

  const projectId = project.id ?? project;
  const c = await one(`SELECT id, summary FROM business_case WHERE project_id = $1`, [projectId]);
  if (!c) return;                             // pas de cas : rien à reconfirmer

  const done_ = await one(
    `SELECT verdict FROM case_reconfirmation WHERE case_id = $1 AND gate = $2`, [c.id, gateNo]);
  if (!done_) {
    throw new HttpError(409,
      `The business case has not been reconfirmed at gate ${gateNo}. Passing a gate is the ` +
      `decision to carry on spending: reconfirm the case at this gate first ` +
      `(POST /api/projects/${projectId}/case/reconfirm with gate ${gateNo}), or record the ` +
      `decision to stop.`);
  }
  if (done_.verdict === "Stop") {
    throw new HttpError(409,
      `The business case was reconfirmed at gate ${gateNo} with the verdict "Stop". ` +
      `A gate cannot be cleared on a project the payer has decided to end — close the ` +
      `project, or reconfirm again with a different verdict and the reason.`);
  }
}

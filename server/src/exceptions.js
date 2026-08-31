/**
 * PM-01 — le balayage qui constate les dépassements de tolérance.
 *
 * C'est la moitié du mécanisme, et la plus importante. Une exception
 * n'est pas LEVÉE par quelqu'un : elle est CONSTATÉE, toutes les heures,
 * sur exactement les mêmes chiffres que l'écran. Personne n'a à décider
 * de faire remonter la mauvaise nouvelle — ce qui dépend d'un porteur de
 * mauvaise nouvelle ne remonte pas, et c'est la raison pour laquelle les
 * comités de pilotage découvrent les dépassements une fois consommés.
 *
 * ── Trois règles, et ce qu'elles évitent ───────────────────────────
 *
 * 1. **Une seule exception ouverte par projet et par dimension.** Le
 *    balayage passe toutes les heures ; sans cela il empilerait cent
 *    fois le même dépassement et l'écran deviendrait illisible au moment
 *    précis où il doit être lu. Garanti par un index unique partiel à la
 *    base, pas par une condition dans ce fichier.
 *
 * 2. **Une exception ne se ferme jamais toute seule.** La prévision peut
 *    repasser sous la limite d'elle-même — un jalon rattrapé, une
 *    dépense reportée. L'exception reste ouverte jusqu'à ce que quelqu'un
 *    dise ce qu'il en a fait. Un dépassement qui s'efface tout seul n'a
 *    jamais eu lieu, et c'est exactement ce qu'un comité ne doit pas
 *    pouvoir oublier.
 *
 * 3. **Le constat porte ses deux nombres.** Ce qui a été mesuré et ce qui
 *    était permis, figés au moment du constat. Les relire six mois plus
 *    tard sur les chiffres du jour ne dirait rien de la décision prise.
 */

import { many, tx } from "./db.js";
import { record } from "./audit.js";
import { allocateId } from "./db.js";
import { loadPortfolio } from "./portfolio.js";
import { Engine } from "../../shared/engine.js";
import { queue } from "./notify.js";

/** Le principal du balayage : personne. La piste écrit « system ». */
const SWEEPER = null;

const WORDING = {
  schedule: (b) => `Forecast finish is ${b.measured} day(s) past the baseline; ` +
                   `${b.allowed} day(s) were allowed`,
  cost: (b) => `Estimate at completion is ${b.measured}% over budget; ` +
               `${b.allowed}% was allowed`,
  benefit: (b) => `The weakest benefit is ${b.measured} points below target; ` +
                  `${b.allowed} were allowed`,
};

/**
 * Passe tout le portefeuille, constate, et rend ce qui a été ouvert.
 *
 * Lit avec un principal administrateur interne : le balayage n'a pas de
 * session et doit voir tout le livre pour constater partout. Il n'écrit
 * rien d'autre que des exceptions et leur ligne de piste.
 */
export async function sweepExceptions() {
  const db = await loadPortfolio({
    id: "SWEEP", displayName: "Tolerance sweep", role: "admin", active: true,
    grants: { programmes: new Set(), sites: new Set() },
  });

  const tolByProject = new Map((db.tolerances ?? []).map((t) => [t.project, t]));
  if (!tolByProject.size) return { considered: 0, opened: 0 };

  /* Ce qui est DÉJÀ ouvert ne se rouvre pas. Lu une fois, pas par
     projet : cent projets ne doivent pas coûter cent requêtes. */
  /* L'adresse de qui a accordé la marge : `queue()` sans adresse ne
     fait rien du tout et le dit en rendant false — un constat qui ne
     prévient personne nous ramènerait au problème de départ. */
  const setters = new Map(
    (await many(
      `SELECT id, email FROM app_user WHERE id = ANY($1) AND active`,
      [[...new Set((db.tolerances ?? []).map((t) => t.setBy).filter(Boolean))]]
    )).map((u) => [u.id, u.email]));

  const open = new Set(
    (await many(`SELECT project_id, dimension FROM project_exception WHERE status = 'Open'`))
      .map((r) => `${r.project_id}|${r.dimension}`));

  let considered = 0;
  const opened = [];

  for (const p of db.projects) {
    const tol = tolByProject.get(p.id);
    if (!tol || p.closed) continue;
    considered++;

    for (const b of Engine.breaches(db, p, tol)) {
      if (open.has(`${p.id}|${b.dimension}`)) continue;

      const detail = (WORDING[b.dimension] ?? (() => ""))(b);
      let id = null;
      await tx(async (t) => {
        id = await allocateId(t, "EXC", { pad: 3 });
        await t.query(
          `INSERT INTO project_exception
             (id, project_id, tolerance_id, dimension, measured, allowed, detail)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, p.id, tol.id, b.dimension, b.measured, b.allowed, detail]);
        /* Tracé comme tout le reste. C'est un fait de gouvernance : il a
           une date, deux nombres, et personne ne l'a « décidé ». */
        await record(t, SWEEPER, {
          action: "Exception raised", entity: "project_exception", entityId: id,
          detail: `${p.id} ${b.dimension} — ${detail}`,
          after: { measured: b.measured, allowed: b.allowed },
        });
      });
      open.add(`${p.id}|${b.dimension}`);
      opened.push({ id, project: p.id, dimension: b.dimension, detail });

      /* Et l'on prévient celui qui a accordé la marge. Sans cela le
         constat attendrait que quelqu'un ouvre le bon écran — ce qui
         nous ramènerait exactement au problème de départ. */
      const to = setters.get(tol.setBy);
      if (to) {
        await queue({
          userId: tol.setBy, email: to, kind: "tolerance-breached", severity: "attention",
          subject: `${p.name} has gone past the tolerance you set`,
          body: `${detail}.\n\nAnswer it: raise the tolerance, revise the plan, ` +
                `accept the overrun, or stop the project.`,
          groupKey: `exception:${id}`,
        }).catch(() => { /* la file ne doit jamais faire tomber le constat */ });
      }
    }
  }

  return { considered, opened: opened.length, exceptions: opened };
}

/**
 * `/api/v1` — la surface que les autres systèmes lisent.
 *
 * Deux endpoints seulement, et c'est délibéré. INT-02 livrait la serrure ;
 * il fallait au moins deux portes pour prouver qu'elle distingue les
 * clés — une clé qui ne porte que `read:portfolio` doit être refusée sur
 * la piste d'audit, et le test le montre. INT-01 décrira ce contrat en
 * OpenAPI et l'étendra ; les écritures viendront avec les intégrations
 * qui les demandent, jamais avant.
 *
 * ── Ce qui distingue /v1 de /api ──────────────────────────────────
 *
 * `/api` sert le navigateur : session par cookie, forme taillée pour
 * l'écran, et le droit de changer avec lui. `/v1` sert des machines :
 * clé, portée, et **un contrat qu'on s'engage à ne pas casser**. Le jour
 * où la forme doit changer, ce sera `/v2` — la version est dans le
 * chemin pour que ce jour-là personne n'ait à deviner.
 *
 * Les deux réponses portent `generatedAt` et `version` : un intégrateur
 * qui compare deux extractions doit pouvoir dire laquelle est la plus
 * récente sans se fier à l'heure de sa propre machine.
 */

import { Router } from "express";
import { loadPortfolio } from "../portfolio.js";
import { many } from "../db.js";
import { Engine } from "../../../shared/engine.js";
import { readAudit } from "../audit.js";
import { requireIntegration } from "../integrations.js";
import { openApiDocument, scopedEndpoints } from "../openapi.js";
import { packageVersion } from "../env.js";
import {
  idempotent, upsertProject, upsertMilestone, upsertRaid, upsertDecision, upsertAction,
  upsertActivity, upsertWorkItem, upsertCriterion, upsertBenefit, upsertBusinessCase,
} from "../v1write.js";

const r = Router();

const CONTRACT = "v1";
const stamp = () => ({ contract: CONTRACT, generatedAt: new Date().toISOString() });

/**
 * Le portefeuille, dans la forme du sérialiseur.
 *
 * C'est la même sortie que celle de l'écran, et c'est voulu : deux
 * projections divergeraient au premier changement, et l'intégrateur
 * lirait alors des chiffres que personne ne voit à l'écran. La règle du
 * produit — « rien à l'écran que le serveur n'ait accordé » — devient
 * ici « rien dans l'API que l'écran ne montre ».
 */
r.get("/portfolio", requireIntegration("read:portfolio"), async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    res.json({
      ...stamp(),
      asAt: db.statusDate,
      counts: {
        projects: db.projects.length, sites: db.sites.length,
        programmes: db.programmes.length, risks: db.raid.length,
        benefits: db.benefits.length, lessons: db.lessons.length,
      },
      portfolio: db,
    });
  } catch (e) { next(e); }
});

/**
 * La piste d'audit — sa propre portée, parce que c'est la lecture la plus
 * sensible du produit. Une intégration qui rapatrie le portefeuille dans
 * un entrepôt décisionnel n'a aucune raison d'emporter aussi qui a
 * approuvé quoi.
 */
r.get("/audit", requireIntegration("read:audit"), async (req, res, next) => {
  try {
    const str = (v) => (v === undefined || v === null ? undefined : String(v));
    const rows = await readAudit({
      entity: str(req.query.entity), entityId: str(req.query.entityId),
      action: str(req.query.action), limit: req.query.limit, before: str(req.query.before),
    });
    res.json({ ...stamp(), events: rows });
  } catch (e) { next(e); }
});

/**
 * V-4 — la promesse contre le réalisé, servie telle que la page la
 * montre. Même objet, même sérialiseur : deux projections divergeraient
 * au premier changement, et le commanditaire lirait des chiffres que
 * personne ne voit à l'écran.
 *
 * Sous `read:portfolio` : c'est du portefeuille, pas de la gouvernance.
 */
r.get("/value", requireIntegration("read:portfolio"), async (req, res, next) => {
  try {
    const db = await loadPortfolio(req.user);
    const wanted = String(req.query.programme ?? "").trim();
    const projects = wanted ? db.projects.filter((p) => p.programme === wanted) : db.projects;
    res.json({ ...stamp(), programme: wanted || null, value: Engine.valueReport(db, projects) });
  } catch (e) { next(e); }
});

/**
 * REQ-15 — le registre des décisions, et les actions.
 *
 * L'intégrateur a rechargé tout le programme RT365 par le contrat — 285
 * écritures, une seconde passe sans une seule création — puis n'a rien
 * pu relire. Trois conséquences mesurées : `adopt` sur une décision ou
 * une action existante n'avait aucun chemin de découverte (le seul
 * indice public était de chercher un intitulé dans le `detail` de
 * /api/v1/audit) ; aucune réconciliation de ce qu'une salle a décidé
 * n'était possible sans session ; et un synchroniseur ne voyait pas
 * qu'un humain avait clos une action — H-01 marquée Done à l'écran,
 * rouverte en Open par une re-passe inchangée.
 *
 * Sous `read:meetings` et non `read:portfolio` : INT-02 a séparé la
 * piste d'audit pour qu'un entrepôt décisionnel n'emporte pas la
 * gouvernance avec les chiffres, et un registre de décisions est de la
 * même eau. C'est le miroir de `write:meetings`.
 */
r.get("/decisions", requireIntegration("read:meetings"), async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const rows = await many(
      `SELECT d.id, d.headline, d.rationale, d.alternatives, d.dissent, d.decided_by,
              d.project_id, d.cr_id, d.raid_id, d.milestone_id, d.supersedes,
              COALESCE(o.meets_on, d.decided_on) AS decided_on,
              d.external_source, d.external_id, d.council, d.evidence_uri, d.provenance,
              d.status, d.ratified_by, d.row_version,
              s.name AS series_name, pe.name AS decided_by_name
         FROM meeting_decision d
         LEFT JOIN meeting_occurrence o ON o.id = d.occurrence_id
         LEFT JOIN meeting_series s ON s.id = o.series_id
         LEFT JOIN person pe ON pe.id = d.decided_by
        ORDER BY COALESCE(o.meets_on, d.decided_on) DESC, d.id DESC
        LIMIT $1`, [limit]);
    res.json({
      ...stamp(),
      decisions: rows.map((d) => ({
        id: d.id, headline: d.headline, rationale: d.rationale,
        alternatives: d.alternatives ?? "", dissent: d.dissent ?? "",
        decidedBy: d.decided_by, decidedByName: d.decided_by_name ?? null,
        decidedOn: d.decided_on, council: d.council ?? "",
        series: d.series_name ?? null,
        project: d.project_id ?? null, cr: d.cr_id ?? null, raid: d.raid_id ?? null,
        milestone: d.milestone_id ?? null, supersedes: d.supersedes ?? null,
        evidenceUri: d.evidence_uri ?? "", provenance: d.provenance ?? "",
        status: d.status ?? "Ratified", ratifiedBy: d.ratified_by ?? "",
        /* Ce que l'adoption vient chercher : la ligne est-elle déjà à
           quelqu'un, et si oui sous quel nom. */
        externalSource: d.external_source ?? null, externalId: d.external_id ?? null,
        version: d.row_version,
      })),
    });
  } catch (e) { next(e); }
});

r.get("/actions", requireIntegration("read:meetings"), async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const rows = await many(
      `SELECT a.*, s.name AS series_name, p.name AS owner_name,
              o.status AS raised_in_status
         FROM meeting_action a
         JOIN meeting_series s ON s.id = a.series_id
         LEFT JOIN meeting_occurrence o ON o.id = a.raised_in
         LEFT JOIN person p ON p.id = a.owner_id
        WHERE ($1::text IS NULL OR a.status = $1)
        ORDER BY a.due_date NULLS LAST, a.id
        LIMIT $2`, [req.query.status ?? null, limit]);
    res.json({
      ...stamp(),
      actions: rows.map((a) => ({
        id: a.id, title: a.title, detail: a.detail,
        owner: a.owner_id, ownerName: a.owner_name ?? null,
        project: a.project_id ?? null, dueDate: a.due_date, status: a.status,
        series: a.series_id, seriesName: a.series_name,
        raisedIn: a.raised_in, closedIn: a.closed_in ?? null,
        /* Fermée dans une salle close : une re-passe qui réécrirait
           `Open` par-dessus écrase la minute d'une séance. */
        raisedInStatus: a.raised_in_status ?? null,
        externalSource: a.external_source ?? null, externalId: a.external_id ?? null,
        version: a.row_version,
      })),
    });
  } catch (e) { next(e); }
});

/* ── I-2 · l'écriture, par identité externe ───────────────────────────
   Retour de terrain RT365 : « l'API publique est en lecture seule ; toute
   écriture passe par 144 routes de session non documentées ; sans
   identifiant externe, l'intégrateur encode son identité dans les
   titres. » Chaque PUT ci-dessous crée ou met à jour la ligne que
   l'intégration nomme ELLE-MÊME ; les règles métier sont celles de
   l'écran (server/src/v1write.js). Idempotency-Key en option. */
const ext = (req) => {
  const id = String(req.params.externalId ?? "").trim();
  if (!id || id.length > 200) throw Object.assign(new Error("externalId is 1 to 200 characters"), { status: 400 });
  return id;
};
const write = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req.user, ext(req), req.body ?? {});
    res.status(out.created ? 201 : 200).json({ ...stamp(), ...out });
  } catch (e) { next(e); }
};
r.put("/projects/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertProject));
r.put("/milestones/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertMilestone));
r.put("/raid/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertRaid));
r.put("/activities/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertActivity));
r.put("/workitems/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertWorkItem));
r.put("/criteria/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertCriterion));
/* REQ-20 (V-1) — la valeur est du portefeuille : ce qu'un projet promet
   et ce qu'il rend se synchronisent comme ce qu'il livre. */
r.put("/benefits/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertBenefit));
r.put("/business-case/:externalId", requireIntegration("write:portfolio"), idempotent(), write(upsertBusinessCase));
r.put("/decisions/:externalId", requireIntegration("write:meetings"), idempotent(), write(upsertDecision));
r.put("/actions/:externalId", requireIntegration("write:meetings"), idempotent(), write(upsertAction));

/**
 * La description OpenAPI de ce contrat, servie par l'instance elle-même.
 *
 * Le même document que `docs/openapi.v1.json`, à ceci près qu'il porte la
 * version RÉELLEMENT en service et l'adresse à laquelle on l'a demandé —
 * ce que le fichier publié ne peut pas savoir. Un intégrateur branché sur
 * une instance lit donc le contrat de CETTE instance, pas celui de la
 * dernière livraison.
 *
 * Réservé à une clé valable, comme la découverte : la forme d'une API est
 * de la reconnaissance, et le comité a posé « fermé par défaut ».
 */
r.get("/openapi.json", requireIntegration(), (req, res) => {
  res.json(openApiDocument({
    version: packageVersion(),
    servers: [{ url: `${req.protocol}://${req.get("host")}`, description: "This instance" }],
  }));
});

/**
 * Ce que sert cette version, et sous quelles portées. Ouvert à toute clé
 * valable quelle que soit sa portée : un intégrateur doit pouvoir
 * découvrir ce qui lui manque sans écrire à un administrateur.
 */
r.get("/", requireIntegration(), (req, res) => {
  res.json({
    ...stamp(),
    integration: req.user.displayName,
    scopesHeld: req.user.scopes,
    describedBy: "/api/v1/openapi.json",
    /* Lu dans la description, pas recopié : une route ajoutée là-bas
       apparaît ici sans qu'on y pense. */
    endpoints: scopedEndpoints(),
  });
});

export default r;

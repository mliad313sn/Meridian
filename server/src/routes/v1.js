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
import { readAudit } from "../audit.js";
import { requireIntegration } from "../integrations.js";
import { openApiDocument, scopedEndpoints } from "../openapi.js";
import { packageVersion } from "../env.js";
import {
  idempotent, upsertProject, upsertMilestone, upsertRaid, upsertDecision, upsertAction,
  upsertActivity, upsertWorkItem,
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

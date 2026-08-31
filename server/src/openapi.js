/**
 * INT-01 — la description de l'API, engendrée depuis les routes réelles.
 *
 * Le comité d'interopérabilité a posé cette ligne juste après la serrure :
 * sans contrat publié, **rien n'est intégrable**, et un intégrateur doit
 * lire le code source pour deviner une forme qu'on ne s'engage pas à
 * tenir. C'est aussi la deuxième question de l'attaque du concurrent
 * ([`24`](../../docs/24-comite-marche.md) §6) : « qui signe l'engagement,
 * et sur quelle version ? »
 *
 * ── Pourquoi ce fichier ne CONTIENT pas la liste des routes ─────────
 *
 * Une description écrite à côté du code se périme, et elle se périme en
 * silence : le jour où quelqu'un ajoute une route, la description reste
 * juste-mais-incomplète, ce qui est la pire des deux erreurs — elle
 * inspire confiance et ment par omission.
 *
 * Ici, les chemins et les méthodes sont LUS dans le routeur Express
 * (`router.stack`), et seuls les textes — ce que fait chaque route, quelle
 * portée elle exige, ce qu'elle rend — sont écrits à la main dans `DOCS`.
 * Une route ajoutée sans son entrée fait échouer la porte F9 ; une entrée
 * qui ne correspond à aucune route aussi. La description ne peut donc pas
 * dériver du code, dans un sens comme dans l'autre.
 */

import v1Router from "./routes/v1.js";
import { SCOPES } from "./integrations.js";

export const CONTRACT = "v1";

/** Les chemins et méthodes RÉELLEMENT montés, lus dans le routeur. */
export function mountedRoutes(router = v1Router) {
  const out = [];
  for (const layer of router.stack ?? []) {
    if (!layer.route) continue;
    const path = layer.route.path === "/" ? "" : layer.route.path;
    for (const [method, on] of Object.entries(layer.route.methods ?? {})) {
      if (on) out.push({ method: method.toUpperCase(), path: `/api/v1${path}` });
    }
  }
  return out.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}

/**
 * Ce que chaque route fait, et sous quelle portée. Clé : « MÉTHODE chemin ».
 * C'est la seule partie écrite à la main, et c'est voulu : une phrase qui
 * explique à quoi sert une route ne s'engendre pas.
 */
const DOCS = {
  "GET /api/v1": {
    summary: "What this contract serves, and what your key may reach",
    description:
      "Open to any live key, whatever its scopes, so an integrator can read what " +
      "they are missing without writing to an administrator.",
    scope: null,
    returns: {
      contract: "string", generatedAt: "date-time", integration: "string",
      scopesHeld: "string[]", endpoints: "object[]",
    },
  },
  "GET /api/v1/openapi.json": {
    summary: "This contract, as served by this instance",
    description:
      "The same document published at docs/openapi.v1.json, carrying the version " +
      "actually running here and the address it was asked at — two things a file " +
      "in a repository cannot know. Open to any live key.",
    scope: null,
    returns: { openapi: "string", info: "object", servers: "object[]", paths: "object" },
  },
  "GET /api/v1/portfolio": {
    summary: "The whole portfolio the key is entitled to read",
    description:
      "The same output the screens are drawn from — deliberately, because two " +
      "projections would drift apart at the first change and an integrator would " +
      "then be reading numbers nobody can see in the product. Money is in millions; " +
      "dates are ISO-8601 calendar dates.",
    scope: "read:portfolio",
    returns: {
      contract: "string", generatedAt: "date-time", asAt: "date",
      counts: "object", portfolio: "object",
    },
  },
  "GET /api/v1/audit": {
    summary: "The audit trail — every recorded decision and change",
    description:
      "Its own scope, because it is the most sensitive read in the product: a " +
      "system that copies the portfolio into a warehouse has no reason to carry " +
      "away who approved what. Filters: entity, entityId, action, limit, before.",
    scope: "read:audit",
    returns: { contract: "string", generatedAt: "date-time", events: "object[]" },
  },
};

/** Ce que dit la description, mais que le routeur ne peut pas dire. */
export function documented() {
  return Object.keys(DOCS).map((k) => {
    const [method, ...rest] = k.split(" ");
    return { method, path: rest.join(" ") };
  }).sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}

const jsonSchema = (shape) => ({
  type: "object",
  properties: Object.fromEntries(Object.entries(shape).map(([k, kind]) => {
    if (kind === "date-time") return [k, { type: "string", format: "date-time" }];
    if (kind === "date") return [k, { type: "string", format: "date" }];
    if (kind === "string[]") return [k, { type: "array", items: { type: "string" } }];
    if (kind === "object[]") return [k, { type: "array", items: { type: "object" } }];
    return [k, { type: kind }];
  })),
});

/**
 * Le document OpenAPI 3.1.
 *
 * `version` vient du paquet : c'est le même numéro que rend
 * `/api/health`, de sorte qu'une description récupérée quelque part se
 * rattache à un binaire précis (P-02). Sans cela, « c'était comme ça chez
 * nous » et « pas chez moi » ne se départagent pas.
 */
export function openApiDocument({ version = "dev", servers = [] } = {}) {
  const paths = {};
  for (const { method, path } of mountedRoutes()) {
    const doc = DOCS[`${method} ${path}`];
    if (!doc) continue;   // la porte F9 le refuse ; ici on ne ment pas par défaut
    paths[path] ??= {};
    paths[path][method.toLowerCase()] = {
      summary: doc.summary,
      description: doc.description,
      security: [{ apiKey: [] }],
      "x-required-scope": doc.scope,
      responses: {
        200: {
          description: "The document described above",
          content: { "application/json": { schema: jsonSchema(doc.returns) } },
        },
        401: { description: "No key, an unknown key, or a revoked key — the three are indistinguishable on purpose" },
        403: { description: "The key is live but does not carry the scope this route requires" },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Meridian IT-PMO",
      version,
      summary: "Read a governed project portfolio, and the trail of how it got that way",
      description:
        "The surface other systems read. It is versioned in the path: the day the " +
        "shape has to change it becomes /api/v2, so that nobody has to guess. " +
        "Authentication is a key issued per connected system, carrying explicit " +
        "scopes; the product never stores the key itself, only its fingerprint.\n\n" +
        "There is no write surface yet, and that is deliberate: a scope is only " +
        "published once a route honours it. Declaring one earlier would advertise " +
        "a door that does not exist and imply it is guarded.",
      license: { name: "Apache-2.0", identifier: "Apache-2.0" },
    },
    servers: servers.length ? servers : [{ url: "http://localhost:4173", description: "A local instance" }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey", in: "header", name: "X-API-Key",
          description: "Issued from Administration → Connected systems. " +
                       "`Authorization: Bearer <key>` is accepted too.",
        },
      },
      "x-scopes": SCOPES,
    },
    security: [{ apiKey: [] }],
    paths,
  };
}

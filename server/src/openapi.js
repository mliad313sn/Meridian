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
import { WRITE_BODIES } from "./v1write.js";

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

/* I-2 — les sept écritures, décrites une fois chacune. Le corps est lu
   dans v1write.js (WRITE_BODIES) : la description et la route ne peuvent
   pas diverger sur ce qu'un PUT accepte. */
const UPSERT_RETURNS = { contract: "string", generatedAt: "date-time", id: "string",
  externalId: "string", created: "boolean", version: "integer" };
const upsert = (what, scope, extra) => ({
  summary: `Create or update ${what}, keyed by your own identifier`,
  description:
    `Creates the ${what} when nothing carries this externalId for your integration, updates it ` +
    `otherwise. The identity is (integration, externalId): two connected systems may both say ` +
    `"E01" without colliding. \`version\` is optional — when sent it is asserted (409 if stale); ` +
    `when omitted your system is the master of this row and the last write wins. Optional ` +
    `\`Idempotency-Key\` header: the same key with the same body replays the recorded answer ` +
    `(Idempotent-Replayed: true); the same key with another body is refused (422) — one key names ONE ` +
    `request, not a run. \`adopt: "<Meridian id>"\` binds your externalId to a row that already exists ` +
    `(created on a screen, or scaffolded) instead of creating another. ` +
    `The same business rules as the screens apply. ${extra}`,
  scope, returns: UPSERT_RETURNS,
});
const WRITE_DOCS = {
  "PUT /api/v1/projects/:externalId": upsert("a project", "write:portfolio",
    "Creation needs programme, site, start and finish; the schedule, the gate milestones and the " +
    "evidence documents are scaffolded as when a person creates one. Money is in millions."),
  "PUT /api/v1/milestones/:externalId": upsert("a milestone", "write:portfolio",
    "`project` is a Meridian id or an externalId you created. A milestone with acceptanceCriteria " +
    "cannot be marked done without acceptedBy — the person who checked them (PM-04). `dateBasis: " +
    "\"placeholder\"` with a `condition` says the date is a position on the timeline, not a commitment: " +
    "it is never reported missed or overdue until you make it `committed` (REQ-14)."),
  "PUT /api/v1/raid/:externalId": upsert("a register item (risk, issue, assumption, dependency)", "write:portfolio",
    "`gate` links it to a governance gate of the project, `cr` to a change request of the same project (I-8). " +
    "Omit `project` for a portfolio-wide item."),
  "PUT /api/v1/activities/:externalId": upsert("the link to a schedule stage, and its measured progress", "write:portfolio",
    "Stages are not created by integrations — the plan belongs to the project. The first call binds " +
    "your id to an existing stage (`activity`); every call may carry `pct`, stamped with `source` and " +
    "`measuredAt` so earned value reads measured, not typed, progress (I-5)."),
  "PUT /api/v1/workitems/:externalId": upsert("a work item on the board", "write:portfolio",
    "`column` is a column id or name; `assignee` an id or exact name."),
  "PUT /api/v1/criteria/:externalId": upsert("a gate criterion", "write:portfolio",
    "A sentence posed in advance on (project, gate — within the programme's ladder). `met: true` needs " +
    "`reviewedBy`, a named person who does not own the `document` cited; the gate is ready only when every " +
    "criterion is met. Adopt a scaffolded criterion with `adopt`."),
  "PUT /api/v1/decisions/:externalId": upsert("a decision outside a meeting", "write:meetings",
    "Named by `decidedBy` (a person) or `council` (the deciding body). The substance — headline, rationale, " +
    "alternatives, dissent — is immutable: a different substance answers 409 — record a new decision naming " +
    "the old one in `supersedes` (I-7). The state — `status` Proposed|Ratified, `ratifiedBy`, `evidenceUri`, " +
    "`provenance` — may change, and each change is audited with before/after."),
  "PUT /api/v1/actions/:externalId": upsert("an action", "write:meetings",
    "An action is raised in an OPEN meeting: send `occurrence` (an open occurrence id) or `series` " +
    "(the series whose open occurrence takes it). The API never opens a meeting — a chair does."),
};
Object.assign(DOCS, WRITE_DOCS);

/** Les routes qui exigent une portée, pour la découverte. */
export function scopedEndpoints() {
  return Object.entries(DOCS)
    .filter(([, d]) => d.scope)
    .map(([k, d]) => { const [method, path] = k.split(" "); return { method, path, scope: d.scope }; });
}

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
    if (kind === "date-time") return [k, { type: "string", format: "date-time" }];
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
    /* OpenAPI nomme un paramètre de chemin `{nom}`. Express l'écrit
       `:nom`. Publier la forme d'Express faisait envoyer à tout client
       engendré le littéral « :externalId » — la description décrivait une
       route que personne ne pouvait appeler. (Intégrateur, docs/33 §5.) */
    const openApiPath = path.replace(/:(\w+)/g, "{$1}");
    paths[openApiPath] ??= {};
    const collection = /^\/api\/v1\/(\w+)\/:externalId$/.exec(path)?.[1];
    const body = collection && WRITE_BODIES[collection];
    const pathParams = [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      name, in: "path", required: true, schema: { type: "string", maxLength: 200 },
      description: name === "externalId"
        ? "Your own identifier for this row — stable across runs, unique within your integration"
        : "The Meridian identifier of the row",
    }));
    /* REQ-02 tient sur cet en-tête ; il n'était écrit qu'en prose, donc
       aucun client engendré ne l'exposait. */
    const idempotency = body ? [{
      name: "Idempotency-Key", in: "header", required: false,
      schema: { type: "string", maxLength: 200 },
      description: "One key names ONE request. The same key with the same body replays the recorded " +
        "answer (response header Idempotent-Replayed: true); the same key with a different body is refused (422).",
    }] : [];
    paths[openApiPath][method.toLowerCase()] = {
      summary: doc.summary,
      description: doc.description,
      security: [{ apiKey: [] }],
      "x-required-scope": doc.scope,
      ...(pathParams.length || idempotency.length
        ? { parameters: [...pathParams, ...idempotency] } : {}),
      ...(body ? { requestBody: { required: true, content: { "application/json": { schema: jsonSchema(body) } } } } : {}),
      responses: {
        200: {
          description: "The document described above",
          content: { "application/json": { schema: jsonSchema(doc.returns) } },
        },
        ...(body ? {
          201: { description: "Created — the row did not exist for this externalId",
            content: { "application/json": { schema: jsonSchema(doc.returns) } } },
          400: { description: "The body breaks a rule the screens enforce too; the message says which" },
          409: { description: "A stale version, an immutable decision, or a meeting that is not open" },
          422: { description: "Idempotency-Key reused with a different request" },
        } : {}),
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
        "Writes arrived with the first real integrator (RT365, docs/33): PUT by your " +
        "own identifier on projects, milestones, register items, stage progress, work " +
        "items, decisions and actions, under two write scopes, with an optional " +
        "Idempotency-Key. A scope is only published once a route honours it: declaring " +
        "one earlier would advertise a door that does not exist and imply it is guarded.",
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

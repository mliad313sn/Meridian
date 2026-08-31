/**
 * INT-02 · Les intégrations nommées, à portée limitée.
 *
 * Le comité d'interopérabilité a placé cette ligne AVANT l'API publique :
 * ouvrir une interface sur une clé unique et toute-puissante aurait été
 * le plus grave défaut que ce produit ait porté, et il aurait été de
 * notre fait.
 *
 * Ces tests tiennent les cinq propriétés qui le rendent sûr :
 *
 *   · la clé n'est jamais stockée, et ne sort qu'une fois ;
 *   · une portée absente vaut « rien », jamais « tout » ;
 *   · une clé de lecture du portefeuille ne lit PAS la piste d'audit ;
 *   · révoquer une intégration coupe la sienne et aucune autre ;
 *   · une clé n'ouvre jamais l'interface interactive.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client } from "./harness.js";
import { one } from "../src/db.js";
import { normaliseScopes, SCOPES } from "../src/integrations.js";
import { mountedRoutes } from "../src/openapi.js";

before(async () => { await boot(); });
after(shutdown);

/** Crée une intégration par la vraie route et rend {id, key}. */
async function mint(admin, name, scopes) {
  const r = await admin.post("/api/admin/integrations", { name, scopes, purpose: "test" });
  assert.equal(r.status, 201, r.text);
  return r.body;
}

/** Un appel machine : pas de cookie, une clé dans l'en-tête. */
const withKey = (c, key) => (path) => c.get(path, { "X-API-Key": key });

describe("INT-02 · la clé", () => {
  test("elle ne sort qu'une fois, et la base n'en garde que l'empreinte", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Entrepôt décisionnel", "read:portfolio");
    assert.ok(made.key && made.key.length > 30, "une clé est rendue à la création");
    assert.match(made.notice, /shown once/i);

    const row = await one(`SELECT key_hash, key_hint FROM integration WHERE id = $1`, [made.id]);
    assert.notEqual(row.key_hash, made.key, "la clé en clair n'est pas la valeur stockée");
    assert.match(row.key_hash, /^[0-9a-f]{64}$/, "c'est une empreinte SHA-256");
    assert.equal(row.key_hint, made.key.slice(-4), "seuls quatre caractères aident à la reconnaître");

    /* Et la liste ne la rend jamais — c'est ce qui rend la rotation
       banale plutôt que redoutée. */
    const list = await admin.get("/api/admin/integrations");
    const seen = list.body.integrations.find((i) => i.id === made.id);
    assert.equal("key_hash" in seen, false);
    assert.equal(JSON.stringify(list.body).includes(made.key), false,
      "la clé en clair n'apparaît nulle part après sa création");
  });

  test("une portée inconnue est refusée à la création, pas ignorée", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/admin/integrations",
      { name: "Trop gourmande", scopes: "read:portfolio,write:everything" });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Unknown scope/i);
    assert.match(r.body.error, /write:everything/);
  });

  test("les portées sont dédoublonnées et ordonnées", () => {
    assert.equal(normaliseScopes("read:audit, read:portfolio ,read:audit"),
      "read:audit,read:portfolio");
    assert.equal(normaliseScopes(""), "", "aucune portée demandée = aucune portée");
    assert.equal(normaliseScopes(null), "");
  });
});

describe("INT-02 · la portée décide, et elle décide seule", () => {
  test("une clé de portefeuille lit le portefeuille", async () => {
    const admin = await as("admin");
    const { key } = await mint(admin, "Power BI", "read:portfolio");
    const get = withKey(client(), key);

    const r = await get("/api/v1/portfolio");
    assert.equal(r.status, 200);
    assert.equal(r.body.contract, "v1");
    assert.ok(r.body.counts.projects > 0, "elle voit le portefeuille entier");
    assert.ok(r.body.portfolio.projects.length > 0);
  });

  test("… et ne lit PAS la piste d'audit", async () => {
    const admin = await as("admin");
    const { key } = await mint(admin, "Power BI 2", "read:portfolio");
    const get = withKey(client(), key);

    const r = await get("/api/v1/audit");
    assert.equal(r.status, 403, "la lecture la plus sensible a sa propre portée");
    assert.match(r.body.error, /read:audit/);
    assert.deepEqual(r.body.held, ["read:portfolio"],
      "le refus dit ce que la clé porte, pour qu'on sache quoi demander");
  });

  test("une clé sans aucune portée ne peut rien, mais se découvre", async () => {
    const admin = await as("admin");
    const { key } = await mint(admin, "Pas encore branchée", "");
    const get = withKey(client(), key);

    assert.equal((await get("/api/v1/portfolio")).status, 403);
    assert.equal((await get("/api/v1/audit")).status, 403);

    /* Fermé par défaut ne veut pas dire muet : l'intégrateur doit pouvoir
       lire ce qui lui manque sans écrire à un administrateur. */
    const disco = await get("/api/v1/");
    assert.equal(disco.status, 200);
    assert.deepEqual(disco.body.scopesHeld, []);
    assert.equal(disco.body.integration, "Pas encore branchée");
    assert.equal(disco.body.endpoints.length, Object.keys(SCOPES).length);
  });
});

describe("INT-02 · ce qu'une clé ne peut jamais faire", () => {
  test("elle n'ouvre pas l'interface interactive", async () => {
    const admin = await as("admin");
    const { key } = await mint(admin, "Curieuse", "read:portfolio,read:audit");
    const c = client();

    /* Les routes de session refusent : la clé n'est pas un cookie, et le
       rôle `service` n'existe pas pour rbac.can(). */
    assert.equal((await c.get("/api/bootstrap", { "X-API-Key": key })).status, 401);
    assert.equal((await c.get("/api/admin/users", { "X-API-Key": key })).status, 401);
  });

  test("aucune session ne peut être frappée pour son compte", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Sans mot de passe", "read:portfolio");
    const row = await one(
      `SELECT active, pw_hash, display_name FROM app_user WHERE id = $1`, [made.id]);
    assert.ok(row, "elle a une ligne de compte — c'est ce qui la nomme dans la piste");
    assert.equal(row.active, false);
    assert.equal(row.pw_hash, "unusable");
    assert.equal(row.display_name, "Sans mot de passe");
  });

  test("son compte fantôme n'apparaît pas dans la liste des comptes", async () => {
    /* Trouvé à l'écran, pas en test : la ligne `app_user` qui existe pour
       que la piste puisse NOMMER l'intégration se présentait comme un
       compte ordinaire, avec « Modifier » et « Habilitations ». Ce n'est
       pas quelqu'un. */
    const admin = await as("admin");
    const made = await mint(admin, "Fantôme", "read:portfolio");
    const users = (await admin.get("/api/admin/users")).body.users;
    assert.equal(users.some((u) => u.id === made.id), false,
      "un compte de service n'est pas un compte de personne");
    assert.equal(users.some((u) => String(u.email).endsWith(".invalid")), false);
    /* …mais il reste visible là où il a un sens. */
    const list = (await admin.get("/api/admin/integrations")).body.integrations;
    assert.ok(list.some((i) => i.id === made.id), "elle se gère depuis « Systèmes branchés »");
  });

  test("une clé inconnue et une clé révoquée répondent exactement pareil", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "À révoquer", "read:portfolio");
    const c = client();
    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": made.key })).status, 200);

    const list = await admin.get("/api/admin/integrations");
    const row = list.body.integrations.find((i) => i.id === made.id);
    const off = await admin.patch(`/api/admin/integrations/${made.id}`,
      { active: false, version: row.row_version });
    assert.equal(off.status, 200);

    const revoked = await c.get("/api/v1/portfolio", { "X-API-Key": made.key });
    const unknown = await c.get("/api/v1/portfolio", { "X-API-Key": "cette-cle-n-a-jamais-existe" });
    assert.equal(revoked.status, 401);
    assert.deepEqual(revoked.body, unknown.body,
      "un scanner n'apprend pas si une clé a existé");
  });

  test("révoquer l'une ne coupe pas les autres", async () => {
    const admin = await as("admin");
    const a = await mint(admin, "Reste branchée", "read:portfolio");
    const b = await mint(admin, "Part", "read:portfolio");
    const c = client();

    const list = await admin.get("/api/admin/integrations");
    const rowB = list.body.integrations.find((i) => i.id === b.id);
    await admin.patch(`/api/admin/integrations/${b.id}`,
      { active: false, version: rowB.row_version });

    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": b.key })).status, 401);
    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": a.key })).status, 200,
      "c'est exactement ce que la clé unique rendait impossible");
  });
});

describe("INT-02 · la rotation, et le nom dans la piste", () => {
  test("tourner la clé arrête l'ancienne à l'instant", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "À tourner", "read:portfolio");
    const c = client();
    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": made.key })).status, 200);

    const rot = await admin.post(`/api/admin/integrations/${made.id}/rotate`, {});
    assert.equal(rot.status, 200);
    assert.notEqual(rot.body.key, made.key);

    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": made.key })).status, 401);
    assert.equal((await c.get("/api/v1/portfolio", { "X-API-Key": rot.body.key })).status, 200);
  });

  test("chaque acte sur une intégration laisse une ligne qui la NOMME", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Tracée", "read:audit");
    const trail = await one(
      `SELECT action, detail FROM audit_event
        WHERE entity = 'integration' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [made.id]);
    assert.equal(trail.action, "Integration created");
    assert.match(trail.detail, /Tracée/);
    assert.match(trail.detail, /read:audit/, "la portée accordée est dans la trace");
  });

  test("se servir de la clé marque quand elle a servi", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Horodatée", "read:portfolio");
    const before = await one(`SELECT last_used_at FROM integration WHERE id = $1`, [made.id]);
    assert.equal(before.last_used_at, null, "jamais employée");

    await client().get("/api/v1/portfolio", { "X-API-Key": made.key });
    /* La marque est posée sans await côté serveur : on laisse un tour de
       boucle avant de la lire, plutôt que de tester une course. */
    await new Promise((r) => setTimeout(r, 250));
    const after = await one(`SELECT last_used_at FROM integration WHERE id = $1`, [made.id]);
    assert.ok(after.last_used_at, "une clé inutilisée depuis six mois est une clé qu'on peut couper");
  });
});

describe("INT-01 · le contrat publié", () => {
  test("la description est servie, et décrit ce qui est réellement monté", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Intégrateur curieux", "");
    const c = client();
    const r = await c.get("/api/v1/openapi.json", { "X-API-Key": made.key });
    assert.equal(r.status, 200, "une clé sans portée lit quand même le contrat");

    const doc = r.body;
    assert.equal(doc.openapi, "3.1.0");
    assert.equal(doc.info.license.identifier, "Apache-2.0");
    /* La description dit les MÊMES routes que le routeur : c'est la porte
       F9 qui le tient à la construction, et ceci qui le tient à
       l'exécution — une description juste dans le dépôt et fausse en
       service n'aurait servi personne. */
    const decrites = Object.keys(doc.paths).sort();
    assert.deepEqual(decrites, mountedRoutes().map((x) => x.path).sort()
      .filter((v, i, a) => a.indexOf(v) === i));

    /* Chaque route dit la portée qu'elle exige — c'est ce qu'un
       intégrateur vient chercher avant de demander une clé. */
    assert.equal(doc.paths["/api/v1/audit"].get["x-required-scope"], "read:audit");
    assert.equal(doc.paths["/api/v1/portfolio"].get["x-required-scope"], "read:portfolio");
    assert.equal(doc.paths["/api/v1/openapi.json"].get["x-required-scope"], null);
  });

  test("la version servie est celle du binaire, pas celle du fichier publié", async () => {
    const admin = await as("admin");
    const made = await mint(admin, "Intégrateur versionné", "read:portfolio");
    const c = client();
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": made.key })).body;
    const health = (await c.get("/api/health")).body;
    assert.equal(doc.info.version, health.version,
      "sinon « c'était comme ça chez nous » et « pas chez moi » ne se départagent pas");
    assert.match(doc.servers[0].url, /^http:\/\/127\.0\.0\.1:\d+$/,
      "l'adresse est celle à laquelle on l'a demandé");
  });

  test("sans clé du tout, le contrat ne se lit pas", async () => {
    assert.equal((await client().get("/api/v1/openapi.json")).status, 401,
      "la forme d'une API est de la reconnaissance : fermé par défaut");
  });
});

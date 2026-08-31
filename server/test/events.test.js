/**
 * INT-04 · Les événements sortants signés.
 *
 * Ce qui rend Meridian réactif pour les autres systèmes. Cinq propriétés :
 *
 *   · la liste des actions est LA MÊME que celle de reporting.decisions —
 *     tenue en lisant la définition SQL de la vue, dans les deux sens ;
 *   · une décision réelle part, signée HMAC, et la signature se vérifie ;
 *   · un abonné en panne est réessayé, pas oublié — et l'échec définitif
 *     se lit dans le journal, il ne s'évapore pas ;
 *   · brancher un abonné ne lui déverse pas l'histoire d'avant lui ;
 *   · le secret ne sort jamais par l'API.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { one, many, query } from "../src/db.js";
import { sweepEvents, GOVERNANCE_ACTIONS, signBody, acceptableWebhook } from "../src/events.js";

before(async () => { await boot(); });
after(shutdown);

/** Un abonné réel : un serveur HTTP local qui garde ce qu'il reçoit. */
function subscriber({ fail = false } = {}) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ headers: req.headers, body });
      res.statusCode = fail ? 500 : 200;
      res.end();
    });
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => resolve({
      url: `http://127.0.0.1:${srv.address().port}/hook`,
      seen, close: () => new Promise((r) => srv.close(r)),
    }));
  });
}

async function mintSubscriber(admin, name, url, secret) {
  const made = await admin.post("/api/admin/integrations",
    { name, scopes: "read:portfolio" });
  assert.equal(made.status, 201);
  const list = (await admin.get("/api/admin/integrations")).body.integrations;
  const row = list.find((i) => i.id === made.body.id);
  const upd = await admin.patch("/api/admin/integrations/" + made.body.id,
    { webhookUrl: url, webhookSecret: secret, version: row.row_version });
  assert.equal(upd.status, 200, upd.text);
  return made.body.id;
}

describe("INT-04 · une seule liste d'actions, deux lecteurs", () => {
  test("la liste JS et le filtre de reporting.decisions disent la même chose", async () => {
    const def = (await one(
      `SELECT pg_get_viewdef('reporting.decisions'::regclass) AS d`)).d;
    for (const a of GOVERNANCE_ACTIONS) {
      assert.ok(def.includes(`'${a}'`),
        `« ${a} » est livré comme événement mais absent de la vue — deux vérités`);
    }
    const inView = [...def.matchAll(/'([^']{4,60})'/g)].map((m) => m[1])
      .filter((s) => /^[A-Z]/.test(s));
    for (const a of inView) {
      assert.ok(GOVERNANCE_ACTIONS.includes(a),
        `« ${a} » est dans la vue mais ne se livre pas — deux vérités, l'autre sens`);
    }
  });

  test("un webhook n'est acceptable qu'en HTTPS, boucle locale exceptée", () => {
    assert.equal(acceptableWebhook("https://flow.example.com/x"), true);
    assert.equal(acceptableWebhook("http://127.0.0.1:9999/x"), true);
    assert.equal(acceptableWebhook("http://flow.example.com/x"), false);
    assert.equal(acceptableWebhook("ftp://x"), false);
    assert.equal(acceptableWebhook(""), true, "vide = pas d'abonnement, jamais une erreur");
  });
});

describe("INT-04 · la livraison", () => {
  test("une décision réelle part, signée, et la signature se vérifie", async () => {
    const admin = await as("admin");
    const sub = await subscriber();
    const secret = "s3cret-du-test";
    await mintSubscriber(admin, "Power Automate", sub.url, secret);

    /* Une décision de gouvernance réelle, par la vraie route. */
    const group = await as("groupDCH");
    const put = await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 60, note: "événement de test" });
    assert.equal(put.status, 201);

    const out = await sweepEvents();
    assert.ok(out.delivered >= 1, "au moins la décision qu'on vient de prendre");

    const hit = sub.seen.find((s) => s.body.includes("Tolerance set"));
    assert.ok(hit, "l'abonné a reçu la décision");
    const doc = JSON.parse(hit.body);
    assert.equal(doc.contract, "v1");
    assert.equal(doc.event.action, "Tolerance set");
    assert.match(doc.event.detail, new RegExp(SITE_PROJECT_GRU));

    /* La vérification que le RÉCEPTEUR doit faire — on la fait ici pour
       prouver qu'elle est possible telle que documentée. */
    const expected = "sha256=" + crypto.createHmac("sha256", secret)
      .update(hit.body, "utf8").digest("hex");
    assert.equal(hit.headers["x-meridian-signature"], expected,
      "un webhook non signé s'usurpe avec un curl ; celui-ci se vérifie");
    assert.equal(signBody(secret, hit.body), expected);
    await sub.close();
  });

  test("un abonné en panne est réessayé — et l'échec définitif se lit", async () => {
    const admin = await as("admin");
    const sub = await subscriber({ fail: true });
    const id = await mintSubscriber(admin, "Abonné en panne", sub.url, "x");

    const group = await as("groupDCH");
    await group.put(`/api/projects/${SITE_PROJECT_GRU}/tolerance`,
      { scheduleDays: 61, note: "pour l'abonné en panne" });

    await sweepEvents();
    let row = await one(
      `SELECT status, attempts, last_error FROM event_delivery
        WHERE integration_id = $1 ORDER BY id DESC LIMIT 1`, [id]);
    assert.equal(row.status, "Pending", "un échec n'est pas un abandon");
    assert.equal(row.attempts, 1);
    assert.match(row.last_error, /HTTP 500/);

    /* Sept passages de plus : l'échec devient définitif et LISIBLE. */
    for (let i = 0; i < 7; i++) await sweepEvents();
    row = await one(
      `SELECT status, attempts FROM event_delivery
        WHERE integration_id = $1 ORDER BY id DESC LIMIT 1`, [id]);
    assert.equal(row.status, "Failed");
    assert.equal(row.attempts, 8);

    const log = await admin.get(`/api/admin/integrations/${id}/deliveries`);
    assert.equal(log.status, 200);
    assert.ok(log.body.deliveries.some((d) => d.status === "Failed"),
      "un webhook mort en silence est un abonné qui croit être au courant — ici, ça se lit");
    await sub.close();
  });

  test("brancher un abonné ne lui déverse pas l'histoire d'avant lui", async () => {
    const admin = await as("admin");
    const before = (await many(
      `SELECT count(*)::int AS n FROM audit_event WHERE action = ANY($1)`,
      [GOVERNANCE_ACTIONS]))[0].n;
    assert.ok(before > 0, "il existe des décisions antérieures");

    const sub = await subscriber();
    const id = await mintSubscriber(admin, "Nouvel abonné", sub.url, "y");
    await sweepEvents();
    const got = await many(
      `SELECT d.id FROM event_delivery d JOIN audit_event a ON a.id = d.audit_id
        WHERE d.integration_id = $1 AND a.at < (SELECT created_at FROM integration WHERE id = $1)`,
      [id]);
    assert.equal(got.length, 0,
      "l'histoire se lit par l'API si on la veut ; elle ne se déverse pas");
    await sub.close();
  });

  test("le secret du webhook ne sort jamais par l'API", async () => {
    const admin = await as("admin");
    const list = await admin.get("/api/admin/integrations");
    const text = JSON.stringify(list.body);
    assert.equal(text.includes("s3cret-du-test"), false);
    assert.equal(/"webhook_secret"\s*:/.test(text), false,
      "seul « un secret est posé » se lit, jamais le secret");
    assert.ok(list.body.integrations.some((i) => i.webhook_secret_set === true));
  });
});

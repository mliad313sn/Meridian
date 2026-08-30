/**
 * N-07 — le contrôle de vie de la preuve.
 *
 * La règle qui gouverne tout ce fichier : la sonde ne juge pas. Une
 * liaison qui tombe ne désapprouve pas un jalon.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { many, query } from "../src/db.js";
import { probeEvidence } from "../src/probe.js";

before(async () => { await boot(); });
after(shutdown);

/** Un faux transport : la sonde ne doit jamais sortir pendant un test. */
const answering = (map) => async (url, { method }) => {
  const status = map[url] ?? 200;
  if (status === 405 && method === "HEAD") return { status: 405 };
  return { status };
};

async function approvedDoc(uri) {
  const admin = await as("admin");
  await admin.patch("/api/admin/settings", { documentHosts: "docs.meridian.example" });
  const made = await admin.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Preuve sondée " + Math.random().toString(36).slice(2, 7),
    gate: 2, owner: "PE-19", uri,
  });
  await admin.patch("/api/documents/" + made.body.id, { status: "Approved", version: 1 });
  return made.body.id;
}

test("N-07 — sans hôtes de confiance, la sonde s'abstient et le dit", async () => {
  const admin = await as("admin");
  await admin.patch("/api/admin/settings", { documentHosts: "" });
  const out = await probeEvidence({ fetchImpl: async () => { throw new Error("ne doit pas sortir"); } });
  assert.equal(out.probed, 0);
  assert.match(out.skipped, /no trusted document hosts/i);
  await admin.patch("/api/admin/settings", { documentHosts: "docs.meridian.example" });
});

test("N-07 — un lien qui répond est noté vivant, et le statut ne bouge pas", async () => {
  const id = await approvedDoc("https://docs.meridian.example/vivant.pdf");
  const out = await probeEvidence({ fetchImpl: answering({}) });
  assert.ok(out.probed >= 1);
  const d = (await many(`SELECT probe_state, probe_fails, status FROM document WHERE id = $1`, [id]))[0];
  assert.equal(d.probe_state, "ok");
  assert.equal(d.probe_fails, 0);
  assert.equal(d.status, "Approved");
});

test("N-07 — un lien mort n'est jamais une désapprobation", async () => {
  const uri = "https://docs.meridian.example/mort.pdf";
  const id = await approvedDoc(uri);
  await probeEvidence({ fetchImpl: answering({ [uri]: 404 }) });
  const d = (await many(`SELECT probe_state, probe_status, status FROM document WHERE id = $1`, [id]))[0];
  assert.equal(d.probe_state, "unreachable");
  assert.equal(d.probe_status, 404);
  assert.equal(d.status, "Approved", "le jugement reste humain — rien n'est retiré");
});

test("N-07 — un refus d'accès n'est pas une perte", async () => {
  const uri = "https://docs.meridian.example/prive.pdf";
  const id = await approvedDoc(uri);
  await probeEvidence({ fetchImpl: answering({ [uri]: 403 }) });
  const d = (await many(`SELECT probe_state FROM document WHERE id = $1`, [id]))[0];
  assert.equal(d.probe_state, "forbidden",
    "la pièce est peut-être là, derrière une authentification — le dire autrement");
});

test("N-07 — HEAD refusé se replie sur GET plutôt que de conclure", async () => {
  const uri = "https://docs.meridian.example/nohead.pdf";
  const id = await approvedDoc(uri);
  let sawGet = false;
  await probeEvidence({ fetchImpl: async (u, { method }) => {
    if (u === uri && method === "HEAD") return { status: 405 };
    if (u === uri && method === "GET") { sawGet = true; return { status: 200 }; }
    return { status: 200 };
  } });
  assert.ok(sawGet, "le repli a bien eu lieu");
  assert.equal((await many(`SELECT probe_state FROM document WHERE id = $1`, [id]))[0].probe_state, "ok");
});

test("N-07 — trois échecs avant d'avertir, et le message ne retire rien", async () => {
  const uri = "https://docs.meridian.example/troisfois.pdf";
  const id = await approvedDoc(uri);
  const dead = answering({ [uri]: 404 });

  await probeEvidence({ fetchImpl: dead });
  await probeEvidence({ fetchImpl: dead });
  let n = await many(`SELECT count(*)::int c FROM notification WHERE entity_id = $1`, [id]);
  assert.equal(n[0].c, 0, "un hoquet de liaison ne réveille personne");

  const out = await probeEvidence({ fetchImpl: dead });
  assert.ok(out.alerted >= 1);
  const msg = await many(
    `SELECT kind, severity, subject, body FROM notification WHERE entity_id = $1`, [id]);
  assert.equal(msg[0].kind, "evidence-unreachable");
  assert.equal(msg[0].severity, "attention");
  assert.match(msg[0].body, /nothing has been withdrawn/i);
});

test("N-07 — la sonde n'interroge que les hôtes déjà autorisés", async () => {
  /* Un document approuvé avant un resserrement de la liste : la sonde ne
     doit pas ouvrir un flux vers un hôte que le mandant n'autorise plus. */
  const id = await approvedDoc("https://docs.meridian.example/ailleurs.pdf");
  await query(`UPDATE document SET uri = 'https://autre.example/x.pdf' WHERE id = $1`, [id]);
  const seen = [];
  await probeEvidence({ fetchImpl: async (u) => { seen.push(u); return { status: 200 }; } });
  assert.ok(!seen.some((u) => u.includes("autre.example")),
    "hors de documentHosts, rien ne sort");
});

test("N-07 — la mesure que le comité a demandée est calculée", async () => {
  const out = await probeEvidence({ fetchImpl: answering({}) });
  assert.ok(typeof out.reachedPct === "number" || out.reachedPct === null);
  if (out.probed) assert.ok(out.reachedPct >= 0 && out.reachedPct <= 100);
});

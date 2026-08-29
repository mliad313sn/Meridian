/**
 * R-01 · La preuve de jalon porte un artefact (comité indépendant).
 *
 * Le constat bloquant : un « document approuvé » était une ligne dont
 * quelqu'un avait changé le statut, et le jalon se franchissait sur du
 * papier que personne ne peut ouvrir. Ces tests tiennent la clôture :
 * pas d'approbation sans artefact, pas d'artefact hors des hôtes de
 * confiance, pas de jalon sur preuve vide, et un lien changé après
 * approbation retombe en revue.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

let docId = null;

test("un document se dépose sans artefact, mais ne s'approuve pas sans lui", async () => {
  const admin = await as("admin");
  const made = await admin.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Rapport d'essai réseau", type: "Assurance", gate: 3,
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  docId = made.body.id;

  const bare = await admin.patch("/api/documents/" + docId, { status: "Approved", version: 1 });
  assert.equal(bare.status, 400, JSON.stringify(bare.body));
  assert.match(bare.body.error, /artefact/);
});

test("l'artefact doit vivre sur un hôte de confiance, en https", async () => {
  const admin = await as("admin");
  const doc = () => admin.get("/api/bootstrap").then(r => r.body.db.docs.find(d => d.id === docId));
  let d = await doc();

  const http = await admin.patch("/api/documents/" + docId,
    { status: "Approved", uri: "http://docs.meridian.example/x.pdf", version: d.version });
  assert.equal(http.status, 400);
  assert.match(http.body.error, /https/);

  const ailleurs = await admin.patch("/api/documents/" + docId,
    { status: "Approved", uri: "https://pastebin.example/x.pdf", version: d.version });
  assert.equal(ailleurs.status, 400);
  assert.match(ailleurs.body.error, /not a trusted document host/);

  d = await doc();
  const ok = await admin.patch("/api/documents/" + docId,
    { status: "Approved", uri: "https://docs.meridian.example/evidence/essai-reseau.pdf", version: d.version });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  d = await doc();
  assert.equal(d.status, "Approved");
  assert.equal(d.uriLockedOn ? true : false, true, "l'adresse est figée et datée");
  assert.equal(d.uriHash.length, 64, "avec son empreinte SHA-256");
});

test("des hôtes non configurés = approbation refusée, en disant quoi faire (fermé par défaut)", async () => {
  const admin = await as("admin");
  const hosts = await admin.patch("/api/admin/settings", { documentHosts: "" });
  assert.equal(hosts.status, 200);
  const made = await admin.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Pièce orpheline", gate: 3,
    uri: "https://docs.meridian.example/evidence/orpheline.pdf",
  });
  const refused = await admin.patch("/api/documents/" + made.body.id, { status: "Approved", version: 1 });
  assert.equal(refused.status, 400);
  assert.match(refused.body.error, /documentHosts/, "le refus nomme le paramètre à régler");
  await admin.patch("/api/admin/settings", { documentHosts: "docs.meridian.example" });
});

test("le jalon ne se franchit pas sur une preuve vide", () => {
  const db = {
    statusDate: "2026-08-28",
    settings: { gateLock: true },
    milestones: [{ id: "M1", project: "X", name: "Gate 1", date: "2026-08-20", gate: 1, kind: "gate" }],
    docs: [
      { id: "D1", project: "X", gate: 1, status: "Approved", uri: "https://docs.meridian.example/a.pdf" },
      { id: "D2", project: "X", gate: 1, status: "Approved", uri: "" },   // le label sans la pièce
    ],
  };
  assert.equal(Engine.isEvidence(db.docs[0]), true);
  assert.equal(Engine.isEvidence(db.docs[1]), false);
  const st = Engine.gateStatus(db, "X", 1);
  assert.equal(st.ready, false, "un des deux « approuvés » ne prouve rien");
  assert.equal(st.outstanding.some(d => d.id === "D2"), true);
});

test("changer le lien d'un document approuvé le fait retomber en revue, sur le registre", async () => {
  const admin = await as("admin");
  let d = (await admin.get("/api/bootstrap")).body.db.docs.find(x => x.id === docId);
  assert.equal(d.status, "Approved");

  const moved = await admin.patch("/api/documents/" + docId,
    { uri: "https://docs.meridian.example/evidence/essai-reseau-v2.pdf", version: d.version });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));

  d = (await admin.get("/api/bootstrap")).body.db.docs.find(x => x.id === docId);
  assert.equal(d.status, "In review", "un lien changé après coup n'est pas la pièce approuvée");
  assert.equal(d.uriHash, "", "l'empreinte figée est levée");

  const audit = await admin.get("/api/audit?action=Evidence%20link%20changed%20after%20approval&limit=5");
  assert.ok(audit.body.events.some(e => e.entity_id === docId), "et l'acte est nommé sur la piste");
});

test("le dossier de preuve cite l'artefact, et nomme ce qui n'en a pas", async () => {
  const admin = await as("admin");
  await admin.post("/api/documents", { project: SITE_PROJECT_GRU, name: "Sans pièce", gate: 4 });
  const r = await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  assert.equal(r.status, 200);
  assert.match(r.body.markdown, /Artefact \| Address hash/);
  assert.match(r.body.markdown, /https:\/\/docs\.meridian\.example\//, "les pièces sont des liens ouvrables");
  assert.match(r.body.markdown, /\*\*none — not evidence\*\*/, "et l'absence est dite, pas masquée");
});

test("une nouvelle révision nomme celle qu'elle remplace (lignée, R-13)", async () => {
  const admin = await as("admin");
  // remettre le document en état approuvé pour réviser depuis un état réel
  let d = (await admin.get("/api/bootstrap")).body.db.docs.find(x => x.id === docId);
  await admin.patch("/api/documents/" + docId,
    { status: "Approved", uri: d.uri, version: d.version });

  const rev = await admin.post("/api/documents/" + docId + "/revise", {});
  assert.equal(rev.status, 201, JSON.stringify(rev.body));

  const db = (await admin.get("/api/bootstrap")).body.db;
  const nouveau = db.docs.find(x => x.id === rev.body.id);
  const ancien = db.docs.find(x => x.id === docId);
  assert.equal(nouveau.supersedes, docId, "la lignée est une donnée, pas une étiquette");
  assert.equal(nouveau.status, "Draft", "une nouvelle révision n'est approuvée par personne");
  assert.equal(nouveau.uriHash, "", "et ne porte aucune empreinte figée");
  assert.equal(ancien.status, "Superseded");
});

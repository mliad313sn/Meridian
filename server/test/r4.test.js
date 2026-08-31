/**
 * R4 · PM-08 (la clôture qui se signe), PM-04 (le jalon qui s'accepte),
 * INT-08 (les vraies invitations), INT-06 (le transport Teams).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { one, query } from "../src/db.js";
import { outboundTransport } from "../src/notify.js";

before(async () => { await boot(); });
after(shutdown);

describe("PM-08 · clore, ce sont trois signatures", () => {
  test("la marche vers Closed exige l'exploitant et le propriétaire de bénéfice", async () => {
    const admin = await as("admin");
    /* On pousse un projet jusqu'à la dernière marche. */
    const made = await admin.post("/api/projects", {
      name: "À clore proprement", programme: "EIT", site: "GRU", governanceLevel: "site",
      start: "2026-01-01", finish: "2026-06-01", budget: 0.5, contingency: 0.05,
    });
    const id = made.body.id;
    const phases = ["Design", "Execution", "Transition", "Closure"];
    for (const _ of phases) {
      const p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === id);
      const r = await admin.patch(`/api/projects/${id}/phase`,
        { version: p.version, override: true, overrideWhy: "test de clôture" });
      assert.equal(r.status, 200, r.text);
    }
    /* Dernière marche : Closure → Closed. Sans signatures, refus. */
    let p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === id);
    assert.equal(p.phase, "Closure");
    const bare = await admin.patch(`/api/projects/${id}/phase`,
      { version: p.version, override: true, overrideWhy: "x" });
    assert.equal(bare.status, 400);
    assert.match(bare.body.error, /operations owner/i,
      "sans exploitant nommé, c'est l'équipe dissoute qu'on appellera");

    const ops = (await admin.get("/api/bootstrap")).body.db.people.find((x) => x.site === "GRU");
    const ben = (await admin.get("/api/bootstrap")).body.db.people.find((x) => x.id !== ops.id);
    const closed = await admin.patch(`/api/projects/${id}/phase`, {
      version: p.version, override: true, overrideWhy: "test",
      opsAcceptedBy: ops.id, benefitsTo: ben.id,
      closureNote: "Reste à faire : rien. Non fait, assumé : le module de reporting hérité.",
    });
    assert.equal(closed.status, 200, closed.text);

    p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === id);
    assert.equal(p.closed, true);
    assert.equal(p.opsAcceptedBy, ops.id, "l'exploitant est nommé, pas sous-entendu");
    assert.equal(p.benefitsTo, ben.id, "les bénéfices appartiennent à quelqu'un après la fin");
    assert.ok(p.closedOn, "et la fin a une date");
    assert.match(p.closureNote, /assumé/);
  });
});

describe("PM-04 · « terminé » cesse d'être une opinion", () => {
  test("un jalon avec critères ne se coche qu'en nommant qui a constaté", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const ms = db.milestones.find((x) => x.project === GROUP_PROJECT && !x.done);
    assert.ok(ms, "un jalon ouvert existe");

    /* Poser les critères d'abord — ils se posent d'AVANT. */
    let r = await admin.patch(`/api/milestones/${ms.id}`, {
      acceptanceCriteria: "Bascule rejouée deux fois sans incident ; retour arrière prouvé sous 30 min.",
      version: ms.version,
    });
    assert.equal(r.status, 200, r.text);

    /* Cocher sans accepteur : refus qui dit quoi faire. */
    let fresh = (await admin.get("/api/bootstrap")).body.db.milestones.find((x) => x.id === ms.id);
    r = await admin.patch(`/api/milestones/${ms.id}`, { done: true, version: fresh.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /named person who checked/i);

    /* Cocher en nommant : le nom reste. */
    const person = db.people[0];
    fresh = (await admin.get("/api/bootstrap")).body.db.milestones.find((x) => x.id === ms.id);
    r = await admin.patch(`/api/milestones/${ms.id}`,
      { done: true, acceptedBy: person.id, version: fresh.version });
    assert.equal(r.status, 200, r.text);
    fresh = (await admin.get("/api/bootstrap")).body.db.milestones.find((x) => x.id === ms.id);
    assert.equal(fresh.acceptedBy, person.id);
    assert.ok(fresh.acceptedOn);
  });

  test("un jalon sans critères se coche comme avant — tout n'est pas une recette", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const ms = db.milestones.find((x) => x.project === SITE_PROJECT_GRU && !x.done && !x.acceptanceCriteria);
    assert.ok(ms, "un jalon sans critères existe");
    const r = await admin.patch(`/api/milestones/${ms.id}`, { done: true, version: ms.version });
    assert.equal(r.status, 200, r.text);
  });
});

describe("INT-08 · une invitation, pas un fichier", () => {
  test("l'occurrence sort en METHOD:REQUEST avec organisateur et SEQUENCE", async () => {
    const admin = await as("admin");
    /* MS-GRP-W est présidée par R. Kaur, qui a un compte avec adresse. */
    const occ = await one(
      `SELECT id FROM meeting_occurrence WHERE series_id = 'MS-GRP-W' ORDER BY meets_on DESC LIMIT 1`);
    assert.ok(occ, "une occurrence existe pour la série de groupe");
    const r = await admin.get(`/api/meetings/occurrences/${occ.id}/ics`);
    assert.equal(r.status, 200);
    assert.match(r.text, /METHOD:REQUEST/, "l'agenda du destinataire propose accepter/refuser");
    assert.match(r.text, /ORGANIZER;CN=/, "la RFC exige un organisateur pour REQUEST — il y en a un");
    assert.match(r.text, /mailto:r\.kaur@meridian\.example/);
    assert.match(r.text, /SEQUENCE:\d+/, "une mise à jour remplacera au lieu de dupliquer");
    assert.match(r.text, /STATUS:(CONFIRMED|CANCELLED)/);
  });
});

describe("INT-06 · le transport Teams, fermé par défaut", () => {
  test("sans hôte autorisé, rien ne part — même avec l'adresse posée", async () => {
    process.env.MERIDIAN_TEAMS_WEBHOOK = "https://tenant.webhook.office.com/webhookb2/x";
    try {
      await query(`DELETE FROM app_setting WHERE key = 'notifyHosts'`);
      assert.equal(await outboundTransport(), null,
        "la liste d'hôtes vide est FERMÉE : poser l'adresse ne suffit pas");

      await query(
        `INSERT INTO app_setting (key, value) VALUES ('notifyHosts', '"webhook.office.com"')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
      const t = await outboundTransport();
      assert.equal(typeof t, "function", "hôte nommé + adresse = un transport existe");
    } finally {
      delete process.env.MERIDIAN_TEAMS_WEBHOOK;
      await query(`DELETE FROM app_setting WHERE key = 'notifyHosts'`);
    }
  });
});

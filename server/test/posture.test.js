/**
 * I-12 · LA POSTURE DU JOUR 1 — retour de terrain RT365 (docs/33, M-10).
 *
 * « Identifiants de démonstration semés par défaut et publics ; à changer
 * le jour 1. » Un « à faire » que rien ne mesure ne se fait pas : ces
 * tests tiennent la mesure, le refus en production, et le fait que
 * l'exemption break-glass se LIT au lieu de se deviner.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, ACCOUNTS, GROUP_PROJECT } from "./harness.js";
import { liveDemoAccounts, demoRefusal, posture } from "../src/posture.js";
import { DEMO_ACCOUNTS } from "../src/seed.js";

before(async () => { await boot(); });
after(shutdown);

describe("I-12 · la mesure", () => {
  test("sur un livre fraîchement semé, les dix mots de passe publiés ouvrent dix comptes", async () => {
    const live = await liveDemoAccounts();
    assert.equal(live.length, DEMO_ACCOUNTS.length);
    assert.ok(live.every((l) => l.mustChangePassword === false));
  });

  test("changer UN mot de passe ferme UNE porte — la mesure suit", async () => {
    const c = await as("viewerLIS");
    const r = await c.post("/api/auth/password",
      { current: ACCOUNTS.viewerLIS[1], next: "a-real-password-2026" });
    assert.equal(r.status, 200, r.text);
    const live = await liveDemoAccounts();
    assert.equal(live.length, DEMO_ACCOUNTS.length - 1);
    assert.equal(live.some((l) => l.email === ACCOUNTS.viewerLIS[0]), false);
  });

  test("désactiver un compte le retire de la mesure", async () => {
    const admin = await as("admin");
    const users = (await admin.get("/api/admin/users")).body.users;
    const mbeki = users.find((u) => u.email === ACCOUNTS.viewerGRU[0]);
    const r = await admin.patch("/api/admin/users/" + mbeki.id, { active: false, version: mbeki.version });
    assert.equal(r.status, 200, r.text);
    const live = await liveDemoAccounts();
    assert.equal(live.some((l) => l.email === ACCOUNTS.viewerGRU[0]), false);
  });

  test("l'écran Administration lit la posture ; le niveau groupe non", async () => {
    const admin = await as("admin");
    const r = await admin.get("/api/admin/posture");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.demoAccountsLive));
    assert.equal(r.body.production, false);
    assert.equal(typeof r.body.documentHostsSet, "boolean", "fermé ou nommé — dit, dans les deux cas");
    assert.match(r.body.breakGlass, /break-glass/);
    const group = await as("groupCBP");
    assert.equal((await group.get("/api/admin/posture")).status, 403);
  });
});

describe("I-12 · le refus en production", () => {
  test("des portes ouvertes + production → refus qui nomme les comptes et dit quoi faire", () => {
    const live = [{ email: "admin@meridian.example" }, { email: "r.kaur@meridian.example" }];
    const r = demoRefusal({ NODE_ENV: "production" }, live);
    assert.ok(r);
    assert.match(r, /admin@meridian\.example/);
    assert.match(r, /reset-book/);
    assert.match(r, /MERIDIAN_ALLOW_DEMO_ACCOUNTS=1/);
  });
  test("…et pas de refus sans porte ouverte, hors production, ou sur décision explicite", () => {
    assert.equal(demoRefusal({ NODE_ENV: "production" }, []), null);
    assert.equal(demoRefusal({ NODE_ENV: "development" }, [{ email: "x" }]), null);
    assert.equal(demoRefusal({ NODE_ENV: "production", MERIDIAN_ALLOW_DEMO_ACCOUNTS: "1" }, [{ email: "x" }]), null);
    assert.equal(demoRefusal({ NODE_ENV: "production", MERIDIAN_TRAINING: "1" }, [{ email: "x" }]), null);
  });
  test("posture() rend des faits, pas des jugements", async () => {
    const p = await posture();
    assert.equal(typeof p.smtpConfigured, "boolean");
    assert.equal(typeof p.secureCookies, "boolean");
  });
});

describe("S-13 / I-12 · le break-glass se lit dans la piste", () => {
  test("un administrateur qui signe SA demande laisse la mention dans l'audit", async () => {
    const admin = await as("admin");
    const boot1 = await admin.get("/api/bootstrap");
    const p = boot1.body.db.projects.find((x) => x.id === GROUP_PROJECT);
    assert.ok(p);
    const raised = await admin.post("/api/change", {
      project: p.id, title: "Break-glass probe", cost: 0.01, weeks: 0, funding: "Contingency",
    });
    assert.equal(raised.status, 201, raised.text);
    const id = raised.body.id;
    /* Signer chaque étape jusqu'à la dernière. */
    for (let i = 0; i < 6; i++) {
      const s = await admin.post(`/api/change/${id}/approve`, { comment: "urgent" });
      if (s.status === 409) break;
      assert.equal(s.status, 200, s.text);
      if (s.body.applied) break;
    }
    const audit = await admin.get(`/api/audit?entity=change_request&entityId=${id}&limit=20`);
    assert.equal(audit.status, 200);
    const rows = audit.body.events ?? audit.body;
    const marked = rows.filter((e) => /BREAK-GLASS/.test(e.detail ?? ""));
    assert.ok(marked.length >= 1, "au moins une signature marquée break-glass: " + JSON.stringify(rows.map((e) => e.detail)));
  });
});

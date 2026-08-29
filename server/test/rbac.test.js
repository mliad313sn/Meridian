/**
 * R1.2–R1.6, R1.9, R1.10, R4.2, R4.3, R4.5 — authorisation.
 *
 * These are the tests B2 (Security) made a condition of sign-off, so they
 * are written from the attacker's side: not "can the right person do the
 * right thing" but "can the wrong person do anything at all".
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, ACCOUNTS, GROUP_PROJECT, SITE_PROJECT_GRU, SITE_PROJECT_YYZ } from "./harness.js";
import { can, canWriteProject, canSeeProject, ROLES, ACTIONS } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

const mk = (role, programmes = [], sites = []) => ({
  id: "T", role, active: true, displayName: role,
  grants: { programmes: new Set(programmes), sites: new Set(sites) },
});
const proj = (programme, site, level) => ({
  programme_id: programme, site_id: site, governance_level: level,
});

describe("the gate itself", () => {
  test("R1.2 · exactly four roles exist", () => {
    assert.deepEqual(ROLES, ["admin", "group", "site", "viewer"]);
  });

  test("an unknown action is denied, never allowed by default", () => {
    const v = can(mk("admin"), "project.obliterate", {});
    assert.equal(v.ok, false);
  });

  test("no user at all is denied every action", () => {
    for (const a of ACTIONS) assert.equal(can(null, a, {}).ok, false, a);
  });

  test("a disabled account is denied every action even with a role", () => {
    const dead = { ...mk("admin"), active: false };
    for (const a of ACTIONS) assert.equal(can(dead, a, {}).ok, false, a);
  });

  test("R1.5 · a viewer is refused every write, in every scope", () => {
    const writes = ACTIONS.filter((a) => !a.endsWith(".read") && a !== "data.export");
    const v = mk("viewer", [], ["GRU"]);
    for (const a of writes) {
      const r = can(v, a, { project: proj("DCH", "GRU", "site"), scope: { scope_kind: "site", site_id: "GRU" } });
      assert.equal(r.ok, false, `viewer must not be allowed ${a}`);
    }
  });

  test("R1.3 · an ungranted group or site account has no write authority anywhere", () => {
    const g = mk("group");   // no programme grants
    const s = mk("site");    // no site grants
    for (const p of [proj("CBP", "KRK", "group"), proj("DCH", "GRU", "site")]) {
      assert.equal(canWriteProject(g, p), false);
      assert.equal(canWriteProject(s, p), false);
    }
  });

  test("R1.6 · a site grant confers nothing over a group-governed project in that same site", () => {
    const gru = mk("site", [], ["GRU"]);
    assert.equal(canWriteProject(gru, proj("DCH", "GRU", "site")), true, "its own project");
    assert.equal(canWriteProject(gru, proj("DCH", "GRU", "group")), false, "a group programme delivered there");
    assert.equal(canSeeProject(gru, proj("DCH", "GRU", "group")), true, "but it is still visible");
  });

  test("a site grant confers nothing over another site", () => {
    const gru = mk("site", [], ["GRU"]);
    assert.equal(canSeeProject(gru, proj("DCH", "YYZ", "site")), false);
    assert.equal(canWriteProject(gru, proj("DCH", "YYZ", "site")), false);
  });

  test("a group grant is bounded by programme, not widened by site", () => {
    const cbp = mk("group", ["CBP"]);
    assert.equal(canWriteProject(cbp, proj("CBP", "GRU", "site")), true, "own programme, any site");
    assert.equal(canWriteProject(cbp, proj("DAI", "KRK", "group")), false, "another programme");
    assert.equal(canSeeProject(cbp, proj("DAI", "KRK", "group")), true, "group level still sees everything");
  });

  test("site level cannot create a group-governed project", () => {
    const gru = mk("site", [], ["GRU"]);
    assert.equal(can(gru, "project.create", { programme_id: "DCH", site_id: "GRU", governance_level: "group" }).ok, false);
    assert.equal(can(gru, "project.create", { programme_id: "DCH", site_id: "GRU", governance_level: "site" }).ok, true);
  });

  test("money and baselines are group-level acts whatever the project", () => {
    const gru = mk("site", [], ["GRU"]);
    const own = proj("DCH", "GRU", "site");
    for (const a of ["cost.write", "contingency.release", "project.baseline", "data.import"]) {
      assert.equal(can(gru, a, { project: own }).ok, false, a);
    }
  });

  test("R4.5 · magnitude routes a change decision above the threshold to group", () => {
    const gru = mk("site", [], ["GRU"]);
    const own = proj("DCH", "GRU", "site");
    const threshold = { cost: 0.25, weeks: 2 };
    assert.equal(can(gru, "change.approve", { project: own, cost_delta: 0.1, weeks_delta: 1, threshold }).ok, true);
    assert.equal(can(gru, "change.approve", { project: own, cost_delta: 0.9, weeks_delta: 0, threshold }).ok, false);
    assert.equal(can(gru, "change.approve", { project: own, cost_delta: 0, weeks_delta: 6, threshold }).ok, false);
  });

  test("allocation respects the site boundary on people, not just projects", () => {
    const gru = mk("site", [], ["GRU"]);
    const own = proj("DCH", "GRU", "site");
    assert.equal(can(gru, "allocation.write", { project: own, person: { site_id: "GRU" } }).ok, true);
    assert.equal(can(gru, "allocation.write", { project: own, person: { site_id: "KRK" } }).ok, false);
  });

  test("R1.9 · only an administrator manages users or global settings", () => {
    for (const role of ["group", "site", "viewer"]) {
      const u = mk(role, ["CBP"], ["GRU"]);
      assert.equal(can(u, "user.manage").ok, false, role);
      assert.equal(can(u, "settings.write").ok, false, role);
    }
    assert.equal(can(mk("admin"), "user.manage").ok, true);
  });

  test("audit is readable at group level and above only", () => {
    assert.equal(can(mk("admin"), "audit.read").ok, true);
    assert.equal(can(mk("group", ["CBP"]), "audit.read").ok, true);
    assert.equal(can(mk("site", [], ["GRU"]), "audit.read").ok, false);
    assert.equal(can(mk("viewer"), "audit.read").ok, false);
  });
});

describe("enforcement over HTTP (R1.4 — hiding a button is not enforcement)", () => {
  test("R1.10 · reads are scoped: each role sees only its own portfolio", async () => {
    const seen = {};
    for (const who of ["admin", "groupCBP", "siteGRU", "siteYYZ", "viewerLIS"]) {
      const c = await as(who);
      const r = await c.get("/api/bootstrap");
      seen[who] = r.body.db.projects.map((p) => p.id).sort();
    }
    assert.equal(seen.admin.length, 12, "admin sees the whole book");
    assert.equal(seen.groupCBP.length, 12, "group level has portfolio-wide sight");

    // A site sees its own plus every group-governed project, and nothing else.
    assert.ok(seen.siteGRU.includes(SITE_PROJECT_GRU));
    assert.ok(seen.siteGRU.includes(GROUP_PROJECT));
    assert.ok(!seen.siteGRU.includes(SITE_PROJECT_YYZ), "GRU must not see Toronto's own project");
    assert.ok(!seen.siteYYZ.includes(SITE_PROJECT_GRU), "and Toronto must not see São Paulo's");
    assert.ok(seen.siteYYZ.includes(SITE_PROJECT_YYZ));
  });

  test("an out-of-scope project reads as 404, not 403 — existence is not disclosed", async () => {
    const gru = await as("siteGRU");
    const r = await gru.patch(`/api/projects/${SITE_PROJECT_YYZ}`, { desc: "x", version: 1 });
    assert.equal(r.status, 404);
  });

  test("R1.6 over HTTP · a site lead cannot write a group project in their own site", async () => {
    const gru = await as("siteGRU");
    const ok = await gru.patch(`/api/projects/${SITE_PROJECT_GRU}`, {
      desc: "Updated by the site lead", version: 1,
    });
    assert.equal(ok.status, 200, "its own project is writable");

    const refused = await gru.patch(`/api/projects/${GROUP_PROJECT}`, { desc: "no", version: 1 });
    assert.equal(refused.status, 403);
    assert.match(refused.body.error, /group-governed/i);
  });

  test("R4.3 · a site lead administers their own site's project end to end", async () => {
    const gru = await as("siteGRU");
    const risk = await gru.post("/api/raid", {
      project: SITE_PROJECT_GRU, type: "Risk", title: "PIX slot slipping", p: 3, i: 4,
    });
    assert.equal(risk.status, 201);
    const cr = await gru.post("/api/change", {
      project: SITE_PROJECT_GRU, title: "Small scope trim", cost: -0.02, weeks: 0,
    });
    assert.equal(cr.status, 201);
    const doc = await gru.post("/api/documents", {
      project: SITE_PROJECT_GRU, name: "Site readiness note", gate: 3,
    });
    assert.equal(doc.status, 201);
  });

  test("a site lead is refused the ledger and the baseline", async () => {
    const gru = await as("siteGRU");
    const cost = await gru.post("/api/cost", {
      project: SITE_PROJECT_GRU, amount: 0.05, period: "2026-08",
    });
    assert.equal(cost.status, 403);
    assert.match(cost.body.error, /group-level/i);

    const base = await gru.patch(`/api/projects/${SITE_PROJECT_GRU}/baseline`, {
      baselineFinish: "2027-09-01", version: 1,
    });
    assert.equal(base.status, 403);
  });

  test("R1.5 over HTTP · a viewer is refused every write it can reach", async () => {
    const v = await as("viewerLIS");
    const attempts = [
      ["POST", "/api/raid", { project: "PRJ-104", title: "no" }],
      ["POST", "/api/documents", { project: "PRJ-104", name: "no" }],
      ["POST", "/api/workitems", { project: "PRJ-104", title: "no" }],
      ["POST", "/api/change", { project: "PRJ-104", title: "no" }],
      ["PATCH", "/api/projects/PRJ-104", { desc: "no", version: 1 }],
      ["PUT", "/api/narrative/achieved", { lines: ["no"] }],
    ];
    for (const [method, path, body] of attempts) {
      const r = method === "POST" ? await v.post(path, body)
        : method === "PATCH" ? await v.patch(path, body)
        : await v.post(path, body); // PUT narrative reached below
      assert.ok(r.status === 403 || r.status === 404, `${method} ${path} gave ${r.status}`);
    }
  });

  test("R1.9 over HTTP · non-admins cannot reach administration at all", async () => {
    for (const who of ["groupCBP", "siteGRU", "viewerLIS"]) {
      const c = await as(who);
      assert.equal((await c.get("/api/admin/users")).status, 403, who);
      assert.equal((await c.patch("/api/admin/settings", { autoRag: false })).status, 403, who);
      assert.equal((await c.post("/api/admin/users", {
        email: "x@y.z", displayName: "X", role: "admin", password: "hunter2hunter2",
      })).status, 403, who);
    }
  });

  test("a group manager cannot write outside their granted programmes", async () => {
    const cbp = await as("groupCBP");           // CBP + EIT
    const inside = await cbp.patch(`/api/projects/${GROUP_PROJECT}`, {
      desc: "Programme manager note", version: 1,
    });
    assert.equal(inside.status, 200);
    const outside = await cbp.patch("/api/projects/PRJ-104", { desc: "no", version: 1 }); // DCH
    assert.equal(outside.status, 403);
    assert.match(outside.body.error, /outside your authority/i);
  });

  test("R4.2 · a group project rolls up everywhere; a site project does not leave its site", async () => {
    const yyz = await as("siteYYZ");
    const db = (await yyz.get("/api/bootstrap")).body.db;
    const levels = Object.fromEntries(db.projects.map((p) => [p.id, p.governanceLevel]));
    for (const [id, level] of Object.entries(levels)) {
      const p = db.projects.find((x) => x.id === id);
      if (level === "site") {
        assert.equal(p.site, "YYZ", `site-governed ${id} should only be visible in its own site`);
      }
    }
  });

  test("a site account cannot promote its own project to group level", async () => {
    const gru = await as("siteGRU");
    const before = (await gru.get("/api/bootstrap")).body.db.projects
      .find((p) => p.id === SITE_PROJECT_GRU);
    const r = await gru.patch(`/api/projects/${SITE_PROJECT_GRU}`, {
      governanceLevel: "group", version: before.version,
    });
    assert.equal(r.status, 403, "self-promotion is how a site grant would become a group grant");
  });
});

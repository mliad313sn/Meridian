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

/* S-17 — a group grant is a grant over programmes, not over the map. The
   seeded site rooms make the distinction testable: São Paulo hosts one
   project, and it belongs to Digital Channels. The programme manager for
   Data & Analytics has no work there and no business chairing it. */
describe("S-17 · a group account does not chair every site's room", () => {
  test("the unit decision refuses a site scope no grant of theirs hosts", () => {
    const dai = mk("group", ["DAI"]);
    const gru = { scope_kind: "site", site_id: "GRU", host_programmes: ["DCH"] };
    const sin = { scope_kind: "site", site_id: "SIN", host_programmes: ["DAI", "EIT"] };
    assert.equal(can(dai, "meeting.write", { scope: gru }).ok, false);
    assert.equal(can(dai, "meeting.write", { scope: sin }).ok, true);
  });

  test("a scope loaded without the list fails closed, never open", () => {
    /* The old code returned true for any group account here. If a future
       query forgets the aggregate, the room must lock, not unlock. */
    const dai = mk("group", ["DAI"]);
    assert.equal(can(dai, "meeting.write", { scope: { scope_kind: "site", site_id: "GRU" } }).ok, false);
  });

  test("end to end · DAI cannot schedule São Paulo's call, DCH can", async () => {
    const dai = await as("groupDAI");
    const refused = await dai.post("/api/meetings/series/MS-GRU-W/occurrences",
      { meetsOn: "2026-10-15" });
    assert.equal(refused.status, 403, "MS-GRU-W is a DCH site — DAI has no work there");
    assert.match(refused.body.error, /outside your authority/i);

    const dch = await as("groupDCH");
    const allowed = await dch.post("/api/meetings/series/MS-GRU-W/occurrences",
      { meetsOn: "2026-10-15" });
    assert.ok([200, 201].includes(allowed.status),
      `DCH runs the project on that site and must still chair it (got ${allowed.status})`);
  });

  test("the room a group account may not write, it still reads", async () => {
    const dai = await as("groupDAI");
    const list = (await dai.get("/api/meetings/series")).body.series;
    const gru = list.find((s) => s.id === "MS-GRU-W");
    assert.ok(gru, "minutes are shared across the group by design");
    assert.equal(gru.canWrite, false, "and the control is not drawn (R7.3)");
  });
});

/**
 * REQ-27 (V-8) — déplacer un projet existant sur l'échelle de jalons de
 * son programme. Même raisonnement qu'`exception.sweep`, appliqué là où
 * l'échelle est DÉCLARÉE : une échelle est une donnée du PROGRAMME, donc
 * le geste appartient au bureau de programme, borné par l'habilitation
 * sur ce programme-là — et jamais au site, qui subit le processus que
 * l'échelle encode sans le posséder.
 */
/**
 * REQ-24 (V-5) — la PONDÉRATION du classement de portefeuille.
 *
 * Le raisonnement d'`exception.sweep` — « le niveau qui pose une marge
 * est celui qui la vérifie » — d'un cran plus haut : le niveau qui pose
 * une pondération est celui qui répond de la COUPE qu'elle trace. Cette
 * coupe traverse tous les programmes et dit à un site que son projet
 * passe sous la ligne ; un chef de site qui règle les poids de sa propre
 * file n'arbitre pas, il énonce une préférence.
 *
 * Et ce n'est PAS `settings.write` : ce n'est pas un réglage de la
 * machine, c'est la politique d'investissement du groupe. La confier à
 * l'administrateur retirerait au bureau de programme la seule décision
 * dont il répond devant le comité. Le garde-fou n'est pas le niveau,
 * c'est la piste — voir prioritise.test.js pour l'image avant/après.
 */
describe("REQ-24 · priority.weighting", () => {
  test("l'action existe, et elle est distincte de la notation d'une ligne", () => {
    assert.ok(ACTIONS.includes("priority.weighting"));
    assert.ok(ACTIONS.includes("priority.write"));
  });

  test("le bureau de programme la pose, l'administrateur aussi", () => {
    /* Portefeuille-large : aucun projet à nommer. Sans son propre `case`
       dans le switch, elle tomberait dans le défaut projet et serait
       refusée à tout le monde — le piège que data.import et period.close
       ont déjà payé dans ce fichier. */
    assert.equal(can(mk("group"), "priority.weighting", {}).ok, true,
      "sans habilitation de programme non plus : la pondération n'appartient à aucun programme");
    assert.equal(can(mk("group", ["CBP"]), "priority.weighting", {}).ok, true);
    assert.equal(can(mk("admin"), "priority.weighting", {}).ok, true);
  });

  test("le site ne la pose jamais, et le refus dit pourquoi et à qui s'adresser", () => {
    const v = can(mk("site", [], ["GRU"]), "priority.weighting", {});
    assert.equal(v.ok, false);
    assert.match(v.why, /answers for the cut it draws/);
    assert.match(v.why, /ask your programme office/);
  });

  test("un lecteur ne la pose pas — c'est une écriture comme une autre", () => {
    assert.equal(can(mk("viewer", [], ["GRU"]), "priority.weighting", {}).ok, false);
  });
});

describe("REQ-27 · ladder.migrate", () => {
  const RBT = proj("RBT", "GRU", "group");

  test("le niveau qui déclare l'échelle est le niveau qui y fait passer un projet", () => {
    assert.equal(can(mk("group", ["RBT"]), "ladder.migrate", { project: RBT }).ok, true);
    assert.equal(can(mk("admin"), "ladder.migrate", { project: RBT }).ok, true,
      "l'administrateur passe par la sortie anticipée, comme partout");
  });

  test("un groupe sans habilitation sur CE programme est refusé, et on lui dit quoi faire", () => {
    const v = can(mk("group", ["CBP"]), "ladder.migrate", { project: RBT });
    assert.equal(v.ok, false);
    assert.match(v.why, /outside your grant/);
    assert.match(v.why, /ask an administrator to add it/);
  });

  test("le site ne le fait jamais — pas même sur un projet gouverné chez lui", () => {
    const own = proj("RBT", "GRU", "site");
    for (const p of [RBT, own]) {
      const v = can(mk("site", [], ["GRU"]), "ladder.migrate", { project: p });
      assert.equal(v.ok, false, "un chef de site ne change pas les barreaux");
      assert.match(v.why, /declared on the programme/);
      assert.match(v.why, /ask your programme office/);
    }
  });

  test("le lecteur jamais, le rôle inconnu jamais, et sans projet le refus dit par où commencer", () => {
    assert.equal(can(mk("viewer", ["RBT"]), "ladder.migrate", { project: RBT }).ok, false);
    assert.equal(can({ role: "nonsense", active: true, id: "U" }, "ladder.migrate", { project: RBT }).ok, false);
    const none = can(mk("group", ["RBT"]), "ladder.migrate", {});
    assert.equal(none.ok, false);
    assert.match(none.why, /open it from the portfolio first/);
  });
});

/**
 * Q-2 — demander le constat est un acte du niveau qui pose les marges,
 * et il n'a pas de projet à nommer.
 */
describe("Q-2 · exception.sweep", () => {
  test("le groupe peut le demander ; le site, le lecteur et l'inconnu non", () => {
    const group = { role: "group", active: true, id: "U1", grants: { programmes: new Set(), sites: new Set() } };
    const site = { role: "site", active: true, id: "U2", grants: { programmes: new Set(), sites: new Set() } };
    const viewer = { role: "viewer", active: true, id: "U3", grants: { programmes: new Set(), sites: new Set() } };
    const admin = { role: "admin", active: true, id: "U4", grants: { programmes: new Set(), sites: new Set() } };

    assert.equal(can(group, "exception.sweep").ok, true, "sans ressource : c'est un acte de portefeuille");
    assert.equal(can(admin, "exception.sweep").ok, true, "l'administrateur passe partout, par la sortie anticipée");
    assert.equal(can(site, "exception.sweep").ok, false);
    assert.match(can(site, "exception.sweep").why, /sets a margin is the level that checks it/);
    assert.equal(can(viewer, "exception.sweep").ok, false);
    assert.equal(can({ role: "nonsense", active: true, id: "U5" }, "exception.sweep").ok, false,
      "un rôle que ce fichier ne nomme pas n'obtient rien");
  });
});

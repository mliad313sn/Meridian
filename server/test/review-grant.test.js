/**
 * D-36.12 · #16 · DF-10 · MER-06 — AN EVIDENCE-REVIEW GRANT, NOT A ROLE.
 *
 * A council member who manages nothing is asked to approve a gate's
 * evidence. Before 058 the product could only say no (a viewer writes
 * nothing) or say far too much (group level also re-baselines and
 * approves changes), so FitAdapt's product owner approved "on the
 * member's behalf" and the audit row named the wrong person.
 *
 * A grant now carries a power, `write` or `review`. A review grant on a
 * programme or a project carries document.approve and the reads, and
 * nothing else. These tests hold every edge of that sentence:
 *
 *   · it works for a viewer, on the scope it names, and the audit row
 *     names the reviewer;
 *   · outside that scope, it is nothing;
 *   · the two rules document.approve always had still hold under it —
 *     never one's own document, and gate evidence on a site-governed
 *     project needs group-level eyes;
 *   · every other write stays refused — named, over HTTP, and then
 *     exhaustively over ACTIONS: a review grant changes no verdict but
 *     document.approve and project.read, for any level;
 *   · approving under it is a pure act (no edit in the same call);
 *   · revoking it removes the power;
 *   · a document may name the seat expected to approve it.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { many, one, query } from "../src/db.js";
import { can, canSeeProject, normaliseGrants, projectScopeSql, ACTIONS } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

/* The seeded programme DAI holds PRJ-107 and PRJ-118 (group-governed,
   BLR) and PRJ-133 (site-governed, SIN). N. Rahimi (U-RAHI, PE-12) is a
   viewer scoped to LIS: none of DAI is visible to her before the grant. */
const VIEWER = "U-RAHI";
const EVIDENCE = "https://docs.meridian.example/evidence/";

const bootstrap = (c) => c.get("/api/bootstrap").then((r) => r.body.db);
const docOf = async (c, id) => (await bootstrap(c)).docs.find((d) => d.id === id);

/** A document filed by the administrator, with an artefact, ready to approve. */
async function file(admin, project, { gate = 3, owner = "PE-05", name } = {}) {
  const r = await admin.post("/api/documents", {
    project, name: name ?? `Evidence for ${project} G${gate}`, type: "Assurance", gate, owner,
    status: "In review", uri: EVIDENCE + project.toLowerCase() + "-" + gate + ".pdf",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}

describe("the grant itself (administration)", () => {
  test("a review grant is refused on a site, a write grant on a project, and for an administrator", async () => {
    const admin = await as("admin");
    const site = await admin.post(`/api/admin/users/${VIEWER}/grants`, { kind: "site", target: "BLR", power: "review" });
    assert.equal(site.status, 400);
    assert.match(site.body.error, /programme or a project/);

    const project = await admin.post(`/api/admin/users/${VIEWER}/grants`, { kind: "project", target: "PRJ-107" });
    assert.equal(project.status, 400);
    assert.match(project.body.error, /Only a review grant names a single project/);

    const adm = await admin.post(`/api/admin/users/U-ADMIN/grants`, { kind: "programme", target: "DAI", power: "review" });
    assert.ok([400, 404].includes(adm.status), JSON.stringify(adm.body));
  });

  test("the database holds the same line: a project grant is always a review, a review never names a site", async () => {
    await assert.rejects(() => query(
      `INSERT INTO access_grant (user_id, scope_kind, project_id, power) VALUES ($1,'project','PRJ-107','write')`, [VIEWER]),
      /grant_review_scope|violates/);
    await assert.rejects(() => query(
      `INSERT INTO access_grant (user_id, scope_kind, site_id, power) VALUES ($1,'site','BLR','review')`, [VIEWER]),
      /grant_review_scope|violates/);
    await assert.rejects(() => query(
      `INSERT INTO access_grant (user_id, scope_kind, programme_id, power) VALUES ($1,'programme','DAI','approve')`, [VIEWER]),
      /access_grant_power_known|violates/);
  });

  test("asking for the other power on a scope already held is refused by name", async () => {
    const admin = await as("admin");
    // E. Lindqvist writes in CBP; a review grant on CBP would say nothing true.
    const u = await one(`SELECT id FROM app_user WHERE email = 'e.lindqvist@meridian.example'`);
    const r = await admin.post(`/api/admin/users/${u.id}/grants`, { kind: "programme", target: "CBP", power: "review" });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /already granted with the write power/);
  });
});

describe("a viewer with a review grant on a programme", () => {
  let inScope, gateOnSiteProject, notGateOnSiteProject, own, outOfScopeVisible, outOfScopeHidden;

  before(async () => {
    const admin = await as("admin");
    inScope = await file(admin, "PRJ-118", { gate: 3 });
    gateOnSiteProject = await file(admin, "PRJ-133", { gate: 2, owner: "PE-17" });
    notGateOnSiteProject = await file(admin, "PRJ-133", { gate: 0, owner: "PE-17", name: "Working notes" });
    own = await file(admin, "PRJ-107", { gate: 2, owner: "PE-12", name: "Rahimi's own analysis" });
    outOfScopeVisible = await file(admin, "PRJ-104", { gate: 3, owner: "PE-02" }); // DCH at LIS: seen, not reviewed
    outOfScopeHidden = await file(admin, "PRJ-101", { gate: 3, owner: "PE-11" });  // CBP at KRK: not seen at all
  });

  test("before the grant, the viewer cannot even see the programme's evidence", async () => {
    const v = await as("viewerLIS");
    const d = await docOf(v, inScope);
    assert.equal(d, undefined, "PRJ-118 is outside a LIS viewer's scope");
    const r = await v.patch("/api/documents/" + inScope, { status: "Approved", version: 1 });
    assert.equal(r.status, 404);
  });

  test("the administrator grants the review power; the directory shows it apart from the write grants", async () => {
    const admin = await as("admin");
    const r = await admin.post(`/api/admin/users/${VIEWER}/grants`, { kind: "programme", target: "DAI", power: "review" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const row = await one(`SELECT power, scope_kind, programme_id FROM access_grant WHERE user_id = $1 AND programme_id = 'DAI'`, [VIEWER]);
    assert.deepEqual(row, { power: "review", scope_kind: "programme", programme_id: "DAI" });

    const dir = await admin.get("/api/admin/users");
    const u = dir.body.users.find((x) => x.id === VIEWER);
    assert.deepEqual(u.grants.programmes, [], "a review is never listed as a programme the account writes in");
    assert.deepEqual(u.grants.sites, ["LIS"]);
    assert.deepEqual(u.grants.reviews, { programmes: ["DAI"], projects: [] });

    const audit = await one(`SELECT detail FROM audit_event WHERE action = 'Access granted' ORDER BY id DESC LIMIT 1`);
    assert.match(audit.detail, /review · programme DAI/);
  });

  test("the viewer now reads the programme, and still reads LIS", async () => {
    const v = await as("viewerLIS");
    const db = await bootstrap(v);
    const ids = db.projects.map((p) => p.id).sort();
    for (const id of ["PRJ-107", "PRJ-118", "PRJ-133", "PRJ-104"]) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes("PRJ-101"), "the grant reads its own scope, not the portfolio");
  });

  test("approves gate evidence on a project in scope — 200, and the audit row names the reviewer", async () => {
    const v = await as("viewerLIS");
    const d = await docOf(v, inScope);
    const r = await v.patch("/api/documents/" + inScope, { status: "Approved", version: d.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await docOf(v, inScope)).status, "Approved");

    const a = await one(
      `SELECT user_id, user_label, action FROM audit_event
        WHERE entity = 'document' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [inScope]);
    assert.equal(a.user_id, VIEWER, "the reviewer, not someone approving on their behalf");
    assert.match(a.user_label, /^N\. Rahimi/);
    assert.equal(a.action, "Document set to Approved");
  });

  test("approving is a pure act: no edit rides along with it", async () => {
    const admin = await as("admin");
    const id = await file(admin, "PRJ-107", { gate: 2, owner: "PE-03", name: "Retention policy" });
    const v = await as("viewerLIS");
    const d = await docOf(v, id);
    for (const extra of [{ uri: EVIDENCE + "elsewhere.pdf" }, { gate: 1 }, { name: "Renamed" }, { rev: "9.9" }, { expectedSeat: null }]) {
      const r = await v.patch("/api/documents/" + id, { status: "Approved", version: d.version, ...extra });
      assert.equal(r.status, 403, JSON.stringify(extra) + " " + JSON.stringify(r.body));
      assert.match(r.body.error, /approves the document as it stands/);
    }
    assert.equal((await docOf(v, id)).status, "In review");
  });

  test("refused outside the grant's scope — 403 where the project is seen, 404 where it is not", async () => {
    const v = await as("viewerLIS");
    const seen = await docOf(v, outOfScopeVisible);
    const r1 = await v.patch("/api/documents/" + outOfScopeVisible, { status: "Approved", version: seen.version });
    assert.equal(r1.status, 403, JSON.stringify(r1.body));
    assert.match(r1.body.error, /read-only account/);

    const r2 = await v.patch("/api/documents/" + outOfScopeHidden, { status: "Approved", version: 1 });
    assert.equal(r2.status, 404, "out of scope reads as absent, not forbidden (docs/04 §5)");
  });

  test("refused on the reviewer's own document", async () => {
    const v = await as("viewerLIS");
    const d = await docOf(v, own);
    const r = await v.patch("/api/documents/" + own, { status: "Approved", version: d.version });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /you own this evidence/);
  });

  test("site-governed gate evidence still needs group-level eyes; the same project's non-gate paper does not", async () => {
    const v = await as("viewerLIS");
    const g = await docOf(v, gateOnSiteProject);
    const r = await v.patch("/api/documents/" + gateOnSiteProject, { status: "Approved", version: g.version });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /approved at group level/);

    const n = await docOf(v, notGateOnSiteProject);
    const ok = await v.patch("/api/documents/" + notGateOnSiteProject, { status: "Approved", version: n.version });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });

  test("every other write on the reviewed project is refused over HTTP", async () => {
    const admin = await as("admin");
    const cr = await admin.post("/api/change", { project: "PRJ-118", title: "Probe change", cost: 0, weeks: 0 });
    assert.equal(cr.status, 201, JSON.stringify(cr.body));
    const v = await as("viewerLIS");
    const p = (await bootstrap(v)).projects.find((x) => x.id === "PRJ-118");
    const d = await docOf(v, inScope);
    const attempts = [
      ["project.write",    () => v.patch("/api/projects/PRJ-118", { name: "Renamed", version: p.version })],
      ["project.baseline", () => v.patch("/api/projects/PRJ-118/baseline", { baselineFinish: "2028-01-01", version: p.version })],
      ["benefit.review",   () => v.patch("/api/projects/PRJ-118/review", { verdict: "Met", version: p.version })],
      ["benefit.write",    () => v.post("/api/benefits", { project: "PRJ-118", title: "Probe benefit" })],
      ["raid.write",       () => v.post("/api/raid", { project: "PRJ-118", type: "Risk", title: "Probe risk", p: 3, i: 3 })],
      ["change.raise",     () => v.post("/api/change", { project: "PRJ-118", title: "Probe" })],
      ["change.approve",   () => v.post(`/api/change/${cr.body.id}/approve`, {})],
      ["document.write",   () => v.post("/api/documents", { project: "PRJ-118", name: "Probe doc", gate: 3 })],
      ["document.write",   () => v.patch("/api/documents/" + inScope, { name: "Renamed", version: d.version })],
      ["document.write",   () => v.post(`/api/documents/${inScope}/revise`, {})],
      ["document.write",   () => v.post("/api/criteria", { project: "PRJ-118", gate: 3, text: "Probe criterion" })],
    ];
    for (const [action, call] of attempts) {
      const r = await call();
      assert.equal(r.status, 403, `${action} must be refused: ${r.status} ${JSON.stringify(r.body)}`);
    }
  });

  test("revoking the grant removes the power, and the sight that came with it", async () => {
    const admin = await as("admin");
    const id = await file(admin, "PRJ-107", { gate: 2, owner: "PE-03", name: "After revocation" });
    const r = await admin.post(`/api/admin/users/${VIEWER}/grants/revoke`, { kind: "programme", target: "DAI" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const audit = await one(`SELECT detail FROM audit_event WHERE action = 'Access revoked' ORDER BY id DESC LIMIT 1`);
    assert.match(audit.detail, /review · programme DAI/);

    const v = await as("viewerLIS");
    const denied = await v.patch("/api/documents/" + id, { status: "Approved", version: 1 });
    assert.equal(denied.status, 404);
    assert.equal(await docOf(v, id), undefined);
  });
});

describe("a review grant on a single project", () => {
  test("names that project and not its programme", async () => {
    const admin = await as("admin");
    const g = await admin.post("/api/admin/users/U-MBEKI/grants", { kind: "project", target: "PRJ-107", power: "review" });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    const here = await file(admin, "PRJ-107", { gate: 2, owner: "PE-03", name: "Lakehouse DPIA addendum" });
    const sibling = await file(admin, "PRJ-118", { gate: 3, owner: "PE-05", name: "Model card" });

    const v = await as("viewerGRU");
    const d = await docOf(v, here);
    const ok = await v.patch("/api/documents/" + here, { status: "Approved", version: d.version });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const no = await v.patch("/api/documents/" + sibling, { status: "Approved", version: 1 });
    assert.equal(no.status, 404, "the same programme's other project is not in a project grant");

    const r = await admin.post("/api/admin/users/U-MBEKI/grants/revoke", { kind: "project", target: "PRJ-107" });
    assert.equal(r.status, 200);
    assert.equal(await one(`SELECT id FROM access_grant WHERE user_id = 'U-MBEKI' AND scope_kind = 'project'`), null);
  });
});

describe("the seat a document waits on", () => {
  test("a document names an expected seat; the book carries it; a seat that does not exist is refused", async () => {
    const admin = await as("admin");
    const seat = await admin.post("/api/seats", { name: "A1", person: "PE-12", domain: "evidence" });
    assert.equal(seat.status, 201, JSON.stringify(seat.body));
    const r = await admin.post("/api/documents", {
      project: "PRJ-107", name: "Seat-bound evidence", gate: 2, owner: "PE-03", expectedSeat: seat.body.id,
      uri: EVIDENCE + "seat.pdf",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const d = await docOf(admin, r.body.id);
    assert.equal(d.expectedSeat, seat.body.id);

    const bad = await admin.patch("/api/documents/" + r.body.id, { expectedSeat: "SEAT-NOPE", version: d.version });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /seat does not exist/);

    const cleared = await admin.patch("/api/documents/" + r.body.id, { expectedSeat: "", version: d.version });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal((await docOf(admin, r.body.id)).expectedSeat, null);
  });

  test("a new revision waits on the same seat", async () => {
    const admin = await as("admin");
    const seat = await one(`SELECT id FROM seat WHERE name = 'A1'`);
    const id = await file(admin, "PRJ-107", { gate: 2, owner: "PE-03", name: "Revised under a seat" });
    let d = await docOf(admin, id);
    await admin.patch("/api/documents/" + id, { expectedSeat: seat.id, version: d.version });
    const rv = await admin.post(`/api/documents/${id}/revise`, {});
    assert.equal(rv.status, 201, JSON.stringify(rv.body));
    assert.equal((await docOf(admin, rv.body.id)).expectedSeat, seat.id);
  });
});

/* ── the rule itself, exhaustively ──────────────────────────────────── */

describe("rbac · a review grant changes no verdict but document.approve and the reads", () => {
  const P = {
    grpDAI:  { id: "PRJ-107", programme_id: "DAI", site_id: "BLR", governance_level: "group" },
    siteDAI: { id: "PRJ-133", programme_id: "DAI", site_id: "SIN", governance_level: "site" },
    siteGRU: { id: "PRJ-136", programme_id: "DCH", site_id: "GRU", governance_level: "site" },
    grpCBP:  { id: "PRJ-101", programme_id: "CBP", site_id: "KRK", governance_level: "group" },
  };
  const user = (role, writeRows, reviewRows = []) => ({
    id: "U-T", role, active: true, personId: "PE-12",
    grants: normaliseGrants([...writeRows, ...reviewRows]),
  });
  const REVIEW_DAI = [{ scope_kind: "programme", programme_id: "DAI", power: "review" }];
  const holders = {
    viewer: [[{ scope_kind: "site", site_id: "LIS" }]],
    site:   [[{ scope_kind: "site", site_id: "GRU" }]],
    group:  [[{ scope_kind: "programme", programme_id: "CBP" }]],
  };
  const resourceFor = (p) => ({
    project: p, programme_id: p.programme_id, site_id: p.site_id, governance_level: p.governance_level,
    owner_id: "PE-99", gate: 2, raised_by: "PE-99", decided_by: "PE-99", pm_id: "PE-99",
    cost_delta: 0, weeks_delta: 0, threshold: { cost: 1, weeks: 1 },
  });

  for (const [role, [rows]] of Object.entries(holders)) {
    test(`${role}: every action except document.approve and project.read gets the same answer with and without the grant`, () => {
      const without = user(role, rows);
      const withR = user(role, rows, REVIEW_DAI);
      for (const p of Object.values(P)) {
        for (const a of ACTIONS) {
          if (a === "document.approve" || a === "project.read") continue;
          const r = resourceFor(p);
          assert.equal(can(withR, a, r).ok, can(without, a, r).ok, `${role} · ${a} · ${p.id}`);
        }
      }
    });
  }

  test("a viewer reviewer is refused, by name, every write the issue lists", () => {
    const v = user("viewer", holders.viewer[0], REVIEW_DAI);
    const r = resourceFor(P.grpDAI);
    for (const a of ["project.write", "raid.write", "change.approve", "change.raise", "project.baseline",
                     "benefit.review", "benefit.write", "document.write", "project.gate", "schedule.write",
                     "assurance.write", "waiver.grant", "decision.ratify", "objection.raise", "cost.write",
                     "meeting.write", "moc.approve", "case.write", "lesson.write", "concern.raise"]) {
      assert.equal(can(v, a, r).ok, false, a);
    }
    assert.equal(can(v, "document.approve", r).ok, true);
    assert.equal(can(v, "audit.read", r).ok, false, "a review grant does not open the audit trail");
  });

  test("document.approve: in scope yes; outside no; own document no; site-governed gate evidence only for group eyes", () => {
    const viewer = user("viewer", holders.viewer[0], REVIEW_DAI);
    const site = user("site", holders.site[0], REVIEW_DAI);
    const group = user("group", holders.group[0], REVIEW_DAI);
    const approve = (u, p, extra = {}) => can(u, "document.approve", { ...resourceFor(p), ...extra }).ok;

    for (const u of [viewer, site, group]) {
      assert.equal(approve(u, P.grpDAI), true, u.role + " in scope");
      assert.equal(approve(u, P.grpDAI, { owner_id: "PE-12" }), false, u.role + " own document");
      assert.equal(approve(u, P.siteDAI, { gate: 0 }), true, u.role + " non-gate paper on a site project");
    }
    assert.equal(approve(viewer, P.grpCBP), false, "viewer outside scope");
    assert.equal(approve(site, P.grpCBP), false, "site outside scope");
    assert.equal(approve(viewer, P.siteDAI), false, "viewer on site-governed gate evidence");
    assert.equal(approve(site, P.siteDAI), false, "site on site-governed gate evidence");
    assert.equal(approve(group, P.siteDAI), true, "group eyes on site-governed gate evidence");

    const deputy = { ...viewer, personId: "PE-40", actingForPersonId: "PE-12" };
    assert.equal(approve(deputy, P.grpDAI, { owner_id: "PE-12" }), false, "a deputy does not approve the absent reviewer's own paper");
  });

  test("the reads: the reviewed scope is seen, an observer is never narrowed, and the SQL agrees", () => {
    const scoped = user("viewer", holders.viewer[0], REVIEW_DAI);
    assert.equal(canSeeProject(scoped, P.grpDAI), true);
    assert.equal(canSeeProject(scoped, P.grpCBP), false);

    const observer = user("viewer", [], REVIEW_DAI);
    assert.equal(canSeeProject(observer, P.grpCBP), true, "an ungranted viewer stays portfolio-wide");
    assert.equal(projectScopeSql(observer).sql, "true");

    const site = user("site", holders.site[0], REVIEW_DAI);
    assert.equal(canSeeProject(site, P.siteDAI), true, "a site reviewer sees the site-governed project it reviews");
    const s = projectScopeSql(site);
    assert.match(s.sql, /programme_id = ANY\(\$2\)/);
    assert.deepEqual(s.params, [["GRU"], ["DAI"], []]);

    const oneProject = user("viewer", holders.viewer[0], [{ scope_kind: "project", project_id: "PRJ-133", power: "review" }]);
    assert.equal(canSeeProject(oneProject, P.siteDAI), true);
    assert.equal(canSeeProject(oneProject, P.grpDAI), false);
    assert.deepEqual(projectScopeSql(oneProject).params, [[], ["LIS"], [], ["PRJ-133"]]);
  });

  test("the SQL narrowing runs on the real database", async () => {
    const site = user("site", holders.site[0], REVIEW_DAI);
    const s = projectScopeSql(site);
    const rows = await many(`SELECT p.id FROM project p WHERE ${s.sql} ORDER BY p.id`, s.params);
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes("PRJ-133"), "the reviewed site-governed project");
    assert.ok(ids.includes("PRJ-136"), "its own site");
    assert.ok(!ids.includes("PRJ-112"), "another site's site-governed project");
  });
});

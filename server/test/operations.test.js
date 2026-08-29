/**
 * Operational fitness — the CRUD the daily rhythm actually needs.
 *
 * Every case here corresponds to a finding in the operational review:
 * something a real PMO does in a normal month that the system either
 * could not do, or offered a button for and then refused.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU, SITE_PROJECT_YYZ } from "./harness.js";
import { one, many } from "../src/db.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

const book = async (c) => (await c.get("/api/bootstrap")).body.db;

describe("change requests are editable while pending (finding 1)", () => {
  test("the edit button now reaches a route", async () => {
    const admin = await as("admin");
    const cr = (await book(admin)).crs.find((c) => c.status === "Pending");
    const r = await admin.patch("/api/change/" + cr.id, {
      title: "Reworded after the corridor review", version: cr.version,
    });
    assert.equal(r.status, 200);
    const after = (await book(admin)).crs.find((c) => c.id === cr.id);
    assert.equal(after.title, "Reworded after the corridor review");
  });

  test("changing the magnitude resets the approvals already given", async () => {
    const admin = await as("admin");
    const cr = (await book(admin)).crs.find((c) => c.status === "Pending" && c.steps.some((s) => s.state === "done"));
    assert.ok(cr, "the seed has a part-approved request");

    const r = await admin.patch("/api/change/" + cr.id, { cost: cr.cost + 2, version: cr.version });
    assert.equal(r.status, 200);
    assert.equal(r.body.approvalsReset, true,
      "a signature given for one figure must not carry to another");

    const after = (await book(admin)).crs.find((c) => c.id === cr.id);
    assert.equal(after.steps.filter((s) => s.state === "done").length, 0);
    assert.equal(after.steps[0].state, "current");
  });

  test("a decided request cannot be edited or withdrawn", async () => {
    const admin = await as("admin");
    const done = (await book(admin)).crs.find((c) => c.status !== "Pending");
    assert.equal((await admin.patch("/api/change/" + done.id, { title: "no" })).status, 409);
    assert.equal((await admin.del("/api/change/" + done.id)).status, 409);
  });

  test("a pending request can be withdrawn", async () => {
    const admin = await as("admin");
    const created = await admin.post("/api/change", {
      project: GROUP_PROJECT, title: "Raised in error", cost: 0.01, weeks: 0,
    });
    assert.equal(created.status, 201);
    assert.equal((await admin.del("/api/change/" + created.body.id)).status, 200);
    assert.ok(!(await book(admin)).crs.some((c) => c.id === created.body.id));
  });
});

describe("the ledger can be corrected (finding 6)", () => {
  test("a posting is reversed, not edited — and both lines stay", async () => {
    const admin = await as("admin");
    const before = await book(admin);
    const acBefore = before.ledger.filter((l) => l.project === GROUP_PROJECT)
      .reduce((n, l) => n + l.amount, 0);

    const posted = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.75, period: "2026-07", note: "Typed a 7 for a 1",
    });
    assert.equal(posted.status, 201);

    const mid = await book(admin);
    const line = mid.ledger.find((l) => l.note === "Typed a 7 for a 1");
    assert.ok(line, "the posting carries an id the interface can point at");

    const rev = await admin.post(`/api/cost/${line.id}/reverse`, { reason: "Wrong figure" });
    assert.equal(rev.status, 201);

    const after = await book(admin);
    const acAfter = after.ledger.filter((l) => l.project === GROUP_PROJECT)
      .reduce((n, l) => n + l.amount, 0);
    assert.ok(Math.abs(acAfter - acBefore) < 1e-6, "actual cost is back where it started");
    assert.ok(after.ledger.some((l) => l.id === line.id), "the original posting is still on the record");
    assert.ok(after.ledger.some((l) => l.reversal && l.amount === -0.75), "and so is the reversal");
  });

  test("a reversal cannot itself be reversed, nor a posting twice", async () => {
    const admin = await as("admin");
    const db = await book(admin);
    const reversal = db.ledger.find((l) => l.reversal);
    assert.equal((await admin.post(`/api/cost/${reversal.id}/reverse`, {})).status, 409);

    const original = db.ledger.find((l) => l.note === "Typed a 7 for a 1");
    assert.equal((await admin.post(`/api/cost/${original.id}/reverse`, {})).status, 409);
  });

  test("reversing a contingency draw gives the contingency back", async () => {
    const admin = await as("admin");
    const before = (await book(admin)).projects.find((p) => p.id === GROUP_PROJECT);

    const drawn = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.05, period: "2026-07",
      note: "Contingency draw in error", fromContingency: true,
    });
    assert.equal(drawn.status, 201);
    const mid = (await book(admin)).projects.find((p) => p.id === GROUP_PROJECT);
    assert.ok(mid.contingencyUsed > before.contingencyUsed, "the draw registered");

    const line = (await book(admin)).ledger.find((l) => l.note === "Contingency draw in error");
    assert.equal((await admin.post(`/api/cost/${line.id}/reverse`, { reason: "Mis-keyed" })).status, 201);

    const after = (await book(admin)).projects.find((p) => p.id === GROUP_PROJECT);
    assert.ok(Math.abs(after.contingencyUsed - before.contingencyUsed) < 1e-6,
      "and the reversal released it again");
  });

  test("site level still cannot touch the ledger at all", async () => {
    const gru = await as("siteGRU");
    const line = (await book(gru)).ledger[0];
    if (!line) return;
    assert.equal((await gru.post(`/api/cost/${line.id}/reverse`, {})).status, 403);
  });
});

describe("stages can be added and removed (finding 8)", () => {
  test("adding a stage takes its weight from the others, not from thin air", async () => {
    const naka = await as("siteYYZ");
    const before = await book(naka);
    const acts = before.activities.filter((a) => a.project === SITE_PROJECT_YYZ);
    const sumBefore = acts.reduce((n, a) => n + a.weight, 0);
    assert.ok(Math.abs(sumBefore - 1) < 0.01, "weights start summing to one");

    const r = await naka.post("/api/activities", {
      project: SITE_PROJECT_YYZ, name: "Wall-mount variant procurement",
      start: "2026-09-01", end: "2026-11-30", weight: 0.08,
    });
    assert.equal(r.status, 201);

    const after = await book(naka);
    const now = after.activities.filter((a) => a.project === SITE_PROJECT_YYZ);
    assert.equal(now.length, acts.length + 1);
    const sumAfter = now.reduce((n, a) => n + a.weight, 0);
    assert.ok(Math.abs(sumAfter - 1) < 0.02,
      `weights must still sum to one, got ${sumAfter} — otherwise earned value is invented`);
  });

  test("removing a stage returns its weight to the rest", async () => {
    const naka = await as("siteYYZ");
    const target = (await book(naka)).activities
      .find((a) => a.name === "Wall-mount variant procurement");
    assert.ok(target);
    assert.equal((await naka.del("/api/activities/" + target.id)).status, 200);

    const now = (await book(naka)).activities.filter((a) => a.project === SITE_PROJECT_YYZ);
    const sum = now.reduce((n, a) => n + a.weight, 0);
    assert.ok(Math.abs(sum - 1) < 0.02, `weights back to one, got ${sum}`);
  });

  test("a stage with reported progress is not silently discarded", async () => {
    const naka = await as("siteYYZ");
    const withProgress = (await book(naka)).activities
      .find((a) => a.project === SITE_PROJECT_YYZ && a.pct > 0);
    assert.ok(withProgress, "the seed has progress somewhere");
    const r = await naka.del("/api/activities/" + withProgress.id);
    assert.equal(r.status, 409);
    assert.match(r.body.error, /reported progress/i);
  });

  test("a stage cannot end before it starts", async () => {
    const naka = await as("siteYYZ");
    const r = await naka.post("/api/activities", {
      project: SITE_PROJECT_YYZ, name: "Backwards", start: "2026-09-01", end: "2026-08-01",
    });
    assert.equal(r.status, 400);
  });
});

describe("milestones are editable and removable (finding 8)", () => {
  test("a hand-placed milestone can be edited and deleted", async () => {
    const naka = await as("siteYYZ");
    const made = await naka.post("/api/milestones", {
      project: SITE_PROJECT_YYZ, name: "Pilot branch sign-off", date: "2027-02-01",
    });
    assert.equal(made.status, 201);

    const m = (await book(naka)).milestones.find((x) => x.id === made.body.id);
    assert.equal((await naka.patch("/api/milestones/" + m.id, {
      name: "Pilot branch sign-off (revised)", done: true, version: m.version,
    })).status, 200);

    const updated = (await book(naka)).milestones.find((x) => x.id === m.id);
    assert.equal(updated.done, true);
    assert.match(updated.name, /revised/);

    assert.equal((await naka.del("/api/milestones/" + m.id)).status, 200);
    assert.ok(!(await book(naka)).milestones.some((x) => x.id === m.id));
  });

  test("a gate is part of the governance model and cannot be deleted", async () => {
    const naka = await as("siteYYZ");
    const gate = (await book(naka)).milestones
      .find((m) => m.project === SITE_PROJECT_YYZ && m.kind === "gate");
    const r = await naka.del("/api/milestones/" + gate.id);
    assert.equal(r.status, 409);
    assert.match(r.body.error, /governance/i);
  });
});

describe("cross-project dependencies are manageable (finding 7)", () => {
  test("a link needs write authority over BOTH ends", async () => {
    const gru = await as("siteGRU");
    // São Paulo may write its own project but not Toronto's.
    const r = await gru.post("/api/crossdeps", {
      from: SITE_PROJECT_GRU, fromStage: 0, to: SITE_PROJECT_YYZ, toStage: 1, label: "nope",
    });
    assert.ok(r.status === 403 || r.status === 404,
      `one side cannot commit the other — got ${r.status}`);
  });

  test("an administrator can create and remove one", async () => {
    const admin = await as("admin");
    const made = await admin.post("/api/crossdeps", {
      from: GROUP_PROJECT, fromStage: 2, to: SITE_PROJECT_GRU, toStage: 1,
      label: "Settlement contract",
    });
    assert.equal(made.status, 201);

    const db = await book(admin);
    const link = db.crossDeps.find((d) => d.label === "Settlement contract");
    assert.ok(link, "the link comes back in the book");

    const dup = await admin.post("/api/crossdeps", {
      from: GROUP_PROJECT, fromStage: 2, to: SITE_PROJECT_GRU, toStage: 1,
    });
    assert.equal(dup.status, 409, "the same link cannot be recorded twice");

    const all = await many(`SELECT id FROM cross_dep WHERE label = 'Settlement contract'`);
    assert.equal((await admin.del("/api/crossdeps/" + all[0].id)).status, 200);
  });

  test("a project cannot depend on itself, nor on a stage that is not there", async () => {
    const admin = await as("admin");
    assert.equal((await admin.post("/api/crossdeps", {
      from: GROUP_PROJECT, fromStage: 0, to: GROUP_PROJECT, toStage: 1,
    })).status, 400);
    assert.equal((await admin.post("/api/crossdeps", {
      from: GROUP_PROJECT, fromStage: 99, to: SITE_PROJECT_GRU, toStage: 0,
    })).status, 400);
  });
});

describe("people have a lifecycle (finding 4)", () => {
  test("a mover changes role, rate and site", async () => {
    const admin = await as("admin");
    const p = (await book(admin)).people.find((x) => x.id === "PE-22");
    const r = await admin.patch("/api/admin/people/" + p.id, {
      role: "Senior business analyst", rate: 610, site: "LIS", version: p.version,
    });
    assert.equal(r.status, 200);
    const after = (await book(admin)).people.find((x) => x.id === p.id);
    assert.equal(after.role, "Senior business analyst");
    assert.equal(after.rate, 610);
    assert.equal(after.site, "LIS");
  });

  test("a leaver who still holds work is refused, with the reason", async () => {
    const admin = await as("admin");
    const pm = (await book(admin)).projects.find((p) => !p.closed).pm;
    const person = (await book(admin)).people.find((x) => x.id === pm);
    const r = await admin.patch("/api/admin/people/" + pm, {
      active: false, version: person.version,
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /live project|open/i);
  });

  test("and can be deactivated deliberately with force", async () => {
    const admin = await as("admin");
    const pm = (await book(admin)).projects.find((p) => !p.closed).pm;
    const person = (await book(admin)).people.find((x) => x.id === pm);
    assert.equal((await admin.patch("/api/admin/people/" + pm, {
      active: false, force: true, version: person.version,
    })).status, 200);
    const gone = await one(`SELECT active FROM person WHERE id = $1`, [pm]);
    assert.equal(gone.active, false);
  });

  test("only an administrator may touch the directory", async () => {
    for (const who of ["groupCBP", "siteGRU", "viewerLIS"]) {
      const c = await as(who);
      assert.equal((await c.patch("/api/admin/people/PE-01", { rate: 1, version: 1 })).status, 403, who);
    }
  });
});

describe("sites and programmes are correctable (finding 8)", () => {
  test("a site can be renamed and re-described", async () => {
    const admin = await as("admin");
    const site = (await book(admin)).sites.find((s) => s.id === "GRU");
    const r = await admin.patch("/api/admin/sites/GRU", {
      headcount: 44, charter: "Regional rollout, localisation and merchant onboarding",
      version: site.version,
    });
    assert.equal(r.status, 200);
    const s = (await book(admin)).sites.find((x) => x.id === "GRU");
    assert.equal(s.headcount, 44);
    assert.match(s.role, /merchant onboarding/);
  });

  test("a programme still holding live projects is not quietly retired", async () => {
    const admin = await as("admin");
    const prog = (await book(admin)).programmes.find((g) => g.id === "CBP");
    const r = await admin.patch("/api/admin/programmes/CBP", {
      active: false, version: prog.version,
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /live project/i);
  });
});

describe("accounts and grants are administrable (finding 3)", () => {
  test("an administrator creates an account with its first grant", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/admin/users", {
      email: "new.lead@meridian.example", displayName: "New Lead", role: "site",
      password: "first-password-2026", grants: [{ kind: "site", target: "LIS" }],
    });
    assert.equal(r.status, 201);

    const users = (await admin.get("/api/admin/users")).body.users;
    const made = users.find((u) => u.email === "new.lead@meridian.example");
    assert.equal(made.role, "site");
    assert.deepEqual(made.grants.sites, ["LIS"]);
  });

  test("a group or site account cannot be created with no grants at all", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/admin/users", {
      email: "blind@meridian.example", displayName: "Blind", role: "group",
      password: "another-password-2026", grants: [],
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /grant/i);
  });

  test("grants are added and revoked by what they name", async () => {
    const admin = await as("admin");
    const u = (await admin.get("/api/admin/users")).body.users
      .find((x) => x.email === "new.lead@meridian.example");

    assert.equal((await admin.post(`/api/admin/users/${u.id}/grants`,
      { kind: "site", target: "GRU" })).status, 201);
    let fresh = (await admin.get("/api/admin/users")).body.users.find((x) => x.id === u.id);
    assert.deepEqual(fresh.grants.sites.sort(), ["GRU", "LIS"]);

    assert.equal((await admin.post(`/api/admin/users/${u.id}/grants/revoke`,
      { kind: "site", target: "GRU" })).status, 200);
    fresh = (await admin.get("/api/admin/users")).body.users.find((x) => x.id === u.id);
    assert.deepEqual(fresh.grants.sites, ["LIS"]);

    // revoking twice is not an error — two administrators may be tidying at once
    assert.equal((await admin.post(`/api/admin/users/${u.id}/grants/revoke`,
      { kind: "site", target: "GRU" })).body.alreadyRevoked, true);
  });

  test("a site account cannot be granted a programme, nor the reverse", async () => {
    const admin = await as("admin");
    const u = (await admin.get("/api/admin/users")).body.users
      .find((x) => x.email === "new.lead@meridian.example");
    const r = await admin.post(`/api/admin/users/${u.id}/grants`,
      { kind: "programme", target: "CBP" });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /scoped by site/i);
  });

  test("the new account can actually sign in and is correctly scoped", async () => {
    const { client } = await import("./harness.js");
    const c = client();
    const user = await c.login("new.lead@meridian.example", "first-password-2026");
    assert.equal(user.role, "site");
    const db = (await c.get("/api/bootstrap")).body.db;
    // Lisbon's own projects, plus every group-governed one, and nothing else.
    for (const p of db.projects) {
      assert.ok(p.site === "LIS" || p.governanceLevel === "group",
        `${p.id} should not be visible to a Lisbon site account`);
    }
  });
});

describe("no screen offers an action the account cannot perform", () => {
  /* R7.3 says a control the account has no authority for is absent, not
     greyed out. Three committees agreed that rule and it was still applied
     by hand, one button at a time: the coordination pass found ten
     unguarded write controls — the change-request decision row, five
     in-view create buttons, the document row, the cost-booking row, the
     assignment row, the report narrative and the grant revoke. The server
     refused every one of them, so nothing leaked; what leaked was the
     user's time.

     The rule now has a gate. This test is that gate, run as a test so it
     cannot be skipped by anyone who does not think to run the audit. */
  test("every write control asks whether the account may", async () => {
    const { execFileSync } = await import("node:child_process");
    let out = "", failed = false;
    try {
      out = execFileSync(process.execPath, ["scripts/audit/control-audit.mjs"],
        { encoding: "utf8" });
    } catch (e) {
      out = (e.stdout ?? "") + (e.stderr ?? "");
      failed = true;
    }
    assert.equal(failed, false,
      "scripts/audit/control-audit.mjs reported unguarded controls:" + out);
    assert.match(out, /0 unguarded write control\(s\)/);
  });

  test("the view helper delegates rather than repeating the rule", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("web/src/views/index.js", "utf8");
    assert.match(src, /function primaryAction\(view, db\)[\s\S]{0,300}HEADER_ACTIONS\[view\]/,
      "primaryAction must ask HEADER_ACTIONS, not carry its own copy of the rule");
    assert.match(src, /return a \?[\s\S]{0,160}: null;/,
      "when the shell says no, the view renders nothing at all");
  });
});

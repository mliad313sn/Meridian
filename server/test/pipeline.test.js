/**
 * V-13 · V-04 — demand intake and prioritisation.
 *
 * The funnel in front of the portfolio, and the queue behind it. The
 * properties that matter: anyone may ASK, only the group DECIDES, a
 * decline carries its reason, and the queue knows where the money runs
 * out without inventing a constraint nobody agreed.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as } from "./harness.js";
import { Engine } from "../../shared/engine.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

/* ── the model ────────────────────────────────────────────────────── */

test("priority pulls up on fit and value, down on risk and effort", () => {
  const cheapCertainWin = { fit: 4, value: 4, risk: 1, effort: 1 };
  const expensiveGamble = { fit: 4, value: 4, risk: 5, effort: 5 };
  assert.equal(Engine.priority(cheapCertainWin), 18);
  assert.equal(Engine.priority(expensiveGamble), 10);
  assert.equal(Engine.priority({ fit: 4, value: 4, risk: 1 }), null, "an incomplete score is not a score");
});

test("the queue ranks, totals and finds the line — and invents no line when none is agreed", () => {
  const projects = [
    { id: "A", name: "A", budget: 3, fit: 5, value: 5, risk: 1, effort: 1 },   // 20
    { id: "B", name: "B", budget: 4, fit: 3, value: 3, risk: 3, effort: 3 },   // 12
    { id: "C", name: "C", budget: 5, fit: null, value: null, risk: null, effort: null },
  ];
  const capped = Engine.prioritise({}, projects, 6);
  assert.deepEqual(capped.rows.map(r => r.project.id), ["A", "B", "C"], "best score first, unscored last");
  assert.equal(capped.rows[0].funded, true);
  assert.equal(capped.rows[1].funded, false, "the running total passes the envelope");
  assert.equal(capped.over, 6, "12 demanded against 6");
  assert.equal(capped.unscored, 1);

  const uncapped = Engine.prioritise({}, projects, 0);
  assert.equal(uncapped.rows.every(r => r.funded), true, "no envelope, no line");

  const ranked = Engine.prioritise({}, [{ ...projects[1], rank: 1 }, { ...projects[0], rank: 2 }], 0);
  assert.deepEqual(ranked.rows.map(r => r.project.id), ["B", "A"], "a hand-placed rank overrules the score");
});

/* ── authority ────────────────────────────────────────────────────── */

test("anyone who writes may ask; only the group decides", () => {
  const site = { role: "site", active: true, grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const group = { role: "group", active: true, grants: { programmes: new Set(["DCH"]), sites: new Set() } };
  const viewer = { role: "viewer", active: true, grants: { programmes: new Set(), sites: new Set() } };
  assert.equal(can(site, "demand.raise").ok, true);
  assert.equal(can(viewer, "demand.raise").ok, false, "read-only stays read-only");
  assert.equal(can(site, "demand.decide").ok, false);
  assert.equal(can(group, "demand.decide").ok, true);
  assert.equal(can(site, "priority.write").ok, false);
});

/* ── the funnel, end to end ───────────────────────────────────────── */

let demandId = null;

test("a site lead asks, and the request records who asked and what for", async () => {
  const pm = await as("siteGRU");
  const r = await pm.post("/api/demand", {
    title: "Replace the weighbridge integration",
    sponsor: "Processing manager", site: "GRU", estCost: 0.4,
    benefitNote: "Removes 3 hours of manual reconciliation a day",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  demandId = r.body.id;

  const list = (await pm.get("/api/demand")).body.demand;
  const d = list.find((x) => x.id === demandId);
  assert.equal(d.status, "New");
  assert.match(d.raisedBy, /site/, "the asker is named with their level");
  assert.equal(d.estCost, 0.4, "cost round-trips in millions");
});

test("a site lead cannot decide their own request", async () => {
  const pm = await as("siteGRU");
  const list = (await pm.get("/api/demand")).body.demand;
  const d = list.find((x) => x.id === demandId);
  const refused = await pm.patch("/api/demand/" + demandId, { status: "Approved", version: d.version });
  assert.equal(refused.status, 403);
});

test("a decline must say why; an approval is scored and dated", async () => {
  const dch = await as("groupDCH");
  let d = (await dch.get("/api/demand")).body.demand.find((x) => x.id === demandId);

  const bare = await dch.patch("/api/demand/" + demandId, { status: "Declined", version: d.version });
  assert.equal(bare.status, 400, JSON.stringify(bare.body));
  assert.match(bare.body.error, /reason/);

  const ok = await dch.patch("/api/demand/" + demandId, {
    status: "Approved", fit: 4, value: 5, risk: 2, effort: 2, version: d.version,
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  d = (await dch.get("/api/demand")).body.demand.find((x) => x.id === demandId);
  assert.equal(d.status, "Approved");
  assert.ok(d.decidedOn, "the decision is dated");
  assert.match(d.decidedBy, /group/);
  assert.equal(Engine.priority(d), 4 + 5 + 4 + 4, "and scored");
});

test("an approved request becomes a project, and keeps the thread", async () => {
  const dch = await as("groupDCH");
  const made = await dch.post("/api/demand/" + demandId + "/convert", {
    name: "Weighbridge integration replacement", programme: "DCH", site: "GRU",
    governanceLevel: "site", start: "2027-01-11", finish: "2027-09-30",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const d = (await dch.get("/api/demand")).body.demand.find((x) => x.id === demandId);
  assert.equal(d.status, "Converted");
  assert.equal(d.project, made.body.id, "the request names the project it became");

  const p = (await dch.get("/api/bootstrap")).body.db.projects.find((x) => x.id === made.body.id);
  assert.ok(p, "and the project exists");
  assert.equal(p.fit, 4, "carrying the scores it was approved on");
  assert.equal(p.value, 5);

  const again = await dch.post("/api/demand/" + demandId + "/convert", {
    programme: "DCH", site: "GRU", start: "2027-01-11", finish: "2027-09-30",
  });
  assert.equal(again.status, 409, "and it only happens once");

  const gone = await dch.del("/api/demand/" + demandId);
  assert.equal(gone.status, 409, "a converted request is not deleted out from under its project");
});

test("priority is set at group level and lands on the project", async () => {
  const pm = await as("siteGRU");
  const db = (await pm.get("/api/bootstrap")).body.db;
  const p = db.projects[0];
  const refused = await pm.patch("/api/projects/" + p.id + "/priority", { fit: 5, version: p.version });
  assert.equal(refused.status, 403);

  const admin = await as("admin");
  const fresh = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === p.id);
  const ok = await admin.patch("/api/projects/" + p.id + "/priority",
    { fit: 3, value: 4, risk: 2, effort: 3, rank: 1, version: fresh.version });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const after = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === p.id);
  assert.equal(after.rank, 1);
  assert.equal(Engine.priority(after), 3 + 4 + 4 + 3);
});

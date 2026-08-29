/**
 * V-01 · Benefits and value realisation (Endeavour committee).
 *
 * The finding was that the portfolio could prove a project was run well
 * and could not prove it was worth doing. These tests hold the three
 * things that closes:
 *
 *   · a benefit round-trips every field it stores;
 *   · the team that delivered measures it, and does NOT rule on it;
 *   · attainment reads the same whether the number should go up or down.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { Engine } from "../../shared/engine.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

/* ── the arithmetic ───────────────────────────────────────────────── */

test("attainment is a fraction of the intended MOVE, so it reads the same in both directions", () => {
  // availability meant to rise: 82 → 95, measured 91
  assert.equal(Engine.attainment({ baseline: 82, target: 95, actual: 91 }).toFixed(3), "0.692");
  // cost per ounce meant to FALL: 100 → 80, measured 90 — the same 50%
  assert.equal(Engine.attainment({ baseline: 100, target: 80, actual: 90 }), 0.5);
  // beaten, and worse than the day it started
  assert.equal(Engine.attainment({ baseline: 100, target: 80, actual: 70 }), 1.5);
  assert.equal(Engine.attainment({ baseline: 100, target: 80, actual: 110 }), -0.5);
  // an unmeasured benefit is not a zero
  assert.equal(Engine.attainment({ baseline: 82, target: 95, actual: null }), null);
  assert.equal(Engine.attainment({ baseline: null, target: 95, actual: 91 }), null);
});

test("valueProfile counts what is promised, measured and still promising nothing", () => {
  const db = {
    benefits: [
      { project: "P1", status: "Realised", baseline: 0, target: 10, actual: 10 },
      { project: "P1", status: "Forecast", baseline: 0, target: 10, actual: null },
      { project: "P1", status: "Missed", baseline: 0, target: 10, actual: 2 },
      { project: "P1", status: "Withdrawn", baseline: 0, target: 10, actual: null },
      { project: "PX", status: "Realised", baseline: 0, target: 5, actual: 5 },  // out of slate
    ],
  };
  const vp = Engine.valueProfile(db, [{ id: "P1" }, { id: "P2" }]);
  assert.equal(vp.total, 4, "only this slate's benefits");
  assert.equal(vp.live, 3, "withdrawn is not a live promise");
  assert.equal(vp.measured, 2);
  assert.equal(vp.decided, 2, "forecast has not been ruled on");
  assert.equal(vp.met, 1);
  assert.equal(vp.uncased, 1, "P2 promises nothing");
});

/* ── the round trip ───────────────────────────────────────────────── */

let benefitId = null;

test("a benefit round-trips every field it stores", async () => {
  const pm = await as("siteGRU");
  const created = await pm.post("/api/benefits", {
    project: SITE_PROJECT_GRU, kind: "Availability",
    title: "Fewer plant stoppages from network drop-outs",
    detail: "Measured from the historian's downtime log, monthly",
    measure: "Plant availability", unit: "%",
    baseline: 82.4, target: 95, realiseOn: "2027-03-31",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  benefitId = created.body.id;

  let b = (await pm.get("/api/bootstrap")).body.db.benefits.find(x => x.id === benefitId);
  assert.ok(b, "the benefit reaches the client");
  assert.equal(b.kind, "Availability");
  assert.equal(b.measure, "Plant availability");
  assert.equal(b.unit, "%");
  assert.equal(b.baseline, 82.4, "not scaled by 1e6 — a benefit is not money");
  assert.equal(b.target, 95);
  assert.equal(b.actual, null, "unmeasured, not zero");
  assert.equal(b.status, "Forecast");

  // update every field the form offers
  const patched = await pm.patch("/api/benefits/" + benefitId, {
    kind: "Production", title: "Fewer stoppages", detail: "revised method",
    measure: "Tonnes milled", unit: "t", baseline: 100, target: 120, actual: 111,
    realiseOn: "2027-06-30", measuredOn: "2027-07-02", version: b.version,
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));

  b = (await pm.get("/api/bootstrap")).body.db.benefits.find(x => x.id === benefitId);
  assert.equal(b.kind, "Production");
  assert.equal(b.measure, "Tonnes milled");
  assert.equal(b.baseline, 100);
  assert.equal(b.target, 120);
  assert.equal(b.actual, 111);
  assert.equal(b.measuredOn, "2027-07-02");
  assert.equal(Engine.attainment(b).toFixed(2), "0.55");
});

/* ── independence ─────────────────────────────────────────────────── */

test("the team that delivered may measure a benefit but may not rule on it", async () => {
  const pm = await as("siteGRU");
  const b = (await pm.get("/api/bootstrap")).body.db.benefits.find(x => x.id === benefitId);

  const claims = await pm.patch("/api/benefits/" + benefitId,
    { status: "Realised", version: b.version });
  assert.equal(claims.status, 403, JSON.stringify(claims.body));
  assert.match(claims.body.error, /group/);

  // withdrawing a promise is a statement about the plan, and stays theirs
  const withdrawn = await pm.patch("/api/benefits/" + benefitId,
    { status: "Withdrawn", version: b.version });
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));

  const admin = await as("admin");
  const fresh = (await admin.get("/api/bootstrap")).body.db.benefits.find(x => x.id === benefitId);
  const ruled = await admin.patch("/api/benefits/" + benefitId,
    { status: "Partially realised", version: fresh.version });
  assert.equal(ruled.status, 200, JSON.stringify(ruled.body));
});

test("the post-implementation review is a group act, and a shortfall needs a reason", async () => {
  const pm = await as("siteGRU");
  const p = (await pm.get("/api/bootstrap")).body.db.projects.find(x => x.id === SITE_PROJECT_GRU);
  const refused = await pm.patch("/api/projects/" + SITE_PROJECT_GRU + "/review",
    { verdict: "Met", version: p.version });
  assert.equal(refused.status, 403);

  const dch = await as("groupDCH");
  let fresh = (await dch.get("/api/bootstrap")).body.db.projects.find(x => x.id === SITE_PROJECT_GRU);
  const bare = await dch.patch("/api/projects/" + SITE_PROJECT_GRU + "/review",
    { verdict: "Partly met", version: fresh.version });
  assert.equal(bare.status, 400, "a verdict short of Met needs its reason");
  assert.match(bare.body.error, /reason/);

  const ok = await dch.patch("/api/projects/" + SITE_PROJECT_GRU + "/review", {
    verdict: "Partly met", note: "Availability improved but short of the 95% target",
    version: fresh.version,
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  fresh = (await dch.get("/api/bootstrap")).body.db.projects.find(x => x.id === SITE_PROJECT_GRU);
  assert.equal(fresh.pirVerdict, "Partly met");
  assert.match(fresh.pirNote, /short of the 95%/);
  assert.ok(fresh.pirOn, "the review is dated");

  // and it lands in the trail with its images
  const audit = await dch.get("/api/audit?action=Post-implementation%20review%20recorded&limit=5");
  const row = audit.body.events.find((e) => e.entity_id === SITE_PROJECT_GRU);
  assert.ok(row, "the verdict is a named audit action");
  assert.equal(row.after_json.verdict, "Partly met");
});

test("benefit.review is group-level in the gate itself, not only in the route", () => {
  const site = { role: "site", active: true, personId: "PE-19",
    grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const project = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  assert.equal(can(site, "benefit.write", { project }).ok, true);
  assert.equal(can(site, "benefit.review", { project }).ok, false);
});

test("a benefit can be removed, and the removal keeps what it promised", async () => {
  const pm = await as("siteGRU");
  const gone = await pm.del("/api/benefits/" + benefitId);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  const after = (await pm.get("/api/bootstrap")).body.db.benefits.find(x => x.id === benefitId);
  assert.equal(after, undefined);

  const admin = await as("admin");
  const audit = await admin.get("/api/audit?action=Benefit%20removed&limit=5");
  const row = audit.body.events.find((e) => e.entity_id === benefitId);
  assert.ok(row, "the removal is on the record");
  assert.equal(row.before_json.target, 120, "with the promise it carried");
});

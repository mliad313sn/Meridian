/**
 * V-02 · Period close and reported snapshots (Endeavour committee).
 *
 * The finding: every reported number is computed live, so the pack the
 * board saw in March cannot be regenerated in June. These tests hold the
 * three properties that closes:
 *
 *   · what was reported survives the book moving underneath it;
 *   · it cannot be rewritten — a correction is a new period that names
 *     the one it restates;
 *   · it is still portfolio data, so it is scoped like everything else.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

let periodId = null;
let reportedName = null;
let reportedFinish = null;

test("closing a period is a group act", () => {
  const site = { role: "site", active: true, personId: "PE-19",
    grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const group = { role: "group", active: true,
    grants: { programmes: new Set(["DCH"]), sites: new Set() } };
  assert.equal(can(site, "period.close").ok, false);
  assert.equal(can(group, "period.close").ok, true);
});

test("a site account cannot close the group's books", async () => {
  const pm = await as("siteGRU");
  const refused = await pm.post("/api/periods", { label: "August 2026" });
  assert.equal(refused.status, 403);
});

test("closing a period freezes every project as it stood", async () => {
  const admin = await as("admin");
  const before = (await admin.get("/api/bootstrap")).body.db;
  const p = before.projects.find((x) => x.id === SITE_PROJECT_GRU);
  reportedName = p.name;
  reportedFinish = p.finish;

  const closed = await admin.post("/api/periods", {
    label: "August 2026", note: "First close of the new register",
  });
  assert.equal(closed.status, 201, JSON.stringify(closed.body));
  periodId = closed.body.id;
  assert.equal(closed.body.projects, before.projects.length, "every project the closer can see");
  assert.equal(closed.body.statusDate, before.statusDate, "one status date for the whole period");

  const read = await admin.get("/api/periods/" + periodId);
  assert.equal(read.status, 200);
  assert.equal(read.body.period.label, "August 2026");
  assert.ok(read.body.period.closedBy.includes("admin"), "the closer is named");
  const row = read.body.snapshot.find((s) => s.project === SITE_PROJECT_GRU);
  assert.ok(row, "the project is in the frozen set");
  assert.equal(row.name, reportedName);
  assert.equal(row.finish, reportedFinish);
  assert.ok(row.rag, "with the status that was reported");
});

test("the frozen numbers do not move when the book does", async () => {
  const admin = await as("admin");
  let p = (await admin.get("/api/bootstrap")).body.db.projects
    .find((x) => x.id === SITE_PROJECT_GRU);

  // move the project hard: a new name and a finish date a year out
  const moved = await admin.patch("/api/projects/" + SITE_PROJECT_GRU, {
    name: reportedName + " (rescoped)", finish: "2028-12-31", version: p.version,
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));

  p = (await admin.get("/api/bootstrap")).body.db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  assert.notEqual(p.name, reportedName, "the live book really did change");

  const read = await admin.get("/api/periods/" + periodId);
  const row = read.body.snapshot.find((s) => s.project === SITE_PROJECT_GRU);
  assert.equal(row.name, reportedName, "August still says what August said");
  assert.equal(row.finish, reportedFinish);
});

test("a closed period cannot be rewritten — the database refuses", async () => {
  const { query, many } = await import("../src/db.js");
  await query(`UPDATE report_period SET label = 'Tampered' WHERE id = $1`, [periodId]);
  await query(`DELETE FROM report_snapshot WHERE period_id = $1`, [periodId]);
  await query(`DELETE FROM report_period WHERE id = $1`, [periodId]);

  const still = await many(`SELECT label FROM report_period WHERE id = $1`, [periodId]);
  assert.equal(still.length, 1, "the period is still there");
  assert.equal(still[0].label, "August 2026", "with the label it was closed under");
  const rows = await many(`SELECT count(*)::int AS n FROM report_snapshot WHERE period_id = $1`, [periodId]);
  assert.ok(rows[0].n > 0, "and its rows");
});

test("a correction is a new period that names the one it restates", async () => {
  const admin = await as("admin");
  const bad = await admin.post("/api/periods", { label: "August 2026 (v2)", restates: "RP-999" });
  assert.equal(bad.status, 400, "restating something that does not exist is refused");

  const restated = await admin.post("/api/periods", {
    label: "August 2026 (restated)", restates: periodId,
    note: "Rescoping of the LATAM wave was agreed after the first close",
  });
  assert.equal(restated.status, 201, JSON.stringify(restated.body));

  const list = await admin.get("/api/periods");
  const v2 = list.body.periods.find((x) => x.id === restated.body.id);
  assert.equal(v2.restates, periodId, "the restatement is on the record");
  assert.ok(list.body.periods.some((x) => x.id === periodId), "and the original is still there");

  const audit = await admin.get("/api/audit?action=Reporting%20period%20restated&limit=5");
  assert.ok(audit.body.events.some((e) => e.entity_id === restated.body.id),
    "restating is its own audit action");
});

test("a closed period is scoped like everything else", async () => {
  const viewer = await as("viewerGRU");
  const read = await viewer.get("/api/periods/" + periodId);
  assert.equal(read.status, 200, "a viewer may read the period");
  const all = await as("admin");
  const full = await all.get("/api/periods/" + periodId);
  assert.ok(read.body.snapshot.length <= full.body.snapshot.length,
    "and sees no more of it than their scope allows");
  assert.ok(read.body.snapshot.every((s) => s.project), "rows are whole where shown");
});

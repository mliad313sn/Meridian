/**
 * REQ-51 (RT365) — the write contract records that a RAID review
 * HAPPENED, not only when the next one is due.
 *
 * `PUT /api/v1/raid` sets `review`, which schedules. Performing a review
 * is an event (REQ-46, migration 050) and only a screen could write one,
 * so RT365's `meridian_sync.py` moved the date instead — erasing the only
 * evidence that a review took place. `PUT /api/v1/raid-reviews` writes
 * the event, keyed by the integration's own id.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { one, many } from "../src/db.js";

let c, h;
before(async () => {
  await boot();
  const admin = await as("admin");
  const key = await admin.post("/api/admin/integrations", { name: "REQ-51 sync", scopes: ["write:portfolio", "read:portfolio"] });
  assert.equal(key.status, 201, key.text);
  c = await as(null);
  h = { "X-API-Key": key.body.key };
  const item = await c.put("/api/v1/raid/R51-A", {
    project: GROUP_PROJECT, title: "Correspondent bank cut-over slips", review: "2026-09-01" }, h);
  assert.equal(item.status, 201, item.text);
});
after(shutdown);

const itemRow = () => one(`SELECT id, review_on FROM raid_item WHERE external_id = 'R51-A'`);

describe("REQ-51 · a review performed, through the contract", () => {
  test("a review is recorded as an event, and the item's due date follows it", async () => {
    const r = await c.put("/api/v1/raid-reviews/RV-1",
      { item: "R51-A", by: "PE-07", on: "2026-09-10", note: "Mitigation on track", next: "2026-10-10" }, h);
    assert.equal(r.status, 201, r.text);
    const v = await one(`SELECT * FROM raid_review WHERE id = $1`, [r.body.id]);
    assert.equal(v.reviewed_by, "PE-07");
    assert.equal(String(v.reviewed_on).slice(0, 10), "2026-09-10");
    assert.equal(String(v.due_on).slice(0, 10), "2026-09-01", "what was due when it happened — compliance reads from the row");
    assert.equal(String((await itemRow()).review_on).slice(0, 10), "2026-10-10");
    const audit = await one(`SELECT count(*)::int AS n FROM audit_event WHERE action = 'Register item reviewed' AND entity_id = $1`, [v.raid_id]);
    assert.equal(audit.n, 1);
  });

  test("a sync that runs twice records one review", async () => {
    const again = await c.put("/api/v1/raid-reviews/RV-1",
      { item: "R51-A", by: "PE-07", on: "2026-09-10", note: "Mitigation on track", next: "2026-10-10" }, h);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.body.created, false);
    const item = await itemRow();
    const n = (await many(`SELECT id FROM raid_review WHERE raid_id = $1`, [item.id])).length;
    assert.equal(n, 1);
  });

  test("the screen reads the same event", async () => {
    const item = await itemRow();
    const r = await (await as("groupCBP")).get(`/api/raid/${item.id}/reviews`);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.reviews.length, 1);
    assert.equal(r.body.reviews[0].reviewedBy, "PE-07");
    assert.equal(r.body.reviews[0].onTime, false, "reviewed on 10/09 against a due date of 01/09");
  });

  test("a correction re-derives the due date", async () => {
    const r = await c.put("/api/v1/raid-reviews/RV-1", { next: "2026-10-20" }, h);
    assert.equal(r.status, 200, r.text);
    assert.equal(String((await itemRow()).review_on).slice(0, 10), "2026-10-20");
  });

  test("refusals name what is wrong, and write nothing", async () => {
    const before = (await many(`SELECT id FROM raid_review`)).length;
    const noBy = await c.put("/api/v1/raid-reviews/RV-2", { item: "R51-A", on: "2026-09-12" }, h);
    assert.equal(noBy.status, 400); assert.match(noBy.body.error, /by names the person/);
    const backwards = await c.put("/api/v1/raid-reviews/RV-2", { item: "R51-A", by: "PE-07", on: "2026-09-12", next: "2026-09-01" }, h);
    assert.equal(backwards.status, 400); assert.match(backwards.body.error, /after the one being recorded/);
    const unknown = await c.put("/api/v1/raid-reviews/RV-2", { item: "R51-A", by: "PE-07", reviewer: "x" }, h);
    assert.equal(unknown.status, 400); assert.match(unknown.body.error, /raid-reviews does not accept "reviewer"/);
    const nowhere = await c.put("/api/v1/raid-reviews/RV-2", { item: "NOPE", by: "PE-07" }, h);
    assert.equal(nowhere.status, 400); assert.match(nowhere.body.error, /No such register item/);
    assert.equal((await many(`SELECT id FROM raid_review`)).length, before);
  });

  test("a review stays on the item it reviewed", async () => {
    const other = await c.put("/api/v1/raid/R51-B", { project: GROUP_PROJECT, title: "Second item" }, h);
    assert.equal(other.status, 201, other.text);
    const moved = await c.put("/api/v1/raid-reviews/RV-1", { item: "R51-B" }, h);
    assert.equal(moved.status, 400); assert.match(moved.body.error, /stays on the item it reviewed/);
  });

  test("the published contract describes the route and its closed body", async () => {
    const doc = (await c.get("/api/v1/openapi.json", h)).body;
    const put = doc.paths["/api/v1/raid-reviews/{externalId}"]?.put;
    assert.ok(put, "described");
    assert.deepEqual(Object.keys(put.requestBody.content["application/json"].schema.properties).sort(),
      ["by", "item", "next", "note", "on", "version"]);
  });
});

/**
 * NEW-19 and NEW-20 (docs/36, wave 3) · WHAT A REPLACE DOES TO WHAT IS
 * ALREADY THERE.
 *
 * NEW-19: a replace import put every row back at row_version 1. A screen
 *   holding version 1 of a row that had been at 7 could then write over
 *   what the import brought in; the concurrency check (CONTRIBUTING rule
 *   3) held for every writer except the one that rewrites everything.
 *
 * NEW-20: a replace erases every list the file does not carry, and
 *   nothing said so. A KODO book, or any export older than 5.21.0, has no
 *   meeting register: replacing with it erased the meeting register in
 *   silence. The dry run now reports `wouldErase`, list by list, and the
 *   import screen shows it before the replace is confirmed.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { one } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

const exportBook = async (admin) => structuredClone((await admin.get("/api/admin/export")).body);
const count = async (table) => (await one(`SELECT count(*)::int AS n FROM ${table}`)).n;

describe("NEW-19 · a replace import moves every version past what a screen could hold", () => {
  test("a screen holding the version read before a replace is refused with 409", async () => {
    const admin = await as("admin");
    const book0 = await exportBook(admin);
    const p = book0.projects.find((x) => x.origin === "local" && !x.closed);

    /* Edit it a few times, so the version a screen holds is not 1. */
    let v = (await one(`SELECT row_version FROM project WHERE id = $1`, [p.id])).row_version;
    for (const desc of ["first edit", "second edit", "third edit"]) {
      const r = await admin.patch(`/api/projects/${p.id}`, { desc, version: v });
      assert.equal(r.status, 200, r.text);
      v = (await one(`SELECT row_version FROM project WHERE id = $1`, [p.id])).row_version;
    }
    assert.ok(v > 1, "the screen holds a version past 1");

    const book = await exportBook(admin);
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);

    const now = (await one(`SELECT row_version FROM project WHERE id = $1`, [p.id])).row_version;
    assert.ok(now > v, `the replaced row is past ${v} (it is at ${now})`);
    const stale = await admin.patch(`/api/projects/${p.id}`, { desc: "typed on a stale screen", version: v });
    assert.equal(stale.status, 409, stale.text);
    const stale1 = await admin.patch(`/api/projects/${p.id}`, { desc: "typed on an older screen", version: 1 });
    assert.equal(stale1.status, 409, "nor can a screen holding version 1 write over it");
    const fresh = await admin.patch(`/api/projects/${p.id}`, { desc: "typed on a fresh screen", version: now });
    assert.equal(fresh.status, 200, fresh.text);
  });

  test("the rule holds table-wide: no row of a replaced table is at a version held before", async () => {
    const admin = await as("admin");
    const maxBefore = (await one(`SELECT max(row_version)::int AS m FROM raid_item`)).m;
    const r = await admin.post("/api/admin/import", { db: await exportBook(admin) });
    assert.equal(r.status, 200, r.text);
    const minAfter = (await one(`SELECT min(row_version)::int AS m FROM raid_item`)).m;
    assert.ok(minAfter > maxBefore, `every RAID row is past ${maxBefore} (lowest is ${minAfter})`);
  });
});

describe("NEW-20 · the dry run says what a replace would erase", () => {
  test("a file with no meeting register: the dry run names each meeting list and its count", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    for (const k of ["meetingSeries", "meetings", "decisions", "actions", "raidReviews"]) delete book[k];
    const series = await count("meeting_series");
    assert.ok(series > 0, "the database holds meeting series to lose");

    const dry = await admin.post("/api/admin/import?dryRun=1", { db: book });
    assert.equal(dry.status, 200, dry.text);
    assert.equal(dry.body.wouldErase.meetingSeries, series);
    assert.equal(dry.body.wouldErase.meetings, await count("meeting_occurrence"));
    assert.equal(dry.body.wouldErase.actions, await count("meeting_action"));
    assert.equal(dry.body.wouldErase.decisions, await count("meeting_decision"));
    assert.equal(dry.body.wouldErase.projects, undefined, "a list the file carries is not 'erased'");
    assert.equal(await count("meeting_series"), series, "a dry run erases nothing");
  });

  test("the product's own export would erase nothing", async () => {
    const admin = await as("admin");
    const dry = await admin.post("/api/admin/import?dryRun=1", { db: await exportBook(admin) });
    assert.equal(dry.status, 200, dry.text);
    assert.deepEqual(dry.body.wouldErase, {});
  });

  test("a merge erases nothing, so it reports nothing", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    delete book.meetingSeries;
    const dry = await admin.post("/api/admin/import?dryRun=1&mode=merge", { db: book });
    assert.equal(dry.status, 200, dry.text);
    assert.deepEqual(dry.body.wouldErase, {});
  });

  test("a real replace says what it erased, in its answer and in the trail", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    delete book.raidReviews;
    delete book.meetingSeries; delete book.meetings; delete book.decisions; delete book.actions;
    const series = await count("meeting_series");
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.erased.meetingSeries, series);
    assert.equal(await count("meeting_series"), 0);
    const trail = await one(
      `SELECT after_json FROM audit_event WHERE action = 'Book imported' ORDER BY id DESC LIMIT 1`);
    const after_ = typeof trail.after_json === "string" ? JSON.parse(trail.after_json) : trail.after_json;
    assert.equal(after_.erased.meetingSeries, series);
  });
});

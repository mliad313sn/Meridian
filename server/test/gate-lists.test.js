/**
 * REQ-52 — a gate's own list of what it watches is checked against the
 * product, so a thing it does not name is reported rather than unseen.
 *
 * persistence.test.js holds reset-book's two lists against the live
 * schema. This file does the same for what the static gates read:
 *
 *   · the schema reading F2 and version-audit share (scripts/audit/lib/
 *     schema.mjs) against information_schema — every table, every
 *     column, every `row_version` — so a statement its pattern cannot read
 *     is a failing test and not a table F2 never sees;
 *   · the mount table F1 and F9 share (server/src/routemap.js) against
 *     the app itself: every router file is mounted, and every GET route it
 *     derives really answers at the path it derived (no fallback 404);
 *   · NEW-08: `GET /api/v1/signals` is in the published contract.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { many } from "../src/db.js";
import { servedRoutes, unmountedRouterFiles } from "../src/routemap.js";
import { mountedRoutes, openApiDocument } from "../src/openapi.js";
import { migrationSchema } from "../../scripts/audit/lib/schema.mjs";

let base = "";
before(async () => { ({ base } = await boot()); });
after(async () => { await shutdown(); });

describe("REQ-52 · the schema the gates read is the schema the product has", () => {
  test("every live table is read by lib/schema.mjs, and nothing it reads is missing", async () => {
    const live = (await many(
      `SELECT table_name AS t FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).map((r) => r.t).sort();
    const schema = migrationSchema();
    assert.deepEqual(schema.unreadable, [], "a CREATE TABLE the gates' reading could not parse");
    /* schema_migration is created by migrate() itself (db.js), not by a
       migration file: it is the one table the file reading cannot see,
       and it is named here rather than skipped silently. */
    assert.deepEqual(live.filter((t) => !schema.names.includes(t)), ["schema_migration"],
      "a live table the gates' schema reading does not see");
    assert.deepEqual(schema.names.filter((t) => !live.includes(t)), [],
      "the gates read a table the database does not have");
  });

  test("every live column is read, under its current name", async () => {
    const rows = await many(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public'`);
    const { tables } = migrationSchema();
    const unseen = [], phantom = [];
    for (const [t, cols] of Object.entries(tables)) {
      const liveCols = rows.filter((r) => r.t === t).map((r) => r.c)
        .filter((c) => !["id", "row_version", "created_at"].includes(c));
      for (const c of liveCols) if (!cols.includes(c)) unseen.push(`${t}.${c}`);
      for (const c of cols) if (!liveCols.includes(c)) phantom.push(`${t}.${c}`);
    }
    assert.deepEqual(unseen, [], "a live column F2 never asks about");
    assert.deepEqual(phantom, [], "a column F2 asks about that the database does not have");
  });

  test("the versioned tables version-audit derives are the ones carrying row_version", async () => {
    const live = (await many(
      `SELECT DISTINCT table_name AS t FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'row_version'`)).map((r) => r.t).sort();
    assert.deepEqual([...migrationSchema().versioned].sort(), live);
  });
});

describe("REQ-52 · the routes the gates read are the routes the app serves", () => {
  test("every router file under server/src/routes is mounted by buildApp()", async () => {
    assert.deepEqual(await unmountedRouterFiles(), []);
  });

  test("every GET the mount table derives answers at that path, not the fallback 404", async () => {
    const admin = await as("admin");
    const lost = [];
    for (const { method, path } of servedRoutes()) {
      if (method !== "GET" || !path.startsWith("/api/")) continue;
      const res = await fetch(base + path.replace(/:\w+/g, "req52-probe"),
        { headers: { cookie: admin.cookie }, redirect: "manual" });
      const text = await res.text();
      if (res.status === 404 && /No such endpoint/.test(text)) lost.push(path);
    }
    assert.deepEqual(lost, [], "the mount table places these routes where the app does not answer");
  });

  test("NEW-08 · GET /api/v1/signals is mounted, described and published", () => {
    const keys = mountedRoutes().map((r) => `${r.method} ${r.path}`);
    assert.ok(keys.includes("GET /api/v1/signals"), "F9 does not see the signals route");
    const doc = openApiDocument({ version: "test" });
    assert.equal(doc.paths["/api/v1/signals"]?.get?.["x-required-scope"], "read:portfolio");
  });
});

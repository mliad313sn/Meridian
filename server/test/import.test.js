/**
 * R2.6 — a whole-book export must come back in through the import.
 *
 * Nothing exercised POST /api/admin/import, so the identifier-counter
 * query at the end of importBook() shipped with '\D' inside a JavaScript
 * template literal. The template drops the backslash, PostgreSQL receives
 * regexp_replace(id, 'D', …), and the ::int cast then fails on "PRJ-101":
 * every import answered 400, including the file this system exports.
 *
 * Found by running the FitAdapt programme on Meridian, together with
 * three neighbours: the import dropped every document's uri (so imported
 * evidence stopped counting), it refused the bare book GET /export
 * answers, and the PGlite fallback was an in-memory database, which made
 * the README's quick start unable to sign anyone in.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { many, one, query, resolvePgliteDir, DEFAULT_PGLITE_DIR } from "../src/db.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

describe("R2.6 · whole-book import", () => {
  test("the book this system exports imports back without error", async () => {
    const admin = await as("admin");
    const exported = await admin.get("/api/admin/export");
    assert.equal(exported.status, 200);
    const before = exported.body.projects.length;
    assert.ok(before > 0, "the seed has projects to round-trip");

    const r = await admin.post("/api/admin/import", { db: exported.body });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.counts.projects, before);
    const { n } = await one(`SELECT count(*)::int AS n FROM project`);
    assert.equal(n, before);
  });

  test("identifier counters follow the imported rows, so the next id cannot collide", async () => {
    const counters = Object.fromEntries(
      (await many(`SELECT prefix, next_value FROM id_counter`)).map((c) => [c.prefix, Number(c.next_value)]));
    const { max } = await one(
      `SELECT MAX(regexp_replace(id, '\\D', '', 'g')::int) AS max FROM project`);
    assert.ok(counters.PRJ >= Number(max), `PRJ counter ${counters.PRJ} is behind the highest id ${max}`);
  });

  test("the bare book GET /export answers is accepted as well as { db }", async () => {
    const admin = await as("admin");
    const exported = await admin.get("/api/admin/export");
    const r = await admin.post("/api/admin/import", exported.body);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.counts.projects, exported.body.projects.length);
  });

  test("a document keeps its evidence uri, lock and supersession through the round trip", async () => {
    const [a, b] = await many(`SELECT id FROM document ORDER BY id LIMIT 2`);
    await query(
      `UPDATE document SET uri = $2, uri_locked_hash = 'abc123', uri_locked_on = '2026-08-01', supersedes = $3
        WHERE id = $1`, [a.id, "https://docs.meridian.example/evidence/" + a.id, b.id]);
    const admin = await as("admin");
    const exported = await admin.get("/api/admin/export");
    const r = await admin.post("/api/admin/import", { db: exported.body });
    assert.equal(r.status, 200, r.text);
    const d = await one(`SELECT uri, uri_locked_hash, uri_locked_on::text AS on, supersedes FROM document WHERE id = $1`, [a.id]);
    assert.equal(d.uri, "https://docs.meridian.example/evidence/" + a.id);
    assert.equal(d.uri_locked_hash, "abc123");
    assert.equal(d.on, "2026-08-01");
    assert.equal(d.supersedes, b.id);
  });
});

describe("NEW-05 · what the book may point at, and what it may not rewrite", () => {
  test("an account or integration this database does not hold drops to null; the row still comes in", async () => {
    const admin = await as("admin");
    const book = structuredClone((await admin.get("/api/admin/export")).body);
    /* A file from another instance names ITS accounts and ITS
       integrations. Accounts are not book data (import.js header), so the
       pointer cannot be honoured — but the posting and the project are. */
    book.ledger[0].createdBy = "U-from-elsewhere";
    book.projects[0].externalSource = "INT-from-elsewhere";
    book.projects[0].externalId = "their-42";
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    const line = await one(`SELECT created_by FROM cost_line WHERE id = $1`, [Number(book.ledger[0].id)]);
    assert.ok(line, "the posting came in under its own id");
    assert.equal(line.created_by, null);
    const p = await one(`SELECT external_source, external_id FROM project WHERE id = $1`, [book.projects[0].id]);
    assert.equal(p.external_source, null);
    assert.equal(p.external_id, "their-42");
  });

  test("a merge never rewrites a posting: a different line under a held id is refused by name", async () => {
    const admin = await as("admin");
    const book = structuredClone((await admin.get("/api/admin/export")).body);
    const held = book.ledger[0];
    const amount = Number((await one(`SELECT amount FROM cost_line WHERE id = $1`, [Number(held.id)])).amount);
    held.amount += 1;   // one million more, under the same number
    const dry = await admin.post("/api/admin/import?mode=merge&dryRun=1", { db: book });
    assert.equal(dry.status, 200, dry.text);
    assert.deepEqual(dry.body.rejects.map((x) => [x.table, x.id]), [["cost_line", held.id]]);
    assert.match(dry.body.rejects[0].reason, /append-only/);
    const r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.equal(Number((await one(`SELECT amount FROM cost_line WHERE id = $1`, [Number(held.id)])).amount),
      amount, "the posting the ledger holds is the one it keeps");
  });

  test("the ledger and timesheet sequences follow the imported ids", async () => {
    const admin = await as("admin");
    const book = structuredClone((await admin.get("/api/admin/export")).body);
    book.ledger[0].id = "900001";
    book.timesheets = [{ id: "700001", person: book.people[0].id, project: book.projects[0].id,
                         week: "2026-08-24", days: 2 }];
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    const next = await one(`SELECT nextval(pg_get_serial_sequence('cost_line','id'))::int AS c,
                                   nextval(pg_get_serial_sequence('timesheet','id'))::int AS t`);
    assert.equal(next.c, 900002);
    assert.equal(next.t, 700002);
  });
});

describe("a refused import says which row", () => {
  test("the answer names the table and the id, and nothing is half-imported", async () => {
    const admin = await as("admin");
    const exported = (await admin.get("/api/admin/export")).body;
    const before = (await one(`SELECT count(*)::int AS n FROM project`)).n;
    const bad = structuredClone(exported);
    bad.projects[1].start = "not a date";
    const r = await admin.post("/api/admin/import", { db: bad });
    assert.equal(r.status, 400);
    assert.match(r.body.error, new RegExp(`project ${bad.projects[1].id}$`));
    assert.equal((await one(`SELECT count(*)::int AS n FROM project`)).n, before, "the transaction rolled back");
  });
});

describe("PGlite data directory", () => {
  test("with nothing configured the book lives where the README says, not in memory", () => {
    assert.equal(resolvePgliteDir({}, {}), DEFAULT_PGLITE_DIR);
    assert.match(DEFAULT_PGLITE_DIR, /server[\\/]\.data[\\/]pgdata$/);
  });
  test("PGLITE_DIR and an explicit dataDir still win, in that order of precedence", () => {
    assert.equal(resolvePgliteDir({}, { PGLITE_DIR: "/x" }), "/x");
    assert.equal(resolvePgliteDir({ dataDir: "/y" }, { PGLITE_DIR: "/x" }), "/y");
  });
  test("dataDir: null is an explicit in-memory request and is not overridden by PGLITE_DIR", () => {
    assert.equal(resolvePgliteDir({ dataDir: null }, { PGLITE_DIR: "/x" }), null);
  });
});

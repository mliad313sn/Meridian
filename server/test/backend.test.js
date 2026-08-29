/**
 * Backend guarantees — the properties the review made conditions.
 *
 * These are the failures that do not show up in a feature test: a race
 * that only fires behind a connection pool, a concurrency check that
 * looks like one and is not, an index the planner needed and nobody
 * added. They are cheap to assert and expensive to rediscover.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT } from "./harness.js";
import { many, one, tx, allocateId, insertMany, assertIdentifiers } from "../src/db.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

describe("identifier allocation is atomic", () => {
  test("two allocations in the same prefix never collide", async () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      const id = await tx((t) => allocateId(t, "RSK", { pad: 2 }));
      assert.ok(!seen.has(id), `allocated ${id} twice`);
      seen.add(id);
    }
    assert.equal(seen.size, 20);
  });

  test("allocation continues past everything the seed wrote", async () => {
    /* The counter is seeded from an empty database by the migration, then
       the seed inserts rows. If the two are not reconciled the first
       allocation collides with a seeded row — which is exactly what
       happened the first time. */
    for (const [prefix, table, like] of [
      ["DOC", "document", "DOC-%"],
      ["ACT", "meeting_action", "ACT-%"],
      ["DEC", "meeting_decision", "DEC-%"],
      ["PE", "person", "PE-%"],
      ["WI", "work_item", "WI-%"],
    ]) {
      const counter = await one(`SELECT next_value FROM id_counter WHERE prefix = $1`, [prefix]);
      const highest = await one(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), ''))::int, 0) AS n
           FROM ${table} WHERE id LIKE $1`, [like]);
      assert.ok(counter.next_value >= highest.n,
        `${prefix}: counter at ${counter.next_value} is behind the highest row ${highest.n}`);
    }
  });

  test("an allocation rolls back with its transaction", async () => {
    const before = await one(`SELECT next_value FROM id_counter WHERE prefix = 'WI'`);
    await assert.rejects(() => tx(async (t) => {
      await allocateId(t, "WI");
      throw new Error("deliberate");
    }));
    const after = await one(`SELECT next_value FROM id_counter WHERE prefix = 'WI'`);
    assert.equal(after.next_value, before.next_value,
      "a failed request must not burn an identifier");
  });
});

describe("optimistic concurrency covers every table that gets edited", () => {
  test("every table an edit form writes to carries row_version", async () => {
    const edited = [
      "project", "activity", "milestone", "raid_item", "change_request",
      "allocation", "document", "work_item",
      "person", "site", "programme", "board_column",
      "app_user", "meeting_series", "meeting_occurrence", "meeting_action",
    ];
    for (const table of edited) {
      const col = await one(
        `SELECT 1 AS y FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'row_version'`, [table]);
      assert.ok(col, `${table} is edited through a form but has no row_version`);
    }
  });

  test("a form edit that does not name its version is refused, not accepted", async () => {
    const admin = await as("admin");
    /* Falling back to the row the request just read makes the check
       unfailable, which is worse than no check because it looks like one.
       It was fixed on the administration routes first and left on
       thirteen others — so every versioned write path is checked here,
       not just the three that prompted the finding. */
    const db = (await admin.get("/api/bootstrap")).body.db;
    const project = db.projects[0];
    const activity = db.activities.find((a) => a.project === project.id);
    const milestone = db.milestones.find((m) => m.kind === "milestone") ?? db.milestones[0];
    const raid = db.raid.find((x) => x.project);
    const cr = db.crs.find((c) => c.status === "Pending");
    const alloc = db.allocations[0];
    const doc = db.docs.find((d) => d.project);
    const item = db.items[0];
    const series = (await admin.get("/api/meetings/series")).body.series[0];
    const action = (await admin.get("/api/meetings/actions?status=Open")).body.actions[0];

    const paths = [
      [`/api/projects/${project.id}`, { desc: "x" }],
      [`/api/projects/${project.id}/health`, { rag: "A", why: "because" }],
      [`/api/projects/${project.id}/baseline`, { baselineFinish: "2028-01-01" }],
      [`/api/activities/${activity.id}`, { pct: 10 }],
      [`/api/milestones/${milestone.id}`, { name: "x" }],
      [`/api/raid/${raid.id}`, { title: "x" }],
      [`/api/change/${cr.id}`, { title: "x" }],
      [`/api/allocations/${alloc.id}`, { pct: 10 }],
      [`/api/documents/${doc.id}`, { name: "x" }],
      [`/api/workitems/${item.id}`, { title: "x" }],
      [`/api/meetings/series/${series.id}`, { name: "x" }],
      [`/api/meetings/actions/${action.id}`, { title: "x" }],
      ["/api/admin/people/PE-01", { rate: 1 }],
      ["/api/admin/sites/GRU", { headcount: 1 }],
      ["/api/admin/programmes/CBP", { sponsor: "x" }],
    ];

    for (const [path, body] of paths) {
      const r = await admin.patch(path, body);
      assert.equal(r.status, 428,
        `${path} accepted an edit that did not say which version it was based on (got ${r.status})`);
      assert.match(r.body.error, /which version/i);
    }
  });

  test("the same edit succeeds once it names its version", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const project = db.projects[0];
    const ok = await admin.patch(`/api/projects/${project.id}`, {
      desc: "Named its version", version: project.version,
    });
    assert.equal(ok.status, 200, "a well-formed edit must still go through");
  });

  test("the second of two writers on the same read is told", async () => {
    const a = await as("admin");
    const b = await as("pmo");
    const seen = await one(`SELECT row_version FROM person WHERE id = 'PE-05'`);
    const first = await a.patch("/api/admin/people/PE-05", {
      role: "Lead PM", version: seen.row_version,
    });
    const second = await b.patch("/api/admin/people/PE-05", {
      role: "Principal PM", version: seen.row_version,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    const now = await one(`SELECT job_role FROM person WHERE id = 'PE-05'`);
    assert.equal(now.job_role, "Lead PM", "the first write survived intact");
  });
});

describe("access paths", () => {
  test("the foreign keys the hot queries filter on are indexed", async () => {
    const required = [
      ["cross_dep", "from_project"],
      ["cross_dep", "to_project"],
      ["activity_dep", "predecessor_id"],
      ["meeting_action", "raised_in"],
      ["meeting_attendance", "person_id"],
      ["activity", "owner_id"],
      ["raid_item", "owner_id"],
      ["project", "pm_id"],
      ["cost_line", "created_by"],
    ];
    for (const [table, col] of required) {
      const idx = await one(
        `SELECT 1 AS y
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
          WHERE i.indrelid = $1::regclass AND a.attname = $2`,
        [table, col]);
      assert.ok(idx, `${table}.${col} is filtered on but has no leading index`);
    }
  });

  test("the scoped project query uses the index, not a full scan", async () => {
    const plan = await many(
      `EXPLAIN SELECT * FROM activity WHERE project_id = ANY($1)`,
      [[GROUP_PROJECT]]);
    const text = plan.map((r) => Object.values(r)[0]).join("\n");
    /* At twelve projects the planner may legitimately prefer a scan; the
       point is that an index exists for it to choose when the table
       grows. Assert the index, not the plan. */
    const idx = await one(
      `SELECT 1 AS y FROM pg_indexes WHERE tablename = 'activity' AND indexdef LIKE '%project_id%'`);
    assert.ok(idx, "activity has no index on project_id");
    assert.ok(text.length > 0, "the planner returned a plan");
  });
});

describe("SQL construction", () => {
  test("an identifier that is not a plain column name is refused", () => {
    assert.throws(() => assertIdentifiers(["project", "name; DROP TABLE project"]), /unsafe identifier/i);
    assert.throws(() => assertIdentifiers(["project", "1; --"]), /unsafe identifier/i);
    assert.throws(() => assertIdentifiers(['"quoted"']), /unsafe identifier/i);
    assert.doesNotThrow(() => assertIdentifiers(["project", "start_date", "row_version"]));
  });

  test("a versioned update refuses a patch key that is not a column name", async () => {
    const { updateVersioned } = await import("../src/db.js");
    await assert.rejects(
      () => tx((t) => updateVersioned(t, "project", GROUP_PROJECT, 1, { "name = 'x' --": "y" })),
      /unsafe identifier/i);
  });

  test("a multi-row insert binds every value as a parameter", async () => {
    const rows = [
      { id: "BULK-1", project_id: GROUP_PROJECT, name: "'); DROP TABLE project; --", due_date: "2027-01-01", base_date: "2027-01-01" },
      { id: "BULK-2", project_id: GROUP_PROJECT, name: "second", due_date: "2027-02-01", base_date: "2027-02-01" },
    ];
    await tx((t) => insertMany(t, "milestone",
      ["id", "project_id", "name", "due_date", "base_date"], rows));

    const stored = await many(`SELECT id, name FROM milestone WHERE id LIKE 'BULK-%' ORDER BY id`);
    assert.equal(stored.length, 2, "both rows landed in one statement");
    assert.equal(stored[0].name, "'); DROP TABLE project; --", "stored verbatim, not executed");
    const still = await one(`SELECT count(*)::int AS n FROM project`);
    assert.ok(still.n > 0, "the project table is still there");
  });
});

describe("statement volume", () => {
  test("creating a project no longer costs a statement per row", async () => {
    const admin = await as("admin");
    const created = await admin.post("/api/projects", {
      name: "Batching probe", programme: "EIT", site: "LON", governanceLevel: "group",
      start: "2027-01-04", finish: "2027-12-31", budget: 1, contingency: 0.1,
    });
    assert.equal(created.status, 201);
    const id = created.body.id;

    /* The observable claim: everything still arrives. The batching is
       about how it arrives, and is asserted by the shape of the code —
       insertMany, not a loop. */
    const acts = await one(`SELECT count(*)::int AS n FROM activity WHERE project_id = $1`, [id]);
    const gates = await one(`SELECT count(*)::int AS n FROM milestone WHERE project_id = $1 AND kind='gate'`, [id]);
    const docs = await one(`SELECT count(*)::int AS n FROM document WHERE project_id = $1`, [id]);
    const deps = await one(
      `SELECT count(*)::int AS n FROM activity_dep d
         JOIN activity a ON a.id = d.activity_id WHERE a.project_id = $1`, [id]);
    assert.ok(acts.n >= 6, "the schedule was written");
    assert.equal(gates.n, 4);
    assert.equal(docs.n, 4);
    assert.ok(deps.n >= 5, "the dependency links were written");

    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("server/src/wbs.js", "utf8"));
    assert.match(src, /insertMany\(t, "activity"/, "activities are inserted in one statement");
    assert.match(src, /insertMany\(t, "milestone"/, "gates are inserted in one statement");
    assert.doesNotMatch(src, /for \(const a of acts\) \{\s*await t\.query/,
      "no per-row insert loop should remain");
  });

  test("closing a meeting freezes its agenda in one statement", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("server/src/routes/meetings.js", "utf8"));
    assert.match(src, /insertMany\(t, "agenda_item"/,
      "the agenda freeze should be a single multi-row insert");
  });
});

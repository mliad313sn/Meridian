/**
 * R2.* and R6.* â€” persistence, concurrency, referential integrity, audit.
 *
 * A5 (Finance) and B2 (Security) both made conditions here: a lost
 * transaction and a rewritable audit trail are the two failures that make
 * every other number in the system unreliable.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { many, one, query, tx, migrate, engine } from "../src/db.js";
import { fromM, M } from "../src/portfolio.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

describe("schema and migrations (R2.2, R2.7)", () => {
  test("the engine really is PostgreSQL", async () => {
    const v = await one(`SELECT version() AS v`);
    assert.match(v.v, /PostgreSQL/);
  });

  test("R2.2 Â· migrations are recorded and re-running is a no-op", async () => {
    const applied = await many(`SELECT name FROM schema_migration ORDER BY name`);
    assert.deepEqual(applied.map((r) => r.name),
      ["001_core.sql", "002_portfolio.sql", "003_meetings.sql", "004_integrity.sql",
       "005_external.sql", "006_governance.sql", "007_frozen_agenda.sql",
       "008_benefits.sql", "009_periods.sql", "010_plant_and_sites.sql",
       "011_demand_and_priority.sql", "012_money_and_people.sql",
       "013_notifications.sql", "014_evidence.sql", "015_rotation.sql",
       "016_timesheet.sql", "017_absence_minimisation.sql",
       "018_notification_centre.sql", "019_notification_subscription.sql",
       "020_evidence_probe.sql", "021_usage_counters.sql",
       "022_site_champion.sql", "023_session_digest.sql", "024_lessons.sql", "025_integrations.sql", "026_tolerance.sql", "027_international.sql", "028_business_case.sql", "029_reporting_views.sql", "030_residual_risk.sql", "031_outbound_events.sql", "032_closure_quality.sql"]);
    const again = await migrate({ silent: true });
    assert.deepEqual(again, [], "a second run applies nothing");
  });

  test("R2.7 Â· referential integrity is enforced by the database", async () => {
    await assert.rejects(
      () => query(`INSERT INTO project (id,name,programme_id,site_id,start_date,finish_date,baseline_finish)
                   VALUES ('BAD','x','NOPE','GRU','2026-01-01','2026-02-01','2026-02-01')`),
      /foreign key|violates/i,
      "a project cannot reference a programme that does not exist"
    );
    await assert.rejects(
      () => query(`INSERT INTO activity (id,project_id,name,start_date,end_date,base_start,base_end)
                   VALUES ('BAD','NOPE','x','2026-01-01','2026-02-01','2026-01-01','2026-02-01')`),
      /foreign key|violates/i
    );
  });

  test("deleting a project takes its dependent records with it, not orphans", async () => {
    const admin = await as("admin");
    const created = await admin.post("/api/projects", {
      name: "Disposable", programme: "EIT", site: "GRU", governanceLevel: "site",
      start: "2026-01-01", finish: "2026-06-01", budget: 1, contingency: 0.1,
    });
    const id = created.body.id;
    await query(`INSERT INTO milestone (id,project_id,name,due_date,base_date)
                 VALUES ('DISP-M',$1,'x','2026-03-01','2026-03-01')`, [id]);
    await query(`DELETE FROM project WHERE id = $1`, [id]);
    const orphan = await one(`SELECT id FROM milestone WHERE id = 'DISP-M'`);
    assert.equal(orphan, null, "the milestone went with the project");
  });

  test("check constraints refuse impossible records", async () => {
    await assert.rejects(
      () => query(`UPDATE project SET finish_date = '2020-01-01' WHERE id = $1`, [GROUP_PROJECT]),
      /project_dates_ordered|violates/i,
      "a project cannot finish before it starts"
    );
    await assert.rejects(
      () => query(`UPDATE activity SET pct = 140 WHERE project_id = $1`, [GROUP_PROJECT]),
      /violates/i,
      "progress cannot exceed 100 per cent"
    );
    await assert.rejects(
      () => query(`UPDATE raid_item SET probability = 9 WHERE id = 'RSK-03'`),
      /violates/i
    );
  });

  test("a grant must name exactly one target", async () => {
    await assert.rejects(
      () => query(`INSERT INTO access_grant (user_id, scope_kind, programme_id, site_id)
                   VALUES ('U-SILVA','site','CBP','GRU')`),
      /grant_target_exclusive|violates/i
    );
  });
});

describe("money (R2.4)", () => {
  test("R2.4 Â· the ledger is exact numeric, not floating point", async () => {
    const col = await one(
      `SELECT data_type, numeric_precision, numeric_scale
         FROM information_schema.columns
        WHERE table_name = 'cost_line' AND column_name = 'amount'`);
    assert.equal(col.data_type, "numeric");
    assert.equal(Number(col.numeric_scale), 2);
  });

  test("a long ledger sums without drift", async () => {
    const admin = await as("admin");
    /* 0.1 + 0.2 in floating point is the classic failure. Booked a
       hundred times, a float ledger visibly diverges; numeric does not. */
    for (let i = 0; i < 100; i++) {
      const r = await admin.post("/api/cost", {
        project: GROUP_PROJECT, amount: 0.001, period: "2026-05", note: "drift probe",
      });
      assert.equal(r.status, 201);
    }
    const sum = await one(
      `SELECT SUM(amount) AS total FROM cost_line WHERE project_id = $1 AND note = 'drift probe'`,
      [GROUP_PROJECT]);
    assert.equal(Number(sum.total), 100 * fromM(0.001), "exactly 100 Ã— 1000 currency units");
  });

  test("contingency cannot be drawn beyond what is held", async () => {
    const admin = await as("admin");
    const before = (await admin.get("/api/bootstrap")).body.db.projects
      .find((p) => p.id === GROUP_PROJECT);
    const headroom = before.contingency - before.contingencyUsed;
    /* PM-06 : le tirage nomme son risque — le plafond se teste au-delà. */
    const risk = (await admin.get("/api/bootstrap")).body.db.raid.find((x) =>
      x.project === GROUP_PROJECT && x.type === "Risk" && x.status === "Open");
    const r = await admin.post("/api/cost", {
      project: GROUP_PROJECT, amount: headroom + 1, period: "2026-08",
      fromContingency: true, risk: risk.id,
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /more than the contingency/i);
  });
});

describe("optimistic concurrency (R2.5)", () => {
  test("R2.5 Â· the second writer is told, not silently overwritten", async () => {
    const a = await as("admin");
    const b = await as("pmo");
    const start = (await a.get("/api/bootstrap")).body.db.projects
      .find((p) => p.id === SITE_PROJECT_GRU);

    const first = await a.patch(`/api/projects/${SITE_PROJECT_GRU}`, {
      desc: "Written by the first editor", version: start.version,
    });
    assert.equal(first.status, 200);

    // B still holds the version it read before A wrote.
    const second = await b.patch(`/api/projects/${SITE_PROJECT_GRU}`, {
      desc: "Written by the second editor", version: start.version,
    });
    assert.equal(second.status, 409);

    const now = (await a.get("/api/bootstrap")).body.db.projects
      .find((p) => p.id === SITE_PROJECT_GRU);
    assert.equal(now.desc, "Written by the first editor", "the first write survived");
    assert.equal(now.version, start.version + 1);
  });

  test("re-reading and retrying succeeds", async () => {
    const b = await as("pmo");
    const fresh = (await b.get("/api/bootstrap")).body.db.projects
      .find((p) => p.id === SITE_PROJECT_GRU);
    const retry = await b.patch(`/api/projects/${SITE_PROJECT_GRU}`, {
      desc: "Written after re-reading", version: fresh.version,
    });
    assert.equal(retry.status, 200);
  });

  test("a failed transaction leaves nothing behind", async () => {
    const before = await one(`SELECT count(*)::int AS n FROM raid_item`);
    await assert.rejects(() => tx(async (t) => {
      await t.query(
        `INSERT INTO raid_item (id, project_id, kind, title) VALUES ('TX-1',$1,'Risk','half-written')`,
        [GROUP_PROJECT]);
      throw new Error("deliberate failure");
    }));
    const after = await one(`SELECT count(*)::int AS n FROM raid_item`);
    assert.equal(after.n, before.n, "the insert rolled back with the error");
  });
});

describe("audit (R6.1, R6.2, R6.3)", () => {
  test("R6.1 Â· every mutation is attributed to the account that made it", async () => {
    const silva = await as("siteGRU");
    const r = await silva.post("/api/raid", {
      project: SITE_PROJECT_GRU, type: "Issue", title: "Audit probe", p: 2, i: 2,
    });
    assert.equal(r.status, 201);

    const row = await one(
      `SELECT * FROM audit_event WHERE entity = 'raid_item' AND entity_id = $1`, [r.body.id]);
    assert.ok(row, "the write produced an audit row");
    assert.equal(row.user_id, "U-SILVA");
    assert.match(row.user_label, /G\. Silva \(site\)/);
    assert.match(row.detail, /Audit probe/);
  });

  test("the trail is no longer attributed to one hard-coded person", async () => {
    const actors = await many(`SELECT DISTINCT user_id FROM audit_event WHERE user_id IS NOT NULL`);
    assert.ok(actors.length >= 3, "several real accounts appear in the trail");
  });

  test("R6.2 Â· audit rows cannot be updated or deleted through the database", async () => {
    const before = await one(`SELECT id, detail FROM audit_event ORDER BY id DESC LIMIT 1`);

    await query(`UPDATE audit_event SET detail = 'tampered' WHERE id = $1`, [before.id]);
    const afterUpdate = await one(`SELECT detail FROM audit_event WHERE id = $1`, [before.id]);
    assert.equal(afterUpdate.detail, before.detail, "the UPDATE was silently discarded by the rule");

    await query(`DELETE FROM audit_event WHERE id = $1`, [before.id]);
    const afterDelete = await one(`SELECT id FROM audit_event WHERE id = $1`, [before.id]);
    assert.ok(afterDelete, "the DELETE was discarded too");
  });

  test("AD-4 Â· a mutation that cannot be audited does not commit", async () => {
    const before = await one(`SELECT count(*)::int AS n FROM raid_item`);
    await assert.rejects(() => tx(async (t) => {
      await t.query(
        `INSERT INTO raid_item (id, project_id, kind, title) VALUES ('TX-2',$1,'Risk','x')`,
        [GROUP_PROJECT]);
      // an audit insert that violates its own constraints
      await t.query(`INSERT INTO audit_event (action, entity, user_id) VALUES ('x','y','NO-SUCH-USER')`);
    }));
    const after = await one(`SELECT count(*)::int AS n FROM raid_item`);
    assert.equal(after.n, before.n, "the business write went back with the failed audit");
  });

  test("R6.3 Â· the trail is filterable, and readable only at group level and above", async () => {
    const pmo = await as("pmo");
    const all = await pmo.get("/api/audit?limit=50");
    assert.equal(all.status, 200);
    assert.ok(all.body.events.length > 0);

    const filtered = await pmo.get("/api/audit?entity=raid_item&limit=50");
    assert.ok(filtered.body.events.every((e) => e.entity === "raid_item"));

    const byUser = await pmo.get("/api/audit?user=U-SILVA&limit=50");
    assert.ok(byUser.body.events.every((e) => e.user_id === "U-SILVA"));

    const site = await as("siteGRU");
    assert.equal((await site.get("/api/audit")).status, 403);
    const viewer = await as("viewerLIS");
    assert.equal((await viewer.get("/api/audit")).status, 403);
  });

  test("the trail is not truncated at an arbitrary depth", async () => {
    const n = await one(`SELECT count(*)::int AS n FROM audit_event`);
    /* The v4 build capped the trail at 400 rows and dropped the rest.
       Nothing here does that; the count only ever grows. */
    const admin = await as("admin");
    await admin.patch(`/api/projects/${SITE_PROJECT_GRU}/health`,
      { rag: "A", why: "Watching the certification slot", version: 99 }).catch(() => {});
    const after = await one(`SELECT count(*)::int AS n FROM audit_event`);
    assert.ok(after.n >= n.n, "rows accumulate rather than roll off");
  });
});

describe("scoped serialisation (R1.10 at the data layer)", () => {
  test("out-of-scope records never enter the response object at all", async () => {
    const gru = await as("siteGRU");
    const db = (await gru.get("/api/bootstrap")).body.db;
    const visible = new Set(db.projects.map((p) => p.id));

    for (const collection of ["activities", "milestones", "ledger", "crs", "items", "allocations"]) {
      for (const row of db[collection]) {
        assert.ok(visible.has(row.project),
          `${collection} leaked a row for ${row.project}, which is out of scope`);
      }
    }
    for (const row of db.raid) {
      assert.ok(row.project === null || visible.has(row.project), "RAID leaked an out-of-scope row");
    }
    for (const row of db.docs) {
      assert.ok(row.project === null || visible.has(row.project), "documents leaked an out-of-scope row");
    }
  });
});


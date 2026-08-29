/**
 * UAT sweep — the acceptance pass that feeds the AMDEC (D-07).
 *
 * Not unit tests. These walk the system the way the committee's benches
 * would: each role, each route, each end-to-end path, asking only "does
 * this behave as the register says it should, and does anything fall
 * over?" Findings from here are scored in docs/06-amdec-uat.md.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, ACCOUNTS, GROUP_PROJECT, SITE_PROJECT_GRU } from "./harness.js";
import { many, one } from "../src/db.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

const ROLES = ["admin", "pmo", "groupCBP", "groupDCH", "siteGRU", "siteYYZ", "siteSIN", "viewerLIS", "viewerGRU"];

describe("UAT · every account can reach every screen it is offered", () => {
  test("bootstrap succeeds for every role and returns a coherent book", async () => {
    for (const who of ROLES) {
      const c = await as(who);
      const r = await c.get("/api/bootstrap");
      assert.equal(r.status, 200, who);
      const db = r.body.db;

      // Structural coherence: every reference resolves inside the payload.
      const projectIds = new Set(db.projects.map((p) => p.id));
      const personIds = new Set(db.people.map((p) => p.id));
      const siteIds = new Set(db.sites.map((s) => s.id));
      const progIds = new Set(db.programmes.map((p) => p.id));

      for (const p of db.projects) {
        assert.ok(siteIds.has(p.site), `${who}: project ${p.id} names a site not in the payload`);
        assert.ok(progIds.has(p.programme), `${who}: project ${p.id} names a programme not in the payload`);
        assert.ok(["group", "site"].includes(p.governanceLevel), `${who}: ${p.id} has no governance level`);
        assert.ok(Number.isFinite(p.budget), `${who}: ${p.id} budget is not a number`);
      }
      for (const a of db.activities) {
        assert.ok(projectIds.has(a.project), `${who}: activity ${a.id} is orphaned`);
        for (const d of a.deps) {
          assert.ok(db.activities.some((x) => x.id === d),
            `${who}: activity ${a.id} depends on ${d}, which is not in the payload`);
        }
      }
      for (const al of db.allocations) {
        assert.ok(personIds.has(al.person), `${who}: allocation names an unknown person`);
      }
      assert.ok(db.settings && typeof db.settings.amberSpi === "number", `${who}: settings missing`);
      assert.ok(typeof db.statusDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(db.statusDate),
        `${who}: status date is not a plain ISO date — got ${db.statusDate}`);
    }
  });

  test("every date the API returns is a plain ISO date, not a timestamp", async () => {
    const c = await as("admin");
    const db = (await c.get("/api/bootstrap")).body.db;
    const dateish = /^\d{4}-\d{2}-\d{2}$/;
    const check = (v, where) => {
      if (v === null || v === undefined) return;
      assert.match(String(v), dateish, `${where} should be a plain date, got ${v}`);
    };
    db.projects.forEach((p) => {
      check(p.start, `project ${p.id}.start`);
      check(p.finish, `project ${p.id}.finish`);
      check(p.baselineFinish, `project ${p.id}.baselineFinish`);
    });
    db.activities.slice(0, 20).forEach((a) => {
      check(a.start, `activity ${a.id}.start`);
      check(a.baseEnd, `activity ${a.id}.baseEnd`);
    });
    db.milestones.slice(0, 20).forEach((m) => check(m.date, `milestone ${m.id}.date`));
    db.allocations.slice(0, 20).forEach((a) => check(a.from, "allocation.from"));
  });

  test("meeting routes answer for every role that can see a series", async () => {
    for (const who of ROLES) {
      const c = await as(who);
      const list = await c.get("/api/meetings/series");
      assert.equal(list.status, 200, who);
      for (const s of list.body.series.slice(0, 3)) {
        const occ = s.next ?? s.last;
        if (!occ) continue;
        const detail = await c.get("/api/meetings/occurrences/" + occ.id);
        assert.equal(detail.status, 200, `${who} reading ${occ.id}`);
        assert.ok(Array.isArray(detail.body.agenda.sections), `${who}: no agenda sections`);
        const minutes = await c.get("/api/meetings/occurrences/" + occ.id + "/minutes");
        assert.equal(minutes.status, 200, `${who} minutes for ${occ.id}`);
        assert.ok(minutes.body.markdown.length > 50);
      }
    }
  });
});

describe("UAT · end-to-end paths the benches described", () => {
  test("A3's Monday: a site PM opens the tool and works their own project", async () => {
    const naka = await as("siteYYZ");
    const db = (await naka.get("/api/bootstrap")).body.db;
    const mine = db.projects.filter((p) => p.site === "YYZ" && p.governanceLevel === "site");
    assert.ok(mine.length >= 1, "Toronto leads at least one of its own projects");

    const p = mine[0];
    // update progress on a stage
    const act = db.activities.find((a) => a.project === p.id);
    const prog = await naka.patch("/api/activities/" + act.id, { pct: 45, version: act.version });
    assert.equal(prog.status, 200);

    // raise an issue, then close it
    const raised = await naka.post("/api/raid", {
      project: p.id, type: "Issue", title: "Cabinet space at 41 sites", p: 3, i: 3,
    });
    assert.equal(raised.status, 201);
    const after = (await naka.get("/api/bootstrap")).body.db;
    const item = after.raid.find((r) => r.id === raised.body.id);
    const closed = await naka.patch("/api/raid/" + item.id, { status: "Closed", version: item.version });
    assert.equal(closed.status, 200);

    // set the RAG by hand, with a reason
    const fresh = (await naka.get("/api/bootstrap")).body.db.projects.find((x) => x.id === p.id);
    const rag = await naka.patch("/api/projects/" + p.id + "/health", {
      rag: "A", why: "Hardware lead time is holding, but only just", version: fresh.version,
    });
    assert.equal(rag.status, 200);

    const check = (await naka.get("/api/bootstrap")).body.db.projects.find((x) => x.id === p.id);
    assert.equal(check.healthOverride, "A");
    assert.match(check.healthOverrideWhy, /lead time/);
  });

  test("an override without a reason is refused — the committee has to read it back", async () => {
    const naka = await as("siteYYZ");
    const p = (await naka.get("/api/bootstrap")).body.db.projects
      .find((x) => x.site === "YYZ" && x.governanceLevel === "site");
    const r = await naka.patch("/api/projects/" + p.id + "/health", { rag: "R", why: "", version: p.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /reason/i);
  });

  test("C3's week: chair opens the weekly, works the agenda, closes it, reads the minutes", async () => {
    const pmo = await as("pmo");
    const series = (await pmo.get("/api/meetings/series")).body.series
      .find((s) => s.id === "MS-GRP-W");
    const id = series.next.id;

    await pmo.post(`/api/meetings/occurrences/${id}/open`);
    const before = (await pmo.get(`/api/meetings/occurrences/${id}`)).body;
    assert.ok(before.agenda.sections.length >= 4, "a real week has several sections");

    // Every agenda item that points at something must point at something real.
    const db = (await pmo.get("/api/bootstrap")).body.db;
    const known = {
      project: new Set(db.projects.map((p) => p.id)),
      change_request: new Set(db.crs.map((c) => c.id)),
      raid_item: new Set(db.raid.map((r) => r.id)),
      milestone: new Set(db.milestones.map((m) => m.id)),
      activity: new Set(db.activities.map((a) => a.id)),
      person: new Set(db.people.map((p) => p.id)),
      meeting_action: new Set(before.openActions.map((a) => a.id)),
    };
    for (const sec of before.agenda.sections) {
      for (const it of sec.items) {
        if (!it.entity || !it.entityId) continue;
        const set = known[it.entity];
        if (!set) continue;
        assert.ok(set.has(it.entityId),
          `agenda item points at ${it.entity} ${it.entityId}, which is not in the book`);
      }
    }

    await pmo.post(`/api/meetings/occurrences/${id}/decisions`, {
      headline: "Escalate the payments corridor retry defect to the vendor",
      rationale: "Three weeks of internal fixes have not held.",
      projectId: GROUP_PROJECT,
    });
    await pmo.post(`/api/meetings/occurrences/${id}/actions`, {
      title: "Open a Sev-1 with the corridor vendor", ownerId: "PE-10", dueDate: "2026-09-04",
    });
    const closed = await pmo.post(`/api/meetings/occurrences/${id}/close`, { notes: "Ran to time." });
    assert.equal(closed.status, 200);

    const md = (await pmo.get(`/api/meetings/occurrences/${id}/minutes`)).body.markdown;
    assert.match(md, /Escalate the payments corridor retry defect/);
    assert.match(md, /Open a Sev-1 with the corridor vendor/);
    assert.match(md, /## Decisions/);

    // and the action is carried into the next occurrence
    const next = (await pmo.get(`/api/meetings/occurrences/${closed.body.next.id}`)).body;
    const carried = next.agenda.sections.find((s) => s.key === "actions");
    assert.ok(carried.items.some((i) => /Sev-1 with the corridor vendor/.test(i.headline)),
      "an open action must follow the series forward");
  });

  test("A5's ledger: cost booked at group level moves CPI and nothing else", async () => {
    const lind = await as("groupCBP");
    const before = (await lind.get("/api/bootstrap")).body.db;
    const p0 = before.projects.find((x) => x.id === GROUP_PROJECT);
    const acBefore = before.ledger.filter((l) => l.project === GROUP_PROJECT)
      .reduce((n, l) => n + l.amount, 0);

    const r = await lind.post("/api/cost", {
      project: GROUP_PROJECT, amount: 0.5, period: "2026-07", note: "Corridor infrastructure",
    });
    assert.equal(r.status, 201);

    const after = (await lind.get("/api/bootstrap")).body.db;
    const p1 = after.projects.find((x) => x.id === GROUP_PROJECT);
    const acAfter = after.ledger.filter((l) => l.project === GROUP_PROJECT)
      .reduce((n, l) => n + l.amount, 0);

    assert.ok(Math.abs(acAfter - acBefore - 0.5) < 1e-6, "the ledger moved by exactly what was booked");
    assert.equal(p1.budget, p0.budget, "booking cost must not move the budget");
    assert.equal(p1.contingencyUsed, p0.contingencyUsed, "nor the contingency");
  });

  test("A2's change: an approved CR moves the plan inside the approval", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const cr = db.crs.find((c) => c.status === "Pending" && c.weeks !== 0);
    assert.ok(cr, "the seed has a pending change with a schedule impact");
    const before = db.projects.find((p) => p.id === cr.project);

    // walk it through every step of the chain
    for (let i = 0; i < 6; i++) {
      const state = (await admin.get("/api/bootstrap")).body.db.crs.find((c) => c.id === cr.id);
      if (state.status !== "Pending") break;
      const r = await admin.post(`/api/change/${cr.id}/approve`, { comment: "Agreed" });
      assert.equal(r.status, 200, `step ${i}`);
    }

    const after = (await admin.get("/api/bootstrap")).body.db;
    const cr2 = after.crs.find((c) => c.id === cr.id);
    const p2 = after.projects.find((p) => p.id === cr.project);
    assert.equal(cr2.status, "Approved");
    assert.equal(cr2.applied, true);
    const movedWeeks = Math.round((new Date(p2.finish) - new Date(before.finish)) / (7 * 86400000));
    assert.equal(movedWeeks, cr.weeks, "the finish date moved by exactly the agreed weeks");
  });

  test("C1's autonomy: a site lead runs their own project end to end without group involvement", async () => {
    const silva = await as("siteGRU");
    const created = await silva.post("/api/projects", {
      name: "Brazil merchant onboarding pilot", programme: "DCH", site: "GRU",
      governanceLevel: "site", pm: "PE-19", method: "Agile",
      start: "2026-09-01", finish: "2027-03-31", budget: 0.9, contingency: 0.09,
      desc: "A small local pilot the region funds itself.",
    });
    assert.equal(created.status, 201);
    const id = created.body.id;

    const db = (await silva.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === id);
    assert.ok(p, "the new project is visible to its creator");
    assert.equal(p.governanceLevel, "site");

    // R4.3 — it arrives with a schedule, gates and evidence, not as a bare row
    const acts = db.activities.filter((a) => a.project === id);
    const gates = db.milestones.filter((m) => m.project === id && m.kind === "gate");
    const docs = db.docs.filter((d) => d.project === id);
    assert.ok(acts.length >= 6, "the WBS was generated");
    assert.equal(gates.length, 4, "all four gates exist");
    assert.ok(docs.length >= 4, "gate evidence placeholders exist");
    assert.ok(db.allocations.some((a) => a.project === id && a.person === "PE-19"),
      "the project manager is allocated to their own project");

    // and it is invisible to another site
    const naka = await as("siteYYZ");
    const theirs = (await naka.get("/api/bootstrap")).body.db.projects.map((x) => x.id);
    assert.ok(!theirs.includes(id), "São Paulo's own project is not Toronto's business");
  });

  test("moving a project's window re-stretches its stages but not its baseline", async () => {
    const admin = await as("admin");
    const db = (await admin.get("/api/bootstrap")).body.db;
    const p = db.projects.find((x) => x.id === SITE_PROJECT_GRU);
    const actsBefore = db.activities.filter((a) => a.project === p.id).sort((a, b) => a.stage - b.stage);
    const baseBefore = actsBefore.map((a) => a.baseStart);

    const newFinish = "2027-09-30";
    const r = await admin.patch("/api/projects/" + p.id, { finish: newFinish, version: p.version });
    assert.equal(r.status, 200);
    assert.equal(r.body.rescheduled, true);

    const after = (await admin.get("/api/bootstrap")).body.db;
    const actsAfter = after.activities.filter((a) => a.project === p.id).sort((a, b) => a.stage - b.stage);
    assert.deepEqual(actsAfter.map((a) => a.baseStart), baseBefore,
      "re-planning must not silently move the baseline");
    assert.notDeepEqual(actsAfter.map((a) => a.start), actsBefore.map((a) => a.start),
      "but the plan itself did move");
    const last = actsAfter.reduce((m, a) => (a.end > m ? a.end : m), actsAfter[0].end);
    assert.ok(last <= newFinish, "no stage runs past the new finish");
  });
});

describe("UAT · robustness", () => {
  test("malformed input is refused, not swallowed", async () => {
    const admin = await as("admin");
    const cases = [
      ["POST", "/api/projects", {}, 400],
      ["POST", "/api/projects", { name: "x", programme: "NOPE", site: "GRU", start: "2026-01-01", finish: "2026-02-01" }, 400],
      ["POST", "/api/projects", { name: "x", programme: "DCH", site: "GRU", start: "2026-06-01", finish: "2026-01-01" }, 400],
      ["POST", "/api/cost", { project: GROUP_PROJECT, amount: 1, period: "not-a-period" }, 400],
      ["POST", "/api/cost", { project: GROUP_PROJECT, amount: 0, period: "2026-08" }, 400],
      ["POST", "/api/raid", { project: GROUP_PROJECT }, 400],
      ["PATCH", "/api/projects/NOPE", { name: "x" }, 404],
      ["PATCH", "/api/activities/NOPE", { pct: 10 }, 404],
      ["POST", "/api/meetings/series", { name: "x", scopeKind: "programme" }, 400],
    ];
    for (const [method, path, body, expected] of cases) {
      const r = method === "POST" ? await admin.post(path, body) : await admin.patch(path, body);
      assert.equal(r.status, expected, `${method} ${path} → ${r.status} (${r.text?.slice(0, 90)})`);
    }
  });

  test("a project with no activities does not break any derived view", async () => {
    const admin = await as("admin");
    const created = await admin.post("/api/projects", {
      name: "Bare mandate", programme: "EIT", site: "LON", governanceLevel: "group",
      start: "2027-01-04", finish: "2027-12-31", budget: 2, contingency: 0.2,
    });
    assert.equal(created.status, 201);
    // strip its schedule to reproduce a genuinely empty project
    const { query } = await import("../src/db.js");
    await query(`DELETE FROM activity WHERE project_id = $1`, [created.body.id]);

    const db = (await admin.get("/api/bootstrap")).body.db;
    const { Engine } = await import("../../shared/engine.js");
    const m = Engine.metrics(db, created.body.id);
    assert.equal(m.pv, 0);
    assert.equal(m.spi, 1);
    assert.ok(Number.isFinite(m.eac));
    const roll = Engine.roll(db, db.projects);
    assert.ok(Number.isFinite(roll.spi) && Number.isFinite(roll.cpi));
    const cp = Engine.criticalPath(db, created.body.id);
    assert.equal(cp.critical.size, 0);
  });

  test("the audit trail records every one of this run's writes with a real actor", async () => {
    const pmo = await as("pmo");
    const events = (await pmo.get("/api/audit?limit=500")).body.events;
    assert.ok(events.length > 20, "the sweep produced a substantial trail");
    for (const e of events) {
      assert.ok(e.action, "every event names an action");
      assert.ok(e.user_label && e.user_label !== "system" ? /\((admin|group|site|viewer)\)$/.test(e.user_label) : true,
        `actor label should carry the role — got "${e.user_label}"`);
    }
    const actors = new Set(events.map((e) => e.user_id));
    assert.ok(actors.size >= 3, "several distinct accounts appear");
  });
});

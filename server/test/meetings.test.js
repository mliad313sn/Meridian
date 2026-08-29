/**
 * R5.* — meeting animation.
 *
 * C3's requirement, restated as tests: the agenda must come out of the
 * portfolio, the actions must chase people across occurrences, and the
 * record must stop moving the moment the meeting closes.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { buildAgenda, nextOccurrenceDate, periodLabel, seriesProjects } from "../../shared/meetings.js";
import { iso, addDays, D } from "../../shared/engine.js";

before(async () => { await boot(); });
after(async () => { await shutdown(); });

const GROUP_WEEKLY = "MS-GRP-W";
const GROUP_MONTHLY = "MS-GRP-M";
const SITE_WEEKLY_GRU = "MS-GRU-W";

async function nextOf(client, seriesId) {
  const r = await client.get("/api/meetings/series");
  const s = r.body.series.find((x) => x.id === seriesId);
  assert.ok(s, `series ${seriesId} should be visible`);
  return s;
}

describe("series and scope (R5.1, R5.11)", () => {
  test("series carry a cadence and a scope, and report their project count", async () => {
    const pmo = await as("pmo");
    const { body } = await pmo.get("/api/meetings/series");
    const weekly = body.series.filter((s) => s.cadence === "weekly");
    const monthly = body.series.filter((s) => s.cadence === "monthly");
    assert.ok(weekly.length >= 4);
    assert.ok(monthly.length >= 2);

    const group = body.series.find((s) => s.id === GROUP_WEEKLY);
    assert.equal(group.scopeKind, "group");
    assert.equal(group.projectCount, 12, "the group call covers the whole book");

    const gru = body.series.find((s) => s.id === SITE_WEEKLY_GRU);
    assert.equal(gru.scopeKind, "site");
    assert.equal(gru.scopeLabel, "São Paulo");
  });

  test("R5.11 · a site lead may run their own series and no one else's", async () => {
    const silva = await as("siteGRU");
    const { body } = await silva.get("/api/meetings/series");
    const own = body.series.find((s) => s.id === SITE_WEEKLY_GRU);
    const group = body.series.find((s) => s.id === GROUP_WEEKLY);
    assert.equal(own.canWrite, true);
    assert.equal(group.canWrite, false);

    const refused = await silva.post(`/api/meetings/occurrences/${group.next.id}/open`);
    assert.equal(refused.status, 403);
    const allowed = await silva.post(`/api/meetings/occurrences/${own.next.id}/open`);
    assert.equal(allowed.status, 200);
  });

  test("a viewer can read a meeting and change nothing in it", async () => {
    const v = await as("viewerGRU");
    const { body } = await v.get("/api/meetings/series");
    assert.ok(body.series.length > 0, "viewers still see the calendar");
    assert.ok(body.series.every((s) => s.canWrite === false));

    const gru = body.series.find((s) => s.id === SITE_WEEKLY_GRU);
    const r = await v.post(`/api/meetings/occurrences/${gru.next.id}/decisions`, { headline: "no" });
    assert.equal(r.status, 403);
  });

  test("another site's series is not even listed", async () => {
    const yyz = await as("siteYYZ");
    const { body } = await yyz.get("/api/meetings/series");
    const ids = body.series.map((s) => s.id);
    assert.ok(!ids.includes(SITE_WEEKLY_GRU), "Toronto has no business in São Paulo's call");
  });
});

describe("agenda generation (R5.2, R5.3, R5.9)", () => {
  test("R5.2 · the agenda is built from live portfolio state, not typed", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_WEEKLY);
    await pmo.post(`/api/meetings/occurrences/${s.next.id}/open`);
    const { body } = await pmo.get(`/api/meetings/occurrences/${s.next.id}`);

    const keys = body.agenda.sections.map((x) => x.key);
    assert.ok(keys.includes("actions"), "carried-forward actions lead");
    assert.ok(keys.includes("exceptions"), "the seeded red projects surface");
    assert.ok(keys.includes("decisions"), "pending change requests surface");

    const ex = body.agenda.sections.find((x) => x.key === "exceptions");
    const headlines = ex.items.map((i) => i.headline).join(" | ");
    assert.match(headlines, /RED · Payments Core Migration/,
      "the project the seed makes red must appear, and be named");
    assert.equal(body.agenda.sections[0].key, "actions", "actions always come first");
  });

  test("R5.3 · empty sections are dropped, not shown empty", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_WEEKLY);
    const { body } = await pmo.get(`/api/meetings/occurrences/${s.next.id}`);
    for (const sec of body.agenda.sections) {
      assert.ok(sec.items.length > 0, `${sec.key} is on the agenda with nothing in it`);
    }
  });

  test("R5.3 · the weekly is time-boxed and every section is inside it", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_WEEKLY);
    const { body } = await pmo.get(`/api/meetings/occurrences/${s.next.id}`);
    assert.equal(body.agenda.timebox, 25);
    for (const sec of body.agenda.sections) {
      assert.ok(sec.timeboxMin >= 2, "no section gets less than two minutes");
      assert.equal(typeof sec.seq, "number");
    }
    const decisions = body.agenda.sections.find((x) => x.key === "decisions");
    assert.ok(decisions.items.length <= 6, "a weekly caps the decision list");
    assert.match(decisions.note ?? "", /deferred/, "and says what it deferred");
  });

  test("R5.9 · the monthly adds finance, gates and benefits; the weekly does not", async () => {
    const pmo = await as("pmo");
    const monthly = await nextOf(pmo, GROUP_MONTHLY);
    const weekly = await nextOf(pmo, GROUP_WEEKLY);
    const m = (await pmo.get(`/api/meetings/occurrences/${monthly.next.id}`)).body.agenda;
    const w = (await pmo.get(`/api/meetings/occurrences/${weekly.next.id}`)).body.agenda;

    const mKeys = m.sections.map((s) => s.key);
    const wKeys = w.sections.map((s) => s.key);
    assert.ok(mKeys.includes("financial"), "the steering pack carries the financial position");
    assert.ok(!wKeys.includes("financial"), "the weekly delivery call does not");
    assert.ok(mKeys.includes("gates") || mKeys.includes("benefits"));
    assert.equal(m.timebox, 90);
  });

  test("a site series only ever discusses that site's projects", async () => {
    const silva = await as("siteGRU");
    const s = await nextOf(silva, SITE_WEEKLY_GRU);
    const { body } = await silva.get(`/api/meetings/occurrences/${s.next.id}`);
    assert.equal(body.agenda.projectCount, 1, "São Paulo leads one project");
    const ex = body.agenda.sections.find((x) => x.key === "exceptions");
    if (ex) {
      for (const item of ex.items) {
        assert.match(item.headline, /LATAM/, "no other site's project may appear");
      }
    }
  });

  test("nothing outstanding still produces a section that says so", () => {
    const db = emptyBook();
    const agenda = buildAgenda(db, { id: "S", cadence: "weekly", scopeKind: "group", timeboxMin: 20 },
      { id: "O", meetsOn: "2026-07-01" }, []);
    const actions = agenda.sections.find((s) => s.key === "actions");
    assert.ok(actions);
    assert.match(actions.items[0].headline, /No actions outstanding/);
  });
});

describe("actions carry forward (R5.6)", () => {
  test("open actions from earlier occurrences head the next agenda", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_WEEKLY);
    const { body } = await pmo.get(`/api/meetings/occurrences/${s.next.id}`);
    const actions = body.agenda.sections.find((x) => x.key === "actions");
    assert.ok(actions.items.length >= 4, "the seeded backlog is carried in");
    assert.ok(actions.items.some((i) => /OVERDUE/.test(i.detail)), "and overdue ones are marked");
    assert.match(actions.note, /overdue/);
  });

  test("an action stops being carried once it is done", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_WEEKLY);
    const before = (await pmo.get(`/api/meetings/occurrences/${s.next.id}`)).body;
    const target = before.openActions[0];

    const done = await pmo.patch(`/api/meetings/actions/${target.id}`, {
      status: "Done", version: target.version,
    });
    assert.equal(done.status, 200);

    const after = (await pmo.get(`/api/meetings/occurrences/${s.next.id}`)).body;
    assert.ok(!after.openActions.some((a) => a.id === target.id));
    const actions = after.agenda.sections.find((x) => x.key === "actions");
    assert.ok(!actions.items.some((i) => i.entityId === target.id));
  });

  test("actions are addressable by owner across every series", async () => {
    const pmo = await as("pmo");
    const r = await pmo.get("/api/meetings/actions?owner=PE-01");
    assert.equal(r.status, 200);
    assert.ok(r.body.actions.length >= 1);
    assert.ok(r.body.actions.every((a) => a.ownerId === "PE-01"));
    assert.ok(r.body.actions.every((a) => a.seriesName));
  });
});

describe("running and closing a meeting (R5.4, R5.5, R5.7, R5.8)", () => {
  test("the full lifecycle: open, attend, decide, act, close, minute", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, GROUP_MONTHLY);
    const id = s.next.id;

    assert.equal((await pmo.post(`/api/meetings/occurrences/${id}/open`)).status, 200);

    // R5.4 — attendance
    const att = await pmo.post(`/api/meetings/occurrences/${id}/attendance`, {
      attendance: [
        { personId: "PE-14", state: "present" },
        { personId: "PE-15", state: "present" },
        { personId: "PE-25", state: "apologies" },
        { personId: "PE-19", state: "absent" },
      ],
    });
    assert.equal(att.status, 200);

    // R5.5 — a decision
    const dec = await pmo.post(`/api/meetings/occurrences/${id}/decisions`, {
      headline: "Hold the payments cutover date pending a costed dual-run plan",
      rationale: "The committee will not move a committed date on a forecast alone.",
      projectId: "PRJ-101", crId: "CR-218", decidedBy: "PE-14",
    });
    assert.equal(dec.status, 201);

    // R5.6 — an action out of that decision
    const act = await pmo.post(`/api/meetings/occurrences/${id}/actions`, {
      title: "Produce the dual-run reconciliation plan and exit criteria",
      ownerId: "PE-01", projectId: "PRJ-101", dueDate: "2026-09-15",
    });
    assert.equal(act.status, 201);

    const mid = (await pmo.get(`/api/meetings/occurrences/${id}`)).body;
    assert.equal(mid.attendance.length, 4);
    assert.equal(mid.attendance.filter((a) => a.state === "present").length, 2);
    assert.equal(mid.decisions.length, 1);
    assert.equal(mid.actionsRaisedHere.length, 1);
    assert.equal(mid.agenda.frozen, false, "an open meeting reads live");

    // close
    const close = await pmo.post(`/api/meetings/occurrences/${id}/close`, {
      notes: "Ran to time. CR-218 deferred with a costed plan requested.",
    });
    assert.equal(close.status, 200);
    assert.ok(close.body.next?.id, "closing schedules the next occurrence");

    const after = (await pmo.get(`/api/meetings/occurrences/${id}`)).body;
    assert.equal(after.occurrence.status, "closed");
    assert.equal(after.agenda.frozen, true, "R5.8 — the agenda is now a record");
  });

  test("R5.8 · a closed meeting refuses every further write", async () => {
    const pmo = await as("pmo");
    const closed = (await pmo.get(`/api/meetings/series/${GROUP_MONTHLY}/occurrences`))
      .body.occurrences.find((o) => o.status === "closed");
    assert.ok(closed, "there is a closed occurrence to test against");

    const attempts = [
      await pmo.post(`/api/meetings/occurrences/${closed.id}/decisions`, { headline: "after the fact" }),
      await pmo.post(`/api/meetings/occurrences/${closed.id}/actions`, { title: "after the fact" }),
      await pmo.post(`/api/meetings/occurrences/${closed.id}/attendance`, { attendance: [] }),
      await pmo.post(`/api/meetings/occurrences/${closed.id}/close`),
    ];
    for (const r of attempts) assert.equal(r.status, 409, r.text);
  });

  test("R5.8 · the frozen agenda does not follow the portfolio afterwards", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, "MS-CBP-W");
    const id = s.next.id;
    await pmo.post(`/api/meetings/occurrences/${id}/open`);
    const before = (await pmo.get(`/api/meetings/occurrences/${id}`)).body.agenda;
    const beforeCount = before.sections.reduce((n, x) => n + x.items.length, 0);
    await pmo.post(`/api/meetings/occurrences/${id}/close`, {});

    // Move the portfolio underneath it: raise a new escalated risk.
    const raised = await pmo.post("/api/raid", {
      project: "PRJ-101", type: "Issue", title: "Something new and loud", p: 5, i: 5,
    });
    assert.equal(raised.status, 201);

    const after = (await pmo.get(`/api/meetings/occurrences/${id}`)).body.agenda;
    const afterCount = after.sections.reduce((n, x) => n + x.items.length, 0);
    assert.equal(after.frozen, true);
    assert.equal(afterCount, beforeCount,
      "what the meeting discussed cannot change because the portfolio moved");
  });

  test("a decision cannot be recorded before the meeting is opened", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, "MS-DCH-W");
    const r = await pmo.post(`/api/meetings/occurrences/${s.next.id}/decisions`, { headline: "early" });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Open the meeting/i);
  });

  test("R5.7 · minutes render attendance, decisions and actions as Markdown", async () => {
    const pmo = await as("pmo");
    const closed = (await pmo.get(`/api/meetings/series/${GROUP_MONTHLY}/occurrences`))
      .body.occurrences.find((o) => o.status === "closed" && o.id.endsWith(o.meetsOn.replace(/-/g, "")));
    const r = await pmo.get(`/api/meetings/occurrences/${closed.id}/minutes`);
    assert.equal(r.status, 200);
    const md = r.body.markdown;
    assert.match(md, /^# /m, "has a title");
    assert.match(md, /## Attendance/);
    assert.match(md, /## Agenda/);
    assert.match(md, /## Decisions/);
    assert.match(md, /## Actions/);
    assert.match(md, /Generated by Meridian IT-PMO/);
  });
});

describe("scheduling", () => {
  test("the weekly lands on the series weekday", () => {
    // 2026-07-01 is a Wednesday; weekday 1 is Monday.
    const d = nextOccurrenceDate({ cadence: "weekly", weekday: 1 }, "2026-07-01");
    assert.equal(D(d).getUTCDay(), 1);
    assert.ok(D(d) >= D("2026-07-01"));
  });

  test("the monthly lands on the first matching weekday of a month", () => {
    const d = nextOccurrenceDate({ cadence: "monthly", weekday: 3 }, "2026-07-05");
    assert.equal(D(d).getUTCDay(), 3);
    assert.ok(D(d) >= D("2026-07-05"));
  });

  test("period labels distinguish a week from a month", () => {
    assert.match(periodLabel({ cadence: "weekly" }, "2026-07-01"), /^Week \d+ 2026$/);
    assert.match(periodLabel({ cadence: "monthly" }, "2026-07-01"), /^Jul 2026$/);
  });

  test("closing schedules the following occurrence so a series never goes quiet", async () => {
    const pmo = await as("pmo");
    const s = await nextOf(pmo, SITE_WEEKLY_GRU);
    await pmo.post(`/api/meetings/occurrences/${s.next.id}/open`);
    const close = await pmo.post(`/api/meetings/occurrences/${s.next.id}/close`, {});
    const list = await pmo.get(`/api/meetings/series/${SITE_WEEKLY_GRU}/occurrences`);
    assert.ok(list.body.occurrences.some((o) => o.id === close.body.next.id && o.status === "scheduled"));
  });
});

/* A book with nothing wrong in it, to prove the agenda degrades gracefully. */
function emptyBook() {
  return {
    statusDate: "2026-07-01",
    settings: {
      autoRag: true, gateLock: true, ccb: true, capacityAlerts: false, benefitTrack: false,
      ccbThreshold: 0.25, ccbWeeks: 2, amberSpi: 0.95, redSpi: 0.9, amberCpi: 0.95, redCpi: 0.9,
      escalateExposure: 15, pmoExposure: 8, issueAgeDays: 10, capacityCeiling: 100,
    },
    sites: [], programmes: [], people: [], projects: [], activities: [],
    milestones: [], ledger: [], raid: [], crs: [], docs: [], items: [],
    columns: [], allocations: [], narrative: {},
  };
}

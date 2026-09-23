/**
 * NEW-14 · NEW-15 · NEW-16 (docs/36, wave 1) — what the book carries,
 * what an import says it refused, and what a merge does to a version.
 *
 * NEW-14: the export wrote no meeting series, meeting, agenda, roll,
 *   decision, action or RAID review, and a replace import deletes every
 *   meeting table — an export → import erased the governance record.
 *   F13 (roundtrip.test.js) proves every field comes back; this file
 *   proves the rules around it: counters, scope, and what a restore may
 *   not do to a closed meeting or a decision on the record.
 * NEW-15: a real import dropped the rows it refused by name and said so
 *   only on a dry run.
 * NEW-16: a merge rewrote rows without moving `row_version`, so a screen
 *   holding the old version could still write over what came in.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { many, one, query } from "../src/db.js";
import { loadBook } from "../src/portfolio.js";

before(async () => { await boot(); });
after(shutdown);

const exportBook = async (admin) => structuredClone((await admin.get("/api/admin/export")).body);
const count = async (table) => (await one(`SELECT count(*)::int AS n FROM ${table}`)).n;
const MEETING_TABLES = ["meeting_series", "meeting_occurrence", "agenda_item", "meeting_attendance",
                        "meeting_decision", "meeting_action", "raid_review", "decision_objection"];

describe("NEW-14 · the meeting register and the RAID reviews are in the book", () => {
  before(async () => {
    // a frozen agenda, a review and a standalone decision the seed does not hold
    await query(`INSERT INTO agenda_item (occurrence_id, seq, section, section_key, headline)
                 SELECT id, 0, 'Decisions', 'decisions', 'Hold the date'
                   FROM meeting_occurrence WHERE status = 'closed' ORDER BY id LIMIT 1`);
    await query(`INSERT INTO raid_review (id, raid_id, reviewed_on, note)
                 VALUES ('RVW-001', (SELECT min(id) FROM raid_item), '2026-08-03', 'looked')`);
    await query(`INSERT INTO meeting_decision (id, headline, decided_by, decided_on)
                 VALUES ('DEC-002', 'Stop the pilot', 'PE-14', '2026-08-01')`);
  });

  test("a replace import of the product's own export keeps every meeting row", async () => {
    const admin = await as("admin");
    const before_ = Object.fromEntries(await Promise.all(MEETING_TABLES.map(async (t) => [t, await count(t)])));
    assert.ok(before_.meeting_series > 0 && before_.meeting_decision > 1 && before_.raid_review > 0,
      "the probed book holds meeting rows to lose");
    const book = await exportBook(admin);
    for (const k of ["meetingSeries", "meetings", "decisions", "actions", "raidReviews"]) {
      assert.ok(Array.isArray(book[k]) && book[k].length, `the export writes ${k}`);
    }
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.rejects, []);
    assert.equal(r.body.counts.decisions, book.decisions.length);
    const after_ = Object.fromEntries(await Promise.all(MEETING_TABLES.map(async (t) => [t, await count(t)])));
    assert.deepEqual(after_, before_, "a replace import erased part of the meeting register");
    const standalone = await one(`SELECT occurrence_id, decided_on FROM meeting_decision WHERE id = 'DEC-002'`);
    assert.equal(standalone.occurrence_id, null, "a decision taken outside a room stays outside one");
    assert.equal(standalone.decided_on, "2026-08-01");
  });

  test("the decision, action and review counters follow the imported ids", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    book.decisions[0].id = "DEC-950";
    book.actions[0].id = "ACT-951";
    book.raidReviews[0].id = "RVW-952";
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    const c = Object.fromEntries((await many(
      `SELECT prefix, next_value FROM id_counter WHERE prefix IN ('DEC','ACT','RVW')`))
      .map((x) => [x.prefix, Number(x.next_value)]));
    assert.ok(c.DEC >= 950 && c.ACT >= 951 && c.RVW >= 952, JSON.stringify(c));
  });

  test("an account or integration this database does not hold drops to null; the row still comes in", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const d = book.decisions[0];
    d.recordedBy = "U-from-elsewhere";
    d.externalSource = "INT-from-elsewhere";
    d.externalId = "their-7";
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    const row = await one(`SELECT recorded_by, external_source, external_id FROM meeting_decision WHERE id = $1`, [d.id]);
    assert.equal(row.recorded_by, null);
    assert.equal(row.external_source, null);
    assert.equal(row.external_id, "their-7");
  });

  test("an agenda is frozen only when its meeting closes: a live meeting's agenda is refused by name", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const live = book.meetings.find((m) => m.status !== "closed");
    live.agenda = [{ seq: 0, section: "Risks", headline: "Invented", detail: "", entity: "", entityId: "",
                     timeboxMin: 5, urgent: false, sectionKey: "risks" }];
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.rejects.map((x) => [x.table, x.id]), [["agenda_item", live.id]]);
    assert.equal((await one(`SELECT count(*)::int AS n FROM agenda_item WHERE occurrence_id = $1`, [live.id])).n, 0);
  });

  test("a merge does not reopen a closed meeting, rewrite its record, or add to it", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const closed = book.meetings.find((m) => m.status === "closed" && m.agenda.length);
    const held = await one(`SELECT status, notes, row_version FROM meeting_occurrence WHERE id = $1`, [closed.id]);
    closed.status = "open";
    closed.notes = "rewritten after the fact";
    closed.agenda[0].headline = "Something nobody discussed";
    book.decisions.push({ ...book.decisions.find((d) => d.meeting), id: "DEC-990",
                          meeting: closed.id, headline: "Minuted afterwards", externalId: null });
    const r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    const named = r.body.rejects.map((x) => [x.table, x.id]);
    assert.deepEqual(named, [["meeting_occurrence", closed.id], ["meeting_decision", "DEC-990"]]);
    assert.match(r.body.rejects[0].reason, /status open, notes, agenda/);
    const now = await one(`SELECT status, notes, row_version FROM meeting_occurrence WHERE id = $1`, [closed.id]);
    assert.deepEqual(now, held, "the closed meeting is exactly as it was");
    const agenda = await one(`SELECT headline FROM agenda_item WHERE occurrence_id = $1 AND seq = 0`, [closed.id]);
    assert.notEqual(agenda.headline, "Something nobody discussed");
    assert.equal(await one(`SELECT 1 AS x FROM meeting_decision WHERE id = 'DEC-990'`), null);
  });

  test("a merge moves a decision's state but not its substance", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const d = book.decisions.find((x) => x.id === "DEC-002");
    const before_ = await one(`SELECT headline, provenance, row_version FROM meeting_decision WHERE id = 'DEC-002'`);
    d.provenance = "Board minutes 43";
    let r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.rejects, []);
    const moved = await one(`SELECT provenance, row_version FROM meeting_decision WHERE id = 'DEC-002'`);
    assert.equal(moved.provenance, "Board minutes 43");
    assert.equal(moved.row_version, before_.row_version + 1, "a changed decision moves its version");

    d.headline = "Continue the pilot";
    r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.rejects.map((x) => [x.table, x.id]), [["meeting_decision", "DEC-002"]]);
    assert.match(r.body.rejects[0].reason, /headline/);
    assert.equal((await one(`SELECT headline FROM meeting_decision WHERE id = 'DEC-002'`)).headline,
      before_.headline, "the decision on the record keeps what it said");
  });

  test("the book is scoped as the meeting screens are", async () => {
    const siteUser = { id: "U-PROBE", role: "site", active: true,
                       grants: [{ scope_kind: "site", site_id: "GRU" }] };
    const book = await loadBook(siteUser);
    const series = book.meetingSeries.map((s) => s.id);
    assert.ok(series.includes("MS-GRU-W"), "its own site's room");
    assert.ok(series.includes("MS-GRP-W"), "the group's room, as the screen shows it");
    assert.ok(!series.includes("MS-YYZ-W") && !series.includes("MS-SIN-M"), "not another site's room");
    const seriesSet = new Set(series);
    assert.ok(book.meetings.every((m) => seriesSet.has(m.series)));
    assert.ok(book.actions.every((a) => seriesSet.has(a.series)));
    assert.ok(book.decisions.every((d) => d.meeting), "the decision register is audit.read — group and above");
    const projects = new Set(book.projects.map((p) => p.id));
    assert.ok(projects.has(SITE_PROJECT_GRU));
    for (const row of [...book.decisions, ...book.actions]) {
      assert.ok(row.project === null || projects.has(row.project), `${row.id} names a project the reader cannot see`);
    }
    const raid = new Set(book.raid.map((x) => x.id));
    assert.ok(book.raidReviews.every((v) => raid.has(v.item)));
    const decisions = new Set(book.decisions.map((d) => d.id));
    assert.ok(book.objections.every((o) => decisions.has(o.decision)));
  });
});

describe("NEW-15 · a real import says which rows it refused", () => {
  test("the 200 carries `rejects`, and the audit event records them", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    book.findings = [{ id: "FND-777", project: book.projects[0].id, status: "Closed",
                       observedFact: "x", severity: "S2", loop: 1 }];
    const r = await admin.post("/api/admin/import", { db: book });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.dryRun, false);
    assert.deepEqual(r.body.rejects.map((x) => [x.table, x.id]), [["finding", "FND-777"]]);
    assert.match(r.body.rejects[0].reason, /re-test evidence/);
    const ev = await one(
      `SELECT detail, after_json FROM audit_event WHERE action = 'Book imported' ORDER BY id DESC LIMIT 1`);
    assert.match(ev.detail, /1 row\(s\) refused: finding FND-777/);
    const after_ = typeof ev.after_json === "string" ? JSON.parse(ev.after_json) : ev.after_json;
    assert.equal(after_.rejects[0].id, "FND-777");
    assert.equal(await one(`SELECT 1 AS x FROM finding WHERE id = 'FND-777'`), null);
  });

  test("an import that refuses nothing says so, with an empty list", async () => {
    const admin = await as("admin");
    const r = await admin.post("/api/admin/import", { db: await exportBook(admin) });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.rejects, []);
  });
});

describe("NEW-16 · a merge moves the version of what it changes", () => {
  test("a screen holding the version read before a merge is refused with 409", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const p = book.projects.find((x) => x.origin === "local");
    const old = (await one(`SELECT row_version FROM project WHERE id = $1`, [p.id])).row_version;
    p.desc = "Rewritten by the reference system";
    const r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    const now = (await one(`SELECT row_version, description FROM project WHERE id = $1`, [p.id]));
    assert.equal(now.description, "Rewritten by the reference system");
    assert.equal(now.row_version, old + 1);

    const stale = await admin.patch(`/api/projects/${p.id}`, { desc: "typed on a stale screen", version: old });
    assert.equal(stale.status, 409, stale.text);
    const fresh = await admin.patch(`/api/projects/${p.id}`, { desc: "typed on a fresh screen", version: now.row_version });
    assert.equal(fresh.status, 200, fresh.text);
  });

  test("a merge that changes nothing moves no version", async () => {
    const admin = await as("admin");
    const before_ = await many(`SELECT id, row_version FROM project ORDER BY id`);
    const r = await admin.post("/api/admin/import?mode=merge", { db: await exportBook(admin) });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(await many(`SELECT id, row_version FROM project ORDER BY id`), before_,
      "a screen holding an unchanged row must not be told someone else changed it");
  });

  test("the in-place rewrites bump too: a site's champion moved by a merge", async () => {
    const admin = await as("admin");
    const book = await exportBook(admin);
    const s = book.sites[0];
    const other = book.people.find((x) => x.id !== s.champion);
    const old = (await one(`SELECT row_version FROM site WHERE id = $1`, [s.id])).row_version;
    s.champion = other.id;
    const r = await admin.post("/api/admin/import?mode=merge", { db: book });
    assert.equal(r.status, 200, r.text);
    const now = await one(`SELECT champion_id, row_version FROM site WHERE id = $1`, [s.id]);
    assert.equal(now.champion_id, other.id);
    assert.equal(now.row_version, old + 1);
  });
});

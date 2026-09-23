/**
 * D-36.13 (docs/36, FitAdapt #18) — a site is a `place` or a `team`.
 *
 * FitAdapt modelled one fake site, "Distributed team", with a UTC timezone
 * that meant nothing. A team is a delivery unit with no geography: its
 * timezone is optional, it has no plant window and no rollout wave, and
 * the Locations view does not draw it. It is still the unit of delegated
 * authority — a site grant on a team works exactly like one on a place,
 * which is the half of this line that must NOT change (docs/04).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, GROUP_PROJECT } from "./harness.js";
import { one, query } from "../src/db.js";
import { Engine } from "../../shared/engine.js";
import { locations, tzOffsetOf } from "../../shared/sitekind.js";

let admin;
before(async () => { await boot(); admin = await as("admin"); });
after(shutdown);

const TEAM = "SQD";
const bootDb = async (c = admin) => (await c.get("/api/bootstrap")).body.db;

describe("D-36.13 · a team is a site without geography", () => {
  test("a team is created without a timezone (201), and none is stored — not a UTC", async () => {
    const r = await admin.post("/api/admin/sites",
      { id: TEAM, kind: "team", city: "Payments squad", region: "", charter: "Payments delivery squad" });
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT kind, tz_offset, tz_name FROM site WHERE id = $1`, [TEAM]);
    assert.deepEqual(row, { kind: "team", tz_offset: null, tz_name: null });
    const s = (await bootDb()).sites.find((x) => x.id === TEAM);
    assert.equal(s.kind, "team");
    assert.equal(s.tz, null, "the serialiser says null, never Number(null) = 0");
    assert.equal(s.tzName, null);
    assert.equal(tzOffsetOf(s), 0, "a computation falls back to the group default, UTC");
  });

  test("every existing site is a place, and a place created as before still gets its default timezone", async () => {
    const db = await bootDb();
    assert.ok(db.sites.filter((s) => s.id !== TEAM).every((s) => s.kind === "place"));
    const r = await admin.post("/api/admin/sites", { id: "ARQ", city: "Arequipa" });
    assert.equal(r.status, 201, r.text);
    const row = await one(`SELECT kind, tz_offset::float AS tz, tz_name FROM site WHERE id = 'ARQ'`);
    assert.deepEqual(row, { kind: "place", tz: 0, tz_name: "UTC" });
  });

  test("a place without a timezone is refused — by the route and by the database", async () => {
    const r = await admin.post("/api/admin/sites", { id: "NOTZ", city: "Nowhere", kind: "place", tz: null });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /place needs a timezone/i);
    const n = await admin.post("/api/admin/sites", { id: "NOTZ", city: "Nowhere", tzName: "" });
    assert.equal(n.status, 400, "an empty zone name is no timezone either");

    const s = (await bootDb()).sites.find((x) => x.id === "ARQ");
    const p = await admin.patch("/api/admin/sites/ARQ", { tz: null, version: s.version });
    assert.equal(p.status, 400, "a place cannot clear its timezone");

    await assert.rejects(
      query(`INSERT INTO site (id, city, region, kind, tz_offset, tz_name) VALUES ('DBX', 'x', '', 'place', NULL, NULL)`),
      /site_place_has_timezone/);
    const bad = await admin.post("/api/admin/sites", { id: "KND", city: "x", kind: "squad" });
    assert.equal(bad.status, 400);
  });

  test("a team turned back into a place must be given a timezone", async () => {
    const s = (await bootDb()).sites.find((x) => x.id === TEAM);
    const r = await admin.patch(`/api/admin/sites/${TEAM}`, { kind: "place", version: s.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /place needs a timezone/i);
  });

  test("a plant window on a team is refused with a clear 400", async () => {
    const r = await admin.post("/api/windows",
      { site: TEAM, kind: "freeze", label: "Year-end", from: "2026-12-15", to: "2027-01-05" });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /team is not a place/i);
    /* and the database refuses it too, for any path that is not the route */
    await assert.rejects(
      query(`INSERT INTO site_window (id, site_id, kind, label, starts_on, ends_on)
             VALUES ('SW-T1', '${TEAM}', 'freeze', 'x', '2026-12-15', '2027-01-05')`),
      /team is not a place/);
  });

  test("a rollout wave on a team is refused with a clear 400", async () => {
    const r = await admin.post("/api/waves", { project: GROUP_PROJECT, site: TEAM, seq: 1 });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /team is not a place/i);
    await assert.rejects(
      query(`INSERT INTO rollout_wave (id, project_id, site_id, seq)
             VALUES ('WAVE-T1', '${GROUP_PROJECT}', '${TEAM}', 1)`),
      /team is not a place/);
  });

  test("a place that holds a window cannot become a team", async () => {
    const w = await admin.post("/api/windows",
      { site: "ARQ", kind: "shutdown", label: "Mill reline", from: "2026-11-02", to: "2026-11-06" });
    assert.equal(w.status, 201, w.text);
    const s = (await bootDb()).sites.find((x) => x.id === "ARQ");
    const r = await admin.patch("/api/admin/sites/ARQ", { kind: "team", version: s.version });
    assert.equal(r.status, 400, r.text);
    assert.match(r.body.error, /team is not a place/i);
  });

  test("a site grant on a team works like a site grant: its lead writes the team's site-governed project", async () => {
    const person = await admin.post("/api/admin/people", { name: "Q. Squad-Lead", site: TEAM, role: "Squad lead" });
    assert.equal(person.status, 201, person.text);
    const personId = person.body.person?.id ?? person.body.id;
    const u = await admin.post("/api/admin/users", {
      email: "squad.lead@meridian.example", displayName: "Squad lead", role: "site",
      password: "squad-lead-2026", personId, grants: [{ kind: "site", target: TEAM }],
    });
    assert.equal(u.status, 201, u.text);
    const lead = client();
    await lead.login("squad.lead@meridian.example", "squad-lead-2026");
    const ch = await lead.post("/api/auth/password", { current: "squad-lead-2026", next: "squad-lead-2026-mine" });
    assert.equal(ch.status, 200, ch.text);

    const db = await bootDb();
    const created = await lead.post("/api/projects", {
      name: "Squad payments backlog", programme: db.programmes[0].id, site: TEAM,
      governanceLevel: "site", start: "2026-09-01", finish: "2027-03-31",
    });
    assert.equal(created.status, 201, created.text);
    const id = created.body.id;
    const mine = (await bootDb(lead)).projects.find((p) => p.id === id);
    assert.ok(mine, "the team lead sees the team's project");
    const w = await lead.patch(`/api/projects/${id}`, { desc: "Written by the squad lead", version: mine.version });
    assert.equal(w.status, 200, w.text);

    /* and the grant narrows exactly as a site grant does: another site's
       lead can read nothing of it to write */
    const gru = await as("siteGRU");
    const other = await gru.patch(`/api/projects/${id}`, { desc: "not mine", version: mine.version + 1 });
    assert.ok([403, 404].includes(other.status), `another site's lead is refused (${other.status})`);
  });

  test("the Locations view reads places only, and knows which teams it left out", async () => {
    const db = await bootDb();
    const { places, teams } = locations(db);
    assert.ok(!places.some((s) => s.id === TEAM), "a team is not a location");
    assert.deepEqual(teams.map((s) => s.id), [TEAM]);
    const roll = Engine.siteRollup({ ...db, sites: places });
    assert.ok(!roll.some((r) => r.site.id === TEAM));
    assert.equal(roll.length, db.sites.length - 1);
    /* the clock and the overlap never meet a null offset on this view,
       and would compute in UTC if they did */
    assert.equal(Engine.siteClock({ tz: null }, new Date("2026-09-23T12:00:00Z")).length, 5);
  });

  test("export → import → export keeps a team's kind and its absent timezone", async () => {
    const first = (await admin.get("/api/admin/export")).body;
    const team = first.sites.find((s) => s.id === TEAM);
    assert.equal(team.kind, "team");
    assert.equal(team.tz, null);
    const r = await admin.post("/api/admin/import", { db: first });
    assert.equal(r.status, 200, r.text);
    const second = (await admin.get("/api/admin/export")).body;
    /* Every field comes back as it left; the version moves forward, as a
       replace now moves every row past what a screen could hold (NEW-19). */
    const { version: v2, ...back } = second.sites.find((s) => s.id === TEAM);
    const { version: v1, ...sent } = team;
    assert.deepEqual(back, sent);
    assert.ok(v2 > v1, `version ${v2} after a replace, ${v1} before`);
    const row = await one(`SELECT kind, tz_offset, tz_name FROM site WHERE id = $1`, [TEAM]);
    assert.deepEqual(row, { kind: "team", tz_offset: null, tz_name: null });
    assert.ok(second.sites.filter((s) => s.id !== TEAM).every((s) => s.kind === "place"));
  });

  test("a book written before 060 (no kind) imports every site as a place", async () => {
    const book = (await admin.get("/api/admin/export")).body;
    const old = { ...book, sites: book.sites.map(({ kind, ...s }) => s) };
    const r = await admin.post("/api/admin/import", { db: old });
    assert.equal(r.status, 200, r.text);
    const sites = (await bootDb()).sites;
    assert.ok(sites.length && sites.every((s) => s.kind === "place"));
    /* a pre-060 book has no way to say "team", so its sites keep the
       historical default a place always had */
    const was = sites.find((s) => s.id === TEAM);
    assert.equal(was.tz, 0);
    assert.equal(was.tzName, "UTC");
  });
});

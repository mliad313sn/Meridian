/**
 * SDP federation (Part B) — contracts C1/C3/C5/C6, service-key auth,
 * link CRUD under project write rights, and the origin='sdp' lockdown.
 *
 * Traces: charter ADR-4/5/6/7/8/9 · AMDEC I-01, I-02, I-08, I-10, I-16.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, client, SITE_PROJECT_GRU, GROUP_PROJECT } from "./harness.js";

let base = "";
let svcKey = "";

/** Service-side caller: X-API-Key, no cookie jar. */
async function svc(method, path, body, key = svcKey) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(key ? { "X-API-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

before(async () => {
  ({ base } = await boot());
});
after(shutdown);

/* ── service key (ADR-4 / I-10) ───────────────────────────────────── */

test("unconfigured federation answers 401 exactly like a wrong key", async () => {
  const r = await svc("GET", "/v1/links", null, "not-a-key");
  assert.equal(r.status, 401);
  const r2 = await svc("GET", "/v1/links", null, "");
  assert.equal(r2.status, 401);
});

test("only an admin may mint the inbound key; the response carries it once", async () => {
  const pm = await as("siteGRU");
  const refused = await pm.post("/api/federation/keys/inbound");
  assert.equal(refused.status, 403);

  const admin = await as("admin");
  const r = await admin.post("/api/federation/keys/inbound");
  assert.equal(r.status, 200);
  assert.ok(r.body.key.length >= 32, "a real key came back");
  svcKey = r.body.key;

  // The settings read admits the key exists but never returns it.
  const s = await admin.get("/api/federation/settings");
  assert.equal(s.status, 200);
  assert.equal(s.body.inboundKeySet, true);
  assert.equal(Object.values(s.body).includes(svcKey), false);
});

test("a wrong key is refused after configuration too", async () => {
  const r = await svc("GET", "/v1/links", null, svcKey + "x");
  assert.equal(r.status, 401);
});

/* ── C1 resources (ADR-9 / I-01, I-02) ────────────────────────────── */

test("C1 upserts sites and people, skips unknown sites, and is idempotent", async () => {
  const payload = {
    sites: [{ id: "HGO", name: "Houndé" }, { id: "SGO", name: "Sabodala" }],
    people: [
      { id: "SDP-U1", name: "A. Traoré", role: "coordinator", site_id: "HGO", active: true },
      { id: "SDP-U2", name: "K. Diallo", role: "editor", site_id: "ZZZ", active: true },
    ],
  };
  const r1 = await svc("POST", "/v1/resources/sync", payload);
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.body.sites, { upserted: 2 });
  assert.deepEqual(r1.body.people, { upserted: 1, skipped_unknown_site: 1 });

  // Re-POST — same counts, no duplicates (I-02).
  const r2 = await svc("POST", "/v1/resources/sync", payload);
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.body.sites, { upserted: 2 });
  assert.deepEqual(r2.body.people, { upserted: 1, skipped_unknown_site: 1 });

  const admin = await as("admin");
  const b = await admin.get("/api/bootstrap");
  const hgo = b.body.db.sites.find((s) => s.id === "HGO");
  assert.ok(hgo, "HGO arrived as a first-class site");
  assert.equal(b.body.db.people.filter((p) => p.id === "SDP-U1").length, 1);
});

test("C1 refuses a malformed site code loudly rather than coercing (I-01)", async () => {
  const r = await svc("POST", "/v1/resources/sync", { sites: [{ id: "bad code!" }], people: [] });
  assert.equal(r.status, 400);
});

/* ── C5 programme ingest (ADR-7 / I-08) ───────────────────────────── */

const OPS_BOOK = {
  programme: { id: "SDP-OPS", name: "IT Ops Strategy", sponsor: "IT Operations" },
  home_site: "SGO",
  projects: [
    { id: "SDP-OBJ-CATALOGUE", name: "Catalogue & formulaires", start_date: "2026-01-05",
      finish_date: "2026-12-18", target_date: "2026-12-18", progress_pct: 70,
      status: "green", gap_note: "", description: "Poids 35 %" },
    { id: "SDP-OBJ-INCIDENTS", name: "Incidents & gouvernance CAB", start_date: "2026-01-05",
      finish_date: "2026-12-18", progress_pct: 75, status: "orange",
      gap_note: "CAB récurrent à ancrer", description: "Poids 25 %" },
  ],
  milestones: [
    { id: "SDP-DLV-aaa1", project_id: "SDP-OBJ-CATALOGUE", label: "Formulaire self-service",
      delivery_date: "2026-09-30", done: false },
    { id: "SDP-DLV-aaa2", project_id: "SDP-OBJ-INCIDENTS", label: "PIR systématique",
      delivery_date: "2026-10-30", done: true },
  ],
};

test("C5 builds the ops programme; re-sync updates in place; dropped items close or go", async () => {
  const r1 = await svc("POST", "/v1/programmes/sync", OPS_BOOK);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.projects, 2);
  assert.equal(r1.body.milestones, 2);

  const admin = await as("admin");
  let b = await admin.get("/api/bootstrap");
  const prog = b.body.db.programmes.find((p) => p.id === "SDP-OPS");
  assert.ok(prog, "programme exists");
  assert.equal(prog.origin, "sdp");
  const proj = b.body.db.projects.find((p) => p.id === "SDP-OBJ-CATALOGUE");
  assert.equal(proj.governanceLevel, "group");
  assert.equal(proj.budget, 0);
  assert.equal(proj.origin, "sdp");
  const act = b.body.db.activities.find((a) => a.id === "SDP-OBJ-CATALOGUE-A1");
  assert.equal(act.pct, 70);
  assert.equal(Number(act.weight), 1);

  // Progress moves, one objective disappears → closed, milestone removed.
  const next = structuredClone(OPS_BOOK);
  next.projects = [{ ...next.projects[0], progress_pct: 85, status: "orange" }];
  next.milestones = [next.milestones[0]];
  const r2 = await svc("POST", "/v1/programmes/sync", next);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.closed, 1);
  assert.equal(r2.body.removed, 1);

  b = await admin.get("/api/bootstrap");
  assert.equal(b.body.db.activities.find((a) => a.id === "SDP-OBJ-CATALOGUE-A1").pct, 85);
  const closed = b.body.db.projects.find((p) => p.id === "SDP-OBJ-INCIDENTS");
  assert.equal(closed.closed, true);
  assert.equal(b.body.db.milestones.some((m) => m.id === "SDP-DLV-aaa2"), false);

  // Third run restores the full book (idempotent replay, I-08).
  const r3 = await svc("POST", "/v1/programmes/sync", OPS_BOOK);
  assert.equal(r3.status, 200);
  b = await admin.get("/api/bootstrap");
  assert.equal(b.body.db.projects.find((p) => p.id === "SDP-OBJ-INCIDENTS").closed, false);
});

test("C5 refuses non-SDP ids and undated projects", async () => {
  const r = await svc("POST", "/v1/programmes/sync", {
    programme: { id: "LOCAL-1", name: "x" }, home_site: "SGO", projects: [], milestones: [],
  });
  assert.equal(r.status, 400);
  const r2 = await svc("POST", "/v1/programmes/sync", {
    programme: { id: "SDP-OPS", name: "IT Ops Strategy" }, home_site: "SGO",
    projects: [{ id: "SDP-OBJ-X", name: "X" }], milestones: [],
  });
  assert.equal(r2.status, 400);
});

/* ── origin lockdown (ADR-8) ──────────────────────────────────────── */

test("synced rows refuse local edits with a message naming SDP", async () => {
  const admin = await as("admin");
  const b = await admin.get("/api/bootstrap");
  const proj = b.body.db.projects.find((p) => p.id === "SDP-OBJ-CATALOGUE");
  const act = b.body.db.activities.find((a) => a.id === "SDP-OBJ-CATALOGUE-A1");

  const p1 = await admin.patch("/api/projects/SDP-OBJ-CATALOGUE", { name: "Renamed", version: proj.version });
  assert.equal(p1.status, 403);
  assert.match(p1.body.error, /SDP/);

  const p2 = await admin.patch("/api/activities/SDP-OBJ-CATALOGUE-A1", { pct: 10, version: act.version });
  assert.equal(p2.status, 403);

  const p3 = await admin.post("/api/cost", { project: "SDP-OBJ-CATALOGUE", amount: 1, version: 1 });
  assert.equal(p3.status, 403);

  const prog = b.body.db.programmes.find((g) => g.id === "SDP-OPS");
  const p4 = await admin.patch("/api/admin/programmes/SDP-OPS", { name: "Nope", version: prog.version });
  assert.equal(p4.status, 403);

  // Meridian-native additions stay open: a steering milestone on the
  // synced project is legitimate and stays locally editable.
  const m = await admin.post("/api/milestones", {
    project: "SDP-OBJ-CATALOGUE", name: "Steering checkpoint", date: "2026-11-15", version: 1,
  });
  assert.equal(m.status, 201);
});

test("the SDP- programme namespace is reserved (ADR-8)", async () => {
  const admin = await as("admin");
  const r = await admin.post("/api/admin/programmes", { id: "SDP-X", name: "Squatter" });
  assert.equal(r.status, 400);
});

/* ── links (ADR-5 / I-16) ─────────────────────────────────────────── */

test("a site PM links an SDP change to their project; the write is audited", async () => {
  const pm = await as("siteGRU");
  const r = await pm.post("/api/federation/links", {
    project: SITE_PROJECT_GRU, source: "change", extId: "change:100234",
    title: "Upgrade core switch GRU", status: "Approval · In progress",
    kind: "Normal", risk: "Medium", due: "2026-09-12", windowStart: "2026-09-10",
  });
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^XL-\d+$/);

  const admin = await as("admin");
  const audit = await admin.get("/api/audit?entity=ext_link&limit=5");
  assert.ok(audit.body.events.some((e) => e.action === "SDP item linked"), "audit row landed");

  // Same item re-linked to the same project upserts — one row, same id (I-16).
  const again = await pm.post("/api/federation/links", {
    project: SITE_PROJECT_GRU, source: "change", extId: "change:100234",
    title: "Upgrade core switch GRU (renamed)", status: "Release · In progress",
  });
  assert.equal(again.status, 201);
  assert.equal(again.body.id, r.body.id);

  const b = await pm.get("/api/bootstrap");
  const links = b.body.db.extLinks.filter((l) => l.extId === "change:100234");
  assert.equal(links.length, 1);
  assert.equal(links[0].status, "Release · In progress");
});

test("linking is an ordinary project write: refused off-scope, invisible cross-site", async () => {
  const viewer = await as("viewerGRU");
  const r1 = await viewer.post("/api/federation/links", {
    project: SITE_PROJECT_GRU, source: "meetings", extId: "meetings:9", title: "x",
  });
  assert.equal(r1.status, 403);

  // A site PM on a group-governed project: read-only there (R1.6).
  const pm = await as("siteGRU");
  const r2 = await pm.post("/api/federation/links", {
    project: GROUP_PROJECT, source: "meetings", extId: "meetings:9", title: "x",
  });
  assert.equal(r2.status, 403);
});

test("an activity pin must belong to the same project", async () => {
  const pm = await as("siteGRU");
  const b = await pm.get("/api/bootstrap");
  const foreign = b.body.db.activities.find((a) => a.project !== SITE_PROJECT_GRU);
  const r = await pm.post("/api/federation/links", {
    project: SITE_PROJECT_GRU, source: "report", extId: "report:uid-1",
    title: "x", activity: foreign.id,
  });
  assert.equal(r.status, 400);
});

/* ── C3 read-back ─────────────────────────────────────────────────── */

test("C3 returns the link keyed by the C2/C4 stable id, filtered by site", async () => {
  const r = await svc("GET", "/v1/links?site=GRU");
  assert.equal(r.status, 200);
  const l = r.body.links.find((x) => x.ext_id === "change:100234");
  assert.ok(l, "the GRU link is served");
  assert.equal(l.ext_source, "change");
  assert.equal(l.project_id, SITE_PROJECT_GRU);
  assert.ok(l.project_name);

  const other = await svc("GET", "/v1/links?site=HGO");
  assert.equal(other.body.links.some((x) => x.ext_id === "change:100234"), false);
});

/* ── C6 projects summary ──────────────────────────────────────────── */

test("C6 serves health and dates only — no budget, no cost", async () => {
  const r = await svc("GET", "/v1/projects/summary?site=GRU");
  assert.equal(r.status, 200);
  assert.ok(r.body.projects.length >= 1);
  for (const p of r.body.projects) {
    assert.deepEqual(
      Object.keys(p).sort(),
      ["finish", "gate", "health", "id", "name", "phase", "pm", "programme", "site"],
      "the C6 whitelist is exact"
    );
  }
});

/* ── link removal + proxies ───────────────────────────────────────── */

test("unlink works for the PM and the link disappears from C3", async () => {
  const pm = await as("siteGRU");
  const b = await pm.get("/api/bootstrap");
  const link = b.body.db.extLinks.find((l) => l.extId === "change:100234");
  const r = await pm.del(`/api/federation/links/${link.id}`);
  assert.equal(r.status, 200);
  const back = await svc("GET", "/v1/links?site=GRU");
  assert.equal(back.body.links.some((x) => x.ext_id === "change:100234"), false);
});

test("SDP proxies degrade honestly when the peer is not configured", async () => {
  const pm = await as("siteGRU");
  const a = await pm.get("/api/federation/sdp/actions?site=GRU");
  assert.equal(a.status, 200);
  assert.equal(a.body.configured, false);
  assert.deepEqual(a.body.actions, []);
  const c = await pm.get("/api/federation/sdp/changes?site=GRU");
  assert.equal(c.body.configured, false);
});

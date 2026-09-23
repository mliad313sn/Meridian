/**
 * V-03 · V-06 · V-07 — the plant's calendar, rollout waves, site reality.
 *
 * The control the head of Operational Technology came for: intrusive work
 * cannot be dated into a site's change freeze unless management of change
 * has released it, and the release is never the delivery team's to give.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { many } from "../src/db.js";
import { can } from "../../shared/rbac.js";

before(async () => { await boot(); });
after(shutdown);

/* ── authority ────────────────────────────────────────────────────── */

test("the shutdown calendar belongs to the site; the MOC release does not", () => {
  const site = { role: "site", active: true, personId: "PE-19",
    grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const group = { role: "group", active: true, personId: "PE-16",
    grants: { programmes: new Set(["DCH"]), sites: new Set() } };
  const project = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };

  assert.equal(can(site, "window.write", { site_id: "GRU" }).ok, true, "their own site");
  assert.equal(can(site, "window.write", { site_id: "YYZ" }).ok, false, "not someone else's");
  assert.equal(can(group, "window.write", { site_id: "YYZ" }).ok, true, "group keeps any");

  assert.equal(can(site, "moc.approve", { project }).ok, false, "site cannot release plant work");
  assert.equal(can(group, "moc.approve", { project }).ok, true);
  // …and not on a project they themselves manage
  assert.equal(can(group, "moc.approve", { project, pm_id: "PE-16" }).ok, false);
});

/* ── the freeze, end to end ───────────────────────────────────────── */

let freezeId = null;

test("a site declares a change freeze", async () => {
  const pm = await as("siteGRU");
  const r = await pm.post("/api/windows", {
    site: "GRU", kind: "freeze", label: "Quarter-end production freeze",
    from: "2027-03-01", to: "2027-03-31",
    detail: "Mill throughput campaign — no intrusive change",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  freezeId = r.body.id;

  const db = (await pm.get("/api/bootstrap")).body.db;
  const w = db.windows.find((x) => x.id === freezeId);
  assert.ok(w, "the calendar reaches the client");
  assert.equal(w.kind, "freeze");
  assert.equal(w.from, "2027-03-01");
});

test("an ordinary milestone is untouched; intrusive work inside the freeze is refused", async () => {
  const pm = await as("siteGRU");

  // the project has not been classified yet — the freeze does not bite
  const before = await pm.post("/api/milestones", {
    project: SITE_PROJECT_GRU, name: "Design review", date: "2027-03-15", intrusive: true,
  });
  assert.equal(before.status, 201, "unclassified work is not plant work");

  // classify it as touching the plant
  let p = (await pm.get("/api/bootstrap")).body.db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  const classified = await pm.patch("/api/projects/" + SITE_PROJECT_GRU + "/plant",
    { impact: "plant", version: p.version });
  assert.equal(classified.status, 200, JSON.stringify(classified.body));

  // a non-intrusive milestone in the freeze is still fine
  const admin = await pm.post("/api/milestones", {
    project: SITE_PROJECT_GRU, name: "Steering update", date: "2027-03-16",
  });
  assert.equal(admin.status, 201, "paperwork is not a plant intervention");

  // the cutover is not
  const refused = await pm.post("/api/milestones", {
    project: SITE_PROJECT_GRU, name: "Network cutover", date: "2027-03-16", intrusive: true,
  });
  assert.equal(refused.status, 409, JSON.stringify(refused.body));
  assert.match(refused.body.error, /Quarter-end production freeze/);
  assert.match(refused.body.error, /management of change/);

  // outside the window it is allowed
  const ok = await pm.post("/api/milestones", {
    project: SITE_PROJECT_GRU, name: "Network cutover", date: "2027-04-07", intrusive: true,
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test("management of change releases it — at group level, with a reference", async () => {
  const pm = await as("siteGRU");
  let p = (await pm.get("/api/bootstrap")).body.db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  const bySite = await pm.patch("/api/projects/" + SITE_PROJECT_GRU + "/moc",
    { ref: "MOC-1234", version: p.version });
  assert.equal(bySite.status, 403, "the delivery team does not release its own plant work");

  const dch = await as("groupDCH");
  p = (await dch.get("/api/bootstrap")).body.db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  const bare = await dch.patch("/api/projects/" + SITE_PROJECT_GRU + "/moc", { version: p.version });
  assert.equal(bare.status, 400, "a release names the MOC it was raised under");

  const released = await dch.patch("/api/projects/" + SITE_PROJECT_GRU + "/moc",
    { ref: "MOC-1234", version: p.version });
  assert.equal(released.status, 200, JSON.stringify(released.body));

  p = (await dch.get("/api/bootstrap")).body.db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  assert.equal(p.mocRef, "MOC-1234");
  assert.ok(p.mocApprovedOn, "and is dated");
  assert.match(p.mocApprovedBy, /group/, "and names who released it");

  // now the same cutover inside the freeze is allowed
  const now = await dch.post("/api/milestones", {
    project: SITE_PROJECT_GRU, name: "Network cutover (released)", date: "2027-03-16", intrusive: true,
  });
  assert.equal(now.status, 201, JSON.stringify(now.body));
});

/* ── waves and site reality ───────────────────────────────────────── */

test("a rollout carries one row per site, and going live asks the freeze question", async () => {
  const dch = await as("groupDCH");
  const made = await dch.post("/api/waves", {
    project: SITE_PROJECT_GRU, site: "GRU", seq: 1, plannedOn: "2027-05-04",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const db = (await dch.get("/api/bootstrap")).body.db;
  const w = db.waves.find((x) => x.id === made.body.id);
  assert.equal(w.site, "GRU");
  assert.equal(w.status, "Planned");

  const live = await dch.patch("/api/waves/" + w.id,
    { status: "Live", actualOn: "2027-05-04", version: w.version });
  assert.equal(live.status, 200, JSON.stringify(live.body));

  const after = (await dch.get("/api/bootstrap")).body.db.waves.find((x) => x.id === w.id);
  assert.equal(after.status, "Live");
  assert.equal(after.actualOn, "2027-05-04");

  const dup = await dch.post("/api/waves", { project: SITE_PROJECT_GRU, site: "GRU" });
  assert.equal(dup.status, 409, "one wave per site per rollout");
});

/**
 * REQ-37 (retour de terrain RT365, D-3) — « une vague porte un `seq`
 * qu'elle vous interdit d'employer ».
 *
 * Ce qu'ils ont mesuré est exact : trois vagues sur un site, seq 1, 2, 3
 * → 201, 409, 409. Ce n'est pas la contrainte qui est fausse — une vague
 * EST un site de ce déploiement, le test au-dessus le tient depuis la
 * V-06 — c'est le refus qui ne disait rien : « That record already
 * exists » laisse croire à un doublon accidentel. Migration 044 : la
 * contrainte prend un nom, et le nom porte la phrase.
 */
test("une seconde vague au même site est refusée par une phrase qui dit pourquoi, et où consigner les phases", async () => {
  const dch = await as("groupDCH");
  const first = await dch.post("/api/waves", {
    project: SITE_PROJECT_GRU, site: "KRK", seq: 1, plannedOn: "2027-06-01", note: "supervised pilot",
  });
  assert.equal(first.status, 201, JSON.stringify(first.body));

  for (const seq of [2, 3]) {
    const again = await dch.post("/api/waves", {
      project: SITE_PROJECT_GRU, site: "KRK", seq, plannedOn: "2027-0" + (6 + seq) + "-01",
    });
    assert.equal(again.status, 409, JSON.stringify(again.body));
    /* Ce que le refus doit apprendre à qui le lit : ce qu'est une vague,
       à quoi sert `seq`, et quoi faire à la place. */
    assert.match(again.body.error, /already has a rollout wave at that site/);
    assert.match(again.body.error, /a wave IS a site in this rollout/);
    assert.match(again.body.error, /order the sites go live in/);
    assert.match(again.body.error, /milestones on the project/);
    assert.doesNotMatch(again.body.error, /That record already exists/);
  }

  /* Et `seq` n'est pas mort pour autant : il ordonne les SITES, ce qui
     est la raison de le garder plutôt que de le retirer comme le
     registre le proposait au cas où. Trois sites, trois rangs, relus
     dans l'ordre. */
  for (const [site, seq] of [["LIS", 2], ["BER", 3]]) {
    const w = await dch.post("/api/waves", { project: SITE_PROJECT_GRU, site, seq });
    assert.equal(w.status, 201, JSON.stringify(w.body));
  }
  const waves = (await dch.get("/api/bootstrap")).body.db.waves
    .filter((w) => w.project === SITE_PROJECT_GRU && ["KRK", "LIS", "BER"].includes(w.site));
  assert.deepEqual(waves.map((w) => w.site), ["KRK", "LIS", "BER"],
    "le déploiement se relit dans l'ordre de ses rangs");
  assert.deepEqual(waves.map((w) => w.seq), [1, 2, 3]);

  /* Un refus n'est pas un acte : rien n'est consigné pour les deux
     vagues qui n'ont pas eu lieu. */
  const audit = await many(
    `SELECT id FROM audit_event WHERE entity = 'rollout_wave' AND detail LIKE $1`,
    ["%" + SITE_PROJECT_GRU + " \u2192 KRK%"]);
  assert.equal(audit.length, 1, "une seule vague écrite au site, donc une seule ligne de piste");
});

test("a site carries its link and its readiness, not only its clock", async () => {
  const admin = await as("admin");
  const db = (await admin.get("/api/bootstrap")).body.db;
  const site = db.sites.find((s) => s.id === "GRU");
  assert.ok("linkMbps" in site && "readiness" in site, "the fields reach the client");
  assert.equal(site.readiness, "Unknown", "and start honestly unknown");

  const patched = await admin.patch("/api/admin/sites/GRU", {
    linkMbps: 40, linkKind: "VSAT", readiness: "Preparing",
    readinessNote: "Awaiting the second satellite link", version: site.version,
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  const after = (await admin.get("/api/bootstrap")).body.db.sites.find((s) => s.id === "GRU");
  assert.equal(after.linkMbps, 40);
  assert.equal(after.linkKind, "VSAT");
  assert.equal(after.readiness, "Preparing");
});

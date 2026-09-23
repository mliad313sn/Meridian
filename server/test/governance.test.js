/**
 * Two-level governance & adoption (2026-08-28 committees).
 *
 * Traces: reassignment gate (group G2) · segregation of duties on change
 * approval (audit I1) · independent gate-evidence approval (audit I3) ·
 * fail-closed thresholds (audit I4) · reportable overrides + decision
 * register (audit I2 / group G3) · site concern channel (site G3) ·
 * referrals and cross-level actions (rhythm 1–2) · the digest (value I-2)
 * · forced first-sign-in password change (adoption I4).
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU, GROUP_PROJECT } from "./harness.js";
import { can } from "../../shared/rbac.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

/* ── authority: pure rbac ─────────────────────────────────────────── */

test("a missing change-control threshold fails CLOSED, not open (I4)", () => {
  const site = { role: "site", active: true, personId: "PE-19",
    grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const project = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  const v = can(site, "change.approve", { project, cost_delta: 0.01, weeks_delta: 0 });
  assert.equal(v.ok, false);
  assert.match(v.why, /threshold/);
});

test("concern.raise: own delivery site only, group projects only (site G3)", () => {
  const site = { role: "site", active: true, personId: "PE-19",
    grants: { programmes: new Set(), sites: new Set(["GRU"]) } };
  const atMySite = { programme_id: "EIT", site_id: "GRU", governance_level: "group" };
  const elsewhere = { programme_id: "EIT", site_id: "YYZ", governance_level: "group" };
  const myOwn = { programme_id: "DCH", site_id: "GRU", governance_level: "site" };
  assert.equal(can(site, "concern.raise", { project: atMySite }).ok, true);
  assert.equal(can(site, "concern.raise", { project: elsewhere }).ok, false);
  assert.equal(can(site, "concern.raise", { project: myOwn }).ok, false);
});

test("riskProfile counts bands and appetite lines (group G5)", () => {
  const db = {
    settings: { pmoExposure: 8, escalateExposure: 15 },
    raid: [
      { status: "Open", project: "P1", p: 5, i: 5 },   // 25 → Critical, steering
      { status: "Open", project: "P1", p: 3, i: 3 },   // 9  → High, pmo
      { status: "Open", project: "P1", p: 1, i: 2 },   // 2  → Low
      { status: "Closed", project: "P1", p: 5, i: 5 }, // ignored
    ],
  };
  const rp = Engine.riskProfile(db, [{ id: "P1" }]);
  assert.equal(rp.open, 3);
  assert.equal(rp.bands.Critical, 1);
  assert.equal(rp.bands.High, 1);
  assert.equal(rp.steering, 1);
  assert.equal(rp.pmo, 1);
});

/* ── reassignment is a portfolio-structure act (group G2) ─────────── */

test("a group user cannot move a project into a programme outside their grant", async () => {
  const dch = await as("groupDCH");               // grant: DCH only
  const b = await dch.get("/api/bootstrap");
  const p = b.body.db.projects.find((x) => x.id === SITE_PROJECT_GRU); // a DCH project
  const refused = await dch.patch("/api/projects/" + p.id, { programme: "CBP", version: p.version });
  assert.equal(refused.status, 403);
  assert.match(refused.body.error, /outside your grant/);
});

test("admin moves it, and the audit trail carries the imaged 'Project moved' row (I2)", async () => {
  const admin = await as("admin");
  let b = await admin.get("/api/bootstrap");
  const p = b.body.db.projects.find((x) => x.id === GROUP_PROJECT);   // group project at KRK
  const r = await admin.patch("/api/projects/" + p.id, { site: "GRU", version: p.version });
  assert.equal(r.status, 200);

  const audit = await admin.get("/api/audit?action=Project%20moved&limit=5");
  assert.equal(audit.status, 200);
  const row = audit.body.events.find((e) => e.entity_id === p.id);
  assert.ok(row, "the move is a named audit action");
  assert.equal(row.after_json.site_id, "GRU");
  assert.equal(row.before_json.site_id, "KRK");
});

/* ── the site concern channel, end to end (site G3) ───────────────── */

test("a site lead raises a concern on the group project now landing on their site", async () => {
  const pm = await as("siteGRU");
  const r = await pm.post("/api/raid", {
    type: "Risk", project: GROUP_PROJECT,
    title: "Core migration is consuming our only network engineer",
    detail: "Cutover rehearsals clash with our branch rollout", p: 4, i: 4,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));

  const b = await pm.get("/api/bootstrap");
  const item = b.body.db.raid.find((x) => x.id === r.body.id);
  assert.equal(item.originSite, "GRU", "the concern names its raising site");

  // Create-only: editing the group project's register stays with its owners.
  const edit = await pm.patch("/api/raid/" + r.body.id, { p: 5, version: item.version });
  assert.equal(edit.status, 403);
});

test("a site lead still cannot raise on a group project elsewhere", async () => {
  const pm = await as("siteSIN");   // granted SIN; the project now sits at GRU
  const r = await pm.post("/api/raid", {
    type: "Risk", project: GROUP_PROJECT, title: "x", p: 3, i: 3,
  });
  assert.equal(r.status, 403);
});

/* ── segregation of duties on change control (audit I1) ───────────── */

let crId = null;

test("the raiser of a change request cannot decide it; a second pair of eyes can", async () => {
  const pm = await as("siteGRU");
  const raised = await pm.post("/api/change", {
    project: SITE_PROJECT_GRU, title: "Slip UAT by one week", cost: 0.05, weeks: 1,
  });
  assert.equal(raised.status, 201);
  crId = raised.body.id;

  const self = await pm.post("/api/change/" + crId + "/approve", {});
  assert.equal(self.status, 403);
  assert.match(self.body.error, /you raised this request/);

  // Another account with authority signs the first step.
  const dch = await as("groupDCH");
  const other = await dch.post("/api/change/" + crId + "/approve", { comment: "Impact reviewed" });
  assert.equal(other.status, 200, JSON.stringify(other.body));
});

/* ── independent gate-evidence approval (audit I3) ────────────────── */

test("gate evidence: the owner never approves their own; site level never approves site-project gates", async () => {
  const dch = await as("groupDCH");
  const meDch = await dch.get("/api/auth/me");
  const created = await dch.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Cutover evidence", type: "Assurance",
    gate: 2, owner: meDch.body.user.personId,
    uri: "https://docs.meridian.example/evidence/cutover.pdf",   // R-01 — evidence points at something
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const docId = created.body.id;
  let b = await dch.get("/api/bootstrap");
  let doc = b.body.db.docs.find((d) => d.id === docId);

  const own = await dch.patch("/api/documents/" + docId, { status: "Approved", version: doc.version });
  assert.equal(own.status, 403);
  assert.match(own.body.error, /you own this evidence/);

  const pm = await as("siteGRU");
  const siteTry = await pm.patch("/api/documents/" + docId, { status: "Approved", version: doc.version });
  assert.equal(siteTry.status, 403);
  assert.match(siteTry.body.error, /group level/);

  const admin = await as("admin");
  b = await admin.get("/api/bootstrap");
  doc = b.body.db.docs.find((d) => d.id === docId);
  const ok = await admin.patch("/api/documents/" + docId, { status: "Approved", version: doc.version });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test("evidence cannot arrive pre-approved, nor be re-tagged onto a gate afterwards (I3)", async () => {
  const pm = await as("siteGRU");
  /* Creating is not approving: without this the whole control is one
     POST away from irrelevant. */
  const preApproved = await pm.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Gate 2 readiness", type: "Assurance",
    gate: 2, status: "Approved",
  });
  assert.equal(preApproved.status, 400, JSON.stringify(preApproved.body));
  assert.match(preApproved.body.error, /separate act/);

  /* The exhaustive sweep found that gating the create was not enough: a
     GROUP user could file evidence with no owner, already approved, and
     so author and approve it in one call. Filing is filing, for everyone. */
  const dch = await as("groupDCH");
  const byGroup = await dch.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Gate 3 readiness", gate: 3, status: "Approved",
  });
  assert.equal(byGroup.status, 400, JSON.stringify(byGroup.body));
  const byAdminToo = await (await as("admin")).post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Gate 4 readiness", gate: 4, status: "Approved",
  });
  assert.equal(byAdminToo.status, 400, "not even admin authors and approves in one call");

  /* And the same dodge in two moves: approve it where no gate rule bites,
     then re-tag the approved document onto the gate. */
  const admin = await as("admin");
  const created = await admin.post("/api/documents", {
    project: SITE_PROJECT_GRU, name: "Operating note", type: "Operations", gate: 0,
    uri: "https://docs.meridian.example/evidence/operating-note.pdf",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const docId = created.body.id;
  let doc = (await admin.get("/api/bootstrap")).body.db.docs.find((d) => d.id === docId);
  const approved = await admin.patch("/api/documents/" + docId,
    { status: "Approved", version: doc.version });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  doc = (await pm.get("/api/bootstrap")).body.db.docs.find((d) => d.id === docId);
  const retag = await pm.patch("/api/documents/" + docId, { gate: 2, version: doc.version });
  assert.equal(retag.status, 403, JSON.stringify(retag.body));
  assert.match(retag.body.error, /group level/);
});

/* ── referrals: the rhythm between levels (rhythm 1–3) ────────────── */

test("a site room refers up; the group agenda carries it; a group decision retires it", async () => {
  const pm = await as("siteGRU");
  const series = await pm.get("/api/meetings/series");
  const mine = series.body.series.find((s) => s.scopeKind === "site" && s.canWrite);
  assert.ok(mine, "the GRU lead chairs a site series");
  const occ = mine.next;
  assert.ok(occ, "a scheduled occurrence exists");
  await pm.post("/api/meetings/occurrences/" + occ.id + "/open", {});

  const referred = await pm.post("/api/meetings/occurrences/" + occ.id + "/decisions", {
    headline: "Freeze window for the payments cutover needs steering sign-off",
    rationale: "Beyond site authority", refer: true, referTo: "group",
  });
  assert.equal(referred.status, 201, JSON.stringify(referred.body));
  assert.equal(referred.body.referredTo, "group");
  const refId = referred.body.id;

  const admin = await as("admin");
  const gSeries = (await admin.get("/api/meetings/series")).body.series
    .find((s) => s.scopeKind === "group");
  const gOcc = gSeries.next;
  let payload = await admin.get("/api/meetings/occurrences/" + gOcc.id);
  const refSection = payload.body.agenda.sections.find((s) => s.key === "referrals");
  assert.ok(refSection, "the group agenda carries a 'Referred from delivery calls' section");
  assert.ok(refSection.items.some((it) => it.entityId === refId), "our referral is on it");

  await admin.post("/api/meetings/occurrences/" + gOcc.id + "/open", {});
  const answer = await admin.post("/api/meetings/occurrences/" + gOcc.id + "/decisions", {
    headline: "Freeze window approved for the last weekend of the month",
    answers: refId,
  });
  assert.equal(answer.status, 201, JSON.stringify(answer.body));

  payload = await admin.get("/api/meetings/occurrences/" + gOcc.id);
  const refAfter = payload.body.agenda.sections.find((s) => s.key === "referrals");
  assert.ok(!refAfter || !refAfter.items.some((it) => it.entityId === refId),
    "an answered referral leaves the agenda");
});

test("a referral addressed to 'programme' reaches only the programme it belongs to", async () => {
  const pm = await as("siteGRU");
  const mine = (await pm.get("/api/meetings/series")).body.series
    .find((s) => s.scopeKind === "site" && s.canWrite);
  const referred = await pm.post("/api/meetings/occurrences/" + mine.next.id + "/decisions", {
    headline: "Terminating the integration vendor is beyond this room",
    rationale: "A programme commercial decision",
    refer: true, referTo: "programme", projectId: SITE_PROJECT_GRU,   // a DCH project
  });
  assert.equal(referred.status, 201, JSON.stringify(referred.body));
  const refId = referred.body.id;

  const admin = await as("admin");
  const series = (await admin.get("/api/meetings/series")).body.series;
  const dch = series.find((s) => s.id === "MS-DCH-W");
  const cbp = series.find((s) => s.id === "MS-CBP-W");
  assert.ok(dch?.next && cbp?.next, "both programme rooms have a scheduled occurrence");

  const onOwner = (await admin.get("/api/meetings/occurrences/" + dch.next.id))
    .body.agenda.sections.find((s) => s.key === "referrals");
  assert.ok(onOwner?.items.some((it) => it.entityId === refId),
    "the programme the project belongs to is the room that is asked");

  const onOther = (await admin.get("/api/meetings/occurrences/" + cbp.next.id))
    .body.agenda.sections.find((s) => s.key === "referrals");
  assert.ok(!onOther || !onOther.items.some((it) => it.entityId === refId),
    "another programme's room never sees it");

  await admin.post("/api/meetings/occurrences/" + cbp.next.id + "/open", {});
  const poach = await admin.post("/api/meetings/occurrences/" + cbp.next.id + "/decisions", {
    headline: "We will terminate", answers: refId,
  });
  assert.equal(poach.status, 400, "…and cannot retire it on that programme's behalf");
});

test("an action raised at group level lands on the owning site's weekly (rhythm-2)", async () => {
  const admin = await as("admin");
  const gSeries = (await admin.get("/api/meetings/series")).body.series
    .find((s) => s.scopeKind === "group");
  const gOcc = gSeries.next;
  const raised = await admin.post("/api/meetings/occurrences/" + gOcc.id + "/actions", {
    title: "Confirm GRU network freeze dates", projectId: GROUP_PROJECT,   // now sited GRU
  });
  assert.equal(raised.status, 201);

  const pm = await as("siteGRU");
  const mine = (await pm.get("/api/meetings/series")).body.series
    .find((s) => s.scopeKind === "site" && s.canWrite);
  const payload = await pm.get("/api/meetings/occurrences/" + mine.next.id);
  const inherited = payload.body.openActions.find((a) => a.id === raised.body.id);
  assert.ok(inherited, "the group action appears in the site meeting's open actions");
  assert.ok(inherited.origin, "tagged with its origin series");
});

test("the meeting pack exports before the close (value I-3)", async () => {
  const pm = await as("siteGRU");
  const mine = (await pm.get("/api/meetings/series")).body.series
    .find((s) => s.scopeKind === "site" && s.canWrite);
  const r = await pm.get("/api/meetings/occurrences/" + mine.next.id + "/pack");
  assert.equal(r.status, 200);
  assert.match(r.body.markdown, /## Agenda/);
  assert.match(r.body.markdown, /## The slate/);
});

/* ── digest & register surfaces ───────────────────────────────────── */

test("the digest answers 'what changed', scoped and named (value I-2)", async () => {
  const admin = await as("admin");
  const r = await admin.get("/api/digest");
  assert.equal(r.status, 200);
  assert.ok(r.body.entries.some((e) => e.action === "Project moved"), "the week's move is in the digest");

  // A viewer outside audit.read still gets THEIR digest — scoped, not refused.
  const viewer = await as("viewerGRU");
  const rv = await viewer.get("/api/digest");
  assert.equal(rv.status, 200);
});

test("the decision register joins control decisions and minuted ones (group G3)", async () => {
  const admin = await as("admin");
  const r = await admin.get("/api/decisions/log");
  assert.equal(r.status, 200);
  assert.ok(r.body.minuted.some((d) => d.referred === "group"), "the referral shows as referred");
  const pm = await as("siteGRU");
  const refused = await pm.get("/api/decisions/log");
  assert.equal(refused.status, 403, "site level does not read the register (audit.read)");
});

/* ── adoption: forced first-sign-in password change (I4) ──────────── */

test("an admin-provisioned account must set its own password before day two", async () => {
  const admin = await as("admin");
  const created = await admin.post("/api/admin/users", {
    email: "new.joiner@example.com", displayName: "New Joiner", role: "viewer",
    password: "temporary-pass-1",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const { client } = await import("./harness.js");
  const c = client();
  const user = await c.login("new.joiner@example.com", "temporary-pass-1");
  assert.equal(user.mustChangePassword, true, "the flag rides the login payload");

  /* The dialog is a courtesy; the refusal is the control. Until the
     password is the holder's own, the session reads but does not act. */
  assert.equal((await c.get("/api/bootstrap")).status, 200, "reading is still allowed");
  const early = await c.post("/api/raid", { title: "anything", type: "Risk" });
  assert.equal(early.status, 403);
  assert.match(early.body.error, /Choose your own password/);

  const bad = await c.post("/api/auth/password", { current: "wrong", next: "my-own-pass-9" });
  assert.equal(bad.status, 403);
  /* A second device on the old password — changing it must end that
     session, and keep the one doing the changing. */
  const other = client();
  await other.login("new.joiner@example.com", "temporary-pass-1");
  assert.equal((await other.get("/api/auth/me")).status, 200);

  const ok = await c.post("/api/auth/password", { current: "temporary-pass-1", next: "my-own-pass-9" });
  assert.equal(ok.status, 200);
  const me = await c.get("/api/auth/me");
  assert.equal(me.body.user.mustChangePassword, false);
  assert.equal((await other.get("/api/auth/me")).status, 401, "the other session is over");
});

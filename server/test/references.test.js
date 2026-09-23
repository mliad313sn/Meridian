/**
 * D-36.14 · ONE TYPED EXTERNAL REFERENCE  (FitAdapt #17 · RT365 REQ-29 ·
 * KODO MER-11)
 *
 * `ext_link` gained repository sources — issue, pull request, commit, CI
 * run, artefact — attached to a project, a stage, a RAID row or a gate
 * criterion. These tests hold the four promises of the decision:
 *
 *   1. a person links one from a screen, under `project.write`, and a
 *      kind Meridian does not know is refused;
 *   2. the state is PUSHED by a named integration through /api/v1 — never
 *      fetched — reaches every link citing the same thing, and the same
 *      push twice writes nothing;
 *   3. a criterion's citation, once the criterion is found met or its gate
 *      is done, is never edited or removed: a change is a new version and
 *      the old one stays;
 *   4. the contract's body is closed, and says so in its description.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client, SITE_PROJECT_GRU } from "./harness.js";
import { one, many, query } from "../src/db.js";
import { assertKnownBody, WRITE_BODIES } from "../src/v1write.js";
import { canonicalRef } from "../src/references.js";

before(async () => { await boot(); });
after(shutdown);

const P = SITE_PROJECT_GRU;
const c = client();
let KEY, INT_ID, INT_NAME, READ_KEY, pm, admin, STAGE, RISK;
const put = (id, body, key = KEY) => c.put("/api/v1/references/" + encodeURIComponent(id), body, { "X-API-Key": key });
const links = async (who = pm) => (await who.get("/api/bootstrap")).body.db.extLinks;
const auditCount = async () => Number((await one(
  `SELECT count(*)::int AS n FROM audit_event WHERE entity = 'ext_link'`)).n);

describe("D-36.14 · the setting", () => {
  test("a site PM, an administrator, a write key and a read key", async () => {
    pm = await as("siteGRU");
    admin = await as("admin");
    const k = await admin.post("/api/admin/integrations",
      { name: "FitAdapt GitHub Action", scopes: "read:portfolio,write:portfolio", purpose: "repository state" });
    assert.equal(k.status, 201, k.text);
    KEY = k.body.key; INT_ID = k.body.id; INT_NAME = "FitAdapt GitHub Action";
    READ_KEY = (await admin.post("/api/admin/integrations",
      { name: "Warehouse", scopes: "read:portfolio", purpose: "reads" })).body.key;
    const db = (await pm.get("/api/bootstrap")).body.db;
    STAGE = db.activities.find((a) => a.project === P).id;
    RISK = db.raid.find((r) => r.project === P)?.id;
    assert.ok(STAGE && RISK, "the GRU project has a stage and a RAID row");
  });
});

describe("D-36.14 · a person links a reference from a screen", () => {
  test("a pull request on a stage: created, canonical, shown with no state", async () => {
    const r = await pm.post("/api/references",
      { project: P, activity: STAGE, kind: "pull_request", ref: " fitadapt/app#17 ",
        url: "https://github.com/fitadapt/app/pull/17", title: "Add a github source" });
    assert.equal(r.status, 201, r.text);
    const l = (await links()).find((x) => x.id === r.body.id);
    assert.equal(l.source, "pull_request");
    assert.equal(l.extId, "fitadapt/app#17", "the ref is stored in its one spelling");
    assert.equal(l.activity, STAGE);
    assert.equal(l.url, "https://github.com/fitadapt/app/pull/17");
    assert.equal(l.state, "", "nobody has reported a state — and a person cannot type one");
    assert.equal(l.stateAt, null);
    assert.ok(l.linkedByName, "who cited it is part of the record");
  });

  test("the same ref on a RAID row and on the project is another link, the same on the same stage is refused", async () => {
    const onRaid = await pm.post("/api/references", { project: P, raid: RISK, kind: "pull_request", ref: "fitadapt/app#17" });
    assert.equal(onRaid.status, 201, onRaid.text);
    const onProject = await pm.post("/api/references", { project: P, kind: "issue", ref: "fitadapt/app#16" });
    assert.equal(onProject.status, 201, onProject.text);
    const twin = await pm.post("/api/references", { project: P, activity: STAGE, kind: "pull_request", ref: "fitadapt/app#17" });
    assert.equal(twin.status, 409);
    const two = await pm.post("/api/references", { project: P, activity: STAGE, raid: RISK, kind: "issue", ref: "a/b#1" });
    assert.equal(two.status, 400, "one target below the project, not several");
  });

  test("an unknown kind is refused, and so is a ref that does not have its kind's shape", async () => {
    const k = await pm.post("/api/references", { project: P, kind: "jira", ref: "ABC-1" });
    assert.equal(k.status, 400);
    assert.match(k.body.error, /issue, pull_request, commit, ci_run, artefact/);
    const shape = await pm.post("/api/references", { project: P, kind: "commit", ref: "not-a-sha" });
    assert.equal(shape.status, 400);
    assert.match(shape.body.error, /owner\/repo@/);
    const digest = await pm.post("/api/references", { project: P, kind: "artefact", ref: "sha256:abc" });
    assert.equal(digest.status, 400, "a sha256 digest is 64 hex digits");
    const url = await pm.post("/api/references", { project: P, kind: "issue", ref: "a/b#2", url: "javascript:alert(1)" });
    assert.equal(url.status, 400, "a url is a web address people follow");
    assert.equal(canonicalRef("commit", "Org/Repo@ABCDEF1"), "Org/Repo@abcdef1");
    assert.equal(canonicalRef("artefact", "SHA256:" + "A".repeat(64)), "sha256:" + "a".repeat(64));
  });

  test("authority: a viewer is refused, another site does not see the project", async () => {
    const viewer = await as("viewerGRU");
    const v = await viewer.post("/api/references", { project: P, kind: "issue", ref: "a/b#3" });
    assert.equal(v.status, 403);
    const yyz = await as("siteYYZ");
    const y = await yyz.post("/api/references", { project: P, kind: "issue", ref: "a/b#3" });
    assert.equal(y.status, 404, "out of scope answers as absent does");
    const l = (await links()).find((x) => x.extId === "fitadapt/app#16");
    assert.equal((await viewer.del("/api/references/" + l.id)).status, 403);
    assert.equal((await yyz.patch("/api/references/" + l.id, { title: "x", version: l.version })).status, 404);
  });

  test("a correction asserts the version, and a changed ref clears the state it no longer describes", async () => {
    const l = (await links()).find((x) => x.extId === "fitadapt/app#16");
    const stale = await pm.patch("/api/references/" + l.id, { ref: "fitadapt/app#15", version: l.version + 7 });
    assert.equal(stale.status, 409);
    const none = await pm.patch("/api/references/" + l.id, { title: "x" });
    assert.equal(none.status, 428, "no version, no write");
    const ok = await pm.patch("/api/references/" + l.id, { ref: "fitadapt/app#15", version: l.version });
    assert.equal(ok.status, 200, ok.text);
    const after = (await links()).find((x) => x.id === l.id);
    assert.equal(after.extId, "fitadapt/app#15", "corrected in place — not a criterion citation");
    const del = await pm.del("/api/references/" + l.id);
    assert.equal(del.status, 200);
    assert.ok(!(await links()).some((x) => x.id === l.id));
  });

  test("an SDP route cannot re-pin or remove a repository reference", async () => {
    const l = (await links()).find((x) => x.extId === "fitadapt/app#17" && x.raid);
    assert.equal((await pm.del("/api/federation/links/" + l.id)).status, 404);
  });
});

describe("D-36.14 · the state is pushed in by a named integration, never fetched", () => {
  test("a state report with no project reaches every link citing that pull request", async () => {
    const before = await auditCount();
    const r = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "open",
      stateAt: "2026-08-27T09:00:00Z", title: "Add a github source to ext_link" });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.created, false, "a report creates nothing");
    assert.equal(r.body.links.length, 2, "the stage's link and the RAID row's link");
    const mine = (await links()).filter((x) => x.extId === "fitadapt/app#17");
    for (const l of mine) {
      assert.equal(l.state, "open");
      assert.equal(l.stateAt, "2026-08-27T09:00:00.000Z");
      assert.equal(l.stateSource, INT_ID);
      assert.equal(l.stateSourceName, INT_NAME, "the screen can say who reported it");
      assert.equal(l.title, "Add a github source to ext_link");
    }
    assert.equal(await auditCount(), before + 1, "one report, one audit row");
  });

  test("the same report twice writes nothing; an older one is ignored; a newer one moves the state", async () => {
    const v0 = (await links()).find((x) => x.extId === "fitadapt/app#17" && x.activity).version;
    const n0 = await auditCount();
    const again = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "open",
      stateAt: "2026-08-27T09:00:00Z", title: "Add a github source to ext_link" });
    assert.equal(again.status, 200);
    const noDate = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "open" });
    assert.equal(noDate.status, 200);
    const older = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "closed",
      stateAt: "2026-08-20T09:00:00Z" });
    assert.equal(older.status, 200);
    let l = (await links()).find((x) => x.extId === "fitadapt/app#17" && x.activity);
    assert.equal(l.state, "open", "a report older than the one held is a webhook that arrived late");
    assert.equal(l.version, v0, "no version moved");
    assert.equal(await auditCount(), n0, "no audit row for a report that changed nothing");

    const merged = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "merged",
      stateAt: "2026-08-28T10:30:00Z" });
    assert.equal(merged.status, 200);
    l = (await links()).find((x) => x.extId === "fitadapt/app#17" && x.activity);
    assert.equal(l.state, "merged");
    assert.equal(l.version, v0 + 1);
    const ev = await one(`SELECT action, detail, user_label FROM audit_event WHERE entity = 'ext_link' ORDER BY id DESC LIMIT 1`);
    assert.equal(ev.action, "Reference state reported");
    assert.match(ev.detail, /merged/);
  });

  test("a report nobody cites is 404; a state the kind cannot have is 400; a read key cannot report", async () => {
    const r = await put("x", { kind: "pull_request", ref: "fitadapt/app#999", state: "open" });
    assert.equal(r.status, 404);
    assert.match(r.body.error, /No link in Meridian cites/);
    const commit = await put("y", { kind: "commit", ref: "fitadapt/app@abcdef1", state: "passed" });
    assert.equal(commit.status, 400, "a commit has no state — a CI run does");
    const pr = await put("z", { kind: "pull_request", ref: "fitadapt/app#17", state: "passed" });
    assert.equal(pr.status, 400);
    const kind = await put("w", { kind: "jira", ref: "ABC-1", state: "open" });
    assert.equal(kind.status, 400);
    assert.match(kind.body.error, /kind must be one of/);
    const read = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "closed" }, READ_KEY);
    assert.equal(read.status, 403);
    assert.equal((await c.put("/api/v1/references/q", { kind: "issue" })).status, 401);
  });

  test("an integration creates its own reference, idempotently, by its own id", async () => {
    const body = { project: P, activity: STAGE, kind: "ci_run", ref: "fitadapt/app/runs/4242",
      url: "https://github.com/fitadapt/app/actions/runs/4242", state: "passed", stateAt: "2026-08-28T11:00:00Z" };
    const first = await put("run-4242", body);
    assert.equal(first.status, 201, first.text);
    assert.equal(first.body.created, true);
    const n0 = await auditCount();
    const second = await put("run-4242", body);
    assert.equal(second.status, 200, second.text);
    assert.equal(second.body.created, false);
    assert.equal(second.body.id, first.body.id);
    assert.equal(second.body.version, first.body.version, "an identical re-push moves no version");
    assert.equal(await auditCount(), n0, "and writes no audit row");
    const rows = await many(`SELECT id FROM ext_link WHERE external_source = $1 AND external_id = 'run-4242'`, [INT_ID]);
    assert.equal(rows.length, 1);
    const l = (await links()).find((x) => x.id === first.body.id);
    assert.equal(l.state, "passed");
    assert.equal(l.externalSource, INT_ID);
    assert.equal(l.externalId, "run-4242");
    assert.equal(l.externalSourceName, INT_NAME);

    const keyed = await c.put("/api/v1/references/run-4242", { ...body, state: "failed", stateAt: "2026-08-28T12:00:00Z" },
      { "X-API-Key": KEY, "Idempotency-Key": "run-4242-failed" });
    assert.equal(keyed.status, 200);
    const replay = await c.put("/api/v1/references/run-4242", { ...body, state: "failed", stateAt: "2026-08-28T12:00:00Z" },
      { "X-API-Key": KEY, "Idempotency-Key": "run-4242-failed" });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.version, keyed.body.version);
    const moved = await put("run-4242", { project: "PRJ-101" });
    assert.equal(moved.status, 400, "a reference stays on its project");
    const kind = await put("run-4242", { kind: "issue" });
    assert.equal(kind.status, 400, "and its kind");
  });

  test("the screen's state line is the reported one — the bootstrap says who, and when", async () => {
    const l = (await links()).find((x) => x.extId === "fitadapt/app#17" && x.activity);
    assert.equal(l.stateSourceName, INT_NAME);
    assert.ok(l.stateAt);
    assert.ok(!("verified" in l), "no field claims a verification Meridian never did");
  });
});

describe("REQ-29 · a criterion's citation after the gate is a new version, never an edit", () => {
  let GC, XL, GATE;
  test("before the gate, a citation is corrected in place", async () => {
    const db = (await pm.get("/api/bootstrap")).body.db;
    /* A gate of this project whose milestone is not done yet. */
    const open = db.milestones.filter((m) => m.project === P && m.gate && !m.done).map((m) => m.gate);
    GATE = Math.max(...open);
    const c0 = await pm.post("/api/criteria", { project: P, gate: GATE, text: "The ledger build is reproducible" });
    assert.equal(c0.status, 201, c0.text);
    GC = c0.body.id;
    const r = await pm.post("/api/references", { project: P, criterion: GC, kind: "commit", ref: "rt365/ledger@abcdef1" });
    assert.equal(r.status, 201, r.text);
    XL = r.body.id;
    const l = (await links()).find((x) => x.id === XL);
    const fix = await pm.patch("/api/references/" + XL, { ref: "rt365/ledger@abcdef2", version: l.version });
    assert.equal(fix.status, 200, fix.text);
    assert.equal((await links()).find((x) => x.id === XL).extId, "rt365/ledger@abcdef2");
  });

  test("once the criterion is found met, a changed citation is a NEW row; the old one is kept as it was", async () => {
    const reviewer = (await one(`SELECT id FROM person WHERE active ORDER BY id DESC LIMIT 1`)).id;
    await query(`UPDATE gate_criterion SET met = true, reviewed_by = $2, reviewed_on = '2026-08-28' WHERE id = $1`, [GC, reviewer]);
    const l = (await links()).find((x) => x.id === XL);
    const r = await pm.patch("/api/references/" + XL, { ref: "rt365/ledger@abcdef3", version: l.version });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.body.supersedes, XL);
    const all = await links();
    const old = all.find((x) => x.id === XL);
    const neu = all.find((x) => x.id === r.body.id);
    assert.equal(old.extId, "rt365/ledger@abcdef2", "the old citation is never edited");
    assert.ok(old.supersededAt, "it is stamped superseded");
    assert.ok(old.linkedByName, "and still says who cited it");
    assert.equal(neu.extId, "rt365/ledger@abcdef3");
    assert.equal(neu.supersedes, XL);
    assert.equal(neu.criterion, GC);
    assert.equal(neu.supersededAt, null);
    const ev = await one(`SELECT action, before_json, after_json FROM audit_event WHERE entity = 'ext_link' ORDER BY id DESC LIMIT 1`);
    assert.equal(ev.action, "Citation superseded");
  });

  test("neither a frozen citation nor a superseded one is removed or edited", async () => {
    const all = await links();
    const live = all.find((x) => x.criterion === GC && !x.supersededAt);
    const old = all.find((x) => x.id === XL);
    const d1 = await pm.del("/api/references/" + live.id);
    assert.equal(d1.status, 409);
    assert.match(d1.body.error, /gate record/);
    assert.equal((await pm.del("/api/references/" + old.id)).status, 409);
    assert.equal((await pm.patch("/api/references/" + old.id, { ref: "rt365/ledger@abcdef9", version: old.version })).status, 409);
    /* The title is a display cache, not what is cited: corrected in place. */
    const t = await pm.patch("/api/references/" + live.id, { title: "Ledger build", version: live.version });
    assert.equal(t.status, 200, t.text);
    assert.equal((await links()).find((x) => x.id === live.id).title, "Ledger build");
  });

  test("through the contract: after the gate is marked done, a new ref is a new version too", async () => {
    const c1 = await pm.post("/api/criteria", { project: P, gate: GATE, text: "The artefact is the one tested" });
    assert.equal(c1.status, 201);
    const digestA = "sha256:" + "a".repeat(64), digestB = "sha256:" + "b".repeat(64);
    const made = await put("artefact-ledger", { project: P, criterion: c1.body.id, kind: "artefact", ref: digestA });
    assert.equal(made.status, 201, made.text);
    const inPlace = await put("artefact-ledger", { ref: digestB });
    assert.equal(inPlace.status, 200, "before the gate: corrected in place");
    assert.equal(inPlace.body.id, made.body.id);
    await query(`UPDATE milestone SET done = true WHERE project_id = $1 AND gate = $2`, [P, GATE]);
    const again = await put("artefact-ledger", { ref: digestA });
    assert.equal(again.status, 201, again.text);
    assert.equal(again.body.created, true);
    assert.equal(again.body.supersedes, made.body.id);
    const old = await one(`SELECT ext_id, superseded_at FROM ext_link WHERE id = $1`, [made.body.id]);
    assert.equal(old.ext_id, digestB, "the citation the gate passed on is kept as it was");
    assert.ok(old.superseded_at);
    /* The integration's id now names the live version: a re-push is idempotent on it. */
    const same = await put("artefact-ledger", { ref: digestA });
    assert.equal(same.status, 200);
    assert.equal(same.body.id, again.body.id);
  });
});

describe("D-36.14 · the contract's body is closed, and published", () => {
  test("an undeclared field is refused before anything is written", async () => {
    const n0 = await auditCount();
    const r = await put("fitadapt/app#17", { kind: "pull_request", ref: "fitadapt/app#17", state: "open", verified: true });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /does not accept "verified"/);
    assert.equal(await auditCount(), n0);
    assert.throws(() => assertKnownBody("references", { sha: "x" }), /does not accept/);
    assert.ok(WRITE_BODIES.references.stateAt === "date-time");
  });

  test("the published description declares the closed body, the scope and the never-fetched rule", async () => {
    const doc = (await c.get("/api/v1/openapi.json", { "X-API-Key": KEY })).body;
    const p = doc.paths["/api/v1/references/{externalId}"].put;
    assert.equal(p["x-required-scope"], "write:portfolio");
    const schema = p.requestBody.content["application/json"].schema;
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(WRITE_BODIES.references).sort());
    assert.match(p.description, /never fetches/);
    assert.ok(p.responses[200].content["application/json"].schema.properties.links);
  });
});

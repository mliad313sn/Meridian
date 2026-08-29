/**
 * V-12 · V-15 · V-16 — notifications, the evidence pack, the BI extract.
 *
 * Three ways the portfolio reaches past its own screen: it tells people
 * things, it hands an auditor one artifact, and it lets the group's own
 * reporting read it without retyping.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { sweep, queue, deliver } from "../src/notify.js";
import { many } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* ── V-12 · notifications ─────────────────────────────────────────── */

test("the sweep finds what is due and queues it once, however often it runs", async () => {
  const first = await sweep({ today: "2027-12-31" });
  assert.ok(first.considered > 0, "there is something to consider in the seeded book");
  const again = await sweep({ today: "2027-12-31" });
  assert.equal(again.queued, 0, "running it twice on the same day nags nobody twice");

  const rows = await many(`SELECT kind, state, email, dedupe_key FROM notification`);
  assert.ok(rows.length > 0, "something was queued");
  assert.ok(rows.every((r) => r.state === "queued"), "queueing is not sending");
  assert.ok(rows.every((r) => r.email), "and every message has somewhere to go");
});

test("an unconfigured instance says queued, never sent", async () => {
  const out = await deliver(undefined);
  assert.equal(out.sent, 0);
  assert.match(out.skipped, /no transport/);
  const [{ n }] = await many(`SELECT count(*)::int AS n FROM notification WHERE state = 'sent'`);
  assert.equal(n, 0, "nothing claims to have been sent");
});

test("a transport that works marks sent; one that throws marks failed and keeps the reason", async () => {
  await queue({ email: "a@example.com", kind: "digest", subject: "Week 40", body: "…",
    dedupeKey: "test:ok:1" });
  const ok = await deliver(async () => {}, { limit: 500 });
  assert.ok(ok.sent > 0);

  await queue({ email: "b@example.com", kind: "digest", subject: "Week 41", body: "…",
    dedupeKey: "test:bad:1" });
  const bad = await deliver(async () => { throw new Error("relay refused"); }, { limit: 500 });
  assert.equal(bad.failed, 1);
  const [row] = await many(`SELECT state, error FROM notification WHERE dedupe_key = 'test:bad:1'`);
  assert.equal(row.state, "failed");
  assert.match(row.error, /relay refused/);
});

test("the queue is readable from administration, and says whether a transport exists", async () => {
  const admin = await as("admin");
  const r = await admin.get("/api/admin/notifications");
  assert.equal(r.status, 200);
  assert.equal(r.body.transport, "none", "honest about having nowhere to send");
  assert.ok(r.body.counts.queued >= 0);
  assert.ok(r.body.notifications.length > 0);

  const pm = await as("siteGRU");
  assert.equal((await pm.get("/api/admin/notifications")).status, 403, "administration is admin-only");
});

/* ── V-15 · the evidence pack ─────────────────────────────────────── */

test("an auditor gets everything about one project as a single artifact", async () => {
  const admin = await as("admin");
  /* Give the trail something to hold: a fresh book has no history for
     this project, and a pack of nothing proves nothing. */
  const p = (await admin.get("/api/bootstrap")).body.db.projects.find(x => x.id === SITE_PROJECT_GRU);
  const rag = await admin.patch("/api/projects/" + SITE_PROJECT_GRU + "/health",
    { rag: "A", why: "Vendor slipped the integration test window", version: p.version });
  assert.equal(rag.status, 200, JSON.stringify(rag.body));

  const r = await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const md = r.body.markdown;
  for (const heading of ["# Evidence pack", "## Position", "## What was promised",
    "## Gate evidence", "## Change control", "## Risks and issues", "## The trail"]) {
    assert.ok(md.includes(heading), "the pack carries " + heading);
  }
  assert.match(md, /append-only/, "and says why the trail can be trusted");
  assert.ok(r.body.events > 0, "with the events counted");
});

test("the pack is bounded by 'as at', because that is the whole point", async () => {
  const admin = await as("admin");
  const now = await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  const then = await admin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence?asOf=2020-01-01");
  assert.equal(then.status, 200);
  assert.equal(then.body.events, 0, "nothing had happened in 2020");
  assert.ok(now.body.events > then.body.events);
  assert.match(then.body.markdown, /\*\*As at:\*\* 2020-01-01/);
});

test("the pack is scoped: a project you cannot see is not evidenced to you", async () => {
  const sin = await as("siteSIN");
  const r = await sin.get("/api/projects/" + SITE_PROJECT_GRU + "/evidence");
  assert.equal(r.status, 404, "invisible is invisible, in the evidence route too");
});

/* ── V-16 · the BI extract ────────────────────────────────────────── */

test("the dataset is one flat row per project, in the caller's scope", async () => {
  const admin = await as("admin");
  const r = await admin.get("/api/export/dataset");
  assert.equal(r.status, 200);
  assert.ok(r.body.rows.length > 0);
  const row = r.body.rows[0];
  for (const col of ["project_id", "programme", "site", "budget_m", "spi", "health",
    "benefits_promised", "plant_impact", "priority_score", "as_at"]) {
    assert.ok(col in row, "the extract carries " + col);
  }

  const site = await as("siteGRU");
  const theirs = await site.get("/api/export/dataset");
  assert.equal(theirs.status, 200);
  assert.ok(theirs.body.rows.length <= r.body.rows.length, "and never more than their scope");
});

test("the CSV quotes every field, so a comma in a project name stays one column", async () => {
  const admin = await as("admin");
  const r = await admin.get("/api/export/dataset?format=csv");
  assert.equal(r.status, 200);
  const text = String(r.text ?? r.body);
  const lines = text.replace(/^﻿/, "").split("\r\n");
  assert.ok(lines[0].startsWith("project_id,"), "a header row");
  assert.ok(lines[1].startsWith('"'), "and quoted cells");
  const cols = lines[0].split(",").length;
  const cells = (lines[1].match(/","/g) || []).length + 1;
  assert.equal(cells, cols, "every row has as many cells as the header has columns");
});

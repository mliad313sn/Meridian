/**
 * V-10 — French, completed on the server side.
 *
 * The client dictionary could never reach a refusal composed on the
 * server. What is TOLD is translated; what is RECORDED is not, because an
 * audit trail that changes language with the reader cannot be compared.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, client, SITE_PROJECT_GRU } from "./harness.js";
import { say, localeOf } from "../src/i18n.js";
import { many } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

test("the locale comes from the app's own toggle first, then the browser", () => {
  assert.equal(localeOf({ query: { lang: "fr" }, headers: {} }), "fr");
  assert.equal(localeOf({ query: {}, headers: { "x-lang": "fr" } }), "fr",
    "X-Lang, because a script may not set Accept-Language");
  assert.equal(localeOf({ query: {}, headers: { "accept-language": "fr-CI,fr;q=0.9" } }), "fr");
  assert.equal(localeOf({ query: { lang: "en" }, headers: { "x-lang": "fr" } }), "en",
    "an explicit choice beats the header");
  assert.equal(localeOf({ query: {}, headers: {} }), "en");
  assert.equal(localeOf(undefined), "en");
});

test("a missing translation degrades to English, never to a broken token", () => {
  assert.equal(say("read-only account", "fr"), "compte en lecture seule");
  assert.equal(say("read-only account", "en"), "read-only account");
  assert.equal(say("a string nobody has translated", "fr"), "a string nobody has translated");
  assert.equal(say(undefined, "fr"), undefined);
});

test("messages that carry data keep the data", () => {
  const en = "A gate override needs a reason — the committee has to be able to read it back";
  const fr = say(en, "fr");
  assert.match(fr, /^Une dérogation de jalon exige un motif/);
  assert.match(fr, /read it back$/, "the tail passes through untouched");
});

test("a refusal answers in the language the person chose", async () => {
  const pm = await as("siteGRU");
  const db = (await pm.get("/api/bootstrap")).body.db;
  const groupProject = db.projects.find((p) => p.governanceLevel === "group");
  assert.ok(groupProject, "the seeded book has a group project");

  const english = await pm.patch("/api/projects/" + groupProject.id,
    { name: "x", version: groupProject.version });
  assert.equal(english.status, 403);
  assert.match(english.body.error, /group-governed/);

  const french = await pm.patch("/api/projects/" + groupProject.id,
    { name: "x", version: groupProject.version }, { "x-lang": "fr" });
  assert.equal(french.status, 403);
  assert.match(french.body.error, /gouverné au niveau groupe/,
    "the same refusal, in French");
});

test("what was recorded stays in one language", async () => {
  const pm = await as("siteGRU");
  const db = (await pm.get("/api/bootstrap")).body.db;
  const p = db.projects.find((x) => x.id === SITE_PROJECT_GRU);
  const r = await pm.patch("/api/projects/" + SITE_PROJECT_GRU + "/health",
    { rag: "A", why: "Fenêtre d'essai décalée", version: p.version }, { "x-lang": "fr" });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  const rows = await many(
    `SELECT action FROM audit_event WHERE entity_id = $1 ORDER BY id DESC LIMIT 1`,
    [SITE_PROJECT_GRU]);
  assert.equal(rows[0].action, "Project status overridden",
    "the trail is written in one language whatever the reader speaks");
});

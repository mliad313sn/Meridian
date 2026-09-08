/**
 * REQ-32 · F12 IS THE GATE THE FIELD ASKED FOR, AND IT KNOWS WHERE IT STANDS.
 *
 * RT365's single recommendation was not a feature: *"a CI check fails when
 * any request marked `done` names files the default branch does not
 * contain."* The gate that answers it is only worth its exit code if the
 * exit code is right in four situations, and three of them cannot be
 * reproduced in this repository — you cannot make this checkout be a
 * shallow clone of somewhere else while the suite is running.
 *
 * So they are built: a throwaway git repository with its own default
 * branch, its own feature branch and its own register, with the gate
 * copied in and run against it, exactly as `fieldreturn.test.js` builds a
 * second field repository. Nothing here reaches the network — that is
 * also the property under test, because a gate that needs a fetch to
 * decide is a gate that goes green when the network is slow.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const GATE = "scripts/audit/register-reachable.mjs";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

/** Run the gate inside `cwd` and give back its exit code and what it printed. */
function gate(cwd, { args = [], env = {} } = {}) {
  try {
    const out = execFileSync(process.execPath, [GATE, ...args],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

const register = (requests) => JSON.stringify({
  $schema: "meridian-request-register/1",
  source: { repository: "example/field", contact: "field" },
  productOwner: "test",
  registerVersion: 1,
  requests,
}, null, 2);

/** A repository whose default branch is `main`, carrying one done request. */
function build() {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "f12-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.test");
  git(dir, "config", "user.name", "T");
  fs.mkdirSync(path.join(dir, "scripts/audit"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs/requests"), { recursive: true });
  fs.mkdirSync(path.join(dir, "server/src"), { recursive: true });
  fs.copyFileSync(path.join(root, GATE), path.join(dir, GATE));
  fs.writeFileSync(path.join(dir, "server/src/on-main.js"), "// shipped\n");
  fs.writeFileSync(path.join(dir, "docs/requests/field.json"), register([
    { id: "REQ-01", title: "on the default branch", status: "done", delivered: ["server/src/on-main.js"] },
  ]));
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "the default branch");
  return dir;
}

/** Branch off `main`, add a file, and mark a request done that names it. */
function aheadOfMain(dir) {
  git(dir, "checkout", "-q", "-b", "work");
  fs.writeFileSync(path.join(dir, "server/src/only-on-branch.js"), "// built, unmerged\n");
  fs.writeFileSync(path.join(dir, "docs/requests/field.json"), register([
    { id: "REQ-01", title: "on the default branch", status: "done", delivered: ["server/src/on-main.js"] },
    { id: "REQ-02", title: "built, not merged", status: "done", delivered: ["server/src/only-on-branch.js"] },
    { id: "REQ-03", title: "still open", status: "open", delivered: ["server/src/never-written.js"] },
  ]));
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "the work");
}

describe("F12 · what the register calls done, an adopter can reach (REQ-32)", () => {
  test("on the default branch, a register whose done requests are all present passes", () => {
    const dir = build();
    const r = gate(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /0 unreachable claim\(s\)/);
    assert.match(r.out, /it IS the default branch/);
  });

  /* RT365's criterion, stated as a test: this is the failure they asked
     for, and `main` today is exactly this shape. */
  test("on the default branch, a done request naming a file that is not there FAILS", () => {
    const dir = build();
    fs.rmSync(path.join(dir, "server/src/on-main.js"));
    git(dir, "commit", "-aqm", "delete the thing the register says was delivered");
    const r = gate(dir);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /1 unreachable claim\(s\)/);
    assert.match(r.out, /server\/src\/on-main\.js/);
  });

  /* A branch is allowed to be ahead — but never quietly. */
  test("on a branch ahead of the default branch, the gap is counted and named, and does not fail", () => {
    const dir = build();
    aheadOfMain(dir);
    const r = gate(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /0 unreachable claim\(s\), 1 owed to main/);
    assert.match(r.out, /only-on-branch\.js/);
    assert.match(r.out, /1 commit\(s\) behind this branch/);
  });

  test("--strict turns that same gap into a failure, from the branch", () => {
    const dir = build();
    aheadOfMain(dir);
    const r = gate(dir, { args: ["--strict"] });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /1 unreachable claim\(s\)/);
  });

  /* v5.10.0 was tagged on a commit the default branch did not carry, and
     the register still reads `released: false` on every line. A tag build
     is strict without being asked, so that cannot happen quietly again. */
  test("a tag build is strict without being asked", () => {
    const dir = build();
    aheadOfMain(dir);
    const r = gate(dir, { env: { GITHUB_REF_TYPE: "tag" } });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /verdict:\s+strict — this is a tag build/);
  });

  test("a request that is not done is not held to the default branch", () => {
    const dir = build();
    aheadOfMain(dir);
    const r = gate(dir);
    assert.doesNotMatch(r.out, /never-written\.js/, "REQ-03 is open; the gate must not judge it");
  });

  /* A file named by no tree at all is a false claim wherever it is read,
     so it fails on the branch too — the one thing that is not merge debt. */
  test("a done request naming a file that exists nowhere fails even from a branch", () => {
    const dir = build();
    aheadOfMain(dir);
    const reg = JSON.parse(fs.readFileSync(path.join(dir, "docs/requests/field.json"), "utf8"));
    reg.requests[1].delivered.push("server/src/imaginary.js");
    fs.writeFileSync(path.join(dir, "docs/requests/field.json"), JSON.stringify(reg, null, 2));
    const r = gate(dir);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /carried by no tree/);
    assert.match(r.out, /imaginary\.js/);
  });

  /* The rule that makes this gate worth having: it never reports a clean
     default branch it could not read. Exit 2, not 0, and not 1. */
  test("when the default branch cannot be reached, it exits 2 and says it compared nothing", () => {
    const dir = build();
    aheadOfMain(dir);
    git(dir, "branch", "-D", "main");
    const r = gate(dir, { env: { GITHUB_BASE_REF: "", GITHUB_REF_NAME: "" } });
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /compared against: NOTHING/);
    assert.match(r.out, /this is not a pass/);
  });

  test("it always says which ref it compared against and how it found it", () => {
    const dir = build();
    aheadOfMain(dir);
    const r = gate(dir, { env: { MERIDIAN_DEFAULT_BRANCH: "main" } });
    assert.match(r.out, /resolved by:\s+MERIDIAN_DEFAULT_BRANCH=main/);
  });

  /* delivered/measure are prose. A route, a placeholder or a column name
     must never be read as a path claim, or the gate cries wolf. */
  test("prose in delivered is counted as prose, not failed as a missing file", () => {
    const dir = build();
    fs.writeFileSync(path.join(dir, "docs/requests/field.json"), register([
      {
        id: "REQ-01", title: "prose", status: "done",
        delivered: ["PUT /api/v1/benefits/{externalId}", "17 files", "raid_item.cr_id",
          "server/src/on-main.js (the guard)"],
        measure: "F4 browser walk",
      },
    ]));
    git(dir, "commit", "-aqm", "prose");
    const r = gate(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /1 path claim\(s\), 4 entr\(y\/ies\) held no path/);
  });

  /* The live register, held to the branch this suite is running on. It
     must not be able to name a file that exists in no tree at all. */
  test("the live register names no file that no tree carries", () => {
    const r = gate(root);
    assert.doesNotMatch(r.out, /carried by no tree/, r.out);
    assert.ok(r.code === 0 || r.code === 2, `unexpected exit ${r.code}:\n${r.out}`);
  });
});

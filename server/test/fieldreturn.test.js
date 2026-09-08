/**
 * V-12 · THE FIELD-RETURN LOOP IS A PATTERN, NOT AN ANECDOTE (RT365, REQ-31).
 *
 * The loop that turned a real programme's findings into a release in a day
 * was one script with one repository's register path and one repository's
 * id vocabulary compiled into it. RT365 asked for the capability to be
 * publishable: a schema for `meridian-request-register/1`, a review that
 * reads its configuration, and a SECOND field repository reviewed end to
 * end with no code that knows its name.
 *
 * That second repository is built here — a git repository in a temporary
 * directory, with its own ledger ids (`ANV-nnn`, `RISK-nn`, `DEC-nnn`) and
 * its own register — and reviewed by the same command the Product Owner
 * runs. Nothing in this file reaches the network: the field repository is
 * a path on disk, which is also the only way a test may talk to a forge.
 *
 * The last group holds E-9: `accepted: false` and `accepted: null` are two
 * different statements, and the register must not be able to confuse them.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validate } from "../../scripts/lib/jsonschema.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "docs/requests/register.schema.json"), "utf8"));
const live = JSON.parse(fs.readFileSync(path.join(root, "docs/requests/rt365.json"), "utf8"));

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

/** Run the review as the Product Owner runs it, and give back what it printed. */
function reviewCli(args) {
  const r = execFileSync(process.execPath, [path.join(root, "scripts/field-review.mjs"), ...args],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { code: 0, out: r, err: "" };
}
function reviewCliFailing(args) {
  try { return reviewCli(args); }
  catch (e) { return { code: e.status, out: e.stdout ?? "", err: e.stderr ?? "" }; }
}

/**
 * A second field repository: another programme, another ledger vocabulary,
 * two branches — and its Meridian material on the branch that is not the
 * default one, because that is where it always is.
 */
function fixtureFieldRepository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-field-"));
  const write = (rel, text) => {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  const commit = (message) => {
    git(dir, "add", "-A");
    git(dir, "-c", "user.email=field@anvil.example", "-c", "user.name=Anvil Works",
        "commit", "--quiet", "-m", message);
    return git(dir, "rev-parse", "--short", "HEAD").trim();
  };

  git(dir, "init", "--quiet");
  git(dir, "symbolic-ref", "HEAD", "refs/heads/main");
  write("README.md", "# Anvil Works — plant renewal programme\n\nNo tooling named here.\n");
  write("docs/ASSESSMENT.md", [
    "# What we found in Meridian",
    "",
    "- ANV-101 — Meridian refuses a closure without a benefits owner; keep it.",
    "- ANV-102 — Meridian cannot import our cost book, and we have said so.",
    "- DEC-401 — we decided to run Meridian beside the ERP for one quarter (Meridian).",
    "- M-01 — a finding of ANOTHER field repository, quoted here about Meridian.",
    "",
  ].join("\n"));
  const first = commit("the assessment");

  git(dir, "checkout", "--quiet", "-b", "field/second-round");
  write("docs/RISKS.md", [
    "# Risk log",
    "",
    "| id | risk |",
    "| RISK-07 | Meridian has no offline agenda for the satellite site |",
    "| RISK-08 | unrelated to the tool |",
    "",
  ].join("\n"));
  write("docs/notes.md", "A page about Meridian that carries no ledger id at all.\n");
  commit("the second round");
  git(dir, "checkout", "--quiet", "main");
  return { dir, first };
}

/** The register that second repository files, in the published shape. */
function fixtureRegister({ repoDir, commit, origins }) {
  return {
    $schema: "meridian-request-register/1",
    source: {
      repository: "anvil-works/anvil-field",
      remote: repoDir,
      branch: "field/second-round",
      commit,
      documents: ["docs/ASSESSMENT.md", "docs/RISKS.md"],
      reviewedAt: "2026-09-08",
      vocabulary: {
        request: ["ANV-\\d{3}", "RISK-\\d{2}"],
        context: ["DEC-\\d{3}"],
        note: "Anvil Works ledger ids — nothing to do with RT365's M/I/O/H.",
      },
    },
    productOwner: { charter: "docs/33-retour-terrain-rt365.md#1", lastRun: "2026-09-08" },
    channel: {
      issues: "https://example.invalid/anvil/issues",
      rule: "one issue per request; the Product Owner answers on the issue",
      acceptance: {
        done: "on the branch with its test",
        accepted: "the requester said so on the issue",
        notAccepted: "the requester can answer and has not",
        cannotAnswerYet: "nothing to try yet, or not adopted",
        released: "a version tag carries it",
      },
    },
    registerVersion: 1,
    requests: [{
      id: "REQ-01",
      origin: origins,
      title: "Closure refuses to complete without a named benefits owner",
      status: "done",
      version: "5.11.0",
      decidedOn: "2026-09-08",
      delivered: ["server/src/routes/portfolio.js"],
      measure: "server/test/value.test.js",
      remaining: null,
      issue: null,
      accepted: false,
      released: false,
      history: [{ at: "2026-09-08", registerVersion: 1, status: "done" }],
    }],
  };
}

describe("V-12 · a second field repository is reviewed end to end, with no code that knows its name", () => {
  test("the review reads the register's own vocabulary and names what the register does not carry", () => {
    const { dir, first } = fixtureFieldRepository();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-register-"));
    const file = path.join(work, "anvil.json");
    fs.writeFileSync(file, JSON.stringify(
      fixtureRegister({ repoDir: dir, commit: first, origins: ["ANV-101"] }), null, 2));

    const { code, out } = reviewCliFailing(["--register", file]);

    assert.equal(code, 1, "a line that is not in the register is a finding, and the exit code says so");
    assert.match(out, /anvil-works\/anvil-field · 2 branch\(es\)/, "every branch is read, not the default one");
    assert.match(out, /ANV-\\d\{3\}\s+RISK-\\d\{2\}/, "the vocabulary printed is the register's own");
    assert.match(out, /ANV-102/, "an id on the default branch that the register does not carry");
    assert.match(out, /RISK-07/, "an id on the OTHER branch — the material is never on the default one");
    assert.doesNotMatch(out, /ANV-101\s+\(/, "an id the register already carries is not re-raised");
    assert.doesNotMatch(out, /RISK-08/, "a line that does not name Meridian is not this loop's business");
    assert.doesNotMatch(out, /\bM-01\b/,
      "RT365's vocabulary is RT365's: another field's ids are invisible unless this register declares them");
    assert.match(out, /for context \(1\)[\s\S]*DEC-401/, "decisions are listed for the reader, never counted as missing");
    assert.match(out, /file\(s\) changed since [0-9a-f]{7}[\s\S]*docs\/notes\.md/,
      "a request may carry no id at all: the changed files that name Meridian are listed to be read");
    assert.match(out, /field\/second-round moved/, "the branch is ahead of the commit the register was read at");

    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  });

  test("a register that carries every line reviews clean, and says so", () => {
    const { dir, first } = fixtureFieldRepository();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-register-"));
    const file = path.join(work, "anvil.json");
    fs.writeFileSync(file, JSON.stringify(
      fixtureRegister({ repoDir: dir, commit: first, origins: ["ANV-101", "ANV-102", "RISK-07"] }), null, 2));

    const { code, out } = reviewCliFailing(["--register", file]);
    assert.equal(code, 0, "nothing new is a complete round, not a failed one");
    assert.match(out, /every line that names Meridian with a declared id is in/);

    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  });

  test("the id vocabulary can also come from the command line, and a register without one is refused by name", () => {
    const { dir, first } = fixtureFieldRepository();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-register-"));
    const register = fixtureRegister({ repoDir: dir, commit: first, origins: ["ANV-101"] });
    delete register.source.vocabulary;
    const file = path.join(work, "anvil.json");
    fs.writeFileSync(file, JSON.stringify(register, null, 2));

    const bare = reviewCliFailing(["--register", file]);
    assert.equal(bare.code, 2);
    assert.match(bare.err, /no id vocabulary/, "a review with nothing to look for says so instead of reporting silence");

    const told = reviewCliFailing(["--register", file, "--vocabulary", "RISK-\\d{2}"]);
    assert.equal(told.code, 1);
    assert.match(told.out, /RISK-07/);
    assert.doesNotMatch(told.out, /ANV-102/, "the vocabulary given is the vocabulary used");

    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  });

  test("a register that does not match the published shape is refused before the clone", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-register-"));
    const register = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: [] });
    register.requests[0].accepted = "no";
    const file = path.join(work, "anvil.json");
    fs.writeFileSync(file, JSON.stringify(register, null, 2));

    const { code, err } = reviewCliFailing(["--register", file]);
    assert.equal(code, 2);
    assert.match(err, /does not match meridian-request-register\/1/);
    assert.match(err, /register-schema\.mjs/, "the refusal names the gate that explains it");

    fs.rmSync(work, { recursive: true, force: true });
  });

  test("the command RT365 has written down still works, and still reviews RT365's register", () => {
    /* Pointed at a path that does not exist: the shim must reach the clone
       step under RT365's own name, which proves it passed the register on,
       without this test ever touching a network. */
    let result;
    try {
      execFileSync(process.execPath, [path.join(root, "scripts/rt365-review.mjs"),
        "--remote", "/nonexistent/anvil.git"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      result = { code: 0, err: "" };
    } catch (e) { result = { code: e.status, err: e.stderr ?? "" }; }

    assert.equal(result.code, 2);
    assert.match(result.err, /cannot reach mliad313sn\/RT365 at \/nonexistent\/anvil\.git/);
  });
});

describe("V-12 · meridian-request-register/1 is a published shape, and the live register meets it", () => {
  test("the schema is the one the gate and the review both read", () => {
    assert.equal(schema.$id, "meridian-request-register/1");
    assert.equal(live.$schema, schema.$id);
  });

  test("the live register validates, with its 31 requests", () => {
    const problems = validate(schema, live);
    assert.deepEqual(problems, [], "docs/requests/rt365.json must match the shape it publishes");
    assert.ok(live.requests.length >= 31);
  });

  test("a fixture register from another programme validates against the same schema", () => {
    const register = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: ["ANV-101"] });
    assert.deepEqual(validate(schema, register), []);
  });

  test("the shape refuses what a register must not say", () => {
    const bad = (mutate) => {
      const r = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: [] });
      mutate(r);
      return validate(schema, r);
    };
    assert.ok(bad((r) => { delete r.requests[0].measure; }).length, "a required field cannot be dropped");
    assert.ok(bad((r) => { r.requests[0].status = "in progress"; }).length, "a status outside the vocabulary");
    assert.ok(bad((r) => { r.requests[0].accepted = "yes"; }).length, "accepted is true, false or null");
    assert.ok(bad((r) => { r.requests[0].history = []; }).length, "a request has at least one round in its history");
    assert.ok(bad((r) => { r.registerVersion = 0; }).length, "a register version starts at one");
    assert.ok(bad((r) => { r.source.commit = "not-a-sha"; }).length, "the commit read is a commit");
    assert.ok(bad((r) => { r.requests[0].released = true; r.requests[0].version = null; }).length,
      "a released line names the version that carries it");
  });

  test("the field repository's own additive columns are allowed, not forbidden", () => {
    const register = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: [] });
    register.requests[0].priority = "high";
    register.requests[0].effort = "S";
    register.requests[0].category = "interoperability";     // one nobody has proposed yet
    assert.deepEqual(validate(schema, register), [],
      "a reader that ignores priority, effort or a column of their own loses nothing");
    register.requests[0].priority = "urgent";
    assert.ok(validate(schema, register).length, "but a column with a vocabulary keeps it");
  });
});

describe("E-9 · a silent requester and a blocked one are not the same register entry", () => {
  test("the register carries both false and null, and the difference is written down in it", () => {
    const notAccepted = live.requests.filter((r) => r.accepted === false);
    const cannotAnswer = live.requests.filter((r) => r.accepted === null);
    assert.ok(notAccepted.length, "a line the requester could answer and has not");
    assert.ok(cannotAnswer.length, "a line the requester cannot answer yet");
    assert.ok(live.channel.acceptance.notAccepted, "channel.acceptance says what false means");
    assert.ok(live.channel.acceptance.cannotAnswerYet, "and what null means");
  });

  test("nothing delivered cannot be a silence: an open line is null, never false", () => {
    for (const r of live.requests.filter((r) => r.status === "open")) {
      assert.equal(r.accepted, null, `${r.id} is open — there is nothing for the requester to accept`);
    }
    const open = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: [] });
    open.requests[0].status = "open";
    open.requests[0].accepted = false;
    assert.ok(validate(schema, open).length, "and the schema refuses it, so a round cannot re-introduce it");
    open.requests[0].accepted = null;
    assert.deepEqual(validate(schema, open), []);
  });

  test("accepted stays three-valued: true is still sayable", () => {
    const r = fixtureRegister({ repoDir: "/nonexistent", commit: "0000000", origins: [] });
    r.requests[0].accepted = true;
    assert.deepEqual(validate(schema, r), []);
  });
});

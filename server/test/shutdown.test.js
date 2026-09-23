/**
 * NEW-09 (docs/36) — on SIGTERM the book is closed before the process
 * leaves.
 *
 * `claimBook` (db.js) answered SIGINT/SIGTERM with an immediate
 * `process.exit(0)`. It is registered when the book is opened — before the
 * server's own orderly stop (index.js: stop listening, then close the
 * database) — so it ran first and the process died with PGlite never
 * closed. Measured while walking the manual (C-04).
 *
 * What this does NOT claim: PGlite 0.2.x leaves `postmaster.pid` and its
 * socket lock in the directory even after a clean close (measured on
 * 23/09), which is why `clearStaleLocks` exists; that message at start is
 * the engine's, not this defect.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* A process that opens a book the way the server does, answers SIGTERM
   the way index.js does (close the database, then exit), and says which
   of the two it reached. */
const CHILD = `
  import { connect, close } from ${JSON.stringify(new URL("../src/db.js", import.meta.url).href)};
  await connect({ url: null, dataDir: process.env.DIR });
  process.on("SIGTERM", async () => { await close(); console.log("CLOSED"); process.exit(0); });
  console.log("READY");
  setInterval(() => {}, 1000);
`;

function run(sig) {
  const dir = mkdtempSync(join(tmpdir(), "meridian-sig-"));
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", CHILD], {
      env: { ...process.env, DIR: dir, DATABASE_URL: "" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (b) => {
      out += b;
      if (out.includes("READY") && !p.signalled) { p.signalled = true; p.kill(sig); }
    });
    p.stderr.on("data", (b) => { out += b; });
    p.on("exit", (code) => { rmSync(dir, { recursive: true, force: true }); resolve({ code, out }); });
    p.on("error", reject);
    setTimeout(() => { p.kill("SIGKILL"); reject(new Error("timed out: " + out)); }, 60000).unref();
  });
}

test("SIGTERM reaches the orderly stop: the book is closed before the process exits", async () => {
  const { code, out } = await run("SIGTERM");
  assert.equal(code, 0, out);
  assert.match(out, /CLOSED/, "the owner of the signal closed the book; nobody exited under it");
});

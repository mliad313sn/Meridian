/**
 * `npm run dev` — the one-command start the README promises (I-1 · M-03).
 *
 * The first hour on a fresh clone used to end at "Cannot GET /": the
 * server served the built client only when `web/dist` existed, and
 * nothing had built it. This starts the server after building the client
 * when — and only when — it is missing. A developer who already runs
 * `npm run dev:web` (Vite with hot reload, proxying /api here) is not
 * slowed down: an existing build is left alone.
 *
 *   npm run dev              build if missing, then start
 *   npm run dev -- --build   rebuild first, then start
 */

import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const index = join(ROOT, "web", "dist", "index.html");
const force = process.argv.includes("--build");

if (force || !existsSync(index)) {
  console.log(force ? "  building the client (--build)…" : "  web/dist is missing — building the client once…");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["run", "build"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("  the client did not build; the server will still answer /api/*");
  }
}

const child = spawn(process.execPath, [join(ROOT, "server", "src", "index.js")],
  { cwd: ROOT, stdio: "inherit", env: process.env });
/* A graceful stop is the whole point of restart.sh: pass the signal on
   so PGlite flushes, rather than orphaning the child. */
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));

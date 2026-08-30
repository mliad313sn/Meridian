/**
 * Build the packaged Windows distribution.
 *
 *   dist/Meridian/
 *     Meridian.exe           the whole server in one file (Node SEA)
 *     MeridianService.exe    the service wrapper (winsw) + its XML
 *     web/                   the built client
 *     migrations/            the .sql files the app applies at boot
 *     meridian.config.json   the one file an administrator edits
 *     Install-Service.cmd    registers and starts the service (elevated)
 *     Uninstall-Service.cmd  stops and removes it (elevated)
 *
 * Nothing here needs a compiler or a third-party installer toolchain:
 * esbuild flattens the ESM tree into one CommonJS file, Node's own
 * single-executable support injects it into a copy of node.exe, and the
 * service wrapper is the winsw binary that ships inside node-windows.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync, writeFileSync, copyFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { inject } from "postject";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const WORK = join(ROOT, "dist", ".build");
const OUT = join(ROOT, "dist", "Meridian");

const SERVICE_ID = "MeridianITPMO";
const SERVICE_NAME = "Meridian IT-PMO";
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const step = (n) => console.log("  " + n);

rmSync(join(ROOT, "dist", "Meridian"), { recursive: true, force: true });
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

/* ── 1 · the client ───────────────────────────────────────────────── */
step("building the client");
/* vite's own entry rather than `npm run build`: Node 24 refuses to spawn
   a .cmd without a shell, and there is no reason to involve one. */
execFileSync(process.execPath,
  [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--config", "web/vite.config.js"],
  { cwd: ROOT, stdio: "inherit" });

/* ── 2 · one CommonJS file ────────────────────────────────────────── */
step("bundling the server");
const bundle = join(WORK, "meridian.cjs");
await build({
  entryPoints: [join(HERE, "sea-entry.mjs")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  legalComments: "none",
  /* PGlite is the development engine and carries a WASM build of
     PostgreSQL; a packaged service runs against a real cluster, so it
     stays out of the executable. The two pg extras are optional
     requires that only a native/Workers deployment ever resolves. */
  external: ["@electric-sql/pglite", "pg-native", "pg-cloudflare", "cloudflare:sockets"],
  /* CommonJS has no import.meta, and esbuild would leave it empty — which
     turns `fileURLToPath(import.meta.url)` into a crash on the first line
     of db.js. Inside a single executable __filename is the .exe itself,
     which is exactly the anchor those paths want. */
  /* NODE_ENV is deliberately NOT baked in: it decides the cookie's Secure
     flag at run time, and a build-time constant would take that decision
     away from whoever deploys this. sea-entry sets it instead. */
  define: { "import.meta.url": "__meridian_module_url" },
  banner: {
    js: "const __meridian_module_url = require('node:url').pathToFileURL(__filename).href;",
  },
});

/* ── 3 · the single executable ────────────────────────────────────── */
step("preparing the SEA blob");
const seaConfig = join(WORK, "sea-config.json");
writeFileSync(seaConfig, JSON.stringify({
  main: bundle,
  output: join(WORK, "meridian.blob"),
  disableExperimentalSEAWarning: true,
}, null, 2));
execFileSync(process.execPath, ["--experimental-sea-config", seaConfig], { stdio: "inherit" });

step("injecting it into a copy of node.exe");
const exe = join(OUT, "Meridian.exe");
copyFileSync(process.execPath, exe);
await inject(exe, "NODE_SEA_BLOB", readFileSync(join(WORK, "meridian.blob")), {
  sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
});

/* ── 4 · everything that stays on disk beside it ──────────────────── */
step("copying the client, the migrations and the service wrapper");
cpSync(join(ROOT, "web", "dist"), join(OUT, "web"), { recursive: true });
cpSync(join(ROOT, "server", "migrations"), join(OUT, "migrations"), { recursive: true });

/* The database prerequisite, handled by the installer rather than by a
   page of instructions: find PostgreSQL, install it if it is missing and
   the network allows, create the role and the book with a password nobody
   had to choose — and fall back to the embedded engine rather than fail
   half-way. See scripts/package/prepare-db.ps1. */
copyFileSync(join(ROOT, "scripts", "package", "prepare-db.ps1"), join(OUT, "prepare-db.ps1"));

const winsw = join(ROOT, "node_modules", "node-windows", "bin", "winsw", "winsw.exe");
if (!existsSync(winsw)) throw new Error("winsw.exe not found — run npm install first");
copyFileSync(winsw, join(OUT, "MeridianService.exe"));
/* winsw is a .NET 2.0 assembly, and .NET 3.5 is off by default on Windows
   10/11. Its .exe.config is what lets the v4 runtime host it — without
   the file the wrapper dies with 0x80131700 before it reads any XML, and
   "install" returns without registering anything. The runtime finds the
   file by the EXECUTABLE's name, so it is renamed alongside it. */
copyFileSync(winsw + ".config", join(OUT, "MeridianService.exe.config"));

/* A TEMPLATE, not the final XML. This build of winsw expands %BASE% to
   the wrapper's full FILE path rather than its directory, which turns
   every path into C:\\...\\MeridianService.exe\\logs and the service dies
   before it logs why. The install scripts write the real directory in,
   so the package still relocates — the substitution just happens when
   the folder's location is actually known. */
writeFileSync(join(OUT, "MeridianService.template.xml"), `<service>
  <id>${SERVICE_ID}</id>
  <name>${SERVICE_NAME}</name>
  <description>Meridian group IT-PMO — multi-site project portfolio management (v${pkg.version}).</description>
  <executable>__HOME__\\Meridian.exe</executable>
  <workingdirectory>__HOME__</workingdirectory>
  <startmode>Automatic</startmode>
  <!-- PostgreSQL may still be starting when Windows starts us — but only
       if there IS one. The installer writes the service it actually found
       (or removes the line entirely when the book runs on the embedded
       engine): a dependency on a service that does not exist stops the
       whole thing from starting, which is a strange way to fail. -->
  __PGDEP__
  <logpath>__HOME__\\logs</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <!-- A crash is answered by a restart, then a slower one; a service that
       gives up silently is worse than one that is plainly down. -->
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="60 sec"/>
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
</service>
`);

/* No DATABASE_URL here on purpose (S-11). The package used to ship
   postgres:postgres — the most-guessed credential there is, and superuser
   over the whole cluster. prepare-db.ps1 writes the real connection at
   install time, with a password nobody had to choose. */
writeFileSync(join(OUT, "meridian.config.json"), JSON.stringify({
  PORT: 4173,
  /* "1" once this is served over HTTPS. Left off while it speaks plain
     HTTP, because a Secure cookie on http:// is dropped by the browser
     and every sign-in silently produces an anonymous session. */
  MERIDIAN_SECURE_COOKIES: "0",
  /* P-02 — /api/health answers with this, so a report from a site can be
     tied to a build instead of to a memory of one. */
  MERIDIAN_VERSION: pkg.version,
}, null, 2) + "\n");

/* ── 5 · the two administrator commands ───────────────────────────── */
/* /quiet everywhere an administrator might want this scripted rather than
   double-clicked; without it the scripts still wait, so a window that
   closes never takes its error message with it. */
const preamble = `setlocal
cd /d "%~dp0"
rem This folder, without the trailing backslash %~dp0 carries — it goes
rem into an XML path where a stray one reads badly.
set "HOME_DIR=%~dp0"
if "%HOME_DIR:~-1%"=="\\" set "HOME_DIR=%HOME_DIR:~0,-1%"
set "QUIET="
if /i "%~1"=="/quiet" set "QUIET=1"
>nul 2>&1 net session || (
  echo This needs an elevated prompt — right-click and "Run as administrator".
  if not defined QUIET pause
  exit /b 1
)`;

/* Both scripts resolve the template the same way; keeping the line in one
   place stops the two copies drifting apart. */
const writeXml = (home) =>
  `powershell -NoProfile -ExecutionPolicy Bypass -Command ` +
  `"(Get-Content '${home}\\MeridianService.template.xml' -Raw).Replace('__HOME__','${home}')` +
  ` | Set-Content -Encoding UTF8 '${home}\\MeridianService.xml'"`;

writeFileSync(join(OUT, "Install-Service.cmd"), `@echo off
${preamble}

rem The wrapper opens its log file without creating the directory.
if not exist "%HOME_DIR%\\logs" mkdir "%HOME_DIR%\\logs"

echo Pointing the service at this folder...
${writeXml("%HOME_DIR%")}
if %errorlevel% neq 0 goto :failed

echo Installing the ${SERVICE_NAME} service...
"%~dp0MeridianService.exe" install || goto :failed
sc query ${SERVICE_ID} >nul 2>&1 || goto :failed
sc failure ${SERVICE_ID} reset= 3600 actions= restart/10000/restart/60000/restart/120000 >nul
echo Starting...
"%~dp0MeridianService.exe" start || goto :failed
rem "start" returns before the service manager reports RUNNING.
set "TRIES=0"
:waitrunning
sc query ${SERVICE_ID} | find "RUNNING" >nul
if %errorlevel% equ 0 goto :running
set /a TRIES+=1
if %TRIES% geq 15 goto :failed
ping -n 3 127.0.0.1 >nul
goto :waitrunning
:running
echo.
echo Installed and running. The portfolio is at http://localhost:4173
echo Logs are in "%~dp0logs".
if not defined QUIET pause
exit /b 0

:failed
echo.
echo That did not complete. Check "%~dp0logs" and meridian.config.json.
if not defined QUIET pause
exit /b 1
`);

writeFileSync(join(OUT, "Uninstall-Service.cmd"), `@echo off
${preamble}

"%~dp0MeridianService.exe" stop
"%~dp0MeridianService.exe" uninstall
echo.
echo Removed. The files in this folder, and the database, are untouched.
if not defined QUIET pause
`);

writeFileSync(join(OUT, "README-INSTALL.txt"), `Meridian IT-PMO ${pkg.version} — Windows service
==================================================

Before installing
-----------------
Nothing. The installer handles its own prerequisites.

  · Node.js is not required — Meridian.exe carries its own runtime.
  · PostgreSQL is found if it is already there; installed from the
    official binaries if it is not and the network allows; and if neither
    is possible, the book runs on the embedded engine (PGlite — the same
    PostgreSQL, compiled to WebAssembly). The installer says which of the
    three it did.
  · The database, its role and its password are created for you. Nobody
    types a password, and none ships in this package.

The one thing worth deciding afterwards: set MERIDIAN_SECURE_COOKIES to
"1" once Meridian is served over HTTPS. On plain HTTP a Secure cookie is
dropped by the browser and every sign-in quietly produces an anonymous
session, so it stays off until TLS is really in front.

Installing
----------
Right-click Install-Service.cmd and choose "Run as administrator".
The service registers as "${SERVICE_NAME}", starts immediately, and comes
back up with Windows. Migrations are applied automatically at every start,
so an upgrade is: stop, replace the files, start.

Installing without a network
----------------------------
   powershell -ExecutionPolicy Bypass -File prepare-db.ps1 -NoDownload
then Install-Service.cmd. The book runs on the embedded engine, and
DATABASE_URL can be filled in later — the service reads it at start.

Where the configuration lives
-----------------------------
meridian.config.json, written by the installer and kept across upgrades.
It holds the connection string with a generated password, so the folder
is locked down to Administrators and SYSTEM at install time.

Using it
--------
   http://localhost:4173

Running it in a console instead
------------------------------
Meridian.exe runs the same server in the foreground — useful for reading
a start-up failure directly. Ctrl-C stops it.

Where things are
----------------
   meridian.config.json   DATABASE_URL and PORT
   logs\\                  service output, rolled at 10 MB, 8 kept
   migrations\\            applied in order at start-up
   web\\                   the built client

Removing it
-----------
Right-click Uninstall-Service.cmd and choose "Run as administrator".
Neither the database nor this folder is deleted.
`);

/* ── done ─────────────────────────────────────────────────────────── */
const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(1) + " MB";
console.log(`\n  Meridian.exe   ${mb(exe)}`);
console.log(`  package        ${OUT}\n`);

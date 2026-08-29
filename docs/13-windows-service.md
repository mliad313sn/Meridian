# Shipping Meridian as a Windows service

Date: 2026-08-29 · `npm run package:installer` produces two artifacts in
`dist/`, and the machine at `C:\Apps\Meridian` runs the result as the
`MeridianITPMO` service.

## What gets built

| Artifact | What it is |
|---|---|
| `dist/Meridian/Meridian.exe` | The whole server in one 89 MB file — esbuild flattens the ESM tree to CommonJS, Node's single-executable support injects it into a copy of `node.exe`. No Node runtime needed on the target. |
| `dist/Meridian/` | That exe plus `web/`, `migrations/`, the winsw wrapper, `meridian.config.json` and the two administrator scripts. |
| `dist/MeridianSetup.exe` | A 33 MB setup executable built with IExpress, which ships with Windows. Self-elevates, unpacks to `C:\Apps\Meridian`, registers and starts the service. |

Nothing in the chain needs a compiler, a code-signing certificate or a
third-party installer toolchain.

## The service

Registered as `MeridianITPMO` ("Meridian IT-PMO"), running as LocalSystem,
start type Automatic, dependent on `postgresql-x64-17` so a reboot does
not race the database. Failure actions restart it after 10 s, then 60 s,
then 120 s, with the count resetting hourly. Output goes to
`C:\Apps\Meridian\logs`, rolled at 10 MB, eight kept.

Re-running the setup is the upgrade path: it stops the service, replaces
the files, **keeps the existing `meridian.config.json`**, and starts it
again. Both scripts take `/quiet` for unattended use; without it they wait
for a keypress, so a failure message never disappears with the window.

## Configuration

`C:\Apps\Meridian\meridian.config.json` is the whole of it. A real
environment variable always beats the file, so the service or a shell can
override anything without editing it.

```json
{
  "DATABASE_URL": "postgresql://…/meridian_standalone",
  "PORT": 4173,
  "MERIDIAN_SECURE_COOKIES": "0"
}
```

Set `MERIDIAN_SECURE_COOKIES` to `"1"` only once Meridian is served over
HTTPS — see the note below.

## What packaging exposed, and the fixes

Five defects, each of which produced a working-looking failure:

- **Paths resolved at module load.** `MIGRATIONS_DIR` and `WEB_DIST` were
  computed when their modules were imported — which, in a bundle, happens
  before the entry point can point them at the executable's directory. The
  first packaged run died on `ENOENT … dist\migrations`. Both are resolved
  when read now.
- **`NODE_ENV=production` would have forced Secure cookies.** The service
  speaks plain HTTP on a LAN, where a Secure cookie is silently dropped:
  sign-in appears to succeed and the next request is anonymous. `Secure`
  now follows an explicit `MERIDIAN_SECURE_COOKIES` switch, with NODE_ENV
  only as the fallback it always was.
- **The wrapper is a .NET 2.0 assembly.** Copying `winsw.exe` without its
  `.exe.config` means the v4 runtime refuses to host it; it exits
  `0x80131700` before reading any XML. The config is copied and renamed
  alongside the exe.
- **`if errorlevel 1` reads a negative exit code as success.** That is how
  the installer once announced an installation that had not happened. Both
  scripts test `neq 0` and then ask Windows — `sc query`, and `find
  "RUNNING"` — rather than believing an exit code.
- **`%BASE%` expands to the wrapper's file path, not its directory** in
  this winsw build, so every path became
  `C:\Apps\Meridian\MeridianService.exe\logs\…`. The XML ships as a
  template and the install scripts write the real directory into it; they
  also create `logs\` first, because the wrapper opens its log file
  without creating the directory.

One more, found by testing rather than by reading: `start` returns before
the service manager reports RUNNING (the app opens a database pool first,
about five seconds), so a single check called a healthy slow start a
failure. The scripts wait up to thirty seconds for the state.

## Verified

Service installed, Running, Automatic, recovery actions as configured;
`/api/health` → `{"ok":true,"engine":"postgres"}`; the client served at
`http://localhost:4173`; a fresh sign-in issues
`HttpOnly; SameSite=Lax` with no `Secure`, and the authenticated bootstrap
returns the book. Stop and start through the SCM both clean. An upgrade
run over the running service completed and preserved the configuration.

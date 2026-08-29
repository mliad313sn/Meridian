/**
 * Wrap the built distribution into a single setup executable.
 *
 *   dist/MeridianSetup.exe
 *
 * Built with IExpress, which ships with Windows — no third-party
 * installer toolchain to acquire, license or keep current. The package
 * carries exactly two files: the distribution as a zip, and the script
 * that unpacks it, keeps any existing configuration, and registers the
 * service. Run scripts/package/build-exe.mjs first.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const DIST = join(ROOT, "dist");
const PKG = join(DIST, "Meridian");
const WORK = join(DIST, ".installer");
const SETUP = join(DIST, "MeridianSetup.exe");

const TARGET = String.raw`C:\Apps\Meridian`;
const SERVICE_ID = "MeridianITPMO";

if (!existsSync(join(PKG, "Meridian.exe"))) {
  throw new Error("dist/Meridian/Meridian.exe is missing — run scripts/package/build-exe.mjs first");
}

const ps = (script) =>
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { stdio: "inherit" });

rmSync(WORK, { recursive: true, force: true });
rmSync(SETUP, { force: true });
mkdirSync(WORK, { recursive: true });

/* ── 1 · the payload ──────────────────────────────────────────────── */
console.log("  compressing the distribution");
const zip = join(WORK, "Meridian.zip");
/* The CONTENTS of the folder, so the archive expands straight into the
   target directory rather than into a nested Meridian\ inside it. */
ps(`Compress-Archive -Path '${join(PKG, "*")}' -DestinationPath '${zip}' -CompressionLevel Optimal -Force`);

/* ── 2 · what runs once it is unpacked ────────────────────────────── */
console.log("  writing the setup script");
writeFileSync(join(WORK, "setup.cmd"), `@echo off
setlocal EnableExtensions
set "TARGET=${TARGET}"
set "SVC=${SERVICE_ID}"
title Meridian IT-PMO setup

rem /quiet is for unattended deployment: no final keypress, so the script
rem can be driven from another process. Interactive runs still stop at the
rem end, because a window that vanishes takes its error message with it.
set "QUIET="
if /i "%~1"=="/quiet" set "QUIET=1"

rem The SFX runs unelevated; installing a service does not. Re-launch
rem ourselves through UAC and WAIT, so the extracted payload beside this
rem script is still on disk while the elevated copy uses it.
>nul 2>&1 net session
if errorlevel 1 (
  echo Meridian needs administrator rights to register a Windows service.
  if defined QUIET (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '/quiet' -Verb RunAs -Wait"
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
  )
  exit /b 0
)

echo.
echo   Meridian IT-PMO
echo   installing to %TARGET%
echo.

rem An upgrade, not a first install: stop what is running before the
rem files underneath it are replaced.
if exist "%TARGET%\\MeridianService.exe" (
  echo   stopping the running service...
  "%TARGET%\\MeridianService.exe" stop >nul 2>&1
  "%TARGET%\\MeridianService.exe" uninstall >nul 2>&1
  ping -n 4 127.0.0.1 >nul
)

rem Configuration belongs to the machine, not to the package.
set "KEEP="
if exist "%TARGET%\\meridian.config.json" (
  copy /y "%TARGET%\\meridian.config.json" "%TEMP%\\meridian.config.keep" >nul
  set "KEEP=1"
)

if not exist "%TARGET%" mkdir "%TARGET%"
echo   unpacking...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0Meridian.zip' -DestinationPath '%TARGET%' -Force"
rem NEQ 0, not "errorlevel 1": a failing .NET wrapper returns a large
rem NEGATIVE code, which "if errorlevel 1" reads as success — which is
rem how this script once announced an installation that never happened.
if %errorlevel% neq 0 goto :failed

if defined KEEP (
  copy /y "%TEMP%\\meridian.config.keep" "%TARGET%\\meridian.config.json" >nul
  del "%TEMP%\\meridian.config.keep" >nul 2>&1
  echo   kept your existing meridian.config.json
)

rem The wrapper's XML carries absolute paths, written now that the
rem destination is known — this build of winsw expands %%BASE%% to its own
rem file path, not its directory, so nothing self-relative can be trusted.
rem This wrapper opens its log file without creating the directory first,
rem and a missing one stops the service before it reaches the app.
if not exist "%TARGET%\\logs" mkdir "%TARGET%\\logs"

echo   pointing the service at %TARGET%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content '%TARGET%\\MeridianService.template.xml' -Raw).Replace('__HOME__','%TARGET%') | Set-Content -Encoding UTF8 '%TARGET%\\MeridianService.xml'"
if %errorlevel% neq 0 goto :failed

echo   registering the service...
"%TARGET%\\MeridianService.exe" install
if %errorlevel% neq 0 goto :failed
rem Ask Windows, rather than believing the wrapper's exit code.
sc query %SVC% >nul 2>&1
if %errorlevel% neq 0 goto :not_registered
sc failure %SVC% reset= 3600 actions= restart/10000/restart/60000/restart/120000 >nul

rem A shortcut named for the port actually configured, not the default.
for /f "usebackq delims=" %%P in (\`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{(Get-Content '%TARGET%\\meridian.config.json' -Raw | ConvertFrom-Json).PORT}catch{4173}"\`) do set "PORT=%%P"
if not defined PORT set "PORT=4173"
> "%PUBLIC%\\Desktop\\Meridian IT-PMO.url" echo [InternetShortcut]
>> "%PUBLIC%\\Desktop\\Meridian IT-PMO.url" echo URL=http://localhost:%PORT%/

echo   starting...
"%TARGET%\\MeridianService.exe" start
if %errorlevel% neq 0 goto :started_badly

rem Registered is not running, and "start" returns before the service
rem manager says RUNNING — the app opens a database pool first. Wait for
rem the state rather than sampling it once and calling a slow start a
rem failure.
set "TRIES=0"
:waitrunning
sc query %SVC% | find "RUNNING" >nul
if %errorlevel% equ 0 goto :running
set /a TRIES+=1
if %TRIES% geq 15 goto :started_badly
ping -n 3 127.0.0.1 >nul
goto :waitrunning
:running

echo.
echo   Installed. Meridian is at http://localhost:%PORT%
echo   Configuration: %TARGET%\\meridian.config.json
echo   Logs:          %TARGET%\\logs
echo.
if not defined QUIET pause
exit /b 0

:started_badly
echo.
echo   The service is registered but did not start.
echo   That is almost always the database: check DATABASE_URL in
echo   %TARGET%\\meridian.config.json, make sure PostgreSQL 17 is running
echo   and the database exists, then run:
echo.
echo       "%TARGET%\\MeridianService.exe" start
echo.
echo   The reason is in %TARGET%\\logs.
if not defined QUIET pause
exit /b 1

:not_registered
echo.
echo   The service wrapper ran but Windows has no %SVC% service.
echo   That is the wrapper failing to start: it is a .NET application and
echo   needs MeridianService.exe.config beside it. Check that the file is
echo   in %TARGET%.
if not defined QUIET pause
exit /b 1

:failed
echo.
echo   Setup did not complete. Nothing was started.
if not defined QUIET pause
exit /b 1
`);

/* ── 3 · the IExpress directive ───────────────────────────────────── */
console.log("  building MeridianSetup.exe");
const sed = join(WORK, "meridian.sed");
writeFileSync(sed, `[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=${SETUP}
FriendlyName=Meridian IT-PMO Setup
AppLaunched=cmd.exe /c setup.cmd
PostInstallCmd=<None>
FILE0="setup.cmd"
FILE1="Meridian.zip"
[SourceFiles]
SourceFiles0=${WORK}
[SourceFiles0]
%FILE0%=
%FILE1%=
`);

execFileSync(join(process.env.WINDIR ?? "C:\\Windows", "System32", "iexpress.exe"),
  ["/N", "/Q", sed], { stdio: "inherit" });

if (!existsSync(SETUP)) throw new Error("IExpress did not produce MeridianSetup.exe");
console.log(`\n  MeridianSetup.exe   ${(statSync(SETUP).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`  installs to         ${TARGET}\n`);

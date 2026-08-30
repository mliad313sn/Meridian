/**
 * The entry point of the packaged executable.
 *
 * A single-file build has no source tree around it, so this resolves
 * everything relative to the .exe instead: the built client, the
 * migrations, and the configuration file an administrator edits. Real
 * environment variables always win, so the service wrapper (or a shell)
 * can override any of it without touching the file.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { start } from "../../server/src/index.js";

const BASE = dirname(process.execPath);
const CONFIG = join(BASE, "meridian.config.json");

/* Configuration, lowest precedence: a real environment variable set by
   the service or the shell is never overwritten by the file. */
if (existsSync(CONFIG)) {
  let cfg;
  try {
    /* Strip a byte-order mark before parsing. Every Windows tool that
       might touch this file — PowerShell's Set-Content, Notepad, an
       administrator's editor — writes one by default, and JSON.parse
       refuses it. The installer avoids writing one; this makes sure a
       later hand edit cannot silently cost the whole configuration. */
    cfg = JSON.parse(readFileSync(CONFIG, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    console.error(`meridian.config.json could not be read: ${e.message}`);
    process.exit(2);
  }
  for (const [k, v] of Object.entries(cfg)) {
    if (v !== null && v !== undefined && process.env[k] === undefined) {
      process.env[k] = String(v);
    }
  }
}

const beside = (name) => join(BASE, name);
process.env.MERIDIAN_WEB_DIST ??= beside("web");
process.env.MERIDIAN_MIGRATIONS ??= beside("migrations");
process.env.NODE_ENV ??= "production";

/* A relative path in the config file means "beside the executable" — an
   administrator should never have to think about the working directory a
   service happens to start in. */
for (const key of ["MERIDIAN_WEB_DIST", "MERIDIAN_MIGRATIONS"]) {
  if (!isAbsolute(process.env[key])) process.env[key] = resolve(BASE, process.env[key]);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "No DATABASE_URL. Set it in meridian.config.json beside the executable, " +
    "or in the environment, and point it at the PostgreSQL 17 database for this instance."
  );
  process.exit(2);
}

const port = Number(process.env.PORT || 4173);
start({ port }).catch((e) => {
  console.error("Meridian failed to start:", e?.message ?? e);
  process.exit(1);
});

/**
 * The RT365 round, kept as the command it has always been.
 *
 *   node scripts/rt365-review.mjs [--repo owner/name] [--dir <workspace>]
 *
 * The review itself is `scripts/field-review.mjs`, which reads the register
 * path and the id vocabulary as configuration (V-12 · REQ-31). This file
 * stays because the command is written down in three places outside this
 * repository's control — RT365's own documents, the Product Owner command,
 * and the scheduled round — and a published loop that renames its entry
 * point on the field's behalf is not a published loop.
 */

import path from "node:path";
import { execFileSync } from "node:child_process";

const here = import.meta.dirname;
const args = ["--register", "docs/requests/rt365.json", ...process.argv.slice(2)];
try {
  execFileSync(process.execPath, [path.join(here, "field-review.mjs"), ...args], { stdio: "inherit" });
} catch (e) {
  process.exit(typeof e.status === "number" ? e.status : 2);
}

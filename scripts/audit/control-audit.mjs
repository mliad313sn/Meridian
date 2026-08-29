/**
 * Coordination check: no screen offers a control the account cannot use.
 *
 * R7.3 — "a control the user has no authority for is absent, not greyed
 * out" — was agreed by the design committee, restated by the operational
 * committee, and enforced server-side by the backend committee. It was
 * still applied by hand, one button at a time, and by the time the
 * coordination pass ran there were seven unguarded write controls: the
 * change-request decision row, four in-view create buttons, the document
 * row actions, the cost-booking row, and import/reset on the
 * administration screen. Every one of them was refused by the server, so
 * nothing leaked; what leaked was the user's time and their trust in the
 * interface.
 *
 * Three committees agreeing on a rule is not the same as the rule being
 * enforced. This is the enforcement.
 *
 *   node scripts/audit/control-audit.mjs
 */

import fs from "node:fs";

const FILES = [
  "web/src/views/index.js",
  "web/src/views/meetings.js",
  "web/src/views/administration.js",
];

/** Handlers that write. Anything else on a click is navigation or filtering. */
const MUTATES = /^(new|add|create|edit|update|delete|remove|book|assign|approve|reject|withdraw|revise|import|reset|advance|release|close|baseline|promote|revoke|disable|enable|save|apply|post|reverse|link|unlink|set(?!Doc$))/i;

/** Anything that answers "may this account?" — however it is spelled. */
const GUARDS = /\b(may|mayWrite|mayEditDoc|primaryAction|HEADER_ACTIONS|can[A-Z]\w*|isAdmin|isViewer)\b|App\.(can|isAdmin|isViewer|me\.role)/;

/* Controls that are deliberately ungated, with the reason. A control may
   appear here only because it is genuinely available to every account
   that can reach the screen — not because guarding it was awkward. */
const ALLOWED = new Map([
  ["exportCSV", "Export is a read (data.export); every role that can see the rows may take them away"],
  ["exportAll", "Same — the book export is data.export, which is not a write"],
  ["exportReportFromView", "Same — report export is a read"],
  ["closeDialog", "Dismissing a dialog is not a write"],
  ["setDocStatus", "Guarded once at the row via mayEditDoc, not per button"],
  ["addToast", "UI only"],
  ["saveText", "Writing a file the user is already reading is not a write to the book"],
]);

let problems = 0, listed = 0;
console.log("═══ write controls drawn without asking whether the account may ═══");

for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  const re = /onClick:\s*(?:\(\)\s*=>\s*)?([A-Za-z_$][\w$.]*)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const handler = m[1];
    if (handler.startsWith("App.") || handler.startsWith("go") || handler === "h") continue;
    const bare = handler.split(".").pop();
    if (!MUTATES.test(bare)) continue;

    /* The guard may sit on the button, on the cell, or on the row that
       builds the cell. Look back far enough to see a row-level guard but
       not so far that an unrelated one counts. A cell that guards once at the
       top and then draws four buttons is the common shape. */
    const window = src.slice(Math.max(0, m.index - 640), m.index);
    if (GUARDS.test(window)) continue;

    const line = src.slice(0, m.index).split("\n").length;
    if (ALLOWED.has(bare)) {
      listed++;
      console.log(`  · ${file.split("/").pop()}:${line} ${bare} — ${ALLOWED.get(bare)}`);
      continue;
    }
    console.log(`  ✖ ${file.split("/").pop()}:${line} ${bare}() has no authority check within its control group`);
    problems++;
  }
}

if (!problems && !listed) console.log("  none");
console.log(`\n${problems} unguarded write control(s).`);
if (problems) {
  console.log("R7.3: a control the account has no authority for is absent, not greyed.");
  console.log("Ask the same question the server will ask — shared/rbac.js, via App.can / may.");
  process.exitCode = 1;
}

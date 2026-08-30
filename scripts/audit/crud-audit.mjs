/**
 * F2 — every entity must be correctable.
 *
 * For each table: can a user create it, read it, change it, and remove or
 * reverse it? And does every column reach the interface at all?
 *
 * A gap is only acceptable with a written reason, and there are exactly
 * four legitimate ones (see .claude/commands/goal.md §F2). They are
 * declared here, next to the entity, so the audit reports what is
 * genuinely missing rather than a wall of noise nobody reads.
 *
 *   node scripts/audit/crud-audit.mjs
 */

import fs from "node:fs";

const sql = fs.readdirSync("server/migrations").filter((f) => f.endsWith(".sql")).sort()
  .map((f) => fs.readFileSync(`server/migrations/${f}`, "utf8")).join("\n");
const routes = fs.readdirSync("server/src/routes").filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(`server/src/routes/${f}`, "utf8")).join("\n");
const client = ["web/src/views", "web/src/ui", "web/src/lib"]
  .flatMap((d) => fs.readdirSync(d).map((f) => `${d}/${f}`))
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(f, "utf8")).join("\n")
  + fs.readFileSync("web/src/main.js", "utf8")
  /* A field is "surfaced" once it is part of the API contract, so the
     serialisers count as exposure — both the portfolio one and the
     per-module ones inside the routes. */
  + fs.readFileSync("server/src/portfolio.js", "utf8")
  + routes
  + fs.readFileSync("shared/meetings.js", "utf8");

/* ── schema ───────────────────────────────────────────────────────── */
const tables = {};
for (const m of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
  const cols = [];
  for (const line of m[2].split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("--") || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN|CHECK)/i.test(t)) continue;
    const c = /^(\w+)\s+/.exec(t);
    if (c && !["id", "row_version", "created_at"].includes(c[1])) cols.push(c[1]);
  }
  tables[m[1]] = cols;
}
/* A column added by a later migration is a column like any other. Reading
   only CREATE TABLE left everything migrations 005–007 added — origin,
   origin_site, referred_to_scope, must_change_password — outside the one
   check that asks whether a stored field ever reaches a human. */
for (const m of sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN (\w+)/g)) {
  if (tables[m[1]] && !tables[m[1]].includes(m[2])) tables[m[1]].push(m[2]);
}

/* ── what the API offers, and what is deliberately absent ─────────── */
const NA = (why) => ({ na: why });

const ENTITIES = {
  project: { c: /post\("\/projects"/, u: /patch\("\/projects\/:id"/,
    d: NA("A project is closed through its phase, never deleted — the record outlives the work") },
  activity: { c: /post\("\/activities"/, u: /patch\("\/activities\/:id"/, d: /delete\("\/activities\/:id"/ },
  activity_dep: { c: /post\("\/activities"/, u: NA("Edited by replacing the stage's dependency list"),
    d: NA("Removed with its stage") },
  cross_dep: { c: /post\("\/crossdeps"/, u: NA("A link has no attributes to change — remove and re-create"),
    d: /delete\("\/crossdeps\/:id"/ },
  milestone: { c: /post\("\/milestones"/, u: /patch\("\/milestones\/:id"/, d: /delete\("\/milestones\/:id"/ },
  cost_line: { c: /post\("\/cost"/, u: NA("Append-only ledger (A5) — corrected by a reversing entry"),
    d: /cost\/:id\/reverse/ },
  raid_item: { c: /post\("\/raid"/, u: /patch\("\/raid\/:id"/, d: /delete\("\/raid\/:id"/ },
  change_request: { c: /post\("\/change"/, u: /patch\("\/change\/:id"/, d: /delete\("\/change\/:id"/ },
  change_step: { c: /post\("\/change"/, u: /change\/:id\/(approve|reject)/,
    d: NA("Removed with its request") },
  allocation: { c: /post\("\/allocations"/, u: /patch\("\/allocations\/:id"/, d: /delete\("\/allocations\/:id"/ },
  document: { c: /post\("\/documents"/, u: /patch\("\/documents\/:id"/, d: /delete\("\/documents\/:id"/ },
  benefit: { c: /post\("\/benefits"/, u: /patch\("\/benefits\/:id"/, d: /delete\("\/benefits\/:id"/ },
  demand: { c: /post\("\/demand"/, u: /patch\("\/demand\/:id"/, d: /delete\("\/demand\/:id"/ },
  commitment: { c: /post\("\/commitments"/, u: /patch\("\/commitments\/:id"/, d: /delete\("\/commitments\/:id"/ },
  site_window: { c: /post\("\/windows"/, u: /patch\("\/windows\/:id"/, d: /delete\("\/windows\/:id"/ },
  person_absence: { c: /post\("\/absences"/, u: /patch\("\/absences\/:id"/, d: /delete\("\/absences\/:id"/ },
  /* R-03 — one number a week; the POST upserts, which is its update. */
  timesheet: { c: /post\("\/timesheets"/, u: /post\("\/timesheets"/, d: /delete\("\/timesheets\/:id"/ },
  rollout_wave: { c: /post\("\/waves"/, u: /patch\("\/waves\/:id"/, d: /delete\("\/waves\/:id"/ },
  work_item: { c: /post\("\/workitems"/, u: /patch\("\/workitems\/:id"/, d: /delete\("\/workitems\/:id"/ },
  board_column: { c: NA("Fixed by the delivery method"), u: /patch\("\/columns\/:id"/,
    d: NA("Fixed by the delivery method") },
  report_narrative: { c: /put\("\/narrative\/:key"/, u: /put\("\/narrative\/:key"/, d: /put\("\/narrative\/:key"/ },
  /* V-02 — what was reported is a record, not a working copy. Corrected
     by a restating period, which is the reversing-entry rule applied to
     reporting rather than to the ledger. */
  report_period: { c: /post\("\/periods"/,
    u: NA("Append-only (V-02) — corrected by a new period naming what it restates"),
    d: NA("Append-only (V-02) — what the board was told is a record") },
  report_snapshot: { c: /post\("\/periods"/,
    u: NA("Append-only (V-02) — frozen with its period"),
    d: NA("Append-only (V-02) — frozen with its period") },

  person: { c: /post\("\/people"/, u: /patch\("\/people\/:id"/,
    d: NA("Marked a leaver via active=false — the name stays on what they did") },
  site: { c: /post\("\/sites"/, u: /patch\("\/sites\/:id"/, d: NA("Deactivated, not deleted") },
  programme: { c: /post\("\/programmes"/, u: /patch\("\/programmes\/:id"/, d: NA("Deactivated, not deleted") },
  app_user: { c: /post\("\/users"/, u: /patch\("\/users\/:id"/, d: NA("Deactivated, not deleted — the audit trail must keep resolving") },
  access_grant: { c: /users\/:id\/grants"/, u: NA("A grant has no attributes — revoke and re-grant"),
    d: /grants\/revoke/ },
  session: { c: /post\("\/login"/, u: NA("Sessions are not edited"), d: /post\("\/logout"/ },
  app_setting: { c: /patch\("\/settings"/, u: /patch\("\/settings"/, d: NA("Settings have defaults, not absence") },
  audit_event: { c: NA("Written by audited(), never by a route"), u: NA("Append-only (R6.2)"),
    d: NA("Append-only (R6.2)") },

  ext_link: { c: /post\("\/links"/, u: /patch\("\/links\/:id"/, d: /delete\("\/links\/:id"/ },

  meeting_series: { c: /post\("\/series"/, u: /patch\("\/series\/:id"/,
    d: NA("Retired via active=false — its history must remain readable") },
  meeting_occurrence: { c: /post\("\/series\/:id\/occurrences"/, u: /occurrences\/:id\/(open|close)/,
    d: NA("A meeting that happened is a record") },
  agenda_item: { c: /occurrences\/:id\/close/, u: NA("Frozen at close (R5.8)"), d: NA("Frozen at close (R5.8)") },
  meeting_attendance: { c: /occurrences\/:id\/attendance/, u: /occurrences\/:id\/attendance/,
    d: /occurrences\/:id\/attendance/ },
  meeting_decision: { c: /occurrences\/:id\/decisions/, u: NA("Immutable once the meeting closes (R5.5)"),
    d: NA("Immutable once the meeting closes (R5.5)") },
  meeting_action: { c: /occurrences\/:id\/actions/, u: /patch\("\/actions\/:id"/,
    d: NA("Cancelled via status, so it stays in the minutes that raised it") },
};

/* Columns that must never reach a browser. */
const SERVER_ONLY = new Set([
  "pw_hash", "pw_salt", "token", "before_json", "after_json",
  // session internals: the browser holds the cookie, never the record
  "expires_at", "user_agent",
  // write-time bookkeeping the interface has no reason to render
  "granted_at", "updated_at", "updated_by", "closed_in",
  /* N-07 — la mécanique de la sonde, pas son résultat. La bibliothèque
     montre `probe_state` et `probed_at` : le lien répondait-il, et quand.
     Le code HTTP exact et le compteur d'échecs servent à décider quand
     avertir ; les afficher demanderait au lecteur d'interpréter un 502 à
     la place de l'outil. */
  "probe_status", "probe_fails",
]);

const verb = (spec) => {
  if (!spec) return { mark: "?", note: "not declared in this audit" };
  if (spec.na) return { mark: "—", note: spec.na };
  return spec.test(routes) ? { mark: "✓", note: "" } : { mark: "✖", note: "MISSING" };
};

let gaps = 0;
const notes = [];
console.log("ENTITY                 C  U  D   FIELDS");
console.log("─".repeat(78));

for (const [name, spec] of Object.entries(ENTITIES)) {
  const c = verb(spec.c), u = verb(spec.u), d = verb(spec.d);
  [["create", c], ["update", u], ["remove", d]].forEach(([label, v]) => {
    if (v.mark === "✖") { gaps++; notes.push(`${name}: no ${label}`); }
    else if (v.mark === "—") notes.push(`${name}: no ${label} — ${v.note}`);
  });

  const cols = (tables[name] ?? []).filter((x) => !SERVER_ONLY.has(x));
  const missing = cols.filter((col) => {
    const camel = col.replace(/_(\w)/g, (_, x) => x.toUpperCase());
    const bare = col.replace(/_id$/, "");
    return !new RegExp(`\\b(${col}|${camel}|${bare})\\b`).test(client);
  });
  if (missing.length) { gaps++; notes.push(`${name}: fields never surfaced — ${missing.join(", ")}`); }

  console.log(
    name.padEnd(22) + `${c.mark}  ${u.mark}  ${d.mark}   ` +
    (missing.length ? `✖ ${missing.join(", ")}` : `✓ all ${cols.length}`)
  );
}

console.log("\n── NOTES ──");
notes.forEach((n) => console.log("  " + (n.includes(" — ") ? "· " : "✖ ") + n));

console.log(`\n${gaps} unexplained gap(s).`);
if (gaps) {
  console.log("Each must be closed, or given a reason in ENTITIES above.");
  console.log("See .claude/commands/goal.md §F2 for the four legitimate reasons.");
  process.exitCode = 1;
}

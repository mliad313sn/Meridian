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
 * REQ-52 — and the map is held against the schema: a table a migration
 * creates and this file does not name fails the build by name, instead
 * of being silently unseen. Gaps that are known and owned by a line are
 * listed shrink-only in KNOWN_GAPS, reported on every run.
 *
 *   node scripts/audit/crud-audit.mjs
 */

import fs from "node:fs";
import { migrationSchema } from "./lib/schema.mjs";

const routes = fs.readdirSync("server/src/routes").filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(`server/src/routes/${f}`, "utf8")).join("\n");
/* REQ-52 — the whole client, walked: three folders and main.js were
   named here, and a fourth folder would have been a client this gate
   never read. */
const walkJs = (dir, into = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walkJs(p, into);
    else if (e.name.endsWith(".js")) into.push(p);
  }
  return into;
};
const client = walkJs("web/src").sort()
  .map((f) => fs.readFileSync(f, "utf8")).join("\n")
  /* A field is "surfaced" once it is part of the API contract, so the
     serialisers count as exposure — both the portfolio one and the
     per-module ones inside the routes. */
  + fs.readFileSync("server/src/portfolio.js", "utf8")
  + routes
  + fs.readFileSync("shared/meetings.js", "utf8");

/* ── schema ───────────────────────────────────────────────────────── */
/* docs/36 C-03 — `IF NOT EXISTS` is how the KODO line wrote 051 and 052,
   and the old pattern read neither the tables nor the columns: six new
   registers and ten columns were invisible to the one gate that asks
   whether a stored field ever reaches a human. The reading now lives in
   lib/schema.mjs, which also reports any CREATE TABLE it could not read
   (and server/test/gate-lists.test.js holds it against the live schema),
   so a statement this pattern misses is named, not dropped. */
const schema = migrationSchema();
const tables = schema.tables;

/* ── what the API offers, and what is deliberately absent ─────────── */
const NA = (why) => ({ na: why });

const ENTITIES = {
  project: { c: /post\("\/projects"/, u: /patch\("\/projects\/:id"/,
    d: NA("A project is closed through its phase, never deleted — the record outlives the work") },
  activity: { c: /post\("\/activities"/, u: /patch\("\/activities\/:id"/, d: /delete\("\/activities\/:id"/ },
  activity_dep: { c: /post\("\/activities"/, u: NA("Edited by replacing the stage's dependency list"),
    d: NA("Removed with its stage") },
  /* FX-02 (061) — a working calendar, and its dated non-working days,
     which are the calendar's list: replaced whole by its PATCH. */
  work_calendar: { c: /post\("\/calendars"/, u: /patch\("\/calendars\/:id"/, d: /delete\("\/calendars\/:id"/ },
  work_calendar_exception: { c: /patch\("\/calendars\/:id"/, u: NA("Edited by replacing the calendar's list of non-working days"),
    d: NA("Removed from the calendar's list, or with its calendar") },
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
  /* REQ-24 — the weighting the portfolio ranks by. Its single row is
     posed by migration 046, which is why it has no create route and why
     reset-book keeps it: a book with no weighting has no order at all.
     It is here because a table this map does not name is INVISIBLE to
     this gate — the same blind spot F1 had for a router it did not
     name, found twice in two waves. */
  /* REQ-46 (050) — a review HAPPENED: it is recorded, read back,
     corrected, and withdrawn when it was written in error (on the wrong
     row, or twice). Withdrawing is not deletion-because-it-is-awkward:
     the whole event is the audit row's before-image, and the due date
     that comes back is the one that review found in place. */
  /* REQ-30 (048) — la page de valeur déposée pour une période. Le
     dépôt est le create ; il n'y a ni update ni delete parce que ce
     qu'on a dit au conseil est un RECORD, corrigé par une période qui
     restate, jamais réécrit. */
  report_value: { c: /post\("\/valuepage\/:periodId"/,
    u: NA("Append-only (REQ-30) — corrected by a new period that restates this one, with its own value page"),
    d: NA("Append-only (REQ-30) — what the board was told it was worth is a record") },
  report_value_figure: { c: /post\("\/valuepage\/:periodId"/,
    u: NA("Append-only (REQ-30) — frozen with the page it belongs to"),
    d: NA("Append-only (REQ-30) — frozen with the page it belongs to") },
  raid_review: { c: /post\("\/raid\/:id\/reviews"/, u: /patch\("\/raid\/reviews\/:id"/,
    d: /delete\("\/raid\/reviews\/:id"/ },
  prioritisation_weighting: {
    c: NA("One row, posed by migration 046 — a portfolio has one weighting, never a second"),
    u: /patch\("\/prioritisation\/weighting"/,
    d: NA("Removing it would leave the portfolio with no order; the way back is to restore the shipped weights") },
  audit_event: { c: NA("Written by audited(), never by a route"), u: NA("Append-only (R6.2)"),
    d: NA("Append-only (R6.2)") },
  /* FX-07 (062) — a named baseline is a photograph of the plan: taken,
     compared, never retouched. Correcting one is taking another. */
  baseline_snapshot: { c: /post\("\/projects\/:id\/baselines"/,
    u: NA("Read-only once taken (FX-07, 062 refuses a rewrite) — a new plan is a new named baseline"),
    d: NA("Append-only (FX-07) — eleven at most, and a comparison must still find the one it was made against") },
  baseline_snapshot_row: { c: /post\("\/projects\/:id\/baselines"/,
    u: NA("Read-only once taken, with its snapshot (FX-07)"),
    d: NA("Removed with its project only (ON DELETE CASCADE) — never alone") },

  ext_link: { c: /post\("\/links"/, u: /patch\("\/links\/:id"/, d: /delete\("\/links\/:id"/ },
  /* I-2 — la mémoire d'idempotence d'une intégration : écrite par le
     garde, rejouée telle quelle, purgée à trente jours. Rien à corriger
     à la main — corriger une réponse enregistrée serait mentir au tiers. */
  idempotency_key: { c: /put\("\/(projects|raid)\/:externalId"/,
    u: NA("A recorded answer is replayed as it was — editing it would lie to the caller"),
    d: NA("Purged after thirty days by the hourly sweep") },

  /* I-4 — un critère se pose, se reformule, se tient (réviseur nommé) et,
     tant qu'il n'est pas tenu, se retire. */
  gate_criterion: { c: /post\("\/criteria"/, u: /patch\("\/criteria\/:id"/, d: /delete\("\/criteria\/:id"/ },
  /* PM-05 / PM-11 (I-10) — two registers of the project, corrected in place. */
  stakeholder: { c: /post\("\/stakeholders"/, u: /patch\("\/stakeholders\/:id"/, d: /delete\("\/stakeholders\/:id"/ },
  comms_plan: { c: /post\("\/comms"/, u: /patch\("\/comms\/:id"/, d: /delete\("\/comms\/:id"/ },

  /* PM-03 — la promesse contre laquelle le réalisé se relira. Un seul cas
     par projet : le PUT écrit ou révise, selon qu'il existe. Cette table
     n'était déclarée NULLE PART ici — donc ni ses verbes ni ses colonnes
     n'étaient regardés par cette porte, sur une table vieille de la 028.
     C'est exactement la classe de défaut que F2 existe pour prendre. */
  business_case: { c: /put\("\/projects\/:id\/case"/, u: /put\("\/projects\/:id\/case"/,
    d: NA("A case is revised, never deleted — the promise it made has to stay readable against the outturn") },
  /* REQ-22 (V-3) — une reconfirmation par jalon. Reconfirmer deux fois le
     même jalon corrige la ligne (ON CONFLICT), ne l'empile pas. */
  case_reconfirmation: { c: /post\("\/projects\/:id\/case\/reconfirm"/,
    u: /post\("\/projects\/:id\/case\/reconfirm"/,
    d: NA("A reconfirmation happened, at a date, with a verdict — like a decision it is superseded by the next, never removed") },

  /* NEW-04 (docs/36) — KODO's registers (051, 052). Until this line they
     entered only through the import, and this map did not name them —
     so the gate that asks whether an entity is correctable could not ask
     it of them. Routes in server/src/routes/registers.js. */
  requirement: { c: /post\("\/requirements"/, u: /patch\("\/requirements\/:id"/, d: /delete\("\/requirements\/:id"/ },
  evidence: { c: /post\("\/evidence"/, u: /patch\("\/evidence\/:id"/, d: /delete\("\/evidence\/:id"/ },
  /* A finding is corrected in place, closed on evidence, waived with a
     reason, reopened; removed only when raised in error (open). */
  finding: { c: /post\("\/findings"/, u: /patch\("\/findings\/:id"/, d: /findings\/:id\/reopen|delete\("\/findings\/:id"/ },
  seat: { c: /post\("\/seats"/, u: /patch\("\/seats\/:id"/, d: /delete\("\/seats\/:id"/ },
  seat_conflict: { c: /post\("\/seats\/:id\/conflicts"/,
    u: NA("An incompatibility is an edge with only its reason — remove it and declare it again"),
    d: /delete\("\/seats\/:id\/conflicts\/:other"/ },
  /* Dissent is a record: withdrawn by its author, never deleted. */
  decision_objection: { c: /post\("\/decisions\/:id\/objections"/, u: /patch\("\/objections\/:id"/,
    d: /objections\/:id\/withdraw/ },

  meeting_series: { c: /post\("\/series"/, u: /patch\("\/series\/:id"/,
    d: NA("Retired via active=false — its history must remain readable") },
  meeting_occurrence: { c: /post\("\/series\/:id\/occurrences"/, u: /occurrences\/:id\/(open|close)/,
    d: NA("A meeting that happened is a record") },
  agenda_item: { c: /occurrences\/:id\/close/, u: NA("Frozen at close (R5.8)"), d: NA("Frozen at close (R5.8)") },
  meeting_attendance: { c: /occurrences\/:id\/attendance/, u: /occurrences\/:id\/attendance/,
    d: /occurrences\/:id\/attendance/ },
  /* La 039 a fait vivre l'ÉTAT d'une décision (Proposed → Ratified, le
     ratifieur, le lien de preuve) : « immuable une fois la séance close »
     n'était plus vrai, et la ligne d'exemption cachait un chemin de mise à
     jour que ni cette porte ni la F3 ne regardaient. C'est la SUBSTANCE
     qui est immuable — le fond répond 409 — et l'état s'écrit par
     PUT /api/v1/decisions/:externalId, sous `row_version` depuis la 041. */
  meeting_decision: { c: /occurrences\/:id\/decisions/, u: /put\("\/decisions\/:externalId"/,
    d: NA("A decision is superseded by a new one, never deleted (I-7)") },
  /* FX-12 (064) — a what-if copy of the portfolio and its changes. A
     Draft is corrected and removed freely; once a decision names it, it
     is withdrawn, not deleted (routes/scenarios.js). */
  scenario: { c: /post\("\/scenarios"/, u: /patch\("\/scenarios\/:id"/,
    d: /delete\("\/scenarios\/:id"|scenarios\/:id\/withdraw/ },
  scenario_change: { c: /post\("\/scenarios\/:id\/changes"/, u: /patch\("\/scenario-changes\/:id"/,
    d: /delete\("\/scenario-changes\/:id"/ },
  meeting_action: { c: /occurrences\/:id\/actions/, u: /patch\("\/actions\/:id"/,
    d: NA("Cancelled via status, so it stays in the minutes that raised it") },

  /* ── REQ-52 — the tables this map did not name ─────────────────────
     Until 23/09 the nine below were in the schema and not here, so F2
     never asked about their verbs or their columns: not "passed", not
     "failed" — not seen. They are named now, each with what it offers
     and, where a verb is absent, the reason. */
  /* O-1 — raised by the server when something concerns a person; the
     person marks it read, the sweep purges it. */
  notification: { c: NA("Raised by the server (notify.js) when an event concerns someone — never typed by a person"),
    u: /patch\("\/notifications\/:id"/,
    d: NA("Purged by the sweep after the retention the administrator set (G-13) — a message someone was sent is not deleted by hand") },
  notification_subscription: { c: /post\("\/subscriptions"/,
    u: NA("A subscription is a switch — removed and re-created, it has no history worth versioning"),
    d: /delete\("\/subscriptions\/:id"/ },
  lesson: { c: /post\("\/lessons"/, u: /patch\("\/lessons\/:id"/, d: /delete\("\/lessons\/:id"/ },
  integration: { c: /post\("\/integrations"/, u: /patch\("\/integrations\/:id"/, d: /delete\("\/integrations\/:id"/ },
  /* PM-02 — one active tolerance per project; setting it again retires
     the old one rather than editing it. */
  project_tolerance: { c: /put\("\/projects\/:id\/tolerance"/, u: /put\("\/projects\/:id\/tolerance"/,
    d: NA("Superseded, never deleted (active=false) — an exception must stay readable against the tolerance it breached") },
  project_exception: { c: NA("Raised by the sweep when a tolerance is breached — a breach is detected, not declared"),
    u: /post\("\/exceptions\/:id\/answer"/,
    d: NA("A breach that happened is a record; it is answered, never deleted") },
  event_delivery: { c: NA("Written by the outbound queue, one row per event and subscriber (events.js)"),
    u: NA("Its state is what the receiver got — editing it by hand would lie to the integrator"),
    d: NA("Removed with its integration (ON DELETE CASCADE)") },
  /* docs/41 wave B (063) — who works on which activity, and the price of
     a day. Both corrected in place and withdrawn when entered in error;
     routes in server/src/routes/resources.js. */
  assignment: { c: /post\("\/assignments"/, u: /patch\("\/assignments\/:id"/, d: /delete\("\/assignments\/:id"/ },
  rate: { c: /post\("\/rates"/, u: /patch\("\/rates\/:id"/, d: /delete\("\/rates\/:id"/ },
  usage_daily: { c: NA("Counted by the server (A-08) — a measure of use is never typed"),
    u: NA("A count is not corrected by hand — it is what was counted"),
    d: NA("An aggregate with no person in it; nothing to withdraw") },
};

/* Tables that are not an entity anyone corrects, with the reason. Only
   the fourth legitimate reason of goal.md §F2 fits here — the table never
   leaves the server — so a table may be listed only when NO column of it
   is meant to reach a human. */
const NOT_ENTITIES = {
  id_counter: "Never leaves the server — the allocator behind human-readable ids (db.js nextId), a mechanism and not a record",
};

/* ── known gaps: shrink-only ─────────────────────────────────────────
   Every gap listed here is reported on every run with its line and the
   day it was measured, without failing the build. The list only shrinks:
     · a gap not listed here fails the build (a new table, a new column);
     · a listed gap that has closed fails too, until it is struck off;
     · a listed table that gains a write path outside the import fails
       until its verbs are declared for real and its lines struck off.

   KODO's six registers were listed here from REQ-52 (5.21.1) until NEW-04
   (5.22.0) gave them routes and screens; the gate itself asked for their
   sixteen lines to be struck off, which is how this list is meant to
   empty. */
const KNOWN_GAPS = new Map(Object.entries({
  /* Found by naming the nine tables above (REQ-52, 23/09) — NEW-21. Each
     is a field stored and never drawn; reported here, not hidden. */
  "notification.acted_at": "NEW-21 · measured 2026-09-23 — no code writes or reads it: a column with no life at all",
  "integration.rotated_at": "NEW-21 · measured 2026-09-23 — GET /admin/integrations sends it, the connected-systems table does not draw when a key was last rotated",
  "event_delivery.last_error": "NEW-21 · measured 2026-09-23 — GET /admin/integrations/:id/deliveries serves it and no screen calls that route (F1 lists it): an administrator cannot see why a webhook failed",
  "event_delivery.delivered_at": "NEW-21 · measured 2026-09-23 — same route, same absence",
}));
/* The files allowed to write a known-gap table without that being "a
   route arrived": the import that brings KODO's book in, the seed and
   the restore. */
const IMPORT_WRITERS = new Set(["import.js", "seed.js", "seed-data.js", "archive.js", "reset-book.js"]);

/* Columns that must never reach a browser. */
const SERVER_ONLY = new Set([
  "pw_hash", "pw_salt", "token", "token_hash", "before_json", "after_json",
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
  /* I-2 — la mécanique d'idempotence : une empreinte de requête et la
     réponse enregistrée, rejouée à l'appelant, jamais dessinée. */
  "request_hash", "response_json",
  /* REQ-52 — notification mechanics, seen once `notification` was named:
     the key that stops a sweep sending the same message twice, and the
     date after which the purge may drop it (G-13). The person reads the
     message, not its bookkeeping. */
  "dedupe_key", "expires_on",
]);

const verb = (spec) => {
  if (!spec) return { mark: "?", note: "not declared in this audit" };
  if (spec.na) return { mark: "—", note: spec.na };
  return spec.test(routes) ? { mark: "✓", note: "" } : { mark: "✖", note: "MISSING" };
};

const found = [];            // every gap measured: { key, text }
const notes = [];
console.log("ENTITY                 C  U  D   FIELDS");
console.log("─".repeat(78));

for (const [name, spec] of Object.entries(ENTITIES)) {
  const c = verb(spec.c), u = verb(spec.u), d = verb(spec.d);
  [["create", c], ["update", u], ["remove", d]].forEach(([label, v]) => {
    if (v.mark === "✖") found.push({ key: `${name}: no ${label}`, text: `${name}: no ${label}` });
    else if (v.mark === "—") notes.push(`${name}: no ${label} — ${v.note}`);
  });

  const cols = (tables[name] ?? []).filter((x) => !SERVER_ONLY.has(x));
  const missing = cols.filter((col) => {
    const camel = col.replace(/_(\w)/g, (_, x) => x.toUpperCase());
    const bare = col.replace(/_id$/, "");
    return !new RegExp(`\\b(${col}|${camel}|${bare})\\b`).test(client);
  });
  /* One gap per column, so a listed gap can never cover a column added
     after it was listed. */
  for (const col of missing) found.push({ key: `${name}.${col}`, text: `${name}.${col}: field never surfaced` });

  console.log(
    name.padEnd(22) + `${c.mark}  ${u.mark}  ${d.mark}   ` +
    (missing.length ? `✖ ${missing.join(", ")}` : `✓ all ${cols.length}`)
  );
}

/* ── REQ-52 — the map is held against the schema ─────────────────────
   A table this map does not name used to be invisible: not a gap, not a
   pass, nothing. Now it fails the build by name, and so does a name that
   no migration creates any more (a reason that has quietly stopped
   applying). */
const listing = [];
const named = new Set([...Object.keys(ENTITIES), ...Object.keys(NOT_ENTITIES)]);
for (const t of schema.unreadable) {
  listing.push(`${t}: a CREATE TABLE this audit could not read — its columns are unseen (fix lib/schema.mjs)`);
}
for (const t of schema.names) {
  if (!named.has(t)) {
    listing.push(`${t}: a migration creates this table and F2 does not name it — declare it in ENTITIES ` +
      `(its routes, or the reason a verb is absent) or in NOT_ENTITIES with its reason`);
  }
}
for (const t of named) {
  if (!schema.names.includes(t)) listing.push(`${t}: named here and created by no migration — remove it`);
}
for (const t of Object.keys(NOT_ENTITIES)) {
  if (t in ENTITIES) listing.push(`${t}: both an entity and not one — choose`);
}

/* Shrink-only (see KNOWN_GAPS). */
const foundKeys = new Set(found.map((g) => g.key));
const unexplained = found.filter((g) => !KNOWN_GAPS.has(g.key));
const known = found.filter((g) => KNOWN_GAPS.has(g.key));
const healed = [...KNOWN_GAPS.keys()].filter((k) => !foundKeys.has(k));
/* The tables whose VERBS are listed as missing: a write path appearing
   for one of them is a route arriving, whatever path it was given. */
const gapTables = new Set([...KNOWN_GAPS.keys()].filter((k) => k.includes(": no ")).map((k) => k.split(":")[0]));
const writers = [];
for (const p of walkJs("server/src")) {
  if (IMPORT_WRITERS.has(p.split("/").pop())) continue;
  const src = fs.readFileSync(p, "utf8");
  for (const t of gapTables) {
    if (new RegExp(`\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+${t}\\b`).test(src)) {
      writers.push(`${t}: ${p} now writes this table, which KNOWN_GAPS says has no route — ` +
        `declare its real verbs in ENTITIES and strike its lines off KNOWN_GAPS`);
    }
  }
}

console.log("\n── NOTES ──");
notes.forEach((n) => console.log("  · " + n));
if (known.length) {
  console.log("\n── KNOWN GAPS (shrink-only, reported on every run) ──");
  known.forEach((g) => console.log(`  ◦ ${g.text}   [${KNOWN_GAPS.get(g.key)}]`));
}
const failures = [
  ...unexplained.map((g) => g.text),
  ...healed.map((k) => `${k}: listed in KNOWN_GAPS and no longer a gap — strike it off`),
  ...writers,
  ...listing,
];
if (failures.length) {
  console.log("\n── FAILURES ──");
  failures.forEach((f) => console.log("  ✖ " + f));
}

console.log(`\n${Object.keys(ENTITIES).length} entities + ${Object.keys(NOT_ENTITIES).length} not-entity of ` +
  `${schema.names.length} tables · ${known.length} known gap(s) · ${failures.length} unexplained.`);
if (failures.length) {
  console.log("Each must be closed, or given a reason in ENTITIES above.");
  console.log("See .claude/commands/goal.md §F2 for the four legitimate reasons.");
  process.exitCode = 1;
}

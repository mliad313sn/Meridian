/**
 * F13 · THE BOOK COMES BACK  (docs/36 C-05)
 *
 * On 23/09 the product anyone cloned could not import its own export, and
 * three field programmes had each found that out for themselves. The
 * campaign's probe asked one question — does the import answer 200 — and
 * the answer turned out to be the wrong question: measured the same day,
 * the export wrote fifteen collections the importer never read, and a
 * cost line came back with a new id and the note "Imported". Every probe
 * had passed, because the seeded book holds none of those rows.
 *
 * So this gate asks three things, and none of them is "200":
 *
 *   1. Every collection the export writes is read by the importer — or it
 *      is named below, with the line that will close it, or declared not
 *      to be book data at all. Derived from the two sources, not from a
 *      hand list of collections: a collection added to the export tomorrow
 *      fails here until someone decides what the import does with it.
 *   2. Export → import → export gives back the same book, field for field,
 *      except the losses named below.
 *   3. A named loss that no longer happens FAILS too. The list can only
 *      shrink, and it shrinks in the commit that fixes it — a debt list
 *      that nobody has to update is a list that stops being true.
 *
 * The known losses belong to NEW-05 (docs/36, wave 1): the import was
 * written before those registers existed, and nobody extended it.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, shutdown, as } from "./harness.js";
import { query } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

/* Not book data: who is asking, and what they may see. */
const NOT_BOOK = new Set(["currentUser", "viewer"]);

/* NEW-05 — exported and never imported. Each is erased by an import. */
const KNOWN_LOST_COLLECTIONS = new Set([
  "absences", "benefits", "businessCases", "caseReconfirmations", "commitments",
  "comms", "criteria", "exceptions", "extLinks", "lessons", "stakeholders",
  "timesheets", "tolerances", "waves", "windows",
]);

/* NEW-05 — fields that come back different, measured on the seeded book
   plus the enrichment below: every column the importer never learned,
   because it was written before them (R2.6) and nobody extended it. A
   ledger line is re-numbered and rewritten "Imported", "Labour", USD,
   capex, on the first of the month, not from contingency. A programme
   loses its ladder; a person their contract; a project its review, its
   scores and what its date rests on. */
const KNOWN_LOST_FIELDS = new Set([
  "ledger[].id", "ledger[].note", "ledger[].bookedOn", "ledger[].category", "ledger[].fromContingency", "ledger[].kind", "ledger[].currency", "ledger[].fx", "ledger[].amountLocal",
  "programmes[].gateModel",
  "people[].employment", "people[].rotation", "people[].availability", "people[].supplier",
  "projects[].scaffoldedGates", "projects[].ladderDiffers", "projects[].pirOn", "projects[].pirVerdict", "projects[].pirNote", "projects[].closureNote", "projects[].dateBasis", "projects[].condition", "projects[].acceptanceCriteria", "projects[].plantImpact", "projects[].mocRef", "projects[].fit", "projects[].value", "projects[].risk", "projects[].effort", "projects[].rank",
  "activities[].progressSource",
  "milestones[].intrusive", "milestones[].acceptanceCriteria", "milestones[].dateBasis", "milestones[].condition",
  "raid[].tp", "raid[].ti", "raid[].category",
]);

const importer = readFileSync(new URL("../src/import.js", import.meta.url), "utf8");
const read = new Set([...importer.matchAll(/\bbook\??\.(\w+)/g)].map((m) => m[1]));

/* Every leaf that differs, named by its path with indices folded. */
function differences(a, b, path = "", out = new Map()) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const bothObjects = a && b && typeof a === "object" && typeof b === "object";
  if (bothObjects && Array.isArray(a) === Array.isArray(b) &&
      (!Array.isArray(a) || a.length === b.length)) {
    const keys = Array.isArray(a) ? a.keys() : new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) differences(a[k], b[k], Array.isArray(a) ? `${path}[]` : `${path}${path ? "." : ""}${k}`, out);
    return out;
  }
  if (!out.has(path)) out.set(path, `${JSON.stringify(a)?.slice(0, 60)} → ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
}

/* A round trip only proves what the book holds, and the seeded book holds
   defaults: no expensed allocation, no euro cost line, no programme ladder.
   So before exporting, one row of each imported table is given a value
   that is NOT its default in every column added since the importer was
   written (R2.6, migrations 001–004). Without this the gate passes on the
   very losses it exists to catch — measured: dropping `capitalised` from
   the import went unseen until this block existed. */
const ENRICH = [
  `UPDATE allocation SET capitalised = false WHERE id = (SELECT min(id) FROM allocation)`,
  `UPDATE cost_line SET kind = 'opex', currency = 'EUR', fx_rate = 1.1, amount_local = amount * 1.1,
          from_contingency = true, category = 'Contract', booked_on = (period || '-17')::date,
          note = 'Round-trip probe'
    WHERE id = (SELECT min(id) FROM cost_line)`,
  `UPDATE programme SET gate_model = '[{"n":1,"name":"Idea","at":0.1,"owner":"Sponsor","evidence":""},
          {"n":2,"name":"Build","at":0.5,"owner":"PMO","evidence":"","loopsTo":1}]'::jsonb
    WHERE id = (SELECT min(id) FROM programme)`,
  `UPDATE project SET pir_on = '2026-01-15', pir_verdict = 'Partly met', pir_note = 'probe',
          plant_impact = 'plant', moc_ref = 'MOC-1', fit_score = 3, value_score = 4, risk_score = 2,
          effort_score = 5, rank_seq = 7, closure_note = 'probe', date_basis = 'placeholder',
          condition = 'probe condition', acceptance_criteria = 'probe criteria', scaffolded_gates = 4
    WHERE id = (SELECT min(id) FROM project)`,
  `UPDATE milestone SET intrusive = true, acceptance_criteria = 'probe', date_basis = 'placeholder',
          condition = 'probe'
    WHERE id = (SELECT min(id) FROM milestone)`,
  `UPDATE person SET employment = 'contractor', rotation = '4/2', availability = 80, supplier = 'Acme'
    WHERE id = (SELECT min(id) FROM person)`,
  `UPDATE raid_item SET target_probability = 1, target_impact = 1, category = 'probe'
    WHERE id = (SELECT min(id) FROM raid_item)`,
  `UPDATE activity SET progress_source = 'probe' WHERE id = (SELECT min(id) FROM activity)`,
];

describe("F13 · export → import → export", () => {
  let first, second, status, text;
  before(async () => {
    for (const sql of ENRICH) await query(sql);
    const admin = await as("admin");
    first = (await admin.get("/api/admin/export")).body;
    const r = await admin.post("/api/admin/import", { db: first });
    status = r.status; text = r.text;
    second = (await admin.get("/api/admin/export")).body;
  });

  test("the product imports its own export", () => {
    assert.equal(status, 200, text);
  });

  test("every collection the export writes is imported, or named with the line that will", () => {
    const unread = Object.keys(first).filter((k) =>
      !read.has(k) && !NOT_BOOK.has(k) && !KNOWN_LOST_COLLECTIONS.has(k));
    assert.deepEqual(unread, [],
      "the export writes these and the import never reads them — import them, or name them in " +
      "KNOWN_LOST_COLLECTIONS with the docs/36 line that closes them");
  });

  test("a collection the import now reads is struck off the known losses", () => {
    const healed = [...KNOWN_LOST_COLLECTIONS].filter((k) => read.has(k));
    assert.deepEqual(healed, [], "imported now — remove from KNOWN_LOST_COLLECTIONS");
    const gone = [...KNOWN_LOST_COLLECTIONS].filter((k) => !(k in first));
    assert.deepEqual(gone, [], "no longer exported — remove from KNOWN_LOST_COLLECTIONS");
  });

  test("the book comes back field for field, except the named losses", () => {
    const diff = differences(first, second);
    const unexplained = [...diff].filter(([p]) => !KNOWN_LOST_FIELDS.has(p));
    assert.deepEqual(unexplained, [],
      "these fields do not survive the round trip, and nobody has said so");
  });

  test("a named field loss that no longer happens is struck off", () => {
    const diff = differences(first, second);
    const healed = [...KNOWN_LOST_FIELDS].filter((p) => !diff.has(p));
    assert.deepEqual(healed, [], "survives now — remove from KNOWN_LOST_FIELDS");
  });
});

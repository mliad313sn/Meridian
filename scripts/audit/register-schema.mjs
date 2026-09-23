/**
 * F11 · A REQUEST REGISTER MATCHES ITS PUBLISHED SHAPE  (V-12 · RT365, REQ-31)
 *
 * `meridian-request-register/1` was a string that appeared in one file and
 * was defined nowhere: the field repository mirrored the shape field for
 * field from an example, and nothing in this repository would have noticed
 * if a round had quietly dropped `measure`, renamed `remaining` or written
 * `accepted: "no"`. A contract that only exists as an example is not a
 * contract, and a loop the field cannot re-implement is an anecdote.
 *
 * This gate reads docs/requests/register.schema.json and holds every
 * register in docs/requests/ to it — the live one and any second field
 * repository that files one — plus the two invariants a schema cannot
 * state: an id appears once, and no round is dated from the future of the
 * register version it claims.
 *
 *   node scripts/audit/register-schema.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { validate } from "../lib/jsonschema.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "docs/requests");
const SCHEMA_FILE = "docs/requests/register.schema.json";
const SCHEMA_ID = "meridian-request-register/1";

const schema = JSON.parse(fs.readFileSync(path.join(root, SCHEMA_FILE), "utf8"));
const problems = [];
const checked = [];

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== path.basename(SCHEMA_FILE)).sort();

console.log(`\n═══ F11 · every request register matches ${SCHEMA_ID} ═══\n`);

if (schema.$id !== SCHEMA_ID) {
  problems.push(`${SCHEMA_FILE} declares $id ${JSON.stringify(schema.$id)}, expected ${JSON.stringify(SCHEMA_ID)}`);
}
if (!files.length) problems.push(`${dir} holds no register — the loop has no field repository`);

for (const f of files) {
  const rel = `docs/requests/${f}`;
  let register;
  try { register = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
  catch (e) { problems.push(`${rel} is not readable JSON: ${e.message}`); continue; }

  /* A file in this directory that claims another shape is not this gate's
     business; one that claims none is, because the register mechanism is
     how a request stays visible. */
  if (register.$schema !== SCHEMA_ID) {
    problems.push(`${rel} declares $schema ${JSON.stringify(register.$schema ?? null)} — ` +
      `a register in docs/requests/ carries ${SCHEMA_ID}`);
    continue;
  }

  /* A reader chases `REQ-13`, never `requests[12]`. */
  const named = (where) => where.replace(/^requests\[(\d+)\]/,
    (m, i) => `requests[${register.requests?.[Number(i)]?.id ?? i}]`);
  for (const p of validate(schema, register)) problems.push(`${rel} · ${named(p.path)}: ${p.message}`);

  const seen = new Set();
  for (const r of register.requests ?? []) {
    if (seen.has(r.id)) problems.push(`${rel} · ${r.id} appears twice — an id names one request`);
    seen.add(r.id);
    for (const h of r.history ?? []) {
      if (h.registerVersion > register.registerVersion) {
        problems.push(`${rel} · ${r.id}: a history row claims registerVersion ${h.registerVersion}, ` +
          `the register is at ${register.registerVersion}`);
      }
    }
  }

  const states = (v) => (register.requests ?? []).filter((r) => r.accepted === v).length;
  checked.push(`${rel.padEnd(34)} v${String(register.registerVersion).padEnd(3)} ` +
    `${String((register.requests ?? []).length).padStart(3)} request(s) · ` +
    `accepted ${states(true)} / not accepted ${states(false)} / cannot answer yet ${states(null)}`);
}

console.log(`  · ${SCHEMA_FILE} — ${Object.keys(schema.$defs ?? {}).length} shared definition(s)`);
for (const line of checked) console.log(`  · ${line}`);
if (problems.length) {
  console.log("");
  for (const p of problems) console.log(`  ✖ ${p}`);
}
console.log(`\n${problems.length} register violation(s).`);
if (problems.length) {
  console.log(`The shape is published in ${SCHEMA_FILE}; the round is documented in docs/35-field-return-loop.md.`);
}
console.log("");
process.exit(problems.length ? 1 : 0);

/**
 * NEW-26 — a new project is scaffolded on the ladder that governs it.
 *
 * Witness: KODO's book declares its portfolio model in `settings.gates`
 * (G0 Mandate … G6), no programme ladder. The engine governs every KODO
 * project by that model (MER-01, Engine.gateModel), but a project created
 * in the app was scaffolded from the programme only, then the default four:
 * it was born with G1–G4 milestones on a portfolio that reviews G0–G6.
 * The fallback order is now programme → portfolio → default, the same as
 * Engine.gates.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { one, many, query } from "../src/db.js";
import { Engine, GATES } from "../../shared/engine.js";
import { resolveLadder } from "../src/wbs.js";

let admin;
before(async () => { await boot(); admin = await as("admin"); });
after(async () => {
  await query(`DELETE FROM app_setting WHERE key = 'gates'`);
  await shutdown();
});

/* KODO's model as its book carries it: numbered from 0, `at` given. */
const KODO = [
  { n: 0, name: "G0 — Mandate", at: 0.02, owner: "Chair", evidence: "Committee seated, glossary agreed" },
  { n: 1, name: "G1 — Cahier des charges", at: 0.08, owner: "Product Owner", evidence: "Spec accepted" },
  { n: 2, name: "G2 — Module prompts", at: 0.12, owner: "Seats 8, 9", evidence: "18 prompts" },
  { n: 3, name: "G3 — Build & integrate", at: 0.35, owner: "Seat 14", evidence: "Vertical slice running" },
  { n: 4, name: "G4 — Release", at: 0.9, owner: "Chair", evidence: "Release dossier" },
];

const bareProgramme = async () =>
  (await one(`SELECT id FROM programme WHERE gate_model IS NULL ORDER BY id LIMIT 1`)).id;

const create = async (name) => {
  const r = await admin.post("/api/projects", {
    name, programme: await bareProgramme(), site: "LON", governanceLevel: "group",
    start: "2026-10-01", finish: "2027-09-30", budget: 1, contingency: 0.1,
  });
  assert.equal(r.status, 201, r.text);
  return r.body.id;
};

const gatesOf = async (id) =>
  many(`SELECT gate, name, due_date FROM milestone WHERE project_id = $1 AND kind = 'gate' ORDER BY gate`, [id]);

describe("NEW-26 · the portfolio ladder scaffolds a project whose programme has none", () => {
  test("pure: programme first, then portfolio, then the default four", () => {
    const prog = [{ name: "P1", at: 0.5 }];
    assert.deepEqual(resolveLadder(JSON.stringify(prog), KODO).map((g) => g.name), ["P1"]);
    assert.deepEqual(resolveLadder(null, KODO).map((g) => g.n), [0, 1, 2, 3, 4]);
    assert.deepEqual(resolveLadder(null, JSON.stringify(KODO)), Engine.gateModel({ settings: { gates: KODO } }));
    assert.equal(resolveLadder(null, null), GATES);
    assert.equal(resolveLadder(null, []), GATES);
    assert.equal(resolveLadder("not json", null), GATES, "an unreadable programme ladder reads as none, as before");
  });

  test("without a portfolio model, a new project still gets the default four (nothing existing moves)", async () => {
    const id = await create("No portfolio model");
    assert.deepEqual((await gatesOf(id)).map((m) => m.gate), GATES.map((g) => g.n));
  });

  test("with a portfolio model, the new project's gates are the ones the engine governs it by", async () => {
    await query(`INSERT INTO app_setting (key, value) VALUES ('gates', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(KODO)]);
    const id = await create("KODO module");
    const ms = await gatesOf(id);
    const db = (await admin.get("/api/bootstrap")).body.db;
    const governed = Engine.gateModel(db);
    assert.deepEqual(ms.map((m) => m.gate), governed.map((g) => g.n), "G0–G4, not G1–G4");
    assert.deepEqual(ms.map((m) => m.name), KODO.map((g) => g.name));
    assert.equal(String(ms[0].due_date).slice(0, 10) < String(ms[4].due_date).slice(0, 10), true);
    const p = await one(`SELECT scaffolded_gates FROM project WHERE id = $1`, [id]);
    assert.equal(p.scaffolded_gates, KODO.length);
    const docs = await many(`SELECT gate FROM document WHERE project_id = $1 ORDER BY gate`, [id]);
    assert.deepEqual(docs.map((d) => d.gate), [0, 1, 2, 3, 4], "one evidence draft per governed gate");
  });
});

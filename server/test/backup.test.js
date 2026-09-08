/**
 * I-6 · LA SAUVEGARDE ET LA RESTAURATION ÉPROUVÉE (retour de terrain RT365,
 * docs/33 · M-08 · G-01). Le dossier d'exploitation dit « sauvegarde
 * testée » ; ceci teste l'outil qui la teste, sur le moteur embarqué.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { boot, shutdown, as } from "./harness.js";
import { backup, drill, counts, compareCounts, record, lastDrill } from "../src/backup.js";

before(async () => { await boot(); });
after(shutdown);

describe("I-6 · sauvegarder, recharger ailleurs, recompter", () => {
  let file, expected;
  test("la sauvegarde PGlite est une archive du répertoire de données", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-bk-"));
    const out = await backup({ dir, url: null });
    assert.equal(out.engine, "pglite");
    assert.ok(fs.existsSync(out.file));
    assert.ok(out.bytes > 10_000, "un livre semé pèse quelque chose");
    file = out.file;
    expected = await counts();
    assert.ok(expected.project > 0 && expected.audit_event > 0);
  });

  test("la restauration recharge AILLEURS et retrouve chaque table à l'identique, chronométrée", async () => {
    const out = await drill({ file, url: null, expected });
    assert.equal(out.ok, true, JSON.stringify(out.mismatches));
    assert.equal(out.found.project, expected.project);
    assert.equal(out.found.audit_event, expected.audit_event);
    assert.ok(out.restoreSeconds >= 0);
    /* Le livre vivant n'a pas bougé : la restauration est ailleurs. */
    const again = await counts();
    assert.deepEqual(again, expected);
  });

  test("un écart se nomme ; le résultat s'écrit là où la santé le lit", async () => {
    const cmp = compareCounts({ project: 12, audit_event: 40 }, { project: 12, audit_event: 39 });
    assert.equal(cmp.ok, false);
    assert.deepEqual(cmp.mismatches, [{ table: "audit_event", expected: 40, found: 39 }]);
    const saved = await record({ at: "2026-09-08T10:00:00.000Z", ok: true, restoreSeconds: 1.2, file, mismatches: [] });
    assert.equal(saved.ok, true);
    assert.deepEqual(await lastDrill(), saved);
    const c = await as(null);
    const h = (await c.get("/api/health")).body;
    assert.equal(h.backup.lastDrillAt, "2026-09-08T10:00:00.000Z", "SaaS-04 : la supervision lit la dernière restauration ÉPROUVÉE");
    assert.equal(h.backup.ok, true);
    assert.equal(h.backup.restoreSeconds, 1.2);
  });

  test("un fichier absent est un refus clair", async () => {
    await assert.rejects(() => drill({ file: "/nonexistent.tar.gz", url: null }), /No such backup file/);
  });
});

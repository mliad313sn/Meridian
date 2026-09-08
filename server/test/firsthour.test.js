/**
 * I-1 · LA PREMIÈRE HEURE — retour de terrain RT365 (docs/33, M-01..M-03).
 *
 * Le terrain a mesuré quarante minutes perdues par un nouveau venu, et un
 * livre perdu au redémarrage : `.env` n'était jamais lu, PGlite tombait
 * en mémoire sans le dire, le répertoire de données ne se créait pas, et
 * la racine répondait « Cannot GET / ». Ces tests tiennent les quatre
 * réponses.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { boot, shutdown, as } from "./harness.js";
import { loadEnv, resetEnvLoader, resolveDataDir, DEFAULT_PGLITE_DIR, packageVersion } from "../src/env.js";
import { productionEngineRefusal, engineRefusal } from "../src/index.js";

before(async () => { await boot(); });
after(shutdown);

describe("I-1 · .env est lu, et le shell gagne", () => {
  test("une variable du fichier est posée ; une variable déjà posée n'est pas écrasée", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-env-"));
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, "MERIDIAN_TEST_FROM_FILE=file\nPORT=9999\n# comment\n");
    const before = process.env.PORT;
    process.env.PORT = "4173";
    delete process.env.MERIDIAN_TEST_FROM_FILE;
    resetEnvLoader();
    const set = loadEnv({ file });
    assert.deepEqual(set, ["MERIDIAN_TEST_FROM_FILE"], "seule la variable absente est posée");
    assert.equal(process.env.MERIDIAN_TEST_FROM_FILE, "file");
    assert.equal(process.env.PORT, "4173", "le shell l'emporte sur le fichier");
    assert.deepEqual(loadEnv({ file }), [], "une seule lecture — la seconde est un no-op");
    if (before === undefined) delete process.env.PORT; else process.env.PORT = before;
    delete process.env.MERIDIAN_TEST_FROM_FILE;
    resetEnvLoader();
  });

  test("un .env absent n'est pas une erreur", () => {
    resetEnvLoader();
    assert.deepEqual(loadEnv({ file: "/nonexistent/.env" }), []);
    resetEnvLoader();
  });
});

describe("I-1 · le livre a toujours une adresse", () => {
  test("sans rien, c'est server/.data/pgdata — jamais la mémoire", () => {
    const dir = resolveDataDir(undefined, {});
    assert.equal(dir, DEFAULT_PGLITE_DIR);
    assert.ok(fs.existsSync(dir), "le répertoire est créé (M-02 : PGlite ne crée pas les parents)");
  });

  test("PGLITE_DIR est honoré et créé, parents compris", () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-dd-"));
    const want = path.join(base, "deep", "er", "pgdata");
    const dir = resolveDataDir(undefined, { PGLITE_DIR: want });
    assert.equal(dir, want);
    assert.ok(fs.existsSync(want));
  });

  test("la mémoire se DEMANDE — MERIDIAN_EPHEMERAL=1, ou null explicite", () => {
    assert.equal(resolveDataDir(undefined, { MERIDIAN_EPHEMERAL: "1", PGLITE_DIR: "/x" }), null);
    assert.equal(resolveDataDir(null, { PGLITE_DIR: "/x" }), null, "le harnais de test dit null et veut null");
    assert.equal(resolveDataDir(undefined, { PGLITE_DIR: "   " }), DEFAULT_PGLITE_DIR,
      "une variable vide n'est pas un chemin");
  });

  test("/api/health dit quand le livre est en mémoire", async () => {
    const c = await as(null);
    const r = await c.get("/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.engine, "pglite");
    assert.equal(r.body.ephemeral, true, "le harnais tourne en mémoire, et la santé le dit");
    assert.equal(r.body.version, packageVersion(), "I-9 : le numéro du paquet, pas « dev »");
    assert.equal(r.body.build, "sources");
    assert.equal(typeof r.body.instance.migrations, "number", "SaaS-04 : l'identité de l'instance");
    assert.ok(r.body.instance.migrations > 30);
    assert.equal(r.body.backup.lastDrillAt, null, "aucune restauration éprouvée encore — dit, pas caché");
  });
});

describe("I-6 · la production ne tourne pas sur le moteur d'essai par accident", () => {
  test("NODE_ENV=production + PGlite → refus qui dit quoi faire", () => {
    const r = productionEngineRefusal({ NODE_ENV: "production" }, "pglite");
    assert.ok(r, "refusé");
    assert.match(r, /DATABASE_URL/);
    assert.match(r, /restore-drill/);
    assert.match(r, /MERIDIAN_ALLOW_PGLITE=1/);
  });
  test("…sauf décision explicite, ou terrain d'apprentissage, ou PostgreSQL", () => {
    assert.equal(productionEngineRefusal({ NODE_ENV: "production", MERIDIAN_ALLOW_PGLITE: "1" }, "pglite"), null);
    assert.equal(productionEngineRefusal({ NODE_ENV: "production", MERIDIAN_TRAINING: "1" }, "pglite"), null);
    assert.equal(productionEngineRefusal({ NODE_ENV: "production" }, "postgres"), null);
    assert.equal(productionEngineRefusal({ NODE_ENV: "development" }, "pglite"), null);
    /* PG-01 reste ce qu'il était. */
    assert.ok(engineRefusal("1", "pglite"));
    assert.equal(engineRefusal("1", "postgres"), null);
  });
});

describe("I-1 · la racine sans client construit explique, au lieu de « Cannot GET / »", () => {
  test("503 avec la commande à lancer", async () => {
    /* Le harnais n'a pas de web/dist sous MERIDIAN_WEB_DIST : on force
       un chemin inexistant pour tenir la branche « pas construit ». */
    const { buildApp } = await import("../src/index.js");
    const prev = process.env.MERIDIAN_WEB_DIST;
    process.env.MERIDIAN_WEB_DIST = "/nonexistent/web/dist";
    try {
      const app = buildApp();
      const srv = app.listen(0);
      await new Promise((r) => srv.once("listening", r));
      const res = await fetch(`http://127.0.0.1:${srv.address().port}/`);
      const html = await res.text();
      assert.equal(res.status, 503);
      assert.match(html, /npm run build/);
      assert.match(html, /API is up/);
      await new Promise((r) => srv.close(r));
    } finally {
      if (prev === undefined) delete process.env.MERIDIAN_WEB_DIST; else process.env.MERIDIAN_WEB_DIST = prev;
    }
  });
});

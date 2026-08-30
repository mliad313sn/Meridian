/**
 * A-08 — la mesure de l'adoption.
 *
 * Six indicateurs par site, ceux que la réserve nomme. Ce qui est tenu
 * ici : les chiffres se calculent sur le livre réel, un site muet est
 * nommé, la lecture est réservée au niveau groupe, et rien n'est
 * nominatif — mesurer l'usage d'un outil n'est pas surveiller ceux qui
 * s'en servent.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { adoptionBySite, countUsage, QUIET_DAYS } from "../src/adoption.js";
import { many } from "../src/db.js";

before(async () => { await boot(); });
after(shutdown);

test("A-08 — les six indicateurs sortent, par site, sur le livre réel", async () => {
  const out = await adoptionBySite({});
  assert.ok(out.sites.length >= 8, `les huit sites sont mesurés (${out.sites.length})`);
  assert.equal(out.windowDays, 30);
  assert.equal(out.quietDays, QUIET_DAYS);

  const s = out.sites[0];
  /* 1 · comptes · 2 · silence · 3 · comités · 4 · actions · 5 · semaines */
  for (const k of ["accountsOpened", "accountsSeen", "meetingsPlanned", "meetingsHeld",
                   "actionsRaised", "actionsClosed", "weeksFilled", "weeksExpected"]) {
    assert.equal(typeof s[k], "number", `${k} est un nombre`);
  }
  assert.ok("quietFor" in s && "quiet" in s);
  /* 6 · les refus, au portefeuille */
  assert.ok("total" in out.refusals && "perActiveUser" in out.refusals);
});

test("A-08 — un site sans avancement depuis trente jours est NOMMÉ", async () => {
  const out = await adoptionBySite({});
  /* Le livre amorcé n'a aucune activité d'aujourd'hui : tous les sites
     sont donc silencieux, et c'est exactement ce que la mesure doit dire
     plutôt que de rassurer. */
  assert.ok(Array.isArray(out.quietSites));
  assert.ok(out.quietSites.length >= 1, "le silence se voit");
  const quiet = out.sites.find((x) => x.quiet);
  assert.ok(quiet, "et il porte un nom de site");
  assert.equal(typeof quiet.site, "string");
});

test("A-08 — un refus est compté, sans dire qui ni sur quoi", async () => {
  const before0 = await many(
    `SELECT coalesce(sum(n), 0)::int AS n FROM usage_daily WHERE kind = 'refusal'`);

  /* Un vrai refus, par le vrai chemin : un lecteur qui tente d'écrire. */
  const viewer = await as("viewerGRU");
  const r = await viewer.post("/api/raid",
    { project: SITE_PROJECT_GRU, type: "Risk", title: "Refusé", p: 2, i: 2 });
  assert.equal(r.status, 403);

  await new Promise((res) => setTimeout(res, 120));   // le compteur ne bloque pas la réponse
  const after0 = await many(
    `SELECT coalesce(sum(n), 0)::int AS n FROM usage_daily WHERE kind = 'refusal'`);
  assert.ok(after0[0].n > before0[0].n, "le refus est compté");

  const cols = await many(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_daily'`);
  const names = cols.map((c) => c.column_name).sort();
  assert.deepEqual(names, ["day", "kind", "n"],
    "et la table ne PEUT pas dire qui : il n'y a pas de colonne pour cela");
});

test("A-08 — la mesure est réservée au niveau groupe", async () => {
  const group = await as("groupDCH");
  const ok = await group.get("/api/adoption");
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(Array.isArray(ok.body.sites));

  const site = await as("siteGRU");
  assert.equal((await site.get("/api/adoption")).status, 403);
  const viewer = await as("viewerGRU");
  assert.equal((await viewer.get("/api/adoption")).status, 403);
});

test("A-08 — la fenêtre se choisit, et la réponse porte sa date", async () => {
  const group = await as("groupDCH");
  const r = await group.get("/api/adoption?days=90");
  assert.equal(r.body.windowDays, 90);
  assert.match(r.body.asAt, /^\d{4}-\d{2}-\d{2}$/, "une ligne de base se date");
});

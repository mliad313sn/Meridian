/**
 * N-06 — la survie hors ligne, en lecture seule.
 *
 * Ce que ces tests tiennent : l'instantané est écrit à chaque chargement
 * réussi, relu quand le serveur ne répond plus, effacé à la déconnexion,
 * et — la garantie qui compte — AUCUNE commande d'écriture n'est dessinée
 * tant qu'on lit un instantané.
 *
 * Ce qu'ils ne tiennent pas : le comportement de l'agent de service, qui
 * demande un vrai navigateur. Il est écrit, servi et sans conséquence
 * s'il échoue ; son effet reste à constater sur un poste de site.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";

/* Un navigateur juste assez réel pour ce que le module touche. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = { documentElement: {} };

const { App, clearSnapshot } = await import("../../web/src/lib/state.js");
const { api } = await import("../../web/src/lib/api.js");

const BOOK = { projects: [{ id: "PRJ-1", name: "Un projet", site: "GRU", governanceLevel: "site" }],
               raid: [], crs: [], docs: [], items: [], people: [], sites: [], settings: {} };
const ME = { id: "U-1", name: "G. Silva", role: "site", personId: "PE-19",
             grants: { programmes: [], sites: ["GRU"] } };

let realBootstrap;
before(() => { realBootstrap = api.bootstrap; });
after(() => { api.bootstrap = realBootstrap; });

test("N-06 — un chargement réussi laisse un instantané, portant le compte", async () => {
  store.clear();
  api.bootstrap = async () => ({ db: BOOK, me: ME });
  await App.load();
  assert.equal(App.offline, null, "en ligne, rien à signaler");
  const snap = JSON.parse(localStorage.getItem("meridian-snapshot"));
  assert.equal(snap.who, "U-1");
  assert.equal(snap.db.projects[0].id, "PRJ-1");
  assert.ok(snap.at, "et l'heure à laquelle il a été pris");
});

test("N-06 — le serveur muet : on rend ce qu'on savait, en le datant", async () => {
  api.bootstrap = async () => { throw Object.assign(new Error("Failed to fetch"), { status: undefined }); };
  await App.load();
  assert.ok(App.offline, "l'application sait qu'elle lit un instantané");
  assert.equal(App.db.projects[0].id, "PRJ-1", "et le livre est là");
});

test("N-06 — hors ligne, aucune commande d'écriture n'est dessinée", () => {
  assert.ok(App.offline, "on est bien sur l'instantané");
  assert.equal(App.can("project.write", { project: App.db.projects[0] }), false);
  assert.equal(App.canWrite(App.db.projects[0]), false);
  /* La règle R7.3 fait le reste sans code nouveau : un contrôle qu'on ne
     peut pas utiliser n'est pas dessiné — pas grisé, absent. */
});

test("N-06 — une session expirée n'est pas une coupure : il faut se reconnecter", async () => {
  api.bootstrap = async () => { throw Object.assign(new Error("Sign in to continue"), { status: 401 }); };
  await assert.rejects(() => App.load(), /Sign in|401/,
    "un instantané ne remplace jamais une session");
});

test("N-06 — la liaison revient : l'application cesse de se dire hors ligne", async () => {
  api.bootstrap = async () => ({ db: BOOK, me: ME });
  await App.load();
  assert.equal(App.offline, null, "plus de bandeau, plus d'instantané à l'écran");
  /* Et la décision d'autorité repart dans rbac : le refus n'est plus
     systématique, il redevient celui que le serveur dirait. */
  const was = App.me;
  App.me = { ...ME, role: "admin" };
  assert.equal(App.can("project.read", { project: App.db.projects[0] }), true,
    "en ligne, c'est l'autorité qui répond, pas la coupure");
  App.me = was;
});

test("N-06 / A-03 — l'instantané part avec la session : un poste partagé ne garde rien", () => {
  assert.ok(localStorage.getItem("meridian-snapshot"));
  clearSnapshot();
  assert.equal(localStorage.getItem("meridian-snapshot"), null);
});

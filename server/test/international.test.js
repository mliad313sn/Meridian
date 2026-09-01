/**
 * Comité 29 · PG-01, I18N-01, MC-01 — les trois lignes livrées avec le
 * rapport international/SaaS.
 *
 *   · PG-01  une installation de service refuse PGlite au lieu de tourner
 *            en silence sur le mauvais moteur ;
 *   · I18N-01 la liste des langues est une donnée, plus une condition en
 *            dur — et la base contraint une FORME, plus une liste ;
 *   · MC-01  un site sait dire son pays et son entité légale, parce que
 *            G-14 et le RGPD posent des questions PAR PAYS et PAR ENTITÉ.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as, client } from "./harness.js";
import { one, query, migrate } from "../src/db.js";
import { engineRefusal } from "../src/index.js";
import { localeOf, say, SERVER_LANGS } from "../src/i18n.js";
import { LANGS, getLang, setLang, nextLang, t } from "../../web/src/lib/i18n.js";

before(async () => { await boot(); });
after(shutdown);

describe("PG-01 · le service refuse PGlite", () => {
  test("le drapeau posé + PGlite = refus, avec un message qui dit quoi faire", () => {
    const r = engineRefusal("1", "pglite");
    assert.ok(r, "l'installation de service ne tourne pas sur un moteur d'essai");
    assert.match(r, /DATABASE_URL/, "le message dit le réglage qui manque");
    assert.match(r, /single-connection/, "et pourquoi PGlite est inacceptable ici");
  });

  test("PostgreSQL passe, et l'absence du drapeau laisse la démo vivre", () => {
    assert.equal(engineRefusal("1", "postgres"), null);
    assert.equal(engineRefusal(undefined, "pglite"), null,
      "sans le drapeau, la démo et le terrain d'entraînement gardent PGlite");
    assert.equal(engineRefusal("0", "pglite"), null);
  });
});

describe("I18N-01 · la langue est un registre, pas une condition", () => {
  test("le registre porte au moins EN et FR, et le cycle en fait le tour", () => {
    assert.ok(LANGS.some((l) => l.code === "en"));
    assert.ok(LANGS.some((l) => l.code === "fr"));
    /* Le commutateur affiche la langue vers laquelle il bascule ; le
       cycle doit revenir à son point de départ en |LANGS| pas. */
    setLang("en");
    const seen = [];
    for (let i = 0; i < LANGS.length; i++) { seen.push(getLang()); setLang(nextLang().code); }
    assert.equal(getLang(), "en", "le cycle est un cycle");
    assert.deepEqual([...new Set(seen)].length, LANGS.length, "chaque langue est atteinte");
  });

  test("une langue inconnue retombe sur l'anglais, jamais sur un écran cassé", () => {
    setLang("xx");
    assert.equal(getLang(), "en");
    setLang("fr");
    assert.equal(t("Sign in"), "Se connecter", "le dictionnaire répond via le registre");
    setLang("en");
    assert.equal(t("Sign in"), "Sign in");
  });

  test("le serveur a SA liste, et un code hors liste répond en anglais", () => {
    assert.deepEqual(SERVER_LANGS, ["en", "fr", "es"],
      "une langue n'entre ici qu'avec ses messages serveur — répondre à moitié est pire");
    assert.equal(localeOf({ headers: { "x-lang": "pt" }, query: {} }), "en",
      "le portugais attend son dictionnaire serveur (I18N-03) — d'ici là, anglais");
    assert.equal(localeOf({ headers: { "x-lang": "fr" }, query: {} }), "fr");
    assert.equal(localeOf({ headers: { "x-lang": "es" }, query: {} }), "es");
  });

  test("le refus 401 traverse say() sur la VRAIE route — trouvé en anglais sur la 5.8.0 vivante", async () => {
    /* requireUser() répondait par res.json() direct : le gestionnaire
       global est le SEUL endroit où say() tourne, donc la toute première
       phrase qu'un appelant non authentifié lisait restait en anglais,
       quelle que soit sa langue. */
    const anon = client();
    const es = await anon.get("/api/bootstrap", { "X-Lang": "es" });
    assert.equal(es.status, 401);
    assert.equal(es.body.error, "Inicie sesión para continuar");
    const fr = await anon.get("/api/bootstrap", { "X-Lang": "fr" });
    assert.equal(fr.body.error, "Connectez-vous pour continuer");
    const en = await anon.get("/api/bootstrap");
    assert.equal(en.body.error, "Sign in to continue");
  });

  test("I18N-02 · l'espagnol répond en espagnol — refus exact et préfixe porteur de données", () => {
    assert.equal(say("Sign in to continue", "es"), "Inicie sesión para continuar");
    assert.equal(say("No such project", "es"), "Proyecto no encontrado");
    /* Un préfixe qui porte des données : la donnée traverse intacte. */
    assert.equal(say("The evidence link points at evil.example", "es"),
      "El enlace de la evidencia apunta a evil.example");
    /* Le contrat de repli tient pour chaque langue : inconnu = anglais. */
    assert.equal(say("some unregistered sentence", "es"), "some unregistered sentence");
    /* Et le français n'a pas bougé en généralisant say(). */
    assert.equal(say("Sign in to continue", "fr"), "Connectez-vous pour continuer");
  });

  test("la base accepte désormais un code de langue par sa FORME", async () => {
    /* La 015 posait CHECK (locale IN ('','en','fr')) : l'espagnol aurait
       exigé une migration par langue. La 027 contraint la forme. */
    await query(`UPDATE app_user SET locale = 'es' WHERE id = 'U-ADMIN'`);
    const row = await one(`SELECT locale FROM app_user WHERE id = 'U-ADMIN'`);
    assert.equal(row.locale, "es", "un code à venir n'exige plus de migration");
    await query(`UPDATE app_user SET locale = '' WHERE id = 'U-ADMIN'`);

    await assert.rejects(
      () => query(`UPDATE app_user SET locale = 'français' WHERE id = 'U-ADMIN'`),
      /violates|check/i, "mais une non-forme reste refusée à la base");
  });
});

describe("MC-01 · le pays et l'entité légale d'un site", () => {
  test("l'aller-retour complet, par les vraies routes", async () => {
    const admin = await as("admin");
    const before = (await admin.get("/api/bootstrap")).body.db.sites.find((s) => s.id === "GRU");
    assert.equal(before.country, "", "le semis ne devine pas un pays");

    const r = await admin.patch("/api/admin/sites/GRU", {
      country: "br", legalEntity: "Meridian Mineração Ltda.", version: before.version,
    });
    assert.equal(r.status, 200, r.text);

    const after = (await admin.get("/api/bootstrap")).body.db.sites.find((s) => s.id === "GRU");
    assert.equal(after.country, "BR", "le code est remis en majuscules — br et BR sont le même pays");
    assert.equal(after.legalEntity, "Meridian Mineração Ltda.");
  });

  test("un code qui n'a pas la forme d'un pays est refusé en français d'humain", async () => {
    const admin = await as("admin");
    const s = (await admin.get("/api/bootstrap")).body.db.sites.find((x) => x.id === "YYZ");
    const r = await admin.patch("/api/admin/sites/YYZ",
      { country: "Canada", version: s.version });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /two-letter ISO code/i,
      "le refus parle à la personne, pas en SQL");
  });

  test("vider le pays reste possible — ne pas savoir n'est pas une erreur", async () => {
    const admin = await as("admin");
    const s = (await admin.get("/api/bootstrap")).body.db.sites.find((x) => x.id === "GRU");
    const r = await admin.patch("/api/admin/sites/GRU", { country: "", version: s.version });
    assert.equal(r.status, 200);
    const after = (await admin.get("/api/bootstrap")).body.db.sites.find((x) => x.id === "GRU");
    assert.equal(after.country, "", "un code pays FAUX classe faux ; un code vide classe pas");
  });
});

describe("SaaS-02 · un binaire ancien refuse une base plus récente", () => {
  test("une migration inconnue en base bloque net, avec son nom dans le message", async () => {
    /* Le piège vécu : la passation a failli appliquer la 023 sous le
       binaire de production qui lisait encore l'ancienne colonne. Un
       refus net ici est ce qui rend une montée de version ratée bruyante
       au lieu de sournoise. */
    await query(`INSERT INTO schema_migration (name) VALUES ('999_future.sql')`);
    try {
      await assert.rejects(() => migrate({ silent: true }), (e) => {
        assert.match(e.message, /999_future\.sql/, "le message nomme ce que la base porte");
        assert.match(e.message, /older than the database/i);
        return true;
      });
    } finally {
      await query(`DELETE FROM schema_migration WHERE name = '999_future.sql'`);
    }
    /* Et une fois la base revenue à ce que le binaire connaît, tout
       repart : le refus était le décalage, pas un verrou. */
    assert.deepEqual(await migrate({ silent: true }), []);
  });
});

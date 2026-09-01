/**
 * LE PARCOURS — comité de recette des processus (docs/32).
 *
 * Un seul chemin ordonné, du geste de mise en production jusqu'à
 * l'archive, par les vraies routes et sous les bons rôles. Ce que les
 * suites unitaires ne voient pas vit dans les COUTURES : ce que l'étape
 * N suppose que l'étape N-1 a laissé. Ici, rien n'est semé d'avance —
 * chaque objet dont une étape a besoin a été créé par une étape
 * précédente, comme dans la vraie vie d'une organisation qui commence.
 *
 * Deux affirmations par étape : le flux PASSE, et le refus promis par le
 * registre est bien opposé (au sceptique, au mal-ordonné, à
 * l'auto-approbation).
 *
 * Les tests d'un même fichier s'exécutent dans l'ordre — c'est le
 * contrat de node:test, et ce fichier en dépend à dessein.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, client } from "./harness.js";
import { resetBook } from "../src/reset-book.js";
import { many } from "../src/db.js";

before(async () => {
  await boot();
  /* Le vrai geste du 29/08 : la démo s'en va, un compte survit, forcé
     de prouver son mot de passe avant d'écrire. */
  await resetBook();
});
after(async () => { await shutdown(); });

/* Les acteurs, créés PAR le parcours. Chacun garde son client (cookies). */
const dir = client();      // la directrice — le compte survivant, admin
let pmo;                   // bureau de programme (group, LIM)
let lead;                  // chef de site (site, ARE)
let viewer;                // lectrice (viewer, ARE)

let SITE, PROG, PM_ID, SPONSOR_ID, OPS_ID; // structure
let PROJECT;                                // le projet du parcours

describe("0 · la mise en production tient ses promesses", () => {
  test("le livre est vide, le compte survivant existe, la démo est désactivée", async () => {
    const projects = await many(`SELECT count(*)::int AS n FROM project`);
    assert.equal(projects[0].n, 0, "plus aucun projet de démonstration");
    const users = await many(
      `SELECT count(*)::int AS n FROM app_user WHERE active`);
    assert.equal(users[0].n, 1, "un seul compte actif après le vidage");
  });

  test("S-10 · l'admin se connecte mais NE PEUT PAS écrire avant d'avoir choisi son mot de passe", async () => {
    const r = await dir.post("/api/auth/login",
      { email: "admin@meridian.example", password: "meridian-admin-2026" });
    assert.equal(r.status, 200, "l'ancien mot de passe ouvre la porte…");
    const w = await dir.post("/api/admin/sites", { id: "ARE", city: "Arequipa" });
    assert.equal(w.status, 403, "…mais n'autorise aucune écriture");
    assert.match(w.body.error, /password|mot de passe/i);
  });

  test("le mot de passe changé, l'écriture s'ouvre", async () => {
    const r = await dir.post("/api/auth/password",
      { current: "meridian-admin-2026", next: "presidencia-lima-2026" });
    assert.equal(r.status, 200);
  });
});

describe("1 · réglages de base — avant toute donnée", () => {
  test("seuils de gouvernance et hôtes documentaires", async () => {
    const r = await dir.patch("/api/admin/settings", {
      changeControlThreshold: 0.25,
      documentHosts: "evidence.lima-mining.example",
      statusDate: "2026-09-01",
    });
    assert.equal(r.status, 200);
  });
});

describe("2 · la structure — site, programme, personnes", () => {
  test("un site avec son pays et son entité légale (MC-01)", async () => {
    const r = await dir.post("/api/admin/sites", { id: "ARE", city: "Arequipa" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const boot1 = await dir.get("/api/bootstrap");
    const site = boot1.body.db.sites.find((s) => s.id === "ARE");
    const c = await dir.patch("/api/admin/sites/ARE",
      { country: "pe", legalEntity: "Minera Lima SAC", version: site.version });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    SITE = "ARE";
  });

  test("un programme", async () => {
    const r = await dir.post("/api/admin/programmes", { id: "LIM", name: "Lima Modernisation" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    PROG = "LIM";
  });

  test("les personnes qui feront le travail", async () => {
    const mk = (name, site) => dir.post("/api/admin/people",
      { name, site, role: "Engineer", fte: 1 });
    const a = await mk("P. Quispe", SITE);
    assert.equal(a.status, 201, JSON.stringify(a.body));
    PM_ID = a.body.person?.id ?? a.body.id;
    const b = await mk("R. Mamani", SITE);
    SPONSOR_ID = b.body.person?.id ?? b.body.id;
    const c = await mk("S. Huamán", SITE);
    OPS_ID = c.body.person?.id ?? c.body.id;
    assert.ok(PM_ID && SPONSOR_ID && OPS_ID, "trois personnes créées");
  });
});

describe("3 · comptes et habilitations", () => {
  test("groupe, site, lecteur — chacun voit selon son niveau", async () => {
    const g = await dir.post("/api/admin/users", {
      email: "pmo@lima-mining.example", displayName: "Bureau de programme",
      role: "group", password: "pmo-password-2026",
      grants: [{ kind: "programme", target: PROG }],
    });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    const s = await dir.post("/api/admin/users", {
      email: "lead@lima-mining.example", displayName: "Chef de site ARE",
      role: "site", password: "lead-password-2026", personId: PM_ID,
      grants: [{ kind: "site", target: SITE }],
    });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    const v = await dir.post("/api/admin/users", {
      email: "viewer@lima-mining.example", displayName: "Lectrice",
      role: "viewer", password: "viewer-password-2026",
    });
    assert.equal(v.status, 201, JSON.stringify(v.body));

    pmo = client(); lead = client(); viewer = client();
    /* Un compte provisionné prouve son mot de passe avant d'agir (I4). */
    for (const [c, email, pw] of [
      [pmo, "pmo@lima-mining.example", "pmo-password-2026"],
      [lead, "lead@lima-mining.example", "lead-password-2026"],
      [viewer, "viewer@lima-mining.example", "viewer-password-2026"],
    ]) {
      assert.equal((await c.post("/api/auth/login", { email, password: pw })).status, 200);
      const ch = await c.post("/api/auth/password", { current: pw, next: pw + "-mine" });
      assert.equal(ch.status, 200, email);
    }
  });

  test("la lectrice ne peut rien écrire — pas même une demande ? Si : la demande est ouverte à tous SAUF lecture seule", async () => {
    const r = await viewer.post("/api/demand",
      { title: "x", sponsor: "y", site: SITE, estCost: 0.1, benefitNote: "z" });
    assert.equal(r.status, 403, "un compte en lecture seule ne dépose pas de demande");
  });
});

describe("4 · demande → priorisation → projet", () => {
  let demandId;

  test("le site propose ; la demande porte son besoin", async () => {
    const r = await lead.post("/api/demand", {
      title: "Refonte du contrôle des convoyeurs",
      sponsor: "Direction d'exploitation ARE",
      site: SITE, estCost: 0.8,
      benefitNote: "Trois arrêts non planifiés par mois en moins",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    demandId = r.body.id;
    assert.ok(demandId);
  });

  test("le site ne DÉCIDE pas sa propre demande — le groupe le fait", async () => {
    const refuse = await lead.patch(`/api/demand/${demandId}`,
      { status: "Approved", version: 1 });
    assert.equal(refuse.status, 403, "décider est un acte de groupe");
  });

  test("PR-02 · un PATCH sans champ reconnu est un refus, pas un faux succès", async () => {
    /* Le comité a envoyé `decision: "Accepted"` — un nom de champ qui
       n'existe pas. Avant PR-02 : 200, version undefined, et une ligne
       d'audit « Demand updated » pour un changement jamais advenu. */
    const r = await lead.patch(`/api/demand/${demandId}`,
      { decision: "Accepted", version: 1 });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.error, /field names|noms de champs/);
  });

  test("le groupe approuve — et un refus sans motif serait refusé", async () => {
    const naked = await pmo.patch(`/api/demand/${demandId}`,
      { status: "Declined", version: 1 });
    assert.equal(naked.status, 400, "un refus exige son motif");
    const dec = await pmo.patch(`/api/demand/${demandId}`,
      { status: "Approved", decisionNote: "Alignée sur le plan directeur", version: 1 });
    assert.equal(dec.status, 200, JSON.stringify(dec.body));
  });

  test("la conversion garde le fil, et ne se fait qu'une fois", async () => {
    const made = await pmo.post(`/api/demand/${demandId}/convert`, {
      name: "Contrôle des convoyeurs ARE", programme: PROG, site: SITE,
      governanceLevel: "site", start: "2026-09-14", finish: "2027-06-30",
    });
    assert.ok([200, 201].includes(made.status), JSON.stringify(made.body));
    PROJECT = made.body.project?.id ?? made.body.id;
    assert.ok(PROJECT, "le projet existe");
    const again = await pmo.post(`/api/demand/${demandId}/convert`,
      { programme: PROG, site: SITE, start: "2026-09-14", finish: "2027-06-30" });
    assert.equal(again.status, 409, "convertir deux fois est refusé");
  });

  test("le groupe priorise ; sans enveloppe, pas de classement mensonger", async () => {
    const p = await pmo.get("/api/bootstrap");
    const proj = p.body.db.projects.find((x) => x.id === PROJECT);
    const r = await pmo.patch(`/api/projects/${PROJECT}/priority`,
      { fit: 4, value: 4, risk: 2, effort: 3, version: proj.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
});

/* Le projet frais, relu à chaque fois — sa version bouge à chaque acte. */
async function fresh(c = pmo) {
  const b = await c.get("/api/bootstrap");
  return b.body.db.projects.find((x) => x.id === PROJECT);
}

describe("5 · cadrage — le cas d'affaire, les jalons, la référence", () => {
  test("PM-03 · le site exécute, le groupe justifie", async () => {
    const CASE = {
      summary: "Diviser par trois les arrêts non planifiés des convoyeurs.",
      expectedCost: 0.8, expectedBenefit: 1.4,
      basis: "Journal des arrêts 2025-2026, coût moyen d'un arrêt chiffré par le contrôle de gestion.",
    };
    const refuse = await lead.put(`/api/projects/${PROJECT}/case`, CASE);
    assert.equal(refuse.status, 403, "qui paie écrit");
    const r = await pmo.put(`/api/projects/${PROJECT}/case`, CASE);
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  test("PM-04 · un jalon avec critères d'acceptation posés d'avance", async () => {
    const p = await fresh();
    const m = await pmo.post("/api/milestones", {
      project: PROJECT, name: "Bascule du premier convoyeur",
      date: "2027-02-15", version: p.version,
    });
    assert.equal(m.status, 201, JSON.stringify(m.body));
    const ms = (await pmo.get("/api/bootstrap")).body.db.milestones
      .find((x) => x.project === PROJECT);
    const c = await pmo.patch(`/api/milestones/${ms.id}`, {
      acceptanceCriteria: "48 h de marche sans arrêt non planifié, constatées par l'exploitation.",
      version: ms.version,
    });
    assert.equal(c.status, 200, JSON.stringify(c.body));
  });

  test("la référence est posée — c'est CONTRE ELLE que la tolérance mesurera", async () => {
    const p = await fresh();
    const r = await pmo.patch(`/api/projects/${PROJECT}/baseline`,
      { baselineFinish: "2027-06-30", version: p.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  test("PM-01 · le site ne fixe pas sa propre marge ; le groupe la pose", async () => {
    const refuse = await lead.put(`/api/projects/${PROJECT}/tolerance`,
      { scheduleDays: 30, costPct: 10 });
    assert.equal(refuse.status, 403);
    const r = await pmo.put(`/api/projects/${PROJECT}/tolerance`,
      { scheduleDays: 20, costPct: 8, note: "Périmètre : les trois convoyeurs de la ligne 1." });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
});

describe("6 · le travail et l'argent", () => {
  test("la semaine se consigne — sur le projet, par le site", async () => {
    const r = await lead.post("/api/timesheets",
      { person: PM_ID, project: PROJECT, week: "2026-09-02", days: 3 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.week, "2026-08-31", "la semaine est normalisée à son lundi");
  });

  test("PM-06 · une dépense se consigne ; un tirage de provision NOMME son risque", async () => {
    /* La provision se pose sur le projet AVANT de pouvoir être tirée. */
    const p0 = await fresh();
    const held = await pmo.patch(`/api/projects/${PROJECT}`,
      { contingency: 0.1, version: p0.version });
    assert.equal(held.status, 200, JSON.stringify(held.body));

    const spend = await pmo.post("/api/cost",
      { project: PROJECT, amount: 0.05, period: "2026-09", kind: "capex", category: "Études" });
    assert.equal(spend.status, 201, JSON.stringify(spend.body));

    const risk = await lead.post("/api/raid", {
      type: "Risk", project: PROJECT,
      title: "Obsolescence des automates de la ligne 1",
      p: 4, i: 4, tp: 2, ti: 2, response: "Mitigate",
    });
    assert.equal(risk.status, 201, JSON.stringify(risk.body));

    const anonymous = await pmo.post("/api/cost",
      { project: PROJECT, amount: 0.02, period: "2026-09", fromContingency: true });
    assert.equal(anonymous.status, 400, "un tirage anonyme est refusé quand un risque ouvert existe");

    const named = await pmo.post("/api/cost",
      { project: PROJECT, amount: 0.02, period: "2026-09", fromContingency: true,
        risk: risk.body.id });
    assert.equal(named.status, 201, JSON.stringify(named.body));
  });
});

describe("7 · maîtrise des modifications — le seuil et la seconde paire d'yeux", () => {
  test("l'émetteur ne décide JAMAIS sa propre demande — même le groupe", async () => {
    const small = await pmo.post("/api/change",
      { project: PROJECT, title: "Décaler la recette d'une semaine", cost: 0.05, weeks: 1 });
    assert.equal(small.status, 201, JSON.stringify(small.body));
    /* PR-03 — le pmo n'a AUCUNE personne liée, à dessein : avant le
       correctif, raised_by était NULL et il s'auto-approuvait. */
    const self = await pmo.post(`/api/change/${small.body.id}/approve`, {});
    assert.equal(self.status, 403, "PR-03 : un compte sans personne liée ne s'auto-approuve pas — " + JSON.stringify(self.body));
    assert.match(self.body.error, /you raised this request/i);
    /* La chaîne a PLUSIEURS étapes — approuver, c'est signer chacune.
       Sous le seuil, le site signe. */
    let applied = false;
    for (let i = 0; i < 6 && !applied; i++) {
      const bySite = await lead.post(`/api/change/${small.body.id}/approve`, {});
      assert.equal(bySite.status, 200, "sous le seuil, le site décide — " + JSON.stringify(bySite.body));
      applied = bySite.body.applied !== false;
    }
    assert.ok(applied, "la chaîne se termine et la demande est appliquée");
  });

  test("au-dessus du seuil (0.25), la décision monte au groupe — et la provision ne se dépasse pas", async () => {
    /* Financée sur la provision : 0.5 demandé, 0.1 détenu (moins ce que
       la 6 a déjà tiré). La chaîne se signe… et la DERNIÈRE signature —
       celle qui applique — refuse en nommant la provision. Le contrôle
       vit au moment de l'acte, pas au moment de la promesse. */
    const raised = await lead.post("/api/change",
      { project: PROJECT, title: "Ajouter le convoyeur de reprise", cost: 0.5, weeks: 6 });
    assert.equal(raised.status, 201, JSON.stringify(raised.body));
    const siteTry = await lead.post(`/api/change/${raised.body.id}/approve`, {});
    assert.equal(siteTry.status, 403, "le site ne décide pas au-dessus du seuil");
    let last = null;
    for (let i = 0; i < 6; i++) {
      last = await pmo.post(`/api/change/${raised.body.id}/approve`, {});
      if (last.status !== 200) break;
      if (last.body.applied !== false) break;
    }
    assert.equal(last.status, 400, "la provision détenue ne couvre pas le tirage — " + JSON.stringify(last.body));
    assert.match(last.body.error, /contingency/i);

    /* Refinancée sur budget, la même chaîne va au bout. */
    const cr2 = await lead.post("/api/change",
      { project: PROJECT, title: "Convoyeur de reprise — financement budget", cost: 0.5, weeks: 6, funding: "Budget" });
    assert.equal(cr2.status, 201);
    let applied = false;
    for (let i = 0; i < 6 && !applied; i++) {
      const r = await pmo.post(`/api/change/${cr2.body.id}/approve`, {});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      applied = r.body.applied !== false;
    }
    assert.ok(applied, "le groupe signe chaque étape et la demande est appliquée");
  });
});

describe("8 · preuves et jalons de gouvernance", () => {
  let docId;
  test("le déposant devient propriétaire ; sans artefact, pas d'approbation", async () => {
    const made = await lead.post("/api/documents",
      { project: PROJECT, name: "Charte du projet", type: "Charter", gate: 1 });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    docId = made.body.id;
    const bare = await pmo.patch(`/api/documents/${docId}`, { status: "Approved", version: 1 });
    assert.equal(bare.status, 400, "une preuve vide n'est pas une preuve — " + JSON.stringify(bare.body));
    assert.match(bare.body.error ?? "", /artefact/i, JSON.stringify(bare.body));
  });

  test("l'artefact pointe un hôte de confiance ; le propriétaire n'approuve pas son propre dépôt", async () => {
    /* L'hôte est vérifié au moment de l'ACTE d'approbation (docs/31) ;
       l'écriture n'accepte que le schéma https (S-01). */
    const scheme = await lead.patch(`/api/documents/${docId}`,
      { uri: "javascript:alert(1)", version: 1 });
    assert.equal(scheme.status, 400, "un schéma non https est refusé à l'écriture");
    const off = await lead.patch(`/api/documents/${docId}`,
      { uri: "https://autre-hebergeur.example/charte.pdf", version: 1 });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    const offHost = await pmo.patch(`/api/documents/${docId}`, { status: "Approved", version: 2 });
    assert.equal(offHost.status, 400, "un hôte hors liste ne devient pas une preuve — " + JSON.stringify(offHost.body));
    const good = await lead.patch(`/api/documents/${docId}`,
      { uri: "https://evidence.lima-mining.example/charte.pdf", version: 2 });
    assert.equal(good.status, 200, JSON.stringify(good.body));
    const own = await lead.patch(`/api/documents/${docId}`, { status: "Approved", version: 3 });
    assert.equal(own.status, 403, "le site n'approuve pas — et surtout pas son propre dépôt");
    const ok = await pmo.patch(`/api/documents/${docId}`, { status: "Approved", version: 3 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });

  test("avancer une phase sans les preuves du jalon : refus LISIBLE, dérogation MOTIVÉE", async () => {
    const p = await fresh();
    const blocked = await pmo.patch(`/api/projects/${PROJECT}/phase`, { version: p.version });
    assert.equal(blocked.status, 409, "le jalon n'est pas prêt et le refus le dit");
    const mute = await pmo.patch(`/api/projects/${PROJECT}/phase`,
      { version: p.version, override: true });
    assert.equal(mute.status, 400, "une dérogation sans motif est refusée");
    const r = await pmo.patch(`/api/projects/${PROJECT}/phase`,
      { version: p.version, override: true,
        overrideWhy: "Comité du 01/09 : dossier accepté sur preuve partielle, complément au jalon 2." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
});

describe("9 · le rythme des comités", () => {
  let seriesId, occId;
  test("le site tient sa salle ; la décision se prend séance ouverte", async () => {
    const s = await lead.post("/api/meetings/series", {
      name: "Revue hebdo ARE", scopeKind: "site", siteId: SITE, chairId: PM_ID,
    });
    assert.ok([200, 201].includes(s.status), JSON.stringify(s.body));
    seriesId = s.body.id ?? s.body.series?.id;
    const o = await lead.post(`/api/meetings/series/${seriesId}/occurrences`, {});
    assert.ok([200, 201].includes(o.status), JSON.stringify(o.body));
    occId = o.body.id ?? o.body.occurrence?.id;

    const early = await lead.post(`/api/meetings/occurrences/${occId}/decisions`,
      { headline: "Trop tôt" });
    assert.equal(early.status, 409, "pas de décision avant d'ouvrir la séance");
    assert.equal((await lead.post(`/api/meetings/occurrences/${occId}/open`, {})).status, 200);
    const d = await lead.post(`/api/meetings/occurrences/${occId}/decisions`,
      { headline: "Le planning de bascule est approuvé par la salle" });
    assert.ok([200, 201].includes(d.status), JSON.stringify(d.body));
    assert.equal((await lead.post(`/api/meetings/occurrences/${occId}/close`, {})).status, 200);
    const late = await lead.post(`/api/meetings/occurrences/${occId}/decisions`,
      { headline: "Trop tard" });
    assert.equal(late.status, 409, "une séance close est finale");
  });
});

describe("10 · valeur, PIR, clôture — et personne ne part sans signer", () => {
  test("un bénéfice dans SON unité, pas en millions", async () => {
    const r = await lead.post("/api/benefits", {
      project: PROJECT, kind: "Availability",
      title: "Arrêts non planifiés de la ligne 1",
      measure: "Arrêts par mois", unit: "arrêts/mois",
      baseline: 9, target: 3, realiseOn: "2027-09-30",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  test("la revue post-mise en œuvre est un acte de groupe, avec verdict", async () => {
    let p = await fresh();
    const refuse = await lead.patch(`/api/projects/${PROJECT}/review`,
      { verdict: "Met", version: p.version });
    assert.equal(refuse.status, 403);
    const r = await pmo.patch(`/api/projects/${PROJECT}/review`,
      { verdict: "Partly met", note: "La cible d'arrêts sera constatée après l'hiver.", version: p.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  test("PM-08 · Closed exige l'exploitant, le propriétaire des bénéfices et le mot de la fin", async () => {
    /* Design → Execution → Transition → Closure, par dérogations motivées
       (le parcours a UN jalon documenté ; le reste du dossier est ce que
       la dérogation assume, et chaque motif reste lisible au comité). */
    for (const phase of ["Execution", "Transition", "Closure"]) {
      const p = await fresh();
      const r = await pmo.patch(`/api/projects/${PROJECT}/phase`,
        { version: p.version, override: true, overrideWhy: `Parcours de recette — passage en ${phase}.` });
      assert.equal(r.status, 200, `vers ${phase}: ${JSON.stringify(r.body)}`);
    }
    const p = await fresh();
    const naked = await pmo.patch(`/api/projects/${PROJECT}/phase`,
      { version: p.version, override: true, overrideWhy: "Clore sans signatures" });
    assert.equal(naked.status, 400, "clore sans exploitant ni propriétaire de bénéfice est refusé");
    const closed = await pmo.patch(`/api/projects/${PROJECT}/phase`, {
      version: p.version, override: true, overrideWhy: "Parcours de recette — clôture.",
      opsAcceptedBy: OPS_ID, benefitsTo: SPONSOR_ID,
      closureNote: "Reste à faire : rien. Non fait, assumé : la ligne 2 attend la phase suivante.",
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const done = await fresh();
    assert.equal(done.closed, true);
    assert.equal(done.opsAcceptedBy, OPS_ID);
  });
});

describe("11 · capitaliser, restituer, sortir", () => {
  test("PM-02 · la leçon du site est adoptée au groupe et lisible d'ailleurs", async () => {
    const l = await lead.post("/api/lessons", {
      project: PROJECT, category: "Technical",
      title: "Les automates obsolètes doublent le délai de bascule",
      whatHappened: "La bascule du premier convoyeur a exigé une passerelle non prévue.",
      why: "L'inventaire d'automates datait de l'étude, pas de l'exécution.",
      recommendation: "Relever l'inventaire d'automates au lancement, pas à l'étude.",
    });
    assert.equal(l.status, 201, JSON.stringify(l.body));
    const id = l.body.id;
    const sneak = await lead.patch(`/api/lessons/${id}`, { status: "Adopted", version: 1 });
    assert.equal(sneak.status, 400, "le statut ne passe pas par la modification ordinaire");
    const refuse = await lead.post(`/api/lessons/${id}/adopt`, { version: 1 });
    assert.equal(refuse.status, 403, "adopter est un acte de groupe — " + JSON.stringify(refuse.body));
    const ok = await pmo.post(`/api/lessons/${id}/adopt`, { version: 1 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });

  test("INT-05 · la période close gèle, la vue de restitution relit les décisions", async () => {
    const r = await dir.post("/api/periods", { label: "Septembre 2026 — recette" });
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
    const decisions = await many(
      `SELECT action FROM reporting.decisions ORDER BY at DESC LIMIT 30`);
    const labels = decisions.map((d) => d.action);
    assert.ok(labels.includes("Change request approved"),
      `la décision de modification se relit dans reporting.decisions (vu : ${labels.join(" · ")})`);
    assert.ok(labels.includes("Tolerance set"), "la tolérance posée aussi");
  });

  test("INT-02 · une clé d'intégration lit le portefeuille ; sans clé, 401", async () => {
    const anon = client();
    assert.equal((await anon.get("/api/v1/portfolio")).status, 401);
    const made = await dir.post("/api/admin/integrations",
      { name: "chaine-decisionnelle", scopes: "read:portfolio" });
    assert.ok([200, 201].includes(made.status), JSON.stringify(made.body));
    const key = made.body.key ?? made.body.apiKey;
    assert.ok(key, "la clé est montrée une fois");
    const read = await anon.get("/api/v1/portfolio", { Authorization: `Bearer ${key}` });
    assert.equal(read.status, 200, JSON.stringify(read.body).slice(0, 200));
  });

  test("M-01 · l'archive emporte le livre entier — notre projet y est, par son nom", async () => {
    const r = await dir.get("/api/admin/archive");
    assert.equal(r.status, 200);
    const flat = JSON.stringify(r.body ?? r.text);
    assert.ok(flat.includes(PROJECT), "le projet du parcours est dans l'archive");
    assert.ok(!/presidencia-lima-2026|-mine"/.test(flat), "aucun mot de passe n'y figure");
  });
});

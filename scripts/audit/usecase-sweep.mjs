/**
 * BALAYAGE EXHAUSTIF DES CAS D'USAGE
 *
 * Le comité indépendant a demandé que toutes les capacités soient
 * exercées, sans exception, depuis toutes les perspectives. Ce script le
 * fait : il monte une instance neuve, se connecte avec chacun des quatre
 * niveaux d'accès, et exécute chaque cas d'usage du produit.
 *
 * Il n'affirme pas ce qui DOIT arriver — il enregistre ce qui arrive, et
 * signale ce qui mérite un regard :
 *
 *   ✖  une erreur serveur (5xx) : jamais acceptable
 *   ⚠  un refus là où le rôle devrait pouvoir agir, ou l'inverse
 *   ·  tout le reste, avec son code
 *
 * Lancement :  node scripts/audit/usecase-sweep.mjs
 */

import { connect, close, migrate } from "../../server/src/db.js";
import { seed } from "../../server/src/seed.js";
import { buildApp } from "../../server/src/index.js";

const ACCOUNTS = {
  admin:  ["admin@meridian.example", "meridian-admin-2026"],
  group:  ["p.marchetti@meridian.example", "programme-dch-2026"],  // DCH
  site:   ["g.silva@meridian.example", "site-gru-2026"],           // GRU
  viewer: ["q.mbeki@meridian.example", "viewer-gru-2026"],         // GRU
};

const SITE_PRJ = "PRJ-136";   // LATAM Localisation — GRU, site-governed
const GROUP_PRJ = "PRJ-101";  // Payments Core Migration — KRK, group-governed

let base = "";
const results = [];

function mkClient() {
  let cookie = "";
  return async function call(method, path, body, headers) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      if (pair.startsWith("meridian_sid=")) cookie = pair;
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, body: json, text };
  };
}

/** One use case, for one role. `expect` is what the model says should happen. */
async function uc(role, call, area, name, expect, run) {
  let r;
  try {
    r = await run(call);
  } catch (e) {
    results.push({ role, area, name, status: "EXC", expect, note: String(e?.message ?? e).slice(0, 120) });
    return null;
  }
  const status = r?.status ?? 0;
  const note = status >= 400 ? String(r?.body?.error ?? r?.text ?? "").slice(0, 110) : "";
  results.push({ role, area, name, status, expect, note });
  return r;
}

const ok = (s) => s >= 200 && s < 300;
const denied = (s) => s === 401 || s === 403 || s === 404;

/* ── the catalogue ─────────────────────────────────────────────────
   Every capability the product offers, run in every role. `expect` is
   "allow" or "deny" per the access model; anything else is flagged. */
async function runRole(role) {
  const call = mkClient();
  const [email, password] = ACCOUNTS[role];
  const login = await call("POST", "/api/auth/login", { email, password });
  if (!ok(login.status)) throw new Error(`login failed for ${role}: ${login.text}`);

  const writes = role !== "viewer";
  const groupish = role === "admin" || role === "group";
  const A = (cond) => (cond ? "allow" : "deny");

  /* ── lecture ── */
  await uc(role, call, "Lecture", "bootstrap", "allow", (c) => c("GET", "/api/bootstrap"));
  await uc(role, call, "Lecture", "qui suis-je", "allow", (c) => c("GET", "/api/auth/me"));
  await uc(role, call, "Lecture", "annuaire des comptes", "allow", (c) => c("GET", "/api/auth/accounts"));
  await uc(role, call, "Lecture", "digest hebdomadaire", "allow", (c) => c("GET", "/api/digest"));
  await uc(role, call, "Lecture", "piste d'audit", A(groupish), (c) => c("GET", "/api/audit?limit=5"));
  await uc(role, call, "Lecture", "registre des décisions", A(groupish), (c) => c("GET", "/api/decisions/log"));
  await uc(role, call, "Lecture", "périodes publiées", "allow", (c) => c("GET", "/api/periods"));
  await uc(role, call, "Lecture", "demandes", "allow", (c) => c("GET", "/api/demand"));
  await uc(role, call, "Lecture", "état Entra", "allow", (c) => c("GET", "/api/auth/oidc/status"));

  /* ── exports ── */
  await uc(role, call, "Export", "jeu de données JSON", "allow", (c) => c("GET", "/api/export/dataset"));
  await uc(role, call, "Export", "jeu de données CSV", "allow", (c) => c("GET", "/api/export/dataset?format=csv"));
  await uc(role, call, "Export", "dossier de preuve (projet site)", "allow", (c) => c("GET", `/api/projects/${SITE_PRJ}/evidence`));
  await uc(role, call, "Export", "dossier de preuve daté", "allow", (c) => c("GET", `/api/projects/${SITE_PRJ}/evidence?asOf=2026-06-30`));
  await uc(role, call, "Export", "export du livre (admin)", A(role === "admin"), (c) => c("GET", "/api/admin/export"));

  /* ── projet ── */
  const boot = await call("GET", "/api/bootstrap");
  const sitePrj = boot.body?.db?.projects?.find((p) => p.id === SITE_PRJ);
  const groupPrj = boot.body?.db?.projects?.find((p) => p.id === GROUP_PRJ);
  const v = (p) => p?.version ?? 1;

  await uc(role, call, "Projet", "créer", A(writes), (c) => c("POST", "/api/projects", {
    name: `Sweep ${role}`, programme: "DCH", site: "GRU", governanceLevel: "site",
    start: "2027-01-04", finish: "2027-10-01",
  }));
  await uc(role, call, "Projet", "modifier (site)", A(writes), (c) => c("PATCH", `/api/projects/${SITE_PRJ}`,
    { name: `LATAM (${role})`, version: v(sitePrj) }));
  await uc(role, call, "Projet", "modifier (groupe)", A(groupish), (c) => c("PATCH", `/api/projects/${GROUP_PRJ}`,
    { name: `Payments (${role})`, version: v(groupPrj) }));
  await uc(role, call, "Projet", "forcer le statut", A(writes), (c) => c("PATCH", `/api/projects/${SITE_PRJ}/health`,
    { rag: "A", why: "balayage", version: v(sitePrj) }));
  await uc(role, call, "Projet", "avancer la phase", A(writes), (c) => c("PATCH", `/api/projects/${SITE_PRJ}/phase`,
    { version: v(sitePrj) }));
  await uc(role, call, "Projet", "re-baseliner", A(groupish), (c) => c("PATCH", `/api/projects/${SITE_PRJ}/baseline`,
    { baselineFinish: "2027-12-31", version: v(sitePrj) }));
  await uc(role, call, "Projet", "classer l'impact usine", A(writes), (c) => c("PATCH", `/api/projects/${SITE_PRJ}/plant`,
    { impact: "plant", version: v(sitePrj) }));
  await uc(role, call, "Projet", "lever la maîtrise des modifications", A(role === "group"),
    (c) => c("PATCH", `/api/projects/${SITE_PRJ}/moc`, { ref: "MOC-SWEEP", version: v(sitePrj) }));
  await uc(role, call, "Projet", "revue post-mise en œuvre", A(role === "group"),
    (c) => c("PATCH", `/api/projects/${SITE_PRJ}/review`, { verdict: "Met", version: v(sitePrj) }));
  await uc(role, call, "Projet", "priorité", A(role === "group"), (c) => c("PATCH", `/api/projects/${SITE_PRJ}/priority`,
    { fit: 4, value: 4, risk: 2, effort: 2, version: v(sitePrj) }));

  /* ── planning ── */
  const acts = boot.body?.db?.activities?.filter((a) => a.project === SITE_PRJ) ?? [];
  await uc(role, call, "Planning", "ajouter une étape", A(writes), (c) => c("POST", "/api/activities",
    { project: SITE_PRJ, name: `Étape ${role}`, start: "2027-02-01", end: "2027-03-01", weight: 5 }));
  if (acts[0]) {
    await uc(role, call, "Planning", "modifier une étape", A(writes), (c) => c("PATCH", `/api/activities/${acts[0].id}`,
      { pct: 40, version: acts[0].version }));
  }
  await uc(role, call, "Planning", "ajouter un jalon", A(writes), (c) => c("POST", "/api/milestones",
    { project: SITE_PRJ, name: `Jalon ${role}`, date: "2027-05-03" }));
  await uc(role, call, "Planning", "jalon intrusif", A(writes), (c) => c("POST", "/api/milestones",
    { project: SITE_PRJ, name: `Bascule ${role}`, date: "2027-05-10", intrusive: true }));
  await uc(role, call, "Planning", "lien inter-projets", A(groupish), (c) => c("POST", "/api/crossdeps",
    { from: SITE_PRJ, to: GROUP_PRJ, label: "balayage" }));

  /* ── registre RAID ── */
  await uc(role, call, "RAID", "ouvrir un risque (site)", A(writes), (c) => c("POST", "/api/raid",
    { project: SITE_PRJ, type: "Risk", title: `Risque ${role}`, p: 3, i: 3 }));
  await uc(role, call, "RAID", "préoccupation sur projet groupe", A(role === "site" || groupish),
    (c) => c("POST", "/api/raid", { project: GROUP_PRJ, type: "Issue", title: `Préoccupation ${role}`, p: 4, i: 4 }));
  await uc(role, call, "RAID", "élément portefeuille (sans projet)", A(groupish), (c) => c("POST", "/api/raid",
    { type: "Risk", title: `Portefeuille ${role}`, p: 2, i: 2 }));

  /* ── contrôle des changements ── */
  const cr = await uc(role, call, "Changement", "émettre une demande", A(writes), (c) => c("POST", "/api/change",
    { project: SITE_PRJ, title: `CR ${role}`, cost: 0.05, weeks: 1 }));
  const crId = cr?.body?.id;
  if (crId) {
    await uc(role, call, "Changement", "décider sa propre demande (séparation)", "deny",
      (c) => c("POST", `/api/change/${crId}/approve`, {}));
  }
  const pending = boot.body?.db?.crs?.find((x) => x.status === "Pending" && x.project === SITE_PRJ);
  if (pending) {
    await uc(role, call, "Changement", "approuver une demande d'autrui", A(writes),
      (c) => c("POST", `/api/change/${pending.id}/approve`, { comment: "balayage" }));
  }

  /* ── argent ── */
  await uc(role, call, "Argent", "imputer un coût", A(groupish), (c) => c("POST", "/api/cost",
    { project: SITE_PRJ, amount: 0.02, period: "2026-08", category: "Labour" }));
  await uc(role, call, "Argent", "puiser dans la provision", A(role === "group"), (c) => c("POST", "/api/cost",
    { project: SITE_PRJ, amount: 0.01, period: "2026-08", fromContingency: true }));
  await uc(role, call, "Argent", "engager (bon de commande)", A(groupish), (c) => c("POST", "/api/commitments",
    { project: SITE_PRJ, reference: `PO-${role}`, amount: 0.1, supplier: "Balayage" }));

  /* ── valeur ── */
  const ben = await uc(role, call, "Valeur", "énoncer un bénéfice", A(writes), (c) => c("POST", "/api/benefits",
    { project: SITE_PRJ, kind: "Cost", title: `Bénéfice ${role}`, measure: "Coût", unit: "USD",
      baseline: 100, target: 80 }));
  const benId = ben?.body?.id;
  if (benId) {
    await uc(role, call, "Valeur", "mesurer un bénéfice", A(writes), (c) => c("PATCH", `/api/benefits/${benId}`,
      { actual: 90, version: 1 }));
    await uc(role, call, "Valeur", "statuer « réalisé »", A(role === "group"), (c) => c("PATCH", `/api/benefits/${benId}`,
      { status: "Realised", version: 2 }));
  }

  /* ── documents ── */
  const doc = await uc(role, call, "Documents", "déposer un document", A(writes), (c) => c("POST", "/api/documents",
    { project: SITE_PRJ, name: `Doc ${role}`, type: "Assurance", gate: 2,
      uri: `https://docs.meridian.example/evidence/sweep-${role}.pdf` }));
  const docId = doc?.body?.id;
  if (docId) {
    /* S-06 — depuis la campagne de sécurité, déposer une preuve vous en
       rend propriétaire, et le propriétaire ne l'approuve pas. Seul
       l'administrateur passe encore, par l'exemption de séparation des
       tâches qu'il porte partout (S-13 au registre). */
    await uc(role, call, "Documents", "approuver sa propre preuve", A(role === "admin"),
      (c) => c("PATCH", `/api/documents/${docId}`, { status: "Approved", version: 1 }));
    await uc(role, call, "Documents", "nouvelle révision", A(writes), (c) => c("POST", `/api/documents/${docId}/revise`, {}));
  }
  await uc(role, call, "Documents", "créer déjà approuvé (contournement)", "deny", (c) => c("POST", "/api/documents",
    { project: SITE_PRJ, name: `Contournement ${role}`, gate: 3, status: "Approved" }));

  /* ── ressources ── */
  const person = boot.body?.db?.people?.[0];
  if (person) {
    await uc(role, call, "Ressources", "affecter une personne", A(writes), (c) => c("POST", "/api/allocations",
      { project: SITE_PRJ, person: person.id, from: "2027-01-04", to: "2027-06-30", pct: 20 }));
  }

  /* ── usine et déploiement ── */
  await uc(role, call, "Usine", "déclarer un gel (site propre)", A(role === "site" || groupish),
    (c) => c("POST", "/api/windows", { site: "GRU", kind: "freeze", label: `Gel ${role}`,
      from: "2027-03-01", to: "2027-03-31" }));
  await uc(role, call, "Usine", "déclarer un gel (autre site)", A(groupish),
    (c) => c("POST", "/api/windows", { site: "YYZ", kind: "freeze", label: `Gel YYZ ${role}`,
      from: "2027-03-01", to: "2027-03-31" }));
  await uc(role, call, "Déploiement", "ajouter un site à un déploiement", A(writes), (c) => c("POST", "/api/waves",
    { project: SITE_PRJ, site: "SIN", seq: 2, plannedOn: "2027-07-01" }));

  /* ── demande et priorisation ── */
  const dem = await uc(role, call, "Demande", "émettre une demande", A(writes), (c) => c("POST", "/api/demand",
    { title: `Demande ${role}`, sponsor: "Balayage", site: "GRU", estCost: 0.2 }));
  const demId = dem?.body?.id;
  if (demId) {
    await uc(role, call, "Demande", "décider", A(role === "group"), (c) => c("PATCH", `/api/demand/${demId}`,
      { status: "Approved", version: 1 }));
  }
  await uc(role, call, "Priorisation", "clôturer une période", A(role === "group"), (c) => c("POST", "/api/periods",
    { label: `Balayage ${role}` }));

  /* ── réunions ── */
  const series = await uc(role, call, "Réunions", "lister les séries", "allow", (c) => c("GET", "/api/meetings/series"));
  const mine = series?.body?.series?.find((s) => s.canWrite) ?? series?.body?.series?.[0];
  if (mine?.next) {
    const occ = mine.next.id;
    await uc(role, call, "Réunions", "lire une occurrence", "allow", (c) => c("GET", `/api/meetings/occurrences/${occ}`));
    await uc(role, call, "Réunions", "dossier de séance", "allow", (c) => c("GET", `/api/meetings/occurrences/${occ}/pack`));
    await uc(role, call, "Réunions", "ouvrir la séance", A(writes), (c) => c("POST", `/api/meetings/occurrences/${occ}/open`, {}));
    await uc(role, call, "Réunions", "consigner une décision", A(writes),
      (c) => c("POST", `/api/meetings/occurrences/${occ}/decisions`, { headline: `Décision ${role}` }));
    await uc(role, call, "Réunions", "consigner une action", A(writes),
      (c) => c("POST", `/api/meetings/occurrences/${occ}/actions`, { title: `Action ${role}` }));
    await uc(role, call, "Réunions", "présences", A(writes),
      (c) => c("POST", `/api/meetings/occurrences/${occ}/attendance`, { attendance: [] }));
  }
  await uc(role, call, "Réunions", "actions ouvertes", "allow", (c) => c("GET", "/api/meetings/actions?status=Open"));

  /* ── administration ── */
  await uc(role, call, "Administration", "lister les comptes", A(role === "admin"), (c) => c("GET", "/api/admin/users"));
  await uc(role, call, "Administration", "créer un compte", A(role === "admin"), (c) => c("POST", "/api/admin/users",
    { email: `sweep.${role}@example.com`, displayName: `Sweep ${role}`, role: "viewer", password: "sweep-pass-2026" }));
  await uc(role, call, "Administration", "modifier un paramètre", A(role === "admin"), (c) => c("PATCH", "/api/admin/settings",
    { capexEnvelope: 42 }));
  await uc(role, call, "Administration", "créer un site", A(role === "admin"), (c) => c("POST", "/api/admin/sites",
    { id: `S${role.slice(0, 2).toUpperCase()}`, city: `Ville ${role}`, region: "Test" }));
  await uc(role, call, "Administration", "file de notifications", A(role === "admin"), (c) => c("GET", "/api/admin/notifications"));
  await uc(role, call, "Administration", "lancer le balayage de notifications", A(role === "admin"),
    (c) => c("POST", "/api/admin/notifications/sweep", {}));

  /* ── fédération (clé de service, pas une session) ── */
  await uc(role, call, "Fédération", "flux sans clé de service", "deny", (c) => c("GET", "/v1/sites"));

  /* ── robustesse ── */
  await uc(role, call, "Robustesse", "projet inexistant", "deny", (c) => c("GET", "/api/projects/PRJ-000/evidence"));
  await uc(role, call, "Robustesse", "point d'accès inexistant", "deny", (c) => c("GET", "/api/rien-du-tout"));
  await uc(role, call, "Robustesse", "écriture sans version (428)", "deny", (c) => c("PATCH", `/api/projects/${SITE_PRJ}`,
    { name: "sans version" }));
  await uc(role, call, "Robustesse", "paramètre de requête malformé", "allow",
    (c) => c("GET", "/api/audit?entity[]=x&limit=abc"));
  await uc(role, call, "Robustesse", "corps JSON vide sur une création", "deny", (c) => c("POST", "/api/projects", {}));
  await uc(role, call, "Robustesse", "refus en français", "deny", (c) => c("PATCH", `/api/projects/${GROUP_PRJ}`,
    { name: "x", version: v(groupPrj) }, { "x-lang": "fr" }));
}

/* ── exécution ─────────────────────────────────────────────────── */

await connect({ dataDir: null, url: null });
await migrate({ silent: true });
await seed({ force: true, today: "2026-08-28" });
const app = buildApp();
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
base = `http://127.0.0.1:${server.address().port}`;

for (const role of ["admin", "group", "site", "viewer"]) {
  await runRole(role);
}

await new Promise((r) => server.close(r));
await close();

/* ── rapport ───────────────────────────────────────────────────── */

const areas = [...new Set(results.map((r) => r.area))];
const roles = ["admin", "group", "site", "viewer"];
const problems = [];

console.log("\n═══ BALAYAGE DES CAS D'USAGE ═══\n");
for (const area of areas) {
  console.log(`── ${area} ──`);
  const names = [...new Set(results.filter((r) => r.area === area).map((r) => r.name))];
  for (const name of names) {
    const cells = roles.map((role) => {
      const r = results.find((x) => x.area === area && x.name === name && x.role === role);
      if (!r) return "  –  ";
      const s = r.status;
      let mark = " ";
      if (s === "EXC" || (typeof s === "number" && s >= 500)) {
        mark = "✖"; problems.push({ ...r, why: "erreur serveur" });
      } else if (r.expect === "allow" && typeof s === "number" && denied(s)) {
        mark = "⚠"; problems.push({ ...r, why: "refusé alors que le rôle devrait pouvoir" });
      } else if (r.expect === "deny" && typeof s === "number" && ok(s)) {
        mark = "⚠"; problems.push({ ...r, why: "autorisé alors que le rôle ne devrait pas" });
      }
      return `${mark}${String(s).padStart(4)}`;
    });
    console.log(`  ${name.padEnd(46)} ${cells.join(" ")}`);
  }
  console.log("");
}
console.log(`  ${"".padEnd(46)} ${roles.map((r) => r.slice(0, 5).padStart(5)).join(" ")}\n`);

console.log(`Cas exercés : ${results.length} (${areas.length} domaines × 4 perspectives)\n`);
if (!problems.length) {
  console.log("Aucune anomalie : pas d'erreur serveur, pas d'écart au modèle d'accès.\n");
} else {
  console.log(`═══ ${problems.length} POINT(S) À REGARDER ═══\n`);
  for (const p of problems) {
    console.log(`  ${p.why === "erreur serveur" ? "✖" : "⚠"} [${p.role}] ${p.area} · ${p.name}`);
    console.log(`      attendu ${p.expect}, obtenu ${p.status} — ${p.why}`);
    if (p.note) console.log(`      « ${p.note} »`);
  }
  console.log("");
}
process.exit(problems.some((p) => p.why === "erreur serveur") ? 1 : 0);

/**
 * I-2 — L'API D'ÉCRITURE  (retour de terrain RT365, docs/33 · M-05 · INT-13 · I-5)
 *
 * Le premier intégrateur réel a écrit dans Meridian par les 144 routes
 * de session du navigateur, parce que /api/v1 ne savait que lire. Il a
 * encodé son identité dans les titres et relu tout le livre à chaque
 * exécution pour rester idempotent. Ce module est la réponse : un
 * contrat d'écriture, par identité EXTERNE, sous clé d'idempotence.
 *
 * ── Les règles ──────────────────────────────────────────────────────
 *
 *   · PUT /api/v1/<collection>/<externalId> : crée si absent, met à jour
 *     si présent. L'identité est (intégration, externalId) — voir 035.
 *   · La portée décide (write:portfolio, write:meetings). Le périmètre
 *     d'une clé est le portefeuille entier, comme pour la lecture : ce
 *     qui la borne est sa portée, pas une habilitation (INT-02).
 *   · Les MÊMES invariants que l'écran : audited() dans la transaction,
 *     allocateId(), scaffoldProject(), les mêmes contrôles métier
 *     (critères d'acceptation → accepteur nommé ; hôte de plante ;
 *     origine SDP intouchable). Une route d'intégration n'est pas une
 *     porte dérobée vers moins de règles.
 *   · `version` est optionnel : quand il est envoyé, il est vérifié
 *     (409 sinon) ; quand il ne l'est pas, le système source est le
 *     maître de SES lignes et le dernier écrit gagne — c'est ce qu'une
 *     synchronisation veut dire, et c'est documenté dans le contrat.
 *   · Une décision ne se modifie jamais : re-PUT identique = 200 et la
 *     même ligne ; re-PUT différent = 409, « consignez-en une nouvelle
 *     qui remplace celle-ci ».
 *
 * ── Idempotency-Key ─────────────────────────────────────────────────
 *
 * Optionnel, propre à l'intégration. Même clé + même corps : la réponse
 * enregistrée est rejouée (en-tête Idempotent-Replayed: true). Même clé
 * + autre corps : 422. La mémoire tient trente jours et se purge au tour
 * horaire. Sans clé, le PUT reste idempotent par construction — la clé
 * ajoute la garantie « une seule création même si ma requête a été
 * coupée avant la réponse ».
 */

import crypto from "node:crypto";
import { one, many, query, allocateId, updateVersioned, assertIdentifiers } from "./db.js";
import { audited } from "./audit.js";
import { HttpError } from "./auth.js";
import { fromM, loadSettings } from "./portfolio.js";
import { scaffoldProject, reschedule, phaseFor } from "./wbs.js";
import { iso, D } from "../../shared/engine.js";
import { assertPlantWindow } from "./plant.js";
import { isEvidenceLocator, EVIDENCE_REFUSAL } from "./evidence.js";
import { assertCaseReconfirmed } from "./value.js";
import { canRatifyDecision } from "../../shared/rbac.js";

const bad = (msg) => { throw new HttpError(400, msg); };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const canonical = (v) => {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
};
const clampScale = (v, fallback = null) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) bad("Probability, impact and their targets are whole numbers from 1 to 5");
  return Math.max(1, Math.min(5, n));
};
const isoDate = (v, what) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(D(s).getTime())) bad(`${what} must be an ISO calendar date (YYYY-MM-DD)`);
  return s;
};
const money = (v, what) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) bad(`${what} is a non-negative number of millions`);
  return fromM(n);
};
const text = (v, max, what, required = false) => {
  if (v === undefined || v === null) { if (required) bad(`${what} is required`); return undefined; }
  const s = String(v).trim();
  if (required && !s) bad(`${what} is required`);
  return s.slice(0, max);
};

/* ── résolution des références ──────────────────────────────────────
   Un intégrateur parle avec SES identifiants. Une référence de projet est
   donc un identifiant Meridian OU l'identifiant externe que la même
   intégration a donné à ce projet. Une personne est un identifiant ou
   un nom exact de l'annuaire (actif). */

export async function resolveProject(source, ref) {
  if (!ref) return null;
  const p = await one(
    `SELECT id, programme_id, site_id, governance_level, closed, origin, row_version, pm_id,
            start_date, finish_date, method
       FROM project WHERE id = $1 OR (external_source = $2 AND external_id = $1)`,
    [String(ref), source]);
  if (!p) bad(`No such project: ${ref} — send a Meridian id, or an external id you created`);
  return p;
}

export async function resolvePerson(ref, what) {
  if (ref === undefined || ref === null || ref === "") return null;
  const r = String(ref);
  const p = await one(`SELECT id FROM person WHERE active AND (id = $1 OR name = $1) LIMIT 1`, [r]);
  if (!p) bad(`${what}: no active person "${r}" in the directory — send an id or the exact name`);
  return p.id;
}

const HAS_EXTERNAL_ID = new Set(["project", "milestone", "raid_item", "meeting_decision", "meeting_action", "activity", "work_item", "gate_criterion", "benefit", "business_case"]);
async function resolveRef(table, source, ref, projectId, what) {
  if (!ref) return null;
  /* Une demande de modification n'a pas d'identité externe (035) : elle
     se désigne par son identifiant Meridian seulement. */
  const row = HAS_EXTERNAL_ID.has(table)
    ? await one(`SELECT id, project_id FROM ${table} WHERE id = $1 OR (external_source = $2 AND external_id = $1)`, [String(ref), source])
    : await one(`SELECT id, project_id FROM ${table} WHERE id = $1`, [String(ref)]);
  if (!row || (projectId && row.project_id && row.project_id !== projectId)) {
    bad(`${what}: "${ref}" does not exist on this project`);
  }
  return row.id;
}

const stamp = (created, id, externalId, version) => ({ id, externalId, created, version });

/**
 * L'écriture d'une mise à jour. `version` envoyé : asserté (409 s'il est
 * périmé). `version` absent : le système source est le maître de SA ligne
 * et le dernier écrit gagne RÉELLEMENT — sans prédicat de version, plutôt
 * qu'en assertant une version que l'appelant n'a jamais vue (une édition
 * entre la lecture et l'écriture donnait un 409 « périmé » à qui n'avait
 * rien envoyé — conseiller code, docs/33 §5).
 */
/**
 * Ce qui a RÉELLEMENT changé.
 *
 * Le `patch` était bâti à partir des champs ENVOYÉS, pas des champs
 * modifiés. L'intégrateur l'a mesuré en rejouant son chargement : une
 * re-passe sans le moindre changement écrivait 285 événements d'audit et
 * incrémentait `row_version` sur 285 lignes — une piste que personne ne
 * peut plus lire, et une version qui bouge sous les pieds d'un lecteur
 * qui n'avait rien fait. Le chemin des décisions filtrait déjà ainsi ;
 * c'est maintenant la règle de toutes les collections.
 *
 * La comparaison est tolérante à la FORME que rend le pilote : un
 * `numeric` revient en chaîne, une `date` en Date ou en chaîne. Comparer
 * `12` à `"12.00"` avec `!==` déclarait un changement à chaque passe,
 * ce qui aurait rendu ce filtre inutile précisément là où il sert.
 */
const sameValue = (a, b) => {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a instanceof Date || b instanceof Date) {
    const d = (v) => (v instanceof Date ? iso(v) : String(v).slice(0, 10));
    return d(a) === d(b);
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return na === nb;
  }
  return String(a) === String(b);
};
export function changedOnly(patch, row) {
  if (!row) return patch;
  return Object.fromEntries(Object.entries(patch).filter(([k, v]) => !sameValue(v, row[k])));
}

async function writeRow(t, table, id, version, patch, what) {
  if (version !== undefined) {
    const rv = await updateVersioned(t, table, id, version, patch);
    if (!rv.ok) throw new HttpError(409, `The version you sent is stale — read the ${what} again`);
    return rv;
  }
  const keys = Object.keys(patch);
  /* Le même fil-piège que `updateVersioned` : les clés sont aujourd'hui
     des littéraux du module, mais c'est précisément pour le jour où l'une
     viendrait d'une requête que db.js pose cette assertion — elle échoue
     alors bruyamment plutôt que de devenir une injection en silence.
     (Conseiller sécurité L-2, docs/33 §5.) */
  assertIdentifiers([table, ...keys]);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  const r = await t.query(
    `UPDATE ${table} SET ${sets.join(", ")}, row_version = row_version + 1 WHERE id = $1 RETURNING row_version`,
    [id, ...keys.map((k) => patch[k])]);
  if (!r.rows.length) throw new HttpError(404, `No such ${what} any more`);
  return { ok: true, version: r.rows[0].row_version };
}
const sentVersion = (b) => {
  if (b.version === undefined) return undefined;
  const v = Number(b.version);
  if (!Number.isInteger(v) || v < 1) bad("version is a positive whole number, or omitted");
  return v;
};

/**
 * ADOPTER une ligne existante (conseiller PMO, docs/33 D-33.12). Le
 * premier intégrateur a déjà seize projets et 86 lignes RAID créées par
 * leur nom AVANT que l'identité externe existe ; sans adoption, son
 * premier PUT en créerait seize de plus. `adopt: "<id Meridian>"` lie
 * l'identifiant externe à cette ligne-là, une fois ; une ligne déjà liée
 * à un autre identifiant refuse.
 */
/**
 * L'adoption ne s'écrit PAS ici.
 *
 * Elle ouvrait sa propre transaction et la validait avant que l'appelant
 * n'ait fini de valider la requête. Entre les deux, tout ce qui pouvait
 * échouer échouait avec la liaison déjà écrite : un PUT refusé en 400
 * pour un `pm` inconnu saisissait définitivement un projet auquel
 * l'intégration n'avait jamais réussi à écrire, sans aucun chemin de
 * retour — la ligne, désormais liée, refuse toute autre adoption en 409.
 * La frontière de transaction d'une écriture EST la requête.
 *
 * Donc : on valide, et on rend la liaison à poser. L'appelant la joint au
 * `patch` de sa propre écriture, et les deux valident ou annulent
 * ensemble. (Conseiller sécurité H-2, docs/33 §5.)
 */
async function planAdoption(user, table, externalId, meridianId, what) {
  const row = await one(`SELECT * FROM ${table} WHERE id = $1`, [String(meridianId)]);
  if (!row) bad(`adopt: no such ${what} ${meridianId}`);
  if (row.external_id && (row.external_source !== user.id || row.external_id !== externalId)) {
    throw new HttpError(409, `${what} ${row.id} is already bound to another external id`);
  }
  if (row.origin === "sdp") throw new HttpError(403, `This ${what} is synchronised from the SDP roadmap — it is edited there`);
  /* Une ligne déjà liée à CETTE intégration sous CE même identifiant n'a
     rien à poser : l'adoption est idempotente comme le reste. */
  const binding = row.external_id ? {} : { external_source: user.id, external_id: externalId };
  return { row, binding };
}

/** Combien de jalons l'échelle du programme de ce projet compte (I-3). */
export async function ladderLength(projectId) {
  const row = await one(
    `SELECT pr.gate_model FROM project p JOIN programme pr ON pr.id = p.programme_id WHERE p.id = $1`, [projectId]);
  const m = row?.gate_model;
  try { const parsed = typeof m === "string" ? JSON.parse(m) : m; return Array.isArray(parsed) && parsed.length ? parsed.length : 4; }
  catch { return 4; }
}

/* ── projets ───────────────────────────────────────────────────────── */

export async function upsertProject(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM project WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "project", externalId, b.adopt, "project");
    existing = plan.row; binding = plan.binding;
  }
  const name = text(b.name, 300, "name", !existing);
  const pm = b.pm !== undefined ? await resolvePerson(b.pm, "pm") : undefined;
  const method = b.method === undefined ? undefined
    : ["Waterfall", "Agile", "Hybrid"].includes(b.method) ? b.method : bad("method is Waterfall, Agile or Hybrid");
  const start = isoDate(b.start, "start");
  const finish = isoDate(b.finish, "finish");
  const budget = money(b.budget, "budget");
  const contingency = money(b.contingency, "contingency");
  const desc = text(b.desc, 4000, "desc");
  /* REQ-19 (045) — la même question qu'un jalon depuis REQ-14 : cette
     date est-elle un engagement, ou une position qui attend la mesure
     qui la produira ? RT365 : « nos dates de fin de projet sont des
     remplissages pour la même raison que nos dates de porte ». */
  let basis;
  if (b.dateBasis !== undefined) {
    if (!["committed", "placeholder"].includes(b.dateBasis)) bad("dateBasis is committed or placeholder");
    basis = b.dateBasis;
  }
  const condition = text(b.condition, 500, "condition");
  /* Le sponsor répond du CAS D'AFFAIRE ; le chef de projet répond de la
     livraison. Une personne de l'annuaire, comme `pm` : un sponsor qui
     ne résout pas est une chaîne, pas une responsabilité. */
  const sponsor = b.sponsor !== undefined ? await resolvePerson(b.sponsor, "sponsor") : undefined;
  const criteria = text(b.acceptanceCriteria, 4000, "acceptanceCriteria");
  const status = b.status === undefined ? undefined
    : ["Open", "Closed"].includes(b.status) ? b.status
    : bad("status is Open or Closed");

  if (!existing) {
    /* Clore est un ACTE SIGNÉ, daté, audité pour lui-même (PM-08) : on ne
       naît pas clos. Le refus dit le geste à faire, il ne dit pas non. */
    if (status === "Closed") {
      bad("A project is not created closed — create it, then close it with status: \"Closed\", " +
          "opsAcceptedBy and benefitsTo, so the closure is its own dated act");
    }
    if (!b.programme || !b.site) bad("A project needs a programme and a site");
    const prog = await one(`SELECT id FROM programme WHERE id = $1 AND active`, [String(b.programme)]);
    if (!prog) bad(`No such programme: ${b.programme}`);
    const site = await one(`SELECT id FROM site WHERE id = $1 AND active`, [String(b.site)]);
    if (!site) bad(`No such site: ${b.site}`);
    if (!start || !finish) bad("A project needs a start and a finish date");
    if (D(finish) < D(start)) bad("A project cannot finish before it starts");
    const level = b.governanceLevel === "group" ? "group" : "site";
    let id = null;
    await audited(user,
      () => ({ action: "Project created", entity: "project", entityId: id,
               detail: `${name} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "PRJ", { step: 3 });
        await t.query(
          `INSERT INTO project
             (id, name, programme_id, site_id, governance_level, pm_id, method,
              start_date, finish_date, baseline_finish, budget, contingency,
              description, phase, external_source, external_id,
              date_basis, condition, sponsor_id, acceptance_criteria)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Initiation',$14,$15,$16,$17,$18,$19)`,
          [id, name, prog.id, site.id, level, pm ?? null, method ?? "Hybrid",
           start, finish, isoDate(b.baselineFinish, "baselineFinish") ?? finish,
           budget ?? 0, contingency ?? 0, desc ?? "", source, externalId,
           basis ?? "committed", condition ?? "", sponsor ?? null, criteria ?? ""]);
        await scaffoldProject(t, { id, name, programme: prog.id, site: site.id,
          pm: pm ?? null, method: method ?? "Hybrid", start, finish });
      });
    return stamp(true, id, externalId, 1);
  }

  if (existing.origin === "sdp") throw new HttpError(403, "This project is synchronised from the SDP roadmap — it is edited there");
  let patch = {};
  if (name !== undefined) patch.name = name;
  if (pm !== undefined) patch.pm_id = pm;
  if (method !== undefined) patch.method = method;
  if (start) patch.start_date = start;
  if (finish) patch.finish_date = finish;
  if (desc !== undefined) patch.description = desc;
  if (budget !== undefined) patch.budget = budget;
  if (contingency !== undefined) patch.contingency = contingency;
  if (basis !== undefined) patch.date_basis = basis;
  if (condition !== undefined) patch.condition = condition;
  if (sponsor !== undefined) patch.sponsor_id = sponsor;
  if (criteria !== undefined) patch.acceptance_criteria = criteria;
  /* PM-08 par l'API — les MÊMES trois signatures que l'écran. Une route
     d'intégration n'est pas une porte dérobée vers moins de règles :
     sans exploitant nommé, le jour où ça tombe en panne c'est l'équipe
     dissoute qu'on appelle ; sans propriétaire de bénéfice, « les
     bénéfices restent au projet » veut dire « à personne ». C'est ici
     que `closed_on` — colonne de la 032 — cesse d'être perdue : le
     chemin d'écriture ne connaissait tout simplement pas `status`, et
     répondait 200 sans rien écrire (REQ-19, observation). */
  const closing = status === "Closed" && !existing.closed;
  if (closing) {
    const ops = await resolvePerson(b.opsAcceptedBy, "opsAcceptedBy");
    if (!ops) bad("Closing needs opsAcceptedBy — the named operations owner who takes this over");
    const benefits = await resolvePerson(b.benefitsTo, "benefitsTo");
    if (!benefits) bad("Closing needs benefitsTo — the named benefits owner; benefits realise AFTER closure");
    patch.closed = true;
    patch.phase = "Closed";
    patch.closed_on = iso(new Date());
    patch.ops_accepted_by = ops;
    patch.benefits_owner_id = benefits;
    patch.closure_note = text(b.closureNote, 2000, "closureNote") ?? "";
  } else if (status === "Open" && existing.closed) {
    /* Rouvrir effacerait la date et les deux noms qui ont signé. Le
       registre garde ce qui a eu lieu ; ce qui reprend est un nouveau
       travail, avec sa propre décision. */
    throw new HttpError(409,
      `Project ${existing.id} is closed, and a closure is signed and dated — ` +
      "record a decision that reopens the work, or raise the follow-on project");
  } else if (status !== undefined && b.closureNote !== undefined) {
    patch.closure_note = text(b.closureNote, 2000, "closureNote") ?? "";
  }
  const s0 = patch.start_date ?? existing.start_date, f0 = patch.finish_date ?? existing.finish_date;
  if (D(f0) < D(s0)) bad("A project cannot finish before it starts");
  const shifted = (patch.start_date && patch.start_date !== existing.start_date) ||
                  (patch.finish_date && patch.finish_date !== existing.finish_date);
  const statusToday = shifted ? ((await loadSettings()).statusDate ?? iso(new Date())) : null;
  const version = sentVersion(b);
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);

  const out = await audited(user,
    { action: closing ? "Project closed" : "Project updated", entity: "project", entityId: existing.id,
      detail: `${patch.name ?? existing.name} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await writeRow(t, "project", existing.id, version, patch, "project");
      if (shifted) {
        /* Même geste que PATCH /projects/:id : déplacer la fenêtre
           ré-étire le plan, jamais la référence (A1). */
        const fresh = (await t.query(`SELECT id, method, start_date, finish_date, date_basis FROM project WHERE id = $1`, [existing.id])).rows[0];
        const acts = (await t.query(`SELECT id, stage FROM activity WHERE project_id = $1`, [existing.id])).rows;
        for (const m of reschedule({ id: fresh.id, method: fresh.method, start: fresh.start_date, finish: fresh.finish_date }, acts)) {
          await t.query(`UPDATE activity SET start_date = $2, end_date = $3, row_version = row_version + 1 WHERE id = $1`,
            [m.id, m.start, m.end]);
        }
        /* REQ-19 — une date de fin qui n'est qu'une position ne fait pas
           avancer la phase : `phaseFor` mesure la fraction écoulée
           aujourd'hui, et la ferait glisser toute seule vers Closure sur
           une date que personne n'a promise (même règle qu'à l'écran). */
        if (fresh.date_basis !== "placeholder") {
          await t.query(`UPDATE project SET phase = $2 WHERE id = $1`,
            [existing.id, phaseFor({ start: fresh.start_date, finish: fresh.finish_date }, statusToday)]);
        }
      }
      return rv;
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── jalons ────────────────────────────────────────────────────────── */

export async function upsertMilestone(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM milestone WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  /* Adopter un jalon de GOUVERNANCE échafaudé par l'échelle (I-3) est la
     seule façon, par l'API, de consigner « la porte A est passée » sur le
     jalon que le moteur lit — et non sur un jalon ordinaire à côté (O-75). */
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "milestone", externalId, b.adopt, "milestone");
    existing = plan.row; binding = plan.binding;
  }
  const p = existing ? await resolveProject(source, existing.project_id) : await resolveProject(source, b.project);
  if (!p) bad("A milestone needs a project — a Meridian id, or an external id you created");
  const name = text(b.name, 300, "name", !existing);
  const date = isoDate(b.date, "date");
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const criteria = text(b.acceptanceCriteria, 4000, "acceptanceCriteria");
  const acceptedBy = b.acceptedBy !== undefined ? await resolvePerson(b.acceptedBy, "acceptedBy") : undefined;
  /* REQ-45 (049) — le jour où la porte a été cochée, et par qui. Plus
     faible que l'acceptation : cocher n'est pas constater des critères
     (032). Le registre source qui connaît le vrai jour l'envoie. */
  const doneOn = isoDate(b.doneOn, "doneOn");
  const doneBy = b.doneBy !== undefined ? await resolvePerson(b.doneBy, "doneBy") : undefined;
  /* REQ-14 (RT365 D-057) — a date that is a position, not a promise. */
  let basis;
  if (b.dateBasis !== undefined) {
    if (!["committed", "placeholder"].includes(b.dateBasis)) bad("dateBasis is committed or placeholder");
    basis = b.dateBasis;
  }
  const condition = text(b.condition, 500, "condition");

  /* V-03 — la même question de gel de site que l'écran, AVANT la
     transaction : une bascule datée dans un arrêt d'usine est refusée
     quel que soit le chemin par lequel elle arrive. */
  const plant = await one(`SELECT site_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
  const wantsIntrusive = b.intrusive === undefined ? !!existing?.intrusive : !!b.intrusive;
  if (wantsIntrusive && (date || b.intrusive !== undefined)) {
    await assertPlantWindow(plant, { date: date ?? existing?.due_date, intrusive: true });
  }

  /* REQ-22 (V-3) — et la même question de cas d'affaire que l'écran :
     franchir un jalon de gouvernance est la décision de continuer à
     dépenser. Un contrôle posé sur un seul des deux chemins n'est pas un
     contrôle (conseiller code, sur le gel d'usine). */
  if (b.done !== undefined && existing) {
    await assertCaseReconfirmed(p, existing, { done: !!b.done });
  }

  if (!existing) {
    if (!date) bad("A milestone needs a date");
    /* Créer ET cocher dans le même PUT : la règle d'acceptation (PM-04) se
       vérifie AVANT d'insérer — une ligne créée puis un 400 serait un
       demi-geste que la piste dirait entier. */
    const done = !!b.done;
    if (done && String(criteria ?? "").trim() && !acceptedBy) {
      bad("This milestone has acceptance criteria — done needs acceptedBy, the person who checked them");
    }
    let id = null;
    await audited(user,
      () => ({ action: done ? "Milestone accepted" : "Milestone added", entity: "milestone", entityId: id,
               detail: `${name} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        const n = await allocateId(t, "MS");
        id = p.id + "-M" + n.split("-")[1];
        await t.query(
          `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, intrusive,
                                  acceptance_criteria, external_source, external_id, done, accepted_by, accepted_on,
                                  done_on, done_by, date_basis, condition)
           VALUES ($1,$2,$3,$4,$4,NULL,'milestone',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [id, p.id, name, date, owner ?? p.pm_id ?? null, !!b.intrusive, criteria ?? "", source, externalId,
           done, done && String(criteria ?? "").trim() ? acceptedBy : null,
           done && String(criteria ?? "").trim() ? iso(new Date()) : null,
           /* REQ-45 (049) — un jalon né coché dit quand il l'a été, avec
              ou sans critères. `doneOn` laisse au registre source le vrai
              jour ; sans lui, c'est celui où nous l'avons appris. */
           done ? (doneOn ?? iso(new Date())) : null, done ? (doneBy ?? acceptedBy ?? null) : null,
           basis ?? "committed", condition ?? ""]);
      });
    return stamp(true, id, externalId, 1);
  }

  if (existing.origin === "sdp") throw new HttpError(403, "This milestone is synchronised from the SDP roadmap — it is edited there");
  let patch = {};
  if (name !== undefined) patch.name = name;
  if (date) patch.due_date = date;
  if (owner !== undefined) patch.owner_id = owner;
  if (criteria !== undefined) patch.acceptance_criteria = criteria;
  if (b.intrusive !== undefined) patch.intrusive = !!b.intrusive;
  if (basis !== undefined) patch.date_basis = basis;
  if (condition !== undefined) patch.condition = condition;
  if (b.done !== undefined) {
    patch.done = !!b.done;
    const effective = criteria !== undefined ? criteria : existing.acceptance_criteria;
    if (patch.done && String(effective ?? "").trim()) {
      /* PM-04 — la même règle que l'écran : des critères posés exigent
         un accepteur nommé. Une intégration ne coche pas à la place de
         quelqu'un ; elle dit qui a constaté. */
      if (!acceptedBy) bad("This milestone has acceptance criteria — done needs acceptedBy, the person who checked them");
      patch.accepted_by = acceptedBy;
      patch.accepted_on = iso(new Date());
    }
    /* REQ-45 (049) — le contrat a le même trou que l'écran : une porte
       sans critères se cochait sans aucune date. Seulement sur la
       TRANSITION, et jamais rétro-daté sur une ligne déjà cochée. */
    if (patch.done && !existing.done) {
      patch.done_on = doneOn ?? iso(new Date());
      patch.done_by = doneBy ?? acceptedBy ?? null;
    }
    if (!patch.done) {
      patch.accepted_by = null; patch.accepted_on = null;
      patch.done_on = null; patch.done_by = null;
    }
  }
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: patch.done && !existing.done ? "Milestone accepted" : "Milestone updated",
      entity: "milestone", entityId: existing.id,
      detail: `${patch.name ?? existing.name} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "milestone", existing.id, version, patch, "milestone");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── RAID ──────────────────────────────────────────────────────────── */

const KINDS = ["Risk", "Issue", "Assumption", "Dependency"];
const RESPONSES = ["Mitigate", "Avoid", "Transfer", "Accept", "Monitor", "Fix"];

export async function upsertRaid(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM raid_item WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "raid_item", externalId, b.adopt, "register item");
    existing = plan.row; binding = plan.binding;
  }
  const p = existing ? (existing.project_id ? await resolveProject(source, existing.project_id) : null)
                     : await resolveProject(source, b.project);
  const title = text(b.title, 300, "title", !existing);
  const detail = text(b.detail, 4000, "detail");
  const kind = b.type === undefined ? undefined : KINDS.includes(b.type) ? b.type : bad("type is Risk, Issue, Assumption or Dependency");
  const response = b.response === undefined ? undefined : RESPONSES.includes(b.response) ? b.response : bad("response is " + RESPONSES.join(", "));
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const review = b.review === undefined ? undefined : isoDate(b.review, "review");
  let gateN;
  if (b.gate !== undefined) {
    if (b.gate === null || b.gate === "") gateN = null;
    else {
      gateN = Number(b.gate);
      if (!Number.isInteger(gateN) || gateN < 1) bad("gate is a whole number — the rank of a gate in the programme's ladder");
    }
  }
  if (gateN && p) {
    const n = await ladderLength(p.id);
    if (gateN > n) bad(`gate ${gateN} does not exist — this project's programme has ${n} gates`);
  }
  const cr = b.cr === undefined ? undefined : await resolveRef("change_request", source, b.cr, p?.id ?? null, "cr");
  const status = b.status === undefined ? undefined : b.status === "Closed" ? "Closed" : "Open";
  /* REQ-13 — le mot du système qui tient CE registre, à côté du nôtre.
     `type` reste Risk/Issue/Assumption/Dependency : c'est le contrat que
     le moteur lit (exposition, escalade), et il ne s'ouvre pas. */
  const category = text(b.category, 120, "category");
  /* REQ-18 — quand, et sur la parole de qui. Mesuré : « status: Closed
     répond 200 et se relit close pendant que closed_on reste null ». */
  const closedOn = b.closedOn === undefined ? undefined : isoDate(b.closedOn, "closedOn");
  const closedBy = b.closedBy !== undefined ? await resolvePerson(b.closedBy, "closedBy") : undefined;
  if ((closedOn || closedBy) && status !== "Closed" && !(existing && existing.status === "Closed" && status === undefined)) {
    bad("closedOn and closedBy belong to a closure — send status: \"Closed\" with them, " +
        "or correct them on an item that is already closed");
  }

  if (!existing) {
    const k = kind ?? "Risk";
    const prefix = { Risk: "RSK", Issue: "ISS", Assumption: "ASM", Dependency: "DEP" }[k];
    let id = null;
    await audited(user,
      () => ({ action: k + " raised", entity: "raid_item", entityId: id,
               detail: `${title} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, prefix, { pad: 2 });
        await t.query(
          `INSERT INTO raid_item
             (id, project_id, kind, title, detail, probability, impact, status, response, owner_id,
              opened_on, review_on, target_probability, target_impact, gate, cr_id, external_source, external_id,
              category, closed_on, closed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [id, p?.id ?? null, k, title, detail ?? "", clampScale(b.p, 3), clampScale(b.i, 3),
           status ?? "Open", response ?? "Monitor", owner ?? null, review ?? null,
           clampScale(b.tp), clampScale(b.ti), gateN ?? null, cr ?? null, source, externalId,
           category ?? "",
           /* Une ligne chargée DÉJÀ close porte sa date de clôture : sans
              elle, un registre repris arriverait clos sans histoire — la
              perte que REQ-18 a mesurée, au chargement initial. */
           status === "Closed" ? (closedOn ?? iso(new Date())) : null,
           status === "Closed" ? (closedBy ?? null) : null]);
      });
    return stamp(true, id, externalId, 1);
  }

  let patch = {};
  if (title !== undefined) patch.title = title;
  if (detail !== undefined) patch.detail = detail;
  if (kind !== undefined) patch.kind = kind;
  if (b.p !== undefined) patch.probability = clampScale(b.p, 3);
  if (b.i !== undefined) patch.impact = clampScale(b.i, 3);
  if (b.tp !== undefined) patch.target_probability = clampScale(b.tp);
  if (b.ti !== undefined) patch.target_impact = clampScale(b.ti);
  if (response !== undefined) patch.response = response;
  if (owner !== undefined) patch.owner_id = owner;
  if (review !== undefined) patch.review_on = review;
  if (gateN !== undefined) patch.gate = gateN;
  if (cr !== undefined) patch.cr_id = cr;
  if (category !== undefined) patch.category = category;
  if (status !== undefined) patch.status = status;
  /* REQ-18 — la clôture porte sa date. `closedOn` envoyé fait foi (un
     synchroniseur connaît la date de SON registre) ; sinon aujourd'hui.
     Rouvrir efface les deux : une ligne ouverte n'a pas de clôture, et
     laisser la vieille date derrière serait le mensonge symétrique. */
  if (status === "Closed" && existing.status !== "Closed") {
    patch.closed_on = closedOn ?? iso(new Date());
    patch.closed_by = closedBy ?? null;
  } else if (status === "Open" && existing.status === "Closed") {
    patch.closed_on = null;
    patch.closed_by = null;
  } else {
    /* Corriger la clôture d'une ligne déjà close : la date se rectifie,
       le nom aussi — ce sont des faits consignés, pas des verrous. */
    if (closedOn !== undefined) patch.closed_on = closedOn;
    if (closedBy !== undefined) patch.closed_by = closedBy;
  }
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: status === "Closed" && existing.status !== "Closed" ? "Item closed" : "Item updated",
      entity: "raid_item", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "raid_item", existing.id, version, patch, "raid item");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── décisions ─────────────────────────────────────────────────────── */

const DECISION_STATUS = ["Proposed", "Ratified"];
const evidenceUri = (v) => {
  if (v === undefined) return undefined;
  const u = String(v ?? "").trim();
  if (!u) return "";
  /* D-8 — une preuve versionnée dans un dépôt en est une. Voir
     server/src/evidence.js pour ce qui est accepté et pourquoi la prose
     reste refusée. */
  if (!isEvidenceLocator(u)) bad(EVIDENCE_REFUSAL);
  return u.slice(0, 1000);
};

export async function upsertDecision(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM meeting_decision WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "meeting_decision", externalId, b.adopt, "decision");
    existing = plan.row; binding = plan.binding;
  }
  const headline = text(b.headline, 1000, "headline", !existing);
  if (existing) {
    /* La SUBSTANCE est immuable (D-33.3) : un re-PUT qui la change est
       refusé — une décision qui change en est une nouvelle. L'ÉTAT — statut,
       ratifieur, lien de preuve — vit, et chaque changement s'audite. */
    const decidedByS = b.decidedBy === undefined ? undefined : await resolvePerson(b.decidedBy, "decidedBy");
    const projS = b.project === undefined ? undefined : (await resolveProject(source, b.project))?.id ?? null;
    const substance = [
      ["decidedBy", decidedByS, existing.decided_by],
      ["council", b.council === undefined ? undefined : String(b.council).trim().slice(0, 200), existing.council],
      ["decidedOn", b.decidedOn === undefined ? undefined : isoDate(b.decidedOn, "decidedOn"), existing.decided_on],
      ["project", projS, existing.project_id],
      ["headline", headline, existing.headline],
      /* Comparer EXACTEMENT ce que la création stocke : `text()` élague.
         Comparer sans élaguer rendait tout motif à espace ou saut de ligne
         final — une cellule markdown, un heredoc, une justification sur
         plusieurs lignes — définitivement non idempotent : le re-PUT
         identique repartait en 409. (Intégrateur, docs/33 §5.) */
      ["rationale", text(b.rationale, 4000, "rationale"), existing.rationale],
      ["alternatives", text(b.alternatives, 4000, "alternatives"), existing.alternatives],
      ["dissent", text(b.dissent, 2000, "dissent"), existing.dissent],
    ].filter(([, sent, was]) => sent !== undefined && sent !== was).map(([k]) => k);
    if (substance.length) {
      throw new HttpError(409,
        `Decision ${existing.id} is on the record; ${substance.join(", ")} cannot change — record a new one that supersedes it`);
    }
    const patch = {};
    if (b.status !== undefined) {
      if (!DECISION_STATUS.includes(b.status)) bad("status is Proposed or Ratified");
      patch.status = b.status;
    }
    if (b.ratifiedBy !== undefined) patch.ratified_by = null;   // résolu plus bas, contre l'annuaire
    const uri = evidenceUri(b.evidenceUri);
    if (uri !== undefined) patch.evidence_uri = uri;
    if (b.provenance !== undefined) patch.provenance = String(b.provenance ?? "").slice(0, 200);
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== existing[k]));
    Object.assign(changed, binding);   // H-2 — la liaison valide avec l'écriture
    if (!Object.keys(changed).length) return stamp(false, existing.id, externalId, existing.row_version);
    /* H-3 — ratifier n'est pas enregistrer. Qui ratifie est une personne
       de l'annuaire, et ce n'est pas celle qui a décidé ni le compte qui
       a consigné : sans cela une seule clé `write:meetings` proposait une
       décision puis la ratifiait sous un ratifieur en texte libre, et
       /api/v1 était le SEUL chemin vers cet état — donc aucun des gardes
       d'indépendance de `change.approve`. L'autorité se décide dans
       shared/rbac.js, comme partout ailleurs. (Conseiller sécurité H-3.) */
    if (changed.status === "Ratified" || changed.ratified_by !== undefined) {
      const who = await resolvePerson(b.ratifiedBy, "ratifiedBy");
      if (!who) bad("Ratifying a decision names the person who ratified it: ratifiedBy, an active person");
      const verdict = canRatifyDecision({ ratifier: who, decidedBy: existing.decided_by, recordedBy: existing.recorded_by });
      if (!verdict.ok) throw new HttpError(403, verdict.why);
      changed.ratified_by = who;
    }
    /* REQ-47 (049) — la ratification a enfin un JOUR. Une décision qui
       DEVIENT ratifiée l'est le jour de ce geste : celui que l'appelant
       déclare quand son registre le connaît, sinon celui où nous
       l'apprenons. Et le retour en arrière l'efface — une décision
       proposée n'a pas été ratifiée un jour, ce que la contrainte
       `decision_ratification_dated` tient au niveau de la table. */
    if (changed.status === "Ratified") {
      changed.ratified_on = isoDate(b.ratifiedOn, "ratifiedOn") ?? iso(new Date());
    } else if (changed.status === "Proposed") {
      changed.ratified_on = null;
    }
    const version = sentVersion(b);
    const out = await audited(user,
      { action: changed.status === "Ratified" ? "Decision ratified" : "Decision state updated",
        entity: "meeting_decision", entityId: existing.id,
        detail: `${existing.headline.slice(0, 120)} — from ${user.displayName} (${externalId})`,
        before: Object.fromEntries(Object.keys(changed).map((k) => [k, existing[k]])), after: changed },
      /* 041 — la table porte enfin `row_version` : l'état d'une décision
         s'écrit sous le même prédicat que toute autre ligne mutable. */
      async (t) => writeRow(t, "meeting_decision", existing.id, version, changed, "decision"));
    return stamp(false, existing.id, externalId, out.version);
  }
  const decidedBy = await resolvePerson(b.decidedBy, "decidedBy");
  const council = String(b.council ?? "").trim().slice(0, 200);
  if (!decidedBy && !council) bad("A decision names who decided: decidedBy (an active person) or council (the deciding body, e.g. \"ARB\")");
  const on = isoDate(b.decidedOn, "decidedOn") ?? iso(new Date());
  const p = await resolveProject(source, b.project);
  const crId = await resolveRef("change_request", source, b.cr, p?.id ?? null, "cr");
  const raidId = await resolveRef("raid_item", source, b.raid, p?.id ?? null, "raid");
  const msId = await resolveRef("milestone", source, b.milestone, p?.id ?? null, "milestone");
  let supersedes = null;
  if (b.supersedes) {
    const prev = await one(
      `SELECT id FROM meeting_decision WHERE id = $1 OR (external_source = $2 AND external_id = $1)`,
      [String(b.supersedes), source]);
    if (!prev) bad("supersedes: that decision does not exist");
    supersedes = prev.id;
  }
  /* Même règle à la création : un ratifieur est quelqu'un de l'annuaire,
     et ce n'est pas celui qui a décidé. (Conseiller sécurité H-3.) */
  let ratifiedBy = null;
  if (b.ratifiedBy !== undefined && String(b.ratifiedBy ?? "") !== "") {
    ratifiedBy = await resolvePerson(b.ratifiedBy, "ratifiedBy");
    if (!ratifiedBy) bad("ratifiedBy names an active person");
    const verdict = canRatifyDecision({ ratifier: ratifiedBy, decidedBy, recordedBy: user.id });
    if (!verdict.ok) throw new HttpError(403, verdict.why);
  }
  let id = null;
  await audited(user,
    () => ({ action: "Decision recorded", entity: "meeting_decision", entityId: id,
             detail: `${headline} — from ${user.displayName} (${externalId})` + (supersedes ? " — supersedes " + supersedes : "") }),
    async (t) => {
      id = await allocateId(t, "DEC", { pad: 3 });
      await t.query(
        `INSERT INTO meeting_decision
           (id, occurrence_id, headline, rationale, alternatives, dissent, project_id, cr_id, raid_id,
            milestone_id, supersedes, decided_by, decided_on, recorded_by, external_source, external_id,
            council, evidence_uri, provenance, status, ratified_by, ratified_on)
         VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [id, headline, text(b.rationale, 4000, "rationale") ?? "", text(b.alternatives, 4000, "alternatives") ?? "",
         text(b.dissent, 2000, "dissent") ?? "", p?.id ?? null, crId, raidId, msId, supersedes,
         decidedBy, on, user.id, source, externalId,
         council, evidenceUri(b.evidenceUri) ?? "", String(b.provenance ?? "").slice(0, 200),
         DECISION_STATUS.includes(b.status) ? b.status : "Ratified", ratifiedBy ?? "",
         /* REQ-47 — une décision qui NAÎT ratifiée l'est depuis le jour
            où elle a été prise : « Ratified » à la création veut dire
            qu'elle est en vigueur, et elle l'est depuis ce jour-là. Née
            « Proposed », elle n'a pas de date — et n'en aura une qu'au
            geste qui la ratifie. */
         (DECISION_STATUS.includes(b.status) ? b.status : "Ratified") === "Ratified"
           ? (isoDate(b.ratifiedOn, "ratifiedOn") ?? on) : null]);
    });
  return stamp(true, id, externalId, 1);
}

/* ── critères de jalon (REQ-04 sur le contrat) ─────────────────────── */

export async function upsertCriterion(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM gate_criterion WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "gate_criterion", externalId, b.adopt, "criterion");
    existing = plan.row; binding = plan.binding;
  }
  let born = false;
  const p = existing ? await resolveProject(source, existing.project_id) : await resolveProject(source, b.project);
  if (!p) bad("A criterion belongs to a project — a Meridian id, or an external id you created");
  const textV = text(b.text, 500, "text", !existing);
  const note = text(b.note, 2000, "note");
  let doc;
  if (b.document !== undefined) {
    doc = b.document ? await one(`SELECT id, owner_id, project_id FROM document WHERE id = $1 OR (external_source = $2 AND external_id = $1)`, [String(b.document), source]) : null;
    if (b.document && (!doc || (doc.project_id && doc.project_id !== p.id))) bad("document: does not exist on this project");
  }
  if (!existing) {
    const g = Math.round(Number(b.gate));
    const n = await ladderLength(p.id);
    if (!(g >= 1 && g <= n)) bad(`A criterion belongs to a gate 1..${n} of this project's programme`);
    let id = null;
    await audited(user,
      () => ({ action: "Gate criterion posed", entity: "gate_criterion", entityId: id,
               detail: `gate ${g} · ${textV} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "GC");
        await t.query(
          `INSERT INTO gate_criterion (id, project_id, gate, seq, text, document_id, note, external_source, external_id)
           VALUES ($1,$2,$3,(SELECT COALESCE(MAX(seq), -1) + 1 FROM gate_criterion WHERE project_id = $2 AND gate = $3),$4,$5,$6,$7,$8)`,
          [id, p.id, g, textV, doc?.id ?? null, note ?? "", source, externalId]);
      });
    existing = await one(`SELECT * FROM gate_criterion WHERE id = $1`, [id]);
    if (b.met === undefined) return stamp(true, id, externalId, 1);
    /* Poser et constater d'un seul PUT reste UNE création. Sans ce drapeau
       la ligne repartait par le chemin de mise à jour et répondait
       `created: false` sur une ligne qui n'existait pas — un appelant qui
       compte ses créations comptait faux. (Intégrateur, docs/33 §5.) */
    born = true;
  }
  let patch = {};
  if (textV !== undefined) patch.text = textV;
  if (note !== undefined) patch.note = note;
  if (doc !== undefined) patch.document_id = doc?.id ?? null;
  if (b.met !== undefined) {
    if (b.met) {
      /* Le même constat que l'écran : un réviseur nommé, indépendant de
         la preuve citée. Une intégration ne constate pas à la place de
         quelqu'un ; elle dit qui a constaté. */
      const who = await resolvePerson(b.reviewedBy, "reviewedBy");
      if (!who) bad("Finding a criterion met needs reviewedBy — the named person who checked it");
      const linked = doc !== undefined ? doc : (existing.document_id ? await one(`SELECT id, owner_id FROM document WHERE id = $1`, [existing.document_id]) : null);
      if (linked?.owner_id && linked.owner_id === who) bad("The reviewer owns the evidence this criterion cites — an independent reviewer finds it met");
      patch.met = true; patch.reviewed_by = who; patch.reviewed_on = iso(new Date());
    } else { patch.met = false; patch.reviewed_by = null; patch.reviewed_on = null; }
  }
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(born, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: patch.met === true && !existing.met ? "Gate criterion met" : patch.met === false && existing.met ? "Gate criterion reopened" : "Gate criterion updated",
      entity: "gate_criterion", entityId: existing.id,
      detail: `gate ${existing.gate} · ${patch.text ?? existing.text} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "gate_criterion", existing.id, version, patch, "gate criterion");
    });
  return stamp(born, existing.id, externalId, out.version);
}

/* ── actions ───────────────────────────────────────────────────────── */

const ACTION_STATUS = ["Open", "In progress", "Done", "Cancelled"];

export async function upsertAction(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM meeting_action WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    /* La liaison rejoint le `patch` ci-dessous : elle valide avec
       l'écriture, ou elle n'a pas lieu (H-2). */
    const plan = await planAdoption(user, "meeting_action", externalId, b.adopt, "action");
    existing = plan.row; binding = plan.binding;
  }
  const title = text(b.title, 300, "title", !existing);
  const detail = text(b.detail, 2000, "detail");
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const due = b.dueDate === undefined ? undefined : isoDate(b.dueDate, "dueDate");
  const status = b.status === undefined ? undefined : ACTION_STATUS.includes(b.status) ? b.status : bad("status is " + ACTION_STATUS.join(", "));
  const p = b.project !== undefined ? await resolveProject(source, b.project) : undefined;

  if (!existing) {
    /* Une action naît dans une salle OUVERTE : celle qu'on nomme, ou la
       salle ouverte de la série qu'on nomme. Ouvrir une salle reste un
       geste humain — l'API n'ouvre rien. */
    let occ = null;
    if (b.occurrence) {
      occ = await one(`SELECT * FROM meeting_occurrence WHERE id = $1`, [String(b.occurrence)]);
      if (!occ) bad(`No such meeting occurrence: ${b.occurrence}`);
    } else if (b.series) {
      occ = await one(
        `SELECT * FROM meeting_occurrence WHERE series_id = $1 AND status = 'open'
          ORDER BY meets_on DESC LIMIT 1`, [String(b.series)]);
      if (!occ) throw new HttpError(409, `Series ${b.series} has no open occurrence — a chair opens the meeting; the API does not`);
    } else bad("An action is raised in a meeting: send occurrence (an open occurrence id) or series (a series id with an open occurrence)");
    if (occ.status === "closed") throw new HttpError(409, "That meeting is closed — its record is final");
    if (occ.status !== "open") throw new HttpError(409, "Open the meeting before raising actions in it");
    let id = null;
    await audited(user,
      () => ({ action: "Action raised", entity: "meeting_action", entityId: id,
               detail: `${title} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "ACT", { pad: 3 });
        await t.query(
          `INSERT INTO meeting_action
             (id, series_id, raised_in, title, detail, owner_id, project_id, due_date, status, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, occ.series_id, occ.id, title, detail ?? "", owner ?? null, p?.id ?? null, due ?? null,
           status ?? "Open", source, externalId]);
      });
    return stamp(true, id, externalId, 1);
  }

  let patch = {};
  if (title !== undefined) patch.title = title;
  if (detail !== undefined) patch.detail = detail;
  if (owner !== undefined) patch.owner_id = owner;
  if (due !== undefined) patch.due_date = due;
  if (p !== undefined) patch.project_id = p?.id ?? null;
  if (status !== undefined) {
    patch.status = status;
    if (status === "Done" || status === "Cancelled") patch.closed_at = new Date().toISOString();
  }
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: status ? "Action " + status.toLowerCase() : "Action updated",
      entity: "meeting_action", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "meeting_action", existing.id, version, patch, "meeting action");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── avancement d'étape (I-5, première tranche) ────────────────────── */

export async function upsertActivity(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM activity WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  if (!existing) {
    /* Une étape n'est pas créée par un système de suivi : le plan est
       celui du projet (méthode, pondérations, référence). L'intégration
       LIE son identifiant à une étape existante, puis remonte l'avancement. */
    if (!b.activity) bad("Bind your id to an existing stage first: send activity (a Meridian activity id)");
    const a = await one(`SELECT * FROM activity WHERE id = $1`, [String(b.activity)]);
    if (!a) bad(`No such stage: ${b.activity}`);
    if (a.external_id && (a.external_source !== source || a.external_id !== externalId)) {
      throw new HttpError(409, `Stage ${a.id} is already bound to another external id`);
    }
    if (a.origin === "sdp") throw new HttpError(403, "This stage is synchronised from the SDP roadmap — it is edited there");
    await audited(user,
      { action: "Stage linked", entity: "activity", entityId: a.id,
        detail: `${a.name} ↔ ${user.displayName} (${externalId})` },
      async (t) => t.query(
        `UPDATE activity SET external_source = $2, external_id = $3, row_version = row_version + 1 WHERE id = $1`,
        [a.id, source, externalId]));
    existing = await one(`SELECT * FROM activity WHERE id = $1`, [a.id]);
    if (b.pct === undefined) return stamp(true, a.id, externalId, existing.row_version);
  }
  let patch = {};
  if (b.pct !== undefined) {
    const n = Math.round(Number(b.pct));
    if (!Number.isFinite(n) || n < 0 || n > 100) bad("pct is a whole number from 0 to 100");
    patch.pct = n;
    /* La provenance : QUI a mesuré, QUAND. C'est ce qui distingue un
       chiffre remonté d'un chiffre tapé (M-07). */
    patch.progress_source = text(b.source, 120, "source") || user.displayName;
    if (b.measuredAt !== undefined && b.measuredAt !== null && b.measuredAt !== "") {
      const ms = Date.parse(String(b.measuredAt));
      if (Number.isNaN(ms)) bad("measuredAt must be a date-time (ISO-8601)");
      patch.progress_at = new Date(ms).toISOString();
    } else patch.progress_at = new Date().toISOString();
  }
  if (b.name !== undefined) patch.name = text(b.name, 300, "name");
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: patch.pct !== undefined ? "Progress reported" : "Stage updated", entity: "activity", entityId: existing.id,
      detail: (patch.pct !== undefined ? `${existing.name} → ${patch.pct}% ` : existing.name) + `— from ${user.displayName} (${externalId})`,
      before: patch.pct !== undefined ? { pct: existing.pct } : undefined,
      after: patch.pct !== undefined ? { pct: patch.pct, source: patch.progress_source } : undefined },
    async (t) => {
      return writeRow(t, "activity", existing.id, version, patch, "activity");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── éléments de travail ───────────────────────────────────────────── */

export async function upsertWorkItem(user, externalId, b) {
  const source = user.id;
  const existing = await one(
    `SELECT * FROM work_item WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  const title = text(b.title, 300, "title", !existing);
  const assignee = b.assignee !== undefined ? await resolvePerson(b.assignee, "assignee") : undefined;
  let column;
  if (b.column !== undefined) {
    const c = await one(`SELECT id FROM board_column WHERE id = $1 OR name = $1 LIMIT 1`, [String(b.column)]);
    if (!c) bad(`No such board column: ${b.column}`);
    column = c.id;
  }
  const points = b.points === undefined ? undefined : Math.max(0, Math.round(Number(b.points) || 0));
  const priority = b.priority === undefined ? undefined : text(b.priority, 4, "priority");

  if (!existing) {
    const p = await resolveProject(source, b.project);
    if (!p) bad("A work item needs a project");
    let id = null;
    await audited(user,
      () => ({ action: "Work item added", entity: "work_item", entityId: id,
               detail: `${title} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "WI");
        await t.query(
          `INSERT INTO work_item (id, project_id, column_id, title, assignee_id, points, priority, created_on, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,$8,$9)`,
          [id, p.id, column ?? "backlog", title, assignee ?? null, points ?? 1, priority ?? "P3", source, externalId]);
      });
    return stamp(true, id, externalId, 1);
  }
  let patch = {};
  if (title !== undefined) patch.title = title;
  if (column !== undefined) patch.column_id = column;
  if (assignee !== undefined) patch.assignee_id = assignee;
  if (points !== undefined) patch.points = points;
  if (priority !== undefined) patch.priority = priority;
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: column !== undefined && column !== existing.column_id ? "Work item moved" : "Work item updated",
      entity: "work_item", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "work_item", existing.id, version, patch, "work item");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── la valeur : le cas d'affaire et les bénéfices (REQ-20 · V-1) ─────
   RT365, après avoir rejoué son évaluation sur la 5.10.0 : « REQ-02 a
   rendu les faits de LIVRAISON synchronisables depuis le dépôt de
   terrain ; les faits de VALEUR doivent toujours être saisis à la main,
   de sorte que la seule chose que lit un dirigeant est la seule chose
   qui se périme. Notre chargeur pousse 256 écritures de livraison et ne
   peut pousser un seul bénéfice. »

   Mêmes règles que les huit autres collections : la source nomme SA
   ligne, `adopt` reprend une ligne née à l'écran, `version` s'asserte si
   elle est envoyée, et l'audit porte le nom de l'intégration. */

const BENEFIT_KINDS = ["Production", "Availability", "Cost", "Risk", "Compliance"];
const BENEFIT_STATUS = ["Forecast", "Realised", "Partially realised", "Missed", "Withdrawn"];

/** Un nombre de bénéfice garde SON unité : jamais divisé par le million. */
const measureNum = (v, what) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`${what} must be a number, or null`);
  return n;
};

export async function upsertBenefit(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM benefit WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    const plan = await planAdoption(user, "benefit", externalId, b.adopt, "benefit");
    existing = plan.row; binding = plan.binding;
  }
  const title = text(b.title, 300, "title", !existing);
  const detail = text(b.detail, 2000, "detail");
  const measure = text(b.measure, 300, "measure");
  const unit = text(b.unit, 40, "unit");
  const kind = b.kind === undefined ? undefined
    : BENEFIT_KINDS.includes(b.kind) ? b.kind : bad("kind is " + BENEFIT_KINDS.join(", "));
  const status = b.status === undefined ? undefined
    : BENEFIT_STATUS.includes(b.status) ? b.status : bad("status is " + BENEFIT_STATUS.join(", "));
  const baseline = measureNum(b.baseline, "baseline");
  const target = measureNum(b.target, "target");
  const actual = measureNum(b.actual, "actual");
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const realiseOn = b.realiseOn === undefined ? undefined : isoDate(b.realiseOn, "realiseOn");
  const measuredOn = b.measuredOn === undefined ? undefined : isoDate(b.measuredOn, "measuredOn");
  /* Un réalisé sans date de mesure est un chiffre que personne ne peut
     situer un an plus tard — c'est la règle de la 008, tenue ici aussi. */
  if (actual !== undefined && actual !== null && measuredOn === undefined
      && !(existing && existing.measured_on)) {
    bad("An actual needs measuredOn — the date it was measured, or the figure cannot be situated later");
  }

  if (!existing) {
    const p = await resolveProject(source, b.project);
    if (!p) bad("A benefit belongs to a project — a Meridian id, or an external id you created");
    let id = null;
    await audited(user,
      () => ({ action: "Benefit added", entity: "benefit", entityId: id,
               detail: `${kind ?? "Cost"} — ${title} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "BEN", { pad: 2 });
        await t.query(
          `INSERT INTO benefit
             (id, project_id, kind, title, detail, measure, unit, baseline, target, actual,
              owner_id, realise_on, measured_on, status, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [id, p.id, kind ?? "Cost", title, detail ?? "", measure ?? "", unit ?? "",
           baseline ?? null, target ?? null, actual ?? null, owner ?? null,
           realiseOn ?? null, measuredOn ?? null, status ?? "Forecast", source, externalId]);
      });
    return stamp(true, id, externalId, 1);
  }
  let patch = {};
  if (title !== undefined) patch.title = title;
  if (detail !== undefined) patch.detail = detail;
  if (measure !== undefined) patch.measure = measure;
  if (unit !== undefined) patch.unit = unit;
  if (kind !== undefined) patch.kind = kind;
  if (status !== undefined) patch.status = status;
  if (baseline !== undefined) patch.baseline = baseline;
  if (target !== undefined) patch.target = target;
  if (actual !== undefined) patch.actual = actual;
  if (owner !== undefined) patch.owner_id = owner;
  if (realiseOn !== undefined) patch.realise_on = realiseOn;
  if (measuredOn !== undefined) patch.measured_on = measuredOn;
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: patch.actual !== undefined && patch.actual !== existing.actual
        ? "Benefit measured" : "Benefit updated",
      entity: "benefit", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})`,
      before: { actual: existing.actual, status: existing.status },
      after: { actual: patch.actual ?? existing.actual, status: patch.status ?? existing.status } },
    async (t) => writeRow(t, "benefit", existing.id, version, patch, "benefit"));
  return stamp(false, existing.id, externalId, out.version);
}

export async function upsertBusinessCase(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM business_case WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  let binding = {};
  if (!existing && b.adopt) {
    const plan = await planAdoption(user, "business_case", externalId, b.adopt, "business case");
    existing = plan.row; binding = plan.binding;
  }
  const summary = text(b.summary, 4000, "summary", !existing);
  const basis = text(b.basis, 4000, "basis");
  /* L'argent d'un cas est en millions à l'entrée, comme à l'écran, et en
     unités entières en base — `fromM`, la même conversion partout. */
  const money = (v, what) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) bad(`${what} must be zero or more, in millions`);
    return fromM(n);
  };
  const cost = money(b.expectedCost, "expectedCost");
  const benefit = money(b.expectedBenefit, "expectedBenefit");

  if (!existing) {
    const p = await resolveProject(source, b.project);
    if (!p) bad("A business case belongs to a project — a Meridian id, or an external id you created");
    /* Un projet n'a qu'UN cas (contrainte UNIQUE de la 028) : si l'écran
       en a déjà écrit un, l'adopter est le geste, pas en créer un second
       qui serait refusé par la base sans rien expliquer. */
    const already = await one(`SELECT id, external_id FROM business_case WHERE project_id = $1`, [p.id]);
    if (already) {
      bad(`${p.id} already has a business case (${already.id}) — adopt it with adopt: "${already.id}" rather than writing a second`);
    }
    let id = null;
    await audited(user,
      () => ({ action: "Business case written", entity: "business_case", entityId: id,
               detail: `${p.id} — ${summary.slice(0, 80)} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        id = await allocateId(t, "CAS", { pad: 3 });
        await t.query(
          `INSERT INTO business_case
             (id, project_id, summary, expected_cost, expected_benefit, basis, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, p.id, summary, cost ?? null, benefit ?? null, basis ?? "", source, externalId]);
      });
    return stamp(true, id, externalId, 1);
  }
  let patch = {};
  if (summary !== undefined) patch.summary = summary;
  if (basis !== undefined) patch.basis = basis;
  if (cost !== undefined) patch.expected_cost = cost;
  if (benefit !== undefined) patch.expected_benefit = benefit;
  patch = changedOnly(patch, existing);            // ne réécrire que ce qui bouge
  /* Réviser le cas repose `updated_on` : le sérialiseur en déduit que la
     dernière reconfirmation ne couvre plus ce qui est écrit (028). Posé
     APRÈS le filtre — une re-passe identique ne révise rien, et ne doit
     donc pas périmer une reconfirmation qui tient toujours. */
  if (Object.keys(patch).length) patch.updated_on = iso(new Date());
  Object.assign(patch, binding);   // H-2 — la liaison valide avec l'écriture
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: "Business case updated", entity: "business_case", entityId: existing.id,
      detail: `${existing.project_id} — from ${user.displayName} (${externalId})`,
      before: { cost: existing.expected_cost, benefit: existing.expected_benefit },
      after: { cost: patch.expected_cost ?? existing.expected_cost,
               benefit: patch.expected_benefit ?? existing.expected_benefit } },
    async (t) => writeRow(t, "business_case", existing.id, version, patch, "business case"));
  return stamp(false, existing.id, externalId, out.version);
}

/* ── Idempotency-Key ───────────────────────────────────────────────── */

const IDEMPOTENCY_DAYS = 30;

/**
 * Le garde d'idempotence des routes d'écriture. Sans en-tête, la route
 * s'exécute telle quelle (le PUT est déjà idempotent par identité).
 * Avec : rejeu ou refus, puis mémorisation de la réponse.
 */
export function idempotent() {
  return async (req, res, next) => {
    const key = req.get("Idempotency-Key");
    if (!key) return next();
    if (key.length > 200) return res.status(400).json({ error: "Idempotency-Key is at most 200 characters" });
    try {
      /* Le corps est canonisé (clés triées) : le même objet sérialisé
         dans un autre ordre est la même requête. */
      const hash = sha(req.method + " " + req.originalUrl + "\n" + canonical(req.body ?? {}));
      /* RÉSERVER la clé avant d'agir : deux requêtes identiques et
         simultanées ne doivent pas courir toutes les deux. La réservation
         (status 0) est levée par la réponse ; une réservation encore en
         vol répond 409 « réessayez », jamais un doublon. */
      const reserved = await query(
        `INSERT INTO idempotency_key (integration_id, key, request_hash, status, response_json)
         VALUES ($1,$2,$3,0,'{}') ON CONFLICT DO NOTHING RETURNING key`, [req.user.id, key, hash]);
      if (!reserved.rows.length) {
        const seen = await one(
          `SELECT request_hash, status, response_json FROM idempotency_key
            WHERE integration_id = $1 AND key = $2`, [req.user.id, key]);
        if (seen.request_hash !== hash) {
          return res.status(422).json({
            error: "Idempotency-Key reused with a different request — a key names ONE request; use a new key",
          });
        }
        if (seen.status === 0) {
          return res.status(409).json({ error: "The same request is still in flight — retry in a moment" });
        }
        res.setHeader("Idempotent-Replayed", "true");
        const body = typeof seen.response_json === "string" ? JSON.parse(seen.response_json) : seen.response_json;
        return res.status(seen.status).json(body);
      }
      const settle = (status, obj) => (status < 300
        ? query(`UPDATE idempotency_key SET status = $3, response_json = $4 WHERE integration_id = $1 AND key = $2`,
            [req.user.id, key, status, JSON.stringify(obj)])
        /* Un refus n'est pas un acte : la réservation s'efface, la
           requête corrigée pourra reprendre la même clé. */
        : query(`DELETE FROM idempotency_key WHERE integration_id = $1 AND key = $2`, [req.user.id, key])
      ).catch(() => {});
      const plain = res.json.bind(res);
      res.json = (obj) => { settle(res.statusCode || 200, obj); return plain(obj); };
      res.on("close", () => { if (!res.headersSent) settle(500, {}); });
      next();
    } catch (e) { next(e); }
  };
}

/** Purge des clés de plus de trente jours — au tour horaire. */
export async function purgeIdempotencyKeys(days = IDEMPOTENCY_DAYS) {
  const r = await query(
    `DELETE FROM idempotency_key WHERE created_at < now() - ($1 || ' days')::interval`, [String(days)]);
  return r.rowCount ?? 0;
}

/** Pour le contrat OpenAPI : ce que chaque collection accepte. */
export const WRITE_BODIES = {
  /* REQ-19 — `dateBasis`/`condition` (ce sur quoi la date de fin repose,
     comme un jalon depuis REQ-14), `sponsor` et `acceptanceCriteria`
     (mesurés « acceptés et perdus »), et `status` avec les trois
     signatures de PM-08 : c'est par là que `project.closed_on`, colonne
     de la 032, cessait d'exister pour l'API. */
  projects: { adopt: "string", name: "string", programme: "string", site: "string", governanceLevel: "string", pm: "string",
    method: "string", start: "date", finish: "date", baselineFinish: "date", budget: "number",
    contingency: "number", desc: "string", dateBasis: "string", condition: "string",
    sponsor: "string", acceptanceCriteria: "string", status: "string",
    opsAcceptedBy: "string", benefitsTo: "string", closureNote: "string", version: "integer" },
  /* REQ-45 — `doneOn`/`doneBy` : le jour où la porte a été cochée et par
     qui, avec ou sans critères. Sans eux, un registre source qui charge
     son histoire de portes la datait toute entière du jour de l'import. */
  milestones: { adopt: "string", project: "string", name: "string", date: "date", dateBasis: "string", condition: "string",
    owner: "string", acceptanceCriteria: "string", done: "boolean", acceptedBy: "string",
    doneOn: "date", doneBy: "string", intrusive: "boolean", version: "integer" },
  /* REQ-13 `category` (leur mot à côté du nôtre) et REQ-18
     `closedOn`/`closedBy` (une clôture a une date et un nom). */
  raid: { adopt: "string", project: "string", type: "string", title: "string", detail: "string", p: "integer", i: "integer",
    tp: "integer", ti: "integer", response: "string", owner: "string", review: "date", status: "string",
    gate: "integer", cr: "string", category: "string", closedOn: "date", closedBy: "string", version: "integer" },
  criteria: { adopt: "string", project: "string", gate: "integer", text: "string", document: "string", note: "string",
    met: "boolean", reviewedBy: "string", version: "integer" },
  decisions: { adopt: "string", headline: "string", rationale: "string", alternatives: "string", dissent: "string",
    decidedBy: "string", council: "string", decidedOn: "date", project: "string", cr: "string", raid: "string",
    milestone: "string", supersedes: "string", evidenceUri: "string", provenance: "string",
    /* 041 a donné un `row_version` à la décision et le chemin d'état
       l'asserte (`sentVersion` puis `writeRow`, plus haut) : la
       déclaration le taisait, donc ni le contrat OpenAPI ni le garde de
       REQ-19 ne le savaient. Un synchroniseur qui relit /api/v1/decisions
       reçoit `version` dans chaque ligne ; la renvoyer est le geste
       normal, pas une faute. */
    /* REQ-47 — le jour de la ratification, que la 039 n'avait pas. */
    status: "string", ratifiedBy: "string", ratifiedOn: "date", version: "integer" },
  actions: { adopt: "string", title: "string", detail: "string", owner: "string", project: "string", dueDate: "date",
    status: "string", occurrence: "string", series: "string", version: "integer" },
  activities: { activity: "string", pct: "integer", source: "string", measuredAt: "date-time", name: "string", version: "integer" },
  workitems: { project: "string", title: "string", column: "string", assignee: "string", points: "integer",
    priority: "string", version: "integer" },
  /* REQ-20 (V-1) — la valeur, aux mêmes règles que la livraison. */
  benefits: { adopt: "string", project: "string", kind: "string", title: "string", detail: "string",
    measure: "string", unit: "string", baseline: "number", target: "number", actual: "number",
    owner: "string", realiseOn: "date", measuredOn: "date", status: "string", version: "integer" },
  "business-case": { adopt: "string", project: "string", summary: "string", basis: "string",
    expectedCost: "number", expectedBenefit: "number", version: "integer" },
};

/* ── REQ-19 · un corps que la collection ne comprend pas est REFUSÉ ───
 *
 * Mesuré par le terrain contre ce produit, et re-mesuré ici sur 5.12.0 :
 * `sponsor` et `acceptanceCriteria` sur un projet, `status: "Closed"` sur
 * un projet, `category` sur une ligne de registre — quatre 200, `version`
 * inchangée, aucune ligne écrite. Un contrat qui ne dit jamais non
 * enseigne le mauvais corps EN SILENCE : l'appelant croit avoir écrit, et
 * ne l'apprend qu'en relisant — s'il relit.
 *
 * Ce qui est reconnu se lit dans WRITE_BODIES ci-dessus, et nulle part
 * ailleurs. C'est la même déclaration que publie /api/v1/openapi.json :
 * le refus peut donc NOMMER ce qui est accepté sans recopier une liste
 * qui se périmerait, et un champ ajouté demain est accepté sans qu'on y
 * pense. `adopt` et `version` en font partie sur les collections qui les
 * déclarent — ce sont des champs du contrat, pas des intrus ; la clé
 * d'idempotence, elle, est un en-tête et n'a jamais eu sa place dans le
 * corps.
 *
 * Posé AVANT `idempotent()` et avant la moindre lecture métier : rien
 * n'est réservé, rien n'est audité, rien n'est versionné pour un acte qui
 * n'a pas eu lieu. C'est la troisième moitié de la demande, et c'est
 * celle qui compte — une piste d'audit qui consigne des actes non
 * accomplis ne se relit plus.
 */
const CONTRACT_DOC = "/api/v1/openapi.json";
const quoted = (keys) => keys.map((k) => `"${k}"`).join(", ");

export function assertKnownBody(collection, body) {
  const shape = WRITE_BODIES[collection];
  /* Une collection sans déclaration n'est pas une collection d'écriture :
     la route n'existe pas, et ce garde n'a rien à dire. Le test
     « chaque PUT monté a sa déclaration » tient l'autre bout. */
  if (!shape) return;
  const accepted = Object.keys(shape);
  const writable = accepted.filter((k) => k !== "version");
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    bad(`A ${collection} write is a JSON object naming the fields to write — ` +
        `${collection} accepts: ${accepted.join(", ")}. See ${CONTRACT_DOC}`);
  }
  const sent = Object.keys(body);
  const unknown = sent.filter((k) => !Object.hasOwn(shape, k));
  if (unknown.length) {
    bad(`${collection} does not accept ${quoted(unknown)} — nothing was written. ` +
        `${collection} accepts: ${accepted.join(", ")}. See ${CONTRACT_DOC}`);
  }
  /* `version` asserte ce qu'on écrase ; elle n'est pas elle-même un
     changement. Un corps qui ne porte qu'elle — ou rien du tout — ne
     demande aucune écriture, et répondre 200 « fait » serait le même
     mensonge sous une autre forme. */
  if (!sent.some((k) => k !== "version")) {
    bad(`A ${collection} write names nothing to write — send at least one of: ` +
        `${writable.join(", ")}. See ${CONTRACT_DOC}`);
  }
}

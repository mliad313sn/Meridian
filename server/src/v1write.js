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
import { one, many, query, allocateId, updateVersioned } from "./db.js";
import { audited } from "./audit.js";
import { HttpError } from "./auth.js";
import { fromM, loadSettings } from "./portfolio.js";
import { scaffoldProject, reschedule, phaseFor } from "./wbs.js";
import { iso, D } from "../../shared/engine.js";
import { assertPlantWindow } from "./plant.js";

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

const HAS_EXTERNAL_ID = new Set(["project", "milestone", "raid_item", "meeting_decision", "meeting_action", "activity", "work_item", "gate_criterion"]);
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
async function writeRow(t, table, id, version, patch, what) {
  if (version !== undefined) {
    const rv = await updateVersioned(t, table, id, version, patch);
    if (!rv.ok) throw new HttpError(409, `The version you sent is stale — read the ${what} again`);
    return rv;
  }
  const keys = Object.keys(patch);
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
async function adoptRow(user, table, externalId, meridianId, entity, what) {
  const row = await one(`SELECT * FROM ${table} WHERE id = $1`, [String(meridianId)]);
  if (!row) bad(`adopt: no such ${what} ${meridianId}`);
  if (row.external_id && (row.external_source !== user.id || row.external_id !== externalId)) {
    throw new HttpError(409, `${what} ${row.id} is already bound to another external id`);
  }
  if (row.origin === "sdp") throw new HttpError(403, `This ${what} is synchronised from the SDP roadmap — it is edited there`);
  if (!row.external_id) {
    await audited(user,
      { action: entity === "activity" ? "Stage linked" : "Row adopted", entity, entityId: row.id,
        detail: `${row.name ?? row.title ?? row.headline ?? row.id} ↔ ${user.displayName} (${externalId})` },
      async (t) => t.query(
        `UPDATE ${table} SET external_source = $2, external_id = $3, row_version = row_version + 1 WHERE id = $1`,
        [row.id, user.id, externalId]));
  }
  return one(`SELECT * FROM ${table} WHERE id = $1`, [row.id]);
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
  if (!existing && b.adopt) existing = await adoptRow(user, "project", externalId, b.adopt, "project", "project");
  const name = text(b.name, 300, "name", !existing);
  const pm = b.pm !== undefined ? await resolvePerson(b.pm, "pm") : undefined;
  const method = b.method === undefined ? undefined
    : ["Waterfall", "Agile", "Hybrid"].includes(b.method) ? b.method : bad("method is Waterfall, Agile or Hybrid");
  const start = isoDate(b.start, "start");
  const finish = isoDate(b.finish, "finish");
  const budget = money(b.budget, "budget");
  const contingency = money(b.contingency, "contingency");
  const desc = text(b.desc, 4000, "desc");

  if (!existing) {
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
              description, phase, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Initiation',$14,$15)`,
          [id, name, prog.id, site.id, level, pm ?? null, method ?? "Hybrid",
           start, finish, isoDate(b.baselineFinish, "baselineFinish") ?? finish,
           budget ?? 0, contingency ?? 0, desc ?? "", source, externalId]);
        await scaffoldProject(t, { id, name, programme: prog.id, site: site.id,
          pm: pm ?? null, method: method ?? "Hybrid", start, finish });
      });
    return stamp(true, id, externalId, 1);
  }

  if (existing.origin === "sdp") throw new HttpError(403, "This project is synchronised from the SDP roadmap — it is edited there");
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (pm !== undefined) patch.pm_id = pm;
  if (method !== undefined) patch.method = method;
  if (start) patch.start_date = start;
  if (finish) patch.finish_date = finish;
  if (desc !== undefined) patch.description = desc;
  if (budget !== undefined) patch.budget = budget;
  if (contingency !== undefined) patch.contingency = contingency;
  const s0 = patch.start_date ?? existing.start_date, f0 = patch.finish_date ?? existing.finish_date;
  if (D(f0) < D(s0)) bad("A project cannot finish before it starts");
  const shifted = (patch.start_date && patch.start_date !== existing.start_date) ||
                  (patch.finish_date && patch.finish_date !== existing.finish_date);
  const statusToday = shifted ? ((await loadSettings()).statusDate ?? iso(new Date())) : null;
  const version = sentVersion(b);
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);

  const out = await audited(user,
    { action: "Project updated", entity: "project", entityId: existing.id,
      detail: `${patch.name ?? existing.name} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await writeRow(t, "project", existing.id, version, patch, "project");
      if (shifted) {
        /* Même geste que PATCH /projects/:id : déplacer la fenêtre
           ré-étire le plan, jamais la référence (A1). */
        const fresh = (await t.query(`SELECT id, method, start_date, finish_date FROM project WHERE id = $1`, [existing.id])).rows[0];
        const acts = (await t.query(`SELECT id, stage FROM activity WHERE project_id = $1`, [existing.id])).rows;
        for (const m of reschedule({ id: fresh.id, method: fresh.method, start: fresh.start_date, finish: fresh.finish_date }, acts)) {
          await t.query(`UPDATE activity SET start_date = $2, end_date = $3, row_version = row_version + 1 WHERE id = $1`,
            [m.id, m.start, m.end]);
        }
        await t.query(`UPDATE project SET phase = $2 WHERE id = $1`,
          [existing.id, phaseFor({ start: fresh.start_date, finish: fresh.finish_date }, statusToday)]);
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
  if (!existing && b.adopt) existing = await adoptRow(user, "milestone", externalId, b.adopt, "milestone", "milestone");
  const p = existing ? await resolveProject(source, existing.project_id) : await resolveProject(source, b.project);
  if (!p) bad("A milestone needs a project — a Meridian id, or an external id you created");
  const name = text(b.name, 300, "name", !existing);
  const date = isoDate(b.date, "date");
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const criteria = text(b.acceptanceCriteria, 4000, "acceptanceCriteria");
  const acceptedBy = b.acceptedBy !== undefined ? await resolvePerson(b.acceptedBy, "acceptedBy") : undefined;

  /* V-03 — la même question de gel de site que l'écran, AVANT la
     transaction : une bascule datée dans un arrêt d'usine est refusée
     quel que soit le chemin par lequel elle arrive. */
  const plant = await one(`SELECT site_id, plant_impact, moc_approved_on FROM project WHERE id = $1`, [p.id]);
  const wantsIntrusive = b.intrusive === undefined ? !!existing?.intrusive : !!b.intrusive;
  if (wantsIntrusive && (date || b.intrusive !== undefined)) {
    await assertPlantWindow(plant, { date: date ?? existing?.due_date, intrusive: true });
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
                                  acceptance_criteria, external_source, external_id, done, accepted_by, accepted_on)
           VALUES ($1,$2,$3,$4,$4,NULL,'milestone',$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, p.id, name, date, owner ?? p.pm_id ?? null, !!b.intrusive, criteria ?? "", source, externalId,
           done, done && String(criteria ?? "").trim() ? acceptedBy : null,
           done && String(criteria ?? "").trim() ? iso(new Date()) : null]);
      });
    return stamp(true, id, externalId, 1);
  }

  if (existing.origin === "sdp") throw new HttpError(403, "This milestone is synchronised from the SDP roadmap — it is edited there");
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (date) patch.due_date = date;
  if (owner !== undefined) patch.owner_id = owner;
  if (criteria !== undefined) patch.acceptance_criteria = criteria;
  if (b.intrusive !== undefined) patch.intrusive = !!b.intrusive;
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
    if (!patch.done) { patch.accepted_by = null; patch.accepted_on = null; }
  }
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
  if (!existing && b.adopt) existing = await adoptRow(user, "raid_item", externalId, b.adopt, "raid_item", "register item");
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
              opened_on, review_on, target_probability, target_impact, gate, cr_id, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11,$12,$13,$14,$15,$16,$17)`,
          [id, p?.id ?? null, k, title, detail ?? "", clampScale(b.p, 3), clampScale(b.i, 3),
           status ?? "Open", response ?? "Monitor", owner ?? null, review ?? null,
           clampScale(b.tp), clampScale(b.ti), gateN ?? null, cr ?? null, source, externalId]);
      });
    return stamp(true, id, externalId, 1);
  }

  const patch = {};
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
  if (status !== undefined) patch.status = status;
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
  if (!/^https?:\/\//i.test(u)) bad("evidenceUri is an http(s) link to the record of the decision");
  return u.slice(0, 1000);
};

export async function upsertDecision(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM meeting_decision WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  if (!existing && b.adopt) existing = await adoptRow(user, "meeting_decision", externalId, b.adopt, "meeting_decision", "decision");
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
      ["rationale", b.rationale === undefined ? undefined : String(b.rationale).slice(0, 4000), existing.rationale],
      ["alternatives", b.alternatives === undefined ? undefined : String(b.alternatives).slice(0, 4000), existing.alternatives],
      ["dissent", b.dissent === undefined ? undefined : String(b.dissent).slice(0, 2000), existing.dissent],
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
    if (b.ratifiedBy !== undefined) patch.ratified_by = String(b.ratifiedBy ?? "").slice(0, 200);
    const uri = evidenceUri(b.evidenceUri);
    if (uri !== undefined) patch.evidence_uri = uri;
    if (b.provenance !== undefined) patch.provenance = String(b.provenance ?? "").slice(0, 200);
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== existing[k]));
    if (!Object.keys(changed).length) return stamp(false, existing.id, externalId, 1);
    await audited(user,
      { action: changed.status === "Ratified" ? "Decision ratified" : "Decision state updated",
        entity: "meeting_decision", entityId: existing.id,
        detail: `${existing.headline.slice(0, 120)} — from ${user.displayName} (${externalId})`,
        before: Object.fromEntries(Object.keys(changed).map((k) => [k, existing[k]])), after: changed },
      async (t) => {
        const keys = Object.keys(changed);
        await t.query(
          `UPDATE meeting_decision SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
          [existing.id, ...keys.map((k) => changed[k])]);
      });
    return stamp(false, existing.id, externalId, 1);
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
            council, evidence_uri, provenance, status, ratified_by)
         VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [id, headline, text(b.rationale, 4000, "rationale") ?? "", text(b.alternatives, 4000, "alternatives") ?? "",
         text(b.dissent, 2000, "dissent") ?? "", p?.id ?? null, crId, raidId, msId, supersedes,
         decidedBy, on, user.id, source, externalId,
         council, evidenceUri(b.evidenceUri) ?? "", String(b.provenance ?? "").slice(0, 200),
         DECISION_STATUS.includes(b.status) ? b.status : "Ratified", String(b.ratifiedBy ?? "").slice(0, 200)]);
    });
  return stamp(true, id, externalId, 1);
}

/* ── critères de jalon (REQ-04 sur le contrat) ─────────────────────── */

export async function upsertCriterion(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM gate_criterion WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  if (!existing && b.adopt) existing = await adoptRow(user, "gate_criterion", externalId, b.adopt, "gate_criterion", "criterion");
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
  }
  const patch = {};
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
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = sentVersion(b);
  const out = await audited(user,
    { action: patch.met === true && !existing.met ? "Gate criterion met" : patch.met === false && existing.met ? "Gate criterion reopened" : "Gate criterion updated",
      entity: "gate_criterion", entityId: existing.id,
      detail: `gate ${existing.gate} · ${patch.text ?? existing.text} — from ${user.displayName} (${externalId})` },
    async (t) => {
      return writeRow(t, "gate_criterion", existing.id, version, patch, "gate criterion");
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── actions ───────────────────────────────────────────────────────── */

const ACTION_STATUS = ["Open", "In progress", "Done", "Cancelled"];

export async function upsertAction(user, externalId, b) {
  const source = user.id;
  let existing = await one(
    `SELECT * FROM meeting_action WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  if (!existing && b.adopt) existing = await adoptRow(user, "meeting_action", externalId, b.adopt, "meeting_action", "action");
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

  const patch = {};
  if (title !== undefined) patch.title = title;
  if (detail !== undefined) patch.detail = detail;
  if (owner !== undefined) patch.owner_id = owner;
  if (due !== undefined) patch.due_date = due;
  if (p !== undefined) patch.project_id = p?.id ?? null;
  if (status !== undefined) {
    patch.status = status;
    if (status === "Done" || status === "Cancelled") patch.closed_at = new Date().toISOString();
  }
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
  const patch = {};
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
  const patch = {};
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
  projects: { adopt: "string", name: "string", programme: "string", site: "string", governanceLevel: "string", pm: "string",
    method: "string", start: "date", finish: "date", baselineFinish: "date", budget: "number",
    contingency: "number", desc: "string", version: "integer" },
  milestones: { adopt: "string", project: "string", name: "string", date: "date", owner: "string", acceptanceCriteria: "string",
    done: "boolean", acceptedBy: "string", intrusive: "boolean", version: "integer" },
  raid: { adopt: "string", project: "string", type: "string", title: "string", detail: "string", p: "integer", i: "integer",
    tp: "integer", ti: "integer", response: "string", owner: "string", review: "date", status: "string",
    gate: "integer", cr: "string", version: "integer" },
  criteria: { adopt: "string", project: "string", gate: "integer", text: "string", document: "string", note: "string",
    met: "boolean", reviewedBy: "string", version: "integer" },
  decisions: { adopt: "string", headline: "string", rationale: "string", alternatives: "string", dissent: "string",
    decidedBy: "string", council: "string", decidedOn: "date", project: "string", cr: "string", raid: "string",
    milestone: "string", supersedes: "string", evidenceUri: "string", provenance: "string",
    status: "string", ratifiedBy: "string" },
  actions: { adopt: "string", title: "string", detail: "string", owner: "string", project: "string", dueDate: "date",
    status: "string", occurrence: "string", series: "string", version: "integer" },
  activities: { activity: "string", pct: "integer", source: "string", measuredAt: "date-time", name: "string", version: "integer" },
  workitems: { project: "string", title: "string", column: "string", assignee: "string", points: "integer",
    priority: "string", version: "integer" },
};

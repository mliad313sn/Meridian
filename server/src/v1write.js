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

const bad = (msg) => { throw new HttpError(400, msg); };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
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

async function resolveRef(table, source, ref, projectId, what) {
  if (!ref) return null;
  const row = await one(
    `SELECT id, project_id FROM ${table} WHERE id = $1 OR (external_source = $2 AND external_id = $1)`,
    [String(ref), source]);
  if (!row || (projectId && row.project_id && row.project_id !== projectId)) {
    bad(`${what}: "${ref}" does not exist on this project`);
  }
  return row.id;
}

const stamp = (created, id, externalId, version) => ({ id, externalId, created, version });

/* ── projets ───────────────────────────────────────────────────────── */

export async function upsertProject(user, externalId, b) {
  const source = user.id;
  const existing = await one(
    `SELECT * FROM project WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
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
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);

  const out = await audited(user,
    { action: "Project updated", entity: "project", entityId: existing.id,
      detail: `${patch.name ?? existing.name} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await updateVersioned(t, "project", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — someone changed this project; read it again");
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
  const existing = await one(
    `SELECT * FROM milestone WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  const p = existing ? await resolveProject(source, existing.project_id) : await resolveProject(source, b.project);
  if (!p) bad("A milestone needs a project — a Meridian id, or an external id you created");
  const name = text(b.name, 300, "name", !existing);
  const date = isoDate(b.date, "date");
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const criteria = text(b.acceptanceCriteria, 4000, "acceptanceCriteria");
  const acceptedBy = b.acceptedBy !== undefined ? await resolvePerson(b.acceptedBy, "acceptedBy") : undefined;

  if (!existing) {
    if (!date) bad("A milestone needs a date");
    let id = null;
    await audited(user,
      () => ({ action: "Milestone added", entity: "milestone", entityId: id,
               detail: `${name} — from ${user.displayName} (${externalId})` }),
      async (t) => {
        const n = await allocateId(t, "MS");
        id = p.id + "-M" + n.split("-")[1];
        await t.query(
          `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id, intrusive,
                                  acceptance_criteria, external_source, external_id)
           VALUES ($1,$2,$3,$4,$4,NULL,'milestone',$5,$6,$7,$8,$9)`,
          [id, p.id, name, date, owner ?? p.pm_id ?? null, !!b.intrusive, criteria ?? "", source, externalId]);
      });
    /* Créer puis cocher dans le même PUT : le même chemin que l'écran,
       avec la même exigence d'accepteur. */
    if (b.done) return upsertMilestone(user, externalId, { done: true, acceptedBy: b.acceptedBy });
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
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  const out = await audited(user,
    { action: patch.done && !existing.done ? "Milestone accepted" : "Milestone updated",
      entity: "milestone", entityId: existing.id,
      detail: `${patch.name ?? existing.name} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await updateVersioned(t, "milestone", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — read the milestone again");
      return rv;
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── RAID ──────────────────────────────────────────────────────────── */

const KINDS = ["Risk", "Issue", "Assumption", "Dependency"];
const RESPONSES = ["Mitigate", "Avoid", "Transfer", "Accept", "Monitor", "Fix"];

export async function upsertRaid(user, externalId, b) {
  const source = user.id;
  const existing = await one(
    `SELECT * FROM raid_item WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  const p = existing ? (existing.project_id ? await resolveProject(source, existing.project_id) : null)
                     : await resolveProject(source, b.project);
  const title = text(b.title, 300, "title", !existing);
  const detail = text(b.detail, 4000, "detail");
  const kind = b.type === undefined ? undefined : KINDS.includes(b.type) ? b.type : bad("type is Risk, Issue, Assumption or Dependency");
  const response = b.response === undefined ? undefined : RESPONSES.includes(b.response) ? b.response : bad("response is " + RESPONSES.join(", "));
  const owner = b.owner !== undefined ? await resolvePerson(b.owner, "owner") : undefined;
  const review = b.review === undefined ? undefined : isoDate(b.review, "review");
  const gateN = b.gate === undefined ? undefined : (b.gate === null || b.gate === "" ? null : Math.max(1, Math.min(12, Math.round(Number(b.gate)) || 0)) || null);
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
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  const out = await audited(user,
    { action: status === "Closed" && existing.status !== "Closed" ? "Item closed" : "Item updated",
      entity: "raid_item", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await updateVersioned(t, "raid_item", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — read the item again");
      return rv;
    });
  return stamp(false, existing.id, externalId, out.version);
}

/* ── décisions ─────────────────────────────────────────────────────── */

export async function upsertDecision(user, externalId, b) {
  const source = user.id;
  const existing = await one(
    `SELECT * FROM meeting_decision WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
  const headline = text(b.headline, 300, "headline", !existing);
  if (existing) {
    /* Immuable : un re-PUT identique est un no-op ; un re-PUT différent
       est refusé — une décision qui change en est une nouvelle. */
    const same = (headline === undefined || headline === existing.headline) &&
      (b.rationale === undefined || String(b.rationale).slice(0, 4000) === existing.rationale);
    if (!same) {
      throw new HttpError(409,
        `Decision ${existing.id} is on the record and cannot change — record a new one that supersedes it`);
    }
    return stamp(false, existing.id, externalId, 1);
  }
  const decidedBy = await resolvePerson(b.decidedBy, "decidedBy");
  if (!decidedBy) bad("A decision names who decided (decidedBy: an active person's id or exact name)");
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
            milestone_id, supersedes, decided_by, decided_on, recorded_by, external_source, external_id)
         VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, headline, text(b.rationale, 4000, "rationale") ?? "", text(b.alternatives, 4000, "alternatives") ?? "",
         text(b.dissent, 2000, "dissent") ?? "", p?.id ?? null, crId, raidId, msId, supersedes,
         decidedBy, on, user.id, source, externalId]);
    });
  return stamp(true, id, externalId, 1);
}

/* ── actions ───────────────────────────────────────────────────────── */

const ACTION_STATUS = ["Open", "In progress", "Done", "Cancelled"];

export async function upsertAction(user, externalId, b) {
  const source = user.id;
  const existing = await one(
    `SELECT * FROM meeting_action WHERE external_source = $1 AND external_id = $2`, [source, externalId]);
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
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  const out = await audited(user,
    { action: status ? "Action " + status.toLowerCase() : "Action updated",
      entity: "meeting_action", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await updateVersioned(t, "meeting_action", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — read the action again");
      return rv;
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
    patch.progress_at = b.measuredAt ? new Date(b.measuredAt).toISOString() : new Date().toISOString();
    if (Number.isNaN(Date.parse(patch.progress_at))) bad("measuredAt must be a date-time");
  }
  if (b.name !== undefined) patch.name = text(b.name, 300, "name");
  if (!Object.keys(patch).length) return stamp(false, existing.id, externalId, existing.row_version);
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  const out = await audited(user,
    { action: patch.pct !== undefined ? "Progress reported" : "Stage updated", entity: "activity", entityId: existing.id,
      detail: (patch.pct !== undefined ? `${existing.name} → ${patch.pct}% ` : existing.name) + `— from ${user.displayName} (${externalId})`,
      before: patch.pct !== undefined ? { pct: existing.pct } : undefined,
      after: patch.pct !== undefined ? { pct: patch.pct, source: patch.progress_source } : undefined },
    async (t) => {
      const rv = await updateVersioned(t, "activity", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — read the stage again");
      return rv;
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
  const version = b.version === undefined ? existing.row_version : Number(b.version);
  const out = await audited(user,
    { action: column !== undefined && column !== existing.column_id ? "Work item moved" : "Work item updated",
      entity: "work_item", entityId: existing.id,
      detail: `${patch.title ?? existing.title} — from ${user.displayName} (${externalId})` },
    async (t) => {
      const rv = await updateVersioned(t, "work_item", existing.id, version, patch);
      if (!rv.ok) throw new HttpError(409, "The version you sent is stale — read the work item again");
      return rv;
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
      const hash = sha(req.method + " " + req.originalUrl + "\n" + JSON.stringify(req.body ?? {}));
      const seen = await one(
        `SELECT request_hash, status, response_json FROM idempotency_key
          WHERE integration_id = $1 AND key = $2`, [req.user.id, key]);
      if (seen) {
        if (seen.request_hash !== hash) {
          return res.status(422).json({
            error: "Idempotency-Key reused with a different request — a key names ONE request; use a new key",
          });
        }
        res.setHeader("Idempotent-Replayed", "true");
        const body = typeof seen.response_json === "string" ? JSON.parse(seen.response_json) : seen.response_json;
        return res.status(seen.status).json(body);
      }
      const plain = res.json.bind(res);
      res.json = (obj) => {
        const status = res.statusCode || 200;
        /* Seules les réponses de succès se rejouent : un 4xx est une
           réponse à corriger, pas un acte à ne pas répéter. */
        if (status < 300) {
          query(`INSERT INTO idempotency_key (integration_id, key, request_hash, status, response_json)
                 VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [req.user.id, key, hash, status, JSON.stringify(obj)]).catch(() => {});
        }
        return plain(obj);
      };
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
  projects: { name: "string", programme: "string", site: "string", governanceLevel: "string", pm: "string",
    method: "string", start: "date", finish: "date", baselineFinish: "date", budget: "number",
    contingency: "number", desc: "string", version: "integer" },
  milestones: { project: "string", name: "string", date: "date", owner: "string", acceptanceCriteria: "string",
    done: "boolean", acceptedBy: "string", intrusive: "boolean", version: "integer" },
  raid: { project: "string", type: "string", title: "string", detail: "string", p: "integer", i: "integer",
    tp: "integer", ti: "integer", response: "string", owner: "string", review: "date", status: "string",
    gate: "integer", cr: "string", version: "integer" },
  decisions: { headline: "string", rationale: "string", alternatives: "string", dissent: "string",
    decidedBy: "string", decidedOn: "date", project: "string", cr: "string", raid: "string",
    milestone: "string", supersedes: "string" },
  actions: { title: "string", detail: "string", owner: "string", project: "string", dueDate: "date",
    status: "string", occurrence: "string", series: "string", version: "integer" },
  activities: { activity: "string", pct: "integer", source: "string", measuredAt: "date-time", name: "string", version: "integer" },
  workitems: { project: "string", title: "string", column: "string", assignee: "string", points: "integer",
    priority: "string", version: "integer" },
};

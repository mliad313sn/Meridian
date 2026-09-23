/**
 * D-36.14 — one typed external reference  (FitAdapt #17 · RT365 REQ-29 ·
 * KODO MER-11).
 *
 * `ext_link` (005) is where Meridian keeps the link to a record another
 * system holds. 057 gave it repository sources — an issue, a pull request,
 * a commit, a CI run, an artefact — each with a canonical ref and a cached
 * state. This module holds the rules both doors share: the screen routes
 * (routes/references.js) and the contract (PUT /api/v1/references).
 *
 *   · Meridian NEVER fetches a reference. This file makes no network
 *     call and must never make one (NOTICE). The state is what a named
 *     integration last REPORTED, with when; the screens say exactly that.
 *   · A ref is canonicalised here, once, so that two people citing the
 *     same pull request cite the same thing.
 *   · REQ-29 — a criterion's citation is frozen once the criterion is
 *     found met or its gate milestone is marked done. Changing it then is
 *     a NEW row that supersedes the old; the old row stays, stamped. A
 *     frozen or superseded citation is never edited and never deleted.
 */

import { one, many, allocateId, assertIdentifiers } from "./db.js";
import { audited } from "./audit.js";
import { HttpError } from "./auth.js";

export const REPO_KINDS = ["issue", "pull_request", "commit", "ci_run", "artefact"];
export const SDP_SOURCES = ["meetings", "inspection", "report", "change"];

/* Which reported states make sense for which kind. A commit and an
   artefact are immutable things named by their hash: they HAVE no state,
   and inventing one ("passed") would claim what a CI run claims. */
export const STATES_BY_KIND = {
  issue: ["open", "closed"],
  pull_request: ["open", "merged", "closed"],
  commit: [],
  ci_run: ["open", "passed", "failed"],
  artefact: [],
};

const bad = (msg) => { throw new HttpError(400, msg); };

const REPO = "[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+";
const PATTERNS = {
  issue: new RegExp(`^(${REPO})#(\\d+)$`),
  pull_request: new RegExp(`^(${REPO})#(\\d+)$`),
  commit: new RegExp(`^(?:(${REPO})@)?([0-9a-fA-F]{7,64})$`),
  ci_run: new RegExp(`^(${REPO})/runs/(\\d+)$`),
  artefact: /^(sha1|sha256|sha384|sha512):([0-9a-fA-F]+)$/i,
};
const DIGEST_LEN = { sha1: 40, sha256: 64, sha384: 96, sha512: 128 };
const SHAPE = {
  issue: "owner/repo#123",
  pull_request: "owner/repo#123",
  commit: "owner/repo@<commit sha, 7 to 64 hex digits> (or the bare sha)",
  ci_run: "owner/repo/runs/<run id>",
  artefact: "sha256:<64 hex digits> (or sha1, sha384, sha512)",
};

export function assertKind(kind) {
  if (!REPO_KINDS.includes(kind)) {
    bad(`kind must be one of ${REPO_KINDS.join(", ")} — "${String(kind ?? "")}" is not a repository reference Meridian knows`);
  }
  return kind;
}

/** The one spelling of a ref. Hex is lower-cased; the repository path is
    kept as written (hosts differ on case) but trimmed. */
export function canonicalRef(kind, ref) {
  assertKind(kind);
  const s = String(ref ?? "").trim();
  if (!s) bad(`ref is required — for ${kind.replace("_", " ")} it reads ${SHAPE[kind]}`);
  if (s.length > 200) bad("ref is at most 200 characters");
  const m = PATTERNS[kind].exec(s);
  if (!m) bad(`"${s}" is not a ${kind.replace("_", " ")} ref — it reads ${SHAPE[kind]}`);
  if (kind === "commit") return (m[1] ? m[1] + "@" : "") + m[2].toLowerCase();
  if (kind === "artefact") {
    const algo = m[1].toLowerCase(), hex = m[2].toLowerCase();
    if (hex.length !== DIGEST_LEN[algo]) bad(`A ${algo} digest is ${DIGEST_LEN[algo]} hex digits — this one has ${hex.length}`);
    return `${algo}:${hex}`;
  }
  return s;
}

/** A link is stored for a person to follow. It is never requested by the
    server, so it only has to be a web address a browser can open. */
export function cleanUrl(v) {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length > 500) bad("url is at most 500 characters");
  if (!/^https?:\/\/[^\s]+$/i.test(s)) bad("url is a web address (https://…) — Meridian stores it for people to follow and never fetches it");
  return s;
}

export function assertState(kind, state) {
  const allowed = STATES_BY_KIND[kind] ?? [];
  if (!allowed.includes(state)) {
    bad(allowed.length
      ? `A ${kind.replace("_", " ")} is reported ${allowed.join(", ")} — not "${state}"`
      : `A ${kind.replace("_", " ")} has no state to report: it is named by its hash and never changes`);
  }
  return state;
}

/** The attachment below the project: a stage, a RAID row or a criterion,
    each of which must belong to the project. At most one. */
export async function resolveTarget(projectId, { activity, raid, criterion }, lookup = (_table, ref) => ref) {
  const sent = [["activity", activity], ["raid", raid], ["criterion", criterion]]
    .filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (sent.length > 1) bad("A reference is attached to one thing below the project — a stage, a RAID row or a criterion, not several");
  const out = { activity_id: null, raid_id: null, criterion_id: null };
  if (!sent.length) return out;
  const [what, ref] = sent[0];
  const table = { activity: "activity", raid: "raid_item", criterion: "gate_criterion" }[what];
  const id = await lookup(table, String(ref));
  const row = id ? await one(`SELECT id, project_id FROM ${table} WHERE id = $1`, [id]) : null;
  if (!row || row.project_id !== projectId) bad(`${what}: "${ref}" does not exist on this project`);
  out[{ activity: "activity_id", raid: "raid_id", criterion: "criterion_id" }[what]] = row.id;
  return out;
}

/**
 * REQ-29 — is this link a citation the gate record now relies on?
 * A criterion found met relied on it; a gate marked done passed on it.
 * Either way, what it cites is a record from then on.
 */
export async function citationFrozen(link, q = { one }) {
  if (!link?.criterion_id) return false;
  const c = await q.one(
    `SELECT c.met,
            EXISTS (SELECT 1 FROM milestone m
                     WHERE m.project_id = c.project_id AND m.gate = c.gate AND m.done) AS passed
       FROM gate_criterion c WHERE c.id = $1`, [link.criterion_id]);
  return !!(c && (c.met || c.passed));
}

/**
 * Write the new version of a frozen citation. The old row is stamped
 * `superseded_at` FIRST, so the live-key and the contract identity are
 * free for the new one; the new row names the old in `supersedes`, keeps
 * its target, and starts with no reported state — the state of the old
 * ref says nothing about the new one.
 */
export async function supersede(t, old, next, { linkedBy = null, externalSource = null, externalId = null } = {}) {
  await t.query(
    `UPDATE ext_link SET superseded_at = now(), row_version = row_version + 1 WHERE id = $1`, [old.id]);
  const id = await allocateId(t, "XL");
  await t.query(
    `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, raid_id, criterion_id, site_id,
                           title_cache, url, linked_by, supersedes, external_source, external_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, old.source, next.ref, old.project_id, old.activity_id, old.raid_id, old.criterion_id, old.site_id,
     next.title ?? old.title_cache, next.url ?? old.url, linkedBy, old.id, externalSource, externalId]);
  return id;
}

/* ── the contract: PUT /api/v1/references/:externalId ─────────────── */

/**
 * The state a repository reports is a property of the THING — the pull
 * request — not of one card. So a report reaches every live link citing
 * that (kind, ref), whoever made the link: a stage linked on a screen
 * shows the state the repository's automation pushed, without anyone
 * first telling that automation Meridian's ids.
 *
 * Planned before anything is written, so that a report which changes
 * nothing writes nothing — no audit row, no version moved (the rule
 * v1write.js's `changedOnly` holds for every collection):
 *   · a report dated before the one a link holds is ignored (webhooks
 *     arrive out of order);
 *   · the same state from the same integration, with no date or the same
 *     date, is the same report.
 */
export async function planReport(user, kind, ref, { state, at, atSent, title }) {
  const rows = await many(
    `SELECT * FROM ext_link WHERE source = $1 AND ext_id = $2 AND superseded_at IS NULL ORDER BY id`,
    [kind, ref]);
  const plan = [];
  for (const l of rows) {
    const patch = {};
    if (state !== undefined) {
      const heldAt = l.state_at ? new Date(l.state_at).getTime() : null;
      const older = atSent && heldAt !== null && at.getTime() < heldAt;
      const same = l.state === state && l.state_source === user.id && (!atSent || heldAt === at.getTime());
      if (!older && !same) {
        patch.state = state; patch.state_at = at.toISOString(); patch.state_source = user.id;
      }
    }
    if (title !== undefined && title !== l.title_cache) patch.title_cache = title;
    if (Object.keys(patch).length) plan.push({ id: l.id, patch });
  }
  return { matched: rows.map((r) => r.id), plan };
}

async function setColumns(t, id, patch) {
  const keys = Object.keys(patch);
  assertIdentifiers(keys);
  await t.query(
    `UPDATE ext_link SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, row_version = row_version + 1 WHERE id = $1`,
    [id, ...keys.map((k) => patch[k])]);
}

export async function applyPlan(t, plan) {
  for (const { id, patch } of plan) await setColumns(t, id, patch);
}

const reportedAt = (v) => {
  if (v === undefined || v === null || v === "") return { at: new Date(), atSent: false };
  const ms = Date.parse(String(v));
  if (Number.isNaN(ms)) bad("stateAt must be a date-time (ISO-8601)");
  return { at: new Date(ms), atSent: true };
};

const answer = async (id, externalId, created, links, extra = {}) => {
  const row = await one(`SELECT row_version FROM ext_link WHERE id = $1`, [id]);
  return { id, externalId, created, version: row.row_version, links, ...extra };
};

export const targetLabel = (x) =>
  x.criterion_id ? " · " + x.criterion_id : x.raid_id ? " · " + x.raid_id : x.activity_id ? " · " + x.activity_id : "";

/** Report, and audit the report only when it changed something. */
async function report(user, kind, ref, opts, entityId, who) {
  const { matched, plan } = await planReport(user, kind, ref, opts);
  if (plan.length) {
    await audited(user,
      { action: "Reference state reported", entity: "ext_link", entityId: entityId ?? plan[0].id,
        detail: `${kind} ${ref}${opts.state ? " → " + opts.state : ""} on ${plan.length} link(s) ${who}` },
      async (t) => applyPlan(t, plan));
  }
  return matched;
}

/**
 * `resolveProject` and `lookup` come from v1write.js (they speak the
 * integration's own ids), passed in so this module does not import the
 * contract module that declares its body.
 */
export async function upsertReference(user, externalId, b, { resolveProject, lookup }) {
  const source = user.id;
  const who = `— from ${user.displayName} (${externalId})`;
  let existing = await one(
    `SELECT * FROM ext_link WHERE external_source = $1 AND external_id = $2 AND superseded_at IS NULL`,
    [source, externalId]);
  if (!existing && b.adopt) {
    const row = await one(`SELECT * FROM ext_link WHERE id = $1`, [String(b.adopt)]);
    if (!row || !REPO_KINDS.includes(row.source)) bad(`adopt: no repository reference ${b.adopt}`);
    if (row.superseded_at) throw new HttpError(409, `${row.id} has been superseded — adopt the live version`);
    if (row.external_id) throw new HttpError(409, `${row.id} is already bound to another external id`);
    await audited(user,
      { action: "Reference adopted", entity: "ext_link", entityId: row.id,
        detail: `${row.source} ${row.ext_id} ↔ ${user.displayName} (${externalId})` },
      async (t) => setColumns(t, row.id, { external_source: source, external_id: externalId }));
    existing = await one(`SELECT * FROM ext_link WHERE id = $1`, [row.id]);
  }

  if (b.kind !== undefined) assertKind(b.kind);
  if (b.kind !== undefined && existing && b.kind !== existing.source) {
    bad(`Reference ${externalId} is a ${existing.source.replace("_", " ")} — a kind does not change; send another externalId`);
  }
  const kind = existing?.source ?? b.kind;
  const ref = b.ref !== undefined ? canonicalRef(kind ?? assertKind(b.kind), b.ref) : undefined;
  const url = cleanUrl(b.url);
  const title = b.title === undefined ? undefined : String(b.title ?? "").trim().slice(0, 300);
  const state = b.state === undefined ? undefined : assertState(kind ?? assertKind(b.kind), String(b.state));
  const { at, atSent } = reportedAt(b.stateAt);
  const hasProject = b.project !== undefined && b.project !== null && b.project !== "";

  /* ── no row of ours, no project: a state report ────────────────── */
  if (!existing && !hasProject) {
    if (!kind || ref === undefined) bad("Send kind and ref — what the state is about — or project to create a reference");
    if (state === undefined && title === undefined) bad("A report without a project carries state (or title) — nothing else is written that way");
    if (url !== undefined || b.activity || b.raid || b.criterion) {
      bad("activity, raid, criterion and url belong to creating a reference — send project with them");
    }
    const matched = await report(user, kind, ref, { state, at, atSent, title }, null, who);
    if (!matched.length) {
      throw new HttpError(404, `No link in Meridian cites ${kind} ${ref} — link it on a screen, or send project to create one`);
    }
    return answer(matched[0], externalId, false, matched);
  }

  /* ── no row of ours, a project: create ─────────────────────────── */
  if (!existing) {
    const p = await resolveProject(source, b.project);
    if (!kind) bad("kind is required to create a reference");
    if (ref === undefined) bad(`ref is required — it reads ${SHAPE[kind]}`);
    const target = await resolveTarget(p.id, b, lookup);
    const twin = await one(
      `SELECT id FROM ext_link WHERE source = $1 AND ext_id = $2 AND project_id = $3 AND superseded_at IS NULL
          AND activity_id IS NOT DISTINCT FROM $4 AND raid_id IS NOT DISTINCT FROM $5
          AND criterion_id IS NOT DISTINCT FROM $6`,
      [kind, ref, p.id, target.activity_id, target.raid_id, target.criterion_id]);
    if (twin) throw new HttpError(409, `${twin.id} already cites ${kind} ${ref} here — send adopt: "${twin.id}" to make it yours`);
    let id = null;
    await audited(user,
      () => ({ action: "Reference cited", entity: "ext_link", entityId: id,
               detail: `${kind} ${ref} → ${p.id}${targetLabel(target)} ${who}` }),
      async (t) => {
        id = await allocateId(t, "XL");
        await t.query(
          `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, raid_id, criterion_id, site_id,
                                 title_cache, url, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, kind, ref, p.id, target.activity_id, target.raid_id, target.criterion_id, p.site_id,
           title ?? "", url ?? "", source, externalId]);
      });
    /* The state is the thing's: it reaches every link citing it, this
       new one included. */
    const links = state !== undefined ? await report(user, kind, ref, { state, at, atSent }, id, who) : [id];
    return answer(id, externalId, true, links);
  }

  /* ── our row: correct it, or cite a new version ────────────────── */
  if (hasProject) {
    const p = await resolveProject(source, b.project);
    if (p.id !== existing.project_id) bad(`Reference ${externalId} is on ${existing.project_id}; a reference stays on its project — send another externalId`);
  }
  for (const [k, col] of [["activity", "activity_id"], ["raid", "raid_id"], ["criterion", "criterion_id"]]) {
    if (b[k] === undefined) continue;
    const tg = await resolveTarget(existing.project_id, { [k]: b[k] }, lookup);
    if (tg[col] !== existing[col]) bad(`Reference ${externalId} is attached where it was created; to cite from elsewhere, send another externalId`);
  }
  if (b.version !== undefined) {
    const v = Number(b.version);
    if (!Number.isInteger(v) || v < 1) bad("version is a positive whole number, or omitted");
    if (v !== existing.row_version) throw new HttpError(409, "The version you sent is stale — read the reference again");
  }
  const refChanges = ref !== undefined && ref !== existing.ext_id;
  const urlChanges = url !== undefined && url !== existing.url;

  /* REQ-29 — after the gate, a changed citation is a new version. */
  if ((refChanges || urlChanges) && await citationFrozen(existing)) {
    const nextRef = ref ?? existing.ext_id;
    let id = null;
    await audited(user,
      () => ({ action: "Citation superseded", entity: "ext_link", entityId: id,
               detail: `${existing.criterion_id}: ${existing.source} ${existing.ext_id} → ${nextRef} (${existing.id} kept) ${who}`,
               before: { id: existing.id, ref: existing.ext_id, url: existing.url },
               after: { id, ref: nextRef, url: url ?? existing.url } }),
      async (t) => {
        id = await supersede(t, existing, { ref: nextRef, url, title }, { externalSource: source, externalId });
      });
    const links = state !== undefined ? await report(user, existing.source, nextRef, { state, at, atSent }, id, who) : [id];
    return answer(id, externalId, true, links, { supersedes: existing.id });
  }

  const patch = {};
  if (refChanges) { patch.ext_id = ref; patch.state = ""; patch.state_at = null; patch.state_source = null; }
  if (urlChanges) patch.url = url;
  const currentRef = patch.ext_id ?? existing.ext_id;
  if (Object.keys(patch).length) {
    await audited(user,
      { action: "Reference corrected", entity: "ext_link", entityId: existing.id,
        detail: `${existing.source} ${existing.ext_id}${refChanges ? " → " + ref : ""}${urlChanges ? " · url" : ""} ${who}`,
        before: { ref: existing.ext_id, url: existing.url }, after: { ref: currentRef, url: patch.url ?? existing.url } },
      async (t) => setColumns(t, existing.id, patch));
  }
  const links = state !== undefined || title !== undefined
    ? await report(user, existing.source, currentRef, { state, at, atSent, title }, existing.id, who)
    : [existing.id];
  return answer(existing.id, externalId, false, links);
}

/** Everything live that cites a (kind, ref) — for tests and reads. */
export const citing = (kind, ref) =>
  many(`SELECT * FROM ext_link WHERE source = $1 AND ext_id = $2 AND superseded_at IS NULL ORDER BY id`, [kind, ref]);

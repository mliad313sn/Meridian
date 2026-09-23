/**
 * D-36.14 — typed external references, written from a session
 * (FitAdapt #17 · RT365 REQ-29 · KODO MER-11).
 *
 * A person links a project, a stage, a RAID row or a gate criterion to
 * where the work is: an issue, a pull request, a commit, a CI run, an
 * artefact. It is an ordinary project write (`project.write`, decided in
 * shared/rbac.js), audited, versioned.
 *
 * What a person does NOT do here is set the state. The state is what the
 * repository's own automation reports through PUT /api/v1/references
 * (NOTICE: Meridian makes no outbound call, so it cannot look for
 * itself). A person who could type "merged" would make the card say
 * something nobody reported.
 *
 * REQ-29 — once a criterion is found met or its gate is marked done, the
 * reference it cites is a record: a change of ref or url is a NEW row
 * that supersedes the old, and neither the frozen row nor a superseded
 * one is ever edited or removed.
 */

import { Router } from "express";
import { one, allocateId, updateVersioned, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor } from "../portfolio.js";
import {
  REPO_KINDS, assertKind, canonicalRef, cleanUrl, resolveTarget, citationFrozen, supersede, targetLabel,
} from "../references.js";

const r = Router();

const bad = (msg) => { throw new HttpError(400, msg); };
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
/* Out of scope answers exactly as absent does (B2): 404, never 403. */
async function project(id, user) {
  const p = id ? await projectFor(String(id)) : null;
  if (!p || !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
const title = (v) => (v === undefined ? undefined : String(v ?? "").trim().slice(0, 300));

async function reference(id, user) {
  const l = await one(`SELECT * FROM ext_link WHERE id = $1`, [String(id)]);
  if (!l || !REPO_KINDS.includes(l.source)) throw new HttpError(404, "No such reference");
  const p = await project(l.project_id, user);
  gate(user, "project.write", { project: p });
  return { l, p };
}

r.post("/references", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "project.write", { project: p });
    const kind = assertKind(b.kind);
    const ref = canonicalRef(kind, b.ref);
    const url = cleanUrl(b.url) ?? "";
    const target = await resolveTarget(p.id, b);
    const twin = await one(
      `SELECT id FROM ext_link WHERE source = $1 AND ext_id = $2 AND project_id = $3 AND superseded_at IS NULL
          AND activity_id IS NOT DISTINCT FROM $4 AND raid_id IS NOT DISTINCT FROM $5
          AND criterion_id IS NOT DISTINCT FROM $6`,
      [kind, ref, p.id, target.activity_id, target.raid_id, target.criterion_id]);
    if (twin) throw new HttpError(409, `${twin.id} already cites ${ref} here`);
    let id = null;
    await audited(req.user,
      () => ({ action: "Reference cited", entity: "ext_link", entityId: id,
               detail: `${kind} ${ref} → ${p.id}${targetLabel(target)}` }),
      async (t) => {
        id = await allocateId(t, "XL");
        await t.query(
          `INSERT INTO ext_link (id, source, ext_id, project_id, activity_id, raid_id, criterion_id, site_id,
                                 title_cache, url, linked_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, kind, ref, p.id, target.activity_id, target.raid_id, target.criterion_id, p.site_id,
           title(b.title) ?? "", url, req.user.id]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/**
 * Correct a reference: its ref, its url, its title. Its kind, project and
 * target do not move — remove it and link again. On a frozen citation a
 * change of ref or url is a new version (REQ-29); a title is a display
 * cache and is corrected in place.
 */
r.patch("/references/:id", async (req, res, next) => {
  try {
    const { l } = await reference(req.params.id, req.user);
    const b = req.body ?? {};
    const version = requiredVersion(b, "reference");
    if (l.superseded_at) throw new HttpError(409, "This citation was superseded — it is kept as it was; correct the live version");
    for (const k of ["kind", "project", "activity", "raid", "criterion"]) {
      if (b[k] !== undefined) bad(`A reference keeps its ${k} — remove it and link again`);
    }
    const ref = b.ref !== undefined ? canonicalRef(l.source, b.ref) : undefined;
    const url = cleanUrl(b.url);
    const t2 = title(b.title);
    const refChanges = ref !== undefined && ref !== l.ext_id;
    const urlChanges = url !== undefined && url !== l.url;

    if ((refChanges || urlChanges) && await citationFrozen(l)) {
      if (version !== l.row_version) throw new HttpError(409, "Someone else changed this reference — reload and try again");
      let id = null;
      await audited(req.user,
        () => ({ action: "Citation superseded", entity: "ext_link", entityId: id,
                 detail: `${l.criterion_id}: ${l.source} ${l.ext_id} → ${ref ?? l.ext_id} (${l.id} kept)`,
                 before: { id: l.id, ref: l.ext_id, url: l.url },
                 after: { id, ref: ref ?? l.ext_id, url: url ?? l.url } }),
        async (t) => {
          const moved = await t.query(
            `SELECT 1 FROM ext_link WHERE id = $1 AND row_version = $2 AND superseded_at IS NULL`, [l.id, version]);
          if (!moved.rows.length) throw new HttpError(409, "Someone else changed this reference — reload and try again");
          id = await supersede(t, l, { ref: ref ?? l.ext_id, url, title: t2 }, { linkedBy: req.user.id });
        });
      return res.status(201).json({ id, supersedes: l.id });
    }

    const patch = {};
    if (refChanges) { patch.ext_id = ref; patch.state = ""; patch.state_at = null; patch.state_source = null; }
    if (urlChanges) patch.url = url;
    if (t2 !== undefined && t2 !== l.title_cache) patch.title_cache = t2;
    if (!Object.keys(patch).length) bad("Nothing recognised to change");
    const out = await audited(req.user,
      { action: "Reference corrected", entity: "ext_link", entityId: l.id,
        detail: `${l.source} ${l.ext_id}${refChanges ? " → " + ref : ""}`,
        before: { ref: l.ext_id, url: l.url, title: l.title_cache },
        after: { ref: patch.ext_id ?? l.ext_id, url: patch.url ?? l.url, title: patch.title_cache ?? l.title_cache } },
      async (t) => {
        const rv = await updateVersioned(t, "ext_link", l.id, version, patch);
        if (!rv.ok) throw new HttpError(409, "Someone else changed this reference — reload and try again");
        return rv;
      });
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/references/:id", async (req, res, next) => {
  try {
    const { l, p } = await reference(req.params.id, req.user);
    if (l.superseded_at) throw new HttpError(409, "A superseded citation is part of the gate record — it is kept");
    if (await citationFrozen(l)) {
      throw new HttpError(409, "This reference is cited by a criterion that was found met or whose gate has passed — " +
        "it is part of the gate record. Cite a new version instead of removing it.");
    }
    await audited(req.user,
      { action: "Reference removed", entity: "ext_link", entityId: l.id,
        detail: `${l.source} ${l.ext_id} ⇸ ${p.id}${targetLabel(l)}`,
        before: { source: l.source, ref: l.ext_id, url: l.url, project: l.project_id,
                  activity: l.activity_id, raid: l.raid_id, criterion: l.criterion_id } },
      async (t) => t.query(`DELETE FROM ext_link WHERE id = $1`, [l.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;

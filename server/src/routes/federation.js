/**
 * SDP federation — the INTERACTIVE side, mounted at /api/federation
 * behind the normal session.
 *
 * Settings are admin-only; linking an SDP item to a project is an
 * ordinary project write, gated by rbac.can — a site PM links at their
 * site, group links on their programmes, exactly like any other project
 * mutation. The machine-facing contracts live in
 * routes/federationService.js at /v1.
 *
 * SDP remains the system of record for everything linked: the cached
 * display copies here are refreshed from its feeds and never edited.
 */

import { Router } from "express";
import { one, many, allocateId, updateVersioned, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor } from "../portfolio.js";
import {
  loadFederationSettings, _invalidate, generateServiceKey, sdpGet,
} from "../federation.js";

const r = Router();

/* ── shared helpers (same idiom as portfolio.js) ──────────────────── */

const bad = (msg) => { throw new HttpError(400, msg); };

function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
  return v;
}

async function visibleProject(id, user) {
  const p = await projectFor(id);
  if (!p) throw new HttpError(404, "No such project");
  if (user && !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDateOrNull = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const str = (v, max = 400) => String(v ?? "").slice(0, max);

const SOURCES = new Set(["meetings", "inspection", "report", "change"]);

/* ── settings (admin only) ─────────────────────────────────────────── */

r.get("/settings", async (req, res, next) => {
  try {
    gate(req.user, "settings.write", {});
    const s = await loadFederationSettings();
    res.json({
      sdpBaseUrl: s.fedSdpBaseUrl,
      outKeySet: !!s.fedSdpOutKey,       // the key itself never leaves the server
      inboundKeySet: !!s.fedSdpKeyHash,  // only ever the hash in storage
    });
  } catch (e) { next(e); }
});

r.put("/settings", async (req, res, next) => {
  try {
    gate(req.user, "settings.write", {});
    const b = req.body ?? {};
    const patch = {};
    if (b.sdpBaseUrl !== undefined) patch.fedSdpBaseUrl = str(b.sdpBaseUrl, 300).replace(/\/+$/, "");
    // Blank keeps the stored secret (SDP's admin-card convention).
    if (b.sdpOutKey !== undefined && String(b.sdpOutKey) !== "") patch.fedSdpOutKey = str(b.sdpOutKey, 200);
    if (!Object.keys(patch).length) bad("Nothing recognised to change");

    await audited(req.user,
      { action: "Federation settings changed", entity: "app_setting",
        entityId: Object.keys(patch).join(","),
        detail: Object.keys(patch).map((k) => (k === "fedSdpOutKey" ? "fedSdpOutKey=•••" : `${k}=${patch[k]}`)).join(" · ") },
      async (t) => {
        for (const [k, v] of Object.entries(patch)) {
          await t.query(
            `INSERT INTO app_setting (key, value, updated_at) VALUES ($1,$2,now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [k, JSON.stringify(v)]);
        }
      });
    _invalidate();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Mint the inbound service key. The plaintext is shown once, here, to
    the admin who will hand it to the SDP side; only its hash persists. */
r.post("/keys/inbound", async (req, res, next) => {
  try {
    gate(req.user, "settings.write", {});
    const { plain, hash } = generateServiceKey();
    await audited(req.user,
      { action: "Federation inbound key rotated", entity: "app_setting", entityId: "fedSdpKeyHash" },
      async (t) => {
        await t.query(
          `INSERT INTO app_setting (key, value, updated_at) VALUES ('fedSdpKeyHash',$1,now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [JSON.stringify(hash)]);
      });
    _invalidate();
    res.json({ key: plain });
  } catch (e) { next(e); }
});

/* ── SDP reads for the picker (best-effort proxies) ────────────────── */

r.get("/sdp/actions", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read", {});
    const site = str(req.query.site ?? "", 16);
    if (!site) bad("site is required");
    const data = await sdpGet(`/api/actions/open?site=${encodeURIComponent(site)}`);
    if (!data) return res.json({ configured: false, actions: [] });
    res.json({ configured: true, actions: Array.isArray(data.actions) ? data.actions : [] });
  } catch (e) { next(e); }
});

r.get("/sdp/changes", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read", {});
    const site = str(req.query.site ?? "", 16);
    if (!site) bad("site is required");
    const data = await sdpGet(`/api/changes/open?site=${encodeURIComponent(site)}`);
    if (!data) return res.json({ configured: false, changes: [] });
    res.json({ configured: true, changes: Array.isArray(data.changes) ? data.changes : [] });
  } catch (e) { next(e); }
});

/* ── link CRUD (ordinary project writes) ───────────────────────────── */

r.post("/links", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!SOURCES.has(b.source)) bad("source must be meetings, inspection, report or change");
    if (!b.extId) bad("extId is required");
    if (!b.project) bad("A link needs a project");
    const p = await visibleProject(b.project, req.user);
    gate(req.user, "project.write", { project: p });

    if (b.activity) {
      const a = await one(`SELECT id, project_id FROM activity WHERE id = $1`, [String(b.activity)]);
      if (!a || a.project_id !== p.id) bad("That activity does not belong to this project");
    }

    let id = null;
    await audited(req.user,
      () => ({ action: "SDP item linked", entity: "ext_link", entityId: id ?? String(b.extId),
               detail: `${b.source}:${b.extId} → ${p.id}` }),
      async (t) => {
        id = await allocateId(t, "XL");
        const out = await t.query(
          `INSERT INTO ext_link
             (id, source, ext_id, project_id, activity_id, site_id,
              title_cache, status_cache, kind_cache, risk_cache, due_cache, window_start,
              linked_by, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
           ON CONFLICT (source, ext_id, project_id) DO UPDATE SET
             activity_id = EXCLUDED.activity_id,
             title_cache = EXCLUDED.title_cache, status_cache = EXCLUDED.status_cache,
             kind_cache = EXCLUDED.kind_cache, risk_cache = EXCLUDED.risk_cache,
             due_cache = EXCLUDED.due_cache, window_start = EXCLUDED.window_start,
             linked_by = EXCLUDED.linked_by, stale = false, synced_at = now(),
             row_version = ext_link.row_version + 1
           RETURNING id`,
          [id, String(b.source), str(b.extId, 120), p.id,
           b.activity ? String(b.activity) : null, p.site_id,
           str(b.title, 300), str(b.status, 80), str(b.kind, 120),
           str(b.risk, 40), asDateOrNull(b.due), asDateOrNull(b.windowStart),
           req.user.id]
        );
        id = out.rows[0].id; // the surviving id when the conflict path ran
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/links/:id", async (req, res, next) => {
  try {
    const l = await one(`SELECT * FROM ext_link WHERE id = $1`, [req.params.id]);
    if (!l) throw new HttpError(404, "No such link");
    const p = await visibleProject(l.project_id, req.user);
    gate(req.user, "project.write", { project: p });
    const b = req.body ?? {};
    const version = requiredVersion(b, "link");

    const patch = {};
    if (b.activity !== undefined) {
      if (b.activity) {
        const a = await one(`SELECT id, project_id FROM activity WHERE id = $1`, [String(b.activity)]);
        if (!a || a.project_id !== p.id) bad("That activity does not belong to this project");
        patch.activity_id = a.id;
      } else {
        patch.activity_id = null;
      }
    }
    if (!Object.keys(patch).length) bad("Nothing recognised to change");

    await audited(req.user,
      { action: "SDP link re-pinned", entity: "ext_link", entityId: l.id,
        detail: `${l.source}:${l.ext_id} → ${patch.activity_id ?? "project level"}` },
      async (t) => {
        const out = await updateVersioned(t, "ext_link", l.id, version, patch);
        if (!out.ok) throw new HttpError(409, "Someone else changed this link — reload and try again");
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/links/:id", async (req, res, next) => {
  try {
    const l = await one(`SELECT * FROM ext_link WHERE id = $1`, [req.params.id]);
    if (!l) throw new HttpError(404, "No such link");
    const p = await visibleProject(l.project_id, req.user);
    gate(req.user, "project.write", { project: p });
    await audited(req.user,
      { action: "SDP link removed", entity: "ext_link", entityId: l.id,
        detail: `${l.source}:${l.ext_id} ⇸ ${p.id}`,
        before: { source: l.source, ext_id: l.ext_id, project: l.project_id, title: l.title_cache } },
      async (t) => t.query(`DELETE FROM ext_link WHERE id = $1`, [l.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── cache refresh ─────────────────────────────────────────────────────
   Re-reads C2 + C4 for one site and refreshes every link's display
   cache; a link the feeds no longer return is marked stale, not deleted
   — the PM decides what a vanished item means. Any signed-in user may
   trigger it: the caches only ever move toward the authoritative feed. */
r.post("/refresh", async (req, res, next) => {
  try {
    gate(req.user, "portfolio.read", {});
    const site = str((req.body ?? {}).site ?? "", 16);
    if (!site) bad("site is required");

    const [actions, changes] = await Promise.all([
      sdpGet(`/api/actions/open?site=${encodeURIComponent(site)}`),
      sdpGet(`/api/changes/open?site=${encodeURIComponent(site)}`),
    ]);
    if (!actions && !changes) return res.json({ configured: false, refreshed: 0, stale: 0 });

    const byExtId = new Map();
    for (const a of actions?.actions ?? []) {
      byExtId.set(String(a.id), {
        title: a.title, status: a.status, kind: a.origin_label ?? "",
        risk: "", due: a.due_date ?? null, windowStart: null,
      });
    }
    for (const c of changes?.changes ?? []) {
      byExtId.set(String(c.id), {
        title: c.subject, status: c.outcome && c.outcome !== "pending" ? c.outcome : `${c.stage ?? ""} · ${c.status ?? ""}`,
        kind: c.change_type ?? "", risk: c.risk ?? "",
        due: c.scheduled_end ?? null, windowStart: c.scheduled_start ?? null,
      });
    }

    const links = await many(`SELECT * FROM ext_link WHERE site_id = $1`, [site]);
    let refreshed = 0, stale = 0;
    await audited(req.user,
      () => ({ action: "SDP link caches refreshed", entity: "ext_link", entityId: site,
               detail: `${refreshed} refreshed, ${stale} stale` }),
      async (t) => {
        for (const l of links) {
          const f = byExtId.get(l.ext_id);
          if (f) {
            await t.query(
              `UPDATE ext_link SET
                 title_cache = $2, status_cache = $3, kind_cache = $4, risk_cache = $5,
                 due_cache = $6, window_start = $7, stale = false, synced_at = now(),
                 row_version = row_version + 1
               WHERE id = $1`,
              [l.id, str(f.title, 300), str(f.status, 80), str(f.kind, 120),
               str(f.risk, 40), asDateOrNull(f.due), asDateOrNull(f.windowStart)]);
            refreshed++;
          } else if (!l.stale) {
            await t.query(
              `UPDATE ext_link SET stale = true, synced_at = now(),
                 row_version = row_version + 1 WHERE id = $1`, [l.id]);
            stale++;
          }
        }
      });
    res.json({ configured: true, refreshed, stale });
  } catch (e) { next(e); }
});

export default r;

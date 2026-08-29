/**
 * SDP federation — the SERVICE side (contracts C1 / C3 / C5 / C6).
 *
 * Mounted at /v1, BEFORE requireUser(), on purpose: the caller is
 * another system, not a person. The guard is the hashed service key
 * (server/src/federation.js); on success the request carries the
 * synthetic SVC-SDP principal, and every ingest write still goes
 * through audited() inside one transaction — a machine's writes are as
 * attributable as a human's (ADR-4).
 *
 * The interactive companion (settings, picker proxies, link CRUD) lives
 * in routes/federation.js under the normal session.
 */

import { Router } from "express";
import { many } from "../db.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { requireServiceKey } from "../federation.js";

const r = Router();
r.use(requireServiceKey());

const bad = (msg) => { throw new HttpError(400, msg); };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDateOrNull = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const str = (v, max = 400) => String(v ?? "").slice(0, max);

/* ── C1 · resource sync ───────────────────────────────────────────────
   SDP owns which sites and people EXIST (ADR-9): site ids are SDP's
   meeting codes verbatim, people are SDP-U<id>. Local enrichment (city,
   region, tz, day_rate) survives a re-sync — the upsert only touches
   what SDP owns. Idempotent: re-POST is a no-op-or-update. */
r.post("/resources/sync", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const sites = Array.isArray(b.sites) ? b.sites : [];
    const people = Array.isArray(b.people) ? b.people : [];
    for (const s of sites) {
      if (!s?.id || !/^[A-Z0-9_-]{2,16}$/.test(String(s.id))) {
        bad(`Site id ${JSON.stringify(s?.id)} is not a valid code`);
      }
    }

    let siteCount = 0, peopleCount = 0, skipped = 0;
    await audited(req.user,
      () => ({
        action: "SDP resources synced", entity: "site", entityId: "C1",
        detail: `${siteCount} site(s), ${peopleCount} person(s), ${skipped} skipped`,
      }),
      async (t) => {
        for (const s of sites) {
          await t.query(
            `INSERT INTO site (id, city, region, active)
             VALUES ($1, $2, 'SDP', true)
             ON CONFLICT (id) DO UPDATE SET active = true`,
            [String(s.id), str(s.name || s.id, 120)]
          );
          siteCount++;
        }
        const known = new Set(
          (await t.query(`SELECT id FROM site`)).rows.map((row) => row.id)
        );
        for (const p of people) {
          if (!p?.id) { skipped++; continue; }
          if (!p.site_id || !known.has(String(p.site_id))) { skipped++; continue; }
          await t.query(
            `INSERT INTO person (id, name, job_role, site_id, active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, job_role = EXCLUDED.job_role,
               site_id = EXCLUDED.site_id, active = EXCLUDED.active,
               row_version = person.row_version + 1`,
            [String(p.id), str(p.name || p.id, 160), str(p.role ?? "", 80),
             String(p.site_id), p.active !== false]
          );
          peopleCount++;
        }
      });

    res.json({
      sites: { upserted: siteCount },
      people: { upserted: peopleCount, skipped_unknown_site: skipped },
    });
  } catch (e) { next(e); }
});

/* ── C3 · link read-back ──────────────────────────────────────────────
   SDP keys its "▸ Projet" badges by ext_id, which MUST equal the C2/C4
   stable id. Filtered to the projects delivered at the asked site. */
r.get("/links", async (req, res, next) => {
  try {
    const site = str(req.query.site ?? "", 16);
    const rows = site
      ? await many(
          `SELECT l.source, l.ext_id, l.activity_id, l.project_id, l.title_cache, p.name AS project_name
             FROM ext_link l JOIN project p ON p.id = l.project_id
            WHERE p.site_id = $1 AND NOT p.closed
            ORDER BY l.linked_at DESC`, [site])
      : await many(
          `SELECT l.source, l.ext_id, l.activity_id, l.project_id, l.title_cache, p.name AS project_name
             FROM ext_link l JOIN project p ON p.id = l.project_id
            WHERE NOT p.closed
            ORDER BY l.linked_at DESC`);
    res.json({
      links: rows.map((l) => ({
        ext_source: l.source, ext_id: l.ext_id,
        activity_id: l.activity_id, project_id: l.project_id,
        project_name: l.project_name, title_cache: l.title_cache,
      })),
    });
  } catch (e) { next(e); }
});

/* ── C5 · ops-strategy programme ingest ──────────────────────────────
   One-way, SDP → Meridian (ADR-7). Deterministic SDP-* ids make the
   whole ingest an idempotent upsert; objectives that disappear from the
   payload close (never delete — audit history survives), deliverables
   that disappear are removed. Everything lands origin='sdp', which is
   what locks local edits out (ADR-8). */
r.post("/programmes/sync", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const prog = b.programme ?? {};
    if (!prog.id || !/^SDP-[A-Z0-9_-]{2,24}$/.test(String(prog.id))) {
      bad("programme.id must be an SDP-* derived id");
    }
    if (!prog.name) bad("programme.name is required");
    const homeSite = str(b.home_site ?? "", 16);
    if (!homeSite) bad("home_site is required");
    const projects = Array.isArray(b.projects) ? b.projects : [];
    const milestones = Array.isArray(b.milestones) ? b.milestones : [];
    for (const p of projects) {
      if (!/^SDP-[A-Z0-9_-]{2,40}$/.test(String(p?.id ?? ""))) bad(`project id ${JSON.stringify(p?.id)} must be SDP-* derived`);
      if (!p.name) bad(`project ${p.id} needs a name`);
      if (!asDateOrNull(p.start_date) || !asDateOrNull(p.finish_date)) {
        bad(`project ${p.id} needs start_date and finish_date as YYYY-MM-DD`);
      }
    }
    for (const m of milestones) {
      if (!/^SDP-[A-Za-z0-9_-]{2,64}$/.test(String(m?.id ?? ""))) bad(`milestone id ${JSON.stringify(m?.id)} must be SDP-* derived`);
      if (!asDateOrNull(m.delivery_date)) bad(`milestone ${m.id} needs delivery_date as YYYY-MM-DD`);
    }

    const HEALTH = { green: "G", orange: "A", red: "R" };
    let counts = { projects: 0, milestones: 0, closed: 0, removed: 0 };

    await audited(req.user,
      () => ({
        action: "SDP programme synced", entity: "programme", entityId: String(prog.id),
        detail: `${counts.projects} project(s), ${counts.milestones} milestone(s), ` +
                `${counts.closed} closed, ${counts.removed} milestone(s) removed`,
      }),
      async (t) => {
        // The home site must exist even if C1 has not run yet.
        await t.query(
          `INSERT INTO site (id, city, region, active) VALUES ($1, $1, 'SDP', true)
           ON CONFLICT (id) DO UPDATE SET active = true`, [homeSite]);

        const managerId = prog.manager_person_id
          ? (await t.query(`SELECT id FROM person WHERE id = $1`, [String(prog.manager_person_id)])).rows[0]?.id ?? null
          : null;

        await t.query(
          `INSERT INTO programme (id, name, sponsor, manager_id, active, origin)
           VALUES ($1, $2, $3, $4, true, 'sdp')
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, sponsor = EXCLUDED.sponsor,
             manager_id = EXCLUDED.manager_id, active = true,
             row_version = programme.row_version + 1`,
          [String(prog.id), str(prog.name, 160), str(prog.sponsor ?? "IT Operations", 160), managerId]
        );

        for (const p of projects) {
          const health = HEALTH[String(p.status ?? "").toLowerCase()] ?? null;
          await t.query(
            `INSERT INTO project
               (id, name, programme_id, site_id, governance_level, pm_id, method,
                start_date, finish_date, baseline_finish, budget, contingency,
                description, phase, health_override, health_override_why, closed, origin)
             VALUES ($1,$2,$3,$4,'group',$5,'Hybrid',$6,$7,$8,0,0,$9,'Delivery',$10,$11,false,'sdp')
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, programme_id = EXCLUDED.programme_id,
               site_id = EXCLUDED.site_id, pm_id = EXCLUDED.pm_id,
               start_date = EXCLUDED.start_date, finish_date = EXCLUDED.finish_date,
               baseline_finish = EXCLUDED.baseline_finish,
               description = EXCLUDED.description,
               health_override = EXCLUDED.health_override,
               health_override_why = EXCLUDED.health_override_why,
               closed = false,
               row_version = project.row_version + 1`,
            [String(p.id), str(p.name, 200), String(prog.id), homeSite,
             managerId, p.start_date, p.finish_date,
             asDateOrNull(p.target_date) ?? p.finish_date,
             str(p.description ?? "", 2000), health, str(p.gap_note ?? "", 800)]
          );
          /* One synthetic weight-1.0 activity carries the objective's
             progress, so the frozen engine renders it honestly with no
             schedule fakery (data-architecture paper, Q4). */
          const pct = Math.max(0, Math.min(100, Math.round(Number(p.progress_pct ?? 0))));
          await t.query(
            `INSERT INTO activity
               (id, project_id, name, stage, start_date, end_date, base_start, base_end,
                weight, pct, origin)
             VALUES ($1,$2,'Objective progress',0,$3,$4,$3,$4,1.0,$5,'sdp')
             ON CONFLICT (id) DO UPDATE SET
               start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
               pct = EXCLUDED.pct,
               row_version = activity.row_version + 1`,
            [`${p.id}-A1`, String(p.id), p.start_date, p.finish_date, pct]
          );
          counts.projects++;
        }

        // Objectives SDP no longer sends close; they never delete.
        const sent = projects.map((p) => String(p.id));
        const gone = await t.query(
          `UPDATE project SET closed = true, row_version = row_version + 1
            WHERE programme_id = $1 AND origin = 'sdp' AND NOT closed
              AND NOT (id = ANY($2)) RETURNING id`,
          [String(prog.id), sent]
        );
        counts.closed = gone.rows.length;

        const keptProjects = new Set(sent);
        for (const m of milestones) {
          if (!keptProjects.has(String(m.project_id))) continue;
          await t.query(
            `INSERT INTO milestone (id, project_id, name, due_date, base_date, kind, done, origin)
             VALUES ($1,$2,$3,$4,$4,'milestone',$5,'sdp')
             ON CONFLICT (id) DO UPDATE SET
               project_id = EXCLUDED.project_id, name = EXCLUDED.name,
               due_date = EXCLUDED.due_date, done = EXCLUDED.done,
               row_version = milestone.row_version + 1`,
            [String(m.id), String(m.project_id), str(m.label || m.id, 300),
             m.delivery_date, m.done === true]
          );
          counts.milestones++;
        }
        const sentMs = milestones.map((m) => String(m.id));
        const removed = await t.query(
          `DELETE FROM milestone
            WHERE origin = 'sdp'
              AND project_id IN (SELECT id FROM project WHERE programme_id = $1)
              AND NOT (id = ANY($2)) RETURNING id`,
          [String(prog.id), sentMs]
        );
        counts.removed = removed.rows.length;
      });

    res.json({ programme: prog.id, ...counts });
  } catch (e) { next(e); }
});

/* ── C6 · projects summary (for SDP's read-only PM panel) ────────────
   Health, phase and dates only — no budget, no cost, no PII beyond the
   PM's display name (PMO paper, Q8). */
r.get("/projects/summary", async (req, res, next) => {
  try {
    const site = str(req.query.site ?? "", 16);
    const params = [];
    let where = `NOT p.closed`;
    if (site) { params.push(site); where += ` AND p.site_id = $1`; }
    const rows = await many(
      `SELECT p.id, p.name, p.phase, p.gate, p.health_override, p.finish_date,
              p.site_id, g.name AS programme_name, pe.name AS pm_name
         FROM project p
         JOIN programme g ON g.id = p.programme_id
         LEFT JOIN person pe ON pe.id = p.pm_id
        WHERE ${where}
        ORDER BY g.name, p.name`, params);
    res.json({
      projects: rows.map((p) => ({
        id: p.id, name: p.name, programme: p.programme_name, site: p.site_id,
        phase: p.phase, gate: p.gate, health: p.health_override ?? null,
        finish: p.finish_date, pm: p.pm_name ?? null,
      })),
    });
  } catch (e) { next(e); }
});

export default r;

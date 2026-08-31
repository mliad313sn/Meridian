/**
 * Administration — users, grants, settings, reference data.
 * Everything here is administrator-only (R1.9), enforced at the top.
 */

import { Router } from "express";
import { many, one, updateVersioned, allocateId, requiredVersion } from "../db.js";
import { can } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError, createUser, setPassword, publicUser } from "../auth.js";
import { loadSettings } from "../portfolio.js";
import { buildArchive } from "../archive.js";
import {
  SCOPES, listIntegrations, createIntegration, rotateIntegrationKey, normaliseScopes,
} from "../integrations.js";

/* Même refus qu'ailleurs : un second écrivain est prévenu, jamais écrasé. */
function conflict(result) {
  if (!result.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return result;
}

const r = Router();

r.use((req, _res, next) => {
  const v = can(req.user, "user.manage");
  if (!v.ok) return next(new HttpError(403, v.why));
  next();
});

/* ── users ────────────────────────────────────────────────────────── */

r.get("/users", async (_req, res, next) => {
  try {
    /* Les comptes de service ne sont pas des comptes de personne.
       Une intégration et la fédération portent chacune une ligne
       `app_user` — c'est ce qui permet à la piste d'audit de les NOMMER
       plutôt que d'écrire « système ». Mais elles n'ont ni mot de passe,
       ni session possible, ni habilitation à gérer : les laisser dans la
       liste des comptes offrait « Modifier » et « Habilitations » sur
       quelque chose qui n'est pas quelqu'un, et laissait croire qu'un
       accès de plus existait.

       Le discriminant est leur adresse, dans le domaine réservé
       `.invalid` (RFC 2606) — réservé précisément pour ce qui ne doit
       jamais résoudre. Elles restent visibles là où elles ont un sens :
       « Systèmes branchés » et « Fédération SDP ». */
    const users = await many(
      `SELECT id, email, display_name, person_id, role, active, created_at, last_login_at, row_version
         FROM app_user
        WHERE email NOT LIKE '%.invalid'
        ORDER BY display_name`);
    const grants = await many(`SELECT * FROM access_grant ORDER BY user_id`);
    const byUser = new Map();
    for (const g of grants) {
      if (!byUser.has(g.user_id)) byUser.set(g.user_id, []);
      byUser.get(g.user_id).push(g);
    }
    res.json({ users: users.map((u) => publicUser(u, byUser.get(u.id) ?? [])) });
  } catch (e) { next(e); }
});

r.post("/users", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.email || !b.displayName) throw new HttpError(400, "Email and name are required");
    if (!["admin", "group", "site", "viewer"].includes(b.role)) {
      throw new HttpError(400, "Role must be admin, group, site or viewer");
    }
    if (!b.password || b.password.length < 8) {
      throw new HttpError(400, "A password of at least 8 characters is required");
    }
    const clash = await one(`SELECT id FROM app_user WHERE lower(email) = lower($1)`, [b.email]);
    if (clash) throw new HttpError(409, "That email address is already in use");

    /* A group or site account with no grants can see nothing and do
       nothing; the committee treated that as a configuration mistake
       rather than a valid state (R1.3). */
    const grants = Array.isArray(b.grants) ? b.grants : [];
    if (["group", "site"].includes(b.role) && !grants.length) {
      throw new HttpError(400, `A ${b.role}-level account needs at least one ${b.role === "group" ? "programme" : "site"} grant`);
    }

    const id = await createUser({
      email: b.email, displayName: b.displayName, role: b.role,
      password: b.password, personId: b.personId ?? null,
    });
    /* Adoption committee I4: the admin knows this password. First
       sign-in forces the owner to make it their own. */
    await setPassword(id, b.password, { mustChange: true });
    await audited(req.user,
      { action: "User created", entity: "app_user", entityId: id,
        detail: `${b.displayName} <${b.email}> as ${b.role}` },
      async (t) => {
        for (const g of grants) {
          const kind = g.kind === "programme" ? "programme" : "site";
          await t.query(
            `INSERT INTO access_grant (user_id, scope_kind, programme_id, site_id, granted_by)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, kind, kind === "programme" ? g.target : null,
             kind === "site" ? g.target : null, req.user.id]);
        }
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/users/:id", async (req, res, next) => {
  try {
    const u = await one(`SELECT * FROM app_user WHERE id = $1`, [req.params.id]);
    if (!u) throw new HttpError(404, "No such user");
    const b = req.body ?? {};

    /* Do not let the last administrator lock everyone out. */
    if ((b.role && b.role !== "admin" && u.role === "admin") || b.active === false) {
      const admins = await one(
        `SELECT count(*)::int AS n FROM app_user WHERE role='admin' AND active AND id <> $1`,
        [u.id]);
      if ((admins?.n ?? 0) === 0 && u.role === "admin") {
        throw new HttpError(409, "This is the last active administrator");
      }
    }

    const patch = {};
    if (b.displayName !== undefined) patch.display_name = b.displayName;
    if (b.email !== undefined) patch.email = b.email;
    if (b.personId !== undefined) patch.person_id = b.personId || null;
    if (b.role !== undefined) {
      if (!["admin", "group", "site", "viewer"].includes(b.role)) throw new HttpError(400, "Unknown role");
      patch.role = b.role;
    }
    if (b.active !== undefined) patch.active = !!b.active;

    const out = await audited(req.user,
      { action: "User updated", entity: "app_user", entityId: u.id,
        detail: Object.keys(patch).join(", "), before: { role: u.role, active: u.active } },
      async (t) => {
        const rv = await updateVersioned(t, "app_user", u.id, requiredVersion(b, "account"), patch);
        if (!rv.ok) return rv;
        // Deactivating an account ends its sessions immediately (R1.8).
        if (b.active === false) await t.query(`DELETE FROM session WHERE user_id = $1`, [u.id]);
        return rv;
      });
    if (!out.ok) throw new HttpError(409, "Someone else changed this account — reload and try again");
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/**
 * G-10 — l'interrupteur.
 *
 * Le comité InfoSec a relevé qu'il n'existait aucun geste de réponse à
 * incident : rien pour couper court quand on soupçonne qu'une session
 * traîne quelque part — un ordinateur portable perdu, un poste partagé
 * laissé ouvert, un doute sur un mot de passe. Chacun peut déjà terminer
 * SES autres sessions en changeant son mot de passe ; personne ne pouvait
 * les terminer TOUTES.
 *
 * Un seul appel, réservé à l'administration, tracé comme tout le reste :
 * tout le monde se reconnecte, y compris celui qui a appuyé. C'est ce qui
 * en fait un geste qu'on assume plutôt qu'un bouton qu'on essaie.
 */
r.post("/sessions/revoke-all", async (req, res, next) => {
  try {
    const before = await one(`SELECT count(*)::int AS n FROM session`);
    await audited(req.user,
      { action: "All sessions revoked", entity: "system", entityId: "sessions",
        detail: `${before?.n ?? 0} session(s) ended — everyone signs in again` },
      async (t) => t.query(`DELETE FROM session`));
    res.json({ ok: true, ended: before?.n ?? 0 });
  } catch (e) { next(e); }
});

/**
 * M-01 — tout emporter, y compris la piste.
 *
 * « Et dans trois ans ? » est la question que le comité de marché a
 * relevée et à laquelle aucun des vingt-trois rapports ne répondait. Un
 * seul fichier ouvert : le livre entier ET la piste d'audit, dans un
 * format qu'on relit avec `jq` et qu'on recharge avec
 * `npm run restore -- <fichier>`.
 *
 * Il ne contient aucun secret (ni jeton, ni empreinte de mot de passe) :
 * il peut donc être remis à un séquestre ou à un successeur sans
 * arbitrage. Ce n'est pas une sauvegarde — voir l'en-tête de archive.js.
 */
r.get("/archive", async (req, res, next) => {
  try {
    const doc = await buildArchive({ issuedTo: req.user.displayName });
    /* Sortir la totalité du livre et de la piste est un acte de
       gouvernance : il laisse une ligne, comme tout le reste. */
    await audited(req.user,
      { action: "Archive exported", entity: "system", entityId: "archive",
        detail: `${doc.totalRows} row(s) across ${doc.order.length} table(s)` },
      async () => null);
    res.setHeader("Content-Disposition",
      `attachment; filename="meridian-archive-${doc.generatedAt.slice(0, 10)}.json"`);
    res.json(doc);
  } catch (e) { next(e); }
});

/* ── intégrations (INT-02) ────────────────────────────────────────────
 *
 * Une clé par système branché, une portée par clé, un nom dans la piste.
 * La clé en clair n'existe qu'une fois — dans la réponse à sa création ou
 * à sa rotation. Elle n'est ni stockée, ni relisible, ni renvoyée par la
 * liste : si elle est perdue, on en tourne une nouvelle, ce qui est
 * exactement le geste qu'on veut rendre banal.
 */

r.get("/integrations", async (_req, res, next) => {
  try {
    res.json({ integrations: await listIntegrations(), scopes: SCOPES });
  } catch (e) { next(e); }
});

r.post("/integrations", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.name) throw new HttpError(400, "An integration needs a name — it will appear in the audit trail");
    let created = null;
    const id = "INT-" + Date.now().toString(36).toUpperCase().slice(-6);
    await audited(req.user,
      { action: "Integration created", entity: "integration", entityId: id,
        detail: `${b.name} — ${b.scopes || "no scope"}` },
      async (t) => {
        try {
          created = await createIntegration({
            id, name: b.name, purpose: b.purpose, scopes: b.scopes, createdBy: req.user.id,
          }, t);
        } catch (e) { throw new HttpError(400, e.message); }
      });
    /* La seule fois où la clé quitte le serveur. Dit en toutes lettres,
       parce qu'un administrateur qui ferme la fenêtre sans copier doit
       comprendre tout de suite qu'il faut tourner la clé, pas chercher
       où elle est rangée. */
    res.status(201).json({
      id, ...created,
      notice: "This key is shown once and is not stored. Copy it now; if it is lost, rotate it.",
    });
  } catch (e) { next(e); }
});

r.post("/integrations/:id/rotate", async (req, res, next) => {
  try {
    const row = await one(`SELECT id, name FROM integration WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such integration");
    let out = null;
    await audited(req.user,
      { action: "Integration key rotated", entity: "integration", entityId: row.id,
        detail: row.name },
      async (t) => { out = await rotateIntegrationKey(row.id, t); });
    res.json({ ...out, notice: "The previous key stopped working the moment this one was issued." });
  } catch (e) { next(e); }
});

r.patch("/integrations/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM integration WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such integration");
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.purpose !== undefined) patch.purpose = b.purpose;
    if (b.active !== undefined) patch.active = b.active === true;
    if (b.scopes !== undefined) {
      try { patch.scopes = normaliseScopes(b.scopes); }
      catch (e) { throw new HttpError(400, e.message); }
    }
    const out = await audited(req.user,
      { action: b.active === false ? "Integration revoked" : "Integration updated",
        entity: "integration", entityId: row.id, detail: b.name ?? row.name,
        before: { scopes: row.scopes, active: row.active },
        after: { scopes: patch.scopes ?? row.scopes, active: patch.active ?? row.active } },
      async (t) => conflict(await updateVersioned(t, "integration", row.id,
        requiredVersion(b, "integration"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/integrations/:id", async (req, res, next) => {
  try {
    const row = await one(`SELECT * FROM integration WHERE id = $1`, [req.params.id]);
    if (!row) throw new HttpError(404, "No such integration");
    /* La ligne `app_user` qui porte son nom, elle, RESTE : la piste
       d'audit la référence, et une piste qui ne sait plus nommer qui a
       écrit n'est plus une piste. Même règle que pour une personne
       désactivée plutôt que supprimée (I-19). */
    await audited(req.user,
      { action: "Integration removed", entity: "integration", entityId: row.id,
        detail: row.name, before: { ...row, key_hash: "[redacted]" } },
      async (t) => t.query(`DELETE FROM integration WHERE id = $1`, [row.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post("/users/:id/password", async (req, res, next) => {
  try {
    const u = await one(`SELECT id, display_name FROM app_user WHERE id = $1`, [req.params.id]);
    if (!u) throw new HttpError(404, "No such user");
    const pw = req.body?.password;
    if (!pw || pw.length < 8) throw new HttpError(400, "A password of at least 8 characters is required");
    // An admin-reset password is known to the admin → force a change (I4).
    await setPassword(u.id, pw, { mustChange: true });
    await audited(req.user,
      { action: "Password reset", entity: "app_user", entityId: u.id, detail: u.display_name },
      async (t) => {
        if (req.body?.endSessions !== false) {
          await t.query(`DELETE FROM session WHERE user_id = $1`, [u.id]);
        }
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── grants (R1.3, R1.9) ──────────────────────────────────────────── */

r.post("/users/:id/grants", async (req, res, next) => {
  try {
    const u = await one(`SELECT id, role, display_name FROM app_user WHERE id = $1`, [req.params.id]);
    if (!u) throw new HttpError(404, "No such user");
    const kind = req.body?.kind === "programme" ? "programme" : "site";
    const target = req.body?.target;
    if (!target) throw new HttpError(400, "Name the programme or site to grant");

    const exists = kind === "programme"
      ? await one(`SELECT id FROM programme WHERE id = $1`, [target])
      : await one(`SELECT id FROM site WHERE id = $1`, [target]);
    if (!exists) throw new HttpError(404, `No such ${kind}`);

    if (u.role === "group" && kind !== "programme") {
      throw new HttpError(400, "A group-level account is scoped by programme, not by site");
    }
    if (u.role === "site" && kind !== "site") {
      throw new HttpError(400, "A site-level account is scoped by site, not by programme");
    }

    await audited(req.user,
      { action: "Access granted", entity: "app_user", entityId: u.id,
        detail: `${u.display_name}: ${kind} ${target}` },
      async (t) => t.query(
        `INSERT INTO access_grant (user_id, scope_kind, programme_id, site_id, granted_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [u.id, kind, kind === "programme" ? target : null,
         kind === "site" ? target : null, req.user.id]));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * Revoke by what the grant names rather than by its row id.
 *
 * The directory response deliberately carries grants as programme and
 * site codes, not row identifiers — those are an implementation detail
 * and there is no reason for a browser to hold them. Revoking by target
 * is also idempotent, which matters when two administrators are tidying
 * the same account.
 */
r.post("/users/:id/grants/revoke", async (req, res, next) => {
  try {
    const u = await one(`SELECT id, display_name FROM app_user WHERE id = $1`, [req.params.id]);
    if (!u) throw new HttpError(404, "No such user");
    const kind = req.body?.kind === "programme" ? "programme" : "site";
    const target = req.body?.target;
    if (!target) throw new HttpError(400, "Name the grant to revoke");

    const g = await one(
      `SELECT id FROM access_grant
        WHERE user_id = $1 AND scope_kind = $2
          AND COALESCE(programme_id, site_id) = $3`,
      [u.id, kind, target]);
    if (!g) return res.json({ ok: true, alreadyRevoked: true });

    await audited(req.user,
      { action: "Access revoked", entity: "app_user", entityId: u.id,
        detail: `${u.display_name}: ${kind} ${target}` },
      async (t) => t.query(`DELETE FROM access_grant WHERE id = $1`, [g.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});


/* ── settings ─────────────────────────────────────────────────────── */

/* ── notifications (V-12) ─────────────────────────────────────────────
   The queue is readable and runnable from Administration, so an instance
   with no mail server still shows people exactly what it would have
   sent — which is the honest state, not a silent one. */

r.get("/notifications", async (req, res, next) => {
  try {
    const rows = await many(
      `SELECT id, at, email, kind, subject, entity, entity_id, state, sent_at, error
         FROM notification ORDER BY at DESC LIMIT 200`);
    const counts = await one(
      `SELECT count(*) FILTER (WHERE state='queued')::int AS queued,
              count(*) FILTER (WHERE state='sent')::int   AS sent,
              count(*) FILTER (WHERE state='failed')::int AS failed
         FROM notification`);
    res.json({
      /* docs/32 — the flag used to read MERIDIAN_SMTP_URL, a transport
         this product does not carry; the real one is the outbound
         webhook, and "configured" must mean it would actually send. */
      transport: (await (await import("../notify.js")).outboundTransport()) ? "configured" : "none",
      counts,
      notifications: rows.map((n) => ({
        id: String(n.id), at: n.at, email: n.email, kind: n.kind, subject: n.subject,
        entity: n.entity, entityId: n.entity_id, state: n.state,
        sentAt: n.sent_at, error: n.error,
      })),
    });
  } catch (e) { next(e); }
});

r.post("/notifications/sweep", async (req, res, next) => {
  try {
    const { sweep } = await import("../notify.js");
    const settings = await loadSettings();
    const out = await sweep({ today: settings.statusDate || undefined });
    await audited(req.user,
      { action: "Notification sweep run", entity: "notification", entityId: "",
        detail: `${out.queued} queued of ${out.considered} considered` },
      async () => null);
    res.json(out);
  } catch (e) { next(e); }
});

const NUMERIC = new Set([
  "ccbThreshold", "ccbWeeks", "amberSpi", "redSpi", "amberCpi", "redCpi",
  "escalateExposure", "pmoExposure", "issueAgeDays", "capacityCeiling",
  // V-04 — the capital envelope the queue is ranked against, in millions
  "capexEnvelope",
  /* G-13 — how many days a delivered notification is kept before the
     sweep removes it. Zero means NO retention has been decided, and the
     purge then refuses to run rather than inventing a duration: how long
     a record of who was told what is kept is the sponsor's decision, and
     the code will not make it for them. */
  "notifyRetentionDays",
  /* N-05 — the ceiling the committee set in advance: above this many
     outbound messages per account per week, the settings failed, not the
     reader. The sweep holds back rather than asking people to filter. */
  "notifyWeeklyCap",
  /* The escalator: an unread message climbs one severity step after this
     many days instead of being sent again. Re-sending teaches people to
     ignore it; climbing teaches them it counts. Zero disables it. */
  "notifyEscalateDays",
]);
const BOOLEAN = new Set(["autoRag", "gateLock", "ccb", "capacityAlerts", "benefitTrack"]);
const TEXT = new Set(["cadence", "orgName", "statusDate",
  // R-01 — the hosts an evidence link may point at, comma-separated
  "documentHosts",
  /* N-05 — the hosts an outbound webhook may address. Closed by default,
     exactly like documentHosts: an unconfigured control that waves things
     through is the failure the committee blocked the product over. */
  "notifyHosts"]);

r.patch("/settings", async (req, res, next) => {
  try {
    const patch = req.body ?? {};
    const keys = Object.keys(patch).filter((k) => NUMERIC.has(k) || BOOLEAN.has(k) || TEXT.has(k));
    if (!keys.length) throw new HttpError(400, "Nothing recognised to change");

    await audited(req.user,
      { action: "Settings changed", entity: "app_setting", entityId: keys.join(","),
        detail: keys.map((k) => `${k}=${patch[k]}`).join(" · ") },
      async (t) => {
        for (const k of keys) {
          const v = NUMERIC.has(k) ? Number(patch[k]) : BOOLEAN.has(k) ? !!patch[k] : String(patch[k]);
          if (NUMERIC.has(k) && !Number.isFinite(v)) throw new HttpError(400, `${k} must be a number`);
          await t.query(
            `INSERT INTO app_setting (key, value, updated_at) VALUES ($1,$2,now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [k, JSON.stringify(v)]);
        }
      });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── reference data ───────────────────────────────────────────────── */

r.post("/people", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.name || !b.site) throw new HttpError(400, "A person needs a name and a site");
    let id = null;
    await audited(req.user,
      () => ({ action: "Person added", entity: "person", entityId: id, detail: b.name }),
      async (t) => {
        id = await allocateId(t, "PE", { pad: 2 });
        return t.query(
        `INSERT INTO person (id, name, job_role, site_id, day_rate,
                             employment, rotation, availability, supplier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, b.name, b.role ?? "", b.site, Number(b.rate ?? 0),
         b.employment === "contractor" ? "contractor" : "staff", b.rotation ?? "",
         b.availability === undefined ? 100 : Math.max(0, Math.min(100, Number(b.availability))),
         b.supplier ?? ""]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/**
 * Movers and leavers.
 *
 * A directory you can only add to is a directory that is wrong within a
 * month. People change role, change rate, move site and leave; all four
 * happen more often than a new joiner does.
 */
r.patch("/people/:id", async (req, res, next) => {
  try {
    const p = await one(`SELECT * FROM person WHERE id = $1`, [req.params.id]);
    if (!p) throw new HttpError(404, "No such person");
    const b = req.body ?? {};

    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.role !== undefined) patch.job_role = b.role;
    if (b.site !== undefined) patch.site_id = b.site;
    if (b.rate !== undefined) patch.day_rate = Number(b.rate);
    if (b.active !== undefined) patch.active = !!b.active;
    /* V-09 — rotation and availability are what make a headcount into a
       capacity, and a contractor is not a headcount at all. */
    if (b.employment !== undefined) patch.employment = b.employment === "contractor" ? "contractor" : "staff";
    if (b.rotation !== undefined) patch.rotation = b.rotation;
    if (b.availability !== undefined) {
      patch.availability = Math.max(0, Math.min(100, Math.round(Number(b.availability) || 0)));
    }
    if (b.supplier !== undefined) patch.supplier = b.supplier;
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing recognised to change");

    /* A leaver who still runs projects is a gap in the org chart, not a
       tidy-up. Name what would break rather than breaking it. */
    if (b.active === false) {
      const holds = await one(
        `SELECT
           (SELECT count(*) FROM project WHERE pm_id = $1 AND NOT closed)::int AS projects,
           (SELECT count(*) FROM meeting_action WHERE owner_id = $1
              AND status IN ('Open','In progress'))::int AS actions,
           (SELECT count(*) FROM raid_item WHERE owner_id = $1 AND status = 'Open')::int AS raid`,
        [p.id]);
      const blocking = [];
      if (holds.projects) blocking.push(`${holds.projects} live project${holds.projects === 1 ? "" : "s"} as PM`);
      if (holds.actions) blocking.push(`${holds.actions} open meeting action${holds.actions === 1 ? "" : "s"}`);
      if (holds.raid) blocking.push(`${holds.raid} open RAID item${holds.raid === 1 ? "" : "s"}`);
      if (blocking.length && !b.force) {
        throw new HttpError(409,
          `${p.name} still holds ${blocking.join(", ")}. Reassign those first, or resend with force to deactivate anyway.`);
      }
    }

    /* This was a direct UPDATE, on the grounds that `person` carried no
       row_version. It does now (migration 004), because the probe showed
       two administrators editing the same person both getting a 200 and
       one edit vanishing. */
    const out = await audited(req.user,
      { action: b.active === false ? "Person deactivated" : "Person updated",
        entity: "person", entityId: p.id,
        detail: `${p.name}: ${Object.keys(patch).join(", ")}`,
        before: { role: p.job_role, site: p.site_id, rate: Number(p.day_rate), active: p.active } },
      async (t) => updateVersioned(t, "person", p.id, requiredVersion(b, "person"), patch));
    if (!out.ok) throw new HttpError(409, "Someone else changed this person — reload and try again");
    res.json({ ok: true, version: out.version });
  } catch (e) { next(e); }
});

r.post("/sites", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.id || !b.city) throw new HttpError(400, "A site needs an identifier and a city");
    await audited(req.user,
      { action: "Site added", entity: "site", entityId: b.id, detail: b.city },
      async (t) => t.query(
        `INSERT INTO site (id, city, region, tz_offset, tz_name, headcount, fte, charter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [String(b.id).toUpperCase().slice(0, 5), b.city, b.region ?? "", Number(b.tz ?? 0),
         b.tzName ?? "UTC", Number(b.headcount ?? 0), Number(b.fte ?? 0), b.charter ?? ""]));
    res.status(201).json({ id: b.id });
  } catch (e) { next(e); }
});

r.post("/programmes", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.id || !b.name) throw new HttpError(400, "A programme needs an identifier and a name");
    if (/^SDP-/i.test(String(b.id))) {
      throw new HttpError(400, "The SDP- namespace is reserved for identifiers derived by the SDP sync");
    }
    await audited(req.user,
      { action: "Programme added", entity: "programme", entityId: b.id, detail: b.name },
      async (t) => t.query(
        `INSERT INTO programme (id, name, sponsor, manager_id) VALUES ($1,$2,$3,$4)`,
        [String(b.id).toUpperCase().slice(0, 5), b.name, b.sponsor ?? "", b.managerId ?? null]));
    res.status(201).json({ id: b.id });
  } catch (e) { next(e); }
});

r.patch("/columns/:id", async (req, res, next) => {
  try {
    const c = await one(`SELECT * FROM board_column WHERE id = $1`, [req.params.id]);
    if (!c) throw new HttpError(404, "No such column");
    const wip = Math.max(0, Math.min(99, Number(req.body?.wip ?? c.wip)));
    await audited(req.user,
      { action: "WIP limit changed", entity: "board_column", entityId: c.id,
        detail: `${c.name} → ${wip || "no limit"}` },
      async (t) => t.query(`UPDATE board_column SET wip = $2 WHERE id = $1`, [c.id, wip]));
    res.json({ ok: true, wip });
  } catch (e) { next(e); }
});

r.patch("/sites/:id", async (req, res, next) => {
  try {
    const s = await one(`SELECT * FROM site WHERE id = $1`, [req.params.id]);
    if (!s) throw new HttpError(404, "No such site");
    const b = req.body ?? {};
    const patch = {};
    if (b.city !== undefined) patch.city = b.city;
    if (b.region !== undefined) patch.region = b.region;
    if (b.tz !== undefined) patch.tz_offset = Number(b.tz);
    if (b.tzName !== undefined) patch.tz_name = b.tzName;
    if (b.headcount !== undefined) patch.headcount = Number(b.headcount);
    if (b.fte !== undefined) patch.fte = Number(b.fte);
    if (b.charter !== undefined) patch.charter = b.charter;
    /* A-12 — le référent du site : quelqu'un de l'annuaire, nommé, que
       l'aide affiche avant de proposer le groupe. */
    if (b.champion !== undefined) patch.champion_id = b.champion || null;
    if (b.active !== undefined) patch.active = !!b.active;
    /* V-07 — a site is a link and a state of readiness, not only a clock.
       These are what a rollout plan actually depends on. */
    if (b.linkMbps !== undefined) patch.link_mbps = b.linkMbps === "" || b.linkMbps === null ? null : Number(b.linkMbps);
    if (b.linkKind !== undefined) patch.link_kind = b.linkKind;
    if (b.readiness !== undefined) {
      if (!["Unknown", "Not ready", "Preparing", "Ready"].includes(b.readiness)) {
        throw new HttpError(400, "Readiness is Unknown, Not ready, Preparing or Ready");
      }
      patch.readiness = b.readiness;
    }
    if (b.readinessNote !== undefined) patch.readiness_note = b.readinessNote;
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing recognised to change");

    if (b.active === false) {
      const live = await one(
        `SELECT count(*)::int AS n FROM project WHERE site_id = $1 AND NOT closed`, [s.id]);
      if (live.n && !b.force) {
        throw new HttpError(409, `${s.city} still leads ${live.n} live project(s). Move them first.`);
      }
    }
    const out = await audited(req.user,
      { action: b.active === false ? "Site deactivated" : "Site updated",
        entity: "site", entityId: s.id, detail: `${s.city}: ${Object.keys(patch).join(", ")}` },
      async (t) => updateVersioned(t, "site", s.id, requiredVersion(b, "site"), patch));
    if (!out.ok) throw new HttpError(409, "Someone else changed this site — reload and try again");
    res.json({ ok: true, version: out.version });
  } catch (e) { next(e); }
});

r.patch("/programmes/:id", async (req, res, next) => {
  try {
    const g = await one(`SELECT * FROM programme WHERE id = $1`, [req.params.id]);
    if (!g) throw new HttpError(404, "No such programme");
    if (g.origin === "sdp") {
      throw new HttpError(403,
        "This programme is synchronised from the SDP roadmap — it is edited there, not in Meridian");
    }
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.sponsor !== undefined) patch.sponsor = b.sponsor;
    if (b.managerId !== undefined) patch.manager_id = b.managerId || null;
    if (b.active !== undefined) patch.active = !!b.active;
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing recognised to change");

    if (b.active === false) {
      const live = await one(
        `SELECT count(*)::int AS n FROM project WHERE programme_id = $1 AND NOT closed`, [g.id]);
      if (live.n && !b.force) {
        throw new HttpError(409, `${g.name} still holds ${live.n} live project(s). Close or move them first.`);
      }
    }
    const out = await audited(req.user,
      { action: b.active === false ? "Programme deactivated" : "Programme updated",
        entity: "programme", entityId: g.id, detail: `${g.name}: ${Object.keys(patch).join(", ")}` },
      async (t) => updateVersioned(t, "programme", g.id, requiredVersion(b, "programme"), patch));
    if (!out.ok) throw new HttpError(409, "Someone else changed this programme — reload and try again");
    res.json({ ok: true, version: out.version });
  } catch (e) { next(e); }
});

/* ── whole-book import and reset ──────────────────────────────────────
   R2.6 — a v4 JSON export must come back without loss. The import is
   deliberately destructive and deliberately administrator-only: it
   replaces the book, and the audit trail records that it happened.      */

r.post("/import", async (req, res, next) => {
  try {
    const book = req.body?.db;
    if (!book || !Array.isArray(book.projects)) {
      throw new HttpError(400, "No project register found in that file");
    }
    const { importBook } = await import("../import.js");
    const counts = await importBook(book, req.user);
    res.json({ ok: true, counts });
  } catch (e) { next(e); }
});

r.post("/reset", async (req, res, next) => {
  try {
    const { seed } = await import("../seed.js");
    const { loadSettings } = await import("../portfolio.js");
    const settings = await loadSettings().catch(() => ({}));
    await seed({ force: true, today: settings.statusDate ?? new Date().toISOString().slice(0, 10) });
    // The seed rebuilds the account table too, so this session is gone.
    res.json({ ok: true, note: "The opening book has been rebuilt. Sign in again." });
  } catch (e) { next(e); }
});

/* ── whole-book export (R2.6 counterpart) ─────────────────────────── */

r.get("/export", async (req, res, next) => {
  try {
    const { loadPortfolio } = await import("../portfolio.js");
    const db = await loadPortfolio(req.user);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition",
      `attachment; filename="meridian-${db.statusDate}.json"`);
    res.send(JSON.stringify(db, null, 2));
  } catch (e) { next(e); }
});

export default r;

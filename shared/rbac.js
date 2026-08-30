/**
 * Authorisation — the single gate (AD-2, R1.4).
 *
 * Every route asks `can(user, action, resource)`. Nothing else decides
 * authority. The browser imports a mirrored copy of this file purely to
 * choose what to render; if that copy is ever wrong the worst outcome is
 * an ugly screen, because the server asks again before it writes.
 *
 * ── The four levels (D-02) ────────────────────────────────────────
 *   admin   unrestricted, including users, grants and global settings
 *   group   portfolio-wide READ; WRITE inside granted programmes
 *   site    READ own sites + group-governed projects; WRITE only
 *           site-governed projects inside granted sites (R1.6)
 *   viewer  READ inside grants (or portfolio-wide when ungranted);
 *           WRITE nothing, ever (R1.5)
 *
 * A grant names one programme or one site. There is no wildcard grant —
 * "all" is a property of the admin role, never of a grant row (R1.3).
 */

export const ROLES = ["admin", "group", "site", "viewer"];

export const ACTIONS = [
  // read
  "portfolio.read", "project.read", "meeting.read", "audit.read",
  // portfolio writes
  "project.create", "project.write", "project.baseline", "project.gate",
  "project.close", "schedule.write", "raid.write", "document.write",
  "workitem.write", "allocation.write",
  // governance (2026-08-28 committee): approving gate evidence is a
  // separate power from editing documents, and a site may formally raise
  // a concern on a group programme landing on it.
  "document.approve", "concern.raise",
  // value (Endeavour committee, V-01): recording what a project promised
  // and what it measured is ordinary project work; deciding whether that
  // counts as delivered is not the deliverer's call.
  "benefit.write", "benefit.review",
  // V-02: closing a reporting period freezes what the board was told.
  "period.close",
  /* V-03/V-06/V-07: the site's own operational calendar and readiness,
     the rollout wave per site, and the management-of-change signature
     that releases intrusive work — which is never the delivery team's. */
  "window.write", "wave.write", "moc.approve",
  /* V-13/V-04: anyone who can write may ASK for something; deciding what
     the group will and will not do, and in what order, is group work. */
  "demand.raise", "demand.decide", "priority.write",
  /* R-02 : déclarer une absence et son suppléant est un fait du site,
     comme le calendrier des arrêts. */
  "absence.write",
  // money
  "cost.write", "contingency.release",
  // change control
  "change.raise", "change.approve",
  // meetings
  "meeting.write", "meeting.close", "series.manage",
  // system
  "user.manage", "settings.write", "data.export", "data.import",
];

const READ_ACTIONS = new Set([
  "portfolio.read", "project.read", "meeting.read", "audit.read", "data.export",
]);

/** Writes a site-level grant may never perform, whatever the project. */
const GROUP_ONLY_WRITES = new Set([
  "project.baseline",     // re-baselining moves the group's committed dates
  "cost.write",           // the ledger reconciles to the group GL (A5)
  "contingency.release",
  "data.import",
  /* V-01: the post-implementation verdict. The team that delivered the
     project measures the benefit; it does not get to rule on whether the
     benefit was met — that is the same independence the change and the
     gate-evidence controls already enforce. */
  "benefit.review",
  /* V-02: a period close is a portfolio-wide statement of what was
     reported. A site lead closes nothing on the group's behalf. */
  "period.close",
]);

/** Admin-only, full stop. */
const ADMIN_ONLY = new Set(["user.manage", "settings.write"]);

/* ── grant helpers ────────────────────────────────────────────────── */

/** Normalise the grant rows a user carries into two sets. */
export function normaliseGrants(rows = []) {
  const programmes = new Set();
  const sites = new Set();
  for (const g of rows) {
    if (g.scope_kind === "programme" && g.programme_id) programmes.add(g.programme_id);
    if (g.scope_kind === "site" && g.site_id) sites.add(g.site_id);
  }
  return { programmes, sites };
}

function grantsOf(user) {
  if (user?.grants instanceof Object && user.grants.programmes instanceof Set) return user.grants;
  return normaliseGrants(user?.grants ?? []);
}

/* ── visibility ───────────────────────────────────────────────────── */

/**
 * May this user see this project at all? Invisible is stronger than
 * read-only: an out-of-scope project is absent from list responses, not
 * greyed out in them (R1.10).
 */
export function canSeeProject(user, project) {
  if (!user || !project) return false;
  const { programmes, sites } = grantsOf(user);

  switch (user.role) {
    case "admin":
      return true;
    case "group":
      // Group level is portfolio visibility by design (A2, B1). Authority
      // is what the grant narrows, not sight.
      return true;
    case "site":
      // Own sites, plus every group-governed project read-only, so a site
      // lead can see the group programmes landing on them (C1).
      return sites.has(project.site_id) || project.governance_level === "group";
    case "viewer": {
      if (!programmes.size && !sites.size) return true; // ungranted observer
      return programmes.has(project.programme_id) || sites.has(project.site_id);
    }
    default:
      return false;
  }
}

/** May this user change this project's records? */
export function canWriteProject(user, project) {
  if (!user || !project) return false;
  if (user.role === "admin") return true;
  if (user.role === "viewer") return false;

  const { programmes, sites } = grantsOf(user);

  if (user.role === "group") return programmes.has(project.programme_id);

  if (user.role === "site") {
    // R1.6 — the load-bearing rule. A site grant over São Paulo does not
    // become authority over a group programme merely because that
    // programme happens to be delivered in São Paulo.
    if (project.governance_level === "group") return false;
    return sites.has(project.site_id);
  }
  return false;
}

/* ── scope objects (meetings, sites, programmes) ──────────────────── */

/**
 * A meeting series carries its own scope. Running one requires write
 * authority over that scope, which is not the same as over a project.
 */
export function canWriteScope(user, scope) {
  if (!user || !scope) return false;
  if (user.role === "admin") return true;
  if (user.role === "viewer") return false;
  const { programmes, sites } = grantsOf(user);

  switch (scope.scope_kind) {
    case "group":
      return user.role === "group" && programmes.size > 0;
    case "programme":
      return user.role === "group" && programmes.has(scope.programme_id);
    case "site":
      if (user.role === "site") return sites.has(scope.site_id);
      // A group user may run a site's series only where that site hosts a
      // project in one of their programmes — checked by the route, which
      // has the project list; here we allow and let the route narrow.
      return user.role === "group";
    default:
      return false;
  }
}

export function canSeeScope(user, scope) {
  if (!user || !scope) return false;
  if (user.role === "admin" || user.role === "group") return true;
  const { programmes, sites } = grantsOf(user);
  if (scope.scope_kind === "group") return true;
  if (scope.scope_kind === "site") return !sites.size || sites.has(scope.site_id);
  if (scope.scope_kind === "programme") return !programmes.size || programmes.has(scope.programme_id);
  return false;
}

/* ── identity, delegation included (R-02) ─────────────────────────────
   A deputy acts IN THE NAME OF the absent person. Every independence
   check therefore asks "is this one of the people at this keyboard?" —
   the deputy's own personId AND the absent person's. If the absent
   person could not decide their own request, their deputy cannot either;
   and the deputy cannot decide a request they themselves raised. */
export function selfMatch(user, personId) {
  if (!personId || !user) return false;
  if (user.personId && personId === user.personId) return true;
  if (user.actingForPersonId && personId === user.actingForPersonId) return true;
  return false;
}

/* ── the gate ─────────────────────────────────────────────────────── */

/**
 * @param user      { role, grants }
 * @param action    one of ACTIONS
 * @param resource  optional — { project } | { scope } | { cr, project, threshold }
 * @returns { ok: boolean, why: string }
 */
export function can(user, action, resource = {}) {
  if (!user) return deny("not authenticated — sign in again, your session may have ended");
  if (!user.active) return deny("account is disabled — an administrator can reactivate it from Administration");
  if (!ACTIONS.includes(action)) return deny(`unknown action "${action}"`);

  if (ADMIN_ONLY.has(action)) {
    return user.role === "admin" ? allow() : deny("administrator only — ask an account marked ADMIN on the sign-in directory");
  }

  if (user.role === "admin") return allow();

  // ── reads ───────────────────────────────────────────────────────
  if (READ_ACTIONS.has(action)) {
    if (action === "audit.read") {
      return user.role === "group" ? allow() : deny("audit is visible to group level and above — ask your programme office for what you need from it");
    }
    if (action === "project.read") {
      return canSeeProject(user, resource.project)
        ? allow()
        : deny("project is outside your scope — ask an administrator for a grant on its site or programme");
    }
    if (action === "meeting.read") {
      return canSeeScope(user, resource.scope) ? allow() : deny("meeting is outside your scope — its minutes are shared by whoever chairs it");
    }
    return allow(); // portfolio.read / data.export — narrowed by the query itself
  }

  // ── writes ──────────────────────────────────────────────────────
  if (user.role === "viewer") return deny("read-only account — ask an administrator to change the level if you are expected to record work here"); // R1.5

  if (GROUP_ONLY_WRITES.has(action) && user.role !== "group") {
    return deny("requires group-level authority — your programme office does this one");
  }

  switch (action) {
    case "project.create": {
      // Which kind of project may be created is decided by the level.
      const level = resource.governance_level ?? "site";
      if (user.role === "group") {
        const { programmes } = grantsOf(user);
        return programmes.has(resource.programme_id)
          ? allow()
          : deny("programme is outside your grant — ask an administrator to add it");
      }
      if (user.role === "site") {
        if (level === "group") return deny("site level cannot create a group project — create it at your site, or ask your programme office");
        const { sites } = grantsOf(user);
        return sites.has(resource.site_id) ? allow() : deny("site is outside your grant — ask an administrator to add it");
      }
      return deny("insufficient authority — your programme office holds this one");
    }

    case "change.approve": {
      const p = resource.project;
      if (!canWriteProject(user, p)) return deny("project is outside your authority — you can read it, and raise a concern on it if it lands on your site");
      /* Segregation of duties (governance committee, I1): the person who
         raised a request never decides it — level is not independence.
         Admin reaches this line only via the early-return above, so the
         break-glass exemption is structural and tested, not accidental. */
      if (selfMatch(user, resource.raised_by)) {
        return deny("you raised this request — a second pair of eyes decides it; ask a colleague with the same authority, or your programme office");
      }
      /* R4.5 — magnitude routes the decision, not the org chart alone.
         A MISSING threshold fails CLOSED (committee I4): un-parameterised
         governance escalates instead of silently waving everything
         through. Routes always pass the portfolio settings, so this only
         bites a caller that forgot them — exactly when it should. */
      const threshold = resource.threshold ?? {};
      const overCost = Math.abs(resource.cost_delta ?? 0) > (threshold.cost ?? 0);
      const overTime = Math.abs(resource.weeks_delta ?? 0) > (threshold.weeks ?? 0);
      if ((overCost || overTime) && user.role !== "group") {
        return deny("above the change-control threshold — group authority required; send it to your programme office to decide");
      }
      return allow();
    }

    case "document.approve": {
      /* Approving evidence is not editing it (committee I3). Two rules:
         the document's owner never approves their own work, and GATE
         evidence on a site-governed project needs group-level eyes —
         otherwise one person authors the evidence, approves it, and
         walks the gate. */
      const p = resource.project;
      if (!canWriteProject(user, p)) return deny("project is outside your authority — you can read it, and raise a concern on it if it lands on your site");
      if (selfMatch(user, resource.owner_id)) {
        return deny("you own this evidence — an independent reviewer approves it; hand it to a colleague or to your programme office");
      }
      if (resource.gate && p?.governance_level === "site" && user.role === "site") {
        return deny("gate evidence is approved at group level — ask your programme office");
      }
      return allow();
    }

    case "concern.raise": {
      /* The site's legitimate voice on a group programme landing on it
         (site committee, G3): create-only; the concern then flows through
         the ordinary RAID exposure/escalation machinery to steering. */
      const p = resource.project;
      if (!p) return deny("no project in scope — a concern is raised on a specific project");
      if (user.role !== "site") return deny("concerns are the site channel — you hold ordinary RAID authority here, so raise a risk or an issue directly");
      if (p.governance_level !== "group") return deny("this is a site project — raise an ordinary risk or issue on it instead");
      const { sites } = grantsOf(user);
      return sites.has(p.site_id)
        ? allow()
        : deny("this programme does not land on a site granted to you — concerns follow the work that reaches your site");
    }

    case "demand.raise":
      /* Asking is open to anyone who may write at all — a site lead who
         cannot raise a request has to phone someone, and the request then
         lives in that phone call rather than in the funnel. */
      return allow();

    case "demand.decide":
    case "priority.write":
      /* What the group will do, and in what order, against one envelope. */
      return user.role === "group"
        ? allow()
        : deny("the portfolio is prioritised at group level — your programme office scores and ranks");

    case "absence.write":
      /* Same shape as the shutdown calendar: the site keeps its own
         people's absences, group keeps any. Scoped by the person's SITE. */
    case "window.write": {
      /* The shutdown calendar is the site's own knowledge — the site lead
         keeps it for their sites, and group level keeps it anywhere. It
         is scoped by SITE, not by project, so it cannot fall through to
         the project-scoped default. */
      if (user.role === "group") return allow();
      if (user.role === "site") {
        const { sites } = grantsOf(user);
        return sites.has(resource.site_id)
          ? allow()
          : deny("that site is outside your grant — ask an administrator, or ask that site's lead to declare it");
      }
      return deny("insufficient authority — your programme office holds this one");
    }

    case "wave.write":
      // A rollout wave belongs to its project.
      return canWriteProject(user, resource.project)
        ? allow()
        : deny("project is outside your authority — you can read it, and raise a concern on it if it lands on your site");

    case "moc.approve": {
      /* The signature that releases intrusive work on a plant or
         safety-related system. Group level only, and never the project
         manager's own — the same independence the change and gate
         controls already enforce, applied where it matters most. */
      if (user.role !== "group") return deny("management of change is released at group level — ask your programme office to release it");
      if (selfMatch(user, resource.pm_id)) {
        return deny("you manage this project — management of change needs a second pair of eyes; ask your programme office");
      }
      return allow();
    }

    case "data.import":
      /* The latent trap this switch carried, finally sprung by R-09: a
         portfolio-wide action with no resource.project fell through to
         the project-scoped default and was denied even for group. */
    case "period.close":
      /* Portfolio-wide: there is no project to check, and the
         GROUP_ONLY_WRITES test above has already established group level
         or admin. Without this case it would fall to the project-scoped
         default and be refused for having no project in scope. */
      return allow();

    case "series.manage":
    case "meeting.write":
    case "meeting.close":
      return canWriteScope(user, resource.scope)
        ? allow()
        : deny("meeting scope is outside your authority — whoever chairs that room runs it");

    case "allocation.write": {
      // A site lead allocates their own site's people (C1); a group lead
      // allocates anyone into their programmes.
      if (user.role === "site") {
        const { sites } = grantsOf(user);
        if (resource.person && !sites.has(resource.person.site_id)) {
          return deny("person belongs to another site — their own site lead allocates them");
        }
      }
      return canWriteProject(user, resource.project)
        ? allow()
        : deny("project is outside your authority — you can read it, and raise a concern on it if it lands on your site");
    }

    default:
      // Every remaining write is project-scoped.
      return canWriteProject(user, resource.project)
        ? allow()
        : deny(
            resource.project
              ? resource.project.governance_level === "group" && user.role === "site"
                ? "this is a group-governed project — site level is read-only here; raise a concern on it and your programme office will see it"
                /* A-07 — les deux refus les plus fréquents du produit
                   étaient les deux derniers à ne dire que l'état. */
                : "project is outside your authority — you can read it, and raise a concern on it if it lands on your site"
              : "no project in scope — this act belongs to a project; open it from the portfolio first"
          );
  }
}

const allow = () => ({ ok: true, why: "" });
const deny = (why) => ({ ok: false, why });

/** Express guard. Resource is resolved by an earlier middleware. */
export function require$(action, resolve) {
  return async (req, res, next) => {
    try {
      const resource = resolve ? await resolve(req) : {};
      const verdict = can(req.user, action, resource);
      if (!verdict.ok) {
        return res.status(req.user ? 403 : 401).json({ error: verdict.why, action });
      }
      req.resource = resource;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** SQL fragment + params that narrow a project query to what a user may see. */
export function projectScopeSql(user, alias = "p") {
  if (!user) return { sql: "false", params: [] };
  if (user.role === "admin" || user.role === "group") return { sql: "true", params: [] };
  const { programmes, sites } = grantsOf(user);

  if (user.role === "site") {
    if (!sites.size) return { sql: `${alias}.governance_level = 'group'`, params: [] };
    return {
      sql: `(${alias}.site_id = ANY($1) OR ${alias}.governance_level = 'group')`,
      params: [[...sites]],
    };
  }
  // viewer
  if (!programmes.size && !sites.size) return { sql: "true", params: [] };
  return {
    sql: `(${alias}.programme_id = ANY($1) OR ${alias}.site_id = ANY($2))`,
    params: [[...programmes], [...sites]],
  };
}

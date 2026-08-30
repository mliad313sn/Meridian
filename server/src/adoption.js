/**
 * A-08 — LA MESURE DE L'ADOPTION.
 *
 * « Trois mois après la mise en service, personne ne saura dire si
 * l'outil est utilisé, par qui, ni où il a cessé de l'être. »
 *
 * Le comité d'adoption a raison sur le point le plus important : la
 * donnée existe déjà, entièrement. La piste est en ajout seul et
 * transactionnelle, les occurrences de comité portent leur état, les
 * décisions et les actions sont datées, les semaines saisies sont
 * horodatées. Ce qui manquait n'était pas la collecte, c'était la
 * lecture. Ce module ne collecte donc rien de nouveau : il lit.
 *
 * Six indicateurs, par site, ceux que la réserve nomme — pas cinq, pas
 * sept, et pas d'autres choisis pour faire joli. Un site sans activité
 * depuis trente jours est nommé, parce que le mode d'échec d'un outil de
 * gouvernance multi-sites est qu'un site reparte discrètement sur un
 * tableur et que rien ne le dise.
 *
 * Ce module ne lit que des agrégats par site. Il ne rend jamais une
 * ligne nominative : mesurer l'adoption d'un outil n'est pas surveiller
 * les gens qui s'en servent, et la frontière est ici, dans le SQL.
 */

import { many, query } from "./db.js";

/** Le seuil de silence, celui que la réserve a fixé. */
export const QUIET_DAYS = 30;

/**
 * Compter un usage, sans jamais dire qui.
 *
 * Volontairement sans `await` chez l'appelant : un compteur ne doit ni
 * ralentir une réponse, ni la faire échouer. Si l'écriture rate, on a
 * perdu un chiffre — jamais une action de quelqu'un.
 */
export function countUsage(kind) {
  query(
    `INSERT INTO usage_daily (day, kind, n) VALUES (CURRENT_DATE, $1, 1)
     ON CONFLICT (day, kind) DO UPDATE SET n = usage_daily.n + 1`, [kind]
  ).catch(() => { /* un comptage perdu ne vaut pas une erreur rendue */ });
}

export async function adoptionBySite({ windowDays = 30 } = {}) {
  const win = Math.max(1, Number(windowDays) || 30);

  const rows = await many(
    `WITH site_people AS (
       SELECT s.id AS site_id, s.city,
              count(DISTINCT p.id)::int AS people
         FROM site s
         LEFT JOIN person p ON p.site_id = s.id
        GROUP BY s.id, s.city
     ),
     /* Comptes ouverts et comptes vus récemment. Un compte se rattache à
        un site par sa personne ; un compte d'administration n'appartient
        à aucun site, et n'est donc compté nulle part plutôt que partout. */
     accounts AS (
       SELECT p.site_id,
              count(*) FILTER (WHERE u.active)::int AS opened,
              count(*) FILTER (WHERE u.active AND u.last_login_at > now() - ($1::int * interval '1 day'))::int AS seen
         FROM app_user u
         JOIN person p ON p.id = u.person_id
        GROUP BY p.site_id
     ),
     /* Le dernier avancement consigné : une étape mise à jour, un jalon
        franchi, un état forcé. C'est l'acte qui dit qu'un site tient
        encore son livre. */
     progress AS (
       SELECT pr.site_id,
              max(a.at) AS last_at
         FROM audit_event a
         JOIN project pr ON pr.id = a.entity_id
        WHERE a.entity = 'project'
           OR a.action IN ('Stage updated', 'Phase advanced', 'Milestone met', 'Health overridden')
        GROUP BY pr.site_id
     ),
     /* Les comités : planifiés contre réellement tenus dans l'outil. */
     meetings AS (
       SELECT s.site_id,
              count(*)::int AS planned,
              count(*) FILTER (WHERE o.status IN ('open', 'closed'))::int AS held
         FROM meeting_occurrence o
         JOIN meeting_series s ON s.id = o.series_id
        WHERE o.meets_on > (CURRENT_DATE - $1::int) AND o.meets_on <= CURRENT_DATE
          AND s.site_id IS NOT NULL
        GROUP BY s.site_id
     ),
     /* Les actions : ce qui est ouvert, ce qui est refermé. Une action
        qu'on ouvre sans jamais la clore dit quelque chose de l'usage. */
     actions AS (
       SELECT s.site_id,
              count(*)::int AS raised,
              count(*) FILTER (WHERE a.status IN ('Done', 'Cancelled'))::int AS closed
         FROM meeting_action a
         JOIN meeting_series s ON s.id = a.series_id
        WHERE a.created_at > now() - ($1::int * interval '1 day') AND s.site_id IS NOT NULL
        GROUP BY s.site_id
     ),
     /* Le réel saisi : semaines effectivement remplies, contre semaines
        attendues — une par personne du site et par semaine de la
        fenêtre. C'est volontairement grossier : l'absence de saisie est
        le signal, pas son exactitude. */
     weeks AS (
       SELECT p.site_id, count(DISTINCT (t.person_id, t.week_start))::int AS filled
         FROM timesheet t
         JOIN person p ON p.id = t.person_id
        WHERE t.week_start > (CURRENT_DATE - $1::int)
        GROUP BY p.site_id
     )
     SELECT sp.site_id, sp.city, sp.people,
            coalesce(ac.opened, 0) AS opened, coalesce(ac.seen, 0) AS seen,
            pg.last_at,
            coalesce(m.planned, 0) AS planned, coalesce(m.held, 0) AS held,
            coalesce(act.raised, 0) AS raised, coalesce(act.closed, 0) AS closed,
            coalesce(w.filled, 0) AS filled
       FROM site_people sp
       LEFT JOIN accounts ac ON ac.site_id = sp.site_id
       LEFT JOIN progress pg ON pg.site_id = sp.site_id
       LEFT JOIN meetings m  ON m.site_id  = sp.site_id
       LEFT JOIN actions act ON act.site_id = sp.site_id
       LEFT JOIN weeks w     ON w.site_id  = sp.site_id
      ORDER BY sp.site_id`, [win]);

  /* Les refus rencontrés. Ils ne laissent AUCUNE trace dans la piste, et
     c'était le bon choix — auditer chaque refus noierait le registre dont
     dépend le contrôle. Ils sont donc comptés à part, en agrégat par jour
     (021) : on sait combien, jamais qui.

     Et ils ne sont pas rattachables à un site : un refus survient sur une
     ressource HORS du périmètre de la personne, donc l'imputer au site de
     cette ressource dirait exactement le contraire de ce qu'on cherche.
     Ils valent pour le portefeuille, par utilisateur actif. */
  const refusals = await many(
    `SELECT coalesce(sum(n), 0)::int AS n FROM usage_daily
      WHERE kind = 'refusal' AND day > CURRENT_DATE - $1::int`, [win]);
  const activeUsers = await many(
    `SELECT count(*)::int AS n FROM app_user
      WHERE active AND last_login_at > now() - ($1::int * interval '1 day')`, [win]);

  const weeksInWindow = Math.max(1, Math.round(win / 7));
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  const daysSince = (at) => (at ? Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000) : null);

  const sites = rows.map((r) => {
    const quietFor = daysSince(r.last_at);
    return {
      site: r.site_id, city: r.city, people: r.people,
      /* 1 · comptes actifs sur comptes ouverts */
      accountsOpened: r.opened, accountsSeen: r.seen, accountsPct: pct(r.seen, r.opened),
      /* 2 · jours depuis la dernière mise à jour d'avancement */
      quietFor,
      quiet: quietFor === null || quietFor >= QUIET_DAYS,
      /* 3 · comités planifiés effectivement tenus */
      meetingsPlanned: r.planned, meetingsHeld: r.held, meetingsPct: pct(r.held, r.planned),
      /* 4 · actions closes sur actions ouvertes */
      actionsRaised: r.raised, actionsClosed: r.closed, actionsPct: pct(r.closed, r.raised),
      /* 5 · semaines saisies sur semaines attendues */
      weeksFilled: r.filled, weeksExpected: r.people * weeksInWindow,
      weeksPct: pct(r.filled, r.people * weeksInWindow),
    };
  });

  return {
    windowDays: win,
    asAt: new Date().toISOString().slice(0, 10),
    quietDays: QUIET_DAYS,
    sites,
    /* 6 · les refus, au portefeuille, par utilisateur actif */
    refusals: {
      total: refusals[0]?.n ?? 0,
      activeUsers: activeUsers[0]?.n ?? 0,
      perActiveUser: activeUsers[0]?.n
        ? Math.round(((refusals[0]?.n ?? 0) / activeUsers[0].n) * 10) / 10
        : null,
    },
    /* Nommés, parce que c'est le seul indicateur dont l'absence de
       réaction se remarque. */
    quietSites: sites.filter((s) => s.quiet).map((s) => s.site),
  };
}

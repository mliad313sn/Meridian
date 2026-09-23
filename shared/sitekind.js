/**
 * D-36.13 (docs/36, FitAdapt #18) — a site has a kind: `place` or `team`.
 *
 * A place is a location: it has a timezone, a plant calendar, rollout
 * waves, and it appears on the Locations view. A team is a delivery unit
 * with no geography — a squad — which is governed exactly like a site
 * (grants, site-governed projects, its own meetings, absences) and is
 * located nowhere. This module is the one place both the server and the
 * browser ask "is this a team" and "what time is it there", so the two
 * cannot drift.
 */

export const SITE_KINDS = ["place", "team"];

/** Anything that is not explicitly a team is a place — every site that
    existed before migration 060, and every book exported before it. */
export const isTeam = (s) => s?.kind === "team";
export const kindOf = (s) => (isTeam(s) ? "team" : "place");

/** The Locations view, the plant calendar and rollout waves read places only. */
export const placesOf = (sites) => (sites ?? []).filter((s) => !isTeam(s));
export const teamsOf = (sites) => (sites ?? []).filter(isTeam);

/**
 * The group default timezone. Meridian holds no group timezone setting;
 * UTC is the default every site carried before 060 (001's column
 * default), so it is what a computation falls back to when a team has no
 * timezone of its own. It is a fallback for arithmetic, never a claim that
 * the team is in UTC — the team's own `tz` stays null on the record.
 */
export const DEFAULT_TZ_OFFSET = 0;
export const DEFAULT_TZ_NAME = "UTC";

/** The offset to compute with: the site's own, or the group default. */
export const tzOffsetOf = (s) =>
  (s?.tz === null || s?.tz === undefined || s?.tz === "" || Number.isNaN(Number(s.tz)))
    ? DEFAULT_TZ_OFFSET : Number(s.tz);

/**
 * What the Locations view shows: the places, and how many teams it left
 * out, so a reader is told rather than left to wonder where a squad went.
 */
export function locations(db) {
  const sites = db?.sites ?? [];
  return { places: placesOf(sites), teams: teamsOf(sites) };
}

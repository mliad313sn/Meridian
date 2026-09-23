/**
 * D-36.13 — how a site is NAMED on screen, by its kind.
 *
 * A team (shared/sitekind.js) is governed like a site and located nowhere,
 * so wherever the interface puts the noun "Site" in front of one, it says
 * "Team" instead. A place is drawn exactly as before: these helpers return
 * the historical label for every place, so nothing existing changes.
 */
import { t } from "./i18n.js";
import { isTeam } from "../../../shared/sitekind.js";

/** "Site" or "Team", translated. */
export const unitNoun = (s) => (isTeam(s) ? t("Team") : t("Site"));

/** "Site · Kraków" / "Team · Payments squad" — for grant and scope pickers. */
export const unitLabel = (s) => unitNoun(s) + " · " + (s?.city ?? "");

/** The bare name, marked when it is a team: "Kraków" / "Payments squad · Team". */
export const unitName = (s) => (s ? (isTeam(s) ? s.city + " · " + t("Team") : s.city) : "");

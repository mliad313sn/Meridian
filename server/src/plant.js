/**
 * V-03 — le calendrier de l'usine, partagé entre l'écran et l'API
 * d'écriture : une bascule datée dans un gel de site est refusée au
 * moment où on la planifie, quel que soit le chemin par lequel elle
 * arrive (le conseiller code a trouvé le PUT de jalon sans ce contrôle).
 */
import { many } from "./db.js";
import { HttpError } from "./auth.js";

export async function freezesCovering(siteId, on) {
  if (!siteId || !on) return [];
  return many(
    `SELECT id, label, starts_on, ends_on FROM site_window
      WHERE site_id = $1 AND kind = 'freeze' AND $2 BETWEEN starts_on AND ends_on
      ORDER BY starts_on`, [siteId, on]);
}

export async function assertPlantWindow(project, { date, intrusive }) {
  if (!intrusive) return;
  if (project.plant_impact === "none" || !project.plant_impact) return;
  if (project.moc_approved_on) return;   // released; the window is theirs to use
  const hits = await freezesCovering(project.site_id, date);
  if (!hits.length) return;
  const w = hits[0];
  throw new HttpError(409,
    `${w.label} runs ${w.starts_on} to ${w.ends_on} at this site and this project is ` +
    `classified as ${project.plant_impact} work. Move the date, or have management of ` +
    `change release it at group level.`);
}

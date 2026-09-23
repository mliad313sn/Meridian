/**
 * A RAID review is an event (REQ-46, migration 050): one row per review
 * actually performed, and `raid_item.review_on` is the projection of the
 * latest row's `next_review_on`, never a substitute for it.
 *
 * Two doors record that event — the screen (routes/portfolio.js) and,
 * since REQ-51, the write contract (v1write.js). Both re-derive the due
 * date here, so they cannot disagree about what is next.
 */

import { updateVersioned } from "./db.js";

/**
 * La date de prochaine revue du registre, RECALCULÉE depuis les revues
 * qui subsistent.
 *
 * Elle s'écrit sous `updateVersioned` comme toute ligne mutable, mais la
 * version assertée est celle lue DANS la transaction et non celle que
 * l'appelant tenait : ce n'est pas une valeur qu'il a lue puis remplacée,
 * c'est une conséquence de l'événement qu'il vient d'inscrire. Ce que sa
 * version garde, c'est la revue elle-même (`requiredVersion` plus bas).
 *
 * `fallback` sert au retrait de la DERNIÈRE revue : la date qui redevient
 * due est celle que cette revue avait trouvée en place — sans quoi
 * annuler une revue laisserait le registre sans échéance du tout.
 */
export async function reprojectNextReview(t, itemId, fallback = null) {
  const cur = (await t.query(`SELECT row_version, review_on FROM raid_item WHERE id = $1`, [itemId])).rows[0];
  const last = (await t.query(
    `SELECT next_review_on FROM raid_review WHERE raid_id = $1
      ORDER BY reviewed_on DESC, recorded_at DESC, id DESC LIMIT 1`, [itemId])).rows[0];
  const next = last ? (last.next_review_on ?? null) : (fallback ?? null);
  if (String(cur.review_on ?? "") === String(next ?? "")) return next;   // rien n'a bougé
  await updateVersioned(t, "raid_item", itemId, cur.row_version, { review_on: next });
  return next;
}


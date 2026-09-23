/**
 * D-8 — ce qu'une décision a le droit de citer comme preuve.
 *
 * La règle était : une adresse http(s), et rien d'autre. Elle a une bonne
 * raison — une preuve qu'on ne peut pas atteindre n'en est pas une — et
 * elle a coûté cher au premier programme réel qui s'en est servi :
 *
 *   « Dix-neuf enregistrements de décision sont entrés avec un
 *     `evidenceUri` VIDE parce que la vraie preuve ne pouvait pas être
 *     exprimée. »  (RT365, rapport consolidé, D-8)
 *
 * Leur preuve n'est pas une page web : c'est un fichier versionné dans un
 * dépôt, à une révision — `docs/PRODUCT_OWNER.md v2.0`, ou un chemin à un
 * commit. Un produit de gouvernance qui n'accepte que ce qu'un navigateur
 * sait ouvrir demande à un programme régulé de mentir ou de se taire, et
 * il s'est tu.
 *
 * On élargit donc à ce qu'une trace de gouvernance cite réellement — et
 * PAS au-delà. Le refus reste, parce que la leçon D-10 du même rapport
 * est l'inverse : un 200 sur un corps que la route n'a pas compris
 * enseigne au demandeur qu'il a écrit quelque chose. Ce qui est refusé
 * ici est la prose : une phrase sans localisateur ne se retrouve pas.
 */

/** Un localisateur : une adresse, un chemin de dépôt, ou un commit. */
const HTTP = /^https?:\/\/\S+$/i;
/* Un chemin de dépôt : au moins un `/` ou une extension de fichier, et
   pas d'espace AVANT le localisateur. La révision, si elle suit, est
   libre — « v2.0 », « @a1b2c3d », « rev 4 » : c'est le vocabulaire du
   dépôt qui cite, et il n'est pas à nous de le normaliser. */
const PATH = /^[\w.@~-]+(?:\/[\w.@~+-]+)+(?:\.\w+)?(?:[@#][\w.\/-]+)?(?:\s+.{1,200})?$/;
const FILE = /^[\w.@~-]+\.\w{1,8}(?:[@#][\w.\/-]+)?(?:\s+.{1,200})?$/;
/* Un commit nu, ou un dépôt qui se nomme : `git:`, `repo:`, `commit:`. */
const NAMED = /^(git|repo|commit|artifact|run):\S/i;
const SHA = /^[0-9a-f]{7,40}(?:\s+.{1,200})?$/i;

export function isEvidenceLocator(v) {
  const u = String(v ?? "").trim();
  if (!u) return false;
  return HTTP.test(u) || NAMED.test(u) || PATH.test(u) || FILE.test(u) || SHA.test(u);
}

/**
 * Le refus, dans les mots de ce qu'il faut faire à la place. Un message
 * qui dit seulement « non » fait recommencer ; celui-ci dit quoi écrire.
 */
export const EVIDENCE_REFUSAL =
  "The evidence must be something a reader can find again: an http(s) address, a repository path " +
  "with an optional revision (docs/DECISION_LOG.md@a1b2c3d, or docs/PRODUCT_OWNER.md v2.0), a " +
  "commit, or a named locator (git:…, repo:…, commit:…, artifact:…, run:…). A sentence with no " +
  "locator in it cannot be found again, and is not evidence.";

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

/**
 * D-36.15 — the evidence a standing human act closes on.
 *
 * RT365's rule is "an action stays here until its evidence file exists",
 * so the locator is the same one a decision cites (above): an address, a
 * repository path at a revision, a commit, a named locator. When it is an
 * address, it is held to the rule gate evidence is approved by (R-01,
 * `documentHosts`): https, on a host somebody deliberately trusted, and
 * refused CLOSED when no host has been named — closing a blocking act
 * clears a gate, which is an approval in all but name.
 *
 * @returns {string|null} the refusal, or null when the locator stands.
 */
export function closureEvidenceRefusal(value, settings = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "A human act that blocks its gate closes on its evidence — give the locator of what shows it was done " +
      "(a repository path, a commit, or an address on a trusted document host)";
  }
  if (raw.length > 1000) return "That evidence locator is too long to be one";
  if (!isEvidenceLocator(raw)) return EVIDENCE_REFUSAL;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return null;
  let u;
  try { u = new URL(raw); } catch { return "The evidence link is not a valid URL"; }
  if (u.protocol !== "https:") return "An evidence link is served over https, or it is not a record";
  const hosts = String(settings.documentHosts ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) {
    return "No trusted document hosts are configured — name the group's document estate " +
      "(documentHosts, in Administration) before a link can close a human act, or cite a repository path";
  }
  const host = u.hostname.toLowerCase();
  if (!hosts.some((h) => host === h || host.endsWith("." + h))) {
    return `The evidence link points at ${host}, which is not a trusted document host`;
  }
  return null;
}

/**
 * D-36.15 — the whole rule for a register row that may hold its gate,
 * read on the row AS IT WILL BE after the write (`before` is the stored
 * row, or null on a create). One function for the screen route and the
 * contract, so the two cannot drift apart.
 *
 * @returns {string|null} the refusal, or null.
 */
export function humanActRefusal(before, after, settings = {}) {
  if (after.blocks_gate) {
    if (after.kind !== "Dependency") {
      return "Only a dependency can block its gate — a risk linked to a gate is read, never a lock (I-8)";
    }
    if (!after.project_id) return "A portfolio-wide item has no gate to block — name the project";
    if (!after.gate) return "A human act that blocks its gate names the gate it blocks";
  }
  const evidence = String(after.closure_evidence ?? "").trim();
  const evidenceChanged = !before || evidence !== String(before.closure_evidence ?? "").trim();
  const changed = evidenceChanged || after.status !== before.status
    || !!after.blocks_gate !== !!before.blocks_gate;
  if (!changed) return null;
  if (after.blocks_gate && after.status === "Closed") return closureEvidenceRefusal(evidence, settings);
  /* Evidence on any other row is optional, but when given it is still a
     locator: a sentence cannot be found again. */
  if (evidence && evidenceChanged) return closureEvidenceRefusal(evidence, settings);
  return null;
}

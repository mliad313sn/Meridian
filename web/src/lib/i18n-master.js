/**
 * docs/41 FX-15 — the labels of the programme master schedule and of the
 * typed cross-project links, in French and Spanish.
 *
 * Kept in their own module and spread at the head of FR and ES, as the
 * wave A2 labels are (i18n-plan.js), so the lines of docs/41 built in
 * parallel do not all write to the tail of the same two dictionaries. F5
 * reads the merged objects.
 */

export const MASTER_FR = {
  "Master schedule": "Planning maître",
  "projects": "projets",
  "between projects": "entre projets",
  "programme critical chain": "chaîne critique du programme",
  "links between projects": "liens entre projets",
  "as the project plans it": "tel que le projet le planifie",
  "Programme finish": "Fin du programme",
  "Critical chain": "Chaîne critique",
  "On its own": "Seul",
  "In the programme": "Dans le programme",
  "Pushed by links": "Repoussé par les liens",
  "Float consumed": "Marge consommée",
  "link(s) leave this programme or your scope and are not scheduled here.":
    "lien(s) sortent de ce programme ou de votre périmètre et ne sont pas planifiés ici.",
  "Link": "Lien",
  "Link type": "Type de lien",
  "Which ends of the two stages are tied: finish or start, then finish or start. FS by default.":
    "Les extrémités liées des deux étapes : fin ou début, puis fin ou début. FS par défaut.",
  "Lag (days)": "Décalage (jours)",
  "In the successor's working days; negative is a lead.": "En jours ouvrés du successeur ; négatif, c'est une avance.",
  "Edit the link": "Modifier le lien",
};

export const MASTER_ES = {
  "Master schedule": "Cronograma maestro",
  "projects": "proyectos",
  "between projects": "entre proyectos",
  "programme critical chain": "cadena crítica del programa",
  "links between projects": "vínculos entre proyectos",
  "as the project plans it": "tal como lo planifica el proyecto",
  "Programme finish": "Fin del programa",
  "Critical chain": "Cadena crítica",
  "On its own": "Por sí solo",
  "In the programme": "En el programa",
  "Pushed by links": "Desplazado por los vínculos",
  "Float consumed": "Holgura consumida",
  "link(s) leave this programme or your scope and are not scheduled here.":
    "vínculo(s) salen de este programa o de su alcance y no se planifican aquí.",
  "Link": "Vínculo",
  "Link type": "Tipo de vínculo",
  "Which ends of the two stages are tied: finish or start, then finish or start. FS by default.":
    "Los extremos unidos de las dos etapas: fin o inicio, luego fin o inicio. FS por defecto.",
  "Lag (days)": "Desfase (días)",
  "In the successor's working days; negative is a lead.": "En días laborables del sucesor; negativo es un adelanto.",
  "Edit the link": "Editar el vínculo",
};

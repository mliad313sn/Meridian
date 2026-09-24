/**
 * docs/41 wave A2 — the labels of the breakdown (FX-05), the Gantt (FX-06)
 * and the named baselines (FX-07), in French and Spanish.
 *
 * Kept in their own module and spread at the head of FR and ES, so the
 * waves of docs/41 built in parallel do not all write to the tail of the
 * same two dictionaries. A label the main dictionaries already hold
 * ("Stage", "Start", "Name"…) is not repeated here. F5 reads the merged
 * objects: every t() of gantt.js still needs both entries.
 */

export const PLAN_FR = {
  "— top level —": "— premier niveau —",
  "Move in the breakdown": "Déplacer dans l'organigramme",
  "Rolls up into": "Se récapitule dans",
  "A stage with stages under it is a summary: its figures come from them, it has no link, and its weight passes to the first stage put under it.":
    "Une étape qui a des étapes sous elle est récapitulative : ses chiffres viennent d'elles, elle n'a aucun lien, et son poids passe à la première étape placée sous elle.",
  "Move": "Déplacer",
  "Gantt": "Gantt",
  "stages": "étapes",
  "No stages to draw yet.": "Aucune étape à dessiner.",
  "critical": "critique",
  "summary": "récapitulative",
  "d": "j",
  "status date": "date d'état",
  "critical path": "chemin critique",
  "baseline": "référence",
  "Drag a bar, or focus it and press ← → then Enter.": "Glissez une barre, ou sélectionnez-la puis ← → et Entrée.",
  "Read only.": "Lecture seule.",
  "A newer version was saved — the bar is back where the book has it.":
    "Une version plus récente a été enregistrée — la barre est revenue là où le livre la place.",
  "Named baselines": "Références nommées",
  "Current plan": "Plan actuel",
  "Compare": "Comparer",
  "against": "avec",
  "named baselines kept": "références nommées conservées",
  "Take baseline": "Prendre une référence",
  "Read-only once taken. Taking one never moves the governed baseline.":
    "En lecture seule une fois prise. En prendre une ne déplace jamais la référence gouvernée.",
  "No named baseline yet.": "Aucune référence nommée.",
  "added since": "ajoutée depuis",
  "removed since": "retirée depuis",
  "Weight": "Poids",
  "What it is a picture of, e.g. “Approved plan”. Once per project.":
    "Ce dont c'est l'image, p. ex. « Plan approuvé ». Une fois par projet.",
  "Why it is being taken": "Pourquoi elle est prise",
  "Read by whoever compares against it later.": "Lu par quiconque s'y comparera plus tard.",
};

export const PLAN_ES = {
  "— top level —": "— primer nivel —",
  "Move in the breakdown": "Mover en el desglose",
  "Rolls up into": "Se resume en",
  "A stage with stages under it is a summary: its figures come from them, it has no link, and its weight passes to the first stage put under it.":
    "Una etapa con etapas debajo es de resumen: sus cifras vienen de ellas, no tiene vínculos, y su peso pasa a la primera etapa puesta debajo.",
  "Move": "Mover",
  "Gantt": "Gantt",
  "stages": "etapas",
  "No stages to draw yet.": "Aún no hay etapas que dibujar.",
  "critical": "crítica",
  "summary": "resumen",
  "d": "d",
  "status date": "fecha de estado",
  "critical path": "ruta crítica",
  "baseline": "línea base",
  "Drag a bar, or focus it and press ← → then Enter.": "Arrastre una barra, o selecciónela y pulse ← → y luego Intro.",
  "Read only.": "Solo lectura.",
  "A newer version was saved — the bar is back where the book has it.":
    "Se guardó una versión más reciente — la barra volvió a donde la tiene el libro.",
  "Named baselines": "Líneas base con nombre",
  "Current plan": "Plan actual",
  "Compare": "Comparar",
  "against": "con",
  "named baselines kept": "líneas base con nombre conservadas",
  "Take baseline": "Tomar línea base",
  "Read-only once taken. Taking one never moves the governed baseline.":
    "Solo lectura una vez tomada. Tomar una nunca mueve la línea base gobernada.",
  "No named baseline yet.": "Aún no hay líneas base con nombre.",
  "added since": "añadida desde entonces",
  "removed since": "retirada desde entonces",
  "Weight": "Peso",
  "What it is a picture of, e.g. “Approved plan”. Once per project.":
    "De qué es la imagen, p. ej. «Plan aprobado». Una vez por proyecto.",
  "Why it is being taken": "Por qué se toma",
  "Read by whoever compares against it later.": "Lo leerá quien se compare con ella más tarde.",
};

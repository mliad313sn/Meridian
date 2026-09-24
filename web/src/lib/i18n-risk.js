/**
 * docs/41 FX-11 and FX-16 — the labels of the schedule risk fold, the
 * three-point estimate and the printable schedule report, in French and
 * Spanish.
 *
 * Kept in their own module and spread at the head of FR and ES, like
 * i18n-plan.js, so the lines of docs/41 built in parallel do not all
 * write to the tail of the same two dictionaries. A label the main
 * dictionaries already hold is not repeated here.
 */

export const RISK_FR = {
  "All three durations, or none.": "Les trois durées, ou aucune.",
  "Optimistic ≤ most likely ≤ pessimistic.": "Optimiste ≤ probable ≤ pessimiste.",
  "Optimistic (days)": "Optimiste (jours)",
  "Three-point estimate for the schedule risk run: the shortest this stage could take. Working days under a calendar.":
    "Estimation à trois points pour l'analyse de risque : le plus court que cette étape puisse durer. En jours ouvrés sous un calendrier.",
  "Most likely (days)": "Probable (jours)",
  "The duration you would bet on.": "La durée sur laquelle vous parieriez.",
  "Pessimistic (days)": "Pessimiste (jours)",
  "The longest it could reasonably take. Empty, all three: the planned duration, fixed.":
    "Le plus long qu'elle puisse raisonnablement durer. Les trois vides : la durée planifiée, fixe.",
  "Schedule risk": "Risque de planning",
  "stages estimated": "étapes estimées",
  "triangular distribution": "loi triangulaire",
  "Run simulation": "Lancer la simulation",
  "Each run samples every estimated stage and reschedules the plan with its links and calendar. A stored run is read-only and never moves a date.":
    "Chaque tirage échantillonne chaque étape estimée et recalcule le plan avec ses liens et son calendrier. Un tirage conservé est en lecture seule et ne déplace aucune date.",
  "No stage carries three estimates yet — Edit stage › More detail.":
    "Aucune étape ne porte encore trois estimations — Modifier l'étape › Plus de détails.",
  "No simulation run yet.": "Aucune simulation lancée.",
  "Earlier runs": "Simulations précédentes",
  "Run": "Simulation",
  "Seed": "Graine",
  "Planned finish": "Fin planifiée",
  "seed": "graine",
  "runs": "tirages",
  "Finish date histogram": "Histogramme de la date de fin",
  "plan": "plan",
  "Criticality index": "Indice de criticité",
  "Runs": "Tirages",
  "How many times the plan is sampled — at most 10,000.": "Combien de fois le plan est tiré — 10 000 au plus.",
  "Empty: a new one. The same seed on the same plan gives the same result.":
    "Vide : une nouvelle. La même graine sur le même plan donne le même résultat.",
  "INTERNAL — Meridian IT-PMO schedule report": "INTERNE — rapport de planning Meridian IT-PMO",
  "issued to": "remis à",
  "share inside the group": "diffusion interne au groupe",
  "Schedule report": "Rapport de planning",
  "Language": "Langue",
  "The language the pack is printed in.": "La langue dans laquelle le dossier est imprimé.",
  "Named baseline": "Référence nommée",
  "— none —": "— aucune —",
  "Its dates are compared with the plan, beside the governed baseline.":
    "Ses dates sont comparées au plan, à côté de la référence gouvernée.",
  "None.": "Aucun.",
  "Baseline finish": "Fin de référence",
  "Critical path ends": "Fin du chemin critique",
  "no risk run": "aucune analyse de risque",
  "Milestones": "Jalons",
  "Date": "Date",
  "Float": "Marge",
  "Variance to the governed baseline": "Écart à la référence gouvernée",
  "Plan": "Plan",
  "Variance to a named baseline": "Écart à une référence nommée",
};

export const RISK_ES = {
  "All three durations, or none.": "Las tres duraciones, o ninguna.",
  "Optimistic ≤ most likely ≤ pessimistic.": "Optimista ≤ probable ≤ pesimista.",
  "Optimistic (days)": "Optimista (días)",
  "Three-point estimate for the schedule risk run: the shortest this stage could take. Working days under a calendar.":
    "Estimación de tres puntos para el análisis de riesgo: lo más corto que podría durar esta etapa. Días laborables bajo un calendario.",
  "Most likely (days)": "Probable (días)",
  "The duration you would bet on.": "La duración por la que apostaría.",
  "Pessimistic (days)": "Pesimista (días)",
  "The longest it could reasonably take. Empty, all three: the planned duration, fixed.":
    "Lo más largo que podría durar razonablemente. Las tres vacías: la duración planificada, fija.",
  "Schedule risk": "Riesgo del cronograma",
  "stages estimated": "etapas estimadas",
  "triangular distribution": "distribución triangular",
  "Run simulation": "Ejecutar la simulación",
  "Each run samples every estimated stage and reschedules the plan with its links and calendar. A stored run is read-only and never moves a date.":
    "Cada iteración muestrea cada etapa estimada y recalcula el plan con sus vínculos y su calendario. Una simulación guardada es de solo lectura y no mueve ninguna fecha.",
  "No stage carries three estimates yet — Edit stage › More detail.":
    "Ninguna etapa tiene aún tres estimaciones — Editar etapa › Más detalle.",
  "No simulation run yet.": "Aún no se ha ejecutado ninguna simulación.",
  "Earlier runs": "Simulaciones anteriores",
  "Run": "Simulación",
  "Seed": "Semilla",
  "Planned finish": "Fin planificado",
  "seed": "semilla",
  "runs": "iteraciones",
  "Finish date histogram": "Histograma de la fecha de fin",
  "plan": "plan",
  "Criticality index": "Índice de criticidad",
  "Runs": "Iteraciones",
  "How many times the plan is sampled — at most 10,000.": "Cuántas veces se muestrea el plan — 10 000 como máximo.",
  "Empty: a new one. The same seed on the same plan gives the same result.":
    "Vacía: una nueva. La misma semilla sobre el mismo plan da el mismo resultado.",
  "INTERNAL — Meridian IT-PMO schedule report": "INTERNO — informe de cronograma Meridian IT-PMO",
  "issued to": "entregado a",
  "share inside the group": "difusión interna del grupo",
  "Schedule report": "Informe de cronograma",
  "Language": "Idioma",
  "The language the pack is printed in.": "El idioma en que se imprime el dossier.",
  "Named baseline": "Línea base con nombre",
  "— none —": "— ninguna —",
  "Its dates are compared with the plan, beside the governed baseline.":
    "Sus fechas se comparan con el plan, junto a la línea base gobernada.",
  "None.": "Ninguno.",
  "Baseline finish": "Fin de la línea base",
  "Critical path ends": "Fin de la ruta crítica",
  "no risk run": "ningún análisis de riesgo",
  "Milestones": "Hitos",
  "Date": "Fecha",
  "Float": "Holgura",
  "Variance to the governed baseline": "Desviación respecto a la línea base gobernada",
  "Plan": "Plan",
  "Variance to a named baseline": "Desviación respecto a una línea base con nombre",
};

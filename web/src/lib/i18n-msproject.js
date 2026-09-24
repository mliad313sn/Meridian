/**
 * FX-13 (docs/41 wave D) — the labels of MS Project in and out, in French
 * and Spanish. Spread at the head of FR and ES like i18n-plan.js. The
 * import REPORT's sentences are not here: the server sends them in the
 * reader's language (server/src/i18n-mspdi.js), so they cost the bundle
 * nothing.
 */

export const MSP_FR = {
  "Tasks, links, calendar, resources and baselines, as MS Project reads them":
    "Tâches, liens, calendrier, ressources et références, tels que MS Project les lit",
  "Export to MS Project (.xml)": "Exporter vers MS Project (.xml)",
  "Import MS Project plan": "Importer un plan MS Project",
  "MS Project file (.xml)": "Fichier MS Project (.xml)",
  "Choose file…": "Choisir un fichier…",
  "In MS Project: File → Save As → XML. The file is checked first; nothing is written until you confirm.":
    "Dans MS Project : Fichier → Enregistrer sous → XML. Le fichier est d'abord vérifié ; rien n'est écrit avant votre confirmation.",
  "Check the file": "Vérifier le fichier",
  "The imported plan becomes a new project of this programme, with its gates.":
    "Le plan importé devient un nouveau projet de ce programme, avec ses jalons de gouvernance.",
  "Lead site": "Site pilote",
  "A calendar identical to the site's is inherited rather than copied.":
    "Un calendrier identique à celui du site est hérité plutôt que copié.",
  "Leave empty to keep the plan's own title.": "Laisser vide pour garder le titre du plan.",
  "Choose the XML file saved from MS Project.": "Choisissez le fichier XML enregistré depuis MS Project.",
  "What the import will do": "Ce que l'import va faire",
  "Nothing will be written until the blocking items are resolved.":
    "Rien ne sera écrit tant que les points bloquants ne sont pas levés.",
  "Import": "Importer",
  "Blocking": "Bloquant",
  "Ignored": "Ignoré",
  "Approximated": "Approché",
  "Mapped": "Repris",
  "milestones": "jalons",
  "links": "liens",
  "assignments": "affectations",
  "baselines": "références",
  "Project imported from MS Project": "Projet importé depuis MS Project",
  "Delivery method": "Méthode de livraison",
  "Budget ($M)": "Budget (M$)",
  "MS Project costs are not imported: the budget is the envelope earned value is measured against.":
    "Les coûts de MS Project ne sont pas importés : le budget est l'enveloppe contre laquelle la valeur acquise se mesure.",
};

export const MSP_ES = {
  "Tasks, links, calendar, resources and baselines, as MS Project reads them":
    "Tareas, vínculos, calendario, recursos y líneas base, tal como los lee MS Project",
  "Export to MS Project (.xml)": "Exportar a MS Project (.xml)",
  "Import MS Project plan": "Importar un plan de MS Project",
  "MS Project file (.xml)": "Archivo de MS Project (.xml)",
  "Choose file…": "Elegir un archivo…",
  "In MS Project: File → Save As → XML. The file is checked first; nothing is written until you confirm.":
    "En MS Project: Archivo → Guardar como → XML. Primero se verifica el archivo; nada se escribe hasta que usted confirme.",
  "Check the file": "Verificar el archivo",
  "The imported plan becomes a new project of this programme, with its gates.":
    "El plan importado se convierte en un nuevo proyecto de este programa, con sus puertas.",
  "Lead site": "Sitio líder",
  "A calendar identical to the site's is inherited rather than copied.":
    "Un calendario idéntico al del sitio se hereda en lugar de copiarse.",
  "Leave empty to keep the plan's own title.": "Déjelo vacío para conservar el título del plan.",
  "Choose the XML file saved from MS Project.": "Elija el archivo XML guardado desde MS Project.",
  "What the import will do": "Lo que hará la importación",
  "Nothing will be written until the blocking items are resolved.":
    "Nada se escribirá hasta que se resuelvan los puntos bloqueantes.",
  "Import": "Importar",
  "Blocking": "Bloqueante",
  "Ignored": "Ignorado",
  "Approximated": "Aproximado",
  "Mapped": "Retomado",
  "milestones": "hitos",
  "links": "vínculos",
  "assignments": "asignaciones",
  "baselines": "líneas base",
  "Project imported from MS Project": "Proyecto importado desde MS Project",
  "Delivery method": "Método de entrega",
  "Budget ($M)": "Presupuesto (M$)",
  "MS Project costs are not imported: the budget is the envelope earned value is measured against.":
    "Los costos de MS Project no se importan: el presupuesto es la envolvente contra la que se mide el valor ganado.",
};

/**
 * FX-13 — what the MS Project import TELLS the person importing, in
 * French and Spanish (the report's sentences, and the refusals of the two
 * routes). Spread into the server dictionaries of i18n.js and i18n-es.js,
 * like the client's i18n-plan.js: the waves of docs/41 do not all write
 * to the tail of the same two files.
 *
 * The report travels with its English sentence in the audit record (what
 * is RECORDED stays in one language, i18n.js); the answer to the person
 * is translated per request.
 */

export const MSPDI_FR = {
  "The file is not an MS Project XML (MSPDI) document": "Le fichier n'est pas un document XML de MS Project (MSPDI)",
  "The file is XML, but its root is not an MS Project <Project>": "Le fichier est du XML, mais sa racine n'est pas un <Project> de MS Project",
  "The file holds no task": "Le fichier ne contient aucune tâche",
  "The file holds more than 5000 tasks — split the plan": "Le fichier contient plus de 5000 tâches — découpez le plan",
  "The links form a loop — a plan with a loop has no start": "Les liens forment une boucle — un plan qui boucle n'a pas de début",
  "A link to or from a summary task — Meridian links the tasks under a summary, never the summary itself":
    "Un lien vers ou depuis une tâche récapitulative — Meridian lie les tâches sous une récapitulative, jamais la récapitulative elle-même",
  "A link to or from a milestone — a Meridian milestone carries no dependency link; its date is kept":
    "Un lien vers ou depuis un jalon — un jalon Meridian ne porte pas de lien de dépendance ; sa date est conservée",
  "A link to another project — not imported": "Un lien vers un autre projet — non importé",
  "A link to a task that is not in the file — not imported": "Un lien vers une tâche absente du fichier — non importé",
  "Elapsed lag — converted to whole days": "Décalage en temps écoulé — converti en jours entiers",
  "Lag given as a percentage — converted to whole days of the predecessor's duration":
    "Décalage en pourcentage — converti en jours entiers de la durée de la prédécesseure",
  "Lag of part of a day — rounded to whole days": "Décalage d'une fraction de jour — arrondi au jour",
  "Lag beyond ten years — not imported": "Décalage au-delà de dix ans — non importé",
  "Elapsed duration — kept as its dates; Meridian counts working days on the project calendar":
    "Durée en temps écoulé — conservée par ses dates ; Meridian compte les jours ouvrés du calendrier du projet",
  "Duration of part of a day — Meridian schedules in whole days": "Durée d'une fraction de jour — Meridian planifie en jours entiers",
  "As late as possible — imported as as soon as possible (Meridian has no ALAP)":
    "Dès que possible au plus tard — importée « dès que possible » (Meridian n'a pas d'ALAP)",
  "Constraint without a date — imported as as soon as possible": "Contrainte sans date — importée « dès que possible »",
  "Task calendar — ignored; the task follows the project calendar": "Calendrier de tâche — ignoré ; la tâche suit le calendrier du projet",
  "Inactive task — not imported": "Tâche inactive — non importée",
  "Milestone inside a summary — placed at project level (a Meridian milestone has no parent)":
    "Jalon sous une récapitulative — placé au niveau du projet (un jalon Meridian n'a pas de parent)",
  "Milestone with a duration — imported as a milestone on its start date": "Jalon avec une durée — importé comme jalon à sa date de début",
  "Summary with no task under it — imported as a plain task": "Récapitulative sans tâche dessous — importée comme tâche simple",
  "Milestone matched to the gate of the same name — the gate takes its date": "Jalon rapproché du jalon de gouvernance du même nom — celui-ci prend sa date",
  "Gate marked complete in the file — imported as not yet passed: passing a gate is a Meridian act, on its evidence":
    "Jalon de gouvernance achevé dans le fichier — importé comme non franchi : franchir un jalon est un acte Meridian, sur ses preuves",
  "Actual finish without an actual start — the planned start is taken as the actual start":
    "Fin réelle sans début réel — le début prévu est pris pour début réel",
  "Material resource — not imported (Meridian assigns people and roles)": "Ressource matérielle — non importée (Meridian affecte des personnes et des rôles)",
  "Cost resource — not imported": "Ressource de coût — non importée",
  "Resource cost rates — not imported; day rates live in Meridian's rate table (group level)":
    "Taux de coût des ressources — non importés ; les prix de jour vivent dans la table des taux de Meridian (niveau groupe)",
  "Resource calendar — not imported": "Calendrier de ressource — non importé",
  "Resource matched to a person in the directory": "Ressource rapprochée d'une personne de l'annuaire",
  "Resource not found in the directory — assigned as a role": "Ressource absente de l'annuaire — affectée comme rôle",
  "Several people in the directory carry this name — assigned as a role": "Plusieurs personnes de l'annuaire portent ce nom — affectée comme rôle",
  "Assignment units outside 1–200 % — clamped": "Unités d'affectation hors de 1–200 % — ramenées dans l'intervalle",
  "Assignment of a resource that is not imported — not imported": "Affectation d'une ressource non importée — non importée",
  "Assignment to a task or resource that is not in the file — not imported": "Affectation à une tâche ou une ressource absente du fichier — non importée",
  "Costs and fixed costs — not imported; Meridian's ledger holds costs": "Coûts et coûts fixes — non importés ; le grand livre de Meridian porte les coûts",
  "Task notes — not imported": "Notes de tâche — non importées",
  "Custom field — not imported": "Champ personnalisé — non importé",
  "Weights derived from durations — the file carries no Meridian weight": "Poids déduits des durées — le fichier ne porte pas de poids Meridian",
  "MS Project baseline imported as a named baseline": "Planification initiale MS Project importée comme référence nommée",
  "MS Project baselines carry no name — named after their number": "Les planifications initiales MS Project n'ont pas de nom — nommées d'après leur numéro",
  "Who took a baseline, when, why, and each stage's weight in it are not carried — the import is recorded instead, with today's weights":
    "Qui a pris une référence, quand, pourquoi, et le poids de chaque étape n'y sont pas portés — l'import est enregistré à la place, avec les poids du jour",
  "Project manager not found in the directory — none set": "Chef de projet absent de l'annuaire — aucun désigné",
  "Working hours within the day — not imported; Meridian schedules whole days": "Heures ouvrées dans la journée — non importées ; Meridian planifie en jours entiers",
  "Exception that makes a day a working one — not imported (Meridian holds non-working days only)":
    "Exception qui rend un jour ouvré — non importée (Meridian ne tient que des jours chômés)",
  "Recurring calendar exception — not imported; add its days to the calendar": "Exception de calendrier récurrente — non importée ; ajoutez ses jours au calendrier",
  "Contact not found in the directory — no owner set": "Contact absent de l'annuaire — aucun responsable désigné",
  "Working calendar identical to the one the project inherits — inherited": "Calendrier identique à celui dont le projet hérite — hérité",
  "Working calendar identical to an existing one — reused": "Calendrier identique à un calendrier existant — réutilisé",
  "New working calendar — created with the project": "Nouveau calendrier ouvré — créé avec le projet",
  "This working calendar does not exist in Meridian, and creating one needs group authority — ask your programme office to create it first":
    "Ce calendrier ouvré n'existe pas dans Meridian, et en créer un demande l'autorité de groupe — demandez à votre bureau de programme de le créer d'abord",
  "No working calendar in the file — calendar days": "Aucun calendrier ouvré dans le fichier — jours calendaires",
  "An imported plan becomes a project: choose its programme and its site": "Un plan importé devient un projet : choisissez son programme et son site",
  "Paste or choose the MS Project XML file (File → Save As → XML in MS Project)":
    "Choisissez le fichier XML de MS Project (Fichier → Enregistrer sous → XML dans MS Project)",
  "The project manager must be an active person in the directory": "Le chef de projet doit être une personne active de l'annuaire",
};
export const MSPDI_FR_PREFIX = [
  ["Nothing was imported — ", "Rien n'a été importé — "],
];

export const MSPDI_ES = {
  "The file is not an MS Project XML (MSPDI) document": "El archivo no es un documento XML de MS Project (MSPDI)",
  "The file is XML, but its root is not an MS Project <Project>": "El archivo es XML, pero su raíz no es un <Project> de MS Project",
  "The file holds no task": "El archivo no contiene ninguna tarea",
  "The file holds more than 5000 tasks — split the plan": "El archivo contiene más de 5000 tareas — divida el plan",
  "The links form a loop — a plan with a loop has no start": "Los vínculos forman un bucle — un plan con bucle no tiene inicio",
  "A link to or from a summary task — Meridian links the tasks under a summary, never the summary itself":
    "Un vínculo hacia o desde una tarea de resumen — Meridian vincula las tareas bajo un resumen, nunca el resumen",
  "A link to or from a milestone — a Meridian milestone carries no dependency link; its date is kept":
    "Un vínculo hacia o desde un hito — un hito de Meridian no lleva vínculo de dependencia; se conserva su fecha",
  "A link to another project — not imported": "Un vínculo a otro proyecto — no importado",
  "A link to a task that is not in the file — not imported": "Un vínculo a una tarea ausente del archivo — no importado",
  "Elapsed lag — converted to whole days": "Posposición transcurrida — convertida a días enteros",
  "Lag given as a percentage — converted to whole days of the predecessor's duration":
    "Posposición en porcentaje — convertida a días enteros de la duración de la predecesora",
  "Lag of part of a day — rounded to whole days": "Posposición de una fracción de día — redondeada al día",
  "Lag beyond ten years — not imported": "Posposición de más de diez años — no importada",
  "Elapsed duration — kept as its dates; Meridian counts working days on the project calendar":
    "Duración transcurrida — se conservan sus fechas; Meridian cuenta días laborables del calendario del proyecto",
  "Duration of part of a day — Meridian schedules in whole days": "Duración de una fracción de día — Meridian planifica en días enteros",
  "As late as possible — imported as as soon as possible (Meridian has no ALAP)":
    "Lo más tarde posible — importada como «lo antes posible» (Meridian no tiene ALAP)",
  "Constraint without a date — imported as as soon as possible": "Restricción sin fecha — importada como «lo antes posible»",
  "Task calendar — ignored; the task follows the project calendar": "Calendario de tarea — ignorado; la tarea sigue el calendario del proyecto",
  "Inactive task — not imported": "Tarea inactiva — no importada",
  "Milestone inside a summary — placed at project level (a Meridian milestone has no parent)":
    "Hito dentro de un resumen — ubicado a nivel de proyecto (un hito de Meridian no tiene padre)",
  "Milestone with a duration — imported as a milestone on its start date": "Hito con duración — importado como hito en su fecha de inicio",
  "Summary with no task under it — imported as a plain task": "Resumen sin tareas debajo — importado como tarea simple",
  "Milestone matched to the gate of the same name — the gate takes its date": "Hito emparejado con la puerta del mismo nombre — la puerta toma su fecha",
  "Gate marked complete in the file — imported as not yet passed: passing a gate is a Meridian act, on its evidence":
    "Puerta completada en el archivo — importada como no superada: superar una puerta es un acto de Meridian, sobre su evidencia",
  "Actual finish without an actual start — the planned start is taken as the actual start":
    "Fin real sin comienzo real — se toma el comienzo previsto como comienzo real",
  "Material resource — not imported (Meridian assigns people and roles)": "Recurso material — no importado (Meridian asigna personas y roles)",
  "Cost resource — not imported": "Recurso de costo — no importado",
  "Resource cost rates — not imported; day rates live in Meridian's rate table (group level)":
    "Tasas de costo de recursos — no importadas; las tarifas diarias viven en la tabla de tarifas de Meridian (nivel grupo)",
  "Resource calendar — not imported": "Calendario de recurso — no importado",
  "Resource matched to a person in the directory": "Recurso emparejado con una persona del directorio",
  "Resource not found in the directory — assigned as a role": "Recurso ausente del directorio — asignado como rol",
  "Several people in the directory carry this name — assigned as a role": "Varias personas del directorio tienen este nombre — asignado como rol",
  "Assignment units outside 1–200 % — clamped": "Unidades de asignación fuera de 1–200 % — ajustadas al intervalo",
  "Assignment of a resource that is not imported — not imported": "Asignación de un recurso no importado — no importada",
  "Assignment to a task or resource that is not in the file — not imported": "Asignación a una tarea o recurso ausente del archivo — no importada",
  "Costs and fixed costs — not imported; Meridian's ledger holds costs": "Costos y costos fijos — no importados; el libro mayor de Meridian lleva los costos",
  "Task notes — not imported": "Notas de tarea — no importadas",
  "Custom field — not imported": "Campo personalizado — no importado",
  "Weights derived from durations — the file carries no Meridian weight": "Pesos deducidos de las duraciones — el archivo no lleva peso de Meridian",
  "MS Project baseline imported as a named baseline": "Línea base de MS Project importada como línea base con nombre",
  "MS Project baselines carry no name — named after their number": "Las líneas base de MS Project no tienen nombre — nombradas por su número",
  "Who took a baseline, when, why, and each stage's weight in it are not carried — the import is recorded instead, with today's weights":
    "Quién tomó una línea base, cuándo, por qué, y el peso de cada etapa en ella no se transportan — se registra la importación, con los pesos de hoy",
  "Project manager not found in the directory — none set": "Director de proyecto ausente del directorio — ninguno asignado",
  "Working hours within the day — not imported; Meridian schedules whole days": "Horas laborables dentro del día — no importadas; Meridian planifica días enteros",
  "Exception that makes a day a working one — not imported (Meridian holds non-working days only)":
    "Excepción que hace laborable un día — no importada (Meridian solo guarda días no laborables)",
  "Recurring calendar exception — not imported; add its days to the calendar": "Excepción de calendario periódica — no importada; añada sus días al calendario",
  "Contact not found in the directory — no owner set": "Contacto ausente del directorio — sin responsable",
  "Working calendar identical to the one the project inherits — inherited": "Calendario idéntico al que hereda el proyecto — heredado",
  "Working calendar identical to an existing one — reused": "Calendario idéntico a uno existente — reutilizado",
  "New working calendar — created with the project": "Nuevo calendario laboral — creado con el proyecto",
  "This working calendar does not exist in Meridian, and creating one needs group authority — ask your programme office to create it first":
    "Este calendario laboral no existe en Meridian, y crearlo requiere autoridad de grupo — pida a su oficina de programa que lo cree primero",
  "No working calendar in the file — calendar days": "Ningún calendario laboral en el archivo — días naturales",
  "An imported plan becomes a project: choose its programme and its site": "Un plan importado se convierte en proyecto: elija su programa y su sitio",
  "Paste or choose the MS Project XML file (File → Save As → XML in MS Project)":
    "Elija el archivo XML de MS Project (Archivo → Guardar como → XML en MS Project)",
  "The project manager must be an active person in the directory": "El director de proyecto debe ser una persona activa del directorio",
};
export const MSPDI_ES_PREFIX = [
  ["Nothing was imported — ", "No se importó nada — "],
];

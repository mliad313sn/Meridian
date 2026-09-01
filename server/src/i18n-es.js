/**
 * Refus, aides et notifications du serveur — espagnol (I18N-02).
 *
 * BROUILLON au sens de la politique du comité (docs/29 §4) : traduit par
 * l'assistant, marqué draft au registre client jusqu'à relecture par un
 * locuteur natif sur un vrai déploiement. La terminologie suit le
 * dictionnaire client `web/src/lib/es.js` mot pour mot — puerta (jalon de
 * gouvernance), hito (jalon de plan), inquietud (préoccupation), gestión
 * del cambio, oficina de programa — parce qu'un refus serveur qui nomme
 * les choses autrement que l'écran qui l'affiche apprend le doute, pas la
 * règle.
 *
 * Même contrat que le français dans i18n.js : correspondance exacte
 * d'abord, préfixes ensuite pour les messages qui portent des données.
 */

export const ES = {
  // authority
  "not authenticated — sign in again, your session may have ended":
    "no autenticado — vuelva a iniciar sesión, su sesión puede haber expirado",
  "account is disabled — an administrator can reactivate it from Administration":
    "esta cuenta está desactivada — un administrador puede reactivarla desde Administración",
  "administrator only — ask an account marked ADMIN on the sign-in directory":
    "solo para administradores — acuda a una cuenta marcada ADMIN en el directorio de acceso",
  "read-only account — ask an administrator to change the level if you are expected to record work here":
    "cuenta de solo lectura — pida a un administrador cambiar el nivel si debe registrar trabajo aquí",
  "requires group-level authority — your programme office does this one":
    "requiere autoridad de nivel grupo — su oficina de programa se encarga de esto",
  "project is outside your authority — you can read it, and raise a concern on it if it lands on your site":
    "este proyecto está fuera de su autoridad — puede leerlo, y levantar una inquietud si llega a su sitio",
  "project is outside your scope — ask an administrator for a grant on its site or programme":
    "este proyecto está fuera de su ámbito — pida a un administrador un permiso sobre su sitio o programa",
  "programme is outside your grant — ask an administrator to add it":
    "este programa no le ha sido concedido — pida a un administrador que lo añada",
  "site is outside your grant — ask an administrator to add it":
    "este sitio no le ha sido concedido — pida a un administrador que lo añada",
  "that site is outside your grant — ask an administrator, or ask that site's lead to declare it":
    "ese sitio no le ha sido concedido — acuda a un administrador, o al responsable de ese sitio para que lo declare",
  "no project in scope — this act belongs to a project; open it from the portfolio first":
    "ningún proyecto en el ámbito — una inquietud se levanta sobre un proyecto concreto",
  "insufficient authority — your programme office holds this one":
    "autoridad insuficiente — su oficina de programa se ocupa de esto",
  "meeting scope is outside your authority — whoever chairs that room runs it":
    "este comité está fuera de su autoridad — quien preside esa sala lo dirige",
  "site level cannot create a group project — create it at your site, or ask your programme office":
    "el nivel sitio no puede crear un proyecto de grupo — créelo en su sitio, o acuda a su oficina de programa",
  "this is a group-governed project — site level is read-only here; raise a concern on it and your programme office will see it":
    "este proyecto se gobierna a nivel grupo — el nivel sitio es de solo lectura aquí; levante una inquietud y su oficina de programa la verá",
  "audit is visible to group level and above — ask your programme office for what you need from it":
    "la pista de auditoría es visible desde el nivel grupo — pida a su oficina de programa lo que necesite de ella",
  "the portfolio is prioritised at group level — your programme office scores and ranks":
    "la cartera se prioriza a nivel grupo — su oficina de programa puntúa y clasifica",
  "management of change is released at group level — ask your programme office to release it":
    "la gestión del cambio se libera a nivel grupo — pida la liberación a su oficina de programa",

  // independence — the controls people meet most often
  "you raised this request — a second pair of eyes decides it; ask a colleague with the same authority, or your programme office":
    "usted emitió esta solicitud — un segundo par de ojos la decide; acuda a un colega con la misma autoridad, o a su oficina de programa",
  "you own this evidence — an independent reviewer approves it; hand it to a colleague or to your programme office":
    "esta evidencia le pertenece — un revisor independiente la aprueba; entréguela a un colega o a su oficina de programa",
  "gate evidence is approved at group level — ask your programme office":
    "las evidencias de puerta se aprueban a nivel grupo — acuda a su oficina de programa",
  "you manage this project — management of change needs a second pair of eyes; ask your programme office":
    "usted dirige este proyecto — la gestión del cambio exige un segundo par de ojos; acuda a su oficina de programa",
  "above the change-control threshold — group authority required; send it to your programme office to decide":
    "por encima del umbral de control de cambios — se requiere autoridad de grupo; envíela a su oficina de programa para decidir",
  "concerns are the site channel — you hold ordinary RAID authority here, so raise a risk or an issue directly":
    "las inquietudes son el canal del sitio — usted dispone aquí de la autoridad RAID ordinaria: abra directamente un riesgo o un problema",
  "this is a site project — raise an ordinary risk or issue on it instead":
    "este es un proyecto de sitio — abra en él un riesgo o un problema ordinario",
  "this programme does not land on a site granted to you — concerns follow the work that reaches your site":
    "este programa no se despliega en ningún sitio que le haya sido concedido — una inquietud sigue al trabajo que llega a su sitio",

  "person belongs to another site — their own site lead allocates them":
    "esta persona pertenece a otro sitio — su propio responsable de sitio la asigna",

  // the things people are told they cannot do yet
  "Sign in to continue": "Inicie sesión para continuar",
  "This account has been disabled": "Esta cuenta ha sido desactivada",
  "Email or password is not recognised": "Correo o contraseña no reconocidos",
  "Email and password are required": "El correo y la contraseña son obligatorios",
  "The current password is not right": "La contraseña actual no es correcta",
  "Current and new password are both required":
    "La contraseña actual y la nueva son ambas obligatorias",
  "Password must be at least 8 characters":
    "La contraseña debe tener al menos 8 caracteres",
  "Choose your own password first — until you do, the trail cannot say this was you":
    "Elija primero su propia contraseña — sin eso, la pista de auditoría no puede acreditar que fue usted",
  "Someone else changed this record — reload and try again":
    "Otra persona modificó este registro — recargue e inténtelo de nuevo",
  "Nothing recognisable to change — check the field names":
    "Nada reconocible que modificar — compruebe los nombres de los campos",
  "No such project": "Proyecto no encontrado",
  "No such endpoint": "Punto de acceso inexistente",
  "Something went wrong on the server": "Se produjo un error en el servidor",
  "Entra sign-on is not configured on this instance":
    "El acceso con Entra no está configurado en esta instancia",
};

/** Prefix matches, for messages that carry data after a fixed opening. */
const ES_NOTIFY = {
  "Covering for ": "Cubriendo a ",
  "Overdue: ": "Atrasada: ",
  "Due ": "Vence ",
  "Raised in ": "Abierta en ",
  "This was due on ": "Se esperaba el ",
  "It is due on ": "Se espera el ",
  "Open Meridian to update or close it.": "Abra Meridian para actualizarla o cerrarla.",
  " gate document(s) outstanding": " documento(s) de puerta pendiente(s)",
  " cannot pass its next gate while ": " no puede pasar su próxima puerta mientras ",
  " evidence document(s) remain unapproved.": " documento(s) de evidencia siguen sin aprobar.",
  "Open the project's document list in Meridian.": "Abra la lista de documentos del proyecto en Meridian.",
};
Object.assign(ES, ES_NOTIFY);

export const ES_PREFIX = [
  ["Gate evidence needs its artefact",
    "La evidencia de puerta exige su artefacto"],
  ["No trusted document hosts are configured",
    "No hay ningún host documental de confianza configurado"],
  ["The evidence link points at ",
    "El enlace de la evidencia apunta a "],
  ["The evidence link is not a valid URL",
    "El enlace de la evidencia no es una URL válida"],
  ["An evidence link is served over https",
    "Un enlace de evidencia se sirve por https"],
  ["A verdict short of 'Met' needs a reason",
    "Un veredicto inferior a «Alcanzado» exige un motivo"],
  ["A gate override needs a reason",
    "Una derogación de puerta exige un motivo"],
  ["An override needs a reason",
    "Una derogación exige un motivo"],
  ["A decline needs its reason",
    "Un rechazo exige su motivo"],
  ["A release needs the management-of-change reference",
    "Una liberación exige la referencia de gestión del cambio"],
  ["Change the owner or approve the document",
    "Cambie el responsable o apruebe el documento — no ambos a la vez"],
];

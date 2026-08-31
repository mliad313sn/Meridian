/**
 * SERVER-SIDE FRENCH (V-10).
 *
 * The client dictionary could never reach these: a refusal message is
 * composed on the server, and it is also the audit record. So the same
 * literal-keyed approach is used here, with the locale taken per REQUEST
 * rather than from a browser setting — which is what made this the
 * deliberately-last tranche.
 *
 * Three rules, all deliberate:
 *
 *   · The English string is the key, so a missing translation degrades to
 *     English rather than to a broken token.
 *   · Only what the user is TOLD is translated. What is RECORDED stays in
 *     one language, because an audit trail that changes language with the
 *     reader's browser cannot be searched or compared.
 *   · Messages that carry data (dates, names, references) are matched on
 *     their fixed prefix, so the data passes through untouched.
 */

const FR = {
  // authority
  "not authenticated — sign in again, your session may have ended":
    "non authentifié — reconnectez-vous, votre session a peut-être expiré",
  "account is disabled — an administrator can reactivate it from Administration":
    "ce compte est désactivé — un administrateur peut le réactiver depuis Administration",
  "administrator only — ask an account marked ADMIN on the sign-in directory":
    "réservé à l'administrateur — voyez un compte marqué ADMIN dans l'annuaire de connexion",
  "read-only account — ask an administrator to change the level if you are expected to record work here":
    "compte en lecture seule — demandez à un administrateur de changer le niveau si vous devez consigner ici",
  "requires group-level authority — your programme office does this one":
    "nécessite une autorité de niveau groupe — votre bureau de programme s'en charge",
  "project is outside your authority — you can read it, and raise a concern on it if it lands on your site":
    "ce projet n'est pas dans votre périmètre d'autorité — vous pouvez le lire, et y ouvrir une préoccupation s'il atterrit sur votre site",
  "project is outside your scope — ask an administrator for a grant on its site or programme":
    "ce projet est hors de votre périmètre — demandez à un administrateur une habilitation sur son site ou son programme",
  "programme is outside your grant — ask an administrator to add it":
    "ce programme n'est pas dans vos habilitations — demandez à un administrateur de l'ajouter",
  "site is outside your grant — ask an administrator to add it":
    "ce site n'est pas dans vos habilitations — demandez à un administrateur de l'ajouter",
  "that site is outside your grant — ask an administrator, or ask that site's lead to declare it":
    "ce site n'est pas dans vos habilitations — voyez un administrateur, ou le responsable de ce site pour qu'il le déclare",
  "no project in scope — this act belongs to a project; open it from the portfolio first":
    "aucun projet dans le périmètre — une préoccupation s'ouvre sur un projet précis",
  "insufficient authority — your programme office holds this one":
    "autorité insuffisante — votre bureau de programme détient celle-ci",
  "meeting scope is outside your authority — whoever chairs that room runs it":
    "ce comité n'est pas dans votre périmètre d'autorité — celui qui préside cette salle l'anime",
  "site level cannot create a group project — create it at your site, or ask your programme office":
    "le niveau site ne peut pas créer un projet groupe — créez-le sur votre site, ou voyez votre bureau de programme",
  "this is a group-governed project — site level is read-only here; raise a concern on it and your programme office will see it":
    "ce projet est gouverné au niveau groupe — le niveau site y est en lecture seule ; ouvrez-y une préoccupation, votre bureau de programme la verra",
  "audit is visible to group level and above — ask your programme office for what you need from it":
    "la piste d'audit est visible à partir du niveau groupe — demandez à votre bureau de programme ce qu'il vous en faut",
  "the portfolio is prioritised at group level — your programme office scores and ranks":
    "le portefeuille est priorisé au niveau groupe — votre bureau de programme note et classe",
  "management of change is released at group level — ask your programme office to release it":
    "la maîtrise des modifications est levée au niveau groupe — demandez la levée à votre bureau de programme",

  // independence — the controls people meet most often
  "you raised this request — a second pair of eyes decides it; ask a colleague with the same authority, or your programme office":
    "vous avez émis cette demande — une seconde paire d'yeux la décide ; voyez un collègue de même autorité, ou votre bureau de programme",
  "you own this evidence — an independent reviewer approves it; hand it to a colleague or to your programme office":
    "cette preuve vous appartient — un relecteur indépendant l'approuve ; confiez-la à un collègue ou à votre bureau de programme",
  "gate evidence is approved at group level — ask your programme office":
    "les preuves de jalon sont approuvées au niveau groupe — voyez votre bureau de programme",
  "you manage this project — management of change needs a second pair of eyes; ask your programme office":
    "vous pilotez ce projet — la maîtrise des modifications exige une seconde paire d'yeux ; voyez votre bureau de programme",
  "above the change-control threshold — group authority required; send it to your programme office to decide":
    "au-dessus du seuil de contrôle des modifications — autorité groupe requise ; transmettez-la à votre bureau de programme",
  "concerns are the site channel — you hold ordinary RAID authority here, so raise a risk or an issue directly":
    "les préoccupations sont le canal du site — vous disposez ici de l'autorité RAID ordinaire : ouvrez directement un risque ou un problème",
  "this is a site project — raise an ordinary risk or issue on it instead":
    "ceci est un projet de site — ouvrez-y plutôt un risque ou un problème ordinaire",
  "this programme does not land on a site granted to you — concerns follow the work that reaches your site":
    "ce programme ne se déploie sur aucun site qui vous est habilité — une préoccupation suit le travail qui arrive chez vous",

  "person belongs to another site — their own site lead allocates them":
    "cette personne appartient à un autre site — son propre responsable de site l'affecte",

  // the things people are told they cannot do yet
  "Sign in to continue": "Connectez-vous pour continuer",
  "This account has been disabled": "Ce compte a été désactivé",
  "Email or password is not recognised": "Adresse ou mot de passe non reconnu",
  "Email and password are required": "L'adresse et le mot de passe sont requis",
  "The current password is not right": "Le mot de passe actuel est incorrect",
  "Current and new password are both required":
    "Le mot de passe actuel et le nouveau sont tous deux requis",
  "Password must be at least 8 characters":
    "Le mot de passe doit comporter au moins 8 caractères",
  "Choose your own password first — until you do, the trail cannot say this was you":
    "Choisissez d'abord votre propre mot de passe — sans cela, la piste d'audit ne peut attester qu'il s'agit de vous",
  "Someone else changed this record — reload and try again":
    "Quelqu'un d'autre a modifié cet enregistrement — rechargez puis réessayez",
  "No such project": "Projet introuvable",
  "No such endpoint": "Point d'accès inexistant",
  "Something went wrong on the server": "Une erreur est survenue sur le serveur",
  "Entra sign-on is not configured on this instance":
    "L'authentification Entra n'est pas configurée sur cette instance",
};

/** Prefix matches, for messages that carry data after a fixed opening. */
const FR_NOTIFY = {
  "Covering for ": "En couverture de ",
  "Overdue: ": "En retard : ",
  "Due ": "Échéance ",
  "Raised in ": "Ouverte dans ",
  "This was due on ": "Elle était attendue le ",
  "It is due on ": "Elle est attendue le ",
  "Open Meridian to update or close it.": "Ouvrez Meridian pour la mettre à jour ou la clore.",
  " gate document(s) outstanding": " document(s) de jalon en attente",
  " cannot pass its next gate while ": " ne peut pas franchir son prochain jalon tant que ",
  " evidence document(s) remain unapproved.": " document(s) de preuve restent non approuvés.",
  "Open the project's document list in Meridian.": "Ouvrez la liste des documents du projet dans Meridian.",
  /* O-2 — les cinq natures enfin émises. */
  "Decision owed: ": "Décision due : ",
  "Referred up from ": "Renvoyée au niveau supérieur depuis ",
  ", and not yet answered. It heads the agenda of ": ", et toujours sans réponse. Elle ouvre l'ordre du jour de ",
  " until a decision there answers it.": " jusqu'à ce qu'une décision y réponde.",
  "Concern from ": "Préoccupation de ",
  " raised this concern on ": " a signalé cette préoccupation sur ",
  ". It appears on your next agenda; the register holds the detail.": ". Elle paraît à votre prochain ordre du jour ; le registre porte le détail.",
  ": no progress recorded for 30 days": " : aucun avancement consigné depuis 30 jours",
  " has recorded no stage update, milestone or status call in thirty days. A quiet book usually means the tool has drifted, not the site.":
    " n'a consigné ni mise à jour d'étape, ni jalon, ni statut depuis trente jours. Un livre silencieux dit d'ordinaire que l'outil a décroché, pas le site.",
  "Open Adoption to see the site's indicators.": "Ouvrez Adoption pour lire les indicateurs du site.",
  "Last week's effort is not recorded": "L'effort de la semaine passée n'est pas consigné",
  "You were allocated to project work last week and no days are recorded. Four fields, once a week — the real sits beside the plan, and the gap is the point.":
    "Vous étiez affecté à du travail projet la semaine passée et aucun jour n'est consigné. Quatre champs, une fois par semaine — le réel s'affiche à côté du plan, et c'est l'écart qui compte.",
  "Your Meridian digest is ready": "Votre digest Meridian est prêt",
  "Everything that changed in your scope, in one page: open Reports, then the digest.":
    "Tout ce qui a changé dans votre périmètre, en une page : ouvrez Rapports, puis le digest.",
};
Object.assign(FR, FR_NOTIFY);

const FR_PREFIX = [
  ["Gate evidence needs its artefact",
    "La preuve de jalon exige son artefact"],
  ["No trusted document hosts are configured",
    "Aucun hôte documentaire de confiance n'est configuré"],
  ["The evidence link points at ",
    "Le lien de preuve pointe vers "],
  ["The evidence link is not a valid URL",
    "Le lien de preuve n'est pas une URL valide"],
  ["An evidence link is served over https",
    "Un lien de preuve est servi en https"],
  ["A verdict short of 'Met' needs a reason",
    "Un verdict inférieur à « Atteint » exige un motif"],
  ["A gate override needs a reason",
    "Une dérogation de jalon exige un motif"],
  ["An override needs a reason",
    "Une dérogation exige un motif"],
  ["A decline needs its reason",
    "Un refus exige son motif"],
  ["A release needs the management-of-change reference",
    "Une levée exige la référence de maîtrise des modifications"],
  ["Change the owner or approve the document",
    "Changez le responsable ou approuvez le document — pas les deux d'un coup"],
];

/**
 * The locale for THIS request. Explicit query beats the header, so a link
 * in a French email lands in French whatever the browser is set to.
 */
export function localeOf(req) {
  const q = String(req?.query?.lang ?? "").toLowerCase();
  if (q.startsWith("fr")) return "fr";
  if (q.startsWith("en")) return "en";
  /* The app's own toggle, sent as X-Lang. It cannot use Accept-Language:
     browsers forbid scripts from setting that header, so a French UI on
     an English browser would otherwise be answered in English. */
  const chosen = String(req?.headers?.["x-lang"] ?? "").toLowerCase();
  if (chosen.startsWith("fr")) return "fr";
  if (chosen.startsWith("en")) return "en";
  const header = String(req?.headers?.["accept-language"] ?? "").toLowerCase();
  return header.split(",")[0]?.trim().startsWith("fr") ? "fr" : "en";
}

/** Translate a user-facing message. Unknown strings pass through. */
export function say(message, locale) {
  if (locale !== "fr" || !message) return message;
  const exact = FR[message];
  if (exact) return exact;
  for (const [en, fr] of FR_PREFIX) {
    if (message.startsWith(en)) return fr + message.slice(en.length);
  }
  return message;
}

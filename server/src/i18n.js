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
  "not authenticated": "non authentifié",
  "account is disabled": "ce compte est désactivé",
  "administrator only": "réservé à l'administrateur",
  "read-only account": "compte en lecture seule",
  "requires group-level authority": "nécessite une autorité de niveau groupe",
  "project is outside your authority": "ce projet n'est pas dans votre périmètre d'autorité",
  "project is outside your scope": "ce projet est hors de votre périmètre",
  "programme is outside your grant": "ce programme n'est pas dans vos habilitations",
  "site is outside your grant": "ce site n'est pas dans vos habilitations",
  "that site is outside your grant": "ce site n'est pas dans vos habilitations",
  "no project in scope": "aucun projet dans le périmètre",
  "insufficient authority": "autorité insuffisante",
  "meeting scope is outside your authority": "ce comité n'est pas dans votre périmètre d'autorité",
  "site level cannot create a group project": "le niveau site ne peut pas créer un projet groupe",
  "this is a group-governed project — site level is read-only here":
    "ce projet est gouverné au niveau groupe — le niveau site y est en lecture seule",
  "audit is visible to group level and above":
    "la piste d'audit est visible à partir du niveau groupe",
  "the portfolio is prioritised at group level":
    "le portefeuille est priorisé au niveau groupe",
  "management of change is released at group level":
    "la maîtrise des modifications est levée au niveau groupe",

  // independence — the controls people meet most often
  "you raised this request — a second pair of eyes decides it":
    "vous avez émis cette demande — une seconde paire d'yeux la décide",
  "you own this evidence — an independent reviewer approves it":
    "cette preuve vous appartient — un relecteur indépendant l'approuve",
  "gate evidence is approved at group level — ask your programme office":
    "les preuves de jalon sont approuvées au niveau groupe — voyez votre bureau de programme",
  "you manage this project — management of change needs a second pair of eyes":
    "vous pilotez ce projet — la maîtrise des modifications exige une seconde paire d'yeux",
  "above the change-control threshold — group authority required":
    "au-dessus du seuil de contrôle des modifications — autorité groupe requise",
  "concerns are the site channel — you hold ordinary RAID authority here":
    "les préoccupations sont le canal du site — vous disposez ici de l'autorité RAID ordinaire",
  "this is a site project — raise ordinary RAID on it":
    "ceci est un projet de site — ouvrez-y un élément RAID ordinaire",
  "this programme does not land on a site granted to you":
    "ce programme ne se déploie sur aucun site qui vous est habilité",

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

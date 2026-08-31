/**
 * BILINGUAL UI — English / French (sponsor decision, 2026-08-28).
 *
 * The mechanism the adoption committee asked for: literal-keyed. The
 * English string IS the key; `t("Sign in")` returns "Se connecter" in
 * French and the English itself anywhere the dictionary has no entry —
 * so a missing translation degrades to English, never to a broken key,
 * and coverage grows view by view without a migration.
 *
 * Rules of the house:
 *   · wrap USER-FACING strings at the call site: t("...")
 *   · translate whole sentences, not fragments — French grammar does not
 *     assemble from English word order
 *   · server responses (errors, audit labels) stay English for now —
 *     they are also the audit record; a per-request locale is a later,
 *     deliberate step
 *   · dates keep their compact EN month forms for now (they are also in
 *     server-rendered minutes/packs, which carry no user locale)
 */

const KEY = "meridian-lang";

let lang = "en";
try { lang = localStorage.getItem(KEY) === "fr" ? "fr" : "en"; } catch { /* private window */ }

export function getLang() { return lang; }
export function setLang(l) {
  lang = l === "fr" ? "fr" : "en";
  try { localStorage.setItem(KEY, lang); } catch { /* session-local is fine */ }
  /* R-06 — the language of the DOCUMENT, not only of its strings. A
     screen reader pronounces from this attribute; leaving it at "en"
     reads French with English phonetics, which is unusable. */
  try { document.documentElement.lang = lang; } catch { /* no DOM in tests */ }
}
try { document.documentElement.lang = lang; } catch { /* no DOM in tests */ }

export function t(s) {
  if (lang !== "fr") return s;
  return FR[s] ?? s;
}

/* ── composed data fragments (R-15) ───────────────────────────────────
   Strings assembled around live numbers ("3 evidence items outstanding",
   "against $1.8M approved") never hit the dictionary as whole literals,
   which is exactly how a tile ends up half-French. tData() translates the
   FRAGMENTS by pattern, leaving the numbers alone. Applied to composed
   notes and to server-composed agenda text at render time. */
const FRAG = [
  [/\bbehind the plan\b/g, "en retard sur le plan"],
  [/\bahead of plan\b/g, "en avance sur le plan"],
  [/\bspending faster than earning\b/g, "dépense plus vite que la valeur acquise"],
  [/\bover the spend rate\b/g, "au-dessus du rythme de dépense"],
  [/\bunder the spend rate\b/g, "sous le rythme de dépense"],
  [/\binside the envelope\b/g, "dans l'enveloppe"],
  [/\bagainst budget\b/g, "contre le budget"],
  [/\bagainst\b/g, "contre"],
  [/\bapproved envelope\b/g, "enveloppe approuvée"],
  [/\bapproved\b/g, "approuvé"],
  [/(\d+) funded projects?\b/g, "$1 projet(s) financé(s)"],
  [/\bfunded\b/g, "financé(s)"],
  [/\bstrategy\b/g, "stratégie"],
  [/\bopen items?\b/g, "élément(s) ouvert(s)"],
  [/\bhighest exposure\b/g, "exposition maximale"],
  [/\bno data\b/g, "aucune donnée"],
  [/(\d+) evidence items? outstanding for\b/g, "$1 preuve(s) en attente pour"],
  [/\boutstanding\b/g, "en attente"],
  [/\bawaiting a decision\b/g, "en attente de décision"],
  [/\bawaiting\b/g, "en attente de"],
  [/\bof target\b/g, "de la cible"],
  [/\bnot yet measured\b/g, "pas encore mesuré"],
  [/\bacross the portfolio\b/g, "sur l'ensemble du portefeuille"],
  [/\bacross the horizon\b/g, "sur l'horizon"],
  [/\bacross the\b/g, "sur"],
  [/\bwas due\b/g, "était attendu le"],
  [/\bdue\b/g, "attendu"],
  [/\boverdue\b/gi, "en retard"],
  [/\(in (\d+) days?\)/g, "(dans $1 jours)"],
  [/\((\d+) days? ago\)/g, "(il y a $1 jours)"],
  [/(\d+)d late\b/g, "$1 j de retard"],
  [/\bforecast finish\b/g, "fin prévisionnelle"],
  [/\bevidence\b/g, "preuves"],
  [/\bprojects? below the red (SPI|CPI) line\b/g, "projet(s) sous la ligne rouge $1"],
  [/\bat steering level\b/g, "au niveau du comité de pilotage"],
  [/\babove the escalation threshold\b/g, "au-dessus du seuil d'escalade"],
  [/\bpeople\b/g, "personnes"],
  [/\bprojects\b/g, "projets"],
  [/(\d+) of (\d+) evidence items? approved\b/g, "$1 sur $2 preuve(s) approuvée(s)"],
  [/(\d+) of (\d+) evidence items?\b/g, "$1 sur $2 preuve(s)"],
  [/\bacross the whole book\b/g, "sur tout le portefeuille"],
  [/\bacross the book\b/g, "sur tout le portefeuille"],
  [/\bchange requests? awaiting a decision\b/g, "demande(s) de changement en attente de décision"],
  [/\brisks and issues in scope\b/g, "risques et problèmes du périmètre"],
  [/\bin scope\b/g, "dans le périmètre"],
  [/\bshown\b/g, "affiché(s)"],
  [/\bopen\b/g, "ouvert(s)"],
];
export function tData(s) {
  if (lang !== "fr" || !s) return s;
  const whole = FR[s];
  if (whole) return whole;
  let out = String(s);
  for (const [re, fr] of FRAG) out = out.replace(re, fr);
  return out;
}

/* ── the dictionary ─────────────────────────────────────────────────── */

export const FR = {
  // ── shell: navigation & titles
  "My week": "Ma semaine",
  "Portfolio": "Portefeuille",
  "Programmes": "Programmes",
  "My site": "Mon site",
  "Project overview": "Vue projet",
  "Schedule": "Planning",
  "Board": "Kanban",
  "Risks & issues": "Risques & problèmes",
  "Budget & cost": "Budget & coûts",
  "Change requests": "Demandes de changement",
  "Resources": "Ressources",
  "Meetings": "Réunions",
  "Documents": "Documents",
  "Reports": "Rapports",
  "Locations": "Sites",
  "Administration": "Administration",

  /* PM-01 · la marge et les dépassements */
  " past the margin — waiting on an answer": " au-delà de la marge — en attente de réponse",
  " waiting on an answer": " en attente de réponse",
  "Answer": "Répondre",
  "Answer this exception": "Répondre à cette exception",
  "Benefit (points below target)": "Bénéfice (points sous la cible)",
  "Change the margin": "Changer la marge",
  "Compares the estimate at completion with the budget.": "Compare le coût final estimé au budget.",
  "Cost (% over budget)": "Coût (% au-delà du budget)",
  "Dimension": "Dimension",
  "Exceptions": "Exceptions",
  "Measured / allowed": "Mesuré / permis",
  "Measured against the baseline finish, never against the current plan — otherwise moving the date would clear the breach.": "Mesuré contre la fin de référence, jamais contre le plan courant — sinon déplacer la date effacerait le dépassement.",
  "No margin, so nothing to exceed.": "Aucune marge, donc rien à dépasser.",
  "Nothing has gone past the margin. The hourly sweep checks on its own.": "Rien n'a franchi la marge. Le balayage horaire le vérifie tout seul.",
  "Read back by a committee months later. Say what was decided, not that a decision happened.": "Relu par un comité des mois plus tard. Dites ce qui a été décidé, pas qu'une décision a eu lieu.",
  "Record the answer": "Consigner la réponse",
  "Schedule (days past the baseline)": "Délai (jours au-delà de la référence)",
  "Scope, quality and risk — in words": "Périmètre, qualité et risque — en toutes lettres",
  "Set a margin": "Poser une marge",
  "Set the margin": "Poser la marge",
  "Set the margin for this project": "Poser la marge de ce projet",
  "Stated, not measured: ": "Énoncé, non mesuré : ",
  "The four answers the level that delegated the margin may give.": "Les quatre réponses que peut donner le niveau qui a accordé la marge.",
  "The margin this project works inside": "La marge dans laquelle ce projet travaille",
  "These three cannot be measured here. Stating them is honest; pretending to compute them would not be.": "Ces trois-là ne se mesurent pas ici. Les énoncer est honnête ; prétendre les calculer ne le serait pas.",
  "Tolerance & exceptions": "Tolérance et exceptions",
  "Watches the weakest benefit on the project, not the average — one missed benefit must not hide behind one exceeded.": "Surveille le bénéfice le plus faible du projet, pas la moyenne — un bénéfice manqué ne doit pas se cacher derrière un bénéfice dépassé.",
  "What was decided": "Ce qui a été décidé",
  "What was found": "Ce qui a été constaté",
  "Why": "Pourquoi",
  "Without a margin, authority is delegated without a bound: this project can drift and nothing will say so on its own. Only the programme office can set one.": "Sans marge, l'autorité est déléguée sans borne : ce projet peut dériver et rien ne le dira tout seul. Seul le bureau de programme peut en poser une.",
  "allowed": "permis",
  "inside the margin set for it": "dans la marge qui lui a été fixée",
  "no limit set": "aucune limite posée",
  "no margin set": "aucune marge posée",
  "nobody has set one": "personne n'en a posé",
  "none open": "aucune ouverte",
  "of": "sur",
  "past the margin": "au-delà de la marge",
  "set on ": "posée le ",
  "Tolerance raised": "Marge relevée",
  "Plan revised": "Plan révisé",
  "Accepted": "Dépassement accepté",
  "Stopped": "Projet arrêté",
  "Answered": "Répondue",
  "days": "jours",
  "points below target": "points sous la cible",

  /* INT-02 · les systèmes branchés */
  "A key is never stored — only its fingerprint. Every act it performs is recorded under the name you give it here, not as an anonymous system. Revoking one key never affects another.": "Une clé n'est jamais conservée — seulement son empreinte. Chaque acte qu'elle accomplit est consigné sous le nom que vous lui donnez ici, et non comme un « système » anonyme. Révoquer une clé n'affecte jamais les autres.",
  "Change what this key may do": "Changer ce que cette clé peut faire",
  "Connect a system": "Brancher un système",
  "Connected systems": "Systèmes branchés",
  "Copy it now": "Copiez-la maintenant",
  "I have copied it": "Je l'ai copiée",
  "Integrations": "Intégrations",
  "Issue a key": "Émettre une clé",
  "Issue a key when a system needs to read the portfolio. Until then, nothing outside can reach it.": "Émettez une clé quand un système a besoin de lire le portefeuille. D'ici là, rien de l'extérieur ne l'atteint.",
  "It stops working immediately. No other integration is affected.": "Elle cesse de fonctionner immédiatement. Aucune autre intégration n'est touchée.",
  "Key": "Clé",
  "Last used": "Dernier emploi",
  "May": "Peut",
  "Name": "Nom",
  "No system is connected": "Aucun système n'est branché",
  "One key per system, and each key says what it may do": "Une clé par système, et chaque clé dit ce qu'elle peut faire",
  "Read months later by whoever wonders whether this key can be revoked.": "Lu des mois plus tard par celui qui se demande si cette clé peut être coupée.",
  "Reading the connected systems…": "Lecture des systèmes branchés…",
  "Revoke": "Révoquer",
  "Revoke it": "Révoquer",
  "Revoke this key?": "Révoquer cette clé ?",
  "Revoked": "Révoquée",
  "Rotate": "Tourner",
  "Rotate it": "Tourner la clé",
  "Rotate this key?": "Tourner cette clé ?",
  "SAP — financial actuals": "SAP — réalisé financier",
  "The current key stops working the moment the new one is issued.": "La clé actuelle cesse de fonctionner à l'instant où la nouvelle est émise.",
  "The key for": "La clé de",
  "The new key for": "La nouvelle clé de",
  "The record stays, so the audit trail can still name what it wrote.": "L'enregistrement reste, pour que la piste sache encore nommer ce qu'elle a écrit.",
  "This is what the audit trail will show when it writes. Name the system, not the person.": "C'est ce que la piste d'audit affichera quand elle écrira. Nommez le système, pas la personne.",
  "This key is shown once and is not stored anywhere. If it is lost, rotate it — that is a normal thing to do, not a failure.": "Cette clé est montrée une seule fois et n'est conservée nulle part. Si elle est perdue, tournez-la — c'est un geste ordinaire, pas un échec.",
  "What it is for": "À quoi elle sert",
  "Whatever is using it will fail until it is given the new key.": "Ce qui s'en sert échouera tant qu'on ne lui aura pas donné la nouvelle clé.",
  "nothing — closed by default": "rien — fermé par défaut",

  /* PM-02 · le registre des enseignements */
  "Adopt": "Adopter",
  "Adopt it": "Adopter",
  "Adopt this lesson?": "Adopter cet enseignement ?",
  "Adopted": "Adopté",
  "All": "Tous",
  "All categories": "Toutes catégories",
  "Archived": "Archivé",
  "Avoid": "À éviter",
  "Category": "Catégorie",
  "Correct a lesson": "Corriger un enseignement",
  "Gate 4 asks for these as evidence. This is where they live.": "Le jalon 4 les exige comme preuve. C'est ici qu'ils vivent.",
  "In one sentence": "En une phrase",
  "It becomes readable at every site, including sites that cannot see the project it came from.": "Il devient lisible sur tous les sites, y compris ceux qui ne voient pas le projet dont il vient.",
  "Leave empty if it came up outside a gate, or at closure.": "À laisser vide s'il est apparu hors jalon, ou à la clôture.",
  "Lesson": "Enseignement",
  "Lessons": "Enseignements",
  "Lessons learned": "Enseignements tirés",
  "No lesson matches those filters.": "Aucun enseignement ne correspond à ces filtres.",
  "Not at a gate": "Hors jalon",
  "Nothing recorded yet. The first one usually comes out of a gate review.": "Rien de consigné pour l'instant. Le premier sort en général d'une revue de jalon.",
  "Proposed": "Proposé",
  "Raised at gate": "Relevé au jalon",
  "Record a lesson": "Consigner un enseignement",
  "Record it": "Consigner",
  "Repeat": "À refaire",
  "Required before the group can adopt it. Without this, it is an anecdote.": "Exigé avant que le groupe puisse l'adopter. Sans cela, c'est une anecdote.",
  "Search the register": "Chercher dans le registre",
  "Something to avoid": "Quelque chose à éviter",
  "Something to repeat": "Quelque chose à refaire",
  "That is the point of adopting it — and it is why only the programme office can.": "C'est tout l'objet de l'adoption — et c'est pourquoi seul le bureau de programme peut la prononcer.",
  "The cause, not the symptom — this is the part that transfers to another site.": "La cause, pas le symptôme — c'est la part qui se transporte sur un autre site.",
  "The facts, dated where you can. Not who is to blame.": "Les faits, datés autant que possible. Pas qui est en faute.",
  "The local supplier delivers in eight weeks, not four": "Le fournisseur local livre en huit semaines, pas en quatre",
  "The project that lived it. The lesson keeps its programme and site even after that project is gone.": "Le projet qui l'a vécu. L'enseignement garde son programme et son site même quand ce projet n'est plus là.",
  "Waiting on the programme office": "En attente du bureau de programme",
  "What happened": "Ce qui s'est passé",
  "What kind": "De quelle nature",
  "What someone scanning the register needs to recognise it by.": "Ce à quoi on le reconnaîtra en parcourant le registre.",
  "What to do differently": "Ce qu'il faut faire autrement",
  "What worked is worth recording as much as what failed — a register of failures alone is never re-read.": "Ce qui a marché vaut d'être consigné autant que ce qui a raté — un registre d'échecs seuls n'est jamais relu.",
  "Where it will be looked for later — the area the next project will be worrying about.": "Là où on ira le chercher plus tard — le domaine qui préoccupera le prochain projet.",
  "Why it happened": "Pourquoi c'est arrivé",
  "Worth repeating": "À refaire",
  "gate": "jalon",
  "no recommendation — cannot be adopted": "sans recommandation — ne peut pas être adopté",
  "nothing waiting": "rien en attente",
  "of the adopted ones": "parmi les adoptés",
  "proposed, not yet published": "proposés, pas encore publiés",
  "readable at every site": "lisibles sur tous les sites",
  "Scope": "Périmètre",
  "Quality": "Qualité",
  "Stakeholders": "Parties prenantes",
  "Procurement": "Achats",
  "Governance": "Gouvernance",
  "Technical": "Technique",
  "Transition": "Transition",

  /* M-01 · continuité — emporter le livre, ou fermer toutes les portes */
  "Continuity": "Continuité",
  "take the book with you, or close every door":
    "emporter le livre, ou fermer toutes les portes",
  "The archive holds the portfolio and the audit trail in one open file, which is loaded elsewhere with npm run restore. It carries no password, so it can be handed to a third party as it is. It is not a backup — a backup is taken at the database.":
    "L'archive contient le portefeuille et la piste d'audit dans un seul fichier ouvert, " +
    "qui se recharge ailleurs avec npm run restore. Elle ne porte aucun mot de passe : elle " +
    "peut donc être remise telle quelle à un tiers. Ce n'est pas une sauvegarde — une " +
    "sauvegarde se prend au niveau de la base.",
  "Export the archive": "Exporter l'archive",
  "Archive": "Archive",
  "Archive exported": "Archive exportée",
  "The book and the trail, in one file.": "Le livre et la piste, dans un seul fichier.",
  "End every session?": "Terminer toutes les sessions ?",
  "Everyone signs in again, including you, immediately.":
    "Tout le monde se reconnecte, vous compris, immédiatement.",
  "This is the answer to a workstation left open or a doubt about a password — not a button to try.":
    "C'est la réponse à un poste laissé ouvert ou à un doute sur un mot de passe — " +
    "pas un bouton qu'on essaie.",
  "End every session": "Terminer toutes les sessions",
  "Sessions": "Sessions",
  "Sessions ended": "Sessions terminées",
  "session(s) — sign in again.": "session(s) — reconnectez-vous.",

  "Deliver": "Livrer",
  "Control": "Piloter",
  "Govern": "Gouverner",
  "Record": "Consigner",
  "System": "Système",
  "Executive portfolio view": "Vue exécutive du portefeuille",
  "Programme governance": "Gouvernance des programmes",
  "Integrated master schedule": "Planning directeur intégré",
  "Work board": "Tableau de travail",
  "Budget & earned value": "Budget & valeur acquise",
  "Resource capacity": "Capacité des ressources",
  "Meetings & decisions": "Réunions & décisions",
  "Document library": "Bibliothèque documentaire",
  "Status reporting": "Rapports d'avancement",
  "Delivery locations": "Sites de livraison",
  "Governance & administration": "Gouvernance & administration",
  "Portfolio management office": "Bureau de gestion de portefeuille",
  "Sections": "Sections",
  "Sign out": "Se déconnecter",
  "Search everything (Ctrl-K)": "Tout rechercher (Ctrl-K)",
  "Help — how Meridian works": "Aide — comment fonctionne Meridian",
  "Help": "Aide",

  // ── login & first-run
  "Sign in": "Se connecter",
  "Signing in…": "Connexion…",
  "Email": "Adresse e-mail",
  "Password": "Mot de passe",
  "Group IT portfolio management office": "Bureau groupe de gestion du portefeuille IT",
  "Every action you take is recorded against your name and scoped to the sites and programmes you hold.":
    "Chaque action est enregistrée à votre nom et limitée aux sites et programmes qui vous sont confiés.",
  "Accounts on this instance": "Comptes de cette instance",
  "Who can sign in": "Qui peut se connecter",
  "Could not reach the server": "Impossible de joindre le serveur",
  "Choose your own password": "Choisissez votre propre mot de passe",
  "First sign-in": "Première connexion",
  "The password you were given": "Le mot de passe qui vous a été remis",
  "Your new password (8+ characters)": "Votre nouveau mot de passe (8 caractères min.)",
  "Set password": "Définir le mot de passe",
  "Password changed": "Mot de passe modifié",
  "It is yours now": "Il est à vous désormais",
  "Start here": "Par où commencer",
  "Welcome to Meridian": "Bienvenue dans Meridian",
  "Don't show this again": "Ne plus afficher",
  "You hold the whole system: accounts, grants, sites and programmes live under Administration. If this book is empty, the Portfolio view shows you the setup path.":
    "Vous tenez tout le système : comptes, habilitations, sites et programmes vivent sous Administration. Si le portefeuille est vide, la vue Portefeuille vous montre le chemin de mise en route.",
  "You govern programmes: start at Programmes for your slate's health and decisions owed, and chair your series under Meetings. Money and baselines are yours alone.":
    "Vous gouvernez des programmes : commencez par Programmes pour la santé de votre périmètre et les décisions en attente, et animez vos séries sous Réunions. L'argent et les références de base ne relèvent que de vous.",
  "Your site is the centre: My site shows what you run, what the group lands on you, and your people's load. Update progress from a project's Stage plan — and raise a concern on any group project at your site.":
    "Votre site est le centre : Mon site montre ce que vous pilotez, ce que le groupe fait atterrir chez vous, et la charge de vos équipes. Mettez l'avancement à jour depuis le plan d'étapes d'un projet — et signalez une préoccupation sur tout projet groupe implanté chez vous.",
  "You read everything in your scope. Portfolio for the headline, Reports for the narrative — nothing here will let you change a record.":
    "Vous lisez tout ce qui entre dans votre périmètre. Portefeuille pour l'essentiel, Rapports pour le narratif — rien ici ne vous laissera modifier un enregistrement.",
  "Ctrl-K searches everything; the ? button in the header explains how health, gates and scope work.":
    "Ctrl-K recherche partout ; le bouton ? de l'en-tête explique la santé, les jalons de contrôle et les périmètres.",

  // ── common controls
  "Cancel": "Annuler",
  "Save": "Enregistrer",
  "Saving…": "Enregistrement…",
  "Refreshing the book": "Actualisation du portefeuille",

  // ── value realisation (V-01)
  "Value": "Valeur",
  "Benefit": "Bénéfice",
  "Benefits promised": "Bénéfices promis",
  "State a benefit": "Énoncer un bénéfice",
  "Edit benefit": "Modifier le bénéfice",
  "Remove benefit": "Retirer le bénéfice",
  "Benefit added": "Bénéfice ajouté",
  "Benefit updated": "Bénéfice mis à jour",
  "Benefit removed": "Bénéfice retiré",
  "not yet measured": "pas encore mesuré",
  "measured ": "mesuré ",
  " of target": " de la cible",
  "nothing promised yet": "rien de promis pour l'instant",
  "This project has no stated benefit. ": "Ce projet n'énonce aucun bénéfice. ",
  "Type": "Type",
  "Measure": "Mesure",
  "Unit": "Unité",
  "Baseline": "Référence",
  "Target": "Cible",
  "Measured actual": "Valeur mesurée",
  "Benefit owner": "Responsable du bénéfice",
  "Realised by": "Réalisé pour le",
  "Measured on": "Mesuré le",
  "How it will be measured": "Comment il sera mesuré",
  "Where it stands today": "Où cela en est aujourd'hui",
  "Post-implementation review": "Revue post-mise en œuvre",
  "Record the post-implementation review": "Enregistrer la revue post-mise en œuvre",
  "Revise verdict": "Réviser le verdict",
  "Verdict": "Verdict",
  "Reason": "Motif",
  "Met": "Atteint",
  "Partly met": "Partiellement atteint",
  "Missed": "Non atteint",
  "Review recorded": "Revue enregistrée",
  "Measured": "Mesuré",
  "Attainment": "Atteinte",
  "Value position": "Position de valeur",
  "Promising nothing": "Sans bénéfice énoncé",
  "projects with no stated benefit": "projets sans bénéfice énoncé",
  "Value promised": "Valeur promise",

  // ── the reported record (V-02)
  "Close the period": "Clôturer la période",
  "Close the reporting period": "Clôturer la période de reporting",
  "Record of record": "Enregistrement de référence",
  "Reported period": "Période publiée",
  "Live — as the book stands now": "En direct — état actuel du portefeuille",
  "Reported figures — frozen at close, not recalculated":
    "Chiffres publiés — figés à la clôture, non recalculés",
  "Period closed": "Période clôturée",
  "Restates": "Rectifie",
  "Nothing — an ordinary close": "Rien — une clôture ordinaire",
  "Note for the record": "Note pour le dossier",
  "Closed ": "Clôturée le ",
  " by ": " par ",
  " · as at ": " · à la date du ",
  " project(s)": " projet(s)",
  " · restates ": " · rectifie ",
  " · restatement": " · rectification",

  // ── plant, sites and rollout (V-03 / V-06 / V-07)
  "Plant & rollout": "Installations & déploiement",
  "Classify": "Classifier",
  "What does this reach into?": "Qu'est-ce que cela touche ?",
  "Plant impact": "Impact sur les installations",
  "Business systems only": "Systèmes de gestion uniquement",
  "Touches plant systems": "Touche les systèmes de production",
  "Safety-related": "Lié à la sécurité",
  "Touches the plant": "Touche les installations",
  "Release": "Lever",
  "Revise release": "Réviser la levée",
  "Release intrusive work": "Lever les travaux intrusifs",
  "Management-of-change reference": "Référence de maîtrise des modifications",
  "Management of change released": "Maîtrise des modifications levée",
  "Freezes ahead: ": "Gels à venir : ",
  "Sites in this rollout": "Sites de ce déploiement",
  "not a multi-site rollout": "déploiement mono-site",
  " live of ": " en service sur ",
  "Add a site to this rollout": "Ajouter un site à ce déploiement",
  "Edit rollout wave": "Modifier la vague",
  "Rollout wave updated": "Vague mise à jour",
  "Site added to the rollout": "Site ajouté au déploiement",
  "Wave removed": "Vague retirée",
  "Wave": "Vague",
  "Planned": "Planifié",
  "Went live": "Mise en service",
  "Shutdowns & change freezes": "Arrêts & gels de modification",
  "Declare": "Déclarer",
  "Declare a window": "Déclarer une fenêtre",
  "Site calendar": "Calendrier du site",
  "Change freeze — intrusive work refused": "Gel — travaux intrusifs refusés",
  "Shutdown — intrusive work welcome": "Arrêt — travaux intrusifs bienvenus",
  "intrusive work welcome": "travaux intrusifs bienvenus",
  "intrusive work refused": "travaux intrusifs refusés",
  "What the site calls it": "Le nom employé par le site",
  "Window declared": "Fenêtre déclarée",
  "Window withdrawn": "Fenêtre retirée",
  "Withdraw": "Retirer",
  "Readiness": "État de préparation",
  "Unknown": "Inconnu",
  "Not ready": "Non prêt",
  "Preparing": "En préparation",
  "Ready": "Prêt",
  " ahead": " à venir",
  "none declared": "aucune déclarée",

  // ── roadmap and pipeline (V-08 / V-11 / V-04 / V-13)
  "Roadmap": "Feuille de route",
  "Pipeline": "Portefeuille de demandes",
  "In flight": "En cours",
  "Landing this quarter": "Atterrit ce trimestre",
  "Plant cutovers ahead": "Basculements à venir",
  "Cross-project links": "Liens inter-projets",
  "What waits on what": "Qui attend quoi",
  " cross-project links": " liens inter-projets",
  "waits for": "attend",
  "Because": "Motif",
  "Requests": "Demandes",
  "Raise a request": "Émettre une demande",
  "Request raised": "Demande émise",
  "Decide": "Décider",
  "Decision recorded": "Décision enregistrée",
  "Make it a project": "En faire un projet",
  "The queue": "La file",
  "Set the envelope": "Définir l'enveloppe",
  "The capital envelope": "L'enveloppe d'investissement",
  "Envelope set": "Enveloppe définie",
  "Score": "Note",
  "unscored": "non noté",
  "Cost": "Coût",
  "Running total": "Cumul",
  "Line": "Ligne",
  "above": "au-dessus",
  "below": "en dessous",
  "Awaiting a decision": "En attente de décision",
  "Approved, not started": "Approuvées, non lancées",
  "Declined": "Refusées",
  "Demanded": "Demandé",
  "Below the line": "Sous la ligne",
  "Strategic fit 1–5": "Alignement stratégique 1–5",
  "Value 1–5": "Valeur 1–5",
  "Risk 1–5 (5 = worst)": "Risque 1–5 (5 = le pire)",
  "Effort 1–5 (5 = hardest)": "Effort 1–5 (5 = le plus difficile)",
  "Priority set": "Priorité définie",

  // ── money and people (V-05 / V-09)
  "Commitments": "Engagements",
  "Raise a commitment": "Enregistrer un engagement",
  "Commitment raised": "Engagement enregistré",
  "Commitment updated": "Engagement mis à jour",
  "Purchase order": "Bon de commande",
  "Supplier": "Fournisseur",
  "Amount (M)": "Montant (M)",
  "Currency": "Devise",
  "Expected": "Attendu",
  "What it buys": "Objet",
  "nothing committed": "aucun engagement",
  "Budget": "Budget",
  "Spent": "Dépensé",
  "Committed": "Engagé",
  "Free": "Disponible",
  "Currencies": "Devises",
  "capex": "investissement",
  "opex": "exploitation",
  "Effective capacity": "Capacité effective",
  "Contractors": "Prestataires",

  // ── statuses, drawn everywhere by statusTag (R-15)
  "Approved": "Approuvé",
  "Draft": "Brouillon",
  "In review": "En revue",
  "Superseded": "Remplacé",
  "Cleared": "Franchi",
  "Overdue": "En retard",
  "At risk": "À risque",
  "Pending": "En attente",
  "Rejected": "Refusé",
  "Open": "Ouvert",
  "Closed": "Clos",
  "In progress": "En cours",
  "Live": "En service",
  "Held": "Suspendu",
  "Cancelled": "Annulé",
  "Forecast": "Prévisionnel",
  "Realised": "Réalisé",
  "Partially realised": "Partiellement réalisé",
  "Withdrawn": "Retiré",
  "Part received": "Partiellement reçu",
  "Received": "Reçu",
  "New": "Nouveau",
  "Triaged": "Trié",
  "Converted": "Converti",

  // ── labels the measure caught still English (R-15)
  "Open items": "Éléments ouverts",
  "Critical": "Critique",
  "High": "Élevé",
  "At steering level": "Au niveau pilotage",
  "At PMO level": "Au niveau PMO",
  "Contingency across the book": "Provision sur tout le portefeuille",
  "Approve": "Approuver",
  "Submit": "Soumettre",
  "New revision": "Nouvelle révision",
  "Off — phases can advance with evidence outstanding.":
    "Désactivé — les phases peuvent avancer avec des preuves en attente.",
  " · if time allows": " · si le temps le permet",
  "Phase advance is blocked. ": "L'avancement de phase est bloqué. ",
  "Open the evidence list": "Ouvrir la liste des preuves",
  "Evidence link": "Lien de preuve",
  "Artefact": "Artefact",
  "open": "ouvrir",
  "Net effect of approved changes": "Effet net des changements approuvés",
  "Effect on ": "Effet sur ",
  "Budget now": "Budget actuel",
  "If approved": "Si approuvé",
  "Finish now": "Fin actuelle",
  "Contingency left": "Provision restante",

  // ── rotation & suppléance (R-02) / préférences (R-11)
  "You are covering for an absent colleague.": "Vous couvrez un collègue absent.",
  "Their authority, their slate — every act is recorded with both names.":
    "Son autorité, son périmètre — chaque acte est enregistré avec les deux noms.",
  "Stop covering": "Cesser la couverture",
  "You are named as deputy": "Vous êtes désigné suppléant",
  "Cover for them": "Assurer la couverture",
  "Covering started": "Couverture démarrée",
  " until ": " jusqu'au ",
  "Absences & cover": "Absences & suppléance",
  "Declare an absence": "Déclarer une absence",
  "Rotation & cover": "Rotation & suppléance",
  "Who is away": "Qui est absent",
  "Who covers": "Qui couvre",
  "Nobody — decisions wait": "Personne — les décisions attendent",
  "The deputy acts with the absent person's authority — never more — and the record names both.":
    "Le suppléant agit avec l'autorité de l'absent — jamais plus — et le registre nomme les deux.",
  "Absence declared": "Absence déclarée",
  "Absence withdrawn": "Absence retirée",
  "An absence cannot end before it starts": "Une absence ne peut pas finir avant de commencer",
  "covered by ": "couvert par ",
  "nobody covers": "personne ne couvre",
  "Decisions will wait until they return": "Les décisions attendront son retour",
  "No absence is declared. A decision owed to somebody on rotation waits in silence — declare the roster and name who covers.":
    "Aucune absence n'est déclarée. Une décision due à quelqu'un en rotation attend en silence — déclarez le roster et nommez qui couvre.",
  "rotation": "rotation",
  "leave": "congé",
  "training": "formation",
  "unavailable": "indisponible",
  "Reason": "Motif",
  "Notification preferences": "Préférences de notification",
  "Language of my emails": "Langue de mes courriels",
  "Follow the interface": "Suivre l'interface",
  "Cadence": "Cadence",
  "As things happen": "Au fil de l'eau",
  "Daily": "Quotidien",
  "Weekly": "Hebdomadaire",
  "Nothing by email": "Rien par courriel",
  "Preferences saved": "Préférences enregistrées",
  "All statuses": "Tous les statuts",
  " of ": " sur ",
  "On — a project cannot advance a phase until every evidence item for its next gate is approved.":
    "Activé — un projet ne peut pas avancer de phase tant que chaque preuve de son prochain jalon n'est pas approuvée.",
  "Close": "Fermer",
  "Edit": "Modifier",
  "Add": "Ajouter",
  "CSV": "CSV",
  "Print": "Imprimer",
  "Copy": "Copier",
  "Download Markdown": "Télécharger le Markdown",
  "New project": "Nouveau projet",
  "Copy status": "Copier le statut",
  "Open schedule": "Ouvrir le planning",
  "Open board": "Ouvrir le kanban",
  "Set status": "Définir le statut",
  "Re-baseline": "Re-référencer",
  "Advance phase": "Avancer la phase",
  "Raise change": "Lever un changement",
  "Raise item": "Lever un élément",
  "Raise concern": "Signaler une préoccupation",
  "Book cost": "Imputer un coût",
  "Assign person": "Affecter une personne",
  "Add document": "Ajouter un document",
  "New item": "Nouvel élément",
  "Export report": "Exporter le rapport",
  "Export book": "Exporter le livre",
  "Milestone": "Jalon",
  "Stage": "Étape",
  "Open in portfolio": "Ouvrir dans le portefeuille",
  "Meeting pack": "Dossier de réunion",
  "Minutes": "Compte rendu",
  "Record a decision": "Consigner une décision",
  "Record decision": "Consigner la décision",
  "Close the meeting": "Clore la réunion",
  "Attendance": "Présences",
  "Refresh from SDP": "Rafraîchir depuis SDP",
  "Link item": "Lier un élément",

  // ── portfolio & registers
  "Portfolio value": "Valeur du portefeuille",
  "On track": "Sur la trajectoire",
  "Schedule index": "Indice délai (SPI)",
  "Cost index": "Indice coût (CPI)",
  "Forecast variance": "Écart prévisionnel",
  "Open risks": "Risques ouverts",
  "Project register": "Registre des projets",
  "Decisions owed": "Décisions en attente",
  "Next on the calendar": "Prochaines échéances",
  "Programme mix": "Répartition par programme",
  "My open actions": "Mes actions ouvertes",
  "This week": "Cette semaine",
  "last 7 days": "7 derniers jours",
  "Project": "Projet",
  "Site": "Site",
  "people": "personnes",
  "Phase": "Phase",
  "Health": "Santé",
  "Progress": "Avancement",
  "Finish": "Fin",
  "Budget": "Budget",
  "reported": "déclaré",
  "No projects match this scope": "Aucun projet dans ce périmètre",
  "Widen the programme, site or health filter in the header.": "Élargissez le filtre programme, site ou santé dans l'en-tête.",

  // ── first-run / empty book
  "First run": "Première mise en route",
  "Set up the portfolio": "Mettre en place le portefeuille",
  "Being set up": "En cours de mise en place",
  "This portfolio has no projects yet": "Ce portefeuille n'a pas encore de projet",
  "Add your first site": "Ajoutez votre premier site",
  "Add a programme": "Ajoutez un programme",
  "Add people": "Ajoutez des personnes",
  "Create accounts & grants": "Créez comptes et habilitations",
  "Create the first project": "Créez le premier projet",

  // ── My week
  "Actions you owe": "Vos actions à traiter",
  "Your risks & issues": "Vos risques & problèmes",
  "Due in the next fortnight": "À échéance sous quinze jours",
  "Your projects": "Vos projets",
  "This week in your book": "Cette semaine dans votre périmètre",
  "Nothing on your plate from the meetings register.": "Rien pour vous au registre des réunions.",
  "No open register items carry your name.": "Aucun élément ouvert du registre ne porte votre nom.",
  "Nothing of yours lands in the next two weeks.": "Rien de vôtre n'arrive à échéance sous deux semaines.",
  "You manage no open projects.": "Vous ne gérez aucun projet ouvert.",
  "Quiet week — nothing in your scope moved.": "Semaine calme — rien n'a bougé dans votre périmètre.",

  // ── My site / programmes
  "your slate and what lands on it": "votre périmètre et ce qui y atterrit",
  "Your projects on site": "Vos projets du site",
  "site-governed — yours to run": "gouvernance site — à vous de les mener",
  "Group programmes here": "Programmes groupe implantés ici",
  "read-only; concerns are your channel": "lecture seule ; la préoccupation est votre canal",
  "Your people on group work": "Vos équipes sur des travaux groupe",
  "Open register": "Registre ouvert",
  "Yours to run": "À vous de les mener",
  "Landing on your site": "Atterrissent sur votre site",
  "Open risks & issues": "Risques & problèmes ouverts",
  "No site-governed projects here yet.": "Pas encore de projet en gouvernance site ici.",
  "No group programmes are delivering here right now.": "Aucun programme groupe ne livre ici pour le moment.",
  "Register is clear for this site.": "Le registre de ce site est vierge.",
  "group-run": "piloté groupe",
  "Decisions owed on this slate": "Décisions en attente sur ce périmètre",
  "Risk posture": "Posture de risque",

  // ── meetings
  "Referred from delivery calls": "Renvoyé par les revues de livraison",
  "Decisions requested": "Décisions demandées",
  "Actions carried forward": "Actions reportées",
  "Decisions taken at site and programme level": "Décisions prises aux niveaux site et programme",
  "Refer upward": "Renvoyer au niveau supérieur",
  "No — this room decides": "Non — cette instance décide",
  "Refer to the group steering committee": "Renvoyer au comité de pilotage groupe",
  "Refer to the programme board": "Renvoyer au comité de programme",
  "Answers a referral": "Répond à un renvoi",
  "None": "Aucun",

  // ── notices the read-only user meets
  "This account is read-only.": "Ce compte est en lecture seule.",
  "This is a group-governed project. Your site holds read access to it; changes are made at group level.":
    "Projet en gouvernance groupe. Votre site y a un accès en lecture ; les modifications se font au niveau groupe.",

  // ── save / conflict conversation (kit)
  "That change was not saved.": "Cette modification n'a pas été enregistrée.",
  " Your entries are kept — fix and try again, or Cancel.":
    " Votre saisie est conservée — corrigez puis réessayez, ou Annuler.",
  "One moment": "Un instant",
  "Another change is still saving — try again in a second": "Une autre modification s'enregistre — réessayez dans une seconde",
  "Could not complete: ": "Échec de : ",
  "That did not go through": "Cela n'a pas abouti",
  "Unexpected error": "Erreur inattendue",

  // ── R-15 (boucle de re-test) : dialogues, aides, états vides — le
  //    dictionnaire couvre désormais TOUT libellé passé à t(), et l'audit
  //    F6 refuse la build si un nouveau t("…") arrive sans entrée ici.
  " awaiting a decision": " en attente de décision",
  " benefits met": " bénéfices atteints",
  " demanded against ": " demandés contre ",
  " measured": " mesuré(s)",
  " measured, none ruled on yet": " mesuré(s), aucun tranché encore",
  " of actual effort recorded over the last four weeks, beside the planned FTE below.":
    " d'effort réel consigné sur les quatre dernières semaines, à côté des ETP planifiés ci-dessous.",
  " on ": " le ",
  " on reduced availability": " en disponibilité réduite",
  " on the critical path": " sur le chemin critique",
  " open order(s)": " commande(s) ouverte(s)",
  " open purchase order(s)": " bon(s) de commande ouvert(s)",
  " over the envelope": " au-delà de l'enveloppe",
  " people": " personnes",
  " project row(s)": " ligne(s) projet",
  " project(s) carry no score, so the queue cannot rank them. They sort last rather than worst.":
    " projet(s) sans score : la file ne peut pas les classer. Ils se placent en dernier, pas en pire.",
  " project(s) promise nothing": " projet(s) ne promettent rien",
  " recorded event(s)": " événement(s) consigné(s)",
  " released ": " libéré ",
  " stages": " étapes",
  " withdrawn": " retiré(s)",
  " · opex ": " · opex ",
  "% of what was promised": "% de ce qui était promis",
  "A benefit that was promised and then withdrawn is usually better marked Withdrawn than deleted — the register keeps the promise visible.":
    "Un bénéfice promis puis retiré vaut mieux marqué Retiré que supprimé — le registre garde la promesse visible.",
  "A cutover, a switch-over, anything a change freeze is about":
    "Une bascule, un basculement — tout ce qu'un gel des changements concerne",
  "A project cannot finish before it starts": "Un projet ne peut pas finir avant de commencer",
  "A window cannot end before it starts": "Une fenêtre ne peut pas finir avant de commencer",
  "Actual, not planned": "Le réel, pas le plan",
  "Amount": "Montant",
  "Any day of that week": "N'importe quel jour de la semaine",
  "Anything above 'business systems only' brings the site's change freezes into force":
    "Au-delà de « systèmes de gestion seulement », les gels de changements du site s'appliquent",
  "As at": "Arrêté au",
  "As at the date it was raised — the ledger does not revalue its own history":
    "À la date d'émission — le registre ne réévalue pas sa propre histoire",
  "August 2026, Q3 FY26, Week 35 — whatever the pack is titled":
    "Août 2026, T3 FY26, semaine 35 — le titre que porte le dossier",
  "Benefits": "Bénéfices",
  "Committed money": "Argent engagé",
  "Correcting a period already closed? Name it. The original stays on the record.":
    "Vous corrigez une période déjà close ? Nommez-la. L'original reste au dossier.",
  "Dataset": "Jeu de données",
  "Dataset export": "Export du jeu de données",
  "Dataset exported": "Jeu de données exporté",
  "Days spent": "Jours passés",
  "Decide: ": "Décider : ",
  "Decision": "Décision",
  "Detail": "Détail",
  "Edit ": "Modifier ",
  "Edit wave": "Modifier la vague",
  "Effort recorded": "Effort consigné",
  "Envelope (M)": "Enveloppe (M)",
  "Estimate": "Estimation",
  "Every project you can see is written down as it stands today, at the portfolio's status date. Closed periods cannot be edited or deleted — a correction is a new period that names this one.":
    "Chaque projet visible est écrit tel qu'il est aujourd'hui, à la date d'arrêté du portefeuille. Les périodes closes ne se modifient ni ne se suppriment — une correction est une nouvelle période qui nomme celle-ci.",
  "Everything on the record for this project, as at a date":
    "Tout ce qui est au dossier pour ce projet, à une date donnée",
  "Everything on the record up to this date — leave today's date for current state":
    "Tout ce qui est au dossier jusqu'à cette date — laissez la date du jour pour l'état courant",
  "Evidence pack": "Dossier de preuve",
  "Evidence pack built": "Dossier de preuve constitué",
  "For": "Pour",
  "From": "Du",
  "Gate": "Jalon",
  "Governed at": "Gouverné au niveau",
  "Group": "Groupe",
  "Hand-placed rank": "Rang placé à la main",
  "In production, availability, cost or compliance terms":
    "En termes de production, de disponibilité, de coût ou de conformité",
  "Kind": "Nature",
  "Leave blank to let the score decide. A rank overrules it — for when the room does.":
    "Laissez vide pour laisser le score décider. Un rang l'emporte — pour quand la salle tranche.",
  "Leave blank until it has been measured": "Laissez vide tant que rien n'a été mesuré",
  "Less detail": "Moins de détail",
  "Management of change ": "Gestion du changement ",
  "Measured against what the benefits promised": "Mesuré contre ce que les bénéfices ont promis",
  "More detail": "Plus de détail",
  "No actual effort has been recorded yet — the numbers below are the plan, and only the plan.":
    "Aucun effort réel n'a encore été consigné — les chiffres ci-dessous sont le plan, et seulement le plan.",
  "No artefact — an approval will be refused": "Pas de pièce — l'approbation sera refusée",
  "No management-of-change release — intrusive work inside a site freeze will be refused":
    "Pas de levée MOC — le travail intrusif dans un gel de site sera refusé",
  "No period has been closed yet. Everything on this page is computed from the book as it stands right now, which means it will read differently tomorrow. Closing a period writes down what was reported, so it can be produced again.":
    "Aucune période n'a encore été close. Tout sur cette page est calculé sur le livre tel qu'il est maintenant — il se lira donc autrement demain. Clore une période écrit ce qui a été rapporté, pour pouvoir le reproduire.",
  "No project in your scope waits on another. Links are made on a project's schedule.":
    "Aucun projet de votre périmètre n'attend un autre. Les liens se posent sur le planning d'un projet.",
  "No shutdown or freeze is on the calendar. Until one is, nothing stops a cutover being planned into production hours.":
    "Aucun arrêt ni gel au calendrier. Tant qu'il n'y en a pas, rien n'empêche de planifier une bascule en heures de production.",
  "Note": "Note",
  "Nothing has been asked for yet.": "Rien n'a encore été demandé.",
  "Nothing has been asked for yet. A request records what somebody wants and why, before anyone plans it — and a decline keeps its reason where the person who asked can read it.":
    "Rien n'a encore été demandé. Une demande écrit ce que quelqu'un veut et pourquoi, avant que quiconque ne planifie — et un refus garde sa raison là où le demandeur peut la lire.",
  "Nothing in flight in your scope.": "Rien en cours dans votre périmètre.",
  "Nothing in flight to rank.": "Rien en cours à classer.",
  "Nothing is committed. A purchase order raised is money gone from the envelope months before it becomes a cost line — recording it here is what stops the budget looking healthier than it is.":
    "Rien n'est engagé. Un bon de commande émis, c'est de l'argent sorti de l'enveloppe des mois avant de devenir une ligne de coût — l'écrire ici est ce qui empêche le budget de paraître plus sain qu'il ne l'est.",
  "Nothing was in scope for you in that period.": "Rien n'était dans votre périmètre sur cette période.",
  "One flat row per project, for the group's own reporting":
    "Une ligne à plat par projet, pour le reporting propre du groupe",
  "Person": "Personne",
  "Plant availability, cost per ounce, hours lost…": "Disponibilité usine, coût à l'once, heures perdues…",
  "Plant impact classified": "Impact usine classifié",
  "Prioritisation": "Priorisation",
  "Programme": "Programme",
  "Project created from the request": "Projet créé depuis la demande",
  "Project manager": "Chef de projet",
  "Project name": "Nom du projet",
  "Put this meeting in your calendar": "Mettre cette réunion dans votre agenda",
  "Rate to reporting currency": "Taux vers la devise de reporting",
  "Re-create this row exactly as its image holds it":
    "Recréer cette ligne exactement telle que son image la tient",
  "Received means it has become a cost line — it stops counting as committed":
    "Reçu veut dire devenu ligne de coût — cela cesse de compter comme engagé",
  "Record effort": "Consigner l'effort",
  "Reference": "Référence",
  "Remove": "Retirer",
  "Remove this benefit?": "Retirer ce bénéfice ?",
  "Remove wave": "Retirer la vague",
  "Replaces ": "Remplace ",
  "Request": "Demande",
  "Required for anything short of Met — the committee has to be able to read it back":
    "Requis pour tout sauf Atteint — le comité doit pouvoir le relire",
  "Required to decline — the person who asked will read this":
    "Requis pour refuser — la personne qui a demandé le lira",
  "Restore": "Restaurer",
  "Restored from the trail": "Restauré depuis la piste",
  "Risk": "Risque",
  "Risks": "Risques",
  "Rough cost (M)": "Coût approximatif (M)",
  "Score ": "Score ",
  "Series ICS": "ICS de la série",
  "Sign in with your work account": "Se connecter avec votre compte professionnel",
  "Sponsor": "Sponsor",
  "Stage plan": "Plan d'étapes",
  "Start": "Début",
  "Status": "Statut",
  "Stored against the Monday of the week you pick": "Rangé sur le lundi de la semaine choisie",
  "Subscribe to the whole series": "S'abonner à toute la série",
  "That period could not be loaded — refresh to try again.":
    "Cette période n'a pas pu être chargée — actualisez pour réessayer.",
  "The MOC this was raised under in the site's own process":
    "Le MOC sous lequel ceci a été émis dans le processus du site",
  "The business person who wants this, not the person building it":
    "La personne métier qui le veut, pas celle qui le construit",
  "The person accountable for the number, not for the project":
    "La personne comptable du chiffre, pas du projet",
  "The reporting periods could not be loaded — refresh to try again.":
    "Les périodes de reporting n'ont pas pu être chargées — actualisez pour réessayer.",
  "The request list could not be loaded — refresh to try again.":
    "La liste des demandes n'a pas pu être chargée — actualisez pour réessayer.",
  "The trail is append-only, so a pack built today for a date in the past says exactly what it said then.":
    "La piste est en ajout seul : un dossier constitué aujourd'hui pour une date passée dit exactement ce qu'il disait alors.",
  "This account is not linked to a person, so nothing is owed to you by name.":
    "Ce compte n'est lié à aucune personne : rien ne vous est dû nominativement.",
  "This project": "Ce projet",
  "This project lands at one site. Add a site to track it as a wave-by-wave rollout.":
    "Ce projet atterrit sur un seul site. Ajoutez un site pour le suivre en déploiement vague par vague.",
  "This records that management of change has released the project's intrusive work. Cutovers may then be dated inside a site freeze, and the release is on the record with your name against it.":
    "Ceci consigne que la gestion du changement a libéré le travail intrusif du projet. Les bascules peuvent alors être datées dans un gel de site, et la levée est au dossier avec votre nom.",
  "This week's movement could not be loaded — refresh to try again.":
    "Le mouvement de la semaine n'a pas pu être chargé — actualisez pour réessayer.",
  "To": "Au",
  "Until one is recorded with a baseline, a target and an owner, the portfolio can say this project was run well but not that it was worth doing.":
    "Tant qu'il n'y en a pas un d'écrit avec une base, une cible et un responsable, le portefeuille peut dire que le projet a été bien conduit — pas qu'il valait la peine.",
  "What is being asked for": "Ce qui est demandé",
  "What the board will call this period": "Le nom que la direction donnera à cette période",
  "What the business gets": "Ce que le métier obtient",
  "What the business gets — in its words, not the project's":
    "Ce que le métier obtient — dans ses mots, pas ceux du projet",
  "What the group has to spend. Zero means none agreed, and nothing falls below the line.":
    "Ce que le groupe a à dépenser. Zéro veut dire rien de convenu, et rien ne passe sous la ligne.",
  "Where the piece actually lives. Approval is refused without it, and changing it after approval sends the document back to review.":
    "Où la pièce vit réellement. L'approbation est refusée sans elle, et la changer après approbation renvoie le document en revue.",
  "Why this close reads as it does — read back months later by people who were not there":
    "Pourquoi cette clôture se lit ainsi — relu des mois plus tard par des gens qui n'y étaient pas",
  "Your actions could not be loaded — refresh to try again.":
    "Vos actions n'ont pas pu être chargées — actualisez pour réessayer.",
  "across the horizon": "sur l'horizon",
  "across the portfolio": "sur tout le portefeuille",
  "against an envelope of ": "contre une enveloppe de ",
  "approved envelope": "enveloppe approuvée",
  "business systems only": "systèmes de gestion seulement",
  "capex ": "capex ",
  "could not be loaded": "n'a pas pu être chargé",
  "d late upstream": "j de retard en amont",
  "dependencies between projects": "dépendances entre projets",
  "due ": "échéance ",
  "everything fits": "tout tient",
  "intrusive work on the horizon": "travail intrusif à l'horizon",
  "live ": "en cours ",
  "no capital envelope agreed": "aucune enveloppe capex convenue",
  "no envelope agreed": "aucune enveloppe convenue",
  "no people yet": "personne pour l'instant",
  "none ruled on yet": "aucun tranché encore",
  "nothing booked yet": "rien d'inscrit encore",
  "nothing measured yet": "rien de mesuré encore",
  "of ": "sur ",
  "of target, on measured benefits": "de la cible, sur bénéfices mesurés",
  "or with a Meridian account below": "ou avec un compte Meridian ci-dessous",
  "planned ": "planifié ",
  "raised and not yet decided": "émis et pas encore tranchés",
  "ready to become projects": "prêts à devenir des projets",
  "ruled on at group level": "tranchés au niveau groupe",
  "site ": "site ",
  "spent and committed exceed the budget": "dépensé + engagé dépassent le budget",
  "sponsor ": "sponsor ",
  "uncommitted and unspent": "ni engagé ni dépensé",
  "what the portfolio promised, and what has been measured":
    "ce que le portefeuille a promis, et ce qui a été mesuré",
  "with the reason on the record": "avec la raison au dossier",

  // ── campagne de sécurité (S-01)
  "unsafe link": "lien non sûr",
  "unavailable": "indisponible",

  // ── A-02 / A-04 · la couche qui enseigne, dans la langue du lecteur.
  //    Page d'aide, orientation, aides au champ, états vides et écran de
  //    première mise en route — la porte F5 refuse désormais la build si
  //    l'une d'elles repart en anglais.
  "How Meridian works": "Comment fonctionne Meridian",
  "Keyboard & direct manipulation": "Clavier & manipulation directe",
  "Health (RAG)": "Santé (RAG)",
  "Green/Amber/Red is derived from schedule and cost indices — hover any dot to read WHY. A manual override always carries a written reason.":
    "Vert/Ambre/Rouge se déduit des indices de délai et de coût — survolez une pastille pour lire POURQUOI. Un forçage manuel porte toujours une raison écrite.",
  "Gates": "Jalons",
  "A project advances phase only when the next gate's evidence documents are approved. Overriding a gate is a recorded governance exception.":
    "Un projet ne change de phase que lorsque les preuves du jalon suivant sont approuvées. Passer outre un jalon est une exception de gouvernance, consignée.",
  "Your scope": "Votre périmètre",
  "You see and edit what your grants name. A group programme delivered at your site is readable, never editable — raise a CONCERN on it instead.":
    "Vous voyez et modifiez ce que vos habilitations nomment. Un programme groupe livré sur votre site est lisible, jamais modifiable — ouvrez plutôt une PRÉOCCUPATION.",
  "Decisions & referrals": "Décisions & renvois",
  "A site meeting refers what is above its authority; the group agenda picks it up automatically and its decision retires the referral.":
    "Un comité de site renvoie ce qui dépasse son autorité ; l'ordre du jour groupe le reprend automatiquement, et sa décision solde le renvoi.",
  "Prioritisation score": "Score de priorisation",
  "Fit, value and risk pull a project up the queue; effort pulls it down. The score only ranks — it never decides. A hand-placed rank overrules it, for when the room does.":
    "L'adéquation, la valeur et le risque font monter un projet dans la file ; l'effort le fait descendre. Le score classe, il ne décide jamais. Un rang placé à la main l'emporte — pour quand la salle tranche.",
  "Search everything — projects, people, risks, changes, documents":
    "Tout rechercher — projets, personnes, risques, changements, documents",
  "This list": "Cette liste",
  "Close a dialog": "Fermer une boîte de dialogue",
  "Drag a Gantt bar": "Faire glisser une barre de Gantt",
  "Move a stage; drag its edge to change the length": "Déplacer une étape ; tirer son bord pour changer la durée",
  "On a Gantt bar, nudge a day; with shift, a week": "Sur une barre de Gantt, décaler d'un jour ; avec Maj, d'une semaine",
  "On a board card, move it between columns": "Sur une carte du kanban, la déplacer d'une colonne à l'autre",
  "Double-click": "Double-clic",
  "Edit a Gantt stage or a board card": "Modifier une étape de Gantt ou une carte du kanban",
  "Need access or a grant changed? Any account marked ADMIN on the sign-in screen's directory can help.":
    "Besoin d'un accès ou d'une habilitation ? Tout compte marqué ADMIN dans l'annuaire de l'écran de connexion peut vous aider.",
  "Start here — what this account is for": "Par où commencer — à quoi sert ce compte",
  "Reopen the orientation for your role, at any time": "Rouvrir l'orientation de votre rôle, à tout moment",
  "You can reopen this page at any time from Help.": "Vous pouvez rouvrir cette page à tout moment depuis l'Aide.",
  "Orientation": "Orientation",
  "Health, gates, scope, referrals": "Santé, jalons, périmètre, renvois",

  // première mise en route
  "Administration → Sites": "Administration → Sites",
  "Administration → Programmes": "Administration → Programmes",
  "Administration → Directory": "Administration → Annuaire",
  "Administration → Accounts — a group/site account needs a grant to see anything":
    "Administration → Comptes — un compte groupe ou site ne voit rien sans habilitation",
  "The New project button appears here once a site and a programme exist":
    "Le bouton Nouveau projet apparaît ici dès qu'un site et un programme existent",

  // aides au champ — administration
  "Links the account to a person so their actions and allocations line up.":
    "Rattache le compte à une personne, pour que ses actions et ses affectations se recoupent.",
  "The account holder should change this at first sign-in.":
    "Le titulaire du compte doit le changer à la première connexion.",
  "A group or site account with no grants can see nothing. One is required.":
    "Un compte groupe ou site sans habilitation ne voit rien. Il en faut une.",
  "Deactivating ends every live session for this account immediately.":
    "Désactiver met fin immédiatement à toutes les sessions de ce compte.",
  "Free text — this is the directory description, not an access level.":
    "Texte libre — c'est la description de l'annuaire, pas un niveau d'accès.",
  "Clearing this marks a leaver. The system checks first for live projects, open actions and open RAID items.":
    "Vider ce champ marque un départ. Le système vérifie d'abord les projets en cours, les actions et les éléments RAID ouverts.",
  "Three letters, e.g. the airport code.": "Trois lettres, par exemple le code aéroport.",

  // aides au champ — projet, planning, argent
  "A group project is run by the group and is read-only to a site. A site project belongs to its site.":
    "Un projet groupe est conduit par le groupe et reste en lecture seule pour un site. Un projet site appartient à son site.",
  "Sets each stage's baseline window to where it sits today. Schedule variance resets to zero.":
    "Cale la fenêtre de référence de chaque étape sur sa position d'aujourd'hui. L'écart de délai repart à zéro.",
  "This is the record steering reads when it asks why the variance disappeared.":
    "C'est le texte que lira le comité de pilotage lorsqu'il demandera où est passé l'écart.",
  "Taken proportionally from the existing stages, so the shares still sum to 100%.":
    "Pris proportionnellement sur les étapes existantes, pour que les parts fassent toujours 100 %.",
  "Both the original and the reversal stay visible; this is what explains the pair.":
    "L'écriture d'origine et son annulation restent visibles ; c'est ceci qui explique la paire.",
  "Contingency draws are reported separately from the approved envelope.":
    "Les puisements dans la provision sont rapportés à part de l'enveloppe approuvée.",
  "e.g. −1 High": "par ex. −1 Élevé",

  // aides au champ — comités
  "A referral headlines the broader room's next agenda until its decision answers it.":
    "Un renvoi ouvre l'ordre du jour de la salle supérieure jusqu'à ce que sa décision y réponde.",
  "Naming the referral retires it from future agendas.":
    "Nommer le renvoi le retire des ordres du jour suivants.",
  "Scope decides both what the agenda covers and who may run it.":
    "Le périmètre décide à la fois de ce que couvre l'ordre du jour et de qui peut l'animer.",
  "The agenda is divided across its sections in proportion to weight; anything that will not fit is marked “if time allows”.":
    "L'ordre du jour se répartit entre ses sections au prorata du poids ; ce qui ne tient pas est marqué « si le temps le permet ».",

  // états vides
  "No programmes granted to this account": "Aucun programme confié à ce compte",
  "No site granted to this account": "Aucun site confié à ce compte",
  "No projects in the book": "Aucun projet au portefeuille",
  "Nothing in this scope": "Rien dans ce périmètre",
  "No projects led here": "Aucun projet conduit ici",
  "No allocations": "Aucune affectation",
  "No meeting series in your scope": "Aucun comité dans votre périmètre",
  "Nothing scheduled yet.": "Rien de programmé pour l'instant.",
  "Register is clear.": "Le registre est vide.",
  "No accounts match that filter.": "Aucun compte ne correspond à ce filtre.",
  "The directory is empty.": "L'annuaire est vide.",

  // ── N-05 · les réglages du centre, dans l'écran d'administration
  "what leaves, how long it is kept, and when it climbs":
    "ce qui sort, combien de temps on le garde, et quand cela monte d'un cran",
  "Keep notifications for (days)": "Conserver les notifications (jours)",
  "0 = no retention decided, and the purge declines to run rather than choose for you":
    "0 = aucune durée décidée, et la purge s'abstient plutôt que de choisir à votre place",
  "Escalate after (days)": "Faire monter d'un cran après (jours)",
  "an unread message climbs one step instead of being sent again; 0 turns it off":
    "un message non lu monte d'un cran au lieu d'être renvoyé ; 0 désactive",
  "Weekly cap per account": "Plafond hebdomadaire par compte",
  "above this, the settings failed — not the reader":
    "au-delà, c'est le réglage qui a échoué, pas le lecteur",
  "Trusted webhook hosts": "Hôtes de destination autorisés",
  "Closed by default: with none named, nothing is posted outward.":
    "Fermé par défaut : sans hôte nommé, rien n'est envoyé vers l'extérieur.",

  /* R-01 · le réglage des hôtes de preuve, enfin posé à l'écran. */
  "Evidence": "Preuve",
  "where a proof may point": "où une preuve a le droit de pointer",
  "Trusted evidence hosts": "Hôtes de preuve de confiance",
  "Closed by default: with none named, no document can be approved as evidence.":
    "Fermé par défaut : sans hôte nommé, aucun document ne peut être approuvé comme preuve.",

  // ── A-05 · l'aide au champ, là où un AUTRE lira la valeur.
  //    Chacune dit ce dont le lecteur futur aura besoin, jamais ce que
  //    le champ contient : « Note » n'apprend rien à personne.
  "Read months later by somebody who was not on the call — say what was decided, not that a call happened.":
    "Relu des mois plus tard par quelqu'un qui n'était pas à l'appel — dites ce qui a été décidé, pas qu'un appel a eu lieu.",
  "What somebody picking this up would need to know before starting.":
    "Ce que devrait savoir quelqu'un qui reprend ceci, avant de commencer.",
  "The one or two lines a reader needs to judge this without asking you.":
    "Les une ou deux lignes qu'il faut à un lecteur pour en juger sans vous appeler.",
  "Enough for the person who decides to decide without calling you back.":
    "Assez pour que celui qui décide décide sans vous rappeler.",
  "The person who asked will read this. A refusal without a reason reads as a refusal of them.":
    "La personne qui a demandé lira ceci. Un refus sans raison se lit comme un refus d'elle.",
  "For whoever reads this queue next week, not for you today.":
    "Pour celui qui lira cette file la semaine prochaine, pas pour vous aujourd'hui.",
  "What a reader would need to understand the number beside it.":
    "Ce qu'il faudrait à un lecteur pour comprendre le chiffre d'à côté.",
  "Name the source and the unit, so the person who measures it later measures the same thing.":
    "Nommez la source et l'unité, pour que celui qui mesurera plus tard mesure la même chose.",
  "The committee reads this back when it asks why the figure moved.":
    "Le comité relit ceci quand il demande pourquoi le chiffre a bougé.",
  "One sentence somebody can act on. « Discussed » is not a decision.":
    "Une phrase sur laquelle quelqu'un peut agir. « Discuté » n'est pas une décision.",
  "Why, in the room's own words — this is what makes the decision defensible six months from now.":
    "Pourquoi, dans les mots de la salle — c'est ce qui rendra la décision défendable dans six mois.",
  "What the owner needs in order to start, without coming back to ask.":
    "Ce qu'il faut au responsable pour démarrer, sans revenir vous demander.",
  "The share of the work actually done — every schedule index is computed from this one number.":
    "La part du travail réellement faite — tous les indices de délai se calculent sur ce seul nombre.",
  "What the second project is waiting for, in the words the two teams would use.":
    "Ce que le second projet attend, dans les mots qu'emploieraient les deux équipes.",
  "Share of a full week. Above the ceiling, this person shows as over-allocated to their own site lead.":
    "Part d'une semaine pleine. Au-dessus du plafond, cette personne apparaît sur-affectée à son propre responsable de site.",
  "Share of a full week over the whole period, not the effort of one busy day.":
    "Part d'une semaine pleine sur toute la période, pas l'effort d'une journée chargée.",
  "The stage this work belongs to — it is how the board and the schedule stay the same story.":
    "L'étape à laquelle ce travail appartient — c'est ce qui fait que le kanban et le planning racontent la même histoire.",
  "The name the portfolio will carry. The request stays linked, so the thread from ask to project survives.":
    "Le nom que portera le portefeuille. La demande reste liée : le fil qui va de la demande au projet survit.",
  "The occurrence rebuilds its agenda from the book when it opens, so a date moved is not an agenda lost.":
    "L'occurrence reconstruit son ordre du jour sur le livre à son ouverture : une date déplacée n'est pas un ordre du jour perdu.",
  "The holder is asked to change it at their next sign-in: an admin-set password is one two people know.":
    "Le titulaire devra le changer à sa prochaine connexion : un mot de passe posé par un administrateur est un mot de passe que deux personnes connaissent.",

  // ── A-01 / A-10 / A-11 / A-12 · le manuel, les premiers pas,
  //    le terrain d'apprentissage et le référent du site.
  //    C'est la surface la plus lue par quelqu'un qui apprend : la porte
  //    F5 vérifie chacun de ces textes un par un.
  "Using Meridian": "Utiliser Meridian",
  "First steps and answers": "Premiers pas et réponses",
  "Using Meridian — first steps and answers": "Utiliser Meridian — premiers pas et réponses",
  "First steps": "Premiers pas",
  "How do I…": "Comment fait-on…",
  "Manual": "Manuel",
  "done": "faits",
  "answers": "réponses",
  "Show me": "Montrez-moi",
  "These tick themselves as the work gets done — nothing here is a box you check by hand.":
    "Elles se cochent d'elles-mêmes à mesure que le travail se fait — rien ici n'est une case à cocher à la main.",
  "Answers to what people actually ask, in the order they ask them. Each one says where the thing is done.":
    "Les réponses aux questions que les gens posent vraiment, dans l'ordre où ils les posent. Chacune dit où le geste s'accomplit.",

  // premiers pas — communs
  "Choose your own password": "Choisissez votre propre mot de passe",
  "Until you do, the trail cannot say an action was really yours.":
    "Tant que ce n'est pas fait, la piste ne peut pas attester qu'une action était bien la vôtre.",
  "Find your own week": "Trouvez votre propre semaine",
  "My week gathers what is owed by you, and only by you.":
    "Ma semaine rassemble ce qui vous est dû à vous, et à vous seul.",

  // premiers pas — site
  "Update a stage on one of your projects": "Mettez à jour une étape sur un de vos projets",
  "Open the project, then Stage plan. The percentage you set is what the indices are computed from.":
    "Ouvrez le projet, puis Plan d'étapes. Le pourcentage que vous posez est ce à partir de quoi tous les indices se calculent.",
  "Raise a risk or an issue": "Ouvrez un risque ou un problème",
  "Anything that could cost time or money belongs on the register — before it does.":
    "Tout ce qui pourrait coûter du temps ou de l'argent a sa place au registre — avant que cela n'arrive.",
  "Know how to speak about a group project": "Sachez comment parler d'un projet groupe",
  "A group project landing on your site is read-only. Raise a CONCERN on it; your programme office sees it on their agenda.":
    "Un projet groupe qui atterrit sur votre site est en lecture seule. Ouvrez-y une PRÉOCCUPATION : votre bureau de programme la voit à son ordre du jour.",
  "Find a decision your site meeting took": "Retrouvez une décision de votre comité de site",
  "Meetings keep their minutes. A decision taken is a decision anybody can read back.":
    "Les comités gardent leurs minutes. Une décision prise est une décision que chacun peut relire.",
  "Record a week of real effort": "Consignez une semaine d'effort réel",
  "Four fields, once a week. It sits beside the plan — the gap is the point.":
    "Quatre champs, une fois par semaine. Cela se place à côté du plan — c'est l'écart qui compte.",

  // premiers pas — groupe
  "Read your programme's slate": "Lisez le tableau de votre programme",
  "Programmes shows the health of everything you govern, and what is owed to you.":
    "Programmes montre la santé de tout ce que vous gouvernez, et ce qui vous est dû.",
  "Decide a change request somebody else raised": "Décidez une demande de changement émise par un autre",
  "You never decide your own — a second pair of eyes is the control, not a formality.":
    "Vous ne décidez jamais la vôtre — la seconde paire d'yeux est le contrôle, pas une formalité.",
  "Approve a gate evidence document": "Approuvez une preuve de jalon",
  "It must point at a real artefact on a trusted host, and you cannot approve one you own.":
    "Elle doit pointer vers une pièce réelle sur un hôte de confiance, et vous ne pouvez pas approuver celle dont vous êtes propriétaire.",
  "Close a reporting period": "Clôturez une période de reporting",
  "Closing freezes what was reported, so the number you quote can be produced again.":
    "Clore fige ce qui a été rapporté, pour que le chiffre que vous citez puisse être reproduit.",
  "Score the demand queue": "Notez la file des demandes",
  "Fit and value pull up; risk and effort pull down. The score ranks — it never decides.":
    "L'adéquation et la valeur font monter ; le risque et l'effort font descendre. Le score classe — il ne décide jamais.",

  // premiers pas — administration
  "Add the sites and programmes": "Ajoutez les sites et les programmes",
  "Everything else hangs off them: a project needs both to exist.":
    "Tout le reste en dépend : un projet a besoin des deux pour exister.",
  "Add the people": "Ajoutez les personnes",
  "An account is linked to a person, so their actions and allocations line up.":
    "Un compte est rattaché à une personne, pour que ses actions et ses affectations se recoupent.",
  "Create the named accounts and their grants": "Créez les comptes nominatifs et leurs habilitations",
  "A group or site account with no grant sees nothing. And named accounts are what makes segregation of duties real.":
    "Un compte groupe ou site sans habilitation ne voit rien. Et ce sont les comptes nominatifs qui rendent la séparation des tâches réelle.",
  "Name the trusted document hosts": "Nommez les hôtes documentaires de confiance",
  "Until you do, no gate evidence can be approved — the control is closed, deliberately.":
    "Tant que ce n'est pas fait, aucune preuve de jalon ne peut être approuvée — le contrôle est fermé, délibérément.",
  "Decide how long notifications are kept": "Décidez combien de temps les notifications sont conservées",
  "Without a duration nothing is purged: how long a record of who was told what is kept is your decision, not the tool's.":
    "Sans durée, rien n'est purgé : combien de temps on garde la trace de ce qu'on a dit à qui est votre décision, pas celle de l'outil.",

  // premiers pas — lecteur
  "Read the portfolio headline": "Lisez le titre du portefeuille",
  "One line per project: health, gate, money, and why the colour is what it is.":
    "Une ligne par projet : santé, jalon, argent, et pourquoi la couleur est ce qu'elle est.",
  "Read a published period": "Lisez une période publiée",
  "A closed period is frozen: it reads today exactly as it read then.":
    "Une période close est figée : elle se lit aujourd'hui exactement comme elle se lisait alors.",
  "Understand where a number comes from": "Comprenez d'où vient un chiffre",
  "Hover any health dot: it says why. Nothing in Meridian asks to be taken on trust.":
    "Survolez une pastille de santé : elle dit pourquoi. Rien dans Meridian ne demande à être cru sur parole.",

  // manuel — sections
  "Getting started": "Pour commencer",
  "Keeping a project honest": "Tenir un projet honnête",
  "Gates and evidence": "Jalons et preuves",
  "Meetings and decisions": "Comités et décisions",
  "Your week, your absences": "Votre semaine, vos absences",

  // manuel — questions et réponses
  "How do I sign in for the first time?": "Comment se connecter la première fois ?",
  "Use the address and the temporary password you were given. Meridian will ask you to choose your own before it lets you record anything: until you do, the trail cannot say an action was really yours.":
    "Utilisez l'adresse et le mot de passe provisoire qu'on vous a remis. Meridian vous demandera de choisir le vôtre avant de vous laisser consigner quoi que ce soit : sans cela, la piste ne peut pas attester qu'une action était bien la vôtre.",
  "Where do I find what is owed by me?": "Où trouver ce qui m'incombe ?",
  "My week. It gathers the actions, the risks and the decisions that carry your name — and nothing that carries somebody else's.":
    "Ma semaine. Elle rassemble les actions, les risques et les décisions qui portent votre nom — et rien de ce qui porte celui d'un autre.",
  "Why can I see a project but not change it?": "Pourquoi puis-je voir un projet sans pouvoir le modifier ?",
  "Your grants name what you may write. A group programme delivered at your site is readable, never editable — that is deliberate. Raise a concern on it instead, and your programme office sees it on their agenda.":
    "Vos habilitations nomment ce que vous pouvez écrire. Un programme groupe livré sur votre site est lisible, jamais modifiable — c'est délibéré. Ouvrez-y plutôt une préoccupation : votre bureau de programme la voit à son ordre du jour.",
  "How do I update progress?": "Comment mettre à jour l'avancement ?",
  "Open the project, then Stage plan, and set the percentage complete on the stage. Every index — schedule, cost, forecast — is computed from that number, so it is the one thing worth keeping true.":
    "Ouvrez le projet, puis Plan d'étapes, et posez le pourcentage d'avancement de l'étape. Chaque indice — délai, coût, prévision — se calcule à partir de ce nombre : c'est la seule chose qu'il vaille vraiment la peine de tenir juste.",
  "What does the colour mean?": "Que veut dire la couleur ?",
  "Green, amber and red are derived from the schedule and cost indices. Hover the dot and it tells you why. If you disagree, override it — but an override always carries a written reason, because the committee reads it back.":
    "Vert, ambre et rouge se déduisent des indices de délai et de coût. Survolez la pastille : elle vous dit pourquoi. Si vous n'êtes pas d'accord, forcez-la — mais un forçage porte toujours une raison écrite, parce que le comité la relit.",
  "How do I raise a risk or an issue?": "Comment ouvrir un risque ou un problème ?",
  "Risks & issues, then the button. Probability times impact decides who hears about it: high enough and it appears on the steering agenda by itself.":
    "Risques & problèmes, puis le bouton. Probabilité multipliée par impact décide qui en entend parler : assez haut, et cela paraît de soi-même à l'ordre du jour du comité de pilotage.",
  "Something changed the cost or the dates. What do I do?": "Le coût ou les dates ont changé. Que faire ?",
  "Raise a change request. Above the threshold it goes to your programme office; below it, a colleague decides. You never decide your own — that is the control, not a formality.":
    "Émettez une demande de changement. Au-dessus du seuil elle part au bureau de programme ; en dessous, un collègue décide. Vous ne décidez jamais la vôtre — c'est le contrôle, pas une formalité.",
  "Why will the gate not let my project advance?": "Pourquoi le jalon refuse-t-il de laisser passer mon projet ?",
  "A gate needs its evidence documents approved. A document is approved evidence only when it points at a real artefact on a trusted host — a document with no link is a label, and Meridian refuses to count it.":
    "Un jalon exige que ses preuves soient approuvées. Un document ne vaut preuve approuvée que s'il pointe vers une pièce réelle sur un hôte de confiance — un document sans lien est une étiquette, et Meridian refuse de le compter.",
  "Why can I not approve my own document?": "Pourquoi ne puis-je pas approuver mon propre document ?",
  "Whoever owns a piece of evidence never approves it. Hand it to a colleague or to your programme office: an approval means somebody else looked.":
    "Celui qui possède une preuve ne l'approuve jamais. Confiez-la à un collègue ou à votre bureau de programme : une approbation veut dire que quelqu'un d'autre a regardé.",
  "The link in an approved document is dead. What happens?": "Le lien d'un document approuvé est mort. Que se passe-t-il ?",
  "Meridian checks periodically and shows it in the library — but it never withdraws the approval on its own. Somebody who knows where the piece lives confirms it. A dropped link is not a governance decision.":
    "Meridian vérifie périodiquement et l'affiche en bibliothèque — mais il ne retire jamais l'approbation de lui-même. Quelqu'un qui sait où vit la pièce le confirme. Une liaison tombée n'est pas une décision de gouvernance.",
  "How do I run a meeting?": "Comment animer un comité ?",
  "Open the occurrence: the agenda is already built from the book. Open it, record decisions and actions as you go, then close it. Closing freezes the pack, so what was discussed can be produced again.":
    "Ouvrez l'occurrence : l'ordre du jour est déjà construit sur le livre. Ouvrez la séance, consignez décisions et actions au fil de l'eau, puis clôturez. Clore fige le dossier, pour que ce qui a été discuté puisse être reproduit.",
  "Something is above my authority. How do I escalate?": "Quelque chose dépasse mon autorité. Comment le faire remonter ?",
  "Refer it from the meeting. The broader room picks it up on their next agenda automatically, and their decision retires the referral — you do not chase it.":
    "Renvoyez-le depuis le comité. La salle supérieure le reprend automatiquement à son ordre du jour suivant, et sa décision solde le renvoi — vous n'avez pas à le relancer.",
  "Where do I find a decision taken months ago?": "Où retrouver une décision prise il y a des mois ?",
  "Meetings & decisions keeps every minute. The trail is append-only, so a decision reads today exactly as it read then.":
    "Réunions & décisions garde toutes les minutes. La piste est en ajout seul : une décision se lit aujourd'hui exactement comme elle se lisait alors.",
  "How do I record real effort?": "Comment consigner l'effort réel ?",
  "Resources, then Record effort. Four fields, once a week. It sits beside the plan rather than inside it — the gap between the two is the point.":
    "Ressources, puis Consigner l'effort. Quatre champs, une fois par semaine. Cela se place à côté du plan et non dedans — c'est l'écart entre les deux qui compte.",
  "I am going on rotation. Who covers me?": "Je pars en rotation. Qui me couvre ?",
  "Declare the absence on My site and name a deputy. They take your authority for that period — never more than yours — and the trail names you both. When you come back, your digest widens to cover the days you missed.":
    "Déclarez l'absence sur Mon site et nommez un suppléant. Il prend votre autorité pour cette période — jamais plus que la vôtre — et la piste vous nomme tous les deux. À votre retour, votre digest s'élargit pour couvrir les jours manqués.",
  "How do I stop being told things at night?": "Comment ne plus être prévenu la nuit ?",
  "Notification preferences, next to your name. Choose the cadence and the quiet hours; urgent messages still come through, because a silence you cannot pierce is a silence people switch off.":
    "Préférences de notification, à côté de votre nom. Choisissez la cadence et les heures de silence ; les messages urgents passent quand même, parce qu'un silence qu'on ne peut pas percer est un silence qu'on désactive.",

  // A-12 · le référent du site
  "Stuck? Ask ": "Bloqué ? Demandez à ",
  ", the Meridian referent for ": ", le référent Meridian de ",
  " — before the group, because they are on your site and know your work.":
    " — avant le groupe, parce qu'il est sur votre site et connaît votre travail.",
  "No referent is named for your site yet. An administrator can name one in Administration → Sites — and until they do, questions go to the group, which is slower.":
    "Aucun référent n'est encore nommé pour votre site. Un administrateur peut en désigner un dans Administration → Sites — et tant que ce n'est pas fait, les questions partent au groupe, ce qui est plus lent.",

  // A-11 · le terrain d'apprentissage
  "Training ground": "Terrain d'apprentissage",
  "Nothing here touches the real book. Break things on purpose — that is what it is for.":
    "Rien ici ne touche au livre réel. Cassez des choses exprès — c'est fait pour.",

  // A-09 · la conduite de séance, au moment où elle sert
  "Closed. The pack is frozen: it reads today exactly as it read in the room, and it can be produced again.":
    "Close. Le dossier est figé : il se lit aujourd'hui exactement comme il se lisait dans la salle, et il peut être reproduit.",
  "In session. Record each decision as it is taken and each action with an owner and a date. Refer anything above this room's authority — the broader agenda picks it up by itself. Close the meeting when you are done: closing is what freezes the record.":
    "En séance. Consignez chaque décision au moment où elle est prise, et chaque action avec un responsable et une date. Renvoyez ce qui dépasse l'autorité de cette salle — l'ordre du jour supérieur le reprend de lui-même. Clôturez quand vous avez fini : c'est la clôture qui fige le compte rendu.",
  "Scheduled. The agenda below is built from the book as it stands now, and rebuilds when you open the meeting. Open it when the room is ready.":
    "Programmée. L'ordre du jour ci-dessous est construit sur le livre tel qu'il est maintenant, et se reconstruit à l'ouverture de la séance. Ouvrez-la quand la salle est prête.",

  // ── A-08 · la mesure de l'adoption
  "Adoption": "Adoption",
  "How the tool is used": "Comment l'outil est utilisé",
  "Measuring…": "Mesure en cours…",
  "Reading how the tool is actually used, site by site.":
    "Lecture de l'usage réel de l'outil, site par site.",
  "Sites measured": "Sites mesurés",
  "over the last ": "sur les ",
  " days": " derniers jours",
  "Sites gone quiet": "Sites devenus muets",
  "every site has updated something": "chaque site a mis quelque chose à jour",
  "Refusals per active user": "Refus par utilisateur actif",
  "how often people meet a wall": "à quelle fréquence les gens se heurtent à un mur",
  "Adoption by site": "Adoption par site",
  "Six numbers, as at ": "Six chiffres, arrêtés au ",
  ". A site silent for ": ". Un site silencieux depuis ",
  " days is named — nothing else in Meridian would say it.":
    " jours est nommé — rien d'autre dans Meridian ne le dirait.",
  "Site": "Site",
  "Accounts seen": "Comptes revus",
  "Last progress": "Dernier avancement",
  "never": "jamais",
  "d ago": "j",
  "Meetings held": "Comités tenus",
  "Actions closed": "Actions closes",
  "Weeks entered": "Semaines saisies",
  "No sites in the book yet.": "Aucun site au portefeuille pour l'instant.",
  "These are counts by site, never by person. Refusals are counted for the whole portfolio because a refusal happens on a resource OUTSIDE somebody's scope — charging it to that resource's site would say the opposite of what it means.":
    "Ce sont des comptages par site, jamais par personne. Les refus valent pour tout le portefeuille : un refus survient sur une ressource HORS du périmètre de quelqu'un, et l'imputer au site de cette ressource dirait le contraire de ce qu'il signifie.",

  // ── N-07 · le contrôle de vie de la preuve
  "The last check did not reach this link. The approval is untouched.":
    "Le dernier contrôle n'a pas atteint ce lien. L'approbation reste intacte.",
  "The check was refused access — the piece may well be there.":
    "Le contrôle s'est vu refuser l'accès — la pièce est peut-être bien là.",
  "Answered at the last check: ": "A répondu au dernier contrôle : ",

  // ── N-06 · la survie hors ligne, en lecture seule
  "Offline — showing what was last loaded": "Hors ligne — affichage du dernier état chargé",
  "as at ": "arrêté au ",
  "nothing can be recorded until the link is back":
    "rien ne peut être consigné tant que la liaison n'est pas revenue",
  "Try again": "Réessayer",

  // ── N-05 · le centre de notification
  "Notifications": "Notifications",
  "Notification centre": "Centre de notification",
  "What is waiting for you": "Ce qui vous attend",
  "Unread": "Non lus",
  "addressed to you": "qui vous sont adressés",
  "Needs attention": "Demandent votre attention",
  "attention or urgent": "attention ou urgent",
  "In the box": "Dans la boîte",
  "kept for the retention period": "conservés selon la durée décidée",
  "Mark all read": "Tout marquer comme lu",
  "Show what I have already read": "Afficher ce que j'ai déjà lu",
  "Nothing unread — this is what a quiet week looks like.":
    "Rien à lire — c'est à cela que ressemble une semaine calme.",
  "Nothing here": "Rien ici",
  "Messages arrive when something is due, blocked, or owed to you. Your subscriptions decide what also reaches you by email.":
    "Un message arrive quand quelque chose vous est dû, vous attend ou vous bloque. Vos abonnements décident de ce qui vous parvient aussi par courriel.",
  "not sent yet": "pas encore envoyé",
  "on behalf of ": "au nom de ",
  "new": "nouveau",
  "info": "information",
  "attention": "attention",
  "urgent": "urgent",

  // ── A-06 · le score se lit au point d'usage
  "Fit": "Adéquation",
  "Effort": "Effort",
  "Risk and effort pull the score down": "Le risque et l'effort font BAISSER le score",
  "Four notes are needed — fit, value, risk and effort. An unscored project sorts last, not worst.":
    "Quatre notes sont nécessaires — adéquation, valeur, risque et effort. Un projet sans score se place en dernier, pas en pire.",
};

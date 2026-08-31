# Meridian IT-PMO — Manuel utilisateur

**Version 5.3.0 · 31/08/2026 · Français.** Le même manuel existe en
anglais : [`30-user-manual.md`](30-user-manual.md), avec en tête une
description du produit en cinq langues. L'interface elle-même parle les
deux langues — un bouton **EN / FR** se trouve à côté de votre nom dans
la barre latérale.

Un mot sur l'endroit où vit le manuel *vivant* : le comité d'adoption a
tranché qu'« un fichier Markdown de plus dans docs/ » ne serait jamais
lu sur un site minier ; le produit porte donc son propre guide —
**l'Aide, dans l'application**, organisée par tâche, avec des listes de
premiers pas par rôle. Ce document est le compagnon *écrit* : pour la
personne qui évalue Meridian sans compte, pour la formation, et pour
lire un processus de bout en bout avant de le faire. Si les deux
divergent, croyez celui qui est dans le produit — il est engendré
d'après la version qui tourne. Chaque affirmation ci-dessous a été
vérifiée contre la source par un comité de revue documentaire
([`32-comite-revue-documentation.md`](32-comite-revue-documentation.md)).

---

## 1 · Ce qu'est Meridian

Meridian est un outil auto-hébergé de gestion de portefeuille de
projets pour un groupe qui exploite plusieurs sites. Il couvre la vie
entière du portefeuille : l'entrée des demandes et la priorisation du
capital, la valeur acquise et le chemin critique, les jalons de
contrôle avec preuve vérifiée, les risques et la maîtrise des
changements, la capacité des ressources avec rotations et absences, un
livre de coûts multidevises, la réalisation des bénéfices, les
tolérances avec exceptions automatiques, un registre des
enseignements — et les réunions hebdomadaires et mensuelles qui
tournent au-dessus, engendrées depuis le portefeuille plutôt que tapées
dans un support.

Trois idées façonnent tout ce que vous toucherez :

- **L'autorité est une donnée.** Ce que vous pouvez faire est décidé
  par votre rôle, vos habilitations et le niveau de gouvernance de
  chaque projet — en un seul endroit, côté serveur. Quand un bouton
  est absent, l'écran dit pourquoi, en une phrase.
- **Le registre ne se réécrit pas.** Chaque modification est auditée
  avec son avant et son après ; les réunions closes et les périodes
  clôturées sont figées. Une correction est un acte nouveau et
  visible — jamais une retouche.
- **La réunion est engendrée.** Vous n'écrivez pas d'ordre du jour ;
  le portefeuille le fait. Vous consignez ce qui a été décidé, et cela
  retombe sur les projets concernés.

---

## 2 · Se connecter, et le premier quart d'heure

Ouvrez l'adresse que votre administrateur vous donne (une installation
locale neuve est `http://localhost:4173`). Sur une instance de
démonstration, l'écran de connexion liste dix comptes ; cliquer un nom
remplit l'adresse (les mots de passe sont dans le README).

**Si un administrateur a créé votre compte**, la première connexion
vous oblige à choisir votre propre mot de passe. Tant que ce n'est pas
fait, rien ne peut s'écrire — parce qu'à partir de là, la piste
d'audit attribue les actes à une personne que seule cette personne
peut être.

**La langue** — le bouton **EN / FR** à côté de votre nom bascule
l'interface. La langue des courriels que Meridian vous envoie est un
réglage à part — *les préférences de notification*, sous l'icône de
cloche — et suit l'interface par défaut.

**Les premiers pas** — ouvrez **l'Aide** (« ? »), puis *Utiliser
Meridian — premiers pas et réponses* → **Premiers pas**. Vous y
trouverez une liste *pour votre rôle* : choisir son mot de passe,
trouver *Ma semaine*, mettre à jour une étape, ouvrir un risque… Les
étapes se cochent quand le portefeuille porte la donnée correspondante
(ou, pour les étapes de repérage, dès que vous avez ouvert l'écran) —
pas parce qu'on a cliqué dessus.

**Où sont les choses** — la navigation compte cinq groupes :

| Groupe | Écrans |
|---|---|
| **Livrer** | Ma semaine · Notifications · Portefeuille · Feuille de route · Portefeuille de demandes · Programmes · Mon site · Vue projet · Planning · Kanban |
| **Piloter** | Risques & problèmes · Budget & coûts · Demandes de changement · Ressources |
| **Gouverner** | Réunions |
| **Consigner** | Documents · Rapports · Enseignements · Sites · Adoption |
| **Système** | Administration |

Les entrées sans usage pour votre compte sont simplement absentes — un
compte en lecture seule ne voit jamais Administration. **Ma semaine**
est la page d'arrivée de tout le monde : ce qui est dû *par vous* — vos
actions, vos projets qui passent à l'ambre, votre semaine d'effort non
consignée.

---

## 3 · Comprendre ce que vous pouvez faire, et pourquoi

Quatre rôles existent (les identifiants ci-dessous sont ceux
qu'affiche l'Administration) :

| Rôle | En bref |
|---|---|
| **admin** | Tout, y compris les comptes, les habilitations et les réglages. |
| **group** | Lit tout le portefeuille ; écrit dans les programmes qui lui sont accordés. Le rôle de gouvernance : décide les changements, approuve les preuves, clôture les périodes, pose les tolérances. |
| **site** | Lit ses sites plus les projets groupe qui y sont livrés ; n'écrit que les projets **gouvernés au site** dans ses sites accordés. |
| **viewer** | Lecture seule sur son périmètre. N'écrit rien, jamais. |

Chaque projet est gouverné au niveau **groupe** ou au niveau **site**,
et ce seul fait — pas qui l'a créé, pas où il s'exécute — décide qui
peut le modifier, le re-référencer, y engager de l'argent ou approuver
son jalon de contrôle.

Deux conséquences que vous rencontrerez chaque jour :

- Sur un **projet groupe livré sur votre site**, vos commandes sont en
  lecture seule, et l'écran le dit en une phrase. Votre voix, c'est la
  **préoccupation** : signalez-en une depuis *Mon site* (« Signaler
  une préoccupation »), et elle paraît — au nom de votre site — au
  prochain ordre du jour du bureau de programme.
- **On ne décide jamais son propre acte.** Qui émet un changement ne
  l'approuve pas ; qui livre un bénéfice ne juge pas qu'il est
  atteint ; qui possède un document ne l'approuve pas comme preuve ;
  un site ne fixe pas sa propre tolérance. Là où vous attendez un
  bouton et n'en voyez pas, cette séparation en est souvent la
  raison — et la phrase à l'écran dit laquelle. Une exception
  délibérée : le rôle **admin** passe outre ces séparations — un
  bris de glace que le code lui-même annote — raison de plus pour
  garder peu de comptes admin.

Quand quelque chose est refusé, le refus énonce toujours sa raison,
dans votre langue. Il n'y a pas d'échec silencieux.

---

## 4 · Le travail de tous les jours — projets et livraison

### Créer un projet

Deux portes. **Portefeuille de demandes** → convertir une demande
*approuvée* — la voie normale, parce qu'elle garde la trace de l'idée
jusqu'au projet. Ou l'action **Nouveau projet**, proposée sur le
Portefeuille, les Programmes, Mon site et le Planning : un compte de
niveau groupe crée dans ses programmes accordés, et un compte de site
peut créer un projet **gouverné au site** dans un site accordé. Un
projet porte son programme, son site de tête, son niveau de
gouvernance, sa méthode, ses dates, son budget et sa provision.

### La page projet

*Vue projet* est la surface de travail : choisissez un projet et ses
registres tiennent sur une page — le plan d'étapes, les jalons et
jalons de contrôle, les éléments RAID ouverts, l'équipe et les
affectations, la position de coûts, la valeur et les bénéfices, la
marge dans laquelle il travaille (tolérance et exceptions), l'usine et
le déploiement par vagues, et les éléments SDP liés. Les demandes de
changement s'émettent depuis l'en-tête et se décident sur l'écran
*Demandes de changement* ; la preuve de jalon vit dans la bibliothèque
*Documents*, à un clic du panneau des jalons de contrôle. Deux boutons
d'en-tête à connaître : **Copier le statut** copie un résumé Markdown
pour courriel ou messagerie, et **le dossier de preuve** télécharge
tout ce qui est au dossier pour ce projet, arrêté à la date de votre
choix, en fichier Markdown.

### L'avancement, et ce que disent les indices

Mettez à jour le pourcentage de chaque étape dans le **plan
d'étapes**. Le moteur calcule la valeur acquise à partir du poids des
étapes. (Le **Kanban** suit les éléments de travail et les limites
d'encours — déplacer une carte ne consigne pas d'avancement d'étape.)

- **SPI** — performance de délai : sous 1,0, en retard pour le travail
  accompli.
- **CPI** — performance de coût : sous 1,0, trop cher pour le travail
  accompli.
- **EAC / VAC** — où atterrit le coût si la performance se maintient.

Les seuils (ambre à 0,95, rouge à 0,90 par défaut) colorent le
portefeuille. Tant que 2 % du plan ne sont pas planifiés *et* 0,5 %
réellement comptabilisés, un projet affiche « — » : **trop tôt pour
mesurer** est une réponse, pas un trou. La santé est calculée (RAG —
vert/ambre/rouge) mais peut être **forcée à la main avec une raison
écrite** (« Définir le statut » sur la page projet) ; la raison voyage
avec la pastille partout où elle s'affiche, et revenir à « déduit des
indices » retire le forçage.

### Planning et dépendances

Les étapes ont des dates, des dates de référence et des liens
fin-début ; le chemin critique et la marge de chaque étape sont
calculés sur le projet. À l'intérieur d'un projet, une étape qui mord
sur sa précédente de plus de cinq jours au-delà de ce que la référence
admettait déjà se signale sur le **Planning**. Les dépendances entre
projets se tracent sur le planning directeur intégré pour que la
collision se voie — elles ne sont pas contrôlées en tolérance.
**Re-référencer est un acte de niveau groupe** — cela déplace les
dates sur lesquelles le groupe s'est engagé.

### Risques, problèmes, et le registre RAID

Tout ce qui pourrait coûter du temps ou de l'argent appartient à
**Risques & problèmes** avant que cela n'arrive — comme risque,
problème, hypothèse ou dépendance (les quatre natures RAID, affichées
en anglais : *Risk, Issue, Assumption, Dependency*). Probabilité ×
impact (1–5 chacun) situe l'exposition par paliers ; les éléments à
forte exposition remontent d'eux-mêmes aux ordres du jour de pilotage.
Les éléments de portée portefeuille (un manque de ressources
disponibles qui n'appartient à aucun projet) sont permis. Les
préoccupations signalées par un site portent le nom du site.

### Demandes de changement

Émettez depuis le projet ou **Demandes de changement** : ce qui
change, l'écart de coût, l'écart de semaines, la source de
financement. Toute demande parcourt la même chaîne de quatre étapes —
chef de projet, autorité de changement, finance, pilotage — et le
seuil de pilotage décide *qui peut signer* : au-delà (en coût ou en
semaines), seul un compte de niveau groupe le peut. *L'approbation
applique les écarts* au budget, aux dates et à la provision. On
n'approuve pas ce qu'on a émis.

### L'argent

**Budget & coûts** porte le livre. Une ligne de coût a une période, un
montant, capex/opex, une devise et le taux de change *au moment de la
comptabilisation*. Une erreur se corrige par une **écriture
d'annulation** (une contre-passation), jamais par une retouche — le
livre doit se réconcilier, et l'écriture d'origine comme son
annulation restent visibles. Les **engagements** (bons de commande
émis, argent promis mais pas encore comptabilisé) sont suivis à part
et pèsent sur l'enveloppe. Comptabiliser un coût et libérer la
provision sont des actes de niveau groupe.

### Les personnes, la capacité, le réel, les absences

**Ressources** répartit les affectations par plages en semaines ; la
capacité effective d'une personne est son pourcentage de
**disponibilité** (sa rotation — « 4/2 », « 14/14 » — et son statut de
prestataire sont consignés dans l'annuaire pour l'œil du
planificateur, pas fondus dans l'arithmétique). **Consigner
l'effort**, sous Ressources, est volontairement minimal — personne,
projet, semaine, jours — et s'affiche *à côté* du plan : c'est l'écart
qui compte. Déclarez les **absences** avec un suppléant facultatif :
le suppléant se connecte comme lui-même et *agit pour* l'absent, dans
la limite de l'autorité de celui-ci et jamais plus ; la piste nomme
les deux. À votre retour, le **digest** des Rapports est dimensionné
pour couvrir le temps passé loin du site.

---

## 5 · Le travail de gouvernance

### Jalons de contrôle et preuve

Quatre jalons de contrôle ponctuent un projet — l'interface les nomme
en anglais : **Gate 1 — Mandate** (le mandat), **Gate 2 — Design
authority** (l'autorité de conception), **Gate 3 — Readiness** (l'état
de préparation), **Gate 4 — Benefits** (les bénéfices) — chacun
exigeant des documents de preuve nommés. Un jalon de contrôle ne se
franchit pas tant que sa preuve n'est pas **Approuvée**, et approuver
est un pouvoir distinct de modifier : le document doit pointer (https)
vers un artefact réel sur l'un des **hôtes de preuve de confiance**
posés dans l'Administration, l'empreinte du lien est relevée à
l'approbation, et le changer ensuite fait retomber le document « En
revue ». Une sonde de fond revérifie les liens approuvés et signale —
après trois échecs consécutifs — une preuve qui ne répond plus ; le
signal ne désapprouve jamais rien, parce qu'une liaison satellite qui
tombe une nuit n'est pas une preuve perdue.

### Demandes et priorisation

**Portefeuille de demandes** est l'entonnoir : quiconque peut écrire
peut **émettre** une demande ; **décider** — trier, approuver,
refuser — est un travail de niveau groupe, et un refus consigne sa
raison comme toute décision. Les demandes approuvées se convertissent
en projets, trace intacte. Notez l'adéquation, la valeur, le risque et
l'effort (1–5 chacun — un modèle qu'une salle peut garder en tête),
posez **l'enveloppe d'investissement** depuis l'en-tête de l'écran, et
voyez quels projets tiennent dans l'argent et lesquels passent sous la
ligne. La salle peut passer outre la note en plaçant le rang à la
main — la note classe, elle ne décide jamais.

### Tolérances et exceptions

Un utilisateur de niveau groupe pose la **marge** de chaque projet :
jours au-delà de la fin de référence, % au-delà du budget, points sous
la cible de bénéfice — le périmètre, la qualité et le risque sont
*énoncés en toutes lettres*, pas prétendument calculés. Dès lors, un
balayage horaire surveille les mêmes chiffres que les écrans, et un
franchissement **lève une exception tout seul** — personne n'a à
porter la mauvaise nouvelle. Une exception ne se ferme que par une
**réponse** du niveau qui a accordé la marge — *Marge relevée, Plan
révisé, Dépassement accepté* ou *Projet arrêté* — jamais parce que la
prévision est repassée dessous.

### Bénéfices et le verdict

Les promesses de chaque projet vivent comme des **bénéfices** dans
leurs propres unités — tonnes, heures de disponibilité, coût à
l'once — avec référence, cible et réel mesuré. Le projet consigne ce
qui a été mesuré ; dire si cela compte comme **atteint** est un
verdict de niveau groupe (`benefit.review`), et l'unique **revue
post-mise en œuvre** du projet se consigne de la même façon.

### Enseignements

Qui l'a vécu le consigne — ce qui s'est passé, pourquoi, quoi faire
autrement, dans l'une des onze catégories ISO 21502, les issues
positives comprises. **Adopter** un enseignement est un acte de niveau
groupe : l'adoption est ce qui le rend visible aux autres sites. Avant
de démarrer un projet, lisez le registre des **Enseignements** filtré
par votre programme et votre site — c'est à cela qu'il sert.

### Les rapports, et la clôture de période

**Rapports** montre le dossier hebdomadaire/mensuel vivant — les
narratifs s'éditent en place et se conservent de semaine en semaine.
Pour gouverner plutôt que conduire, **clôturez la période** : la
clôture fige ce qui a été rapporté, projet par projet, pour que le
chiffre que la direction a vu en mars puisse être reproduit en juin.
Une période close ne s'édite pas — la base elle-même refuse. Une
correction est une **rectification** : une nouvelle période qui nomme
celle qu'elle corrige, au dossier. Le **digest** résume ce qui a
changé depuis votre dernier passage — dimensionné pour couvrir une
rotation loin du site.

---

## 6 · Les réunions

Le module pour lequel le reste existe. Une **série** a une cadence et
un périmètre (groupe / programme / site) ; chaque tenue est une
**occurrence**.

1. **Ouvrez** l'occurrence. L'ordre du jour est engendré *maintenant*,
   depuis l'état vivant : les séries hebdomadaires reçoivent un ordre
   du jour par exception (rien à dire d'un projet signifie qu'il n'y
   figure pas), les mensuelles le dossier de pilotage complet —
   position, jalons de contrôle, argent, bénéfices. Les sections vides
   sont omises — sauf *les actions reportées*, toujours présentes,
   qui disent « registre à jour » quand il l'est.
2. **Tenez-la.** Faites l'appel (les suppléants consignés comme tels).
   Consignez les **décisions** — dites *ce qui a été décidé*, pas
   qu'une décision a eu lieu ; ce sera relu des mois plus tard.
   Consignez les **actions** avec un porteur et une date.
3. Une décision au-delà de l'autorité de la salle est **renvoyée au
   niveau supérieur** : elle ouvre le prochain ordre du jour de la
   série plus large jusqu'à ce qu'une décision là-bas y réponde. Les
   actions des séries plus larges atterrissent sur les ordres du jour
   plus étroits marquées de leur origine — la délégation descend
   visiblement.
4. **Clôturez** l'occurrence. L'ordre du jour tel que discuté est figé
   mot pour mot ; les décisions deviennent immuables ; les actions
   ouvertes poursuivent leur porteur d'ordre du jour en ordre du jour
   jusqu'à leur clôture. Le **compte rendu** tient en un clic, et
   l'entrée d'agenda (**ICS**) se télécharge pour la série ou
   l'occurrence.

---

## 7 · Les notifications

Meridian va trouver les gens plutôt que d'attendre leur visite.
Quatre choses sont émises aujourd'hui : une action qui arrive à
échéance ou en retard, un jalon de contrôle bloqué, un lien de preuve
approuvé qui ne répond plus, et un franchissement de tolérance. (Le
vocabulaire en réserve d'autres — décision due, préoccupation
signalée, site silencieux, semaine d'effort manquante, un digest par
courriel — définis mais pas encore alimentés ; le digest à l'écran,
dans les Rapports, couvre ce terrain entre-temps.)

Le **centre de notification** (Livrer → Notifications) est votre
boîte : tout ce qui vous est adressé y arrive, toujours, avec l'état
lu et traité. Sous l'icône de cloche, **les préférences de
notification** règlent la langue de vos courriels et votre cadence
(immédiat, quotidien, hebdomadaire, coupé). Les abonnements plus
fins — par nature et gravité minimale — et les heures de silence,
lues dans le fuseau de *votre site*, existent dans l'API avant leur
écran ; un administrateur ou une intégration peut les poser pour
vous. Les messages ne quittent le bâtiment que par le webhook sortant
qu'un administrateur configure (`MERIDIAN_NOTIFY_URL`, borné par la
liste des hôtes de destination autorisés — fermée par défaut) ;
jusque-là, l'Administration montre la file de ce qui aurait été
envoyé.

---

## 8 · L'administration (rôle admin)

Tout est sous **Système → Administration** :

- **Comptes et habilitations** — créer les comptes (la première
  connexion force le changement de mot de passe), accorder les
  programmes ou les sites un par un, désactiver. Les personnes, les
  sites (fenêtres, référents, état de préparation), les programmes et
  les colonnes du Kanban s'éditent ici aussi.
- **La reprise de l'existant** — le panneau CSV : télécharger le
  modèle, coller ou choisir un fichier, lire l'aperçu ligne à ligne,
  puis appliquer — tout ou rien. Projets, personnes et jalons ; la
  porte d'entrée du livre existant d'un site. (L'import du livre JSON
  v4 et la restauration d'archive sont les deux autres portes.)
- **Réglages** — les seuils RAG, le seuil de pilotage, les **hôtes de
  preuve de confiance** (fermés par défaut : tant qu'aucun hôte n'est
  nommé, rien ne peut être approuvé comme preuve), la conservation des
  notifications (la purge refuse de tourner tant qu'une durée n'est
  pas décidée), les hôtes de destination autorisés, le nom de
  l'organisation, la date d'arrêté. (L'enveloppe d'investissement se
  pose depuis l'écran Portefeuille de demandes, là où la file se
  classe.)
- **Systèmes branchés** — émettre une clé d'API nommée et à portée
  limitée par intégration (montrée une fois, conservée seulement en
  empreinte), changer ce qu'elle peut faire, la faire tourner, la
  révoquer. Chaque acte d'une clé est audité sous son nom. La
  fédération SDP (actions et changements opérationnels liés, jamais
  copiés) se configure ici aussi.
- **La piste d'audit** — la trace complète, cherchable, avec images
  avant/après. Un administrateur peut recréer une ligne de registre
  **supprimée** (éléments RAID, documents, jalons, éléments de
  travail, bénéfices, engagements, vagues, fenêtres, absences) depuis
  son image d'audit — un acte lui-même audité ; les modifications ne
  se rejouent pas en arrière.
- **La continuité** — l'export d'archive (`npm run restore` recharge
  dans une instance vide — la porte de sortie, toujours ouverte), la
  passation d'administrateur, et **Mettre fin à toutes les sessions**,
  qui déconnecte tous les comptes de l'instance, le vôtre compris.
- **Adoption** — l'usage par site : comptes revus, dernier avancement,
  comités tenus, actions closes, semaines saisies. Des comptages,
  jamais de la surveillance.

Le déploiement opérationnel — y compris l'installateur Windows
`.exe` — est dans [`29-technical-reference.md` §8](29-technical-reference.md) ;
la posture de sécurité et ce qui reste à votre charge dans
[`SECURITY.md`](../SECURITY.md).

---

## 9 · S'exercer, s'aider, se débloquer

- **Le terrain d'apprentissage** — `npm run training` démarre un livre
  séparé sur `:4180` qui ne touche jamais le livre réel, et se remet à
  zéro à la demande. Rien ici ne touche au livre réel — cassez des
  choses exprès.
- **L'Aide, dans l'application** — le manuel par tâche, l'aide de
  champ sur chaque formulaire, et la liste de premiers pas de votre
  rôle.
- **Le référent de votre site** — chaque site nomme la personne à
  appeler en premier ; l'Aide affiche son nom avant de proposer le
  groupe.
- **« Quelqu'un d'autre a modifié cet enregistrement — rechargez puis
  réessayez »** — deux personnes ont édité la même ligne ; Meridian
  refuse l'écrasement silencieux. Rechargez, relisez l'état à jour,
  refaites votre modification.
- **Un bouton manque** — lisez la phrase à sa place : elle nomme
  l'autorité qui vous manque ou la séparation des rôles en jeu.
- **La connexion boucle sur une installation en réseau local** —
  l'instance émet des cookies Secure sans HTTPS ; l'administrateur
  retire `MERIDIAN_SECURE_COOKIES`. Voir la référence technique.

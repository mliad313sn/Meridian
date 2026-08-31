# Meridian IT-PMO — Manuel utilisateur

**Version 5.3.0 · 31/08/2026 · Français.** Le même manuel existe en
anglais : [`30-user-manual.md`](30-user-manual.md), avec en tête une
description du produit en cinq langues. L'interface elle-même parle les
deux langues — le changement se fait à tout moment depuis le menu sous
votre nom.

Un mot sur l'endroit où vit le manuel *vivant* : le comité d'adoption a
tranché qu'« un fichier Markdown de plus dans docs/ » ne serait jamais
lu sur un site minier ; le produit porte donc son propre guide —
**l'Aide, dans l'application**, organisée par tâche, avec des listes de
premiers pas qui se cochent d'elles-mêmes à mesure que la donnée réelle
arrive. Ce document est le compagnon *écrit* : pour la personne qui
évalue Meridian sans compte, pour la formation, et pour lire un
processus de bout en bout avant de le faire. Si les deux divergent,
croyez celui qui est dans le produit — il est engendré contre la
version qui tourne.

---

## 1 · Ce qu'est Meridian

Meridian est un outil auto-hébergé de gestion de portefeuille de
projets pour un groupe qui exploite plusieurs sites. Il couvre la vie
entière du portefeuille : l'entrée des demandes et la priorisation du
capital, la valeur acquise et le chemin critique, les jalons avec
preuve vérifiée, les risques et la maîtrise des changements, la
capacité des ressources avec rotations et absences, un livre de coûts
multidevises, la réalisation des bénéfices, les tolérances avec
exceptions automatiques, un registre des enseignements — et les
réunions hebdomadaires et mensuelles qui tournent au-dessus,
engendrées depuis le portefeuille plutôt que tapées dans un support.

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

**La langue** — le menu sous votre nom bascule français ↔ anglais.
Votre choix décide aussi de la langue des courriels que Meridian vous
envoie.

**Les premiers pas** — ouvrez **l'Aide**. Vous y trouverez une liste
*pour votre rôle* dont les étapes se cochent quand le travail réel est
fait (pas quand on clique dessus) : choisir son mot de passe, trouver
*Ma semaine*, mettre à jour une étape, lever un risque… C'est la
visite honnête la plus rapide du produit.

**Où sont les choses** — la navigation compte cinq groupes :

| Groupe | Écrans |
|---|---|
| **Livrer** | Ma semaine · Notifications · Portefeuille · Feuille de route · Portefeuille de demandes · Programmes · Mon site · Vue projet · Planning · Kanban |
| **Piloter** | Risques & problèmes · Budget & coûts · Demandes de changement · Ressources |
| **Gouverner** | Réunions |
| **Consigner** | Documents · Rapports · Enseignements · Sites · Adoption |
| **Système** | Administration |

Les entrées sans usage pour votre compte sont simplement absentes — un
lecteur ne voit jamais Administration. **Ma semaine** est la page
d'arrivée de tout le monde : ce qui est dû *par vous* — vos actions,
vos projets qui passent à l'orange, votre semaine d'effort non saisie.

---

## 3 · Comprendre ce que vous pouvez faire, et pourquoi

Quatre rôles existent :

| Rôle | En bref |
|---|---|
| **admin** | Tout, y compris les comptes, les habilitations et les réglages. |
| **groupe** | Lit tout le portefeuille ; écrit dans les programmes qui lui sont accordés. Le rôle de gouvernance : décide les changements, approuve les preuves, clôture les périodes, pose les tolérances. |
| **site** | Lit ses sites plus les projets groupe qui y sont livrés ; n'écrit que les projets **gouvernés au site** dans ses sites accordés. |
| **lecteur** | Lit son périmètre. N'écrit rien, jamais. |

Chaque projet est gouverné au niveau **groupe** ou au niveau **site**,
et ce seul fait — pas qui l'a créé, pas où il s'exécute — décide qui
peut le modifier, le re-référencer, y engager de l'argent ou approuver
son jalon.

Deux conséquences que vous rencontrerez chaque jour :

- Sur un **projet groupe livré sur votre site**, vos commandes sont en
  lecture seule, et l'écran le dit en une phrase. Votre voix, c'est la
  **préoccupation** : levez-en une depuis *Mon site*, et elle paraît —
  au nom de votre site — au prochain ordre du jour du bureau de
  programme.
- **On ne décide jamais son propre acte.** Qui lève un changement ne
  l'approuve pas ; qui livre un bénéfice ne juge pas qu'il est
  atteint ; qui possède un document ne l'approuve pas comme preuve ;
  un site ne fixe pas sa propre tolérance. Là où vous attendez un
  bouton et n'en voyez pas, cette séparation en est souvent la
  raison — et la phrase à l'écran dit laquelle.

Quand quelque chose est refusé, le refus énonce toujours sa raison,
dans votre langue. Il n'y a pas d'échec silencieux.

---

## 4 · Le travail de tous les jours — projets et livraison

### Créer un projet

Deux portes. **Portefeuille de demandes** → convertir une demande
*approuvée* — la voie normale, parce qu'elle garde la trace de l'idée
jusqu'au projet. Ou **Portefeuille → Nouveau projet** (niveau groupe)
pour un projet décidé ailleurs. Un projet porte son programme, son
site de tête, son niveau de gouvernance, sa méthode, ses dates, son
budget et sa réserve pour aléas.

### La page projet

*Vue projet* est la surface de travail : choisissez un projet et tous
ses registres tiennent sur une page — plan d'étapes, jalons, risques,
changements, argent, bénéfices, documents, vagues, la marge dans
laquelle il travaille, les éléments opérationnels liés, et les
enseignements que d'autres projets lui ont laissés. Le bouton
**extrait de statut** copie un résumé Markdown pour courriel ou
messagerie ; **tout ce qui est au registre** montre le projet tel
qu'il était à une date.

### L'avancement, et ce que disent les indices

Mettez à jour le pourcentage de chaque étape dans le **plan d'étapes**
(ou déplacez la carte sur le **Kanban**). Le moteur calcule la valeur
acquise à partir du poids des étapes :

- **SPI** — performance de délai : sous 1,0, en retard pour le travail
  accompli.
- **CPI** — performance de coût : sous 1,0, trop cher pour le travail
  accompli.
- **EAC / VAC** — où atterrit le coût si la performance se maintient.

Les seuils (orange à 0,95, rouge à 0,90 par défaut) colorent le
portefeuille. Un projet qui a dépensé moins de 2 % de son plan affiche
« — » : **trop tôt pour mesurer** est une réponse, pas un trou. La
santé est calculée (vert/orange/rouge) mais peut être **forcée à la
main avec une raison écrite** — la raison voyage avec la pastille
partout où elle s'affiche.

### Planning et dépendances

Les étapes ont des dates, des dates de référence et des liens
fin-début ; le chemin critique et la marge de chaque étape sont
calculés sur le projet. Les dépendances entre projets se tracent sur
**Planning** (le planning directeur intégré) ; une dépendance qui
atterrit après ce qui en dépend tolère cinq jours, puis se signale.
**Re-référencer est un acte de niveau groupe** — cela déplace les
dates sur lesquelles le groupe s'est engagé.

### Risques, problèmes, et le registre

Tout ce qui pourrait coûter du temps ou de l'argent appartient à
**Risques & problèmes** avant que cela n'arrive. Probabilité × impact
(1–5 chacun) borne l'exposition ; les éléments à forte exposition
remontent d'eux-mêmes aux ordres du jour de pilotage. Les éléments de
portée portefeuille (une pénurie de banc qui n'appartient à aucun
projet) sont permis. Les préoccupations levées par un site portent le
nom du site.

### Demandes de changement

Levez depuis le projet ou **Demandes de changement** : ce qui change,
l'écart de coût, l'écart de semaines, la source de financement. La
demande s'oriente elle-même dans une chaîne d'approbation selon sa
taille — sous le seuil CCB un approbateur, au-dessus la chaîne
complète — et *l'approbation applique les écarts* au budget, aux dates
et à la réserve. On n'approuve pas ce qu'on a levé.

### L'argent

**Budget & coûts** porte le livre. Une ligne de coût a une période, un
montant, capex/opex, une devise et le taux de change *au moment de la
comptabilisation*. Une erreur se corrige par une **ligne d'extourne**,
jamais par une retouche — le livre doit se réconcilier. Les
**engagements** (bons de commande émis, argent promis mais pas encore
comptabilisé) sont suivis à part et pèsent sur l'enveloppe.
Comptabiliser un coût et libérer la réserve sont des actes de niveau
groupe.

### Les personnes, la capacité, le réel, les absences

**Ressources** répartit les affectations par plages en semaines. La
capacité *effective* d'une personne tient compte de la rotation
(« 4/2 », « 14/14 ») et de la disponibilité ; les prestataires sont
marqués comme tels. La **saisie du réel** est volontairement minimale
— personne, projet, semaine, jours — et s'affiche *à côté* du plan :
l'écart est le propos. Déclarez les **absences** avec un suppléant
facultatif : le suppléant se connecte alors comme lui-même et *agit
pour* l'absent, dans la limite de l'autorité de celui-ci et jamais
plus ; la piste nomme les deux. Les notifications adressées à votre
suppléant en votre nom vous sont listées à votre retour.

---

## 5 · Le travail de gouvernance

### Jalons et preuve

Quatre jalons ponctuent un projet : **Mandat, Autorité de conception,
Aptitude, Bénéfices** — chacun exigeant des documents de preuve
nommés. Un jalon ne se franchit pas tant que sa preuve n'est pas
**Approuvée**, et approuver est un pouvoir distinct de modifier : le
document doit pointer (https) vers un artefact réel sur l'un des
**hôtes de confiance** configurés par le mandant, le lien est pris
d'empreinte à l'approbation, et le changer ensuite fait retomber le
document « En revue ». Une sonde de fond revérifie les liens approuvés
et signale — après trois échecs consécutifs — une preuve qui ne
répond plus ; le signal ne désapprouve jamais rien, parce qu'une
liaison satellite qui tombe une nuit n'est pas une preuve perdue.

### Demandes et priorisation

**Portefeuille de demandes** est l'entonnoir : quiconque peut écrire
peut **déposer** une demande ; **décider** — trier, approuver,
décliner — est un travail de niveau groupe, et un refus consigne sa
raison comme toute décision. Les demandes approuvées se convertissent
en projets, trace intacte. Notez l'adéquation, la valeur, le risque et
l'effort (1–5 chacun — un modèle qu'une salle peut garder en tête),
classez contre **l'enveloppe d'investissement**, et voyez quels
projets tiennent dans l'argent et lesquels passent sous la ligne. La
salle peut passer outre la note en plaçant le rang à la main — la note
classe, elle ne décide jamais.

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
verdict de niveau groupe, et l'unique **revue post-mise en œuvre** du
projet se consigne de la même façon.

### Enseignements

Qui l'a vécu le consigne — ce qui s'est passé, pourquoi, quoi faire
autrement, dans l'une des onze catégories ISO 21502, les issues
positives comprises. **Adopter** un enseignement est un acte de niveau
groupe : l'adoption est ce qui le rend visible aux autres sites, et
les nouveaux projets se voient présenter au démarrage les
enseignements adoptés pertinents pour leur programme et leur site.

### Les rapports, et la clôture de période

**Rapports** montre le dossier hebdomadaire/mensuel vivant — les
narratifs s'éditent en place et se conservent de semaine en semaine.
Pour gouverner plutôt que conduire, **clôturez la période** : la
clôture fige ce qui a été rapporté, projet par projet, pour que le
chiffre que le conseil a vu en mars puisse être reproduit en juin. Une
période close ne s'édite pas — la base elle-même refuse. Une
correction est un **retraitement** : une nouvelle période qui nomme
celle qu'elle corrige, au registre. Le **digest** résume ce qui a
changé depuis votre dernier passage — dimensionné pour couvrir une
rotation loin du site.

---

## 6 · Les réunions

Le module pour lequel le reste existe. Une **série** a une cadence et
une portée (groupe / programme / site) ; chaque tenue est une
**occurrence**.

1. **Ouvrez** l'occurrence. L'ordre du jour est engendré *maintenant*,
   depuis l'état vivant : les séries hebdomadaires reçoivent un ordre
   du jour par exception (rien à dire d'un projet signifie qu'il n'y
   figure pas), les mensuelles le dossier de pilotage complet —
   position, jalons, argent, bénéfices. Les sections vides sont
   omises, jamais montrées vides.
2. **Tenez-la.** Faites l'appel (les suppléants consignés comme tels).
   Consignez les **décisions** — dites *ce qui a été décidé*, pas
   qu'une décision a eu lieu ; ce sera relu des mois plus tard.
   Consignez les **actions** avec un porteur et une date.
3. Une décision au-delà de l'autorité de la salle est **renvoyée vers
   le haut** : elle ouvre le prochain ordre du jour de la série plus
   large jusqu'à ce qu'une décision là-bas y réponde. Les actions des
   séries plus larges atterrissent sur les ordres du jour plus étroits
   marquées de leur origine — la délégation descend visiblement.
4. **Clôturez** l'occurrence. L'ordre du jour tel que discuté est figé
   mot pour mot ; les décisions deviennent immuables ; les actions
   ouvertes poursuivent leur porteur d'ordre du jour en ordre du jour
   jusqu'à leur clôture. Le **compte rendu** tient en un clic, et
   l'entrée d'agenda (**ICS**) se télécharge pour la série ou
   l'occurrence.

---

## 7 · Les notifications

Meridian va trouver les gens plutôt que d'attendre leur visite : une
action qui arrive à échéance, un jalon bloqué, une décision due, une
préoccupation levée, un site silencieux depuis trente jours, une
semaine de réel manquante, un lien de preuve approuvé qui ne répond
plus, le digest.

Le **centre de notification** (Livrer → Notifications) est votre
boîte : tout ce qui vous est adressé y arrive, toujours, avec l'état
lu et traité. Les **abonnements** règlent ce qui *sort* vers vous par
courriel — par genre, portée, gravité minimale et cadence — et le
**silence de nuit** retient les messages pendant votre nuit, *dans le
fuseau de votre site* ; l'urgent passe. Le courriel ne quitte le
bâtiment qu'une fois le SMTP configuré par un administrateur ;
jusque-là le centre montre exactement ce qui aurait été envoyé.

---

## 8 · L'administration (rôle admin)

Tout est sous **Système → Administration** :

- **Comptes et habilitations** — créer les comptes (la première
  connexion force le changement de mot de passe), accorder les
  programmes ou les sites un par un, désactiver, révoquer toutes les
  sessions. Les personnes, les sites (avec leurs fenêtres, référents
  et aptitude), les programmes et les colonnes du Kanban s'éditent ici
  aussi.
- **Réglages** — seuils de santé, seuil CCB, enveloppe
  d'investissement, hôtes de preuve de confiance (**fermés par
  défaut** : tant qu'aucun hôte n'est nommé, rien ne peut être
  approuvé comme preuve), conservation des notifications (la purge
  refuse de tourner tant qu'une durée n'est pas décidée), nom de
  l'organisation, date de statut.
- **Systèmes branchés** — émettre une clé d'API nommée et à portée
  limitée par intégration (montrée une fois, conservée seulement en
  empreinte), changer ses portées, la faire tourner, la révoquer.
  Chaque acte d'une clé est audité sous son nom. La fédération SDP
  (actions et changements opérationnels liés, jamais copiés) se
  configure ici aussi.
- **La piste d'audit** — la trace complète, cherchable, avec images
  avant/après ; une ligne abîmée peut être restaurée *depuis* son
  image d'audit, ce qui est soi-même un acte audité.
- **L'archive** — tout exporter ; `npm run restore` recharge dans une
  instance vide. C'est la porte de sortie, et elle est toujours
  ouverte.
- **Adoption** — l'usage par site : comptes vus, dernier avancement,
  réunions tenues, actions closes, semaines saisies. Des comptages,
  jamais de la surveillance.

Le déploiement opérationnel — y compris l'installateur Windows
`.exe` — est dans [`29-technical-reference.md` §8](29-technical-reference.md) ;
la posture de sécurité et ce qui reste à votre charge dans
[`SECURITY.md`](../SECURITY.md).

---

## 9 · S'exercer, s'aider, se débloquer

- **L'instance d'entraînement** — `npm run training` démarre un livre
  d'exercice séparé sur `:4180` qui ne touche jamais le vrai, et se
  remet à zéro à la demande. Apprenez en y cassant des choses.
- **L'Aide, dans l'application** — le manuel par tâche, l'aide de
  champ sur chaque formulaire, et la liste de premiers pas de votre
  rôle.
- **Le référent de votre site** — chaque site nomme la personne à
  appeler en premier ; l'Aide affiche son nom avant de proposer le
  groupe.
- **« Quelqu'un d'autre a modifié ceci »** — deux personnes ont édité
  la même ligne ; Meridian refuse l'écrasement silencieux. Rouvrez
  l'élément, lisez l'état à jour, refaites votre modification.
- **Un bouton manque** — lisez la phrase à sa place : elle nomme
  l'autorité qui vous manque ou la séparation des rôles en jeu.
- **La connexion boucle sur une installation en réseau local** —
  l'instance émet des cookies Secure sans HTTPS ; l'administrateur
  retire `MERIDIAN_SECURE_COOKIES`. Voir la référence technique.

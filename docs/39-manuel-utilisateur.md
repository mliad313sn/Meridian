# 39 · Meridian IT-PMO — Manuel utilisateur

**Version 5.18.0 · 23/09/2026 · Français.** Le même manuel existe en
anglais : [`38-user-manual.md`](38-user-manual.md), avec en tête une
description du produit en cinq langues. L'interface parle anglais,
français et espagnol (marqué *brouillon*). Le bouton placé à côté de
votre nom affiche le code de la langue vers laquelle il **bascule** :
**FR** en anglais, **ES** en français, **EN** en espagnol.

**Où vit le manuel vivant.** Le comité d'adoption a tranché qu'« un
fichier Markdown de plus dans docs/ » ne serait jamais lu sur un site
minier. Le produit porte donc son propre guide. La touche **?** de
l'en-tête ouvre **l'Aide**, qui propose *Par où commencer — à quoi sert
ce compte* et *Utiliser Meridian — premiers pas et réponses*, organisés
par tâche, avec les premiers pas de votre rôle. Ce document en est le
compagnon *écrit*. Il sert à qui évalue Meridian sans compte, à la
formation, et à qui veut lire un processus de bout en bout avant de
l'accomplir. Si les deux divergent, croyez celui qui est dans le
produit.

Cette édition réécrit le texte 5.3.0 du 31/08, revu par le comité
([`40-comite-revue-documentation.md`](40-comite-revue-documentation.md)).
Il décrit la version 5.18.0 (la 5.17.0 augmentée des correctifs produit
de C-04 — l'arbre dans lequel il est livré). Chaque geste a été rejoué le 23/09
contre un livre de démonstration de cet arbre : à l'écran quand l'écran
le porte, par l'API sinon. Quand un geste **ne fonctionne pas**, le
manuel le dit à l'endroit même, avec son identifiant (NEW-nn) au registre de
[`36-convergence.md`](36-convergence.md), au lieu de décrire le
comportement voulu. La liste figure aussi
dans [`37-technical-reference.md` §10](37-technical-reference.md).

**Les libellés cités sont ceux que l'écran affiche en français**, lus
dans le dictionnaire du produit (`web/src/lib/i18n.js`) et vérifiés à
l'écran. L'interface française laisse encore plusieurs libellés en
anglais (par exemple « Milestones & gates », « Open RAID »,
« Edit project »). Ils sont alors cités tels quels, en anglais, et
signalés *(affiché en anglais)*. Un manuel qui traduirait mieux que
l'écran ferait chercher des libellés introuvables.

---

## 1 · Ce qu'est Meridian

Meridian est un outil auto-hébergé de gestion de portefeuille de
projets pour un groupe qui exploite plusieurs sites. Il couvre la vie
entière du portefeuille :

- l'entrée des demandes et la priorisation ;
- la valeur acquise et le chemin critique ;
- les jalons de contrôle sur votre propre échelle de jalons, avec
  preuve vérifiée et critères d'acceptation ;
- les risques avec revues datées, et la maîtrise des changements ;
- les ressources avec rotations et absences ;
- un grand livre multidevises ;
- le cas d'affaire, les bénéfices et une page de valeur ;
- les tolérances avec exceptions automatiques ;
- un registre des décisions et un registre des enseignements ;
- les parties prenantes et un plan de communication ;
- les réunions hebdomadaires et mensuelles qui tournent au-dessus,
  engendrées depuis le portefeuille.

Quatre idées façonnent tout ce que vous toucherez :

- **L'autorité est une donnée.** Votre rôle, vos habilitations et le
  niveau de gouvernance de chaque projet décident de ce que vous
  pouvez faire, en un seul endroit, côté serveur. Quand un bouton est
  absent, l'écran dit en général pourquoi, en une phrase.
- **Le registre ne se réécrit pas.** Chaque modification est auditée
  avec son avant et son après. Les réunions closes et les périodes
  clôturées sont figées, et une correction est un acte nouveau et
  visible.
- **La réunion est engendrée.** Vous n'écrivez pas d'ordre du jour ;
  le portefeuille le fait. Vous consignez ce qui a été décidé, et cela
  retombe sur les projets concernés.
- **Ce qui n'est pas mesuré n'est pas vert.** Un projet sans budget,
  ou dont trop peu du plan est engagé, affiche **Non mesuré** (pastille
  grise, SPI et CPI « — »). Il n'est jamais affiché à 1,00 et vert.

---

## 2 · Se connecter, et le premier quart d'heure

Ouvrez l'adresse que votre administrateur vous donne. Une installation
locale neuve répond sur `http://localhost:4173`. Sur une instance de
démonstration, l'écran de connexion liste les dix comptes semés, et
cliquer un nom remplit l'adresse. Les mots de passe sont dans le README.

**Si un administrateur a créé votre compte**, le serveur refuse toute
écriture tant que vous n'avez pas choisi votre propre mot de passe :
« Choisissez d'abord votre propre mot de passe — sans cela, la piste
d'audit ne peut attester qu'il s'agit de vous ».

> **Défaut connu (NEW-06).** La boîte qui devrait demander le nouveau
> mot de passe (« Choisissez votre propre mot de passe », avec « Le mot
> de passe qui vous a été remis » et « Votre nouveau mot de passe
> (8 caractères min.) ») **ne s'ouvre pas** dans le navigateur : les
> données de démarrage omettent l'indicateur qu'elle attend. Vous
> arrivez sur le portefeuille, et chaque écriture est refusée avec la
> phrase ci-dessus. En attendant la correction, le mot de passe se
> change par l'API (`POST /api/auth/password` avec `current` et
> `next`). Rejoué le 23/09 : la voie API fonctionne, la boîte ne
> paraît jamais.

**Par où commencer.** À la première connexion, une page *Par où
commencer* (*Bienvenue dans Meridian*) dit en trois lignes à quoi sert
votre compte. On la rouvre à tout moment depuis l'Aide.

**La langue.** Le bouton de langue, à côté de votre nom, bascule
l'interface. La langue des messages que Meridian vous envoie est un
réglage à part. Il se trouve dans les *Préférences de notification*
(le bouton en forme d'enveloppe), sous *Langue de mes courriels*, et
vaut par défaut *Suivre l'interface*.

**Les premiers pas.** Ouvrez l'Aide (**?**), puis *Utiliser Meridian —
premiers pas et réponses*, onglet **Premiers pas**. L'onglet *Comment
fait-on…* rassemble les réponses par tâche. Vous y trouverez une liste
*pour votre rôle*. Les étapes se cochent quand le livre porte la donnée
correspondante (ou, pour les étapes de repérage, dès que vous avez
ouvert l'écran), pas parce qu'on a cliqué dessus.

**Où sont les choses.** La navigation compte cinq groupes. Les entrées
sans usage pour votre compte sont absentes : un lecteur ne voit jamais
Administration, un compte site voit *Mon site* et non *Programmes*.

| Groupe | Écrans |
|---|---|
| **Livrer** | Ma semaine · Notifications · Portefeuille · Feuille de route · Portefeuille de demandes · Programmes · Mon site · Vue projet · Planning · Kanban |
| **Piloter** | Risques & problèmes · Budget & coûts · Demandes de changement · Ressources |
| **Gouverner** | Réunions |
| **Consigner** | Documents · Rapports · Enseignements · Sites · Adoption |
| **Système** | Administration |

**Ma semaine** est la page d'arrivée de tout le monde. Elle montre ce
qui est dû *par vous* : « Vos actions à traiter », « Vos risques &
problèmes », « À échéance sous quinze jours », « Vos projets ». Si vous
êtes désigné suppléant de quelqu'un, elle propose aussi « Assurer la
couverture ».

---

## 3 · Comprendre ce que vous pouvez faire, et pourquoi

Il existe quatre rôles. Les identifiants sont ceux qu'affiche
l'Administration.

| Rôle | En bref |
|---|---|
| **admin** | Tout, y compris les comptes, les habilitations et les réglages. Il est exempté de la séparation des tâches : c'est un bris de glace, et chaque signature de ce genre est marquée dans la piste d'audit. Gardez peu de comptes admin, et menez le portefeuille avec des comptes groupe et site nominatifs. |
| **group** (groupe) | Lit tout le portefeuille, écrit dans les programmes qui lui sont accordés. C'est le rôle de gouvernance : il impute les coûts, décide les changements au-dessus du seuil, approuve les preuves des projets de site, pose les tolérances, écrit le cas d'affaire, clôture les périodes et pose la pondération. |
| **site** | Lit ses sites plus les projets groupe qui y sont livrés. N'écrit que les projets **gouvernés au site** dans ses sites accordés. |
| **viewer** (lecteur) | Lit son périmètre. N'écrit rien, jamais. |

Chaque projet est gouverné au niveau **groupe** ou au niveau **site**.
Ce seul fait décide qui peut le modifier, le re-référencer, y imputer de
l'argent ou approuver les preuves de ses jalons de contrôle. Peu importe
qui l'a créé ou où il s'exécute.

Deux conséquences que vous rencontrerez chaque jour :

- **Sur un projet groupe livré sur votre site, vous êtes en lecture
  seule**, et le refus le dit : « ce projet est gouverné au niveau
  groupe — le niveau site y est en lecture seule ; ouvrez-y une
  préoccupation, votre bureau de programme la verra ». Votre voix, c'est la **préoccupation**.
  Dans *Mon site*, sous « Atterrissent sur votre site », chaque projet
  groupe porte un bouton « Signaler une préoccupation ». Elle paraît,
  au nom de votre site, là où le bureau de programme la verra.
- **On ne décide jamais son propre acte.** Qui lève un changement ne
  l'approuve pas. Qui possède un document ne l'approuve pas comme
  preuve. Qui possède la preuve citée par un critère ne le constate
  pas tenu. Un site ne pose ni sa propre tolérance ni son propre cas
  d'affaire. Là où vous attendez un bouton et n'en voyez pas, cette
  séparation en est souvent la raison.

Tout refus énonce sa raison, dans votre langue. Il n'y a pas d'échec
silencieux.

---

## 4 · Le travail de tous les jours — projets et livraison

### Créer un projet

Il y a deux portes :

- **Portefeuille de demandes.** Émettez une demande (« Émettre une
  demande »). Une fois qu'elle est approuvée, « En faire un projet »
  la convertit. C'est la voie normale : elle garde la trace de l'idée
  au projet, et la conversion écrit aussi le premier **cas d'affaire**
  du projet, avec les mots du demandeur.
- **« Nouveau projet ».** Cette action se trouve sur Portefeuille,
  Programmes, Mon site et Planning. Un compte groupe crée des projets
  dans ses programmes accordés ; un compte site crée un projet
  **gouverné au site** dans ses sites accordés. Le bouton paraît dès que
  le compte peut créer un projet quelque part dans le livre. Rejoué le
  23/09 : `g.silva` (site, São Paulo) et `p.marchetti` (groupe, Digital
  Channels) le voient tous deux.

La boîte demande le nom du projet, le programme, le site porteur, la
gouvernance, le chef de projet, la méthode, le début, la fin prévue
(« La date est » un engagement ou une position, « Datée après » une
condition), le budget et la provision, ce qu'il livre, le sponsor et les
critères d'acceptation (libellés *affichés en anglais*, sauf « La date
est », « Datée après » et « Critères d'acceptation » ; le bouton final
est « Create project »). Le programme et le site porteur proposés par
défaut sont les premiers de la liste : un chef de site choisit son
propre site, faute de quoi l'enregistrement est refusé (« ce site n'est
pas dans vos habilitations… »). Rejoué le 23/09 : `g.silva` a créé
depuis la boîte un projet Digital Channels à São Paulo.

Un projet neuf prend l'**échelle de jalons** de son programme (§5), avec
les jalons de contrôle, leurs documents de preuve et, si l'échelle les
déclare, leurs critères. Sa date de fin peut être une **position** en
attente d'une condition nommée plutôt qu'un engagement (voir *Les dates*
ci-dessous). Juste après la création, si le registre porte des
enseignements adoptés du même programme ou du même site, une boîte
**« Avant de planifier »** les propose (« Ouvrir le registre »,
« Bien noté »), au seul moment où ils peuvent encore changer le plan.
Rejoué le 23/09 : une fois un enseignement de São Paulo adopté, le
projet suivant créé là s'est ouvert sur lui. Sans enseignement
pertinent, aucune boîte ne paraît.

### La page projet

La *Vue projet* est la surface de travail. Choisissez un projet, et ses
registres tiennent sur une page :

- les jalons et jalons de contrôle avec leurs critères (« Milestones &
  gates », *affiché en anglais*) ;
- le cas d'affaire ;
- la « Valeur » (bénéfices et revue post-mise en œuvre) ;
- « La marge dans laquelle ce projet travaille » (tolérance et
  exceptions) ;
- les « Parties prenantes » et le « Plan de communication » ;
- « Installations & déploiement » ;
- le « Plan d'étapes » ;
- les RAID ouverts, l'équipe, la position de coût et les opérations SDP
  (*affichés en anglais*).

Une section repliée porte un résumé de ce qu'elle contient, par exemple
« Cas d'affaire — aucun écrit ».

Parmi les actions d'en-tête :

- « Lever un changement » ;
- « Edit project » (*affiché en anglais*) ;
- « Copier le statut », un résumé Markdown pour un courriel ou une
  messagerie ;
- « Dossier de preuve », tout ce que le dossier porte pour le projet,
  arrêté à une date de votre choix, téléchargé en Markdown ;
- « Définir le statut », « Re-référencer » et « Avancer la phase ».

Chacune n'apparaît que si votre compte peut s'en servir.

### L'avancement, et ce que veulent dire les indices

Mettez à jour le pourcentage de chaque étape dans le **Plan d'étapes**.
La valeur acquise se calcule à partir du poids des étapes. Le **Kanban**
suit les éléments de travail et les limites d'encours ; déplacer une
carte ne consigne pas d'avancement d'étape.

- **SPI** mesure la performance de délai : sous 1,0, le projet est en
  retard pour le travail fait.
- **CPI** mesure la performance de coût : sous 1,0, il dépense trop pour
  le travail fait.
- **EAC / VAC** disent où le coût atterrit si la performance se
  maintient.

L'ambre commence à 0,95 et le rouge à 0,90 par défaut (Administration →
« Thresholds », *affiché en anglais*).

Le quatrième état est **Non mesuré**. Il recouvre deux cas, et la
pastille dit lequel au survol (phrase *affichée en anglais*) :

- « Too early to measure — less than 2% of the plan has been spent » :
  le projet a un budget, mais moins de 2 % du plan est planifié ou moins
  de 0,5 % est comptabilisé.
- « Nothing measured — no budget, so there is no scale to measure
  against » : le projet n'a pas de budget.

Dans les deux cas, SPI et CPI affichent « — ». Non mesuré est une
réponse, pas un trou, et ce n'est jamais vert.

La santé est calculée, mais un chef de projet peut la forcer avec une
raison écrite. « Définir le statut » ouvre la boîte *Set project status*
(libellés *affichés en anglais*) :

1. **Status source** : *Set by the project manager* (forcé), ou
   *Derived from SPI and CPI* (calculé).
2. **Manual status** : Green, Amber ou Red.
3. **Reason for the call** : obligatoire pour un statut forcé. Dites ce
   qui a été décidé, pas qu'un appel a eu lieu.

La raison suit alors la pastille. Revenir à *Derived from SPI and CPI*
retire le forçage. Rejoué le 23/09 avec `g.silva` sur PRJ-136 : un Amber
forcé avec sa raison a été enregistré, puis le retour au statut calculé
l'a retiré.

### Les dates : engagement ou position

La date d'un jalon est soit **un engagement**, soit **une position —
pas encore de date calendaire**. Le champ de la boîte s'appelle « La
date est ». Une position est « Datée après » une condition nommée (par
exemple « le modèle de capacité au jalon C »). Elle se dessine là où
elle se trouve, mais elle n'est jamais signalée manquée ni en retard, et
son jalon de contrôle affiche **Sans date**. Faites-en un engagement une
fois la condition mesurée. La date de fin d'un projet peut être une
position de la même façon.

### Planning et dépendances

Les étapes portent des dates, des dates de référence et des liens
fin-début ; le chemin critique et la marge se calculent. Une étape qui
empiète de plus de cinq jours sur sa devancière au-delà de ce que la
référence admettait est signalée au **Planning**. La même règle vaut
pour les « Liens inter-projets » du planning directeur, et le bandeau
compte les deux sortes de manquement. **Re-référencer est un acte de
niveau groupe.**

### Risques, problèmes, et le registre RAID

Tout ce qui pourrait coûter du temps ou de l'argent va dans **Risques &
problèmes** avant que cela n'arrive (« Lever un élément »). Ce peut être
un risque, un problème, une hypothèse ou une dépendance. Probabilité ×
impact (1 à 5 chacun) le range dans une bande, et une forte exposition
remonte d'elle-même aux ordres du jour de pilotage. On peut aussi
consigner :

- une cible résiduelle ;
- une « Catégorie » libre, dans vos propres mots ;
- un lien vers un jalon (« Contre le jalon ») ou vers une demande de
  changement ;
- la date de prochaine revue.

Fermer un élément (« Close item », *affiché en anglais*) consigne quand
et par qui. Les éléments de tout le portefeuille sont tenus par le
groupe.

**Une revue est un événement.** Une revue faite est un enregistrement
daté à part, avec qui l'a faite, une note et la prochaine date ; la date
de revue de l'élément suit la dernière. L'ordre du jour de la réunion
liste les éléments dont la revue est due (« Register items due for
review », *affiché en anglais*).

> **En 5.18.0, consigner une revue n'a pas de bouton.** Cela se fait par
> l'API (`POST /api/raid/<id>/reviews` avec `on`, `next`, `by`, `note` et
> la `version` de l'élément). Rejoué le 23/09 : la revue est consignée
> et la prochaine revue de l'élément a bougé.

### Les demandes de changement

Levez-les depuis le projet (« Lever un changement ») ou depuis
**Demandes de changement**. Précisez ce qui change, l'impact en coût,
l'impact en semaines, la source de financement et le pourquoi. Chaque
demande suit les quatre mêmes étapes : chef de projet, autorité de
changement, finance, comité de pilotage.

Le **seuil de pilotage** décide *qui peut signer* : au-dessus, en coût
ou en semaines, seul un compte groupe le peut. Il ne raccourcit rien.
**L'approbation applique les écarts** au budget, aux dates et à la
provision. On n'approuve pas ce qu'on a levé, que la règle compare la
personne ou le compte.

Rejoué le 23/09 : une demande levée par un chef de site, qui s'est vu
refuser la première étape ; un compte groupe a signé les quatre étapes,
et la demande est passée *Approved*.

### L'argent

**Budget & coûts** porte le grand livre. « Imputer un coût » est un acte
de niveau groupe. Une écriture a une période, un montant, capex/opex,
une devise et le taux de change *à l'imputation*. Un tirage de provision
doit nommer le risque ouvert auquel il répond. Une erreur se corrige par
une **écriture d'annulation**, jamais par une retouche : le grand livre
doit toujours se réconcilier.

Les **engagements** (« Enregistrer un engagement ») sont de l'argent
promis mais pas encore comptabilisé. Chacun porte une référence de bon
de commande, un fournisseur et un statut.

### Personnes, capacité, réel, absences

**Ressources** répartit les affectations en semaines (« Affecter une
personne »). La capacité effective d'une personne est son pourcentage
de **disponibilité** ; la rotation (« 4/2 », « 14/14 ») est une donnée
d'annuaire pour le planificateur, pas un facteur du calcul.

**« Consigner l'effort »** est volontairement minimal : personne,
projet, un jour de la semaine, jours passés. Le réel se pose *à côté*
du plan, et l'écart est le propos.

Les **absences** se déclarent dans *Mon site*, sous « Absences &
suppléance », avec « Déclarer ». Chacune nomme « Qui couvre ». Le
suppléant se connecte sous son propre nom et, depuis *Ma semaine*,
choisit « Assurer la couverture ». Il agit alors *pour* l'absent, dans
l'autorité de celui-ci et jamais au-delà, et la piste nomme les deux.
« Cesser la couverture » y met fin.

### Parties prenantes et plan de communication

Sur la page projet :

- « Partie prenante » (boîte *Nommer une partie prenante*) consigne une
  personne de l'annuaire ou une organisation, avec intérêt et influence
  (1 à 5), attitude, association, et qui tient la relation.
- « Audience » (boîte *Planifier une communication*) consigne qui
  entend quoi, par quel canal, à quelle fréquence, de qui, et quand la
  prochaine fois.

Rejoué le 23/09 par un chef de site sur son projet.

---

## 5 · Le travail de gouvernance

### Jalons de contrôle, échelle de jalons, critères

**L'échelle.** Un programme peut déclarer sa propre échelle, jusqu'à
**douze** jalons de contrôle. Sans elle, un projet suit les quatre par
défaut : *Gate 1 — Mandate*, *Gate 2 — Design authority*, *Gate 3 —
Readiness*, *Gate 4 — Benefits*. L'interface affiche les noms de jalons
tels qu'ils ont été déclarés et ne les traduit pas. Le manuel les glose
donc : mandat, autorité de conception, préparation, bénéfices.

L'échelle se déclare dans Administration → Programmes → « Échelle de
jalons », un jalon par ligne :

    nom | responsable | preuves, séparées par des virgules | position dans la fenêtre du projet en %

Un projet prend son échelle **à sa création**. Changer l'échelle
ensuite ne réécrit pas les projets existants : des jalons datés et des
preuves déposées ne doivent pas bouger sous les pieds de ceux qui les
ont déposées. Pour faire passer un projet sur l'échelle actuelle de son
programme, un compte groupe ouvre ce projet. Quand l'échelle du projet
diffère de celle du programme, le panneau des jalons le dit et propose
« Voir ce que cela ferait ». Cela ouvre « Passer sur l'échelle du
programme », qui montre ce qui sera repris, créé et retiré avant que
rien ne bouge. Un jalon retiré devient un jalon ordinaire et garde sa
date, son acceptation et ses preuves.

**Boucles et portées.** Un jalon de contrôle peut **boucler** vers un
jalon antérieur (une revue qui renvoie au cahier des charges). Il peut
aussi avoir une **portée** de programme ou de portefeuille : il n'est
alors franchi que lorsque chaque projet du périmètre porte ses preuves
et ses critères. En 5.18.0 :

- Boucles et portées ne se déclarent que par l'API ou par l'import d'un
  livre. Le texte « un jalon par ligne » de l'écran ne porte ni l'une ni
  l'autre.

  > **Défaut connu (NEW-10).** Enregistrer une échelle depuis l'écran
  > **efface** les boucles et portées qu'elle contenait.
- Aucun bouton ne fait passer un projet au tour suivant d'une boucle.

**Les preuves.** Un jalon de contrôle ne peut pas être franchi
(« Avancer la phase ») tant que ses documents de preuve ne sont pas
**Approuvé**s. Approuver est un pouvoir distinct de modifier :

- Le document doit pointer (https) vers un hôte de **documents de
  confiance**.
- Le lien est empreinté à l'approbation ; le changer ensuite ramène le
  document *En revue*.
- Le propriétaire n'approuve jamais son propre document.
- La preuve d'un projet de site est approuvée par le groupe.

Une sonde revérifie les liens approuvés et signale ceux qui ne
répondent plus, sans jamais rien désapprouver. Un jalon auquel rien n'a
été rattaché le dit : « No evidence has been registered for … »
(*affiché en anglais*).

Les hôtes de confiance se posent dans Administration, section
« Preuve », champ « Hôtes de preuve de confiance », séparés par des
virgules. La liste est fermée par défaut : « Fermé par défaut : sans
hôte nommé, aucun document ne peut être approuvé comme preuve. » Le
livre de démonstration est livré avec `docs.meridian.example`. Rejoué le
23/09 : un lien sur un autre hôte a été refusé (« Le lien de preuve
pointe vers evil.example, which is not a trusted document host », refus
à moitié traduit), un lien sur l'hôte de confiance a été approuvé, et un
second hôte ajouté depuis le champ de l'Administration a été
enregistré.

**Les critères.** Sur un jalon de contrôle, « Critère » (boîte *Poser un
critère*, champ « Ce qui doit être vrai ») énonce d'avance ce qui doit
être vrai pour le franchir. Un critère est ensuite **« Constaté tenu »**
par une personne nommée (« Revu par »), qui ne peut pas être le
propriétaire de la preuve citée. Un jalon qui porte des critères n'est
prêt que si ses preuves sont approuvées **et** chaque critère est tenu.
Rejoué le 23/09 :

1. Le franchissement a été refusé (« 1 evidence item outstanding for
   Gate 1 — Mandate »).
2. La charte a été approuvée sur l'hôte de confiance.
3. Le critère a été constaté tenu par une personne nommée.
4. La phase est passée en Design.

**Les vetos.** Si le livre porte des sièges de gouvernance avec veto
(importés, voir §8), une objection ouverte d'un tel siège bloque le
jalon de contrôle avant même que les preuves soient comptées, et le
refus nomme le siège.

### Demandes et priorisation

Le **Portefeuille de demandes** est l'entonnoir. Tout compte qui peut
écrire peut **émettre** une demande (« Émettre une demande ».) **Décider**
relève du groupe, et un refus consigne sa raison comme toute décision.
Une demande approuvée devient un projet avec « En faire un projet », et
la trace comme le cas d'affaire la suivent.

« Définir l'enveloppe » fixe l'enveloppe d'investissement, et « La file
d'investissement » montre ce qui tient dans l'argent.

**« Valeur et risque contre capacité »** est la priorisation du
portefeuille. Elle note les projets vivants et les demandes ouvertes sur
quatre entrées : « Valeur revendiquée », « Confiance », « Exposition
RAID » et « Capacité consommée ». La pondération vaut par défaut
40/20/20/20, et le groupe la fixe avec « Poser la pondération »,
raison écrite à l'appui. L'écran trace la ligne là où les personnes
viennent à manquer. Une ligne à qui il manque une entrée dit laquelle.
La note classe, elle ne décide jamais.

### Tolérances et exceptions

Un compte groupe pose la marge de chaque projet avec « Poser une
marge » (boîte *Poser la marge de ce projet*) :

- délai en jours au-delà de la référence ;
- coût en % au-delà du budget ;
- bénéfice en points sous la cible ;
- périmètre, qualité et risque, *en toutes lettres*.

Un balayage horaire surveille ensuite les mêmes chiffres que les écrans.
Un franchissement **lève une exception de lui-même**. « Vérifier
maintenant » demande le balayage tout de suite. Une exception ne se
ferme que par une réponse du niveau qui a posé la marge : *Marge
relevée*, *Plan révisé*, *Dépassement accepté* ou *Projet arrêté*.
Rejoué le 23/09 : une marge serrée sur PRJ-101, puis « Vérifier
maintenant », ont ouvert deux exceptions (délai et coût) ; l'une a reçu
la réponse *Dépassement accepté*.

Qui a posé la marge est prévenu : un message *tolérance franchie*
arrive dans son Centre de notification. Rejoué le 23/09 : deux
exceptions ouvertes, deux messages de ce genre mis en file.

### Cas d'affaire, bénéfices et page de valeur

**Le cas d'affaire** (« Écrire le cas d'affaire », groupe) dit pourquoi
le projet existe, son coût et son bénéfice attendus, et sur quoi
reposent ces chiffres. Il est **reconfirmé à chaque jalon de contrôle**
dans la boîte *Cela vaut-il encore la peine ?*, avec le verdict :

- *Continuer — cela tient toujours* ;
- *Continuer, sous conditions* ;
- *Arrêter — cela ne vaut plus la peine*.

La personne qui reconfirme est nommée, et les chiffres sont gardés tels
qu'ils étaient. Un jalon d'un projet qui a un cas est refusé tant que le
cas n'a pas été reconfirmé à ce jalon, et un *Arrêter* refuse le
suivant.

**Les bénéfices** (« Bénéfice », boîte *Énoncer un bénéfice*) vivent
dans leur propre unité (tonnes, heures, coût à l'once), avec référence,
cible et valeur mesurée. Le projet consigne la mesure ; dire si elle
vaut atteinte est un verdict du groupe. Un bénéfice dont la date
« Réalisé pour le » est passée sans mesure lève une exception. La
**revue post-mise en œuvre**, unique, se consigne depuis la même section
(« Enregistrer la revue post-mise en œuvre »).

**La page de valeur** se trouve dans Rapports, sous « Ce que ça
valait ». Elle montre six chiffres, lus dans le livre et jamais saisis :

1. « Dépense contre le cas » ;
2. « Bénéfices par statut » ;
3. « Revues de bénéfice en retard » ;
4. « Exposition la plus haute » ;
5. « Portes à venir » ;
6. « Exceptions ouvertes ».

Aucun chiffre ne porte de couleur. « Exceptions ouvertes » affiche « — »
sur un livre sans tolérance posée, et ne prétend pas « 0 ouverte ».
« Imprimer cette page » donne un dossier A4 pour le comité. « Déposer
cette page » (groupe) la classe contre une période de reporting close,
pour la relire telle quelle plus tard.

### Signaux de gouvernance

Portefeuille → « Signaux de gouvernance » montre cinq horloges que le
livre tient déjà : « Délai de décision », « Ancienneté des actions »,
« Durée entre portes », « Respect des revues du registre » et
« Ancienneté des exceptions ». Rien n'est saisi pour elles. Quand il n'y
a rien à mesurer, chacune le dit en une phrase au lieu d'afficher un
chiffre.

### Les décisions

Toute décision tombe dans un seul **Registre des décisions** (Rapports),
qu'elle ait été prise en réunion ou hors réunion. Pour une décision
prise hors réunion, utilisez « Consigner une décision » :

- la « Décision », une phrase au passé ;
- le projet, ou « Tout le portefeuille (niveau groupe) » ;
- « Décidé par » (une personne) ou « Organe décideur » (un comité) ;
- la date ;
- le « Statut » : *Ratifiée*, ou *Proposée — en attente de
  ratification* ;
- au besoin, la « Trace de la décision » (un lien, un chemin de dépôt,
  un commit), la provenance, le « Pourquoi », les « Alternatives
  examinées », la « Dissension », l'élément de registre, le jalon ou le
  changement concerné, et la décision remplacée.

Une décision ne se modifie ni ne se supprime. Changer d'avis, c'est
consigner une nouvelle décision qui nomme celle qu'elle remplace.

> **En 5.18.0 :** une décision *Proposée* **ne peut être ratifiée depuis
> aucun écran** (REQ-50). La ratification n'existe que sur la voie
> d'intégration (`PUT /api/v1/decisions`), où la personne qui ratifie
> doit être nommée et distincte du décideur comme du compte qui a
> consigné. À l'inverse, la route de l'écran accepte un statut
> *Ratifiée* avec un ratificateur en texte libre et sans contrôle
> d'indépendance (REQ-49, ouvert). Les deux ont été rejoués le 23/09.

### Les enseignements

Qui l'a vécu le consigne avec « Consigner un enseignement » : ce qui
s'est passé, pourquoi, ce qu'il faudrait faire autrement, dans l'une
des onze catégories d'ISO 21502, réussites comprises. **Adopter** un
enseignement est un acte de niveau groupe, et c'est l'adoption qui le
rend visible aux autres sites. Le registre des **Enseignements** se
filtre par catégorie et par statut.

### Rapports, et la clôture de période

**Rapports** montre le dossier hebdomadaire ou mensuel vivant, avec des
récits modifiables sur place et reportés de semaine en semaine. Pour
gouverner plutôt que dérouler, utilisez **« Clôturer la période »**
(groupe). La clôture fige ce qui a été rapporté, projet par projet, pour
que le chiffre vu par le comité en mars se reproduise en juin. Une
période close ne se modifie pas : la base elle-même refuse. Depuis
5.13.0, un projet *Non mesuré* est figé *Non mesuré*, jamais vert. Une
correction est une **rectification** : une nouvelle période qui nomme
celle qu'elle rectifie.

---

## 6 · Les réunions

Le module pour lequel le reste existe. Une **série** a une cadence
(hebdomadaire ou mensuelle à l'écran) et un périmètre (groupe, programme
ou site) ; chaque tenue est une **occurrence**. Rejoué le 23/09 sur la
réunion de site de São Paulo.

1. **« Open the meeting »** (*affiché en anglais*). L'ordre du jour
   s'engendre *maintenant*, depuis l'état vivant. Une série
   hebdomadaire reçoit un ordre du jour d'exceptions ; une série
   mensuelle, le dossier de pilotage complet. Les sections vides
   disparaissent, sauf « Actions reportées », toujours présente.
   D'autres sections suivent, dont « Renvoyé par les revues de
   livraison », « Décisions demandées » et, *affichées en anglais*,
   « Projects off track », « Register items due for review » et
   « Next up ».
2. **La tenue.** Prenez les « Présences » : présent, excusé, absent,
   suppléant, ou observateur (voix sans vote). « Consigner une
   décision » : dites *ce qui a été décidé*, pas qu'une décision a eu
   lieu. La même décision deux fois dans la même réunion est refusée.
   « Raise an action » (*affiché en anglais*), avec un responsable et
   une date.
3. **Le renvoi.** Une décision au-delà de l'autorité de la salle se
   consigne avec « Renvoyer au niveau supérieur » (« Renvoyer au comité
   de programme » ou « Renvoyer au comité de pilotage groupe »). Elle
   s'affiche en tête du prochain ordre du jour de la série plus large
   jusqu'à ce qu'une décision là-bas y réponde. Rejoué : un renvoi de
   São Paulo a paru sous « Renvoyé par les revues de livraison » à
   l'ordre du jour de Digital Channels.
4. **« Clore la réunion ».** L'ordre du jour tel que discuté est figé,
   et les décisions deviennent définitives. Une décision ajoutée après
   est refusée (« This meeting is closed — its decisions are final »).
   Les actions ouvertes poursuivent leur responsable d'ordre du jour en
   ordre du jour. Le « Compte rendu » (Markdown), le « Dossier de
   réunion » et l'entrée d'agenda (ICS, pour l'occurrence ou pour la
   série) sont à un clic.

Des séries à cadence *par jalon* ou *ad hoc* existent dans le modèle de
données. En 5.18.0 elles n'arrivent que par l'import ; l'écran crée des
séries hebdomadaires et mensuelles.

---

## 7 · Les notifications

Le **Centre de notification** (Livrer → Notifications) est votre
boîte : tout ce qui vous est adressé y arrive, toujours, avec l'état lu
ou traité.

**Ce que Meridian vous dit**, onze natures en tout :

- une action qui arrive à échéance, ou en retard (à son responsable) ;
- un jalon de contrôle bloqué à son jalon ;
- une décision renvoyée restée sans réponse (à qui préside la salle
  saisie) ;
- une préoccupation signalée par un site sur un projet groupe (au chef
  de ce projet) ;
- un site silencieux depuis trente jours (à son référent) ;
- une semaine d'effort non consignée (à la personne, jamais à son
  responsable) ;
- un lien de preuve approuvé qui ne répond plus ;
- une tolérance franchie (à qui a posé la marge) ;
- un bénéfice arrivé à sa date sans mesure (à son responsable) ;
- le condensé, pour les comptes en cadence quotidienne ou hebdomadaire.

Mesuré le 23/09 sur le livre de démonstration : un balayage a mis en
file des messages *effort manquant*, *jalon bloqué*, *tolérance
franchie* et *action en retard* ; les autres natures attendent des
événements que la graine ne porte pas.

Les **Préférences de notification** (le bouton en forme d'enveloppe à
côté de votre nom) :

- *Langue de mes courriels* : *Suivre l'interface*, Français ou English ;
- « Cadence » : *Au fil de l'eau*, *Quotidien*, *Hebdomadaire*, *Rien
  par courriel* ;
- les **heures de silence**, « Silence à partir de (heure) » et
  « Silence jusqu'à (heure) », « Lues dans le fuseau de votre site. Rien
  n'est perdu — les messages attendent le matin ; l'urgent passe. »
  Posez les deux bornes, ou aucune ;
- les **« Abonnements fins »** : nature (ou *Tout*) × « Périmètre »
  (*Tout le portefeuille*, un programme, un site, un projet) × « Gravité
  minimale » × cadence, avec « Ajouter » et « Retirer ». « Sans aucun,
  la cadence ci-dessus gouverne tout. Avec, seul ce qu'un abonnement
  couvre part — le centre, lui, reçoit toujours tout. »

Rejoué le 23/09 : la boîte montre les quatre ; un abonnement au
périmètre d'un site et des heures de silence 20:00–07:00 ont été
enregistrés.

> **Défaut connu (NEW-13).** Les messages ne s'écrivent qu'en anglais
> ou en français. L'espagnol ne peut pas être choisi pour vos messages
> (le serveur le refuse : « Locale is en, fr or empty »), et toute
> langue autre que le français est rédigée en anglais.

Les messages ne quittent l'instance que par un webhook sortant qu'un
administrateur configure : Teams, ou un webhook HTTPS générique. L'hôte
de destination doit figurer dans les « Hôtes de destination
autorisés », fermés par défaut. Jusque-là, Administration →
Notifications montre la file exacte de ce qui aurait été envoyé, et
dit si un webhook sortant est configuré (« aucun webhook sortant — les
messages attendent en file et s'affichent ici »). Aucun client de
courriel n'est porté : les webhooks sont le transport.

---

## 8 · L'administration (rôle admin)

Tout se trouve sous **Système → Administration** :

- **Comptes et habilitations.** Un compte groupe ou site se crée avec
  au moins une habilitation. Sa première connexion doit changer le mot
  de passe (voir le défaut au §2). Les habilitations s'accordent
  programme par programme ou site par site, et un compte se désactive.
  Le bandeau du jour 1 liste les comptes de démonstration qu'ouvre
  encore leur mot de passe publié, et un démarrage en production refuse
  tant qu'il en reste un.

  > **Défaut connu (NEW-11).** Ce même bandeau affiche « aucun transport
  > de courriel — les notifications s'accumulent sans partir » dès que
  > `MERIDIAN_SMTP_URL` n'est pas posé, même quand un webhook est
  > configuré. C'est le panneau Notifications qui dit l'état réel.
- **Données de référence.** Les personnes : nom, fonction, site, taux
  journalier, « Statut » (*Salarié* ou *Prestataire*), « Fournisseur »,
  « Rotation » (« 4/2 », « 14/14 ») et « Disponibilité (%) », qui est le
  chiffre qu'utilise le calcul de capacité (rejoué le 23/09). Les sites (ville, région, fuseau, pays,
  entité juridique, effectif). Les programmes (sponsor, responsable, et
  leur « Échelle de jalons »). Les colonnes du Kanban.
- **Reprendre l'existant.** Le panneau CSV s'intitule *Reprise de
  l'existant* dans toutes les langues (un défaut, NEW-11). Choisissez la nature
  (projets, personnes, jalons) et téléchargez le modèle. Collez le CSV
  ou choisissez un fichier, puis « Prévisualiser » : la
  prévisualisation dit, ligne par ligne, ce qui sera créé et ce qui
  sera refusé. « Appliquer » est tout ou rien.
- **Import et export du livre entier.** « Exporter le livre » écrit le
  livre en JSON avec `"currencyUnit": "millions"`. « Import book »
  (*affiché en anglais*) **remplace** le livre par un fichier. Un
  fichier sans `currencyUnit` est refusé ; un livre exporté avant
  5.17.0 doit recevoir `"currencyUnit": "millions"` en tête. Le même
  import, appelé par l'API, offre aussi une **simulation**
  (`?dryRun=1`, qui valide sans rien écrire) et une **fusion**
  (`?mode=merge`, qui met à jour par identifiant au lieu de remplacer).
  L'écran n'offre ni l'une ni l'autre.
  - Rejoué le 23/09 : la simulation de l'export du produit répond 200.
  - *Défaut connu (NEW-07) :* la simulation en fusion de ce même export
    répond 400 (« That record already exists — change_step … »).
- **Les registres réservés à l'import.** Les exigences, les preuves qui
  ne sont pas des documents, les constats de revue, les sièges de
  gouvernance (avec vetos et incompatibilités) et les objections sur
  les décisions n'ont **ni écran ni route d'écriture** en 5.18.0. Ils
  n'entrent qu'avec un livre importé. Ils sont conservés, exportés et
  appliqués (un veto ouvert bloque un jalon de contrôle), mais personne
  ne peut encore en saisir un.
- **Les réglages.** Seuils RAG, seuil de pilotage, identifiant
  d'instance, nom de l'organisation, date d'état, cadence de reporting,
  « Conserver les notifications (jours) » (la purge refuse de tourner
  tant qu'une durée n'est pas décidée), escalade et plafond hebdomadaire,
  « Hôtes de destination autorisés », et la section « Preuve » avec les
  « Hôtes de preuve de confiance » (voir §5). L'enveloppe
  d'investissement se fixe depuis le portefeuille de demandes.
- **« Systèmes branchés ».** Une clé d'API nommée et bornée par
  intégration. Elle n'est montrée qu'une fois et n'est conservée que
  sous forme d'empreinte. On peut changer ses portées, la renouveler ou
  la révoquer. Les portées sont `read:portfolio`, `read:audit`,
  `read:meetings`, `write:portfolio` et `write:meetings`. Tout acte
  d'une clé est audité sous son nom. Une clé écrit avec ses propres
  identifiants et une `Idempotency-Key` facultative, et n'ouvre jamais
  l'interface. Rejoué le 23/09 :
  - une première écriture a créé le projet (201) ;
  - la même clé avec le même corps a rejoué la réponse ;
  - la même clé avec un autre corps a répondu 422 ;
  - un champ inconnu a répondu 400 ;
  - la clé sur une route de session a répondu 401.
  La fédération SDP se configure au même endroit.
- **Audit.** La piste complète, cherchable, avec les images avant et
  après. Un administrateur peut recréer une ligne de registre
  **supprimée** depuis son image d'audit ; les modifications ne se
  défont pas.
- **« Continuité ».** « Exporter l'archive » (`npm run restore` la
  recharge dans une instance vide : la porte de sortie, toujours
  ouverte) et « Terminer toutes les sessions », qui déconnecte tous les
  comptes, le vôtre compris. Pour les sauvegardes, voir
  [`34-exploitation.md`](34-exploitation.md) : `npm run backup`, puis
  `npm run restore-drill`, qui restaure la dernière sauvegarde ailleurs,
  recompte chaque table et consigne la preuve que `/api/health` rapporte.
  Rejoué le 23/09 : sauvegarde prise, restaurée en 1,1 s, chaque table
  concorde.
- **Adoption** (écran à part, admin et groupe) : l'usage par site. Ce
  sont des comptes, jamais de la surveillance.

L'exploitation (depuis les sources, sur PostgreSQL, ou en service
Windows) est traitée dans [`37-technical-reference.md` §8](37-technical-reference.md)
et [`34-exploitation.md`](34-exploitation.md). La posture de sécurité,
et ce qui reste à votre charge, est dans [`SECURITY.md`](../SECURITY.md).

---

## 9 · S'exercer, trouver de l'aide, se débloquer

- **Le terrain d'apprentissage.** `npm run training` démarre un livre
  d'exercice à part sur `:4180`. Il ne touche jamais le vrai et se remet
  à zéro à la demande. Cassez des choses exprès.
- **L'Aide, dans l'application.** La touche **?** donne le manuel par
  tâche, l'aide de champ sur chaque formulaire et les premiers pas de
  votre rôle.
- **Le référent de votre site.** Chaque site nomme la personne à
  appeler en premier.
- **« Quelqu'un d'autre a modifié cet enregistrement — rechargez puis
  réessayez ».** Deux personnes ont modifié la même ligne, et Meridian
  refuse l'écrasement silencieux. Rechargez, lisez l'état frais, et
  refaites votre modification.
- **Un bouton manque.** Lisez la phrase à l'endroit où il serait : elle
  nomme l'autorité qui vous manque ou la séparation des tâches en jeu.
  Une commande manque à cause d'un défaut, pas de l'autorité : la
  boîte de mot de passe (§2, NEW-06).
- **La connexion tourne en boucle sur un réseau local.** L'instance
  envoie des cookies `Secure` sans HTTPS ; l'administrateur retire
  `MERIDIAN_SECURE_COOKIES`.
- **« This book does not declare what its money means »**
  (*affiché en anglais*). Ajoutez `"currencyUnit": "millions"` (ou
  `"units"`) au fichier que vous importez.

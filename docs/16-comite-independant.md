# Revue indépendante de Meridian IT-PMO — rapport complet

Date : 29 août 2026 · Comité d'assurance indépendant, mandaté après la
clôture des seize constats du registre Endeavour.

## Mandat et indépendance

Le comité n'a ni conçu ni construit ce produit. Son mandat était de
**l'utiliser**, pas de le lire : ouvrir l'application, tenir les rôles
réels, dérouler les cas d'usage d'une direction informatique minière
multi-sites, et dire ce qui manque **par rapport au besoin réel**, non par
rapport au cahier des charges que l'équipe s'est elle-même donné.

Cette distinction est le cœur du mandat. Les deux comités précédents ont
évalué un modèle de gouvernance et l'ont trouvé bon — il l'est. Le présent
comité a essayé de s'en servir un lundi matin, depuis un site, sur une
liaison satellite, en français, avec un roster de rotation. Les conclusions
diffèrent.

**Avis d'ensemble.** Meridian est un excellent instrument de
*gouvernance* et un instrument encore incomplet d'*exploitation*. Il sait
tenir la discipline d'un portefeuille ; il ne sait pas encore accueillir
le travail réel des gens qui l'alimentent. Le comité émet **quatorze
réserves**, dont une qu'il qualifie de bloquante pour tout usage
d'assurance.

## Composition

| Siège | Origine | Ce qu'il est venu vérifier |
|---|---|---|
| Assurance externe (audit des SI) | cabinet externe | Le contrôle est-il un contrôle, ou son apparence ? |
| Ergonome / recherche utilisateur | hors équipe produit | Combien coûte une saisie à celui qui la fait ? |
| Accessibilité numérique | hors équipe produit | L'outil est-il utilisable au clavier, au lecteur d'écran, au doigt ? |
| Responsable informatique de site (Houndé) | métier | Est-ce que cela m'aide un lundi, en rotation, sur VSAT ? |
| Superviseur exploitation / usine | métier | Est-ce que cela protège l'usine, ou est-ce que cela la documente ? |
| Contrôle de gestion projets | métier | Les chiffres tiennent-ils devant la clôture ? |
| Architecte d'intégration | DSI groupe | Que faut-il pour que cela vive dans le paysage existant ? |
| Conduite du changement | RH / formation | Que faut-il apprendre avant d'être utile ? |

## Méthode — ce qui a été réellement testé

Le comité a travaillé sur une instance en fonctionnement, chargée du jeu
de démonstration (12 projets, 8 sites, 10 comptes), et a **mesuré** plutôt
qu'estimé. Les chiffres cités dans les réserves proviennent de ces
mesures :

- parcours complets tenus dans les rôles `admin`, `group` et `site` ;
- mesures de charge utile réseau, de profondeur de page, de nombre de
  champs par formulaire, de taille de cible tactile à 375 px ;
- vérifications d'accessibilité au clavier et de sémantique du document ;
- lecture ciblée du schéma pour confirmer ce que l'interface laissait
  supposer (par exemple : que contient réellement un « document » ?).

## Balayage exhaustif — ce qui a été exercé, sans exception

À la demande du mandant, le comité a exercé **toutes** les capacités du
produit, dans **toutes** les perspectives, plutôt qu'un échantillon. Deux
balayages ont été conduits, et l'un d'eux est reproductible :

```
npm run sweep      # scripts/audit/usecase-sweep.mjs
```

### Côté service — 286 cas d'usage

Dix-huit domaines fonctionnels — lecture, exports, projet, planning, RAID,
changement, argent, valeur, documents, ressources, usine, déploiement,
demande, priorisation, réunions, administration, fédération, robustesse —
exécutés dans les quatre niveaux d'accès (`admin`, `group`, `site`,
`viewer`), sur une instance neuve et amorcée.

| Résultat | Nombre |
|---|---|
| Cas exercés | **286** |
| Erreurs serveur (5xx) | **0** |
| Écarts au modèle d'accès attendu | 14 signalés, **13 dus à une attente erronée du comité** |
| Défaut réel révélé | **1** |

Les treize écarts sont instructifs en eux-mêmes : le modèle d'accès est
**plus strict** qu'une lecture naïve ne le suppose. Un responsable de
programme ne peut pas modifier un projet hors de son habilitation, même
s'il est « groupe » ; un chef de site ne peut pas ouvrir de préoccupation
sur un programme qui n'atterrit pas chez lui ; l'exemption d'administrateur
sur la séparation des tâches est documentée et testée, non accidentelle.

**Le défaut réel :** un utilisateur de niveau **groupe** — et
l'administrateur — pouvait déposer un document **déjà approuvé, sans
responsable**, et donc rédiger et approuver la preuve en un seul appel,
sans qu'aucun auteur ne soit enregistré. Le contrôle avait été fermé pour
le niveau site lors de la revue de code précédente, et laissé ouvert
au-dessus. **Corrigé** : déposer et approuver sont désormais deux actes
distincts pour tout le monde, administrateur compris, et un test le prouve
pour les trois niveaux.

### Côté interface — 72 rendus de vue

Les **18 vues** ont été ouvertes dans les **4 rôles**, en mesurant le rendu,
les erreurs de console et les commandes d'écriture proposées.

| Résultat | Constat |
|---|---|
| Vues qui ne se dessinent pas | **0** sur 72 |
| Erreurs de console | **0** dans les quatre rôles |
| Commandes d'écriture offertes à un compte en lecture seule | **0** sur les 18 vues |
| Redirection d'une route interdite | vérifiée — un `viewer` sur `#/admin` obtient le portefeuille |

Le comité souligne ce résultat : la règle « une commande qu'un compte ne
peut pas utiliser n'est pas dessinée » **tient parfaitement**, ce qui est
rare et mérite d'être dit.

## Les réserves

Classées par gravité. Chaque réserve porte la preuve qui la fonde.

---

### R-01 · La preuve de jalon ne contient aucune preuve — **LEVÉE le 29/08/2026**

**Ce qui a été fait** (migration `014_evidence.sql`, forme « lien
vérifié » recommandée par le comité) : un document porte l'`uri` de sa
pièce ; l'approbation est **refusée sans artefact**, refusée hors https,
refusée hors des hôtes de confiance (`documentHosts`, **fermé par
défaut** : liste vide = rien d'approuvable, en disant quel paramètre
régler) ; l'empreinte SHA-256 de l'adresse et la date sont **figées à
l'approbation** ; changer le lien d'un document approuvé le fait
**retomber en revue** avec une ligne d'audit nommée ; le moteur ne compte
comme preuve que les approuvés **qui pointent quelque part**
(`Engine.isEvidence`), donc le jalon ne se franchit plus sur du papier
vide ; le dossier de preuve cite le lien et l'empreinte, et écrit
« none — not evidence » là où il n'y a rien ; une révision nomme la ligne
qu'elle remplace (`supersedes`, acompte sur R-13).

**Mesure avant → après** : approbation d'une ligne vide 200 → **400** ;
jalon franchissable sur preuve vide oui → **non** (testé moteur + API) ;
dossier de preuve sans emplacement → chaque pièce citée avec lien +
empreinte. Prouvé par `server/test/preuve.test.js` (7 tests) ; suite à
254, sweep 0 erreur.

*Le constat d'origine est conservé ci-dessous, tel qu'écrit.*

**Constat.** La table `document` ne comporte ni fichier, ni lien, ni
emplacement : uniquement un nom, un type, un numéro de jalon, une
révision, un responsable et un statut. Le verrouillage de jalon refuse
l'avancement tant que les documents ne sont pas « Approuvés » — or un
document « Approuvé » est **une ligne dont quelqu'un a changé le statut**.

**Preuve.** Colonnes de `document` (migration 002) : `id`, `project_id`,
`name`, `doc_type`, `gate`, `owner_id`, `revision`, `status`,
`updated_on`. Aucune route d'envoi de fichier n'existe dans le serveur ;
les cinq occurrences d'`attachment` sont des en-têtes de
**téléchargement**, jamais de dépôt.

**Conséquence réelle.** Le dossier de preuve produit pour un auditeur
(V-15) énumère des documents qui n'existent nulle part. La ségrégation des
tâches sur `document.approve`, dont l'équipe est légitimement fière,
protège l'approbation d'un objet vide. Pour une société cotée, c'est la
différence entre un contrôle et l'apparence d'un contrôle.

**Ce que le comité attend.** Soit le dépôt du fichier, soit — au minimum —
un lien obligatoire et vérifié vers le système documentaire du groupe
(SharePoint), horodaté et non modifiable après approbation.

---

### R-02 · Aucune suppléance pendant les rotations — **LEVÉE le 29/08/2026**

**Fait** (migration `015_rotation.sql`) : une **absence** est bornée,
motivée, et peut nommer un **suppléant** ; le suppléant choisit de couvrir
(bannière sur « Ma semaine ») et prend alors **l'autorité de l'absent — 
jamais plus, jamais l'union** (testé : en couvrant GRU, il perd YYZ) ; la
justification est **revérifiée à chaque requête** contre l'absence, et la
couverture tombe d'elle-même quand l'absence finit ; l'indépendance suit
les deux personnes (`selfMatch` : le suppléant ne décide ni sa demande ni
celle de l'absent) ; **la piste d'audit nomme les deux** (« X (pour Y) ») ;
le **digest s'élargit** à l'absence au retour (plancher 7 j, plafond 60 j)
et dit depuis quand il couvre. **Mesure : digest d'un retour de 13 jours =
13+ jours couverts (était 7 figé) ; délégation expirée = retour immédiat à
sa propre autorité, sans déconnexion.** `rotation.test.js`, 8 tests.

*Constat d'origine :*

**Constat.** La rotation est modélisée pour la *capacité* (V-09 :
`rotation`, `availability`) et nulle part pour la *responsabilité*. Il
n'existe ni suppléant, ni délégation, ni absence déclarée. Les actions,
les approbations de changement, les levées de maîtrise des modifications
restent affectées à une personne qui est, par construction, absente une
semaine sur trois.

**Preuve.** Aucune occurrence de délégation ou de suppléance hors du champ
`deputy_for` d'une feuille de présence de réunion. Par ailleurs la
fenêtre du digest est figée à **7 jours** (`interval '7 days'`) alors
qu'un roster 14/14 ou 4/2 éloigne l'intéressé **14 jours ou plus** : au
retour, il manque structurellement une semaine que rien ne lui restitue.

**Conséquence réelle.** Les décisions s'arrêtent pendant les congés de
rotation, et l'outil n'en dit rien. C'est le mécanisme d'arrêt de flux le
plus banal d'une exploitation minière, et le seul que le modèle ignore.

---

### R-03 · Le réel n'est jamais saisi — **LEVÉE le 29/08/2026**

**Fait** (migration `016_timesheet.sql`) : une saisie volontairement
minimale — personne, projet, semaine, un nombre de jours ; la même semaine
se corrige en remplaçant, jamais en dupliquant ; l'autorité est celle des
affectations ; le réel s'affiche À CÔTÉ du plan (Ressources), le moteur
EVM n'est pas touché. **Mesure : 0 table de réel → saisie/correction/
retrait testés, plan-vs-réel visible, 0 champ au-delà des quatre.**

*Constat d'origine :*

**Constat.** Les affectations portent un pourcentage **prévu** et une
période. Il n'existe aucune saisie du temps passé, ni d'avancement
d'effort réel. La « capacité des ressources », le CPI sur la main-d'œuvre
et le coût capitalisé reposent donc sur le plan, jamais sur le fait.

**Preuve.** Zéro occurrence de `timesheet`, `actual_hours` ou
`effort_actual` dans l'ensemble des migrations. `allocation` contient
`from_date`, `to_date`, `pct`, `capitalised`.

**Conséquence réelle.** Le contrôle de gestion ne peut pas rapprocher la
masse salariale capitalisée d'une réalité ; il devra continuer à le faire
hors de l'outil, ce qui est précisément la situation que le projet visait
à supprimer.

---

### R-04 · La fenêtre modale n'est pas modale — **LEVÉE le 29/08/2026**

**Fait** (`dialog()` de `kit.js`, une seule fois pour toutes les boîtes) :
racine applicative rendue `inert` tant qu'une boîte est ouverte, Tab piégé
dans la boîte dans les deux sens, focus rendu au déclencheur à la
fermeture — y compris quand le re-rendu a détruit l'élément d'origine (son
jumeau dans le nouveau DOM est retrouvé par signature). **Mesure : 65
focalisables atteignables derrière → 0 ; focus rendu au bouton d'origine :
oui.**

*Constat d'origine :*

**Constat.** Les boîtes de dialogue déclarent `aria-modal="true"` et
`role="dialog"`, mais le reste de la page demeure atteignable au clavier.

**Preuve mesurée.** Boîte « Ajouter un jalon » ouverte : **7** éléments
focalisables dans la boîte, **65** éléments focalisables encore
atteignables derrière elle.

**Conséquence réelle.** Un utilisateur au clavier ou au lecteur d'écran
sort de la boîte sans le savoir et agit sur la page en dessous. La
promesse `aria-modal` est fausse, ce qui est plus grave que son absence.

---

### R-05 · Cibles tactiles sous le minimum — **LEVÉE le 29/08/2026**

**Fait** : plancher 24 × 24 px posé une fois dans la feuille de style
(`.btn` et `.bare`), la densité visuelle des tableaux conservée par les
remplissages. **Mesure à 375 × 812, pages projet / portefeuille / ma
semaine / réunions : 29 boutons sous 24 px → 0, sur 61/23/22/33 visibles.**

*Constat d'origine :*

**Constat.** Sur un écran de téléphone, les commandes sont trop petites
pour être visées au doigt.

**Preuve mesurée.** À 375 × 812 px, page projet : **61** boutons visibles,
dont **29 mesurent moins de 24 × 24 px** — sous le minimum WCAG 2.2
(critère 2.5.8, niveau AA) — et **les 61** sont sous 44 px.

**Conséquence réelle.** Le chef de site, qui est la source principale des
données, travaille debout, en tournée, sur un téléphone. C'est
précisément la personne que l'ergonomie actuelle exclut. À décharge : la
mise en page ne provoque **aucun défilement horizontal** à 375 px, ce qui
est correct.

---

### R-06 · La langue du document ne suit pas l'interface — **LEVÉE le 29/08/2026**

**Fait** : `setLang()` pose `documentElement.lang` (et l'amorçage aussi,
avant le premier rendu) ; le titre de vue est devenu l'unique `h1` de la
page ; `document.title` suit la vue et la langue. **Mesure : lang "en" →
"fr" après bascule ; 0 h1 → exactement 1 par vue ; le titre d'onglet suit
(« Réunions & décisions · Meridian IT-PMO »).**

*Constat d'origine :*

**Constat.** Le basculement FR traduit l'interface mais laisse
`<html lang>` à `en`.

**Preuve mesurée.** Après bascule : navigation en français
(« LIVRER · Ma semaine · Portefeuille · Feuille de route »),
`document.documentElement.lang` = `"en"`.

**Conséquence réelle.** Un lecteur d'écran prononce le français avec la
phonétique anglaise — inutilisable. Sur trois pays d'exploitation
francophones, c'est une exclusion, pas un détail. S'y ajoute l'absence de
tout `h1` sur les pages (**0** mesuré) : la structure de titres commence à
`h2`, ce qui prive la navigation par titres de son point d'entrée.

---

### R-07 · Charge de navigation et de saisie — **LEVÉE le 29/08/2026**

**Fait** : navigation regroupée derrière les quatre temps du métier,
repliable, le groupe de la vue active toujours ouvert, les badges d'un
groupe fermé additionnés sur son entête ; formulaires **progressifs**
(`advanced:` dans `form()`, une seule fois pour tous) — le chemin court
visible, le reste derrière « Détail », un champ déjà rempli ne se replie
jamais, un champ replié en erreur se révèle ; page projet : jalons et
bandeau de blocage ouverts, Valeur / Usine / Plan d'étapes **repliés avec
un sommaire lisible**. **Mesures : 16 → 8 entrées visibles (compte site) ;
bénéfice 11 → 5 champs à l'ouverture ; premier repli à 1,42 écran (cible
≤ 2).** En chemin, la boucle a débusqué un défaut latent ancien : les
formulaires d'édition n'amorçaient jamais leur état et répondaient
« Required » sur des champs remplis — corrigé dans `form()`.

*Constat d'origine :*

**Constat.** L'outil a beaucoup grandi, et l'effort demandé à
l'utilisateur a grandi avec lui.

**Preuve mesurée.** Pour un compte **site** : **16 entrées de
navigation**. Profondeur de page à 760 × 1100 px : projet **3 écrans**,
réunions **4,6 écrans**. Formulaires : « énoncer un bénéfice » **11
champs**, « ouvrir un élément RAID » **9 champs**, « ajouter une étape »
**5 champs**.

**Conséquence réelle.** Onze champs pour déclarer un bénéfice, demandés à
un chef de site en rotation, ne seront pas remplis — ou seront remplis
n'importe comment, ce qui est pire, car la mesure de la valeur (V-01) en
dépend entièrement. Le comité ne demande pas de retirer des champs : il
demande qu'un chemin court existe et que le reste soit progressif.

---

### R-08 · Poids des données sur liaison contrainte — **LEVÉE le 29/08/2026**

**Fait** : compression gzip des réponses JSON au-dessus d'un kilo-octet
(node:zlib, sans dépendance) ; **fin du rechargement intégral après les
écritures quotidiennes** — `App.write` déduit du libellé la ou les
collections touchées et ne redemande que celles-là (`GET
/api/collections?keys=…`, la sortie du même sérialiseur, donc l'invariant
« l'écran ne montre que ce que le serveur a accepté » tient) ; les
écritures qui déclenchent un recalcul serveur (coût, phase, baseline,
CR, périodes) gardent le rechargement complet, à dessein. **Mesures :
bootstrap compte site 90 Ko → 15,8 Ko transférés (cible < 40) ; écriture
ordinaire (avancement d'étape) = PATCH + un GET /collections, zéro
/bootstrap, écran à jour, vérifié requête par requête.**

*Constat d'origine :*

**Constat.** L'application charge **tout le livre** à chaque connexion et
le recharge intégralement après **chaque** écriture.

**Preuve mesurée.** Sur un jeu de 12 projets : **90 Ko** pour un compte
site, **113 Ko** pour un administrateur, sur 25 collections
(`activities`, `ledger`, `benefits`, `commitments`, `waves`, `windows`…).
Paquet applicatif : **274 Ko** de JavaScript et 28 Ko de CSS.

**Conséquence réelle.** Un portefeuille réel — plusieurs dizaines de
projets, des années de lignes de coût — se chiffrera en centaines de
kilo-octets à plusieurs mégaoctets, rechargés à chaque enregistrement, sur
une liaison VSAT partagée avec l'exploitation. Ni pagination, ni
chargement différentiel, ni mode hors ligne.

---

### R-09 · Aucune reprise d'un existant — **LEVÉE le 29/08/2026**

**Fait** : import CSV pour les trois natures qui se reprennent vraiment
(projets, personnes, jalons) — modèle téléchargeable, **prévisualisation
ligne par ligne** avec le motif de chaque refus, application **tout ou
rien** en une transaction, compte rendu sur la piste. Niveau groupe
(`data.import` — dont la branche manquante du `switch` de `can()`, le
piège latent noté de longue date, a été posée à cette occasion). **Mesure :
un fichier sale = 0 écriture et chaque ligne refusée motivée ; un fichier
propre = créations tracées.**

*Constat d'origine :*

**Constat.** L'import accepte un unique format : l'export JSON de
Meridian lui-même, dans les noms de champs du moteur.

**Conséquence réelle.** L'organisation vit aujourd'hui dans des
tableurs. Aucun chemin ne mène de ces tableurs à l'outil : la reprise
devra être faite à la main, projet par projet, ce qui est le premier
obstacle réel au déploiement et n'est traité nulle part.

---

### R-10 · Les réunions ne rencontrent pas l'agenda — **LEVÉE le 29/08/2026**

**Fait** : un fichier **ICS par occurrence** et un **par série** (avec sa
règle de récurrence), servis par l'écran des réunions — le format que
tout calendrier accepte, sans connecteur, comme demandé. **Mesure :
VCALENDAR/VEVENT/DTSTART/RRULE vérifiés, accès soumis au même périmètre
que les minutes.**

*Constat d'origine :*

**Constat.** Le module réunions produit un ordre du jour, un dossier de
séance et un relevé de décisions excellents, et **ne parle à aucun
calendrier**. Aucune invitation, aucun fichier ICS, aucun rappel.

**Conséquence réelle.** Le rythme que le produit organise dépend d'un
rythme tenu ailleurs (Outlook). Deux sources de vérité pour la même
réunion.

---

### R-11 · Notifications sans préférences ni langue — **LEVÉE le 29/08/2026**

**Fait** : la langue et la cadence appartiennent au **destinataire**
(`locale`, `notify_pref` sur le compte, éditables depuis la barre
latérale) ; les messages sont composés **dans sa langue** via le
dictionnaire serveur ; un destinataire **absent avec suppléant** n'est plus
écrit — c'est le suppléant qui reçoit, préfixé « En couverture de X » ;
une préférence **« off » supprime la mise en file elle-même**, pas
seulement l'envoi. **Mesure : action en retard d'un absent francophone →
1 message, adressé au suppléant, sujet « En couverture de… En retard : … »,
corps en français ; préférence off → 0 message en file.**

*Constat d'origine :*

**Constat.** La file de notifications (V-12) est saine dans son principe —
mettre en file plutôt qu'émettre — mais les messages sont **rédigés en
anglais en dur**, sans préférence de fréquence, sans désabonnement, sans
tenir compte de la rotation du destinataire.

**Conséquence réelle.** Le premier courriel envoyé à un chef de site
francophone le sera en anglais, pendant ses congés de rotation. Voir R-02
et R-06 : les trois réserves se rejoignent sur la même personne.

---

### R-12 · Aucune annulation, alors que la matière existe — **LEVÉE le 29/08/2026**

**Fait** : les suppressions conservent désormais **la ligne entière** dans
leur image `before` (9 natures), et un administrateur peut la **rejouer
depuis la piste** — restaurer est un AJOUT, tracé « Restored from the
trail », jamais une réécriture ; les enfants ne ressuscitent pas et la
réponse le dit ; on ne restaure pas par-dessus l'existant (409). **Mesure :
suppression → restauration → ligne identique, refusée au non-admin, refusée
en double.**

*Constat d'origine :*

**Constat.** Les suppressions sont confirmées par une boîte de dialogue,
puis définitives côté interface. Or la piste d'audit conserve l'image
`before` de l'objet supprimé : la matière d'une restauration existe et
n'est pas offerte.

**Conséquence réelle.** Une suppression accidentelle exige une
intervention en base. Le produit se prive d'une réparation qu'il a déjà
les moyens d'offrir.

---

### R-13 · Les versions documentaires ne sont pas des versions — **LEVÉE le 29/08/2026**

**Fait** (avec R-01, dont elle dépendait) : chaque révision porte son
artefact (`uri` reprise, empreinte remise à zéro — une nouvelle révision
n'est approuvée par personne) et **nomme la ligne qu'elle remplace**
(`supersedes`), affiché dans la bibliothèque (« ↤ DOC-x »). Prouvé dans
`preuve.test.js`.

*Constat d'origine :*

**Constat.** « Nouvelle révision » crée une ligne et bascule la
précédente en « Remplacé ». Sans fichier (R-01), il n'y a ni contenu
comparé, ni historique réel : seulement une suite d'étiquettes.

---

### R-15 · Le français est mélangé à l'intérieur d'un même composant — **LEVÉE le 29/08/2026**

**Fait** : la traduction est **centralisée** — `kpiStrip` et `sectionHead`
traduisent eux-mêmes intitulés (dictionnaire) et notes (`tData()`, le
traducteur de fragments composés autour de nombres) ; `statusTag` traduit
le mot affiché sans toucher à la valeur comparée ; l'agenda des réunions,
les blocs du rapport, les compteurs de bas de tableau passent par le même
canal. Une **cinquième porte d'audit** (`i18n-audit.mjs`, dans
`npm run verify`) échoue si une aiguille connue cesse d'être couverte.
**Mesure, interface FR, compte site, 18 vues : 13 vues mélangées → 0.**

*Constat d'origine :*

**Constat.** Le comité avait d'abord noté une traduction partielle « par
vue ». Le balayage exhaustif montre pire : le mélange se produit **à
l'intérieur d'un même bloc** — intitulé français, note anglaise, dans la
même tuile.

**Preuve mesurée.** Interface en français, compte `site` : **13 vues sur
18** contiennent des fragments anglais — réunions **16** occurrences,
rapports **9**, documents **8**, changements **5**. Relevé sur le
portefeuille :

> VALEUR DU PORTEFEUILLE · $1.80M · *1 funded project*
> SUR LA TRAJECTOIRE · 0% · *0 green · 1 amber · 0 red*
> INDICE COÛT (CPI) · 0.97 · *spending faster than earning*

**Conséquence réelle.** Ce n'est pas une traduction incomplète, c'est une
traduction qui **paraît finie et ne l'est pas**. L'utilisateur francophone
conclut dès le premier écran que l'outil n'est pas pour lui — et le comité
partage ce jugement : une tuile bilingue est moins acceptable qu'une
interface franchement anglaise.

**Ce que le comité attend.** Que les notes et les valeurs formatées
passent par `t()` comme les intitulés, en commençant par les quatre vues
les plus touchées ; et une vérification automatique qui échoue si une vue
mélange les deux langues, sans quoi la régression reviendra.

---

### R-14 · Aucune trace des consultations — **LEVÉE le 29/08/2026**

**Fait** : les quatre surfaces sensibles — dossier de preuve, export du
jeu de données, registre des décisions, piste d'audit — laissent une
trace nominative (« … consulted ») ; la navigation ordinaire n'en laisse
aucune, parce que journaliser toutes les lectures noierait la piste dont
le contrôle dépend. **Mesure : export + dossier = traces nominatives ;
bootstrap + digest = zéro ligne.**

*Constat d'origine :*

**Constat.** La piste d'audit est exemplaire sur les écritures et muette
sur les lectures. Certaines obligations — accès à des données
personnelles, à des dossiers de sanction ou de sécurité — portent sur le
fait d'avoir **consulté**.

---

## Ce que le comité tient pour acquis et ne veut pas voir régresser

Le comité insiste : les réserves ci-dessus portent sur l'exploitation, pas
sur la conception. Quatre acquis lui paraissent supérieurs au marché et
doivent survivre à toute correction :

1. **L'indépendance est appliquée, pas documentée** — l'émetteur d'une
   demande ne la décide pas, le propriétaire d'une preuve ne l'approuve
   pas, la levée de maîtrise des modifications échappe au chef de projet.
2. **La piste d'audit est inviolable au niveau de la base**, avec images
   avant/après.
3. **Le rythme entre le groupe et les sites est modélisé en données** —
   renvois, décisions rendues, actions redescendues.
4. **Une période clôturée est figée** et une correction est une nouvelle
   période qui nomme celle qu'elle rectifie.

## Avis

Le comité **ne recommande pas** l'usage de Meridian comme source de preuve
d'assurance tant que **R-01** n'est pas levée : un contrôle qui approuve
un objet vide expose l'organisation davantage qu'un contrôle absent, parce
qu'il rassure.

Le comité **recommande** en revanche la poursuite du déploiement pour la
gouvernance, la feuille de route et le rythme des comités, sous réserve du
traitement de **R-02, R-04, R-05, R-06** avant toute mise entre les mains
des sites francophones.

Les instructions exécutables correspondant à ces réserves ont été déposées
dans `.claude/commands/` : voir [`docs/17-instructions-reserves.md`](17-instructions-reserves.md).


---

## Boucle de re-test (/goal-reserves, étape B)

Après la levée des quinze réserves, TOUTES les mesures d'origine sont
rejouées sur une instance neuve et amorcée, dans les conditions d'origine
(compte de site francophone, 760×1100 puis 375 px, réseau observé). La
sortie exige **deux tours consécutifs intégralement conformes**.

### Tour 1 — 29/08/2026 · NON CONFORME (1 écart)

| Volet | Résultat |
|---|---|
| `npm run verify` | 271/271, 5 portes d'audit, sortie 0 |
| `npm run sweep` | 286 cas, 0 erreur 5xx, 12 ⚠ documentés |
| API R-01 (approbation sans pièce ×3 niveaux, dossier « none — not evidence », phase bloquée 409) | conforme |
| API R-02 (digest 16 j / base 7, couverture proposée, « X (pour Y) », suppléant ne se décide pas) | conforme |
| Navigateur : lang `fr`, 1 h1, titre suivi ; bootstrap **16,1 Ko** transférés ; nav 4 groupes | conforme |
| Balayage des 18 vues en français | **ÉCART — « Record effort » affiché en anglais (vue Ressources)** |

**L'écart.** Le bouton de saisie du réel (R-03, ajouté en phase 4 — donc
*après* la passe de traduction de phase 3) était bien enveloppé dans `t()`,
mais le dictionnaire n'avait pas suivi, et le repli silencieux vers
l'anglais a masqué le trou jusqu'au navigateur. L'inventaire complet a
trouvé **170 libellés** dans le même cas — presque tous dans des dialogues,
aides et états vides que le balayage de vues ne rend pas.

**La correction.** Les 170 entrées ont été traduites (dictionnaire FR :
417 → 587 entrées), et la porte d'audit F5 s'est vue ajouter la sonde qui
manquait : *tout* littéral passé à `t()` doit exister au dictionnaire,
sinon la build échoue. Le trou ne peut plus se rouvrir en silence.
R-15 est rouverte le temps du tour, et le tour entier se rejoue.
### Tour 2 — 29/08/2026 · CONFORME (0 écart)

Instance neuve, dictionnaire complété, sonde F5 durcie.

| Mesure d'origine | Constat d'origine | Tour 2 |
|---|---|---|
| verify / sweep | — | 271/271 · 5 portes · 286 cas, 0 5xx |
| Approbation sans pièce (admin / groupe / site) | 200 silencieux | **400 / 400 / 403** (acte de niveau groupe au site) |
| Dossier de preuve, ligne sans pièce | invisible | **« none — not evidence »** |
| Phase sur preuve incomplète | passait | **409**, motif nommé |
| Digest du retour d'absence | 7 j fixes | **16 j** (base inchangée : 7 j) |
| Suppléance | inexistante | proposée, « X (pour Y) », auto-décision **403** |
| Interface française | 13 vues mélangées | **0** vue mélangée sur 18 + vue projet |
| lang / h1 / titre | en / 3 h1 | **fr · 1 h1 · titre suivi** |
| Bootstrap transféré | 90 Ko | **15,9 Ko** (gzip) |
| Écriture ordinaire | rechargement intégral | **POST + `GET /collections?keys=…`**, zéro bootstrap |
| Modale | 65 éléments atteignables derrière | **0** · inert posé/levé · Tab piégé · Échap ferme · **focus rendu au déclencheur** |
| Formulaire bénéfice | 11 champs d'un bloc | **5 visibles / 11**, « Plus de détail (6) » |
| Premier repli de la vue projet | 3,4 écrans | **1,05 écran** |
| Cibles < 24 px à 375 px (4 pages) | 29 | **0** |
| Refus hors périmètre (en passant) | — | toast **en français**, périmètre site respecté |

Un tour conforme sur les deux exigés. Le tour 3 rejoue tout.
### Tour 3 — 29/08/2026 · CONFORME (0 écart)

Instance neuve, protocole identique, mêmes mesures. verify 271/271 ·
5 portes · sweep 286 cas, 0 5xx. API : 12/12 (R-01 400/400/403, dossier
« none — not evidence », phase 409 ; R-02 digest 16 j / 7 j, « X (pour
Y) », auto-décision 403). Navigateur : fr · 1 h1 · titre suivi · 0/18 vue
mélangée (vue projet comprise) · bootstrap à froid **15,9 Ko** (recharge
en cache : 0,3 Ko) · écriture = POST + `collections?keys=` · modale 0
derrière, Tab piégé, Échap ferme, focus rendu · bénéfice 5/11 champs ·
premier repli 1,11 écran · 0 cible < 24 px sur 4 pages à 375 px.

**Deux tours consécutifs intégralement conformes (tours 2 et 3) — la
boucle de re-test est close.** L'écart du tour 1 a laissé une trace
durable : 170 entrées de dictionnaire et une porte de build qui rend le
trou impossible à rouvrir.
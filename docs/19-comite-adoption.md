# Comité d'adoption et d'ergonomie — rapport complet

Date : 29 août 2026 · Comité convoqué après la recette AMDEC
([18-amdec-recette.md](18-amdec-recette.md)), sur un mandat que les trois
comités précédents n'avaient pas reçu.

## Mandat

Les comités de conception, de valeur et d'assurance ont jugé un
**instrument**. Ce comité juge ce qui permet à quelqu'un de **s'en
servir** : le manuel, l'aide au moment de la décision, la prise en main
des premiers jours, les modèles, les messages qui apprennent au lieu de
bloquer, les parcours par métier, et la mesure de l'adoption elle-même.

L'ergonomie de base n'est pas dans le champ : elle a été traitée et le
comité l'a vérifiée avant de siéger. Les formulaires se replient, la
navigation tient en cinq intentions, le clavier passe partout, les
commandes interdites ne sont pas dessinées. Rien de cela n'est rediscuté
ici — et le comité s'interdit de réclamer ce qui existe déjà. Il a donc
commencé par **compter** ce que le produit porte, avant d'écrire une
seule réserve.

**Avis d'ensemble.** Meridian sait tenir un portefeuille et ne sait pas
encore se faire apprendre. La couche pédagogique n'est pas absente — elle
est **partielle, non traduite, non réouvrable et non mesurée**. Le comité
émet **douze réserves**, dont deux qu'il qualifie de bloquantes pour une
mise en service sur un site francophone.

## Composition

| Siège | Origine | Ce qu'il est venu vérifier |
|---|---|---|
| Rédaction technique | hors équipe produit | Existe-t-il un manuel, et où vit-il ? |
| Ergonomie pédagogique | hors équipe produit | L'écran enseigne-t-il, ou se contente-t-il d'être juste ? |
| Formation terrain (déploiements miniers multi-sites) | prestataire | Puis-je former huit personnes sans abîmer le livre réel ? |
| Référent de site non informaticien (surintendant maintenance, Houndé) | métier | Est-ce que je comprends ce qu'on me demande sans appeler quelqu'un ? |
| Accessibilité et lisibilité | hors équipe produit | L'aide est-elle atteignable, et dans la langue du lecteur ? |
| Conduite du changement | RH / formation groupe | Que faut-il savoir avant d'être utile — et qui l'enseigne sur place ? |
| Support / service desk niveau 1 | DSI groupe | Quels appels vais-je recevoir, et l'outil m'aide-t-il à y répondre ? |
| Nouvel arrivant « jour 1 » (contrôle de gestion projets) | métier | Combien de temps avant ma première saisie juste, seul ? |

## Méthode — ce qui a été compté

Le comité a lu le code avant de parler. Les chiffres ci-dessous sont des
comptages reproductibles sur l'arbre du 29/08/2026, pas des impressions.

| Ce qui a été cherché | Ce qui a été trouvé |
|---|---|
| Aides au champ (`hint:`) | **49**, réparties sur **22 des 58 formulaires** |
| Aides au champ passant par `t()` | **25 sur 49** |
| États vides `emptyState(` | **7** ; messages `empty:` de tableau : **12** |
| États vides passant par `t()` | **0 sur 7** pour `emptyState(` ; **4 sur 12** pour `empty:` |
| Dialogue d'orientation par rôle | **1** (`maybeStartHere`, `main.js:501`), traduit, appelé depuis **un seul endroit** |
| Page d'aide de l'en-tête | **1** (`helpDialog`, `main.js:342`), **4 concepts** expliqués, **0 chaîne traduite** |
| Écrans du produit | **18** ; écrans portant une phrase d'orientation permanente : **0** |
| Motifs de refus distincts du serveur | **28** (`shared/rbac.js`) ; nommant une suite à donner : **3** |
| Documents du dossier `docs/` | **19**, dont **0** manuel d'utilisation ; liens depuis l'application vers une documentation : **0** |
| Portes automatiques de la campagne (`npm run audit`) | **5** — routes, CRUD+audit, versions, contrôles, langue ; portant sur la couche pédagogique : **0** |

Le comité relève d'emblée que le produit **sait** faire ce qu'il ne fait
qu'en partie : la liste de mise en route qui se coche seule, les refus
qui nomment la voie ouverte, les modèles de projet livrés à la création
existent — et sont réservés à un rôle, à une poignée de cas, ou à un
écran. Les réserves qui suivent portent moins sur une absence de savoir-
faire que sur son application incomplète.

---

## Réserves — bloquantes

### A-01 · Il n'existe aucun manuel d'utilisation, ni dedans ni à côté

**Constat.** Personne ne peut apprendre Meridian autrement qu'en le
manipulant ou en demandant à quelqu'un. Il n'existe pas de mode
opératoire destiné à celui qui saisit.

**Preuve.** Le dossier `docs/` contenait, avant le présent rapport,
dix-neuf fichiers : une charte de
comité, un registre d'exigences, une analyse d'écart, une architecture,
un modèle d'accès, dix rapports de revue et deux registres de campagne.
Aucun n'est écrit pour un utilisateur. Le seul qui s'en approche —
`docs/05-meeting-animation.md` (163 lignes) — annonce lui-même qu'il est
« both the design and the operating playbook » : il couvre **un** module,
il est en anglais, et rien dans l'application n'y mène. Le `README.md`
(180 lignes) est intégralement destiné à qui installe : commandes npm,
variables d'environnement, mots de passe de démonstration, arborescence.
Une recherche de lien sortant dans tout le client
(`href=` dans `web/src`) ne renvoie **aucun résultat** : l'application ne
pointe vers aucune documentation, la sienne comprise.

**Conséquence réelle.** Le surintendant maintenance de Houndé, nommé
référent Meridian pour son site, reçoit ses identifiants un lundi de
rotation. On lui demande de tenir l'avancement de deux projets de site et
d'ouvrir une préoccupation sur un projet groupe qui touche son usine. Il
n'a rien à lire. Sa seule ressource est la personne du groupe qui l'a
formé une heure en juillet — laquelle est, statistiquement, en rotation
elle aussi. Le service desk hérite de l'écart : chaque question
« comment fait-on pour… » devient un ticket, et la réponse n'est écrite
nulle part, donc elle est réécrite à chaque fois.

**Ce que le comité attend.** Un manuel qui **vit dans le produit**, pas à
côté : atteignable depuis l'en-tête, découpé par tâche et non par écran,
et écrit dans les deux langues. Un fichier Markdown de plus dans `docs/`
ne lèverait pas cette réserve — il ne serait pas plus lu que les dix-neuf
autres.

**Mesure de clôture.** Un nouvel arrivant, à qui l'on ne donne que son
identifiant et l'adresse de l'application, accomplit **les six tâches du
jour 1 de son rôle** — se connecter et changer son mot de passe, trouver
son propre travail, mettre à jour l'avancement d'une étape, ouvrir un
élément RAID, retrouver une décision de comité, produire son état
hebdomadaire — **sans aide humaine et sans ouvrir un fichier hors de
l'application**. Mesuré sur trois personnes par rôle (site, groupe,
lecteur), chronomètre au départ. Réserve levée à 3/3 par rôle.

---

### A-02 · La page qui explique le produit — **LEVÉE le 30/08/2026**

**Fait.** Les vingt chaînes de la page d'aide passent par `t()` et sont
traduites : concepts, raccourcis, phrase de recours. Un cinquième concept
a été ajouté au passage — le score de priorisation (acompte sur A-06),
parce que c'est le nombre qui trace la ligne de flottaison budgétaire et
qu'il n'était expliqué nulle part. **Mesure : page d'aide ouverte en
français, 0 mot anglais sur 10 aiguilles cherchées ; porte F5 étendue à
`main.js`, la construction échoue si un littéral pédagogique repart en
anglais.**

*Constat d'origine :*

**Constat.** Le bouton « ? » de l'en-tête ouvre la seule surface qui
explique ce que veulent dire la santé RAG, les jalons, le périmètre et
les renvois entre comités. Elle est entièrement en anglais, et elle le
restera : ses chaînes ne sont pas passées par `t()`.

**Preuve.** `web/src/main.js:342-372`. Les quatre concepts
(`const HOW`, ligne 352) et les huit raccourcis (`const rows`, ligne 343)
sont des littéraux nus ; l'appel final est
`dialog({ title: "Help", kicker: "Meridian IT-PMO", body })` (ligne 372).
Aucune des six chaînes de structure — « How Meridian works »,
« Health (RAG) », « Gates », « Your scope », « Decisions & referrals »,
« Keyboard & direct manipulation » — n'a d'entrée au dictionnaire
`web/src/lib/i18n.js`. Vérifié chaîne par chaîne : six absences sur six.

Aggravant : le dialogue « Par où commencer », lui **intégralement
traduit** (les cinq textes de `BY_ROLE`, `main.js:505-511`, sont au
dictionnaire — vérifié), se termine en français par la phrase
« Ctrl-K recherche partout ; le bouton ? de l'en-tête explique comment
fonctionnent la santé, les jalons et le périmètre » (`i18n.js`). Le
produit envoie donc son utilisateur francophone, en français, vers une
page qui ne lui répondra qu'en anglais.

**Conséquence réelle.** Le chef informatique de Houndé voit une pastille
ambre sur un projet, veut savoir ce qu'elle signifie, suit exactement le
conseil que l'outil vient de lui donner en français, et tombe sur
« Green/Amber/Red is derived from schedule and cost indices ». Il ne
demandera pas deux fois. À partir de là, la couleur devient décorative :
il la lit comme un avis, pas comme un calcul qu'il pourrait contredire
avec un motif écrit — ce qui est précisément le contrôle que la
gouvernance attend de lui.

**Mesure de clôture.** **0 chaîne de `helpDialog` hors dictionnaire**,
vérifié par extension de la porte `scripts/audit/i18n-audit.mjs` à
`web/src/main.js` : la construction échoue si un littéral pédagogique
n'est pas passé par `t()`. Contrôle visuel complémentaire : capture de la
page d'aide en français, **zéro mot anglais**.

---

## Réserves — majeures

### A-03 · L'orientation par rôle — **LEVÉE le 30/08/2026**

**Fait.** La case « Ne plus afficher » n'est plus cochée par défaut —
fermer une boîte qu'on n'a pas lue ne vaut plus renoncement. « Par où
commencer » se rouvre par **deux chemins** : un bouton dans la page
d'aide et une commande de la palette (Ctrl-K). Et le souvenir porte
désormais le RÔLE lu, pas seulement le compte : une promotion au niveau
groupe ramène l'orientation écrite pour ce rôle, une fois, sans qu'on la
demande. **Mesure : orientation atteignable en deux actions depuis
n'importe quelle vue, case décochée, réouverture vérifiée par les deux
chemins.**

*Constat d'origine :*

**Constat.** Le seul contenu du produit adapté au métier de celui qui se
connecte s'affiche une fois, se referme, et ne revient jamais.

**Preuve.** `main.js:501` — `maybeStartHere()` est appelé depuis **un
seul endroit** (`main.js:439`, à la fin de la connexion). Aucune commande
de la palette, aucun bouton, aucun raccourci n'y mène : recherche de
`maybeStartHere` dans tout `web/src` → deux occurrences, la définition et
son unique appel. La case « Ne plus afficher » est **cochée par défaut**
(`main.js:515`, `checked: true`) : fermer la boîte sans la lire suffit à
la perdre. Le souvenir est stocké dans `localStorage`
(`meridian-started`, `main.js:500`), donc côté navigateur : un poste
partagé de salle de contrôle la remontre à tout le monde, un second
appareil la remontre à celui qui l'avait déjà vue, et l'administrateur
n'a aucun moyen de savoir qui l'a lue.

**Conséquence réelle.** Le contrôleur de gestion projets recruté en
septembre se connecte entre deux réunions, ferme la boîte d'un réflexe,
et n'apprendra jamais que « Portefeuille » lui donne le titre et
« Rapports » le récit. Six mois plus tard, promu au niveau groupe, il
change de rôle : les trois lignes qui décrivent ce que gouverne un compte
groupe existent, sont écrites, sont traduites — et ne lui seront pas
montrées, parce que son identifiant figure déjà dans la liste des vus.

**Mesure de clôture.** « Par où commencer » est atteignable **à tout
moment par au moins deux chemins** (la page d'aide et la palette Ctrl-K) ;
la case n'est **pas cochée par défaut** ; le dialogue est **représenté
lorsque le rôle ou les habilitations d'un compte changent**. Test :
100 % des comptes retrouvent l'écran en **deux actions au plus** depuis
n'importe quelle vue ; un changement de rôle en base déclenche le
réaffichage à la connexion suivante.

---

### A-04 · La couche pédagogique et la porte de langue — **LEVÉE le 30/08/2026**

**Fait.** Les 29 chaînes pédagogiques nues — 20 aides au champ, 7 états
vides, 2 messages de tableau — passent par `t()` et sont traduites ; les
13 chaînes de l'écran de première mise en route appellent enfin les
traductions qui étaient écrites depuis le début. Surtout, la porte F5
regarde maintenant `hint:`, `emptyState(` et `empty:` : **une aide
au champ en anglais nu fait échouer la construction**. Dictionnaire :
587 → **648 entrées**. **Mesure : 0 chaîne pédagogique nue (29 avant),
10/10 chaînes de première mise en route traduites, porte verte.**

*Constat d'origine :*

**Constat.** La campagne précédente a posé une porte automatique qui fait
échouer la construction quand un libellé français manque (R-15, porte F5,
`scripts/audit/i18n-audit.mjs`). Elle ne regarde ni les aides au champ,
ni les états vides, ni les écrans de première mise en route. Résultat :
la partie du produit qui **enseigne** est celle qui reste en anglais.

**Preuve.** Comptages sur l'arbre :

- **24 des 49 aides au champ** ne passent pas par `t()` — dont les sept
  du module d'administration (création de compte,
  `administration.js:303, 314, 319, 343` ; annuaire `513, 536` ; sites
  `611`), les quatre du module comités (`meetings.js:205, 215, 593, 598`)
  et celles de la re-ligne de base (`index.js:1212, 1214`). `kit.js:305`
  rend `f.hint` tel quel : une aide non enveloppée reste anglaise, sans
  recours.
- **Les sept appels à `emptyState(`** passent des littéraux nus
  (`index.js:453, 511, 689, 1456, 3601, 4150` ; `meetings.js:95`), y
  compris ceux qui sont les mieux écrits du produit — « Aucun comité dans
  votre périmètre… un administrateur groupe ou site met en place la revue
  hebdomadaire et le comité mensuel ».
- **L'écran de première mise en route est en anglais alors que sa
  traduction est écrite.** `index.js:149, 150, 164, 165` posent
  « Being set up », « This portfolio has no projects yet », « First run »,
  « Set up the portfolio » en clair ; `i18n.js:510-513` contient les
  quatre traductions correspondantes — jamais appelées. Les cinq étapes
  et leurs indications (`index.js:157-161`) sont nues elles aussi.

**Conséquence réelle.** L'administrateur qui installe Meridian sur le
premier site francophone voit, comme tout premier écran de sa vie
Meridian, une page intitulée « Set up the portfolio ». Le français avait
été écrit pour lui et n'a pas été branché. Ce n'est pas un oubli de
traduction : c'est un oubli d'appel, que rien ne détecte parce que la
porte ne regarde pas là.

**Mesure de clôture.** La porte `i18n-audit.mjs` est étendue à trois
motifs — `hint:`, `emptyState(`, et les littéraux de rendu de
`emptyBookPanel` et `helpDialog`. **La construction échoue** tant qu'une
chaîne pédagogique n'est pas passée par `t()`. Cible : **0 chaîne
pédagogique nue** (aujourd'hui : 24 aides + 7 états vides + 13 chaînes de
première mise en route + la page d'aide entière).

---

### A-05 · L'aide au champ couvre 38 % des formulaires

**Constat.** Là où l'aide au champ existe, elle est excellente — « le
responsable métier qui veut cela, pas la personne qui le construit »,
« obligatoire pour refuser : la personne qui a demandé le lira ». Elle
manque sur près des deux tiers des formulaires, et notamment sur ceux
qu'un débutant rencontre en premier.

**Preuve.** 58 appels à `formDialog` dans le client. **22 portent au
moins une aide au champ ; 36 n'en portent aucune.** Parmi les
formulaires muets : la création de compte (`administration.js:354`), la
fiche personne (`521`), la création de site (`637`), la création d'une
série de comité (`meetings.js:248`), l'enregistrement d'une décision
(`550`), l'ouverture d'une action (`613`, `643`), la clôture de période
(`index.js:2729`), la saisie d'une réalisation de bénéfice (`2966`,
`2979`). Le compte absolu est de 49 aides pour l'ensemble du produit.

**Conséquence réelle.** La contrôleuse de gestion clôture août. Le
formulaire lui demande une période, une mention de correction et une
note ; ces trois-là portent une aide. Le formulaire de réalisation de
bénéfice qui suit ne lui dit ni contre quoi la mesure est comparée, ni
qui est censé la fournir, ni ce qui se passe si elle la laisse vide. Elle
saisit ce qu'elle croit, et le comité de bénéfices lira dans six mois un
chiffre dont personne ne connaît la base.

**Mesure de clôture.** **Au moins 46 des 58 formulaires d'écriture
(80 %) portent au moins une aide au champ**, et **100 % des champs dont
la valeur est lue par une autre personne que celle qui la saisit**
(motif de refus, note de décision, mesure de bénéfice, justification de
re-ligne de base) en portent une. Comptage scriptable, même méthode que
ci-dessus, publié à chaque construction.

---

### A-06 · Le nombre qui décide de l'argent n'est expliqué nulle part

**Constat.** L'écran de priorisation classe les projets par un score et
trace une ligne de flottaison budgétaire. Le produit n'explique nulle
part d'où vient ce score.

**Preuve.** `shared/engine.js:433-438` :
`fit + value + (6 - risk) + (6 - effort)` — quatre notes de 1 à 5, deux
lues à l'endroit, deux inversées, un total de 4 à 20. La colonne
« Score » (`web/src/views/index.js:2358`) affiche le nombre seul, sans
infobulle ni légende. Les quatre composantes n'apparaissent que dans le
formulaire de décision d'une demande (`index.js:2397-2398`), visible du
seul niveau groupe et seulement pendant la saisie. La page d'aide
(`main.js:352`) traite quatre concepts — santé, jalons, périmètre,
renvois — et pas celui-là. Rien, dans les 4 487 lignes de vues, ne dit
qu'un risque élevé **baisse** le score.

**Conséquence réelle.** En arbitrage de portefeuille, deux projets se
présentent à 14 et 13 ; le second passe sous la ligne. Le chef de site
dont le projet est sous la ligne demande pourquoi. Personne dans la
salle, y compris le président, ne peut reconstituer la composition des
deux nombres sans ouvrir le code. Un arbitrage budgétaire qu'on ne sait
pas expliquer n'est pas un arbitrage : c'est un verdict.

**Mesure de clôture.** Sur **100 % des lignes portant un score**, les
quatre composantes et leur valeur pour cette ligne sont lisibles sans
quitter l'écran, et la règle « risque et effort élevés font baisser le
score » est écrite au point d'usage. Test de compréhension : **trois
lecteurs non formés sur trois** reconstituent la formule à partir du seul
écran.

---

### A-07 · Vingt-cinq refus sur vingt-huit ne disent pas quoi faire ensuite

**Constat.** Le serveur refuse bien, et il refuse en français. Il dit
presque toujours **ce qui est**, presque jamais **ce qui reste ouvert**.

**Preuve.** `shared/rbac.js` porte **28 motifs de refus distincts**
(27 appels littéraux à `deny()` plus les deux branches du ternaire final,
lignes 403-409). Trois seulement nomment une suite : « les preuves de
jalon sont approuvées au niveau groupe — **voyez votre bureau de
programme** » (ligne 299), « ceci est un projet de site — **ouvrez-y un
élément RAID ordinaire** » (311), « les préoccupations sont le canal du
site — **vous disposez ici de l'autorité RAID ordinaire** » (310). Les
vingt-cinq autres s'arrêtent au constat : « ce projet n'est pas dans
votre périmètre d'autorité », « autorité insuffisante », « compte en
lecture seule », « aucun projet dans le périmètre ».

Le cas le plus coûteux est visible à l'écran. Sur un projet groupe, un
chef de site lit la phrase — traduite, correcte —
« Ce projet est gouverné au niveau groupe. Votre site y a un accès en
lecture ; les modifications se font au niveau groupe »
(`index.js:761`). La voie qui lui est réellement ouverte, la
préoccupation, **n'est pas nommée là** : le bouton « Ouvrir une
préoccupation » n'existe que sur l'écran « Mon site »
(`index.js:543`), c'est-à-dire pas à l'endroit où il se cogne.

**Conséquence réelle.** Le chef informatique de Houndé constate qu'un
projet groupe va couper son réseau pendant l'arrêt d'usine. Il ouvre le
projet, cherche à écrire, lit qu'il est en lecture seule, et referme. Le
mécanisme conçu exactement pour lui — la préoccupation, qui remonte dans
la chaîne d'escalade et atterrit à l'ordre du jour du comité groupe —
existe, fonctionne, est testé, et ne lui a pas été offert au moment où il
en avait besoin. Le risque sera découvert en réunion, ou pas.

**Mesure de clôture.** **0 message de refus sans une suite nommée** :
chacun des 28 motifs indique soit qui saisir, soit quel acte reste
ouvert. Contrôle scriptable sur `shared/rbac.js` — chaque `deny()`
contient un tiret cadratin suivi d'une suite — cible 28/28, et chaque
suite au dictionnaire `server/src/i18n.js`. Contrôle d'écran
complémentaire : sur un projet groupe vu par un compte site, la
commande « Ouvrir une préoccupation » est présente sur l'écran du projet.

---

### A-08 · L'adoption n'est mesurée par rien

**Constat.** Trois mois après la mise en service, personne ne saura dire
si l'outil est utilisé, par qui, ni où il a cessé de l'être.

**Preuve.** Le seul signal d'usage du produit est `last_login_at`
(`server/src/auth.js:170, 201`), affiché en colonne « Last seen » de la
liste des comptes (`administration.js:250-251`), compte par compte, sans
agrégat, sans historique et sans seuil. Les cinq portes automatiques de
`npm run audit` — routes, CRUD+audit, versions, contrôles, langue — ne
mesurent aucun usage. Aucun écran ne répond à « quel site a cessé de
mettre à jour son avancement », « combien de comités se tiennent
réellement dans l'outil », « combien de refus les gens rencontrent-ils
par semaine ».

La donnée existe pourtant déjà, entièrement : la piste d'audit est en
ajout seul et transactionnelle, les occurrences de comité portent leur
état, les décisions et les actions sont datées, les saisies de semaine
sont horodatées. Ce qui manque n'est pas la collecte, c'est la lecture.

**Conséquence réelle.** Au comité de pilotage du trimestre, le sponsor
demande si le déploiement a pris. La réponse disponible aujourd'hui est
une opinion. Si l'un des huit sites a discrètement recommencé à tenir son
portefeuille sur un tableur, rien dans Meridian ne le dira — et c'est
exactement le mode d'échec d'un outil de gouvernance multi-sites.

**Mesure de clôture.** Un écran d'adoption, réservé au niveau groupe,
portant **six indicateurs par site et par mois** : comptes actifs sur
comptes ouverts ; jours depuis la dernière mise à jour d'avancement ;
part des comités planifiés effectivement ouverts puis clos dans l'outil ;
actions closes sur actions ouvertes ; semaines saisies sur semaines
attendues ; refus rencontrés par utilisateur actif. Un site sans activité
depuis **30 jours** est nommé. Réserve levée quand les six indicateurs
sont produits sur les huit sites et qu'une ligne de base est datée.

> Le comité recommande d'installer cette mesure **avant** les lots
> suivants, faute de quoi il sera impossible de dire si les corrections
> ont servi.

---

## Réserves — moyennes

### A-09 · Le protocole du comité vit hors du produit

**Constat.** `docs/05-meeting-animation.md` explique très bien ce qu'un
président doit faire : ce que l'état `scheduled`, `open`, `closed`
autorise, pourquoi l'ordre du jour s'écrit tout seul, pourquoi la revue
hebdomadaire tient en quinze minutes. Le président ne le lira pas : il
est en anglais, dans un dossier de dépôt, et l'écran des comités n'y mène
pas.

**Preuve.** Le tableau des trois états et de ce qu'ils permettent est aux
lignes 40-46 de `docs/05`. `web/src/views/meetings.js` (791 lignes) ne
contient aucun équivalent : ni phrase d'orientation, ni rappel du
temps imparti au moment d'ouvrir la séance, ni explication de ce qu'un
renvoi vers le comité supérieur va déclencher. La seule aide de l'écran
est un état vide, en anglais (`meetings.js:95`).

**Conséquence réelle.** Le chef de site préside sa revue hebdomadaire
pour la première fois, ouvre l'occurrence, et découvre en séance qu'il ne
peut plus rien corriger une fois close. Il clôture trop tôt, ou pas du
tout — et une occurrence jamais close ne produit ni compte rendu, ni
report d'actions.

**Mesure de clôture.** Le tableau des trois états et la conduite de
séance sont **dans l'écran du comité**, au moment où ils servent, dans
les deux langues ; **0 clic vers un fichier hors du produit** pour
présider une réunion. Test : trois présidents ouvrent, animent et
clôturent une occurrence sans assistance, 3/3.

---

### A-10 · Il n'existe pas de parcours d'apprentissage par rôle

**Constat.** Ce qui distingue l'apprentissage d'un chef de site de celui
d'un contrôleur de gestion tient aujourd'hui en trois à quatre lignes de
prose, montrées une fois (A-03), et rien d'autre.

**Preuve.** `main.js:505-511` — quatre textes, un par rôle, entre 25 et
45 mots. C'est tout. Le produit possède pourtant **exactement le bon
motif** et ne l'offre qu'à un seul rôle : l'écran de première mise en
route (`index.js:157-173`) est une liste de cinq étapes ordonnées qui
**se cochent d'elles-mêmes** à mesure que la donnée arrive, chacune
menant à l'écran où elle s'accomplit. Ce motif est réservé à
l'administrateur, sur un livre vide, et disparaît dès qu'un projet
existe.

**Conséquence réelle.** Le chef de site n'a aucune manière de savoir
qu'il a fini d'apprendre. Personne ne peut lui dire non plus : son
responsable n'a aucun état d'avancement de sa prise en main, et le
service desk n'a pas de liste de contrôle à lui faire dérouler au
téléphone.

**Mesure de clôture.** Pour **chacun des quatre rôles**, une liste
ordonnée de premières tâches qui se coche seule sur la donnée réelle —
même motif que la mise en route, étendu — atteignable à tout moment
depuis l'aide. Test : **quatre listes sur quatre** existent, et un compte
neuf de chaque rôle atteint 100 % de sa liste sans assistance humaine.

---

### A-11 · Il n'existe aucun terrain d'apprentissage

**Constat.** On ne peut apprendre Meridian que sur des données de
démonstration entièrement fausses, ou sur le livre réel dont chaque
écriture est auditée. Il n'existe rien entre les deux.

**Preuve.** `npm run seed` installe un portefeuille fictif complet — une
banque, douze projets, huit sites, dix comptes — dont le `README`
signale lui-même les mots de passe comme un risque accepté (C-04).
`server/src/reset-book.js` fait l'inverse : il efface toute la
démonstration pour laisser le livre honnêtement vide. Aucun état
intermédiaire n'existe : pas de jeu d'apprentissage installable à côté du
réel, pas de périmètre d'exercice, pas de remise à zéro partielle.

**Conséquence réelle.** Le formateur qui prépare la session d'octobre à
Houndé ne peut ni faire manipuler le livre réel — chaque geste laisse une
ligne d'audit dans le registre de production, et la piste est en ajout
seul par conception — ni former sur un livre vide, où rien de ce qu'il
veut montrer n'existe. Il fera donc une démonstration au vidéoprojecteur,
et les huit personnes formées n'auront pas touché l'outil.

**Mesure de clôture.** Un jeu d'apprentissage **installable et effaçable
sans toucher au livre de production**. Test : une session de formation à
huit participants se déroule et se remet à zéro en **moins de dix
minutes**, avec **zéro ligne d'audit** ajoutée au livre réel — vérifié
par comptage sur `audit_event` avant et après.

---

### A-12 · Rien ne prépare ni ne désigne le référent local

**Constat.** Le comité indépendant avait déjà ouvert un siège
« conduite du changement » dont la question — « que faut-il apprendre
avant d'être utile ? » — n'a reçu de réponse dans aucune des quinze
réserves levées. Elle reste entière.

**Preuve.** Le modèle d'accès porte quatre rôles — `admin`, `group`,
`site`, `viewer` (`shared/rbac.js`) — et aucune notion de référent, de
correspondant ou de formateur. Aucun écran ne nomme la personne à qui
s'adresser sur place. La page d'aide se termine par une phrase générique
et non traduite : « Need access or a grant changed? Any account marked
ADMIN on the sign-in screen's directory can help » (`main.js:370-371`) —
qui renvoie huit sites vers l'administrateur du groupe.

**Conséquence réelle.** Le premier appel du surintendant de Houndé part
vers le service desk du groupe, à quatre fuseaux horaires, pour une
question de dix secondes que son voisin de bureau aurait su traiter. Le
service desk ouvrira un ticket, le fermera en expliquant, et n'aura rien
capitalisé. Multiplié par huit sites et par les six premières semaines,
c'est le coût dominant du déploiement — et il est invisible dans le
budget projet.

**Mesure de clôture.** Un référent est **nommé pour chacun des huit
sites**, la donnée est saisissable en administration, et l'aide affiche
le référent **du site du lecteur** avant de proposer le groupe. Cible :
**8 sites sur 8 renseignés au démarrage**, et **0 site sans référent**.
Indicateur d'accompagnement suivi par le service desk : part des tickets
« comment fait-on… » sur le total, **sous 30 % au troisième mois**.

---

## Ce que le comité juge déjà bon, et qui ne doit pas régresser

Le comité tient à distinguer ce qui manque de ce qui est mal fait. Rien
de ce qui suit n'est mal fait, et plusieurs de ces acquis sont exactement
les motifs sur lesquels les réserves ci-dessus demandent de s'appuyer.

| Acquis | Où il se vérifie |
|---|---|
| L'orientation par rôle existe, et elle est écrite dans la langue de son lecteur — quatre textes, un par rôle, tous au dictionnaire | `main.js:505-511` + `i18n.js` (5 clés vérifiées présentes) |
| La liste de mise en route **qui se coche seule** est le bon motif pédagogique, et il est déjà implémenté | `index.js:157-173` |
| Les refus qui apprennent existent : l'équipe sait les écrire, et elle les a traduits | « cette preuve vous appartient — un relecteur indépendant l'approuve », « ceci est un projet de site — ouvrez-y un élément RAID ordinaire » (`rbac.js`, `server/src/i18n.js:44-60`) |
| Le formulaire enseigne au moment de l'échec, et **garde la saisie** — y compris sur un conflit de version, où il explique ce qui s'est passé et quoi faire | `kit.js:353-395` |
| Le repli « Plus de détail » est un défaut du kit, pas une décision par écran : un formulaire nouveau naît replié | `advanced:` dans `form()`, `kit.js` |
| Les jalons portent, à l'écran, la preuve attendue et son responsable — le produit sait déjà enseigner une exigence de gouvernance au point d'usage | `index.js:3709-3714` ; table de référence en administration, `4276-4278` |
| Créer un projet livre un modèle complet — activités du référentiel de méthode, quatre jalons, un document de preuve par jalon, l'affectation du chef de projet — c'est-à-dire précisément ce qu'un débutant ne saurait pas construire | `server/src/wbs.js`, appelé en `routes/portfolio.js:161` |
| Le premier mot de passe s'impose sans échappatoire, et le dit : pas de croix, pas d'Échap, seule sortie « Se déconnecter » | `main.js:448-470` |
| Les états vides des surfaces de gouvernance nomment **qui** agit, pas seulement ce qui manque | `meetings.js:95`, `index.js:453, 511` — à traduire (A-04), pas à réécrire |

---

## Séquence de traitement recommandée

Quatre lots. L'ordre n'est pas celui de la gravité : il est celui qui
rend le lot suivant vérifiable.

**Lot 1 — rendre la pédagogie lisible et mesurable.** A-02, A-04, puis
A-08. Peu de code : brancher `t()` là où la traduction existe déjà,
étendre la porte de langue aux trois motifs pédagogiques, et poser la
mesure d'adoption. Ce lot ne crée presque aucun contenu ; il fait
apparaître ce qui est écrit et installe la ligne de base sans laquelle
les trois lots suivants ne seront qu'une conviction.

**Lot 2 — rendre l'apprentissage récupérable.** A-03, A-10, puis A-01.
L'orientation redevient atteignable à tout moment ; le motif de liste qui
se coche seule est étendu aux quatre rôles ; le manuel se construit
**dans** ce squelette plutôt qu'à côté. Écrit dans cet ordre, le manuel
n'est plus un document mais le contenu long des tâches déjà listées — ce
qui est aussi la seule manière connue de le maintenir.

**Lot 3 — enseigner au moment de la décision.** A-05, A-06, A-07. L'aide
au champ portée à 80 % des formulaires, le score de priorisation
explicable au point d'usage, les vingt-huit refus qui nomment une suite
et la préoccupation offerte là où l'utilisateur se cogne. C'est le lot
qui coûte le plus en rédaction et le moins en architecture.

**Lot 4 — ce qui déborde du produit.** A-09, A-11, A-12. Le protocole de
séance dans l'écran du comité, le terrain d'apprentissage, les référents
nommés site par site. Ce lot engage la conduite du changement autant que
l'équipe produit ; il ne doit pas commencer avant que le lot 2 ait donné
aux référents quelque chose à montrer.

## Verdict

Meridian est un instrument de gouvernance dont la recette est prononcée
et un produit dont personne n'a encore écrit le mode d'emploi : la
couche pédagogique n'est pas absente, elle est partielle, non traduite,
non réouvrable et non mesurée — et le produit démontre, sur presque
chaque point, qu'il sait faire ce qu'il ne fait qu'une fois. Le comité ne
s'oppose pas à la mise en service sur un site anglophone pilote, mais
**refuse le déploiement multi-sites francophone** tant que A-01 et A-02
ne sont pas levées : envoyer, en français, un chef de site vers une page
d'aide anglaise est une manière fiable de perdre un utilisateur qu'aucune
qualité d'ingénierie ne rattrape ensuite.

# Comité produit — charte, critères de valeur, carnet arbitré

Date : 30 août 2026 · Première séance. Le comité produit est constitué à
titre permanent et devient propriétaire du produit Meridian IT-PMO.

Six comités ont siégé avant celui-ci et ont bien travaillé : conception,
valeur ([`14`](14-endeavour-value-review.md)), indépendant
([`16`](16-comite-independant.md)), recette
([`18`](18-amdec-recette.md)), adoption ([`19`](19-comite-adoption.md)),
sécurité de l'information et GRC ([`20`](20-comite-infosec-grc.md)),
sécurité applicative ([`21`](21-campagne-securite.md)). Ils ont clos
beaucoup et laissé ouvert **trente constats** — sept d'adoption, dix-sept
de GRC, six de sécurité applicative — **et trois acceptations en attente
du mandant**, répartis dans six documents qui ne se citent pas les uns les
autres et ne se classent pas entre eux.

Ce comité n'ajoute pas un septième carnet. Il fait ce que personne n'a
fait : **il met les six sur la même table, les met dans un seul ordre, et
dit qui tranche quand ils se contredisent.**

---

## 1 · Charte

### 1.1 Mandat

Le comité produit décide **ce qui entre dans une version de Meridian, dans
quel ordre, et ce qui n'y entre pas**. Il est l'unique instance
d'arbitrage du carnet. À partir de ce jour, aucune ligne de travail
produit n'est engagée si elle n'est pas au carnet du §3, et aucune version
n'est prononcée si sa définition de terminé (§4) n'est pas tenue.

Il est constitué à durée indéterminée. Les comités précédents étaient des
instances d'examen : ils se réunissaient, jugeaient, se dissolvaient. Le
comité produit est une instance de **tenue** : sa valeur n'est pas dans sa
première séance, elle est dans la centième.

### 1.2 Ce que le comité décide

| Il décide | Cela veut dire |
|---|---|
| L'ordre du carnet | Une seule liste, un seul rang par ligne, révisée à chaque séance |
| Le contenu de R2, R3, R4 | Ce qui entre, ce qui glisse, et le motif écrit du glissement |
| La définition de terminé | §4 ; elle ne se négocie pas ligne par ligne |
| L'ouverture et la clôture d'une réserve | Une réserve n'est levée que par une écriture datée **dans son rapport d'origine**, jamais par un commit |
| Les refus | §5 ; un refus a un motif et une source, et il vaut jusqu'à ce que le comité le lève |
| L'entrée au carnet | Une demande qui ne nomme ni son siège demandeur ni ce qui se passe si on ne la fait pas n'entre pas |

### 1.3 Ce que le comité ne décide pas

**Ce qui appartient au mandant (sponsor).** Le comité l'inscrit, le date,
et dit ce qu'il en coûte de ne pas l'avoir — il ne le décide pas, ne le
contourne pas et ne le simule pas.

- Les secrets et les choix d'infrastructure : `MERIDIAN_SMTP_URL`,
  `MERIDIAN_OIDC_*`, les vrais `documentHosts`
  ([`18`](18-amdec-recette.md) §Acceptations), le mot de passe PostgreSQL
  réel (**S-11**), le certificat de signature de code (**S-16**).
- La création des comptes nominatifs des rôles réels (**S-13**) — sans
  laquelle la séparation des tâches reste théorique.
- Les onze constats GRC qui ne se codent pas
  ([`20`](20-comite-infosec-grc.md) §5) : G-01, G-02, G-04, G-05, G-06,
  G-07, G-09, G-12, G-14, G-15, G-16, et le volet organisation de G-13.
- La base légale, les durées de conservation, l'avis social pays par pays.
- L'enveloppe budgétaire du produit et l'affectation des personnes.

**Ce qui appartient à l'ingénierie.** Le comité fixe le *quoi* et le
*quand*. Il ne dit jamais le *comment*. Il ne rouvre ni le schéma, ni le
choix des bibliothèques, ni la découpe interne d'un lot, et il ne demande
jamais une solution nommée à la place d'un résultat mesurable.

**Ce qui est acquis.** Le comité s'interdit de rejuger ce que les six
rapports ont explicitement porté au crédit du produit : les quatre acquis
de [`18`](18-amdec-recette.md) §Les quatre acquis, les neuf acquis
d'adoption de [`19`](19-comite-adoption.md), les quatorze acquis de
[`20`](20-comite-infosec-grc.md) §2, et ce que
[`21`](21-campagne-securite.md) §Ce qui a été vérifié et jugé sain a
trouvé sain. Une demande qui reviendrait sur l'un d'eux est irrecevable.

### 1.4 Composition — huit sièges

Chaque siège est nommé par son métier, défend une chose et une seule, et
sait dire à l'avance ce qui l'empêcherait de voter oui.

| Siège | Ce qu'il défend | Ce qui l'empêche de voter oui |
|---|---|---|
| **Président — direction PMO groupe**, propriétaire de la donnée | Que le carnet reste unique, ordonné et tenu ; que l'outil reste utilisable par ceux qui doivent s'en servir | Une version dont la définition de terminé n'est pas tenue ; un carnet qui se dédouble |
| **Valeur et marché** (siège hérité d'Endeavour) | La thèse en trois conditions du §2.1 : un lot doit avancer l'une des trois ou fermer un bloquant | Un lot qui n'avance aucune des trois conditions et ne ferme aucun bloquant — « une fonction de plus » |
| **Assurance et recette** (siège hérité de l'AMDEC) | Les portes de recette : aucun RPN ≥ 100, aucun mode S ≥ 9 avec D ≥ 7 | Un lot qui rouvre un mode de défaillance clos sans re-notation datée |
| **Sécurité de l'information et GRC** | L'autorisation de porter des données réelles | Tout ordre du jour qui consomme du temps d'ingénierie avant G-01, G-02 et G-03 ; toute nouvelle donnée personnelle sans durée écrite |
| **Adoption et terrain** — référent de site francophone non informaticien | Le lecteur qui n'a personne à appeler | Une surface nouvelle livrée sans son aide au champ et sans sa traduction ; A-01 close par un fichier de plus dans `docs/` |
| **Exploitation** — celui qui reçoit l'alarme à trois heures du matin | Ce qu'on perd et en combien de temps on revient | Un lot qui ajoute un état à sauvegarder, un tiers ou une dépendance sans fiche de reprise à jour |
| **Finance et données personnelles** (contrôle de gestion + déléguée à la protection des données) | Que le chiffre publié soit reproductible et que la donnée collectée soit minimale | Une fonctionnalité qui collecte une donnée nouvelle sans finalité ni durée ; un chiffre qui bouge après clôture de période |
| **Ingénierie** | Les acquis gelés et l'effort réel | Rien, sur le contenu. Ce siège n'a pas de voix sur le *quoi* — il dispose d'un **veto de faisabilité chiffré**, jamais d'un veto de préférence |

Le siège adoption et le siège GRC sont des contrepoids délibérés et
opposés : l'un empêche d'alourdir l'outil jusqu'à l'abandon, l'autre
empêche de le mettre en service sans droit. Un comité qui n'aurait que le
premier livrerait un produit interdit ; un comité qui n'aurait que le
second livrerait un produit que personne n'ouvre.

### 1.5 Quorum

Cinq sièges sur huit, dont **obligatoirement** le président, le siège
sécurité et GRC, et le siège adoption. Aucun arbitrage n'est valide sans
le siège ingénierie présent pour chiffrer l'effort : un rang attribué sans
effort connu n'est pas un arbitrage, c'est un vœu.

### 1.6 Cadence

| Séance | Fréquence | Objet | Durée |
|---|---|---|---|
| **Arbitrage** | toutes les quatre semaines, **le jour de la clôture de période** | Réordonner le carnet, acter les clôtures, statuer sur les entrées nouvelles | 90 min |
| **Entrées bloquantes** | hebdomadaire | Uniquement ce qui prétend au rang 1 à 5 ; tout le reste attend la séance d'arbitrage | 20 min |
| **Porte de version** | à chaque jalon R2, R3, R4 | Prononcer ou refuser la version sur la définition de terminé | 60 min |

La séance d'arbitrage tient le jour de la clôture de période pour une
raison de fond : le comité lit alors des chiffres **gelés au sens de
V-02**, pas des chiffres recalculés le matin même. Une instance qui
arbitre sur des nombres qui bougent arbitre sur du sable.

### 1.7 Règle de départage

Quand les sièges ne s'accordent pas, dans cet ordre :

1. **Un bloquant de sécurité ou de conformité l'emporte sur tout le
   reste.** Le siège GRC dispose d'un veto **sur l'ordre**, pas sur le
   contenu : il peut imposer qu'une ligne passe devant, il ne peut pas
   imposer qu'une ligne existe.
2. **À gravité égale, ce qui rend le lot suivant vérifiable passe
   d'abord.** Règle reprise telle quelle de [`19`](19-comite-adoption.md)
   §Séquence — c'est elle qui met A-08 devant A-01 alors que A-01 est
   bloquante et A-08 ne l'est pas.
3. **Ensuite, les critères du §2.2, dans l'ordre.** La première
   différence tranche. Le comité ne discute pas le critère suivant tant
   que le précédent départage.
4. **Si les sièges restent partagés, le président tranche et écrit son
   motif au procès-verbal.** Le siège minoritaire fait inscrire sa
   réserve, nommée et datée ; elle est réexaminée de droit à la séance
   suivante, sans qu'il ait à la redemander.
5. **Le comité ne vote jamais sur ce qui appartient au mandant.** Il
   inscrit la décision attendue, sa date, et ce qui se passe sans elle
   (§6).

### 1.8 Ce qui arrive du comité d'innovation

Un comité d'innovation siège en ce moment
([`22-comite-innovation.md`](22-comite-innovation.md), en cours) sur
l'intelligence artificielle et le centre de notification. Le comité
produit **ne préjuge pas de ses conclusions** et n'en discute aucune ici.

Il pose seulement la manière dont il les arbitrera, pour que la question
soit réglée avant que le sujet n'arrive et n'ait pas à être négociée sous
l'enthousiasme :

- Chaque conclusion entre au carnet comme n'importe quelle demande, avec
  son siège demandeur et sa conséquence nommée (§1.2), à la **séance
  d'arbitrage qui suit son dépôt**.
- Elle est classée par les critères C1 à C6 du §2.2, sans exception et
  sans voie réservée.
- Le refus n° 6 du §5 s'y applique par avance : aucune donnée à caractère
  personnel nouvelle — et un centre de notification en manipule par
  construction — n'entre avant que la durée de conservation de sa
  catégorie ne soit écrite (G-13).
- Aucune conclusion d'innovation n'entre avant **R3 close**. Ce n'est pas
  de la méfiance : R3 est la version qui rend une nouveauté enseignable,
  et une nouveauté qu'on ne sait pas enseigner sur huit sites ne produit
  rien (A-01, A-10).

---

## 2 · La définition de la valeur

### 2.1 La thèse, et où elle en est

Le comité valeur ([`14`](14-endeavour-value-review.md)) a posé qu'un bon
outil interne devient un outil que le groupe ne peut plus abandonner à
trois conditions, et à trois seulement. Le comité produit reprend cette
thèse sans la modifier, et constate son état au 30/08/2026.

| Condition (docs/14) | État au 30/08/2026 | Ce qui manque |
|---|---|---|
| **1 · C'est le seul endroit où existe la piste de décision.** Renvois, décisions, comptes rendus, registre | **TENUE.** Elle l'était déjà et rien ne l'a fait régresser : portes CRUD+audit et versions vertes, restauration elle-même tracée | Rien à faire — tout à ne pas casser |
| **2 · Elle répond à « qu'a-t-on obtenu ».** V-01, clos par `008_benefits.sql` | **OUTILLÉE, NON PROUVÉE.** Le modèle existe — base, cible, responsable, date, mesure, et `attainment()` qui lit le mouvement voulu. Aucun bénéfice **réel** n'a jamais été mesuré : le livre de production est vide et un seul compte y est actif | Un premier bénéfice réel, porté par un responsable nommé, mesuré à sa date |
| **3 · C'est l'enregistrement de référence pour le conseil et l'auditeur.** V-02 périodes gelées + V-15 pack de preuves | **OUTILLÉE, NON OPPOSABLE.** Deux raisons, aucune n'est une fonctionnalité manquante : un enregistrement dont il n'existe **aucune sauvegarde éprouvée** (G-01) ne fait pas foi ; et un enregistrement produit, approuvé et clos par **un unique compte administrateur exempté de la séparation des tâches** (S-13) n'a jamais eu de second regard | G-01 et S-13 |

**Lecture du comité.** Les trois conditions sont outillées et deux ne sont
pas démontrées. Ce qui reste à faire n'est plus du travail de
fonctionnalité — c'est du travail de **mise en service**. C'est cette
lecture, et pas une autre, qui ordonne le carnet du §3 : les cinq
premières lignes ne livrent aucune fonction nouvelle.

### 2.2 Les six critères d'arbitrage

Un critère qui ne peut pas départager deux demandes n'est pas un critère.
Chacun de ceux-ci se répond par **oui/non ou par un nombre**, tiré d'une
source nommée, par quelqu'un d'autre que l'auteur de cette charte.

| | Critère | La question, telle qu'elle se pose en séance | Source de la réponse |
|---|---|---|---|
| **C1** | **Autorisation** | Sans cela, l'outil a-t-il le droit de porter des données réelles ? | [`20`](20-comite-infosec-grc.md) §7, colonne Gravité ; avis juridique |
| **C2** | **Preuve** | Sans cela, un chiffre affiché peut-il être défendu devant un auditeur ou un client ? | Reproductibilité (V-02), imputabilité (S-13), existence d'une sauvegarde (G-01) |
| **C3** | **Première utilisation** | Combien d'utilisateurs sont bloqués **à leur première tentative** ? | Comptages de [`19`](19-comite-adoption.md) §Méthode, refaits à chaque construction |
| **C4** | **Irréversibilité** | Reporter crée-t-il une dette qu'on ne pourra plus effacer ? | Piste en ajout seul (`audit_no_delete`) ; habitude prise sur un tableur |
| **C5** | **Portée × fréquence** | Combien de sièges, combien de fois par semaine ? | Modèle d'accès ([`04`](04-access-model.md)) × cadence des comités |
| **C6** | **Effort** | À égalité sur C1 à C5, le moins cher passe d'abord | Chiffrage du siège ingénierie, en jours |

**Application.** On compare deux demandes sur C1. Si elles diffèrent, c'est
tranché. Sinon on passe à C2, et ainsi de suite. Le comité s'interdit de
mélanger les critères en une note globale : une note globale est une
manière élégante de ne pas dire ce qui a pesé.

**Ce que ces critères rendent immédiatement.** C1 met les trois bloquants
GRC devant tout, y compris devant la seule réserve bloquante d'adoption
(A-01) : un manuel pour un outil qui n'a pas le droit de servir enseigne
un outil interdit. C3 met A-01 devant A-05, à effort supérieur : le manuel
manque à **tout** nouvel entrant sur huit sites, l'aide au champ manque
sur les deux tiers des formulaires mais chaque formulaire n'est rencontré
que par quelques personnes. C6 fait remonter les décisions du sponsor qui
coûtent un paragraphe et débloquent un contrôle entier.

---

## 3 · Le carnet arbitré

Tout ce qui reste ouvert dans les six rapports, plus quatre lignes que le
comité ajoute de son propre chef, **dans un seul ordre**.

Trente-huit lignes. Origine : `A-` adoption ([`19`](19-comite-adoption.md)),
`G-` GRC ([`20`](20-comite-infosec-grc.md)), `S-` sécurité applicative
([`21`](21-campagne-securite.md)), `ACC-` acceptations écrites
([`18`](18-amdec-recette.md)), `P-` ajouté par ce comité.

Effort : `½ j`, `1 j`, `3 j`, `1 sem`, `2 sem` d'ingénierie ; `orga` = à
écrire et signer, pas à coder ; `sponsor` = une décision, pas un travail.

| # | Origine | Ce que ça change, et pour qui | Critère qui la classe là | Effort |
|--:|---|---|---|---|
| 1 | **G-03** produit | Retire `sick` du vocabulaire, projette l'image d'audit au lieu de copier la ligne, restreint la lecture de la piste sur `person_absence`. Le motif médical d'une absence cesse d'être lisible à perpétuité par tout responsable de programme du groupe | **C1** puis **C4** — chaque jour d'exploitation écrit, dans une table indélébile, de la donnée d'article 9 qu'on ne pourra plus retirer | ½ j |
| 2 | **G-01** | Une sauvegarde et **un test de restauration daté et chronométré** sur un autre poste. Sans lui, le portefeuille *et* la preuve d'assurance vivent sur un seul disque | **C1** puis **C2** — la condition 3 de la thèse ne tient pas sans lui | 1 j exploitation + sponsor |
| 3 | **G-13** orga | Registre de traitement, base légale, durées par catégorie, note d'information aux personnes. Aujourd'hui chaque demande d'accès se traite dans l'urgence par quelqu'un qui improvise | **C1** | orga |
| 4 | **G-04** | Les quatre politiques : sécurité, classification, mot de passe, gestion des accès. Sans elles, **aucun des seize autres constats GRC n'a de propriétaire** — c'est le motif de leur vague 0, pas leur contenu | **C1** | orga |
| 5 | **G-02** | Fiche de reprise du poste, **exécutée une fois** et chronométrée. Le comité de pilotage groupe cesse de perdre sa source de décision pour une durée que personne ne sait annoncer | **C1** puis **C2** | 1 j |
| 6 | **G-14** | *Condition d'usage, pas une tâche.* Aucun site n'active la saisie du temps sans avis social et juridique de son pays au dossier | **C1**, conditionnel | orga, par pays |
| 7 | **ACC-3** `documentHosts` | Sans les vrais domaines GED, la liste est **vide, donc fermée** : aucune preuve de jalon n'est approuvable. Le contrôle qui fait la valeur du produit ne s'exerce sur rien | **C2** puis **C6** — dix minutes du sponsor débloquent l'acte central du produit | sponsor |
| 8 | **S-13** | Créer les comptes nominatifs des rôles réels. Aujourd'hui l'unique compte actif est administrateur, et l'administrateur est exempté de la séparation des tâches : **aucun contrôle d'indépendance ne s'applique à personne** | **C2** — condition 3 de la thèse | sponsor + ½ j |
| 9 | **S-11** | Un vrai mot de passe PostgreSQL. `postgres:postgres` est superutilisateur du cluster entier, pas seulement de cette base | **C2** puis **C6** | sponsor + ½ j |
| 10 | **A-08** | Six indicateurs d'adoption par site et par mois, ligne de base datée. Trois mois après la mise en service, la question « le déploiement a-t-il pris » cesse d'appeler une opinion | **C2** + règle de départage n° 2 — **sans ligne de base, on ne saura pas si les lots suivants ont servi** | 1 sem |
| 11 | **G-08** produit | Une ligne d'audit par échec de connexion, sans révéler l'existence du compte. Après incident, « depuis quand essaie-t-on d'entrer ? » a une réponse | **C2** | ½ j |
| 12 | **G-10** produit + orga | Commande « révoquer toutes les sessions », tracée ; et la fiche d'incident d'une page. Aujourd'hui le seul outil qui coupe tout **efface aussi le portefeuille** (`reset-book.js:71`) | **C2** puis **C4** | ½ j + 1 j orga |
| 13 | **G-11** + **P-03** | `npm audit --omit=dev` dans `verify`, délais de correction écrits (critique 7 j), décideur nommé — **et la commande `audit` renommée** : cinq sondes maison portant ce nom produisent une fausse assurance chez celui qui exploite | **C2** | ½ j + sponsor |
| 14 | **P-02** | `/api/health` expose un numéro de version rapprochable du dépôt. Aujourd'hui il renvoie `{ok, engine, at}` : **aucun constat ne peut être rattaché à un binaire** | **C2** — volet produit de G-12, isolé parce qu'il conditionne la traçabilité de tous les autres | 1 h |
| 15 | **P-01** | Clore proprement A-06 et A-07 : les deux derniers refus sans suite (`shared/rbac.js:404` et `:408` — « project is outside your authority », « no project in scope », les deux plus fréquents), **et la consignation datée dans [`19`](19-comite-adoption.md)**, qui n'a pas été faite alors que le code est livré (commit `638483c`) | **C3** + charte §1.2 — une correction livrée et non consignée n'est pas terminée | ½ j |
| 16 | **A-10** | Une liste ordonnée de premières tâches **qui se coche seule** pour chacun des quatre rôles. Le chef de site peut enfin savoir qu'il a fini d'apprendre, et son responsable aussi | **C3** + règle n° 2 — c'est le squelette dans lequel A-01 s'écrit | 1 sem |
| 17 | **A-01** | Le manuel **dans le produit**, par tâche, dans les deux langues. Réserve bloquante : le comité d'adoption refuse le déploiement multi-sites francophone tant qu'elle est ouverte | **C3** — tout nouvel entrant, à sa première tentative, sur huit sites | 2 sem |
| 18 | **P-04** | Une porte automatique qui **publie la couverture d'aide au champ à chaque construction**. Sans elle, A-05 régressera comme la couche pédagogique avant sa porte F5 — le compte a déjà glissé de 58 à 59 formulaires depuis le rapport | **C4** — posée **avant** A-05, sinon on mesure une fois | ½ j |
| 19 | **A-05** | Aide au champ sur 80 % des formulaires (22 sur 59 aujourd'hui) et **100 % des champs dont la valeur est lue par quelqu'un d'autre** — motif de refus, note de décision, mesure de bénéfice | **C3** | 1 sem |
| 20 | **G-13** produit | Purge programmée de `notification` (qui conserve sujet **et corps**) et de `timesheet`, avec un compteur consultable | **C4**, conditionné par la durée décidée en ligne 3 | 1 j |
| 21 | **S-14** | Stocker l'empreinte des jetons de session, pas le jeton. Une sauvegarde égarée cesse de livrer douze heures de sessions utilisables | **C2** — à traiter avec le chantier sauvegardes de la ligne 2, pas séparément | 1 j |
| 22 | **G-17** | Mention de confidentialité portée par les quatre exports. Un CSV sorti cesse d'être libre sans que son destinataire sache ce qu'il tient | **C2**, conditionné par la politique de classification (ligne 4) | ½ j |
| 23 | **A-09** | Le tableau des trois états de séance et la conduite de réunion **dans l'écran du comité**. Le président cesse de découvrir en séance qu'une occurrence close ne se corrige plus | **C3** × **C5** — tous les présidents, toutes les semaines | 3 j |
| 24 | **A-12** | Un référent nommé pour chacun des huit sites, saisissable en administration, affiché **avant** le groupe. Le premier appel cesse de partir à quatre fuseaux horaires pour une question de dix secondes | **C3** × **C5** — coût dominant et invisible des six premières semaines | 1 j + sponsor |
| 25 | **G-05** | Cycle de vie des accès : qui demande, qui approuve, départ répercuté sous 24 h ouvrées, et le rapprochement qui le vérifie. La mécanique existe déjà entièrement | **C2** | orga |
| 26 | **G-15** | Liste des secrets, dépositaire nommé, coffre, rotation annuelle et à chaque départ | **C2** | orga |
| 27 | **G-07** | Le compte de rupture sous pli scellé, dépositaire nommé, chaque emploi justifié sous 24 h. Toute la valeur de la piste repose sur l'imputabilité | **C2** | orga |
| 28 | **G-06** | Revue trimestrielle des habilitations et des comptes dormants, datée et signée. Les habilitations ne se réduisent jamais d'elles-mêmes | **C4** — la dette s'accumule en silence | orga, cadence |
| 29 | **G-09** | Durée de conservation **par catégorie**, lecteur désigné, puis export SIEM ou renonciation écrite et motivée du RSSI. « Infinie par construction » n'est pas une décision, c'est un effet de bord | **C2** | orga |
| 30 | **G-16** | Fiche de deux pages par tiers, **avant** branchement. Règle simple : pas de fiche, pas de branchement — donc cette ligne **conditionne** les deux suivantes | **C1** pour le branchement | orga |
| 31 | **ACC-1** SMTP | `MERIDIAN_SMTP_URL`. Rien ne part aujourd'hui : la file dit « en file d'attente » et le dit honnêtement. V-12 reste à 14, et A-08 mesurera une adoption qu'aucune relance ne soutient | **C5**, après la ligne 30 | sponsor |
| 32 | **ACC-2** Entra | `MERIDIAN_OIDC_*`. Le seam est construit et testé mais n'a jamais complété une connexion réelle : V-14 reste à 32, et c'est sa seule voie de descente | **C5**, après la ligne 30 | sponsor |
| 33 | **A-11** | Un terrain d'apprentissage installable et effaçable **sans toucher au livre de production**. Sinon le formateur fait une démonstration au vidéoprojecteur et les huit personnes formées n'ont pas touché l'outil | **C3** puis **C4** | 3 j |
| 34 | **S-17** | La suppléance de niveau groupe cesse d'animer la série d'un site hors de ses programmes. Défaut d'autorisation réel, borné à la lecture et à l'animation | **C2**, borné | 1 j |
| 35 | **S-15** | Compteur de connexion par identifiant seul **et** compteur global par adresse. Portée réelle limitée tant que l'écoute reste locale (S-08 fermé) | **C5**, borné | 1 j |
| 36 | **S-16** | Certificat de signature de code. Un administrateur cesse d'exécuter en LocalSystem un binaire dont Windows ne peut nommer aucun éditeur | **C2** — décision d'achat, pas une ligne de code | sponsor |
| 37 | **G-12** | Un commit par lot fonctionnel avec relecteur nommé. Le dépôt porte **quatre commits** pour la totalité du produit ; c'est le jour de la deuxième livraison que l'absence coûte | **C4** — dette croissante, dommage nul aujourd'hui | orga + discipline |
| 38 | **S-18** | Retirer la ligne `.npmrc` qui désactive la vérification TLS du registre, dès que l'AC du proxy est installée. Le verrou de dépendances protège l'existant ; le risque porte sur les ajouts | **C5** — le plus bas de la table, et assumé comme tel | 1 h |

### Relevé de clôture — 31/08/2026

La charte (§1.2) dit qu'une correction livrée et non consignée n'est pas
terminée ; la ligne 15 existe précisément parce que cela était arrivé. Le
relevé est donc tenu ici, à la source, et pas seulement dans le rapport
du lot ([`25`](25-reversibilite-et-la-porte-manquante.md)).

| Ligne | Origine | État au 31/08/2026 |
|--:|---|---|
| 11 | **G-08** | **fermée** — comptage journalier agrégé des échecs de connexion |
| 12 | **G-10** | **fermée** — route tracée, **et** le contrôle à l'écran (Administration → Continuité) |
| 13 | **G-11** + P-03 | **fermée** — `audit:deps` dans `verify` |
| 14 | **P-02** | **fermée** — la version dans `/api/health` |
| 15 | **P-01** | **fermée** — A-06 et A-07 consignées « LEVÉE le 30/08/2026 » dans [`19`](19-comite-adoption.md) |
| 10, 16–19, 23, 24, 33 | A-08, A-10, A-01, P-04, A-05, A-09, A-12, A-11 | **fermées** — lot d'adoption |
| 20 | **G-13** produit | **fermée** — purge programmée et compteur consultable |
| 21 | **S-14** | **fermée** — empreinte du jeton, migration 023 |
| 22 | **G-17** | **fermée** — mention de confidentialité portée par les exports |
| 34 | **S-17** | **fermée** — le périmètre de série est réellement rétréci |
| 35 | **S-15** | **fermée** — trois compteurs, et C-06 enfin tenu par des tests |
| — | **M-01**, ajoutée par [`24`](24-comite-marche.md) | **fermée** — archive du livre et de la piste, `npm run restore` |
| — | **F7** et **F8**, constatées au passage | **fermées** — l'administration ne se dessinait pas depuis la première livraison |

**Ce qui reste, et ce qui le bloque.** Tout le reste — lignes 1 à 9 hors
celles ci-dessus, 25 à 32, 36, 37, 38 — n'attend pas d'ingénierie. Onze
lignes ne se codent pas du tout, sept veulent une décision du sponsor,
une (**S-18**) veut que l'AC du proxy soit installée, et le déploiement
du binaire corrigé veut une élévation UAC — c'est-à-dire quelqu'un devant
la machine.

Le comité avait écrit au §3 : *« une équipe d'ingénierie qui travaillerait
à plein temps sur ce carnet serait à l'arrêt au bout de deux semaines,
faute de décisions »*. Elle l'est au bout d'une nuit.

### Ce que ce classement dit, et qu'aucun des six rapports ne pouvait dire

- **Les cinq premières lignes ne livrent aucune fonction.** Trois sont des
  documents, une est une demi-journée de code, une est un exercice
  chronométré. Le produit n'est pas court de fonctions — seize constats de
  valeur ont été clos en une campagne — il est court d'**autorisation**.
- **Onze lignes sur trente-huit ne se codent pas du tout**, et sept
  n'attendent qu'une décision du sponsor. Une équipe d'ingénierie qui
  travaillerait à plein temps sur ce carnet serait à l'arrêt au bout de
  deux semaines, faute de décisions.
- **Le seul bloquant d'adoption (A-01) est au rang 17.** C'est un
  arbitrage, pas un oubli : C1 passe avant C3, et A-08 puis A-10 passent
  devant par la règle de départage n° 2. Le comité assume que le
  déploiement multi-sites francophone reste refusé jusque-là (§5, refus
  n° 5).
- **Le carnet contient sa propre défaillance.** La ligne 15 existe parce
  que deux réserves ont été corrigées dans le code et jamais consignées
  dans leur rapport. C'est exactement ce qu'un comité de tenue est là pour
  attraper, et c'est arrivé en moins de vingt-quatre heures.

---

## 4 · Jalons de version et définition de terminé

### 4.1 R2 — « autorisée à porter du réel »

**Contenu.** Lignes 1 à 15 du carnet.

**Ce qui la conditionne.** Quatre décisions du sponsor : `documentHosts`
(7), comptes nominatifs (8), mot de passe PostgreSQL (9), et RTO/RPO
signés (2). Sans elles, R2 ne peut pas être prononcée quelle que soit la
qualité du travail d'ingénierie.

**Ce qu'elle vaut.** Le comité GRC s'est déclaré prêt à prononcer
l'autorisation **sur constat, sans nouvelle séance**. R2 est donc la
version qui transforme un refus en autorisation, et la condition 3 de la
thèse en fait démontrable.

### 4.2 R3 — « apprenable sans personne »

**Contenu.** Lignes 16 à 24.

**Ce qui la conditionne.** R2 close — on n'enseigne pas un outil qui n'a
pas le droit de servir — et la ligne de base d'adoption de la ligne 10
**datée**, sans quoi R3 ne sera qu'une conviction.

**Ce qu'elle vaut.** Elle lève l'opposition du comité d'adoption au
déploiement multi-sites francophone. C'est la version qui rend les huit
sites atteignables.

### 4.3 R4 — « tenable dans la durée »

**Contenu.** Lignes 25 à 38, plus les conclusions du comité d'innovation
arbitrées selon §1.8.

**Ce qui la conditionne.** R3 close. La plupart de R4 est de la cadence
d'organisation, pas de la livraison : revue trimestrielle, rotation des
secrets, fiches tiers. Le rôle du comité y change de nature — il ne
livre plus, il vérifie que ce qui a été décidé continue d'être fait.

### 4.4 Définition de terminé

Elle existe déjà en pratique dans ce projet. Elle n'avait jamais été
écrite. **Une ligne du carnet est terminée quand les six énoncés
suivants sont vrais — pas cinq.**

1. **`npm test` est vert**, et le nouveau comportement porte son test. Le
   compte ne baisse jamais. *(À noter : le `README.md` annonce 271 tests
   et le dépôt en porte davantage — le chiffre affiché n'est plus le
   chiffre réel, et cela se corrige avec la ligne 14.)*
2. **`npm run audit` est vert** — les cinq portes : routes, CRUD+audit,
   versions, contrôles, langue. Une porte nouvelle s'ajoute quand une
   réserve exige une non-régression mesurable (précédent : F5 étendue
   pour A-04).
3. **`npm run sweep` est propre sur instance fraîche** — 286 cas d'usage
   × 4 rôles + 72 rendus de vue : **0 erreur 5xx, 0 écart réel**, et
   aucune commande d'écriture offerte à un lecteur.
4. **Mesuré au navigateur par un humain, sur le parcours réel.** Non
   négociable : les trois défauts les plus coûteux de ce projet — la vue
   qui ne se rafraîchit pas après une sauvegarde, `selectField` aux
   arguments inversés, `icon("refresh")` qui blanchit un écran entier —
   ont traversé **tous** les tests et **toutes** les portes. Seul le clic
   les a trouvés.
5. **La mesure de clôture écrite dans le rapport d'origine est produite
   avec son chiffre**, pas décrite. « 0 chaîne pédagogique nue »,
   « 3/3 par rôle », « `count(*)` → 0 » : le chiffre, ou rien.
6. **Le rapport d'origine est mis à jour, daté, et la ligne marquée
   levée.** Une correction livrée et non consignée n'est pas terminée.
   Précédent immédiat : A-06 et A-07, corrigés au commit `638483c`, non
   consignés dans [`19`](19-comite-adoption.md) — d'où la ligne 15 du
   carnet.

**Pour une version**, s'ajoutent deux conditions : les modes de
défaillance touchés sont **re-notés** et les portes de recette tiennent
(aucun RPN ≥ 100, aucun S ≥ 9 avec D ≥ 7) ; et le numéro de version rendu
par `/api/health` se rapproche du dépôt.

---

## 5 · Ce que le comité refuse dès aujourd'hui

Une porte n'existe que si quelque chose s'y arrête. Six refus, chacun avec
son motif et sa source. Ils valent jusqu'à ce que le comité les lève
explicitement, en séance et au procès-verbal.

**1 · Toute fonction nouvelle de portefeuille avant R2 close.**
*Motif :* le produit n'est pas court de fonctions — [`14`](14-endeavour-value-review.md)
a clos seize constats de valeur en une campagne — il est court
d'autorisation. Sont visés nommément : le nivellement de ressources,
l'approfondissement du CPM, et le diagramme de réseau des dépendances
(que [`14`](14-endeavour-value-review.md) a déjà écarté : « il se
lirait moins bien qu'un tableau à onze projets »). *Réponse type :* la
fonction ne manque pas, la permission de s'en servir manque.

**2 · Rattraper Planview et Primavera.**
*Motif :* [`14`](14-endeavour-value-review.md) §benchmark, mot pour mot —
Meridian ne surpassera jamais Planview en fonctions ni Primavera en
ordonnancement, et doit cesser d'essayer. Toute demande dont la
justification est « le concurrent le fait » est **irrecevable** tant
qu'elle ne nomme pas un siège demandeur et une conséquence.

**3 · Une route applicative d'effacement de la piste d'audit.**
*Motif :* [`20`](20-comite-infosec-grc.md) §6 point 4. L'effacement RGPD
se traite par pseudonymisation, hors application, à double signature
administrateur + déléguée à la protection des données, consignée dans un
registre tenu ailleurs. On ne donne pas à l'application le pouvoir de
réécrire sa propre histoire. **Refusé définitivement, pas reporté** — et
c'est ce refus qui permet de continuer à affirmer que la piste est
inviolable par l'application.

**4 · A-01 close par un fichier Markdown de plus dans `docs/`.**
*Motif :* [`19`](19-comite-adoption.md) A-01, mot pour mot — il ne serait
pas plus lu que les dix-neuf autres. Le comité refuse par avance toute
livraison d'A-01 qui ne vive pas **dans** le produit et ne se mesure pas
sur trois personnes par rôle.

**5 · La mise en service multi-sites francophone tant qu'A-01 est
ouverte.** *Motif :* le comité fait sienne l'opposition d'adoption.
Envoyer en français un chef de site vers une aide qui ne lui répond pas
perd l'utilisateur définitivement. **Un pilote anglophone sur un site
reste autorisé — après R2, pas avant.**

**6 · Toute donnée à caractère personnel nouvelle avant que la durée de
conservation de sa catégorie ne soit écrite.** *Motif :* G-13, et le fait
que la piste est indélébile — ce qui entre aujourd'hui n'en sortira pas.
S'applique sans exception, y compris aux propositions du comité
d'innovation (§1.8).

---

## 6 · Décisions attendues du sponsor

Dix décisions. Aucune ne demande du travail : elles demandent un choix, une
signature ou un achat. Sept d'entre elles bloquent des lignes du carnet
qui, elles, sont prêtes.

| # | Décision | Date attendue | Ce qu'elle débloque | S'il n'y a pas de décision |
|--:|---|---|---|---|
| 1 | **Créer les comptes nominatifs** des rôles réels et cesser de gouverner depuis le compte d'administration (**S-13**) | **06/09/2026** | La séparation des tâches devient vraie ; condition 3 de la thèse ; carnet ligne 8 | Aucune preuve produite dans l'outil n'est indépendante. **R2 ne peut pas être prononcée** |
| 2 | **Les vrais domaines GED** dans `documentHosts` (**ACC-3**) | **06/09/2026** | Toute approbation de preuve de jalon ; carnet ligne 7 | Le produit reste fermé par défaut : le contrôle qui fait sa valeur ne s'exerce sur rien |
| 3 | **Un vrai mot de passe PostgreSQL** et la configuration du service à jour (**S-11**) | **06/09/2026** | Carnet ligne 9 | L'installation reste sur `postgres:postgres`, superutilisateur du cluster entier |
| 4 | **RTO et RPO chiffrés et signés** (**G-01**) | **13/09/2026** | Le test de restauration, donc l'autorisation GRC ; carnet ligne 2 | G-01 reste ouvert. **L'autorisation de porter du réel reste refusée** |
| 5 | **Les quatre politiques approuvées nommément** (**G-04**) | **30/09/2026** | Un propriétaire pour chacun des seize autres constats GRC ; la classification dont dépend la ligne 22 | Le premier questionnaire de sécurité d'un client minier reste sans réponse, quelle que soit la qualité du produit |
| 6 | **Base légale et durée de conservation de la piste** (**G-13**) — sept ans est l'ordre de grandeur recommandé, le sponsor tranche | **30/09/2026** | La purge programmée (ligne 20) ; les demandes d'effacement deviennent traitables | La rétention reste « infinie par construction », ce qui n'est pas une décision |
| 7 | **Avis social et juridique par pays** sur le suivi individuel du temps (**G-14**) | **avant activation, site par site** | L'usage des feuilles de temps sur les sites concernés | Aucun site n'active la saisie. Le module reste en place et inutilisé — ou un déploiement est suspendu après coup, sur un motif qui n'est pas technique |
| 8 | **Fiches tiers SMTP et Entra ID** (**G-16**) — deux pages chacune | **15/10/2026** | Le droit de brancher les deux tiers ; carnet ligne 30 | Pas de fiche, pas de branchement : les décisions 9 et 10 restent sans objet |
| 9 | **Relais SMTP** `MERIDIAN_SMTP_URL` (**ACC-1**) | **31/10/2026**, après la décision 8 | La livraison du digest et des relances ; V-12 descend de 14 | Rien ne part. La file dit « en file d'attente » et le dit honnêtement — mais A-08 mesurera une adoption qu'aucune relance ne soutient |
| 10 | **Locataire Entra ID** `MERIDIAN_OIDC_*` (**ACC-2**) — et **certificat de signature de code** (**S-16**), décision d'achat | **31/10/2026** | La première connexion SSO réelle, seule voie de descente de V-14 (32) ; un éditeur nommable pour le binaire | Les comptes locaux tiennent l'intérim sans MFA ni déprovisionnement piloté. Le binaire reste non signé — à assumer **par écrit** si la décision est de ne pas acheter |

Les décisions 1 à 4 sont sur le chemin critique de R2. Le comité les
reprendra à sa séance d'arbitrage du **27/09/2026** et, si l'une manque,
inscrira au procès-verbal le report de R2 avec son motif — sans le
compenser par de la fonctionnalité.

---

## Verdict

Meridian est un instrument dont la recette est prononcée, dont seize
constats de valeur sont clos, dont quinze réserves d'indépendance sont
levées, dont onze défauts de sécurité sont corrigés — et qui **n'a pas le
droit de porter une seule donnée réelle**, pour trois motifs dont deux ne
sont pas du logiciel.

Ce n'est pas un échec de construction. C'est le moment précis où un projet
cesse d'avoir besoin d'un comité qui juge et commence à avoir besoin d'un
comité qui tient. Les six carnets étaient bons et se contredisaient sur
l'ordre ; il y en a maintenant un seul, et il commence par une
demi-journée de code, trois documents à signer et un exercice chronométré.

Le comité produit se réunit à cadence de quatre semaines à partir du
**27/09/2026**, et son premier ordre du jour est de constater les lignes 1
à 5, ou de dire pourquoi elles ne sont pas faites.

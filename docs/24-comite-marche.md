# Comité de marché — Meridian IT-PMO vaut-il d'être acheté, et par qui ?

Date : 30 août 2026. Huitième comité, et le premier qui n'a aucun intérêt
à ce que ce produit existe.

Les sept précédents ont regardé Meridian **de l'intérieur** : est-il
correct ([`06`](06-amdec-uat.md), [`18`](18-amdec-recette.md)), est-il
sûr ([`20`](20-comite-infosec-grc.md), [`21`](21-campagne-securite.md)),
est-il utilisable ([`19`](19-comite-adoption.md)), est-il gouvernable
([`16`](16-comite-independant.md), [`23`](23-comite-produit.md)). Chacun
a demandé au produit de mieux faire ce qu'il fait.

Ce comité pose une question qu'aucun d'eux n'a posée : **quelqu'un
achèterait-il ceci, à quel prix, contre quoi, et que se passe-t-il si
personne ne l'achète.** Il ne demande aucune fonction. Il ne lève aucune
réserve. Il ne prend pas de décision d'ingénierie. Il rend un avis de
marché, et il commence par constater que la moitié de ce qu'un acheteur
évalue **n'existe dans aucun des vingt-trois documents précédents**.

---

## 1 · Composition — huit sièges

Chacun dit ce qu'il vient vérifier. Aucun ne vient vérifier la qualité du
code : cinq comités l'ont déjà fait, mieux que celui-ci ne le ferait.

| Siège | Ce qu'il vient vérifier |
|---|---|
| **Analyste du secteur PPM** — couverture EPPM / SPM / work management | « Dans quelle case ce produit tombe-t-il, et cette case a-t-elle des acheteurs ? » |
| **DSI d'un groupe aurifère mid-cap** — trois mines, huit sites, ~200 utilisateurs potentiels (le client type) | « Qu'est-ce que je remplace, et qui répond quand ça tombe un dimanche ? » |
| **Intégrateur** — déploiements PPM en milieu minier, Afrique de l'Ouest | « Combien de jours pour mettre un site dessus, et sur quoi je m'appuie quand je forme ? » |
| **Responsable des achats logiciels et du risque tiers** | « Puis-je acheter ceci ? À qui ? Sous quel contrat ? Que répond le questionnaire fournisseur ? » |
| **Concurrent déclaré** — directeur commercial d'un revendeur Planview / Smartsheet, invité pour perdre | « Comment je fais perdre cet appel d'offres ? » |
| **Contrôleur de gestion** — coût de possession et risque d'homme-clé | « Que coûte ceci sur cinq ans, et à qui appartient le risque ? » |
| **Client de référence potentiel** — directeur PMO d'un second groupe minier | « À quelle condition j'accepte qu'on me cite ? » |
| **Responsable support et exploitation** — celui qui devrait tenir le contrat | « Sur quelle version, avec quel engagement, et qui prend l'appel ? » |

Le siège du concurrent est délibéré. Un comité de marché qui ne fait pas
parler celui qui gagne l'affaire écrit une brochure, pas un avis.

---

## 2 · Ce que le comité a constaté avant de juger

Aucun chiffre de cette section n'est une impression. Tout a été exécuté ou
lu sur l'arbre du 30/08/2026.

| Constat | Mesure | Source |
|---|---|---|
| Tests | **315 tests, 38 suites, 0 échec, 47,7 s** | `npm test`, exécuté |
| Portes d'audit | **6 vertes** : routes, CRUD+audit, versions, contrôles, langue (F5), aide au champ (F6) | `npm run audit`, exécuté |
| Couverture d'aide au champ | **49 / 56 formulaires (88 %)**, cible 80 % ; **17 / 17 champs lus par un tiers (100 %)** | sortie F6 |
| Dépendances vulnérables | **0** (`--omit=dev`, seuil *high*) | `npm run audit:deps`, exécuté |
| Migrations | **22** (`001_core` → `022`) | `server/migrations/` |
| Écrans | **20**, en cinq intentions | `web/src/main.js:29-48` |
| Routes HTTP | **144** | comptage sur `server/src/routes/*.js` |
| Spécification d'API publiée | **0** — aucun OpenAPI, aucun Swagger | grep sur le dépôt |
| Client construit | **371 Ko brut / 115,8 Ko gzip** (+ 6,3 Ko CSS) | `npm run build`, exécuté |
| Dictionnaire français | **829 clés client + 62 serveur** | `web/src/lib/i18n.js`, `server/src/i18n.js` |
| Installateur | **`dist/MeridianSetup.exe`, 34,5 Mo**, daté du 30/08 | `dist/` |
| Dépôt | **16 commits, un seul auteur** | `git log` |
| Fichier de licence | **aucun** — ni `LICENSE`, ni `SECURITY.md`, ni `CONTRIBUTING` | racine du dépôt |
| Multi-location | **aucune** — pas de colonne locataire dans les 22 migrations | `server/migrations/` |
| Sauvegarde | **aucune** — `pg_dump` n'apparaît nulle part | `scripts/`, `dist/Meridian/` |
| Usage réel | **0** — livre de production vide, un compte actif, 8 sites sur 8 muets | [`19`](19-comite-adoption.md) A-08, [`23`](23-comite-produit.md) §2.1 |

Ces deux dernières lignes gouvernent tout le reste de ce rapport.

---

## 3 · Le benchmark rejoué

[`14`](14-endeavour-value-review.md) §« The benchmark » a été écrit le
29/08, **avant** les campagnes. Six colonnes y étaient marquées
« behind — gap ». Le comité reprend le tableau ligne par ligne et donne la
position au 30/08, avec sa preuve.

Trois notations, comme dans l'original : **en avance** / **à parité** /
**en retard**. Deux ajouts de ce comité, parce que l'original ne pouvait
pas les faire : **outillé, non prouvé** — la fonction existe et aucun
usage réel ne l'a exercée — et **produit ≠ exploitation**, quand le
logiciel tient sa promesse et que le déploiement ne la tient pas.

| Capacité | Position 29/08 | Position 30/08 | Preuve |
|---|---|---|---|
| Gouvernance groupe ↔ site comme donnée | en avance | **en avance, inchangée** | `shared/rbac.js` (454 l.), 25 tests `rbac`, balayage 286 cas × 4 rôles |
| Rythme de comité, ordre du jour généré, comptes rendus, renvois | en avance — unique | **en avance, inchangée** | `shared/meetings.js` (514 l.), 22 tests `meetings` |
| Séparation des tâches dans le jalon | en avance | **en avance en conception, nulle en exploitation** | La règle tient (`preuve.test.js:75`, S-06 corrigé) ; mais l'administrateur en est exempté et **le seul compte actif est administrateur** (S-13). Aucun contrôle d'indépendance ne s'applique aujourd'hui à personne |
| Piste en ajout seul avec images avant/après | en avance | **en avance, renforcée** | `RULE audit_no_update` / `audit_no_delete` (001) ; portes CRUD+audit et versions vertes ; la donnée de santé est sortie du schéma (017, G-03) |
| Jalons avec preuve | à parité | **en avance** | Empreinte SHA-256 figée à l'approbation (014), lignée `supersedes`, **et une sonde horaire qui revérifie qu'un lien approuvé répond encore** (020, `probe.test.js`, 8 tests). Aucun concurrent du tableau ne fait le troisième point. *Réserve* : `documentHosts` vide par défaut ⇒ aucune approbation possible tant que le mandant n'a pas répondu (ACC-3) |
| EVM (SPI/CPI/EAC) | à parité | **à parité, avec des simplifications à dire** | PV linéaire sur la baseline ; **EAC = BAC/CPI, formule unique** ; **ETC jamais calculé** ; indices **forcés à 1** sous 2 % d'avancement (`shared/engine.js:121-129`) ; avancement = un pourcentage déclaratif, sans 0/50/100 ni mesure physique |
| Profondeur de planification (CPM, nivellement, calendriers) | en retard | **en retard, et refusée** | CPM avant/arrière réel (`engine.js:179-201`) mais **liens FS uniquement** (`002_portfolio.sql:64`), **aucun lag**, **aucune contrainte de date**, **jours calendaires** — `workdays()` existe et **n'est jamais appelée**. Aucun nivellement. [`23`](23-comite-produit.md) §5 refus n° 1 les nomme et les refuse |
| **Bénéfices et réalisation de valeur** | **en retard — écart** | **à parité, outillé non prouvé** | `008_benefits.sql` : type, base, cible, mesure, responsable, date, verdict PIR ; `attainment()` lit la fraction du *mouvement* voulu ; 7 tests, dont la séparation mesure / verdict. **Aucun bénéfice réel n'a jamais été mesuré** |
| **Roadmap de portefeuille** | **en retard — écart** | **à parité** | `web/src/views/index.js:2323-2422` : huit trimestres, couloirs par programme, barre colorée par le RAG, jalons de gouvernance **et** jalons intrusifs marqués. *Réserve* : **aucun test ne couvre cette vue** |
| **Priorisation, scénarios, enveloppe** | **en retard — écart** | **partiellement comblée** | Quatre notes 1-5, score, rang manuel, cumul courant et ligne de flottaison contre `capexEnvelope` (`engine.js:445-473`, `pipeline.test.js`). **Aucune simulation what-if** : 0 occurrence de `scenario`, `defer`, `accelerate` dans tout le dépôt. Le mot « scénarios » du benchmark reste non tenu |
| Intake de la demande | en retard | **à parité** | Table `demand`, statuts New→Converted, refus motivé obligatoire, conversion en projet conservant le fil ; 5 tests, dont « un chef de site ne décide pas sa propre demande » |
| Profondeur de la gestion des ressources | en retard | **en retard, moins loin** | Rotation, disponibilité, salarié/prestataire, fournisseur, effort capitalisé (012) ; feuilles de temps (016). Mais `effectiveFte()` **n'est pas branché sur `capacity()`** : la charge ignore la disponibilité et les absences |
| Profondeur financière (capex/opex, FX, engagements) | en retard | **partiellement comblée** | Capex/opex sur les lignes **et** les engagements, devise et taux figés à la ligne, table `commitment` amendable, `moneyPosition()` (012, `money.test.js`). **Absent** : prévision de fin par période, référentiel de change, rate card |
| **Notifications et rappels** | **en retard — écart** | **produit ≠ exploitation** | Construit : centre in-app (018), abonnements (019), escalade, purge, **ordonnanceur horaire sous verrou consultatif** (`server/src/index.js:278-295`), 9 tests `centre`. **Non tenu** : `deliver()` **n'est appelé nulle part hors des tests** — rien ne part jamais, quelle que soit la configuration ; `MERIDIAN_SMTP_URL` n'existe que comme étiquette d'affichage (`admin.js:254`) ; la table `notification_subscription` **n'est jamais lue** ; le genre `digest` est déclaré et jamais émis |
| Écosystème d'intégrations | en retard (SDP seul) | **en retard, sans mouvement** | Une intégration, propriétaire (SDP, contrats C1–C6), **inerte par défaut** ; 144 routes et **aucun OpenAPI** ; **aucun connecteur** Jira, MS Project ou Excel ; pas de webhook émetteur (`notifyHosts` est un réglage sans code d'émission) ; import CSV **en création seulement**, sur trois objets |
| Mobile / hors ligne / faible bande passante | en retard | **en retard sur le mobile, en avance sur la bande passante** | **122 Ko gzip pour l'application entière** — un ordre de grandeur sous n'importe quel concurrent du tableau, et c'est l'argument VSAT. Cibles tactiles ≥ 24 px tenues (R-05). Hors ligne en lecture seule construit (`web/public/sw.js` + instantané), 6 tests — mais **l'effet de l'agent de service n'a jamais été observé**, l'aveu est dans le test lui-même. Trois points de rupture, un seul bundle, aucune application native |
| EN/FR au vocabulaire du groupe | en avance *quand complet* | **en avance, et prouvée par une porte** | 829 clés client, 62 serveur, notification composée dans la langue du destinataire, **la construction échoue si un libellé repart en anglais** (F5). Aucun éditeur du tableau ne fait échouer sa build sur une traduction manquante. *Réserve honnête* : **les exports ne sont pas traduits** — colonnes et bandeau de classification en anglais dur (`portfolio.js:2514, 2531`) |
| Adéquation à *ce* modèle opératoire | en avance — c'est le modèle | **en avance, et c'est aussi le plafond** | Voir §4 : ce qui rend le produit imbattable chez Endeavour est exactement ce qui le rend difficile à vendre ailleurs |
| Coût de licence à ~200 utilisateurs | en avance — nul | **en avance, désormais chiffrée** | Voir §5 |
| Délai jusqu'au premier comité gouverné | en avance — des jours | **contestée** | L'outil s'installe en une heure. Mais [`20`](20-comite-infosec-grc.md) §9 refuse l'autorisation de porter du réel, et [`23`](23-comite-produit.md) §6 date à quatre décisions du mandant l'ouverture de R2. **Des jours pour le logiciel, des semaines à des mois pour la permission de s'en servir** |

### Les six lignes qui ont bougé, sans complaisance

Quatre des six colonnes « behind — gap » sont réellement comblées :
**bénéfices**, **roadmap**, **intake** et **priorisation** (à l'exception
des scénarios). Une cinquième, **la profondeur financière**, l'est aux
deux tiers. La sixième, **les notifications**, est le cas le plus
intéressant du rapport : le produit a construit plus que le benchmark ne
demandait — un centre, des abonnements, une escalade, un ordonnanceur — et
**n'envoie rien du tout**. Le comité ne l'appelle pas « comblée ». Il
l'appelle *produit ≠ exploitation*, et c'est une catégorie qui va revenir.

### Ce que le tableau d'origine ne pouvait pas voir

Six lignes que ce comité ajoute. Elles ne portent pas sur le logiciel :
elles portent sur ce qu'un acheteur évalue avant d'ouvrir le logiciel.

| Capacité | Concurrents | **Meridian** | Preuve |
|---|---|---|---|
| **Un éditeur** — entité juridique, licence, propriétaire nommé | oui | **absent** | Aucun `LICENSE` dans le dépôt |
| **Contrat de support, engagement de rétablissement, astreinte** | oui | **absent** | Aucun document ne fixe un délai de réponse ; le siège support n'a rien à lire |
| **Réponse à un questionnaire de sécurité fournisseur** | oui | **absent** | Les quatre politiques (G-04) ne sont pas écrites. [`23`](23-comite-produit.md) ligne 440 le dit déjà : « le premier questionnaire de sécurité d'un client minier reste sans réponse, quelle que soit la qualité du produit » |
| **Chaîne d'approvisionnement vérifiable** | oui | **en retard** | Binaire **non signé** — Windows ne peut nommer aucun éditeur pour un exécutable lancé en LocalSystem (S-16) ; `.npmrc` désactive encore la vérification TLS du registre (S-18) |
| **Références clients, cas d'usage publiés** | oui | **zéro** | Le livre de production est vide et les 8 sites sont muets |
| **Sauvegarde et restauration éprouvées** | oui | **absent** | `pg_dump` n'apparaît nulle part ; G-01 est encore ouvert. Le livre **et** la piste vivent sur un seul disque |

Le comité insiste sur la nature de cette seconde table. **Aucune de ces
six lignes ne se corrige par du logiciel.** Cinq d'entre elles se
corrigent par une signature ou un achat. C'est exactement le diagnostic
que [`23`](23-comite-produit.md) rend en interne — « le produit n'est pas
court de fonctions, il est court d'autorisation » — et ce comité constate
qu'il vaut aussi, mot pour mot, à l'extérieur.

---

## 4 · Le positionnement

### Sur quel segment ce produit gagne

**Un groupe industriel multi-sites, 5 à 20 sites, 500 à 5 000 personnes,
dont la DSI porte 10 à 40 projets par an, et dont le problème n'est pas
l'ordonnancement mais la tenue du rythme de décision entre le groupe et
le site** — en deux langues, sur des liaisons contraintes, avec une
exigence de preuve d'audit qu'un tableur ne tient pas.

Miniers, cimentiers, agro-industriels, ports, opérateurs d'eau et
d'électricité en pays émergents. Le trait commun n'est pas le secteur :
c'est la géométrie. Un centre qui décide et des sites qui exécutent, une
liaison satellite entre les deux, et un auditeur qui arrive une fois par
an.

Dans ce segment, Meridian tient trois choses qu'aucun produit du tableau
ne tient ensemble : le renvoi site → groupe modélisé comme donnée,
l'ordre du jour qui se construit seul depuis l'état du portefeuille, et
122 Ko gzip qui se chargent sur un lien dégradé.

### Sur quels segments il ne faut même pas concourir

- **Tout appel d'offres où un carré d'analyste est exigé.** Aucune
  couverture, aucun éditeur. La grille se remplit avec des « non ».
- **Projets d'ingénierie et d'investissement où le planning est le
  livrable.** Liens FS uniquement, pas de lag, pas de calendriers, pas de
  nivellement. Primavera gagne, et il le doit.
- **Gestion de travail collaborative généraliste.** Smartsheet et Monday
  font mieux, moins cher, et Meridian refuse explicitement d'être un
  gestionnaire de tâches.
- **Tout ce qui exige SaaS multi-locataire, application mobile native,
  marketplace d'intégrations ou SOC 2.** Le produit n'a pas de colonne
  locataire, pas d'application native, pas d'OpenAPI. Ce n'est pas un
  retard, c'est une absence de projet.
- **Un client qui paie déjà une licence PPM d'entreprise et ne s'en sert
  pas.** Son problème est la discipline de gouvernance, pas l'outil.
  Vendre du logiciel à ce client, c'est vendre une seconde étagère.

### Qui achète, sur quel déclencheur, et contre quoi il arbitre vraiment

**L'acheteur est le directeur du PMO groupe ou le DSI groupe**, jamais le
site. Le site est l'utilisateur et le premier obstacle, pas le payeur.

**Le déclencheur d'achat est presque toujours un échec de récit**, pas un
besoin de fonction : une remarque d'audit sur la piste de décision, une
question du conseil à laquelle personne n'a su répondre (« qu'est-ce que
ce portefeuille nous a rapporté ? »), un comité de pilotage qui a
redécidé trois fois la même chose, une introduction en bourse ou une
exigence de conformité nouvelle.

**Et il n'arbitre presque jamais contre un concurrent.** Il arbitre
contre **un tableur partagé, une réunion mensuelle et un jeu de
diapositives** — c'est-à-dire contre le statu quo, qui est gratuit, connu
de tous, et dont personne n'a jamais mesuré le coût. C'est le vrai
adversaire, et c'est une bonne nouvelle : contre un tableur, Meridian
gagne sur la piste d'audit, sur le renvoi, sur l'ordre du jour généré et
sur le fait qu'un chiffre gelé ne bouge plus. Contre Planview, il perd
sur la grille.

### La proposition de valeur, en une phrase

> **« Nous remplaçons le tableur et la réunion mensuelle par un
> portefeuille où l'ordre du jour se construit seul, où chaque décision
> reste rejouable devant votre auditeur trois ans plus tard, et qui
> s'utilise en français depuis un site sur liaison satellite — sans
> licence par siège. »**

Elle est dite à froid, elle tient en une respiration, et chacun de ses
quatre membres est prouvé par un test ou une porte.

### L'anti-proposition

Les cas où le commercial doit conseiller autre chose, et le dire tout de
suite. Un produit qui ne sait pas décliner une affaire perd sa crédibilité
sur l'affaire suivante.

| Si le client dit… | Conseiller |
|---|---|
| « Mon problème, c'est de tenir un planning de trois mille tâches avec des calendriers d'arrêt » | Primavera P6, ou MS Project. Meridian a des liens FS et des jours calendaires |
| « Je veux que tout le monde collabore sur ses tâches » | Smartsheet ou Monday. Meridian ne dessine même pas une commande qu'un compte ne peut pas utiliser — c'est l'inverse d'un outil collaboratif ouvert |
| « Un seul site, un seul PMO » | Project for the web et un bon modèle de document. Toute la valeur de Meridian est dans la tension groupe ↔ site : sans elle, il ne reste que de la contrainte |
| « Il me faut une application mobile et du SSO avec MFA le mois prochain » | Ne pas concourir. Le SSO existe et n'a jamais complété une connexion réelle ; l'application mobile n'existe pas |
| « Nous payons déjà Clarity depuis quatre ans » | Ne pas vendre de logiciel. Vendre, éventuellement, la méthode : le rythme de comité et le modèle de renvoi se décrivent en trente pages |

---

## 5 · Les modèles économiques

Quatre scénarios. Pour chacun : ce qu'il exige et que le produit n'a pas,
et ce qu'il rapporte.

### A · Outil interne au groupe (statu quo)

**Ce qu'il exige encore.** Les dix décisions du mandant de
[`23`](23-comite-produit.md) §6, dont quatre sur le chemin critique de R2 ;
la sauvegarde éprouvée (G-01) ; les quatre politiques (G-04). Rien
d'autre. C'est le seul scénario qui ne demande aucune construction
nouvelle.

**Ce qu'il rapporte.** Une économie de licence, et il faut être honnête
sur son ordre de grandeur. Le comité refuse de compter l'économie contre
Planview : ce groupe n'aurait jamais acheté Planview. L'alternative
réaliste qu'il aurait fini par acheter est **Project Plan 3 pour 50 à 80
planificateurs (~30 $/utilisateur/mois) ou Smartsheet Business pour 200
sièges (~19 à 32 $/utilisateur/mois)** — soit **20 000 à 75 000 $ par an**
de dépense évitée, à laquelle aucun des deux n'aurait ajouté la piste
d'audit ni le renvoi.

**Le vrai rendement est ailleurs**, et il n'est pas monétaire : c'est
d'être le seul endroit où existe la piste de décision (condition 1 de la
thèse, tenue). Le comité le note et refuse de le chiffrer.

**Le risque du statu quo** est le plus mal couvert de tous : un dépôt, un
auteur, aucun contrat, aucune sauvegarde. Le jour où l'auteur s'arrête,
le groupe perd sa source de décision et personne ne sait annoncer en
combien de temps il la retrouve.

### B · Produit vendu à d'autres groupes miniers

**Ce qu'il exige et que le produit n'a pas** — les six lignes du §3 :
entité et licence, contrat de support avec délais, certificat de
signature de code, dossier de sécurité fournisseur, une référence
appelable, une sauvegarde éprouvée. Plus, côté produit : un chemin de
montée de version documenté pour le client (il existe et n'est écrit que
dans `docs/13`), et une garantie de sortie — un export ouvert du livre
**et** de la piste, qui aujourd'hui n'existe qu'à moitié (l'export JSON
d'administration ne contient pas la piste et n'a aucun chemin de
réimport).

Ce que le produit **n'a pas besoin** d'acquérir, contrairement à
l'intuition : la multi-location. Ce marché veut de l'installation chez
soi. Une base par client est un avantage commercial, pas une dette.

**Ce que ça rapporte.** Le segment est étroit et nommable : le comité
estime **entre 30 et 80 groupes** dans le monde à la bonne géométrie
(miniers, cimentiers et agro-industriels mid-cap, 5 à 20 sites,
francophones ou bilingues). Atteindre **5 à 15 clients en trois ans** est
un objectif crédible ; au-delà, il faut une équipe de vente, ce qui change
la nature du sujet.

### C · Logiciel libre avec support payant

**Ce qu'il exige.** Une licence, un dépôt public, une documentation en
anglais, un OpenAPI, une communauté. Aucun des cinq n'existe.

**Ce que ça rapporte.** Peu, et cela donne le seul avantage défendable.
Ce qui distingue Meridian n'est pas son code — 13 500 lignes qu'un bon
développeur réécrit — c'est **le modèle opératoire qu'il incarne**.
L'ouvrir, c'est publier gratuitement la seule chose qui ne se copie pas
en configuration. Le comité écarte ce scénario, et pas pour des raisons
idéologiques : pour une raison d'actif.

### D · Produit vertical multi-secteurs

**Ce qu'il exige.** Sortir du modèle ce qui est minier — fenêtres d'arrêt,
jalons intrusifs, rotations FIFO, vagues de déploiement par site — pour
en faire de la configuration. C'est une refonte du schéma, pas un
paramétrage. Plus tout ce qu'exige le scénario B.

**Ce que ça rapporte.** Un marché adressable plus large et une proposition
plus faible. Le comité note que l'avantage vendu au §4 est précisément la
**non-généricité** : « configurable » est le mot que Planview met dans sa
colonne, et personne ne gagne contre Planview sur ce mot.

### Le scénario recommandé, et sa fourchette de prix

**Recommandation : A pendant quatre trimestres, puis B ciblé.** Le
scénario B ne s'ouvre pas par du travail d'ingénierie : il s'ouvre par
une référence, et la seule référence disponible est Endeavour lui-même.

**Forme du prix : un abonnement de groupe, sans limite de sièges.** Le
comité écarte la licence perpétuelle avec maintenance à 20 % : elle
rémunère la livraison et pas la présence, alors que ce que le produit doit
apprendre à vendre est exactement la présence.

> **45 000 à 85 000 € par an et par groupe, sièges illimités**, plus une
> **mise en service forfaitaire de 25 000 à 60 000 €** la première année
> (huit sites, deux langues, reprise des données, formation des référents).

**Le plancher.** Sous 45 000 €, l'éditeur ne finance pas un ingénieur de
support à temps plein — il en faut un pour tenir un engagement de
rétablissement, et trois clients à 45 000 € couvrent son coût chargé. Un
prix plus bas ne serait pas agressif, il serait invérifiable : l'acheteur
en déduirait, à raison, qu'il n'y a personne au bout du fil.

**Le plafond.** Au-delà de 85 000 €, l'acheteur passe le dossier en
procédure d'appel d'offres formelle. À partir de là on lui demande le
carré d'analyste, le SOC 2, l'application mobile et les trois références
— et Meridian perd sur la grille avant d'avoir été vu.

**Le rattachement à l'alternative chez le client.** Une affaire Planview
comparable, à 200 sièges, est de l'ordre de **600 à 1 020 $ par
utilisateur et par an au tarif public**, soit 120 000 à 204 000 $ par an,
généralement remisée de 25 à 40 %, plus l'intégration. Sur cinq ans,
l'acheteur compare donc **environ 110 000 à 250 000 €** pour Meridian à
**500 000 à 1 000 000 €** pour l'alternative d'entreprise — un facteur
quatre à cinq, avec la donnée qui reste chez lui. C'est un écart qui se
défend en réunion sans avoir à mentir sur les fonctions manquantes, et
c'est la seule manière honnête de vendre ce produit.

*(Ordres de grandeur publics, relevés le 30/08/2026 ; non vérifiables
dans le dépôt et donnés comme tels.)*

---

## 6 · Les trois obstacles qui tueraient une vente

### Obstacle 1 · Le fournisseur n'existe pas

**Le constat.** Il n'y a ni entité, ni licence, ni contrat, ni engagement
de rétablissement, ni astreinte, ni certificat de signature — Windows ne
peut nommer aucun éditeur pour un binaire qu'on installe en LocalSystem
(S-16). Le dépôt porte seize commits d'un seul auteur. Les quatre
politiques de sécurité (G-04) ne sont pas écrites : **le questionnaire
tiers d'un acheteur minier s'arrête à sa troisième question.**

**Ce qu'il faut pour le lever.** Une entité et un fichier de licence ; un
contrat de support d'une page fixant deux délais (prise en compte,
contournement) et une personne nommée ; l'achat du certificat de signature
de code ; les quatre politiques signées. Trois mois, dont deux de
paperasse et un achat. **Aucune ligne de code.**

### Obstacle 2 · Zéro usage réel

**Le constat.** Le livre de production est vide, un seul compte est actif,
aucun bénéfice n'a jamais été mesuré, les huit sites sont muets, aucune
restauration n'a jamais été testée, aucun client ne peut être appelé. Le
propre comité de sécurité du produit lui **refuse par écrit** le droit de
porter une donnée réelle ([`20`](20-comite-infosec-grc.md) §9).

**Ce qu'il faut pour le lever.** Deux trimestres d'exploitation réelle
chez Endeavour, et la publication des six indicateurs d'adoption. Le
comité relève que **l'instrument de mesure est déjà construit** (A-08,
écran *Adoption*, ligne de base datée, `adoption-measure.test.js`) — c'est
le seul actif commercial que ce produit puisse fabriquer sans écrire une
ligne de code, et il ne se fabrique pas plus vite qu'en six mois.

### Obstacle 3 · Le risque d'homme-clé, et rien pour le couvrir

**Le constat.** Un auteur, aucune API publiée, aucun intégrateur formé,
13 500 lignes sur mesure sans cadre que quelqu'un d'autre connaisse
(constructeur de DOM maison, aucune bibliothèque front). Aucun séquestre,
aucun second mainteneur, aucune clause de sortie. Le responsable des
achats posera la question sous cette forme : *« et dans trois ans ? »* —
et aujourd'hui la réponse honnête est un silence.

**Ce qu'il faut pour le lever.** Un séquestre de code chez un tiers avec
condition de libération écrite ; un second ingénieur capable de faire
passer `npm run verify` sur une machine neuve, constaté et daté ; une
clause de réversibilité adossée à un export ouvert du livre **et** de la
piste — la moitié existe déjà (CSV de portefeuille, pack de preuve
Markdown, JSON du livre), il manque la piste et un chemin de réimport.

### La meilleure attaque du concurrent

*Écrite par le siège du concurrent, en son nom, à sa demande. Le comité
la publie sans l'adoucir.*

> Je ne l'attaque pas sur les fonctions. Je perdrais : leur piste d'audit
> est meilleure que la mienne, leur ordre du jour se construit tout seul
> et je n'ai rien qui ressemble à leur modèle de renvoi. Alors je ne parle
> pas du produit.
>
> Je pose trois questions au comité d'achat, dans cet ordre, et je me
> tais.
>
> **1. « Montrez-moi le client que je peux appeler. »** Il n'y en a pas.
> Leur propre comité de sécurité leur interdit encore par écrit de porter
> une donnée réelle. Ils vous vendent un outil de gouvernance qui n'a
> jamais gouverné.
>
> **2. « Qui signe l'engagement de rétablissement, et sur quelle
> version ? »** Pas d'éditeur, pas de contrat, pas de sauvegarde testée —
> et l'exécutable que vous allez lancer avec les droits système sur votre
> serveur, Windows est incapable de vous dire qui l'a écrit.
>
> **3. « Et dans trois ans ? »** Un dépôt, un auteur, aucune API publiée,
> aucun intégrateur formé au monde.
>
> Puis je concède ce que je ne peux pas nier — leur rythme de comité et
> leur piste sont excellents — et je propose de **les reproduire chez moi
> en configuration**, six semaines de prestation, sur une plateforme que
> vous pourrez encore acheter dans dix ans. Je transforme leur seul
> avantage en une ligne de mon devis, et je repars avec l'affaire.

**Ce que le comité répond, et ce qu'il ne peut pas répondre.** La
reproduction en configuration est un bluff **technique** : personne ne
reproduit en paramétrage une règle `audit_no_delete` posée à la base, ni
une séparation des tâches évaluée dans la porte du jalon, ni une
construction qui échoue sur une traduction manquante. Mais c'est un bluff
**qui gagne**, parce que la différence est invisible dans une grille
d'appel d'offres : les deux lignes se cochent « oui ».

C'est le constat le plus dur de ce rapport. **L'avantage réel de Meridian
n'est pas exprimable dans le format où les achats se décident.** Il ne se
démontre qu'en exécution — un auditeur qui rejoue une décision de mars, un
site qui reçoit un ordre du jour qu'il n'a pas préparé. Ce qui signifie
que ce produit ne se vend pas en appel d'offres. Il se vend par la preuve
d'usage, à un acheteur qui a déjà mal vécu un audit — ce qui ramène,
encore, à l'obstacle 2.

---

## 7 · Verdict

**Meridian est un très bon logiciel qui n'est pas encore un produit :
tout ce qu'un acheteur évalue en premier — un éditeur, un contrat, une
référence appelable, une sauvegarde éprouvée — est absent des vingt-trois
documents qui précèdent, tandis que tout ce que sept comités ont
perfectionné ne se voit pas dans une grille d'appel d'offres.** Il gagne
aujourd'hui contre le tableur et la réunion mensuelle, chez un groupe
industriel multi-sites qui a déjà mal vécu un audit ; il perd contre
n'importe quel éditeur établi tant que personne ne peut appeler quelqu'un
un dimanche soir.

### La recommandation, unique et datée

> **Ne rien chercher à vendre avant le 31 mars 2027.**
>
> D'ici là, une seule chose : mettre Endeavour en exploitation réelle —
> R2 close selon les dates déjà prises par [`23`](23-comite-produit.md) §6,
> puis deux trimestres d'usage — et **publier au 31/03/2027 les six
> indicateurs d'adoption de l'écran A-08, avec leur ligne de base datée du
> premier jour.**
>
> Ce relevé, et rien d'autre, est le premier actif commercial que ce
> produit puisse posséder. Sans lui, aucun des quatre modèles économiques
> n'est ouvert. Avec lui, trois le deviennent — et l'obstacle 1 se ferme
> alors en trois mois de paperasse et un achat.

Le comité ajoute la condition à laquelle il aura eu tort, comme
[`22`](22-comite-innovation.md) en a pris l'habitude : **si au 31/03/2027
moins de quatre des huit sites d'Endeavour sont actifs dans l'outil, le
scénario B est à abandonner, pas à reporter.** Un produit que son propre
groupe n'utilise pas ne se vend à personne, et continuer à le préparer
pour un marché serait la manière la plus coûteuse de ne pas l'admettre.

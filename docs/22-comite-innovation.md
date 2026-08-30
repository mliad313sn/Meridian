# Comité d'innovation — Meridian IT-PMO

Date : 30 août 2026. Convoqué après la recette AMDEC
([18-amdec-recette.md](18-amdec-recette.md)), le comité d'adoption
([19-comite-adoption.md](19-comite-adoption.md)) et le comité InfoSec/GRC
([20-comite-infosec-grc.md](20-comite-infosec-grc.md)).

Objet : dire ce que le produit doit gagner ensuite. Trois sujets, dans
l'ordre du mandat — l'interconnexion IA, le centre de notification, et ce
que le comité juge encore porteur de valeur.

---

## 0 · Frontières du mandat

Le comité travaille sur un produit mûr et le sait. Il s'interdit trois
choses, et la première est la plus importante.

**Il ne réclame rien de ce qui existe.** La file de notification existe
(`server/src/notify.js`), la suppléance existe (`015_rotation.sql`), le
digest existe (`GET /digest`, `server/src/routes/portfolio.js:2608`), la
piste d'audit est transactionnelle et en ajout seul
(`server/src/audit.js:45`). Le comité a compté avant de proposer ; les
comptages sont au §2.

**Il ne rouvre aucune décision prise.** Le moteur reste gelé et on étend
autour de lui, comme `Engine.isEvidence` l'a fait
([18-amdec-recette.md](18-amdec-recette.md), acquis n° 3). L'autorité
reste décidée en un seul endroit. Les quinze réserves du comité
indépendant, les seize constats de valeur, les onze défauts de sécurité
et les trois acceptations écrites du mandant sont acquis.

**Il ne redemande aucune réserve ouverte d'un autre comité.** Les neuf
réserves d'adoption non levées (A-01, A-05 à A-12) et les dix-sept
constats GRC appartiennent à leurs comités. Quand une proposition les
touche, elle s'y raccroche explicitement au lieu de les réécrire — c'est
notamment vrai des mesures de valeur, qui s'ajoutent toutes à l'écran
d'adoption que **A-08** attend déjà, et d'aucun écran nouveau.

**Une seule condition préalable, et elle n'est pas négociable.** Le comité
InfoSec/GRC a refusé l'autorisation de mise en production en l'état pour
quatre constats de vague 0 : G-01 (aucune sauvegarde éprouvée), G-03 (la
donnée de santé), G-04 (aucune politique écrite), G-13 (aucune base
légale, aucune durée de conservation). **Rien de ce qui suit ne commence
avant leur clôture.** Une nouvelle capacité posée sur une base qu'on ne
sait pas restaurer et dont la durée de conservation n'est pas décidée
n'est pas une capacité : c'est une aggravation. Le comité le dit une
fois et n'y revient plus.

---

## 1 · Composition

Huit sièges. Aucun ne reprend un siège du comité d'adoption ni du comité
InfoSec/GRC ; le RSSI y est représenté par une déléguée mandatée, pour
que la donnée sensible ait une voix ici sans que le siège soit tenu deux
fois.

| Siège | Origine | Ce qu'il vient trancher |
|---|---|---|
| **Architecte du produit** — *président* | équipe | Où l'appel se branche, et ce qui ne bouge pas : le moteur gelé, `audited()`, `shared/rbac.js` |
| **Praticienne de l'inférence en exploitation** | prestataire, a déployé du modèle local sur site isolé | Ce qu'un serveur de site tient réellement, et ce que le modèle rate |
| **Déléguée du RSSI à la donnée** | mandatée par le comité InfoSec/GRC | Ce qui sort, vers où, sous quelle fiche tiers — et ce qui atterrit dans une table indélébile |
| **Responsable informatique de site (Houndé)** | métier | Ce qui se passe quand la liaison satellite tombe à 14 h un mardi |
| **Contrôle de gestion des projets** | groupe | Quel chiffre l'outil a le droit de prononcer, et ce que la capacité coûte chaque mois |
| **Ergonome des systèmes d'alerte** | prestataire, spécialité salles de conduite | À partir de quel volume une alerte cesse d'être lue, et comment on le mesure |
| **Exploitation DSI groupe** | groupe | Qui exécute le balayage, qui reçoit l'échec, qui paie le matériel |
| **Le sceptique** — *ancien directeur de programme* | groupe, mandat déclaré | Tuer les idées faibles. Son siège existe pour cela et il l'a exercé cinq fois |

Personnages et lieux repris du comité d'adoption pour ne pas en inventer
d'autres : le surintendant maintenance de Houndé, la contrôleuse de
gestion projets, le parc de huit sites.

---

## 2 · Ce que le comité a compté avant de proposer

Aucun chiffre de cette section n'est une impression.

**Sur les flux sortants.** Le serveur ouvre **un seul** appel réseau
sortant dans tout le produit : l'échange de jeton OIDC,
`server/src/oidc.js:106`. Il n'y en a pas d'autre. Brancher un modèle de
langage serait donc le **deuxième flux sortant de l'histoire du produit**,
et le premier à transporter du contenu métier.

**Sur les dépendances.** Quatre dépendances d'exécution
(`package.json:23-28`) — le comité InfoSec/GRC porte ce chiffre à
l'actif du produit (G-11). Toute proposition qui en ajoute une part avec
un handicap.

**Sur la notification.** Le balayage `sweep()`
(`server/src/notify.js:73-146`) produit **trois** des **six** genres que
la table déclare (`013_notifications.sql:26`) : `decision-owed`,
`digest` et `concern-raised` sont écrits dans la contrainte et ne sont
émis par personne. La préférence de cadence accepte quatre valeurs
(`015_rotation.sql:42-43`, contrôlée à `server/src/routes/auth.js:228`)
et le code n'en teste **qu'une** : `notify.js:39` et `:49` comparent à
`"off"` et rien d'autre — *quotidien* et *hebdomadaire* sont offerts au
destinataire et ne changent rien. La file n'est lisible que par un
administrateur (`GET /admin/notifications`,
`server/src/routes/admin.js:218`) : **le destinataire d'un message ne
peut pas le lire.** Et rien ne déclenche le balayage : `server/src/index.js:205`
et `:242` programment uniquement `sweepSessions` ; la seule voie
d'exécution est `POST /admin/notifications/sweep` (`admin.js:240`),
c'est-à-dire **le clic d'un administrateur**. Une file de notification
qui ne part qu'à la main n'est pas une file, c'est un bouton.

**Sur la navigation.** `NAV` (`web/src/main.js:28-45`) porte dix-huit
entrées en cinq intentions. Aucune n'est un centre de notification. Le
digest existe comme bloc d'écran (`web/src/views/index.js:141`, rendu
`:434`) et n'est jamais un message.

**Sur la preuve.** `document` porte `uri`, `uri_locked_hash` et
`uri_locked_on` depuis `014_evidence.sql`. **Rien ne revérifie jamais
qu'un lien approuvé répond encore.** La recette l'avait vu et l'avait
accepté : mode résiduel R-01, « l'hôte de confiance héberge des liens
morts », RPN 32 ([18-amdec-recette.md](18-amdec-recette.md), ligne
R-01).

**Sur le hors-ligne.** `localStorage` ne sert qu'au thème, à la langue et
au souvenir de l'orientation (`web/src/main.js:165, 188, 536` ;
`web/src/lib/i18n.js:24, 29`). Aucun agent de service, aucun cache de
données. Si la liaison tombe, l'écran est vide.

**Sur l'enseignement.** Les migrations 001 à 017 ne contiennent aucune
table d'enseignement. `rollout_wave` (`010_plant_and_sites.sql:64`) porte
un `seq` et une `note` libre ; la même vague se rejoue jusqu'à huit fois
et rien ne transporte ce que la précédente a appris.

---

## 3 · Interconnexion IA

### 3.1 Le tri, avant tout le reste

Le comité a refusé de partir de ce que l'IA sait faire. Il est parti des
six usages nommés au mandat et a posé à chacun une seule question :
**qu'est-ce qui, ici, est un problème de langue ?** Ce qui n'en est pas
un ne mérite pas de modèle.

| Usage proposé | Ce que c'est réellement | Verdict |
|---|---|---|
| Rédiger un compte rendu à partir des décisions consignées | `renderMinutes` (`shared/meetings.js:410`) l'écrit déjà, depuis l'ordre du jour gelé, les décisions et les actions | **Rejeté** — X-03 |
| Résumer un dossier de preuve | Le pack est déjà produit, complet et déterministe (`routes/portfolio.js`, route du pack de preuves) ; sa valeur est d'être exhaustif | **Rejeté** — X-02 |
| Question en langage naturel sur le portefeuille | Une requête SQL déguisée quand elle porte sur un chiffre ; un problème de **navigation** quand elle porte sur « où est-ce ? » | **Scindé** — chiffre rejeté (X-01), navigation retenue sous condition (N-04) |
| Détecter un risque qui se répète d'un site à l'autre | Un vrai problème de langue : huit registres, deux langues, du texte libre, aucune nomenclature commune | **Retenu** — N-03 |
| Aide à la saisie | Un vrai problème de langue : trente-six formulaires sur cinquante-huit sont muets (A-05) et les champs les plus mal remplis sont ceux qu'un tiers lira | **Retenu** — N-02 |
| Brouillon de statut hebdomadaire | Un vrai problème de langue, et l'emplacement existe déjà : `report_narrative` (`002_portfolio.sql:224`), écrit par `PUT /narrative/:key` (`routes/portfolio.js:2120`) | **Retenu** — N-02 |

La règle qui sort de ce tri, et que le comité pose comme doctrine :
**l'IA a le droit d'écrire des phrases, jamais des nombres.** Le nombre
est le produit. Il sort de `shared/engine.js`, qui est gelé, testé et
opposable ; une seconde source pour le même chiffre n'est pas une
fonctionnalité, c'est un défaut de gouvernance.

### 3.2 N-01 — Le contrat d'assistance

**Constat.** Le produit n'a aucun point d'entrée pour un service
d'inférence, et c'est heureux : il n'en aura qu'un, et sa forme décide de
tout le reste.

**Proposition.** Un module serveur unique, `server/src/assist.js`, posé à
côté de `notify.js` et bâti sur les deux mêmes séparations délibérées :
**composer n'est pas écrire**, **demander n'est pas décider**.

Serveur, jamais navigateur — pour trois raisons qui tiennent toutes :
la politique de contenu posée par S-12 interdit au client d'appeler un
tiers ; une clé remise au navigateur est une clé publiée ; et la liaison
satellite d'un site ne doit pas porter l'appel quand le modèle tourne sur
le serveur du site.

**Contrat technique.**

```
POST /api/assist/:task        task ∈ { field-draft, status-draft,
                                      navigate, pattern-explain }
→ 200 { draft | route, model, endpoint, callId, tookMs }
→ 501 { error: "assistance non configurée — MERIDIAN_ASSIST_URL" }
→ 503 { error: "le modèle n'a pas répondu en <n> ms — rédigez à la main" }
```

La liste des tâches est **fermée**, comme `ACTIONS` l'est dans
`shared/rbac.js:23`. Il n'existe pas de route qui accepte une consigne
libre : ce que le modèle reçoit est composé par le serveur à partir d'un
gabarit versionné et du livre déjà réduit au périmètre de l'appelant.

**Configuration.**

| Paramètre | Défaut | Comportement |
|---|---|---|
| `MERIDIAN_ASSIST_URL` | *absent* | Point d'accès compatible OpenAI (`/v1/chat/completions`). **Absent, la capacité n'existe pas** |
| `MERIDIAN_ASSIST_MODEL` | *aucun* | Exigé avec l'URL. Pas de valeur par défaut : un nom de modèle par défaut est un choix silencieux |
| `MERIDIAN_ASSIST_KEY` | *absent* | Facultatif — un serveur local n'en demande pas. Présent, c'est un secret au registre G-15 |
| `MERIDIAN_ASSIST_TIMEOUT_MS` | `8000` | Au-delà, le brouillon est abandonné et le formulaire le dit |
| `MERIDIAN_ASSIST_EGRESS` | `local` | Le serveur résout l'hôte de l'URL. S'il n'est ni boucle locale ni adressage privé, **la capacité refuse de s'activer** et dit pourquoi, sauf `external` posé explicitement |

**Ce qui se passe quand ce n'est pas configuré**, et c'est le point sur
lequel le comité n'accepte aucune souplesse : la commande **n'est pas
dessinée**. C'est la règle du produit depuis R7.3 — « une commande qu'un
compte ne peut pas utiliser n'est pas dessinée » — et elle s'applique
ici sans exception. La route répond 501 en nommant le paramètre, comme
`documentHosts` nomme le sien. Aucune réponse simulée, aucun exemple
pré-écrit, aucun bouton grisé qui promet pour plus tard.

**Le consentement est un acte de site.** Migration 021 :
`site.assist_enabled boolean NOT NULL DEFAULT false`. Un site qui ne l'a
pas activé ne voit jamais une de ses lignes composée dans une consigne,
même si le groupe a branché un modèle. Le comité InfoSec/GRC a posé la
règle et le comité d'innovation la reprend mot pour mot : **pas de fiche,
pas de branchement** (G-16) — et il y ajoute : *pas de site consentant,
pas de ligne*.

### 3.3 Les six garanties non négociables

Elles ne sont pas des intentions. Chacune se vérifie, et cinq d'entre
elles se vérifient par une porte automatique de construction — le sixième
motif de `npm run audit`, dans la lignée des cinq existants.

**GA-1 — L'IA ne décide pas.** Aucune sortie d'assistance ne devient un
statut, une note de priorisation, un feu RAG, une approbation ou un
montant. *Vérification :* la porte échoue si `shared/engine.js` importe
`assist.js`, ou si une route d'assistance renvoie une clé du vocabulaire
du moteur.

**GA-2 — L'IA n'écrit pas.** Aucune route d'assistance n'ouvre de
transaction. `audited()` (`server/src/audit.js:45`) reste l'unique voie
d'écriture, et l'écriture est celle de l'humain, par la route ordinaire,
avec sa ligne d'audit ordinaire. *Vérification :* la porte échoue si
`assist.js` importe `audited` ou `tx`.

**GA-3 — L'IA n'élargit aucun périmètre.** Toute consigne est composée à
partir de `loadPortfolio(req.user)`, c'est-à-dire du livre déjà rétréci
par `projectScopeSql` (`shared/rbac.js:434`). Aucune route d'assistance
ne lit plus large que son appelant. *Vérification :* les routes
d'assistance entrent dans le balayage d'usage existant — les mêmes
quatre rôles, la même exigence de zéro écart réel.

**GA-4 — Rien ne sort du site sans acte explicite.** Deux verrous
indépendants, tous deux fermés par défaut : `MERIDIAN_ASSIST_EGRESS` sur
l'hôte, `site.assist_enabled` sur le site. Le premier protège
l'installation, le second protège le site contre le groupe.

**GA-5 — Ce que l'IA a produit est marqué, et rien de plus.** Migration
021 : table `assist_call` (qui, quand, tâche, modèle, point d'accès,
entité concernée, **empreinte** de la consigne, longueur, durée, issue)
et colonne `audit_event.assist_ref text NOT NULL DEFAULT ''` pointant
vers elle. Une ligne écrite à partir d'un brouillon porte donc, sur la
piste, la mention « rédigé avec assistance » et de quoi remonter à
l'appel.

Le comité insiste sur ce qui n'y est **pas** : le texte de la consigne
n'est pas recopié dans la piste. G-03 vient d'apprendre au produit ce
que coûte un `before: { ...a }` dans une table que la base refuse
d'effacer. Recommencer avec des consignes de modèle serait la même faute
en plus grand.

**GA-6 — L'absence de configuration se dit.** Elle ne se simule pas.
C'est le troisième cas d'une doctrine déjà tenue trois fois — SMTP,
Entra ID, `documentHosts` — et acceptée par écrit par le mandant.

### 3.4 N-02 — Le brouillon au champ et le brouillon de statut

**Constat.** Le comité d'adoption a compté trente-six formulaires sur
cinquante-huit sans la moindre aide, et a nommé la population de champs
qui compte : ceux dont la valeur **est lue par quelqu'un d'autre que
celui qui la saisit** — motif de refus, note de décision, mesure de
bénéfice, justification de re-ligne de base (A-05). Ce sont exactement
les champs qu'un chef de site francophone en fin de rotation remplit
d'un mot, ou pas.

**Proposition.** Deux tâches, un seul mécanisme.

`field-draft` — au pied d'un champ de texte long, une commande *Proposer
un brouillon*. Le serveur compose la consigne à partir de l'objet en
cours (le projet, la demande, la décision) tel que l'appelant a le droit
de le voir, et rend soixante à quatre-vingts mots dans la langue du
compte (`app_user.locale`). Le texte arrive **dans le champ, modifiable,
non enregistré**. Aucune écriture n'a eu lieu. Celle qui suivra sera
celle de l'utilisateur.

`status-draft` — sur l'écran de rapport, la même chose pour un bloc de
`report_narrative`. L'emplacement existe, la route existe
(`PUT /narrative/:key`), la concurrence est déjà tenue. Il n'y a rien à
inventer autour : seulement à remplir la page blanche du lundi matin.

**Coût.** Aucune dépendance nouvelle — `fetch` est dans Node. Environ 250
lignes serveur, 150 lignes client, une migration. Le coût récurrent est
ailleurs : soit du matériel sur le serveur de site, soit une facture au
jeton que personne sur un site minier ne sait prévoir. Le §3.6 tranche.

**Mesure de valeur.** `assist_call.outcome` est enregistré au moment où
l'écriture humaine suit — ou ne suit pas :
`accepted` / `edited` / `discarded` / `failed` / `timeout`.

1. **Part des brouillons repris** (`accepted` + `edited`), par tâche, par
   site, par mois, sur l'écran d'adoption d'A-08. Seuil décidé
   d'avance : **sous 40 % sur un trimestre pour une tâche donnée, la
   tâche est retirée**, pas réglée. Une mesure qui ne peut pas dire non
   n'est pas une mesure.
2. **Part des champs lus par un tiers qui arrivent non vides**, avant et
   après. C'est la seule mesure qui dit si l'assistance a servi *au
   lecteur* plutôt qu'au rédacteur. Si elle ne bouge pas, l'assistance
   est un ornement et sera retirée avec la même sobriété.

### 3.5 N-03 — Le motif qui se répète d'un site à l'autre

**Constat.** C'est le seul usage où le comité a trouvé une valeur que
rien d'autre ne peut produire. Huit sites tiennent chacun leur registre,
en français et en anglais, en texte libre, sans nomenclature commune. La
même défaillance de fournisseur frappe Houndé en mars et São Paulo en
juin ; les deux lignes existent, personne ne les rapproche, et la vague
suivante de la même vague de déploiement la reprend intégralement. Aucune
requête SQL ne rapproche « liaison satellite instable pendant la bascule »
de « perte de connectivité au basculement du lien ». C'est un problème de
langue, et c'est le seul du lot.

**Proposition.** Un rapprochement par similarité, jamais une décision.

Un vecteur par élément de registre ouvert et par demande de changement
close, obtenu du même serveur d'inférence
(`MERIDIAN_ASSIST_EMBED_URL`, `/v1/embeddings`). Stockage en `real[]`
sur la ligne, cosinus calculé en SQL : le registre du groupe pèse
quelques milliers de lignes, un parcours complet suffit, et **il n'y a
donc aucune raison d'ajouter `pgvector`** — ce qui préserve aussi le
repli PGlite, qui ne l'aurait pas.

La sortie est une **suggestion** sur l'écran de gouvernance de
programme : « cet élément ressemble à trois éléments d'autres sites ». La
suggestion n'écrit rien. Un humain, s'il est d'accord, escalade par la
mécanique RAID existante, et cet acte-là est audité comme les autres.

**Une contrainte d'autorité que le comité tient à écrire.** Cette surface
est **réservée au niveau groupe**. `canSeeProject` (`shared/rbac.js:108`)
n'accorde à un compte de site que ses propres sites et les projets
gouvernés au groupe ; une surface qui rapproche les registres de huit
sites serait, pour un compte de site, une fenêtre latérale sur le
registre du voisin. Elle n'existe donc pas pour lui. Ce n'est pas une
option de réglage, c'est la conséquence directe du modèle d'accès.

**Mesure de valeur.** Nombre de suggestions **retenues** par trimestre,
et — la mesure honnête — nombre écartées. **Sous une suggestion retenue
par site et par trimestre, la surface est retirée.**

### 3.6 Le modèle local — ce qu'un serveur de site tient réellement

Le comité a traité l'option locale comme la position par défaut, et non
comme une variante. Trois raisons, dans l'ordre de force.

**La donnée.** Le §3 du rapport InfoSec/GRC classe ce que porte le
schéma : rémunération indirecte sur `person`, temps de travail sur
`timesheet`, correspondance sur `notification`, et un agrégat de tout
cela sur `audit_event`. Composer une consigne à partir du livre, c'est
mettre du contenu de cette nature dans une requête sortante. Sans fiche
tiers G-16 — données transmises, **localisation**, engagement de
disponibilité, conditions de sortie — cela ne se branche pas.

**La liaison.** Sur satellite, une aller-retour vers un service
d'entreprise ajoute deux à trois secondes avant le premier mot, quand la
liaison tient. Un brouillon qui arrive après le formulaire n'est pas
utilisé. Le modèle sur le serveur du site n'a pas ce problème ; le
modèle au groupe l'a pour les huit sites.

**Le matériel, dit sans optimisme.** Un modèle d'instruction de sept à
huit milliards de paramètres, quantifié en quatre bits, tient dans cinq
à six gigaoctets. Sur le processeur d'un serveur de site, il produit
quelques mots par seconde : acceptable pour un brouillon de soixante
mots, inutilisable pour une conversation. Sur une carte graphique modeste
de seize gigaoctets, il est instantané.

C'est cette phrase qui referme le §3 : **les trois usages retenus sont
tous à sortie courte, et ce n'est pas une coïncidence.** La contrainte
matérielle d'un site isolé et la contrainte de gouvernance d'un produit
d'audit désignent le même périmètre. Ce que le serveur du site peut
porter est exactement ce que le comité accepte que l'IA fasse.

### 3.7 N-04 — La navigation en langage naturel *(retenue sous condition)*

**Constat.** « Quels projets de mon site glissent de plus de trente
jours ? » n'est pas une question sur un chiffre — le chiffre est déjà
calculé et affiché. C'est une question sur **où il se trouve**, parmi
dix-huit écrans.

**Proposition.** Le modèle reçoit la question et le catalogue des vues et
de leurs filtres ; il rend **une route**, jamais une donnée :
`{ view: "portfolio", filters: { site: "GRU", slipDays: ">30" } }`. Le
client y va. Les chiffres affichés sont ceux du moteur, comme toujours.
S'il ne sait pas, il le dit et renvoie vers Ctrl-K.

**Le sceptique s'y est opposé**, et son objection est consignée : la
palette cherche déjà partout (`web/src/main.js:249`, « Search everything
(Ctrl-K) »), et un assistant de navigation risque de devenir le manuel
que la réserve A-01 attend — le pire manuel possible, parce qu'il n'est
ni relisible, ni traduisible, ni opposable.

**Le comité retient donc sous deux conditions écrites.** Un : A-01 (le
manuel dans le produit) et A-10 (les parcours par rôle) doivent être
livrées d'abord. Deux : la condition d'arrêt est fixée d'avance — si la
part des questions auxquelles le modèle répond « je ne sais pas » dépasse
un quart au deuxième mois, la capacité est retirée sans nouvelle séance.

---

## 4 · N-05 — Le centre de notification

### 4.1 Constat

Il existe une file d'envoi. Il n'existe pas de centre, et les comptages
du §2 disent à quel point : le destinataire ne peut pas lire ce qui lui
est adressé, la préférence de cadence qu'il a choisie ne change rien,
trois genres de messages sur six ne sont émis par personne, et le
balayage ne s'exécute que si un administrateur clique.

Le comité d'adoption n'a pas traité les notifications — le champ était
libre, il l'a vérifié. Mais il a laissé une phrase qui commande tout ce
qui suit : *« si l'un des huit sites a discrètement recommencé à tenir
son portefeuille sur un tableur, rien dans Meridian ne le dira »*
(A-08). Un centre de notification est la réponse à cette phrase, à
condition de ne pas devenir lui-même la raison pour laquelle on cesse de
regarder l'outil.

### 4.2 Le centre

Une dix-neuvième entrée de navigation, dans l'intention **Deliver**,
juste sous *My week* — et un compteur discret dans l'en-tête. Trois
choses seulement s'y font.

**Ce qui m'attend.** Les messages qui me sont adressés, non lus, groupés
par objet. Jamais une liste de tout ce que la file contient.

**Ce que j'ai lu.** Lu n'est pas envoyé. Le champ `state` de la table
(`013_notifications.sql:32-33`) est un état de **remise** — file, envoyé,
échec, supprimé. Il ne dira jamais qu'une personne a vu quelque chose.
Il faut un champ pour cela, et il n'existe pas.

**Ce que je peux faire depuis là.** Ouvrir l'objet, et — quand l'objet est
une action de comité dont je suis le porteur — la clore. Rien d'autre.

Cette dernière limite est une garantie, pas une pauvreté : **le centre
n'ouvre aucune voie d'écriture nouvelle.** Clore une action depuis le
centre appelle la route existante, avec son contrôle d'autorité et son
`audited()`. Un centre de notification qui écrit par un chemin parallèle
est un contournement de `shared/rbac.js` déguisé en commodité.

**Et la lecture du centre ne passe par aucun périmètre.** `GET
/api/me/notifications` filtre sur `user_id = req.user.id`, un point.
Jamais `projectScopeSql`, jamais une jointure sur le livre. C'est ce qui
rend le centre structurellement incapable de fuir : il ne lit pas le
portefeuille, il lit une boîte. La redirection vers le suppléant ayant
déjà eu lieu à la mise en file (`resolveRecipient`,
`server/src/notify.js:37-52`), le suppléant lit sa propre boîte et non
celle de l'absent.

L'index qui sert cette lecture existe déjà : `notification_user_idx`
(`013_notifications.sql:41`). Le comité le note à l'actif.

### 4.3 Les règles d'abonnement

Aujourd'hui, un compte porte **une** cadence globale, et elle est
ignorée. Le comité veut un abonnement, c'est-à-dire un croisement de
quatre choses : **par événement, par portée, par gravité, par canal.**

```
notification_subscription
  user_id      → app_user
  kind         genre d'événement, ou '*'
  scope_kind   'portfolio' | 'programme' | 'site' | 'project'
  scope_id     '' pour portfolio
  min_severity 'info' | 'attention' | 'urgent'
  channel      'centre' | 'courriel' | 'sortant'
  cadence      'immediate' | 'daily' | 'weekly'
  active       booléen
```

Deux règles de composition, écrites pour éviter la surprise :

- **Le centre n'est pas abonnable.** Tout ce qui m'est adressé y arrive,
  toujours. Un abonnement règle ce qui **sort** vers moi, jamais ce que
  je peux venir chercher. Un utilisateur qui se désabonne de tout doit
  encore pouvoir constater ce qu'il a manqué.
- **La cadence est enfin honorée.** `immediate` remet à la file
  immédiatement ; `daily` et `weekly` agrègent en un message unique par
  période — c'est précisément ce que le genre `digest`, déclaré et jamais
  émis, attendait depuis `013_notifications.sql:26`.

Trois genres nouveaux, qui bouchent des trous constatés ailleurs :
`site-quiet` (aucune mise à jour d'avancement sur un site depuis trente
jours — le seuil est celui d'A-08, et le comité reprend son chiffre
plutôt que d'en inventer un), `timesheet-missing`, et
`evidence-unreachable` (voir N-07).

### 4.4 Les canaux

Le courriel existe et attend `MERIDIAN_SMTP_URL`. Le comité en ajoute
**un**, et un seul.

**Le sortant HTTPS.** Une adresse par site ou par programme, avec charge
utile JSON. C'est aussi la réponse honnête à la question Teams : un
connecteur entrant Teams **est** un POST HTTPS d'une carte JSON. Il n'y
a donc pas de canal Teams à écrire — il y a un canal sortant, dont Teams
est le premier consommateur documenté. Aucune inscription d'application,
aucun jeton Graph, aucune dépendance nouvelle, aucun tiers de plus au
sens de G-16 au-delà de celui que le groupe exploite déjà.

L'adresse d'un connecteur entrant **est un secret** : elle entre au
registre G-15 avec dépositaire et rotation, et la liste des hôtes
autorisés est fermée par défaut, sur le patron exact de
`documentHosts`.

**Ce que le comité refuse d'ajouter :** le SMS par liaison satellite
(coût par message, aucune traçabilité de lecture, et le seul cas qui le
justifierait — l'astreinte — n'est pas géré par cet outil), la
notification poussée mobile (il n'y a pas d'application mobile), et le
temps réel dans le navigateur (il n'y a pas de couche temps réel, et un
relevé à la navigation suffit à un outil dont l'unité de temps est la
semaine).

### 4.5 La gestion du bruit

C'est le siège de l'ergonome des systèmes d'alerte qui a écrit ce
paragraphe, et il l'a écrit en premier. **Un centre de notification échoue
par excès, jamais par défaut.** Cinq mécanismes, tous mesurés.

**Le regroupement.** `notification.group_key` — un message par projet et
par jour plutôt qu'un par action. Le mécanisme de déduplication existant
(`dedupe_key`, et le beau détail de `notify.js:141` où un jalon bloqué
est hebdomadaire parce que c'est un état permanent) est **conservé
intact** et complété : la déduplication empêche la répétition, le
regroupement empêche la rafale.

**Le seuil.** `min_severity` par abonnement. Une gravité est portée par
la ligne (`notification.severity`), calculée à l'émission, jamais réglée
à la main.

**Le silence de nuit.** Deux colonnes sur `app_user` — `quiet_from`,
`quiet_to` — lues dans le fuseau du **site** de la personne, pas du
serveur. Un message émis pendant le silence n'est pas supprimé : il
attend. Sauf `urgent`, qui passe, parce qu'un silence qu'on ne peut pas
percer devient un silence qu'on désactive.

**L'escalier.** Un message non lu au bout de N jours **monte d'un cran de
gravité** au lieu d'être renvoyé. Renvoyer le même message apprend à
l'ignorer ; le faire monter apprend qu'il compte. Le comité tient à ce
mécanisme : il est peu coûteux et c'est le seul du lot qui traite la
cause plutôt que le symptôme.

**La rotation.** Elle est déjà traitée, et bien : `resolveRecipient`
redirige vers le suppléant nommé et préfixe le message pour que personne
ne se trompe de devoir. Le centre en hérite sans y toucher. Ce qui lui
manque est ailleurs — au §4.6.

### 4.6 L'articulation avec la suppléance et le digest existants

**La suppléance.** Elle fonctionne à la mise en file et pas au retour. Un
chef de site qui rentre de quatorze jours trouve une boîte que son
suppléant a peut-être lue, peut-être pas, et il n'a aucun moyen de le
savoir. Le centre ajoute donc, et c'est tout ce qu'il ajoute : **au
retour, la liste de ce qui a été adressé à mon suppléant en mon nom, et
de ce qu'il en a fait.** Pas une seconde boîte — une colonne
`on_behalf_of` et un filtre.

**Le digest.** `GET /digest` fait déjà la bonne chose et personne ne
touche à sa logique : la fenêtre s'élargit à la durée de l'absence, sept
jours plancher, soixante jours plafond
(`routes/portfolio.js:2614-2630`). Le comité n'y change rien. Il
constate seulement que ce travail ne sort jamais de l'écran, et que le
genre `digest` de la table attend son émetteur depuis `013`. Le message
hebdomadaire est donc **exactement ce que la vue calcule déjà**, rendu
dans la langue du destinataire par `say()` (`server/src/i18n.js`). Aucune
seconde définition du digest ne sera écrite.

### 4.7 Ce qui manque en base

**Migration 018 — le centre.**

```sql
ALTER TABLE notification ADD COLUMN read_at     timestamptz;
ALTER TABLE notification ADD COLUMN acted_at    timestamptz;
ALTER TABLE notification ADD COLUMN severity    text NOT NULL DEFAULT 'info'
       CHECK (severity IN ('info','attention','urgent'));
ALTER TABLE notification ADD COLUMN group_key   text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN locale      text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN channel     text NOT NULL DEFAULT 'courriel';
ALTER TABLE notification ADD COLUMN on_behalf_of text REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE notification ADD COLUMN expires_on  date;      -- G-13
-- le vocabulaire s'élargit aux genres nouveaux et à ceux qui attendaient
-- un émetteur : site-quiet, timesheet-missing, evidence-unreachable
CREATE INDEX notification_unread_idx ON notification(user_id, read_at, at DESC);
```

**Migration 019 — l'abonnement.** La table `notification_subscription`
ci-dessus, plus `app_user.quiet_from` / `quiet_to`. La préférence globale
`notify_pref` est **conservée** comme valeur par défaut d'un compte sans
abonnement : elle cesse d'être un mensonge sans devenir une rupture.

**Migration 020 — le canal sortant.** `notification_channel` (portée,
adresse, actif, dernier échec) et le réglage `notifyHosts`, fermé par
défaut.

**Le balayage doit enfin s'exécuter.** Un `setInterval` horaire à côté de
`sweepSessions` dans `server/src/index.js:205`, gardé par un verrou
consultatif PostgreSQL pour qu'une seconde instance ne double pas les
messages. `POST /admin/notifications/sweep` reste, comme commande
manuelle et comme moyen d'observation.

### 4.8 Ce que le centre aggrave s'il arrive seul

Le comité refuse de proposer cette capacité sans la charge qui va avec.

`notification` conserve le courriel du destinataire, le sujet **et le
corps**, sans purge. Le constat G-13 l'a relevé et exige une purge
programmée avec un compteur consultable de ce qu'elle a supprimé. Un
centre de notification multiplie le volume de cette table par un facteur
que personne ne sait borner d'avance.

**La purge n'est donc pas une suite de N-05 : elle en fait partie.** La
colonne `expires_on` est dans la migration 018 pour cette raison, et le
lot n'est pas livrable sans son balai. Le comité ajoute la seule chose
qu'il puisse ajouter : la durée est **une décision du mandant**, pas de
l'ingénierie, et le code ne l'inventera pas — sans durée écrite, la purge
refuse de s'exécuter et le dit, sur le patron de `documentHosts`.

### 4.9 Mesure de valeur

Quatre chiffres, sur l'écran d'adoption d'A-08, par site et par mois.

1. **Part des notifications lues sous 72 heures.** C'est la mesure de
   pertinence. Sous 50 %, le centre est du bruit.
2. **Part des actions closes dont la dernière ouverture vient du centre.**
   C'est la mesure d'utilité : le centre a-t-il causé un acte, ou
   seulement rapporté un fait ?
3. **Messages sortants par compte actif et par semaine.** Un **plafond
   décidé d'avance** : au-delà de dix, le comité considère que le réglage
   a échoué et fait baisser les seuils, il ne demande pas aux gens de
   mieux filtrer.
4. **Nombre de désabonnements.** C'est le seul indicateur du lot qui peut
   dire non, et c'est pour cela qu'il est là.

---

## 5 · Les autres capacités retenues

Le mandat en autorisait quatre. Le comité en avait cinq et en garde
**trois**. Les deux écartées le sont pour la même raison, et elle est
d'ordre : *nommer un référent local par site* appartient à la réserve
A-12 du comité d'adoption, et *détecter le silence d'un site*
est déjà un des six indicateurs d'A-08 — son alerte devient un genre de
N-05, pas une capacité de plus. Un comité qui reprend à son compte le
travail d'un autre ne filtre rien : il gonfle.

### N-06 — La survie hors ligne, en lecture seule

**Constat.** Le §2 le dit : aucun cache, aucun agent de service. Quand la
liaison satellite tombe — ce qui, à Houndé, se produit — l'écran est
vide. Le responsable informatique de site a formulé le besoin sans
ambiguïté : il ne demande pas à écrire hors ligne, il demande à
**pouvoir encore lire ce qu'il savait il y a une heure**.

**Proposition.** Le livre d'amorçage est déjà petit — le rapport de
non-régression R-08 mesure environ 16 Ko gzippés au transfert initial. Il
est persisté à chaque chargement réussi, sous une clé portant
l'identifiant du compte. Si le chargement échoue, l'application rend
l'instantané, avec **un bandeau permanent qui nomme l'heure** et
**aucune commande d'écriture dessinée** — la même fonction `mayWrite`
rend faux, la règle R7.3 fait le reste sans code nouveau.

**Ce qu'elle ne fait pas, et pourquoi.** Aucune écriture n'est mise en
file hors ligne. Deux raisons, l'une et l'autre suffisantes : la
concurrence du produit repose sur `row_version`, qui ne peut pas être
honorée contre un livre qu'on n'a pas relu ; et une écriture rejouée plus
tard porterait sur la piste un horodatage qui n'est pas celui de l'acte.
Le comité préfère un outil qui refuse honnêtement à un outil qui promet
une synchronisation qu'il ne peut pas garantir.

**Une précaution que le comité d'adoption a rendue obligatoire.** A-03 a
constaté que `localStorage` sur un poste partagé de salle de conduite
suit tout le monde. L'instantané est donc effacé à la déconnexion et au
changement de compte — sur le patron déjà écrit pour le cache de vue
(`web/src/views/index.js:115-118`, où toute la carte est jetée quand le
livre ou le compte change).

**Coût.** Environ 60 lignes client, aucune migration, aucune route.

**Mesure.** Part des sessions de site qui rencontrent au moins un
chargement en échec, et — la mesure qui compte — nombre de sessions qui
se poursuivent après cet échec au lieu de s'arrêter. Sous 5 % de sessions
concernées sur un trimestre, la capacité est retirée : elle aurait résolu
un problème qui n'existe pas.

### N-07 — Le contrôle de vie de la preuve

**Constat.** Il ne vient pas du comité : il vient de la recette. Le mode
résiduel R-01 nomme explicitement le cas « l'hôte de confiance héberge
des liens morts », le note RPN 32, et l'accepte faute de détection. Un an
plus tard, un jalon franchi s'appuie sur une preuve dont personne ne sait
si elle répond encore. `014_evidence.sql` fige l'empreinte de l'URI à
l'approbation ; il ne vérifie jamais que l'URI répond.

**Proposition.** Une sonde périodique, portée par le même ordonnanceur
que le balayage : une requête `HEAD` sur l'URI de chaque document
approuvé, **et uniquement vers des hôtes déjà présents dans
`documentHosts`**. Ce n'est donc pas un flux sortant nouveau : c'est
celui que le mandant a déjà autorisé, exercé dans l'autre sens.

Migration 022, colonnes sur `document` : `probed_at`, `probe_status`,
`probe_state ('ok','unreachable','forbidden','never')`.

**La garantie qui compte.** La sonde **ne change jamais le statut du
document**. Une coupure réseau ne doit pas désapprouver un jalon. Elle
produit un fait affiché en bibliothèque et, après trois sondes
consécutives en échec, un message `evidence-unreachable` au chef de
projet par le centre du §4. Le jugement reste humain, comme partout
ailleurs dans ce produit.

**Coût.** Environ 80 lignes, une migration, un genre de message.

**Mesure.** Part des preuves de jalon approuvées dont le lien a répondu
dans les trente derniers jours. Cible 100 %. **Le chiffre du premier
passage est le plus intéressant du lot**, et le comité recommande de le
consigner tel quel.

### N-08 — L'enseignement attaché à la vague

**Constat.** `rollout_wave` porte un `seq` : la même chose se fait
jusqu'à huit fois, dans l'ordre. Rien ne transporte ce que la vague
précédente a appris. Le registre RAID retient les risques ouverts ; une
fois clos, ils ne disent plus rien à personne.

**Proposition, et sa forme est tout le sujet.** Migration 023, table
`wave_lesson` : ce qui s'est passé, ce qu'il faut faire autrement, qui
l'a consigné. Écrite à la clôture d'une vague, obligatoire pour la
clôturer. Aucune action d'autorité nouvelle : `wave.write` existe déjà
(`shared/rbac.js:349`).

**Le sceptique a attaqué, et il avait raison.** Un registre
d'enseignements est l'artefact le plus créé et le moins lu de l'histoire
des bureaux de projet. Le comité ne le retient donc **que sous une forme
qui interdit la bibliothèque** : l'enseignement de la vague `seq = n` est
présenté à l'ouverture de la vague `seq = n+1` du même projet, sur son
écran, au moment où il sert. Il n'y a pas d'écran « enseignements », et
il ne doit pas y en avoir. *Un enseignement qui vit dans une bibliothèque
n'est pas un enseignement, c'est une archive.*

**Coût.** Une migration, environ 120 lignes, deux formulaires.

**Mesure.** Part des vagues de rang ≥ 2 ouvertes après consultation
consignée de l'enseignement de la précédente — mesurable parce que la
consultation se trace en un appel (`noteConsultation`,
`routes/portfolio.js:2549`, motif R-14). Sous 50 % au deuxième
trimestre, l'obligation de saisie est **levée**, pas renforcée : on ne
répare pas une lecture manquante par une écriture de plus.

---

## 6 · Ce que le comité rejette

Cinq idées. Les trois premières sont séduisantes, réclamées ailleurs, et
mauvaises ici.

**X-01 — L'assistant conversationnel sur le portefeuille (« posez une
question à vos données »).** Rejeté. Deux motifs, chacun suffisant. Le
premier : un modèle qui compose un chiffre entre en concurrence avec
`shared/engine.js`, qui est gelé, testé à 271 tests et opposable ; deux
sources pour le même chiffre n'est pas une fonctionnalité, c'est un
défaut de gouvernance, et le contrôle de gestion a été formel. Le second :
le périmètre. `projectScopeSql` (`shared/rbac.js:434`) est testable parce
qu'il est écrit ; une requête engendrée à la volée ne l'est pas, et le
balayage à 286 cas × 4 rôles perdrait son sens le jour où la requête
n'est plus dans le dépôt. Ce qui reste utile dans cette idée — savoir où
regarder — est retenu autrement, en N-04.

**X-02 — Le résumé du dossier de preuve par l'IA.** Rejeté. Un pack de
preuves vaut par son exhaustivité et sa reproductibilité ; il porte
d'ailleurs sa propre phrase de garantie en pied de page. Un résumé qui
omet est pire qu'aucun résumé, parce que son lecteur croira avoir lu. Et
l'auditeur qui reçoit le résumé devra relire le pack de toute façon —
donc le résumé n'aura fait perdre du temps qu'à celui qui l'a produit.

**X-03 — Le compte rendu de séance rédigé par l'IA.** Rejeté, et c'est le
rejet dont le comité est le plus sûr. `renderMinutes`
(`shared/meetings.js:410`) écrit déjà le compte rendu depuis l'ordre du
jour gelé, les décisions et les actions. Ce qu'un modèle ajouterait est
la seule chose qui manque : le **motif** d'une décision dont le motif n'a
pas été consigné. Or `meeting_decision.rationale` vide est un signal
honnête — il dit que personne n'a écrit pourquoi. Le remplir par
inférence, c'est fabriquer une justification a posteriori dans le
registre des décisions d'un groupe minier. Le comité ne veut pas savoir
ce que cela donne devant un auditeur.

**X-04 — La notation assistée de la priorisation.** Rejeté par
cohérence. La réserve A-06 du comité d'adoption reproche déjà à la
formule `fit + value + (6 − risk) + (6 − effort)` (`shared/engine.js:433-438`)
de n'être expliquée nulle part, et pose la phrase : *un arbitrage
budgétaire qu'on ne sait pas expliquer n'est pas un arbitrage, c'est un
verdict.* Faire noter le modèle rendrait la formule inexplicable au lieu
de l'expliquer. La bonne réponse à A-06 est A-06.

**X-05 — L'intégration Teams native, et la notification poussée mobile.**
Rejetées. La première ajoute une inscription d'application, un secret de
plus, une dépendance à un locataire dont la reprise n'est décrite nulle
part (G-16) et un tiers de plus à évaluer — pour obtenir ce qu'un POST
HTTPS obtient déjà (§4.4). La seconde suppose une application mobile qui
n'existe pas et dont personne n'a demandé la construction.

---

## 7 · Plan de version

L'ordre suit ce qui est prêt et ce qui ne dépend de personne, comme le
comité InfoSec/GRC a ordonné ses vagues par le dommage plutôt que par la
difficulté.

### Vague 0 — préalable, hors périmètre de ce comité

G-01, G-03, G-04, G-13. Rien ne commence avant.

### R2 — prêt à construire, aucune décision du mandant requise

| Lot | Contenu | Base |
|---|---|---|
| **R2-a** | **N-05 · le centre de notification** — le centre, les abonnements, la cadence enfin honorée, le regroupement, le silence de nuit, l'escalier, l'ordonnanceur, le retour de suppléance, **et la purge de G-13 qui en fait partie** | 018 · 019 |
| **R2-b** | **N-07 · le contrôle de vie de la preuve** — ferme un mode résiduel accepté à la recette, et s'appuie sur un flux déjà autorisé | 022 |
| **R2-c** | **N-06 · la survie hors ligne en lecture** — aucune migration, aucune route, aucun flux | — |

Aucun de ces trois lots ne fait sortir une donnée, n'ajoute une
dépendance, ni ne demande un secret. R2-a est le plus lourd et doit être
livré d'un bloc : un centre sans purge aggrave G-13, une purge sans durée
décidée ne s'exécute pas.

Le canal sortant (migration 020) est prêt techniquement et **attend la
décision n° 4 du §8** ; il se livre en R2 si l'adresse est fournie, en
R3 sinon, sans rien changer au reste du lot.

### R3 — après décision du mandant

| Lot | Contenu | Base | Attend |
|---|---|---|---|
| **R3-a** | **N-01 + N-02 · le contrat d'assistance et les brouillons** | 021 | Décisions 1 et 2 |
| **R3-b** | **N-08 · l'enseignement attaché à la vague** | 023 | rien — placé en R3 par charge, pas par dépendance |
| **R3-c** | **N-03 · le motif qui se répète d'un site à l'autre** | 021 étendu | R3-a livré et mesuré |
| **R3-d** | **N-04 · la navigation en langage naturel** | — | A-01 et A-10 livrées |

R3-c ne commence pas avant que la mesure de R3-a ait un trimestre de
recul : si les brouillons ne sont pas repris, il n'y a aucune raison de
croire que les rapprochements le seront.

---

## 8 · Ce qui demande une décision du mandant

Quatre décisions. Aucune n'est technique, et l'ingénierie n'en inventera
aucune.

1. **Où tourne le modèle, et qui paie le matériel.** Un serveur
   d'inférence par site, un serveur au groupe, ou aucun. La position par
   défaut du comité est *par site*, pour les trois raisons du §3.6. Le
   coût est un achat unique, pas un abonnement.
2. **Si le modèle est hors du site : la fiche tiers G-16, avant
   branchement.** Données transmises, **localisation**, engagement de
   disponibilité, conditions de sortie. La règle est celle du comité
   InfoSec/GRC et le comité d'innovation la reprend sans l'adoucir : *pas
   de fiche, pas de branchement.* Un service au jeton ajoute en outre une
   facture variable que personne n'a su borner en séance.
3. **La durée de conservation de la file de notification** (G-09, G-13).
   Sans durée écrite, la purge ne s'exécute pas et le lot R2-a n'est pas
   livrable. Le rapport GRC suggère de l'aligner sur la rétention
   financière du groupe ; le comité n'a pas d'avis, il a besoin d'un
   nombre.
4. **L'adresse du connecteur sortant**, si le groupe veut le canal Teams.
   C'est un secret au sens de G-15 : dépositaire nommé, rotation.

---

## 9 · Verdict

Le comité a examiné six usages d'IA et en retient **trois et demi** : les
brouillons au champ et de statut, le rapprochement inter-sites, et la
navigation sous condition. Il en rejette deux qui étaient au mandat, et
trois autres qui s'y invitaient. Le motif est constant et tient en une
phrase : **l'IA a le droit d'écrire des phrases, jamais des nombres, et
jamais dans la base.** Les six garanties du §3.3 ne sont pas des
principes : cinq d'entre elles sont des portes de construction, et le
comité les considère comme la condition de son propre accord.

Le centre de notification est la proposition la plus prête et la plus
sûre du rapport. Elle ne demande rien au mandant sauf un nombre, ne fait
sortir aucune donnée, et répond à un constat que le comité d'adoption
avait laissé sans réponse : ce qui se passe quand un site cesse
tranquillement de se servir de l'outil.

Ce que le comité livre avec chaque proposition, et qu'il tient pour sa
contribution principale : **une condition d'arrêt écrite d'avance.** Sous
40 % de brouillons repris, la tâche est retirée. Sous une suggestion
retenue par site et par trimestre, la surface est retirée. Au-delà de dix
messages par semaine, les seuils baissent. Sous 5 % de sessions
concernées, le hors-ligne est retiré. Aucune de ces mesures ne demande un
écran nouveau : elles s'ajoutent toutes à l'écran d'adoption que la
réserve **A-08** attend déjà, et le comité recommande — comme le comité
d'adoption l'avait recommandé avant lui — **de l'installer d'abord.**

Un comité qui ne sait pas dire à quelle condition il aura eu tort n'a
rien proposé : il a fait une liste de souhaits.

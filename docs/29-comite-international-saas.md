# 29 · Comité international, SaaS et multi-tenant

**Mandat.** « S'assurer que Meridian fonctionne multi-pays, multi-site,
et jusqu'en SaaS multi-tenant ; conduire cette stratégie et livrer le
meilleur produit avec la meilleure approche ; identifier toutes les
langues à couvrir ; et s'assurer que l'application tourne sur la version
complète de PostgreSQL. » — commanditaire, 31/08/2026.

**Composition — huit sièges.** Un DSI de groupe minier présent sur trois
continents · un architecte SaaS qui exploite une flotte de 400 instances ·
une juriste protection des données (transferts internationaux) · un
directeur financier de filiale (devises, consolidation) · une traductrice
professionnelle spécialisée en gouvernance de projet · un exploitant
d'infrastructure · le porteur produit ([`23`](23-comite-produit.md)) · un
membre du comité GRC ([`20`](20-comite-infosec-grc.md)).

---

## 1 · Ce qui est déjà vrai, vérifié dans le schéma

Le comité a commencé par l'inventaire, parce qu'un plan qui redemande ce
qui existe est un plan qui n'a pas lu :

| Capacité | Où, vérifié |
|---|---|
| Fuseaux horaires par site | `site.tz_offset` + `tz_name` depuis 001 ; le silence de nuit des notifications les honore |
| Devises multiples à la saisie | `cost_line.currency` + `fx_rate` **au moment de l'écriture** (012) — le taux est figé, jamais recalculé |
| Bilingue EN/FR intégral | 986 entrées, porte F5 qui échoue sur un libellé manquant, `X-Lang` côté serveur |
| Condition légale par pays | G-14 : aucun site n'active la saisie du temps sans avis social et juridique de SON pays |
| Autorité par site et par programme | tout le modèle d'accès (R1.*) |
| Portabilité des données d'un tenant | l'archive et `npm run restore` (M-01) |

Ce qui manque réellement : le **pays** d'un site (la colonne `region` est
du texte libre), l'entité légale qui le porte, plus de deux langues, et
toute la couche d'exploitation multi-instance.

---

## 2 · La décision de fond : comment être multi-tenant

C'est la décision la plus lourde du mandat, et le comité l'a prise en
premier parce que tout le reste en découle. Trois voies existent.

**Voie A — la colonne `tenant_id` partout.** Le SaaS classique : une
base, toutes les données de tous les clients, une colonne de
discrimination sur chaque table et une clause `WHERE` sur chaque requête.
**Refusée, et fermement.** Ce produit vend une piste d'audit inaltérable
à des groupes industriels qui sont parfois concurrents. Dans la voie A,
**une seule clause `WHERE` oubliée montre le portefeuille d'un groupe
minier à un autre** — et ce produit compte aujourd'hui plus de quarante
tables et des centaines de requêtes. La porte qui vérifierait cela
n'existe pas encore, et le jour où elle raterait, le produit serait mort.
L'isolation par discipline de code n'est pas une isolation.

**Voie B — un schéma PostgreSQL par tenant.** Meilleure isolation, mais
le pire des deux mondes en exploitation : un cluster partagé dont chaque
migration se rejoue N fois, des sauvegardes enchevêtrées, et une montée
de version qui casse pour tous en même temps.

**Voie C — une instance par tenant.** Un processus et une base par
client, orchestrés derrière un proxy. **C'est la voie retenue**, et pas
par prudence : parce que ce produit est déjà construit pour elle, sans
l'avoir su.

- Le binaire est **un seul fichier** qui applique ses migrations au
  démarrage : provisionner un tenant, c'est démarrer un processus.
- L'archive M-01 est **la portabilité du tenant** : un client entre, sort
  ou change d'hébergement avec un fichier ouvert.
- La devise de restitution, les seuils, les hôtes de confiance sont des
  réglages d'instance — en voie C, **chaque groupe a les siens**, ce qui
  est exactement ce qu'un groupe multi-pays exige. En voie A il aurait
  fallu tout re-ventiler.
- L'isolation est celle du système, pas celle d'une clause `WHERE` : un
  défaut d'application ne peut pas traverser deux bases.
- La montée de version se déploie **tenant par tenant** — on vient de
  vivre pourquoi cela compte : la migration 023 appliquée sous un binaire
  plus ancien aurait couché le service.

> **Le SaaS de Meridian n'est donc pas une réécriture du produit : c'est
> un métier d'exploitation d'une flotte d'instances.** Ce qui doit être
> construit est la couche de flotte — provisionner, superviser, monter de
> version, sauvegarder — et les quelques affordances que le produit doit
> offrir pour être exploitable en flotte. C'est le registre SaaS-*.

Le coût assumé : une instance par client coûte plus cher qu'une ligne
dans une base mutualisée. Le comité l'assume à voix haute — l'acheteur
visé est un groupe à 45–85 k€/an ([`24`](24-comite-marche.md) §5), pas un
libre-service à 9 €/mois. À ce prix, l'isolation réelle est un argument
de vente, pas un coût.

---

## 3 · PostgreSQL complet — l'instruction du commanditaire, et sa forme

Le commanditaire demande que l'application tourne sur la version complète
de PostgreSQL. L'état des lieux : l'installateur Windows provisionne déjà
PostgreSQL 17 (téléchargement EDB, initdb, service, rôle et mot de passe
générés) et la production de cette machine tourne dessus. PGlite —
PostgreSQL compilé en WebAssembly — reste le moteur de la démo, du
terrain d'entraînement et des tests.

Le comité transforme l'instruction en règle vérifiable plutôt qu'en
intention :

1. **PGlite est un moteur d'essai, jamais un moteur d'exploitation.**
   Mono-connexion, sans sauvegarde à chaud, fragile aux arrêts brutaux —
   trois propriétés inacceptables pour un livre de gouvernance.
2. **Une installation de service REFUSE de démarrer sur PGlite.** Le
   paquet pose `MERIDIAN_REQUIRE_POSTGRES=1` dans la configuration du
   service ; un démarrage sans `DATABASE_URL` échoue alors avec un
   message qui dit quoi faire, au lieu de fonctionner en silence sur le
   mauvais moteur. C'est la ligne PG-01 du registre, livrée avec ce
   rapport.
3. `/api/health` dit déjà le moteur ; la flotte SaaS s'en servira pour
   alerter sur toute instance qui n'est pas sur PostgreSQL.

---

## 4 · Les langues

La traductrice du comité a posé la question dans le bon ordre : **pas
« quelles langues », mais « quel mécanisme »**. Un produit qui code sa
liste de langues en dur paie chaque ajout au prix fort — et c'est
exactement l'état actuel : le commutateur est un booléen EN/FR, et la
base contraint `locale IN ('','en','fr')`.

**Décision 1 — le registre de langues d'abord.** Ajouter une langue doit
être : un dictionnaire, une entrée dans un registre, rien d'autre. C'est
la ligne I18N-01, livrée avec ce rapport.

**Décision 2 — les langues, par la géographie réelle du marché cible.**
Les groupes miniers et industriels multi-sites opèrent où ils opèrent :

| Priorité | Langue | Pourquoi |
|---|---|---|
| livré | **anglais, français** | le groupe pilote (Afrique de l'Ouest) et la lingua franca |
| 1 | **espagnol** | Pérou, Chili, Mexique, Argentine — le premier bassin minier mondial hors anglophonie |
| 2 | **portugais** | Brésil, Mozambique, Angola |
| 3 | arabe | Afrique du Nord, Moyen-Orient — **différé avec raison** : l'écriture droite-à-gauche est un chantier d'interface entier (miroir de la mise en page, tableaux, graphiques), pas un dictionnaire. L'annoncer avant de savoir le faire serait le mensonge que ce produit s'interdit partout ailleurs |
| 4 | russe, chinois | Asie centrale, financements — à la demande d'un client réel, pas avant |

**Décision 3 — la politique de traduction, écrite.** Le vocabulaire de la
gouvernance ne se traduit pas mot à mot (« baseline », « tolerance »,
« earned value » ont des équivalents normatifs par langue — ISO 21502 est
publiée en espagnol). Une traduction produite par machine ou par IA est
acceptée **comme brouillon**, marquée comme telle dans le registre des
langues, et une langue ne perd cette marque qu'après relecture par un
locuteur natif du métier. L'interface peut afficher une langue en
brouillon ; elle le dit.

**Décision 4 — le serveur suit.** `X-Lang` et `say()` existent ; les
refus d'autorité sont déjà bilingues. Chaque langue ajoutée couvre aussi
ces messages — un refus est le pire moment pour changer de langue.

---

## 5 · Le registre

Mêmes règles que les registres 26 et 27 : chaque ligne dit ce que son
absence coûte.

| # | Ligne | Ce que ça coûte aujourd'hui | Effort |
|--:|---|---|---|
| **PG-01** | **Le service refuse PGlite.** `MERIDIAN_REQUIRE_POSTGRES=1` posé par l'installateur ; démarrage refusé avec message. | Une installation mal configurée tourne EN SILENCE sur un moteur mono-connexion sans sauvegarde — et on le découvre le jour où on en a besoin | **LEVÉE 31/08** — démarrage réel refusé, sortie 1, message qui nomme DATABASE_URL ; l'installateur pose le drapeau, le repli PGlite le retire |
| **I18N-01** | **Le registre de langues.** La liste des langues devient une donnée ; le commutateur devient un cycle ; la contrainte en base s'élargit. | Chaque langue coûte une chirurgie au lieu d'un dictionnaire | **LEVÉE 31/08** — registre LANGS + DICTS, commutateur en cycle, contrainte de forme en base (027), serveur SERVER_LANGS ; exercé au navigateur : FR→EN cycle, html lang suit |
| **MC-01** | **Le pays et l'entité légale du site.** Code pays ISO 3166, entité juridique porteuse. | G-14 exige un avis « de son pays » et le produit ne sait pas dire le pays d'un site ; une demande RGPD ne sait pas dire quelle entité répond | **LEVÉE 31/08** — migration 027, formulaire, « br » remis en BR, entité enregistrée par le vrai dialogue |
| ~~**I18N-02**~~ **LEVÉE 01/09** | **L'espagnol.** Dictionnaire client 1053/1053 + fragments 47/47 (parité tenue par la porte F5, devenue multilingue) + refus et notifications serveur (`i18n-es.js`, `es` au SERVER_LANGS). **Brouillon jusqu'à relecture native** — le drapeau `(draft)` reste au commutateur, et la relecture est une ligne ouverte, pas un souvenir. | Le premier bassin minier hors anglophonie ne peut pas déployer | 2 j |
| **I18N-02b** | **Relecture native de l'espagnol.** Un locuteur natif relit les 1053 entrées et les 47 fragments sur un vrai déploiement ; le drapeau `draft` tombe à cette relecture, pas avant. | Une traduction d'assistant non relue peut enseigner un faux terme à tout un site | 1 j, avec un vrai client |
| **I18N-03** | **Le portugais.** Même règle. | Brésil, Mozambique, Angola | 2 j |
| **MC-02** | **Formats locaux.** Dates et nombres au format de la langue affichée (les libellés de mois sont anglais en dur). | « 03/04 » se lit dans deux ordres selon le lecteur — sur un jalon, c'est un incident | 2 j |
| **SaaS-01** | **Premier démarrage sans console.** Une instance neuve accueille son premier administrateur par l'écran (aujourd'hui : `admin-handover` en ligne de commande). | Provisionner un tenant exige un accès shell — inacceptable en flotte | 3 j |
| ~~**SaaS-02**~~ **LEVÉE 31/08** | **Garde de décalage de version.** Le binaire refuse une base portant des migrations plus récentes que lui. | Le piège 023 vécu ce matin : un vieux binaire sur une base neuve échoue requête par requête au lieu de refuser net | ½ j |
| **SaaS-03** | **Sauvegarde par instance, éprouvée.** `pg_dump` orchestré + restauration chronométrée. | C'est G-01, toujours ouvert — bloquant AVANT tout client externe, pas après | 2 j + exploitation |
| **SaaS-04** | **Identité d'instance dans `/api/health`** (nom du tenant, moteur, migrations) pour la supervision de flotte. | Une flotte sans identité se supervise à l'aveugle | ½ j |
| **SaaS-05** | **Dossier d'exploitation flotte.** Proxy, TLS, provisionnement, montée de version tenant par tenant, gabarits. | Chaque déploiement réinvente ; les erreurs sont neuves à chaque fois | 3 j, documentaire |

**Ordre.** PG-01, I18N-01 et MC-01 sont livrés avec ce rapport. Ensuite,
dans la boucle [`28`](28-goal-market.md) et en respectant son alternance :
SaaS-02 (le piège est encore chaud), I18N-02, SaaS-04, MC-02, I18N-03,
SaaS-01, SaaS-03, SaaS-05.

---

## 6 · Ce que le comité refuse

- **La colonne `tenant_id`** — voir §2. Ce refus est architectural et ne
  se rediscute qu'avec un argument que le §2 n'a pas déjà pesé.
- **Annoncer l'arabe avant de savoir faire du droite-à-gauche.**
- **Traduire les noms d'écrans à moitié.** Une langue entre au registre
  complète (interface, aides, manuel, refus serveur) ou pas du tout — le
  tour 1 de la boucle de re-test a déjà montré ce que coûte un dictionnaire
  qui suit en retard (170 libellés manquants masqués par le repli).
- **Un « mode multi-devises » de restitution.** La devise de restitution
  reste UNE par instance ; les écritures portent déjà leur devise et leur
  taux. Consolider en plusieurs devises de restitution est un métier de
  consolidation financière, pas de gouvernance de projet — un
  export vers l'outil de consolidation (INT-05/INT-11) est la bonne
  frontière.

---

## 7 · Ce que ce rapport ne prétend pas

Il ne prétend pas que « multi-tenant » soit fini quand ses lignes seront
closes : la couche de flotte (SaaS-05) est un métier d'exploitation qui
se prouve en exploitant, pas en livrant. Et il ne prétend pas qu'une
langue soit « couverte » parce qu'un dictionnaire existe — la marque
« brouillon » ne se lève que par un locuteur natif, et le comité tiendra
cette ligne même si elle retarde une vente.

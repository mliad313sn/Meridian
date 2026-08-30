# 25 · La réversibilité, et la porte qui manquait

**Lot livré dans la nuit du 30 au 31 août 2026.** Origine : la ligne
« obstacle 3 » du comité de marché ([`24`](24-comite-marche.md) §6) et les
lignes 21, 34 et 35 du carnet arbitré ([`23`](23-comite-produit.md) §3).

---

## 1 · Ce qui a été fermé

| Origine | Constat | État |
|---|---|---|
| **S-17** ([`21`](21-campagne-securite.md)) | Un compte de niveau groupe pouvait animer la série de n'importe quel site | **fermé**, 4 tests |
| **S-14** ([`21`](21-campagne-securite.md)) | Le jeton de session était stocké en clair | **fermé**, migration 023 |
| **S-15** ([`21`](21-campagne-securite.md)) | Un seul compteur de connexion, sur la paire identité+adresse | **fermé**, 4 tests |
| **M-01** ([`24`](24-comite-marche.md) §6) | Aucun export de la piste, aucun chemin de réimport | **fermé**, 7 tests |
| **F7** (constaté ici) | L'écran d'administration ne se dessinait pas | **fermé**, porte ajoutée |

**G-10** (ligne 12 du carnet) était déjà livré côté serveur et sans écran :
le contrôle existe désormais.

---

## 2 · S-17 — une suppléance de groupe n'est pas une clé du bâtiment

`shared/rbac.js` décidait, pour un périmètre de site :

```js
// A group user may run a site's series only where that site hosts a
// project in one of their programmes — checked by the route, which
// has the project list; here we allow and let the route narrow.
return user.role === "group";
```

Le commentaire décrivait un contrôle. **Aucune route ne l'a jamais
exercé.** Tout compte de niveau groupe pouvait donc ouvrir, animer et
clore la séance hebdomadaire de n'importe lequel des huit sites — y
compris ceux où son programme n'a pas une ligne de travail.

Le correctif ne déplace pas la décision dans la route : il fait voyager
avec la série le fait qui manquait — les programmes réellement hébergés
par ce site — de sorte que `rbac.js` reste le seul endroit où l'autorité
se décide.

Et le refus est **fermé par défaut** : un périmètre qui arrive sans la
liste est refusé, jamais accordé. Si une requête future oublie
l'agrégat, la salle se verrouille au lieu de s'ouvrir. C'est l'inverse
exact du défaut qu'on vient de corriger, où l'absence de contrôle valait
autorisation.

---

## 3 · S-14 — le mot de passe était haché, le jeton ne l'était pas

Un jeton de session ouvre les mêmes portes qu'un mot de passe pendant
douze heures. Il était conservé tel qu'il voyage dans le cookie. Une
sauvegarde égarée, un export de diagnostic, un `SELECT *` collé dans un
ticket : on tenait des sessions utilisables sans avoir jamais connu un
mot de passe.

La colonne est **renommée** `token_hash`, pas réutilisée. C'est le point
de conception : un appel non converti échoue alors bruyamment sur une
colonne inconnue, au lieu de comparer silencieusement une empreinte à un
jeton et de ne rapprocher personne — une panne d'authentification se
voit, une comparaison qui ne trouve jamais rien se voit aussi, mais trop
tard et dans le mauvais sens.

SHA-256 et non scrypt : l'entrée fait 32 octets tirés du CSPRNG, il n'y a
aucun dictionnaire à ralentir, et ceci s'exécute à chaque requête.

---

## 4 · S-15 — la paire qu'un attaquant n'a pas besoin de garder constante

Le compteur d'origine était clé sur **identité + adresse**. Deux attaques
ordinaires ne l'atteignent jamais :

- **le balayage** — une tentative sur chacun des deux cents comptes de
  l'annuaire, depuis une seule adresse : aucune paire ne dépasse 1 ;
- **la devinette répartie** — un compte, un essai par adresse depuis un
  parc loué : aucune paire ne dépasse 1 non plus.

Trois compteurs désormais : la paire (10), l'identité seule (20),
l'adresse seule (60).

**Le seuil par adresse est haut à dessein.** Huit sites miniers
atteignent ce serveur par une poignée de passerelles, et tout le monde y
partage une adresse : un seuil serré serait un déni de service qu'un
attaquant serait ravi de déclencher. Soixante échecs en quinze minutes
depuis une adresse n'est pas un lundi matin difficile — et cela laisse
quatre essais par minute contre scrypt, ce qui n'est pas une attaque.

Une connexion réussie efface les compteurs de la personne, **jamais celui
de l'adresse** : sinon un seul compte valide derrière la même passerelle
effacerait la trace des échecs de tous les autres.

> **Constat sur nous-mêmes.** C-06 — la limite de connexion — était
> déclarée *bloquante de livraison* par le comité, et n'avait **aucun
> test**. Elle en a quatre.

---

## 5 · M-01 — « et dans trois ans ? »

C'est la question que le comité de marché a posée et à laquelle aucun des
vingt-quatre rapports précédents ne répondait. La moitié de la réponse
existait : CSV de portefeuille, dossier de preuve, JSON du livre. Il
manquait les deux moitiés qui comptent — **la piste d'audit**, qui est ce
qu'un auditeur vient chercher, et **un chemin de retour**, sans lequel un
export n'est qu'un fichier.

```bash
# à l'écran : Administration → Continuité → « Exporter l'archive »
# en ligne de commande, chez le repreneur :
npm run restore -- meridian-archive-2026-08-31.json --open admin@exemple.com
```

### Ce que l'archive est, et ce qu'elle n'est pas

|  | archive | sauvegarde |
|---|---|---|
| Répond à | « comment tout emporter ailleurs, sans nous ? » | « comment revenir à hier soir ? » |
| Contient | le livre **et la piste**, format ouvert | tout, y compris les secrets |
| Secrets | **aucun** — ni jeton, ni empreinte de mot de passe | tous |
| Peut sortir | oui : séquestre, auditeur, successeur | non |
| Outil | `npm run restore` | `pg_dump` / `pg_restore` |

G-01 et G-02 restent donc entièrement ouverts : ce lot ne les touche pas
et ne prétend pas le faire.

Les comptes reviennent avec une empreinte `unusable` et
`must_change_password`. `--open <email>` en rouvre **un**, avec un mot de
passe tiré au sort et affiché une fois — jamais passé en argument de
commande, où il resterait dans l'historique du terminal.

### Trois choses que l'exercice réel a apprises, et que les tests taisaient

**1. Le schéma tourne en rond.** `site.champion_id → person` et
`person.site_id → site` (A-12) : aucun ordre de tables ne satisfait les
deux. L'ordre est déduit du graphe des clés étrangères, et un cycle est
rompu **sur une colonne nullable**, reposée après coup. La première
version coupait la première arête nullable venue — `access_grant.programme_id`,
qui n'est dans aucun cycle — et violait du même coup la contrainte
exigeant un programme ou un site. Une arête ne se coupe que si son parent
redescend jusqu'à son enfant.

**2. Une base « vide » ne l'est pas.** Les migrations préremplissent des
tables de référence — `id_counter` la première. La restauration entrait
en collision de clé sur une base qu'on croyait neuve. Aucun test ne
pouvait le voir : les suites partent d'un schéma migré **et semé**, jamais
d'un schéma migré seul. C'est la première reprise pour de vrai qui l'a
montré.

**3. Le comptage disait vrai et la base était inutilisable.**
`audit_event.id` est un `bigserial`. `TRUNCATE` ne remet pas les
séquences, et un `INSERT` explicite ne les avance pas : recharger 5 000
lignes d'audit dans une base neuve laisse la séquence à 1. La **première
écriture** du produit réclame alors l'identifiant 1, déjà pris, et
échoue — et comme toute mutation passe par `audited()`, **plus rien ne
s'écrit**. Un portefeuille restauré, complet, en lecture seule sans que
personne l'ait décidé.

> Le contrôle qui a manqué n'était pas un contrôle de plus : c'était le
> bon. Recompter les lignes après une reprise ne prouve rien. Le test
> écrit maintenant **dans le produit** après restauration — et remet
> volontairement la séquence au pire cas pour échouer si ce
> repositionnement disparaissait un jour.

---

## 6 · F7 — l'écran d'administration ne se dessinait pas

En allant cliquer les deux nouveaux contrôles, l'écran a répondu :

> **THIS VIEW COULD NOT BE DRAWN** — `selectField is not defined`

`web/src/views/administration.js` appelait `selectField(...)` sans
l'importer. En JavaScript ce n'est pas une erreur de construction, c'est
une `ReferenceError` levée à l'exécution de la ligne ; le `try` du rendu
l'a convertie en un écran vide. **Comptes, droits, annuaire, reprise CSV,
notifications : l'administration était impossible à ouvrir.** Depuis le
commit `fcf8fd5` — la toute première livraison du produit.

Sept comités, 322 tests, six portes et un balayage de 286 cas d'usage ne
l'avaient pas vu. La raison est nette et vaut plus que le défaut :

> **Les tests parlent à l'API. Le balayage aussi. Rien, dans tout
> l'outillage, ne dessinait une vue.**

Une porte qui mesure ce qu'on sait déjà mesurer laisse exactement ce
genre de trou. La septième porte, `npm run audit` → **F7**, prend les noms exportés par
les six modules partagés du client — `kit.js`, `api.js`, `i18n.js`,
`state.js`, `permissions.js`, `engine.js` — soit 89 noms, et vérifie que
tout fichier qui en appelle un l'a nommé dans son import. Le même oubli
sur `fmtDate` ou sur `t` casse un écran exactement de la même manière ;
une porte qui ne regarderait que `kit.js` ne l'aurait pas vu.

Elle a été éprouvée dans les deux sens : le défaut remis en place, elle
le nomme avec sa ligne ; retiré, elle se tait.

## 6bis · F8 — et puis on a dessiné les écrans

F7 ferme un cas particulier : les aides de `kit.js` employées sans
import. Elle ne dessine toujours aucune vue, et la leçon de F7 était
précisément qu'une porte qui mesure ce qu'on sait déjà mesurer laisse
le trou ouvert. **F8 ferme la classe.**

`npm run audit:views` démarre une instance, sème le livre, se connecte
sous chacun des quatre rôles, et **appelle réellement chaque vue** avec
le livre réel de ce rôle, dans un DOM réel (jsdom, en dépendance de
développement), en insérant le nœud produit dans le document. Toute
exception échoue la porte en nommant l'écran ET le rôle.

```
  · 20 écrans × 4 rôles
  · 80 rendus, aucune exception
```

Éprouvée dans les deux sens, comme F7 : le défaut historique remis en
place, elle rend quatre lignes — `admin · admin`, `admin · group`,
`admin · site`, `admin · viewer` — et se tait dès qu'il est retiré.

**Ce qu'elle ne fait pas, et qu'il ne faut pas lui prêter.** Elle ne
clique rien et ne juge aucune apparence : une vue qui se dessine peut
encore être fausse. Elle répond à une seule question — « cet écran
s'ouvre-t-il ? » — à laquelle, jusqu'à cette nuit, personne ne
répondait.

Vérifié aussi à la main, dans un vrai navigateur, avant d'écrire la
porte : les 80 rendus sous les quatre rôles. L'administration était le
seul écran cassé.

---

## 7 · État à la clôture du lot

```
tests      334 / 334
portes     8  (routes · CRUD+audit · versions · contrôles · langue · aide · imports · rendu)
migrations 023
sweep      286 cas × 4 rôles
audit deps 0 vulnérabilité
```

**Ce qui n'est pas fait, et qui ne doit pas être lu comme fait :** le
binaire de production tourne encore la version d'avant ce lot. Le paquet
corrigé est construit et attend une élévation UAC, qui demande une
présence humaine ([`13`](13-windows-service.md)).

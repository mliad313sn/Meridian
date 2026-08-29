---
description: Traiter le registre des réserves du comité indépendant (docs/16), une réserve par cycle, jusqu'à levée complète.
argument-hint: "<R-xx>  ·  ou 'suivante' pour prendre la plus grave non levée  ·  ou 'campagne' pour tout enchaîner"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /reserves — lever les réserves du comité indépendant

Tu es l'ingénieur de livraison de **Meridian IT-PMO**. Le registre à
traiter est `docs/16-comite-independant.md`. Ces réserves ne viennent pas
d'une revue de code : elles viennent d'un comité qui a **utilisé**
l'application, mesuré son comportement et comparé au besoin réel d'une
direction informatique minière multi-sites. Traite-les avec ce cadrage.

## La réserve de ce cycle

$ARGUMENTS

- **`suivante`** ou vide → prendre la réserve non levée la plus grave,
  dans l'ordre : R-01, puis R-02, R-04, R-05, R-06, puis les autres.
- **`campagne`** → les enchaîner sans me redemander entre chacune.
- **`R-xx`** → celle-là précisément.

## Ce qui ne se négocie pas

Ces contraintes viennent du produit, pas de la réserve, et aucune
correction ne les assouplit :

| Contrainte | Où |
|---|---|
| L'autorité se décide en un seul endroit, côté serveur | `shared/rbac.js` |
| Toute mutation est auditée dans sa propre transaction | `audited()` |
| Toute ligne modifiable vérifie `row_version` | `updateVersioned()` |
| L'arithmétique EVM / CPM / jalons / RAID est figée | `shared/engine.js` |
| Une migration appliquée ne se modifie jamais | `server/migrations/` |
| Le module de permissions du client **est** celui du serveur | `web/src/lib/permissions.js` |
| Une période clôturée et la piste d'audit sont en ajout seul | migrations 001, 009 |

**`npm run verify` reste vert à chaque arrêt** — 246 tests et quatre
portes d'audit. Une action transverse au portefeuille exige une branche
explicite dans le `switch` de `can()`, sinon elle retombe sur le cas
projet par défaut et se fait refuser.

## La boucle

### 1 · S'orienter

Lire la réserve **et sa preuve mesurée**. La preuve dit ce qu'il faut
mesurer de nouveau à la fin : si la réserve dit « 29 boutons sous 24 px »,
la clôture dit « 0 bouton sous 24 px », mesuré de la même façon.

### 2 · La plus petite correction qui lève réellement la réserve

Pas la plus petite qui fait disparaître le symptôme. Quand tu ajoutes une
entité ou un champ, tu dois les cinq : migration, route complète
(créer / lire / modifier / supprimer ou contre-passer), champ de
sérialiseur, champ de formulaire, test. Quatre sur cinq est exactement le
défaut que la porte `crud-audit` existe pour attraper.

### 3 · Prouver dans l'application, pas seulement dans les tests

Le comité a trouvé ce que 246 tests ne voyaient pas. Donc :

- un test nommé d'après la réserve ;
- **la mesure d'origine refaite dans le navigateur**, dans les mêmes
  conditions (rôle, taille d'écran, vue) ;
- le parcours cliqué dans chaque rôle concerné ;
- la console lue, pas seulement l'écran regardé.

Rappel de trois défauts que seuls des clics ont révélés : une sauvegarde
de boîte de dialogue qui laissait l'écran périmé, un `selectField` dont
les arguments étaient inversés, une icône inconnue qui effaçait une vue
entière. Aucun n'était visible en test.

### 4 · Clôturer la réserve

Mettre à jour `docs/16-comite-independant.md` : la réserve passe en
**LEVÉE** avec la date, ce qui a été fait, et **la nouvelle mesure**.
Une réserve sans nouvelle mesure n'est pas levée.

### 5 · Décider

- **LEVÉE** — mesure refaite, suite verte, parcours cliqué, document à
  jour. Résumé en trois lignes, puis suivante (en mode `campagne`).
- **CONTINUER** — reprendre à l'étape 2 avec ce que tu as appris.
- **BLOQUÉE** — décision qui n'appartient qu'à un humain (argent,
  identifiants, arbitrage de sécurité). Énoncer la décision, les options,
  ta recommandation. S'arrêter.
- **BUDGET** — cinq cycles sans clôture : s'arrêter et rendre compte.

## Compte rendu

```
RÉSERVE   R-xx — <une ligne>
ISSUE     LEVÉE | CONTINUER | BLOQUÉE | BUDGET
MESURE    <avant> → <après>, mesurée comment
TESTS     <passés>/<total>   BUILD <ok|échec>   PORTES <4/4>
FICHIERS  <un par ligne>
SUIVANTE  <la prochaine réserve, ou "registre levé">
```

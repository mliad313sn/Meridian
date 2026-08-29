---
description: Campagne orchestrée — lever les 15 réserves du comité indépendant phase par phase, reboucler retest/amélioration jusqu'à stabilité, puis clore par une revue AMDEC comme recette finale (UAT).
argument-hint: "vide = reprendre où la campagne en est  ·  'phase N' pour une phase précise  ·  'retest' pour la boucle seule  ·  'amdec' pour la recette finale seule"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /goal-reserves — la campagne orchestrée, la boucle, la recette AMDEC

Tu es l'ingénieur de livraison de **Meridian IT-PMO**. Cette commande est
l'orchestrateur au-dessus des cinq commandes de réserve (`/preuve`,
`/acces`, `/rotation`, `/terrain`, `/adoption`) : elle décide l'ordre,
tient l'état d'avancement, fait tourner la boucle de re-test, et termine
par la recette AMDEC. Les commandes de cluster restent la source de
vérité pour **quoi** livrer et **quelle mesure** clôt chaque réserve — ne
pas les paraphraser, les ouvrir et les suivre.

Le registre est `docs/16-comite-independant.md`. L'état d'avancement de la
campagne vit dans ce même fichier : une réserve est `LEVÉE (date, mesure
avant → après)` ou elle ne l'est pas. Il n'y a pas d'autre état.

## Ce cycle

$ARGUMENTS

- **vide** → lire `docs/16`, trouver la première phase incomplète,
  reprendre là. Ne jamais recommencer une phase déjà levée.
- **`phase N`** → exécuter cette phase seulement, puis s'arrêter.
- **`retest`** → sauter à l'ÉTAPE B (boucle de re-test) sur l'état actuel.
- **`amdec`** → sauter à l'ÉTAPE C (recette finale). Refuser si une
  réserve non levée subsiste sans acceptation écrite — la recette ne
  blanchit pas un registre ouvert.

---

## ÉTAPE A — les phases, dans cet ordre et pas un autre

L'ordre vient du comité et n'est pas négociable : la bloquante d'abord,
puis ce qui exclut des utilisateurs, puis ce qui décide de l'adoption.

| Phase | Réserves | Commande | Pourquoi cet ordre |
|---|---|---|---|
| **0** | R-01 | `/preuve` | Bloquante. Tant qu'elle tient, le comité ne recommande pas l'outil comme source de preuve. Tout le reste est du confort par comparaison. |
| **1** | R-04 · R-05 · R-06 · R-15 | `/acces` | Excluent aujourd'hui des utilisateurs (clavier, lecteur d'écran, doigt, francophones). Avant toute mise entre les mains des sites. |
| **2** | R-02 · R-11 | `/rotation` | Arrêtent les flux à la première rotation — le mécanisme le plus banal de l'exploitation. |
| **3** | R-07 · R-08 | `/terrain` | Décident si le chef de site continue de saisir. Sans lui, tout le reste devient faux sans prévenir. |
| **4** | R-03 · R-09 · R-10 · R-12 · R-13 · R-14 | `/adoption` | Ce qui manque pour que l'outil remplace l'existant au lieu de s'y ajouter. |

**Dans une phase** : ouvrir la commande de cluster, la suivre réserve par
réserve — plus grave d'abord — avec sa boucle propre (orientation, plus
petite correction réelle, preuve par test **et** mesure navigateur
refaite, clôture datée dans `docs/16`). Une réserve sans nouvelle mesure
n'est pas levée.

**Entre deux phases**, le sas — obligatoire, jamais sauté :

```bash
npm run verify     # 246+ tests, build, quatre portes — vert ou on ne passe pas
npm run sweep      # 286 cas × 4 rôles — zéro 5xx, zéro écart nouveau
```

Si le sas casse quelque chose qu'une phase précédente avait levé, la
réserve concernée **se rouvre** dans `docs/16` et se retraite avant
d'avancer. Une campagne qui avance en laissant des régressions derrière
elle ne progresse pas, elle se déplace.

**Dépendance connue** : R-13 (lignée documentaire) dépend de R-01. La
phase 4 la traite en dernier si la forme retenue en phase 0 l'exige.

**Décisions humaines** — s'arrêter en BLOQUÉE seulement pour celles-ci,
et proposer un défaut raisonnable en attendant :

- R-01 : lien vérifié ou dépôt de fichier ? Défaut recommandé par le
  comité : **lien vérifié d'abord** (liste d'hôtes en paramètre).
- R-14 : périmètre de journalisation des lectures. Défaut : consultations
  sensibles seulement (dossier de preuve, exports, registre, audit).
- Identifiants (SMTP, Entra, hôtes documentaires) : jamais inventés.
  L'absence d'identifiants ne bloque pas la phase — le comportement
  « non configuré, et le dit » est le comportement correct, testé.

---

## ÉTAPE B — la boucle de re-test et d'amélioration

Quand les cinq phases sont passées, la campagne n'est pas finie : elle est
seulement écrite. La boucle vérifie qu'elle est **vraie**, deux fois de
suite.

Un tour de boucle = rejouer TOUTES les mesures d'origine du comité, dans
les mêmes conditions, et comparer aux cibles de clôture :

| Mesure | Condition de mesure | Cible |
|---|---|---|
| Modale : focalisables atteignables derrière | boîte « jalon » ouverte | **0** (était 65) |
| Focus rendu au déclencheur à la fermeture | même boîte | oui |
| Cibles < 24 px | 375×812, pages projet/portfolio/ma semaine/réunions | **0** (était 29/61) |
| `documentElement.lang` après bascule FR | navigateur | **"fr"** |
| `h1` par vue | chaque vue | **exactement 1** |
| Vues mélangeant FR et EN | 18 vues, compte site, interface FR | **0** (était 13) |
| Bootstrap compte site | même jeu de 12 projets | **< 40 Ko** (était 90) |
| Rechargement complet après une écriture ordinaire | onglet réseau | **aucun** |
| Entrées de navigation, compte site | barre latérale | **≤ 10** (était 16) |
| Champs visibles à l'ouverture, « bénéfice » | formulaire | **≤ 5** (était 11) |
| Approbation d'un document sans artefact | API, trois rôles | **refusée** |
| Jalon franchissable sur preuve vide | moteur + API | **non** |
| Digest d'un retour de 14 jours | compte avec absence déclarée | couvre 14 j et le dit |
| Suppléant décidant sa propre demande | API | **refusé** |
| `npm run verify` · `npm run sweep` | — | vert · 0 5xx, 0 écart |

Consigner chaque tour dans `docs/16` (section « Boucle de re-test », un
tableau par tour, date + résultat par mesure).

- **Un écart** → ce n'est pas un échec de la boucle, c'est son travail :
  rouvrir la réserve, corriger via sa commande de cluster, refaire le
  tour **entier** — pas seulement la mesure qui a cassé, parce qu'une
  correction d'ergonomie peut coûter une mesure de performance et
  inversement.
- **Sortie de boucle** : **deux tours consécutifs intégralement
  conformes**. Un seul tour propre ne prouve pas la stabilité, il prouve
  la chance.
- **Garde-fou** : cinq tours sans converger → BUDGET, s'arrêter et rendre
  compte de ce qui oscille et pourquoi.

---

## ÉTAPE C — la recette finale : revue AMDEC comme UAT

La méthode qui a ouvert ce projet le referme. Quand la boucle est sortie
proprement, convoquer la grille AMDEC sur **les quinze réserves** et sur
**les quatre acquis à ne pas faire régresser** (indépendance appliquée,
piste d'audit inviolable, rythme groupe↔site, période figée).

Pour chaque ligne : **S × O × D résiduel**, à partir des mesures du
dernier tour de boucle — pas à partir du souvenir de la correction.
S ne baisse presque jamais (la gravité d'une preuve vide reste 9) ;
c'est O et D que le travail a fait baisser, et la note doit le montrer
ligne par ligne.

**Le verdict de recette, aux conditions du projet depuis le premier
jour :**

- aucun résiduel **≥ 100** ;
- rien à **S ≥ 9 avec D ≥ 7** ;
- les acceptations écrites sont permises **uniquement** pour ce qui
  attend des identifiants du sponsor (SMTP, tenant Entra, hôtes
  documentaires) — chacune nommée, motivée, datée, avec la condition qui
  la lèvera.

Livrer `docs/18-amdec-recette.md` :

1. la grille complète (réserve, mesure finale, S, O, D, RPN, comment
   clôturé — avec les valeurs avant → après) ;
2. les acquis vérifiés non régressés, chacun avec sa preuve du dernier
   tour ;
3. les acceptations écrites s'il y en a ;
4. le verdict : **RECETTE PRONONCÉE** ou **RECETTE REFUSÉE** avec la
   liste exacte de ce qui l'empêche ;
5. l'état final : nombre de tests, portes, migrations, et ce qui reste
   au carnet (les tranches nommées, jamais « divers »).

Si la recette est prononcée : reconstruire le paquet
(`npm run package:installer`), réinstaller le service, vérifier
`/api/health` et une connexion réelle, et mettre à jour `docs/16`,
l'artefact de revue et la mémoire. La recette d'un binaire qui n'est pas
celui qui tourne n'est pas une recette.

---

## Les contraintes qui ne bougent à aucune étape

| Contrainte | Où |
|---|---|
| Autorité en un seul endroit, côté serveur | `shared/rbac.js` — une action transverse exige sa branche dans le `switch` de `can()` |
| Toute mutation auditée dans sa transaction | `audited()` |
| Toute ligne modifiable vérifie `row_version` | `updateVersioned()` |
| Arithmétique EVM/CPM/jalons/RAID figée | `shared/engine.js` — étendre autour, jamais réécrire |
| Migration appliquée = intouchable | nouvelle migration numérotée |
| Périodes closes et audit en ajout seul | migrations 001, 009 |
| Permissions client = permissions serveur | `web/src/lib/permissions.js` |
| Jamais affaiblir un test pour le faire passer | — |
| Un contrôle non cliqué n'est pas livré | trois défauts de cette base n'étaient visibles qu'en cliquant |

## Compte rendu (à chaque arrêt, quel qu'il soit)

```
CAMPAGNE   phase <n>/4 · <réserves levées>/15
ÉTAPE      A (phases) | B (boucle, tour <n>) | C (recette)
ISSUE      EN COURS | BLOQUÉE | BUDGET | RECETTE PRONONCÉE | RECETTE REFUSÉE
MESURES    <écarts du dernier tour, ou « toutes conformes »>
TESTS      <passés>/<total>   BUILD <ok>   PORTES <4/4>   SWEEP <0 5xx>
DOCS       docs/16 à jour · docs/18 <état>
SUIVANT    <la prochaine action précise, ou « campagne close »>
```

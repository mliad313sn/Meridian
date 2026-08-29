# Instructions exécutables pour les réserves du comité

> **Campagne terminée le 29/08/2026.** Les quinze réserves sont **levées**
> avec mesures datées (voir la fin de
> [`16-comite-independant.md`](16-comite-independant.md)), la boucle de
> re-test est sortie sur deux tours consécutifs conformes, et la recette
> AMDEC est **prononcée** ([`18-amdec-recette.md`](18-amdec-recette.md)).
> Ce document reste la référence des commandes, désormais rejouables comme
> tests de non-régression.

Les quinze réserves de [`16-comite-independant.md`](16-comite-independant.md)
sont adressées par cinq commandes déposées dans `.claude/commands/`. Chacune
porte la **mesure d'origine** faite par le comité et la **mesure de clôture**
attendue : une réserve dont on ne peut pas refaire la mesure n'est pas levée.

| Commande | Réserves | Ce qu'elle exige |
|---|---|---|
| `/preuve` | **R-01** *(bloquante)* | Un document approuvé désigne un artefact ouvrable — lien vérifié ou fichier déposé. Le verrouillage de jalon cesse de compter les preuves vides. |
| `/rotation` | R-02, R-11 | Absences, suppléance bornée qui n'élargit jamais l'autorité, digest qui couvre réellement le temps passé loin, notifications en français et selon les préférences. |
| `/acces` | R-04, R-05, R-06 | Piège de focus réel, cibles ≥ 24 px, `lang` qui suit l'interface, un `h1` par vue. |
| `/terrain` | R-07, R-08 | Formulaires progressifs, navigation regroupée, fin du rechargement intégral après chaque écriture, chargement initial sous 40 Ko. |
| `/adoption` | R-03, R-09, R-10, R-12, R-13, R-14 | Effort réel, import CSV avec prévisualisation, export ICS, restauration depuis la piste d'audit, lignée documentaire, traçabilité des consultations sensibles. |
| `/reserves` | *toutes* | Le pilote simple : prend la réserve non levée la plus grave, ou enchaîne. |
| `/goal-reserves` | *toutes* | **L'orchestrateur de campagne** : les cinq phases dans l'ordre du comité avec un sas `verify` + `sweep` entre chacune, puis une boucle de re-test qui rejoue toutes les mesures d'origine jusqu'à **deux tours consécutifs conformes**, puis la **recette finale AMDEC** (S × O × D résiduel sur les 15 réserves et les 4 acquis, verdict dans `docs/18-amdec-recette.md`, repaquetage du service si la recette est prononcée). |

## Ordre recommandé

L'ordre n'est pas négociable sur les deux premiers points, pour des motifs
que le comité a explicités :

1. **`/preuve`** — tant que R-01 tient, le comité ne recommande pas
   Meridian comme source de preuve d'assurance. Tout le reste est du
   confort par comparaison.
2. **`/acces` puis `/rotation`** — avant toute mise entre les mains des
   sites francophones. R-04, R-05 et R-06 excluent aujourd'hui une partie
   des utilisateurs ; R-02 arrête les flux dès la première rotation.
3. **`/terrain`** — décide si le chef de site continue de saisir. Sans
   cela, la valeur, les périodes publiées et la feuille de route
   deviennent fausses sans prévenir.
4. **`/adoption`** — ce qui manque pour que l'outil remplace ce qui existe
   plutôt que de s'y ajouter.

## Pour lancer la campagne complète

```
/goal-reserves
```

Reprend où la campagne en est (l'état vit dans `docs/16` : une réserve est
LEVÉE avec sa mesure, ou elle ne l'est pas), enchaîne les phases, boucle le
re-test, et ne se déclare finie qu'à la recette AMDEC prononcée.
`/reserves campagne` reste disponible comme pilote simple, sans la boucle
ni la recette.

## Ce que ces instructions ne font pas

Elles ne rouvrent pas la conception. Les quatre acquis que le comité a
explicitement demandé de préserver — indépendance appliquée, piste d'audit
inviolable, rythme groupe ↔ site en données, période clôturée figée —
sont rappelés comme contraintes non négociables dans `/reserves` et ne
doivent être assouplis par aucune correction d'ergonomie ou de
performance.

Deux réserves supposent une décision qui n'appartient pas à l'ingénierie :
le choix entre **lien vérifié** et **dépôt de fichier** pour R-01 relève
du sponsor et de la DSI groupe ; la portée de la journalisation des
consultations (R-14) relève de la conformité.

---
description: R-07 et R-08 — la charge que l'outil impose au chef de site : navigation, nombre de champs, et poids des données sur liaison satellite.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /terrain — l'outil vu du site, pas du siège

Ces deux réserves visent la même personne : le responsable informatique de
site, qui est **la source principale des données** et celui à qui l'outil
demande le plus d'efforts pour le moins de retour immédiat. S'il cesse de
saisir, tout le reste — valeur, périodes publiées, feuille de route —
devient faux sans prévenir.

---

## R-07 · Charge de navigation et de saisie

**Mesuré.** Compte site : **16 entrées de navigation**. Profondeur à
760 × 1100 px : projet **3 écrans**, réunions **4,6 écrans**. Formulaires :
bénéfice **11 champs**, RAID **9 champs**, étape **5 champs**.

**Le principe.** Ne pas retirer de champs : la mesure de la valeur en
dépend. Rendre le chemin court **par défaut** et le reste **progressif**.

**À livrer.**

- **Formulaires progressifs** : les champs obligatoires et les deux ou
  trois qui comptent, visibles ; le reste replié derrière un « Détail »
  ouvrable, dans `formDialog` — donc une seule fois, pour tous les
  formulaires. Un champ replié reste rempli et enregistré s'il l'était.
- **Bénéfice en deux temps** : énoncer (intitulé, type, ce que le métier
  y gagne) ; chiffrer (référence, cible, unité, responsable, échéance)
  quand on les connaît. Un bénéfice sans chiffres reste un bénéfice
  déclaré — c'est déjà mieux que rien, et l'écran doit le dire.
- **Navigation regroupée** : les seize entrées se rangent derrière les
  quatre temps du métier qui existent déjà (Livrer / Contrôler /
  Gouverner / Consigner), avec les surfaces personnelles en tête. Ne pas
  inventer une taxonomie nouvelle.
- **Page projet** : ce qui est consulté chaque semaine en haut, ce qui est
  consulté chaque trimestre replié. Aucune information supprimée.

**Mesure de clôture.** Compte site : au plus **10 entrées** de premier
niveau. Bénéfice : **au plus 5 champs** visibles à l'ouverture. Page
projet : **au plus 2 écrans** avant le premier repli, à 760 × 1100 px.

---

## R-08 · Poids des données sur liaison contrainte

**Mesuré.** Sur 12 projets : `/api/bootstrap` renvoie **90 Ko** (compte
site) et **113 Ko** (administrateur), 25 collections, **rechargées
intégralement après chaque écriture**. Paquet applicatif : 274 Ko de JS.

**Ce qui est en jeu.** Un portefeuille réel se chiffre en centaines de
kilo-octets à plusieurs mégaoctets, sur une VSAT partagée avec
l'exploitation. Le rechargement complet après chaque enregistrement est le
point le plus coûteux, et il est invisible depuis le siège.

**À livrer, dans cet ordre.**

1. **Ne plus tout recharger après une écriture.** `App.write()` recharge
   le livre entier ; c'est ce qui a rendu l'application juste (l'écran ne
   montre que ce que le serveur a accepté) et il ne faut pas le perdre.
   Faire renvoyer aux routes d'écriture l'objet écrit, et ne recharger
   qu'en cas de conflit ou quand la vue dépend d'un recalcul serveur.
   **Attention** : c'est exactement l'invariant qui protégeait
   l'application des états incohérents — tout écart doit être couvert par
   un test.
2. **Compression HTTP** sur les réponses de l'API (gzip/brotli) : gain
   immédiat, aucun risque.
3. **Charger le lourd à la demande** : `ledger`, `activities` et
   `extLinks` ne servent pas aux surfaces d'accueil. Les sortir du
   chargement initial et les demander à l'ouverture des vues concernées.
4. **Mesurer, pas supposer** : consigner la charge utile avant et après,
   pour un compte site et un administrateur.

**Mesure de clôture.** Chargement initial d'un compte site **sous 40 Ko**
sur le même jeu de données, et **aucun rechargement complet** après une
écriture ordinaire — vérifié dans l'onglet réseau, pas déduit.

## La clôture

- Tests : l'invariant « l'écran ne montre que ce que le serveur a
  accepté » reste prouvé, sinon la correction n'en est pas une.
- Parcours cliqué à 375 px et à 760 px, en tant que compte **site**.
- `npm run verify` vert, quatre portes. `docs/16` mis à jour avec les
  mesures avant → après.

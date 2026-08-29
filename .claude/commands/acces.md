---
description: R-04, R-05, R-06 — accessibilité : piège de focus réel, cibles tactiles, langue du document et structure de titres. Chaque point a une mesure de clôture.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /acces — rendre vraies les promesses d'accessibilité

Ces réserves ont ceci de commun : l'application **déclare** une propriété
qu'elle n'applique pas. C'est plus grave que de ne rien déclarer, parce
qu'une aide technique fait confiance à la déclaration.

Chaque point porte la mesure faite par le comité et la mesure attendue à
la clôture. **Refaire la mesure dans le navigateur, dans les mêmes
conditions** : c'est la seule preuve acceptée ici.

---

## R-04 · La fenêtre modale n'est pas modale

**Mesuré.** Boîte « Ajouter un jalon » ouverte : 7 éléments focalisables
dans la boîte, **65 encore atteignables derrière elle**, alors que la
boîte déclare `aria-modal="true"`.

**À livrer** — dans `dialog()` de `web/src/ui/kit.js`, en un seul endroit,
puisque toutes les boîtes en dérivent :

- piéger `Tab` et `Maj+Tab` dans la boîte, en boucle ;
- rendre le reste inerte pour les aides techniques (`inert` sur le
  conteneur applicatif, ou `aria-hidden` sur ce qui n'est pas la boîte) ;
- rendre le focus à l'élément qui a ouvert la boîte à la fermeture ;
- respecter la boîte non fermable (`dismissible: false`) déjà en place
  pour le changement de mot de passe imposé — elle ne doit pas devenir
  contournable au clavier.

**Mesure de clôture.** Boîte ouverte : **0** élément focalisable
atteignable hors de la boîte ; après fermeture, `document.activeElement`
est le bouton d'origine.

---

## R-05 · Cibles tactiles sous le minimum

**Mesuré.** À 375 × 812 px, page projet : 61 boutons visibles, dont **29
sous 24 × 24 px** — échec du critère WCAG 2.2 § 2.5.8 (AA) — et les 61
sous 44 px.

**À livrer.** Une taille minimale garantie sur les commandes, en CSS, sans
casser la densité des tableaux sur grand écran : viser la règle plutôt que
retoucher les boutons un par un. Les commandes `btn-xs` en fin de ligne de
tableau sont les principales fautives ; augmenter leur zone cliquable
(remplissage ou pseudo-élément) plutôt que leur encombrement visuel.

**Mesure de clôture.** À 375 px, sur les pages projet, portefeuille,
« Ma semaine » et réunions : **0 commande sous 24 × 24 px**. Le comité
retient 24 px comme seuil de conformité ; 44 px reste l'objectif de
confort pour un usage au doigt en tournée, à viser là où c'est possible.

---

## R-06 · La langue du document ne suit pas l'interface

**Mesuré.** Après bascule en français, l'interface est en français
(« LIVRER · Ma semaine · Portefeuille ») et
`document.documentElement.lang` vaut toujours `"en"`. Un lecteur d'écran
prononce alors le français avec la phonétique anglaise. Par ailleurs :
**0 `h1`** sur la page — la structure de titres commence à `h2` et la
navigation par titres n'a pas de point d'entrée.

**À livrer.**

- `setLang()` pose `document.documentElement.lang` ; l'amorçage le pose
  aussi, avant le premier rendu ;
- un `h1` unique par vue, portant le titre de la vue (il existe déjà dans
  `TITLES`) — visible ou masqué visuellement, mais présent ;
- vérifier au passage que le titre du document (`<title>`) suit la vue et
  la langue : c'est ce qu'annonce un lecteur d'écran au changement de page.

**Mesure de clôture.** Après bascule : `lang === "fr"`, exactement **1
`h1`** par vue, et le titre du document change avec la vue.

---

---

## R-15 · Le français est mélangé à l'intérieur d'un même composant

**Mesuré.** Interface en français, compte `site` : **13 vues sur 18**
contiennent des fragments anglais — réunions **16**, rapports **9**,
documents **8**, changements **5**. Sur le portefeuille, dans une même
tuile : « VALEUR DU PORTEFEUILLE · $1.80M · *1 funded project* ».

**À livrer.** Les **notes** des tuiles et les fragments composés
(« 0 green · 1 amber · 0 red », « spending faster than earning »,
« against $1.80M approved ») passent par `t()` au même titre que les
intitulés. Commencer par réunions, rapports, documents et changements :
c'est là que se concentre le mélange.

Pour les fragments qui portent un nombre, ne pas concaténer des morceaux
traduits — le français n'ordonne pas comme l'anglais. Passer par une
entrée de dictionnaire complète avec sa valeur insérée.

**Mesure de clôture.** Une vérification automatique — à ajouter aux portes
d'audit — qui ouvre chaque vue en français et **échoue si une vue mélange
les deux langues**. Sans elle la régression reviendra au prochain écran
ajouté. Cible : **0 vue sur 18**.

---

## Portée

Ne pas transformer ceci en refonte visuelle. Les trois réserves se
corrigent dans `kit.js`, `main.js`, `i18n.js` et la feuille de style —
c'est-à-dire à un seul endroit chacune. Si une correction demande de
toucher vingt vues, c'est qu'elle est prise au mauvais niveau.

## La clôture

- Tests unitaires là où c'est possible (langue posée, `h1` présent) ;
  mesures navigateur pour le reste, **refaites et citées**.
- `npm run verify` vert, quatre portes.
- `docs/16-comite-independant.md` : R-04, R-05, R-06 **LEVÉES**, chacune
  avec sa mesure avant → après.

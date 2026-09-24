# Comité fonctionnel — faire mieux que MS Project, fonction par fonction

Date : 23 septembre 2026. Neuvième comité. Le premier dont le mandat
est d'**ajouter** des fonctions plutôt que d'en refuser.

## 0 · Pourquoi ce comité existe, et ce qu'il lève

Le 23/09, le propriétaire du produit a écrit, dans la session de
convergence :

> « build a full commitee to improve it and identify anything to make it
> better than MS project and other PM tool in a functionality and
> capability matter then build and execute all the /goal prompts »

Cette phrase est la levée explicite, consignée ici au procès-verbal, de
deux refus de [`23`](23-comite-produit.md) §5 :

| Refus | Texte | Décision de ce comité |
|---|---|---|
| **n° 1** | « Toute fonction nouvelle de portefeuille avant R2 close » — nommément le nivellement de ressources et l'approfondissement du CPM | **Levé** pour les lignes FX-01 à FX-16 ci-dessous, et pour elles seules |
| **n° 2** | « Rattraper Planview et Primavera » — une demande justifiée par « le concurrent le fait » est irrecevable sans siège demandeur ni conséquence | **Levé sous condition** : chaque ligne ci-dessous nomme son siège demandeur et ce que son absence coûte. « MS Project le fait » ne suffit toujours pas |
| n° 3 à 6 | Effacement de la piste, etc. | **Maintenus, sans exception.** Aucune ligne ne touche à `audit_no_update` / `audit_no_delete` |

Ce que la levée **ne change pas** :

- **R2 n'est pas prononcée.** Une fonction construite n'est pas une
  fonction autorisée à porter du réel. Les registres garderont
  `released: false` tant qu'aucune étiquette n'existe.
- **La constitution tient** : l'autorité reste dans `shared/rbac.js`,
  chaque mutation passe par `audited()`, `row_version` est vérifié, une
  migration appliquée ne se modifie jamais, un test ne s'affaiblit
  jamais.
- **Le moteur reste figé en comportement (D-05).** Toute capacité
  nouvelle est **additive** : un livre existant, sans type de lien, sans
  décalage, sans calendrier, doit produire **exactement** les mêmes
  chiffres qu'en 5.28.0. Chaque ligne qui touche l'ordonnancement le
  prouve par un test « avant / après » sur tout le livre de démonstration.

Décision consignée : **D-41.00**.

---

## 1 · Composition — neuf sièges

| Siège | Profil | Ce qu'il défend |
|---|---|---|
| S1 · Planificateur | Dix ans de MS Project et de Primavera P6 sur des arrêts d'usine | Un planning qui se calcule seul, correctement, en jours ouvrés |
| S2 · Directeur de PMO groupe | Ancien utilisateur de Planview et Clarity | Le portefeuille : scénarios, capacité, arbitrage |
| S3 · Responsable delivery agile | Jira, Scrum, équipes produit (le siège de FitAdapt) | Sprints, vélocité, un plan hybride qui ne ment pas |
| S4 · Gestionnaire de ressources | Pools partagés entre sites, rotations minières | Qui travaille sur quoi, et qui est surchargé |
| S5 · Contrôleur de coûts | EVM, prévisions de fin, clôtures mensuelles | Des coûts planifiés par période, une EAC défendable |
| S6 · Chef de site | Liaison satellite, huit sites (le siège de RT365) | Que rien de tout cela n'alourdisse l'écran ni la bande passante |
| S7 · Analyste de risque | Primavera Risk Analysis, Monte Carlo | Une date de fin avec une probabilité, pas une promesse |
| S8 · Intégrateur | Migrations MS Project → autre outil | Qu'un plan MS Project entre et sorte sans perte |
| S9 · Gardien de la constitution | Sécurité et audit (siège de [`20`](20-comite-infosec-grc.md)) | Qu'aucune fonction nouvelle n'ouvre une porte dérobée à l'autorité ou à la piste |

**Règle de départage :** en cas de désaccord, S9 a un veto sur tout ce qui
touche l'autorité et la piste ; S6 a un veto sur le poids de l'écran
(budget : **+15 % maximum** sur le paquet client gzip de 5.28.0).

---

## 2 · Le banc d'essai

Positions jugées par le comité, par rapport à ce que chaque outil propose
en standard. Elles ne remplacent pas un essai des produits concurrents.

**Légende :** ✅ natif · ◐ partiel · ❌ absent · — hors du modèle de
l'outil.

| Capacité | MS Project | Primavera P6 | Jira | Smartsheet / Monday | Planview / Clarity | **Meridian 5.28** | Ligne |
|---|---|---|---|---|---|---|---|
| Liens FS / SS / FF / SF avec décalage et avance | ✅ | ✅ | ❌ | ◐ | ◐ | **❌ FS seul, sans décalage** | FX-01 |
| Calendriers ouvrés, jours fériés, par projet et par ressource | ✅ | ✅ | ❌ | ◐ | ◐ | **❌ jours calendaires** (`workdays()` jamais appelée) | FX-02 |
| Contraintes de date et échéances (SNET, FNLT, MSO…) | ✅ | ✅ | ❌ | ◐ | ◐ | **❌** | FX-03 |
| Suivi réel : début et fin réels, reste à faire, date d'état | ✅ | ✅ | ◐ | ◐ | ◐ | **◐ % seul** | FX-04 |
| Marge totale et marge libre | ✅ | ✅ | ❌ | ❌ | ◐ | **◐ totale seule** | FX-04 |
| WBS hiérarchique, tâches récapitulatives, numérotation | ✅ | ✅ | ◐ (epics) | ✅ | ✅ | **❌ liste plate par étape** | FX-05 |
| Gantt interactif : barres, liens, chemin critique, référence | ✅ | ✅ | ◐ (plugin) | ✅ | ✅ | **❌ aucun Gantt** | FX-06 |
| Plusieurs lignes de base nommées, comparaison | ✅ (11) | ✅ | ❌ | ◐ | ✅ | **◐ une seule, re-planifiée par demande de changement** | FX-07 |
| Affectations avec unités, travail = durée × unités | ✅ | ✅ | ❌ | ◐ | ✅ | **◐ allocations par projet, pas par activité** | FX-08 |
| Surallocation visible par jour et par semaine | ✅ | ✅ | ❌ | ◐ | ✅ | **◐** (`effectiveFte` non branché sur la capacité) | FX-08 |
| Nivellement des ressources | ✅ | ✅ | ❌ | ❌ | ◐ | **❌ (refus n° 1, levé)** | FX-09 |
| Taux horaires, coût planifié par période (courbe en S), EAC multiples, TCPI | ✅ | ✅ | ❌ | ❌ | ✅ | **◐ EAC = BAC/CPI seule** | FX-10 |
| Analyse de risque Monte Carlo (P50 / P80, indice de criticité) | ❌ (extension) | ◐ (Risk Analysis) | ❌ | ❌ | ❌ | **❌** | FX-11 |
| Scénarios de portefeuille « et si » (reporter, accélérer, annuler) | ❌ | ◐ | ❌ | ❌ | ✅ | **❌** | FX-12 |
| Import et export MS Project (XML MSPDI) | ✅ | ✅ | ◐ | ◐ | ◐ | **❌** | FX-13 |
| Sprints, vélocité, burndown, plan hybride | ❌ | ❌ | ✅ | ◐ | ◐ | **◐ tableau de travail, sans sprint** | FX-14 |
| Liens entre projets typés, planning maître | ✅ | ✅ | ◐ | ◐ | ✅ | **◐ FS seul, alerte uniquement** | FX-15 |
| Rapport de planning imprimable (Gantt en PDF), pack d'état | ✅ | ✅ | ◐ | ✅ | ✅ | **◐ pack Markdown, sans Gantt** | FX-16 |
| Gouvernance groupe ↔ site, ordre du jour généré, piste inviolable, séparation des tâches, preuve de jalon | ❌ | ◐ | ❌ | ❌ | ◐ | **✅ en avance** | — |
| Poids (liaison satellite), bilingue imposé par la construction | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ en avance** | — |

**Le verdict du banc.** Meridian a gagné la moitié du tableau que les
autres ne jouent pas : la gouvernance. Il perd la moitié que MS Project
joue depuis trente ans : le moteur de planning. Sur les quatre lignes qui
font un vrai outil de planning — types de liens, calendriers, hiérarchie,
Gantt — il n'a **rien**. Un planificateur (S1) ferme l'outil au bout de
dix minutes.

Le comité vise ce qui peut rendre Meridian **meilleur que MS Project**, pas
seulement égal :

1. **À parité sur le moteur** : FX-01 à FX-07.
2. **Au-delà sur les ressources et les coûts**, parce qu'ils sont gouvernés
   et audités : FX-08 à FX-10.
3. **Au-delà de MS Project en standard** : FX-11 (Monte Carlo), FX-12
   (scénarios), FX-14 (hybride agile). MS Project n'a aucune des trois
   sans extension payante.
4. **La porte d'entrée** : FX-13. Sans import MS Project, aucun
   planificateur n'essaie l'outil.

---

## 3 · Les lignes

Chaque ligne indique :

- **Siège** : qui la demande ;
- **Coût** : ce que son absence coûte aujourd'hui ;
- **Livré** : la mesure qui la ferme ;
- **Garde** : ce qu'elle ne doit pas casser.

### Vague A — le moteur de planning (parité avec MS Project)

**FX-01 · Types de liens et décalages** (S1)

- **Coût :** « le coulage commence 3 jours après le début du ferraillage »
  (SS+3) ne s'écrit pas. Le planificateur ment avec un FS et une date
  forcée.
- **Livré :**
  - `activity_dep.type` ∈ {FS, SS, FF, SF}, défaut FS ;
  - `activity_dep.lag_days` (négatif = avance), défaut 0 ;
  - le CPM aller-retour honore les quatre types ;
  - saisie à l'écran et par l'API `/api/v1` ;
  - export et import (F13).
- **Garde :** un livre sans type ni décalage donne **exactement** les
  chiffres de 5.28.0 (test « avant / après » sur tout le livre).

**FX-02 · Calendriers ouvrés** (S1, S4, S6)

- **Coût :** une durée de 10 jours se termine un samedi ; Noël est un jour
  de chantier ; le chef de site corrige à la main.
- **Livré :**
  - table `work_calendar` : jours ouvrés de la semaine, jours fériés
    datés, nom ;
  - un calendrier par projet (hérité du site, sinon du groupe) ;
  - calcul du CPM en jours ouvrés quand un calendrier est affecté ;
  - `workdays()` enfin appelée ;
  - écran d'administration des calendriers ;
  - les fenêtres d'usine des sites (déjà présentes) peuvent servir de
    périodes chômées.
- **Garde :** un projet sans calendrier reste en jours calendaires. Les
  chiffres existants ne bougent pas.

**FX-03 · Contraintes et échéances** (S1)

- **Coût :** une date réglementaire (« doit finir au plus tard le 31/12 »)
  n'existe que dans la tête du chef de projet.
- **Livré :**
  - `activity.constraint_type` ∈ {ASAP, SNET, SNLT, FNET, FNLT, MSO, MFO}
    et `constraint_date` ;
  - `activity.deadline` ;
  - le CPM applique les contraintes ;
  - une échéance dépassée ou une marge négative est signalée à l'écran
    et dans les signaux, avec le nom de l'activité.
- **Garde :** une contrainte ne réécrit jamais silencieusement une date
  saisie. Elle produit une marge négative visible.

**FX-04 · Suivi réel et marges** (S1, S5)

- **Coût :** le % d'avancement déclaratif est la seule mesure. On ne sait
  pas quand une activité a vraiment commencé.
- **Livré :**
  - `actual_start` et `actual_finish` ;
  - reste à faire en jours ;
  - une **date d'état** par projet ;
  - l'EVM calculée à la date d'état ;
  - la marge libre à côté de la marge totale ;
  - les activités en retard par rapport à la date d'état sont signalées.
- **Garde :** la mesure physique (5.9.1) et la règle MER-04 (pas de
  budget, pas de chiffre) restent intactes.

**FX-05 · WBS hiérarchique** (S1, S2)

- **Coût :** un projet de 80 activités est une liste plate de 80 lignes.
- **Livré :**
  - `activity.parent_id` ;
  - des activités récapitulatives dont les dates, le poids et l'avancement
    sont **calculés** à partir des enfants, jamais saisis ;
  - la numérotation hiérarchique (1, 1.1, 1.1.2) ;
  - le repliage à l'écran ;
  - l'import et l'export conservent l'arbre.
- **Garde :** une récapitulative n'a ni lien propre ni poids propre, pour
  qu'il n'y ait pas de double comptage dans la valeur acquise (test).

**FX-06 · Gantt interactif** (S1, S6)

- **Coût :** il n'y a aucune vue calendaire d'un projet. C'est la première
  chose qu'un planificateur cherche.
- **Livré :**
  - un Gantt SVG maison, sans bibliothèque, avec barres, jalons, flèches
    de liens par type et chemin critique en surbrillance ;
  - une barre fantôme pour la ligne de base, la date d'état et la
    hiérarchie repliable ;
  - le déplacement d'une barre par glisser écrit par une route auditée
    avec `row_version`, et est refusé si le compte n'a pas l'autorité
    (`rbac.js`) ;
  - le Gantt reste lisible au clavier.
- **Garde :**
  - budget de poids de S6 ;
  - la vue se dessine pour chaque rôle (F8) ;
  - pas de bibliothèque externe.

**FX-07 · Lignes de base multiples** (S1, S5)

- **Coût :** la re-planification écrase la référence. On ne peut pas
  comparer au plan d'origine.
- **Livré :**
  - des instantanés nommés (jusqu'à 11), en lecture seule une fois pris ;
  - la comparaison écart par activité entre deux références ;
  - la référence active reste celle que gouverne la demande de
    changement.
- **Garde :** prendre un instantané ne change pas la référence gouvernée.
  Seul le circuit de changement le fait (séparation des tâches intacte).

### Vague B — ressources et coûts (au-delà, parce que gouvernés)

**FX-08 · Affectations et surallocation** (S4)

- **Coût :** on ne voit pas qu'une même personne est à 180 % la semaine du
  12.
- **Livré :**
  - `assignment` (activité, personne ou rôle, unités en %) ;
  - le travail est calculé ;
  - l'histogramme de charge par personne et par semaine tient compte des
    absences et de la rotation (`effectiveFte` branché) ;
  - la surallocation est signalée.
- **Garde :** les allocations de projet existantes restent lues comme
  avant.

**FX-09 · Nivellement proposé, jamais imposé** (S4, S9)

- **Coût :** un nivellement qui déplace 40 activités sans trace est
  interdit par la constitution. Aucun nivellement n'est pire.
- **Livré :**
  - un calcul de nivellement dans la marge d'abord, puis en retardant par
    priorité ;
  - il produit une **proposition** (liste des déplacements, effet sur la
    date de fin) ;
  - rien n'est écrit tant qu'un humain autorisé ne l'applique pas ;
  - l'application passe par une mutation auditée par activité.
- **Garde :** S9 — nivellement ≠ autorité. Il ne peut déplacer que ce que
  le compte peut modifier.

**FX-10 · Coûts planifiés et EAC** (S5)

- **Coût :** l'EAC n'a qu'une formule. Aucune courbe en S planifiée par
  période.
- **Livré :**
  - des taux par rôle et par personne (table de taux) ;
  - le coût planifié par activité à partir des affectations ;
  - la courbe en S BCWS / BCWP / ACWP par mois ;
  - l'EAC selon trois méthodes (CPI, CPI × SPI, ascendante) et le TCPI ;
  - chaque méthode est nommée à l'écran.
- **Garde :** MER-04. Pas de budget, pas de chiffre : `null` et « rien
  de mesuré ».

### Vague C — au-delà de MS Project

**FX-11 · Analyse de risque Monte Carlo** (S7)

- **Coût :** la date de fin est un point. Le comité de pilotage ne sait
  pas si elle est à 20 % ou à 80 % de chances.
- **Livré :**
  - des estimations à trois points (optimiste, probable, pessimiste) par
    activité ;
  - une simulation déterministe (graine fixée, reproductible) sur le
    réseau avec types et calendriers ;
  - les dates P50, P80 et P90 ;
  - l'indice de criticité par activité ;
  - l'histogramme de la date de fin ;
  - les résultats datés et conservés.
- **Garde :** calcul borné (10 000 tirages maximum, sous une seconde sur
  le livre de démonstration). Il ne modifie aucune date.

**FX-12 · Scénarios de portefeuille** (S2)

- **Coût :** « et si on reportait PRJ-118 d'un trimestre ? » se fait dans
  un tableur, hors piste.
- **Livré :**
  - un scénario = une copie **isolée** des décisions (reporter, accélérer,
    annuler, changer d'enveloppe) ;
  - il compare capacité, enveloppe, valeur et dates avec la situation
    réelle, côte à côte ;
  - la promotion d'un scénario passe par une **décision** enregistrée et
    ratifiée (REQ-49 et REQ-50) ; rien n'est appliqué sans elle.
- **Garde :** un scénario n'écrit jamais dans le livre réel. S9 le
  vérifie par test.

**FX-13 · MS Project entre et sort** (S8)

- **Coût :** sans import, un planificateur ne met jamais son plan dans
  l'outil. Sans export, il n'ose pas y entrer.
- **Livré :**
  - import et export MSPDI (XML MS Project 2003+) : tâches, hiérarchie,
    liens typés avec décalages, calendriers, contraintes, ressources,
    affectations, ligne de base ;
  - un rapport d'import nommant chaque élément ignoré ;
  - l'aller-retour Meridian → XML → Meridian ne perd rien, dans une porte
    de la famille F13.
- **Garde :** l'import passe par le même chemin audité que l'import de
  livre, sous l'autorité du compte.

**FX-14 · Hybride agile** (S3)

- **Coût :** FitAdapt livre en sprints ; Meridian ne connaît que des
  étapes et des pourcentages.
- **Livré :**
  - des itérations (sprints) datées par projet ;
  - les éléments de travail sont affectés à un sprint, avec des points ;
  - vélocité, burndown et burnup ;
  - option : l'avancement physique d'une activité se calcule à partir des
    points livrés de ses éléments.
- **Garde :** un projet sans sprint reste inchangé.

**FX-15 · Planning maître multi-projets** (S2, S1)

- **Coût :** les liens entre projets sont FS et ne font qu'alerter.
- **Livré :**
  - les liens inter-projets typés avec décalage (FX-01) ;
  - un chemin critique de programme ;
  - une vue maître qui montre les projets et leurs liens.
- **Garde :** l'autorité est vérifiée des deux côtés du lien.

**FX-16 · Rapport de planning imprimable** (S2, S6)

- **Coût :** le comité de pilotage reçoit des captures d'écran.
- **Livré :**
  - un export PDF / SVG du Gantt et un pack d'état (jalons, marges,
    écarts à la référence, P80) ;
  - bilingue ;
  - le pied de page indique la classification.
- **Garde :** aucun service externe de rendu.

---

## 4 · Ordre et vagues

| Vague | Lignes | Migrations réservées | Condition de sortie |
|---|---|---|---|
| A1 | FX-01, FX-02, FX-03, FX-04 (moteur) | 061 | Test « avant / après » identique sur tout le livre ; nouveaux cas CPM prouvés à la main (exemples chiffrés) |
| A2 | FX-05, FX-06, FX-07 (hiérarchie, Gantt, références) | 062 | Gantt dessiné pour chaque rôle (F8) ; budget de poids tenu |
| B | FX-08, FX-09, FX-10 | 063 | Surallocation et EAC prouvées sur un cas chiffré |
| C1 | FX-11, FX-12 | 064 | Reproductibilité (graine) ; aucun scénario n'écrit dans le livre réel |
| C2 | FX-14 | 065 | Un projet sans sprint est inchangé |
| D | FX-13, FX-15, FX-16 | 066 | L'aller-retour MSPDI ne perd rien |

A1, A2, B, C1 et C2 se construisent en parallèle, chacune dans son arbre de
travail, puis s'intègrent **dans l'ordre des migrations**. D vient après,
car elle lit les types, calendriers et hiérarchies des vagues A.

**Définition de terminé, pour chaque ligne :**

- `npm run verify` vert, avec un nombre de tests en hausse ;
- F13 (aller-retour) à 200, sans perte nommée ;
- la vue exercée dans un vrai navigateur ;
- les libellés traduits (FR / ES) ;
- une entrée au CHANGELOG ;
- ce registre mis à jour ;
- une demande de fusion (PR) par ligne ou par vague.

---

## 5 · Relevé

| Ligne | État | Version | Mesure |
|---|---|---|---|
| FX-01 | **construite** | 5.29.0 | `schedule-engine.test.js` (35) ; typed links with lag, MS Project notation ; égalité 5.28.0 prouvée |
| FX-02 | **construite** | 5.29.0 | `schedule-engine.test.js` (35) ; calendars, project → site → group → none ; égalité 5.28.0 prouvée |
| FX-03 | **construite** | 5.29.0 | `schedule-engine.test.js` (35) ; constraints bound the passes, violations as negative float ; égalité 5.28.0 prouvée |
| FX-04 | **construite** | 5.29.0 | `schedule-engine.test.js` (35) ; actuals, status date, free float ; égalité 5.28.0 prouvée |
| FX-05 | **construite** | 5.30.0 | `plan-shape.test.js` ; arbre, récapitulatives calculées, pas de double comptage ; égalité 5.28.0 prouvée |
| FX-06 | **construite** | 5.30.0 | `plan-shape.test.js` ; Gantt SVG, glisser et clavier, 409 honnête ; égalité 5.28.0 prouvée |
| FX-07 | **construite** | 5.30.0 | `plan-shape.test.js` ; 11 références nommées, lecture seule, comparaison ; égalité 5.28.0 prouvée |
| FX-08 | **construite** | 5.31.0 | `resources.test.js` ; affectations, charge hebdomadaire, surallocation ; **FX-08 bis ouverte** : le travail compte encore des jours calendaires |
| FX-09 | **construite** | 5.31.0 | `resources.test.js` ; proposition sans écriture (prouvé), application auditée tout ou rien |
| FX-10 | **construite** | 5.31.0 | `resources.test.js` ; taux, courbe en S, EAC ×3 nommées, TCPI |
| FX-11 | **construite** | 5.34.0 | `schedule-risk.test.js` (19) ; triangulaire, graine, P50/P80/P90, criticité ; par le moteur unique ; aucune date déplacée |
| FX-12 | **construite** | 5.32.0 | `scenarios.test.js` ; copie isolée, comparaison par le moteur, application par décision ratifiée ; aucune écriture prouvée |
| FX-13 | **construite** | 5.35.0 | `mspdi.test.js` (27) ; export/import MSPDI, rapport des pertes, aller-retour F13 (pertes nommées seulement) |
| FX-14 | **construite** | 5.33.0 | `agile.test.js` (24) ; sprints, vélocité, burndown/burnup, avancement hybride sur le même chemin |
| FX-15 | ouverte | | |
| FX-16 | **construite** | 5.34.0 | SVG autonome et pack imprimable (EN/FR/ES, pied INTERNE) ; chargé à la demande |

## 6 · Décisions

| Id | Date | Décision |
|---|---|---|
| D-41.00 | 23/09 | Refus n° 1 et n° 2 de [`23`](23-comite-produit.md) §5 levés par le propriétaire pour FX-01 à FX-16, dans les termes cités au §0. Refus n° 3 à 6, constitution et D-05 maintenus. R2 inchangée. |
| D-41.01 | 23/09 | Tout ajout au moteur est additif : les valeurs par défaut (FS, décalage 0, pas de calendrier, ASAP, pas de parent) reproduisent 5.28.0 au chiffre près, et un test le prouve sur tout le livre. |
| D-41.02 | 23/09 | Aucun calcul (nivellement, scénario, Monte Carlo) n'écrit dans le livre. Il propose ; un humain autorisé applique, par des mutations auditées. |
| D-41.03 | 23/09 | Pas de bibliothèque externe de Gantt ou de graphique : le paquet client reste sous +15 % de 5.28.0 (veto de S6). |

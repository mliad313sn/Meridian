---
description: R-02 et R-11 — suppléance, absences de rotation, et un digest qui couvre réellement le temps passé loin du site.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /rotation — rendre l'outil compatible avec la façon dont les gens travaillent

## Le constat

Meridian modélise la rotation pour la **capacité** (`rotation`,
`availability`) et nulle part pour la **responsabilité**. Il n'existe ni
suppléant, ni délégation, ni absence déclarée. Les actions, les décisions
de changement et les levées de maîtrise des modifications restent
affectées à quelqu'un qui est absent une semaine sur trois par
construction.

Et la fenêtre du digest est figée à **7 jours** quand un roster 14/14 ou
4/2 éloigne l'intéressé de **14 jours ou plus** : au retour, il manque
structurellement une semaine que rien ne lui restitue.

C'est le mécanisme d'arrêt de flux le plus banal d'une exploitation
minière, et le seul que le modèle ignore.

## Ce qu'il faut livrer

### 1 · L'absence est une donnée

`person_absence` : personne, du, au, motif (`rotation`, `congé`,
`formation`, `maladie`), suppléant désigné. Une absence n'est pas un statut
sur la personne : elle a des bornes, et il en existe plusieurs.

### 2 · La suppléance est une autorité, donc elle passe par `can()`

- Un suppléant agit **au nom de** l'absent, dans la limite de ce que
  l'absent pouvait faire — jamais plus. Une délégation n'élargit rien.
- Elle est **bornée dans le temps** par l'absence qui la porte.
- Elle ne franchit pas les contrôles d'indépendance : si l'absent ne
  pouvait pas décider sa propre demande, son suppléant ne le peut pas non
  plus, et **le suppléant ne peut pas décider une demande qu'il a lui-même
  émise**. Vérifier explicitement ce cas : c'est la faille évidente.
- La piste d'audit nomme **les deux** : « X (pour Y) ». Un acte délégué
  qui s'enregistre au seul nom du suppléant efface la responsabilité ;
  au seul nom de l'absent, il ment.

### 3 · Ce qui est dû à quelqu'un d'absent devient visible

- Les actions et décisions dont le responsable est absent apparaissent
  comme telles sur les surfaces existantes (« Ma semaine », l'ordre du
  jour, le registre) — pas dans un nouvel écran.
- Un élément arrivant à échéance pendant une absence **prévient le
  suppléant**, pas seulement l'absent.

### 4 · Le digest couvre l'absence

- Fenêtre paramétrable, et **par défaut calculée** : depuis la dernière
  connexion de la personne, ou depuis la fin de sa dernière absence, selon
  ce qui remonte le plus loin. La borne de 7 jours devient un plancher,
  pas une règle.
- Au retour, l'entête dit la période réellement couverte. « Cette semaine »
  est faux pour quelqu'un parti quinze jours.

### 5 · R-11 — les notifications parlent à la personne

- Corps de message **en français quand le destinataire l'a choisi** :
  réutiliser `server/src/i18n.js`, ne pas créer un second dictionnaire.
  Les messages sont aujourd'hui en anglais en dur dans `notify.js`.
- Préférence de fréquence par compte (immédiat / quotidien / hebdomadaire)
  et désabonnement par type.
- **Rien n'est envoyé à quelqu'un en rotation déclarée** si un suppléant
  existe : c'est au suppléant que cela part.

## La clôture

- Test `R-02` : une délégation n'élargit jamais l'autorité ; elle expire
  avec l'absence ; le suppléant ne décide pas sa propre demande ; l'audit
  nomme les deux.
- Test `R-11` : un destinataire francophone reçoit un corps en français ;
  une préférence est respectée.
- Mesure refaite : le digest d'une personne rentrant de 14 jours couvre
  bien 14 jours et le dit.
- Parcours cliqué : déclarer une absence, désigner un suppléant, agir en
  tant que suppléant, lire la ligne d'audit produite.
- `npm run verify` vert, quatre portes. `docs/16` mis à jour.

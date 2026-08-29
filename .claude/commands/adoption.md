---
description: R-03, R-09, R-10, R-12, R-13, R-14 — ce qu'il manque pour que l'outil entre dans la vie réelle : réel saisi, reprise d'existant, calendrier, annulation, versions, traçabilité des lectures.
argument-hint: "<R-xx> pour une seule  ·  vide = toutes, dans l'ordre"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /adoption — les réserves d'exploitation

Six réserves de gravité moyenne à majeure. Elles ne remettent pas en cause
la conception ; elles décident si l'outil est **adopté** ou contourné.

$ARGUMENTS

Sans argument, les traiter dans l'ordre ci-dessous, une par cycle.

---

## R-03 · Le réel n'est jamais saisi — *majeure*

**Constat.** Les affectations portent un pourcentage **prévu**. Zéro
occurrence de `timesheet`, `actual_hours` ou `effort_actual` dans les
migrations. La capacité, le CPI sur la main-d'œuvre et le coût capitalisé
reposent donc sur le plan, jamais sur le fait.

**À livrer.** Une saisie d'effort réel *légère* — la lourdeur tuerait
l'usage : par personne, par projet, par semaine, un nombre de jours.
Rien de plus. Le rapprochement plan / réel apparaît là où la capacité est
déjà affichée. **Ne pas toucher à l'arithmétique du moteur** : le réel
s'ajoute à côté, il ne réécrit pas l'EVM.

**Clôture.** Un test qui prouve qu'une semaine saisie remonte au
rapprochement ; l'écran des ressources montre prévu et réel côte à côte.

---

## R-09 · Aucune reprise d'un existant — *majeure*

**Constat.** L'import n'accepte que l'export JSON de Meridian lui-même.
L'organisation vit dans des tableurs ; aucun chemin ne mène des tableurs à
l'outil. C'est le premier obstacle réel au déploiement.

**À livrer.** Un import CSV pour les trois choses qu'on reprend vraiment :
**projets**, **personnes**, **jalons**. Avec, dans cet ordre :
un modèle de fichier téléchargeable ; une **prévisualisation** avant
écriture disant ce qui sera créé, modifié, refusé et pourquoi ; un import
transactionnel — tout ou rien ; un compte rendu conservé dans la piste
d'audit.

**Clôture.** Un fichier volontairement sale (colonne manquante, site
inconnu, date invalide) produit un refus **ligne par ligne**, lisible,
sans rien écrire.

---

## R-10 · Les réunions ne rencontrent pas l'agenda — *majeure*

**Constat.** Ordre du jour, dossier de séance et relevé de décisions
excellents, et aucun lien avec un calendrier. Deux sources de vérité pour
la même réunion.

**À livrer.** Un fichier **ICS** par occurrence (et par série), depuis
l'écran des réunions : c'est le format que tout calendrier accepte et il
ne demande aucune intégration. Y mettre l'objet, l'heure, la durée du
timebox, les participants et un lien vers l'occurrence. **Ne pas**
construire une intégration Exchange : le comité demande que les deux
agendas cessent de diverger, pas un connecteur.

---

## R-12 · Aucune annulation, alors que la matière existe — *moyenne*

**Constat.** Les suppressions sont définitives côté interface, alors que
la piste d'audit conserve l'image `before` de l'objet supprimé. La matière
d'une restauration existe et n'est pas offerte.

**À livrer.** Une restauration **administrateur**, depuis la piste
d'audit : rejouer l'image `before` d'une suppression, en écrivant une
nouvelle ligne d'audit qui dit que c'est une restauration. Ne jamais
réécrire l'historique — restaurer, c'est ajouter.
Attention aux dépendances : restaurer un projet supprimé ne ressuscite pas
ses enfants ; le dire plutôt que le laisser croire.

---

## R-13 · Les versions documentaires ne sont pas des versions — *moyenne*

**Constat.** « Nouvelle révision » crée une ligne et bascule la précédente
en « Remplacé ». Sans artefact (R-01), il n'y a ni contenu comparé ni
historique réel : une suite d'étiquettes.

**Dépend de R-01 — ne pas commencer avant.** Ensuite : chaque révision
porte son artefact et son empreinte, et l'écran montre la lignée
(qui remplace quoi, quand, par qui).

---

## R-14 · Aucune trace des consultations — *moyenne*

**Constat.** La piste d'audit est exemplaire sur les écritures et muette
sur les lectures. Certaines obligations portent sur le fait d'avoir
**consulté**.

**À livrer, avec mesure.** Ne pas journaliser toutes les lectures : le
volume rendrait la piste inutilisable et coûterait cher sur une base
partagée. Journaliser **les consultations sensibles** seulement :
le dossier de preuve, l'export de données, le registre des décisions, la
piste d'audit elle-même. Une ligne par consultation, même table, action
distincte (`… consulté`).

**Clôture.** Un test qui prouve que l'export et le dossier de preuve
laissent une trace nominative, et que la navigation ordinaire n'en laisse
pas.

---

## Règles communes

`npm run verify` vert à chaque arrêt. Les cinq obligations pour toute
nouvelle entité (migration, CRUD complet, sérialiseur, formulaire, test).
Chaque réserve levée est datée dans `docs/16-comite-independant.md` avec
ce qui a été fait et comment on l'a vérifié.

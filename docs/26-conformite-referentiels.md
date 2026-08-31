# 26 · Conformité aux référentiels de gestion de projet et de gouvernance

**Mandat.** « Combler tous les manques ; l'objectif est de bâtir le
meilleur outil de gestion de projet au monde, couvrant tous les processus
et toutes les bonnes pratiques exigées en gestion de projet et en
gouvernance. » — commanditaire, 31/08/2026.

**Méthode, et ce qu'elle vaut.** Chaque affirmation de ce document sur ce
que Meridian fait ou ne fait pas a été vérifiée **dans le schéma et dans
le moteur**, pas dans les vingt-cinq rapports qui précèdent. Les rapports
décrivent des intentions ; les migrations décrivent ce qui existe. Là où
les deux divergeaient, c'est le schéma qui a tranché — c'est cette
méthode qui a fait apparaître le constat n° 1 ci-dessous, qu'aucune
relecture de documents n'aurait produit.

**Référentiels retenus.** ISO 21502 (management de projet), ISO 21503
(programme), ISO 21504 (portefeuille), ISO 21505 (gouvernance),
PRINCE2 7ᵉ édition, PMBOK Guide 7ᵉ édition, ISO 31000 (risque),
ANSI/EIA-748 (management par la valeur acquise), COBIT 2019 et
ISO/IEC 38500 (gouvernance du SI), ITIL 4 (transition de service),
ISO 10006 (qualité en projet).

---

## 0 · Relevé — mis à jour au fil de la boucle

| Ligne | État | Mesure |
|---|---|---|
| **PM-02** | **LEVÉE le 31/08/2026** | Migration `024_lessons.sql`, écran « Enseignements », route `/lessons/:id/adopt` réservée au groupe, 9 tests. Exercé au navigateur : São Paulo propose, Digital Channels adopte, **Toronto lit l'enseignement et reçoit toujours 404 sur le projet d'origine**, qui n'est pas nommé. |

---

## 1 · Le constat qui ouvre le dossier

> **Le jalon 4 du produit exige comme preuve « Realisation report,
> lessons learned » — et le produit n'avait aucun endroit où mettre un
> enseignement.**
> `shared/engine.js:80` — **fermé le 31/08/2026, voir §0.**

Ce n'est pas un manque parmi d'autres : c'est le produit qui réclame une
pièce qu'il rend impossible à fournir. Quiconque atteindra le jalon 4
devra soit déposer un fichier hors de l'outil — et la piste perd le
contenu au moment précis où elle prétend le tenir — soit franchir le
jalon sans la preuve que le modèle exige.

Le même défaut, en plus discret, tient au jalon 1 : il demande
« Charter, business case, benefits map ». Les bénéfices existent
réellement (table `benefit`, mesures, écart de réalisation, revue
post-mise en œuvre). Le **cas d'affaire**, lui, n'existe que comme *type
de document* : un nom de fichier et un statut. Aucun chiffre, aucune
reconfirmation à chaque jalon.

Un modèle de jalons qui demande des preuves que le schéma ne sait pas
porter n'est pas un modèle de gouvernance : c'est une liste de courses.

---

## 2 · Ce qui est réellement couvert

À dire d'abord, parce que le registre qui suit ne parle que des manques
et donnerait sinon une image fausse. Vérifié dans le schéma :

| Domaine | Référence | État |
|---|---|---|
| Valeur acquise (VA/VP/CR, IPC, IPP, CFE) | EIA-748, ISO 21502 §7.10 | `Engine.metrics` · **complet** pour le niveau portefeuille |
| Chemin critique, marge, ordonnancement | ISO 21502 §7.6 | `Engine.criticalPath`, `topo`, `depBreaches` |
| Jalons de phase avec preuve et propriétaire | PRINCE2, ISO 21505 | `GATES`, `document`, `canAdvance` |
| Registre RAID | ISO 31000, ISO 21502 §7.9 | probabilité × impact, stratégie de réponse, propriétaire, date de revue |
| Maîtrise des changements avec séparation des tâches | ISO 21502 §7.12 | `change_request` + seuil `ccbThreshold` qui **route** la décision au bon niveau |
| Bénéfices et revue post-mise en œuvre | Managing Benefits, ISO 21502 §7.2 | `benefit`, `Engine.attainment`, `pir_verdict` |
| Capacité et affectation des ressources | ISO 21502 §7.7 | `allocation`, `Engine.capacity`, `overAllocated`, rotation, absences, suppléance |
| Coûts, engagements, devises, provision | ISO 21502 §7.11 | `cost_line`, `commitment`, taux de change, tirage de provision |
| Demande et priorisation sous enveloppe | ISO 21504 | `demand`, `Engine.prioritise` |
| Périodes gelées, historique non recalculé | ISO 21505, exigence d'auditabilité | `report_period` / `report_snapshot`, en ajout seul |
| Piste d'audit inaltérable | ISO 21505, ISO 27001 A.8.15 | `audited()` dans la transaction, `UPDATE`/`DELETE` refusés à la base |
| Comités, ordres du jour, décisions, actions, renvois | ISO 21505 §5 | module de réunion complet, ordre du jour **engendré** |
| Fenêtres d'exploitation et gestion de modification | ITIL 4, ISO 21502 §7.6 | `site_window`, `plant_impact`, approbation MOC |
| Réversibilité des données | ISO 21502 §7.15 | archive + `npm run restore` |

C'est déjà, sur ces lignes, un outil plus complet que la plupart des
produits vendus. Le registre ci-dessous n'enlève rien à cela.

---

## 3 · Le registre des manques

Treize lignes. Chacune porte le référentiel qui l'exige, ce qui manque
exactement, **ce que ça coûte aujourd'hui** — parce qu'un manque sans
conséquence nommée est une case à cocher, pas un manque — et l'effort.

| # | Manque | Exigé par | Ce que ça coûte aujourd'hui | Effort |
|--:|---|---|---|---|
| **PM-01** | **Tolérances et gestion par exception.** Le niveau supérieur ne peut fixer aucune tolérance (délai, coût, bénéfice) et rien ne remonte quand une prévision la franchit. | PRINCE2 « Progress » · ISO 21502 §6.5 · PMBOK « Measurement » | L'autorité est déléguée **sans borne**. Un projet vire à l'orange et quelqu'un doit le remarquer. Le comité découvre le dépassement quand il est consommé, jamais quand il est prévu. | 1 sem |
| ~~**PM-02**~~ | **LEVÉE le 31/08/2026.** Registre des enseignements — migration 024, écran « Enseignements », 9 tests. | ISO 21502 §7.17 · PRINCE2 « apprendre de l'expérience » | Le jalon 4 du produit **exige** cette preuve (§1). Et huit sites répètent la même erreur parce que rien ne la porte d'un projet au suivant. | 3 j |
| **PM-03** | **Cas d'affaire tenu comme un enregistrement.** Il n'existe que comme type de document : ni chiffres, ni reconfirmation aux jalons. | PRINCE2 pratique 1 · ISO 21502 §7.2 | La chaîne demande → cas d'affaire → bénéfice → revue est **rompue en son milieu**. Personne ne peut répondre « la justification tient-elle encore ? », qui est la question que le principe de justification continue existe pour poser. | 1 sem |
| **PM-06** | **Risque résiduel et lien risque ↔ provision.** La probabilité, l'impact et la stratégie existent ; ce que la réponse est censée OBTENIR, non. La provision se tire sans nommer le risque à laquelle elle répond. | ISO 31000 §6.5 · ISO 21502 §7.9 | On ne peut pas savoir si une mitigation a servi. La provision se consomme sans qu'on puisse dire contre quoi. | 3 j |
| **PM-08** | **Clôture et transfert à l'exploitation.** `Closure` est une phase et `status` vaut `Closed` ; il n'y a ni recette prononcée, ni exploitant nommé qui reprend, ni propriétaire de bénéfice qui accepte le relais. | ISO 21502 §6.6 · PRINCE2 « Clore un projet » · ITIL 4 | Un projet se ferme sans que personne n'ait signé qu'il était fini. Les bénéfices restent au projet, donc à personne. | 3 j |
| **PM-04** | **Qualité : critères d'acceptation et revues.** « Quality » est un type de document. Aucun critère par livrable, aucune revue, aucun accepteur nommé. | ISO 21502 §7.8 · ISO 10006 · PRINCE2 « Quality » | « Terminé » est une opinion. Un jalon se franchit sur l'existence d'un fichier, pas sur le respect d'un critère. | 3 j |
| **PM-05** | **Registre des parties prenantes.** Absent. Les personnes existent comme ressources, pas comme parties prenantes avec intérêt, influence et mode d'association. | ISO 21502 §7.5 · PMBOK domaine 1 | La cause d'échec la plus fréquente des projets multi-sites n'a aucune trace dans l'outil qui prétend les gouverner. | 3 j |
| **PM-09** | **Revues d'assurance.** Aucune. | P3O · ISO 21505 · modèle des trois lignes | Ce produit a été bâti par sept comités d'assurance et n'en sait tenir aucun. Un auditeur qui demande « qui a contrôlé, et quand » n'a rien à lire. | 3 j |
| **PM-14** | **Alignement stratégique et équilibre du portefeuille.** La priorisation note adéquation/valeur/risque/effort ; aucun objectif stratégique nommé auquel un projet se rattache. | ISO 21504 · COBIT APO05 | Le portefeuille se hiérarchise mais ne se justifie pas. « Pourquoi ces douze-là » reste sans réponse écrite. | 3 j |
| **PM-12** | **Compétences dans la capacité.** L'affectation compte des ETP, jamais des savoir-faire. | ISO 21502 §7.7 | La capacité annonce « trois personnes disponibles » quand la vérité est « personne qui sache faire ça ». | 3 j |
| **PM-07** | **Profondeur d'ordonnancement.** Dépendances fin-début seulement : aucun décalage, aucun calendrier de site, aucun type de contrainte. | ISO 21502 §7.6 · PMBOK | Nommé par le comité marché comme l'un des trois retards face aux éditeurs. Un plan de site qui ignore les jours fériés locaux est faux. | 2 sem |
| **PM-10** | **Contrats et fournisseurs.** Les engagements (bons de commande) existent ; le contrat, ses jalons et la performance du fournisseur, non. | ISO 21502 §7.16 | Sur un projet industriel, l'essentiel du risque de délai est chez le fournisseur, et il est invisible. | 1 sem |
| **PM-11** | **Plan de communication.** Le mécanisme existe (notifications, comités, digest) ; le plan — qui doit être informé de quoi, à quelle fréquence — non. | ISO 21502 §7.14 | Modéré : la cadence des comités couvre l'essentiel en pratique. | 3 j |

---

## 4 · L'ordre, et le critère qui le fixe

Cinq degrés, appliqués dans cet ordre. Ce n'est pas l'effort qui classe,
ni l'exigence normative : c'est la **solidité de la chaîne**.

1. **Le produit réclame ce qu'il ne sait pas tenir** — PM-02.
   Une contradiction interne se corrige avant tout ajout.
2. **Le mécanisme qui rend une délégation sûre** — PM-01.
   Sans tolérance, déléguer, c'est espérer.
3. **Une chaîne rompue en son milieu** — PM-03, PM-06, PM-08.
   Chacune relie deux choses que Meridian tient déjà bien, par un maillon
   absent.
4. **Un registre qu'un organe de gouvernance réclamera** — PM-04, PM-05,
   PM-09, PM-14.
5. **De la profondeur là où la couverture existe** — PM-12, PM-07,
   PM-10, PM-11.

**Ordre de livraison retenu :** PM-02, PM-01, PM-03, PM-06, PM-08,
PM-04, PM-05, PM-09, PM-14, PM-12, PM-07, PM-10, PM-11.

PM-02 passe devant malgré son faible poids normatif : c'est trois jours,
et cela ferme une contradiction que le produit expose à chaque jalon 4.

---

## 5 · Ce qui est refusé, et pourquoi

« Le meilleur outil du monde » n'est pas l'outil qui fait tout. Les
refus suivants sont des décisions, pas des oublis, et ils tiennent tant
que personne ne les renverse par écrit.

- **Le suivi de tâches d'équipe.** Meridian se place au-dessus de Jira,
  d'Azure DevOps ou d'un tableau physique et rend compte du travail
  qu'ils portent. Redescendre à la tâche, c'est concurrencer des outils
  meilleurs sur ce terrain et perdre la raison d'être.
- **Le stockage de documents.** Meridian **référence** une preuve, la
  sonde, et refuse tout hôte hors liste. Devenir une GED, c'est hériter
  d'obligations de rétention et de chiffrement qu'un outil de
  gouvernance n'a pas à porter.
- **La facturation et la paie.** Les feuilles de temps servent la
  capacité et la valeur acquise. Elles ne serviront pas à payer
  quelqu'un : cela change la nature juridique de la saisie, et le comité
  GRC a déjà posé une condition d'avis social par pays (G-14).
- **Le nivellement automatique des ressources.** Un moteur qui déplace
  des travaux tout seul produit un plan que personne n'a décidé. Meridian
  montre la surcharge et nomme qui doit trancher.
- **Un assistant conversationnel sur les chiffres.** Refusé par le comité
  d'innovation ([`22`](22-comite-innovation.md)) et le refus tient : une
  réponse plausible sur un chiffre de gouvernance est pire qu'aucune
  réponse.

---

## 6 · Ce que ce dossier ne prétend pas

Il ne dit pas que Meridian sera « le meilleur outil du monde » une fois
ces treize lignes closes. Il dit ce qui manque pour qu'il soit
**conforme aux référentiels qu'il invoque** — ce qui est vérifiable,
alors que le superlatif ne l'est pas.

Le comité marché a par ailleurs établi que l'avantage réel de ce produit
n'est pas exprimable dans une grille comparative
([`24`](24-comite-marche.md) §6). Fermer ces treize lignes ajoutera des
cases cochées ; cela ne remplacera pas la preuve d'usage, qui reste le
seul actif que ce produit puisse posséder.

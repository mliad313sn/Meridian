# Comité de sécurité de l'information et de GRC — Meridian IT-PMO

Date : 29 août 2026 · Séance unique, sur pièces et sur schéma.
Objet : décider si Meridian peut être autorisé à porter des données
réelles de personnes et de projets du groupe.

---

## 0 · Frontière du mandat

Une revue technique du code siège en parallèle. Elle couvre — et a déjà
corrigé ou constaté — XSS et CSP, CSRF, injection SQL et injection de
formule dans les exports, contournement de la séparation des tâches,
exposition de l'annuaire des comptes, identifiants PostgreSQL par défaut,
ACL du répertoire d'installation, écoute réseau, signature du binaire,
jetons de session en base, limitation de débit à la connexion.

**Ce comité ne rejuge rien de cela.** Il traite la couche que personne
n'a examinée : ce qu'une direction, un auditeur externe ou un client
minier exige *avant* d'autoriser un outil à porter du réel — politiques,
cycle de vie des accès, continuité, détection, correctifs, incident,
données personnelles, tiers. Là où un constat touche le code, il est
explicitement rangé du côté **produit** ; le reste est du côté
**organisation**, et n'appartient pas à l'ingénierie.

---

## 1 · Composition, et ce que chaque siège vient vérifier

| Siège | Ce qu'il vient vérifier |
|---|---|
| **RSSI groupe** — président | Qu'un incident sur cet outil serait *vu*, *contenu*, et *racontable* ensuite. |
| **Déléguée à la protection des données** | Ce qui est réellement stocké sur les personnes, sous quelle base, pour combien de temps, et ce qui se passe le jour où quelqu'un demande l'effacement. |
| **Auditeur interne** | Qu'un contrôle affirmé est un contrôle *prouvable*, et que la preuve survit au départ de celui qui l'a produite. |
| **Responsable continuité d'activité** | Ce qu'on perd, et en combien de temps on revient. |
| **Exploitation / infrastructure** | Qui exploite réellement le poste, avec quels droits, et qui reçoit l'alarme à trois heures du matin. |
| **Achats et risque tiers** | Ce qui sortira du périmètre le jour où le relais SMTP et le locataire Entra ID seront branchés. |
| **Juridique et relations sociales** | La légalité du suivi individuel du temps et des absences, pays par pays. |
| **Référente métier, propriétaire de la donnée** (direction PMO groupe) | Que rien de ce qui précède ne rende l'outil inutilisable pour ceux qui doivent s'en servir. |

Le dernier siège est un contrepoids délibéré. Un comité qui alourdit un
outil jusqu'à l'abandon n'a rien protégé : il a seulement remis les
données dans les tableurs, où il n'y a ni piste d'audit ni périmètre.

---

## 2 · Constaté avant d'exiger — ce qui existe déjà

Le comité a lu le schéma et le code avant de parler. Il refuse de
réclamer ce qui est déjà là. Ce qui suit est **acquis** et n'est pas
rouvert :

| Acquis | Preuve |
|---|---|
| Piste d'audit transactionnelle et en ajout seul | `server/migrations/001_core.sql` : `RULE audit_no_update` / `audit_no_delete` — la réécriture échoue *à la base*, pas à l'application. `server/src/audit.js` : l'insertion partage la transaction de la mutation. |
| Images avant/après sur les suppressions | `audit_event.before_json` / `after_json`, alimentés route par route. |
| Modèle d'autorité écrit, unique, testé des deux côtés | `shared/rbac.js`, décrit dans `docs/04-access-model.md` ; hors périmètre = 404, pas 403. |
| Le dernier administrateur ne peut pas être supprimé | `server/src/routes/admin.js:90-95` → 409 « This is the last active administrator ». |
| La désactivation d'un compte tue ses sessions immédiatement | `admin.js:116` et `:136` — `DELETE FROM session WHERE user_id = $1`. |
| Session bornée à douze heures | `server/src/auth.js:19` — `SESSION_TTL_MS = 12h`, purge des expirées. |
| Changement de mot de passe imposé après création ou réinitialisation admin | `admin.js:65`, `:131` — `setPassword(…, { mustChange: true })`. |
| Dernière connexion visible dans l'écran d'administration | `web/src/views/administration.js:251` — affiche « never ». La matière d'une revue de comptes dormants existe déjà. |
| Traçabilité des consultations sensibles | `server/src/routes/portfolio.js:2425, 2443, 2508, 2659` — pack de preuves, export de jeu de données, piste d'audit, registre des décisions. Rare, et à porter au crédit du produit. |
| Suppléance bornée, jamais élargissante, et audit nommant les deux | `015_rotation.sql` + `session.acting_for`. |
| Surface de dépendances minimale | `package.json` : quatre dépendances d'exécution (`express`, `pg`, `cookie-parser`, `pglite`), verrou de version présent. |
| Honnêteté sur le non-configuré | `docs/18-amdec-recette.md` §Acceptations : SMTP, Entra ID et `documentHosts` — fermé par défaut, et le dit. |

Le niveau d'ingénierie de la traçabilité est au-dessus de ce que ce
comité rencontre habituellement. C'est précisément ce qui rend l'écart de
gouvernance frappant : **le produit est plus rigoureux que
l'organisation qui l'entoure.**

---

## 3 · Les données personnelles réellement présentes

Relevé au schéma, pas à l'intuition. Aucune donnée inventée.

| Table | Données à caractère personnel | Sensibilité |
|---|---|---|
| `person` (001, 012) | nom, fonction, site, **taux journalier**, employeur (`staff`/`contractor`), fournisseur, rotation, disponibilité | rémunération indirecte |
| `app_user` (001, 015) | courriel, nom affiché, rôle, dernière connexion, langue, préférence de notification | identité |
| `person_absence` (015) | personne, dates, **motif dont `sick`**, **note libre**, suppléant | **art. 9 RGPD — santé** |
| `timesheet` (016) | jours travaillés par personne × projet × semaine, saisis par un tiers (`entered_by`) | temps de travail |
| `notification` (013) | courriel destinataire, **sujet et corps conservés**, état d'envoi | correspondance |
| `session` (001, 015) | agent utilisateur, expiration, pour qui l'on agit | traçage |
| `audit_event` (001) | tout ce qui précède, en image avant/après, **indélébile** | agrégat |

C'est cette dernière ligne qui structure tout le reste du rapport.

---

## 4 · Constats

Classement : **bloquant** = interdit la mise en production sur données
réelles ; **majeur** = à clore dans le trimestre suivant la mise en
production ; **moyen** = à planifier.

### Bloquants

---

**G-01 · Il n'existe aucune sauvegarde, ni aucun test de restauration.**
*(organisation)*

**Constat.** `docs/13-windows-service.md` documente la fabrication,
l'installation, la mise à jour, les actions de reprise du service et la
rotation des journaux. Il ne dit pas un mot de la sauvegarde de la base.
Une recherche sur `sauvegarde|backup|pg_dump|RPO|RTO` dans `docs/` et
`README.md` **ne renvoie aucun résultat** — les seules occurrences de
« restauration » désignent la restauration d'une ligne depuis la piste
d'audit (R-12), qui est une fonctionnalité, pas une sauvegarde.

**Risque métier.** Le livre du portefeuille *et* la piste d'audit vivent
dans une seule base PostgreSQL locale. Un disque, un rançongiciel, une
erreur d'exploitation : on perd le portefeuille, et surtout on perd la
preuve d'assurance que l'outil existe pour produire. Un client minier
qui audite les jalons obtient : rien.

**Référentiel.** ISO 27001 A.8.13 (sauvegarde des informations), A.5.29,
A.5.30 · NIST CSF 2.0 **PR.DS**, **RC.RP-01**.

**Mesure de clôture.** Un test de restauration **daté et chronométré**,
exécuté sur un poste *autre* que le poste de production, à partir d'une
sauvegarde de moins de vingt-quatre heures, et se terminant par :
`/api/health` → `{"ok":true,"engine":"postgres"}`, et un décompte de
`audit_event` identique à la source. RTO et RPO chiffrés et signés par
le mandant. Sans ce compte rendu, le constat reste ouvert.

---

**G-02 · Le point de défaillance unique n'est déclaré nulle part, et il
n'existe pas de fiche de reprise.** *(organisation)*

**Constat.** Service `MeridianITPMO`, LocalSystem, sur un poste, base
PostgreSQL 17 locale (`13-windows-service.md`). Les actions de reprise
configurées — redémarrage à 10 s, 60 s, 120 s — traitent la mort du
**processus**. Rien ne traite la mort du **poste**.

**Risque métier.** Le délai de remise en service n'est pas connu, donc il
n'est pas promis, donc il ne peut pas être tenu. Le comité de pilotage
groupe perd sa source de décision pendant une durée que personne ne sait
annoncer.

**Référentiel.** ISO 27001 A.5.29, A.5.30, A.8.14 (redondance) ·
NIST CSF 2.0 **RC.RP**, **PR.IR-04**.

**Mesure de clôture.** Une fiche de reprise d'une page, *exécutée une
fois* : temps mesuré entre « le poste est mort » et « un utilisateur se
reconnecte », à partir des seuls artefacts conservés
(`MeridianSetup.exe` + sauvegarde). Chiffre attendu au dossier, signé par
l'exploitant.

---

**G-03 · Une donnée de santé est saisissable, propagée en clair dans une
table indélébile, et lisible par tout compte de niveau `group`.**
*(produit + organisation)*

**Constat.** Trois faits qui, séparément, seraient mineurs :

1. `server/migrations/015_rotation.sql:25-27` — le motif d'absence est
   contraint à `CHECK (reason IN ('rotation','leave','training','sick'))`,
   plus un champ `note` en texte libre.
2. `server/src/routes/portfolio.js:1277-1279` — la suppression d'une
   absence écrit `before: { ...a }`, c'est-à-dire **la ligne entière**,
   motif et note comprises, dans `audit_event.before_json`. La déclaration
   écrit déjà le motif dans `detail` :
   `` `${b.person} · ${b.from} → ${b.to} (${reason})` `` (ligne 1233).
3. `shared/rbac.js:224` — `audit.read` est accordé à `group` **sans
   aucun périmètre**. Un responsable de programme lit donc la piste
   entière, tous sites confondus.

Conjugués, et avec la règle `audit_no_delete` de `001_core.sql`, ils
donnent : *le motif médical d'une absence d'un technicien de São Paulo
est lisible à perpétuité par tout responsable de programme du groupe, et
techniquement ineffaçable.*

**Risque métier.** Catégorie particulière au sens de l'article 9 du
RGPD, collectée sans base légale documentée, sans minimisation, sans
restriction d'accès et sans horizon d'effacement. Un délégué à la
protection des données externe bloque la mise en production sur ce seul
point. En droit du travail, l'exposition d'un motif de santé à la ligne
hiérarchique élargie est un contentieux, pas un risque théorique.

**Référentiel.** ISO 27001 A.5.34 (protection des DCP), A.5.12
(classification), A.8.3 (restriction d'accès) · NIST CSF 2.0
**GV.OC-03**, **PR.DS-01**, **PR.AA-05**.

**Mesure de clôture, en trois actes vérifiables.**
- *Produit* : retirer `sick` du vocabulaire des motifs — un outil de
  rotation n'a pas besoin de savoir pourquoi, `leave` suffit — et
  remplacer `before: { ...a }` par une projection qui conserve personne,
  dates, suppléant et motif, et **abandonne `note`**.
- *Produit* : restreindre la lecture de la piste sur l'entité
  `person_absence` au périmètre du lecteur, ou à l'administrateur.
- *Organisation* : purge unique, elle-même consignée (voir §6).

**Chiffre de clôture** : `SELECT count(*) FROM audit_event WHERE
detail LIKE '%(sick)%' OR before_json::text LIKE '%sick%'` → **0**.

---

### Majeurs

---

**G-04 · Aucune politique écrite n'existe : ni sécurité, ni classification,
ni mot de passe, ni gestion des accès.** *(organisation)*

**Constat.** `docs/` contient dix-neuf documents. Aucun n'est une
politique. `04-access-model.md` est un excellent **modèle d'autorité** —
ce n'est pas une politique : il décrit ce que le code fait, pas ce que
l'organisation exige. La règle de mot de passe existe uniquement dans le
code (`server/src/auth.js:25` : « Password must be at least 8
characters »), sans complexité, sans historique, sans expiration, et
n'est écrite nulle part où un auditeur la chercherait.

**Risque métier.** Le premier questionnaire de sécurité d'un client
minier commence par « fournissez votre politique de sécurité de
l'information ». La réponse actuelle est un silence, quelle que soit la
qualité réelle du produit.

**Référentiel.** ISO 27001 A.5.1 (politiques), A.5.10, A.5.12, A.5.17
(informations d'authentification) · NIST CSF 2.0 **GV.PO-01**.

**Mesure de clôture.** Quatre pages, datées et approuvées nommément :
politique de sécurité, classification des données à trois niveaux,
politique de mot de passe, procédure de gestion des accès. La règle de
huit caractères est soit confirmée par écrit, soit relevée — et le code
s'aligne **sur l'écrit**, jamais l'inverse.

---

**G-05 · Le cycle de vie des accès (arrivée, mutation, départ) n'est
défini nulle part.** *(organisation)*

**Constat.** Les *mécanismes* sont complets et audités :
`POST /admin/users`, `PATCH /admin/users/:id` (dont `active`),
`POST /admin/users/:id/grants` et `…/grants/revoke`, et la désactivation
tue les sessions (`admin.js:116`). Ce qui n'existe pas : qui demande,
qui approuve, sous quel délai un départ RH devient `active = false`, et
qui vérifie que c'est arrivé.

**Risque métier.** Un compte d'un partant reste ouvert jusqu'à ce que
quelqu'un y pense. C'est le scénario d'incident le plus banal du
secteur, et le seul dont l'outil a déjà toute la mécanique pour se
protéger.

**Référentiel.** ISO 27001 A.5.16 (gestion des identités), A.5.18
(droits d'accès), A.6.5 (responsabilités à la fin du contrat) ·
NIST CSF 2.0 **PR.AA-01**, **PR.AA-05**.

**Mesure de clôture.** Un formulaire d'une page (demandeur, approbateur,
niveau, périmètre demandé, durée), un délai cible écrit — *départ
répercuté sous vingt-quatre heures ouvrées* — et, au premier trimestre,
un rapprochement : 100 % des départs RH constatés `active = false`, avec
l'écart maximal en jours.

---

**G-06 · Aucune revue périodique des habilitations, aucune revue des
comptes dormants.** *(organisation)*

**Constat.** La matière est là — `last_login_at` est stockée et affichée,
« never » compris (`administration.js:251`) — et personne n'est chargé de
la lire. Aucune cadence, aucun signataire, aucun compte rendu.

**Risque métier.** Les habilitations ne se réduisent jamais d'elles-mêmes.
Un chef de site muté conserve son site d'origine ; un responsable de
programme accumule ses programmes successifs. Au bout de deux ans, le
modèle d'autorité — qui est bon — décrit une réalité qui ne l'est plus.

**Référentiel.** ISO 27001 A.5.18 · NIST CSF 2.0 **PR.AA-05**, **ID.AM**.

**Mesure de clôture.** Une revue trimestrielle, datée et signée par la
référente métier, portant sur la liste des comptes et de leurs grants.
Chiffres attendus à la première revue : **0** compte actif sans
connexion depuis quatre-vingt-dix jours, et un nombre d'administrateurs
**nommé et justifié**.

---

**G-07 · Le compte de rupture est un compte comme les autres, sans
scellement ni distinction du nominatif.** *(organisation)*

**Constat.** `docs/04-access-model.md` §6 désigne
`admin@meridian.example` comme « the break-glass account » ;
`server/src/seed.js:32-33` crée deux comptes `admin` — celui-là et un
compte nominatif. Rien ne distingue procéduralement un compte de service
d'un compte de personne ; le mot de passe de rupture n'est pas sous pli,
et son usage ne déclenche rien.

**Risque métier.** Un acte administrateur ne peut être imputé à une
personne si deux personnes peuvent être derrière le même compte. Toute
la valeur de la piste d'audit repose sur l'imputabilité.

**Référentiel.** ISO 27001 A.5.16, A.8.2 (droits d'accès privilégiés) ·
NIST CSF 2.0 **PR.AA-05**.

**Mesure de clôture.** Mot de passe de rupture sous pli scellé ou en
coffre, dépositaire nommé ; chaque emploi justifié par écrit dans les
vingt-quatre heures et revu au trimestre. Chiffre : **0** usage non
justifié.

---

**G-08 · Les échecs d'authentification ne sont pas journalisés.**
*(produit)*

**Constat.** `server/src/routes/auth.js:54-58` audite la connexion
réussie (« Signed in »). Le chemin d'échec, lignes 45-50, appelle
uniquement `recordFailure(key)` — un compteur **en mémoire**, dont le
commentaire du fichier dit lui-même qu'il est perdu au redémarrage. La
table `audit_event` ne contient donc **aucune trace** d'une campagne de
pulvérisation de mots de passe, ni même d'un collègue qui essaie le
compte d'un autre.

**Risque métier.** Après un incident, la question « depuis quand
essaie-t-on d'entrer ? » n'a pas de réponse. La limitation de débit
empêche l'attaque rapide ; elle ne raconte rien.

**Référentiel.** ISO 27001 A.8.15 (journalisation), A.8.16 (surveillance
des activités) · NIST CSF 2.0 **DE.CM-01**, **DE.CM-03**, **DE.AE-02**.

**Mesure de clôture.** Une ligne `audit_event` par échec — action
« Sign-in refused », adresse et empreinte de l'identifiant tenté — **sans
révéler l'existence du compte**, contrainte que le code respecte déjà
délibérément par ailleurs. Test : dix échecs rejoués → dix lignes
lisibles dans l'écran d'administration.

---

**G-09 · Aucune exportation vers un SIEM, aucune rétention décidée,
aucun lecteur désigné.** *(organisation, produit à la marge)*

**Constat.** La piste est lisible et exportable dans le produit, et sa
consultation est elle-même tracée (`portfolio.js:2508`) — c'est bien.
Mais : aucun flux syslog ni fichier structuré vers l'extérieur ; aucune
règle de rétention — la règle `audit_no_delete` rend la purge
techniquement impossible, si bien que la rétention réelle est
« infinie par construction », ce qui n'est pas une décision, c'est un
effet de bord ; et les journaux du service
(`C:\Apps\Meridian\logs`, 10 Mo × 8 selon `13-windows-service.md`)
tournent et s'écrasent, ce qui est une rétention de fait que personne
n'a choisie non plus.

**Risque métier.** Personne ne lit. Un événement détectable passe donc
inaperçu, et l'organisation apprend l'incident par son client.

**Référentiel.** ISO 27001 A.8.15, A.5.33 (protection des
enregistrements) · NIST CSF 2.0 **DE.CM**, **RS.AN-03**.

**Mesure de clôture.** Une durée de conservation écrite **par catégorie**
(piste applicative, journaux de service, file de notifications), un
destinataire nommé, une fréquence de lecture ; puis soit un export daté
vers le SIEM du groupe, soit une renonciation écrite et motivée du RSSI.

---

**G-10 · Réponse à incident : personne à appeler, aucun délai, aucun
interrupteur.** *(organisation + produit)*

**Constat.** Aucun document de réponse à incident. Techniquement, la
révocation de **toutes** les sessions d'un coup n'existe que dans
`server/src/reset-book.js:71` (`DELETE FROM session`), qui réinitialise
aussi le livre : un exploitant en crise n'a donc pas d'outil sûr. La
désactivation compte par compte fonctionne et coupe les sessions
(`admin.js:116`), mais suppose de savoir quel compte.

**Risque métier.** Un jeton volé reste valable jusqu'à douze heures.
C'est court en régime normal, très long à trois heures du matin quand la
seule option connue est un script qui efface le portefeuille.

**Référentiel.** ISO 27001 A.5.24 à A.5.28 · NIST CSF 2.0 **RS.MA**,
**RS.CO-02**, **RC.RP**.

**Mesure de clôture.** *Organisation* : une fiche d'une page — qui
appelle qui, sous combien de temps, ce qu'on préserve avant de toucher.
*Produit* : une commande d'administration « révoquer toutes les
sessions », tracée. Test : sessions à 0, chacun se reconnecte, une ligne
d'audit nomme qui a coupé et quand.

---

**G-11 · Gestion des vulnérabilités : aucune cadence, et `npm run audit`
n'audite pas les dépendances.** *(produit + organisation)*

**Constat.** `package.json:19` — le script nommé `audit` enchaîne cinq
sondes maison (`route-match`, `crud-audit`, `version-audit`,
`control-audit`, `i18n-audit`) qui vérifient la cohérence interne du
produit. Elles sont utiles ; elles ne regardent aucune dépendance.
`npm audit` n'apparaît nulle part dans le dépôt, et `verify` = `test` +
`build` + ces sondes. Le nom prête à confusion : on peut croire, de bonne
foi, que les dépendances sont surveillées.

À l'inverse, un point fort à porter au dossier : **quatre** dépendances
d'exécution seulement. La surface est faible — c'est un atout, pas une
dispense.

**Risque métier.** Une CVE sur `express` ou `pg` n'est vue par personne,
puisque personne n'a la charge de regarder ni la date à laquelle
regarder.

**Référentiel.** ISO 27001 A.8.8 (gestion des vulnérabilités
techniques), A.8.19 · NIST CSF 2.0 **ID.RA-01**, **RS.MI**.

**Mesure de clôture.** `npm audit --omit=dev` ajouté à la chaîne
`verify` ; délais de correction écrits — critique 7 jours, élevée
30 jours, moyenne au prochain jalon — et un décideur nommé pour
l'acceptation d'un report. Chiffre au trimestre : **0** vulnérabilité
critique ouverte au-delà de sept jours.

---

**G-13 · Base légale, durée de conservation et information des personnes
sont absentes du dossier.** *(organisation, avec deux tâches produit)*

**Constat.** Le relevé du §3 est le premier document du projet à
énumérer les données personnelles stockées. Il n'existe ni registre de
traitement, ni base légale déclarée, ni durée par catégorie, ni note
d'information aux personnes concernées. Deux tables grossissent sans
horizon : `notification` conserve courriel, sujet **et corps** sans purge
(`013_notifications.sql`), `timesheet` conserve l'effort individuel
semaine par semaine (`016_timesheet.sql`).

Détail que le comité relève sans ironie : le jeu de démonstration
contient lui-même une tâche terminée intitulée « Audit trail retention
policy » (`server/src/seed-data.js:272`). Le livre fictif sait que la
question existe ; le produit réel n'y a pas répondu.

**Risque métier.** Sans base légale ni durée, chaque demande d'accès ou
d'effacement se traite au cas par cas, dans l'urgence, par quelqu'un qui
improvise. C'est ainsi que naissent les réponses qui engagent le groupe.

**Référentiel.** ISO 27001 A.5.34, A.5.12, A.5.31 · NIST CSF 2.0
**GV.OC-03**, **GV.RR**.

**Mesure de clôture.** Un registre de traitement d'une page — finalité
(pilotage de portefeuille), base légale (intérêt légitime, à confirmer
par le juridique), catégories, destinataires, durées — plus une note
d'information aux personnes concernées diffusée par les RH. *Produit* :
une purge programmée appliquant la durée retenue à `notification` et à
`timesheet`, et un compteur consultable de ce qu'elle a supprimé.

---

### Moyens

---

**G-12 · La chaîne de fabrication du produit n'a aucune preuve de
revue.** *(organisation)*

**Constat.** `git log` renvoie **un seul commit** pour la totalité du
produit. Pas d'intégration continue, pas de branche protégée, pas de
signature, pas de relecteur nommé. Un auditeur client qui demande « qui a
revu ce build, et quand » n'obtient rien — alors que le produit lui-même
exige désormais une preuve ouvrable pour chaque jalon (R-01).

**Risque métier.** Faible aujourd'hui, croissant à chaque version : c'est
le jour de la deuxième livraison que l'absence de traçabilité coûte.

**Référentiel.** ISO 27001 A.8.25 à A.8.32 (développement sécurisé,
gestion des changements, séparation des environnements) · NIST CSF 2.0
**PR.PS-06**, **ID.RA-09**.

**Mesure de clôture.** À partir de la prochaine version : un commit par
lot fonctionnel avec relecteur nommé, et un numéro de version exposé par
`/api/health` que l'on puisse rapprocher du dépôt.

---

**G-14 · Le suivi individuel du temps n'a fait l'objet d'aucun avis
social ni juridique.** *(organisation)*

**Constat.** `timesheet` (016) enregistre les jours travaillés par
personne, par projet et par semaine, saisis le cas échéant **par un
tiers** (`entered_by`). Dans plusieurs pays où le groupe opère, un suivi
individuel du temps de travail relève de l'information-consultation des
représentants du personnel. Aucune pièce du dossier ne montre cette
consultation.

**Risque métier.** Un déploiement suspendu après coup, par un site, sur
un motif qui n'était pas technique — le pire moment pour découvrir la
question.

**Référentiel.** ISO 27001 A.5.31 (exigences légales et contractuelles),
A.5.34 · NIST CSF 2.0 **GV.OC-03**.

**Mesure de clôture.** Un avis écrit juridique/RH **par pays**, avant
activation de la saisie sur les sites concernés. Chiffre : **0** site
activé sans avis au dossier.

---

**G-15 · Les secrets n'ont ni dépositaire ni rotation.** *(organisation)*

**Constat.** `meridian.config.json` porte `DATABASE_URL` en clair sur le
poste (`13-windows-service.md` §Configuration). `.env` est correctement
exclu du dépôt (`.gitignore`). Les mots de passe de démonstration sont
dans `server/src/seed.js` et dans le README — accepté explicitement pour
une instance de démonstration (AMDEC C-04), et à ne pas confondre avec
une instance réelle. Trois secrets sont attendus du mandant :
`MERIDIAN_SMTP_URL`, `MERIDIAN_OIDC_CLIENT_SECRET`, et le paramétrage
Entra associé (`18-amdec-recette.md` §Acceptations). Aucun dépositaire,
aucune rotation, aucune liste.

**Référentiel.** ISO 27001 A.5.17, A.8.24 · NIST CSF 2.0 **PR.AA-01**.

**Mesure de clôture.** Une liste des secrets avec dépositaire, coffre et
date de dernière rotation ; rotation annuelle **et à chaque départ d'un
dépositaire**.

---

**G-16 · Les tiers ne sont pas évalués, et deux d'entre eux sont déjà
prévus.** *(organisation)*

**Constat.** Le jour où le relais SMTP est branché, des noms, des
adresses et des **corps de message** sortent du périmètre — la table
`notification` conserve `subject` et `body`. Le jour où Entra ID est
branché, la disponibilité de Meridian dépend d'un fournisseur d'identité
dont la reprise n'est décrite nulle part. Aucune évaluation, aucune
clause, aucune question sur la localisation des données.

**Référentiel.** ISO 27001 A.5.19 à A.5.23 (relations fournisseurs,
services en nuage) · NIST CSF 2.0 **GV.SC-01**, **GV.SC-06**,
**GV.SC-07**, **ID.RA-10**.

**Mesure de clôture.** Une fiche de deux pages par tiers — données
transmises, localisation, engagement de disponibilité, conditions de
sortie — **avant** branchement. Règle simple : pas de fiche, pas de
branchement.

---

**G-17 · Rien ne classe ce qui sort du produit.** *(produit léger +
organisation)*

**Constat.** Les consultations sensibles sont tracées, et c'est un
acquis (R-14, quatre surfaces). Mais un CSV exporté, un pack de preuves
ou un export de la piste ne portent aucune mention de confidentialité :
une fois sortis, ils sont libres, et leur destinataire ne sait pas ce
qu'il tient.

**Référentiel.** ISO 27001 A.5.12, A.5.13 (marquage), A.8.12 (prévention
de la fuite de données) · NIST CSF 2.0 **PR.DS-01**, **PR.DS-02**.

**Mesure de clôture.** Une échelle à trois niveaux dans la politique de
classification (G-04), et une mention portée par les exports —
en-tête CSV, pied de page du pack. Test : ouvrir chacun des quatre
exports, y lire le niveau.

---

## 5 · Produit ou organisation — la séparation

C'est la distinction la plus utile que ce comité rende. **Onze constats
sur dix-sept ne se codent pas.** Aucune version du logiciel ne les
fermera ; ils appartiennent au mandant, qui doit décider et écrire.

| À coder (produit) | À décider et écrire (organisation) |
|---|---|
| **G-03** retirer `sick`, projeter l'image d'audit, restreindre la lecture | **G-01** sauvegarde et test de restauration |
| **G-08** journaliser les échecs de connexion | **G-02** fiche de reprise du poste |
| **G-10** commande « révoquer toutes les sessions » | **G-04** les quatre politiques |
| **G-11** `npm audit` dans `verify` | **G-05** cycle de vie des accès |
| **G-13** purge programmée `notification` / `timesheet` | **G-06** revue trimestrielle des habilitations |
| **G-17** mention de classification sur les exports | **G-07** scellement du compte de rupture |
| | **G-09** rétention, lecteur, export SIEM |
| | **G-12** provenance des versions |
| | **G-13** registre de traitement et information |
| | **G-14** avis social et juridique par pays |
| | **G-15** dépositaire et rotation des secrets |
| | **G-16** fiches tiers SMTP et Entra ID |

Une équipe d'ingénierie peut fermer la colonne de gauche en quelques
jours. La colonne de droite est un travail de direction, et rien ne la
remplace.

---

## 6 · La question de fond : piste inviolable contre droit à l'effacement

Le comité refuse de trancher cette tension par un slogan. Les deux
exigences sont réelles, et aucune ne cède en bloc.

D'un côté, `RULE audit_no_delete` est ce qui donne sa valeur à
l'ensemble : une preuve que l'application peut effacer n'est pas une
preuve. C'est un acquis explicitement protégé
(`docs/17-instructions-reserves.md`), et le comité le confirme.

De l'autre, le RGPD ne connaît pas d'exception « nous avons choisi une
architecture en ajout seul ».

La sortie tient en cinq points, dans cet ordre.

**1 · Distinguer la preuve de l'acte de la donnée personnelle qu'elle
transporte.** Ce qui rend la piste probante, c'est : *qui*, *quand*,
*quel acte*, *sur quel objet*, *quel changement matériel*. Ce n'est ni la
note libre, ni le motif médical. Ces derniers sont dans la piste par
commodité de code (`before: { ...a }`), pas par nécessité de preuve.

**2 · Minimiser à la source — c'est là que se joue l'essentiel.** Ne pas
mettre dans la piste ce qu'il faudra en retirer. Retirer `sick` du
vocabulaire supprime **une catégorie entière de l'article 9** du système
par un `CHECK` d'une ligne. Projeter l'image avant plutôt que copier la
ligne supprime le texte libre. Ces deux gestes de produit rendent 90 %
du problème sans effleurer l'inviolabilité.

**3 · Pour ce qui reste, effacer c'est pseudonymiser, pas supprimer.**
Une demande d'effacement se traite en remplaçant, dans `person` et
`app_user`, le nom et le courriel par une pierre tombale
(« Personne effacée · PE-14 »), l'identifiant technique restant en place
pour ne rompre aucune référence. Attention : `audit_event.user_label`
est une **copie textuelle dénormalisée** du nom au moment de l'acte
(`server/src/audit.js:29`) ; elle survivrait à l'opération. L'effacement
doit donc couvrir `user_label` et les champs `detail` qui nomment la
personne.

**4 · Ce geste-là est le seul qui doive pouvoir lever la règle en ajout
seul — et il ne doit pas exister comme route applicative.** Une
procédure écrite, exécutée sur la base, à double signature
administrateur + déléguée à la protection des données, consignée dans un
registre **tenu hors du système**. On ne donne pas à l'application le
pouvoir de réécrire sa propre histoire ; on donne à deux personnes
identifiées le pouvoir d'exécuter un acte exceptionnel qui laisse une
trace ailleurs. La distinction n'est pas cosmétique : elle est ce qui
permet de continuer à affirmer que la piste est inviolable *par
l'application*.

**5 · Déclarer la durée, ce qui vide la question de l'essentiel de sa
charge.** Le comité recommande d'aligner la conservation de la piste sur
la rétention financière du groupe — sept ans est l'ordre de grandeur
usuel, le mandant tranche — au motif que la piste fonde la preuve
d'immobilisation des dépenses. Une durée **décidée** est la réponse
propre à « infinie par construction » ; et un horizon de purge rend la
plupart des demandes d'effacement sans objet à terme, tout en permettant
de répondre honnêtement à la personne : *voici ce que nous conservons,
pour quel motif, et jusqu'à quand.*

L'article 17.3 du RGPD couvre la conservation d'une preuve d'acte au
titre des obligations légales et de la constatation de droits. Il ne
couvre ni la note libre, ni le motif de santé. **C'est exactement
pourquoi le point 2 compte plus que tous les autres.**

---

## 7 · Registre de risques

### Ce qui a été fait depuis

Sur les six constats dont une part relevait du produit, **cinq sont
traités** au 30/08/2026 :

- **G-03** (donnée de santé indélébile, bloquant) — le motif médical
  est sorti du schéma (migration 017) et la note libre ne rejoint plus
  la piste ineffaçable. Minimisation à la source plutôt que protection
  d'une donnée de l'article 9.
- **G-08** — les échecs de connexion sont comptés par jour, en agrégat
  (`usage_daily`, migration 021). Le compteur en mémoire limitait le
  débit sans rien raconter ; celui-ci raconte le volume sans jamais
  pouvoir dire qui, faute de colonne pour le dire.
- **G-10** — l'interrupteur existe : `POST /admin/sessions/revoke-all`,
  réservé à l'administration, tracé, et il termine aussi la session de
  celui qui appuie. La procédure d'incident reste à écrire, et c'est
  une décision d'organisation.
- **G-11** — `npm run verify` échoue désormais sur une vulnérabilité
  de gravité haute (`audit:deps`). Le script nommé `audit` n'en
  vérifiait aucune : le nom mentait, il ne ment plus. La cadence de
  mise à jour reste une décision d'organisation.
- **G-13** — la purge programmée existe pour les notifications, et
  **refuse de s'exécuter** tant qu'aucune durée n'est écrite : combien
  de temps on garde la trace de ce qu'on a dit à qui est une décision
  du mandant, et le code ne la prendra pas à sa place.
- **G-17** — un export CSV et un dossier de preuve portent maintenant,
  sur eux, ce qu'ils sont et à qui ils ont été remis. Un export anonyme
  se retrouve un jour sur une clé, et plus personne ne sait d'où il
  vient.

**Les onze autres constats relèvent de l'organisation** et n'ont pas
bougé : ils attendent des décisions, pas du code. Les trois bloquants
restants — la sauvegarde éprouvée (G-01) et la reprise du poste unique
(G-02) — en font partie.


| # | Constat | Gravité | Nature | Contrôle ISO 27001 | Fonction NIST CSF 2.0 |
|---|---|---|---|---|---|
| G-01 | Aucune sauvegarde ni test de restauration | **Bloquant** | Organisation | A.8.13, A.5.29, A.5.30 | Récupérer |
| G-02 | Point de défaillance unique, pas de fiche de reprise | **Bloquant** | Organisation | A.5.29, A.5.30, A.8.14 | Récupérer / Protéger |
| G-03 | Donnée de santé indélébile et largement lisible | **Bloquant** | Produit + orga. | A.5.34, A.5.12, A.8.3 | Gouverner / Protéger |
| G-04 | Aucune politique écrite | Majeur | Organisation | A.5.1, A.5.10, A.5.12, A.5.17 | Gouverner |
| G-05 | Cycle de vie des accès non défini | Majeur | Organisation | A.5.16, A.5.18, A.6.5 | Protéger |
| G-06 | Pas de revue des habilitations ni des dormants | Majeur | Organisation | A.5.18 | Protéger / Identifier |
| G-07 | Compte de rupture non scellé | Majeur | Organisation | A.5.16, A.8.2 | Protéger |
| G-08 | ~~Échecs de connexion non journalisés~~ **part produit FAITE 30/08** | Majeur | Produit | A.8.15, A.8.16 | Détecter |
| G-09 | Ni SIEM, ni rétention, ni lecteur | Majeur | Organisation | A.8.15, A.5.33 | Détecter / Répondre |
| G-10 | Interrupteur **FAIT 30/08** ; procédure d'incident : organisation | Majeur | Orga. + produit | A.5.24 – A.5.28 | Répondre / Récupérer |
| G-11 | ~~`audit` trompeur~~ **part produit FAITE 30/08** ; cadence : organisation | Majeur | Produit + orga. | A.8.8, A.8.19 | Identifier / Répondre |
| G-13 | Base légale, durées et information absentes | Majeur | Orga. + produit | A.5.34, A.5.12, A.5.31 | Gouverner |
| G-12 | Aucune provenance des versions | Moyen | Organisation | A.8.25 – A.8.32 | Protéger / Identifier |
| G-14 | Suivi du temps sans avis social | Moyen | Organisation | A.5.31, A.5.34 | Gouverner |
| G-15 | Secrets sans dépositaire ni rotation | Moyen | Organisation | A.5.17, A.8.24 | Protéger |
| G-16 | Tiers SMTP et Entra ID non évalués | Moyen | Organisation | A.5.19 – A.5.23 | Gouverner |
| G-17 | ~~Rien ne classe ce qui sort~~ **FAIT 30/08** | Moyen | Produit + orga. | A.5.12, A.5.13, A.8.12 | Protéger |

**Répartition : 3 bloquants, 9 majeurs, 5 moyens.**

---

## 8 · Ordre de traitement

**Vague 0 — avant toute donnée réelle. Non négociable.**
G-03 (les deux gestes de produit), G-01 (sauvegarde + un test réussi),
G-04 (les quatre politiques), G-13 (registre et information).
Sans ces quatre, le comité ne peut pas autoriser l'outil à porter du
réel, quelle que soit la qualité du produit.

**Vague 1 — premier mois d'exploitation.**
G-02, G-05, G-08, G-10, G-15.

**Vague 2 — premier trimestre.**
G-06, G-07, G-09, G-11, G-14, G-16.

**Vague 3 — à la prochaine version.**
G-12, G-17.

L'ordre suit le dommage, pas la difficulté. G-04 est en vague 0 non
parce qu'un document protège quoi que ce soit, mais parce que sans lui
aucun des autres constats n'a de propriétaire.

---

## 9 · Verdict

**Autorisation refusée en l'état, pour trois motifs qui ne portent pas
sur le logiciel.** Meridian est mieux instrumenté que la plupart des
outils que ce comité examine — piste transactionnelle indélébile, modèle
d'autorité unique et testé, consultations sensibles tracées, honnêteté
explicite sur ce qui n'est pas configuré — mais il n'existe aujourd'hui
ni sauvegarde éprouvée, ni plan de reprise du poste unique qui le porte,
ni base légale pour une donnée de santé que le schéma accepte et que la
piste rend ineffaçable.

**Ces trois points se ferment en quelques jours** : deux modifications de
produit d'une demi-journée, un test de restauration chronométré, et
quatre pages signées par le mandant. Le comité se déclare prêt à
prononcer l'autorisation sur constat de ces mesures, sans nouvelle
séance.

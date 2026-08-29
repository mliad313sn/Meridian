# Recette finale par AMDEC — Meridian IT-PMO

Date : 29 août 2026 · Dernier acte de la campagne `/goal-reserves`
(étape C), après la levée des quinze réserves du comité indépendant
([16-comite-independant.md](16-comite-independant.md)) et la clôture de la
boucle de re-test (deux tours consécutifs intégralement conformes).

## Méthode

Chaque réserve levée est réexaminée comme un **mode de défaillance
résiduel** : qu'est-ce qui pourrait encore faire défaut *après* la
correction, en exploitation réelle ? Trois notes de 1 à 10 :

- **S** — sévérité si la défaillance survient ;
- **O** — occurrence : probabilité qu'elle survienne, verrous compris ;
- **D** — détection : 1 = détectée immédiatement par une porte automatique,
  10 = invisible jusqu'au préjudice.

**RPN = S × O × D.** Portes de recette, convenues avant notation :
aucun RPN ≥ 100, aucun mode avec S ≥ 9 **et** D ≥ 7. Les notes O et D
s'appuient sur les mesures du dernier tour (tour 3), pas sur l'intention.

## Les quinze modes de défaillance résiduels

| Réserve | Mode de défaillance résiduel | S | O | D | RPN | Ce qui le tient |
|---|---|--:|--:|--:|--:|---|
| R-01 preuve | Un déploiement laisse `documentHosts` mal réglé et les approbations s'arrêtent (fermé par défaut) — ou l'hôte de confiance héberge des liens morts | 8 | 2 | 2 | **32** | Fermé par défaut *en le disant* ; refus 400 testés aux trois niveaux à chaque tour ; empreinte figée + retombée en revue sur changement de lien |
| R-02 rotation | Une absence n'est pas déclarée et la suppléance n'existe pas ce jour-là | 6 | 3 | 3 | **54** | Déclarable par le site lui-même ; digest du retour (16 j mesurés) rattrape ce qui s'est passé ; audit « X (pour Y) » |
| R-03 réel | Le réel saisi est faux ou incomplet (saisie humaine volontaire) | 5 | 3 | 3 | **45** | Une ligne par personne-semaine, remplacement sans doublon, borne 0–7 j, affiché À CÔTÉ du plan — l'écart se voit |
| R-04 clavier | Une nouvelle boîte de dialogue échappe au piège de focus | 6 | 2 | 2 | **24** | Piège posé dans `dialog()` unique (pas par boîte) ; mesures tour 2 et 3 : 0 atteignable derrière, focus rendu |
| R-05 tactile | Une nouvelle commande retombe sous 24 px | 5 | 2 | 3 | **30** | Tailles portées par les classes du kit, pas par vue ; 0 sur 4 pages à 375 px, deux tours |
| R-06 sémantique | Le h1 unique ou `lang` régresse sur une nouvelle vue | 4 | 2 | 2 | **16** | h1 posé par la coquille (`main.js`), pas par vue ; `setLang` stampe `documentElement` |
| R-07 densité | Un nouveau formulaire arrive sans repli et redevient un mur | 4 | 3 | 3 | **36** | `advanced:` est dans `form()` — le repli est le défaut du kit ; bénéfice 5/11 champs mesuré deux tours |
| R-08 réseau | Une nouvelle écriture recharge tout le livre par commodité | 6 | 3 | 2 | **36** | `TOUCH_BY_LABEL` centralisé ; trace réseau mesurée : POST + `collections?keys=` ; gzip serveur (90 → 15,9 Ko) |
| R-09 reprise | Un fichier de reprise passe la prévisualisation mais trahit le sens métier (colonnes justes, contenu faux) | 5 | 3 | 2 | **30** | Tout-ou-rien 422 transactionnel ; refus ligne à ligne motivés ; compte rendu sur la piste ; l'aperçu n'écrit rien |
| R-10 agenda | Un calendrier d'entreprise refuse l'ICS produit | 3 | 2 | 2 | **12** | VEVENT/RRULE au format de base, testés ; échec visible immédiatement par l'utilisateur |
| R-11 langue/notif | Le relais SMTP réel n'est pas branché (paramètre sponsor) | 5 | 3 | 2 | **30** | File `notify_queue` complète et testée ; « non configuré et le dit » ; **acceptation écrite n° 1** |
| R-12 annulation | Une restauration recrée une ligne dont le contexte a changé depuis | 5 | 2 | 2 | **20** | Restaurer est un AJOUT tracé, refusé sur existant (409), enfants non ressuscités *et dit* ; admin seul |
| R-13 lignée | Une révision est créée puis oubliée en revue, l'ancienne restant la « preuve » | 4 | 3 | 2 | **24** | La nouvelle révision n'est approuvée par personne (empreinte remise à zéro) ; `supersedes` visible en bibliothèque |
| R-14 consultations | Une nouvelle surface sensible arrive sans trace de consultation | 5 | 3 | 3 | **45** | Quatre surfaces posées ; le motif (`noteConsultation`) est un appel d'une ligne — revue de code l'exige sur toute surface d'export |
| R-15 français | Un nouveau libellé `t()` arrive sans entrée au dictionnaire | 4 | 2 | 1 | **8** | **La build échoue** (porte F5, sonde ajoutée après l'écart du tour 1) — détection avant livraison, d'où D = 1 |

Aucun RPN n'atteint 100. Le plus haut — R-02, 54 — est une défaillance de
*procédure humaine* (ne pas déclarer l'absence), atténuée par le digest du
retour ; l'outil ne peut pas déclarer l'absence à la place du site.

## Les quatre acquis, non régressés

Ce que les comités avaient salué devait sortir de la campagne intact.
Vérifié au dernier tour :

| Acquis | Preuve de non-régression (tour 3) |
|---|---|
| Le modèle d'accès est plus strict qu'une lecture naïve | sweep : 286 cas × 4 rôles, **0 erreur 5xx, 0 écart réel** (12 ⚠ = attentes erronées documentées) |
| La piste d'audit est transactionnelle, en ajout seul, avec images avant/après | portes crud-audit + version-audit vertes ; suppressions avec ligne entière ; restauration elle-même tracée |
| Le moteur (EVM, jalons, fenêtres) est gelé et honnête | 271/271 tests, comportement inchangé — l'evidence s'est ajoutée *autour* (`Engine.isEvidence`), pas dedans |
| « Une commande qu'un compte ne peut pas utiliser n'est pas dessinée » | 72 rendus de vue : 0 commande d'écriture offerte à un lecteur ; refus hors périmètre en français |

## Acceptations écrites — attentes de paramètres du mandant

Trois éléments ne peuvent pas être fournis par l'équipe : ce sont des
secrets ou des choix d'infrastructure du mandant. Pour chacun, le
comportement **en leur absence** est testé et honnête — l'application dit
ce qui n'est pas configuré au lieu de le simuler.

1. **Relais SMTP** (`MERIDIAN_SMTP_URL`) — la file de notification
   fonctionne, se draine et se lit dans l'écran d'administration ; rien ne
   part tant que le relais n'est pas fourni. *Accepté en l'état.*
2. **Locataire Entra ID** (`MERIDIAN_OIDC_TENANT`, `_CLIENT_ID`,
   `_CLIENT_SECRET`, `_REDIRECT`) — l'entrée SSO n'apparaît que configurée ;
   les comptes locaux tiennent l'intérim. *Accepté en l'état.*
3. **Hôtes documentaires de confiance** (`documentHosts`) — fermé par
   défaut : liste vide = aucune approbation possible, en indiquant le
   paramètre à régler. À renseigner avec les vrais domaines GED du groupe
   au premier démarrage. *Accepté en l'état.*

Aucune autre acceptation n'est demandée.

## Verdict

Portes tenues : RPN maximal **54** (seuil 100) ; aucun mode S ≥ 9 ;
aucune détection au-delà de D = 3. Les quinze réserves sont levées avec
mesures datées, la boucle de re-test est sortie sur deux tours conformes,
les quatre acquis sont intacts.

**RECETTE PRONONCÉE**, sous les trois acceptations écrites ci-dessus.

Suite immédiate : reconditionnement de l'installateur et réinstallation du
service Windows sur le binaire de la campagne (migrations 001–016), santé
et connexion réelle vérifiées.

## Déploiement — constat d'exécution

Reconditionné le 29/08/2026 : `MeridianSetup.exe` 32,9 Mo (SEA 89 Mo,
migrations 001–016, client reconstruit). Réinstallation par le motif
éprouvé — extraction silencieuse vers un dossier de travail, puis
`setup.cmd /quiet` en élévation. Constats après redémarrage du service
`MeridianITPMO` :

- `/api/health` → `{"ok":true,"engine":"postgres"}` ;
- migrations `014_evidence`, `015_rotation`, `016_timesheet` appliquées à
  `meridian_standalone` (absences et feuilles de temps servies au
  bootstrap) ;
- connexion réelle du compte administrateur vérifiée (obligation de
  changement de mot de passe intacte).

À noter pour l'exploitant : lancer `MeridianSetup.exe` avec la seule
option d'extraction silencieuse ne déploie PAS (la copie extraite ne
s'élève pas d'elle-même) — passer par `setup.cmd /quiet` élevé comme
ci-dessus, ou par un double-clic interactif qui accepte l'UAC.

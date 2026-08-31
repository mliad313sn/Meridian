# Comité de revue documentaire — quatre sièges, 71 constats, trois défauts produit

**Date : 31/08/2026 · Périmètre : la documentation courante** — le
README, le CHANGELOG, CONTRIBUTING, la référence technique
([`29`](29-technical-reference.md)) et les deux manuels utilisateur
([`30`](30-user-manual.md) EN, [`31`](31-manuel-utilisateur.md) FR).

## 1 · Le mandat, et la méthode

La documentation venait d'être écrite d'une traite, depuis une lecture
complète de la source. C'est la meilleure façon d'écrire un premier
jet, et la pire de le vérifier : celui qui a écrit ne voit plus ses
propres écarts. Le comité a donc siégé en **quatre sièges
indépendants**, chacun sans connaissance des conclusions des autres,
chacun tenu de citer la source (fichier et ligne) pour chaque constat :

| Siège | Question posée | Constats |
|---|---|---|
| **Exactitude** | Chaque affirmation vérifiable de `29` est-elle vraie dans le code ? | 11 (≈150 affirmations contrôlées) |
| **Fidélité du manuel** | Chaque geste décrit dans `30` correspond-il à un écran, un bouton, un comportement réels ? | 23 (≈120 contrôlées) |
| **Langue française** | Le vocabulaire de `31` est-il celui du dictionnaire du produit (`web/src/lib/i18n.js`) ? | 27 |
| **Cohérence** | L'ensemble se contredit-il — liens, chiffres, terminologie, conventions du dépôt ? | 10 |

Règle de clôture : un constat n'est levé que lorsque la correction est
dans le dépôt — dans la documentation, ou dans le produit quand c'est
le produit qui avait tort. Chaque constat surprenant a été
**revérifié à la main** avant d'agir : deux se sont confirmés en
exécutant réellement la séquence documentée.

## 2 · Ce que le comité a trouvé de plus grave : trois défauts produit

La découverte qui justifie l'exercice : trois constats n'étaient pas
des erreurs de documentation. La documentation disait ce que le
produit *devait* faire, et c'est le produit qui ne le faisait pas.

**P-01 · Le démarrage rapide documenté jetait le livre (bloquant,
corrigé).** `npm run seed && npm run dev` — la première commande du
README — semait une instance PGlite **en mémoire**, sortait, et la
seconde en démarrait une autre, vide : sans `PGLITE_DIR` exporté (que
seuls `scripts/restart.sh` et l'outillage de développement posaient),
rien ne persistait, et `server/.data/pgdata` n'était qu'une promesse
de `.env.example`. Vérifié en l'exécutant : aucun répertoire créé.
Corrigé dans `server/src/db.js` : sans directive contraire, le moteur
embarqué écrit dans `server/.data/pgdata` (créé récursivement —
PGlite ne crée pas les répertoires parents, deuxième défaut trouvé en
retestant) ; un `dataDir: null` explicite reste une instance en
mémoire, ce qui est le contrat du harnais de test — et que `PGLITE_DIR`
ne peut plus écraser. Revérifié : semis, démarrage, les dix comptes
répondent, arrêt propre.

**P-02 · Le forçage de statut échouait toujours (bloquant, corrigé).**
La boîte « Définir le statut » recueillait la raison sous la clé
`note` et envoyait `why: v.why` — indéfini ; le serveur, qui exige une
raison, répondait 400 à chaque forçage manuel. Et elle testait
`v.rag === "auto"` quand le sélecteur s'appelle `v.mode` : revenir au
statut automatique était impossible. Deux clés corrigées dans
`web/src/views/index.js`.

**P-03 · Les hôtes de preuve n'avaient pas d'écran (bloquant,
corrigé).** Le refus d'approbation disait « name the group's document
estate (`documentHosts`, in Administration) » — et l'Administration ne
proposait aucun champ pour le faire : sur une instance neuve, aucune
preuve n'était approuvable et aucun jalon de contrôle ne se
franchissait sans passer par l'API à la main. Le premier pas
administrateur du guide (« poser les hôtes ») ne pouvait jamais se
cocher. Ajouté : la section **Preuve** des réglages, sur le patron
fermé-par-défaut des hôtes de webhook, avec ses entrées FR au
dictionnaire.

Après correction : `npm test` — 375/375 ; `npm run audit` — les neuf
portes, vertes, dont F8 qui confirme au passage l'arithmétique du
comité (21 écrans × 4 rôles = 84 rendus).

## 3 · Les chiffres qui avaient pourri

Quatre nombres se répétaient de document en document sans plus être
vrais nulle part :

- « **huit** portes statiques » (README, CONTRIBUTING) — il y en a
  neuf depuis F9 ;
- « **356** tests » (CONTRIBUTING) — 375 ;
- « **72** rendus d'écrans » attribués à `npm run sweep` — les rendus
  sont la porte F8 de `npm run audit`, et ils sont 84 ; le sweep, lui,
  exerce 73 cas d'usage (67 en lecteur) dans chacun des quatre rôles,
  soit 286 exécutions — le « 286 × 4 » de la première rédaction
  comptait quatre fois trop ;
- « les **vingt-cinq** documents de `docs/` » (README) — le compte
  changeait à chaque livraison ; le nombre est retiré plutôt que
  corrigé, pour qu'il cesse de pourrir.

S'y ajoutent : l'invocation PowerShell sans `-ExecutionPolicy Bypass`
(refusée sur un poste Windows aux réglages par défaut), la ligne du
README sur `docs/03` qui ne disait plus qu'elle décrit la **cible** et
non l'état livré, la phrase ambiguë sur `MERIDIAN_SECURE_COOKIES`, et
« chaque ligne mutable porte `row_version` » — vrai des entités
versionnées, faux des réglages, des narratifs et des étapes
d'approbation, qui sont dehors à dessein.

## 4 · Ce que les manuels promettaient que le produit ne fait pas

Le siège de fidélité a relu `30` bouton par bouton. Au-delà des trois
défauts produit corrigés, la règle retenue est : **le manuel décrit ce
qui existe, et nomme ce qui n'existe qu'en API.** Corrections
principales :

- les **notifications** : quatre natures émises aujourd'hui (action
  due/en retard, jalon de contrôle bloqué, preuve injoignable,
  franchissement de tolérance) ; les cinq autres sont définies mais
  pas encore alimentées. La remise sortante est un **webhook HTTPS**
  (`MERIDIAN_NOTIFY_URL` + hôtes autorisés) — le transport SMTP est
  réservé, pas porté. Les abonnements fins et les heures de silence
  existent dans l'API avant leur écran ;
- la **chaîne de changement** : toujours les mêmes quatre étapes — le
  seuil de pilotage décide *qui peut signer*, il ne raccourcit rien ;
- le **Kanban** suit les éléments de travail — déplacer une carte ne
  consigne pas d'avancement d'étape ;
- la **capacité effective** vient de la disponibilité seule ; la
  rotation est une donnée d'annuaire ;
- la tolérance de **cinq jours** joue entre étapes d'un même projet,
  contre ce que la référence admettait ; les liens inter-projets sont
  tracés, pas contrôlés ;
- la page projet ne porte ni les changements, ni les documents, ni
  les enseignements — ils ont leurs écrans ; les vrais libellés sont
  « Copy status » et « Evidence pack » (un téléchargement, arrêté à
  une date) ;
- « trop tôt pour mesurer » tient à **deux** conditions : 2 % du plan
  planifiés *et* 0,5 % comptabilisés ;
- la **reprise de l'existant** (panneau CSV : modèle, aperçu,
  application tout-ou-rien) manquait entièrement au manuel — c'est le
  premier geste d'un site réel ;
- consignées aussi : l'exemption de l'admin aux séparations des rôles,
  l'exception « actions reportées » à la règle des sections vides, la
  portée réelle de la restauration depuis l'audit (lignes supprimées,
  neuf types), « Mettre fin à toutes les sessions » qui coupe toute
  l'instance, l'enveloppe posée depuis l'écran des demandes, le
  bouton EN/FR (pas un menu) et le chemin réel des premiers pas.

## 5 · Le français du produit, pas un français

Le siège de langue a confronté `31` au dictionnaire embarqué. Le
principe arbitré : **le manuel emploie le mot que l'écran affiche** —
un manuel dans un français plus élégant que le produit est un manuel
qui fait chercher des libellés introuvables. Une douzaine de termes
réalignés : *provision* (non « réserve pour aléas »), *rectification*
(non « retraitement »), *au dossier*, *Copier le statut*, *sponsor*,
*ambre*, *heures de silence*, *nature* et *périmètre*, *état de
préparation*, *date d'arrêté*, *terrain d'apprentissage*, *émettre* et
*refuser* une demande, *signaler* une préoccupation, *comptes revus*,
*comités tenus*, *Consigner l'effort*, *renvoyée au niveau supérieur*,
le message de conflit cité mot pour mot. Les quatre **jalons de
contrôle** gardent leurs noms anglais — l'interface ne les traduit
pas, le manuel les glose entre parenthèses au lieu d'inventer un
vocabulaire que personne ne verra à l'écran ; « jalon de contrôle »
(*gate*) est désormais distingué de « jalon » (*milestone*), comme le
fait l'aide du produit. Trois calques de l'anglais réécrits, et un
contresens (« borne l'exposition » pour *bands*) corrigé.

## 6 · Le registre produit du comité — ouvert le 31/08, clos le 31/08

Constats **produit** relevés par le comité, hors du pouvoir d'une
correction documentaire. La campagne de clôture les a tous levés le
jour même ; chaque levée est vérifiée par `npm run verify` (381 tests,
neuf portes) et, pour la remise, par les six tests de
`server/test/outreach.test.js`.

| # | Constat | Levée |
|---|---|---|
| O-1 | Les abonnements et les heures de silence n'avaient pas d'écran ; le périmètre et la cadence par abonnement étaient stockés mais ignorés à la remise | **Levé.** Les préférences de notification (icône de cloche) portent les heures de silence et les abonnements fins ; `deliver()` honore les quatre réglages — nature, gravité, périmètre (l'entité ramenée à son projet, puis au programme et au site), cadence par abonnement — un lot par période, jamais le premier message et le silence pour le reste. |
| O-2 | Cinq natures définies jamais émises ; le panneau parlait d'un SMTP qu'aucun client ne porte | **Levé.** Le balayage émet `decision-owed` (au président de la salle visée), `concern-raised` (au chef du projet groupe), `site-quiet` (au référent du site — A-12 sert enfin), `timesheet-missing` (à la personne, jamais à son chef) et `digest` (à la cadence du compte). Le panneau nomme le vrai transport, et le drapeau « configured » dit que l'envoi partirait vraiment. |
| O-3 | L'enseignement adopté n'était pas proposé au démarrage d'un projet | **Levé.** À la création, les enseignements adoptés du même programme ou du même site s'affichent — au seul moment où ils peuvent encore changer le plan. |
| O-4 | Rotation/disponibilité/prestataire sans champ dans la fiche personne ; le commentaire d'`effectiveFte` promettait la rotation | **Levé.** La fiche et l'annuaire portent les quatre champs de V-09. L'arithmétique ne change pas — la migration 012 définit la disponibilité comme DÉJÀ nette de rotation ; la replier dedans l'aurait comptée deux fois. Le commentaire le dit désormais. |
| O-5 | Le bouton « Nouveau projet » sondé contre le premier programme/site de la liste | **Levé.** La sonde interroge toutes les combinaisons ; un chef de site voit son bouton quel que soit le rang de son site. |
| O-6 | Libellés de rôle et natures RAID non traduits | **Levé.** Lecteur, Groupe, les quatre natures RAID et les descriptions de niveau parlent la langue de l'interface ; les valeurs stockées restent anglaises, comme partout. |
| O-7 | Les liens inter-projets tracés mais jamais contrôlés en tolérance | **Levé.** `Engine.crossDepBreaches` (ajout — l'arithmétique gelée n'est pas touchée) applique la même règle des cinq jours contre la référence, et le bandeau du Planning les compte avec les manquements internes. |

**Et un huitième, trouvé en levant les sept.** La migration 026
faisait émettre `tolerance-breached` — une nature que le CHECK de 018
refusait, dans un appel qui omettait aussi `dedupe_key` (NOT NULL), le
tout avalé par le `catch` qui protège le constat : **celui qui avait
posé la marge n'a jamais été prévenu, et rien ne l'a dit.** La
migration 027 élargit la contrainte, l'appel porte sa clé, et un test
tient l'insertion. Un catch qui protège un flux ne doit jamais
protéger une contrainte.

Et une décision d'écriture, consignée pour la suite : le CHANGELOG
range désormais le travail documentaire sous **Documentation**, pas
sous *Added* — la convention d'en-tête du fichier (« un document
corrigé » est du PATCH) le demandait déjà.

## 7 · Verdict

Levée des 71 constats du comité : **68 par correction immédiate**
(documentation ou produit) et **7 constats produit** (O-1 à O-7,
regroupant les observations annexes) **levés par la campagne du même
jour** — plus un huitième défaut (le CHECK de `tolerance-breached`)
trouvé en la menant. La documentation dit ce que le produit fait, et
le produit fait ce qu'elle dit : démarrage rapide, forçage de statut,
preuve de jalon, remise des notifications de bout en bout. La leçon
du jour est celle que ce dépôt connaît déjà : **une affirmation n'est
vraie que vérifiée en l'exécutant** — trois des quatre défauts
produit ne se voyaient qu'en lançant réellement la séquence
documentée, et le quatrième dormait sous un `catch`.

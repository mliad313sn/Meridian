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

## 6 · Ce qui reste ouvert, et à qui

Constats **produit** relevés par le comité, hors du pouvoir d'une
correction documentaire, versés au registre produit
([`23-comite-produit.md`](23-comite-produit.md)) :

| # | Constat | Où |
|---|---|---|
| O-1 | Les abonnements de notification et les heures de silence n'ont pas d'écran ; le périmètre et la cadence par abonnement sont stockés mais ignorés à la remise | `routes/auth.js`, `notify.js` |
| O-2 | Cinq natures de notification définies jamais émises (`decision-owed`, `concern-raised`, `site-quiet`, `timesheet-missing`, `digest`) ; le panneau d'administration parle de SMTP qu'aucun client ne porte | `notify.js`, migration 018 |
| O-3 | `GET /projects/:id/lessons/relevant` n'a aucun appelant hors tests — l'enseignement adopté n'est pas proposé au démarrage d'un projet | `routes/portfolio.js:2084` |
| O-4 | La rotation (« 4/2 », « 14/14 ») n'entre pas dans `effectiveFte` malgré le commentaire de la fonction, et rotation/disponibilité/prestataire n'ont pas de champ dans le formulaire personne | `shared/engine.js:426`, `administration.js` |
| O-5 | La visibilité du bouton « Nouveau projet » est sondée contre `db.programmes[0]`/`db.sites[0]` : un chef de site dont le site accordé n'est pas le premier de la liste ne voit pas le bouton | `views/index.js:4881` |
| O-6 | Les libellés de rôle (« Viewer ») et les natures RAID restent en anglais dans une interface par ailleurs traduite | `administration.js`, `login.js` |
| O-7 | Les liens inter-projets du planning directeur sont tracés mais jamais contrôlés en tolérance | `engine.js:225` |

Et une décision d'écriture, consignée pour la suite : le CHANGELOG
range désormais le travail documentaire sous **Documentation**, pas
sous *Added* — la convention d'en-tête du fichier (« un document
corrigé » est du PATCH) le demandait déjà.

## 7 · Verdict

Levée des 71 constats : **68 par correction** (documentation ou
produit), **3 convertis en constats produit ouverts** portés au
registre (O-1 à O-7 regroupent aussi les observations annexes des
sièges). La documentation relue dit ce que le produit fait — y compris
ce qu'il ne fait pas encore — et le produit fait désormais ce que son
démarrage rapide, son forçage de statut et sa preuve de jalon
promettaient. La leçon du jour est celle que ce dépôt connaît déjà :
**une affirmation n'est vraie que vérifiée en l'exécutant** — deux des
trois défauts produit ne se voyaient qu'en lançant réellement la
séquence documentée.

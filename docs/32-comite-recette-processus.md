# 32 · Comité de recette des processus

Constitué le 01/09/2026 sur mandat du commanditaire : « tester tous les
processus et cas d'usage, des réglages de base jusqu'à tout ce qu'on est
censé faire avec Meridian, pas à pas, puis traiter les défauts de logique
et les manques. »

## 1 · Ce que ce comité fait que les autres n'ont pas fait

Huit portes, 414 tests, un balayage de 286 cas et sept comités ont
regardé le produit — mais **presque toujours depuis un livre déjà
rempli** : la graine de démonstration fournit les sites, les comptes,
les projets, et chaque test exerce SON morceau au milieu d'un monde qui
existe déjà. Personne n'a rejoué, dans l'ordre et d'une seule traite, la
vie d'une organisation qui commence : livre vide, premier réglage,
premier site, premier compte, première demande, premier projet, première
preuve, première clôture. C'est dans les COUTURES entre les processus —
ce que l'étape N suppose que l'étape N-1 a laissé — que se cachent les
défauts de logique qu'aucun test unitaire ne voit.

## 2 · Sièges

| Siège | Regard |
|---|---|
| Directrice d'une organisation NEUVE | « je viens d'installer, je n'ai rien, montrez-moi le chemin » |
| Bureau de programme (groupe) | priorisation, seuils, décisions, indépendance |
| Chef de site | ce qu'on peut faire d'en bas, ce qu'on doit escalader |
| Contrôleur de gestion | l'argent : budget, engagements, provisions, périodes |
| Auditeur | chaque acte a un nom, chaque refus a un motif, rien ne s'efface |
| Exploitant | remise à l'exploitation, continuité, archive |
| Sceptique de service | essaie l'ordre FAUX : clore avant d'ouvrir, approuver son propre travail |

## 3 · Méthode

**L'instrument est exécutable et versionné** :
`server/test/journey.test.js` — un SEUL parcours ordonné qui commence
par le vrai geste de mise en production (`resetBook()`, celui qui a servi
le 29/08) et refait ensuite, par les vraies routes et sous les bons
rôles, tout ce que le produit promet, dans l'ordre où une organisation
le vivrait. Chaque étape affirme deux choses : le flux passe, ET le
refus que le registre promet est bien opposé (au sceptique, au
mal-ordonné, à l'auto-approbation).

Ce que le parcours NE remplace pas : la mesure au navigateur (portes F8
et boucles de re-test) et l'exploitation réelle (SaaS-03/05). Il fixe la
LOGIQUE, pas l'ergonomie.

## 4 · Le chemin testé (l'inventaire des processus)

0. Mise en production : livre vidé, compte survivant forcé de changer de
   mot de passe, écriture bloquée avant.
1. Réglages de base : seuils, hôtes documentaires, date de statut.
2. Structure : site (pays ISO, entité légale), programme, personnes.
3. Comptes et habilitations : groupe, site, lecteur ; référent de site.
4. Demande → priorisation : le site propose, le groupe note, l'enveloppe
   décide, un refus exige son motif, la conversion garde le fil.
5. Cadrage : cas d'affaire, jalons avec critères d'acceptation,
   activités et dépendances, référence (baseline).
6. Ressources et argent : affectations, feuilles de temps, lignes de
   coût, engagements.
7. Tolérances : bornes posées contre la référence, exception levée par
   le balayage, réponse de niveau groupe, jamais d'auto-fermeture.
8. RAID : risque avec cible résiduelle, préoccupation site→groupe,
   tirage de provision qui nomme son risque.
9. Maîtrise des modifications : seuil, SoD (émetteur ≠ décideur),
   fenêtres d'usine et MOC.
10. Preuves et jalons de gouvernance : hôte de confiance, propriétaire ≠
    approbateur, avancement de phase, dérogation motivée.
11. Comités : série, occurrence, décision, action, renvoi.
12. Valeur : bénéfices dans leur unité, PIR, clôture qui exige
    exploitant + propriétaire de bénéfice + mot de la fin.
13. Capitalisation : leçon proposée puis adoptée au groupe, relue
    d'ailleurs.
14. Restitution : période close = chiffres gelés, vues `reporting.*`.
15. Sortie : notifications, intégration (clé, événements signés),
    archive complète relue.

## 5 · Registre des constats

Tenu ici, à la source, une ligne par constat, avec la mesure de clôture.
Sévérité : **B** bloque un processus entier · **M** majeure (contourne
une règle ou perd une donnée) · **m** mineure (incohérence sans perte).

| # | Sév. | Constat | État |
|--:|:--:|---|---|
| PR-01 | M | `resetBook()` figeait sa liste de tables aux migrations ~013 : rien ne cassait (les FK des tables récentes sont SET NULL/CASCADE) mais **les leçons, demandes et notifications de démonstration survivaient à la mise en production**, en orphelins — mesuré par sonde : 1 leçon de démo restée dans un livre « vidé » | **clos 01/09** — liste complétée (39 tables, enfants avant parents) + garde-fou : après le vidage, resetBook relit le catalogue et ÉCHOUE en nommant toute table métier non vide et non déclarée gardée ; la prochaine migration oubliée fait échouer le parcours au lieu de fuir en production. Re-mesuré : seul `id_counter` (gardé à dessein) demeure |

| PR-02 | M | Un PATCH dont AUCUN champ n'est reconnu répondait **200 avec `version: undefined`** — et la ligne d'audit « … updated », posée dans la même transaction, restait : **la piste affirmait un changement qui n'avait pas eu lieu**. Trouvé en envoyant `decision:` au lieu de `status:` sur une demande — le client croit avoir décidé, rien n'est décidé | **clos 01/09** — `updateVersioned()` refuse (400 « Nothing recognisable to change ») et la transaction annule TOUT, la ligne d'audit avec ; refus traduit FR/ES ; mesuré au parcours (étape 4) |
| PR-03 | **M** | **La SoD des modifications tenait à un lien facultatif.** `change_request.raised_by` = personId de l'émetteur ; un compte SANS personne liée émet avec `raised_by NULL`, et `selfMatch(user, null) = false` : **l'émetteur approuvait sa propre demande**. Le compte d'administration d'une instance neuve — dont le compte comité en production — est exactement un compte sans personne. Rejoué au parcours : un compte groupe non lié a signé sa propre étape | **clos 01/09** — migration 033 : `raised_by_user` (le COMPTE, qui existe toujours — I-19) posé à l'émission et repris du passé via la piste d'audit ; la porte rbac compare AUSSI les comptes ; le sérialiseur l'expose et le bouton d'approbation disparaît pour l'émetteur au lieu d'échouer ; tenu par le parcours (étape 7, pmo volontairement sans personne) |
| PR-04 | m | Observation consignée, pas corrigée : la chaîne d'approbation d'une modification a plusieurs étapes (rôles affichés), mais **la même personne peut signer toutes les étapes** — les rôles de la chaîne sont des libellés, pas des habilitations. La SoD ne bloque que l'émetteur | ouverte — décision de conception à trancher : soit chaque étape exige un signataire distinct, soit la chaîne assume d'être un rituel de relecture à signataire unique et le dit à l'écran |
| PR-05 | m | Observation à l'honneur du produit, consignée pour la recette : une modification financée sur provision se signe jusqu'au bout et c'est **la dernière signature — celle qui applique — qui refuse** si la provision détenue ne couvre pas (« more contingency than the project holds »). Le contrôle vit au moment de l'acte, pas de la promesse — comportement voulu, désormais tenu par le parcours | close — comportement confirmé conforme, gravé au parcours (étape 7) |

## 6 · Le verdict du parcours

Le fichier `server/test/journey.test.js` tient les 16 chapitres en
34 mesures : mise en production réelle (resetBook + mot de passe prouvé),
réglages, structure, comptes, demande→projet, cadrage, argent, tolérances,
RAID et provision nommée, modifications avec seuil et SoD, preuves et
dérogations motivées, comités, valeur et clôture signée, leçons, période
close et vues de restitution, intégration et archive. Il entre dans
`npm test` — chaque livraison future rejoue la vie complète d'une
organisation qui commence.

*(les lignes suivantes s'ajoutent au fil des tours)*

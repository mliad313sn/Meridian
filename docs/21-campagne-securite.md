# Campagne de sécurité applicative — constats, correctifs, registre

Date : 29 août 2026 · Revue de sécurité conduite sur l'état accepté
(recette AMDEC prononcée, [`18-amdec-recette.md`](18-amdec-recette.md)),
par cinq revues de code sur surfaces disjointes — authentification et
sessions, injection et accès aux données, client et rendu, autorisation
et logique métier, exploitation et chaîne d'approvisionnement — puis par
des sondes en boîte noire contre le service en fonctionnement.

Ce document est le registre : ce qui a été trouvé, ce qui a été prouvé
exploitable, ce qui a été corrigé, et ce qui reste ouvert **avec la
décision qui va avec**. Les revues de gouvernance (politiques,
continuité, RGPD) font l'objet du comité InfoSec/GRC,
[`20-comite-infosec-grc.md`](20-comite-infosec-grc.md).

## Méthode — et ce qui distingue un constat d'une remarque

Une revue de sécurité produit facilement des listes de bonnes intentions.
La règle tenue ici : **un constat n'existe que s'il porte un scénario
d'exploitation concret**, et un constat grave n'est retenu qu'après avoir
été **rejoué contre une instance réelle**. Quatre des constats remontés
par les revues ne survivent pas à cette épreuve et sont consignés comme
tels — c'est aussi un résultat.

Surface d'attaque de départ, mesurée : **quatre dépendances de
production** (`express`, `pg`, `cookie-parser`, `@electric-sql/pglite`),
**zéro vulnérabilité connue** (`npm audit --omit=dev`), verrou de
dépendances présent.

## Ce qui a été trouvé, prouvé et corrigé

| Réf | Constat | Prouvé | Correctif |
|---|---|---|---|
| **S-06** | **Une preuve de jalon déposée sans propriétaire s'approuvait elle-même.** Le contrôle d'indépendance compare l'approbateur au propriétaire ; sans propriétaire il ne compare rien et laisse passer. Le même compte rédigeait et acceptait la preuve — exactement le contrôle que le comité indépendant avait rendu bloquant. | **oui**, 200 obtenu | Le déposant est enregistré comme propriétaire (l'identité n'est plus demandée au client) ; et un document sans propriétaire n'est approuvable par personne, avec un refus qui dit quoi faire. |
| **S-01** | **Exécution de script stockée.** Le lien d'artefact d'un document est saisi librement et rendu comme `href` dès l'état brouillon ; la validation stricte ne s'appliquait qu'à l'approbation. Un `javascript:…` stocké s'exécutait au clic d'un collègue, dans son origine et avec ses droits. | **oui**, stockée (201) | Deux verrous : le serveur refuse d'enregistrer autre chose qu'une adresse http(s) ; et le constructeur de DOM refuse d'écrire un attribut d'URL dont le schéma n'est pas http(s) — un seul endroit décide, comme pour l'autorité. |
| **S-09** | **Escalade de privilège locale.** `C:\Apps\Meridian` héritait de la racine du disque et accordait *Modify* à `Authenticated Users`, alors que le service tourne en LocalSystem : tout utilisateur standard pouvait remplacer `Meridian.exe` et obtenir SYSTEM au redémarrage suivant. | **oui**, ACL constatée sur la machine | Héritage rompu, écriture réservée aux administrateurs et à SYSTEM, lecture pour les autres — **appliqué à l'installation existante** et intégré à l'installateur pour les suivantes. |
| **S-03** | **Annuaire publié sans authentification.** `/api/auth/accounts` listait *tous* les comptes actifs — nom, adresse, rôle, périmètre — à qui pouvait joindre le port, y compris sur un livre de production. Cela annulait le soin pris par la connexion à rendre l'existence d'un compte indevinable, et fournissait une liste de cibles prête à l'emploi. | **oui**, compte réel exposé | La requête ne renvoie que les comptes de démonstration ; sur un livre réel, la liste est vide et l'écran de connexion reste servable. |
| **S-05** | **`NaN` accepté comme montant.** PostgreSQL accepte `NaN` en `numeric`, et `NaN` s'y compare *supérieur* à tout : la contrainte `budget >= 0` le laissait entrer. Toute valeur dérivée du projet — indices, prévision, statut, période publiée — devenait irrécupérable, sans erreur. | **oui**, 200 obtenu | Un montant doit être fini, sinon la requête est refusée. |
| **S-04** | **Injection de formule dans les exports.** Un nom de projet commençant par `=`, `+`, `-` ou `@` est interprété comme une formule par les tableurs : l'export devenait exécutable sur le poste de celui qui l'ouvre. | oui (par lecture) | Toute cellule commençant par un caractère de formule est neutralisée par une apostrophe : l'export est une donnée, jamais une instruction. |
| **S-02** | **Aucune défense en profondeur contre la falsification de requête.** Le cookie `SameSite=Lax` protège les navigateurs actuels, mais rien d'autre ne le faisait : une écriture annonçant une origine étrangère était acceptée. | oui (sonde) | Une écriture dont l'origine annoncée n'est pas la nôtre est refusée. Les appels sans origine (client natif, surveillance) restent possibles : la garantie est la cohérence, pas la présence d'un en-tête. |
| **S-08** | **Écoute sur toutes les interfaces, en annonçant le contraire.** Le service écoutait `0.0.0.0` pendant que la ligne de démarrage disait `localhost` : une installation qui se lit comme un outil de poste répondait en réalité à tout le réseau local, en HTTP clair, cookie de session compris. | **oui**, `::` constaté | Écoute sur la boucle locale par défaut ; l'ouverture au réseau devient un choix explicite (`MERIDIAN_BIND`), et ce choix affiche l'avertissement qui va avec s'il n'est pas accompagné de TLS. |
| **S-10** | **Le nettoyage pour la production ne révoquait pas le mot de passe conservé.** `reset-book` désactive les comptes de démonstration mais laissait au compte conservé le mot de passe qu'il avait — publié dans le dépôt sur une instance amorcée. | oui (par lecture) | Le compte qui survit au nettoyage doit changer son mot de passe avant d'écrire, et toutes les sessions tombent : un nettoyage est un vrai départ. |
| **S-11** | **Identifiants de base par défaut, silencieux.** Le paquet livre `postgres:postgres` — l'identifiant le plus deviné du monde, et superutilisateur du cluster entier, pas seulement de cette base. Un défaut silencieux est un défaut que personne ne corrige. | **oui**, config constatée | Le démarrage le dit à voix haute, à chaque fois, tant que ce n'est pas réglé. |
| **S-12** | **En-têtes de sécurité incomplets** : ni politique de sécurité du contenu, ni politique de permissions, ni HSTS. | oui (sonde) | Politique de contenu stricte (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), politique de permissions, et HSTS **uniquement** quand le déploiement se déclare derrière TLS — l'annoncer depuis une installation en clair enfermerait les utilisateurs dehors. |

Chaque correctif porte son test dans
[`server/test/security.test.js`](../server/test/security.test.js) : dix
tests qui rejouent l'attaque telle qu'elle réussissait.

## Ce qui a été remonté et n'a pas survécu à l'épreuve

Consigné parce qu'un constat écarté sans raison revient toujours.

- **Falsification de l'émetteur d'une demande de changement.** Le code
  acceptait `raisedBy` du client, ce qui aurait permis d'effacer
  l'identité que le contrôle d'indépendance compare. Rejoué : refusé —
  une clé étrangère arrête la valeur inventée. Le contrôle ne tenait donc
  que par accident, et le code a été durci malgré tout (**S-07**) : une
  identité se constate, elle ne se déclare pas.
- **Injection SQL par restauration depuis la piste.** La route reconstruit
  des colonnes depuis une image `before_json` ; vérifié : la table est
  prise dans une liste blanche stricte et l'image ne provient jamais d'une
  requête HTTP, mais toujours d'une lecture SQL réelle au moment de la
  suppression. Étanche.
- **Injection SQL par paramètres de requête.** Sondée sur les tris,
  bornes et filtres : requêtes paramétrées partout, bornes numériques
  encadrées. Aucune erreur serveur, aucun comportement anormal.
- **Fuite d'information par les erreurs.** Sondée : ni pile d'appel, ni
  SQL, ni chemin de fichier ne remonte au client ; l'en-tête révélant le
  serveur est masqué.

## Ce qui reste ouvert, et la décision qui va avec

| Réf | Sujet | Position |
|---|---|---|
| **S-13** | **L'administrateur est exempté de la séparation des tâches** (`if (user.role === "admin") return allow()`). Documenté, testé, assumé depuis l'origine — mais sur le livre de production le **seul compte actif est administrateur**, donc en pratique aucun contrôle d'indépendance ne s'applique aujourd'hui à personne. | **À trancher par le sponsor, pas par l'ingénierie.** La correction n'est pas technique : elle consiste à créer les comptes nominatifs des vrais rôles (responsables de programme, chefs de site) et à réserver l'administration à l'exploitation. Tant qu'il n'y a qu'un compte, l'outil ne peut pas être son propre second regard. |
| **S-14** | **Jetons de session stockés en clair** dans la table `session`. Une lecture de la base (sauvegarde égarée, réplication mal protégée) livre des sessions utilisables jusqu'à douze heures. | Durcissement recommandé (stocker l'empreinte, comparer les empreintes). Non exploitable sans un accès qui compromettrait déjà tout ; à traiter avec le chantier sauvegardes du comité GRC. |
| **S-15** | **Limitation de connexion contournable en largeur.** Le compteur est par couple adresse+identifiant : essayer un mot de passe probable sur trente comptes ne l'atteint jamais. Il est aussi en mémoire, donc par processus. | Recommandé : un compteur par identifiant seul et un compteur global par adresse. Portée réelle limitée tant que l'application n'est pas exposée hors du poste (voir S-08, désormais fermé par défaut). |
| **S-16** | **Binaire non signé.** L'injection du paquet dans `node.exe` invalide la signature d'origine et rien ne la reconstitue : Windows ne peut nommer aucun éditeur, et un administrateur n'a aucun moyen cryptographique de vérifier ce qu'il exécute en LocalSystem. | Nécessite un certificat de signature de code de l'organisation — **une décision d'achat**, pas une ligne de code. À demander au sponsor avec le relais SMTP et le locataire Entra. |
| **S-17** | **Suppléance et périmètre de réunion.** Un compte de niveau groupe peut animer la série d'un site hors de ses programmes : le code annonce que la route « rétrécira » le périmètre, et aucune route ne le fait. | Défaut d'autorisation réel mais borné (lecture et animation de comité, pas d'écriture financière), et sans exploitation prouvée à ce stade. À traiter à la prochaine itération, avec les mesures du comité GRC. |
| **S-18** | **`.npmrc` désactive la vérification TLS du registre**, à cause d'un proxy d'inspection d'entreprise. | Le verrou de dépendances protège les installations reproductibles ; le risque porte sur les ajouts de dépendances. À retirer dès que l'autorité de certification du proxy est installée — c'est déjà écrit dans le fichier. |

## Ce qui a été vérifié et jugé sain

Utile à consigner, parce que la valeur d'une revue tient autant à ce
qu'elle n'a pas trouvé.

- **Mots de passe** : scrypt, sel par utilisateur, comparaison à temps
  constant, et un calcul factice sur identifiant inconnu pour que le temps
  de réponse ne trahisse pas l'existence d'un compte. Vérifié en sonde :
  52 ms contre 55 ms, message identique.
- **Sessions** : 256 bits d'aléa cryptographique, opaques, vérifiées côté
  serveur, supprimées à la déconnexion, révoquées sur les autres appareils
  au changement de mot de passe, balayées à expiration. Une session forgée
  de même longueur est refusée.
- **Cookie** : `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` piloté par
  le déploiement.
- **Rendu** : aucun `innerHTML`, `eval`, ni gestionnaire d'événement
  construit en chaîne dans tout le client — le constructeur de DOM crée
  des nœuds de texte, donc une donnée du serveur ne peut pas devenir du
  balisage par accident.
- **Suppléance** : re-vérifiée en base à chaque requête, bornée par les
  dates, autorité *substituée* et jamais additionnée, l'audit nomme les
  deux personnes.
- **Clé de service de fédération** : comparaison à temps constant, échec
  fermé si absente, et le principal de service n'existe dans aucun rôle —
  il ne peut donc rien obtenir par le contrôle d'autorité.
- **Écritures** : toutes paramétrées, toutes auditées dans la transaction
  qui les porte, toutes versionnées.
- **Administration** : verrou anti-auto-exclusion du dernier
  administrateur ; désactiver un compte met fin à ses sessions ; tout
  changement de paramètre est tracé.
- **Journaux de service** : relus sur l'installation réelle — aucun
  secret, aucun jeton, aucun corps de requête.

## Ce que le sponsor doit décider

Trois choses ne se corrigent pas dans le code, et rien n'avancera sans
elles :

1. **Créer les comptes nominatifs** des rôles réels, et cesser de
   gouverner depuis un compte d'administration (**S-13**) — c'est ce qui
   rend la séparation des tâches vraie plutôt que théorique.
2. **Donner à PostgreSQL un vrai mot de passe** et mettre à jour la
   configuration du service (**S-11**).
3. **Fournir un certificat de signature de code** (**S-16**), avec le
   relais SMTP et le locataire Entra déjà attendus.

# 27 · Comité d'interopérabilité

**Mandat.** « S'assurer que le produit peut s'interfacer avec divers
écosystèmes, la suite Microsoft notamment ; l'objectif ultime est d'en
faire un logiciel incontournable, utilisable partout, interconnecté à
tout ce qui a du sens. » — commanditaire, 31/08/2026.

**Composition — sept sièges.** Un architecte d'intégration d'un groupe
industriel · un administrateur Microsoft 365 d'un site · un responsable
des systèmes financiers (ERP) · un ingénieur d'exploitation qui reçoit
les alertes · une déléguée à la protection des données · un intégrateur
tiers qui vit de brancher des outils · le porteur produit
([`23`](23-comite-produit.md)).

---

## 1 · Ce que le comité refuse avant de proposer quoi que ce soit

Le comité a commencé par la question qu'on ne lui posait pas : **comment
un produit meurt-il d'interopérabilité ?**

Réponse unanime, et elle vient de l'expérience de six des sept membres :
**par vingt connecteurs à moitié faits.** Chacun démontrable, aucun
exploitable ; chacun cassé à la première montée de version du produit
d'en face ; et une équipe qui passe son année à réparer des tuyaux au
lieu de faire le produit. L'intégrateur du comité l'a dit sans détour :

> « Montrez-moi un logiciel avec une page listant trente logos. Je vous
> montre un logiciel dont aucun des trente ne fonctionne en production
> chez plus d'un client. »

**Le comité refuse donc explicitement :**

- toute liste de logos comme objectif ;
- tout connecteur écrit pour un produit tiers précis quand une **surface
  générique** ferait le même travail — un connecteur SAP est un contrat
  avec SAP, une API documentée est un contrat avec tout le monde ;
- que Meridian devienne système de référence d'une donnée qu'un autre
  système possède. Les gens, l'argent réel et les tickets appartiennent
  ailleurs. Meridian en tient la **projection gouvernée**, horodatée,
  avec sa provenance — jamais l'original.

**La règle qui en découle, et qui tient tout ce document :**

> Meridian n'a pas besoin de vingt connecteurs. Il a besoin de **quatre
> surfaces**, faites correctement, et documentées assez pour qu'un
> intégrateur qui ne nous connaît pas branche son écosystème sans nous
> écrire.

---

## 2 · Les quatre surfaces

| | Surface | Question qu'elle répond | État |
|---|---|---|---|
| **A** | **Identité** | Qui est cette personne, et que peut-elle ? | seam OIDC construit, jamais éprouvé ; aucun provisionnement |
| **B** | **Lecture** | Que sait Meridian, et comment le lire ailleurs ? | CSV, ICS, pack de preuve, archive — mais **aucune API publiée** |
| **C** | **Écriture** | Comment un autre système alimente-t-il Meridian ? | import CSV seulement ; une clé de service unique, sans portée |
| **D** | **Présence** | Comment Meridian arrive-t-il là où les gens sont déjà ? | file de notification prête, **aucun transport** branché |

Ce que le comité a trouvé de bon en arrivant, et qui change la taille du
chantier : la fondation de la surface C **existe déjà**.
`server/src/federation.js` porte `generateServiceKey()`,
`requireServiceKey()`, un compte de service, et ne conserve que
l'empreinte de la clé. La table `ext_link` porte la provenance d'une
donnée venue d'ailleurs. Il n'y a pas à inventer le modèle : il y a à le
généraliser d'une intégration à plusieurs.

---

## 3 · Le registre

Treize lignes. Même règle que le registre de conformité
([`26`](26-conformite-referentiels.md)) : chacune dit ce que son absence
coûte, faute de quoi ce n'est pas un manque mais une envie.

| # | Ligne | Surface | Ce que ça coûte aujourd'hui | Effort |
|--:|---|:--:|---|---|
| **INT-01** | **API publique versionnée + description OpenAPI 3.1**, engendrée depuis les routes réelles et vérifiée par une porte. | B/C | **Rien n'est intégrable.** Un intégrateur doit lire le code source pour deviner un contrat qu'on ne s'engage pas à tenir. C'est aussi la deuxième question de l'attaque du concurrent ([`24`](24-comite-marche.md) §6). | 1 sem |
| ~~**INT-02**~~ **LEVÉE 31/08/2026** | **Intégrations nommées, à portée limitée** : une clé par système branché, des portées explicites (lecture seule, écriture de coûts…), rotation, et chaque acte tracé **au nom de l'intégration**. | C | Une seule clé, sans portée, qui peut tout. Impossible de dire « c'est l'ERP qui a écrit ça », ni de couper un tiers sans couper les autres. Ouvrir l'API sans cela serait une faute. | 3 j |
| **INT-03** | **Connexion Entra ID éprouvée de bout en bout**, puis **provisionnement SCIM 2.0** des comptes et des groupes. | A | Les comptes se créent à la main. C'est la différence exacte entre un pilote sur un site et un déploiement sur huit. Un départ dans l'annuaire ne ferme rien ici — le comité GRC l'a déjà relevé (G-05). | 1 sem |
| **INT-04** | **Événements sortants signés** sur les faits de gouvernance : jalon franchi, exception ouverte, changement approuvé, décision de comité. Signature HMAC, réémission, journal des livraisons. | D | Les autres systèmes ne peuvent que **demander** ; ils ne peuvent pas **réagir**. C'est ce qui rend Power Automate, ServiceNow ou n'importe quel orchestrateur inutilisables avec Meridian. | 3 j |
| **INT-05** | **Vues SQL de restitution, stables et documentées** (`reporting.*`), en lecture seule. | B | Power BI, Excel, Tableau et Qlik parlent tous PostgreSQL nativement. **C'est le branchement décisionnel le moins cher et le plus utile qui existe** — et il ne demande aucun connecteur. Aujourd'hui un analyste doit lire 23 migrations pour trouver ses colonnes. | 3 j |
| **INT-06** | **Transport Microsoft Teams** pour la file de notification (webhook entrant, carte adaptative, lien profond vers l'écran concerné). | D | La file fonctionne et **rien n'en sort**. Les gens sont dans Teams ; l'outil est ailleurs. C'est le premier obstacle d'adoption, pas d'intégration. | 2 j |
| **INT-07** | **SMTP réel** pour la même file (ACC-1). | D | Idem, pour ceux qui ne sont pas dans Teams. Un paramètre, pas un développement. | sponsor |
| **INT-08** | **Invitations de réunion véritables** (iCalendar `METHOD:REQUEST`, organisateur, participants, mises à jour et annulations) au lieu du seul abonnement au flux. | D | Un comité ne se met pas dans l'agenda des gens. Ils le manquent, et on accuse l'outil. | 3 j |
| **INT-09** | **SharePoint et OneDrive en hôtes de preuve** : recette éprouvée, sonde authentifiée, et la documentation qui va avec. | B | **Cela marche déjà** par lien et liste d'hôtes — mais personne ne le sait, et la sonde lit `401` là où un accès autorisé lirait la pièce. Le manque est documentaire aux trois quarts. | 2 j |
| **INT-10** | **Entrée d'avancement depuis Jira et Azure DevOps** : un projet se relie à un tableau externe, l'avancement et les incidents remontent, la provenance est estampillée. | C | La promesse « Meridian se place au-dessus des outils d'équipe » n'est tenue **qu'à la main**. C'est la double saisie que tout le monde finit par abandonner. | 1 sem |
| **INT-11** | **Réalisé financier depuis l'ERP** (SAP, Dynamics, Oracle) via la surface C plutôt qu'un connecteur par éditeur. | C | La valeur acquise se calcule sur un coût saisi à la main. Un IPC faux est pire qu'aucun IPC. | 3 j |
| **INT-12** | **Coordination avec l'ITSM** (ServiceNow et équivalents) : une fenêtre d'exploitation et une demande de modification s'échangent dans les deux sens. | B/C | Le modèle existe déjà (`site_window`, `plant_impact`, approbation MOC) et ne parle à personne. | 3 j |
| **INT-13** | **Réception d'événements entrants**, avec clé d'idempotence et rejeu sûr. | C | Sans idempotence, un tiers qui réessaie crée des doublons dans un registre de gouvernance. | 2 j |

---

## 4 · L'ordre, et pourquoi il n'est pas discutable

Quatre lignes conditionnent toutes les autres, et les livrer dans le
désordre reviendrait à ouvrir une porte avant d'avoir posé la serrure.

1. **INT-02** — les intégrations nommées à portée limitée. **Avant**
   d'ouvrir quoi que ce soit. Ouvrir une API sur une clé unique
   toute-puissante serait le défaut de sécurité le plus grave que ce
   produit aurait jamais porté, et il serait de notre fait, pas d'un
   oubli hérité.
2. **INT-01** — l'API décrite et versionnée. Sans elle, rien à brancher.
3. **INT-05** — les vues de restitution. Trois jours, et cela ouvre tout
   l'écosystème décisionnel sans écrire un connecteur.
4. **INT-04** — les événements sortants. C'est ce qui rend Meridian
   *réactif* pour les autres, et non seulement interrogeable.

Ensuite, par valeur d'adoption décroissante : INT-06, INT-08, INT-09,
INT-03, INT-13, INT-10, INT-11, INT-12, INT-07.

**INT-07 (SMTP) est hors de notre main** : c'est un paramètre du
commanditaire, pas un développement. Il figure au registre pour qu'on
cesse de l'oublier, pas pour qu'on l'attende.

---

## 5 · Les cinq règles qu'aucune intégration ne franchira

Reprises du travail de fédération déjà fait, parce qu'elles ont déjà
tenu une fois, et durcies par ce comité :

1. **Fermé par défaut.** Une intégration n'existe qu'une fois son adresse
   et sa clé posées. Aucune liste d'hôtes ne part remplie.
2. **Portée explicite.** Une clé dit ce qu'elle peut, et rien de plus.
   Une intégration financière n'approuve pas un jalon.
3. **Provenance estampillée.** Toute donnée venue d'ailleurs porte
   d'où elle vient et quand (`ext_link`), et l'écran le dit. Un chiffre
   sans origine ne s'affiche pas comme un chiffre maison.
4. **Tracée au nom de l'intégration.** La piste d'audit nomme le système
   qui a écrit, jamais un « système » anonyme.
5. **Réversible.** Débrancher un tiers ne doit rien casser d'autre que ce
   qu'il apportait. Ce qu'il a écrit reste, avec sa provenance.

---

## 6 · La position du comité sur « incontournable »

Le comité a été mandaté pour rendre le produit incontournable. Il rend
une réponse qui n'est pas celle attendue, et l'assume.

**Un outil ne devient pas incontournable en se branchant partout. Il le
devient en étant le seul endroit où une question a sa réponse.** Pour
Meridian, cette question est : *« qui a décidé quoi, quand, sur quelle
preuve, et cela tient-il encore ? »* Aucun des treize branchements
ci-dessus ne la traite ; ils la rendent **atteignable depuis les endroits
où les gens travaillent**, ce qui est nécessaire et n'est pas suffisant.

Le comité alerte donc sur le risque de son propre mandat : treize lignes
d'intégration livrées pendant que le registre de conformité
([`26`](26-conformite-referentiels.md)) reste ouvert donneraient un
produit très bien branché **sur un contenu incomplet**. Il recommande de
mener les deux registres **en alternance**, et non l'un après l'autre —
ce qui est exactement ce que la boucle de livraison décrite dans
[`28`](28-goal-market.md) organise.

**Ce qui n'a pas de sens à brancher, et que le comité écarte :** les
suites bureautiques comme source de plan (un Gantt Excel réimporté
détruit la baseline), les messageries instantanées comme canal de
décision (une décision prise dans un fil n'a ni preuve ni horodatage
opposable), et tout système qui exigerait d'ouvrir Meridian sur Internet
pour fonctionner — la liaison sortante reste sortante.

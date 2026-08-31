# 28 · Le plan de marche jusqu'au produit fini

Ce document est le **carnet unique** des deux registres ouverts le
31/08/2026 — la conformité aux référentiels
([`26`](26-conformite-referentiels.md), 13 lignes) et l'interopérabilité
([`27`](27-comite-interoperabilite.md), 13 lignes) — plus ce qui restait
ouvert du carnet produit ([`23`](23-comite-produit.md)).

La commande qui l'exécute est
[`/goal-market`](../.claude/commands/goal-market.md). Ce document est
l'état ; la commande est le moteur.

---

## 1 · La règle d'alternance

Le comité d'interopérabilité a posé, contre son propre intérêt, la
contrainte qui structure tout le plan :

> Treize lignes d'intégration livrées pendant que le registre de
> conformité reste ouvert donneraient un produit très bien branché sur un
> contenu incomplet.

**Donc : une ligne de conformité, une ligne d'intégration, en
alternance.** Jamais deux du même registre à la suite, sauf quand l'une
conditionne strictement l'autre — et ce cas est nommé chaque fois qu'il
se produit.

---

## 2 · Les trois versions

### R3 — « conforme, et branchable »

| Ordre | Ligne | Registre | Pourquoi ici |
|--:|---|---|---|
| 1 | **PM-02** registre des enseignements | 26 | Le jalon 4 du produit exige cette preuve et le produit n'a pas où la mettre. Une contradiction interne se ferme avant tout ajout. |
| 2 | **INT-02** intégrations nommées à portée limitée | 27 | La serrure avant la porte. Ouvrir l'API sur la clé unique actuelle serait le pire défaut que ce produit ait porté. |
| 3 | **PM-01** tolérances et gestion par exception | 26 | Le mécanisme qui rend une délégation d'autorité sûre. La plus grosse pièce de gouvernance manquante. |
| 4 | **INT-01** API publiée + description OpenAPI | 27 | Sans elle, rien n'est intégrable — et c'est la deuxième question de l'attaque du concurrent. |
| 5 | **PM-03** cas d'affaire tenu comme un enregistrement | 26 | Referme la chaîne demande → cas d'affaire → bénéfice → revue. |
| 6 | **INT-05** vues SQL de restitution | 27 | Trois jours, et Power BI, Excel, Tableau et Qlik se branchent sans qu'on écrive un connecteur. |

**Condition de prononcé de R3 :** les six lignes closes avec mesure
datée, `npm run verify` vert, `npm run sweep` sans écart nouveau, et une
exception ouverte puis répondue **au navigateur**, pas seulement en test.

### R4 — « présent là où les gens travaillent »

PM-06 (risque résiduel et lien à la provision) · INT-04 (événements
sortants signés) · PM-08 (clôture et transfert à l'exploitation) ·
INT-06 (transport Teams) · PM-04 (critères d'acceptation et revues
qualité) · INT-08 (invitations de réunion véritables) · INT-09
(SharePoint et OneDrive en hôtes de preuve).

### R5 — « déployable partout »

PM-05 (parties prenantes) · INT-03 (Entra éprouvé puis SCIM) · PM-09
(revues d'assurance) · INT-13 (réception idempotente) · PM-14 (alignement
stratégique) · INT-10 (Jira, Azure DevOps) · PM-12 (compétences) ·
INT-11 (réalisé ERP) · INT-12 (ITSM) · PM-07 (profondeur
d'ordonnancement) · PM-10 (contrats et fournisseurs) · PM-11 (plan de
communication).

**Hors boucle, parce que hors de notre main :** INT-07 (SMTP), ACC-2
(identifiants Entra), ACC-3 (`documentHosts` réels), S-16 (certificat de
signature), et les onze lignes d'organisation du carnet
[`23`](23-comite-produit.md) §3. Elles figurent ici pour qu'on cesse de
les oublier, pas pour qu'on les attende.

---

## 3 · La définition de terminé, pour chaque ligne

Reprise de la charte du comité produit ([`23`](23-comite-produit.md)
§4.4), inchangée, parce qu'elle a déjà attrapé une correction livrée et
non consignée :

1. la migration, la route, le champ sérialisé, le champ de formulaire et
   le test — **les cinq**, pas quatre ;
2. l'autorité décidée dans `shared/rbac.js`, jamais dans une route ;
3. `npm run verify` vert : 8 portes, et le compte de tests **monte** ;
4. le geste **exercé au navigateur**, sous chaque rôle qu'il concerne ;
5. les libellés traduits — la porte F5 fait échouer la construction
   sinon ;
6. **la consignation datée dans le registre d'origine**, dans le même
   commit que le code.

Une ligne dont les six ne sont pas tenues n'est pas close, quel que soit
l'état du code.

---

## 4 · Le relevé

Tenu à jour par la boucle, à la source, comme le relevé de clôture de
[`23`](23-comite-produit.md) §3.

| Ligne | Version | État | Mesure |
|---|:--:|---|---|
| PM-02 | R3 | **close 31/08** | 024 · écran · 9 tests · adopté par le groupe, lu depuis un autre site, projet d'origine non nommé |
| INT-02 | R3 | **close 31/08** | 025 · une clé par système, portées vérifiées, nom dans la piste, rotation · surface /api/v1 · 13 tests |
| PM-01 | R3 | ouverte | — |
| INT-01 | R3 | ouverte | — |
| PM-03 | R3 | ouverte | — |
| INT-05 | R3 | ouverte | — |

*(les lignes de R4 et R5 sont reportées ici au fur et à mesure qu'elles
entrent en travail)*

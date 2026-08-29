---
description: R-01 — donner un contenu réel à la preuve de jalon (fichier ou lien vérifié), sans quoi le contrôle approuve un objet vide.
argument-hint: "'fichier' pour le dépôt local  ·  'lien' pour l'obligation de lien vérifié  ·  vide = recommandation du comité"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, PowerShell, mcp__Claude_Browser__*
---

# /preuve — R-01, la réserve bloquante

## Le constat, tel que le comité l'a écrit

La table `document` ne porte ni fichier, ni lien, ni emplacement. Le
verrouillage de jalon refuse l'avancement tant que les documents ne sont
pas « Approuvés » — et un document approuvé est **une ligne dont
quelqu'un a changé le statut**. La ségrégation des tâches sur
`document.approve` protège donc l'approbation d'un objet vide, et le
dossier de preuve remis à un auditeur (V-15) énumère des documents qui
n'existent nulle part.

Le comité ne recommande pas Meridian comme source de preuve d'assurance
tant que ceci n'est pas levé, au motif qu'un contrôle qui rassure à tort
expose davantage qu'un contrôle absent.

## L'objectif

**Un document approuvé désigne un artefact que quelqu'un peut ouvrir.**

## Les deux formes acceptables

$ARGUMENTS

Sans argument, appliquer la recommandation du comité : **le lien vérifié
d'abord**, le dépôt de fichier ensuite si le sponsor le souhaite.

### Forme A — lien vérifié (recommandée en premier)

Le groupe possède déjà une gestion documentaire. Meridian n'a pas à la
remplacer ; il a à refuser d'approuver dans le vide.

- `document.uri` obligatoire **au moment de l'approbation**, pas à la
  création : un brouillon peut n'avoir encore aucun emplacement.
- L'URI est contrainte à une liste d'hôtes de confiance, tenue en
  paramètre (`documentHosts`) — sinon un lien vers n'importe où passe pour
  une preuve.
- Un empreinte de l'URI et la date sont figées à l'approbation
  (`uri_at_approval`), et toute modification ultérieure de l'URI d'un
  document approuvé **le fait retomber en « En revue »**, avec une ligne
  d'audit nommée. Un lien qu'on change après coup n'est pas une preuve.

### Forme B — dépôt de fichier

- Table `document_file` : `document_id`, `filename`, `mime`, `bytes`,
  `sha256`, `uploaded_by`, `uploaded_at`, contenu en `bytea` ou chemin sur
  disque selon ce que l'exploitation accepte.
- Empreinte SHA-256 calculée **au dépôt** et affichée ; elle est ce que
  l'auditeur compare.
- Un fichier ne se remplace pas : une nouvelle révision crée une nouvelle
  ligne (le modèle de révision existe déjà).
- Limite de taille explicite et type MIME contrôlé ; le refus dit quoi
  faire.

## Ce qui doit changer dans tous les cas

1. **`Engine.gateStatus`** ne compte comme preuve que les documents
   approuvés **qui portent un artefact**. C'est le cœur de la réserve :
   sans cela, tout le reste est cosmétique. Attention — l'arithmétique du
   moteur est figée : étendre le prédicat, ne pas réécrire le calcul.
2. **`POST /documents` et `PATCH /documents/:id`** refusent le statut
   « Approuvé » sans artefact, avec un message qui dit quoi faire.
3. **Le dossier de preuve (V-15)** cite l'artefact : lien ou empreinte.
   Un dossier qui énumère des documents sans emplacement est le symptôme
   d'origine.
4. **Les migrations 008–013 ne se modifient pas** — nouvelle migration
   numérotée.

## La clôture

- Un test nommé `R-01` qui prouve : approbation refusée sans artefact ;
  approbation acceptée avec ; jalon **non** franchissable tant que la
  preuve est vide ; retour en revue si l'URI d'un document approuvé change.
- Le parcours cliqué : déposer/lier, approuver, franchir le jalon, puis
  produire le dossier de preuve et **ouvrir l'artefact depuis le dossier**.
- `npm run verify` vert, quatre portes.
- `docs/16-comite-independant.md` : R-01 **LEVÉE**, avec la manière dont
  un auditeur peut désormais vérifier une pièce.

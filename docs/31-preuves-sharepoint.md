# 31 · SharePoint et OneDrive comme hôtes de preuve

**INT-09** ([`27`](27-comite-interoperabilite.md) §3). Le constat du
comité était que **cela marche déjà** — et que personne ne le sait. Ce
document est donc aux trois quarts une recette, et au quart une
explication honnête de ce que la sonde peut et ne peut pas dire.

## La recette

Meridian ne stocke pas les preuves : il les **référence** (décision R-01),
et n'accepte de lien que vers un hôte que quelqu'un a délibérément nommé.
Pour un parc Microsoft 365 :

1. **Administration → Réglages → `documentHosts`** — ajouter les hôtes du
   locataire, séparés par des virgules :

   ```
   votretenant.sharepoint.com, votretenant-my.sharepoint.com
   ```

   Un sous-domaine d'un hôte nommé compte ; `sharepoint.com` tout court
   accepterait le SharePoint DE N'IMPORTE QUI — nommez le locataire.

2. **Coller le lien** dans le document de preuve : le lien « Copier le
   lien » de SharePoint convient. HTTPS est exigé ; tout autre schéma est
   refusé à l'écriture (S-01).

3. **Approuver** — l'approbation vérifie l'hôte au moment de l'acte : un
   lien hors liste ne peut pas devenir une preuve de jalon.

## Ce que la sonde dit, et ce qu'elle ne peut pas dire

La sonde horaire (N-07) fait un `HEAD` anonyme sur chaque preuve
**approuvée**. Sur SharePoint, un document bien protégé répond `401` ou
`403` à un anonyme — et c'est ce qu'on VEUT : une preuve de gouvernance
lisible par tout Internet serait le vrai problème.

La sonde classe donc ce cas **`forbidden` (🔒), jamais `unreachable`
(⚠)** : « l'accès m'est refusé » n'est pas « la pièce a disparu ». Ce
que 🔒 garantit : l'hôte répond et le chemin existe. Ce qu'il ne peut
pas garantir : que le document derrière l'authentification est toujours
celui qu'on a approuvé — cela, seul un lecteur autorisé le constate, et
la revue de jalon est faite par des lecteurs autorisés.

**Une sonde authentifiée** (un compte applicatif Graph lisant les
métadonnées) dirait plus ; elle exigerait un enregistrement d'application
Entra, un secret à garder et à tourner, et un consentement
d'administrateur du locataire. Le comité l'a pesée et remise à plus tard,
avec sa raison : tant que l'instance n'a pas d'astreinte d'exploitation
(SaaS-03/05), lui confier un secret Graph ajoute un risque qu'elle ne
sait pas encore porter. La ligne reste au registre — différée, pas
oubliée.

## Trois pièges connus

- **Le lien « personnes spécifiques »** de SharePoint embarque un jeton
  d'invitation dans l'adresse. Il marche pour qui le reçoit, puis expire
  ou se révoque — la sonde le verra passer de 🔒 à ⚠. Préférer un lien
  « personnes disposant de l'accès », qui reste stable.
- **OneDrive personnel** (`…-my.sharepoint.com`) suit le compte de son
  propriétaire : son départ emporte la preuve. Un document de jalon
  appartient à une bibliothèque d'équipe, pas à un OneDrive.
- **Renommer ou déplacer** le fichier casse le lien même si SharePoint
  affiche une redirection au navigateur — la sonde, elle, lit la
  réponse brute. Re-coller le lien après un déplacement.

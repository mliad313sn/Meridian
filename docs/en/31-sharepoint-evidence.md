> English translation of [`docs/31-preuves-sharepoint.md`](../31-preuves-sharepoint.md). The French original is the authoritative record; where they differ, the French governs.

# 31 · SharePoint and OneDrive as evidence hosts

**INT-09** ([`27`](../27-comite-interoperabilite.md) §3). The committee's
finding was that **it already works** — and that no one knows it. This
document is therefore three-quarters a procedure, and one-quarter an
honest explanation of what the probe can and cannot say.

## The procedure

Meridian does not store evidence: it **references** it (decision R-01),
and only accepts a link to a host someone has deliberately named.
For a Microsoft 365 tenant:

1. **Administration → Settings → `documentHosts`** — add the tenant's
   hosts, comma-separated:

   ```
   yourtenant.sharepoint.com, yourtenant-my.sharepoint.com
   ```

   A subdomain of a named host counts; `sharepoint.com` on its own
   would accept ANYONE's SharePoint — name the tenant.

2. **Paste the link** into the evidence document: SharePoint's "Copy
   link" link works. HTTPS is required; any other scheme is
   refused on write (S-01).

3. **Approve** — approval checks the host at the moment of the
   act: a link off the list cannot become milestone evidence.

## What the probe says, and what it cannot say

The hourly probe (N-07) makes an anonymous `HEAD` request on every
**approved** piece of evidence. On SharePoint, a properly protected document
answers `401` or `403` to an anonymous request — and that is what you
WANT: governance evidence readable by the whole Internet would be the
real problem.

The probe therefore classes this case as **`forbidden` (🔒), never
`unreachable` (⚠)**: "I am refused access" is not "the item has
disappeared." What 🔒 guarantees: the host answers and the path
exists. What it cannot guarantee: that the document behind the
authentication is still the one that was approved — only an
authorised reader can confirm that, and the milestone review is done
by authorised readers.

**An authenticated probe** (an application account reading Graph
metadata) would say more; it would require an Entra application
registration, a secret to keep and rotate, and tenant
administrator consent. The committee weighed it and set it aside for
later, with its reason: as long as the instance has no operations
on-call cover (SaaS-03/05), handing it a Graph secret adds a risk
it cannot yet carry. The line stays on the register — deferred, not
forgotten.

## Three known traps

- **The "specific people" link** in SharePoint embeds an invitation
  token in the address. It works for whoever received it, then expires
  or is revoked — the probe will see it move from 🔒 to ⚠. Prefer a
  "people with access" link, which stays stable.
- **Personal OneDrive** (`…-my.sharepoint.com`) follows its
  owner's account: their departure takes the evidence with them. A milestone
  document belongs in a team library, not a OneDrive.
- **Renaming or moving** the file breaks the link even if SharePoint
  shows a redirect in the browser — the probe reads the raw
  response. Re-paste the link after a move.

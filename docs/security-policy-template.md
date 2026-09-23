# Security policy template — for the organisation that operates Meridian

> **This is a template, not a policy.** SECURITY.md lists "a written
> security policy" as one of three operational findings that are the
> operator's to close, not the software's (docs/20 G-03). The RT365 field
> return (docs/33, I-12) asked for the template to ship with the product
> so that "yours to write" comes with a page to fill in rather than a
> blank one. Replace every `⟨…⟩`; delete what does not apply; date and
> sign it; keep it next to the instance runbook (docs/34).

| | |
|---|---|
| Instance | ⟨name — the `orgName` setting, and `instanceId` if set⟩ |
| Owner (accountable) | ⟨name, role⟩ |
| Operator (runs it) | ⟨name or team; who is called on a Sunday⟩ |
| Version | ⟨from `GET /api/health`⟩ |
| Engine | PostgreSQL ⟨version⟩ — PGlite is not accepted for this instance (docs/29 PG-01) |
| Policy version | ⟨1.0⟩ · ⟨date⟩ · review by ⟨date + 12 months⟩ |

## 1 · What this instance holds, and why it matters

Meridian holds the governance record of ⟨the portfolio⟩: decisions,
approvals, an append-only audit trail with before/after images, and
personal data about the people who deliver the work (names, roles,
allocations, absences). The record is what an auditor will read to
establish why a decision was taken. Its integrity matters more than its
availability; its confidentiality matters because it names people.

Data classification: ⟨internal / confidential⟩.
Legal entity responsible for personal data: ⟨the site's `legalEntity`, MC-01⟩.

## 2 · Accounts and access

- The demonstration accounts shipped with the seed are ⟨deactivated /
  their passwords changed⟩ on ⟨date⟩. `GET /api/admin/posture` shows
  `demoAccountsLive: []`; the server refuses to start in production
  otherwise (I-12).
- Accounts are named people. Administrator accounts are used for
  administration only; the portfolio is run from group and site accounts.
  **Reason:** an administrator is exempt from segregation of duties
  (break-glass, S-13); every such signature is recorded as break-glass in
  the audit trail and is reviewed ⟨monthly⟩ by ⟨whom⟩.
- Joiners, movers, leavers: ⟨who⟩ creates, re-grants and deactivates
  accounts within ⟨N⟩ working days of the HR event. Accounts are never
  deleted (the trail cites them); they are deactivated.
- Sign-in: ⟨local passwords of at least 12 characters / Entra ID via
  MERIDIAN_OIDC_*⟩. Sessions end after ⟨12⟩ hours of inactivity; "End
  every session" (Administration → Continuity) is the response to a
  workstation left open.
- Integration keys (Administration → Connected systems) carry the
  narrowest scope that works, are rotated ⟨every 12 months⟩ and on any
  suspicion, and are revoked when the connected system stops using them
  (`last_used_at` is the signal).

## 3 · Network and transport

- The instance listens on ⟨127.0.0.1 behind a reverse proxy / 0.0.0.0⟩.
  If it is reachable beyond the host, TLS terminates at ⟨the proxy⟩ and
  `MERIDIAN_SECURE_COOKIES=1` is set.
- Outbound: a default installation makes no outbound request (NOTICE).
  This instance sends to ⟨SMTP host⟩ for notifications and to
  ⟨Teams/webhook hosts⟩ for events; every such host is named in
  `notifyHosts`, which is closed by default.
- Evidence links are accepted only from the hosts named in
  `documentHosts` (R-01). This instance names: ⟨hosts⟩.

## 4 · Backup, restore and continuity

- Backup: `node scripts/backup.mjs` runs ⟨daily at HH:MM⟩ from ⟨where⟩,
  writing to ⟨location⟩, retained ⟨N⟩ days, ⟨encrypted / access-limited⟩.
- Restore drill: `node scripts/restore-drill.mjs` runs ⟨monthly⟩; the
  last drill and its duration are visible in `GET /api/health`
  (`backup.lastDrillAt`, `backup.restoreSeconds`). A drill older than
  ⟨45⟩ days is an incident.
- Recovery objectives: RPO ⟨24 h⟩, RTO ⟨4 h⟩. Second instance:
  ⟨standby host / none — accepted risk, signed by ⟨whom⟩⟩.
- Archive (`Administration → Continuity → Export the archive`) is taken
  ⟨quarterly⟩ and before every upgrade; it contains no secret and can be
  handed to a successor (docs/25 M-01).

## 5 · Change and vulnerability management

- Upgrades follow docs/34 §upgrade; the binary is never older than the
  database (SaaS-02 refuses it). Upgrades happen ⟨on which day / by whom⟩,
  after a backup and a read of CHANGELOG.md.
- `npm run audit:deps` (or the equivalent dependency scan) runs ⟨weekly⟩;
  a high finding is patched within ⟨14⟩ days.
- Vulnerabilities in Meridian itself are reported per SECURITY.md. There
  is no vendor: fixes come from the maintainers or from us.

## 6 · Monitoring and incident response

- `GET /api/health` is polled by ⟨monitoring⟩ every ⟨minute⟩; `ok:false`,
  a missing response, or `ephemeral:true` pages ⟨whom⟩.
- The audit trail (`Administration → Audit`) is reviewed ⟨monthly⟩ for:
  break-glass signatures, gate overrides, RAG overrides, integration
  writes. The `reporting.decisions` view feeds ⟨BI tool⟩ for this.
- Incident: ⟨who is called⟩, ⟨within what time⟩; the first action is
  "End every session" and a backup of the current state; the record of
  the incident goes in ⟨where⟩.

## 7 · Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Owner | | | |
| Operator | | | |
| Information security | | | |

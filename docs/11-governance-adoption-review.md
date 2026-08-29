# Governance & adoption review — the second committee pass

Date: 2026-08-28 · Seven seats across two committees, each reviewing the working
system through one lens, findings implemented the same day and traced to
`server/test/governance.test.js` (15 proving tests; full verify 191 green + all
four audit gates).

## The committees

**Portfolio governance** (group PMO director · site delivery lead · governance,
risk & audit · operating rhythm): the assessment was that the single-meeting and
single-project machinery was excellent, but the model measured *level* everywhere
and *independence* nowhere, and the two governance levels had no data to talk
along — "one excellent meeting, run twice; not yet a rhythm."

**User experience & adoption** (adoption & onboarding · daily usability · value &
stickiness): the strengths were calibrated to a seeded book and a keyboard-literate
reviewer; the empty production book was a dead end, the conflict path destroyed
typed input, and the site PM — the tool's primary data source — got no sendable
artifact back for their Monday.

## What changed (migration `006_governance.sql` + this release)

### Controls — independence, fail-closed, reportable
- **Segregation of duties**: the raiser of a change request can no longer decide
  it (`change.approve` checks `raised_by`; admin is the tested break-glass).
- **Independent gate evidence**: `document.approve` is its own action — an owner
  never approves their own document, and gate evidence on a site project needs
  group-level eyes.
- **Fail-closed thresholds**: a missing change-control threshold now escalates
  instead of waving everything through.
- **Reassignment gate**: moving a project between programmes/sites requires
  authority over the *destination*, and lands as an imaged `Project moved` /
  `Governance level changed` audit row.
- **Reportable exceptions**: gate overrides demand a written reason and land as
  `Gate overridden` with before/after; `GET /audit?action=` filters by action;
  `GET /decisions/log` is the decision register — control decisions and minuted
  meeting decisions on one surface (group+).

### The rhythm between levels
- **Referrals**: a site or programme room records "refer to steering" instead of
  a decision; it headlines the broader room's next agenda until a decision there
  names and retires it (`meeting_decision.referred_to_scope` / `answered_by`).
- **Tasking down**: open actions from broader-scope series land on the owning
  site's weekly, tagged with their origin.
- **Assurance across**: the group monthly carries "Decisions taken at site and
  programme level" since its last close.
- **Decision rights on the agenda**: items above a site room's authority are
  flagged REFER TO STEERING and kept outside the timebox cap.

### The site's voice and surface
- **`concern.raise`**: a site lead formally raises a RAID concern on a group
  programme landing on their site (create-only, stamped `origin_site`, flows
  into the ordinary escalation machinery).
- **My site**: the slate as a surface — yours to run, group programmes landing
  here, your people's FTE split site-vs-group, the open register with concerns
  named. Group demand is labelled in Resources too.
- One-site accounts land with their site pre-selected.

### The group's surfaces
- **Programmes**: one card per governed programme — manager, roll, decisions
  owed, risk posture against the appetite lines (`Engine.riskProfile`).
- **Locations** carries per-slate governance load (decisions waiting, steering
  escalations); **Reports** carries the risk-posture strip and the decision
  register.

### Adoption & daily use
- **My week** is the landing surface: your actions, register items, next
  fortnight, your projects, and "this week in your book" (the `/digest` route —
  the audit trail scoped to what you may see, turned into the Monday answer).
- **Truthful saving**: dialogs await the server, keep your typed input alive on
  conflict with an in-dialog explanation, Enter saves, and a failure toast can
  no longer be titled with the success label.
- **Empty book**: a role-aware first-run panel (admin: a live setup checklist;
  others: an honest "being set up") — and the New-project probe no longer breaks
  on an empty book.
- **First sign-in**: admin-provisioned and admin-reset passwords force a change
  (`must_change_password`); the seed-passwords sentence renders only on demo
  books; Help is one click from every view; a one-time role-aware "start here".
- **Artifacts people send**: per-project **Copy status** snippet, and the
  pre-meeting **pack** export (agenda + open actions + the slate) to mirror the
  post-meeting minutes.

## Bilingual UI — English / French (sponsor decision: BOTH)

Delivered as scaffolding plus a first tranche (`web/src/lib/i18n.js`):
- **Literal-keyed**: the English string is the key; `t("…")` returns the French
  entry or the English itself — a missing translation degrades to English,
  never to a broken key, so coverage grows view by view with no migration.
- **Toggle** on the sign-in screen and in the sidebar footer, named for the
  language it switches TO (FR/EN), persisted per browser.
- **Tranche 1 covered**: navigation, titles and shell; sign-in and first-run
  (start-here, forced password change); the save/conflict conversation; the
  My week / My site / Programmes surfaces; portfolio KPIs, register and rail;
  project header controls and read-only notices; meeting controls and the
  referral dialog. ~200 dictionary entries.
- **Next tranches, by name**: parameterised counts ("N concerns you raised"),
  deep table columns and dialogs, filter placeholders, help body, and —
  deliberately last — server-side strings (errors double as the audit record;
  they need a per-request locale, not a client map) and date month names
  (shared with server-rendered minutes/packs).

## Deferred, by name
- Inline stage-progress editing without a dialog; palette action entries;
  per-programme change thresholds; dialog focus-trap; touch paths for drag
  surfaces — candidates for the next pass, none blocking.

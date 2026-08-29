# Deep code review of the governance & adoption release — findings and fixes

Date: 2026-08-29 · Reviewed: everything migrations 005–006 introduced (the
two-level governance controls, the meeting rhythm, the new surfaces, the
bilingual shell). Every finding below was reproduced in the code before it
was fixed, and the fixes ship with migration `007_frozen_agenda.sql` and
two new proving tests. Verify after: **193 tests, build, four audit gates,
all green.**

## Controls that could be walked around

**Gate evidence could arrive pre-approved.** `document.approve` was
enforced on the PATCH that sets a document to Approved, and nowhere else —
so `POST /documents { gate: 2, status: "Approved" }` filed approved gate
evidence with no independent reviewer at all. Creating now runs the same
gate as approving.

**…or be re-tagged onto a gate afterwards.** Approve a document where no
gate rule bites (gate 0), then PATCH `gate: 2` with ordinary write
authority, and the project's gate reads ready on a signature it never had.
Changing the gate of an *approved* document now needs the authority that
approving evidence at the new gate needs. Approving and reassigning the
owner in one request is also refused: approval is a pure act, or the trail
reads as though a colleague signed.

**The forced first-sign-in password change was a dialog, not a control.**
`must_change_password` was rendered by the browser and enforced nowhere.
Escape, a backdrop click, or any API client walked straight past it — and
the header's close button, not the footer's Cancel, was the one being
relabelled "Sign out". Now: the server refuses every write from a session
whose password is still the one an administrator handed over (reads and
`/auth/password` stay open), and the dialog itself has no dismissal path.

**A password change left every other session signed in.** Changing a
password is how someone answers "I think somebody else has been using this
account"; an answer that leaves the other sessions live is not one. Every
session but the one making the change now ends, and the audit row says so.

**A referral could be answered by a room it was never addressed to.** A
referral stored a *level* ("programme"), not a room. Any programme's chair
could retire another programme's escalation, and every programme agenda
carried every site's referral text — including sites in programmes they
have nothing to do with. Referrals are now scoped to the programme that
owns the referred project (or, absent a project, the programmes the
referring site actually hosts work for), by one predicate shared between
the agenda and the answer path, so the two cannot drift. The answering
UPDATE is now conditional, closing the window where two rooms answer at
once.

**Programme rooms took steering-level decisions silently.** The
"REFER TO STEERING" annotation only fired for *site* series, so a
programme board was handed steering-authority items as ordinary business.
It now fires for every room below group. Referrals are also capped (3
weekly / 8 monthly, with the remainder counted in the note) — outside the
decision cap, but not outside every cap, which was the same unworkable
agenda arriving through the exemption.

## Records that were not saying what happened

- **A combined edit lost half of itself**: moving a project *and* changing
  its governance level in one PATCH recorded only the level change. The
  images and the detail now carry every structural change in the request.
- **The frozen agenda was lossy** (migration 007): only the section title
  was stored and handed back as the section *key*, and `urgent` was never
  stored — so a closed meeting's minutes lost every bold line, exactly
  what a frozen record exists to preserve. Rows frozen before 007 fall
  back to the old behaviour.
- **A pack pulled after the close mixed history and today**: the agenda
  was frozen, the actions and slate were current, and the footer stamped
  the whole document with the meeting date. It now says which is which.
- **`GET /audit` answered 500 to a malformed link** — array or object
  query parameters reached the driver as values no text column compares to.

## Screens that were not telling the truth

- **A failed fetch read as good news.** `/digest` and `/decisions/log`
  failures were recorded as empty results, so a dropped request rendered
  "Quiet week — nothing in your scope moved" and "No consequential
  decisions recorded yet" — positive claims about governance data the
  client never received. Failures are now carried as failures and said
  out loud.
- **One user's data could land in another's screen.** The live-fetch cache
  was keyed on the book alone; a response still in flight when someone
  signed out and back in as a different person overwrote the new session's
  cache. It is keyed on the account too, and a late response for a book we
  have left is discarded.
- **A person-less account owned everything unowned.** `personId === null`
  matched every row with a null owner, filling "My week" with other sites'
  ownerless risks.
- **"Your people on group work" counted loans elsewhere as your own.** The
  site-versus-group FTE split took the complement of group work, so an
  engineer lent to another site's project — or to a project long closed —
  was counted as load on your own slate. Both halves are now positive sets.
- **Every programme card counted the portfolio's project-less risks**, so
  the same org-level risks appeared on all of them and a programme with no
  open projects still showed a posture.
- **"Raise concern" always filed against the first group project listed**,
  whichever one you meant. The action now sits on the row it is about.
- **NaN reached the screen on a partly-populated book** — utilisation with
  nobody in the directory, the demand meter before anyone is allocated,
  the time-zone gap with no sites. All read "—" now.
- **Hidden navigation was not a closed door**: `#/admin` typed by hand, or
  simply left in the address bar by the last person to sign in on that
  browser, opened the view. Roles now sit beside the routes, one table
  feeding both what is drawn and what may be reached, and signing out
  clears the route.
- **A save that succeeded could report failure.** If the post-write refresh
  failed, the committed write was reported as not saved — inviting the user
  to press Save again and book the cost twice. The refresh now reports
  itself.
- **Enter saved the wrong dialog** when one was opened over another
  (a document-wide query found the dialog underneath), and the in-dialog
  failure note could explain this failure with the previous one's words.

## The gate that was not looking

`crud-audit` read `CREATE TABLE` only, so every column added by migrations
005–007 — `origin`, `origin_site`, `referred_to_scope`, `answered_by`,
`must_change_password` — was outside the one check that asks whether a
stored field ever reaches a human. It reads `ALTER TABLE … ADD COLUMN` now.
All of them pass.

## Proved by

`server/test/governance.test.js` gains: evidence cannot arrive pre-approved
nor be re-tagged onto a gate; a referral addressed to "programme" reaches
only the programme it belongs to and cannot be retired by another; and the
provisioned-password session reads but cannot write until it is changed.

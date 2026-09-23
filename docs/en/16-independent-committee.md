> English translation of [`docs/16-comite-independant.md`](../16-comite-independant.md). The French original is the authoritative record; where they differ, the French governs.

# Independent review of Meridian IT-PMO — full report

Date: 29 August 2026 · Independent assurance committee, mandated after the
closure of the sixteen findings in the Endeavour register.

## Mandate and independence

The committee neither designed nor built this product. Its mandate was to
**use** it, not to read it: open the application, hold the real roles,
run through the use cases of a multi-site mining IT department, and say
what is missing **against the real need**, not against the specification
the team gave itself.

This distinction is the heart of the mandate. The two previous committees
assessed a governance model and found it good — it is. The present
committee tried to use it on a Monday morning, from a site, over a
satellite link, in French, with a rotation roster. The conclusions
differ.

**Overall opinion.** Meridian is an excellent instrument of
*governance* and a still-incomplete instrument of *operation*. It knows
how to hold portfolio discipline; it does not yet know how to take in the
real work of the people who feed it. The committee issues **fourteen
reserves**, one of which it qualifies as blocking for any assurance
use.

## Composition

| Seat | Origin | What it came to verify |
|---|---|---|
| External assurance (IS audit) | external firm | Is the control a control, or its appearance? |
| Ergonomist / user researcher | outside the product team | How much does an entry cost the person making it? |
| Digital accessibility | outside the product team | Is the tool usable by keyboard, by screen reader, by finger? |
| Site IT lead (Houndé) | business | Does this help me on a Monday, on rotation, over VSAT? |
| Operations / plant supervisor | business | Does this protect the plant, or does it document it? |
| Project management control | business | Do the numbers hold up under closing? |
| Integration architect | group IT department | What is needed for this to live in the existing landscape? |
| Change management | HR / training | What must be learned before being useful? |

## Method — what was actually tested

The committee worked on a running instance, loaded with the demonstration
data set (12 projects, 8 sites, 10 accounts), and **measured** rather
than estimated. The figures cited in the reserves come from these
measurements:

- full walkthroughs held in the `admin`, `group` and `site` roles;
- measurements of network payload, page depth, number of fields per
  form, and touch-target size at 375 px;
- keyboard-accessibility and document-semantics checks;
- targeted reading of the schema to confirm what the interface seemed to
  imply (for example: what does a "document" actually contain?).

## Exhaustive sweep — what was exercised, without exception

At the sponsor's request, the committee exercised **all** of the
product's capabilities, from **all** perspectives, rather than a sample.
Two sweeps were conducted, one of which is reproducible:

```
npm run sweep      # scripts/audit/usecase-sweep.mjs
```

### Service side — 286 use cases

Eighteen functional domains — reading, exports, project, planning, RAID,
change, money, value, documents, resources, plant, deployment, request,
prioritisation, meetings, administration, federation, robustness —
executed at the four access levels (`admin`, `group`, `site`,
`viewer`), on a fresh, seeded instance.

| Result | Number |
|---|---|
| Cases exercised | **286** |
| Server errors (5xx) | **0** |
| Deviations from the expected access model | 14 flagged, **13 due to a mistaken expectation on the committee's part** |
| Real defect revealed | **1** |

The thirteen deviations are instructive in themselves: the access model
is **stricter** than a naive reading would suggest. A programme manager
cannot modify a project outside their authorisation, even if they are
"group" level; a site lead cannot open a concern on a programme that
does not land at their site; the administrator exemption on separation
of duties is documented and tested, not accidental.

**The real defect:** a **group**-level user — and the administrator —
could submit a document **already approved, with no owner**, and
therefore write and approve the evidence in a single call, with no
author ever recorded. The control had been closed at site level in the
previous code review, and left open above it. **Fixed**: submitting and
approving are now two distinct acts for everyone, administrator
included, and a test proves it at all three levels.

### Interface side — 72 view renders

The **18 views** were opened in the **4 roles**, measuring rendering,
console errors, and the write commands offered.

| Result | Finding |
|---|---|
| Views that fail to render | **0** out of 72 |
| Console errors | **0** across the four roles |
| Write commands offered to a read-only account | **0** across the 18 views |
| Redirect from a forbidden route | verified — a `viewer` hitting `#/admin` gets the portfolio |

The committee highlights this result: the rule "a command an account
cannot use is not rendered" **holds perfectly**, which is rare and worth
stating.

## The reserves

Ranked by severity. Each reserve carries the evidence that grounds it.

---

### R-01 · The milestone evidence contains no evidence — **CLOSED on 29/08/2026**

**What was done** (migration `014_evidence.sql`, "verified link" form
recommended by the committee): a document carries the `uri` of its
artefact; approval is **refused without an artefact**, refused outside
https, refused outside trusted hosts (`documentHosts`, **closed by
default**: empty list = nothing approvable, while stating which
parameter to set); the SHA-256 fingerprint of the address and the date
are **frozen at approval**; changing the link of an approved document
makes it **fall back into review** with a named audit line; the engine
only counts as evidence the approved items **that point somewhere**
(`Engine.isEvidence`), so the milestone can no longer be crossed on empty
paper; the evidence file cites the link and the fingerprint, and writes
"none — not evidence" where there is nothing; a revision names the line
it replaces (`supersedes`, a down payment on R-13).

**Measurement before → after**: approval of an empty line 200 →
**400**; milestone crossable on empty evidence yes → **no** (tested at
engine and API level); evidence file with no location → every item cited
with a link + fingerprint. Proved by `server/test/preuve.test.js` (7
tests); suite at 254, sweep 0 error.

*The original finding is kept below, as written.*

**Finding.** The `document` table has neither file, nor link, nor
location: only a name, a type, a milestone number, a revision, an owner
and a status. Milestone locking refuses to advance until documents are
"Approved" — yet an "Approved" document is **a row whose status someone
changed**.

**Evidence.** Columns of `document` (migration 002): `id`, `project_id`,
`name`, `doc_type`, `gate`, `owner_id`, `revision`, `status`,
`updated_on`. No file-upload route exists anywhere on the server; the
five occurrences of `attachment` are **download** headers, never
submission.

**Real consequence.** The evidence file produced for an auditor (V-15)
lists documents that exist nowhere. The separation of duties on
`document.approve`, of which the team is legitimately proud, protects the
approval of an empty object. For a listed company, that is the
difference between a control and the appearance of a control.

**What the committee expects.** Either file upload, or — at minimum — a
mandatory, verified link to the group's document system (SharePoint),
timestamped and unmodifiable after approval.

---

### R-02 · No cover during rotations — **CLOSED on 29/08/2026**

**Done** (migration `015_rotation.sql`): an **absence** is bounded, has a
reason, and can name a **deputy**; the deputy chooses to cover (banner on
"My week") and then takes on **the authority of the absent person — never
more, never the union** (tested: while covering GRU, they lose YYZ); the
justification is **re-checked on every request** against the absence, and
coverage lapses on its own when the absence ends; independence follows
both people (`selfMatch`: the deputy decides neither their own request
nor that of the absent person); **the audit trail names both** ("X (for
Y)"); the **digest widens** to the absence on return (floor 7 days,
ceiling 60 days) and says since when it has been covering. **Measurement:
digest for a 13-day return = 13+ days covered (was a fixed 7); expired
delegation = immediate return to one's own authority, with no lock-out.**
`rotation.test.js`, 8 tests.

*Original finding:*

**Finding.** Rotation is modelled for *capacity* (V-09: `rotation`,
`availability`) and nowhere for *responsibility*. There is no deputy, no
delegation, no declared absence. Actions, change approvals, and
change-control sign-offs remain assigned to a person who is, by
construction, absent one week in three.

**Evidence.** No occurrence of delegation or deputisation outside the
`deputy_for` field of a meeting attendance sheet. Furthermore the digest
window is fixed at **7 days** (`interval '7 days'`) whereas a 14/14 or
4/2 roster keeps the person away **14 days or more**: on return, a week
is structurally missing that nothing restores to them.

**Real consequence.** Decisions stall during rotation leave, and the tool
says nothing about it. This is the most ordinary flow-stopping mechanism
of a mining operation, and the only one the model ignores.

---

### R-03 · The actuals are never captured — **CLOSED on 29/08/2026**

**Done** (migration `016_timesheet.sql`): a deliberately minimal entry —
person, project, week, a number of days; the same week is corrected by
replacing, never by duplicating; authority is that of the assignments;
actuals display NEXT TO the plan (Resources), the EVM engine is untouched.
**Measurement: 0 actuals table → entry/correction/withdrawal tested,
plan-vs-actual visible, 0 fields beyond the four.**

*Original finding:*

**Finding.** Assignments carry a **planned** percentage and a period.
There is no capture of time spent, nor of actual effort progress.
"Resource capacity", labour CPI, and capitalised cost therefore all rest
on the plan, never on fact.

**Evidence.** Zero occurrences of `timesheet`, `actual_hours` or
`effort_actual` across the full set of migrations. `allocation` contains
`from_date`, `to_date`, `pct`, `capitalised`.

**Real consequence.** Project control cannot reconcile capitalised
payroll cost against reality; it will have to keep doing so outside the
tool, which is precisely the situation the project set out to remove.

---

### R-04 · The modal window is not modal — **CLOSED on 29/08/2026**

**Done** (`dialog()` in `kit.js`, a single implementation for all boxes):
the application root is rendered `inert` for as long as a box is open,
Tab is trapped inside the box in both directions, focus is returned to
the trigger on close — including when the re-render has destroyed the
original element (its twin in the new DOM is found by signature).
**Measurement: 65 focusable elements reachable behind → 0; focus
returned to the original button: yes.**

*Original finding:*

**Finding.** Dialog boxes declare `aria-modal="true"` and
`role="dialog"`, but the rest of the page remains keyboard-reachable.

**Measured evidence.** "Add milestone" box open: **7** focusable elements
inside the box, **65** focusable elements still reachable behind it.

**Real consequence.** A keyboard or screen-reader user leaves the box
without knowing it and acts on the page underneath. The `aria-modal`
promise is false, which is worse than its absence.

---

### R-05 · Touch targets below the minimum — **CLOSED on 29/08/2026**

**Done**: a 24 × 24 px floor set once in the stylesheet (`.btn` and
`.bare`), the visual density of tables preserved through padding.
**Measurement at 375 × 812, project / portfolio / my week / meetings
pages: 29 buttons under 24 px → 0, out of 61/23/22/33 visible.**

*Original finding:*

**Finding.** On a phone screen, the controls are too small to be
targeted by finger.

**Measured evidence.** At 375 × 812 px, project page: **61** visible
buttons, of which **29 measure less than 24 × 24 px** — below the WCAG
2.2 minimum (criterion 2.5.8, level AA) — and **all 61** are under
44 px.

**Real consequence.** The site lead, who is the primary source of data,
works standing up, on rounds, on a phone. This is exactly the person the
current ergonomics excludes. To its credit: the layout causes **no
horizontal scrolling** at 375 px, which is correct.

---

### R-06 · The document language does not follow the interface — **CLOSED on 29/08/2026**

**Done**: `setLang()` sets `documentElement.lang` (and so does bootstrap,
before the first render); the view title has become the page's single
`h1`; `document.title` follows the view and the language. **Measurement:
lang "en" → "fr" after switching; 0 h1 → exactly 1 per view; the tab
title follows ("Réunions & décisions · Meridian IT-PMO").**

*Original finding:*

**Finding.** Switching to FR translates the interface but leaves
`<html lang>` at `en`.

**Measured evidence.** After switching: navigation in French
("DELIVER · My week · Portfolio · Roadmap"),
`document.documentElement.lang` = `"en"`.

**Real consequence.** A screen reader pronounces French with English
phonetics — unusable. Across three French-speaking operating countries,
this is an exclusion, not a detail. Compounding this is the total
absence of any `h1` on the pages (**0** measured): the heading structure
starts at `h2`, which deprives heading-based navigation of its entry
point.

---

### R-07 · Navigation and entry load — **CLOSED on 29/08/2026**

**Done**: navigation grouped behind the four business timeframes,
collapsible, the group of the active view always open, the badges of a
closed group summed on its header; **progressive** forms (`advanced:` in
`form()`, a single implementation for all of them) — the short path
visible, the rest behind "Detail", a field already filled never
collapses, a collapsed field in error reveals itself; project page:
milestones and the blocking banner open, Value / Plant / Step plan
**collapsed with a readable summary**. **Measurements: 16 → 8 visible
entries (site account); benefit 11 → 5 fields on opening; first
collapse at 1.42 screens (target ≤ 2).** Along the way, the sweep
uncovered a long-standing latent defect: edit forms never bootstrapped
their own state and answered "Required" on fields that were already
filled — fixed in `form()`.

*Original finding:*

**Finding.** The tool has grown a lot, and the effort demanded of the
user has grown with it.

**Measured evidence.** For a **site** account: **16 navigation
entries**. Page depth at 760 × 1100 px: project **3 screens**, meetings
**4.6 screens**. Forms: "state a benefit" **11 fields**, "open a RAID
item" **9 fields**, "add a step" **5 fields**.

**Real consequence.** Eleven fields to declare a benefit, asked of a
site lead on rotation, will not be filled in — or will be filled in
carelessly, which is worse, since the measurement of value (V-01)
depends on it entirely. The committee does not ask that fields be
removed: it asks that a short path exist and that the rest be
progressive.

---

### R-08 · Data weight over a constrained link — **CLOSED on 29/08/2026**

**Done**: gzip compression of JSON responses above one kilobyte
(node:zlib, no dependency); **end of the full reload after ordinary daily
writes** — `App.write` infers from the label which collection(s) were
touched and only re-requests those (`GET /api/collections?keys=…`, the
output of the same serialiser, so the invariant "the screen shows only
what the server accepted" holds); writes that trigger a server
recalculation (cost, phase, baseline, CR, periods) keep the full reload,
by design. **Measurements: site-account bootstrap 90 KB → 15.8 KB
transferred (target < 40); an ordinary write (step progress) = PATCH +
one GET /collections, zero /bootstrap, screen up to date, verified
request by request.**

*Original finding:*

**Finding.** The application loads **the whole book** on every login and
reloads it in full after **every** write.

**Measured evidence.** On a set of 12 projects: **90 KB** for a site
account, **113 KB** for an administrator, across 25 collections
(`activities`, `ledger`, `benefits`, `commitments`, `waves`, `windows`…).
Application bundle: **274 KB** of JavaScript and 28 KB of CSS.

**Real consequence.** A real portfolio — several dozen projects, years of
cost lines — will run into the hundreds of kilobytes to several
megabytes, reloaded on every save, over a VSAT link shared with
operations. No pagination, no differential loading, no offline mode.

---

### R-09 · No path to onboard existing data — **CLOSED on 29/08/2026**

**Done**: CSV import for the three record types that are genuinely
migrated (projects, people, milestones) — downloadable template,
**row-by-row preview** with the reason for each rejection, **all-or-
nothing** application in a single transaction, reported on the trail.
Group level (`data.import` — whose missing branch in the `switch` of
`can()`, the long-noted latent trap, was closed on this occasion).
**Measurement: a dirty file = 0 writes and every rejected row justified;
a clean file = tracked creations.**

*Original finding:*

**Finding.** Import accepts a single format: Meridian's own JSON export,
in the engine's own field names.

**Real consequence.** The organisation currently lives in spreadsheets.
No path leads from those spreadsheets to the tool: the migration will
have to be done by hand, project by project, which is the first real
obstacle to rollout and is addressed nowhere.

---

### R-10 · Meetings do not meet the calendar — **CLOSED on 29/08/2026**

**Done**: one ICS file **per occurrence** and one **per series** (with
its recurrence rule), served from the meetings screen — the format every
calendar accepts, with no connector, as requested. **Measurement:
VCALENDAR/VEVENT/DTSTART/RRULE verified, access subject to the same
scope as the minutes.**

*Original finding:*

**Finding.** The meetings module produces an excellent agenda, session
pack and decision log, and **talks to no calendar whatsoever**. No
invitation, no ICS file, no reminder.

**Real consequence.** The rhythm the product organises depends on a
rhythm kept elsewhere (Outlook). Two sources of truth for the same
meeting.

---

### R-11 · Notifications with no preferences or language — **CLOSED on 29/08/2026**

**Done**: language and cadence belong to the **recipient** (`locale`,
`notify_pref` on the account, editable from the side panel); messages
are composed **in their own language** via the server dictionary; a
recipient **absent with a deputy** is no longer written to — it is the
deputy who receives it, prefixed "Covering for X"; an **"off"**
preference **removes the queuing itself**, not just the sending.
**Measurement: an overdue action of a French-speaking absent person → 1
message, addressed to the deputy, subject "Covering for… Overdue: …",
body in French; off preference → 0 message queued.**

*Original finding:*

**Finding.** The notification queue (V-12) is sound in principle —
queue rather than emit — but the messages are **hard-coded in English**,
with no frequency preference, no unsubscribe, and no account taken of
the recipient's rotation.

**Real consequence.** The first email sent to a French-speaking site
lead will be in English, during their rotation leave. See R-02 and R-06:
the three reserves converge on the same person.

---

### R-12 · No undelete, though the material exists — **CLOSED on 29/08/2026**

**Done**: deletions now retain **the entire row** in their `before`
image (9 record types), and an administrator can **replay it from the
trail** — restoring is an ADD, logged as "Restored from the trail",
never a rewrite; children do not come back to life and the response says
so; you cannot restore over an existing row (409). **Measurement:
delete → restore → identical row, refused for a non-admin, refused when
duplicated.**

*Original finding:*

**Finding.** Deletions are confirmed by a dialog box, then final on the
interface side. Yet the audit trail keeps the `before` image of the
deleted object: the material for a restore already exists and is not
offered.

**Real consequence.** An accidental deletion requires a database
intervention. The product denies itself a repair it already has the
means to offer.

---

### R-13 · Document revisions are not versions — **CLOSED on 29/08/2026**

**Done** (with R-01, on which it depended): every revision carries its
own artefact (`uri` copied over, fingerprint reset — a new revision is
approved by no one) and **names the row it replaces** (`supersedes`),
displayed in the library ("↤ DOC-x"). Proved in `preuve.test.js`.

*Original finding:*

**Finding.** "New revision" creates a row and flips the previous one to
"Superseded". Without a file (R-01), there is neither compared content
nor real history: only a sequence of labels.

---

### R-15 · French is mixed within a single component — **CLOSED on 29/08/2026**

**Done**: translation is now **centralised** — `kpiStrip` and
`sectionHead` translate their own headings (dictionary) and notes
(`tData()`, the translator for fragments composed around numbers) by
themselves; `statusTag` translates the word displayed without touching
the compared value; the meetings agenda, the report blocks, and the
table footer counters go through the same channel. A **fifth audit
gate** (`i18n-audit.mjs`, in `npm run verify`) fails if a known needle
ceases to be covered. **Measurement, FR interface, site account, 18
views: 13 mixed views → 0.**

*Original finding:*

**Finding.** The committee had first noted a partial translation "per
view". The exhaustive sweep shows something worse: the mixing occurs
**within a single block** — French heading, English note, in the same
tile.

**Measured evidence.** French interface, `site` account: **13 out of 18
views** contain English fragments — meetings **16** occurrences, reports
**9**, documents **8**, changes **5**. Recorded on the portfolio:

> VALEUR DU PORTEFEUILLE · $1.80M · *1 funded project*
> SUR LA TRAJECTOIRE · 0% · *0 green · 1 amber · 0 red*
> INDICE COÛT (CPI) · 0.97 · *spending faster than earning*

**Real consequence.** This is not an incomplete translation, it is a
translation that **looks finished and is not**. The French-speaking user
concludes from the very first screen that the tool is not for them — and
the committee shares that judgment: a bilingual tile is less acceptable
than a frankly English interface.

**What the committee expects.** That notes and formatted values go
through `t()` just like the headings, starting with the four
worst-affected views; and an automatic check that fails if a view mixes
the two languages, without which the regression will come back.

---

### R-14 · No record of who viewed what — **CLOSED on 29/08/2026**

**Done**: the four sensitive surfaces — evidence file, data-set export,
decision register, audit trail — leave a named trace ("… consulted");
ordinary browsing leaves none, because logging every read would drown
the trail on which the control depends. **Measurement: export + evidence
file = named traces; bootstrap + digest = zero lines.**

*Original finding:*

**Finding.** The audit trail is exemplary on writes and silent on reads.
Some obligations — access to personal data, to disciplinary or security
files — bear on the fact of having **consulted**.

---

## What the committee takes as settled and does not want to see regress

The committee insists: the reserves above concern operation, not design.
Four strengths seem to it superior to the market and must survive any
correction:

1. **Independence is enforced, not documented** — the requester of a
   request does not decide it, the owner of a piece of evidence does not
   approve it, sign-off of change control escapes the project manager.
2. **The audit trail is tamper-proof at the database level**, with
   before/after images.
3. **The rhythm between group and sites is modelled as data** —
   referrals, decisions rendered, actions cascaded back down.
4. **A closed period is frozen** and a correction is a new period that
   names the one it corrects.

## Opinion

The committee **does not recommend** the use of Meridian as a source of
assurance evidence for as long as **R-01** remains open: a control that
approves an empty object exposes the organisation more than an absent
control, because it provides false reassurance.

The committee **does recommend**, however, continuing the rollout for
governance, the roadmap and the committee rhythm, subject to the
treatment of **R-02, R-04, R-05, R-06** before any handover to
French-speaking sites.

The executable instructions corresponding to these reserves have been
placed in `.claude/commands/`: see
[`docs/17-instructions-reserves.md`](../17-instructions-reserves.md).


---

## Re-test loop (/goal-reserves, step B)

After closing the fifteen reserves, ALL of the original measurements are
replayed on a fresh, seeded instance, under the original conditions
(French-speaking site account, 760×1100 then 375 px, network observed).
Exit requires **two consecutive fully compliant rounds**.

### Round 1 — 29/08/2026 · NON-COMPLIANT (1 deviation)

| Item | Result |
|---|---|
| `npm run verify` | 271/271, 5 audit gates, exit 0 |
| `npm run sweep` | 286 cases, 0 5xx errors, 12 documented ⚠ |
| API R-01 (approval with no artefact ×3 levels, evidence file "none — not evidence", phase blocked 409) | compliant |
| API R-02 (16-day digest / 7-day base, coverage offered, "X (for Y)", deputy cannot self-decide) | compliant |
| Browser: lang `fr`, 1 h1, title follows; bootstrap **16.1 KB** transferred; nav 4 groups | compliant |
| Sweep of the 18 views in French | **DEVIATION — "Record effort" displayed in English (Resources view)** |

**The deviation.** The actuals-entry button (R-03, added in phase 4 —
i.e. *after* the phase-3 translation pass) was indeed wrapped in `t()`,
but the dictionary had not kept up, and the silent fallback to English
masked the hole until the browser check. The full inventory found **170
labels** in the same situation — almost all in dialogs, help text and
empty states that the view sweep does not render.

**The fix.** The 170 entries were translated (FR dictionary: 417 → 587
entries), and audit gate F5 was given the probe it was missing: *any*
literal passed to `t()` must exist in the dictionary, or the build fails.
The hole can no longer reopen silently. R-15 is reopened for the
duration of the round, and the entire round is replayed.
### Round 2 — 29/08/2026 · COMPLIANT (0 deviation)

Fresh instance, dictionary completed, F5 probe hardened.

| Original measurement | Original finding | Round 2 |
|---|---|---|
| verify / sweep | — | 271/271 · 5 gates · 286 cases, 0 5xx |
| Approval with no artefact (admin / group / site) | silent 200 | **400 / 400 / 403** (group-level act at site) |
| Evidence file, row with no artefact | invisible | **"none — not evidence"** |
| Phase on incomplete evidence | went through | **409**, reason named |
| Return-from-absence digest | fixed 7 days | **16 days** (base unchanged: 7 days) |
| Deputisation | non-existent | offered, "X (for Y)", self-decision **403** |
| French interface | 13 mixed views | **0** mixed views out of 18 + project view |
| lang / h1 / title | en / 3 h1 | **fr · 1 h1 · title follows** |
| Bootstrap transferred | 90 KB | **15.9 KB** (gzip) |
| Ordinary write | full reload | **POST + `GET /collections?keys=…`**, zero bootstrap |
| Modal | 65 elements reachable behind | **0** · inert set/lifted · Tab trapped · Esc closes · **focus returned to trigger** |
| Benefit form | 11 fields in one block | **5 visible / 11**, "More detail (6)" |
| First collapse of the project view | 3.4 screens | **1.05 screens** |
| Targets < 24 px at 375 px (4 pages) | 29 | **0** |
| Out-of-scope refusal (in passing) | — | toast **in French**, site scope respected |

One compliant round out of the two required. Round 3 replays everything.
### Round 3 — 29/08/2026 · COMPLIANT (0 deviation)

Fresh instance, identical protocol, same measurements. verify 271/271 ·
5 gates · sweep 286 cases, 0 5xx. API: 12/12 (R-01 400/400/403, evidence
file "none — not evidence", phase 409; R-02 digest 16 days / 7 days,
"X (for Y)", self-decision 403). Browser: fr · 1 h1 · title follows ·
0/18 mixed views (project view included) · cold bootstrap **15.9 KB**
(cached reload: 0.3 KB) · write = POST + `collections?keys=` · modal 0
reachable behind, Tab trapped, Esc closes, focus returned · benefit
5/11 fields · first collapse 1.11 screens · 0 targets < 24 px across 4
pages at 375 px.

**Two consecutive fully compliant rounds (rounds 2 and 3) — the
re-test loop is closed.** The round-1 deviation left a lasting trace:
170 dictionary entries and a build gate that makes the hole impossible
to reopen.

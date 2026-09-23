> English translation of [`docs/22-comite-innovation.md`](../22-comite-innovation.md). The French original is the authoritative record; where they differ, the French governs.

# Innovation Committee — Meridian IT-PMO

Date: 30 August 2026. Convened after the AMDEC acceptance
([18-amdec-recette.md](../18-amdec-recette.md)), the adoption committee
([19-comite-adoption.md](../19-comite-adoption.md)) and the InfoSec/GRC
committee ([20-comite-infosec-grc.md](../20-comite-infosec-grc.md)).

Subject: say what the product should gain next. Three topics, in the
order of the mandate — AI interconnection, the notification center,
and whatever the committee judges still to carry value.

---

## 0 · Boundaries of the mandate

The committee is working on a mature product and knows it. It forbids
itself three things, and the first is the most important.

**It demands nothing that already exists.** The notification queue
exists (`server/src/notify.js`), substitution exists
(`015_rotation.sql`), the digest exists (`GET /digest`,
`server/src/routes/portfolio.js:2608`), the audit trail is
transactional and append-only (`server/src/audit.js:45`). The
committee counted before proposing; the counts are in §2.

**It reopens no decision already made.** The engine stays frozen and
is extended around, as `Engine.isEvidence` already did
([18-amdec-recette.md](../18-amdec-recette.md), settled item #3).
Authority stays decided in a single place. The independent committee's
fifteen reserves, the sixteen value findings, the eleven security
gaps and the sponsor's three written acceptances are settled.

**It reopens no reserve still open with another committee.** The nine
unresolved adoption reserves (A-01, A-05 through A-12) and the
seventeen GRC findings belong to their own committees. Where a
proposal touches them, it explicitly hooks into them instead of
rewriting them — this is notably true of the value measures, which
all add themselves to the adoption screen that **A-08** already
expects, and to no new screen.

**One precondition, and it is not negotiable.** The InfoSec/GRC
committee refused go-live authorization as things stand for four
wave-0 findings: G-01 (no proven backup), G-03 (the health data), G-04
(no written policy), G-13 (no legal basis, no retention period).
**Nothing below begins before they are closed.** A new capability
built on a base one cannot restore, and whose retention period is
undecided, is not a capability: it is an aggravation. The committee
says this once and does not return to it.

---

## 1 · Composition

Eight seats. None duplicates a seat of the adoption committee or of
the InfoSec/GRC committee; the CISO is represented by a delegated
representative, so that sensitive data has a voice here without the
seat being held twice.

| Seat | Origin | What it comes to decide |
|---|---|---|
| **Product architect** — *chair* | in-house | Where the call plugs in, and what does not move: the frozen engine, `audited()`, `shared/rbac.js` |
| **Inference-in-operations practitioner** | contractor, has deployed local models on isolated sites | What a site server can actually hold, and what the model gets wrong |
| **CISO's data delegate** | mandated by the InfoSec/GRC committee | What leaves, to where, under what third-party sheet — and what lands in an indelible table |
| **Site IT lead (Houndé)** | business | What happens when the satellite link drops at 2pm on a Tuesday |
| **Project controlling** | group | What figure the tool is allowed to state, and what the capability costs each month |
| **Alert-system ergonomist** | contractor, control-room specialty | At what volume an alert stops being read, and how that is measured |
| **Group IT operations** | group | Who runs the sweep, who gets the failure, who pays for the hardware |
| **The skeptic** — *former programme director* | group, declared mandate | Kill the weak ideas. That seat exists for this and has exercised it five times |

Characters and locations carried over from the adoption committee so
as not to invent new ones: the Houndé maintenance superintendent, the
project controller, the eight-site estate.

---

## 2 · What the committee counted before proposing

No figure in this section is an impression.

**On outbound flows.** The server opens **a single** outbound network
call in the entire product: the OIDC token exchange,
`server/src/oidc.js:106`. There is no other. Wiring in a language
model would therefore be the **second outbound flow in the product's
history**, and the first to carry business content.

**On dependencies.** Four runtime dependencies
(`package.json:23-28`) — the InfoSec/GRC committee credits this
figure to the product (G-11). Any proposal that adds even one carries
that handicap.

**On notification.** The `sweep()` sweep
(`server/src/notify.js:73-146`) produces **three** of the **six**
kinds the table declares (`013_notifications.sql:26`):
`decision-owed`, `digest` and `concern-raised` are written into the
constraint and emitted by nobody. The cadence preference accepts four
values (`015_rotation.sql:42-43`, checked at
`server/src/routes/auth.js:228`) and the code tests **only one**:
`notify.js:39` and `:49` compare against `"off"` and nothing else —
*daily* and *weekly* are offered to the recipient and change nothing.
The queue is only readable by an administrator (`GET
/admin/notifications`, `server/src/routes/admin.js:218`): **the
recipient of a message cannot read it.** And nothing triggers the
sweep: `server/src/index.js:205` and `:242` schedule only
`sweepSessions`; the only execution path is `POST
/admin/notifications/sweep` (`admin.js:240`), i.e. **an
administrator's click.** A notification queue that only leaves by
hand is not a queue, it is a button.

**On navigation.** `NAV` (`web/src/main.js:28-45`) carries eighteen
entries across five intents. None is a notification center. The
digest exists as a screen block (`web/src/views/index.js:141`,
rendered at `:434`) and is never a message.

**On proof.** `document` carries `uri`, `uri_locked_hash` and
`uri_locked_on` since `014_evidence.sql`. **Nothing ever re-checks
that an approved link still answers.** Acceptance testing had seen it
and accepted it: residual failure mode R-01, "the trusted host serves
dead links," RPN 32
([18-amdec-recette.md](../18-amdec-recette.md), row R-01).

**On offline.** `localStorage` only serves the theme, the language
and remembering the layout (`web/src/main.js:165, 188, 536`;
`web/src/lib/i18n.js:24, 29`). No service worker, no data cache. If
the link drops, the screen is empty.

**On lessons.** Migrations 001 through 017 contain no lessons table.
`rollout_wave` (`010_plant_and_sites.sql:64`) carries a `seq` and a
free-text `note`; the same wave is replayed up to eight times and
nothing carries forward what the previous one learned.

---

## 3 · AI interconnection

### 3.1 The sort, before everything else

The committee refused to start from what AI can do. It started from
the six named uses in the mandate and asked each a single question:
**what here is actually a language problem?** What is not one does
not deserve a model.

| Proposed use | What it really is | Verdict |
|---|---|---|
| Draft minutes from logged decisions | `renderMinutes` (`shared/meetings.js:410`) already writes it, from the frozen agenda, the decisions and the actions | **Rejected** — X-03 |
| Summarize an evidence pack | The pack is already produced, complete and deterministic (`routes/portfolio.js`, evidence-pack route); its value is being exhaustive | **Rejected** — X-02 |
| Natural-language question on the portfolio | A disguised SQL query when it is about a figure; a **navigation** problem when it is about "where is it?" | **Split** — figure rejected (X-01), navigation retained under condition (N-04) |
| Detect a risk that repeats across sites | A real language problem: eight registers, two languages, free text, no shared vocabulary | **Retained** — N-03 |
| Field-entry assistance | A real language problem: thirty-six forms out of fifty-eight are mute (A-05), and the worst-filled fields are exactly the ones a third party will read | **Retained** — N-02 |
| Weekly status draft | A real language problem, and the spot already exists: `report_narrative` (`002_portfolio.sql:224`), written via `PUT /narrative/:key` (`routes/portfolio.js:2120`) | **Retained** — N-02 |

The rule that comes out of this sort, which the committee sets as
doctrine: **AI is allowed to write sentences, never numbers.** The
number is the product. It comes from `shared/engine.js`, which is
frozen, tested and authoritative; a second source for the same figure
is not a feature, it is a governance defect.

### 3.2 N-01 — The assistance contract

**Finding.** The product has no entry point for an inference service,
and that is fortunate: it will have only one, and its shape decides
everything that follows.

**Proposal.** A single server module, `server/src/assist.js`, placed
next to `notify.js` and built on the same two deliberate separations:
**composing is not writing**, **asking is not deciding**.

Server-side, never browser-side — for three reasons, each of which
holds on its own: the content policy imposed by S-12 forbids the
client from calling a third party; a key handed to the browser is a
published key; and a site's satellite link should not carry the call
when the model runs on the site's own server.

**Technical contract.**

```
POST /api/assist/:task        task ∈ { field-draft, status-draft,
                                      navigate, pattern-explain }
→ 200 { draft | route, model, endpoint, callId, tookMs }
→ 501 { error: "assistance non configurée — MERIDIAN_ASSIST_URL" }
→ 503 { error: "le modèle n'a pas répondu en <n> ms — rédigez à la main" }
```

The task list is **closed**, as `ACTIONS` is closed in
`shared/rbac.js:23`. There is no route that accepts a free-form
instruction: what the model receives is composed by the server from a
versioned template and from the book already reduced to the caller's
scope.

**Configuration.**

| Parameter | Default | Behavior |
|---|---|---|
| `MERIDIAN_ASSIST_URL` | *absent* | OpenAI-compatible endpoint (`/v1/chat/completions`). **Absent, the capability does not exist** |
| `MERIDIAN_ASSIST_MODEL` | *none* | Required alongside the URL. No default value: a default model name is a silent choice |
| `MERIDIAN_ASSIST_KEY` | *absent* | Optional — a local server does not ask for one. If present, it is a secret under the G-15 register |
| `MERIDIAN_ASSIST_TIMEOUT_MS` | `8000` | Beyond this, the draft is abandoned and the form says so |
| `MERIDIAN_ASSIST_EGRESS` | `local` | The server resolves the URL's host. If it is neither loopback nor private addressing, **the capability refuses to activate** and says why, unless `external` is set explicitly |

**What happens when it is not configured** — and this is the point on
which the committee accepts no flexibility: the command **is not
drawn.** This has been the product's rule since R7.3 — "a command an
account cannot use is not drawn" — and it applies here with no
exception. The route answers 501 naming the parameter, the way
`documentHosts` names its own. No simulated response, no
pre-written example, no grayed-out button promising something for
later.

**Consent is an act of the site.** Migration 021:
`site.assist_enabled boolean NOT NULL DEFAULT false`. A site that has
not activated it never sees one of its own rows composed into an
instruction, even if the group has wired in a model. The InfoSec/GRC
committee set the rule and the innovation committee repeats it word
for word: **no sheet, no connection** (G-16) — and adds to it: *no
consenting site, no row.*

### 3.3 The six non-negotiable guarantees

They are not intentions. Each is checkable, and five of them are
checked by an automatic build gate — the sixth reason for `npm run
audit`, following the five that already exist.

**GA-1 — AI does not decide.** No assistance output becomes a
status, a prioritization score, a RAG light, an approval or an
amount. *Check:* the gate fails if `shared/engine.js` imports
`assist.js`, or if an assistance route returns a key from the
engine's vocabulary.

**GA-2 — AI does not write.** No assistance route opens a
transaction. `audited()` (`server/src/audit.js:45`) remains the only
write path, and the write is the human's, through the ordinary route,
with its ordinary audit row. *Check:* the gate fails if `assist.js`
imports `audited` or `tx`.

**GA-3 — AI does not widen any scope.** Every instruction is
composed from `loadPortfolio(req.user)`, i.e. from the book already
narrowed by `projectScopeSql` (`shared/rbac.js:434`). No assistance
route reads more broadly than its caller. *Check:* assistance routes
enter the existing usage sweep — the same four roles, the same
requirement of zero real gap.

**GA-4 — Nothing leaves the site without an explicit act.** Two
independent locks, both closed by default: `MERIDIAN_ASSIST_EGRESS`
on the host, `site.assist_enabled` on the site. The first protects
the install, the second protects the site against the group.

**GA-5 — What AI produced is marked, and nothing more.** Migration
021: table `assist_call` (who, when, task, model, endpoint, entity
concerned, **hash** of the instruction, length, duration, outcome)
and column `audit_event.assist_ref text NOT NULL DEFAULT ''` pointing
to it. A row written from a draft therefore carries, on the trail,
the mention "drafted with assistance" and enough to trace back to the
call.

The committee stresses what is **not** there: the text of the
instruction is not copied into the trail. G-03 has just taught the
product what a `before: { ...a }` costs in a table the database
refuses to erase. Doing it again with model instructions would be the
same mistake at a larger scale.

**GA-6 — Missing configuration says so.** It does not get simulated.
This is the third instance of a doctrine already held three times —
SMTP, Entra ID, `documentHosts` — and accepted in writing by the
sponsor.

### 3.4 N-02 — The field draft and the status draft

**Finding.** The adoption committee counted thirty-six forms out of
fifty-eight with no assistance whatsoever, and named the field
population that matters: those whose value **is read by someone other
than the person who enters it** — rejection reason, decision note,
benefit measure, rebaseline justification (A-05). These are exactly
the fields a French-speaking site lead at the end of a rotation fills
with one word, or not at all.

**Proposal.** Two tasks, one mechanism.

`field-draft` — at the foot of a long-text field, a *Propose a draft*
command. The server composes the instruction from the current object
(the project, the request, the decision) as the caller is allowed to
see it, and returns sixty to eighty words in the account's language
(`app_user.locale`). The text arrives **in the field, editable, not
saved.** No write has occurred. The write that follows will be the
user's.

`status-draft` — on the report screen, the same for a block of
`report_narrative`. The spot exists, the route exists (`PUT
/narrative/:key`), concurrency is already handled. There is nothing
to invent around it: only to fill Monday morning's blank page.

**Cost.** No new dependency — `fetch` is in Node. About 250 server
lines, 150 client lines, one migration. The recurring cost lies
elsewhere: either hardware on the site server, or a per-token bill
that nobody on a mining site knows how to forecast. §3.6 settles it.

**Value measure.** `assist_call.outcome` is recorded at the moment
the human write follows — or does not:
`accepted` / `edited` / `discarded` / `failed` / `timeout`.

1. **Share of drafts kept** (`accepted` + `edited`), by task, by
   site, by month, on the adoption screen A-08 expects. Threshold
   decided ahead of time: **below 40% over a quarter for a given
   task, the task is withdrawn**, not tuned. A measure that cannot
   say no is not a measure.
2. **Share of third-party-read fields that arrive non-empty**, before
   and after. This is the only measure that says whether assistance
   served *the reader* rather than the writer. If it does not move,
   assistance is decoration and will be withdrawn with the same
   discipline.

### 3.5 N-03 — The pattern that repeats across sites

**Finding.** This is the one use where the committee found value
nothing else can produce. Eight sites each keep their own register,
in French and English, in free text, with no shared vocabulary. The
same supplier failure hits Houndé in March and São Paulo in June; both
rows exist, nobody connects them, and the next wave of the same
deployment repeats it in full. No SQL query connects "unstable
satellite link during failover" with "connectivity loss at link
switchover." This is a language problem, and the only one in the
batch.

**Proposal.** A similarity match, never a decision.

One vector per open register item and per closed change request,
obtained from the same inference server
(`MERIDIAN_ASSIST_EMBED_URL`, `/v1/embeddings`). Stored as `real[]`
on the row, cosine computed in SQL: the group's register holds a few
thousand rows, a full scan is enough, and **there is therefore no
reason to add `pgvector`** — which also preserves the PGlite
fallback, which would not have it.

The output is a **suggestion** on the programme governance screen:
"this item resembles three items from other sites." The suggestion
writes nothing. A human, if they agree, escalates through the
existing RAID mechanism, and that act is audited like any other.

**A constraint on authority the committee insists on writing down.**
This surface is **reserved to the group level.** `canSeeProject`
(`shared/rbac.js:108`) only grants a site account its own sites and
the group-governed projects; a surface that cross-references eight
sites' registers would, for a site account, be a side window onto the
neighboring site's register. It therefore does not exist for them.
This is not a configurable option, it is the direct consequence of
the access model.

**Value measure.** Number of suggestions **kept** per quarter, and —
the honest measure — number dismissed. **Below one suggestion kept
per site per quarter, the surface is withdrawn.**

### 3.6 The local model — what a site server can actually hold

The committee treated the local option as the default position, not
as a variant. Three reasons, in order of strength.

**The data.** §3 of the InfoSec/GRC report classifies what the schema
carries: indirect compensation on `person`, working time on
`timesheet`, correspondence on `notification`, and an aggregate of
all of it on `audit_event`. Composing an instruction from the book
means putting content of this nature into an outbound request. Without
a G-16 third-party sheet — data transmitted, **location**,
availability commitment, exit conditions — this does not get
connected.

**The link.** On satellite, a round trip to an enterprise service
adds two to three seconds before the first word, when the link
holds. A draft that arrives after the form is not used. The model on
the site's own server does not have this problem; the model at the
group level has it for all eight sites.

**The hardware, stated with no optimism.** A seven-to-eight-billion
parameter instruction model, quantized to four bits, fits in five to
six gigabytes. On a site server's CPU, it produces a few words per
second: acceptable for a sixty-word draft, unusable for a
conversation. On a modest sixteen-gigabyte graphics card, it is
instant.

This is the sentence that closes §3: **the three retained uses are
all short-output, and that is not a coincidence.** The hardware
constraint of an isolated site and the governance constraint of an
audit product point to the same perimeter. What the site server can
carry is exactly what the committee accepts that AI should do.

### 3.7 N-04 — Natural-language navigation *(retained under condition)*

**Finding.** "Which projects at my site are slipping by more than
thirty days?" is not a question about a figure — the figure is
already calculated and displayed. It is a question about **where it
is**, among eighteen screens.

**Proposal.** The model receives the question and the catalog of
views and their filters; it returns **a route**, never data:
`{ view: "portfolio", filters: { site: "GRU", slipDays: ">30" } }`.
The client navigates there. The figures displayed are the engine's,
as always. If it does not know, it says so and points to Ctrl-K.

**The skeptic opposed it**, and the objection is logged: the command
palette already searches everywhere (`web/src/main.js:249`, "Search
everything (Ctrl-K)"), and a navigation assistant risks becoming the
manual reserve A-01 is waiting for — the worst possible manual,
because it is neither re-readable, nor translatable, nor
authoritative.

**The committee therefore retains it under two written conditions.**
One: A-01 (the in-product manual) and A-10 (role-based journeys) must
ship first. Two: the stop condition is fixed in advance — if the
share of questions the model answers "I don't know" exceeds a
quarter in the second month, the capability is withdrawn with no
further session.

---

## 4 · N-05 — The notification center — **BUILT on 30/08/2026**

> **Delivered** (commit `acec6ba`, migrations 018 and 019). What the
> committee designed holds, including its refusals: the center reads
> `user_id = req.user.id` and nothing else, it opens no new write
> path, the purge **refuses to guess** a retention period nobody has
> written and never touches a message still in the queue, the
> escalation step moves up a level instead of resending, night
> quiet-hours are read in the site's time zone and "urgent" pierces
> through it. The sweep finally runs on its own, under an advisory
> lock. Nine tests in `server/test/centre.test.js`; measured on the
> screen in French: 2 unread → mark all → 0, an empty state
> translated, an "also show what I've already read" toggle that
> finds them again.
>
> **A fundamental defect found while building**, fixed at the
> database layer: PGlite returns `affectedRows` where `pg` returns
> `rowCount`. Every `r.rowCount` in the product was therefore reading
> `undefined` on the embedded engine — a route was answering "row not
> found" about a row it had just updated. It is the least-instrumented
> deployment that ran into this defect.
>
> **Left for the sponsor to decide**: `notifyRetentionDays` (without
> it, the purge abstains and says so), `notifyEscalateDays`, and
> `notifyHosts` for the outbound channel, closed by default.

### 4.1 Finding

There is a send queue. There is no center, and the counts in §2 say
how much: the recipient cannot read what is addressed to them, the
cadence preference they chose changes nothing, three of six message
kinds are emitted by nobody, and the sweep only runs when an
administrator clicks.

The adoption committee did not cover notifications — the ground was
free, it checked. But it left a sentence that governs everything
below: *"if one of the eight sites has quietly gone back to keeping
its portfolio on a spreadsheet, nothing in Meridian will say so"*
(A-08). A notification center is the answer to that sentence, on
condition that it does not itself become the reason people stop
looking at the tool.

### 4.2 The center

A nineteenth navigation entry, in the **Deliver** intent, right below
*My week* — and a discreet counter in the header. Only three things
happen there.

**What's waiting for me.** Messages addressed to me, unread, grouped
by subject. Never a list of everything the queue holds.

**What I've read.** Read is not sent. The table's `state` field
(`013_notifications.sql:32-33`) is a **delivery** state — queued,
sent, failed, deleted. It will never say a person has seen something.
That needs a field of its own, and it does not exist.

**What I can do from there.** Open the object, and — when the object
is a committee action I own — close it. Nothing else.

This last limit is a guarantee, not a poverty: **the center opens no
new write path.** Closing an action from the center calls the
existing route, with its authority control and its `audited()`. A
notification center that writes through a parallel path is a bypass
of `shared/rbac.js` disguised as convenience.

**And reading the center passes through no scope.** `GET
/api/me/notifications` filters on `user_id = req.user.id`, full stop.
Never `projectScopeSql`, never a join on the book. This is what makes
the center structurally unable to leak: it does not read the
portfolio, it reads a mailbox. Redirection to the substitute having
already occurred at queuing time (`resolveRecipient`,
`server/src/notify.js:37-52`), the substitute reads their own mailbox
and not the absent person's.

The index serving this read already exists:
`notification_user_idx` (`013_notifications.sql:41`). The committee
credits it.

### 4.3 Subscription rules

Today, an account carries **one** global cadence, and it is ignored.
The committee wants a subscription, i.e. a crossing of four things:
**by event, by scope, by severity, by channel.**

```
notification_subscription
  user_id      → app_user
  kind         event kind, or '*'
  scope_kind   'portfolio' | 'programme' | 'site' | 'project'
  scope_id     '' for portfolio
  min_severity 'info' | 'attention' | 'urgent'
  channel      'centre' | 'courriel' | 'sortant'
  cadence      'immediate' | 'daily' | 'weekly'
  active       boolean
```

Two composition rules, written to avoid surprise:

- **The center is not subscribable.** Everything addressed to me
  arrives there, always. A subscription governs what **goes out** to
  me, never what I can come and check. A user who unsubscribes from
  everything must still be able to see what they missed.
- **Cadence is finally honored.** `immediate` queues right away;
  `daily` and `weekly` aggregate into a single message per period —
  precisely what the `digest` kind, declared and never emitted, has
  been waiting for since `013_notifications.sql:26`.

Three new kinds, plugging holes found elsewhere: `site-quiet` (no
progress update on a site for thirty days — the threshold is A-08's,
and the committee reuses its figure rather than inventing one),
`timesheet-missing`, and `evidence-unreachable` (see N-07).

### 4.4 Channels

Email exists and waits on `MERIDIAN_SMTP_URL`. The committee adds
**one**, and only one.

**Outbound HTTPS.** One address per site or per programme, with a
JSON payload. This is also the honest answer to the Teams question: a
Teams incoming connector **is** an HTTPS POST of a JSON card. There
is therefore no Teams channel to write — there is an outbound
channel, of which Teams is the first documented consumer. No app
registration, no Graph token, no new dependency, no additional third
party in the G-16 sense beyond the one the group already operates.

An incoming connector's address **is a secret**: it enters the G-15
register with a custodian and rotation, and the list of allowed hosts
is closed by default, on the exact pattern of `documentHosts`.

**What the committee refuses to add:** satellite-link SMS (cost per
message, no read traceability, and the one case that would justify
it — on-call duty — is not handled by this tool), mobile push
notifications (there is no mobile app), and real-time in the browser
(there is no real-time layer, and a check at navigation time is
enough for a tool whose unit of time is the week).

### 4.5 Noise management

This is the seat of the alert-system ergonomist, who wrote this
paragraph, and wrote it first. **A notification center fails by
excess, never by default.** Five mechanisms, all measured.

**Grouping.** `notification.group_key` — one message per project per
day rather than one per action. The existing deduplication mechanism
(`dedupe_key`, and the nice detail in `notify.js:141` where a blocked
milestone is weekly because it is a permanent state) is **kept
intact** and complemented: deduplication prevents repetition,
grouping prevents a burst.

**The threshold.** `min_severity` per subscription. A severity is
carried by the row (`notification.severity`), computed at emission,
never set by hand.

**Night quiet hours.** Two columns on `app_user` — `quiet_from`,
`quiet_to` — read in the **site's** time zone, not the server's. A
message emitted during quiet hours is not dropped: it waits. Except
`urgent`, which goes through, because a silence nobody can pierce
becomes a silence that gets turned off.

**The escalator.** A message unread after N days **moves up a
severity level** instead of being resent. Resending the same message
teaches people to ignore it; escalating it teaches that it matters.
The committee holds to this mechanism: it is cheap and the only one
in the batch that addresses the cause rather than the symptom.

**Rotation.** Already handled, and well: `resolveRecipient` redirects
to the named substitute and prefixes the message so nobody mistakes
whose job it is. The center inherits this untouched. What it lacks is
elsewhere — see §4.6.

### 4.6 Interplay with the existing substitution and digest

**Substitution.** It works at queuing time and not at return. A site
lead coming back from fourteen days finds a mailbox their substitute
may or may not have read, with no way to know. The center therefore
adds, and this is all it adds: **on return, the list of what was
addressed to my substitute on my behalf, and what they did with it.**
Not a second mailbox — an `on_behalf_of` column and a filter.

**The digest.** `GET /digest` already does the right thing and
nobody touches its logic: the window widens to the length of the
absence, seven days floor, sixty days ceiling
(`routes/portfolio.js:2614-2630`). The committee changes nothing
about it. It only notes that this work never leaves the screen, and
that the table's `digest` kind has been waiting for its emitter since
`013`. The weekly message is therefore **exactly what the view
already computes**, rendered in the recipient's language by `say()`
(`server/src/i18n.js`). No second definition of the digest will be
written.

### 4.7 What is missing in the database

**Migration 018 — the center.**

```sql
ALTER TABLE notification ADD COLUMN read_at     timestamptz;
ALTER TABLE notification ADD COLUMN acted_at    timestamptz;
ALTER TABLE notification ADD COLUMN severity    text NOT NULL DEFAULT 'info'
       CHECK (severity IN ('info','attention','urgent'));
ALTER TABLE notification ADD COLUMN group_key   text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN locale      text NOT NULL DEFAULT '';
ALTER TABLE notification ADD COLUMN channel     text NOT NULL DEFAULT 'courriel';
ALTER TABLE notification ADD COLUMN on_behalf_of text REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE notification ADD COLUMN expires_on  date;      -- G-13
-- the vocabulary widens to the new kinds and to those that were
-- waiting for an emitter: site-quiet, timesheet-missing, evidence-unreachable
CREATE INDEX notification_unread_idx ON notification(user_id, read_at, at DESC);
```

**Migration 019 — the subscription.** The `notification_subscription`
table above, plus `app_user.quiet_from` / `quiet_to`. The global
`notify_pref` preference is **kept** as the default for an account
with no subscription: it stops being a lie without becoming a
breaking change.

**Migration 020 — the outbound channel.** `notification_channel`
(scope, address, active, last failure) and the `notifyHosts` setting,
closed by default.

**The sweep must finally run.** An hourly `setInterval` next to
`sweepSessions` in `server/src/index.js:205`, guarded by a
PostgreSQL advisory lock so a second instance does not duplicate
messages. `POST /admin/notifications/sweep` stays, as a manual
command and as an observation aid.

### 4.8 What the center makes worse if it arrives alone

The committee refuses to propose this capability without the load
that goes with it.

`notification` retains the recipient's email, the subject **and the
body**, with no purge. Finding G-13 raised this and requires a
scheduled purge with a viewable counter of what it has deleted. A
notification center multiplies this table's volume by a factor
nobody can bound in advance.

**The purge is therefore not a follow-up to N-05: it is part of it.**
The `expires_on` column is in migration 018 for this reason, and the
batch is not shippable without its broom. The committee adds the one
thing it can add: the retention period is **a decision for the
sponsor**, not for engineering, and the code will not invent it —
with no written period, the purge refuses to run and says so, on the
exact pattern of `documentHosts`.

### 4.9 Value measure

Four figures, on the A-08 adoption screen, by site and by month.

1. **Share of notifications read within 72 hours.** This is the
   relevance measure. Below 50%, the center is noise.
2. **Share of closed actions whose last opening came from the
   center.** This is the usefulness measure: did the center cause an
   act, or merely report a fact?
3. **Outbound messages per active account per week.** A **ceiling
   decided in advance**: beyond ten, the committee considers the
   tuning has failed and lowers the thresholds, rather than asking
   people to filter better.
4. **Number of unsubscribes.** This is the only indicator in the
   batch that can say no, and that is why it is there.

---

## 5 · The other capabilities retained

The mandate authorized four. The committee had five and keeps
**three**. The two dropped are dropped for the same reason, a matter
of order: *naming a local site contact* belongs to reserve A-12 of
the adoption committee, and *detecting a site's silence* is already
one of the six indicators of A-08 — its alert becomes a kind of N-05,
not one more capability. A committee that takes over another
committee's work filters nothing: it inflates.

### N-06 — Offline survival — **BUILT on 30/08/2026, with a design correction**

> **Delivered**, but not as written — and the committee should know
> why.
>
> The snapshot was built as designed: written on every successful
> load under a key carrying the account, re-read when the server
> stops responding, cleared on sign-out, no write queued, a permanent
> banner naming the time, and `can()` returning false offline —
> therefore no write command drawn, with no new code, by R7.3.
>
> **What building revealed**: as designed, the capability almost
> never served a purpose. A session already open survives anyway,
> the book being in memory; and a reload fails **before reaching a
> single line of code**, because the shell itself comes from the
> server. §2's "no service worker" was recorded as a finding; it
> should have been read as a dependency. A minimal service worker was
> therefore added (`web/public/sw.js`, network-first, API never
> cached, a single shell generation): without it, the snapshot never
> gets a chance to be read.
>
> **What remains to be observed in the field**: the test browser
> refuses to register a service worker, registration failing
> silently. The file is written, served correctly and tested to
> break nothing; **its offline effect has not been observed here**
> and will need to be, on a site machine. Six tests hold the rest
> (`server/test/offline.test.js`), including the one that matters:
> an expired session is not an outage, and a snapshot never replaces
> a session.

### N-06 (original design) — Offline survival, read-only

**Finding.** §2 says it: no cache, no service worker. When the
satellite link drops — which, at Houndé, happens — the screen is
empty. The site IT lead stated the need with no ambiguity: they are
not asking to write offline, they are asking to **still be able to
read what they knew an hour ago.**

**Proposal.** The bootstrap book is already small — the R-08
non-regression report measures about 16 KB gzipped on initial
transfer. It is persisted on every successful load, under a key
carrying the account's identifier. If the load fails, the
application renders the snapshot, with **a permanent banner naming
the time** and **no write command drawn** — the same `mayWrite`
function returns false, the R7.3 rule does the rest with no new
code.

**What it does not do, and why.** No write is queued offline. Two
reasons, either sufficient on its own: the product's concurrency
relies on `row_version`, which cannot be honored against a book that
has not been re-read; and a write replayed later would carry, on the
trail, a timestamp that is not the act's real one. The committee
prefers a tool that honestly refuses to a tool that promises a sync
it cannot guarantee.

**A precaution the adoption committee made mandatory.** A-03 found
that `localStorage` on a shared control-room machine follows
everyone. The snapshot is therefore cleared on sign-out and on
account change — on the pattern already written for the view cache
(`web/src/views/index.js:115-118`, where the whole card is discarded
when the book or the account changes).

**Cost.** About 60 client lines, no migration, no route.

**Measure.** Share of site sessions that hit at least one failed
load, and — the measure that matters — number of sessions that
continue after that failure instead of stopping. Below 5% of
sessions affected over a quarter, the capability is withdrawn: it
would have solved a problem that does not exist.

### N-07 — Evidence liveness check — **BUILT on 30/08/2026**

> **Delivered** (migration 020, `server/src/probe.js`, eight tests).
> The guarantee the committee set is the one that guided the code:
> the probe **does not judge**. A dead link leaves the approved
> document alone — a satellite link dropping overnight does not
> unapprove a milestone by morning. It only reaches out to hosts
> already present in `documentHosts`; with no hosts configured, it
> abstains and says so. Three consecutive failures before warning the
> project manager through the §4 center, and the message states in
> plain terms that nothing has been withdrawn.
>
> A distinction added while building: **401 and 403 are not a
> loss.** They say the probe had no access, not that the item has
> disappeared — conflating them would make the tool cry out over
> evidence perfectly in place behind authentication. Hence the
> `forbidden` state, distinct from `unreachable`.
>
> The library shows the fact next to the link (✓ / ⚠ / 🔒), never in
> the status. The requested measure — share of approved evidence
> whose link answered — is computed on every pass; **the figure from
> the first real pass remains to be logged**, as the committee
> recommended.

### N-07 (original design) — Evidence liveness check

**Finding.** It does not come from the committee: it comes from
acceptance testing. Residual failure mode R-01 explicitly names the
case "the trusted host serves dead links," rates it RPN 32, and
accepts it for lack of detection. A year later, a passed milestone
rests on evidence nobody knows still answers. `014_evidence.sql`
fixes the URI's hash at approval; it never checks that the URI still
answers.

**Proposal.** A periodic probe, carried by the same scheduler as the
sweep: a `HEAD` request on the URI of every approved document, **and
only toward hosts already present in `documentHosts`.** This is
therefore not a new outbound flow: it is the one the sponsor has
already authorized, exercised in the other direction.

Migration 022, columns on `document`: `probed_at`, `probe_status`,
`probe_state ('ok','unreachable','forbidden','never')`.

**The guarantee that matters.** The probe **never changes the
document's status.** A network outage must not unapprove a
milestone. It produces a fact displayed in the library and, after
three consecutive failed probes, an `evidence-unreachable` message to
the project manager through the §4 center. Judgment stays human, as
everywhere else in this product.

**Cost.** About 80 lines, one migration, one message kind.

**Measure.** Share of approved milestone evidence whose link
answered within the last thirty days. Target 100%. **The figure from
the first pass is the most interesting one in the batch**, and the
committee recommends logging it as is.

### N-08 — Lessons attached to the wave

**Finding.** `rollout_wave` carries a `seq`: the same thing is done
up to eight times, in order. Nothing carries forward what the
previous wave learned. The RAID register keeps open risks; once
closed, they say nothing more to anyone.

**Proposal, and its shape is the whole point.** Migration 023, table
`wave_lesson`: what happened, what to do differently, who logged it.
Written at wave closure, mandatory to close it. No new authority
action: `wave.write` already exists (`shared/rbac.js:349`).

**The skeptic attacked, and was right.** A lessons register is the
most-created and least-read artifact in the history of project
offices. The committee therefore retains it **only in a form that
forbids the library**: the lesson from wave `seq = n` is presented at
the opening of wave `seq = n+1` of the same project, on its screen,
at the moment it is useful. There is no "lessons" screen, and there
must not be one. *A lesson that lives in a library is not a lesson,
it is an archive.*

**Cost.** One migration, about 120 lines, two forms.

**Measure.** Share of waves of rank ≥ 2 opened after logged
consultation of the previous one's lesson — measurable because
consultation is logged in a single call (`noteConsultation`,
`routes/portfolio.js:2549`, reason R-14). Below 50% by the second
quarter, the entry requirement is **lifted**, not tightened: a
missing read is not fixed by one more write.

---

## 6 · What the committee rejects

Five ideas. The first three are appealing, wanted elsewhere, and
wrong here.

**X-01 — The conversational assistant on the portfolio ("ask your
data a question").** Rejected. Two reasons, each sufficient. The
first: a model composing a figure competes with `shared/engine.js`,
which is frozen, tested by 271 tests and authoritative; two sources
for the same figure is not a feature, it is a governance defect, and
project controlling was categorical. The second: scope.
`projectScopeSql` (`shared/rbac.js:434`) is testable because it is
written; a query generated on the fly is not, and the 286-case × 4-role
sweep would lose its meaning the day the query is no longer in the
repository. What is still useful in this idea — knowing where to look
— is retained differently, in N-04.

**X-02 — AI summary of the evidence pack.** Rejected. An evidence
pack's value lies in its exhaustiveness and reproducibility; it
already carries its own guarantee sentence in its footer. A summary
that omits is worse than no summary, because its reader will believe
they have read it. And the auditor receiving the summary will have to
re-read the pack anyway — so the summary will only have wasted the
time of whoever produced it.

**X-03 — AI-drafted meeting minutes.** Rejected, and it is the
rejection the committee is most confident about. `renderMinutes`
(`shared/meetings.js:410`) already writes minutes from the frozen
agenda, the decisions and the actions. What a model would add is the
one thing missing: the **reason** for a decision whose reason was not
logged. But an empty `meeting_decision.rationale` is an honest
signal — it says nobody wrote why. Filling it by inference means
fabricating a justification after the fact in a mining group's
decision register. The committee does not want to know how that
plays in front of an auditor.

**X-04 — AI-assisted prioritization scoring.** Rejected for
consistency. Adoption reserve A-06 already faults the formula `fit +
value + (6 − risk) + (6 − effort)`
(`shared/engine.js:433-438`) for being explained nowhere, and states:
*a budget trade-off nobody can explain is not a trade-off, it is a
verdict.* Having the model score it would make the formula
inexplicable instead of explaining it. The right answer to A-06 is
A-06.

**X-05 — Native Teams integration, and mobile push notifications.**
Rejected. The first adds an app registration, one more secret, a
dependency on a tenant whose recovery is described nowhere (G-16) and
one more third party to assess — to obtain what an HTTPS POST already
obtains (§4.4). The second assumes a mobile app that does not exist
and that nobody has asked to be built.

---

## 7 · Release plan

The order follows what is ready and what depends on nobody, the way
the InfoSec/GRC committee ordered its waves by harm rather than by
difficulty.

### Wave 0 — precondition, outside this committee's scope

G-01, G-03, G-04, G-13. Nothing begins before these.

### R2 — ready to build, no sponsor decision required

| Batch | Content | Base |
|---|---|---|
| **R2-a** | **N-05 · the notification center** — the center, subscriptions, cadence finally honored, grouping, night quiet hours, the escalator, the scheduler, the substitution return, **and the G-13 purge that is part of it** | 018 · 019 |
| **R2-b** | **N-07 · evidence liveness check** — closes a residual failure mode accepted at acceptance testing, and relies on a flow already authorized | 022 |
| **R2-c** | **N-06 · read-only offline survival** — no migration, no route, no flow | — |

None of these three batches lets any data out, adds a dependency, or
requires a secret. R2-a is the heaviest and must ship as one block: a
center with no purge worsens G-13, a purge with no decided retention
period does not run.

The outbound channel (migration 020) is technically ready and
**awaits decision no. 4 in §8**; it ships in R2 if the address is
supplied, in R3 otherwise, with no change to the rest of the batch.

### R3 — after a sponsor decision

| Batch | Content | Base | Awaits |
|---|---|---|---|
| **R3-a** | **N-01 + N-02 · the assistance contract and the drafts** | 021 | Decisions 1 and 2 |
| **R3-b** | **N-08 · the lesson attached to the wave** | 023 | nothing — placed in R3 by workload, not dependency |
| **R3-c** | **N-03 · the pattern that repeats across sites** | 021 extended | R3-a shipped and measured |
| **R3-d** | **N-04 · natural-language navigation** | — | A-01 and A-10 shipped |

R3-c does not begin before R3-a's measure has a quarter of hindsight:
if drafts are not kept, there is no reason to believe pattern matches
will be either.

---

## 8 · What requires a sponsor decision

Four decisions. None is technical, and engineering will invent none
of them.

1. **Where the model runs, and who pays for the hardware.** An
   inference server per site, one at group level, or none. The
   committee's default position is *per site*, for the three reasons
   in §3.6. The cost is a one-time purchase, not a subscription.
2. **If the model is off-site: the G-16 third-party sheet, before
   connection.** Data transmitted, **location**, availability
   commitment, exit conditions. This is the InfoSec/GRC committee's
   rule and the innovation committee repeats it with no softening:
   *no sheet, no connection.* A token-billed service further adds a
   variable bill nobody could bound in session.
3. **The notification queue's retention period** (G-09, G-13).
   With no written period, the purge does not run and batch R2-a is
   not shippable. The GRC report suggests aligning it with the
   group's financial retention; the committee has no opinion, it
   needs a number.
4. **The outbound connector's address**, if the group wants the
   Teams channel. It is a secret under G-15: named custodian,
   rotation.

---

## 9 · Verdict

The committee examined six AI uses and retains **three and a half**:
field and status drafts, the cross-site pattern match, and navigation
under condition. It rejects two that were in the mandate, and three
others that invited themselves in. The reason is constant and fits
in one sentence: **AI is allowed to write sentences, never numbers,
and never into the database.** The six guarantees in §3.3 are not
principles: five of them are build gates, and the committee treats
them as the condition of its own agreement.

The notification center is the most ready and safest proposal in the
report. It asks the sponsor for nothing but a number, lets no data
out, and answers a finding the adoption committee had left
unanswered: what happens when a site quietly stops using the tool.

What the committee delivers with every proposal, and holds to be its
main contribution: **a stop condition written in advance.** Below
40% of drafts kept, the task is withdrawn. Below one suggestion kept
per site per quarter, the surface is withdrawn. Beyond ten messages
per week, the thresholds come down. Below 5% of sessions affected,
offline is withdrawn. None of these measures needs a new screen: they
all add themselves to the adoption screen reserve **A-08** already
expects, and the committee recommends — as the adoption committee had
recommended before it — **installing it first.**

A committee that cannot say under what condition it would have been
wrong has proposed nothing: it has made a wishlist.

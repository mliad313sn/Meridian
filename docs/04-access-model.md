# Access Model — group, site, admin, viewer

The operating model the committee agreed (D-02, D-03), and how it is
enforced. One file decides authority: `shared/rbac.js`. Everything below
describes what that file does and why.

---

## 1 · The two axes people confuse

They are not the same thing, and collapsing them is the mistake this
model exists to prevent.

**Where a project is delivered** — `project.site_id`. São Paulo leads the
LATAM localisation wave; Kraków leads payments. This is a fact about
staffing and geography.

**Who governs a project** — `project.governance_level`, one of `group` or
`site`. This is a fact about authority: who may move its dates, spend its
money, and answer for it at steering.

A project can be *delivered in* São Paulo and *governed by* the group.
When it is, São Paulo can see it, work in it, and report on it — and
cannot re-baseline it. That is R1.6, and it is the single rule most of
the authorisation tests are written around.

> **A-02's position at the table:** "Group level is not the same as admin
> level. I need write authority across my programme in every site, and
> read across the rest. Do not collapse those into one 'admin' switch."

---

## 2 · The four levels

| Level | Scoped by | Sees | Writes |
|---|---|---|---|
| **admin** | nothing — unrestricted | everything | everything, plus users, grants and global settings |
| **group** | granted **programmes** | the whole portfolio | projects in its granted programmes, in any site |
| **site** | granted **sites** | its own sites, plus every group-governed project (read-only) | site-governed projects in its granted sites |
| **viewer** | granted programmes or sites; ungranted means portfolio-wide | what its grants allow | nothing, ever |

Three properties are load-bearing:

**Group level sees everything, writes narrowly.** Portfolio visibility is
the point of being at group level; the grant narrows *authority*, not
sight. A grant list is never implicitly "all" — that is a property of the
`admin` role, never of a grant row (R1.3).

**A site sees group projects but cannot touch them.** A site lead has to
be able to see the group programmes landing on their people. They do not
get authority over them by being in their path.

**A viewer's refusal is categorical.** Not "no dangerous writes" — no
writes. `rbac.test.js` asserts this by iterating every action in
`ACTIONS` and requiring a refusal for each.

---

## 3 · Acts reserved to group level whatever the project

Some writes are group-level acts even on a site-governed project, because
of what they touch rather than whose project it is:

| Action | Why it is reserved |
|---|---|
| `project.baseline` | Re-baselining moves a date the group has committed to externally. |
| `cost.write` | The ledger reconciles to the group general ledger. A5's condition. |
| `contingency.release` | Contingency is group money held against a project. |
| `data.import` | Replacing the book is not a site-scale act. |

And two reserved to `admin` alone: `user.manage`, `settings.write`.
Thresholds and RAG bands are portfolio policy; a programme manager who
could move the amber line could make their own programme green.

---

## 4 · Magnitude routes a change, not the org chart

A site lead may approve a small change on their own project. The same
lead may not approve a large one — not because of who they are, but
because of what it costs. `can(user, "change.approve", …)` takes the
change's cost and week deltas and the configured CCB thresholds, and
sends anything above them to group authority (R4.5).

This is why the change-approval check passes a resource object with the
*magnitude* in it, rather than just the project.

---

## 5 · How enforcement actually works

```
                        rbac.can(user, action, resource)
                                    ▲
              ┌─────────────────────┴─────────────────────┐
              │                                           │
   server route (authoritative)              browser (presentation only)
   refuses with 403 before                   decides whether to draw
   any write happens                         the control at all
```

The browser imports **the same module**, not a copy (`web/src/lib/permissions.js`
adapts the grant shape and re-exports). Sharing the file removes the
failure mode where the two drift and the interface offers a button the
server will refuse. It changes nothing about where authority is decided:
the server asks again, on every request, before it writes.

Three details that are easy to get wrong and are therefore tested:

1. **Out of scope reads as 404, not 403.** A 403 on a project you cannot
   see confirms it exists. Resolution and visibility are checked
   together, so the two failures are indistinguishable from outside.
2. **Scoping happens in the query, not in the view.** `projectScopeSql()`
   narrows the SQL; out-of-scope rows never enter the response object, so
   a view that forgot to filter cannot leak them.
3. **A grant is a row, not a branch.** Adding a site or a programme never
   requires a deploy.

---

## 6 · Seeded accounts

Passwords are set in `server/src/seed.js` and listed in the README.
**Change them before this instance carries anything real** (AMDEC C-04).

| Account | Level | Grants | Represents |
|---|---|---|---|
| `admin@meridian.example` | admin | — | the break-glass account |
| `r.kaur@meridian.example` | admin | — | A1, Group PMO Director |
| `e.lindqvist@meridian.example` | group | CBP, EIT | A2, a programme manager with two programmes |
| `p.marchetti@meridian.example` | group | DCH | a single-programme manager |
| `f.okonkwo@meridian.example` | group | DAI | — |
| `g.silva@meridian.example` | site | GRU | C1, a small site that leads one project and staffs many |
| `t.nakamura@meridian.example` | site | YYZ | A3, the site PM who lives in the tool |
| `y.tanaka@meridian.example` | site | SIN | — |
| `n.rahimi@meridian.example` | viewer | LIS | C2, the read-mostly majority |
| `q.mbeki@meridian.example` | viewer | GRU | C3, the meeting consumer |

Signing in as `g.silva` is the fastest way to see the model work: nine
projects visible, one writable, Administration absent from the navigation
entirely, and a plain sentence on every group project explaining why its
controls are not there.

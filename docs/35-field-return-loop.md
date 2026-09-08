# 35 · The field-return loop — how a programme files findings into Meridian, and gets an answer

*This page is the pattern. `docs/33` is the one round of it that has
actually been run, with RT365, in detail. This page is what a **second**
field repository needs, and nothing in the machinery knows the name of
either of them.*

---

## 1 · The round, in four movements

A **field repository** is a real programme's own repository — its RAID
log, its decisions, its assessment of the tools it uses, its integration
script. It is the only place where what a tool costs its users is
written honestly, because it is written for that programme and not for
the supplier.

1. **The field writes a register.** One JSON file per field repository in
   [`docs/requests/`](requests/), in the shape
   `meridian-request-register/1`, published as
   [`docs/requests/register.schema.json`](requests/register.schema.json).
   It says where the requests came from (repository, branch, commit, the
   documents read), who answers on Meridian's side, on which channel, and
   one object per request.
2. **The review reads every branch.** `npm run review:field` clones the
   field repository, reads **every branch** — the material is almost never
   on the default one — pulls out every line that names Meridian carrying
   an id of the vocabulary *that register declares*, and prints what the
   register does not yet carry. A request written over there cannot go
   unseen over here.
3. **The Product Owner triages.** Each new line becomes a request in the
   register with `status: open`, is decided in the open (delivered,
   deferred with a reason, or refused with a reason), and the decision is
   written in the decision log of `docs/33` §5. Nothing is decided by
   silence.
4. **Statuses and deliveries flow back.** When the work lands, the request
   gains its `version`, its `delivered` paths, and the `measure` — the test
   or the gate that proves the claim — and the answer is posted on the
   issue the requester opened. The field diffs the register against the
   `registerVersion` it last read, and answers: `accepted`, or an objection
   that puts the line back to `open`.

Movements 1 and 4 belong to the field; 2 and 3 belong to Meridian. Neither
side writes code for the other.

---

## 2 · The register, and its schema

`meridian-request-register/1` is defined by
[`docs/requests/register.schema.json`](requests/register.schema.json) —
JSON Schema 2020-12 — and every register in `docs/requests/` is held to it
by gate **F11** in `npm run audit`
([`scripts/audit/register-schema.mjs`](../scripts/audit/register-schema.mjs)).
The validator is a hundred lines in
[`scripts/lib/jsonschema.mjs`](../scripts/lib/jsonschema.mjs): the subset
of the standard this schema uses, and no runtime dependency for a
document nobody executes. A keyword it does not know is an error, never a
silent pass.

The shape, in one look:

| Where | What |
|---|---|
| `$schema` | `meridian-request-register/1` — a name, not a URL |
| `source` | `repository`, `branch`, `commit`, `documents`, `reviewedAt`, and optionally `remote` (a forge that is not GitHub) and `vocabulary` |
| `productOwner` | the `charter` that appoints whoever answers |
| `channel` | where a request is answered, and what the acceptance words mean |
| `registerVersion` | increases every round; the field diffs against the one it last read |
| `requests[]` | `id`, `origin[]`, `title`, `status`, `version`, `decidedOn`, `delivered[]`, `measure`, `remaining`, `issue`, `accepted`, `released`, `history[]` |

Additive properties are allowed everywhere, deliberately: RT365 carries
`priority` and proposes `effort`, and a field repository may carry columns
of its own. A reader that ignores them loses nothing — but a column with a
declared vocabulary (`priority`, `effort`, `status`) keeps it.

**`origin` is the join.** It holds the field's own ids — that is what makes
a request traceable back to the ledger row that raised it, and what stops
the review raising the same line twice.

---

## 3 · The id vocabulary is the field's, not ours

RT365's ledgers speak `M-nn` (assessment findings), `I-n` (improvements),
`O-nn` (RAID rows), `H-nn` (human acts), and `D-nnn` / `ADR-nnn` / `PR-nn`
for decisions and records. That is one programme's convention. Another
programme's is `ANV-nnn` and `RISK-nn`, and a third's is neither.

So the register declares it, under `source.vocabulary`:

```json
"vocabulary": {
  "request": ["ANV-\\d{3}", "RISK-\\d{2}"],
  "context": ["DEC-\\d{3}"],
  "note": "Anvil Works ledger ids."
}
```

`request` ids name something that should become a request here and are
counted as missing when the register does not carry them. `context` ids —
decisions, architecture records, pull requests — are listed for the reader
and never counted: they explain, they do not ask. The patterns are
ordinary regular expressions, unanchored; the review word-boundaries them.

The vocabulary can also be given on the command line, which is how a first
round is run before a register exists.

---

## 4 · Running the review

```bash
npm run review:field                                    # every register in docs/requests/
node scripts/field-review.mjs --register docs/requests/rt365.json
node scripts/field-review.mjs --register docs/requests/anvil.json \
     --repo anvil-works/anvil-field --remote https://forge.example/anvil.git \
     --vocabulary 'ANV-\d{3},RISK-\d{2}' --context 'DEC-\d{3}' --dir ~/.cache/field-review
node scripts/rt365-review.mjs                           # the RT365 round, under the name RT365 knows
```

Everything is configuration: the register path, the repository, its clone
URL, the vocabulary, the workspace. Nothing about a particular field
repository is compiled in. What the command prints, per register: every
branch and where it is; the register's size, version and the commit it was
read at; the ids that are missing; the context ids; **the files that
changed since the reviewed commit and name Meridian**, because a request
may carry no id at all; and whether the branch has moved since the register
was written.

Exit codes: `0` nothing new — a quiet round is a complete round, not a
missed one; `1` the register is behind the field; `2` the review could not
be done (repository unreachable, no vocabulary, a register that does not
match the published shape — refused *before* the clone, since a malformed
register would report absences that are really typing errors).

Two rules the script keeps, because a third party's names come through it:
branch and file names are passed to `git` as **arguments**, never through a
shell (a reviewer once named a file `x$(curl …|sh).md`), and without
`--dir` the clone goes to a fresh `mkdtemp` directory that is removed
afterwards — a guessable path in `/tmp` is one a stranger can create first.

---

## 5 · The three acceptance states (E-9)

The field measures the answer, not us. Three fields say where a line
stands, and they are independent:

| Field | Meaning |
|---|---|
| `status` | `open` → `partial` → `done` (or `refused`, with the reason in the decision log). `done` means: on the branch, with the test named in `measure`. |
| `accepted` | The **requester's** answer. |
| `released` | A version tag a third party can fetch carries the line. |

`accepted` is three-valued, and this is E-9, filed by RT365 against the
first version of this register:

- **`true`** — the requester said so, on the issue.
- **`false`** — the requester is in a position to answer and has not.
- **`null`** — the requester *cannot* answer yet: nothing is delivered to
  try, or they have told us they cannot judge the line until they adopt the
  feature.

Before E-9 every line read `false`, which made a silent user and a blocked
one identical to a Product Owner scanning the register — and they are
different problems: one needs chasing, the other needs the feature to be
adoptable. The schema enforces the half of it that is mechanical: a request
with `status: "open"` **must** carry `accepted: null`, because there is
nothing to accept. `channel.acceptance` carries the sentence for each state
so a reader of the data never has to guess.

---

## 6 · How a second field repository joins, in five steps

1. Copy an existing register (RT365's is the worked example), keep the
   `$schema` string, and write your `source` — repository, branch, commit,
   the documents you read, `remote` if your forge is not GitHub.
2. Declare your `source.vocabulary`.
3. Write one request per finding: `origin` = your own ledger ids, `title`,
   `status: "open"`, `accepted: null`, `released: false`, one `history` row.
4. Put the file in `docs/requests/<your-repository>.json`. `npm run audit`
   now holds it to the schema, and `npm run review:field` reviews it on the
   next round — no code was written for you, and none for us.
5. Open one issue per request on the answering repository, and answer on it
   when the line comes back `done`. That answer is the only thing that can
   set `accepted: true`.

The measure that this works is a test, not a promise:
`server/test/fieldreturn.test.js` builds a second field repository — its
own name, its own vocabulary, its material on a branch that is not the
default — files a register, and reviews it end to end through the same
command, without touching the network.

---

## 7 · What the loop does not do

- **It does not decide.** The review reports; the Product Owner decides in
  the open, with the alternatives refused written down (`docs/33` §5).
- **It does not accept on the requester's behalf.** `accepted: true` is
  written only when the requester says so. A supplier that marks its own
  work accepted has a marketing document, not a register.
- **It does not push a tag.** `released` waits on a maintainer; a session
  cannot push a tag ref (`docs/33` §4).
- **It reads text, not minds.** Ids are found by pattern; a request written
  without an id is caught only by the changed-file list, which is why that
  list is printed and why the round ends with someone reading.

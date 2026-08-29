# Design Review — "Instrument"

A second committee, convened 2026-08-28, to answer one question the build
committee never asked: **does this look like software a bank bought, or
software someone generated?**

The answer was no, and the reason turned out to be specific rather than
vague. What follows is the audit, the direction, and what changed.

---

## 1 · The committee

| # | Member | Standing | Mandate |
|---|--------|----------|---------|
| **D1** | **Head of Design, Group Digital** (chair) | 14 yrs, internal estate | Owns how the bank's own tools look. Veto on anything that reads as a vendor demo. |
| **D2** | **Design systems lead** | — | Owns tokens and their maintenance. Will not accept a redesign that has to be re-applied by hand across 2,000 lines of views. |
| **D3** | **Data-visualisation specialist** | — | Owns legibility of dense numeric tables. Only interested in whether the numbers read faster afterwards. |
| **D4** | **Accessibility lead** | WCAG 2.2 | Contrast, focus, colour-independence. Veto. |
| **D5** | **Brand** | — | "Does this look like us." |
| **B3** | **Z. Kowalski** — Engineering Manager *(carried over)* | — | Owns the cost of maintaining it. |
| **A3** | **T. Nakamura** — Site PM *(carried over)* | — | Lives in the tables all day. |
| **A5** | **V. Rossi** — Finance Business Partner *(carried over)* | — | Reads variances all day. |
| **C2** | **N. Rahimi** — Business Analyst *(carried over)* | — | The read-mostly majority. |

---

## 2 · The audit — why it looked generated

The committee's finding was not "it is ugly". The v4 system was internally
coherent and well made. It was **legible as output**, for five specific
reasons.

> **D5, opening:** "I can name the palette. Warm paper at `#f3f2f2`, a
> coral-rust accent at `#ec3013`, and a neutral ramp where every grey is
> warmer in red than in blue. That is not a generic AI look — that is a
> *particular* house palette, and anyone who has seen a model vendor's
> marketing in the last two years will place it inside a second. Whatever
> else we do, that has to go."

| # | Finding | Evidence | Severity |
|---|---------|----------|:--------:|
| **G-01** | **The palette was a recognisable AI-house palette.** Warm off-white ground, coral accent, warm-cast neutral ramp. | `--color-bg:#f3f2f2`, `--color-accent:#ec3013`, neutrals `#605d5d`/`#444141` (R > G = B). | **High** |
| **G-02** | **Neo-brutalist chrome as a substitute for design.** Every control was a 2px black box at zero radius. | 35 × `2px solid`, `--radius-md:0px`. | **High** |
| **G-03** | **One typeface shouting.** Archivo at weight 800 for headings, KPIs, buttons, avatars, table footers — display and body identical. | `--font-heading` = `--font-body`; `font-weight:800` throughout. | **High** |
| **G-04** | **Editorial kickers pasted onto an operations tool.** Uppercase at `.14em` tracking on every card, field and section. | 8 × `text-transform:uppercase` at `.12`–`.14em`. | Medium |
| **G-05** | **Status and interaction were the same colour.** A red project, an overdue action, a negative variance and a clickable link were all `--color-accent`. | ~20 uses of `--color-accent-700` to mean "adverse". | **High** |
| **G-06** | **Warm greys behind dense numerals.** | Whole ramp. | Medium |
| **G-07** | **No dark mode**, in a tool people sit in for eight hours. | — | Medium |

> **D3:** "G-05 is the one that actually costs money. If red means both
> 'this project is failing' and 'you can click this', the eye cannot
> triage. Every other finding is taste. That one is a defect."
>
> **A5:** "Agreed, and add G-06. I read variance columns all day. Warm grey
> behind tabular figures is muddy — the numbers do not sit forward."
>
> **B3:** "Whatever you choose, it has to be a token change. If the answer
> is 'restyle two thousand lines of views', the answer is no."
>
> *(Audit found the views to be 96% token-driven — 15 hardcoded values in
> ~2,100 lines. B3's condition was satisfiable.)*

---

## 3 · Direction

### Aesthetic name — **Instrument**

Control-room / financial-terminal precision. The reference class is not
"enterprise SaaS"; it is the trading desk, the audit ledger, the
instrument panel. Dense, cool, authoritative, tabular.

**Dominant tone:** Industrial / utilitarian, with a single restrained
editorial move (the mono readout). Two directions, not more.

### The thesis, in one line

> **The only saturated colour on the screen means something.**

Chrome recedes to cool graphite hairlines. Blue marks what you can *act*
on. Red, amber and green are reserved for *status* and never decorate.
Nothing else is saturated at all.

### Differentiation anchor

> *If this were screenshotted with the logo removed, how would someone
> recognise it?*

**Every number in the system is monospaced.** SPI, CPI, currency, dates,
identifiers, percentages, the axis of the Gantt, the audit timestamps —
all IBM Plex Mono, all tabular, all aligning on the glyph down a column.
A portfolio screen reads as a *readout*, not a report. That is both the
memorable element and a functional one: it is why the variance column
scans in one pass.

The second anchor is the **status spine** — a 2px signal-coloured rule
down the left edge of anything whose health matters, so the eye can scan
one vertical line instead of reading twelve rows.

### DFII

| Dimension | Score | Reasoning |
|---|:---:|---|
| Aesthetic Impact | **4** | Distinctive without being loud. The mono readout is the memorable move; it does not shout. |
| Context Fit | **5** | A bank's IT-PMO is an instrument. This is what instruments look like. |
| Implementation Feasibility | **5** | Views proved 96% token-driven; the redesign is a token swap plus ~30 targeted rules. |
| Performance Safety | **5** | Two font families from one superfamily, one stylesheet, no JS, no images. CSS grew 21.5 → 28.4 KB (6.1 KB gzipped). |
| Consistency Risk | **−2** | Centralised tokens and semantic utility classes (`.bad` / `.warn` / `.good`) make drift hard. |
| **DFII** | **17 → capped 15** | **Excellent — execute fully.** |

---

## 4 · Design system snapshot

### Typography

| Role | Face | Why |
|---|---|---|
| Interface & language | **IBM Plex Sans** 400/500/600 | Drawn for technical and institutional work. Not Inter, not Roboto, not a system stack. Reads as engineering, not marketing. |
| Every number, ID and date | **IBM Plex Mono** 400/500/600 | The anchor. One superfamily, so the pairing is cohesive by construction rather than by luck. |

Weight 800 is gone. Nothing exceeds 600. Headings dropped 28 → 22px; the
hierarchy is carried by scale, colour and rhythm instead of by shouting.

`.kicker` was retuned rather than removed: from a `.14em` magazine kicker
to a `.02em` mono field label. Same markup, opposite register.

### Colour

```
ground     #fbfcfd  bg      #f2f5f8  surface   #0f1620  text     (cool, blue-cast)
accent     #1b4f8f  interaction only — links, focus, primary, selection
signal     #b42318  red     #b54708  amber     #067647  green    (status only)
dark       #0e131a  bg      #161d27  surface   #e3e9f0  text
```

One dominant tone (graphite), one accent (institutional blue), one
semantic system (RAG). Deliberately unbalanced: the palette is ~95%
neutral by area.

### Space & form

Hairlines at 1px, not slabs at 2px. Radii at 2/3/4px — zero is a
statement, eight is a consumer app, three is a tool. Row heights and
section padding tightened ~10%. Shadows are cool-tinted, tight, and only
ever mean elevation.

### Motion

Two entrances (dialog, toast) at 160–180ms, and hover transitions at
120ms on interactive surfaces. Nothing else moves.
`prefers-reduced-motion` disables all of it.

---

## 5 · What changed

| Finding | Fix |
|---|---|
| G-01 | Whole palette replaced: cool graphite ground, institutional blue accent, dedicated signal ramp. |
| G-02 | 35 × `2px solid` → 1px hairlines. Radii 0 → 2/3/4px. Buttons went from heavy black boxes to a quiet surface + hairline, with weight spent only on the primary. |
| G-03 | Archivo → IBM Plex Sans + IBM Plex Mono. Max weight 600. Headings down a step. |
| G-04 | `.kicker` retuned to a mono field label at `.02em`. |
| G-05 | **~20 adverse figures moved off the accent onto the signal ramp.** New `.bad` / `.warn` / `.good` / `.banner-warn` utilities. The RAG dot is now a filled circle in true red/amber/green, with the word beside it. |
| G-06 | Cool slate neutral ramp throughout. |
| G-07 | Full dark theme, plus a three-state control in the sidebar: follow the system, force light, force dark — persisted per browser. |

### Accessibility (D4's veto condition)

Measured in the running application, both themes, WCAG AA (4.5:1):

| Pair | Light | Dark |
|---|---:|---:|
| Body text on ground | 17.69 | 15.25 |
| Body text on surface | 16.60 | 13.86 |
| Accent link on ground | 7.98 | 6.84 |
| Text on accent fill | 8.20 | 7.01 |
| Signal red on ground | 6.40 | 8.14 |
| Signal amber on ground | 5.28 | 10.27 |
| Signal green on ground | 5.54 | 10.00 |
| Signal red on surface | 6.01 | 7.40 |
| Text on red fill | 6.57 | 8.34 |

**All pass, all in both themes.** Status is never encoded by hue alone —
every RAG dot carries its word, and every signal band carries a left
rule as well as a tint. Focus is a 2px accent ring at 2px offset, never
removed.

---

## 6 · Differentiation callout

> **This avoids generic UI by making every number monospaced and reserving
> all saturation for meaning — instead of reaching for a warm paper
> ground, a coral accent, 2px black boxes at zero radius, and one
> typeface at weight 800, which is what the previous version did and what
> a great many generated interfaces do.**

Three concrete substitutions:

1. **Instead of** status and interaction sharing one accent, **it uses**
   a blue that only ever means "actionable" and a RAG ramp that only ever
   means "state" — so a red figure is unambiguously a problem, not a link.
2. **Instead of** a neo-brutalist 2px outline on every control, **it uses**
   1px hairlines and a single filled primary — density through restraint,
   with weight spent once per screen.
3. **Instead of** an editorial kicker at `.14em` on every card, **it uses**
   a mono field label at `.02em` — the register of an instrument panel,
   not a magazine.

---

## 7 · Verification

- Full test suite after redesign: **116 / 116**, 0 failures.
- Client build: clean. CSS 28.4 KB (6.1 KB gzipped), JS unchanged.
- All 13 screens render without error in **both themes**, checked in the
  browser.
- No stale palette values remain: 0 references to `#ec3013`, `#f3f2f2`,
  `Archivo`, or `--color-accent-700`-as-adverse anywhere in the views.
- KPI strip reflows rather than crushing: 6 readouts on one row at
  ≥1400px, wrapping cleanly below that; numbers never break across lines.

## 8 · Accepted, not done

- **The Gantt bar palette is graphite with a red critical underline.** It
  works, but D3 wants a second pass on the bar states (planned / in
  progress / done / behind) once there is real usage data on which state
  people look for first.
- **No high-contrast (forced-colors) mode.** Everything is token-driven,
  so it is a small addition; nobody has asked for it yet.
- **Icons are still Lucide paths at 1.5–2px stroke.** Coherent with the
  hairlines, but not bespoke. A custom set is a nice-to-have, not a gap.

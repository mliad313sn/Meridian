> English translation of [`docs/17-instructions-reserves.md`](../17-instructions-reserves.md). The French original is the authoritative record; where they differ, the French governs.

# Executable instructions for the committee's reserves

> **Campaign completed on 29/08/2026.** The fifteen reserves are
> **closed** with dated measurements (see the end of
> [`16-comite-independant.md`](../16-comite-independant.md)), the
> re-test loop exited on two consecutive compliant rounds, and the FMEA
> acceptance is **pronounced**
> ([`18-amdec-recette.md`](../18-amdec-recette.md)). This document
> remains the reference for the commands, now replayable as regression
> tests.

The fifteen reserves in
[`16-comite-independant.md`](../16-comite-independant.md) are addressed
by five commands placed in `.claude/commands/`. Each one carries the
**original measurement** made by the committee and the **closing
measurement** expected: a reserve whose measurement cannot be redone is
not closed.

| Command | Reserves | What it requires |
|---|---|---|
| `/preuve` | **R-01** *(blocking)* | An approved document points to an openable artefact — verified link or uploaded file. Milestone locking stops counting empty evidence. |
| `/rotation` | R-02, R-11 | Absences, bounded deputisation that never widens authority, a digest that genuinely covers the time spent away, notifications in French and according to preferences. |
| `/acces` | R-04, R-05, R-06 | A real focus trap, targets ≥ 24 px, a `lang` that follows the interface, one `h1` per view. |
| `/terrain` | R-07, R-08 | Progressive forms, grouped navigation, an end to full reloads after every write, initial load under 40 KB. |
| `/adoption` | R-03, R-09, R-10, R-12, R-13, R-14 | Real effort capture, CSV import with preview, ICS export, restore from the audit trail, document lineage, traceability of sensitive consultations. |
| `/reserves` | *all* | The simple driver: takes the most severe unclosed reserve, or chains through them. |
| `/goal-reserves` | *all* | **The campaign orchestrator**: the five phases in the committee's order with a `verify` + `sweep` gate between each, then a re-test loop that replays all original measurements until **two consecutive compliant rounds**, then the **final FMEA acceptance** (S × O × D residual across the 15 reserves and the 4 strengths, verdict in `docs/18-amdec-recette.md`, repackaging of the service if acceptance is pronounced). |

## Recommended order

The order is non-negotiable on the first two points, for reasons the
committee has spelled out:

1. **`/preuve`** — as long as R-01 holds, the committee does not
   recommend Meridian as a source of assurance evidence. Everything
   else is comfort by comparison.
2. **`/acces` then `/rotation`** — before any handover to
   French-speaking sites. R-04, R-05 and R-06 currently exclude part of
   the users; R-02 stops the flows from the very first rotation.
3. **`/terrain`** — decides whether the site lead keeps entering data.
   Without it, value, published periods and the roadmap become wrong
   without warning.
4. **`/adoption`** — what is missing for the tool to replace what
   already exists rather than being added on top of it.

## To launch the full campaign

```
/goal-reserves
```

Picks up wherever the campaign stands (the state lives in `docs/16`: a
reserve is either CLOSED with its measurement, or it is not), chains
through the phases, loops the re-test, and only declares itself finished
once the FMEA acceptance is pronounced. `/reserves campagne` remains
available as a simple driver, without the loop or the acceptance.

## What these instructions do not do

They do not reopen the design. The four strengths the committee
explicitly asked to be preserved — enforced independence, tamper-proof
audit trail, group ↔ site rhythm as data, frozen closed period — are
restated as non-negotiable constraints in `/reserves` and must not be
relaxed by any usability or performance fix.

Two reserves presuppose a decision that does not belong to engineering:
the choice between **verified link** and **file upload** for R-01
belongs to the sponsor and the group IT department; the scope of
consultation logging (R-14) belongs to compliance.

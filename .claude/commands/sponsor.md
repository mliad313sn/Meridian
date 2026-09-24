---
description: Convene the Sponsor seat (an agent distinct from the Product Owner) to sign or refuse product decisions, set priorities, or judge product-side release readiness. Never legal matters.
argument-hint: "<what to put to the Sponsor>  ·  omit for a review of the open sponsor decisions in docs/36 §5"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

Convene the `sponsor` agent (`.claude/agents/sponsor.md`) with:

$ARGUMENTS

If empty, put to it every open or delegated line of `docs/36` §5
(D-36.S*) and ask for a verdict on each.

The PO then records each verdict in `docs/36` §5, attributed to
"Sponsor (seat created 24/09/2026)". A verdict marked "outside this
seat" goes back to the owner unchanged. The PO never rewrites the
Sponsor's verdict. When it disagrees, it records both positions.

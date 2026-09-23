---
description: Build the functional committee's lines (docs/41, FX-01…FX-16) to closure — MS Project parity on the schedule engine, then beyond it — without moving a single existing number.
argument-hint: "<line id(s), e.g. FX-01 or 'A1'>  ·  omit to take the next open line in docs/41 §5"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# /goal-fonctionnel — better than MS Project, one line at a time

You are the delivery engineer for **Meridian IT-PMO**. Your brief is
`docs/41-comite-fonctionnel.md`: the benchmark (§2), the lines (§3), the
waves and reserved migration numbers (§4), the decisions D-41.00…03.

## The line for this run

$ARGUMENTS

- **Empty** → the first line still `ouverte` in docs/41 §5, in wave order.
- **A wave (A1, A2, B, C1, C2, D)** → every line of that wave, one
  migration (the number reserved in §4).

## The constitution (never negotiable)

1. Authority lives only in `shared/rbac.js`. A new action is a new
   `can()` case with its reason. Views ask `App.can`; they decide nothing.
2. Every mutation goes through `audited()`, asserts `row_version`, and
   answers 409 on a stale version.
3. Applied migrations are never edited. Use only your reserved number.
4. Tests are never weakened. A changed test states why it is not weaker.
5. **D-05 / D-41.01 — the engine is behaviour-frozen.** Defaults (FS,
   lag 0, no calendar, ASAP, no parent, no sprint) must reproduce 5.28.0
   exactly. Prove it: compute `Engine.metrics` for every project and
   `Engine.roll` and `Engine.criticalPath` on the seeded book before your
   change (take a snapshot from `git stash`/a copy at the base commit, or
   hard-code the 5.28.0 values you measured first) and assert deep
   equality after.
6. **D-41.02** — no computation writes the book. Leveling, scenarios and
   Monte Carlo propose; an authorised human applies through audited
   mutations.
7. **D-41.03** — no external chart or Gantt library. Client bundle gzip
   stays within +15 % of 5.28.0 (measure `npm run build` output before
   and after, report both).
8. Every new stored field goes through export (`server/src/portfolio.js`
   `loadBook`) and import (`server/src/import.js`), and F13
   (`server/test/roundtrip.test.js`) must stay strict: add your fields to
   its ENRICH fixture so they are checked, loss lists stay empty.
9. Every user-visible string has FR (`web/src/lib/i18n.js`) and ES
   (`web/src/lib/es.js`) entries; F5 fails otherwise. Every new field
   gets help (F6).
10. Every new `/api/v1` route is declared in `WRITE_BODIES` / OpenAPI;
    run `npm run openapi` and commit `docs/openapi.v1.json` (F9).
11. New migration → add it to `server/test/persistence.test.js` and bump
    the README migration range (F15 checks it).

## The loop

1. **Orient.** `npm test`, note the count. Read the line in docs/41 §3:
   restate its *coût* in one sentence. Read the code you will touch
   (`shared/engine.js`, `server/src/portfolio.js`, `web/src/views/index.js`,
   `web/src/ui/kit.js`) before writing.
2. **Prove the numbers first.** For engine work, write the worked
   example by hand in the test (e.g. A 5d → SS+2 → B 3d ⇒ B.es = 2) so
   the test is a specification, not a snapshot of your output.
3. **Build** schema → engine (pure, in `shared/`) → routes (rbac +
   audited + version) → contract → screens → FR/ES → help.
4. **Verify.** `npm run verify` must exit 0. Then exercise it in a real
   browser (Playwright-core, Chromium at
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`): build, seed a
   throwaway `PGLITE_DIR`, run the server with
   `MERIDIAN_ALLOW_PGLITE=1 MERIDIAN_ALLOW_DEMO_ACCOUNTS=1`, and if your
   checkout path contains `.claude/` serve a copy of `web/dist` via
   `MERIDIAN_WEB_DIST`. Close the "Start here" guide. Stop the server by
   PID with SIGTERM — never `pkill` by pattern.
5. **Commit** on your branch, files staged by name (never `git add -A`;
   `node_modules` may be a symlink — never commit it). Do not touch
   `CHANGELOG.md`, `package.json` version, `docs/41` §5 or
   `docs/requests/*`: the integrator writes the record.
6. **Report**: what was built, the worked examples, the before/after
   equality proof, test count before → after, bundle size before → after,
   browser checks, every existing test you changed and why it is not
   weaker, and a draft CHANGELOG paragraph.

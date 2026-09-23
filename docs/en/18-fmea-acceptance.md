> English translation of [`docs/18-amdec-recette.md`](../18-amdec-recette.md). The French original is the authoritative record; where they differ, the French governs.

# Final FMEA acceptance — Meridian IT-PMO

Date: 29 August 2026 · Final act of the `/goal-reserves` campaign
(step C), after closing the fifteen reserves of the independent
committee ([16-comite-independant.md](../16-comite-independant.md)) and
closing the re-test loop (two consecutive fully compliant rounds).

## Method

Each closed reserve is re-examined as a **residual failure mode**: what
could still fail *after* the fix, in real operation? Three scores from 1
to 10:

- **S** — severity if the failure occurs;
- **O** — occurrence: probability that it occurs, safeguards included;
- **D** — detection: 1 = detected immediately by an automatic gate, 10 =
  invisible until the harm is done.

**RPN = S × O × D.** Acceptance gates, agreed before scoring: no RPN ≥
100, no mode with S ≥ 9 **and** D ≥ 7. The O and D scores are based on
the measurements of the last round (round 3), not on intent.

## The fifteen residual failure modes

| Reserve | Residual failure mode | S | O | D | RPN | What holds it |
|---|---|--:|--:|--:|--:|---|
| R-01 evidence | A deployment leaves `documentHosts` misconfigured and approvals stop (closed by default) — or the trusted host serves dead links | 8 | 2 | 2 | **32** | Closed by default *and says so*; 400 refusal tested at all three levels on every round; fingerprint frozen + fallback to review on link change |
| R-02 rotation | An absence is not declared and there is no deputy that day | 6 | 3 | 3 | **54** | Declarable by the site itself; the return digest (16 days measured) catches up on what happened; audit "X (for Y)" |
| R-03 actuals | The captured actuals are wrong or incomplete (deliberate human entry) | 5 | 3 | 3 | **45** | One row per person-week, replacement with no duplication, 0–7 day bound, displayed NEXT TO the plan — the gap is visible |
| R-04 keyboard | A new dialog box escapes the focus trap | 6 | 2 | 2 | **24** | Trap set once in `dialog()` (not per box); round 2 and 3 measurements: 0 reachable behind, focus returned |
| R-05 touch | A new control falls back under 24 px | 5 | 2 | 3 | **30** | Sizes carried by the kit's classes, not per view; 0 across 4 pages at 375 px, two rounds |
| R-06 semantics | The single h1 or `lang` regresses on a new view | 4 | 2 | 2 | **16** | h1 set by the shell (`main.js`), not per view; `setLang` stamps `documentElement` |
| R-07 density | A new form arrives with no collapse and becomes a wall again | 4 | 3 | 3 | **36** | `advanced:` lives in `form()` — collapse is the kit's default; benefit 5/11 fields measured over two rounds |
| R-08 network | A new write reloads the whole book out of convenience | 6 | 3 | 2 | **36** | `TOUCH_BY_LABEL` centralised; network trace measured: POST + `collections?keys=`; server gzip (90 → 15.9 KB) |
| R-09 onboarding | An onboarding file passes the preview but betrays the business meaning (right columns, wrong content) | 5 | 3 | 2 | **30** | 422 transactional all-or-nothing; row-by-row refusals with reasons; reported on the trail; the preview writes nothing |
| R-10 calendar | An enterprise calendar rejects the produced ICS | 3 | 2 | 2 | **12** | Baseline-format VEVENT/RRULE, tested; failure visible to the user immediately |
| R-11 language/notif | The real SMTP relay is not wired up (sponsor parameter) | 5 | 3 | 2 | **30** | Full, tested `notify_queue`; "not configured" and says so; **written acceptance no. 1** |
| R-12 undelete | A restore recreates a row whose context has changed since | 5 | 2 | 2 | **20** | Restore is a logged ADD, refused over an existing row (409), children not resurrected *and it says so*; admin only |
| R-13 lineage | A revision is created and then forgotten in review, with the old one remaining the "evidence" | 4 | 3 | 2 | **24** | The new revision is approved by no one (fingerprint reset); `supersedes` visible in the library |
| R-14 consultations | A new sensitive surface arrives with no consultation trace | 5 | 3 | 3 | **45** | Four surfaces covered; the call (`noteConsultation`) is one line — code review requires it on every export surface |
| R-15 French | A new `t()` label arrives with no dictionary entry | 4 | 2 | 1 | **8** | **The build fails** (gate F5, probe added after the round-1 deviation) — detected before delivery, hence D = 1 |

No RPN reaches 100. The highest — R-02, 54 — is a *human-procedure*
failure (not declaring the absence), mitigated by the return digest; the
tool cannot declare the absence in the site's place.

## The four strengths, not regressed

What earlier committees had praised had to come out of the campaign
intact. Verified in the last round:

| Strength | Non-regression evidence (round 3) |
|---|---|
| The access model is stricter than a naive reading | sweep: 286 cases × 4 roles, **0 5xx errors, 0 real deviation** (12 ⚠ = documented mistaken expectations) |
| The audit trail is transactional, append-only, with before/after images | crud-audit and version-audit gates green; deletions carry the entire row; the restore itself is logged |
| The engine (EVM, milestones, windows) is frozen and honest | 271/271 tests, unchanged behaviour — evidence was added *around* (`Engine.isEvidence`), not inside |
| "A command an account cannot use is not rendered" | 72 view renders: 0 write command offered to a reader; out-of-scope refusal in French |

## Written acceptances — expectations placed on the sponsor's parameters

Three items cannot be supplied by the team: they are secrets or
infrastructure choices belonging to the sponsor. For each, the behaviour
**in their absence** is tested and honest — the application says what
is not configured instead of simulating it.

1. **SMTP relay** (`MERIDIAN_SMTP_URL`) — the notification queue works,
   drains and reads from the administration screen; nothing goes out
   until the relay is supplied. *Accepted as is.*
2. **Entra ID tenant** (`MERIDIAN_OIDC_TENANT`, `_CLIENT_ID`,
   `_CLIENT_SECRET`, `_REDIRECT`) — the SSO entry point only appears
   once configured; local accounts hold the line in the meantime.
   *Accepted as is.*
3. **Trusted document hosts** (`documentHosts`) — closed by default:
   empty list = no approval possible, while stating the parameter to
   set. To be filled in with the group's real document-management
   domains at first startup. *Accepted as is.*

No other acceptance is requested.

## Verdict

Gates held: maximum RPN **54** (threshold 100); no mode with S ≥ 9; no
detection beyond D = 3. The fifteen reserves are closed with dated
measurements, the re-test loop exited on two compliant rounds, the four
strengths are intact.

**ACCEPTANCE PRONOUNCED**, subject to the three written acceptances
above.

Immediate next step: repackaging the installer and reinstalling the
Windows service on the campaign's binary (migrations 001–016), health
and real login verified.

## Deployment — execution record

Repackaged on 29/08/2026: `MeridianSetup.exe` 32.9 MB (SEA 89 MB,
migrations 001–016, client rebuilt). Reinstalled using the proven
method — silent extraction to a working folder, then `setup.cmd /quiet`
with elevation. Findings after the `MeridianITPMO` service restarted:

- `/api/health` → `{"ok":true,"engine":"postgres"}`;
- migrations `014_evidence`, `015_rotation`, `016_timesheet` applied to
  `meridian_standalone` (absences and timesheets served at bootstrap);
- real login by the administrator account verified (mandatory password
  change still intact).

Note for the operator: running `MeridianSetup.exe` with the
silent-extraction option alone does NOT deploy it (the extracted copy
does not elevate itself) — go through elevated `setup.cmd /quiet` as
above, or an interactive double-click that accepts the UAC prompt.

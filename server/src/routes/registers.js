/**
 * KODO's registers, written from a session  (docs/36 NEW-04).
 *
 * Migrations 051 and 052 landed requirements, evidence, findings, seats
 * (with their incompatibilities) and decision objections as data: the
 * import wrote them, the engine reasoned with them — a veto blocked a
 * gate, a severe finding reached the attention list — and nobody could
 * raise, correct or close one from the product. KODO's own report said
 * so (report:39-43), and five MER lines stayed `partial` on it.
 *
 * The pattern is portfolio.js's, everywhere: resolve the row → ask
 * shared/rbac.js → mutate inside audited(), asserting row_version on
 * every update → answer the new version. The rules KODO asked for are
 * the database's (051, 052, 055); this file refuses first only where it
 * can say more than the constraint would:
 *
 *   · a finding closes ONLY on evidence — of this project, captured on
 *     or after the day the finding was raised (a re-test, not the fix);
 *   · a waiver — of a requirement or a finding — carries its reason, and
 *     is granted at group level (`waiver.grant`);
 *   · a person never holds two incompatible seats — the trigger refuses,
 *     and pgerror.js turns its sentence into a 400 instead of a 500;
 *   · an objection has a reason, an escalation date, and a resolution
 *     when it is resolved.
 */

import { Router } from "express";
import { one, allocateId, updateVersioned, requiredVersion } from "../db.js";
import { can, canSeeProject } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { projectFor } from "../portfolio.js";
import { isEvidenceLocator, EVIDENCE_REFUSAL } from "../evidence.js";
import { D, iso, addDays } from "../../../shared/engine.js";

const r = Router();

/* ── helpers (portfolio.js's, which it does not export) ───────────── */

const bad = (msg) => { throw new HttpError(400, msg); };
function gate(user, action, resource) {
  const v = can(user, action, resource);
  if (!v.ok) throw new HttpError(403, v.why);
}
/* Out of scope answers exactly as absent does (B2): 404, never 403. */
async function project(id, user) {
  const p = id ? await projectFor(String(id)) : null;
  if (!p || !canSeeProject(user, p)) throw new HttpError(404, "No such project");
  return p;
}
function conflict(result) {
  if (!result.ok) throw new HttpError(409, "Someone else changed this record — reload and try again");
  return result;
}
const text = (v, max) => String(v ?? "").trim().slice(0, max);
function isoDay(v, what) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(D(s).getTime())) {
    bad(`${what} must be an ISO date (YYYY-MM-DD)`);
  }
  return s;
}
const today = () => new Date().toISOString().slice(0, 10);
function gateNo(v, what = "gate") {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) bad(`The ${what} is a whole number from 1 — the rank of a gate in the ladder`);
  return n;
}
function loopNo(v) {
  if (v === undefined || v === null || v === "") return 1;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) bad("The loop is a whole number from 1 — the pass of the gate cycle");
  return n;
}
async function person(v, what) {
  if (v === undefined || v === null || v === "") return null;
  const who = await one(`SELECT id FROM person WHERE id = $1`, [String(v)]);
  if (!who) bad(`${what} must be a person in the directory`);
  return who.id;
}
/* Imported ids (REQ-901, EV-1, SE-13…) share the space the counter
   allocates in, so an allocated id is checked before it is used. */
async function freshId(t, prefix, table) {
  for (let i = 0; i < 100; i++) {
    const id = await allocateId(t, prefix);
    const taken = await t.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    if (!(taken.rows ?? []).length) return id;
  }
  throw new HttpError(409, "Could not allocate an identifier — try again");
}
async function row(table, id, what) {
  const x = await one(`SELECT * FROM ${table} WHERE id = $1`, [String(id)]);
  if (!x) throw new HttpError(404, `No such ${what}`);
  return x;
}

/* ════════════════════════════════════════════════════════════════════
   MER-03 · requirements
   ════════════════════════════════════════════════════════════════════ */

const PRIORITIES = ["M", "S", "C", "W"];
const REQ_STATUS = ["Not started", "In progress", "Done", "Waived"];
const DONE_NEEDS_PROOF =
  "A requirement is Done when its proof is named — fill « Verified by » (the test, run or report), not only the method";

r.post("/requirements", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "assurance.write", { project: p });
    const statement = text(b.statement, 2000);
    if (!statement) bad("A requirement states what must hold — the statement is empty");
    if (b.priority !== undefined && !PRIORITIES.includes(b.priority)) bad("priority is M, S, C or W (MoSCoW)");
    /* A requirement is born to be met. Waiving it is a later act, with
       its own authority and its own reason — never how it enters. */
    const status = b.status ?? "Not started";
    if (!REQ_STATUS.includes(status) || status === "Waived") bad("A requirement starts Not started, In progress or Done — waiving is a separate act");
    if (status === "Done" && !text(b.verifiedBy, 500)) bad(DONE_NEEDS_PROOF);
    const owner = await person(b.owner, "The owner");
    const gateN = gateNo(b.gate);
    let id = null;
    await audited(req.user,
      () => ({ action: "Requirement stated", entity: "requirement", entityId: id, detail: statement.slice(0, 200) }),
      async (t) => {
        id = b.id && /^[\w.-]{1,40}$/.test(b.id) ? String(b.id) : await freshId(t, "REQ", "requirement");
        await t.query(
          `INSERT INTO requirement (id, project_id, statement, source, priority, verification,
                                   verified_by, gate_n, status, owner_id, updated_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, p.id, statement, text(b.source, 300), b.priority ?? "M",
           text(b.verification, 500), text(b.verifiedBy, 500), gateN, status, owner, today()]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/requirements/:id", async (req, res, next) => {
  try {
    const x = await row("requirement", req.params.id, "requirement");
    const p = await project(x.project_id, req.user);
    gate(req.user, "assurance.write", { project: p });
    const b = req.body ?? {};
    const patch = {};
    if (b.statement !== undefined) {
      patch.statement = text(b.statement, 2000);
      if (!patch.statement) bad("A requirement states what must hold — the statement is empty");
    }
    if (b.source !== undefined) patch.source = text(b.source, 300);
    if (b.priority !== undefined) {
      if (!PRIORITIES.includes(b.priority)) bad("priority is M, S, C or W (MoSCoW)");
      patch.priority = b.priority;
    }
    /* The method promised and the proof produced stay two fields (051):
       writing how it WILL be verified never marks it verified. */
    if (b.verification !== undefined) patch.verification = text(b.verification, 500);
    if (b.verifiedBy !== undefined) patch.verified_by = text(b.verifiedBy, 500);
    if (b.gate !== undefined) patch.gate_n = gateNo(b.gate);
    if (b.owner !== undefined) patch.owner_id = await person(b.owner, "The owner");
    if (b.waiverReason !== undefined) patch.waiver_reason = text(b.waiverReason, 1000);
    if (b.status !== undefined) {
      if (!REQ_STATUS.includes(b.status)) bad("status is " + REQ_STATUS.join(", "));
      patch.status = b.status;
      /* Un-waiving clears the reason, so the next waiver has to say its own. */
      if (b.status !== "Waived" && x.status === "Waived" && b.waiverReason === undefined) patch.waiver_reason = "";
    }
    const status = patch.status ?? x.status;
    /* Waiving — lifting a waiver, or rewording the reason one stands on —
       is the waiver's authority, not the deliverer's. */
    const touchesWaiver =
      (patch.status !== undefined && (patch.status === "Waived") !== (x.status === "Waived")) ||
      (status === "Waived" && patch.waiver_reason !== undefined && patch.waiver_reason !== x.waiver_reason);
    if (touchesWaiver) gate(req.user, "waiver.grant", { project: p });
    if (status === "Waived" && !String(patch.waiver_reason ?? x.waiver_reason ?? "").trim()) {
      bad("A waiver says why — a requirement waived without a reason disappears without anyone having decided it");
    }
    /* KODO's Definition of Done: « meets its numbered requirements, each
       verified by a named test ». Done names its proof; the method it was
       promised by is not that proof. */
    const aboutDone = (patch.status === "Done" && x.status !== "Done") || patch.verified_by !== undefined;
    if (status === "Done" && aboutDone && !String(patch.verified_by ?? x.verified_by ?? "").trim()) {
      bad(DONE_NEEDS_PROOF);
    }
    if (Object.keys(patch).length) patch.updated_on = today();
    const changedStatus = patch.status !== undefined && patch.status !== x.status;
    const out = await audited(req.user,
      { action: patch.status === "Waived" && changedStatus ? "Requirement waived" : "Requirement updated",
        entity: "requirement", entityId: x.id, detail: (patch.statement ?? x.statement).slice(0, 200),
        before: changedStatus ? { status: x.status, waiverReason: x.waiver_reason } : undefined,
        after: changedStatus ? { status: patch.status, waiverReason: patch.waiver_reason ?? x.waiver_reason } : undefined },
      async (t) => conflict(await updateVersioned(t, "requirement", x.id, requiredVersion(b, "requirement"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* A requirement stated in error is removed; the audit row keeps its
   whole before-image. A finding that cited it keeps its facts and loses
   only the link (ON DELETE SET NULL, 052). */
r.delete("/requirements/:id", async (req, res, next) => {
  try {
    const x = await row("requirement", req.params.id, "requirement");
    gate(req.user, "assurance.write", { project: await project(x.project_id, req.user) });
    await audited(req.user,
      { action: "Requirement removed", entity: "requirement", entityId: x.id,
        detail: x.statement.slice(0, 200), before: { ...x } },
      async (t) => t.query(`DELETE FROM requirement WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ════════════════════════════════════════════════════════════════════
   MER-11 · evidence, document or not
   ════════════════════════════════════════════════════════════════════ */

const EV_KINDS = ["document", "ci_run", "test_report", "measurement", "dataset", "recording", "sign_off", "external"];

async function evidenceSource(b, p, current = {}) {
  const out = {};
  if (b.document !== undefined) {
    if (b.document === null || b.document === "") out.document_id = null;
    else {
      const d = await one(`SELECT id, project_id FROM document WHERE id = $1`, [String(b.document)]);
      if (!d || (d.project_id && d.project_id !== p.id)) bad("That document is not in this project's register");
      out.document_id = d.id;
    }
  }
  if (b.uri !== undefined) {
    out.uri = text(b.uri, 1000);
    if (out.uri && !isEvidenceLocator(out.uri)) bad(EVIDENCE_REFUSAL);
  }
  const doc = out.document_id !== undefined ? out.document_id : current.document_id ?? null;
  const uri = out.uri !== undefined ? out.uri : current.uri ?? "";
  if (!doc && !uri) bad("Evidence points at a document of the register or carries its own address — a proof with neither is an assertion");
  return out;
}
/* Evidence a closed finding rests on is the proof of that closure. It is
   not edited underneath it: a new piece is captured and the finding is
   re-closed on it, so the record keeps saying what the closure rested on
   at the time. */
async function assertNotRelied(id, verb) {
  const f = await one(`SELECT id FROM finding WHERE closed_evidence_id = $1 LIMIT 1`, [id]);
  if (f) {
    throw new HttpError(409,
      `Finding ${f.id} was closed on this evidence, so it cannot be ${verb}. ` +
      "Capture the new evidence as its own piece, then reopen the finding and close it on that.");
  }
}

r.post("/evidence", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "assurance.write", { project: p });
    const name = text(b.name, 300);
    if (!name) bad("Evidence is named — what a reader will look for");
    if (b.kind !== undefined && !EV_KINDS.includes(b.kind)) bad("kind is " + EV_KINDS.join(", "));
    const src = await evidenceSource({ document: b.document ?? null, uri: b.uri ?? "" }, p);
    const capturedOn = isoDay(b.capturedOn, "capturedOn") ?? today();
    const capturedBy = b.capturedBy === undefined || b.capturedBy === ""
      ? req.user.personId ?? null : await person(b.capturedBy, "Captured by");
    let id = null;
    await audited(req.user,
      () => ({ action: "Evidence captured", entity: "evidence", entityId: id, detail: name }),
      async (t) => {
        id = await freshId(t, "EV", "evidence");
        await t.query(
          `INSERT INTO evidence (id, project_id, document_id, kind, name, uri, digest, gate_n,
                                gate_loop, captured_on, captured_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [id, p.id, src.document_id ?? null, b.kind ?? (src.document_id ? "document" : "external"),
           name, src.uri ?? "", text(b.digest, 200), gateNo(b.gate), loopNo(b.loop), capturedOn, capturedBy]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/evidence/:id", async (req, res, next) => {
  try {
    const x = await row("evidence", req.params.id, "piece of evidence");
    const p = await project(x.project_id, req.user);
    gate(req.user, "assurance.write", { project: p });
    await assertNotRelied(x.id, "changed");
    const b = req.body ?? {};
    const patch = { ...(await evidenceSource(b, p, x)) };
    if (b.name !== undefined) { patch.name = text(b.name, 300); if (!patch.name) bad("Evidence is named — what a reader will look for"); }
    if (b.kind !== undefined) { if (!EV_KINDS.includes(b.kind)) bad("kind is " + EV_KINDS.join(", ")); patch.kind = b.kind; }
    if (b.digest !== undefined) patch.digest = text(b.digest, 200);
    if (b.gate !== undefined) patch.gate_n = gateNo(b.gate);
    if (b.loop !== undefined) patch.gate_loop = loopNo(b.loop);
    if (b.capturedOn !== undefined) patch.captured_on = isoDay(b.capturedOn, "capturedOn") ?? x.captured_on;
    if (b.capturedBy !== undefined) patch.captured_by = await person(b.capturedBy, "Captured by");
    const out = await audited(req.user,
      { action: "Evidence updated", entity: "evidence", entityId: x.id, detail: patch.name ?? x.name,
        before: patch.uri !== undefined && patch.uri !== x.uri ? { uri: x.uri } : undefined,
        after: patch.uri !== undefined && patch.uri !== x.uri ? { uri: patch.uri } : undefined },
      async (t) => conflict(await updateVersioned(t, "evidence", x.id, requiredVersion(b, "evidence"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.delete("/evidence/:id", async (req, res, next) => {
  try {
    const x = await row("evidence", req.params.id, "piece of evidence");
    gate(req.user, "assurance.write", { project: await project(x.project_id, req.user) });
    await assertNotRelied(x.id, "removed");
    await audited(req.user,
      { action: "Evidence removed", entity: "evidence", entityId: x.id, detail: x.name, before: { ...x } },
      async (t) => t.query(`DELETE FROM evidence WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ════════════════════════════════════════════════════════════════════
   MER-05 · review findings
   ════════════════════════════════════════════════════════════════════ */

const SEVERITIES = ["S1", "S2", "S3", "S4"];
/* The working states. Closed and Waived are reached by their own acts,
   each with what it needs — evidence, or a reason and the authority. */
const FINDING_WORK = ["Open", "In progress", "Re-test"];

async function requirementOf(v, p) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const q = await one(`SELECT id, project_id FROM requirement WHERE id = $1`, [String(v)]);
  if (!q || q.project_id !== p.id) bad("That requirement is not on this project");
  return q.id;
}

r.post("/findings", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const p = await project(b.project, req.user);
    gate(req.user, "assurance.write", { project: p });
    /* The fact seen and why it matters are two fields (052): merging them
       is how a finding becomes an opinion. The fact is required. */
    const fact = text(b.observedFact, 2000);
    if (!fact) bad("A finding states what was observed, as a fact");
    if (b.severity !== undefined && !SEVERITIES.includes(b.severity)) bad("severity is S1, S2, S3 or S4");
    const status = b.status ?? "Open";
    if (!FINDING_WORK.includes(status)) bad("A finding is raised Open, In progress or Re-test — it closes on evidence, and is waived with a reason, by their own acts");
    const raisedOn = isoDay(b.raisedOn, "raisedOn") ?? today();
    const retestOn = isoDay(b.retestOn, "retestOn");
    if (retestOn && retestOn < raisedOn) bad("The re-test cannot be due before the finding was raised");
    const owner = await person(b.owner, "The owner");
    const requirement = await requirementOf(b.requirement, p);
    let id = null;
    await audited(req.user,
      () => ({ action: "Finding raised", entity: "finding", entityId: id, detail: fact.slice(0, 200) }),
      async (t) => {
        id = await freshId(t, "FND", "finding");
        await t.query(
          `INSERT INTO finding (id, project_id, requirement_id, gate_n, gate_loop, observed_fact,
                               why_it_matters, severity, owner_id, proposed_fix, raised_on,
                               retest_on, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [id, p.id, requirement ?? null, gateNo(b.gate), loopNo(b.loop), fact,
           text(b.whyItMatters, 2000), b.severity ?? "S3", owner, text(b.proposedFix, 2000),
           raisedOn, retestOn, status]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/findings/:id", async (req, res, next) => {
  try {
    const x = await row("finding", req.params.id, "finding");
    const p = await project(x.project_id, req.user);
    gate(req.user, "assurance.write", { project: p });
    const b = req.body ?? {};
    const patch = {};
    if (b.observedFact !== undefined) { patch.observed_fact = text(b.observedFact, 2000); if (!patch.observed_fact) bad("A finding states what was observed, as a fact"); }
    if (b.whyItMatters !== undefined) patch.why_it_matters = text(b.whyItMatters, 2000);
    if (b.severity !== undefined) { if (!SEVERITIES.includes(b.severity)) bad("severity is S1, S2, S3 or S4"); patch.severity = b.severity; }
    if (b.owner !== undefined) patch.owner_id = await person(b.owner, "The owner");
    if (b.proposedFix !== undefined) patch.proposed_fix = text(b.proposedFix, 2000);
    if (b.requirement !== undefined) patch.requirement_id = await requirementOf(b.requirement, p);
    if (b.gate !== undefined) patch.gate_n = gateNo(b.gate);
    if (b.loop !== undefined) patch.gate_loop = loopNo(b.loop);
    if (b.raisedOn !== undefined) patch.raised_on = isoDay(b.raisedOn, "raisedOn") ?? x.raised_on;
    if (b.retestOn !== undefined) patch.retest_on = isoDay(b.retestOn, "retestOn");
    const raised = patch.raised_on ?? x.raised_on;
    const retest = patch.retest_on !== undefined ? patch.retest_on : x.retest_on;
    if (retest && String(retest).slice(0, 10) < String(raised).slice(0, 10)) bad("The re-test cannot be due before the finding was raised");
    if (b.status !== undefined) {
      if (b.status === "Closed") bad("A finding closes on re-test evidence — use Close, and name the evidence");
      if (b.status === "Waived") bad("A waiver is its own act, with its reason — use Waive");
      if (!FINDING_WORK.includes(b.status)) bad("status is " + FINDING_WORK.join(", "));
      if (["Closed", "Waived"].includes(x.status)) bad(`This finding is ${x.status} — reopen it first`);
      patch.status = b.status;
    }
    const out = await audited(req.user,
      { action: "Finding updated", entity: "finding", entityId: x.id,
        detail: (patch.observed_fact ?? x.observed_fact).slice(0, 200),
        before: patch.severity && patch.severity !== x.severity ? { severity: x.severity } : undefined,
        after: patch.severity && patch.severity !== x.severity ? { severity: patch.severity } : undefined },
      async (t) => conflict(await updateVersioned(t, "finding", x.id, requiredVersion(b, "finding"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* THE rule of MER-05: « a finding closes on re-test evidence, never on a
   merged fix ». The database refuses Closed without evidence (052); this
   also refuses evidence that cannot be a re-test of it — another
   project's, or evidence captured before the finding existed. */
r.post("/findings/:id/close", async (req, res, next) => {
  try {
    const x = await row("finding", req.params.id, "finding");
    const p = await project(x.project_id, req.user);
    gate(req.user, "assurance.write", { project: p });
    const b = req.body ?? {};
    if (x.status === "Closed") throw new HttpError(409, `Finding ${x.id} is already closed`);
    if (x.status === "Waived") throw new HttpError(409, `Finding ${x.id} is waived — reopen it before closing it`);
    if (!b.evidence) bad("A finding closes on re-test evidence, never on a merged fix — name the evidence that shows it");
    const ev = await one(`SELECT id, project_id, captured_on, name FROM evidence WHERE id = $1`, [String(b.evidence)]);
    if (!ev || ev.project_id !== p.id) bad("That evidence is not on this project");
    if (String(ev.captured_on).slice(0, 10) < String(x.raised_on).slice(0, 10)) {
      bad(`${ev.id} was captured before this finding was raised — it cannot be the re-test that closes it`);
    }
    const out = await audited(req.user,
      { action: "Finding closed", entity: "finding", entityId: x.id,
        detail: `${x.observed_fact.slice(0, 160)} — on ${ev.id} (${ev.name})`,
        before: { status: x.status }, after: { status: "Closed", closedEvidence: ev.id } },
      async (t) => conflict(await updateVersioned(t, "finding", x.id, requiredVersion(b, "finding"),
        { status: "Closed", closed_evidence_id: ev.id, waiver_reason: "" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

r.post("/findings/:id/waive", async (req, res, next) => {
  try {
    const x = await row("finding", req.params.id, "finding");
    const p = await project(x.project_id, req.user);
    gate(req.user, "waiver.grant", { project: p });
    const b = req.body ?? {};
    if (["Closed", "Waived"].includes(x.status)) throw new HttpError(409, `Finding ${x.id} is already ${x.status}`);
    const reason = text(b.reason, 1000);
    if (!reason) bad("A waiver says why — a finding waived without a reason is a finding nobody decided to drop");
    const out = await audited(req.user,
      { action: "Finding waived", entity: "finding", entityId: x.id,
        detail: `${x.observed_fact.slice(0, 160)} — ${reason}`,
        before: { status: x.status }, after: { status: "Waived", waiverReason: reason } },
      async (t) => conflict(await updateVersioned(t, "finding", x.id, requiredVersion(b, "finding"),
        { status: "Waived", waiver_reason: reason })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* The reverse of close and waive. A closure that did not hold — the
   re-test was the wrong build — is reopened, never deleted: the audit
   row keeps what it had been closed on. */
r.post("/findings/:id/reopen", async (req, res, next) => {
  try {
    const x = await row("finding", req.params.id, "finding");
    const p = await project(x.project_id, req.user);
    gate(req.user, x.status === "Waived" ? "waiver.grant" : "assurance.write", { project: p });
    const b = req.body ?? {};
    if (!["Closed", "Waived"].includes(x.status)) throw new HttpError(409, `Finding ${x.id} is ${x.status}, not closed or waived`);
    const out = await audited(req.user,
      { action: "Finding reopened", entity: "finding", entityId: x.id, detail: x.observed_fact.slice(0, 200),
        before: { status: x.status, closedEvidence: x.closed_evidence_id, waiverReason: x.waiver_reason },
        after: { status: "Open" } },
      async (t) => conflict(await updateVersioned(t, "finding", x.id, requiredVersion(b, "finding"),
        { status: "Open", closed_evidence_id: null, waiver_reason: "" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* Removal is for a finding raised in error. One that was closed or waived
   is a record of a review's outcome — reopened, not erased. */
r.delete("/findings/:id", async (req, res, next) => {
  try {
    const x = await row("finding", req.params.id, "finding");
    gate(req.user, "assurance.write", { project: await project(x.project_id, req.user) });
    if (["Closed", "Waived"].includes(x.status)) {
      throw new HttpError(409, `Finding ${x.id} is ${x.status}: it is the record of what a review concluded. Reopen it if the conclusion was wrong.`);
    }
    await audited(req.user,
      { action: "Finding removed", entity: "finding", entityId: x.id,
        detail: x.observed_fact.slice(0, 200), before: { ...x } },
      async (t) => t.query(`DELETE FROM finding WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ════════════════════════════════════════════════════════════════════
   MER-06 · seats, vetoes and incompatibilities
   ════════════════════════════════════════════════════════════════════ */

const bool = (v) => v === true || v === "true" || v === 1 || v === "1";

r.post("/seats", async (req, res, next) => {
  try {
    gate(req.user, "seat.manage");
    const b = req.body ?? {};
    const name = text(b.name, 200);
    if (!name) bad("A seat is named — the role the committee knows it by");
    const holder = await person(b.person, "The holder");
    let id = null;
    await audited(req.user,
      () => ({ action: "Seat created", entity: "seat", entityId: id, detail: name }),
      async (t) => {
        id = await freshId(t, "SEAT", "seat");
        await t.query(
          `INSERT INTO seat (id, name, person_id, domain, veto_domain, observer, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, name, holder, text(b.domain, 200), text(b.vetoDomain, 200) || null,
           bool(b.observer), b.active === undefined ? true : bool(b.active)]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

r.patch("/seats/:id", async (req, res, next) => {
  try {
    gate(req.user, "seat.manage");
    const x = await row("seat", req.params.id, "seat");
    const b = req.body ?? {};
    const patch = {};
    if (b.name !== undefined) { patch.name = text(b.name, 200); if (!patch.name) bad("A seat is named — the role the committee knows it by"); }
    /* The trigger of 052 refuses a holder who already sits in an
       incompatible seat; pgerror.js answers it as a 409 in its own words. */
    if (b.person !== undefined) patch.person_id = await person(b.person, "The holder");
    if (b.domain !== undefined) patch.domain = text(b.domain, 200);
    /* A veto is on a DOMAIN, never on everything (052). Empty = no veto. */
    if (b.vetoDomain !== undefined) patch.veto_domain = text(b.vetoDomain, 200) || null;
    if (b.observer !== undefined) patch.observer = bool(b.observer);
    if (b.active !== undefined) patch.active = bool(b.active);
    const moved = patch.person_id !== undefined && patch.person_id !== x.person_id;
    const out = await audited(req.user,
      { action: moved ? "Seat reassigned" : "Seat updated", entity: "seat", entityId: x.id,
        detail: patch.name ?? x.name,
        before: moved ? { person: x.person_id } : undefined, after: moved ? { person: patch.person_id } : undefined },
      async (t) => conflict(await updateVersioned(t, "seat", x.id, requiredVersion(b, "seat"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* A seat created in error is removed. One that an objection was lodged
   in the name of is part of that objection's record: it is retired
   (active=false), which keeps the name on what it said. */
r.delete("/seats/:id", async (req, res, next) => {
  try {
    gate(req.user, "seat.manage");
    const x = await row("seat", req.params.id, "seat");
    const cited = await one(`SELECT id FROM decision_objection WHERE seat_id = $1 LIMIT 1`, [x.id]);
    if (cited) {
      throw new HttpError(409, `Objection ${cited.id} was lodged in this seat's name — retire the seat (untick « active ») so the record keeps saying who objected`);
    }
    await audited(req.user,
      { action: "Seat removed", entity: "seat", entityId: x.id, detail: x.name, before: { ...x } },
      async (t) => t.query(`DELETE FROM seat WHERE id = $1`, [x.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* An incompatibility is an EDGE, stored in both directions (the import's
   rule): a one-way edge would leave half of the segregation of duties
   without effect, because the trigger reads it from the seat being
   given. The edge trigger of 055 refuses it when one person already
   holds both. */
r.post("/seats/:id/conflicts", async (req, res, next) => {
  try {
    gate(req.user, "seat.manage");
    const a = await row("seat", req.params.id, "seat");
    const b = req.body ?? {};
    if (!b.other) bad("Name the seat this one cannot be combined with");
    const other = await row("seat", b.other, "seat");
    if (other.id === a.id) bad("A seat cannot be incompatible with itself");
    const exists = await one(`SELECT 1 FROM seat_conflict WHERE seat_id = $1 AND other_id = $2`, [a.id, other.id]);
    if (exists) throw new HttpError(409, `${a.name} and ${other.name} are already declared incompatible`);
    const reason = text(b.reason, 500);
    await audited(req.user,
      { action: "Seat incompatibility declared", entity: "seat_conflict", entityId: a.id + "~" + other.id,
        detail: `${a.name} ⟷ ${other.name}${reason ? " — " + reason : ""}` },
      async (t) => {
        for (const [x, y] of [[a.id, other.id], [other.id, a.id]]) {
          await t.query(`INSERT INTO seat_conflict (seat_id, other_id, reason) VALUES ($1,$2,$3)`, [x, y, reason]);
        }
      });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/seats/:id/conflicts/:other", async (req, res, next) => {
  try {
    gate(req.user, "seat.manage");
    const edge = await one(`SELECT * FROM seat_conflict WHERE seat_id = $1 AND other_id = $2`,
      [req.params.id, req.params.other]);
    if (!edge) throw new HttpError(404, "No such incompatibility");
    await audited(req.user,
      { action: "Seat incompatibility removed", entity: "seat_conflict",
        entityId: edge.seat_id + "~" + edge.other_id, detail: edge.reason, before: { ...edge } },
      async (t) => t.query(
        `DELETE FROM seat_conflict WHERE (seat_id = $1 AND other_id = $2) OR (seat_id = $2 AND other_id = $1)`,
        [edge.seat_id, edge.other_id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ════════════════════════════════════════════════════════════════════
   MER-07 · objections to a decision
   ════════════════════════════════════════════════════════════════════ */

/* The decision, and what its visibility is: its meeting's scope, else its
   project, else the portfolio. A decision outside the reader's scope
   answers 404, as a project does (B2). */
async function decisionFor(id, user) {
  const d = await one(
    `SELECT d.id, d.project_id, d.decided_by, d.headline,
            s.scope_kind, s.programme_id, s.site_id
       FROM meeting_decision d
       LEFT JOIN meeting_occurrence o ON o.id = d.occurrence_id
       LEFT JOIN meeting_series s ON s.id = o.series_id
      WHERE d.id = $1`, [String(id)]);
  if (!d) throw new HttpError(404, "No such decision");
  const scope = d.scope_kind
    ? { scope_kind: d.scope_kind, programme_id: d.programme_id, site_id: d.site_id } : null;
  const p = d.project_id ? await projectFor(d.project_id) : null;
  if (!can(user, "portfolio.read").ok) throw new HttpError(404, "No such decision");
  if (scope && !can(user, "meeting.read", { scope }).ok) throw new HttpError(404, "No such decision");
  if (!scope && p && !canSeeProject(user, p)) throw new HttpError(404, "No such decision");
  return { d, scope, project: p };
}
async function objectionFor(id, user) {
  const o = await row("decision_objection", id, "objection");
  const { d } = await decisionFor(o.decision_id, user);
  return { o, d };
}
async function seatFor(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = await one(`SELECT id, name, person_id, active, veto_domain FROM seat WHERE id = $1`, [String(v)]);
  if (!s) bad("No such seat");
  if (!s.active) bad(`${s.name} is retired — an objection is lodged in the name of a sitting seat`);
  return s;
}
/* KODO: an unresolved objection escalates to the product owner within one
   working week. Unless the objector names another date, the clock is
   seven calendar days — one working week — from the day it was raised. */
const WORKING_WEEK = 7;

r.post("/decisions/:id/objections", async (req, res, next) => {
  try {
    const { d, scope, project: p } = await decisionFor(req.params.id, req.user);
    const b = req.body ?? {};
    const seat = await seatFor(b.seat);
    gate(req.user, "objection.raise", { scope, project: p, seat_person: seat?.person_id ?? null });
    /* An objection without a reason is not an objection, it is a vote
       (052). Said here in words before the constraint says it in SQL. */
    const reason = text(b.reason, 2000);
    if (!reason) bad("An objection gives its reason — without one it is not an objection, it is a vote");
    const raisedOn = isoDay(b.raisedOn, "raisedOn") ?? today();
    const escalatesOn = isoDay(b.escalatesOn, "escalatesOn") ?? iso(addDays(raisedOn, WORKING_WEEK));
    if (escalatesOn < raisedOn) bad("An objection cannot escalate before it was raised");
    const domain = text(b.domain, 200) || (seat?.veto_domain ?? "");
    let id = null;
    await audited(req.user,
      () => ({ action: "Objection raised", entity: "decision_objection", entityId: id,
               detail: `${d.id} — ${reason.slice(0, 180)}` }),
      async (t) => {
        id = await freshId(t, "OBJ", "decision_objection");
        await t.query(
          `INSERT INTO decision_objection (id, decision_id, seat_id, domain, reason, raised_on,
                                          escalates_on, state, raised_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8)`,
          [id, d.id, seat?.id ?? null, domain, reason, raisedOn, escalatesOn, req.user.personId ?? null]);
      });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

/* The objector rewords their objection while it is live. Only its own
   words, its domain and its clock — the seat it was lodged in is what
   gave it its weight, and is not swapped afterwards. */
r.patch("/objections/:id", async (req, res, next) => {
  try {
    const { o } = await objectionFor(req.params.id, req.user);
    gate(req.user, "objection.own", { raised_by: o.raised_by });
    if (!["open", "escalated"].includes(o.state)) throw new HttpError(409, `This objection is ${o.state} — it is a record now`);
    const b = req.body ?? {};
    const patch = {};
    if (b.reason !== undefined) {
      patch.reason = text(b.reason, 2000);
      if (!patch.reason) bad("An objection gives its reason — without one it is not an objection, it is a vote");
    }
    if (b.domain !== undefined) patch.domain = text(b.domain, 200);
    if (b.escalatesOn !== undefined) {
      patch.escalates_on = isoDay(b.escalatesOn, "escalatesOn");
      if (patch.escalates_on && patch.escalates_on < String(o.raised_on).slice(0, 10)) bad("An objection cannot escalate before it was raised");
    }
    const out = await audited(req.user,
      { action: "Objection updated", entity: "decision_objection", entityId: o.id,
        detail: (patch.reason ?? o.reason).slice(0, 200),
        before: patch.reason !== undefined ? { reason: o.reason } : undefined,
        after: patch.reason !== undefined ? { reason: patch.reason } : undefined },
      async (t) => conflict(await updateVersioned(t, "decision_objection", o.id, requiredVersion(b, "objection"), patch)));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* Answering it. The resolution is what the room will read back, so it is
   required (052); the decision's own maker never writes it (rbac). */
r.post("/objections/:id/resolve", async (req, res, next) => {
  try {
    const { o, d } = await objectionFor(req.params.id, req.user);
    gate(req.user, "objection.resolve", { decided_by: d.decided_by });
    if (!["open", "escalated"].includes(o.state)) throw new HttpError(409, `This objection is already ${o.state}`);
    const b = req.body ?? {};
    const resolution = text(b.resolution, 2000);
    if (!resolution) bad("A resolution says how the objection was answered — the room will read it back");
    const out = await audited(req.user,
      { action: "Objection resolved", entity: "decision_objection", entityId: o.id,
        detail: `${d.id} — ${resolution.slice(0, 180)}`,
        before: { state: o.state }, after: { state: "resolved", resolution } },
      async (t) => conflict(await updateVersioned(t, "decision_objection", o.id, requiredVersion(b, "objection"),
        { state: "resolved", resolution })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* Pushed up: the objector who is not heard, or the programme office when
   the clock has run. It stays live — and a veto seat's escalated
   objection still blocks its gate (Engine.openVetoes). */
r.post("/objections/:id/escalate", async (req, res, next) => {
  try {
    const { o, d } = await objectionFor(req.params.id, req.user);
    gate(req.user, "objection.own", { raised_by: o.raised_by });
    if (o.state !== "open") throw new HttpError(409, `This objection is ${o.state} — only an open objection is escalated`);
    const b = req.body ?? {};
    const out = await audited(req.user,
      { action: "Objection escalated", entity: "decision_objection", entityId: o.id,
        detail: `${d.id} — ${o.reason.slice(0, 180)}`, before: { state: o.state }, after: { state: "escalated" } },
      async (t) => conflict(await updateVersioned(t, "decision_objection", o.id, requiredVersion(b, "objection"),
        { state: "escalated" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

/* The reverse of raising it. An objection is never deleted: a withdrawn
   one stays on the record, which is how a board shows it heard it. */
r.post("/objections/:id/withdraw", async (req, res, next) => {
  try {
    const { o, d } = await objectionFor(req.params.id, req.user);
    gate(req.user, "objection.own", { raised_by: o.raised_by });
    if (!["open", "escalated"].includes(o.state)) throw new HttpError(409, `This objection is already ${o.state}`);
    const b = req.body ?? {};
    const out = await audited(req.user,
      { action: "Objection withdrawn", entity: "decision_objection", entityId: o.id,
        detail: `${d.id} — ${o.reason.slice(0, 180)}`, before: { state: o.state }, after: { state: "withdrawn" } },
      async (t) => conflict(await updateVersioned(t, "decision_objection", o.id, requiredVersion(b, "objection"),
        { state: "withdrawn" })));
    res.json({ version: out.version });
  } catch (e) { next(e); }
});

export default r;

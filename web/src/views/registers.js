/**
 * KODO's registers on screen  (docs/36 NEW-04).
 *
 * Requirements, evidence and findings live on the project they belong to
 * (three folds of the project view); seats live with the rooms that seat
 * them (the Meetings view); objections live on the decision they object
 * to — in the meeting that took it and in the decision register.
 *
 * Every control asks shared/rbac.js the question the server will ask
 * (R7.3): a control the account cannot use is not drawn.
 */

import { h, formDialog, confirmDialog, table, sectionHead, tag, icon, fold, safeHref } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { t } from "../lib/i18n.js";
import { Engine, D, fmtDate } from "../../../shared/engine.js";

/* ── shared ───────────────────────────────────────────────────────── */

const asRow = (p) => p && { id: p.id, programme_id: p.programme, site_id: p.site, governance_level: p.governanceLevel };
const mayAssure = (p) => !!p && p.origin !== "sdp" && App.can("assurance.write", { project: asRow(p) });
const mayWaive = (p) => !!p && App.can("waiver.grant", { project: asRow(p) });
const people = (db) => [{ value: "", label: "—" }].concat(db.people.map((q) => ({ value: q.id, label: q.name })));
const who = (db, id) => (id ? Engine.personName(db, id) : "—");
const gateOf = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/* ════════════════════════════════════════════════════════════════════
   MER-03 · requirements
   ════════════════════════════════════════════════════════════════════ */

const PRIORITY = { M: "Must", S: "Should", C: "Could", W: "Won't" };
const REQ_STATUS = ["Not started", "In progress", "Done"];

function requirementsBlock(db, p, rows) {
  const canEdit = mayAssure(p);
  return h("div", null,
    sectionHead(t("Requirements"), t("what the project must hold, how it will be verified, and the proof that it was"),
      canEdit ? h("button", { class: "btn btn-sm", onClick: () => editRequirement(db, p, null) }, icon("plus", 12), t("Requirement")) : null),
    rows.length ? table({
      cols: [
        { key: "s", label: t("Requirement"), get: (x) => h("div", null,
            h("div", { class: "strong small" }, x.id + " · " + x.statement),
            x.source ? h("div", { class: "xs muted" }, t("Source") + ": " + x.source) : null) },
        { key: "p", label: t("Priority"), width: "80px", get: (x) => tag(t(PRIORITY[x.priority] ?? x.priority), x.priority === "M" ? "tag-soft" : "tag-out") },
        { key: "g", label: t("Gate"), align: "c", width: "56px", get: (x) => x.gate ? tag("G" + x.gate, "tag-out") : h("span", { class: "muted" }, "—") },
        { key: "v", label: t("Verification"), get: (x) => h("div", null,
            h("div", { class: "small" }, x.verification || h("span", { class: "muted" }, t("no method stated"))),
            h("div", { class: "xs " + (x.verifiedBy ? "" : "muted") }, x.verifiedBy ? "✓ " + x.verifiedBy : t("not yet verified"))) },
        { key: "st", label: t("Status"), width: "110px", get: (x) => h("div", null,
            tag(t(x.status), x.status === "Done" ? "tag-ink" : x.status === "Waived" ? "tag-acc" : "tag-out"),
            x.status === "Waived" && x.waiverReason ? h("div", { class: "xs muted", title: x.waiverReason }, x.waiverReason.slice(0, 60)) : null) },
        { key: "o", label: t("Owner"), get: (x) => h("span", { class: "small muted" }, who(db, x.owner)) },
        { key: "x", label: "", align: "r", width: "80px", get: (x) => !canEdit ? null
          : h("div", { class: "btn-row", style: "justify-content:flex-end" },
              h("button", { class: "btn btn-xs btn-ghost", title: t("Edit requirement"), onClick: () => editRequirement(db, p, x) }, icon("pencil", 11)),
              h("button", { class: "btn btn-xs btn-ghost", title: t("Remove requirement"), onClick: () => removeRequirement(x) }, icon("trash", 11))) },
      ], rows,
      empty: t("No requirement stated yet."),
    }) : h("div", { class: "small muted" },
      t("No requirement stated. A gate reviewed against documents answers « here is a dossier »; one reviewed against requirements answers « here is what was promised, and the proof each one holds ».")));
}

function editRequirement(db, p, x) {
  const waive = mayWaive(p);
  const statuses = REQ_STATUS.concat(waive || x?.status === "Waived" ? ["Waived"] : []);
  formDialog({
    title: x ? t("Edit requirement") : t("State a requirement"), kicker: x ? x.id : p.id, wide: true,
    fields: [
      { key: "statement", label: t("Requirement"), required: true, span: 2, type: "textarea", rows: 2, value: x?.statement ?? "",
        hint: t("One thing that must hold, testable as written — « settles within 10 s », not « is fast ».") },
      { key: "source", label: t("Source"), value: x?.source ?? "",
        hint: t("Where it comes from: a contract clause, a regulation, a decision. Without it a requirement is an opinion.") },
      { key: "priority", label: t("Priority"), type: "select", value: x?.priority ?? "M",
        options: Object.entries(PRIORITY).map(([value, label]) => ({ value, label: value + " — " + t(label) })) },
      { key: "verification", label: t("Verification method"), value: x?.verification ?? "",
        hint: t("How it WILL be verified — a test, an inspection, a measurement. Writing this does not verify it.") },
      { key: "verifiedBy", label: t("Verified by"), value: x?.verifiedBy ?? "",
        hint: t("The proof produced — the named test, run or report. Required before it can be Done.") },
      { key: "gate", label: t("Gate"), type: "number", min: 1, value: x?.gate ?? "" },
      { key: "owner", label: t("Owner"), type: "select", value: x?.owner ?? "", options: people(db) },
      { key: "status", label: t("Status"), type: "select", value: x?.status ?? "Not started",
        options: statuses.map((s) => ({ value: s, label: t(s) })) },
      ...(waive ? [{ key: "waiverReason", label: t("Why it is waived"), type: "textarea", rows: 2, span: 2,
        value: x?.waiverReason ?? "",
        hint: t("Read by whoever asks, a year from now, why this requirement stopped counting. Required to waive.") }] : []),
    ],
    saveLabel: x ? t("Save") : t("State it"),
    onSave: (v) => {
      const body = { statement: v.statement, source: v.source, priority: v.priority,
        verification: v.verification, verifiedBy: v.verifiedBy, gate: gateOf(v.gate),
        owner: v.owner || null, status: v.status };
      if (waive) body.waiverReason = v.waiverReason ?? "";
      return App.write(x ? "Requirement updated" : "Requirement stated", (a) => x
        ? a.patch("/requirements/" + x.id, { ...body, version: x.version })
        : a.post("/requirements", { ...body, project: p.id }), { detail: v.statement.slice(0, 80), rethrow: true })
        .catch(() => false);
    },
  });
}
function removeRequirement(x) {
  confirmDialog({ title: t("Remove this requirement?"), confirmLabel: t("Remove"), danger: true, message: x.statement,
    detail: t("For a requirement stated in error. One that no longer applies is waived, with its reason, so the record says so.") })
    .then((ok) => ok && App.write("Requirement removed", (a) => a.del("/requirements/" + x.id), { detail: x.id }));
}

/* ════════════════════════════════════════════════════════════════════
   MER-11 · evidence
   ════════════════════════════════════════════════════════════════════ */

const EV_KINDS = ["document", "ci_run", "test_report", "measurement", "dataset", "recording", "sign_off", "external"];
const EV_LABEL = { document: "Document", ci_run: "CI run", test_report: "Test report", measurement: "Measurement",
  dataset: "Dataset", recording: "Recording", sign_off: "Sign-off", external: "External" };

function evidenceBlock(db, p, rows) {
  const canEdit = mayAssure(p);
  const reliedOn = new Set((db.findings ?? []).filter((f) => f.status === "Closed").map((f) => f.closedEvidence));
  return h("div", null,
    sectionHead(t("Evidence"), t("the proof a gate or a finding rests on — a document, or a run, a report, a measurement"),
      canEdit ? h("button", { class: "btn btn-sm", onClick: () => editEvidence(db, p, null) }, icon("plus", 12), t("Evidence")) : null),
    rows.length ? table({
      cols: [
        { key: "n", label: t("Evidence"), get: (x) => h("div", null,
            h("div", { class: "strong small" }, x.name),
            h("div", { class: "xs muted" }, x.id + " · " + t(EV_LABEL[x.kind] ?? x.kind) + (x.digest ? " · " + x.digest : ""))) },
        { key: "g", label: t("Gate"), align: "c", width: "70px", get: (x) => x.gate
            ? h("span", { class: "mono small" }, "G" + x.gate + (x.loop > 1 ? " ·" + x.loop : "")) : h("span", { class: "muted" }, "—") },
        { key: "s", label: t("Source"), get: (x) => h("div", { class: "small" },
            x.uri ? (safeHref(x.uri)
              ? h("a", { href: x.uri, target: "_blank", rel: "noopener noreferrer", class: "linkish" }, x.uri.slice(0, 48))
              : h("span", { class: "mono" }, x.uri.slice(0, 48))) : null,
            x.document ? h("div", { class: "xs muted" }, t("Document") + " " + ((db.docs.find((d) => d.id === x.document) || {}).name || x.document)) : null) },
        { key: "c", label: t("Captured"), get: (x) => h("div", { class: "small" }, fmtDate(x.capturedOn),
            h("div", { class: "xs muted" }, who(db, x.capturedBy))) },
        { key: "x", label: "", align: "r", width: "80px", get: (x) => !canEdit ? null
          : reliedOn.has(x.id) ? h("span", { class: "xs muted", title: t("A closed finding rests on this evidence, so it is not edited underneath it.") }, "🔒")
          : h("div", { class: "btn-row", style: "justify-content:flex-end" },
              h("button", { class: "btn btn-xs btn-ghost", title: t("Edit evidence"), onClick: () => editEvidence(db, p, x) }, icon("pencil", 11)),
              h("button", { class: "btn btn-xs btn-ghost", title: t("Remove evidence"), onClick: () => removeEvidence(x) }, icon("trash", 11))) },
      ], rows,
      empty: t("No evidence captured yet."),
    }) : h("div", { class: "small muted" },
      t("No evidence captured. A CI run, a traceability report or a measurement is evidence too; it does not have to be forced into the document register.")));
}

function editEvidence(db, p, x) {
  const docs = db.docs.filter((d) => d.project === p.id);
  formDialog({
    title: x ? t("Edit evidence") : t("Capture evidence"), kicker: x ? x.id : p.id, wide: true,
    fields: [
      { key: "name", label: t("Name"), required: true, span: 2, value: x?.name ?? "",
        hint: t("What a reader will look for — « Nightly build 412 », « SAT-14 report ».") },
      { key: "kind", label: t("Kind"), type: "select", value: x?.kind ?? "ci_run",
        options: EV_KINDS.map((k) => ({ value: k, label: t(EV_LABEL[k]) })) },
      { key: "uri", label: t("Address"), value: x?.uri ?? "", placeholder: "https://… · git:… · run:…",
        hint: t("Where it can be found again: a link, a repository path at a revision, a commit, or run:/artifact:. Either this or a document.") },
      { key: "document", label: t("Document"), type: "select", value: x?.document ?? "",
        options: [{ value: "", label: t("None") }].concat(docs.map((d) => ({ value: d.id, label: d.name }))) },
      { key: "digest", label: t("Digest"), value: x?.digest ?? "", advanced: true,
        hint: t("A hash of the artefact, when there is one — it proves the piece read later is the piece captured.") },
      { key: "gate", label: t("Gate"), type: "number", min: 1, value: x?.gate ?? "" },
      { key: "loop", label: t("Loop"), type: "number", min: 1, value: x?.loop ?? 1, advanced: true },
      { key: "capturedOn", label: t("Captured on"), type: "date", value: x?.capturedOn ?? db.statusDate },
      { key: "capturedBy", label: t("Captured by"), type: "select", value: x?.capturedBy ?? App.me.personId ?? "", options: people(db) },
    ],
    saveLabel: x ? t("Save") : t("Capture"),
    onSave: (v) => {
      const body = { name: v.name, kind: v.kind, uri: v.uri, document: v.document || null, digest: v.digest,
        gate: gateOf(v.gate), loop: Number(v.loop) || 1, capturedOn: v.capturedOn, capturedBy: v.capturedBy || null };
      return App.write(x ? "Evidence updated" : "Evidence captured", (a) => x
        ? a.patch("/evidence/" + x.id, { ...body, version: x.version })
        : a.post("/evidence", { ...body, project: p.id }), { detail: v.name, rethrow: true }).catch(() => false);
    },
  });
}
function removeEvidence(x) {
  confirmDialog({ title: t("Remove this evidence?"), confirmLabel: t("Remove"), danger: true, message: x.name,
    detail: t("For a piece captured in error. The audit trail keeps what it pointed at.") })
    .then((ok) => ok && App.write("Evidence removed", (a) => a.del("/evidence/" + x.id), { detail: x.name }));
}

/* ════════════════════════════════════════════════════════════════════
   MER-05 · findings
   ════════════════════════════════════════════════════════════════════ */

const SEVERITY_NOTE = { S1: "blocking", S2: "major", S3: "minor", S4: "cosmetic" };
const FINDING_WORK = ["Open", "In progress", "Re-test"];

function findingsBlock(db, p, rows) {
  const canEdit = mayAssure(p);
  const canWaive = mayWaive(p);
  const late = (f) => f.retestOn && !["Closed", "Waived"].includes(f.status) && D(f.retestOn) < D(db.statusDate);
  return h("div", null,
    sectionHead(t("Review findings"), t("what a review observed — closed on re-test evidence, never on a merged fix"),
      canEdit ? h("button", { class: "btn btn-sm", onClick: () => editFinding(db, p, null) }, icon("plus", 12), t("Finding")) : null),
    rows.length ? table({
      cols: [
        { key: "f", label: t("Finding"), get: (x) => h("div", null,
            h("div", { class: "strong small" }, x.id + " · " + x.observedFact),
            x.whyItMatters ? h("div", { class: "xs muted" }, t("Why it matters") + ": " + x.whyItMatters) : null,
            x.proposedFix ? h("div", { class: "xs muted" }, t("Proposed fix") + ": " + x.proposedFix) : null,
            x.requirement ? h("div", { class: "xs muted" }, t("Against") + " " + x.requirement) : null) },
        { key: "s", label: t("Severity"), width: "82px", get: (x) => tag(x.severity + " · " + t(SEVERITY_NOTE[x.severity] ?? ""),
            x.severity === "S1" ? "tag-acc" : x.severity === "S2" ? "tag-soft" : "tag-out") },
        { key: "g", label: t("Gate"), align: "c", width: "60px", get: (x) => x.gate
            ? h("span", { class: "mono small" }, "G" + x.gate + (x.loop > 1 ? " ·" + x.loop : "")) : h("span", { class: "muted" }, "—") },
        { key: "st", label: t("Status"), width: "130px", get: (x) => h("div", null,
            tag(t(x.status), x.status === "Closed" ? "tag-ink" : x.status === "Waived" ? "tag-acc" : "tag-out"),
            x.status === "Closed" && x.closedEvidence ? h("div", { class: "xs muted" }, t("on") + " " + x.closedEvidence) : null,
            x.status === "Waived" && x.waiverReason ? h("div", { class: "xs muted", title: x.waiverReason }, x.waiverReason.slice(0, 60)) : null,
            x.retestOn && !["Closed", "Waived"].includes(x.status)
              ? h("div", { class: "xs " + (late(x) ? "bad strong" : "muted") }, t("re-test") + " " + fmtDate(x.retestOn)) : null) },
        { key: "o", label: t("Owner"), get: (x) => h("span", { class: "small muted" }, who(db, x.owner)) },
        { key: "x", label: "", align: "r", width: "150px", get: (x) => findingActions(db, p, x, canEdit, canWaive) },
      ], rows,
      empty: t("No finding raised yet."),
    }) : h("div", { class: "small muted" },
      t("No finding raised. A finding is neither a risk — it has happened — nor a lesson — it is open and owned.")));
}
function findingActions(db, p, x, canEdit, canWaive) {
  const live = !["Closed", "Waived"].includes(x.status);
  return h("div", { class: "btn-row", style: "justify-content:flex-end;flex-wrap:wrap" },
    canEdit && live ? h("button", { class: "btn btn-xs btn-primary", onClick: () => closeFinding(db, p, x) }, t("Close")) : null,
    canWaive && live ? h("button", { class: "btn btn-xs", onClick: () => waiveFinding(x) }, t("Waive")) : null,
    (x.status === "Closed" && canEdit) || (x.status === "Waived" && canWaive)
      ? h("button", { class: "btn btn-xs btn-ghost", title: t("Reopen"), onClick: () => reopenFinding(x) }, "↺") : null,
    canEdit && live ? h("button", { class: "btn btn-xs btn-ghost", title: t("Edit finding"), onClick: () => editFinding(db, p, x) }, icon("pencil", 11)) : null,
    canEdit && live ? h("button", { class: "btn btn-xs btn-ghost", title: t("Remove finding"), onClick: () => removeFinding(x) }, icon("trash", 11)) : null);
}

function editFinding(db, p, x) {
  const reqs = (db.requirements ?? []).filter((q) => q.project === p.id);
  formDialog({
    title: x ? t("Edit finding") : t("Raise a finding"), kicker: x ? x.id : p.id, wide: true,
    fields: [
      { key: "observedFact", label: t("What was observed"), required: true, span: 2, type: "textarea", rows: 2, value: x?.observedFact ?? "",
        hint: t("The fact, as seen — « Esc does not close the palette ». Not the consequence, and not an opinion.") },
      { key: "whyItMatters", label: t("Why it matters"), span: 2, value: x?.whyItMatters ?? "",
        hint: t("The consequence, kept apart from the fact so the finding can be read without the reviewer.") },
      { key: "severity", label: t("Severity"), type: "select", value: x?.severity ?? "S3",
        options: Object.entries(SEVERITY_NOTE).map(([value, n]) => ({ value, label: value + " — " + t(n) })) },
      { key: "status", label: t("Status"), type: "select", value: x?.status ?? "Open",
        options: FINDING_WORK.map((s) => ({ value: s, label: t(s) })) },
      { key: "owner", label: t("Owner"), type: "select", value: x?.owner ?? "", options: people(db) },
      { key: "requirement", label: t("Requirement"), type: "select", value: x?.requirement ?? "",
        options: [{ value: "", label: t("None") }].concat(reqs.map((q) => ({ value: q.id, label: q.id + " · " + q.statement.slice(0, 60) }))) },
      { key: "proposedFix", label: t("Proposed fix"), span: 2, value: x?.proposedFix ?? "", advanced: true,
        hint: t("What the reviewer suggests. Merging it does not close the finding — its re-test does.") },
      { key: "raisedOn", label: t("Raised on"), type: "date", value: x?.raisedOn ?? db.statusDate },
      { key: "retestOn", label: t("Re-test due"), type: "date", value: x?.retestOn ?? "" },
      { key: "gate", label: t("Gate"), type: "number", min: 1, value: x?.gate ?? "", advanced: true },
      { key: "loop", label: t("Loop"), type: "number", min: 1, value: x?.loop ?? 1, advanced: true },
    ],
    saveLabel: x ? t("Save") : t("Raise it"),
    onSave: (v) => {
      const body = { observedFact: v.observedFact, whyItMatters: v.whyItMatters, severity: v.severity,
        status: v.status, owner: v.owner || null, requirement: v.requirement || null, proposedFix: v.proposedFix,
        raisedOn: v.raisedOn, retestOn: v.retestOn || null, gate: gateOf(v.gate), loop: Number(v.loop) || 1 };
      return App.write(x ? "Finding updated" : "Finding raised", (a) => x
        ? a.patch("/findings/" + x.id, { ...body, version: x.version })
        : a.post("/findings", { ...body, project: p.id }), { detail: v.observedFact.slice(0, 80), rethrow: true })
        .catch(() => false);
    },
  });
}
function closeFinding(db, p, x) {
  /* Only evidence that can BE its re-test: on this project, captured on or
     after the day the finding was raised. The server holds the same rule. */
  const usable = (db.evidence ?? []).filter((e) => e.project === p.id && String(e.capturedOn) >= String(x.raisedOn));
  formDialog({
    title: t("Close on re-test evidence"), kicker: x.id,
    fields: [
      { key: "evidence", label: t("Re-test evidence"), type: "select", required: true, span: 2, value: usable[0]?.id ?? "",
        options: [{ value: "", label: usable.length ? "—" : t("No evidence captured since this finding was raised") }]
          .concat(usable.map((e) => ({ value: e.id, label: e.id + " · " + e.name + " · " + e.capturedOn }))),
        hint: t("The run, report or measurement that shows it fixed. A merged fix is an intention; its re-test is the fact. Capture the evidence first, under Evidence.") },
    ],
    saveLabel: t("Close"),
    onSave: (v) => App.write("Finding closed", (a) => a.post("/findings/" + x.id + "/close",
      { evidence: v.evidence, version: x.version }), { detail: x.id, rethrow: true }).catch(() => false),
  });
}
function waiveFinding(x) {
  formDialog({
    title: t("Waive this finding"), kicker: x.id,
    fields: [
      { key: "reason", label: t("Why it is waived"), type: "textarea", rows: 3, span: 2, required: true, value: "",
        hint: t("Read by whoever asks, a year from now, why this finding stopped counting. A waiver without its reason is a finding nobody decided to drop.") },
    ],
    saveLabel: t("Waive"),
    onSave: (v) => App.write("Finding waived", (a) => a.post("/findings/" + x.id + "/waive",
      { reason: v.reason, version: x.version }), { detail: x.id, rethrow: true }).catch(() => false),
  });
}
function reopenFinding(x) {
  confirmDialog({ title: t("Reopen this finding?"), confirmLabel: t("Reopen"), message: x.observedFact,
    detail: t("The closure or the waiver is lifted; the audit trail keeps what it rested on.") })
    .then((ok) => ok && App.write("Finding reopened", (a) => a.post("/findings/" + x.id + "/reopen", { version: x.version }), { detail: x.id }));
}
function removeFinding(x) {
  confirmDialog({ title: t("Remove this finding?"), confirmLabel: t("Remove"), danger: true, message: x.observedFact,
    detail: t("For a finding raised in error. One that was closed or waived is a record, and is reopened instead.") })
    .then((ok) => ok && App.write("Finding removed", (a) => a.del("/findings/" + x.id), { detail: x.id }));
}

/** The three folds of a project's assurance, for the project view. */
export function assuranceFolds(db, p) {
  const reqs = (db.requirements ?? []).filter((x) => x.project === p.id);
  const evs = (db.evidence ?? []).filter((x) => x.project === p.id);
  const fds = (db.findings ?? []).filter((x) => x.project === p.id);
  const done = reqs.filter((x) => x.status === "Done").length;
  const waived = reqs.filter((x) => x.status === "Waived").length;
  const open = fds.filter((x) => !["Closed", "Waived"].includes(x.status));
  const severe = open.filter((x) => x.severity === "S1" || x.severity === "S2").length;
  return [
    fold(t("Requirements"),
      reqs.length ? reqs.length + " " + t("stated") + " · " + done + " " + t("done") + (waived ? " · " + waived + " " + t("waived") : "") : t("none stated"),
      false, requirementsBlock(db, p, reqs)),
    fold(t("Evidence"), evs.length ? evs.length + " " + t("captured") : t("none captured"), false, evidenceBlock(db, p, evs)),
    fold(t("Review findings"),
      fds.length ? open.length + " " + t("open") + (severe ? " · " + severe + " S1–S2" : "") + " · " + (fds.length - open.length) + " " + t("closed or waived") : t("none raised"),
      severe > 0, findingsBlock(db, p, fds)),
  ];
}

/* ════════════════════════════════════════════════════════════════════
   MER-06 · seats
   ════════════════════════════════════════════════════════════════════ */

export function seatsSection(db) {
  const seats = db.seats ?? [];
  const canManage = App.can("seat.manage");
  const name = (id) => (seats.find((s) => s.id === id) || {}).name || id;
  return h("section", { class: "sec", "data-register": "seats" },
    sectionHead(t("Seats and vetoes"), t("who sits, on which domain, who may block a gate — and what one person may never combine"),
      canManage ? h("button", { class: "btn btn-sm", onClick: () => editSeat(db, null) }, icon("plus", 12), t("Seat")) : null),
    seats.length ? table({
      cols: [
        { key: "n", label: t("Seat"), get: (s) => h("div", null,
            h("div", { class: "strong small" }, s.name),
            h("div", { class: "xs muted" }, s.id + (s.domain ? " · " + s.domain : ""))) },
        { key: "p", label: t("Held by"), get: (s) => h("span", { class: "small" }, who(db, s.person)) },
        { key: "v", label: t("Veto"), get: (s) => s.vetoDomain ? tag(t("veto") + " · " + s.vetoDomain, "tag-acc") : h("span", { class: "muted small" }, "—") },
        { key: "o", label: t("Role"), width: "110px", get: (s) => h("div", null,
            s.observer ? tag(t("observer"), "tag-out") : tag(t("voting"), "tag-soft"),
            s.active === false ? h("div", { class: "xs muted" }, t("retired")) : null) },
        { key: "c", label: t("Cannot be combined with"), get: (s) => (s.conflicts ?? []).length
            ? h("div", null, ...(s.conflicts ?? []).map((c) => h("div", { class: "xs", style: "display:flex;gap:6px;align-items:center" },
                h("span", null, "⟷ " + name(c.other) + (c.reason ? " — " + c.reason : "")),
                canManage ? h("button", { class: "btn btn-xs btn-ghost", title: t("Remove incompatibility"),
                  onClick: () => removeIncompatibility(s, c, name(c.other)) }, icon("x", 10)) : null)))
            : h("span", { class: "muted small" }, "—") },
        { key: "x", label: "", align: "r", width: "120px", get: (s) => !canManage ? null
          : h("div", { class: "btn-row", style: "justify-content:flex-end" },
              h("button", { class: "btn btn-xs", title: t("Declare an incompatibility"), onClick: () => addIncompatibility(db, s) }, "⟷"),
              h("button", { class: "btn btn-xs btn-ghost", title: t("Edit seat"), onClick: () => editSeat(db, s) }, icon("pencil", 11)),
              h("button", { class: "btn btn-xs btn-ghost", title: t("Remove seat"), onClick: () => removeSeat(s) }, icon("trash", 11))) },
      ], rows: seats,
      empty: t("No seat declared yet."),
    }) : h("div", { class: "small muted" },
      t("No seat declared. A seat carries a domain, sometimes a veto on it, and the seats it may never be combined with — the segregation of duties an auditor asks about first.")));
}

function editSeat(db, s) {
  formDialog({
    title: s ? t("Edit seat") : t("Declare a seat"), kicker: s ? s.id : t("Seats and vetoes"), wide: true,
    fields: [
      { key: "name", label: t("Seat"), required: true, span: 2, value: s?.name ?? "",
        hint: t("The role the committee knows it by — « Child safety officer », « Design authority ».") },
      { key: "person", label: t("Held by"), type: "select", value: s?.person ?? "", options: people(db),
        hint: t("The database refuses a person who already holds a seat declared incompatible with this one.") },
      { key: "domain", label: t("Domain"), value: s?.domain ?? "" },
      { key: "vetoDomain", label: t("Veto on"), value: s?.vetoDomain ?? "",
        hint: t("Empty: no veto. A veto is on a domain, never on everything — « child safety », or « G2 » for one gate only. An open objection from this seat in its domain blocks the gate.") },
      { key: "observer", label: t("Observer — voice, no vote"), type: "checkbox", value: !!s?.observer },
      ...(s ? [{ key: "active", label: t("Seat is sitting"), type: "checkbox", value: s.active !== false,
        hint: t("Untick to retire a seat that objections were lodged in: the record keeps its name.") }] : []),
    ],
    saveLabel: s ? t("Save") : t("Declare it"),
    onSave: (v) => {
      const body = { name: v.name, person: v.person || null, domain: v.domain, vetoDomain: v.vetoDomain, observer: !!v.observer };
      if (s) body.active = !!v.active;
      return App.write(s ? "Seat updated" : "Seat created", (a) => s
        ? a.patch("/seats/" + s.id, { ...body, version: s.version })
        : a.post("/seats", body), { detail: v.name, rethrow: true }).catch(() => false);
    },
  });
}
function addIncompatibility(db, s) {
  const taken = new Set((s.conflicts ?? []).map((c) => c.other).concat([s.id]));
  const others = (db.seats ?? []).filter((x) => !taken.has(x.id));
  formDialog({
    title: t("Declare an incompatibility"), kicker: s.name,
    fields: [
      { key: "other", label: t("Cannot be combined with"), type: "select", required: true, span: 2, value: others[0]?.id ?? "",
        options: others.map((x) => ({ value: x.id, label: x.name })) },
      { key: "reason", label: t("Why"), type: "textarea", rows: 2, span: 2, value: "",
        hint: t("The separation it protects — « the officer who must refuse a mechanic did not design it ». Refused if one person already holds both.") },
    ],
    saveLabel: t("Declare it"),
    onSave: (v) => App.write("Seat incompatibility declared", (a) => a.post("/seats/" + s.id + "/conflicts",
      { other: v.other, reason: v.reason }), { detail: s.name, rethrow: true }).catch(() => false),
  });
}
function removeIncompatibility(s, c, otherName) {
  confirmDialog({ title: t("Remove this incompatibility?"), confirmLabel: t("Remove"), danger: true,
    message: s.name + " ⟷ " + otherName, detail: t("Both directions are removed. One person could then hold both seats.") })
    .then((ok) => ok && App.write("Seat incompatibility removed", (a) => a.del("/seats/" + s.id + "/conflicts/" + c.other), { detail: s.name }));
}
function removeSeat(s) {
  confirmDialog({ title: t("Remove this seat?"), confirmLabel: t("Remove"), danger: true, message: s.name,
    detail: t("For a seat declared in error. One that objections were lodged in is retired instead, so the record keeps its name.") })
    .then((ok) => ok && App.write("Seat removed", (a) => a.del("/seats/" + s.id), { detail: s.name }));
}

/* ════════════════════════════════════════════════════════════════════
   MER-07 · objections, and what a decision costs to undo
   ════════════════════════════════════════════════════════════════════ */

export const REVERSAL = { low: "Low", medium: "Medium", high: "High — effectively one-way" };

/** The fields a decision form gains (meeting and register alike). */
export function decisionFields(db, projectId) {
  const evs = (db.evidence ?? []).filter((e) => !projectId || e.project === projectId);
  return [
    { key: "reversalCost", label: t("Cost to reverse"), type: "select", value: "",
      options: [{ value: "", label: t("Not stated") }].concat(Object.entries(REVERSAL).map(([value, l]) => ({ value, label: t(l) }))),
      hint: t("What undoing it would cost. Publishing under an open licence is one-way; descoping a gallery is not — a register that records only the rationale makes the two look alike.") },
    { key: "sourceEvidence", label: t("Source evidence"), type: "select", value: "", advanced: true,
      options: [{ value: "", label: t("None") }].concat(evs.map((e) => ({ value: e.id, label: e.id + " · " + e.name }))),
      hint: t("The evidence the decision rests on, from the project's evidence register.") },
  ];
}

/** One line under a decision: its cost to reverse, what it replaces, what it rests on. */
export function decisionFacts(d) {
  const bits = [];
  if (d.reversalCost) bits.push(t("cost to reverse") + ": " + t(REVERSAL[d.reversalCost] ?? d.reversalCost));
  if (d.supersedes) bits.push(t("supersedes") + " " + d.supersedes);
  if (d.sourceEvidence) bits.push(t("rests on") + " " + d.sourceEvidence);
  return bits.length ? h("div", { class: "xs muted", style: "margin-top:3px" }, bits.join(" · ")) : null;
}

const STATE_TAG = { open: "tag-soft", escalated: "tag-acc", resolved: "tag-ink", withdrawn: "tag-out" };

/**
 * The objections to one decision, with the acts each reader may take.
 * ctx: { scope } (a meeting's rbac scope) or { project } (a project row),
 *      and decidedBy — the person whose decision it is.
 */
export function objectionsFor(db, decisionId, ctx = {}) {
  const rows = (db.objections ?? []).filter((o) => o.decision === decisionId);
  const seatName = (id) => ((db.seats ?? []).find((s) => s.id === id) || {}).name || id;
  const mayRaise = App.can("objection.raise", { scope: ctx.scope ?? undefined, project: ctx.project ?? undefined });
  const mayResolve = App.can("objection.resolve", { decided_by: ctx.decidedBy ?? null });
  return h("div", { class: "objections", style: "margin-top:6px" },
    ...rows.map((o) => {
      const live = o.state === "open" || o.state === "escalated";
      const canOwn = live && App.can("objection.own", { raised_by: o.raisedBy });
      const due = live && o.escalatesOn && D(o.escalatesOn) <= D(db.statusDate);
      return h("div", { class: "xs", style: "display:flex;gap:8px;align-items:baseline;padding:3px 0" },
        tag(t(o.state), STATE_TAG[o.state] ?? ""),
        h("div", { style: "flex:1;min-width:0" },
          h("span", null, o.reason),
          h("span", { class: "muted" }, " — " + [o.seat ? seatName(o.seat) : who(db, o.raisedBy), o.domain, fmtDate(o.raisedOn)].filter(Boolean).join(" · ")),
          live && o.escalatesOn ? h("span", { class: due ? "bad strong" : "muted" }, " · " + t("escalates") + " " + fmtDate(o.escalatesOn)) : null,
          o.resolution ? h("div", { class: "muted" }, "→ " + o.resolution) : null),
        canOwn ? h("button", { class: "btn btn-xs btn-ghost", title: t("Reword objection"), onClick: () => editObjection(o) }, icon("pencil", 10)) : null,
        canOwn && o.state === "open" ? h("button", { class: "btn btn-xs", onClick: () => escalateObjection(o) }, t("Escalate")) : null,
        canOwn ? h("button", { class: "btn btn-xs btn-ghost", onClick: () => withdrawObjection(o) }, t("Withdraw")) : null,
        live && mayResolve ? h("button", { class: "btn btn-xs btn-primary", onClick: () => resolveObjection(o) }, t("Resolve")) : null);
    }),
    mayRaise ? h("button", { class: "btn btn-xs", style: "margin-top:4px", onClick: () => raiseObjection(db, decisionId, ctx) },
      icon("plus", 10), t("Object")) : null);
}

function raiseObjection(db, decisionId, ctx) {
  /* The seats this account may speak for: its own (deputy included), or
     any, at group level — the same rule the server applies. */
  const seats = (db.seats ?? []).filter((s) => s.active !== false &&
    App.can("objection.raise", { scope: ctx.scope ?? undefined, project: ctx.project ?? undefined, seat_person: s.person ?? null }));
  formDialog({
    title: t("Raise an objection"), kicker: decisionId, wide: true,
    fields: [
      { key: "reason", label: t("Reason"), type: "textarea", rows: 3, span: 2, required: true, value: "",
        hint: t("Reasoned, and within the domain. An objection without a reason is not an objection — it is a vote. The room reads this back.") },
      { key: "seat", label: t("In the name of a seat"), type: "select", value: "",
        options: [{ value: "", label: t("In my own name") }].concat(seats.map((s) => ({ value: s.id, label: s.name + (s.vetoDomain ? " (" + t("veto") + ")" : "") }))),
        hint: t("A seat with a veto in this domain blocks the gate until the objection is resolved.") },
      { key: "domain", label: t("Domain"), value: "", placeholder: t("the seat's veto domain, if empty") },
      { key: "escalatesOn", label: t("Escalates on"), type: "date", value: "",
        hint: t("Empty: one working week from today. Unresolved by then, it goes up.") },
    ],
    saveLabel: t("Object"),
    onSave: (v) => App.write("Objection raised", (a) => a.post("/decisions/" + decisionId + "/objections", {
      reason: v.reason, seat: v.seat || null, domain: v.domain, escalatesOn: v.escalatesOn || null,
    }), { detail: decisionId, rethrow: true }).catch(() => false),
  });
}
function editObjection(o) {
  formDialog({
    title: t("Reword objection"), kicker: o.id,
    fields: [
      { key: "reason", label: t("Reason"), type: "textarea", rows: 3, span: 2, required: true, value: o.reason,
        hint: t("Your own words, corrected. The trail keeps what it said before.") },
      { key: "domain", label: t("Domain"), value: o.domain ?? "" },
      { key: "escalatesOn", label: t("Escalates on"), type: "date", value: o.escalatesOn ?? "" },
    ],
    saveLabel: t("Save"),
    onSave: (v) => App.write("Objection updated", (a) => a.patch("/objections/" + o.id,
      { reason: v.reason, domain: v.domain, escalatesOn: v.escalatesOn || null, version: o.version }),
      { detail: o.id, rethrow: true }).catch(() => false),
  });
}
function resolveObjection(o) {
  formDialog({
    title: t("Resolve objection"), kicker: o.id,
    fields: [
      { key: "resolution", label: t("Resolution"), type: "textarea", rows: 3, span: 2, required: true, value: "",
        hint: t("How it was answered — what changed, or why the decision stands. The objector and the room will read this back.") },
    ],
    saveLabel: t("Resolve"),
    onSave: (v) => App.write("Objection resolved", (a) => a.post("/objections/" + o.id + "/resolve",
      { resolution: v.resolution, version: o.version }), { detail: o.id, rethrow: true }).catch(() => false),
  });
}
function escalateObjection(o) {
  confirmDialog({ title: t("Escalate this objection?"), confirmLabel: t("Escalate"), message: o.reason,
    detail: t("It goes to the level above the room, and stays live — a veto seat's escalated objection still blocks its gate.") })
    .then((ok) => ok && App.write("Objection escalated", (a) => a.post("/objections/" + o.id + "/escalate", { version: o.version }), { detail: o.id }));
}
function withdrawObjection(o) {
  confirmDialog({ title: t("Withdraw this objection?"), confirmLabel: t("Withdraw"), message: o.reason,
    detail: t("It stays on the record as withdrawn — that is how a board shows it heard it.") })
    .then((ok) => ok && App.write("Objection withdrawn", (a) => a.post("/objections/" + o.id + "/withdraw", { version: o.version }), { detail: o.id }));
}

/**
 * MEETINGS — the screen the v4 build had no equivalent of (D-04, R5).
 *
 * Three states, and the difference between them is the point:
 *
 *   scheduled  the agenda is a forecast. It changes as the portfolio does.
 *   open       you are in the room. Decisions and actions are recorded
 *              against this occurrence as they are taken (R5.10).
 *   closed     it is a record. The agenda is frozen, decisions are final,
 *              and next week's slippage cannot rewrite last week's
 *              minutes (R5.8).
 *
 * The data all comes from GET /meetings/occurrences/:id, which returns
 * the agenda, attendance, decisions, open actions and the roster in one
 * response — a chair opening this screen mid-call cannot afford four
 * round trips.
 */

import {
  h, clear, icon, dialog, confirmDialog, formDialog, table, sectionHead,
  emptyState, tag, avatar, selectField, ragDot,
} from "../ui/kit.js";
import { App, go, toast, reportError } from "../lib/state.js";
import { api, saveText } from "../lib/api.js";
import { t, tData } from "../lib/i18n.js";
import { Engine, fmtDate, fmtDateLong, isoWeek, iso, addDays, D, days } from "../../../shared/engine.js";

/* Cached between renders so switching series does not blank the screen. */
const cache = { series: null, detail: null, detailId: null, loading: false };

export function invalidateMeetings() {
  cache.series = null;
  cache.detail = null;
  cache.detailId = null;
}

/* ── loading ──────────────────────────────────────────────────────── */

async function ensureSeries() {
  if (cache.series || cache.loading) return;
  cache.loading = true;
  try {
    const { series } = await api.get("/meetings/series");
    cache.series = series;
    App.meetingBadge = series.reduce((n, s) => n + (s.openActions || 0), 0);
  } catch (e) {
    reportError(e, "Could not load the meeting calendar");
    cache.series = [];
  } finally {
    cache.loading = false;
    App.emit();
  }
}

async function ensureDetail(id) {
  if (!id || cache.detailId === id || cache.loading) return;
  cache.loading = true;
  try {
    cache.detail = await api.get("/meetings/occurrences/" + encodeURIComponent(id));
    cache.detailId = id;
  } catch (e) {
    reportError(e, "Could not open that meeting");
    cache.detail = null;
    cache.detailId = null;
  } finally {
    cache.loading = false;
    App.emit();
  }
}

/** Any write here invalidates both caches and re-reads. */
async function act(label, work, detail) {
  const id = cache.detailId;
  const ok = await App.write(label, work, { detail, refresh: false });
  if (ok) {
    cache.series = null;
    cache.detailId = null;
    await ensureSeries();
    await ensureDetail(id);
    await App.load().catch(() => {});
  }
  return ok;
}

/* ── the view ─────────────────────────────────────────────────────── */

export function meetingsView(db) {
  ensureSeries();
  if (!cache.series) {
    return h("div", { class: "sec" },
      h("div", { class: "kicker" }, "Meetings"),
      h("h3", null, "Loading the calendar…"));
  }
  if (!cache.series.length) {
    return emptyState("No meeting series in your scope",
      "A group or site administrator sets up the weekly delivery call and the monthly steering committee.");
  }

  const wanted = App.ui.meetingOccurrence;
  if (wanted) ensureDetail(wanted);
  else {
    // Default to the next live occurrence of the first series that has one.
    const first = cache.series.find((s) => s.next) ?? cache.series[0];
    if (first?.next) {
      App.ui.meetingOccurrence = first.next.id;
      ensureDetail(first.next.id);
    }
  }

  return h("div", { class: "split" },
    calendarPane(db),
    cache.detail && cache.detailId === App.ui.meetingOccurrence
      ? occurrencePane(db, cache.detail)
      : h("div", { class: "sec" }, h("div", { class: "kicker muted" }, "Loading the meeting…")));
}

/* ── left: the calendar ───────────────────────────────────────────── */

function calendarPane(db) {
  const weekly = cache.series.filter((s) => s.cadence === "weekly");
  const monthly = cache.series.filter((s) => s.cadence === "monthly");

  const group = (label, list) => list.length ? h("div", { style: "margin-bottom:18px" },
    h("div", { class: "kicker", style: "padding:0 0 6px" }, label),
    h("hr", { class: "hr" }),
    ...list.map((s) => {
      const on = cache.detail?.series?.id === s.id;
      const overdueNote = s.openActions
        ? s.openActions + " open action" + (s.openActions === 1 ? "" : "s")
        : "register clear";
      return h("button", {
        class: "list-row",
        style: "width:100%;text-align:left;background:" + (on ? "var(--color-surface)" : "none") +
               ";border:0;border-bottom:1px solid var(--rule-1);cursor:pointer;padding:10px 8px;" +
               "border-left:3px solid " + (on ? "var(--color-accent)" : "transparent"),
        onClick: () => {
          if (s.next) go("#/meetings/" + s.next.id);
          else if (s.last) go("#/meetings/" + s.last.id);
          else toast("Nothing scheduled", s.name + " has no upcoming occurrence");
        },
      },
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "strong small truncate" }, s.name),
          h("div", { class: "xs muted truncate" },
            s.scopeLabel + " · " + s.projectCount + " project" + (s.projectCount === 1 ? "" : "s") +
            " · " + overdueNote)),
        h("div", { style: "text-align:right;flex:none" },
          h("div", { class: "xs mono" }, s.next ? fmtDate(s.next.meetsOn) : "—"),
          s.canWrite
            ? h("div", { class: "xs muted" }, "you chair this")
            : h("div", { class: "xs muted" }, "read only")));
    })) : null;

  return h("div", { class: "pane", style: "min-width:290px;max-width:360px" },
    h("div", { class: "sec-tight" },
      h("div", { class: "kicker" }, "Cadence"),
      h("h3", { style: "margin:4px 0 2px" }, "Meeting calendar"),
      h("div", { class: "xs muted" },
        "An agenda is generated from portfolio state each time a meeting is opened.")),
    h("div", { class: "sec-tight", style: "padding-top:0" },
      group("Weekly delivery", weekly),
      group("Monthly steering", monthly),
      h("div", { class: "btn-row", style: "margin-top:8px;flex-direction:column" },
        h("button", {
          class: "btn btn-sm", style: "width:100%;justify-content:center",
          onClick: () => openActionsDialog(db),
        }, icon("clock", 12), "My open actions"),
        /* A cadence nobody can change is a cadence that goes stale the
           first time a programme reorganises. */
        App.can("series.manage", { scope: { scope_kind: "group" } }) || App.me.role !== "viewer"
          ? h("button", {
              class: "btn btn-sm", style: "width:100%;justify-content:center",
              onClick: () => seriesDialog(db, null),
            }, icon("plus", 12), "New meeting series")
          : null,
        cache.detail?.canWrite
          ? h("button", {
              class: "btn btn-sm", style: "width:100%;justify-content:center",
              onClick: () => seriesDialog(db, cache.detail.series),
            }, icon("pencil", 12), "Edit this series")
          : null)));
}

/* ── series management ────────────────────────────────────────────── */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function seriesDialog(db, existing) {
  const isNew = !existing;
  formDialog({
    title: isNew ? "New meeting series" : "Edit series",
    kicker: isNew ? "Cadence" : existing.id, wide: true,
    fields: [
      { key: "name", label: "Name", required: true, span: 2, value: existing?.name ?? "" },
      ...(isNew ? [
        { key: "cadence", label: "Cadence", type: "select", value: "weekly",
          options: [
            { value: "weekly", label: "Weekly — exception-only delivery call" },
            { value: "monthly", label: "Monthly — the steering pack" },
          ] },
        { key: "scope", label: "Scope", type: "select", value: "group",
          options: [{ value: "group", label: "Group — the whole portfolio" }]
            .concat(db.programmes.map((p) => ({ value: "programme:" + p.id, label: "Programme · " + p.name })))
            .concat(db.sites.map((s) => ({ value: "site:" + s.id, label: "Site · " + s.city }))),
          hint: "Scope decides both what the agenda covers and who may run it." },
      ] : []),
      { key: "chairId", label: "Chair", type: "select", value: existing?.chairId ?? App.me.personId ?? "",
        options: [{ value: "", label: "Unassigned" }]
          .concat(db.people.map((p) => ({ value: p.id, label: p.name + " — " + p.role }))) },
      { key: "weekday", label: "Day", type: "select", value: String(existing?.weekday ?? 1),
        options: WEEKDAYS.map((d, i) => ({ value: String(i), label: d })) },
      { key: "startTime", label: "Start", value: existing?.startTime ?? "09:00" },
      { key: "timeboxMin", label: "Timebox (minutes)", type: "number", min: 5, max: 240,
        value: existing?.timeboxMin ?? 25,
        hint: "The agenda is divided across its sections in proportion to weight; anything that will not fit is marked “if time allows”." },
      ...(isNew ? [] : [
        { key: "active", label: "Series is running", type: "checkbox", span: 2, value: existing.active !== false },
      ]),
    ],
    saveLabel: isNew ? "Create series" : "Save series",
    onSave: (v) => {
      if (isNew) {
        const [kind, target] = String(v.scope).split(":");
        return act("Meeting series created", (a) => a.post("/meetings/series", {
          name: v.name,
          cadence: v.cadence,
          scopeKind: kind === "group" ? "group" : kind,
          programmeId: kind === "programme" ? target : null,
          siteId: kind === "site" ? target : null,
          chairId: v.chairId || null,
          weekday: Number(v.weekday),
          startTime: v.startTime,
          timeboxMin: Number(v.timeboxMin),
        }), v.name);
      }
      return act("Meeting series updated", (a) => a.patch("/meetings/series/" + existing.id, {
        name: v.name, chairId: v.chairId || null, weekday: Number(v.weekday),
        startTime: v.startTime, timeboxMin: Number(v.timeboxMin),
        active: !!v.active, version: existing.version,
      }), v.name);
    },
  });
}

/** Put an extra occurrence on the calendar — an ad-hoc session, or the
    next one when a series has run dry. */
function scheduleOccurrence(d) {
  formDialog({
    title: "Schedule a meeting", kicker: d.series.name,
    fields: [
      { key: "meetsOn", label: "Date", type: "date", required: true,
        value: iso(addDays(new Date(), 7)) },
    ],
    saveLabel: "Schedule",
    onSave: (v) => act("Meeting scheduled",
      (a) => a.post("/meetings/series/" + d.series.id + "/occurrences", { meetsOn: v.meetsOn }),
      d.series.name + " — " + fmtDate(v.meetsOn)),
  });
}

/* ── right: the occurrence ────────────────────────────────────────── */

function occurrencePane(db, d) {
  const { series, occurrence, agenda, canWrite } = d;
  const closed = occurrence.status === "closed";
  const open = occurrence.status === "open";

  const stateTag = closed
    ? tag("Closed", "tag-out")
    : open ? tag("In session", "tag-red") : tag("Scheduled", "tag-out");

  const controls = h("div", { class: "btn-row" },
    canWrite && !closed && !open
      ? h("button", { class: "btn btn-primary btn-sm", onClick: () => openMeeting(d) },
          icon("arrowRight", 12), "Open the meeting")
      : null,
    canWrite && open
      ? h("button", { class: "btn btn-sm", onClick: () => recordDecision(db, d) },
          icon("check", 12), t("Record a decision"))
      : null,
    canWrite && open
      ? h("button", { class: "btn btn-sm", onClick: () => raiseAction(db, d) },
          icon("plus", 12), "Raise an action")
      : null,
    canWrite && open
      ? h("button", { class: "btn btn-sm", onClick: () => takeAttendance(db, d) },
          icon("menu", 12), t("Attendance"))
      : null,
    canWrite && open
      ? h("button", { class: "btn btn-primary btn-sm", onClick: () => closeMeeting(d) },
          icon("check", 12), t("Close the meeting"))
      : null,
    /* Before the call: the sendable pack. After the close: the minutes.
       (UX committee, value I-3 — artifacts are the currency of adoption.) */
    d.occurrence.status !== "closed"
      ? h("button", { class: "btn btn-sm", title: "Agenda + open actions + the slate, as one sendable document",
          onClick: () => pack(d) }, icon("download", 12), t("Meeting pack"))
      : null,
    h("button", { class: "btn btn-sm", onClick: () => minutes(d) }, icon("download", 12), t("Minutes")),
    /* R-10 — the same meeting in the reader's own calendar: one .ics for
       this occurrence, one for the whole series with its recurrence. */
    h("a", { class: "btn btn-sm", href: "/api/meetings/occurrences/" + d.occurrence.id + "/ics",
      download: d.occurrence.id + ".ics", title: t("Put this meeting in your calendar") }, "ICS"),
    h("a", { class: "btn btn-sm btn-ghost", href: "/api/meetings/series/" + d.series.id + "/ics",
      download: d.series.id + ".ics", title: t("Subscribe to the whole series") }, t("Series ICS")),
    h("button", { class: "btn btn-sm", onClick: () => window.print() }, icon("printer", 12), t("Print")));

  return h("div", { class: "pane sp" },
    h("div", { class: "sec-tight band" },
      h("div", { style: "display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap" },
        h("div", { style: "flex:1;min-width:240px" },
          h("div", { class: "kicker" },
            series.cadence === "weekly" ? "Weekly delivery call" : "Monthly steering committee"),
          h("h3", { style: "margin:4px 0 4px" }, series.name),
          h("div", { class: "small muted" },
            occurrence.periodLabel + " · " + fmtDateLong(occurrence.meetsOn) +
            " · " + series.startTime + " · " + series.timeboxMin + " minutes" +
            (agenda.scope ? " · " + agenda.scope : ""))),
        h("div", { style: "text-align:right" },
          stateTag,
          h("div", { class: "xs muted", style: "margin-top:6px" },
            closed
              ? "Frozen — this is the record"
              : open ? "Decisions are being recorded" : "Agenda updates as the portfolio moves"))),
      h("div", { style: "height:12px" }),
      controls,
      !canWrite
        ? h("div", { class: "xs muted", style: "margin-top:8px" },
            "You can read this meeting. Recording decisions and closing it is for the meeting's own scope.")
        : null),

    occurrenceHistory(d),
    agendaSection(db, d),
    decisionsSection(d),
    actionsSection(db, d),
    attendanceSection(d));
}

function occurrenceHistory(d) {
  return h("div", { class: "sec-tight", style: "padding-bottom:0" },
    h("button", {
      class: "btn btn-xs btn-ghost",
      onClick: async () => {
        try {
          const r = await api.get("/meetings/series/" + d.series.id + "/occurrences");
          historyDialog(d.series, r.occurrences);
        } catch (e) { reportError(e, "Could not load the history"); }
      },
    }, icon("clock", 11), "Earlier meetings in this series"),
    d.canWrite
      ? h("button", { class: "btn btn-xs btn-ghost", onClick: () => scheduleOccurrence(d) },
          icon("plus", 11), "Schedule another")
      : null);
}

function historyDialog(series, occurrences) {
  dialog({
    title: series.name, kicker: "Occurrences", wide: true,
    body: table({
      cols: [
        { key: "d", label: "Date", get: (o) => h("span", { class: "mono small" }, fmtDate(o.meetsOn)) },
        { key: "p", label: "Period", get: (o) => h("span", { class: "small" }, o.periodLabel) },
        { key: "s", label: "Status", get: (o) =>
            tag(o.status === "closed" ? "Closed" : o.status === "open" ? "In session" : "Scheduled",
              o.status === "open" ? "tag-red" : "tag-out") },
        { key: "c", label: "Closed", align: "r", get: (o) =>
            h("span", { class: "xs muted" }, o.closedAt ? o.closedAt.slice(0, 10) : "—") },
      ],
      rows: occurrences,
      onRow: (o) => { const b = document.querySelector(".backdrop"); if (b) b.remove(); go("#/meetings/" + o.id); },
      empty: "Nothing scheduled yet.",
    }),
  });
}

/* ── agenda ───────────────────────────────────────────────────────── */

function agendaSection(db, d) {
  const { agenda, occurrence } = d;
  const total = agenda.sections.reduce((n, s2) => n + s2.timeboxMin, 0);

  return h("section", { class: "sec" },
    sectionHead("Agenda",
      agenda.frozen
        ? "frozen at close — " + agenda.sections.length + " sections"
        : agenda.sections.length + " sections · " + total + " of " + agenda.timebox + " minutes allocated"),

    !agenda.frozen
      ? h("div", { class: "xs muted", style: "margin:-6px 0 14px" },
          "Generated from portfolio state as at " + fmtDate(agenda.asOf) +
          ". Sections with nothing to report are left out rather than shown empty.")
      : null,

    ...agenda.sections.map((sec) => h("div", { style: "margin-bottom:22px" },
      h("div", { style: "display:flex;align-items:baseline;gap:10px;flex-wrap:wrap" },
        h("span", { class: "num", style: "font-size:15px;min-width:20px" }, String(sec.seq ?? "·")),
        /* R-15 — the agenda arrives composed in English from the server;
           titles go through the dictionary, notes and details through the
           fragment translator, so a French room reads a French agenda
           without the server needing a locale per row. */
        h("h5", { style: "font-size:12.5px;letter-spacing:.09em;text-transform:uppercase;flex:1" }, t(sec.title)),
        sec.note ? h("span", { class: "xs muted" }, tData(sec.note)) : null,
        h("span", { class: "tag tag-out" },
          sec.timeboxMin + " min" + (sec.ifTimeAllows ? t(" · if time allows") : ""))),
      h("hr", { class: "hr", style: "margin:7px 0 10px" }),
      h("div", null, ...sec.items.map((it) => h("div", {
        class: "list-row",
        style: "align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--rule-1)" +
               (it.entity ? ";cursor:pointer" : ""),
        onClick: it.entity ? () => followItem(it) : null,
      },
        h("span", {
          class: "dot",
          style: { background: it.urgent ? "var(--color-accent)" : "var(--color-neutral-400)", "margin-top": "6px" },
        }),
        h("div", { style: "flex:1;min-width:0" },
          h("div", { class: "small strong" }, tData(it.headline)),
          it.detail ? h("div", { class: "xs muted" }, tData(it.detail)) : null))))))
  );
}

/** An agenda item is a pointer into the book; following it is the point. */
function followItem(it) {
  const routes = {
    project: (id) => "#/project/" + id,
    change_request: (id) => "#/change/" + id,
    raid_item: (id) => "#/risk/" + id,
    milestone: () => "#/schedule",
    activity: () => "#/schedule",
    person: () => "#/resources",
  };
  const r = routes[it.entity];
  if (r && it.entityId !== undefined) go(r(it.entityId));
}

/* ── decisions ────────────────────────────────────────────────────── */

function decisionsSection(d) {
  const { decisions, occurrence } = d;
  return h("section", { class: "sec", style: "padding-top:0" },
    sectionHead("Decisions", decisions.length ? decisions.length + " recorded" : "none recorded"),
    decisions.length
      ? h("div", null, ...decisions.map((x, i) => h("div", {
          style: "padding:12px 0;border-bottom:1px solid var(--rule-1)",
        },
          h("div", { style: "display:flex;gap:10px;align-items:baseline" },
            h("span", { class: "kicker acc", style: "min-width:34px" }, "D" + (i + 1)),
            h("div", { style: "flex:1;min-width:0" },
              h("div", { class: "strong small" }, x.headline),
              x.rationale ? h("div", { class: "small muted", style: "margin-top:3px;max-width:80ch" }, x.rationale) : null,
              h("div", { class: "xs muted", style: "margin-top:5px" },
                [x.projectId, x.crId, x.decidedByName ? "decided by " + x.decidedByName : null]
                  .filter(Boolean).join(" · ")))))))
      : h("p", { class: "small muted" },
          occurrence.status === "closed"
            ? "This meeting recorded no decisions."
            : "Decisions recorded here become part of the permanent record once the meeting closes."));
}

/* ── actions ──────────────────────────────────────────────────────── */

function actionsSection(db, d) {
  const { openActions, actionsRaisedHere, canWrite, occurrence } = d;
  const closed = occurrence.status === "closed";
  const asOf = occurrence.meetsOn;

  return h("section", { class: "sec", style: "padding-top:0" },
    sectionHead("Actions",
      openActions.length + " open across this series" +
      (actionsRaisedHere.length ? " · " + actionsRaisedHere.length + " raised here" : "")),
    openActions.length
      ? table({
          cols: [
            { key: "t", label: "Action", get: (a) => h("div", null,
                h("div", { class: "small strong" }, a.title),
                h("div", { class: "xs muted" },
                  (a.projectId ? a.projectId + " · " : "") + "raised in " + a.raisedIn)) },
            { key: "o", label: "Owner", get: (a) => h("span", { class: "small" }, a.ownerName ?? "—") },
            { key: "d", label: "Due", align: "r", get: (a) => h("span", {
                class: "mono small",
                style: a.dueDate && D(a.dueDate) < D(asOf) ? "color:var(--sig-red);font-weight:600" : null,
              }, a.dueDate ? fmtDate(a.dueDate) : "—") },
            { key: "s", label: "Status", align: "c", get: (a) => tag(a.status, "tag-out") },
            { key: "x", label: "", align: "r", get: (a) => canWrite && !closed
                ? h("div", { class: "btn-row" },
                    a.status !== "Done"
                      ? h("button", {
                          class: "btn btn-xs",
                          onClick: (e) => { e.stopPropagation(); completeAction(a); },
                        }, "Done")
                      : null,
                    h("button", {
                      class: "btn btn-xs btn-ghost",
                      onClick: (e) => { e.stopPropagation(); editAction(db, a); },
                    }, icon("pencil", 11)))
                : null },
          ],
          rows: openActions,
          empty: "Register is clear.",
        })
      : h("p", { class: "small muted" }, "Nothing outstanding. The register is clear."));
}

/* ── attendance ───────────────────────────────────────────────────── */

function attendanceSection(d) {
  const { attendance, occurrence } = d;
  if (!attendance.length) {
    return h("section", { class: "sec", style: "padding-top:0" },
      sectionHead("Attendance", "not recorded"),
      h("p", { class: "small muted" },
        occurrence.status === "closed"
          ? "No attendance was recorded for this meeting."
          : "Record who is in the room once the meeting is open."));
  }
  const byState = (st) => attendance.filter((a) => a.state === st);
  const named = (st) => attendance.filter((a) => a.state === st);
  const block = (label, list) => list.length
    ? h("div", { style: "margin-bottom:12px" },
        h("div", { class: "kicker" }, label + " (" + list.length + ")"),
        h("div", { class: "chips", style: "margin-top:6px" },
          ...list.map((a) => h("span", { class: "tag tag-out" },
            a.personName + (a.deputyForName ? " for " + a.deputyForName : "")))))
    : null;

  return h("section", { class: "sec", style: "padding-top:0" },
    sectionHead("Attendance", attendance.length + " recorded"),
    block("Present", byState("present")),
    block("Deputising", byState("deputy")),
    block("Apologies", byState("apologies")),
    block("Absent", byState("absent")));
}

/* ── write actions ────────────────────────────────────────────────── */

function openMeeting(d) {
  act("Meeting opened",
    (a) => a.post("/meetings/occurrences/" + d.occurrence.id + "/open"),
    d.series.name + " — " + fmtDate(d.occurrence.meetsOn));
}

function closeMeeting(d) {
  confirmDialog({
    title: "Close this meeting?",
    message: "The agenda is frozen as it stands, the decisions become final, and the next occurrence is scheduled.",
    detail: "Nothing recorded here can be changed afterwards.",
    confirmLabel: "Close the meeting",
  }).then((ok) => {
    if (!ok) return;
    formDialog({
      title: "Chair's notes", kicker: "Optional",
      fields: [{ key: "notes", label: "Anything the minutes should carry", type: "textarea", rows: 4, span: 2, value: "" }],
      saveLabel: "Close the meeting",
      onSave: (v) => act("Meeting closed",
        (a) => a.post("/meetings/occurrences/" + d.occurrence.id + "/close", { notes: v.notes }),
        "Agenda frozen; next occurrence scheduled"),
    });
  });
}

function recordDecision(db, d) {
  const scoped = db.projects;
  const pending = db.crs.filter((c) => c.status === "Pending");
  const isSite = d.series.scopeKind === "site";
  const isGroup = d.series.scopeKind === "group";
  /* Open referrals addressed to this level surface on the agenda; a
     decision here may name the one it answers, which retires it
     (governance committee, rhythm-1). */
  const referralItems = (d.agenda?.sections || [])
    .filter((s) => s.key === "referrals")
    .flatMap((s) => s.items.map((it) => ({ value: it.entityId, label: it.headline })));
  formDialog({
    title: "Record a decision", kicker: d.series.name, wide: true,
    fields: [
      { key: "headline", label: "The decision", required: true, span: 2 },
      { key: "rationale", label: "Why — the committee has to be able to read this back", type: "textarea", rows: 3, span: 2 },
      { key: "projectId", label: "Project", type: "select", value: "",
        options: [{ value: "", label: "Not project-specific" }]
          .concat(scoped.map((p) => ({ value: p.id, label: p.id + " · " + p.name }))) },
      { key: "crId", label: "Change request", type: "select", value: "",
        options: [{ value: "", label: t("None") }]
          .concat(pending.map((c) => ({ value: c.id, label: c.id + " · " + c.title }))) },
      { key: "decidedBy", label: "Taken by", type: "select", value: d.series.chairId ?? "",
        options: db.people.map((p) => ({ value: p.id, label: p.name })) },
      /* The act of escalation the site chair never had (rhythm-1). */
      ...(!isGroup ? [{
        key: "refer", label: t("Refer upward"), type: "select", value: "",
        options: [
          { value: "", label: t("No — this room decides") },
          { value: "group", label: t("Refer to the group steering committee") },
          ...(isSite ? [{ value: "programme", label: t("Refer to the programme board") }] : []),
        ],
        hint: "A referral headlines the broader room's next agenda until its decision answers it.",
      }] : []),
      ...(referralItems.length ? [{
        key: "answers", label: t("Answers a referral"), type: "select", value: "",
        options: [{ value: "", label: t("None") }].concat(referralItems),
        hint: "Naming the referral retires it from future agendas.",
      }] : []),
    ],
    saveLabel: t("Record decision"),
    onSave: (v) => act(v.refer ? "Decision referred" : "Decision recorded",
      (a) => a.post("/meetings/occurrences/" + d.occurrence.id + "/decisions", {
        headline: v.headline, rationale: v.rationale,
        projectId: v.projectId || null, crId: v.crId || null, decidedBy: v.decidedBy || null,
        refer: !!v.refer, referTo: v.refer || null, answers: v.answers || null,
      }),
      v.headline),
  });
}

function raiseAction(db, d) {
  formDialog({
    title: "Raise an action", kicker: d.series.name, wide: true,
    fields: [
      { key: "title", label: "Action", required: true, span: 2 },
      { key: "detail", label: "Detail", type: "textarea", rows: 2, span: 2 },
      { key: "ownerId", label: "Owner", type: "select", required: true,
        value: d.series.chairId ?? (db.people[0] || {}).id,
        options: db.people.map((p) => ({ value: p.id, label: p.name + " — " + p.role })) },
      { key: "dueDate", label: "Due", type: "date", value: iso(addDays(d.occurrence.meetsOn, 7)) },
      { key: "projectId", label: "Project", type: "select", value: "", span: 2,
        options: [{ value: "", label: "Not project-specific" }]
          .concat(db.projects.map((p) => ({ value: p.id, label: p.id + " · " + p.name }))) },
    ],
    saveLabel: "Raise action",
    onSave: (v) => act("Action raised",
      (a) => a.post("/meetings/occurrences/" + d.occurrence.id + "/actions", {
        title: v.title, detail: v.detail, ownerId: v.ownerId,
        dueDate: v.dueDate || null, projectId: v.projectId || null,
      }),
      v.title),
  });
}

function completeAction(a) {
  act("Action closed",
    (x) => x.patch("/meetings/actions/" + a.id, { status: "Done", version: a.version }),
    a.title);
}

function editAction(db, a) {
  formDialog({
    title: "Edit action", kicker: a.id, wide: true,
    fields: [
      { key: "title", label: "Action", required: true, span: 2, value: a.title },
      { key: "ownerId", label: "Owner", type: "select", value: a.ownerId ?? "",
        options: db.people.map((p) => ({ value: p.id, label: p.name })) },
      { key: "dueDate", label: "Due", type: "date", value: a.dueDate ?? "" },
      { key: "status", label: "Status", type: "select", value: a.status, span: 2,
        options: ["Open", "In progress", "Done", "Cancelled"].map((x) => ({ value: x, label: x })) },
    ],
    saveLabel: "Save action",
    onSave: (v) => act("Action updated",
      (x) => x.patch("/meetings/actions/" + a.id, {
        title: v.title, ownerId: v.ownerId || null,
        dueDate: v.dueDate || null, status: v.status, version: a.version,
      }),
      a.id),
  });
}

async function takeAttendance(db, d) {
  const roster = d.people;
  const current = new Map(d.attendance.map((a) => [a.personId, a.state]));
  const chosen = new Map(current);

  const rows = roster.map((p) => {
    const seg = h("div", { class: "seg" }, ...["present", "deputy", "apologies", "absent"].map((state) =>
      h("button", {
        class: "seg-opt" + (chosen.get(p.id) === state ? " on" : ""),
        onClick: (e) => {
          e.preventDefault();
          if (chosen.get(p.id) === state) chosen.delete(p.id);
          else chosen.set(p.id, state);
          [...seg.children].forEach((c, i) =>
            c.classList.toggle("on", chosen.get(p.id) === ["present", "deputy", "apologies", "absent"][i]));
        },
      }, state[0].toUpperCase() + state.slice(1))));
    return h("div", { class: "list-row", style: "gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-1)" },
      avatar(db, p.id, "sm"),
      h("div", { style: "flex:1;min-width:0" },
        h("div", { class: "small strong truncate" }, p.name),
        h("div", { class: "xs muted truncate" }, p.role + " · " + p.site)),
      seg);
  });

  dialog({
    title: "Attendance", kicker: d.series.name + " · " + fmtDate(d.occurrence.meetsOn), wide: true,
    body: h("div", { style: "max-height:56vh;overflow-y:auto" }, ...rows),
    actions: [
      h("button", { class: "btn", onClick: () => { const b = document.querySelector(".backdrop"); if (b) b.remove(); } }, "Cancel"),
      h("button", {
        class: "btn btn-primary",
        onClick: () => {
          const b = document.querySelector(".backdrop"); if (b) b.remove();
          act("Attendance recorded",
            (a) => a.post("/meetings/occurrences/" + d.occurrence.id + "/attendance", {
              attendance: [...chosen].map(([personId, state]) => ({ personId, state })),
            }),
            [...chosen.values()].filter((x) => x === "present").length + " present");
        },
      }, "Save attendance"),
    ],
  });
}

async function pack(d) {
  try {
    const { markdown } = await api.get("/meetings/occurrences/" + d.occurrence.id + "/pack");
    dialog({
      title: "Meeting pack", kicker: d.series.name + " · " + fmtDate(d.occurrence.meetsOn), wide: true,
      body: h("pre", {
        style: "white-space:pre-wrap;font-family:var(--font-body);font-size:12.5px;line-height:1.6;" +
               "max-height:60vh;overflow-y:auto;margin:0",
      }, markdown),
      actions: [
        h("button", {
          class: "btn",
          onClick: () => {
            navigator.clipboard?.writeText(markdown)
              .then(() => toast("Copied", "The pack is on the clipboard"))
              .catch(() => toast("Could not copy", "Use the download instead", true));
          },
        }, "Copy"),
        h("button", {
          class: "btn btn-primary",
          onClick: () => saveText("pack-" + d.occurrence.id + ".md", markdown, "text/markdown"),
        }, icon("download", 12), "Download Markdown"),
      ],
    });
  } catch (e) {
    reportError(e, "meeting pack");
  }
}

async function minutes(d) {
  try {
    const { markdown } = await api.get("/meetings/occurrences/" + d.occurrence.id + "/minutes");
    dialog({
      title: "Minutes", kicker: d.series.name + " · " + fmtDate(d.occurrence.meetsOn), wide: true,
      body: h("pre", {
        style: "white-space:pre-wrap;font-family:var(--font-body);font-size:12.5px;line-height:1.6;" +
               "max-height:60vh;overflow-y:auto;margin:0",
      }, markdown),
      actions: [
        h("button", {
          class: "btn",
          onClick: () => {
            navigator.clipboard?.writeText(markdown)
              .then(() => toast("Copied", "Minutes are on the clipboard"))
              .catch(() => toast("Could not copy", "Use the download instead", true));
          },
        }, "Copy"),
        h("button", {
          class: "btn btn-primary",
          onClick: () => saveText("minutes-" + d.occurrence.id + ".md", markdown, "text/markdown"),
        }, icon("download", 12), "Download Markdown"),
      ],
    });
  } catch (e) {
    reportError(e, "Could not render the minutes");
  }
}

async function openActionsDialog(db) {
  try {
    const { actions } = await api.get("/meetings/actions?status=Open");
    const mine = App.me.personId ? actions.filter((a) => a.ownerId === App.me.personId) : [];
    const show = mine.length ? mine : actions;
    dialog({
      title: mine.length ? "Your open actions" : "Open actions in your scope",
      kicker: show.length + " outstanding", wide: true,
      body: show.length
        ? table({
            cols: [
              { key: "t", label: "Action", get: (a) => h("div", null,
                  h("div", { class: "small strong" }, a.title),
                  h("div", { class: "xs muted" }, a.seriesName)) },
              { key: "o", label: "Owner", get: (a) => h("span", { class: "small" }, a.ownerName ?? "—") },
              { key: "d", label: "Due", align: "r", get: (a) => h("span", { class: "mono small" },
                  a.dueDate ? fmtDate(a.dueDate) : "—") },
            ],
            rows: show,
          })
        : h("p", { class: "small muted" }, "Nothing outstanding."),
    });
  } catch (e) {
    reportError(e, "Could not load the action register");
  }
}

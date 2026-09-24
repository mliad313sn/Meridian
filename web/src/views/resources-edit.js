/**
 * RESOURCES — the assignment and rate forms, loaded on first use.
 *
 * Moved out of views/resources.js unchanged (FX-08 bis): the main bundle
 * is at its D-41.03 cap (docs/36 NEW-25), and a form opened by a click can
 * wait for its code. Same fields, same help, same audited writes.
 */

import { formDialog } from "../ui/kit.js";
import { App } from "../lib/state.js";
import { t } from "../lib/i18n.js";

/* The fields rbac reads, from the serialiser's shape (index.js asRow). */
const row = (p) => p && ({ id: p.id, programme_id: p.programme, site_id: p.site,
  governance_level: p.governanceLevel, closed: p.closed });

export function editAssignment(db, x) {
  const ids = new Set(db.projects.filter((p) => App.can("allocation.write", { project: row(p) })).map((p) => p.id));
  const activities = db.activities.filter((a) => ids.has(a.project));
  const fields = [
    ...(x ? [] : [{ key: "activity", label: t("Activity"), type: "select", required: true, span: 2,
      options: [{ value: "", label: "—" }, ...activities.map((a) => ({ value: a.id, label: a.project + " · " + a.name }))] }]),
    { key: "person", label: t("Person"), type: "select", value: x?.person ?? "",
      options: [{ value: "", label: "—" }, ...db.people.filter((p) => p.active !== false).map((p) => ({ value: p.id, label: p.name }))] },
    { key: "role", label: t("Role"), value: x?.role ?? "", hint: t("A person or a role, never both.") },
    { key: "units", label: t("Units (%)"), type: "number", min: 1, max: 200, step: 5, required: true, value: x?.units ?? 100,
      hint: t("50 = half-time, 200 = two people.") },
    { key: "work", label: t("Work (person-days)"), type: "number", min: 0, step: 0.5, value: x?.work ?? "",
      hint: t("Empty = duration × units.") },
    { key: "note", label: t("Note"), type: "textarea", span: 2, value: x?.note ?? "", advanced: true,
      hint: t("Shifts, conditions.") },
  ];
  formDialog({
    title: x ? t("Edit") : t("Assign"), kicker: x ? x.activity : "", fields, saveLabel: t("Save"),
    onSave: (v) => {
      const role = String(v.role ?? "").trim();
      if (!v.person === !role) { App.lastWriteError = new Error(t("A person or a role, never both.")); return false; }
      const body = { person: v.person || null, role: v.person ? null : role, units: +v.units,
        work: v.work === "" || v.work == null ? null : +v.work, note: v.note ?? "" };
      return x
        ? App.write(t("Assignment updated"), (a) => a.patch("/assignments/" + x.id, { ...body, version: x.version }),
            { touch: ["assignments"], rethrow: true })
        : App.write(t("Assignment added"), (a) => a.post("/assignments", { ...body, activity: v.activity }),
            { touch: ["assignments"], rethrow: true });
    },
  });
}

export function editRate(db, r) {
  formDialog({
    title: r ? t("Edit") : t("Add rate"), kicker: t("Rates"), saveLabel: t("Save"),
    fields: [
      { key: "person", label: t("Person"), type: "select", value: r?.person ?? "",
        options: [{ value: "", label: "—" }, ...db.people.map((p) => ({ value: p.id, label: p.name }))] },
      { key: "role", label: t("Role"), value: r?.role ?? "", hint: t("A person or a role, never both.") },
      { key: "dayRate", label: t("Day rate"), type: "number", min: 0, step: 10, required: true, value: r?.dayRate ?? "",
        hint: t("Whole units of the currency.") },
      { key: "currency", label: t("Currency"), value: r?.currency ?? "USD" },
      { key: "fx", label: "FX", type: "number", min: 0, step: 0.0001, value: r?.fx ?? 1, advanced: true,
        hint: t("Per unit, in the reporting currency.") },
      { key: "from", label: t("From"), type: "date", required: true, value: r?.from ?? App.db.statusDate },
      { key: "to", label: t("To"), type: "date", value: r?.to ?? "" },
      { key: "note", label: t("Note"), type: "textarea", span: 2, value: r?.note ?? "", advanced: true,
        hint: t("Its source (contract).") },
    ],
    onSave: (v) => {
      const body = { person: v.person || null, role: v.person ? null : String(v.role ?? "").trim(), dayRate: +v.dayRate,
        currency: v.currency, fx: +v.fx || 1, from: v.from, to: v.to || null, note: v.note ?? "" };
      return r
        ? App.write(t("Rate updated"), (a) => a.patch("/rates/" + r.id, { ...body, version: r.version }), { touch: ["rates"], rethrow: true })
        : App.write(t("Rate set"), (a) => a.post("/rates", body), { touch: ["rates"], rethrow: true });
    },
  });
}

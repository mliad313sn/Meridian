/**
 * FX-13 — the MS Project import dialog: file, programme, site, the dry
 * run and its report, then the import. Split from msproject.js and loaded
 * when the button is pressed (D-41.03: the bundle every site downloads
 * stays under its cap).
 */

import { h, icon, dialog, formDialog } from "../ui/kit.js";
import { App, go, reportError } from "../lib/state.js";
import { api, download } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { isTeam } from "../../../shared/sitekind.js";
import { mayCreate, levels } from "./msproject.js";

export function importDialog(db) {
  const progs = db.programmes.filter((pr) => db.sites.some((s) => mayCreate(db, pr, s)));
  const sites = db.sites.filter((s) => progs.some((pr) => mayCreate(db, pr, s)));
  let xml = "";
  const picked = h("span", { class: "small muted" }, "");
  const extra = h("div", { class: "field full" },
    h("label", null, t("MS Project file (.xml)")),
    h("label", { class: "btn btn-sm", style: "cursor:pointer;width:max-content" }, t("Choose file…"),
      h("input", { type: "file", accept: ".xml,application/xml,text/xml", style: "display:none",
        onChange: (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const rd = new FileReader();
          rd.onload = () => { xml = String(rd.result ?? ""); picked.textContent = file.name; };
          rd.readAsText(file);
        } })),
    picked,
    h("div", { class: "small muted" },
      t("In MS Project: File → Save As → XML. The file is checked first; nothing is written until you confirm.")));

  formDialog({
    title: t("Import MS Project plan"), kicker: t("New project"), wide: true, extra,
    saveLabel: t("Check the file"),
    fields: [
      { key: "programme", label: t("Programme"), type: "select", value: progs[0]?.id,
        options: progs.map((x) => ({ value: x.id, label: x.name })),
        hint: t("The imported plan becomes a new project of this programme, with its gates.") },
      { key: "site", label: t("Lead site"), type: "select", value: sites[0]?.id,
        options: sites.map((x) => ({ value: x.id, label: x.city + " · " + (isTeam(x) ? t("Team") : x.region) })),
        hint: t("A calendar identical to the site's is inherited rather than copied.") },
      { key: "governanceLevel", label: t("Governance"), type: "select", value: levels()[0],
        options: levels().map((l) => ({ value: l, label: l === "group" ? t("Group") : t("Site") })),
        hint: t("A group project is run by the group and is read-only to a site. A site project belongs to its site.") },
      { key: "name", label: t("Project name"), span: 2, value: "",
        hint: t("Leave empty to keep the plan's own title.") },
      { key: "method", label: t("Delivery method"), type: "select", value: "Waterfall",
        options: ["Waterfall", "Agile", "Hybrid"] },
      { key: "budget", label: t("Budget ($M)"), type: "number", step: 0.1, min: 0, value: "",
        hint: t("MS Project costs are not imported: the budget is the envelope earned value is measured against.") },
    ],
    onSave: async (v) => {
      if (!xml.trim()) { App.lastWriteError = new Error(t("Choose the XML file saved from MS Project.")); return false; }
      const body = { xml, programme: v.programme, site: v.site, governanceLevel: v.governanceLevel, name: v.name,
        method: v.method, budget: v.budget === "" ? 0 : +v.budget };
      try {
        const dry = await api.post("/import/mspdi", { ...body, dryRun: true });
        reportDialog(dry, body);
        return true;
      } catch (e) { App.lastWriteError = e; return false; }
    },
  });
}

const LEVELS = [
  ["blocking", "Blocking", "bad"],
  ["ignored", "Ignored", ""],
  ["approximated", "Approximated", ""],
  ["mapped", "Mapped", "muted"],
];

function reportDialog(dry, body) {
  const c = dry.counts ?? {};
  const list = dry.report ?? [];
  const group = ([level, label, cls]) => {
    const items = list.filter((x) => x.level === level);
    if (!items.length) return null;
    return h("div", { style: "margin-top:12px" },
      h("div", { class: "kicker" + (cls ? " " + cls : "") }, t(label) + " · " + items.length),
      ...items.map((x) => h("div", { class: "small", style: "padding:3px 0;border-bottom:1px solid var(--line)" },
        h("span", { class: "strong" }, x.subject), " — ", h("span", { class: cls || "muted" }, x.detail))));
  };
  dialog({
    title: t("What the import will do"), kicker: dry.project?.name ?? "", wide: true,
    body: h("div", null,
      h("div", { class: "small" },
        [[c.tasks, "stages"], [c.milestones, "milestones"], [c.links, "links"],
         [c.assignments, "assignments"], [c.baselines, "baselines"]]
          .map(([n, w]) => (n ?? 0) + " " + t(w)).join(" · ")),
      dry.ok ? null : h("div", { class: "small bad strong", style: "margin-top:8px" },
        t("Nothing will be written until the blocking items are resolved.")),
      ...LEVELS.map(group)),
    actions: (close) => [
      h("button", { class: "btn", onClick: close }, t("Cancel")),
      dry.ok ? h("button", { class: "btn btn-primary", onClick: async () => {
        close();
        const id = await App.write("Project imported from MS Project",
          async (a) => (await a.post("/import/mspdi", body)).id, { detail: dry.project?.name });
        if (id && id !== true) go("#/project/" + id);
      } }, t("Import")) : null,
    ],
  });
}

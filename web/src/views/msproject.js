/**
 * FX-13 — MS Project in and out, on screen (docs/41 §3).
 *
 *   exportButton(p)      on the project view: the plan as an MSPDI .xml
 *   importButton(db)     on the project register: an MSPDI file becomes a
 *                        NEW project — checked first (dry run), the
 *                        report read, then imported on confirmation
 *
 * The mapping and the report are the server's (server/src/mspdi.js); the
 * report's sentences arrive in the reader's language (X-Lang). Authority
 * is read from shared/rbac.js through App.can: the import is offered to
 * whoever may create a project somewhere, and the server asks
 * `project.create` again for the programme and site chosen here.
 */

import { h, icon, dialog, formDialog } from "../ui/kit.js";
import { App, go, reportError } from "../lib/state.js";
import { api, download } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { isTeam } from "../../../shared/sitekind.js";

export function exportButton(p) {
  return h("button", { class: "btn btn-sm", title: t("Tasks, links, calendar, resources and baselines, as MS Project reads them"),
    onClick: () => download("/projects/" + p.id + "/mspdi", p.id + ".xml")
      .catch((e) => reportError(e, t("Export to MS Project (.xml)"))) },
  icon("download", 12), t("Export to MS Project (.xml)"));
}

/* Where this account may create a project at all — the same question the
   "New project" action asks. */
export const levels = () => (App.me.role === "site" ? ["site"] : ["group", "site"]);
export const mayCreate = (db, pr, s) => levels().some((l) => App.can("project.create",
  { programme_id: pr.id, site_id: s.id, governance_level: l }));

export function importButton(db) {
  if (!db.programmes.some((pr) => db.sites.some((s) => mayCreate(db, pr, s)))) return null;
  return h("button", { class: "btn btn-sm", onClick: () => import("./msproject-dialog.js").then((m) => m.importDialog(db)) }, icon("upload", 12), t("Import MS Project plan"));
}


/**
 * ADMINISTRATION — accounts, access grants and the directory.
 *
 * The whole `/admin` API existed and nothing called it: an administrator
 * could not create a user, grant access, reset a password or correct a
 * person's record without curl. The access model the system is built
 * around had no screen (operational review, finding 3).
 *
 * What replaced it also fixes finding 2: the old "Roles & access" table
 * listed five job titles and counted people by a regex on their job
 * description. It described an access model the system does not have.
 * This panel shows the four levels that are actually enforced, and the
 * real accounts holding them.
 */

import {
  h, clear, icon, dialog, confirmDialog, formDialog, table, sectionHead,
  tag, avatar, searchBox, emptyState,
} from "../ui/kit.js";
import { App, toast, reportError } from "../lib/state.js";
import { api } from "../lib/api.js";
import { Engine, fmtDate, money, uniq } from "../../../shared/engine.js";

/* Fetched on demand; invalidated by every write below. */
const state = { users: null, loading: false, q: "", tab: "accounts" };

export function invalidateAdmin() { state.users = null; }

/* ── notifications (V-12) ─────────────────────────────────────────────
   The queue, and whether anything can actually send it. An instance with
   no mail server still shows people exactly what they would have been
   told — which is the honest state, and is also how an operator checks
   the sweep is finding the right things before pointing it at a relay. */

const notifyState = { data: null, loading: false };

/* ── reprise de l'existant (R-09) ─────────────────────────────────────
   Le chemin des tableurs vers l'outil : modèle, prévisualisation ligne
   par ligne, application tout-ou-rien. Le fichier se colle ou se choisit;
   rien ne s'écrit avant que la prévisualisation ne soit lue. */

const importState = { kind: "projects", csv: "", preview: null, busy: false };

export function importPanel() {
  const setCsv = (text) => { importState.csv = text; importState.preview = null; App.emit(); };

  const runPreview = async () => {
    importState.busy = true; App.emit();
    try {
      importState.preview = await api.post("/import/preview",
        { kind: importState.kind, csv: importState.csv });
    } catch (e) { importState.preview = null; reportError(e, "Prévisualisation"); }
    importState.busy = false; App.emit();
  };
  const runApply = async () => {
    const ok = await App.write("Reprise appliquée", (a) => a.post("/import/apply",
      { kind: importState.kind, csv: importState.csv }),
      { detail: importState.kind });
    if (ok !== false) { importState.csv = ""; importState.preview = null; }
  };

  const p = importState.preview;
  return h("div", null,
    sectionHead("Reprise de l'existant", "projets, personnes, jalons — depuis vos tableurs (CSV)"),
    h("div", { class: "small muted", style: "max-width:64ch;margin-bottom:10px" },
      "Téléchargez le modèle, remplissez-le, collez-le ici. La prévisualisation dit ce qui sera créé et ce qui sera refusé, ligne par ligne ; l'application est tout ou rien."),
    h("div", { style: "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px" },
      selectField("Nature", importState.kind, [
        { value: "projects", label: "Projets" }, { value: "people", label: "Personnes" },
        { value: "milestones", label: "Jalons" }],
        (v) => { importState.kind = v; importState.preview = null; App.emit(); }, "150px"),
      h("a", { class: "btn btn-sm", href: "/api/import/template?kind=" + importState.kind,
        download: "modele-" + importState.kind + ".csv" }, "Modèle CSV"),
      h("label", { class: "btn btn-sm", style: "cursor:pointer" }, "Choisir un fichier…",
        h("input", { type: "file", accept: ".csv,text/csv", style: "display:none",
          onChange: (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const rd = new FileReader();
            rd.onload = () => setCsv(String(rd.result ?? ""));
            rd.readAsText(file);
          } }))),
    h("textarea", { class: "input", rows: 6, placeholder: "name,programme,site,…",
      value: importState.csv, onInput: (e) => { importState.csv = e.target.value; importState.preview = null; } }),
    h("div", { class: "btn-row", style: "margin-top:10px" },
      h("button", { class: "btn btn-sm", disabled: !importState.csv.trim() || importState.busy,
        onClick: runPreview }, importState.busy ? "Analyse…" : "Prévisualiser"),
      p && p.refused === 0 && p.creatable > 0 && App.can("data.import")
        ? h("button", { class: "btn btn-sm btn-primary", onClick: runApply },
            "Appliquer — " + p.creatable + " création(s)")
        : null),
    p ? h("div", { style: "margin-top:12px" },
        h("div", { class: "small", style: "margin-bottom:6px" },
          h("span", { class: "strong" }, p.creatable + " à créer"),
          " · ", h("span", { class: p.refused ? "bad strong" : "muted" }, p.refused + " refusée(s)"),
          p.refused ? h("span", { class: "muted" }, " — rien ne sera écrit tant que le fichier n'est pas propre") : null),
        ...p.rows.filter(x => !x.willCreate).slice(0, 12).map(x =>
          h("div", { class: "xs", style: "color:var(--sig-red);padding:2px 0" },
            "ligne " + x.line + (x.name ? " · " + x.name : "") + " — " + x.errors.join(" ; "))))
      : null);
}

export function notificationsPanel() {
  if (!notifyState.data && !notifyState.loading) {
    notifyState.loading = true;
    api.get("/admin/notifications")
      .then((d) => { notifyState.data = d; })
      .catch(() => { notifyState.data = { failed: true, notifications: [], counts: {} }; })
      .finally(() => { notifyState.loading = false; App.emit(); });
  }
  const d = notifyState.data;
  if (!d) return h("div", { class: "small muted" }, "Loading the queue…");
  if (d.failed) return h("div", { class: "small muted" }, "The queue could not be read — refresh to try again.");

  const c = d.counts ?? {};
  return h("div", null,
    sectionHead("Notifications",
      d.transport === "configured"
        ? "a mail transport is configured"
        : "no mail transport — messages queue and are shown here",
      h("button", {
        class: "btn btn-sm",
        onClick: async () => {
          try {
            const out = await api.post("/admin/notifications/sweep", {});
            notifyState.data = null;
            toast("Sweep run", out.queued + " queued of " + out.considered + " considered");
            App.emit();
          } catch (e) { reportError(e, "Notification sweep"); }
        },
      }, "Run the sweep")),

    h("div", { class: "small muted", style: "margin-bottom:10px;max-width:64ch" },
      d.transport === "configured"
        ? "Queued messages are handed to the configured transport."
        : "Nothing is sent until a transport is configured (MERIDIAN_SMTP_URL). Until then this is what people would have been told — which is deliberately visible rather than silent."),

    h("div", { style: "display:flex;gap:16px;margin-bottom:12px" },
      h("span", { class: "small" }, h("span", { class: "strong mono" }, String(c.queued ?? 0)), " queued"),
      h("span", { class: "small muted" }, h("span", { class: "strong mono" }, String(c.sent ?? 0)), " sent"),
      h("span", { class: "small" + (c.failed ? " bad" : " muted") },
        h("span", { class: "strong mono" }, String(c.failed ?? 0)), " failed")),

    d.notifications.length
      ? table({
          cols: [
            { key: "w", label: "When", get: n => h("span", { class: "mono small" },
                String(n.at).slice(0, 16).replace("T", " ")) },
            { key: "t", label: "To", get: n => h("span", { class: "small" }, n.email) },
            { key: "k", label: "Kind", get: n => h("span", { class: "tag tag-out" }, n.kind) },
            { key: "s", label: "Subject", get: n => h("div", null,
                h("span", { class: "small" }, n.subject),
                n.error ? h("div", { class: "xs bad" }, n.error) : null) },
            { key: "st", label: "State", get: n => h("span", {
                class: "tag " + (n.state === "sent" ? "tag-ink" : n.state === "failed" ? "tag-accent" : "tag-out") },
                n.state) },
          ],
          rows: d.notifications,
        })
      : h("div", { class: "small muted" },
          "Nothing has been queued. Run the sweep to see what is currently due."));
}

const LEVELS = [
  { role: "admin",  label: "Administrator",
    scope: "Unrestricted, including accounts, grants and global settings",
    grantedBy: null },
  { role: "group",  label: "Group",
    scope: "Portfolio-wide read; write inside the granted programmes; money and baselines",
    grantedBy: "programme" },
  { role: "site",   label: "Site",
    scope: "Own sites plus group projects read-only; write site-governed projects only",
    grantedBy: "site" },
  { role: "viewer", label: "Viewer",
    scope: "Read-only, inside the granted scope",
    grantedBy: "either" },
];

async function load() {
  if (state.users || state.loading) return;
  state.loading = true;
  try {
    const { users } = await api.get("/admin/users");
    state.users = users;
  } catch (e) {
    state.users = [];
    reportError(e, "Could not load the account directory");
  } finally {
    state.loading = false;
    App.emit();
  }
}

async function write(label, work, detail) {
  const ok = await App.write(label, work, { detail, refresh: false });
  if (ok) {
    state.users = null;
    await load();
    await App.load().catch(() => {});
  }
  return ok;
}

/* ── the panel ────────────────────────────────────────────────────── */

export function accessPanel(db) {
  if (!App.isAdmin) {
    return h("div", null,
      sectionHead("Access model", "administrator only"),
      h("p", { class: "small muted", style: "max-width:64ch" },
        "Four levels of access are enforced: administrator, group, site and viewer. " +
        "Group and site accounts are scoped by grants — a grant list is never implicitly “all”. " +
        "Accounts and grants are managed by an administrator."),
      levelTable(db, null));
  }

  load();
  const users = state.users ?? [];
  const q = state.q.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => (u.displayName + " " + u.email + " " + u.role).toLowerCase().includes(q))
    : users;

  return h("div", null,
    sectionHead("Access levels", "what each level may actually do"),
    levelTable(db, users),

    h("div", { style: "height:24px" }), h("hr", { class: "hr" }), h("div", { style: "height:18px" }),

    sectionHead("Accounts",
      state.users === null ? "loading…" : users.length + " accounts",
      searchBox(state.q, "Filter accounts", (v) => { state.q = v; App.emit(); }),
      h("button", { class: "btn btn-sm btn-primary", onClick: () => newUser(db) },
        icon("plus", 12), "New account")),

    state.users === null
      ? h("p", { class: "small muted" }, "Reading the directory…")
      : table({
          cols: [
            { key: "n", label: "Account", get: (u) => h("div", { style: "display:flex;gap:9px;align-items:center" },
                h("span", { class: "avatar sm" + (u.active ? "" : " ghost") },
                  (u.displayName || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()),
                h("div", { style: "min-width:0" },
                  h("div", { class: "small strong truncate" }, u.displayName),
                  h("div", { class: "xs muted truncate" }, u.email))) },
            { key: "r", label: "Level", get: (u) => tag(u.role, u.role === "admin" ? "tag-soft" : "tag-out") },
            { key: "s", label: "Grants", get: (u) => grantCell(db, u) },
            { key: "p", label: "Person", get: (u) => h("span", { class: "small muted" },
                u.personId ? Engine.personName(db, u.personId) : "—") },
            { key: "l", label: "Last seen", align: "r", get: (u) => h("span", { class: "mono xs muted" },
                u.lastLoginAt ? String(u.lastLoginAt).slice(0, 10) : "never") },
            { key: "a", label: "", align: "r", get: (u) => h("div", { class: "btn-row" },
                h("button", { class: "btn btn-xs", onClick: (e) => { e.stopPropagation(); editUser(db, u); } }, "Edit"),
                h("button", { class: "btn btn-xs", onClick: (e) => { e.stopPropagation(); manageGrants(db, u); } },
                  "Grants"),
                h("button", { class: "btn btn-xs btn-ghost", title: "Reset password",
                  onClick: (e) => { e.stopPropagation(); resetPassword(u); } }, icon("pencil", 11))) },
          ],
          rows: shown,
          rowClass: (u) => (u.active ? "" : "muted"),
          empty: t("No accounts match that filter."),
        }));
}

function levelTable(db, users) {
  return table({
    cols: [
      { key: "l", label: "Level", get: (x) => h("span", { class: "strong small" }, x.label) },
      { key: "s", label: "What it confers", get: (x) => h("span", { class: "xs muted" }, x.scope) },
      { key: "g", label: "Scoped by", get: (x) => h("span", { class: "xs" },
          x.grantedBy === null ? "—" : x.grantedBy === "either" ? "programme or site" : x.grantedBy) },
      { key: "n", label: "Accounts", align: "r", get: (x) => h("span", { class: "mono small" },
          users ? String(users.filter((u) => u.role === x.role && u.active).length) : "—") },
    ],
    rows: LEVELS,
  });
}

function grantCell(db, u) {
  const names = [
    ...u.grants.programmes.map((id) => (db.programmes.find((p) => p.id === id) || {}).name || id),
    ...u.grants.sites.map((id) => (db.sites.find((s) => s.id === id) || {}).city || id),
  ];
  if (u.role === "admin") return h("span", { class: "xs muted" }, "unrestricted");
  if (!names.length) {
    return h("span", { class: "xs warn strong", title: "This account can see and do nothing" },
      "no grants held");
  }
  return h("div", { class: "chips" }, ...names.map((n) => h("span", { class: "tag tag-out" }, n)));
}

/* ── accounts ─────────────────────────────────────────────────────── */

function userFields(db, u) {
  return [
    { key: "displayName", label: "Name", required: true, span: 2, value: u ? u.displayName : "" },
    { key: "email", label: "Email", type: "email", required: true, span: 2, value: u ? u.email : "" },
    { key: "role", label: "Access level", type: "select", value: u ? u.role : "site",
      options: LEVELS.map((l) => ({ value: l.role, label: l.label })) },
    { key: "personId", label: "Directory entry", type: "select", value: u?.personId ?? "",
      options: [{ value: "", label: "Not linked" }]
        .concat(db.people.map((p) => ({ value: p.id, label: p.name + " — " + p.role }))),
      hint: t("Links the account to a person so their actions and allocations line up.") },
  ];
}

function newUser(db) {
  formDialog({
    title: "New account", kicker: "Access", wide: true,
    fields: [
      ...userFields(db, null),
      { key: "password", label: "Initial password", type: "password", required: true, span: 2,
        validate: (v) => (String(v).length < 8 ? "At least 8 characters" : ""),
        hint: t("The account holder should change this at first sign-in.") },
      { key: "grant", label: "First grant", type: "select", span: 2, value: "",
        options: [{ value: "", label: "None — add grants after creating" }]
          .concat(db.programmes.map((p) => ({ value: "programme:" + p.id, label: "Programme · " + p.name })))
          .concat(db.sites.map((s) => ({ value: "site:" + s.id, label: "Site · " + s.city }))),
        hint: t("A group or site account with no grants can see nothing. One is required.") },
    ],
    saveLabel: "Create account",
    onSave: (v) => {
      if (["group", "site"].includes(v.role) && !v.grant) {
        return toast("A grant is required",
          `A ${v.role}-level account with no grants can see nothing and do nothing.`, true);
      }
      const [kind, target] = (v.grant || ":").split(":");
      return write("Account created", (a) => a.post("/admin/users", {
        displayName: v.displayName, email: v.email, role: v.role,
        personId: v.personId || null, password: v.password,
        grants: target ? [{ kind, target }] : [],
      }), `${v.displayName} as ${v.role}`);
    },
  });
}

function editUser(db, u) {
  formDialog({
    title: "Edit account", kicker: u.email, wide: true,
    fields: [
      ...userFields(db, u),
      { key: "active", label: "Account is active", type: "checkbox", span: 2, value: u.active,
        hint: t("Deactivating ends every live session for this account immediately.") },
    ],
    saveLabel: "Save account",
    onSave: (v) => write("Account updated", (a) => a.patch("/admin/users/" + u.id, {
      displayName: v.displayName, email: v.email, role: v.role,
      personId: v.personId || null, active: !!v.active, version: u.version,
    }), u.displayName),
  });
}

function resetPassword(u) {
  formDialog({
    title: "Reset password", kicker: u.displayName,
    fields: [
      { hint: t("The holder is asked to change it at their next sign-in: an admin-set password is one two people know."),
        key: "password", label: "New password", type: "password", required: true, span: 2,
        validate: (v) => (String(v).length < 8 ? "At least 8 characters" : "") },
      { key: "endSessions", label: "Sign this account out everywhere", type: "checkbox", span: 2, value: true },
    ],
    saveLabel: "Reset password",
    onSave: (v) => write("Password reset", (a) => a.post("/admin/users/" + u.id + "/password", {
      password: v.password, endSessions: !!v.endSessions,
    }), u.displayName),
  });
}

/* ── grants ───────────────────────────────────────────────────────── */

function manageGrants(db, u) {
  if (u.role === "admin") {
    return dialog({
      title: "Grants", kicker: u.displayName,
      body: h("p", { class: "small muted", style: "max-width:56ch" },
        "An administrator account is unrestricted by role. Grants do not apply to it — " +
        "narrowing an administrator means changing its level."),
    });
  }

  const kind = u.role === "group" ? "programme" : u.role === "site" ? "site" : null;
  const held = [
    ...u.grants.programmes.map((id) => ({ kind: "programme", target: id,
      label: (db.programmes.find((p) => p.id === id) || {}).name || id })),
    ...u.grants.sites.map((id) => ({ kind: "site", target: id,
      label: (db.sites.find((s) => s.id === id) || {}).city || id })),
  ];

  const available = (k) => (k === "programme"
    ? db.programmes.filter((p) => !u.grants.programmes.includes(p.id))
        .map((p) => ({ value: "programme:" + p.id, label: "Programme · " + p.name }))
    : db.sites.filter((s) => !u.grants.sites.includes(s.id))
        .map((s) => ({ value: "site:" + s.id, label: "Site · " + s.city })));

  const options = kind ? available(kind) : [...available("programme"), ...available("site")];

  const close = () => { const b = document.querySelector(".backdrop"); if (b) b.remove(); };

  dialog({
    title: "Grants", kicker: `${u.displayName} · ${u.role}`, wide: true,
    body: h("div", null,
      h("p", { class: "small muted", style: "margin:0 0 14px;max-width:62ch" },
        kind === "programme"
          ? "A group-level account is scoped by programme. It reads the whole portfolio and writes inside the programmes granted here."
          : kind === "site"
            ? "A site-level account is scoped by site. It reads its own sites plus every group-governed project, and writes only site-governed projects in the sites granted here."
            : "A viewer is scoped by whichever grants it holds, and writes nothing."),

      held.length
        ? table({
            cols: [
              { key: "k", label: "Scope", get: (g) => tag(g.kind, "tag-out") },
              { key: "l", label: "Granted", get: (g) => h("span", { class: "small strong" }, g.label) },
              /* Reachable only from an administrator's screen today — but
                 "you could only have got here as an admin" is the argument
                 that left the change-request row unguarded, so it asks. */
              { key: "x", label: "", align: "r", get: (g) => !App.isAdmin ? null
                : h("button", {
                  class: "btn btn-xs btn-danger",
                  onClick: () => revokeGrant(u, g, close),
                }, "Revoke") },
            ],
            rows: held,
          })
        : h("div", { class: "drop-hint" },
            h("span", { class: "strong warn" }, "No grants held. "),
            "This account can currently see and do nothing."),

      h("div", { style: "height:16px" }),
      options.length
        ? h("div", { class: "field" },
            h("label", null, "Add a grant"),
            h("div", { style: "display:flex;gap:8px" },
              h("select", { class: "input", id: "grant-add" },
                ...options.map((o) => h("option", { value: o.value }, o.label))),
              h("button", {
                class: "btn btn-primary",
                onClick: () => {
                  const sel = document.getElementById("grant-add");
                  const [k, target] = sel.value.split(":");
                  close();
                  write("Access granted", (a) => a.post("/admin/users/" + u.id + "/grants",
                    { kind: k, target }), `${u.displayName}: ${k} ${target}`);
                },
              }, "Grant")))
        : h("p", { class: "xs muted" }, "Every available scope is already granted."),
    ),
  });
}

function revokeGrant(u, g, close) {
  const last = u.grants.programmes.length + u.grants.sites.length === 1;
  confirmDialog({
    title: `Revoke ${g.kind} ${g.label}?`,
    message: `${u.displayName} loses access to ${g.label}.`,
    detail: last && u.role !== "viewer"
      ? "This is their only grant — afterwards the account can see and do nothing."
      : "",
    confirmLabel: "Revoke", danger: true,
  }).then((ok) => {
    if (!ok) return;
    close();
    write("Access revoked",
      (a) => a.post("/admin/users/" + u.id + "/grants/revoke", { kind: g.kind, target: g.target }),
      `${u.displayName}: ${g.kind} ${g.label}`);
  });
}

/* ── directory ────────────────────────────────────────────────────── */

export function directoryPanel(db) {
  const bySite = {};
  db.people.forEach((p) => { (bySite[p.site] ??= []).push(p); });

  return h("div", null,
    sectionHead("Directory", db.people.length + " people",
      App.isAdmin
        ? h("button", { class: "btn btn-sm", onClick: () => newPerson(db) }, icon("plus", 12), "Add person")
        : null),
    table({
      cols: [
        { key: "n", label: "Person", get: (p) => h("div", { style: "display:flex;gap:9px;align-items:center" },
            avatar(db, p.id, "sm"),
            h("div", null,
              h("div", { class: "small strong" }, p.name),
              h("div", { class: "xs muted" }, p.id))) },
        { key: "r", label: "Role", get: (p) => h("span", { class: "small" }, p.role) },
        { key: "s", label: "Site", get: (p) => h("span", { class: "small" },
            (Engine.site(db, p.site) || {}).city ?? p.site) },
        { key: "d", label: "Day rate", align: "r", get: (p) => h("span", { class: "mono small" },
            p.rate ? "$" + Number(p.rate).toLocaleString() : "—") },
        { key: "l", label: "Load", align: "r", get: (p) => {
            const cap = Engine.capacity(db, 4);
            const row = cap.rows.find((x) => x.person.id === p.id);
            const peak = row ? row.peak : 0;
            return h("span", {
              class: "mono small",
              style: peak > db.settings.capacityCeiling ? "color:var(--sig-red);font-weight:600" : null,
            }, peak + "%");
          } },
        { key: "a", label: "", align: "r", get: (p) => App.isAdmin
            ? h("button", { class: "btn btn-xs", onClick: (e) => { e.stopPropagation(); editPerson(db, p); } }, "Edit")
            : null },
      ],
      rows: db.people,
      empty: t("The directory is empty."),
    }));
}

function personFields(db, p) {
  return [
    { key: "name", label: "Name", required: true, span: 2, value: p ? p.name : "" },
    { key: "role", label: "Job role", required: true, span: 2, value: p ? p.role : "",
      hint: t("Free text — this is the directory description, not an access level.") },
    { key: "site", label: "Site", type: "select", value: p ? p.site : db.sites[0]?.id,
      options: db.sites.map((s) => ({ value: s.id, label: s.city + " · " + s.region })) },
    { key: "rate", label: "Day rate", type: "number", min: 0, step: 10, value: p ? p.rate : 0 },
  ];
}

function newPerson(db) {
  formDialog({
    title: "Add person", kicker: "Directory", wide: true,
    fields: personFields(db, null), saveLabel: "Add person",
    onSave: (v) => write("Person added", (a) => a.post("/admin/people", {
      name: v.name, role: v.role, site: v.site, rate: Number(v.rate),
    }), v.name),
  });
}

function editPerson(db, p) {
  formDialog({
    title: "Edit person", kicker: p.id, wide: true,
    fields: [
      ...personFields(db, p),
      { key: "active", label: "Still with the group", type: "checkbox", span: 2, value: true,
        hint: t("Clearing this marks a leaver. The system checks first for live projects, open actions and open RAID items.") },
    ],
    saveLabel: "Save person",
    onSave: (v) => write("Person updated", async (a) => {
      try {
        return await a.patch("/admin/people/" + p.id, {
          name: v.name, role: v.role, site: v.site, rate: Number(v.rate),
          active: !!v.active, version: p.version,
        });
      } catch (e) {
        /* A leaver who still holds work is a real refusal, not a failure —
           offer the override rather than swallowing it. */
        if (e.status === 409 && !v.active) {
          const go = await confirmDialog({
            title: "Deactivate anyway?", message: e.message,
            detail: "Their name stays on everything they hold; nothing is reassigned automatically.",
            confirmLabel: "Deactivate anyway", danger: true,
          });
          if (!go) throw e;
          return a.patch("/admin/people/" + p.id, {
            name: v.name, role: v.role, site: v.site, rate: Number(v.rate),
            active: false, force: true, version: p.version,
          });
        }
        throw e;
      }
    }, p.name),
  });
}

/* ── reference data ───────────────────────────────────────────────── */

export function referencePanel(db) {
  if (!App.isAdmin) return null;
  return h("div", null,
    sectionHead("Sites", db.sites.length + " delivery locations",
      h("button", { class: "btn btn-sm", onClick: () => siteDialog(db, null) }, icon("plus", 12), "Add site")),
    table({
      cols: [
        { key: "i", label: "Code", get: (s) => h("span", { class: "mono small strong" }, s.id) },
        { key: "c", label: "City", get: (s) => h("span", { class: "small" }, s.city) },
        { key: "r", label: "Region", get: (s) => h("span", { class: "small muted" }, s.region) },
        { key: "t", label: "Zone", get: (s) => h("span", { class: "mono xs" }, s.tzName) },
        { key: "h", label: "People", align: "r", get: (s) => h("span", { class: "mono small" }, String(s.headcount)) },
        { key: "a", label: "", align: "r", get: (s) => h("button", {
            class: "btn btn-xs", onClick: (e) => { e.stopPropagation(); siteDialog(db, s); } }, "Edit") },
      ],
      rows: db.sites,
    }),

    h("div", { style: "height:22px" }),
    sectionHead("Programmes", db.programmes.length + " programmes",
      h("button", { class: "btn btn-sm", onClick: () => programmeDialog(db, null) },
        icon("plus", 12), "Add programme")),
    table({
      cols: [
        { key: "i", label: "Code", get: (g) => h("span", { class: "mono small strong" }, g.id) },
        { key: "n", label: "Programme", get: (g) => h("span", { class: "small" }, g.name) },
        { key: "s", label: "Sponsor", get: (g) => h("span", { class: "small muted" }, g.sponsor) },
        { key: "m", label: "Manager", get: (g) => h("span", { class: "small" },
            g.managerId ? Engine.personName(db, g.managerId) : "—") },
        { key: "p", label: "Projects", align: "r", get: (g) => h("span", { class: "mono small" },
            String(db.projects.filter((p) => p.programme === g.id).length)) },
        { key: "a", label: "", align: "r", get: (g) => h("button", {
            class: "btn btn-xs", onClick: (e) => { e.stopPropagation(); programmeDialog(db, g); } }, "Edit") },
      ],
      rows: db.programmes,
    }));
}

function siteDialog(db, s) {
  formDialog({
    title: s ? "Edit site" : "Add site", kicker: s ? s.id : "Reference data", wide: true,
    fields: [
      ...(s ? [] : [{ key: "id", label: "Code", required: true, value: "",
        hint: t("Three letters, e.g. the airport code."),
        validate: (v) => (/^[A-Za-z]{2,5}$/.test(v) ? "" : "Two to five letters") }]),
      { key: "city", label: "City", required: true, value: s ? s.city : "" },
      { key: "region", label: "Region", value: s ? s.region : "" },
      { key: "tz", label: "UTC offset", type: "number", step: 0.5, value: s ? s.tz : 0 },
      { key: "tzName", label: "Zone name", value: s ? s.tzName : "UTC" },
      { key: "headcount", label: "Headcount", type: "number", min: 0, value: s ? s.headcount : 0 },
      { key: "fte", label: "FTE", type: "number", min: 0, value: s ? s.fte : 0 },
      { key: "charter", label: "What this site does", type: "textarea", rows: 2, span: 2,
        value: s ? s.role : "" },
    ],
    saveLabel: s ? "Save site" : "Add site",
    onSave: (v) => write(s ? "Site updated" : "Site added",
      (a) => (s
        ? a.patch("/admin/sites/" + s.id, {
            city: v.city, region: v.region, tz: Number(v.tz), tzName: v.tzName,
            headcount: Number(v.headcount), fte: Number(v.fte), charter: v.charter,
            version: s.version })
        : a.post("/admin/sites", {
            id: v.id, city: v.city, region: v.region, tz: Number(v.tz), tzName: v.tzName,
            headcount: Number(v.headcount), fte: Number(v.fte), charter: v.charter })),
      v.city),
  });
}

function programmeDialog(db, g) {
  formDialog({
    title: g ? "Edit programme" : "Add programme", kicker: g ? g.id : "Reference data", wide: true,
    fields: [
      ...(g ? [] : [{ key: "id", label: "Code", required: true, value: "",
        validate: (v) => (/^[A-Za-z]{2,5}$/.test(v) ? "" : "Two to five letters") }]),
      { key: "name", label: "Programme", required: true, span: 2, value: g ? g.name : "" },
      { key: "sponsor", label: "Executive sponsor", span: 2, value: g ? g.sponsor : "" },
      { key: "managerId", label: "Programme manager", type: "select", span: 2,
        value: g?.managerId ?? "",
        options: [{ value: "", label: "Unassigned" }]
          .concat(db.people.map((p) => ({ value: p.id, label: p.name + " — " + p.role }))) },
    ],
    saveLabel: g ? "Save programme" : "Add programme",
    onSave: (v) => write(g ? "Programme updated" : "Programme added",
      (a) => (g
        ? a.patch("/admin/programmes/" + g.id, {
            name: v.name, sponsor: v.sponsor, managerId: v.managerId || null,
            version: g.version })
        : a.post("/admin/programmes", {
            id: v.id, name: v.name, sponsor: v.sponsor, managerId: v.managerId || null })),
      v.name),
  });
}

/* ── SDP federation (charter ADR-4/14) ─────────────────────────────────
   The operations dashboard this module lives inside. Two credentials,
   two directions: the address+key Meridian presents to SDP's read APIs,
   and the inbound key SDP presents to /v1/* — generated here, shown
   exactly once, stored only as a hash. */

const fed = { settings: null, loading: false };

async function loadFed() {
  if (fed.settings || fed.loading) return;
  fed.loading = true;
  try {
    fed.settings = await api.get("/federation/settings");
  } catch (e) {
    fed.settings = { sdpBaseUrl: "", outKeySet: false, inboundKeySet: false, error: true };
  } finally {
    fed.loading = false;
    App.emit();
  }
}

export function federationPanel() {
  if (!App.isAdmin) return null;
  loadFed();
  const s = fed.settings;

  const body = !s
    ? h("div", { class: "small muted" }, "Reading the federation settings…")
    : h("div", null,
        h("div", { class: "small", style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px" },
          tag(s.sdpBaseUrl ? "SDP address set" : "SDP address missing", s.sdpBaseUrl ? "tag-ink" : "tag-out"),
          tag(s.outKeySet ? "Outbound key held" : "Outbound key missing", s.outKeySet ? "tag-ink" : "tag-out"),
          tag(s.inboundKeySet ? "Inbound key issued" : "Inbound key not issued", s.inboundKeySet ? "tag-ink" : "tag-out")),
        h("p", { class: "xs muted", style: "max-width:64ch;margin:0 0 12px" },
          "The outbound key is what this module presents when it reads SDP's open changes and " +
          "actions (the picker feeds). The inbound key is what SDP presents when it pushes " +
          "resources and the ops-strategy programme; only its hash is stored here."),
        h("div", { class: "btn-row" },
          h("button", { class: "btn btn-sm", onClick: editFedSettings }, icon("pencil", 12), "SDP address & key"),
          h("button", { class: "btn btn-sm", onClick: mintInboundKey }, icon("plus", 12),
            s.inboundKeySet ? "Rotate inbound key" : "Issue inbound key")));

  return h("div", null,
    sectionHead("SDP federation", "the operations dashboard this module extends"),
    body);
}

function editFedSettings() {
  const s = fed.settings ?? { sdpBaseUrl: "" };
  formDialog({
    title: "SDP federation settings", kicker: "Administration",
    fields: [
      { key: "sdpBaseUrl", label: "SDP base address", span: 2, value: s.sdpBaseUrl,
        placeholder: "https://itops-dashboard.example.com" },
      { key: "sdpOutKey", label: "Outbound key (blank keeps the stored one)", span: 2,
        type: "password", value: "" },
    ],
    saveLabel: "Save settings",
    onSave: async (v) => {
      const ok = await App.write("Federation settings changed",
        (a) => a.put("/federation/settings", { sdpBaseUrl: v.sdpBaseUrl, sdpOutKey: v.sdpOutKey ?? "" }),
        { detail: v.sdpBaseUrl || "cleared", refresh: false });
      if (ok !== false) { fed.settings = null; App.emit(); }
    },
  });
}

function mintInboundKey() {
  confirmDialog({
    title: fed.settings?.inboundKeySet ? "Rotate the inbound key?" : "Issue the inbound key?",
    message: "SDP must be given the new value; the old one stops working immediately.",
    detail: "The key is shown once and never stored in clear.",
    confirmLabel: "Generate key",
  }).then(async (ok) => {
    if (!ok) return;
    try {
      const r = await api.post("/federation/keys/inbound", {});
      fed.settings = null;
      dialog({
        title: "Inbound service key", kicker: "Shown once — hand it to the SDP administrator",
        body: h("div", null,
          h("div", { class: "mono small", style:
            "padding:12px;border:1px solid var(--rule-1);border-radius:6px;user-select:all;word-break:break-all" },
            r.key),
          h("p", { class: "xs muted", style: "margin:10px 0 0" },
            "Paste it into SDP's Admin → Meridian (PMO) card as the outbound key. " +
            "Only a hash remains on this side; closing this dialog discards the clear text.")),
      });
      App.emit();
    } catch (e) {
      reportError(e, "Could not generate the key");
    }
  });
}

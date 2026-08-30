/**
 * A-01 / A-10 — LE MANUEL, ET LES PREMIERS PAS.
 *
 * Le comité d'adoption a posé deux réserves qui n'en font qu'une :
 * personne ne peut apprendre Meridian autrement qu'en le manipulant ou
 * en demandant à quelqu'un (A-01), et rien ne distingue l'apprentissage
 * d'un chef de site de celui d'un contrôleur de gestion (A-10).
 *
 * Il a aussi écrit ce qui ne lèverait PAS la réserve : « un fichier
 * Markdown de plus dans docs/ — il ne serait pas plus lu que les
 * dix-neuf autres ». Le manuel vit donc ici, dans le produit, atteignable
 * depuis l'aide, découpé par TÂCHE et non par écran, dans les deux
 * langues comme tout le reste.
 *
 * Et il a remarqué que le produit possédait déjà le bon motif sans
 * l'offrir qu'à un seul rôle : l'écran de première mise en route est une
 * liste ordonnée qui SE COCHE D'ELLE-MÊME à mesure que la donnée arrive.
 * Les parcours ci-dessous sont ce motif, étendu aux quatre rôles — parce
 * qu'une liste qu'on coche à la main ment le lendemain.
 */

import { h, dialog, fold } from "./kit.js";
import { App, go } from "../lib/state.js";
import { t } from "../lib/i18n.js";

/* ── les premiers pas, par rôle (A-10) ────────────────────────────────
   Chaque étape porte un `done(db, me)` qui interroge la donnée RÉELLE.
   Aucune ne se coche parce que quelqu'un a cliqué : elles se cochent
   parce que le travail est fait, et c'est ce qui les rend utiles à un
   responsable qui veut savoir où en est la prise en main de son équipe. */

const mine = (db, me) => db.projects.filter((p) => App.canWrite(p));
const myPerson = (me) => me.personId;

const COMMON_FIRST = [
  { id: "password",
    label: "Choose your own password",
    why: "Until you do, the trail cannot say an action was really yours.",
    /* Le serveur bloque toute écriture tant que ce n'est pas fait ; si
       l'application est utilisable, c'est que c'est fait. */
    done: () => !App.me?.mustChangePassword,
    go: null },
  { id: "week",
    label: "Find your own week",
    why: "My week gathers what is owed by you, and only by you.",
    done: () => App.ui.seenViews?.has?.("my") ?? false,
    go: "#/my" },
];

const BY_ROLE = {
  site: [
    ...COMMON_FIRST,
    { id: "progress", label: "Update a stage on one of your projects",
      why: "Open the project, then Stage plan. The percentage you set is what the indices are computed from.",
      done: (db, me) => mine(db, me).some((p) =>
        db.activities.some((a) => a.project === p.id && a.pct > 0)),
      go: "#/project" },
    { id: "raid", label: "Raise a risk or an issue",
      why: "Anything that could cost time or money belongs on the register — before it does.",
      done: (db, me) => db.raid.some((r) => mine(db, me).some((p) => p.id === r.project)),
      go: "#/risk" },
    { id: "concern", label: "Know how to speak about a group project",
      why: "A group project landing on your site is read-only. Raise a CONCERN on it; your programme office sees it on their agenda.",
      done: (db) => db.raid.some((r) => r.origin && r.origin === App.me.grants?.sites?.[0]),
      go: "#/mysite" },
    { id: "decision", label: "Find a decision your site meeting took",
      why: "Meetings keep their minutes. A decision taken is a decision anybody can read back.",
      done: () => App.ui.seenViews?.has?.("meetings") ?? false,
      go: "#/meetings" },
    { id: "effort", label: "Record a week of real effort",
      why: "Four fields, once a week. It sits beside the plan — the gap is the point.",
      done: (db, me) => (db.timesheets ?? []).some((x) => x.person === myPerson(me)),
      go: "#/resources" },
  ],
  group: [
    ...COMMON_FIRST,
    { id: "slate", label: "Read your programme's slate",
      why: "Programmes shows the health of everything you govern, and what is owed to you.",
      done: () => App.ui.seenViews?.has?.("programmes") ?? false,
      go: "#/programmes" },
    { id: "change", label: "Decide a change request somebody else raised",
      why: "You never decide your own — a second pair of eyes is the control, not a formality.",
      done: (db) => db.crs.some((c) => c.status !== "Pending"),
      go: "#/change" },
    { id: "evidence", label: "Approve a gate evidence document",
      why: "It must point at a real artefact on a trusted host, and you cannot approve one you own.",
      done: (db) => db.docs.some((d) => d.status === "Approved"),
      go: "#/documents" },
    { id: "period", label: "Close a reporting period",
      why: "Closing freezes what was reported, so the number you quote can be produced again.",
      done: (db) => (db.periods ?? []).length > 0,
      go: "#/reports" },
    { id: "priority", label: "Score the demand queue",
      why: "Fit and value pull up; risk and effort pull down. The score ranks — it never decides.",
      done: (db) => db.projects.some((p) => p.fit != null),
      go: "#/pipeline" },
  ],
  admin: [
    ...COMMON_FIRST,
    { id: "sites", label: "Add the sites and programmes",
      why: "Everything else hangs off them: a project needs both to exist.",
      done: (db) => db.sites.length > 0 && db.programmes.length > 0,
      go: "#/admin" },
    { id: "people", label: "Add the people",
      why: "An account is linked to a person, so their actions and allocations line up.",
      done: (db) => db.people.length > 0,
      go: "#/admin" },
    { id: "accounts", label: "Create the named accounts and their grants",
      why: "A group or site account with no grant sees nothing. And named accounts are what makes segregation of duties real.",
      done: (db) => db.people.length > 0 && db.projects.length > 0,
      go: "#/admin" },
    { id: "hosts", label: "Name the trusted document hosts",
      why: "Until you do, no gate evidence can be approved — the control is closed, deliberately.",
      done: (db) => !!db.settings.documentHosts,
      go: "#/admin" },
    { id: "retention", label: "Decide how long notifications are kept",
      why: "Without a duration nothing is purged: how long a record of who was told what is kept is your decision, not the tool's.",
      done: (db) => Number(db.settings.notifyRetentionDays) > 0,
      go: "#/admin" },
  ],
  viewer: [
    ...COMMON_FIRST,
    { id: "portfolio", label: "Read the portfolio headline",
      why: "One line per project: health, gate, money, and why the colour is what it is.",
      done: () => App.ui.seenViews?.has?.("portfolio") ?? false,
      go: "#/portfolio" },
    { id: "reports", label: "Read a published period",
      why: "A closed period is frozen: it reads today exactly as it read then.",
      done: () => App.ui.seenViews?.has?.("reports") ?? false,
      go: "#/reports" },
    { id: "why", label: "Understand where a number comes from",
      why: "Hover any health dot: it says why. Nothing in Meridian asks to be taken on trust.",
      done: () => App.ui.seenViews?.has?.("portfolio") ?? false,
      go: "#/portfolio" },
  ],
};

export function firstStepsFor(role) {
  return BY_ROLE[role] ?? BY_ROLE.viewer;
}

/* ── le manuel (A-01) ─────────────────────────────────────────────────
   Par TÂCHE, pas par écran : quelqu'un qui cherche de l'aide ne se
   demande pas « que fait cet écran », il se demande « comment
   fait-on… ». Chaque fiche tient en un écran et dit où le geste
   s'accomplit — jamais plus long que ce que quelqu'un lira debout, une
   tablette à la main, dans un couloir. */

export const MANUAL = [
  { section: "Getting started", items: [
    { q: "How do I sign in for the first time?",
      a: "Use the address and the temporary password you were given. Meridian will ask you to choose your own before it lets you record anything: until you do, the trail cannot say an action was really yours.",
      where: null },
    { q: "Where do I find what is owed by me?",
      a: "My week. It gathers the actions, the risks and the decisions that carry your name — and nothing that carries somebody else's.",
      where: "#/my" },
    { q: "Why can I see a project but not change it?",
      a: "Your grants name what you may write. A group programme delivered at your site is readable, never editable — that is deliberate. Raise a concern on it instead, and your programme office sees it on their agenda.",
      where: "#/mysite" },
  ] },
  { section: "Keeping a project honest", items: [
    { q: "How do I update progress?",
      a: "Open the project, then Stage plan, and set the percentage complete on the stage. Every index — schedule, cost, forecast — is computed from that number, so it is the one thing worth keeping true.",
      where: "#/project" },
    { q: "What does the colour mean?",
      a: "Green, amber and red are derived from the schedule and cost indices. Hover the dot and it tells you why. If you disagree, override it — but an override always carries a written reason, because the committee reads it back.",
      where: "#/portfolio" },
    { q: "How do I raise a risk or an issue?",
      a: "Risks & issues, then the button. Probability times impact decides who hears about it: high enough and it appears on the steering agenda by itself.",
      where: "#/risk" },
    { q: "Something changed the cost or the dates. What do I do?",
      a: "Raise a change request. Above the threshold it goes to your programme office; below it, a colleague decides. You never decide your own — that is the control, not a formality.",
      where: "#/change" },
  ] },
  { section: "Gates and evidence", items: [
    { q: "Why will the gate not let my project advance?",
      a: "A gate needs its evidence documents approved. A document is approved evidence only when it points at a real artefact on a trusted host — a document with no link is a label, and Meridian refuses to count it.",
      where: "#/documents" },
    { q: "Why can I not approve my own document?",
      a: "Whoever owns a piece of evidence never approves it. Hand it to a colleague or to your programme office: an approval means somebody else looked.",
      where: "#/documents" },
    { q: "The link in an approved document is dead. What happens?",
      a: "Meridian checks periodically and shows it in the library — but it never withdraws the approval on its own. Somebody who knows where the piece lives confirms it. A dropped link is not a governance decision.",
      where: "#/documents" },
  ] },
  { section: "Meetings and decisions", items: [
    { q: "How do I run a meeting?",
      a: "Open the occurrence: the agenda is already built from the book. Open it, record decisions and actions as you go, then close it. Closing freezes the pack, so what was discussed can be produced again.",
      where: "#/meetings" },
    { q: "Something is above my authority. How do I escalate?",
      a: "Refer it from the meeting. The broader room picks it up on their next agenda automatically, and their decision retires the referral — you do not chase it.",
      where: "#/meetings" },
    { q: "Where do I find a decision taken months ago?",
      a: "Meetings & decisions keeps every minute. The trail is append-only, so a decision reads today exactly as it read then.",
      where: "#/meetings" },
  ] },
  { section: "Your week, your absences", items: [
    { q: "How do I record real effort?",
      a: "Resources, then Record effort. Four fields, once a week. It sits beside the plan rather than inside it — the gap between the two is the point.",
      where: "#/resources" },
    { q: "I am going on rotation. Who covers me?",
      a: "Declare the absence on My site and name a deputy. They take your authority for that period — never more than yours — and the trail names you both. When you come back, your digest widens to cover the days you missed.",
      where: "#/mysite" },
    { q: "How do I stop being told things at night?",
      a: "Notification preferences, next to your name. Choose the cadence and the quiet hours; urgent messages still come through, because a silence you cannot pierce is a silence people switch off.",
      where: "#/inbox" },
  ] },
];

/* ── les surfaces ─────────────────────────────────────────────────── */

function stepRow(s, db, me, doneCount) {
  let ok = false;
  try { ok = !!s.done(db, me); } catch { ok = false; }
  if (ok) doneCount.n++;
  return h("div", { class: "list-row" + (s.go ? " linkish" : ""), tabindex: s.go ? 0 : null,
      onClick: s.go ? () => { App.emit("close-dialogs"); go(s.go); } : null,
      onKeydown: s.go ? (e) => e.key === "Enter" && go(s.go) : null },
    h("span", { class: "num", style: "width:26px;flex:none;color:" +
        (ok ? "var(--sig-green, #2c7)" : "var(--muted)") }, ok ? "✓" : "○"),
    h("div", { style: "min-width:0" },
      h("div", { class: "strong small" }, t(s.label)),
      h("div", { class: "xs muted" }, t(s.why))));
}

/** A-10 — les premiers pas de MON rôle, cochés sur la donnée réelle. */
export function firstStepsPanel(db) {
  const me = App.me;
  const steps = firstStepsFor(me.role);
  const doneCount = { n: 0 };
  const rows = steps.map((s) => stepRow(s, db, me, doneCount));
  return h("div", null,
    h("p", { class: "small muted", style: "max-width:60ch;margin-bottom:10px" },
      t("These tick themselves as the work gets done — nothing here is a box you check by hand.")),
    h("div", { class: "kicker", style: "margin-bottom:6px" },
      doneCount.n + " / " + steps.length + " " + t("done")),
    ...rows);
}

/** A-01 — le manuel, par tâche. */
export function manualPanel() {
  return h("div", null,
    h("p", { class: "small muted", style: "max-width:62ch;margin-bottom:12px" },
      t("Answers to what people actually ask, in the order they ask them. Each one says where the thing is done.")),
    ...MANUAL.map((sec) =>
      fold(t(sec.section), sec.items.length + " " + t("answers"), false,
        ...sec.items.map((it) => h("div", { class: "list-row", style: "align-items:flex-start" },
          h("div", { style: "min-width:0;flex:1" },
            h("div", { class: "strong small" }, t(it.q)),
            h("div", { class: "xs muted", style: "max-width:62ch" }, t(it.a))),
          it.where
            ? h("button", { class: "btn btn-xs", onClick: () => { App.emit("close-dialogs"); go(it.where); } },
                t("Show me"))
            : null)))));
}

/**
 * A-12 — qui appeler quand on ne sait pas.
 *
 * Le produit renvoyait vers « un administrateur » — c'est-à-dire vers
 * personne en particulier, et sur un site en rotation, vers personne du
 * tout. La personne qu'on appelle est la première infrastructure
 * d'adoption d'un outil multi-sites : elle est donc nommée, et c'est
 * CELLE DU SITE DU LECTEUR qui vient en premier.
 */
export function championLine(db) {
  const me = App.me;
  const mySite = me.grants?.sites?.[0] ?? db.people.find((p) => p.id === me.personId)?.site;
  const site = mySite ? db.sites.find((s) => s.id === mySite) : null;
  const champ = site?.champion ? db.people.find((p) => p.id === site.champion) : null;
  if (champ) {
    return h("p", { class: "small", style: "margin-top:12px" },
      t("Stuck? Ask "), h("strong", null, champ.name),
      t(", the Meridian referent for "), h("strong", null, site.city || site.id),
      t(" — before the group, because they are on your site and know your work."));
  }
  return h("p", { class: "xs muted", style: "margin-top:12px;max-width:62ch" },
    site
      ? t("No referent is named for your site yet. An administrator can name one in Administration → Sites — and until they do, questions go to the group, which is slower.")
      : t("Need access or a grant changed? Any account marked ADMIN on the sign-in screen's directory can help."));
}

/** La porte d'entrée : les deux, plus l'orientation, en un seul endroit. */
export function guideDialog(db, { tab = "steps" } = {}) {
  let current = tab;
  const body = h("div", null);
  const draw = () => {
    body.textContent = "";
    const tabBtn = (key, label) => h("button", {
      class: "btn btn-sm" + (current === key ? " btn-primary" : ""),
      onClick: () => { current = key; draw(); },
    }, t(label));
    body.appendChild(h("div", { class: "btn-row", style: "margin-bottom:14px" },
      tabBtn("steps", "First steps"), tabBtn("manual", "How do I…")));
    body.appendChild(current === "steps" ? firstStepsPanel(db) : manualPanel());
    body.appendChild(championLine(db));
  };
  draw();
  dialog({ title: t("Using Meridian"), kicker: t("First steps and answers"), body, wide: true });
}

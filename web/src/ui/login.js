/**
 * Sign-in.
 *
 * The v4 build had no such screen — there was one hard-coded user and
 * every action in the audit trail was attributed to them (F-01, F-03).
 * This is the front door that made the trail mean something.
 */

import { h, clear, icon } from "./kit.js";
import { api, ApiError } from "../lib/api.js";
import { t, getLang, setLang } from "../lib/i18n.js";

const ROLE_NOTE = {
  admin:  "Everything, including users, grants and global settings",
  group:  "Portfolio-wide read; write inside the granted programmes",
  site:   "Own sites plus group projects read-only; write own site projects",
  viewer: "Read-only",
};

export function renderLogin(root, onSignedIn) {
  clear(root);

  const emailField = h("input", {
    class: "input", type: "email", name: "email", autocomplete: "username",
    placeholder: "you@meridian.example", required: true, "aria-label": "Email address",
  });
  const passwordField = h("input", {
    class: "input", type: "password", name: "password", autocomplete: "current-password",
    placeholder: "Your password", required: true, "aria-label": "Password",
  });
  const message = h("div", { class: "small", style: "min-height:20px;color:var(--sig-red)", role: "alert" });
  /* The /pmo-sso bridge lands here when the SDP account has no Meridian
     account yet — say so plainly rather than presenting a silent form. */
  if (new URLSearchParams(location.search).get("sso") === "not_provisioned") {
    message.style.color = "var(--muted)";
    message.textContent =
      "Your SDP sign-in reached this module, but no PMO account carries your email yet. " +
      "Ask a Meridian administrator to provision you, or sign in with a module account below.";
  }
  const submit = h("button", { class: "btn btn-primary", type: "submit", style: "width:100%;justify-content:center" },
    t("Sign in"), icon("arrowRight", 13));

  const accountList = h("div", { class: "small muted" }, "Loading the directory…");

  async function attempt(e) {
    e.preventDefault();
    message.textContent = "";
    submit.disabled = true;
    submit.textContent = t("Signing in…");
    try {
      const { user } = await api.login(emailField.value.trim(), passwordField.value);
      onSignedIn(user);
    } catch (err) {
      message.textContent = err instanceof ApiError ? err.message : t("Could not reach the server");
      submit.disabled = false;
      clear(submit);
      submit.append(t("Sign in"), icon("arrowRight", 13));
      passwordField.focus();
      passwordField.select();
    }
  }

  /* V-14 — the organisation's own sign-on, offered only where a tenant is
     actually configured. An instance without one shows nothing rather
     than a button that leads somewhere broken. */
  const ssoSlot = h("div");
  api.get("/auth/oidc/status").then((s) => {
    if (!s?.enabled) return;
    clear(ssoSlot);
    ssoSlot.append(
      h("button", {
        class: "btn", type: "button",
        style: "width:100%;justify-content:center;margin-bottom:4px",
        onClick: () => { location.href = "/api/auth/oidc/start"; },
      }, t("Sign in with your work account")),
      h("div", { class: "xs muted", style: "text-align:center;margin-bottom:10px" },
        t("or with a Meridian account below")));
  }).catch(() => { /* an instance that cannot answer simply offers nothing */ });

  const form = h("form", { onSubmit: attempt, style: "display:grid;gap:14px" },
    ssoSlot,
    h("label", { class: "field" }, h("span", null, t("Email")), emailField),
    h("label", { class: "field" }, h("span", null, t("Password")), passwordField),
    message,
    submit);

  root.appendChild(
    h("div", { style: "display:grid;grid-template-columns:minmax(320px,420px) 1fr;height:100vh;overflow:hidden" },
      // ── the form ────────────────────────────────────────────────
      h("div", { style: "padding:48px 40px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--rule-2);overflow-y:auto" },
        h("div", { class: "brand-row", style: "margin-bottom:6px" },
          h("span", { class: "brand-mark" }),
          h("span", { class: "brand-name", style: "font-size:20px" }, "MERIDIAN"),
          h("span", { class: "sp", style: "flex:1" }),
          /* The front door is where language matters most: the toggle
             names the language it switches TO. */
          h("button", {
            class: "btn btn-ghost", type: "button",
            style: "font-size:11px;font-weight:700;letter-spacing:.05em",
            onClick: () => { setLang(getLang() === "fr" ? "en" : "fr"); renderLogin(root, onSignedIn); },
          }, getLang() === "fr" ? "EN" : "FR")),
        h("div", { class: "kicker" }, t("Group IT portfolio management office")),
        h("h2", { style: "margin:24px 0 6px" }, t("Sign in")),
        h("p", { class: "small muted", style: "margin:0 0 24px;max-width:38ch" },
          t("Every action you take is recorded against your name and scoped to the sites and programmes you hold.")),
        form),

      // ── the directory of seeded accounts ────────────────────────
      h("div", { style: "padding:48px 40px;overflow-y:auto;background:var(--color-surface)" },
        h("div", { class: "kicker" }, t("Accounts on this instance")),
        h("h3", { style: "margin:6px 0 4px" }, t("Who can sign in")),
        h("p", { class: "small muted", style: "margin:0 0 18px;max-width:62ch" },
          "Four levels of access, agreed at the constitutive committee: administrator, group, site and viewer. " +
          "Group and site accounts are scoped by the grants named beside them — a grant list is never implicitly “all”."),
        accountList)));

  emailField.focus();
  loadAccounts(accountList, (email) => {
    emailField.value = email;
    passwordField.focus();
  });
}

async function loadAccounts(host, pick) {
  try {
    const { accounts, seeded } = await api.accounts();
    clear(host);
    let currentRole = null;
    for (const a of accounts) {
      if (a.role !== currentRole) {
        currentRole = a.role;
        host.appendChild(h("div", { style: "margin:18px 0 6px" },
          h("div", { class: "kicker-lg", style: "color:var(--color-accent)" }, currentRole.toUpperCase()),
          h("div", { class: "xs muted" }, ROLE_NOTE[currentRole] ?? "")));
        host.appendChild(h("hr", { class: "hr" }));
      }
      host.appendChild(
        h("button", {
          class: "list-row",
          style: "width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--rule-1);cursor:pointer;padding:9px 0",
          onClick: () => pick(a.email),
        },
          h("div", { style: "flex:1;min-width:0" },
            h("div", { class: "strong small" }, a.name),
            h("div", { class: "xs muted truncate" }, a.email)),
          a.scope
            ? h("span", { class: "tag tag-out" }, a.scope)
            : h("span", { class: "xs muted" }, a.role === "admin" ? "unrestricted" : "—")));
    }
    /* The README-passwords sentence is demo-ware and must never render
       on a production book (adoption committee I4). */
    host.appendChild(h("p", { class: "xs muted", style: "margin-top:20px;max-width:60ch" },
      seeded
        ? "Selecting a name fills the address in. Passwords are set at seed time and listed in the README; " +
          "change them from Administration before this instance carries anything real."
        : "Selecting a name fills the address in. Forgotten your password? Any administrator can reset it — " +
          "you will choose a new one at your next sign-in."));
  } catch {
    clear(host);
    host.appendChild(h("p", { class: "small muted" },
      "The directory could not be loaded. Sign in with your address and password."));
  }
}

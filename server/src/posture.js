/**
 * I-12 — LA POSTURE DU JOUR 1  (retour de terrain RT365, docs/33 · M-10)
 *
 * Le terrain l'a dit sans détour : « des identifiants de démonstration
 * semés par défaut et publics ; à changer le jour 1 ». Le README le
 * disait déjà, l'AMDEC l'avait accepté (C-04) — et un « à faire le jour
 * 1 » que rien ne mesure ne se fait pas.
 *
 * Ce module MESURE : pour chaque compte de démonstration encore actif,
 * le mot de passe publié ouvre-t-il toujours la porte ? C'est la seule
 * question qui compte — un compte renommé, ou dont le mot de passe a été
 * changé, n'est plus un risque, et un compte désactivé non plus. Dix
 * vérifications scrypt au démarrage coûtent une seconde ; une instance
 * de production ouverte avec un mot de passe lisible sur GitHub coûte
 * le registre entier.
 *
 * Ce qu'on en fait :
 *   · en production (NODE_ENV=production), le serveur REFUSE de démarrer
 *     tant qu'un mot de passe publié ouvre un compte actif — sauf
 *     MERIDIAN_ALLOW_DEMO_ACCOUNTS=1, qui est une décision, pas un oubli ;
 *   · partout ailleurs, il le dit au démarrage, et l'écran Administration
 *     le montre à l'administrateur tant que c'est vrai.
 */

import { many } from "./db.js";
import { verifyPassword } from "./auth.js";
import { DEMO_ACCOUNTS } from "./seed.js";
import { loadSettings } from "./portfolio.js";

/** Les comptes actifs qu'un mot de passe PUBLIÉ ouvre encore. */
export async function liveDemoAccounts() {
  const emails = DEMO_ACCOUNTS.map((d) => d.email);
  const rows = await many(
    `SELECT id, email, pw_hash, pw_salt, must_change_password
       FROM app_user WHERE active AND lower(email) = ANY($1)`, [emails]);
  const live = [];
  for (const row of rows) {
    const demo = DEMO_ACCOUNTS.find((d) => d.email === row.email.toLowerCase());
    if (!demo) continue;
    if (row.pw_hash === "unusable") continue;
    if (await verifyPassword(demo.password, row.pw_hash, row.pw_salt)) {
      live.push({ id: row.id, email: row.email,
        /* S-10 : un compte forcé de changer son mot de passe ne peut pas
           écrire — la porte est entrouverte, pas ouverte. Dit tel quel. */
        mustChangePassword: !!row.must_change_password });
    }
  }
  return live;
}

/** Le refus de démarrage, ou null. Isolé pour être testable sans processus. */
export function demoRefusal(env, live) {
  if (env.NODE_ENV !== "production" || !live.length) return null;
  if (env.MERIDIAN_ALLOW_DEMO_ACCOUNTS === "1" || env.MERIDIAN_TRAINING === "1") return null;
  return [
    `NODE_ENV=production and ${live.length} demonstration account(s) still open with the`,
    "password printed in the README: " + live.map((l) => l.email).join(", ") + ".",
    "Change those passwords from Administration, deactivate the accounts, or run",
    "`npm run reset-book` (which keeps one account and forces its password to change).",
    "To run production with them anyway — a demo that carries nothing real — set",
    "MERIDIAN_ALLOW_DEMO_ACCOUNTS=1.",
  ].join("\n  ");
}

/**
 * Ce que l'écran Administration montre : les portes encore ouvertes, et
 * les réglages qui, fermés par défaut, attendent encore une décision.
 * Uniquement des FAITS que l'administrateur peut changer lui-même.
 */
export async function posture() {
  const live = await liveDemoAccounts();
  const st = await loadSettings();
  return {
    production: process.env.NODE_ENV === "production",
    demoAccountsLive: live,
    documentHostsSet: String(st.documentHosts ?? "").trim() !== "",
    notifyHostsSet: String(st.notifyHosts ?? "").trim() !== "",
    smtpConfigured: !!process.env.MERIDIAN_SMTP_URL,
    secureCookies: process.env.MERIDIAN_SECURE_COOKIES === "1",
    /* S-13 — l'exemption break-glass n'est pas cachée : elle est dite ici
       comme sur l'écran, avec la contre-mesure organisationnelle. */
    breakGlass: "An administrator account is exempt from segregation of duties: it may sign " +
      "every step of a change request, including one it raised. Every such signature is " +
      "recorded as break-glass in the audit trail. Run the portfolio from named group and " +
      "site accounts; keep administrator accounts for administration.",
  };
}

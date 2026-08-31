/**
 * Passer la main sur le compte d'administration.
 *
 *   npm run admin:handover -- --to comite@exemple.org --name "Comité produit"
 *   npm run admin:handover -- --to … --name … --retire ancien@exemple.org
 *   npm run admin:handover -- --to … --name … --dry-run
 *
 * Pourquoi une commande, et pas trois clics dans l'administration.
 *
 * Le geste qu'elle sert est celui d'une PASSATION : l'administrateur qui
 * part n'est pas toujours là pour le faire, et celui qui arrive n'a pas
 * encore de compte pour se connecter. Chercher à le faire depuis l'écran
 * suppose déjà résolu ce qu'on essaie de résoudre.
 *
 * Elle sert aussi le cas du repreneur : après `npm run restore`, aucun
 * compte n'a de mot de passe utilisable, et il faut bien qu'un premier
 * administrateur existe.
 *
 * ── L'ordre, qui n'est pas négociable ──────────────────────────────
 *
 * Le nouveau compte est créé ET vérifié — on rejoue réellement son mot de
 * passe contre scrypt — AVANT que l'ancien soit retiré. Retirer d'abord,
 * c'est risquer une instance que plus personne n'administre, et le
 * produit lui-même refuse de retirer le dernier administrateur actif pour
 * cette raison exacte.
 *
 * Le compte retiré est DÉSACTIVÉ, jamais supprimé : la piste d'audit le
 * référence, et une piste qui ne sait plus nommer qui a décidé n'est plus
 * une piste (règle I-19).
 */

import crypto from "node:crypto";
import { connect, close, one, tx, engine } from "../server/src/db.js";
import { createUser, setPassword, verifyPassword } from "../server/src/auth.js";
import { record } from "../server/src/audit.js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes("--" + name);

const to = flag("to");
const name = flag("name");
const retire = flag("retire");
const dryRun = has("dry-run");

if (!to || !name) {
  console.error("");
  console.error("  Usage: npm run admin:handover -- --to <email> --name \"<nom affiché>\"");
  console.error("                                 [--retire <email>] [--dry-run]");
  console.error("");
  process.exit(2);
}

/* Aucune migration ici, et c'est délibéré.
   Cette commande sert souvent une instance EN SERVICE, dont le binaire
   peut être plus ancien que le dépôt. Appliquer une migration sous un
   binaire qui ne l'attend pas met le service à terre — la 023, qui
   renomme la colonne du jeton de session, suffirait à refuser toutes les
   connexions en cours. Une passation d'administrateur ne touche que
   `app_user` et `session`, présentes à toutes les versions du schéma :
   elle n'a aucune raison de faire évoluer la base. */
await connect();

console.log("");
console.log(`  base        ${engine()}`);

const admins = await one(
  `SELECT count(*)::int AS n FROM app_user WHERE role = 'admin' AND active`);
console.log(`  administrateurs actifs  ${admins.n}`);

const clash = await one(`SELECT id, active FROM app_user WHERE lower(email) = lower($1)`, [to]);
if (clash) {
  console.error(`\n  ${to} existe déjà (${clash.id}). Choisissez une autre adresse,`);
  console.error(`  ou changez son mot de passe depuis l'administration.\n`);
  await close();
  process.exit(1);
}

let retiring = null;
if (retire) {
  retiring = await one(
    `SELECT id, display_name, role, active FROM app_user WHERE lower(email) = lower($1)`,
    [retire]);
  if (!retiring) {
    console.error(`\n  ${retire} : aucun compte à ce nom. Rien n'a été fait.\n`);
    await close();
    process.exit(1);
  }
  console.log(`  à retirer   ${retiring.display_name} (${retiring.id}, ${retiring.role}` +
              `${retiring.active ? "" : ", déjà inactif"})`);
}

if (dryRun) {
  console.log(`\n  --dry-run : créerait ${to} comme administrateur` +
              `${retiring ? `, puis désactiverait ${retire}` : ""}.`);
  console.log("  Rien n'a été écrit.\n");
  await close();
  process.exit(0);
}

/* 24 octets en base64url : impossible à deviner, encore recopiable une
   fois à la main. Il ne passe pas par la ligne de commande — il n'aurait
   rien à faire dans l'historique d'un terminal. */
const password = crypto.randomBytes(18).toString("base64url");

const id = await createUser({ email: to, displayName: name, role: "admin", password });
/* Le mot de passe a été affiché sur un écran : son porteur le change à la
   première connexion, et le serveur bloque toute écriture avant cela. */
await setPassword(id, password, { mustChange: true });

/* La vérification qui justifie l'ordre des opérations : on rejoue le mot
   de passe contre scrypt, comme le ferait une vraie connexion. Tant que
   ceci n'a pas répondu vrai, on ne retire personne. */
const fresh = await one(`SELECT pw_hash, pw_salt, active FROM app_user WHERE id = $1`, [id]);
const usable = fresh.active && await verifyPassword(password, fresh.pw_hash, fresh.pw_salt);
if (!usable) {
  console.error("\n  Le compte créé ne s'authentifie pas. Rien n'a été retiré.\n");
  await close();
  process.exit(1);
}

await tx(async (t) => {
  await record(t, null, {
    action: "Administrator handed over", entity: "app_user", entityId: id,
    detail: `${name} <${to}> created as admin at the console`,
    after: { email: to, role: "admin" },
  });

  if (retiring && retiring.active) {
    await t.query(
      `UPDATE app_user SET active = false, row_version = row_version + 1 WHERE id = $1`,
      [retiring.id]);
    /* Une session ouverte survivrait à la désactivation jusqu'à son
       expiration : la couper fait partie du retrait (R1.8). */
    await t.query(`DELETE FROM session WHERE user_id = $1`, [retiring.id]);
    await record(t, null, {
      action: "Administrator retired", entity: "app_user", entityId: retiring.id,
      detail: `${retiring.display_name} deactivated; ${name} holds administration`,
      before: { active: true }, after: { active: false },
    });
  }
});

console.log("");
console.log(`  Créé       ${name} <${to}>  (${id}, admin)`);
console.log(`  Mot de passe  ${password}`);
console.log(`  À changer à la première connexion — le serveur refuse toute`);
console.log(`  écriture tant que ce n'est pas fait.`);
if (retiring) {
  console.log("");
  console.log(`  Retiré     ${retiring.display_name} <${retire}> — désactivé, pas supprimé.`);
  console.log(`             Ses sessions sont coupées ; son nom reste dans la piste.`);
}
console.log("");

await close();

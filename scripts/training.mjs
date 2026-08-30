/**
 * A-11 — LE TERRAIN D'APPRENTISSAGE.
 *
 * « Le formateur qui prépare la session d'octobre à Houndé ne peut ni
 * faire manipuler le livre réel — chaque geste laisse une ligne d'audit
 * dans le registre de production, et la piste est en ajout seul par
 * conception — ni former sur un livre vide, où rien de ce qu'il veut
 * montrer n'existe. Il fera donc une démonstration au vidéoprojecteur, et
 * les huit personnes formées n'auront pas touché l'outil. »
 *
 * La mesure de clôture exige ZÉRO ligne d'audit ajoutée au livre réel.
 * Il n'y a qu'une façon honnête de la tenir : ne pas écrire dedans. Pas
 * de lignes marquées « formation » dans la production — ce serait salir
 * précisément le registre dont dépend le contrôle, et il faudrait ensuite
 * les en retirer, ce que la piste refuse à juste titre.
 *
 * Donc : une instance à part, sa propre base, son propre port. Elle
 * s'installe, elle sert une session, elle s'efface. Le livre réel ne sait
 * même pas qu'elle a existé.
 *
 *   npm run training           installe (si besoin) et démarre
 *   npm run training -- --reset   remet à zéro avant de démarrer
 *   npm run training -- --drop    efface tout et s'arrête
 *
 * Les comptes sont ceux du jeu de démonstration : sur un terrain
 * d'exercice, des identifiants connus sont une commodité et non un
 * risque — c'est le livre réel qui ne doit jamais en porter.
 */

import { rmSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/* Hors de l'arborescence du produit ET hors de la base de production :
   deux façons indépendantes de ne pas se tromper de livre. */
const DIR = process.env.MERIDIAN_TRAINING_DIR || join(tmpdir(), "meridian-training");
const PORT = process.env.MERIDIAN_TRAINING_PORT || "4180";

const args = process.argv.slice(2);
const wants = (f) => args.includes(f);

const say = (m) => console.log("  " + m);

if (wants("--drop")) {
  rmSync(DIR, { recursive: true, force: true });
  say(`terrain d'apprentissage effacé (${DIR})`);
  say("le livre de production n'a pas été touché — il ne sait pas qu'il a existé");
  process.exit(0);
}

if (wants("--reset") || !existsSync(DIR)) {
  const fresh = !existsSync(DIR);
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  say(fresh ? "premier démarrage — installation du terrain" : "remise à zéro du terrain");

  const seed = spawn(process.execPath, [join(ROOT, "server", "src", "seed.js"), "--force"], {
    /* PGLITE_DIR, et surtout PAS de DATABASE_URL : même si la machine en
       porte un pour la production, le terrain reste dans son coin. */
    env: { ...process.env, PGLITE_DIR: DIR, DATABASE_URL: "", MERIDIAN_DATABASE_URL: "" },
    stdio: "inherit",
  });
  seed.on("exit", (code) => {
    if (code !== 0) { console.error("  ! l'installation a échoué"); process.exit(code ?? 1); }
    start();
  });
} else {
  start();
}

function start() {
  console.log("");
  say(`terrain d'apprentissage : http://localhost:${PORT}`);
  say(`base : ${DIR}  (à part du livre de production)`);
  say("comptes : ceux du jeu de démonstration — voir le README");
  say("pour repartir de zéro : npm run training -- --reset");
  say("pour tout effacer     : npm run training -- --drop");
  console.log("");
  const srv = spawn(process.execPath, [join(ROOT, "server", "src", "index.js")], {
    env: { ...process.env, PGLITE_DIR: DIR, PORT, DATABASE_URL: "", MERIDIAN_DATABASE_URL: "",
           /* Le bandeau que le formateur veut voir : personne ne doit
              confondre ce terrain avec le livre du groupe. */
           MERIDIAN_TRAINING: "1" },
    stdio: "inherit",
  });
  const stop = () => { srv.kill("SIGINT"); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  srv.on("exit", (code) => process.exit(code ?? 0));
}

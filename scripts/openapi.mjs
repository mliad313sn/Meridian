/**
 * Écrit `docs/openapi.v1.json` depuis les routes réellement montées.
 *
 *   npm run openapi
 *
 * Le fichier est publié dans le dépôt parce qu'un intégrateur le lit
 * AVANT d'avoir une instance et une clé. La porte F9 vérifie ensuite
 * qu'il n'a pas dérivé — le régénérer sans relire le diff serait passer
 * à côté de ce qu'elle protège.
 */

import fs from "node:fs";
import path from "node:path";
import { openApiDocument } from "../server/src/openapi.js";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = path.join(root, "docs/openapi.v1.json");

const doc = openApiDocument({ version: pkg.version });
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");

const paths = Object.keys(doc.paths).length;
console.log("");
console.log(`  écrit  docs/openapi.v1.json`);
console.log(`         OpenAPI ${doc.openapi} · Meridian ${doc.info.version} · ${paths} chemin(s)`);
console.log("");

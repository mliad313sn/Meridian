/**
 * REQ-52 — the schema as the migrations write it, read once for every
 * gate that needs to know which tables and columns the product owns.
 *
 * Two readings are taken and compared, because a gate that reads the
 * schema with a pattern has its own blind spot: a statement the pattern
 * does not recognise is a table the gate does not see (C-03 found six
 * that way — `IF NOT EXISTS` was not understood). `names` is the loosest
 * possible reading, one name per `CREATE TABLE`; `tables` is the reading
 * with columns. A name in the first and not in the second is a table this
 * module could not read, and `unreadable` says so instead of dropping it.
 * server/test/gate-lists.test.js holds both against the live schema.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

export function migrationSql() {
  const dir = path.join(root, "server/migrations");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
}

/** { tables: {name: [columns]}, names: [every CREATE TABLE], unreadable: [...] } */
export function migrationSchema(sql = migrationSql()) {
  const names = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)]
    .map((m) => m[1].toLowerCase());
  const tables = {};
  const versioned = new Set();
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = [];
    /* Split on the commas at depth 0, not on lines: `bac numeric, ac
       numeric, ev numeric` is three columns on one line, and reading line
       by line saw only the first (report_snapshot's ac, ev, pv, cpi, eac
       and vac were unseen until gate-lists.test.js compared). */
    const body = m[2].split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
    const defs = [];
    let depth = 0, cur = "";
    for (const ch of body) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { defs.push(cur); cur = ""; continue; }
      cur += ch;
    }
    defs.push(cur);
    for (const def of defs) {
      const t = def.trim();
      if (!t || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b/i.test(t)) continue;
      const c = /^(\w+)\s+/.exec(t);
      if (!c) continue;
      if (c[1] === "row_version") versioned.add(m[1]);
      if (!["id", "row_version", "created_at"].includes(c[1])) cols.push(c[1]);
    }
    tables[m[1]] = cols;
  }
  /* A column added by a later migration is a column like any other. */
  for (const m of sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g)) {
    /* `row_version` is the concurrency token, held by version-audit, and
       left out of the field list exactly as it is when CREATE TABLE
       declares it — the old reading counted it as a field only when a
       later ALTER added it (site, programme, person, board_column,
       meeting_decision). */
    if (m[2] === "row_version") { versioned.add(m[1]); continue; }
    if (tables[m[1]] && !tables[m[1]].includes(m[2])) tables[m[1]].push(m[2]);
  }
  /* A column renamed later is read under its new name. */
  for (const m of sql.matchAll(/ALTER TABLE (\w+)\s+RENAME COLUMN (\w+) TO (\w+)/g)) {
    const cols = tables[m[1]];
    const i = cols ? cols.indexOf(m[2]) : -1;
    if (i >= 0) cols[i] = m[3];
  }
  const unreadable = [...new Set(names)].filter((n) => !(n in tables));
  return { tables, names: [...new Set(names)].sort(), unreadable, versioned };
}

/**
 * M-01 — la réversibilité.
 *
 * Le comité de marché a nommé l'obstacle que ni la sécurité ni l'adoption
 * ne voyaient : « et dans trois ans ? ». Un acheteur n'accepte pas de
 * confier un portefeuille à un outil dont il ne sait pas comment ressortir.
 * La moitié de la réponse existait déjà — CSV de portefeuille, dossier de
 * preuve en Markdown, JSON du livre. Il manquait les deux moitiés qui
 * comptent : **la piste d'audit**, qui est ce qu'un auditeur vient
 * chercher, et **un chemin de retour**, sans lequel un export n'est qu'un
 * fichier.
 *
 * ── Ce que ce module N'EST PAS ────────────────────────────────────────
 *
 * Ce n'est pas une sauvegarde. G-01 et G-02 demandent un `pg_dump` et une
 * restauration chronométrée, et cela reste vrai après ce module. Les deux
 * outils se ressemblent et répondent à deux questions différentes :
 *
 *   sauvegarde    « comment revenir à hier soir sur CE serveur ? »
 *   archive       « comment tout emporter ailleurs, sans nous ? »
 *
 * D'où une différence délibérée : **l'archive ne contient aucun secret.**
 * Ni jeton de session, ni empreinte de mot de passe. Elle peut donc partir
 * chez un séquestre, un auditeur ou un successeur sans qu'aucune décision
 * de sécurité n'ait à être prise à ce moment-là — et à la restauration,
 * chacun repart d'un mot de passe posé par l'administrateur. Une
 * sauvegarde, elle, contient tout et ne sort pas du coffre.
 *
 * ── L'ordre des tables ────────────────────────────────────────────────
 *
 * Il n'est pas écrit à la main. Une liste d'ordre d'insertion se périme au
 * premier ajout de table, silencieusement, et c'est la restauration — le
 * jour où l'on en a besoin — qui découvre l'oubli. Il est déduit du graphe
 * des clés étrangères lu dans `information_schema`, donc toujours à jour.
 */

import { many, query, tx, engine, insertMany, assertIdentifiers } from "./db.js";

export const ARCHIVE_FORMAT = 1;

/** Jamais archivé, et pour deux raisons différentes. */
const NEVER_ARCHIVED = new Set([
  "session",           // des secrets, et vivants douze heures : rien à emporter
  "schema_migration",  // reconstruit par migrate(), jamais rejoué depuis un fichier
]);

/**
 * Colonnes retirées de l'archive : ce qui ouvre une porte n'en sort pas.
 * La valeur est ce qui les remplace au retour — `pw_hash` est NOT NULL, il
 * faut donc poser le remplaçant À L'INSERTION et pas après coup, sinon la
 * restauration bute sur la contrainte avant d'avoir écrit une ligne.
 * `'unusable'` n'est l'empreinte scrypt de rien : aucun mot de passe ne
 * peut la produire, donc aucun ne l'ouvre.
 */
const REDACTED = {
  app_user: { pw_hash: "unusable", pw_salt: "unusable" },
};

/**
 * Toutes les tables applicatives, dans un ordre où l'on peut les insérer.
 *
 * Le graphe des clés étrangères de ce schéma contient de vrais cycles, et
 * c'est légitime : un site nomme son référent, qui est une personne, et
 * une personne appartient à un site (`site.champion_id` ↔ `person.site_id`,
 * A-12). Aucun ordre de tables ne satisfait les deux.
 *
 * Un cycle se casse donc sur une colonne NULLABLE : cette colonne-là est
 * laissée vide à l'insertion et reposée une fois toutes les tables en
 * place. Une colonne NOT NULL ne peut pas servir à cela — si un cycle n'en
 * contient aucune, la restauration est réellement impossible et on le dit,
 * plutôt que de rendre un ordre qui échouera un jour sur une autre
 * machine.
 *
 * Les auto-références (une activité qui suit une autre activité) ne
 * contraignent pas l'ordre DES tables : un INSERT multi-lignes vérifie ses
 * contraintes en fin d'instruction, pas entre deux tuples.
 */
export async function tableOrder() {
  const tables = (await many(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )).map((r) => r.t).filter((t) => !NEVER_ARCHIVED.has(t));

  const known = new Set(tables);
  /* `pg_constraint` plutôt que `information_schema` : la nullabilité de la
     colonne portante s'y lit dans la même requête, et PGlite comme
     PostgreSQL répondent identiquement. */
  const fks = await many(
    `SELECT c.conrelid::regclass::text  AS child,
            c.confrelid::regclass::text AS parent,
            a.attname                   AS col,
            a.attnotnull                AS notnull
       FROM pg_constraint c
       JOIN unnest(c.conkey) AS k(attnum) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      WHERE c.contype = 'f'`);

  const edges = fks.filter(
    (e) => e.child !== e.parent && known.has(e.child) && known.has(e.parent));

  const deps = new Map(tables.map((t) => [t, new Map()]));   // table → parent → edge
  for (const e of edges) deps.get(e.child).set(e.parent, e);

  const order = [];
  const placed = new Set();
  const deferred = [];

  while (placed.size < tables.length) {
    const waiting = tables.filter((t) => !placed.has(t));
    const ready = waiting.filter((t) => [...deps.get(t).keys()].every((p) => placed.has(p)));

    if (ready.length) {
      for (const t of ready.sort()) { order.push(t); placed.add(t); }
      continue;
    }

    /* Bloqué : tout ce qui reste attend quelque chose qui reste. On coupe
       une seule arête et on reprend — mais seulement une arête RÉELLEMENT
       dans un cycle, c'est-à-dire dont le parent peut redescendre jusqu'à
       l'enfant. Sans cette restriction on coupe la première arête nullable
       venue, qui n'est bloquante pour personne : `access_grant.programme_id`
       est nullable, sort avant dans l'alphabet, et se retrouverait vidée —
       violant du même coup la contrainte qui exige un programme OU un
       site. Différer une colonne a un coût ; on ne le paie que sur les
       colonnes qui l'imposent. */
    /* « ce parent dépend-il, de proche en proche, de son propre enfant ? »
       On suit les dépendances DANS LE SENS où elles sont posées : partir du
       parent et descendre ce dont IL a besoin. Les suivre à l'envers
       répondrait « qui dépend de lui », ce qui est vrai pour l'enfant par
       construction — et déclarerait alors chaque arête circulaire. */
    const reaches = (from, to) => {
      const seen = new Set([from]);
      const stack = [from];
      while (stack.length) {
        const cur = stack.pop();
        for (const next of deps.get(cur)?.keys() ?? []) {
          if (next === to) return true;
          if (seen.has(next) || placed.has(next)) continue;
          seen.add(next);
          stack.push(next);
        }
      }
      return false;
    };
    const cut = waiting
      .flatMap((t) => [...deps.get(t).values()])
      .filter((e) => !e.notnull && !placed.has(e.parent))
      .filter((e) => reaches(e.parent, e.child))
      .sort((a, b) => (a.child + a.col).localeCompare(b.child + b.col))[0];

    if (!cut) {
      throw new Error(
        `Cycle de clés étrangères sans colonne nullable pour le rompre : ` +
        `${waiting.join(", ")}. L'archive ne peut pas être rechargée en l'état.`);
    }
    deps.get(cut.child).delete(cut.parent);
    deferred.push({ table: cut.child, column: cut.col, parent: cut.parent });
  }

  return { order, deferred };
}

/**
 * Les colonnes json/jsonb, par table.
 *
 * Le pilote rend une colonne jsonb DÉJÀ analysée : `app_setting.value`
 * arrive comme la chaîne JavaScript `MERIDIAN`, pas comme le texte
 * `"MERIDIAN"`. Réinsérée telle quelle, PostgreSQL refuse — « Token
 * "MERIDIAN" is invalid » — parce qu'une chaîne nue n'est pas du JSON.
 * Il faut donc re-sérialiser à l'aller. Détecté dans le catalogue plutôt
 * qu'énuméré ici : la prochaine colonne jsonb ajoutée au schéma ne doit
 * pas casser une restauration deux ans plus tard.
 */
async function jsonColumns(tables) {
  const rows = await many(
    `SELECT table_name AS t, column_name AS col
       FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')`);
  const out = new Map();
  for (const r of rows) {
    if (!tables.includes(r.t)) continue;
    if (!out.has(r.t)) out.set(r.t, new Set());
    out.get(r.t).add(r.col);
  }
  return out;
}

/** L'identifiant d'une table, pour reposer une colonne après coup. */
async function primaryKeys(tables) {
  const rows = await many(
    `SELECT c.conrelid::regclass::text AS t, a.attname AS col
       FROM pg_constraint c
       JOIN unnest(c.conkey) AS k(attnum) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      WHERE c.contype = 'p'`);
  const out = new Map();
  for (const r of rows) {
    if (!tables.includes(r.t)) continue;
    if (!out.has(r.t)) out.set(r.t, []);
    out.get(r.t).push(r.col);
  }
  return out;
}

/**
 * Le livre entier plus la piste, dans un seul document ouvert.
 * `issuedTo` n'est pas décoratif : un export anonyme qui se retrouve sur
 * une clé USB ne dit plus d'où il vient (même règle que G-17).
 */
export async function buildArchive({ issuedTo = "unknown", at = new Date() } = {}) {
  const { order, deferred } = await tableOrder();
  const tables = {};
  let rows = 0;
  for (const t of order) {
    assertIdentifiers([t]);
    const drop = Object.keys(REDACTED[t] ?? {});
    const data = (await many(`SELECT * FROM ${t}`)).map((row) => {
      if (!drop.length) return row;
      const copy = { ...row };
      for (const c of drop) delete copy[c];
      return copy;
    });
    tables[t] = data;
    rows += data.length;
  }
  return {
    meridian: "archive",
    format: ARCHIVE_FORMAT,
    classification: "INTERNAL — Meridian IT-PMO complete archive, book and audit trail",
    generatedAt: at.toISOString(),
    issuedTo,
    engine: engine(),
    order,
    /* Les colonnes qu'une restauration doit reposer après coup, parce que
       le schéma tourne en rond à cet endroit. Écrites dans le fichier : la
       machine qui recharge n'a pas à redécouvrir le cycle, et un lecteur
       humain voit tout de suite où il est. */
    deferred,
    /* Dit en toutes lettres ce que le fichier ne contient pas, pour que
       personne ne le prenne un jour pour une sauvegarde. */
    excludes: ["session", "schema_migration", "app_user.pw_hash", "app_user.pw_salt"],
    counts: Object.fromEntries(order.map((t) => [t, tables[t].length])),
    totalRows: rows,
    tables,
  };
}

/** Ce qu'une archive doit présenter avant qu'on ouvre une transaction. */
export function validateArchive(doc) {
  const bad = (why) => { throw new Error(`Archive refusée : ${why}`); };
  if (!doc || typeof doc !== "object") bad("ce n'est pas un document JSON");
  if (doc.meridian !== "archive") bad("ce fichier n'est pas une archive Meridian");
  if (doc.format !== ARCHIVE_FORMAT) {
    bad(`format ${doc.format} — cette version lit le format ${ARCHIVE_FORMAT}`);
  }
  if (!Array.isArray(doc.order) || !doc.tables) bad("il manque l'ordre ou les tables");
  for (const t of doc.order) {
    if (!Array.isArray(doc.tables[t])) bad(`la table ${t} est annoncée et absente`);
  }
  return true;
}

/**
 * Recharge une archive dans une instance MIGRÉE et VIDE.
 *
 * Refuse une base qui porte déjà un portefeuille, sauf `force` explicite :
 * la manière dont on perd un livre est de restaurer par-dessus, et le geste
 * doit être voulu, pas subi.
 *
 * Les comptes reviennent avec un mot de passe INUTILISABLE et
 * `must_change_password`. Personne ne se reconnecte tant qu'un
 * administrateur ne lui a pas posé un mot de passe — ce qui est exactement
 * ce qu'on veut d'une reprise chez un tiers.
 */
export async function restoreArchive(doc, { force = false, onProgress = null } = {}) {
  validateArchive(doc);

  const existing = await many(`SELECT count(*)::int AS n FROM project`);
  if ((existing[0]?.n ?? 0) > 0 && !force) {
    throw new Error(
      `La base porte déjà ${existing[0].n} projet(s). ` +
      `Restaurer par-dessus efface ce livre : relancez avec --force si c'est voulu.`);
  }

  const order = doc.order.filter((t) => !NEVER_ARCHIVED.has(t));
  const written = {};

  /* Les colonnes reportées, par table. Une archive du format 1 les
     annonce ; si le champ manque, on ne devine pas — on recalcule contre
     le schéma présent, qui est celui dans lequel on insère. */
  const deferred = Array.isArray(doc.deferred) ? doc.deferred : (await tableOrder()).deferred;
  const deferredBy = new Map();
  for (const d of deferred) {
    if (!deferredBy.has(d.table)) deferredBy.set(d.table, []);
    deferredBy.get(d.table).push(d.column);
  }
  const pks = await primaryKeys(order);
  const jsonCols = await jsonColumns(order);

  await tx(async (t) => {
    /* Vider avant d'écrire, toujours — pas seulement sous `--force`.
       Une base « vide » ne l'est pas : les migrations préremplissent des
       tables de référence, `id_counter` la première, et l'insertion entre
       alors en collision de clé sur une base qu'on croyait neuve. C'est
       ce que la première reprise pour de vrai a montré, et qu'aucun test
       ne montrait : les suites partent d'un schéma migré ET semé, jamais
       d'un schéma migré seul.

       `force` ne gouverne donc pas cette ligne : il gouverne le refus
       plus haut, celui de passer sur un livre vivant.

       Ordre inverse des dépendances, sinon la première table parente
       refuse de partir. `audit_event` et `report_period` portent une
       règle DO INSTEAD NOTHING sur DELETE : TRUNCATE est le seul geste
       qui les vide, et il est ici assumé — on est dans une reprise, pas
       dans une correction. */
    for (const table of [...order].reverse()) {
      assertIdentifiers([table]);
      await t.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    for (const table of order) {
      const rows = doc.tables[table] ?? [];
      if (!rows.length) { written[table] = 0; continue; }
      assertIdentifiers([table]);

      /* Les colonnes viennent des données, pas d'un schéma figé dans ce
         fichier : une archive plus ancienne qu'une colonne ajoutée depuis
         se recharge, la colonne prenant son défaut. */
      const fill = REDACTED[table] ?? {};
      const columns = [...new Set([...rows.flatMap((r) => Object.keys(r)), ...Object.keys(fill)])];
      assertIdentifiers(columns);

      /* Une table qui se référence elle-même (une activité qui suit une
         autre) s'insère en un seul INSERT multi-lignes : PostgreSQL
         vérifie la contrainte à la fin de l'instruction, pas entre deux
         tuples, donc l'ordre à l'intérieur du lot n'a pas d'importance. */
      const hold = deferredBy.get(table) ?? [];
      const asJson = jsonCols.get(table) ?? new Set();
      const toInsert = rows.map((row) => {
        const out = { ...row, ...fill };
        for (const c of hold) out[c] = null;
        for (const c of asJson) if (out[c] !== undefined) out[c] = JSON.stringify(out[c] ?? null);
        return out;
      });
      await insertMany(t, table, columns, toInsert);
      written[table] = rows.length;
      onProgress?.(table, rows.length);
    }

    /* Toutes les tables sont là : les colonnes mises de côté pour rompre
       un cycle peuvent être reposées. Ligne à ligne, et c'est voulu — par
       construction il n'y en a qu'une poignée, et une boucle qu'on relit
       vaut mieux ici qu'un UPDATE ... FROM (VALUES …) qu'on relit mal. */
    for (const { table, column } of deferred) {
      const key = pks.get(table);
      if (!key?.length) {
        throw new Error(
          `${table}.${column} doit être reposée après coup, mais la table n'a pas de clé primaire`);
      }
      assertIdentifiers([table, column, ...key]);
      const where = key.map((k, i) => `${k} = $${i + 2}`).join(" AND ");
      for (const row of doc.tables[table] ?? []) {
        if (row[column] == null) continue;
        await t.query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${where}`,
          [row[column], ...key.map((k) => row[k])]);
      }
    }

    /* Les séquences.
     *
     * `audit_event.id` est un `bigserial`. Recharger 5 000 lignes d'audit
     * dans une base neuve laisse la séquence à 1 : la PREMIÈRE écriture du
     * produit réclame l'identifiant 1, qui est déjà pris, et échoue. Comme
     * toute mutation passe par `audited()`, plus rien ne s'écrit — un
     * portefeuille restauré, complet, et en lecture seule sans que
     * personne ait décidé qu'il le serait.
     *
     * TRUNCATE ne remet pas les séquences à zéro (il faudrait RESTART
     * IDENTITY) et l'INSERT explicite ne les avance pas non plus : elles
     * ne bougent que si on les repositionne ici. Le compte des lignes,
     * lui, était juste — c'est pour cela qu'une vérification par comptage
     * ne suffisait pas à voir le défaut. */
    const serials = (await t.query(
      `SELECT c.relname AS tbl, a.attname AS col,
              pg_get_serial_sequence(c.relname, a.attname) AS seq
         FROM pg_class c
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relkind = 'r' AND pg_get_serial_sequence(c.relname, a.attname) IS NOT NULL`)).rows;
    for (const s of serials) {
      if (!order.includes(s.tbl)) continue;
      assertIdentifiers([s.tbl, s.col]);
      /* `false` en troisième argument : la prochaine valeur servie est
         celle qu'on pose, et non la suivante — donc max+1 sur une table
         pleine, et 1 sur une table vide. */
      await t.query(
        `SELECT setval($1, COALESCE((SELECT max(${s.col}) FROM ${s.tbl}), 0) + 1, false)`,
        [s.seq]);
    }

    /* Les empreintes sont déjà posées à `unusable` par REDACTED ; reste à
       dire à l'interface pourquoi, plutôt que de laisser quelqu'un
       conclure que son mot de passe « ne marche plus ». */
    await t.query(`UPDATE app_user SET must_change_password = true`);
  });

  return { tables: written, totalRows: Object.values(written).reduce((a, b) => a + b, 0) };
}

/**
 * Le contrôle qu'un auditeur ferait lui-même : recompter, après coup, ce
 * qui est réellement dans la base, et le comparer à ce que l'archive
 * annonçait. Une restauration qui se déclare réussie sans se relire n'est
 * pas une preuve de réversibilité, c'est une intention.
 */
export async function verifyRestore(doc) {
  const mismatches = [];
  for (const table of doc.order) {
    if (NEVER_ARCHIVED.has(table)) continue;
    assertIdentifiers([table]);
    const { rows } = await query(`SELECT count(*)::int AS n FROM ${table}`);
    const found = rows[0]?.n ?? 0;
    const expected = doc.tables[table]?.length ?? 0;
    if (found !== expected) mismatches.push({ table, expected, found });
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * Database adapter (AD-5).
 *
 * One interface, two engines:
 *   · `pg` against a real PostgreSQL cluster when DATABASE_URL is set
 *   · PGlite — PostgreSQL compiled to WASM — otherwise
 *
 * Same SQL, same parser, same planner, so a migration that runs in dev
 * runs in production. Nothing above this file knows which is in use.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/* A packaged build ships the .sql files beside the executable rather than
   two directories above a source file that no longer exists on disk.
   Resolved when it is READ, not when this module loads: in a bundled
   build every import is evaluated before the entry point has had a
   chance to set the variable. */
export const migrationsDir = () =>
  process.env.MERIDIAN_MIGRATIONS || join(HERE, "..", "migrations");

let impl = null;
let engineName = "none";

/* ── date normalisation ───────────────────────────────────────────────
   Both drivers hand back JS `Date` objects for date and timestamp
   columns. The engine, the API contract and every screen speak plain
   ISO strings, and a `Date` silently reintroduces the local timezone —
   which on a machine west of UTC turns a milestone due on the 31st into
   the 30th. So results are normalised once, here, using the column type
   metadata both drivers already return. */
const OID_DATE = 1082;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;

const asDate = (v) =>
  v instanceof Date
    ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
    : String(v).slice(0, 10);
const asStamp = (v) => (v instanceof Date ? v.toISOString() : String(v));

function normaliseDates(res) {
  /* The two engines disagree on what to call "how many rows did that
     touch": `pg` says rowCount, PGlite says affectedRows. A caller should
     not have to know which one is underneath — that is this module's
     whole job — so the missing name is filled in here. Without it every
     `r.rowCount` in the codebase silently reads undefined on PGlite, and
     a route answers 404 "no such row" about a row it has just updated:
     a bug that appears only on the embedded engine, which is exactly
     where the least experienced deployment runs. */
  if (res && typeof res === "object" && res.rowCount === undefined
      && typeof res.affectedRows === "number") {
    res.rowCount = res.affectedRows;
  }
  if (!res || !Array.isArray(res.rows) || !Array.isArray(res.fields)) return res;
  const dateCols = [];
  const stampCols = [];
  for (const f of res.fields) {
    if (f.dataTypeID === OID_DATE) dateCols.push(f.name);
    else if (f.dataTypeID === OID_TIMESTAMP || f.dataTypeID === OID_TIMESTAMPTZ) stampCols.push(f.name);
  }
  if (!dateCols.length && !stampCols.length) return res;
  for (const row of res.rows) {
    for (const c of dateCols) if (row[c] != null) row[c] = asDate(row[c]);
    for (const c of stampCols) if (row[c] != null) row[c] = asStamp(row[c]);
  }
  return res;
}

/* ── engines ──────────────────────────────────────────────────────── */

async function openPg(url) {
  const { default: pg } = await import("pg");
  /* Every one of these has a default of "wait forever", which is how a
     single slow query becomes an outage: the pool fills with connections
     nobody is going to get an answer from, and every subsequent request
     queues behind them. Bound each one instead. */
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    // give up rather than queue forever when the pool is exhausted
    connectionTimeoutMillis: 5_000,
    // reclaim connections an idle worker is holding
    idleTimeoutMillis: 30_000,
    // no single statement may run away with a connection
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 15_000),
    // a transaction left open by a crashed handler must not hold locks
    idle_in_transaction_session_timeout: 30_000,
    application_name: "meridian-itpmo",
  });
  pool.on("error", (err) => {
    // A backend that dies while idle in the pool must not take the
    // process with it — the pool will open a fresh one on demand.
    console.error("postgres pool error:", err.message);
  });
  // numeric comes back as a string by default so precision survives the
  // wire; we convert deliberately at the edges, never implicitly.
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1082, (v) => v); // date → keep ISO text
  await pool.query("SELECT 1");
  return {
    name: "postgres",
    query: (text, params) => pool.query(text, params).then(normaliseDates),
    // libpq's simple query protocol already accepts several statements
    // in one string, so exec and query differ only for PGlite.
    exec: (text) => pool.query(text).then(normaliseDates),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          query: (t, p) => client.query(t, p).then(normaliseDates),
          exec: (t) => client.query(t).then(normaliseDates),
        });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/**
 * PGlite is a single-process engine: nothing else can legitimately hold
 * its data directory. So a lock file present at startup is always stale —
 * left by a process that was killed rather than stopped — and refusing to
 * start over it just makes people delete the database by hand.
 */
async function clearStaleLocks(dataDir) {
  if (!dataDir) return;
  const { readdir, rm } = await import("node:fs/promises");
  let entries;
  try { entries = await readdir(dataDir); } catch { return; }
  const stale = entries.filter((f) => f === "postmaster.pid" || f.startsWith(".s.PGSQL."));
  for (const f of stale) {
    await rm(join(dataDir, f), { force: true }).catch(() => {});
  }
  if (stale.length) console.log(`  cleared ${stale.length} stale lock file(s) from a previous run`);
}

async function openPglite(dataDir) {
  const { PGlite } = await import("@electric-sql/pglite");
  await clearStaleLocks(dataDir);
  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  await pglite.waitReady;

  /* PGlite is single-connection, so a transaction has to serialise. The
     queue keeps concurrent requests from interleaving statements inside
     someone else's BEGIN — which would be a correctness bug, not a
     performance one. */
  let chain = Promise.resolve();
  const serial = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  };

  /* A module-level query issued from inside a transaction would queue
     behind the transaction that is waiting for it — a deadlock that
     hangs the request rather than failing it, which is the worst kind of
     bug to find in production. So it is refused, loudly, and the caller
     is told what to do instead: read the value before opening the
     transaction, or use the transaction's own handle. */
  let depth = 0;
  const guard = () => {
    if (depth > 0) {
      throw new Error(
        "A database call was made outside the current transaction while that " +
        "transaction was open. Read the value before the transaction, or use " +
        "the `t` handle passed to tx()/audited()."
      );
    }
  };

  /* PGlite's `query` is the extended protocol — one statement, with
     parameters. `exec` is the simple protocol, which is what a migration
     file needs. `pg` collapses the distinction; here it is explicit. */
  const normalise = (r) => normaliseDates(Array.isArray(r) ? (r.at(-1) ?? { rows: [] }) : r);

  return {
    name: "pglite",
    query: (text, params) => {
      guard();
      return serial(() => (params?.length
        ? pglite.query(text, params).then(normaliseDates)
        : pglite.exec(text).then(normalise)));
    },
    exec: (text) => { guard(); return serial(() => pglite.exec(text).then(normalise)); },
    async tx(fn) {
      guard();
      return serial(async () => {
        await pglite.exec("BEGIN");
        depth++;
        try {
          const out = await fn({
            query: (t, p) => (p?.length ? pglite.query(t, p).then(normaliseDates) : pglite.exec(t).then(normalise)),
            exec: (t) => pglite.exec(t).then(normalise),
          });
          depth--;
          await pglite.exec("COMMIT");
          return out;
        } catch (e) {
          depth--;
          await pglite.exec("ROLLBACK").catch(() => {});
          throw e;
        }
      });
    },
    close: () => pglite.close(),
  };
}

/* ── lifecycle ────────────────────────────────────────────────────── */

export async function connect(opts = {}) {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) impl = await openPg(url);
  else impl = await openPglite(opts.dataDir ?? process.env.PGLITE_DIR ?? null);
  engineName = impl.name;
  return impl;
}

export function engine() {
  return engineName;
}

function need() {
  if (!impl) throw new Error("database not connected — call connect() first");
  return impl;
}

export const query = (text, params) => need().query(text, params);
export const exec = (text) => need().exec(text);
export const tx = (fn) => need().tx(fn);
export const close = async () => {
  if (impl) await impl.close();
  impl = null;
  engineName = "none";
};

/** First row, or null. */
export async function one(text, params) {
  const r = await query(text, params);
  return r.rows[0] ?? null;
}
/** All rows. */
export async function many(text, params) {
  const r = await query(text, params);
  return r.rows;
}

/* ── migrations (R2.2) ────────────────────────────────────────────── */

/**
 * Ordered by filename, applied once, recorded. Re-running is a no-op,
 * which is what makes deployment safe to repeat.
 */
export async function migrate({ silent = false } = {}) {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const dir = migrationsDir();
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const done = new Set(
    (await many("SELECT name FROM schema_migration")).map((r) => r.name)
  );

  /* SaaS-02 — la base est-elle PLUS RÉCENTE que ce binaire ?
     Le piège a été vécu, pas imaginé : la passation d'administrateur a
     failli appliquer la 023 (renommage de la colonne du jeton) sous le
     binaire de production qui lisait encore l'ancien nom — toutes les
     connexions auraient échoué, requête par requête, sans qu'aucun
     message ne dise pourquoi. Un binaire ancien sur une base neuve doit
     refuser NET, ici, avant de toucher quoi que ce soit : dans une
     flotte, c'est ce qui rend une montée de version ratée bruyante au
     lieu de sournoise. */
  const local = new Set(files);
  const ahead = [...done].filter((name) => !local.has(name)).sort();
  if (ahead.length) {
    throw new Error(
      `This database carries ${ahead.length} migration(s) this binary does not know ` +
      `(${ahead.join(", ")}). The binary is older than the database: deploy the ` +
      `current version instead of starting this one — running on would fail ` +
      `query by query, with no message saying why.`);
  }

  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), "utf8");
    await tx(async (t) => {
      await t.exec(sql);
      await t.query("INSERT INTO schema_migration (name) VALUES ($1)", [file]);
    });
    applied.push(file);
    if (!silent) console.log(`  migrated  ${file}`);
  }
  if (!silent && !applied.length) console.log("  schema already current");
  return applied;
}

/**
 * Atomic identifier allocation.
 *
 * The previous approach read `MAX(id)` and added one. Under a single
 * connection that is atomic by accident; behind a pool two requests read
 * the same maximum, compute the same identifier, and the loser gets a
 * primary-key violation surfaced as a confusing 409. The development
 * engine was hiding the bug rather than the bug not existing.
 *
 * `UPDATE … RETURNING` takes a row lock for the rest of the transaction,
 * so concurrent allocations queue instead of colliding. Must be called
 * with the transaction handle, so the identifier and the row it names
 * commit or roll back together.
 *
 * @param t       transaction handle from tx()/audited()
 * @param prefix  'PRJ' | 'RSK' | 'CR' | …
 * @param step    how far to advance (the project register counts by 3)
 * @param pad     zero-pad the number to this width
 */
export async function allocateId(t, prefix, { step = 1, pad = 0 } = {}) {
  const r = await t.query(
    `UPDATE id_counter SET next_value = next_value + $2
      WHERE prefix = $1
      RETURNING next_value`,
    [prefix, step]
  );
  if (!r.rows.length) {
    // A prefix the migration did not seed — create it and take the first.
    await t.query(
      `INSERT INTO id_counter (prefix, next_value) VALUES ($1, $2)
       ON CONFLICT (prefix) DO UPDATE SET next_value = id_counter.next_value + $2`,
      [prefix, step]
    );
    const again = await t.query(
      `SELECT next_value FROM id_counter WHERE prefix = $1`, [prefix]);
    return format(prefix, again.rows[0].next_value, pad);
  }
  return format(prefix, r.rows[0].next_value, pad);
}

const format = (prefix, n, pad) =>
  `${prefix}-${pad ? String(n).padStart(pad, "0") : String(n)}`;

/**
 * Multi-row insert.
 *
 * Creating a project wrote a schedule, four gates, four evidence
 * documents and an allocation as ~25 separate statements. On one
 * connection that is 25 serialised round trips; on a pooled cluster it
 * is 25 network hops holding a transaction open. One statement per table
 * does the same work.
 *
 * Column names come from the caller as literals — never from a request —
 * and every value is still bound as a parameter.
 */
export async function insertMany(t, table, columns, rows, { onConflict = "" } = {}) {
  if (!rows.length) return { rowCount: 0 };
  assertIdentifiers([table, ...columns]);

  const params = [];
  const tuples = rows.map((row) => {
    const slots = columns.map((c) => {
      params.push(row[c] ?? null);
      return `$${params.length}`;
    });
    return `(${slots.join(",")})`;
  });

  return t.query(
    `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")} ${onConflict}`,
    params
  );
}

/**
 * Identifiers reaching SQL by interpolation are all server-side literals
 * today. This asserts it, so the day someone passes a request key
 * through it fails loudly here rather than quietly becoming an injection.
 */
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;
export function assertIdentifiers(names) {
  for (const n of names) {
    if (!SAFE_IDENT.test(n)) {
      throw new Error(`Refusing to build SQL with an unsafe identifier: ${JSON.stringify(n)}`);
    }
  }
}

/**
 * The version a read-modify-write must name.
 *
 * `Number(body.version ?? row.row_version)` reads like a concurrency
 * check and is not one: falling back to the value the request itself just
 * read means the assertion can never fail, so the last write always wins.
 * That is worse than no check, because it stops anyone looking.
 *
 * It lives here rather than in one route file because the same defect was
 * fixed on the administration routes and left on thirteen others — the
 * half-closure a cross-committee pass exists to find.
 */
export class PreconditionRequired extends Error {
  constructor(what) {
    super(`This ${what} edit did not say which version it is based on. Reload and try again.`);
    this.status = 428;
  }
}

export function requiredVersion(body, what) {
  const v = Number(body?.version);
  if (!Number.isInteger(v) || v < 1) throw new PreconditionRequired(what);
  return v;
}

/**
 * Optimistic concurrency (AD-6 / R2.5).
 *
 * Builds `UPDATE <table> SET ..., row_version = row_version + 1
 *         WHERE id = $ AND row_version = $` and reports whether the
 * assertion held. A caller that gets `false` re-reads and retries —
 * it never gets a silent overwrite.
 */
export async function updateVersioned(t, table, id, version, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return { ok: true, skipped: true };
  assertIdentifiers([table, ...keys]);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  const params = keys.map((k) => patch[k]);
  params.push(id, version);
  const sql =
    `UPDATE ${table} SET ${sets.join(", ")}, row_version = row_version + 1 ` +
    `WHERE id = $${keys.length + 1} AND row_version = $${keys.length + 2} ` +
    `RETURNING row_version`;
  const r = await t.query(sql, params);
  if (!r.rows.length) return { ok: false };
  return { ok: true, version: r.rows[0].row_version };
}

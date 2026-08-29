/**
 * AUDIT (R6.1, R6.2 / AD-4).
 *
 * The legacy build kept its audit trail in the same mutable blob it was
 * auditing, capped at 400 rows, attributed to a hard-coded user. All three
 * of those are fixed here:
 *
 *   · rows live in their own table with UPDATE and DELETE rules that make
 *     rewriting history fail at the database, not at the application;
 *   · the insert shares the caller's transaction, so a mutation that is
 *     not audited does not commit;
 *   · the actor is the authenticated session, never a constant.
 */

import { many, tx } from "./db.js";

/**
 * Write one audit row inside an existing transaction.
 * @param t     the transaction handle from `tx()`
 * @param user  req.user
 * @param e     { action, entity, entityId, detail, before, after }
 */
export async function record(t, user, e) {
  await t.query(
    `INSERT INTO audit_event
       (user_id, user_label, action, entity, entity_id, detail, before_json, after_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user?.id ?? null,
      user ? `${user.displayName} (${user.role})` : "system",
      e.action,
      e.entity ?? "",
      e.entityId ?? "",
      e.detail ?? "",
      e.before ? JSON.stringify(e.before) : null,
      e.after ? JSON.stringify(e.after) : null,
    ]
  );
}

/**
 * The normal way a route mutates: open a transaction, do the work, audit
 * it, commit. There is deliberately no path that writes without this.
 */
export async function audited(user, event, work) {
  return tx(async (t) => {
    const result = await work(t);
    await record(t, user, typeof event === "function" ? event(result) : event);
    return result;
  });
}

/** R6.3 — filterable read. Group level and above only; the route checks.
    `action` (exact match, or several comma-separated) is the governance
    committee's I2: "who overrode what, when" must be answerable without
    SQL, and the before/after images travel with the row for that reason. */
export async function readAudit({ user, entity, entityId, action, limit = 200, before } = {}) {
  const where = [];
  const params = [];
  if (user) { params.push(user); where.push(`user_id = $${params.length}`); }
  if (entity) { params.push(entity); where.push(`entity = $${params.length}`); }
  if (entityId) { params.push(entityId); where.push(`entity_id = $${params.length}`); }
  if (action) {
    const list = String(action).split(",").map((a) => a.trim()).filter(Boolean);
    if (list.length) { params.push(list); where.push(`action = ANY($${params.length})`); }
  }
  if (before) { params.push(before); where.push(`at < $${params.length}`); }
  params.push(Math.min(1000, Math.max(1, Number(limit) || 200)));

  return many(
    `SELECT id, at, user_id, user_label, action, entity, entity_id, detail,
            before_json, after_json
       FROM audit_event
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY at DESC, id DESC
      LIMIT $${params.length}`,
    params
  );
}

/**
 * Identity (R1.1, R1.7, R1.8).
 *
 * scrypt with a per-user salt, timing-safe comparison, server-side
 * sessions in a table so logout genuinely invalidates. No third-party
 * dependency handles a password in this application.
 */

import crypto from "node:crypto";
import { promisify } from "node:util";
import { many, one, query } from "./db.js";
import { normaliseGrants } from "../../shared/rbac.js";

const scrypt = promisify(crypto.scrypt);

const KEYLEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = "meridian_sid";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — one working day

/* ── password hashing ─────────────────────────────────────────────── */

export async function hashPassword(plain) {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(plain, salt, KEYLEN, SCRYPT);
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(plain, hash, salt) {
  if (!plain || !hash || !salt) return false;
  let derived;
  try {
    derived = await scrypt(plain, salt, KEYLEN, SCRYPT);
  } catch {
    return false;
  }
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) return false;
  return crypto.timingSafeEqual(stored, derived);
}

/* ── users ────────────────────────────────────────────────────────── */

/** The only shape a user is ever allowed to leave the server in. */
export function publicUser(row, grants = []) {
  if (!row) return null;
  const g = normaliseGrants(grants);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    personId: row.person_id ?? null,
    role: row.role,
    active: row.active,
    grants: { programmes: [...g.programmes], sites: [...g.sites] },
    lastLoginAt: row.last_login_at ?? null,
    mustChangePassword: row.must_change_password === true,
    locale: row.locale ?? "",
    notifyPref: row.notify_pref ?? "immediate",
    version: row.row_version ?? null,
  };
}

/** Internal shape carried on `req.user`. Never serialised as-is. */
async function loadUser(userId, actingForId = null) {
  const row = await one(
    `SELECT id, email, display_name, person_id, role, active, last_login_at, must_change_password,
            locale, notify_pref
       FROM app_user WHERE id = $1`,
    [userId]
  );
  if (!row) return null;

  /* R-02 — the deputy seam. A session that claims to act for somebody is
     re-verified on EVERY request against the absence that justifies it:
     the absent person must still be absent today, and must still name
     this deputy. Expired or revoked, the claim silently drops to self —
     a delegation is bounded by the absence that carries it, not by the
     session that remembered it. */
  let acting = null;
  if (actingForId && actingForId !== userId) {
    const absent = await one(
      `SELECT u.id, u.display_name, u.person_id, u.role, u.active
         FROM app_user u
         JOIN person_absence a ON a.person_id = u.person_id
        WHERE u.id = $1 AND u.active
          AND a.deputy_id = $2
          AND CURRENT_DATE BETWEEN a.starts_on AND a.ends_on`,
      [actingForId, row.person_id]
    );
    if (absent) acting = absent;
  }

  /* While acting, the EFFECTIVE authority is the absent person's — their
     role, their grants, never a union: a delegation widens nothing. The
     identity stays the deputy's own, and the label names both, which is
     what every audit row will carry. */
  const authorityUserId = acting ? acting.id : userId;
  const grants = await many(
    `SELECT scope_kind, programme_id, site_id FROM access_grant WHERE user_id = $1`,
    [authorityUserId]
  );
  return {
    id: row.id,
    email: row.email,
    displayName: acting ? `${row.display_name} (pour ${acting.display_name})` : row.display_name,
    personId: row.person_id,
    actingForPersonId: acting ? acting.person_id : null,
    actingForUserId: acting ? acting.id : null,
    role: acting ? acting.role : row.role,
    active: row.active,
    mustChangePassword: row.must_change_password === true,
    locale: row.locale ?? "",
    notifyPref: row.notify_pref ?? "immediate",
    grants: normaliseGrants(grants),
    grantRows: grants,
    _row: row,
  };
}

export async function createUser({ id, email, displayName, role, password, personId = null }) {
  const { hash, salt } = await hashPassword(password);
  const uid = id || "U-" + crypto.randomBytes(5).toString("hex").toUpperCase();
  await query(
    `INSERT INTO app_user (id, email, display_name, person_id, role, pw_hash, pw_salt)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid, email.trim(), displayName, personId, role, hash, salt]
  );
  return uid;
}

export async function setPassword(userId, password, { mustChange = false } = {}) {
  const { hash, salt } = await hashPassword(password);
  await query(
    `UPDATE app_user SET pw_hash = $2, pw_salt = $3, must_change_password = $4,
            row_version = row_version + 1
      WHERE id = $1`,
    [userId, hash, salt, mustChange === true]
  );
}

/* ── sessions ─────────────────────────────────────────────────────── */

/**
 * S-14 — the row keeps the fingerprint, the browser keeps the token.
 *
 * A session token opens the same doors as a password for twelve hours,
 * and it was stored as it travels. Whoever reads the table — a mislaid
 * backup, a diagnostic export, a `SELECT *` pasted into a ticket — holds
 * usable sessions without ever having seen a password.
 *
 * Plain SHA-256, not scrypt: the input is 32 random bytes from the CSPRNG,
 * so there is no dictionary to slow down, and this runs on every request.
 */
export const sessionKey = (token) =>
  crypto.createHash("sha256").update(String(token ?? "")).digest("hex");

export async function login(email, password, userAgent = "") {
  const row = await one(
    `SELECT id, email, display_name, person_id, role, active, pw_hash, pw_salt,
            last_login_at, must_change_password
       FROM app_user WHERE lower(email) = lower($1)`,
    [String(email ?? "").trim()]
  );

  /* Always run a scrypt pass, even when the account does not exist, so a
     wrong address and a wrong password take the same time to fail. */
  const ok = row
    ? await verifyPassword(password, row.pw_hash, row.pw_salt)
    : await verifyPassword(password, crypto.randomBytes(64).toString("hex"), "00");

  if (!row || !ok) throw new HttpError(401, "Email or password is not recognised");
  if (!row.active) throw new HttpError(403, "This account has been disabled");

  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO session (token_hash, user_id, expires_at, user_agent) VALUES ($1,$2,$3,$4)`,
    [sessionKey(token), row.id, expires.toISOString(), String(userAgent).slice(0, 300)]
  );
  await query(`UPDATE app_user SET last_login_at = now() WHERE id = $1`, [row.id]);

  const grants = await many(
    `SELECT scope_kind, programme_id, site_id FROM access_grant WHERE user_id = $1`,
    [row.id]
  );
  return { token, expires, user: publicUser(row, grants) };
}

/**
 * ADR-14 — the SSO seam. SDP has already authenticated this person (its
 * own session, password or Entra); the module decides whether they exist
 * HERE, and mints an ordinary session if so. Pre-provisioned only: an
 * email with no active app_user gets null, never an account (the same
 * deny-unknowns rule SDP's own Entra callback enforces). No password is
 * involved — trust flows from SDP's session, inside one process.
 */
export async function bridgeSession(email, userAgent = "sdp-bridge") {
  const row = await one(
    `SELECT id, email, display_name, role, active FROM app_user
      WHERE lower(email) = lower($1) AND active AND pw_hash <> 'unusable'`,
    [String(email ?? "").trim()]
  );
  if (!row) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO session (token_hash, user_id, expires_at, user_agent) VALUES ($1,$2,$3,$4)`,
    [sessionKey(token), row.id, expires.toISOString(), String(userAgent).slice(0, 300)]
  );
  await query(`UPDATE app_user SET last_login_at = now() WHERE id = $1`, [row.id]);
  const { audited } = await import("./audit.js");
  await audited(
    { id: row.id, displayName: row.display_name, role: row.role },
    { action: "Signed in via SDP", entity: "app_user", entityId: row.id },
    async () => null
  );
  return { token, expires, cookieName: SESSION_COOKIE, cookieOptions: cookieOptions() };
}

export async function logout(token) {
  if (!token) return;
  await query(`DELETE FROM session WHERE token_hash = $1`, [sessionKey(token)]);
}

/**
 * Every other session this person has, ended. Changing a password is how
 * someone answers "I think somebody else has been using this account" —
 * an answer that leaves the other sessions signed in is not one.
 */
export async function logoutOthers(userId, keepToken) {
  await query(`DELETE FROM session WHERE user_id = $1 AND token_hash <> $2`,
    [userId, sessionKey(keepToken ?? "")]);
}

export async function sweepSessions() {
  await query(`DELETE FROM session WHERE expires_at < now()`);
}

/* ── middleware ───────────────────────────────────────────────────── */

/** Attaches `req.user` when the cookie names a live session. */
export function attachUser() {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE];
      if (!token) return next();
      const s = await one(
        `SELECT user_id, acting_for FROM session WHERE token_hash = $1 AND expires_at > now()`,
        [sessionKey(token)]
      );
      if (!s) return next();
      req.sessionToken = token;
      req.user = await loadUser(s.user_id, s.acting_for ?? null);
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** R1.1 — everything behind this returns 401 without a session. */
export function requireUser() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sign in to continue" });
    if (!req.user.active) return res.status(403).json({ error: "This account has been disabled" });
    next();
  };
}

/**
 * The forced first change, enforced where it counts (adoption committee
 * I4). A dialog the browser draws is a courtesy, not a control: until the
 * provisioned password has been replaced, the session may read and it may
 * set a new password — it may not act, because the person holding that
 * password is not yet the only person who could have acted.
 */
export function requirePasswordChanged() {
  return (req, res, next) => {
    if (!req.user?.mustChangePassword) return next();
    if (req.method === "GET" || req.method === "HEAD") return next();
    return res.status(403).json({
      error: "Choose your own password first — until you do, the trail cannot say this was you",
    });
  };
}

export function cookieOptions() {
  /* Secure follows the TRANSPORT, not the build. A packaged service on a
     LAN speaks plain HTTP until someone puts it behind TLS, and a Secure
     cookie there is simply dropped by the browser — the sign-in appears
     to succeed and the next request is anonymous. So: explicit switch
     first, NODE_ENV only as the fallback it always was. */
  const flag = process.env.MERIDIAN_SECURE_COOKIES;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: flag === undefined || flag === "" ? process.env.NODE_ENV === "production" : flag === "1",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

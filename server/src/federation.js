/**
 * SDP FEDERATION — settings, service-key auth, and the outbound client.
 *
 * Meridian federates with SDP (the IT-operations dashboard) over five
 * HTTP contracts (committee charter, ADR-1). Two directions, two
 * credentials, deliberately never the same value:
 *
 *   inbound   SDP calls /v1/* presenting X-API-Key. Meridian stores only
 *             the SHA-256 of that key (ADR-4) — a database dump or audit
 *             row can never leak the credential. On success the request
 *             carries a synthetic service principal, so every ingest
 *             write is as attributable as a human one.
 *   outbound  Meridian calls SDP's C2/C4 read APIs presenting the key
 *             the SDP admin issued (SDP's `meridian_in_key`). That one
 *             must be presentable, so it is stored as-is in app_setting
 *             and redacted on every admin read.
 *
 * Every outbound call is best-effort with a short timeout: SDP being
 * down degrades a picker, never a portfolio screen (ADR-12).
 */

import crypto from "node:crypto";
import { many, query } from "./db.js";
import { jsonValue } from "./portfolio.js";

/* ── settings ─────────────────────────────────────────────────────── */

export const FED_KEYS = [
  "fedSdpBaseUrl",   // SDP origin, e.g. https://itops-dashboard.example.com
  "fedSdpOutKey",    // presented to SDP on C2/C4 (secret — redact on read)
  "fedSdpKeyHash",   // sha256 hex of the key SDP presents on /v1/* (never the key)
];

const TTL_MS = 30_000;
let _cache = null;
let _at = 0;

export async function loadFederationSettings() {
  if (_cache && Date.now() - _at < TTL_MS) return _cache;
  const rows = await many(
    `SELECT key, value FROM app_setting WHERE key = ANY($1)`,
    [FED_KEYS]
  );
  const out = { fedSdpBaseUrl: "", fedSdpOutKey: "", fedSdpKeyHash: "" };
  for (const r of rows) out[r.key] = String(jsonValue(r.value) ?? "");
  out.fedSdpBaseUrl = out.fedSdpBaseUrl.replace(/\/+$/, "");
  _cache = out;
  _at = Date.now();
  return out;
}

/** Settings changed under us (admin PUT, tests) — drop the cache. */
export function _invalidate() {
  _cache = null;
  _at = 0;
}

/* ── service key ──────────────────────────────────────────────────── */

export const sha256hex = (s) =>
  crypto.createHash("sha256").update(String(s), "utf8").digest("hex");

/** A fresh 32-byte key and the only thing we will ever store of it. */
export function generateServiceKey() {
  const plain = crypto.randomBytes(32).toString("base64url");
  return { plain, hash: sha256hex(plain) };
}

/**
 * The actor federation writes are attributed to. It exists only here —
 * it has no password, no session, and rbac.can() knows no 'service'
 * role, so the key can never open the interactive API.
 */
export function servicePrincipal() {
  return {
    id: "SVC-SDP",
    displayName: "SDP Federation",
    role: "service",
    active: true,
    grants: { programmes: new Set(), sites: new Set() },
  };
}

/**
 * The audit trail FKs every event onto app_user, so the service account
 * must exist as a row before the first audited ingest. It cannot live in
 * a migration — a pre-seed app_user row breaks the seed's wipe (the
 * append-only audit rules refuse the ON DELETE SET NULL) — so it is
 * ensured here, once per process, on first successful key check. The
 * hash is not a valid scrypt digest and the row is inactive: no session
 * can ever be minted for it.
 */
let _svcEnsured = false;
async function ensureServiceAccount() {
  if (_svcEnsured) return;
  await query(
    `INSERT INTO app_user (id, email, display_name, role, pw_hash, pw_salt, active)
     VALUES ('SVC-SDP', 'svc-sdp@federation.invalid', 'SDP Federation', 'viewer',
             'unusable', 'unusable', false)
     ON CONFLICT (id) DO NOTHING`
  );
  _svcEnsured = true;
}
/** Tests re-seed under one process — let them drop the memo. */
export function _resetServiceAccountMemo() { _svcEnsured = false; }

/**
 * Guard for /v1/*. Unconfigured federation answers exactly like a wrong
 * key — a scanner learns nothing about whether the feature is on.
 */
export function requireServiceKey() {
  return async (req, res, next) => {
    try {
      const presented = req.get("X-API-Key") ?? "";
      const { fedSdpKeyHash } = await loadFederationSettings();
      if (!fedSdpKeyHash || !presented) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const a = Buffer.from(sha256hex(presented), "hex");
      const b = Buffer.from(fedSdpKeyHash, "hex");
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: "unauthorized" });
      }
      await ensureServiceAccount();
      req.user = servicePrincipal();
      next();
    } catch (e) {
      next(e);
    }
  };
}

/* ── outbound client (C2 / C4) ────────────────────────────────────── */

/**
 * GET a JSON document from SDP. Returns the parsed body, or null on any
 * failure — unconfigured, timeout, non-200, bad JSON. Callers render an
 * honest "SDP unreachable" state instead of throwing (ADR-12).
 */
export async function sdpGet(path, { timeoutMs = 4000, fetchImpl = fetch } = {}) {
  const { fedSdpBaseUrl, fedSdpOutKey } = await loadFederationSettings();
  if (!fedSdpBaseUrl || !fedSdpOutKey) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(fedSdpBaseUrl + path, {
      headers: { "X-API-Key": fedSdpOutKey },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

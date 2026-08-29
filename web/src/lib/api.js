/**
 * API client.
 *
 * The v4 build had one write path — `App.mutate` — that snapshotted for
 * undo, stamped the audit trail and saved to localStorage. This is the
 * same seam, moved across the wire: one place that talks to the server,
 * one place that knows what a 401, a 403 and a 409 mean.
 */

import { getLang } from "./i18n.js";

const BASE = "/api";

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
  /** AD-6 — the client's cue to re-read and retry rather than fight. */
  get isConflict() { return this.status === 409; }
  /* 428 means the request did not say which read it was based on. The
     remedy is the same as a conflict: re-read, so the form carries a
     version next time. */
  get isStale() { return this.status === 409 || this.status === 428; }
  get isForbidden() { return this.status === 403; }
  get isUnauthenticated() { return this.status === 401; }
}

let onUnauthenticated = () => {};
export function setUnauthenticatedHandler(fn) { onUnauthenticated = fn; }

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      /* X-Lang, not Accept-Language: browsers forbid scripts from setting
         the latter, and a refusal composed on the server should come back
         in the language the person chose here (V-10). */
      headers: {
        "x-lang": getLang(),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let json = null;
  if (text) { try { json = JSON.parse(text); } catch { json = { raw: text }; } }

  if (res.status === 401) {
    onUnauthenticated();
    throw new ApiError(401, json?.error ?? "Your session has ended. Sign in again.", json);
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? `Request failed (${res.status})`, json);
  }
  return json;
}

export const api = {
  get: (p) => call("GET", p),
  post: (p, b) => call("POST", p, b ?? {}),
  patch: (p, b) => call("PATCH", p, b ?? {}),
  put: (p, b) => call("PUT", p, b ?? {}),
  del: (p) => call("DELETE", p),

  /* ── auth ───────────────────────────────────────────────────────── */
  login: (email, password) => call("POST", "/auth/login", { email, password }),
  logout: () => call("POST", "/auth/logout", {}),
  me: () => call("GET", "/auth/me"),
  accounts: () => call("GET", "/auth/accounts"),

  /* ── the book ───────────────────────────────────────────────────── */
  bootstrap: () => call("GET", "/bootstrap"),
};

/** Downloads that must carry a session cookie go through fetch, not a link. */
export async function download(path, filename) {
  const res = await fetch(BASE + path, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, "Could not prepare that download");
  const blob = await res.blob();
  saveBlob(blob, filename);
}

/** Client-side file save, used for CSV and Markdown built in the browser. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function saveText(filename, text, mime = "text/plain") {
  saveBlob(new Blob([text], { type: mime + ";charset=utf-8" }), filename);
}

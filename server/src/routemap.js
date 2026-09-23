/**
 * REQ-52 — the routes this server REALLY serves, read from the app that
 * `buildApp()` builds, not from a list somebody typed.
 *
 * Why this module exists. Three gates each kept their own idea of which
 * routers exist and where they are mounted: F1 had a hand-written map of
 * nine router files, F9 read `routes/v1.js` and nothing else, and every
 * one of those lists had the same blind spot — a router it did not name
 * was not reported missing, it was simply not seen. `GET /api/v1/signals`
 * is the proof: it is served by `routes/signals.js`, mounted at `/api`,
 * and for that reason alone it never reached the published contract
 * (NEW-08, the sixth instance of the defect in one round).
 *
 * Express does not remember the path a router was mounted at (a layer
 * keeps only a compiled matcher), so the mount table is recorded while
 * the app is being built: `app.use` is observed for the duration of one
 * `buildApp()` call and restored at once, whatever happens. Every router
 * layer the app ends up with must have been observed, and no router may
 * hide a router inside itself — either would put routes back out of
 * sight, so both throw rather than answer with less than the truth.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import { buildApp } from "./index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const isRouter = (fn) => typeof fn === "function" && Array.isArray(fn.stack);

let cached = null;

/** Every router the app mounts, with the prefix it is mounted at, in order. */
export function mountTable() {
  if (cached) return cached;
  const seen = [];
  const proto = express.application;
  const original = proto.use;
  proto.use = function observed(first, ...rest) {
    const prefix = typeof first === "string" ? first : "";
    const handlers = typeof first === "string" ? rest : [first, ...rest];
    for (const h of handlers.flat()) {
      if (isRouter(h)) seen.push({ prefix: prefix === "/" ? "" : prefix, router: h });
    }
    return original.call(this, first, ...rest);
  };
  let app;
  try { app = buildApp(); } finally { proto.use = original; }

  for (const layer of app.router.stack) {
    if (isRouter(layer.handle) && !seen.some((s) => s.router === layer.handle)) {
      throw new Error("routemap: a router is mounted by a path that was not observed — " +
        "mount it with app.use(\"/prefix\", router) in buildApp()");
    }
  }
  for (const { router } of seen) {
    for (const layer of router.stack) {
      if (isRouter(layer.handle)) {
        throw new Error("routemap: a router is nested inside another router — its prefix " +
          "cannot be read; mount it in buildApp() instead");
      }
    }
  }
  /* The app's own routes (`/api/health`, the client fallback) sit on the
     app's router at prefix "". */
  cached = { app, mounts: [{ prefix: "", router: app.router, own: true }, ...seen] };
  return cached;
}

/**
 * Every (method, full path) the app answers, with the router that serves
 * it. Regex routes (the client fallback) are skipped: they have no path a
 * caller could name.
 */
export function servedRoutes() {
  const out = [];
  for (const { prefix, router } of mountTable().mounts) {
    for (const layer of router.stack) {
      if (!layer.route || typeof layer.route.path !== "string") continue;
      const p = layer.route.path === "/" ? "" : layer.route.path;
      for (const [method, on] of Object.entries(layer.route.methods ?? {})) {
        if (on && method !== "_all") out.push({ method: method.toUpperCase(), path: (prefix + p) || "/", router });
      }
    }
  }
  return out;
}

/**
 * The router files under server/src/routes that buildApp() never mounts.
 * A router file nobody mounts is a set of routes that answer 404, and it
 * is invisible to every gate that reads what is mounted — so it is named.
 */
export async function unmountedRouterFiles() {
  const dir = path.join(HERE, "routes");
  const mounted = new Set(mountTable().mounts.map((m) => m.router));
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js")).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (!mounted.has(mod.default)) out.push(`server/src/routes/${f}`);
  }
  return out;
}

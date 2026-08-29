/**
 * Meridian IT-PMO — HTTP server.
 *
 * Thin on purpose. Routing, sessions and error shaping live here; every
 * authority decision lives in rbac.js and every write goes through
 * audit.js, so there is one place to read for "who can do what" and one
 * place to read for "what happened".
 */

import express from "express";
import cookieParser from "cookie-parser";
import zlib from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { connect, migrate, engine, close } from "./db.js";
import { attachUser, requireUser, requirePasswordChanged, sweepSessions, HttpError } from "./auth.js";
import authRoutes from "./routes/auth.js";
import portfolioRoutes from "./routes/portfolio.js";
import meetingRoutes from "./routes/meetings.js";
import adminRoutes from "./routes/admin.js";
import importRoutes from "./routes/importcsv.js";
import federationRoutes from "./routes/federation.js";
import federationServiceRoutes from "./routes/federationService.js";
import { translate } from "./pgerror.js";
import { say, localeOf } from "./i18n.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/* Same reason as migrationsDir(): a packaged build serves the built
   client from beside the executable, and the answer is read when the app
   is built rather than when this module loads. */
const webDist = () => process.env.MERIDIAN_WEB_DIST || join(HERE, "..", "..", "web", "dist");

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8mb" }));
  app.use(cookieParser());

  /* R-08 — the sites live on shared satellite links. Every JSON response
     above a kilobyte goes out gzipped when the client accepts it: the
     90–113 KB bootstrap becomes a fraction of itself for zero risk. Done
     by hand with node:zlib rather than a dependency, on res.json only —
     static assets carry their own caching story. */
  app.use((req, res, next) => {
    const plain = res.json.bind(res);
    res.json = (obj) => {
      const s = JSON.stringify(obj);
      const wants = String(req.headers["accept-encoding"] ?? "").includes("gzip");
      if (!wants || s.length < 1024) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.send(s);
      }
      const gz = zlib.gzipSync(Buffer.from(s));
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Vary", "Accept-Encoding");
      return res.send(gz);
    };
    void plain;
    next();
  });

  /* A few headers that cost nothing and close the obvious doors. The app
     loads one font stylesheet and nothing else off-origin. */
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  app.use(attachUser());

  app.get("/api/health", async (_req, res) => {
    res.json({ ok: true, engine: engine(), at: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);

  /* SDP federation ingest/read (contracts C1/C3/C5/C6) — its own hashed
     service key, mounted BEFORE the session wall on purpose: the caller
     is another system, not a person. See server/src/federation.js. */
  app.use("/v1", federationServiceRoutes);

  // R1.1 — everything past this point needs a session.
  app.use("/api", requireUser());
  /* …and a password of the holder's own choosing before it may write.
     Mounted after /api/auth on purpose: changing the password, reading
     /me and signing out stay reachable from inside the restriction. */
  app.use("/api", requirePasswordChanged());
  app.use("/api/federation", federationRoutes);
  app.use("/api", portfolioRoutes);
  app.use("/api/import", importRoutes);
  app.use("/api/meetings", meetingRoutes);
  app.use("/api/admin", adminRoutes);

  app.use("/api", (_req, res) => res.status(404).json({ error: "No such endpoint" }));

  /* Built client, when there is one. In development Vite serves the app
     on its own port and proxies /api back here. */
  const dist = webDist();
  if (existsSync(dist)) {
    /* Asset filenames carry a content hash, so they can be cached hard.
       index.html must never be, or a deploy leaves browsers pointing at
       a bundle that no longer exists. */
    app.use(express.static(dist, {
      index: false,
      setHeaders: (res, path) => {
        res.setHeader("Cache-Control", path.includes("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache");
      },
    }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(join(dist, "index.html"));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    /* A constraint violation is the database refusing bad data, which is
       the system working — so it answers as a rejected request, naming
       the rule, rather than as a fault nobody can act on. */
    const constraint = err instanceof HttpError ? null : translate(err);
    const status = constraint
      ? constraint.status
      : err instanceof HttpError ? err.status : err.status || 500;
    const message = constraint ? constraint.message : err.message;
    /* A deliberate HttpError is the application answering, even at 503 —
       "Entra is not configured" is an operating state, not a fault, and
       logging a stack for it teaches operators to ignore the log. */
    if (status >= 500 && !(err instanceof HttpError)) console.error(err);
    /* V-10 — the refusal is what the person reads, so it answers in their
       language. What was RECORDED stays in one language: an audit trail
       that changes with the reader's browser cannot be compared. */
    res.status(status).json({
      error: say(status >= 500 ? "Something went wrong on the server" : message, localeOf(req)),
    });
  });

  return app;
}

/**
 * ADR-14 — the module face SDP mounts.
 *
 * SDP's server.js (CommonJS) does `await import(...)` on this file, calls
 * mountModule() once at boot, and `app.use("/pmo", pmo.app)`. The module
 * keeps its own database (MERIDIAN_DATABASE_URL → DATABASE_URL → PGlite),
 * its own sessions and its own RBAC; only the origin, the process and the
 * deploy are shared. bridgeSession is the SSO seam: SDP authenticates the
 * person, this module decides what that person may do here.
 */
export async function mountModule({ url = process.env.MERIDIAN_DATABASE_URL || process.env.DATABASE_URL, dataDir } = {}) {
  await connect({ url: url || null, dataDir });
  await migrate({ silent: true });
  const sweeper = setInterval(() => sweepSessions().catch(() => {}), 15 * 60 * 1000);
  sweeper.unref?.();
  const { bridgeSession } = await import("./auth.js");
  return { app: buildApp(), bridgeSession, engine: engine(), close };
}

export async function start({ port = process.env.PORT || 4173 } = {}) {
  await connect();
  await migrate({ silent: true });
  const app = buildApp();
  const server = app.listen(port, () => {
    console.log(`Meridian IT-PMO listening on http://localhost:${port}  (${engine()})`);
  });

  const sweeper = setInterval(() => sweepSessions().catch(() => {}), 15 * 60 * 1000);
  sweeper.unref?.();

  const stop = async () => {
    clearInterval(sweeper);
    await new Promise((r) => server.close(r));
    await close();
  };
  process.on("SIGINT", () => stop().then(() => process.exit(0)));
  process.on("SIGTERM", () => stop().then(() => process.exit(0)));
  return { server, stop, app };
}

/* Not top-level await: the packaged build bundles this graph to CommonJS,
   and a start-up failure should say so rather than surface as a rejected
   module promise. */
if (process.argv[1]?.endsWith("index.js")) {
  start().catch((e) => { console.error(e); process.exit(1); });
}

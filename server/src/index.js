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
import { packageVersion } from "./env.js";

import { connect, migrate, engine, close, many, query, dataDir } from "./db.js";
import { sweep as notifySweep, purge, escalate, deliver, outboundTransport } from "./notify.js";
import { probeEvidence } from "./probe.js";
import { sweepExceptions } from "./exceptions.js";
import { sweepEvents } from "./events.js";
import { countUsage } from "./adoption.js";
import { attachUser, requireUser, requirePasswordChanged, sweepSessions, HttpError } from "./auth.js";
import authRoutes from "./routes/auth.js";
import portfolioRoutes from "./routes/portfolio.js";
import meetingRoutes from "./routes/meetings.js";
import adminRoutes from "./routes/admin.js";
import importRoutes from "./routes/importcsv.js";
import federationRoutes from "./routes/federation.js";
import v1Routes from "./routes/v1.js";
import federationServiceRoutes from "./routes/federationService.js";
import { translate } from "./pgerror.js";
import { say, localeOf } from "./i18n.js";
import { liveDemoAccounts, demoRefusal } from "./posture.js";
import { purgeIdempotencyKeys } from "./v1write.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = packageVersion();

/* SaaS-04 / I-6 — ce que la santé dit de CETTE instance. Lu à chaque
   appel (une ligne de réglages, un compte de migrations) : la supervision
   veut la vérité du moment, pas celle du démarrage. */
async function instanceIdentity() {
  try {
    const rows = await many(
      `SELECT key, value FROM app_setting WHERE key IN ('orgName','instanceId','backup.lastDrill')`);
    const get = (k) => { const r = rows.find((x) => x.key === k); if (!r) return null;
      try { return JSON.parse(r.value); } catch { return r.value; } };
    const mig = await many(`SELECT count(*)::int AS n FROM schema_migration`);
    const drill = get("backup.lastDrill");
    return {
      /* §8 promettait un identifiant d'instance dans le `.env` du
         locataire ; il n'existait que comme réglage d'écran, si bien que
         chaque instance d'un parc devait être nommée à la main dans un
         navigateur. MERIDIAN_INSTANCE_ID le pose au démarrage ; le
         réglage d'écran reste et prime quand quelqu'un l'a écrit.
         (Conseiller exploitation nº 11, docs/33 §5.) */
      instance: { org: get("orgName") ?? "MERIDIAN",
                  id: get("instanceId") || process.env.MERIDIAN_INSTANCE_ID || null,
                  migrations: mig[0]?.n ?? 0 },
      /* `lastDrillAt` est la dernière restauration PROUVÉE, pas la
         dernière tentative : une épreuve ratée ne doit pas rendre une
         instance récente à l'œil. `lastAttemptAt` dit quand on a essayé,
         et `ok` si cet essai a tenu. (Exploitation nº 7.) */
      backup: drill ? { lastDrillAt: drill.provenAt ?? (drill.ok ? drill.at : null) ?? null,
                        lastAttemptAt: drill.at ?? null, ok: drill.ok ?? null,
                        restoreSeconds: drill.restoreSeconds ?? null }
                    : { lastDrillAt: null, lastAttemptAt: null, ok: null },
    };
  } catch { return {}; }
}
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
     loads one font stylesheet and nothing else off-origin.

     The policy is the second lock on the evidence link (S-01): the client
     validates the scheme before it renders an href, and this refuses to
     execute anything that slips past. `script-src 'self'` alone would not
     stop a javascript: URI — `navigate-to` is not implemented anywhere —
     so the client-side check is the primary control and this is depth.
     Style needs 'unsafe-inline' because the kit sets style attributes;
     scripts never are, so the script directive stays strict. */
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    /* Plus aucun hôte tiers : les polices sont empaquetées avec
       l'application. Tant que Google figurait ici, la politique autorisait
       ce qu'elle prétendait interdire — une page complètement autonome. */
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  const secure = process.env.MERIDIAN_SECURE_COOKIES === "1";
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    /* Only when the deployment says it is behind TLS — announcing HSTS
       from a plain-HTTP install would lock users out of their own tool. */
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  /* S-02 — cross-site request forgery, in depth. The session cookie is
     SameSite=Lax, which already refuses to ride along on a cross-site
     POST; this refuses the request even if that ever fails (an old
     browser, a proxy that rewrites the cookie, a future same-site
     subdomain). Same-origin and origin-less requests (curl, the service
     itself, native clients) pass; a stated foreign origin does not. */
  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const stated = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (!stated) return next();
    const host = req.headers.host;
    let origin = null;
    try { origin = new URL(stated); } catch { return next(new HttpError(403, "Malformed origin")); }
    if (origin.host !== host) {
      return next(new HttpError(403, "Cross-site write refused — open Meridian directly"));
    }
    next();
  });

  app.use(attachUser());

  /* P-02 — la santé dit QUI répond. Sans numéro de version, un constat de
     terrain ne se rattache à aucun binaire : « c'était corrigé chez nous »
     et « pas chez moi » ne se départagent qu'ici. La version vient du
     paquet à la construction ; sur une exécution depuis les sources elle
     dit « dev ». */
  const VERSION = PKG_VERSION;
  app.get("/api/health", async (_req, res, next) => {
    try {
      res.json({ ok: true, version: VERSION,
        /* I-9 — le même numéro que package.json et que le contrat OpenAPI,
           d'où qu'on tourne ; `build` dit si c'est un paquet ou les
           sources, ce que « dev » mélangeait avec « quelle version ? ». */
        build: process.env.MERIDIAN_VERSION ? "packaged" : "sources",
        engine: engine(),
        /* I-1 — un livre en mémoire ne se découvre plus au redémarrage. */
        ephemeral: engine() === "pglite" && !dataDir() ? true : undefined,
        /* A-11 — un terrain d'apprentissage se reconnaît de loin. */
        training: process.env.MERIDIAN_TRAINING === "1" || undefined,
        /* SaaS-04 — l'identité de l'instance, pour une supervision de
           flotte : le nom de l'organisation, le nombre de migrations
           appliquées, et la dernière restauration éprouvée (I-6). */
        ...(await instanceIdentity()),
        at: new Date().toISOString() });
    } catch (e) { next(e); }
  });

  app.use("/api/auth", authRoutes);

  /* SDP federation ingest/read (contracts C1/C3/C5/C6) — its own hashed
     service key, mounted BEFORE the session wall on purpose: the caller
     is another system, not a person. See server/src/federation.js. */
  app.use("/v1", federationServiceRoutes);

  /* INT-02 — la surface que les autres systèmes lisent. Montée AVANT le
     mur de session, comme la fédération et pour la même raison : celui
     qui appelle est une machine, pas une personne. Chaque route porte sa
     propre portée ; une clé qui ne l'a pas est refusée là, pas ici. */
  app.use("/api/v1", v1Routes);

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
  } else {
    /* I-1 (M-03) — « Cannot GET / » n'explique rien. Le serveur tourne, le
       client n'est pas construit : on le dit, avec la commande. `npm run
       dev` construit désormais lui-même ; cette page sert à qui lance
       `node server/src/index.js` à la main, ou un paquet mal assemblé. */
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.status(503).type("html").send(
        "<!doctype html><meta charset=utf-8><title>Meridian — client not built</title>" +
        "<body style=\"font:15px/1.5 system-ui;max-width:56ch;margin:12vh auto;padding:0 20px\">" +
        "<h1 style=\"font-size:20px\">The API is up; the screens are not built yet.</h1>" +
        "<p>This server answers <code>/api/*</code>, but <code>web/dist</code> does not exist, " +
        "so there is nothing to draw. Build the client once, then reload:</p>" +
        "<pre style=\"background:#f4f4f2;padding:12px\">npm run build</pre>" +
        "<p>Or start with <code>npm run dev</code>, which builds when needed, or " +
        "<code>npm run dev:web</code> for the Vite dev server with hot reload.</p>");
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
    /* A-08 — le sixième indicateur du comité d'adoption : combien de
       refus les gens rencontrent-ils. C'est le seul endroit qui les voit
       tous, quel que soit le routeur qui a dit non. Un compte par jour et
       rien d'autre — pas qui, pas sur quoi : mesurer l'usage d'un outil
       n'est pas surveiller ceux qui s'en servent. Sans attente, et sans
       conséquence en cas d'échec : compter ne doit jamais changer la
       réponse qu'attend la personne. */
    if (status === 403) countUsage("refusal");
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

/* PG-01 (comité 29 §3) — le message d'un refus de moteur, isolé pour
   être testable sans tuer un processus. Rend null quand tout va bien. */
export function engineRefusal(requireFlag, engineName) {
  if (requireFlag !== "1" || engineName === "postgres") return null;
  return [
    "MERIDIAN_REQUIRE_POSTGRES=1 is set and this instance is running on " + engineName + ".",
    "PGlite is a trial engine: single-connection, no hot backup, fragile on hard stops —",
    "three properties a governance book cannot accept. Set DATABASE_URL to a real",
    "PostgreSQL cluster (the installer provisions one), or unset the flag if this is",
    "a demonstration that carries nothing real.",
  ].join("\n  ");
}

/* I-6 (M-08) — en production, PGlite ne tourne plus par défaut. Le
   terrain l'a dit : « une vraie cartographie de portefeuille exige
   PostgreSQL, des sauvegardes prouvées par restauration, et quelqu'un
   d'astreinte le dimanche ». Une instance en production sur le moteur
   d'essai est une décision, pas un oubli : MERIDIAN_ALLOW_PGLITE=1 la
   prend en connaissance de cause. */
export function productionEngineRefusal(env, engineName) {
  if (env.NODE_ENV !== "production" || engineName === "postgres") return null;
  if (env.MERIDIAN_ALLOW_PGLITE === "1" || env.MERIDIAN_TRAINING === "1") return null;
  return [
    "NODE_ENV=production and this instance is running on " + engineName + ".",
    "A production book lives in PostgreSQL: set DATABASE_URL to a real cluster, run",
    "scripts/backup.mjs on a schedule and scripts/restore-drill.mjs before anything real",
    "(docs/34-exploitation.md). To run production on the trial engine anyway — a",
    "single-user laptop, a pilot that carries nothing real — set MERIDIAN_ALLOW_PGLITE=1.",
  ].join("\n  ");
}

export async function start({ port: wanted } = {}) {
  await connect();
  /* PORT se lit APRÈS connect(), qui charge `.env`. En paramètre par
     défaut il s'évaluait avant : un `.env` de locataire posant PORT=4321
     était ignoré, chaque instance se liait au 4173 et le parc du §8 —
     un `.env` par locataire, chacun son port — ne pouvait pas tenir.
     (Conseiller exploitation nº 4, docs/33 §5.) */
  const port = wanted ?? process.env.PORT ?? 4173;

  /* PG-01 — une installation de service refuse PGlite au lieu de tourner
     en silence sur le mauvais moteur. Le refus arrive AVANT les
     migrations : on ne modifie pas une base qu'on refuse d'exploiter. */
  const refusal = engineRefusal(process.env.MERIDIAN_REQUIRE_POSTGRES, engine())
    ?? productionEngineRefusal(process.env, engine());
  if (refusal) {
    console.error("\nMeridian refuses to start.\n  " + refusal + "\n");
    await close();
    process.exit(1);
  }
  /* I-1 — dire où vit le livre, chaque fois. Un livre en mémoire est
     un choix explicite (MERIDIAN_EPHEMERAL=1) et se voit au démarrage. */
  if (engine() === "pglite") {
    console.log(dataDir()
      ? `  book: ${dataDir()}`
      : "  ! book: IN MEMORY (MERIDIAN_EPHEMERAL=1) — everything is lost when this process stops");
  }

  await migrate({ silent: true });

  /* I-12 — le jour 1 se mesure. Un mot de passe imprimé dans le README
     qui ouvre encore un compte actif est dit à chaque démarrage, et
     refusé en production. */
  const live = await liveDemoAccounts().catch(() => []);
  const demo = demoRefusal(process.env, live);
  if (demo) {
    console.error("\nMeridian refuses to start.\n  " + demo + "\n");
    await close();
    process.exit(1);
  }
  if (live.length) {
    console.log(`  ! ${live.length} demonstration account(s) still open with the published password — ` +
                "change them from Administration before this instance carries anything real");
  }

  const app = buildApp();
  /* S-08 — listen where the operator said, and say where that is.
     app.listen(port) binds every interface, while the startup line said
     "localhost" — so an install that reads as a desktop tool was in fact
     answering the whole LAN over plain HTTP, session cookie included.
     The default is now the loopback; reaching it from other machines is
     a deliberate choice (MERIDIAN_BIND=0.0.0.0), and that choice should
     come with TLS in front and MERIDIAN_SECURE_COOKIES=1. */
  const host = process.env.MERIDIAN_BIND || "127.0.0.1";
  const server = app.listen(port, host, () => {
    const where = host === "127.0.0.1" ? `http://localhost:${port}` : `http://${host}:${port}`;
    console.log(`Meridian IT-PMO listening on ${where}  (${engine()})`);
    if (host !== "127.0.0.1" && process.env.MERIDIAN_SECURE_COOKIES !== "1") {
      console.log("  ! reachable beyond this machine over plain HTTP — put TLS in front " +
                  "and set MERIDIAN_SECURE_COOKIES=1, or the session cookie travels in clear");
    }
    /* S-11 — say it out loud, every start, until somebody fixes it. The
       packaged config ships postgres:postgres because an installer cannot
       invent a password; that default is the most-guessed credential
       there is, and it is superuser on the whole cluster, not just this
       database. A silent default is one nobody ever changes. */
    const dsn = process.env.DATABASE_URL || "";
    if (/:\/\/postgres:postgres@/.test(dsn)) {
      console.log("  ! the database is reached with the default postgres/postgres credentials — " +
                  "give PostgreSQL a real password and update DATABASE_URL (meridian.config.json)");
    }
  });

  const sweeper = setInterval(() => sweepSessions().catch(() => {}), 15 * 60 * 1000);
  sweeper.unref?.();

  /* N-05 — le balayage s'exécute enfin de lui-même. Il ne partait que si
     un administrateur cliquait, ce qui veut dire que rien ne partait : on
     ne demande pas à quelqu'un de se souvenir chaque heure de rappeler
     aux autres ce qu'ils ont oublié.

     Un verrou consultatif PostgreSQL garde le tour : deux instances
     derrière un répartiteur ne doivent pas doubler les messages. PGlite
     n'a qu'une connexion et n'en a pas besoin, mais l'appel y est sans
     effet plutôt qu'en erreur.

     L'ordre compte : escalader ce qui traîne, chercher ce qu'il faut
     dire, puis balayer ce qui a fait son temps. */
  const LOCK = 774_155_001;         // arbitraire, propre à ce tour
  /* Q-2 — une première passe au démarrage, en plus du tour horaire. Sans
     elle, une instance qui vient de lever une marge dépassée n'ouvre rien
     avant soixante minutes, et personne — pas même son opérateur — ne
     peut voir que le contrôle fonctionne. Elle est silencieuse et ne peut
     pas empêcher le démarrage. */
  setTimeout(() => { sweepExceptions().catch(() => {}); }, 2_000).unref?.();

  const hourly = setInterval(async () => {
    try {
      const got = await many(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK]).catch(() => [{ ok: true }]);
      if (!got[0]?.ok) return;
      try {
        /* PM-01 — d'abord constater les dépassements de tolérance,
           ENSUITE balayer les notifications : une exception ouverte à ce
           tour doit pouvoir partir au même tour, sans attendre une heure
           de plus pour être annoncée à qui a accordé la marge. */
        await sweepExceptions().catch(() => {});
        /* INT-04 — les décisions du tour partent au même tour. */
        await sweepEvents().catch(() => {});
        await escalate();
        await notifySweep();
        /* Et la file part enfin. Elle se remplissait, la cadence était
           honorée, le silence de nuit calculé — et aucun code de
           production n'actionnait le dernier maillon : rien ne sortait
           jamais. Sans transport configuré, deliver() répond « aucun
           transport » et la file s'accumule, ce qui reste honnête
           puisque le centre la montre. */
        await deliver(await outboundTransport()).catch(() => {});
        /* N-07 — la sonde tourne avec le reste, par petits lots : un
           passage régulier couvre la bibliothèque sans jamais la
           parcourir d'un coup, et n'interroge que les hôtes déjà
           autorisés. */
        await probeEvidence().catch(() => {});
        await purge();
        /* I-2 — la mémoire d'idempotence a trente jours. */
        await purgeIdempotencyKeys().catch(() => {});
      } finally {
        await query(`SELECT pg_advisory_unlock($1)`, [LOCK]).catch(() => {});
      }
    } catch { /* un tour manqué se rattrape au suivant */ }
  }, 60 * 60 * 1000);
  hourly.unref?.();

  const stop = async () => {
    clearInterval(sweeper);
    clearInterval(hourly);
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

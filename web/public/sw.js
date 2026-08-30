/**
 * N-06 — l'agent de service, et rien de plus.
 *
 * Le comité a conçu la survie hors ligne autour d'un instantané du livre
 * dans le navigateur. En la construisant, un fait s'est imposé : sans
 * ceci, cet instantané ne sert presque jamais. Une session déjà ouverte
 * fonctionne de toute façon — le livre est en mémoire — et un
 * rechargement échoue avant d'atteindre le moindre code, parce que la
 * coquille elle-même vient du serveur. L'instantané n'a de valeur que si
 * la page peut encore se charger.
 *
 * Deux règles, et elles suffisent :
 *
 *   · LE RÉSEAU D'ABORD, TOUJOURS. On ne sert du cache que lorsque le
 *     réseau a échoué. Un agent de service qui préfère son cache livre
 *     des versions périmées à des gens qui n'ont rien demandé, et c'est
 *     la façon la plus sûre de rendre un outil incompréhensible.
 *
 *   · L'API N'EST JAMAIS MISE EN CACHE. Servir une réponse d'API périmée
 *     ferait croire à des chiffres frais. C'est l'application qui décide
 *     de montrer un instantané, en le disant, avec son heure — ici on ne
 *     cache que la coquille : de quoi démarrer, pas de quoi tromper.
 */

const SHELL = "meridian-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/index.html"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  /* Une seule génération de coquille à la fois : au déploiement suivant,
     les anciennes partent plutôt que de s'accumuler. */
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        /* Ce qui a été servi une fois pourra l'être encore. Les noms de
           fichiers portent une empreinte de contenu, donc garder la
           réponse ne risque pas de figer une version. */
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(e.request);
        if (hit) return hit;
        /* Une route du client (#/…) n'est pas un fichier : toute
           navigation retombe sur la coquille, qui saura quoi afficher. */
        if (e.request.mode === "navigate") {
          const shell = await caches.match("/index.html");
          if (shell) return shell;
        }
        return new Response("", { status: 504, statusText: "Offline" });
      })
  );
});

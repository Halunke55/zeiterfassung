// Offline-Start der Zeiterfassungs-App: alle App-Dateien werden beim ersten Laden
// zwischengespeichert. Bei einer neuen Version der App CACHE_NAME hochzählen.
// Die erfassten Zeiten liegen NICHT hier, sondern in der IndexedDB des Handys.
const CACHE_NAME = "zeiterfassung-v2";
const DATEIEN = ["./", "./index.html", "./manifest.webmanifest",
                 "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Sofort aus dem Zwischenspeicher antworten (startet auch bei schlechtem Netz auf der
// Baustelle ohne Warten) und im Hintergrund eine neuere Version holen, die beim
// nächsten Start greift.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((gecacht) => {
      const ausDemNetz = fetch(event.request)
        .then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, kopie));
          }
          return antwort;
        })
        .catch(() => gecacht || caches.match("./index.html"));
      return gecacht || ausDemNetz;
    })
  );
});

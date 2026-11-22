// Offline-Start der Zeiterfassungs-App: alle App-Dateien werden zwischengespeichert.
// Bei einer neuen Version der App APP_VERSION hier UND in index.html hochzählen.
// Die erfassten Zeiten liegen NICHT hier, sondern in der IndexedDB des Handys.
const APP_VERSION = "5";
const CACHE_NAME = "zeiterfassung-v" + APP_VERSION;
const DATEIEN = ["./", "./index.html", "./manifest.webmanifest",
                 "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const NETZ_TIMEOUT_MS = 3000;  // schlechtes Netz auf der Baustelle: nach 3 s aus dem Speicher starten

self.addEventListener("install", (event) => {
  // cache: "reload" umgeht den HTTP-Cache des Browsers, damit wirklich die neuen Dateien
  // gespeichert werden (GitHub Pages lässt Dateien sonst bis zu 10 Minuten zwischenspeichern).
  event.waitUntil(caches.open(CACHE_NAME).then((c) =>
    Promise.all(DATEIEN.map((url) =>
      fetch(new Request(url, { cache: "reload" })).then((r) => {
        if (!r.ok) throw new Error(url + ": " + r.status);
        return c.put(url, r);
      })))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function ausDemNetz(request) {
  return fetch(request, { cache: "no-cache" }).then((antwort) => {
    if (antwort.ok) {
      const kopie = antwort.clone();
      caches.open(CACHE_NAME).then((c) => c.put(request, kopie));
    }
    return antwort;
  });
}

function seiteAusSpeicher(request) {
  return caches.match(request, { ignoreSearch: true })
    .then((r) => r || caches.match("./"))
    .then((r) => r || caches.match("./index.html"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Seite selbst: Netz zuerst (Updates kommen sofort an), bei keinem oder langsamem
    // Netz nach NETZ_TIMEOUT_MS die gespeicherte Version.
    event.respondWith(new Promise((resolve) => {
      let fertig = false;
      const ausSpeicher = () => seiteAusSpeicher(req).then((r) => {
        if (!fertig && r) { fertig = true; resolve(r); }
        return r;
      });
      const timer = setTimeout(ausSpeicher, NETZ_TIMEOUT_MS);
      ausDemNetz(req).then((r) => {
        clearTimeout(timer);
        if (!fertig) { fertig = true; resolve(r); }
      }).catch(() => {
        clearTimeout(timer);
        ausSpeicher().then((r) => { if (!fertig) { fertig = true; resolve(r || Response.error()); } });
      });
    }));
    return;
  }

  // Übrige Dateien (Icons, Manifest): aus dem Speicher, im Hintergrund auffrischen.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((gecacht) => {
      const netz = ausDemNetz(req).catch(() => gecacht);
      return gecacht || netz;
    })
  );
});

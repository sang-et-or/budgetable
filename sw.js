// Budgétable — fonctionnement hors ligne (mise en cache des fichiers de l'appli)
const VERSION = 'budgetable-v1.6.0';
const FICHIERS = ['./', './index.html', './js/data.js', './js/modeles.js', './js/engine.js', './js/saisie.js', './js/visuels.js', './js/photos.js', './js/magasins.js', './js/app.js', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // polices Google : laissées au navigateur
  // réseau d'abord (pour avoir la dernière version), cache si hors ligne
  e.respondWith(fetch(e.request).then((r) => {
    const copie = r.clone();
    caches.open(VERSION).then((c) => c.put(e.request, copie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});

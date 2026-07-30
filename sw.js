/* Shiloh — offline service worker.
   App-shell files are cached on install and served cache-first (so the app
   opens instantly and works with no signal). data/*.json is network-first
   with a cache fallback, so content edits show up right away when online but
   the app still renders the last-known data offline. Bump CACHE_VERSION any
   time the shell files below change, so returning visitors get the update
   instead of a stale cache. */
"use strict";

var CACHE_VERSION = "shiloh-v9";
var MEDIA_CACHE = "shiloh-media-v1";
var SHELL = [
  "./",
  "index.html",
  "admin.html",
  "golive.html",
  "manifest.webmanifest",
  "js/store.js",
  "js/ambient.js",
  "css/system.css",
  "css/app.css",
  "css/admin.css",
  "data/config.json",
  "data/theme.json",
  "data/church.json",
  "data/live.json",
  "assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "assets/fonts/fraunces-latin-var.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION && k !== MEDIA_CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  /* Photos: cache-first, populated on first view rather than at install
     (59 images ~2.7MB — precaching all of them would punish cellular users). */
  if (url.pathname.indexOf("/assets/media/") !== -1) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (hit) {
          return hit || fetch(event.request).then(function (res) {
            cache.put(event.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  var isData = url.pathname.indexOf("/data/") !== -1 && url.pathname.endsWith(".json");
  if (isData) {
    event.respondWith(
      fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () { return caches.match(event.request); })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () {
        if (event.request.mode === "navigate") return caches.match("index.html");
      });
    })
  );
});

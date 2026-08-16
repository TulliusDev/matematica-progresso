"use strict";

const CACHE_PREFIX = "trajetoria-pwa-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v1`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v1`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./subjects.js",
  "./storage.js",
  "./continuous-storage.js",
  "./cloud-sync.js",
  "./continuous.js",
  "./script.js",
  "./data/continuous-core.js",
  "./data/violao.js",
  "./data/xadrez.js",
  "./data/desenho.js",
  "./data/ingles.js",
  "./data/historia-arte.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(CACHE_PREFIX) && ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isSupabaseRequest(url)) return;

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(networkWithCacheFallback(request));
  }
});

function isSupabaseRequest(url) {
  return url.hostname.endsWith(".supabase.co");
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(new URL("./index.html", self.location.href), response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true }))
      || caches.match(new URL("./index.html", self.location.href));
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fresh || Response.error();
}

async function networkWithCacheFallback(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

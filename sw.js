/**
 * Service Worker for Offline Cache
 */

const CACHE_NAME = "ats-tec-cache-v1.14.02";
const ASSETS = [
    "index.html",
    "style.css",
    "crypto.js",
    "github.js",
    "app.js",
    "logo.png",
    "manifest.json",
    "https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css",
    "https://unpkg.com/boxicons@2.1.4/fonts/boxicons.woff2",
    "https://unpkg.com/boxicons@2.1.4/fonts/boxicons.woff",
    "https://unpkg.com/boxicons@2.1.4/fonts/boxicons.ttf",
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Install: Cache resources
self.addEventListener("install", (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Caching app shell assets");
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener("activate", (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log("Deleting old cache:", key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Serve from cache with network fallback
self.addEventListener("fetch", (evt) => {
    // Avoid caching POST/PUT requests or GitHub API calls
    if (evt.request.url.includes("api.github.com") || evt.request.method !== "GET") {
        return;
    }

    evt.respondWith(
        caches.match(evt.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version immediately
                // Fetch in background to update cache quietly
                fetch(evt.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(evt.request, networkResponse);
                        });
                    }
                }).catch(() => {/* Ignore network updates failing */});
                
                return cachedResponse;
            }

            // Normal network fetch
            return fetch(evt.request).then((response) => {
                // Cache valid GET requests dynamically
                if (response.status === 200 && response.type === "basic") {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(evt.request, responseClone);
                    });
                }
                return response;
            });
        }).catch(() => {
            // Fallback for offline if not cached (can show a placeholder or just fail gracefully)
        })
    );
});

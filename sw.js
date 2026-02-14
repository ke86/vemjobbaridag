/**
 * Service Worker for Vem jobbar idag?
 * Handles caching and automatic updates
 */

const CACHE_VERSION = 'v4.25.29';
const CACHE_NAME = `vemjobbar-${CACHE_VERSION}`;

// Files to cache (relative paths for GitHub Pages compatibility)
const FILES_TO_CACHE = [
  './',
  './index.html',
  // CSS files
  './css/styles.css',
  './css/components.css',
  './css/schedule.css',
  './css/editors.css',
  './css/fridagsnyckel.css',
  './css/viktiga-datum.css',
  './css/shadow.css',
  './css/dagvy.css',
  './css/departure.css',
  './css/aw-mode.css',
  './css/train-follow.css',
  './css/animations.css',
  './css/la.css',
  // JS files
  './js/config.js',
  './js/firebase.js',
  './js/auth.js',
  './js/schedule.js',
  './js/ui.js',
  './js/navigation.js',
  './js/dagvy.js',
  './js/departure.js',
  './js/ui-animations.js',
  './js/ui-editors.js',
  './js/ui-fridag.js',
  './js/denmark.js',
  './js/train-follow.js',
  './js/la.js',
  './js/app.js',
  // Assets
  './icon.png',
  './manifest.json',
  // Turn icons (SVG)
  './icons/SE.svg',
  './icons/DK.svg',
  './icons/A1.svg',
  './icons/B2.svg',
  './icons/RES.svg',
  './icons/XRES.svg',
  // Custom SVG icons (roliga dagar)
  './icons/semla.svg',
  './icons/chokladboll.svg',
  './icons/kanelbulle.svg',
  './icons/smorgastarta.svg',
  './icons/NO.svg'
];

// External CDN resources needed for offline start
const EXTERNAL_TO_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-app-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-auth-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-firestore-compat.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// CDN domains that should be cached for offline use
const CACHEABLE_CDN_DOMAINS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app files');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        // Cache external CDN resources (non-blocking — don't fail install if CDN is down)
        return caches.open(CACHE_NAME).then((cache) => {
          console.log('[SW] Caching external CDN resources');
          return Promise.allSettled(
            EXTERNAL_TO_CACHE.map((url) =>
              cache.add(url).catch((err) => {
                console.warn('[SW] Failed to cache:', url, err);
              })
            )
          );
        });
      })
      .then(() => {
        // Force this service worker to become active
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('vemjobbar-')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Check if URL belongs to a cacheable CDN domain
function isCacheableCDN(url) {
  try {
    const hostname = new URL(url).hostname;
    return CACHEABLE_CDN_DOMAINS.some((domain) => hostname === domain);
  } catch (e) {
    return false;
  }
}

// Fetch event - cache first (stale-while-revalidate) for app files + CDN
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Connectivity ping — always network-only, never cache
  if (event.request.url.includes('_ping=1')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isLocal = event.request.url.startsWith(self.location.origin);
  const isCDN = isCacheableCDN(event.request.url);

  // Only handle local files and whitelisted CDN domains
  if (!isLocal && !isCDN) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache immediately, update cache in background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Not in cache — try network and cache the result
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

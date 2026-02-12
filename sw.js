/**
 * Service Worker for Vem jobbar idag?
 * Handles caching and automatic updates
 */

const CACHE_VERSION = 'v4.18.5';
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
  './js/train-follow.js',
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

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests (Firebase, CDN, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response for caching
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

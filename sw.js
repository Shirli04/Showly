const CACHE_NAME = 'showly-offline-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script-cloudinary.js',
    '/firebase-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event: Cache essential files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching offline assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Serve from cache if offline
self.addEventListener('fetch', event => {
    // Sadece GET isteklerini yakala ve Firebase WebChannel/Firestore veya Cloudflare Analytics (cdn-cgi) isteklerini yoksay
    if (
        event.request.method !== 'GET' ||
        !event.request.url.startsWith('http') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('google.com') ||
        event.request.url.includes('cdn-cgi')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(async () => {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }
            // Offline'dayken ve cache'te yoksa, resmi bozmamak adına asıl hatayı üretmek daha güvenli
            // 503 sentetik hata üretmek resimlerin "kırık ikon" yerine bloklanmasına ve retry'ın ölmesine yol açıyordu.
            throw new TypeError('Network request failed');
        })
    );
});

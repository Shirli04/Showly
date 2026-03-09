const CACHE_NAME = 'showly-offline-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script-cloudinary.js',
    '/firebase-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css'
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
    // Sadece GET isteklerini yakala ve asenkron hizmetleri yoksay (Firebase, Cloudflare, Resimler vb.)
    if (
        event.request.method !== 'GET' ||
        !event.request.url.startsWith('http') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('google.com') ||
        event.request.url.includes('cdn-cgi') ||
        event.request.url.includes('cloudflareinsights.com') ||
        event.request.url.includes('img.showlytm.store')
    ) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // 1. Önce her zaman Ağdan (Network) canlı veriyi çekmeyi dene
                const networkResponse = await fetch(event.request);

                // 2. SPA UYUMU (Safari Yönlendirme Hatasının Ana Çözümü)
                // Eğer sunucu bir dizin bulamayıp 404 verirse (Çünkü SPA'da fiziksel dosyalar yoktur)
                // ve istek bir sayfa gezintisi ise (navigate), index.html'i döndür.
                if (event.request.mode === 'navigate' && networkResponse.status === 404) {
                    const indexCache = await caches.match('/index.html');
                    if (indexCache) return indexCache;
                }

                return networkResponse;
            } catch (error) {
                // 3. İNTERNET YOK Durumu (Network Error)
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Ön bellekte (Cache) yoksa bile, eylem bir sayfa yönlendirmesi ise Index'i ver.
                if (event.request.mode === 'navigate') {
                    const indexCache = await caches.match('/index.html');
                    if (indexCache) return indexCache;
                }

                // Safari'nin toptan çökmesini engellemek için sessiz hata at.
                throw new TypeError('Network request failed');
            }
        })()
    );
});

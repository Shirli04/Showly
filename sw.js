const CACHE_NAME = 'showly-offline-v2';
const IMG_CACHE_NAME = 'showly-images-v1';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script-cloudinary.js',
    '/firebase-config.js',
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
                    if (cacheName !== CACHE_NAME && cacheName !== IMG_CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Smart caching strategies
self.addEventListener('fetch', event => {
    // Sadece GET isteklerini yakala
    if (
        event.request.method !== 'GET' ||
        !event.request.url.startsWith('http') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('google.com') ||
        event.request.url.includes('cloudflareinsights.com')
    ) {
        return;
    }

    // ✅ ÜRÜN RESİMLERİ: Cache-First Stratejisi (Önce cache'ten ver, arka planda güncelle)
    if (event.request.url.includes('img.showlytm.store') || 
        (event.request.url.includes('cdn-cgi/image') && event.request.url.includes('img.showlytm.store'))) {
        event.respondWith(
            caches.open(IMG_CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(event.request);
                
                // Arka planda güncelle (Stale-While-Revalidate)
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => null);

                // Cache varsa hemen döndür (anında yükleme!)
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Cache yoksa ağdan bekle
                const networkResponse = await fetchPromise;
                if (networkResponse) return networkResponse;

                // Hiçbiri yoksa boş yanıt
                return new Response('', { status: 503 });
            })
        );
        return;
    }

    // Diğer istekler: Network-first stratejisi
    event.respondWith(
        (async () => {
            try {
                // 1. Önce her zaman Ağdan (Network) canlı veriyi çekmeyi dene
                const networkResponse = await fetch(event.request);

                // 2. SPA UYUMU (Safari Yönlendirme Hatasının Ana Çözümü)
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

                // Safari'nin toptan çökmesini engellemek için 503 (Servis Yok) yanıtı dön
                return new Response('Bağlantı yok ve içerik önbellekte değil.', { status: 503, statusText: 'Service Unavailable' });
            }
        })()
    );
});

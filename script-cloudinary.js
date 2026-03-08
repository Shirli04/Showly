document.addEventListener('DOMContentLoaded', async () => {

    // --- DOM ELEMANLARI ---
    var storeList = document.getElementById('store-list');
    var productsGrid = document.getElementById('products-grid');
    var searchInput = document.getElementById('search-input');
    var searchButton = document.getElementById('search-button');
    var cartButton = document.getElementById('cart-button');
    var favoritesButton = document.getElementById('favorites-button');
    var cartCount = document.querySelector('.cart-count');
    var favoritesCount = document.querySelector('.favorites-count');
    var loadingOverlay = document.getElementById('loading-overlay');
    var storeBanner = document.getElementById('store-banner');
    var heroSection = document.querySelector('.hero-section');
    var infoSection = document.querySelector('.info-section');

    // Mobil menü elemanları
    var menuToggle = document.getElementById('menu-toggle');
    var menuClose = document.getElementById('menu-close');
    var storeMenu = document.getElementById('store-menu');
    var menuOverlay = document.getElementById('menu-overlay');

    // 404 sayfası elemanları
    var notFoundSection = document.getElementById('not-found');
    var backHomeLink = document.getElementById('back-home-link');

    // Ayrılmış filtreleme elemanları
    var categoryFiltersSection = document.getElementById('category-filters-section');
    var mainFiltersSection = document.getElementById('main-filters-section');
    var mainFilterToggleBtn = document.getElementById('main-filter-toggle-btn');
    var mainFiltersContainer = document.getElementById('main-filters-container');
    var reservationBtn = document.getElementById('rezervasyon-yap-btn');
    var bronBtn = document.getElementById('bron-yap-btn');

    // --- DURUM DEĞİŞKENLERİ (STATE) & SAFESTORAGE ---
    const SafeStorage = {
        _memoryObj: {},
        getItem: function (key) {
            try { return localStorage.getItem(key) || this._memoryObj[key]; }
            catch (e) { return this._memoryObj[key] || null; }
        },
        setItem: function (key, value) {
            try { localStorage.setItem(key, value); }
            catch (e) { this._memoryObj[key] = value; }
        },
        removeItem: function (key) {
            try { localStorage.removeItem(key); }
            catch (e) { delete this._memoryObj[key]; }
        }
    };

    var cart = {};
    var favorites = [];
    try { cart = JSON.parse(SafeStorage.getItem('showlyCart')) || {}; } catch (e) { cart = {}; }
    try { favorites = JSON.parse(SafeStorage.getItem('showlyFavorites')) || []; } catch (e) { favorites = []; }

    var currentStoreId = null;
    var allStores = [];
    var allProducts = [];
    var currentActiveFilter = null;
    window.isInitialLoadComplete = false;

    // SMS URL açma fonksiyonu
    // ✅ DÜZELTME: Sadece bir yöntem kullanılıyor.
    // Eskiden window.location.href + iki ayrı window.open() çağrısı vardı.
    // Sorun: window.location.href sayfayı yönlendirince arkasındaki window.open()
    // çağrıları hiçbir zaman çalışmıyordu. Üstelik birden fazla SMS penceresi
    // açmaya çalışmak popup engelleyicileri tetikler.
    function openSmsUrl(url, phoneNumber, orderText) {
        try {
            console.log('📱 SMS açılıyor:', url);
            console.log('📱 Telefon:', phoneNumber);

            // Tek yöntem: SMS uygulamasına yönlendir
            window.location.href = url;

        } catch (error) {
            console.error('❌ SMS açılamadı:', error);
            showNotification(`✅ Sargyt kabul edildi! Telefon: ${phoneNumber}`, true);
        }
    }

    // Firebase kontrolü
    if (!window.db) {
        console.error('❌ Firebase veritabanı bulunamadı!');
        showNotification('Firebase yüklenemedi! Lütfen sayfayı yenileyin.', false);
        return;
    }

    // ✅ PERFORMANS: Direkt mağaza erişiminde skeleton göster, ana sayfada home elemanlarını koru.
    const currentPath = window.location.pathname.replace('/', '');
    const isDirectStoreAccess = currentPath && currentPath !== '';

    if (loadingOverlay) loadingOverlay.style.display = 'none'; // Artık loading overlay'i varsayılan olarak kapalı tutuyoruz

    if (isDirectStoreAccess) {
        // Direkt mağaza: skeleton göster, home elemanlarını gizle
        const heroEl = document.querySelector('.hero-section');
        const infoEl = document.querySelector('.info-section');
        if (heroEl) heroEl.style.display = 'none';
        if (infoEl) infoEl.style.display = 'none';

        showStoreSkeleton(); // ✅ Eski overlay yerine profesyonel skeleton yapısını çağır
    }

    // ✅ PERFORMANS: Önbellek yardımcı fonksiyonları
    const CACHE_KEY = 'showly_data_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

    function getCachedData() {
        try {
            const cached = SafeStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();

            if (now - timestamp > CACHE_DURATION) {
                SafeStorage.removeItem(CACHE_KEY);
                return null;
            }

            console.log('✅ Önbellekten veri yüklendi (SafeStorage)');
            return data;
        } catch (e) {
            console.warn('Önbellek okuma hatası, baypas ediliyor.', e);
            return null;
        }
    }

    function setCachedData(data) {
        try {
            SafeStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Önbellek yazma hatası, baypas ediliyor.', e);
        }
    }

    // --- INDEXEDDB YARDIMCI SİSTEMİ (Hatasızlaştırılmış Versiyon) ---
    const IDB_CONFIG = { name: 'ShowlyProductsDB', store: 'products', version: 1 };

    const showlyIDB = {
        _db: null,
        async init() {
            if (this._db) return this._db;
            return new Promise((resolve) => {
                try {
                    const request = indexedDB.open(IDB_CONFIG.name, IDB_CONFIG.version);
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(IDB_CONFIG.store)) {
                            db.createObjectStore(IDB_CONFIG.store, { keyPath: 'id' });
                        }
                    };
                    request.onsuccess = (e) => {
                        this._db = e.target.result;
                        resolve(this._db);
                    };
                    request.onerror = (e) => {
                        console.warn('IDB başlatılamadı:', e);
                        resolve(null);
                    };
                } catch (err) {
                    console.warn('IDB exception:', err);
                    resolve(null);
                }
            });
        },
        async saveProducts(products) {
            const db = await this.init();
            if (!db) return;
            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(IDB_CONFIG.store, 'readwrite');
                    const store = transaction.objectStore(IDB_CONFIG.store);
                    products.forEach(p => store.put(p));
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (e) => resolve(); // Sessizce yut
                } catch (err) {
                    resolve();
                }
            });
        },
        async getProductsStore(storeId) {
            const db = await this.init();
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(IDB_CONFIG.store, 'readonly');
                    const store = transaction.objectStore(IDB_CONFIG.store);
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const allP = request.result || [];
                        resolve(allP.filter(p => p.storeId === storeId));
                    };
                    request.onerror = (e) => resolve([]);
                } catch (err) {
                    resolve([]);
                }
            });
        },
        async searchAllProducts() {
            const db = await this.init();
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(IDB_CONFIG.store, 'readonly');
                    const store = transaction.objectStore(IDB_CONFIG.store);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                } catch (err) {
                    resolve([]);
                }
            });
        }
    };

    // Veri yükleme akışını en sona taşıdık (hoisting sorunlarını önlemek için)

    // ✅ Veri çekme ve önbellekleme (Üç Katmanlı Mimari / Triple-Tier Promise Race)
    async function fetchAndCacheData(onlyStores = false) {
        console.log('🔄 Temel veriler Firebase ve Worker yarışması (Race) ile yükleniyor...');

        const fetchFirebase = async () => {
            if (!window.db) throw new Error('Firebase DB bulunamadı');
            const [storesSnap, parentCatsSnap, subCatsSnap, catsSnap] = await Promise.all([
                window.db.collection('stores').get(),
                window.db.collection('parentCategories').get(),
                window.db.collection('subcategories').get(),
                window.db.collection('categories').get()
            ]);
            return {
                stores: storesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                parentCategories: parentCatsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                subcategories: subCatsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                categories: catsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                source: 'Firebase'
            };
        };

        const fetchWorker = async () => {
            const WORKER_URL = 'https://api-worker.showlytmstore.workers.dev/';
            // AbortController ile 8 saniyede Worker timeout verilebilir ama Promise.any halledecektir
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(WORKER_URL, {
                    method: 'GET', mode: 'cors', cache: 'no-cache', signal: controller.signal
                });
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();
                if (!data || !data.stores) throw new Error('Geçersiz Worker verisi');
                return {
                    stores: data.stores || [],
                    parentCategories: data.parentCategories || [],
                    subcategories: data.subcategories || [],
                    categories: data.categories || [],
                    source: 'Worker'
                };
            } finally {
                clearTimeout(timeoutId);
            }
        };

        try {
            // Hangi sunucu daha hızlıysa, sistem onu kabul eder ve yola devam eder
            const result = await Promise.any([
                fetchFirebase().catch(e => { console.warn('Firebase yarıştan çekildi:', e); throw e; }),
                fetchWorker().catch(e => { console.warn('Worker yarıştan çekildi:', e); throw e; })
            ]);

            allStores = result.stores;
            window.allParentCategories = result.parentCategories;
            window.allSubcategories = result.subcategories;
            window.allOldCategories = result.categories;
            window.isInitialLoadComplete = true; // ✅ Temel yükleme bitti

            console.log(`✅ ${allStores.length} mağaza yüklendi (KAYNAK: ${result.source})`);

            if (allStores.length > 0) {
                setCachedData({
                    stores: allStores,
                    parentCategories: window.allParentCategories,
                    subcategories: window.allSubcategories,
                    categories: window.allOldCategories
                });
            }

            if (currentStoreId) renderStorePage(currentStoreId);
            return true;

        } catch (masterError) {
            console.error('❌ KRİTİK HATA: Hiçbir uzak sunucudan veri çekilemedi!', masterError);
            return false;
        }
    }


    // --- YÖNLENDİRME (ROUTING) FONKSİYONU ---
    async function router() {
        const path = window.location.pathname.replace('/', '');

        if (!path) { // Ana sayfaysak
            lastRenderedStoreId = null; // ✅ Mağazaya geri dönünce kartlar yeniden oluşturulsun
            if (heroSection) heroSection.style.display = 'block';
            if (infoSection) infoSection.style.display = 'grid';
            if (storeBanner) storeBanner.style.display = 'none';
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
            if (mainFiltersSection) mainFiltersSection.style.display = 'none';
            if (reservationBtn) reservationBtn.style.display = 'none';
            if (productsGrid) productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'none';
            document.title = 'Showly - Online Katalog Platformasy';
            return;
        }

        // Ana sayfa elemanlarını gizle
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (notFoundSection) notFoundSection.style.display = 'none';

        // ✅ PERFORMANS: Veri yüklenmemişse skeleton göster
        if (allStores.length === 0) {
            console.log('⏳ Veriler henüz yüklenmedi, skeleton gösteriliyor...');
            showStoreSkeleton();
            return;
        }

        const store = allStores.find(s => s.slug === path);

        if (store) {
            window.scrollTo(0, 0);
            renderStorePage(store.id);
            document.title = `${store.name} - Showly`;
        } else {
            if (storeBanner) storeBanner.style.display = 'none';
            window.scrollTo(0, 0);
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
            if (mainFiltersSection) mainFiltersSection.style.display = 'none';
            if (reservationBtn) reservationBtn.style.display = 'none'; // ✅ GÜNCELLENDİ
            if (productsGrid) productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'block';
            document.title = 'Sahypa tapylmady - Showly';
        }
    }

    // ✅ PERFORMANS: Skeleton screen fonksiyonu
    function showStoreSkeleton() {
        if (storeBanner) {
            storeBanner.style.display = 'block';
            storeBanner.innerHTML = `
                <div class="store-banner-content">
                    <div class="skeleton-banner" style="width:100%; height:200px; border-radius:15px; margin-bottom:20px;"></div>
                </div>
            `;
        }

        if (productsGrid) {
            productsGrid.style.display = 'grid';
            productsGrid.innerHTML = '';

            // 6 skeleton kart göster
            for (let i = 0; i < 6; i++) {
                const skeletonCard = document.createElement('div');
                skeletonCard.className = 'product-card skeleton-card';
                skeletonCard.innerHTML = `
                    <div class="skeleton-image"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                `;
                productsGrid.appendChild(skeletonCard);
            }
        }
    }

    // ✅ YENİ: Kategorili menü yapısı
    async function renderCategoryMenu() {
        try {
            const categoryMenu = document.getElementById('category-menu');

            // ✅ Element kontrolü
            if (!categoryMenu) {
                console.error('❌ category-menu elementi bulunamadı!');
                return;
            }

            while (categoryMenu.firstChild) categoryMenu.removeChild(categoryMenu.firstChild); // Önce temizle

            // ✅ Worker'dan gelen verileri kullan
            const parentCategories = window.allParentCategories || [];
            const subcategories = window.allSubcategories || [];

            console.log('📂 Ana Kategoriler (Worker):', parentCategories);
            console.log('📂 Alt Kategoriler (Worker):', subcategories);

            // Eğer hiç kategori yoksa, eski tek seviyeli sistemden veri çekmeye çalış
            if (parentCategories.length === 0) {
                console.log('⚠️ Ana kategori bulunamadı, eski sistem deneniyor...');

                const oldCategories = window.allOldCategories || [];

                if (oldCategories.length === 0) {
                    const noCategoryMsg = document.createElement('p');
                    noCategoryMsg.style.cssText = 'padding: 20px; color: rgba(255,255,255,0.7); text-align: center;';
                    noCategoryMsg.textContent = 'Henüz kategori eklenmemiş.';
                    categoryMenu.appendChild(noCategoryMsg);
                    return;
                }

                oldCategories.forEach(category => {
                    const categoryStores = allStores.filter(s => s.category === category.id);
                    if (categoryStores.length === 0) return;

                    const categoryIcon = category.icon || 'fa-tag';

                    const categoryItem = document.createElement('div');
                    categoryItem.className = 'category-item';
                    categoryItem.innerHTML = `
                        <div class="category-header" data-category="${category.id}">
                            <i class="fas fa-chevron-right chevron-icon"></i>
                            <i class="fas ${categoryIcon} category-logo-icon"></i>
                            <span class="category-name-text"></span>
                        </div>
                        <ul class="category-stores" id="stores-${category.id}" style="display: none;">
                            ${categoryStores.map(store => `
                                <li>
                                    <a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                                        <span class="store-name-text"></span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    `;

                    categoryItem.querySelector('.category-name-text').textContent = getCategoryName(category);
                    categoryItem.querySelectorAll('.store-name-text').forEach((span, i) => {
                        span.textContent = categoryStores[i].name;
                    });
                    categoryMenu.appendChild(categoryItem);
                });

                // Eski sistem için event listener'ları ekle
                document.querySelectorAll('.category-header').forEach(header => {
                    header.addEventListener('click', () => {
                        const categoryId = header.getAttribute('data-category');
                        const storesList = document.getElementById(`stores-${categoryId}`);
                        const chevronIcon = header.querySelector('.chevron-icon');

                        if (storesList.style.display === 'none') {
                            storesList.style.display = 'block';
                            chevronIcon.style.transform = 'rotate(90deg)';
                        } else {
                            storesList.style.display = 'none';
                            chevronIcon.style.transform = 'rotate(0deg)';
                        }
                    });
                });

                console.log('✅ Eski kategori sistemi ile menü oluşturuldu');
                return;
            }

            if (allStores.length === 0) {
                const noStoreMsg = document.createElement('p');
                noStoreMsg.style.cssText = 'padding: 20px; color: rgba(255,255,255,0.7); text-align: center;';
                noStoreMsg.textContent = translate('no_stores', getSelectedLang());
                categoryMenu.appendChild(noStoreMsg);
                return;
            }

            // Her ana kategori için
            parentCategories.forEach(parent => {
                const parentIcon = parent.icon || 'fa-tag';

                // Bu ana kategoriye ait alt kategorileri bul
                const parentSubcategories = subcategories.filter(sub => sub.parentId === parent.id);

                // Bu kategori hiyerarşisindeki tüm mağazaları topla (alt kategorilerdeki + doğrudan ana kategoriye eklenenler)
                const categoryStoreIds = parentSubcategories.map(sub => sub.id);
                const subCategoryStores = allStores.filter(s => categoryStoreIds.includes(s.category));
                const directParentStores = allStores.filter(s => s.category === parent.id);
                const categoryStores = [...subCategoryStores, ...directParentStores];

                console.log(`📁 ${parent.name}: ${parentSubcategories.length} alt kategori, ${subCategoryStores.length} alt kategori mağaza, ${directParentStores.length} doğrudan ana kategori mağaza, toplam: ${categoryStores.length} mağaza`);

                if (categoryStores.length === 0) return; // Boş kategorileri gösterme

                // Ana kategori başlığı
                const parentItem = document.createElement('div');
                parentItem.className = 'category-item';
                parentItem.innerHTML = `
                    <div class="category-header" data-category="${parent.id}">
                        <i class="fas fa-chevron-right chevron-icon"></i>
                        <i class="fas ${parentIcon} category-logo-icon"></i>
                        <span>${getCategoryName(parent)}</span>
                    </div>
                    <ul class="category-stores" id="stores-${parent.id}" style="display: none;">
                        ${parentSubcategories.map(sub => {
                    const subStores = allStores.filter(s => s.category === sub.id);
                    if (subStores.length === 0) return '';

                    return `
                                <li class="subcategory-item">
                                    <div class="subcategory-header" data-subcategory="${sub.id}">
                                        <i class="fas fa-chevron-right chevron-icon"></i>
                                        <span class="subcategory-name">${getCategoryName(sub)}</span>
                                    </div>
                                    <ul class="subcategory-stores" id="sub-stores-${sub.id}" style="display: none;">
                                        ${subStores.map(store => `
                                            <li>
                                                <a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                                                    ${store.name}
                                                </a>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </li>
                            `;
                }).join('')}
                        ${directParentStores.length > 0 ? directParentStores.map(store => `
                            <li>
                                <a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                                    ${store.name}
                                </a>
                            </li>
                        `).join('') : ''}
                    </ul>
                `;
                categoryMenu.appendChild(parentItem);
            });

            // Açılır/kapanır menü event'i
            document.querySelectorAll('.category-header').forEach(header => {
                header.addEventListener('click', () => {
                    const categoryId = header.getAttribute('data-category');
                    const storesList = document.getElementById(`stores-${categoryId}`);
                    const chevronIcon = header.querySelector('.chevron-icon');

                    if (storesList.style.display === 'none') {
                        storesList.style.display = 'block';
                        chevronIcon.style.transform = 'rotate(90deg)';
                    } else {
                        storesList.style.display = 'none';
                        chevronIcon.style.transform = 'rotate(0deg)';
                    }
                });
            });

            // Alt kategori açılır/kapanır menü event'i
            document.querySelectorAll('.subcategory-header').forEach(subHeader => {
                subHeader.addEventListener('click', (e) => {
                    e.stopPropagation(); // Ana kategori tıklamasını engelle
                    const subcategoryId = subHeader.getAttribute('data-subcategory');
                    const subStoresList = document.getElementById(`sub-stores-${subcategoryId}`);
                    const subChevronIcon = subHeader.querySelector('.chevron-icon');

                    if (subStoresList.style.display === 'none') {
                        subStoresList.style.display = 'block';
                        subChevronIcon.style.transform = 'rotate(90deg)';
                    } else {
                        subStoresList.style.display = 'none';
                        subChevronIcon.style.transform = 'rotate(0deg)';
                    }
                });
            });

            console.log('✅ Kategori menüsü oluşturuldu');

        } catch (error) {
            console.error('❌ Kategori menüsü oluşturulamadı:', error);
        }
    }

    // --- KATEGORİ FİLTRELERİNİ OLUŞTURAN FONKSİYON (Yatay Sticky Bar) ---
    const renderCategories = (storeId, activeFilter) => {
        const lang = getSelectedLang();
        const section = document.getElementById('category-filters-section');
        const container = document.getElementById('category-buttons-container');
        if (!container) return;

        const storeProducts = allProducts.filter(p => p.storeId === storeId);

        // Benzersiz kategorileri orijinal adlarına (category_tm) göre topla
        const categoriesMap = new Map();
        storeProducts.forEach(p => {
            const baseCat = p.category;
            if (baseCat && !categoriesMap.has(baseCat)) {
                // Ekranda gösterilecek dili belirle
                const displayCat = getProductField(p, 'category', lang) || baseCat;
                categoriesMap.set(baseCat, displayCat);
            }
        });

        // Temizle
        while (container.firstChild) container.removeChild(container.firstChild);

        // Kategori yoksa bölümü gizle
        if (categoriesMap.size === 0) {
            if (section) section.style.display = 'none';
            return;
        }

        if (section) section.style.display = 'block';

        // "Hepsi" butonu
        const allBtn = document.createElement('button');
        allBtn.className = 'category-chip' + (!activeFilter || activeFilter?.type !== 'CATEGORY' ? ' active' : '');
        allBtn.textContent = translate('filter_all', lang);
        allBtn.addEventListener('click', () => renderStorePage(storeId, null));
        container.appendChild(allBtn);

        // Kategori butonları
        categoriesMap.forEach((displayCat, baseCat) => {
            const btn = document.createElement('button');
            // Active klası orijinal isme göre kontrol edilecek
            btn.className = 'category-chip' + (activeFilter?.type === 'CATEGORY' && activeFilter.value === baseCat ? ' active' : '');
            // Ekranda çevrilmiş isim yazacak
            btn.textContent = displayCat;
            // Tıklandığında sisteme orijinal ismi (TM) gönderecek
            btn.addEventListener('click', () => renderStorePage(storeId, { type: 'CATEGORY', value: baseCat }));
            container.appendChild(btn);
        });
    };

    // --- GENEL FİLTRELERİ OLUŞTURAN FONKSİYON ---
    const renderMainFilters = (storeId, activeFilter) => {
        const store = allStores.find(s => s.id === storeId);

        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        const discountedProducts = storeProducts.filter(p => p.isOnSale);
        const expensiveProducts = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500);

        // ✅ MEVCUT REZERVASYON (BANKET) BUTONUNU YÖNET
        const existingReservationBtn = document.getElementById('rezervasyon-yap-btn');
        const existingBronBtn = document.getElementById('bron-yap-btn');

        if (existingReservationBtn) {
            if (store && store.hasReservation) {
                existingReservationBtn.style.display = 'inline-flex';
                existingReservationBtn.onclick = () => openBanquetPlanning(storeId);
            } else {
                existingReservationBtn.style.display = 'none';
            }
        }

        // ✅ YENİ: BRON BUTONUNU YÖNET
        if (existingBronBtn) {
            if (store && store.hasBron) {
                existingBronBtn.style.display = 'inline-flex';
                existingBronBtn.onclick = () => openBronPlanning(storeId);
            } else {
                existingBronBtn.style.display = 'none';
            }
        }

        const lang = getSelectedLang();

        mainFiltersContainer.innerHTML = `
            <div class="price-filter-group">
                <div class="price-filter-group-title">${translate('filter_quick', lang)}</div>
                <div class="category-buttons-container">
                    <button class="filter-option-btn ${activeFilter?.type === 'DISCOUNT' ? 'active' : ''}" data-filter-type="DISCOUNT">
                        <i class="fas fa-percentage"></i> ${translate('filter_discount', lang)} <span class="category-count">${discountedProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'SORT_PRICE_ASC' ? 'active' : ''}" data-filter-type="SORT_PRICE_ASC">
                        <i class="fas fa-sort-amount-up"></i> ${translate('filter_price_asc', lang)} <span class="category-count">${storeProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'SORT_PRICE_DESC' ? 'active' : ''}" data-filter-type="SORT_PRICE_DESC">
                        <i class="fas fa-sort-amount-down"></i> ${translate('filter_price_desc', lang)} <span class="category-count">${storeProducts.length}</span>
                    </button>
                </div>
            </div>
            <div class="price-filter-group">
                <div class="price-filter-group-title">${translate('filter_price_range', lang)}</div>
                <div class="price-range-inputs">
                    <input type="number" id="min-price" placeholder="${translate('filter_min_tmt', lang)}" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.min : ''}">
                    <span>-</span>
                    <input type="number" id="max-price" placeholder="${translate('filter_max_tmt', lang)}" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.max : ''}">
                </div>
            </div>
        `;

        // Hızlı filtre butonları
        mainFiltersContainer.querySelectorAll('.filter-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filterType = btn.getAttribute('data-filter-type');
                renderStorePage(storeId, { type: filterType });
            });
        });

        // Fiyat aralığı inputları
        const minPriceInput = document.getElementById('min-price');
        const maxPriceInput = document.getElementById('max-price');

        const applyPriceRange = () => {
            const min = parseFloat(minPriceInput.value) || 0;
            const max = parseFloat(maxPriceInput.value) || Infinity;
            if (min > 0 || max < Infinity) {
                renderStorePage(storeId, { type: 'PRICE_RANGE', min, max });
            } else {
                renderStorePage(storeId, null);
            }
        };

        minPriceInput.addEventListener('input', applyPriceRange);
        maxPriceInput.addEventListener('input', applyPriceRange);
    };


    // ✅ PERFORMANS: Hangi mağazanın kartları oluşturuldu
    let lastRenderedStoreId = null;

    // ✅ YENİ: Mağaza bazlı tembel yükleme (Stale-While-Revalidate Pattern)
    // IDB veya RAM'den anında yükle, arka planda Firebase'den güncel veriyi çek
    const _storeProductFetchPromises = {}; // Aynı mağaza için paralel istek engelle

    async function getStoreProducts(storeId) {
        // 1. Önce RAM'e bak (anlık sayfa içi cache)
        let cachedProducts = allProducts.filter(p => p.storeId === storeId);

        // 2. IndexedDB'yi de hızlıca kontrol et (RAM boşsa)
        if (cachedProducts.length === 0) {
            try {
                const idbProducts = await showlyIDB.getProductsStore(storeId);
                if (idbProducts && idbProducts.length > 0) {
                    console.log(`📦 IDB'den ${idbProducts.length} ürün önce gösterildi (${storeId})`);
                    // RAM'e ekle ki ikinci gidişte hızlı olsun
                    allProducts = [...allProducts.filter(p => p.storeId !== storeId), ...idbProducts];
                    cachedProducts = idbProducts;
                }
            } catch (e) {
                console.warn('IDB hatası es geçildi.', e);
            }
        }

        // 3. ✅ HER ZAMAN arka planda Firebase'den güncel veriyi çek (yeni ürün eklenmiş olabilir)
        // Aynı mağaza için zaten fetch yapılıyorsa tekrar başlatma
        if (!_storeProductFetchPromises[storeId]) {
            _storeProductFetchPromises[storeId] = (async () => {
                console.log(`☁️ Firebase'den güncel ürünler çekiliyor (${storeId})...`);
                try {
                    const snap = await window.db.collection('products').where('storeId', '==', storeId).get();
                    const freshProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    if (freshProducts.length > 0) {
                        // ✅ RAM'i güncelle (eski veriyi tamamen değiştir)
                        allProducts = [...allProducts.filter(p => p.storeId !== storeId), ...freshProducts];
                        // ✅ IDB'yi güncelle
                        showlyIDB.saveProducts(freshProducts).catch(() => { });
                        console.log(`✅ Firebase'den ${freshProducts.length} güncel ürün alındı (${storeId})`);

                        // Eğer daha önce IDB'den farklı sayıda ürün gösterilmişse, sayfayı sessizce güncelle
                        if (freshProducts.length !== cachedProducts.length) {
                            console.log(`🔄 Yeni ürün fark edildi (IDB: ${cachedProducts.length}, Firebase: ${freshProducts.length}). UI güncelleniyor...`);
                            renderStorePage(storeId, window._currentActiveFilter || null);
                        }
                    }
                } catch (err) {
                    // Firebase başarısız oldu; eski cache yeterli
                    console.warn('Arka plan Firebase güncellemesi başarısız:', err);
                } finally {
                    // 30 saniye sonra aynı mağaza için tekrar fetch yapılabilsin
                    setTimeout(() => { delete _storeProductFetchPromises[storeId]; }, 30000);
                }
            })();
        }

        // 4. Cache BOŞSA (ilk ziyaret) Firebase'den bekleyerek yükle
        if (cachedProducts.length === 0) {
            await _storeProductFetchPromises[storeId];
            return allProducts.filter(p => p.storeId === storeId);
        }

        // 5. Cache doluysa hemen dön, arka planda güncelleme devam eder
        return cachedProducts;
    }

    const renderStorePage = async (storeId, activeFilter = null) => {
        currentActiveFilter = activeFilter; // ✅ Global filtreyi güncelle
        window._currentActiveFilter = activeFilter; // ✅ Arka plan callback'i için de güncelle
        const store = allStores.find(s => s.id === storeId);
        if (!store) return;

        // ✅ PERFORMANS: Ürünleri 'Tembel Yükleme' (Lazy Loading) yöntemiyle getir
        let storeProducts = await getStoreProducts(storeId);

        // Ürünler haala yoksa (ilk defa çekiliyorsa), skeleton göster ve bekle
        const hasProducts = storeProducts.length > 0;
        const isNewStore = currentStoreId !== storeId;
        const cardsNeeded = productsGrid && productsGrid.querySelector('.product-card:not(.skeleton-card)') === null;

        if (!hasProducts && isNewStore) {
            console.log('⏳ Ürünler Firebase veya IDB\'den bekleniyor...');
            showStoreSkeleton();
        }

        // ✅ Ziyaret sayısını SADECE mağaza ilk açıldığında artır
        if (isNewStore) {
            let storeViews = store.views || 0;
            try {
                const storeRef = window.db.collection('stores').doc(storeId);
                storeRef.update({
                    views: firebase.firestore.FieldValue.increment(1)
                }).catch(e => console.warn('Sayaç DB hatası:', e));
                storeViews += 1;
                const storeIdx = allStores.findIndex(s => s.id === storeId);
                if (storeIdx !== -1) allStores[storeIdx].views = storeViews;
            } catch (vErr) {
                console.warn('Sayaç hazırlık hatası:', vErr);
            }
        }

        currentStoreId = storeId;

        // ✅ PERFORMANS: Sadece yeni mağazada veya kartlar yokken (arka plan yüklemesi bittiyse) kartları/banner'ı oluştur
        if (isNewStore || (hasProducts && cardsNeeded)) {
            // Ürün grid'ini temizle ve göster
            if (productsGrid) {
                productsGrid.innerHTML = '';
                productsGrid.style.display = 'grid';
            }

            // ✅ Banner skeleton/içerik sadece mağaza değiştiğinde güncellenir
            if (isNewStore && storeBanner) {
                storeBanner.style.display = 'block';
                storeBanner.innerHTML = '<div class="banner-skeleton"></div>';
            }

            // Mağaza banner içeriğini oluştur (Sadece yeni mağaza ise)
            if (isNewStore && storeBanner) {
                const storeViews = store.views || 0;
                storeBanner.innerHTML = `
                    <div class="store-banner-content" style="position: relative;">
                        
                        <div class="store-info">
                            <h2 id="store-banner-name"></h2>
                            <p id="store-banner-text"></p>
                        </div>
                        <div class="store-social-buttons-container" id="social-buttons-grid">
                        </div>
                    </div>
                `;
                document.getElementById('store-banner-name').textContent = store.name;
                document.getElementById('store-banner-text').textContent = store.customBannerText || '';
            }

            const socialGrid = document.getElementById('social-buttons-grid');
            if (isNewStore && socialGrid) {
                if (store.tiktok) {
                    const link = document.createElement('a');
                    link.href = store.tiktok; link.target = '_blank';
                    link.className = 'social-button tiktok-button';
                    link.innerHTML = '<i class="fab fa-tiktok"></i>';
                    socialGrid.appendChild(link);
                }
                if (store.instagram) {
                    const link = document.createElement('a');
                    link.href = store.instagram; link.target = '_blank';
                    link.className = 'social-button instagram-button';
                    link.innerHTML = '<i class="fab fa-instagram"></i>';
                    socialGrid.appendChild(link);
                }
                if (store.phone) {
                    const link = document.createElement('a');
                    link.href = `tel:${store.phone}`;
                    link.className = 'social-button phone-button';
                    link.innerHTML = '<i class="fas fa-phone"></i>';
                    socialGrid.appendChild(link);
                }
                if (store.location) {
                    const link = document.createElement('a');
                    link.href = `https://maps.google.com/?q=${encodeURIComponent(store.location)}`;
                    link.target = '_blank'; link.className = 'social-button location-button';
                    link.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
                    socialGrid.appendChild(link);
                }
            }
        }

        // ✅ TÜM ürün kartlarını bir kez oluştur (Eğer kartlar yoksa veya mağaza değiştiyse)
        if (isNewStore || (hasProducts && cardsNeeded)) {
            // ✅ YENİ: Tek Bir IntersectionObserver (Bellek Şişmesini - Memory Leak - Önler!)
            let globalImgObserver = null;
            if ('IntersectionObserver' in window) {
                globalImgObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const lazyImage = entry.target;
                            if (lazyImage.dataset.src) {
                                lazyImage.src = lazyImage.dataset.src;
                                lazyImage.removeAttribute('data-src'); // RAM Temizliği
                            }
                            observer.unobserve(lazyImage);
                        }
                    });
                }, { rootMargin: "0px 0px 200px 0px" });
            }

            const sortedProducts = [...storeProducts].sort((a, b) => {
                const aHasImage = a.imageUrl && a.imageUrl.trim() !== '';
                const bHasImage = b.imageUrl && b.imageUrl.trim() !== '';
                const aHasPrice = a.price && parseFloat(a.price.replace(' TMT', '')) > 0;
                const bHasPrice = b.price && parseFloat(b.price.replace(' TMT', '')) > 0;
                const aScore = (aHasImage ? 2 : 0) + (aHasPrice ? 1 : 0);
                const bScore = (bHasImage ? 2 : 0) + (bHasPrice ? 1 : 0);
                return bScore - aScore;
            });

            sortedProducts.forEach((product, index) => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                // ✅ Data attribute'lar filtre için
                productCard.setAttribute('data-product-id', product.id);
                productCard.setAttribute('data-store-id', product.storeId || '');
                productCard.setAttribute('data-category', product.category || '');
                productCard.setAttribute('data-on-sale', product.isOnSale ? 'true' : 'false');
                const priceVal = parseFloat((product.price || '0').replace(' TMT', '')) || 0;
                productCard.setAttribute('data-product-price', priceVal);

                let priceDisplayElement = null;

                if (product.isOnSale && product.originalPrice) {
                    const normalPriceValue = parseFloat(product.price.replace(' TMT', ''));
                    const discountedPriceValue = parseFloat(product.originalPrice.replace(' TMT', ''));

                    if (!isNaN(normalPriceValue) && !isNaN(discountedPriceValue) && normalPriceValue > discountedPriceValue) {
                        const discountPercentage = Math.round(((normalPriceValue - discountedPriceValue) / normalPriceValue) * 100);

                        const priceContainer = document.createElement('div');
                        priceContainer.className = 'price-container';

                        const priceInfo = document.createElement('div');
                        priceInfo.className = 'price-info';

                        const currentPrice = document.createElement('span');
                        currentPrice.className = 'current-price';
                        currentPrice.textContent = product.originalPrice;

                        const originalPrice = document.createElement('span');
                        originalPrice.className = 'original-price';
                        originalPrice.textContent = product.price;

                        priceInfo.appendChild(currentPrice);
                        priceInfo.appendChild(originalPrice);

                        const badge = document.createElement('span');
                        badge.className = 'discount-percentage-badge';
                        badge.textContent = `-%${discountPercentage}`;

                        priceContainer.appendChild(priceInfo);
                        priceContainer.appendChild(badge);

                        priceDisplayElement = priceContainer;
                    }
                }

                // ✅ ÖZEL LAZY LOADING (iPhone Safari Bug Fix)
                // Safari iOS çoklu resim atamalarında (DOM enjekte) istekleri iptal edebildiği için
                // img etiketine src atanmıyor, dataset (data-src) içine gizleniyor.
                // IntersectionObserver ile resmi ekrana geldiğinde yükleyeceğiz.
                const fallbackImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idHJhbnNwYXJlbnQiLz48L3N2Zz4='; // Şeffaf 1x1 piksel
                const targetImageUrl = getOptimizedImageUrl(product.imageUrl);

                const _lang = getSelectedLang();
                productCard.innerHTML = `
                    ${product.isOnSale ? `<div class="discount-badge">${translate('discount', _lang)}</div>` : ''}
                    <div class="product-image-container">
                        <div class="img-skeleton"></div>
                        <img class="product-img" src="${fallbackImage}" data-src="${targetImageUrl}" decoding="async" alt="Product">
                        <button class="btn-favorite" data-id="${product.id}" title="${translate('add_to_favorites', _lang) || 'Halanlaryma goş'}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title"></h3>
                        <span class="product-category-label"></span>
                        <div class="price-display-wrapper"></div>
                        <div class="product-actions" style="position:relative;">
                            <button class="btn-cart" data-id="${product.id}">
                                <i class="fas fa-shopping-cart"></i> ${translate('add_to_cart', _lang)}
                            </button>
                            <!-- YENİ: ADET SEÇİCİ KONTU (Sepete eklendikten sonra çıkacak) -->
                            <div class="quantity-control-container" data-id="${product.id}">
                                <button class="qty-btn remove-btn"><i class="fas fa-minus"></i></button>
                                <span class="qty-value">1</span>
                                <button class="qty-btn add-btn"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                `;

                productCard.querySelector('.product-img').alt = getProductField(product, 'name', _lang);
                productCard.querySelector('.product-title').textContent = getProductField(product, 'name', _lang);
                productCard.querySelector('.product-category-label').textContent = getProductField(product, 'category', _lang) || '';

                const wrapper = productCard.querySelector('.price-display-wrapper');
                if (priceDisplayElement) {
                    wrapper.appendChild(priceDisplayElement);
                } else {
                    const priceSpan = document.createElement('span');
                    priceSpan.className = 'product-price';
                    priceSpan.textContent = product.price;
                    wrapper.appendChild(priceSpan);
                }

                // ✅ GÜVENİLİR RESİM İZLEYİCİSİ (INTERSECTION OBSERVER)
                const imgEl = productCard.querySelector('.product-img');
                const skeletonEl = productCard.querySelector('.img-skeleton');

                imgEl.onload = () => {
                    // Sadece gerçek resim yüklendiğinde skeleton'u sil
                    if (imgEl.src !== fallbackImage) {
                        imgEl.classList.add('loaded');
                        if (skeletonEl) skeletonEl.style.display = 'none';
                    }
                };

                imgEl.onerror = () => {
                    if (imgEl.src !== fallbackImage) {
                        imgEl.onerror = null;
                        imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGYwZjAiLz48cGF0aCBkPSJNMTYwIDE2MGg4MHY4MGgtODB6IiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iMjAwIiB5PSIyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5TdXJhdCB5b2s8L3RleHQ+PC9zdmc+'; // "Surat Yok" resmi
                        imgEl.classList.add('loaded', 'error');
                        if (skeletonEl) skeletonEl.style.display = 'none';
                    }
                };

                // Observer ile tembel yükleme ataması (Global Object Kullanımı)
                if (globalImgObserver) {
                    globalImgObserver.observe(imgEl);
                } else {
                    // Eski tarayıcılar için hemen yükle
                    if (imgEl.dataset.src) imgEl.src = imgEl.dataset.src;
                }

                productsGrid.appendChild(productCard);
                updateFavoriteButton(product.id);
            });

            // ✅ YENİ: Sayfa yüklendiğinde (veya geri dönüldüğünde) sepet verilerine göre UI'ı güncelle
            restoreCartUI(storeId);

            lastRenderedStoreId = storeId;
            console.log(`✅ ${storeProducts.length} ürün kartı oluşturuldu (yeni mağaza)`);
        }

        // ✅ YENİ: Mevcut DOM'da yeniden UI restore (Filtreleme sorası resimler kalınca da işe yarar)
        restoreCartUI(storeId);

        // ✅ Filtreleri her zaman göster (Mağaza içi filtreler gizlenmemeli)
        if (categoryFiltersSection) categoryFiltersSection.style.display = 'block';
        if (mainFiltersSection) mainFiltersSection.style.display = 'block';
        renderCategories(storeId, activeFilter);
        renderMainFilters(storeId, activeFilter);

        // Filtrelenecek ürün ID'lerini belirle (String'e zorla)
        let visibleProductIds = new Set(storeProducts.map(p => String(p.id)));

        if (activeFilter) {
            switch (activeFilter.type) {
                case 'CATEGORY':
                    // ✅ GÜNCELLENDİ: Filtreleme artık Orijinal (BASE) kategori ismine göre yapılır
                    visibleProductIds = new Set(storeProducts.filter(p => p.category === activeFilter.value).map(p => p.id));
                    break;
                case 'DISCOUNT':
                    visibleProductIds = new Set(storeProducts.filter(p => p.isOnSale).map(p => p.id));
                    break;
                case 'EXPENSIVE':
                    visibleProductIds = new Set(storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500).map(p => p.id));
                    break;
                case 'PRICE_RANGE': {
                    const min = activeFilter.min || 0;
                    const max = activeFilter.max || Infinity;
                    visibleProductIds = new Set(storeProducts.filter(p => {
                        const price = parseFloat(p.price.replace(' TMT', ''));
                        return price >= min && price <= max;
                    }).map(p => p.id));
                    break;
                }
                // SORT_PRICE_ASC ve SORT_PRICE_DESC: tüm ürünler gösterilir, sadece sıralama değişir
            }
        }

        // ✅ Kartları göster/gizle (resimler korunur!)
        const allCards = productsGrid.querySelectorAll('.product-card[data-product-id]');
        let visibleCount = 0;

        // Ürün listesinde "animasyonlu geçiş" (Sıralanıyor efekti) için hazırlık
        productsGrid.classList.add('products-filtering');

        setTimeout(() => {
            allCards.forEach(card => {
                const productId = String(card.getAttribute('data-product-id'));
                if (visibleProductIds.has(productId)) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            // ✅ Sıralama gerekiyorsa kartların DOM sırasını değiştir (resimler yine korunur!)
            if (activeFilter?.type === 'SORT_PRICE_ASC' || activeFilter?.type === 'SORT_PRICE_DESC') {
                const visibleCards = Array.from(allCards).filter(c => c.style.display !== 'none');
                visibleCards.sort((a, b) => {
                    const priceA = parseFloat(a.getAttribute('data-product-price')) || 0;
                    const priceB = parseFloat(b.getAttribute('data-product-price')) || 0;
                    return activeFilter.type === 'SORT_PRICE_ASC' ? priceA - priceB : priceB - priceA;
                });
                // DOM sırasını değiştir (resimler korunur çünkü kartlar taşınıyor, silinmiyor!)
                visibleCards.forEach(card => productsGrid.appendChild(card));
                console.log(`✅ Ürünler ${activeFilter.type === 'SORT_PRICE_ASC' ? 'arzandan gymmada' : 'gymmatdan arzana'} sıralandı`);
            }

            // "Ürün bulunamadı" mesajı
            const existingNoResults = productsGrid.querySelector('.no-results');
            if (existingNoResults) existingNoResults.remove();

            if (visibleCount === 0 && window.isInitialLoadComplete) {
                const lang = getSelectedLang();
                const noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.innerHTML = '<i class="fas fa-box-open"></i><h3></h3>';
                noResults.querySelector('h3').textContent = translate('filter_no_product', lang);
                productsGrid.appendChild(noResults);
            }

            console.log(`✅ Filtre uygulandı: ${visibleCount}/${storeProducts.length} ürün gösteriliyor`);

            // Animasyonu bitir
            productsGrid.classList.remove('products-filtering');

        }, 300); // .products-filtering CSS geçiş süresi (0.3s) ile aynı olmalı
    };

    // ✅ YENİ: Site Ayarlarını Kontrol Et (Kategori Gizleme)
    async function checkSiteSettings() {
        try {
            const doc = await window.db.collection('settings').doc('general').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.hideCategories) {
                    console.log('🙈 Ayar aktif: Kategoriler ve Menü gizli kalıyor...');
                    window.isCategoriesHidden = true;
                    document.body.classList.remove('categories-visible');
                } else {
                    console.log('👁️ Kategoriler görünür yapılıyor.');
                    window.isCategoriesHidden = false;
                    document.body.classList.add('categories-visible');
                }
            } else {
                window.isCategoriesHidden = false; // ✅ Ayar yoksa varsayılan: görünür
            }
        } catch (error) {
            console.error('Ayarlar okunamadı:', error);
            window.isCategoriesHidden = false; // ✅ Hata durumunda varsayılan: görünür
        }
    }

    // --- ARAMA FONKSİYONU (✅ ÇOK DİLLİ) ---
    const performSearch = async () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query === '') {
            showNotification(translate('search_empty_warning'));
            return;
        }

        // ✅ Çok dilli arama: seçili dile göre alan belirle
        const sLang = getSelectedLang();

        let productsToSearch = [];
        if (currentStoreId) {
            productsToSearch = allProducts.filter(p => p.storeId === currentStoreId);
        } else {
            // Ana sayfada isek IndexedDB'deki TÜM yerel ürünlerde ara
            try {
                productsToSearch = await showlyIDB.searchAllProducts();
                if (!productsToSearch || productsToSearch.length === 0) productsToSearch = allProducts;
            } catch (e) {
                productsToSearch = allProducts;
            }
        }

        const filteredProducts = productsToSearch.filter(product => {
            const name = getProductField(product, 'name', sLang).toLowerCase();
            const desc = getProductField(product, 'desc', sLang).toLowerCase();
            return name.includes(query) || desc.includes(query);
        });

        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
        if (mainFiltersSection) mainFiltersSection.style.display = 'none';

        if (storeBanner) {
            storeBanner.style.display = 'block';
            while (storeBanner.firstChild) storeBanner.removeChild(storeBanner.firstChild);
            const searchTitle = document.createElement('h2');
            searchTitle.textContent = `${translate('search_results', sLang)}: "${query}"`;
            const searchSub = document.createElement('p');
            searchSub.textContent = `${filteredProducts.length} ${translate('search_count', sLang)}`;
            storeBanner.appendChild(searchTitle);
            storeBanner.appendChild(searchSub);
        }

        productsGrid.style.display = 'grid';
        while (productsGrid.firstChild) productsGrid.removeChild(productsGrid.firstChild);

        if (filteredProducts.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = '<i class="fas fa-search"></i><h3></h3>';
            noResults.querySelector('h3').textContent = translate('no_results', sLang);
            productsGrid.appendChild(noResults);
            return;
        }

        filteredProducts.forEach((product, index) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.setAttribute('data-product-id', product.id);

            // İlk 6 arama sonucunu anında indir, sonrakileri beklet (Hız optimizasyonu)
            const lazyAttribute = index >= 6 ? 'loading="lazy"' : '';

            // İndirim hesaplama
            const currentPrice = parseFloat(product.price.replace(' TMT', ''));
            const originalPrice = product.originalPrice ? parseFloat(product.originalPrice) : null;
            const discountPercent = originalPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

            // Fiyat HTML'i oluştur
            let priceHtml = '';
            if (originalPrice && discountPercent > 0) {
                priceHtml = `
                    <div class="price-container">
                        <div class="price-info">
                            <span class="current-price">${product.price}</span>
                            <span class="original-price">${originalPrice.toFixed(2)} TMT</span>
                        </div>
                        <span class="discount-percentage-badge">-${discountPercent}%</span>
                    </div>
                `;
            } else {
                priceHtml = `<p class="product-price">${product.price}</p>`;
            }

            productCard.innerHTML = `
                ${product.isOnSale ? `<div class="discount-badge">${translate('discount', sLang)}</div>` : ''}
                <div class="product-image-container">
                    <div class="img-skeleton"></div>
                    <img class="product-img" ${lazyAttribute}>
                    <button class="btn-favorite" data-id="${product.id}" title="${translate('add_to_favorites', sLang) || 'Halanlaryma goş'}">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title"></h3>
                    <span class="product-category-label"></span>
                    <div class="price-display-wrapper">
                        ${priceHtml}
                    </div>
                    <div class="product-actions" style="position:relative;">
                        <button class="btn-cart" data-id="${product.id}">
                            <i class="fas fa-shopping-cart"></i> ${translate('add_to_cart', sLang)}
                        </button>
                        <!-- YENİ: ADET SEÇİCİ KONTU (Sepete eklendikten sonra çıkacak) -->
                        <div class="quantity-control-container" data-id="${product.id}">
                            <button class="qty-btn remove-btn"><i class="fas fa-minus"></i></button>
                            <span class="qty-value">1</span>
                            <button class="qty-btn add-btn"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                </div>
            `;
            productCard.querySelector('.product-img').alt = getProductField(product, 'name', sLang);
            productCard.querySelector('.product-title').textContent = getProductField(product, 'name', sLang);
            productCard.querySelector('.product-category-label').textContent = getProductField(product, 'category', sLang) || '';

            // ✅ Güvenilir Image Load (Arama sonuçları için de)
            const imgEl = productCard.querySelector('.product-img');
            const skeletonEl = productCard.querySelector('.img-skeleton');
            imgEl.onload = () => {
                imgEl.classList.add('loaded');
                if (skeletonEl) skeletonEl.style.display = 'none';
            };
            imgEl.onerror = () => {
                imgEl.onerror = null;
                imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGYwZjAiLz48cGF0aCBkPSJNMTYwIDE2MGg4MHY4MGgtODB6IiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iMjAwIiB5PSIyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5TdXJhdCB5b2s8L3RleHQ+PC9zdmc+';
                imgEl.classList.add('loaded', 'error');
                if (skeletonEl) skeletonEl.style.display = 'none';
            };
            imgEl.src = getOptimizedImageUrl(product.imageUrl);

            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };

    // --- FAVORİLER SAYISINI GÜNCELLEME FONKSİYONU ---
    const updateFavoritesCount = () => {
        const favoritesCount = document.querySelector('.favorites-count');
        if (favoritesCount) {
            favoritesCount.textContent = favorites.length;
            favoritesCount.classList.toggle('show', favorites.length > 0);
            favoritesCount.style.display = favorites.length > 0 ? 'flex' : 'none';
        }
        SafeStorage.setItem('showlyFavorites', JSON.stringify(favorites));
    };

    // --- SEPET VE FAVORİ FONKSİYONLARI ---
    const toggleFavorite = (product) => {
        const index = favorites.findIndex(item => item.id === product.id);
        if (index !== -1) {
            favorites.splice(index, 1);
            showNotification(translate('fav_removed', getSelectedLang()));
        } else {
            favorites.push(product);
            showNotification(translate('fav_added', getSelectedLang()));
        }
        updateFavoritesCount();
        updateFavoriteButton(product.id);
    };

    const updateFavoriteButton = (productId) => {
        const buttons = document.querySelectorAll(`.btn-favorite[data-id="${productId}"]`);
        const isFavorite = favorites.some(item => item.id === productId);
        buttons.forEach(button => {
            button.classList.toggle('active', isFavorite);
            button.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
    };

    const updateCartCount = () => {
        let total = 0;
        Object.values(cart).forEach(storeCart => {
            total += storeCart.items.reduce((sum, item) => sum + item.quantity, 0);
        });
        if (cartCount) {
            cartCount.textContent = total;
            cartCount.classList.toggle('show', total > 0);
            cartCount.style.display = total > 0 ? 'flex' : 'none';
        }
        SafeStorage.setItem('showlyCart', JSON.stringify(cart));
    };

    // ✅ YENİ: Sepeti kaydet ve eşitle
    function saveCart() {
        updateCartCount();
    }

    const addToCart = (product) => {
        console.log('🛒 Sepete ekle çalışıyor:', product);

        const store = allStores.find(s => s.id === product.storeId);
        if (!store) {
            console.error('❌ Mağaza bulunamadı:', product.storeId);
            return;
        }

        if (!cart[product.storeId]) {
            cart[product.storeId] = {
                storeId: product.storeId,
                storeName: store.name,
                items: []
            };
        }

        const existing = cart[product.storeId].items.find(item => item.id === product.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart[product.storeId].items.push({ ...product, quantity: 1 });
        }

        saveCart(); // ✅ Kalıcı hale getir
        console.log('✅ Sepete eklendi:', product.title);
    };

    // --- OLAY DİNLEYİCİLER ---

    // Mobil menü
    menuToggle.addEventListener('click', () => {
        storeMenu.classList.add('active');
        menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    menuClose.addEventListener('click', () => {
        storeMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    menuOverlay.addEventListener('click', () => {
        storeMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Arama
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Filtreler butonu
    mainFilterToggleBtn.addEventListener('click', () => {
        const isHidden = mainFiltersContainer.style.display === 'none';
        mainFiltersContainer.style.display = isHidden ? 'block' : 'none';
    });

    // TikTok/Instagram in-app browser için touch scroll tespiti
    let touchStartX = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchClickExecuted = false; // Flag to prevent double clicks

    // Touch start - başlangıç pozisyonunu kaydet
    productsGrid.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isScrolling = false;
        touchClickExecuted = false;
    }, { passive: true });

    // Touch move - kaydırma yapıldı mı kontrol et
    productsGrid.addEventListener('touchmove', (e) => {
        const touchEndX = e.touches[0].clientX;
        const touchEndY = e.touches[0].clientY;

        const diffX = Math.abs(touchEndX - touchStartX);
        const diffY = Math.abs(touchEndY - touchStartY);

        // 10px'den fazla hareket varsa scroll olarak kabul et
        if (diffX > 10 || diffY > 10) {
            isScrolling = true;
        }
    }, { passive: true });

    // Touch end - scroll değilse click olarak kabul et
    productsGrid.addEventListener('touchend', (e) => {
        if (isScrolling) {
            return; // Scroll yapılıyorsa, click event'i tetikleme
        }

        const favBtn = e.target.closest('.btn-favorite');
        if (favBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                const product = allProducts.find(p => p.id === favBtn.getAttribute('data-id'));
                if (product) toggleFavorite(product);
            }
            return;
        }

        // Tüm ürün içi aksiyonlarını (Sepete ekle, +, -) handleProductActions ile yönet
        const hasAction = e.target.closest('.btn-cart') || e.target.closest('.add-btn') || e.target.closest('.remove-btn');
        if (hasAction) {
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                handleProductActions(e);
            }
            return;
        }

        // Karta tıklandıysa (Actionlar hariç) modal aç
        const card = e.target.closest('.product-card');
        if (card && !e.target.closest('.product-actions')) {
            e.preventDefault();
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                const productId = card.getAttribute('data-product-id');
                openProductModal(productId);
            }
        }
    });

    // Normal click event (desktop için)
    productsGrid.addEventListener('click', (e) => {
        if (touchClickExecuted) return; // Ghost click önleme

        const btn = e.target.closest('.btn-favorite');
        if (btn) {
            e.stopPropagation();
            const product = allProducts.find(p => p.id === btn.getAttribute('data-id'));
            if (product) toggleFavorite(product);
            return;
        }

        // --- YENİ ADET KONTROL EVENTLERİ (DESKTOP) ---
        handleProductActions(e);

        const card = e.target.closest('.product-card');
        if (card && !e.target.closest('.product-actions')) {
            const productId = card.getAttribute('data-product-id');
            openProductModal(productId);
        }
    });

    // --- ORTAK: ADET KONTROL MERKEZİ ---
    function handleProductActions(e) {
        // 1. Sepete Ekle Butonuna Tıklama (İlk Ekleme)
        const cartBtn = e.target.closest('.btn-cart');
        if (cartBtn) {
            e.preventDefault();
            e.stopPropagation();

            const productId = cartBtn.getAttribute('data-id');
            const product = allProducts.find(p => p.id === productId);
            if (!product) return;

            // Ürünü Sepete Ekle
            addToCart(product);

            // Thumbnail Uçuş Animasyonu Başlat
            const productCard = cartBtn.closest('.product-card');
            const productImg = productCard.querySelector('.product-img');
            flyToCartAnimation(productImg);

            // Arayüz Değişimi: Butonu gizle, Adet Seçiciyi göster
            cartBtn.classList.add('hidden');
            const qtyContainer = productCard.querySelector('.quantity-control-container');
            if (qtyContainer) {
                qtyContainer.classList.add('active');
                qtyContainer.querySelector('.qty-value').textContent = "1";
            }
            return;
        }

        // 2. Artı (+) Butonu
        const addBtn = e.target.closest('.add-btn');
        if (addBtn) {
            e.preventDefault();
            e.stopPropagation();
            const container = addBtn.closest('.quantity-control-container');
            const productId = container.getAttribute('data-id');
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                addToCart(product); // addToCart mevcut ürünü bulup quantity++ yapar
                const storeCart = cart[product.storeId] || { items: [] };
                const item = storeCart.items.find(i => i.id === productId);
                if (item) container.querySelector('.qty-value').textContent = item.quantity;
            }
            return;
        }

        // 3. Eksi (-) Butonu
        const removeBtn = e.target.closest('.remove-btn');
        if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const container = removeBtn.closest('.quantity-control-container');
            const productId = container.getAttribute('data-id');

            // Cart'tan bu ürünü bul, adet düşür veya çıkar
            const productCard = container.closest('.product-card');
            removeFromCartPartially(productId, container, productCard);
            return;
        }
    }

    // Sepetten Adet Düşürme veya Tamamen Çıkarma Mantığı
    function removeFromCartPartially(productId, qtyContainer, productCard) {
        // Hangi mağazada olduğunu bulmamız lazım
        let targetStoreId = null;
        let itemIndex = -1;

        // Sepette ürünü ara
        for (const sId in cart) {
            const idx = cart[sId].items.findIndex(i => i.id === productId);
            if (idx !== -1) {
                targetStoreId = sId;
                itemIndex = idx;
                break;
            }
        }

        if (targetStoreId && itemIndex !== -1) {
            const item = cart[targetStoreId].items[itemIndex];
            item.quantity -= 1;

            if (item.quantity <= 0) {
                // Sepetten tamamen silindi
                cart[targetStoreId].items.splice(itemIndex, 1);

                // Arayüzü eski haline getir
                qtyContainer.classList.remove('active');
                const btnCart = productCard.querySelector('.btn-cart');
                if (btnCart) btnCart.classList.remove('hidden');
            } else {
                // Adet güncellendi
                qtyContainer.querySelector('.qty-value').textContent = item.quantity;
            }
        } else {
            // Hiç yoksa veya bir bug varsa sıfırla
            qtyContainer.classList.remove('active');
            const btnCart = productCard.querySelector('.btn-cart');
            if (btnCart) btnCart.classList.remove('hidden');
        }

        saveCart(); // UI ve Storage Güncellemesi
    }

    // --- EFSANE: UÇAN ÜRÜN ANİMASYONU ---
    function flyToCartAnimation(imgElement) {
        if (!imgElement) return;

        // Sepet İkonu Hedefi
        const cartIcon = document.getElementById('cart-button');
        if (!cartIcon) return;

        // Klon oluştur
        const flyingImg = imgElement.cloneNode(true);
        flyingImg.className = 'flying-thumbnail';

        // Başlangıç Koordinatları
        const startRect = imgElement.getBoundingClientRect();
        const endRect = cartIcon.getBoundingClientRect();

        flyingImg.style.left = `${startRect.left}px`;
        flyingImg.style.top = `${startRect.top}px`;
        flyingImg.style.width = `${startRect.width}px`;
        flyingImg.style.height = `${startRect.height}px`;

        document.body.appendChild(flyingImg);

        // Vanilla JS Performanslı Bezier Animasyonu (Web Animations API)
        const animation = flyingImg.animate([
            {
                transform: `translate(0, 0) scale(1)`,
                opacity: 1
            },
            {
                // Ortada hafif yukarı yay çizme efekti (Bezier etkisi)
                transform: `translate(${(endRect.left - startRect.left) * 0.5}px, ${(endRect.top - startRect.top) - 80}px) scale(0.6)`,
                opacity: 0.8
            },
            {
                transform: `translate(${endRect.left - startRect.left + 15}px, ${endRect.top - startRect.top + 15}px) scale(0.1)`,
                opacity: 0
            }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        });

        // Animasyon bitişinde temizlik ve Sepet Titretme (Pulse)
        animation.onfinish = () => {
            flyingImg.remove();
            cartIcon.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.3)' },
                { transform: 'scale(0.9)' },
                { transform: 'scale(1)' }
            ], { duration: 400, easing: 'ease-out' });
        };
    }

    // Modal kontrolleri
    const modalAddCartBtn = document.getElementById('modal-add-cart');

    // Modal add cart button touch handling
    let modalTouchStartX = 0;
    let modalTouchStartY = 0;
    let modalIsScrolling = false;
    let modalTouchClickExecuted = false;

    modalAddCartBtn.addEventListener('touchstart', (e) => {
        modalTouchStartX = e.touches[0].clientX;
        modalTouchStartY = e.touches[0].clientY;
        modalIsScrolling = false;
        modalTouchClickExecuted = false;
    }, { passive: true });

    modalAddCartBtn.addEventListener('touchmove', (e) => {
        const touchEndX = e.touches[0].clientX;
        const touchEndY = e.touches[0].clientY;

        const diffX = Math.abs(touchEndX - modalTouchStartX);
        const diffY = Math.abs(touchEndY - modalTouchStartY);

        if (diffX > 10 || diffY > 10) {
            modalIsScrolling = true;
        }
    }, { passive: true });

    modalAddCartBtn.addEventListener('touchend', (e) => {
        if (!modalIsScrolling && !modalTouchClickExecuted) {
            modalTouchClickExecuted = true;
            e.preventDefault(); // Prevent click event
            e.stopPropagation(); // Stop bubbling
            const modal = document.getElementById('product-modal');
            const productId = modal.getAttribute('data-product-id');
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                addToCart(product);
                history.back();
            }
        }
    });

    modalAddCartBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop bubbling
        const modal = document.getElementById('product-modal');
        const productId = modal.getAttribute('data-product-id');
        const product = allProducts.find(p => p.id === productId);
        if (product) {
            addToCart(product);
            // Modal'ı kapat (History back ile)
            history.back();
            // document.body.classList.remove('modal-open'); // popstate halleder
        }
    });

    // ✅ BACK BUTTON SUPPORT: Modalı kapatmak için history.back() kullan
    // Bu, popstate eventini tetikler ve modal oradan kapanır.
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            history.back();
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            history.back();
        }
    });

    // Sepet modalı
    cartButton.addEventListener('click', () => {
        const cartModal = document.getElementById('cart-modal');
        const cartItems = document.getElementById('cart-items');

        // ✅ ÖNCE TEMİZLE (Mükerrer mesajları önlemek için)
        while (cartItems.firstChild) cartItems.removeChild(cartItems.firstChild);

        // Sadece mevcut mağazanın sepetini göster
        const currentStoreCart = currentStoreId ? cart[currentStoreId] : null;

        if (!currentStoreCart || currentStoreCart.items.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-cart-message';
            emptyMsg.textContent = translate('cart_empty');
            cartItems.appendChild(emptyMsg);
            document.getElementById('cart-total-price').textContent = '0.00 TMT';
        } else {
            const storeSection = document.createElement('div');
            storeSection.className = 'cart-store-section';

            let storeTotal = 0;
            const itemsHTML = currentStoreCart.items.map(item => {
                const priceMatch = item.price ? item.price.toString().replace(/[^0-9.]/g, '') : '0';
                const price = parseFloat(priceMatch);
                storeTotal += price * item.quantity;
                return `
                    <div class="cart-item">
                        <img src="${item.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22%3E%3Crect fill=%22%23f5f5f5%22 width=%2230%22 height=%2230%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%228%22%3E%3C/text%3E%3C/svg%3E'}" style="width: 30px; height: 30px; max-width: 30px; max-height: 30px;" alt="${item.title}">
                        <div class="cart-item-details">
                            <div class="cart-item-title">${item.title}</div>
                            <div class="cart-item-price">${item.price}</div>
                        </div>
                        <div class="cart-item-quantity">
                            <span>${item.quantity} sany</span>
                        </div>
                        <i class="fas fa-trash cart-item-remove" data-store-id="${currentStoreCart.storeId}" data-id="${item.id}"></i>
                    </div>
                `;
            }).join('');

            storeSection.innerHTML = `
                <div class="cart-store-header">
                    <h4>${currentStoreCart.storeName}</h4>
                    <span class="cart-store-total">${translate('cart_total')}: ${storeTotal.toFixed(2)} TMT</span>
                </div>
                ${itemsHTML}
            `;
            cartItems.appendChild(storeSection);

            document.getElementById('cart-total-price').textContent = storeTotal.toFixed(2) + ' TMT';
        }
        cartModal.style.display = 'block';
        document.body.classList.add('modal-open');
        // ✅ BACK BUTTON SUPPORT
        history.pushState({ modal: 'cart-modal' }, '', window.location.href);
    });

    // 12. HATA ÇÖZÜMÜ: TikTok/Instagram in-app browser veya touch cihazlar için cart touch scroll tespiti
    // Hem touch hem click aynı anda tetiklenmesini engellemek için bir bayrak (flag) kullanıyoruz.
    let cartTouchStartX = 0;
    let cartTouchStartY = 0;
    let cartIsScrolling = false;
    let justTouched = false; // Ghost click önleme bayrağı

    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.cart-item-remove');
        if (target) {
            cartTouchStartX = e.touches[0].clientX;
            cartTouchStartY = e.touches[0].clientY;
            cartIsScrolling = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        const target = e.target.closest('.cart-item-remove');
        if (target) {
            const touchEndX = e.touches[0].clientX;
            const touchEndY = e.touches[0].clientY;

            const diffX = Math.abs(touchEndX - cartTouchStartX);
            const diffY = Math.abs(touchEndY - cartTouchStartY);

            if (diffX > 10 || diffY > 10) {
                cartIsScrolling = true;
            }
        }
    }, { passive: true });

    // Ortak Sepet İşlevi (Hem touch hem click için)
    const handleCartAction = (e) => {
        const removeBtn = e.target.closest('.cart-item-remove');
        if (removeBtn) {
            e.preventDefault();
            const storeId = removeBtn.getAttribute('data-store-id');
            const productId = removeBtn.getAttribute('data-id');
            if (cart[storeId]) {
                cart[storeId].items = cart[storeId].items.filter(i => i.id !== productId);
                if (cart[storeId].items.length === 0) {
                    delete cart[storeId];
                }
                saveCart(); // ✅ Güncelle ve kaydet

                // Müşterinin ekrandaki (ana sayfadaki) ürün kartı UI durumunu da güncelle (+/- gizle, sepete ekleyi geri getir)
                const productCard = document.querySelector(`.product-card[data-product-id="${productId}"]`);
                if (productCard) {
                    const btnCart = productCard.querySelector('.btn-cart');
                    const qtyContainer = productCard.querySelector('.quantity-control-container');

                    if (qtyContainer) {
                        qtyContainer.classList.remove('active');
                    }
                    if (btnCart) {
                        btnCart.classList.remove('hidden');
                    }
                }

                cartButton.click();
            }
            return true;
        }
        return false;
    };

    document.addEventListener('touchend', (e) => {
        if (cartIsScrolling) {
            return; // Scroll yapılıyorsa tetikleme
        }

        // Sepet işlemleri hedeflenmişse
        if (e.target.closest('.cart-item-remove')) {
            justTouched = true; // Click'i bypass etmek için bayrağı kaldır
            setTimeout(() => { justTouched = false; }, 300); // 300ms sonra normale dön
            handleCartAction(e);
        }
    });

    // Normal click event (desktop için, eğer touchend tetiklenmediyse çalışır)
    document.addEventListener('click', (e) => {
        if (justTouched) return; // Ghost click ise yoksay
        handleCartAction(e);
    });

    // --- SİPARİŞ TAMAMLAMA FONKSİYONU ---
    document.querySelector('.checkout-button').addEventListener('click', () => {
        const currentStoreCart = currentStoreId ? cart[currentStoreId] : null;

        if (!currentStoreCart || currentStoreCart.items.length === 0) {
            showNotification(translate('cart_is_empty'), false);
            return;
        }

        // ✅ DÜZELTME BUG 3: Çift form açılmasını önle.
        // Aynı mağaza için zaten bir form varsa yeni form açılmıyor, odaklanıyor.
        const existingForm = document.querySelector(`.order-form-overlay[data-store-id="${currentStoreCart.storeId}"]`);
        if (existingForm) {
            existingForm.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // Genel bir kontrol daha: Ekranda herhangi bir form varsa yenisini açma
        if (document.querySelector('.order-form-overlay')) {
            showNotification('Baýrak eýýäm açyk!', false);
            return;
        }

        const storeTotal = currentStoreCart.items.reduce((sum, item) => {
            const price = parseFloat(item.price.replace(' TMT', ''));
            return sum + (price * item.quantity);
        }, 0);

        const itemsPreview = currentStoreCart.items.map(item => `${item.title} (${item.quantity})`).join(', ');

        const formOverlay = document.createElement('div');
        formOverlay.className = 'order-form-overlay';
        formOverlay.setAttribute('data-store-id', currentStoreCart.storeId);
        formOverlay.innerHTML = `
                <div class="order-form-modal">
                    <div class="order-form-header">
                        <h3 class="order-store-name"></h3>
                        <p class="order-total-text"></p>
                    </div>
                    <div class="order-items-preview">
                        <strong>Harytlar:</strong> <span class="order-items-text"></span>
                    </div>
                    <form id="order-form-${currentStoreCart.storeId}">
                        <div class="form-group">
                            <label>Adyňyz Familiýaňyz</label>
                            <input type="text" class="customer-name" placeholder="Adyňyzy we Familiýaňyzy ýazyň" required>
                        </div>
                        <div class="form-group">
                            <label>Telefon nomeriňiz</label>
                            <input type="tel" class="customer-phone" value="+993 " required>
                        </div>
                        <div class="form-group">
                            <label>Adresiňiz</label>
                            <textarea class="customer-address" rows="3" placeholder="Adresiňizi ýazyň" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Bellik</label>
                            <textarea class="customer-note" rows="2" placeholder="Bellik"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary cancel-order-${currentStoreCart.storeId}">Aýyr</button>
                            <button type="submit" class="btn-primary">Sargyt ediň</button>
                        </div>
                    </form>
                </div>
        `;
        formOverlay.querySelector('.order-store-name').textContent = currentStoreCart.storeName;
        formOverlay.querySelector('.order-total-text').textContent = `Umumy: ${storeTotal.toFixed(2)} TMT`;
        formOverlay.querySelector('.order-items-text').textContent = itemsPreview;
        document.body.appendChild(formOverlay);

        // İptal butonu
        formOverlay.querySelector(`.cancel-order-${currentStoreCart.storeId}`).addEventListener('click', () => {
            formOverlay.remove();
        });

        // Telefon input kısıtlamaları
        const phoneInput = formOverlay.querySelector('.customer-phone');

        phoneInput.addEventListener('keydown', (e) => {
            // +993 kısmını silmeyi engelle
            if (phoneInput.selectionStart < 5 && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
            }
        });

        phoneInput.addEventListener('input', (e) => {
            if (!phoneInput.value.startsWith('+993 ')) {
                phoneInput.value = '+993 ' + phoneInput.value.replace(/\+993\s?/g, '').replace(/[^0-9]/g, '');
            }

            // Sadece rakamlara izin ver (ön ekten sonra)
            const prefix = '+993 ';
            let digits = phoneInput.value.substring(prefix.length).replace(/[^0-9]/g, '');

            // Maksimum 8 hane kısıtlaması
            if (digits.length > 8) {
                digits = digits.substring(0, 8);
            }

            phoneInput.value = prefix + digits;
        });

        // Form submit handler
        document.getElementById(`order-form-${currentStoreCart.storeId}`).addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = e.target.querySelector('.customer-name').value.trim();
            const phone = e.target.querySelector('.customer-phone').value.trim();
            const address = e.target.querySelector('.customer-address').value.trim();
            const note = e.target.querySelector('.customer-note').value.trim();

            if (!name || !phone || !address) {
                showNotification(translate('order_fill_all'), false);
                return;
            }

            // Telefon doğrulaması (+993 6XXXXXXX formatında 8 rakam)
            const phoneRegex = /^\+993\s\d{8}$/;
            if (!phoneRegex.test(phone)) {
                showNotification(translate('order_phone_invalid'), false);
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const cancelBtn = e.target.querySelector('.btn-secondary');
            submitBtn.disabled = true;
            cancelBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iberilýär...';

            const orderLoadingOverlay = document.getElementById('loading-overlay');
            const loadingText = document.querySelector('.loading-text');
            if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'flex';
            loadingText.textContent = translate('order_processing');

            // Mağazanın sipariş telefon numarasını al
            const store = allStores.find(s => s.id === currentStoreCart.storeId);
            const orderPhone = store?.orderPhone || '';

            // Telefon numarası yoksa SMS adımını atlayacağız ancak sipariş yine de Firebase'e gidecek

            // Sipariş metnini oluştur (Türkmençe)
            const itemsText = currentStoreCart.items.map(item => `- ${item.title} (${item.quantity} haryt)`).join('\n');
            let orderText = `Sargyt:\n${itemsText}\n\nAdy: ${name}\nTelefon: ${phone}\nAdres: ${address}`;
            if (note) orderText += `\nBellik: ${note}`;
            orderText += `\n\nUmumy: ${storeTotal.toFixed(2)} TMT`;

            // Telefon numarasını temizle
            const cleanNumber = orderPhone.replace(/[^0-9]/g, '');

            try {
                // Firebase'e siparişi kaydet
                const order = {
                    customer: { name, phone, address, note },
                    storeId: currentStoreCart.storeId,
                    storeName: currentStoreCart.storeName,
                    items: [...currentStoreCart.items],
                    total: storeTotal.toFixed(2) + ' TMT',
                    date: new Date().toISOString(),
                    timestamp: Date.now(),  // Timestamp for ordering
                    status: 'pending'
                };

                await window.db.collection('orders').add(order);
                console.log('Sipariş Firebase\'e eklendi');


                if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';
                showNotification(`✅ ${currentStoreCart.storeName} üçin sargydyňyz kabul edildi!`, true);

                // Bu mağazayı sepetten sil
                const orderedStoreId = currentStoreCart.storeId; // storeId'yi kopyala
                delete cart[orderedStoreId];
                updateCartCount();
                resetStoreCardsUI(orderedStoreId); // ✅ UI üzerindeki +/- butonlarını temizle

                if (orderPhone) {
                    // SMS URL oluştur
                    const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(orderText)}`;

                    console.log('📱 SMS açılıyor:', smsUrl);
                    console.log('📱 SMS içeriği:', orderText);

                    // Direkt SMS aç (tüm yöntemleri dene)
                    openSmsUrl(smsUrl, cleanNumber, orderText);
                } else {
                    console.log('ℹ️ Mağaza sipariş telefonu tanımlı değil, SMS adımı atlanıyor.');
                }

                // Sipariş modal'ını kapat
                const formOverlay = document.querySelector(`.order-form-overlay[data-store-id="${currentStoreCart.storeId}"]`);
                if (formOverlay) {
                    formOverlay.remove();
                }

                // Sepet modalını güncelle
                cartButton.click();

            } catch (error) {
                console.error('Sargyt goşulmady:', error);
                if (orderLoadingOverlay) orderLoadingOverlay.style.display = 'none';

                submitBtn.disabled = false;
                cancelBtn.disabled = false;
                submitBtn.innerHTML = 'Sargyt ediň';

                showNotification('Sargydyňyz döredilmedi! Täzeden synanyşyň.', false);
            }
        });
    });

    // ✅ YENİ: Favorileri render eden fonksiyon
    function renderFavorites() {
        const favoritesItems = document.getElementById('favorites-items');
        if (!favoritesItems) return;

        // Önce içeriği temizle (Mükerrer mesajları önlemek için)
        while (favoritesItems.firstChild) favoritesItems.removeChild(favoritesItems.firstChild);

        if (favorites.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-favorites-message';
            emptyMsg.textContent = translate('favorites_empty');
            favoritesItems.appendChild(emptyMsg);
        } else {
            const fLang = getSelectedLang();
            favorites.forEach(product => {
                const favItem = document.createElement('div');
                favItem.className = 'favorite-item';
                favItem.innerHTML = `
                    <div class="fav-img-container"></div>
                    <div class="favorite-item-info">
                        <div class="favorite-item-title">${getProductField(product, 'name', fLang)}</div>
                        <div class="favorite-item-price">${product.price}</div>
                        <div class="favorite-item-actions">
                            <button class="btn-remove-favorite" data-id="${product.id}">${translate('order_form_cancel', fLang)}</button>
                            <button class="btn-add-cart-from-fav" data-id="${product.id}">${translate('add_to_cart', fLang)}</button>
                        </div>
                    </div>
                `;

                const img = document.createElement('img');
                img.src = product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E%3C/text%3E%3C/svg%3E';
                img.alt = getProductField(product, 'name', fLang) || 'Product';
                favItem.querySelector('.fav-img-container').appendChild(img);
                favoritesItems.appendChild(favItem);
            });
        }
    }

    // Favoriler modalı
    favoritesButton.addEventListener('click', () => {
        const favoritesModal = document.getElementById('favorites-modal');
        renderFavorites();
        favoritesModal.style.display = 'block';
        document.body.classList.add('modal-open');
        // ✅ BACK BUTTON SUPPORT
        history.pushState({ modal: 'favorites-modal' }, '', window.location.href);
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-favorite')) {
            favorites = favorites.filter(f => f.id !== e.target.getAttribute('data-id'));
            updateFavoritesCount();
            renderFavorites(); // ✅ Modal açıkken anında güncelle
        }
        if (e.target.classList.contains('btn-add-cart-from-fav')) {
            const product = favorites.find(f => f.id === e.target.getAttribute('data-id'));
            if (product) {
                addToCart(product);
                // Burayı kapatmak istersen: document.getElementById('favorites-modal').style.display = 'none';
            }
        }
    });

    // Logo ve mağaza linkleri
    document.getElementById('logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, '/');
        router();
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.store-link')) {
            e.preventDefault();
            const href = e.target.closest('.store-link').getAttribute('href');
            history.pushState(null, null, href);
            router();
        }
    });

    backHomeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, '/');
        router();
    });

    // Tarayıcının geri/ileri butonları
    // ✅ BACK BUTTON SUPPORT: Geri basınca önce modal kapat, sonra router çalıştır
    window.addEventListener('popstate', (event) => {
        // 1. Açık modal var mı kontrol et
        const modals = document.querySelectorAll('.modal');
        let modalClosed = false;

        modals.forEach(modal => {
            if (modal.style.display !== 'none' && modal.style.display !== '') {
                modal.style.display = 'none';
                modalClosed = true;
            }
        });

        // Overlay elementlerini temizle (örn loading overlay değil, sadece modal overlayleri)
        document.body.classList.remove('modal-open');
        document.body.style.overflow = 'auto';

        // 2. Eğer modal kapattıysak Router'ı çalıştırma (Sadece modalı kapattık)
        if (modalClosed) {
            return;
        }

        // 3. Modal yoksa normal sayfa değişimi yap
        router();
    });

    // ✅ YENİ: Başlatıldığında Sepeti UI'ya Uygula
    function restoreCartUI(storeId) {
        if (!storeId || !cart[storeId]) return;
        const currentStoreCart = cart[storeId].items;

        currentStoreCart.forEach(item => {
            const productCard = document.querySelector(`.product-card[data-product-id="${item.id}"]`);
            if (productCard) {
                const btnCart = productCard.querySelector('.btn-cart');
                const qtyContainer = productCard.querySelector('.quantity-control-container');
                if (btnCart && qtyContainer) {
                    btnCart.classList.add('hidden');
                    qtyContainer.classList.add('active');
                    qtyContainer.querySelector('.qty-value').textContent = item.quantity;
                }
            }
        });
    }

    // ✅ YENİ: Sipariş sonrası veya sepet boşaldığında kartları sıfırla
    function resetStoreCardsUI(storeId) {
        const storeCards = document.querySelectorAll(`.product-card[data-store-id="${storeId}"]`);
        storeCards.forEach(card => {
            const btnCart = card.querySelector('.btn-cart');
            const qtyContainer = card.querySelector('.quantity-control-container');
            if (qtyContainer) qtyContainer.classList.remove('active');
            if (btnCart) btnCart.classList.remove('hidden');
        });
    }

    // --- YARDIMCI FONKSİYONLAR ---
    function getOptimizedImageUrl(url, width = 400) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();

        // HTTP'yi HTTPS'e zorla (Mixed Content hatasını önlemek için)
        if (url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }

        // Cloudflare R2 veya diğer URL'leri olduğu gibi döndür
        return url;
    }

    function openProductModal(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        const modal = document.getElementById('product-modal');
        modal.setAttribute('data-product-id', productId);

        // ✅ BACK BUTTON SUPPORT: Modal açıldığında geçmişe durum ekle
        history.pushState({ modal: 'product-modal' }, '', window.location.href);
        document.body.classList.add('modal-open');

        const modalImage = document.getElementById('modal-image');
        const modalSkeleton = document.getElementById('modal-img-skeleton');

        // ✅ GÜNCELLENDİ: Tıklanan ürünün ekrandaki mevcut resim kaynağını bul (Yeniden yüklemeyi önle)
        let preloadedImageUrl = product.imageUrl;
        const existingImgEl = document.querySelector(`.product-card[onclick="openProductModal('${productId}')"] img.product-img`);
        if (existingImgEl && existingImgEl.src) {
            preloadedImageUrl = existingImgEl.src;
        }

        // ✅ Resmi ve skeleton'u ayarla
        if (modalImage) {
            // Anında eldeki en iyi kalite resmi bas, skeleton göstermeye gerek kalmasın
            modalImage.src = preloadedImageUrl;
            modalImage.classList.add('loaded');
            if (modalSkeleton) modalSkeleton.style.display = 'none';

            // Arka planda yüksek kaliteli (varsa) versiyonu yükle
            const highResUrl = getOptimizedImageUrl(product.imageUrl, 800);
            if (highResUrl !== preloadedImageUrl) {
                const tempImg = new Image();
                tempImg.onload = () => {
                    modalImage.src = highResUrl;
                };
                tempImg.src = highResUrl;
            }

            modalImage.onerror = () => {
                modalImage.onerror = null;
                modalImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGYwZjAiLz48cGF0aCBkPSJNMTYwIDE2MGg4MHY4MGgtODB6IiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iMjAwIiB5PSIyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5TdXJhdCB5b2s8L2RleHQ+PC9zdmc+';
            };
        }

        // ✅ GÜNCELLENDİ: Çok dilli modal başlık
        document.getElementById('modal-title').textContent = getProductField(product, 'name', getSelectedLang());

        // ✅ İndirim kontrolü
        const modalPrice = document.getElementById('modal-price');
        const modalBadge = document.getElementById('modal-discount-badge');

        if (product.isOnSale && product.originalPrice) {
            const normalPriceValue = parseFloat(product.price.replace(' TMT', ''));
            const discountedPriceValue = parseFloat(product.originalPrice.replace(' TMT', ''));

            if (!isNaN(normalPriceValue) && !isNaN(discountedPriceValue) && normalPriceValue > discountedPriceValue) {
                // İndirimli görünüm
                modalPrice.innerHTML = `
                    <span class="current-price" style="color: var(--primary-color); font-weight: bold; font-size: 26px;">${product.originalPrice}</span>
                    <span class="original-price" style="text-decoration: line-through; color: #999; font-size: 18px; margin-left: 10px;">${product.price}</span>
                `;
                if (modalBadge) modalBadge.style.display = 'block';
            } else {
                modalPrice.textContent = product.price;
                if (modalBadge) modalBadge.style.display = 'none';
            }
        } else {
            modalPrice.textContent = product.price;
            if (modalBadge) modalBadge.style.display = 'none';
        }

        // ✅ GÜNCELLENDİ: Çok dilli modal açıklama
        // ✅ GÜNCELLENDİ: Çok dilli modal açıklama ve materyal
        document.getElementById('modal-description').textContent = getProductField(product, 'desc', getSelectedLang());
        // Material kontrolu - bossa satırı gizle
        const materialRow = document.getElementById('modal-material-row');
        const productMaterial = getProductField(product, 'material', getSelectedLang());
        if (productMaterial && productMaterial.trim() !== '') {
            document.getElementById('modal-material').textContent = productMaterial;
            if (materialRow) materialRow.style.display = 'block';
        } else {
            if (materialRow) materialRow.style.display = 'none';
        }

        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }

    function showNotification(message, isSuccess = true) {
        const notification = document.createElement('div');
        notification.className = 'notification';

        const content = document.createElement('div');
        content.className = 'notification-content';

        const icon = document.createElement('i');
        icon.className = `fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}`;

        const text = document.createElement('span');
        text.textContent = message;

        content.appendChild(icon);
        content.appendChild(text);
        notification.appendChild(content);

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- Ziyafet Planlama (Banquet Planning) Mantığı ---
    const banquetModal = document.getElementById('banquet-modal');
    const closeBanquetModal = document.getElementById('close-banquet-modal');
    const banquetForm = document.getElementById('banquet-form');
    const eventTypesList = document.getElementById('event-types-list');
    const guestOptionsList = document.getElementById('guest-options-list');
    const guestCountHidden = document.getElementById('guest-count');
    const packagesList = document.getElementById('banquet-packages-list');
    const banquetSubtotal = document.getElementById('banquet-subtotal');
    const banquetTotalDisplay = document.getElementById('banquet-total-price');

    let currentStorePackages = [];
    let selectedPackagePrice = 0;


    // Modalı açma fonksiyonu
    window.openBanquetPlanning = async function (storeId) {
        const store = allStores.find(s => s.id === storeId);
        if (!store) return;

        document.getElementById('banquet-store-name').textContent = store.name;

        if (banquetModal) {
            banquetModal.style.display = 'block';
            document.body.classList.add('modal-open');
            document.body.style.overflow = 'hidden';

            // ✅ BACK BUTTON SUPPORT
            history.pushState({ modal: 'banquet-modal' }, '', window.location.href);

            // Senenama çäklendirmesi (Geçmiş günleri ýap)
            const dateInput = document.getElementById('banquet-date');
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.setAttribute('min', today);
            }

            // Paketleri yükle
            await loadBanquetPackages(storeId);
        }
    };

    // Paketleri Firestore'dan çekme
    async function loadBanquetPackages(storeId) {
        if (!packagesList) return;

        packagesList.innerHTML = `<p class="loading-packages">${translate('banquet_loading_packages', getSelectedLang())}</p>`;

        try {
            const snapshot = await window.db.collection('reservationPackages')
                .where('storeId', '==', storeId)
                .get();

            currentStorePackages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (currentStorePackages.length === 0) {
                packagesList.innerHTML = `<p class="no-packages" style="padding: 20px; color: #888;">${translate('banquet_no_packages', getSelectedLang())}</p>`;
                return;
            }

            renderBanquetPackages();
        } catch (error) {
            console.error('❌ Paketler ýüklenip bilmedi:', error);
            packagesList.innerHTML = `<p class="error-packages">${translate('banquet_load_error', getSelectedLang())}</p>`;
        }
    }

    // Paketleri arayüze basma
    function renderBanquetPackages() {
        if (!packagesList) return;

        // Her bir menü maddesini ayrı bir paket kartı gibi işle
        let allDisplayPackages = [];
        let sharedServicesHtml = ''; // Hyzmatlar tüm paketler için ortak

        currentStorePackages.forEach((pkg) => {
            // İlk paketten hyzmatları al (ortak bölüm)
            if (!sharedServicesHtml && pkg.serviceFeatures && pkg.serviceFeatures.length > 0) {
                sharedServicesHtml = pkg.serviceFeatures.map(f => `
                    <li style="margin-bottom: 8px; font-size: 14px; color: #333; display: flex; align-items: flex-start; gap: 10px;">
                        <i class="fas fa-check" style="color: var(--primary-color); font-size: 12px; margin-top: 3px; flex-shrink: 0;"></i>
                        <span style="font-weight: 500;">${f.name || f}</span>
                    </li>
                `).join('');
            }

            if (pkg.menuItems && pkg.menuItems.length > 0) {
                pkg.menuItems.forEach((item, itemIndex) => {
                    allDisplayPackages.push({
                        displayId: `${pkg.id}_${itemIndex}`,
                        displayName: item.name,
                        displayPrice: item.price,
                        menuHtml: `
                            <li style="margin-bottom: 6px; font-size: 14px; color: #333; display: flex; align-items: flex-start; gap: 8px;">
                                <i class="fas fa-check" style="color: var(--primary-color); font-size: 12px; margin-top: 4px;"></i>
                                <span style="font-weight: 500; white-space: pre-line;">${item.name}</span>
                            </li>
                        `
                    });
                });
            } else {
                allDisplayPackages.push({
                    displayId: pkg.id,
                    displayName: pkg.packageName || 'Menýu Toplumy',
                    displayPrice: pkg.totalPrice || pkg.price,
                    menuHtml: '<li style="color: #888;">Menýu goşulmady.</li>'
                });
            }
        });

        // --- Menü kartları ---
        packagesList.innerHTML = allDisplayPackages.map((dpkg, index) => `
            <label class="package-item-card" style="width: 100%; min-width: 280px; margin-bottom: 15px; display: block; cursor: pointer;">
                <input type="radio" name="banquet-package" value="${dpkg.displayId}" ${index === 0 ? 'checked' : ''} data-price="${dpkg.displayPrice}">
                <div class="package-card-content" style="padding: 22px; border-radius: 20px; border: 2px solid #eee; transition: 0.3s; background: #fff; position: relative;">
                    <div class="package-badge" style="background: #1a1a1a; color: #fff; padding: 5px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 8px;">
                       <i class="fas fa-utensils"></i> ${dpkg.displayName}
                    </div>
                    <div style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Menýu:</div>
                    <ul class="package-features" style="list-style: none; padding: 0; margin: 0; text-align: left;">
                        ${dpkg.menuHtml}
                    </ul>
                    <div style="margin-top: 12px; font-size: 11px; color: #bbb; font-style: italic;">
                        * Menýu mazmuny üýtgedilip bilner.
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 13px; color: #888; display: block;">Taban Baha:</span>
                            <span style="font-size: 18px; font-weight: 800; color: #1a1a1a;">${dpkg.displayPrice} TMT</span>
                        </div>
                        <div class="selection-indicator">
                            <span style="font-size: 12px; font-weight: 600; color: var(--primary-color);">Saýlamak üçin basyň <i class="fas fa-arrow-right"></i></span>
                        </div>
                    </div>
                </div>
            </label>
        `).join('');

        // --- Hyzmatlar: menü kartlarının ALTINDA ayrı bir blok ---
        // Eski hyzmatlar bloğunu temizle
        const existingServicesBlock = document.getElementById('banquet-services-block');
        if (existingServicesBlock) existingServicesBlock.remove();

        if (sharedServicesHtml) {
            const servicesBlock = document.createElement('div');
            servicesBlock.id = 'banquet-services-block';
            servicesBlock.innerHTML = `
                <label style="width: 100%; min-width: 280px; margin-bottom: 15px; display: block;">
                    <div style="padding: 22px; border-radius: 20px; border: 2px solid #eee; background: #fff;">
                        <div style="background: #1a1a1a; color: #fff; padding: 5px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-concierge-bell"></i> Hyzmatlar
                        </div>
                        <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
                            ${sharedServicesHtml}
                        </ul>
                    </div>
                </label>
            `;
            // ✅ Güvenli ekleme: parentNode varsa insertBefore, yoksa appendChild
            if (packagesList.parentNode && packagesList.nextSibling) {
                packagesList.parentNode.insertBefore(servicesBlock, packagesList.nextSibling);
            } else if (packagesList.parentNode) {
                packagesList.parentNode.appendChild(servicesBlock);
            }
        }

        // Paket seçimi değiştiğinde alt seçenekleri güncelle
        document.querySelectorAll('input[name="banquet-package"]').forEach(input => {
            input.addEventListener('change', () => {
                selectedPackagePrice = parseFloat(input.dataset.price) || 0;
                updatePackageOptions(input.value);
            });
        });

        // İlk paketi varsayılan seç ve opsiyonları yükle
        const firstInput = document.querySelector('input[name="banquet-package"]:checked');
        if (firstInput) {
            selectedPackagePrice = parseFloat(firstInput.dataset.price) || 0;
            updatePackageOptions(firstInput.value);
        }
    }

    // Paket bazlı dinamik seçenekleri (hizmet ve kapasite) yükle
    function updatePackageOptions(displayId) {
        const originalId = displayId.split('_')[0]; // Prefiksden asyl ID-ni al
        const pkg = currentStorePackages.find(p => p.id === originalId);
        if (!pkg) return;

        // 1. Hizmet Görünüşleri (Event Types)
        if (eventTypesList) {
            const types = pkg.serviceTypes || ['Ziyafet'];
            eventTypesList.innerHTML = types.map((type, idx) => `
                <label class="event-type-card">
                    <input type="radio" name="event-type" value="${type}" ${idx === 0 ? 'checked' : ''}>
                    <div class="card-content" style="padding: 10px; border: 2px solid #eee; border-radius: 12px; text-align: center; cursor: pointer; transition: 0.3s; font-size: 14px;">
                        <i class="fas fa-star" style="display: block; margin-bottom: 5px;"></i>
                        <span>${type}</span>
                    </div>
                </label>
            `).join('');
        }

        // 2. Adam Sany (Capacities)
        if (guestOptionsList) {
            const capacities = pkg.capacities || [];

            // Ýatda sakla: Eger sanaw eýýäm bar bolsa we hiç zat saýlanmadyk bolsa (manual mode), täze renderde-de saýlama
            const isFirstRender = guestOptionsList.children.length === 0;
            const wasAnyChecked = document.querySelector('input[name="guest-option"]:checked');
            const shouldSelectDefault = isFirstRender || wasAnyChecked !== null;

            if (capacities.length === 0) {
                guestOptionsList.innerHTML = `<p style="grid-column: 1/-1; color: #888; font-size: 13px; padding: 10px;">${translate('banquet_no_capacity', getSelectedLang())}</p>`;
            } else {
                guestOptionsList.innerHTML = capacities.map((cap, idx) => {
                    const countMatch = cap.name.match(/\d+/);
                    const count = countMatch ? countMatch[0] : 0;
                    const extraPrice = cap.price || 0;

                    // Diňe öňem saýlanan bolsa, birinji element saýlansyn
                    const checkedAttr = (shouldSelectDefault && idx === 0) ? 'checked' : '';

                    return `
                        <label class="event-type-card guest-option-card">
                            <input type="radio" name="guest-option" value="${count}" data-extra-price="${extraPrice}" ${checkedAttr}>
                            <div class="card-content" style="padding: 12px; border: 2px solid #eee; border-radius: 12px; text-align: center; cursor: pointer; transition: 0.3s; font-size: 14px; position: relative;">
                                <i class="fas fa-users" style="display: block; margin-bottom: 5px; color: var(--primary-color);"></i>
                                <span style="font-weight: 700;">${cap.name}</span>
                                ${extraPrice > 0 ? `<div style="font-size: 10px; color: #2ecc71; margin-top: 3px;">+${extraPrice} TMT/adam</div>` : ''}
                            </div>
                        </label>
                    `;
                }).join('');

                // Kapasite seçimi değiştiğinde hesapla
                document.querySelectorAll('input[name="guest-option"]').forEach(radio => {
                    radio.addEventListener('change', calculateBanquetTotal);
                });
            }
        }

        calculateBanquetTotal();
    }

    // Toplam baha hesaplama
    function calculateBanquetTotal() {
        const guestCountInput = document.getElementById('guest-count');
        const selectedGuestOption = document.querySelector('input[name="guest-option"]:checked');

        const guestCount = guestCountInput ? parseInt(guestCountInput.value) || 0 : 0;
        const extraPrice = selectedGuestOption ? parseFloat(selectedGuestOption.dataset.extraPrice) || 0 : 0;

        // Toplam baha hasaplamasy (Kullanıcı kararı: Paket fiyatı + Seçenek ek fiyatı)
        const total = selectedPackagePrice + extraPrice;

        if (guestCountHidden) guestCountHidden.value = guestCount;
        if (banquetSubtotal) banquetSubtotal.textContent = `${selectedPackagePrice} TMT`;
        if (banquetTotalDisplay) banquetTotalDisplay.textContent = `${total} TMT`;
    }

    // Adam sany sanajy (+/-) düwmeleri
    document.addEventListener('click', (e) => {
        if (e.target.closest('#guest-plus-btn')) {
            const input = document.getElementById('guest-count');
            if (input) {
                // Radio buttonları uncheck et (el bilen sazlanýar)
                document.querySelectorAll('input[name="guest-option"]').forEach(r => r.checked = false);
                input.value = parseInt(input.value) + 10;
                calculateBanquetTotal();
            }
        }
        if (e.target.closest('#guest-minus-btn')) {
            const input = document.getElementById('guest-count');
            if (input && parseInt(input.value) > 10) {
                document.querySelectorAll('input[name="guest-option"]').forEach(r => r.checked = false);
                input.value = parseInt(input.value) - 10;
                calculateBanquetTotal();
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'guest-count') {
            document.querySelectorAll('input[name="guest-option"]').forEach(r => r.checked = false);
            calculateBanquetTotal();
        }
    });

    // Modalı kapatma
    closeBanquetModal?.addEventListener('click', () => {
        if (banquetModal && banquetModal.style.display === 'block') {
            // Eğer geçmişe biz eklediysek geri git, yoksa sadece kapat
            if (window.history.state && window.history.state.modal === 'banquet-modal') {
                history.back();
            } else {
                banquetModal.style.display = 'none';
                document.body.classList.remove('modal-open');
                document.body.style.overflow = 'auto';
            }
        }
    });

    // Rezervasyon butonu
    reservationBtn?.addEventListener('click', () => {
        if (currentStoreId) {
            window.openBanquetPlanning(currentStoreId);
        }
    });

    // Form gönderimi
    banquetForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = banquetForm.querySelector('.banquet-submit-btn');
        const originalText = submitBtn.innerHTML;

        const customerName = document.getElementById('banquet-customer-name')?.value;
        const customerPhone = document.getElementById('banquet-customer-phone')?.value;
        const eventDate = document.getElementById('banquet-date')?.value;
        const guestCount = guestCountHidden ? parseInt(guestCountHidden.value) : 0;
        const eventType = document.querySelector('input[name="event-type"]:checked')?.value;
        const packageId = document.querySelector('input[name="banquet-package"]:checked')?.value;
        const selectedPkg = currentStorePackages.find(p => p.id === packageId);

        if (!customerName || !customerPhone || !eventDate || !packageId) {
            showNotification(translate('banquet_fill_all', getSelectedLang()), false);
            return;
        }

        const reservationData = {
            orderType: 'reservation',
            storeId: currentStoreId,
            customer: {
                name: customerName,
                phone: customerPhone,
                address: `Ziyafet Senesi: ${eventDate}`,
                note: `${eventType} (${guestCount} adam)`
            },
            items: [{
                id: packageId,
                title: selectedPkg ? (selectedPkg.packageName || 'Ziyafet Paketi') : 'Ziyafet Paketi',
                price: selectedPackagePrice,
                quantity: 1
            }],
            totalPrice: selectedPackagePrice, // Artık sadece paket fiyatı
            status: 'pending',
            date: new Date().toISOString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${translate('banquet_submitting', getSelectedLang())}`;

            await window.db.collection('orders').add(reservationData);

            showNotification(translate('banquet_success', getSelectedLang()), true);
            history.back(); // Modal kapat (popstate tetiklenir)
            // document.body.style.overflow = 'auto'; // popstate halleder
            banquetForm.reset();
        } catch (error) {
            console.error('❌ Rezervasyon hatası:', error);
            showNotification(translate('banquet_error', getSelectedLang()), false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // --- Bron (Masa) Planlama Mantığı ---
    const bronModal = document.getElementById('bron-modal');
    const closeBronModal = document.getElementById('close-bron-modal');
    const bronForm = document.getElementById('bron-form');

    window.openBronPlanning = async function (storeId) {
        // Önce güncel mağaza verisini çek (önbellek baypas için)
        let store = null;
        try {
            const doc = await window.db.collection('stores').doc(storeId).get({ source: 'server' }); // ✅ Zorlamalı taze veri
            if (doc.exists) {
                store = { id: doc.id, ...doc.data() };
                // allStores önbelleğini de güncelle
                const idx = allStores.findIndex(s => s.id === storeId);
                if (idx !== -1) allStores[idx] = store;
            }
        } catch (e) {
            console.error('Mağaza verisi çekilemedi:', e);
            store = allStores.find(s => s.id === storeId);
        }

        if (!store) return;

        currentStoreId = storeId; // ✅ GÜNCELLENDİ: Global Store ID'yi set et
        console.log('📱 Bron modalı açıldı. Store ID:', currentStoreId, 'Mağaza Adı:', store.name);

        const bronSchemaImg = document.getElementById('bron-schema-img');
        const bronNoSchema = document.getElementById('bron-no-schema');
        const tableSelect = document.getElementById('bron-table-number');

        // Şemayı göster
        if (store.restaurantSchemaUrl) {
            bronSchemaImg.src = store.restaurantSchemaUrl;
            bronSchemaImg.style.display = 'block';
            bronNoSchema.style.display = 'none';
        } else {
            bronSchemaImg.style.display = 'none';
            bronNoSchema.style.display = 'block';
        }

        // Masaları doldur
        if (tableSelect) {
            tableSelect.innerHTML = `<option value="">${translate('bron_select_table', getSelectedLang())}</option>`;
            if (Array.isArray(store.tables) && store.tables.length > 0) {
                store.tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table;
                    option.textContent = table;
                    tableSelect.appendChild(option);
                });
            }
        }

        if (bronModal) {
            bronModal.style.display = 'block';
            document.body.classList.add('modal-open');
            document.body.style.overflow = 'hidden';

            history.pushState({ modal: 'bron-modal' }, '', window.location.href);

            const dateInput = document.getElementById('bron-date');
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.setAttribute('min', today);
                dateInput.value = today;
            }
        }
    };

    closeBronModal?.addEventListener('click', () => {
        if (bronModal && bronModal.style.display === 'block') {
            // Eğer geçmişe biz eklediysek geri git, yoksa sadece kapat
            if (window.history.state && window.history.state.modal === 'bron-modal') {
                history.back();
            } else {
                bronModal.style.display = 'none';
                document.body.classList.remove('modal-open');
                document.body.style.overflow = 'auto';
            }
        }
    });

    bronForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = bronForm.querySelector('.banquet-submit-btn');
        const originalText = submitBtn.innerHTML;

        const customerName = document.getElementById('bron-customer-name')?.value;
        const customerPhone = document.getElementById('bron-customer-phone')?.value;
        const eventDate = document.getElementById('bron-date')?.value; // YYYY-MM-DD
        const eventTime = document.getElementById('bron-time')?.value; // HH:MM
        const tableNumber = document.getElementById('bron-table-number')?.value;

        if (!customerName || !customerPhone || !eventDate || !eventTime || !tableNumber) {
            showNotification(translate('banquet_fill_all', getSelectedLang()), false);
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${translate('banquet_submitting', getSelectedLang())}`;

            // --- ÇAKIŞMA KONTROLÜ (CONFLICT CHECK) ---
            console.log('🔍 Çakışma kontrolü yapılıyor... Store:', currentStoreId, 'Tablo:', tableNumber);
            const snapshot = await window.db.collection('orders')
                .where('storeId', '==', String(currentStoreId).trim())
                .where('orderType', '==', 'bron')
                .get({ source: 'server' }); // ✅ Zorlamalı taze veri

            const existingReservations = snapshot.docs.map(doc => doc.data());

            // Seçilen zamanı Date objesine çevir
            const requestedDateTime = new Date(`${eventDate}T${eventTime}`);

            const hasConflict = existingReservations.some(res => {
                // Not: customer.address formatımız "Bron Senesi: YYYY-MM-DD HH:MM"
                // Ya da note kısmında "Stol No: X" veya "Masa No: X" var.
                const resTable = res.customer.note.replace('Stol No: ', '').replace('Masa No: ', '');
                if (resTable !== tableNumber) return false;

                const resDateTimeStr = res.customer.address.replace('Bron Senesi: ', '');
                const resDateTime = new Date(resDateTimeStr.replace(' ', 'T'));

                // ±2 saat (120 dakika) fark kontrolü
                const diffMs = Math.abs(requestedDateTime - resDateTime);
                const diffMinutes = diffMs / (1000 * 60);

                return diffMinutes < 120; // 2 saatten az fark varsa çakışma var
            });

            if (hasConflict) {
                showNotification(translate('bron_already_booked', getSelectedLang()), false);
                return;
            }

            const bronData = {
                orderType: 'bron',
                storeId: String(currentStoreId).trim(),
                customer: {
                    name: customerName,
                    phone: customerPhone,
                    address: `Bron Senesi: ${eventDate} ${eventTime}`,
                    note: `Stol No: ${tableNumber}`
                },
                items: [{
                    id: 'bron_table',
                    title: `Bron: ${tableNumber}`,
                    price: 0,
                    quantity: 1
                }],
                totalPrice: 0,
                status: 'pending',
                date: new Date().toISOString(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            console.log('📤 Bron verisi kaydediliyor (StoreId: ' + currentStoreId + '):', bronData);
            const docRef = await window.db.collection('orders').add(bronData);
            console.log('✅ Bron başarıyla kaydedildi! Kayıt ID:', docRef.id);
            showNotification(translate('banquet_success', getSelectedLang()), true);
            history.back();
            bronForm.reset();
        } catch (error) {
            console.error('❌ Bron hatası:', error);
            showNotification(translate('banquet_error', getSelectedLang()), false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // ✅ YENİ: Dil değişim callback'i – DOM yeniden oluşturulmadan güncelleme
    onLanguageChange((newLang) => {
        // 1. Statik metinleri güncelle (data-i18n / data-i18n-placeholder)
        applyTranslations();

        // 2. Ürün kartı textlerini güncelle (performans: sadece text değişir)
        const cards = document.querySelectorAll('.product-card[data-product-id]');
        cards.forEach(card => {
            const productId = card.getAttribute('data-product-id');
            // Ürün ID'sini string olarak karşılaştır (Firebase'den bazen number/string karışık gelebilir)
            const product = allProducts.find(p => String(p.id) === String(productId));
            if (!product) return;

            const titleEl = card.querySelector('.product-title');
            if (titleEl) titleEl.textContent = getProductField(product, 'name', newLang);

            const categoryEl = card.querySelector('.product-category-label');
            if (categoryEl) categoryEl.textContent = getProductField(product, 'category', newLang) || '';

            const cartBtn = card.querySelector('.btn-cart');
            if (cartBtn) cartBtn.textContent = translate('add_to_cart', newLang);

            const badge = card.querySelector('.discount-badge');
            if (badge) badge.textContent = translate('discount', newLang);
        });

        // 2.5 Kategori butonlarını güncelle (Tüm Ürünler çevirisi için)
        if (currentStoreId) {
            renderCategories(currentStoreId, currentActiveFilter);
            renderMainFilters(currentStoreId, currentActiveFilter);
        }

        // 3. Aktif arama varsa yeniden çalıştır
        const query = searchInput.value.trim();
        if (query !== '') {
            performSearch();
        }

        // 4. Modal açıksa güncelle
        const modal = document.getElementById('product-modal');
        if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
            const productId = modal.getAttribute('data-product-id');
            if (productId) {
                const product = allProducts.find(p => String(p.id) === String(productId));
                if (product) {
                    document.getElementById('modal-title').textContent = getProductField(product, 'name', newLang);
                    document.getElementById('modal-description').textContent = getProductField(product, 'desc', newLang);

                    const modalMaterial = getProductField(product, 'material', newLang);
                    const materialRow = document.getElementById('modal-material-row');
                    if (modalMaterial && modalMaterial.trim() !== '') {
                        document.getElementById('modal-material').textContent = modalMaterial;
                        if (materialRow) materialRow.style.display = 'block';
                    } else {
                        if (materialRow) materialRow.style.display = 'none';
                    }

                    const materialLabel = document.getElementById('modal-material-label');
                    if (materialLabel) materialLabel.textContent = translate('material_label', newLang);

                    const modalCartBtn = document.getElementById('modal-add-cart');
                    if (modalCartBtn) modalCartBtn.textContent = translate('add_to_cart', newLang);

                    const modalBadge = document.getElementById('modal-discount-badge');
                    if (modalBadge && modalBadge.style.display !== 'none') {
                        modalBadge.textContent = translate('discount', newLang);
                    }
                }
            }
        }

        // 5. Kategori menüsünü güncelle (dile göre kategori adları)
        renderCategoryMenu();
    });

    // --- İLK YÜKLEME ---
    // --- BAŞLATMA MANTIĞI (Güvenli Yükleme ve Önbellek) ---
    async function initApp() {
        var cachedData = getCachedData();

        // Eğer önbellek boşluk oluşturduysa temizleyip baypas edelim
        if (cachedData && (!cachedData.stores || cachedData.stores.length === 0)) {
            cachedData = null;
            SafeStorage.removeItem(CACHE_KEY);
        }

        if (cachedData && !isDirectStoreAccess) {
            allStores = cachedData.stores || [];
            allProducts = cachedData.products || [];
            window.allParentCategories = cachedData.parentCategories || [];
            window.allSubcategories = cachedData.subcategories || [];
            window.allOldCategories = cachedData.categories || [];
            window.isInitialLoadComplete = true; // ✅ Cache'den geldiyse yükleme tamdır
            console.log(`🚀 Önbellek yüklendi: ${allStores.length} mağaza bulunduruyor.`);

            renderCategoryMenu();
            checkSiteSettings();
            router();
            fetchAndCacheData().catch(e => console.warn('Arkaplan güncelleme hatası yutuldu:', e));
        } else if (isDirectStoreAccess) {
            if (cachedData) {
                allStores = cachedData.stores || [];
                allProducts = cachedData.products || [];
                window.allParentCategories = cachedData.parentCategories || [];
                window.allSubcategories = cachedData.subcategories || [];
                window.allOldCategories = cachedData.categories || [];
                window.isInitialLoadComplete = true;
                router();
                checkSiteSettings();
                fetchAndCacheData().catch(e => console.warn('Yenileme hatası:', e));
            } else {
                fetchAndCacheData(true).then(() => {
                    router();
                    fetchAndCacheData().catch(e => console.warn('Arkaplan fetch hatası:', e));
                    checkSiteSettings();
                });
            }
        } else {
            fetchAndCacheData().then(() => {
                renderCategoryMenu();
                checkSiteSettings();
                router();
            });
        }
    }

    initApp();

    // ✅ YENİ: Global Popstate Dinleyicisi (Geri tuşuyla modalları kapat)
    window.addEventListener('popstate', (event) => {
        const state = event.state;

        // Tüm olası modalları kapat
        const modals = [
            { id: 'bron-modal', key: 'bron-modal' },
            { id: 'banquet-modal', key: 'banquet-modal' },
            { id: 'product-modal', key: 'product-modal' }
        ];

        modals.forEach(m => {
            const el = document.getElementById(m.id);
            if (el && el.style.display === 'block') {
                // Eğer state modalı içermiyorsa kapat
                if (!state || state.modal !== m.key) {
                    el.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = 'auto';
                }
            }
        });
    });

    // ✅ YENİ: Service Worker Kaydı (Çevrimdışı / Offline Destek)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('✅ ServiceWorker başarıyla kayıt edildi, Offline Sistem Aktif.');
            }).catch(err => console.warn('⚠️ ServiceWorker kaydı başarısız.', err));
        });
    }
});

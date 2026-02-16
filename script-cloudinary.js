document.addEventListener('DOMContentLoaded', async () => {

    // --- DOM ELEMANLARI ---
    const storeList = document.getElementById('store-list');
    const productsGrid = document.getElementById('products-grid');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const cartButton = document.getElementById('cart-button');
    const favoritesButton = document.getElementById('favorites-button');
    const cartCount = document.querySelector('.cart-count');
    const favoritesCount = document.querySelector('.favorites-count');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Mobil menü elemanları
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const storeMenu = document.getElementById('store-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    // 404 sayfası elemanları
    const notFoundSection = document.getElementById('not-found');
    const backHomeLink = document.getElementById('back-home-link');

    // Ayrılmış filtreleme elemanları
    const categoryFiltersSection = document.getElementById('category-filters-section');
    const mainFiltersSection = document.getElementById('main-filters-section');
    const mainFilterToggleBtn = document.getElementById('main-filter-toggle-btn');
    const mainFiltersContainer = document.getElementById('main-filters-container');
    const reservationBtn = document.getElementById('rezervasyon-yap-btn'); // ✅ GÜNCELLENDİ


    // --- DURUM DEĞİŞKENLERİ (STATE) ---
    let cart = JSON.parse(localStorage.getItem('showlyCart')) || {}; // Mağaza bazlı sepet: { storeId: { storeName, items: [] } }
    let favorites = JSON.parse(localStorage.getItem('showlyFavorites')) || [];
    let currentStoreId = null;
    let allStores = [];
    let allProducts = [];

    // SMS URL açma fonksiyonu
    function openSmsUrl(url, phoneNumber, orderText) {
        try {
            console.log('📱 SMS açılıyor:', url);
            console.log('📱 Telefon:', phoneNumber);

            // Yöntem 1: window.location.href (anında)
            window.location.href = url;

            // Yöntem 2: window.open (anında)
            window.open(url, '_self');

            // Yöntem 3: window.open (_blank, yedek)
            window.open(url, '_blank');

            // Bildirim: Telefon numarasını göster
            showNotification(`✅ Sargyt kabul edildi! Telefon: ${phoneNumber}`, true);

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

    // ✅ PERFORMANS: Loading overlay'i hemen gizle
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    // ✅ PERFORMANS: Önbellek yardımcı fonksiyonları
    const CACHE_KEY = 'showly_data_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

    function getCachedData() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();

            if (now - timestamp > CACHE_DURATION) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }

            console.log('✅ Önbellekten veri yüklendi');
            return data;
        } catch (e) {
            console.warn('Önbellek okuma hatası:', e);
            return null;
        }
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Önbellek yazma hatası:', e);
        }
    }

    // ✅ PERFORMANS: URL'den mağaza slug'ını al
    const currentPath = window.location.pathname.replace('/', '');
    const isDirectStoreAccess = currentPath && currentPath !== '';

    // ✅ PERFORMANS: Önce önbellekten dene
    const cachedData = getCachedData();

    if (cachedData && !isDirectStoreAccess) {
        // Ana sayfa için önbellekten hızlı yükle
        allStores = cachedData.stores;
        allProducts = cachedData.products;
        window.allParentCategories = cachedData.parentCategories || [];
        window.allSubcategories = cachedData.subcategories || [];
        window.allOldCategories = cachedData.categories || [];

        console.log(`✅ ${allStores.length} mağaza ve ${allProducts.length} ürün yüklendi (Önbellek)`);

        // Kategori menüsünü oluştur
        await renderCategoryMenu();
        await checkSiteSettings();

        // Arka planda yeni veri çek
        fetchAndCacheData().catch(e => console.warn('Arka plan güncelleme hatası:', e));
    } else if (isDirectStoreAccess) {
        // ✅ PERFORMANS: Direkt mağaza erişimi - önce sadece mağazaları yükle
        console.log('🚀 Direkt mağaza erişimi - öncelikli yükleme başlıyor...');

        // 1. Önce sadece mağazaları yükle
        await fetchStoresOnly();

        // 2. Site ayarlarını kontrol et
        await checkSiteSettings();

        // 4. Arka planda ürünleri ve diğer verileri yükle
        fetchProductsAndCategories().catch(e => console.warn('Ürün yükleme hatası:', e));
    } else {
        // İlk yükleme veya önbellek yok
        await fetchAndCacheData();
        await renderCategoryMenu();
        await checkSiteSettings();
    }

    // ✅ Sadece mağazaları çeken fonksiyon (hızlı)
    async function fetchStoresOnly() {
        try {
            const WORKER_URL = 'https://api-worker.showlytmstore.workers.dev/';
            console.log('📦 Sadece mağazalar yükleniyor...');

            const response = await fetch(WORKER_URL, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();

            if (!data || !data.stores) throw new Error('Mağaza verisi bulunamadı');

            // Sadece mağazaları yükle
            allStores = data.stores;
            console.log(`✅ ${allStores.length} mağaza yüklendi`);

            return true;
        } catch (error) {
            console.error('Mağaza yükleme hatası:', error);
            // Firebase fallback
            try {
                const storesSnap = await window.db.collection('stores').get();
                allStores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log(`✅ ${allStores.length} mağaza yüklendi (Firebase)`);
                return true;
            } catch (fbError) {
                console.error('Firebase mağaza hatası:', fbError);
                throw fbError;
            }
        }
    }

    // ✅ Ürün ve kategorileri çeken fonksiyon (arka planda)
    async function fetchProductsAndCategories() {
        try {
            const WORKER_URL = 'https://api-worker.showlytmstore.workers.dev/';
            console.log('📦 Ürünler ve kategoriler yükleniyor...');

            const response = await fetch(WORKER_URL, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();

            // Ürün ve kategorileri yükle
            allProducts = data.products || [];
            window.allParentCategories = data.parentCategories || [];
            window.allSubcategories = data.subcategories || [];
            window.allOldCategories = data.categories || [];

            console.log(`✅ ${allProducts.length} ürün yüklendi`);

            // Önbelleğe kaydet
            setCachedData({
                stores: allStores,
                products: allProducts,
                parentCategories: window.allParentCategories,
                subcategories: window.allSubcategories,
                categories: window.allOldCategories
            });

            // Ürünler yüklendi - renderStorePage ürünleri gösterecek

            return true;
        } catch (error) {
            console.warn('Ürün yükleme hatası:', error);
            // Firebase fallback
            try {
                const [productsSnap, parentCatsSnap, subCatsSnap, catsSnap] = await Promise.all([
                    window.db.collection('products').get(),
                    window.db.collection('parentCategories').get(),
                    window.db.collection('subcategories').get(),
                    window.db.collection('categories').get()
                ]);

                allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allParentCategories = parentCatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allSubcategories = subCatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allOldCategories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                console.log(`✅ ${allProducts.length} ürün yüklendi (Firebase)`);

                // Önbelleğe kaydet
                setCachedData({
                    stores: allStores,
                    products: allProducts,
                    parentCategories: window.allParentCategories,
                    subcategories: window.allSubcategories,
                    categories: window.allOldCategories
                });

                // Ürünler yüklendi

                return true;
            } catch (fbError) {
                console.error('Firebase ürün hatası:', fbError);
                throw fbError;
            }
        }
    }

    // ✅ Veri çekme ve önbellekleme fonksiyonu
    async function fetchAndCacheData() {
        try {
            // ✅ YENİ: Cloudflare Worker API üzerinden veri çek
            const WORKER_URL = 'https://api-worker.showlytmstore.workers.dev/';
            console.log('🔄 Worker API üzerinden veriler yükleniyor:');

            const response = await fetch(WORKER_URL, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.stores) {
                throw new Error('Geçersiz veri formatı (Worker)');
            }

            allStores = data.stores;
            allProducts = data.products;
            window.allParentCategories = data.parentCategories || [];
            window.allSubcategories = data.subcategories || [];
            window.allOldCategories = data.categories || [];

            console.log(`✅ ${allStores.length} mağaza ve ${allProducts.length} ürün yüklendi (Worker)`);

            // Önbelleğe kaydet
            setCachedData({
                stores: allStores,
                products: allProducts,
                parentCategories: window.allParentCategories,
                subcategories: window.allSubcategories,
                categories: window.allOldCategories
            });

            return true;
        } catch (error) {
            console.warn('⚠️ Worker API hatası, Firebase yedeğine geçiliyor...', error);

            // Firebase fallback
            try {
                const [storesSnap, productsSnap, parentCatsSnap, subCatsSnap, catsSnap] = await Promise.all([
                    window.db.collection('stores').get(),
                    window.db.collection('products').get(),
                    window.db.collection('parentCategories').get(),
                    window.db.collection('subcategories').get(),
                    window.db.collection('categories').get()
                ]);

                allStores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allParentCategories = parentCatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allSubcategories = subCatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.allOldCategories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                console.log(`✅ ${allStores.length} mağaza ve ${allProducts.length} ürün yüklendi (Firebase)`);

                setCachedData({
                    stores: allStores,
                    products: allProducts,
                    parentCategories: window.allParentCategories,
                    subcategories: window.allSubcategories,
                    categories: window.allOldCategories
                });

                return true;
            } catch (firebaseError) {
                console.error('❌ KRİTİK HATA: Hem Worker hem Firebase başarısız!', firebaseError);
                throw firebaseError;
            }
        }
    }

    // --- YÖNLENDİRME (ROUTING) FONKSİYONU ---
    const router = async () => {
        const path = window.location.pathname.replace('/', '');
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');

        if (!path) { // Ana sayfaysak
            if (heroSection) heroSection.style.display = 'block';
            if (infoSection) infoSection.style.display = 'grid';
            if (storeBanner) storeBanner.style.display = 'none';
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
            if (mainFiltersSection) mainFiltersSection.style.display = 'none';
            if (reservationBtn) reservationBtn.style.display = 'none'; // ✅ GÜNCELLENDİ
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
    };

    // ✅ PERFORMANS: Skeleton screen fonksiyonu
    function showStoreSkeleton() {
        if (storeBanner) {
            storeBanner.style.display = 'block';
            storeBanner.innerHTML = `
                <div class="store-banner-content">
                    <div class="skeleton-banner"></div>
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

                    categoryItem.querySelector('.category-name-text').textContent = category.name;
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
                noStoreMsg.textContent = 'Henüz mağaza eklenmemiş.';
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
                        <span>${parent.name}</span>
                    </div>
                    <ul class="category-stores" id="stores-${parent.id}" style="display: none;">
                        ${parentSubcategories.map(sub => {
                    const subStores = allStores.filter(s => s.category === sub.id);
                    if (subStores.length === 0) return '';

                    return `
                                <li class="subcategory-item">
                                    <div class="subcategory-header" data-subcategory="${sub.id}">
                                        <i class="fas fa-chevron-right chevron-icon"></i>
                                        <span class="subcategory-name">${sub.name}</span>
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

    // --- KATEGORİ FİLTRELERİNİ OLUŞTURAN FONKSİYON ---
    const renderCategories = (storeId, activeFilter) => {
        const container = document.getElementById('category-buttons-container');
        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        const categories = [...new Set(storeProducts.map(p => p.category).filter(Boolean))];

        const activeCategoryName = activeFilter?.type === 'CATEGORY' ? activeFilter.value : 'Ähli harytlar';

        while (container.firstChild) container.removeChild(container.firstChild);

        // Dropdown butonu
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'category-dropdown-btn';
        dropdownBtn.innerHTML = `
            <span class="category-dropdown-text">${activeCategoryName}</span>
            <span class="category-dropdown-icon">▼</span>
        `;

        // Dropdown içerik
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'category-dropdown-content';
        dropdownContent.style.display = 'none';

        // "Tüm ürünler" seçeneği
        const allOption = document.createElement('button');
        allOption.className = 'category-dropdown-item ' + (!activeFilter ? 'active' : '');
        allOption.textContent = 'Ähli harytlar ';
        const allOptionCount = document.createElement('span');
        allOptionCount.className = 'category-count';
        allOptionCount.textContent = storeProducts.length;
        allOption.appendChild(allOptionCount);
        allOption.addEventListener('click', () => {
            renderStorePage(storeId, null);
            dropdownContent.style.display = 'none';
        });
        dropdownContent.appendChild(allOption);

        // Kategori seçenekleri
        categories.forEach(category => {
            const count = storeProducts.filter(p => p.category === category).length;
            const option = document.createElement('button');
            option.className = 'category-dropdown-item ' + (activeFilter?.type === 'CATEGORY' && activeFilter.value === category ? 'active' : '');
            option.textContent = category + ' ';
            const optionCount = document.createElement('span');
            optionCount.className = 'category-count';
            optionCount.textContent = count;
            option.appendChild(optionCount);
            option.addEventListener('click', () => {
                renderStorePage(storeId, { type: 'CATEGORY', value: category });
                dropdownContent.style.display = 'none';
            });
            dropdownContent.appendChild(option);
        });

        // Dropdown butonu tıklama
        dropdownBtn.addEventListener('click', () => {
            if (dropdownContent.style.display === 'none') {
                dropdownContent.style.display = 'block';
                dropdownBtn.querySelector('.category-dropdown-icon').style.transform = 'rotate(180deg)';
            } else {
                dropdownContent.style.display = 'none';
                dropdownBtn.querySelector('.category-dropdown-icon').style.transform = 'rotate(0deg)';
            }
        });

        // Container'a ekle
        container.appendChild(dropdownBtn);
        container.appendChild(dropdownContent);

        // Dropdown dışına tıklama
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdownContent.style.display = 'none';
                dropdownBtn.querySelector('.category-dropdown-icon').style.transform = 'rotate(0deg)';
            }
        });
    };

    // --- GENEL FİLTRELERİ OLUŞTURAN FONKSİYON ---
    const renderMainFilters = (storeId, activeFilter) => {
        const store = allStores.find(s => s.id === storeId);

        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        const discountedProducts = storeProducts.filter(p => p.isOnSale);
        const expensiveProducts = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500);

        // ✅ MEVCUT REZERVASYON BUTONUNU YÖNET
        const existingReservationBtn = document.getElementById('rezervasyon-yap-btn');
        if (existingReservationBtn) {
            if (store && store.hasReservation) {
                existingReservationBtn.style.display = 'inline-flex';
                existingReservationBtn.onclick = () => openBanquetPlanning(storeId);
            } else {
                existingReservationBtn.style.display = 'none';
            }
        }

        mainFiltersContainer.innerHTML = `
            <div class="price-filter-group">
                <div class="price-filter-group-title">Hızlı Filtreler</div>
                <div class="category-buttons-container">
                    <button class="filter-option-btn ${activeFilter?.type === 'DISCOUNT' ? 'active' : ''}" data-filter-type="DISCOUNT">
                        <i class="fas fa-percentage"></i> Arzanladyş <span class="category-count">${discountedProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'SORT_PRICE_ASC' ? 'active' : ''}" data-filter-type="SORT_PRICE_ASC">
                        <i class="fas fa-sort-amount-up"></i> Arzandan gymmada <span class="category-count">${storeProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'SORT_PRICE_DESC' ? 'active' : ''}" data-filter-type="SORT_PRICE_DESC">
                        <i class="fas fa-sort-amount-down"></i> Gymmatdan arzana <span class="category-count">${storeProducts.length}</span>
                    </button>
                </div>
            </div>
            <div class="price-filter-group">
                <div class="price-filter-group-title">Baha aralygy</div>
                <div class="price-range-inputs">
                    <input type="number" id="min-price" placeholder="Min TMT" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.min : ''}">
                    <span>-</span>
                    <input type="number" id="max-price" placeholder="Max TMT" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.max : ''}">
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


    const renderStorePage = async (storeId, activeFilter = null) => {
        currentStoreId = storeId;
        const store = allStores.find(s => s.id === storeId);
        const storeProducts = allProducts.filter(p => p.storeId === storeId);

        // ✅ Ürün grid'ini temizle ve göster
        if (productsGrid) {
            productsGrid.innerHTML = '';
            productsGrid.style.display = 'grid';
        }

        const storeBanner = document.getElementById('store-banner');
        if (storeBanner) {
            storeBanner.style.display = 'block';
            // Banner içeriğini anında temizle veya yeni mağaza ile güncelle (State reset)
            storeBanner.innerHTML = '<div class="banner-skeleton"></div>';
        }

        // ✅ Ziyaret sayısını artır ve getir (AWAIT KALDIRILDI - Performans için)
        let storeViews = store.views || 0;
        try {
            // Firestore'da sayaçı artır (Arka planda çalışır, UI'ı bloklamaz)
            const storeRef = window.db.collection('stores').doc(storeId);
            storeRef.update({
                views: firebase.firestore.FieldValue.increment(1)
            }).catch(e => console.warn('Sayaç DB hatası:', e));

            // Yerel olarak bir artır (hızlı gösterim için)
            storeViews += 1;
            // Global state'teki veriyi güncelle
            const storeIdx = allStores.findIndex(s => s.id === storeId);
            if (storeIdx !== -1) allStores[storeIdx].views = storeViews;
        } catch (vErr) {
            console.warn('Sayaç hazırlık hatası:', vErr);
        }

        // Mağaza banner içeriğini oluştur
        if (storeBanner) {
            storeBanner.innerHTML = `
                <div class="store-banner-content" style="position: relative;">
                    <div class="store-views-badge">
                        <i class="fas fa-eye"></i> <span>${storeViews}</span>
                    </div>
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
        if (store.tiktok) {
            const link = document.createElement('a');
            link.href = store.tiktok;
            link.target = '_blank';
            link.className = 'social-button tiktok-button';
            link.innerHTML = '<i class="fab fa-tiktok"></i>';
            socialGrid.appendChild(link);
        }
        if (store.instagram) {
            const link = document.createElement('a');
            link.href = store.instagram;
            link.target = '_blank';
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
            link.target = '_blank';
            link.className = 'social-button location-button';
            link.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
            socialGrid.appendChild(link);
        }

        // ✅ BURAYI EKLEYİN - Kategori ve filtreleri göster (Eğer ayar gizli değilse)
        if (!window.isCategoriesHidden) {
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'block';
            if (mainFiltersSection) mainFiltersSection.style.display = 'block';

            // ✅ BURAYI EKLEYİN - Fonksiyonları çağır
            renderCategories(storeId, activeFilter);
            renderMainFilters(storeId, activeFilter);
        } else {
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
            if (mainFiltersSection) mainFiltersSection.style.display = 'none';
        }

        let productsToRender = storeProducts;
        if (activeFilter) {
            switch (activeFilter.type) {
                case 'CATEGORY':
                    productsToRender = storeProducts.filter(p => p.category === activeFilter.value);
                    break;
                case 'DISCOUNT':
                    productsToRender = storeProducts.filter(p => p.isOnSale);
                    break;
                case 'EXPENSIVE':
                    productsToRender = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500);
                    break;
                case 'SORT_PRICE_ASC':
                    productsToRender = [...storeProducts];
                    break;
                case 'PRICE_RANGE':
                    const min = activeFilter.min || 0;
                    const max = activeFilter.max || Infinity;
                    productsToRender = storeProducts.filter(p => {
                        const price = parseFloat(p.price.replace(' TMT', ''));
                        return price >= min && price <= max;
                    });
                    break;
            }
        }

        if (productsToRender.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = '<i class="fas fa-box-open"></i><h3></h3>';
            noResults.querySelector('h3').textContent = 'Bu filtrde haryt tapylmady.';
            productsGrid.appendChild(noResults);
            return;
        }

        // ✅ Sıralama kodu
        if (activeFilter?.type === 'SORT_PRICE_ASC') {
            // Ucuzdan pahalıya sırala
            productsToRender.sort((a, b) => {
                const priceA = parseFloat(a.price.replace(' TMT', '')) || 0;
                const priceB = parseFloat(b.price.replace(' TMT', '')) || 0;
                return priceA - priceB;
            });
            console.log('✅ Ürünler ucuzdan pahalıya sıralandı');
        } else if (activeFilter?.type === 'SORT_PRICE_DESC') {
            // Pahalıdan ucuza sırala
            productsToRender.sort((a, b) => {
                const priceA = parseFloat(a.price.replace(' TMT', '')) || 0;
                const priceB = parseFloat(b.price.replace(' TMT', '')) || 0;
                return priceB - priceA; // Ters sıralama
            });
            console.log('✅ Ürünler pahalıdan ucuza sıralandı');
        } else {
            // Varsayılan sıralama (resimli ve fiyatlı ürünler önce)
            productsToRender.sort((a, b) => {
                const aHasImage = a.imageUrl && a.imageUrl.trim() !== '';
                const bHasImage = b.imageUrl && b.imageUrl.trim() !== '';

                const aHasPrice = a.price && parseFloat(a.price.replace(' TMT', '')) > 0;
                const bHasPrice = b.price && parseFloat(b.price.replace(' TMT', '')) > 0;

                const aScore = (aHasImage ? 2 : 0) + (aHasPrice ? 1 : 0);
                const bScore = (bHasImage ? 2 : 0) + (bHasPrice ? 1 : 0);

                return bScore - aScore;
            });
            console.log('✅ Ürünler öncelik sırasına göre sıralandı');
        }

        // Ürün kartlarını oluştur
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';

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

            productCard.innerHTML = `
                <div class="product-image-container">
                    <div class="img-skeleton"></div>
                    ${product.isOnSale ? '<span class="discount-badge">Arzanladyş</span>' : ''}
                    <img src="${getOptimizedImageUrl(product.imageUrl)}" 
                         class="product-img"
                         loading="lazy"
                         onload="this.classList.add('loaded'); this.parentElement.querySelector('.img-skeleton').style.display='none';"
                         onerror="this.src='https://res.cloudinary.com/domv6ullp/image/upload/v1765464522/no-image_placeholder.png'; this.classList.add('loaded', 'error'); this.parentElement.querySelector('.img-skeleton').style.display='none';">
                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title"></h3>
                    <span class="product-category-label"></span>
                    <div class="price-display-wrapper"></div>
                    <div class="product-actions"><button class="btn-cart" data-id="${product.id}">Sebede goş</button></div>
                </div>
            `;
            productCard.querySelector('.product-img').alt = product.title;
            productCard.querySelector('.product-title').textContent = product.title;
            productCard.querySelector('.product-category-label').textContent = product.category || '';

            const wrapper = productCard.querySelector('.price-display-wrapper');
            if (priceDisplayElement) {
                wrapper.appendChild(priceDisplayElement);
            } else {
                const priceSpan = document.createElement('span');
                priceSpan.className = 'product-price';
                priceSpan.textContent = product.price;
                wrapper.appendChild(priceSpan);
            }
            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };

    // ✅ YENİ: Site Ayarlarını Kontrol Et (Kategori Gizleme)
    async function checkSiteSettings() {
        try {
            const doc = await window.db.collection('settings').doc('general').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.hideCategories) {
                    console.log('🙈 Ayar aktif: Kategoriler ve Menü gizleniyor...');
                    window.isCategoriesHidden = true; // ✅ Global flag ayarla

                    const categoryMenu = document.getElementById('store-menu'); // Sol menü container
                    const categoryFilters = document.getElementById('category-filters-section'); // Üst filtreler
                    const menuToggleBtn = document.getElementById('menu-toggle'); // Menü açma butonu

                    if (categoryMenu) categoryMenu.style.display = 'none';
                    if (categoryFilters) categoryFilters.style.display = 'none';
                    if (menuToggleBtn) menuToggleBtn.style.display = 'none'; // Butonu da gizle
                } else {
                    console.log('👁️ Kategoriler görünür durumda.');
                    window.isCategoriesHidden = false; // ✅ Flag'i sıfırla
                }
            } else {
                window.isCategoriesHidden = false; // ✅ Ayar yoksa varsayılan: görünür
            }
        } catch (error) {
            console.error('Ayarlar okunamadı:', error);
            window.isCategoriesHidden = false; // ✅ Hata durumunda varsayılan: görünür
        }
    }

    // --- ARAMA FONKSİYONU ---
    const performSearch = () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query === '') {
            showNotification('Gözleýän harydyňyzyň adyny ýazyň!');
            return;
        }

        let productsToSearch = currentStoreId
            ? allProducts.filter(p => p.storeId === currentStoreId)
            : allProducts;

        const filteredProducts = productsToSearch.filter(product =>
            product.title.toLowerCase().includes(query) ||
            (product.description && product.description.toLowerCase().includes(query))
        );

        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');

        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
        if (mainFiltersSection) mainFiltersSection.style.display = 'none';

        storeBanner.style.display = 'block';
        while (storeBanner.firstChild) storeBanner.removeChild(storeBanner.firstChild);
        const searchTitle = document.createElement('h2');
        searchTitle.textContent = `Gözleg: "${query}"`;
        const searchSub = document.createElement('p');
        searchSub.textContent = `${filteredProducts.length} harydy`;
        storeBanner.appendChild(searchTitle);
        storeBanner.appendChild(searchSub);

        productsGrid.style.display = 'grid';
        while (productsGrid.firstChild) productsGrid.removeChild(productsGrid.firstChild);

        if (filteredProducts.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = '<i class="fas fa-search"></i><h3></h3>';
            noResults.querySelector('h3').textContent = 'Haryt tapylmady';
            productsGrid.appendChild(noResults);
            return;
        }

        filteredProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${getOptimizedImageUrl(product.imageUrl)}" 
                         class="product-img"
                         loading="lazy">
                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title"></h3>
                    <span class="product-category-label"></span>
                    <p class="product-price"></p>
                    <div class="product-actions"><button class="btn-cart" data-id="${product.id}">Sebede goş</button></div>
                </div>
            `;
            productCard.querySelector('.product-img').alt = product.title;
            productCard.querySelector('.product-title').textContent = product.title;
            productCard.querySelector('.product-category-label').textContent = product.category || '';
            productCard.querySelector('.product-price').textContent = product.price;
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
        localStorage.setItem('showlyFavorites', JSON.stringify(favorites));
    };

    // --- SEPET VE FAVORİ FONKSİYONLARI ---
    const toggleFavorite = (product) => {
        const index = favorites.findIndex(item => item.id === product.id);
        if (index !== -1) {
            favorites.splice(index, 1);
            showNotification('Halanlarymdan aýryldy');
        } else {
            favorites.push(product);
            showNotification('Halanlaryma goşuldy');
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
        localStorage.setItem('showlyCart', JSON.stringify(cart));
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
        showNotification(product.title + ' sebede goşuldy!');
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

        const cartBtn = e.target.closest('.btn-cart');
        if (cartBtn) {
            e.preventDefault(); // Prevent click event
            e.stopPropagation(); // Stop bubbling
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                const product = allProducts.find(p => p.id === cartBtn.getAttribute('data-id'));
                if (product) addToCart(product);
            }
            return;
        }

        const btn = e.target.closest('.btn-favorite');
        if (btn) {
            e.preventDefault(); // Prevent click event
            e.stopPropagation(); // Stop bubbling
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                const product = allProducts.find(p => p.id === btn.getAttribute('data-id'));
                if (product) toggleFavorite(product);
            }
            return;
        }

        const card = e.target.closest('.product-card');
        if (card) {
            e.preventDefault(); // Prevent click event
            if (!touchClickExecuted) {
                touchClickExecuted = true;
                const productId = card.querySelector('.btn-cart').getAttribute('data-id');
                openProductModal(productId);
            }
        }
    });

    // Normal click event (desktop için)
    productsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-favorite');
        if (btn) {
            const product = allProducts.find(p => p.id === btn.getAttribute('data-id'));
            if (product) toggleFavorite(product);
            return;
        }

        const cartBtn = e.target.closest('.btn-cart');
        if (cartBtn) {
            const product = allProducts.find(p => p.id === cartBtn.getAttribute('data-id'));
            if (product) addToCart(product);
            return;
        }

        const card = e.target.closest('.product-card');
        if (card) {
            const productId = card.querySelector('.btn-cart').getAttribute('data-id');
            openProductModal(productId);
        }
    });

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
                modal.style.display = 'none';
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
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            document.body.classList.remove('modal-open');
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
            emptyMsg.textContent = 'Siz öz sargyt etjek harytlaryňyzy şu sebede goşup bilersiňiz.';
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
                            <button class="quantity-btn" data-store-id="${currentStoreCart.storeId}" data-id="${item.id}" data-action="decrease">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" data-store-id="${currentStoreCart.storeId}" data-id="${item.id}" data-action="increase">+</button>
                        </div>
                        <i class="fas fa-trash cart-item-remove" data-store-id="${currentStoreCart.storeId}" data-id="${item.id}"></i>
                    </div>
                `;
            }).join('');

            storeSection.innerHTML = `
                <div class="cart-store-header">
                    <h4>${currentStoreCart.storeName}</h4>
                    <span class="cart-store-total">Umumy: ${storeTotal.toFixed(2)} TMT</span>
                </div>
                ${itemsHTML}
            `;
            cartItems.appendChild(storeSection);

            document.getElementById('cart-total-price').textContent = storeTotal.toFixed(2) + ' TMT';
        }
        cartModal.style.display = 'block';
        document.body.classList.add('modal-open');
    });

    // TikTok/Instagram in-app browser için cart touch scroll tespiti
    let cartTouchStartX = 0;
    let cartTouchStartY = 0;
    let cartIsScrolling = false;

    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.quantity-btn') || e.target.closest('.cart-item-remove');
        if (target) {
            cartTouchStartX = e.touches[0].clientX;
            cartTouchStartY = e.touches[0].clientY;
            cartIsScrolling = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        const target = e.target.closest('.quantity-btn') || e.target.closest('.cart-item-remove');
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

    document.addEventListener('touchend', (e) => {
        if (cartIsScrolling) {
            return; // Scroll yapılıyorsa, click event'i tetikleme
        }

        const quantityBtn = e.target.closest('.quantity-btn');
        if (quantityBtn) {
            e.preventDefault(); // ✅ Hayalet tıklamayı (ghost click) engelle
            const storeId = quantityBtn.getAttribute('data-store-id');
            const productId = quantityBtn.getAttribute('data-id');
            const action = quantityBtn.getAttribute('data-action');
            if (cart[storeId]) {
                const item = cart[storeId].items.find(i => i.id === productId);
                if (item) {
                    if (action === 'increase') item.quantity++;
                    else if (action === 'decrease' && item.quantity > 1) item.quantity--;
                    saveCart(); // ✅ Güncelle ve kaydet
                    cartButton.click();
                }
            }
            return;
        }

        const removeBtn = e.target.closest('.cart-item-remove');
        if (removeBtn) {
            e.preventDefault(); // ✅ Hayalet tıklamayı engelle
            const storeId = removeBtn.getAttribute('data-store-id');
            const productId = removeBtn.getAttribute('data-id');
            if (cart[storeId]) {
                cart[storeId].items = cart[storeId].items.filter(i => i.id !== productId);
                if (cart[storeId].items.length === 0) {
                    delete cart[storeId];
                }
                saveCart(); // ✅ Güncelle ve kaydet
                cartButton.click();
            }
            return;
        }
    });

    // Normal click event (desktop için)
    document.addEventListener('click', (e) => {
        const quantityBtn = e.target.closest('.quantity-btn');
        if (quantityBtn) {
            const storeId = quantityBtn.getAttribute('data-store-id');
            const productId = quantityBtn.getAttribute('data-id');
            const action = quantityBtn.getAttribute('data-action');
            if (cart[storeId]) {
                const item = cart[storeId].items.find(i => i.id === productId);
                if (item) {
                    if (action === 'increase') item.quantity++;
                    else if (action === 'decrease' && item.quantity > 1) item.quantity--;
                    saveCart(); // ✅ Güncelle ve kaydet
                    cartButton.click();
                }
            }
            return;
        }

        const removeBtn = e.target.closest('.cart-item-remove');
        if (removeBtn) {
            const storeId = removeBtn.getAttribute('data-store-id');
            const productId = removeBtn.getAttribute('data-id');
            if (cart[storeId]) {
                cart[storeId].items = cart[storeId].items.filter(i => i.id !== productId);
                if (cart[storeId].items.length === 0) {
                    delete cart[storeId];
                }
                saveCart(); // ✅ Güncelle ve kaydet
                cartButton.click();
            }
            return;
        }
    });

    // --- SİPARİŞ TAMAMLAMA FONKSİYONU ---
    document.querySelector('.checkout-button').addEventListener('click', () => {
        const currentStoreCart = currentStoreId ? cart[currentStoreId] : null;

        if (!currentStoreCart || currentStoreCart.items.length === 0) {
            showNotification('Sebediňiz boş!', false);
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
                            <label>Bellik (Opsiýonel)</label>
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
                showNotification('Ähli meýdançalary dolduryň!', false);
                return;
            }

            // Telefon doğrulaması (+993 6XXXXXXX formatında 8 rakam)
            const phoneRegex = /^\+993\s\d{8}$/;
            if (!phoneRegex.test(phone)) {
                showNotification('Telefon nomeriňizi dogry giriziň (+993 6XXXXXXX)!', false);
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const cancelBtn = e.target.querySelector('.btn-secondary');
            submitBtn.disabled = true;
            cancelBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iberilýär...';

            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingText = document.querySelector('.loading-text');
            loadingOverlay.style.display = 'flex';
            loadingText.textContent = 'Sargydyňyz işlenýär...';

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


                loadingOverlay.style.display = 'none';
                showNotification(`✅ ${currentStoreCart.storeName} üçin sargydyňyz kabul edildi!`, true);

                // Bu mağazayı sepetten sil
                delete cart[currentStoreCart.storeId];
                updateCartCount();
                document.querySelector(`.order-form-overlay[data-store-id="${currentStoreCart.storeId}"]`).remove();

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
                loadingOverlay.style.display = 'none';

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
            emptyMsg.textContent = 'Siz harytlardan öz halanyňyzy saýlap bilersiňiz.';
            favoritesItems.appendChild(emptyMsg);
        } else {
            favorites.forEach(product => {
                const favItem = document.createElement('div');
                favItem.className = 'favorite-item';
                favItem.innerHTML = `
                    <div class="fav-img-container"></div>
                    <div class="favorite-item-info">
                        <div class="favorite-item-title">${product.title}</div>
                        <div class="favorite-item-price">${product.price}</div>
                        <div class="favorite-item-actions">
                            <button class="btn-remove-favorite" data-id="${product.id}">Aýyr</button>
                            <button class="btn-add-cart-from-fav" data-id="${product.id}">Sebede goş</button>
                        </div>
                    </div>
                `;

                const img = document.createElement('img');
                img.src = product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E%3C/text%3E%3C/svg%3E';
                img.alt = product.title || 'Product';
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
    window.addEventListener('popstate', router);

    // --- YARDIMCI FONKSİYONLAR ---
    function getOptimizedImageUrl(url, width = 400) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();

        // HTTP'yi HTTPS'e zorla (Mixed Content hatasını önlemek için)
        if (url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }

        // Eğer Cloudinary URL'si ise optimizasyon yap
        if (url.includes('cloudinary.com')) {
            if (url.includes('/upload/')) {
                const parts = url.split('/upload/');
                if (parts[1].includes('w_') || parts[1].includes('q_auto')) {
                    return url;
                }
                return `${parts[0]}/upload/f_auto,q_auto,w_${width}/${parts[1]}`;
            }
        }

        // Cloudflare R2 veya diğer URL'leri olduğu gibi döndür
        return url;
    }

    function openProductModal(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        const modal = document.getElementById('product-modal');
        modal.setAttribute('data-product-id', productId);

        const modalImage = document.getElementById('modal-image');
        const modalSkeleton = document.getElementById('modal-img-skeleton');

        // ✅ Resmi ve skeleton'u sıfırla
        if (modalImage) {
            modalImage.classList.remove('loaded');
            if (modalSkeleton) modalSkeleton.style.display = 'block';

            modalImage.onload = () => {
                modalImage.classList.add('loaded');
                if (modalSkeleton) modalSkeleton.style.display = 'none';
            };
            modalImage.onerror = () => {
                modalImage.src = 'https://res.cloudinary.com/domv6ullp/image/upload/v1765464522/no-image_placeholder.png';
                modalImage.classList.add('loaded');
                if (modalSkeleton) modalSkeleton.style.display = 'none';
            };
            modalImage.src = getOptimizedImageUrl(product.imageUrl, 800);
        }

        document.getElementById('modal-title').textContent = product.title;

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

        document.getElementById('modal-description').textContent = product.description || '';
        // Material kontrolu - bossa sat?r? gizle
        const materialRow = document.getElementById('modal-material-row');
        if (product.material && product.material.trim() !== '') {
            document.getElementById('modal-material').textContent = product.material;
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
            document.body.style.overflow = 'hidden';

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

        packagesList.innerHTML = '<p class="loading-packages">Paketler ýüklenýär...</p>';

        try {
            const snapshot = await window.db.collection('reservationPackages')
                .where('storeId', '==', storeId)
                .get();

            currentStorePackages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (currentStorePackages.length === 0) {
                packagesList.innerHTML = '<p class="no-packages" style="padding: 20px; color: #888;">Bu restoran üçin heniz paket goşulmady.</p>';
                return;
            }

            renderBanquetPackages();
        } catch (error) {
            console.error('❌ Paketler ýüklenip bilmedi:', error);
            packagesList.innerHTML = '<p class="error-packages">Paketler ýüklenip bilmedi.</p>';
        }
    }

    // Paketleri arayüze basma
    function renderBanquetPackages() {
        if (!packagesList) return;

        // Her bir menü maddesini ayrı bir paket kartı gibi işle
        let allDisplayPackages = [];
        currentStorePackages.forEach((pkg) => {
            if (pkg.menuItems && pkg.menuItems.length > 0) {
                pkg.menuItems.forEach((item, itemIndex) => {
                    allDisplayPackages.push({
                        displayId: `${pkg.id}_${itemIndex}`,
                        displayName: item.name,
                        displayPrice: item.price,
                        menuHtml: `
                            <li style="margin-bottom: 6px; font-size: 14px; color: #333; display: flex; align-items: flex-start; gap: 8px;">
                                <i class="fas fa-check" style="color: var(--primary-color); font-size: 12px; margin-top: 4px;"></i>
                                <span style="font-weight: 500;">${item.name}</span>
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

        packagesList.innerHTML = allDisplayPackages.map((dpkg, index) => {
            return `
                <label class="package-item-card" style="width: 100%; min-width: 280px; margin-bottom: 15px; display: block; cursor: pointer;">
                    <input type="radio" name="banquet-package" value="${dpkg.displayId}" ${index === 0 ? 'checked' : ''} data-price="${dpkg.displayPrice}">
                    <div class="package-card-content" style="padding: 22px; border-radius: 20px; border: 2px solid #eee; transition: 0.3s; background: #fff; position: relative;">
                        <div class="package-badge" style="background: #1a1a1a; color: #fff; padding: 5px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 8px;">
                           <i class="fas fa-utensils"></i> ${dpkg.displayName}
                        </div>
                        
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
            `;
        }).join('');

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
                guestOptionsList.innerHTML = '<p style="grid-column: 1/-1; color: #888; font-size: 13px; padding: 10px;">Kapasite maglumaty ýok.</p>';
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
        if (banquetModal) {
            banquetModal.style.display = 'none';
            document.body.style.overflow = 'auto';
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
            showNotification('Lütfen Ähli meýdançalary dolduryň!', false);
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
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderilýär...';

            await window.db.collection('orders').add(reservationData);

            showNotification('✅ Sargyt kabul edildi! Siziň bilen basym habarlaşarys.', true);
            banquetModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            banquetForm.reset();
        } catch (error) {
            console.error('❌ Rezervasyon hatası:', error);
            showNotification('Sargyt ýerleşdirilmedi. Lütfen gaýtadan synanyşyň.', false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // --- İLK YÜKLEME ---
    router();
});

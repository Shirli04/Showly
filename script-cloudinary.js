document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ELEMANLARI ---
    const storeList = document.getElementById('store-list');
    const productsGrid = document.getElementById('products-grid');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const cartButton = document.getElementById('cart-button');
    const favoritesButton = document.getElementById('favorites-button');
    const cartCount = document.querySelector('.cart-count');
    const favoritesCount = document.querySelector('.favorites-count');
    
    // Mobil menü elemanları
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const storeMenu = document.getElementById('store-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    // 404 sayfası elemanları
    const notFoundSection = document.getElementById('not-found');
    const backHomeLink = document.getElementById('back-home-link');

    // YENİ Filtreleme elemanları
    const storeListContainer = document.getElementById('store-list-container');
    const filterPanelContainer = document.getElementById('filter-panel-container');
    const filterPanelStoreName = document.getElementById('filter-panel-store-name');
    const categoryFilterList = document.getElementById('category-filter-list');
    const filterOnSale = document.getElementById('filter-on-sale');
    const filterMinPrice = document.getElementById('filter-min-price');
    const filterMaxPrice = document.getElementById('filter-max-price');
    const backToStoresLink = document.querySelector('.back-to-stores-link');
    
    // --- DURUM DEĞİŞKENLERİ (STATE) ---
    let cart = [];
    let favorites = [];
    let currentStoreId = null;
    let currentStoreProducts = [];
    let currentFilters = {
        category: null,
        isOnSale: false,
        minPrice: null,
        maxPrice: null,
    };
    
    // --- YÖNLENDİRME (ROUTING) FONKSİYONU ---
    const router = () => {
        const path = window.location.pathname.replace('/', '');
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');
        const productsGrid = document.getElementById('products-grid');
        
        if (!path) { // Ana sayfadaysak
            if (heroSection) heroSection.style.display = 'block';
            if (infoSection) infoSection.style.display = 'grid';
            if (storeBanner) storeBanner.style.display = 'none';
            if (productsGrid) productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'none';
            if (filterPanelContainer) filterPanelContainer.style.display = 'none';
            if (storeListContainer) storeListContainer.style.display = 'block';
            document.title = 'Showly - Online Katalog Platformasy';
            renderStores();
            return;
        }

        // Ana sayfa elemanlarını gizle
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (notFoundSection) notFoundSection.style.display = 'none';
        if (storeListContainer) storeListContainer.style.display = 'none';

        const store = window.showlyDB.getStores().find(s => s.slug === path);

        if (store) {
            setupStorePage(store.id);
            document.title = `${store.name} - Showly`;
        } else {
            if (storeBanner) storeBanner.style.display = 'none';
            if (productsGrid) productsGrid.style.display = 'none';
            if (filterPanelContainer) filterPanelContainer.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'block';
            document.title = 'Sayfa Bulunamadı - Showly';
        }
    };
    
    // --- MAĞAZA LİSTELEME FONKSİYONU ---
    const renderStores = () => {
        const stores = window.showlyDB.getStores();
        storeList.innerHTML = '';
        
        if (!stores || stores.length === 0) {
            storeList.innerHTML = `<li class="no-stores"><div style="padding: 20px; text-align: center; color: #666;"><i class="fas fa-store" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>Henüz mağaza bulunmuyor</div></li>`;
            return;
        }
        
        stores.forEach(store => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="/${store.slug}" class="store-link" data-store-id="${store.id}"><i class="fas fa-store"></i> ${store.name}</a>`;
            storeList.appendChild(li);
        });
    };

    // --- YENİ: MAĞAZA SAYFASINI KURAN FONKSİYON ---
    const setupStorePage = (storeId) => {
        currentStoreId = storeId;
        const store = window.showlyDB.getStores().find(s => s.id === storeId);
        currentStoreProducts = window.showlyDB.getProductsByStoreId(storeId);
        
        // Filtreleri sıfırla
        currentFilters = { category: null, isOnSale: false, minPrice: null, maxPrice: null };

        // Store banner'ı göster
        const storeBanner = document.getElementById('store-banner');
        storeBanner.style.display = 'block';
        storeBanner.innerHTML = `<h2>${store.name}</h2><p>${currentStoreProducts.length} ürün</p>`;

        // Filtre panelini oluştur
        renderFilterPanel();

        // İlk ürünleri göster
        renderProducts();
    };

    // --- YENİ: FİLTRE PANELİNİ OLUŞTURAN FONKSİYON ---
    const renderFilterPanel = () => {
        const store = window.showlyDB.getStores().find(s => s.id === currentStoreId);
        filterPanelStoreName.textContent = store.name;

        // Kategorileri oluştur
        const categories = [...new Set(currentStoreProducts.map(p => p.category).filter(Boolean))];
        categoryFilterList.innerHTML = `
            <li>
                <label>
                    <input type="radio" name="category-filter" value="all" checked>
                    <span>Ähli kategoriyalar</span>
                    <span class="category-count">${currentStoreProducts.length}</span>
                </label>
            </li>
        `;
        categories.forEach(category => {
            const count = currentStoreProducts.filter(p => p.category === category).length;
            const li = document.createElement('li');
            li.innerHTML = `
                <label>
                    <input type="radio" name="category-filter" value="${category}">
                    <span>${category}</span>
                    <span class="category-count">${count}</span>
                </label>
            `;
            categoryFilterList.appendChild(li);
        });

        // Filtre panelini göster
        filterPanelContainer.style.display = 'flex';
    };

    // --- YENİ: ÜRÜNLERİ FİLTRELEYİP GÖSTEREN FONKSİYON ---
    const renderProducts = () => {
        let productsToRender = [...currentStoreProducts];

        // Kategoriye göre filtrele
        const selectedCategory = document.querySelector('input[name="category-filter"]:checked').value;
        if (selectedCategory !== 'all') {
            productsToRender = productsToRender.filter(p => p.category === selectedCategory);
        }

        // İndirime göre filtrele
        if (currentFilters.isOnSale) {
            productsToRender = productsToRender.filter(p => p.isOnSale);
        }

        // Fiyat aralığına göre filtrele
        const minPrice = parseFloat(currentFilters.minPrice) || 0;
        const maxPrice = parseFloat(currentFilters.maxPrice) || Infinity;
        productsToRender = productsToRender.filter(p => {
            const price = parseFloat(p.price.replace(' TMT', ''));
            return price >= minPrice && price <= maxPrice;
        });

        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';
        
        if (productsToRender.length === 0) {
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-box-open"></i><h3>Bu filtrede ürün bulunamadı.</h3></div>`;
            return;
        }
        
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            let priceDisplay = `<p class="product-price">${product.price}</p>`;
            if (product.isOnSale && product.originalPrice) {
                priceDisplay = `<div class="price-container"><span class="original-price">${product.originalPrice}</span><span class="current-price">${product.price}</span></div>`;
            }
            productCard.innerHTML = `
                <div class="product-image-container">
                    ${product.isOnSale ? '<span class="discount-badge">İndirim</span>' : ''}
                    <img src="${product.imageUrl || 'https://picsum.photos/300/400?random=' + product.id}" alt="${product.title}">
                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    ${priceDisplay}
                    <div class="product-actions"><button class="btn-cart" data-id="${product.id}">Sebede goş</button></div>
                </div>
            `;
            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };

    // --- ARAMA FONKSİYONU (Değişiklik Yok) ---
    const performSearch = () => { /* ... önceki kodla aynı ... */ };
    
    // --- SEPET VE FAVORİ FONKSİYONLARI (Değişiklik Yok) ---
    const toggleFavorite = (product) => { /* ... önceki kodla aynı ... */ };
    const updateFavoriteButton = (productId) => { /* ... önceki kodla aynı ... */ };
    const updateFavoritesCount = () => { /* ... önceki kodla aynı ... */ };
    const addToCart = (product) => { /* ... önceki kodla aynı ... */ };
    const updateCartCount = () => { /* ... önceki kodla aynı ... */ };

    // --- OLAY DİNLEYİCİLER (EVENT LISTENERS) ---
    
    // Mobil menü (Değişiklik Yok)
    menuToggle.addEventListener('click', () => { /* ... önceki kodla aynı ... */ });
    menuClose.addEventListener('click', () => { /* ... önceki kodla aynı ... */ });
    menuOverlay.addEventListener('click', () => { /* ... önceki kodla aynı ... */ });

    // Arama (Değişiklik Yok)
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

    // YENİ: Filtre paneli olay dinleyicileri
    filterPanelContainer.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            currentFilters.category = e.target.value === 'all' ? null : e.target.value;
        } else if (e.target.type === 'checkbox') {
            currentFilters.isOnSale = e.target.checked;
        }
        renderProducts();
    });

    filterPanelContainer.addEventListener('input', (e) => {
        if (e.target.id === 'filter-min-price') currentFilters.minPrice = e.target.value;
        if (e.target.id === 'filter-max-price') currentFilters.maxPrice = e.target.value;
        renderProducts();
    });
    
    backToStoresLink.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, '/');
        router();
    });

    // Ürün gridi olayları (Değişiklik Yok)
    productsGrid.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });

    // Modal kontrolleri (Değişiklik Yok)
    document.getElementById('modal-add-cart').addEventListener('click', () => { /* ... önceki kodla aynı ... */ });
    document.querySelectorAll('.close-modal').forEach(btn => { /* ... önceki kodla aynı ... */ });
    window.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });

    // Sepet modalı (Değişiklik Yok)
    cartButton.addEventListener('click', () => { /* ... önceki kodla aynı ... */ });
    document.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });

    // Favoriler modalı (Değişiklik Yok)
    favoritesButton.addEventListener('click', () => { /* ... önceki kodla aynı ... */ });
    document.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });

    // Logo ve mağaza linkleri (Değişiklik Yok)
    document.getElementById('logo-link').addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });
    document.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });
    backHomeLink?.addEventListener('click', (e) => { /* ... önceki kodla aynı ... */ });

    // Tarayıcının geri/ileri butonları (Değişiklik Yok)
    window.addEventListener('popstate', router);

    // --- YARDIMCI FONKSİYONLAR (Değişiklik Yok) ---
    const openProductModal = (productId) => { /* ... önceki kodla aynı ... */ };
    const showNotification = (message) => { /* ... önceki kodla aynı ... */ };

    // --- İLK YÜKLEME ---
    router(); // Sayfa ilk yüklendiğinde yönlendirmeyi çalıştır
});
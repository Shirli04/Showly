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
    
    
    // --- DURUM DEĞİŞKENLERİ (STATE) ---
    let cart = JSON.parse(localStorage.getItem('showlyCart')) || {}; // Mağaza bazlı sepet: { storeId: { storeName, items: [] } }
    let favorites = [];
    let currentStoreId = null;
    let allStores = [];
    let allProducts = [];
    
    // Firebase kontrolü
    if (!window.db) {
        console.error('❌ Firebase veritabanı bulunamadı!');
        showNotification('Firebase yüklenemedi! Lütfen sayfayı yenileyin.', false);
        return;
    }
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    console.log('🔄 Firebase\'den veriler yükleniyor...');

    try {
        // ✅ YENİ: 45 saniye timeout ekle
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase bağlantısı zaman aşımına uğradı')), 45000);
        });

        // ✅ PARALEL İŞLEMLER: Mağaza ve ürünleri aynı anda çek
        const fetchDataPromise = (async () => {
            // Mağaza ve ürünleri paralel çek (Promise.all ile)
            const [storesSnapshot, productsSnapshot] = await Promise.all([
                window.db.collection('stores').get(),
                window.db.collection('products').get()
            ]);
            
            const stores = storesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const products = productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return { stores, products };
        })();

        // ✅ Timeout ile yarış: Hangisi önce biterse onu al
        const { stores, products } = await Promise.race([fetchDataPromise, timeoutPromise]);

        allStores = stores;
        allProducts = products;

        console.log(`✅ ${allStores.length} mağaza ve ${allProducts.length} ürün yüklendi`);

        console.log('📂 Kategori menüsü oluşturuluyor...');
        // ✅ Kategorili menüyü oluştur
        await renderCategoryMenu();
    console.log('✅ Kategori menüsü tamamlandı');
    
    console.log('🔄 Loading kapatılıyor...');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        console.log('✅ Loading kapatıldı');
    } else {
        console.warn('⚠️ loadingOverlay elementi bulunamadı!');
    }

    } catch (error) {
        console.error('❌ Firebase hatası:', error);
        
        // ✅ Loading'i gizle
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        // ✅ YENİ: Hata mesajını 404 sayfasında göster
        const notFoundSection = document.getElementById('not-found');
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const errorTitle = document.getElementById('error-title');
        const errorMessage = document.getElementById('error-message');
        
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        
        errorTitle.textContent = 'Baglanyşyk Ýok';
        errorMessage.textContent = 'Firebase bilen baglanyşyk guralyp bilinmedi. Sahypany täzeleň.';
        notFoundSection.style.display = 'block';
        
        showNotification('Veriler yüklenemedi! Lütfen sayfayı yenileyin.', false);
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
            if (productsGrid) productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'none';
            document.title = 'Showly - Online Katalog Platformasy';
            return;
        }

        // Ana sayfa elemanlarını gizle
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (notFoundSection) notFoundSection.style.display = 'none';

        const store = allStores.find(s => s.slug === path);

        if (store) {
            renderStorePage(store.id);
            document.title = `${store.name} - Showly`;
        } else {
            if (storeBanner) storeBanner.style.display = 'none';
            if (categoryFiltersSection) categoryFiltersSection.style.display = 'none';
            if (mainFiltersSection) mainFiltersSection.style.display = 'none';
            if (productsGrid) productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'block';
            document.title = 'Sayfa Bulunamadı - Showly';
        }
    };
    
    // ✅ YENİ: Kategorili menü yapısı
    async function renderCategoryMenu() {
        try {
            const categoryMenu = document.getElementById('category-menu');
            
            // ✅ Element kontrolü
            if (!categoryMenu) {
                console.error('❌ category-menu elementi bulunamadı!');
                return;
            }
            
            categoryMenu.innerHTML = ''; // Önce temizle
            
            // Kategorileri çek (iki seviyeli sistem)
            const [parentCategoriesSnapshot, subcategoriesSnapshot] = await Promise.all([
                window.db.collection('parentCategories').orderBy('order', 'asc').get(),
                window.db.collection('subcategories').orderBy('order', 'asc').get()
            ]);
            
            const parentCategories = parentCategoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const subcategories = subcategoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('📂 Ana Kategoriler:', parentCategories);
            console.log('📂 Alt Kategoriler:', subcategories);
            
            // Eğer hiç kategori yoksa, eski tek seviyeli sistemden veri çekmeye çalış
            if (parentCategories.length === 0) {
                console.log('⚠️ Ana kategori bulunamadı, eski sistem deneniyor...');
                
                const oldCategoriesSnapshot = await window.db.collection('categories').orderBy('order', 'asc').get();
                const oldCategories = oldCategoriesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                if (oldCategories.length === 0) {
                    categoryMenu.innerHTML = '<p style="padding: 20px; color: rgba(255,255,255,0.7); text-align: center;">Henüz kategori eklenmemiş.</p>';
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
                            <span>${category.name}</span>
                        </div>
                        <ul class="category-stores" id="stores-${category.id}" style="display: none;">
                            ${categoryStores.map(store => `
                                <li>
                                    <a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                                        ${store.name}
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    `;
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
            
            if (parentCategories.length === 0) {
                categoryMenu.innerHTML = '<p style="padding: 20px; color: rgba(255,255,255,0.7); text-align: center;">Henüz kategori eklenmemiş.</p>';
                return;
            }
            
            if (allStores.length === 0) {
                categoryMenu.innerHTML = '<p style="padding: 20px; color: rgba(255,255,255,0.7); text-align: center;">Henüz mağaza eklenmemiş.</p>';
                return;
            }
            
            // Her ana kategori için
            parentCategories.forEach(parent => {
                const parentIcon = parent.icon || 'fa-tag';
                
                // Bu ana kategoriye ait alt kategorileri bul
                const parentSubcategories = subcategories.filter(sub => sub.parentId === parent.id);
                
                // Bu kategori hiyerarşisindeki tüm mağazaları topla
                const categoryStoreIds = parentSubcategories.map(sub => sub.id);
                const categoryStores = allStores.filter(s => categoryStoreIds.includes(s.category));
                
                console.log(`📁 ${parent.name}: ${parentSubcategories.length} alt kategori, ${categoryStores.length} mağaza`);
                
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
        
        container.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn ' + (!activeFilter ? 'active' : '');
        allBtn.innerHTML = `Ähli harytlar <span class="category-count">${storeProducts.length}</span>`;
        allBtn.addEventListener('click', () => renderStorePage(storeId, null));
        container.appendChild(allBtn);

        categories.forEach(category => {
            const count = storeProducts.filter(p => p.category === category).length;
            const btn = document.createElement('button');
            btn.className = 'category-btn ' + (activeFilter?.type === 'CATEGORY' && activeFilter.value === category ? 'active' : '');
            btn.innerHTML = `${category} <span class="category-count">${count}</span>`;
            btn.addEventListener('click', () => renderStorePage(storeId, { type: 'CATEGORY', value: category }));
            container.appendChild(btn);
        });
    };

    // --- GENEL FİLTRELERİ OLUŞTURAN FONKSİYON ---
    const renderMainFilters = (storeId, activeFilter) => {
        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        const discountedProducts = storeProducts.filter(p => p.isOnSale);
        const expensiveProducts = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500);

        mainFiltersContainer.innerHTML = `
            <div class="price-filter-group">
                <div class="price-filter-group-title">Hızlı Filtreler</div>
                <div class="category-buttons-container">
                    <button class="filter-option-btn ${activeFilter?.type === 'DISCOUNT' ? 'active' : ''}" data-filter-type="DISCOUNT">
                        <i class="fas fa-percentage"></i> Arzanladyş <span class="category-count">${discountedProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'SORT_PRICE_ASC' ? 'active' : ''}" data-filter-type="SORT_PRICE_ASC">
                        <i class="fas fa-arrow-up"></i> Arzandan <span class="category-count">${storeProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'EXPENSIVE' ? 'active' : ''}" data-filter-type="EXPENSIVE">
                        <i class="fas fa-crown"></i> Gymmatdan <span class="category-count">${expensiveProducts.length}</span>
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
    

    const renderStorePage = (storeId, activeFilter = null) => {
        currentStoreId = storeId;
        const store = allStores.find(s => s.id === storeId);
        const storeProducts = allProducts.filter(p => p.storeId === storeId);

        const storeBanner = document.getElementById('store-banner');
        storeBanner.style.display = 'block';

        // ✅ YENİ: TikTok ve Instagram butonları
        let socialButtonsHTML = '';
        if (store.tiktok || store.instagram || store.phone || store.location) {
            socialButtonsHTML = '<div class="store-social-buttons">';
            if (store.tiktok) {
                socialButtonsHTML += `<a href="${store.tiktok}" target="_blank" class="social-button tiktok-button"><i class="fab fa-tiktok"></i></a>`;
            }
            if (store.instagram) {
                socialButtonsHTML += `<a href="${store.instagram}" target="_blank" class="social-button instagram-button"><i class="fab fa-instagram"></i></a>`;
            }
            if (store.phone) {
                socialButtonsHTML += `<a href="tel:${store.phone}" class="social-button phone-button"><i class="fas fa-phone"></i></a>`;
            }
            if (store.location) {
                socialButtonsHTML += `<a href="https://maps.google.com/?q=${encodeURIComponent(store.location)}" target="_blank" class="social-button location-button"><i class="fas fa-map-marker-alt"></i></a>`;
            }
            socialButtonsHTML += '</div>';
        }

        storeBanner.innerHTML = `
            <div class="store-banner-content">
                <div class="store-info">
                    <h2>${store.name}</h2>
                    <p>${store.customBannerText || ''}</p>
                </div>
                <div class="store-social-buttons-container">
                    ${socialButtonsHTML}
                </div>
            </div>
        `;

        // ✅ BURAYI EKLEYİN - Kategori ve filtreleri göster
        categoryFiltersSection.style.display = 'block';
        mainFiltersSection.style.display = 'block';
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';

        // ✅ BURAYI EKLEYİN - Fonksiyonları çağır
        renderCategories(storeId, activeFilter);
        renderMainFilters(storeId, activeFilter);

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
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-box-open"></i><h3>Bu filtrde haryt tapylmady.</h3></div>`;
            return;
        }
        
        // ✅ Sıralama kodu (daha önce eklediğiniz)
        if (activeFilter?.type === 'SORT_PRICE_ASC') {
            productsToRender.sort((a, b) => {
                const priceA = parseFloat(a.price.replace(' TMT', '')) || 0;
                const priceB = parseFloat(b.price.replace(' TMT', '')) || 0;
                return priceA - priceB;
            });
            console.log('✅ Ürünler ucuzdan pahalıya sıralandı');
        } else {
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

            let priceDisplay = `<p class="product-price">${product.price}</p>`;

            if (product.isOnSale && product.originalPrice) {
                const normalPriceValue = parseFloat(product.price.replace(' TMT', ''));
                const discountedPriceValue = parseFloat(product.originalPrice.replace(' TMT', ''));

                if (!isNaN(normalPriceValue) && !isNaN(discountedPriceValue) && normalPriceValue > discountedPriceValue) {
                    const discountPercentage = Math.round(((normalPriceValue - discountedPriceValue) / normalPriceValue) * 100);

                    priceDisplay = `
                        <div class="price-container">
                            <div class="price-info">
                                <span class="current-price">${product.originalPrice}</span>
                                <span class="original-price">${product.price}</span>
                            </div>
                            <span class="discount-percentage-badge">-%${discountPercentage}</span>
                        </div>
                    `;
                }
            }

            productCard.innerHTML = `
                <div class="product-image-container">
                    ${product.isOnSale ? '<span class="discount-badge">Arzanladyş</span>' : ''}
                    <img src="${product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2216%22%3E%3C/text%3E%3C/svg%3E'}" alt="${product.title}">
                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <span class="product-category-label">${product.category || ''}</span>
                    ${priceDisplay}
                    <div class="product-actions"><button class="btn-cart" data-id="${product.id}">Sebede goş</button></div>
                </div>
            `;
            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };

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
        storeBanner.innerHTML = `<h2>Gözleg: "${query}"</h2><p>${filteredProducts.length} harydy</p>`;
        
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';
        
        if (filteredProducts.length === 0) { 
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><h3>Haryt tapylmady</h3></div>`; 
            return; 
        }
        
        filteredProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2216%22%3E%3C/text%3E%3C/svg%3E'}" alt="${product.title}">                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <span class="product-category-label">${product.category || ''}</span>
                    <p class="product-price">${product.price}</p>
                    <div class="product-actions"><button class="btn-cart" data-id="${product.id}">Sebede goş</button></div>
                </div>
            `;
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
        }
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
        cartCount.textContent = total;
        cartCount.classList.toggle('show', total > 0);
        localStorage.setItem('showlyCart', JSON.stringify(cart));
    };

    const addToCart = (product) => {
        const store = allStores.find(s => s.id === product.storeId);
        if (!store) return;

        // Mevcut sepet varsa ve farklı mağazadan ürün ekleniyorsa
        const existingStoreId = Object.keys(cart)[0];
        if (existingStoreId && existingStoreId !== product.storeId) {
            showNotification('Ilki bilen sebediňizi boşuň!', false);
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
        updateCartCount();
        showNotification(product.title + ' sebede goşuldy!');
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

    // Ürün gridi olayları
    productsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-favorite');
        if (btn) { 
            const product = allProducts.find(p => p.id === btn.getAttribute('data-id'));
            if (product) toggleFavorite(product);
            return; 
        }
        
        if (e.target.classList.contains('btn-cart')) { 
            const product = allProducts.find(p => p.id === e.target.getAttribute('data-id'));
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
    document.getElementById('modal-add-cart').addEventListener('click', () => {
        const modal = document.getElementById('product-modal');
        const productId = modal.getAttribute('data-product-id');
        const product = allProducts.find(p => p.id === productId);
        if (product) { 
            addToCart(product); 
            document.getElementById('product-modal').style.display = 'none'; 
        }
    });
    
    document.querySelectorAll('.close-modal').forEach(btn => { 
        btn.addEventListener('click', () => btn.closest('.modal').style.display = 'none'); 
    });
    
    window.addEventListener('click', (e) => { 
        if (e.target.classList.contains('modal')) e.target.style.display = 'none'; 
    });

    // Sepet modalı
    cartButton.addEventListener('click', () => {
        const cartModal = document.getElementById('cart-modal');
        const cartItems = document.getElementById('cart-items');

        // Sadece mevcut mağazanın sepetini göster
        const currentStoreCart = currentStoreId ? cart[currentStoreId] : null;

        if (!currentStoreCart || currentStoreCart.items.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart-message">Siz öz sargyt etjek harytlaryňyzy şu sebede goşup bilersiňiz.</p>';
            document.getElementById('cart-total-price').textContent = '0.00 TMT';
        } else {
            cartItems.innerHTML = '';
            const storeSection = document.createElement('div');
            storeSection.className = 'cart-store-section';

            let storeTotal = 0;
            const itemsHTML = currentStoreCart.items.map(item => {
                const price = parseFloat(item.price.replace(' TMT', ''));
                storeTotal += price * item.quantity;
                return `
                    <img src="${item.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E%3C/text%3E%3C/svg%3E'}" alt="${item.title}">
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
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('quantity-btn')) {
            const storeId = e.target.getAttribute('data-store-id');
            const productId = e.target.getAttribute('data-id');
            const action = e.target.getAttribute('data-action');
            if (cart[storeId]) {
                const item = cart[storeId].items.find(i => i.id === productId);
                if (item) {
                    if (action === 'increase') item.quantity++;
                    else if (action === 'decrease' && item.quantity > 1) item.quantity--;
                    updateCartCount();
                    cartButton.click();
                }
            }
        }
        if (e.target.classList.contains('cart-item-remove')) {
            const storeId = e.target.getAttribute('data-store-id');
            const productId = e.target.getAttribute('data-id');
            if (cart[storeId]) {
                cart[storeId].items = cart[storeId].items.filter(i => i.id !== productId);
                if (cart[storeId].items.length === 0) {
                    delete cart[storeId];
                }
                updateCartCount();
                cartButton.click();
            }
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

        const formHTML = `
            <div class="order-form-overlay" data-store-id="${currentStoreCart.storeId}">
                <div class="order-form-modal">
                    <div class="order-form-header">
                        <h3>${currentStoreCart.storeName}</h3>
                        <p>Umumy: ${storeTotal.toFixed(2)} TMT</p>
                    </div>
                    <div class="order-items-preview">
                        <strong>Harytlar:</strong> ${itemsPreview}
                    </div>
                    <form id="order-form-${currentStoreCart.storeId}">
                        <div class="form-group">
                            <label>Adyňyz Familiýaňyz</label>
                            <input type="text" class="customer-name" placeholder="Adyňyzy we Familiýaňyzy ýazyň" required>
                        </div>
                        <div class="form-group">
                            <label>Telefon nomeriňiz</label>
                            <input type="tel" class="customer-phone" placeholder="Telefon nomeriňiz (:+993...)" required>
                        </div>
                        <div class="form-group">
                            <label>Adresiňiz</label>
                            <textarea class="customer-address" rows="3" placeholder="Adresiňizi ýazyň" required></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary cancel-order-${currentStoreCart.storeId}">Aýyr</button>
                            <button type="submit" class="btn-primary">Sargyt ediň</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);

        // İptal butonu
        document.querySelector(`.cancel-order-${currentStoreCart.storeId}`).addEventListener('click', () => {
            document.querySelector(`.order-form-overlay[data-store-id="${currentStoreCart.storeId}"]`).remove();
        });

        // Form submit handler
        document.getElementById(`order-form-${currentStoreCart.storeId}`).addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = e.target.querySelector('.customer-name').value.trim();
            const phone = e.target.querySelector('.customer-phone').value.trim();
            const address = e.target.querySelector('.customer-address').value.trim();

            if (!name || !phone || !address) {
                showNotification('Ähli meýdançalary dolduryň!', false);
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

            const order = {
                customer: { name, phone, address },
                storeId: currentStoreCart.storeId,
                storeName: currentStoreCart.storeName,
                items: [...currentStoreCart.items],
                total: storeTotal.toFixed(2) + ' TMT',
                date: new Date().toISOString(),
                status: 'pending'
            };

            try {
                const docRef = await window.db.collection('orders').add(order);
                console.log('Sipariş Firebase\'e eklendi, ID:', docRef.id);

                loadingOverlay.style.display = 'none';
                showNotification(`✅ ${currentStoreCart.storeName} üçin sargydyňyz kabul edildi!`, true);

                // Bu mağazayı sepetten sil
                delete cart[currentStoreCart.storeId];
                updateCartCount();
                document.querySelector(`.order-form-overlay[data-store-id="${currentStoreCart.storeId}"]`).remove();

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

    // Favoriler modalı
    favoritesButton.addEventListener('click', () => {
        const favoritesModal = document.getElementById('favorites-modal');
        const favoritesItems = document.getElementById('favorites-items');
        if (favorites.length === 0) { 
            favoritesItems.innerHTML = '<p class="empty-favorites-message">Siz harytlardan öz halanyňyzy saýlap bilersiňiz.</p>'; 
        } else {
            favoritesItems.innerHTML = '';
            favorites.forEach(product => {
                const favItem = document.createElement('div');
                favItem.className = 'favorite-item';
                favItem.innerHTML = `
                        <img src="${product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E%3C/text%3E%3C/svg%3E'}" alt="${product.title}">
                    <div class="favorite-item-info">
                        <div class="favorite-item-title">${product.title}</div>
                        <div class="favorite-item-price">${product.price}</div>
                        <div class="favorite-item-actions">
                            <button class="btn-remove-favorite" data-id="${product.id}">Aýyr</button>
                            <button class="btn-add-cart-from-fav" data-id="${product.id}">Sebede goş</button>
                        </div>
                    </div>
                `;
                favoritesItems.appendChild(favItem);
            });
        } 
        favoritesModal.style.display = 'block';
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-favorite')) { 
            favorites = favorites.filter(f => f.id !== e.target.getAttribute('data-id')); 
            updateFavoritesCount(); 
            favoritesButton.click(); 
        }
        if (e.target.classList.contains('btn-add-cart-from-fav')) { 
            const product = favorites.find(f => f.id === e.target.getAttribute('data-id')); 
            if (product) { 
                addToCart(product); 
                favoritesButton.click(); 
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
    const openProductModal = (productId) => {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        const modal = document.getElementById('product-modal');
        modal.setAttribute('data-product-id', productId); // Modalda ID'yi saklıyoruz
        document.getElementById('modal-image').src = product.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22500%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22400%22 height=%22500%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2218%22%3E%3C/text%3E%3C/svg%3E';
        document.getElementById('modal-title').textContent = product.title;
        document.getElementById('modal-price').textContent = product.price;
        document.getElementById('modal-description').textContent = product.description || '';
        document.getElementById('modal-material').textContent = product.material || '';
        modal.style.display = 'block';
    };
    
    const showNotification = (message, isSuccess = true) => {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `<div class="notification-content"><i class="fas fa-check-circle"></i><span>${message}</span></div>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => { 
            notification.classList.remove('show'); 
            setTimeout(() => notification.remove(), 300); 
        }, 3000);
    };

    // --- İLK YÜKLEME ---
    router();
});

// ✅ YENİ: Sahypany täzele butonu
document.getElementById('reload-page-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Loading göster
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.querySelector('.loading-text');
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = 'Sahypa täzelenýär...';
    
    // 500ms bekle (kullanıcının butona bastığını görmesi için)
    setTimeout(() => {
        window.location.reload();
    }, 500);
});

// ✅ YENİ: Ana sayfaya dön butonu
document.getElementById('back-home-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Loading göster
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.querySelector('.loading-text');
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = 'Sahypa täzelenýär...';
    
    // Ana sayfaya git
    setTimeout(() => {
        history.pushState(null, null, '/');
        window.location.reload();
    }, 500);
});
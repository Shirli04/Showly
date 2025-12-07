document.addEventListener('DOMContentLoaded', () => {
    
    const storeList = document.getElementById('store-list');
    const productsGrid = document.getElementById('products-grid');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const cartButton = document.getElementById('cart-button');
    const favoritesButton = document.getElementById('favorites-button');
    const cartCount = document.querySelector('.cart-count');
    const favoritesCount = document.querySelector('.favorites-count');
    
    // --- MOBİL MENÜ KONTROLÜ ---
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const storeMenu = document.getElementById('store-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    // --- 404 SAYFASI ELEMENTLERİ ---
    const notFoundSection = document.getElementById('not-found');
    const backHomeLink = document.getElementById('back-home-link');
    
    let cart = [];
    let favorites = [];
    let currentStoreId = null;
    
    // --- YÖNLENDİRME (ROUTING) FONKSİYONLARI ---

    // URL'deki slug'a göre sayfayı yönlendiren ana fonksiyon
    const router = () => {
        const path = window.location.pathname.replace('/', ''); // URL'den slug'ı al (örn: "aga-brend")
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');
        const categoryFilters = document.getElementById('category-filters');
        const productsGrid = document.getElementById('products-grid');
        const pageTitle = document.title; // Sayfa başlığını al

        // Eğer URL boşsa (ana sayfadaysak)
        if (!path) {
            // Ana sayfa elemanlarını göster
            if (heroSection) heroSection.style.display = 'block';
            if (infoSection) infoSection.style.display = 'grid';
            storeBanner.style.display = 'none';
            categoryFilters.style.display = 'none';
            productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'none';
            document.title = 'Showly - Online Katalog Platformasy';
            return;
        }

        // Ana sayfa elemanlarını gizle
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (notFoundSection) notFoundSection.style.display = 'none';

        // Slug'a göre mağazayı bul
        const store = window.showlyDB.getStores().find(s => s.slug === path);

        if (store) {
            // Mağaza bulundu, ürünleri render et
            renderProducts(store.id);
            document.title = `${store.name} - Showly`;
        } else {
            // Mağaza bulunamadı, 404 sayfasını göster
            storeBanner.style.display = 'none';
            categoryFilters.style.display = 'none';
            productsGrid.style.display = 'none';
            if (notFoundSection) notFoundSection.style.display = 'block';
            document.title = 'Sayfa Bulunamadı - Showly';
        }
    };

    // Tarayıcının geri/ileri butonları için olay dinleyici
    window.addEventListener('popstate', router);
    
    // --- MAĞAZALAR ---
    const renderStores = () => {
        const stores = window.showlyDB.getStores();
        
        // Mevcut listeyi temizle
        storeList.innerHTML = '';
        
        if (!stores || stores.length === 0) {
            storeList.innerHTML = `
                <li class="no-stores">
                    <div style="padding: 20px; text-align: center; color: #666;">
                        <i class="fas fa-store" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        Henüz mağaza bulunmuyor
                    </div>
                </li>
            `;
            return;
        }
        
        stores.forEach(store => {
            const li = document.createElement('li');
            // Artık onclick yerine <a> etiketi kullanıyoruz
            li.innerHTML = `
                <a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                    <i class="fas fa-store"></i> ${store.name}
                </a>
            `;
            storeList.appendChild(li);
        });
    };
    
    const renderProducts = (storeId, activeFilter = null) => {
        currentStoreId = storeId;
        const allProducts = window.showlyDB.getProductsByStoreId(storeId);
        const store = window.showlyDB.getStores().find(s => s.id === storeId);
        
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');
        const categoryFilters = document.getElementById('category-filters');
        const productsGrid = document.getElementById('products-grid');
        
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        
        storeBanner.style.display = 'block';
        storeBanner.innerHTML = `
            <h2>${store.name}</h2>
            <p>${allProducts.length} ürün</p>
        `;

        categoryFilters.innerHTML = '';
        categoryFilters.style.display = 'flex';

        // --- KATEGORİ FİLTRELERİNİ OLUŞTUR ---
        const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
        
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn ' + (!activeFilter ? 'active' : '');
        allBtn.innerHTML = `Ähli ürünler <span class="category-count">${allProducts.length}</span>`;
        allBtn.onclick = () => renderProducts(storeId, null);
        categoryFilters.appendChild(allBtn);

        categories.forEach(category => {
            const count = allProducts.filter(p => p.category === category).length;
            const btn = document.createElement('button');
            btn.className = 'category-btn ' + (activeFilter?.type === 'CATEGORY' && activeFilter.value === category ? 'active' : '');
            btn.innerHTML = `${category} <span class="category-count">${count}</span>`;
            btn.onclick = () => renderProducts(storeId, { type: 'CATEGORY', value: category });
            categoryFilters.appendChild(btn);
        });
        // --- KATEGORİ FİLTRELERİ SONU ---

        // --- FİYATA GÖRE HIZLI FİLTRELER ---
        const priceFiltersContainer = document.createElement('div');
        priceFiltersContainer.className = 'price-filters';

        const title = document.createElement('div');
        title.className = 'price-filters-title';
        title.textContent = 'Fiyata göre';
        priceFiltersContainer.appendChild(title);

        const discountedProducts = allProducts.filter(p => p.isOnSale);
        const discountBtn = document.createElement('button');
        discountBtn.className = 'category-btn ' + (activeFilter?.type === 'DISCOUNT' ? 'active' : '');
        discountBtn.innerHTML = `Arzanladyş <span class="category-count">${discountedProducts.length}</span>`;
        discountBtn.onclick = () => renderProducts(storeId, { type: 'DISCOUNT' });
        priceFiltersContainer.appendChild(discountBtn);
        
        const freeProducts = allProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) === 0);
        const freeBtn = document.createElement('button');
        freeBtn.className = 'category-btn ' + (activeFilter?.type === 'FREE' ? 'active' : '');
        freeBtn.innerHTML = `Bedava <span class="category-count">${freeProducts.length}</span>`;
        freeBtn.onclick = () => renderProducts(storeId, { type: 'FREE' });
        priceFiltersContainer.appendChild(freeBtn);

        const expensiveProducts = allProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500); // 500 TMT'den pahalı
        const expensiveBtn = document.createElement('button');
        expensiveBtn.className = 'category-btn ' + (activeFilter?.type === 'EXPENSIVE' ? 'active' : '');
        expensiveBtn.innerHTML = `Pahaly (>500 TMT) <span class="category-count">${expensiveProducts.length}</span>`;
        expensiveBtn.onclick = () => renderProducts(storeId, { type: 'EXPENSIVE' });
        priceFiltersContainer.appendChild(expensiveBtn);

        categoryFilters.appendChild(priceFiltersContainer);
        // --- HIZLI FİLTRELER SONU ---

        // --- FİYAT ARALIĞI FİLTRESİ ---
        const rangeContainer = document.createElement('div');
        rangeContainer.className = 'price-filters';

        const rangeTitle = document.createElement('div');
        rangeTitle.className = 'price-filters-title';
        rangeTitle.textContent = 'Fiyat aralığı';
        rangeContainer.appendChild(rangeTitle);
        
        const rangeInputs = document.createElement('div');
        rangeInputs.className = 'price-range-inputs';
        rangeInputs.innerHTML = `
            <input type="number" id="min-price" placeholder="Min TMT" min="0">
            <span>-</span>
            <input type="number" id="max-price" placeholder="Max TMT" min="0">
        `;
        rangeContainer.appendChild(rangeInputs);
        categoryFilters.appendChild(rangeContainer);

        // Fiyat aralığı girdiğinde filtrelemeyi tetikle
        const minPriceInput = document.getElementById('min-price');
        const maxPriceInput = document.getElementById('max-price');
        const applyPriceRange = () => {
            const min = parseFloat(minPriceInput.value) || 0;
            const max = parseFloat(maxPriceInput.value) || Infinity;
            if (min > 0 || max < Infinity) {
                renderProducts(storeId, { type: 'PRICE_RANGE', min, max });
            } else {
                renderProducts(storeId, null); // Aralık boşsa tüm ürünleri göster
            }
        };
        minPriceInput.addEventListener('keyup', applyPriceRange);
        maxPriceInput.addEventListener('keyup', applyPriceRange);

        // Aktif filtreleyici input'lara yaz
        if (activeFilter?.type === 'PRICE_RANGE') {
            minPriceInput.value = activeFilter.min > 0 ? activeFilter.min : '';
            maxPriceInput.value = activeFilter.max < Infinity ? activeFilter.max : '';
        }
        // --- FİYAT ARALIĞI SONU ---


        // --- ÜRÜNLERİ FİLTRELE VE GÖSTER ---
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';
        
        let productsToRender = allProducts;

        if (activeFilter) {
            switch (activeFilter.type) {
                case 'CATEGORY':
                    productsToRender = allProducts.filter(p => p.category === activeFilter.value);
                    break;
                case 'DISCOUNT':
                    productsToRender = discountedProducts;
                    break;
                case 'FREE':
                    productsToRender = freeProducts;
                    break;
                case 'EXPENSIVE':
                    productsToRender = expensiveProducts;
                    break;
                case 'PRICE_RANGE':
                    const min = activeFilter.min || 0;
                    const max = activeFilter.max || Infinity;
                    productsToRender = allProducts.filter(p => {
                        const price = parseFloat(p.price.replace(' TMT', ''));
                        return price >= min && price <= max;
                    });
                    break;
            }
        }

        if (productsToRender.length === 0) {
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-box-open"></i><h3>Bu filtrede ürün bulunamadı.</h3></div>`;
            return;
        }
        
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';

            let priceDisplay = `<p class="product-price">${product.price}</p>`;
            if (product.isOnSale && product.originalPrice) {
                priceDisplay = `
                    <div class="price-container">
                        <span class="original-price">${product.originalPrice}</span>
                        <span class="current-price">${product.price}</span>
                    </div>
                `;
            }

            productCard.innerHTML = `
                <div class="product-image-container">
                    ${product.isOnSale ? '<span class="discount-badge">İndirim</span>' : ''}
                    <img src="${product.imageUrl || 'https://picsum.photos/300/400?random=' + product.id}" alt="${product.title}">
                    <button class="btn-favorite" data-id="${product.id}">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    ${priceDisplay}
                    <div class="product-actions">
                        <button class="btn-cart" data-id="${product.id}">Sebede goş</button>
                    </div>
                </div>
            `;
            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };
    
    // --- ARAMA ---
    
    const performSearch = () => {
        const query = searchInput.value.trim().toLowerCase();
        
        if (query === '') {
            showNotification('Lütfen bir arama terimi girin!');
            return;
        }
        
        let productsToSearch;
        if (currentStoreId) {
            productsToSearch = window.showlyDB.getProductsByStoreId(currentStoreId);
        } else {
            productsToSearch = window.showlyDB.getAllProducts();
        }
        
        const filteredProducts = productsToSearch.filter(product => 
            product.title.toLowerCase().includes(query) || 
            product.description.toLowerCase().includes(query)
        );
        
        const heroSection = document.querySelector('.hero-section');
        const infoSection = document.querySelector('.info-section');
        const storeBanner = document.getElementById('store-banner');
        const categoryFilters = document.getElementById('category-filters');
        
        if (heroSection) heroSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';
        if (categoryFilters) categoryFilters.style.display = 'none';
        
        storeBanner.style.display = 'block';
        storeBanner.innerHTML = `<h2>Arama Sonuçları: "${query}"</h2><p>${filteredProducts.length} ürün</p>`;
        
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';
        
        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><h3>Sonuç Bulunamadı</h3></div>`;
            return;
        }
        
        filteredProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.imageUrl || 'https://picsum.photos/300/400?random=' + product.id}" alt="${product.title}">
                    <button class="btn-favorite" data-id="${product.id}">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-price">${product.price}</p>
                    <div class="product-actions">
                        <button class="btn-cart" data-id="${product.id}">Sebede goş</button>
                    </div>
                </div>
            `;
            productsGrid.appendChild(productCard);
            updateFavoriteButton(product.id);
        });
    };
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // --- FAVORİLER ---
    
    const toggleFavorite = (product) => {
        const index = favorites.findIndex(item => item.id === product.id);
        
        if (index !== -1) {
            favorites.splice(index, 1);
            showNotification('Favorilerden kaldırıldı');
        } else {
            favorites.push(product);
            showNotification('Favorilere eklendi');
        }
        
        updateFavoritesCount();
        updateFavoriteButton(product.id);
    };
    
    const updateFavoriteButton = (productId) => {
        const buttons = document.querySelectorAll(`.btn-favorite[data-id="${productId}"]`);
        const isFavorite = favorites.some(item => item.id === productId);
        
        buttons.forEach(button => {
            if (isFavorite) {
                button.classList.add('active');
                button.innerHTML = '<i class="fas fa-heart"></i>';
            } else {
                button.classList.remove('active');
                button.innerHTML = '<i class="far fa-heart"></i>';
            }
        });
    };
    
    const updateFavoritesCount = () => {
        favoritesCount.textContent = favorites.length;
        if (favorites.length > 0) {
            favoritesCount.classList.add('show');
        } else {
            favoritesCount.classList.remove('show');
        }
    };
    
    // --- SEPET ---
    
    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        
        updateCartCount();
        showNotification(product.title + ' sepete eklendi!');
    };
    
    const updateCartCount = () => {
        const total = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = total;
        if (total > 0) {
            cartCount.classList.add('show');
        } else {
            cartCount.classList.remove('show');
        }
    };
    
    // --- ÜRÜN MODAL ---
    
    const openProductModal = (productId) => {
        const product = window.showlyDB.getProductById(productId);
        if (!product) return;
        
        const modal = document.getElementById('product-modal');
        document.getElementById('modal-image').src = product.imageUrl || 'https://picsum.photos/400/500?random=' + product.id;
        document.getElementById('modal-title').textContent = product.title;
        document.getElementById('modal-price').textContent = product.price;
        document.getElementById('modal-description').textContent = product.description;
        document.getElementById('modal-material').textContent = product.material;
        
        modal.style.display = 'block';
    };
    
    // --- OLAY DİNLEYİCİLER ---
    
    // Mobil menü kontrolü
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

    // Ürün gridi üzerindeki olaylar (favori, sepete ekle, modal aç)
    productsGrid.addEventListener('click', (e) => {
        if (e.target.closest('.btn-favorite')) {
            const btn = e.target.closest('.btn-favorite');
            const product = window.showlyDB.getProductById(btn.getAttribute('data-id'));
            toggleFavorite(product);
            return;
        }
        
        if (e.target.classList.contains('btn-cart')) {
            const product = window.showlyDB.getProductById(e.target.getAttribute('data-id'));
            addToCart(product);
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
        const title = document.getElementById('modal-title').textContent;
        const product = window.showlyDB.getAllProducts().find(p => p.title === title);
        if (product) {
            addToCart(product);
            document.getElementById('product-modal').style.display = 'none';
        }
    });
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Sepet modalı
    cartButton.addEventListener('click', () => {
        const cartModal = document.getElementById('cart-modal');
        const cartItems = document.getElementById('cart-items');
        
        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart-message">Sepetiniz boş</p>';
        } else {
            cartItems.innerHTML = '';
            let total = 0;
            
            cart.forEach(item => {
                const price = parseFloat(item.price.replace(' TMT', ''));
                total += price * item.quantity;
                
                const cartItem = document.createElement('div');
                cartItem.className = 'cart-item';
                cartItem.innerHTML = `
                    <img src="${item.imageUrl || 'https://picsum.photos/70/70?random=' + item.id}" alt="${item.title}">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-price">${item.price}</div>
                    </div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn" data-id="${item.id}" data-action="decrease">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" data-id="${item.id}" data-action="increase">+</button>
                    </div>
                    <i class="fas fa-trash cart-item-remove" data-id="${item.id}"></i>
                `;
                cartItems.appendChild(cartItem);
            });
            
            document.getElementById('cart-total-price').textContent = total.toFixed(2) + ' TMT';
        }
        
        cartModal.style.display = 'block';
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('quantity-btn')) {
            const productId = e.target.getAttribute('data-id');
            const action = e.target.getAttribute('data-action');
            const item = cart.find(i => i.id === productId);
            
            if (item) {
                if (action === 'increase') item.quantity++;
                else if (action === 'decrease' && item.quantity > 1) item.quantity--;
                updateCartCount();
                cartButton.click(); // Sepeti yenile
            }
        }
        
        if (e.target.classList.contains('cart-item-remove')) {
            const productId = e.target.getAttribute('data-id');
            cart = cart.filter(i => i.id !== productId);
            updateCartCount();
            cartButton.click(); // Sepeti yenile
        }
    });
    
    // Favoriler modalı
    favoritesButton.addEventListener('click', () => {
        const favoritesModal = document.getElementById('favorites-modal');
        const favoritesItems = document.getElementById('favorites-items');
        
        if (favorites.length === 0) {
            favoritesItems.innerHTML = '<p class="empty-favorites-message">Favorileriniz boş</p>';
        } else {
            favoritesItems.innerHTML = '';
            favorites.forEach(product => {
                const favItem = document.createElement('div');
                favItem.className = 'favorite-item';
                favItem.innerHTML = `
                    <img src="${product.imageUrl || 'https://picsum.photos/200/200?random=' + product.id}" alt="${product.title}">
                    <div class="favorite-item-info">
                        <div class="favorite-item-title">${product.title}</div>
                        <div class="favorite-item-price">${product.price}</div>
                        <div class="favorite-item-actions">
                            <button class="btn-remove-favorite" data-id="${product.id}">Kaldır</button>
                            <button class="btn-add-cart-from-fav" data-id="${product.id}">Sepete Ekle</button>
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
            const productId = e.target.getAttribute('data-id');
            favorites = favorites.filter(f => f.id !== productId);
            updateFavoritesCount();
            favoritesButton.click(); // Favorileri yenile
        }
        
        if (e.target.classList.contains('btn-add-cart-from-fav')) {
            const productId = e.target.getAttribute('data-id');
            const product = favorites.find(f => f.id === productId);
            if (product) {
                addToCart(product);
                favoritesButton.click(); // Favorileri yenile
            }
        }
    });
    
    // Logo tıklandığında ana sayfa
    document.getElementById('logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, '/'); // URL'yi anasayfa yap
        router(); // Yönlendirmeyi çalıştır
    });
    
    // Mağaza linklerine tıklandığında yönlendirmeyi çalıştır
    document.addEventListener('click', (e) => {
        if (e.target.closest('.store-link')) {
            e.preventDefault(); // Sayfanın yenilenmesini engelle
            const href = e.target.closest('.store-link').getAttribute('href');
            history.pushState(null, null, href); // Browser geçmişine yeni URL'yi ekle
            router(); // Yeni URL için yönlendirmeyi çalıştır
        }
    });

    // 404 sayfasındaki "Ana Sayfaya Dön" butonu
    backHomeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, '/');
        router();
    });
    
    // --- BİLDİRİM ---
    
    const showNotification = (message) => {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };
    
    // --- İLK YÜKLEME ---
    router(); // Sayfa ilk yüklendiğinde yönlendirmeyi çalıştır
    renderStores(); // Mağaza listesini doldur
});
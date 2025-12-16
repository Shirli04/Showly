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
    let cart = [];
    let favorites = [];
    let currentStoreId = null;
    let allStores = [];
    let allProducts = [];
    
    // --- FIREBASE'DEN VERİLERİ ÇEK VE KAYDET ---
    console.log('🔄 Firebase\'den veriler yükleniyor...');
    
    try {
        // Mağazaları çek
        const storesSnapshot = await window.db.collection('stores').get();
        allStores = storesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Ürünleri çek
        const productsSnapshot = await window.db.collection('products').get();
        allProducts = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`✅ ${allStores.length} mağaza ve ${allProducts.length} ürün yüklendi`);
        
        // Sidebar'ı güncelle
        renderStores();
        
    } catch (error) {
        console.error('❌ Firebase hatası:', error);
        showNotification('Veriler yüklenemedi!', false);
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
    
    // --- MAĞAZA LİSTELEME FONKSİYONU ---
    function renderStores() {
        storeList.innerHTML = '';

        allStores.forEach(store => {
            // Bu mağazaya ait ürünleri say
            const storeProducts = allProducts.filter(p => p.storeId === store.id);

            const li = document.createElement('li');
            li.innerHTML = `<a href="/${store.slug}" class="store-link" data-store-id="${store.id}">
                <i class="fas fa-store"></i> ${store.name} <span>(${storeProducts.length})</span>
            </a>`;
            storeList.appendChild(li);
        });
    }

    // --- KATEGORİ FİLTRELERİNİ OLUŞTURAN FONKSİYON ---
    const renderCategories = (storeId, activeFilter) => {
        const container = document.getElementById('category-buttons-container');
        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        const categories = [...new Set(storeProducts.map(p => p.category).filter(Boolean))];
        
        container.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn ' + (!activeFilter ? 'active' : '');
        allBtn.innerHTML = `Ähli ürünler <span class="category-count">${storeProducts.length}</span>`;
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
        const freeProducts = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) === 0);
        const expensiveProducts = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500);

        mainFiltersContainer.innerHTML = `
            <div class="price-filter-group">
                <div class="price-filter-group-title">Hızlı Filtreler</div>
                <div class="category-buttons-container">
                    <button class="filter-option-btn ${activeFilter?.type === 'DISCOUNT' ? 'active' : ''}" data-filter-type="DISCOUNT">
                        <i class="fas fa-percentage"></i> Arzanladyş <span class="category-count">${discountedProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'FREE' ? 'active' : ''}" data-filter-type="FREE">
                        <i class="fas fa-gift"></i> Bedava <span class="category-count">${freeProducts.length}</span>
                    </button>
                    <button class="filter-option-btn ${activeFilter?.type === 'EXPENSIVE' ? 'active' : ''}" data-filter-type="EXPENSIVE">
                        <i class="fas fa-crown"></i> Pahaly (>500 TMT) <span class="category-count">${expensiveProducts.length}</span>
                    </button>
                </div>
            </div>
            <div class="price-filter-group">
                <div class="price-filter-group-title">Fiyat Aralığı</div>
                <div class="price-range-inputs">
                    <input type="number" id="min-price" placeholder="Min TMT" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.min : ''}">
                    <span>-</span>
                    <input type="number" id="max-price" placeholder="Max TMT" min="0" value="${activeFilter?.type === 'PRICE_RANGE' ? activeFilter.max : ''}">
                </div>
            </div>
        `;

        mainFiltersContainer.querySelectorAll('.filter-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filterType = btn.getAttribute('data-filter-type');
                renderStorePage(storeId, { type: filterType });
            });
        });

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
    
    // --- ÜRÜNLERİ FİLTRELEYİP GÖSTEREN ANA FONKSİYON ---
    const renderStorePage = (storeId, activeFilter = null) => {
        currentStoreId = storeId;
        const store = allStores.find(s => s.id === storeId);
        const storeProducts = allProducts.filter(p => p.storeId === storeId);
        
        const storeBanner = document.getElementById('store-banner');
        storeBanner.style.display = 'block';
        storeBanner.innerHTML = `<h2>${store.name}</h2><p>${storeProducts.length} ürün</p>`;
        
        categoryFiltersSection.style.display = 'block';
        mainFiltersSection.style.display = 'block';
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = '';

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
                case 'FREE': 
                    productsToRender = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) === 0); 
                    break;
                case 'EXPENSIVE': 
                    productsToRender = storeProducts.filter(p => parseFloat(p.price.replace(' TMT', '')) > 500); 
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
            productsGrid.innerHTML = `<div class="no-results"><i class="fas fa-box-open"></i><h3>Bu filtrede ürün bulunamadı.</h3></div>`;
            return;
        }
        
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            let priceDisplay = `<p class="product-price">${product.price}</p>`;

            if (product.isOnSale && product.originalPrice) {
                const originalPrice = parseFloat(product.originalPrice.replace(' TMT', ''));
                const currentPrice = parseFloat(product.price.replace(' TMT', ''));
                
                if (!isNaN(originalPrice) && !isNaN(currentPrice) && originalPrice > 0) {
                    const discountPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
                    
                    priceDisplay = `
                        <div class="price-container">
                            <div class="price-info">
                                <span class="original-price">${product.originalPrice}</span>
                                <span class="current-price">${product.price}</span>
                            </div>
                            <span class="discount-percentage-badge">-${discountPercentage}%</span>
                        </div>
                    `;
                }
            }
            
            productCard.innerHTML = `
                <div class="product-image-container">
                    ${product.isOnSale ? '<span class="discount-badge">İndirim</span>' : ''}
                    <img src="${product.imageUrl || 'https://picsum.photos/300/400?random=' + product.id}" alt="${product.title}">
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
            showNotification('Lütfen bir arama terimi girin!'); 
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
                    <button class="btn-favorite" data-id="${product.id}"><i class="far fa-heart"></i></button>
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
    
    // --- SEPET VE FAVORİ FONKSİYONLARI ---
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
            button.classList.toggle('active', isFavorite);
            button.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
    };
    
    const updateFavoritesCount = () => {
        favoritesCount.textContent = favorites.length;
        favoritesCount.classList.toggle('show', favorites.length > 0);
    };
    
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
        cartCount.classList.toggle('show', total > 0);
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
        const title = document.getElementById('modal-title').textContent;
        const product = allProducts.find(p => p.title === title);
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
                cartButton.click(); 
            }
        }
        if (e.target.classList.contains('cart-item-remove')) { 
            cart = cart.filter(i => i.id !== e.target.getAttribute('data-id')); 
            updateCartCount(); 
            cartButton.click(); 
        }
    });

    // --- SİPARİŞ TAMAMLAMA FONKSİYONU ---
    document.querySelector('.checkout-button').addEventListener('click', () => {
        if (cart.length === 0) {
            showNotification('Sepetiniz boş!', false);
            return;
        }

        // Sipariş formunu oluştur
        const formHTML = `
            <div class="order-form-overlay">
                <div class="order-form-modal">
                    <h3>Sipariş Bilgileri</h3>
                    <form id="order-form">
                        <div class="form-group">
                            <label>Adınız Soyadınız</label>
                            <input type="text" id="customer-name" required>
                        </div>
                        <div class="form-group">
                            <label>Telefon Numaranız</label>
                            <input type="tel" id="customer-phone" required>
                        </div>
                        <div class="form-group">
                            <label>Adresiniz</label>
                            <textarea id="customer-address" rows="3" required></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-order" class="btn-secondary">İptal</button>
                            <button type="submit" class="btn-primary">Siparişi Onayla</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);

        // İptal butonu
        document.getElementById('cancel-order').addEventListener('click', () => {
            document.querySelector('.order-form-overlay').remove();
        });

        // Form submit
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('customer-name').value.trim();
            const phone = document.getElementById('customer-phone').value.trim();
            const address = document.getElementById('customer-address').value.trim();

            if (!name || !phone || !address) {
                showNotification('Lütfen tüm alanları doldurun!', false);
                return;
            }

            // Sipariş verilerini oluştur
            const order = {
                customer: { name, phone, address },
                items: [...cart], // Sepetteki ürünleri kopyala
                total: cart.reduce((sum, item) => {
                    const price = parseFloat(item.price.replace(' TMT', ''));
                    return sum + (price * item.quantity);
                }, 0).toFixed(2) + ' TMT',
                date: new Date().toISOString(),
                status: 'pending'
            };

            try {
                // Firebase'e siparişi ekle
                const docRef = await window.db.collection('orders').add(order);
                console.log('Sipariş Firebase\'e eklendi, ID:', docRef.id);

                // Kullanıcıya başarı mesajı
                const orderedItems = order.items.map(item => `${item.title} (${item.quantity} adet)`).join(', ');
                const orderSummary = `Siparişiniz başarıyla alındı!\nSipariş Edilen Ürünler: ${orderedItems}\nToplam Tutar: ${order.total}`;
                showNotification(orderSummary, true);

                // Sepeti temizle
                cart = [];
                updateCartCount();

                // Modalı kapat
                document.querySelector('.order-form-overlay').remove();

                // Sepet modalını da kapat
                document.getElementById('cart-modal').style.display = 'none';

            } catch (error) {
                console.error('Sipariş eklenemedi:', error);
                showNotification('Sipariş oluşturulamadı!', false);
            }
        });
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
        document.getElementById('modal-image').src = product.imageUrl || 'https://picsum.photos/400/500?random=' + product.id;
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
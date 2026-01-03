document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin paneli yükleniyor...');
    
    // ✅ LOADING EKRANINI BAŞLANGIÇTA GÖSTER
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = 'Veriler yükleniyor...';
    }
    
    // ✅ sessionStorage'dan kullanıcıyı al (localStorage değil!)
    const currentUser = JSON.parse(sessionStorage.getItem('adminUser'));
    
    // Eğer kullanıcı yoksa login'e yönlendir
    if (!currentUser) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        window.location.replace('/login.html');
        return; // Kodun devam etmesini engelle
    }
    
    console.log('✅ Giriş yapan kullanıcı:', currentUser.username);
    
    // DOM elemanları
    const productIsOnSale = document.getElementById('product-is-on-sale');
    const originalPriceGroup = document.getElementById('original-price-group');
    const productOriginalPrice = document.getElementById('product-original-price');
    const navLinks = document.querySelectorAll('.nav-link');

    // Menü elemanlarını yetkiye göre gizle
    document.querySelectorAll('.nav-link').forEach(link => {
        const section = link.getAttribute('data-section');
        if (currentUser.role !== 'admin' && !currentUser.permissions.includes(section)) {
            link.style.display = 'none';
        }
    });
    const contentSections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('page-title');
    const addStoreBtn = document.getElementById('add-store-btn');
    const addProductBtn = document.getElementById('add-product-btn');
    const storeModal = document.getElementById('store-modal');
    const productModal = document.getElementById('product-modal');
    const closeModals = document.querySelectorAll('.close-modal');
    const cancelStore = document.getElementById('cancel-store');
    const cancelProduct = document.getElementById('cancel-product');
    const storeForm = document.getElementById('store-form');
    const productForm = document.getElementById('product-form');
    const productStoreSelect = document.getElementById('product-store');
    const storesTableBody = document.getElementById('stores-table-body');
    const productsTableBody = document.getElementById('products-table-body');
    const ordersTableBody = document.getElementById('orders-table-body');
    const menuToggle = document.querySelector('.menu-toggle');
    const adminSidebar = document.querySelector('.admin-sidebar');
    const userModal = document.getElementById('user-modal');
    const addUserBtn = document.getElementById('add-user-btn');
    const userForm = document.getElementById('user-form');
    const usersTableBody = document.getElementById('users-table-body');
    const cancelUser = document.getElementById('cancel-user');

    // Kategori elemanları
    const categoryModal = document.getElementById('category-modal');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryForm = document.getElementById('category-form');
    const categoriesTableBody = document.getElementById('categories-table-body');
    const cancelCategory = document.getElementById('cancel-category');
    const storeCategorySelect = document.getElementById('store-category');
    
    // Excel export/import
    const exportStoresBtn = document.getElementById('export-stores-btn');
    const importStoresBtn = document.getElementById('import-stores-btn');
    const importStoresInput = document.getElementById('import-stores-input');
    const exportProductsBtn = document.getElementById('export-products-btn');
    const importProductsBtn = document.getElementById('import-products-btn');
    const importProductsInput = document.getElementById('import-products-input');
    
    // Dosya yükleme
    const productImage = document.getElementById('product-image');
    const productImagePreview = document.getElementById('product-image-preview');
    const productImageStatus = document.getElementById('product-image-status');
    
    let editingStoreId = null;
    let editingProductId = null;
    let uploadedProductImageUrl = null;
    
    // Form gönderme kontrolü
    let isSubmitting = false;

    let visitorChartInstance = null; // Global değişken

    // --- YENİ: BEKLEYEN SİPARİŞLERİ İŞLEME FONKSİYONU ---
    const processPendingOrders = () => {
        const pendingOrders = JSON.parse(localStorage.getItem('showlyPendingOrders')) || [];

        if (pendingOrders.length > 0) {
            console.log(`${pendingOrders.length} adet bekleyen sipariş bulundu.`);
            pendingOrders.forEach(order => {
                // Siparişi ana veritabanına ekle
                window.showlyDB.addOrder(order);
            });

            // İşlenen siparişleri localStorage'dan temizle
            localStorage.removeItem('showlyPendingOrders');
            
            // Siparişler tablosunu güncelle
            renderOrdersTable();
            updateDashboard();
            showNotification(`${pendingOrders.length} adet yeni sipariş işlendi.`);
        }
    };

    // --- YENİ: SİPARİŞ NUMARASI ATAMA FONKSİYONU ---
    window.assignOrderNumber = (orderId) => {
        const inputElement = document.getElementById(`number-input-${orderId}`);
        const orderNumber = inputElement.value.trim();

        if (!orderNumber) {
            alert('Lütfen bir sipariş numarası girin.');
            return;
        }

        // Siparişi güncelle
        const order = window.showlyDB.getOrders().find(o => o.id === orderId);
        if (order) {
            order.orderNumber = orderNumber;
            order.status = 'confirmed'; // Durumu 'onaylandı' olarak güncelle
            window.showlyDB.saveToLocalStorage(); // Değişikliği kaydet

            // --- ÖNEMLİ: BURASI SMS GÖNDERMEK İÇİN ARKA YÜZ ÇAĞRISI YAPILACAK ---
            console.log(`Sipariş ${orderId} için numara atandı: ${orderNumber}. Müşteriye SMS gönderilecek.`);
            console.log('Müşteri Bilgileri:', order.customer);
            
            // Burada bir backend API'sine istek atılacak.
            // sendSmsToCustomer(order.customer.phone, `Siparişiniz onaylandı. Sipariş No: ${orderNumber}`);
            
            showNotification(`Sipariş ${orderId} için numara başarıyla atandı: ${orderNumber}`);
            renderOrdersTable(); // Tabloyu yenile
        }
    };
    
    // --- YÜKLEME FONKSİYONLARI ---

    // Backup butonları
    document.getElementById('backup-excel-btn')?.addEventListener('click', () => {
        exportAndBackupToExcel();
        showNotification('Excel yedek oluşturuldu!');
    });

    document.getElementById('backup-csv-btn')?.addEventListener('click', async () => {
        const result = await backupToCloudinary();
        if (result.stores.success && result.products.success) {
            showNotification('Veriler Cloudinary\'ye yedeklendi!');
        }
    });
    
    // Ürün resmi önizleme
    productImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                productImagePreview.src = event.target.result;
                productImagePreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Dosya yükleme durumunu göster
    const showUploadStatus = (element, message, isSuccess = true) => {
        element.textContent = message;
        element.className = `upload-status show ${isSuccess ? 'success' : 'error'}`;
    };
    
    // --- MAĞAZA FONKSİYONLARI ---
    
    // Mağaza tablosunu güncelle
    const renderStoresTable = async () => {
        const stores = await window.showlyDB.getStores();
        
        // ✅ Tüm ürünleri tek seferde çek (her mağaza için ayrı sorgu yapma)
        const allProductsSnapshot = await window.db.collection('products').get();
        const allProducts = allProductsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        storesTableBody.innerHTML = '';
        
        // Tüm mağaza satırlarını oluştur (hızlı ve paralel)
        const rowsHTML = stores.map(store => {
            const storeProducts = allProducts.filter(p => p.storeId === store.id);
            return `
                <td>${store.id}</td>
                <td>${store.name}</td>
                <td>${storeProducts.length}</td>
                <td>
                    <button class="btn-icon edit-store" data-id="${store.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger delete-store" data-id="${store.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
        }).map(html => {
            const row = document.createElement('tr');
            row.innerHTML = html;
            return row;
        });
        
        // Tüm satırları tek seferde ekle
        storesTableBody.append(...rowsHTML);
        attachStoreEventListeners();
        
        console.log(`✅ ${stores.length} mağaza tabloya eklendi`);
    };
    
    // Google Sheets’e satır ekleme
    async function appendToSheet(sheetId, range, rowArray) {
    const token = gapi.auth.getToken()?.access_token;
    if (!token) { alert('Google ile giriş yapmalısın!'); return false; }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW`;
    const body = { values: [rowArray] };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        console.error('Sheet yazma hatası:', await res.text());
        return false;
    }
    return true;
    }
    // Mağaza olay dinleyicileri
    const attachStoreEventListeners = () => {
        document.querySelectorAll('.edit-store').forEach(button => {
            button.removeEventListener('click', null);
            button.addEventListener('click', (e) => {
                editStore(e.currentTarget.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.delete-store').forEach(button => {
            button.removeEventListener('click', null);
            button.addEventListener('click', (e) => {
                deleteStore(e.currentTarget.getAttribute('data-id'));
            });
        });
    };
    
    // Mağaza düzenle
    const editStore = async (storeId) => {
        const stores = await window.showlyDB.getStores();
        const store = stores.find(s => s.id === storeId);
        if (!store) return;

        document.getElementById('store-modal-title').textContent = 'Mağazayı Düzenle';
        document.getElementById('store-id').value = store.id;
        document.getElementById('store-name').value = store.name;
        document.getElementById('store-description').value = store.description || '';
        document.getElementById('store-custom-banner-text').value = store.customBannerText || '';
        
        // ✅ Yeni: TikTok ve Instagram
        const tiktokInput = document.getElementById('store-tiktok');
        const instagramInput = document.getElementById('store-instagram');
        if (tiktokInput) tiktokInput.value = store.tiktok || '';
        if (instagramInput) instagramInput.value = store.instagram || '';
        
        // ✅ Kategori seç
        const categorySelect = document.getElementById('store-category');
        if (categorySelect && store.category) {
            categorySelect.value = store.category;
        }

        storeModal.style.display = 'block';
        editingStoreId = storeId;
    };
    
    // Mağaza sil
    const deleteStore = (storeId) => {
        if (confirm('Bu mağazayı silmek istediğinizden emin misiniz?')) {
            window.showlyDB.deleteStore(storeId);
            renderStoresTable();
            renderProductsTable();
            updateDashboard();
            showNotification('Mağaza başarıyla silindi!');
        }
    };
    
    // Mağaza modal aç
    const openStoreModal = () => {
        document.getElementById('store-modal-title').textContent = 'Yeni Mağaza Ekle';
        storeForm.reset();
        editingStoreId = null;
        isSubmitting = false;
        storeModal.style.display = 'block';
    };

        // ==================== KATEGORİ FONKSİYONLARI ====================

    // Kategorileri yükle ve dropdown'u doldur
    async function loadCategories() {
        try {
            const categoriesSnapshot = await window.db.collection('categories')
                .orderBy('order', 'asc')
                .get();
            
            const categories = categoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Dropdown'u doldur
            storeCategorySelect.innerHTML = '<option value="">Kategoriýa saýlaň</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                storeCategorySelect.appendChild(option);
            });
            
            return categories;
        } catch (error) {
            console.error('Kategoriler yüklenemedi:', error);
            return [];
        }
    }

    // Kategori tablosunu güncelle
    async function renderCategoriesTable() {
        try {
            const categoriesSnapshot = await window.db.collection('categories')
                .orderBy('order', 'asc')
                .get();
            
            const categories = categoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Her kategori için mağaza sayısını say
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => doc.data());
            
            categoriesTableBody.innerHTML = '';
            
            if (categories.length === 0) {
                categoriesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Henüz kategori eklenmemiş.</td></tr>';
                return;
            }
            
            categories.forEach(category => {
                const storeCount = stores.filter(s => s.category === category.id).length;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${category.id}</td>
                    <td>${category.name}</td>
                    <td>${category.order}</td>
                    <td>${storeCount}</td>
                    <td>
                        <button class="btn-icon edit-category" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-category" data-id="${category.id}" ${storeCount > 0 ? 'disabled title="Bu kategoride mağaza var"' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                categoriesTableBody.appendChild(row);
            });
            
            // Buton event'lerini bağla
            document.querySelectorAll('.edit-category').forEach(btn => {
                btn.addEventListener('click', () => editCategory(btn.getAttribute('data-id')));
            });
            
            document.querySelectorAll('.delete-category').forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', () => deleteCategory(btn.getAttribute('data-id')));
                }
            });
            
        } catch (error) {
            console.error('Kategori tablosu yüklenemedi:', error);
        }
    }

    // Kategori düzenle
    async function editCategory(categoryId) {
        try {
            const doc = await window.db.collection('categories').doc(categoryId).get();
            
            if (!doc.exists) {
                showNotification('Kategori bulunamadı!', false);
                return;
            }
            
            const category = doc.data();
            
            document.getElementById('category-modal-title').textContent = 'Kategoriýany düzenle';
            document.getElementById('category-id').value = categoryId;
            document.getElementById('category-name').value = category.name;
            document.getElementById('category-order').value = category.order;
            
            // İkonu seç
            if (category.icon) {
                selectCategoryIcon(category.icon);
            }
            
            categoryModal.style.display = 'block';
            
        } catch (error) {
            console.error('Kategori düzenlenemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    }

    // Kategori sil
    async function deleteCategory(categoryId) {
        if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return;
        
        try {
            await window.db.collection('categories').doc(categoryId).delete();
            showNotification('Kategori silindi!');
            renderCategoriesTable();
        } catch (error) {
            console.error('Kategori silinemedi:', error);
            showNotification('Kategori silinemedi!', false);
        }
    }

    // Kategori ekle/düzenle form submit
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoryId = document.getElementById('category-id').value;
        const name = document.getElementById('category-name').value.trim();
        const icon = document.getElementById('category-icon').value || 'fa-tag';
        const order = parseInt(document.getElementById('category-order').value) || 1;
        
        if (!name) {
            showNotification('Kategori adı gerekli!', false);
            return;
        }
        
        // ID oluştur (Türkçe karakterleri temizle)
        const id = categoryId || name
            .toLowerCase()
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        try {
            if (categoryId) {
                // Güncelle
                await window.db.collection('categories').doc(categoryId).update({
                    name: name,
                    icon: icon,
                    order: order
                });
                showNotification('Kategori güncellendi!');
            } else {
                // Yeni ekle
                await window.db.collection('categories').doc(id).set({
                    name: name,
                    icon: icon,
                    order: order
                });
                showNotification('Kategori eklendi!');
            }
            
            categoryModal.style.display = 'none';
            categoryForm.reset();
            renderCategoriesTable();
            loadCategories(); // Dropdown'u güncelle
            
        } catch (error) {
            console.error('Kategori kaydedilemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    });

    // Kategori modal kontrolleri
    addCategoryBtn?.addEventListener('click', () => {
        document.getElementById('category-modal-title').textContent = 'Täze kategoriýa goş';
        categoryForm.reset();
        document.getElementById('category-id').value = '';
        document.getElementById('category-icon').value = 'luxury-diamond';
        selectCategoryIcon('luxury-diamond'); // Varsayılan ikon
        categoryModal.style.display = 'block';
    });

    cancelCategory?.addEventListener('click', () => {
        categoryModal.style.display = 'none';
        categoryForm.reset();
    });
    
    // ✅ LÜKS SVG KATEGORİ İKONLARI (VIP TARZI)
    const categoryIcons = [
        {
            id: 'men-fashion',
            name: 'Erkek Giyim',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v2"/>
                <path d="M12 21v-2"/>
                <path d="M3 12h2"/>
                <path d="M21 12h-2"/>
                <path d="M5.5 5.5l1.5 1.5"/>
                <path d="M17 17l1.5 1.5"/>
                <path d="M17 7l1.5-1.5"/>
                <path d="M5.5 18.5l1.5-1.5"/>
                <circle cx="12" cy="12" r="5"/>
                <path d="M8 12h8"/>
                <path d="M12 8v8"/>
            </svg>`
        },
        {
            id: 'women-fashion',
            name: 'Kadın Giyim',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v2"/>
                <path d="M12 21v-2"/>
                <path d="M3 12h2"/>
                <path d="M21 12h-2"/>
                <path d="M5.5 5.5l1.5 1.5"/>
                <path d="M17 17l1.5 1.5"/>
                <path d="M17 7l1.5-1.5"/>
                <path d="M5.5 18.5l1.5-1.5"/>
                <circle cx="12" cy="12" r="5"/>
                <path d="M10 10l2 2 2-2"/>
                <path d="M10 14l2-2 2 2"/>
            </svg>`
        },
        {
            id: 'shoes',
            name: 'Ayakkabı',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14h16v5H4z"/>
                <path d="M4 14l2-8h8l2 8"/>
                <path d="M16 14l-2-8"/>
                <path d="M8 14l-2-8"/>
                <path d="M12 6V3"/>
                <path d="M12 10V7"/>
            </svg>`
        },
        {
            id: 'accessories',
            name: 'Aksesuar',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v18"/>
                <path d="M3 12h18"/>
                <path d="M5 5l14 14"/>
                <path d="M19 5L5 19"/>
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 4v16"/>
                <path d="M4 12h16"/>
            </svg>`
        },
        {
            id: 'boutique',
            name: 'Mağaza/Butik',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"/>
                <path d="M3 21v-2"/>
                <path d="M21 21v-2"/>
                <path d="M3 19l3-16h12l3 16"/>
                <path d="M6 3v4"/>
                <path d="M9 3v4"/>
                <path d="M12 3v4"/>
                <path d="M15 3v4"/>
                <path d="M18 3v4"/>
                <path d="M4 12h16"/>
                <rect x="7" y="15" width="4" height="3"/>
                <rect x="13" y="15" width="4" height="3"/>
            </svg>`
        },
        {
            id: 'luxury-diamond',
            name: 'Lüks',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l2 3h4l-2 3-4 3-4-3-2-3h4z"/>
                <path d="M12 12v9"/>
                <path d="M8 12l4 9"/>
                <path d="M16 12l-4 9"/>
                <path d="M6 6l6 6"/>
                <path d="M18 6l-6 6"/>
            </svg>`
        },
        {
            id: 'crown',
            name: 'Taç',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 18h18"/>
                <path d="M3 18l3-8 4 6 4-12 4 12 4-6 3 8"/>
                <path d="M3 6l3 4"/>
                <path d="M21 6l-3 4"/>
                <path d="M12 3v3"/>
            </svg>`
        },
        {
            id: 'star-luxury',
            name: 'Yıldız',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l2.5 7.5H22l-6 4.5 2.5 7.5-6.5-5-6.5 5 2.5-7.5-6-4.5h7.5z"/>
                <path d="M12 7v10"/>
                <path d="M9 12h6"/>
            </svg>`
        },
        {
            id: 'tie',
            name: 'Kravat',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v2"/>
                <path d="M12 19v2"/>
                <path d="M8 5h8"/>
                <path d="M8 19h8"/>
                <path d="M12 5l2 7-2 7-2-7z"/>
                <path d="M10 7h4"/>
                <path d="M10 17h4"/>
            </svg>`
        },
        {
            id: 'handbag',
            name: 'Çanta',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8"/>
                <path d="M7 10h10"/>
                <path d="M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/>
                <path d="M7 14h10"/>
                <path d="M9 14v4"/>
                <path d="M15 14v4"/>
            </svg>`
        },
        {
            id: 'watch',
            name: 'Saat',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 7v5l3 3"/>
                <path d="M12 21v2"/>
                <path d="M12 1v2"/>
                <path d="M21 12h2"/>
                <path d="M1 12h2"/>
            </svg>`
        },
        {
            id: 'perfume',
            name: 'Parfüm',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 8h8"/>
                <path d="M8 8v12h8V8"/>
                <path d="M6 8h12v3H6z"/>
                <path d="M10 5h4v3h-4z"/>
                <path d="M12 3v2"/>
            </svg>`
        },
        {
            id: 'glasses',
            name: 'Gözlük',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="10" r="4"/>
                <circle cx="16" cy="10" r="4"/>
                <path d="M4 10h4"/>
                <path d="M16 10h4"/>
                <path d="M12 10v5"/>
                <path d="M10 12l2 3"/>
                <path d="M14 12l-2 3"/>
            </svg>`
        },
        {
            id: 'scarf',
            name: 'Fular',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 8v8h18V8z"/>
                <path d="M3 12h18"/>
                <path d="M6 8v8"/>
                <path d="M10 8v8"/>
                <path d="M14 8v8"/>
                <path d="M18 8v8"/>
                <path d="M3 8l3-4h12l3 4"/>
                <path d="M3 16l3 4h12l3 4"/>
            </svg>`
        },
        {
            id: 'belt',
            name: 'Kemer',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9h18v6H3z"/>
                <rect x="10" y="10" width="4" height="4"/>
                <path d="M3 12h7"/>
                <path d="M14 12h7"/>
                <path d="M10 10v4"/>
                <path d="M14 10v4"/>
            </svg>`
        },
        {
            id: 'jewelry',
            name: 'Takı',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l3 4h6l-3 4-6 4-6-4-3-4h6z"/>
                <path d="M12 11v8"/>
                <path d="M9 11l3 8"/>
                <path d="M15 11l-3 8"/>
            </svg>`
        },
        {
            id: 'umbrella',
            name: 'Şemsiye',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12c0-5 4-9 9-9s9 4 9 9"/>
                <path d="M3 12c0 0 2-1 2-1"/>
                <path d="M7 12c0 0 2-1 2-1"/>
                <path d="M11 12c0 0 2-1 2-1"/>
                <path d="M15 12c0 0 2-1 2-1"/>
                <path d="M19 12c0 0 2-1 2-1"/>
                <path d="M12 21v-6"/>
            </svg>`
        },
        {
            id: 'hat',
            name: 'Şapka',
            svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12h16v3H4z"/>
                <path d="M4 12c0-5 4-8 8-8s8 3 8 8"/>
                <path d="M6 12v3"/>
                <path d="M10 12v3"/>
                <path d="M14 12v3"/>
                <path d="M18 12v3"/>
            </svg>`
        }
    ];
    
    // İkonları grid'e yükle
    function loadCategoryIcons() {
        const iconGrid = document.getElementById('category-icon-grid');
        if (!iconGrid) return;
        
        iconGrid.innerHTML = categoryIcons.map(icon => `
            <div class="icon-item svg-icon" data-icon="${icon.id}" onclick="selectCategoryIcon('${icon.id}')">
                <div class="icon-wrapper">${icon.svg}</div>
                <span class="icon-label">${icon.name}</span>
            </div>
        `).join('');
        
        console.log(`✅ ${categoryIcons.length} lüks kategori ikonu yüklendi`);
    }
    
    // İkon seçme fonksiyonu
    window.selectCategoryIcon = function(iconId) {
        // Hidden input'u güncelle
        const iconInput = document.getElementById('category-icon');
        if (iconInput) iconInput.value = iconId;
        
        // Seçili özelliğini güncelle
        document.querySelectorAll('.icon-item').forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-icon') === iconId);
        });
        
        console.log('Seçilen ikon:', iconId);
    };
    
    // Sayfa yüklendiğinde ikonları yükle
    loadCategoryIcons();
    
    const handleStoreSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        isSubmitting = true;
        
        const name = document.getElementById('store-name').value.trim();
        const desc = document.getElementById('store-description').value.trim();
        const customBannerText = document.getElementById('store-custom-banner-text')?.value.trim() || '';
        const category = document.getElementById('store-category').value;
        const tiktok = document.getElementById('store-tiktok')?.value.trim() || '';
        const instagram = document.getElementById('store-instagram')?.value.trim() || '';

        if (!name || !category) {
            showNotification('Mağaza adı ve kategori gerekli!', false);
            isSubmitting = false;
            return;
        }
        
        try {
            if (editingStoreId) {
                // ✅ Mağaza güncelleme
                await window.db.collection('stores').doc(editingStoreId).update({
                    name,
                    description: desc,
                    customBannerText,
                    category,
                    tiktok,
                    instagram
                });
                showNotification('Mağaza güncellendi!');
            } else {
                // ✅ Yeni mağaza ekleme
                await window.addStoreToFirebase({
                    name,
                    description: desc,
                    customBannerText,
                    category,
                    tiktok,
                    instagram
                });
                showNotification('Mağaza Firebase\'e eklendi!');
            }
            
            renderStoresTable();
            populateStoreSelect();
            updateDashboard();
            closeAllModals();
        } catch (err) {
            console.error(err);
            showNotification('Mağaza işlemi başarısız!', false);
        } finally {
            isSubmitting = false;
        }
    };
    
    // Ürün tablosunu güncelle
    async function renderProductsTable() {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = 'flex'; // Göster

        try {
            // ✅ DÜZELTME: Firebase'den mağazaları ve ürünleri çek
            const [productsSnapshot, storesSnapshot] = await Promise.all([
                window.db.collection('products').get(),
                window.db.collection('stores').get()
            ]);
            
            // ✅ Mağazaları bir objeye dönüştür (hızlı erişim için)
            const storesMap = {};
            storesSnapshot.docs.forEach(doc => {
                storesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            // ✅ Ürünleri işle
            const products = productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            productsTableBody.innerHTML = '';
            
            for (const product of products) {
                // ✅ Mağazayı storesMap'ten al
                const store = storesMap[product.storeId];
                const storeName = store ? store.name : 'Mağaza Bulunamadı';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.title}</td>
                    <td>${storeName}</td>
                    <td>${product.price}</td>
                    <td>${product.imageUrl ? `<img src="${product.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : 'Resim yok'}</td>
                    <td>
                        <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            }
            
            attachProductEventListeners();
        } catch (error) {
            console.error('Ürünler yüklenemedi:', error);
            showNotification('Ürünler yüklenemedi!', false);
        } finally {
            loadingOverlay.style.display = 'none'; // Gizle
        }
    }
    
    // Ürün olay dinleyicileri
    const attachProductEventListeners = () => {
        document.querySelectorAll('.edit-product').forEach(button => {
            button.removeEventListener('click', null);
            button.addEventListener('click', (e) => {
                editProduct(e.currentTarget.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.delete-product').forEach(button => {
            button.removeEventListener('click', null);
            button.addEventListener('click', (e) => {
                deleteProduct(e.currentTarget.getAttribute('data-id'));
            });
        });
    };

    // Ürün düzenle
    const editProduct = async (productId) => {
        try {
            // Firebase'den ürünü ID ile çek
            const productDoc = await window.db.collection('products').doc(productId).get();
            if (!productDoc.exists) {
                showNotification('Ürün bulunamadı!', false);
                return;
            }

            const product = productDoc.data();
            product.id = productDoc.id;

            // Modal içeriğini doldur
            document.getElementById('product-name').value = product.title || '';
            document.getElementById('product-store').value = product.storeId || '';
            document.getElementById('product-price').value = product.price || ''; // ✅ DÜZELTME
            document.getElementById('product-discounted-price').value = product.originalPrice || ''; // ✅ DÜZELTME
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-material').value = product.material || '';
            document.getElementById('product-category').value = product.category || '';

            // Resim varsa, önizlemeyi göster
            if (product.imageUrl) {
                productImagePreview.src = product.imageUrl;
                productImagePreview.classList.add('show');
                uploadedProductImageUrl = product.imageUrl;
            } else {
                productImagePreview.classList.remove('show');
                uploadedProductImageUrl = null;
            }

            // Modalı aç
            productModal.style.display = 'block';
            editingProductId = productId;
        } catch (error) {
            console.error('Ürün düzenlenirken hata oluştu:', error);
            showNotification('Ürün bilgileri yüklenemedi!', false);
        }
    };
    
    // Ürün sil
    const deleteProduct = (productId) => {
        if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
            window.showlyDB.deleteProduct(productId);
            renderProductsTable();
            updateDashboard();
            showNotification('Ürün başarıyla silindi!');
        }
    };
    
    // Ürün modal aç
    const openProductModal = () => {
        populateStoreSelect();
        productForm.reset();
        productImagePreview.classList.remove('show');
        productImageStatus.classList.remove('show');
        uploadedProductImageUrl = null;
        editingProductId = null;
        isSubmitting = false;
        productModal.style.display = 'block';
    };
    
    // Ürün form submit (FIREBASE + Cloudinary)
    const handleProductSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        isSubmitting = true;
        
        try {
            const title    = document.getElementById('product-name').value.trim();
            const storeId  = document.getElementById('product-store').value;
            const newPrice = document.getElementById('product-price').value.trim(); // ✅ DÜZELTME
            const discountedPriceInput = document.getElementById('product-discounted-price')?.value.trim() || ''; // ✅ DÜZELTME
            const desc     = document.getElementById('product-description').value.trim();
            const material = document.getElementById('product-material').value.trim();
            const category = document.getElementById('product-category').value.trim();
            const file     = productImage.files[0];

            if (!title || !storeId || !newPrice) {
                showNotification('Zorunlu alanları doldurun!', false);
                isSubmitting = false;
                return;
            }

            let imageUrl = uploadedProductImageUrl; // Mevcut resmi koru
            if (file) {
                showUploadStatus(productImageStatus, 'Resim yükleniyor...', true);
                const uploadResult = await uploadToCloudinary(file);
                imageUrl = uploadResult;
                showUploadStatus(productImageStatus, '✓ Resim yüklendi!', true);
            }

            // ✅ DÜZELTME: İndirim hesaplaması
            let isOnSale = false;
            let originalPrice = '';

            if (discountedPriceInput) {
                const normalPrice = parseFloat(newPrice.replace(' TMT', ''));
                const discountedPrice = parseFloat(discountedPriceInput.replace(' TMT', ''));
                
                // Eğer indirimli fiyat normal fiyattan küçükse
                if (!isNaN(normalPrice) && !isNaN(discountedPrice) && discountedPrice < normalPrice) {
                    isOnSale = true;
                    originalPrice = discountedPriceInput; // İndirimli fiyatı sakla
                }
            }

            // Düzenleme mi, yoksa yeni ekleme mi?
            if (editingProductId) {
                // Mevcut ürünü güncelle
                await window.db.collection('products').doc(editingProductId).update({
                    storeId, 
                    title, 
                    price: newPrice, 
                    description: desc, 
                    material, 
                    category,
                    isOnSale, 
                    originalPrice, 
                    imageUrl
                });
                showNotification('Ürün başarıyla güncellendi!');
            } else {
                // Yeni ürün ekle
                await window.addProductToFirebase({
                    storeId, 
                    title, 
                    price: newPrice, 
                    description: desc, 
                    material, 
                    category,
                    isOnSale, 
                    originalPrice, 
                    imageUrl
                });
                showNotification('Ürün Firebase\'e eklendi!');
            }

            renderProductsTable();
            updateDashboard();
            closeAllModals();
        } catch (err) {
            console.error(err);
            showNotification('Ürün işlemi başarısız oldu!', false);
        } finally {
            isSubmitting = false;
        }
    };

    async function uploadToCloudinary(file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', 'my_product_uploads');
        const res = await fetch(`https://api.cloudinary.com/v1_1/domv6ullp/image/upload`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Cloudinary yükleme hatası');
        const data = await res.json();
        return data.secure_url;
    }
    
    async function renderOrdersTable() {
        try {
            const ordersSnapshot = await window.db.collection('orders').orderBy('date', 'desc').get();
            const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Firebase'den ürün ve mağaza verilerini çek
            const productsSnapshot = await window.db.collection('products').get();
            const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const storesSnapshot = await window.db.collection('stores').get();
            const allStores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            ordersTableBody.innerHTML = '';
            if (orders.length === 0) {
                ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Henüz sipariş bulunmuyor.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const storeNames = [...new Set(order.items.map(item => {
                    const product = allProducts.find(p => p.id === item.id);
                    const store = allStores.find(s => s.id === product?.storeId);
                    return store?.name || 'Bilinmiyor';
                }))].join(', ');

                const row = document.createElement('tr');
                if (order.status === 'pending') {
                    row.innerHTML = `
                        <td>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${order.items.map(item => `<li>ID: ${item.id}</li>`).join('')}
                            </ul>
                        </td>
                        <td>${order.customer.name}</td>
                        <td>${order.customer.phone}</td>
                        <td>${order.customer.address}</td>
                        <td>${storeNames}</td>
                        <td>${new Date(order.date).toLocaleString('tr-TR')}</td>
                        <td><span class="status pending">Beklemede</span></td>
                        <td>
                            <input type="text" id="number-input-${order.id}" placeholder="Sipariş No" style="width: 100px; padding: 5px;">
                            <button class="btn-icon" onclick="assignOrderNumber('${order.id}')" title="Numara Ata ve SMS Gönder">
                                <i class="fas fa-check"></i>
                            </button>
                        </td>
                    `;
                } else {
                    row.innerHTML = `
                        <td>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${order.items.map(item => `<li>ID: ${item.id}</li>`).join('')}
                            </ul>
                        </td>
                        <td>${order.customer.name}</td>
                        <td>${order.customer.phone}</td>
                        <td>${order.customer.address}</td>
                        <td>${storeNames}</td>
                        <td>${new Date(order.date).toLocaleString('tr-TR')}</td>
                        <td><span class="status completed">Onaylandı</span></td>
                        <td><strong>${order.orderNumber}</strong></td>
                    `;
                }
                ordersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Siparişler yüklenemedi:', error);
            showNotification('Siparişler yüklenemedi!', false);
        }
    }

    // Dashboard güncelle - Firebase'den verileri çeker
    const updateDashboard = async () => {
        try {
            // Firebase'den mağazaları çek
            const storesSnapshot = await window.db.collection('stores').get();
            const storesCount = storesSnapshot.size;
            
            // Firebase'den ürünleri çek
            const productsSnapshot = await window.db.collection('products').get();
            const productsCount = productsSnapshot.size;
            
            // Firebase'den siparişleri çek
            const ordersSnapshot = await window.db.collection('orders').get();
            const ordersCount = ordersSnapshot.size;
            
            // Sayıları güncelle
            document.getElementById('total-stores').textContent = storesCount;
            document.getElementById('total-products').textContent = productsCount;
            document.getElementById('total-orders').textContent = ordersCount;
            
            console.log('✅ Dashboard güncellendi:', { storesCount, productsCount, ordersCount });
        } catch (error) {
            console.error('❌ Dashboard güncellenemedi:', error);
            document.getElementById('total-stores').textContent = '0';
            document.getElementById('total-products').textContent = '0';
            document.getElementById('total-orders').textContent = '0';
        }
    };

    const renderVisitorChart = async () => {
        try {
            // Son 7 günün tarihlerini hazırla
            const dates = [];
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                dates.push(date.toISOString().split('T')[0]);
            }
            
            // Firebase'den ziyaretçi verilerini çek
            const visitorsSnapshot = await window.db.collection('visitors').get();
            const visitors = visitorsSnapshot.docs.map(doc => doc.data());
            
            // Tarihe göre grupla ve say
            const visitorCounts = dates.map(date => {
                return visitors.filter(v => v.date === date).length;
            });
            
            // Tarihleri güzelleştir (30 Ara formatında)
            const labels = dates.map(date => {
                const d = new Date(date);
                return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
            });
            
            // Grafik verisi
            const chartData = {
                labels: labels,
                datasets: [{
                    label: 'Ziyaretçi Sayısı',
                    data: visitorCounts,
                    backgroundColor: 'rgba(108, 92, 231, 0.2)',
                    borderColor: 'rgba(108, 92, 231, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4, // Yumuşak eğri
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: 'rgba(108, 92, 231, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            };
            
            // Grafik ayarları
            const chartConfig = {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14 },
                            bodyFont: { size: 13 },
                            displayColors: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return Math.floor(value); // Tam sayı göster
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            };
            
            // Eski grafiği yok et (eğer varsa)
            if (visitorChartInstance) {
                visitorChartInstance.destroy();
            }
            
            // Yeni grafiği oluştur
            const ctx = document.getElementById('visitorChart').getContext('2d');
            visitorChartInstance = new Chart(ctx, chartConfig);
            
            console.log('✅ Ziyaretçi grafiği oluşturuldu:', visitorCounts);
            
        } catch (error) {
            console.error('❌ Ziyaretçi grafiği oluşturulamadı:', error);
        }
    };
        
    // --- EXCEL FONKSİYONLARI ---   
    // Mağazaları Excel'e indir
    if (exportStoresBtn) {
        exportStoresBtn.addEventListener('click', () => {
            ExcelManager.exportStoresToExcel();
            showNotification('Mağazalar indirildi!');
        });
    }
    
    // Excel'den mağaza yükle
    if (importStoresBtn) {
        importStoresBtn.addEventListener('click', () => {
            importStoresInput.click();
        });
    }
    
    if (importStoresInput) {
        importStoresInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const result = await ExcelManager.importStoresFromExcel(file);
                    showNotification(result.message);
                    renderStoresTable();
                    updateDashboard();
                } catch (error) {
                    showNotification('Hata: ' + error.error, false);
                }
            }
        });
    }
    
    // Ürünleri Excel'e indir
    if (exportProductsBtn) {
        exportProductsBtn.addEventListener('click', () => {
            ExcelManager.exportProductsToExcel();
            showNotification('Ürünler indirildi!');
        });
    }
    
    // Excel'den ürün yükle
    if (importProductsBtn) {
        importProductsBtn.addEventListener('click', () => {
            importProductsInput.click();
        });
    }
    
    if (importProductsInput) {
        importProductsInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const result = await ExcelManager.importProductsFromExcel(file);
                    showNotification(result.message);
                    renderProductsTable();
                    updateDashboard();
                } catch (error) {
                    showNotification('Hata: ' + error.error, false);
                }
            }
        });
    }
    
    // Mağaza seçimini doldur
    async function populateStoreSelect() {
        try {
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            productStoreSelect.innerHTML = '<option value="">Mağaza Seçin</option>';
            for (const store of stores) {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                productStoreSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Mağazalar yüklenemedi:', error);
            showNotification('Mağazalar yüklenemedi!', false);
        }
    }

    // Mağaza filtresini doldur
    async function populateStoreFilter() {
        const filterStoreSelect = document.getElementById('filter-store-select');
        const filterCategorySelect = document.getElementById('filter-category-select');
        
        if (!filterStoreSelect) return;
        
        try {
            // Firebase'den mağazaları çek
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Dropdown'ı temizle ve "Tüm Mağazalar" ekle
            filterStoreSelect.innerHTML = '<option value="">Tüm Mağazalar</option>';
            
            // Her mağazayı dropdown'a ekle
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                filterStoreSelect.appendChild(option);
            });
            
            console.log(`✅ ${stores.length} mağaza filtreye yüklendi`);
            
        } catch (error) {
            console.error('❌ Mağaza filtresi yüklenemedi:', error);
        }
    }

    // ✅ Mağaza ve kategori filtreleme sistemi
    (function initProductFilters() {
        const filterStoreSelect = document.getElementById('filter-store-select');
        const filterCategorySelect = document.getElementById('filter-category-select');
        const productsTableBody = document.getElementById('products-table-body');
        
        if (!filterStoreSelect || !filterCategorySelect || !productsTableBody) {
            console.error('❌ Filtre elemanları bulunamadı!');
            return;
        }
        
        // Mağaza seçilince
        filterStoreSelect.addEventListener('change', async (e) => {
            const selectedStoreId = e.target.value;
            
            console.log('🔍 Seçilen mağaza:', selectedStoreId);
            
            // Kategori filtresini sıfırla
            filterCategorySelect.innerHTML = '<option value="">Tüm Kategoriler</option>';
            filterCategorySelect.disabled = true;
            
            if (selectedStoreId) {
                // ✅ Seçilen mağazanın ürünlerini göster
                await filterAndDisplayProducts(selectedStoreId, null);
                
                // ✅ Kategorileri yükle
                try {
                    const productsSnapshot = await window.db.collection('products')
                        .where('storeId', '==', selectedStoreId)
                        .get();
                    
                    const products = productsSnapshot.docs.map(doc => doc.data());
                    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
                    
                    if (categories.length > 0) {
                        filterCategorySelect.disabled = false;
                        categories.forEach(cat => {
                            const option = document.createElement('option');
                            option.value = cat;
                            option.textContent = cat;
                            filterCategorySelect.appendChild(option);
                        });
                    }
                } catch (error) {
                    console.error('❌ Kategoriler yüklenemedi:', error);
                }
            } else {
                // ✅ Tüm ürünleri göster
                await renderProductsTable();
            }
        });
        
        // Kategori seçilince
        filterCategorySelect.addEventListener('change', async (e) => {
            const selectedStoreId = filterStoreSelect.value;
            const selectedCategory = e.target.value;
            
            if (selectedStoreId) {
                await filterAndDisplayProducts(selectedStoreId, selectedCategory);
            }
        });
        
        console.log('✅ Ürün filtreleme sistemi hazır');
    })();

    // ✅ Ürünleri filtrele ve göster
    async function filterAndDisplayProducts(storeId, category) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const productsTableBody = document.getElementById('products-table-body');
        
        if (!productsTableBody) {
            console.error('❌ products-table-body bulunamadı!');
            return;
        }
        
        loadingOverlay.style.display = 'flex';
        
        try {
            console.log('🔍 Filtreleme:', { storeId, category });
            
            // ✅ Mağazaya göre ürünleri çek
            let query = window.db.collection('products').where('storeId', '==', storeId);
            const productsSnapshot = await query.get();
            let products = productsSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            console.log(`📦 ${products.length} ürün bulundu`);
            
            // ✅ Kategori filtresi varsa uygula
            if (category) {
                products = products.filter(p => p.category === category);
                console.log(`🏷️ Kategoriye göre: ${products.length} ürün kaldı`);
            }
            
            // ✅ Mağaza bilgilerini çek
            const storesSnapshot = await window.db.collection('stores').get();
            const storesMap = {};
            storesSnapshot.docs.forEach(doc => {
                storesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            // ✅ Tabloyu temizle
            productsTableBody.innerHTML = '';
            
            if (products.length === 0) {
                productsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                            <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 10px;"></i>
                            <p>Bu filtrelerle ürün bulunamadı</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // ✅ Ürünleri tabloya ekle
            products.forEach(product => {
                const store = storesMap[product.storeId];
                const storeName = store ? store.name : 'Mağaza Bulunamadı';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.title}</td>
                    <td>${storeName}</td>
                    <td>${product.price}</td>
                    <td>${product.imageUrl ? `<img src="${product.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : 'Resim yok'}</td>
                    <td>
                        <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
            
            // ✅ Butonları yeniden bağla
            attachProductEventListeners();
            
            console.log('✅ Tablo güncellendi');
            
        } catch (error) {
            console.error('❌ Filtreleme hatası:', error);
            showNotification('Ürünler filtrelenirken hata oluştu!', false);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // Mağaza filtresini dinle
    document.addEventListener('DOMContentLoaded', () => {
        const filterStoreSelect = document.getElementById('filter-store-select');
        const filterCategorySelect = document.getElementById('filter-category-select');
        
        if (filterStoreSelect) {
            filterStoreSelect.addEventListener('change', async (e) => {
                const selectedStoreId = e.target.value;
                
                // Kategori filtresini sıfırla
                filterCategorySelect.innerHTML = '<option value="">Önce Mağaza Seçin</option>';
                filterCategorySelect.disabled = true;
                
                if (selectedStoreId) {
                    // Seçilen mağazanın ürünlerini çek
                    const productsSnapshot = await window.db.collection('products')
                        .where('storeId', '==', selectedStoreId)
                        .get();
                    
                    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    // Kategorileri çıkar
                    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
                    
                    if (categories.length > 0) {
                        filterCategorySelect.disabled = false;
                        filterCategorySelect.innerHTML = '<option value="">Tüm Kategoriler</option>';
                        categories.forEach(cat => {
                            const option = document.createElement('option');
                            option.value = cat;
                            option.textContent = cat;
                            filterCategorySelect.appendChild(option);
                        });
                    }
                    
                    // Ürünleri filtrele ve göster
                    filterProducts(selectedStoreId, null);
                } else {
                    // Tüm ürünleri göster
                    renderProductsTable();
                    startAutoRefresh();
                }
            });
            
            // Kategori değişince
            filterCategorySelect.addEventListener('change', (e) => {
                const selectedStoreId = filterStoreSelect.value;
                const selectedCategory = e.target.value;
                filterProducts(selectedStoreId, selectedCategory);
            });
        }
    });

    // --- YENİ: VERİLERİ OTOMATİK YENİLEME FONKSİYONU ---
    function startAutoRefresh() {
        const refreshInterval = 5 * 60 * 1000; 
        setInterval(async () => {
            console.log('🔄 Veriler 5 dakikada bir otomatik olarak yenileniyor...');
            try {
                await renderStoresTable();
                await renderProductsTable();
                await renderOrdersTable();
                updateDashboard();
            } catch (error) {
                console.error('Otomatik yenileme sırasında hata oluştu:', error);
            }
        }, refreshInterval);
    }

    // Sayfa yüklendiğinde otomatik yenilemeyi başlat
    document.addEventListener('DOMContentLoaded', () => {
        startAutoRefresh();
    });

    // ✅✅✅ BURAYA EKLE - KULLANICI YÖNETİMİ FONKSİYONLARI (KONUM 3) ✅✅✅
    // ===========================================================================

    // --- KULLANICI YÖNETİMİ FONKSİYONLARI ---
    document.addEventListener('DOMContentLoaded', () => {
        const userModal = document.getElementById('user-modal');
        const addUserBtn = document.getElementById('add-user-btn');
        const userForm = document.getElementById('user-form');
        const usersTableBody = document.getElementById('users-table-body');
        const cancelUser = document.getElementById('cancel-user');

        // Kullanıcıları listele
        const renderUsersTable = async () => {
            try {
                const usersSnapshot = await window.db.collection('users').get();
                const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                usersTableBody.innerHTML = '';
                
                if (users.length === 0) {
                    usersTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Henüz kullanıcı eklenmemiş.</td></tr>';
                    return;
                }

                users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.username}</td>
                        <td><span class="status ${user.role === 'admin' ? 'completed' : 'pending'}">${getRoleName(user.role)}</span></td>
                        <td>${user.permissions ? user.permissions.join(', ') : 'Yok'}</td>
                        <td>
                            <button class="btn-icon danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    usersTableBody.appendChild(row);
                });

                // Silme butonları
                document.querySelectorAll('.delete-user').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
                            await window.db.collection('users').doc(btn.getAttribute('data-id')).delete();
                            renderUsersTable();
                            showNotification('Kullanıcı silindi!');
                        }
                    });
                });
            } catch (error) {
                console.error('Kullanıcılar yüklenemedi:', error);
                showNotification('Kullanıcılar yüklenemedi!', false);
            }
        };

        // Rol adlarını çevir
        const getRoleName = (role) => {
            const roles = {
                'admin': 'Admin',
                'store_manager': 'Mağaza Yöneticisi',
                'product_manager': 'Ürün Yöneticisi',
                'order_manager': 'Sipariş Yöneticisi'
            };
            return roles[role] || role;
        };

        // Kullanıcı ekle modalı
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                document.getElementById('user-modal-title').textContent = 'Yeni Kullanıcı Ekle';
                userForm.reset();
                document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);
                userModal.style.display = 'block';
            });
        }

        // Rol değiştiğinde izinleri otomatik ayarla
        const userRoleSelect = document.getElementById('user-role');
        if (userRoleSelect) {
            userRoleSelect.addEventListener('change', (e) => {
                const role = e.target.value;
                const checkboxes = document.querySelectorAll('.permission-checkbox');
                
                if (role === 'admin') {
                    checkboxes.forEach(cb => cb.checked = true);
                } else if (role === 'store_manager') {
                    checkboxes.forEach(cb => {
                        cb.checked = ['dashboard', 'stores'].includes(cb.value);
                    });
                } else if (role === 'product_manager') {
                    checkboxes.forEach(cb => {
                        cb.checked = ['dashboard', 'products'].includes(cb.value);
                    });
                } else if (role === 'order_manager') {
                    checkboxes.forEach(cb => {
                        cb.checked = ['dashboard', 'orders'].includes(cb.value);
                    });
                }
            });
        }

        // Kullanıcı form submit
        if (userForm) {
            userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('user-username').value.trim();
                const password = document.getElementById('user-password').value.trim();
                const role = document.getElementById('user-role').value;
                const permissions = Array.from(document.querySelectorAll('.permission-checkbox:checked')).map(cb => cb.value);

                if (!username || !password) {
                    showNotification('Kullanıcı adı ve şifre gerekli!', false);
                    return;
                }

                try {
                    await window.db.collection('users').add({
                        username,
                        password, // ⚠️ Gerçek projede şifreyi hash'le!
                        role,
                        permissions,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    showNotification('Kullanıcı başarıyla eklendi!');
                    userModal.style.display = 'none';
                    renderUsersTable();
                } catch (error) {
                    console.error('Kullanıcı eklenemedi:', error);
                    showNotification('Kullanıcı eklenemedi!', false);
                }
            });
        }

        // İptal butonları
        if (cancelUser) {
            cancelUser.addEventListener('click', () => {
                userModal.style.display = 'none';
            });
        }

        // Modal kapatma
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Çıkış butonu güncelle
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // ✅ sessionStorage'dan temizle (localStorage değil!)
                sessionStorage.removeItem('adminUser');
                // ✅ replace kullan (geri tuşuyla dönmeyi engeller)
                window.location.replace('/login.html');
            });
        }

        // Sayfa yüklendiğinde kullanıcıları göster
        if (usersTableBody) {
            renderUsersTable();
        }
    });

// ===========================================================================

    // Ürünleri filtrele
    async function filterProducts(storeId, category) {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = 'flex';
        
        try {
            let query = window.db.collection('products');
            
            if (storeId) {
                query = query.where('storeId', '==', storeId);
            }
            
            const productsSnapshot = await query.get();
            let products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Kategori filtresi varsa
            if (category) {
                products = products.filter(p => p.category === category);
            }
            
            // Mağaza bilgilerini çek
            const storesSnapshot = await window.db.collection('stores').get();
            const storesMap = {};
            storesSnapshot.docs.forEach(doc => {
                storesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            // Tabloyu güncelle
            productsTableBody.innerHTML = '';
            products.forEach(product => {
                const store = storesMap[product.storeId];
                const storeName = store ? store.name : 'Mağaza Bulunamadı';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.title}</td>
                    <td>${storeName}</td>
                    <td>${product.price}</td>
                    <td>${product.imageUrl ? `<img src="${product.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : 'Resim yok'}</td>
                    <td>
                        <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
            
            attachProductEventListeners();
            
        } catch (error) {
            console.error('Ürünler filtrelemedi:', error);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
    
    // Bildirim göster
    const showNotification = (message, isSuccess = true) => {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isSuccess ? '#28a745' : '#dc3545'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    };

    // ✅ KULLANICI YÖNETİMİ FONKSİYONLARI - BURAYA EKLE
    
    // Kullanıcıları listele
    const renderUsersTable = async () => {
        if (!usersTableBody) return;
        
        try {
            const usersSnapshot = await window.db.collection('users').get();
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            usersTableBody.innerHTML = '';
            
            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Henüz kullanıcı eklenmemiş.</td></tr>';
                return;
            }

            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td><span class="status ${user.role === 'admin' ? 'completed' : 'pending'}">${getRoleName(user.role)}</span></td>
                    <td>${user.permissions ? user.permissions.join(', ') : 'Yok'}</td>
                    <td>
                        <button class="btn-icon danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });

            // Silme butonları
            document.querySelectorAll('.delete-user').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
                        await window.db.collection('users').doc(btn.getAttribute('data-id')).delete();
                        renderUsersTable();
                        showNotification('Kullanıcı silindi!');
                    }
                });
            });
        } catch (error) {
            console.error('Kullanıcılar yüklenemedi:', error);
            showNotification('Kullanıcılar yüklenemedi!', false);
        }
    };

    // Rol adlarını çevir
    const getRoleName = (role) => {
        const roles = {
            'admin': 'Admin',
            'store_manager': 'Mağaza Yöneticisi',
            'product_manager': 'Ürün Yöneticisi',
            'order_manager': 'Sipariş Yöneticisi'
        };
        return roles[role] || role;
    };

    // Kullanıcı ekle modalı aç
    const openUserModal = () => {
        if (!userModal) return;
        document.getElementById('user-modal-title').textContent = 'Yeni Kullanıcı Ekle';
        userForm.reset();
        document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);
        userModal.style.display = 'block';
    };

    // Kullanıcı ekle buton event
    if (addUserBtn) {
        addUserBtn.addEventListener('click', openUserModal);
    }

    // Rol değiştiğinde izinleri otomatik ayarla
    const userRoleSelect = document.getElementById('user-role');
    if (userRoleSelect) {
        userRoleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            const checkboxes = document.querySelectorAll('.permission-checkbox');
            
            if (role === 'admin') {
                checkboxes.forEach(cb => cb.checked = true);
            } else if (role === 'store_manager') {
                checkboxes.forEach(cb => {
                    cb.checked = ['dashboard', 'stores'].includes(cb.value);
                });
            } else if (role === 'product_manager') {
                checkboxes.forEach(cb => {
                    cb.checked = ['dashboard', 'products'].includes(cb.value);
                });
            } else if (role === 'order_manager') {
                checkboxes.forEach(cb => {
                    cb.checked = ['dashboard', 'orders'].includes(cb.value);
                });
            }
        });
    }

    // Kullanıcı form submit
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('user-username').value.trim();
            const password = document.getElementById('user-password').value.trim();
            const role = document.getElementById('user-role').value;
            const permissions = Array.from(document.querySelectorAll('.permission-checkbox:checked')).map(cb => cb.value);

            if (!username || !password) {
                showNotification('Kullanıcı adı ve şifre gerekli!', false);
                return;
            }

            try {
                await window.db.collection('users').add({
                    username,
                    password,
                    role,
                    permissions,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showNotification('Kullanıcı başarıyla eklendi!');
                userModal.style.display = 'none';
                renderUsersTable();
            } catch (error) {
                console.error('Kullanıcı eklenemedi:', error);
                showNotification('Kullanıcı eklenemedi!', false);
            }
        });
    }

    // İptal butonu
    if (cancelUser) {
        cancelUser.addEventListener('click', () => {
            if (userModal) userModal.style.display = 'none';
        });
    }

    // Tüm modalları kapat
    const closeAllModals = () => {
        storeModal.style.display = 'none';
        productModal.style.display = 'none';
        storeForm.reset();
        productForm.reset();
        productImage.value = '';
        productImagePreview.classList.remove('show');
        productImageStatus.classList.remove('show');
        editingStoreId = null;
        editingProductId = null;
        uploadedProductImageUrl = null;
        isSubmitting = false;
    };
    
    
    // Navigasyon
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const sectionId = link.getAttribute('data-section');
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
            
            pageTitle.textContent = link.textContent.trim();
        });
    });
    
    // Mağaza butonları
    if (addStoreBtn) {
        console.log('Mağaza Ekle butonu bulundu');
        addStoreBtn.addEventListener('click', (e) => {
            console.log('Mağaza Ekle butonuna tıklandı');
            e.preventDefault();
            openStoreModal();
        });
    } else {
        console.error('Mağaza Ekle butonu bulunamadı!');
    }
    
    storeForm.addEventListener('submit', handleStoreSubmit);
    
    // Ürün butonları
    if (addProductBtn) {
        console.log('Ürün Ekle butonu bulundu');
        addProductBtn.addEventListener('click', (e) => {
            console.log('Ürün Ekle butonuna tıklandı');
            e.preventDefault();
            openProductModal();
        });
    } else {
        console.error('Ürün Ekle butonu bulunamadı!');
    }
    
    productForm.addEventListener('submit', handleProductSubmit);
    
    // Modal kapatma
    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    cancelStore.addEventListener('click', closeAllModals);
    cancelProduct.addEventListener('click', closeAllModals);
    
    window.addEventListener('click', (e) => {
        if (e.target === storeModal || e.target === productModal) {
            closeAllModals();
        }
    });
    
    // Mobil menü
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            adminSidebar.classList.toggle('active');
        });
    }



    // Ürün ekle (Firestore)
    window.addProductToFirebase = async function(product) {
        const doc = await window.db.collection('products').add({
            storeId: product.storeId,
            title: product.title,
            price: product.price,
            description: product.description || '',
            material: product.material || '',
            category: product.category || '',
            isOnSale: product.isOnSale || false,
            originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: doc.id, ...product };
    };

    // Mağaza sil (Firestore)
    window.deleteStoreFromFirebase = async function(storeId) {
        const prods = await window.db.collection('products').where('storeId', '==', storeId).get();
        const batch = window.db.batch();
        prods.docs.forEach(d => batch.delete(d.ref));
        batch.delete(window.db.collection('stores').doc(storeId));
        await batch.commit();
    };

    // Ürün sil (Firestore)
    window.deleteProductFromFirebase = async function(productId) {
        await window.db.collection('products').doc(productId).delete();
    };

    // Tüm mağazaları getir (Firestore)
    window.getStoresFromFirebase = async function() {
        const snap = await window.db.collection('stores').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // Tüm ürünleri getir (Firestore)
    window.getProductsFromFirebase = async function() {
        const snap = await window.db.collection('products').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // Sayfa yüklendiğinde bekleyen siparişleri kontrol et
    processPendingOrders();
    
    // ✅ Tüm verileri yükleyen fonksiyon (loading ile)
    const loadAllData = async () => {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = loadingOverlay?.querySelector('.loading-text');
        
        try {
            if (loadingText) loadingText.textContent = 'Veriler yükleniyor...';
            
            // ✅ PARALEL İŞLEMLER: Verileri mümkün olduğunca paralel çek
            await Promise.all([
                loadCategories(), // Kategorileri yükle
                updateDashboard(), // Dashboard istatistikleri
                renderVisitorChart(), // Ziyaretçi grafiği
                renderStoresTable(), // Mağazalar
                renderProductsTable(), // Ürünler
                renderOrdersTable(), // Siparişler
                renderUsersTable(), // Kullanıcılar
                renderCategoriesTable(), // Kategori tablosu
                populateStoreSelect(), // Mağaza dropdown'ı
                populateStoreFilter() // Mağaza filtresi
            ]);
            
            console.log('✅ Tüm veriler başarıyla yüklendi');
            
            // ✅ Otomatik yenilemeyi başlat
            startAutoRefresh();
            console.log('✅ Otomatik yenileme aktif');
            
        } catch (error) {
            console.error('❌ Veriler yüklenemedi:', error);
            showNotification('Veriler yüklenemedi! Sayfayı yenileyin.', false);
        } finally {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none'; // Yükleniyor ekranını gizle
            }
        }
    };
    
    // ✅ Verileri yükle
    loadAllData();
});

// --- YENİ: VERİLERİ OTOMATİK YENİLEME FONKSİYONU ---
function startAutoRefresh() {
    const refreshInterval = 5 * 60 * 1000; // 5 dakika = 300.000 milisaniye

    setInterval(async () => {
        console.log('🔄 Veriler 5 dakikada bir otomatik olarak yenileniyor...');
        try {
            // Tabloları yenile
            await renderStoresTable();
            await renderProductsTable();
            await renderOrdersTable();
            updateDashboard(); // İstatistikleri güncelle
        } catch (error) {
            console.error('Otomatik yenileme sırasında hata oluştu:', error);
        }
    }, refreshInterval);
}
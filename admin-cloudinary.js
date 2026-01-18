
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
        
        // Superadmin: Her şeyi görür
        if (currentUser.role === 'superadmin') {
            link.style.display = 'flex';
        }
        // Admin: Users hariç her şeyi görür
        else if (currentUser.role === 'admin') {
            if (section === 'users') {
                link.style.display = 'none';
            } else {
                link.style.display = 'flex';
            }
        }
        // Diğer roller: Sadece permissions içindekileri görür
        else if (!currentUser.permissions.includes(section)) {
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

    // Kategori elemanları (iki seviyeli sistem)
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
                <td data-label="ID">${store.id}</td>
                <td data-label="Magazyn Ady">${store.name}</td>
                <td data-label="Haryt Sany">${storeProducts.length}</td>
                <td data-label="Etmekler">
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

        // ✅ Yeni: Phone ve Location
        const phoneInput = document.getElementById('store-phone');
        const locationInput = document.getElementById('store-location');
        const orderPhoneInput = document.getElementById('store-order-phone');
        if (phoneInput) phoneInput.value = store.phone || '';
        if (locationInput) locationInput.value = store.location || '';
        if (orderPhoneInput) orderPhoneInput.value = store.orderPhone || '';

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
 
    // ==================== İKİ SEVİYELİ KATEGORİ SİSTEMİ ====================
    
    // Ana kategori tablosunu güncelle
    async function renderParentCategoriesTable() {
        try {
            const categoriesSnapshot = await window.db.collection('parentCategories')
                .orderBy('order', 'asc')
                .get();
            
            const categories = categoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const tableBody = document.getElementById('parent-categories-table-body');
            tableBody.innerHTML = '';
            
            if (categories.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Henüz ana kategori eklenmemiş.</td></tr>';
                return;
            }
            
            categories.forEach(category => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Ady">${category.name}</td>
                    <td data-label="Icon"><i class="fas ${category.icon || 'fa-tag'}"></i></td>
                    <td data-label="Tertip">${category.order}</td>
                    <td data-label="Etmekler">
                        <button class="btn-icon edit-parent-category" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-parent-category" data-id="${category.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Event listeners
            document.querySelectorAll('.edit-parent-category').forEach(btn => {
                btn.addEventListener('click', () => editParentCategory(btn.getAttribute('data-id')));
            });
            
            document.querySelectorAll('.delete-parent-category').forEach(btn => {
                btn.addEventListener('click', () => deleteParentCategory(btn.getAttribute('data-id')));
            });
            
        } catch (error) {
            console.error('Ana kategori tablosu yüklenemedi:', error);
        }
    }

    // Alt kategori tablosunu güncelle
    async function renderSubcategoriesTable() {
        try {
            const subcategoriesSnapshot = await window.db.collection('subcategories')
                .orderBy('order', 'asc')
                .get();
            
            const subcategories = subcategoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const parentsSnapshot = await window.db.collection('parentCategories').get();
            const parentCategories = parentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const tableBody = document.getElementById('subcategories-table-body');
            tableBody.innerHTML = '';
            
            if (subcategories.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Henüz alt kategori eklenmemiş.</td></tr>';
                return;
            }
            
            subcategories.forEach(subcategory => {
                const parent = parentCategories.find(p => p.id === subcategory.parentId);
                const parentName = parent ? parent.name : 'Bilinmiyor';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Ady">${subcategory.name}</td>
                    <td data-label="Ana Kategori">${parentName}</td>
                    <td data-label="Tertip">${subcategory.order}</td>
                    <td data-label="Etmekler">
                        <button class="btn-icon edit-subcategory" data-id="${subcategory.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-subcategory" data-id="${subcategory.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Event listeners
            document.querySelectorAll('.edit-subcategory').forEach(btn => {
                btn.addEventListener('click', () => editSubcategory(btn.getAttribute('data-id')));
            });
            
            document.querySelectorAll('.delete-subcategory').forEach(btn => {
                btn.addEventListener('click', () => deleteSubcategory(btn.getAttribute('data-id')));
            });
            
        } catch (error) {
            console.error('Alt kategori tablosu yüklenemedi:', error);
        }
    }

    // Kategorileri mağaza dropdown'una yükle
    async function loadCategories() {
        try {
            const subcategoriesSnapshot = await window.db.collection('subcategories')
                .orderBy('order', 'asc')
                .get();
            
            const parentsSnapshot = await window.db.collection('parentCategories').get();
            const parentCategories = parentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const subcategories = subcategoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Dropdown'u doldur (önce ana kategoriler, sonra alt kategoriler)
            storeCategorySelect.innerHTML = '<option value="">Kategoriýa saýlaň (opsiýonel)</option>';

            // Önce ana kategorileri ekle
            parentCategories.forEach(parent => {
                const option = document.createElement('option');
                option.value = parent.id;
                option.textContent = parent.name;
                storeCategorySelect.appendChild(option);
            });

            // Sonra alt kategorileri ekle
            subcategories.forEach(sub => {
                const parent = parentCategories.find(p => p.id === sub.parentId);
                if (parent) {
                    const option = document.createElement('option');
                    option.value = sub.id;
                    option.textContent = `${parent.name} > ${sub.name}`;
                    storeCategorySelect.appendChild(option);
                }
            });
            
            return subcategories;
        } catch (error) {
            console.error('Kategoriler yüklenemedi:', error);
            return [];
        }
    }

    // Ana kategori ekle/düzenle
    async function editParentCategory(categoryId) {
        try {
            const doc = await window.db.collection('parentCategories').doc(categoryId).get();
            if (!doc.exists) {
                showNotification('Kategori bulunamadı!', false);
                return;
            }
            
            const category = doc.data();
            
            document.getElementById('parent-category-modal-title').textContent = 'Ana Kategori Düzenle';
            document.getElementById('parent-category-id').value = categoryId;
            document.getElementById('parent-category-name').value = category.name;
            document.getElementById('parent-category-order').value = category.order;
            selectParentCategoryIcon(category.icon || 'fa-tag');
            
            document.getElementById('parent-category-modal').style.display = 'block';
            
        } catch (error) {
            console.error('Kategori düzenlenemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    }

    async function deleteParentCategory(categoryId) {
        // Önce alt kategorileri kontrol et
        const subcategoriesSnapshot = await window.db.collection('subcategories')
            .where('parentId', '==', categoryId)
            .get();
        
        if (!subcategoriesSnapshot.empty) {
            showNotification('Bu ana kategorinin alt kategorileri var, önce silmelisiniz!', false);
            return;
        }
        
        if (!confirm('Bu ana kategoriyi silmek istediğinizden emin misiniz?')) return;
        
        try {
            await window.db.collection('parentCategories').doc(categoryId).delete();
            showNotification('Ana kategori silindi!');
            renderParentCategoriesTable();
        } catch (error) {
            console.error('Ana kategori silinemedi:', error);
            showNotification('Ana kategori silinemedi!', false);
        }
    }

    // Alt kategori ekle/düzenle
    async function editSubcategory(subcategoryId) {
        try {
            const doc = await window.db.collection('subcategories').doc(subcategoryId).get();
            if (!doc.exists) {
                showNotification('Alt kategori bulunamadı!', false);
                return;
            }
            
            const subcategory = doc.data();
            
            document.getElementById('subcategory-modal-title').textContent = 'Alt Kategori Düzenle';
            document.getElementById('subcategory-id').value = subcategoryId;
            document.getElementById('subcategory-name').value = subcategory.name;
            document.getElementById('subcategory-parent').value = subcategory.parentId;
            document.getElementById('subcategory-order').value = subcategory.order;
            
            document.getElementById('subcategory-modal').style.display = 'block';
            
        } catch (error) {
            console.error('Alt kategori düzenlenemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    }

    async function deleteSubcategory(subcategoryId) {
        // Önce mağazaları kontrol et
        const storesSnapshot = await window.db.collection('stores')
            .where('category', '==', subcategoryId)
            .get();
        
        if (!storesSnapshot.empty) {
            showNotification('Bu alt kategoride mağazalar var, önce silmelisiniz!', false);
            return;
        }
        
        if (!confirm('Bu alt kategoriyi silmek istediğinizden emin misiniz?')) return;
        
        try {
            await window.db.collection('subcategories').doc(subcategoryId).delete();
            showNotification('Alt kategori silindi!');
            renderSubcategoriesTable();
        } catch (error) {
            console.error('Alt kategori silinemedi:', error);
            showNotification('Alt kategori silinemedi!', false);
        }
    }

    // Ana kategori form submit
    document.getElementById('parent-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoryId = document.getElementById('parent-category-id').value;
        const name = document.getElementById('parent-category-name').value.trim();
        const icon = document.getElementById('parent-category-icon').value || 'fa-tag';
        const order = parseInt(document.getElementById('parent-category-order').value) || 1;
        
        if (!name) {
            showNotification('Kategori adı gerekli!', false);
            return;
        }
        
        // ID oluştur
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
                await window.db.collection('parentCategories').doc(categoryId).update({
                    name: name,
                    icon: icon,
                    order: order
                });
                showNotification('Ana kategori güncellendi!');
            } else {
                await window.db.collection('parentCategories').doc(id).set({
                    name: name,
                    icon: icon,
                    order: order,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showNotification('Ana kategori eklendi!');
            }
            
            document.getElementById('parent-category-modal').style.display = 'none';
            document.getElementById('parent-category-form').reset();
            renderParentCategoriesTable();
            populateSubcategoryParentDropdown();
            loadCategories();
            
        } catch (error) {
            console.error('Ana kategori kaydedilemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    });

    // Alt kategori form submit
    document.getElementById('subcategory-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const subcategoryId = document.getElementById('subcategory-id').value;
        const name = document.getElementById('subcategory-name').value.trim();
        const parentId = document.getElementById('subcategory-parent').value;
        const order = parseInt(document.getElementById('subcategory-order').value) || 1;
        
        if (!name || !parentId) {
            showNotification('Kategori adı ve ana kategori gerekli!', false);
            return;
        }
        
        // ID oluştur
        const id = subcategoryId || name
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
            if (subcategoryId) {
                await window.db.collection('subcategories').doc(subcategoryId).update({
                    name: name,
                    parentId: parentId,
                    order: order
                });
                showNotification('Alt kategori güncellendi!');
            } else {
                await window.db.collection('subcategories').doc(id).set({
                    name: name,
                    parentId: parentId,
                    order: order,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showNotification('Alt kategori eklendi!');
            }
            
            document.getElementById('subcategory-modal').style.display = 'none';
            document.getElementById('subcategory-form').reset();
            renderSubcategoriesTable();
            loadCategories();
            
        } catch (error) {
            console.error('Alt kategori kaydedilemedi:', error);
            showNotification('Bir hata oluştu!', false);
        }
    });

    // Ana kategori dropdown'unu doldur
    async function populateSubcategoryParentDropdown() {
        const select = document.getElementById('subcategory-parent');
        select.innerHTML = '<option value="">Ana kategori seçin</option>';
        
        const snapshot = await window.db.collection('parentCategories')
            .orderBy('order', 'asc')
            .get();
        
        snapshot.docs.forEach(doc => {
            const category = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    // Ana kategori modal kontrolleri
    document.getElementById('add-parent-category-btn').addEventListener('click', () => {
        document.getElementById('parent-category-modal-title').textContent = 'Ana Kategori Ekle';
        document.getElementById('parent-category-form').reset();
        document.getElementById('parent-category-id').value = '';
        document.getElementById('parent-category-icon').value = 'fa-tag';
        selectParentCategoryIcon('fa-tag');
        document.getElementById('parent-category-modal').style.display = 'block';
    });

    document.getElementById('cancel-parent-category').addEventListener('click', () => {
        document.getElementById('parent-category-modal').style.display = 'none';
    });

    // Alt kategori modal kontrolleri
    document.getElementById('add-subcategory-btn').addEventListener('click', () => {
        document.getElementById('subcategory-modal-title').textContent = 'Alt Kategori Ekle';
        document.getElementById('subcategory-form').reset();
        document.getElementById('subcategory-id').value = '';
        populateSubcategoryParentDropdown();
        document.getElementById('subcategory-modal').style.display = 'block';
    });

    document.getElementById('cancel-subcategory').addEventListener('click', () => {
        document.getElementById('subcategory-modal').style.display = 'none';
    });

    // Ana kategori ikonları
    const categoryIcons = [
        'fa-tag', 'fa-tshirt', 'fa-shirt', 'fa-user-tie', 'fa-user-ninja',
        'fa-user-astronaut', 'fa-vest', 'fa-socks', 'fa-hat-cowboy', 'fa-hat-wizard',
        'fa-glasses', 'fa-gem', 'fa-gift', 'fa-bag-shopping', 'fa-basket-shopping',
        'fa-box', 'fa-box-open', 'fa-boxes-stacked', 'fa-boxes-packing', 'fa-cubes',
        'fa-heart', 'fa-star', 'fa-bolt', 'fa-fire', 'fa-sun',
        'fa-moon', 'fa-cloud', 'fa-snowflake', 'fa-wind', 'fa-umbrella',
        'fa-tree', 'fa-leaf', 'fa-seedling', 'fa-flower', 'fa-paw',
        'fa-cat', 'fa-dog', 'fa-fish', 'fa-dragon', 'fa-crow',
        'fa-car', 'fa-bus', 'fa-train', 'fa-plane', 'fa-ship',
        'fa-bicycle', 'fa-motorcycle', 'fa-truck', 'fa-rocket', 'fa-bus-simple',
        'fa-home', 'fa-building', 'fa-city', 'fa-landmark', 'fa-warehouse',
        'fa-store', 'fa-shop', 'fa-market', 'fa-shopping-bag', 'fa-shopping-cart',
        'fa-wallet', 'fa-credit-card', 'fa-money-bill', 'fa-coins', 'fa-globe',
        'fa-mobile-screen', 'fa-laptop', 'fa-tablet-screen-button', 'fa-desktop', 'fa-tv',
        'fa-camera', 'fa-music', 'fa-film', 'fa-video', 'fa-gamepad',
        'fa-book', 'fa-newspaper', 'fa-pen', 'fa-paintbrush', 'fa-palette',
        'fa-utensils', 'fa-mug-hot', 'fa-ice-cream', 'fa-pizza-slice', 'fa-burger'
    ];
    
    function loadParentCategoryIcons() {
        const iconGrid = document.getElementById('parent-category-icon-grid');
        if (!iconGrid) return;
        
        iconGrid.innerHTML = categoryIcons.map(icon => `
            <div class="icon-item" data-icon="${icon}" onclick="selectParentCategoryIcon('${icon}')">
                <i class="fas ${icon}"></i>
            </div>
        `).join('');
    }
    
    window.selectParentCategoryIcon = function(icon) {
        const iconInput = document.getElementById('parent-category-icon');
        if (iconInput) iconInput.value = icon;
        
        const display = document.getElementById('parent-selected-icon-display');
        if (display) {
            display.innerHTML = `<i class="fas ${icon}"></i>`;
        }
        
        document.querySelectorAll('#parent-category-icon-grid .icon-item').forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-icon') === icon);
        });
    };
    
    loadParentCategoryIcons();
    
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
        const phone = document.getElementById('store-phone')?.value.trim() || '';
        const location = document.getElementById('store-location')?.value.trim() || '';
        const orderPhone = document.getElementById('store-order-phone')?.value.trim() || '';

        if (!name) {
            showNotification('Mağaza ady gerekli!', false);
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
                    instagram,
                    phone,
                    location,
                    orderPhone
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
                    instagram,
                    phone,
                    location,
                    orderPhone
                });
                showNotification('Mağaza eklendi!');
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
                    <td data-label="ID">${product.id}</td>
                    <td data-label="Haryt Ady">${product.title}</td>
                    <td data-label="Magazyn">${storeName}</td>
                    <td data-label="Bahasy">${product.price}</td>
                    <td data-label="Surat">${product.imageUrl ? `<img src="${product.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : 'Resim yok'}</td>
                    <td data-label="Etmekler">
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
                        <td data-label="Harytlar">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${order.items.map(item => `<li>ID: ${item.id}</li>`).join('')}
                            </ul>
                        </td>
                        <td data-label="Ady">${order.customer.name}</td>
                        <td data-label="Telefony">${order.customer.phone}</td>
                        <td data-label="Salgysy">${order.customer.address}</td>
                        <td data-label="Magazynlar">${storeNames}</td>
                        <td data-label="Taryhy">${new Date(order.date).toLocaleString('tr-TR')}</td>
                        <td data-label="Durum"><span class="status pending">Garaşylýar</span></td>
                        <td data-label="Etmekler">
                            <input type="text" id="number-input-${order.id}" placeholder="Sipariş No" style="width: 100px; padding: 5px;">
                            <button class="btn-icon" onclick="assignOrderNumber('${order.id}')" title="Numara Ata ve SMS Gönder">
                                <i class="fas fa-check"></i>
                            </button>
                        </td>
                    `;
                } else {
                    row.innerHTML = `
                        <td data-label="Harytlar">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${order.items.map(item => `<li>ID: ${item.id}</li>`).join('')}
                            </ul>
                        </td>
                        <td data-label="Ady">${order.customer.name}</td>
                        <td data-label="Telefony">${order.customer.phone}</td>
                        <td data-label="Salgysy">${order.customer.address}</td>
                        <td data-label="Magazynlar">${storeNames}</td>
                        <td data-label="Taryhy">${new Date(order.date).toLocaleString('tr-TR')}</td>
                        <td data-label="Durum"><span class="status completed">Onaylandı</span></td>
                        <td data-label="Zakaz No"><strong>${order.orderNumber}</strong></td>
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
            
            // Animasyon için active class'ı ekle
            const chartContainer = document.querySelector('.visitor-chart-container');
            if (chartContainer) {
                chartContainer.classList.add('active');
            }
            
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
                        <td data-label="Ulanyjy Ady">${user.username}</td>
                        <td data-label="Rol"><span class="status ${user.role}">${getRoleName(user.role)}</span></td>
                        <td data-label="Rugsatlar">${user.permissions ? user.permissions.join(', ') : 'Yok'}</td>
                        <td data-label="Etmekler">
                            <button class="btn-icon danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    usersTableBody.appendChild(row);
                });

                // Silme butonları
                document.querySelectorAll('.delete-user').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const userId = btn.getAttribute('data-id');
                        const user = users.find(u => u.id === userId);
                        
                        if (user.role === 'superadmin') {
                            showNotification('Super Admin silinemez!', false);
                            return;
                        }
                        
                        if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
                            await window.db.collection('users').doc(userId).delete();
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
                'superadmin': 'Super Admin',
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
                
                if (role === 'superadmin') {
                    checkboxes.forEach(cb => cb.checked = true);
                } else if (role === 'admin') {
                    checkboxes.forEach(cb => {
                        cb.checked = cb.value !== 'users';
                    });
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
            } else if (role === 'superadmin') {
                checkboxes.forEach(cb => cb.checked = true);
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
                    <td><span class="status ${user.role}">${getRoleName(user.role)}</span></td>
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
                    const userId = btn.getAttribute('data-id');
                    const user = users.find(u => u.id === userId);
                    
                    if (user.role === 'superadmin') {
                        showNotification('Super Admin silinemez!', false);
                        return;
                    }
                    
                    if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
                        await window.db.collection('users').doc(userId).delete();
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
            'superadmin': 'Super Admin',
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
        document.getElementById('user-modal-title').textContent = 'Täze ulanyjy goş';
        userForm.reset();
        document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);
        userModal.style.display = 'block';
    };

    // Kullanıcı ekle buton event
    if (addUserBtn) {
        addUserBtn.addEventListener('click', openUserModal);
    }

    // Mobil kullanıcı ekle butonu
    const addUserBtnMobile = document.getElementById('add-user-btn-mobile');
    if (addUserBtnMobile) {
        addUserBtnMobile.addEventListener('click', openUserModal);
    }

    // Rol değiştiğinde izinleri otomatik ayarla
    const userRoleSelect = document.getElementById('user-role');
    if (userRoleSelect) {
        userRoleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            const checkboxes = document.querySelectorAll('.permission-checkbox');
            
            if (role === 'superadmin') {
                checkboxes.forEach(cb => cb.checked = true);
            } else if (role === 'admin') {
                checkboxes.forEach(cb => {
                    cb.checked = cb.value !== 'users';
                });
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
            
            // Mobilde menüyü kapat
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
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

    // Mobil mağaza butonu
    const addStoreBtnMobile = document.getElementById('add-store-btn-mobile');
    if (addStoreBtnMobile) {
        addStoreBtnMobile.addEventListener('click', (e) => {
            e.preventDefault();
            openStoreModal();
        });
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

    // Mobil ürün butonu
    const addProductBtnMobile = document.getElementById('add-product-btn-mobile');
    if (addProductBtnMobile) {
        addProductBtnMobile.addEventListener('click', (e) => {
            e.preventDefault();
            openProductModal();
        });
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
            
            // Overlay'i göster/gizle
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) {
                overlay.classList.toggle('active');
            }
            
            // Mobilde body scroll'u engelle
            document.body.style.overflow = adminSidebar.classList.contains('active') ? 'hidden' : 'auto';
        });
    }
    
    // Sidebar overlay tıklanınca kapat
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            closeSidebar();
        });
    }
    
    // Sidebar'ı kapatma fonksiyonu
    function closeSidebar() {
        adminSidebar.classList.remove('active');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        // Body scroll'u düzelt
        document.body.style.overflow = 'auto';
    }
    
    // Mobilde sayfa yüklenince menüyü kapat
    if (window.innerWidth <= 768) {
        adminSidebar.classList.remove('active');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
    
    // Sidebar kapatma butonu
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            closeSidebar();
        });
    }
    
    // Pencere boyutu değişince menüyü düzelt
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            adminSidebar.classList.remove('active');
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    });



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
                renderParentCategoriesTable(), // Ana kategori tablosu
                renderSubcategoriesTable(), // Alt kategori tablosu
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

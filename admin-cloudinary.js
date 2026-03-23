// ✅ GLOBAL VERİ DEĞİŞKENLERİ (starAutoRefresh ve DOMContentLoaded içinden erişilmesi için dosyanın başında)
let globalStores = [];
let globalProducts = [];
let globalOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin paneli yükleniyor...');

    // ✅ LOADING EKRANI GÖSTERİLİYOR (loadAllData biterken gizlenecek)
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    // ✅ localStorage'dan kullanıcıyı al (iOS Safari uyumluluğu için)
    let currentUser = null;
    try {
        const parsed = JSON.parse(localStorage.getItem('adminUser'));
        const now = Date.now();
        const expiresAt = Number(parsed?.sessionExpiresAt || 0);
        const hasValidSession = parsed
            && typeof parsed === 'object'
            && !!parsed.username
            && Number.isFinite(expiresAt)
            && expiresAt > now;

        if (hasValidSession) {
            currentUser = parsed;
        }
    } catch (error) {
        console.warn('Admin oturumu okunamadı:', error);
    }

    // Eğer kullanıcı yoksa veya oturum süresi dolduysa login'e yönlendir
    if (!currentUser) {
        localStorage.removeItem('adminUser');
        window.location.replace('/login');
        return; // Kodun devam etmesini engelle
    }

    // ✅ YENİ: Admin SKELETON fonksiyonu
    window.showTableSkeleton = (tableBodyId, columnsCount = 5, rowsCount = 4) => {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;

        tbody.innerHTML = '';
        for (let i = 0; i < rowsCount; i++) {
            const tr = document.createElement('tr');

            let tds = '';
            for (let j = 0; j < columnsCount; j++) {
                tds += `<td><div style="width: 100%; height: 20px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: skeletonLoading 1.5s infinite; border-radius: 4px;"></div></td>`;
            }

            tr.innerHTML = tds;
            tbody.appendChild(tr);
        }
    };

    // ✅ YENİ: Dashboard (Ana Ekran) Skeleton Fonksiyonları
    window.showDashboardSkeleton = () => {
        const statCards = document.querySelectorAll('.stat-info h3');
        statCards.forEach(card => {
            card.innerHTML = `<div style="width: 60px; height: 30px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: skeletonLoading 1.5s infinite; border-radius: 4px; display: inline-block;"></div>`;
        });

        const chartCards = document.querySelectorAll('.chart-card canvas');
        chartCards.forEach(canvas => {
            // Canvas parent'ına skeleton class ekle
            canvas.parentElement.classList.add('skeleton-box-active');
        });
    };

    window.hideDashboardSkeleton = () => {
        const chartCards = document.querySelectorAll('.chart-card');
        chartCards.forEach(card => {
            card.classList.remove('skeleton-box-active');
        });
    };

    console.log('✅ Giriş yapan kullanıcı:', currentUser.username);

    // DOM elemanları

    const productIsOnSale = document.getElementById('product-is-on-sale');
    const originalPriceGroup = document.getElementById('original-price-group');
    const productOriginalPrice = document.getElementById('product-original-price');
    const navLinks = document.querySelectorAll('.nav-link');

    // Rezervasyon elemanları
    const reservationStoreSelect = document.getElementById('reservation-store-select');
    const addReservationPackageBtn = document.getElementById('add-reservation-package-btn');
    const reservationPackagesContainer = document.getElementById('reservation-packages-container');
    const reservationPackagesList = document.getElementById('reservation-packages-list');
    const reservationPackagesTableBody = document.getElementById('reservation-packages-table-body');
    const reservationPackageModal = document.getElementById('reservation-package-modal');
    const reservationPackageForm = document.getElementById('reservation-package-form');
    const cancelPackage = document.getElementById('cancel-package');

    // Bron elemanları
    const bronStoreSelect = document.getElementById('bron-store-select');
    const openBronSettingsBtn = document.getElementById('open-bron-settings-btn');
    const bronContentPlaceholder = document.getElementById('bron-content-placeholder');
    const bronContentArea = document.getElementById('bron-content-area');
    const refreshBronTableBtn = document.getElementById('refresh-bron-table-btn');

    const bronSettingsModal = document.getElementById('bron-settings-modal');
    const bronSettingsForm = document.getElementById('bron-settings-form');
    const bronSettingsSchemaImage = document.getElementById('bron-settings-schema-image');
    const bronSettingsSchemaPreview = document.getElementById('bron-settings-schema-preview');
    const bronSettingsSchemaUrl = document.getElementById('bron-settings-schema-url');
    const bronSettingsTableItems = document.getElementById('bron-settings-table-items');
    const addBronTableItemBtn = document.getElementById('add-bron-table-item');
    const bronTableCountInput = document.getElementById('bron-table-count-input');
    const cancelBronSettings = document.getElementById('cancel-bron-settings');

    let currentReservationStoreId = null;
    let currentBronStoreId = null;
    let editingPackageId = null;

    // (globalStores, globalProducts, globalOrders dosya başında tanımlandı)

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

    // Rezervasyon Butonları
    const addReservationPackageBtn_2 = document.getElementById('add-reservation-package-btn'); // Duplicate for safety if needed, but I'll use the one above

    // Kategori elemanları (iki seviyeli sistem)
    const storeCategorySelect = document.getElementById('store-category');

    // Excel export/import
    const exportProductsBtn = document.getElementById('export-products-btn');
    const importProductsBtn = document.getElementById('import-products-btn');
    const importProductsInput = document.getElementById('import-products-input');

    const exportStoresBtn = document.getElementById('export-stores-btn');
    const importStoresBtn = document.getElementById('import-stores-btn');
    const importStoresInput = document.getElementById('import-stores-input');

    // Dosya yükleme
    const productImage = document.getElementById('product-image');
    const productImagePreview = document.getElementById('product-image-preview');
    const productImageStatus = document.getElementById('product-image-status');

    // Bron elemanları
    const bronTableBody = document.getElementById('bron-table-body');
    const storeSchemaImage = document.getElementById('store-schema-image');
    const storeSchemaPreview = document.getElementById('store-schema-preview');
    const storeSchemaUrl = document.getElementById('store-schema-url');

    let editingStoreId = null;
    let editingProductId = null;
    let uploadedProductImageUrl = null;
    let uploadedSchemaUrl = null;

    // Form gönderme kontrolü
    let isSubmitting = false;

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');

            // Aktif linki değiştir
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Bölümleri göster/gizle
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });

            // Sayfa başlığını güncelle
            const text = link.querySelector('span')?.textContent || link.textContent.trim();
            pageTitle.textContent = text;

            // ✅ OPTİMİZASYON: Önce cache'i kullan, cache yoksa Firebase'den çek
            if (sectionId === 'stores') {
                renderStoresTable(globalStores.length ? globalStores : null, globalProducts.length ? globalProducts : null);
            }
            if (sectionId === 'products') {
                renderProductsTable(globalProducts.length ? globalProducts : null, globalStores.length ? globalStores : null);
            }
            if (sectionId === 'orders') {
                renderOrdersTable(globalOrders.length ? globalOrders : null, globalProducts.length ? globalProducts : null, globalStores.length ? globalStores : null);
            }
            if (sectionId === 'users') renderUsersTable();
            if (sectionId === 'categories') {
                renderParentCategoriesTable();
                renderSubcategoriesTable();
            }
            if (sectionId === 'reservations') renderReservationStores();
            if (sectionId === 'bron-management') renderBronStores();

            // Mobilde sidebar'ı kapat
            if (window.innerWidth <= 1024) {
                adminSidebar.classList.remove('active');
            }
        });
    });



    function getOptimizedImageUrl(url, width = 400) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        // HTTP'yi HTTPS'e zorla
        if (url.startsWith('http://')) url = url.replace('http://', 'https://');

        // Cloudflare R2 veya diğer URL'leri olduğu gibi döndür (HTTPS zorunlu)
        return url;
    }
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
    // ✅ DÜZELTME BUG 4: Fonksiyon async yapıldı + Firebase'e doğrudan güncelleme.
    // Eski sorunlar:
    //   1) getOrders() async bir metottu ama await kullanılmıyordu → Promise dönüyordu,
    //      üzerinde .find() çağrısı hata fırlatıyordu.
    //   2) saveToLocalStorage() adlı metot ShowlyDB'de hiç tanımlı değildi → çalışmıyordu.
    //   3) Sonuç: sipariş numarası hiçbir zaman kaydedilmiyordu.
    window.assignOrderNumber = async (orderId) => {
        const inputElement = document.getElementById(`number-input-${orderId}`);
        const orderNumber = inputElement?.value.trim();

        if (!orderNumber) {
            alert('Lütfen bir sipariş numarası girin.');
            return;
        }

        try {
            // Firebase'de doğrudan güncelle (await ile!)
            await window.db.collection('orders').doc(orderId).update({
                orderNumber: orderNumber,
                status: 'confirmed'
            });

            console.log(`✅ Sipariş ${orderId} için numara atandı: ${orderNumber}`);
            showNotification(`Sipariş ${orderId} için numara başarıyla atandı: ${orderNumber}`);
            renderOrdersTable(); // Tabloyu yenile
        } catch (err) {
            console.error('❌ Sipariş numarası kaydedilemedi:', err);
            alert('Sipariş numarası kaydedilirken hata oluştu: ' + err.message);
        }
    };

    // --- YÜKLEME FONKSİYONLARI ---

    // Backup butonları
    document.getElementById('backup-excel-btn')?.addEventListener('click', () => {
        exportAndBackupToExcel();
        showNotification('Excel yedek oluşturuldu!');
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
        if (!element) return;
        element.textContent = message;
        element.className = `upload-status show ${isSuccess ? 'success' : 'error'}`;
    };

    // Şema resmi önizleme
    storeSchemaImage?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                storeSchemaPreview.src = event.target.result;
                storeSchemaPreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        }
    });

    // Bron mağazalarını seçeneğe ekle
    const renderBronStores = async () => {
        if (!bronStoreSelect) return;
        const stores = await window.showlyDB.getStores();
        const bronStores = stores.filter(s => s.hasBron === true || s.hasBron === 'true');

        bronStoreSelect.innerHTML = '<option value="">Magazyn saýlaň...</option>';
        bronStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            bronStoreSelect.appendChild(option);
        });

        if (currentBronStoreId) {
            bronStoreSelect.value = currentBronStoreId;
        }
    };

    // Bron mağaza seçildiğinde
    bronStoreSelect?.addEventListener('change', (e) => {
        currentBronStoreId = e.target.value;
        if (currentBronStoreId) {
            bronContentPlaceholder.style.display = 'none';
            bronContentArea.style.display = 'block';
            if (openBronSettingsBtn) openBronSettingsBtn.style.display = 'block';
            if (refreshBronTableBtn) refreshBronTableBtn.style.display = 'block'; // ✅ Yeni butonu göster
            renderBronTable();
        } else {
            bronContentPlaceholder.style.display = 'block';
            bronContentArea.style.display = 'none';
            if (openBronSettingsBtn) openBronSettingsBtn.style.display = 'none';
            if (refreshBronTableBtn) refreshBronTableBtn.style.display = 'none'; // ✅ Yeni butonu gizle
        }
    });

    // Bron Tablosunu Manuel Yenile
    refreshBronTableBtn?.addEventListener('click', () => {
        renderBronTable();
    });

    // Bron Sazlamalary Aç
    openBronSettingsBtn?.addEventListener('click', async () => {
        if (!currentBronStoreId) return;
        const storeId = currentBronStoreId;

        // ✅ Hemen temizle (Yükleme sırasında eski veri görünmesin)
        bronSettingsSchemaPreview.src = '';
        bronSettingsSchemaPreview.classList.remove('show');
        bronSettingsSchemaUrl.value = '';
        bronSettingsTableItems.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</div>';

        try {
            // ✅ Zorlamalı taze veri çek (globalStores bazen gecikebilir)
            const doc = await window.db.collection('stores').doc(storeId).get({ source: 'server' });
            if (!doc.exists) return;
            const store = { id: doc.id, ...doc.data() };
            console.log('📖 Bron ayarları açılıyor. Mağaza:', store.name);

            // Mevcut verileri yükle
            if (store.restaurantSchemaUrl) {
                bronSettingsSchemaPreview.src = store.restaurantSchemaUrl;
                bronSettingsSchemaPreview.classList.add('show');
                bronSettingsSchemaUrl.value = store.restaurantSchemaUrl;
            }

            // Clear the loading spinner and then add tables
            bronSettingsTableItems.innerHTML = '';

            if (Array.isArray(store.tables) && store.tables.length > 0) {
                store.tables.forEach(table => {
                    bronSettingsTableItems.appendChild(createBronTableUI(table));
                });
            } else {
                // En az bir boş satır ekle
                bronSettingsTableItems.appendChild(createBronTableUI(''));
            }

            bronSettingsModal.style.display = 'block';
        } catch (error) {
            console.error('Bron ayarları yüklenemedi:', error);
            showNotification('Hata oluştu!', false);
        }
    });

    function createBronTableUI(tableValue = '') {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" class="bron-table-input" required value="${tableValue}" placeholder="Örn: Stol 1" style="flex: 1;">
            <button type="button" class="btn-remove-row"><i class="fas fa-minus-circle"></i> Poz</button>
        `;
        row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
        return row;
    }

    addBronTableItemBtn?.addEventListener('click', () => {
        const count = parseInt(bronTableCountInput?.value) || 1;

        for (let i = 0; i < count; i++) {
            const currentInputs = bronSettingsTableItems.querySelectorAll('.bron-table-input');
            let maxNum = 0;
            currentInputs.forEach(input => {
                const val = input.value;
                const numMatch = val.match(/\d+/);
                if (numMatch) {
                    const num = parseInt(numMatch[0]);
                    if (num > maxNum) maxNum = num;
                }
            });
            const nextNumber = maxNum + 1;
            bronSettingsTableItems.appendChild(createBronTableUI(`Stol ${nextNumber}`));
        }

        // Input'u sıfırla (isteğe bağlı)
        if (bronTableCountInput) bronTableCountInput.value = 1;
    });

    bronSettingsSchemaImage?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                bronSettingsSchemaPreview.src = event.target.result;
                bronSettingsSchemaPreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        }
    });

    bronSettingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentBronStoreId) return;

        const submitBtn = bronSettingsForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ýüklenýär...';

            let schemaUrl = bronSettingsSchemaUrl.value;

            // Eğer yeni bir görsel seçildiyse yükle
            if (bronSettingsSchemaImage.files[0]) {
                schemaUrl = await window.uploadToR2(bronSettingsSchemaImage.files[0], `BronSchemas_${currentBronStoreId}`);
            }

            const tables = Array.from(bronSettingsTableItems.querySelectorAll('.bron-table-input'))
                .map(input => input.value.trim())
                .filter(val => val !== '');

            await window.db.collection('stores').doc(currentBronStoreId).update({
                restaurantSchemaUrl: schemaUrl,
                tables: tables,
                hasBron: true
            });

            console.log('✅ Bron sazlamalary güncellendi:', currentBronStoreId);
            showNotification('Bron sazlamalary üstünlikli ýatda saklandy!');
            bronSettingsModal.style.display = 'none';
            // Yerel veriyi güncelle
            await loadAllData();
            await renderBronTable(); // Tabloyu anında güncelle

        } catch (error) {
            console.error('Bron sazlamalary ýatda saklanyp bilmedi:', error);
            showNotification('Sazlamalar ýatda saklanyp bilmedi!', false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    cancelBronSettings?.addEventListener('click', () => {
        bronSettingsModal.style.display = 'none';
    });

    // Bron tablosunu render et
    window.renderBronTable = async () => {
        if (!bronTableBody || !currentBronStoreId) {
            console.log('⚠️ renderBronTable: bronTableBody veya currentBronStoreId eksik', { bronTableBody: !!bronTableBody, currentBronStoreId });
            return;
        }

        try {
            console.log('🔍 Bron tablosu (Stollar) güncelleniyor... Mağaza:', currentBronStoreId);
            // Güncel mağaza verisini çek
            const doc = await window.db.collection('stores').doc(currentBronStoreId).get({ source: 'server' });
            if (!doc.exists) return;
            const store = doc.data();

            // ✅ BULGU 14: globalStores önbelleğindeki eski veriyi güncelle
            const storeIndex = globalStores.findIndex(s => s.id === currentBronStoreId);
            if (storeIndex !== -1) {
                globalStores[storeIndex] = { id: doc.id, ...store };
            }

            bronTableBody.innerHTML = '';

            const tables = store.tables || [];
            if (tables.length === 0) {
                bronTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Bu magazyn üçin henüz stol goşulmady. <br> "Bron Sazlamalary" düwmesine basyp stol goşup bilersiňiz.</td></tr>';
                return;
            }

            tables.forEach(table => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Stol No">${table}</td>
                    <td data-label="Status"><span class="status-badge confirmed">Aktiv</span></td>
                `;
                bronTableBody.appendChild(row);
            });

        } catch (error) {
            console.error('Bron tablosu (Stollar) yüklenemedi:', error);
        }
    };

    // --- MAĞAZA FONKSİYONLARI ---

    // Mağaza tablosunu güncelle
    const renderStoresTable = async (cachedStores, cachedProducts) => {
        // ✅ Önce globalCache'i kullan, yoksa Firebase'den çek
        const stores = cachedStores || globalStores.length ? (cachedStores || globalStores) : await window.showlyDB.getStores();
        const allProducts = cachedProducts || globalProducts.length ? (cachedProducts || globalProducts) : (await window.db.collection('products').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.showTableSkeleton('stores-table-body', 5, 5); // Skeleton göster (veritabanına gitmeden önce)

        // Mağazaları tarihe göre sırala (En yeni en üstte)
        const sortedStores = [...stores].sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return dateB - dateA;
        });

        // Tüm mağaza satırlarını oluştur (hızlı ve paralel)
        const rowsHTML = sortedStores.map(store => {
            const storeProducts = allProducts.filter(p => p.storeId === store.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="ID" class="store-id-cell"></td>
                <td data-label="Magazyn Ady" class="store-name-cell"></td>
                <td data-label="URL" class="store-url-cell"></td>
                <td data-label="Haryt Sany" class="store-products-count-cell"></td>
                <td data-label="Etmekler">
                    <button class="btn-icon edit-store" data-id="${store.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger delete-store" data-id="${store.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            const storeSlug = store.slug || store.id;
            row.querySelector('.store-id-cell').textContent = store.id;
            row.querySelector('.store-name-cell').textContent = store.name;
            row.querySelector('.store-url-cell').innerHTML = `<a href="/${storeSlug}" target="_blank" class="store-link">/${storeSlug}</a>`;
            row.querySelector('.store-products-count-cell').textContent = storeProducts.length;
            return row;
        });

        // Tabloyu temizle (Duplicate önlemek için)
        storesTableBody.innerHTML = '';

        // Tüm satırları tek seferde ekle
        storesTableBody.append(...rowsHTML);
        attachStoreEventListeners();

        console.log(`✅ ${stores.length} mağaza tabloya eklendi`);
        renderReservationStores(); // Rezervasyon mağazalarını da güncelle
        renderBronStores(); // ✅ YENİ: Bron mağazalarını da güncelle
    };

    // Rezervasyon mağazalarını seçeneğe ekle
    const renderReservationStores = async () => {
        if (!reservationStoreSelect) return;
        const stores = await window.showlyDB.getStores();
        const reservationStores = stores.filter(s => s.hasReservation);

        reservationStoreSelect.innerHTML = '<option value="">Magazyn saýlaň...</option>';
        reservationStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            reservationStoreSelect.appendChild(option);
        });
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

        // ✅ YENİ: Rezervasyon checkbox'ını yükle
        const hasReservationCheckbox = document.getElementById('store-has-reservation');
        if (hasReservationCheckbox) {
            hasReservationCheckbox.checked = store.hasReservation || false;
        }

        // ✅ YENİ: Bron checkbox ve Şema yükle
        const hasBronCheckbox = document.getElementById('store-has-bron');
        if (hasBronCheckbox) {
            hasBronCheckbox.checked = store.hasBron || false;
        }

        if (storeSchemaPreview) {
            if (store.restaurantSchemaUrl) {
                storeSchemaPreview.src = store.restaurantSchemaUrl;
                storeSchemaPreview.classList.add('show');
                if (storeSchemaUrl) storeSchemaUrl.value = store.restaurantSchemaUrl;
            } else {
                storeSchemaPreview.src = '';
                storeSchemaPreview.classList.remove('show');
                if (storeSchemaUrl) storeSchemaUrl.value = '';
            }
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
                    <td data-label="Ady" class="cat-name-cell"></td>
                    <td data-label="Icon"><i class="fas ${category.icon || 'fa-tag'}"></i></td>
                    <td data-label="Tertip" class="cat-order-cell"></td>
                    <td data-label="Etmekler">
                        <button class="btn-icon edit-parent-category" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-parent-category" data-id="${category.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                row.querySelector('.cat-name-cell').textContent = category.name;
                row.querySelector('.cat-order-cell').textContent = category.order;
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
                    <td data-label="Ady" class="subcat-name-cell"></td>
                    <td data-label="Ana Kategori" class="subcat-parent-cell"></td>
                    <td data-label="Tertip" class="subcat-order-cell"></td>
                    <td data-label="Etmekler">
                        <button class="btn-icon edit-subcategory" data-id="${subcategory.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-subcategory" data-id="${subcategory.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                row.querySelector('.subcat-name-cell').textContent = subcategory.name;
                row.querySelector('.subcat-parent-cell').textContent = parentName;
                row.querySelector('.subcat-order-cell').textContent = subcategory.order;
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
            document.getElementById('parent-category-name-ru').value = category.name_ru || '';
            document.getElementById('parent-category-name-en').value = category.name_en || '';
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
            document.getElementById('subcategory-name-ru').value = subcategory.name_ru || '';
            document.getElementById('subcategory-name-en').value = subcategory.name_en || '';
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
        const nameRu = document.getElementById('parent-category-name-ru').value.trim();
        const nameEn = document.getElementById('parent-category-name-en').value.trim();
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
                    name_ru: nameRu,
                    name_en: nameEn,
                    icon: icon,
                    order: order
                });
                showNotification('Ana kategori güncellendi!');
            } else {
                await window.db.collection('parentCategories').doc(id).set({
                    name: name,
                    name_ru: nameRu,
                    name_en: nameEn,
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
        const nameRu = document.getElementById('subcategory-name-ru').value.trim();
        const nameEn = document.getElementById('subcategory-name-en').value.trim();
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
                    name_ru: nameRu,
                    name_en: nameEn,
                    parentId: parentId,
                    order: order
                });
                showNotification('Alt kategori güncellendi!');
            } else {
                await window.db.collection('subcategories').doc(id).set({
                    name: name,
                    name_ru: nameRu,
                    name_en: nameEn,
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

    window.selectParentCategoryIcon = function (icon) {
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
        const hasReservation = document.getElementById('store-has-reservation')?.checked || false;
        const hasBron = document.getElementById('store-has-bron')?.checked || false; // ✅ YENİ
        const schemaFile = storeSchemaImage?.files[0]; // ✅ YENİ

        if (!name) {
            showNotification('Mağaza ady gerekli!', false);
            isSubmitting = false;
            return;
        }

        try {
            let restaurantSchemaUrl = storeSchemaUrl?.value || ''; // ✅ YENİ

            if (schemaFile) {
                // Şemayı R2'ye yükle
                try {
                    const uploadResult = await window.uploadToR2(schemaFile, name);
                    restaurantSchemaUrl = uploadResult;
                } catch (uploadError) {
                    console.error('Schema upload error:', uploadError);
                    showNotification('Şema yüklenemedi!', false);
                    isSubmitting = false;
                    return;
                }
            }

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
                    orderPhone,
                    hasReservation,
                    hasBron, // ✅ YENİ
                    restaurantSchemaUrl // ✅ YENİ
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
                    orderPhone,
                    hasReservation,
                    hasBron, // ✅ YENİ
                    restaurantSchemaUrl // ✅ YENİ
                });
                showNotification('Mağaza eklendi!');
            }

            // ✅ ÖNCE MODALI KAPAT
            closeAllModals();
            isSubmitting = false;

            // ✅ Arka planda güncelle
            (async () => {
                try {
                    await renderStoresTable();
                    populateStoreSelect();
                    updateDashboard();
                } catch (e) { console.error(e); }
            })();

        } catch (err) {
            console.error(err);
            showNotification('Mağaza işlemi başarısız!', false);
            isSubmitting = false;
        }
    };

    // Ürün tablosunu güncelle
    async function renderProductsTable(cachedProducts, cachedStores) {
        window.showTableSkeleton('products-table-body', 6, 6); // Skeleton göster
        try {
            // ✅ Önce globalCache'i kullan, yoksa Firebase'den çek
            let products = cachedProducts || (globalProducts.length ? globalProducts : null);
            let storesMap = {};

            if (!products || !cachedStores) {
                if (!products) {
                    const productsSnapshot = await window.db.collection('products').get();
                    products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (!cachedStores && !globalStores.length) {
                    const storesSnapshot = await window.db.collection('stores').get();
                    storesSnapshot.docs.forEach(doc => { storesMap[doc.id] = { id: doc.id, ...doc.data() }; });
                } else {
                    (cachedStores || globalStores).forEach(store => { storesMap[store.id] = store; });
                }
            } else {
                cachedStores.forEach(store => {
                    storesMap[store.id] = store;
                });
            }

            // ✅ Ürünleri işle (innerHTML ile 100x daha hızlı)
            let htmlStr = '';
            for (const product of products) {
                const store = storesMap[product.storeId];
                const storeName = store ? store.name : 'Mağaza Bulunamadı';

                htmlStr += `
                    <tr>
                        <td data-label="ID" class="product-id-cell">${product.id}</td>
                        <td data-label="Haryt Ady" class="product-title-cell">${product.title || ''}</td>
                        <td data-label="Magazyn" class="product-store-cell">${storeName}</td>
                        <td data-label="Bahasy" class="product-price-cell">${product.price || ''}</td>
                        <td data-label="Etmekler">
                            <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }
            productsTableBody.innerHTML = htmlStr;

            attachProductEventListeners();
        } catch (error) {
            console.error('Ürünler yüklenemedi:', error);
            showNotification('Ürünler yüklenemedi!', false);
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
            document.getElementById('product-name-ru').value = product.name_ru || '';
            document.getElementById('product-name-en').value = product.name_en || '';
            document.getElementById('product-store').value = product.storeId || '';
            document.getElementById('product-price').value = product.price || ''; // ✅ DÜZELTME
            document.getElementById('product-discounted-price').value = product.originalPrice || ''; // ✅ DÜZELTME
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-description-ru').value = product.desc_ru || '';
            document.getElementById('product-description-en').value = product.desc_en || '';
            document.getElementById('product-material').value = product.material || '';
            document.getElementById('product-category').value = product.category || '';
            document.getElementById('product-category-ru').value = product.category_ru || '';
            document.getElementById('product-category-en').value = product.category_en || '';

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
            // ✅ Filtreleme durumunu kontrol et
            const filterStoreSelect = document.getElementById('filter-store-select');
            const filterCategorySelect = document.getElementById('filter-category-select');

            if (filterStoreSelect && filterStoreSelect.value) {
                // Filtreyi koru (await olmadığı için async yapmamız gerekebilir ama deleteProduct zaten async değil, ancak filterProducts async. Sorun olmaz, arka planda güncellenir)
                filterProducts(filterStoreSelect.value, filterCategorySelect ? filterCategorySelect.value : null);
            } else {
                renderProductsTable();
            }
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
            const title = document.getElementById('product-name').value.trim();
            const nameRu = document.getElementById('product-name-ru').value.trim();
            const nameEn = document.getElementById('product-name-en').value.trim();
            const storeId = document.getElementById('product-store').value;
            const newPrice = document.getElementById('product-price').value.trim(); // ✅ DÜZELTME
            const discountedPriceInput = document.getElementById('product-discounted-price')?.value.trim() || ''; // ✅ DÜZELTME
            const desc = document.getElementById('product-description').value.trim();
            const descRu = document.getElementById('product-description-ru').value.trim();
            const descEn = document.getElementById('product-description-en').value.trim();
            const material = document.getElementById('product-material').value.trim();
            const category = document.getElementById('product-category').value.trim();
            const categoryRu = document.getElementById('product-category-ru').value.trim();
            const categoryEn = document.getElementById('product-category-en').value.trim();
            const file = productImage.files[0];

            if (!title || !storeId || !newPrice) {
                showNotification('Zorunlu alanları doldurun!', false);
                isSubmitting = false;
                return;
            }

            let imageUrl = uploadedProductImageUrl; // Mevcut resmi koru
            if (file) {
                showUploadStatus(productImageStatus, 'Resim Cloudflare R2\'ye yükleniyor...', true);

                // Mağaza ismini dropdown'dan al (R2 klasörleme için)
                const storeSelect = document.getElementById('product-store');
                const storeName = storeSelect.options[storeSelect.selectedIndex].text;

                try {
                    const uploadResult = await window.uploadToR2(file, storeName);
                    imageUrl = uploadResult;
                    showUploadStatus(productImageStatus, '✓ Resim yüklendi!', true);
                } catch (uploadError) {
                    console.error('R2 Upload error:', uploadError);
                    showUploadStatus(productImageStatus, '❌ Yükleme hatası!', false);
                    throw uploadError;
                }
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
                    name_ru: nameRu,
                    name_en: nameEn,
                    price: newPrice,
                    description: desc,
                    desc_ru: descRu,
                    desc_en: descEn,
                    material,
                    category,
                    category_ru: categoryRu,
                    category_en: categoryEn,
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
                    name_ru: nameRu,
                    name_en: nameEn,
                    price: newPrice,
                    description: desc,
                    desc_ru: descRu,
                    desc_en: descEn,
                    material,
                    category,
                    category_ru: categoryRu,
                    category_en: categoryEn,
                    isOnSale,
                    originalPrice,
                    imageUrl
                });
                showNotification('Ürün Firebase\'e eklendi!');
            }

            // ✅ ÖNCE MODALI KAPAT VE KULLANICIYI ÖZGÜR BIRAK
            closeAllModals();
            isSubmitting = false; // Kullanıcı hemen başka işlem yapabilsin

            // ✅ Arka planda verileri güncelle (AWAIT YOK)
            (async () => {
                try {
                    const filterStoreSelect = document.getElementById('filter-store-select');
                    const filterCategorySelect = document.getElementById('filter-category-select');

                    if (filterStoreSelect && filterStoreSelect.value) {
                        await filterProducts(filterStoreSelect.value, filterCategorySelect ? filterCategorySelect.value : null, false); // false = Loading gösterme
                    } else {
                        renderProductsTable(); // Bu zaten loading göstermiyor
                    }
                    updateDashboard();
                } catch (e) {
                    console.error('Arka plan güncelleme hatası:', e);
                }
            })();

        } catch (err) {
            console.error(err);
            showNotification('Ürün işlemi başarısız oldu!', false);
            isSubmitting = false; // Hata durumunda kilidi aç
        } finally {
            // isSubmitting burada değil, yukarıda early-return mantığıyla yönetiliyor
        }
    };



    const renderOrdersTable = async (cachedOrders, cachedProducts, cachedStores) => {
        window.showTableSkeleton('orders-table-body', 9, 5); // Skeleton göster
        try {
            // ✅ globalCache'i kullan, yoksa Firebase'den çek
            const orders = cachedOrders || (globalOrders.length ? globalOrders : (await window.db.collection('orders').orderBy('date', 'desc').get({ source: 'server' })).docs.map(doc => ({ id: doc.id, ...doc.data() })));
            const allProducts = cachedProducts || (globalProducts.length ? globalProducts : (await window.db.collection('products').get({ source: 'server' })).docs.map(doc => ({ id: doc.id, ...doc.data() })));
            const allStores = cachedStores || (globalStores.length ? globalStores : (await window.db.collection('stores').get({ source: 'server' })).docs.map(doc => ({ id: doc.id, ...doc.data() })));

            ordersTableBody.innerHTML = '';
            if (orders.length === 0) {
                ordersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Henüz sipariş bulunmuyor.</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            for (const order of orders) {
                let storeNames = '';
                if (order.orderType === 'reservation' && order.storeId) {
                    const store = allStores.find(s => s.id === order.storeId);
                    storeNames = store ? `(Reservation) ${store.name}` : '(Reservation) Bilinmiyor';
                } else if (order.orderType === 'bron' && order.storeId) {
                    const store = allStores.find(s => s.id === order.storeId);
                    storeNames = store ? `(Bron) ${store.name}` : '(Bron) Bilinmiyor';
                } else {
                    // 1. Öncelik: Siparişin kendi içinde kayıtlı storeId'si varsa
                    if (order.storeId) {
                        const store = allStores.find(s => s.id === order.storeId);
                        storeNames = store ? store.name : (order.storeName || '');
                    }

                    // 2. Eğer üstteki yöntemle bulunamadıysa (çok eski siparişler için geriye uyumluluk)
                    if (!storeNames) {
                        storeNames = [...new Set(order.items.map(item => {
                            const product = allProducts.find(p => p.id === item.id);
                            const store = allStores.find(s => s.id === product?.storeId);
                            return store?.name || null;
                        }).filter(Boolean))].join(', ');
                    }

                    if (!storeNames) storeNames = 'Bilinmeyen Magazyn';
                }

                const row = document.createElement('tr');

                // Sipariş Numarasını Belirle
                const displayOrderNumber = order.orderNumber || (order.status === 'pending' ? 'Belli değil' : '-');
                const isReservation = order.orderType === 'reservation';
                const isBron = order.orderType === 'bron';

                if (isReservation) row.style.backgroundColor = '#fff3e0'; // Ziyafet için hafif turuncu arka plan
                if (isBron) row.style.backgroundColor = '#e3f2fd'; // Masa bronzu için hafif mavi arka plan

                row.innerHTML = `
                    <td data-label="Haryt/Bron Info">
                        ${isReservation || isBron ?
                        `<div style="font-weight:bold; color: ${isReservation ? '#e65100' : '#1565c0'}; margin-bottom: 5px; font-size: 13px;">
                                <i class="fas ${isReservation ? 'fa-glass-cheers' : 'fa-chair'}"></i> 
                                ${isReservation ? 'Ziyafet' : 'Stol (Bron)'}
                            </div>`
                        : ''
                    }
                        <ul class="order-items-list" style="list-style: none; padding: 0; margin: 0; font-size: 12px; font-family: monospace;"></ul>
                    </td>
                    <td data-label="Ady" class="order-customer-name"></td>
                    <td data-label="Telefony" class="order-customer-phone"></td>
                    <td data-label="Salgysy" class="order-customer-address"></td>
                    <td data-label="Bellik" class="order-customer-note"></td>
                    <td data-label="Magazynlar" class="order-stores"></td>
                    <td data-label="Taryhy" class="order-date"></td>
                    <td data-label="Durum">
                        <span class="status ${order.status}">${order.status === 'pending' ? 'Garaşylýar' : 'Onaylandı'}</span>
                    </td>
                    <td data-label="Etmekler">
                        ${order.status === 'pending' ? `
                            <input type="text" id="number-input-${order.id}" placeholder="No" style="width: 60px; padding: 5px; margin-right: 5px;">
                            <button class="btn-icon order-action-btn" data-id="${order.id}" title="Onayla">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon danger delete-order-btn" data-id="${order.id}" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;

                // Ortak verileri doldur
                const itemsList = row.querySelector('.order-items-list');
                order.items.forEach(item => {
                    const li = document.createElement('li');

                    if (isReservation || isBron) {
                        // Bron/Ziyafet ise anlaşılır ismi göster
                        li.innerHTML = `<span style="font-weight:600; font-size:13px;">${item.title || 'Belirtilmedi'}</span>`;
                    } else {
                        // Normal ürün siparişi ise (kullanıcının önceki isteği üzerine) sadece Haryt ID göster
                        li.textContent = item.id || 'ID Yok';
                    }
                    itemsList.appendChild(li);
                });

                row.querySelector('.order-customer-name').textContent = order.customer.name;
                row.querySelector('.order-customer-phone').textContent = order.customer.phone;
                row.querySelector('.order-customer-address').textContent = order.customer.address;
                row.querySelector('.order-customer-note').textContent = order.customer.note || '';
                row.querySelector('.order-stores').textContent = storeNames;

                // Zamanı göster (Firestore Timestamp veya String ISO)
                let displayDate = 'Bilinmiyor';
                if (order.timestamp) {
                    const dateObj = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
                    displayDate = dateObj.toLocaleString('tr-TR');
                } else if (order.date) {
                    displayDate = new Date(order.date).toLocaleString('tr-TR');
                }
                row.querySelector('.order-date').textContent = displayDate;

                // Action button listener (Numara Ata)
                const actionBtn = row.querySelector('.order-action-btn');
                if (actionBtn) {
                    actionBtn.addEventListener('click', () => {
                        const orderId = actionBtn.getAttribute('data-id');
                        assignOrderNumber(orderId);
                    });
                }

                // Delete button listener (Sipariş Sil)
                const deleteBtn = row.querySelector('.delete-order-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        const orderId = deleteBtn.getAttribute('data-id');
                        if (confirm('Bu siparişi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
                            try {
                                await window.db.collection('orders').doc(orderId).delete();
                                showNotification('Sipariş silindi!');
                                // Tabloyu yenile (cache'i yok sayıp yeniden çekmesi için null verebiliriz veya manuel silebiliriz)
                                // Basitçe:
                                row.remove();
                                updateDashboard();
                            } catch (error) {
                                console.error('Sipariş silinemedi:', error);
                                showNotification('Sipariş silinemedi!', false);
                            }
                        }
                    });
                }

                fragment.appendChild(row);
            }

            ordersTableBody.appendChild(fragment);
        } catch (error) {
            console.error('Siparişler yüklenemedi:', error);
            showNotification('Siparişler yüklenemedi!', false);
        }
    };

    // Dashboard güncelle - Verileri parametre olarak alabilir
    const updateDashboard = async (cachedStores, cachedProducts, cachedOrders) => {
        try {
            const storesCount = cachedStores ? cachedStores.length : (await window.db.collection('stores').get()).size;
            const productsCount = cachedProducts ? cachedProducts.length : (await window.db.collection('products').get()).size;
            const ordersCount = cachedOrders ? cachedOrders.length : (await window.db.collection('orders').get()).size;

            // Sayıları güncelle
            document.getElementById('total-stores').textContent = storesCount;
            document.getElementById('total-products').textContent = productsCount;
            document.getElementById('total-orders').textContent = ordersCount;

            console.log('✅ Dashboard güncellendi:', { storesCount, productsCount, ordersCount });

            // ✅ GRAFİKLERİ GÜNCELLE
            if (typeof updateCharts === 'function') {
                updateCharts(cachedStores, cachedProducts, cachedOrders);
            } else {
                console.warn('updateCharts fonksiyonu bulunamadı!');
            }
        } catch (error) {
            console.error('❌ Dashboard güncellenemedi:', error);
            document.getElementById('total-stores').textContent = '0';
            document.getElementById('total-products').textContent = '0';
            document.getElementById('total-orders').textContent = '0';
        }
    };



    // --- EXCEL FONKSİYONLARI ---
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
                    showNotification('Hata: ' + (error.error || error.message), false);
                }
            }
        });
    }

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
                    showNotification('Hata: ' + (error.error || error.message), false);
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

            // ✅ Ürünleri tabloya ekle (innerHTML ile 100x daha hızlı)
            let htmlStr = '';
            products.forEach(product => {
                const store = storesMap[product.storeId];
                const storeName = store ? store.name : 'Mağaza Bulunamadı';

                htmlStr += `
                    <tr>
                        <td data-label="ID" class="product-id-cell">${product.id}</td>
                        <td data-label="Haryt Ady" class="product-title-cell">${product.title || ''}</td>
                        <td data-label="Magazyn" class="product-store-cell">${storeName}</td>
                        <td data-label="Bahasy" class="product-price-cell">${product.price || ''}</td>
                        <td data-label="Etmekler">
                            <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
            productsTableBody.innerHTML = htmlStr;

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

    // --- GRAFİK YÖNETİMİ ---
    let ordersChart = null;
    let productsChart = null;
    let storesChart = null;

    // Tarih formatla (YYYY-MM-DD)
    const formatDateForInput = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    // İki tarih arasındaki günleri oluştur
    const getDatesInRange = (startDate, endDate) => {
        const date = new Date(startDate);
        const end = new Date(endDate);
        const dates = [];

        while (date <= end) {
            dates.push(formatDateForInput(date));
            date.setDate(date.getDate() + 1);
        }
        return dates;
    };

    // Grafikleri Başlat
    const initCharts = () => {
        const ctxOrders = document.getElementById('ordersChart')?.getContext('2d');
        const ctxProducts = document.getElementById('productsChart')?.getContext('2d');
        const ctxStores = document.getElementById('storesChart')?.getContext('2d');

        if (ctxOrders) {
            ordersChart = new Chart(ctxOrders, {
                type: 'line',
                data: { labels: [], datasets: [] },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }

        if (ctxProducts) {
            productsChart = new Chart(ctxProducts, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }

        if (ctxStores) {
            storesChart = new Chart(ctxStores, {
                type: 'bar', // Veya line
                data: { labels: [], datasets: [] },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }

        // Varsayılan Tarihleri Ayarla (Son 1 Ay)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        document.getElementById('chart-start-date').value = formatDateForInput(startDate);
        document.getElementById('chart-end-date').value = formatDateForInput(endDate);
    };

    // Grafikleri Güncelle
    const updateCharts = async (cachedStores, cachedProducts, cachedOrders) => {
        if (!ordersChart || !productsChart || !storesChart) {
            initCharts();
            if (!ordersChart) return;
        }

        let startInput = document.getElementById('chart-start-date').value;
        let endInput = document.getElementById('chart-end-date').value;

        // EĞER TARİH SEÇİLİ DEĞİLSE => OTOMATİK SON 1 AY
        if (!startInput || !endInput) {
            const endD = new Date();
            const startD = new Date();
            startD.setMonth(startD.getMonth() - 1);

            startInput = formatDateForInput(startD);
            endInput = formatDateForInput(endD);

            // Inputları da güncelle ki kullanıcı neye baktığını görsün
            document.getElementById('chart-start-date').value = startInput;
            document.getElementById('chart-end-date').value = endInput;
        }

        const startDate = new Date(startInput);
        const endDate = new Date(endInput);
        // Bitiş gününün sonuna kadar kapsasın (23:59:59)
        endDate.setHours(23, 59, 59, 999);
        startDate.setHours(0, 0, 0, 0);

        // Verileri al
        const parseDate = (d) => {
            if (!d) return null;
            // Firestore Timestamp kontrolü
            if (d.toDate && typeof d.toDate === 'function') return d.toDate();
            // String veya Date objesi kontrolü
            return new Date(d);
        };

        // 1. Verileri Al ve Normalize Et (Global değişkenlerden veya parametrelerden)
        // Parametre yoksa global değişkenleri kullan
        const sourceOrders = cachedOrders || globalOrders;
        const sourceProducts = cachedProducts || globalProducts;
        const sourceStores = cachedStores || globalStores;

        let orders = sourceOrders.map(d => ({ ...d, createdAt: parseDate(d.createdAt || d.date || d.timestamp) || new Date() }));

        let products = sourceProducts.map(d => ({ ...d, createdAt: parseDate(d.createdAt) || new Date() }));

        let stores = sourceStores.map(d => {
            let date = d.createdAt || d.joinedAt;
            // Firestore Timestamp kontrolü (_seconds)
            if (date && date._seconds) {
                date = new Date(date._seconds * 1000);
            }
            return { ...d, createdAt: parseDate(date) || new Date() };
        });

        // Tarih aralığındaki günleri etiket olarak hazırla
        const labels = getDatesInRange(startDate, endDate);

        // Veri haritaları (Gün -> Sayı)
        const ordersMap = new Array(labels.length).fill(0);
        const productsMap = new Array(labels.length).fill(0);
        const storesMap = new Array(labels.length).fill(0);

        // Siparişleri Say
        orders.forEach(item => {
            const date = item.createdAt;
            if (date && date >= startDate && date <= endDate) {
                const dayKey = formatDateForInput(date);
                const index = labels.indexOf(dayKey);
                if (index !== -1) ordersMap[index]++;
            }
        });
        console.log("Chart Debug - Orders Map:", ordersMap);

        // Ürünleri Say
        products.forEach(item => {
            const date = item.createdAt;
            if (date && date >= startDate && date <= endDate) {
                const dayKey = formatDateForInput(date);
                const index = labels.indexOf(dayKey);
                if (index !== -1) productsMap[index]++;
            }
        });

        // Mağazaları Say
        stores.forEach(item => {
            const date = item.createdAt;
            if (date && date >= startDate && date <= endDate) {
                const dayKey = formatDateForInput(date);
                const index = labels.indexOf(dayKey);
                if (index !== -1) storesMap[index]++;
            }
        });

        // Grafikleri Çiz
        ordersChart.data = {
            labels: labels,
            datasets: [{
                label: 'Sargyt sany',
                data: ordersMap,
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                tension: 0.3,
                fill: true
            }]
        };
        ordersChart.update();

        productsChart.data = {
            labels: labels,
            datasets: [{
                label: 'Täze harytlar',
                data: productsMap,
                backgroundColor: '#00b894'
            }]
        };
        productsChart.update();

        storesChart.data = {
            labels: labels,
            datasets: [{
                label: 'Täze dükanlar',
                data: storesMap,
                backgroundColor: '#fdcb6e'
            }]
        };
        storesChart.update();
    };

    // ✅ Listener'ları ayrı fonksiyona al (Hoisting için function keyword kullan veya yukarı taşı)
    function attachChartListeners() {
        const filterBtn = document.getElementById('filter-charts-btn');
        const resetBtn = document.getElementById('reset-charts-btn');

        if (filterBtn) {
            // Önceki listener'ları temizlemek mümkün değil ama yeni ekliyoruz
            // Clone node ile temizleyebiliriz ama şimdilik sadece ekleyelim
            filterBtn.onclick = (e) => { // addEventListener yerine onclick ile override edelim
                e.preventDefault();
                e.stopImmediatePropagation();
                updateCharts();
                return false;
            };
        }

        if (resetBtn) {
            resetBtn.onclick = (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                const endDate = new Date();
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);

                document.getElementById('chart-start-date').value = formatDateForInput(startDate);
                document.getElementById('chart-end-date').value = formatDateForInput(endDate);

                updateCharts();
                return false;
            };
        }
    }

    // Event Listeners (Filtre Butonları)
    // Sayfa yüklendiğinde grafikler başlatılsın
    initCharts();

    // Listener'ları başlat
    attachChartListeners();

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
            window.showTableSkeleton('users-table-body', 4, 3); // Skeleton göster
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
                        <td data-label="Ulanyjy Ady" class="user-name-cell"></td>
                        <td data-label="Rol"><span class="status ${user.role} user-role-badge"></span></td>
                        <td data-label="Rugsatlar" class="user-permissions-cell"></td>
                        <td data-label="Etmekler">
                            <button class="btn-icon danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    row.querySelector('.user-name-cell').textContent = user.username;
                    const roleBadge = row.querySelector('.user-role-badge');
                    roleBadge.textContent = getRoleName(user.role);
                    row.querySelector('.user-permissions-cell').textContent = user.permissions ? user.permissions.join(', ') : 'Yok';
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
                    // Şifreyi hash'le (Salt round: 10)
                    const bcryptObj = window.bcrypt || (window.dcodeIO && window.dcodeIO.bcrypt);
                    let passwordToStore = password;

                    if (bcryptObj) {
                        const salt = bcryptObj.genSaltSync(10);
                        passwordToStore = bcryptObj.hashSync(password, salt);
                    } else {
                        console.error('Bcrypt library not loaded! Storing plain-text (NOT RECOMMENDED)');
                    }

                    await window.db.collection('users').add({
                        username,
                        password: passwordToStore,
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
                // ✅ localStorage'dan temizle
                localStorage.removeItem('adminUser');
                // ✅ replace kullan (geri tuşuyla dönmeyi engeller)
                window.location.replace('login.html');
            });
        }

        // Sayfa yüklendiğinde kullanıcıları göster
        if (usersTableBody) {
            renderUsersTable();
        }
    });

    // ===========================================================================

    // Ürünleri filtrele
    async function filterProducts(storeId, category, showLoading = true) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (showLoading) loadingOverlay.style.display = 'flex';

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
                    <td data-label="ID" class="product-id-cell"></td>
                    <td data-label="Haryt Ady" class="product-title-cell"></td>
                    <td data-label="Magazyn" class="product-store-cell"></td>
                    <td data-label="Bahasy" class="product-price-cell"></td>
                    <td data-label="Surat" class="product-image-cell"></td>
                    <td data-label="Etmekler">
                        <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                row.querySelector('.product-id-cell').textContent = product.id;
                row.querySelector('.product-title-cell').textContent = product.title;
                row.querySelector('.product-store-cell').textContent = storeName;
                row.querySelector('.product-price-cell').textContent = product.price;

                if (product.imageUrl) {
                    const img = document.createElement('img');
                    img.src = product.imageUrl;
                    img.style.width = '40px';
                    img.style.height = '40px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '4px';
                    row.querySelector('.product-image-cell').appendChild(img);
                } else {
                    row.querySelector('.product-image-cell').textContent = 'Resim yok';
                }
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
        window.showTableSkeleton('users-table-body', 4, 3); // Skeleton göster
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
        if (userModal) userModal.style.display = 'none';
        if (reservationPackageModal) reservationPackageModal.style.display = 'none';
        storeForm.reset();
        productForm.reset();
        productImage.value = '';
        productImagePreview.classList.remove('show');
        productImageStatus.classList.remove('show');
        editingStoreId = null;
        editingProductId = null;
        uploadedProductImageUrl = null;
        editingPackageId = null;
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

            // ✅ YENİ: Rezervasyon sekmesi açıldığında mağazaları yenile
            if (sectionId === 'reservations') {
                renderReservationStores();
            }

            // Mobilde menüyü kapat
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    // ==================== REZERVASYON YÖNETİMİ ====================

    // Paket toplam fiyatını hesapla (Tüm fiyatları toplar)
    function updatePackageTotal() {
        const menuPriceInputs = document.querySelectorAll('.menu-item-price');
        let total = 0;

        menuPriceInputs.forEach(input => {
            total += parseFloat(input.value) || 0;
        });

        // NOT: Kapasite fiyatları artık toplama eklenmez, 
        // çünkü her kapasite farklı bir seçenektir ve frontend'de seçime göre eklenir.

        const packagePriceInput = document.getElementById('package-price');
        if (packagePriceInput) {
            packagePriceInput.value = total.toFixed(2);
        }
    }

    // Dinamik satır ekleme yardımcısı (Ad + Fiyat)
    function createDynamicRowWithPrice(nameValue = '', priceValue = '', nameClass = '', priceClass = '', placeholder = 'Ady') {
        const row = document.createElement('div');
        row.className = 'dynamic-row';

        // Menü maddesi ise textarea kullan, kapasite ise input kullan
        const isMenu = nameClass === 'menu-item-input';
        const inputHtml = isMenu
            ? `<textarea class="${nameClass}" required placeholder="${placeholder}" style="flex: 2; min-height: 80px; padding: 10px; resize: vertical;">${nameValue}</textarea>`
            : `<input type="text" class="${nameClass}" required value="${nameValue}" placeholder="${placeholder}" style="flex: 2;">`;

        row.innerHTML = `
            ${inputHtml}
            <div style="display: flex; flex-direction: column; gap: 5px; flex: 1;">
                <input type="number" class="${priceClass}" required value="${priceValue}" placeholder="Baha" step="0.01" style="width: 100%;">
                <button type="button" class="btn-remove-row" style="align-self: flex-end;"><i class="fas fa-minus-circle"></i> Poz</button>
            </div>
        `;

        // Fiyat değişince toplamı güncelle
        const priceInput = row.querySelector(`.${priceClass}`);
        priceInput.addEventListener('input', updatePackageTotal);

        row.querySelector('.btn-remove-row').addEventListener('click', () => {
            row.remove();
            updatePackageTotal();
        });

        return row;
    }

    // Dinamik satır ekleme yardımcısı (Sadece Ad - Fiyat YOK)
    function createDynamicRowWithoutPrice(nameValue = '', nameClass = '', placeholder = 'Ady') {
        const row = document.createElement('div');
        row.className = 'dynamic-row';

        const inputHtml = `<input type="text" class="${nameClass}" required value="${nameValue}" placeholder="${placeholder}" style="flex: 2;">`;

        row.innerHTML = `
            ${inputHtml}
            <button type="button" class="btn-remove-row" style="flex: 0 0 auto; height: fit-content; align-self: center;"><i class="fas fa-minus-circle"></i> Poz</button>
        `;

        row.querySelector('.btn-remove-row').addEventListener('click', () => {
            row.remove();
        });

        return row;
    }

    const addMenuRowBtn = document.getElementById('add-menu-item');
    const addCapacityRowBtn = document.getElementById('add-capacity-item');
    const addServiceFeatureBtn = document.getElementById('add-service-feature'); // ✅ YENİ
    const menuItemsContainer = document.getElementById('package-menu-items');
    const capacityItemsContainer = document.getElementById('package-capacity-items');
    const serviceFeaturesContainer = document.getElementById('package-service-features'); // ✅ YENİ

    addMenuRowBtn?.addEventListener('click', () => {
        menuItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'menu-item-input', 'menu-item-price', 'Örn: 2 sany tike'));
    });

    addCapacityRowBtn?.addEventListener('click', () => {
        capacityItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'capacity-item-input', 'capacity-item-price', 'Örn: 2 Adamlyk'));
    });

    addServiceFeatureBtn?.addEventListener('click', () => {
        serviceFeaturesContainer.appendChild(createDynamicRowWithoutPrice('', 'service-feature-input', 'Örn: Fotoğrafçı, Dekorasyon...'));
    });

    // Rezervasyon mağazası seçildiğinde
    reservationStoreSelect?.addEventListener('change', (e) => {
        currentReservationStoreId = e.target.value;
        if (currentReservationStoreId) {
            if (addReservationPackageBtn) addReservationPackageBtn.style.display = 'block';
            if (reservationPackagesContainer) reservationPackagesContainer.style.display = 'none';
            if (reservationPackagesList) reservationPackagesList.style.display = 'block';
            renderReservationPackages(currentReservationStoreId);
        } else {
            if (addReservationPackageBtn) addReservationPackageBtn.style.display = 'none';
            if (reservationPackagesContainer) reservationPackagesContainer.style.display = 'block';
            if (reservationPackagesList) reservationPackagesList.style.display = 'none';
        }
    });

    // Rezervasyon paketleri tablosunu güncelle
    const renderReservationPackages = async (storeId) => {
        try {
            const packagesSnapshot = await window.db.collection('reservationPackages')
                .where('storeId', '==', storeId)
                .get();

            const packages = packagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (reservationPackagesTableBody) {
                reservationPackagesTableBody.innerHTML = '';
                if (packages.length === 0) {
                    reservationPackagesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Henüz paket eklenmemiş.</td></tr>';
                } else {
                    packages.forEach(pkg => {
                        const row = document.createElement('tr');

                        // Menü Maddeleri listesi (Ad - Baha)
                        const menuText = Array.isArray(pkg.menuItems)
                            ? pkg.menuItems.map(m => `${m.name}: ${m.price} TMT`).join('\n')
                            : (pkg.menu || '');

                        // Kapasite listesi (Ad - Baha)
                        const capacityText = Array.isArray(pkg.capacities)
                            ? pkg.capacities.map(c => `${c.name} (${c.price} TMT)`).join(', ')
                            : '';

                        // Hizmet Türleri
                        const serviceTypesText = Array.isArray(pkg.serviceTypes) ? pkg.serviceTypes.join(', ') : 'Saýlanmadyk';

                        // Ekstra Hizmetler (Hyzmatlar)
                        const serviceFeaturesText = Array.isArray(pkg.serviceFeatures) ? pkg.serviceFeatures.map(f => f.name || f).join(', ') : 'Ýok';

                        // İlk hizmet türünü veya varsayılan bir başlık göster (Çünkü Paket Adı kalktı)
                        const mainTitle = (Array.isArray(pkg.serviceTypes) && pkg.serviceTypes.length > 0)
                            ? pkg.serviceTypes[0]
                            : 'Ziyafet Paketi';

                        row.innerHTML = `
                            <td data-label="Başlıca Hizmet" style="font-weight: 700; color: var(--primary-color);"></td>
                            <td data-label="Jemi Baha"></td>
                            <td data-label="Görnüşleri ve Menýu" style="max-width: 300px; white-space: pre-line;"></td>
                            <td data-label="Etmekler">
                                <button class="btn-icon edit-package" data-id="${pkg.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon danger delete-package" data-id="${pkg.id}"><i class="fas fa-trash"></i></button>
                            </td>
                        `;
                        row.querySelector('td:nth-child(1)').textContent = mainTitle;
                        row.querySelector('td:nth-child(2)').textContent = `${pkg.totalPrice || pkg.price} TMT`;
                        row.querySelector('td:nth-child(3)').textContent = `Görnüşleri: ${serviceTypesText}\n\nHyzmatlar:\n${serviceFeaturesText}\n\nMenýu:\n${menuText}\n\nKapasite Seçekleri: ${capacityText}`;
                        reservationPackagesTableBody.appendChild(row);
                    });

                    // Olay dinleyicileri ekle
                    document.querySelectorAll('.edit-package').forEach(btn => {
                        btn.addEventListener('click', (e) => editReservationPackage(e.currentTarget.getAttribute('data-id')));
                    });
                    document.querySelectorAll('.delete-package').forEach(btn => {
                        btn.addEventListener('click', (e) => deleteReservationPackage(e.currentTarget.getAttribute('data-id')));
                    });
                }
            }
        } catch (error) {
            console.error('Rezervasyon paketleri yükleme hatası:', error);
        }
    };

    const editReservationPackage = async (packageId) => {
        try {
            const doc = await window.db.collection('reservationPackages').doc(packageId).get();
            if (!doc.exists) return;
            const pkg = doc.data();

            document.getElementById('reservation-package-modal-title').textContent = 'Paketi Düzenle';
            document.getElementById('package-id').value = packageId;
            // Paket adı kalktı
            document.getElementById('package-price').value = pkg.totalPrice || pkg.price;

            // Hizmet türlerini yükle (Textarea)
            const serviceTypesManual = document.getElementById('service-types-manual');
            if (serviceTypesManual) {
                serviceTypesManual.value = Array.isArray(pkg.serviceTypes) ? pkg.serviceTypes.join(', ') : '';
            }

            // Dinamik alanları temizle ve doldur
            // 1. Hizmet Özellikleri (Hyzmatlar)
            serviceFeaturesContainer.innerHTML = '';
            if (Array.isArray(pkg.serviceFeatures) && pkg.serviceFeatures.length > 0) {
                pkg.serviceFeatures.forEach(item => {
                    serviceFeaturesContainer.appendChild(createDynamicRowWithoutPrice(item.name || item, 'service-feature-input', 'Örn: Fotoğrafçı, Dekorasyon...'));
                });
            } else {
                serviceFeaturesContainer.appendChild(createDynamicRowWithoutPrice('', 'service-feature-input', 'Örn: Fotoğrafçı, Dekorasyon...'));
            }

            // 2. Menü Öğeleri
            menuItemsContainer.innerHTML = '';
            if (Array.isArray(pkg.menuItems) && pkg.menuItems.length > 0) {
                pkg.menuItems.forEach(item => {
                    menuItemsContainer.appendChild(createDynamicRowWithPrice(item.name, item.price, 'menu-item-input', 'menu-item-price', 'Örn: 2 sany tike'));
                });
            } else {
                menuItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'menu-item-input', 'menu-item-price', 'Örn: 2 sany tike'));
            }

            capacityItemsContainer.innerHTML = '';
            if (Array.isArray(pkg.capacities) && pkg.capacities.length > 0) {
                pkg.capacities.forEach(item => {
                    capacityItemsContainer.appendChild(createDynamicRowWithPrice(item.name, item.price, 'capacity-item-input', 'capacity-item-price', 'Örn: 2 Adamlyk'));
                });
            } else {
                capacityItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'capacity-item-input', 'capacity-item-price', 'Örn: 2 Adamlyk'));
            }

            editingPackageId = packageId;
            reservationPackageModal.style.display = 'block';
            updatePackageTotal();
        } catch (error) {
            console.error('Paket düzenleme hatası:', error);
        }
    };

    const deleteReservationPackage = async (packageId) => {
        if (confirm('Bu rezervasyon paketini silmek istediğinizden emin misiniz?')) {
            try {
                await window.db.collection('reservationPackages').doc(packageId).delete();
                showNotification('Paket başarıyla silindi!');
                renderReservationPackages(currentReservationStoreId);
            } catch (error) {
                console.error('Paket silme hatası:', error);
            }
        }
    };

    addReservationPackageBtn?.addEventListener('click', () => {
        document.getElementById('reservation-package-modal-title').textContent = 'Täze paket goş';
        reservationPackageForm.reset();
        document.getElementById('package-id').value = '';
        // Paket adı kalktı

        // Dinamik alanları sıfırla (başlangıçta birer boş satır)
        serviceFeaturesContainer.innerHTML = '';
        serviceFeaturesContainer.appendChild(createDynamicRowWithoutPrice('', 'service-feature-input', 'Örn: Fotoğrafçı, Dekorasyon...'));

        menuItemsContainer.innerHTML = '';
        menuItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'menu-item-input', 'menu-item-price', 'Örn: 2 sany tike'));

        capacityItemsContainer.innerHTML = '';
        capacityItemsContainer.appendChild(createDynamicRowWithPrice('', '', 'capacity-item-input', 'capacity-item-price', 'Örn: 2 Adamlyk'));

        editingPackageId = null;
        reservationPackageModal.style.display = 'block';

        // Hizmet türlerini sıfırla
        document.querySelectorAll('input[name="service-type"]').forEach(cb => cb.checked = false);

        updatePackageTotal();
    });

    reservationPackageForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Paket adı kalktı: const packageName = document.getElementById('package-name').value.trim();
        const totalPrice = parseFloat(document.getElementById('package-price').value) || 0;

        // Hizmet türlerini textarea'dan al ve array yap
        const serviceTypesManual = document.getElementById('service-types-manual').value;
        const serviceTypes = serviceTypesManual.split(/[,\n]/).map(s => s.trim()).filter(s => s !== '');

        // Dinamik listeleri (Nesne veya Metin olarak) topla
        const featureRows = serviceFeaturesContainer.querySelectorAll('.dynamic-row');
        const serviceFeatures = Array.from(featureRows)
            .map(row => row.querySelector('.service-feature-input').value.trim())
            .filter(name => name !== '');

        const menuRows = menuItemsContainer.querySelectorAll('.dynamic-row');
        const menuItems = Array.from(menuRows).map(row => ({
            name: row.querySelector('.menu-item-input').value.trim(),
            price: parseFloat(row.querySelector('.menu-item-price').value) || 0
        })).filter(item => item.name !== '');

        const capacityRows = capacityItemsContainer.querySelectorAll('.dynamic-row');
        const capacities = Array.from(capacityRows).map(row => ({
            name: row.querySelector('.capacity-item-input').value.trim(),
            price: parseFloat(row.querySelector('.capacity-item-price').value) || 0
        })).filter(item => item.name !== '');

        if (menuItems.length === 0 || capacities.length === 0) {
            showNotification('Lütfen en az bir menü maddesi ve kapasite seçeneği ekleyin.', false);
            return;
        }

        try {
            const packageData = {
                storeId: currentReservationStoreId,
                // packageName artık yok, frontendde undefined gelebilir ama sorun değil
                totalPrice,
                serviceTypes,
                serviceFeatures, // ✅ YENİ: Hyzmatlar eklendi
                menuItems,
                capacities,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (editingPackageId) {
                await window.db.collection('reservationPackages').doc(editingPackageId).update(packageData);
                showNotification('Paket güncellendi!');
            } else {
                packageData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await window.db.collection('reservationPackages').add(packageData);
                showNotification('Paket eklendi!');
            }

            reservationPackageModal.style.display = 'none';
            renderReservationPackages(currentReservationStoreId);
        } catch (error) {
            console.error('Paket kaydetme hatası:', error);
            showNotification('İşlem başarısız!', false);
        }
    });

    cancelPackage?.addEventListener('click', () => {
        reservationPackageModal.style.display = 'none';
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
    window.addProductToFirebase = async function (product) {
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
    window.deleteStoreFromFirebase = async function (storeId) {
        const prods = await window.db.collection('products').where('storeId', '==', storeId).get();
        const batch = window.db.batch();
        prods.docs.forEach(d => batch.delete(d.ref));
        batch.delete(window.db.collection('stores').doc(storeId));
        await batch.commit();
    };

    // Ürün sil (Firestore)
    window.deleteProductFromFirebase = async function (productId) {
        await window.db.collection('products').doc(productId).delete();
    };

    // Tüm mağazaları getir (Firestore)
    window.getStoresFromFirebase = async function () {
        const snap = await window.db.collection('stores').get({ source: 'server' });
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // Tüm ürünleri getir (Firestore) - SUNUCUDAN ZORUNLU
    window.getProductsFromFirebase = async function () {
        const snap = await window.db.collection('products').get({ source: 'server' });
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // Sayfa yüklendiğinde bekleyen siparişleri kontrol et
    processPendingOrders();

    // ✅ Tüm verileri yükleyen fonksiyon - Güvenli ve Kararlı Veri Akışı
    const loadAllData = async () => {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none'; // Tam ekran loading iptal, skeleton kullanılacak

        try {
            console.log('🔄 Veriler Firebase\'den yükleniyor (admin)...');
            window.showDashboardSkeleton();
            window.showTableSkeleton('stores-table-body', 5, 5);
            window.showTableSkeleton('products-table-body', 6, 6);
            window.showTableSkeleton('orders-table-body', 9, 5);

            // Firebase'den veri çekme (Birincil Kaynak)
            const fetchFirebase = async () => {
                const results = await Promise.allSettled([
                    window.db.collection('stores').get(),
                    window.db.collection('products').get(),
                    window.db.collection('orders').orderBy('date', 'desc').get()
                ]);

                const stores = results[0].status === 'fulfilled' ? results[0].value.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];
                const products = results[1].status === 'fulfilled' ? results[1].value.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];
                const orders = results[2].status === 'fulfilled' ? results[2].value.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];

                if (results[2].status === 'rejected') {
                    console.error('⚠️ Siparişler (Permissions) Hatası:', results[2].reason);
                }

                return { stores, products, orders, source: 'Firebase' };
            };

            // Worker'dan veri çekme (Sadece Stores ve Products için Yedek)
            const fetchWorker = async () => {
                const WORKER_URL = 'https://api-worker.showlytmstore.workers.dev/';
                try {
                    const response = await fetch(WORKER_URL, {
                        method: 'GET', mode: 'cors', cache: 'no-cache'
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();

                    return {
                        stores: data.stores || [],
                        products: data.allProducts || data.products || [],
                        orders: [], // Worker sipariş taşımaz
                        source: 'Worker'
                    };
                } catch (e) {
                    console.error('Worker Fallback Hatası:', e);
                    throw e;
                }
            };

            let result;
            try {
                // Öncelik Firebase'de ama çok yavaşsa Worker devreye girsin diye bir yarış başlatılabilir
                // Ancak Admin panelinde DOĞRU veri (Firebase) her zaman önceliklidir.
                result = await fetchFirebase();

                // Eğer Firebase kritik verileri (stores/products) boş döndüyse ve Worker varsa yedekle
                if (result.stores.length === 0 && result.products.length === 0) {
                    console.warn('⚠️ Firebase boş döndü, Worker deneniyor...');
                    const workerResult = await fetchWorker().catch(() => null);
                    if (workerResult) {
                        result.stores = workerResult.stores;
                        result.products = workerResult.products;
                        result.source = 'Firebase + Worker';
                    }
                }
            } catch (err) {
                console.error('Firebase ana veri yükleme hatası:', err);
                result = await fetchWorker().catch(() => ({ stores: [], products: [], orders: [], source: 'Error' }));
            }

            console.log(`✅ Admin verileri yüklendi (KAYNAK: ${result.source})`);

            globalStores = result.stores;
            globalProducts = result.products;
            globalOrders = result.orders;

            window.hideDashboardSkeleton();
            updateDashboard(globalStores, globalProducts, globalOrders);

            // Aktif sekmeyi güncelle

            const activeSection = document.querySelector('.content-section.active');
            const sectionId = activeSection ? activeSection.id : 'stores';

            if (sectionId === 'stores') renderStoresTable(globalStores, globalProducts);
            if (sectionId === 'products') renderProductsTable(globalProducts, globalStores);
            if (sectionId === 'orders') renderOrdersTable(globalOrders, globalProducts, globalStores);
            if (sectionId === 'users' && currentUser.role === 'superadmin') renderUsersTable();
            if (sectionId === 'categories') {
                renderParentCategoriesTable();
                renderSubcategoriesTable();
            }

            // Dropdownları doldur
            populateStoreSelect();
            populateStoreFilter();
            renderReservationStores();
            renderBronStores();
            if (window.populateBulkDeleteStores) window.populateBulkDeleteStores();

            if (loadingOverlay) loadingOverlay.style.display = 'none';
            startAutoRefresh();
            console.log('✅ Tüm işlemler tamamlandı.');

        } catch (error) {
            console.error('❌ Yükleme sırasında kritik hata:', error);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            showNotification('Bağlantı sorunu! Lütfen internetinizi kontrol edin.', false);
        }
    };


    // --- AYARLAR ---
    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        // Ayarları yükle
        async function loadSettings() {
            try {
                const doc = await window.db.collection('settings').doc('general').get();
                if (doc.exists) {
                    const data = doc.data();
                    const hideCategoriesCheckbox = document.getElementById('setting-hide-categories');
                    if (hideCategoriesCheckbox) {
                        hideCategoriesCheckbox.checked = data.hideCategories || false;
                    }
                }
            } catch (error) {
                console.error('Ayarlar yüklenemedi:', error);
            }
        }

        loadSettings();

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Kaydediliyor...';

            try {
                const hideCategories = document.getElementById('setting-hide-categories').checked;

                await window.db.collection('settings').doc('general').set({
                    hideCategories: hideCategories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                showNotification('Ayarlar başarıyla kaydedildi!');
            } catch (error) {
                console.error('Ayarlar kaydedilemedi:', error);
                showNotification('Ayarlar kaydedilemedi!', false);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // ✅ YENİ: Mağaza Ürünlerini Toplu Silme Mantığı
    const bulkDeleteSelect = document.getElementById('bulk-delete-store-select');
    const bulkDeleteBtn = document.getElementById('bulk-delete-products-btn');
    const bulkDeleteCountSpan = document.getElementById('bulk-delete-product-count');

    // Mağaza listesini doldur (veri yüklendikten sonra çağrılacak)
    window.populateBulkDeleteStores = function () {
        if (!bulkDeleteSelect) return;
        const stores = globalStores || [];
        bulkDeleteSelect.innerHTML = '<option value="">Magazyn saýlaň...</option>';
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            bulkDeleteSelect.appendChild(option);
        });
    };

    // Mağaza seçildiğinde ürün sayısını göster
    if (bulkDeleteSelect) {
        bulkDeleteSelect.addEventListener('change', () => {
            const storeId = bulkDeleteSelect.value;
            if (!storeId) {
                bulkDeleteCountSpan.textContent = '';
                bulkDeleteBtn.disabled = true;
                bulkDeleteBtn.style.opacity = '0.5';
                bulkDeleteBtn.style.cursor = 'not-allowed';
                return;
            }

            const storeProducts = globalProducts.filter(p => p.storeId === storeId);
            const count = storeProducts.length;

            if (count === 0) {
                bulkDeleteCountSpan.textContent = '⚠️ Bu magazynda haryt ýok';
                bulkDeleteBtn.disabled = true;
                bulkDeleteBtn.style.opacity = '0.5';
                bulkDeleteBtn.style.cursor = 'not-allowed';
            } else {
                bulkDeleteCountSpan.textContent = `📦 ${count} haryt tapyldy`;
                bulkDeleteBtn.disabled = false;
                bulkDeleteBtn.style.opacity = '1';
                bulkDeleteBtn.style.cursor = 'pointer';
            }
        });
    }

    // Silme butonu
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            const storeId = bulkDeleteSelect.value;
            if (!storeId) return;

            const storeName = bulkDeleteSelect.options[bulkDeleteSelect.selectedIndex].text;
            const storeProducts = globalProducts.filter(p => p.storeId === storeId);
            const count = storeProducts.length;

            if (count === 0) {
                showNotification('Bu magazynda haryt ýok!', false);
                return;
            }

            // 1. İlk onay
            const firstConfirm = confirm(`"${storeName}" magazynyndaky ${count} harydyň HEMMESINI pozmak isleýärsiňizmi?\n\nBu amal yzyna gaýtarylyp bilinmez!`);
            if (!firstConfirm) return;

            // 2. İkinci onay — mağaza adını yazdır
            const typedName = prompt(`Tassyklamak üçin magazyn adyny ýazyň:\n\n"${storeName}"`);
            if (!typedName || typedName.trim().toLowerCase() !== storeName.trim().toLowerCase()) {
                showNotification('Magazyn ady dogry ýazylmady. Amal ýatyryldy.', false);
                return;
            }

            // Silme işlemi başlasın
            bulkDeleteBtn.disabled = true;
            const originalHTML = bulkDeleteBtn.innerHTML;
            bulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pozulýar...';

            try {
                // Firestore batch silme (500'lük gruplar halinde)
                const BATCH_SIZE = 500;
                let deleted = 0;

                for (let i = 0; i < storeProducts.length; i += BATCH_SIZE) {
                    const batch = window.db.batch();
                    const chunk = storeProducts.slice(i, i + BATCH_SIZE);

                    chunk.forEach(product => {
                        const docRef = window.db.collection('products').doc(product.id);
                        batch.delete(docRef);
                    });

                    await batch.commit();
                    deleted += chunk.length;
                    bulkDeleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${deleted}/${count} pozuldy...`;
                }

                // Global listeden de kaldır
                globalProducts = globalProducts.filter(p => p.storeId !== storeId);

                // UI'ı güncelle
                bulkDeleteCountSpan.textContent = '✅ Ähli harytlar pozuldy!';
                bulkDeleteBtn.disabled = true;
                bulkDeleteBtn.style.opacity = '0.5';
                bulkDeleteBtn.innerHTML = originalHTML;

                // Tabloları güncelle
                if (typeof renderProducts === 'function') renderProducts(globalProducts);
                const totalProductsEl = document.getElementById('total-products');
                if (totalProductsEl) totalProductsEl.textContent = globalProducts.length;

                showNotification(`✅ "${storeName}" magazynyndaky ${count} haryt üstünlikli pozuldy!`);
                console.log(`🗑️ ${count} ürün silindi (${storeName})`);

            } catch (error) {
                console.error('❌ Toplu silme hatası:', error);
                showNotification('Harytlary pozmakda ýalňyşlyk çykdy: ' + error.message, false);
                bulkDeleteBtn.disabled = false;
                bulkDeleteBtn.style.opacity = '1';
                bulkDeleteBtn.innerHTML = originalHTML;
            }
        });
    }

    // ✅ Verileri yükle
    loadAllData();
});

// --- OTOMATİK YENİLEME FONKSİYONU (Optimize Edilmiş) ---
function startAutoRefresh() {
    const refreshInterval = 5 * 60 * 1000; // 5 dakika

    setInterval(async () => {
        console.log('🔄 5dk arka planda globalCache yenileniyor...');
        try {
            // ✅ Sadece globalCache'i yenile, tablo render etme (UI'yı bloklamaz)
            const [storesSnap, productsSnap, ordersSnap] = await Promise.all([
                window.db.collection('stores').get().catch(() => ({ docs: [] })),
                window.db.collection('products').get().catch(() => ({ docs: [] })),
                window.db.collection('orders').orderBy('date', 'desc').get().catch(() => ({ docs: [] }))
            ]);

            // Global cache'i gizlice güncelle
            if (storesSnap.docs.length) globalStores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (productsSnap.docs.length) globalProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (ordersSnap.docs.length) globalOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log('✅ GlobalCache 5dk güncellendi. Stores:', globalStores.length);

            // ✅ Sadece aktif sekmeyi yenile (loading göstermeden)
            const activeSection = document.querySelector('.content-section.active');
            if (activeSection) {
                const sectionId = activeSection.id;
                if (sectionId === 'stores') renderStoresTable(globalStores, globalProducts);
                else if (sectionId === 'products') renderProductsTable(globalProducts, globalStores);
                else if (sectionId === 'orders') renderOrdersTable(globalOrders, globalProducts, globalStores);
            }

            if (typeof updateDashboard === 'function') updateDashboard(globalStores, globalProducts, globalOrders);
            if (typeof renderBronTable === 'function') renderBronTable();

        } catch (error) {
            console.error('Otomatik yenileme sırasında hata:', error);
        }
    }, refreshInterval);
}

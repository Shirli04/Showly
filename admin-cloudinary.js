document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin paneli yüklendi...');
    
    // DOM elemanları
    const productIsOnSale = document.getElementById('product-is-on-sale');
    const originalPriceGroup = document.getElementById('original-price-group');
    const productOriginalPrice = document.getElementById('product-original-price');
    const navLinks = document.querySelectorAll('.nav-link');
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
        storesTableBody.innerHTML = '';

        for (const store of stores) {
            const storeProducts = await window.showlyDB.getProductsByStoreId(store.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${store.id}</td>
                <td>${store.name}</td>
                <td>${storeProducts.length}</td>
                <td>
                    <button class="btn-icon edit-store" data-id="${store.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger delete-store" data-id="${store.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            storesTableBody.appendChild(row);
        }

        attachStoreEventListeners();
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

        // ✅ Yeni: Mağaza Üstü Metin
        const customBannerInput = document.getElementById('store-custom-banner-text');
        if (customBannerInput) {
            customBannerInput.value = store.customBannerText || '';
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
    
    const handleStoreSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        isSubmitting = true;
        const name = document.getElementById('store-name').value.trim();
        const desc = document.getElementById('store-description').value.trim();

        // ✅ Yeni: Mağaza Üstü Metin
        const customBannerInput = document.getElementById('store-custom-banner-text');
        const customBannerText = customBannerInput ? customBannerInput.value.trim() : '';

        if (!name) { showNotification('Mağaza adı gerekli!', false); isSubmitting = false; return; }
        try {
            await window.addStoreToFirebase({ 
                name, 
                description: desc, 
                customBannerText // ✅ Burada kullan
            });
            showNotification('Mağaza Firebase’e eklendi!');
            renderStoresTable(); populateStoreSelect(); updateDashboard();
            closeAllModals();
        } catch (err) {
            console.error(err);
            showNotification('Mağaza eklenemedi!', false);
        } finally { isSubmitting = false; }
    };
    
    // Ürün tablosunu güncelle
    async function renderProductsTable() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex'; // Göster

    try {
        const [products, stores] = await Promise.all([window.showlyDB.getAllProducts(), window.showlyDB.getStores()]);
        productsTableBody.innerHTML = '';
        for (const product of products) {
        const store = stores.find(s => s.id === product.storeId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.title}</td>
            <td>${store ? store.name : 'Bilinmiyor'}</td>
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
            document.getElementById('product-new-price').value = product.price || '';
            document.getElementById('product-original-price').value = product.originalPrice || '';
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
            editingProductId = productId; // ✅ Burada ID'yi sakla
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
            const newPrice = document.getElementById('product-new-price').value.trim();
            const originalPriceInput = document.getElementById('product-original-price').value.trim();
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

            // İndirim hesaplaması
            let isOnSale = false;
            let originalPrice = '';
            if (originalPriceInput) {
                const original = parseFloat(originalPriceInput.replace(' TMT', ''));
                const current = parseFloat(newPrice.replace(' TMT', ''));
                if (!isNaN(original) && !isNaN(current) && original > current) {
                    isOnSale = true;
                    originalPrice = originalPriceInput;
                }
            }

            // Düzenleme mi, yoksa yeni ekleme mi?
            if (editingProductId) {
                // Mevcut ürünü güncelle
                await window.db.collection('products').doc(editingProductId).update({
                    storeId, title, price: newPrice, description: desc, material, category,
                    isOnSale, originalPrice, imageUrl
                });
                showNotification('Ürün başarıyla güncellendi!');
            } else {
                // Yeni ürün ekle
                await window.addProductToFirebase({
                    storeId, title, price: newPrice, description: desc, material, category,
                    isOnSale, originalPrice, imageUrl
                });
                showNotification('Ürün Firebase’e eklendi!');
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
    
    // Dashboard güncelle
    const updateDashboard = () => {
        const stores = window.showlyDB.getStores();
        const products = window.showlyDB.getAllProducts();
        const orders = window.showlyDB.getOrders();
        
        document.getElementById('total-stores').textContent = stores.length;
        document.getElementById('total-products').textContent = products.length;
        document.getElementById('total-orders').textContent = orders.length;
    };
    
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
        btn.addEventListener('click', closeAllModals);
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

    // Mağaza ekle (Firestore)
    window.addStoreToFirebase = async function(store) {
        const slug = store.name.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
        const doc = await window.db.collection('stores').add({
            name: store.name,
            slug: slug,
            description: store.description || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: doc.id, name: store.name, slug, description: store.description };
    };

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
    
    updateDashboard();
    renderStoresTable();
    renderProductsTable();
    (async () => {
        await renderOrdersTable();
        await populateStoreSelect();
    })();// Sipariş tablosunu da göster
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

// Sayfa yüklendiğinde otomatik yenilemeyi başlat
document.addEventListener('DOMContentLoaded', () => {
    // ... diğer kodlar ...
    startAutoRefresh(); // Bu satır eklenmeli
});
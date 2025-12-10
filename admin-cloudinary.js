document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin paneli yüklendi...');
    
    // DOM elemanları
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

    const loginScreen = document.getElementById('login-screen');
    const adminContainer = document.getElementById('admin-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.querySelector('.btn-logout');
    
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
    
    // --- YENİ EKLENEN FİLTRELEME ELEMANLARI ---
    const filterStoreSelect = document.getElementById('filter-store-select');
    const filterCategorySelect = document.getElementById('filter-category-select');

    const productIsOnSale = document.getElementById('product-is-on-sale');
    const productOriginalPrice = document.getElementById('product-original-price');
    const originalPriceGroup = document.getElementById('original-price-group');
    
    let editingStoreId = null;
    let editingProductId = null;
    let uploadedProductImageUrl = null;
    
    // Form gönderme kontrolü
    let isSubmitting = false;
    
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

    // İndirim checkbox'ı değiştiğinde eski fiyat alanını göster/gizle
    productIsOnSale.addEventListener('change', (e) => {
        originalPriceGroup.style.display = e.target.checked ? 'block' : 'none';
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

    const ADMIN_CREDENTIALS = {
        username: 'admin', // Kullanıcı adınız
        password: '582491673'  // Şifreniz (Güçlü bir şifre seçin!)
    };

    const checkLoginStatus = () => {
        const isLoggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
        if (isLoggedIn) {
            showAdminPanel();
        } else {
            showLoginScreen();
        }
    };

    // Giriş ekranını göster
    const showLoginScreen = () => {
        loginScreen.style.display = 'flex';
        adminContainer.style.display = 'none';
    };

    // Admin panelini göster
    const showAdminPanel = () => {
        loginScreen.style.display = 'none';
        adminContainer.style.display = 'flex';
    };

    // Giriş formu gönderildiğinde
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            localStorage.setItem('isAdminLoggedIn', 'true');
            showAdminPanel();
            showNotification('Giriş başarılı!');
        } else {
            loginError.style.display = 'block';
        }
    });

    // Çıkış yap butonuna tıklandığında
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isAdminLoggedIn');
            showLoginScreen();
        });
    }
    
    // Dosya yükleme durumunu göster
    const showUploadStatus = (element, message, isSuccess = true) => {
        element.textContent = message;
        element.className = `upload-status show ${isSuccess ? 'success' : 'error'}`;
    };
    
    // --- FİLTRELEME FONKSİYONLARI ---

    // Mağaza filtresini doldur
    const populateStoreFilter = () => {
        const stores = window.showlyDB.getStores();
        filterStoreSelect.innerHTML = '<option value="">Tüm Mağazalar</option>';
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            filterStoreSelect.appendChild(option);
        });
    };

    // Kategori filtresini doldur
    const populateCategoryFilter = (storeId) => {
        filterCategorySelect.innerHTML = '<option value="">Ähli Kategoriyalar</option>'; // "Tüm Kategoriler"
        filterCategorySelect.disabled = !storeId;

        if (!storeId) return;

        const products = window.showlyDB.getProductsByStoreId(storeId);
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategorySelect.appendChild(option);
        });
    };
    
    // --- MAĞAZA FONKSİYONLARI ---
    
    // Mağaza tablosunu güncelle
    const renderStoresTable = () => {
        const stores = window.showlyDB.getStores();
        storesTableBody.innerHTML = '';
        
        stores.forEach(store => {
            const storeProducts = window.showlyDB.getProductsByStoreId(store.id);
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
        });
        
        attachStoreEventListeners();
    };
    
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
    const editStore = (storeId) => {
        const store = window.showlyDB.getStores().find(s => s.id === storeId);
        if (!store) return;
        
        document.getElementById('store-modal-title').textContent = 'Mağazayı Düzenle';
        document.getElementById('store-id').value = store.id;
        document.getElementById('store-name').value = store.name;
        document.getElementById('store-description').value = store.description || '';
        
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
    
    // Mağaza formu gönder
    const handleStoreSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        isSubmitting = true;
        
        try {
            const storeName = document.getElementById('store-name').value.trim();
            const storeDescription = document.getElementById('store-description').value.trim();
            
            if (!storeName) {
                showNotification('Mağaza adı boş olamaz!', false);
                isSubmitting = false;
                return;
            }
            
            if (editingStoreId) {
                window.showlyDB.updateStore(editingStoreId, {
                    name: storeName,
                    description: storeDescription
                });
                showNotification('Mağaza başarıyla güncellendi!');
            } else {
                    const newStore = window.showlyDB.addStore({
                    name: storeName,
                    description: storeDescription
                    });
                        
                    // Yeni mağaza için slug'a göre link oluştur
                    const storeUrl = `/${newStore.slug}`;
                    console.log('Mağaza Linki:', storeUrl);
                        
                    showNotification('Mağaza başarıyla eklendi! Link: ' + storeUrl);
                }
            
            renderStoresTable();
            populateStoreSelect();
            updateDashboard();
            closeAllModals();
        } catch (error) {
            console.error('Hata:', error);
            showNotification('Bir hata oluştu: ' + error.message, false);
        } finally {
            isSubmitting = false;
        }
    };
    
    // --- ÜRÜN FONKSİYONLARI ---
    
    // Ürün tablosunu güncelle (FİLTRELEME İLE GÜNCELLENMİŞ HALİ)
    const renderProductsTable = (storeId = null, categoryFilter = null) => {
        let products = window.showlyDB.getAllProducts();
        const stores = window.showlyDB.getStores();

        // Mağazaya göre filtrele
        if (storeId) {
            products = products.filter(p => p.storeId === storeId);
        }

        // Kategoriye göre filtrele
        if (categoryFilter) {
            products = products.filter(p => p.category === categoryFilter);
        }
        
        productsTableBody.innerHTML = '';
        
        products.forEach(product => {
            const store = stores.find(s => s.id === product.storeId);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.id}</td>
                <td>${product.title}</td>
                <td>${store ? store.name : 'Bilinmiyor'}</td>
                <td>${product.price}</td>
                <td>${product.imageUrl ? `<img src="${product.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : 'Resim yok'}</td>
                <td>
                    <button class="btn-icon edit-product" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger delete-product" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            productsTableBody.appendChild(row);
        });
        
        attachProductEventListeners();
    };
    
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
    
    // Ürün düzenle (KATEGORİ İLE GÜNCELLENMİŞ HALİ)
    const editProduct = (productId) => {
        const product = window.showlyDB.getProductById(productId);
        if (!product) return;
        
        document.getElementById('product-name').value = product.title;
        document.getElementById('product-store').value = product.storeId;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-material').value = product.material || '';
        document.getElementById('product-category').value = product.category || '';
        productIsOnSale.checked = product.isOnSale || false;
        originalPriceGroup.style.display = product.isOnSale ? 'block' : 'none';
        document.getElementById('product-original-price').value = product.originalPrice || '';
        
        if (product.imageUrl) {
            productImagePreview.src = product.imageUrl;
            productImagePreview.classList.add('show');
            uploadedProductImageUrl = product.imageUrl;
        }
        
        productModal.style.display = 'block';
        editingProductId = productId;
    };
    
    // Ürün sil
    const deleteProduct = (productId) => {
        if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
            window.showlyDB.deleteProduct(productId);
            renderProductsTable(filterStoreSelect.value, filterCategorySelect.value);
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
    
    // Ürün formu gönder (KATEGORİ İLE GÜNCELLENMİŞ HALİ)
    const handleProductSubmit = async (e) => {
        e.preventDefault();
        
        // Çift tıklamayı engelle
        if (isSubmitting) {
            console.log('Form zaten gönderiliyor, lütfen bekleyin...');
            return;
        }
        
        isSubmitting = true;
        
        try {
            const productName = document.getElementById('product-name').value.trim();
            const productStore = document.getElementById('product-store').value;
            const productPrice = document.getElementById('product-price').value.trim();
            const productDescription = document.getElementById('product-description').value.trim();
            const productMaterial = document.getElementById('product-material').value.trim();
            const productCategory = document.getElementById('product-category').value.trim();
            const isOnSale = productIsOnSale.checked;
            const originalPrice = productOriginalPrice.value.trim();
            const imageFile = productImage.files[0];
            
            if (!productName || !productStore || !productPrice) {
                showNotification('Gerekli alanları doldurunuz!', false);
                isSubmitting = false;
                return;
            }
            
            let imageUrl = uploadedProductImageUrl;
            
            // Yeni resim varsa yükle
            if (imageFile) {
                showUploadStatus(productImageStatus, 'Resim yükleniyor...', true);
                const uploadResult = await uploadToImageKit(imageFile, 'showly/products');
                
                if (uploadResult.success) {
                    imageUrl = uploadResult.url;
                    showUploadStatus(productImageStatus, '✓ Resim başarıyla yüklendi!', true);
                } else {
                    showUploadStatus(productImageStatus, '✗ Resim yükleme başarısız: ' + uploadResult.error, false);
                    isSubmitting = false;
                    return;
                }
            }
            
            if (editingProductId) {
                // Ürünü güncelle
                window.showlyDB.updateProduct(editingProductId, {
                    title: productName,
                    storeId: productStore,
                    price: productPrice,
                    description: productDescription,
                    material: productMaterial,
                    category: productCategory,
                    isOnSale: isOnSale, // <-- YENİ
                    originalPrice: originalPrice, // <-- YENİ EKLENDİ
                    imageUrl: imageUrl
                });
                showNotification('Ürün başarıyla güncellendi!');
            } else {
                // Yeni ürün ekle
                window.showlyDB.addProduct({
                    storeId: productStore,
                    title: productName,
                    price: productPrice,
                    description: productDescription,
                    material: productMaterial,
                    category: productCategory,
                    isOnSale: isOnSale, // <-- YENİ
                    originalPrice: originalPrice, // <-- YENİ EKLENDİ
                    imageUrl: imageUrl
                });
                showNotification('Ürün başarıyla eklendi!');
            }
            
            renderProductsTable(filterStoreSelect.value, filterCategorySelect.value);
            updateDashboard();
            closeAllModals();
        } catch (error) {
            console.error('Hata:', error);
            showNotification('Bir hata oluştu: ' + error.message, false);
        } finally {
            isSubmitting = false;
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
    
    // --- YARDIMCI FONKSİYONLAR ---
    
    // Mağaza seçimini doldur
    const populateStoreSelect = () => {
        const stores = window.showlyDB.getStores();
        productStoreSelect.innerHTML = '<option value="">Mağaza Seçin</option>';
        
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            productStoreSelect.appendChild(option);
        });
    };
    
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
    
    // --- FİLTRELEME OLAY DİNLEYİCİLERİ ---
    
    // Mağaza filtresi değiştiğinde
    filterStoreSelect.addEventListener('change', (e) => {
        const selectedStoreId = e.target.value;
        populateCategoryFilter(selectedStoreId);
        renderProductsTable(selectedStoreId, null); // Seçilen mağazanın tüm ürünlerini göster
    });

    // Kategori filtresi değiştiğinde
    filterCategorySelect.addEventListener('change', (e) => {
        const selectedStoreId = filterStoreSelect.value;
        const selectedCategory = e.target.value;
        renderProductsTable(selectedStoreId, selectedCategory);
    });
    
    // --- İLK YÜKLEME ---
    checkLoginStatus();
    updateDashboard();
    renderStoresTable();
    populateStoreFilter(); // Mağaza filtresini doldur
    renderProductsTable(); // Başlangıçta tüm ürünleri göster
});
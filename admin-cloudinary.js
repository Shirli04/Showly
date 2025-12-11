document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin paneli yüklendi...');

  // 🔐 Google Sheets ID’leri
  const STORES_SHEET_ID   = '1VLmWQD8nXhyq2D0J-kAUK5XL4tQQFnBnG_TOIcyGdPs';
  const PRODUCTS_SHEET_ID = '1hI7dOCS2jt514xkw1SboVChiyDC8K_kAcZGKG8tXIlI';

  // ☁️ Cloudinary sabitleri
  const CLOUD_NAME   = 'domv6ullp';
  const UPLOAD_PRESET= 'showly_upload';

  // DOM elemanları
  const navLinks            = document.querySelectorAll('.nav-link');
  const contentSections     = document.querySelectorAll('.content-section');
  const pageTitle           = document.getElementById('page-title');
  const addStoreBtn         = document.getElementById('add-store-btn');
  const addProductBtn       = document.getElementById('add-product-btn');
  const storeModal          = document.getElementById('store-modal');
  const productModal        = document.getElementById('product-modal');
  const closeModals         = document.querySelectorAll('.close-modal');
  const cancelStore         = document.getElementById('cancel-store');
  const cancelProduct       = document.getElementById('cancel-product');
  const storeForm           = document.getElementById('store-form');
  const productForm         = document.getElementById('product-form');
  const productStoreSelect  = document.getElementById('product-store');
  const storesTableBody     = document.getElementById('stores-table-body');
  const productsTableBody   = document.getElementById('products-table-body');
  const ordersTableBody     = document.getElementById('orders-table-body');
  const menuToggle          = document.querySelector('.menu-toggle');
  const adminSidebar        = document.querySelector('.admin-sidebar');
  const productImage        = document.getElementById('product-image');
  const productImagePreview = document.getElementById('product-image-preview');
  const productIsOnSale     = document.getElementById('product-is-on-sale');
  const originalPriceGroup  = document.getElementById('original-price-group');
  const productOriginalPrice= document.getElementById('product-original-price');

  let editingStoreId  = null;
  let editingProductId= null;
  let isSubmitting    = false;
  let tokenClient     = null;

  // Google ile giriş
    function initGoogleAuth() {
    // Google hesabı ile giriş
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: '1079376479162-stfokpgbsl7181h5scg95j3eiu4se3ii.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
            // Token başarılı
            gapi.auth.setToken({ access_token: tokenResponse.access_token });
            showNotification('Google ile giriş yapıldı!');
        } else {
            // Kullanıcı reddetti veya hata
            console.error('Google giriş hatası:', tokenResponse);
            showNotification('Google girişi başarısız veya iptal edildi!', false);
        }
        },
        error_callback: (err) => {
        console.error('Google OAuth hatası:', err);
        showNotification('Google girişinde hata oluştu!', false);
        }
    });
    }
    // İlk tıklamada çağır
    window.handleAuthClick = () => {
    if (!tokenClient) {
        showNotification('Google SDK henüz yüklenmedi, sayfayı yenileyin!', false);
        return;
    }
    tokenClient.requestAccessToken();
    };

  // Sheets’e satır ekleme
    async function appendToSheet(sheetId, range, rowArray) {
    const token = gapi?.auth?.getToken?.()?.access_token;
    if (!token) {
        showNotification('Google ile giriş gerekli! Lütfen tekrar deneyin.', false);
        return false;
    }
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW`;
    const body = { values: [rowArray] };
    try {
        const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
        });
        if (!res.ok) {
        const text = await res.text();
        console.error('Sheet yazma hatası:', text);
        showNotification('Sheet’e yazılamadı! (Detay: konsol)', false);
        return false;
        }
        return true;
    } catch (err) {
        console.error('Sheet ağ hatası:', err);
        showNotification('Sheet’e yazılamadı! (Ağ hatası)', false);
        return false;
    }
    }

  // Cloudinary’ye yükle
  async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: fd
    });
    if (!res.ok) throw new Error('Cloudinary yükleme hatası');
    const data = await res.json();
    return data.secure_url;
  }

  // Bildirim
  function showNotification(msg, success = true) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'notification';
    div.style.cssText = `position:fixed;bottom:20px;right:20px;background:${success?'#28a745':'#dc3545'};color:#fff;padding:12px 18px;border-radius:6px;z-index:10000`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // Modal kontrolleri
  function closeAllModals() {
    storeModal.style.display = productModal.style.display = 'none';
    storeForm.reset(); productForm.reset(); productImage.value = '';
    productImagePreview.classList.remove('show');
    editingStoreId = editingProductId = null; isSubmitting = false;
  }
  closeModals.forEach(btn => btn.addEventListener('click', closeAllModals));
  cancelStore.addEventListener('click', closeAllModals);
  cancelProduct.addEventListener('click', closeAllModals);
  window.addEventListener('click', e => { if (e.target === storeModal || e.target === productModal) closeAllModals(); });

  // İndirim checkbox göster/gizle
  productIsOnSale.addEventListener('change', () => {
    originalPriceGroup.style.display = productIsOnSale.checked ? 'block' : 'none';
  });

  // Navigasyon
  navLinks.forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const sectionId = link.getAttribute('data-section');
    contentSections.forEach(sec => sec.classList.toggle('active', sec.id === sectionId));
    pageTitle.textContent = link.textContent.trim();
  }));

  // Mağaza ekleme
  addStoreBtn.addEventListener('click', () => { editingStoreId = null; storeForm.reset(); storeModal.style.display = 'block'; });
  storeForm.addEventListener('submit', async e => {
    e.preventDefault(); if (isSubmitting) return; isSubmitting = true;
    const name = document.getElementById('store-name').value.trim();
    const desc = document.getElementById('store-description').value.trim();
    if (!name) { showNotification('Mağaza adı gerekli!', false); isSubmitting = false; return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
    const row = [Date.now().toString(), name, slug, desc, new Date().toISOString()];
    const ok = await appendToSheet(STORES_SHEET_ID, 'Sayfa1!A:E', row);
    if (ok) { showNotification('Mağaza eklendi!'); renderStoresTable(); populateStoreSelect(); updateDashboard(); closeAllModals(); } else { showNotification('Mağaza eklenemedi!', false); }
    isSubmitting = false;
  });

  // Ürün ekleme
  addProductBtn.addEventListener('click', () => { editingProductId = null; productForm.reset(); productImagePreview.classList.remove('show'); populateStoreSelect(); productModal.style.display = 'block'; });
  productForm.addEventListener('submit', async e => {
    e.preventDefault(); if (isSubmitting) return; isSubmitting = true;
    try {
      const title   = document.getElementById('product-name').value.trim();
      const storeId = document.getElementById('product-store').value;
      const price   = document.getElementById('product-price').value.trim();
      const desc    = document.getElementById('product-description').value.trim();
      const material= document.getElementById('product-material').value.trim();
      const category= document.getElementById('product-category').value.trim();
      const isOnSale= productIsOnSale.checked;
      const origPrice= productOriginalPrice.value.trim();
      const file    = productImage.files[0];
      if (!title || !storeId || !price) { showNotification('Zorunlu alanları doldurun!', false); isSubmitting = false; return; }
      let imageUrl = '';
      if (file) imageUrl = await uploadToCloudinary(file);
      const row = [
        Date.now().toString(), storeId, title, price, desc, material, category,
        imageUrl, isOnSale ? 'TRUE' : '', origPrice, new Date().toISOString()
      ];
      const ok = await appendToSheet(PRODUCTS_SHEET_ID, 'Sayfa1!A:K', row);
      if (ok) { showNotification('Ürün eklendi!'); renderProductsTable(); updateDashboard(); closeAllModals(); } else { showNotification('Ürün eklenemedi!', false); }
    } catch (err) { console.error(err); showNotification('Hata: ' + err.message, false); }
    isSubmitting = false;
  });

  // Mobil menü
  if (menuToggle) menuToggle.addEventListener('click', () => adminSidebar.classList.toggle('active'));

  // Tabloları doldur
  function renderStoresTable() {
    const stores = window.showlyDB?.stores || [];
    storesTableBody.innerHTML = stores.map(s => {
      const cnt = (window.showlyDB?.products || []).filter(p => p.storeId === s.id).length;
      return `<tr><td>${s.id}</td><td>${s.name}</td><td>${cnt}</td><td>
        <button class="btn-icon danger delete-store" data-id="${s.id}"><i class="fas fa-trash"></i></button>
      </td></tr>`;
    }).join('');
    storesTableBody.querySelectorAll('.delete-store').forEach(btn => btn.addEventListener('click', e => {
      if (confirm('Silinsin mi?')) {
        window.showlyDB.stores = window.showlyDB.stores.filter(x => x.id !== btn.dataset.id);
        window.showlyDB.saveToLocalStorage?.();
        renderStoresTable(); updateDashboard();
        showNotification('Mağaza silindi.');
      }
    }));
  }
  function renderProductsTable() {
    const products = window.showlyDB?.products || [];
    productsTableBody.innerHTML = products.map(p => {
      const store = (window.showlyDB?.stores || []).find(s => s.id === p.storeId);
      return `<tr><td>${p.id}</td><td>${p.title}</td><td>${store?.name||''}</td><td>${p.price}</td>
      <td>${p.imageUrl ? `<img src="${p.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">`:''}</td>
      <td><button class="btn-icon danger delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('');
    productsTableBody.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', e => {
      if (confirm('Silinsin mi?')) {
        window.showlyDB.products = window.showlyDB.products.filter(x => x.id !== btn.dataset.id);
        window.showlyDB.saveToLocalStorage?.();
        renderProductsTable(); updateDashboard();
        showNotification('Ürün silindi.');
      }
    }));
  }
  function populateStoreSelect() {
    const stores = window.showlyDB?.stores || [];
    productStoreSelect.innerHTML = '<option value="">Mağaza Seçin</option>' + stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  function updateDashboard() {
    const s = (window.showlyDB?.stores || []).length;
    const p = (window.showlyDB?.products || []).length;
    const o = (window.showlyDB?.orders || []).length;
    document.getElementById('total-stores').textContent   = s;
    document.getElementById('total-products').textContent = p;
    document.getElementById('total-orders').textContent   = o;
  }

  // İlk yükleme
  initGoogleAuth();
  populateStoreSelect();
  renderStoresTable();
  renderProductsTable();
  updateDashboard();
});
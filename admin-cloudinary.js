// Firebase Compat + Cloudinary
document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin paneli (Firebase Compat) yüklendi...');

  // Cloudinary sabitleri
  const CLOUD_NAME    = 'domv6ullp';
  const UPLOAD_PRESET = 'showly_upload';

  // DOM elemanları
  const addStoreBtn   = document.getElementById('add-store-btn');
  const addProductBtn = document.getElementById('add-product-btn');
  const storeForm     = document.getElementById('store-form');
  const productForm   = document.getElementById('product-form');
  const storesTableBody = document.getElementById('stores-table-body');
  const productsTableBody = document.getElementById('products-table-body');
  const ordersTableBody = document.getElementById('orders-table-body');
  const productStoreSelect = document.getElementById('product-store');
  const productImage = document.getElementById('product-image');
  const productImagePreview = document.getElementById('product-image-preview');
  const productIsOnSale = document.getElementById('product-is-on-sale');
  const originalPriceGroup = document.getElementById('original-price-group');
  const productOriginalPrice = document.getElementById('product-original-price');
  const storeModal = document.getElementById('store-modal');
  const productModal = document.getElementById('product-modal');
  const closeModals = document.querySelectorAll('.close-modal');
  const cancelStore = document.getElementById('cancel-store');
  const cancelProduct = document.getElementById('cancel-product');
  const menuToggle = document.querySelector('.menu-toggle');
  const adminSidebar = document.querySelector('.admin-sidebar');

  let isSubmitting = false;

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

  // Cloudinary’ye yükle
  async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Cloudinary yükleme hatası');
    const data = await res.json();
    return data.secure_url;
  }

  // Modal kontrolleri
  function closeAllModals() {
    storeModal.style.display = productModal.style.display = 'none';
    storeForm.reset(); productForm.reset(); productImage.value = '';
    productImagePreview.classList.remove('show');
  }
  closeModals.forEach(btn => btn.addEventListener('click', closeAllModals));
  cancelStore.addEventListener('click', closeAllModals);
  cancelProduct.addEventListener('click', closeAllModals);
  window.addEventListener('click', e => { if (e.target === storeModal || e.target === productModal) closeAllModals(); });

  // Mağaza ekleme
  addStoreBtn.addEventListener('click', () => { storeForm.reset(); storeModal.style.display = 'block'; });
  storeForm.addEventListener('submit', async e => {
    e.preventDefault(); if (isSubmitting) return; isSubmitting = true;
    const name = document.getElementById('store-name').value.trim();
    const desc = document.getElementById('store-description').value.trim();
    if (!name) { showNotification('Mağaza adı gerekli!', false); isSubmitting = false; return; }
    try {
      await window.showlyDB.addStore({ name, description: desc });
      showNotification('Mağaza eklendi!');
      renderStoresTable(); populateStoreSelect(); updateDashboard();
      closeAllModals();
    } catch (err) {
      console.error(err);
      showNotification('Mağaza eklenemedi!', false);
    } finally { isSubmitting = false; }
  });

  // Ürün ekleme
  addProductBtn.addEventListener('click', () => {
    productForm.reset(); productImagePreview.classList.remove('show'); populateStoreSelect(); productModal.style.display = 'block';
  });
  productForm.addEventListener('submit', async e => {
    e.preventDefault(); if (isSubmitting) return; isSubmitting = true;
    try {
      const title    = document.getElementById('product-name').value.trim();
      const storeId  = document.getElementById('product-store').value;
      const price    = document.getElementById('product-price').value.trim();
      const desc     = document.getElementById('product-description').value.trim();
      const material = document.getElementById('product-material').value.trim();
      const category = document.getElementById('product-category').value.trim();
      const isOnSale = productIsOnSale.checked;
      const origPrice= productOriginalPrice.value.trim();
      const file     = productImage.files[0];
      if (!title || !storeId || !price) { showNotification('Zorunlu alanları doldurun!', false); isSubmitting = false; return; }
      let imageUrl = '';
      if (file) imageUrl = await uploadToCloudinary(file);
      await window.showlyDB.addProduct({
        storeId, title, price, description: desc, material, category,
        imageUrl, isOnSale, originalPrice: origPrice
      });
      showNotification('Ürün eklendi!');
      renderProductsTable(); updateDashboard();
      closeAllModals();
    } catch (err) {
      console.error(err);
      showNotification('Ürün eklenemedi!', false);
    } finally { isSubmitting = false; }
  });

  // İndirim checkbox
  productIsOnSale.addEventListener('change', () => {
    originalPriceGroup.style.display = productIsOnSale.checked ? 'block' : 'none';
  });

  // Fotoğraf önizleme
  productImage.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        productImagePreview.src = ev.target.result;
        productImagePreview.classList.add('show');
      };
      reader.readAsDataURL(file);
    }
  });

  // Mobil menü
  if (menuToggle) menuToggle.addEventListener('click', () => adminSidebar.classList.toggle('active'));

  // Tabloları doldur
  async function renderStoresTable() {
    const stores = await window.showlyDB.getStores();
    storesTableBody.innerHTML = stores.map(s => `<tr>
      <td>${s.id}</td><td>${s.name}</td><td>${s.description||''}</td>
      <td><button class="btn-icon danger delete-store" data-id="${s.id}"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
    storesTableBody.querySelectorAll('.delete-store').forEach(btn => btn.addEventListener('click', async e => {
      if (confirm('Mağaza silinsin mi?')) {
        await window.showlyDB.deleteStore(btn.dataset.id);
        renderStoresTable(); populateStoreSelect(); updateDashboard();
        showNotification('Mağaza silindi.');
      }
    }));
  }
  async function renderProductsTable() {
    const [products, stores] = await Promise.all([window.showlyDB.getAllProducts(), window.showlyDB.getStores()]);
    productsTableBody.innerHTML = products.map(p => {
      const store = stores.find(s => s.id === p.storeId);
      return `<tr>
        <td>${p.id}</td><td>${p.title}</td><td>${store?.name||''}</td>
        <td>${p.price}</td>
        <td>${p.imageUrl ? `<img src="${p.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">`:''}</td>
        <td><button class="btn-icon danger delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    }).join('');
    productsTableBody.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', async e => {
      if (confirm('Ürün silinsin mi?')) {
        await window.showlyDB.deleteProduct(btn.dataset.id);
        renderProductsTable(); updateDashboard();
        showNotification('Ürün silindi.');
      }
    }));
  }
  async function populateStoreSelect() {
    const stores = await window.showlyDB.getStores();
    productStoreSelect.innerHTML = '<option value="">Mağaza Seçin</option>' + stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  async function updateDashboard() {
    const [stores, products] = await Promise.all([window.showlyDB.getStores(), window.showlyDB.getAllProducts()]);
    document.getElementById('total-stores').textContent   = stores.length;
    document.getElementById('total-products').textContent = products.length;
    document.getElementById('total-orders').textContent   = 0; // istersen orders koleksiyonu da aç
  }

  // İlk yükleme
  renderStoresTable();
  renderProductsTable();
  populateStoreSelect();
  updateDashboard();
});
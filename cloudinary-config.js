// Google Drive ve Excel Yönetimi
// Bu dosya artık localStorage yerine Google Drive'ı kullanır.

// class ShowlyDB {
//     constructor() {
//         this.stores = [];
//         this.products = [];
//         this.orders = [];
//         // Sayfa ilk yüklendiğinde verileri Google Drive'dan çekecek
//         this.loadDataFromDrive();
//     }
    
//     // Google Drive'dan verileri çekme
//     async loadDataFromDrive() {
//         if (window.storesData && window.productsData) {
//             this.stores = window.storesData;
//             this.products = window.productsData;
//             console.log('Veriler Google Drive\'dan başarıyla yüklendi.');
//         } else {
//             console.log('Google Drive verileri henüz hazır değil. Lütfen giriş yapın.');
//             // Veriler yüklenmediyse, boş başlat
//             this.stores = [];
//             this.products = [];
//         }
//     }
    
//     // Google Drive'a verileri kaydetme
//     async saveDataToDrive() {
//         if (window.saveAsExcel) {
//             // Mağaza verilerini kaydet
//             const storesFileId = 'root'; // Kök klasörün ID'si
//             window.saveAsExcel(storesFileId, 'stores.xlsx', this.stores, (success) => {
//                 if (success) {
//                     console.log('Mağaza verileri Google Drive\'a kaydedildi.');
//                 } else {
//                     console.error('Mağaza verileri kaydedilemedi.');
//                 }
//             });

//             // Ürün verilerini kaydet
//             const productsFileId = 'root'; // Kök klasörün ID'si
//             window.saveAsExcel(productsFileId, 'products.xlsx', this.products, (success) => {
//                 if (success) {
//                     console.log('Ürün verileri Google Drive\'a kaydedildi.');
//                 } else {
//                     console.error('Ürün verileri kaydedilemedi.');
//                 }
//             });
//         } else {
//             console.error('Google Drive kaydetme fonksiyonu bulunamadı.');
//         }
//     }
    
//     // --- MAĞAZA FONKSİYONLARI ---
//     getStores() {
//         // Veriler her zaman Drive'dan en güncel halde tutulmalı
//         this.loadDataFromDrive();
//         return this.stores;
//     }
    
//     async addStore(store) {
//         const slug = store.name.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
//         const newStore = {
//             id: Date.now().toString(),
//             name: store.name,
//             slug: slug,
//             description: store.description,
//             createdAt: new Date().toISOString()
//         };
//         this.stores.push(newStore);
//         this.saveDataToDrive();
//         return newStore;
//     }
    
//     async updateStore(storeId, updates) {
//         const storeIndex = this.stores.findIndex(s => s.id === storeId);
//         if (storeIndex !== -1) {
//             this.stores[storeIndex] = { ...this.stores[storeIndex], ...updates };
//             this.saveDataToDrive();
//             return this.stores[storeIndex];
//         }
//         return null;
//     }
    
//     async deleteStore(storeId) {
//         this.stores = this.stores.filter(s => s.id !== storeId);
//         this.products = this.products.filter(p => p.storeId !== storeId);
//         this.saveDataToDrive();
//     }
    
//     // --- ÜRÜN FONKSİYONLARI ---
//     getProductsByStoreId(storeId) {
//         // Veriler her zaman Drive'dan en güncel halde tutulmalı
//         this.loadDataFromDrive();
//         return this.products.filter(p => p.storeId === storeId);
//     }
    
//     getAllProducts() {
//         this.loadDataFromDrive();
//         return this.products;
//     }
    
//     getProductById(productId) {
//         this.loadDataFromDrive();
//         return this.products.find(p => p.id === productId);
//     }
    
//     async addProduct(product) {
//         const newProduct = {
//             id: Date.now().toString(),
//             storeId: product.storeId,
//             title: product.title,
//             price: product.price,
//             description: product.description,
//             material: product.material,
//             category: product.category,
//             isOnSale: product.isOnSale || false,
//             originalPrice: product.originalPrice || '',
//             imageUrl: product.imageUrl,
//             imagePublicId: product.imagePublicId,
//             variants: product.variants || [],
//             createdAt: new Date().toISOString()
//         };
//         this.products.push(newProduct);
//         this.saveDataToDrive();
//         return newProduct;
//     }
    
//     async updateProduct(productId, updates) {
//         const productIndex = this.products.findIndex(p => p.id === productId);
//         if (productIndex !== -1) {
//             this.products[productIndex] = { ...this.products[productIndex], ...updates };
//             this.saveDataToDrive();
//             return this.products[productIndex];
//         }
//         return null;
//     }
    
//     async deleteProduct(productId) {
//         this.products = this.products.filter(p => p.id !== productId);
//         this.saveDataToDrive();
//     }
    
//     // --- SİPARİŞ FONKSİYONLARI ---
//     getOrders() {
//         // Siparişler localStorage'de kalabilir çünkü bunların Drive'da senkronizasyonu kritik değil
//         try {
//             const orders = localStorage.getItem('showlyOrders');
//             return orders ? JSON.parse(orders) : [];
//         } catch (error) {
//             console.error('Siparişler yüklenirken hata:', error);
//             return [];
//         }
//     }
    
//     addOrder(order) {
//         // Siparişler localStorage'de kalabilir
//         let orders = this.getOrders();
//         const newOrder = {
//             id: '#' + Date.now(),
//             customer: order.customer,
//             date: new Date().toISOString(),
//             total: order.total,
//             status: 'pending',
//             items: order.items
//         };
//         orders.push(newOrder);
//         try {
//             localStorage.setItem('showlyOrders', JSON.stringify(orders));
//         } catch (error) {
//             console.error('Sipariş kaydedilirken hata:', error);
//         }
//         return newOrder;
//     }
// }

// Global DB instance'ını oluştur
window.showlyDB = new ShowlyDB();
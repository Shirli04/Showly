// Cloudinary Yapılandırması
// Firebase'den dışa aktarılan veritabanı örneğini al
import { db } from './firebase-config.js';

const CLOUDINARY_CONFIG = {
    cloud_name: 'domv6ullp',
    upload_preset: 'my_product_uploads',
    api_key: '134496279398553'
};

// Cloudinary'ye dosya yükleme fonksiyonu
async function uploadToCloudinary(file, folder = 'showly') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.upload_preset);
    formData.append('folder', folder);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/auto/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error('Cloudinary yükleme başarısız');
        }
        
        const data = await response.json();
        
        return {
            success: true,
            url: data.secure_url,
            publicId: data.public_id,
            filename: data.original_filename
        };
    } catch (error) {
        console.error('Yükleme hatası:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Cloudinary'den dosya silme fonksiyonu
async function deleteFromCloudinary(publicId) {
    // NOT: Client-side'da silme işlemi güvenlik nedeniyle sınırlıdır
    // Gerçek uygulamada backend'de yapılmalıdır
    console.log('Silme işlemi backend tarafından yapılmalıdır:', publicId);
    return true;
}

// localStorage ve Cloudinary senkronizasyonu
class ShowlyDB {
    constructor() {
        this.stores = [];
        this.products = [];
        this.orders = [];
        this.loadFromLocalStorage();
    }
    
    // localStorage'dan yükle
    loadFromLocalStorage() {
        const loadItem = (key) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : [];
            } catch (error) {
                console.error(`localStorage'dan ${key} yüklenirken hata oluştu. Bozuk veri temizleniyor.`, error);
                // Eğer veri bozuksa, o veriyi localStorage'dan silerek gelecekteki hataları önle.
                localStorage.removeItem(key);
                return [];
            }
        };

        this.stores = loadItem('showlyStores');
        this.products = loadItem('showlyProducts');
        this.orders = loadItem('showlyOrders');
    }
    
    // localStorage'a kaydet
    saveToLocalStorage() {
        try {
            localStorage.setItem('showlyStores', JSON.stringify(this.stores));
            localStorage.setItem('showlyProducts', JSON.stringify(this.products));
            localStorage.setItem('showlyOrders', JSON.stringify(this.orders));
        } catch (error) {
            console.error('localStorage kaydetme hatası:', error);
        }
    }
    
    // Tüm mağazaları getir
    getStores() {
        return this.stores;
    }
    
    // Yeni mağaza ekle
    addStore(store) {
    const slug = store.name
        .toLowerCase()
        .replace(/[^a-z0-9çğıöşü]+/g, '-') // Türkçe karakterlere izin ver
        .replace(/^-+|-+$/g, '');           // baştaki/sondaki tireleri sil

    const newStore = {
        id: Date.now().toString(),
        name: store.name,
        slug: slug,               // ← yeni alan
        description: store.description,
        createdAt: new Date().toISOString()
    };
    this.stores.push(newStore);
    this.saveToLocalStorage();
    return newStore;
    }
    
    // Mağazayı güncelle
    updateStore(storeId, updates) {
        const storeIndex = this.stores.findIndex(s => s.id === storeId);
        if (storeIndex !== -1) {
            this.stores[storeIndex] = { ...this.stores[storeIndex], ...updates };
            this.saveToLocalStorage();
            return this.stores[storeIndex];
        }
        return null;
    }
    
    // Mağazayı sil
    deleteStore(storeId) {
        this.stores = this.stores.filter(s => s.id !== storeId);
        this.products = this.products.filter(p => p.storeId !== storeId);
        this.saveToLocalStorage();
    }
    
    // Mağazaya göre ürünleri getir
    getProductsByStoreId(storeId) {
        return this.products.filter(p => p.storeId === storeId);
    }
    
    // Tüm ürünleri getir
    getAllProducts() {
        return this.products;
    }
    
    // ID'ye göre ürünü getir
    getProductById(productId) {
        return this.products.find(p => p.id === productId);
    }
    
    // YENİ VE DOĞRU HALİ
    addProduct(product) {
        const newProduct = {
            id: Date.now().toString(),
            storeId: product.storeId,
            title: product.title,
            price: product.price,
            description: product.description,
            material: product.material,
            category: product.category, // <-- BU SATIRI EKLEYİN
            imageUrl: product.imageUrl,
            imagePublicId: product.imagePublicId,
            variants: product.variants || [],
            createdAt: new Date().toISOString()
        };
        this.products.push(newProduct);
        this.saveToLocalStorage();
        return newProduct;
    }
    
    // Ürünü güncelle
    updateProduct(productId, updates) {
        const productIndex = this.products.findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            this.products[productIndex] = { ...this.products[productIndex], ...updates };
            this.saveToLocalStorage();
            return this.products[productIndex];
        }
        return null;
    }
    
    // Ürünü sil
    deleteProduct(productId) {
        this.products = this.products.filter(p => p.id !== productId);
        this.saveToLocalStorage();
    }
    
    // Siparişleri getir
    getOrders() {
        return this.orders;
    }
    
    // Sipariş ekle
    addOrder(order) {
        const newOrder = {
            id: '#' + Date.now(),
            customer: order.customer,
            date: new Date().toISOString(),
            total: order.total,
            status: 'pending',
            items: order.items
        };
        this.orders.push(newOrder);
        this.saveToLocalStorage();
        return newOrder;
    }
}

// Global DB instance'ını oluştur
window.showlyDB = new ShowlyDB();
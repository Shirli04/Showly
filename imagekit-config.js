// ImageKit Yapılandırması
const imagekit = new ImageKit({
    publicKey: "public_QYN4L2aoGqYM1/QrvMt8keWYXy0=",
    urlEndpoint: "https://ik.imagekit.io/xrug0sh8q", // ImageKit ID'niz ile otomatik oluşur
    authenticationEndpoint: "https://your-server.com/auth" // Client-side'da bu gerekli değil
});

// ImageKit'ye dosya yükleme fonksiyonu
async function uploadToImageKit(file, folder = 'showly') {
    const fileName = `${Date.now()}_${file.name}`;

    try {
        const response = await imagekit.upload({
            file: file,
            fileName: fileName,
            folder: folder,
            useUniqueFileName: false // Kendi verdiğimiz ismi kullan
        });
        
        if (response && response.url) {
            return {
                success: true,
                url: response.url,
                fileId: response.fileId,
                name: response.name
            };
        } else {
            throw new Error('ImageKit yanıtı beklenmedik.');
        }
    } catch (error) {
        console.error('ImageKit yükleme hatası:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Global olarak erişilebilir kılma
window.imagekitSDK = imagekit;
window.uploadToImageKit = uploadToImageKit;

// localStorage ve ImageKit senkronizasyonu (ShowlyDB sınıfı)
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
    getStores() { return this.stores; }
    
    // Yeni mağaza ekle
    addStore(store) {
        const slug = store.name.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
        const newStore = {
            id: Date.now().toString(), name: store.name, slug: slug, description: store.description, createdAt: new Date().toISOString()
        };
        this.stores.push(newStore); this.saveToLocalStorage(); return newStore;
    }
    
    // Mağazayı güncelle
    updateStore(storeId, updates) {
        const storeIndex = this.stores.findIndex(s => s.id === storeId);
        if (storeIndex !== -1) { this.stores[storeIndex] = { ...this.stores[storeIndex], ...updates }; this.saveToLocalStorage(); return this.stores[storeIndex]; }
        return null;
    }
    
    // Mağazayı sil
    deleteStore(storeId) {
        this.stores = this.stores.filter(s => s.id !== storeId);
        this.products = this.products.filter(p => p.storeId !== storeId);
        this.saveToLocalStorage();
    }
    
    // Mağazaya göre ürünleri getir
    getProductsByStoreId(storeId) { return this.products.filter(p => p.storeId === storeId); }
    
    // Tüm ürünleri getir
    getAllProducts() { return this.products; }
    
    // ID'ye göre ürünü getir
    getProductById(productId) { return this.products.find(p => p.id === productId); }
    
    // Yeni ürün ekle
    addProduct(product) {
        const newProduct = {
            id: Date.now().toString(), storeId: product.storeId, title: product.title, price: product.price,
            description: product.description, material: product.material, category: product.category,
            isOnSale: product.isOnSale || false, originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl, imageFileId: product.imageFileId, // ImageKit için
            variants: product.variants || [], createdAt: new Date().toISOString()
        };
        this.products.push(newProduct); this.saveToLocalStorage(); return newProduct;
    }
    
    // Ürünü güncelle
    updateProduct(productId, updates) {
        const productIndex = this.products.findIndex(p => p.id === productId);
        if (productIndex !== -1) { this.products[productIndex] = { ...this.products[productIndex], ...updates }; this.saveToLocalStorage(); return this.products[productIndex]; }
        return null;
    }
    
    // Ürünü sil
    deleteProduct(productId) { this.products = this.products.filter(p => p.id !== productId); this.saveToLocalStorage(); }
    
    // Siparişleri getir
    getOrders() { return this.orders; }
    
    // Sipariş ekle
    addOrder(order) {
        const newOrder = { id: '#' + Date.now(), customer: order.customer, date: new Date().toISOString(), total: order.total, status: 'pending', items: order.items };
        this.orders.push(newOrder); this.saveToLocalStorage(); return newOrder;
    }
}

// Global DB instance'ını oluştur
window.showlyDB = new ShowlyDB();
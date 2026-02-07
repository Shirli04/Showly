// Firebase "Compat" SDK'sı ile yapılandırma
const firebaseConfig = {
    apiKey: "AIzaSyAGnYprUlgaZjiIyODbdqZVJzqvZ8iGO2g",
    authDomain: "showlytm-04.firebaseapp.com",
    projectId: "showlytm-04",
    storageBucket: "showlytm-04.firebasestorage.app",
    appId: "1:929629780738:web:b965afeed4d6bec32d601b"
};

// Firebase'i Başlat
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);

    // Firestore Veritabanına Erişim
    const db = firebase.firestore();

    // Veritabanını (db) diğer scriptlerin kullanabileceği yap
    window.db = db;
    try {
        db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            ignoreUndefinedProperties: true,
            experimentalForceLongPolling: true, // ✅ ZORUNLU: Kısıtlı ağlarda bağlantı için sadece Long Polling kullan
            useFetchStreams: false              // ✅ YENİ: Bazı güvenlik duvarlarını aşmak için fetch stream'leri kapat
        });
        console.log('🚀 Firestore: Long Polling zorunlu kılındı (Kısıtlı ağ modu)');

        // ✅ Çevrimdışı Kalıcılığı Etkinleştir
        db.enablePersistence({ synchronizeTabs: true })
            .then(() => {
                console.log('📦 Firestore: Çevrimdışı kalıcılık etkinleşti');
            })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: Multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Persistence is not available in this browser');
                }
            });
    } catch (e) {
        console.warn('Firestore settings already configured or failed:', e.message);
    }
} else {
    console.error('❌ Firebase SDK yüklenemedi! İnternet bağlantınızı veya CDN linklerini kontrol edin.');
    window.db = null;
}

// localStorage ve Firebase senkronizasyonu
class ShowlyDB {
    constructor() {
        // Artık localStorage'a ihtiyacımız yok, veriler Firebase'de
    }

    // --- MAĞAZA FONKSİYONLARI (Firestore ile) ---

    // Tüm mağazaları getir
    async getStores() {
        if (!window.db) return [];
        const snapshot = await window.db.collection('stores').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Yeni mağaza ekle
    async addStore(store) {
        if (!window.db) return null;
        const slug = store.name
            .toLowerCase()
            .replace(/[^a-z0-9çğıöşü]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const newStore = {
            name: store.name,
            slug: slug,
            description: store.description,
            category: store.category || '', // ✅ YENİ
            customBannerText: store.customBannerText || '',
            tiktok: store.tiktok || '',
            instagram: store.instagram || '',
            phone: store.phone || '',
            location: store.location || '',
            createdAt: new Date().toISOString()
        };

        const docRef = await window.db.collection('stores').add(newStore);
        console.log('Mağaza Firebase\'ye eklendi, ID:', docRef.id, 'phone:', store.phone, 'location:', store.location);
        return { id: docRef.id, ...newStore };
    }

    // Mağazayı güncelle
    async updateStore(storeId, updates) {
        if (!window.db) return null;
        await window.db.collection('stores').doc(storeId).update(updates);
        const updatedDoc = await window.db.collection('stores').doc(storeId).get();
        console.log('Mağaza güncellendi:', updatedDoc.id);
        return { id: updatedDoc.id, ...updatedDoc.data() };
    }

    // Mağazayı sil
    async deleteStore(storeId) {
        if (!window.db) return;
        const batch = window.db.batch();

        // Önce o mağazaya ait ürünleri sil
        const productsSnapshot = await window.db.collection('products').where('storeId', '==', storeId).get();
        productsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        // Mağazayı sil
        batch.delete(window.db.collection('stores').doc(storeId));

        await batch.commit();
        console.log('Mağaza ve ürünleri silindi:', storeId);
    }

    // --- ÜRÜN FONKSİYONLARI (Firestore ile) ---

    // Mağazaya göre ürünleri getir
    async getProductsByStoreId(storeId) {
        if (!window.db) return [];
        const snapshot = await window.db.collection('products').where('storeId', '==', storeId).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Tüm ürünleri getir
    async getAllProducts() {
        if (!window.db) return [];
        const snapshot = await window.db.collection('products').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ID'ye göre ürünü getir
    async getProductById(productId) {
        if (!window.db) return null;
        const doc = await window.db.collection('products').doc(productId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    }

    // Yeni ürün ekle
    async addProduct(product) {
        if (!window.db) return null;
        const newProduct = {
            storeId: product.storeId,
            title: product.title,
            price: product.price,
            description: product.description,
            material: product.material,
            category: product.category,
            isOnSale: product.isOnSale || false,
            originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl,
            imagePublicId: product.imagePublicId,
            variants: product.variants || [],
            createdAt: new Date().toISOString()
        };
        const docRef = await window.db.collection('products').add(newProduct);
        console.log('Ürün Firebase\'ye eklendi, ID:', docRef.id);
        return { id: docRef.id, ...newProduct };
    }

    // Ürünü güncelle
    async updateProduct(productId, updates) {
        if (!window.db) return null;
        await window.db.collection('products').doc(productId).update(updates);
        const updatedDoc = await window.db.collection('products').doc(productId).get();
        console.log('Ürün güncellendi:', updatedDoc.id);
        return { id: updatedDoc.id, ...updatedDoc.data() };
    }

    // Ürünü sil
    async deleteProduct(productId) {
        if (!window.db) return;
        await window.db.collection('products').doc(productId).delete();
        console.log('Ürün silindi:', productId);
    }

    // --- SİPARİŞ FONKSİYONLARI (Firestore ile) ---

    // Siparişleri getir
    async getOrders() {
        if (!window.db) return [];
        const snapshot = await window.db.collection('orders').orderBy('date', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Sipariş ekle
    async addOrder(order) {
        if (!window.db) return null;
        const newOrder = {
            customer: order.customer,
            date: new Date().toISOString(),
            total: order.total,
            status: 'pending',
            items: order.items
        };
        const docRef = await window.db.collection('orders').add(newOrder);
        console.log('Sipariş Firebase\'ye eklendi, ID:', docRef.id);
        return { id: docRef.id, ...newOrder };
    }
}

// ✅ YENİ: Varsayılan kategorileri ekle (ilk kurulumda)
async function initializeCategories() {
    if (!window.db) return;
    try {
        const categoriesSnapshot = await db.collection('categories').get();
        console.log('✅ Kategori sistemi hazır');
    } catch (e) {
        console.log('Kategori sistemi yüklenemedi:', e.message);
    }
}

// Sayfa yüklenince kategorileri kontrol et
initializeCategories();

// Global DB instance'ını oluştur
window.showlyDB = new ShowlyDB();

// ==================== MAĞAZA VE ÜRÜN EKLEMİ FONKSİYONLARI ====================

// Mağaza ekle (Firestore)
window.addStoreToFirebase = async function (store) {
    if (!window.db) return null;
    const slug = store.name
        .toLowerCase()
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const doc = await window.db.collection('stores').add({
        name: store.name,
        slug: slug,
        description: store.description || '',
        category: store.category || '',
        customBannerText: store.customBannerText || '',
        tiktok: store.tiktok || '',
        instagram: store.instagram || '',
        phone: store.phone || '',
        location: store.location || '',
        orderPhone: store.orderPhone || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Mağaza Firebase\'e eklendi, ID:', doc.id, 'phone:', store.phone, 'location:', store.location, 'orderPhone:', store.orderPhone);
    return {
        id: doc.id,
        name: store.name,
        slug,
        description: store.description,
        category: store.category,
        customBannerText: store.customBannerText,
        tiktok: store.tiktok,
        instagram: store.instagram,
        phone: store.phone,
        location: store.location,
        orderPhone: store.orderPhone
    };
};

// Ürün ekle (Firestore)
window.addProductToFirebase = async function (product) {
    if (!window.db) return null;
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

    console.log('✅ Ürün Firebase\'e eklendi, ID:', doc.id);
    return { id: doc.id, ...product };
};

// Mağaza sil (Firestore)
window.deleteStoreFromFirebase = async function (storeId) {
    if (!window.db) return;
    const batch = window.db.batch();

    // Önce o mağazaya ait ürünleri sil
    const productsSnapshot = await window.db.collection('products')
        .where('storeId', '==', storeId)
        .get();

    productsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Mağazayı sil
    batch.delete(window.db.collection('stores').doc(storeId));

    await batch.commit();
    console.log('✅ Mağaza ve ürünleri silindi:', storeId);
};

// Ürün sil (Firestore)
window.deleteProductFromFirebase = async function (productId) {
    if (!window.db) return;
    await window.db.collection('products').doc(productId).delete();
    console.log('✅ Ürün silindi:', productId);
};

// Tüm mağazaları getir (Firestore)
window.getStoresFromFirebase = async function () {
    if (!window.db) return [];
    const snapshot = await window.db.collection('stores').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Tüm ürünleri getir (Firestore)
window.getProductsFromFirebase = async function () {
    if (!window.db) return [];
    const snapshot = await window.db.collection('products').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
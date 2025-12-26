// Cloudflare Workers KV API Config
const CLOUDFLARE_API = {
    baseUrl: 'https://showly-api.showlytmstore.workers.dev'
};

// API çağrıları için yardımcı fonksiyon
async function fetchAPI(endpoint, options = {}) {
    const url = `${CLOUDFLARE_API.baseUrl}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Hatası: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API çağrısı başarısız:', error);
        throw error;
    }
}

window.cloudflareAPI = {
    // Mağaza işlemleri
    stores: {
        getAll: () => fetchAPI('/stores'),
        create: (store) => fetchAPI('/stores', {
            method: 'POST',
            body: JSON.stringify(store)
        }),
        update: (id, updates) => fetchAPI(`/stores/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }),
        delete: (id) => fetchAPI(`/stores/${id}`, {
            method: 'DELETE'
        })
    },
    
    // Ürün işlemleri
    products: {
        getAll: () => fetchAPI('/products'),
        getByStore: (storeId) => fetchAPI(`/products/store/${storeId}`),
        create: (product) => fetchAPI('/products', {
            method: 'POST',
            body: JSON.stringify(product)
        }),
        update: (id, updates) => fetchAPI(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }),
        delete: (id) => fetchAPI(`/products/${id}`, {
            method: 'DELETE'
        })
    },
    
    // Sipariş işlemleri
    orders: {
        getAll: () => fetchAPI('/orders'),
        create: (order) => fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify(order)
        })
    }
};
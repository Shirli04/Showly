// Excel dosyası yönetimi
// SheetJS kütüphanesini HTML'de şu şekilde import edin:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

class ExcelManager {

    // Mağazaları Excel'e dönüştür ve indir
    static async exportStoresToExcel() {
        try {
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const excelData = stores.map(store => ({
                'Mağaza ID': store.id,
                'Mağaza Adı': store.name,
                'Açıklama': store.description || '',
                'Oluşturulma Tarihi': store.createdAt || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Mağazalar');

            XLSX.writeFile(workbook, 'showly_magazines.xlsx');
        } catch (error) {
            console.error('Mağazalar indirilemedi:', error);
            alert('Mağazalar indirilemedi: ' + error.message);
        }
    }

    // Ürünleri Excel'e dönüştür ve indir
    static async exportProductsToExcel() {
        try {
            const productsSnapshot = await window.db.collection('products').get();
            const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const excelData = products.map(product => {
                const store = stores.find(s => s.id === product.storeId);
                // Yeni yapıya göre: price = normal fiyat, originalPrice = indirimli fiyat
                // Yeni sütunlar: "Normal Fiyat", "İndirimli Fiyat"
                // "İndirimde mi?" sütunu kaldırıldı
                return {
                    'Mağaza Adı': store ? store.name : 'Bilinmiyor',
                    'Ürün Adı': product.title,
                    'Normal Fiyat': product.price ? product.price.replace(' TMT', '') : '', // Sadece sayıyı al
                    'İndirimli Fiyat': product.originalPrice ? product.originalPrice.replace(' TMT', '') : '', // Sadece sayıyı al, yoksa boş
                    'Kategori': product.category || '',
                    'Malzeme': product.material || '',
                    'Açıklama': product.description || '',
                    'Resim URL': product.imageUrl || ''
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler');

            XLSX.writeFile(workbook, 'showly_products.xlsx');
        } catch (error) {
            console.error('Ürünler indirilemedi:', error);
            alert('Ürünler indirilemedi: ' + error.message);
        }
    }

    // Mağazaları Excel'den içe aktar
    static async importStoresFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    let successCount = 0;

                    for (const row of jsonData) {
                        try {
                            const storeName = (row['Mağaza Adı'] || '').trim();
                            const store = stores.find(s => s.name.toLowerCase() === storeName.toLowerCase());

                            if (!store) {
                                errorCount++;
                                errors.push(`❌ "${storeName}" mağazası bulunamadı`);
                                continue;
                            }

                            // Yeni yapıya göre verileri al: "Normal Fiyat", "İndirimli Fiyat"
                            const normalPriceValue = row['Normal Fiyat'] ? String(row['Normal Fiyat']).trim() : '';
                            const discountedPriceValue = row['İndirimli Fiyat'] ? String(row['İndirimli Fiyat']).trim() : '';

                            // Fiyat formatını düzenle (TMT ekle)
                            const price = normalPriceValue ? (normalPriceValue.includes('TMT') ? normalPriceValue : `${normalPriceValue} TMT`) : '';
                            const originalPrice = discountedPriceValue ? (discountedPriceValue.includes('TMT') ? discountedPriceValue : `${discountedPriceValue} TMT`) : '';

                            // isOnSale mantığını sadece "İndirimli Fiyat" sütununa göre belirle
                            // Eğer "İndirimli Fiyat" doluysa, ürün indirimdedir.
                            const isOnSale = !!originalPrice; // originalPrice doluysa true, boşsa false

                            const productData = {
                                storeId: store.id,
                                title: row['Ürün Adı'],
                                price, // Normal fiyat
                                originalPrice, // İndirimli fiyat (eğer varsa)
                                category: row['Kategori'] || '',
                                material: row['Malzeme'] || '',
                                description: row['Açıklama'] || '',
                                imageUrl: row['Resim URL'] || '',
                                isOnSale, // Indirim durumu (sadece indirimli fiyat doluysa true)
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            await window.db.collection('products').add(productData);
                            successCount++;
                        } catch (err) {
                            errorCount++;
                            errors.push(err.message);
                        }
                    }

                    resolve({
                        success: true,
                        count: successCount,
                        message: `${successCount} mağaza başarıyla içe aktarıldı`
                    });
                } catch (error) {
                    reject({ success: false, error: error.message });
                }
            };

            reader.onerror = () => reject({ success: false, error: 'Dosya okunamadı' });
            reader.readAsArrayBuffer(file);
        });
    }

    // Ürünleri Excel'den Firebase'e yükle (OTOMATİK)
    static async importProductsFromExcel(file) {
        loadingOverlay.style.display = 'flex';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    const storesSnapshot = await window.db.collection('stores').get();
                    const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    for (const row of jsonData) {
                        try {
                            const storeName = (row['Mağaza Adı'] || '').trim();
                            const store = stores.find(s => s.name.toLowerCase() === storeName.toLowerCase());

                            if (!store) {
                                errorCount++;
                                errors.push(`❌ "${storeName}" mağazası bulunamadı`);
                                continue;
                            }

                            const priceValue = row['Fiyat'] ? String(row['Fiyat']).trim() : '';
                            const price = priceValue.includes('TMT') ? priceValue : `${priceValue} TMT`;

                            const oldPriceValue = row['Eski Fiyat'] ? String(row['Eski Fiyat']).trim() : '';
                            const originalPrice = oldPriceValue ? `${oldPriceValue} TMT` : '';

                            const productData = {
                                storeId: store.id,
                                title: row['Ürün Adı'],
                                price,
                                originalPrice,
                                category: row['Kategori'] || '',
                                material: row['Malzeme'] || '',
                                description: row['Açıklama'] || '',
                                imageUrl: row['Resim URL'] || '',
                                isOnSale: originalPrice && parseFloat(originalPrice) > parseFloat(price),
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            await window.db.collection('products').add(productData);
                            successCount++;
                        } catch (err) {
                            errorCount++;
                            errors.push(err.message);
                        }
                    }

                    loadingOverlay.style.display = 'none';
                    resolve({ success: true, successCount, errorCount, errors });

                } catch (error) {
                    reject({ success: false, error: error.message });
                }
            };

            reader.onerror = () => reject({ success: false, error: 'Dosya okunamadı' });
            reader.readAsArrayBuffer(file);
        });
    }
}

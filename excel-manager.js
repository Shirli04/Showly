// Excel dosyası yönetimi
class ExcelManager {
    
    // Mağazaları Excel'e dönüştür ve indir
    static exportStoresToExcel() {
        const stores = window.showlyDB.getStores();
        
        // Excel verilerine dönüştür
        const excelData = stores.map(store => ({
            'Mağaza ID': store.id,
            'Mağaza Adı': store.name,
            'Açıklama': store.description || '',
            'Logo URL': store.logoUrl || '',
            'Oluşturulma Tarihi': store.createdAt
        }));
        
        // Excel çalışma kitabı oluştur
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Mağazalar');
        
        // İndir
        XLSX.writeFile(workbook, 'showly_magazines.xlsx');
    }
    
    // Ürünleri Excel'e dönüştür ve indir
    static async exportProductsToExcel() {
        const productsSnapshot = await window.db.collection('products').get();
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const storesSnapshot = await window.db.collection('stores').get();
        const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Excel verilerine dönüştür
        const excelData = products.map(product => {
            const store = stores.find(s => s.id === product.storeId);
            return {
                'Mağaza Adı': store ? store.name : 'Bilinmiyor',
                'Ürün Adı': product.title,
                'Fiyat': product.price.replace(' TMT', ''),
                'Eski Fiyat': product.originalPrice ? product.originalPrice.replace(' TMT', '') : '',
                'Kategori': product.category || '',
                'Malzeme': product.material || '',
                'Açıklama': product.description || '',
                'Resim URL': product.imageUrl || ''
            };
        });
        
        // Excel çalışma kitabı oluştur
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler');
        
        // İndir
        XLSX.writeFile(workbook, 'showly_products.xlsx');
    }
    
    // Mağazaları Excel'den içe aktar
    static importStoresFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    // Mağazaları ekle
                    jsonData.forEach(row => {
                        window.showlyDB.addStore({
                            name: row['Mağaza Adı'],
                            description: row['Açıklama'] || '',
                            logoUrl: row['Logo URL'] || ''
                        });
                    });
                    
                    resolve({
                        success: true,
                        count: jsonData.length,
                        message: `${jsonData.length} mağaza başarıyla içe aktarıldı`
                    });
                } catch (error) {
                    reject({
                        success: false,
                        error: error.message
                    });
                }
            };
            
            reader.onerror = () => {
                reject({
                    success: false,
                    error: 'Dosya okunamadı'
                });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    // ✅ YENİ: Ürünleri Excel'den Firebase'e yükle (OTOMATİK)
    static async importProductsFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    // 1. Excel dosyasını oku
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    console.log('📊 Excel verisi okundu:', jsonData);
                    
                    // 2. Firebase'den mağazaları çek
                    const storesSnapshot = await window.db.collection('stores').get();
                    const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    console.log('🏪 Mağazalar yüklendi:', stores);
                    
                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];
                    
                    // 3. Her ürünü işle
                    for (const row of jsonData) {
                        try {
                            console.log('🔄 İşleniyor:', row);
                            
                            // Mağazayı bul (büyük/küçük harf duyarsız)
                            const storeName = (row['Mağaza Adı'] || '').trim();
                            const store = stores.find(s => 
                                s.name.toLowerCase() === storeName.toLowerCase()
                            );
                            
                            if (!store) {
                                errorCount++;
                                errors.push(`❌ "${storeName}" mağazası bulunamadı - Ürün: ${row['Ürün Adı']}`);
                                console.error(`Mağaza bulunamadı: ${storeName}`);
                                continue;
                            }
                            
                            // Ürün adı kontrolü
                            const productTitle = (row['Ürün Adı'] || '').trim();
                            if (!productTitle) {
                                errorCount++;
                                errors.push(`❌ Ürün adı eksik`);
                                continue;
                            }
                            
                            // Fiyat kontrolü
                            const priceValue = row['Fiyat'] ? String(row['Fiyat']).trim() : '';
                            if (!priceValue) {
                                errorCount++;
                                errors.push(`❌ Fiyat eksik - Ürün: ${productTitle}`);
                                continue;
                            }
                            
                            // Fiyatı düzenle (TMT ekle)
                            const price = priceValue.includes('TMT') ? priceValue : `${priceValue} TMT`;
                            
                            // Eski fiyat kontrolü
                            const oldPriceValue = row['Eski Fiyat'] ? String(row['Eski Fiyat']).trim() : '';
                            const originalPrice = oldPriceValue ? (oldPriceValue.includes('TMT') ? oldPriceValue : `${oldPriceValue} TMT`) : '';
                            
                            // İndirim var mı?
                            const isOnSale = originalPrice && parseFloat(originalPrice.replace(' TMT', '')) > parseFloat(price.replace(' TMT', ''));
                            
                            // Ürün verisini hazırla
                            const productData = {
                                storeId: store.id,
                                title: productTitle,
                                price: price,
                                originalPrice: originalPrice,
                                category: (row['Kategori'] || '').trim(),
                                material: (row['Malzeme'] || '').trim(),
                                description: (row['Açıklama'] || '').trim(),
                                imageUrl: (row['Resim URL'] || '').trim(),
                                isOnSale: isOnSale,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            };
                            
                            console.log('💾 Firebase\'e ekleniyor:', productData);
                            
                            // 4. Firebase'e ekle
                            await window.db.collection('products').add(productData);
                            successCount++;
                            console.log(`✅ ${productTitle} eklendi`);
                            
                        } catch (itemError) {
                            errorCount++;
                            errors.push(`❌ Hata (${row['Ürün Adı']}): ${itemError.message}`);
                            console.error('Ürün eklenirken hata:', itemError);
                        }
                    }
                    
                    // 5. Sonuç mesajı
                    let message = `✅ ${successCount} ürün başarıyla eklendi!`;
                    if (errorCount > 0) {
                        message += `\n⚠️ ${errorCount} ürün eklenemedi`;
                        if (errors.length > 0) {
                            message += '\n\n❌ Hatalar:\n' + errors.slice(0, 5).join('\n');
                            if (errors.length > 5) {
                                message += `\n... ve ${errors.length - 5} hata daha`;
                            }
                        }
                    }
                    
                    console.log(message);
                    
                    resolve({
                        success: true,
                        count: successCount,
                        errors: errorCount,
                        message: message
                    });
                    
                } catch (error) {
                    console.error('❌ Excel okuma hatası:', error);
                    reject({
                        success: false,
                        error: error.message
                    });
                }
            };
            
            reader.onerror = () => {
                reject({
                    success: false,
                    error: 'Dosya okunamadı'
                });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
}
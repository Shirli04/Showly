// Excel dosyası yönetimi
class ExcelManager {
    
    // Mağazaları Excel'e dönüştür ve indir
    static async exportStoresToExcel() {
        try {
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Excel verilerine dönüştür
            const excelData = stores.map(store => ({
                'Mağaza ID': store.id,
                'Mağaza Adı': store.name,
                'Açıklama': store.description || '',
                'Oluşturulma Tarihi': store.createdAt || ''
            }));
            
            // Excel çalışma kitabı oluştur
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Mağazalar');
            
            // İndir
            XLSX.writeFile(workbook, 'showly_magazines.xlsx');
        } catch (error) {
            console.error('Mağazalar indirilemedi:', error);
            alert('Mağazalar indirilemedi: ' + error.message);
        }
    }
    
    // Ürünleri Excel'e dönüştür ve indir
    static async exportProductsToExcel() {
        try {
            // Firebase'den ürünleri çek
            const productsSnapshot = await window.db.collection('products').get();
            const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Firebase'den mağazaları çek
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            console.log('📦 İndirilen ürünler:', products.length);
            console.log('🏪 İndirilen mağazalar:', stores.length);
            
            // Excel verilerine dönüştür
            const excelData = products.map(product => {
                const store = stores.find(s => s.id === product.storeId);
                return {
                    'Mağaza Adı': store ? store.name : 'Bilinmiyor',
                    'Ürün Adı': product.title,
                    'Fiyat': product.price ? product.price.replace(' TMT', '') : '',
                    'Eski Fiyat': product.originalPrice ? product.originalPrice.replace(' TMT', '') : '',
                    'Kategori': product.category || '',
                    'Malzeme': product.material || '',
                    'Açıklama': product.description || '',
                    'Resim URL': product.imageUrl || ''
                };
            });
            
            console.log('📊 Excel verisi hazır:', excelData.length);
            
            // Excel çalışma kitabı oluştur
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler');
            
            // İndir
            XLSX.writeFile(workbook, 'showly_products.xlsx');
            console.log('✅ Excel dosyası indirildi!');
        } catch (error) {
            console.error('❌ Ürünler indirilemedi:', error);
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
                    
                    // Mağazaları Firebase'e ekle
                    for (const row of jsonData) {
                        try {
                            await window.addStoreToFirebase({
                                name: row['Mağaza Adı'],
                                description: row['Açıklama'] || ''
                            });
                            successCount++;
                        } catch (error) {
                            console.error('Mağaza eklenemedi:', error);
                        }
                    }
                    
                    resolve({
                        success: true,
                        count: successCount,
                        message: `${successCount} mağaza başarıyla içe aktarıldı`
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
    
    // ✅ Ürünleri Excel'den Firebase'e yükle (OTOMATİK)
    static async importProductsFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    console.log('📂 Excel dosyası okunuyor...');
                    
                    // 1. Excel dosyasını oku
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    console.log('📊 Excel verisi okundu:', jsonData.length, 'satır');
                    console.log('İlk satır:', jsonData[0]);
                    
                    // 2. Firebase'den mağazaları çek
                    const storesSnapshot = await window.db.collection('stores').get();
                    const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    console.log('🏪 Mağazalar yüklendi:', stores.length);
                    console.log('Mağaza adları:', stores.map(s => s.name));
                    
                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];
                    
                    // 3. Her ürünü işle
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        
                        try {
                            console.log(`\n🔄 ${i + 1}/${jsonData.length} işleniyor:`, row['Ürün Adı']);
                            
                            // Mağazayı bul (büyük/küçük harf duyarsız)
                            const storeName = (row['Mağaza Adı'] || '').trim();
                            const store = stores.find(s => 
                                s.name.toLowerCase() === storeName.toLowerCase()
                            );
                            
                            if (!store) {
                                errorCount++;
                                const errorMsg = `❌ "${storeName}" mağazası bulunamadı - Ürün: ${row['Ürün Adı']}`;
                                errors.push(errorMsg);
                                console.error(errorMsg);
                                continue;
                            }
                            
                            console.log(`✅ Mağaza bulundu: ${store.name} (ID: ${store.id})`);
                            
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
                            const docRef = await window.db.collection('products').add(productData);
                            successCount++;
                            console.log(`✅ ${productTitle} eklendi (ID: ${docRef.id})`);
                            
                        } catch (itemError) {
                            errorCount++;
                            const errorMsg = `❌ Hata (${row['Ürün Adı']}): ${itemError.message}`;
                            errors.push(errorMsg);
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
                    
                    console.log('\n📊 SONUÇ:', message);
                    
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
// Excel dosyası yönetimi (CLOUDFLARE KV VERSİYONU)
class ExcelManager {

    // Mağazaları Excel'e dönüştür ve indir
    static async exportStoresToExcel() {
        try {
            const stores = await window.cloudflareAPI.stores.getAll();

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
            const [products, stores] = await Promise.all([
                window.cloudflareAPI.products.getAll(),
                window.cloudflareAPI.stores.getAll()
            ]);

            const excelData = products.map(product => {
                const store = stores.find(s => s.id === product.storeId);
                return {
                    'Mağaza Adı': store ? store.name : 'Bilinmiyor',
                    'Ürün Adı': product.title,
                    'Normal Fiyat': product.price ? product.price.replace(' TMT', '') : '',
                    'İndirimli Fiyat': product.originalPrice ? product.originalPrice.replace(' TMT', '') : '',
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

    // ✅ Mağazaları Excel'den içe aktar (CLOUDFLARE KV)
    static async importStoresFromExcel(file) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.querySelector('.loading-text');
        
        loadingOverlay.style.display = 'flex';
        loadingText.textContent = 'Excel dosyası okunuyor...';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    console.log('📊 Excel verisi:', jsonData);
                    loadingText.textContent = 'Mağazalar yükleniyor...';

                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        loadingText.textContent = `Mağaza yükleniyor... (${i + 1}/${jsonData.length})`;

                        try {
                            // ✅ Excel'deki sütun adlarını okuma
                            const storeName = (row['Mağaza Adı'] || row['Magaza Adi'] || '').trim();
                            const description = (row['Açıklama'] || row['Aciklama'] || '').trim();
                            const bannerText = (row['Banner Metni'] || '').trim();
                            
                            if (!storeName) {
                                errorCount++;
                                errors.push(`Satır ${i + 2}: Mağaza adı boş`);
                                console.warn(`⚠️ Satır ${i + 2}: Mağaza adı boş`);
                                continue;
                            }

                            console.log(`📦 Ekleniyor: ${storeName}`);

                            // ✅ Cloudflare KV API'ye ekle
                            await window.cloudflareAPI.stores.create({
                                name: storeName,
                                description: description,
                                customBannerText: bannerText
                            });
                            
                            successCount++;
                            console.log(`✅ Mağaza eklendi: ${storeName}`);
                            
                        } catch (err) {
                            errorCount++;
                            errors.push(`Satır ${i + 2}: ${err.message}`);
                            console.error(`❌ Satır ${i + 2} hatası:`, err);
                        }
                    }

                    loadingText.textContent = 'Mağazalar başarıyla yüklendi!';
                    
                    // ✅ 2 saniye bekle, sonra loading'i kapat
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        
                        let resultMessage = `✅ ${successCount} mağaza başarıyla yüklendi`;
                        
                        if (errorCount > 0) {
                            resultMessage += `\n❌ ${errorCount} mağaza yüklenemedi`;
                            console.error('Hatalar:', errors);
                            
                            if (errors.length > 0) {
                                alert(resultMessage + '\n\nİlk hatalar:\n' + errors.slice(0, 5).join('\n'));
                            }
                        } else {
                            alert(resultMessage);
                        }

                        resolve({ 
                            success: true, 
                            successCount, 
                            errorCount, 
                            errors,
                            message: resultMessage
                        });
                    }, 2000);

                } catch (error) {
                    loadingOverlay.style.display = 'none';
                    console.error('❌ Excel okuma hatası:', error);
                    reject({ success: false, error: error.message });
                }
            };

            reader.onerror = () => {
                loadingOverlay.style.display = 'none';
                reject({ success: false, error: 'Dosya okunamadı' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    // ✅ Ürünleri Excel'den içe aktar (CLOUDFLARE KV)
    static async importProductsFromExcel(file) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.querySelector('.loading-text');
        
        loadingOverlay.style.display = 'flex';
        loadingText.textContent = 'Excel dosyası okunuyor...';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    console.log('📊 Excel verisi:', jsonData);
                    loadingText.textContent = 'Mağazalar yükleniyor...';

                    // Cloudflare KV'den mağazaları çek
                    const stores = await window.cloudflareAPI.stores.getAll();

                    console.log('🏪 Mağazalar:', stores);

                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        loadingText.textContent = `Ürün yükleniyor... (${i + 1}/${jsonData.length})`;

                        try {
                            // ✅ Mağaza adını temizle ve bul
                            const storeName = (row['Mağaza Adı'] || row['Magaza Adi'] || '').trim();
                            
                            if (!storeName) {
                                errorCount++;
                                errors.push(`Satır ${i + 2}: Mağaza adı boş`);
                                continue;
                            }

                            // ✅ Mağazayı bul (büyük/küçük harf duyarsız)
                            const store = stores.find(s => 
                                s.name.toLowerCase() === storeName.toLowerCase()
                            );

                            if (!store) {
                                errorCount++;
                                errors.push(`Satır ${i + 2}: "${storeName}" mağazası bulunamadı`);
                                continue;
                            }

                            // ✅ Ürün adını al
                            const title = (row['Ürün Adı'] || row['Urun Adi'] || '').trim();
                            if (!title) {
                                errorCount++;
                                errors.push(`Satır ${i + 2}: Ürün adı boş`);
                                continue;
                            }

                            // ✅ Normal fiyatı al ve formatla
                            let normalPriceValue = row['Normal Fiyat'] || '';
                            normalPriceValue = String(normalPriceValue).trim().replace('TMT', '').replace(' ', '');
                            
                            let price = '0 TMT';
                            if (normalPriceValue && !isNaN(normalPriceValue) && parseFloat(normalPriceValue) > 0) {
                                price = `${normalPriceValue} TMT`;
                            }

                            // ✅ İndirimli fiyatı al
                            let discountedPriceValue = row['İndirimli Fiyat'] || row['Indirimli Fiyat'] || '';
                            discountedPriceValue = String(discountedPriceValue).trim().replace('TMT', '').replace(' ', '');

                            let originalPrice = '';
                            let isOnSale = false;

                            if (discountedPriceValue && !isNaN(discountedPriceValue) && parseFloat(discountedPriceValue) > 0) {
                                originalPrice = `${discountedPriceValue} TMT`;
                                isOnSale = true;
                            }

                            // ✅ Resim URL'sini al
                            const imageUrl = (row['Resim URL'] || row['Image URL'] || '').trim();

                            // ✅ Ürün verisini oluştur
                            const productData = {
                                storeId: store.id,
                                title: title,
                                price: price,
                                originalPrice: originalPrice,
                                isOnSale: isOnSale,
                                category: (row['Kategori'] || '').trim(),
                                material: (row['Malzeme'] || '').trim(),
                                description: (row['Açıklama'] || row['Aciklama'] || '').trim(),
                                imageUrl: imageUrl,
                            };

                            console.log(`✅ Ürün ${i + 1}:`, productData);

                            // Cloudflare KV'ye ekle
                            await window.cloudflareAPI.products.create(productData);
                            successCount++;

                        } catch (err) {
                            errorCount++;
                            errors.push(`Satır ${i + 2}: ${err.message}`);
                            console.error(`❌ Satır ${i + 2} hatası:`, err);
                        }
                    }

                    loadingText.textContent = 'Ürünler başarıyla yüklendi!';
                    
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        
                        let resultMessage = `✅ ${successCount} ürün başarıyla yüklendi`;
                        
                        if (errorCount > 0) {
                            resultMessage += `\n❌ ${errorCount} ürün yüklenemedi`;
                            console.error('Hatalar:', errors);
                            
                            if (errors.length > 0) {
                                alert(resultMessage + '\n\nİlk hatalar:\n' + errors.slice(0, 5).join('\n'));
                            }
                        } else {
                            alert(resultMessage);
                        }

                        resolve({ 
                            success: true, 
                            successCount, 
                            errorCount, 
                            errors,
                            message: resultMessage
                        });
                    }, 2000);

                } catch (error) {
                    loadingOverlay.style.display = 'none';
                    console.error('❌ Excel okuma hatası:', error);
                    reject({ success: false, error: error.message });
                }
            };

            reader.onerror = () => {
                loadingOverlay.style.display = 'none';
                reject({ success: false, error: 'Dosya okunamadı' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
}
// Excel dosyası yönetimi
class ExcelManager {

    // Mağazaları Excel'e dönüştür ve indir
    static async exportStoresToExcel() {
        try {
            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const excelData = stores.map(store => ({
                'Magazyn ID': store.id,
                'Magazyn Ady': store.name,
                'Düşündiriş': store.description || '',
                'Döredilen Senesi': store.createdAt || ''
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
                return {
                    'Magazyn Ady': store ? store.name : 'Bilinmiyor',
                    'Haryt Ady': product.title,
                    'Baha': product.price ? product.price.replace(' TMT', '') : '',
                    'Arzanladyş Bahasy': product.originalPrice ? product.originalPrice.replace(' TMT', '') : '',
                    'Kategoriýa': product.category || '',
                    'Material': product.material || '',
                    'Düşündiriş': product.description || '',
                    'Surat URL': product.imageUrl || ''
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
                            const storeName = (row['Magazyn Ady'] || row['Mağaza Adı'] || '').trim();

                            if (!storeName) {
                                console.warn('Boş mağaza adı atlandı');
                                continue;
                            }

                            const slug = storeName.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');

                            await window.db.collection('stores').add({
                                name: storeName,
                                slug: slug,
                                description: row['Düşündiriş'] || row['Açıklama'] || '',
                                customBannerText: row['Banner Teksti'] || row['Banner Metni'] || '',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });

                            successCount++;
                        } catch (err) {
                            console.error('Mağaza eklenirken hata:', err);
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

    // ✅ DÜZELTİLMİŞ: Ürünleri Excel'den Firebase'e yükle
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

                    // Firebase'den mağazaları çek
                    const storesSnapshot = await window.db.collection('stores').get();
                    const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    console.log('🏪 Mağazalar:', stores);

                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        loadingText.textContent = `Ürün yükleniyor... (${i + 1}/${jsonData.length})`;

                        try {
                            // ✅ Mağaza adını temizle ve bul
                            const storeName = (row['Magazyn Ady'] || row['Mağaza Adı'] || row['Magaza Adi'] || '').trim();

                            if (!storeName) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: Mağaza adı boş`);
                                continue;
                            }

                            // ✅ Mağazayı bul (büyük/küçük harf duyarsız)
                            const store = stores.find(s =>
                                s.name.toLowerCase() === storeName.toLowerCase()
                            );

                            if (!store) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: "${storeName}" mağazası bulunamadı`);
                                continue;
                            }

                            // ✅ Ürün adını al
                            const title = (row['Haryt Ady'] || row['Ürün Adı'] || row['Urun Adi'] || '').trim();
                            if (!title) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: Ürün adı boş`);
                                continue;
                            }

                            // ✅ Normal fiyatı al ve formatla (opsiyonel)
                            let normalPriceValue = row['Baha'] || row['Normal Fiyat'] || '';
                            normalPriceValue = String(normalPriceValue).trim().replace('TMT', '').replace(' ', '');

                            // Fiyat yoksa veya geçersizse 0 TMT olarak ayarla
                            let price = '0 TMT';
                            if (normalPriceValue && !isNaN(normalPriceValue) && parseFloat(normalPriceValue) > 0) {
                                price = `${normalPriceValue} TMT`;
                            }

                            // ✅ İndirimli fiyatı al (opsiyonel)
                            let discountedPriceValue = row['Arzanladyş Bahasy'] || row['İndirimli Fiyat'] || row['Indirimli Fiyat'] || '';
                            discountedPriceValue = String(discountedPriceValue).trim().replace('TMT', '').replace(' ', '');

                            let originalPrice = '';
                            let isOnSale = false;

                            // Eğer indirimli fiyat varsa ve geçerli bir sayıysa
                            if (discountedPriceValue && !isNaN(discountedPriceValue) && parseFloat(discountedPriceValue) > 0) {
                                originalPrice = `${discountedPriceValue} TMT`;
                                isOnSale = true;
                            }

                            // ✅ Resim URL'sini al
                            const imageUrl = (row['Surat URL'] || row['Resim URL'] || row['Image URL'] || '').trim();

                            // ✅ Ürün verisini oluştur
                            const productData = {
                                storeId: store.id,
                                title: title,
                                price: price,
                                originalPrice: originalPrice,
                                isOnSale: isOnSale,
                                category: (row['Kategoriýa'] || row['Kategori'] || '').trim(),
                                material: (row['Material'] || row['Malzeme'] || '').trim(),
                                description: (row['Düşündiriş'] || row['Açıklama'] || row['Aciklama'] || '').trim(),
                                imageUrl: imageUrl,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            console.log(`✅ Ürün ${i + 1}:`, productData);

                            // Firebase'e ekle
                            await window.db.collection('products').add(productData);
                            successCount++;

                        } catch (err) {
                            errorCount++;
                            errors.push(`Satır ${i + 1}: ${err.message}`);
                            console.error(`Satır ${i + 1} hatası:`, err);
                        }
                    }

                    loadingText.textContent = 'Ürünler başarıyla yüklendi!';

                    // ✅ 2 saniye bekle, sonra loading'i kapat
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';

                        // Sonuçları göster
                        let resultMessage = `✅ ${successCount} ürün başarıyla yüklendi`;

                        if (errorCount > 0) {
                            resultMessage += `\n❌ ${errorCount} ürün yüklenemedi`;
                            console.error('Hatalar:', errors);

                            // İlk 5 hatayı göster
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
                    }, 2000); // 2 saniye bekle

                } catch (error) {
                    loadingOverlay.style.display = 'none';
                    console.error('Excel okuma hatası:', error);
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
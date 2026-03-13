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

    // ✅ GÜNCELLENDİ: Ürünleri Excel'e dönüştür ve indir (çok dilli destek + ID desteği)
    static async exportProductsToExcel() {
        try {
            const productsSnapshot = await window.db.collection('products').get();
            const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const storesSnapshot = await window.db.collection('stores').get();
            const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const excelData = products.map(product => {
                const store = stores.find(s => s.id === product.storeId);
                return {
                    'Haryt ID': product.id,
                    'Magazyn ID': product.storeId || '',
                    'Magazyn Ady': store ? store.name : 'Bilinmiyor',
                    // Türkmençe (TM)
                    'Haryt Ady (TM)': product.title || '',
                    // Rusça (RU)
                    'Haryt Ady (RU)': product.name_ru || '',
                    // İňlisçe (EN)
                    'Haryt Ady (EN)': product.name_en || '',
                    // Türkmençe (TM) Düşündiriş
                    'Düşündiriş (TM)': product.description || '',
                    // Rusça (RU) Açıklama
                    'Düşündiriş (RU)': product.desc_ru || '',
                    // İňlisçe (EN) Açıklama
                    'Düşündiriş (EN)': product.desc_en || '',
                    // Bahalar
                    'Baha': product.price ? String(product.price).replace(' TMT', '').trim() : '0',
                    'Arzanladyş Bahasy': product.originalPrice ? String(product.originalPrice).replace(' TMT', '').trim() : '',
                    // Kategoriýalar
                    'Kategoriýa (TM)': product.category || '',
                    'Kategoriýa (RU)': product.category_ru || '',
                    'Kategoriýa (EN)': product.category_en || '',
                    // Beýlekiler
                    'Material': product.material || '',
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
                            const storeName = String(row['Magazyn Ady'] || row['Mağaza Adı'] || '').trim();
                            const storeId = String(row['Magazyn ID'] || row['Store ID'] || '').trim();

                            if (!storeName) {
                                console.warn('Boş mağaza adı atlandı');
                                continue;
                            }

                            const slug = storeName.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
                            const storeData = {
                                name: storeName,
                                slug: slug,
                                description: String(row['Düşündiriş'] || row['Açıklama'] || '').trim(),
                                customBannerText: String(row['Banner Teksti'] || row['Banner Metni'] || '').trim(),
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            if (storeId) {
                                await window.db.collection('stores').doc(storeId).set(storeData, { merge: true });
                            } else {
                                storeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                                await window.db.collection('stores').add(storeData);
                            }

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

    // ✅ GÜNCELLENDİ: Ürünleri Excel'den Firebase'e yükle (çok dilli destek + batch write)
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

                    // ✅ YENİ: Ürün verilerini hazırla (batch ve tekli mod için ortak)
                    const preparedProducts = [];

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];

                        try {
                            // ✅ Mağaza adını temizle ve bul (Sayı olma ihtimaline karşı String ile sarıldı)
                            const storeName = String(row['Magazyn Ady'] || row['Mağaza Adı'] || row['Magaza Adi'] || '').trim();

                            if (!storeName) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: Mağaza adı boş`);
                                continue;
                            }

                            // ✅ Mağazayı bul (büyük/küçük harf duyarsız)
                            const store = stores.find(s =>
                                String(s.name || '').toLowerCase() === storeName.toLowerCase()
                            );

                            if (!store) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: "${storeName}" mağazası bulunamadı`);
                                continue;
                            }

                            // ✅ Ürün adını al (çok dilli destekli, sayı olma ihtimaline karşı String)
                            const title = String(row['Haryt Ady (TM)'] || row['Haryt Ady'] || row['name_tm'] || row['Ürün Adı'] || row['Urun Adi'] || '').trim();
                            if (!title) {
                                errorCount++;
                                errors.push(`Satır ${i + 1}: Ürün adı boş`);
                                continue;
                            }

                            // ✅ Normal fiyatı al ve formatla (opsiyonel)
                            let normalPriceValue = String(row['Baha'] || row['Normal Fiyat'] || '').trim().replace('TMT', '').replace(' ', '');

                            // Fiyat yoksa veya geçersizse 0 TMT olarak ayarla
                            let price = '0 TMT';
                            if (normalPriceValue && !isNaN(normalPriceValue) && parseFloat(normalPriceValue) > 0) {
                                price = `${normalPriceValue} TMT`;
                            }

                            // ✅ İndirimli fiyatı al (opsiyonel)
                            let discountedPriceValue = String(row['Arzanladyş Bahasy'] || row['İndirimli Fiyat'] || row['Indirimli Fiyat'] || '').trim().replace('TMT', '').replace(' ', '');

                            let originalPrice = '';
                            let isOnSale = false;

                            // Eğer indirimli fiyat varsa ve geçerli bir sayıysa
                            if (discountedPriceValue && !isNaN(discountedPriceValue) && parseFloat(discountedPriceValue) > 0) {
                                originalPrice = `${discountedPriceValue} TMT`;
                                isOnSale = true;
                            }

                            // ✅ Resim URL'sini al
                            const imageUrl = String(row['Surat URL'] || row['Resim URL'] || row['Image URL'] || '').trim();

                            // ✅ GÜNCELLENDİ: Çok dilli ürün verisi oluştur (Sayı hücreleri için String koruması eklendi)
                            const productData = {
                                storeId: store.id,
                                // Geriye uyumluluk: title ve description korunuyor
                                title: title,
                                description: String(row['Düşündiriş (TM)'] || row['Düşündiriş'] || row['desc_tm'] || row['Açıklama'] || row['Aciklama'] || '').trim(),
                                // Çok dilli ürün adları (TM = title, sadece RU ve EN)
                                name_ru: String(row['Haryt Ady (RU)'] || row['name_ru'] || '').trim(),
                                name_en: String(row['Haryt Ady (EN)'] || row['name_en'] || '').trim(),
                                // Çok dilli açıklamalar (TM = description, sadece RU ve EN)
                                desc_ru: String(row['Düşündiriş (RU)'] || row['desc_ru'] || '').trim(),
                                desc_en: String(row['Düşündiriş (EN)'] || row['desc_en'] || '').trim(),
                                // Mevcut alanlar aynen korunuyor
                                price: price,
                                originalPrice: originalPrice,
                                isOnSale: isOnSale,
                                category: String(row['Kategoriýa (TM)'] || row['Kategoriýa'] || row['category_tm'] || row['Kategori'] || '').trim(),
                                // ✅ YENİ: Çok dilli kategori (TM = category, sadece RU ve EN)
                                category_ru: String(row['Kategoriýa (RU)'] || row['category_ru'] || '').trim(),
                                category_en: String(row['Kategoriýa (EN)'] || row['category_en'] || '').trim(),
                                material: String(row['Material'] || row['Malzeme'] || '').trim(),
                                imageUrl: imageUrl,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            // Eğer yeni ürünse createdAt ekle
                            const productId = row['Haryt ID'] || row['Product ID'];
                            if (!productId) {
                                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                            }

                            preparedProducts.push({ index: i, id: productId, data: productData });

                        } catch (err) {
                            errorCount++;
                            errors.push(`Satır ${i + 1}: ${err.message}`);
                            console.error(`Satır ${i + 1} hatası:`, err);
                        }
                    }

                    // ✅ YENİ: Batch write veya tekli yazma (300+ ürün için performans optimizasyonu)
                    const useBatch = preparedProducts.length > 300;

                    if (useBatch) {
                        // ✅ BATCH WRITE: 500'lü partiler halinde yaz
                        console.log(`📦 Batch write modu: ${preparedProducts.length} ürün, 500'lü partiler`);
                        const BATCH_SIZE = 500;
                        const totalBatches = Math.ceil(preparedProducts.length / BATCH_SIZE);

                        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                            const batchStart = batchIndex * BATCH_SIZE;
                            const batchEnd = Math.min(batchStart + BATCH_SIZE, preparedProducts.length);
                            const batchItems = preparedProducts.slice(batchStart, batchEnd);

                            loadingText.textContent = `Batch ${batchIndex + 1}/${totalBatches} yükleniyor... (${batchStart + 1}-${batchEnd}/${preparedProducts.length})`;

                            const batch = window.db.batch();

                            batchItems.forEach(item => {
                                if (item.id) {
                                    // Güncelleme
                                    const docRef = window.db.collection('products').doc(item.id);
                                    batch.set(docRef, item.data, { merge: true });
                                } else {
                                    // Yeni ekleme
                                    const docRef = window.db.collection('products').doc();
                                    batch.set(docRef, item.data);
                                }
                            });

                            try {
                                await batch.commit();
                                successCount += batchItems.length;
                                console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} tamamlandı (${batchItems.length} ürün)`);
                            } catch (batchErr) {
                                console.error(`❌ Batch ${batchIndex + 1} hatası:`, batchErr);
                                // Batch başarısız olduysa tek tek dene
                                for (const item of batchItems) {
                                    try {
                                        if (item.id) {
                                            await window.db.collection('products').doc(item.id).set(item.data, { merge: true });
                                        } else {
                                            await window.db.collection('products').add(item.data);
                                        }
                                        successCount++;
                                    } catch (singleErr) {
                                        errorCount++;
                                        errors.push(`Satır ${item.index + 1}: ${singleErr.message}`);
                                    }
                                }
                            }
                        }
                    } else {
                        // TEKLİ YAZMA: 300 ve altı ürün için mevcut sistem
                        for (let i = 0; i < preparedProducts.length; i++) {
                            const item = preparedProducts[i];
                            loadingText.textContent = `Ürün yükleniyor... (${i + 1}/${preparedProducts.length})`;

                            try {
                                if (item.id) {
                                    await window.db.collection('products').doc(item.id).set(item.data, { merge: true });
                                } else {
                                    await window.db.collection('products').add(item.data);
                                }
                                successCount++;
                                console.log(`✅ Ürün ${item.index + 1} (${item.id ? 'Güncellendi' : 'Eklendi'}):`, item.data);
                            } catch (err) {
                                errorCount++;
                                errors.push(`Satır ${item.index + 1}: ${err.message}`);
                                console.error(`Satır ${item.index + 1} hatası:`, err);
                            }
                        }
                    }

                    loadingText.textContent = 'Ürünler başarıyla yüklendi!';

                    // ✅ 2 saniye bekle, sonra loading'i kapat
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';

                        // Sonuçları göster
                        let resultMessage = `✅ ${successCount} ürün başarıyla yüklendi`;
                        if (useBatch) {
                            resultMessage += ` (batch write)`;
                        }

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
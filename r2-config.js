// Cloudflare R2 yapılandırması
const R2_CONFIG = {
    accountId: 'a1d95532662a0c8f59b5525cf943b83b',
    bucketName: 'showly-products',
    publicUrl: 'https://pub-688ea9c2a4ec4fdcbb2596428cb9fbcd.r2.dev',
    workerUrl: 'https://r2-upload-api.showlytmstore.workers.dev'
};

// ✅ YENİ: Mağaza ismine göre klasör oluşturan fonksiyon
async function uploadToR2(file, storeName) {
    try {
        // Mağaza ismini temizle (boşlukları tire yap, özel karakterleri kaldır)
        const cleanStoreName = storeName
            .toLowerCase()
            .replace(/\s+/g, '-')           // Boşlukları tire yap
            .replace(/[çÇ]/g, 'c')          // Türkçe karakterleri değiştir
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u')
            .replace(/[^a-z0-9-]/g, '');    // Sadece harf, rakam ve tire kalsın

        // Dosya adını benzersiz yap
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileExtension = file.name.split('.').pop();
        
        // Klasör yapısı: magazalar/magaza-adi/timestamp_random.jpg
        const fileName = `Stores/${cleanStoreName}/${timestamp}_${randomStr}.${fileExtension}`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', fileName);

        const response = await fetch(`${R2_CONFIG.workerUrl}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error('R2 yükleme hatası: ' + error);
        }

        const result = await response.json();
        return `${R2_CONFIG.publicUrl}/${fileName}`;
        
    } catch (error) {
        console.error('R2 yükleme hatası:', error);
        throw error;
    }
}

// Resimleri R2'den silme fonksiyonu
async function deleteFromR2(imageUrl) {
    try {
        const fileName = imageUrl.replace(`${R2_CONFIG.publicUrl}/`, '');
        
        const response = await fetch(`${R2_CONFIG.workerUrl}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileName })
        });

        if (!response.ok) {
            throw new Error('R2 silme hatası');
        }

        return true;
    } catch (error) {
        console.error('R2 silme hatası:', error);
        return false;
    }
}

window.uploadToR2 = uploadToR2;
window.deleteFromR2 = deleteFromR2;
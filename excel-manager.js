// Excel dosyası yönetimi
// SheetJS kütüphanesini HTML'de şu şekilde import edin:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

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
    static exportProductsToExcel() {
        const products = window.showlyDB.getAllProducts();
        const stores = window.showlyDB.getStores();
        
        // Excel verilerine dönüştür
        const excelData = products.map(product => {
            const store = stores.find(s => s.id === product.storeId);
            return {
                'Ürün ID': product.id,
                'Ürün Adı': product.title,
                'Mağaza Adı': store ? store.name : 'Bilinmiyor',
                'Fiyat': product.price,
                'Malzeme': product.material || '',
                'Açıklama': product.description || '',
                'Resim URL': product.imageUrl || '',
                'Oluşturulma Tarihi': product.createdAt
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
    
    // Ürünleri Excel'den içe aktar
    static importProductsFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    const stores = window.showlyDB.getStores();
                    
                    // Ürünleri ekle
                    jsonData.forEach(row => {
                        const store = stores.find(s => s.name === row['Mağaza Adı']);
                        if (store) {
                            window.showlyDB.addProduct({
                                storeId: store.id,
                                title: row['Ürün Adı'],
                                price: row['Fiyat'],
                                description: row['Açıklama'] || '',
                                material: row['Malzeme'] || '',
                                imageUrl: row['Resim URL'] || ''
                            });
                        }
                    });
                    
                    resolve({
                        success: true,
                        count: jsonData.length,
                        message: `${jsonData.length} ürün başarıyla içe aktarıldı`
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
}

// Kullanım örnekleri:
/*
// Mağazaları indir
ExcelManager.exportStoresToExcel();

// Ürünleri indir
ExcelManager.exportProductsToExcel();

// Excel'den mağaza içe aktar
const fileInput = document.getElementById('import-stores-file');
ExcelManager.importStoresFromExcel(fileInput.files[0])
    .then(result => console.log(result))
    .catch(error => console.error(error));

// Excel'den ürün içe aktar
ExcelManager.importProductsFromExcel(fileInput.files[0])
    .then(result => console.log(result))
    .catch(error => console.error(error));
*/
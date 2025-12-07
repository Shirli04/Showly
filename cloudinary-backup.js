// Cloudinary'ye metin dosyası olarak veri yükle
async function backupToCloudinary() {
    const stores = window.showlyDB.getStores();
    const products = window.showlyDB.getAllProducts();
    
    // CSV formatında veri oluştur
    const storesCSV = 'ID,Adı,Açıklama,Oluşturulma\n' +
        stores.map(s => `"${s.id}","${s.name}","${s.description || ''}","${s.createdAt}"`).join('\n');
    
    const productsCSV = 'ID,Adı,Mağaza,Fiyat,Malzeme,Oluşturulma\n' +
        products.map(p => {
            const store = stores.find(s => s.id === p.storeId);
            return `"${p.id}","${p.title}","${store?.name || ''}","${p.price}","${p.material || ''}","${p.createdAt}"`;
        }).join('\n');
    
    // Stores.csv yükle
    const storesBlob = new Blob([storesCSV], { type: 'text/csv' });
    const storesFile = new File([storesBlob], 'stores.csv', { type: 'text/csv' });
    
    const storesResult = await uploadToCloudinary(storesFile, 'showly/backups');
    console.log('Stores CSV yüklendi:', storesResult);
    
    // Products.csv yükle
    const productsBlob = new Blob([productsCSV], { type: 'text/csv' });
    const productsFile = new File([productsBlob], 'products.csv', { type: 'text/csv' });
    
    const productsResult = await uploadToCloudinary(productsFile, 'showly/backups');
    console.log('Products CSV yüklendi:', productsResult);
    
    return {
        stores: storesResult,
        products: productsResult
    };
}

// Excel olarak yükle
function exportAndBackupToExcel() {
    const stores = window.showlyDB.getStores();
    const products = window.showlyDB.getAllProducts();
    
    // Excel dosyası oluştur
    const excelData = {
        stores: stores.map(s => ({
            'ID': s.id,
            'Adı': s.name,
            'Açıklama': s.description || '',
            'Oluşturulma': s.createdAt
        })),
        products: products.map(p => {
            const store = stores.find(s => s.id === p.storeId);
            return {
                'ID': p.id,
                'Adı': p.title,
                'Mağaza': store?.name || '',
                'Fiyat': p.price,
                'Malzeme': p.material || '',
                'Oluşturulma': p.createdAt
            };
        })
    };
    
    const ws1 = XLSX.utils.json_to_sheet(excelData.stores);
    const ws2 = XLSX.utils.json_to_sheet(excelData.products);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Mağazalar');
    XLSX.utils.book_append_sheet(wb, ws2, 'Ürünler');
    
    // Bilgisayara indir
    XLSX.writeFile(wb, `showly_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    // Aynı zamanda Cloudinary'ye de yükle
    const excelBlob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], 
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const excelFile = new File([excelBlob], `showly_backup.xlsx`, 
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    uploadToCloudinary(excelFile, 'showly/backups').then(result => {
        console.log('Excel Cloudinary\'ye yüklendi:', result);
    });
}
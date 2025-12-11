// Google Drive API için genel değişkenler
let DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
let SCOPES = 'https://www.googleapis.com/auth/drive.file';
let CLIENT_ID = '1079376479162-stfokpgbsl7181h5scg95j3eiu4se3ii.apps.googleusercontent.com'; // BURAYA GOOGLE CLOUD'DAN ALDIĞINIZ CLIENT_ID'Yİ YAZIN
let API_KEY = 'AIzaSyB2X6-27SapjhnChSZ4duH7brQF6na6ueM'; // BURAYA GOOGLE CLOUD'DAN ALDIĞINIZ API KEY'İNİ YAZIN

// Yetkilendirme (OAuth) için değişkenler
let tokenClient;
let gapiInited = false;
let OAUTH2_CALLBACK = 'http://localhost:3000'; // Canlıya alındığında değiştirilecek

/**
 * Google Drive API'sini başlatır ve yetkilendirme yapar.
 */
function initGapiClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: OAUTH2_CALLBACK
    });
}

/**
 * Kullanıcıyı Google ile giriş yapmaya yönlendirir.
 */
function handleAuthClick() {
    tokenClient.callback = (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
            gapi.auth.setToken(tokenResponse.access_token);
            console.log('Google Drive ile başarıyla giriş yapıldı.');
            // Giriş başarılı olursa, dosyaları yükle
            loadInitialFiles();
        } else {
            console.error('Giriş başarısız oldu:', tokenResponse);
        }
    };

    if (gapi.auth.getToken()) {
        // Zaten giriş yapılmışsa, token'ı yenile
        gapi.auth.authorize();
    } else {
        // Giriş yapılmamışsa, kullanıcıyı yönlendir
        tokenClient.requestAccessToken();
    }
}

/**
 * Belirtilen dosyayı Google Drive'dan indirir.
 * @param {string} fileId - İndirilecek dosyanın ID'si.
 * @param {function} callback - Dosya içeriği callback fonksiyonu.
 */
function downloadFile(fileId, callback) {
    gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    }).then(function(resp) {
        let reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.readAsText(resp.body);
    }, function(reason) {
        console.error('Dosya indirme hatası:', reason);
        callback(null);
    });
}

/**
 * İndirilen Excel dosyasını JSON formatına çevirir.
 * @param {string} data - Excel dosyasının ham verisi.
 * @param {function} callback - Sonuçları callback fonksiyonu.
 */
function parseExcelData(data, callback) {
    const workbook = XLSX.read(data, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    callback(jsonData);
}

/**
 * JSON verisini Google Drive'daki bir Excel dosyasına kaydeder.
 * @param {string} fileId - Güncellenecek dosyanın ID'si.
 * @param {string} fileName - Dosyanın adı.
 * @param {Array} data - Kaydedilecek JSON verisi.
 * @param {function} callback - İşlem sonucu callback fonksiyonu.
 */
/**
 * JSON verisini Google Drive'daki bir Excel dosyasına kaydeder.
 * @param {string} fileId - Dosyanın kaydedileceği ana klasörün ID'si.
 * @param {string} fileName - Dosyanın adı (örn: 'products.xlsx').
 * @param {Array} data - Kaydedilecek JSON verisi.
 * @param {function} callback - İşlem sonucu bildiren callback fonksiyonu (success: boolean, error: string).
 */
function saveAsExcel(fileId, fileName, data, callback) {
    // JSON verisini Excel formatına çevir
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fileName.split('.')[0]);

    // Excel dosyasını binary (blob) formatına çevir
    const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Blob oluşturma
    const blob = new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // FormData oluşturma
    const form = new FormData();
    form.append('file', blob, fileName);

    // Google Drive API v3'e dosya yükleme isteği
    fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&parents=${fileId}`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        },
        body: form
    })
    .then(response => response.json())
    .then(result => {
        console.log('Dosya başarıyla güncellendi:', result);
        callback(true);
    })
    .catch(error => {
        console.error('Dosya güncelleme hatası:', error);
        callback(false, error.message);
    });
}

/**
 * Başlangıçta dosyaları yüklemek ve depolamak için kullanılır.
 */
/**
 * Başlangıçta dosyaları yükler ve veritabanını senkronize eder.
 */
async function loadInitialFiles() {
    console.log('🚀 Google Drive dosyaları yükleniyor...');
    showLoadingIndicator(true, 'Dosyalar yükleniyor, lütfen bekleyin...');

    try {
        // 1. Önce stores.xlsx dosyasını yükle
        await downloadFile('root', 'stores.xlsx', (data) => {
            if (data) {
                const jsonData = XLSX.read(data, { type: 'binary' });
                const stores = XLSX.utils.sheet_to_json(jsonData.Sheets[0]);
                window.storesData = stores;
                console.log('✅ Mağaza verileri yüklendi:', stores);
            } else {
                console.log('ℹ️ stores.xlsx bulunamadı. Yeni bir tane oluşturulacak.');
                window.storesData = [];
            }
        });

        // 2. Sonra products.xlsx dosyasını yükle
        await downloadFile('root', 'products.xlsx', (data) => {
            if (data) {
                const jsonData = XLSX.read(data, { type: 'binary' });
                const products = XLSX.utils.sheet_to_json(jsonData.Sheets[0]);
                window.productsData = products;
                console.log('✅ Ürün verileri yüklendi:', products);
            } else {
                console.log('ℹ️ products.xlsx bulunamadı. Yeni bir tane oluşturulacak.');
                window.productsData = [];
            }
        });

    } catch (error) {
        console.error('Dosyalar yüklenirken hata oluştu:', error);
        window.storesData = [];
        window.productsData = [];
    } finally {
        // 3. Yükleme bittiğinde veritabanını güncelle ve UI'yi tetikle
        console.log('🎉 Dosya yükleme tamamlandı. Veritabanı güncelleniyor...');
        // ShowlyDB'yi yeni verilerle güncelle
        if (window.showlyDB) {
            // Verileri ShowlyDB'ye aktar
            window.showlyDB.stores = window.storesData || [];
            window.showlyDB.products = window.productsData || [];
            console.log('ShowlyDB güncellendi:', {
                stores: window.showlyDB.stores.length,
                products: window.showlyDB.products.length
            });
        }

        // Admin panelindeki tabloları güncelle
        if (typeof renderStoresTable === 'function') {
            renderStoresTable();
        }
        if (typeof renderProductsTable === 'function') {
            renderProductsTable();
        }
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }

        hideLoadingIndicator();
        showNotification('Dosyalar başarıyla yüklendi.');
    }
}

/**
 * Yüklenme göstergesini gösterir/gizler.
 * @param {boolean} show - Gösterilecek mi?
 * @param {string} message - Gösterilecek mesaj
 */
function showLoadingIndicator(show, message) {
    let indicator = document.getElementById('loading-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loading-indicator';
        indicator.style.css = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.7); color: white; display: flex;
            justify-content: center; align-items: center; font-size: 18px;
            z-index: 9999; flex-direction: column; gap: 10px;
        `;
        document.body.appendChild(indicator);
    }

    if (show) {
        indicator.innerHTML = `<div>${message}</div><div class="spinner"></div>`;
        indicator.style.display = 'flex';
        // Basit bir spinner CSS'i ekleyelim
        const style = document.createElement('style');
        style.textContent = `
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: 360deg); }
            }
        `;
        document.head.appendChild(style);
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Yüklenme göstergesini gizler.
 */
function hideLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Google API'yi yükle
function loadGapi() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        gapi.load('client:auth2', () => {
            initGapiClient();
            gapiInited = true;
            // Sayfa yüklendiğinde otomatik olarak giriş yapmaya çalış
            handleAuthClick();
        });
    };
    document.head.appendChild(script);
}

// Global olarak erişilebilir değişkenler ve fonksiyonlar
window.storesData = [];
window.productsData = [];
window.loadGapi = loadGapi;
window.handleAuthClick = handleAuthClick;
window.downloadFile = downloadFile;
window.saveAsExcel = saveAsExcel;
// Google Sheets API için sabitler
const STORES_SHEET_ID   = '1VLmWQD8nXhyq2D0J-kAUK5XL4tQQFnBnG_TOIcyGdPs';
const PRODUCTS_SHEET_ID = '1hI7dOCS2jt514xkw1SboVChiyDC8K_kAcZGKG8tXIlI';
const API_KEY           = 'AIzaSyB2X6-27SapjhnChSZ4duH7brQF6na6ueM';

// Google Sheets’ten veri çekme
async function fetchSheetData(sheetId, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${API_KEY}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.values || data.values.length < 2) return []; // başlık + en az 1 satır
    const headers = data.values[0];
    return data.values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });
  } catch (err) {
    console.error('Sheet çekme hatası:', err);
    return [];
  }
}

// Ana yükleme fonksiyonu (artık Google Sheets üzerinden)
async function loadInitialFiles() {
  showLoadingIndicator(true, 'Google Sheets’ten veriler çekiliyor...');

  const [stores, products] = await Promise.all([
    fetchSheetData(STORES_SHEET_ID, 'Sayfa1!A1:E100'),
    fetchSheetData(PRODUCTS_SHEET_ID, 'Sayfa1!A1:K100')
  ]);

  window.storesData   = stores;
  window.productsData = products;

  console.log('✅ Mağazalar:', stores);
  console.log('✅ Ürünler:', products);

  // ShowlyDB’yi güncelle
  if (window.showlyDB) {
    window.showlyDB.stores   = stores;
    window.showlyDB.products = products;
  }

  // UI’ları tetikle
  if (typeof renderStoresTable   === 'function') renderStoresTable();
  if (typeof renderProductsTable === 'function') renderProductsTable();
  if (typeof updateDashboard     === 'function') updateDashboard();

  hideLoadingIndicator();
  showNotification('Veriler Google Sheets’ten yüklendi.');
}

// Yüklenme göstergesi
function showLoadingIndicator(show, message = 'Yükleniyor...') {
  let indicator = document.getElementById('loading-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,.7); color:#fff; display:flex;
      flex-direction:column; align-items:center; justify-content:center;
      z-index:9999; font-size:18px; gap:10px;
    `;
    document.body.appendChild(indicator);
  }
  if (show) {
    indicator.innerHTML = `<div>${message}</div><div class="spinner"></div>`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}
function hideLoadingIndicator() {
  const el = document.getElementById('loading-indicator');
  if (el) el.style.display = 'none';
}

// Bildirim
function showNotification(msg, success = true) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'notification';
  div.style.cssText = `
    position:fixed; bottom:20px; right:20px; background:${success ? '#28a745' : '#dc3545'};
    color:#fff; padding:12px 18px; border-radius:6px; z-index:10000;
  `;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Global’e ekle
window.loadInitialFiles = loadInitialFiles;
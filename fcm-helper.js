/**
 * ========================================
 * SHOWLYTM - FCM BİLDİRİM GÖNDERİCİ
 * ========================================
 * 
 * Firebase Cloud Messaging ile Android APK'ya
 * anında bildirim göndermek için kullanılır.
 * 
 * KULLANIM:
 * await sendOrderNotification(storeName, orderId, customerName, itemsText);
 */

/**
 * Firestore'dan mağazanın FCM token'ını al
 */
async function getStoreFCMToken(storeName) {
    try {
        console.log(`📱 FCM token aranıyor: ${storeName}`);

        const storesSnapshot = await window.db.collection('stores').get();

        for (const doc of storesSnapshot.docs) {
            const data = doc.data();
            const name = data.name || '';

            if (name.toLowerCase().trim() === storeName.toLowerCase().trim()) {
                const fcmToken = data.fcm_token || null;
                console.log(`✅ FCM token bulundu: ${fcmToken ? fcmToken.substring(0, 20) + '...' : 'YOK'}`);
                return fcmToken;
            }
        }

        console.warn(`⚠️ Mağaza bulunamadı: ${storeName}`);
        return null;
    } catch (error) {
        console.error(`❌ FCM token alınırken hata:`, error);
        return null;
    }
}

/**
 * FCM HTTP v1 API ile bildirim gönder
 * 
 * @param {string} storeName - Mağaza adı (Firestore'daki stores/name)
 * @param {string} orderId - Sipariş ID
 * @param {string} customerName - Müşteri adı
 * @param {string} items - Sipariş ürünleri (virgülle ayrılmış)
 */
async function sendOrderNotification(storeName, orderId, customerName, items) {
    try {
        console.log(`🔔 Bildirim gönderiliyor: ${storeName}`);

        // FCM token'ı al
        const fcmToken = await getStoreFCMToken(storeName);

        if (!fcmToken) {
            console.warn(`⚠️ ${storeName} için FCM token yok, bildirim gönderilemedi`);
            return { success: false, error: 'FCM token not found' };
        }

        // FCM mesajı oluştur
        const message = {
            message: {
                token: fcmToken,
                data: {
                    action: 'new_order',
                    order_id: orderId || '',
                    customer_name: customerName || 'Müşteri',
                    items: items || 'Sipariş',
                    store_name: storeName
                },
                notification: {
                    title: '🆕 Täze Sargyt!',
                    body: `${customerName} - ${items}`
                },
                android: {
                    priority: 'HIGH',
                    notification: {
                        channel_id: 'new_order_alerts',
                        default_sound: true,
                        default_vibrate_timings: true,
                        priority: 'HIGH'
                    }
                }
            }
        };

        // Firebase Admin SDK ile bildirim gönder
        // NOT: Bu client-side JavaScript'te çalışmaz!
        // Bunun için backend API endpoint'i gerekli

        console.log(`📨 FCM Mesajı hazır:`, message);
        console.log(`ℹ️ Backend API ile bildirim gönderilmeli`);

        // Alternatif: Legacy FCM API kullanarak (önerilmez ama çalışır)
        return await sendFCMNotificationLegacy(fcmToken, orderId, customerName, items, storeName);

    } catch (error) {
        console.error('❌ Bildirim gönderilirken hata:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Legacy FCM API ile bildirim gönder (Server Key gerektirir)
 * 
 * UYARI: Server Key'i client-side kodda KULLANMAYIN!
 * Bu sadece örnek amaçlıdır. Gerçek uygulamada backend API kullanın.
 */
async function sendFCMNotificationLegacy(fcmToken, orderId, customerName, items, storeName) {
    try {
        // FCM Server Key - Firebase Console > Project Settings > Cloud Messaging > Server Key
        // ⚠️ ÖNEMLİ: Bu key'i ASLA client-side kodda kullanmamalısınız!
        // Bu sadece test amaçlıdır, production'da backend API kullanın!

        const FCM_SERVER_KEY = 'AIzaSyCSMfrGZkKg5lYwiUG6Sf4qwx3adVVSI9c'; // ✅ Google Cloud Console API Key

        if (FCM_SERVER_KEY === 'YOUR_FCM_SERVER_KEY_HERE') {
            console.warn('⚠️ FCM Server Key ayarlanmamış! Firebase Console\'dan Server Key alın.');
            return { success: false, error: 'Server key not configured' };
        }

        const message = {
            to: fcmToken,
            priority: 'high',
            data: {
                action: 'new_order',
                order_id: orderId || '',
                customer_name: customerName || 'Müşteri',
                items: items || 'Sipariş',
                store_name: storeName
            },
            notification: {
                title: '🆕 Täze Sargyt!',
                body: `${customerName} - ${items}`,
                sound: 'default',
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${FCM_SERVER_KEY}`
            },
            body: JSON.stringify(message)
        });

        const result = await response.json();

        if (response.ok && result.success === 1) {
            console.log('✅ FCM bildirimi başarıyla gönderildi:', result);
            return { success: true, messageId: result.results[0].message_id };
        } else {
            console.error('❌ FCM bildirimi gönderilemedi:', result);
            return { success: false, error: result.results?.[0]?.error || 'Unknown error' };
        }

    } catch (error) {
        console.error('❌ FCM Legacy API hatası:', error);
        return { success: false, error: error.message };
    }
}

// Global fonksiyonu tanımla
window.sendOrderNotification = sendOrderNotification;
window.getStoreFCMToken = getStoreFCMToken;

console.log('✅ FCM Helper yüklendi');

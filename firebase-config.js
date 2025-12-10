// Firebase modüler SDK'larını içe aktar
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
// Diğer ihtiyaç duyacağınız SDK'ları buraya ekleyebilirsiniz
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";

// Sizin web uygulamanızın Firebase yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyAGnYprUlgaZjiIyODbdqZVJzqvZ8iGO2g",
  authDomain: "showlytm-04.firebaseapp.com",
  projectId: "showlytm-04",
  storageBucket: "showlytm-04.firebasestorage.app",
  messagingSenderId: "929629780738",
  appId: "1:929629780738:web:b965afeed4d6bec32d601b",
  measurementId: "G-9LDZV2856Y"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Analytics kullanmak için

// Firestore veritabanına erişim al
const db = getFirestore(app);

// Veritabanını (db) diğer scriptlerin kullanabileceği şekilde dışa aktar (export et)
export { db };
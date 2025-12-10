// Firebase "Compat" (Uyumlu) SDK'sı ile yapılandırma
const firebaseConfig = {
  apiKey: "AIzaSyAGnYprUlgaZjiIyODbdqZVJzqvZ8iGO2g",
  authDomain: "showlytm-04.firebaseapp.com",
  projectId: "showlytm-04",
  storageBucket: "showlytm-04.firebasestorage.app",
  messagingSenderId: "929629780738",
  appId: "1:929629780738:web:b965afeed4d6bec32d601b"
};

// Firebase'i Başlat
firebase.initializeApp(firebaseConfig);

// Firestore Veritabanına Erişim
const db = firebase.firestore();

// Veritabanını (db) diğer scriptlerin kullanabileceği yap
window.db = db;
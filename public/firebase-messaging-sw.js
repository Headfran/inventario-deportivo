importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase para el Service Worker
const firebaseConfig = {
  apiKey: "AIzaSyCX2mzrwuNpVCJFMD-OPaK9HrboLeWYuRw",
  authDomain: "inventario-deportivo-app.firebaseapp.com",
  projectId: "inventario-deportivo-app",
  storageBucket: "inventario-deportivo-app.firebasestorage.app",
  messagingSenderId: "628045340382",
  appId: "1:628045340382:web:55abbc9a8df7818ba12c4f"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manejador de notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación recibida en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || '⚠️ Alerta de Inventario';
  const notificationOptions = {
    body: payload.notification?.body || 'Una prenda ha quedado sin stock.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

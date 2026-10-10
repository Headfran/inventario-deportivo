import { messaging, db } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { Product } from '../types/inventory';

// Clave VAPID pública de Firebase Console
const VAPID_KEY = process.env.EXPO_PUBLIC_VAPID_ID;

/**
 * Solicita permisos de notificación al usuario y guarda el FCM Token en Firestore
 */
export const requestNotificationPermission = async (userId?: string): Promise<string | null> => {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Este navegador no soporta notificaciones PWA / Service Workers.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado por el usuario.');
      return null;
    }

    if (!messaging) {
      console.warn('Firebase Messaging no está inicializado.');
      return null;
    }

    if (!VAPID_KEY) {
      console.warn('EXPO_PUBLIC_VAPID_ID no está definida en las variables de entorno.');
      return null;
    }

    // 1. Registrar el Service Worker
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // 2. Esperar explícitamente a que el Service Worker esté ACTIVO
    const activeRegistration = await navigator.serviceWorker.ready;

    // 3. Solicitar el token de FCM usando la activación confirmada
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: activeRegistration,
    });

    if (currentToken) {
      console.log('FCM Token obtenido con éxito:', currentToken);

      if (userId) {
        await setDoc(
          doc(db, 'fcm_tokens', currentToken),
          {
            userId,
            token: currentToken,
            updatedAt: Timestamp.now(),
            platform: 'PWA_Web',
          },
          { merge: true }
        );
      }
      return currentToken;
    } else {
      console.warn('No se pudo obtener el FCM Token de registro.');
      return null;
    }
  } catch (error) {
    console.error('Error al solicitar permiso de notificaciones:', error);
    return null;
  }
};

/**
 * Muestra una notificación push/local inmediata en el sistema
 */
export const showLocalNotification = (title: string, body: string, data?: any) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      // Cast a 'any' para evitar que TypeScript marque 'vibrate' como desconocido
      const options: any = {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data,
      };
      registration.showNotification(title, options);
    });
  }
};

/**
 * Chequea la lista de variantes de un producto e identifica si alguna talla se agotó (stock = 0)
 */
export const checkAndNotifyStockOut = (product: Product) => {
  if (!product || !Array.isArray(product.variants)) return;

  product.variants.forEach((variant) => {
    (variant.sizes || []).forEach((sObj) => {
      if (Number(sObj.stock) === 0) {
        showLocalNotification(
          '🚨 ¡STOCK AGOTADO!',
          `La prenda "${product.brand} - ${product.name}" (Color: ${variant.color}, Talla: ${sObj.size}) se ha quedado sin stock.`,
          { productId: product.id, color: variant.color, size: sObj.size }
        );
      }
    });
  });
};

/**
 * Listener en primer plano para mensajes Push entrantes
 */
export const listenForegroundMessages = (callback: (payload: any) => void) => {
  if (!messaging) return () => { };
  return onMessage(messaging, (payload) => {
    console.log('Mensaje FCM en primer plano:', payload);
    callback(payload);
  });
};

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: "inventario-deportivo-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app;
let authInstance;
let dbInstance;

// Evitar inicialización múltiple por el Hot Reload de Expo
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);

  // Inicializamos Auth inyectando AsyncStorage de forma segura para móviles
  authInstance = initializeAuth(app, {
    persistence: Platform.OS === 'web'
      ? browserLocalPersistence
      : getReactNativePersistence(AsyncStorage),
  });

  if (Platform.OS === 'web') {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } else {
    dbInstance = getFirestore(app);
  }
} else {
  // Si ya existe la app (Hot Reload), simplemente obtenemos las instancias
  app = getApp();
  const { getAuth } = require('firebase/auth');
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

// Inicialización segura de Firebase Messaging
let messagingInstance: Messaging | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    messagingInstance = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging no se inicializó en este entorno:', error);
  }
}

export const auth = authInstance;
export const db = dbInstance;
export const messaging = messagingInstance;

export default app;

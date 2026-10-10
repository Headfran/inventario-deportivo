import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getAuth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence existe en runtime
import { getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let authInstance;

if (getApps().length > 0) {
  authInstance = getAuth(app);
} else {
  if (Platform.OS === 'web') {
    authInstance = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  }
}

// Inicialización de Firestore con Persistencia Offline para PWA
let dbInstance;
if (Platform.OS === 'web') {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} else {
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

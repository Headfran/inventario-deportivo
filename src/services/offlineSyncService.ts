import { collection, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingSaleItem {
  productId: string;
  brand: string;
  name: string;
  code?: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PendingSale {
  id: string;
  receiptNumber: string;
  createdAt: string;
  sellerId?: string;
  sellerName?: string;
  customerName?: string;
  customerPhone?: string;
  items: PendingSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'efectivo' | 'pago_movil' | 'binance' | 'transferencia' | 'zelle' | 'mixto';
  notes?: string;
}

const DB_NAME = 'InventarioOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible (Entorno Nativo).'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const enqueuePendingSale = async (sale: PendingSale): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(sale);
        req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
      });
    } else {
      throw new Error('Forzar Fallback Nativo');
    }
  } catch (error) {
    // FALLBACK SEGURO PARA ANDROID / IOS USANDO ASYNCSTORAGE
    const existingStr = await AsyncStorage.getItem('pending_sales_fallback');
    const existing = existingStr ? JSON.parse(existingStr) : [];
    existing.push(sale);
    await AsyncStorage.setItem('pending_sales_fallback', JSON.stringify(existing));
  }
};

export const getPendingSales = async (): Promise<PendingSale[]> => {
  let fallbackResults: PendingSale[] = [];
  try {
    const fallbackStr = await AsyncStorage.getItem('pending_sales_fallback');
    if (fallbackStr) fallbackResults = JSON.parse(fallbackStr);
  } catch (e) { console.error('Error leyendo AsyncStorage', e); }

  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      return new Promise((resolve, reject) => {
        const req = idb.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve([...(req.result || []), ...fallbackResults]);
        req.onerror = () => reject(req.error);
      });
    }
  } catch (error) { /* Silencioso en Nativo */ }

  return fallbackResults;
};

export const removePendingSale = async (saleId: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      await new Promise<void>((resolve, reject) => {
        const req = idb.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(saleId);
        req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
      });
    }
  } catch (e) { /* Silencioso */ }

  try {
    const fallbackStr = await AsyncStorage.getItem('pending_sales_fallback');
    if (fallbackStr) {
      const fallbackResults: PendingSale[] = JSON.parse(fallbackStr);
      const updatedFallback = fallbackResults.filter((s) => s.id !== saleId);
      await AsyncStorage.setItem('pending_sales_fallback', JSON.stringify(updatedFallback));
    }
  } catch (e) { console.error('Error borrando de AsyncStorage', e); }
};

export const syncPendingSalesWithFirestore = async (onProgress?: (syncedCount: number, total: number) => void): Promise<{ success: number; failed: number }> => {
  if (!db) return { success: 0, failed: 0 };

  const pendingList = await getPendingSales();
  if (pendingList.length === 0) return { success: 0, failed: 0 };

  let successCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < pendingList.length; idx++) {
    const pendingSale = pendingList[idx];
    try {
      await runTransaction(db, async (transaction) => {
        const productSnaps = new Map<string, { ref: any; data: any }>();
        for (const item of pendingSale.items) {
          if (!item.productId || productSnaps.has(item.productId)) continue;
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (productSnap.exists()) productSnaps.set(item.productId, { ref: productRef, data: productSnap.data() });
        }

        const updatedProducts = new Map<string, { ref: any; variants: any[] }>();
        for (const item of pendingSale.items) {
          if (!item.productId) continue;
          const productInfo = productSnaps.get(item.productId);
          if (!productInfo) continue;
          const currentVariants = updatedProducts.get(item.productId)?.variants || productInfo.data.variants || [];

          const updatedVariants = currentVariants.map((variant: any) => {
            if ((variant.color || '').toLowerCase().trim() === (item.color || '').toLowerCase().trim()) {
              const updatedSizes = (variant.sizes || []).map((sObj: any) => {
                if ((sObj.size || '').toString().trim() === (item.size || '').toString().trim()) {
                  return { ...sObj, stock: Math.max(0, (Number(sObj.stock) || 0) - item.quantity) };
                }
                return sObj;
              });
              return { ...variant, sizes: updatedSizes };
            }
            return variant;
          });
          updatedProducts.set(item.productId, { ref: productInfo.ref, variants: updatedVariants });
        }

        for (const [_, prod] of updatedProducts) transaction.update(prod.ref, { variants: prod.variants, updatedAt: Timestamp.now() });

        const newSaleRef = doc(collection(db, 'sales'));
        transaction.set(newSaleRef, {
          receiptNumber: pendingSale.receiptNumber,
          createdAt: Timestamp.fromDate(new Date(pendingSale.createdAt)),
          syncedAt: Timestamp.now(),
          sellerId: pendingSale.sellerId || '',
          sellerName: pendingSale.sellerName || 'Vendedor',
          customerName: pendingSale.customerName || 'Cliente General',
          customerPhone: pendingSale.customerPhone || '',
          items: pendingSale.items,
          subtotal: Number(pendingSale.subtotal) || 0,
          discount: Number(pendingSale.discount) || 0,
          total: Number(pendingSale.total) || 0,
          paymentMethod: pendingSale.paymentMethod || 'efectivo',
          status: 'completed',
          isOfflineSync: true,
          notes: pendingSale.notes || 'Sincronizado automáticamente.'
        });
      });

      await removePendingSale(pendingSale.id);
      successCount++;
      if (onProgress) onProgress(successCount, pendingList.length);
    } catch (error) {
      console.error(`Error sincronizando venta ${pendingSale.receiptNumber}:`, error);
      failedCount++;
    }
  }
  return { success: successCount, failed: failedCount };
};

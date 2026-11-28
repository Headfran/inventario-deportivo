import {
  collection, doc, runTransaction, Timestamp,
  query, where, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingSaleItem {
  productId: string;
  brand: string;
  name: string;
  code?: string;
  productCode?: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // Precios efectivos cobrados (mode-aware)
  effectiveUnitPriceUSD?: number;
  effectiveTotalUSD?: number;
  // Precios en Bs (trazabilidad)
  unitPriceBSRef?: number;
  totalBSRef?: number;
  productImage?: string;
  purchasePrice?: number;
}

export interface PendingSale {
  id: string;
  /** ID único e idempotente del documento de venta. */
  clientSaleId?: string;
  receiptNumber: string;
  createdAt: string; // ISO string cuando se guardó offline
  sellerId?: string;
  sellerName?: string;
  customerName?: string;
  customerPhone?: string;
  items: PendingSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCatalogUSD?: number;
  paymentMethod:
  | 'efectivo'
  | 'pago_movil'
  | 'binance'
  | 'transferencia'
  | 'zelle'
  | 'tarjeta'
  | 'mixto';
  paymentSplits?: any[];
  totalBS?: number;
  totalBSRef?: number;
  eurToBsRate?: number;
  usdToBsRate?: number;
  isWholesale?: boolean;
  isFullBsPayment?: boolean;
  appliedCombos?: any[];
  notes?: string;
  status?: 'pending' | 'conflict';
  conflictReason?: string;
  conflictAt?: string;
}

const DB_NAME = 'InventarioOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';
const FALLBACK_KEY = 'pending_sales_fallback';

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
  const payload: PendingSale = { ...sale, status: sale.status || 'pending' };
  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(payload);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      throw new Error('Forzar Fallback Nativo');
    }
  } catch {
    const existingStr = await AsyncStorage.getItem(FALLBACK_KEY);
    const existing: PendingSale[] = existingStr ? JSON.parse(existingStr) : [];
    const existingIndex = existing.findIndex((item) => item.id === payload.id);
    if (existingIndex >= 0) existing[existingIndex] = payload;
    else existing.push(payload);
    await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(existing));
  }
};

export const getPendingSales = async (): Promise<PendingSale[]> => {
  let fallbackResults: PendingSale[] = [];
  try {
    const fallbackStr = await AsyncStorage.getItem(FALLBACK_KEY);
    if (fallbackStr) fallbackResults = JSON.parse(fallbackStr);
  } catch (e) {
    console.error('Error leyendo AsyncStorage', e);
  }

  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      return new Promise((resolve, reject) => {
        const req = idb
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .getAll();
        req.onsuccess = () => {
          const idbResults = (req.result || []) as PendingSale[];
          // Merge por id (fallback puede tener ventas que no están en IDB)
          const byId = new Map<string, PendingSale>();
          fallbackResults.forEach((s) => byId.set(s.id, s));
          idbResults.forEach((s) => byId.set(s.id, s));
          resolve(Array.from(byId.values()));
        };
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    /* Silencioso en Nativo */
  }

  return fallbackResults;
};

export const removePendingSale = async (saleId: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      const idb = await openDB();
      await new Promise<void>((resolve, reject) => {
        const req = idb
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME)
          .delete(saleId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    /* Silencioso */
  }

  try {
    const fallbackStr = await AsyncStorage.getItem(FALLBACK_KEY);
    if (fallbackStr) {
      const fallbackResults: PendingSale[] = JSON.parse(fallbackStr);
      const updated = fallbackResults.filter((s) => s.id !== saleId);
      await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Error borrando de AsyncStorage', e);
  }
};

/**
 * Elimina `undefined` recursivamente SIN romper Timestamps.
 */
const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (
    typeof obj === 'object' &&
    typeof obj.toDate === 'function' &&
    typeof obj.seconds === 'number' &&
    typeof obj.nanoseconds === 'number'
  ) {
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) out[key] = sanitizeForFirestore(val);
    }
    return out;
  }
  return obj;
};

export const generateClientSaleId = (): string => doc(collection(db, 'sales')).id;

class StockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockConflictError';
  }
}

const cloneVariants = (variants: any[]): any[] =>
  (variants || []).map((variant) => ({
    ...variant,
    sizes: (variant.sizes || []).map((size: any) => ({ ...size })),
  }));

const writePendingSale = async (sale: PendingSale): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      const idb = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(sale);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.warn('No se pudo actualizar IndexedDB:', error);
    }
  }

  try {
    const fallbackStr = await AsyncStorage.getItem(FALLBACK_KEY);
    const fallback: PendingSale[] = fallbackStr ? JSON.parse(fallbackStr) : [];
    const index = fallback.findIndex((item) => item.id === sale.id);
    if (index >= 0) fallback[index] = sale;
    else fallback.push(sale);
    await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(fallback));
  } catch (error) {
    console.warn('No se pudo actualizar la cola fallback:', error);
  }
};

const markPendingSaleConflict = async (saleId: string, reason: string): Promise<void> => {
  const pending = await getPendingSales();
  const target = pending.find((sale) => sale.id === saleId);
  if (!target) return;

  await writePendingSale({
    ...target,
    status: 'conflict',
    conflictReason: reason,
    conflictAt: new Date().toISOString(),
  });
};

export const syncPendingSalesWithFirestore = async (
  onProgress?: (syncedCount: number, total: number) => void,
  options: { retryConflicts?: boolean } = {}
): Promise<{
  success: number;
  failed: number;
  conflicts: { receiptNumber: string; reason: string }[];
}> => {
  if (!db) return { success: 0, failed: 0, conflicts: [] };

  const pendingList = await getPendingSales();
  if (pendingList.length === 0) return { success: 0, failed: 0, conflicts: [] };

  let successCount = 0;
  let failedCount = 0;
  const conflicts: { receiptNumber: string; reason: string }[] = [];

  for (let idx = 0; idx < pendingList.length; idx++) {
    const pendingSale = pendingList[idx];

    // Un conflicto de stock no se reintenta automáticamente para no generar
    // bucles de lectura; el reintento manual sí puede forzarlo.
    if (pendingSale.status === 'conflict' && !options.retryConflicts) {
      continue;
    }

    try {
      let clientSaleId = pendingSale.clientSaleId;

      // Compatibilidad con ventas encoladas por versiones anteriores:
      // solo para ventas sin clientSaleId se comprueba el receiptNumber.
      if (!clientSaleId) {
        const existingQuery = query(
          collection(db, 'sales'),
          where('receiptNumber', '==', pendingSale.receiptNumber)
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
          await removePendingSale(pendingSale.id);
          successCount++;
          if (onProgress) onProgress(successCount, pendingList.length);
          continue;
        }

        clientSaleId = generateClientSaleId();
      }

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', clientSaleId as string);

        // 1) Lectura de idempotencia + lecturas de productos.
        const existingById = await transaction.get(saleRef);
        if (existingById.exists()) return;

        const productSnaps = new Map<string, { ref: any; data: any }>();
        for (const item of pendingSale.items) {
          if (!item.productId || productSnaps.has(item.productId)) continue;
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (productSnap.exists()) {
            productSnaps.set(item.productId, {
              ref: productRef,
              data: productSnap.data(),
            });
          }
        }

        // 2) Validación estricta de stock + cálculo en memoria.
        const updatedProducts = new Map<string, { ref: any; variants: any[] }>();

        for (const item of pendingSale.items) {
          if (!item.productId) continue;

          const productInfo = productSnaps.get(item.productId);
          if (!productInfo) {
            throw new StockConflictError(
              `El producto "${item.name}" ya no existe; no se puede sincronizar la venta.`
            );
          }

          const currentVariants =
            updatedProducts.get(item.productId)?.variants ||
            cloneVariants(productInfo.data.variants || []);

          const variant = currentVariants.find(
            (candidate: any) =>
              (candidate.color || '').toLowerCase().trim() ===
              (item.color || '').toLowerCase().trim()
          );

          if (!variant) {
            throw new StockConflictError(
              `La variante "${item.color}" de "${item.name}" ya no existe.`
            );
          }

          const size = (variant.sizes || []).find(
            (candidate: any) =>
              (candidate.size || '').toString().trim() ===
              (item.size || '').toString().trim()
          );

          if (!size) {
            throw new StockConflictError(
              `La talla "${item.size}" de "${item.name}" (${item.color}) ya no existe.`
            );
          }

          const quantity = Number(item.quantity) || 0;
          const currentStock = Number(size.stock) || 0;

          if (quantity <= 0) {
            throw new StockConflictError(
              `Cantidad inválida para "${item.name}" (${item.color} - Talla ${item.size}).`
            );
          }

          if (currentStock < quantity) {
            throw new StockConflictError(
              `Stock insuficiente para "${item.name}" (${item.color} - Talla ${item.size}). ` +
              `Disponible: ${currentStock}, vendido offline: ${quantity}.`
            );
          }

          size.stock = currentStock - quantity;
          updatedProducts.set(item.productId, {
            ref: productInfo.ref,
            variants: currentVariants,
          });
        }

        // 3) Escrituras: productos, venta.
        for (const [, product] of updatedProducts) {
          transaction.update(product.ref, {
            variants: product.variants,
            updatedAt: Date.now(),
          });
        }

        const createdAtDate = new Date(pendingSale.createdAt);
        const createdAtTs = Number.isNaN(createdAtDate.getTime())
          ? Timestamp.now()
          : Timestamp.fromDate(createdAtDate);

        transaction.set(
          saleRef,
          sanitizeForFirestore({
            clientSaleId,
            receiptNumber: pendingSale.receiptNumber,
            createdAt: createdAtTs,
            syncedAt: Timestamp.now(),
            sellerId: pendingSale.sellerId || '',
            sellerName: pendingSale.sellerName || 'Vendedor',
            customerName: pendingSale.customerName || 'Cliente General',
            customerPhone: pendingSale.customerPhone || '',
            items: pendingSale.items,
            subtotal: Number(pendingSale.subtotal) || 0,
            discount: Number(pendingSale.discount) || 0,
            total: Number(pendingSale.total) || 0,
            totalCatalogUSD: pendingSale.totalCatalogUSD,
            paymentMethod: pendingSale.paymentMethod || 'efectivo',
            paymentSplits: pendingSale.paymentSplits || [],
            totalBS: pendingSale.totalBS,
            totalBSRef: pendingSale.totalBSRef,
            eurToBsRate: pendingSale.eurToBsRate,
            usdToBsRate: pendingSale.usdToBsRate,
            isWholesale: !!pendingSale.isWholesale,
            isFullBsPayment: !!pendingSale.isFullBsPayment,
            appliedCombos: pendingSale.appliedCombos,
            status: 'completed',
            isOfflineSync: true,
            notes: pendingSale.notes || 'Sincronizado automáticamente.',
          })
        );
      });

      await removePendingSale(pendingSale.id);
      successCount++;
      if (onProgress) onProgress(successCount, pendingList.length);
    } catch (error) {
      if (error instanceof StockConflictError) {
        console.warn(`⚠️ Conflicto de stock en ${pendingSale.receiptNumber}:`, error.message);
        conflicts.push({ receiptNumber: pendingSale.receiptNumber, reason: error.message });
        try {
          await markPendingSaleConflict(pendingSale.id, error.message);
        } catch (markError) {
          console.error('No se pudo marcar el conflicto en la cola:', markError);
        }
      } else {
        console.error(`❌ Sync falló para ${pendingSale.receiptNumber}:`, error);
      }
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount, conflicts };
};

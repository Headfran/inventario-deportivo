import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  runTransaction,
  Timestamp,
  limit,
  startAfter,
  getDocs,
  getDocsFromCache,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Product } from '../types/inventory';
import { bumpCatalogVersion } from './productService';
import { assertOwner } from './userService';
import { roundMoney } from '../utils/pricingUtils';

export interface SaleItem {
  productId: string;
  productCode?: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasePrice?: number;
  unitPriceBSRef?: number;
  totalBSRef?: number;
}

export interface SaleEditEntry {
  editedAt: Date;
  reason: string;
  previousTotal: number;
  newTotal: number;
  refundAmount: number;
  chargeAmount: number;
  adjustmentMethod?: string;
  previousItems: SaleItem[];
}

export interface Sale {
  id: string;
  receiptNumber: string;
  createdAt: Date;
  sellerId?: string;
  sellerName?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'efectivo' | 'pago_movil' | 'punto' | 'transferencia' | 'mixto' | 'binance' | 'zelle';
  status: 'completed' | 'voided';
  notes?: string;
  isWholesale?: boolean;
  totalBS?: number;
  totalBSRef?: number;
  eurToBsRate?: number;
  usdToBsRate?: number;
  paymentSplits?: any[];
  appliedCombos?: any[];
  appliedCombo?: any;
  editHistory?: SaleEditEntry[];
  layawayId?: string;
  layawayCode?: string;
  isLayaway?: boolean;
  changeAmount?: number;
  changeAmountBS?: number;
  changeCurrency?: 'USD' | 'BS';
  isFullBsPayment?: boolean;
  totalCatalogUSD?: number;
}

export const parseDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatDateTime = (dateVal: any, style: 'short' | 'long' = 'short'): string => {
  const d = parseDate(dateVal);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  let hoursStr = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');

  const ampm = hoursStr >= 12 ? 'PM' : 'AM';
  hoursStr = hoursStr % 12;
  hoursStr = hoursStr ? hoursStr : 12;

  if (style === 'long') {
    return `${day}/${month}/${year} a las ${hoursStr}:${minutes} ${ampm}`;
  }
  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
};

// ==========================================
// Normalizador compartido (una sola fuente de verdad)
// ==========================================
const normalizeSaleDoc = (docSnap: DocumentSnapshot<DocumentData>): Sale => {
  const data = docSnap.data() || {};

  const normalizedItems: SaleItem[] = (data.items || []).map((item: any) => ({
    productId: item.productId || 'unknown',
    productCode: item.productCode || item.code || 'S/N',
    brand: item.productBrand || item.brand || 'Genérico',
    name: item.productName || item.name || 'Artículo Desconocido',
    color: item.variantColor || item.color || 'N/A',
    size: item.size || 'N/A',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    totalPrice: Number(item.subtotal || item.totalPrice) || 0,
    purchasePrice: item.purchasePrice !== undefined ? Number(item.purchasePrice) : undefined,
    unitPriceBSRef: item.unitPriceBSRef,
    totalBSRef: item.totalBSRef,
  }));

  const normalizedHistory: SaleEditEntry[] = (data.editHistory || []).map((h: any) => ({
    editedAt: parseDate(h.editedAt),
    reason: h.reason || '',
    previousTotal: Number(h.previousTotal) || 0,
    newTotal: Number(h.newTotal) || 0,
    refundAmount: Number(h.refundAmount) || 0,
    chargeAmount: Number(h.chargeAmount) || 0,
    adjustmentMethod: h.adjustmentMethod || undefined,
    previousItems: (h.previousItems || []).map((item: any) => ({
      productId: item.productId || 'unknown',
      productCode: item.productCode || 'S/N',
      brand: item.brand || 'Genérico',
      name: item.name || '',
      color: item.color || 'N/A',
      size: item.size || 'N/A',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0,
      purchasePrice: item.purchasePrice !== undefined ? Number(item.purchasePrice) : undefined,
    })),
  }));

  return {
    id: docSnap.id,
    receiptNumber: data.receiptNumber || 'S/N',
    createdAt: parseDate(data.createdAt),
    sellerId: data.sellerId || '',
    sellerName: data.sellerName || 'Vendedor',
    customerName: data.customerName || 'Cliente General',
    customerPhone: data.customerPhone || '',
    items: normalizedItems,
    subtotal: Number(data.subtotal) || 0,
    discount: Number(data.discount) || 0,
    total: Number(data.totalAmount || data.total) || 0,
    paymentMethod: data.paymentMethod || 'efectivo',
    status: data.status || 'completed',
    notes: data.notes || '',
    isWholesale: !!data.isWholesale,
    totalBS: data.totalBS ? Number(data.totalBS) : undefined,
    totalBSRef: data.totalBSRef ? Number(data.totalBSRef) : undefined,
    eurToBsRate: data.eurToBsRate ? Number(data.eurToBsRate) : undefined,
    usdToBsRate: data.usdToBsRate ? Number(data.usdToBsRate) : undefined,
    paymentSplits: data.paymentSplits || [],
    appliedCombos: data.appliedCombos || [],
    appliedCombo: data.appliedCombo,
    editHistory: normalizedHistory,
    layawayId: data.layawayId || undefined,
    layawayCode: data.layawayCode || undefined,
    isLayaway: !!data.isLayaway,
    changeAmount: data.changeAmount !== undefined ? Number(data.changeAmount) : undefined,
    changeAmountBS: data.changeAmountBS !== undefined ? Number(data.changeAmountBS) : undefined,
    changeCurrency: data.changeCurrency === 'BS' ? 'BS' : data.changeCurrency === 'USD' ? 'USD' : undefined,
    isFullBsPayment: !!data.isFullBsPayment,
    totalCatalogUSD: data.totalCatalogUSD !== undefined ? Number(data.totalCatalogUSD) : undefined,
  } as Sale;
};

/** Lee una venta puntual (p. ej. el recibo de un apartado oficializado). */
export const getSaleById = async (saleId: string): Promise<Sale | null> => {
  if (!db || !saleId) return null;
  try {
    const snap = await getDoc(doc(db, 'sales', saleId));
    return snap.exists() ? normalizeSaleDoc(snap) : null;
  } catch (error) {
    console.error('Error leyendo la venta:', error);
    return null;
  }
};

// ==========================================
// onSnapshot LIMITADO
// Solo sincroniza las N ventas más recientes.
// Para historial completo → fetchSalesPage (paginado).
// ==========================================
export const subscribeToSales = (
  callback: (sales: Sale[]) => void,
  options?: { limit?: number }
) => {
  if (!db) return () => { };

  const maxDocs = options?.limit ?? 100;
  const q = query(
    collection(db, 'sales'),
    orderBy('createdAt', 'desc'),
    limit(maxDocs)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(normalizeSaleDoc));
    },
    (error) => {
      console.error('Error escuchando historial de ventas:', error);
    }
  );
};

// ==========================================
// Paginación cache-first (para scroll infinito / historial completo)
// ==========================================
export interface SalesPageResult {
  sales: Sale[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  fromCache: boolean;
}

export const fetchSalesPage = async (
  pageSize: number = 30,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  preferCache: boolean = true
): Promise<SalesPageResult> => {
  if (!db) return { sales: [], lastDoc: null, hasMore: false, fromCache: false };

  const col = collection(db, 'sales');
  const q = lastDoc
    ? query(col, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize))
    : query(col, orderBy('createdAt', 'desc'), limit(pageSize));

  // 1) Caché primero
  if (preferCache) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return {
          sales: cached.docs.map(normalizeSaleDoc),
          lastDoc: cached.docs[cached.docs.length - 1] || null,
          hasMore: cached.docs.length === pageSize,
          fromCache: true,
        };
      }
    } catch {
      /* cache miss → servidor */
    }
  }

  // 2) Servidor
  const snap = await getDocs(q);
  return {
    sales: snap.docs.map(normalizeSaleDoc),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
    fromCache: false,
  };
};

// ==========================================
// Resto del archivo SIN cambios
// ==========================================
const normalizeSaleColor = (value: any): string => String(value || '').toLowerCase().trim();
const normalizeSaleSize = (value: any): string => String(value || '').trim();
const saleLineKey = (item: Pick<SaleItem, 'productId' | 'color' | 'size'>): string =>
  `${item.productId}|${normalizeSaleColor(item.color)}|${normalizeSaleSize(item.size)}`;

export const voidSale = async (sale: Sale, reason?: string): Promise<boolean> => {
  if (!db || !sale.id) return false;

  // Regla de negocio C-08: el vendedor no puede anular ventas.
  await assertOwner();

  try {
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', sale.id);

      // 1) Todas las lecturas primero.
      const saleSnap = await transaction.get(saleRef);
      if (!saleSnap.exists()) {
        throw new Error('La venta ya no existe en Firestore.');
      }

      const saleData: any = saleSnap.data();
      if (saleData.status === 'voided') {
        throw new Error('La venta ya está anulada.');
      }

      const items: SaleItem[] = Array.isArray(saleData.items) ? saleData.items : [];
      const itemsByProduct = new Map<string, SaleItem[]>();
      for (const item of items) {
        if (!item.productId) continue;
        const list = itemsByProduct.get(item.productId) || [];
        list.push(item);
        itemsByProduct.set(item.productId, list);
      }

      const productIds = Array.from(itemsByProduct.keys());
      const productRefs = productIds.map((id) => doc(db, 'products', id));
      const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

      // 2) Cálculo en memoria.
      const updatedProducts: { ref: any; variants: any[] }[] = [];
      productSnaps.forEach((snap, index) => {
        if (!snap.exists()) return;
        const product = snap.data() as Product;
        const itemsForProduct = itemsByProduct.get(productIds[index]) || [];

        const variants = (product.variants || []).map((variant) => ({
          ...variant,
          sizes: (variant.sizes || []).map((size) => ({ ...size })),
        }));

        for (const item of itemsForProduct) {
          for (const variant of variants) {
            if ((variant.color || '').toLowerCase().trim() !== (item.color || '').toLowerCase().trim()) {
              continue;
            }
            for (const size of variant.sizes || []) {
              if (String(size.size).trim() !== String(item.size).trim()) continue;
              size.stock = (Number(size.stock) || 0) + (Number(item.quantity) || 0);
            }
          }
        }

        updatedProducts.push({ ref: productRefs[index], variants });
      });

      // 3) Todas las escrituras después.
      for (const { ref, variants } of updatedProducts) {
        transaction.update(ref, { variants, updatedAt: Date.now() });
      }

      transaction.update(saleRef, {
        status: 'voided',
        voidedAt: Timestamp.now(),
        voidReason: reason || 'Anulación por el usuario',
      });
    });

    await bumpCatalogVersion();
    return true;
  } catch (error) {
    console.error('Error al anular venta:', error);
    throw error;
  }
};

export interface EditSaleParams {
  sale: Sale;
  newItems: SaleItem[];
  newSubtotal: number;
  newDiscount: number;
  /** Compatibilidad: el servicio SIEMPRE recalcula `max(0, subtotal - discount)`. */
  newTotal?: number;
  reason: string;
  adjustmentMethod?: string;
  /** Cambio de vendedor (opcional). */
  newSellerId?: string;
  newSellerName?: string;
  /** Nuevas tasas aplicadas (opcional). Si no se envían, se conservan las de la venta. */
  newEurToBsRate?: number;
  newUsdToBsRate?: number;
}

export const editSale = async (params: EditSaleParams): Promise<void> => {
  if (!db) throw new Error('Base de datos no disponible');
  if (!params.sale.id) throw new Error('La venta no tiene ID.');
  if (params.sale.status === 'voided') throw new Error('No se puede editar una venta anulada');
  if (params.newItems.length === 0) throw new Error('La venta debe tener al menos un artículo');

  const invalidQuantity = params.newItems.some((item) => {
    const quantity = Number(item.quantity);
    return !Number.isInteger(quantity) || quantity <= 0;
  });
  if (invalidQuantity) {
    throw new Error('Las cantidades de la venta deben ser enteros mayores a 0.');
  }

  const { sale, newItems, reason, adjustmentMethod } = params;
  const newSubtotal = roundMoney(params.newSubtotal);
  // El descuento nunca puede superar el subtotal.
  const newDiscount = roundMoney(Math.min(Math.max(0, params.newDiscount), newSubtotal));
  // Regla única: el total SIEMPRE es subtotal menos descuento (nunca el bruto).
  const newTotal = roundMoney(Math.max(0, newSubtotal - newDiscount));

  if (![newSubtotal, newDiscount, newTotal].every((n) => Number.isFinite(n))) {
    throw new Error('Los totales de la venta no son válidos.');
  }
  if (newTotal < 0) {
    throw new Error('El total de la venta no puede ser negativo.');
  }

  const hasNewEurRate = params.newEurToBsRate !== undefined;
  const hasNewUsdRate = params.newUsdToBsRate !== undefined;
  if (
    (hasNewEurRate && (!Number.isFinite(params.newEurToBsRate) || Number(params.newEurToBsRate) <= 0)) ||
    (hasNewUsdRate && (!Number.isFinite(params.newUsdToBsRate) || Number(params.newUsdToBsRate) <= 0))
  ) {
    throw new Error('Las tasas aplicadas deben ser números mayores a 0.');
  }

  // Regla de negocio C-08: el vendedor no puede editar ventas.
  await assertOwner();

  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, 'sales', sale.id as string);

    // 1) Lectura del documento real de la venta.
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error('Venta no encontrada en Firestore.');

    const existingData: any = saleSnap.data() || {};
    if (existingData.status === 'voided') {
      throw new Error('La venta fue anulada y no se puede editar.');
    }

    const oldItems: SaleItem[] = Array.isArray(existingData.items) ? existingData.items : [];

    // 2) Diffs calculados contra los ítems del SERVIDOR, no contra los del cliente.
    const oldMap = new Map<string, number>();
    oldItems.forEach((item) => {
      const key = saleLineKey(item);
      oldMap.set(key, (oldMap.get(key) || 0) + (Number(item.quantity) || 0));
    });

    const newMap = new Map<string, { item: SaleItem; qty: number }>();
    newItems.forEach((item) => {
      const key = saleLineKey(item);
      const current = newMap.get(key);
      newMap.set(key, {
        item,
        qty: (current?.qty || 0) + (Number(item.quantity) || 0),
      });
    });

    interface StockDiff {
      productId: string;
      color: string;
      size: string;
      diff: number;
    }

    const stockDiffs: StockDiff[] = [];
    const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
    allKeys.forEach((key) => {
      const oldQty = oldMap.get(key) || 0;
      const newEntry = newMap.get(key);
      const newQty = newEntry?.qty || 0;
      const diff = newQty - oldQty;
      if (diff === 0) return;

      const oldItem = oldItems.find((item) => saleLineKey(item) === key);
      const sampleItem = newEntry?.item || oldItem;
      if (!sampleItem?.productId) return;

      stockDiffs.push({
        productId: sampleItem.productId,
        color: sampleItem.color,
        size: sampleItem.size,
        diff,
      });
    });

    const diffsByProduct = new Map<string, StockDiff[]>();
    stockDiffs.forEach((diff) => {
      if (!diffsByProduct.has(diff.productId)) diffsByProduct.set(diff.productId, []);
      diffsByProduct.get(diff.productId)!.push(diff);
    });

    const uniqueProductIds = Array.from(diffsByProduct.keys());
    const productRefs = uniqueProductIds.map((id) => doc(db, 'products', id));

    // 3) Todas las lecturas de productos antes de cualquier escritura.
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

    // 4) Cálculo en memoria y validación estricta de stock.
    const updatedProducts: { ref: any; variants: any[] }[] = [];
    productSnaps.forEach((snap, index) => {
      const productId = uniqueProductIds[index];
      const diffs = diffsByProduct.get(productId) || [];

      if (!snap.exists()) {
        if (diffs.some((diff) => diff.diff > 0)) {
          throw new Error(`El producto con ID "${productId}" ya no existe; no se puede descontar stock.`);
        }
        return;
      }

      const product = snap.data() as Product;
      const variants = (product.variants || []).map((variant) => ({
        ...variant,
        sizes: (variant.sizes || []).map((size) => ({ ...size })),
      }));

      for (const diff of diffs) {
        const variant = variants.find(
          (v) => normalizeSaleColor(v.color) === normalizeSaleColor(diff.color)
        );

        if (!variant) {
          if (diff.diff > 0) {
            throw new Error(
              `La variante "${diff.color}" ya no existe en "${product.name}"; no se puede descontar stock.`
            );
          }
          continue;
        }

        const size = (variant.sizes || []).find(
          (s) => normalizeSaleSize(s.size) === normalizeSaleSize(diff.size)
        );

        if (!size) {
          if (diff.diff > 0) {
            throw new Error(
              `La talla "${diff.size}" ya no existe en "${product.name}" (${diff.color}); no se puede descontar stock.`
            );
          }
          continue;
        }

        const currentStock = Number(size.stock) || 0;
        if (diff.diff > 0 && currentStock < diff.diff) {
          throw new Error(
            `Stock insuficiente para "${product.name}" (${diff.color} - Talla ${diff.size}). ` +
            `Disponible: ${currentStock}, necesario: ${diff.diff}.`
          );
        }

        const nextStock = currentStock - diff.diff;
        if (nextStock < 0) {
          throw new Error(
            `Stock insuficiente para "${product.name}" (${diff.color} - Talla ${diff.size}).`
          );
        }

        size.stock = nextStock;
      }

      updatedProducts.push({ ref: productRefs[index], variants });
    });

    // 5) Escrituras: primero productos, luego la venta.
    for (const { ref, variants } of updatedProducts) {
      transaction.update(ref, { variants, updatedAt: Date.now() });
    }

    const previousTotal = roundMoney(Number(existingData.totalAmount ?? existingData.total) || 0);
    const totalDiff = roundMoney(newTotal - previousTotal);
    const refundAmount = totalDiff < -0.005 ? roundMoney(Math.abs(totalDiff)) : 0;
    const chargeAmount = totalDiff > 0.005 ? roundMoney(totalDiff) : 0;
    const previousHistory = Array.isArray(existingData.editHistory) ? existingData.editHistory : [];

    // Tasas efectivas: las nuevas si se enviaron; si no, las que ya tenía la venta.
    const effectiveEurRate = hasNewEurRate
      ? roundMoney(Number(params.newEurToBsRate))
      : roundMoney(Number(existingData.eurToBsRate) || 0);
    const effectiveUsdRate = hasNewUsdRate
      ? roundMoney(Number(params.newUsdToBsRate))
      : roundMoney(Number(existingData.usdToBsRate) || 0);

    const rateFields: Record<string, number> = {};
    if (hasNewEurRate && effectiveEurRate > 0) rateFields.eurToBsRate = effectiveEurRate;
    if (hasNewUsdRate && effectiveUsdRate > 0) rateFields.usdToBsRate = effectiveUsdRate;

    // Recalcular el equivalente en Bs con las tasas vigentes de la edición.
    if (effectiveUsdRate > 0) {
      const totalBS = roundMoney(newTotal * effectiveUsdRate);
      rateFields.totalBS = totalBS;
      if (effectiveEurRate > 0) {
        rateFields.totalBSRef = roundMoney(totalBS / effectiveEurRate);
      }
    } else if (effectiveEurRate > 0 && Number(existingData.totalBSRef) > 0) {
      rateFields.totalBS = roundMoney(Number(existingData.totalBSRef) * effectiveEurRate);
    }

    const sellerFields: Record<string, string> = {};
    if (params.newSellerId !== undefined) sellerFields.sellerId = params.newSellerId;
    if (params.newSellerName !== undefined) {
      sellerFields.sellerName = params.newSellerName.trim() || 'Vendedor';
    }

    const newEntry = {
      editedAt: Timestamp.now(),
      reason,
      previousTotal,
      newTotal,
      refundAmount,
      chargeAmount,
      adjustmentMethod: adjustmentMethod || '',
      previousItems: oldItems,
    };

    transaction.update(saleRef, {
      items: newItems,
      subtotal: newSubtotal,
      discount: newDiscount,
      total: newTotal,
      totalAmount: newTotal,
      ...sellerFields,
      ...rateFields,
      editHistory: [...previousHistory, newEntry],
      updatedAt: Timestamp.now(),
      appliedCombos: [],
      appliedCombo: null,
    });
  });

  await bumpCatalogVersion();
};

export const calculateSaleProfit = (sale: Sale): { profit: number; determined: boolean } => {
  let profit = 0;
  let determined = true;

  sale.items.forEach((item) => {
    if (item.purchasePrice === undefined) {
      determined = false;
      return;
    }
    profit += (item.unitPrice - item.purchasePrice) * item.quantity;
  });

  if (sale.discount && sale.discount !== 0) {
    profit -= sale.discount;
  }

  return { profit: roundMoney(profit), determined };
};

// ==========================================
// Resincronización de ganancias (solo owner)
// ==========================================
export interface ProfitResyncSkipped {
  code: string;
  name: string;
  occurrences: number;
}

export interface ProfitResyncResult {
  scannedSales: number;
  updatedSales: number;
  updatedItems: number;
  skippedProducts: ProfitResyncSkipped[];
}

export interface SingleSaleProfitResyncResult {
  saleId: string;
  receiptNumber: string;
  updatedItems: number;
  skippedProducts: ProfitResyncSkipped[];
  profit: number;
  margin: number;
  determined: boolean;
}

/**
 * Resincroniza el costo y la ganancia de UNA sola venta.
 *
 * - Valida que `actorUid` sea la sesión actual y que esa sesión sea `owner`.
 * - Lee únicamente el documento de la venta y los productos de sus ítems.
 * - Regla parcial: las prendas inexistentes o `deleted` conservan su línea
 *   original y se devuelven en `skippedProducts`; el resto sí se actualiza.
 */
export const resyncSingleSaleProfit = async (
  saleId: string,
  actorUid: string
): Promise<SingleSaleProfitResyncResult> => {
  if (!db) throw new Error('Base de datos no disponible');
  if (!saleId) throw new Error('La venta no tiene ID.');

  const currentUid = auth?.currentUser?.uid;
  if (!actorUid || !currentUid || currentUid !== actorUid) {
    throw new Error('La sesión no coincide con el usuario que solicitó la resincronización.');
  }

  // Regla de negocio C-08: solo el dueño puede recalcular ganancias.
  await assertOwner();

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, 'sales', saleId);

    // 1) Lectura de la venta.
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error('La venta no existe.');

    const saleData: any = saleSnap.data() || {};
    if (saleData.status === 'voided') {
      throw new Error('No se puede resincronizar una venta anulada.');
    }

    const rawItems: any[] = Array.isArray(saleData.items) ? saleData.items : [];

    // 2) Lectura de los productos de esta venta, antes de cualquier escritura.
    const productIds = Array.from(
      new Set(rawItems.map((item) => item?.productId).filter(Boolean))
    ) as string[];

    const productRefs = productIds.map((productId) => doc(db, 'products', productId));
    const productSnaps = await Promise.all(
      productRefs.map((productRef) => transaction.get(productRef))
    );

    const productsById = new Map<string, Product | null>();
    productSnaps.forEach((snap, index) => {
      productsById.set(productIds[index], snap.exists() ? (snap.data() as Product) : null);
    });

    // 3) Cálculo en memoria.
    const skipped = new Map<string, ProfitResyncSkipped>();
    let updatedItems = 0;
    let changed = false;

    const nextItems = rawItems.map((item: any) => {
      const productId = item?.productId || '';
      const productCode = item?.productCode || item?.code || '';
      const product = productId ? productsById.get(productId) : undefined;

      if (!product || product.deleted) {
        const warningKey = productId || productCode || item?.name || 'unknown';
        const previous = skipped.get(warningKey);
        skipped.set(warningKey, {
          code: productCode || product?.code || 'S/N',
          name: item?.name || item?.productName || product?.name || 'Prenda desconocida',
          occurrences: (previous?.occurrences || 0) + 1,
        });
        // La línea se conserva exactamente como estaba.
        return item;
      }

      if (product.purchasePrice === undefined || product.purchasePrice === null) {
        // No se inventa un costo que la prenda no tiene configurado.
        return item;
      }

      const currentPurchasePrice = roundMoney(Number(product.purchasePrice));
      if (!Number.isFinite(currentPurchasePrice)) return item;

      if (
        typeof item.purchasePrice === 'number' &&
        item.purchasePrice === currentPurchasePrice
      ) {
        return item;
      }

      changed = true;
      updatedItems += 1;
      return { ...item, purchasePrice: currentPurchasePrice };
    });

    // 4) Ganancia/margen netos con los costos ya sincronizados.
    let grossProfit = 0;
    let determined = true;

    nextItems.forEach((item: any) => {
      const purchasePrice =
        typeof item?.purchasePrice === 'number' && Number.isFinite(item.purchasePrice)
          ? item.purchasePrice
          : undefined;

      if (purchasePrice === undefined) {
        determined = false;
        return;
      }

      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      grossProfit += (unitPrice - purchasePrice) * quantity;
    });

    const discount = Math.max(0, Number(saleData.discount) || 0);
    const total = Math.max(0, Number(saleData.totalAmount ?? saleData.total) || 0);
    const profit = roundMoney(grossProfit - discount);
    const margin = total > 0 ? (profit / total) * 100 : 0;

    // 5) Escritura únicamente de la venta afectada.
    if (changed) {
      transaction.update(saleRef, {
        items: nextItems,
        updatedAt: Timestamp.now(),
      });
    }

    return {
      saleId,
      receiptNumber: saleData.receiptNumber || 'S/N',
      updatedItems,
      skippedProducts: Array.from(skipped.values()),
      profit,
      margin,
      determined,
    };
  });
};

/**
 * Recorre las ventas no anuladas y actualiza el `purchasePrice` de cada línea
 * con el costo vigente en `products`.
 *
 * Regla parcial: si una prenda ya no existe (o está `deleted`), esa línea se
 * deja EXACTAMENTE como estaba y se acumula en `skippedProducts`; el resto de
 * la venta sí se sincroniza. No se inventan costos: si el producto existe pero
 * no tiene `purchasePrice`, la línea también se conserva.
 */
export const resyncSaleProfits = async (): Promise<ProfitResyncResult> => {
  if (!db) throw new Error('Base de datos no disponible');

  // Regla de negocio C-08: solo el dueño puede recalcular ganancias.
  await assertOwner();

  const [salesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'products')),
  ]);

  const productById = new Map<string, Product>();
  const productByCode = new Map<string, Product>();
  productsSnap.docs.forEach((productDoc) => {
    const product = productDoc.data() as Product;
    productById.set(productDoc.id, product);
    if (product.code) productByCode.set(product.code, product);
  });

  const skipped = new Map<string, ProfitResyncSkipped>();
  let scannedSales = 0;
  let updatedSales = 0;
  let updatedItems = 0;

  let batch = writeBatch(db);
  let batchOps = 0;
  const pendingCommits: Promise<void>[] = [];

  for (const saleDoc of salesSnap.docs) {
    const saleData: any = saleDoc.data() || {};
    // `status` ausente equivale a venta completada (normalizador).
    if (saleData.status === 'voided') continue;

    scannedSales += 1;
    const rawItems: any[] = Array.isArray(saleData.items) ? saleData.items : [];
    let saleChanged = false;

    const nextItems = rawItems.map((rawItem: any) => {
      const productId = rawItem.productId || '';
      const productCode = rawItem.productCode || rawItem.code || '';
      const product =
        productById.get(productId) ||
        productByCode.get(productId) ||
        (productCode ? productByCode.get(productCode) : undefined);

      if (!product || product.deleted) {
        const warningKey = productId || productCode || rawItem.name || 'unknown';
        const previous = skipped.get(warningKey);
        skipped.set(warningKey, {
          code: productCode || product?.code || 'S/N',
          name: rawItem.name || rawItem.productName || product?.name || 'Prenda desconocida',
          occurrences: (previous?.occurrences || 0) + 1,
        });
        // Se conserva la línea tal cual estaba.
        return rawItem;
      }

      if (product.purchasePrice === undefined || product.purchasePrice === null) {
        // No se inventa un costo que la prenda no tiene configurado.
        return rawItem;
      }

      const currentPurchasePrice = roundMoney(Number(product.purchasePrice));
      if (!Number.isFinite(currentPurchasePrice)) return rawItem;

      const previousPurchasePrice =
        rawItem.purchasePrice === undefined || rawItem.purchasePrice === null
          ? undefined
          : Number(rawItem.purchasePrice);

      if (previousPurchasePrice !== undefined && previousPurchasePrice === currentPurchasePrice) {
        return rawItem;
      }

      saleChanged = true;
      updatedItems += 1;
      return { ...rawItem, purchasePrice: currentPurchasePrice };
    });

    if (!saleChanged) continue;

    batch.update(saleDoc.ref, {
      items: nextItems,
      updatedAt: Timestamp.now(),
    });
    updatedSales += 1;
    batchOps += 1;

    // Firestore limita los lotes a 500 operaciones.
    if (batchOps >= 400) {
      pendingCommits.push(batch.commit());
      batch = writeBatch(db);
      batchOps = 0;
    }
  }

  if (batchOps > 0) pendingCommits.push(batch.commit());
  await Promise.all(pendingCommits);

  return {
    scannedSales,
    updatedSales,
    updatedItems,
    skippedProducts: Array.from(skipped.values()),
  };
};

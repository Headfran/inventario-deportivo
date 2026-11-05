import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

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

export const subscribeToSales = (callback: (sales: Sale[]) => void) => {
  if (!db) return () => { };

  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const salesList: Sale[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

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
        } as Sale;
      });

      callback(salesList);
    },
    (error) => {
      console.error('Error escuchando historial de ventas:', error);
    }
  );
};

export const voidSale = async (sale: Sale, reason?: string): Promise<boolean> => {
  if (!db || sale.status === 'voided') return false;

  try {
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', sale.id);

      for (const item of sale.items) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await transaction.get(productRef);

        if (productSnap.exists()) {
          const productData = productSnap.data();
          const updatedVariants = (productData.variants || []).map((variant: any) => {
            if (variant.color.toLowerCase().trim() === item.color.toLowerCase().trim()) {
              const updatedSizes = (variant.sizes || []).map((sObj: any) => {
                if (sObj.size.toString().trim() === item.size.toString().trim()) {
                  return {
                    ...sObj,
                    stock: Number(sObj.stock) + Number(item.quantity),
                  };
                }
                return sObj;
              });
              return { ...variant, sizes: updatedSizes };
            }
            return variant;
          });

          transaction.update(productRef, {
            variants: updatedVariants,
            updatedAt: Timestamp.now(),
          });
        }
      }

      transaction.update(saleRef, {
        status: 'voided',
        voidedAt: Timestamp.now(),
        voidReason: reason || 'Anulación por el usuario',
      });
    });

    return true;
  } catch (error) {
    console.error('Error al anular venta:', error);
    throw error;
  }
};

// ==========================================
// NUEVO: Edición de venta (intercambios / reembolsos)
// ==========================================
export interface EditSaleParams {
  sale: Sale;
  newItems: SaleItem[];
  newSubtotal: number;
  newDiscount: number;
  newTotal: number;
  reason: string;
  adjustmentMethod?: string;
}

export const editSale = async (params: EditSaleParams): Promise<void> => {
  if (!db) throw new Error('Base de datos no disponible');
  if (params.sale.status === 'voided') throw new Error('No se puede editar una venta anulada');
  if (params.newItems.length === 0) throw new Error('La venta debe tener al menos un artículo');

  const { sale, newItems, newSubtotal, newDiscount, newTotal, reason, adjustmentMethod } = params;

  // 1. Calcular diffs por item
  const oldMap = new Map<string, { item: SaleItem; qty: number }>();
  sale.items.forEach((item) => {
    const key = `${item.productId}_${item.color}_${item.size}`;
    oldMap.set(key, { item, qty: item.quantity });
  });

  const newMap = new Map<string, { item: SaleItem; qty: number }>();
  newItems.forEach((item) => {
    const key = `${item.productId}_${item.color}_${item.size}`;
    newMap.set(key, { item, qty: item.quantity });
  });

  interface StockDiff {
    productId: string;
    color: string;
    size: string;
    diff: number;   // > 0 = destock (añadido), < 0 = restock (devuelto)
  }

  const stockDiffs: StockDiff[] = [];
  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  allKeys.forEach((key) => {
    const oldQty = oldMap.get(key)?.qty || 0;
    const newQty = newMap.get(key)?.qty || 0;
    const diff = newQty - oldQty;
    if (diff === 0) return;
    const sampleItem = newMap.get(key)?.item || oldMap.get(key)!.item;
    stockDiffs.push({
      productId: sampleItem.productId,
      color: sampleItem.color,
      size: sampleItem.size,
      diff,
    });
  });

  // 2. Agrupar diffs por producto
  const diffsByProduct = new Map<string, StockDiff[]>();
  stockDiffs.forEach((d) => {
    if (!diffsByProduct.has(d.productId)) diffsByProduct.set(d.productId, []);
    diffsByProduct.get(d.productId)!.push(d);
  });

  const uniqueProductIds = Array.from(diffsByProduct.keys());

  const totalDiff = newTotal - sale.total;
  const refundAmount = totalDiff < 0 ? Math.abs(totalDiff) : 0;
  const chargeAmount = totalDiff > 0 ? totalDiff : 0;

  // 3. Transacción atómica
  await runTransaction(db, async (transaction) => {
    // 3.1 Leer todos los productos y la venta primero
    const productRefs = uniqueProductIds.map((id) => doc(db, 'products', id));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const saleRef = doc(db, 'sales', sale.id);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists()) throw new Error('Venta no encontrada en Firestore');

    // 3.2 Aplicar diffs de stock
    productSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const productId = uniqueProductIds[i];
      const diffs = diffsByProduct.get(productId) || [];
      const data = snap.data();
      let variants = data.variants || [];

      diffs.forEach((d) => {
        variants = variants.map((variant: any) => {
          if (variant.color?.toLowerCase().trim() !== d.color?.toLowerCase().trim()) return variant;
          return {
            ...variant,
            sizes: (variant.sizes || []).map((sObj: any) => {
              if (String(sObj.size).trim() !== String(d.size).trim()) return sObj;
              // diff > 0 (añadido) → restar stock. diff < 0 (devuelto) → sumar stock
              const newStock = Math.max(0, Number(sObj.stock) - d.diff);
              return { ...sObj, stock: newStock };
            }),
          };
        });
      });

      transaction.update(productRefs[i], {
        variants,
        updatedAt: Timestamp.now(),
      });
    });

    // 3.3 Actualizar la venta con historial
    const existingData = saleSnap.data() || {};
    const previousHistory = existingData.editHistory || [];

    const newEntry = {
      editedAt: Timestamp.now(),
      reason,
      previousTotal: sale.total,
      newTotal,
      refundAmount,
      chargeAmount,
      adjustmentMethod: adjustmentMethod || '',
      previousItems: sale.items,
    };

    transaction.update(saleRef, {
      items: newItems,
      subtotal: newSubtotal,
      discount: newDiscount,
      total: newTotal,
      totalAmount: newTotal,
      editHistory: [...previousHistory, newEntry],
      updatedAt: Timestamp.now(),
    });
  });
};

// ==========================================
// Helpers de ganancia
// ==========================================
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

  // Ajustar por descuento (el descuento reduce ganancia proporcionalmente)
  if (sale.discount && sale.discount !== 0) {
    profit -= sale.discount;
  }

  return { profit, determined };
};

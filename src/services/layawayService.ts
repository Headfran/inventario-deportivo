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
import { bumpCatalogVersion } from './productService';
import { roundMoney } from '../utils/pricingUtils';
import type { PaymentMethod, Sale, SaleItem } from '../types/sale';

export interface LayawayItem {
  productId: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface LayawayPayment {
  id: string;
  amount: number;
  paymentMethod: 'efectivo' | 'pago_movil' | 'punto' | 'transferencia' | 'mixto';
  date: Date;
  notes?: string;
  registeredBy?: string;
}

export interface Layaway {
  id: string;
  code: string;
  createdAt: Date;
  dueDate: Date;
  sellerId?: string;
  sellerName?: string;
  customerName: string;
  customerPhone: string;
  items: LayawayItem[];
  totalAmount: number;
  totalPaid: number;
  balanceRemaining: number;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  payments: LayawayPayment[];
  notes?: string;
  saleId?: string;
  saleReceiptNumber?: string;
}

export interface LayawaySaleResult {
  completed: boolean;
  saleId?: string;
  sale?: Sale;
}

interface RawLayawayPayment {
  id?: string;
  amount: number;
  paymentMethod: any;
  date?: any;
  notes?: string;
  registeredBy?: string;
}

const LAYAWAY_METHODS: Array<LayawayPayment['paymentMethod']> = [
  'efectivo',
  'pago_movil',
  'punto',
  'transferencia',
  'mixto',
];

const normalizeLayawayMethod = (
  method: any
): LayawayPayment['paymentMethod'] =>
  LAYAWAY_METHODS.includes(method) ? method : 'efectivo';

const resolveSalePaymentMethod = (
  payments: RawLayawayPayment[]
): PaymentMethod => {
  const unique = Array.from(
    new Set(payments.map((payment) => normalizeLayawayMethod(payment.paymentMethod)))
  );
  if (unique.length > 1) return 'mixto';
  return (unique[0] as PaymentMethod) || 'efectivo';
};

const layawaySaleRefFor = (layawayId: string) =>
  doc(db, 'sales', `LAYAWAY-${layawayId}`);

const buildLayawaySaleItems = (items: LayawayItem[]): SaleItem[] =>
  (items || [])
    .filter((item) => !!item.productId)
    .map((item) => ({
      productId: item.productId,
      brand: item.brand || 'Genérico',
      name: item.name || 'Prenda',
      color: item.color || '',
      size: item.size || '',
      quantity: Math.max(1, Number(item.quantity) || 1),
      unitPrice: roundMoney(Number(item.unitPrice) || 0),
      totalPrice: roundMoney(Number(item.totalPrice) || 0),
    }));

const buildLayawaySalePayload = (params: {
  layawayId: string;
  code: string;
  customerName: string;
  customerPhone: string;
  sellerId?: string;
  sellerName?: string;
  items: LayawayItem[];
  totalAmount: number;
  payments: RawLayawayPayment[];
  notes?: string;
}): Record<string, any> => {
  const total = roundMoney(Number(params.totalAmount) || 0);
  const paymentMethod = resolveSalePaymentMethod(params.payments || []);
  const safePayments = (params.payments || []).map((payment) => ({
    id: payment.id || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: normalizeLayawayMethod(payment.paymentMethod),
    currency: 'USD' as const,
    amount: roundMoney(Number(payment.amount) || 0),
    ...(payment.notes ? { reference: payment.notes } : {}),
    date: payment.date ? Timestamp.fromDate(parseDate(payment.date)) : Timestamp.now(),
  }));

  return {
    receiptNumber: `REC-${params.code}`,
    layawayId: params.layawayId,
    layawayCode: params.code,
    isLayaway: true,
    createdAt: Timestamp.now(),
    sellerId: params.sellerId || '',
    sellerName: params.sellerName || 'Vendedor',
    customerName: params.customerName || 'Cliente General',
    customerPhone: params.customerPhone || '',
    items: buildLayawaySaleItems(params.items),
    subtotal: total,
    discount: 0,
    total,
    totalAmount: total,
    paymentMethod,
    paymentSplits: safePayments,
    status: 'completed',
    notes: params.notes || 'Venta oficializada desde apartado',
  };
};

const buildSaleFromSnap = (saleId: string, data: any): Sale =>
  ({
    id: saleId,
    ...data,
  }) as Sale;

export const parseDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Escucha los apartados y pedidos en tiempo real desde Firestore
 */
export const subscribeToLayaways = (callback: (layaways: Layaway[]) => void) => {
  if (!db) return () => { };

  const q = query(collection(db, 'layaways'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const layawaysList: Layaway[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const payments = (data.payments || []).map((p: any) => ({
          id: p.id || `PAY-${Math.random()}`,
          amount: Number(p.amount) || 0,
          paymentMethod: p.paymentMethod || 'efectivo',
          date: parseDate(p.date),
          notes: p.notes || '',
          registeredBy: p.registeredBy || 'Sistema',
        }));

        return {
          id: docSnap.id,
          code: data.code || 'APT-000000',
          customerName: data.customerName || 'Cliente General',
          customerPhone: data.customerPhone || '',
          sellerId: data.sellerId || '',
          sellerName: data.sellerName || 'Vendedor',
          items: data.items || [],
          totalAmount: Number(data.totalAmount) || 0,
          totalPaid: Number(data.totalPaid) || 0,
          balanceRemaining: Number(data.balanceRemaining) || 0,
          status: data.status || 'active',
          notes: data.notes || '',
          createdAt: parseDate(data.createdAt),
          dueDate: parseDate(data.dueDate),
          payments,
          saleId: data.saleId || undefined,
          saleReceiptNumber: data.saleReceiptNumber || undefined,
        } as Layaway;
      });
      callback(layawaysList);
    },
    (error) => {
      console.error('Error escuchando apartados:', error);
    }
  );
};

/**
 * Crea un apartado reservando de forma atómica el stock en Firestore.
 * CUMPLE REGLA FIRESTORE: Lecturas (get) primero, escrituras (update/set) después.
 */
export const createLayaway = async (data: {
  customerName: string;
  customerPhone: string;
  sellerId?: string;
  sellerName?: string;
  items: LayawayItem[];
  initialPaymentAmount: number;
  paymentMethod: 'efectivo' | 'pago_movil' | 'punto' | 'transferencia' | 'mixto';
  dueDate: Date;
  notes?: string;
}): Promise<{ code: string; saleId?: string; sale?: Sale }> => {
  if (!db) throw new Error('Base de datos Firestore no inicializada.');

  const code = `APT-${Math.floor(100000 + Math.random() * 900000)}`;
  const totalAmount = roundMoney(
    data.items.reduce((acc, i) => acc + (Number(i.totalPrice) || 0), 0)
  );
  const requestedPaid = Math.max(0, Number(data.initialPaymentAmount) || 0);
  const totalPaid = roundMoney(Math.min(totalAmount, requestedPaid));
  const balanceRemaining = roundMoney(Math.max(0, totalAmount - totalPaid));
  const completedNow = balanceRemaining <= 0.005;

  const initialPayment: RawLayawayPayment = {
    id: `PAY-${Date.now()}`,
    amount: totalPaid,
    paymentMethod: normalizeLayawayMethod(data.paymentMethod),
    date: Timestamp.now(),
    notes: 'Abono inicial de apertura',
    registeredBy: data.sellerName || 'Sistema',
  };

  const cleanedItems: LayawayItem[] = data.items.map((i) => ({
    productId: i.productId || '',
    brand: i.brand || 'Marca',
    name: i.name || 'Prenda',
    color: i.color || '',
    size: i.size || '',
    quantity: Number(i.quantity) || 1,
    unitPrice: roundMoney(Number(i.unitPrice) || 0),
    totalPrice: roundMoney(Number(i.totalPrice) || 0),
  }));

  const newLayawayRef = doc(collection(db, 'layaways'));
  const saleRef = layawaySaleRefFor(newLayawayRef.id);
  let resultSale: Sale | undefined;

  await runTransaction(db, async (transaction) => {
    // FASE 1: LECTURAS (READS) - Obtener todos los productos involucrados
    const productSnaps = new Map<string, { ref: any; data: any }>();

    for (const item of cleanedItems) {
      if (!item.productId || productSnaps.has(item.productId)) continue;
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error(`El producto "${item.name}" ya no existe en el inventario.`);
      }

      productSnaps.set(item.productId, {
        ref: productRef,
        data: productSnap.data(),
      });
    }

    // Si el abono inicial ya cubre todo, hay que verificar si la venta
    // oficial ya existe (idempotencia) antes de escribir.
    let existingSaleData: any = null;
    if (completedNow) {
      const saleSnap = await transaction.get(saleRef);
      if (saleSnap.exists()) existingSaleData = saleSnap.data();
    }

    // FASE 2: PROCESAMIENTO EN MEMORIA DE VARIANTES Y STOCK
    const updatedProducts = new Map<string, { ref: any; variants: any[] }>();

    for (const item of cleanedItems) {
      if (!item.productId) continue;
      const productInfo = productSnaps.get(item.productId);
      if (!productInfo) continue;

      const currentVariants =
        updatedProducts.get(item.productId)?.variants || productInfo.data.variants || [];

      const updatedVariants = currentVariants.map((variant: any) => {
        if ((variant.color || '').toLowerCase().trim() === (item.color || '').toLowerCase().trim()) {
          const updatedSizes = (variant.sizes || []).map((sObj: any) => {
            if ((sObj.size || '').toString().trim() === (item.size || '').toString().trim()) {
              const currentStock = Number(sObj.stock) || 0;
              if (currentStock < item.quantity) {
                throw new Error(
                  `Stock insuficiente de ${item.name} (${item.color}/Talla ${item.size}). Disponible: ${currentStock}`
                );
              }
              return {
                ...sObj,
                stock: currentStock - item.quantity,
              };
            }
            return sObj;
          });
          return { ...variant, sizes: updatedSizes };
        }
        return variant;
      });

      updatedProducts.set(item.productId, {
        ref: productInfo.ref,
        variants: updatedVariants,
      });
    }

    // FASE 3: ESCRITURAS (WRITES) - Actualizar stock de inventario
    for (const [_, prod] of updatedProducts) {
      transaction.update(prod.ref, {
        variants: prod.variants,
        updatedAt: Timestamp.now(),
      });
    }

    // FASE 4: ESCRITURA FINAL - Crear el registro del apartado
    transaction.set(newLayawayRef, {
      code,
      createdAt: Timestamp.now(),
      dueDate: Timestamp.fromDate(data.dueDate),
      sellerId: data.sellerId || '',
      sellerName: data.sellerName || 'Vendedor',
      customerName: data.customerName || 'Cliente General',
      customerPhone: data.customerPhone || '',
      items: cleanedItems,
      totalAmount,
      totalPaid,
      balanceRemaining,
      status: completedNow ? 'completed' : 'active',
      payments: [initialPayment],
      notes: data.notes || '',
      ...(completedNow
        ? { saleId: saleRef.id, saleReceiptNumber: `REC-${code}` }
        : {}),
    });

    // FASE 5: si el cliente pagó todo al apartar, se oficializa la venta en
    // la MISMA transacción y SIN volver a descontar stock (ya se descontó).
    if (completedNow) {
      if (!existingSaleData) {
        const salePayload = buildLayawaySalePayload({
          layawayId: newLayawayRef.id,
          code,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          sellerId: data.sellerId,
          sellerName: data.sellerName,
          items: cleanedItems,
          totalAmount,
          payments: [initialPayment],
          notes: data.notes || 'Apartado pagado en su totalidad al aperturar',
        });
        transaction.set(saleRef, salePayload);
        resultSale = buildSaleFromSnap(saleRef.id, salePayload);
      } else {
        resultSale = buildSaleFromSnap(saleRef.id, existingSaleData);
      }
    }
  });

  // El catálogo público debe dejar de mostrar el stock reservado.
  await bumpCatalogVersion();

  return {
    code,
    saleId: completedNow ? saleRef.id : undefined,
    sale: resultSale,
  };
};

/**
 * Registra un nuevo abono para un apartado
 */
export const addLayawayPayment = async (
  layawayId: string,
  amount: number,
  paymentMethod: 'efectivo' | 'pago_movil' | 'punto' | 'transferencia' | 'mixto',
  registeredBy?: string,
  notes?: string
): Promise<LayawaySaleResult> => {
  if (!db) throw new Error('Base de datos Firestore no inicializada.');

  const layawayRef = doc(db, 'layaways', layawayId);
  const saleRef = layawaySaleRefFor(layawayId);
  let resultSale: Sale | undefined;
  let completed = false;

  await runTransaction(db, async (transaction) => {
    // Reinicia resultados por si Firestore reintenta la transacción.
    completed = false;
    resultSale = undefined;

    // LECTURA PRIMERO
    const snap = await transaction.get(layawayRef);
    if (!snap.exists()) throw new Error('El apartado no existe.');

    const data = snap.data();
    if (data.status !== 'active') throw new Error('Este apartado ya no está activo.');

    const paymentAmount = roundMoney(Number(amount));
    const totalAmount = roundMoney(Number(data.totalAmount) || 0);
    const currentPaid = roundMoney(Number(data.totalPaid) || 0);
    const storedBalance = Number(data.balanceRemaining);
    const currentBalance = Number.isFinite(storedBalance)
      ? roundMoney(storedBalance)
      : roundMoney(Math.max(0, totalAmount - currentPaid));

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('El monto del abono debe ser un número mayor a 0.');
    }
    if (paymentAmount > currentBalance + 0.005) {
      throw new Error(
        `El abono no puede superar el saldo pendiente ($${currentBalance.toFixed(2)}).`
      );
    }

    const newTotalPaid = roundMoney(currentPaid + paymentAmount);
    const newBalance = roundMoney(Math.max(0, totalAmount - newTotalPaid));
    completed = newBalance <= 0.005;

    const newPayment: RawLayawayPayment = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: paymentAmount,
      paymentMethod: normalizeLayawayMethod(paymentMethod),
      date: Timestamp.now(),
      notes: notes || 'Abono parcial',
      registeredBy: registeredBy || 'Sistema',
    };

    const updatedPayments: RawLayawayPayment[] = [...(data.payments || []), newPayment];

    // Si con este abono se completa el saldo, hay que leer la venta oficial
    // antes de escribir (regla de Firestore: reads antes de writes).
    let existingSaleData: any = null;
    if (completed) {
      const saleSnap = await transaction.get(saleRef);
      if (saleSnap.exists()) existingSaleData = saleSnap.data();
    }

    // ESCRITURA DESPUÉS
    transaction.update(layawayRef, {
      totalPaid: newTotalPaid,
      balanceRemaining: newBalance,
      status: completed ? 'completed' : 'active',
      payments: updatedPayments,
      updatedAt: Timestamp.now(),
      ...(completed
        ? {
            saleId: saleRef.id,
            saleReceiptNumber: data.saleReceiptNumber || `REC-${data.code || layawayId}`,
          }
        : {}),
    });

    // Al llegar a 0 se genera la venta oficial en la MISMA transacción.
    // No se toca el stock: ya se descontó al crear el apartado.
    if (completed) {
      if (!existingSaleData) {
        const salePayload = buildLayawaySalePayload({
          layawayId,
          code: data.code || layawayId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          sellerId: data.sellerId,
          sellerName: data.sellerName,
          items: Array.isArray(data.items) ? data.items : [],
          totalAmount,
          payments: updatedPayments,
          notes: data.notes || 'Venta oficializada al completar el apartado',
        });
        transaction.set(saleRef, salePayload);
        resultSale = buildSaleFromSnap(saleRef.id, salePayload);
      } else {
        resultSale = buildSaleFromSnap(saleRef.id, existingSaleData);
      }
    }
  });

  return {
    completed,
    saleId: completed ? saleRef.id : undefined,
    sale: resultSale,
  };
};

/**
 * Oficializa un apartado ya completado que por alguna razón no tenga venta.
 * Es idempotente: si la venta ya existe, la devuelve sin duplicarla.
 */
export const officializeLayawaySale = async (layawayId: string): Promise<Sale> => {
  if (!db) throw new Error('Base de datos Firestore no inicializada.');

  const layawayRef = doc(db, 'layaways', layawayId);
  const saleRef = layawaySaleRefFor(layawayId);
  let sale: Sale | undefined;

  await runTransaction(db, async (transaction) => {
    const layawaySnap = await transaction.get(layawayRef);
    if (!layawaySnap.exists()) throw new Error('El apartado no existe.');

    const saleSnap = await transaction.get(saleRef);
    if (saleSnap.exists()) {
      const existing = buildSaleFromSnap(saleRef.id, saleSnap.data());
      sale = existing;
      const data = layawaySnap.data();
      if (!data.saleId) {
        transaction.update(layawayRef, {
          saleId: saleRef.id,
          saleReceiptNumber: existing.receiptNumber || `REC-${data.code || layawayId}`,
          status: 'completed',
          balanceRemaining: 0,
          updatedAt: Timestamp.now(),
        });
      }
      return;
    }

    const data = layawaySnap.data();
    const balance = roundMoney(Number(data.balanceRemaining) || 0);
    if (data.status !== 'completed' && balance > 0.005) {
      throw new Error('Solo se pueden oficializar apartados con saldo en 0.');
    }

    const payload = buildLayawaySalePayload({
      layawayId,
      code: data.code || layawayId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      sellerId: data.sellerId,
      sellerName: data.sellerName,
      items: Array.isArray(data.items) ? data.items : [],
      totalAmount: roundMoney(Number(data.totalAmount) || 0),
      payments: Array.isArray(data.payments) ? data.payments : [],
      notes: data.notes || 'Venta oficializada desde apartado completado',
    });

    transaction.set(saleRef, payload);
    transaction.update(layawayRef, {
      saleId: saleRef.id,
      saleReceiptNumber: payload.receiptNumber,
      status: 'completed',
      balanceRemaining: 0,
      updatedAt: Timestamp.now(),
    });
    sale = buildSaleFromSnap(saleRef.id, payload);
  });

  if (!sale) throw new Error('No se pudo oficializar la venta del apartado.');
  return sale;
};

/**
 * Cancela un apartado y reintegra automáticamente el stock al inventario.
 * Solo se permite sobre apartados en estado 'active'.
 */
export const cancelLayaway = async (layaway: Layaway, reason?: string): Promise<void> => {
  if (!db || !layaway.id) return;
  if (layaway.status !== 'active') {
    throw new Error('Solo se pueden cancelar apartados activos.');
  }

  const layawayRef = doc(db, 'layaways', layaway.id);

  await runTransaction(db, async (transaction) => {
    // 1) Lecturas primero: apartado + productos involucrados.
    const layawaySnap = await transaction.get(layawayRef);
    if (!layawaySnap.exists()) throw new Error('El apartado no existe.');

    const data = layawaySnap.data();
    if (data.status !== 'active') {
      throw new Error('Solo se pueden cancelar apartados activos.');
    }

    const items: LayawayItem[] = Array.isArray(data.items) ? data.items : [];
    const itemsByProduct = new Map<string, LayawayItem[]>();
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

      const product = snap.data();
      const variants = (product.variants || []).map((variant: any) => ({
        ...variant,
        sizes: (variant.sizes || []).map((size: any) => ({ ...size })),
      }));

      for (const item of itemsByProduct.get(productIds[index]) || []) {
        for (const variant of variants) {
          if (
            (variant.color || '').toLowerCase().trim() !==
            (item.color || '').toLowerCase().trim()
          ) {
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

    // 3) Escrituras después de todas las lecturas.
    for (const { ref, variants } of updatedProducts) {
      transaction.update(ref, { variants, updatedAt: Date.now() });
    }

    transaction.update(layawayRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelReason: reason || 'Cancelado por el usuario',
    });
  });

  await bumpCatalogVersion();
};

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
}

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
}): Promise<string> => {
  if (!db) throw new Error('Base de datos Firestore no inicializada.');

  const code = `APT-${Math.floor(100000 + Math.random() * 900000)}`;
  const totalAmount = data.items.reduce((acc, i) => acc + (Number(i.totalPrice) || 0), 0);
  const totalPaid = Number(data.initialPaymentAmount) || 0;
  const balanceRemaining = Math.max(0, totalAmount - totalPaid);

  const initialPayment = {
    id: `PAY-${Date.now()}`,
    amount: totalPaid,
    paymentMethod: data.paymentMethod || 'efectivo',
    date: Timestamp.now(),
    notes: 'Abono inicial de apertura',
    registeredBy: data.sellerName || 'Sistema',
  };

  const newLayawayRef = doc(collection(db, 'layaways'));

  await runTransaction(db, async (transaction) => {
    // FASE 1: LECTURAS (READS) - Obtener todos los productos involucrados
    const productSnaps = new Map<string, { ref: any; data: any }>();

    for (const item of data.items) {
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

    // FASE 2: PROCESAMIENTO EN MEMORIA DE VARIANTES Y STOCK
    const updatedProducts = new Map<string, { ref: any; variants: any[] }>();

    for (const item of data.items) {
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
    const cleanedItems = data.items.map((i) => ({
      productId: i.productId || '',
      brand: i.brand || 'Marca',
      name: i.name || 'Prenda',
      color: i.color || '',
      size: i.size || '',
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      totalPrice: Number(i.totalPrice) || 0,
    }));

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
      status: balanceRemaining === 0 ? 'completed' : 'active',
      payments: [initialPayment],
      notes: data.notes || '',
    });
  });

  return code;
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
): Promise<void> => {
  if (!db) return;

  const layawayRef = doc(db, 'layaways', layawayId);

  await runTransaction(db, async (transaction) => {
    // LECTURA PRIMERO
    const snap = await transaction.get(layawayRef);
    if (!snap.exists()) throw new Error('El apartado no existe.');

    const data = snap.data();
    if (data.status !== 'active') throw new Error('Este apartado ya no está activo.');

    const newPaymentAmount = Number(amount) || 0;
    const newTotalPaid = Number(data.totalPaid || 0) + newPaymentAmount;
    const newBalance = Math.max(0, Number(data.totalAmount || 0) - newTotalPaid);

    const newPayment = {
      id: `PAY-${Date.now()}`,
      amount: newPaymentAmount,
      paymentMethod: paymentMethod || 'efectivo',
      date: Timestamp.now(),
      notes: notes || 'Abono parcial',
      registeredBy: registeredBy || 'Sistema',
    };

    const updatedPayments = [...(data.payments || []), newPayment];

    // ESCRITURA DESPUÉS
    transaction.update(layawayRef, {
      totalPaid: newTotalPaid,
      balanceRemaining: newBalance,
      status: newBalance === 0 ? 'completed' : 'active',
      payments: updatedPayments,
      updatedAt: Timestamp.now(),
    });
  });
};

/**
 * Cancela un apartado y reintegra automáticamente el stock al inventario
 */
export const cancelLayaway = async (layaway: Layaway, reason?: string): Promise<void> => {
  if (!db || layaway.status === 'cancelled') return;

  const layawayRef = doc(db, 'layaways', layaway.id);

  await runTransaction(db, async (transaction) => {
    // FASE 1: LECTURAS
    const productSnaps = new Map<string, { ref: any; data: any }>();

    for (const item of layaway.items) {
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

    // FASE 2: CÁLCULOS EN MEMORIA
    const updatedProducts = new Map<string, { ref: any; variants: any[] }>();

    for (const item of layaway.items) {
      if (!item.productId) continue;
      const productInfo = productSnaps.get(item.productId);
      if (!productInfo) continue;

      const currentVariants =
        updatedProducts.get(item.productId)?.variants || productInfo.data.variants || [];

      const updatedVariants = currentVariants.map((variant: any) => {
        if ((variant.color || '').toLowerCase().trim() === (item.color || '').toLowerCase().trim()) {
          const updatedSizes = (variant.sizes || []).map((sObj: any) => {
            if ((sObj.size || '').toString().trim() === (item.size || '').toString().trim()) {
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

      updatedProducts.set(item.productId, {
        ref: productInfo.ref,
        variants: updatedVariants,
      });
    }

    // FASE 3: ESCRITURAS
    for (const [_, prod] of updatedProducts) {
      transaction.update(prod.ref, {
        variants: prod.variants,
        updatedAt: Timestamp.now(),
      });
    }

    transaction.update(layawayRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelReason: reason || 'Cancelado por el usuario',
    });
  });
};

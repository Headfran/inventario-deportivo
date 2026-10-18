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
  brand: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
  paymentMethod: 'efectivo' | 'pago_movil' | 'punto' | 'transferencia' | 'mixto';
  status: 'completed' | 'voided';
  notes?: string;
}

/**
 * Convierte de forma segura cualquier representación de fecha a un Date de JS
 */
export const parseDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Formatea una fecha a string de forma consistente sin errores
 */
export const formatDateTime = (dateVal: any, style: 'short' | 'long' = 'short'): string => {
  const d = parseDate(dateVal);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  let hoursStr = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');

  const ampm = hoursStr >= 12 ? 'PM' : 'AM';
  hoursStr = hoursStr % 12;
  hoursStr = hoursStr ? hoursStr : 12; // el 0 debe ser 12

  if (style === 'long') {
    return `${day}/${month}/${year} a las ${hoursStr}:${minutes} ${ampm}`;
  }
  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
};

/**
 * Escucha la lista de ventas en tiempo real. 
 * INCLUYE NORMALIZACIÓN DE DATOS para evitar los errores de "N/A"
 */
export const subscribeToSales = (callback: (sales: Sale[]) => void) => {
  if (!db) return () => { };

  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const salesList: Sale[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        // NORMALIZACIÓN: Mapeamos las propiedades del POS a las que espera el Historial
        const normalizedItems: SaleItem[] = (data.items || []).map((item: any) => ({
          productId: item.productId || 'unknown',
          brand: item.productBrand || item.brand || 'Genérico',
          name: item.productName || item.name || 'Artículo Desconocido',
          color: item.variantColor || item.color || 'N/A',
          size: item.size || 'N/A',
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.subtotal || item.totalPrice) || 0,
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
          total: Number(data.totalAmount || data.total) || 0, // Fallback vital para el POS
          paymentMethod: data.paymentMethod || 'efectivo',
          status: data.status || 'completed',
          notes: data.notes || '',
        } as Sale;
      });

      callback(salesList);
    },
    (error) => {
      console.error('Error escuchando historial de ventas:', error);
    }
  );
};

/**
 * Anula una venta de forma atómica devolviendo el stock
 */
export const voidSale = async (sale: Sale, reason?: string): Promise<boolean> => {
  if (!db || sale.status === 'voided') return false;

  try {
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', sale.id);

      // 1. Restaurar stock
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

      // 2. Marcar venta como anulada
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

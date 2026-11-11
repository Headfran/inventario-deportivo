import { db } from './firebase';
import {
  collection, doc, runTransaction, onSnapshot, query, orderBy, Timestamp, limit,
} from 'firebase/firestore';
import { Sale } from '../types/sale';
import { Product } from '../types/inventory';

/**
 * Elimina recursivamente los `undefined` de un objeto para que Firestore no los rechace,
 * SIN romper los Timestamps (que son instancias de clase, no objetos planos).
 */
const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  // Duck-typing de seguridad por si el bundler crea dos copias de Timestamp
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

export const createSale = async (
  saleData: Omit<Sale, 'id' | 'createdAt'>
): Promise<string> => {
  return await runTransaction(db, async (transaction) => {
    const productIds = Array.from(new Set(saleData.items.map((item) => item.productId)));
    const productRefs = productIds.map((id) => doc(db, 'products', id));
    const productDocs = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

    const productMap: Record<string, Product> = {};
    productDocs.forEach((docSnap, index) => {
      const currentId = productIds[index];
      if (!docSnap.exists()) {
        throw new Error(`El producto con ID "${currentId}" ya no existe.`);
      }
      productMap[currentId] = { id: docSnap.id || currentId, ...docSnap.data() } as Product;
    });

    for (const item of saleData.items) {
      const prod = productMap[item.productId];
      if (!prod) throw new Error(`Producto no encontrado: ${item.name}`);

      const variants = prod.variants || [];
      const variantIndex = variants.findIndex(
        (v) => (v.color || '').toLowerCase() === (item.color || '').toLowerCase()
      );
      if (variantIndex === -1) {
        throw new Error(`La variante "${item.color}" no existe en ${prod.name}`);
      }

      const sizes = variants[variantIndex].sizes || [];
      const sizeIndex = sizes.findIndex((s) => s.size === item.size);
      if (sizeIndex === -1) {
        throw new Error(`La talla "${item.size}" no existe para el color ${item.color}`);
      }

      const currentStock = Number(sizes[sizeIndex].stock) || 0;
      if (currentStock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${prod.name}" (${item.color} - Talla ${item.size}). ` +
          `Disponible: ${currentStock}, Solicitado: ${item.quantity}`
        );
      }

      variants[variantIndex].sizes[sizeIndex].stock = currentStock - item.quantity;
      prod.variants = variants;
    }

    productIds.forEach((id) => {
      const updatedProd = productMap[id];
      transaction.update(doc(db, 'products', id), { variants: updatedProd.variants });
    });

    const newSaleRef = doc(collection(db, 'sales'));
    const newSaleData = sanitizeForFirestore({
      ...saleData,
      createdAt: Timestamp.now(),
    });
    transaction.set(newSaleRef, newSaleData);

    return newSaleRef.id;
  });
};

export const subscribeToSales = (
  callback: (sales: Sale[]) => void,
  options?: { limit?: number }
) => {
  const maxDocs = options?.limit ?? 100;
  const q = query(
    collection(db, 'sales'),
    orderBy('createdAt', 'desc'),
    limit(maxDocs)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const salesList: Sale[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Sale[];
      callback(salesList);
    },
    (error) => {
      console.error('Error escuchando ventas:', error);
    }
  );
};

import { db } from './firebase';
import {
  collection, doc, runTransaction, onSnapshot, query, orderBy, Timestamp
} from 'firebase/firestore';
import { Sale } from '../types/sale';
import { Product } from '../types/inventory';

export const createSale = async (saleData: Omit<Sale, 'id' | 'createdAt'>): Promise<string> => {
  return await runTransaction(db, async (transaction) => {
    const productIds = Array.from(new Set(saleData.items.map((item) => item.productId)));
    const productRefs = productIds.map((id) => doc(db, 'products', id));
    const productDocs = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

    const productMap: Record<string, Product> = {};
    productDocs.forEach((docSnap, index) => {
      const currentId = productIds[index];
      if (!docSnap.exists()) throw new Error(`El producto con ID "${currentId}" ya no existe.`);
      productMap[currentId] = { id: docSnap.id || currentId, ...docSnap.data() } as Product;
    });

    for (const item of saleData.items) {
      const prod = productMap[item.productId];
      if (!prod) throw new Error(`Producto no encontrado: ${item.name}`);

      // Usamos item.color en lugar de item.variantColor
      const variantIndex = prod.variants.findIndex((v) => v.color.toLowerCase() === item.color.toLowerCase());
      if (variantIndex === -1) throw new Error(`La variante "${item.color}" no existe en ${prod.name}`);

      const sizeIndex = prod.variants[variantIndex].sizes.findIndex((s) => s.size === item.size);
      if (sizeIndex === -1) throw new Error(`La talla "${item.size}" no existe para el color ${item.color}`);

      const currentStock = Number(prod.variants[variantIndex].sizes[sizeIndex].stock) || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Stock insuficiente para "${prod.name}" (${item.color} - Talla ${item.size}). Disponible: ${currentStock}, Solicitado: ${item.quantity}`);
      }

      prod.variants[variantIndex].sizes[sizeIndex].stock = currentStock - item.quantity;
    }

    productIds.forEach((id) => {
      const updatedProd = productMap[id];
      transaction.update(doc(db, 'products', id), { variants: updatedProd.variants });
    });

    const newSaleRef = doc(collection(db, 'sales'));
    const newSaleData = { ...saleData, createdAt: Timestamp.now() };
    transaction.set(newSaleRef, JSON.parse(JSON.stringify(newSaleData)));

    return newSaleRef.id;
  });
};

export const subscribeToSales = (callback: (sales: Sale[]) => void) => {
  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const salesList: Sale[] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) as Sale[];
    callback(salesList);
  });
};

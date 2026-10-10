import { db } from './firebase';
import {
  collection,
  doc,
  runTransaction,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { Sale } from '../types/sale';
import { Product } from '../types/inventory';

/**
 * Registra una venta y descuenta el stock atómicamente por variante y talla
 */
export const createSale = async (saleData: Omit<Sale, 'id' | 'createdAt'>): Promise<string> => {
  return await runTransaction(db, async (transaction) => {
    // 1. Obtener los IDs de productos únicos incluidos en la venta
    const productIds = Array.from(new Set(saleData.items.map((item) => item.productId)));
    const productRefs = productIds.map((id) => doc(db, 'products', id));

    // Obtener los snapshots de la base de datos
    const productDocs = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

    const productMap: Record<string, Product> = {};

    productDocs.forEach((docSnap, index) => {
      const currentId = productIds[index];
      if (!docSnap.exists()) {
        throw new Error(`El producto con ID "${currentId}" ya no existe.`);
      }
      productMap[currentId] = { id: docSnap.id || currentId, ...docSnap.data() } as Product;
    });

    // 2. Validar stock disponible y preparar descuento
    for (const item of saleData.items) {
      const prod = productMap[item.productId];
      if (!prod) {
        throw new Error(`Producto no encontrado: ${item.productName}`);
      }

      const variantIndex = prod.variants.findIndex(
        (v) => v.color.toLowerCase() === item.variantColor.toLowerCase()
      );
      if (variantIndex === -1) {
        throw new Error(`La variante "${item.variantColor}" no existe en ${prod.name}`);
      }

      const sizeIndex = prod.variants[variantIndex].sizes.findIndex(
        (s) => s.size === item.size
      );
      if (sizeIndex === -1) {
        throw new Error(`La talla "${item.size}" no existe para el color ${item.variantColor}`);
      }

      const currentStock = Number(prod.variants[variantIndex].sizes[sizeIndex].stock) || 0;
      if (currentStock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${prod.name}" (${item.variantColor} - Talla ${item.size}). Disponible: ${currentStock}, Solicitado: ${item.quantity}`
        );
      }

      // Descontar inventario localmente en el mapa de la transacción
      prod.variants[variantIndex].sizes[sizeIndex].stock = currentStock - item.quantity;
    }

    // 3. Actualizar los productos modificados en Firestore
    productIds.forEach((id) => {
      const updatedProd = productMap[id];
      const ref = doc(db, 'products', id);
      transaction.update(ref, { variants: updatedProd.variants });
    });

    // 4. Crear el registro de la venta sin valores undefined
    const salesColRef = collection(db, 'sales');
    const newSaleRef = doc(salesColRef);

    const newSaleData = {
      ...saleData,
      createdAt: Timestamp.now(),
    };

    // Elimina cualquier propiedad 'undefined' antes de escribir a Firestore
    const cleanSaleData = JSON.parse(JSON.stringify(newSaleData));

    transaction.set(newSaleRef, cleanSaleData);

    return newSaleRef.id;
  });
};

/**
 * Escucha las ventas en tiempo real ordenadas por fecha reciente
 */
export const subscribeToSales = (callback: (sales: Sale[]) => void) => {
  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const salesList: Sale[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Sale[];
    callback(salesList);
  });
};

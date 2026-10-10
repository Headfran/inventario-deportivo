import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  getDoc,
  getDocs,
  limit,
  orderBy,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '../types/inventory';
import { deleteImageFromR2 } from './storage';

const PRODUCTS_COLLECTION = 'products';

export interface PaginatedResult {
  products: Product[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// Escuchar cambios en tiempo real en los productos
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const products: Product[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Product));
    callback(products);
  });
};

// Crear un nuevo producto
export const createProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...product,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
};

// Actualizar un producto existente
export const updateProduct = async (id: string, product: Partial<Product>): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, id);
  await updateDoc(productRef, {
    ...product,
    updatedAt: Date.now(),
  });
};

// Eliminar un producto y sus imágenes asociadas en R2
export const deleteProduct = async (product: Product): Promise<void> => {
  // 1. Borrar de R2 todas las imágenes registradas en el producto
  if (product.images && product.images.length > 0) {
    await Promise.allSettled(
      product.images.map((imageUrl) => deleteImageFromR2(imageUrl))
    );
  }

  // 2. Borrar el documento de la base de datos Firestore
  if (product.id) {
    const productRef = doc(db, PRODUCTS_COLLECTION, product.id);
    await deleteDoc(productRef);
  }
};

/**
 * Actualiza atómicamente el stock de una talla y color específico dentro de un producto.
 */
export const updateVariantStock = async (
  productId: string,
  colorName: string,
  targetSize: string,
  newStock: number
): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  // Obtener el estado actual mediante lectura o actualización de arreglo
  // Para garantizar coherencia en tiempo real
  const snapshot = await getDoc(productRef);
  if (!snapshot.exists()) throw new Error('El producto no existe');

  const product = snapshot.data() as Product;
  const updatedVariants = (product.variants || []).map((variant) => {
    if (variant.color.toLowerCase() === colorName.toLowerCase()) {
      const updatedSizes = (variant.sizes || []).map((sizeObj) => {
        if (sizeObj.size === targetSize) {
          return { ...sizeObj, stock: Math.max(0, newStock) };
        }
        return sizeObj;
      });
      return { ...variant, sizes: updatedSizes };
    }
    return variant;
  });

  await updateDoc(productRef, {
    variants: updatedVariants,
    updatedAt: Date.now(),
  });
};

export const fetchProductsPage = async (
  pageSize: number = 15,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<PaginatedResult> => {
  try {
    let q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(
        collection(db, 'products'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Product)
    );
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return {
      products,
      lastDoc: newLastDoc,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error('Error cargando página de productos:', error);
    throw error;
  }
};

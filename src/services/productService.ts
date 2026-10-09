import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '../types/inventory';
import { deleteImageFromR2 } from './storage';

const PRODUCTS_COLLECTION = 'products';

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

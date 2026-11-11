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
  getDocsFromCache,
  limit,
  orderBy,
  startAfter,
  runTransaction,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '../types/inventory';
import { deleteImageFromR2 } from './storage';
import { getCachedImageUrl } from '../utils/imageUrl';

const PRODUCTS_COLLECTION = 'products';

export interface PaginatedResult {
  products: Product[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  /** true si la respuesta vino de IndexedDB (0 lecturas facturables) */
  fromCache?: boolean;
}

const normalizeProduct = (product: Product): Product => ({
  ...product,
  images: (product.images || [])
    .map((u) => getCachedImageUrl(u))
    .filter((u): u is string => Boolean(u)),
});

/**
 * Listener en tiempo real del catálogo.
 * Se usa UNA sola instancia global (en App.tsx) para evitar re-syncs por pantalla.
 *
 * `pageSize` opcional: si tu catálogo es pequeño (<500) no hace falta limitar.
 * Si es grande y quieres reducir lecturas, pasa `{ pageSize: 300 }`.
 */
export const subscribeToProducts = (
  callback: (products: Product[]) => void,
  options?: { pageSize?: number }
) => {
  const col = collection(db, PRODUCTS_COLLECTION);
  const q = options?.pageSize
    ? query(col, orderBy('createdAt', 'desc'), limit(options.pageSize))
    : query(col, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const products: Product[] = snapshot.docs.map((d) =>
      normalizeProduct({ id: d.id, ...d.data() } as Product)
    );
    callback(products);
  });
};

export const createProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...product,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
};

export const updateProduct = async (
  id: string,
  product: Partial<Product>
): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, id);
  await updateDoc(productRef, {
    ...product,
    updatedAt: Date.now(),
  });
};

export const deleteProduct = async (product: Product): Promise<void> => {
  if (product.images && product.images.length > 0) {
    await Promise.allSettled(product.images.map((url) => deleteImageFromR2(url)));
  }
  if (product.id) {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, product.id));
  }
};

/**
 * Actualiza atómicamente el stock de una talla/color usando transacción.
 * Garantiza consistencia si dos personas ajustan al mismo tiempo.
 */
export const updateVariantStock = async (
  productId: string,
  colorName: string,
  targetSize: string,
  newStock: number
): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const product = snap.data() as Product;
    const updatedVariants = (product.variants || []).map((variant) => {
      if (variant.color.toLowerCase() === colorName.toLowerCase()) {
        const updatedSizes = (variant.sizes || []).map((sObj) =>
          sObj.size === targetSize
            ? { ...sObj, stock: Math.max(0, newStock) }
            : sObj
        );
        return { ...variant, sizes: updatedSizes };
      }
      return variant;
    });

    tx.update(productRef, {
      variants: updatedVariants,
      updatedAt: Date.now(),
    });
  });
};

const buildPageQuery = (
  pageSize: number,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
) => {
  const col = collection(db, PRODUCTS_COLLECTION);
  return lastDoc
    ? query(col, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize))
    : query(col, orderBy('createdAt', 'desc'), limit(pageSize));
};

/**
 * Paginación con estrategia "caché primero".
 * - Si el bloque ya está cacheado en IndexedDB → 0 lecturas al servidor.
 * - Si no → cae al servidor (lecturas facturables).
 */
export const fetchProductsPage = async (
  pageSize: number = 15,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  preferCache: boolean = true
): Promise<PaginatedResult> => {
  const q = buildPageQuery(pageSize, lastDoc);

  // 1) Intento desde caché (0 reads)
  if (preferCache) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return {
          products: cached.docs.map((d) =>
            normalizeProduct({ id: d.id, ...d.data() } as Product)
          ),
          lastDoc: cached.docs[cached.docs.length - 1] || null,
          hasMore: cached.docs.length === pageSize,
          fromCache: true,
        };
      }
    } catch {
      /* cache miss → seguimos al servidor */
    }
  }

  // 2) Fallback al servidor
  try {
    const snapshot = await getDocs(q);
    return {
      products: snapshot.docs.map((d) =>
        normalizeProduct({ id: d.id, ...d.data() } as Product)
      ),
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize,
      fromCache: false,
    };
  } catch (error) {
    console.error('Error cargando página de productos:', error);
    throw error;
  }
};

export const fetchAllProducts = async (options?: {
  pageSize?: number;
  maxPages?: number;
  fromServer?: boolean;
}): Promise<Product[]> => {
  const { pageSize = 100, maxPages = 10, fromServer = false } = options || {};
  const all: Product[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  for (let i = 0; i < maxPages; i++) {
    const res = await fetchProductsPage(pageSize, lastDoc, !fromServer);
    all.push(...res.products);
    if (!res.hasMore) break;
    lastDoc = res.lastDoc;
    if (!lastDoc) break;
  }

  return all;
};

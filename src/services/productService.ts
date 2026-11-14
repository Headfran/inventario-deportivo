import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  setDoc,
  serverTimestamp,
  limit,
  orderBy,
  startAfter,
  where,
  runTransaction,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '../types/inventory';
import { deleteImageFromR2 } from './storage';
import { getCachedImageUrl } from '../utils/imageUrl';

const PRODUCTS_COLLECTION = 'products';
const SETTINGS_COLLECTION = 'settings';
const CATALOG_META_DOC = 'catalog_meta';

export interface PaginatedResult {
  products: Product[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  fromCache?: boolean;
}

// ─── 1. FUNCIONES DE VERSIÓN DEL CATÁLOGO ───
export const bumpCatalogVersion = async () => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  await setDoc(ref, { lastUpdate: serverTimestamp() }, { merge: true });
};

export const getCatalogVersion = async (fromServer = false): Promise<number> => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  try {
    const snap = fromServer ? await getDocFromServer(ref) : await getDoc(ref);
    return snap.exists() ? snap.data().lastUpdate?.toMillis() || 0 : 0;
  } catch {
    return 0;
  }
};

export const subscribeToCatalogVersion = (callback: (version: number) => void) => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data().lastUpdate?.toMillis() || 0 : 0);
  });
};

// ─── 2. FUNCIÓN DELTA (Solo descarga lo que cambió) ───
export const fetchProductsDelta = async (lastSyncTime: number): Promise<{ updated: Product[], deletedIds: string[] }> => {
  const col = collection(db, PRODUCTS_COLLECTION);
  // ⚠️ Firestore pedirá crear un índice para esta consulta la primera vez.
  const q = query(col, where('updatedAt', '>', lastSyncTime));
  const snapshot = await getDocsFromServer(q); // Forzamos servidor para traer los cambios frescos

  const updated: Product[] = [];
  const deletedIds: string[] = [];

  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.deleted) {
      deletedIds.push(d.id); // Si está marcado como borrado, guardamos su ID
    } else {
      updated.push(normalizeProduct({ id: d.id, ...data } as Product));
    }
  });

  return { updated, deletedIds };
};

// ─── 3. NORMALIZADOR Y LISTENERS (Filtrando borrados) ───
const normalizeProduct = (product: Product): Product => ({
  ...product,
  images: (product.images || [])
    .map((u) => getCachedImageUrl(u))
    .filter((u): u is string => Boolean(u)),
});

export const subscribeToProducts = (
  callback: (products: Product[]) => void,
  options?: { pageSize?: number }
) => {
  const col = collection(db, PRODUCTS_COLLECTION);
  const q = options?.pageSize
    ? query(col, orderBy('createdAt', 'desc'), limit(options.pageSize))
    : query(col, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const products: Product[] = snapshot.docs
      .filter((d) => !d.data().deleted) // 👈 Ocultamos los marcados como borrados
      .map((d) => normalizeProduct({ id: d.id, ...d.data() } as Product));
    callback(products);
  });
};

// ─── 4. CRUD CON SINCRONIZACIÓN (Soft Delete + Bump Version) ───
export const createProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...product,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deleted: false, // 👈 Aseguramos que nazca sin el flag de borrado
  });
  await bumpCatalogVersion();
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
  await bumpCatalogVersion();
};

export const deleteProduct = async (product: Product): Promise<void> => {
  if (product.images && product.images.length > 0) {
    await Promise.allSettled(product.images.map((url) => deleteImageFromR2(url)));
  }
  if (product.id) {
    // 👈 SOFT DELETE: En lugar de deleteDoc, lo marcamos como borrado
    await updateDoc(doc(db, PRODUCTS_COLLECTION, product.id), {
      deleted: true,
      updatedAt: Date.now(),
    });
    await bumpCatalogVersion();
  }
};

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

  // 👈 También bumpeamos la versión al cambiar stock manualmente o por venta
  await bumpCatalogVersion();
};

// ─── 5. PAGINACIÓN Y FETCH ALL (Filtrando borrados) ───
const buildPageQuery = (
  pageSize: number,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
) => {
  const col = collection(db, PRODUCTS_COLLECTION);
  return lastDoc
    ? query(col, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize))
    : query(col, orderBy('createdAt', 'desc'), limit(pageSize));
};

export const fetchProductsPage = async (
  pageSize: number = 15,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  preferCache: boolean = true
): Promise<PaginatedResult> => {
  const q = buildPageQuery(pageSize, lastDoc);

  const processDocs = (docs: QueryDocumentSnapshot<DocumentData>[]) => {
    return docs
      .filter((d) => !d.data().deleted) // 👈 Ignoramos los borrados
      .map((d) => normalizeProduct({ id: d.id, ...d.data() } as Product));
  };

  if (preferCache) {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return {
          products: processDocs(cached.docs),
          lastDoc: cached.docs[cached.docs.length - 1] || null,
          hasMore: cached.docs.length === pageSize,
          fromCache: true,
        };
      }
    } catch {
      /* cache miss */
    }
  }

  try {
    const snapshot = await getDocs(q);
    return {
      products: processDocs(snapshot.docs),
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

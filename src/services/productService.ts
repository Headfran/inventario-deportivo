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
  limit,
  orderBy,
  startAfter,
  where,
  runTransaction,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Product, ProductVariant, ShelfLocation } from '../types/inventory';
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

// ─── 0. PROYECCIÓN PÚBLICA DEL CATÁLOGO ───
// El catálogo se sirve sin sesión: nunca debe exponer costos de compra,
// márgenes internos ni ubicaciones físicas de bodega en localStorage/DevTools.
const PUBLIC_CATALOG_VERSION_KEY = 'jdstore.catalogVersion';
const PUBLIC_CATALOG_PRODUCTS_KEY = 'jdstore.cachedProducts';

export const toPublicProduct = (product: Product): Product => {
  const raw: any = product || {};

  const variants = (Array.isArray(raw.variants) ? raw.variants : []).map((variant: any) => {
    const publicVariant: any = {
      id: String(variant?.id || ''),
      color: String(variant?.color || ''),
      sizes: (Array.isArray(variant?.sizes) ? variant.sizes : []).map((size: any) => ({
        size: String(size?.size ?? ''),
        stock: Math.max(0, Number(size?.stock) || 0),
      })),
      exhibition: {
        isOnDisplay: !!variant?.exhibition?.isOnDisplay,
        ...(variant?.exhibition?.displaySize
          ? { displaySize: String(variant.exhibition.displaySize) }
          : {}),
      },
    };

    if (variant?.colorHex) publicVariant.colorHex = String(variant.colorHex);
    // `locations` se omite a propósito: no es información pública.
    return publicVariant;
  });

  const projected: any = {
    ...(raw.id ? { id: String(raw.id) } : {}),
    code: String(raw.code || ''),
    name: String(raw.name || ''),
    brand: String(raw.brand || ''),
    category: raw.category,
    price: Number(raw.price) || 0,
    images: (Array.isArray(raw.images) ? raw.images : [])
      .filter(Boolean)
      .map((url: any) => String(url)),
    variants,
    deleted: false,
  };

  // Solo precios comerciales de venta. `purchasePrice` y márgenes internos
  // nunca forman parte de la proyección.
  if (Number(raw.wholesalePrice) > 0) projected.wholesalePrice = Number(raw.wholesalePrice);
  if (Number(raw.bolivarPrice) > 0) projected.bolivarPrice = Number(raw.bolivarPrice);
  if (Number(raw.bolivarWholesalePrice) > 0) {
    projected.bolivarWholesalePrice = Number(raw.bolivarWholesalePrice);
  }
  // `createdAt` se conserva únicamente para ordenar el catálogo.
  if (raw.createdAt !== undefined && raw.createdAt !== null) {
    projected.createdAt = raw.createdAt;
  }

  return projected as Product;
};

export const toPublicProducts = (products: Product[]): Product[] =>
  (Array.isArray(products) ? products : []).map(toPublicProduct);

export const readPublicCatalogCache = (): Product[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PUBLIC_CATALOG_PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? toPublicProducts(parsed) : [];
  } catch {
    return [];
  }
};

export const writePublicCatalogCache = (products: Product[]): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      PUBLIC_CATALOG_PRODUCTS_KEY,
      JSON.stringify(toPublicProducts(products))
    );
  } catch {
    /* cuota/SSR: se ignora */
  }
};

export const readPublicCatalogVersion = (): number => {
  if (typeof localStorage === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(PUBLIC_CATALOG_VERSION_KEY) || 0) || 0;
  } catch {
    return 0;
  }
};

export const writePublicCatalogVersion = (version: number): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PUBLIC_CATALOG_VERSION_KEY, String(Number(version) || 0));
  } catch {
    /* noop */
  }
};

/** Descarga el catálogo ya proyectado a campos públicos. */
export const fetchPublicProducts = async (options?: {
  pageSize?: number;
  maxPages?: number;
  fromServer?: boolean;
}): Promise<Product[]> => toPublicProducts(await fetchAllProducts(options));

// ─── 1. FUNCIONES DE VERSIÓN DEL CATÁLOGO ───
export const bumpCatalogVersion = async () => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  // Usamos Date.now() para que coincida con el reloj del cliente y no haya desfases
  await setDoc(ref, { lastUpdate: Date.now() }, { merge: true });
};

export const getCatalogVersion = async (fromServer = false): Promise<number> => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  try {
    const snap = fromServer ? await getDocFromServer(ref) : await getDoc(ref);
    return snap.exists() ? Number(snap.data().lastUpdate) || 0 : 0;
  } catch {
    return 0;
  }
};

export const subscribeToCatalogVersion = (callback: (version: number) => void) => {
  const ref = doc(db, SETTINGS_COLLECTION, CATALOG_META_DOC);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? Number(snap.data().lastUpdate) || 0 : 0);
  });
};

// ─── 2. FUNCIÓN DELTA ───
export const fetchProductsDelta = async (lastSyncTime: number): Promise<{ updated: Product[], deletedIds: string[] }> => {
  const col = collection(db, PRODUCTS_COLLECTION);
  const q = query(col, where('updatedAt', '>', lastSyncTime));
  const snapshot = await getDocsFromServer(q);

  const updated: Product[] = [];
  const deletedIds: string[] = [];

  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.deleted === true) {
      deletedIds.push(d.id);
    } else {
      updated.push(normalizeProduct({ id: d.id, ...data } as Product));
    }
  });

  return { updated, deletedIds };
};

// ─── 3. NORMALIZADOR Y LISTENERS ───
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
      .filter((d) => !d.data().deleted)
      .map((d) => normalizeProduct({ id: d.id, ...d.data() } as Product));
    callback(products);
  });
};

// ─── 4. CRUD ───
export type ProductMutationPayload = Omit<Product, 'id' | 'deleted' | 'createdAt' | 'updatedAt'>;
export type ProductMetadataPatch = Partial<Omit<Product, 'id' | 'variants'>>;

const PRODUCT_METADATA_FIELDS = [
  'code',
  'name',
  'brand',
  'category',
  'price',
  'wholesalePrice',
  'bolivarPrice',
  'bolivarWholesalePrice',
  'purchasePrice',
  'images',
] as const;

const buildMetadataPatch = (product: Partial<Product>): Record<string, any> => {
  const patch: Record<string, any> = {};
  for (const field of PRODUCT_METADATA_FIELDS) {
    if (product[field] !== undefined) patch[field] = product[field];
  }
  return patch;
};

const normalizeColor = (value: any): string => String(value || '').toLowerCase().trim();
const normalizeSize = (value: any): string => String(value || '').trim();

const cloneVariants = (variants?: ProductVariant[]): ProductVariant[] =>
  (variants || []).map((variant) => ({
    ...variant,
    sizes: (variant.sizes || []).map((size) => ({ ...size })),
    locations: (variant.locations || []).map((location) => ({ ...location })),
    exhibition: { ...(variant.exhibition || { isOnDisplay: false }) },
  }));

const variantMatches = (
  variant: ProductVariant,
  ref: { variantId?: string; color?: string }
): boolean => {
  if (ref.variantId && variant.id === ref.variantId) return true;
  return !!ref.color && normalizeColor(variant.color) === normalizeColor(ref.color);
};

export interface VariantStockDelta {
  variantId?: string;
  color: string;
  size: string;
  delta: number;
}

export interface VariantSizeRemoval {
  variantId?: string;
  color: string;
  size: string;
}

export interface VariantRemoval {
  variantId?: string;
  color: string;
}

export interface UpdateProductVariantsOptions {
  stockDeltas?: VariantStockDelta[];
  removedSizes?: VariantSizeRemoval[];
  removedVariants?: VariantRemoval[];
}

export interface AdjustVariantStockOptions {
  createIfMissing?: boolean;
  colorHex?: string;
  variantId?: string;
}

export interface VariantLocationUpdate {
  variantId?: string;
  variantIndex?: number;
  color?: string;
  locations: ShelfLocation[];
}

export const createProduct = async (product: ProductMutationPayload): Promise<string> => {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...product,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deleted: false,
  });
  await bumpCatalogVersion();
  return docRef.id;
};

/**
 * Actualiza SOLO metadatos del producto. No acepta `variants` a propósito:
 * el stock se modifica con `adjustVariantStock` / `updateProductWithVariants`.
 */
export const updateProduct = async (
  id: string,
  product: ProductMetadataPatch
): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, id);
  const patch = buildMetadataPatch(product as Partial<Product>);
  if (product.deleted !== undefined) patch.deleted = product.deleted;
  if (Object.keys(patch).length === 0) return;

  await updateDoc(productRef, {
    ...patch,
    updatedAt: Date.now(),
  });
  await bumpCatalogVersion();
};

/**
 * Actualiza metadatos + estructura de variantes sin pisar stock concurrente.
 * El stock de una talla existente solo cambia si llega un delta explícito
 * (calculado contra el valor inicial del formulario). Las tallas/colores
 * eliminados se indican explícitamente para no borrar datos concurrentes.
 */
export const updateProductWithVariants = async (
  id: string,
  product: ProductMutationPayload,
  options: UpdateProductVariantsOptions = {}
): Promise<void> => {
  const productRef = doc(db, PRODUCTS_COLLECTION, id);
  const stockDeltas = options.stockDeltas || [];
  const removedSizes = options.removedSizes || [];
  const removedVariants = options.removedVariants || [];

  const findDelta = (variant: ProductVariant, sizeName: string): VariantStockDelta | undefined =>
    stockDeltas.find((delta) => {
      const sameVariant =
        (delta.variantId && variant.id === delta.variantId) ||
        normalizeColor(delta.color) === normalizeColor(variant.color);
      return sameVariant && normalizeSize(delta.size) === normalizeSize(sizeName);
    });

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const current = snap.data() as Product;
    let variants = cloneVariants(current.variants);

    // Eliminaciones explícitas del formulario.
    variants = variants.filter(
      (variant) => !removedVariants.some((removed) => variantMatches(variant, removed))
    );
    variants = variants.map((variant) => ({
      ...variant,
      sizes: variant.sizes.filter(
        (size) =>
          !removedSizes.some(
            (removed) =>
              variantMatches(variant, removed) &&
              normalizeSize(removed.size) === normalizeSize(size.size)
          )
      ),
    }));

    for (const formVariant of product.variants || []) {
      const existing = variants.find((variant) =>
        variantMatches(variant, {
          variantId: formVariant.id,
          color: formVariant.color,
        })
      );

      if (existing) {
        existing.color = formVariant.color;
        existing.colorHex = formVariant.colorHex;
        if (!existing.id && formVariant.id) existing.id = formVariant.id;

        for (const formSize of formVariant.sizes || []) {
          const existingSize = existing.sizes.find(
            (size) => normalizeSize(size.size) === normalizeSize(formSize.size)
          );
          const delta = findDelta(existing, formSize.size);

          if (existingSize) {
            // Sin delta = el usuario no tocó esta talla: se conserva el stock
            // que haya en el servidor (p. ej. una venta concurrente).
            // Con delta = el usuario escribió un valor explícito: se aplica
            // ese valor absoluto, no una suma sobre el stock del servidor.
            if (delta) {
              existingSize.stock = Math.max(0, Number(formSize.stock) || 0);
            }
          } else {
            existing.sizes.push({
              ...formSize,
              stock: Math.max(0, Number(formSize.stock) || 0),
            });
          }
        }
      } else {
        const newVariant: ProductVariant = {
          ...formVariant,
          sizes: (formVariant.sizes || []).map((formSize) => ({
            ...formSize,
            stock: Math.max(0, Number(formSize.stock) || 0),
          })),
          locations: (formVariant.locations || []).map((location) => ({ ...location })),
          exhibition: { ...(formVariant.exhibition || { isOnDisplay: false }) },
        };
        variants.push(newVariant);
      }
    }

    const patch = buildMetadataPatch(product as Partial<Product>);
    transaction.update(productRef, {
      ...patch,
      variants,
      updatedAt: Date.now(),
    });
  });

  await bumpCatalogVersion();
};

export const deleteProduct = async (product: Product): Promise<void> => {
  if (product.images && product.images.length > 0) {
    await Promise.allSettled(product.images.map((url) => deleteImageFromR2(url)));
  }
  if (product.id) {
    await updateDoc(doc(db, PRODUCTS_COLLECTION, product.id), {
      deleted: true,
      updatedAt: Date.now(),
    });
    await bumpCatalogVersion();
  }
};

/**
 * Fija un stock absoluto dentro de una transacción. Se usa para la entrada
 * directa del modal de ajuste; los botones ±1 usan `adjustVariantStock`.
 */
export const updateVariantStock = async (
  productId: string,
  colorName: string,
  targetSize: string,
  newStock: number
): Promise<number> => {
  if (!Number.isFinite(newStock)) {
    throw new Error('El stock debe ser un número válido.');
  }
  const sanitizedStock = Math.max(0, Math.trunc(newStock));
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const product = snap.data() as Product;
    const variants = cloneVariants(product.variants);
    const variant = variants.find((v) => normalizeColor(v.color) === normalizeColor(colorName));
    if (!variant) throw new Error(`El color "${colorName}" ya no existe.`);

    const size = variant.sizes.find((s) => normalizeSize(s.size) === normalizeSize(targetSize));
    if (!size) throw new Error(`La talla "${targetSize}" ya no existe en "${colorName}".`);

    size.stock = sanitizedStock;
    tx.update(productRef, { variants, updatedAt: Date.now() });
  });

  await bumpCatalogVersion();
  return sanitizedStock;
};

/**
 * Suma un delta al stock actual leído en Firestore. Nunca deja stock negativo.
 * Es la operación correcta para los botones +/- y para ajustes relativos.
 */
export const adjustVariantStock = async (
  productId: string,
  colorName: string,
  targetSize: string,
  delta: number,
  options: AdjustVariantStockOptions = {}
): Promise<number> => {
  if (!Number.isFinite(delta)) {
    throw new Error('El ajuste de stock debe ser un número válido.');
  }

  const productRef = doc(db, PRODUCTS_COLLECTION, productId);
  const nextStock = await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const product = snap.data() as Product;
    const variants = cloneVariants(product.variants);

    let variant = variants.find(
      (v) =>
        (options.variantId && v.id === options.variantId) ||
        normalizeColor(v.color) === normalizeColor(colorName)
    );

    if (!variant) {
      if (!options.createIfMissing) {
        throw new Error(`El color "${colorName}" ya no existe.`);
      }
      variant = {
        id: options.variantId || `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        color: colorName,
        colorHex: options.colorHex || '#cbd5e1',
        sizes: [],
        locations: [],
        exhibition: { isOnDisplay: false },
      };
      variants.push(variant);
    }

    let size = variant.sizes.find((s) => normalizeSize(s.size) === normalizeSize(targetSize));
    if (!size) {
      if (!options.createIfMissing) {
        throw new Error(`La talla "${targetSize}" ya no existe en "${colorName}".`);
      }
      size = { size: targetSize, stock: 0 };
      variant.sizes.push(size);
    }

    const current = Number(size.stock) || 0;
    const next = Math.max(0, current + delta);
    size.stock = next;

    tx.update(productRef, { variants, updatedAt: Date.now() });
    return next;
  });

  await bumpCatalogVersion();
  return nextStock;
};

/**
 * Actualiza solo las ubicaciones de variantes concretas. Lee el producto
 * dentro de la transacción para no pisar stock/exhibición concurrentes.
 */
export const updateProductLocations = async (
  productId: string,
  updates: VariantLocationUpdate[]
): Promise<void> => {
  if (!db || updates.length === 0) return;
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const product = snap.data() as Product;
    const variants = cloneVariants(product.variants);

    for (const update of updates) {
      const variant =
        variants.find((v) => update.variantId && v.id === update.variantId) ||
        variants.find((v) => update.color && normalizeColor(v.color) === normalizeColor(update.color)) ||
        (typeof update.variantIndex === 'number' ? variants[update.variantIndex] : undefined);

      if (!variant) {
        throw new Error('La variante del producto ya no existe.');
      }
      variant.locations = (update.locations || []).map((location) => ({ ...location }));
    }

    tx.update(productRef, { variants, updatedAt: Date.now() });
  });

  await bumpCatalogVersion();
};

/**
 * Actualiza solo la exhibición (vitrina) de una variante, preservando stock,
 * tallas y ubicaciones concurrentes.
 */
export const updateVariantExhibition = async (
  productId: string,
  variantIndex: number,
  variantId: string | undefined,
  exhibition: ProductVariant['exhibition']
): Promise<void> => {
  if (!db) return;
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('El producto no existe');

    const product = snap.data() as Product;
    const variants = cloneVariants(product.variants);
    const variant =
      variants.find((v) => variantId && v.id === variantId) || variants[variantIndex];

    if (!variant) throw new Error('La variante del producto ya no existe.');

    variant.exhibition = { ...(exhibition || { isOnDisplay: false }) };
    tx.update(productRef, { variants, updatedAt: Date.now() });
  });

  await bumpCatalogVersion();
};

// ─── 5. PAGINACIÓN ───
const buildPageQuery = (pageSize: number, lastDoc: QueryDocumentSnapshot<DocumentData> | null) => {
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
      .filter((d) => !d.data().deleted)
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
    } catch { }
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

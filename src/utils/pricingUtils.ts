import type { Product } from '../types/inventory';

/**
 * Reglas de precio compartidas por el POS y el catálogo público.
 *
 * - El umbral al mayor es SIEMPRE 6 piezas equivalentes en total.
 * - Las prendas de categoría "Conjuntos" cuentan como 2 piezas.
 * - Nunca se inventan precios: si un producto no tiene `wholesalePrice`
 *   configurado (> 0) se cobra a `price` (detal). Si no tiene `bolivarPrice`
 *   (> 0) el precio en Bs/€ de referencia es 0 ("No configurado").
 */

export const WHOLESALE_THRESHOLD = 6;
export const CONJUNTO_CATEGORY = 'conjuntos';

/** Normaliza cualquier importe monetario a 2 decimales. */
export const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  // El epsilon ayuda con casos clásicos como 1.005 -> 1.01.
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/** Alias explícito para dejar claro que el resultado está normalizado. */
export const normalizeMoney = roundMoney;

export const isConjunto = (product?: Pick<Product, 'category'> | null): boolean =>
  String(product?.category || '').trim().toLowerCase() === CONJUNTO_CATEGORY;

/** Piezas equivalentes que aporta una unidad de este producto. */
export const getPieceMultiplier = (product?: Pick<Product, 'category'> | null): number =>
  isConjunto(product) ? 2 : 1;

export interface PieceCountItem {
  product?: Product | null;
  quantity: number;
}

/** Total de piezas equivalentes de un carrito (Conjuntos = 2). */
export const countWholesalePieces = (items: PieceCountItem[]): number =>
  items.reduce((total, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    return total + quantity * getPieceMultiplier(item.product);
  }, 0);

/** True cuando el carrito alcanza el umbral de 6 piezas equivalentes. */
export const isWholesaleQuantity = (pieces: number): boolean =>
  Number(pieces) >= WHOLESALE_THRESHOLD;

export interface ProductUnitPrices {
  /** Precio detal configurado en USD. */
  retailUSD: number;
  /** Precio mayor configurado en USD (0 si no existe). */
  wholesaleUSD: number;
  /** Precio detal configurado en Bs/€ de referencia. */
  retailBS: number;
  /** Precio mayor configurado en Bs/€ de referencia (0 si no existe). */
  wholesaleBS: number;
  /** Precio unitario USD a cobrar según la regla al mayor. */
  unitPriceUSD: number;
  /** Precio unitario Bs/€ de referencia a cobrar según la regla al mayor. */
  unitPriceBS: number;
  hasWholesalePrice: boolean;
  hasBolivarPrice: boolean;
  hasBolivarWholesalePrice: boolean;
  /** True solo si realmente se aplicó un precio mayor configurado. */
  isWholesaleApplied: boolean;
}

/**
 * Resuelve los precios unitarios de un producto para detal o mayor.
 * No usa multiplicadores ni conversiones inventadas.
 */
export const resolveProductPrices = (
  product: Product | null | undefined,
  isWholesale: boolean,
  fallbackUSD = 0
): ProductUnitPrices => {
  const retailUSD = roundMoney(Number(product?.price) || Number(fallbackUSD) || 0);
  const wholesaleUSD = roundMoney(Number(product?.wholesalePrice) || 0);
  const retailBS = roundMoney(Number(product?.bolivarPrice) || 0);
  const wholesaleBS = roundMoney(Number(product?.bolivarWholesalePrice) || 0);

  const hasWholesalePrice = wholesaleUSD > 0;
  const hasBolivarWholesalePrice = wholesaleBS > 0;
  const hasBolivarPrice = retailBS > 0;

  // Cada moneda usa su precio mayor solo si está configurado. Si no,
  // cae al detal (nunca a un valor calculado con un multiplicador).
  const appliedUSD = isWholesale && hasWholesalePrice;
  const appliedBS = isWholesale && hasBolivarWholesalePrice;

  return {
    retailUSD,
    wholesaleUSD,
    retailBS,
    wholesaleBS,
    unitPriceUSD: appliedUSD ? wholesaleUSD : retailUSD,
    unitPriceBS: appliedBS ? wholesaleBS : retailBS,
    hasWholesalePrice,
    hasBolivarPrice,
    hasBolivarWholesalePrice,
    isWholesaleApplied: appliedUSD || appliedBS,
  };
};

/** Precio "mayor" que se debe mostrar: el configurado o el detal si no existe. */
export const getDisplayWholesaleUSD = (product: Product | null | undefined): number =>
  resolveProductPrices(product, true).unitPriceUSD;

/** Precio "mayor" en Bs/€ de referencia (0 = no configurado). */
export const getDisplayWholesaleBS = (product: Product | null | undefined): number =>
  resolveProductPrices(product, true).unitPriceBS;

/** Precio detal en Bs/€ de referencia (0 = no configurado). */
export const getDisplayRetailBS = (product: Product | null | undefined): number =>
  resolveProductPrices(product, false).unitPriceBS;

/** Suma líneas de carrito con la regla unificada. */
export const calculateCartTotalUSD = (
  lines: Array<{ product: Product | null | undefined; quantity: number }>,
  isWholesale: boolean
): number =>
  roundMoney(
    lines.reduce((total, line) => {
      const prices = resolveProductPrices(line.product, isWholesale);
      return total + prices.unitPriceUSD * Math.max(0, Number(line.quantity) || 0);
    }, 0)
  );

/** Suma líneas de carrito en Bs/€ de referencia. */
export const calculateCartTotalBS = (
  lines: Array<{ product: Product | null | undefined; quantity: number }>,
  isWholesale: boolean
): number =>
  roundMoney(
    lines.reduce((total, line) => {
      const prices = resolveProductPrices(line.product, isWholesale);
      return total + prices.unitPriceBS * Math.max(0, Number(line.quantity) || 0);
    }, 0)
  );

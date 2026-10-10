import { Product } from '../types/inventory';

export interface FilterOptions {
  query: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  status: 'all' | 'vitrina' | 'bodega' | 'unassigned' | 'low_stock';
}

export const filterProducts = (products: Product[], filters: FilterOptions): Product[] => {
  const q = filters.query.trim().toLowerCase();

  return products.filter((product) => {
    // 1. Filtro por Categoría Principal
    if (filters.category && filters.category !== 'all') {
      const prodCat = (product.category || '').toLowerCase();
      if (prodCat !== filters.category.toLowerCase()) {
        return false;
      }
    }

    // 2. Búsqueda por Texto (Nombre, SKU, Marca, Categoría, Color o Talla)
    if (q) {
      const matchName = product.name?.toLowerCase().includes(q);
      const matchBrand = product.brand?.toLowerCase().includes(q);
      const matchCategory = product.category?.toLowerCase().includes(q);
      const matchCode = product.code?.toLowerCase().includes(q);
      const matchVariants = (product.variants || []).some(
        (v) =>
          v.color?.toLowerCase().includes(q) ||
          (v.sizes || []).some((s) => s.size?.toLowerCase().includes(q))
      );

      if (!matchName && !matchBrand && !matchCategory && !matchCode && !matchVariants) {
        return false;
      }
    }

    // 3. Marca
    if (filters.brand && product.brand !== filters.brand) {
      return false;
    }

    // 4. Color
    if (filters.color) {
      const hasColor = (product.variants || []).some(
        (v) => v.color.toLowerCase() === filters.color.toLowerCase()
      );
      if (!hasColor) return false;
    }

    // 5. Talla
    if (filters.size) {
      const hasSize = (product.variants || []).some((v) =>
        (v.sizes || []).some((s) => s.size === filters.size)
      );
      if (!hasSize) return false;
    }

    // 6. Estado de Ubicación y Stock
    if (filters.status === 'vitrina') {
      const inVitrina = (product.variants || []).some((v) => v.exhibition?.isOnDisplay);
      if (!inVitrina) return false;
    } else if (filters.status === 'bodega') {
      const inBodega = (product.variants || []).some((v) => (v.locations || []).length > 0);
      if (!inBodega) return false;
    } else if (filters.status === 'unassigned') {
      const unassigned = (product.variants || []).some(
        (v) => !v.exhibition?.isOnDisplay && (!v.locations || v.locations.length === 0)
      );
      if (!unassigned) return false;
    } else if (filters.status === 'low_stock') {
      const isLowStock = (product.variants || []).some((v) =>
        (v.sizes || []).some((s) => s.stock > 0 && s.stock <= 2)
      );
      if (!isLowStock) return false;
    }

    return true;
  });
};

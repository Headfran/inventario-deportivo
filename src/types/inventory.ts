export type ProductCategory =
  | 'Zapatos'
  | 'Camisas'
  | 'Franelillas'
  | 'Shorts'
  | 'Monos'
  | 'Conjuntos'
  | 'Accesorios'
  | 'Otros';

export interface ExhibitionDetail {
  isOnDisplay: boolean;
  displaySize?: string;
}

// Estructura Talla + Stock
export interface SizeStock {
  size: string;
  stock: number;
}

// Variante agrupada por Color
export interface ProductVariant {
  id: string;
  color: string;
  colorHex?: string;
  sizes: SizeStock[];                // Lista de tallas asignadas a este color
  locations: ShelfLocation[];
  exhibition: ExhibitionDetail;
}

export interface Product {
  id?: string;
  code: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  images: string[];
  variants: ProductVariant[];
  createdAt?: number;
  updatedAt?: number;
}

// Ubicación en bodega
export interface ShelfLocation {
  shelfId: string;    // Nombre o ID del estante
  rowIndex: number;   // Fila / Nivel (1, 2, 3...)
  rumaIndex: number;  // Espacio / Ruma dentro de esa fila (1..spacesPerRow)
}

// Estante configurable
export interface Shelf {
  id?: string;
  name: string;
  description?: string;
  rowsCount: number;     // Número de filas / repisas (ej. 1, 2, 3, 4...)
  spacesPerRow: number;  // Espacios por fila (ej. 3 para estándar, 5 o 6 para estantes grandes)
}


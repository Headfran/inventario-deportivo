export type ProductCategory =
  | 'Zapatos'
  | 'Camisas'
  | 'Franelillas'
  | 'Shorts'
  | 'Monos'
  | 'Conjuntos'
  | 'Accesorios'
  | 'Otros';

export interface ShelfLocation {
  shelfId: string;
  rumaIndex: 1 | 2 | 3;
}

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

export interface Shelf {
  id?: string;
  name: string;
  description?: string;
  maxSpaces: 3;
}

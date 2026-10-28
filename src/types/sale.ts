export type PaymentMethod =
  | 'efectivo'
  | 'pago_movil'
  | 'binance'
  | 'transferencia'
  | 'zelle'
  | 'mixto';

export interface Seller {
  id: string;
  name: string;
  createdAt?: any;
}
export interface SaleItem {
  productId: string;
  brand: string;
  name: string;
  productCode?: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productImage?: string;
}

export interface Sale {
  id?: string;
  receiptNumber?: string;
  createdAt?: any;
  sellerId?: string;
  sellerName?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status?: 'completed' | 'cancelled' | 'voided';
  notes?: string;
}

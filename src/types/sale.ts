export type PaymentMethod =
  | 'efectivo'
  | 'pago_movil'
  | 'punto'
  | 'transferencia'
  | 'zelle'
  | 'tarjeta'
  | 'mixto';

export interface SaleItem {
  productId: string;
  brand: string;
  name: string;
  code?: string;
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

export type PaymentMethod = 'efectivo' | 'pago_movil' | 'zelle' | 'tarjeta' | 'otro';

export interface SaleItem {
  productId: string;
  productBrand: string;
  productName: string;
  productCode: string;
  variantColor: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productImage?: string;
}

export interface Sale {
  id?: string;
  createdAt?: any;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  sellerName?: string;
}

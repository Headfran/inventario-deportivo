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

export interface PaymentSplit {
  id: string;
  method: PaymentMethod;
  currency: 'USD' | 'BS';
  amount: number;         // USD si currency=USD, Bs actuales si currency=BS
  reference?: string;     // Nº de referencia para transferencias Bs
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
  unitPriceBSRef?: number;
  totalPrice: number;
  totalBSRef?: number;
  productImage?: string;
}

export interface SaleCombo {
  comboId: string;
  comboName: string;
  comboPrice: number;
  savedAmount: number;
  itemKeys: string[];
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
  totalBS?: number;
  totalBSRef?: number;
  eurToBsRate?: number;
  usdToBsRate?: number;
  isWholesale?: boolean;
  paymentMethod: PaymentMethod;
  status?: 'completed' | 'cancelled' | 'voided';
  paymentSplits?: PaymentSplit[];
  appliedCombos?: SaleCombo[];
  appliedCombo?: SaleCombo;
  notes?: string;
}

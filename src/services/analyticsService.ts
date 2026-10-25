import { Sale, SaleItem } from '../services/salesHistoryService';

export type TimeRangeOption = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

export interface TopProductStat {
  productId: string;
  brand: string;
  name: string;
  code: string;
  variantColor: string;
  size: string;
  unitsSold: number;
  totalRevenue: number;
  image?: string;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalUnitsSold: number;
  totalTransactions: number;
  averageTicket: number;
  paymentBreakdown: PaymentMethodBreakdown[];
  topProducts: TopProductStat[];
}

/**
 * Función segura para parsear fechas de Firestore a JavaScript Date
 */
const parseDateSafely = (val: any): Date => {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

/**
 * Filtra las ventas según el rango de tiempo seleccionado, excluyendo las anuladas
 */
export const filterSalesByTimeRange = (
  sales: Sale[],
  range: TimeRangeOption,
  customRange?: { start: Date; end: Date } | null
): Sale[] => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return sales.filter((sale) => {
    // REGLA DE ORO: Las ventas anuladas no cuentan para las estadísticas
    if (sale.status === 'voided') return false;

    if (range === 'all') return true;

    const saleTime = parseDateSafely(sale.createdAt).getTime();

    if (range === 'today') {
      return saleTime >= startOfDay;
    } else if (range === '7days') {
      const sevenDaysAgo = startOfDay - 6 * 24 * 60 * 60 * 1000;
      return saleTime >= sevenDaysAgo;
    } else if (range === '30days') {
      const thirtyDaysAgo = startOfDay - 29 * 24 * 60 * 60 * 1000;
      return saleTime >= thirtyDaysAgo;
    } else if (range === 'custom' && customRange) {
      return saleTime >= customRange.start.getTime() && saleTime <= customRange.end.getTime();
    }

    return true;
  });
};

/**
 * Calcula todas las analíticas a partir del listado de ventas filtrado
 */
export const calculateAnalytics = (sales: Sale[]): AnalyticsData => {
  let totalRevenue = 0;
  let totalUnitsSold = 0;
  const totalTransactions = sales.length;

  const paymentMap: Record<string, { totalAmount: number; count: number }> = {};
  const productMap: Record<string, TopProductStat> = {};

  sales.forEach((sale) => {
    // Compatibilidad: lee tanto 'total' (nuevo) como 'totalAmount' (viejo)
    const saleTotal = Number(sale.total || (sale as any).totalAmount) || 0;
    totalRevenue += saleTotal;

    // Desglose por Método de Pago
    const method = sale.paymentMethod || 'otro';
    if (!paymentMap[method]) {
      paymentMap[method] = { totalAmount: 0, count: 0 };
    }
    paymentMap[method].totalAmount += saleTotal;
    paymentMap[method].count += 1;

    // Procesar prendas vendidas
    (sale.items || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      totalUnitsSold += qty;

      // Adaptabilidad de datos: Soporta la estructura vieja y la nueva simultáneamente
      const brand = item.brand || item.productBrand || 'Genérico';
      const name = item.name || item.productName || 'Artículo Desconocido';
      const code = item.productCode || item.code || 'S/N';
      const color = item.color || item.variantColor || 'N/A';
      const size = item.size || 'N/A';
      const image = item.productImage || item.image || '';
      const itemTotal = Number(item.totalPrice || item.subtotal) || 0;

      const productKey = `${item.productId}_${color}_${size}`;

      if (!productMap[productKey]) {
        productMap[productKey] = {
          productId: item.productId,
          brand,
          name,
          code,
          variantColor: color, // Mantenemos el nombre para no romper tu interfaz
          size,
          unitsSold: 0,
          totalRevenue: 0,
          image,
        };
      }

      productMap[productKey].unitsSold += qty;
      productMap[productKey].totalRevenue += itemTotal;
    });
  });

  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Formatear desglose de métodos de pago con porcentaje
  const labels: Record<string, string> = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    zelle: 'Zelle',
    binance: 'Binance',
    punto: 'Punto de Venta',
    transferencia: 'Transferencia',
    mixto: 'Mixto',
    tarjeta: 'Tarjeta / Punto',
    otro: 'Otro',
  };

  const paymentBreakdown: PaymentMethodBreakdown[] = Object.entries(paymentMap)
    .map(([method, data]) => ({
      method,
      label: labels[method] || method.toUpperCase(),
      totalAmount: data.totalAmount,
      count: data.count,
      percentage: totalRevenue > 0 ? (data.totalAmount / totalRevenue) * 100 : 0,
    }))
    .filter((m) => m.count > 0 || totalTransactions === 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Ordenar productos más vendidos
  const topProducts = Object.values(productMap).sort((a, b) => b.unitsSold - a.unitsSold);

  return {
    totalRevenue,
    totalUnitsSold,
    totalTransactions,
    averageTicket,
    paymentBreakdown,
    topProducts,
  };
};

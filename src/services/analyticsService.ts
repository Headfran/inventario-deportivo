import { Sale } from '../types/sale';

export type TimeRangeOption = 'today' | '7days' | '30days' | 'all';

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
 * Filtra las ventas según el rango de tiempo seleccionado
 */
export const filterSalesByTimeRange = (
  sales: Sale[],
  range: TimeRangeOption
): Sale[] => {
  if (range === 'all') return sales;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return sales.filter((sale) => {
    const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
    const saleTime = saleDate.getTime();

    if (range === 'today') {
      return saleTime >= startOfDay;
    } else if (range === '7days') {
      const sevenDaysAgo = startOfDay - 6 * 24 * 60 * 60 * 1000;
      return saleTime >= sevenDaysAgo;
    } else if (range === '30days') {
      const thirtyDaysAgo = startOfDay - 29 * 24 * 60 * 60 * 1000;
      return saleTime >= thirtyDaysAgo;
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

  const paymentMap: Record<string, { totalAmount: number; count: number }> = {
    pago_movil: { totalAmount: 0, count: 0 },
    efectivo: { totalAmount: 0, count: 0 },
    zelle: { totalAmount: 0, count: 0 },
    tarjeta: { totalAmount: 0, count: 0 },
    otro: { totalAmount: 0, count: 0 },
  };

  const productMap: Record<string, TopProductStat> = {};

  sales.forEach((sale) => {
    totalRevenue += sale.totalAmount || 0;

    // Desglose por Método de Pago
    const method = sale.paymentMethod || 'otro';
    if (!paymentMap[method]) {
      paymentMap[method] = { totalAmount: 0, count: 0 };
    }
    paymentMap[method].totalAmount += sale.totalAmount || 0;
    paymentMap[method].count += 1;

    // Procesar prendas vendidas
    (sale.items || []).forEach((item) => {
      totalUnitsSold += item.quantity || 0;

      const productKey = `${item.productId}_${item.variantColor}_${item.size}`;
      if (!productMap[productKey]) {
        productMap[productKey] = {
          productId: item.productId,
          brand: item.productBrand,
          name: item.productName,
          code: item.productCode,
          variantColor: item.variantColor,
          size: item.size,
          unitsSold: 0,
          totalRevenue: 0,
          image: item.productImage,
        };
      }

      productMap[productKey].unitsSold += item.quantity || 0;
      productMap[productKey].totalRevenue += item.subtotal || 0;
    });
  });

  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Formatear desglose de métodos de pago con porcentaje
  const labels: Record<string, string> = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    zelle: 'Zelle',
    tarjeta: 'Tarjeta / Punto',
    otro: 'Otro',
  };

  const paymentBreakdown: PaymentMethodBreakdown[] = Object.entries(paymentMap)
    .map(([method, data]) => ({
      method,
      label: labels[method] || method,
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

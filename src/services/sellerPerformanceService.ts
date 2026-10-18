import { Sale } from './salesHistoryService';
import { Layaway } from './layawayService';

export interface SellerMetrics {
  sellerId: string;
  sellerName: string;
  totalSalesCount: number;
  totalSalesAmount: number;
  totalLayawaysCount: number;
  totalLayawaysAmount: number;
  totalVolume: number;
  averageTicket: number;
  completedSales: Sale[];
  activeLayaways: Layaway[];
}

export type TimePeriod = 'today' | 'week' | 'month' | 'all';

/**
 * Filtra registros según el periodo seleccionado (Hoy, Esta Semana, Este Mes, Todo)
 */
export const filterByPeriod = <T extends { createdAt: Date }>(
  items: T[],
  period: TimePeriod
): T[] => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    return items.filter((i) => new Date(i.createdAt) >= startOfDay);
  }

  if (period === 'week') {
    const startOfWeek = new Date(startOfDay);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    return items.filter((i) => new Date(i.createdAt) >= startOfWeek);
  }

  if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return items.filter((i) => new Date(i.createdAt) >= startOfMonth);
  }

  return items;
};

/**
 * Procesa ventas y apartados para calcular el ranking y rendimiento por vendedor
 */
export const computeSellerPerformance = (
  salesList: Sale[],
  layawaysList: Layaway[],
  period: TimePeriod
): SellerMetrics[] => {
  const filteredSales = filterByPeriod(salesList, period).filter(
    (s) => s.status === 'completed'
  );
  const filteredLayaways = filterByPeriod(layawaysList, period).filter(
    (l) => l.status !== 'cancelled'
  );

  const sellersMap = new Map<string, SellerMetrics>();

  const getOrCreateSeller = (id: string, name: string): SellerMetrics => {
    const key = id || name.toLowerCase().trim() || 'vendedor_general';
    const cleanName = name || 'Vendedor General';

    if (!sellersMap.has(key)) {
      sellersMap.set(key, {
        sellerId: key,
        sellerName: cleanName,
        totalSalesCount: 0,
        totalSalesAmount: 0,
        totalLayawaysCount: 0,
        totalLayawaysAmount: 0,
        totalVolume: 0,
        averageTicket: 0,
        completedSales: [],
        activeLayaways: [],
      });
    }
    return sellersMap.get(key)!;
  };

  // 1. Agrupar Ventas Directas
  filteredSales.forEach((sale) => {
    const seller = getOrCreateSeller(
      sale.sellerId || '',
      sale.sellerName || 'Vendedor General'
    );
    const amount = Number(sale.total) || 0;

    seller.totalSalesCount += 1;
    seller.totalSalesAmount += amount;
    seller.completedSales.push(sale);
  });

  // 2. Agrupar Apartados / Pedidos en Standby
  filteredLayaways.forEach((layaway) => {
    const seller = getOrCreateSeller(
      layaway.sellerId || '',
      layaway.sellerName || 'Vendedor General'
    );
    const amount = Number(layaway.totalAmount) || 0;

    seller.totalLayawaysCount += 1;
    seller.totalLayawaysAmount += amount;
    seller.activeLayaways.push(layaway);
  });

  // 3. Calcular Totales y Ticket Promedio
  const result: SellerMetrics[] = Array.from(sellersMap.values()).map((seller) => {
    const totalVolume = seller.totalSalesAmount + seller.totalLayawaysAmount;
    const totalTransactions = seller.totalSalesCount + seller.totalLayawaysCount;
    const averageTicket = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    return {
      ...seller,
      totalVolume,
      averageTicket,
    };
  });

  return result.sort((a, b) => b.totalVolume - a.totalVolume);
};

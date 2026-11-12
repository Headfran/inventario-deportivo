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

export type TimePeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'lastWeek'
  | 'month'
  | 'lastMonth'
  | 'all'
  | 'custom';

const parseDateSafely = (val: any): Date => {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

/**
 * Filtra registros según el periodo seleccionado.
 *
 * - today:      [00:00 hoy, ∞)
 * - yesterday:  [00:00 ayer, 00:00 hoy)
 * - week:       [lunes actual, lunes próximo)
 * - lastWeek:   [lunes semana pasada, lunes actual)
 * - month:      [día 1 mes actual, ∞)
 * - lastMonth:  [día 1 mes pasado, día 1 mes actual)
 * - all:        sin filtro
 * - custom:     [start, end] del rango elegido
 */
export const filterByPeriod = <T extends { createdAt: any }>(
  items: T[],
  period: TimePeriod,
  customRange?: { start: Date; end: Date } | null
): T[] => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Lunes de la semana actual (ISO: lunes = inicio, domingo = fin)
  const startOfThisWeek = new Date(startOfToday);
  const dayOfWeek = startOfThisWeek.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfThisWeek.setDate(startOfThisWeek.getDate() + diffToMonday);

  const startOfNextWeek = new Date(startOfThisWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (period === 'today') {
    return items.filter((i) => parseDateSafely(i.createdAt) >= startOfToday);
  }

  if (period === 'yesterday') {
    return items.filter((i) => {
      const d = parseDateSafely(i.createdAt);
      return d >= startOfYesterday && d < startOfToday;
    });
  }

  if (period === 'week') {
    return items.filter((i) => {
      const d = parseDateSafely(i.createdAt);
      return d >= startOfThisWeek && d < startOfNextWeek;
    });
  }

  if (period === 'lastWeek') {
    return items.filter((i) => {
      const d = parseDateSafely(i.createdAt);
      return d >= startOfLastWeek && d < startOfThisWeek;
    });
  }

  if (period === 'month') {
    return items.filter((i) => parseDateSafely(i.createdAt) >= startOfThisMonth);
  }

  if (period === 'lastMonth') {
    return items.filter((i) => {
      const d = parseDateSafely(i.createdAt);
      return d >= startOfLastMonth && d < startOfThisMonth;
    });
  }

  if (period === 'custom' && customRange) {
    return items.filter((i) => {
      const d = parseDateSafely(i.createdAt);
      return d >= customRange.start && d <= customRange.end;
    });
  }

  return items;
};

/**
 * Procesa ventas y apartados para calcular el ranking y rendimiento por vendedor
 */
export const computeSellerPerformance = (
  salesList: Sale[],
  layawaysList: Layaway[],
  period: TimePeriod,
  customRange?: { start: Date; end: Date } | null
): SellerMetrics[] => {
  const filteredSales = filterByPeriod(salesList, period, customRange).filter(
    (s) => s.status === 'completed'
  );
  const filteredLayaways = filterByPeriod(layawaysList, period, customRange).filter(
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

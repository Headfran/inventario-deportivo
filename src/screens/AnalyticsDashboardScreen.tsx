import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, Award, PieChart, CalendarRange, Shirt, Coins } from 'lucide-react-native';
import { Sale, subscribeToSales, calculateSaleProfit } from '../services/salesHistoryService';
import { Product } from '../types/inventory';
import { calculateAnalytics } from '../services/analyticsService';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { Cover } from '../components/Cover';
import { MONO as T, display } from '../design';

const MAX = 1180;

// ==========================================
// Filtrado de fechas (local, sin dependencia del servicio)
// ==========================================
type TimeRangeOption =
   | 'today'
   | 'yesterday'
   | 'week'
   | 'lastWeek'
   | 'month'
   | 'lastMonth'
   | 'all'
   | 'custom';

const getSaleDate = (createdAt: any): Date => {
   if (!createdAt) return new Date(0);
   if (typeof createdAt.toDate === 'function') return createdAt.toDate();
   if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
   return new Date(createdAt);
};

const filterSalesByTimeRange = (
   sales: Sale[],
   range: TimeRangeOption,
   customRange: { start: Date; end: Date } | null
): Sale[] => {
   const today = new Date();
   const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

   const startOfYesterday = new Date(startOfToday);
   startOfYesterday.setDate(startOfYesterday.getDate() - 1);

   // Lunes de la semana actual (ISO: lunes = inicio)
   const startOfThisWeek = new Date(startOfToday);
   const dayOfWeek = startOfThisWeek.getDay();
   const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
   startOfThisWeek.setDate(startOfThisWeek.getDate() + diffToMonday);

   const startOfNextWeek = new Date(startOfThisWeek);
   startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

   const startOfLastWeek = new Date(startOfThisWeek);
   startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

   const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
   const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

   return sales.filter((sale) => {
      const d = getSaleDate(sale.createdAt);
      if (range === 'all') return true;
      if (range === 'today') return d >= startOfToday;
      if (range === 'yesterday') return d >= startOfYesterday && d < startOfToday;
      if (range === 'week') return d >= startOfThisWeek && d < startOfNextWeek;
      if (range === 'lastWeek') return d >= startOfLastWeek && d < startOfThisWeek;
      if (range === 'month') return d >= startOfThisMonth;
      if (range === 'lastMonth') return d >= startOfLastMonth && d < startOfThisMonth;
      if (range === 'custom' && customRange) {
         return d >= customRange.start && d <= customRange.end;
      }
      return true;
   });
};

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/--';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
};

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

interface AnalyticsDashboardScreenProps {
   catalog: Product[];
}

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({ catalog }) => {
   const [allSales, setAllSales] = useState<Sale[]>([]);
   const [timeRange, setTimeRange] = useState<TimeRangeOption>('month');
   const [loading, setLoading] = useState(true);

   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

   const { width } = useWindowDimensions();
   const mobile = width < 600;
   const wide = width >= 1000;

   useEffect(() => {
      const unsubSales = subscribeToSales(
         (sales) => {
            setAllSales(sales);
            setLoading(false);
         },
         { limit: 1000 }
      );
      return () => {
         unsubSales();
      };
   }, []);

   const filteredSales = filterSalesByTimeRange(allSales, timeRange, customDateRange);
   const analytics = calculateAnalytics(filteredSales);

   // ==========================================
   // GANANCIAS
   // ==========================================
   const profitData = useMemo(() => {
      let totalProfit = 0;
      let determined = true;

      filteredSales.forEach((sale) => {
         if (sale.status === 'voided') return;
         const r = calculateSaleProfit(sale);
         totalProfit += r.profit;
         if (!r.determined) determined = false;
      });

      const margin = analytics.totalRevenue > 0
         ? (totalProfit / analytics.totalRevenue) * 100
         : 0;

      return { totalProfit, determined, margin };
   }, [filteredSales, analytics.totalRevenue]);

   // Ganancia por producto (agregada por productId, no por variante)
   const profitByProductId = useMemo(() => {
      const map = new Map<string, { profit: number; determined: boolean }>();

      filteredSales.forEach((sale) => {
         if (sale.status === 'voided') return;
         sale.items.forEach((item) => {
            const existing = map.get(item.productId) || { profit: 0, determined: true };
            if (item.purchasePrice === undefined) {
               existing.determined = false;
            } else {
               existing.profit += (item.unitPrice - item.purchasePrice) * item.quantity;
            }
            map.set(item.productId, existing);
         });
      });

      return map;
   }, [filteredSales]);

   if (loading) {
      return (
         <View style={styles.centered}>
            <ActivityIndicator size="large" color={T.ink} />
            <Text style={styles.loadingText}>Recopilando datos financieros...</Text>
         </View>
      );
   }

   const kpis = [
      { Icon: DollarSign, tag: 'Ingresos', value: `$${analytics.totalRevenue.toFixed(2)}`, sub: 'Total recaudado en el período', color: '#6366F1', lightBg: '#EEF2FF' },
      { Icon: ShoppingBag, tag: 'Prendas', value: String(analytics.totalUnitsSold), sub: 'Unidades descontadas', color: '#0EA5E9', lightBg: '#F0F9FF' },
      { Icon: TrendingUp, tag: 'Ventas', value: String(analytics.totalTransactions), sub: 'Transacciones cerradas', color: '#10B981', lightBg: '#ECFDF5' },
      { Icon: CreditCard, tag: 'Ticket Promedio', value: `$${analytics.averageTicket.toFixed(2)}`, sub: 'Promedio por transacción', color: '#F59E0B', lightBg: '#FFFBEB' },
      { Icon: Coins, tag: 'Ganancia', value: `$${profitData.totalProfit.toFixed(2)}`, sub: `Margen ${profitData.margin.toFixed(1)}%`, color: '#047857', lightBg: '#F0F9FF', isProfit: true },
   ];

   return (
      <View style={styles.container}>
         <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingHorizontal: mobile ? 14 : 22 }]}
            showsVerticalScrollIndicator={true}
         >
            {/* HEADER */}
            <View style={styles.headerRow}>
               <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={[styles.pageTitle, mobile && styles.pageTitleMobile]}>Analítica</Text>
                  <Text style={styles.pageSubtitle}>Rendimiento de ventas e inventario</Text>
               </View>

               <View style={styles.timeRangeWrap}>
                  <ScrollView
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     contentContainerStyle={{ gap: 4 }}
                  >
                     <View style={styles.timeRangeContainer}>
                        <P
                           style={[styles.rangeChip, timeRange === 'today' && styles.rangeOn]}
                           onPress={() => setTimeRange('today')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'today' && styles.rangeOnText]}>
                              Hoy
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'yesterday' && styles.rangeOn]}
                           onPress={() => setTimeRange('yesterday')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'yesterday' && styles.rangeOnText]}>
                              Ayer
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'week' && styles.rangeOn]}
                           onPress={() => setTimeRange('week')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'week' && styles.rangeOnText]}>
                              Semana
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'lastWeek' && styles.rangeOn]}
                           onPress={() => setTimeRange('lastWeek')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'lastWeek' && styles.rangeOnText]}>
                              Sem. Pasada
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'month' && styles.rangeOn]}
                           onPress={() => setTimeRange('month')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'month' && styles.rangeOnText]}>
                              Mes
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'lastMonth' && styles.rangeOn]}
                           onPress={() => setTimeRange('lastMonth')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'lastMonth' && styles.rangeOnText]}>
                              Mes Pasado
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, timeRange === 'all' && styles.rangeOn]}
                           onPress={() => setTimeRange('all')}
                        >
                           <Text style={[styles.rangeChipText, timeRange === 'all' && styles.rangeOnText]}>
                              Todo
                           </Text>
                        </P>
                        <P
                           style={[styles.rangeChip, styles.rangeChipCustom, timeRange === 'custom' && styles.rangeOn]}
                           onPress={() => setShowDateRangeModal(true)}
                        >
                           <CalendarRange size={13} color={timeRange === 'custom' ? T.onSolid : T.inkSoft} />
                           <Text style={[styles.rangeChipText, timeRange === 'custom' && styles.rangeOnText]}>
                              {timeRange === 'custom' && customDateRange ? formatDateShort(customDateRange.start) : 'Rango'}
                           </Text>
                        </P>
                     </View>
                  </ScrollView>
               </View>
            </View>

            {/* KPIs */}
            <View style={styles.kpiGrid}>
               {kpis.map(({ Icon, tag, value, sub, color, lightBg, isProfit }, i) => {
                  const hero = i === 0;
                  return (
                     <View
                        key={tag}
                        style={[
                           styles.kpiCard,
                           { flexBasis: mobile ? '47%' : '18%' },
                           hero
                              ? styles.kpiHero
                              : { backgroundColor: lightBg, borderColor: color + '30', borderWidth: 1 },
                           hero && !mobile && { flexGrow: 1.4 },
                        ]}
                     >
                        <View style={styles.kpiHeader}>
                           <View style={[styles.kpiIconBox, hero ? styles.kpiIconHero : { backgroundColor: color + '20' }]}>
                              <Icon size={18} color={hero ? T.onSolid : color} />
                           </View>
                           <Text style={[styles.kpiTag, hero ? { color: 'rgba(255,255,255,0.8)' } : { color: '#4B5563' }]}>
                              {tag}
                           </Text>
                        </View>
                        <Text
                           style={[
                              styles.kpiValue,
                              hero
                                 ? { color: T.onSolid, fontSize: mobile ? 44 : 56, lineHeight: mobile ? 42 : 52 }
                                 : isProfit
                                    ? { color: '#047857', fontSize: mobile ? 28 : 32, lineHeight: mobile ? 26 : 30 }
                                    : { color: '#1F2937' },
                           ]}
                        >
                           {value}
                           {isProfit && !profitData.determined && <Text style={{ fontSize: 14 }}>*</Text>}
                        </Text>
                        <Text style={[styles.kpiSubtext, hero ? { color: 'rgba(255,255,255,0.7)' } : isProfit ? { color: '#059669', fontWeight: '700' } : { color: '#6B7280' }]}>
                           {sub}
                        </Text>
                     </View>
                  );
               })}
            </View>

            {!profitData.determined && (
               <Text style={styles.profitNote}>
                  * Algunas ventas no tienen precio de compra registrado. La ganancia es parcial.
               </Text>
            )}

            {/* PANELES */}
            <View style={[styles.panels, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
               {/* PAYMENT BREAKDOWN */}
               <View style={[styles.panelCard, wide && { flex: 1 }]}>
                  <View style={styles.panelHeader}>
                     <View style={styles.panelIconBox}>
                        <PieChart size={18} color={T.ink} />
                     </View>
                     <Text style={styles.panelTitle}>Balance por Método de Pago</Text>
                  </View>

                  {analytics.paymentBreakdown.length === 0 ? (
                     <Text style={styles.emptyText}>No hay registros de ventas en este rango de tiempo.</Text>
                  ) : (
                     analytics.paymentBreakdown.map((item, index) => {
                        const barColors = ['#050F78', '#08BB2C', '#AC0707', '#F59E0B', '#EC4899'];
                        const activeColor = barColors[index % barColors.length];

                        return (
                           <View key={item.method} style={{ marginBottom: 14 }}>
                              <View style={styles.paymentRowInfo}>
                                 <Text style={styles.paymentLabel}>{item.label}</Text>
                                 <Text style={styles.paymentSubtext}>
                                    {item.count} venta(s) • {item.percentage.toFixed(1)}%
                                 </Text>
                              </View>

                              <View style={styles.paymentBarContainer}>
                                 <View style={styles.paymentBarBackground}>
                                    <View
                                       style={[
                                          styles.paymentBarFill,
                                          { width: `${Math.min(100, Math.max(0, item.percentage))}%`, backgroundColor: activeColor },
                                       ]}
                                    />
                                 </View>
                                 <Text style={styles.paymentAmount}>${item.totalAmount.toFixed(2)}</Text>
                              </View>
                           </View>
                        );
                     })
                  )}
               </View>

               {/* TOP PRODUCTS CON GANANCIA */}
               <View style={[styles.panelCard, wide && { flex: 1 }]}>
                  <View style={styles.panelHeader}>
                     <View style={styles.panelIconBox}>
                        <Award size={18} color={T.ink} />
                     </View>
                     <Text style={styles.panelTitle}>Top Prendas Más Vendidas</Text>
                  </View>

                  {analytics.topProducts.length === 0 ? (
                     <Text style={styles.emptyText}>Aún no hay prendas vendidas en el período.</Text>
                  ) : (
                     analytics.topProducts.slice(0, 5).map((prod, index) => {
                        const currentProduct = catalog.find((p) => p.id === prod.productId);
                        const imageUrl = currentProduct?.images?.[0] || prod.image || null;
                        const productProfit = profitByProductId.get(prod.productId);

                        return (
                           <View key={`${prod.productId}_${index}`} style={styles.topProductRow}>
                              <View
                                 style={[
                                    styles.rankBadge,
                                    index === 0
                                       ? styles.rankFirst
                                       : index === 1
                                          ? styles.rankSecond
                                          : index === 2
                                             ? styles.rankThird
                                             : styles.rankNormal,
                                 ]}
                              >
                                 <Text style={[styles.rankText, index === 0 && { color: T.onSolid }]}>
                                    {index + 1}
                                 </Text>
                              </View>

                              {imageUrl ? (
                                 <Cover
                                    uri={imageUrl}
                                    name={prod.name}
                                    bg={T.imgBg}
                                    fg={T.line}
                                    style={styles.topProductImg}
                                 />
                              ) : (
                                 <View style={[styles.topProductImg, styles.topProductImgPlaceholder]}>
                                    <Shirt size={18} color={T.inkMute} />
                                 </View>
                              )}

                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <Text style={styles.topProductBrand}>{prod.brand}</Text>
                                 <Text style={styles.topProductName} numberOfLines={1}>{prod.name}</Text>
                                 <Text style={styles.topProductDetail}>
                                    Color: {prod.variantColor} • Talla: {prod.size}
                                 </Text>
                              </View>

                              <View style={{ alignItems: 'flex-end' }}>
                                 <Text style={styles.topProductUnits}>{prod.unitsSold} uds.</Text>
                                 <Text style={styles.topProductRevenue}>${prod.totalRevenue.toFixed(2)}</Text>
                                 {productProfit && productProfit.profit !== 0 && (
                                    <Text style={styles.topProductProfit}>
                                       +${productProfit.profit.toFixed(2)}
                                       {!productProfit.determined && '*'}
                                    </Text>
                                 )}
                              </View>
                           </View>
                        );
                     })
                  )}
               </View>
            </View>
         </ScrollView>

         <DateRangePickerModal
            visible={showDateRangeModal}
            initialRange={customDateRange}
            onClose={() => setShowDateRangeModal(false)}
            onApply={(range) => {
               setCustomDateRange(range);
               setTimeRange('custom');
               setShowDateRangeModal(false);
            }}
         />
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg, minHeight: 0 },
   scroll: { flex: 1, minHeight: 0 },
   content: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 22, paddingBottom: 64 },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg, padding: 20 },
   loadingText: { marginTop: 10, color: T.inkMute, fontSize: 13 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 18,
      flexWrap: 'wrap',
      gap: 14,
   },
   pageTitle: {
      ...display,
      fontSize: 46,
      lineHeight: 44,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
   },
   pageTitleMobile: { fontSize: 34, lineHeight: 33 },
   pageSubtitle: { fontSize: 13, color: T.inkSoft, marginTop: 4 },

   timeRangeWrap: { flexShrink: 0, maxWidth: '100%' },
   timeRangeContainer: {
      flexDirection: 'row',
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: T.line,
   },
   rangeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 9,
   },
   rangeChipCustom: { paddingHorizontal: 12 },
   rangeOn: { backgroundColor: T.solid },
   rangeChipText: { fontSize: 12, fontWeight: '700', color: T.inkSoft },
   rangeOnText: { color: T.onSolid },

   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
   kpiCard: {
      flexGrow: 1,
      minWidth: 140,
      borderRadius: 16,
      padding: 16,
      borderWidth: 0,
   },
   kpiHero: { backgroundColor: T.bar },
   kpiHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
   },
   kpiIconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
   },
   kpiIconHero: { backgroundColor: 'rgba(255,255,255,0.2)' },
   kpiTag: { fontSize: 12, fontWeight: '700' },
   kpiValue: { ...display, fontSize: 36, lineHeight: 34, fontWeight: '800' },
   kpiSubtext: { fontSize: 11, marginTop: 4, fontWeight: '500' },

   profitNote: {
      fontSize: 11,
      color: '#047857',
      fontStyle: 'italic',
      marginBottom: 12,
      lineHeight: 14,
   },

   panels: { gap: 16, marginTop: 8 },
   panelCard: {
      backgroundColor: T.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: T.line,
   },
   panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 18,
   },
   panelIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      justifyContent: 'center',
      alignItems: 'center',
   },
   panelTitle: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
      flexShrink: 1,
   },
   emptyText: {
      fontSize: 13,
      color: T.inkMute,
      fontStyle: 'italic',
      paddingVertical: 10,
      textAlign: 'center',
   },

   paymentRowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
   paymentLabel: { fontSize: 14, fontWeight: '700', color: T.ink },
   paymentSubtext: { fontSize: 12, color: T.inkSoft },
   paymentBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   paymentBarBackground: {
      flex: 1,
      height: 10,
      backgroundColor: T.line,
      borderRadius: 5,
      overflow: 'hidden',
   },
   paymentBarFill: { height: '100%', borderRadius: 5 },
   paymentAmount: {
      ...display,
      fontSize: 20,
      fontWeight: '800',
      color: T.ink,
      minWidth: 74,
      textAlign: 'right',
   },

   topProductRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
      gap: 12,
   },
   rankBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
   },
   rankFirst: { backgroundColor: '#373440' },
   rankSecond: { backgroundColor: '#020203' },
   rankThird: { backgroundColor: '#373440' },
   rankNormal: { backgroundColor: '#000000' },
   rankText: { ...display, fontSize: 14, fontWeight: '800', color: T.onSolid },
   topProductImg: { width: 42, height: 54, borderRadius: 6 },
   topProductImgPlaceholder: {
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      justifyContent: 'center',
      alignItems: 'center',
   },
   topProductBrand: {
      fontSize: 11,
      fontWeight: '700',
      color: T.inkMute,
      textTransform: 'uppercase',
   },
   topProductName: { fontSize: 14, fontWeight: '700', color: T.ink },
   topProductDetail: { fontSize: 11, color: T.inkSoft },
   topProductUnits: { fontSize: 13, fontWeight: '700', color: T.ink },
   topProductRevenue: { fontSize: 12, color: '#6366F1', fontWeight: '700' },
   topProductProfit: { fontSize: 10, color: '#047857', fontWeight: '800', marginTop: 2 },
});

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, Award, PieChart, CalendarRange, Shirt } from 'lucide-react-native';
import { Sale, subscribeToSales } from '../services/salesHistoryService';
import { subscribeToProducts } from '../services/productService';
import { Product } from '../types/inventory';
import { TimeRangeOption, filterSalesByTimeRange, calculateAnalytics } from '../services/analyticsService';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { Cover } from '../components/Cover';
import { MONO as T, display } from '../design';

const MAX = 1180;

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/--';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
};

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const AnalyticsDashboardScreen = () => {
   const [allSales, setAllSales] = useState<Sale[]>([]);
   const [catalog, setCatalog] = useState<Product[]>([]);
   const [timeRange, setTimeRange] = useState<TimeRangeOption>('30days');
   const [loading, setLoading] = useState(true);

   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

   const { width } = useWindowDimensions();
   const mobile = width < 600;
   const wide = width >= 1000;

   useEffect(() => {
      const unsubSales = subscribeToSales((sales) => {
         setAllSales(sales);
         setLoading(false);
      });
      const unsubProducts = subscribeToProducts(setCatalog);
      return () => {
         unsubSales();
         unsubProducts();
      };
   }, []);

   const filteredSales = filterSalesByTimeRange(allSales, timeRange, customDateRange);
   const analytics = calculateAnalytics(filteredSales);

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
   ];

   return (
      <View style={styles.container}>
         <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingHorizontal: mobile ? 14 : 22 }]}
            showsVerticalScrollIndicator={false}
         >
            {/* HEADER */}
            <View style={styles.headerRow}>
               <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={[styles.pageTitle, mobile && styles.pageTitleMobile]}>Analítica</Text>
                  <Text style={styles.pageSubtitle}>Rendimiento de ventas e inventario</Text>
               </View>

               <View style={styles.timeRangeWrap}>
                  <View style={styles.timeRangeContainer}>
                     {[
                        { id: 'today', label: 'Hoy' },
                        { id: '7days', label: '7D' },
                        { id: '30days', label: '30D' },
                        { id: 'all', label: 'Todo' },
                     ].map((item) => {
                        const isSelected = timeRange === item.id;
                        return (
                           <P
                              key={item.id}
                              style={[styles.rangeChip, isSelected && styles.rangeOn]}
                              onPress={() => setTimeRange(item.id as TimeRangeOption)}
                           >
                              <Text style={[styles.rangeChipText, isSelected && styles.rangeOnText]}>
                                 {item.label}
                              </Text>
                           </P>
                        );
                     })}
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
               </View>
            </View>

            {/* KPIs */}
            <View style={styles.kpiGrid}>
               {kpis.map(({ Icon, tag, value, sub, color, lightBg }, i) => {
                  const hero = i === 0;
                  return (
                     <View
                        key={tag}
                        style={[
                           styles.kpiCard,
                           { flexBasis: mobile ? '47%' : '22%' },
                           hero
                              ? styles.kpiHero
                              : { backgroundColor: lightBg, borderColor: color + '30', borderWidth: 1 },
                           hero && !mobile && { flexGrow: 1.6 },
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
                                 ? { color: T.onSolid, fontSize: mobile ? 44 : 60, lineHeight: mobile ? 42 : 56 }
                                 : { color: '#1F2937' },
                           ]}
                        >
                           {value}
                        </Text>
                        <Text style={[styles.kpiSubtext, hero ? { color: 'rgba(255,255,255,0.7)' } : { color: '#6B7280' }]}>
                           {sub}
                        </Text>
                     </View>
                  );
               })}
            </View>

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

               {/* TOP PRODUCTS */}
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
   container: { flex: 1, backgroundColor: T.bg },
   scroll: { flex: 1 },
   content: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 22, paddingBottom: 48 },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg, padding: 20 },
   loadingText: { marginTop: 10, color: T.inkMute, fontSize: 13 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   // Header
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

   // Time ranges
   timeRangeWrap: { flexShrink: 0 },
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

   // KPIs
   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
   kpiCard: {
      flexGrow: 1,
      minWidth: 150,
      borderRadius: 16,
      padding: 18,
      borderWidth: 0,
   },
   kpiHero: { backgroundColor: T.bar },
   kpiHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
   },
   kpiIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
   },
   kpiIconHero: { backgroundColor: 'rgba(255,255,255,0.2)' },
   kpiTag: { fontSize: 13, fontWeight: '700' },
   kpiValue: { ...display, fontSize: 40, lineHeight: 38, fontWeight: '800' },
   kpiSubtext: { fontSize: 12, marginTop: 4, fontWeight: '500' },

   // Panels
   panels: { gap: 16 },
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

   // Payment Breakdown
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

   // Top Products
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
});

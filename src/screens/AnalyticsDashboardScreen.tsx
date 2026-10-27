import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, Award, PieChart } from 'lucide-react-native';
import { Sale } from '../types/sale';
import { subscribeToSales } from '../services/saleService';
import { TimeRangeOption, filterSalesByTimeRange, calculateAnalytics } from '../services/analyticsService';
import { Cover } from '../components/Cover';
import { MONO as T, display } from '../design';

const MAX = 1180; // ancho máximo del contenido en pantallas grandes

export const AnalyticsDashboardScreen = () => {
   const [allSales, setAllSales] = useState<Sale[]>([]);
   const [timeRange, setTimeRange] = useState<TimeRangeOption>('30days');
   const [loading, setLoading] = useState(true);
   const { width } = useWindowDimensions();
   const mobile = width < 600;
   const wide = width >= 1000;

   useEffect(() => {
      const unsub = subscribeToSales((sales) => {
         setAllSales(sales);
         setLoading(false);
      });
      return () => unsub();
   }, []);

   const filteredSales = filterSalesByTimeRange(allSales, timeRange);
   const analytics = calculateAnalytics(filteredSales);

   if (loading) {
      return (
         <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Cargando analíticas...</Text>
         </View>
      );
   }

   // Colores personalizados y llamativos para las tarjetas de KPIs
   const kpis = [
      { Icon: DollarSign, tag: 'Ingresos', value: `$${analytics.totalRevenue.toFixed(2)}`, sub: 'Total recaudado en el período', color: '#6366f1', lightBg: '#eef2ff' },
      { Icon: ShoppingBag, tag: 'Prendas', value: String(analytics.totalUnitsSold), sub: 'Unidades descontadas', color: '#0ea5e9', lightBg: '#f0f9ff' },
      { Icon: TrendingUp, tag: 'Ventas', value: String(analytics.totalTransactions), sub: 'Transacciones cerradas', color: '#10b981', lightBg: '#ecfdf5' },
      { Icon: CreditCard, tag: 'Ticket Promedio', value: `$${analytics.averageTicket.toFixed(2)}`, sub: 'Promedio por transacción', color: '#f59e0b', lightBg: '#fffbeb' },
   ];

   return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingHorizontal: mobile ? 14 : 22 }]}>
         <View style={styles.headerRow}>
            <View>
               <Text style={[styles.pageTitle, mobile && { fontSize: 34, lineHeight: 33 }]}>Analítica</Text>
               <Text style={styles.pageSubtitle}>Rendimiento de ventas e inventario</Text>
            </View>

            <View style={styles.timeRangeContainer}>
               {[
                  { id: 'today', label: 'Hoy' },
                  { id: '7days', label: '7 Días' },
                  { id: '30days', label: '30 Días' },
                  { id: 'all', label: 'Histórico' },
               ].map((item) => {
                  const isSelected = timeRange === item.id;
                  return (
                     <Pressable
                        key={item.id}
                        style={({ pressed }) => [styles.rangeChip, isSelected && styles.rangeOn, pressed && styles.pressed]}
                        onPress={() => setTimeRange(item.id as TimeRangeOption)}
                     >
                        <Text style={[styles.rangeChipText, isSelected && styles.rangeOnText]}>{item.label}</Text>
                     </Pressable>
                  );
               })}
            </View>
         </View>

         <View style={styles.kpiGrid}>
            {kpis.map(({ Icon, tag, value, sub, color, lightBg }, i) => {
               const hero = i === 0; // Ingresos: tarjeta principal destacada con color sólido vibrante
               return (
                  <View
                     key={tag}
                     style={[
                        styles.kpiCard,
                        { flexBasis: mobile ? '47%' : '22%' },
                        hero ? styles.kpiHero : { backgroundColor: lightBg, borderColor: color + '30', borderWidth: 1 },
                        hero && !mobile && { flexGrow: 1.6 },
                     ]}
                  >
                     <View style={styles.kpiHeader}>
                        <View style={[styles.kpiIconBox, hero ? styles.kpiIconHero : { backgroundColor: color + '20' }]}>
                           <Icon size={18} color={hero ? T.onSolid : color} />
                        </View>
                        <Text style={[styles.kpiTag, hero ? { color: 'rgba(255,255,255,0.8)' } : { color: '#4b5563' }]}>{tag}</Text>
                     </View>
                     <Text style={[styles.kpiValue, hero ? { color: T.onSolid, fontSize: mobile ? 44 : 60, lineHeight: mobile ? 42 : 56 } : { color: '#1f2937' }]}>{value}</Text>
                     <Text style={[styles.kpiSubtext, hero ? { color: 'rgba(255,255,255,0.7)' } : { color: '#6b7280' }]}>{sub}</Text>
                  </View>
               );
            })}
         </View>

         <View style={[styles.panels, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
            <View style={[styles.panelCard, wide && { flex: 1 }]}>
               <View style={styles.panelHeader}>
                  <View style={styles.panelIconBox}>
                     <PieChart size={20} color="#030555" />
                  </View>
                  <Text style={styles.panelTitle}>Balance por Método de Pago</Text>
               </View>

               {analytics.paymentBreakdown.length === 0 ? (
                  <Text style={styles.emptyText}>No hay registros de ventas en este rango de tiempo.</Text>
               ) : (
                  analytics.paymentBreakdown.map((item, index) => {
                     // Colores variados para las barras de progreso
                     const barColors = ['#050f78', '#08bb2c', '#ac0707', '#f59e0b', '#ec4899'];
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

            <View style={[styles.panelCard, wide && { flex: 1 }]}>
               <View style={styles.panelHeader}>
                  <View style={styles.panelIconBox}>
                     <Award size={20} color="#f59e0b" />
                  </View>
                  <Text style={styles.panelTitle}>Top Prendas Más Vendidas</Text>
               </View>

               {analytics.topProducts.length === 0 ? (
                  <Text style={styles.emptyText}>Aún no hay prendas vendidas en el período.</Text>
               ) : (
                  analytics.topProducts.slice(0, 5).map((prod, index) => (
                     <View key={`${prod.productId}_${index}`} style={styles.topProductRow}>
                        <View style={[styles.rankBadge, index === 0 ? styles.rankFirst : index === 1 ? styles.rankSecond : index === 2 ? styles.rankThird : styles.rankNormal]}>
                           <Text style={[styles.rankText, index === 0 && { color: T.onSolid }]}>{index + 1}</Text>
                        </View>

                        <Cover uri={prod.image} name={prod.name} bg={T.imgBg} fg={T.line} style={styles.topProductImg} />

                        <View style={{ flex: 1 }}>
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
                  ))
               )}
            </View>
         </View>
      </ScrollView>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   content: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 22, paddingBottom: 48 },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
   loadingText: { marginTop: 10, color: T.inkMute, fontSize: 13 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 14 },
   pageTitle: { ...display, fontSize: 46, lineHeight: 44, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' },
   pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
   timeRangeContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
   rangeChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9 },
   rangeOn: { backgroundColor: '#000000' },
   rangeChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
   rangeOnText: { color: '#ffffff' },

   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
   kpiCard: { flexGrow: 1, minWidth: 150, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
   kpiHero: { backgroundColor: '#090909' },
   kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
   kpiIconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
   kpiIconHero: { backgroundColor: 'rgba(255,255,255,0.2)' },
   kpiTag: { fontSize: 13, fontWeight: '700' },
   kpiValue: { ...display, fontSize: 40, lineHeight: 38, fontWeight: '800' },
   kpiSubtext: { fontSize: 12, marginTop: 4, fontWeight: '500' },

   panels: { gap: 16 },
   panelCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
   panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
   panelIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
   panelTitle: { ...display, fontSize: 24, lineHeight: 24, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', flexShrink: 1 },
   emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },

   paymentRowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
   paymentLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
   paymentSubtext: { fontSize: 12, color: '#64748b' },
   paymentBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   paymentBarBackground: { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
   paymentBarFill: { height: '100%', borderRadius: 5 },
   paymentAmount: { ...display, fontSize: 20, fontWeight: '800', color: '#1e293b', minWidth: 74, textAlign: 'right' },

   topProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
   rankBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
   rankFirst: { backgroundColor: '#373440' },
   rankSecond: { backgroundColor: '#020203' },
   rankThird: { backgroundColor: '#373440' },
   rankNormal: { backgroundColor: '#000000' },
   rankText: { ...display, fontSize: 16, fontWeight: '800', color: '#ffffff' },
   topProductImg: { width: 42, height: 54, borderRadius: 6 },
   topProductBrand: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
   topProductName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
   topProductDetail: { fontSize: 11, color: '#64748b' },
   topProductUnits: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
   topProductRevenue: { fontSize: 12, color: '#6366f1', fontWeight: '700' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, Award, PieChart } from 'lucide-react-native';
import { Sale } from '../types/sale';
import { subscribeToSales } from '../services/saleService';
import { TimeRangeOption, filterSalesByTimeRange, calculateAnalytics } from '../services/analyticsService';
import { C, caps, box, activeBox, activeText } from '../theme';

export const AnalyticsDashboardScreen = () => {
   const [allSales, setAllSales] = useState<Sale[]>([]);
   const [timeRange, setTimeRange] = useState<TimeRangeOption>('30days');
   const [loading, setLoading] = useState(true);

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
            <ActivityIndicator size="large" color={C.light} />
            <Text style={styles.loadingText}>Cargando analíticas...</Text>
         </View>
      );
   }

   // Las 4 tarjetas de indicadores se generan desde una lista (evita repetir JSX)
   const kpis = [
      { Icon: DollarSign, tag: 'Ingresos', value: `$${analytics.totalRevenue.toFixed(2)}`, sub: 'Total recaudado en el período' },
      { Icon: ShoppingBag, tag: 'Prendas', value: String(analytics.totalUnitsSold), sub: 'Unidades descontadas' },
      { Icon: TrendingUp, tag: 'Ventas', value: String(analytics.totalTransactions), sub: 'Transacciones cerradas' },
      { Icon: CreditCard, tag: 'Ticket Promedio', value: `$${analytics.averageTicket.toFixed(2)}`, sub: 'Promedio por transacción' },
   ];

   return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
         <View style={styles.headerRow}>
            <View>
               <Text style={styles.pageTitle}>Dashboard de Analíticas</Text>
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
                     <TouchableOpacity
                        key={item.id}
                        style={[styles.rangeChip, isSelected && activeBox]}
                        onPress={() => setTimeRange(item.id as TimeRangeOption)}
                     >
                        <Text style={[styles.rangeChipText, isSelected && activeText]}>{item.label}</Text>
                     </TouchableOpacity>
                  );
               })}
            </View>
         </View>

         <View style={styles.kpiGrid}>
            {kpis.map(({ Icon, tag, value, sub }) => (
               <View key={tag} style={styles.kpiCard}>
                  <View style={styles.kpiHeader}>
                     <View style={styles.kpiIconBox}>
                        <Icon size={18} color={C.light} />
                     </View>
                     <Text style={styles.kpiTag}>{tag}</Text>
                  </View>
                  <Text style={styles.kpiValue}>{value}</Text>
                  <Text style={styles.kpiSubtext}>{sub}</Text>
               </View>
            ))}
         </View>

         <View style={{ gap: 16 }}>
            <View style={styles.panelCard}>
               <View style={styles.panelHeader}>
                  <PieChart size={18} color={C.light} style={{ marginRight: 8 }} />
                  <Text style={styles.panelTitle}>Balance por Método de Pago</Text>
               </View>

               {analytics.paymentBreakdown.length === 0 ? (
                  <Text style={styles.emptyText}>No hay registros de ventas en este rango de tiempo.</Text>
               ) : (
                  analytics.paymentBreakdown.map((item) => (
                     <View key={item.method} style={{ marginBottom: 12 }}>
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
                                    { width: `${Math.min(100, Math.max(0, item.percentage))}%` },
                                 ]}
                              />
                           </View>
                           <Text style={styles.paymentAmount}>${item.totalAmount.toFixed(2)}</Text>
                        </View>
                     </View>
                  ))
               )}
            </View>

            <View style={styles.panelCard}>
               <View style={styles.panelHeader}>
                  <Award size={18} color={C.light} style={{ marginRight: 8 }} />
                  <Text style={styles.panelTitle}>Top Prendas Más Vendidas</Text>
               </View>

               {analytics.topProducts.length === 0 ? (
                  <Text style={styles.emptyText}>Aún no hay prendas vendidas en el período.</Text>
               ) : (
                  analytics.topProducts.slice(0, 5).map((prod, index) => (
                     <View key={`${prod.productId}_${index}`} style={styles.topProductRow}>
                        <View
                           style={[
                              styles.rankBadge,
                              index === 0 && styles.rankFirst,
                              index === 1 && styles.rankSecond,
                              index === 2 && styles.rankThird,
                           ]}
                        >
                           <Text style={[styles.rankText, index <= 2 && { color: C.bg }]}>#{index + 1}</Text>
                        </View>

                        <Image
                           source={{ uri: prod.image || 'https://via.placeholder.com/50' }}
                           style={styles.topProductImg}
                        />

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

// Base compartida por tarjetas y paneles
const panel = { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14 };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: C.bg },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, padding: 20 },
   loadingText: { ...caps, marginTop: 10, color: C.mute, fontSize: 11 },

   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
   pageTitle: { ...caps, fontSize: 18, fontWeight: '900', color: C.white },
   pageSubtitle: { fontSize: 11, color: C.mute, letterSpacing: 1, marginTop: 2 },
   timeRangeContainer: { ...box, flexDirection: 'row', padding: 3, gap: 4 },
   rangeChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 2 },
   rangeChipText: { ...caps, fontSize: 10, fontWeight: '700', color: C.mute, letterSpacing: 1 },

   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
   kpiCard: { ...panel, flex: 1, minWidth: 150 },
   kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
   kpiIconBox: { ...box, width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
   kpiTag: { ...caps, fontSize: 10, fontWeight: 'bold', color: C.mute, letterSpacing: 1.5 },
   kpiValue: { fontSize: 24, fontWeight: '900', color: C.white },
   kpiSubtext: { fontSize: 10, color: C.dim, marginTop: 2 },

   panelCard: { ...panel, padding: 16 },
   panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 10 },
   panelTitle: { ...caps, fontSize: 12, fontWeight: '900', color: C.white },
   emptyText: { fontSize: 12, color: C.dim, fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },

   paymentRowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   paymentLabel: { fontSize: 12, fontWeight: 'bold', color: C.white },
   paymentSubtext: { fontSize: 11, color: C.mute },
   paymentBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
   paymentBarBackground: { flex: 1, height: 8, backgroundColor: C.line, borderRadius: 2, overflow: 'hidden' },
   paymentBarFill: { height: '100%', backgroundColor: C.light, borderRadius: 2 },
   paymentAmount: { fontSize: 12, fontWeight: 'bold', color: C.white, minWidth: 60, textAlign: 'right' },

   topProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222222', gap: 10 },
   rankBadge: { ...box, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
   rankFirst: { backgroundColor: C.light, borderColor: C.light },
   rankSecond: { backgroundColor: C.soft, borderColor: C.soft },
   rankThird: { backgroundColor: C.mute, borderColor: C.mute },
   rankText: { fontSize: 10, color: C.soft, fontWeight: 'bold' },
   topProductImg: { width: 40, height: 40, borderRadius: 2, backgroundColor: C.raised },
   topProductBrand: { ...caps, fontSize: 9, fontWeight: 'bold', color: C.mute, letterSpacing: 1.5 },
   topProductName: { fontSize: 12, fontWeight: 'bold', color: C.white },
   topProductDetail: { fontSize: 10, color: C.mute },
   topProductUnits: { fontSize: 12, fontWeight: 'bold', color: C.white },
   topProductRevenue: { fontSize: 11, color: C.soft, fontWeight: '600' },
});
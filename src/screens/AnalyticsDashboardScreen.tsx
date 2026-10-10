import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   Image,
   ActivityIndicator,
} from 'react-native';
import {
   DollarSign,
   ShoppingBag,
   TrendingUp,
   CreditCard,
   Award,
   Calendar,
   Layers,
   PieChart,
} from 'lucide-react-native';
import { Sale } from '../types/sale';
import { subscribeToSales } from '../services/saleService';
import {
   TimeRangeOption,
   filterSalesByTimeRange,
   calculateAnalytics,
} from '../services/analyticsService';

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
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Cargando analíticas...</Text>
         </View>
      );
   }

   return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
         {/* SECTOR CABECERA Y FILTROS TEMPORALES */}
         <View style={styles.headerRow}>
            <View>
               <Text style={styles.pageTitle}>Dashboard de Analíticas</Text>
               <Text style={styles.pageSubtitle}>Rendimiento de ventas e inventario</Text>
            </View>

            {/* SELECTOR DE PERÍODO */}
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
                        style={[styles.rangeChip, isSelected && styles.rangeChipActive]}
                        onPress={() => setTimeRange(item.id as TimeRangeOption)}
                     >
                        <Text style={[styles.rangeChipText, isSelected && styles.rangeChipTextActive]}>
                           {item.label}
                        </Text>
                     </TouchableOpacity>
                  );
               })}
            </View>
         </View>

         {/* TARJETAS DE INDICADORES CLAVE (KPIs) */}
         <View style={styles.kpiGrid}>
            {/* INGRESOS TOTALES */}
            <View style={[styles.kpiCard, { borderColor: '#bbf7d0' }]}>
               <View style={styles.kpiHeader}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#dcfce7' }]}>
                     <DollarSign size={20} color="#16a34a" />
                  </View>
                  <Text style={styles.kpiTag}>Ingresos</Text>
               </View>
               <Text style={styles.kpiValue}>${analytics.totalRevenue.toFixed(2)}</Text>
               <Text style={styles.kpiSubtext}>Total recaudado en el período</Text>
            </View>

            {/* UNIDADES VENDIDAS */}
            <View style={[styles.kpiCard, { borderColor: '#bfdbfe' }]}>
               <View style={styles.kpiHeader}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#dbeafe' }]}>
                     <ShoppingBag size={20} color="#2563eb" />
                  </View>
                  <Text style={styles.kpiTag}>Prendas</Text>
               </View>
               <Text style={styles.kpiValue}>{analytics.totalUnitsSold}</Text>
               <Text style={styles.kpiSubtext}>Unidades descontadas</Text>
            </View>

            {/* TRANSACCIONES TOTALES */}
            <View style={[styles.kpiCard, { borderColor: '#e9d5ff' }]}>
               <View style={styles.kpiHeader}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#f3e8ff' }]}>
                     <TrendingUp size={20} color="#7c3aed" />
                  </View>
                  <Text style={styles.kpiTag}>Ventas</Text>
               </View>
               <Text style={styles.kpiValue}>{analytics.totalTransactions}</Text>
               <Text style={styles.kpiSubtext}>Transacciones cerradas</Text>
            </View>

            {/* TICKET PROMEDIO */}
            <View style={[styles.kpiCard, { borderColor: '#fef08a' }]}>
               <View style={styles.kpiHeader}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#fef9c3' }]}>
                     <CreditCard size={20} color="#ca8a04" />
                  </View>
                  <Text style={styles.kpiTag}>Ticket Promedio</Text>
               </View>
               <Text style={styles.kpiValue}>${analytics.averageTicket.toFixed(2)}</Text>
               <Text style={styles.kpiSubtext}>Promedio por transacción</Text>
            </View>
         </View>

         {/* SECCIÓN DOS COLUMNAS: MÉTODOS DE PAGO Y RANKING */}
         <View style={styles.dashboardLayout}>
            {/* DISTRIBUCIÓN POR MÉTODO DE PAGO */}
            <View style={styles.panelCard}>
               <View style={styles.panelHeader}>
                  <PieChart size={18} color="#2563eb" style={{ marginRight: 8 }} />
                  <Text style={styles.panelTitle}>Balance por Método de Pago</Text>
               </View>

               {analytics.paymentBreakdown.length === 0 ? (
                  <Text style={styles.emptyText}>No hay registros de ventas en este rango de tiempo.</Text>
               ) : (
                  analytics.paymentBreakdown.map((item) => (
                     <View key={item.method} style={styles.paymentRow}>
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

            {/* RANKING DE PRENDAS MÁS VENDIDAS */}
            <View style={styles.panelCard}>
               <View style={styles.panelHeader}>
                  <Award size={18} color="#16a34a" style={{ marginRight: 8 }} />
                  <Text style={styles.panelTitle}>Top Prendas Más Vendidas</Text>
               </View>

               {analytics.topProducts.length === 0 ? (
                  <Text style={styles.emptyText}>Aún no hay prendas vendidas en el período.</Text>
               ) : (
                  analytics.topProducts.slice(0, 5).map((prod, index) => (
                     <View key={`${prod.productId}_${index}`} style={styles.topProductRow}>
                        {/* MEDALLA / POSICIÓN */}
                        <View
                           style={[
                              styles.rankBadge,
                              index === 0 && styles.rankGold,
                              index === 1 && styles.rankSilver,
                              index === 2 && styles.rankBronze,
                           ]}
                        >
                           <Text
                              style={[
                                 styles.rankText,
                                 index <= 2 && { color: '#ffffff', fontWeight: 'bold' },
                              ]}
                           >
                              #{index + 1}
                           </Text>
                        </View>

                        <Image
                           source={{ uri: prod.image || 'https://via.placeholder.com/50' }}
                           style={styles.topProductImg}
                        />

                        <View style={{ flex: 1 }}>
                           <Text style={styles.topProductBrand}>{prod.brand}</Text>
                           <Text style={styles.topProductName} numberOfLines={1}>
                              {prod.name}
                           </Text>
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
   content: { padding: 16 },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
   loadingText: { marginTop: 10, color: '#64748b', fontSize: 13 },
   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
   pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
   pageSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
   timeRangeContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 3, gap: 4 },
   rangeChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
   rangeChipActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
   rangeChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
   rangeChipTextActive: { color: '#2563eb', fontWeight: 'bold' },

   /* KPIs */
   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
   kpiCard: { flex: 1, minWidth: 150, backgroundColor: '#ffffff', borderWidth: 1, borderRadius: 12, padding: 14 },
   kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
   kpiIconBox: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
   kpiTag: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
   kpiValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
   kpiSubtext: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

   /* LAYOUT DE PANELES */
   dashboardLayout: { gap: 16 },
   panelCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16 },
   panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
   panelTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   emptyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },

   /* MÉTODOS DE PAGO */
   paymentRow: { marginBottom: 12 },
   paymentRowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   paymentLabel: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   paymentSubtext: { fontSize: 11, color: '#64748b' },
   paymentBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
   paymentBarBackground: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
   paymentBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
   paymentAmount: { fontSize: 12, fontWeight: 'bold', color: '#16a34a', minWidth: 60, textAlign: 'right' },

   /* TOP PRODUCTOS */
   topProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
   rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
   rankGold: { backgroundColor: '#eab308' },
   rankSilver: { backgroundColor: '#94a3b8' },
   rankBronze: { backgroundColor: '#d97706' },
   rankText: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
   topProductImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#f1f5f9' },
   topProductBrand: { fontSize: 9, fontWeight: 'bold', color: '#2563eb' },
   topProductName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   topProductDetail: { fontSize: 10, color: '#64748b' },
   topProductUnits: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   topProductRevenue: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
});

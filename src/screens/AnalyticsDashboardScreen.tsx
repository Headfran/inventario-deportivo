import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import {
   DollarSign,
   ShoppingBag,
   TrendingUp,
   CreditCard,
   Award,
   PieChart,
   CalendarRange,
   Sparkles,
   Shirt
} from 'lucide-react-native';

import { Sale, subscribeToSales } from '../services/salesHistoryService';
import { subscribeToProducts } from '../services/productService';
import { Product } from '../types/inventory';
import {
   TimeRangeOption,
   filterSalesByTimeRange,
   calculateAnalytics,
} from '../services/analyticsService';
import { DateRangePickerModal } from '../components/DateRangePickerModal';

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

export const AnalyticsDashboardScreen = () => {
   const [allSales, setAllSales] = useState<Sale[]>([]);
   const [catalog, setCatalog] = useState<Product[]>([]); // <- ESTADO DEL CATÁLOGO
   const [timeRange, setTimeRange] = useState<TimeRangeOption>('30days');
   const [loading, setLoading] = useState(true);

   // Estados del Calendario Custom
   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date, end: Date } | null>(null);

   useEffect(() => {
      // Suscribimos a las ventas
      const unsubSales = subscribeToSales((sales) => {
         setAllSales(sales);
         setLoading(false);
      });
      // Suscribimos al catálogo de productos en tiempo real
      const unsubProducts = subscribeToProducts((products) => {
         setCatalog(products);
      });

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
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Recopilando datos financieros...</Text>
         </View>
      );
   }

   return (
      <View style={styles.container}>
         <ScrollView contentContainerStyle={styles.content}>
            {/* CABECERA Y FILTROS */}
            <View style={styles.headerRow}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.titleIconBg}><PieChart size={24} color="#2563eb" /></View>
                  <View>
                     <Text style={styles.pageTitle}>Dashboard Analítico</Text>
                     <Text style={styles.pageSubtitle}>Desempeño general de ventas</Text>
                  </View>
               </View>
            </View>

            <View style={styles.timeRangeWrapper}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                           <Text style={[styles.rangeChipText, isSelected && styles.rangeChipTextActive]}>{item.label}</Text>
                        </TouchableOpacity>
                     );
                  })}
                  <TouchableOpacity
                     style={[styles.rangeChip, timeRange === 'custom' && styles.rangeChipActive]}
                     onPress={() => setShowDateRangeModal(true)}
                  >
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <CalendarRange size={14} color={timeRange === 'custom' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.rangeChipText, timeRange === 'custom' && styles.rangeChipTextActive]}>
                           {timeRange === 'custom' && customDateRange ? formatDateShort(customDateRange.start) : 'Rango...'}
                        </Text>
                     </View>
                  </TouchableOpacity>
               </ScrollView>
            </View>

            {/* TARJETAS DE INDICADORES CLAVE (KPIs) */}
            <View style={styles.kpiGrid}>
               <View style={styles.kpiCardPrimary}>
                  <View style={styles.kpiHeader}>
                     <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <DollarSign size={20} color="#ffffff" />
                     </View>
                     <Sparkles size={16} color="#ffffff" style={{ opacity: 0.5 }} />
                  </View>
                  <Text style={styles.kpiTagLight}>Ingresos Netos</Text>
                  <Text style={styles.kpiValueLight}>${analytics.totalRevenue.toFixed(2)}</Text>
               </View>

               <View style={{ flex: 1, gap: 12 }}>
                  <View style={[styles.kpiCardSecondary]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.kpiIconBox, { backgroundColor: '#fef9c3' }]}><CreditCard size={16} color="#ca8a04" /></View>
                        <View>
                           <Text style={styles.kpiTagDark}>Ticket Promedio</Text>
                           <Text style={styles.kpiValueDark}>${analytics.averageTicket.toFixed(2)}</Text>
                        </View>
                     </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                     <View style={[styles.kpiCardSecondary, { flex: 1, padding: 12 }]}>
                        <View style={[styles.kpiIconBox, { backgroundColor: '#f3e8ff', marginBottom: 8 }]}><TrendingUp size={16} color="#7c3aed" /></View>
                        <Text style={styles.kpiTagDark}>Ventas</Text>
                        <Text style={styles.kpiValueDark}>{analytics.totalTransactions}</Text>
                     </View>
                     <View style={[styles.kpiCardSecondary, { flex: 1, padding: 12 }]}>
                        <View style={[styles.kpiIconBox, { backgroundColor: '#dbeafe', marginBottom: 8 }]}><ShoppingBag size={16} color="#2563eb" /></View>
                        <Text style={styles.kpiTagDark}>Prendas</Text>
                        <Text style={styles.kpiValueDark}>{analytics.totalUnitsSold}</Text>
                     </View>
                  </View>
               </View>
            </View>

            {/* SECCIÓN DOS COLUMNAS */}
            <View style={styles.dashboardLayout}>
               {/* DISTRIBUCIÓN POR MÉTODO DE PAGO */}
               <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                     <PieChart size={18} color="#2563eb" style={{ marginRight: 8 }} />
                     <Text style={styles.panelTitle}>Balance por Método de Pago</Text>
                  </View>

                  {analytics.paymentBreakdown.length === 0 ? (
                     <Text style={styles.emptyText}>No hay flujos de caja en este período.</Text>
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
                     <Text style={styles.panelTitle}>Top Prendas Estelares</Text>
                  </View>

                  {analytics.topProducts.length === 0 ? (
                     <Text style={styles.emptyText}>El catálogo espera su próxima venta.</Text>
                  ) : (
                     analytics.topProducts.slice(0, 5).map((prod, index) => {
                        // AQUÍ OCURRE LA MAGIA: Buscamos la prenda actual en el catálogo
                        const currentProduct = catalog.find(p => p.id === prod.productId);
                        // Usamos la imagen del catálogo, o la heredada de la venta vieja, o null
                        const imageUrl = currentProduct?.images?.[0] || prod.image || null;

                        return (
                           <View key={`${prod.productId}_${index}`} style={styles.topProductRow}>
                              {/* MEDALLA */}
                              <View
                                 style={[
                                    styles.rankBadge,
                                    index === 0 && styles.rankGold,
                                    index === 1 && styles.rankSilver,
                                    index === 2 && styles.rankBronze,
                                 ]}
                              >
                                 <Text style={[styles.rankText, index <= 2 && { color: '#ffffff' }]}>
                                    #{index + 1}
                                 </Text>
                              </View>

                              {/* IMAGEN O PLACEHOLDER FASHION */}
                              {imageUrl ? (
                                 <Image
                                    source={{ uri: imageUrl }}
                                    style={styles.topProductImg}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                 />
                              ) : (
                                 <View style={[styles.topProductImg, styles.imgPlaceholder]}>
                                    <Shirt size={20} color="#94a3b8" />
                                 </View>
                              )}

                              <View style={{ flex: 1 }}>
                                 <Text style={styles.topProductBrand}>{prod.brand}</Text>
                                 <Text style={styles.topProductName} numberOfLines={1}>
                                    {prod.name}
                                 </Text>
                                 <Text style={styles.topProductDetail}>
                                    {prod.variantColor} • Talla {prod.size}
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

         {/* MODAL DEL CALENDARIO REUTILIZABLE */}
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
   container: { flex: 1, backgroundColor: '#f8fafc' },
   content: { padding: 16, paddingBottom: 40 },
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
   loadingText: { marginTop: 12, color: '#64748b', fontSize: 13, fontWeight: '500' },

   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
   titleIconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
   pageTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
   pageSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

   timeRangeWrapper: { marginBottom: 20 },
   rangeChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   rangeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
   rangeChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
   rangeChipTextActive: { color: '#ffffff', fontWeight: 'bold' },

   /* KPIs FASHION */
   kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
   kpiCardPrimary: { flex: 1, backgroundColor: '#2563eb', borderRadius: 20, padding: 20, justifyContent: 'space-between', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
   kpiCardSecondary: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
   kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
   kpiIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

   kpiTagLight: { fontSize: 12, fontWeight: '600', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: 1 },
   kpiValueLight: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginTop: 4 },

   kpiTagDark: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
   kpiValueDark: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginTop: 2 },

   /* LAYOUT DE PANELES */
   dashboardLayout: { gap: 16 },
   panelCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
   panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
   panelTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
   emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' },

   /* MÉTODOS DE PAGO */
   paymentRow: { marginBottom: 14 },
   paymentRowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
   paymentLabel: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   paymentSubtext: { fontSize: 11, color: '#64748b', fontWeight: '500' },
   paymentBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   paymentBarBackground: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
   paymentBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
   paymentAmount: { fontSize: 13, fontWeight: '900', color: '#16a34a', minWidth: 70, textAlign: 'right' },

   /* TOP PRODUCTOS */
   topProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12 },
   rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
   rankGold: { backgroundColor: '#eab308', shadowColor: '#eab308', shadowOpacity: 0.4, shadowRadius: 4, elevation: 2 },
   rankSilver: { backgroundColor: '#94a3b8' },
   rankBronze: { backgroundColor: '#d97706' },
   rankText: { fontSize: 12, color: '#475569', fontWeight: '900' },

   topProductImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#f1f5f9' },
   imgPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },

   topProductBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' },
   topProductName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
   topProductDetail: { fontSize: 11, color: '#64748b' },
   topProductUnits: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
   topProductRevenue: { fontSize: 12, color: '#16a34a', fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
});

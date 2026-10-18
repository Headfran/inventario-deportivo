import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   Modal,
} from 'react-native';
import {
   Users,
   Award,
   TrendingUp,
   ShoppingBag,
   Clock,
   ChevronRight,
   X,
   Receipt,
   Tag,
} from 'lucide-react-native';
import { Sale, subscribeToSales } from '../services/salesHistoryService';
import { Layaway, subscribeToLayaways } from '../services/layawayService';
import {
   SellerMetrics,
   TimePeriod,
   computeSellerPerformance,
} from '../services/sellerPerformanceService';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

export const SellerPerformanceScreen: React.FC = () => {
   const [sales, setSales] = useState<Sale[]>([]);
   const [layaways, setLayaways] = useState<Layaway[]>([]);
   const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
   const [selectedSeller, setSelectedSeller] = useState<SellerMetrics | null>(null);

   useEffect(() => {
      const unsubS = subscribeToSales(setSales);
      const unsubL = subscribeToLayaways(setLayaways);
      return () => {
         unsubS();
         unsubL();
      };
   }, []);

   const sellersData = computeSellerPerformance(sales, layaways, selectedPeriod);

   const globalVolume = sellersData.reduce((acc, s) => acc + s.totalVolume, 0);
   const globalTransactions = sellersData.reduce(
      (acc, s) => acc + s.totalSalesCount + s.totalLayawaysCount,
      0
   );
   const topSeller = sellersData[0] || null;

   return (
      <View style={styles.container}>
         {/* CABECERA */}
         <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Users size={22} color="#2563eb" style={{ marginRight: 8 }} />
               <View>
                  <Text style={styles.headerTitle}>Rendimiento de Vendedores</Text>
                  <Text style={styles.headerSubtitle}>Ranking de ventas, transacciones y volumen facturado</Text>
               </View>
            </View>
         </View>

         {/* FILTROS DE PERIODO */}
         <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               <TouchableOpacity
                  style={[styles.periodTab, selectedPeriod === 'today' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('today')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'today' && styles.periodTabTextActive]}>
                     Hoy
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.periodTab, selectedPeriod === 'week' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('week')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'week' && styles.periodTabTextActive]}>
                     Esta Semana
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.periodTab, selectedPeriod === 'month' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('month')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'month' && styles.periodTabTextActive]}>
                     Este Mes
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.periodTab, selectedPeriod === 'all' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('all')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'all' && styles.periodTabTextActive]}>
                     Todo el Historial
                  </Text>
               </TouchableOpacity>
            </ScrollView>
         </View>

         <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* METRICAS GLOBALES DEL PERIODO */}
            <View style={styles.kpiGrid}>
               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Facturación Total</Text>
                     <TrendingUp size={16} color="#16a34a" />
                  </View>
                  <Text style={styles.kpiValue}>${safeFixed(globalVolume)}</Text>
                  <Text style={styles.kpiSub}>Ventas + Apartados en periodo</Text>
               </View>

               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Transacciones Totales</Text>
                     <Tag size={16} color="#2563eb" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#2563eb' }]}>
                     {globalTransactions}
                  </Text>
                  <Text style={styles.kpiSub}>Operaciones registradas</Text>
               </View>

               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Vendedor Líder</Text>
                     <Award size={16} color="#eab308" />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1}>
                     {topSeller ? topSeller.sellerName : 'N/A'}
                  </Text>
                  <Text style={styles.kpiSub}>
                     {topSeller ? `$${safeFixed(topSeller.totalVolume)} facturados` : 'Sin registros'}
                  </Text>
               </View>
            </View>

            {/* RANKING Y LISTA DE VENDEDORES */}
            <Text style={styles.sectionTitle}>Ranking y Detalle por Vendedor</Text>

            {sellersData.length === 0 ? (
               <View style={styles.emptyContainer}>
                  <Users size={36} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No hay datos en este periodo</Text>
                  <Text style={styles.emptySubtitle}>
                     Las ventas y apartados registrados asignados a vendedores aparecerán en este reporte.
                  </Text>
               </View>
            ) : (
               sellersData.map((seller, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;

                  return (
                     <TouchableOpacity
                        key={seller.sellerId}
                        style={[styles.sellerCard, isFirst && styles.sellerCardTop]}
                        activeOpacity={0.85}
                        onPress={() => setSelectedSeller(seller)}
                     >
                        <View style={styles.sellerMainRow}>
                           <View
                              style={[
                                 styles.rankBadge,
                                 isFirst && styles.rankBadgeGold,
                                 isSecond && styles.rankBadgeSilver,
                                 isThird && styles.rankBadgeBronze,
                              ]}
                           >
                              <Text
                                 style={[
                                    styles.rankBadgeText,
                                    (isFirst || isSecond || isThird) && { color: '#ffffff' },
                                 ]}
                              >
                                 #{index + 1}
                              </Text>
                           </View>

                           <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.sellerNameText}>{seller.sellerName}</Text>
                              <Text style={styles.sellerSubText}>
                                 {seller.totalSalesCount} ventas directas | {seller.totalLayawaysCount} apartados
                              </Text>
                           </View>

                           <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                              <Text style={styles.sellerVolumeText}>
                                 ${safeFixed(seller.totalVolume)}
                              </Text>
                              <Text style={styles.sellerTransactionsText}>
                                 {seller.totalSalesCount + seller.totalLayawaysCount} ops.
                              </Text>
                           </View>

                           <ChevronRight size={18} color="#94a3b8" />
                        </View>

                        <View style={styles.sellerStatsBar}>
                           <View style={styles.miniStat}>
                              <ShoppingBag size={12} color="#16a34a" />
                              <Text style={styles.miniStatText}>
                                 Ventas: ${safeFixed(seller.totalSalesAmount)}
                              </Text>
                           </View>

                           <View style={styles.miniStat}>
                              <Clock size={12} color="#2563eb" />
                              <Text style={styles.miniStatText}>
                                 Apartados: ${safeFixed(seller.totalLayawaysAmount)}
                              </Text>
                           </View>

                           <View style={styles.miniStat}>
                              <Receipt size={12} color="#64748b" />
                              <Text style={styles.miniStatText}>
                                 Ticket Prom: ${safeFixed(seller.averageTicket)}
                              </Text>
                           </View>
                        </View>
                     </TouchableOpacity>
                  );
               })
            )}
         </ScrollView>

         {/* MODAL DETALLE INDIVIDUAL DEL VENDEDOR */}
         <Modal visible={!!selectedSeller} transparent animationType="slide">
            {selectedSeller && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Award size={18} color="#2563eb" />
                           <Text style={styles.modalTitle}>{selectedSeller.sellerName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedSeller(null)}>
                           <X size={20} color="#64748b" />
                        </TouchableOpacity>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        <View style={styles.sellerDetailBox}>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Facturado:</Text>
                              <Text style={styles.detailValBold}>
                                 ${safeFixed(selectedSeller.totalVolume)}
                              </Text>
                           </View>

                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Operaciones:</Text>
                              <Text style={styles.detailVal}>
                                 {selectedSeller.totalSalesCount + selectedSeller.totalLayawaysCount}
                              </Text>
                           </View>

                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Ticket Promedio:</Text>
                              <Text style={styles.detailVal}>
                                 ${safeFixed(selectedSeller.averageTicket)}
                              </Text>
                           </View>
                        </View>

                        <Text style={styles.sectionLabel}>
                           Ventas Cerradas ({selectedSeller.completedSales.length}):
                        </Text>
                        <View style={styles.historyList}>
                           {selectedSeller.completedSales.length === 0 ? (
                              <Text style={styles.emptySubText}>Sin ventas en este periodo.</Text>
                           ) : (
                              selectedSeller.completedSales.map((s) => (
                                 <View key={s.id} style={styles.historyRow}>
                                    <View style={{ flex: 1 }}>
                                       <Text style={styles.historyTitle}>Recibo #{s.receiptNumber}</Text>
                                       <Text style={styles.historySub}>
                                          {new Date(s.createdAt).toLocaleDateString('es-ES')} -{' '}
                                          {s.paymentMethod.replace('_', ' ').toUpperCase()}
                                       </Text>
                                    </View>
                                    <Text style={styles.historyPrice}>${safeFixed(s.total)}</Text>
                                 </View>
                              ))
                           )}
                        </View>

                        <Text style={styles.sectionLabel}>
                           Apartados Creados ({selectedSeller.activeLayaways.length}):
                        </Text>
                        <View style={styles.historyList}>
                           {selectedSeller.activeLayaways.length === 0 ? (
                              <Text style={styles.emptySubText}>Sin apartados en este periodo.</Text>
                           ) : (
                              selectedSeller.activeLayaways.map((l) => (
                                 <View key={l.id} style={styles.historyRow}>
                                    <View style={{ flex: 1 }}>
                                       <Text style={styles.historyTitle}>Apartado #{l.code}</Text>
                                       <Text style={styles.historySub}>
                                          Cliente: {l.customerName} | Abonado: ${safeFixed(l.totalPaid)}
                                       </Text>
                                    </View>
                                    <Text style={styles.historyPrice}>${safeFixed(l.totalAmount)}</Text>
                                 </View>
                              ))
                           )}
                        </View>
                     </ScrollView>
                  </View>
               </View>
            )}
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   headerSubtitle: { fontSize: 11, color: '#64748b' },

   filterSection: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   periodTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 8 },
   periodTabActive: { backgroundColor: '#2563eb' },
   periodTabText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   periodTabTextActive: { color: '#ffffff', fontWeight: 'bold' },

   scrollContent: { padding: 16 },

   kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
   kpiCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
   kpiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
   kpiValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginVertical: 4 },
   kpiSub: { fontSize: 10, color: '#94a3b8' },

   sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },

   sellerCard: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      elevation: 1,
   },
   sellerCardTop: { borderColor: '#fde047', backgroundColor: '#fefce8' },
   sellerMainRow: { flexDirection: 'row', alignItems: 'center' },

   rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
   rankBadgeGold: { backgroundColor: '#eab308' },
   rankBadgeSilver: { backgroundColor: '#94a3b8' },
   rankBadgeBronze: { backgroundColor: '#d97706' },
   rankBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#475569' },

   sellerNameText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
   sellerSubText: { fontSize: 11, color: '#64748b', marginTop: 1 },
   sellerVolumeText: { fontSize: 15, fontWeight: '800', color: '#16a34a' },
   sellerTransactionsText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },

   sellerStatsBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
   miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   miniStatText: { fontSize: 11, color: '#475569', fontWeight: '500' },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
   emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
   emptySubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 280 },

   /* MODAL */
   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },

   sellerDetailBox: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 12 },
   detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
   detailLabel: { fontSize: 11, color: '#1e40af', fontWeight: '600' },
   detailVal: { fontSize: 12, color: '#1e3a8a', fontWeight: 'bold' },
   detailValBold: { fontSize: 16, color: '#16a34a', fontWeight: '800' },

   sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 10, marginBottom: 6 },
   historyList: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
   historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   historyTitle: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   historySub: { fontSize: 10, color: '#64748b' },
   historyPrice: { fontSize: 12, fontWeight: 'bold', color: '#16a34a' },
   emptySubText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 6 },
});

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
   Crown,
   Medal,
   CalendarRange
} from 'lucide-react-native';
import { Sale, subscribeToSales } from '../services/salesHistoryService';
import { Layaway, subscribeToLayaways } from '../services/layawayService';
import {
   SellerMetrics,
   TimePeriod,
   computeSellerPerformance,
} from '../services/sellerPerformanceService';

// IMPORTAMOS EL MODAL DE CALENDARIO REUTILIZABLE
import { DateRangePickerModal } from '../components/DateRangePickerModal';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

const formatDateTime = (dateVal: any): string => {
   if (!dateVal) return '--/--/----';
   let d = new Date(dateVal);
   if (typeof dateVal.toDate === 'function') d = dateVal.toDate();
   else if (typeof dateVal.seconds === 'number') d = new Date(dateVal.seconds * 1000);

   const day = d.getDate().toString().padStart(2, '0');
   const month = (d.getMonth() + 1).toString().padStart(2, '0');
   const year = d.getFullYear();
   let hoursStr = d.getHours();
   const minutes = d.getMinutes().toString().padStart(2, '0');
   const ampm = hoursStr >= 12 ? 'PM' : 'AM';
   hoursStr = hoursStr % 12;
   hoursStr = hoursStr ? hoursStr : 12;
   return `${day}/${month}/${year} a las ${hoursStr}:${minutes} ${ampm}`;
};

export const SellerPerformanceScreen: React.FC = () => {
   const [sales, setSales] = useState<Sale[]>([]);
   const [layaways, setLayaways] = useState<Layaway[]>([]);
   const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');

   // Estados de Modales
   const [selectedSeller, setSelectedSeller] = useState<SellerMetrics | null>(null);
   const [selectedSaleToView, setSelectedSaleToView] = useState<Sale | null>(null);

   // Estados del Rango de Fechas
   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date, end: Date } | null>(null);

   useEffect(() => {
      const unsubS = subscribeToSales(setSales);
      const unsubL = subscribeToLayaways(setLayaways);
      return () => {
         unsubS();
         unsubL();
      };
   }, []);

   const sellersData = computeSellerPerformance(sales, layaways, selectedPeriod, customDateRange);

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
               <Users size={24} color="#2563eb" style={{ marginRight: 10 }} />
               <View>
                  <Text style={styles.headerTitle}>Rendimiento de Vendedores</Text>
                  <Text style={styles.headerSubtitle}>Ranking de ventas y contribución</Text>
               </View>
            </View>
         </View>

         {/* FILTROS DE PERIODO */}
         <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               <TouchableOpacity style={[styles.periodTab, selectedPeriod === 'today' && styles.periodTabActive]} onPress={() => setSelectedPeriod('today')}>
                  <Text style={[styles.periodTabText, selectedPeriod === 'today' && styles.periodTabTextActive]}>Hoy</Text>
               </TouchableOpacity>

               <TouchableOpacity style={[styles.periodTab, selectedPeriod === 'week' && styles.periodTabActive]} onPress={() => setSelectedPeriod('week')}>
                  <Text style={[styles.periodTabText, selectedPeriod === 'week' && styles.periodTabTextActive]}>Esta Semana</Text>
               </TouchableOpacity>

               <TouchableOpacity style={[styles.periodTab, selectedPeriod === 'month' && styles.periodTabActive]} onPress={() => setSelectedPeriod('month')}>
                  <Text style={[styles.periodTabText, selectedPeriod === 'month' && styles.periodTabTextActive]}>Este Mes</Text>
               </TouchableOpacity>

               <TouchableOpacity style={[styles.periodTab, selectedPeriod === 'all' && styles.periodTabActive]} onPress={() => setSelectedPeriod('all')}>
                  <Text style={[styles.periodTabText, selectedPeriod === 'all' && styles.periodTabTextActive]}>Todo el Historial</Text>
               </TouchableOpacity>

               <TouchableOpacity style={[styles.periodTab, selectedPeriod === 'custom' && styles.periodTabActive]} onPress={() => setShowDateRangeModal(true)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                     <CalendarRange size={14} color={selectedPeriod === 'custom' ? '#ffffff' : '#475569'} />
                     <Text style={[styles.periodTabText, selectedPeriod === 'custom' && styles.periodTabTextActive]}>
                        {selectedPeriod === 'custom' && customDateRange ? formatDateShort(customDateRange.start) : 'Rango...'}
                     </Text>
                  </View>
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
                  <Text style={styles.kpiSub}>Ventas + Apartados</Text>
               </View>

               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Transacciones</Text>
                     <Tag size={16} color="#2563eb" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#2563eb' }]}>{globalTransactions}</Text>
                  <Text style={styles.kpiSub}>Tickets emitidos</Text>
               </View>

               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Líder Actual</Text>
                     <Crown size={16} color="#eab308" />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1}>{topSeller ? topSeller.sellerName : 'N/A'}</Text>
                  <Text style={styles.kpiSub}>{topSeller ? `$${safeFixed(topSeller.totalVolume)}` : 'Sin registros'}</Text>
               </View>
            </View>

            <Text style={styles.sectionTitle}>Ranking y Contribución por Vendedor</Text>

            {sellersData.length === 0 ? (
               <View style={styles.emptyContainer}>
                  <Users size={48} color="#e2e8f0" />
                  <Text style={styles.emptyTitle}>No hay datos en este periodo</Text>
                  <Text style={styles.emptySubtitle}>Las ventas y apartados procesados aparecerán aquí para medir el rendimiento de tu equipo.</Text>
               </View>
            ) : (
               sellersData.map((seller, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;

                  const contributionPct = globalVolume > 0 ? (seller.totalVolume / globalVolume) * 100 : 0;

                  return (
                     <TouchableOpacity
                        key={seller.sellerId}
                        style={[
                           styles.sellerCard,
                           isFirst && styles.sellerCardGold,
                           isSecond && styles.sellerCardSilver,
                           isThird && styles.sellerCardBronze,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setSelectedSeller(seller)}
                     >
                        <View style={styles.sellerMainRow}>
                           <View style={[styles.rankBadge, isFirst && styles.rankBadgeGold, isSecond && styles.rankBadgeSilver, isThird && styles.rankBadgeBronze]}>
                              {isFirst ? <Crown size={16} color="#ffffff" /> :
                                 isSecond ? <Medal size={16} color="#ffffff" /> :
                                    isThird ? <Medal size={16} color="#ffffff" /> :
                                       <Text style={styles.rankBadgeText}>#{index + 1}</Text>}
                           </View>

                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.sellerNameText}>{seller.sellerName}</Text>
                              <Text style={styles.sellerSubText}>
                                 {seller.totalSalesCount} ventas | {seller.totalLayawaysCount} apartados
                              </Text>
                           </View>

                           <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                              <Text style={[styles.sellerVolumeText, isFirst && { color: '#ca8a04' }]}>
                                 ${safeFixed(seller.totalVolume)}
                              </Text>
                              <Text style={styles.sellerTransactionsText}>
                                 {seller.totalSalesCount + seller.totalLayawaysCount} ops.
                              </Text>
                           </View>
                           <ChevronRight size={18} color="#94a3b8" />
                        </View>

                        <View style={styles.contributionContainer}>
                           <View style={styles.contributionHeader}>
                              <Text style={styles.contributionLabel}>Aporte a la tienda</Text>
                              <Text style={styles.contributionPct}>{safeFixed(contributionPct, 1)}%</Text>
                           </View>
                           <View style={styles.progressBarBg}>
                              <View style={[
                                 styles.progressBarFill,
                                 { width: `${Math.min(contributionPct, 100)}%` },
                                 isFirst && { backgroundColor: '#eab308' },
                                 isSecond && { backgroundColor: '#94a3b8' },
                                 isThird && { backgroundColor: '#d97706' }
                              ]} />
                           </View>
                        </View>

                        <View style={[styles.sellerStatsBar, (isFirst || isSecond || isThird) && { borderTopColor: 'rgba(0,0,0,0.05)' }]}>
                           <View style={styles.miniStat}>
                              <ShoppingBag size={12} color={isFirst ? '#ca8a04' : "#16a34a"} />
                              <Text style={styles.miniStatText}>Ventas: ${safeFixed(seller.totalSalesAmount)}</Text>
                           </View>
                           <View style={styles.miniStat}>
                              <Clock size={12} color={isFirst ? '#ca8a04' : "#2563eb"} />
                              <Text style={styles.miniStatText}>Apartados: ${safeFixed(seller.totalLayawaysAmount)}</Text>
                           </View>
                           <View style={styles.miniStat}>
                              <Receipt size={12} color={isFirst ? '#ca8a04' : "#64748b"} />
                              <Text style={styles.miniStatText}>Ticket: ${safeFixed(seller.averageTicket)}</Text>
                           </View>
                        </View>
                     </TouchableOpacity>
                  );
               })
            )}
         </ScrollView>

         {/* MODAL DEL CALENDARIO */}
         <DateRangePickerModal
            visible={showDateRangeModal}
            initialRange={customDateRange}
            onClose={() => setShowDateRangeModal(false)}
            onApply={(range) => {
               setCustomDateRange(range);
               setSelectedPeriod('custom');
               setShowDateRangeModal(false);
            }}
         />

         {/* MODAL DETALLE INDIVIDUAL DEL VENDEDOR */}
         <Modal visible={!!selectedSeller} transparent animationType="slide">
            {selectedSeller && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                           <Award size={20} color="#2563eb" />
                           <Text style={styles.modalTitle}>{selectedSeller.sellerName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedSeller(null)} style={{ padding: 4 }}>
                           <X size={20} color="#64748b" />
                        </TouchableOpacity>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        <View style={styles.sellerDetailBox}>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Facturado:</Text>
                              <Text style={styles.detailValBold}>${safeFixed(selectedSeller.totalVolume)}</Text>
                           </View>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Operaciones:</Text>
                              <Text style={styles.detailVal}>{selectedSeller.totalSalesCount + selectedSeller.totalLayawaysCount}</Text>
                           </View>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Ticket Promedio:</Text>
                              <Text style={styles.detailVal}>${safeFixed(selectedSeller.averageTicket)}</Text>
                           </View>
                        </View>

                        <Text style={styles.sectionLabel}>Ventas Cerradas ({selectedSeller.completedSales.length}):</Text>
                        <View style={styles.historyList}>
                           {selectedSeller.completedSales.length === 0 ? (
                              <Text style={styles.emptySubText}>Sin ventas en este periodo.</Text>
                           ) : (
                              selectedSeller.completedSales.map((s) => (
                                 <TouchableOpacity
                                    key={s.id}
                                    style={styles.historyRowClickable}
                                    activeOpacity={0.7}
                                    onPress={() => setSelectedSaleToView(s)}
                                 >
                                    <View style={{ flex: 1 }}>
                                       <Text style={styles.historyTitle}>Recibo #{s.receiptNumber}</Text>
                                       <Text style={styles.historySub}>
                                          {new Date(s.createdAt).toLocaleDateString('es-ES')} - {s.paymentMethod.replace('_', ' ').toUpperCase()}
                                       </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                                       <Text style={styles.historyPrice}>${safeFixed(s.total)}</Text>
                                       <ChevronRight size={16} color="#cbd5e1" />
                                    </View>
                                 </TouchableOpacity>
                              ))
                           )}
                        </View>

                        <Text style={styles.sectionLabel}>Apartados ({selectedSeller.activeLayaways.length}):</Text>
                        <View style={[styles.historyList, { marginBottom: 30 }]}>
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

         {/* NUEVO MODAL: VISOR RÁPIDO DE RECIBO DE VENTA */}
         <Modal visible={!!selectedSaleToView} transparent animationType="fade">
            {selectedSaleToView && (
               <View style={styles.receiptOverlay}>
                  <View style={styles.receiptCard}>
                     <View style={styles.receiptModalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Receipt size={18} color="#2563eb" />
                           <Text style={styles.receiptModalTitle}>Detalle del Comprobante</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedSaleToView(null)} style={{ padding: 4 }}>
                           <X size={20} color="#64748b" />
                        </TouchableOpacity>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        <View style={styles.receiptHeaderBox}>
                           <Text style={styles.receiptMainTitle}>COMPROBANTE DE VENTA</Text>
                           <Text style={styles.receiptNumberText}>#{selectedSaleToView.receiptNumber}</Text>
                           <Text style={styles.receiptDateText}>{formatDateTime(selectedSaleToView.createdAt)}</Text>
                        </View>

                        <View style={styles.infoGrid}>
                           {selectedSaleToView.sellerName && (
                              <View style={styles.infoCol}>
                                 <Text style={styles.infoLabel}>Vendedor:</Text>
                                 <Text style={styles.infoVal}>{selectedSaleToView.sellerName}</Text>
                              </View>
                           )}
                           {selectedSaleToView.customerName && (
                              <View style={styles.infoCol}>
                                 <Text style={styles.infoLabel}>Cliente:</Text>
                                 <Text style={styles.infoVal}>{selectedSaleToView.customerName}</Text>
                              </View>
                           )}
                        </View>

                        <Text style={styles.sectionLabel}>Prendas Adquiridas:</Text>
                        <View style={styles.itemsTable}>
                           {(selectedSaleToView.items || []).map((item, idx) => (
                              <View key={idx} style={styles.tableRow}>
                                 <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.itemTitle}>{item.brand} - {item.name}</Text>
                                    <Text style={styles.itemSub}>Ref: {item.productCode || item.productId}</Text>
                                    <Text style={styles.itemSub}>Color: {item.color} | Talla: {item.size}</Text>
                                    <Text style={styles.itemSubTextBold}>Cant: {item.quantity} x ${safeFixed(item.unitPrice)}</Text>
                                 </View>
                                 <Text style={styles.itemTotal}>${safeFixed(item.totalPrice)}</Text>
                              </View>
                           ))}
                        </View>

                        <View style={styles.totalsBox}>
                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>Subtotal:</Text>
                              <Text style={styles.totalVal}>${safeFixed(selectedSaleToView.subtotal)}</Text>
                           </View>
                           {Number(selectedSaleToView.discount) > 0 && (
                              <View style={styles.totalRow}>
                                 <Text style={styles.totalLabel}>Descuento:</Text>
                                 <Text style={styles.discountVal}>-${safeFixed(selectedSaleToView.discount)}</Text>
                              </View>
                           )}
                           <View style={[styles.totalRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                              <Text style={styles.finalTotalLabel}>TOTAL:</Text>
                              <Text style={styles.finalTotalVal}>${safeFixed(selectedSaleToView.total)}</Text>
                           </View>
                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>Método de Pago:</Text>
                              <Text style={styles.paymentVal}>{(selectedSaleToView.paymentMethod || '').replace('_', ' ').toUpperCase()}</Text>
                           </View>
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
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
   headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

   filterSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   periodTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   periodTabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   periodTabText: { fontSize: 12, color: '#475569', fontWeight: '600' },
   periodTabTextActive: { color: '#ffffff', fontWeight: 'bold' },

   scrollContent: { padding: 16, paddingBottom: 40 },

   kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
   kpiCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
   kpiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' },
   kpiValue: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginVertical: 6 },
   kpiSub: { fontSize: 10, color: '#94a3b8' },

   sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12, letterSpacing: -0.3 },

   sellerCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
   sellerCardGold: { borderColor: '#fef08a', backgroundColor: '#fefce8' },
   sellerCardSilver: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
   sellerCardBronze: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },

   sellerMainRow: { flexDirection: 'row', alignItems: 'center' },
   rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
   rankBadgeGold: { backgroundColor: '#eab308', shadowColor: '#eab308', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
   rankBadgeSilver: { backgroundColor: '#94a3b8' },
   rankBadgeBronze: { backgroundColor: '#d97706' },
   rankBadgeText: { fontSize: 12, fontWeight: '900', color: '#475569' },

   sellerNameText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
   sellerSubText: { fontSize: 11, color: '#64748b', marginTop: 2 },
   sellerVolumeText: { fontSize: 16, fontWeight: '900', color: '#16a34a' },
   sellerTransactionsText: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textAlign: 'right' },

   contributionContainer: { marginTop: 12, paddingHorizontal: 2 },
   contributionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
   contributionLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' },
   contributionPct: { fontSize: 10, color: '#0f172a', fontWeight: '900' },
   progressBarBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
   progressBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },

   sellerStatsBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
   miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   miniStatText: { fontSize: 11, color: '#475569', fontWeight: '600' },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
   emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginTop: 12 },
   emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, maxWidth: 300, lineHeight: 18 },

   /* MODAL VENDEDOR */
   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', elevation: 10 },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },

   sellerDetailBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 16 },
   detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
   detailLabel: { fontSize: 12, color: '#1e40af', fontWeight: 'bold' },
   detailVal: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' },
   detailValBold: { fontSize: 20, color: '#16a34a', fontWeight: '900' },

   sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginTop: 8, marginBottom: 8 },
   historyList: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
   historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   historyRowClickable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff', paddingHorizontal: 8, borderRadius: 8, marginBottom: 4 },
   historyTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
   historySub: { fontSize: 11, color: '#64748b' },
   historyPrice: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
   emptySubText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' },

   /* NUEVO: ESTILOS DEL MODAL DE RECIBO */
   receiptOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   receiptCard: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', elevation: 15 },
   receiptModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   receiptModalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   receiptHeaderBox: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   receiptMainTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 1 },
   receiptNumberText: { fontSize: 26, fontWeight: '900', color: '#2563eb', marginVertical: 4 },
   receiptDateText: { fontSize: 12, color: '#94a3b8' },
   infoGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   infoCol: { flex: 1 },
   infoLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' },
   infoVal: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },

   itemsTable: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
   tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   itemTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
   itemSub: { fontSize: 11, color: '#64748b', marginBottom: 2 },
   itemSubTextBold: { fontSize: 11, color: '#0f172a', fontWeight: 'bold', marginTop: 2 },
   itemTotal: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },

   totalsBox: { marginTop: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
   totalLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
   totalVal: { fontSize: 13, color: '#0f172a', fontWeight: 'bold' },
   discountVal: { fontSize: 13, color: '#ef4444', fontWeight: 'bold' },
   finalTotalLabel: { fontSize: 15, color: '#0f172a', fontWeight: 'bold' },
   finalTotalVal: { fontSize: 20, color: '#16a34a', fontWeight: '900' },
   paymentVal: { fontSize: 12, color: '#2563eb', fontWeight: 'bold' },
});

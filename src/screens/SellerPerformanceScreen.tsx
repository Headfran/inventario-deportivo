import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   Pressable,
   StyleSheet,
   Modal,
   useWindowDimensions,
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
   CalendarRange,
} from 'lucide-react-native';
import { Sale, subscribeToSales } from '../services/salesHistoryService';
import { Layaway, subscribeToLayaways } from '../services/layawayService';
import {
   SellerMetrics,
   TimePeriod,
   computeSellerPerformance,
} from '../services/sellerPerformanceService';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { MONO as T, display } from '../design';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${date.getFullYear()}`;
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

const toDate = (createdAt: any): Date => {
   if (!createdAt) return new Date(0);
   if (typeof createdAt.toDate === 'function') return createdAt.toDate();
   if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
   return new Date(createdAt);
};

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const SellerPerformanceScreen: React.FC = () => {
   const { width } = useWindowDimensions();
   const mobile = width < 600;

   const [sales, setSales] = useState<Sale[]>([]);
   const [layaways, setLayaways] = useState<Layaway[]>([]);
   const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');

   const [selectedSeller, setSelectedSeller] = useState<SellerMetrics | null>(null);
   const [selectedSaleToView, setSelectedSaleToView] = useState<Sale | null>(null);

   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

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
         {/* HEADER BANNER NEGRO */}
         <View style={styles.header}>
            <View style={styles.headerLeft}>
               <View style={styles.headerIconBox}>
                  <Users size={22} color={T.onBar} />
               </View>
               <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.headerTitle, mobile && styles.headerTitleMobile]}>
                     Rendimiento
                  </Text>
                  <Text style={styles.headerSubtitle}>Ranking y contribución del equipo</Text>
               </View>
            </View>

            <View style={styles.headerMetric}>
               <Text style={styles.headerMetricLabel}>Total</Text>
               <Text style={styles.headerMetricValue}>${safeFixed(globalVolume)}</Text>
            </View>
         </View>

         {/* FILTROS DE PERIODO */}
         <View style={styles.filterSection}>
            <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={{ gap: 6 }}
            >
               <P
                  style={[styles.periodTab, selectedPeriod === 'today' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('today')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'today' && styles.periodTabTextActive]}>
                     Hoy
                  </Text>
               </P>
               <P
                  style={[styles.periodTab, selectedPeriod === 'week' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('week')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'week' && styles.periodTabTextActive]}>
                     Semana
                  </Text>
               </P>
               <P
                  style={[styles.periodTab, selectedPeriod === 'month' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('month')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'month' && styles.periodTabTextActive]}>
                     Mes
                  </Text>
               </P>
               <P
                  style={[styles.periodTab, selectedPeriod === 'all' && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod('all')}
               >
                  <Text style={[styles.periodTabText, selectedPeriod === 'all' && styles.periodTabTextActive]}>
                     Historial
                  </Text>
               </P>
               <P
                  style={[styles.periodTab, styles.periodTabCustom, selectedPeriod === 'custom' && styles.periodTabActive]}
                  onPress={() => setShowDateRangeModal(true)}
               >
                  <CalendarRange size={13} color={selectedPeriod === 'custom' ? T.onSolid : T.inkSoft} />
                  <Text style={[styles.periodTabText, selectedPeriod === 'custom' && styles.periodTabTextActive]}>
                     {selectedPeriod === 'custom' && customDateRange
                        ? formatDateShort(customDateRange.start)
                        : 'Rango'}
                  </Text>
               </P>
            </ScrollView>
         </View>

         <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* KPIs GLOBALES */}
            <View style={styles.kpiGrid}>
               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Facturación</Text>
                     <View style={styles.kpiIconBox}>
                        <TrendingUp size={14} color={T.ink} />
                     </View>
                  </View>
                  <Text style={styles.kpiValue}>${safeFixed(globalVolume)}</Text>
                  <Text style={styles.kpiSub}>Ventas + Apartados</Text>
               </View>

               <View style={styles.kpiCard}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={styles.kpiLabel}>Operaciones</Text>
                     <View style={styles.kpiIconBox}>
                        <Tag size={14} color={T.ink} />
                     </View>
                  </View>
                  <Text style={styles.kpiValue}>{globalTransactions}</Text>
                  <Text style={styles.kpiSub}>Tickets emitidos</Text>
               </View>

               <View style={[styles.kpiCard, styles.kpiCardHero]}>
                  <View style={styles.kpiHeaderRow}>
                     <Text style={[styles.kpiLabel, { color: 'rgba(255,255,255,0.7)' }]}>Líder</Text>
                     <View style={[styles.kpiIconBox, styles.kpiIconBoxHero]}>
                        <Crown size={14} color={T.onSolid} />
                     </View>
                  </View>
                  <Text
                     style={[styles.kpiValue, { color: T.onSolid }]}
                     numberOfLines={1}
                  >
                     {topSeller ? topSeller.sellerName : 'N/A'}
                  </Text>
                  <Text style={[styles.kpiSub, { color: 'rgba(255,255,255,0.65)' }]}>
                     {topSeller ? `$${safeFixed(topSeller.totalVolume)}` : 'Sin registros'}
                  </Text>
               </View>
            </View>

            <Text style={styles.sectionTitle}>Ranking por Vendedor</Text>

            {sellersData.length === 0 ? (
               <View style={styles.emptyContainer}>
                  <Users size={44} color={T.inkMute} />
                  <Text style={styles.emptyTitle}>Sin datos en este periodo</Text>
                  <Text style={styles.emptySubtitle}>
                     Las ventas y apartados procesados aparecerán aquí para medir el rendimiento de tu equipo.
                  </Text>
               </View>
            ) : (
               sellersData.map((seller, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;
                  const isTopThree = isFirst || isSecond || isThird;

                  const contributionPct = globalVolume > 0 ? (seller.totalVolume / globalVolume) * 100 : 0;

                  const rankBadgeStyle = isFirst
                     ? styles.rankBadgeGold
                     : isSecond
                        ? styles.rankBadgeSilver
                        : isThird
                           ? styles.rankBadgeBronze
                           : null;

                  const barFillStyle = isFirst
                     ? styles.barFillGold
                     : isSecond
                        ? styles.barFillSilver
                        : isThird
                           ? styles.barFillBronze
                           : null;

                  return (
                     <P
                        key={seller.sellerId}
                        style={[styles.sellerCard, isTopThree && styles.sellerCardTop]}
                        onPress={() => setSelectedSeller(seller)}
                     >
                        <View style={styles.sellerMainRow}>
                           <View style={[styles.rankBadge, rankBadgeStyle]}>
                              {isFirst ? (
                                 <Crown size={16} color={T.onSolid} />
                              ) : isSecond || isThird ? (
                                 <Medal size={16} color={T.onSolid} />
                              ) : (
                                 <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                              )}
                           </View>

                           <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                              <Text style={styles.sellerNameText} numberOfLines={1}>
                                 {seller.sellerName}
                              </Text>
                              <Text style={styles.sellerSubText}>
                                 {seller.totalSalesCount} ventas · {seller.totalLayawaysCount} apartados
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
                           <ChevronRight size={18} color={T.inkMute} />
                        </View>

                        <View style={styles.contributionContainer}>
                           <View style={styles.contributionHeader}>
                              <Text style={styles.contributionLabel}>Aporte a la tienda</Text>
                              <Text style={styles.contributionPct}>{safeFixed(contributionPct, 1)}%</Text>
                           </View>
                           <View style={styles.progressBarBg}>
                              <View
                                 style={[
                                    styles.progressBarFill,
                                    barFillStyle,
                                    { width: `${Math.min(contributionPct, 100)}%` },
                                 ]}
                              />
                           </View>
                        </View>

                        <View style={styles.sellerStatsBar}>
                           <View style={styles.miniStat}>
                              <ShoppingBag size={12} color={T.inkMute} />
                              <Text style={styles.miniStatText}>
                                 Ventas: ${safeFixed(seller.totalSalesAmount)}
                              </Text>
                           </View>
                           <View style={styles.miniStat}>
                              <Clock size={12} color={T.inkMute} />
                              <Text style={styles.miniStatText}>
                                 Apart.: ${safeFixed(seller.totalLayawaysAmount)}
                              </Text>
                           </View>
                           <View style={styles.miniStat}>
                              <Receipt size={12} color={T.inkMute} />
                              <Text style={styles.miniStatText}>
                                 Ticket: ${safeFixed(seller.averageTicket)}
                              </Text>
                           </View>
                        </View>
                     </P>
                  );
               })
            )}
         </ScrollView>

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

         {/* MODAL DETALLE VENDEDOR */}
         <Modal visible={!!selectedSeller} transparent animationType="slide">
            {selectedSeller && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                           <Award size={20} color={T.onBar} />
                           <Text style={styles.modalTitle} numberOfLines={1}>
                              {selectedSeller.sellerName}
                           </Text>
                        </View>
                        <P onPress={() => setSelectedSeller(null)}>
                           <X size={20} color={T.onBar} />
                        </P>
                     </View>

                     <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
                        {/* RESUMEN DEL VENDEDOR */}
                        <View style={styles.sellerDetailBox}>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Facturado</Text>
                              <Text style={styles.detailValBold}>
                                 ${safeFixed(selectedSeller.totalVolume)}
                              </Text>
                           </View>
                           <View style={styles.dividerDashed} />
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Total Operaciones</Text>
                              <Text style={styles.detailVal}>
                                 {selectedSeller.totalSalesCount + selectedSeller.totalLayawaysCount}
                              </Text>
                           </View>
                           <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Ticket Promedio</Text>
                              <Text style={styles.detailVal}>
                                 ${safeFixed(selectedSeller.averageTicket)}
                              </Text>
                           </View>
                        </View>

                        <Text style={styles.sectionLabel}>
                           Ventas Cerradas ({selectedSeller.completedSales.length})
                        </Text>
                        <View style={styles.historyList}>
                           {selectedSeller.completedSales.length === 0 ? (
                              <Text style={styles.emptySubText}>Sin ventas en este periodo.</Text>
                           ) : (
                              selectedSeller.completedSales.map((s) => (
                                 <P
                                    key={s.id}
                                    style={styles.historyRowClickable}
                                    onPress={() => setSelectedSaleToView(s)}
                                 >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                       <Text style={styles.historyTitle} numberOfLines={1}>
                                          Recibo #{s.receiptNumber}
                                       </Text>
                                       <Text style={styles.historySub}>
                                          {toDate(s.createdAt).toLocaleDateString('es-ES')} ·{' '}
                                          {(s.paymentMethod || '').replace('_', ' ').toUpperCase()}
                                       </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                                       <Text style={styles.historyPrice}>${safeFixed(s.total)}</Text>
                                       <ChevronRight size={16} color={T.inkMute} />
                                    </View>
                                 </P>
                              ))
                           )}
                        </View>

                        <Text style={styles.sectionLabel}>
                           Apartados ({selectedSeller.activeLayaways.length})
                        </Text>
                        <View style={[styles.historyList, { marginBottom: 20 }]}>
                           {selectedSeller.activeLayaways.length === 0 ? (
                              <Text style={styles.emptySubText}>Sin apartados en este periodo.</Text>
                           ) : (
                              selectedSeller.activeLayaways.map((l) => (
                                 <View key={l.id} style={styles.historyRow}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                       <Text style={styles.historyTitle} numberOfLines={1}>
                                          Apartado #{l.code}
                                       </Text>
                                       <Text style={styles.historySub} numberOfLines={1}>
                                          Cliente: {l.customerName} · Abonado: ${safeFixed(l.totalPaid)}
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

         {/* MODAL DETALLE RECIBO */}
         <Modal visible={!!selectedSaleToView} transparent animationType="fade">
            {selectedSaleToView && (
               <View style={styles.modalOverlay}>
                  <View style={styles.receiptCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                           <Receipt size={20} color={T.onBar} />
                           <Text style={styles.modalTitle} numberOfLines={1}>
                              Detalle del Comprobante
                           </Text>
                        </View>
                        <P onPress={() => setSelectedSaleToView(null)}>
                           <X size={20} color={T.onBar} />
                        </P>
                     </View>

                     <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
                        <View style={styles.ticketBox}>
                           <View style={styles.ticketHeader}>
                              <Text style={styles.ticketMainTitle}>COMPROBANTE DE VENTA</Text>
                              <Text style={styles.ticketNumber}>
                                 #{selectedSaleToView.receiptNumber}
                              </Text>
                              <Text style={styles.ticketMeta}>
                                 {formatDateTime(selectedSaleToView.createdAt)}
                              </Text>
                           </View>

                           {(selectedSaleToView.sellerName || selectedSaleToView.customerName) && (
                              <>
                                 <View style={styles.dividerDashed} />
                                 {selectedSaleToView.sellerName && (
                                    <View style={styles.ticketRow}>
                                       <Text style={styles.ticketLabel}>Vendedor:</Text>
                                       <Text style={styles.ticketVal}>
                                          {selectedSaleToView.sellerName}
                                       </Text>
                                    </View>
                                 )}
                                 {selectedSaleToView.customerName && (
                                    <View style={styles.ticketRow}>
                                       <Text style={styles.ticketLabel}>Cliente:</Text>
                                       <Text style={styles.ticketVal}>
                                          {selectedSaleToView.customerName}
                                       </Text>
                                    </View>
                                 )}
                              </>
                           )}

                           <View style={styles.dividerDashed} />
                           <Text style={styles.itemsTitle}>
                              Detalle de Artículos ({selectedSaleToView.items.length}):
                           </Text>

                           {(selectedSaleToView.items || []).map((item, idx) => (
                              <View key={idx} style={styles.itemRow}>
                                 <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.itemName} numberOfLines={1}>
                                       {item.brand} - {item.name}
                                    </Text>
                                    <Text style={styles.itemSpec}>
                                       Ref: {item.productCode || item.productId}
                                    </Text>
                                    <Text style={styles.itemSpec}>
                                       {item.color} · Talla: {item.size}
                                    </Text>
                                    <Text style={styles.itemSpec}>
                                       {item.quantity} x ${safeFixed(item.unitPrice)}
                                    </Text>
                                 </View>
                                 <Text style={styles.itemSubtotal}>
                                    ${safeFixed(item.totalPrice)}
                                 </Text>
                              </View>
                           ))}

                           <View style={styles.dividerDashed} />

                           <View style={styles.ticketRow}>
                              <Text style={styles.ticketLabel}>Subtotal:</Text>
                              <Text style={styles.ticketVal}>
                                 ${safeFixed(selectedSaleToView.subtotal)}
                              </Text>
                           </View>
                           {Number(selectedSaleToView.discount) > 0 && (
                              <View style={styles.ticketRow}>
                                 <Text style={styles.ticketLabel}>Descuento:</Text>
                                 <Text style={[styles.ticketVal, { color: '#DC2626' }]}>
                                    -${safeFixed(selectedSaleToView.discount)}
                                 </Text>
                              </View>
                           )}
                           <View style={styles.ticketRow}>
                              <Text style={styles.ticketLabel}>Método de Pago:</Text>
                              <Text style={styles.ticketVal}>
                                 {(selectedSaleToView.paymentMethod || '')
                                    .replace('_', ' ')
                                    .toUpperCase()}
                              </Text>
                           </View>

                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>TOTAL:</Text>
                              <Text style={styles.totalValue}>
                                 ${safeFixed(selectedSaleToView.total)}
                              </Text>
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
   container: { flex: 1, backgroundColor: T.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   // Header banner
   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 18,
      backgroundColor: T.bar,
      gap: 12,
      flexWrap: 'wrap',
   },
   headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 },
   headerIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
   },
   headerTitle: {
      ...display,
      fontSize: 26,
      lineHeight: 26,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },
   headerTitleMobile: { fontSize: 22, lineHeight: 22 },
   headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
   headerMetric: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'flex-end',
   },
   headerMetricLabel: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.65)',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   headerMetricValue: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.onBar,
      marginTop: 2,
   },

   // Filter section
   filterSection: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: T.surface,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
   },
   periodTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
   },
   periodTabCustom: { paddingHorizontal: 12 },
   periodTabActive: { backgroundColor: T.solid, borderColor: T.solid },
   periodTabText: { fontSize: 12, color: T.inkSoft, fontWeight: '700' },
   periodTabTextActive: { color: T.onSolid, fontWeight: '800' },

   // KPIs
   scrollContent: { padding: 16, paddingBottom: 60 },
   kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
   kpiCard: {
      flexGrow: 1,
      flexBasis: 140,
      minWidth: 140,
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: T.line,
   },
   kpiCardHero: { backgroundColor: T.bar, borderColor: T.bar },
   kpiHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
   },
   kpiLabel: {
      fontSize: 11,
      color: T.inkMute,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   kpiIconBox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      alignItems: 'center',
      justifyContent: 'center',
   },
   kpiIconBoxHero: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderColor: 'rgba(255,255,255,0.3)',
   },
   kpiValue: {
      ...display,
      fontSize: 24,
      lineHeight: 26,
      fontWeight: '800',
      color: T.ink,
      marginVertical: 8,
   },
   kpiSub: { fontSize: 11, color: T.inkMute },

   sectionTitle: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.ink,
      marginBottom: 12,
      textTransform: 'uppercase',
   },

   // Seller cards
   sellerCard: {
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: T.line,
   },
   sellerCardTop: { backgroundColor: T.bg },
   sellerMainRow: { flexDirection: 'row', alignItems: 'center' },

   rankBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: T.surface,
      borderWidth: 1,
      borderColor: T.line,
      justifyContent: 'center',
      alignItems: 'center',
   },
   rankBadgeGold: { backgroundColor: '#EAB308', borderColor: '#EAB308' },
   rankBadgeSilver: { backgroundColor: '#94A3B8', borderColor: '#94A3B8' },
   rankBadgeBronze: { backgroundColor: '#D97706', borderColor: '#D97706' },
   rankBadgeText: { fontSize: 12, fontWeight: '800', color: T.inkMute },

   sellerNameText: { fontSize: 15, fontWeight: '800', color: T.ink },
   sellerSubText: { fontSize: 11, color: T.inkMute, marginTop: 2 },
   sellerVolumeText: {
      ...display,
      fontSize: 18,
      lineHeight: 18,
      fontWeight: '800',
      color: T.ink,
   },
   sellerTransactionsText: {
      fontSize: 10,
      fontWeight: '700',
      color: T.inkMute,
      textAlign: 'right',
      marginTop: 2,
   },

   contributionContainer: { marginTop: 12 },
   contributionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
   },
   contributionLabel: {
      fontSize: 10,
      color: T.inkMute,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   contributionPct: { fontSize: 10, color: T.ink, fontWeight: '800' },
   progressBarBg: {
      height: 6,
      backgroundColor: T.line,
      borderRadius: 3,
      overflow: 'hidden',
   },
   progressBarFill: { height: '100%', backgroundColor: T.solid, borderRadius: 3 },
   barFillGold: { backgroundColor: '#EAB308' },
   barFillSilver: { backgroundColor: '#94A3B8' },
   barFillBronze: { backgroundColor: '#D97706' },

   sellerStatsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: T.line,
   },
   miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   miniStatText: { fontSize: 11, color: T.inkSoft, fontWeight: '600' },

   // Empty
   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
   emptyTitle: {
      ...display,
      fontSize: 22,
      fontWeight: '800',
      color: T.ink,
      marginTop: 12,
      textTransform: 'uppercase',
      textAlign: 'center',
   },
   emptySubtitle: {
      fontSize: 13,
      color: T.inkMute,
      textAlign: 'center',
      marginTop: 6,
      maxWidth: 320,
      lineHeight: 18,
   },

   // Modal shared
   modalOverlay: {
      flex: 1,
      backgroundColor: T.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
   },
   modalCard: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '90%',
      backgroundColor: T.bg,
      borderRadius: 16,
      overflow: 'hidden',
   },
   modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: T.bar,
   },
   modalTitle: {
      ...display,
      fontSize: 18,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },

   // Seller detail box
   sellerDetailBox: {
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: T.line,
      marginBottom: 16,
   },
   detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
   },
   detailLabel: {
      fontSize: 12,
      color: T.inkSoft,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
   },
   detailVal: { fontSize: 14, color: T.ink, fontWeight: '800' },
   detailValBold: {
      ...display,
      fontSize: 24,
      lineHeight: 24,
      fontWeight: '800',
      color: T.ink,
   },

   dividerDashed: {
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(0,0,0,0.25)',
      marginVertical: 10,
   },

   // History lists
   sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: T.inkSoft,
      marginTop: 4,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   historyList: {
      backgroundColor: T.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: T.line,
      padding: 8,
   },
   historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
      gap: 8,
   },
   historyRowClickable: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: T.bg,
      borderRadius: 8,
      marginBottom: 4,
      gap: 8,
   },
   historyTitle: { fontSize: 13, fontWeight: '800', color: T.ink, marginBottom: 2 },
   historySub: { fontSize: 11, color: T.inkMute },
   historyPrice: {
      ...display,
      fontSize: 16,
      lineHeight: 16,
      fontWeight: '800',
      color: T.ink,
   },
   emptySubText: {
      fontSize: 12,
      color: T.inkMute,
      fontStyle: 'italic',
      paddingVertical: 8,
      textAlign: 'center',
   },

   // Receipt modal
   receiptCard: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '90%',
      backgroundColor: T.bg,
      borderRadius: 16,
      overflow: 'hidden',
   },
   ticketBox: { backgroundColor: T.surface, borderRadius: 12, padding: 16 },
   ticketHeader: { alignItems: 'center', marginBottom: 4 },
   ticketMainTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: T.inkMute,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
   },
   ticketNumber: {
      ...display,
      fontSize: 32,
      lineHeight: 32,
      fontWeight: '800',
      color: T.ink,
      marginVertical: 6,
   },
   ticketMeta: { fontSize: 12, color: T.inkMute },
   ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   ticketLabel: { fontSize: 13, color: T.inkSoft },
   ticketVal: { fontSize: 13, fontWeight: '700', color: T.ink },
   itemsTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: T.inkSoft,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
      gap: 10,
   },
   itemName: { fontSize: 14, fontWeight: '700', color: T.ink },
   itemSpec: { fontSize: 12, color: T.inkMute },
   itemSubtotal: { fontSize: 14, fontWeight: '800', color: T.ink },
   totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: T.line,
   },
   totalLabel: { fontSize: 13, fontWeight: '800', color: T.inkSoft, paddingBottom: 6 },
   totalValue: { ...display, fontSize: 40, lineHeight: 40, fontWeight: '800', color: T.ink },
});

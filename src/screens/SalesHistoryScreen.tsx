import React, { useState, useEffect, useMemo } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   TextInput,
   Modal,
   FlatList,
   Alert,
} from 'react-native';
import {
   Search,
   Receipt,
   Printer,
   MessageCircle,
   X,
   Calendar,
   User,
   XCircle,
   AlertTriangle,
   FileText,
   CalendarDays,
   Filter,
   DollarSign,
   Banknote
} from 'lucide-react-native';
import {
   Sale,
   subscribeToSales,
   voidSale,
   formatDateTime,
} from '../services/salesHistoryService';

// IMPORTA TU NUEVO COMPONENTE
import { DateRangePickerModal } from '../components/DateRangePickerModal';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

// Helpers de Fechas
const getSaleDate = (createdAt: any): Date => {
   if (!createdAt) return new Date(0);
   if (typeof createdAt.toDate === 'function') return createdAt.toDate();
   if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
   return new Date(createdAt);
};

const getStartOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

export const SalesHistoryScreen: React.FC = () => {
   const [sales, setSales] = useState<Sale[]>([]);
   const [searchQuery, setSearchQuery] = useState('');

   // Estados de Filtros
   const [selectedDateFilter, setSelectedDateFilter] = useState<string>('today');
   const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
   const [selectedStatus, setSelectedStatus] = useState<string>('completed');
   const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

   // ESTADOS PARA EL NUEVO COMPONENTE
   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date, end: Date } | null>(null);

   // Estados de Modales de Venta
   const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
   const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
   const [voidReason, setVoidReason] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
      const unsub = subscribeToSales(setSales);
      return () => unsub();
   }, []);

   const filteredSales = useMemo(() => {
      return sales.filter((sale) => {
         const queryLower = searchQuery.toLowerCase().trim();
         const matchesQuery =
            !queryLower ||
            (sale.receiptNumber && sale.receiptNumber.toLowerCase().includes(queryLower)) ||
            (sale.customerName && sale.customerName.toLowerCase().includes(queryLower)) ||
            (sale.sellerName && sale.sellerName.toLowerCase().includes(queryLower)) ||
            (sale.customerPhone && sale.customerPhone.includes(queryLower)) ||
            (sale.items && sale.items.some(item =>
               (item.productCode && item.productCode.toLowerCase().includes(queryLower)) ||
               item.productId.toLowerCase().includes(queryLower)
            ));

         const matchesPayment = selectedPaymentMethod === 'all' || sale.paymentMethod === selectedPaymentMethod;
         const matchesStatus = selectedStatus === 'all' || sale.status === selectedStatus;

         let matchesDate = true;
         if (selectedDateFilter !== 'all') {
            const saleDate = getSaleDate(sale.createdAt);
            const today = getStartOfDay();

            if (selectedDateFilter === 'today') {
               matchesDate = saleDate >= today;
            } else if (selectedDateFilter === 'yesterday') {
               const yesterday = new Date(today);
               yesterday.setDate(yesterday.getDate() - 1);
               matchesDate = saleDate >= yesterday && saleDate < today;
            } else if (selectedDateFilter === 'week') {
               const lastWeek = new Date(today);
               lastWeek.setDate(lastWeek.getDate() - 7);
               matchesDate = saleDate >= lastWeek;
            } else if (selectedDateFilter === 'month') {
               const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
               matchesDate = saleDate >= firstOfMonth;
            } else if (selectedDateFilter === 'custom' && customDateRange) {
               matchesDate = saleDate >= customDateRange.start && saleDate <= customDateRange.end;
            }
         }

         return matchesQuery && matchesPayment && matchesStatus && matchesDate;
      }).sort((a, b) => getSaleDate(b.createdAt).getTime() - getSaleDate(a.createdAt).getTime());
   }, [sales, searchQuery, selectedDateFilter, selectedPaymentMethod, selectedStatus, customDateRange]);

   const totalRevenue = useMemo(() => {
      return filteredSales
         .filter(s => s.status !== 'voided')
         .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
   }, [filteredSales]);

   const activeSalesCount = filteredSales.filter(s => s.status !== 'voided').length;

   const handlePrintReceipt = (sale: Sale) => {
      if (typeof window !== 'undefined') {
         const printWindow = window.open('', '_blank', 'width=400,height=600');
         if (printWindow) {
            const itemsHtml = (sale.items || [])
               .map(
                  (item) => `
            <tr>
              <td style="padding: 6px 0; border-bottom: 1px dashed #ccc;">
                 ${item.brand} - ${item.name}<br/>
                 <small>Ref: ${item.productCode || item.productId} | ${item.color} | Talla ${item.size}</small><br/>
                 <small>${item.quantity} x $${safeFixed(item.unitPrice)}</small>
              </td>
              <td style="text-align: right; vertical-align: bottom; border-bottom: 1px dashed #ccc; padding-bottom: 6px;">
                 $${safeFixed(item.totalPrice)}
              </td>
            </tr>
          `
               ).join('');

            const formattedDate = formatDateTime(sale.createdAt, 'long');

            printWindow.document.write(`
          <html>
            <head>
              <title>Recibo #${sale.receiptNumber}</title>
              <style>
                body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 10px; width: 280px; }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                table { width: 100%; border-collapse: collapse; }
              </style>
            </head>
            <body>
              <div class="center bold" style="font-size: 14px;">MI TIENDA</div>
              <div class="center">Comprobante de Venta</div>
              <div class="center">#${sale.receiptNumber}</div>
              <div class="divider"></div>
              <div>Fecha: ${formattedDate}</div>
              ${sale.sellerName ? `<div>Vendedor: ${sale.sellerName}</div>` : ''}
              ${sale.customerName ? `<div>Cliente: ${sale.customerName}</div>` : ''}
              <div class="divider"></div>
              <table>
                ${itemsHtml}
              </table>
              <div class="divider"></div>
              <table>
                <tr><td>Subtotal:</td><td class="right">$${safeFixed(sale.subtotal)}</td></tr>
                ${Number(sale.discount) > 0 ? `<tr><td>Descuento:</td><td class="right">-$${safeFixed(sale.discount)}</td></tr>` : ''}
                <tr class="bold" style="font-size: 14px;"><td>TOTAL:</td><td class="right">$${safeFixed(sale.total)}</td></tr>
                <tr><td>Método:</td><td class="right">${(sale.paymentMethod || '').replace('_', ' ').toUpperCase()}</td></tr>
              </table>
              <div class="divider"></div>
              <div class="center bold">¡Gracias por su compra!</div>
              ${sale.status === 'voided' ? '<div class="center bold" style="margin-top:10px; color:red;">--- ANULADO ---</div>' : ''}
            </body>
          </html>
        `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 250);
         }
      }
   };

   const handleShareWhatsApp = (sale: Sale) => {
      const formattedDate = formatDateTime(sale.createdAt, 'short');
      let message = `🧾 *COMPROBANTE DE COMPRA*\n`;
      message += `*Recibo:* #${sale.receiptNumber}\n`;
      message += `*Fecha:* ${formattedDate}\n`;
      if (sale.customerName) message += `*Cliente:* ${sale.customerName}\n`;
      message += `----------------------------\n`;

      (sale.items || []).forEach((item) => {
         message += `• *${item.brand} - ${item.name}*\n  Ref: ${item.productCode || item.productId}\n  ${item.color}, Talla ${item.size}\n  Cant: ${item.quantity} x $${safeFixed(item.unitPrice)} = *$${safeFixed(item.totalPrice)}*\n\n`;
      });

      message += `----------------------------\n`;
      if (Number(sale.discount) > 0) message += `*Descuento:* -$${safeFixed(sale.discount)}\n`;
      message += `*TOTAL CANCELADO:* *$${safeFixed(sale.total)}*\n`;
      message += `*Método de Pago:* ${(sale.paymentMethod || '').replace('_', ' ').toUpperCase()}\n\n`;
      message += `¡Gracias por elegirnos! 🛍️`;

      const cleanPhone = (sale.customerPhone || '').replace(/[^0-9]/g, '');
      const url = cleanPhone
         ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
         : `https://wa.me/?text=${encodeURIComponent(message)}`;

      if (typeof window !== 'undefined') {
         window.open(url, '_blank');
      }
   };

   const handleConfirmVoid = async () => {
      if (!selectedSale) return;
      setIsProcessing(true);
      try {
         await voidSale(selectedSale, voidReason);
         setIsVoidModalOpen(false);
         setSelectedSale(null);
         setVoidReason('');
         Alert.alert('Éxito', 'La venta ha sido anulada y el stock ha retornado al inventario.');
      } catch (error) {
         Alert.alert('Error', 'No se pudo anular la venta. Inténtelo de nuevo.');
      } finally {
         setIsProcessing(false);
      }
   };

   const FilterChip = ({ label, isActive, onPress }: { label: string, isActive: boolean, onPress: () => void }) => (
      <TouchableOpacity style={[styles.chip, isActive && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
         <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
   );

   return (
      <View style={styles.container}>
         <View style={styles.header}>
            <View style={styles.headerLeft}>
               <Receipt size={24} color="#2563eb" style={{ marginRight: 10 }} />
               <View>
                  <Text style={styles.headerTitle}>Historial de Ventas</Text>
                  <Text style={styles.headerSubtitle}>Monitor de ingresos y recibos</Text>
               </View>
            </View>
            <View style={styles.metricsContainer}>
               <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Ingresos ({activeSalesCount})</Text>
                  <Text style={styles.metricValue}>${safeFixed(totalRevenue)}</Text>
               </View>
            </View>
         </View>

         <View style={styles.filterSection}>
            <View style={styles.searchRow}>
               <View style={styles.searchBar}>
                  <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar recibo, cliente, o Ref..."
                     placeholderTextColor="#94a3b8"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                     <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <X size={16} color="#94a3b8" />
                     </TouchableOpacity>
                  ) : null}
               </View>
               <TouchableOpacity
                  style={[styles.filterToggleBtn, showAdvancedFilters && styles.filterToggleBtnActive]}
                  onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
               >
                  <Filter size={18} color={showAdvancedFilters ? '#ffffff' : '#64748b'} />
               </TouchableOpacity>
            </View>

            <View style={styles.dateFilterRow}>
               <CalendarDays size={14} color="#64748b" style={{ marginRight: 8 }} />
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  <FilterChip label="Hoy" isActive={selectedDateFilter === 'today'} onPress={() => setSelectedDateFilter('today')} />
                  <FilterChip label="Ayer" isActive={selectedDateFilter === 'yesterday'} onPress={() => setSelectedDateFilter('yesterday')} />
                  <FilterChip label="7 Días" isActive={selectedDateFilter === 'week'} onPress={() => setSelectedDateFilter('week')} />
                  <FilterChip label="Este Mes" isActive={selectedDateFilter === 'month'} onPress={() => setSelectedDateFilter('month')} />
                  <FilterChip label="Todas" isActive={selectedDateFilter === 'all'} onPress={() => setSelectedDateFilter('all')} />

                  <TouchableOpacity style={[styles.chip, selectedDateFilter === 'custom' && styles.chipActive]} onPress={() => setShowDateRangeModal(true)}>
                     <Text style={[styles.chipText, selectedDateFilter === 'custom' && styles.chipTextActive]}>
                        Rango... {selectedDateFilter === 'custom' && customDateRange ? `(${formatDateShort(customDateRange.start)})` : ''}
                     </Text>
                  </TouchableOpacity>
               </ScrollView>
            </View>

            {showAdvancedFilters && (
               <View style={styles.advancedFiltersContainer}>
                  <View style={styles.filterGroup}>
                     <View style={styles.filterIconLabel}><DollarSign size={14} color="#64748b" /><Text style={styles.filterRowTitle}>Pago</Text></View>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                        <FilterChip label="Todos" isActive={selectedPaymentMethod === 'all'} onPress={() => setSelectedPaymentMethod('all')} />
                        <FilterChip label="Pago Móvil" isActive={selectedPaymentMethod === 'pago_movil'} onPress={() => setSelectedPaymentMethod('pago_movil')} />
                        <FilterChip label="Binance" isActive={selectedPaymentMethod === 'binance'} onPress={() => setSelectedPaymentMethod('binance')} />
                        <FilterChip label="Zelle" isActive={selectedPaymentMethod === 'zelle'} onPress={() => setSelectedPaymentMethod('zelle')} />
                        <FilterChip label="Efectivo" isActive={selectedPaymentMethod === 'efectivo'} onPress={() => setSelectedPaymentMethod('efectivo')} />
                        <FilterChip label="Transf." isActive={selectedPaymentMethod === 'transferencia'} onPress={() => setSelectedPaymentMethod('transferencia')} />
                        <FilterChip label="Mixto" isActive={selectedPaymentMethod === 'mixto'} onPress={() => setSelectedPaymentMethod('mixto')} />
                     </ScrollView>
                  </View>

                  <View style={styles.filterGroup}>
                     <View style={styles.filterIconLabel}><FileText size={14} color="#64748b" /><Text style={styles.filterRowTitle}>Estado</Text></View>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                        <FilterChip label="Completadas" isActive={selectedStatus === 'completed'} onPress={() => setSelectedStatus('completed')} />
                        <FilterChip label="Anuladas" isActive={selectedStatus === 'voided'} onPress={() => setSelectedStatus('voided')} />
                        <FilterChip label="Todas" isActive={selectedStatus === 'all'} onPress={() => setSelectedStatus('all')} />
                     </ScrollView>
                  </View>
               </View>
            )}
         </View>

         <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const isVoided = item.status === 'voided';
               return (
                  <TouchableOpacity style={[styles.saleCard, isVoided && styles.saleCardVoided]} activeOpacity={0.85} onPress={() => setSelectedSale(item)}>
                     <View style={styles.saleHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                           <View style={[styles.iconWrapper, isVoided ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#dcfce7' }]}>
                              <Banknote size={16} color={isVoided ? '#ef4444' : '#16a34a'} />
                           </View>
                           <View>
                              <Text style={[styles.receiptNum, isVoided && styles.textMuted]}>#{item.receiptNumber}</Text>
                              <Text style={styles.metaText}>{formatDateTime(item.createdAt, 'short')}</Text>
                           </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={[styles.saleTotal, isVoided && styles.textMuted]}>${safeFixed(item.total)}</Text>
                           {isVoided ? <Text style={styles.statusBadgeVoidedText}>ANULADA</Text> : <Text style={styles.statusBadgeCompletedText}>COMPLETADA</Text>}
                        </View>
                     </View>

                     <View style={styles.saleDetailsDivider} />

                     <View style={styles.saleMetaRow}>
                        {item.sellerName ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                              <User size={12} color="#64748b" />
                              <Text style={styles.metaText} numberOfLines={1}>{item.sellerName}</Text>
                           </View>
                        ) : <View style={{ flex: 1 }} />}

                        {item.customerName ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                              <Text style={styles.customerText} numberOfLines={1}>👤 {item.customerName}</Text>
                           </View>
                        ) : <View style={{ flex: 1 }} />}

                        <View style={styles.paymentTag}><Text style={styles.paymentTagText}>{(item.paymentMethod || '').replace('_', ' ').toUpperCase()}</Text></View>
                     </View>
                  </TouchableOpacity>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <FileText size={48} color="#e2e8f0" />
                  <Text style={styles.emptyTitle}>No hay ventas para este filtro</Text>
                  <Text style={styles.emptySubtitle}>Ajusta las fechas o el método de búsqueda para encontrar lo que necesitas.</Text>
               </View>
            }
         />

         {/* APLICAMOS TU NUEVO COMPONENTE EXTERNO */}
         <DateRangePickerModal
            visible={showDateRangeModal}
            initialRange={customDateRange}
            onClose={() => setShowDateRangeModal(false)}
            onApply={(range) => {
               setCustomDateRange(range);
               setSelectedDateFilter('custom');
               setShowDateRangeModal(false);
            }}
         />

         <Modal visible={!!selectedSale && !isVoidModalOpen} transparent animationType="slide">
            {selectedSale && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Receipt size={18} color="#2563eb" />
                           <Text style={styles.modalTitle}>Detalle del Comprobante</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedSale(null)} style={{ padding: 4 }}><X size={20} color="#64748b" /></TouchableOpacity>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        {selectedSale.status === 'voided' && (
                           <View style={styles.voidedAlertBox}>
                              <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 6 }} />
                              <Text style={styles.voidedAlertText}>Esta venta fue anulada y el stock fue restablecido.</Text>
                           </View>
                        )}

                        <View style={styles.receiptHeaderBox}>
                           <Text style={styles.receiptMainTitle}>COMPROBANTE DE VENTA</Text>
                           <Text style={styles.receiptNumberText}>#{selectedSale.receiptNumber}</Text>
                           <Text style={styles.receiptDateText}>{formatDateTime(selectedSale.createdAt, 'long')}</Text>
                        </View>

                        <View style={styles.infoGrid}>
                           {selectedSale.sellerName && (
                              <View style={styles.infoCol}><Text style={styles.infoLabel}>Vendedor:</Text><Text style={styles.infoVal}>{selectedSale.sellerName}</Text></View>
                           )}
                           {selectedSale.customerName && (
                              <View style={styles.infoCol}><Text style={styles.infoLabel}>Cliente:</Text><Text style={styles.infoVal}>{selectedSale.customerName}</Text></View>
                           )}
                        </View>

                        <Text style={styles.sectionLabel}>Prendas Adquiridas:</Text>
                        <View style={styles.itemsTable}>
                           {(selectedSale.items || []).map((item, idx) => (
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
                           <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal:</Text><Text style={styles.totalVal}>${safeFixed(selectedSale.subtotal)}</Text></View>
                           {Number(selectedSale.discount) > 0 && (
                              <View style={styles.totalRow}><Text style={styles.totalLabel}>Descuento:</Text><Text style={styles.discountVal}>-${safeFixed(selectedSale.discount)}</Text></View>
                           )}
                           <View style={[styles.totalRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                              <Text style={styles.finalTotalLabel}>TOTAL:</Text><Text style={styles.finalTotalVal}>${safeFixed(selectedSale.total)}</Text>
                           </View>
                           <View style={styles.totalRow}><Text style={styles.totalLabel}>Método de Pago:</Text><Text style={styles.paymentVal}>{(selectedSale.paymentMethod || '').replace('_', ' ').toUpperCase()}</Text></View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.actionBtnPrint} onPress={() => handlePrintReceipt(selectedSale)}>
                           <Printer size={16} color="#ffffff" style={{ marginRight: 6 }} /><Text style={styles.actionBtnText}>Imprimir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnWA} onPress={() => handleShareWhatsApp(selectedSale)}>
                           <MessageCircle size={16} color="#ffffff" style={{ marginRight: 6 }} /><Text style={styles.actionBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        {selectedSale.status !== 'voided' && (
                           <TouchableOpacity style={styles.actionBtnVoid} onPress={() => setIsVoidModalOpen(true)}>
                              <XCircle size={16} color="#ef4444" style={{ marginRight: 4 }} /><Text style={styles.actionBtnVoidText}>Anular</Text>
                           </TouchableOpacity>
                        )}
                     </View>
                  </View>
               </View>
            )}
         </Modal>

         <Modal visible={isVoidModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.voidModalCard}>
                  <View style={styles.voidModalHeader}>
                     <AlertTriangle size={22} color="#ef4444" style={{ marginRight: 8 }} />
                     <Text style={styles.voidModalTitle}>Confirmar Anulación</Text>
                  </View>
                  <Text style={styles.voidModalText}>¿Estás seguro de que deseas anular la venta <Text style={{ fontWeight: 'bold' }}>#{selectedSale?.receiptNumber}</Text>? Se recompondrá automáticamente el stock en el inventario.</Text>
                  <TextInput style={styles.voidInput} placeholder="Motivo de anulación (opcional)..." placeholderTextColor="#94a3b8" value={voidReason} onChangeText={setVoidReason} />
                  <View style={styles.voidModalFooter}>
                     <TouchableOpacity style={styles.cancelVoidBtn} onPress={() => setIsVoidModalOpen(false)} disabled={isProcessing}><Text style={styles.cancelVoidText}>Cancelar</Text></TouchableOpacity>
                     <TouchableOpacity style={styles.confirmVoidBtn} onPress={handleConfirmVoid} disabled={isProcessing}><Text style={styles.confirmVoidText}>{isProcessing ? 'Anulando...' : 'Sí, Anular Venta'}</Text></TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   headerLeft: { flexDirection: 'row', alignItems: 'center' },
   headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
   headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
   metricsContainer: { flexDirection: 'row', gap: 8 },
   metricBox: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'flex-end' },
   metricLabel: { fontSize: 10, color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase' },
   metricValue: { fontSize: 16, fontWeight: '900', color: '#1d4ed8' },

   filterSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 10 },
   searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
   searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 42 },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   filterToggleBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
   filterToggleBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },

   dateFilterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
   advancedFiltersContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6, gap: 12 },
   filterGroup: { flexDirection: 'row', alignItems: 'center' },
   filterIconLabel: { width: 65, flexDirection: 'row', alignItems: 'center', gap: 4 },
   filterRowTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
   chipsScroll: { flexDirection: 'row', paddingLeft: 4 },
   chip: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },

   listContent: { padding: 16, paddingBottom: 40 },
   saleCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
   saleCardVoided: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', opacity: 0.8 },
   saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
   iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
   receiptNum: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
   saleTotal: { fontSize: 18, fontWeight: '900', color: '#16a34a' },
   textMuted: { color: '#94a3b8', textDecorationLine: 'line-through' },
   statusBadgeCompletedText: { fontSize: 10, fontWeight: 'bold', color: '#16a34a', marginTop: 2 },
   statusBadgeVoidedText: { fontSize: 10, fontWeight: 'bold', color: '#ef4444', marginTop: 2 },
   saleDetailsDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
   saleMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   metaText: { fontSize: 12, color: '#64748b' },
   customerText: { fontSize: 12, fontWeight: '600', color: '#475569' },
   paymentTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
   paymentTagText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
   emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginTop: 12 },
   emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 18 },

   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', elevation: 10 },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   voidedAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', padding: 12, borderRadius: 10, marginBottom: 16 },
   voidedAlertText: { fontSize: 12, color: '#991b1b', fontWeight: 'bold', flex: 1 },
   receiptHeaderBox: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   receiptMainTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 1 },
   receiptNumberText: { fontSize: 26, fontWeight: '900', color: '#2563eb', marginVertical: 4 },
   receiptDateText: { fontSize: 12, color: '#94a3b8' },
   infoGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   infoCol: { flex: 1 },
   infoLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' },
   infoVal: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
   sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginTop: 16, marginBottom: 8 },

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
   modalFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   actionBtnPrint: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10 },
   actionBtnWA: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#25d366', paddingVertical: 12, borderRadius: 10 },
   actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
   actionBtnVoid: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
   actionBtnVoidText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },

   voidModalCard: { width: '100%', maxWidth: 380, backgroundColor: '#ffffff', borderRadius: 20, padding: 24 },
   voidModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
   voidModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
   voidModalText: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 16 },
   voidInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#0f172a', marginBottom: 0, backgroundColor: '#f8fafc' },
   voidModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
   cancelVoidBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cancelVoidText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
   confirmVoidBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#ef4444' },
   confirmVoidText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },
});

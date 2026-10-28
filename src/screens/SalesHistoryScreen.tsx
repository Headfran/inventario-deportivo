import React, { useState, useEffect, useMemo } from 'react';
import {
   View,
   Text,
   ScrollView,
   Pressable,
   StyleSheet,
   TextInput,
   Modal,
   FlatList,
   useWindowDimensions,
} from 'react-native';
import {
   Search,
   Receipt,
   Printer,
   MessageCircle,
   X,
   User,
   XCircle,
   AlertTriangle,
   FileText,
   CalendarDays,
   Filter,
   DollarSign,
   Banknote,
} from 'lucide-react-native';
import {
   Sale,
   subscribeToSales,
   voidSale,
   formatDateTime,
} from '../services/salesHistoryService';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { showAlert } from '../utils/alert';
import { MONO as T, display } from '../design';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const getSaleDate = (createdAt: any): Date => {
   if (!createdAt) return new Date(0);
   if (typeof createdAt.toDate === 'function') return createdAt.toDate();
   if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
   return new Date(createdAt);
};

const getStartOfDay = (date = new Date()) =>
   new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${date.getFullYear()}`;
};

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const FilterChip = ({
   label,
   isActive,
   onPress,
}: {
   label: string;
   isActive: boolean;
   onPress: () => void;
}) => (
   <P style={[styles.chip, isActive && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
   </P>
);

export const SalesHistoryScreen: React.FC = () => {
   const { width } = useWindowDimensions();
   const mobile = width < 600;

   const [sales, setSales] = useState<Sale[]>([]);
   const [searchQuery, setSearchQuery] = useState('');

   const [selectedDateFilter, setSelectedDateFilter] = useState<string>('today');
   const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
   const [selectedStatus, setSelectedStatus] = useState<string>('completed');
   const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
   const [isSearchFocused, setIsSearchFocused] = useState(false);

   const [showDateRangeModal, setShowDateRangeModal] = useState(false);
   const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

   const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
   const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
   const [voidReason, setVoidReason] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
      const unsub = subscribeToSales(setSales);
      return () => unsub();
   }, []);

   const filteredSales = useMemo(() => {
      return sales
         .filter((sale) => {
            const queryLower = searchQuery.toLowerCase().trim();
            const matchesQuery =
               !queryLower ||
               (sale.receiptNumber && sale.receiptNumber.toLowerCase().includes(queryLower)) ||
               (sale.customerName && sale.customerName.toLowerCase().includes(queryLower)) ||
               (sale.sellerName && sale.sellerName.toLowerCase().includes(queryLower)) ||
               (sale.customerPhone && sale.customerPhone.includes(queryLower)) ||
               (sale.items &&
                  sale.items.some(
                     (item) =>
                        (item.productCode && item.productCode.toLowerCase().includes(queryLower)) ||
                        (item.productId && item.productId.toLowerCase().includes(queryLower))
                  ));

            const matchesPayment =
               selectedPaymentMethod === 'all' || sale.paymentMethod === selectedPaymentMethod;
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
         })
         .sort((a, b) => getSaleDate(b.createdAt).getTime() - getSaleDate(a.createdAt).getTime());
   }, [sales, searchQuery, selectedDateFilter, selectedPaymentMethod, selectedStatus, customDateRange]);

   const totalRevenue = useMemo(() => {
      return filteredSales
         .filter((s) => s.status !== 'voided')
         .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
   }, [filteredSales]);

   const activeSalesCount = filteredSales.filter((s) => s.status !== 'voided').length;

   const handlePrintReceipt = (sale: Sale) => {
      if (typeof window === 'undefined') return;

      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) return;

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
         )
         .join('');

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
              <table>${itemsHtml}</table>
              <div class="divider"></div>
              <table>
                <tr><td>Subtotal:</td><td class="right">$${safeFixed(sale.subtotal)}</td></tr>
                ${Number(sale.discount) > 0
            ? `<tr><td>Descuento:</td><td class="right">-$${safeFixed(sale.discount)}</td></tr>`
            : ''
         }
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

      if (typeof window !== 'undefined') window.open(url, '_blank');
   };

   const handleConfirmVoid = async () => {
      if (!selectedSale) return;
      setIsProcessing(true);
      try {
         await voidSale(selectedSale, voidReason);
         setIsVoidModalOpen(false);
         setSelectedSale(null);
         setVoidReason('');
         showAlert('Éxito', 'La venta ha sido anulada y el stock ha retornado al inventario.');
      } catch {
         showAlert('Error', 'No se pudo anular la venta. Inténtelo de nuevo.');
      } finally {
         setIsProcessing(false);
      }
   };

   return (
      <View style={styles.container}>
         {/* HEADER BANNER NEGRO */}
         <View style={styles.header}>
            <View style={styles.headerLeft}>
               <View style={styles.headerIconBox}>
                  <Receipt size={22} color={T.onBar} />
               </View>
               <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.headerTitle, mobile && styles.headerTitleMobile]}>
                     Historial de Ventas
                  </Text>
                  <Text style={styles.headerSubtitle}>Monitor de ingresos y recibos</Text>
               </View>
            </View>

            <View style={styles.metricsContainer}>
               <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Ingresos · {activeSalesCount}</Text>
                  <Text style={styles.metricValue}>${safeFixed(totalRevenue)}</Text>
               </View>
            </View>
         </View>

         {/* FILTROS */}
         <View style={styles.filterSection}>
            <View style={styles.searchRow}>
               <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
                  <Search size={18} color={isSearchFocused ? T.ink : T.inkMute} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar recibo, cliente o ref..."
                     placeholderTextColor={T.inkMute}
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                     onFocus={() => setIsSearchFocused(true)}
                     onBlur={() => setIsSearchFocused(false)}
                  />
                  {searchQuery ? (
                     <P onPress={() => setSearchQuery('')}>
                        <X size={18} color={T.inkMute} />
                     </P>
                  ) : null}
               </View>
               <P
                  style={[styles.filterToggleBtn, showAdvancedFilters && styles.filterToggleBtnActive]}
                  onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
               >
                  <Filter size={18} color={showAdvancedFilters ? T.onSolid : T.ink} />
               </P>
            </View>

            <View style={styles.dateFilterRow}>
               <CalendarDays size={14} color={T.inkMute} style={{ marginRight: 8 }} />
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                  contentContainerStyle={{ gap: 6 }}
               >
                  <FilterChip label="Hoy" isActive={selectedDateFilter === 'today'} onPress={() => setSelectedDateFilter('today')} />
                  <FilterChip label="Ayer" isActive={selectedDateFilter === 'yesterday'} onPress={() => setSelectedDateFilter('yesterday')} />
                  <FilterChip label="7 Días" isActive={selectedDateFilter === 'week'} onPress={() => setSelectedDateFilter('week')} />
                  <FilterChip label="Este Mes" isActive={selectedDateFilter === 'month'} onPress={() => setSelectedDateFilter('month')} />
                  <FilterChip label="Todas" isActive={selectedDateFilter === 'all'} onPress={() => setSelectedDateFilter('all')} />
                  <P
                     style={[styles.chip, selectedDateFilter === 'custom' && styles.chipActive]}
                     onPress={() => setShowDateRangeModal(true)}
                  >
                     <Text style={[styles.chipText, selectedDateFilter === 'custom' && styles.chipTextActive]}>
                        Rango
                        {selectedDateFilter === 'custom' && customDateRange
                           ? ` (${formatDateShort(customDateRange.start)})`
                           : ''}
                     </Text>
                  </P>
               </ScrollView>
            </View>

            {showAdvancedFilters && (
               <View style={styles.advancedFiltersContainer}>
                  <View style={styles.filterGroup}>
                     <View style={styles.filterIconLabel}>
                        <DollarSign size={14} color={T.inkSoft} />
                        <Text style={styles.filterRowTitle}>Pago</Text>
                     </View>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
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
                     <View style={styles.filterIconLabel}>
                        <FileText size={14} color={T.inkSoft} />
                        <Text style={styles.filterRowTitle}>Estado</Text>
                     </View>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        <FilterChip label="Completadas" isActive={selectedStatus === 'completed'} onPress={() => setSelectedStatus('completed')} />
                        <FilterChip label="Anuladas" isActive={selectedStatus === 'voided'} onPress={() => setSelectedStatus('voided')} />
                        <FilterChip label="Todas" isActive={selectedStatus === 'all'} onPress={() => setSelectedStatus('all')} />
                     </ScrollView>
                  </View>
               </View>
            )}
         </View>

         {/* LISTA */}
         <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id || item.receiptNumber || String(Math.random())}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const isVoided = item.status === 'voided';
               return (
                  <P
                     style={[styles.saleCard, isVoided && styles.saleCardVoided]}
                     onPress={() => setSelectedSale(item)}
                  >
                     <View style={styles.saleHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                           <View style={[styles.iconWrapper, isVoided && styles.iconWrapperVoided]}>
                              <Banknote size={16} color={isVoided ? '#DC2626' : T.ink} />
                           </View>
                           <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[styles.receiptNum, isVoided && styles.textMuted]} numberOfLines={1}>
                                 #{item.receiptNumber}
                              </Text>
                              <Text style={styles.metaText}>
                                 {formatDateTime(item.createdAt, 'short')}
                              </Text>
                           </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={[styles.saleTotal, isVoided && styles.textMuted]}>
                              ${safeFixed(item.total)}
                           </Text>
                           {isVoided ? (
                              <View style={styles.statusPillVoided}>
                                 <Text style={styles.statusPillVoidedText}>ANULADA</Text>
                              </View>
                           ) : (
                              <View style={styles.statusPillCompleted}>
                                 <Text style={styles.statusPillCompletedText}>COMPLETADA</Text>
                              </View>
                           )}
                        </View>
                     </View>

                     <View style={styles.saleDetailsDivider} />

                     <View style={styles.saleMetaRow}>
                        {item.sellerName && (
                           <View style={styles.metaInline}>
                              <User size={12} color={T.inkMute} />
                              <Text style={styles.metaText} numberOfLines={1}>{item.sellerName}</Text>
                           </View>
                        )}
                        {item.customerName && (
                           <View style={styles.metaInline}>
                              <Text style={styles.customerText} numberOfLines={1}>
                                 👤 {item.customerName}
                              </Text>
                           </View>
                        )}
                        <View style={styles.paymentTag}>
                           <Text style={styles.paymentTagText}>
                              {(item.paymentMethod || '').replace('_', ' ').toUpperCase()}
                           </Text>
                        </View>
                     </View>
                  </P>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <FileText size={44} color={T.inkMute} />
                  <Text style={styles.emptyTitle}>Sin ventas para este filtro</Text>
                  <Text style={styles.emptySubtitle}>
                     Ajusta las fechas o el método de búsqueda para encontrar lo que necesitas.
                  </Text>
               </View>
            }
         />

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

         {/* MODAL DETALLE DE VENTA */}
         <Modal visible={!!selectedSale && !isVoidModalOpen} transparent animationType="slide">
            {selectedSale && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Detalle del Comprobante</Text>
                        <P onPress={() => setSelectedSale(null)}>
                           <X size={20} color={T.onBar} />
                        </P>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        {selectedSale.status === 'voided' && (
                           <View style={styles.voidedAlertBox}>
                              <AlertTriangle size={16} color="#DC2626" style={{ marginRight: 8 }} />
                              <Text style={styles.voidedAlertText}>
                                 Esta venta fue anulada y el stock fue restablecido.
                              </Text>
                           </View>
                        )}

                        <View style={styles.ticketBox}>
                           <View style={styles.ticketHeader}>
                              <Text style={styles.ticketMainTitle}>COMPROBANTE DE VENTA</Text>
                              <Text style={styles.ticketNumber}>#{selectedSale.receiptNumber}</Text>
                              <Text style={styles.ticketMeta}>
                                 {formatDateTime(selectedSale.createdAt, 'long')}
                              </Text>
                           </View>

                           {(selectedSale.sellerName || selectedSale.customerName) && (
                              <>
                                 <View style={styles.divider} />
                                 {selectedSale.sellerName && (
                                    <View style={styles.ticketRow}>
                                       <Text style={styles.ticketLabel}>Vendedor:</Text>
                                       <Text style={styles.ticketVal}>{selectedSale.sellerName}</Text>
                                    </View>
                                 )}
                                 {selectedSale.customerName && (
                                    <View style={styles.ticketRow}>
                                       <Text style={styles.ticketLabel}>Cliente:</Text>
                                       <Text style={styles.ticketVal}>{selectedSale.customerName}</Text>
                                    </View>
                                 )}
                              </>
                           )}

                           <View style={styles.divider} />

                           <Text style={styles.itemsTitle}>
                              Detalle de Artículos ({selectedSale.items.length}):
                           </Text>

                           {(selectedSale.items || []).map((item, idx) => (
                              <View key={idx} style={styles.itemRow}>
                                 <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName}>
                                       {item.brand} - {item.name}
                                    </Text>
                                    <Text style={styles.itemSpec}>
                                       Ref: {item.productCode || item.productId}
                                    </Text>
                                    <Text style={styles.itemSpec}>
                                       {item.color} • Talla: {item.size}
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

                           <View style={styles.divider} />

                           <View style={styles.ticketRow}>
                              <Text style={styles.ticketLabel}>Subtotal:</Text>
                              <Text style={styles.ticketVal}>${safeFixed(selectedSale.subtotal)}</Text>
                           </View>
                           {Number(selectedSale.discount) > 0 && (
                              <View style={styles.ticketRow}>
                                 <Text style={styles.ticketLabel}>Descuento:</Text>
                                 <Text style={[styles.ticketVal, { color: '#DC2626' }]}>
                                    -${safeFixed(selectedSale.discount)}
                                 </Text>
                              </View>
                           )}
                           <View style={styles.ticketRow}>
                              <Text style={styles.ticketLabel}>Método de Pago:</Text>
                              <Text style={styles.ticketVal}>
                                 {(selectedSale.paymentMethod || '').replace('_', ' ').toUpperCase()}
                              </Text>
                           </View>

                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>TOTAL:</Text>
                              <Text style={styles.totalValue}>
                                 ${safeFixed(selectedSale.total)}
                              </Text>
                           </View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        <P style={styles.actionBtnSecondary} onPress={() => handlePrintReceipt(selectedSale)}>
                           <Printer size={16} color={T.ink} />
                           <Text style={styles.actionBtnSecondaryText}>Imprimir</Text>
                        </P>
                        <P style={styles.actionBtnPrimary} onPress={() => handleShareWhatsApp(selectedSale)}>
                           <MessageCircle size={16} color={T.onSolid} />
                           <Text style={styles.actionBtnPrimaryText}>WhatsApp</Text>
                        </P>
                        {selectedSale.status !== 'voided' && (
                           <P style={styles.actionBtnDanger} onPress={() => setIsVoidModalOpen(true)}>
                              <XCircle size={16} color="#DC2626" />
                              <Text style={styles.actionBtnDangerText}>Anular</Text>
                           </P>
                        )}
                     </View>
                  </View>
               </View>
            )}
         </Modal>

         {/* MODAL ANULACIÓN */}
         <Modal visible={isVoidModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.voidModalCard}>
                  <View style={styles.voidModalHeader}>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.voidModalTitle}>Confirmar Anulación</Text>
                        <Text style={styles.voidModalSubtitle}>
                           Esta acción restaura el stock al inventario
                        </Text>
                     </View>
                     <P onPress={() => setIsVoidModalOpen(false)} disabled={isProcessing}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>

                  <View style={{ padding: 20 }}>
                     <View style={styles.voidAlertRow}>
                        <AlertTriangle size={18} color="#DC2626" />
                        <Text style={styles.voidModalText}>
                           ¿Anular la venta{' '}
                           <Text style={{ fontWeight: '800' }}>#{selectedSale?.receiptNumber}</Text>?
                        </Text>
                     </View>

                     <Text style={styles.inputLabel}>Motivo (opcional)</Text>
                     <TextInput
                        style={styles.voidInput}
                        placeholder="Ej. Cliente devolvió el producto..."
                        placeholderTextColor={T.inkMute}
                        value={voidReason}
                        onChangeText={setVoidReason}
                        editable={!isProcessing}
                     />

                     <View style={styles.voidModalFooter}>
                        <P
                           style={styles.cancelVoidBtn}
                           onPress={() => setIsVoidModalOpen(false)}
                           disabled={isProcessing}
                        >
                           <Text style={styles.cancelVoidText}>Cancelar</Text>
                        </P>
                        <P
                           style={[styles.confirmVoidBtn, isProcessing && { opacity: 0.7 }]}
                           onPress={handleConfirmVoid}
                           disabled={isProcessing}
                        >
                           <Text style={styles.confirmVoidText}>
                              {isProcessing ? 'Anulando...' : 'Sí, Anular'}
                           </Text>
                        </P>
                     </View>
                  </View>
               </View>
            </View>
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   // Header banner negro
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

   metricsContainer: { flexDirection: 'row', gap: 8 },
   metricBox: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'flex-end',
   },
   metricLabel: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.65)',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   metricValue: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.onBar,
      marginTop: 2,
   },

   // Filtros
   filterSection: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: T.surface,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
      zIndex: 10,
   },
   searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
   searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 46,
   },
   searchBarFocused: { borderColor: T.ink, borderWidth: 1.5 },
   searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      color: T.ink,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      textAlignVertical: 'center',
   },
   filterToggleBtn: {
      width: 46,
      height: 46,
      borderRadius: 10,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      justifyContent: 'center',
      alignItems: 'center',
   },
   filterToggleBtnActive: { backgroundColor: T.solid, borderColor: T.solid },

   dateFilterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
   advancedFiltersContainer: {
      backgroundColor: T.bg,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      marginTop: 10,
      gap: 10,
   },
   filterGroup: { flexDirection: 'row', alignItems: 'center' },
   filterIconLabel: { width: 68, flexDirection: 'row', alignItems: 'center', gap: 4 },
   filterRowTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: T.inkMute,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   chipsScroll: { flexDirection: 'row' },

   chip: {
      backgroundColor: T.bg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: T.line,
      flexDirection: 'row',
      alignItems: 'center',
   },
   chipActive: { backgroundColor: T.solid, borderColor: T.solid },
   chipText: { fontSize: 12, color: T.inkSoft, fontWeight: '700' },
   chipTextActive: { color: T.onSolid, fontWeight: '800' },

   // Lista
   listContent: { padding: 16, paddingBottom: 60 },
   saleCard: {
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: T.line,
   },
   saleCardVoided: { backgroundColor: T.bg, opacity: 0.85 },
   saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
   iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
   },
   iconWrapperVoided: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
   receiptNum: {
      ...display,
      fontSize: 18,
      lineHeight: 18,
      fontWeight: '800',
      color: T.ink,
   },
   saleTotal: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.ink,
   },
   textMuted: { color: T.inkMute, textDecorationLine: 'line-through' },

   statusPillCompleted: {
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
   },
   statusPillCompletedText: {
      fontSize: 9,
      fontWeight: '800',
      color: T.inkSoft,
      letterSpacing: 0.5,
   },
   statusPillVoided: {
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#FCA5A5',
      backgroundColor: '#FEF2F2',
   },
   statusPillVoidedText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#DC2626',
      letterSpacing: 0.5,
   },

   saleDetailsDivider: { height: 1, backgroundColor: T.line, marginVertical: 12 },
   saleMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
   },
   metaInline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
   metaText: { fontSize: 12, color: T.inkMute },
   customerText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   paymentTag: {
      backgroundColor: T.bg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: T.line,
   },
   paymentTagText: { fontSize: 10, fontWeight: '800', color: T.inkSoft, letterSpacing: 0.3 },

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
      lineHeight: 18,
   },

   // Modal detalle
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
      maxHeight: '92%',
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
      fontSize: 20,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
      flexShrink: 1,
   },

   voidedAlertBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF2F2',
      borderWidth: 1,
      borderColor: '#FCA5A5',
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
   },
   voidedAlertText: { fontSize: 12, color: '#DC2626', fontWeight: '700', flex: 1 },

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
   divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.3)', marginVertical: 12 },
   itemsTitle: { fontSize: 12, fontWeight: '800', color: T.inkSoft, marginBottom: 8, textTransform: 'uppercase' },
   itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
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
   totalValue: {
      ...display,
      fontSize: 40,
      lineHeight: 40,
      fontWeight: '800',
      color: T.ink,
   },

   modalFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 16,
      backgroundColor: T.surface,
      borderTopWidth: 1,
      borderTopColor: T.line,
   },
   actionBtnSecondary: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
   },
   actionBtnSecondaryText: { fontSize: 13, fontWeight: '700', color: T.ink },
   actionBtnPrimary: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      height: 44,
      borderRadius: 10,
      backgroundColor: T.solid,
   },
   actionBtnPrimaryText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
   actionBtnDanger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#FCA5A5',
      backgroundColor: '#FEF2F2',
   },
   actionBtnDangerText: { fontSize: 13, fontWeight: '800', color: '#DC2626' },

   // Modal anulación
   voidModalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: T.bg,
      borderRadius: 16,
      overflow: 'hidden',
   },
   voidModalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      backgroundColor: T.bar,
   },
   voidModalTitle: {
      ...display,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },
   voidModalSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
   voidAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
   voidModalText: { fontSize: 14, color: T.ink, lineHeight: 20, flex: 1 },
   inputLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: T.inkMute,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   voidInput: {
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 46,
      fontSize: 14,
      color: T.ink,
      backgroundColor: T.bg,
   },
   voidModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
   cancelVoidBtn: {
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      alignItems: 'center',
      justifyContent: 'center',
   },
   cancelVoidText: { fontSize: 13, fontWeight: '700', color: T.ink },
   confirmVoidBtn: {
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: '#DC2626',
      alignItems: 'center',
      justifyContent: 'center',
   },
   confirmVoidText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
});

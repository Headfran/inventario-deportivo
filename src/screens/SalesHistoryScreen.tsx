import React, { useState, useEffect } from 'react';
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
} from 'lucide-react-native';
import {
   Sale,
   subscribeToSales,
   voidSale,
   formatDateTime,
} from '../services/salesHistoryService';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

export const SalesHistoryScreen: React.FC = () => {
   const [sales, setSales] = useState<Sale[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
   const [selectedStatus, setSelectedStatus] = useState<string>('all');
   const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
   const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
   const [voidReason, setVoidReason] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
      const unsub = subscribeToSales(setSales);
      return () => unsub();
   }, []);

   const filteredSales = sales.filter((sale) => {
      const queryLower = searchQuery.toLowerCase().trim();
      const matchesQuery =
         !queryLower ||
         (sale.receiptNumber && sale.receiptNumber.toLowerCase().includes(queryLower)) ||
         (sale.customerName && sale.customerName.toLowerCase().includes(queryLower)) ||
         (sale.sellerName && sale.sellerName.toLowerCase().includes(queryLower)) ||
         (sale.customerPhone && sale.customerPhone.includes(queryLower));

      const matchesPayment = selectedPaymentMethod === 'all' || sale.paymentMethod === selectedPaymentMethod;
      const matchesStatus = selectedStatus === 'all' || sale.status === selectedStatus;

      return matchesQuery && matchesPayment && matchesStatus;
   });

   const handlePrintReceipt = (sale: Sale) => {
      if (typeof window !== 'undefined') {
         const printWindow = window.open('', '_blank', 'width=400,height=600');
         if (printWindow) {
            const itemsHtml = (sale.items || [])
               .map(
                  (item) => `
            <tr>
              <td style="padding: 4px 0;">${item.brand} - ${item.name}<br/><small>(${item.color} / Talla ${item.size}) x${item.quantity}</small></td>
              <td style="text-align: right; vertical-align: top;">$${safeFixed(item.totalPrice)}</td>
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
         message += `• *${item.brand} - ${item.name}* (${item.color}, Talla ${item.size})\n  Cant: ${item.quantity} x $${safeFixed(item.unitPrice)} = *$${safeFixed(item.totalPrice)}*\n`;
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

   return (
      <View style={styles.container}>
         <View style={styles.header}>
            <View style={styles.headerLeft}>
               <Receipt size={22} color="#2563eb" style={{ marginRight: 8 }} />
               <View>
                  <Text style={styles.headerTitle}>Historial de Ventas</Text>
                  <Text style={styles.headerSubtitle}>Consulta, re-emite comprobantes y gestiona ventas</Text>
               </View>
            </View>
            <View style={styles.statBadge}>
               <Text style={styles.statBadgeLabel}>Registros:</Text>
               <Text style={styles.statBadgeValue}>{filteredSales.length}</Text>
            </View>
         </View>

         <View style={styles.filterSection}>
            <View style={styles.searchBar}>
               <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por # recibo, cliente o vendedor..."
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
               <TouchableOpacity style={[styles.chip, selectedPaymentMethod === 'all' && styles.chipActive]} onPress={() => setSelectedPaymentMethod('all')}>
                  <Text style={[styles.chipText, selectedPaymentMethod === 'all' && styles.chipTextActive]}>Todos los Pagos</Text>
               </TouchableOpacity>

               {['efectivo', 'pago_movil', 'punto', 'transferencia', 'mixto'].map((method) => (
                  <TouchableOpacity key={method} style={[styles.chip, selectedPaymentMethod === method && styles.chipActive]} onPress={() => setSelectedPaymentMethod(method)}>
                     <Text style={[styles.chipText, selectedPaymentMethod === method && styles.chipTextActive]}>{method.replace('_', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
               ))}

               <View style={styles.chipDivider} />

               <TouchableOpacity style={[styles.chip, selectedStatus === 'all' && styles.chipActive]} onPress={() => setSelectedStatus('all')}>
                  <Text style={[styles.chipText, selectedStatus === 'all' && styles.chipTextActive]}>Todos</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.chip, selectedStatus === 'completed' && styles.chipActive]} onPress={() => setSelectedStatus('completed')}>
                  <Text style={[styles.chipText, selectedStatus === 'completed' && styles.chipTextActive]}>Completadas</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.chip, selectedStatus === 'voided' && styles.chipActive]} onPress={() => setSelectedStatus('voided')}>
                  <Text style={[styles.chipText, selectedStatus === 'voided' && styles.chipTextActive]}>Anuladas</Text>
               </TouchableOpacity>
            </ScrollView>
         </View>

         <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const isVoided = item.status === 'voided';
               return (
                  <TouchableOpacity
                     style={[styles.saleCard, isVoided && styles.saleCardVoided]}
                     activeOpacity={0.85}
                     onPress={() => setSelectedSale(item)}
                  >
                     <View style={styles.saleHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Receipt size={16} color={isVoided ? '#94a3b8' : '#2563eb'} />
                           <Text style={[styles.receiptNum, isVoided && styles.textMuted]}>#{item.receiptNumber}</Text>
                           {isVoided ? (
                              <View style={styles.statusBadgeVoided}><Text style={styles.statusBadgeVoidedText}>ANULADO</Text></View>
                           ) : (
                              <View style={styles.statusBadgeCompleted}><Text style={styles.statusBadgeCompletedText}>COMPLETADO</Text></View>
                           )}
                        </View>
                        <Text style={[styles.saleTotal, isVoided && styles.textMuted]}>${safeFixed(item.total)}</Text>
                     </View>

                     <View style={styles.saleMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                           <Calendar size={12} color="#64748b" />
                           <Text style={styles.metaText}>{formatDateTime(item.createdAt, 'short')}</Text>
                        </View>
                        {item.sellerName ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <User size={12} color="#64748b" />
                              <Text style={styles.metaText}>{item.sellerName}</Text>
                           </View>
                        ) : null}
                        <View style={styles.paymentTag}>
                           <Text style={styles.paymentTagText}>{(item.paymentMethod || '').replace('_', ' ').toUpperCase()}</Text>
                        </View>
                     </View>

                     {item.customerName ? <Text style={styles.customerText}>Cliente: {item.customerName}</Text> : null}

                     <Text style={styles.itemsSummary} numberOfLines={1}>
                        {(item.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                     </Text>
                  </TouchableOpacity>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <FileText size={36} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No hay ventas registradas</Text>
                  <Text style={styles.emptySubtitle}>Las ventas realizadas desde el Punto de Venta aparecerán en este historial.</Text>
               </View>
            }
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
                        <TouchableOpacity onPress={() => setSelectedSale(null)}>
                           <X size={20} color="#64748b" />
                        </TouchableOpacity>
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
                           {selectedSale.sellerName ? (
                              <View style={styles.infoCol}>
                                 <Text style={styles.infoLabel}>Vendedor:</Text>
                                 <Text style={styles.infoVal}>{selectedSale.sellerName}</Text>
                              </View>
                           ) : null}
                           {selectedSale.customerName ? (
                              <View style={styles.infoCol}>
                                 <Text style={styles.infoLabel}>Cliente:</Text>
                                 <Text style={styles.infoVal}>{selectedSale.customerName}</Text>
                              </View>
                           ) : null}
                        </View>

                        <Text style={styles.sectionLabel}>Prendas Adquiridas:</Text>
                        <View style={styles.itemsTable}>
                           {(selectedSale.items || []).map((item, idx) => (
                              <View key={idx} style={styles.tableRow}>
                                 <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{item.brand} - {item.name}</Text>
                                    <Text style={styles.itemSub}>Color: {item.color} | Talla: {item.size} | Cant: {item.quantity} x ${safeFixed(item.unitPrice)}</Text>
                                 </View>
                                 <Text style={styles.itemTotal}>${safeFixed(item.totalPrice)}</Text>
                              </View>
                           ))}
                        </View>

                        <View style={styles.totalsBox}>
                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>Subtotal:</Text>
                              <Text style={styles.totalVal}>${safeFixed(selectedSale.subtotal)}</Text>
                           </View>
                           {Number(selectedSale.discount) > 0 && (
                              <View style={styles.totalRow}>
                                 <Text style={styles.totalLabel}>Descuento:</Text>
                                 <Text style={styles.discountVal}>-${safeFixed(selectedSale.discount)}</Text>
                              </View>
                           )}
                           <View style={[styles.totalRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                              <Text style={styles.finalTotalLabel}>TOTAL:</Text>
                              <Text style={styles.finalTotalVal}>${safeFixed(selectedSale.total)}</Text>
                           </View>
                           <View style={styles.totalRow}>
                              <Text style={styles.totalLabel}>Método de Pago:</Text>
                              <Text style={styles.paymentVal}>{(selectedSale.paymentMethod || '').replace('_', ' ').toUpperCase()}</Text>
                           </View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.actionBtnPrint} onPress={() => handlePrintReceipt(selectedSale)}>
                           <Printer size={16} color="#ffffff" style={{ marginRight: 6 }} />
                           <Text style={styles.actionBtnText}>Imprimir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnWA} onPress={() => handleShareWhatsApp(selectedSale)}>
                           <MessageCircle size={16} color="#ffffff" style={{ marginRight: 6 }} />
                           <Text style={styles.actionBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        {selectedSale.status !== 'voided' && (
                           <TouchableOpacity style={styles.actionBtnVoid} onPress={() => setIsVoidModalOpen(true)}>
                              <XCircle size={16} color="#ef4444" style={{ marginRight: 4 }} />
                              <Text style={styles.actionBtnVoidText}>Anular</Text>
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
                  <Text style={styles.voidModalText}>
                     ¿Estás seguro de que deseas anular la venta <Text style={{ fontWeight: 'bold' }}>#{selectedSale?.receiptNumber}</Text>? Se recompondrá automáticamente el stock en el inventario.
                  </Text>
                  <TextInput
                     style={styles.voidInput}
                     placeholder="Motivo de anulación (opcional)..."
                     placeholderTextColor="#94a3b8"
                     value={voidReason}
                     onChangeText={setVoidReason}
                  />
                  <View style={styles.voidModalFooter}>
                     <TouchableOpacity style={styles.cancelVoidBtn} onPress={() => setIsVoidModalOpen(false)} disabled={isProcessing}>
                        <Text style={styles.cancelVoidText}>Cancelar</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={styles.confirmVoidBtn} onPress={handleConfirmVoid} disabled={isProcessing}>
                        <Text style={styles.confirmVoidText}>{isProcessing ? 'Anulando...' : 'Sí, Anular Venta'}</Text>
                     </TouchableOpacity>
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
   headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   headerSubtitle: { fontSize: 11, color: '#64748b' },
   statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
   statBadgeLabel: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
   statBadgeValue: { fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
   filterSection: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#ffffff' },
   searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, marginBottom: 10 },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   chipsScroll: { flexDirection: 'row', paddingBottom: 10 },
   chip: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6 },
   chipActive: { backgroundColor: '#2563eb' },
   chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   chipDivider: { width: 1, height: 20, backgroundColor: '#cbd5e1', marginHorizontal: 6, alignSelf: 'center' },
   listContent: { padding: 16 },
   saleCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
   saleCardVoided: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
   saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   receiptNum: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
   saleTotal: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
   textMuted: { color: '#94a3b8', textDecorationLine: 'line-through' },
   statusBadgeCompleted: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   statusBadgeCompletedText: { fontSize: 9, fontWeight: 'bold', color: '#16a34a' },
   statusBadgeVoided: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   statusBadgeVoidedText: { fontSize: 9, fontWeight: 'bold', color: '#ef4444' },
   saleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
   metaText: { fontSize: 11, color: '#64748b' },
   paymentTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   paymentTagText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
   customerText: { fontSize: 11, fontWeight: '600', color: '#334155', marginTop: 4 },
   itemsSummary: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' },
   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
   emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
   emptySubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 280 },
   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   voidedAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', padding: 10, borderRadius: 8, marginBottom: 12 },
   voidedAlertText: { fontSize: 11, color: '#991b1b', fontWeight: 'bold', flex: 1 },
   receiptHeaderBox: { alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   receiptMainTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 1 },
   receiptNumberText: { fontSize: 22, fontWeight: '800', color: '#2563eb', marginVertical: 2 },
   receiptDateText: { fontSize: 11, color: '#94a3b8' },
   infoGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   infoCol: { flex: 1 },
   infoLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' },
   infoVal: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
   sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 12, marginBottom: 6 },
   itemsTable: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
   tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   itemTitle: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   itemSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
   itemTotal: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   totalsBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
   totalLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
   totalVal: { fontSize: 12, color: '#0f172a', fontWeight: 'bold' },
   discountVal: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
   finalTotalLabel: { fontSize: 14, color: '#0f172a', fontWeight: 'bold' },
   finalTotalVal: { fontSize: 18, color: '#16a34a', fontWeight: '800' },
   paymentVal: { fontSize: 11, color: '#2563eb', fontWeight: 'bold' },
   modalFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   actionBtnPrint: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8 },
   actionBtnWA: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#25d366', paddingVertical: 10, borderRadius: 8 },
   actionBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
   actionBtnVoid: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
   actionBtnVoidText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
   voidModalCard: { width: '100%', maxWidth: 380, backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
   voidModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
   voidModalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   voidModalText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 },
   voidInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: '#0f172a', marginBottom: 16 },
   voidModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
   cancelVoidBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#f1f5f9' },
   cancelVoidText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
   confirmVoidBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#ef4444' },
   confirmVoidText: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
});

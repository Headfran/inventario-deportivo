import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { CheckCircle2, Printer, MessageCircle, Crown, Coins } from 'lucide-react-native';
import { Sale } from '../types/sale';
import { openWhatsAppReceipt, printReceiptHTML } from '../utils/receiptUtils';
import { MONO as T, display } from '../design';

interface Props {
   sale: Sale | null;
   visible: boolean;
   onClose: () => void;
   storeName?: string;
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const SaleReceiptModal: React.FC<Props> = ({
   sale,
   visible,
   onClose,
   storeName = 'JD Store',
}) => {
   if (!sale) return null;

   const [overridePhone, setOverridePhone] = useState(sale.customerPhone || '');

   const dateStr = sale.createdAt?.toDate
      ? sale.createdAt.toDate().toLocaleString('es-ES')
      : new Date().toLocaleString('es-ES');

   const paymentLabels: Record<string, string> = {
      pago_movil: 'Pago Móvil',
      efectivo: 'Efectivo',
      zelle: 'Zelle',
      tarjeta: 'Tarjeta / Punto',
      mixto: 'Mixto',
      transferencia: 'Transferencia',
   };

   const hasSplits = sale.paymentSplits && sale.paymentSplits.length > 0;
   const subtotalReal = sale.subtotal ?? sale.total;

   const appliedCombosList =
      sale.appliedCombos && sale.appliedCombos.length > 0
         ? sale.appliedCombos
         : sale.appliedCombo
            ? [sale.appliedCombo]
            : [];

   const hasCombos = appliedCombosList.length > 0;
   const hasComboAdjustment = hasCombos && !!sale.discount && sale.discount !== 0;
   const isAdjustmentPositive = hasComboAdjustment && sale.discount! > 0;

   const comboItemKeys = new Set<string>();
   appliedCombosList.forEach((c) => {
      (c.itemKeys || []).forEach((key) => comboItemKeys.add(key));
   });

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.overlay}>
            <View style={styles.card}>
               {/* CABECERA ÉXITO */}
               <View style={styles.successBanner}>
                  <CheckCircle2 size={34} color={T.onBar} />
                  <Text style={styles.successTitle}>Venta Registrada con Éxito</Text>
                  <Text style={styles.successSubtitle}>Inventario descontado correctamente</Text>
               </View>

               <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                  {/* ============ TICKET ============ */}
                  <View style={styles.ticketBox}>
                     {/* HEADER */}
                     <View style={styles.ticketHeader}>
                        <Text style={styles.storeTitle}>{storeName}</Text>
                        <Text style={styles.ticketMeta}>
                           Nº #{sale.id ? sale.id.slice(-6).toUpperCase() : 'NUEVO'} · {dateStr}
                        </Text>
                     </View>

                     {/* BADGES DESTACADOS (mayor + combos) */}
                     {(sale.isWholesale || hasCombos) && (
                        <View style={styles.badgeRow}>
                           {sale.isWholesale && (
                              <View style={styles.mayorBadge}>
                                 <Crown size={10} color="#047857" />
                                 <Text style={styles.mayorBadgeText}>PRECIO MAYOR</Text>
                              </View>
                           )}
                           {appliedCombosList.map((c, i) => {
                              const isAdjustment = hasComboAdjustment && sale.discount! < 0;
                              return (
                                 <View
                                    key={c.comboId || `combo_${i}`}
                                    style={[
                                       styles.comboBadge,
                                       isAdjustment && styles.comboBadgeWarn,
                                    ]}
                                 >
                                    <Crown size={10} color={isAdjustment ? '#B45309' : '#7C3AED'} />
                                    <Text
                                       style={[
                                          styles.comboBadgeText,
                                          isAdjustment && { color: '#B45309' },
                                       ]}
                                    >
                                       {c.comboName}
                                    </Text>
                                 </View>
                              );
                           })}
                        </View>
                     )}

                     {/* INFO CLIENTE / PAGO */}
                     {sale.customerName && (
                        <View style={styles.ticketRow}>
                           <Text style={styles.ticketLabel}>Cliente:</Text>
                           <Text style={styles.ticketVal} numberOfLines={2}>{sale.customerName}</Text>
                        </View>
                     )}
                     {!hasSplits && (
                        <View style={styles.ticketRow}>
                           <Text style={styles.ticketLabel}>Método de Pago:</Text>
                           <Text style={styles.ticketVal}>
                              {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                           </Text>
                        </View>
                     )}
                     {hasSplits && (
                        <View style={styles.ticketRow}>
                           <Text style={styles.ticketLabel}>Pago:</Text>
                           <Text style={styles.ticketVal}>
                              {paymentLabels[sale.paymentMethod] || sale.paymentMethod} · {sale.paymentSplits!.length} registro(s)
                           </Text>
                        </View>
                     )}

                     {/* NOTAS */}
                     {sale.notes && sale.notes.trim().length > 0 && (
                        <View style={styles.notesBlock}>
                           <Text style={styles.notesLabel}>Notas</Text>
                           <Text style={styles.notesText}>{sale.notes}</Text>
                        </View>
                     )}

                     <View style={styles.divider} />

                     {/* ITEMS */}
                     <Text style={styles.itemsTitle}>Artículos ({sale.items.length})</Text>
                     {sale.items.map((item, idx) => {
                        const itemKey = `${item.productId}_${item.color}_${item.size}`;
                        const isComboItem = comboItemKeys.has(itemKey);

                        return (
                           <View key={idx} style={styles.itemRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                       {item.brand} - {item.name}
                                    </Text>
                                    {isComboItem && (
                                       <View style={styles.itemComboTag}>
                                          <Text style={styles.itemComboTagText}>COMBO</Text>
                                       </View>
                                    )}
                                 </View>
                                 <Text style={styles.itemSpec}>
                                    {item.color} · Talla: {item.size}
                                 </Text>
                                 <Text style={styles.itemSpec}>
                                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                                 </Text>
                              </View>
                              <Text style={styles.itemSubtotal}>${item.totalPrice.toFixed(2)}</Text>
                           </View>
                        );
                     })}

                     <View style={styles.divider} />

                     {/* TOTALES */}
                     <View style={styles.ticketRow}>
                        <Text style={styles.ticketLabel}>Subtotal:</Text>
                        <Text style={styles.ticketVal}>${subtotalReal.toFixed(2)}</Text>
                     </View>

                     {hasComboAdjustment && (
                        <View style={styles.ticketRow}>
                           <Text
                              style={[
                                 styles.ticketLabel,
                                 { color: isAdjustmentPositive ? '#7C3AED' : '#B45309', fontWeight: '800' },
                              ]}
                           >
                              {isAdjustmentPositive ? 'Descuento Combos' : 'Ajuste Combos'} ({appliedCombosList.length}):
                           </Text>
                           <Text
                              style={[
                                 styles.ticketVal,
                                 { color: isAdjustmentPositive ? '#7C3AED' : '#B45309' },
                              ]}
                           >
                              {isAdjustmentPositive ? '-' : '+'}${Math.abs(sale.discount!).toFixed(2)}
                           </Text>
                        </View>
                     )}

                     <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL:</Text>
                        <Text style={styles.totalValue}>${sale.total.toFixed(2)}</Text>
                     </View>
                  </View>

                  {/* ============ PAGOS ============ */}
                  {hasSplits && (
                     <View style={styles.paymentsBox}>
                        <View style={styles.paymentsHeader}>
                           <Coins size={14} color={T.inkSoft} />
                           <Text style={styles.paymentsTitle}>Pagos recibidos</Text>
                        </View>

                        {sale.paymentSplits!.map((split) => (
                           <View key={split.id} style={styles.paymentRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <Text style={styles.paymentMethod} numberOfLines={1}>
                                    {paymentLabels[split.method] || split.method.replace('_', ' ').toUpperCase()}
                                 </Text>
                                 {split.reference && (
                                    <Text style={styles.paymentRef} numberOfLines={1}>
                                       Ref: {split.reference}
                                    </Text>
                                 )}
                              </View>
                              <Text style={styles.paymentAmount}>
                                 {split.currency === 'USD'
                                    ? `$${split.amount.toFixed(2)}`
                                    : `${split.amount.toFixed(2)} Bs`}
                              </Text>
                           </View>
                        ))}

                        {(sale.totalBS && sale.totalBS > 0) || sale.eurToBsRate || sale.usdToBsRate ? (
                           <View style={styles.paymentMeta}>
                              {sale.totalBS && sale.totalBS > 0 && (
                                 <Text style={styles.paymentMetaLine}>
                                    Equivalente Bs: <Text style={styles.paymentMetaVal}>{sale.totalBS.toFixed(2)} Bs</Text>
                                 </Text>
                              )}
                              {sale.eurToBsRate && (
                                 <Text style={styles.paymentMetaLine}>
                                    Tasa EUR: <Text style={styles.paymentMetaVal}>{sale.eurToBsRate} Bs</Text>
                                 </Text>
                              )}
                              {sale.usdToBsRate && (
                                 <Text style={styles.paymentMetaLine}>
                                    Tasa USD: <Text style={styles.paymentMetaVal}>{sale.usdToBsRate} Bs</Text>
                                 </Text>
                              )}
                           </View>
                        ) : null}
                     </View>
                  )}

                  {/* TELÉFONO */}
                  <Text style={styles.inputLabel}>Enviar comprobante a WhatsApp:</Text>
                  <TextInput
                     style={styles.phoneInput}
                     placeholder="Número WhatsApp (+58...)"
                     placeholderTextColor={T.inkMute}
                     value={overridePhone}
                     onChangeText={setOverridePhone}
                     keyboardType="phone-pad"
                  />
               </ScrollView>

               {/* ACCIONES */}
               <View style={styles.footer}>
                  <P style={styles.whatsAppBtn} onPress={() => openWhatsAppReceipt(sale, overridePhone, storeName)}>
                     <MessageCircle size={17} color={T.onSolid} />
                     <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                  </P>

                  <P style={styles.printBtn} onPress={() => printReceiptHTML(sale, storeName)}>
                     <Printer size={17} color={T.ink} />
                     <Text style={styles.printBtnText}>Imprimir</Text>
                  </P>

                  <P style={styles.closeBtn} onPress={onClose}>
                     <Text style={styles.closeBtnText}>Nueva Venta</Text>
                  </P>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const btn = {
   flexDirection: 'row' as const,
   alignItems: 'center' as const,
   justifyContent: 'center' as const,
   gap: 8,
   height: 48,
   borderRadius: 10,
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

   successBanner: { alignItems: 'center', backgroundColor: T.bar, paddingVertical: 22, paddingHorizontal: 16 },
   successTitle: {
      ...display,
      fontSize: 26,
      lineHeight: 26,
      fontWeight: '800',
      color: T.onBar,
      marginTop: 8,
      textTransform: 'uppercase',
      textAlign: 'center',
   },
   successSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

   // ===== TICKET =====
   ticketBox: { backgroundColor: T.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
   ticketHeader: { alignItems: 'center', marginBottom: 12 },
   storeTitle: {
      ...display,
      fontSize: 24,
      lineHeight: 24,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
      textAlign: 'center',
   },
   ticketMeta: { fontSize: 11, color: T.inkMute, marginTop: 4 },

   // Badges destacados (mayor + combos)
   badgeRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
   mayorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: '#ECFDF5',
      borderWidth: 1,
      borderColor: '#A7F3D0',
      borderRadius: 999,
   },
   mayorBadgeText: { fontSize: 9, fontWeight: '800', color: '#047857', letterSpacing: 0.5 },
   comboBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: '#F5F3FF',
      borderWidth: 1,
      borderColor: '#DDD6FE',
      borderRadius: 999,
   },
   comboBadgeWarn: {
      backgroundColor: '#FEF3C7',
      borderColor: '#FDE68A',
   },
   comboBadgeText: { fontSize: 9, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5 },

   // Notas
   notesBlock: {
      marginTop: 8,
      padding: 10,
      backgroundColor: '#FFFBEB',
      borderWidth: 1,
      borderColor: '#FDE68A',
      borderRadius: 8,
   },
   notesLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#B45309',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
   },
   notesText: {
      fontSize: 12,
      color: '#78350F',
      lineHeight: 17,
   },

   ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
   ticketLabel: { fontSize: 13, color: T.inkSoft, flexShrink: 1 },
   ticketVal: { fontSize: 13, fontWeight: '700', color: T.ink, textAlign: 'right', flexShrink: 1 },
   divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.3)', marginVertical: 12 },
   itemsTitle: { fontSize: 11, fontWeight: '800', color: T.inkSoft, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

   itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
   itemName: { fontSize: 13, fontWeight: '700', color: T.ink, flexShrink: 1 },
   itemSpec: { fontSize: 11, color: T.inkMute, marginTop: 1 },
   itemSubtotal: { fontSize: 14, fontWeight: '800', color: T.ink },
   itemComboTag: { paddingHorizontal: 5, paddingVertical: 1, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 3 },
   itemComboTagText: { fontSize: 8, fontWeight: '800', color: '#7C3AED' },

   totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 2,
      borderTopColor: T.ink,
   },
   totalLabel: { fontSize: 13, fontWeight: '800', color: T.ink, paddingBottom: 6 },
   totalValue: { ...display, fontSize: 44, lineHeight: 44, fontWeight: '800', color: T.ink },

   // ===== PAGOS =====
   paymentsBox: {
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: T.line,
   },
   paymentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
   paymentsTitle: { fontSize: 11, fontWeight: '800', color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
   paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
   },
   paymentMethod: { fontSize: 12, fontWeight: '700', color: T.ink },
   paymentRef: { fontSize: 10, color: T.inkMute, marginTop: 1 },
   paymentAmount: { ...display, fontSize: 14, fontWeight: '800', color: T.ink, textAlign: 'right' },
   paymentMeta: { marginTop: 10, gap: 3 },
   paymentMetaLine: { fontSize: 10, color: T.inkMute },
   paymentMetaVal: { fontWeight: '800', color: T.inkSoft },

   // ===== INPUT WHATSAPP =====
   inputLabel: { fontSize: 12, fontWeight: '700', color: T.inkSoft, marginBottom: 6 },
   phoneInput: {
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 0,
      height: 46,
      fontSize: 14,
      color: T.ink,
      backgroundColor: T.bg,
      textAlignVertical: 'center',
   },

   // ===== FOOTER =====
   footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, backgroundColor: T.surface },
   whatsAppBtn: { ...btn, flexGrow: 1, flexBasis: '46%', backgroundColor: T.solid },
   whatsAppBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
   printBtn: { ...btn, flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   printBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   closeBtn: { ...btn, flexBasis: '100%', borderWidth: 1, borderColor: T.ink, backgroundColor: T.bg },
   closeBtnText: { fontSize: 13, fontWeight: '800', color: T.ink },
});

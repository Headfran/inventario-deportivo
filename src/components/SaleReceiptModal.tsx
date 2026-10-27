import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { CheckCircle2, Printer, MessageCircle } from 'lucide-react-native';
import { Sale } from '../types/sale';
import { openWhatsAppReceipt, printReceiptHTML } from '../utils/receiptUtils';
import { MONO as T, display } from '../design';

interface Props {
   sale: Sale | null;
   visible: boolean;
   onClose: () => void;
   storeName?: string;
}

// Botón con respuesta al presionar
const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const SaleReceiptModal: React.FC<Props> = ({
   sale,
   visible,
   onClose,
   storeName = 'Mi Tienda de Ropa',
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
      otro: 'Otro',
   };

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.overlay}>
            <View style={styles.card}>
               {/* CABECERA ÉXITO (negra, como el banner del panel) */}
               <View style={styles.successBanner}>
                  <CheckCircle2 size={34} color={T.onBar} />
                  <Text style={styles.successTitle}>Venta Registrada con Éxito</Text>
                  <Text style={styles.successSubtitle}>Inventario descontado correctamente</Text>
               </View>

               {/* DETALLE TICKET PREVIEW */}
               <ScrollView style={{ padding: 16 }}>
                  <View style={styles.ticketBox}>
                     <View style={styles.ticketHeader}>
                        <Text style={styles.storeTitle}>{storeName}</Text>
                        <Text style={styles.ticketMeta}>
                           Nº #{sale.id ? sale.id.slice(-6).toUpperCase() : 'NUEVO'} • {dateStr}
                        </Text>
                     </View>

                     {sale.customerName && (
                        <View style={styles.ticketRow}>
                           <Text style={styles.ticketLabel}>Cliente:</Text>
                           <Text style={styles.ticketVal}>{sale.customerName}</Text>
                        </View>
                     )}

                     <View style={styles.ticketRow}>
                        <Text style={styles.ticketLabel}>Método de Pago:</Text>
                        <Text style={styles.ticketVal}>
                           {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                        </Text>
                     </View>

                     <View style={styles.divider} />

                     <Text style={styles.itemsTitle}>Detalle de Artículos ({sale.items.length}):</Text>
                     {sale.items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.itemName}>
                                 {item.productBrand} - {item.productName}
                              </Text>
                              <Text style={styles.itemSpec}>
                                 {item.variantColor} • Talla: {item.size}
                              </Text>
                              <Text style={styles.itemSpec}>
                                 {item.quantity} unidad(es) x ${item.unitPrice.toFixed(2)}
                              </Text>
                           </View>
                           <Text style={styles.itemSubtotal}>${item.subtotal.toFixed(2)}</Text>
                        </View>
                     ))}

                     <View style={styles.divider} />

                     <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL VENTA:</Text>
                        <Text style={styles.totalValue}>${sale.totalAmount.toFixed(2)}</Text>
                     </View>
                  </View>

                  {/* TELÉFONO PARA ENVÍO POR WHATSAPP */}
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

               {/* ACCIONES DEL COMPROBANTE */}
               <View style={styles.footer}>
                  <P style={styles.whatsAppBtn} onPress={() => openWhatsAppReceipt(sale, overridePhone, storeName)}>
                     <MessageCircle size={17} color={T.onSolid} />
                     <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                  </P>

                  <P style={styles.printBtn} onPress={() => printReceiptHTML(sale, storeName)}>
                     <Printer size={17} color={T.ink} />
                     <Text style={styles.printBtnText}>Imprimir Ticket</Text>
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

const btn = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, height: 48, borderRadius: 10 };

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

   successBanner: { alignItems: 'center', backgroundColor: T.bar, paddingVertical: 22, paddingHorizontal: 16 },
   successTitle: { ...display, fontSize: 30, lineHeight: 30, fontWeight: '800', color: T.onBar, marginTop: 8, textTransform: 'uppercase', textAlign: 'center' },
   successSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

   // Ticket: gris muy claro, con separadores punteados
   ticketBox: { backgroundColor: T.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
   ticketHeader: { alignItems: 'center', marginBottom: 12 },
   storeTitle: { ...display, fontSize: 26, lineHeight: 26, fontWeight: '800', color: T.ink, textTransform: 'uppercase', textAlign: 'center' },
   ticketMeta: { fontSize: 12, color: T.inkMute, marginTop: 4 },
   ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   ticketLabel: { fontSize: 13, color: T.inkSoft },
   ticketVal: { fontSize: 13, fontWeight: '700', color: T.ink },
   divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.3)', marginVertical: 12 },
   itemsTitle: { fontSize: 12, fontWeight: '700', color: T.inkSoft, marginBottom: 8 },
   itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
   itemName: { fontSize: 14, fontWeight: '700', color: T.ink },
   itemSpec: { fontSize: 12, color: T.inkMute },
   itemSubtotal: { fontSize: 14, fontWeight: '800', color: T.ink },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
   totalLabel: { fontSize: 13, fontWeight: '800', color: T.inkSoft, paddingBottom: 6 },
   totalValue: { ...display, fontSize: 52, lineHeight: 48, fontWeight: '800', color: T.ink },

   inputLabel: { fontSize: 13, fontWeight: '700', color: T.inkSoft, marginBottom: 6 },
   phoneInput: { borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 14, height: 46, fontSize: 14, color: T.ink, backgroundColor: T.bg },

   footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, backgroundColor: T.surface },
   whatsAppBtn: { ...btn, flexGrow: 1, flexBasis: '46%', backgroundColor: T.solid },
   whatsAppBtnText: { fontSize: 14, fontWeight: '800', color: T.onSolid },
   printBtn: { ...btn, flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   printBtnText: { fontSize: 14, fontWeight: '700', color: T.ink },
   closeBtn: { ...btn, flexBasis: '100%', borderWidth: 1, borderColor: T.ink, backgroundColor: T.bg },
   closeBtnText: { fontSize: 14, fontWeight: '800', color: T.ink },
});

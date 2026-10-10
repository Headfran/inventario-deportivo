import React, { useState } from 'react';
import {
   View,
   Text,
   Modal,
   StyleSheet,
   TouchableOpacity,
   ScrollView,
   TextInput,
} from 'react-native';
import {
   CheckCircle2,
   Printer,
   MessageCircle,
   X,
   Share2,
   ShoppingBag,
   DollarSign,
   User,
} from 'lucide-react-native';
import { Sale } from '../types/sale';
import { openWhatsAppReceipt, printReceiptHTML } from '../utils/receiptUtils';

interface Props {
   sale: Sale | null;
   visible: boolean;
   onClose: () => void;
   storeName?: string;
}

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
               {/* CABECERA ÉXITO */}
               <View style={styles.successBanner}>
                  <CheckCircle2 size={28} color="#16a34a" />
                  <Text style={styles.successTitle}>Venta Registrada con Éxito</Text>
                  <Text style={styles.successSubtitle}>
                     Inventario descontado correctamente
                  </Text>
               </View>

               {/* DETALLE TICKET PREVIEW */}
               <ScrollView style={styles.body}>
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
                              <Text style={styles.itemQtyPrice}>
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
                     placeholderTextColor="#94a3b8"
                     value={overridePhone}
                     onChangeText={setOverridePhone}
                     keyboardType="phone-pad"
                  />
               </ScrollView>

               {/* ACCIONES DEL COMPROBANTE */}
               <View style={styles.footer}>
                  <TouchableOpacity
                     style={styles.whatsAppBtn}
                     onPress={() => openWhatsAppReceipt(sale, overridePhone, storeName)}
                  >
                     <MessageCircle size={16} color="#ffffff" style={{ marginRight: 6 }} />
                     <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={styles.printBtn}
                     onPress={() => printReceiptHTML(sale, storeName)}
                  >
                     <Printer size={16} color="#2563eb" style={{ marginRight: 6 }} />
                     <Text style={styles.printBtnText}>Imprimir Ticket</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                     <Text style={styles.closeBtnText}>Nueva Venta</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   successBanner: { alignItems: 'center', backgroundColor: '#f0fdf4', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#bbf7d0' },
   successTitle: { fontSize: 16, fontWeight: 'bold', color: '#166534', marginTop: 4 },
   successSubtitle: { fontSize: 12, color: '#15803d' },
   body: { padding: 16 },
   ticketBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, marginBottom: 12 },
   ticketHeader: { alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   storeTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' },
   ticketMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
   ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   ticketLabel: { fontSize: 11, color: '#475569' },
   ticketVal: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
   divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 8 },
   itemsTitle: { fontSize: 11, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
   itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
   itemName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   itemSpec: { fontSize: 10, color: '#64748b' },
   itemQtyPrice: { fontSize: 10, color: '#2563eb' },
   itemSubtotal: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
   totalLabel: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   totalValue: { fontSize: 18, fontWeight: '800', color: '#16a34a' },
   inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
   phoneInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 13, color: '#0f172a' },
   footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   whatsAppBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#25d366', paddingVertical: 10, borderRadius: 8 },
   whatsAppBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
   printBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 10, borderRadius: 8 },
   printBtnText: { color: '#2563eb', fontSize: 12, fontWeight: 'bold' },
   closeBtn: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8, justifyContent: 'center' },
   closeBtnText: { color: '#475569', fontSize: 12, fontWeight: 'bold' },
});

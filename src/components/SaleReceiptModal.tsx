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

// Paleta de diseño (un solo lugar para cambiar colores)
const C = {
   bg: '#0A0A0A',
   surface: '#121212',
   raised: '#1A1A1A',
   border: '#262626',
   line: '#2E2E2E',
   white: '#FFFFFF',
   light: '#E8E8E8',
   soft: '#BDBDBD',
   mute: '#8A8A8A',
   dim: '#6A6A6A',
   ink: '#5A5A5A', // texto secundario sobre el "papel" del ticket
};

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
                  <CheckCircle2 size={28} color={C.light} />
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
                     placeholderTextColor={C.dim}
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
                     <MessageCircle size={16} color={C.bg} style={{ marginRight: 6 }} />
                     <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={styles.printBtn}
                     onPress={() => printReceiptHTML(sale, storeName)}
                  >
                     <Printer size={16} color={C.light} style={{ marginRight: 6 }} />
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

// Bases compartidas (evitan repetir estilos)
const caps = { textTransform: 'uppercase' as const, letterSpacing: 1.5 };
const btn = {
   flexDirection: 'row' as const,
   justifyContent: 'center' as const,
   alignItems: 'center' as const,
   paddingVertical: 11,
   borderRadius: 2,
};
const btnText = { ...caps, fontSize: 11, fontWeight: '900' as const };

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },

   successBanner: { alignItems: 'center', backgroundColor: C.raised, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.border },
   successTitle: { ...caps, fontSize: 14, fontWeight: '900', color: C.white, marginTop: 8 },
   successSubtitle: { fontSize: 11, color: C.mute, letterSpacing: 1, marginTop: 2 },

   body: { padding: 16 },

   // Ticket tipo "papel": gris claro con texto oscuro
   ticketBox: { backgroundColor: C.light, borderRadius: 2, padding: 14, marginBottom: 14 },
   ticketHeader: { alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.soft },
   storeTitle: { ...caps, fontSize: 15, fontWeight: '900', color: C.bg },
   ticketMeta: { fontSize: 10, color: C.ink, marginTop: 2 },
   ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   ticketLabel: { fontSize: 11, color: C.ink },
   ticketVal: { fontSize: 11, fontWeight: 'bold', color: C.bg },
   divider: { height: 1, backgroundColor: C.soft, marginVertical: 8 },
   itemsTitle: { fontSize: 11, fontWeight: 'bold', color: C.bg, marginBottom: 6 },
   itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
   itemName: { fontSize: 12, fontWeight: 'bold', color: C.bg },
   itemSpec: { fontSize: 10, color: C.ink },
   itemQtyPrice: { fontSize: 10, color: C.ink },
   itemSubtotal: { fontSize: 12, fontWeight: 'bold', color: C.bg },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
   totalLabel: { ...caps, fontSize: 13, fontWeight: '900', color: C.bg },
   totalValue: { fontSize: 20, fontWeight: '900', color: C.bg },

   inputLabel: { ...caps, fontSize: 10, fontWeight: 'bold', color: C.mute, marginBottom: 6 },
   phoneInput: {
      backgroundColor: C.raised,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 2,
      paddingHorizontal: 12,
      height: 40,
      fontSize: 13,
      color: C.white,
   },

   footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border },
   whatsAppBtn: { ...btn, flex: 1, backgroundColor: C.light },
   whatsAppBtnText: { ...btnText, color: C.bg },
   printBtn: { ...btn, flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3A3A3A' },
   printBtnText: { ...btnText, color: C.light },
   closeBtn: { ...btn, paddingHorizontal: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line },
   closeBtnText: { ...btnText, color: C.soft },
});
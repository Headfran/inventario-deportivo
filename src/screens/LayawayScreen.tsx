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
   Clock,
   Search,
   Plus,
   User,
   MessageCircle,
   X,
   CreditCard,
   Tag,
   ShieldCheck,
   XCircle,
} from 'lucide-react-native';
import {
   Layaway,
   subscribeToLayaways,
   addLayawayPayment,
   cancelLayaway,
   createLayaway,
} from '../services/layawayService';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

interface Props {
   currentSellerName?: string;
   currentSellerId?: string;
}

export const LayawayScreen: React.FC<Props> = ({
   currentSellerName = 'Vendedor Principal',
   currentSellerId = 'v1',
}) => {
   const [layaways, setLayaways] = useState<Layaway[]>([]);
   const [products, setProducts] = useState<Product[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState<string>('active');

   // Modales
   const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);
   const [isNewModalOpen, setIsNewModalOpen] = useState(false);
   const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

   // Formulario Nuevo Apartado
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [initialPayment, setInitialPayment] = useState('');
   const [paymentMethod, setPaymentMethod] = useState<any>('efectivo');
   const [daysToDue, setDaysToDue] = useState('15');
   const [cartItems, setCartItems] = useState<any[]>([]);

   // Formulario Nuevo Abono
   const [abonoAmount, setAbonoAmount] = useState('');
   const [abonoMethod, setAbonoMethod] = useState<any>('efectivo');
   const [abonoNotes, setAbonoNotes] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
      const unsubL = subscribeToLayaways(setLayaways);
      const unsubP = subscribeToProducts(setProducts);
      return () => {
         unsubL();
         unsubP();
      };
   }, []);

   const filteredLayaways = layaways.filter((layaway) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQ =
         !q ||
         (layaway.code && layaway.code.toLowerCase().includes(q)) ||
         (layaway.customerName && layaway.customerName.toLowerCase().includes(q)) ||
         (layaway.customerPhone && layaway.customerPhone.includes(q)) ||
         (layaway.sellerName && layaway.sellerName.toLowerCase().includes(q));

      const matchesStatus =
         statusFilter === 'all' || layaway.status === statusFilter;

      return matchesQ && matchesStatus;
   });

   const handleAddToCart = (product: Product, color: string, size: string) => {
      const pId = product.id || product.code;
      const existing = cartItems.find(
         (i) => i.productId === pId && i.color === color && i.size === size
      );

      if (existing) {
         setCartItems((prev) =>
            prev.map((i) =>
               i.productId === pId && i.color === color && i.size === size
                  ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
                  : i
            )
         );
      } else {
         setCartItems((prev) => [
            ...prev,
            {
               productId: pId,
               brand: product.brand || 'Generico',
               name: product.name || 'Prenda',
               color: color || '',
               size: size || '',
               quantity: 1,
               unitPrice: Number(product.price) || 0,
               totalPrice: Number(product.price) || 0,
            },
         ]);
      }
   };

   const handleSaveLayaway = async () => {
      if (!customerName.trim() || !customerPhone.trim()) {
         Alert.alert('Datos Incompletos', 'Ingresa el nombre y teléfono del cliente.');
         return;
      }
      if (cartItems.length === 0) {
         Alert.alert('Carrito Vacío', 'Agrega al menos una prenda al apartado.');
         return;
      }

      setIsProcessing(true);
      try {
         const dueDate = new Date();
         dueDate.setDate(dueDate.getDate() + (Number(daysToDue) || 15));

         await createLayaway({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            sellerId: currentSellerId,
            sellerName: currentSellerName,
            items: cartItems,
            initialPaymentAmount: Number(initialPayment) || 0,
            paymentMethod,
            dueDate,
         });

         setIsNewModalOpen(false);
         setCartItems([]);
         setCustomerName('');
         setCustomerPhone('');
         setInitialPayment('');
         Alert.alert('¡Éxito!', 'El apartado se ha guardado y el stock ha sido reservado.');
      } catch (error: any) {
         console.error('Error al guardar apartado:', error);
         Alert.alert('Error al guardar', error?.message || 'No se pudo crear el apartado.');
      } finally {
         setIsProcessing(false);
      }
   };

   const handleSaveAbono = async () => {
      if (!selectedLayaway) return;
      const amount = Number(abonoAmount);
      if (!amount || amount <= 0) {
         Alert.alert('Monto Inválido', 'Ingresa un monto de abono válido.');
         return;
      }

      if (amount > selectedLayaway.balanceRemaining) {
         Alert.alert(
            'Monto Excedido',
            `El abono no puede superar el saldo pendiente ($${safeFixed(selectedLayaway.balanceRemaining)}).`
         );
         return;
      }

      setIsProcessing(true);
      try {
         await addLayawayPayment(
            selectedLayaway.id,
            amount,
            abonoMethod,
            currentSellerName,
            abonoNotes
         );
         setIsPaymentModalOpen(false);
         setSelectedLayaway(null);
         setAbonoAmount('');
         setAbonoNotes('');
         Alert.alert('Abono Registrado', 'El abono fue procesado con éxito.');
      } catch (error: any) {
         Alert.alert('Error', error?.message || 'No se pudo registrar el abono.');
      } finally {
         setIsProcessing(false);
      }
   };

   const handleCancelLayaway = async (layaway: Layaway) => {
      Alert.alert(
         'Anular Apartado',
         `¿Deseas cancelar el apartado ${layaway.code}? El stock reservado retornará al inventario activo.`,
         [
            { text: 'No', style: 'cancel' },
            {
               text: 'Sí, Cancelar y Devolver Stock',
               style: 'destructive',
               onPress: async () => {
                  try {
                     await cancelLayaway(layaway, 'Anulado por el cliente');
                     setSelectedLayaway(null);
                     Alert.alert('Apartado Cancelado', 'El stock fue reintegrado al inventario.');
                  } catch (error: any) {
                     Alert.alert('Error', error?.message || 'No se pudo cancelar el apartado.');
                  }
               },
            },
         ]
      );
   };

   const handleSendReminderWA = (layaway: Layaway) => {
      let msg = `🛍️ *RECORDATORIO DE APARTADO*\n`;
      msg += `Hola *${layaway.customerName}*, te recordamos tu apartado *#${layaway.code}*:\n`;
      msg += `• *Total:* $${safeFixed(layaway.totalAmount)}\n`;
      msg += `• *Abonado:* $${safeFixed(layaway.totalPaid)}\n`;
      msg += `• *PENDIENTE:* *$${safeFixed(layaway.balanceRemaining)}*\n`;
      msg += `• *Vence:* ${new Date(layaway.dueDate).toLocaleDateString('es-ES')}\n\n`;
      msg += `¡Pasa por la tienda a retirar tus prendas! 😊`;

      const cleanPhone = (layaway.customerPhone || '').replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      if (typeof window !== 'undefined') window.open(url, '_blank');
   };

   return (
      <View style={styles.container}>
         <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Clock size={22} color="#2563eb" style={{ marginRight: 8 }} />
               <View>
                  <Text style={styles.headerTitle}>Apartados y Pedidos</Text>
                  <Text style={styles.headerSubtitle}>Reserva de stock, abonos y entregas</Text>
               </View>
            </View>

            <TouchableOpacity
               style={styles.newLayawayBtn}
               onPress={() => setIsNewModalOpen(true)}
            >
               <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
               <Text style={styles.newLayawayBtnText}>Nuevo Apartado</Text>
            </TouchableOpacity>
         </View>

         <View style={styles.filterSection}>
            <View style={styles.searchBar}>
               <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por código, cliente o vendedor..."
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
               <TouchableOpacity
                  style={[styles.chip, statusFilter === 'active' && styles.chipActive]}
                  onPress={() => setStatusFilter('active')}
               >
                  <Text style={[styles.chipText, statusFilter === 'active' && styles.chipTextActive]}>
                     Activos / Pendientes
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.chip, statusFilter === 'completed' && styles.chipActive]}
                  onPress={() => setStatusFilter('completed')}
               >
                  <Text style={[styles.chipText, statusFilter === 'completed' && styles.chipTextActive]}>
                     Entregados / Pagados
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.chip, statusFilter === 'cancelled' && styles.chipActive]}
                  onPress={() => setStatusFilter('cancelled')}
               >
                  <Text style={[styles.chipText, statusFilter === 'cancelled' && styles.chipTextActive]}>
                     Cancelados
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.chip, statusFilter === 'all' && styles.chipActive]}
                  onPress={() => setStatusFilter('all')}
               >
                  <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>
                     Todos
                  </Text>
               </TouchableOpacity>
            </ScrollView>
         </View>

         <FlatList
            data={filteredLayaways}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const isCompleted = item.status === 'completed';
               const isCancelled = item.status === 'cancelled';
               const progressPercent = item.totalAmount > 0
                  ? Math.min(100, Math.round((item.totalPaid / item.totalAmount) * 100))
                  : 0;

               return (
                  <TouchableOpacity
                     style={[
                        styles.layawayCard,
                        isCompleted && styles.cardCompleted,
                        isCancelled && styles.cardCancelled,
                     ]}
                     activeOpacity={0.85}
                     onPress={() => setSelectedLayaway(item)}
                  >
                     <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Tag size={16} color={isCompleted ? '#16a34a' : isCancelled ? '#ef4444' : '#2563eb'} />
                           <Text style={styles.layawayCode}>#{item.code || 'N/A'}</Text>
                        </View>

                        {isCompleted ? (
                           <View style={styles.badgeSuccess}>
                              <Text style={styles.badgeSuccessText}>COMPLETADO</Text>
                           </View>
                        ) : isCancelled ? (
                           <View style={styles.badgeDanger}>
                              <Text style={styles.badgeDangerText}>CANCELADO</Text>
                           </View>
                        ) : (
                           <View style={styles.badgeActive}>
                              <Text style={styles.badgeActiveText}>ACTIVO</Text>
                           </View>
                        )}
                     </View>

                     <View style={styles.customerRow}>
                        <User size={13} color="#64748b" />
                        <Text style={styles.customerName}>{item.customerName || 'Cliente'}</Text>
                        <Text style={styles.customerPhone}>({item.customerPhone || 'Sin tel'})</Text>
                     </View>

                     {item.sellerName ? (
                        <Text style={styles.sellerText}>Vendedor: {item.sellerName}</Text>
                     ) : null}

                     <View style={styles.progressSection}>
                        <View style={styles.progressLabels}>
                           <Text style={styles.progressLabelText}>
                              Abonado: ${safeFixed(item.totalPaid)} de${safeFixed(item.totalAmount)}
                           </Text>
                           <Text style={styles.progressPercentText}>{progressPercent}%</Text>
                        </View>

                        <View style={styles.progressBarTrack}>
                           <View
                              style={[
                                 styles.progressBarFill,
                                 { width: `${progressPercent}%` },
                                 isCompleted && { backgroundColor: '#22c55e' },
                              ]}
                           />
                        </View>
                     </View>

                     <View style={styles.cardFooter}>
                        <Text style={styles.balanceText}>
                           Saldo Pendiente:{' '}
                           <Text style={{ color: isCompleted ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>
                              ${safeFixed(item.balanceRemaining)}
                           </Text>
                        </Text>

                        <TouchableOpacity
                           style={styles.waBtnQuick}
                           onPress={(e) => {
                              e.stopPropagation();
                              handleSendReminderWA(item);
                           }}
                        >
                           <MessageCircle size={14} color="#25d366" />
                        </TouchableOpacity>
                     </View>
                  </TouchableOpacity>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <Clock size={36} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No hay apartados registrados</Text>
                  <Text style={styles.emptySubtitle}>
                     Crea un nuevo apartado para reservar prendas del stock y recibir abonos.
                  </Text>
               </View>
            }
         />

         <Modal visible={!!selectedLayaway && !isPaymentModalOpen} transparent animationType="slide">
            {selectedLayaway && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Clock size={18} color="#2563eb" />
                           <Text style={styles.modalTitle}>Apartado #{selectedLayaway.code}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedLayaway(null)}>
                           <X size={20} color="#64748b" />
                        </TouchableOpacity>
                     </View>

                     <ScrollView style={{ padding: 16 }}>
                        <View style={styles.layawaySummaryBox}>
                           <Text style={styles.boxTitle}>Información del Cliente</Text>
                           <Text style={styles.boxVal}>Cliente: {selectedLayaway.customerName}</Text>
                           <Text style={styles.boxVal}>Teléfono: {selectedLayaway.customerPhone}</Text>
                           <Text style={styles.boxVal}>
                              Vendedor Asignado: {selectedLayaway.sellerName || 'N/A'}
                           </Text>
                           <Text style={styles.boxVal}>
                              Vence el:{' '}
                              {new Date(selectedLayaway.dueDate).toLocaleDateString('es-ES')}
                           </Text>
                        </View>

                        <Text style={styles.sectionLabel}>Prendas Reservadas:</Text>
                        <View style={styles.itemsTable}>
                           {(selectedLayaway.items || []).map((i, idx) => (
                              <View key={idx} style={styles.itemRow}>
                                 <Text style={styles.itemText}>
                                    {i.quantity || 1}x {i.brand || ''} - {i.name || ''} ({i.color || ''}/Talla {i.size || ''})
                                 </Text>
                                 <Text style={styles.itemPrice}>${safeFixed(i.totalPrice)}</Text>
                              </View>
                           ))}
                        </View>

                        <Text style={styles.sectionLabel}>Historial de Abonos Parciales:</Text>
                        <View style={styles.paymentsTable}>
                           {(selectedLayaway.payments || []).map((p, idx) => (
                              <View key={idx} style={styles.paymentRow}>
                                 <View>
                                    <Text style={styles.paymentAmountText}>
                                       +${safeFixed(p.amount)} ({(p.paymentMethod || '').replace('_', ' ').toUpperCase()})
                                    </Text>
                                    <Text style={styles.paymentDateText}>
                                       {new Date(p.date).toLocaleString('es-ES')} - {p.registeredBy || 'Sistema'}
                                    </Text>
                                 </View>
                                 <ShieldCheck size={16} color="#16a34a" />
                              </View>
                           ))}
                        </View>

                        <View style={styles.balanceSummaryBox}>
                           <View style={styles.balRow}>
                              <Text style={styles.balLabel}>Monto Total:</Text>
                              <Text style={styles.balVal}>${safeFixed(selectedLayaway.totalAmount)}</Text>
                           </View>
                           <View style={styles.balRow}>
                              <Text style={styles.balLabel}>Total Abonado:</Text>
                              <Text style={styles.balValPaid}>${safeFixed(selectedLayaway.totalPaid)}</Text>
                           </View>
                           <View style={[styles.balRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1' }]}>
                              <Text style={styles.balMainLabel}>SALDO PENDIENTE:</Text>
                              <Text style={styles.balMainVal}>${safeFixed(selectedLayaway.balanceRemaining)}</Text>
                           </View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        {selectedLayaway.status === 'active' && (
                           <TouchableOpacity
                              style={styles.addAbonoBtn}
                              onPress={() => setIsPaymentModalOpen(true)}
                           >
                              <CreditCard size={16} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.addAbonoBtnText}>Registrar Abono</Text>
                           </TouchableOpacity>
                        )}

                        {selectedLayaway.status === 'active' && (
                           <TouchableOpacity
                              style={styles.cancelBtn}
                              onPress={() => handleCancelLayaway(selectedLayaway)}
                           >
                              <XCircle size={16} color="#ef4444" style={{ marginRight: 4 }} />
                              <Text style={styles.cancelBtnText}>Anular</Text>
                           </TouchableOpacity>
                        )}
                     </View>
                  </View>
               </View>
            )}
         </Modal>

         <Modal visible={isPaymentModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.smallModalCard}>
                  <View style={styles.modalHeader}>
                     <Text style={styles.modalTitle}>Registrar Abono</Text>
                     <TouchableOpacity onPress={() => setIsPaymentModalOpen(false)}>
                        <X size={18} color="#64748b" />
                     </TouchableOpacity>
                  </View>

                  <View style={{ padding: 16 }}>
                     <Text style={styles.inputLabel}>Monto a Abonar ($):</Text>
                     <TextInput
                        style={styles.inputField}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={abonoAmount}
                        onChangeText={setAbonoAmount}
                     />

                     <Text style={styles.inputLabel}>Método de Pago:</Text>
                     <View style={styles.methodGrid}>
                        {['efectivo', 'pago_movil', 'punto', 'transferencia'].map((m) => (
                           <TouchableOpacity
                              key={m}
                              style={[styles.methodChip, abonoMethod === m && styles.methodChipActive]}
                              onPress={() => setAbonoMethod(m as any)}
                           >
                              <Text style={[styles.methodChipText, abonoMethod === m && styles.methodChipTextActive]}>
                                 {m.replace('_', ' ').toUpperCase()}
                              </Text>
                           </TouchableOpacity>
                        ))}
                     </View>

                     <TouchableOpacity
                        style={styles.saveAbonoSubmitBtn}
                        onPress={handleSaveAbono}
                        disabled={isProcessing}
                     >
                        <Text style={styles.saveAbonoSubmitText}>
                           {isProcessing ? 'Procesando...' : 'Confirmar Abono'}
                        </Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>

         <Modal visible={isNewModalOpen} transparent animationType="slide">
            <View style={styles.modalOverlay}>
               <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                     <Text style={styles.modalTitle}>Crear Nuevo Apartado</Text>
                     <TouchableOpacity onPress={() => setIsNewModalOpen(false)}>
                        <X size={20} color="#64748b" />
                     </TouchableOpacity>
                  </View>

                  <ScrollView style={{ padding: 16 }}>
                     <Text style={styles.inputLabel}>Nombre del Cliente *:</Text>
                     <TextInput
                        style={styles.inputField}
                        placeholder="Ej. Juan Pérez"
                        value={customerName}
                        onChangeText={setCustomerName}
                     />

                     <Text style={styles.inputLabel}>Teléfono / WhatsApp *:</Text>
                     <TextInput
                        style={styles.inputField}
                        placeholder="Ej. +584121234567"
                        keyboardType="phone-pad"
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                     />

                     <Text style={styles.inputLabel}>Días para Vencimiento:</Text>
                     <TextInput
                        style={styles.inputField}
                        placeholder="15"
                        keyboardType="numeric"
                        value={daysToDue}
                        onChangeText={setDaysToDue}
                     />

                     <Text style={styles.sectionLabel}>Seleccionar Prendas del Stock:</Text>
                     <View style={styles.productPickerBox}>
                        {products.slice(0, 10).map((prod) => (
                           <View key={prod.id || prod.code} style={styles.pickerProductRow}>
                              <Text style={styles.pickerProdName}>
                                 {prod.brand || 'Marca'} - {prod.name} (${Number(prod.price || 0).toFixed(2)})
                              </Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                 {(prod.variants || []).map((v, vIdx) =>
                                    (v.sizes || [])
                                       .filter((s) => Number(s.stock) > 0)
                                       .map((s, sIdx) => (
                                          <TouchableOpacity
                                             key={`${vIdx}-${sIdx}`}
                                             style={styles.addVariantChip}
                                             onPress={() => handleAddToCart(prod, v.color, s.size)}
                                          >
                                             <Text style={styles.addVariantText}>
                                                + {v.color}/{s.size}
                                             </Text>
                                          </TouchableOpacity>
                                       ))
                                 )}
                              </ScrollView>
                           </View>
                        ))}
                     </View>

                     <Text style={styles.sectionLabel}>Prendas Seleccionadas ({cartItems.length}):</Text>
                     {cartItems.map((item, idx) => (
                        <View key={idx} style={styles.cartRow}>
                           <Text style={styles.cartText}>
                              {item.quantity}x {item.brand} {item.name} ({item.color}/{item.size})
                           </Text>
                           <Text style={styles.cartPrice}>${safeFixed(item.totalPrice)}</Text>
                           <TouchableOpacity
                              onPress={() => setCartItems((prev) => prev.filter((_, i) => i !== idx))}
                           >
                              <X size={14} color="#ef4444" style={{ marginLeft: 6 }} />
                           </TouchableOpacity>
                        </View>
                     ))}

                     <Text style={styles.inputLabel}>Abono Inicial ($):</Text>
                     <TextInput
                        style={styles.inputField}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={initialPayment}
                        onChangeText={setInitialPayment}
                     />
                  </ScrollView>

                  <View style={styles.modalFooter}>
                     <TouchableOpacity
                        style={styles.saveLayawayBtn}
                        onPress={handleSaveLayaway}
                        disabled={isProcessing}
                     >
                        <Text style={styles.saveLayawayText}>
                           {isProcessing ? 'Reservando Stock...' : 'Guardar y Reservar Stock'}
                        </Text>
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
   newLayawayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
   },
   newLayawayBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

   filterSection: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#ffffff' },
   searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 40,
      marginBottom: 10,
   },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   chipsScroll: { flexDirection: 'row', paddingBottom: 10 },
   chip: {
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 6,
   },
   chipActive: { backgroundColor: '#2563eb' },
   chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },

   listContent: { padding: 16 },
   layawayCard: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
   },
   cardCompleted: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
   cardCancelled: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
   cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   layawayCode: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
   badgeSuccess: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   badgeSuccessText: { fontSize: 9, fontWeight: 'bold', color: '#16a34a' },
   badgeDanger: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   badgeDangerText: { fontSize: 9, fontWeight: 'bold', color: '#ef4444' },
   badgeActive: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   badgeActiveText: { fontSize: 9, fontWeight: 'bold', color: '#2563eb' },

   customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
   customerName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   customerPhone: { fontSize: 11, color: '#64748b' },
   sellerText: { fontSize: 11, color: '#64748b', marginTop: 2 },

   progressSection: { marginTop: 10 },
   progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
   progressLabelText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   progressPercentText: { fontSize: 11, fontWeight: 'bold', color: '#2563eb' },
   progressBarTrack: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
   progressBarFill: { height: '100%', backgroundColor: '#2563eb' },

   cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
   balanceText: { fontSize: 12, color: '#475569' },
   waBtnQuick: { backgroundColor: '#dcfce7', padding: 6, borderRadius: 6 },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
   emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
   emptySubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 280 },

   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   smallModalCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },

   layawaySummaryBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
   boxTitle: { fontSize: 11, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 },
   boxVal: { fontSize: 12, color: '#334155', marginVertical: 1 },

   sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 10, marginBottom: 6 },
   itemsTable: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
   itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   itemText: { fontSize: 12, color: '#0f172a', flex: 1 },
   itemPrice: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },

   paymentsTable: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
   paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   paymentAmountText: { fontSize: 12, fontWeight: 'bold', color: '#16a34a' },
   paymentDateText: { fontSize: 10, color: '#64748b' },

   balanceSummaryBox: { marginTop: 12, backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', padding: 10 },
   balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
   balLabel: { fontSize: 11, color: '#1e40af' },
   balVal: { fontSize: 12, color: '#1e40af', fontWeight: 'bold' },
   balValPaid: { fontSize: 12, color: '#16a34a', fontWeight: 'bold' },
   balMainLabel: { fontSize: 13, color: '#1e3a8a', fontWeight: 'bold' },
   balMainVal: { fontSize: 16, color: '#ef4444', fontWeight: '800' },

   modalFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   addAbonoBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8 },
   addAbonoBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
   cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' },
   cancelBtnText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },

   inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 10, marginBottom: 4 },
   inputField: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#ffffff' },
   methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
   methodChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
   methodChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   methodChipText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
   methodChipTextActive: { color: '#ffffff' },
   saveAbonoSubmitBtn: { backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 12 },
   saveAbonoSubmitText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

   productPickerBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, maxHeight: 180 },
   pickerProductRow: { marginBottom: 8 },
   pickerProdName: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
   addVariantChip: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 4 },
   addVariantText: { fontSize: 10, color: '#2563eb', fontWeight: 'bold' },

   cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   cartText: { fontSize: 11, color: '#334155', flex: 1 },
   cartPrice: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
   saveLayawayBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', width: '100%' },
   saveLayawayText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
});

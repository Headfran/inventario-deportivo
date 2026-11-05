import React, { useState, useEffect, useMemo } from 'react';
import {
   View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import {
   X, Plus, Minus, Trash2, Search, Save, ArrowRightLeft,
   AlertTriangle, Coins, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { Cover } from '../components/Cover';
import { Sale, SaleItem, editSale } from '../services/salesHistoryService';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';
import { showAlert, showConfirm } from '../utils/alert';
import { MONO as T, display } from '../design';

interface Props {
   sale: Sale | null;
   visible: boolean;
   onClose: () => void;
   onSaved: () => void;
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const paymentLabels: Record<string, string> = {
   pago_movil: 'Pago Móvil',
   efectivo: 'Efectivo',
   zelle: 'Zelle',
   binance: 'Binance',
   transferencia: 'Transferencia',
   mixto: 'Mixto',
   punto: 'Punto',
};

export const EditSaleModal: React.FC<Props> = ({ sale, visible, onClose, onSaved }) => {
   const [items, setItems] = useState<SaleItem[]>([]);
   const [reason, setReason] = useState('');
   const [adjustmentMethod, setAdjustmentMethod] = useState('efectivo');
   const [saving, setSaving] = useState(false);

   const [products, setProducts] = useState<Product[]>([]);
   const [showPicker, setShowPicker] = useState(false);
   const [search, setSearch] = useState('');
   const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

   const [isPickerSearchFocused, setIsPickerSearchFocused] = useState(false);

   // Bloqueos por complejidad
   const hasCombos = !!(sale?.appliedCombos?.length || sale?.appliedCombo);
   const hasSplits = !!(sale?.paymentSplits?.length);
   const isVoided = sale?.status === 'voided';
   const isBlocked = hasCombos || hasSplits || isVoided;

   useEffect(() => {
      if (!visible) return;
      const unsub = subscribeToProducts(setProducts);
      return unsub;
   }, [visible]);

   useEffect(() => {
      if (visible && sale) {
         setItems(sale.items.map((i) => ({ ...i })));
         setReason('');
         setAdjustmentMethod(sale.paymentMethod === 'pago_movil' ? 'pago_movil' : 'efectivo');
         setShowPicker(false);
         setSearch('');
         setExpandedProductId(null);
      }
   }, [visible, sale]);

   const newSubtotal = useMemo(
      () => items.reduce((s, i) => s + i.totalPrice, 0),
      [items]
   );

   // Nota: si la venta tenía descuento (combo), se bloquea. Solo descuentos manuales se preservan aquí.
   const newDiscount = sale?.discount && !hasCombos ? Math.min(sale.discount, newSubtotal) : 0;
   const newTotal = Math.max(0, newSubtotal - newDiscount);

   const totalDiff = sale ? newTotal - sale.total : 0;
   const isRefund = totalDiff < 0;
   const isCharge = totalDiff > 0;
   const diffAmount = Math.abs(totalDiff);

   const adjustQty = (idx: number, delta: number) => {
      setItems((prev) => {
         const next = [...prev];
         const item = { ...next[idx] };
         const newQty = item.quantity + delta;
         if (newQty <= 0) {
            next.splice(idx, 1);
         } else {
            item.quantity = newQty;
            item.totalPrice = item.unitPrice * newQty;
            next[idx] = item;
         }
         return next;
      });
   };

   const removeItem = (idx: number) => {
      setItems((prev) => prev.filter((_, i) => i !== idx));
   };

   const addItem = (product: Product, colorIdx: number, size: string) => {
      const variant = product.variants[colorIdx];
      if (!variant) return;
      const sizeObj = variant.sizes.find((s) => s.size === size);
      const availableStock = Number(sizeObj?.stock) || 0;
      if (availableStock <= 0) {
         showAlert('Sin stock', 'Esta talla está agotada.');
         return;
      }

      const productId = product.id || product.code || 'unknown';
      const key = `${productId}_${variant.color}_${size}`;
      const existingIdx = items.findIndex((i) => `${i.productId}_${i.color}_${i.size}` === key);

      if (existingIdx > -1) {
         if (items[existingIdx].quantity + 1 > availableStock) {
            showAlert('Sin stock', `Solo hay ${availableStock} disponibles.`);
            return;
         }
         adjustQty(existingIdx, 1);
      } else {
         const unitPrice = Number(product.price) || 0;
         const newItem: SaleItem = {
            productId,
            productCode: product.code || 'S/N',
            brand: product.brand || 'Genérico',
            name: product.name,
            color: variant.color,
            size,
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice,
            purchasePrice: Number((product as any).purchasePrice) || undefined,
         };
         setItems((prev) => [...prev, newItem]);
      }
      setShowPicker(false);
      setSearch('');
      setExpandedProductId(null);
   };

   const handleSave = async () => {
      if (!sale || saving) return;
      if (items.length === 0) {
         showAlert('Venta vacía', 'No puedes dejar la venta sin artículos. Usa "Anular" en su lugar.');
         return;
      }
      if (!reason.trim()) {
         showAlert('Motivo requerido', 'Indica el motivo del cambio.');
         return;
      }

      const summary = isRefund
         ? `Se devolverán $${diffAmount.toFixed(2)} al cliente vía ${paymentLabels[adjustmentMethod] || adjustmentMethod}.`
         : isCharge
            ? `Se cobrarán $${diffAmount.toFixed(2)} extra vía ${paymentLabels[adjustmentMethod] || adjustmentMethod}.`
            : 'No hay diferencia de pago.';

      showConfirm(
         'Confirmar Edición',
         `${summary}\n\n¿Guardar cambios en la venta #${sale.receiptNumber}?`,
         async () => {
            try {
               setSaving(true);
               await editSale({
                  sale,
                  newItems: items,
                  newSubtotal,
                  newDiscount,
                  newTotal,
                  reason: reason.trim(),
                  adjustmentMethod: totalDiff !== 0 ? adjustmentMethod : undefined,
               });
               showAlert('Listo', 'La venta fue actualizada y el stock ajustado.');
               onSaved();
               onClose();
            } catch (err: any) {
               showAlert('Error', err?.message || 'No se pudo actualizar la venta.');
            } finally {
               setSaving(false);
            }
         }
      );
   };

   const filteredProducts = useMemo(() => {
      const q = search.toLowerCase().trim();
      if (!q) return products.slice(0, 30);
      return products
         .filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
         )
         .slice(0, 30);
   }, [products, search]);

   if (!sale) return null;

   return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                     <ArrowRightLeft size={20} color={T.onBar} />
                     <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.title}>Editar Venta</Text>
                        <Text style={styles.subtitle}>#{sale.receiptNumber}</Text>
                     </View>
                  </View>
                  <P onPress={onClose} disabled={saving}>
                     <X size={20} color={T.onBar} />
                  </P>
               </View>

               {isBlocked && (
                  <View style={styles.blockedBanner}>
                     <AlertTriangle size={16} color="#B45309" />
                     <Text style={styles.blockedText}>
                        {isVoided
                           ? 'Esta venta está anulada. No se puede editar.'
                           : hasCombos
                              ? 'Esta venta tiene combos aplicados. Anula la venta y crea una nueva.'
                              : 'Esta venta tiene pagos divididos. Anula la venta y crea una nueva.'}
                     </Text>
                  </View>
               )}

               {!isBlocked && (
                  <>
                     <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                        {/* ITEMS ACTUALES */}
                        <View style={styles.sectionHeaderRow}>
                           <Text style={styles.sectionLabel}>Artículos actuales</Text>
                           <P style={styles.addItemBtn} onPress={() => setShowPicker(!showPicker)}>
                              <Plus size={12} color={T.pill} />
                              <Text style={styles.addItemBtnText}>
                                 {showPicker ? 'Cerrar' : 'Agregar prenda'}
                              </Text>
                           </P>
                        </View>

                        {items.map((item, idx) => (
                           <View key={`${item.productId}_${item.color}_${item.size}`} style={styles.itemRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <Text style={styles.itemName} numberOfLines={1}>
                                    {item.brand} - {item.name}
                                 </Text>
                                 <Text style={styles.itemMeta}>
                                    {item.color} · Talla {item.size} · ${item.unitPrice.toFixed(2)}
                                 </Text>
                              </View>
                              <View style={styles.qtyControls}>
                                 <P style={styles.qtyBtn} onPress={() => adjustQty(idx, -1)}>
                                    <Minus size={12} color={T.ink} />
                                 </P>
                                 <Text style={styles.qtyValue}>{item.quantity}</Text>
                                 <P style={styles.qtyBtn} onPress={() => adjustQty(idx, 1)}>
                                    <Plus size={12} color={T.ink} />
                                 </P>
                              </View>
                              <Text style={styles.itemTotal}>${item.totalPrice.toFixed(2)}</Text>
                              <P style={styles.deleteBtn} onPress={() => removeItem(idx)}>
                                 <Trash2 size={12} color="#DC2626" />
                              </P>
                           </View>
                        ))}

                        {/* PICKER DE PRODUCTOS */}
                        {showPicker && (
                           <View style={styles.pickerBox}>
                              <View style={[styles.pickerSearch, isPickerSearchFocused && styles.pickerSearchFocused]}>
                                 <Search size={16} color={isPickerSearchFocused ? T.ink : T.inkMute} />
                                 <TextInput
                                    style={styles.pickerSearchInput}
                                    placeholder="Buscar prenda..."
                                    placeholderTextColor={T.inkMute}
                                    value={search}
                                    onChangeText={setSearch}
                                    onFocus={() => setIsPickerSearchFocused(true)}
                                    onBlur={() => setIsPickerSearchFocused(false)}
                                    autoFocus
                                 />
                                 {search.length > 0 && (
                                    <P onPress={() => setSearch('')}>
                                       <X size={14} color={T.inkMute} />
                                    </P>
                                 )}
                              </View>

                              <ScrollView style={{ maxHeight: 260 }}>
                                 {filteredProducts.length === 0 ? (
                                    <Text style={styles.pickerEmpty}>No hay resultados.</Text>
                                 ) : (
                                    filteredProducts.map((p) => {
                                       const expanded = expandedProductId === (p.id || p.code);
                                       return (
                                          <View key={p.id || p.code} style={styles.pickerItem}>
                                             <P
                                                style={styles.pickerItemRow}
                                                onPress={() => setExpandedProductId(expanded ? null : (p.id || p.code || null))}
                                             >
                                                <Cover
                                                   uri={p.images?.[0]}
                                                   name={p.name}
                                                   bg={T.imgBg}
                                                   fg={T.line}
                                                   style={styles.pickerItemImg}
                                                />
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                   <Text style={styles.pickerItemName} numberOfLines={1}>
                                                      {p.brand} - {p.name}
                                                   </Text>
                                                   <Text style={styles.pickerItemMeta}>
                                                      SKU: {p.code} · ${Number(p.price).toFixed(2)}
                                                   </Text>
                                                </View>
                                                {expanded ? (
                                                   <ChevronUp size={16} color={T.inkMute} />
                                                ) : (
                                                   <ChevronDown size={16} color={T.inkMute} />
                                                )}
                                             </P>
                                             {expanded && (
                                                <View style={styles.pickerVariants}>
                                                   {(p.variants || []).map((v, vIdx) => (
                                                      <View key={vIdx} style={{ marginBottom: 8 }}>
                                                         <Text style={styles.variantColor}>{v.color}</Text>
                                                         <View style={styles.variantSizesRow}>
                                                            {(v.sizes || []).map((sObj) => {
                                                               const stock = Number(sObj.stock) || 0;
                                                               return (
                                                                  <P
                                                                     key={sObj.size}
                                                                     style={[styles.variantSizeChip, stock <= 0 && { opacity: 0.35 }]}
                                                                     onPress={() => stock > 0 && addItem(p, vIdx, sObj.size)}
                                                                     disabled={stock <= 0}
                                                                  >
                                                                     <Text style={styles.variantSizeText}>
                                                                        {sObj.size} ({stock})
                                                                     </Text>
                                                                  </P>
                                                               );
                                                            })}
                                                         </View>
                                                      </View>
                                                   ))}
                                                </View>
                                             )}
                                          </View>
                                       );
                                    })
                                 )}
                              </ScrollView>
                           </View>
                        )}

                        <View style={styles.divider} />

                        {/* TOTALES COMPARATIVOS */}
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Total anterior:</Text>
                           <Text style={styles.compareValueMuted}>${sale.total.toFixed(2)}</Text>
                        </View>
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Nuevo total:</Text>
                           <Text style={styles.compareValue}>${newTotal.toFixed(2)}</Text>
                        </View>

                        {totalDiff !== 0 && (
                           <View style={[
                              styles.diffBox,
                              isRefund ? styles.diffBoxRefund : styles.diffBoxCharge,
                           ]}>
                              <Coins size={16} color={isRefund ? '#DC2626' : '#047857'} />
                              <View style={{ flex: 1 }}>
                                 <Text style={[styles.diffTitle, { color: isRefund ? '#DC2626' : '#047857' }]}>
                                    {isRefund ? 'Reembolso al cliente' : 'Cobro adicional'}
                                 </Text>
                                 <Text style={styles.diffSub}>
                                    ${diffAmount.toFixed(2)} vía {paymentLabels[adjustmentMethod] || adjustmentMethod}
                                 </Text>
                              </View>
                              <Text style={[styles.diffAmount, { color: isRefund ? '#DC2626' : '#047857' }]}>
                                 {isRefund ? '-' : '+'}${diffAmount.toFixed(2)}
                              </Text>
                           </View>
                        )}

                        {totalDiff !== 0 && (
                           <>
                              <Text style={[styles.label, { marginTop: 12 }]}>
                                 Método de {isRefund ? 'reembolso' : 'cobro'}:
                              </Text>
                              <View style={styles.methodsRow}>
                                 {['efectivo', 'pago_movil', 'zelle', 'binance', 'transferencia'].map((m) => (
                                    <P
                                       key={m}
                                       style={[styles.methodChip, adjustmentMethod === m && styles.methodChipActive]}
                                       onPress={() => setAdjustmentMethod(m)}
                                    >
                                       <Text style={[styles.methodChipText, adjustmentMethod === m && styles.methodChipTextActive]}>
                                          {paymentLabels[m]}
                                       </Text>
                                    </P>
                                 ))}
                              </View>
                           </>
                        )}

                        <Text style={[styles.label, { marginTop: 12 }]}>Motivo del cambio *</Text>
                        <TextInput
                           style={styles.reasonInput}
                           value={reason}
                           onChangeText={setReason}
                           placeholder="Ej. Prenda defectuosa, cambio de talla..."
                           placeholderTextColor={T.inkMute}
                           multiline
                           editable={!saving}
                        />
                     </ScrollView>

                     <View style={styles.footer}>
                        <P style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                           <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </P>
                        <P
                           style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                           onPress={handleSave}
                           disabled={saving}
                        >
                           {saving ? (
                              <ActivityIndicator size="small" color={T.onSolid} />
                           ) : (
                              <>
                                 <Save size={14} color={T.onSolid} />
                                 <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                              </>
                           )}
                        </P>
                     </View>
                  </>
               )}

               {isBlocked && (
                  <View style={styles.footer}>
                     <P style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cerrar</Text>
                     </P>
                  </View>
               )}
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 500, maxHeight: '92%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: T.bar },
   title: { ...display, fontSize: 20, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
   pressed: { opacity: 0.85 },

   blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
   blockedText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '700' },

   sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
   sectionLabel: { fontSize: 12, fontWeight: '800', color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
   addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.solid, borderRadius: 8 },
   addItemBtnText: { fontSize: 11, fontWeight: '800', color: T.onSolid },

   itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.line },
   itemName: { fontSize: 13, fontWeight: '700', color: T.ink },
   itemMeta: { fontSize: 11, color: T.inkMute, marginTop: 1 },
   qtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.surface },
   qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
   qtyValue: { ...display, fontSize: 14, fontWeight: '800', color: T.ink, minWidth: 22, textAlign: 'center' },
   itemTotal: { fontSize: 13, fontWeight: '800', color: T.ink, minWidth: 62, textAlign: 'right' },
   deleteBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },

   pickerBox: { marginTop: 10, backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.line, padding: 10 },
   pickerEmpty: { fontSize: 12, color: T.inkMute, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
   pickerItem: { borderBottomWidth: 1, borderBottomColor: T.line },
   pickerVariants: { paddingLeft: 22, paddingBottom: 10 },
   pickerSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      marginBottom: 8,
   },
   pickerSearchFocused: {
      borderColor: T.ink,
      borderWidth: 1.5,
   },
   pickerSearchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      color: T.ink,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      textAlignVertical: 'center',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   pickerItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 4,
   },
   pickerItemImg: {
      width: 40,
      height: 50,
      borderRadius: 6,
   },
   pickerItemName: {
      fontSize: 13,
      fontWeight: '700',
      color: T.ink,
   },
   pickerItemMeta: {
      fontSize: 11,
      color: T.inkMute,
      marginTop: 1,
   },
   variantColor: { fontSize: 11, fontWeight: '700', color: T.inkSoft, marginBottom: 4 },
   variantSizesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
   variantSizeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   variantSizeText: { fontSize: 11, fontWeight: '700', color: T.ink },

   divider: { height: 1, backgroundColor: T.line, marginVertical: 14 },

   compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
   compareLabel: { fontSize: 13, color: T.inkSoft, fontWeight: '600' },
   compareValueMuted: { ...display, fontSize: 20, fontWeight: '800', color: T.inkMute },
   compareValue: { ...display, fontSize: 26, fontWeight: '800', color: T.ink },

   diffBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
   diffBoxRefund: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
   diffBoxCharge: { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' },
   diffTitle: { fontSize: 12, fontWeight: '800' },
   diffSub: { fontSize: 11, color: T.inkMute, marginTop: 1 },
   diffAmount: { ...display, fontSize: 20, fontWeight: '800' },

   label: { fontSize: 11, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
   methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   methodChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   methodChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   methodChipText: { fontSize: 11, fontWeight: '700', color: T.inkSoft },
   methodChipTextActive: { color: T.onSolid },

   reasonInput: { borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: T.ink, minHeight: 70, textAlignVertical: 'top' },

   footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line },
   cancelBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
   cancelBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   saveBtn: { flex: 1, height: 46, borderRadius: 10, backgroundColor: T.solid, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
   saveBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
});

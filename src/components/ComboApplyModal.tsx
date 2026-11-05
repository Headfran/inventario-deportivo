import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X, Crown, Check, AlertCircle, Plus, Minus, Trash2 } from 'lucide-react-native';
import { Combo, AppliedCombo } from '../types/combo';
import { SaleItem } from '../types/sale';
import { Product } from '../types/inventory';
import { checkMultiComboEligibility } from '../services/comboService';
import { MONO as T, display } from '../design';

interface Props {
   visible: boolean;
   onClose: () => void;
   combos: Combo[];
   cart: SaleItem[];
   products: Product[];
   appliedCombos: AppliedCombo[];
   onChange: (next: AppliedCombo[]) => void;
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const ComboApplyModal: React.FC<Props> = ({
   visible, onClose, combos, cart, products, appliedCombos, onChange,
}) => {
   const info = checkMultiComboEligibility(cart, products, combos, appliedCombos);

   const getAppliedQty = (comboId: string) =>
      appliedCombos.find((a) => a.comboId === comboId)?.quantity || 0;

   const handleAdd = (combo: Combo) => {
      const existing = appliedCombos.find((a) => a.comboId === combo.id);
      if (existing) {
         onChange(appliedCombos.map((a) => a.comboId === combo.id ? { ...a, quantity: a.quantity + 1 } : a));
      } else {
         onChange([...appliedCombos, { comboId: combo.id!, quantity: 1 }]);
      }
   };

   const handleDecrement = (comboId: string) => {
      onChange(appliedCombos.flatMap((a) => {
         if (a.comboId !== comboId) return [a];
         return a.quantity > 1 ? [{ ...a, quantity: a.quantity - 1 }] : [];
      }));
   };

   const handleRemove = (comboId: string) => {
      onChange(appliedCombos.filter((a) => a.comboId !== comboId));
   };

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                     <Crown size={18} color={T.onBar} />
                     <Text style={styles.title}>Combos</Text>
                     {info.eligibleCount > 0 && (
                        <View style={styles.headerBadge}>
                           <Text style={styles.headerBadgeText}>{info.eligibleCount}/{info.totalCount}</Text>
                        </View>
                     )}
                  </View>
                  <P onPress={onClose}>
                     <X size={20} color={T.onBar} />
                  </P>
               </View>

               {/* RESUMEN */}
               {info.totalCount > 0 && (
                  <View style={[
                     styles.summaryBox,
                     info.allEligible ? styles.summaryBoxOk : styles.summaryBoxWarn,
                  ]}>
                     <Text style={[
                        styles.summaryText,
                        info.allEligible ? { color: '#047857' } : { color: '#B45309' },
                     ]}>
                        {info.eligibleCount}/{info.totalCount} combos aplicados
                        {info.totalDiscount !== 0 && (
                           <> · {info.totalDiscount > 0 ? 'Descuento' : 'Ajuste'}: ${Math.abs(info.totalDiscount).toFixed(2)}</>
                        )}
                     </Text>
                  </View>
               )}

               <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                  {combos.length === 0 ? (
                     <Text style={styles.emptyText}>No hay combos disponibles.</Text>
                  ) : (
                     combos.map((combo) => {
                        const qty = getAppliedQty(combo.id!);
                        const canApplyOne = checkMultiComboEligibility(
                           cart, products, combos,
                           [...appliedCombos.filter((a) => a.comboId !== combo.id), { comboId: combo.id!, quantity: qty + 1 }]
                        ).allEligible;

                        return (
                           <View key={combo.id} style={[styles.comboCard, qty > 0 && styles.comboCardActive]}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <Text style={styles.comboName}>{combo.name}</Text>
                                 <Text style={styles.comboReq}>
                                    {combo.requirements.map((r) => `${r.quantity}× ${r.category}`).join(' + ')}
                                 </Text>
                                 <Text style={styles.comboPrice}>${combo.price.toFixed(2)}</Text>
                              </View>

                              {qty === 0 ? (
                                 <P
                                    style={[styles.applyBtn, !canApplyOne && { opacity: 0.4 }]}
                                    onPress={() => canApplyOne && handleAdd(combo)}
                                    disabled={!canApplyOne}
                                 >
                                    <Plus size={13} color={T.onSolid} />
                                    <Text style={styles.applyBtnText}>Agregar</Text>
                                 </P>
                              ) : (
                                 <View style={styles.counterBox}>
                                    <P style={styles.counterBtn} onPress={() => handleDecrement(combo.id!)}>
                                       <Minus size={13} color={T.ink} />
                                    </P>
                                    <Text style={styles.counterValue}>{qty}</Text>
                                    <P style={styles.counterBtn} onPress={() => canApplyOne && handleAdd(combo)} disabled={!canApplyOne}>
                                       <Plus size={13} color={canApplyOne ? T.ink : T.inkMute} />
                                    </P>
                                    <P style={styles.removeBtn} onPress={() => handleRemove(combo.id!)}>
                                       <Trash2 size={12} color="#DC2626" />
                                    </P>
                                 </View>
                              )}
                           </View>
                        );
                     })
                  )}
               </ScrollView>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: T.bar, gap: 8 },
   title: { ...display, fontSize: 20, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   headerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
   headerBadgeText: { fontSize: 10, fontWeight: '800', color: T.onBar },
   pressed: { opacity: 0.85 },

   summaryBox: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
   summaryBoxOk: { backgroundColor: '#F0FDF4', borderBottomColor: '#A7F3D0' },
   summaryBoxWarn: { backgroundColor: '#FFFBEB', borderBottomColor: '#FDE68A' },
   summaryText: { fontSize: 12, fontWeight: '800' },

   emptyText: { fontSize: 13, color: T.inkMute, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

   comboCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.surface, marginBottom: 8 },
   comboCardActive: { borderColor: T.ink, backgroundColor: T.bg },
   comboName: { fontSize: 14, fontWeight: '800', color: T.ink },
   comboReq: { fontSize: 11, color: T.inkMute, marginTop: 2 },
   comboPrice: { ...display, fontSize: 20, fontWeight: '800', color: T.ink, marginTop: 4 },

   applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: T.solid, borderRadius: 8 },
   applyBtnText: { fontSize: 12, fontWeight: '800', color: T.onSolid },

   counterBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
   counterBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
   counterValue: { ...display, fontSize: 16, fontWeight: '800', color: T.ink, minWidth: 20, textAlign: 'center' },
   removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: T.line, marginLeft: 2 },
});

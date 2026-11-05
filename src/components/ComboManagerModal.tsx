import React, { useState, useEffect } from 'react';
import {
   View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { X, Plus, Trash2, Pencil, Save, ArrowLeft } from 'lucide-react-native';
import { Combo, ComboRequirement } from '../types/combo';
import { createCombo, updateCombo, deleteCombo } from '../services/comboService';
import { showAlert, showConfirm } from '../utils/alert';
import { MONO as T, display } from '../design';

interface Props {
   visible: boolean;
   onClose: () => void;
   combos: Combo[];
   availableCategories: string[];
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

type Mode = 'list' | 'edit';

export const ComboManagerModal: React.FC<Props> = ({ visible, onClose, combos, availableCategories }) => {
   const [mode, setMode] = useState<Mode>('list');
   const [editingId, setEditingId] = useState<string | null>(null);
   const [name, setName] = useState('');
   const [price, setPrice] = useState('');
   const [bolivarPrice, setBolivarPrice] = useState('');
   const [requirements, setRequirements] = useState<ComboRequirement[]>([]);
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      if (!visible) {
         setMode('list');
         setEditingId(null);
      }
   }, [visible]);

   const resetForm = () => {
      setEditingId(null);
      setName('');
      setPrice('');
      setBolivarPrice('');
      setRequirements([]);
      setSaving(false);
   };

   const openCreate = () => {
      resetForm();
      setRequirements([{ category: availableCategories[0] || 'OTROS', quantity: 1 }]);
      setMode('edit');
   };

   const openEdit = (combo: Combo) => {
      setEditingId(combo.id || null);
      setName(combo.name);
      setPrice(String(combo.price));
      setBolivarPrice(combo.bolivarPrice ? String(combo.bolivarPrice) : '');
      setRequirements(combo.requirements.map((r) => ({ ...r })));
      setMode('edit');
   };

   const addRequirement = () => {
      setRequirements((prev) => [...prev, { category: availableCategories[0] || 'OTROS', quantity: 1 }]);
   };

   const updateRequirement = (idx: number, patch: Partial<ComboRequirement>) => {
      setRequirements((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
   };

   const removeRequirement = (idx: number) => {
      setRequirements((prev) => prev.filter((_, i) => i !== idx));
   };

   const handleSave = async () => {
      if (saving) return;
      const trimmed = name.trim();
      if (!trimmed) return showAlert('Falta', 'El nombre es obligatorio.');
      const parsedPrice = parseFloat(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return showAlert('Falta', 'Precio USD inválido.');
      if (requirements.length === 0) return showAlert('Falta', 'Añade al menos un requisito.');

      const validReqs = requirements.filter((r) => r.category && r.quantity > 0);
      if (validReqs.length === 0) return showAlert('Falta', 'Los requisitos deben tener categoría y cantidad.');

      const payload: Omit<Combo, 'id'> = {
         name: trimmed,
         price: parsedPrice,
         bolivarPrice: bolivarPrice.trim() ? parseFloat(bolivarPrice) || undefined : undefined,
         requirements: validReqs,
         isActive: true,
      };

      try {
         setSaving(true);
         if (editingId) await updateCombo(editingId, payload);
         else await createCombo(payload);
         setMode('list');
         resetForm();
      } catch {
         showAlert('Error', 'No se pudo guardar el combo.');
      } finally {
         setSaving(false);
      }
   };

   const handleDelete = (combo: Combo) => {
      showConfirm('Eliminar Combo', `¿Eliminar "${combo.name}"?`, async () => {
         try {
            if (combo.id) await deleteCombo(combo.id);
         } catch {
            showAlert('Error', 'No se pudo eliminar.');
         }
      });
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                     {mode === 'edit' && (
                        <P onPress={() => { setMode('list'); resetForm(); }} style={{ padding: 4 }}>
                           <ArrowLeft size={18} color={T.onBar} />
                        </P>
                     )}
                     <Text style={styles.title} numberOfLines={1}>
                        {mode === 'edit' ? (editingId ? 'Editar Combo' : 'Nuevo Combo') : 'Combos'}
                     </Text>
                  </View>
                  <P onPress={onClose} disabled={saving}>
                     <X size={20} color={T.onBar} />
                  </P>
               </View>

               {mode === 'list' ? (
                  <>
                     <ScrollView style={{ padding: 16 }}>
                        {combos.length === 0 ? (
                           <Text style={styles.emptyText}>No hay combos creados aún.</Text>
                        ) : (
                           combos.map((combo) => (
                              <View key={combo.id} style={styles.comboRow}>
                                 <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.comboName}>{combo.name}</Text>
                                    <Text style={styles.comboMeta}>
                                       ${combo.price.toFixed(2)} · {combo.requirements.map((r) => `${r.quantity}× ${r.category}`).join(' + ')}
                                    </Text>
                                 </View>
                                 <P style={styles.iconBtn} onPress={() => openEdit(combo)}>
                                    <Pencil size={14} color={T.inkSoft} />
                                 </P>
                                 <P style={styles.iconBtnDanger} onPress={() => handleDelete(combo)}>
                                    <Trash2 size={14} color="#DC2626" />
                                 </P>
                              </View>
                           ))
                        )}
                     </ScrollView>
                     <View style={styles.footer}>
                        <P style={styles.primaryBtn} onPress={openCreate}>
                           <Plus size={16} color={T.onSolid} />
                           <Text style={styles.primaryBtnText}>Nuevo Combo</Text>
                        </P>
                     </View>
                  </>
               ) : (
                  <>
                     <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                        <Text style={styles.label}>Nombre del combo *</Text>
                        <TextInput
                           style={styles.input}
                           value={name}
                           onChangeText={setName}
                           placeholder="Ej. Combo Verano"
                           placeholderTextColor={T.inkMute}
                           editable={!saving}
                        />

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Precio USD *</Text>
                              <TextInput
                                 style={styles.input}
                                 value={price}
                                 onChangeText={setPrice}
                                 keyboardType="numeric"
                                 placeholder="0.00"
                                 placeholderTextColor={T.inkMute}
                                 editable={!saving}
                              />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Precio Bs ref (€)</Text>
                              <TextInput
                                 style={styles.input}
                                 value={bolivarPrice}
                                 onChangeText={setBolivarPrice}
                                 keyboardType="numeric"
                                 placeholder="Opcional"
                                 placeholderTextColor={T.inkMute}
                                 editable={!saving}
                              />
                           </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
                           <Text style={styles.label}>Requisitos *</Text>
                           <P style={styles.addBtn} onPress={addRequirement} disabled={saving}>
                              <Plus size={12} color={T.ink} />
                              <Text style={styles.addBtnText}>Agregar</Text>
                           </P>
                        </View>

                        {requirements.map((req, idx) => (
                           <View key={idx} style={styles.reqRow}>
                              <View style={{ flex: 1, gap: 4 }}>
                                 <Text style={styles.reqMiniLabel}>Categoría</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                                    {availableCategories.map((cat) => (
                                       <P
                                          key={cat}
                                          style={[styles.reqChip, req.category === cat && styles.reqChipActive]}
                                          onPress={() => updateRequirement(idx, { category: cat })}
                                          disabled={saving}
                                       >
                                          <Text style={[styles.reqChipText, req.category === cat && styles.reqChipTextActive]}>
                                             {cat}
                                          </Text>
                                       </P>
                                    ))}
                                 </ScrollView>
                              </View>
                              <View style={{ width: 70 }}>
                                 <Text style={styles.reqMiniLabel}>Cant.</Text>
                                 <TextInput
                                    style={[styles.input, { textAlign: 'center' }]}
                                    value={String(req.quantity)}
                                    onChangeText={(v) => updateRequirement(idx, { quantity: Math.max(1, parseInt(v) || 1) })}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                 />
                              </View>
                              <P style={styles.reqDeleteBtn} onPress={() => removeRequirement(idx)} disabled={saving}>
                                 <Trash2 size={14} color="#DC2626" />
                              </P>
                           </View>
                        ))}
                     </ScrollView>

                     <View style={styles.footer}>
                        <P style={styles.secondaryBtn} onPress={() => { setMode('list'); resetForm(); }} disabled={saving}>
                           <Text style={styles.secondaryBtnText}>Cancelar</Text>
                        </P>
                        <P style={[styles.primaryBtn, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                           {saving ? <ActivityIndicator color={T.onSolid} size="small" /> : (
                              <>
                                 <Save size={14} color={T.onSolid} />
                                 <Text style={styles.primaryBtnText}>Guardar</Text>
                              </>
                           )}
                        </P>
                     </View>
                  </>
               )}
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: T.bar, gap: 8 },
   title: { ...display, fontSize: 20, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   pressed: { opacity: 0.85 },
   emptyText: { fontSize: 13, color: T.inkMute, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
   comboRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
   comboName: { fontSize: 14, fontWeight: '800', color: T.ink },
   comboMeta: { fontSize: 11, color: T.inkMute, marginTop: 2 },
   iconBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
   iconBtnDanger: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
   footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line },
   primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, backgroundColor: T.solid, borderRadius: 10 },
   primaryBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
   secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46, borderWidth: 1, borderColor: T.line, borderRadius: 10 },
   secondaryBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   label: { fontSize: 11, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.bg, paddingHorizontal: 12, height: 42, fontSize: 14, color: T.ink, textAlignVertical: 'center', marginBottom: 10 },
   addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.line, borderRadius: 6, backgroundColor: T.bg },
   addBtnText: { fontSize: 11, fontWeight: '800', color: T.ink },
   reqRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line },
   reqMiniLabel: { fontSize: 9, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', marginBottom: 3 },
   reqChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   reqChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   reqChipText: { fontSize: 11, color: T.inkSoft, fontWeight: '700' },
   reqChipTextActive: { color: T.onSolid },
   reqDeleteBtn: { width: 42, height: 42, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
});

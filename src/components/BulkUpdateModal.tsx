import React, { useState } from 'react';
import {
   View, Text, Modal, StyleSheet, TouchableOpacity,
   TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { X, Save, DollarSign, Layers } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { updateProduct } from '../services/productService';
import { showAlert } from '../utils/alert';
import { C, caps, box, label, btn, btnText, overlay, modalCard } from '../theme';

interface Props {
   selectedProducts: Product[];
   visible: boolean;
   onClose: () => void;
   onComplete: () => void;
}

export const BulkUpdateModal: React.FC<Props> = ({ selectedProducts, visible, onClose, onComplete }) => {
   const [loading, setLoading] = useState(false);
   const [mode, setMode] = useState<'price' | 'stock'>('price');
   const [newPrice, setNewPrice] = useState('');
   const [variantColor, setVariantColor] = useState('');
   const [variantSize, setVariantSize] = useState('');
   const [variantStock, setVariantStock] = useState('');

   const handleApply = async () => {
      if (mode === 'price' && !newPrice) return showAlert('Error', 'Ingresa un precio válido');
      if (mode === 'stock' && (!variantColor || !variantSize || !variantStock)) {
         return showAlert('Error', 'Completa color, talla y cantidad');
      }

      setLoading(true);
      try {
         const updates = selectedProducts.map(async (p) => {
            if (!p.id) return;
            const updated = JSON.parse(JSON.stringify(p)) as Product;

            if (mode === 'price') {
               updated.price = parseFloat(newPrice);
            } else if (mode === 'stock') {
               const colorName = variantColor.trim();
               const sizeName = variantSize.trim().toUpperCase();
               const stockVal = parseInt(variantStock, 10);
               const vIndex = updated.variants.findIndex(
                  (v) => v.color.toLowerCase() === colorName.toLowerCase()
               );
               if (vIndex >= 0) {
                  const sIndex = updated.variants[vIndex].sizes.findIndex((s) => s.size === sizeName);
                  if (sIndex >= 0) updated.variants[vIndex].sizes[sIndex].stock = stockVal;
                  else updated.variants[vIndex].sizes.push({ size: sizeName, stock: stockVal });
               } else {
                  updated.variants.push({
                     id: `var_${Date.now()}`,
                     color: colorName,
                     colorHex: '#cbd5e1',
                     sizes: [{ size: sizeName, stock: stockVal }],
                     locations: [],
                     exhibition: { isOnDisplay: false },
                  });
               }
            }
            await updateProduct(p.id, updated);
         });
         await Promise.all(updates);
         showAlert('Éxito', `Se actualizaron ${selectedProducts.length} prendas correctamente.`);
         onComplete();
      } catch (error: any) {
         showAlert('Error', error.message);
      } finally {
         setLoading(false);
      }
   };

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.overlay}>
            <View style={styles.card}>
               {/* HEADER */}
               <View style={styles.header}>
                  <Text style={styles.title}>
                     Actualización Masiva · {selectedProducts.length} prendas
                  </Text>
                  <TouchableOpacity onPress={onClose} disabled={loading}>
                     <X size={20} color={loading ? C.dim : C.soft} />
                  </TouchableOpacity>
               </View>

               {/* TABS DE MODO */}
               <View style={styles.modeTabs}>
                  <TouchableOpacity
                     style={[styles.tab, mode === 'price' && styles.tabActive]}
                     onPress={() => setMode('price')}
                     disabled={loading}
                  >
                     <DollarSign size={14} color={mode === 'price' ? C.white : C.mute} />
                     <Text style={[styles.tabText, mode === 'price' && styles.tabTextActive]}>
                        Precio
                     </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                     style={[styles.tab, mode === 'stock' && styles.tabActive]}
                     onPress={() => setMode('stock')}
                     disabled={loading}
                  >
                     <Layers size={14} color={mode === 'stock' ? C.white : C.mute} />
                     <Text style={[styles.tabText, mode === 'stock' && styles.tabTextActive]}>
                        Inyectar Stock / Talla
                     </Text>
                  </TouchableOpacity>
               </View>

               {/* BODY */}
               <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 4 }}>
                  {mode === 'price' ? (
                     <View>
                        <Text style={styles.label}>Nuevo Precio General ($):</Text>
                        <TextInput
                           style={styles.input}
                           placeholder="Ej. 25.50"
                           placeholderTextColor={C.dim}
                           value={newPrice}
                           onChangeText={setNewPrice}
                           keyboardType="numeric"
                           editable={!loading}
                        />
                        <Text style={styles.hint}>
                           Todas las prendas seleccionadas pasarán a tener este precio de venta.
                        </Text>
                     </View>
                  ) : (
                     <View>
                        <Text style={styles.label}>Color a modificar / crear:</Text>
                        <TextInput
                           style={styles.input}
                           placeholder="Ej. Negro, Blanco, Azul..."
                           placeholderTextColor={C.dim}
                           value={variantColor}
                           onChangeText={setVariantColor}
                           editable={!loading}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Talla:</Text>
                              <TextInput
                                 style={styles.input}
                                 placeholder="M, L, 40..."
                                 placeholderTextColor={C.dim}
                                 value={variantSize}
                                 onChangeText={setVariantSize}
                                 autoCapitalize="characters"
                                 editable={!loading}
                              />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Nuevo Stock:</Text>
                              <TextInput
                                 style={styles.input}
                                 placeholder="Cant."
                                 placeholderTextColor={C.dim}
                                 value={variantStock}
                                 onChangeText={setVariantStock}
                                 keyboardType="numeric"
                                 editable={!loading}
                              />
                           </View>
                        </View>

                        <Text style={styles.hint}>
                           Si el color/talla existe en la prenda, se actualiza la cantidad.
                           Si no existe, se creará la variante automáticamente.
                        </Text>
                     </View>
                  )}
               </ScrollView>

               {/* FOOTER */}
               <View style={styles.footer}>
                  <TouchableOpacity
                     style={styles.btnCancel}
                     onPress={onClose}
                     disabled={loading}
                  >
                     <Text style={styles.btnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                     style={styles.btnApply}
                     onPress={handleApply}
                     disabled={loading}
                  >
                     {loading ? (
                        <ActivityIndicator color={C.bg} />
                     ) : (
                        <>
                           <Save size={16} color={C.bg} style={{ marginRight: 6 }} />
                           <Text style={styles.btnApplyText}>Aplicar a {selectedProducts.length}</Text>
                        </>
                     )}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: { ...modalCard, maxWidth: 440 },

   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#161616',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
   },
   title: {
      ...caps,
      fontSize: 11,
      fontWeight: '900',
      color: C.white,
      flexShrink: 1,
      marginRight: 8,
   },

   modeTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
   },
   tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
   },
   tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: C.light,
      backgroundColor: C.raised,
   },
   tabText: {
      ...caps,
      fontSize: 10,
      fontWeight: '700',
      color: C.mute,
   },
   tabTextActive: { color: C.white },

   body: {
      padding: 16,
      maxHeight: 320,
   },
   label,
   input: {
      ...box,
      paddingHorizontal: 12,
      height: 42,
      fontSize: 13,
      color: C.white,
      marginBottom: 12,
   },
   hint: {
      fontSize: 10,
      color: C.mute,
      fontStyle: 'italic',
      marginTop: -4,
      lineHeight: 14,
   },

   footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      padding: 16,
      backgroundColor: '#161616',
      borderTopWidth: 1,
      borderTopColor: C.border,
   },
   btnCancel: {
      ...btn,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: '#3A3A3A',
   },
   btnCancelText: { ...btnText, color: C.soft },
   btnApply: {
      ...btn,
      paddingHorizontal: 16,
      backgroundColor: C.light,
   },
   btnApplyText: { ...btnText, color: C.bg },
});

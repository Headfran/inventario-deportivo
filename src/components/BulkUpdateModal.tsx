import React, { useState } from 'react';
import {
   View, Text, Modal, StyleSheet, TouchableOpacity,
   TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { X, Save, DollarSign, Layers } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { adjustVariantStock, updateProduct } from '../services/productService';
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
   const [newWholesalePrice, setNewWholesalePrice] = useState('');
   const [newBolivarPrice, setNewBolivarPrice] = useState('');
   const [newBolivarWholesalePrice, setNewBolivarWholesalePrice] = useState('');
   const [newPurchasePrice, setNewPurchasePrice] = useState(''); const [variantColor, setVariantColor] = useState('');
   const [variantSize, setVariantSize] = useState('');
   const [variantStock, setVariantStock] = useState('');

   const parsePositivePrice = (value: string, label: string): number => {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
         throw new Error(`${label} debe ser un número mayor a 0.`);
      }
      return parsed;
   };

   const handleApply = async () => {
      let pricePayload: Record<string, number> | null = null;
      let stockValue = 0;

      try {
         if (mode === 'price') {
            pricePayload = {};
            if (newPrice.trim()) pricePayload.price = parsePositivePrice(newPrice, 'Precio detal');
            if (newWholesalePrice.trim()) pricePayload.wholesalePrice = parsePositivePrice(newWholesalePrice, 'Precio mayor');
            if (newBolivarPrice.trim()) pricePayload.bolivarPrice = parsePositivePrice(newBolivarPrice, 'Precio Bs detal');
            if (newBolivarWholesalePrice.trim()) pricePayload.bolivarWholesalePrice = parsePositivePrice(newBolivarWholesalePrice, 'Precio Bs mayor');
            if (newPurchasePrice.trim()) pricePayload.purchasePrice = parsePositivePrice(newPurchasePrice, 'Precio compra');

            if (Object.keys(pricePayload).length === 0) {
               showAlert('Error', 'Rellena al menos un precio para actualizar.');
               return;
            }
         } else {
            if (!variantColor.trim() || !variantSize.trim() || !variantStock.trim()) {
               showAlert('Error', 'Completa color, talla y cantidad');
               return;
            }

            const parsedStock = Number(variantStock);
            if (!Number.isInteger(parsedStock) || parsedStock < 0) {
               showAlert('Error', 'El stock debe ser un número entero mayor o igual a 0.');
               return;
            }
            stockValue = parsedStock;
         }

         setLoading(true);
         const colorName = variantColor.trim();
         const sizeName = variantSize.trim().toUpperCase();

         const updates = selectedProducts.map(async (p) => {
            if (!p.id) return;

            if (mode === 'price' && pricePayload) {
               await updateProduct(p.id, pricePayload as any);
               return;
            }

            const existingVariant = (p.variants || []).find(
               (variant) => variant.color.toLowerCase().trim() === colorName.toLowerCase()
            );
            const existingSize = existingVariant?.sizes.find(
               (size) => size.size.trim() === sizeName
            );
            const currentStock = Number(existingSize?.stock) || 0;
            const delta = stockValue - currentStock;

            await adjustVariantStock(p.id, colorName, sizeName, delta, {
               createIfMissing: true,
               colorHex: existingVariant?.colorHex || '#cbd5e1',
               variantId: existingVariant?.id,
            });
         });

         const results = await Promise.allSettled(updates);
         const failures = results.filter(
            (result): result is PromiseRejectedResult => result.status === 'rejected'
         );

         if (failures.length > 0) {
            const firstReason = failures[0].reason;
            const message = firstReason instanceof Error ? firstReason.message : String(firstReason);
            showAlert(
               'Actualización parcial',
               `${results.length - failures.length} prendas actualizadas, ${failures.length} fallaron. ` +
               `Primer error: ${message}`
            );
            return;
         }

         showAlert('Éxito', `Se actualizaron ${selectedProducts.length} prendas correctamente.`);
         onComplete();
      } catch (error: any) {
         showAlert('Error', error?.message || 'No se pudo completar la actualización.');
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
                     <View style={{ gap: 10 }}>
                        <Text style={styles.hint}>
                           Rellena solo los precios que quieras actualizar. Los vacíos no se tocan.
                        </Text>

                        {/* FILA 1: Dólares */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Detal ($)</Text>
                              <TextInput
                                 style={styles.input}
                                 placeholder="0.00"
                                 placeholderTextColor={C.dim}
                                 value={newPrice}
                                 onChangeText={setNewPrice}
                                 keyboardType="numeric"
                                 editable={!loading}
                              />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.label, { color: '#34D399' }]}>Mayor ($)</Text>
                              <TextInput
                                 style={[styles.input, styles.inputWholesale]}
                                 placeholder="0.00"
                                 placeholderTextColor={C.dim}
                                 value={newWholesalePrice}
                                 onChangeText={setNewWholesalePrice}
                                 keyboardType="numeric"
                                 editable={!loading}
                              />
                           </View>
                        </View>

                        {/* FILA 2: Bolívares / € */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.label, { color: '#A5B4FC' }]}>Detal Bs/€</Text>
                              <TextInput
                                 style={[styles.input, styles.inputBolivar]}
                                 placeholder="0.00"
                                 placeholderTextColor={C.dim}
                                 value={newBolivarPrice}
                                 onChangeText={setNewBolivarPrice}
                                 keyboardType="numeric"
                                 editable={!loading}
                              />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.label, { color: '#C4B5FD' }]}>Mayor Bs/€</Text>
                              <TextInput
                                 style={[styles.input, styles.inputBolivarWholesale]}
                                 placeholder="0.00"
                                 placeholderTextColor={C.dim}
                                 value={newBolivarWholesalePrice}
                                 onChangeText={setNewBolivarWholesalePrice}
                                 keyboardType="numeric"
                                 editable={!loading}
                              />
                           </View>
                        </View>

                        {/* FILA 3: Compra */}
                        <View>
                           <Text style={[styles.label, { color: '#FBBF24' }]}>Compra ($)</Text>
                           <TextInput
                              style={[styles.input, styles.inputPurchase]}
                              placeholder="0.00"
                              placeholderTextColor={C.dim}
                              value={newPurchasePrice}
                              onChangeText={setNewPurchasePrice}
                              keyboardType="numeric"
                              editable={!loading}
                           />
                        </View>
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
      maxHeight: 420,
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

   inputWholesale: {
      borderColor: 'rgba(52,211,153,0.5)',
      backgroundColor: 'rgba(16,185,129,0.08)',
   },
   inputBolivar: {
      borderColor: 'rgba(129,140,248,0.5)',
      backgroundColor: 'rgba(99,102,241,0.08)',
   },
   inputBolivarWholesale: {
      borderColor: 'rgba(167,139,250,0.5)',
      backgroundColor: 'rgba(139,92,246,0.08)',
   },
   inputPurchase: {
      borderColor: 'rgba(251,191,36,0.5)',
      backgroundColor: 'rgba(245,158,11,0.08)',
   },
});

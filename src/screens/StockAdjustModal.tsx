import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   StyleSheet,
   Modal,
   ScrollView,
   ActivityIndicator,
   TextInput
} from 'react-native';
import { Plus, Minus, X, AlertTriangle, CheckCircle2, PackageX } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { updateVariantStock } from '../services/productService';
import { showAlert } from '../utils/alert';

interface StockAdjustModalProps {
   product: Product | null;
   visible: boolean;
   onClose: () => void;
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
};

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
   product,
   visible,
   onClose
}) => {
   // ---- LÓGICA ORIGINAL (sin cambios) ----
   const [updatingKey, setUpdatingKey] = useState<string | null>(null);
   // Estado local para almacenar temporalmente los valores tipeados en la caja
   const [draftStocks, setDraftStocks] = useState<Record<string, string>>({});

   useEffect(() => {
      if (product) {
         // Sincronizar el estado de los campos de texto cuando cambia el producto
         const initialDrafts: Record<string, string> = {};
         (product.variants || []).forEach(v => {
            (v.sizes || []).forEach(s => {
               initialDrafts[`${v.color}_${s.size}`] = String(s.stock);
            });
         });
         setDraftStocks(initialDrafts);
      }
   }, [product]);

   if (!product) return null;

   // Actualización en Firestore (por paso +1 / -1 o por número directo)
   const commitStockChange = async (
      colorName: string,
      sizeName: string,
      newStock: number
   ) => {
      if (!product.id) return;
      const sanitizedStock = Math.max(0, newStock);
      const key = `${colorName}_${sizeName}`;

      try {
         setUpdatingKey(key);
         await updateVariantStock(product.id, colorName, sizeName, sanitizedStock);
         setDraftStocks(prev => ({ ...prev, [key]: String(sanitizedStock) }));
      } catch (error: any) {
         showAlert('Error', error.message || 'No se pudo actualizar el stock');
      } finally {
         setUpdatingKey(null);
      }
   };

   const handleTextChange = (key: string, value: string) => {
      // Permitir solo dígitos numéricos
      const cleanValue = value.replace(/[^0-9]/g, '');
      setDraftStocks(prev => ({ ...prev, [key]: cleanValue }));
   };

   const handleInputBlur = (colorName: string, sizeName: string, currentStock: number) => {
      const key = `${colorName}_${sizeName}`;
      const rawValue = draftStocks[key];
      const parsed = parseInt(rawValue, 10);

      if (isNaN(parsed)) {
         // Si el campo quedó vacío, restaurar el valor previo
         setDraftStocks(prev => ({ ...prev, [key]: String(currentStock) }));
         return;
      }

      if (parsed !== currentStock) {
         commitStockChange(colorName, sizeName, parsed);
      }
   };

   return (
      <Modal visible={visible} animationType="fade" transparent>
         <View style={styles.overlay}>
            <View style={styles.modalCard}>
               {/* Header con SVG */}
               <View style={styles.modalHeader}>
                  <View>
                     <Text style={styles.modalTitle}>{product.name}</Text>
                     <Text style={styles.modalSubtitle}>SKU: {product.code} • {product.brand}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeIconButton} onPress={onClose}>
                     <X size={20} color={C.soft} />
                  </TouchableOpacity>
               </View>

               {/* Lista de colores y tallas */}
               <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
                  {(product.variants || []).map((variant, vIdx) => (
                     <View key={variant.id || vIdx} style={styles.variantSection}>
                        <View style={styles.colorHeader}>
                           <View
                              style={[
                                 styles.colorDot,
                                 { backgroundColor: variant.colorHex || '#000000' }
                              ]}
                           />
                           <Text style={styles.colorNameText}>{variant.color}</Text>
                        </View>

                        <View style={styles.sizesContainer}>
                           {(variant.sizes || []).map((sObj) => {
                              const key = `${variant.color}_${sObj.size}`;
                              const isUpdating = updatingKey === key;
                              const isOut = sObj.stock === 0;
                              const isLow = sObj.stock > 0 && sObj.stock <= 2;
                              const currentDraft = draftStocks[key] ?? String(sObj.stock);

                              return (
                                 <View key={sObj.size} style={styles.sizeStockRow}>
                                    <View style={styles.sizeBadgeInfo}>
                                       <Text style={styles.sizeText}>{sObj.size}</Text>
                                       {isOut ? (
                                          <View style={styles.statusBadgeEmpty}>
                                             <PackageX size={12} color={C.dim} />
                                             <Text style={styles.statusTextEmpty}>Agotado</Text>
                                          </View>
                                       ) : isLow ? (
                                          <View style={styles.statusBadgeLow}>
                                             <AlertTriangle size={12} color={C.light} />
                                             <Text style={styles.statusTextLow}>Bajo</Text>
                                          </View>
                                       ) : (
                                          <View style={styles.statusBadgeOk}>
                                             <CheckCircle2 size={12} color={C.soft} />
                                             <Text style={styles.statusTextOk}>Disponible</Text>
                                          </View>
                                       )}
                                    </View>

                                    {/* Controles de ajuste: Paso ±1 + Entrada directa de texto */}
                                    <View style={styles.controlsGroup}>
                                       <TouchableOpacity
                                          style={[styles.stepBtn, isOut && styles.stepBtnDisabled]}
                                          onPress={() => commitStockChange(variant.color, sObj.size, sObj.stock - 1)}
                                          disabled={isUpdating || isOut}
                                       >
                                          <Minus size={16} color={isOut ? C.dim : C.light} />
                                       </TouchableOpacity>

                                       <View style={styles.stockNumberBox}>
                                          {isUpdating ? (
                                             <ActivityIndicator size="small" color={C.light} />
                                          ) : (
                                             <TextInput
                                                style={[styles.stockInputInline, isOut && styles.stockInputOut]}
                                                value={currentDraft}
                                                onChangeText={(val) => handleTextChange(key, val)}
                                                onBlur={() => handleInputBlur(variant.color, sObj.size, sObj.stock)}
                                                keyboardType="number-pad"
                                                selectTextOnFocus
                                             />
                                          )}
                                       </View>

                                       <TouchableOpacity
                                          style={styles.stepBtn}
                                          onPress={() => commitStockChange(variant.color, sObj.size, sObj.stock + 1)}
                                          disabled={isUpdating}
                                       >
                                          <Plus size={16} color={C.light} />
                                       </TouchableOpacity>
                                    </View>
                                 </View>
                              );
                           })}
                        </View>
                     </View>
                  ))}
               </ScrollView>

               <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                  <Text style={styles.doneButtonText}>Listo</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
   );
};

// Bases compartidas (evitan repetir estilos)
const caps = { textTransform: 'uppercase' as const, letterSpacing: 2 };
const box = {
   backgroundColor: C.raised,
   borderWidth: 1,
   borderColor: C.line,
   borderRadius: 2,
};
const badgeBase = {
   flexDirection: 'row' as const,
   alignItems: 'center' as const,
   gap: 4,
   paddingVertical: 2,
   paddingHorizontal: 6,
   borderRadius: 2,
   borderWidth: 1,
};
const badgeText = { fontSize: 9, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const };

const styles = StyleSheet.create({
   overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
   },
   modalCard: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '85%',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 4,
      padding: 20,
   },
   modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingBottom: 14,
   },
   modalTitle: { fontSize: 18, fontWeight: '900', color: C.white },
   modalSubtitle: { fontSize: 11, color: C.mute, marginTop: 2, letterSpacing: 1 },
   closeIconButton: { padding: 6, borderWidth: 1, borderColor: '#3A3A3A', borderRadius: 2 },
   modalBody: { marginTop: 12 },

   variantSection: {
      backgroundColor: '#161616',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 4,
      padding: 12,
      marginBottom: 12,
   },
   colorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
   colorDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
   },
   colorNameText: { ...caps, fontSize: 12, fontWeight: 'bold', color: C.soft },
   sizesContainer: { gap: 8 },
   sizeStockRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: '#222222',
   },
   sizeBadgeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
   sizeText: { fontSize: 14, fontWeight: '900', color: C.white, minWidth: 32 },

   // Estados de stock (se distinguen por brillo, no por color)
   statusBadgeOk: { ...badgeBase, backgroundColor: '#1F1F1F', borderColor: '#3A3A3A' },
   statusTextOk: { ...badgeText, color: C.soft },
   statusBadgeLow: { ...badgeBase, backgroundColor: 'transparent', borderColor: C.light },
   statusTextLow: { ...badgeText, color: C.light },
   statusBadgeEmpty: { ...badgeBase, backgroundColor: 'transparent', borderColor: '#4A4A4A' },
   statusTextEmpty: { ...badgeText, color: C.dim },

   controlsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
   stepBtn: { ...box, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
   stepBtnDisabled: { opacity: 0.5 },
   stockNumberBox: { width: 52, alignItems: 'center' },
   stockInputInline: {
      ...box,
      paddingVertical: 4,
      paddingHorizontal: 6,
      fontSize: 14,
      fontWeight: 'bold',
      color: C.white,
      textAlign: 'center',
      width: '100%',
   },
   stockInputOut: { color: C.mute, borderColor: '#4A4A4A', backgroundColor: '#161616' },

   doneButton: { backgroundColor: C.light, paddingVertical: 13, borderRadius: 2, alignItems: 'center', marginTop: 10 },
   doneButtonText: { ...caps, color: C.bg, fontSize: 13, fontWeight: '900', letterSpacing: 3 },
});
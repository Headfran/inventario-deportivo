import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Modal, ScrollView, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import { X, MapPin, Eye, Check, Trash2 } from 'lucide-react-native';
import { Product, Shelf } from '../types/inventory';
import { updateProduct } from '../services/productService';
import { showAlert } from '../utils/alert';
import { C, caps, box, activeBox, activeText, btn, btnText, overlay, modalCard } from '../theme';

interface AssignLocationModalProps {
   product: Product | null;
   shelves: Shelf[];
   visible: boolean;
   onClose: () => void;
}

const ease = Easing.bezier(0.23, 1, 0.32, 1);
const nd = Platform.OS !== 'web';

// Encabezado numerado de cada paso del selector
const Step = ({ n, text }: { n: string; text: string }) => (
   <View style={styles.stepRow}>
      <Text style={styles.stepNum}>{n}</Text>
      <Text style={styles.pathLabel}>{text}</Text>
   </View>
);

export const AssignLocationModal: React.FC<AssignLocationModalProps> = ({ product, shelves, visible, onClose }) => {
   const [submitting, setSubmitting] = useState(false);

   // Estados para el selector paso a paso
   const [activeVariantIdx, setActiveVariantIdx] = useState<number | null>(null);
   const [selShelf, setSelShelf] = useState<Shelf | null>(null);
   const [selRow, setSelRow] = useState<number | null>(null);
   const [selSpace, setSelSpace] = useState<number | null>(null);

   // ---- SOLO DISEÑO: animación de entrada ----
   const card = useRef(new Animated.Value(0)).current;
   useEffect(() => {
      if (!visible) {
         card.setValue(0);
         return;
      }
      AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
         if (reduce) {
            card.setValue(1);
            return;
         }
         Animated.timing(card, { toValue: 1, duration: 240, easing: ease, useNativeDriver: nd }).start();
      });
   }, [visible]);

   if (!product) return null;

   // ---- LÓGICA ORIGINAL (sin cambios) ----
   const handleToggleExhibition = async (variantIdx: number, displaySize: string) => {
      if (!product.id) return;
      try {
         setSubmitting(true);
         const updatedVariants = [...product.variants];
         const exhibition = updatedVariants[variantIdx].exhibition || { isOnDisplay: false };
         updatedVariants[variantIdx].exhibition = exhibition.isOnDisplay && exhibition.displaySize === displaySize
            ? { isOnDisplay: false }
            : { isOnDisplay: true, displaySize };
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) {
         showAlert('Error', error.message);
      } finally {
         setSubmitting(false);
      }
   };

   const handleRemoveLocation = async (variantIdx: number, locIdx: number) => {
      if (!product.id) return;
      try {
         setSubmitting(true);
         const updatedVariants = [...product.variants];
         updatedVariants[variantIdx].locations = updatedVariants[variantIdx].locations.filter((_, i) => i !== locIdx);
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) {
         showAlert('Error', error.message);
      } finally {
         setSubmitting(false);
      }
   };

   const handleConfirmLocation = async () => {
      if (!product.id || activeVariantIdx === null || !selShelf || !selRow || !selSpace) return;
      try {
         setSubmitting(true);
         const updatedVariants = [...product.variants];
         const currentLocs = updatedVariants[activeVariantIdx].locations || [];
         const exists = currentLocs.some(l => l.shelfId === selShelf.name && l.rowIndex === selRow && l.rumaIndex === selSpace);

         if (!exists) {
            updatedVariants[activeVariantIdx].locations = [...currentLocs, { shelfId: selShelf.name, rowIndex: selRow, rumaIndex: selSpace }];
            await updateProduct(product.id, { variants: updatedVariants });
         }

         // Resetear selector
         setActiveVariantIdx(null);
         setSelShelf(null); setSelRow(null); setSelSpace(null);
      } catch (error: any) {
         showAlert('Error', error.message);
      } finally {
         setSubmitting(false);
      }
   };

   // Los tres "huecos" que muestran la ubicación elegida
   const slots = [
      { v: selShelf?.name, ph: 'Estante' },
      { v: selRow ? `F${selRow}` : undefined, ph: 'Fila' },
      { v: selSpace ? `E${selSpace}` : undefined, ph: 'Espacio' },
   ];
   const canSave = !!selShelf && !!selRow && !!selSpace;

   return (
      <Modal visible={visible} animationType="fade" transparent>
         <View style={styles.overlay}>
            <Animated.View
               style={[
                  styles.card,
                  {
                     opacity: card,
                     transform: [
                        { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                        { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                     ],
                  },
               ]}
            >
               <View style={styles.shape} />

               <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                     <View style={styles.accentLine} />
                     <Text style={styles.title} numberOfLines={2}>{product.name}</Text>
                     <Text style={styles.subtitle}>Gestión de ubicaciones</Text>
                  </View>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                     <X size={18} color={C.soft} />
                  </Pressable>
               </View>

               <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
                  {(product.variants || []).map((variant, vIdx) => {
                     const exhibition = variant.exhibition || { isOnDisplay: false };
                     const isAssigningThis = activeVariantIdx === vIdx;

                     return (
                        <View key={vIdx} style={[styles.variantCard, isAssigningThis && styles.variantCardActive]}>
                           <View style={styles.colorRow}>
                              <View style={[styles.colorDot, { backgroundColor: variant.colorHex || '#000000' }]} />
                              <Text style={styles.colorTitle}>{variant.color}</Text>
                           </View>

                           <View style={styles.chipsRow}>
                              {(variant.sizes || []).map(sObj => {
                                 const isExhibited = exhibition.isOnDisplay && exhibition.displaySize === sObj.size;
                                 return (
                                    <TouchableOpacity
                                       key={sObj.size}
                                       style={[styles.exhibitionChip, isExhibited && activeBox]}
                                       onPress={() => handleToggleExhibition(vIdx, sObj.size)}
                                    >
                                       <Eye size={12} color={isExhibited ? C.bg : C.mute} style={{ marginRight: 4 }} />
                                       <Text style={[styles.chipText, isExhibited && activeText]}>Vitrina {sObj.size}</Text>
                                       {isExhibited && <Check size={12} color={C.bg} style={{ marginLeft: 4 }} />}
                                    </TouchableOpacity>
                                 );
                              })}
                           </View>

                           <View style={styles.locationsList}>
                              {(variant.locations || []).map((loc, lIdx) => (
                                 <View key={lIdx} style={styles.locBadge}>
                                    <Text style={styles.locBadgeText}>{loc.shelfId} • F{loc.rowIndex} • E{loc.rumaIndex}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveLocation(vIdx, lIdx)} style={{ marginLeft: 8 }}>
                                       <Trash2 size={12} color={C.mute} />
                                    </TouchableOpacity>
                                 </View>
                              ))}
                           </View>

                           {/* Interfaz Paso a Paso para Asignar (Oculta hasta hacer clic en "Añadir a Estante") */}
                           {!isAssigningThis ? (
                              <Pressable
                                 style={({ pressed }) => [styles.startAssignBtn, pressed && styles.pressed]}
                                 onPress={() => {
                                    setActiveVariantIdx(vIdx); setSelShelf(null); setSelRow(null); setSelSpace(null);
                                 }}
                              >
                                 <MapPin size={14} color={C.light} style={{ marginRight: 6 }} />
                                 <Text style={styles.startAssignText}>Añadir a Estante</Text>
                              </Pressable>
                           ) : (
                              <View style={styles.assignPathContainer}>
                                 {/* Ubicación elegida, en vivo */}
                                 <View style={styles.slots}>
                                    {slots.map((s, i) => (
                                       <View key={i} style={[styles.slot, !!s.v && styles.slotFilled]}>
                                          <Text style={[styles.slotText, s.v ? activeText : { color: C.dim }]} numberOfLines={1}>
                                             {s.v || s.ph}
                                          </Text>
                                       </View>
                                    ))}
                                 </View>

                                 <Step n="01" text="Estante" />
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                    {shelves.map(s => (
                                       <TouchableOpacity key={s.id} style={[styles.pathChip, selShelf?.id === s.id && activeBox]}
                                          onPress={() => { setSelShelf(s); setSelRow(null); setSelSpace(null); }}>
                                          <Text style={[styles.pathChipText, selShelf?.id === s.id && activeText]}>{s.name}</Text>
                                       </TouchableOpacity>
                                    ))}
                                 </ScrollView>

                                 {selShelf && (
                                    <>
                                       <Step n="02" text="Fila / Nivel" />
                                       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                          {Array.from({ length: selShelf.rowsCount }).map((_, r) => (
                                             <TouchableOpacity key={r} style={[styles.pathChip, selRow === r + 1 && activeBox]}
                                                onPress={() => { setSelRow(r + 1); setSelSpace(null); }}>
                                                <Text style={[styles.pathChipText, selRow === r + 1 && activeText]}>Fila {r + 1}</Text>
                                             </TouchableOpacity>
                                          ))}
                                       </ScrollView>
                                    </>
                                 )}

                                 {selRow && (
                                    <>
                                       <Step n="03" text="Espacio" />
                                       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                          {Array.from({ length: selShelf!.spacesPerRow }).map((_, s) => (
                                             <TouchableOpacity key={s} style={[styles.pathChip, selSpace === s + 1 && activeBox]}
                                                onPress={() => setSelSpace(s + 1)}>
                                                <Text style={[styles.pathChipText, selSpace === s + 1 && activeText]}>Espacio {s + 1}</Text>
                                             </TouchableOpacity>
                                          ))}
                                       </ScrollView>
                                    </>
                                 )}

                                 <View style={styles.assignActions}>
                                    <Pressable style={({ pressed }) => [styles.cancelAssignBtn, pressed && styles.pressed]} onPress={() => setActiveVariantIdx(null)}>
                                       <Text style={styles.cancelAssignText}>Cancelar</Text>
                                    </Pressable>
                                    <Pressable
                                       style={({ pressed }) => [styles.confirmAssignBtn, !canSave && { opacity: 0.4 }, pressed && styles.pressed]}
                                       disabled={!canSave || submitting}
                                       onPress={handleConfirmLocation}
                                    >
                                       <Text style={styles.confirmAssignText}>Guardar Ubicación</Text>
                                    </Pressable>
                                 </View>
                              </View>
                           )}
                        </View>
                     );
                  })}
               </ScrollView>
            </Animated.View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: { ...modalCard, maxWidth: 540, maxHeight: '85%' },
   shape: { position: 'absolute', top: -70, right: -70, width: 180, height: 180, backgroundColor: '#161616', borderRadius: 30, transform: [{ rotate: '35deg' }] },

   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 14, gap: 12 },
   accentLine: { width: 40, height: 4, backgroundColor: C.mute, marginBottom: 14 },
   title: { fontSize: 20, fontWeight: '900', color: C.white },
   subtitle: { ...caps, fontSize: 10, color: C.mute, marginTop: 6, letterSpacing: 2 },
   closeBtn: { ...box, padding: 8, borderColor: '#3A3A3A' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

   variantCard: { backgroundColor: '#161616', borderRadius: 4, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
   variantCardActive: { borderColor: C.soft, backgroundColor: C.surface },
   colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
   colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
   colorTitle: { ...caps, fontSize: 12, fontWeight: 'bold', color: C.soft },

   chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
   exhibitionChip: { ...box, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10 },
   chipText: { fontSize: 11, color: C.soft, fontWeight: '500' },

   locationsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
   locBadge: { ...box, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
   locBadgeText: { fontSize: 11, fontWeight: '600', color: C.light },

   startAssignBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3A3A3A', borderRadius: 2 },
   startAssignText: { ...caps, fontSize: 10, fontWeight: '900', color: C.light, letterSpacing: 1.5 },

   assignPathContainer: { ...box, backgroundColor: '#0F0F0F', padding: 12, marginTop: 8 },
   slots: { flexDirection: 'row', gap: 6, marginBottom: 4 },
   slot: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A3A3A', borderRadius: 2 },
   slotFilled: { ...activeBox, borderStyle: 'solid' },
   slotText: { ...caps, fontSize: 11, fontWeight: '900', letterSpacing: 1 },

   stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 },
   stepNum: { fontSize: 10, fontWeight: '900', color: C.bg, backgroundColor: C.mute, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, overflow: 'hidden' },
   pathLabel: { ...caps, fontSize: 10, fontWeight: 'bold', color: C.mute, letterSpacing: 1.5 },
   pathScroll: { flexDirection: 'row', marginBottom: 2 },
   pathChip: { ...box, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6 },
   pathChipText: { fontSize: 12, color: C.soft, fontWeight: '600' },

   assignActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
   cancelAssignBtn: { ...btn, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3A3A3A' },
   cancelAssignText: { ...btnText, fontSize: 11, color: C.soft },
   confirmAssignBtn: { ...btn, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: C.light },
   confirmAssignText: { ...btnText, fontSize: 11, color: C.bg },
});S
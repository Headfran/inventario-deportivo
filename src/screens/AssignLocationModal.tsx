import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { X, MapPin, Eye, Check, Trash2, ChevronRight } from 'lucide-react-native';
import { Product, Shelf } from '../types/inventory';
import { updateProduct } from '../services/productService';
import { showAlert } from '../utils/alert';

interface AssignLocationModalProps {
   product: Product | null;
   shelves: Shelf[];
   visible: boolean;
   onClose: () => void;
}

export const AssignLocationModal: React.FC<AssignLocationModalProps> = ({ product, shelves, visible, onClose }) => {
   const [submitting, setSubmitting] = useState(false);

   // Estados para el selector paso a paso
   const [activeVariantIdx, setActiveVariantIdx] = useState<number | null>(null);
   const [selShelf, setSelShelf] = useState<Shelf | null>(null);
   const [selRow, setSelRow] = useState<number | null>(null);
   const [selSpace, setSelSpace] = useState<number | null>(null);

   if (!product) return null;

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

   return (
      <Modal visible={visible} animationType="slide" transparent>
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View>
                     <Text style={styles.title}>{product.name}</Text>
                     <Text style={styles.subtitle}>Gestión de Ubicaciones</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}><X size={20} color="#64748b" /></TouchableOpacity>
               </View>

               <ScrollView style={styles.body}>
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
                                       style={[styles.exhibitionChip, isExhibited && styles.exhibitionChipActive]}
                                       onPress={() => handleToggleExhibition(vIdx, sObj.size)}
                                    >
                                       <Eye size={12} color={isExhibited ? '#fff' : '#64748b'} style={{ marginRight: 4 }} />
                                       <Text style={[styles.exhibitionChipText, isExhibited && styles.exhibitionChipTextActive]}>Vitrina {sObj.size}</Text>
                                       {isExhibited && <Check size={12} color="#fff" style={{ marginLeft: 4 }} />}
                                    </TouchableOpacity>
                                 );
                              })}
                           </View>

                           <View style={styles.locationsList}>
                              {(variant.locations || []).map((loc, lIdx) => (
                                 <View key={lIdx} style={styles.locBadge}>
                                    <Text style={styles.locBadgeText}>{loc.shelfId} • F{loc.rowIndex} • E{loc.rumaIndex}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveLocation(vIdx, lIdx)} style={{ marginLeft: 6 }}>
                                       <Trash2 size={12} color="#ef4444" />
                                    </TouchableOpacity>
                                 </View>
                              ))}
                           </View>

                           {/* Interfaz Paso a Paso para Asignar (Oculta hasta hacer clic en "Asignar Nueva") */}
                           {!isAssigningThis ? (
                              <TouchableOpacity style={styles.startAssignBtn} onPress={() => {
                                 setActiveVariantIdx(vIdx); setSelShelf(null); setSelRow(null); setSelSpace(null);
                              }}>
                                 <MapPin size={14} color="#2563eb" style={{ marginRight: 6 }} />
                                 <Text style={styles.startAssignText}>Añadir a Estante</Text>
                              </TouchableOpacity>
                           ) : (
                              <View style={styles.assignPathContainer}>
                                 <Text style={styles.pathLabel}>1. Estante:</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                    {shelves.map(s => (
                                       <TouchableOpacity key={s.id} style={[styles.pathChip, selShelf?.id === s.id && styles.pathChipActive]}
                                          onPress={() => { setSelShelf(s); setSelRow(null); setSelSpace(null); }}>
                                          <Text style={[styles.pathChipText, selShelf?.id === s.id && styles.pathChipTextActive]}>{s.name}</Text>
                                       </TouchableOpacity>
                                    ))}
                                 </ScrollView>

                                 {selShelf && (
                                    <>
                                       <Text style={styles.pathLabel}>2. Fila / Nivel:</Text>
                                       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                          {Array.from({ length: selShelf.rowsCount }).map((_, r) => (
                                             <TouchableOpacity key={r} style={[styles.pathChip, selRow === r + 1 && styles.pathChipActive]}
                                                onPress={() => { setSelRow(r + 1); setSelSpace(null); }}>
                                                <Text style={[styles.pathChipText, selRow === r + 1 && styles.pathChipTextActive]}>Fila {r + 1}</Text>
                                             </TouchableOpacity>
                                          ))}
                                       </ScrollView>
                                    </>
                                 )}

                                 {selRow && (
                                    <>
                                       <Text style={styles.pathLabel}>3. Espacio:</Text>
                                       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathScroll}>
                                          {Array.from({ length: selShelf!.spacesPerRow }).map((_, s) => (
                                             <TouchableOpacity key={s} style={[styles.pathChip, selSpace === s + 1 && styles.pathChipActive]}
                                                onPress={() => setSelSpace(s + 1)}>
                                                <Text style={[styles.pathChipText, selSpace === s + 1 && styles.pathChipTextActive]}>Espacio {s + 1}</Text>
                                             </TouchableOpacity>
                                          ))}
                                       </ScrollView>
                                    </>
                                 )}

                                 <View style={styles.assignActions}>
                                    <TouchableOpacity style={styles.cancelAssignBtn} onPress={() => setActiveVariantIdx(null)}>
                                       <Text style={styles.cancelAssignText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                       style={[styles.confirmAssignBtn, (!selShelf || !selRow || !selSpace) && { opacity: 0.5 }]}
                                       disabled={!selShelf || !selRow || !selSpace || submitting}
                                       onPress={handleConfirmLocation}
                                    >
                                       <Text style={styles.confirmAssignText}>Guardar Ubicación</Text>
                                    </TouchableOpacity>
                                 </View>
                              </View>
                           )}
                        </View>
                     );
                  })}
               </ScrollView>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 540, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
   title: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
   subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
   body: { marginTop: 12 },
   variantCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
   variantCardActive: { borderColor: '#bfdbfe', backgroundColor: '#ffffff' },
   colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
   colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#cbd5e1' },
   colorTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
   chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
   exhibitionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16 },
   exhibitionChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
   exhibitionChipText: { fontSize: 11, color: '#475569', fontWeight: '500' },
   exhibitionChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   locationsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
   locBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
   locBadgeText: { fontSize: 11, fontWeight: '600', color: '#1e40af' },
   startAssignBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#e0e7ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
   startAssignText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
   assignPathContainer: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, marginTop: 8 },
   pathLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6, marginTop: 4 },
   pathScroll: { flexDirection: 'row', marginBottom: 6 },
   pathChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6 },
   pathChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   pathChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
   pathChipTextActive: { color: '#ffffff' },
   assignActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
   cancelAssignBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
   cancelAssignText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
   confirmAssignBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
   confirmAssignText: { fontSize: 13, color: '#ffffff', fontWeight: 'bold' },
});

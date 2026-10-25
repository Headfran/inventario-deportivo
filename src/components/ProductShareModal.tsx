import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Share2, X, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Product } from '../types/inventory';
import { formatProductShareText, advancedNativeShare } from '../utils/shareUtils';

interface Props { product: Product | null; visible: boolean; onClose: () => void; }

export const ProductShareModal: React.FC<Props> = ({ product, visible, onClose }) => {
   if (!product) return null;

   // AHORA SOPORTA MÚLTIPLES COLORES
   const [selectedColors, setSelectedColors] = useState<string[]>([]);

   // AHORA PERMITE ELEGIR LA IMAGEN A COMPARTIR (por defecto la primera)
   const [selectedImage, setSelectedImage] = useState<string>('');

   const [statusText, setStatusText] = useState<string | null>(null);

   useEffect(() => {
      if (visible && product) {
         setSelectedColors([]); // Resetear selección (Todas)
         setSelectedImage(product.images?.[0] || ''); // Seleccionar primera foto por defecto
      }
   }, [visible, product]);

   const toggleColor = (color: string) => {
      if (selectedColors.includes(color)) {
         setSelectedColors(prev => prev.filter(c => c !== color));
      } else {
         setSelectedColors(prev => [...prev, color]);
      }
   };

   const formattedMessage = formatProductShareText(product, selectedColors);

   const handleShare = async () => {
      await advancedNativeShare(product, selectedColors, selectedImage, setStatusText);
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            {statusText && (
               <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={styles.loadingText}>{statusText}</Text>
               </View>
            )}

            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Share2 size={20} color="#2563eb" />
                     <Text style={styles.title}>Compartir Inventario</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}><X size={20} color="#64748b" /></TouchableOpacity>
               </View>
               <View style={styles.body}>

                  {/* SELECTOR DE IMAGEN */}
                  {product.images && product.images.length > 0 && (
                     <>
                        <Text style={styles.label}>1. Selecciona la foto para enviar:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                           {product.images.map((img, idx) => (
                              <TouchableOpacity
                                 key={idx}
                                 activeOpacity={0.8}
                                 onPress={() => setSelectedImage(img)}
                                 style={[styles.imageThumbnail, selectedImage === img && styles.imageThumbnailActive]}
                              >
                                 <Image source={{ uri: img }} style={styles.thumbnailImg} contentFit="cover" />
                                 {selectedImage === img && (
                                    <View style={styles.thumbnailCheck}>
                                       <Check size={18} color="#ffffff" />
                                    </View>
                                 )}
                              </TouchableOpacity>
                           ))}
                        </ScrollView>
                     </>
                  )}

                  {/* SELECTOR MÚLTIPLE DE COLORES */}
                  <Text style={styles.label}>2. Elige qué colores incluir (Toca varios):</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                     <TouchableOpacity
                        style={[styles.colorChip, selectedColors.length === 0 && styles.colorChipActive]}
                        onPress={() => setSelectedColors([])}
                     >
                        <Text style={[styles.colorChipText, selectedColors.length === 0 && styles.colorChipTextActive]}>Todos</Text>
                     </TouchableOpacity>

                     {product.variants.map((v, i) => (
                        <TouchableOpacity
                           key={i}
                           style={[styles.colorChip, selectedColors.includes(v.color) && styles.colorChipActive]}
                           onPress={() => toggleColor(v.color)}
                        >
                           <Text style={[styles.colorChipText, selectedColors.includes(v.color) && styles.colorChipTextActive]}>{v.color}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <View style={styles.nativeShareBox}>
                     <Text style={styles.nativeShareTitle}>Compartir Directo</Text>
                     <Text style={styles.nativeShareDesc}>Enviará la foto seleccionada y el texto con las tallas ya organizadas a WhatsApp o Instagram.</Text>
                     <TouchableOpacity style={styles.nativeShareBtn} onPress={handleShare}>
                        <Share2 size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.nativeShareBtnText}>Compartir Ahora</Text>
                     </TouchableOpacity>
                  </View>

                  <View style={styles.previewBox}>
                     <Text style={styles.previewTitle}>Vista Previa del Texto:</Text>
                     <Text style={styles.previewText} numberOfLines={5}>{formattedMessage}</Text>
                  </View>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
   loadingText: { color: '#ffffff', marginTop: 12, fontSize: 15, fontWeight: 'bold' },
   card: { width: '100%', maxWidth: 440, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   title: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   body: { padding: 16 },
   label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 8 },

   imageScroll: { flexDirection: 'row', marginBottom: 16, marginHorizontal: -4 },
   imageThumbnail: { width: 70, height: 70, borderRadius: 8, marginHorizontal: 4, overflow: 'hidden', borderWidth: 2, borderColor: '#e2e8f0', position: 'relative' },
   imageThumbnailActive: { borderColor: '#2563eb' },
   thumbnailImg: { width: '100%', height: '100%' },
   thumbnailCheck: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(37,99,235,0.4)', justifyContent: 'center', alignItems: 'center' },

   colorChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
   colorChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   colorChipText: { fontSize: 12, color: '#334155', fontWeight: '500' },
   colorChipTextActive: { color: '#ffffff', fontWeight: 'bold' },

   nativeShareBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 16, marginBottom: 16 },
   nativeShareTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 },
   nativeShareDesc: { fontSize: 11, color: '#3b82f6', marginBottom: 12 },
   nativeShareBtn: { flexDirection: 'row', backgroundColor: '#2563eb', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
   nativeShareBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

   previewBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 },
   previewTitle: { fontSize: 10, color: '#64748b', fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase' },
   previewText: { fontSize: 11, color: '#475569', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Platform, ActivityIndicator } from 'react-native';
import { MessageCircle, X, Copy, Check, Share2 } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { formatProductShareText, advancedNativeShare } from '../utils/shareUtils';

interface Props { product: Product | null; visible: boolean; onClose: () => void; }

export const ProductShareModal: React.FC<Props> = ({ product, visible, onClose }) => {
   if (!product) return null;
   const [selectedColor, setSelectedColor] = useState<string>('');
   const [copied, setCopied] = useState(false);
   const [statusText, setStatusText] = useState<string | null>(null);

   const formattedMessage = formatProductShareText(product, selectedColor);

   const handleCopy = () => { /* ... logica de copy normal ... */ };

   const handleShare = async () => {
      await advancedNativeShare(product, selectedColor, setStatusText);
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            {/* OVERLAY DE CARGA Y UX */}
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
                     <Text style={styles.title}>Compartir Prenda</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}><X size={20} color="#64748b" /></TouchableOpacity>
               </View>
               <View style={styles.body}>
                  <Text style={styles.label}>Filtrar variante para compartir:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                     <TouchableOpacity style={[styles.colorChip, !selectedColor && styles.colorChipActive]} onPress={() => setSelectedColor('')}><Text style={[styles.colorChipText, !selectedColor && styles.colorChipTextActive]}>Todas</Text></TouchableOpacity>
                     {product.variants.map((v, i) => (
                        <TouchableOpacity key={i} style={[styles.colorChip, selectedColor === v.color && styles.colorChipActive]} onPress={() => setSelectedColor(v.color)}><Text style={[styles.colorChipText, selectedColor === v.color && styles.colorChipTextActive]}>{v.color}</Text></TouchableOpacity>
                     ))}
                  </View>

                  <View style={styles.nativeShareBox}>
                     <Text style={styles.nativeShareTitle}>Compartir Nativo (Imagen + Texto)</Text>
                     <Text style={styles.nativeShareDesc}>Abre el menú de tu dispositivo para enviarlo a WhatsApp, Telegram, Instagram, etc.</Text>
                     <TouchableOpacity style={styles.nativeShareBtn} onPress={handleShare}>
                        <Share2 size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.nativeShareBtnText}>Compartir Ahora</Text>
                     </TouchableOpacity>
                  </View>

                  <View style={styles.previewBox}>
                     <Text style={styles.previewText} numberOfLines={4}>{formattedMessage}</Text>
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
   colorChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
   colorChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   colorChipText: { fontSize: 12, color: '#334155' },
   colorChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   nativeShareBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 16, marginBottom: 20 },
   nativeShareTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 },
   nativeShareDesc: { fontSize: 11, color: '#3b82f6', marginBottom: 12 },
   nativeShareBtn: { flexDirection: 'row', backgroundColor: '#2563eb', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
   nativeShareBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
   previewBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 12 },
   previewText: { fontSize: 11, color: '#166534', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

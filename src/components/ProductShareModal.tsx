import React, { useState } from 'react';
import {
   View,
   Text,
   Modal,
   StyleSheet,
   TouchableOpacity,
   TextInput,
   Image,
   ScrollView,
   Platform
} from 'react-native';
import { MessageCircle, Download, X, Copy, Check, ExternalLink } from 'lucide-react-native';
import { Product } from '../types/inventory';
import {
   formatProductWhatsAppMessage,
   openWhatsAppShare,
   downloadImageLocal,
} from '../utils/shareUtils';

interface Props {
   product: Product | null;
   visible: boolean;
   onClose: () => void;
}

export const ProductShareModal: React.FC<Props> = ({ product, visible, onClose }) => {
   if (!product) return null;

   const [phone, setPhone] = useState('');
   const [selectedColor, setSelectedColor] = useState<string>('');
   const [copied, setCopied] = useState(false);

   const formattedMessage = formatProductWhatsAppMessage(product, selectedColor);

   const handleCopyText = () => {
      if (navigator?.clipboard) {
         navigator.clipboard.writeText(formattedMessage);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
      }
   };

   const handleDownloadAllImages = async () => {
      for (let i = 0; i < product.images.length; i++) {
         const imgUrl = product.images[i];
         const cleanBrand = product.brand.replace(/\s+/g, '_');
         const cleanCode = product.code.replace(/\s+/g, '_');
         await downloadImageLocal(imgUrl, `${cleanBrand}_${cleanCode}_foto_${i + 1}.jpg`);
      }
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={styles.card}>
               {/* CABECERA */}
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <MessageCircle size={20} color="#25d366" />
                     <Text style={styles.title}>Compartir por WhatsApp</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color="#64748b" />
                  </TouchableOpacity>
               </View>

               <ScrollView style={styles.body}>
                  {/* NUMERO DE TELÉFONO OPCIONAL */}
                  <Text style={styles.label}>Número de WhatsApp del cliente (Opcional):</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="Ej: +584121234567"
                     placeholderTextColor="#94a3b8"
                     value={phone}
                     onChangeText={setPhone}
                     keyboardType="phone-pad"
                  />

                  {/* FILTRAR COLOR OPCIONAL */}
                  <Text style={styles.label}>Filtrar color específico:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                     <TouchableOpacity
                        style={[styles.colorChip, !selectedColor && styles.colorChipActive]}
                        onPress={() => setSelectedColor('')}
                     >
                        <Text style={[styles.colorChipText, !selectedColor && styles.colorChipTextActive]}>
                           Todos los colores
                        </Text>
                     </TouchableOpacity>
                     {product.variants.map((v, idx) => (
                        <TouchableOpacity
                           key={idx}
                           style={[styles.colorChip, selectedColor === v.color && styles.colorChipActive]}
                           onPress={() => setSelectedColor(v.color)}
                        >
                           <Text
                              style={[
                                 styles.colorChipText,
                                 selectedColor === v.color && styles.colorChipTextActive,
                              ]}
                           >
                              {v.color}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>

                  {/* PREVISUALIZACIÓN DEL MENSAJE */}
                  <Text style={styles.label}>Vista previa del mensaje:</Text>
                  <View style={styles.previewBox}>
                     <Text style={styles.previewText}>{formattedMessage}</Text>
                     <TouchableOpacity style={styles.copyBtn} onPress={handleCopyText}>
                        {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} color="#475569" />}
                        <Text style={styles.copyBtnText}>{copied ? '¡Copiado!' : 'Copiar texto'}</Text>
                     </TouchableOpacity>
                  </View>

                  {/* FOTOS DEL PRODUCTO Y DESCARGA */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
                     <Text style={styles.label}>Fotos de la prenda ({product.images.length}):</Text>
                     {product.images.length > 0 && (
                        <TouchableOpacity style={styles.downloadAllBtn} onPress={handleDownloadAllImages}>
                           <Download size={12} color="#2563eb" style={{ marginRight: 4 }} />
                           <Text style={styles.downloadAllText}>Descargar todas</Text>
                        </TouchableOpacity>
                     )}
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                     {product.images.map((imgUrl, idx) => (
                        <View key={idx} style={styles.photoContainer}>
                           <Image source={{ uri: imgUrl }} style={styles.photoImg} resizeMode="cover" />
                           <TouchableOpacity
                              style={styles.downloadSingleBtn}
                              onPress={() =>
                                 downloadImageLocal(
                                    imgUrl,
                                    `${product.brand}_${product.code}_foto_${idx + 1}.jpg`
                                 )
                              }
                           >
                              <Download size={14} color="#ffffff" />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </ScrollView>
               </ScrollView>

               {/* PIE Y BOTÓN ACCIÓN */}
               <View style={styles.footer}>
                  <TouchableOpacity
                     style={styles.sendWhatsAppBtn}
                     onPress={() => {
                        openWhatsAppShare(product, phone, selectedColor);
                        onClose();
                     }}
                  >
                     <MessageCircle size={18} color="#ffffff" style={{ marginRight: 8 }} />
                     <Text style={styles.sendWhatsAppText}>Abrir en WhatsApp</Text>
                     <ExternalLink size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   title: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   body: { padding: 16 },
   label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 13, color: '#0f172a', marginBottom: 12 },
   colorChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
   colorChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   colorChipText: { fontSize: 11, color: '#334155' },
   colorChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   previewBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 12, position: 'relative' },
   previewText: { fontSize: 12, color: '#166534', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 18 },
   copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-end', marginTop: 8 },
   copyBtnText: { fontSize: 11, color: '#475569', marginLeft: 4, fontWeight: '600' },
   downloadAllBtn: { flexDirection: 'row', alignItems: 'center' },
   downloadAllText: { fontSize: 11, color: '#2563eb', fontWeight: 'bold' },
   photosScroll: { flexDirection: 'row', marginBottom: 16 },
   photoContainer: { width: 70, height: 70, borderRadius: 8, overflow: 'hidden', marginRight: 8, position: 'relative' },
   photoImg: { width: '100%', height: '100%' },
   downloadSingleBtn: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(15, 23, 42, 0.75)', borderRadius: 12, padding: 4 },
   footer: { padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   sendWhatsAppBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#25d366', paddingVertical: 12, borderRadius: 10 },
   sendWhatsAppText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});

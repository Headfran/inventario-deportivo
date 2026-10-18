import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Platform } from 'react-native';
import { MessageCircle, Download, X, Copy, Check, ExternalLink } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { formatProductWhatsAppMessage, openWhatsAppShare, downloadImageLocal } from '../utils/shareUtils';
import { C, caps, box, activeBox, activeText, label, btn, btnText, overlay, modalCard } from '../theme';

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
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <MessageCircle size={20} color={C.light} />
                     <Text style={styles.title}>Compartir por WhatsApp</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color={C.soft} />
                  </TouchableOpacity>
               </View>

               <ScrollView style={{ padding: 16 }}>
                  <Text style={styles.label}>Número de WhatsApp del cliente (Opcional):</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="Ej: +584121234567"
                     placeholderTextColor={C.dim}
                     value={phone}
                     onChangeText={setPhone}
                     keyboardType="phone-pad"
                  />

                  <Text style={styles.label}>Filtrar color específico:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                     <TouchableOpacity
                        style={[styles.chip, !selectedColor && activeBox]}
                        onPress={() => setSelectedColor('')}
                     >
                        <Text style={[styles.chipText, !selectedColor && activeText]}>Todos los colores</Text>
                     </TouchableOpacity>
                     {product.variants.map((v, idx) => (
                        <TouchableOpacity
                           key={idx}
                           style={[styles.chip, selectedColor === v.color && activeBox]}
                           onPress={() => setSelectedColor(v.color)}
                        >
                           <Text style={[styles.chipText, selectedColor === v.color && activeText]}>{v.color}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>

                  <Text style={styles.label}>Vista previa del mensaje:</Text>
                  <View style={styles.previewBox}>
                     <Text style={styles.previewText}>{formattedMessage}</Text>
                     <TouchableOpacity style={styles.copyBtn} onPress={handleCopyText}>
                        {copied ? <Check size={14} color={C.light} /> : <Copy size={14} color={C.mute} />}
                        <Text style={styles.copyBtnText}>{copied ? '¡Copiado!' : 'Copiar texto'}</Text>
                     </TouchableOpacity>
                  </View>

                  <View style={styles.photosHeader}>
                     <Text style={[styles.label, { marginBottom: 0 }]}>Fotos de la prenda ({product.images.length}):</Text>
                     {product.images.length > 0 && (
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={handleDownloadAllImages}>
                           <Download size={12} color={C.light} style={{ marginRight: 4 }} />
                           <Text style={styles.downloadAllText}>Descargar todas</Text>
                        </TouchableOpacity>
                     )}
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                     {product.images.map((imgUrl, idx) => (
                        <View key={idx} style={styles.photo}>
                           <Image source={{ uri: imgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                           <TouchableOpacity
                              style={styles.downloadSingleBtn}
                              onPress={() => downloadImageLocal(imgUrl, `${product.brand}_${product.code}_foto_${idx + 1}.jpg`)}
                           >
                              <Download size={14} color={C.white} />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </ScrollView>
               </ScrollView>

               <View style={styles.footer}>
                  <TouchableOpacity
                     style={styles.sendBtn}
                     onPress={() => {
                        openWhatsAppShare(product, phone, selectedColor);
                        onClose();
                     }}
                  >
                     <MessageCircle size={18} color={C.bg} style={{ marginRight: 8 }} />
                     <Text style={styles.sendText}>Abrir en WhatsApp</Text>
                     <ExternalLink size={14} color={C.bg} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: modalCard,
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border },
   title: { ...caps, fontSize: 13, fontWeight: '900', color: C.white },
   label,
   input: { ...box, paddingHorizontal: 12, height: 40, fontSize: 13, color: C.white, marginBottom: 12 },
   chip: { ...box, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
   chipText: { fontSize: 11, color: C.soft },
   previewBox: { ...box, padding: 12 },
   previewText: { fontSize: 12, color: C.light, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 18 },
   copyBtn: { ...box, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-end', marginTop: 8 },
   copyBtnText: { fontSize: 11, color: C.soft, marginLeft: 4, fontWeight: '600' },
   photosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
   downloadAllText: { ...caps, fontSize: 10, color: C.light, fontWeight: 'bold', letterSpacing: 1 },
   photo: { width: 70, height: 70, borderRadius: 2, overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: C.line },
   downloadSingleBtn: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12, padding: 4 },
   footer: { padding: 16, backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border },
   sendBtn: { ...btn, backgroundColor: C.light },
   sendText: { ...btnText, color: C.bg },
});
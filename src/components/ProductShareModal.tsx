import React, { useState, useEffect } from 'react';
import {
   View, Text, Modal, StyleSheet, TouchableOpacity, TextInput,
   ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { MessageCircle, X, Check, Copy, Share2 } from 'lucide-react-native';
import { Product } from '../types/inventory';
import {
   formatProductShareText,
   advancedNativeShare,
   openWhatsAppShare,
} from '../utils/shareUtils';
import { C, caps, box, activeBox, activeText, label, btn, btnText, overlay, modalCard } from '../theme';

interface Props {
   product: Product | null;
   visible: boolean;
   onClose: () => void;
}

export const ProductShareModal: React.FC<Props> = ({ product, visible, onClose }) => {
   if (!product) return null;

   const [phone, setPhone] = useState('');
   const [selectedColors, setSelectedColors] = useState<string[]>([]);
   const [selectedImage, setSelectedImage] = useState<string>('');
   const [copied, setCopied] = useState(false);
   const [statusText, setStatusText] = useState<string | null>(null);

   useEffect(() => {
      if (visible && product) {
         setSelectedColors([]);
         setSelectedImage(product.images?.[0] || '');
         setPhone('');
         setCopied(false);
         setStatusText(null);
      }
   }, [visible, product]);

   const toggleColor = (color: string) => {
      setSelectedColors((prev) =>
         prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
      );
   };

   const formattedMessage = formatProductShareText(product, selectedColors);

   const handleCopyText = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
         navigator.clipboard.writeText(formattedMessage);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
      }
   };

   const handleShareWithImage = async () => {
      await advancedNativeShare(product, selectedColors, selectedImage, setStatusText);
      onClose();
   };

   const handleWhatsAppOnly = async () => {
      await openWhatsAppShare(product, phone, selectedColors);
      onClose();
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            {statusText && (
               <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={C.white} />
                  <Text style={styles.loadingText}>{statusText}</Text>
               </View>
            )}

            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Share2 size={20} color={C.light} />
                     <Text style={styles.title}>Compartir Producto</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color={C.soft} />
                  </TouchableOpacity>
               </View>

               <ScrollView style={{ padding: 16, flexGrow: 0 }}>
                  {/* SELECTOR DE IMAGEN */}
                  {product.images && product.images.length > 0 && (
                     <>
                        <Text style={styles.label}>Foto a enviar:</Text>
                        <View style={styles.wrapRow}>
                           {product.images.map((img, idx) => (
                              <TouchableOpacity
                                 key={idx}
                                 style={[styles.photo, selectedImage === img && styles.photoActive]}
                                 onPress={() => setSelectedImage(img)}
                                 activeOpacity={0.8}
                              >
                                 <Image
                                    source={{ uri: img }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                 />
                                 {selectedImage === img && (
                                    <View style={styles.photoCheck}>
                                       <Check size={16} color={C.white} />
                                    </View>
                                 )}
                              </TouchableOpacity>
                           ))}
                        </View>
                     </>
                  )}

                  {/* SELECTOR MÚLTIPLE DE COLORES */}
                  <Text style={styles.label}>Colores a incluir:</Text>
                  <View style={[styles.wrapRow, { marginBottom: 14 }]}>
                     <TouchableOpacity
                        style={[styles.chip, selectedColors.length === 0 && activeBox]}
                        onPress={() => setSelectedColors([])}
                     >
                        <Text style={[styles.chipText, selectedColors.length === 0 && activeText]}>
                           Todos
                        </Text>
                     </TouchableOpacity>
                     {product.variants.map((v, idx) => (
                        <TouchableOpacity
                           key={idx}
                           style={[styles.chip, selectedColors.includes(v.color) && activeBox]}
                           onPress={() => toggleColor(v.color)}
                        >
                           <Text style={[styles.chipText, selectedColors.includes(v.color) && activeText]}>
                              {v.color}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  {/* TELÉFONO (opcional) */}
                  <Text style={styles.label}>WhatsApp del cliente (opcional):</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="Ej: +584121234567"
                     placeholderTextColor={C.dim}
                     value={phone}
                     onChangeText={setPhone}
                     keyboardType="phone-pad"
                  />

                  {/* PREVIEW DEL MENSAJE */}
                  <Text style={styles.label}>Vista previa del mensaje:</Text>
                  <View style={styles.previewBox}>
                     <Text style={styles.previewText}>{formattedMessage}</Text>
                     <TouchableOpacity style={styles.copyBtn} onPress={handleCopyText}>
                        {copied ? (
                           <Check size={14} color={C.light} />
                        ) : (
                           <Copy size={14} color={C.mute} />
                        )}
                        <Text style={styles.copyBtnText}>{copied ? '¡Copiado!' : 'Copiar texto'}</Text>
                     </TouchableOpacity>
                  </View>
               </ScrollView>

               <View style={styles.footer}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleWhatsAppOnly}>
                     <MessageCircle size={16} color={C.light} style={{ marginRight: 6 }} />
                     <Text style={styles.secondaryText}>Solo texto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleShareWithImage}>
                     <Share2 size={16} color={C.bg} style={{ marginRight: 6 }} />
                     <Text style={styles.primaryText}>Compartir con foto</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: { ...modalCard, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border },
   title: { ...caps, fontSize: 13, fontWeight: '900', color: C.white },
   label,
   input: { ...box, paddingHorizontal: 12, height: 40, fontSize: 13, color: C.white, marginBottom: 12 },
   wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
   },

   photo: {
      width: 70,
      height: 70,
      borderRadius: 4,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: C.line,
      position: 'relative',
   },
   photoActive: { borderColor: C.light },
   photoCheck: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

   chip: {
      ...box,
      paddingHorizontal: 10,
      paddingVertical: 5,
   },
   chipText: { fontSize: 11, color: C.soft },

   previewBox: { ...box, padding: 12 },
   previewText: { fontSize: 12, color: C.light, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 18 },
   copyBtn: { ...box, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-end', marginTop: 8 },
   copyBtnText: { fontSize: 11, color: C.soft, marginLeft: 4, fontWeight: '600' },

   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border },
   secondaryBtn: { ...btn, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3A3A3A' },
   secondaryText: { ...btnText, color: C.soft },
   primaryBtn: { ...btn, paddingHorizontal: 14, backgroundColor: C.light },
   primaryText: { ...btnText, color: C.bg },

   loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100, justifyContent: 'center', alignItems: 'center', padding: 24 },
   loadingText: { color: C.white, marginTop: 12, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' },
});

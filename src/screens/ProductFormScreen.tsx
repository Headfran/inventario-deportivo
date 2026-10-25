import React, { useState, useRef } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   ScrollView,
   ActivityIndicator,
   Alert,
   Modal,
   Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Product, ProductCategory, ProductVariant } from '../types/inventory';
import { deleteImageFromR2, uploadImageToR2 } from '../services/storage';
import { optimizeImage } from '../utils/imageOptimizer';
import { createProduct, updateProduct } from '../services/productService';
import * as ImagePicker from 'expo-image-picker';
import { showConfirm, showAlert } from '../utils/alert';

interface ProductFormProps {
   initialProduct?: Product | null;
   availableBrands?: string[];
   onClose: () => void;
}

interface ImageItem {
   id: string;
   url: string;
   isNew: boolean;
}

const CATEGORIES: ProductCategory[] = [
   'Zapatos', 'Camisas', 'Camisas AAA', 'Franelillas', 'Franelillas AAA',
   'Chemises', 'Sudaderas', 'Chaquetas', 'Shorts', 'Monos', 'Conjuntos', 'Accesorios', 'Otros'
];

const PRESET_COLORS = [
   { name: 'Negro', hex: '#000000' },
   { name: 'Blanco', hex: '#ffffff' },
   { name: 'Gris Oscuro', hex: '#374151' },
   { name: 'Gris', hex: '#6b7280' },
   { name: 'Gris Claro', hex: '#d1d5db' },
   { name: 'Marrón', hex: '#8b4513' },
   { name: 'Beige', hex: '#d4b895' },
   { name: 'Rojo', hex: '#ef4444' },
   { name: 'Azul Marino', hex: '#1e3a8a' },
   { name: 'Azul Rey', hex: '#2563eb' },
   { name: 'Celeste', hex: '#0ea5e9' },
   { name: 'Verde', hex: '#16a34a' },
   { name: 'Verde Aqua', hex: '#20c997' },
   { name: 'Amarillo', hex: '#eab308' },
   { name: 'Naranja', hex: '#f97316' },
   { name: 'Rosado', hex: '#ec4899' },
];

const PRESET_SIZES_CLOTHING = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const PRESET_SIZES_SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

const normalizeVariants = (rawVariants?: any[]): ProductVariant[] => {
   if (!rawVariants || rawVariants.length === 0) {
      return [{
         id: `var_${Date.now()}`,
         color: 'Negro',
         colorHex: '#000000',
         sizes: [{ size: 'M', stock: 1 }],
         locations: [],
         exhibition: { isOnDisplay: false }
      }];
   }
   return rawVariants.map((v, idx) => {
      if (Array.isArray(v.sizes)) {
         return {
            id: v.id || `var_${Date.now()}_${idx}`,
            color: v.color || 'Negro',
            colorHex: v.colorHex || '#000000',
            sizes: v.sizes,
            locations: v.locations || [],
            exhibition: v.exhibition || { isOnDisplay: false }
         };
      }
      return {
         id: v.id || `var_${Date.now()}_${idx}`,
         color: v.color || 'Negro',
         colorHex: v.colorHex || '#000000',
         sizes: v.size ? [{ size: v.size, stock: Number(v.stock) || 0 }] : [],
         locations: v.locations || [],
         exhibition: v.exhibition || { isOnDisplay: false }
      };
   });
};

export const ProductFormScreen: React.FC<ProductFormProps> = ({ initialProduct, availableBrands = [], onClose }) => {
   const [code, setCode] = useState(initialProduct?.code || '');
   const [name, setName] = useState(initialProduct?.name || '');

   // ¡Añadidas marcas 'On' y 'Alo' a la lista principal!
   const defaultBrands = ['Nike', 'Under Armour', 'Adidas', 'Puma', 'On', 'Alo', 'Ovejita', 'Columbia'];
   const mergedBrands = Array.from(new Set([...defaultBrands, ...availableBrands])).slice(0, 15);

   const isInitialBrandCustom = initialProduct?.brand && !mergedBrands.includes(initialProduct.brand);
   const [brand, setBrand] = useState(initialProduct?.brand || '');
   const [isCustomBrand, setIsCustomBrand] = useState<boolean>(!!isInitialBrandCustom);

   const [category, setCategory] = useState<ProductCategory>(initialProduct?.category || 'Camisas');
   const [price, setPrice] = useState(initialProduct?.price ? String(initialProduct.price) : '');
   const [uploadingImage, setUploadingImage] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [lightboxImage, setLightboxImage] = useState<string | null>(null);

   const [imageItems, setImageItems] = useState<ImageItem[]>(
      (initialProduct?.images || []).map((url, idx) => ({ id: `existing_${idx}`, url, isNew: false }))
   );
   const [variants, setVariants] = useState<ProductVariant[]>(normalizeVariants(initialProduct?.variants));

   const brandScrollRef = useRef<ScrollView>(null);
   const [brandScrollX, setBrandScrollX] = useState(0);
   const categoryScrollRef = useRef<ScrollView>(null);
   const [categoryScrollX, setCategoryScrollX] = useState(0);

   const handleScroll = (ref: React.RefObject<ScrollView>, currentX: number, dir: 'left' | 'right') => {
      const step = 200;
      const newX = dir === 'left' ? Math.max(0, currentX - step) : currentX + step;
      ref.current?.scrollTo({ x: newX, animated: true });
   };

   const handleSelectImage = async () => {
      if (imageItems.length >= 2) {
         showAlert('Límite alcanzado', 'Solo puedes incluir hasta 2 imágenes por prenda.');
         return;
      }
      try {
         const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
         });
         if (result.canceled || !result.assets || result.assets.length === 0) return;

         setImageItems((prev) => [...prev, { id: `new_${Date.now()}`, url: result.assets[0].uri, isNew: true }]);
      } catch (error: any) {
         showAlert('Error', 'No se pudo abrir la galería.');
      }
   };

   const handleRemoveImage = (itemToRemove: ImageItem) => {
      if (itemToRemove.isNew) {
         setImageItems(prev => prev.filter(item => item.id !== itemToRemove.id));
         return;
      }
      showConfirm(
         '🚨 Confirmación',
         'Esta imagen ya está alojada en la nube. ¿Deseas eliminarla permanentemente?',
         async () => {
            try {
               await deleteImageFromR2(itemToRemove.url);
               setImageItems(prev => prev.filter(item => item.id !== itemToRemove.id));
               showAlert('Eliminado', 'La imagen fue borrada con éxito.');
            } catch (error: any) {
               showAlert('Error', 'No se pudo eliminar la imagen.');
            }
         }
      );
   };

   const handleAddColorGroup = () => {
      setVariants(prev => [
         ...prev,
         {
            id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            color: 'Blanco', colorHex: '#ffffff',
            sizes: [{ size: 'M', stock: 1 }], locations: [], exhibition: { isOnDisplay: false }
         }
      ]);
   };

   const handleToggleSize = (colorIdx: number, sizeName: string) => {
      setVariants(prev => {
         const updated = [...prev];
         const currentSizes = updated[colorIdx].sizes || [];
         const exists = currentSizes.find(s => s.size === sizeName);
         if (exists) updated[colorIdx].sizes = currentSizes.filter(s => s.size !== sizeName);
         else updated[colorIdx].sizes = [...currentSizes, { size: sizeName, stock: 1 }];
         return updated;
      });
   };

   const handleSubmit = async () => {
      if (!code.trim() || !name.trim() || !brand.trim() || !price.trim()) {
         Alert.alert('Campos incompletos', 'Por favor llena código, nombre, marca y precio.');
         return;
      }
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
         Alert.alert('Precio inválido', 'Ingresa un precio mayor a 0.');
         return;
      }
      try {
         setSubmitting(true);
         const finalImageUrls: string[] = [];
         for (const item of imageItems) {
            if (!item.isNew) {
               finalImageUrls.push(item.url);
            } else {
               const webpBlob = await optimizeImage(item.url, 800, 0.65);
               const uploadedUrl = await uploadImageToR2(webpBlob);
               finalImageUrls.push(uploadedUrl);
            }
         }
         const productPayload: Omit<Product, 'id'> = {
            code: code.trim().toUpperCase(), name: name.trim(), brand: brand.trim(), category,
            price: parsedPrice, images: finalImageUrls, variants,
         };
         if (initialProduct?.id) await updateProduct(initialProduct.id, productPayload);
         else await createProduct(productPayload);
         onClose();
      } catch (error: any) {
         Alert.alert('Error', error.message || 'No se pudo completar el registro.');
      } finally {
         setSubmitting(false);
      }
   };

   const availableSizes = category === 'Zapatos' ? PRESET_SIZES_SHOES : PRESET_SIZES_CLOTHING;

   return (
      <>
         <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
               <Text style={styles.title}>{initialProduct ? 'Editar Prenda' : 'Nueva Prenda'}</Text>
               <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <X size={24} color="#64748b" />
               </TouchableOpacity>
            </View>

            <View style={styles.row}>
               <View style={styles.flex1}>
                  <Text style={styles.label}>Código / SKU *</Text>
                  <TextInput style={styles.input} placeholder="NK-DFT-01" value={code} onChangeText={setCode} autoCapitalize="characters" />
               </View>
               <View style={styles.flex1}>
                  <Text style={styles.label}>Precio ($) *</Text>
                  <TextInput style={styles.input} placeholder="25.00" value={price} onChangeText={setPrice} keyboardType="numeric" />
               </View>
            </View>

            <Text style={styles.label}>Nombre de la prenda *</Text>
            <TextInput style={styles.input} placeholder="Franelilla Running Dri-FIT" value={name} onChangeText={setName} />

            <Text style={styles.label}>Marca *</Text>
            <View style={styles.horizontalScrollWrapper}>
               <TouchableOpacity style={styles.scrollArrow} onPress={() => handleScroll(brandScrollRef, brandScrollX, 'left')}>
                  <ChevronLeft size={20} color="#64748b" />
               </TouchableOpacity>
               <ScrollView
                  ref={brandScrollRef}
                  horizontal showsHorizontalScrollIndicator={false}
                  style={styles.flex1}
                  onScroll={(e) => setBrandScrollX(e.nativeEvent.contentOffset.x)}
                  scrollEventThrottle={16}
               >
                  {mergedBrands.map((b) => {
                     const isActive = brand === b && !isCustomBrand;
                     return (
                        <TouchableOpacity
                           key={b} style={[styles.chip, isActive && styles.chipActive]}
                           onPress={() => { setBrand(b); setIsCustomBrand(false); }}
                        >
                           <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{b}</Text>
                        </TouchableOpacity>
                     );
                  })}
                  <TouchableOpacity
                     style={[styles.chip, isCustomBrand && styles.chipActive]}
                     onPress={() => { setBrand(''); setIsCustomBrand(true); }}
                  >
                     <Text style={[styles.chipText, isCustomBrand && styles.chipTextActive]}>Otra...</Text>
                  </TouchableOpacity>
               </ScrollView>
               <TouchableOpacity style={styles.scrollArrow} onPress={() => handleScroll(brandScrollRef, brandScrollX, 'right')}>
                  <ChevronRight size={20} color="#64748b" />
               </TouchableOpacity>
            </View>

            {isCustomBrand && (
               <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Escribe la marca nueva..." value={brand} onChangeText={setBrand} />
            )}

            <Text style={[styles.label, { marginTop: 12 }]}>Categoría *</Text>
            <View style={styles.horizontalScrollWrapper}>
               <TouchableOpacity style={styles.scrollArrow} onPress={() => handleScroll(categoryScrollRef, categoryScrollX, 'left')}>
                  <ChevronLeft size={20} color="#64748b" />
               </TouchableOpacity>
               <ScrollView
                  ref={categoryScrollRef}
                  horizontal showsHorizontalScrollIndicator={false}
                  style={styles.flex1}
                  onScroll={(e) => setCategoryScrollX(e.nativeEvent.contentOffset.x)}
                  scrollEventThrottle={16}
               >
                  {CATEGORIES.map((cat) => (
                     <TouchableOpacity
                        key={cat} style={[styles.chip, category === cat && styles.chipActive]}
                        onPress={() => setCategory(cat)}
                     >
                        <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                     </TouchableOpacity>
                  ))}
               </ScrollView>
               <TouchableOpacity style={styles.scrollArrow} onPress={() => handleScroll(categoryScrollRef, categoryScrollX, 'right')}>
                  <ChevronRight size={20} color="#64748b" />
               </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Imágenes de la Prenda (Máx. 2)</Text>
            <View style={styles.imageGrid}>
               {imageItems.map((item) => (
                  <View key={item.id} style={styles.imageCard}>
                     {/* Solución de Layout: La imagen abarca todo, y el botón es una capa invisible encima */}
                     <Image source={{ uri: item.url }} style={styles.previewImage} contentFit="cover" />
                     <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={0.1}
                        onPress={() => setLightboxImage(item.url)}
                     />
                     <TouchableOpacity style={styles.removeImgBtn} onPress={() => handleRemoveImage(item)}>
                        <X size={14} color="#ffffff" />
                     </TouchableOpacity>
                  </View>
               ))}
               {imageItems.length < 2 && (
                  <TouchableOpacity style={styles.uploadCard} onPress={handleSelectImage} disabled={uploadingImage}>
                     {uploadingImage ? (
                        <ActivityIndicator color="#2563eb" />
                     ) : (
                        <>
                           <Text style={styles.uploadIcon}>📷</Text>
                           <Text style={styles.uploadText}>Subir Foto</Text>
                        </>
                     )}
                  </TouchableOpacity>
               )}
            </View>

            <View style={styles.variantHeader}>
               <Text style={styles.sectionTitle}>Colores, Tallas y Stock</Text>
               <TouchableOpacity style={styles.addColorBtn} onPress={handleAddColorGroup}>
                  <Text style={styles.addColorText}>+ Agregar Color</Text>
               </TouchableOpacity>
            </View>

            {variants.map((variant, colorIdx) => {
               const sizesList = variant.sizes || [];
               return (
                  <View key={variant.id || colorIdx} style={styles.colorCard}>
                     <View style={styles.colorHeader}>
                        <Text style={styles.subLabel}>Color Seleccionado:</Text>
                        <TouchableOpacity style={styles.removeColorBtn} onPress={() => {
                           if (variants.length <= 1) { Alert.alert('Atención', 'Debes mantener al menos un color.'); return; }
                           setVariants(prev => prev.filter((_, i) => i !== colorIdx));
                        }}>
                           <Text style={styles.removeColorText}>Eliminar Color 🗑️</Text>
                        </TouchableOpacity>
                     </View>

                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteRow}>
                        {PRESET_COLORS.map((c) => (
                           <TouchableOpacity
                              key={c.name}
                              style={[
                                 styles.colorBadge, { backgroundColor: c.hex },
                                 variant.color === c.name && styles.colorBadgeActive
                              ]}
                              onPress={() => {
                                 setVariants(prev => {
                                    const updated = [...prev];
                                    updated[colorIdx].color = c.name;
                                    updated[colorIdx].colorHex = c.hex;
                                    return updated;
                                 });
                              }}
                           >
                              {variant.color === c.name && (
                                 <Text style={{ color: ['#ffffff', '#f5f5dc', '#d1d5db', '#d4b895', '#20c997'].includes(c.hex.toLowerCase()) ? '#000' : '#fff', fontWeight: 'bold' }}>✓</Text>
                              )}
                           </TouchableOpacity>
                        ))}
                     </ScrollView>

                     <TextInput
                        style={styles.colorInputCustom} placeholder="O escribe un color (ej. Azul Turquesa)" value={variant.color}
                        onChangeText={(val) => {
                           setVariants(prev => {
                              const updated = [...prev];
                              updated[colorIdx].color = val;
                              return updated;
                           });
                        }}
                     />

                     <Text style={styles.subLabel}>Tallas Disponibles para {variant.color}:</Text>
                     <View style={styles.sizeChipsGrid}>
                        {availableSizes.map((sz) => {
                           const activeSize = sizesList.find(s => s.size === sz);
                           return (
                              <TouchableOpacity key={sz} style={[styles.sizeChip, activeSize && styles.sizeChipActive]} onPress={() => handleToggleSize(colorIdx, sz)}>
                                 <Text style={[styles.sizeChipText, activeSize && styles.sizeChipTextActive]}>{sz}</Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>

                     {sizesList.length > 0 && (
                        <View style={styles.stockInputsContainer}>
                           <Text style={styles.subLabel}>Stock por Talla:</Text>
                           <View style={styles.stockRowGrid}>
                              {sizesList.map((sItem) => (
                                 <View key={sItem.size} style={styles.stockBox}>
                                    <Text style={styles.stockSizeLabel}>{sItem.size}</Text>
                                    <TextInput
                                       style={styles.stockInput} value={String(sItem.stock)} keyboardType="number-pad"
                                       onChangeText={(val) => {
                                          setVariants(prev => {
                                             const updated = [...prev];
                                             updated[colorIdx].sizes = updated[colorIdx].sizes.map(s => s.size === sItem.size ? { ...s, stock: Math.max(0, parseInt(val) || 0) } : s);
                                             return updated;
                                          });
                                       }}
                                    />
                                 </View>
                              ))}
                           </View>
                        </View>
                     )}
                  </View>
               );
            })}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting || uploadingImage}>
               {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{initialProduct ? 'Guardar Cambios' : 'Registrar Prenda'}</Text>}
            </TouchableOpacity>
         </ScrollView>

         {/* MODAL LIGHTBOX */}
         <Modal visible={!!lightboxImage} transparent={true} animationType="fade" onRequestClose={() => setLightboxImage(null)}>
            <View style={styles.lightboxContainer}>
               <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxImage(null)}>
                  <X size={32} color="#ffffff" />
               </TouchableOpacity>
               {lightboxImage && (
                  <Image source={{ uri: lightboxImage }} style={styles.lightboxImageFull} contentFit="contain" />
               )}
            </View>
         </Modal>
      </>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#ffffff' },
   content: { padding: 20 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
   title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
   closeBtn: { padding: 8 },
   sectionTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 16, marginBottom: 12 },
   row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
   flex1: { flex: 1 },
   label: { fontSize: 13, fontWeight: '500', color: '#475569', marginBottom: 6 },
   subLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 10, marginBottom: 6 },
   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 15, color: '#0f172a' },

   horizontalScrollWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginHorizontal: -4 },
   scrollArrow: { padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8, marginHorizontal: 4 },

   chip: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },

   imageGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
   imageCard: { width: 110, height: 110, borderRadius: 12, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#e2e8f0' },
   previewImage: { width: '100%', height: '100%' },
   removeImgBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
   uploadCard: { width: 110, height: 110, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
   uploadIcon: { fontSize: 26 },
   uploadText: { fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: '500' },

   variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   addColorBtn: { paddingVertical: 4 },
   addColorText: { color: '#2563eb', fontSize: 14, fontWeight: 'bold' },
   colorCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginBottom: 16 },
   colorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   removeColorBtn: { padding: 4 },
   removeColorText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
   paletteRow: { flexDirection: 'row', marginVertical: 12 },
   colorBadge: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
   colorBadgeActive: { borderWidth: 3, borderColor: '#2563eb', transform: [{ scale: 1.1 }] },
   colorInputCustom: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 },
   sizeChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
   sizeChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
   sizeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   sizeChipText: { fontSize: 13, color: '#334155', fontWeight: 'bold' },
   sizeChipTextActive: { color: '#ffffff' },
   stockInputsContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
   stockRowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   stockBox: { width: 65, alignItems: 'center' },
   stockSizeLabel: { fontSize: 12, fontWeight: '900', color: '#475569', marginBottom: 4 },
   stockInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, textAlign: 'center', width: '100%', fontSize: 15, fontWeight: 'bold' },
   submitBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, marginBottom: 40, shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
   submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

   lightboxContainer: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center' },
   lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
   lightboxImageFull: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
});

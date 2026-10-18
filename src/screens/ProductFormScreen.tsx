import React, { useState } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   ScrollView,
   Image,
   ActivityIndicator,
   Alert
} from 'react-native';
import { Product, ProductCategory, ProductVariant } from '../types/inventory';
import { deleteImageFromR2, uploadImageToR2 } from '../services/storage';
import { optimizeImage } from '../utils/imageOptimizer';
import { createProduct, updateProduct } from '../services/productService';
import * as ImagePicker from 'expo-image-picker';
import { showConfirm, showAlert } from '../utils/alert';

interface ProductFormProps {
   initialProduct?: Product | null;
   onClose: () => void;
}

interface ImageItem {
   id: string;
   url: string;         // URL pública de R2 o URL local de Blob
   isNew: boolean;      // true si es un archivo local pendiente de subir
   file?: File;         // Archivo File local original
}

const CATEGORIES: ProductCategory[] = [
   'Zapatos', 'Camisas', 'Franelillas', 'Shorts', 'Monos', 'Conjuntos', 'Accesorios', 'Otros'
];

const PRESET_COLORS = [
   { name: 'Negro', hex: '#000000' },
   { name: 'Blanco', hex: '#ffffff' },
   { name: 'Gris', hex: '#6b7280' },
   { name: 'Rojo', hex: '#ef4444' },
   { name: 'Azul Marino', hex: '#1e3a8a' },
   { name: 'Azul Rey', hex: '#2563eb' },
   { name: 'Verde', hex: '#16a34a' },
   { name: 'Amarillo', hex: '#eab308' },
   { name: 'Rosado', hex: '#ec4899' },
   { name: 'Naranja', hex: '#f97316' },
];

const PRESET_SIZES_CLOTHING = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const PRESET_SIZES_SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

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

// Función helper para migrar/normalizar variantes viejas a la estructura nueva
const normalizeVariants = (rawVariants?: any[]): ProductVariant[] => {
   if (!rawVariants || rawVariants.length === 0) {
      return [
         {
            id: `var_${Date.now()}`,
            color: 'Negro',
            colorHex: '#000000',
            sizes: [{ size: 'M', stock: 1 }],
            locations: [],
            exhibition: { isOnDisplay: false }
         }
      ];
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

      // Compatibilidad con registros antiguos de la versión previa
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

export const ProductFormScreen: React.FC<ProductFormProps> = ({ initialProduct, onClose }) => {
   const [code, setCode] = useState(initialProduct?.code || '');
   const [name, setName] = useState(initialProduct?.name || '');
   const [brand, setBrand] = useState(initialProduct?.brand || '');
   const [category, setCategory] = useState<ProductCategory>(initialProduct?.category || 'Camisas');
   const [price, setPrice] = useState(initialProduct?.price ? String(initialProduct.price) : '');
   const [uploadingImage, setUploadingImage] = useState(false);
   const [submitting, setSubmitting] = useState(false);

   // Estado unificado de imágenes
   const [imageItems, setImageItems] = useState<ImageItem[]>(
      (initialProduct?.images || []).map((url, idx) => ({
         id: `existing_${idx}`,
         url,
         isNew: false,
      }))
   );

   // Variantes con normalización segura
   const [variants, setVariants] = useState<ProductVariant[]>(
      normalizeVariants(initialProduct?.variants)
   );

   const handleSelectImage = async () => {
      if (imageItems.length >= 2) {
         showAlert('Límite alcanzado', 'Solo puedes incluir hasta 2 imágenes por prenda.');
         return;
      }

      try {
         // Selector de imágenes multiplataforma de Expo (Web, iOS y Android)
         const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
         });

         if (result.canceled || !result.assets || result.assets.length === 0) {
            return;
         }

         const selectedAsset = result.assets[0];

         // Convertir el URI de la imagen seleccionada a un Blob/File compatible con optimizeImage
         const response = await fetch(selectedAsset.uri);
         const blob = await response.blob();
         const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg'
         });

         setImageItems((prev) => [
            ...prev,
            {
               id: `new_${Date.now()}`,
               url: selectedAsset.uri, // Vista previa local (blob: o file://)
               isNew: true,
               file,
            },
         ]);
      } catch (error: any) {
         console.error('Error al seleccionar imagen:', error);
         showAlert('Error', 'No se pudo abrir la galería de imágenes del dispositivo.');
      }
   };

   const handleRemoveImage = (itemToRemove: ImageItem) => {
      if (itemToRemove.isNew) {
         // Si es una vista previa local, la descartamos sin tocar la red
         URL.revokeObjectURL(itemToRemove.url);
         setImageItems(prev => prev.filter(item => item.id !== itemToRemove.id));
         return;
      }

      // Confirmación interactiva compatible con Web (window.confirm)
      showConfirm(
         '🚨 Confirmación de Seguridad',
         'Esta imagen ya está alojada en la nube. ¿Estás seguro de eliminarla permanentemente del servidor R2?',
         async () => {
            try {
               await deleteImageFromR2(itemToRemove.url);
               setImageItems(prev => prev.filter(item => item.id !== itemToRemove.id));
               showAlert('Eliminado', 'La imagen fue borrada de Cloudflare R2 con éxito.');
            } catch (error: any) {
               showAlert('Error', error.message || 'No se pudo eliminar la imagen de R2.');
            }
         }
      );
   };

   const handleAddColorGroup = () => {
      setVariants(prev => [
         ...prev,
         {
            id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            color: 'Negro',
            colorHex: '#000000',
            sizes: [{ size: 'M', stock: 1 }],
            locations: [],
            exhibition: { isOnDisplay: false }
         }
      ]);
   };

   const handleRemoveColorGroup = (index: number) => {
      if (variants.length <= 1) {
         Alert.alert('Atención', 'Debes mantener al menos un color.');
         return;
      }
      setVariants(prev => prev.filter((_, i) => i !== index));
   };

   const handleToggleSize = (colorIdx: number, sizeName: string) => {
      setVariants(prev => {
         const updated = [...prev];
         const currentSizes = updated[colorIdx].sizes || [];
         const exists = currentSizes.find(s => s.size === sizeName);

         if (exists) {
            updated[colorIdx].sizes = currentSizes.filter(s => s.size !== sizeName);
         } else {
            updated[colorIdx].sizes = [...currentSizes, { size: sizeName, stock: 1 }];
         }
         return updated;
      });
   };

   const handleUpdateStock = (colorIdx: number, sizeName: string, newStock: number) => {
      setVariants(prev => {
         const updated = [...prev];
         const currentSizes = updated[colorIdx].sizes || [];
         updated[colorIdx].sizes = currentSizes.map(s =>
            s.size === sizeName ? { ...s, stock: Math.max(0, newStock) } : s
         );
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

         // Procesar imágenes: conservar existentes y subir únicamente las nuevas comprimidas a AVIF
         const finalImageUrls: string[] = [];

         for (const item of imageItems) {
            if (!item.isNew) {
               finalImageUrls.push(item.url);
            } else if (item.file) {
               const avifBlob = await optimizeImage(item.file, 900, 0.65);
               const uploadedUrl = await uploadImageToR2(avifBlob);
               finalImageUrls.push(uploadedUrl);
            }
         }

         const productPayload: Omit<Product, 'id'> = {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            brand: brand.trim(),
            category,
            price: parsedPrice,
            images: finalImageUrls,
            variants,
         };

         if (initialProduct?.id) {
            await updateProduct(initialProduct.id, productPayload);
         } else {
            await createProduct(productPayload);
         }

         onClose();
      } catch (error: any) {
         Alert.alert('Error al guardar', error.message || 'No se pudo completar el registro.');
      } finally {
         setSubmitting(false);
      }
   };

   const availableSizes = category === 'Zapatos' ? PRESET_SIZES_SHOES : PRESET_SIZES_CLOTHING;

   return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
         <View style={styles.header}>
            <View>
               <View style={styles.accentLine} />
               <Text style={styles.title}>
                  {initialProduct ? 'Editar Prenda' : 'Nueva Prenda'}
               </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
               <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
         </View>

         <View style={styles.row}>
            <View style={styles.flex1}>
               <Text style={styles.label}>Código / SKU *</Text>
               <TextInput
                  style={styles.input}
                  placeholder="NK-DFT-01"
                  placeholderTextColor={C.dim}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
               />
            </View>

            <View style={styles.flex1}>
               <Text style={styles.label}>Precio ($) *</Text>
               <TextInput
                  style={styles.input}
                  placeholder="25.00"
                  placeholderTextColor={C.dim}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
               />
            </View>
         </View>

         <Text style={styles.label}>Nombre de la prenda *</Text>
         <TextInput
            style={styles.input}
            placeholder="Franelilla Running Dri-FIT"
            placeholderTextColor={C.dim}
            value={name}
            onChangeText={setName}
         />

         <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.flex1}>
               <Text style={styles.label}>Marca *</Text>
               <TextInput
                  style={styles.input}
                  placeholder="Nike, Under Armour, UQ"
                  placeholderTextColor={C.dim}
                  value={brand}
                  onChangeText={setBrand}
               />
            </View>

            <View style={styles.flex1}>
               <Text style={styles.label}>Categoría *</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {CATEGORIES.map((cat) => (
                     <TouchableOpacity
                        key={cat}
                        style={[styles.chip, category === cat && styles.chipActive]}
                        onPress={() => setCategory(cat)}
                     >
                        <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                     </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>
         </View>

         {/* Grid de Imágenes conectado directamente a imageItems */}
         <Text style={styles.sectionTitle}>Imágenes de la Prenda (Máx. 2)</Text>
         <View style={styles.imageGrid}>
            {imageItems.map((item) => (
               <View key={item.id} style={styles.imageCard}>
                  <Image source={{ uri: item.url }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => handleRemoveImage(item)}>
                     <Text style={styles.removeImgText}>✕</Text>
                  </TouchableOpacity>
               </View>
            ))}

            {imageItems.length < 2 && (
               <TouchableOpacity
                  style={styles.uploadCard}
                  onPress={handleSelectImage}
                  disabled={uploadingImage}
               >
                  {uploadingImage ? (
                     <ActivityIndicator color={C.light} />
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
                     <TouchableOpacity
                        style={styles.removeColorBtn}
                        onPress={() => handleRemoveColorGroup(colorIdx)}
                     >
                        <Text style={styles.removeColorText}>Eliminar Color 🗑️</Text>
                     </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteRow}>
                     {PRESET_COLORS.map((c) => (
                        <TouchableOpacity
                           key={c.name}
                           style={[
                              styles.colorBadge,
                              { backgroundColor: c.hex },
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
                              <Text style={{ color: c.hex === '#ffffff' ? '#000' : '#fff', fontWeight: 'bold' }}>✓</Text>
                           )}
                        </TouchableOpacity>
                     ))}
                  </ScrollView>

                  <TextInput
                     style={styles.colorInputCustom}
                     placeholder="O escribe un color personalizado (ej. Azul Turquesa)"
                     placeholderTextColor={C.dim}
                     value={variant.color}
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
                           <TouchableOpacity
                              key={sz}
                              style={[styles.sizeChip, activeSize && styles.sizeChipActive]}
                              onPress={() => handleToggleSize(colorIdx, sz)}
                           >
                              <Text style={[styles.sizeChipText, activeSize && styles.sizeChipTextActive]}>
                                 {sz}
                              </Text>
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
                                    style={styles.stockInput}
                                    value={String(sItem.stock)}
                                    onChangeText={(val) => handleUpdateStock(colorIdx, sItem.size, parseInt(val) || 0)}
                                    keyboardType="number-pad"
                                 />
                              </View>
                           ))}
                        </View>
                     </View>
                  )}
               </View>
            );
         })}

         <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting || uploadingImage}
         >
            {submitting ? (
               <ActivityIndicator color={C.bg} />
            ) : (
               <Text style={styles.submitBtnText}>
                  {initialProduct ? 'Guardar Cambios' : 'Registrar Prenda'}
               </Text>
            )}
         </TouchableOpacity>
      </ScrollView>
   );
};

// Bases compartidas (evitan repetir estilos)
const inputBase = {
   backgroundColor: C.raised,
   borderWidth: 1,
   borderColor: C.line,
   borderRadius: 2,
   color: C.white,
};
const chipBase = {
   backgroundColor: C.raised,
   borderWidth: 1,
   borderColor: C.line,
   borderRadius: 2,
};
const activeBox = { backgroundColor: C.light, borderColor: C.light };
const activeText = { color: C.bg, fontWeight: '900' as const };
const caps = { textTransform: 'uppercase' as const, letterSpacing: 2 };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: C.bg },
   content: { padding: 20, paddingTop: 40 },

   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
   accentLine: { width: 48, height: 4, backgroundColor: C.mute, marginBottom: 14 },
   title: { ...caps, fontSize: 22, fontWeight: '900', color: C.white },
   closeBtn: { padding: 8, borderWidth: 1, borderColor: '#3A3A3A', borderRadius: 2, paddingHorizontal: 12 },
   closeBtnText: { fontSize: 16, color: C.soft },

   sectionTitle: { ...caps, fontSize: 12, fontWeight: 'bold', color: C.mute, marginTop: 20, marginBottom: 12 },
   row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
   flex1: { flex: 1 },
   label: { ...caps, fontSize: 10, fontWeight: '700', color: C.mute, marginBottom: 6 },
   subLabel: { fontSize: 11, fontWeight: '600', color: C.mute, marginTop: 10, marginBottom: 6 },
   input: { ...inputBase, padding: 12, fontSize: 15 },

   chipRow: { flexDirection: 'row', marginTop: 4 },
   chip: { ...chipBase, paddingVertical: 7, paddingHorizontal: 12, marginRight: 6 },
   chipActive: activeBox,
   chipText: { fontSize: 12, color: C.soft },
   chipTextActive: activeText,

   imageGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
   imageCard: { width: 100, height: 100, borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: C.line, position: 'relative' },
   previewImage: { width: '100%', height: '100%' },
   removeImgBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.75)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
   removeImgText: { color: C.white, fontSize: 12 },
   uploadCard: { width: 100, height: 100, borderRadius: 2, borderWidth: 1, borderColor: '#3A3A3A', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: C.raised },
   uploadIcon: { fontSize: 22 },
   uploadText: { ...caps, fontSize: 9, color: C.mute, marginTop: 4 },

   variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   addColorBtn: { paddingVertical: 4 },
   addColorText: { ...caps, color: C.light, fontSize: 11, fontWeight: '800' },

   colorCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14, marginBottom: 14 },
   colorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   removeColorBtn: { padding: 4 },
   removeColorText: { fontSize: 12, color: C.mute, fontWeight: '600' },
   paletteRow: { flexDirection: 'row', marginVertical: 8 },
   colorBadge: { width: 32, height: 32, borderRadius: 16, marginRight: 10, borderWidth: 1, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
   colorBadgeActive: { borderWidth: 3, borderColor: C.light },
   colorInputCustom: { ...inputBase, padding: 10, fontSize: 13, marginBottom: 10 },

   sizeChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
   sizeChip: { ...chipBase, paddingVertical: 8, paddingHorizontal: 14 },
   sizeChipActive: activeBox,
   sizeChipText: { fontSize: 13, color: C.soft, fontWeight: '600' },
   sizeChipTextActive: activeText,

   stockInputsContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
   stockRowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
   stockBox: { width: 60, alignItems: 'center' },
   stockSizeLabel: { fontSize: 11, fontWeight: 'bold', color: C.soft, marginBottom: 2 },
   stockInput: { ...inputBase, padding: 6, textAlign: 'center', width: '100%', fontSize: 14 },

   submitBtn: { backgroundColor: C.light, padding: 16, borderRadius: 2, alignItems: 'center', marginTop: 20, marginBottom: 40 },
   submitBtnText: { ...caps, color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 3 },
});
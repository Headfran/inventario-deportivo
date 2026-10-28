import React, { useState, useRef, useMemo } from 'react';
import {
   View,
   Text,
   TextInput,
   ScrollView,
   Pressable,
   StyleSheet,
   Modal,
   ActivityIndicator,
   useWindowDimensions,
   Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
   X, Plus, Trash2, Check, ChevronLeft, ChevronRight,
   AlertCircle, DollarSign, Package, Sparkles, Receipt,
} from 'lucide-react-native';
import { Product, ProductCategory, ProductVariant } from '../types/inventory';
import { createProduct, updateProduct } from '../services/productService';
import { uploadImageToR2, deleteImageFromR2 } from '../services/storage';
import { optimizeImage } from '../utils/imageOptimizer';
import { showConfirm, showAlert } from '../utils/alert';
import { MONO as T, display } from '../design';

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

interface FormErrors {
   code?: string;
   name?: string;
   brand?: string;
   price?: string;
   wholesalePrice?: string;
   variants?: string;
}

const CATEGORIES: ProductCategory[] = [
   'Camisas', 'Camisas AAA', 'Franelillas', 'Franelillas AAA',
   'Chemises', 'Sudaderas', 'Chaquetas', 'Shorts', 'Monos',
   'Conjuntos', 'Zapatos', 'Accesorios', 'Otros',
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
         exhibition: { isOnDisplay: false },
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
            exhibition: v.exhibition || { isOnDisplay: false },
         };
      }
      return {
         id: v.id || `var_${Date.now()}_${idx}`,
         color: v.color || 'Negro',
         colorHex: v.colorHex || '#000000',
         sizes: v.size ? [{ size: v.size, stock: Number(v.stock) || 0 }] : [],
         locations: v.locations || [],
         exhibition: v.exhibition || { isOnDisplay: false },
      };
   });
};

export const ProductFormScreen: React.FC<ProductFormProps> = ({
   initialProduct,
   availableBrands = [],
   onClose,
}) => {
   const { width } = useWindowDimensions();
   const isMobile = width < 600;

   // ---- Estado del formulario ----
   const [code, setCode] = useState(initialProduct?.code || '');
   const [name, setName] = useState(initialProduct?.name || '');
   const [price, setPrice] = useState(initialProduct?.price ? String(initialProduct.price) : '');
   const [wholesalePrice, setWholesalePrice] = useState(
      initialProduct?.wholesalePrice ? String(initialProduct.wholesalePrice) : ''
   );

   const defaultBrands = ['Nike', 'Under Armour', 'Adidas', 'Puma', 'On', 'Alo', 'Ovejita', 'Columbia'];
   const mergedBrands = useMemo(
      () => Array.from(new Set([...defaultBrands, ...availableBrands])).slice(0, 15),
      [availableBrands]
   );
   const isInitialBrandCustom = initialProduct?.brand && !mergedBrands.includes(initialProduct.brand);
   const [brand, setBrand] = useState(initialProduct?.brand || '');
   const [isCustomBrand, setIsCustomBrand] = useState<boolean>(!!isInitialBrandCustom);

   const [category, setCategory] = useState<ProductCategory>(initialProduct?.category || 'Camisas');

   const [imageItems, setImageItems] = useState<ImageItem[]>(
      (initialProduct?.images || []).map((url, idx) => ({ id: `existing_${idx}`, url, isNew: false }))
   );
   const [variants, setVariants] = useState<ProductVariant[]>(normalizeVariants(initialProduct?.variants));

   const [lightboxImage, setLightboxImage] = useState<string | null>(null);

   // ---- Estado de guardado ----
   const [submitting, setSubmitting] = useState(false);
   const [saveStage, setSaveStage] = useState<string>('');
   const [errors, setErrors] = useState<FormErrors>({});

   // ---- Refs para scrolls ----
   const formScrollRef = useRef<ScrollView>(null);
   const brandScrollRef = useRef<ScrollView>(null);
   const categoryScrollRef = useRef<ScrollView>(null);
   const [brandScrollX, setBrandScrollX] = useState(0);
   const [categoryScrollX, setCategoryScrollX] = useState(0);

   const handleScroll = (
      ref: React.RefObject<ScrollView | null>,
      currentX: number,
      dir: 'left' | 'right'
   ) => {
      const step = 200;
      const newX = dir === 'left' ? Math.max(0, currentX - step) : currentX + step;
      ref.current?.scrollTo({ x: newX, animated: true });
   };

   // ==========================================
   // Imágenes
   // ==========================================
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

         setImageItems((prev) => [
            ...prev,
            { id: `new_${Date.now()}`, url: result.assets[0].uri, isNew: true },
         ]);
      } catch {
         showAlert('Error', 'No se pudo abrir la galería.');
      }
   };

   const handleRemoveImage = (itemToRemove: ImageItem) => {
      if (itemToRemove.isNew) {
         setImageItems((prev) => prev.filter((item) => item.id !== itemToRemove.id));
         return;
      }
      showConfirm(
         '🚨 Confirmación',
         'Esta imagen ya está alojada en la nube. ¿Deseas eliminarla permanentemente?',
         async () => {
            try {
               await deleteImageFromR2(itemToRemove.url);
               setImageItems((prev) => prev.filter((item) => item.id !== itemToRemove.id));
               showAlert('Eliminado', 'La imagen fue borrada con éxito.');
            } catch {
               showAlert('Error', 'No se pudo eliminar la imagen.');
            }
         }
      );
   };

   // ==========================================
   // Variantes
   // ==========================================
   const handleAddColorGroup = () => {
      setVariants((prev) => [
         ...prev,
         {
            id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            color: 'Blanco',
            colorHex: '#ffffff',
            sizes: [{ size: 'M', stock: 1 }],
            locations: [],
            exhibition: { isOnDisplay: false },
         },
      ]);
   };

   const handleRemoveColorGroup = (colorIdx: number) => {
      if (variants.length <= 1) {
         showAlert('Atención', 'Debes mantener al menos un color.');
         return;
      }
      setVariants((prev) => prev.filter((_, i) => i !== colorIdx));
   };

   const handleToggleSize = (colorIdx: number, sizeName: string) => {
      setVariants((prev) => {
         const updated = [...prev];
         const currentSizes = updated[colorIdx].sizes || [];
         const exists = currentSizes.find((s) => s.size === sizeName);
         if (exists) {
            updated[colorIdx].sizes = currentSizes.filter((s) => s.size !== sizeName);
         } else {
            updated[colorIdx].sizes = [...currentSizes, { size: sizeName, stock: 1 }];
         }
         return updated;
      });
   };

   const handleUpdateStock = (colorIdx: number, sizeName: string, val: string) => {
      setVariants((prev) => {
         const updated = [...prev];
         updated[colorIdx].sizes = updated[colorIdx].sizes.map((s) =>
            s.size === sizeName ? { ...s, stock: Math.max(0, parseInt(val) || 0) } : s
         );
         return updated;
      });
   };

   const handleUpdateColorName = (colorIdx: number, val: string) => {
      setVariants((prev) => {
         const updated = [...prev];
         updated[colorIdx].color = val;
         return updated;
      });
   };

   const handleSetColorHex = (colorIdx: number, name: string, hex: string) => {
      setVariants((prev) => {
         const updated = [...prev];
         updated[colorIdx].color = name;
         updated[colorIdx].colorHex = hex;
         return updated;
      });
   };

   // ==========================================
   // Validación
   // ==========================================
   const validate = (): FormErrors => {
      const errs: FormErrors = {};

      if (!code.trim()) errs.code = 'El código es obligatorio';
      if (!name.trim()) errs.name = 'El nombre es obligatorio';
      if (!brand.trim()) errs.brand = 'La marca es obligatoria';

      if (!price.trim()) {
         errs.price = 'El precio detal es obligatorio';
      } else {
         const p = parseFloat(price);
         if (isNaN(p) || p <= 0) errs.price = 'Debe ser un número mayor a 0';
      }

      if (wholesalePrice.trim()) {
         const w = parseFloat(wholesalePrice);
         if (isNaN(w) || w <= 0) {
            errs.wholesalePrice = 'Debe ser un número mayor a 0';
         } else {
            const p = parseFloat(price) || 0;
            if (p > 0 && w > p) errs.wholesalePrice = 'Debe ser ≤ al precio detal';
         }
      }

      const hasValidVariant = variants.some((v) => v.sizes && v.sizes.length > 0);
      if (!hasValidVariant) errs.variants = 'Añade al menos una talla a un color';

      return errs;
   };

   const clearError = (field: keyof FormErrors) => {
      if (errors[field]) {
         setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
         });
      }
   };

   // ==========================================
   // Guardado con etapas
   // ==========================================
   const handleSubmit = async () => {
      const errs = validate();
      setErrors(errs);

      if (Object.keys(errs).length > 0) {
         showAlert('Faltan datos', 'Revisa los campos marcados en rojo.');
         formScrollRef.current?.scrollTo({ y: 0, animated: true });
         return;
      }

      try {
         setSubmitting(true);
         setSaveStage('Optimizando datos...');

         const finalImageUrls: string[] = [];
         const totalImages = imageItems.length;
         let uploadedCount = 0;

         for (const item of imageItems) {
            if (!item.isNew) {
               finalImageUrls.push(item.url);
            } else {
               uploadedCount += 1;
               setSaveStage(`Subiendo imagen ${uploadedCount} de ${totalImages}...`);
               const webpBlob = await optimizeImage(item.url, 800, 0.65);
               const uploadedUrl = await uploadImageToR2(webpBlob);
               finalImageUrls.push(uploadedUrl);
            }
         }

         setSaveStage('Guardando en el sistema...');

         const parsedPrice = parseFloat(price);
         const parsedWholesale = wholesalePrice.trim() ? parseFloat(wholesalePrice) : undefined;

         const productPayload: Omit<Product, 'id'> = {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            brand: brand.trim(),
            category,
            price: parsedPrice,
            ...(parsedWholesale !== undefined && { wholesalePrice: parsedWholesale }),
            images: finalImageUrls,
            variants,
         };

         if (initialProduct?.id) {
            await updateProduct(initialProduct.id, productPayload);
         } else {
            await createProduct(productPayload);
         }

         setSaveStage('Finalizando...');
         await new Promise((r) => setTimeout(r, 400));

         onClose();
      } catch (error: any) {
         showAlert('Error', error.message || 'No se pudo completar el registro.');
      } finally {
         setSubmitting(false);
         setSaveStage('');
      }
   };

   const availableSizes = category === 'Zapatos' ? PRESET_SIZES_SHOES : PRESET_SIZES_CLOTHING;

   // ==========================================
   // Render
   // ==========================================
   return (
      <View style={styles.container}>
         <View style={styles.header}>
            <Text style={styles.headerTitle}>
               {initialProduct ? 'EDITAR PRENDA' : 'NUEVA PRENDA'}
            </Text>
            <Pressable
               style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
               onPress={onClose}
            >
               <X size={20} color={T.ink} />
            </Pressable>
         </View>

         <ScrollView
            ref={formScrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
         >
            {/* CÓDIGO + NOMBRE */}
            <View style={[styles.row, isMobile && styles.rowMobile]}>
               <View style={[styles.inputGroup, !isMobile && { flex: 1 }]}>
                  <Text style={styles.label}>CÓDIGO / SKU *</Text>
                  <TextInput
                     style={[styles.input, errors.code && styles.inputError]}
                     placeholder="Ej: 9619"
                     placeholderTextColor={T.inkMute}
                     value={code}
                     onChangeText={(v) => { setCode(v); clearError('code'); }}
                     autoCapitalize="characters"
                  />
                  {errors.code && <Text style={styles.errorText}>{errors.code}</Text>}
               </View>

               <View style={[styles.inputGroup, !isMobile && { flex: 2 }]}>
                  <Text style={styles.label}>NOMBRE DE LA PRENDA *</Text>
                  <TextInput
                     style={[styles.input, errors.name && styles.inputError]}
                     placeholder="Ej: Short UnderArmour"
                     placeholderTextColor={T.inkMute}
                     value={name}
                     onChangeText={(v) => { setName(v); clearError('name'); }}
                  />
                  {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
               </View>
            </View>

            {/* PRECIOS (DETAL + MAYOR) */}
            <View style={[styles.row, isMobile && styles.rowMobile]}>
               <View style={[styles.inputGroup, !isMobile && { flex: 1 }]}>
                  <View style={styles.priceLabelRow}>
                     <Receipt size={12} color={T.inkMute} />
                     <Text style={styles.label}>PRECIO DETAL ($) *</Text>
                  </View>
                  <TextInput
                     style={[styles.input, errors.price && styles.inputError]}
                     placeholder="0.00"
                     placeholderTextColor={T.inkMute}
                     keyboardType="numeric"
                     value={price}
                     onChangeText={(v) => { setPrice(v); clearError('price'); }}
                  />
                  {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
               </View>

               <View style={[styles.inputGroup, !isMobile && { flex: 1 }]}>
                  <View style={styles.priceLabelRow}>
                     <Package size={12} color="#10B981" />
                     <Text style={[styles.label, { color: '#059669' }]}>PRECIO MAYOR ($)</Text>
                     <View style={styles.wholesaleBadge}>
                        <Text style={styles.wholesaleBadgeText}>12+ uds</Text>
                     </View>
                  </View>
                  <TextInput
                     style={[
                        styles.input,
                        styles.inputWholesale,
                        errors.wholesalePrice && styles.inputError,
                     ]}
                     placeholder="0.00"
                     placeholderTextColor="#A7F3D0"
                     keyboardType="numeric"
                     value={wholesalePrice}
                     onChangeText={(v) => { setWholesalePrice(v); clearError('wholesalePrice'); }}
                  />
                  {errors.wholesalePrice && <Text style={styles.errorText}>{errors.wholesalePrice}</Text>}
               </View>
            </View>

            {/* MARCA */}
            <View style={styles.inputGroup}>
               <Text style={styles.label}>MARCA *</Text>
               <View style={styles.scrollRow}>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                     onPress={() => handleScroll(brandScrollRef, brandScrollX, 'left')}
                  >
                     <ChevronLeft size={18} color={T.inkSoft} />
                  </Pressable>
                  <ScrollView
                     ref={brandScrollRef}
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     style={{ flex: 1 }}
                     contentContainerStyle={{ gap: 6 }}
                     onScroll={(e) => setBrandScrollX(e.nativeEvent.contentOffset.x)}
                     scrollEventThrottle={16}
                  >
                     {mergedBrands.map((b) => {
                        const isActive = brand === b && !isCustomBrand;
                        return (
                           <Pressable
                              key={b}
                              style={[styles.chip, isActive && styles.chipActive]}
                              onPress={() => { setBrand(b); setIsCustomBrand(false); clearError('brand'); }}
                           >
                              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{b}</Text>
                           </Pressable>
                        );
                     })}
                     <Pressable
                        style={[styles.chip, isCustomBrand && styles.chipActive]}
                        onPress={() => { setBrand(''); setIsCustomBrand(true); }}
                     >
                        <Text style={[styles.chipText, isCustomBrand && styles.chipTextActive]}>Otra...</Text>
                     </Pressable>
                  </ScrollView>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                     onPress={() => handleScroll(brandScrollRef, brandScrollX, 'right')}
                  >
                     <ChevronRight size={18} color={T.inkSoft} />
                  </Pressable>
               </View>
               {isCustomBrand && (
                  <TextInput
                     style={[styles.input, { marginTop: 8 }, errors.brand && styles.inputError]}
                     placeholder="Escribe la marca..."
                     placeholderTextColor={T.inkMute}
                     value={brand}
                     onChangeText={(v) => { setBrand(v); clearError('brand'); }}
                  />
               )}
               {errors.brand && <Text style={styles.errorText}>{errors.brand}</Text>}
            </View>

            {/* CATEGORÍA */}
            <View style={styles.inputGroup}>
               <Text style={styles.label}>CATEGORÍA *</Text>
               <View style={styles.scrollRow}>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                     onPress={() => handleScroll(categoryScrollRef, categoryScrollX, 'left')}
                  >
                     <ChevronLeft size={18} color={T.inkSoft} />
                  </Pressable>
                  <ScrollView
                     ref={categoryScrollRef}
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     style={{ flex: 1 }}
                     contentContainerStyle={{ gap: 6 }}
                     onScroll={(e) => setCategoryScrollX(e.nativeEvent.contentOffset.x)}
                     scrollEventThrottle={16}
                  >
                     {CATEGORIES.map((cat) => {
                        const active = category === cat;
                        return (
                           <Pressable
                              key={cat}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => setCategory(cat)}
                           >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                           </Pressable>
                        );
                     })}
                  </ScrollView>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                     onPress={() => handleScroll(categoryScrollRef, categoryScrollX, 'right')}
                  >
                     <ChevronRight size={18} color={T.inkSoft} />
                  </Pressable>
               </View>
            </View>

            {/* IMÁGENES */}
            <View style={styles.inputGroup}>
               <Text style={styles.label}>IMÁGENES (MÁX. 2)</Text>
               <View style={styles.imageRow}>
                  {imageItems.map((item) => (
                     <View key={item.id} style={styles.imagePreviewBox}>
                        <Image source={{ uri: item.url }} style={styles.previewImg} contentFit="cover" />
                        <Pressable
                           style={StyleSheet.absoluteFill}
                           onPress={() => setLightboxImage(item.url)}
                        />
                        <Pressable style={styles.removeImgBtn} onPress={() => handleRemoveImage(item)}>
                           <X size={12} color="#FFFFFF" />
                        </Pressable>
                        {item.isNew && (
                           <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>NUEVA</Text>
                           </View>
                        )}
                     </View>
                  ))}
                  {imageItems.length < 2 && (
                     <Pressable
                        style={({ pressed }) => [styles.addImgBox, pressed && styles.pressed]}
                        onPress={handleSelectImage}
                     >
                        <Plus size={20} color={T.inkMute} />
                        <Text style={styles.addImgText}>Subir foto</Text>
                     </Pressable>
                  )}
               </View>
            </View>

            {/* COLORES, TALLAS Y STOCK */}
            <View style={styles.sectionContainer}>
               <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>COLORES, TALLAS Y STOCK</Text>
                  <Pressable
                     style={({ pressed }) => [styles.addSmallBtn, pressed && styles.pressed]}
                     onPress={handleAddColorGroup}
                  >
                     <Plus size={14} color={T.onSolid} />
                     <Text style={styles.addSmallBtnText}>Agregar color</Text>
                  </Pressable>
               </View>

               {errors.variants && (
                  <View style={styles.errorBanner}>
                     <AlertCircle size={14} color="#B91C1C" />
                     <Text style={styles.errorBannerText}>{errors.variants}</Text>
                  </View>
               )}

               {variants.map((variant, colorIdx) => {
                  const sizesList = variant.sizes || [];
                  return (
                     <View key={variant.id || colorIdx} style={styles.colorCard}>
                        <View style={styles.colorHeader}>
                           <Text style={styles.colorHeaderTitle}>
                              Color #{colorIdx + 1}:{' '}
                              <Text style={{ color: T.ink }}>{variant.color || 'Sin nombre'}</Text>
                           </Text>
                           <Pressable
                              style={styles.removeColorBtn}
                              onPress={() => handleRemoveColorGroup(colorIdx)}
                           >
                              <Trash2 size={13} color="#EF4444" />
                              <Text style={styles.removeColorText}>Eliminar</Text>
                           </Pressable>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                           {PRESET_COLORS.map((c) => {
                              const isActive = variant.color === c.name;
                              const checkColor = ['#ffffff', '#d1d5db', '#d4b895', '#20c997', '#eab308']
                                 .includes(c.hex.toLowerCase())
                                 ? '#000'
                                 : '#fff';
                              return (
                                 <Pressable
                                    key={c.name}
                                    style={[
                                       styles.colorBadge,
                                       { backgroundColor: c.hex },
                                       isActive && styles.colorBadgeActive,
                                    ]}
                                    onPress={() => handleSetColorHex(colorIdx, c.name, c.hex)}
                                 >
                                    {isActive && <Check size={14} color={checkColor} />}
                                 </Pressable>
                              );
                           })}
                        </ScrollView>

                        <TextInput
                           style={styles.colorInputCustom}
                           placeholder="O escribe un color (ej. Azul Turquesa)"
                           placeholderTextColor={T.inkMute}
                           value={variant.color}
                           onChangeText={(v) => handleUpdateColorName(colorIdx, v)}
                        />

                        <Text style={styles.subLabel}>Tallas disponibles:</Text>
                        <View style={styles.sizeChipsGrid}>
                           {availableSizes.map((sz) => {
                              const active = sizesList.find((s) => s.size === sz);
                              return (
                                 <Pressable
                                    key={sz}
                                    style={[styles.sizeChip, active && styles.sizeChipActive]}
                                    onPress={() => handleToggleSize(colorIdx, sz)}
                                 >
                                    <Text style={[styles.sizeChipText, active && styles.sizeChipTextActive]}>{sz}</Text>
                                 </Pressable>
                              );
                           })}
                        </View>

                        {sizesList.length > 0 && (
                           <View style={styles.stockGrid}>
                              <Text style={styles.subLabel}>Stock por talla:</Text>
                              <View style={styles.stockRow}>
                                 {sizesList.map((s) => (
                                    <View key={s.size} style={styles.stockBox}>
                                       <Text style={styles.stockSizeLabel}>{s.size}</Text>
                                       <TextInput
                                          style={styles.stockInput}
                                          value={String(s.stock)}
                                          keyboardType="number-pad"
                                          onChangeText={(v) => handleUpdateStock(colorIdx, s.size, v)}
                                       />
                                    </View>
                                 ))}
                              </View>
                           </View>
                        )}
                     </View>
                  );
               })}
            </View>

            {/* BOTÓN GUARDAR */}
            <Pressable
               style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && !submitting && styles.pressed,
                  submitting && { opacity: 0.7 },
               ]}
               onPress={handleSubmit}
               disabled={submitting}
            >
               {submitting ? (
                  <ActivityIndicator color={T.onSolid} />
               ) : (
                  <>
                     <Check size={16} color={T.onSolid} />
                     <Text style={styles.saveBtnText}>
                        {initialProduct ? 'Guardar Cambios' : 'Registrar Prenda'}
                     </Text>
                  </>
               )}
            </Pressable>
         </ScrollView>

         {/* LIGHTBOX */}
         <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
            <View style={styles.lightboxOverlay}>
               <Pressable style={styles.lightboxClose} onPress={() => setLightboxImage(null)}>
                  <X size={28} color="#FFFFFF" />
               </Pressable>
               {lightboxImage && (
                  <Image
                     source={{ uri: lightboxImage }}
                     style={styles.lightboxImage}
                     contentFit="contain"
                  />
               )}
            </View>
         </Modal>

         {/* OVERLAY DE PROGRESO DE GUARDADO */}
         <Modal visible={submitting} transparent animationType="fade">
            <View style={styles.savingOverlay}>
               <View style={styles.savingCard}>
                  <ActivityIndicator size="large" color={T.ink} />
                  <Text style={styles.savingTitle}>Guardando prenda</Text>
                  <Text style={styles.savingStage}>{saveStage || 'Preparando...'}</Text>
               </View>
            </View>
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.surface,
   },
   headerTitle: { ...display, fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: 0.5, textTransform: 'uppercase' },
   closeBtn: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: T.line,
   },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   scrollContent: {
      padding: 16, gap: 14, paddingBottom: 40,
      maxWidth: 900, width: '100%', alignSelf: 'center',
   },
   row: { flexDirection: 'row', gap: 10 },
   rowMobile: { flexDirection: 'column', gap: 12 },

   inputGroup: { gap: 4 },
   label: {
      fontSize: 10, fontWeight: '700', color: T.inkMute,
      letterSpacing: 0.5, textTransform: 'uppercase',
   },
   input: {
      height: 44,
      minHeight: 44,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 0,
      fontSize: 14,
      color: T.ink,
      backgroundColor: T.surface,
      textAlignVertical: 'center',
   },
   inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
   inputWholesale: {
      backgroundColor: '#ECFDF5', borderColor: '#10B981', color: '#047857',
   },
   errorText: { fontSize: 11, color: '#DC2626', fontWeight: '600', marginTop: 2 },
   errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      padding: 8, backgroundColor: '#FEF2F2', borderRadius: 6,
      borderWidth: 1, borderColor: '#FECACA',
   },
   errorBannerText: { fontSize: 12, color: '#B91C1C', fontWeight: '600' },

   priceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   wholesaleBadge: {
      marginLeft: 4, paddingHorizontal: 5, paddingVertical: 1,
      backgroundColor: '#10B981', borderRadius: 4,
   },
   wholesaleBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

   scrollRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
   scrollArrow: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: T.line, backgroundColor: T.surface,
   },
   chip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      borderWidth: 1, borderColor: T.line, backgroundColor: T.surface,
   },
   chipActive: { backgroundColor: T.solid, borderColor: T.solid },
   chipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   chipTextActive: { color: T.onSolid, fontWeight: '800' },

   imageRow: { flexDirection: 'row', gap: 8 },
   imagePreviewBox: {
      width: 72, height: 90, borderRadius: 8, overflow: 'hidden',
      position: 'relative', borderWidth: 1, borderColor: T.line,
   },
   previewImg: { width: '100%', height: '100%' },
   removeImgBtn: {
      position: 'absolute', top: 4, right: 4,
      backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, padding: 3,
   },
   newBadge: {
      position: 'absolute', bottom: 4, left: 4,
      backgroundColor: '#2563EB', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3,
   },
   newBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
   addImgBox: {
      width: 72, height: 90, borderRadius: 8,
      borderWidth: 1, borderStyle: 'dashed', borderColor: T.line,
      alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: T.surface,
   },
   addImgText: { fontSize: 9, fontWeight: '600', color: T.inkMute },

   sectionContainer: {
      borderWidth: 1, borderColor: T.line, borderRadius: 10,
      padding: 10, backgroundColor: T.surface, gap: 8,
   },
   sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   sectionTitle: { fontSize: 11, fontWeight: '800', color: T.ink, letterSpacing: 0.5 },
   addSmallBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: T.solid, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
   },
   addSmallBtnText: { fontSize: 11, fontWeight: '700', color: T.onSolid },

   colorCard: {
      borderWidth: 1, borderColor: T.line, borderRadius: 8,
      padding: 10, backgroundColor: T.bg, gap: 6,
   },
   colorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   colorHeaderTitle: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   removeColorBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
   removeColorText: { fontSize: 11, fontWeight: '600', color: '#EF4444' },

   colorBadge: {
      width: 32, height: 32, borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center', justifyContent: 'center',
   },
   colorBadgeActive: { borderWidth: 3, borderColor: T.ink },

   colorInputCustom: {
      height: 38,
      backgroundColor: T.surface,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 0,
      fontSize: 13,
      color: T.ink,
      textAlignVertical: 'center',
   },

   subLabel: { fontSize: 11, fontWeight: '700', color: T.inkMute, textTransform: 'uppercase', marginTop: 4 },

   sizeChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   sizeChip: {
      minWidth: 44, paddingVertical: 6, paddingHorizontal: 10,
      borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface,
      alignItems: 'center',
   },
   sizeChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   sizeChipText: { fontSize: 12, fontWeight: '700', color: T.ink },
   sizeChipTextActive: { color: T.onSolid },

   stockGrid: { marginTop: 6, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 6 },
   stockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   stockBox: { width: 54, alignItems: 'center' },
   stockSizeLabel: { fontSize: 10, fontWeight: '800', color: T.inkSoft, marginBottom: 3 },
   stockInput: {
      width: '100%',
      height: 32,
      backgroundColor: T.surface,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 6,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontSize: 13,
      fontWeight: '800',
      color: T.ink,
      padding: 0,
   },

   saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 48, backgroundColor: T.solid, borderRadius: 10, marginTop: 6,
   },
   saveBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid, textTransform: 'uppercase', letterSpacing: 0.5 },

   // Lightbox
   lightboxOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
   },
   lightboxClose: {
      position: 'absolute', top: 30, right: 20, zIndex: 10,
      padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22,
   },
   lightboxImage: { width: '100%', height: '85%', maxWidth: 900 },

   // Saving overlay
   savingOverlay: {
      flex: 1, backgroundColor: 'rgba(10,10,10,0.7)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
   },
   savingCard: {
      backgroundColor: T.surface, borderRadius: 16,
      paddingHorizontal: 32, paddingVertical: 28,
      alignItems: 'center', gap: 12, minWidth: 260,
      borderWidth: 1, borderColor: T.line,
   },
   savingTitle: {
      ...display, fontSize: 18, fontWeight: '800',
      color: T.ink, letterSpacing: 0.5, textTransform: 'uppercase',
   },
   savingStage: { fontSize: 12, color: T.inkMute, fontWeight: '600', textAlign: 'center' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { X, Plus, Trash2, Camera, Check } from 'lucide-react-native';
import { Product, ProductVariant } from '../types/inventory';
import { saveProduct } from '../services/productService';
import { showAlert } from '../utils/alert';
import { MONO as T, display, getColorHex } from '../design';

interface Props {
  initialProduct?: Product | null;
  onClose: () => void;
}

const CATEGORIES = [
  'Zapatos',
  'Camisas',
  'Franelillas',
  'Shorts',
  'Monos',
  'Conjuntos',
  'Accesorios',
  'Otros',
];

const AVAILABLE_COLORS = [
  'Negro',
  'Blanco',
  'Gris',
  'Rojo',
  'Azul',
  'Azul marino',
  'Verde',
  'Amarillo',
  'Rosado',
  'Naranja',
  'Morado',
  'Beige',
];

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', 'Única'];

export const ProductFormScreen: React.FC<Props> = ({
  initialProduct,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [code, setCode] = useState(initialProduct?.code || '');
  const [name, setName] = useState(initialProduct?.name || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [category, setCategory] = useState(initialProduct?.category || 'Shorts');
  const [price, setPrice] = useState(
    initialProduct?.price ? String(initialProduct.price) : ''
  );
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialProduct?.variants || [
      { color: 'Negro', sizes: [{ size: 'M', stock: 5 }] },
    ]
  );
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAddImage = () => {
    if (images.length >= 2) {
      showAlert('Límite', 'Máximo 2 imágenes por prenda.');
      return;
    }
    const sampleImages = [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500',
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500',
    ];
    const nextImg = sampleImages[images.length % sampleImages.length];
    setImages([...images, nextImg]);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddColor = () => {
    const unusedColor =
      AVAILABLE_COLORS.find(
        (c) => !variants.some((v) => v.color === c)
      ) || 'Otro';
    setVariants([
      ...variants,
      { color: unusedColor, sizes: [{ size: 'M', stock: 1 }] },
    ]);
    setSelectedColorIndex(variants.length);
  };

  const handleRemoveColor = (index: number) => {
    if (variants.length <= 1) {
      showAlert('Atención', 'La prenda debe tener al menos un color.');
      return;
    }
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
    setSelectedColorIndex(Math.max(0, index - 1));
  };

  const handleAddSizeToCurrentColor = () => {
    const currentVar = variants[selectedColorIndex];
    if (!currentVar) return;
    const existingSizes = currentVar.sizes.map((s) => s.size);
    const nextSize =
      AVAILABLE_SIZES.find((s) => !existingSizes.includes(s)) || 'L';

    const updatedSizes = [...currentVar.sizes, { size: nextSize, stock: 1 }];
    const updatedVariants = [...variants];
    updatedVariants[selectedColorIndex] = {
      ...currentVar,
      sizes: updatedSizes,
    };
    setVariants(updatedVariants);
  };

  const handleUpdateSizeStock = (sizeIdx: number, newStockStr: string) => {
    const stockVal = Math.max(0, parseInt(newStockStr) || 0);
    const currentVar = variants[selectedColorIndex];
    if (!currentVar) return;

    const updatedSizes = [...currentVar.sizes];
    updatedSizes[sizeIdx] = { ...updatedSizes[sizeIdx], stock: stockVal };

    const updatedVariants = [...variants];
    updatedVariants[selectedColorIndex] = {
      ...currentVar,
      sizes: updatedSizes,
    };
    setVariants(updatedVariants);
  };

  const handleRemoveSize = (sizeIdx: number) => {
    const currentVar = variants[selectedColorIndex];
    if (!currentVar) return;
    if (currentVar.sizes.length <= 1) {
      showAlert('Atención', 'Debe haber al menos una talla para este color.');
      return;
    }
    const updatedSizes = currentVar.sizes.filter((_, i) => i !== sizeIdx);
    const updatedVariants = [...variants];
    updatedVariants[selectedColorIndex] = {
      ...currentVar,
      sizes: updatedSizes,
    };
    setVariants(updatedVariants);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !price.trim()) {
      showAlert('Campos incompletos', 'Por favor llena el código, nombre y precio.');
      return;
    }

    try {
      setLoading(true);
      const productData: Product = {
        id: initialProduct?.id,
        code: code.trim(),
        name: name.trim(),
        brand: brand.trim(),
        category,
        price: parseFloat(price) || 0,
        images,
        variants,
      };

      await saveProduct(productData);
      onClose();
    } catch (error) {
      console.error(error);
      showAlert('Error', 'No se pudo guardar la prenda.');
    } finally {
      setLoading(false);
    }
  };

  const currentVariant = variants[selectedColorIndex] || variants[0];

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.row, isMobile && styles.rowMobile]}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>CÓDIGO / SKU *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 9619"
              placeholderTextColor={T.inkMute}
              value={code}
              onChangeText={setCode}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>PRECIO ($) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={T.inkMute}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>NOMBRE DE LA PRENDA *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Short UnderArmour"
            placeholderTextColor={T.inkMute}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={[styles.row, isMobile && styles.rowMobile]}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>MARCA</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Under Armour"
              placeholderTextColor={T.inkMute}
              value={brand}
              onChangeText={setBrand}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1.5 }]}>
            <Text style={styles.label}>CATEGORÍA *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.catChip, active && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        active && styles.catChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>IMÁGENES (MÁX. 2)</Text>
          <View style={styles.imageRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imagePreviewBox}>
                <Image source={{ uri }} style={styles.previewImg} />
                <Pressable
                  style={styles.removeImgBtn}
                  onPress={() => handleRemoveImage(idx)}
                >
                  <X size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {images.length < 2 && (
              <Pressable
                style={({ pressed }) => [
                  styles.addImgBox,
                  pressed && styles.pressed,
                ]}
                onPress={handleAddImage}
              >
                <Camera size={20} color={T.inkMute} />
                <Text style={styles.addImgText}>Subir foto</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COLORES, TALLAS Y STOCK</Text>
            <Pressable
              style={({ pressed }) => [
                styles.addSmallBtn,
                pressed && styles.pressed,
              ]}
              onPress={handleAddColor}
            >
              <Plus size={14} color={T.onSolid} />
              <Text style={styles.addSmallBtnText}>Agregar color</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorPickerRow}
          >
            {variants.map((v, i) => {
              const isSelected = selectedColorIndex === i;
              const colorHex = getColorHex(v.color);
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.colorOptionBubble,
                    isSelected && styles.colorOptionBubbleSelected,
                  ]}
                  onPress={() => setSelectedColorIndex(i)}
                >
                  <View
                    style={[
                      styles.colorDotInner,
                      { backgroundColor: colorHex },
                    ]}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text
                    style={[
                      styles.colorOptionText,
                      isSelected && styles.colorOptionTextSelected,
                    ]}
                  >
                    {v.color}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {currentVariant && (
            <View style={styles.variantDetailBox}>
              <View style={styles.variantDetailHeader}>
                <Text style={styles.variantDetailTitle}>
                  Tallas para: <Text style={{ color: T.ink }}>{currentVariant.color}</Text>
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.textDeleteBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleRemoveColor(selectedColorIndex)}
                >
                  <Trash2 size={13} color="#EF4444" />
                  <Text style={styles.textDeleteText}>Eliminar color</Text>
                </Pressable>
              </View>

              <View style={styles.sizeStockGrid}>
                {currentVariant.sizes.map((sz, szIdx) => (
                  <View key={szIdx} style={styles.sizeStockItem}>
                    <Text style={styles.sizeItemLabel}>{sz.size}</Text>
                    <TextInput
                      style={styles.sizeStockInput}
                      keyboardType="numeric"
                      value={String(sz.stock)}
                      onChangeText={(val) =>
                        handleUpdateSizeStock(szIdx, val)
                      }
                    />
                    <Text style={styles.sizeUnitLabel}>uds</Text>
                    <Pressable
                      style={styles.removeSizeBtn}
                      onPress={() => handleRemoveSize(szIdx)}
                    >
                      <X size={12} color={T.inkMute} />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  style={({ pressed }) => [
                    styles.addSizeBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleAddSizeToCurrentColor}
                >
                  <Plus size={15} color={T.ink} />
                  <Text style={styles.addSizeText}>Talla</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Guardando...' : 'Guardar Prenda'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.surface,
  },
  headerTitle: {
    ...display,
    fontSize: 20,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.line,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: T.inkMute,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: T.ink,
    backgroundColor: T.surface,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.surface,
  },
  catChipActive: {
    backgroundColor: T.solid,
    borderColor: T.solid,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink,
  },
  catChipTextActive: {
    color: T.onSolid,
    fontWeight: '700',
  },
  imageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  imagePreviewBox: {
    width: 60,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: T.line,
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removeImgBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 3,
  },
  addImgBox: {
    width: 60,
    height: 72,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: T.surface,
  },
  addImgText: {
    fontSize: 9,
    fontWeight: '600',
    color: T.inkMute,
  },
  sectionContainer: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: T.surface,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: 0.5,
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.solid,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.onSolid,
  },
  colorPickerRow: {
    gap: 6,
    paddingVertical: 4,
  },
  colorOptionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.bg,
  },
  colorOptionBubbleSelected: {
    borderColor: T.ink,
    backgroundColor: T.surface,
  },
  colorDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.inkMute,
  },
  colorOptionTextSelected: {
    color: T.ink,
    fontWeight: '700',
  },
  variantDetailBox: {
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingTop: 8,
    gap: 6,
  },
  variantDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: T.inkMute,
  },
  textDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  textDeleteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  sizeStockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  sizeStockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 6,
    paddingLeft: 8,
    paddingRight: 4,
    height: 32,
    gap: 4,
  },
  sizeItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: T.ink,
    minWidth: 20,
  },
  sizeStockInput: {
    width: 34,
    height: 24,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: T.ink,
    padding: 0,
  },
  sizeUnitLabel: {
    fontSize: 10,
    color: T.inkMute,
  },
  removeSizeBtn: {
    padding: 2,
  },
  addSizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    borderStyle: 'dashed',
    backgroundColor: T.bg,
  },
  addSizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink,
  },
  saveBtn: {
    height: 42,
    backgroundColor: T.solid,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: T.onSolid,
    textTransform: 'uppercase',
  },
});
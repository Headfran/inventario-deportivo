import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   Image,
   TextInput,
   Modal,
   FlatList,
} from 'react-native';
import {
   Search,
   MessageCircle,
   Lock,
   X,
   ShoppingBag,
   SlidersHorizontal,
   RotateCcw,
   Check,
   Tag,
} from 'lucide-react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { openWhatsAppShare } from '../utils/shareUtils';

interface Props {
   onOpenStaffAccess: () => void;
}

/**
 * Mapeo dinámico de nombres de color a códigos Hexadecimales
 */
const getColorHex = (colorName: string): string => {
   const name = colorName.toLowerCase().trim();
   const colorMap: Record<string, string> = {
      negro: '#000000',
      black: '#000000',
      blanco: '#ffffff',
      white: '#ffffff',
      rojo: '#ef4444',
      red: '#ef4444',
      azul: '#2563eb',
      blue: '#2563eb',
      'azul marino': '#1e3a8a',
      navy: '#1e3a8a',
      verde: '#22c55e',
      green: '#22c55e',
      amarillo: '#eab308',
      yellow: '#eab308',
      gris: '#64748b',
      gray: '#64748b',
      grey: '#64748b',
      'gris oscuro': '#334155',
      'gris claro': '#cbd5e1',
      rosado: '#ec4899',
      rosa: '#ec4899',
      pink: '#ec4899',
      morado: '#a855f7',
      purpura: '#a855f7',
      purple: '#a855f7',
      naranja: '#f97316',
      orange: '#f97316',
      beige: '#fef3c7',
      arena: '#fef3c7',
      marron: '#78350f',
      cafe: '#78350f',
      brown: '#78350f',
      vinotinto: '#881337',
      burgundy: '#881337',
   };

   return colorMap[name] || '#94a3b8';
};

/**
 * Mapea marcas deportivas y casuales conocidas al CDN público de Simple Icons
 */
const getBrandLogoUrl = (brandName: string): string | null => {
   const clean = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
   const brandSlugMap: Record<string, string> = {
      nike: 'nike',
      adidas: 'adidas',
      puma: 'puma',
      underarmour: 'underarmour',
      ua: 'underarmour',
      reebok: 'reebok',
      jordan: 'airjordan',
      newbalance: 'newbalance',
      nb: 'newbalance',
      champion: 'champion',
      fila: 'fila',
      asics: 'asics',
      converse: 'converse',
      vans: 'vans',
      uniqlo: 'uniqlo',
      uq: 'uniqlo',
      on: 'onrunning',
      onrunning: 'onrunning',
      umbro: 'umbro',
      kappa: 'kappa',
      lotto: 'lotto',
      oakley: 'oakley',
      hummel: 'hummel',
   };

   const slug = brandSlugMap[clean];
   if (slug) {
      return `https://cdn.simpleicons.org/${slug}/2563eb`;
   }
   return null;
};

/**
 * Componente que muestra el logo de la marca con fallback a Badge tipográfico
 */
const BrandLogoItem: React.FC<{ brandName: string; isSelected: boolean }> = ({
   brandName,
   isSelected,
}) => {
   const [hasError, setHasError] = useState(false);
   const logoUrl = getBrandLogoUrl(brandName);

   if (logoUrl && !hasError) {
      return (
         <Image
            source={{ uri: logoUrl }}
            style={styles.brandLogoImg}
            resizeMode="contain"
            onError={() => setHasError(true)}
         />
      );
   }

   // Fallback: Mostrar avatar redondo con la inicial de la marca
   return (
      <View style={[styles.brandInitialAvatar, isSelected && styles.brandInitialAvatarActive]}>
         <Text style={[styles.brandInitialText, isSelected && styles.brandInitialTextActive]}>
            {brandName.charAt(0).toUpperCase()}
         </Text>
      </View>
   );
};

export const PublicCatalogScreen: React.FC<Props> = ({ onOpenStaffAccess }) => {
   const [products, setProducts] = useState<Product[]>([]);
   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
   const [detailProduct, setDetailProduct] = useState<Product | null>(null);
   const [selectedImageIndex, setSelectedImageIndex] = useState(0);

   // ESTADO DE FILTROS MULTI-CRITERIO
   const [filters, setFilters] = useState<FilterOptions>({
      query: '',
      category: 'all',
      brand: '',
      color: '',
      size: '',
      status: 'all',
   });

   useEffect(() => {
      const unsub = subscribeToProducts(setProducts);
      return () => unsub();
   }, []);

   // EXTRACCIÓN DINÁMICA DE OPCIONES DISPONIBLES
   const categories = ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
   const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
   const colors = Array.from(
      new Set(
         products.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean)
      )
   );
   const sizes = Array.from(
      new Set(
         products.flatMap((p) =>
            (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))
         ).filter(Boolean)
      )
   );

   // APLICAR FILTRADO INTELIGENTE
   const filteredProducts = filterProducts(products, filters);

   const activeFiltersCount =
      (filters.brand ? 1 : 0) +
      (filters.color ? 1 : 0) +
      (filters.size ? 1 : 0) +
      (filters.category !== 'all' ? 1 : 0);

   const handleResetFilters = () => {
      setFilters({
         query: '',
         category: 'all',
         brand: '',
         color: '',
         size: '',
         status: 'all',
      });
   };

   return (
      <View style={styles.container}>
         {/* CABECERA TIENDA */}
         <View style={styles.header}>
            <View style={styles.brandGroup}>
               <ShoppingBag size={22} color="#2563eb" style={{ marginRight: 8 }} />
               <View>
                  <Text style={styles.headerTitle}>Catálogo de Prendas</Text>
                  <Text style={styles.headerSubtitle}>Explora nuestros modelos disponibles</Text>
               </View>
            </View>

            <TouchableOpacity
               style={styles.staffAccessBtn}
               onPress={onOpenStaffAccess}
               accessibilityLabel="Acceso al Personal"
            >
               <Lock size={14} color="#64748b" style={{ marginRight: 4 }} />
               <Text style={styles.staffAccessText}>Personal</Text>
            </TouchableOpacity>
         </View>

         {/* BARRA BÚSQUEDA Y BOTÓN FILTROS */}
         <View style={styles.filterSection}>
            <View style={styles.searchRow}>
               <View style={styles.searchBar}>
                  <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar por modelo, marca o código..."
                     placeholderTextColor="#94a3b8"
                     value={filters.query}
                     onChangeText={(text) => setFilters((prev) => ({ ...prev, query: text }))}
                  />
                  {filters.query ? (
                     <TouchableOpacity onPress={() => setFilters((prev) => ({ ...prev, query: '' }))}>
                        <X size={16} color="#94a3b8" />
                     </TouchableOpacity>
                  ) : null}
               </View>

               <TouchableOpacity
                  style={[styles.filterBtn, activeFiltersCount > 0 && styles.filterBtnActive]}
                  onPress={() => setIsFilterModalOpen(true)}
               >
                  <SlidersHorizontal
                     size={16}
                     color={activeFiltersCount > 0 ? '#ffffff' : '#2563eb'}
                  />
                  {activeFiltersCount > 0 && (
                     <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                     </View>
                  )}
               </TouchableOpacity>
            </View>

            {/* CHIPS DE CATEGORÍAS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
               {categories.map((cat) => {
                  const isSelected = filters.category === cat;
                  return (
                     <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        onPress={() => setFilters((prev) => ({ ...prev, category: cat }))}
                     >
                        <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                           {cat === 'all' ? 'Todas' : cat}
                        </Text>
                     </TouchableOpacity>
                  );
               })}
            </ScrollView>

            {/* RESUMEN DE FILTROS ACTIVOS CON CÍRCULOS DE COLOR Y ETIQUETAS */}
            {activeFiltersCount > 0 && (
               <View style={styles.activeFiltersRow}>
                  <Text style={styles.activeFiltersLabel}>Filtros:</Text>

                  {filters.brand ? (
                     <TouchableOpacity
                        style={styles.activeFilterChip}
                        onPress={() => setFilters((prev) => ({ ...prev, brand: '' }))}
                     >
                        <Tag size={12} color="#2563eb" style={{ marginRight: 4 }} />
                        <Text style={styles.activeFilterText}>{filters.brand}</Text>
                        <X size={12} color="#2563eb" style={{ marginLeft: 4 }} />
                     </TouchableOpacity>
                  ) : null}

                  {filters.color ? (
                     <TouchableOpacity
                        style={styles.activeFilterChip}
                        onPress={() => setFilters((prev) => ({ ...prev, color: '' }))}
                     >
                        <View
                           style={[
                              styles.colorCircleSmall,
                              { backgroundColor: getColorHex(filters.color) },
                           ]}
                        />
                        <Text style={styles.activeFilterText}>{filters.color}</Text>
                        <X size={12} color="#2563eb" style={{ marginLeft: 4 }} />
                     </TouchableOpacity>
                  ) : null}

                  {filters.size ? (
                     <TouchableOpacity
                        style={styles.activeFilterChip}
                        onPress={() => setFilters((prev) => ({ ...prev, size: '' }))}
                     >
                        <Text style={styles.activeFilterText}>Talla: {filters.size}</Text>
                        <X size={12} color="#2563eb" style={{ marginLeft: 4 }} />
                     </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity onPress={handleResetFilters} style={styles.resetTextBtn}>
                     <RotateCcw size={12} color="#ef4444" style={{ marginRight: 2 }} />
                     <Text style={styles.resetText}>Limpiar</Text>
                  </TouchableOpacity>
               </View>
            )}
         </View>

         {/* REJILLA DE PRODUCTOS (GRID) */}
         <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id || item.code}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridColumnWrapper}
            renderItem={({ item }) => {
               const coverImg = item.images?.[0] || 'https://via.placeholder.com/200?text=Sin+Foto';

               return (
                  <TouchableOpacity
                     style={styles.productCard}
                     activeOpacity={0.85}
                     onPress={() => {
                        setDetailProduct(item);
                        setSelectedImageIndex(0);
                     }}
                  >
                     <Image source={{ uri: coverImg }} style={styles.cardImg} resizeMode="cover" />

                     <View style={styles.cardBody}>
                        <Text style={styles.cardBrand}>{item.brand}</Text>
                        <Text style={styles.cardName} numberOfLines={2}>
                           {item.name}
                        </Text>
                        <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>

                        <TouchableOpacity
                           style={styles.whatsAppQuickBtn}
                           onPress={(e) => {
                              e.stopPropagation();
                              openWhatsAppShare(item);
                           }}
                        >
                           <MessageCircle size={14} color="#ffffff" style={{ marginRight: 4 }} />
                           <Text style={styles.whatsAppQuickText}>Consultar</Text>
                        </TouchableOpacity>
                     </View>
                  </TouchableOpacity>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No se encontraron prendas</Text>
                  <Text style={styles.emptySubtitle}>Intenta cambiando los filtros de marca, color o talla.</Text>
                  {activeFiltersCount > 0 && (
                     <TouchableOpacity style={styles.resetBtnEmpty} onPress={handleResetFilters}>
                        <Text style={styles.resetBtnEmptyText}>Restablecer Filtros</Text>
                     </TouchableOpacity>
                  )}
               </View>
            }
         />

         {/* MODAL DE FILTROS VISUALES (MARCAS Y MUESTRAS DE COLOR) */}
         <Modal visible={isFilterModalOpen} transparent animationType="slide">
            <View style={styles.modalOverlay}>
               <View style={styles.filterModalCard}>
                  <View style={styles.filterModalHeader}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <SlidersHorizontal size={18} color="#2563eb" />
                        <Text style={styles.filterModalTitle}>Filtros Visuales</Text>
                     </View>
                     <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                        <X size={20} color="#64748b" />
                     </TouchableOpacity>
                  </View>

                  <ScrollView style={{ padding: 16 }}>
                     {/* FILTRO VISUAL DE MARCAS */}
                     <Text style={styles.filterSectionTitle}>Marcas:</Text>
                     <View style={styles.brandGrid}>
                        <TouchableOpacity
                           style={[styles.brandCard, !filters.brand && styles.brandCardActive]}
                           onPress={() => setFilters((p) => ({ ...p, brand: '' }))}
                        >
                           <Tag size={16} color={!filters.brand ? '#2563eb' : '#64748b'} />
                           <Text style={[styles.brandCardText, !filters.brand && styles.brandCardTextActive]}>
                              Todas
                           </Text>
                        </TouchableOpacity>

                        {brands.map((b) => {
                           const isSelected = filters.brand === b;
                           return (
                              <TouchableOpacity
                                 key={b}
                                 style={[styles.brandCard, isSelected && styles.brandCardActive]}
                                 onPress={() => setFilters((p) => ({ ...p, brand: b }))}
                              >
                                 <BrandLogoItem brandName={b} isSelected={isSelected} />
                                 <Text
                                    style={[
                                       styles.brandCardText,
                                       isSelected && styles.brandCardTextActive,
                                    ]}
                                 >
                                    {b}
                                 </Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>

                     {/* FILTRO VISUAL DE COLORES */}
                     <Text style={styles.filterSectionTitle}>Colores Disponibles:</Text>
                     <View style={styles.colorGrid}>
                        <TouchableOpacity
                           style={[styles.colorChipChoice, !filters.color && styles.colorChipChoiceActive]}
                           onPress={() => setFilters((p) => ({ ...p, color: '' }))}
                        >
                           <Text style={[styles.colorChipText, !filters.color && styles.colorChipTextActive]}>
                              Todos
                           </Text>
                        </TouchableOpacity>

                        {colors.map((c) => {
                           const isSelected = filters.color === c;
                           const hexColor = getColorHex(c);
                           const isWhite = hexColor.toLowerCase() === '#ffffff';

                           return (
                              <TouchableOpacity
                                 key={c}
                                 style={[
                                    styles.colorChipChoice,
                                    isSelected && styles.colorChipChoiceActive,
                                 ]}
                                 onPress={() => setFilters((p) => ({ ...p, color: c }))}
                              >
                                 <View
                                    style={[
                                       styles.colorSwatch,
                                       { backgroundColor: hexColor },
                                       isWhite && { borderWidth: 1, borderColor: '#cbd5e1' },
                                    ]}
                                 />
                                 <Text
                                    style={[
                                       styles.colorChipText,
                                       isSelected && styles.colorChipTextActive,
                                    ]}
                                 >
                                    {c}
                                 </Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>

                     {/* FILTRO POR TALLA */}
                     <Text style={styles.filterSectionTitle}>Talla Disponible:</Text>
                     <View style={styles.sizeWrap}>
                        <TouchableOpacity
                           style={[styles.sizeChipChoice, !filters.size && styles.sizeChipChoiceActive]}
                           onPress={() => setFilters((p) => ({ ...p, size: '' }))}
                        >
                           <Text style={[styles.sizeChipText, !filters.size && styles.sizeChipTextActive]}>
                              Todas
                           </Text>
                        </TouchableOpacity>

                        {sizes.map((s) => {
                           const isSelected = filters.size === s;
                           return (
                              <TouchableOpacity
                                 key={s}
                                 style={[styles.sizeChipChoice, isSelected && styles.sizeChipChoiceActive]}
                                 onPress={() => setFilters((p) => ({ ...p, size: s }))}
                              >
                                 <Text
                                    style={[
                                       styles.sizeChipText,
                                       isSelected && styles.sizeChipTextActive,
                                    ]}
                                 >
                                    {s}
                                 </Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>
                  </ScrollView>

                  <View style={styles.filterModalFooter}>
                     <TouchableOpacity style={styles.clearFiltersBtn} onPress={handleResetFilters}>
                        <Text style={styles.clearFiltersText}>Limpiar Todo</Text>
                     </TouchableOpacity>

                     <TouchableOpacity
                        style={styles.applyFiltersBtn}
                        onPress={() => setIsFilterModalOpen(false)}
                     >
                        <Check size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.applyFiltersText}>
                           Ver {filteredProducts.length} Resultados
                        </Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>

         {/* MODAL DETALLE DE PRENDA */}
         <Modal visible={!!detailProduct} transparent animationType="slide">
            {detailProduct && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailProduct(null)}>
                        <X size={20} color="#0f172a" />
                     </TouchableOpacity>

                     <ScrollView style={styles.modalScroll}>
                        <View style={styles.galleryContainer}>
                           <Image
                              source={{
                                 uri:
                                    detailProduct.images?.[selectedImageIndex] ||
                                    'https://via.placeholder.com/300?text=Sin+Foto',
                              }}
                              style={styles.mainGalleryImg}
                              resizeMode="cover"
                           />

                           {detailProduct.images && detailProduct.images.length > 1 && (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsRow}>
                                 {detailProduct.images.map((img, idx) => (
                                    <TouchableOpacity
                                       key={idx}
                                       onPress={() => setSelectedImageIndex(idx)}
                                       style={[
                                          styles.thumbnailBox,
                                          selectedImageIndex === idx && styles.thumbnailActive,
                                       ]}
                                    >
                                       <Image source={{ uri: img }} style={styles.thumbnailImg} />
                                    </TouchableOpacity>
                                 ))}
                              </ScrollView>
                           )}
                        </View>

                        <View style={styles.modalBody}>
                           <Text style={styles.modalBrand}>{detailProduct.brand}</Text>
                           <Text style={styles.modalName}>{detailProduct.name}</Text>
                           <Text style={styles.modalCode}>SKU: {detailProduct.code}</Text>
                           <Text style={styles.modalPrice}>${detailProduct.price.toFixed(2)}</Text>

                           <Text style={styles.sectionLabel}>Colores y Tallas Disponibles:</Text>
                           <View style={styles.variantsBox}>
                              {detailProduct.variants.map((v, idx) => {
                                 const availableSizes = (v.sizes || [])
                                    .filter((s) => Number(s.stock) > 0)
                                    .map((s) => s.size)
                                    .join(', ');

                                 return (
                                    <View key={idx} style={styles.variantRow}>
                                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          <View
                                             style={[
                                                styles.colorCircleSmall,
                                                { backgroundColor: getColorHex(v.color) },
                                             ]}
                                          />
                                          <Text style={styles.variantColor}>Color {v.color}:</Text>
                                       </View>
                                       <Text style={availableSizes ? styles.variantSizes : styles.variantOutOfStock}>
                                          {availableSizes ? `Tallas: ${availableSizes}` : 'Agotado'}
                                       </Text>
                                    </View>
                                 );
                              })}
                           </View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        <TouchableOpacity
                           style={styles.modalWhatsAppBtn}
                           onPress={() => {
                              openWhatsAppShare(detailProduct);
                              setDetailProduct(null);
                           }}
                        >
                           <MessageCircle size={18} color="#ffffff" style={{ marginRight: 8 }} />
                           <Text style={styles.modalWhatsAppText}>Pedir por WhatsApp</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               </View>
            )}
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   brandGroup: { flexDirection: 'row', alignItems: 'center' },
   headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   headerSubtitle: { fontSize: 11, color: '#64748b' },
   staffAccessBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
   },
   staffAccessText: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },

   filterSection: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#ffffff' },
   searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
   searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 40,
   },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   filterBtn: {
      width: 40,
      height: 40,
      backgroundColor: '#eff6ff',
      borderWidth: 1,
      borderColor: '#bfdbfe',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
   },
   filterBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   filterBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      width: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
   },
   filterBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

   categoriesScroll: { flexDirection: 'row', paddingBottom: 10 },
   categoryChip: {
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 6,
   },
   categoryChipActive: { backgroundColor: '#2563eb' },
   categoryText: { fontSize: 12, color: '#475569', fontWeight: '600' },
   categoryTextActive: { color: '#ffffff', fontWeight: 'bold' },

   activeFiltersRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingBottom: 10 },
   activeFiltersLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
   activeFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#eff6ff',
      borderWidth: 1,
      borderColor: '#bfdbfe',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
   },
   activeFilterText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
   resetTextBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
   resetText: { fontSize: 11, color: '#ef4444', fontWeight: 'bold' },

   /* GRID */
   gridContent: { padding: 12 },
   gridColumnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
   productCard: {
      width: '48.5%',
      backgroundColor: '#ffffff',
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      elevation: 2,
   },
   cardImg: { width: '100%', height: 160, backgroundColor: '#f1f5f9' },
   cardBody: { padding: 10 },
   cardBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' },
   cardName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginVertical: 2, height: 36 },
   cardPrice: { fontSize: 15, fontWeight: '800', color: '#16a34a', marginBottom: 8 },
   whatsAppQuickBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#25d366',
      paddingVertical: 6,
      borderRadius: 6,
   },
   whatsAppQuickText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
   emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   emptySubtitle: { fontSize: 12, color: '#64748b', marginTop: 4 },
   resetBtnEmpty: { marginTop: 12, backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
   resetBtnEmptyText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },

   /* MODAL FILTROS VISUALES */
   filterModalCard: { width: '100%', maxWidth: 440, maxHeight: '88%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   filterModalTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   filterSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 12, marginBottom: 8 },

   /* TARJETAS DE MARCAS Y FALLBACK AVATAR */
   brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   brandCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
   },
   brandCardActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
   brandLogoImg: { width: 18, height: 18 },
   brandInitialAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#e2e8f0',
      justifyContent: 'center',
      alignItems: 'center',
   },
   brandInitialAvatarActive: { backgroundColor: '#2563eb' },
   brandInitialText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
   brandInitialTextActive: { color: '#ffffff' },
   brandCardText: { fontSize: 12, color: '#475569', fontWeight: '600' },
   brandCardTextActive: { color: '#2563eb', fontWeight: 'bold' },

   /* FILTRO DE COLORES CON MUESTRA SWATCH */
   colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   colorChipChoice: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
   },
   colorChipChoiceActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
   colorSwatch: { width: 14, height: 14, borderRadius: 7 },
   colorCircleSmall: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
   colorChipText: { fontSize: 11, color: '#475569', textTransform: 'capitalize' },
   colorChipTextActive: { color: '#2563eb', fontWeight: 'bold' },

   /* FILTRO DE TALLAS */
   sizeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   sizeChipChoice: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
   sizeChipChoiceActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   sizeChipText: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
   sizeChipTextActive: { color: '#ffffff' },

   filterModalFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   clearFiltersBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9' },
   clearFiltersText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
   applyFiltersBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
   applyFiltersText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

   /* MODAL DETALLE PRENDA */
   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   modalCard: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', position: 'relative' },
   modalCloseBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: '#ffffff', borderRadius: 16, padding: 6, elevation: 3 },
   modalScroll: { flex: 1 },
   galleryContainer: { backgroundColor: '#f8fafc' },
   mainGalleryImg: { width: '100%', height: 280 },
   thumbnailsRow: { padding: 8, flexDirection: 'row' },
   thumbnailBox: { width: 50, height: 50, borderRadius: 6, overflow: 'hidden', marginRight: 6, borderWidth: 2, borderColor: 'transparent' },
   thumbnailActive: { borderColor: '#2563eb' },
   thumbnailImg: { width: '100%', height: '100%' },
   modalBody: { padding: 16 },
   modalBrand: { fontSize: 12, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' },
   modalName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginVertical: 2 },
   modalCode: { fontSize: 11, color: '#64748b', marginBottom: 6 },
   modalPrice: { fontSize: 22, fontWeight: '800', color: '#16a34a', marginBottom: 14 },
   sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
   variantsBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
   variantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   variantColor: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   variantSizes: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
   variantOutOfStock: { fontSize: 12, color: '#ef4444', fontStyle: 'italic' },
   modalFooter: { padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   modalWhatsAppBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#25d366', paddingVertical: 12, borderRadius: 10 },
   modalWhatsAppText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});

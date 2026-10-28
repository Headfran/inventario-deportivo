import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, ActivityIndicator, useWindowDimensions, Platform, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Pencil, Trash2, Layers, ChevronLeft, ChevronRight, MessageCircle, Printer, CheckSquare, Square, Zap, Share2, X } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts, deleteProduct } from '../services/productService';
import { ProductFormScreen } from './ProductFormScreen';
import { StockAdjustModal } from './StockAdjustModal';
import { ProductShareModal } from '../components/ProductShareModal';
import { CatalogPrintModal } from '../components/CatalogPrintModal';
import { BulkUpdateModal } from '../components/BulkUpdateModal';
import { showConfirm, showAlert } from '../utils/alert';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { advancedBulkNativeShare } from '../utils/shareUtils';
import { Cover } from '../components/Cover';
import { MONO as T, display, getColorHex } from '../design';

const ITEMS_PER_PAGE = 10;
const MAX = 1180;

// En web la barra de URL del navegador no descuenta del viewport; añadimos colchón.
const WEB_BOTTOM_BUFFER = Platform.OS === 'web' ? 20 : 0;

const calculateTotalStock = (p: Product) =>
   (p.variants || []).reduce((acc, v) => acc + (v.sizes || []).reduce((a, s) => a + (Number(s.stock) || 0), 0), 0);

// ==========================================
// TARJETA MEMOIZADA
// ==========================================
interface ProductListItemProps {
   item: Product;
   isSelected: boolean;
   isSelectionModeActive: boolean;
   isMobile: boolean;
   onToggle: (id: string) => void;
   onEdit: (product: Product) => void;
   onDelete: (product: Product) => void;
   onAdjustStock: (product: Product) => void;
   onShare: (product: Product) => void;
   onImagePress: (images: string[]) => void;
}

const ProductListItem = memo(({
   item, isSelected, isSelectionModeActive, isMobile,
   onToggle, onEdit, onDelete, onAdjustStock, onShare, onImagePress,
}: ProductListItemProps) => {
   const totalStock = calculateTotalStock(item);
   const out = totalStock === 0;
   const low = totalStock > 0 && totalStock <= 3;
   const variants = item.variants || [];

   const handleCardPress = () => {
      if (isSelectionModeActive) onToggle(item.id!);
   };

   return (
      <Pressable
         onLongPress={() => onToggle(item.id!)}
         onPress={handleCardPress}
         style={[styles.card, isMobile && styles.cardMobile, isSelected && styles.cardSelected]}
      >
         <View style={styles.main}>
            <View style={styles.imageWrapper}>
               <Pressable onPress={() => onImagePress(item.images)}>
                  <Cover
                     uri={item.images?.[0]}
                     name={item.name}
                     bg={T.imgBg}
                     fg={T.line}
                     style={[styles.cardImage, isMobile && styles.cardImageMobile]}
                  />
               </Pressable>

               <Pressable
                  onPress={() => onToggle(item.id!)}
                  style={styles.checkboxOverlay}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel="Seleccionar prenda"
               >
                  {isSelected
                     ? <CheckSquare size={20} color={T.ink} />
                     : <Square size={20} color={T.inkSoft} />}
               </Pressable>

               {item.images && item.images.length > 1 && (
                  <View style={styles.multiImgBadge}>
                     <Text style={styles.multiImgText}>1/{item.images.length}</Text>
                  </View>
               )}
            </View>

            <View style={styles.cardBody}>
               <Text style={styles.brand} numberOfLines={1}>{item.brand || 'SIN MARCA'}</Text>
               <Text style={styles.name} numberOfLines={2}>{item.name}</Text>

               <View style={styles.metaRow}>
                  <Text style={styles.code} numberOfLines={1}>{item.code}</Text>
                  {variants.length > 0 && (
                     <View style={styles.dots}>
                        {variants.slice(0, 5).map((v, i) => (
                           <View key={i} style={[styles.dot, { backgroundColor: getColorHex(v.color || '') }]} />
                        ))}
                     </View>
                  )}
                  <Text style={styles.variantCount}>{variants.length} color(es)</Text>
               </View>
            </View>
         </View>

         {/* Bloque de stock/precio/acciones.
             En móvil: 2 filas (stock+precio / acciones). En desktop: 1 fila. */}
         <View style={[styles.side, isMobile && styles.sideMobile]}>
            <View style={[styles.sideGroup, isMobile && styles.sideGroupMobile]}>
               <Pressable
                  style={({ pressed }) => [
                     styles.stock,
                     isMobile && styles.stockMobile,
                     low && styles.stockLow,
                     out && styles.stockOut,
                     pressed && styles.pressed,
                  ]}
                  onPress={() => (isSelectionModeActive ? onToggle(item.id!) : onAdjustStock(item))}
                  accessibilityLabel="Ajustar stock"
               >
                  <Text style={styles.stockLabel}>Stock</Text>
                  {out ? (
                     <Text style={[styles.stockEmptyText, isMobile && styles.stockEmptyTextMobile]}>AGOTADO</Text>
                  ) : (
                     <Text style={[styles.stockNum, isMobile && styles.stockNumMobile]}>
                        {totalStock}
                        <Text style={styles.stockUnit}> uds.</Text>
                     </Text>
                  )}
               </Pressable>

               <Text style={[styles.price, isMobile && styles.priceMobile]}>
                  ${Number(item.price).toFixed(2)}
               </Text>
            </View>

            <View style={[styles.actions, isMobile && styles.actionsMobile]}>
               <Pressable
                  style={({ pressed }) => [styles.actionBtn, isMobile && styles.actionBtnMobile, pressed && styles.pressed]}
                  onPress={() => { if (!isSelectionModeActive) onShare(item); }}
                  accessibilityLabel="Compartir producto"
               >
                  <MessageCircle size={17} color={isSelectionModeActive ? T.inkMute : T.inkSoft} />
               </Pressable>

               <Pressable
                  style={({ pressed }) => [styles.actionBtn, isMobile && styles.actionBtnMobile, pressed && styles.pressed]}
                  onPress={() => { if (!isSelectionModeActive) onAdjustStock(item); }}
                  accessibilityLabel="Ajustar stock"
               >
                  <Layers size={17} color={isSelectionModeActive ? T.inkMute : T.ink} />
               </Pressable>

               <Pressable
                  style={({ pressed }) => [styles.actionBtn, isMobile && styles.actionBtnMobile, pressed && styles.pressed]}
                  onPress={() => { if (!isSelectionModeActive) onEdit(item); }}
                  accessibilityLabel="Editar producto"
               >
                  <Pencil size={17} color={isSelectionModeActive ? T.inkMute : T.inkSoft} />
               </Pressable>

               <Pressable
                  style={({ pressed }) => [styles.actionBtn, isMobile && styles.actionBtnMobile, pressed && styles.pressed]}
                  onPress={() => { if (!isSelectionModeActive) onDelete(item); }}
                  accessibilityLabel="Eliminar producto"
               >
                  <Trash2 size={17} color={T.inkMute} />
               </Pressable>
            </View>
         </View>
      </Pressable>
   );
}, (prev, next) =>
   prev.item === next.item &&
   prev.isSelected === next.isSelected &&
   prev.isSelectionModeActive === next.isSelectionModeActive &&
   prev.isMobile === next.isMobile
);

// ==========================================
// PANTALLA PRINCIPAL
// ==========================================
export const InventoryListScreen = () => {
   const { width, height } = useWindowDimensions();
   const insets = useSafeAreaInsets();
   const isMobile = width < 600;
   const isCompact = width < 380;

   // En web, el navegador tapa la parte inferior; sumamos buffer.
   const bottomPadding = Math.max(insets.bottom, WEB_BOTTOM_BUFFER);

   const [products, setProducts] = useState<Product[]>([]);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [sharingProduct, setSharingProduct] = useState<Product | null>(null);
   const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
   const [isFormOpen, setIsFormOpen] = useState(false);
   const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
   const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
   const [bulkShareStatus, setBulkShareStatus] = useState<string | null>(null);

   // Visor de imágenes
   const [previewImages, setPreviewImages] = useState<string[] | null>(null);
   const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

   // Selección y paginación
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const [currentPage, setCurrentPage] = useState(1);
   const [filters, setFilters] = useState<FilterOptions>({
      query: '', category: 'all', brand: '', color: '', size: '', status: 'all',
   });

   useEffect(() => {
      const unsubscribe = subscribeToProducts((data) => {
         setProducts(data);
         if (adjustingProduct) {
            const updated = data.find((p) => p.id === adjustingProduct.id);
            if (updated) setAdjustingProduct(updated);
         }
      });
      return () => unsubscribe();
   }, [adjustingProduct?.id]);

   const handleFilterChange = useCallback((newFilters: FilterOptions) => {
      setFilters(newFilters);
      setCurrentPage(1);
   }, []);

   const toggleSelection = useCallback((id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
   }, []);

   const availableCategories = useMemo(
      () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
      [products]
   );
   const availableBrands = useMemo(
      () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))),
      [products]
   );
   const availableSizes = useMemo(
      () => Array.from(new Set(products.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))))),
      [products]
   );

   const filteredProducts = useMemo(() => filterProducts(products, filters), [products, filters]);
   const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)), [filteredProducts.length]);
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = useMemo(
      () => filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE),
      [filteredProducts, startIndex]
   );
   const selectedProductsObjects = useMemo(
      () => products.filter(p => selectedIds.includes(p.id!)),
      [products, selectedIds]
   );

   const isSelectionModeActive = selectedIds.length > 0;

   const toggleSelectAll = useCallback(() => {
      if (selectedIds.length === filteredProducts.length) {
         setSelectedIds([]);
      } else {
         setSelectedIds(filteredProducts.map(p => p.id!));
      }
   }, [selectedIds.length, filteredProducts]);

   const handleEditItem = useCallback((product: Product) => { setSelectedProduct(product); setIsFormOpen(true); }, []);
   const handleAdjustStockItem = useCallback((product: Product) => { setAdjustingProduct(product); }, []);
   const handleShareItem = useCallback((product: Product) => { setSharingProduct(product); }, []);

   const handleImagePress = useCallback((images: string[]) => {
      setPreviewImages(images && images.length > 0 ? images : ['https://via.placeholder.com/800']);
      setCurrentPreviewIndex(0);
   }, []);

   const handleDeleteItem = useCallback((product: Product) => {
      showConfirm('Eliminar', `¿Borrar "${product.name}"?`, async () => { await deleteProduct(product); });
   }, []);

   const handleDeleteMulti = () => {
      showConfirm(
         'Borrado Masivo',
         `¿Eliminar ${selectedIds.length} prendas permanentemente?`,
         async () => {
            await Promise.all(selectedProductsObjects.map(p => deleteProduct(p)));
            setSelectedIds([]);
            showAlert('Eliminadas', 'Las prendas fueron borradas.');
         }
      );
   };

   const goToNextPreview = useCallback(() => {
      if (!previewImages) return;
      setCurrentPreviewIndex(prev => Math.min(prev + 1, previewImages.length - 1));
   }, [previewImages]);

   const goToPrevPreview = useCallback(() => {
      setCurrentPreviewIndex(prev => Math.max(prev - 1, 0));
   }, []);

   const panResponder = useMemo(
      () =>
         PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) =>
               Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
            onPanResponderRelease: (_, g) => {
               if (g.dx < -50) goToNextPreview();
               else if (g.dx > 50) goToPrevPreview();
            },
         }),
      [goToNextPreview, goToPrevPreview]
   );

   const padX = isMobile ? 14 : 22;

   // ==========================================
   // HEADER (título + botones o bulk bar)
   // ==========================================
   const renderHeader = () => (
      <View>
         {isSelectionModeActive ? (
            <View style={[styles.bulkBar, { marginHorizontal: padX, marginTop: 16, marginBottom: 12 }]}>
               <View style={styles.bulkLeft}>
                  <Pressable onPress={() => setSelectedIds([])} style={styles.bulkCloseBtn} accessibilityLabel="Cancelar selección">
                     <X size={18} color={T.onBar} />
                  </Pressable>
                  <Text style={styles.bulkCount}>{selectedIds.length} seleccionadas</Text>
               </View>
               <View style={styles.bulkRight}>
                  <Pressable
                     style={({ pressed }) => [styles.bulkIconBtn, pressed && styles.pressed]}
                     onPress={() => advancedBulkNativeShare(selectedProductsObjects, setBulkShareStatus)}
                     accessibilityLabel="Compartir selección"
                  >
                     <Share2 size={16} color={T.onBar} />
                  </Pressable>
                  <Pressable
                     style={({ pressed }) => [styles.bulkPrimaryBtn, pressed && styles.pressed]}
                     onPress={() => setIsBulkModalOpen(true)}
                  >
                     <Zap size={14} color={T.solid} />
                     {!isCompact && <Text style={styles.bulkPrimaryText}>Actualizar</Text>}
                  </Pressable>
                  <Pressable
                     style={({ pressed }) => [styles.bulkDangerBtn, pressed && styles.pressed]}
                     onPress={handleDeleteMulti}
                     accessibilityLabel="Eliminar selección"
                  >
                     <Trash2 size={16} color="#FECACA" />
                  </Pressable>
               </View>
            </View>
         ) : (
            <View style={[styles.topActions, { paddingHorizontal: padX }, isMobile && styles.topActionsMobile]}>
               <View style={styles.heading}>
                  <Text style={[styles.title, isMobile && styles.titleMobile]}>
                     JDSTORE<Text style={styles.titleSub}> / INVENTARIO</Text>
                  </Text>
                  <Text style={styles.productCount}>
                     {filteredProducts.length} prendas encontradas
                  </Text>
               </View>

               <View style={[styles.headerButtons, isMobile && styles.headerButtonsMobile]}>
                  <Pressable
                     style={({ pressed }) => [styles.printBtn, isCompact && styles.compactButton, pressed && styles.pressed]}
                     onPress={() => setIsPrintModalOpen(true)}
                  >
                     <Printer size={17} color={T.ink} />
                     {!isCompact && <Text style={styles.printBtnText}>Catálogo PDF</Text>}
                  </Pressable>

                  <Pressable
                     style={({ pressed }) => [styles.newBtn, isCompact && styles.compactButton, pressed && styles.pressed]}
                     onPress={() => { setSelectedProduct(null); setIsFormOpen(true); }}
                  >
                     <Plus size={18} color={T.onSolid} />
                     {!isCompact && <Text style={styles.newBtnText}>Nueva prenda</Text>}
                  </Pressable>
               </View>
            </View>
         )}

         <View style={{ paddingHorizontal: padX, marginBottom: 12 }}>
            <ProductSearchFilter
               filters={filters}
               onFilterChange={handleFilterChange}
               availableCategories={availableCategories}
               availableBrands={availableBrands}
               availableSizes={availableSizes}
            />
            <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
               {isSelectionModeActive && selectedIds.length === filteredProducts.length
                  ? <CheckSquare size={16} color={T.ink} />
                  : <Square size={16} color={T.inkMute} />}
               <Text style={styles.selectAllText}>Seleccionar todas las filtradas</Text>
            </Pressable>
         </View>
      </View>
   );

   return (
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
         {bulkShareStatus && (
            <View style={styles.bulkShareOverlay}>
               <ActivityIndicator size="large" color={T.onBar} />
               <Text style={styles.bulkShareText}>{bulkShareStatus}</Text>
            </View>
         )}

         <FlatList
            style={styles.list}
            data={paginatedProducts}
            keyExtractor={(item) => item.id || item.code}
            ListHeaderComponent={renderHeader()}
            contentContainerStyle={[
               styles.listContent,
               { paddingHorizontal: padX },
               paginatedProducts.length === 0 && styles.emptyList,
            ]}
            showsVerticalScrollIndicator
            renderItem={({ item }) => (
               <ProductListItem
                  item={item}
                  isSelected={selectedIds.includes(item.id!)}
                  isSelectionModeActive={isSelectionModeActive}
                  isMobile={isMobile}
                  onToggle={toggleSelection}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onAdjustStock={handleAdjustStockItem}
                  onShare={handleShareItem}
                  onImagePress={handleImagePress}
               />
            )}
            ListEmptyComponent={
               <View style={styles.emptyState}>
                  <Layers size={30} color={T.inkMute} />
                  <Text style={styles.emptyTitle}>Sin resultados</Text>
                  <Text style={styles.emptyText}>
                     No hay prendas que coincidan con los filtros seleccionados.
                  </Text>
               </View>
            }
         />

         {totalPages > 1 && (
            <View style={styles.paginationBar}>
               <View style={[styles.inner, styles.pageRow, { paddingHorizontal: padX }]}>
                  <Pressable
                     style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavDisabled]}
                     disabled={currentPage === 1}
                     onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                     <ChevronLeft size={18} color={T.ink} />
                     {!isCompact && <Text style={styles.pageNavText}>Anterior</Text>}
                  </Pressable>

                  <Text style={styles.pageIndicator}>
                     <Text style={styles.pageNumber}>{currentPage}</Text>
                     {' / '}
                     {totalPages}
                  </Text>

                  <Pressable
                     style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavDisabled]}
                     disabled={currentPage === totalPages}
                     onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                     {!isCompact && <Text style={styles.pageNavText}>Siguiente</Text>}
                     <ChevronRight size={18} color={T.ink} />
                  </Pressable>
               </View>
            </View>
         )}

         {/* VISOR DE IMÁGENES */}
         <Modal visible={!!previewImages} transparent animationType="fade">
            <View style={styles.imageViewerContainer}>
               <Pressable style={styles.closeViewerBtn} onPress={() => setPreviewImages(null)}>
                  <X size={28} color={T.onBar} />
               </Pressable>

               {previewImages && previewImages.length > 1 && currentPreviewIndex > 0 && (
                  <Pressable style={styles.navButtonLeft} onPress={goToPrevPreview}>
                     <ChevronLeft size={40} color={T.onBar} />
                  </Pressable>
               )}

               {previewImages && previewImages.length > 1 && currentPreviewIndex < previewImages.length - 1 && (
                  <Pressable style={styles.navButtonRight} onPress={goToNextPreview}>
                     <ChevronRight size={40} color={T.onBar} />
                  </Pressable>
               )}

               {previewImages && (
                  <View style={[styles.viewerPage, { width, height }]} {...panResponder.panHandlers}>
                     <Image
                        source={{ uri: previewImages[currentPreviewIndex] }}
                        style={styles.viewerImage}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={150}
                     />
                  </View>
               )}

               {previewImages && previewImages.length > 1 && (
                  <View style={styles.viewerIndicator}>
                     <Text style={styles.viewerIndicatorText}>
                        {currentPreviewIndex + 1} de {previewImages.length}
                     </Text>
                  </View>
               )}
            </View>
         </Modal>

         <Modal visible={isFormOpen} animationType="slide" onRequestClose={() => setIsFormOpen(false)}>
            <ProductFormScreen initialProduct={selectedProduct} onClose={() => setIsFormOpen(false)} />
         </Modal>

         <StockAdjustModal
            product={adjustingProduct}
            visible={!!adjustingProduct}
            onClose={() => setAdjustingProduct(null)}
         />
         <ProductShareModal
            product={sharingProduct}
            visible={!!sharingProduct}
            onClose={() => setSharingProduct(null)}
         />
         <CatalogPrintModal
            products={filteredProducts}
            visible={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            activeCategoryName={filters.category}
         />
         <BulkUpdateModal
            visible={isBulkModalOpen}
            selectedProducts={selectedProductsObjects}
            onClose={() => setIsBulkModalOpen(false)}
            onComplete={() => { setIsBulkModalOpen(false); setSelectedIds([]); }}
         />
      </View>
   );
};

const btn = {
   flexDirection: 'row' as const,
   alignItems: 'center' as const,
   justifyContent: 'center' as const,
   height: 44,
   paddingHorizontal: 16,
   borderRadius: 10,
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   inner: { width: '100%', maxWidth: MAX, alignSelf: 'center' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   // Encabezado
   topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, paddingTop: 24, paddingBottom: 18 },
   topActionsMobile: { paddingTop: 18, paddingBottom: 14, alignItems: 'flex-start' },
   heading: { flex: 1, minWidth: 160, gap: 4 },
   title: { ...display, fontSize: 46, lineHeight: 44, fontWeight: '800', color: T.ink, textTransform: 'uppercase' },
   titleMobile: { fontSize: 34, lineHeight: 33 },
   titleSub: { color: T.inkMute },
   productCount: { color: T.inkSoft, fontSize: 13 },
   headerButtons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
   headerButtonsMobile: { width: '100%', justifyContent: 'flex-end' },
   printBtn: { ...btn, gap: 8, borderWidth: 1, borderColor: T.line },
   printBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   newBtn: { ...btn, gap: 8, backgroundColor: T.solid },
   newBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
   compactButton: { minWidth: 44, paddingHorizontal: 13 },

   // Bulk bar
   bulkBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: T.bar, borderRadius: 12 },
   bulkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
   bulkCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8 },
   bulkCount: { ...display, color: T.onBar, fontSize: 16, fontWeight: '800', textTransform: 'uppercase' },
   bulkRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   bulkIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8 },
   bulkPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, backgroundColor: T.onBar, borderRadius: 8 },
   bulkPrimaryText: { fontSize: 12, fontWeight: '800', color: T.solid },
   bulkDangerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(220,38,38,0.6)', backgroundColor: 'rgba(127,29,29,0.55)', borderRadius: 8 },

   // Select all
   selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 4 },
   selectAllText: { fontSize: 12, color: T.inkSoft, fontWeight: '700', textTransform: 'uppercase' },

   // Lista
   list: { flex: 1 },
   listContent: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 8, paddingBottom: 32, gap: 8, flexGrow: 1 },
   emptyList: { justifyContent: 'center' },

   // Card
   card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, paddingRight: 16, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
   cardMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingRight: 12 },
   cardSelected: { borderColor: T.ink, backgroundColor: T.bg },
   main: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
   imageWrapper: { position: 'relative' },
   cardImage: { width: 72, height: 90, borderRadius: 8 },
   cardImageMobile: { width: 64, height: 80 },
   checkboxOverlay: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: 2 },
   multiImgBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
   multiImgText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
   cardBody: { flex: 1, minWidth: 0, gap: 3 },
   brand: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   name: { fontSize: 16, fontWeight: '700', color: T.ink, lineHeight: 21 },
   metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
   code: { fontSize: 12, color: T.inkMute, fontWeight: '600' },
   dots: { flexDirection: 'row', gap: 4 },
   dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' },
   variantCount: { fontSize: 12, color: T.inkMute, fontWeight: '600' },

   // Side (desktop: fila única / móvil: 2 filas)
   side: { flexDirection: 'row', alignItems: 'center', gap: 18 },
   sideMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line, width: '100%' },
   sideGroup: { flexDirection: 'row', alignItems: 'center', gap: 18 },
   sideGroupMobile: { justifyContent: 'space-between', gap: 12, width: '100%' },
   stock: { minWidth: 88, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: T.line },
   stockMobile: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 8 },
   stockLow: { borderColor: T.ink },
   stockOut: { borderStyle: 'dashed' },
   stockLabel: { fontSize: 10, fontWeight: '600', color: T.inkMute },
   stockNum: { ...display, fontSize: 34, lineHeight: 34, fontWeight: '800', color: T.ink },
   stockNumMobile: { fontSize: 26, lineHeight: 26 },
   stockUnit: { fontSize: 14, fontWeight: '600', color: T.inkMute },
   stockEmptyText: { fontSize: 13, fontWeight: '800', color: T.inkMute, lineHeight: 34 },
   stockEmptyTextMobile: { fontSize: 12, lineHeight: 26 },
   price: { ...display, fontSize: 28, lineHeight: 28, fontWeight: '800', color: T.ink, minWidth: 84, textAlign: 'right' },
   priceMobile: { flex: 1, minWidth: 0, fontSize: 24, lineHeight: 26, textAlign: 'right', paddingRight: 4 },
   actions: { flexDirection: 'row', gap: 6 },
   actionsMobile: { width: '100%', gap: 8 },
   actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10 },
   actionBtnMobile: { flex: 1, height: 44 },

   // Paginación
   paginationBar: { borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 10, backgroundColor: T.bg },
   pageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 8 },
   pageNavDisabled: { opacity: 0.3 },
   pageNavText: { fontSize: 13, fontWeight: '700', color: T.ink },
   pageIndicator: { ...display, fontSize: 24, fontWeight: '700', color: T.inkMute },
   pageNumber: { color: T.ink },

   // Empty
   emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
   emptyTitle: { ...display, fontSize: 32, fontWeight: '800', color: T.ink, textTransform: 'uppercase' },
   emptyText: { color: T.inkMute, fontSize: 13, textAlign: 'center', lineHeight: 19 },

   // Overlay de bulk share
   bulkShareOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,10,0.9)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
   bulkShareText: { color: T.onBar, marginTop: 12, fontSize: 15, fontWeight: '800', textTransform: 'uppercase' },

   // Visor de imágenes
   imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', width: '100%', height: '100%', position: 'relative' },
   closeViewerBtn: { position: 'absolute', top: 30, right: 20, zIndex: 20, padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22 },
   navButtonLeft: { position: 'absolute', left: 20, top: '50%', marginTop: -25, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },
   navButtonRight: { position: 'absolute', right: 20, top: '50%', marginTop: -25, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },
   viewerPage: { justifyContent: 'center', alignItems: 'center', padding: 20 },
   viewerImage: { width: '100%', height: '100%', flex: 1, maxWidth: 900 },
   viewerIndicator: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
   viewerIndicatorText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
});

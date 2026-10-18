import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
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

const ITEMS_PER_PAGE = 10;

const calculateTotalStock = (p: Product) => (p.variants || []).reduce((acc, v) => acc + (v.sizes || []).reduce((a, s) => a + (Number(s.stock) || 0), 0), 0);

// ==========================================
// COMPONENTE TARJETA MEMOIZADO
// ==========================================
interface ProductListItemProps {
   item: Product;
   isSelected: boolean;
   isSelectionModeActive: boolean;
   onToggle: (id: string) => void;
   onEdit: (product: Product) => void;
   onDelete: (product: Product) => void;
   onAdjustStock: (product: Product) => void;
   onShare: (product: Product) => void;
   onImagePress: (images: string[]) => void;
}

const ProductListItem = memo(({ item, isSelected, isSelectionModeActive, onToggle, onEdit, onDelete, onAdjustStock, onShare, onImagePress }: ProductListItemProps) => {
   const totalStock = calculateTotalStock(item);

   const handleCardPress = () => {
      if (isSelectionModeActive) onToggle(item.id!);
   };

   return (
      <TouchableOpacity
         activeOpacity={0.8}
         onLongPress={() => onToggle(item.id!)}
         onPress={handleCardPress}
         style={[styles.card, isSelected && styles.cardSelected]}
      >
         <TouchableOpacity style={styles.checkboxArea} onPress={() => onToggle(item.id!)}>
            {isSelected ? <CheckSquare size={20} color="#2563eb" /> : <Square size={20} color="#cbd5e1" />}
         </TouchableOpacity>

         <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onImagePress(item.images)}
            style={styles.imageWrapper}
         >
            <Image
               source={{ uri: item.images[0] || 'https://via.placeholder.com/100' }}
               style={styles.cardImage}
               contentFit="cover"
               cachePolicy="memory-disk"
            />
            {item.images.length > 1 && (
               <View style={styles.multiImgBadge}>
                  <Text style={styles.multiImgText}>1/{item.images.length}</Text>
               </View>
            )}
         </TouchableOpacity>

         <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
               <Text style={styles.brand}>{item.brand}</Text>
               <Text style={styles.code}>{item.code}</Text>
            </View>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
            <View style={styles.stockBadgeContainer}>
               <TouchableOpacity
                  style={[styles.stockBadge, totalStock === 0 ? styles.stockEmpty : styles.stockAvailable]}
                  onPress={() => {
                     if (!isSelectionModeActive) onAdjustStock(item);
                     else onToggle(item.id!);
                  }}
               >
                  <Layers size={12} color={totalStock === 0 ? '#ef4444' : '#16a34a'} style={{ marginRight: 4 }} />
                  <Text style={styles.stockText}>{totalStock === 0 ? 'AGOTADO' : `Stock: ${totalStock} uds.`}</Text>
               </TouchableOpacity>
               <Text style={styles.variantCount}>{(item.variants || []).length} color(es)</Text>
            </View>
         </View>

         <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtnShare} onPress={() => { if (!isSelectionModeActive) onShare(item); }}>
               <MessageCircle size={16} color={isSelectionModeActive ? "#9ca3af" : "#25d366"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnQuickStock} onPress={() => { if (!isSelectionModeActive) onAdjustStock(item); }}>
               <Layers size={16} color={isSelectionModeActive ? "#9ca3af" : "#2563eb"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => { if (!isSelectionModeActive) onEdit(item); }}>
               <Pencil size={16} color={isSelectionModeActive ? "#9ca3af" : "#475569"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => { if (!isSelectionModeActive) onDelete(item); }}>
               <Trash2 size={16} color={isSelectionModeActive ? "#fca5a5" : "#ef4444"} />
            </TouchableOpacity>
         </View>
      </TouchableOpacity>
   );
}, (prevProps, nextProps) => {
   return (
      prevProps.item === nextProps.item &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isSelectionModeActive === nextProps.isSelectionModeActive
   );
});

// ==========================================
// PANTALLA PRINCIPAL
// ==========================================
export const InventoryListScreen = () => {
   const { width: windowWidth, height: windowHeight } = useWindowDimensions();

   const [products, setProducts] = useState<Product[]>([]);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [sharingProduct, setSharingProduct] = useState<Product | null>(null);
   const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
   const [isFormOpen, setIsFormOpen] = useState(false);
   const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
   const [bulkShareStatus, setBulkShareStatus] = useState<string | null>(null);

   // ESTADOS DEL VISOR DE IMÁGENES
   const [previewImages, setPreviewImages] = useState<string[] | null>(null);
   const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
   const viewerListRef = useRef<FlatList>(null);

   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
   const [currentPage, setCurrentPage] = useState(1);
   const [filters, setFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });

   useEffect(() => {
      const unsubscribe = subscribeToProducts((data) => {
         setProducts(data);
         if (adjustingProduct) { const updated = data.find((p) => p.id === adjustingProduct.id); if (updated) setAdjustingProduct(updated); }
      });
      return () => unsubscribe();
   }, [adjustingProduct?.id]);

   const handleFilterChange = useCallback((newFilters: FilterOptions) => { setFilters(newFilters); setCurrentPage(1); }, []);

   const toggleSelection = useCallback((id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
   }, []);

   const availableCategories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);
   const availableBrands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))), [products]);
   const availableSizes = useMemo(() => Array.from(new Set(products.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))))), [products]);

   const filteredProducts = useMemo(() => filterProducts(products, filters), [products, filters]);
   const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)), [filteredProducts.length]);
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = useMemo(() => filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE), [filteredProducts, startIndex]);
   const selectedProductsObjects = useMemo(() => products.filter(p => selectedIds.includes(p.id!)), [products, selectedIds]);

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
      showConfirm('Borrado Masivo', `¿Eliminar ${selectedIds.length} prendas permanentemente?`, async () => {
         await Promise.all(selectedProductsObjects.map(p => deleteProduct(p)));
         setSelectedIds([]);
         showAlert('Eliminadas', 'Las prendas fueron borradas.');
      });
   };

   // NAVEGACIÓN DEL VISOR DE IMÁGENES
   const goToNextPreview = () => {
      if (previewImages && currentPreviewIndex < previewImages.length - 1) {
         viewerListRef.current?.scrollToIndex({ index: currentPreviewIndex + 1, animated: true });
         setCurrentPreviewIndex(prev => prev + 1);
      }
   };

   const goToPrevPreview = () => {
      if (previewImages && currentPreviewIndex > 0) {
         viewerListRef.current?.scrollToIndex({ index: currentPreviewIndex - 1, animated: true });
         setCurrentPreviewIndex(prev => prev - 1);
      }
   };

   // Detectar cambio de foto cuando se desliza en móvil
   const onViewRef = useRef((info: any) => {
      if (info.viewableItems.length > 0) {
         setCurrentPreviewIndex(info.viewableItems[0].index);
      }
   });
   const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

   const isSelectionModeActive = selectedIds.length > 0;

   return (
      <View style={styles.container}>
         {bulkShareStatus && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }]}>
               <ActivityIndicator size="large" color="#ffffff" />
               <Text style={{ color: '#fff', marginTop: 12, fontSize: 16, fontWeight: 'bold' }}>{bulkShareStatus}</Text>
            </View>
         )}

         {isSelectionModeActive ? (
            <View style={styles.bulkActionBar}>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setSelectedIds([])} style={{ marginRight: 12 }}>
                     <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.bulkCountText}>{selectedIds.length} selecc.</Text>
               </View>
               <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.bulkBtnShare} onPress={() => advancedBulkNativeShare(selectedProductsObjects, setBulkShareStatus)}>
                     <Share2 size={14} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bulkBtn} onPress={() => setIsBulkModalOpen(true)}>
                     <Zap size={14} color="#0f172a" /><Text style={styles.bulkBtnText}>Actualizar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bulkBtnDelete} onPress={handleDeleteMulti}>
                     <Trash2 size={14} color="#ffffff" />
                  </TouchableOpacity>
               </View>
            </View>
         ) : (
            <View style={styles.topActions}>
               <Text style={styles.productCount}>{filteredProducts.length} prendas encontradas</Text>
               <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.printBtn} onPress={() => setIsPrintModalOpen(true)}>
                     <Printer size={15} color="#2563eb" style={{ marginRight: 4 }} />
                     <Text style={styles.printBtnText}>Catálogo PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.newBtn} onPress={() => { setSelectedProduct(null); setIsFormOpen(true); }}>
                     <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
                     <Text style={styles.newBtnText}>Nueva Prenda</Text>
                  </TouchableOpacity>
               </View>
            </View>
         )}

         <View style={styles.filterSection}>
            <ProductSearchFilter filters={filters} onFilterChange={handleFilterChange} availableCategories={availableCategories} availableBrands={availableBrands} availableSizes={availableSizes} />
            <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
               {isSelectionModeActive && selectedIds.length === filteredProducts.length ? <CheckSquare size={18} color="#2563eb" /> : <Square size={18} color="#94a3b8" />}
               <Text style={styles.selectAllText}>Seleccionar todas filtradas</Text>
            </TouchableOpacity>
         </View>

         <FlatList
            data={paginatedProducts}
            keyExtractor={(item) => item.id || item.code}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
               <ProductListItem
                  item={item}
                  isSelected={selectedIds.includes(item.id!)}
                  isSelectionModeActive={isSelectionModeActive}
                  onToggle={toggleSelection}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onAdjustStock={handleAdjustStockItem}
                  onShare={handleShareItem}
                  onImagePress={handleImagePress}
               />
            )}
         />

         {totalPages > 1 && (
            <View style={styles.paginationBar}>
               <TouchableOpacity style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]} disabled={currentPage === 1} onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft size={18} color={currentPage === 1 ? '#94a3b8' : '#0f172a'} /><Text style={[styles.pageNavText, currentPage === 1 && styles.pageNavTextDisabled]}>Anterior</Text>
               </TouchableOpacity>
               <Text style={styles.pageIndicator}>Pág <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{currentPage}</Text> de {totalPages}</Text>
               <TouchableOpacity style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]} disabled={currentPage === totalPages} onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                  <Text style={[styles.pageNavText, currentPage === totalPages && styles.pageNavTextDisabled]}>Siguiente</Text><ChevronRight size={18} color={currentPage === totalPages ? '#94a3b8' : '#0f172a'} />
               </TouchableOpacity>
            </View>
         )}

         {/* VISOR DE IMÁGENES REPARADO Y CON BOTONES WEB */}
         <Modal visible={!!previewImages} transparent animationType="fade">
            <View style={styles.imageViewerContainer}>
               <TouchableOpacity style={styles.closeViewerBtn} onPress={() => setPreviewImages(null)}>
                  <X size={28} color="#ffffff" />
               </TouchableOpacity>

               {/* Controles web/click */}
               {previewImages && previewImages.length > 1 && currentPreviewIndex > 0 && (
                  <TouchableOpacity style={styles.navButtonLeft} onPress={goToPrevPreview}>
                     <ChevronLeft size={40} color="#ffffff" />
                  </TouchableOpacity>
               )}

               {previewImages && previewImages.length > 1 && currentPreviewIndex < previewImages.length - 1 && (
                  <TouchableOpacity style={styles.navButtonRight} onPress={goToNextPreview}>
                     <ChevronRight size={40} color="#ffffff" />
                  </TouchableOpacity>
               )}

               {previewImages && (
                  <FlatList
                     ref={viewerListRef}
                     data={previewImages}
                     horizontal
                     pagingEnabled
                     showsHorizontalScrollIndicator={false}
                     keyExtractor={(_, index) => index.toString()}
                     onViewableItemsChanged={onViewRef.current}
                     viewabilityConfig={viewConfigRef.current}
                     renderItem={({ item }) => (
                        <View style={[styles.viewerPage, { width: windowWidth, height: windowHeight }]}>
                           <Image
                              source={{ uri: item }}
                              style={styles.viewerImage}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                           />
                        </View>
                     )}
                  />
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

         <Modal visible={isFormOpen} animationType="slide"><ProductFormScreen initialProduct={selectedProduct} onClose={() => setIsFormOpen(false)} /></Modal>
         <StockAdjustModal product={adjustingProduct} visible={!!adjustingProduct} onClose={() => setAdjustingProduct(null)} />
         <ProductShareModal product={sharingProduct} visible={!!sharingProduct} onClose={() => setSharingProduct(null)} />
         <CatalogPrintModal products={filteredProducts} visible={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} activeCategoryName={filters.category} />
         <BulkUpdateModal visible={isBulkModalOpen} selectedProducts={selectedProductsObjects} onClose={() => setIsBulkModalOpen(false)} onComplete={() => { setIsBulkModalOpen(false); setSelectedIds([]); }} />
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   bulkActionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#1e293b', elevation: 4 },
   bulkCountText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
   bulkBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fcd34d', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
   bulkBtnText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginLeft: 6 },
   bulkBtnDelete: { backgroundColor: '#ef4444', padding: 8, borderRadius: 8, justifyContent: 'center' },
   bulkBtnShare: { backgroundColor: '#25d366', padding: 8, borderRadius: 8, justifyContent: 'center' },
   topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   productCount: { fontSize: 13, fontWeight: '600', color: '#475569' },
   printBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
   printBtnText: { color: '#2563eb', fontWeight: 'bold', fontSize: 12 },
   newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
   newBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
   filterSection: { paddingHorizontal: 16, paddingTop: 12 },
   selectAllRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6, gap: 8 },
   selectAllText: { fontSize: 13, color: '#475569', fontWeight: 'bold' },
   listContent: { padding: 16, gap: 12 },
   card: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
   cardSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
   checkboxArea: { paddingRight: 10, paddingVertical: 10 },
   imageWrapper: { position: 'relative' },
   cardImage: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#f1f5f9' },
   multiImgBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
   multiImgText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
   cardBody: { flex: 1, marginLeft: 12 },
   cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginRight: 8 },
   brand: { fontSize: 11, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' },
   code: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
   name: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginVertical: 2 },
   price: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
   stockBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
   stockBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
   stockAvailable: { backgroundColor: '#dcfce7' },
   stockEmpty: { backgroundColor: '#fee2e2' },
   stockText: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
   variantCount: { fontSize: 11, color: '#64748b' },
   actionButtons: { gap: 6 },
   actionBtnShare: { padding: 8, backgroundColor: '#f0fdf4', borderRadius: 6 },
   actionBtnQuickStock: { padding: 8, backgroundColor: '#eff6ff', borderRadius: 6 },
   actionBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 6 },
   paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 12 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4 },
   pageNavBtnDisabled: { opacity: 0.4 },
   pageNavText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   pageNavTextDisabled: { color: '#94a3b8' },
   pageIndicator: { fontSize: 13, color: '#475569' },

   imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', width: '100%', height: '100%', position: 'relative' },
   closeViewerBtn: { position: 'absolute', top: 30, right: 20, zIndex: 20, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
   navButtonLeft: { position: 'absolute', left: 20, top: '50%', marginTop: -25, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },
   navButtonRight: { position: 'absolute', right: 20, top: '50%', marginTop: -25, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },
   viewerPage: { justifyContent: 'center', alignItems: 'center', padding: 20 },
   viewerImage: { width: '100%', height: '100%', flex: 1, maxWidth: 900 },
   viewerIndicator: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
   viewerIndicatorText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
});

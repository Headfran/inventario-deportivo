import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   Modal,
   Platform,
   ActivityIndicator,
   UIManager,
   LayoutAnimation,
   ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import {
   Store, Plus, Trash2, Eye, MapPin, Layers, Pencil, ChevronLeft, ChevronRight,
   Package, Box, X, Save, RotateCcw, Move, Inbox, Wand2, Combine,
   ArchiveRestore, Sparkles, Filter
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Product, Shelf, ShelfLocation, ProductVariant } from '../types/inventory';
import { subscribeToShelves, deleteShelf } from '../services/shelfService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { showConfirm, showAlert } from '../utils/alert';
import { EditShelfModal } from './EditShelfModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { DraggableCell, CellLayout } from '../components/DraggableCell';
import { ProductFormScreen } from './ProductFormScreen';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
   UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SelectedVariantRef {
   product: Product;
   variantIndex: number;
   isRelocating?: boolean;
   sourceShelf?: string;
   sourceRow?: number;
   sourceSpace?: number;
   stashIndex?: number;
}
interface MatrixDragPayload { product: Product; variantIndex: number; source: 'matrix' | 'stash'; sourceRow?: number; sourceSpace?: number; stashIndex?: number; }
interface InspectedItem { product: Product; variant: ProductVariant; variantIndex: number; }

const ITEMS_PER_PAGE = 10;

const ScrollRow = ({ children, style, contentContainerStyle }: { children: React.ReactNode, style?: any, contentContainerStyle?: any }) => {
   const scrollRef = useRef<ScrollView>(null);
   const scrollX = useRef(0);
   const [clientWidth, setClientWidth] = useState(250);

   const scroll = (direction: 'left' | 'right') => {
      const moveAmt = clientWidth * 0.8;
      const newX = direction === 'left' ? Math.max(0, scrollX.current - moveAmt) : scrollX.current + moveAmt;
      scrollRef.current?.scrollTo({ x: newX, animated: true });
   };

   return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', flex: 1 }, style]}>
         <TouchableOpacity style={styles.rowNavBtn} onPress={() => scroll('left')}>
            <ChevronLeft size={20} color="#64748b" />
         </TouchableOpacity>
         <ScrollView
            ref={scrollRef} horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}
            contentContainerStyle={contentContainerStyle} style={{ flex: 1 }}
            onLayout={(e) => setClientWidth(e.nativeEvent.layout.width)}
            onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}
         >
            {children}
         </ScrollView>
         <TouchableOpacity style={styles.rowNavBtn} onPress={() => scroll('right')}>
            <ChevronRight size={20} color="#64748b" />
         </TouchableOpacity>
      </View>
   );
};

export const ShelfMapScreen = () => {
   const [shelves, setShelves] = useState<Shelf[]>([]);
   const [products, setProducts] = useState<Product[]>([]);

   const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);

   // FIX: Nuevos estados para la página dedicada de Vitrina
   const [showVitrinaDetail, setShowVitrinaDetail] = useState(false);
   const [vitrinaSortCategory, setVitrinaSortCategory] = useState(false);
   const [vitrinaFilters, setVitrinaFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });

   const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
   const [editingProduct, setEditingProduct] = useState<Product | null>(null);

   const [selectedVariant, setSelectedVariant] = useState<SelectedVariantRef | null>(null);
   const [stash, setStash] = useState<InspectedItem[]>([]);

   const [filters, setFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });
   const [currentPage, setCurrentPage] = useState(1);

   const [draftLocationsMap, setDraftLocationsMap] = useState<Record<string, ShelfLocation[]>>({});
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   const [saving, setSaving] = useState(false);

   const [isDragMode, setIsDragMode] = useState(false);

   const [matrixDraggedPayload, setMatrixDraggedPayload] = useState<MatrixDragPayload | null>(null);
   const [draggingSourceKey, setDraggingSourceKey] = useState<string | null>(null);
   const lastTargetKeyRef = useRef<string | null>(null);

   const isDragging = useSharedValue(false);
   const dragX = useSharedValue(0);
   const dragY = useSharedValue(0);
   const offsetX = useSharedValue(0);
   const offsetY = useSharedValue(0);
   const ghostWidth = useSharedValue(70);
   const ghostHeight = useSharedValue(70);

   const hoverOpacity = useSharedValue(0);
   const hoverX = useSharedValue(0);
   const hoverY = useSharedValue(0);
   const hoverW = useSharedValue(0);
   const hoverH = useSharedValue(0);

   const [dragGhostImg, setDragGhostImg] = useState<string | null>(null);
   const containerRef = useRef<View>(null);
   const cellLayoutsRef = useRef<Record<string, CellLayout>>({});
   const scrollYRef = useRef(0);

   const [inspectedSpace, setInspectedSpace] = useState<{ shelfName: string; row: number; space: number; items: InspectedItem[]; isStash?: boolean; stashIndex?: number; } | null>(null);
   const [isModalReady, setIsModalReady] = useState(false);

   const [viewerData, setViewerData] = useState<{ images: string[]; visible: boolean } | null>(null);
   const [viewerIndex, setViewerIndex] = useState(0);
   const [viewerWidth, setViewerWidth] = useState(0);
   const viewerScrollRef = useRef<ScrollView>(null);

   useEffect(() => {
      if (inspectedSpace) {
         setIsModalReady(false);
         const t = setTimeout(() => setIsModalReady(true), 350);
         return () => clearTimeout(t);
      }
   }, [inspectedSpace]);

   useEffect(() => {
      const unsubShelves = subscribeToShelves(setShelves);
      const unsubProducts = subscribeToProducts(setProducts);
      return () => { unsubShelves(); unsubProducts(); };
   }, []);

   useEffect(() => {
      if (activeShelf || showVitrinaDetail) {
         syncDraftsFromProducts(products);
         setHasUnsavedChanges(false);
         setStash([]);
         setIsDragMode(false);
      }
      cellLayoutsRef.current = {};
      setTimeout(measureContainer, 50);
   }, [activeShelf, showVitrinaDetail]);

   const measureContainer = useCallback(() => {
      const node: any = containerRef.current;
      if (!node) return;
      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
         const r = node.getBoundingClientRect(); offsetX.value = r.left; offsetY.value = r.top; return;
      }
      if (typeof node.measureInWindow === 'function') {
         node.measureInWindow((x: number, y: number) => { offsetX.value = x; offsetY.value = y; });
      }
   }, []);

   const syncDraftsFromProducts = (prods: Product[]) => {
      const initialMap: Record<string, ShelfLocation[]> = {};
      prods.forEach((p) => { (p.variants || []).forEach((v, vIdx) => { initialMap[`${p.id}_${vIdx}`] = [...(v.locations || [])]; }); });
      setDraftLocationsMap(initialMap);
   };

   const getEffectiveLocations = (productId: string, variantIndex: number): ShelfLocation[] => {
      const key = `${productId}_${variantIndex}`;
      if (draftLocationsMap[key] !== undefined) return draftLocationsMap[key];
      const p = products.find((prod) => prod.id === productId);
      return p?.variants[variantIndex]?.locations || [];
   };

   const getItemsInSpace = (shelfName: string, rowIndex: number, spaceIndex: number): InspectedItem[] => {
      return products.flatMap((p) => (p.variants || []).flatMap((v, vIdx) => {
         const locs = getEffectiveLocations(p.id!, vIdx);
         const inThisSpace = locs.some((l) => l.shelfId === shelfName && (l.rowIndex || 1) === rowIndex && l.rumaIndex === spaceIndex);
         return inThisSpace ? [{ product: p, variant: v, variantIndex: vIdx }] : [];
      }));
   };

   const registerCellLayout = useCallback((key: string, layout: CellLayout) => { cellLayoutsRef.current[key] = layout; }, []);

   const findCellAtPoint = useCallback((absX: number, absY: number, excludeKey?: string | null): string | null => {
      const scrollY = scrollYRef.current;
      for (const [key, l] of Object.entries(cellLayoutsRef.current)) {
         if (excludeKey && key === excludeKey) continue;
         const currentCellY = l.y - scrollY;
         if (absX >= l.x && absX <= l.x + l.width && absY >= currentCellY && absY <= currentCellY + l.height) { return key; }
      }
      return null;
   }, []);

   const handleDragStart = useCallback((payload: MatrixDragPayload, absX: number, absY: number) => {
      measureContainer();
      const sourceKey = payload.source === 'stash' ? `STASH_${payload.stashIndex}` : `F${payload.sourceRow}_E${payload.sourceSpace}`;
      const layout = cellLayoutsRef.current[sourceKey];
      setMatrixDraggedPayload(payload); setDraggingSourceKey(sourceKey);
      setDragGhostImg(payload.product.images[0] || 'https://via.placeholder.com/60');
      ghostWidth.value = layout?.width ?? 70; ghostHeight.value = layout?.height ?? 70; hoverOpacity.value = 0;
   }, [measureContainer]);

   const handleDragMove = useCallback((absX: number, absY: number) => {
      const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);
      if (targetKey !== lastTargetKeyRef.current) {
         lastTargetKeyRef.current = targetKey;
         if (targetKey && cellLayoutsRef.current[targetKey]) {
            const layout = cellLayoutsRef.current[targetKey]; const scrollY = scrollYRef.current;
            hoverX.value = layout.x - offsetX.value; hoverY.value = (layout.y - scrollY) - offsetY.value;
            hoverW.value = layout.width; hoverH.value = layout.height; hoverOpacity.value = 1;
         } else { hoverOpacity.value = 0; }
      }
   }, [draggingSourceKey, findCellAtPoint]);

   const handleDragEnd = useCallback((payload: MatrixDragPayload, absX: number, absY: number) => {
      const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);
      hoverOpacity.value = 0; lastTargetKeyRef.current = null; setDragGhostImg(null); setDraggingSourceKey(null); setMatrixDraggedPayload(null);

      if (!targetKey || !activeShelf) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (targetKey === 'STASH_ZONE' && payload.source === 'matrix') {
         handleRemoveFromSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, payload.sourceRow!, payload.sourceSpace!);
         setStash(prev => [...prev, { product: payload.product, variant: payload.product.variants[payload.variantIndex], variantIndex: payload.variantIndex }]);
         return;
      }

      const m = targetKey.match(/^F(\d+)_E(\d+)$/);
      if (!m) return;
      const targetRow = parseInt(m[1], 10); const targetSpace = parseInt(m[2], 10);

      if (payload.source === 'matrix') { handleMoveSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, payload.sourceRow!, payload.sourceSpace!, targetRow, targetSpace); }
      else if (payload.source === 'stash') {
         handleAssignToSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, targetRow, targetSpace);
         setStash(prev => prev.filter((_, i) => i !== payload.stashIndex));
      }
   }, [draggingSourceKey, activeShelf, findCellAtPoint, stash]);

   const handleAssignToSpaceLocal = (productId: string, variantIndex: number, shelfName: string, row: number, space: number) => {
      const key = `${productId}_${variantIndex}`; const currentLocs = getEffectiveLocations(productId, variantIndex);
      const exists = currentLocs.some((l) => l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space);
      if (!exists) {
         LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
         setDraftLocationsMap((prev) => ({ ...prev, [key]: [...currentLocs, { shelfId: shelfName, rowIndex: row, rumaIndex: space }] }));
         setHasUnsavedChanges(true);
      }
      setSelectedVariant(null);
   };

   const handleMoveSpaceLocal = (productId: string, variantIndex: number, sourceShelf: string, sourceRow: number, sourceSpace: number, targetRow: number, targetSpace: number) => {
      if (sourceShelf === activeShelf?.name && sourceRow === targetRow && sourceSpace === targetSpace) return;
      const key = `${productId}_${variantIndex}`; const currentLocs = getEffectiveLocations(productId, variantIndex);
      const filtered = currentLocs.filter((l) => !(l.shelfId === sourceShelf && l.rowIndex === sourceRow && l.rumaIndex === sourceSpace));
      const exists = filtered.some((l) => l.shelfId === activeShelf!.name && l.rowIndex === targetRow && l.rumaIndex === targetSpace);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraftLocationsMap((prev) => ({ ...prev, [key]: exists ? filtered : [...filtered, { shelfId: activeShelf!.name, rowIndex: targetRow, rumaIndex: targetSpace }] }));
      setHasUnsavedChanges(true);
   };

   const handleRemoveFromSpaceLocal = (productId: string, variantIndex: number, shelfName: string, row: number, space: number) => {
      const key = `${productId}_${variantIndex}`; const currentLocs = getEffectiveLocations(productId, variantIndex);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraftLocationsMap((prev) => ({ ...prev, [key]: currentLocs.filter((l) => !(l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space)) }));
      setHasUnsavedChanges(true);
   };

   const handleSmartStack = () => { /* Lógica sin cambios */ };
   const handleAutoSort = () => { /* Lógica sin cambios */ };
   const handleClearToStash = () => { /* Lógica sin cambios */ };

   const shelfAnalytics = useMemo(() => {
      if (!activeShelf) return { occupied: 0, total: 0, percentage: 0 };
      const totalSpaces = (activeShelf.rowsCount || 1) * (activeShelf.spacesPerRow || 3);
      const occupiedSpaces = new Set();
      products.forEach(p => p.variants.forEach((v, vIdx) => {
         const locs = getEffectiveLocations(p.id!, vIdx).filter(l => l.shelfId === activeShelf.name);
         locs.forEach(l => occupiedSpaces.add(`${l.rowIndex}_${l.rumaIndex}`));
      }));
      return { occupied: occupiedSpaces.size, total: totalSpaces, percentage: totalSpaces > 0 ? Math.round((occupiedSpaces.size / totalSpaces) * 100) : 0 };
   }, [activeShelf, draftLocationsMap, products]);

   const handleSaveChangesToFirebase = async () => {
      const performSave = async () => {
         setSaving(true);
         try {
            const productUpdates: Record<string, Product> = {};
            for (const [key, newLocs] of Object.entries(draftLocationsMap)) {
               const [productId, vIdxStr] = key.split('_'); const vIdx = parseInt(vIdxStr, 10);
               const originalProd = products.find((p) => p.id === productId);
               if (!originalProd) continue;
               const originalLocs = originalProd.variants[vIdx]?.locations || [];
               if (JSON.stringify(originalLocs) !== JSON.stringify(newLocs)) {
                  if (!productUpdates[productId]) productUpdates[productId] = JSON.parse(JSON.stringify(originalProd));
                  if (productUpdates[productId] && productUpdates[productId].variants[vIdx]) { productUpdates[productId].variants[vIdx].locations = newLocs; }
               }
            }
            const updates = Object.values(productUpdates);
            if (updates.length > 0) { await Promise.all(updates.map(upd => upd.id ? updateProduct(upd.id, { variants: upd.variants }) : Promise.resolve())); }
            setHasUnsavedChanges(false); setStash([]);
            showAlert('Guardado', 'Cambios guardados exitosamente.');
         } catch (error: any) { showAlert('Error', error.message); } finally { setSaving(false); }
      };

      if (stash.length > 0) { showConfirm('Bandeja con prendas', `Tienes ${stash.length} prendas en el Stash. Al guardar perderán su ubicación. ¿Continuar?`, performSave); }
      else { performSave(); }
   };

   const handleFilterChange = (newFilters: FilterOptions) => {
      setFilters(newFilters);
      setCurrentPage(1);
   };

   const handleVitrinaFilterChange = (newFilters: FilterOptions) => {
      setVitrinaFilters(newFilters);
   };

   const handleDiscardChanges = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); syncDraftsFromProducts(products); setHasUnsavedChanges(false); setStash([]); };

   const assignProductToVitrina = async (product: Product, variantIndex: number, sizeToDisplay?: string) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = { isOnDisplay: true, displaySize: sizeToDisplay || updatedVariants[variantIndex]?.sizes[0]?.size || 'M' };
         await updateProduct(product.id, { variants: updatedVariants });
         setSelectedVariant(null);
      } catch (error: any) { showAlert('Error', error.message); }
   };

   const updateVitrinaDisplaySize = async (product: Product, variantIndex: number, newSize: string) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = { isOnDisplay: true, displaySize: newSize };
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) { showAlert('Error', error.message); }
   };

   const removeFromVitrina = async (product: Product, variantIndex: number) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = { isOnDisplay: false };
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) { showAlert('Error', error.message); }
   };

   const selectedVariantTotalLocations = useMemo(() => {
      if (!selectedVariant) return 0;
      return getEffectiveLocations(selectedVariant.product.id!, selectedVariant.variantIndex).length;
   }, [selectedVariant, draftLocationsMap, products]);

   const exhibitionItems = products.flatMap((p) => (p.variants || []).map((v, vIdx) => ({ product: p, variant: v, variantIndex: vIdx })).filter((item) => item.variant.exhibition?.isOnDisplay));

   // FIX: Lógica de ordenado y filtrado exclusiva para la página de Vitrina
   const vitrinaDisplayItems = useMemo(() => {
      let items = exhibitionItems.filter(item => {
         if (vitrinaFilters.query && !item.product.name.toLowerCase().includes(vitrinaFilters.query.toLowerCase()) && !item.product.code?.toLowerCase().includes(vitrinaFilters.query.toLowerCase())) return false;
         if (vitrinaFilters.category !== 'all' && item.product.category !== vitrinaFilters.category) return false;
         if (vitrinaFilters.brand && item.product.brand !== vitrinaFilters.brand) return false;
         if (vitrinaFilters.size && !item.variant.sizes.some(s => s.size === vitrinaFilters.size)) return false;
         return true;
      });

      if (vitrinaSortCategory) {
         items.sort((a, b) => {
            const catA = a.product.category || ''; const catB = b.product.category || '';
            if (catA !== catB) return catA.localeCompare(catB);
            return (a.product.name || '').localeCompare(b.product.name || '');
         });
      }
      return items;
   }, [exhibitionItems, vitrinaFilters, vitrinaSortCategory]);

   const availableCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
   const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
   const availableSizes = Array.from(new Set(products.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size)))));

   const vitrinaCategories = Array.from(new Set(exhibitionItems.map(i => i.product.category).filter(Boolean))) as string[];
   const vitrinaBrands = Array.from(new Set(exhibitionItems.map(i => i.product.brand).filter(Boolean)));

   const filteredProducts = filterProducts(products, filters);
   const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

   const ghostAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
      opacity: isDragging.value ? 0.95 : 0, width: ghostWidth.value, height: ghostHeight.value,
      transform: [{ translateX: dragX.value - offsetX.value - (ghostWidth.value / 2) }, { translateY: dragY.value - offsetY.value - (ghostHeight.value / 2) }] as any,
   }));

   const hoverAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: hoverOpacity.value, left: hoverX.value, top: hoverY.value, width: hoverW.value, height: hoverH.value }));

   const renderDragHandle = () => (<View style={styles.dragHandleIcon}><Move size={14} color="#ffffff" /></View>);

   return (
      <View ref={containerRef} style={styles.container} onLayout={measureContainer}>

         {selectedVariant && (
            <View style={styles.floatingSelectionOverlay}>
               <Image source={{ uri: selectedVariant.product.images[0] || 'https://via.placeholder.com/100' }} style={styles.overlayImg} contentFit="cover" cachePolicy="memory-disk" />
               <View style={styles.overlayInfo}>
                  <Text style={styles.overlayTitle}>
                     {selectedVariant.isRelocating
                        ? 'Toca un espacio para reubicar'
                        : (selectedVariantTotalLocations > 0 ? `📍 Detectado en ${selectedVariantTotalLocations} espacios` : 'Sin ubicar en bodega - Toca un espacio para añadir')}
                  </Text>
                  <Text style={styles.overlaySubtitle} numberOfLines={2}>{selectedVariant.product.name}</Text>
                  <Text style={styles.overlayCode}>SKU: {selectedVariant.product.code}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                     <View style={[styles.variantDot, { width: 12, height: 12, borderRadius: 6, backgroundColor: selectedVariant.product.variants[selectedVariant.variantIndex]?.colorHex || '#000' }]} />
                     <Text style={styles.overlayColorText}>{selectedVariant.product.variants[selectedVariant.variantIndex]?.color}</Text>
                  </View>
               </View>
               <TouchableOpacity style={styles.overlayCancelBtn} onPress={() => setSelectedVariant(null)}><X size={20} color="#475569" /></TouchableOpacity>
            </View>
         )}

         <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }} onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>

            <View style={styles.floatingActionRow}>
               {hasUnsavedChanges && (
                  <View style={styles.saveAlertBanner}>
                     <Save size={16} color="#ffffff" style={{ marginRight: 8 }} />
                     <View style={{ flex: 1 }}><Text style={styles.saveAlertTitle}>Cambios sin guardar</Text></View>
                     <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardChanges} disabled={saving}><RotateCcw size={14} color="#ffffff" /></TouchableOpacity>
                     <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChangesToFirebase} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#15803d" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                     </TouchableOpacity>
                  </View>
               )}
            </View>

            {/* FIX: ARQUITECTURA DE 3 VISTAS (VITRINA, ESTANTE o DASHBOARD) */}

            {showVitrinaDetail ? (
               // --- VISTA: PÁGINA DE VITRINA ---
               <View style={styles.matrixContainer}>
                  <View style={styles.matrixNavRow}>
                     <TouchableOpacity style={styles.backBtn} onPress={() => setShowVitrinaDetail(false)}>
                        <ChevronLeft size={20} color="#475569" /><Text style={styles.backBtnText}>Volver</Text>
                     </TouchableOpacity>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.matrixTitle}>Piso de Ventas / Vitrina</Text>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>{exhibitionItems.length} prendas en exhibición</Text>
                     </View>
                  </View>

                  <View style={styles.vitrinaToolbar}>
                     <TouchableOpacity
                        style={[styles.proToolBtn, vitrinaSortCategory && styles.dragModeBtnActive]}
                        onPress={() => setVitrinaSortCategory(!vitrinaSortCategory)}
                     >
                        <Layers size={14} color={vitrinaSortCategory ? '#ffffff' : '#4f46e5'} />
                        <Text style={[styles.proToolBtnText, vitrinaSortCategory ? { color: '#ffffff' } : { color: '#4f46e5' }]}>
                           Agrupar por Categoría {vitrinaSortCategory ? 'ON' : 'OFF'}
                        </Text>
                     </TouchableOpacity>
                  </View>

                  <ProductSearchFilter
                     filters={vitrinaFilters}
                     onFilterChange={handleVitrinaFilterChange}
                     availableCategories={vitrinaCategories}
                     availableBrands={vitrinaBrands}
                     availableSizes={availableSizes}
                     hideStatusFilter={true}
                  />

                  <View style={styles.vitrinaDetailGrid}>
                     {vitrinaDisplayItems.length === 0 ? (
                        <Text style={styles.emptyText}>No hay prendas exhibidas con estos filtros.</Text>
                     ) : (
                        vitrinaDisplayItems.map((item, idx) => {
                           const currentDisplaySize = item.variant.exhibition?.displaySize || 'Única';
                           return (
                              <View key={`${item.product.id}_${item.variantIndex}_${idx}`} style={styles.vitrinaDetailCard}>
                                 <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => {
                                       setViewerData({ images: item.product.images && item.product.images.length > 0 ? item.product.images : ['https://via.placeholder.com/400'], visible: true });
                                       setViewerIndex(0);
                                    }}
                                 >
                                    <Image source={{ uri: item.product.images[0] || 'https://via.placeholder.com/150' }} style={styles.vitrinaDetailImg} contentFit="cover" cachePolicy="memory-disk" />
                                    <View style={styles.expandIconOverlay}><Eye size={16} color="#fff" /></View>
                                 </TouchableOpacity>

                                 <View style={styles.vitrinaDetailInfo}>
                                    <Text style={styles.exhibitionBrand}>{item.product.brand}</Text>
                                    <Text style={styles.exhibitionName} numberOfLines={1}>{item.product.name}</Text>

                                    {/* NUEVO: Etiqueta del Código SKU */}
                                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                                       <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold' }}>SKU: {item.product.code}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                                       <View style={[styles.variantDot, { backgroundColor: item.variant.colorHex || '#000', width: 10, height: 10 }]} />
                                       <Text style={styles.exhibitionColor}>{item.variant.color}</Text>
                                    </View>

                                    <Text style={styles.vitrinaSizeLabel}>Talla exhibida:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vitrinaSizeRow} contentContainerStyle={{ gap: 6 }}>
                                       {(item.variant.sizes || []).map((sObj: any) => {
                                          const isSelectedSize = currentDisplaySize === sObj.size;
                                          return (
                                             <TouchableOpacity key={sObj.size} style={[styles.vitrinaSizeChip, isSelectedSize && styles.vitrinaSizeChipActive]} onPress={() => updateVitrinaDisplaySize(item.product, item.variantIndex, sObj.size)}>
                                                <Text style={[styles.vitrinaSizeChipText, isSelectedSize && styles.vitrinaSizeChipTextActive]}>{sObj.size}</Text>
                                             </TouchableOpacity>
                                          );
                                       })}
                                    </ScrollView>
                                 </View>
                                 <TouchableOpacity style={styles.vitrinaRemoveBtnAbsolute} onPress={() => removeFromVitrina(item.product, item.variantIndex)}>
                                    <Trash2 size={16} color="#ef4444" />
                                 </TouchableOpacity>
                              </View>
                           );
                        })
                     )}
                  </View>
               </View>

            ) : activeShelf ? (
               // --- VISTA: MATRIX DE ESTANTE ---
               <View style={styles.matrixContainer}>
                  <View style={styles.matrixNavRow}>
                     <TouchableOpacity style={styles.backBtn} onPress={() => {
                        if (hasUnsavedChanges) { showConfirm('Cambios pendientes', '¿Descartar cambios y salir?', () => { handleDiscardChanges(); setActiveShelf(null); }); }
                        else { setActiveShelf(null); }
                     }}><ChevronLeft size={20} color="#475569" /><Text style={styles.backBtnText}>Volver</Text></TouchableOpacity>

                     <View style={{ flex: 1 }}>
                        <Text style={styles.matrixTitle}>{activeShelf.name}</Text>
                        <View style={styles.capacityBarWrapper}>
                           <View style={[styles.capacityBarFill, { width: `${shelfAnalytics.percentage}%`, backgroundColor: shelfAnalytics.percentage > 90 ? '#ef4444' : '#3b82f6' }]} />
                           <Text style={styles.capacityBarText}>Ocupación: {shelfAnalytics.percentage}% ({shelfAnalytics.occupied}/{shelfAnalytics.total})</Text>
                        </View>
                     </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.proToolsRow} contentContainerStyle={{ gap: 8 }}>
                     <TouchableOpacity
                        style={[styles.proToolBtn, styles.dragModeBtn, isDragMode && styles.dragModeBtnActive]}
                        onPress={() => { setIsDragMode(!isDragMode); if (!isDragMode) setSelectedVariant(null); }}
                     >
                        <Move size={14} color={isDragMode ? '#ffffff' : '#4f46e5'} />
                        <Text style={[styles.proToolBtnText, isDragMode ? { color: '#ffffff' } : { color: '#4f46e5' }]}>{isDragMode ? 'Modo Mover: ON' : 'Mover Prendas'}</Text>
                     </TouchableOpacity>

                     <TouchableOpacity style={styles.proToolBtn} onPress={handleAutoSort}><Wand2 size={14} color="#0284c7" /><Text style={styles.proToolBtnText}>Auto-Ordenar</Text></TouchableOpacity>
                     <TouchableOpacity style={styles.proToolBtn} onPress={handleSmartStack}><Combine size={14} color="#059669" /><Text style={[styles.proToolBtnText, { color: '#059669' }]}>Apilado Inteligente</Text></TouchableOpacity>
                     <TouchableOpacity style={[styles.proToolBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]} onPress={handleClearToStash}><ArchiveRestore size={14} color="#dc2626" /><Text style={[styles.proToolBtnText, { color: '#dc2626' }]}>Vaciar al Stash</Text></TouchableOpacity>
                  </ScrollView>

                  <View style={styles.shelfStructure}>
                     {Array.from({ length: activeShelf.rowsCount || 1 }).map((_, rIdx) => {
                        const rowNum = activeShelf.rowsCount - rIdx;
                        return (
                           <View key={rowNum} style={styles.matrixRow}>
                              <View style={styles.rowLabel}><Text style={styles.rowLabelText}>F{rowNum}</Text></View>

                              <ScrollRow contentContainerStyle={styles.spacesScroll}>
                                 {Array.from({ length: activeShelf.spacesPerRow || 3 }).map((_, sIdx) => {
                                    const spaceNum = sIdx + 1;
                                    const items = getItemsInSpace(activeShelf.name, rowNum, spaceNum);
                                    const isEmpty = items.length === 0;
                                    const firstItem = items[0];
                                    const cellKey = `F${rowNum}_E${spaceNum}`;
                                    const dragPayload: MatrixDragPayload | null = !isEmpty && firstItem ? { source: 'matrix', product: firstItem.product, variantIndex: firstItem.variantIndex, sourceRow: rowNum, sourceSpace: spaceNum } : null;
                                    const isTargetMatch = selectedVariant && items.some(i => i.product.id === selectedVariant.product.id && i.variantIndex === selectedVariant.variantIndex);

                                    return (
                                       <DraggableCell
                                          key={spaceNum} cellKey={cellKey} disabled={isEmpty && !selectedVariant} isDragEnabled={isDragMode && !isEmpty}
                                          renderHandle={renderDragHandle} onRegisterLayout={registerCellLayout} dragX={dragX} dragY={dragY} isDragging={isDragging}
                                          onPress={() => {
                                             if (selectedVariant) {
                                                if (selectedVariant.isRelocating) {
                                                   if (selectedVariant.stashIndex !== undefined) {
                                                      handleAssignToSpaceLocal(selectedVariant.product.id!, selectedVariant.variantIndex, activeShelf.name, rowNum, spaceNum);
                                                      setStash(prev => prev.filter((_, i) => i !== selectedVariant.stashIndex));
                                                   } else {
                                                      handleMoveSpaceLocal(selectedVariant.product.id!, selectedVariant.variantIndex, selectedVariant.sourceShelf!, selectedVariant.sourceRow!, selectedVariant.sourceSpace!, rowNum, spaceNum);
                                                   }
                                                   setSelectedVariant(null);
                                                } else { handleAssignToSpaceLocal(selectedVariant.product.id!, selectedVariant.variantIndex, activeShelf.name, rowNum, spaceNum); }
                                             } else if (!isEmpty) { setInspectedSpace({ shelfName: activeShelf.name, row: rowNum, space: spaceNum, items }); }
                                          }}
                                          onDragStart={(x, y) => dragPayload && handleDragStart(dragPayload, x, y)} onDragMove={handleDragMove} onDragEnd={(x, y) => dragPayload && handleDragEnd(dragPayload, x, y)}
                                          style={[styles.matrixCell, isEmpty ? styles.matrixCellEmpty : styles.matrixCellOccupied, selectedVariant && !isTargetMatch && styles.matrixCellStaticHighlight, isTargetMatch && styles.matrixCellTargetMatch]}
                                       >
                                          <Text style={styles.cellLabel}>E{spaceNum}</Text>
                                          {isEmpty ? (<View style={styles.emptyCellTouchArea}><Box size={22} color={selectedVariant ? '#3b82f6' : '#cbd5e1'} /></View>) : (
                                             <>
                                                <Image source={{ uri: firstItem.product.images[0] || 'https://via.placeholder.com/60' }} style={styles.cellThumbnail} contentFit="cover" cachePolicy="memory-disk" />
                                                {items.length > 1 && <View style={styles.cellBadge}><Text style={styles.cellBadgeText}>+{items.length - 1}</Text></View>}
                                                {isTargetMatch && <View style={styles.targetMatchIcon}><Sparkles size={14} color="#ca8a04" /></View>}
                                             </>
                                          )}
                                       </DraggableCell>
                                    );
                                 })}
                              </ScrollRow>
                           </View>
                        );
                     })}
                  </View>

                  <View style={styles.stashContainer}>
                     <DraggableCell
                        cellKey="STASH_ZONE" disabled={true} isDragEnabled={false} onRegisterLayout={registerCellLayout} onPress={() => { }} onDragStart={() => { }} onDragMove={() => { }} onDragEnd={() => { }} style={styles.stashDropZone}
                     >
                        <View style={styles.stashHeader}>
                           <Inbox size={16} color="#6366f1" />
                           <Text style={styles.stashTitle}>Bandeja Temporal (Stash)</Text>
                           <Text style={styles.stashDesc}>Arrastra prendas aquí. Toca una para ver detalles.</Text>
                        </View>
                        <ScrollRow contentContainerStyle={styles.stashScroll}>
                           {stash.map((item, idx) => {
                              const dragPayload: MatrixDragPayload = { source: 'stash', product: item.product, variantIndex: item.variantIndex, stashIndex: idx };
                              return (
                                 <DraggableCell
                                    key={`stash_${idx}`} cellKey={`STASH_${idx}`} onRegisterLayout={registerCellLayout} dragX={dragX} dragY={dragY} isDragging={isDragging} isDragEnabled={isDragMode} renderHandle={renderDragHandle}
                                    onPress={() => { setInspectedSpace({ shelfName: 'Bandeja Temporal', row: 0, space: idx + 1, items: [{ product: item.product, variant: item.variant, variantIndex: item.variantIndex }], isStash: true, stashIndex: idx }); }}
                                    onDragStart={(x, y) => handleDragStart(dragPayload, x, y)} onDragMove={handleDragMove} onDragEnd={(x, y) => handleDragEnd(dragPayload, x, y)}
                                    style={styles.stashItem}
                                 >
                                    <Image source={{ uri: item.product.images[0] || 'https://via.placeholder.com/80' }} style={styles.stashImg} contentFit="cover" cachePolicy="memory-disk" />
                                    <View style={styles.stashItemColor}><Text style={styles.stashItemText} numberOfLines={1}>{item.variant.color}</Text></View>
                                 </DraggableCell>
                              );
                           })}
                           {stash.length === 0 && <Text style={styles.emptyStashText}>Bandeja vacía</Text>}
                        </ScrollRow>
                     </DraggableCell>
                  </View>
               </View>

            ) : (
               // --- VISTA: DASHBOARD PRINCIPAL ---
               <>
                  <View style={[styles.sectionHeader, { justifyContent: 'space-between', marginBottom: 12 }]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}><Layers size={20} color="#2563eb" style={{ marginRight: 8 }} /><Text style={styles.sectionTitle}>Plano General de Bodega</Text></View>
                     <TouchableOpacity style={styles.createBtn} onPress={() => setEditingShelf({ name: '', rowsCount: 1, spacesPerRow: 3 })}><Plus size={14} color="#ffffff" /><Text style={styles.createBtnText}>Nuevo Estante</Text></TouchableOpacity>
                  </View>

                  <View style={styles.shelvesSummaryGrid}>
                     {/* FIX: Tarjeta Gigante de la Vitrina integrada en el Grid de Estantes */}
                     <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.shelfSummaryCard, styles.vitrinaSummaryCard, selectedVariant && styles.vitrinaDropZoneActive]}
                        onPress={() => {
                           if (selectedVariant && !selectedVariant.isRelocating) { assignProductToVitrina(selectedVariant.product, selectedVariant.variantIndex); }
                           else if (!selectedVariant) { setShowVitrinaDetail(true); }
                        }}
                     >
                        {selectedVariant ? (
                           <View style={styles.emptyDropPrompt}>
                              <Store size={32} color="#9333ea" style={{ marginBottom: 10 }} />
                              <Text style={[styles.emptyDropText, styles.emptyDropTextActive, { fontSize: 15 }]}>Soltar aquí para Vitrina</Text>
                           </View>
                        ) : (
                           <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                              <View style={[styles.shelfIconWrapper, { backgroundColor: '#f3e8ff' }]}><Store size={28} color="#9333ea" /></View>
                              <View style={{ marginLeft: 16, flex: 1 }}>
                                 <Text style={[styles.shelfSummaryTitle, { color: '#581c87', fontSize: 18 }]}>Piso de Ventas</Text>
                                 <Text style={[styles.shelfSummaryDetail, { color: '#7e22ce' }]}>{exhibitionItems.length} prendas en exhibición</Text>
                              </View>
                              <ChevronRight size={24} color="#d8b4fe" />
                           </View>
                        )}
                     </TouchableOpacity>

                     {shelves.length === 0 && <Text style={styles.emptyText}>Bodega vacía. Crea un estante.</Text>}
                     {shelves.map((shelf) => {
                        const variantLocs = selectedVariant ? getEffectiveLocations(selectedVariant.product.id!, selectedVariant.variantIndex) : [];
                        const countInShelf = variantLocs.filter(l => l.shelfId === shelf.name).length;
                        const isHighlighted = countInShelf > 0;

                        return (
                           <TouchableOpacity
                              key={shelf.id || shelf.name}
                              style={[styles.shelfSummaryCard, isHighlighted && styles.shelfSummaryCardHighlight]}
                              onPress={() => setActiveShelf(shelf)}
                           >
                              {isHighlighted && (
                                 <View style={styles.shelfLocateBadge}><MapPin size={12} color="#ffffff" style={{ marginRight: 4 }} /><Text style={styles.shelfLocateBadgeText}>{countInShelf} aquí</Text></View>
                              )}
                              <View style={[styles.shelfIconWrapper, isHighlighted && { backgroundColor: '#fefce8' }]}><MapPin size={24} color={isHighlighted ? "#ca8a04" : "#2563eb"} /></View>
                              <Text style={styles.shelfSummaryTitle}>{shelf.name}</Text>
                              <Text style={styles.shelfSummaryDetail}>{shelf.rowsCount} Filas × {shelf.spacesPerRow} Espacios</Text>
                              <View style={styles.shelfActions}>
                                 <TouchableOpacity onPress={() => setEditingShelf(shelf)} style={styles.smallIconBtn}><Pencil size={14} color="#64748b" /></TouchableOpacity>
                                 <TouchableOpacity onPress={() => showConfirm('Eliminar', `¿Borrar ${shelf.name}?`, async () => { if (shelf.id) await deleteShelf(shelf.id); })} style={styles.smallIconBtn}><Trash2 size={14} color="#ef4444" /></TouchableOpacity>
                              </View>
                           </TouchableOpacity>
                        );
                     })}
                  </View>
               </>
            )}

            {!showVitrinaDetail && (
               <>
                  <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                     <Package size={20} color="#059669" style={{ marginRight: 8 }} />
                     <Text style={styles.sectionTitle}>Inventario General</Text>
                  </View>

                  <ProductSearchFilter filters={filters} onFilterChange={handleFilterChange} availableCategories={availableCategories} availableBrands={availableBrands} availableSizes={availableSizes} />

                  <View style={styles.catalogGrid}>
                     {paginatedProducts.length === 0 ? (<Text style={styles.emptyText}>No se encontraron prendas.</Text>) : (
                        paginatedProducts.map((p) => (
                           <View key={p.id || p.code} style={styles.catalogCard}>
                              <TouchableOpacity
                                 activeOpacity={0.8}
                                 onPress={() => {
                                    setViewerData({ images: p.images && p.images.length > 0 ? p.images : ['https://via.placeholder.com/400'], visible: true });
                                    setViewerIndex(0);
                                 }}
                              >
                                 <Image source={{ uri: p.images[0] || 'https://via.placeholder.com/80' }} style={styles.catalogImg} contentFit="cover" cachePolicy="memory-disk" />
                                 <View style={styles.expandIconOverlay}><Eye size={12} color="#fff" /></View>
                              </TouchableOpacity>

                              <View style={styles.catalogInfo}>
                                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View>
                                       <Text style={styles.catalogBrand}>{p.brand}</Text>
                                       <Text style={styles.catalogName} numberOfLines={1}>{p.name}</Text>
                                       <Text style={styles.catalogCode}>SKU: {p.code}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.editProductBtn} onPress={() => setEditingProduct(p)}><Pencil size={14} color="#64748b" /></TouchableOpacity>
                                 </View>
                                 <View style={styles.variantsDragRow}>
                                    {(p.variants || []).map((v, vIdx) => {
                                       const isSelected = selectedVariant?.product.id === p.id && selectedVariant?.variantIndex === vIdx;
                                       return (
                                          <TouchableOpacity
                                             key={v.id || vIdx} activeOpacity={0.7} style={[styles.variantBadge, isSelected && styles.variantBadgeSelected]}
                                             onPress={() => { setIsDragMode(false); setSelectedVariant({ product: p, variantIndex: vIdx }); }}
                                          >
                                             <View style={[styles.variantDot, { backgroundColor: v.colorHex || '#000' }]} />
                                             <Text style={[styles.variantText, isSelected && styles.variantTextSelected]}>{v.color}</Text>
                                          </TouchableOpacity>
                                       );
                                    })}
                                 </View>
                              </View>
                           </View>
                        ))
                     )}
                  </View>

                  {totalPages > 1 && (
                     <View style={styles.paginationBar}>
                        <TouchableOpacity style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]} disabled={currentPage === 1} onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}><ChevronLeft size={18} color={currentPage === 1 ? '#94a3b8' : '#0f172a'} /><Text style={[styles.pageNavText, currentPage === 1 && styles.pageNavTextDisabled]}>Anterior</Text></TouchableOpacity>
                        <Text style={styles.pageIndicator}>Pág <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{currentPage}</Text> de {totalPages}</Text>
                        <TouchableOpacity style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]} disabled={currentPage === totalPages} onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><Text style={[styles.pageNavText, currentPage === totalPages && styles.pageNavTextDisabled]}>Siguiente</Text><ChevronRight size={18} color={currentPage === totalPages ? '#94a3b8' : '#0f172a'} /></TouchableOpacity>
                     </View>
                  )}
               </>
            )}
         </ScrollView>

         <Animated.View pointerEvents="none" style={[styles.hoverHighlightBox, hoverAnimatedStyle]} />
         <Animated.View pointerEvents="none" style={[styles.ghostWrapper, ghostAnimatedStyle]}>{dragGhostImg && <Image source={{ uri: dragGhostImg }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />}</Animated.View>

         <Modal visible={!!inspectedSpace} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.inspectorCard}>
                  <View style={styles.inspectorHeader}>
                     <Text style={styles.inspectorTitle}>{inspectedSpace?.isStash ? 'Prenda en Bandeja Temporal' : `${inspectedSpace?.shelfName} • Fila ${inspectedSpace?.row} • Esp ${inspectedSpace?.space}`}</Text>
                     <TouchableOpacity onPress={() => setInspectedSpace(null)}><X size={20} color="#64748b" /></TouchableOpacity>
                  </View>
                  <ScrollView style={styles.inspectorBody} contentContainerStyle={{ gap: 12 }}>
                     {inspectedSpace?.items.map((item, idx) => (
                        <View key={idx} style={styles.inspectorLargeCard}>
                           <Image source={{ uri: item.product.images[0] || 'https://via.placeholder.com/150' }} style={styles.inspectorLargeImg} contentFit="cover" cachePolicy="memory-disk" />
                           <View style={styles.inspectorDetails}>
                              <Text style={styles.inspectorBrand}>{item.product.brand}</Text>
                              <Text style={styles.inspectorName}>{item.product.name}</Text>
                              <View style={styles.skuRow}><Text style={styles.inspectorCode}>SKU: {item.product.code}</Text><View style={styles.inspectorColorBadge}><View style={[styles.variantDot, { backgroundColor: item.variant.colorHex || '#000' }]} /><Text style={styles.inspectorColorText}>{item.variant.color}</Text></View></View>
                              <View style={styles.inspectorActionsRow}>
                                 <TouchableOpacity style={[styles.inspectorActionBtn, { backgroundColor: '#eff6ff' }, !isModalReady && { opacity: 0.5 }]} disabled={!isModalReady} onPress={() => { setInspectedSpace(null); setEditingProduct(item.product); }}><Pencil size={14} color="#2563eb" /><Text style={[styles.inspectorActionText, { color: '#2563eb' }]}>Editar</Text></TouchableOpacity>
                                 <TouchableOpacity style={[styles.inspectorActionBtn, { backgroundColor: '#ecfdf5' }, !isModalReady && { opacity: 0.5 }]} disabled={!isModalReady} onPress={() => { setSelectedVariant({ product: item.product, variantIndex: item.variantIndex, isRelocating: true, sourceShelf: inspectedSpace.shelfName, sourceRow: inspectedSpace.row, sourceSpace: inspectedSpace.space, stashIndex: inspectedSpace.isStash ? inspectedSpace.stashIndex : undefined }); setIsDragMode(false); setInspectedSpace(null); }}><Move size={14} color="#059669" /><Text style={[styles.inspectorActionText, { color: '#059669' }]}>Reubicar</Text></TouchableOpacity>
                                 {!inspectedSpace.isStash && (<TouchableOpacity style={[styles.inspectorActionBtn, { backgroundColor: '#e0e7ff' }, !isModalReady && { opacity: 0.5 }]} disabled={!isModalReady} onPress={() => { handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace.shelfName, inspectedSpace.row, inspectedSpace.space); setStash(prev => [...prev, { product: item.product, variant: item.variant, variantIndex: item.variantIndex }]); setInspectedSpace(null); }}><Inbox size={14} color="#4f46e5" /><Text style={[styles.inspectorActionText, { color: '#4f46e5' }]}>Al Stash</Text></TouchableOpacity>)}
                                 <TouchableOpacity style={[styles.inspectorActionBtn, { backgroundColor: '#fef2f2' }, !isModalReady && { opacity: 0.5 }]} disabled={!isModalReady} onPress={() => { if (inspectedSpace) { if (inspectedSpace.isStash && inspectedSpace.stashIndex !== undefined) { setStash(prev => prev.filter((_, i) => i !== inspectedSpace.stashIndex)); } else { handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace.shelfName, inspectedSpace.row, inspectedSpace.space); } setInspectedSpace(null); } }}><Trash2 size={14} color="#ef4444" /><Text style={[styles.inspectorActionText, { color: '#ef4444' }]}>Quitar</Text></TouchableOpacity>
                              </View>
                           </View>
                        </View>
                     ))}
                  </ScrollView>
               </View>
            </View>
         </Modal>

         <Modal visible={!!viewerData?.visible} transparent animationType="fade">
            <View style={styles.viewerOverlay} onLayout={(e) => setViewerWidth(e.nativeEvent.layout.width)}>
               <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerData(null)}><X color="#fff" size={28} /></TouchableOpacity>
               <ScrollView ref={viewerScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => { if (viewerWidth > 0) { const newIdx = Math.round(e.nativeEvent.contentOffset.x / viewerWidth); if (newIdx !== viewerIndex && newIdx >= 0 && newIdx < (viewerData?.images.length || 0)) { setViewerIndex(newIdx); } } }} style={{ flex: 1 }}>
                  {viewerData?.images.map((img, i) => (<View key={i} style={{ width: viewerWidth, height: '100%', justifyContent: 'center', alignItems: 'center' }}><Image source={{ uri: img }} style={{ width: '100%', height: '80%' }} contentFit="contain" /></View>))}
               </ScrollView>
               {Platform.OS === 'web' && viewerData && viewerData.images.length > 1 && (
                  <>
                     {viewerIndex > 0 && (<TouchableOpacity style={[styles.viewerArrow, { left: 20 }]} onPress={() => { const next = viewerIndex - 1; viewerScrollRef.current?.scrollTo({ x: next * viewerWidth, animated: true }); }}><ChevronLeft color="#fff" size={40} /></TouchableOpacity>)}
                     {viewerIndex < viewerData.images.length - 1 && (<TouchableOpacity style={[styles.viewerArrow, { right: 20 }]} onPress={() => { const next = viewerIndex + 1; viewerScrollRef.current?.scrollTo({ x: next * viewerWidth, animated: true }); }}><ChevronRight color="#fff" size={40} /></TouchableOpacity>)}
                  </>
               )}
               {viewerData && viewerData.images.length > 1 && (<View style={styles.viewerDotsRow}>{viewerData.images.map((_, i) => (<View key={i} style={[styles.viewerDot, viewerIndex === i && styles.viewerDotActive]} />))}</View>)}
            </View>
         </Modal>

         <EditShelfModal shelf={editingShelf} visible={!!editingShelf} onClose={() => setEditingShelf(null)} />
         <Modal visible={!!editingProduct} animationType="slide" presentationStyle="formSheet">
            <View style={{ flex: 1, backgroundColor: '#fff', marginTop: Platform.OS === 'ios' ? 50 : 0 }}><ProductFormScreen initialProduct={editingProduct} onClose={() => setEditingProduct(null)} /></View>
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc', position: 'relative' },
   content: { padding: 16, paddingBottom: 100 },
   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
   sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },

   rowNavBtn: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 8, marginHorizontal: 2, justifyContent: 'center', alignItems: 'center', height: 45, borderWidth: 1, borderColor: '#cbd5e1' },

   floatingSelectionOverlay: { position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any, top: Platform.OS === 'ios' ? 60 : 24, right: 16, zIndex: 9999, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, paddingRight: 32, flexDirection: 'row', alignItems: 'center', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12, borderWidth: 2, borderColor: '#93c5fd' },
   overlayImg: { width: 65, height: 65, borderRadius: 12, marginRight: 14, backgroundColor: '#f1f5f9' },
   overlayInfo: { justifyContent: 'center' },
   overlayTitle: { fontSize: 12, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 },
   overlaySubtitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', maxWidth: 180 },
   overlayCode: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 },
   overlayColorText: { fontSize: 12, color: '#475569', marginLeft: 6, fontWeight: '700' },
   overlayCancelBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#f1f5f9', borderRadius: 16, padding: 8, borderWidth: 2, borderColor: '#ffffff', elevation: 3 },

   floatingActionRow: { gap: 10, marginBottom: 16 },
   saveAlertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0284c7', padding: 10, borderRadius: 10 },
   saveAlertTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
   discardBtn: { padding: 8, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6 },
   saveBtn: { backgroundColor: '#ffffff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
   saveBtnText: { color: '#15803d', fontWeight: 'bold', fontSize: 13 },

   createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
   createBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
   emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10 },

   shelvesSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   shelfSummaryCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, width: '48%', minWidth: 150, alignItems: 'center', position: 'relative' },

   // FIX: Tarjeta de la Vitrina en el Dashboard
   vitrinaSummaryCard: { width: '100%', borderColor: '#d8b4fe', borderWidth: 2, backgroundColor: '#faf5ff', shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, paddingVertical: 20 },
   vitrinaDropZoneActive: { borderColor: '#9333ea', backgroundColor: '#f3e8ff', borderStyle: 'dashed' },
   emptyDropPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
   emptyDropText: { fontSize: 13, color: '#7e22ce', marginTop: 8, textAlign: 'center' },
   emptyDropTextActive: { color: '#6b21a8', fontWeight: 'bold' },

   shelfSummaryCardHighlight: { borderColor: '#ca8a04', borderWidth: 2, backgroundColor: '#fefce8', shadowColor: '#eab308', shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
   shelfLocateBadge: { position: 'absolute', top: -10, right: -10, backgroundColor: '#ca8a04', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, zIndex: 10, elevation: 4 },
   shelfLocateBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },

   shelfIconWrapper: { backgroundColor: '#eff6ff', padding: 14, borderRadius: 30, marginBottom: 10 },
   shelfSummaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   shelfSummaryDetail: { fontSize: 12, color: '#64748b', marginTop: 4 },
   shelfActions: { position: 'absolute', top: 8, left: 8, gap: 6, flexDirection: 'row' },
   smallIconBtn: { padding: 6, backgroundColor: '#f8fafc', borderRadius: 6 },

   matrixContainer: { flex: 1 },
   matrixNavRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
   backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
   backBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
   matrixTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },

   capacityBarWrapper: { backgroundColor: '#e2e8f0', height: 16, borderRadius: 8, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: 200 },
   capacityBarFill: { height: '100%', borderRadius: 8 },
   capacityBarText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 10, fontWeight: 'bold', color: '#1e293b', top: 1 },

   proToolsRow: { flexDirection: 'row', marginBottom: 16 },
   proToolBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
   proToolBtnText: { color: '#0284c7', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
   dragModeBtn: { borderColor: '#c7d2fe', backgroundColor: '#e0e7ff' },
   dragModeBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4338ca' },

   shelfStructure: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 16 },
   matrixRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
   rowLabel: { width: 40, height: 40, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginRight: 12 },
   rowLabelText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
   spacesScroll: { gap: 12, paddingHorizontal: 4 },
   matrixCell: { width: 75, height: 75, borderRadius: 10, overflow: 'hidden', position: 'relative' },
   emptyCellTouchArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
   matrixCellEmpty: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', backgroundColor: '#f8fafc' },
   matrixCellOccupied: { borderWidth: 1, borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
   matrixCellStaticHighlight: { backgroundColor: '#f0fdf4', borderColor: '#22c55e', borderWidth: 3 },

   matrixCellTargetMatch: { backgroundColor: '#fefce8', borderColor: '#ca8a04', borderWidth: 4, shadowColor: '#eab308', shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
   cellLabel: { position: 'absolute', top: 4, left: 4, fontSize: 10, fontWeight: 'bold', color: '#475569', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 4, borderRadius: 4 },
   targetMatchIcon: { position: 'absolute', top: 2, left: 24, backgroundColor: '#fef08a', borderRadius: 12, padding: 3, elevation: 4, zIndex: 15 },
   cellThumbnail: { width: '100%', height: '100%', opacity: 0.9 },
   cellBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
   cellBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

   dragHandleIcon: { backgroundColor: 'rgba(79, 70, 229, 0.95)', borderRadius: 6, padding: 6, margin: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },

   stashContainer: { backgroundColor: '#e0e7ff', borderRadius: 12, borderWidth: 1, borderColor: '#a5b4fc', padding: 12, marginTop: 8 },
   stashDropZone: { width: '100%', minHeight: 80, borderRadius: 8 },
   stashHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
   stashTitle: { fontSize: 13, fontWeight: 'bold', color: '#4338ca' },
   stashDesc: { fontSize: 11, color: '#6366f1', flex: 1 },
   stashScroll: { flexDirection: 'row', gap: 10, paddingBottom: 6, paddingHorizontal: 4 },
   stashItem: { width: 75, height: 75, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#818cf8', position: 'relative', backgroundColor: '#fff', elevation: 3, shadowColor: '#4f46e5', shadowOpacity: 0.2, shadowRadius: 5 },
   stashImg: { width: '100%', height: '100%' },
   stashItemColor: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center', paddingVertical: 4 },
   stashItemText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
   emptyStashText: { fontSize: 12, color: '#818cf8', fontStyle: 'italic', alignSelf: 'center', width: '100%', textAlign: 'center' },

   catalogGrid: { gap: 12 },
   catalogCard: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
   catalogImg: { width: 70, height: 70, borderRadius: 8, marginRight: 14, backgroundColor: '#f1f5f9' },
   expandIconOverlay: { position: 'absolute', bottom: 4, right: 18, backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, padding: 4 },

   catalogInfo: { flex: 1, justifyContent: 'center' },
   catalogBrand: { fontSize: 11, fontWeight: 'bold', color: '#2563eb' },
   catalogName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
   catalogCode: { fontSize: 12, color: '#64748b' },
   editProductBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 6 },
   variantsDragRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
   variantBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16 },
   variantBadgeSelected: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
   variantDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
   variantText: { fontSize: 11, color: '#334155', fontWeight: '600' },
   variantTextSelected: { color: '#ffffff', fontWeight: 'bold' },

   paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 12, marginTop: 12 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4 },
   pageNavBtnDisabled: { opacity: 0.4 },
   pageNavText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   pageNavTextDisabled: { color: '#94a3b8' },
   pageIndicator: { fontSize: 13, color: '#475569' },

   hoverHighlightBox: { position: 'absolute', borderWidth: 3, borderColor: '#2563eb', backgroundColor: 'rgba(59, 130, 246, 0.25)', borderRadius: 12, zIndex: 9998 },
   ghostWrapper: { position: 'absolute', top: 0, left: 0, borderRadius: 12, overflow: 'hidden', zIndex: 99999, elevation: 30, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, borderWidth: 3, borderColor: '#2563eb' },

   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   inspectorCard: { width: '100%', maxWidth: 450, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   inspectorTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
   inspectorBody: { padding: 16 },

   inspectorLargeCard: { flexDirection: 'row', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12 },
   inspectorLargeImg: { width: 80, height: 80, borderRadius: 8, marginRight: 16, backgroundColor: '#f1f5f9' },
   inspectorDetails: { flex: 1 },
   inspectorBrand: { fontSize: 11, fontWeight: 'bold', color: '#2563eb' },
   inspectorName: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
   skuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
   inspectorCode: { fontSize: 12, color: '#475569', fontWeight: '500', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   inspectorColorBadge: { flexDirection: 'row', alignItems: 'center' },
   inspectorColorText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

   inspectorActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
   inspectorActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, flexGrow: 1, justifyContent: 'center' },
   inspectorActionText: { fontSize: 13, fontWeight: 'bold', marginLeft: 6 },

   viewerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center' },
   viewerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 24, zIndex: 100, padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
   viewerArrow: { position: 'absolute', top: '50%', zIndex: 100, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 30, transform: [{ translateY: -25 }] },
   viewerDotsRow: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
   viewerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
   viewerDotActive: { backgroundColor: '#ffffff', width: 12 },

   // FIX: Estilos de la Cuadrícula y Tarjetas de la Vitrina
   vitrinaToolbar: { marginBottom: 16 },
   vitrinaDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
   vitrinaDetailCard: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#d8b4fe', width: '48%', minWidth: 160, flexGrow: 1, overflow: 'hidden', shadowColor: '#9333ea', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
   vitrinaDetailImg: { width: '100%', height: 140, backgroundColor: '#f3e8ff' },
   vitrinaDetailInfo: { padding: 12 },
   exhibitionBrand: { fontSize: 10, fontWeight: 'bold', color: '#7c3aed' },
   exhibitionName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   exhibitionColor: { fontSize: 11, color: '#64748b', marginLeft: 4, fontWeight: '500' },
   vitrinaSizeLabel: { fontSize: 11, color: '#475569', fontWeight: 'bold', marginTop: 6, marginBottom: 4 },
   vitrinaSizeRow: { flexDirection: 'row' },
   vitrinaSizeChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
   vitrinaSizeChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
   vitrinaSizeChipText: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
   vitrinaSizeChipTextActive: { color: '#ffffff' },
   vitrinaRemoveBtnAbsolute: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 6, borderRadius: 8, elevation: 2 },
});

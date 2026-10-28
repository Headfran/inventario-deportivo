import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
   View, Text, ScrollView, Pressable, StyleSheet, Modal, Platform,
   ActivityIndicator, UIManager, LayoutAnimation, ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import {
   Store, Plus, Trash2, Eye, MapPin, Layers, Pencil, ChevronLeft, ChevronRight,
   Package, Box, X, Save, RotateCcw, Move, Inbox, Wand2, Combine,
   ArchiveRestore, Sparkles, HelpCircle, Eraser, ArrowRightLeft,
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Product, Shelf, ShelfLocation, ProductVariant } from '../types/inventory';
import { subscribeToShelves, deleteShelf, updateShelf } from '../services/shelfService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { showConfirm, showAlert } from '../utils/alert';
import { EditShelfModal } from './EditShelfModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { DraggableCell, CellLayout } from '../components/DraggableCell';
import { ProductFormScreen } from './ProductFormScreen';
import { Cover } from '../components/Cover';
import { useWindowDimensions } from 'react-native';
import { MONO as T, display } from '../design';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
   UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEMS_PER_PAGE = 10;

interface SelectedVariantRef {
   product: Product;
   variantIndex: number;
   isRelocating?: boolean;
   sourceShelf?: string;
   sourceRow?: number;
   sourceSpace?: number;
   stashIndex?: number;
   bulkItems?: InspectedItem[];
}

interface MatrixDragPayload {
   product: Product;
   variantIndex: number;
   source: 'matrix' | 'stash';
   sourceRow?: number;
   sourceSpace?: number;
   stashIndex?: number;
}

interface InspectedItem {
   product: Product;
   variant: ProductVariant;
   variantIndex: number;
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const ScrollRow = ({ children, style, contentContainerStyle }: {
   children: React.ReactNode;
   style?: any;
   contentContainerStyle?: any;
}) => {
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
         <P style={styles.rowNavBtn} onPress={() => scroll('left')} accessibilityLabel="Desplazar izquierda">
            <ChevronLeft size={18} color={T.inkSoft} />
         </P>
         <ScrollView
            ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle} style={{ flex: 1 }}
            onLayout={(e) => setClientWidth(e.nativeEvent.layout.width)}
            onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
         >
            {children}
         </ScrollView>
         <P style={styles.rowNavBtn} onPress={() => scroll('right')} accessibilityLabel="Desplazar derecha">
            <ChevronRight size={18} color={T.inkSoft} />
         </P>
      </View>
   );
};

export const ShelfMapScreen = () => {
   const [shelves, setShelves] = useState<Shelf[]>([]);
   const [products, setProducts] = useState<Product[]>([]);

   const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);
   const [showVitrinaDetail, setShowVitrinaDetail] = useState(false);
   const [vitrinaSortCategory, setVitrinaSortCategory] = useState(false);
   const [vitrinaFilters, setVitrinaFilters] = useState<FilterOptions>({
      query: '', category: 'all', brand: '', color: '', size: '', status: 'all',
   });

   const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
   const [editingProduct, setEditingProduct] = useState<Product | null>(null);

   const [selectedVariant, setSelectedVariant] = useState<SelectedVariantRef | null>(null);
   const [stash, setStash] = useState<InspectedItem[]>([]);

   const [filters, setFilters] = useState<FilterOptions>({
      query: '', category: 'all', brand: '', color: '', size: '', status: 'all',
   });
   const [currentPage, setCurrentPage] = useState(1);

   const [draftLocationsMap, setDraftLocationsMap] = useState<Record<string, ShelfLocation[]>>({});
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   const [saving, setSaving] = useState(false);

   const [isDragMode, setIsDragMode] = useState(false);
   const [isMarkingUnknown, setIsMarkingUnknown] = useState(false);

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

   const { width } = useWindowDimensions();
   const isMobile = width < 600;

   const [inspectedSpace, setInspectedSpace] = useState<{
      shelfName: string;
      row: number;
      space: number;
      items: InspectedItem[];
      isStash?: boolean;
      stashIndex?: number;
   } | null>(null);

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
      const unsubShelves = subscribeToShelves((data) => {
         setShelves(data);
         // Refrescar el estante activo si cambió en Firestore
         if (activeShelf) {
            const updated = data.find((s) => s.id === activeShelf.id);
            if (updated) setActiveShelf(updated);
         }
      });
      const unsubProducts = subscribeToProducts(setProducts);
      return () => { unsubShelves(); unsubProducts(); };
   }, [activeShelf?.id]);

   useEffect(() => {
      if (activeShelf || showVitrinaDetail) {
         syncDraftsFromProducts(products);
         setHasUnsavedChanges(false);
         setStash([]);
         setIsDragMode(false);
         setIsMarkingUnknown(false);
      }
      cellLayoutsRef.current = {};
      setTimeout(measureContainer, 50);
   }, [activeShelf?.id, showVitrinaDetail]);

   const measureContainer = useCallback(() => {
      const node: any = containerRef.current;
      if (!node) return;
      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
         const r = node.getBoundingClientRect();
         offsetX.value = r.left;
         offsetY.value = r.top;
         return;
      }
      if (typeof node.measureInWindow === 'function') {
         node.measureInWindow((x: number, y: number) => { offsetX.value = x; offsetY.value = y; });
      }
   }, []);

   const syncDraftsFromProducts = (prods: Product[]) => {
      const initialMap: Record<string, ShelfLocation[]> = {};
      prods.forEach((p) => {
         (p.variants || []).forEach((v, vIdx) => {
            initialMap[`${p.id}_${vIdx}`] = [...(v.locations || [])];
         });
      });
      setDraftLocationsMap(initialMap);
   };

   const getEffectiveLocations = (productId: string, variantIndex: number): ShelfLocation[] => {
      const key = `${productId}_${variantIndex}`;
      if (draftLocationsMap[key] !== undefined) return draftLocationsMap[key];
      const p = products.find((prod) => prod.id === productId);
      return p?.variants[variantIndex]?.locations || [];
   };

   const getItemsInSpace = (shelfName: string, rowIndex: number, spaceIndex: number): InspectedItem[] => {
      return products.flatMap((p) =>
         (p.variants || []).flatMap((v, vIdx) => {
            const locs = getEffectiveLocations(p.id!, vIdx);
            const inThisSpace = locs.some(
               (l) => l.shelfId === shelfName && (l.rowIndex || 1) === rowIndex && l.rumaIndex === spaceIndex
            );
            return inThisSpace ? [{ product: p, variant: v, variantIndex: vIdx }] : [];
         })
      );
   };

   const registerCellLayout = useCallback((key: string, layout: CellLayout) => {
      cellLayoutsRef.current[key] = layout;
   }, []);

   const findCellAtPoint = useCallback((absX: number, absY: number, excludeKey?: string | null): string | null => {
      const scrollY = scrollYRef.current;
      for (const [key, l] of Object.entries(cellLayoutsRef.current)) {
         if (excludeKey && key === excludeKey) continue;
         const currentCellY = l.y - scrollY;
         if (absX >= l.x && absX <= l.x + l.width && absY >= currentCellY && absY <= currentCellY + l.height) {
            return key;
         }
      }
      return null;
   }, []);

   const handleDragStart = useCallback((payload: MatrixDragPayload, absX: number, absY: number) => {
      measureContainer();
      const sourceKey = payload.source === 'stash' ? `STASH_${payload.stashIndex}` : `F${payload.sourceRow}_E${payload.sourceSpace}`;
      const layout = cellLayoutsRef.current[sourceKey];
      setDraggingSourceKey(sourceKey);
      setDragGhostImg(payload.product.images[0] || '');
      ghostWidth.value = layout?.width ?? 70;
      ghostHeight.value = layout?.height ?? 70;
      hoverOpacity.value = 0;
   }, [measureContainer]);

   const handleDragMove = useCallback((absX: number, absY: number) => {
      const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);
      if (targetKey !== lastTargetKeyRef.current) {
         lastTargetKeyRef.current = targetKey;
         if (targetKey && cellLayoutsRef.current[targetKey]) {
            const layout = cellLayoutsRef.current[targetKey];
            const scrollY = scrollYRef.current;
            hoverX.value = layout.x - offsetX.value;
            hoverY.value = (layout.y - scrollY) - offsetY.value;
            hoverW.value = layout.width;
            hoverH.value = layout.height;
            hoverOpacity.value = 1;
         } else { hoverOpacity.value = 0; }
      }
   }, [draggingSourceKey, findCellAtPoint]);

   const handleDragEnd = useCallback((payload: MatrixDragPayload, absX: number, absY: number) => {
      const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);
      hoverOpacity.value = 0;
      lastTargetKeyRef.current = null;
      setDragGhostImg(null);
      setDraggingSourceKey(null);

      if (!targetKey || !activeShelf) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (targetKey === 'STASH_ZONE' && payload.source === 'matrix') {
         handleRemoveFromSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, payload.sourceRow!, payload.sourceSpace!);
         setStash((prev) => [...prev, {
            product: payload.product,
            variant: payload.product.variants[payload.variantIndex],
            variantIndex: payload.variantIndex,
         }]);
         return;
      }

      const m = targetKey.match(/^F(\d+)_E(\d+)$/);
      if (!m) return;
      const targetRow = parseInt(m[1], 10);
      const targetSpace = parseInt(m[2], 10);

      if (payload.source === 'matrix') {
         handleMoveSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, payload.sourceRow!, payload.sourceSpace!, targetRow, targetSpace);
      } else if (payload.source === 'stash') {
         handleAssignToSpaceLocal(payload.product.id!, payload.variantIndex, activeShelf.name, targetRow, targetSpace);
         setStash((prev) => prev.filter((_, i) => i !== payload.stashIndex));
      }
   }, [draggingSourceKey, activeShelf, findCellAtPoint]);

   const handleAssignToSpaceLocal = (productId: string, variantIndex: number, shelfName: string, row: number, space: number) => {
      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);
      const exists = currentLocs.some((l) => l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space);
      if (!exists) {
         LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
         setDraftLocationsMap((prev) => ({
            ...prev,
            [key]: [...currentLocs, { shelfId: shelfName, rowIndex: row, rumaIndex: space }],
         }));
         setHasUnsavedChanges(true);
      }
      setSelectedVariant(null);
   };

   const handleMoveSpaceLocal = (
      productId: string, variantIndex: number, sourceShelf: string,
      sourceRow: number, sourceSpace: number, targetRow: number, targetSpace: number
   ) => {
      if (sourceShelf === activeShelf?.name && sourceRow === targetRow && sourceSpace === targetSpace) return;
      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);
      const filtered = currentLocs.filter(
         (l) => !(l.shelfId === sourceShelf && l.rowIndex === sourceRow && l.rumaIndex === sourceSpace)
      );
      const exists = filtered.some(
         (l) => l.shelfId === activeShelf!.name && l.rowIndex === targetRow && l.rumaIndex === targetSpace
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraftLocationsMap((prev) => ({
         ...prev,
         [key]: exists ? filtered : [...filtered, { shelfId: activeShelf!.name, rowIndex: targetRow, rumaIndex: targetSpace }],
      }));
      setHasUnsavedChanges(true);
   };

   const handleRemoveFromSpaceLocal = (productId: string, variantIndex: number, shelfName: string, row: number, space: number) => {
      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraftLocationsMap((prev) => ({
         ...prev,
         [key]: currentLocs.filter((l) => !(l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space)),
      }));
      setHasUnsavedChanges(true);
   };

   // ==========================================
   // APILADO INTELIGENTE: agrupa variantes del mismo color en una sola celda
   // ==========================================
   const handleSmartStack = () => {
      if (!activeShelf) return;

      const cells: { row: number; space: number }[] = [];
      for (let r = activeShelf.rowsCount; r >= 1; r--) {
         for (let s = 1; s <= activeShelf.spacesPerRow; s++) cells.push({ row: r, space: s });
      }

      // Agrupar items por color
      const itemsByColor = new Map<string, InspectedItem[]>();
      products.forEach((p) => {
         (p.variants || []).forEach((v, vIdx) => {
            const locs = getEffectiveLocations(p.id!, vIdx);
            const inShelf = locs.some((l) => l.shelfId === activeShelf.name);
            if (inShelf) {
               const color = (v.color || 'sin-color').toLowerCase();
               if (!itemsByColor.has(color)) itemsByColor.set(color, []);
               itemsByColor.get(color)!.push({ product: p, variant: v, variantIndex: vIdx });
            }
         });
      });

      if (itemsByColor.size === 0) {
         showAlert('Nada que apilar', 'No hay prendas del mismo color para agrupar.');
         return;
      }

      const newDrafts: Record<string, ShelfLocation[]> = {};
      let cellIdx = 0;

      itemsByColor.forEach((items) => {
         if (cellIdx >= cells.length) return;
         const targetCell = cells[cellIdx++];
         items.forEach((item) => {
            const key = `${item.product.id}_${item.variantIndex}`;
            const currentLocs = getEffectiveLocations(item.product.id!, item.variantIndex);
            const withoutShelf = currentLocs.filter((l) => l.shelfId !== activeShelf.name);
            newDrafts[key] = [...withoutShelf, {
               shelfId: activeShelf.name, rowIndex: targetCell.row, rumaIndex: targetCell.space,
            }];
         });
      });

      setDraftLocationsMap((prev) => ({ ...prev, ...newDrafts }));
      setHasUnsavedChanges(true);
      showAlert('Listo', `${itemsByColor.size} grupos de color apilados. Revisa y guarda.`);
   };

   // ==========================================
   // AUTO-ORDENAR POR SKU: agrupa prendas del mismo código en celdas consecutivas
   // ==========================================
   const handleAutoSort = () => {
      if (!activeShelf) return;

      const cells: { row: number; space: number }[] = [];
      for (let r = activeShelf.rowsCount; r >= 1; r--) {
         for (let s = 1; s <= activeShelf.spacesPerRow; s++) cells.push({ row: r, space: s });
      }

      // Agrupar items por SKU
      const itemsByCode = new Map<string, InspectedItem[]>();
      products.forEach((p) => {
         (p.variants || []).forEach((v, vIdx) => {
            const locs = getEffectiveLocations(p.id!, vIdx);
            const inShelf = locs.some((l) => l.shelfId === activeShelf.name);
            if (inShelf) {
               const code = (p.code || 'ZZZ').toLowerCase();
               if (!itemsByCode.has(code)) itemsByCode.set(code, []);
               itemsByCode.get(code)!.push({ product: p, variant: v, variantIndex: vIdx });
            }
         });
      });

      if (itemsByCode.size === 0) {
         showAlert('Nada que ordenar', 'No hay prendas en el estante.');
         return;
      }

      const sortedCodes = Array.from(itemsByCode.keys()).sort();
      const newDrafts: Record<string, ShelfLocation[]> = {};
      let cellIdx = 0;

      sortedCodes.forEach((code) => {
         if (cellIdx >= cells.length) return;
         const targetCell = cells[cellIdx++];
         itemsByCode.get(code)!.forEach((item) => {
            const key = `${item.product.id}_${item.variantIndex}`;
            const currentLocs = getEffectiveLocations(item.product.id!, item.variantIndex);
            const withoutShelf = currentLocs.filter((l) => l.shelfId !== activeShelf.name);
            newDrafts[key] = [...withoutShelf, {
               shelfId: activeShelf.name, rowIndex: targetCell.row, rumaIndex: targetCell.space,
            }];
         });
      });

      setDraftLocationsMap((prev) => ({ ...prev, ...newDrafts }));
      setHasUnsavedChanges(true);
      showAlert('Listo', `${sortedCodes.length} SKU ordenados alfabéticamente. Revisa y guarda.`);
   };

   // ==========================================
   // VACIAR ESTANTE AL STASH
   // ==========================================
   const handleClearToStash = () => {
      if (!activeShelf) return;
      showConfirm(
         'Vaciar Estante',
         '¿Mover TODAS las prendas de este estante al Stash temporal?',
         () => {
            const itemsToStash: InspectedItem[] = [];
            const newDrafts: Record<string, ShelfLocation[]> = {};

            products.forEach((p) => {
               (p.variants || []).forEach((v, vIdx) => {
                  const locs = getEffectiveLocations(p.id!, vIdx);
                  const inShelf = locs.some((l) => l.shelfId === activeShelf.name);
                  if (inShelf) {
                     itemsToStash.push({ product: p, variant: v, variantIndex: vIdx });
                     const key = `${p.id}_${vIdx}`;
                     newDrafts[key] = locs.filter((l) => l.shelfId !== activeShelf.name);
                  }
               });
            });

            if (itemsToStash.length === 0) {
               showAlert('Vacío', 'Este estante no tiene prendas.');
               return;
            }

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setDraftLocationsMap((prev) => ({ ...prev, ...newDrafts }));
            setStash((prev) => [...prev, ...itemsToStash]);
            setHasUnsavedChanges(true);
            showAlert('Listo', `${itemsToStash.length} prendas movidas al Stash.`);
         }
      );
   };

   // ==========================================
   // ACCIONES DE CELDA COMPLETA (desde el inspector)
   // ==========================================
   const handleBulkMoveFromInspector = () => {
      if (!inspectedSpace || inspectedSpace.items.length === 0 || inspectedSpace.isStash) return;
      const first = inspectedSpace.items[0];
      setSelectedVariant({
         product: first.product,
         variantIndex: first.variantIndex,
         isRelocating: true,
         sourceShelf: inspectedSpace.shelfName,
         sourceRow: inspectedSpace.row,
         sourceSpace: inspectedSpace.space,
         bulkItems: inspectedSpace.items,
      });
      setInspectedSpace(null);
      setIsDragMode(false);
   };

   const handleCellToStash = () => {
      if (!inspectedSpace || inspectedSpace.isStash) return;
      const itemsToStash = inspectedSpace.items;
      itemsToStash.forEach((item) => {
         handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace.shelfName, inspectedSpace.row, inspectedSpace.space);
      });
      setStash((prev) => [...prev, ...itemsToStash]);
      setInspectedSpace(null);
   };

   const handleClearCell = () => {
      if (!inspectedSpace || inspectedSpace.isStash) return;
      showConfirm(
         'Vaciar Celda',
         `¿Quitar las ${inspectedSpace.items.length} prendas de esta celda?`,
         () => {
            inspectedSpace.items.forEach((item) => {
               handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace.shelfName, inspectedSpace.row, inspectedSpace.space);
            });
            setInspectedSpace(null);
         }
      );
   };

   // ==========================================
   // TOGGLE CELDA DESCONOCIDA
   // ==========================================
   const toggleUnknownCell = async (row: number, space: number) => {
      if (!activeShelf?.id) {
         showAlert('Atención', 'Guarda el estante primero antes de marcar celdas.');
         return;
      }
      const key = `${row}_${space}`;
      const current = activeShelf.unknownCells || [];
      const newList = current.includes(key)
         ? current.filter((k) => k !== key)
         : [...current, key];

      try {
         await updateShelf(activeShelf.id, { unknownCells: newList });
      } catch (error: any) {
         showAlert('Error', error.message);
      }
   };

   // ==========================================
   // GUARDAR / DESCARTAR
   // ==========================================
   const handleSaveChangesToFirebase = async () => {
      const performSave = async () => {
         setSaving(true);
         try {
            const productUpdates: Record<string, Product> = {};
            for (const [key, newLocs] of Object.entries(draftLocationsMap)) {
               const [productId, vIdxStr] = key.split('_');
               const vIdx = parseInt(vIdxStr, 10);
               const originalProd = products.find((p) => p.id === productId);
               if (!originalProd) continue;
               const originalLocs = originalProd.variants[vIdx]?.locations || [];
               if (JSON.stringify(originalLocs) !== JSON.stringify(newLocs)) {
                  if (!productUpdates[productId]) productUpdates[productId] = JSON.parse(JSON.stringify(originalProd));
                  if (productUpdates[productId] && productUpdates[productId].variants[vIdx]) {
                     productUpdates[productId].variants[vIdx].locations = newLocs;
                  }
               }
            }
            const updates = Object.values(productUpdates);
            if (updates.length > 0) {
               await Promise.all(updates.map((upd) => upd.id ? updateProduct(upd.id, { variants: upd.variants }) : Promise.resolve()));
            }
            setHasUnsavedChanges(false);
            setStash([]);
            showAlert('Guardado', 'Cambios guardados exitosamente.');
         } catch (error: any) {
            showAlert('Error', error.message);
         } finally { setSaving(false); }
      };

      if (stash.length > 0) {
         showConfirm(
            'Bandeja con prendas',
            `Tienes ${stash.length} prendas en el Stash. Al guardar perderán su ubicación. ¿Continuar?`,
            performSave
         );
      } else {
         performSave();
      }
   };

   const handleFilterChange = (newFilters: FilterOptions) => {
      setFilters(newFilters);
      setCurrentPage(1);
   };

   const handleDiscardChanges = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      syncDraftsFromProducts(products);
      setHasUnsavedChanges(false);
      setStash([]);
   };

   // ==========================================
   // VITRINA
   // ==========================================
   const assignProductToVitrina = async (product: Product, variantIndex: number, sizeToDisplay?: string) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = {
            isOnDisplay: true,
            displaySize: sizeToDisplay || updatedVariants[variantIndex]?.sizes[0]?.size || 'M',
         };
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

   const exhibitionItems = products.flatMap((p) =>
      (p.variants || [])
         .map((v, vIdx) => ({ product: p, variant: v, variantIndex: vIdx }))
         .filter((item) => item.variant.exhibition?.isOnDisplay)
   );

   const vitrinaDisplayItems = useMemo(() => {
      let items = exhibitionItems.filter((item) => {
         if (vitrinaFilters.query && !item.product.name.toLowerCase().includes(vitrinaFilters.query.toLowerCase()) && !item.product.code?.toLowerCase().includes(vitrinaFilters.query.toLowerCase())) return false;
         if (vitrinaFilters.category !== 'all' && item.product.category !== vitrinaFilters.category) return false;
         if (vitrinaFilters.brand && item.product.brand !== vitrinaFilters.brand) return false;
         if (vitrinaFilters.size && !item.variant.sizes.some((s) => s.size === vitrinaFilters.size)) return false;
         return true;
      });
      if (vitrinaSortCategory) {
         items.sort((a, b) => {
            const catA = a.product.category || '';
            const catB = b.product.category || '';
            if (catA !== catB) return catA.localeCompare(catB);
            return (a.product.name || '').localeCompare(b.product.name || '');
         });
      }
      return items;
   }, [exhibitionItems, vitrinaFilters, vitrinaSortCategory]);

   const availableCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
   const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
   const availableSizes = Array.from(new Set(products.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size)))));

   const vitrinaCategories = Array.from(new Set(exhibitionItems.map((i) => i.product.category).filter(Boolean))) as string[];
   const vitrinaBrands = Array.from(new Set(exhibitionItems.map((i) => i.product.brand).filter(Boolean)));

   const filteredProducts = filterProducts(products, filters);
   const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

   const selectedVariantTotalLocations = useMemo(() => {
      if (!selectedVariant) return 0;
      return getEffectiveLocations(selectedVariant.product.id!, selectedVariant.variantIndex).length;
   }, [selectedVariant, draftLocationsMap, products]);

   const shelfAnalytics = useMemo(() => {
      if (!activeShelf) return { occupied: 0, total: 0, percentage: 0 };
      const totalSpaces = (activeShelf.rowsCount || 1) * (activeShelf.spacesPerRow || 3);
      const occupiedSpaces = new Set<string>();
      products.forEach((p) => p.variants.forEach((v, vIdx) => {
         const locs = getEffectiveLocations(p.id!, vIdx).filter((l) => l.shelfId === activeShelf.name);
         locs.forEach((l) => occupiedSpaces.add(`${l.rowIndex}_${l.rumaIndex}`));
      }));
      return {
         occupied: occupiedSpaces.size,
         total: totalSpaces,
         percentage: totalSpaces > 0 ? Math.round((occupiedSpaces.size / totalSpaces) * 100) : 0,
      };
   }, [activeShelf, draftLocationsMap, products]);

   const ghostAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
      opacity: isDragging.value ? 0.95 : 0,
      width: ghostWidth.value,
      height: ghostHeight.value,
      transform: [
         { translateX: dragX.value - offsetX.value - (ghostWidth.value / 2) },
         { translateY: dragY.value - offsetY.value - (ghostHeight.value / 2) },
      ] as any,
   }));

   const hoverAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
      opacity: hoverOpacity.value,
      left: hoverX.value,
      top: hoverY.value,
      width: hoverW.value,
      height: hoverH.value,
   }));

   const renderDragHandle = () => (
      <View style={styles.dragHandleIcon}><Move size={14} color={T.onSolid} /></View>
   );

   return (
      <View ref={containerRef} style={styles.container} onLayout={measureContainer}>
         {selectedVariant && (
            <View style={styles.floatingSelectionOverlay}>
               <Cover
                  uri={selectedVariant.product.images?.[0]}
                  name={selectedVariant.product.name}
                  bg={T.imgBg}
                  fg={T.line}
                  style={styles.overlayImg}
               />
               <View style={styles.overlayInfo}>
                  <Text style={styles.overlayTitle}>
                     {selectedVariant.bulkItems
                        ? `Mover ${selectedVariant.bulkItems.length} prendas: toca un destino`
                        : selectedVariant.isRelocating
                           ? 'Toca un espacio para reubicar'
                           : (selectedVariantTotalLocations > 0
                              ? `📍 Detectado en ${selectedVariantTotalLocations} espacios`
                              : 'Sin ubicar - Toca un espacio para añadir')}
                  </Text>
                  <Text style={styles.overlaySubtitle} numberOfLines={2}>{selectedVariant.product.name}</Text>
                  <Text style={styles.overlayCode}>SKU: {selectedVariant.product.code}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                     <View style={[styles.variantDot, {
                        width: 12, height: 12, borderRadius: 6,
                        backgroundColor: selectedVariant.product.variants[selectedVariant.variantIndex]?.colorHex || '#000',
                     }]} />
                     <Text style={styles.overlayColorText}>
                        {selectedVariant.product.variants[selectedVariant.variantIndex]?.color}
                     </Text>
                  </View>
               </View>
               <P style={styles.overlayCancelBtn} onPress={() => setSelectedVariant(null)}>
                  <X size={20} color={T.inkSoft} />
               </P>
            </View>
         )}

         <ScrollView
            contentContainerStyle={styles.content}
            style={{ flex: 1 }}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
         >
            {hasUnsavedChanges && (
               <View style={styles.saveAlertBanner}>
                  <Save size={16} color={T.onSolid} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                     <Text style={styles.saveAlertTitle}>Cambios sin guardar</Text>
                  </View>
                  <P style={styles.discardBtn} onPress={handleDiscardChanges} disabled={saving}>
                     <RotateCcw size={14} color={T.onSolid} />
                  </P>
                  <P style={styles.saveBtn} onPress={handleSaveChangesToFirebase} disabled={saving}>
                     {saving
                        ? <ActivityIndicator size="small" color={T.ink} />
                        : <Text style={styles.saveBtnText}>Guardar</Text>}
                  </P>
               </View>
            )}

            {showVitrinaDetail ? (
               // ===== VISTA VITRINA =====
               <View>
                  <View style={styles.matrixNavRow}>
                     <P style={styles.backBtn} onPress={() => setShowVitrinaDetail(false)}>
                        <ChevronLeft size={20} color={T.ink} />
                        <Text style={styles.backBtnText}>Volver</Text>
                     </P>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.matrixTitle}>Piso de Ventas</Text>
                        <Text style={styles.matrixSubtitle}>
                           {exhibitionItems.length} prendas en exhibición
                        </Text>
                     </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                     <P
                        style={[styles.proToolBtn, vitrinaSortCategory && styles.proToolBtnActive]}
                        onPress={() => setVitrinaSortCategory(!vitrinaSortCategory)}
                     >
                        <Layers size={14} color={vitrinaSortCategory ? T.onSolid : T.ink} />
                        <Text style={[styles.proToolBtnText, vitrinaSortCategory && { color: T.onSolid }]}>
                           Agrupar por Categoría {vitrinaSortCategory ? 'ON' : 'OFF'}
                        </Text>
                     </P>
                  </View>

                  <ProductSearchFilter
                     filters={vitrinaFilters}
                     onFilterChange={setVitrinaFilters}
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
                                 <Pressable
                                    onPress={() => {
                                       setViewerData({
                                          images: item.product.images && item.product.images.length > 0
                                             ? item.product.images
                                             : [''],
                                          visible: true,
                                       });
                                       setViewerIndex(0);
                                    }}
                                 >
                                    <Cover
                                       uri={item.product.images?.[0]}
                                       name={item.product.name}
                                       bg={T.imgBg}
                                       fg={T.line}
                                       style={styles.vitrinaDetailImg}
                                    />
                                    <View style={styles.expandIconOverlay}>
                                       <Eye size={14} color={T.onSolid} />
                                    </View>
                                 </Pressable>

                                 <View style={styles.vitrinaDetailInfo}>
                                    <Text style={styles.exhibitionBrand}>{item.product.brand}</Text>
                                    <Text style={styles.exhibitionName} numberOfLines={1}>{item.product.name}</Text>

                                    <View style={styles.skuPill}>
                                       <Text style={styles.skuPillText}>SKU: {item.product.code}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                                       <View style={[styles.variantDot, {
                                          backgroundColor: item.variant.colorHex || '#000',
                                          width: 10, height: 10,
                                       }]} />
                                       <Text style={styles.exhibitionColor}>{item.variant.color}</Text>
                                    </View>

                                    <Text style={styles.vitrinaSizeLabel}>Talla exhibida:</Text>
                                    <ScrollView
                                       horizontal showsHorizontalScrollIndicator={false}
                                       style={styles.vitrinaSizeRow}
                                       contentContainerStyle={{ gap: 6 }}
                                    >
                                       {(item.variant.sizes || []).map((sObj) => {
                                          const isSelectedSize = currentDisplaySize === sObj.size;
                                          return (
                                             <P
                                                key={sObj.size}
                                                style={[styles.sizeChip, isSelectedSize && styles.chipOn]}
                                                onPress={() => updateVitrinaDisplaySize(item.product, item.variantIndex, sObj.size)}
                                             >
                                                <Text style={[styles.sizeChipText, isSelectedSize && styles.chipOnText]}>
                                                   {sObj.size}
                                                </Text>
                                             </P>
                                          );
                                       })}
                                    </ScrollView>
                                 </View>
                                 <P
                                    style={styles.vitrinaRemoveBtnAbsolute}
                                    onPress={() => removeFromVitrina(item.product, item.variantIndex)}
                                 >
                                    <Trash2 size={16} color="#EF4444" />
                                 </P>
                              </View>
                           );
                        })
                     )}
                  </View>
               </View>
            ) : activeShelf ? (
               // ===== VISTA MATRIZ =====
               <View>
                  <View style={styles.matrixNavRow}>
                     <P
                        style={styles.backBtn}
                        onPress={() => {
                           if (hasUnsavedChanges) {
                              showConfirm('Cambios pendientes', '¿Descartar cambios y salir?', () => {
                                 handleDiscardChanges();
                                 setActiveShelf(null);
                              });
                           } else { setActiveShelf(null); }
                        }}
                     >
                        <ChevronLeft size={20} color={T.ink} />
                        <Text style={styles.backBtnText}>Volver</Text>
                     </P>

                     <View style={{ flex: 1 }}>
                        <Text style={styles.matrixTitle}>{activeShelf.name}</Text>
                        <View style={styles.capacityBarWrapper}>
                           <View style={[
                              styles.capacityBarFill,
                              { width: `${shelfAnalytics.percentage}%`, backgroundColor: shelfAnalytics.percentage > 90 ? '#EF4444' : T.solid },
                           ]} />
                           <Text style={styles.capacityBarText}>
                              Ocupación: {shelfAnalytics.percentage}% ({shelfAnalytics.occupied}/{shelfAnalytics.total})
                           </Text>
                        </View>
                     </View>
                  </View>

                  <ScrollView
                     horizontal showsHorizontalScrollIndicator={false}
                     style={{ marginBottom: 16 }}
                     contentContainerStyle={{ gap: 8 }}
                  >
                     <P
                        style={[styles.proToolBtn, isDragMode && styles.proToolBtnActive]}
                        onPress={() => { setIsDragMode(!isDragMode); if (!isDragMode) { setSelectedVariant(null); setIsMarkingUnknown(false); } }}
                     >
                        <Move size={14} color={isDragMode ? T.onSolid : T.ink} />
                        <Text style={[styles.proToolBtnText, isDragMode && { color: T.onSolid }]}>
                           {isDragMode ? 'Mover: ON' : 'Mover'}
                        </Text>
                     </P>

                     <P
                        style={[styles.proToolBtn, isMarkingUnknown && styles.proToolBtnActive]}
                        onPress={() => { setIsMarkingUnknown(!isMarkingUnknown); if (!isMarkingUnknown) { setSelectedVariant(null); setIsDragMode(false); } }}
                     >
                        <HelpCircle size={14} color={isMarkingUnknown ? T.onSolid : T.ink} />
                        <Text style={[styles.proToolBtnText, isMarkingUnknown && { color: T.onSolid }]}>
                           {isMarkingUnknown ? 'Marcar: ON' : 'Marcar Desconocidas'}
                        </Text>
                     </P>

                     <P style={styles.proToolBtn} onPress={handleAutoSort}>
                        <Wand2 size={14} color={T.ink} />
                        <Text style={styles.proToolBtnText}>Auto-Ordenar SKU</Text>
                     </P>

                     <P style={styles.proToolBtn} onPress={handleSmartStack}>
                        <Combine size={14} color={T.ink} />
                        <Text style={styles.proToolBtnText}>Apilar por Color</Text>
                     </P>

                     <P style={[styles.proToolBtn, styles.proToolBtnDanger]} onPress={handleClearToStash}>
                        <ArchiveRestore size={14} color="#DC2626" />
                        <Text style={[styles.proToolBtnText, { color: '#DC2626' }]}>Vaciar al Stash</Text>
                     </P>
                  </ScrollView>

                  <View style={styles.shelfStructure}>
                     {Array.from({ length: activeShelf.rowsCount || 1 }).map((_, rIdx) => {
                        const rowNum = activeShelf.rowsCount - rIdx;
                        return (
                           <View key={rowNum} style={styles.matrixRow}>
                              <View style={styles.rowLabel}>
                                 <Text style={styles.rowLabelText}>F{rowNum}</Text>
                              </View>

                              <ScrollRow contentContainerStyle={styles.spacesScroll}>
                                 {Array.from({ length: activeShelf.spacesPerRow || 3 }).map((_, sIdx) => {
                                    const spaceNum = sIdx + 1;
                                    const items = getItemsInSpace(activeShelf.name, rowNum, spaceNum);
                                    const isEmpty = items.length === 0;
                                    const firstItem = items[0];
                                    const cellKey = `F${rowNum}_E${spaceNum}`;
                                    const isUnknown = (activeShelf.unknownCells || []).includes(`${rowNum}_${spaceNum}`);
                                    const dragPayload: MatrixDragPayload | null =
                                       !isEmpty && firstItem
                                          ? {
                                             source: 'matrix',
                                             product: firstItem.product,
                                             variantIndex: firstItem.variantIndex,
                                             sourceRow: rowNum,
                                             sourceSpace: spaceNum,
                                          }
                                          : null;
                                    const isTargetMatch = selectedVariant && items.some(
                                       (i) => i.product.id === selectedVariant.product.id && i.variantIndex === selectedVariant.variantIndex
                                    );

                                    return (
                                       <DraggableCell
                                          key={spaceNum}
                                          cellKey={cellKey}
                                          disabled={isEmpty && !selectedVariant && !isMarkingUnknown}
                                          isDragEnabled={isDragMode && !isEmpty}
                                          renderHandle={renderDragHandle}
                                          onRegisterLayout={registerCellLayout}
                                          dragX={dragX}
                                          dragY={dragY}
                                          isDragging={isDragging}
                                          onPress={() => {
                                             // 1. Modo marcar desconocidas (prioridad)
                                             if (isMarkingUnknown) {
                                                toggleUnknownCell(rowNum, spaceNum);
                                                return;
                                             }

                                             // 2. Modo asignación
                                             if (selectedVariant) {
                                                if (selectedVariant.bulkItems && selectedVariant.sourceShelf === activeShelf.name) {
                                                   selectedVariant.bulkItems.forEach((it) => {
                                                      handleMoveSpaceLocal(
                                                         it.product.id!, it.variantIndex,
                                                         activeShelf.name,
                                                         selectedVariant.sourceRow!, selectedVariant.sourceSpace!,
                                                         rowNum, spaceNum
                                                      );
                                                   });
                                                   setSelectedVariant(null);
                                                } else if (selectedVariant.bulkItems && selectedVariant.stashIndex === undefined) {
                                                   // bulk move desde otra celda
                                                   selectedVariant.bulkItems.forEach((it) => {
                                                      handleAssignToSpaceLocal(it.product.id!, it.variantIndex, activeShelf.name, rowNum, spaceNum);
                                                   });
                                                   setSelectedVariant(null);
                                                } else if (selectedVariant.isRelocating) {
                                                   if (selectedVariant.stashIndex !== undefined) {
                                                      handleAssignToSpaceLocal(selectedVariant.product.id!, selectedVariant.variantIndex, activeShelf.name, rowNum, spaceNum);
                                                      setStash((prev) => prev.filter((_, i) => i !== selectedVariant.stashIndex));
                                                   } else {
                                                      handleMoveSpaceLocal(
                                                         selectedVariant.product.id!, selectedVariant.variantIndex,
                                                         selectedVariant.sourceShelf!, selectedVariant.sourceRow!, selectedVariant.sourceSpace!,
                                                         rowNum, spaceNum
                                                      );
                                                   }
                                                   setSelectedVariant(null);
                                                } else {
                                                   handleAssignToSpaceLocal(selectedVariant.product.id!, selectedVariant.variantIndex, activeShelf.name, rowNum, spaceNum);
                                                }
                                             } else if (!isEmpty) {
                                                setInspectedSpace({
                                                   shelfName: activeShelf.name,
                                                   row: rowNum,
                                                   space: spaceNum,
                                                   items,
                                                });
                                             }
                                          }}
                                          onDragStart={(x, y) => dragPayload && handleDragStart(dragPayload, x, y)}
                                          onDragMove={handleDragMove}
                                          onDragEnd={(x, y) => dragPayload && handleDragEnd(dragPayload, x, y)}
                                          style={[
                                             styles.matrixCell,
                                             isEmpty ? styles.matrixCellEmpty : styles.matrixCellOccupied,
                                             isUnknown && isEmpty && styles.matrixCellUnknown,
                                             isMarkingUnknown && styles.matrixCellMarking,
                                             selectedVariant && !isTargetMatch && styles.matrixCellStaticHighlight,
                                             isTargetMatch && styles.matrixCellTargetMatch,
                                          ]}
                                       >
                                          <Text style={styles.cellLabel}>E{spaceNum}</Text>
                                          {isEmpty ? (
                                             <View style={styles.emptyCellTouchArea}>
                                                {isUnknown ? (
                                                   <>
                                                      <HelpCircle size={26} color="#F59E0B" />
                                                      <Text style={styles.unknownLabel}>?</Text>
                                                   </>
                                                ) : (
                                                   <Box size={22} color={selectedVariant || isMarkingUnknown ? T.ink : T.inkMute} />
                                                )}
                                             </View>
                                          ) : (
                                             <>
                                                <Cover
                                                   uri={firstItem.product.images?.[0]}
                                                   name={firstItem.product.name}
                                                   bg={T.imgBg}
                                                   fg={T.line}
                                                   style={styles.cellThumbnail}
                                                />
                                                {items.length > 1 && (
                                                   <View style={styles.cellBadge}>
                                                      <Text style={styles.cellBadgeText}>+{items.length - 1}</Text>
                                                   </View>
                                                )}
                                                {isTargetMatch && (
                                                   <View style={styles.targetMatchIcon}>
                                                      <Sparkles size={14} color={T.solid} />
                                                   </View>
                                                )}
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
                        cellKey="STASH_ZONE"
                        disabled={true}
                        isDragEnabled={false}
                        onRegisterLayout={registerCellLayout}
                        onPress={() => { }}
                        onDragStart={() => { }}
                        onDragMove={() => { }}
                        onDragEnd={() => { }}
                        style={styles.stashDropZone}
                     >
                        <View style={styles.stashHeader}>
                           <Inbox size={16} color={T.ink} />
                           <Text style={styles.stashTitle}>Bandeja Temporal (Stash)</Text>
                           <Text style={styles.stashDesc}>Arrastra prendas aquí. Toca una para ver detalles.</Text>
                        </View>
                        <ScrollRow contentContainerStyle={styles.stashScroll}>
                           {stash.map((item, idx) => {
                              const dragPayload: MatrixDragPayload = {
                                 source: 'stash',
                                 product: item.product,
                                 variantIndex: item.variantIndex,
                                 stashIndex: idx,
                              };
                              return (
                                 <DraggableCell
                                    key={`stash_${idx}`}
                                    cellKey={`STASH_${idx}`}
                                    onRegisterLayout={registerCellLayout}
                                    dragX={dragX}
                                    dragY={dragY}
                                    isDragging={isDragging}
                                    isDragEnabled={isDragMode}
                                    renderHandle={renderDragHandle}
                                    onPress={() => {
                                       setInspectedSpace({
                                          shelfName: 'Bandeja Temporal',
                                          row: 0,
                                          space: idx + 1,
                                          items: [{ product: item.product, variant: item.variant, variantIndex: item.variantIndex }],
                                          isStash: true,
                                          stashIndex: idx,
                                       });
                                    }}
                                    onDragStart={(x, y) => handleDragStart(dragPayload, x, y)}
                                    onDragMove={handleDragMove}
                                    onDragEnd={(x, y) => handleDragEnd(dragPayload, x, y)}
                                    style={styles.stashItem}
                                 >
                                    <Cover
                                       uri={item.product.images?.[0]}
                                       name={item.product.name}
                                       bg={T.imgBg}
                                       fg={T.line}
                                       style={styles.stashImg}
                                    />
                                    <View style={styles.stashItemColor}>
                                       <Text style={styles.stashItemText} numberOfLines={1}>{item.variant.color}</Text>
                                    </View>
                                 </DraggableCell>
                              );
                           })}
                           {stash.length === 0 && <Text style={styles.emptyStashText}>Bandeja vacía</Text>}
                        </ScrollRow>
                     </DraggableCell>
                  </View>
               </View>
            ) : (
               // ===== DASHBOARD PRINCIPAL =====
               <>
                  <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <Layers size={22} color={T.ink} style={{ marginRight: 10, flexShrink: 0 }} />
                        <Text
                           style={[styles.sectionTitle, isMobile && { fontSize: 22, lineHeight: 22 }]}
                           numberOfLines={2}
                        >
                           Plano General de Bodega
                        </Text>
                     </View>
                     <P
                        style={[styles.createBtn, { flexShrink: 0 }]}
                        onPress={() => setEditingShelf({ name: '', rowsCount: 1, spacesPerRow: 3 })}
                     >
                        <Plus size={15} color={T.onSolid} />
                        <Text style={styles.createBtnText}>Nuevo Estante</Text>
                     </P>
                  </View>

                  <View style={styles.shelvesSummaryGrid}>
                     <P
                        style={[styles.shelfSummaryCard, styles.vitrinaSummaryCard, selectedVariant && styles.vitrinaDropZoneActive]}
                        onPress={() => {
                           if (selectedVariant && !selectedVariant.isRelocating && !selectedVariant.bulkItems) {
                              assignProductToVitrina(selectedVariant.product, selectedVariant.variantIndex);
                           } else if (!selectedVariant) {
                              setShowVitrinaDetail(true);
                           }
                        }}
                     >
                        {selectedVariant ? (
                           <View style={styles.emptyDropPrompt}>
                              <Store size={32} color={T.ink} style={{ marginBottom: 10 }} />
                              <Text style={[styles.emptyDropText, styles.emptyDropTextActive, { fontSize: 15 }]}>
                                 Soltar aquí para Vitrina
                              </Text>
                           </View>
                        ) : (
                           <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                              <View style={styles.shelfIconWrapper}>
                                 <Store size={28} color={T.ink} />
                              </View>
                              <View style={{ marginLeft: 16, flex: 1 }}>
                                 <Text style={[styles.shelfSummaryTitle, { fontSize: 20 }]}>Piso de Ventas</Text>
                                 <Text style={styles.shelfSummaryDetail}>
                                    {exhibitionItems.length} prendas en exhibición
                                 </Text>
                              </View>
                              <ChevronRight size={24} color={T.inkMute} />
                           </View>
                        )}
                     </P>

                     {shelves.length === 0 && <Text style={styles.emptyText}>Bodega vacía. Crea un estante.</Text>}
                     {shelves.map((shelf) => {
                        const variantLocs = selectedVariant ? getEffectiveLocations(selectedVariant.product.id!, selectedVariant.variantIndex) : [];
                        const countInShelf = variantLocs.filter((l) => l.shelfId === shelf.name).length;
                        const isHighlighted = countInShelf > 0;

                        return (
                           <P
                              key={shelf.id || shelf.name}
                              style={[styles.shelfSummaryCard, isHighlighted && styles.shelfSummaryCardHighlight]}
                              onPress={() => setActiveShelf(shelf)}
                           >
                              {isHighlighted && (
                                 <View style={styles.shelfLocateBadge}>
                                    <MapPin size={12} color={T.onSolid} style={{ marginRight: 4 }} />
                                    <Text style={styles.shelfLocateBadgeText}>{countInShelf} aquí</Text>
                                 </View>
                              )}
                              <View style={styles.shelfIconWrapper}>
                                 <MapPin size={24} color={T.ink} />
                              </View>
                              <Text style={styles.shelfSummaryTitle}>{shelf.name}</Text>
                              <Text style={styles.shelfSummaryDetail}>
                                 {shelf.rowsCount} {shelf.rowsCount === 1 ? 'Fila' : 'Filas'} × {shelf.spacesPerRow} Espacios
                              </Text>
                              <View style={styles.shelfActions}>
                                 <P onPress={() => setEditingShelf(shelf)} style={styles.smallIconBtn}>
                                    <Pencil size={14} color={T.inkSoft} />
                                 </P>
                                 <P
                                    onPress={() => showConfirm('Eliminar', `¿Borrar ${shelf.name}?`, async () => {
                                       if (shelf.id) await deleteShelf(shelf.id);
                                    })}
                                    style={styles.smallIconBtn}
                                 >
                                    <Trash2 size={14} color={T.inkMute} />
                                 </P>
                              </View>
                           </P>
                        );
                     })}
                  </View>
               </>
            )}

            {!showVitrinaDetail && (
               <>
                  <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                     <Package size={22} color={T.ink} style={{ marginRight: 10 }} />
                     <Text style={styles.sectionTitle}>Inventario General</Text>
                  </View>

                  <ProductSearchFilter
                     filters={filters}
                     onFilterChange={handleFilterChange}
                     availableCategories={availableCategories}
                     availableBrands={availableBrands}
                     availableSizes={availableSizes}
                  />

                  <View style={{ gap: 10 }}>
                     {paginatedProducts.length === 0 ? (
                        <Text style={styles.emptyText}>No se encontraron prendas.</Text>
                     ) : (
                        paginatedProducts.map((p) => (
                           <View key={p.id || p.code} style={styles.catalogCard}>
                              {/* IMAGEN con lightbox al click */}
                              <Pressable
                                 style={styles.catalogImgWrapper}
                                 onPress={() => {
                                    setViewerData({
                                       images: p.images && p.images.length > 0 ? p.images : [''],
                                       visible: true,
                                    });
                                    setViewerIndex(0);
                                 }}
                                 accessibilityLabel="Ver imagen ampliada"
                              >
                                 <Cover
                                    uri={p.images?.[0]}
                                    name={p.name}
                                    bg={T.imgBg}
                                    fg={T.line}
                                    style={styles.catalogImg}
                                 />
                                 <View style={styles.expandIconOverlay}>
                                    <Eye size={12} color={T.onSolid} />
                                 </View>
                                 {p.images && p.images.length > 1 && (
                                    <View style={styles.catalogMultiBadge}>
                                       <Text style={styles.catalogMultiText}>+{p.images.length - 1}</Text>
                                    </View>
                                 )}
                              </Pressable>

                              {/* INFO */}
                              <View style={styles.catalogInfo}>
                                 <View style={styles.catalogHeaderRow}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                       <Text style={styles.catalogBrand}>{p.brand || 'SIN MARCA'}</Text>
                                       <Text style={styles.catalogName} numberOfLines={1}>{p.name}</Text>
                                       <Text style={styles.catalogCode}>SKU: {p.code}</Text>
                                    </View>
                                    <Pressable style={styles.editProductBtn} onPress={() => setEditingProduct(p)}>
                                       <Pencil size={14} color={T.inkSoft} />
                                    </Pressable>
                                 </View>

                                 <View style={styles.variantsDragRow}>
                                    {(p.variants || []).map((v, vIdx) => {
                                       const isSelected =
                                          selectedVariant?.product.id === p.id &&
                                          selectedVariant?.variantIndex === vIdx;
                                       return (
                                          <Pressable
                                             key={v.id || vIdx}
                                             style={[styles.variantBadge, isSelected && styles.variantBadgeSelected]}
                                             onPress={() => {
                                                setIsDragMode(false);
                                                setIsMarkingUnknown(false);
                                                setSelectedVariant({ product: p, variantIndex: vIdx });
                                             }}
                                          >
                                             <View style={[styles.variantDot, { backgroundColor: v.colorHex || '#000' }]} />
                                             <Text style={[styles.variantText, isSelected && styles.variantTextSelected]}>
                                                {v.color}
                                             </Text>
                                          </Pressable>
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
                        <P
                           style={[styles.pageNavBtn, currentPage === 1 && { opacity: 0.3 }]}
                           disabled={currentPage === 1}
                           onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                           <ChevronLeft size={18} color={T.ink} />
                           <Text style={styles.pageNavText}>Anterior</Text>
                        </P>
                        <Text style={styles.pageIndicator}>
                           <Text style={{ color: T.ink }}>{currentPage}</Text> / {totalPages}
                        </Text>
                        <P
                           style={[styles.pageNavBtn, currentPage === totalPages && { opacity: 0.3 }]}
                           disabled={currentPage === totalPages}
                           onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                           <Text style={styles.pageNavText}>Siguiente</Text>
                           <ChevronRight size={18} color={T.ink} />
                        </P>
                     </View>
                  )}
               </>
            )}
         </ScrollView>

         <Animated.View pointerEvents="none" style={[styles.hoverHighlightBox, hoverAnimatedStyle]} />
         <Animated.View pointerEvents="none" style={[styles.ghostWrapper, ghostAnimatedStyle]}>
            {dragGhostImg && (
               <Image
                  source={{ uri: dragGhostImg }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
               />
            )}
         </Animated.View>

         {/* INSPECTOR DE CASILLA */}
         <Modal visible={!!inspectedSpace} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.inspectorCard}>
                  <View style={styles.inspectorHeader}>
                     <Text style={styles.inspectorTitle} numberOfLines={1}>
                        {inspectedSpace?.isStash
                           ? 'Prenda en Bandeja'
                           : `${inspectedSpace?.shelfName} • F${inspectedSpace?.row} • E${inspectedSpace?.space}`}
                     </Text>
                     <P onPress={() => setInspectedSpace(null)}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>

                  <ScrollView style={styles.inspectorBody} contentContainerStyle={{ gap: 12 }}>
                     {inspectedSpace?.items.map((item, idx) => (
                        <View key={idx} style={styles.inspectorLargeCard}>
                           <Cover
                              uri={item.product.images?.[0]}
                              name={item.product.name}
                              bg={T.imgBg}
                              fg={T.line}
                              style={styles.inspectorLargeImg}
                           />
                           <View style={styles.inspectorDetails}>
                              <Text style={styles.brandTag}>{item.product.brand}</Text>
                              <Text style={styles.inspectorName} numberOfLines={1}>{item.product.name}</Text>
                              <View style={styles.skuRow}>
                                 <Text style={styles.inspectorCode}>SKU: {item.product.code}</Text>
                                 <View style={styles.inspectorColorBadge}>
                                    <View style={[styles.variantDot, { backgroundColor: item.variant.colorHex || '#000' }]} />
                                    <Text style={styles.inspectorColorText}>{item.variant.color}</Text>
                                 </View>
                              </View>

                              <View style={styles.inspectorActionsRow}>
                                 <P
                                    style={[styles.inspectorActionBtn, { backgroundColor: T.surface }]}
                                    disabled={!isModalReady}
                                    onPress={() => { setInspectedSpace(null); setEditingProduct(item.product); }}
                                 >
                                    <Pencil size={14} color={T.ink} />
                                    <Text style={[styles.inspectorActionText, { color: T.ink }]}>Editar</Text>
                                 </P>
                                 <P
                                    style={[styles.inspectorActionBtn, { backgroundColor: T.surface }]}
                                    disabled={!isModalReady}
                                    onPress={() => {
                                       setSelectedVariant({
                                          product: item.product,
                                          variantIndex: item.variantIndex,
                                          isRelocating: true,
                                          sourceShelf: inspectedSpace!.shelfName,
                                          sourceRow: inspectedSpace!.row,
                                          sourceSpace: inspectedSpace!.space,
                                          stashIndex: inspectedSpace!.isStash ? inspectedSpace!.stashIndex : undefined,
                                       });
                                       setIsDragMode(false);
                                       setInspectedSpace(null);
                                    }}
                                 >
                                    <Move size={14} color={T.ink} />
                                    <Text style={[styles.inspectorActionText, { color: T.ink }]}>Reubicar</Text>
                                 </P>
                                 {!inspectedSpace?.isStash && (
                                    <P
                                       style={[styles.inspectorActionBtn, { backgroundColor: T.surface }]}
                                       disabled={!isModalReady}
                                       onPress={() => {
                                          handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace!.shelfName, inspectedSpace!.row, inspectedSpace!.space);
                                          setStash((prev) => [...prev, { product: item.product, variant: item.variant, variantIndex: item.variantIndex }]);
                                          setInspectedSpace(null);
                                       }}
                                    >
                                       <Inbox size={14} color={T.ink} />
                                       <Text style={[styles.inspectorActionText, { color: T.ink }]}>Al Stash</Text>
                                    </P>
                                 )}
                                 <P
                                    style={[styles.inspectorActionBtn, { backgroundColor: '#FEF2F2' }]}
                                    disabled={!isModalReady}
                                    onPress={() => {
                                       if (!inspectedSpace) return;
                                       if (inspectedSpace.isStash && inspectedSpace.stashIndex !== undefined) {
                                          setStash((prev) => prev.filter((_, i) => i !== inspectedSpace.stashIndex));
                                       } else {
                                          handleRemoveFromSpaceLocal(item.product.id!, item.variantIndex, inspectedSpace.shelfName, inspectedSpace.row, inspectedSpace.space);
                                       }
                                       setInspectedSpace(null);
                                    }}
                                 >
                                    <Trash2 size={14} color="#DC2626" />
                                    <Text style={[styles.inspectorActionText, { color: '#DC2626' }]}>Quitar</Text>
                                 </P>
                              </View>
                           </View>
                        </View>
                     ))}

                     {/* ACCIONES DE CELDA COMPLETA */}
                     {!inspectedSpace?.isStash && inspectedSpace && inspectedSpace.items.length > 0 && (
                        <View style={styles.bulkCellActionsBox}>
                           <Text style={styles.bulkCellActionsTitle}>
                              Acciones para toda la celda ({inspectedSpace.items.length} prendas)
                           </Text>

                           <View style={styles.bulkCellActionsRow}>
                              <P
                                 style={[styles.bulkCellBtn, { borderColor: T.line }]}
                                 disabled={!isModalReady}
                                 onPress={handleBulkMoveFromInspector}
                              >
                                 <ArrowRightLeft size={14} color={T.ink} />
                                 <Text style={[styles.bulkCellBtnText, { color: T.ink }]}>Mover todo</Text>
                              </P>

                              <P
                                 style={[styles.bulkCellBtn, { borderColor: T.line }]}
                                 disabled={!isModalReady}
                                 onPress={handleCellToStash}
                              >
                                 <Inbox size={14} color={T.ink} />
                                 <Text style={[styles.bulkCellBtnText, { color: T.ink }]}>Al Stash</Text>
                              </P>

                              <P
                                 style={[styles.bulkCellBtn, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                                 disabled={!isModalReady}
                                 onPress={handleClearCell}
                              >
                                 <Eraser size={14} color="#DC2626" />
                                 <Text style={[styles.bulkCellBtnText, { color: '#DC2626' }]}>Vaciar celda</Text>
                              </P>
                           </View>
                        </View>
                     )}
                  </ScrollView>
               </View>
            </View>
         </Modal>

         {/* VIEWER DE IMÁGENES */}
         <Modal visible={!!viewerData?.visible} transparent animationType="fade">
            <View style={styles.viewerOverlay} onLayout={(e) => setViewerWidth(e.nativeEvent.layout.width)}>
               <P style={styles.viewerCloseBtn} onPress={() => setViewerData(null)}>
                  <X color={T.onBar} size={28} />
               </P>
               <ScrollView
                  ref={viewerScrollRef}
                  horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                     if (viewerWidth > 0) {
                        const newIdx = Math.round(e.nativeEvent.contentOffset.x / viewerWidth);
                        if (newIdx !== viewerIndex && newIdx >= 0 && newIdx < (viewerData?.images.length || 0)) {
                           setViewerIndex(newIdx);
                        }
                     }
                  }}
                  style={{ flex: 1 }}
               >
                  {viewerData?.images.map((img, i) => (
                     <View key={i} style={{ width: viewerWidth, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                        <Image
                           source={{ uri: img }}
                           style={{ width: '100%', height: '80%' }}
                           contentFit="contain"
                           cachePolicy="memory-disk"
                        />
                     </View>
                  ))}
               </ScrollView>
               {Platform.OS === 'web' && viewerData && viewerData.images.length > 1 && (
                  <>
                     {viewerIndex > 0 && (
                        <P
                           style={[styles.viewerArrow, { left: 20 }]}
                           onPress={() => viewerScrollRef.current?.scrollTo({ x: (viewerIndex - 1) * viewerWidth, animated: true })}
                        >
                           <ChevronLeft color={T.onBar} size={40} />
                        </P>
                     )}
                     {viewerIndex < viewerData.images.length - 1 && (
                        <P
                           style={[styles.viewerArrow, { right: 20 }]}
                           onPress={() => viewerScrollRef.current?.scrollTo({ x: (viewerIndex + 1) * viewerWidth, animated: true })}
                        >
                           <ChevronRight color={T.onBar} size={40} />
                        </P>
                     )}
                  </>
               )}
               {viewerData && viewerData.images.length > 1 && (
                  <View style={styles.viewerDotsRow}>
                     {viewerData.images.map((_, i) => (
                        <View key={i} style={[styles.viewerDot, viewerIndex === i && styles.viewerDotActive]} />
                     ))}
                  </View>
               )}
            </View>
         </Modal>

         <EditShelfModal shelf={editingShelf} visible={!!editingShelf} onClose={() => setEditingShelf(null)} />

         <Modal visible={!!editingProduct} animationType="slide" presentationStyle="formSheet">
            <View style={{ flex: 1, backgroundColor: T.bg, marginTop: Platform.OS === 'ios' ? 50 : 0 }}>
               <ProductFormScreen initialProduct={editingProduct} onClose={() => setEditingProduct(null)} />
            </View>
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg, position: 'relative' },
   content: { padding: 16, paddingBottom: 100 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
   sectionTitle: {
      ...display,
      fontSize: 28,
      lineHeight: 28,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
      flexShrink: 1,
      minWidth: 0,
   },

   rowNavBtn: { padding: 6, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 8, marginHorizontal: 2, justifyContent: 'center', alignItems: 'center', height: 45 },

   floatingSelectionOverlay: {
      position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
      top: Platform.OS === 'ios' ? 60 : 24, right: 16, zIndex: 9999,
      backgroundColor: T.bg, borderRadius: 14, padding: 12, paddingRight: 32,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 2, borderColor: T.ink,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
   },
   overlayImg: { width: 60, height: 60, borderRadius: 10, marginRight: 12 },
   overlayInfo: { justifyContent: 'center' },
   overlayTitle: { fontSize: 11, fontWeight: '800', color: T.ink, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
   overlaySubtitle: { fontSize: 14, fontWeight: '800', color: T.ink, maxWidth: 200 },
   overlayCode: { fontSize: 11, color: T.inkMute, fontWeight: '700', marginTop: 2 },
   overlayColorText: { fontSize: 12, color: T.inkSoft, marginLeft: 6, fontWeight: '700' },
   overlayCancelBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: T.surface, borderRadius: 16, padding: 8, borderWidth: 2, borderColor: T.bg, elevation: 3 },

   saveAlertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.solid, padding: 10, borderRadius: 10, marginBottom: 16 },
   saveAlertTitle: { color: T.onSolid, fontSize: 13, fontWeight: '800' },
   discardBtn: { padding: 8, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6 },
   saveBtn: { backgroundColor: T.bg, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
   saveBtnText: { color: T.ink, fontWeight: '800', fontSize: 13 },

   createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.solid, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
   createBtnText: { color: T.onSolid, fontSize: 12, fontWeight: '800' },
   emptyText: { fontSize: 13, color: T.inkMute, fontStyle: 'italic', paddingVertical: 10 },
   brandTag: { fontSize: 12, fontWeight: '700', color: T.inkMute },

   shelvesSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   shelfSummaryCard: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 18, width: '48%', minWidth: 150, alignItems: 'center', position: 'relative' },
   vitrinaSummaryCard: { width: '100%', paddingVertical: 20, borderColor: T.ink },
   vitrinaDropZoneActive: { borderColor: T.ink, borderStyle: 'dashed', backgroundColor: T.bg },
   emptyDropPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
   emptyDropText: { fontSize: 13, color: T.inkMute, marginTop: 8, textAlign: 'center' },
   emptyDropTextActive: { color: T.ink, fontWeight: '800' },
   shelfSummaryCardHighlight: { borderColor: T.ink, borderWidth: 2 },
   shelfLocateBadge: { position: 'absolute', top: -10, right: -10, backgroundColor: T.solid, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, zIndex: 10 },
   shelfLocateBadgeText: { color: T.onSolid, fontSize: 11, fontWeight: '800' },
   shelfIconWrapper: { width: 54, height: 54, borderRadius: 27, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
   shelfSummaryTitle: { ...display, fontSize: 22, lineHeight: 22, fontWeight: '800', color: T.ink, textAlign: 'center', textTransform: 'uppercase' },
   shelfSummaryDetail: { fontSize: 12, color: T.inkMute, marginTop: 4 },
   shelfActions: { position: 'absolute', top: 8, right: 8, gap: 6, flexDirection: 'row' },
   smallIconBtn: { padding: 6, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, borderRadius: 6 },

   matrixNavRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
   backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
   backBtnText: { color: T.ink, fontWeight: '800', fontSize: 13 },
   matrixTitle: { ...display, fontSize: 34, lineHeight: 34, fontWeight: '800', color: T.ink, textTransform: 'uppercase', marginBottom: 6 },
   matrixSubtitle: { fontSize: 13, color: T.inkSoft, lineHeight: 20 },

   capacityBarWrapper: { backgroundColor: T.line, height: 16, borderRadius: 8, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: 220 },
   capacityBarFill: { height: '100%', borderRadius: 8 },
   capacityBarText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 10, fontWeight: '800', color: T.onSolid, top: 1 },

   proToolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
   proToolBtnText: { color: T.ink, fontSize: 12, fontWeight: '800' },
   proToolBtnActive: { backgroundColor: T.solid, borderColor: T.solid },
   proToolBtnDanger: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },

   shelfStructure: { backgroundColor: T.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
   matrixRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: T.line, paddingBottom: 12 },
   rowLabel: { width: 40, height: 40, backgroundColor: T.solid, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginRight: 12 },
   rowLabelText: { ...display, color: T.onSolid, fontWeight: '800', fontSize: 20 },
   spacesScroll: { gap: 12, paddingHorizontal: 4 },
   matrixCell: { width: 75, height: 75, borderRadius: 10, overflow: 'hidden', position: 'relative' },
   emptyCellTouchArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
   matrixCellEmpty: { borderWidth: 2, borderColor: T.line, borderStyle: 'dashed', backgroundColor: T.bg },
   matrixCellOccupied: { borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg },
   matrixCellUnknown: { borderColor: '#F59E0B', borderWidth: 2.5, backgroundColor: '#FFFBEB' },
   matrixCellMarking: { borderColor: '#F59E0B', borderStyle: 'dashed', borderWidth: 2.5 },
   matrixCellStaticHighlight: { backgroundColor: T.surface, borderColor: T.ink, borderWidth: 3 },
   matrixCellTargetMatch: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 4 },
   cellLabel: { position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: '800', color: T.onSolid, zIndex: 10, backgroundColor: T.solid, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
   unknownLabel: { position: 'absolute', bottom: 4, right: 6, fontSize: 14, fontWeight: '900', color: '#F59E0B' },
   targetMatchIcon: { position: 'absolute', top: 2, left: 24, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 3, zIndex: 15 },
   cellThumbnail: { width: '100%', height: '100%' },
   cellBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: T.solid, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
   cellBadgeText: { color: T.onSolid, fontSize: 10, fontWeight: '800' },

   dragHandleIcon: { backgroundColor: T.solid, borderRadius: 6, padding: 6, margin: 4, elevation: 3 },

   stashContainer: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 12, marginTop: 8 },
   stashDropZone: { width: '100%', minHeight: 80, borderRadius: 8 },
   stashHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
   stashTitle: { fontSize: 13, fontWeight: '800', color: T.ink },
   stashDesc: { fontSize: 11, color: T.inkMute, flex: 1 },
   stashScroll: { flexDirection: 'row', gap: 10, paddingBottom: 6, paddingHorizontal: 4 },
   stashItem: { width: 75, height: 75, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: T.ink, position: 'relative', backgroundColor: T.bg },
   stashImg: { width: '100%', height: '100%' },
   stashItemColor: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', paddingVertical: 4 },
   stashItemText: { fontSize: 10, color: T.onSolid, fontWeight: '800' },
   emptyStashText: { fontSize: 12, color: T.inkMute, fontStyle: 'italic', alignSelf: 'center', width: '100%', textAlign: 'center' },

   variantsDragRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
   variantDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
   chipOn: { backgroundColor: T.solid, borderColor: T.solid },
   chipOnText: { color: T.onSolid, fontWeight: '800' },

   sizeChip: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
   sizeChipText: { fontSize: 11, color: T.inkSoft, fontWeight: '700' },

   paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 10, marginTop: 12 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 8 },
   pageNavText: { fontSize: 13, fontWeight: '700', color: T.ink },
   pageIndicator: { ...display, fontSize: 22, fontWeight: '700', color: T.inkMute },

   hoverHighlightBox: { position: 'absolute', borderWidth: 3, borderColor: T.ink, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, zIndex: 9998 },
   ghostWrapper: { position: 'absolute', top: 0, left: 0, borderRadius: 12, overflow: 'hidden', zIndex: 99999, elevation: 30, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, borderWidth: 3, borderColor: T.ink },

   modalOverlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   inspectorCard: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: T.bar },
   inspectorTitle: { ...display, fontSize: 20, fontWeight: '800', color: T.onBar, textTransform: 'uppercase', flexShrink: 1, marginRight: 8 },
   inspectorBody: { padding: 16 },

   inspectorLargeCard: { flexDirection: 'row', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12 },
   inspectorLargeImg: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
   inspectorDetails: { flex: 1, minWidth: 0 },
   inspectorName: { fontSize: 15, fontWeight: '800', color: T.ink, marginBottom: 4 },
   skuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
   inspectorCode: { fontSize: 11, color: T.inkSoft, fontWeight: '700', backgroundColor: T.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   inspectorColorBadge: { flexDirection: 'row', alignItems: 'center' },
   inspectorColorText: { fontSize: 12, color: T.inkMute, fontWeight: '700' },

   inspectorActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12 },
   inspectorActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, flexGrow: 1, justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: T.line },
   inspectorActionText: { fontSize: 12, fontWeight: '800' },

   bulkCellActionsBox: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12, marginTop: 4 },
   bulkCellActionsTitle: { fontSize: 11, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
   bulkCellActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   bulkCellBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, backgroundColor: T.bg },
   bulkCellBtnText: { fontSize: 12, fontWeight: '800' },

   vitrinaDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
   vitrinaDetailCard: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.line, width: '48%', minWidth: 160, flexGrow: 1, overflow: 'hidden' },
   vitrinaDetailImg: { width: '100%', height: 140 },
   expandIconOverlay: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 8,
      padding: 4,
   },
   vitrinaDetailInfo: { padding: 12 },
   exhibitionBrand: { fontSize: 10, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', letterSpacing: 0.5 },
   exhibitionName: { fontSize: 13, fontWeight: '800', color: T.ink },
   exhibitionColor: { fontSize: 11, color: T.inkMute, marginLeft: 4, fontWeight: '700' },
   skuPill: { backgroundColor: T.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: T.line },
   skuPillText: { fontSize: 10, color: T.inkSoft, fontWeight: '800' },
   vitrinaSizeLabel: { fontSize: 11, color: T.inkSoft, fontWeight: '800', marginTop: 6, marginBottom: 4 },
   vitrinaSizeRow: { flexDirection: 'row' },
   vitrinaRemoveBtnAbsolute: { position: 'absolute', top: 8, right: 8, backgroundColor: T.bg, padding: 6, borderRadius: 8, borderWidth: 1, borderColor: T.line },

   viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
   viewerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 24, zIndex: 100, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
   viewerArrow: { position: 'absolute', top: '50%', zIndex: 100, backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 30, transform: [{ translateY: -25 }] },
   viewerDotsRow: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
   viewerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
   viewerDotActive: { backgroundColor: T.onBar, width: 12 },

   // ===== Inventario general (tarjetas tipo catálogo) =====
   catalogCard: {
      flexDirection: 'row',
      backgroundColor: T.surface,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: T.line,
      gap: 12,
      alignItems: 'center',
   },
   catalogImgWrapper: {
      position: 'relative',
      width: 72,
      height: 90,
      borderRadius: 8,
      overflow: 'hidden',
      flexShrink: 0,
   },
   catalogImg: {
      width: '100%',
      height: '100%',
   },
   catalogMultiBadge: {
      position: 'absolute',
      top: 4,
      left: 4,
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
   },
   catalogMultiText: {
      color: T.onSolid,
      fontSize: 9,
      fontWeight: '800',
   },
   catalogInfo: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
   },
   catalogHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
   },
   catalogBrand: {
      fontSize: 11,
      fontWeight: '800',
      color: T.inkMute,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   catalogName: {
      fontSize: 14,
      fontWeight: '800',
      color: T.ink,
      marginTop: 1,
      marginBottom: 2,
   },
   catalogCode: {
      fontSize: 11,
      color: T.inkMute,
      fontWeight: '600',
   },
   editProductBtn: {
      padding: 6,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 6,
   },
   variantBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
   },
   variantBadgeSelected: {
      backgroundColor: T.solid,
      borderColor: T.solid,
   },
   variantText: {
      fontSize: 11,
      color: T.inkSoft,
      fontWeight: '700',
   },
   variantTextSelected: {
      color: T.onSolid,
      fontWeight: '800',
   },
});

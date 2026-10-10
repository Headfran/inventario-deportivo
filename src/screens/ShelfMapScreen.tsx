import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   Image,
   Modal,
   Platform,
} from 'react-native';
import {
   Store,
   Plus,
   Trash2,
   Eye,
   MapPin,
   Layers,
   Pencil,
   ChevronLeft,
   Package,
   Box,
   X,
   Save,
   RotateCcw,
   CheckCircle2,
   Move,
} from 'lucide-react-native';
import { Product, Shelf, ShelfLocation } from '../types/inventory';
import { subscribeToShelves, deleteShelf } from '../services/shelfService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { showConfirm, showAlert } from '../utils/alert';
import { EditShelfModal } from './EditShelfModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { DraggableCell, CellLayout } from '../components/DraggableCell';

interface SelectedVariantRef {
   product: Product;
   variantIndex: number;
}

interface MatrixDragPayload {
   product: Product;
   variantIndex: number;
   sourceRow: number;
   sourceSpace: number;
}

interface InspectedItem {
   product: Product;
   variant: any;
   variantIndex: number;
}

export const ShelfMapScreen = () => {
   const [shelves, setShelves] = useState<Shelf[]>([]);
   const [products, setProducts] = useState<Product[]>([]);

   // ESTANTE ACTIVO Y MODALES
   const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);
   const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);

   // SELECCIÓN POR CLIC
   const [selectedVariant, setSelectedVariant] = useState<SelectedVariantRef | null>(null);

   // ESTADO DE FILTROS EN MAPA DE ESTANTES
   const [filters, setFilters] = useState<FilterOptions>({
      query: '',
      category: 'all',
      brand: '',
      color: '',
      size: '',
      status: 'all',
   });

   // ESTADO BORRADOR LOCAL DE BODEGA
   const [draftLocationsMap, setDraftLocationsMap] = useState<Record<string, ShelfLocation[]>>({});
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   const [saving, setSaving] = useState(false);

   // ARRASTRE DENTRO DE MATRIZ
   const [matrixDraggedPayload, setMatrixDraggedPayload] = useState<MatrixDragPayload | null>(null);
   const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
   const [draggingSourceKey, setDraggingSourceKey] = useState<string | null>(null);

   // GHOST FLOTANTE
   const [dragGhost, setDragGhost] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
      imageUrl: string;
   } | null>(null);

   // REFS DE MEDICIÓN
   const containerRef = useRef<View>(null);
   const containerOffsetRef = useRef({ x: 0, y: 0 });
   const cellLayoutsRef = useRef<Record<string, CellLayout>>({});

   // INSPECTOR DE CASILLA
   const [inspectedSpace, setInspectedSpace] = useState<{
      shelfName: string;
      row: number;
      space: number;
      items: InspectedItem[];
   } | null>(null);

   useEffect(() => {
      const unsubShelves = subscribeToShelves(setShelves);
      const unsubProducts = subscribeToProducts(setProducts);
      return () => {
         unsubShelves();
         unsubProducts();
      };
   }, []);

   useEffect(() => {
      if (activeShelf) {
         syncDraftsFromProducts(products);
         setHasUnsavedChanges(false);
      }
      // Limpiar layouts al cambiar de estante
      cellLayoutsRef.current = {};
      // Re-medir el contenedor raíz
      setTimeout(measureContainer, 50);
   }, [activeShelf]);

   const measureContainer = useCallback(() => {
      const node: any = containerRef.current;
      if (!node) return;

      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
         const r = node.getBoundingClientRect();
         containerOffsetRef.current = { x: r.left, y: r.top };
         return;
      }
      if (typeof node.measureInWindow === 'function') {
         node.measureInWindow((x: number, y: number) => {
            containerOffsetRef.current = { x, y };
         });
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
      if (draftLocationsMap[key] !== undefined) {
         return draftLocationsMap[key];
      }
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

   // REGISTRO DE LAYOUT DE CELDAS
   const registerCellLayout = useCallback((key: string, layout: CellLayout) => {
      cellLayoutsRef.current[key] = layout;
   }, []);

   // HIT TEST CON EXCLUSIÓN DE ORIGEN
   const findCellAtPoint = useCallback(
      (absX: number, absY: number, excludeKey?: string | null): string | null => {
         for (const [key, l] of Object.entries(cellLayoutsRef.current)) {
            if (excludeKey && key === excludeKey) continue;
            if (
               absX >= l.x &&
               absX <= l.x + l.width &&
               absY >= l.y &&
               absY <= l.y + l.height
            ) {
               return key;
            }
         }
         return null;
      },
      []
   );

   // HANDLERS DE DRAG (usando ghost)
   const handleDragStart = useCallback((payload: MatrixDragPayload, absX: number, absY: number) => {
      const sourceKey = `F${payload.sourceRow}_E${payload.sourceSpace}`;
      const layout = cellLayoutsRef.current[sourceKey];
      setMatrixDraggedPayload(payload);
      setDraggingSourceKey(sourceKey);
      setDragGhost({
         x: absX,
         y: absY,
         width: layout?.width ?? 70,
         height: layout?.height ?? 70,
         imageUrl: payload.product.images[0] || 'https://via.placeholder.com/60',
      });
   }, []);

   const handleDragMove = useCallback(
      (absX: number, absY: number) => {
         setDragGhost((g) => (g ? { ...g, x: absX, y: absY } : null));
         const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);
         if (targetKey !== dragOverCellKey) setDragOverCellKey(targetKey);
      },
      [draggingSourceKey, dragOverCellKey, findCellAtPoint]
   );

   const handleDragEnd = useCallback(
      (payload: MatrixDragPayload, absX: number, absY: number) => {
         const targetKey = findCellAtPoint(absX, absY, draggingSourceKey);

         setDragGhost(null);
         setDraggingSourceKey(null);
         setDragOverCellKey(null);
         setMatrixDraggedPayload(null);

         if (!targetKey || !activeShelf) return;
         const m = targetKey.match(/^F(\d+)_E(\d+)$/);
         if (!m) return;

         handleMoveSpaceLocal(
            payload.product.id!,
            payload.variantIndex,
            activeShelf.name,
            payload.sourceRow,
            payload.sourceSpace,
            parseInt(m[1], 10),
            parseInt(m[2], 10)
         );
      },
      [draggingSourceKey, activeShelf, findCellAtPoint]
   );

   // MANEJO BORRADOR LOCAL
   const handleAssignToSpaceLocal = (
      productId: string,
      variantIndex: number,
      shelfName: string,
      row: number,
      space: number
   ) => {
      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);

      const exists = currentLocs.some(
         (l) => l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space
      );

      if (!exists) {
         const updated = [...currentLocs, { shelfId: shelfName, rowIndex: row, rumaIndex: space }];
         setDraftLocationsMap((prev) => ({ ...prev, [key]: updated }));
         setHasUnsavedChanges(true);
      }
      setSelectedVariant(null);
   };

   const handleMoveSpaceLocal = (
      productId: string,
      variantIndex: number,
      shelfName: string,
      sourceRow: number,
      sourceSpace: number,
      targetRow: number,
      targetSpace: number
   ) => {
      if (sourceRow === targetRow && sourceSpace === targetSpace) return;

      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);

      const filtered = currentLocs.filter(
         (l) => !(l.shelfId === shelfName && l.rowIndex === sourceRow && l.rumaIndex === sourceSpace)
      );

      const exists = filtered.some(
         (l) => l.shelfId === shelfName && l.rowIndex === targetRow && l.rumaIndex === targetSpace
      );

      const updated = exists
         ? filtered
         : [...filtered, { shelfId: shelfName, rowIndex: targetRow, rumaIndex: targetSpace }];

      setDraftLocationsMap((prev) => ({ ...prev, [key]: updated }));
      setHasUnsavedChanges(true);
      setMatrixDraggedPayload(null);
      setDragOverCellKey(null);
   };

   const handleRemoveFromSpaceLocal = (
      productId: string,
      variantIndex: number,
      shelfName: string,
      row: number,
      space: number
   ) => {
      const key = `${productId}_${variantIndex}`;
      const currentLocs = getEffectiveLocations(productId, variantIndex);

      const updated = currentLocs.filter(
         (l) => !(l.shelfId === shelfName && l.rowIndex === row && l.rumaIndex === space)
      );

      setDraftLocationsMap((prev) => ({ ...prev, [key]: updated }));
      setHasUnsavedChanges(true);
   };

   // GUARDAR CAMBIOS BATCH A FIREBASE
   const handleSaveChangesToFirebase = async () => {
      try {
         setSaving(true);
         const productUpdates: Record<string, Product> = {};

         for (const [key, newLocs] of Object.entries(draftLocationsMap)) {
            const [productId, vIdxStr] = key.split('_');
            const vIdx = parseInt(vIdxStr, 10);

            if (!productUpdates[productId]) {
               const originalProd = products.find((p) => p.id === productId);
               if (originalProd) {
                  productUpdates[productId] = JSON.parse(JSON.stringify(originalProd));
               }
            }

            if (productUpdates[productId] && productUpdates[productId].variants[vIdx]) {
               productUpdates[productId].variants[vIdx].locations = newLocs;
            }
         }

         const promises = Object.values(productUpdates).map((updatedProd) => {
            if (!updatedProd.id) return Promise.resolve();
            return updateProduct(updatedProd.id, { variants: updatedProd.variants });
         });

         await Promise.all(promises);
         setHasUnsavedChanges(false);
         showAlert('Guardado', 'Reacomodos guardados en la base de datos.');
      } catch (error: any) {
         showAlert('Error', error.message || 'No se pudieron guardar los cambios.');
      } finally {
         setSaving(false);
      }
   };

   const handleDiscardChanges = () => {
      syncDraftsFromProducts(products);
      setHasUnsavedChanges(false);
   };

   // VITRINA
   const assignProductToVitrina = async (product: Product, variantIndex: number, sizeToDisplay?: string) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         const selectedSize = sizeToDisplay || updatedVariants[variantIndex]?.sizes[0]?.size || 'M';
         updatedVariants[variantIndex].exhibition = { isOnDisplay: true, displaySize: selectedSize };
         await updateProduct(product.id, { variants: updatedVariants });
         setSelectedVariant(null);
      } catch (error: any) {
         showAlert('Error', error.message);
      }
   };

   const updateVitrinaDisplaySize = async (product: Product, variantIndex: number, newSize: string) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = { isOnDisplay: true, displaySize: newSize };
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) {
         showAlert('Error', error.message);
      }
   };

   const removeFromVitrina = async (product: Product, variantIndex: number) => {
      if (!product.id) return;
      try {
         const updatedVariants = [...product.variants];
         updatedVariants[variantIndex].exhibition = { isOnDisplay: false };
         await updateProduct(product.id, { variants: updatedVariants });
      } catch (error: any) {
         showAlert('Error', error.message);
      }
   };

   const exhibitionItems = products.flatMap((p) =>
      (p.variants || [])
         .map((v, vIdx) => ({ product: p, variant: v, variantIndex: vIdx }))
         .filter((item) => item.variant.exhibition?.isOnDisplay)
   );

   // CÁLCULO DE CATEGORÍAS, MARCAS, TALLAS Y FILTRADO
   const availableCategories = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
   ) as string[];
   const availableBrands = Array.from(
      new Set(products.map((p) => p.brand).filter(Boolean))
   );
   const availableSizes = Array.from(
      new Set(
         products.flatMap((p) =>
            (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))
         )
      )
   );
   const filteredProducts = filterProducts(products, filters);

   return (
      <View ref={containerRef} style={styles.container} onLayout={measureContainer}>
         <ScrollView contentContainerStyle={styles.content}>

            {/* BANNER REACOMODOS PENDIENTES */}
            {hasUnsavedChanges && (
               <View style={styles.saveAlertBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                     <Save size={18} color="#ffffff" style={{ marginRight: 8 }} />
                     <View>
                        <Text style={styles.saveAlertTitle}>Reacomodos pendientes en el estante</Text>
                        <Text style={styles.saveAlertSubtitle}>Guarda los cambios para sincronizarlos en la base de datos.</Text>
                     </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                     <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardChanges} disabled={saving}>
                        <RotateCcw size={14} color="#ffffff" />
                        <Text style={styles.discardBtnText}>Descartar</Text>
                     </TouchableOpacity>

                     <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChangesToFirebase} disabled={saving}>
                        <CheckCircle2 size={14} color="#15803d" />
                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            )}

            {/* BANNER SELECCIÓN ACTIVA */}
            {selectedVariant && (
               <View style={styles.activeSelectionBanner}>
                  <Image
                     source={{ uri: selectedVariant.product.images[0] || 'https://via.placeholder.com/50' }}
                     style={styles.bannerImg}
                     resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                     <Text style={styles.bannerTitle}>
                        {selectedVariant.product.brand} - {selectedVariant.product.name}
                     </Text>
                     <Text style={styles.bannerSubtitle}>
                        Color: {selectedVariant.product.variants[selectedVariant.variantIndex]?.color} • Toca la casilla o la Vitrina para asignar
                     </Text>
                  </View>
                  <TouchableOpacity style={styles.cancelBannerBtn} onPress={() => setSelectedVariant(null)}>
                     <X size={18} color="#ffffff" />
                  </TouchableOpacity>
               </View>
            )}

            {/* VITRINA DE TIENDA */}
            <View style={styles.sectionHeader}>
               <Store size={20} color="#7c3aed" style={{ marginRight: 8 }} />
               <Text style={styles.sectionTitle}>Piso de Ventas / Vitrina en Tienda</Text>
            </View>

            <TouchableOpacity
               activeOpacity={0.9}
               style={[
                  styles.vitrinaDropZone,
                  selectedVariant && styles.vitrinaDropZoneActive,
               ]}
               onPress={() => {
                  if (selectedVariant) {
                     assignProductToVitrina(selectedVariant.product, selectedVariant.variantIndex);
                  }
               }}
            >
               {exhibitionItems.length === 0 ? (
                  <View style={styles.emptyDropPrompt}>
                     <Eye size={24} color={selectedVariant ? '#7c3aed' : '#94a3b8'} />
                     <Text style={[styles.emptyDropText, selectedVariant && styles.emptyDropTextActive]}>
                        {selectedVariant
                           ? 'Toca aquí para colocar esta prenda en Vitrina'
                           : 'Selecciona un color del inventario para asignarlo a la Vitrina.'}
                     </Text>
                  </View>
               ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exhibitionScroll}>
                     {exhibitionItems.map((item, idx) => {
                        const currentDisplaySize = item.variant.exhibition?.displaySize || 'Única';

                        return (
                           <View key={idx} style={styles.exhibitionCard}>
                              <Image
                                 source={{ uri: item.product.images[0] || 'https://via.placeholder.com/80' }}
                                 style={styles.exhibitionImg}
                                 resizeMode="cover"
                              />
                              <View style={styles.exhibitionInfo}>
                                 <Text style={styles.exhibitionBrand}>{item.product.brand}</Text>
                                 <Text style={styles.exhibitionName} numberOfLines={1}>
                                    {item.product.name}
                                 </Text>
                                 <Text style={styles.exhibitionColor}>{item.variant.color}</Text>

                                 <Text style={styles.vitrinaSizeLabel}>Talla en vitrina:</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vitrinaSizeRow}>
                                    {(item.variant.sizes || []).map((sObj: any) => {
                                       const isSelectedSize = currentDisplaySize === sObj.size;

                                       return (
                                          <TouchableOpacity
                                             key={sObj.size}
                                             style={[
                                                styles.vitrinaSizeChip,
                                                isSelectedSize && styles.vitrinaSizeChipActive,
                                             ]}
                                             onPress={() =>
                                                updateVitrinaDisplaySize(item.product, item.variantIndex, sObj.size)
                                             }
                                          >
                                             <Text
                                                style={[
                                                   styles.vitrinaSizeChipText,
                                                   isSelectedSize && styles.vitrinaSizeChipTextActive,
                                                ]}
                                             >
                                                {sObj.size}
                                             </Text>
                                          </TouchableOpacity>
                                       );
                                    })}
                                 </ScrollView>
                              </View>

                              <TouchableOpacity
                                 style={styles.removeVitrinaBtn}
                                 onPress={() => removeFromVitrina(item.product, item.variantIndex)}
                              >
                                 <X size={14} color="#ef4444" />
                              </TouchableOpacity>
                           </View>
                        );
                     })}
                  </ScrollView>
               )}
            </TouchableOpacity>

            {/* PLANO GENERAL O MATRIZ INTERACTIVA */}
            {!activeShelf ? (
               <>
                  <View style={[styles.sectionHeader, { marginTop: 24, justifyContent: 'space-between' }]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Layers size={20} color="#2563eb" style={{ marginRight: 8 }} />
                        <Text style={styles.sectionTitle}>Plano General de Bodega</Text>
                     </View>
                     <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => setEditingShelf({ name: '', rowsCount: 1, spacesPerRow: 3 })}
                     >
                        <Plus size={14} color="#ffffff" />
                        <Text style={styles.createBtnText}>Nuevo Estante</Text>
                     </TouchableOpacity>
                  </View>

                  <View style={styles.shelvesSummaryGrid}>
                     {shelves.length === 0 && (
                        <Text style={styles.emptyText}>Bodega vacía. Crea un estante arriba.</Text>
                     )}

                     {shelves.map((shelf) => (
                        <TouchableOpacity
                           key={shelf.id || shelf.name}
                           style={styles.shelfSummaryCard}
                           onPress={() => setActiveShelf(shelf)}
                        >
                           <View style={styles.shelfIconWrapper}>
                              <MapPin size={24} color="#2563eb" />
                           </View>

                           <Text style={styles.shelfSummaryTitle}>{shelf.name}</Text>
                           <Text style={styles.shelfSummaryDetail}>
                              {shelf.rowsCount} {shelf.rowsCount === 1 ? 'Fila' : 'Filas'} × {shelf.spacesPerRow} Espacios
                           </Text>

                           <View style={styles.shelfActions}>
                              <TouchableOpacity onPress={() => setEditingShelf(shelf)} style={styles.smallIconBtn}>
                                 <Pencil size={14} color="#64748b" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                 onPress={() =>
                                    showConfirm('Eliminar Estante', `¿Deseas borrar ${shelf.name}?`, async () => {
                                       if (shelf.id) await deleteShelf(shelf.id);
                                    })
                                 }
                                 style={styles.smallIconBtn}
                              >
                                 <Trash2 size={14} color="#ef4444" />
                              </TouchableOpacity>
                           </View>
                        </TouchableOpacity>
                     ))}
                  </View>
               </>
            ) : (
               <View style={styles.matrixContainer}>
                  <View style={styles.matrixNavRow}>
                     <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                           if (hasUnsavedChanges) {
                              showConfirm(
                                 'Cambios pendientes',
                                 'Tienes reacomodos sin guardar. ¿Deseas salir y descartarlos?',
                                 () => {
                                    handleDiscardChanges();
                                    setActiveShelf(null);
                                 }
                              );
                           } else {
                              setActiveShelf(null);
                           }
                        }}
                     >
                        <ChevronLeft size={20} color="#475569" />
                        <Text style={styles.backBtnText}>Volver a Bodega</Text>
                     </TouchableOpacity>

                     {matrixDraggedPayload && (
                        <View style={styles.trashDropZone}>
                           <Move size={16} color="#b91c1c" style={{ marginRight: 6 }} />
                           <Text style={styles.trashDropText}>Arrastra a una casilla destino</Text>
                        </View>
                     )}
                  </View>

                  <View style={styles.matrixHeader}>
                     <Text style={styles.matrixTitle}>{activeShelf.name}</Text>
                     <Text style={styles.matrixSubtitle}>
                        • Para colocar: Toca un color del inventario y luego la casilla.{'\n'}
                        • Para reacomodar: Mantén presionada una prenda y arrástrala a otra casilla.
                     </Text>
                  </View>

                  <View style={styles.shelfStructure}>
                     {Array.from({ length: activeShelf.rowsCount || 1 }).map((_, rIdx) => {
                        const rowNum = activeShelf.rowsCount - rIdx;

                        return (
                           <View key={rowNum} style={styles.matrixRow}>
                              <View style={styles.rowLabel}>
                                 <Text style={styles.rowLabelText}>F{rowNum}</Text>
                              </View>

                              <ScrollView
                                 horizontal
                                 showsHorizontalScrollIndicator={false}
                                 contentContainerStyle={styles.spacesScroll}
                              >
                                 {Array.from({ length: activeShelf.spacesPerRow || 3 }).map((_, sIdx) => {
                                    const spaceNum = sIdx + 1;
                                    const items = getItemsInSpace(activeShelf.name, rowNum, spaceNum);
                                    const isEmpty = items.length === 0;
                                    const firstItem = items[0];
                                    const cellKey = `F${rowNum}_E${spaceNum}`;
                                    const isTargetingThis = dragOverCellKey === cellKey;

                                    const dragPayload: MatrixDragPayload | null = !isEmpty
                                       ? {
                                          product: firstItem.product,
                                          variantIndex: firstItem.variantIndex,
                                          sourceRow: rowNum,
                                          sourceSpace: spaceNum,
                                       }
                                       : null;

                                    return (
                                       <DraggableCell
                                          key={spaceNum}
                                          cellKey={cellKey}
                                          disabled={isEmpty}
                                          onRegisterLayout={registerCellLayout}
                                          onPress={() => {
                                             if (selectedVariant) {
                                                handleAssignToSpaceLocal(
                                                   selectedVariant.product.id!,
                                                   selectedVariant.variantIndex,
                                                   activeShelf.name,
                                                   rowNum,
                                                   spaceNum
                                                );
                                             } else if (!isEmpty) {
                                                setInspectedSpace({
                                                   shelfName: activeShelf.name,
                                                   row: rowNum,
                                                   space: spaceNum,
                                                   items,
                                                });
                                             }
                                          }}
                                          onDragStart={(x, y) => {
                                             if (dragPayload) handleDragStart(dragPayload, x, y);
                                          }}
                                          onDragMove={handleDragMove}
                                          onDragEnd={(x, y) => {
                                             if (dragPayload) handleDragEnd(dragPayload, x, y);
                                          }}
                                          style={[
                                             styles.matrixCell,
                                             isEmpty ? styles.matrixCellEmpty : styles.matrixCellOccupied,
                                             (isTargetingThis || (selectedVariant && isEmpty)) &&
                                             styles.matrixCellDropHighlight,
                                          ]}
                                       >
                                          <Text style={styles.cellLabel}>Esp {spaceNum}</Text>

                                          {isEmpty ? (
                                             <View style={styles.emptyCellTouchArea}>
                                                <Box size={22} color={selectedVariant ? '#2563eb' : '#cbd5e1'} />
                                             </View>
                                          ) : (
                                             <>
                                                <Image
                                                   source={{ uri: firstItem.product.images[0] || 'https://via.placeholder.com/60' }}
                                                   style={styles.cellThumbnail}
                                                   resizeMode="cover"
                                                />
                                                <View style={styles.dragHandleIcon}>
                                                   <Move size={10} color="#ffffff" />
                                                </View>
                                                {items.length > 1 && (
                                                   <View style={styles.cellBadge}>
                                                      <Text style={styles.cellBadgeText}>+{items.length - 1}</Text>
                                                   </View>
                                                )}
                                             </>
                                          )}
                                       </DraggableCell>
                                    );
                                 })}
                              </ScrollView>
                           </View>
                        );
                     })}
                  </View>
               </View>
            )}

            {/* INVENTARIO CON CATEGORÍAS PROMINENTES Y BÚSQUEDA */}
            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
               <Package size={20} color="#059669" style={{ marginRight: 8 }} />
               <Text style={styles.sectionTitle}>Inventario General</Text>
            </View>

            <ProductSearchFilter
               filters={filters}
               onFilterChange={setFilters}
               availableCategories={availableCategories}
               availableBrands={availableBrands}
               availableSizes={availableSizes}
            />

            <View style={styles.catalogDragContainer}>
               {filteredProducts.length === 0 ? (
                  <Text style={styles.emptyText}>No se encontraron prendas con los filtros aplicados.</Text>
               ) : (
                  filteredProducts.map((p) => (
                     <View key={p.id || p.code} style={styles.dragProductCard}>
                        <Image
                           source={{ uri: p.images[0] || 'https://via.placeholder.com/50' }}
                           style={styles.dragCardImg}
                           resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.dragCardBrand}>{p.brand}</Text>
                           <Text style={styles.dragCardName}>{p.name}</Text>
                           <Text style={styles.dragCardCode}>SKU: {p.code}</Text>

                           <View style={styles.variantsDragRow}>
                              {(p.variants || []).map((v, vIdx) => {
                                 const isSelected =
                                    selectedVariant?.product.id === p.id &&
                                    selectedVariant?.variantIndex === vIdx;

                                 return (
                                    <TouchableOpacity
                                       key={v.id || vIdx}
                                       activeOpacity={0.7}
                                       style={[
                                          styles.variantDragBadge,
                                          isSelected && styles.variantDragBadgeSelected,
                                       ]}
                                       onPress={() => setSelectedVariant({ product: p, variantIndex: vIdx })}
                                    >
                                       <Text
                                          style={[
                                             styles.variantDragText,
                                             isSelected && styles.variantDragTextSelected,
                                          ]}
                                       >
                                          {v.color}
                                       </Text>
                                    </TouchableOpacity>
                                 );
                              })}
                           </View>
                        </View>
                     </View>
                  ))
               )}
            </View>
         </ScrollView>

         {/* GHOST FLOTANTE (encima de todo, sin capturar gestos) */}
         {dragGhost && (
            <View
               pointerEvents="none"
               style={{
                  position: 'absolute',
                  left: dragGhost.x - containerOffsetRef.current.x - dragGhost.width / 2,
                  top: dragGhost.y - containerOffsetRef.current.y - dragGhost.height / 2,
                  width: dragGhost.width,
                  height: dragGhost.height,
                  borderRadius: 10,
                  overflow: 'hidden',
                  opacity: 0.92,
                  zIndex: 99999,
                  elevation: 30,
                  shadowColor: '#0f172a',
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  borderWidth: 2,
                  borderColor: '#2563eb',
               }}
            >
               <Image
                  source={{ uri: dragGhost.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
               />
            </View>
         )}

         {/* INSPECTOR DE CASILLA OCUPADA */}
         <Modal visible={!!inspectedSpace} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.inspectorCard}>
                  <View style={styles.inspectorHeader}>
                     <Text style={styles.inspectorTitle}>
                        {inspectedSpace?.shelfName} • Fila {inspectedSpace?.row} • Espacio {inspectedSpace?.space}
                     </Text>
                     <TouchableOpacity onPress={() => setInspectedSpace(null)}>
                        <X size={20} color="#64748b" />
                     </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.inspectorBody}>
                     {inspectedSpace?.items.map((item, idx) => (
                        <View key={idx} style={styles.inspectorItemRow}>
                           <Image
                              source={{ uri: item.product.images[0] || 'https://via.placeholder.com/60' }}
                              style={styles.inspectorItemImg}
                              resizeMode="cover"
                           />
                           <View style={{ flex: 1 }}>
                              <Text style={styles.inspectorItemBrand}>{item.product.brand}</Text>
                              <Text style={styles.inspectorItemName}>{item.product.name}</Text>
                              <Text style={styles.inspectorItemCode}>Color: {item.variant.color}</Text>
                           </View>

                           <TouchableOpacity
                              style={styles.removeItemFromSpaceBtn}
                              onPress={() => {
                                 if (inspectedSpace) {
                                    handleRemoveFromSpaceLocal(
                                       item.product.id!,
                                       item.variantIndex,
                                       inspectedSpace.shelfName,
                                       inspectedSpace.row,
                                       inspectedSpace.space
                                    );
                                    setInspectedSpace(null);
                                 }
                              }}
                           >
                              <Trash2 size={16} color="#ef4444" />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </ScrollView>
               </View>
            </View>
         </Modal>

         <EditShelfModal
            shelf={editingShelf}
            visible={!!editingShelf}
            onClose={() => setEditingShelf(null)}
         />
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   content: { padding: 16 },
   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
   sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
   },
   createBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
   emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10 },

   saveAlertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#0284c7',
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
   },
   saveAlertTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
   saveAlertSubtitle: { color: '#e0f2fe', fontSize: 11 },
   discardBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#0369a1' },
   discardBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
   saveBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#ffffff' },
   saveBtnText: { color: '#15803d', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

   activeSelectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      padding: 10,
      borderRadius: 10,
      marginBottom: 16,
      gap: 10,
   },
   bannerImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#ffffff' },
   bannerTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
   bannerSubtitle: { color: '#bfdbfe', fontSize: 11 },
   cancelBannerBtn: { padding: 6 },

   vitrinaDropZone: {
      backgroundColor: '#f3e8ff',
      borderWidth: 2,
      borderColor: '#c084fc',
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 12,
      minHeight: 90,
      justifyContent: 'center',
   },
   vitrinaDropZoneActive: { borderColor: '#7c3aed', backgroundColor: '#faf5ff', borderStyle: 'solid' },
   emptyDropPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
   emptyDropText: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
   emptyDropTextActive: { color: '#7c3aed', fontWeight: 'bold' },
   exhibitionScroll: { flexDirection: 'row' },
   exhibitionCard: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: '#d8b4fe',
      marginRight: 10,
      width: 240,
      alignItems: 'flex-start',
      position: 'relative',
   },
   exhibitionImg: { width: 46, height: 46, borderRadius: 6, marginRight: 10, backgroundColor: '#f3e8ff' },
   exhibitionInfo: { flex: 1 },
   exhibitionBrand: { fontSize: 9, fontWeight: 'bold', color: '#7c3aed' },
   exhibitionName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   exhibitionColor: { fontSize: 10, color: '#64748b', marginBottom: 4 },
   vitrinaSizeLabel: { fontSize: 10, color: '#475569', fontWeight: 'bold', marginTop: 2 },
   vitrinaSizeRow: { flexDirection: 'row', marginTop: 3 },
   vitrinaSizeChip: {
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 4,
      paddingVertical: 2,
      paddingHorizontal: 6,
      marginRight: 4,
   },
   vitrinaSizeChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
   vitrinaSizeChipText: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
   vitrinaSizeChipTextActive: { color: '#ffffff' },
   removeVitrinaBtn: { padding: 4 },

   shelvesSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   shelfSummaryCard: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 12,
      padding: 16,
      width: '48%',
      minWidth: 150,
      alignItems: 'center',
      position: 'relative',
   },
   shelfIconWrapper: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 30, marginBottom: 8 },
   shelfSummaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
   shelfSummaryDetail: { fontSize: 11, color: '#64748b', marginTop: 4 },
   shelfActions: { position: 'absolute', top: 8, right: 8, gap: 6 },
   smallIconBtn: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 4 },

   matrixContainer: { flex: 1 },
   matrixNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
   backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
   },
   backBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
   trashDropZone: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
   },
   trashDropText: { fontSize: 12, color: '#b91c1c', fontWeight: 'bold' },
   matrixHeader: { marginBottom: 16 },
   matrixTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
   matrixSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 18 },
   shelfStructure: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', padding: 16 },
   matrixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      paddingBottom: 12,
   },
   rowLabel: {
      width: 36,
      height: 36,
      backgroundColor: '#1e293b',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
      marginRight: 12,
   },
   rowLabelText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
   spacesScroll: { gap: 10 },
   matrixCell: { width: 70, height: 70, borderRadius: 8, overflow: 'hidden', position: 'relative' },
   emptyCellTouchArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
   matrixCellEmpty: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', backgroundColor: '#f8fafc' },
   matrixCellOccupied: { borderWidth: 1, borderColor: '#2563eb', backgroundColor: '#eff6ff' },
   matrixCellDropHighlight: { borderColor: '#2563eb', backgroundColor: '#dbeafe', borderWidth: 2 },
   cellLabel: {
      position: 'absolute',
      top: 3,
      left: 3,
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      zIndex: 10,
      backgroundColor: 'rgba(255,255,255,0.85)',
      paddingHorizontal: 2,
      borderRadius: 2,
   },
   cellThumbnail: { width: '100%', height: '100%', opacity: 0.85 },
   dragHandleIcon: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(37, 99, 235, 0.8)', borderRadius: 4, padding: 2 },
   cellBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2 },
   cellBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: 'bold' },

   catalogDragContainer: { gap: 10 },
   dragProductCard: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      alignItems: 'center',
   },
   dragCardImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#f1f5f9' },
   dragCardBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb' },
   dragCardName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   dragCardCode: { fontSize: 11, color: '#64748b' },
   variantsDragRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
   variantDragBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
   },
   variantDragBadgeSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   variantDragText: { fontSize: 11, color: '#334155', fontWeight: '600' },
   variantDragTextSelected: { color: '#ffffff', fontWeight: 'bold' },

   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   inspectorCard: { width: '100%', maxWidth: 400, maxHeight: '80%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   inspectorTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   inspectorBody: { padding: 16 },
   inspectorItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   inspectorItemImg: { width: 44, height: 44, borderRadius: 6, marginRight: 12, backgroundColor: '#f1f5f9' },
   inspectorItemBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb' },
   inspectorItemName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
   inspectorItemCode: { fontSize: 11, color: '#64748b' },
   removeItemFromSpaceBtn: { padding: 6 },
});

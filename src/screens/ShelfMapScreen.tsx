import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, Platform } from 'react-native';
import {
   Store, Plus, Trash2, Eye, MapPin, Layers, Pencil, ChevronLeft, Package, Box, X, Save, RotateCcw,
   CheckCircle2, Move,
} from 'lucide-react-native';
import { Product, Shelf, ShelfLocation } from '../types/inventory';
import { subscribeToShelves, deleteShelf } from '../services/shelfService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { showConfirm, showAlert } from '../utils/alert';
import { EditShelfModal } from './EditShelfModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { DraggableCell, CellLayout } from '../components/DraggableCell';
import { C, caps, box, activeBox, activeText, btn, btnText, overlay, modalCard } from '../theme';

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
                     <Save size={18} color={C.light} style={{ marginRight: 8 }} />
                     <View>
                        <Text style={styles.saveAlertTitle}>Reacomodos pendientes en el estante</Text>
                        <Text style={styles.saveAlertSubtitle}>Guarda los cambios para sincronizarlos en la base de datos.</Text>
                     </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                     <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardChanges} disabled={saving}>
                        <RotateCcw size={14} color={C.soft} />
                        <Text style={styles.discardBtnText}>Descartar</Text>
                     </TouchableOpacity>

                     <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChangesToFirebase} disabled={saving}>
                        <CheckCircle2 size={14} color={C.bg} />
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
                  <TouchableOpacity style={{ padding: 6 }} onPress={() => setSelectedVariant(null)}>
                     <X size={18} color={C.bg} />
                  </TouchableOpacity>
               </View>
            )}

            {/* VITRINA DE TIENDA */}
            <View style={styles.sectionHeader}>
               <Store size={20} color={C.light} style={{ marginRight: 8 }} />
               <Text style={styles.sectionTitle}>Piso de Ventas / Vitrina en Tienda</Text>
            </View>

            <TouchableOpacity
               activeOpacity={0.9}
               style={[styles.vitrinaDropZone, selectedVariant && styles.vitrinaDropZoneActive]}
               onPress={() => {
                  if (selectedVariant) {
                     assignProductToVitrina(selectedVariant.product, selectedVariant.variantIndex);
                  }
               }}
            >
               {exhibitionItems.length === 0 ? (
                  <View style={styles.emptyDropPrompt}>
                     <Eye size={24} color={selectedVariant ? C.light : C.dim} />
                     <Text style={[styles.emptyDropText, selectedVariant && styles.emptyDropTextActive]}>
                        {selectedVariant
                           ? 'Toca aquí para colocar esta prenda en Vitrina'
                           : 'Selecciona un color del inventario para asignarlo a la Vitrina.'}
                     </Text>
                  </View>
               ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                     {exhibitionItems.map((item, idx) => {
                        const currentDisplaySize = item.variant.exhibition?.displaySize || 'Única';

                        return (
                           <View key={idx} style={styles.exhibitionCard}>
                              <Image
                                 source={{ uri: item.product.images[0] || 'https://via.placeholder.com/80' }}
                                 style={styles.exhibitionImg}
                                 resizeMode="cover"
                              />
                              <View style={{ flex: 1 }}>
                                 <Text style={styles.brandTag}>{item.product.brand}</Text>
                                 <Text style={styles.exhibitionName} numberOfLines={1}>
                                    {item.product.name}
                                 </Text>
                                 <Text style={styles.exhibitionColor}>{item.variant.color}</Text>

                                 <Text style={styles.vitrinaSizeLabel}>Talla en vitrina:</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 3 }}>
                                    {(item.variant.sizes || []).map((sObj: any) => {
                                       const isSelectedSize = currentDisplaySize === sObj.size;

                                       return (
                                          <TouchableOpacity
                                             key={sObj.size}
                                             style={[styles.vitrinaSizeChip, isSelectedSize && activeBox]}
                                             onPress={() =>
                                                updateVitrinaDisplaySize(item.product, item.variantIndex, sObj.size)
                                             }
                                          >
                                             <Text style={[styles.vitrinaSizeChipText, isSelectedSize && activeText]}>
                                                {sObj.size}
                                             </Text>
                                          </TouchableOpacity>
                                       );
                                    })}
                                 </ScrollView>
                              </View>

                              <TouchableOpacity
                                 style={{ padding: 4 }}
                                 onPress={() => removeFromVitrina(item.product, item.variantIndex)}
                              >
                                 <X size={14} color={C.mute} />
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
                        <Layers size={20} color={C.light} style={{ marginRight: 8 }} />
                        <Text style={styles.sectionTitle}>Plano General de Bodega</Text>
                     </View>
                     <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => setEditingShelf({ name: '', rowsCount: 1, spacesPerRow: 3 })}
                     >
                        <Plus size={14} color={C.bg} />
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
                              <MapPin size={24} color={C.light} />
                           </View>

                           <Text style={styles.shelfSummaryTitle}>{shelf.name}</Text>
                           <Text style={styles.shelfSummaryDetail}>
                              {shelf.rowsCount} {shelf.rowsCount === 1 ? 'Fila' : 'Filas'} × {shelf.spacesPerRow} Espacios
                           </Text>

                           <View style={styles.shelfActions}>
                              <TouchableOpacity onPress={() => setEditingShelf(shelf)} style={styles.smallIconBtn}>
                                 <Pencil size={14} color={C.soft} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                 onPress={() =>
                                    showConfirm('Eliminar Estante', `¿Deseas borrar ${shelf.name}?`, async () => {
                                       if (shelf.id) await deleteShelf(shelf.id);
                                    })
                                 }
                                 style={styles.smallIconBtn}
                              >
                                 <Trash2 size={14} color={C.mute} />
                              </TouchableOpacity>
                           </View>
                        </TouchableOpacity>
                     ))}
                  </View>
               </>
            ) : (
               <View style={{ flex: 1 }}>
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
                        <ChevronLeft size={20} color={C.soft} />
                        <Text style={styles.backBtnText}>Volver a Bodega</Text>
                     </TouchableOpacity>

                     {matrixDraggedPayload && (
                        <View style={styles.dragHint}>
                           <Move size={16} color={C.light} style={{ marginRight: 6 }} />
                           <Text style={styles.dragHintText}>Arrastra a una casilla destino</Text>
                        </View>
                     )}
                  </View>

                  <View style={{ marginBottom: 16 }}>
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
                                 contentContainerStyle={{ gap: 10 }}
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
                                                <Box size={22} color={selectedVariant ? C.light : C.dim} />
                                             </View>
                                          ) : (
                                             <>
                                                <Image
                                                   source={{ uri: firstItem.product.images[0] || 'https://via.placeholder.com/60' }}
                                                   style={styles.cellThumbnail}
                                                   resizeMode="cover"
                                                />
                                                <View style={styles.dragHandleIcon}>
                                                   <Move size={10} color={C.white} />
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
               <Package size={20} color={C.light} style={{ marginRight: 8 }} />
               <Text style={styles.sectionTitle}>Inventario General</Text>
            </View>

            <ProductSearchFilter
               filters={filters}
               onFilterChange={setFilters}
               availableCategories={availableCategories}
               availableBrands={availableBrands}
               availableSizes={availableSizes}
            />

            <View style={{ gap: 10 }}>
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
                           <Text style={styles.brandTag}>{p.brand}</Text>
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
                                       style={[styles.variantDragBadge, isSelected && activeBox]}
                                       onPress={() => setSelectedVariant({ product: p, variantIndex: vIdx })}
                                    >
                                       <Text style={[styles.variantDragText, isSelected && activeText]}>{v.color}</Text>
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
                  borderRadius: 4,
                  overflow: 'hidden',
                  opacity: 0.92,
                  zIndex: 99999,
                  elevation: 30,
                  shadowColor: '#000000',
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  borderWidth: 2,
                  borderColor: C.light,
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
                        <X size={20} color={C.soft} />
                     </TouchableOpacity>
                  </View>

                  <ScrollView style={{ padding: 16 }}>
                     {inspectedSpace?.items.map((item, idx) => (
                        <View key={idx} style={styles.inspectorItemRow}>
                           <Image
                              source={{ uri: item.product.images[0] || 'https://via.placeholder.com/60' }}
                              style={styles.inspectorItemImg}
                              resizeMode="cover"
                           />
                           <View style={{ flex: 1 }}>
                              <Text style={styles.brandTag}>{item.product.brand}</Text>
                              <Text style={styles.inspectorItemName}>{item.product.name}</Text>
                              <Text style={styles.dragCardCode}>Color: {item.variant.color}</Text>
                           </View>

                           <TouchableOpacity
                              style={{ padding: 6 }}
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
                              <Trash2 size={16} color={C.mute} />
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
   container: { flex: 1, backgroundColor: C.bg },
   content: { padding: 16 },
   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
   sectionTitle: { ...caps, fontSize: 13, fontWeight: '900', color: C.white },
   emptyText: { fontSize: 13, color: C.dim, fontStyle: 'italic', paddingVertical: 10 },
   brandTag: { ...caps, fontSize: 9, fontWeight: 'bold', color: C.mute, letterSpacing: 1.5 },
   createBtn: { ...btn, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.light },
   createBtnText: { ...btnText, fontSize: 11, color: C.bg, marginLeft: 4 },

   // Banners
   saveAlertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.raised, borderWidth: 1, borderColor: C.soft, padding: 12, borderRadius: 4, marginBottom: 16 },
   saveAlertTitle: { color: C.white, fontSize: 13, fontWeight: 'bold' },
   saveAlertSubtitle: { color: C.mute, fontSize: 11 },
   discardBtn: { ...btn, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#3A3A3A' },
   discardBtnText: { ...btnText, fontSize: 11, color: C.soft, marginLeft: 4 },
   saveBtn: { ...btn, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: C.light },
   saveBtnText: { ...btnText, fontSize: 11, color: C.bg, marginLeft: 4 },
   activeSelectionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.light, padding: 10, borderRadius: 4, marginBottom: 16, gap: 10 },
   bannerImg: { width: 40, height: 40, borderRadius: 2, backgroundColor: C.soft },
   bannerTitle: { color: C.bg, fontSize: 13, fontWeight: '900' },
   bannerSubtitle: { color: C.ink, fontSize: 11 },

   // Vitrina
   vitrinaDropZone: { backgroundColor: C.surface, borderWidth: 2, borderColor: '#3A3A3A', borderStyle: 'dashed', borderRadius: 4, padding: 12, minHeight: 90, justifyContent: 'center' },
   vitrinaDropZoneActive: { borderColor: C.light, backgroundColor: C.raised, borderStyle: 'solid' },
   emptyDropPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
   emptyDropText: { fontSize: 12, color: C.mute, marginTop: 4, textAlign: 'center' },
   emptyDropTextActive: { color: C.light, fontWeight: 'bold' },
   exhibitionCard: { flexDirection: 'row', backgroundColor: C.raised, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: C.line, marginRight: 10, width: 240, alignItems: 'flex-start' },
   exhibitionImg: { width: 46, height: 46, borderRadius: 2, marginRight: 10, backgroundColor: C.line },
   exhibitionName: { fontSize: 12, fontWeight: 'bold', color: C.white },
   exhibitionColor: { fontSize: 10, color: C.mute, marginBottom: 4 },
   vitrinaSizeLabel: { fontSize: 10, color: C.soft, fontWeight: 'bold', marginTop: 2 },
   vitrinaSizeChip: { ...box, paddingVertical: 2, paddingHorizontal: 6, marginRight: 4 },
   vitrinaSizeChipText: { fontSize: 10, color: C.soft, fontWeight: 'bold' },

   // Plano de bodega
   shelvesSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   shelfSummaryCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 16, width: '48%', minWidth: 150, alignItems: 'center' },
   shelfIconWrapper: { ...box, padding: 12, borderRadius: 30, marginBottom: 8 },
   shelfSummaryTitle: { fontSize: 14, fontWeight: '900', color: C.white, textAlign: 'center' },
   shelfSummaryDetail: { fontSize: 11, color: C.mute, marginTop: 4 },
   shelfActions: { position: 'absolute', top: 8, right: 8, gap: 6 },
   smallIconBtn: { ...box, padding: 4 },

   // Matriz del estante
   matrixNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
   backBtn: { ...box, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12 },
   backBtnText: { ...caps, color: C.soft, fontWeight: 'bold', fontSize: 11, marginLeft: 4, letterSpacing: 1 },
   dragHint: { ...box, flexDirection: 'row', alignItems: 'center', borderColor: C.light, paddingVertical: 6, paddingHorizontal: 12 },
   dragHintText: { fontSize: 12, color: C.light, fontWeight: 'bold' },
   matrixTitle: { ...caps, fontSize: 20, fontWeight: '900', color: C.white },
   matrixSubtitle: { fontSize: 12, color: C.mute, marginTop: 2, lineHeight: 18 },
   shelfStructure: { backgroundColor: C.surface, borderRadius: 4, borderWidth: 1, borderColor: C.border, padding: 16 },
   matrixRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222', paddingBottom: 12 },
   rowLabel: { width: 36, height: 36, backgroundColor: C.light, justifyContent: 'center', alignItems: 'center', borderRadius: 2, marginRight: 12 },
   rowLabelText: { color: C.bg, fontWeight: '900', fontSize: 12 },
   matrixCell: { width: 70, height: 70, borderRadius: 4, overflow: 'hidden', position: 'relative' },
   emptyCellTouchArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
   matrixCellEmpty: { borderWidth: 2, borderColor: '#3A3A3A', borderStyle: 'dashed', backgroundColor: C.raised },
   matrixCellOccupied: { borderWidth: 1, borderColor: C.soft, backgroundColor: C.raised },
   matrixCellDropHighlight: { borderColor: C.light, backgroundColor: '#2A2A2A', borderWidth: 2 },
   cellLabel: { position: 'absolute', top: 3, left: 3, fontSize: 9, fontWeight: 'bold', color: C.bg, zIndex: 10, backgroundColor: 'rgba(232,232,232,0.9)', paddingHorizontal: 2, borderRadius: 2 },
   cellThumbnail: { width: '100%', height: '100%', opacity: 0.85 },
   dragHandleIcon: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: 2 },
   cellBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: C.light, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2 },
   cellBadgeText: { color: C.bg, fontSize: 9, fontWeight: '900' },

   // Inventario general
   dragProductCard: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: '#1F1F1F', alignItems: 'center' },
   dragCardImg: { width: 50, height: 50, borderRadius: 2, marginRight: 12, backgroundColor: C.raised },
   dragCardName: { fontSize: 13, fontWeight: 'bold', color: C.white },
   dragCardCode: { fontSize: 11, color: C.dim },
   variantsDragRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
   variantDragBadge: { ...box, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10 },
   variantDragText: { fontSize: 11, color: C.soft, fontWeight: '600' },

   // Inspector
   modalOverlay: overlay,
   inspectorCard: { ...modalCard, maxWidth: 400, maxHeight: '80%' },
   inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border },
   inspectorTitle: { ...caps, fontSize: 12, fontWeight: '900', color: C.white, letterSpacing: 1 },
   inspectorItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222' },
   inspectorItemImg: { width: 44, height: 44, borderRadius: 2, marginRight: 12, backgroundColor: C.raised },
   inspectorItemName: { fontSize: 13, fontWeight: '600', color: C.white },
});
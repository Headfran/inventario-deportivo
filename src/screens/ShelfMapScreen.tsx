import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image, Modal, Platform, useWindowDimensions } from 'react-native';
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
import { Cover } from '../components/Cover';
import { MONO as T, display } from '../design';

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

const MAX = 1180; // ancho máximo del contenido en pantallas grandes

// Botón con respuesta al presionar (reemplaza a TouchableOpacity)
const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const ShelfMapScreen = () => {
   const { width } = useWindowDimensions();
   const mobile = width < 600;
   const padX = mobile ? 14 : 22;
   const shelfCols = width >= 1100 ? 4 : width >= 800 ? 3 : 2;
   const shelfCardW = Math.floor((Math.min(width, MAX) - padX * 2 - 12 * (shelfCols - 1)) / shelfCols);
   const cell = mobile ? 72 : 88;

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
         <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: padX }]}>

            {/* BANNER REACOMODOS PENDIENTES */}
            {hasUnsavedChanges && (
               <View style={[styles.saveAlertBanner, mobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                     <Save size={18} color={T.onSolid} style={{ marginRight: 10 }} />
                     <View style={{ flex: 1 }}>
                        <Text style={styles.saveAlertTitle}>Reacomodos pendientes en el estante</Text>
                        <Text style={styles.saveAlertSubtitle}>Guarda los cambios para sincronizarlos en la base de datos.</Text>
                     </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                     <P style={styles.discardBtn} onPress={handleDiscardChanges} disabled={saving}>
                        <RotateCcw size={14} color={T.onSolid} />
                        <Text style={styles.discardBtnText}>Descartar</Text>
                     </P>

                     <P style={styles.saveBtn} onPress={handleSaveChangesToFirebase} disabled={saving}>
                        <CheckCircle2 size={14} color={T.ink} />
                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                     </P>
                  </View>
               </View>
            )}

            {/* BANNER SELECCIÓN ACTIVA */}
            {selectedVariant && (
               <View style={styles.activeSelectionBanner}>
                  <Cover
                     uri={selectedVariant.product.images?.[0]}
                     name={selectedVariant.product.name}
                     bg={T.imgBg}
                     fg={T.line}
                     style={styles.bannerImg}
                  />
                  <View style={{ flex: 1 }}>
                     <Text style={styles.bannerTitle}>
                        {selectedVariant.product.brand} - {selectedVariant.product.name}
                     </Text>
                     <Text style={styles.bannerSubtitle}>
                        Color: {selectedVariant.product.variants[selectedVariant.variantIndex]?.color} • Toca la casilla o la Vitrina para asignar
                     </Text>
                  </View>
                  <P style={{ padding: 6 }} onPress={() => setSelectedVariant(null)}>
                     <X size={18} color={T.ink} />
                  </P>
               </View>
            )}

            {/* VITRINA DE TIENDA */}
            <View style={styles.sectionHeader}>
               <Store size={22} color={T.ink} style={{ marginRight: 10 }} />
               <Text style={styles.sectionTitle}>Piso de Ventas / Vitrina en Tienda</Text>
            </View>

            <P
               style={[styles.vitrinaDropZone, selectedVariant && styles.vitrinaDropZoneActive]}
               onPress={() => {
                  if (selectedVariant) {
                     assignProductToVitrina(selectedVariant.product, selectedVariant.variantIndex);
                  }
               }}
            >
               {exhibitionItems.length === 0 ? (
                  <View style={styles.emptyDropPrompt}>
                     <Eye size={26} color={selectedVariant ? T.ink : T.inkMute} />
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
                              <Cover
                                 uri={item.product.images?.[0]}
                                 name={item.product.name}
                                 bg={T.imgBg}
                                 fg={T.line}
                                 style={styles.exhibitionImg}
                              />
                              <View style={{ flex: 1 }}>
                                 <Text style={styles.brandTag}>{item.product.brand}</Text>
                                 <Text style={styles.exhibitionName} numberOfLines={1}>
                                    {item.product.name}
                                 </Text>
                                 <Text style={styles.exhibitionColor}>{item.variant.color}</Text>

                                 <Text style={styles.vitrinaSizeLabel}>Talla en vitrina:</Text>
                                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                                    {(item.variant.sizes || []).map((sObj: any) => {
                                       const isSelectedSize = currentDisplaySize === sObj.size;

                                       return (
                                          <P
                                             key={sObj.size}
                                             style={[styles.sizeChip, isSelectedSize && styles.chipOn]}
                                             onPress={() =>
                                                updateVitrinaDisplaySize(item.product, item.variantIndex, sObj.size)
                                             }
                                          >
                                             <Text style={[styles.sizeChipText, isSelectedSize && styles.chipOnText]}>
                                                {sObj.size}
                                             </Text>
                                          </P>
                                       );
                                    })}
                                 </ScrollView>
                              </View>

                              <P style={{ padding: 4 }} onPress={() => removeFromVitrina(item.product, item.variantIndex)}>
                                 <X size={14} color={T.inkMute} />
                              </P>
                           </View>
                        );
                     })}
                  </ScrollView>
               )}
            </P>

            {/* PLANO GENERAL O MATRIZ INTERACTIVA */}
            {!activeShelf ? (
               <>
                  <View style={[styles.sectionHeader, { marginTop: 28, justifyContent: 'space-between' }]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Layers size={22} color={T.ink} style={{ marginRight: 10 }} />
                        <Text style={styles.sectionTitle}>Plano General de Bodega</Text>
                     </View>
                     <P
                        style={styles.createBtn}
                        onPress={() => setEditingShelf({ name: '', rowsCount: 1, spacesPerRow: 3 })}
                     >
                        <Plus size={15} color={T.onSolid} />
                        <Text style={styles.createBtnText}>Nuevo Estante</Text>
                     </P>
                  </View>

                  <View style={styles.shelvesSummaryGrid}>
                     {shelves.length === 0 && (
                        <Text style={styles.emptyText}>Bodega vacía. Crea un estante arriba.</Text>
                     )}

                     {shelves.map((shelf) => (
                        <P
                           key={shelf.id || shelf.name}
                           style={[styles.shelfSummaryCard, { width: shelfCardW }]}
                           onPress={() => setActiveShelf(shelf)}
                        >
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
                                 onPress={() =>
                                    showConfirm('Eliminar Estante', `¿Deseas borrar ${shelf.name}?`, async () => {
                                       if (shelf.id) await deleteShelf(shelf.id);
                                    })
                                 }
                                 style={styles.smallIconBtn}
                              >
                                 <Trash2 size={14} color={T.inkMute} />
                              </P>
                           </View>
                        </P>
                     ))}
                  </View>
               </>
            ) : (
               <View style={{ flex: 1 }}>
                  <View style={styles.matrixNavRow}>
                     <P
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
                        <ChevronLeft size={20} color={T.ink} />
                        <Text style={styles.backBtnText}>Volver a Bodega</Text>
                     </P>

                     {matrixDraggedPayload && (
                        <View style={styles.dragHint}>
                           <Move size={16} color={T.ink} style={{ marginRight: 6 }} />
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
                                             { width: cell, height: cell },
                                             isEmpty ? styles.matrixCellEmpty : styles.matrixCellOccupied,
                                             (isTargetingThis || (selectedVariant && isEmpty)) &&
                                             styles.matrixCellDropHighlight,
                                          ]}
                                       >
                                          <Text style={styles.cellLabel}>Esp {spaceNum}</Text>

                                          {isEmpty ? (
                                             <View style={styles.emptyCellTouchArea}>
                                                <Box size={24} color={selectedVariant ? T.ink : T.inkMute} />
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
                                                <View style={styles.dragHandleIcon}>
                                                   <Move size={10} color="#FFFFFF" />
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
            <View style={[styles.sectionHeader, { marginTop: 36 }]}>
               <Package size={22} color={T.ink} style={{ marginRight: 10 }} />
               <Text style={styles.sectionTitle}>Inventario General</Text>
            </View>

            <ProductSearchFilter
               filters={filters}
               onFilterChange={setFilters}
               availableCategories={availableCategories}
               availableBrands={availableBrands}
               availableSizes={availableSizes}
            />

            <View style={{ gap: 8 }}>
               {filteredProducts.length === 0 ? (
                  <Text style={styles.emptyText}>No se encontraron prendas con los filtros aplicados.</Text>
               ) : (
                  filteredProducts.map((p) => (
                     <View key={p.id || p.code} style={styles.dragProductCard}>
                        <Cover uri={p.images?.[0]} name={p.name} bg={T.imgBg} fg={T.line} style={styles.dragCardImg} />
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
                                    <P
                                       key={v.id || vIdx}
                                       style={[styles.variantDragBadge, isSelected && styles.chipOn]}
                                       onPress={() => setSelectedVariant({ product: p, variantIndex: vIdx })}
                                    >
                                       <Text style={[styles.variantDragText, isSelected && styles.chipOnText]}>{v.color}</Text>
                                    </P>
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
                  shadowColor: '#000000',
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  borderWidth: 2,
                  borderColor: T.ink,
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
                     <P onPress={() => setInspectedSpace(null)}>
                        <X size={22} color={T.onBar} />
                     </P>
                  </View>

                  <ScrollView style={{ padding: 16 }}>
                     {inspectedSpace?.items.map((item, idx) => (
                        <View key={idx} style={styles.inspectorItemRow}>
                           <Cover
                              uri={item.product.images?.[0]}
                              name={item.product.name}
                              bg={T.imgBg}
                              fg={T.line}
                              style={styles.inspectorItemImg}
                           />
                           <View style={{ flex: 1 }}>
                              <Text style={styles.brandTag}>{item.product.brand}</Text>
                              <Text style={styles.inspectorItemName}>{item.product.name}</Text>
                              <Text style={styles.dragCardCode}>Color: {item.variant.color}</Text>
                           </View>

                           <P
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
                              <Trash2 size={18} color={T.inkMute} />
                           </P>
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

const btn = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, borderRadius: 10 };
const chip = { borderWidth: 1, borderColor: T.line, borderRadius: 8 };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   content: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 20, paddingBottom: 48 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
   sectionTitle: { ...display, fontSize: 28, lineHeight: 28, fontWeight: '800', color: T.ink, textTransform: 'uppercase', flexShrink: 1 },
   emptyText: { fontSize: 13, color: T.inkMute, fontStyle: 'italic', paddingVertical: 10 },
   brandTag: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   createBtn: { ...btn, height: 40, paddingHorizontal: 14, backgroundColor: T.solid },
   createBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
   chipOn: { backgroundColor: T.solid, borderColor: T.solid },
   chipOnText: { color: T.onSolid, fontWeight: '800' },

   // Banners
   saveAlertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: T.solid, padding: 14, borderRadius: 12, marginBottom: 16 },
   saveAlertTitle: { color: T.onSolid, fontSize: 14, fontWeight: '800' },
   saveAlertSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
   discardBtn: { ...btn, height: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
   discardBtnText: { fontSize: 13, fontWeight: '700', color: T.onSolid },
   saveBtn: { ...btn, height: 38, paddingHorizontal: 14, backgroundColor: T.bg },
   saveBtnText: { fontSize: 13, fontWeight: '800', color: T.ink },
   activeSelectionBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.bg, borderWidth: 2, borderColor: T.ink, padding: 10, borderRadius: 12, marginBottom: 16 },
   bannerImg: { width: 44, height: 44, borderRadius: 8 },
   bannerTitle: { color: T.ink, fontSize: 14, fontWeight: '800' },
   bannerSubtitle: { color: T.inkSoft, fontSize: 12, marginTop: 1 },

   // Vitrina
   vitrinaDropZone: { backgroundColor: T.surface, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)', borderStyle: 'dashed', borderRadius: 14, padding: 12, minHeight: 96, justifyContent: 'center' },
   vitrinaDropZoneActive: { borderColor: T.ink, backgroundColor: T.bg, borderStyle: 'solid' },
   emptyDropPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
   emptyDropText: { fontSize: 13, color: T.inkMute, marginTop: 6, textAlign: 'center' },
   emptyDropTextActive: { color: T.ink, fontWeight: '800' },
   exhibitionCard: { flexDirection: 'row', backgroundColor: T.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: T.line, marginRight: 10, width: 250, alignItems: 'flex-start' },
   exhibitionImg: { width: 52, height: 64, borderRadius: 8, marginRight: 10 },
   exhibitionName: { fontSize: 13, fontWeight: '800', color: T.ink },
   exhibitionColor: { fontSize: 11, color: T.inkMute, marginBottom: 4 },
   vitrinaSizeLabel: { fontSize: 11, color: T.inkSoft, fontWeight: '700', marginTop: 2 },
   sizeChip: { ...chip, paddingVertical: 3, paddingHorizontal: 8, marginRight: 4 },
   sizeChipText: { fontSize: 11, color: T.inkSoft, fontWeight: '700' },

   // Plano de bodega
   shelvesSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   shelfSummaryCard: { backgroundColor: T.surface, borderRadius: 14, padding: 18, alignItems: 'center', minWidth: 140 },
   shelfIconWrapper: { width: 54, height: 54, borderRadius: 27, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
   shelfSummaryTitle: { ...display, fontSize: 26, lineHeight: 26, fontWeight: '800', color: T.ink, textAlign: 'center', textTransform: 'uppercase' },
   shelfSummaryDetail: { fontSize: 12, color: T.inkMute, marginTop: 4 },
   shelfActions: { position: 'absolute', top: 8, right: 8, gap: 6 },
   smallIconBtn: { ...chip, backgroundColor: T.bg, padding: 5 },

   // Matriz del estante
   matrixNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
   backBtn: { ...btn, height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line, gap: 4 },
   backBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   dragHint: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.ink, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
   dragHintText: { fontSize: 13, color: T.ink, fontWeight: '700' },
   matrixTitle: { ...display, fontSize: 44, lineHeight: 42, fontWeight: '800', color: T.ink, textTransform: 'uppercase' },
   matrixSubtitle: { fontSize: 13, color: T.inkSoft, marginTop: 6, lineHeight: 20 },
   shelfStructure: { backgroundColor: T.surface, borderRadius: 14, padding: 16 },
   matrixRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: T.line, paddingBottom: 12 },
   rowLabel: { width: 40, height: 40, backgroundColor: T.solid, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginRight: 12 },
   rowLabelText: { ...display, color: T.onSolid, fontWeight: '800', fontSize: 20 },
   matrixCell: { borderRadius: 10, overflow: 'hidden', position: 'relative' },
   emptyCellTouchArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
   matrixCellEmpty: { borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)', borderStyle: 'dashed', backgroundColor: T.bg },
   matrixCellOccupied: { borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg },
   matrixCellDropHighlight: { borderColor: T.ink, backgroundColor: 'rgba(0,0,0,0.1)', borderWidth: 3 },
   cellLabel: { position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: '800', color: T.onSolid, zIndex: 10, backgroundColor: T.solid, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
   cellThumbnail: { width: '100%', height: '100%' },
   dragHandleIcon: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 5, padding: 3 },
   cellBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: T.solid, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
   cellBadgeText: { color: T.onSolid, fontSize: 10, fontWeight: '800' },

   // Inventario general
   dragProductCard: { flexDirection: 'row', backgroundColor: T.surface, borderRadius: 12, padding: 10, alignItems: 'center', gap: 12 },
   dragCardImg: { width: 56, height: 70, borderRadius: 8 },
   dragCardName: { fontSize: 14, fontWeight: '700', color: T.ink },
   dragCardCode: { fontSize: 12, color: T.inkMute },
   variantsDragRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
   variantDragBadge: { ...chip, backgroundColor: T.bg, paddingVertical: 5, paddingHorizontal: 12 },
   variantDragText: { fontSize: 12, color: T.inkSoft, fontWeight: '700' },

   // Inspector
   modalOverlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   inspectorCard: { width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: T.bar },
   inspectorTitle: { ...display, fontSize: 22, fontWeight: '800', color: T.onBar, textTransform: 'uppercase', flexShrink: 1 },
   inspectorItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.line },
   inspectorItemImg: { width: 48, height: 60, borderRadius: 8, marginRight: 12 },
   inspectorItemName: { fontSize: 14, fontWeight: '700', color: T.ink },
});

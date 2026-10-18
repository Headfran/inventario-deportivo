import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { Plus, Pencil, Trash2, Layers, ChevronLeft, ChevronRight, MessageCircle, Printer } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts, deleteProduct } from '../services/productService';
import { ProductFormScreen } from './ProductFormScreen';
import { StockAdjustModal } from './StockAdjustModal';
import { ProductShareModal } from '../components/ProductShareModal';
import { CatalogPrintModal } from '../components/CatalogPrintModal';
import { showConfirm } from '../utils/alert';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { Cover } from '../components/Cover';
import { MONO as T, display, getColorHex } from '../design';

const ITEMS_PER_PAGE = 10;
const MAX = 1180; // ancho máximo del contenido en pantallas grandes

export const InventoryListScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const isCompact = width < 380;

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sharingProduct, setSharingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState<FilterOptions>({
    query: '',
    category: 'all',
    brand: '',
    color: '',
    size: '',
    status: 'all',
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

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleDelete = (product: Product) => {
    showConfirm(
      'Eliminar Prenda',
      `¿Estás seguro de eliminar "${product.name}"?`,
      async () => {
        await deleteProduct(product);
      }
    );
  };

  const calculateTotalStock = (product: Product) => {
    if (!product || !Array.isArray(product.variants)) return 0;

    return product.variants.reduce((accColor, currColor) => {
      if (!currColor) return accColor;

      if (Array.isArray(currColor.sizes)) {
        return accColor + currColor.sizes.reduce(
          (a, s) => a + (Number(s?.stock) || 0),
          0
        );
      }

      return accColor + (Number((currColor as any).stock) || 0);
    }, 0);
  };

  const availableCategories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ) as string[];

  const availableBrands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean))
  );

  const availableSizes = Array.from(
    new Set(
      products.flatMap((p) =>
        (p.variants || []).flatMap((v) =>
          (v.sizes || []).map((s) => s.size)
        )
      )
    )
  );

  const filteredProducts = filterProducts(products, filters);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const padX = isMobile ? 14 : 22;

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
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
              onPress={() => {
                setSelectedProduct(null);
                setIsFormOpen(true);
              }}
            >
              <Plus size={18} color={T.onSolid} />
              {!isCompact && <Text style={styles.newBtnText}>Nueva prenda</Text>}
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: padX }}>
          <ProductSearchFilter
            filters={filters}
            onFilterChange={handleFilterChange}
            availableCategories={availableCategories}
            availableBrands={availableBrands}
            availableSizes={availableSizes}
          />
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={paginatedProducts}
        keyExtractor={(item) => item.id || item.code}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: padX },
          paginatedProducts.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const totalStock = calculateTotalStock(item);
          const out = totalStock === 0;
          const low = totalStock > 0 && totalStock <= 3;
          const variants = item.variants || [];

          return (
            <View style={[styles.card, isMobile && styles.cardMobile]}>
              <View style={styles.main}>
                <Cover
                  uri={item.images?.[0]}
                  name={item.name}
                  bg={T.imgBg}
                  fg={T.line}
                  style={[styles.cardImage, isMobile && styles.cardImageMobile]}
                />

                <View style={styles.cardBody}>
                  <Text style={styles.brand} numberOfLines={1}>
                    {item.brand || 'SIN MARCA'}
                  </Text>

                  <Text style={styles.name} numberOfLines={2}>
                    {item.name}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.code} numberOfLines={1}>
                      {item.code}
                    </Text>
                    <View style={styles.dots}>
                      {variants.slice(0, 5).map((v, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: getColorHex(v.color || '') }]} />
                      ))}
                    </View>
                    <Text style={styles.variantCount}>{variants.length} color(es)</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.side, isMobile && styles.sideMobile]}>
                <Pressable
                  style={({ pressed }) => [styles.stock, low && styles.stockLow, out && styles.stockOut, pressed && styles.pressed]}
                  onPress={() => setAdjustingProduct(item)}
                  accessibilityLabel="Ajustar stock"
                >
                  <Text style={styles.stockLabel}>Stock</Text>
                  {out ? (
                    <Text style={styles.stockEmptyText}>AGOTADO</Text>
                  ) : (
                    <Text style={styles.stockNum}>
                      {totalStock}
                      <Text style={styles.stockUnit}> uds.</Text>
                    </Text>
                  )}
                </Pressable>

                <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    onPress={() => setSharingProduct(item)}
                    accessibilityLabel="Compartir producto"
                  >
                    <MessageCircle size={17} color={T.inkSoft} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    onPress={() => setAdjustingProduct(item)}
                    accessibilityLabel="Ajustar stock"
                  >
                    <Layers size={17} color={T.ink} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    onPress={() => {
                      setSelectedProduct(item);
                      setIsFormOpen(true);
                    }}
                    accessibilityLabel="Editar producto"
                  >
                    <Pencil size={17} color={T.inkSoft} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    onPress={() => handleDelete(item)}
                    accessibilityLabel="Eliminar producto"
                  >
                    <Trash2 size={17} color={T.inkMute} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
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

      <Modal
        visible={isFormOpen}
        animationType="slide"
        onRequestClose={() => setIsFormOpen(false)}
      >
        <ProductFormScreen
          initialProduct={selectedProduct}
          onClose={() => setIsFormOpen(false)}
        />
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

  // Lista
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingTop: 8, paddingBottom: 24, gap: 8, flexGrow: 1 },
  emptyList: { justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, paddingRight: 16, backgroundColor: T.surface, borderRadius: 12 },
  cardMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
  cardImage: { width: 72, height: 90, borderRadius: 8 },
  cardImageMobile: { width: 64, height: 80 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  brand: { fontSize: 12, fontWeight: '700', color: T.inkMute },
  name: { fontSize: 16, fontWeight: '700', color: T.ink, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  code: { fontSize: 12, color: T.inkMute, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  variantCount: { fontSize: 12, color: T.inkMute },

  // Stock, precio y acciones
  side: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  sideMobile: { justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line },
  stock: { minWidth: 88, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: T.line },
  stockLow: { borderColor: T.ink },
  stockOut: { borderStyle: 'dashed' },
  stockLabel: { fontSize: 10, fontWeight: '600', color: T.inkMute },
  stockNum: { ...display, fontSize: 34, lineHeight: 34, fontWeight: '800', color: T.ink },
  stockUnit: { fontSize: 14, fontWeight: '600', color: T.inkMute },
  stockEmptyText: { fontSize: 13, fontWeight: '800', color: T.inkMute, lineHeight: 34 },
  price: { ...display, fontSize: 28, lineHeight: 28, fontWeight: '800', color: T.ink, minWidth: 84, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10 },

  // Paginación
  paginationBar: { borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 10, backgroundColor: T.bg },
  pageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 8 },
  pageNavDisabled: { opacity: 0.3 },
  pageNavText: { fontSize: 13, fontWeight: '700', color: T.ink },
  pageIndicator: { ...display, fontSize: 24, fontWeight: '700', color: T.inkMute },
  pageNumber: { color: T.ink },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { ...display, fontSize: 32, fontWeight: '800', color: T.ink, textTransform: 'uppercase' },
  emptyText: { color: T.inkMute, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

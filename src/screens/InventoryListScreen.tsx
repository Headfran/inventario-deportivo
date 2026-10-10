import React, { useEffect, useState } from 'react';
import {
   View,
   Text,
   FlatList,
   TouchableOpacity,
   Image,
   StyleSheet,
   Modal,
} from 'react-native';
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

const ITEMS_PER_PAGE = 10;

export const InventoryListScreen = () => {
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
            return accColor + currColor.sizes.reduce((a, s) => a + (Number(s?.stock) || 0), 0);
         }
         return accColor + (Number((currColor as any).stock) || 0);
      }, 0);
   };

   const availableCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
   const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
   const availableSizes = Array.from(
      new Set(
         products.flatMap((p) =>
            (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))
         )
      )
   );

   const filteredProducts = filterProducts(products, filters);
   const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

   return (
      <View style={styles.container}>
         {/* BARRA SUPERIOR CON ACCIONES DE NUEVO E IMPRESIÓN */}
         <View style={styles.topActions}>
            <Text style={styles.productCount}>{filteredProducts.length} prendas encontradas</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
               <TouchableOpacity
                  style={styles.printBtn}
                  onPress={() => setIsPrintModalOpen(true)}
               >
                  <Printer size={15} color="#2563eb" style={{ marginRight: 4 }} />
                  <Text style={styles.printBtnText}>Catálogo PDF</Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={styles.newBtn}
                  onPress={() => {
                     setSelectedProduct(null);
                     setIsFormOpen(true);
                  }}
               >
                  <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.newBtnText}>Nueva Prenda</Text>
               </TouchableOpacity>
            </View>
         </View>

         <View style={styles.filterSection}>
            <ProductSearchFilter
               filters={filters}
               onFilterChange={handleFilterChange}
               availableCategories={availableCategories}
               availableBrands={availableBrands}
               availableSizes={availableSizes}
            />
         </View>

         <FlatList
            data={paginatedProducts}
            keyExtractor={(item) => item.id || item.code}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const totalStock = calculateTotalStock(item);
               const mainImage = item.images[0] || 'https://via.placeholder.com/100?text=Sin+Foto';

               return (
                  <View style={styles.card}>
                     <Image source={{ uri: mainImage }} style={styles.cardImage} resizeMode="cover" />

                     <View style={styles.cardBody}>
                        <View style={styles.cardHeader}>
                           <Text style={styles.brand}>{item.brand}</Text>
                           <Text style={styles.code}>{item.code}</Text>
                        </View>

                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.price}>${item.price.toFixed(2)}</Text>

                        <View style={styles.stockBadgeContainer}>
                           <TouchableOpacity
                              style={[
                                 styles.stockBadge,
                                 totalStock === 0 ? styles.stockEmpty : styles.stockAvailable,
                              ]}
                              onPress={() => setAdjustingProduct(item)}
                           >
                              <Layers size={12} color={totalStock === 0 ? '#ef4444' : '#16a34a'} style={{ marginRight: 4 }} />
                              <Text style={styles.stockText}>
                                 {totalStock === 0 ? 'AGOTADO' : `Stock: ${totalStock} uds.`}
                              </Text>
                           </TouchableOpacity>

                           <Text style={styles.variantCount}>
                              {(item.variants || []).length} color(es)
                           </Text>
                        </View>
                     </View>

                     <View style={styles.actionButtons}>
                        <TouchableOpacity
                           style={styles.actionBtnShare}
                           onPress={() => setSharingProduct(item)}
                        >
                           <MessageCircle size={16} color="#25d366" />
                        </TouchableOpacity>

                        <TouchableOpacity
                           style={styles.actionBtnQuickStock}
                           onPress={() => setAdjustingProduct(item)}
                        >
                           <Layers size={16} color="#2563eb" />
                        </TouchableOpacity>

                        <TouchableOpacity
                           style={styles.actionBtn}
                           onPress={() => {
                              setSelectedProduct(item);
                              setIsFormOpen(true);
                           }}
                        >
                           <Pencil size={16} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                           style={styles.actionBtn}
                           onPress={() => handleDelete(item)}
                        >
                           <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                     </View>
                  </View>
               );
            }}
         />

         {totalPages > 1 && (
            <View style={styles.paginationBar}>
               <TouchableOpacity
                  style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
               >
                  <ChevronLeft size={18} color={currentPage === 1 ? '#94a3b8' : '#0f172a'} />
                  <Text style={[styles.pageNavText, currentPage === 1 && styles.pageNavTextDisabled]}>Anterior</Text>
               </TouchableOpacity>

               <Text style={styles.pageIndicator}>
                  Página <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{currentPage}</Text> de {totalPages}
               </Text>

               <TouchableOpacity
                  style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
               >
                  <Text style={[styles.pageNavText, currentPage === totalPages && styles.pageNavTextDisabled]}>Siguiente</Text>
                  <ChevronRight size={18} color={currentPage === totalPages ? '#94a3b8' : '#0f172a'} />
               </TouchableOpacity>
            </View>
         )}

         {/* MODALES DE ACCIÓN */}
         <Modal visible={isFormOpen} animationType="slide">
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

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fafc' },
   topActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   productCount: { fontSize: 13, fontWeight: '600', color: '#475569' },
   printBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#eff6ff',
      borderWidth: 1,
      borderColor: '#bfdbfe',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
   },
   printBtnText: { color: '#2563eb', fontWeight: 'bold', fontSize: 12 },
   newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
   },
   newBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
   filterSection: { paddingHorizontal: 16, paddingTop: 12 },
   listContent: { padding: 16, gap: 12 },
   card: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
      alignItems: 'center',
   },
   cardImage: { width: 76, height: 76, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cardBody: { flex: 1, marginLeft: 12 },
   cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginRight: 8 },
   brand: { fontSize: 11, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' },
   code: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
   name: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginVertical: 2 },
   price: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
   stockBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
   stockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 12,
   },
   stockAvailable: { backgroundColor: '#dcfce7' },
   stockEmpty: { backgroundColor: '#fee2e2' },
   stockText: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
   variantCount: { fontSize: 11, color: '#64748b' },
   actionButtons: { gap: 6 },
   actionBtnShare: { padding: 8, backgroundColor: '#f0fdf4', borderRadius: 6 },
   actionBtnQuickStock: { padding: 8, backgroundColor: '#eff6ff', borderRadius: 6 },
   actionBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 6 },
   paginationBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      paddingHorizontal: 16,
      paddingVertical: 12,
   },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4 },
   pageNavBtnDisabled: { opacity: 0.4 },
   pageNavText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   pageNavTextDisabled: { color: '#94a3b8' },
   pageIndicator: { fontSize: 13, color: '#475569' },
});

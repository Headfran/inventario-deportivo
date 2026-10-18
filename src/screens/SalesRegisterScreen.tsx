import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ShoppingBag, Plus, Minus, CheckCircle2, CreditCard, Banknote, Smartphone, User, Phone, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { Sale, SaleItem, PaymentMethod } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { enqueuePendingSale } from '../services/offlineSyncService';
import { createSale } from '../services/saleService';
import { showAlert } from '../utils/alert';
import { SaleReceiptModal } from '../components/SaleReceiptModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';

const ITEMS_PER_PAGE = 10;

interface Props {
   currentSellerName?: string;
   currentSellerId?: string;
   isOnline?: boolean;
}

const PAYMENT_OPTIONS = [
   { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
   { id: 'efectivo', label: 'Efectivo', icon: Banknote },
   { id: 'zelle', label: 'Zelle', icon: CreditCard },
   { id: 'tarjeta', label: 'Punto', icon: CreditCard }
] as const;

export const SalesRegisterScreen: React.FC<Props> = ({ currentSellerName = 'Vendedor Principal', currentSellerId = 'v1', isOnline = true }) => {
   const [products, setProducts] = useState<Product[]>([]);
   const [filters, setFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });
   const [currentPage, setCurrentPage] = useState(1);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
   const [selectedSize, setSelectedSize] = useState<string>('');
   const [cart, setCart] = useState<SaleItem[]>([]);
   const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [notes, setNotes] = useState('');
   const [processing, setProcessing] = useState(false);
   const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

   useEffect(() => { const unsub = subscribeToProducts(setProducts); return () => unsub(); }, []);

   const handleFilterChange = useCallback((newFilters: FilterOptions) => { setFilters(newFilters); setCurrentPage(1); }, []);

   const availableCategories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);
   const availableBrands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))), [products]);
   const availableSizes = useMemo(() => Array.from(new Set(products.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))))), [products]);
   const filteredProducts = useMemo(() => filterProducts(products, filters), [products, filters]);
   const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)), [filteredProducts.length]);
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const paginatedProducts = useMemo(() => filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE), [filteredProducts, startIndex]);

   const handleSelectProduct = (product: Product) => {
      setSelectedProduct(product); setSelectedColorIndex(0);
      const firstAvailableSize = product.variants?.[0]?.sizes?.find((s) => Number(s.stock) > 0)?.size || '';
      setSelectedSize(firstAvailableSize);
   };

   const handleAddToCart = () => {
      if (!selectedProduct || !selectedSize) { showAlert('Atención', 'Selecciona un color y una talla disponible.'); return; }
      const currentVariant = selectedProduct.variants[selectedColorIndex];
      if (!currentVariant) return;

      const sizeObj = currentVariant.sizes?.find((s) => s.size === selectedSize);
      const availableStock = Number(sizeObj?.stock) || 0;
      if (availableStock <= 0) { showAlert('Agotado', 'Esta talla no tiene unidades en stock.'); return; }

      const productId = selectedProduct.id || selectedProduct.code || 'unknown';
      const existingIndex = cart.findIndex((item) => item.productId === productId && item.color?.toLowerCase() === currentVariant.color?.toLowerCase() && item.size === selectedSize);

      if (existingIndex > -1) {
         if (cart[existingIndex].quantity + 1 > availableStock) { showAlert('Límite alcanzado', `Solo hay ${availableStock} unidades disponibles.`); return; }
         const updatedCart = [...cart];
         updatedCart[existingIndex].quantity += 1;
         updatedCart[existingIndex].totalPrice = updatedCart[existingIndex].quantity * updatedCart[existingIndex].unitPrice;
         setCart(updatedCart);
      } else {
         const newItem: SaleItem = {
            productId,
            brand: selectedProduct.brand || 'Genérico',
            name: selectedProduct.name,
            code: selectedProduct.code,
            color: currentVariant.color,
            size: selectedSize,
            quantity: 1,
            unitPrice: Number(selectedProduct.price) || 0,
            totalPrice: Number(selectedProduct.price) || 0,
            productImage: selectedProduct.images?.[0] || '',
         };
         setCart([...cart, newItem]);
      }
      setSelectedProduct(null);
   };

   const updateCartQuantity = (index: number, delta: number) => {
      const updated = [...cart];
      const item = updated[index];
      const origProduct = products.find((p) => (p.id || p.code) === item.productId);
      const variant = origProduct?.variants?.find((v) => v.color?.toLowerCase() === item.color?.toLowerCase());
      const sizeObj = variant?.sizes?.find((s) => s.size === item.size);
      const maxStock = Number(sizeObj?.stock) || 0;

      const newQty = item.quantity + delta;
      if (newQty <= 0) { updated.splice(index, 1); }
      else if (newQty > maxStock) { showAlert('Stock insuficiente', `Solo hay ${maxStock} unidades disponibles.`); return; }
      else { item.quantity = newQty; item.totalPrice = item.quantity * item.unitPrice; }
      setCart(updated);
   };

   const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

   const handleCompleteSale = async () => {
      if (cart.length === 0) { showAlert('Carrito vacío', 'Agrega al menos una prenda antes de registrar la venta.'); return; }

      const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const isOffline = !isOnline;

      // Usamos 'any' internamente para evitar que TypeScript rechace propiedades opcionales faltantes antes del guardado final.
      const saleDataToSave: any = {
         receiptNumber, sellerId: currentSellerId, sellerName: currentSellerName,
         items: cart, subtotal: cartTotal, discount: 0, total: cartTotal, paymentMethod,
      };

      if (customerName.trim()) saleDataToSave.customerName = customerName.trim();
      if (customerPhone.trim()) saleDataToSave.customerPhone = customerPhone.trim();
      if (notes.trim()) saleDataToSave.notes = notes.trim();

      setProcessing(true);

      const buildOfflineSale = () => ({
         id: `OFFLINE-${Date.now()}`,
         ...saleDataToSave,
         createdAt: new Date().toISOString(),
         customerName: customerName.trim() || 'Cliente General',
         customerPhone: customerPhone.trim(),
         notes: notes.trim(),
      });

      const buildCompletedSale = (id: string) => ({
         id,
         ...saleDataToSave,
         createdAt: { toDate: () => new Date() }
      } as Sale);

      if (isOffline) {
         try {
            await enqueuePendingSale(buildOfflineSale() as any);
            setLastCompletedSale(buildCompletedSale(`OFFLINE-${Date.now()}`));
            resetCart();
            showAlert('📡 Venta Guardada Offline', `Comprobante #${receiptNumber}. Sincronización pendiente.`);
         } catch (err: any) { showAlert('Error Offline', 'No se pudo guardar.'); } finally { setProcessing(false); }
         return;
      }

      try {
         const saleId = await createSale(saleDataToSave);
         setLastCompletedSale(buildCompletedSale(saleId));
         resetCart();
      } catch (error: any) {
         console.warn('Fallo en la red online. Guardando en cola offline:', error);
         try {
            await enqueuePendingSale(buildOfflineSale() as any);
            setLastCompletedSale(buildCompletedSale(`OFFLINE-${Date.now()}`));
            resetCart();
            showAlert('📡 Venta Guardada en Cola', `Fallo de conexión. La venta #${receiptNumber} fue respaldada localmente.`);
         } catch (idbErr: any) { showAlert('Error en Venta', 'No se pudo completar la transacción.'); }
      } finally { setProcessing(false); }
   };

   const resetCart = () => { setCart([]); setCustomerName(''); setCustomerPhone(''); setNotes(''); };

   const renderProductItem = ({ item }: { item: Product }) => (
      <TouchableOpacity activeOpacity={0.8} style={[styles.productCard, selectedProduct?.id === item.id && styles.productCardSelected]} onPress={() => handleSelectProduct(item)}>
         <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/60' }} style={styles.productImg} contentFit="cover" cachePolicy="memory-disk" />
         <View style={{ flex: 1 }}><Text style={styles.productBrand}>{item.brand}</Text><Text style={styles.productName}>{item.name}</Text><Text style={styles.productCode}>SKU: {item.code}</Text></View>
         <Text style={styles.productPrice}>${Number(item.price || 0).toFixed(2)}</Text>
      </TouchableOpacity>
   );

   return (
      <View style={styles.container}>
         <View style={styles.leftPanel}>
            <Text style={styles.panelTitle}>Punto de Venta</Text>
            <ProductSearchFilter filters={filters} onFilterChange={handleFilterChange} availableCategories={availableCategories} availableBrands={availableBrands} availableSizes={availableSizes} />
            <FlatList data={paginatedProducts} keyExtractor={(item) => item.id || item.code || Math.random().toString()} renderItem={renderProductItem} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron prendas.</Text>} />
            {totalPages > 1 && (
               <View style={styles.paginationBar}>
                  <TouchableOpacity style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]} disabled={currentPage === 1} onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}><ChevronLeft size={18} color={currentPage === 1 ? '#94a3b8' : '#0f172a'} /><Text style={[styles.pageNavText, currentPage === 1 && styles.pageNavTextDisabled]}>Anterior</Text></TouchableOpacity>
                  <Text style={styles.pageIndicator}>Pág <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{currentPage}</Text> de {totalPages}</Text>
                  <TouchableOpacity style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]} disabled={currentPage === totalPages} onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><Text style={[styles.pageNavText, currentPage === totalPages && styles.pageNavTextDisabled]}>Siguiente</Text><ChevronRight size={18} color={currentPage === totalPages ? '#94a3b8' : '#0f172a'} /></TouchableOpacity>
               </View>
            )}
            {selectedProduct && (
               <View style={styles.selectionModal}>
                  <Text style={styles.selectionTitle}>Configurar: {selectedProduct.brand} - {selectedProduct.name}</Text>
                  <Text style={styles.subLabel}>Color:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                     {(selectedProduct.variants || []).map((v, idx) => (
                        <TouchableOpacity key={idx} style={[styles.chip, selectedColorIndex === idx && styles.chipActive]} onPress={() => { setSelectedColorIndex(idx); const firstStockSize = v.sizes?.find((s) => Number(s.stock) > 0)?.size || ''; setSelectedSize(firstStockSize); }}>
                           <View style={[styles.colorDot, { backgroundColor: (v as any).colorHex || '#000' }]} /><Text style={[styles.chipText, selectedColorIndex === idx && styles.chipTextActive]}>{v.color}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
                  <Text style={styles.subLabel}>Talla disponible:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                     {(selectedProduct.variants?.[selectedColorIndex]?.sizes || []).map((sObj) => {
                        const hasStock = Number(sObj.stock) > 0;
                        const isSelected = selectedSize === sObj.size;
                        return (
                           <TouchableOpacity key={sObj.size} disabled={!hasStock} style={[styles.sizeChip, isSelected && styles.sizeChipActive, !hasStock && styles.sizeChipDisabled]} onPress={() => setSelectedSize(sObj.size)}>
                              <Text style={[styles.sizeChipText, isSelected && styles.sizeChipTextActive, !hasStock && styles.sizeChipTextDisabled]}>{sObj.size} ({sObj.stock})</Text>
                           </TouchableOpacity>
                        );
                     })}
                  </ScrollView>
                  <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}><Plus size={16} color="#ffffff" style={{ marginRight: 6 }} /><Text style={styles.addToCartText}>Agregar al Carrito</Text></TouchableOpacity>
               </View>
            )}
         </View>

         <View style={styles.rightPanel}>
            <View style={styles.cartHeader}><ShoppingBag size={20} color="#2563eb" style={{ marginRight: 8 }} /><Text style={styles.panelTitle}>Carrito de Venta</Text></View>
            <ScrollView style={styles.cartScroll}>
               {cart.length === 0 ? <Text style={styles.emptyCartText}>El carrito está vacío. Selecciona prendas del catálogo.</Text> : (
                  cart.map((item, idx) => (
                     <View key={idx} style={styles.cartItemRow}>
                        <Image source={{ uri: item.productImage || 'https://via.placeholder.com/50' }} style={styles.cartItemImg} contentFit="cover" cachePolicy="memory-disk" />
                        <View style={{ flex: 1 }}><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.cartItemDetail}>Color: {item.color} • Talla: {item.size}</Text><Text style={styles.cartItemPrice}>${item.unitPrice.toFixed(2)} c/u</Text></View>
                        <View style={styles.qtyControls}>
                           <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, -1)}><Minus size={12} color="#0f172a" /></TouchableOpacity>
                           <Text style={styles.qtyText}>{item.quantity}</Text>
                           <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, 1)}><Plus size={12} color="#0f172a" /></TouchableOpacity>
                        </View>
                        <Text style={styles.cartItemSubtotal}>${item.totalPrice.toFixed(2)}</Text>
                     </View>
                  ))
               )}
            </ScrollView>
            <View style={styles.checkoutSection}>
               <Text style={styles.subLabel}>Método de Pago:</Text>
               <View style={styles.paymentMethodsRow}>
                  {PAYMENT_OPTIONS.map((m) => {
                     const IconComp = m.icon;
                     const isSelected = paymentMethod === m.id;
                     return (
                        <TouchableOpacity key={m.id} style={[styles.paymentBtn, isSelected && styles.paymentBtnActive]} onPress={() => setPaymentMethod(m.id as PaymentMethod)}>
                           <IconComp size={14} color={isSelected ? '#ffffff' : '#475569'} /><Text style={[styles.paymentBtnText, isSelected && styles.paymentBtnTextActive]}>{m.label}</Text>
                        </TouchableOpacity>
                     );
                  })}
               </View>
               <View style={styles.customerInputsRow}>
                  <View style={{ flex: 1, marginRight: 8 }}><View style={styles.inputWithIcon}><User size={14} color="#94a3b8" style={{ marginRight: 6 }} /><TextInput style={styles.smallInput} placeholder="Cliente (Opcional)" placeholderTextColor="#94a3b8" value={customerName} onChangeText={setCustomerName} /></View></View>
                  <View style={{ flex: 1 }}><View style={styles.inputWithIcon}><Phone size={14} color="#94a3b8" style={{ marginRight: 6 }} /><TextInput style={styles.smallInput} placeholder="Teléfono" placeholderTextColor="#94a3b8" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" /></View></View>
               </View>
               <View style={styles.totalRow}><Text style={styles.totalLabel}>TOTAL A PAGAR:</Text><Text style={styles.totalValue}>${cartTotal.toFixed(2)}</Text></View>
               <TouchableOpacity style={[styles.completeSaleBtn, processing && { opacity: 0.7 }]} onPress={handleCompleteSale} disabled={processing}>
                  {processing ? <ActivityIndicator color="#ffffff" size="small" /> : <><CheckCircle2 size={18} color="#ffffff" style={{ marginRight: 8 }} /><Text style={styles.completeSaleText}>Completar Venta</Text></>}
               </TouchableOpacity>
            </View>
         </View>
         <SaleReceiptModal sale={lastCompletedSale} visible={!!lastCompletedSale} onClose={() => setLastCompletedSale(null)} />
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
   leftPanel: { flex: 1.2, padding: 16, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
   rightPanel: { flex: 1, padding: 16, backgroundColor: '#ffffff', justifyContent: 'space-between' },
   panelTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
   listContent: { paddingVertical: 8 },
   emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
   productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   productCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
   productImg: { width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: '#f1f5f9' },
   productBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb' },
   productName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   productCode: { fontSize: 10, color: '#64748b' },
   productPrice: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
   paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4 },
   pageNavBtnDisabled: { opacity: 0.4 },
   pageNavText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   pageNavTextDisabled: { color: '#94a3b8' },
   pageIndicator: { fontSize: 13, color: '#475569' },
   selectionModal: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#2563eb', padding: 12, marginTop: 12, shadowColor: '#3b82f6', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
   selectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
   subLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
   chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 6 },
   chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
   chipText: { fontSize: 11, color: '#334155', fontWeight: '600' },
   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   sizeChip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginRight: 6 },
   sizeChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
   sizeChipDisabled: { opacity: 0.4, backgroundColor: '#f1f5f9' },
   sizeChipText: { fontSize: 11, color: '#334155', fontWeight: 'bold' },
   sizeChipTextActive: { color: '#ffffff' },
   sizeChipTextDisabled: { color: '#ef4444', textDecorationLine: 'line-through' },
   addToCartBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, marginTop: 6 },
   addToCartText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
   cartHeader: { flexDirection: 'row', alignItems: 'center' },
   cartScroll: { flex: 1, marginVertical: 12 },
   emptyCartText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
   cartItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   cartItemImg: { width: 40, height: 40, borderRadius: 6, marginRight: 8, backgroundColor: '#f1f5f9' },
   cartItemName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
   cartItemDetail: { fontSize: 10, color: '#64748b' },
   cartItemPrice: { fontSize: 10, color: '#16a34a', fontWeight: '600' },
   qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 6, padding: 2, marginHorizontal: 8 },
   qtyBtn: { padding: 4 },
   qtyText: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 6 },
   cartItemSubtotal: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   checkoutSection: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
   paymentMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
   paymentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
   paymentBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   paymentBtnText: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
   paymentBtnTextActive: { color: '#ffffff' },
   customerInputsRow: { flexDirection: 'row', marginBottom: 12 },
   inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 8, height: 36 },
   smallInput: { flex: 1, fontSize: 11, color: '#0f172a' },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   totalLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
   totalValue: { fontSize: 22, fontWeight: '800', color: '#16a34a' },
   completeSaleBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 10 },
   completeSaleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});

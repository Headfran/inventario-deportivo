import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
   View, Text, ScrollView, Pressable, StyleSheet, TextInput,
   ActivityIndicator, Modal, useWindowDimensions, FlatList, Platform
} from 'react-native';
import { Image } from 'expo-image';
import {
   ShoppingBag, Plus, Minus, CheckCircle2, CreditCard, Banknote, Smartphone,
   User, Phone, ChevronLeft, ChevronRight, X, QrCode,
} from 'lucide-react-native';
import { Product } from '../types/inventory';
import { Sale, SaleItem, PaymentMethod, Seller } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { subscribeToSellers, createSeller } from '../services/sellerService';
import { enqueuePendingSale } from '../services/offlineSyncService';
import { createSale } from '../services/saleService';
import { showAlert } from '../utils/alert';
import { SaleReceiptModal } from '../components/SaleReceiptModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { Cover } from '../components/Cover';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MONO as T, display } from '../design';

const ITEMS_PER_PAGE = 10;

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const PAYMENT_OPTIONS = [
   { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
   { id: 'efectivo', label: 'Efectivo', icon: Banknote },
   { id: 'zelle', label: 'Zelle', icon: CreditCard },
   { id: 'binance', label: 'Binance', icon: QrCode },
] as const;

interface Props {
   isOnline?: boolean;
}

export const SalesRegisterScreen: React.FC<Props> = ({ isOnline = true }) => {
   const { width } = useWindowDimensions();
   const split = width >= 900;
   const [panel, setPanel] = useState<'catalog' | 'cart'>('catalog');

   const [products, setProducts] = useState<Product[]>([]);
   const [sellers, setSellers] = useState<Seller[]>([]);

   const [filters, setFilters] = useState<FilterOptions>({
      query: '', category: 'all', brand: '', color: '', size: '', status: 'all',
   });
   const [currentPage, setCurrentPage] = useState(1);

   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
   const [selectedSize, setSelectedSize] = useState<string>('');

   const [cart, setCart] = useState<SaleItem[]>([]);
   const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
   const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [notes, setNotes] = useState('');

   const [processing, setProcessing] = useState(false);
   const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

   const [viewerImage, setViewerImage] = useState<string | null>(null);
   const [showNewSellerModal, setShowNewSellerModal] = useState(false);
   const [newSellerName, setNewSellerName] = useState('');

   const insets = useSafeAreaInsets();

   useEffect(() => {
      const unsubProducts = subscribeToProducts(setProducts);
      const unsubSellers = subscribeToSellers((data) => {
         setSellers(data);
         if (data.length > 0 && !selectedSeller) setSelectedSeller(data[0]);
      });
      return () => { unsubProducts(); unsubSellers(); };
   }, []);

   const handleFilterChange = useCallback((newFilters: FilterOptions) => {
      setFilters(newFilters);
      setCurrentPage(1);
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

   const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
   const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

   const handleSelectProduct = (product: Product) => {
      setSelectedProduct(product);
      setSelectedColorIndex(0);
      const firstAvailableSize = product.variants?.[0]?.sizes?.find((s) => Number(s.stock) > 0)?.size || '';
      setSelectedSize(firstAvailableSize);
   };

   const handleAddToCart = () => {
      if (!selectedProduct || !selectedSize) {
         showAlert('Atención', 'Selecciona un color y una talla disponible.');
         return;
      }
      const currentVariant = selectedProduct.variants[selectedColorIndex];
      if (!currentVariant) return;

      const sizeObj = currentVariant.sizes?.find((s) => s.size === selectedSize);
      const availableStock = Number(sizeObj?.stock) || 0;
      if (availableStock <= 0) {
         showAlert('Agotado', 'Esta talla no tiene unidades en stock.');
         return;
      }

      const productId = selectedProduct.id || selectedProduct.code || 'unknown';
      const existingIndex = cart.findIndex(
         (item) =>
            item.productId === productId &&
            item.color?.toLowerCase() === currentVariant.color?.toLowerCase() &&
            item.size === selectedSize
      );

      if (existingIndex > -1) {
         if (cart[existingIndex].quantity + 1 > availableStock) {
            showAlert('Límite alcanzado', `Solo hay ${availableStock} unidades disponibles.`);
            return;
         }
         const updatedCart = [...cart];
         updatedCart[existingIndex].quantity += 1;
         updatedCart[existingIndex].totalPrice = updatedCart[existingIndex].quantity * updatedCart[existingIndex].unitPrice;
         setCart(updatedCart);
      } else {
         const newItem: SaleItem = {
            productId,
            brand: selectedProduct.brand || 'Genérico',
            name: selectedProduct.name,
            productCode: selectedProduct.code || 'S/N',
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
      if (!split) setPanel('cart');
   };

   const updateCartQuantity = (index: number, delta: number) => {
      const updated = [...cart];
      const item = updated[index];
      const origProduct = products.find((p) => (p.id || p.code) === item.productId);
      const variant = origProduct?.variants?.find((v) => v.color?.toLowerCase() === item.color?.toLowerCase());
      const sizeObj = variant?.sizes?.find((s) => s.size === item.size);
      const maxStock = Number(sizeObj?.stock) || 0;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
         updated.splice(index, 1);
      } else if (newQty > maxStock) {
         showAlert('Stock insuficiente', `Solo hay ${maxStock} unidades disponibles.`);
         return;
      } else {
         item.quantity = newQty;

         // Auto-toggle: >= 12 unidades → precio al mayor (si existe)
         const retailPrice = Number(origProduct?.price) || item.unitPrice;
         const wholesalePrice = Number((origProduct as any)?.wholesalePrice) || 0;
         if (wholesalePrice > 0 && newQty >= 12) {
            item.unitPrice = wholesalePrice;
         } else if (newQty < 12) {
            item.unitPrice = retailPrice;
         }

         item.totalPrice = item.quantity * item.unitPrice;
      }
      setCart(updated);
   };

   const resetCart = () => {
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
   };

   const handleCreateSeller = async () => {
      if (!newSellerName.trim()) return;
      try {
         const newId = await createSeller(newSellerName.trim());
         setSelectedSeller({ id: newId, name: newSellerName.trim() });
         setShowNewSellerModal(false);
         setNewSellerName('');
      } catch {
         showAlert('Error', 'No se pudo crear el vendedor.');
      }
   };

   const handleCompleteSale = async () => {
      if (cart.length === 0) {
         showAlert('Carrito vacío', 'Agrega al menos una prenda antes de registrar la venta.');
         return;
      }
      if (!selectedSeller) {
         showAlert('Vendedor requerido', 'Selecciona el vendedor que realizó la venta.');
         return;
      }

      const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const isOffline = !isOnline;

      const saleDataToSave: any = {
         receiptNumber,
         sellerId: selectedSeller.id,
         sellerName: selectedSeller.name,
         items: cart,
         subtotal: cartTotal,
         discount: 0,
         total: cartTotal,
         paymentMethod,
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

      const buildCompletedSale = (id: string) =>
         ({ id, ...saleDataToSave, createdAt: { toDate: () => new Date() } } as Sale);

      if (isOffline) {
         try {
            await enqueuePendingSale(buildOfflineSale() as any);
            setLastCompletedSale(buildCompletedSale(`OFFLINE-${Date.now()}`));
            resetCart();
            if (!split) setPanel('catalog');
         } catch {
            showAlert('Error Offline', 'No se pudo guardar.');
         } finally {
            setProcessing(false);
         }
         return;
      }

      try {
         const saleId = await createSale(saleDataToSave);
         setLastCompletedSale(buildCompletedSale(saleId));
         resetCart();
         if (!split) setPanel('catalog');
      } catch (error: any) {
         console.warn('Fallo en la red online. Guardando en cola offline:', error);
         try {
            await enqueuePendingSale(buildOfflineSale() as any);
            setLastCompletedSale(buildCompletedSale(`OFFLINE-${Date.now()}`));
            resetCart();
            if (!split) setPanel('catalog');
            showAlert('📡 Venta Guardada en Cola', `Fallo de conexión. La venta #${receiptNumber} fue respaldada localmente.`);
         } catch {
            showAlert('Error en Venta', 'No se pudo completar la transacción.');
         }
      } finally {
         setProcessing(false);
      }
   };

   const renderProductItem = ({ item }: { item: Product }) => {
      const retail = Number(item.price || 0);
      const wholesale = Number((item as any).wholesalePrice || 0);

      return (
         <P
            style={[styles.productCard, selectedProduct?.id === item.id && styles.productCardSelected]}
            onPress={() => handleSelectProduct(item)}
         >
            <Pressable onPress={() => item.images?.[0] && setViewerImage(item.images[0])}>
               <Cover
                  uri={item.images?.[0]}
                  name={item.name}
                  bg={T.imgBg}
                  fg={T.line}
                  style={styles.productImg}
               />
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
               <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text>
               <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
               <Text style={styles.productCode}>SKU: {item.code}</Text>
            </View>

            <View style={styles.priceColumn}>
               <Text style={styles.productPrice}>${retail.toFixed(2)}</Text>
               {wholesale > 0 && (
                  <View style={styles.wholesalePriceRow}>
                     <Text style={styles.wholesalePriceText}>
                        ${wholesale.toFixed(2)}
                     </Text>
                     <Text style={styles.wholesaleTag}>12+</Text>
                  </View>
               )}
            </View>
         </P>
      );
   };

   // ==========================================
   // SECCIÓN DE CHECKOUT (compartida entre split/mobile)
   // ==========================================
   const checkout = (
      <View style={styles.checkoutSection}>
         {/* VENDEDOR */}
         <Text style={styles.subLabel}>Vendedor:</Text>
         <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12, flexGrow: 0 }}
            contentContainerStyle={{ gap: 6 }}
         >
            {sellers.map((s) => (
               <P
                  key={s.id}
                  style={[styles.chip, selectedSeller?.id === s.id && styles.chipOn]}
                  onPress={() => setSelectedSeller(s)}
               >
                  <Text style={[styles.chipText, selectedSeller?.id === s.id && styles.chipOnText]}>
                     {s.name}
                  </Text>
               </P>
            ))}
            <P style={[styles.chip, styles.chipAdd]} onPress={() => setShowNewSellerModal(true)}>
               <Plus size={12} color={T.ink} />
               <Text style={[styles.chipText, { color: T.ink }]}>Nuevo</Text>
            </P>
         </ScrollView>

         {/* MÉTODO DE PAGO */}
         <Text style={styles.subLabel}>Método de Pago:</Text>
         <View style={styles.paymentMethodsRow}>
            {PAYMENT_OPTIONS.map((m) => {
               const IconComp = m.icon;
               const isSelected = paymentMethod === m.id;
               return (
                  <P
                     key={m.id}
                     style={[styles.paymentBtn, isSelected && styles.chipOn]}
                     onPress={() => setPaymentMethod(m.id as PaymentMethod)}
                  >
                     <IconComp size={16} color={isSelected ? T.onSolid : T.inkMute} />
                     <Text style={[styles.paymentBtnText, isSelected && styles.chipOnText]}>
                        {m.label}
                     </Text>
                  </P>
               );
            })}
         </View>

         {/* CLIENTE (2 en fila) */}
         <View style={styles.customerInputsRow}>
            <View style={styles.inputWithIcon}>
               <User size={16} color={T.inkMute} />
               <TextInput
                  style={styles.smallInput}
                  placeholder="Nombre Cliente"
                  placeholderTextColor={T.inkMute}
                  value={customerName}
                  onChangeText={setCustomerName}
               />
            </View>
            <View style={styles.inputWithIcon}>
               <Phone size={16} color={T.inkMute} />
               <TextInput
                  style={styles.smallInput}
                  placeholder="Teléfono"
                  placeholderTextColor={T.inkMute}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
               />
            </View>
         </View>

         {/* NOTAS (ancho completo) — envuelto en customerInputsRow para heredar layout */}
         <View style={styles.customerInputsRow}>
            <View style={styles.inputWithIcon}>
               <TextInput
                  style={styles.smallInput}
                  placeholder="Notas de la venta (Opcional)"
                  placeholderTextColor={T.inkMute}
                  value={notes}
                  onChangeText={setNotes}
               />
            </View>
         </View>

         {/* TOTAL */}
         <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
            <Text style={styles.totalValue}>${cartTotal.toFixed(2)}</Text>
         </View>

         {/* COMPLETAR */}
         <P
            style={[styles.completeSaleBtn, processing && { opacity: 0.7 }]}
            onPress={handleCompleteSale}
            disabled={processing}
         >
            {processing ? (
               <ActivityIndicator color={T.onSolid} size="small" />
            ) : (
               <>
                  <CheckCircle2 size={20} color={T.onSolid} />
                  <Text style={styles.completeSaleText}>Completar y Generar Ticket</Text>
               </>
            )}
         </P>
      </View>
   );

   const showCatalog = split || panel === 'catalog';
   const showCart = split || panel === 'cart';

   return (
      <View style={styles.container}>
         {!split && (
            <View style={styles.tabs}>
               <P
                  style={[styles.tab, panel === 'catalog' && styles.tabOn]}
                  onPress={() => setPanel('catalog')}
               >
                  <Text style={[styles.tabText, panel === 'catalog' && styles.tabTextOn]}>
                     Catálogo
                  </Text>
               </P>
               <P
                  style={[styles.tab, panel === 'cart' && styles.tabOn]}
                  onPress={() => setPanel('cart')}
               >
                  <ShoppingBag size={16} color={panel === 'cart' ? T.onSolid : T.inkSoft} />
                  <Text style={[styles.tabText, panel === 'cart' && styles.tabTextOn]}>
                     Carrito
                  </Text>
                  {cartCount > 0 && (
                     <View style={[styles.tabBadge, panel === 'cart' && { backgroundColor: T.onSolid }]}>
                        <Text style={[styles.tabBadgeText, panel === 'cart' && { color: T.ink }]}>
                           {cartCount}
                        </Text>
                     </View>
                  )}
               </P>
            </View>
         )}

         <View style={[styles.body, split && styles.bodySplit]}>
            {/* ============ PANEL IZQUIERDO: CATÁLOGO ============ */}
            {showCatalog && (
               <View style={[styles.leftPanel, split && styles.leftSplit]}>
                  <View style={styles.head}>
                     <Text style={styles.panelTitle}>Catálogo de Prendas</Text>
                  </View>

                  <View style={{ marginBottom: 8 }}>
                     <ProductSearchFilter
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        availableCategories={availableCategories}
                        availableBrands={availableBrands}
                        availableSizes={availableSizes}
                     />
                  </View>

                  <FlatList
                     style={styles.productsScroll}
                     data={paginatedProducts}
                     keyExtractor={(item) => item.id || item.code || Math.random().toString()}
                     renderItem={renderProductItem}
                     contentContainerStyle={{ paddingBottom: 8 }}
                     ListEmptyComponent={
                        <Text style={styles.emptyCartText}>No se encontraron prendas.</Text>
                     }
                     showsVerticalScrollIndicator={false}
                  />

                  {totalPages > 1 && (
                     <View style={styles.paginationBar}>
                        <P
                           style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavDisabled]}
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
                           style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavDisabled]}
                           disabled={currentPage === totalPages}
                           onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                           <Text style={styles.pageNavText}>Siguiente</Text>
                           <ChevronRight size={18} color={T.ink} />
                        </P>
                     </View>
                  )}

                  {/* PANEL DE CONFIGURACIÓN DE PRODUCTO */}
                  {selectedProduct && (
                     <View style={styles.selectionModal}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                           <Text style={styles.selectionTitle} numberOfLines={2}>
                              {selectedProduct.brand} - {selectedProduct.name}
                           </Text>
                           <P style={{ padding: 4 }} onPress={() => setSelectedProduct(null)}>
                              <X size={18} color={T.inkSoft} />
                           </P>
                        </View>

                        <Text style={styles.subLabel}>Color:</Text>
                        <ScrollView
                           horizontal
                           showsHorizontalScrollIndicator={false}
                           style={{ marginBottom: 10, flexGrow: 0 }}
                           contentContainerStyle={{ gap: 6 }}
                        >
                           {(selectedProduct.variants || []).map((v, idx) => (
                              <P
                                 key={idx}
                                 style={[styles.chip, selectedColorIndex === idx && styles.chipOn]}
                                 onPress={() => {
                                    setSelectedColorIndex(idx);
                                    const firstStockSize =
                                       v.sizes?.find((s) => Number(s.stock) > 0)?.size || '';
                                    setSelectedSize(firstStockSize);
                                 }}
                              >
                                 <View style={[styles.swatch, { backgroundColor: (v as any).colorHex || '#000' }]} />
                                 <Text style={[styles.chipText, selectedColorIndex === idx && styles.chipOnText]}>
                                    {v.color}
                                 </Text>
                              </P>
                           ))}
                        </ScrollView>

                        <Text style={styles.subLabel}>Talla disponible:</Text>
                        <ScrollView
                           horizontal
                           showsHorizontalScrollIndicator={false}
                           style={{ marginBottom: 12, flexGrow: 0 }}
                           contentContainerStyle={{ gap: 6 }}
                        >
                           {(selectedProduct.variants?.[selectedColorIndex]?.sizes || []).map((sObj) => {
                              const hasStock = Number(sObj.stock) > 0;
                              const isSelected = selectedSize === sObj.size;
                              return (
                                 <P
                                    key={sObj.size}
                                    disabled={!hasStock}
                                    style={[styles.chip, isSelected && styles.chipOn, !hasStock && styles.chipDisabled]}
                                    onPress={() => setSelectedSize(sObj.size)}
                                 >
                                    <Text
                                       style={[
                                          styles.chipText,
                                          isSelected && styles.chipOnText,
                                          !hasStock && styles.chipTextDisabled,
                                       ]}
                                    >
                                       {sObj.size} ({sObj.stock})
                                    </Text>
                                 </P>
                              );
                           })}
                        </ScrollView>

                        <P style={styles.addToCartBtn} onPress={handleAddToCart}>
                           <Plus size={18} color={T.onSolid} />
                           <Text style={styles.addToCartText}>Agregar al Carrito</Text>
                        </P>
                     </View>
                  )}
               </View>
            )}

            {/* ============ PANEL DERECHO: CARRITO ============ */}
            {showCart && (
               <View style={[styles.rightPanel, split && styles.rightSplit]}>
                  <View style={styles.head}>
                     <ShoppingBag size={24} color={T.ink} />
                     <Text style={styles.panelTitle}>Carrito de Venta</Text>
                  </View>

                  <ScrollView
                     style={styles.cartScroll}
                     showsVerticalScrollIndicator={false}
                     contentContainerStyle={{
                        paddingBottom: split ? 8 : Math.max(insets.bottom, 20) + 60,
                     }}
                  >
                     {cart.length === 0 ? (
                        <Text style={styles.emptyCartText}>
                           El carrito está vacío. Selecciona prendas del catálogo para iniciar la venta.
                        </Text>
                     ) : (
                        cart.map((item, idx) => (
                           <View key={idx} style={styles.cartItemRow}>
                              <Pressable onPress={() => item.productImage && setViewerImage(item.productImage)}>
                                 <Cover
                                    uri={item.productImage}
                                    name={item.name}
                                    bg={T.imgBg}
                                    fg={T.line}
                                    style={styles.cartItemImg}
                                 />
                              </Pressable>
                              <View style={{ flex: 1, minWidth: 120 }}>
                                 <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                                 <Text style={styles.cartItemDetail}>
                                    Color: {item.color} • Talla: {item.size}
                                 </Text>
                                 <Text style={styles.cartItemPrice}>${item.unitPrice.toFixed(2)} c/u</Text>
                              </View>

                              <View style={styles.qtyControls}>
                                 <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, -1)}>
                                    <Minus size={14} color={T.ink} />
                                 </P>
                                 <Text style={styles.qtyText}>{item.quantity}</Text>
                                 <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, 1)}>
                                    <Plus size={14} color={T.ink} />
                                 </P>
                              </View>

                              <Text style={styles.cartItemSubtotal}>${item.totalPrice.toFixed(2)}</Text>
                           </View>
                        ))
                     )}

                     {!split && checkout}
                  </ScrollView>

                  {split && checkout}
               </View>
            )}
         </View>

         {/* LIGHTBOX */}
         <Modal visible={!!viewerImage} transparent animationType="fade">
            <View style={styles.viewerOverlay}>
               <Pressable style={styles.viewerClose} onPress={() => setViewerImage(null)}>
                  <X color={T.onBar} size={28} />
               </Pressable>
               {viewerImage && (
                  <Image
                     source={{ uri: viewerImage }}
                     style={{ width: '100%', height: '80%' }}
                     contentFit="contain"
                  />
               )}
            </View>
         </Modal>

         {/* MODAL NUEVO VENDEDOR */}
         <Modal visible={showNewSellerModal} transparent animationType="fade">
            <View style={styles.modalOverlayCenter}>
               <View style={styles.sellerModalCard}>
                  <View style={styles.sellerModalHeader}>
                     <Text style={styles.sellerModalTitle}>Nuevo Vendedor</Text>
                     <P onPress={() => setShowNewSellerModal(false)}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>
                  <View style={{ padding: 20 }}>
                     <Text style={styles.subLabel}>Nombre completo:</Text>
                     <TextInput
                        style={styles.sellerInput}
                        placeholder="Ej. María Pérez"
                        placeholderTextColor={T.inkMute}
                        value={newSellerName}
                        onChangeText={setNewSellerName}
                        autoFocus
                     />
                     <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <P
                           style={styles.sellerCancelBtn}
                           onPress={() => setShowNewSellerModal(false)}
                        >
                           <Text style={styles.sellerCancelText}>Cancelar</Text>
                        </P>
                        <P style={styles.sellerSaveBtn} onPress={handleCreateSeller}>
                           <Text style={styles.sellerSaveText}>Guardar</Text>
                        </P>
                     </View>
                  </View>
               </View>
            </View>
         </Modal>

         <SaleReceiptModal
            sale={lastCompletedSale}
            visible={!!lastCompletedSale}
            onClose={() => setLastCompletedSale(null)}
         />
      </View>
   );
};

const btn = {
   flexDirection: 'row' as const,
   alignItems: 'center' as const,
   justifyContent: 'center' as const,
   borderRadius: 10,
};
const chipBase = { borderWidth: 1, borderColor: T.line, borderRadius: 8 };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
   body: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' },
   bodySplit: { flexDirection: 'row' },
   head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
   panelTitle: {
      ...display,
      fontSize: 30,
      lineHeight: 30,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
      flexShrink: 1,
   },
   subLabel: { fontSize: 12, fontWeight: '700', color: T.inkSoft, marginBottom: 6 },
   chipOn: { backgroundColor: T.solid, borderColor: T.solid },
   chipOnText: { color: T.onSolid, fontWeight: '800' },

   // Tabs móvil
   tabs: { flexDirection: 'row', gap: 4, padding: 4, margin: 12, marginBottom: 0, borderRadius: 12, backgroundColor: T.surface },
   tab: { ...btn, flex: 1, height: 44, gap: 8, borderRadius: 9 },
   tabOn: { backgroundColor: T.solid },
   tabText: { fontSize: 14, fontWeight: '700', color: T.inkSoft },
   tabTextOn: { color: T.onSolid },
   tabBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: T.solid, alignItems: 'center', justifyContent: 'center' },
   tabBadgeText: { fontSize: 11, fontWeight: '800', color: T.onSolid },

   // Paneles
   leftPanel: { flex: 1, padding: 16 },
   leftSplit: { flex: 1.25, padding: 22, paddingRight: 18 },
   rightPanel: { flex: 1, padding: 16 },
   rightSplit: { maxWidth: 470, padding: 22, backgroundColor: T.surface, borderLeftWidth: 1, borderLeftColor: T.line },

   productsScroll: { flex: 1 },
   productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: T.surface,
      borderWidth: 2,
      borderColor: 'transparent',
   },
   productCardSelected: { borderColor: T.ink, backgroundColor: T.bg },
   productImg: { width: 52, height: 66, borderRadius: 8 },
   productBrand: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   productName: { fontSize: 14, fontWeight: '700', color: T.ink },
   productCode: { fontSize: 11, color: T.inkMute },

   // Paginación
   paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 8, marginTop: 8 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8 },
   pageNavDisabled: { opacity: 0.3 },
   pageNavText: { fontSize: 13, fontWeight: '700', color: T.ink },
   pageIndicator: { ...display, fontSize: 22, fontWeight: '700', color: T.inkMute },

   // Panel de selección de producto
   selectionModal: {
      backgroundColor: T.bg,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: T.ink,
      padding: 14,
      marginTop: 12,
   },
   selectionTitle: { fontSize: 14, fontWeight: '800', color: T.ink, flex: 1, marginRight: 8 },
   chip: {
      ...chipBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
   },
   chipAdd: { backgroundColor: T.surface },
   chipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   chipDisabled: { opacity: 0.4 },
   chipTextDisabled: { textDecorationLine: 'line-through' },
   swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
   addToCartBtn: { ...btn, height: 48, gap: 8, backgroundColor: T.solid, marginTop: 4 },
   addToCartText: { fontSize: 14, fontWeight: '800', color: T.onSolid },

   // Carrito
   cartScroll: { flex: 1 },
   emptyCartText: { fontSize: 14, color: T.inkMute, textAlign: 'center', marginTop: 40, lineHeight: 21 },
   cartItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
   },
   cartItemImg: { width: 44, height: 56, borderRadius: 6 },
   cartItemName: { fontSize: 14, fontWeight: '700', color: T.ink },
   cartItemDetail: { fontSize: 12, color: T.inkMute },
   cartItemPrice: { fontSize: 12, color: T.inkSoft, fontWeight: '600' },
   qtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg },
   qtyBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
   qtyText: { ...display, fontSize: 22, fontWeight: '700', color: T.ink, minWidth: 26, textAlign: 'center' },
   cartItemSubtotal: { ...display, fontSize: 24, lineHeight: 24, fontWeight: '800', color: T.ink, minWidth: 70, textAlign: 'right' },

   // Checkout
   paymentMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
   paymentBtn: {
      ...chipBase,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexGrow: 1,
      flexBasis: '46%',
      height: 44,
      backgroundColor: T.bg,
      borderRadius: 10,
   },
   paymentBtnText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   totalBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
   totalLabel: { fontSize: 13, fontWeight: '800', color: T.inkMute, paddingBottom: 8 },
   totalValue: { ...display, fontSize: 64, lineHeight: 60, fontWeight: '800', color: T.ink },

   completeSaleBtn: { ...btn, height: 58, gap: 10, backgroundColor: '#2BC526' },
   completeSaleText: { fontSize: 16, fontWeight: '800', color: T.onSolid },

   // Lightbox
   viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
   viewerClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },

   // Modal nuevo vendedor
   modalOverlayCenter: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
   sellerModalCard: { width: '100%', maxWidth: 380, backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   sellerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: T.bar,
   },
   sellerModalTitle: {
      ...display,
      fontSize: 22,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },
   sellerInput: {
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      backgroundColor: T.bg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: T.ink,
   },
   sellerCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: T.line },
   sellerCancelText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   sellerSaveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: T.solid },
   sellerSaveText: { fontSize: 13, fontWeight: '800', color: T.onSolid },

   // --- Precios en la card ---
   productPrice: {
      ...display,
      fontSize: 20,
      lineHeight: 20,
      fontWeight: '800',
      color: T.ink,
      textAlign: 'right',
   },
   priceColumn: {
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
   },
   wholesalePriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
   },
   wholesalePriceText: {
      ...display,
      fontSize: 13,
      lineHeight: 13,
      fontWeight: '700',
      color: '#059669',
   },
   wholesaleTag: {
      fontSize: 9,
      fontWeight: '800',
      color: '#059669',
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      overflow: 'hidden',
   },

   // --- Inputs corregidos ---
   customerInputsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
   },
   inputWithIcon: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 140,   // antes minWidth: 150 → ahora crece si cabe, se apila si no
      minWidth: 0,       // permite encoger si el espacio es muy justo
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
   },
   smallInput: {
      flex: 1,
      fontSize: 14,              // sube un poco para legibilidad
      color: T.ink,
      paddingVertical: 0,        // ← neutraliza padding nativo (causa raíz)
      paddingHorizontal: 0,      // ← idem
      margin: 0,
      textAlignVertical: 'center', // ← centrado vertical en Android
      height: '100%',            // fuerza el input a medir lo mismo que la caja
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },

   // --- Checkout con respiro al final ---
   checkoutSection: {
      borderTopWidth: 1,
      borderTopColor: T.line,
      paddingTop: 14,
      paddingBottom: 60,   // ← espacio tipo footer
      marginTop: 8,
   },
});

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, useWindowDimensions } from 'react-native';
import { ShoppingBag, Plus, Minus, CheckCircle2, CreditCard, Banknote, Smartphone, Search, User, Phone } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { Sale, SaleItem, PaymentMethod } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { createSale } from '../services/saleService';
import { showAlert } from '../utils/alert';
import { SaleReceiptModal } from '../components/SaleReceiptModal';
import { Cover } from '../components/Cover';
import { MONO as T, display, getColorHex } from '../design';

// Botón con respuesta al presionar
const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const SalesRegisterScreen = () => {
   const { width } = useWindowDimensions();
   const split = width >= 900; // PC: dos paneles. Celular y tableta: pestañas.
   const [panel, setPanel] = useState<'catalog' | 'cart'>('catalog');

   const [products, setProducts] = useState<Product[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
   const [selectedSize, setSelectedSize] = useState<string>('');

   // CARRITO Y PAGO
   const [cart, setCart] = useState<SaleItem[]>([]);
   const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [notes, setNotes] = useState('');
   const [processing, setProcessing] = useState(false);

   // FACTURA / TICKET DIGITAL CREADO
   const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

   useEffect(() => {
      const unsub = subscribeToProducts(setProducts);
      return () => unsub();
   }, []);

   const filteredProducts = products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
         p.name.toLowerCase().includes(q) ||
         p.brand.toLowerCase().includes(q) ||
         p.code.toLowerCase().includes(q)
      );
   });

   const handleSelectProduct = (product: Product) => {
      setSelectedProduct(product);
      setSelectedColorIndex(0);
      const firstAvailableSize = product.variants[0]?.sizes?.find((s) => Number(s.stock) > 0)?.size || '';
      setSelectedSize(firstAvailableSize);
   };

   const handleAddToCart = () => {
      if (!selectedProduct || !selectedSize) {
         showAlert('Atención', 'Selecciona un color y una talla disponible.');
         return;
      }

      const currentVariant = selectedProduct.variants[selectedColorIndex];
      const sizeObj = currentVariant?.sizes.find((s) => s.size === selectedSize);
      const availableStock = Number(sizeObj?.stock) || 0;

      if (availableStock <= 0) {
         showAlert('Agotado', 'Esta talla no tiene unidades en stock.');
         return;
      }

      const existingIndex = cart.findIndex(
         (item) =>
            item.productId === selectedProduct.id &&
            item.variantColor === currentVariant.color &&
            item.size === selectedSize
      );

      if (existingIndex > -1) {
         const currentQty = cart[existingIndex].quantity;
         if (currentQty + 1 > availableStock) {
            showAlert('Límite alcanzado', `Solo hay ${availableStock} unidades disponibles.`);
            return;
         }

         const updatedCart = [...cart];
         updatedCart[existingIndex].quantity += 1;
         updatedCart[existingIndex].subtotal = updatedCart[existingIndex].quantity * updatedCart[existingIndex].unitPrice;
         setCart(updatedCart);
      } else {
         const newItem: SaleItem = {
            productId: selectedProduct.id!,
            productBrand: selectedProduct.brand,
            productName: selectedProduct.name,
            productCode: selectedProduct.code,
            variantColor: currentVariant.color,
            size: selectedSize,
            quantity: 1,
            unitPrice: selectedProduct.price,
            subtotal: selectedProduct.price,
            productImage: selectedProduct.images[0],
         };
         setCart([...cart, newItem]);
      }

      setSelectedProduct(null);
   };

   const updateCartQuantity = (index: number, delta: number) => {
      const updated = [...cart];
      const item = updated[index];

      const origProduct = products.find((p) => p.id === item.productId);
      const variant = origProduct?.variants.find((v) => v.color.toLowerCase() === item.variantColor.toLowerCase());
      const sizeObj = variant?.sizes.find((s) => s.size === item.size);
      const maxStock = Number(sizeObj?.stock) || 0;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
         updated.splice(index, 1);
      } else if (newQty > maxStock) {
         showAlert('Stock insuficiente', `Solo hay ${maxStock} unidades disponibles.`);
         return;
      } else {
         item.quantity = newQty;
         item.subtotal = item.quantity * item.unitPrice;
      }
      setCart(updated);
   };

   const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

   const handleCompleteSale = async () => {
      if (cart.length === 0) {
         showAlert('Carrito vacío', 'Agrega al menos una prenda antes de registrar la venta.');
         return;
      }

      try {
         setProcessing(true);

         const saleDataToSave: Omit<Sale, 'id' | 'createdAt'> = {
            items: cart,
            totalAmount,
            paymentMethod,
         };

         if (customerName.trim()) {
            saleDataToSave.customerName = customerName.trim();
         }
         if (customerPhone.trim()) {
            saleDataToSave.customerPhone = customerPhone.trim();
         }
         if (notes.trim()) {
            saleDataToSave.notes = notes.trim();
         }

         const saleId = await createSale(saleDataToSave);

         setLastCompletedSale({
            id: saleId,
            ...saleDataToSave,
            createdAt: { toDate: () => new Date() },
         });

         setCart([]);
         setCustomerName('');
         setCustomerPhone('');
         setNotes('');
      } catch (error: any) {
         showAlert('Error en Venta', error.message || 'No se pudo completar la transacción.');
      } finally {
         setProcessing(false);
      }
   };

   const cartCount = cart.reduce((n, i) => n + i.quantity, 0);
   const showCatalog = split || panel === 'catalog';
   const showCart = split || panel === 'cart';

   const checkout = (
      <View style={styles.checkoutSection}>
         <Text style={styles.subLabel}>Método de Pago:</Text>
         <View style={styles.paymentMethodsRow}>
            {[
               { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
               { id: 'efectivo', label: 'Efectivo', icon: Banknote },
               { id: 'zelle', label: 'Zelle', icon: CreditCard },
               { id: 'tarjeta', label: 'Tarjeta / Punto', icon: CreditCard },
            ].map((m) => {
               const IconComp = m.icon;
               const isSelected = paymentMethod === m.id;
               return (
                  <P
                     key={m.id}
                     style={[styles.paymentBtn, isSelected && styles.chipOn]}
                     onPress={() => setPaymentMethod(m.id as PaymentMethod)}
                  >
                     <IconComp size={16} color={isSelected ? T.onSolid : T.inkMute} />
                     <Text style={[styles.paymentBtnText, isSelected && styles.chipOnText]}>{m.label}</Text>
                  </P>
               );
            })}
         </View>

         <View style={styles.customerInputsRow}>
            <View style={styles.inputWithIcon}>
               <User size={16} color={T.inkMute} />
               <TextInput
                  style={styles.smallInput}
                  placeholder="Nombre Cliente (Opcional)"
                  placeholderTextColor={T.inkMute}
                  value={customerName}
                  onChangeText={setCustomerName}
               />
            </View>

            <View style={styles.inputWithIcon}>
               <Phone size={16} color={T.inkMute} />
               <TextInput
                  style={styles.smallInput}
                  placeholder="Teléfono (Opcional)"
                  placeholderTextColor={T.inkMute}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
               />
            </View>
         </View>

         <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
            <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
         </View>

         <P
            style={[styles.completeSaleBtn, processing && { opacity: 0.7 }]}
            onPress={handleCompleteSale}
            disabled={processing}
         >
            {processing ? (
               <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
               <>
                  <CheckCircle2 size={20} color="#FFFFFF" />
                  <Text style={styles.completeSaleText}>Completar y Generar Ticket</Text>
               </>
            )}
         </P>
      </View>
   );

   return (
      <View style={styles.container}>
         {!split && (
            <View style={styles.tabs}>
               <P style={[styles.tab, panel === 'catalog' && styles.tabOn]} onPress={() => setPanel('catalog')}>
                  <Text style={[styles.tabText, panel === 'catalog' && styles.tabTextOn]}>Catálogo</Text>
               </P>
               <P style={[styles.tab, panel === 'cart' && styles.tabOn]} onPress={() => setPanel('cart')}>
                  <ShoppingBag size={16} color={panel === 'cart' ? T.onSolid : T.inkSoft} />
                  <Text style={[styles.tabText, panel === 'cart' && styles.tabTextOn]}>Carrito</Text>
                  {cartCount > 0 && (
                     <View style={[styles.tabBadge, panel === 'cart' && { backgroundColor: T.onSolid }]}>
                        <Text style={[styles.tabBadgeText, panel === 'cart' && { color: T.ink }]}>{cartCount}</Text>
                     </View>
                  )}
               </P>
            </View>
         )}

         <View style={[styles.body, split && styles.bodySplit]}>
            {showCatalog && (
               <View style={[styles.leftPanel, split && styles.leftSplit]}>
                  <View style={styles.head}>
                     <Text style={styles.panelTitle}>Catálogo de Prendas</Text>
                  </View>

                  <View style={styles.searchBar}>
                     <Search size={18} color={T.inkMute} />
                     <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por código, marca o nombre..."
                        placeholderTextColor={T.inkMute}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                     />
                  </View>

                  <ScrollView style={styles.productsScroll} showsVerticalScrollIndicator={false}>
                     {filteredProducts.map((product) => (
                        <P
                           key={product.id || product.code}
                           style={[styles.productCard, selectedProduct?.id === product.id && styles.productCardSelected]}
                           onPress={() => handleSelectProduct(product)}
                        >
                           <Cover uri={product.images?.[0]} name={product.name} bg={T.imgBg} fg={T.line} style={styles.productImg} />
                           <View style={{ flex: 1 }}>
                              <Text style={styles.productBrand}>{product.brand}</Text>
                              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                              <Text style={styles.productCode}>SKU: {product.code}</Text>
                           </View>
                           <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                        </P>
                     ))}
                  </ScrollView>

                  {selectedProduct && (
                     <View style={styles.selectionModal}>
                        <Text style={styles.selectionTitle}>
                           Configurar: {selectedProduct.brand} - {selectedProduct.name}
                        </Text>

                        <Text style={styles.subLabel}>Color:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }}>
                           {selectedProduct.variants.map((v, idx) => (
                              <P
                                 key={idx}
                                 style={[styles.chip, selectedColorIndex === idx && styles.chipOn]}
                                 onPress={() => {
                                    setSelectedColorIndex(idx);
                                    const firstStockSize = v.sizes.find((s) => Number(s.stock) > 0)?.size || '';
                                    setSelectedSize(firstStockSize);
                                 }}
                              >
                                 <View style={[styles.swatch, { backgroundColor: getColorHex(v.color || '') }]} />
                                 <Text style={[styles.chipText, selectedColorIndex === idx && styles.chipOnText]}>{v.color}</Text>
                              </P>
                           ))}
                        </ScrollView>

                        <Text style={styles.subLabel}>Talla disponible:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }}>
                           {selectedProduct.variants[selectedColorIndex]?.sizes.map((sObj) => {
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

            {showCart && (
               <View style={[styles.rightPanel, split && styles.rightSplit]}>
                  <View style={styles.head}>
                     <ShoppingBag size={24} color={T.ink} />
                     <Text style={styles.panelTitle}>Carrito de Venta</Text>
                  </View>

                  <ScrollView style={styles.cartScroll} showsVerticalScrollIndicator={false}>
                     {cart.length === 0 ? (
                        <Text style={styles.emptyCartText}>
                           El carrito está vacío. Selecciona prendas del catálogo para iniciar la venta.
                        </Text>
                     ) : (
                        cart.map((item, idx) => (
                           <View key={idx} style={styles.cartItemRow}>
                              <Cover uri={item.productImage} name={item.productName} bg={T.imgBg} fg={T.line} style={styles.cartItemImg} />
                              <View style={{ flex: 1, minWidth: 120 }}>
                                 <Text style={styles.cartItemName} numberOfLines={2}>{item.productName}</Text>
                                 <Text style={styles.cartItemDetail}>
                                    Color: {item.variantColor} • Talla: {item.size}
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

                              <Text style={styles.cartItemSubtotal}>${item.subtotal.toFixed(2)}</Text>
                           </View>
                        ))
                     )}
                     {!split && checkout}
                  </ScrollView>

                  {split && checkout}
               </View>
            )}
         </View>

         <SaleReceiptModal
            sale={lastCompletedSale}
            visible={!!lastCompletedSale}
            onClose={() => setLastCompletedSale(null)}
         />
      </View>
   );
};

const btn = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 10 };
const chip = { borderWidth: 1, borderColor: T.line, borderRadius: 8 };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
   body: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' },
   bodySplit: { flexDirection: 'row' },
   head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
   panelTitle: { ...display, fontSize: 30, lineHeight: 30, fontWeight: '800', color: T.ink, textTransform: 'uppercase', flexShrink: 1 },
   subLabel: { fontSize: 12, fontWeight: '700', color: T.inkSoft, marginBottom: 6 },
   chipOn: { backgroundColor: T.solid, borderColor: T.solid },
   chipOnText: { color: T.onSolid, fontWeight: '800' },

   tabs: { flexDirection: 'row', gap: 4, padding: 4, margin: 12, marginBottom: 0, borderRadius: 12, backgroundColor: T.surface },
   tab: { ...btn, flex: 1, height: 44, gap: 8, borderRadius: 9 },
   tabOn: { backgroundColor: T.solid },
   tabText: { fontSize: 14, fontWeight: '700', color: T.inkSoft },
   tabTextOn: { color: T.onSolid },
   tabBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: T.solid, alignItems: 'center', justifyContent: 'center' },
   tabBadgeText: { fontSize: 11, fontWeight: '800', color: T.onSolid },

   leftPanel: { flex: 1, padding: 16 },
   leftSplit: { flex: 1.25, padding: 22, paddingRight: 18 },
   searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, marginBottom: 12 },
   searchInput: { flex: 1, fontSize: 14, color: T.ink },
   productsScroll: { flex: 1 },
   productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, marginBottom: 8, backgroundColor: T.surface, borderWidth: 2, borderColor: 'transparent' },
   productCardSelected: { borderColor: T.ink, backgroundColor: T.bg },
   productImg: { width: 52, height: 66, borderRadius: 8 },
   productBrand: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   productName: { fontSize: 14, fontWeight: '700', color: T.ink },
   productCode: { fontSize: 11, color: T.inkMute },
   productPrice: { ...display, fontSize: 26, lineHeight: 26, fontWeight: '800', color: T.ink },

   selectionModal: { backgroundColor: T.bg, borderRadius: 14, borderWidth: 2, borderColor: T.ink, padding: 14, marginTop: 12 },
   selectionTitle: { fontSize: 14, fontWeight: '800', color: T.ink, marginBottom: 10 },
   chip: { ...chip, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6 },
   chipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   chipDisabled: { opacity: 0.4 },
   chipTextDisabled: { textDecorationLine: 'line-through' },
   swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(82, 97, 230, 0.55)' },
   addToCartBtn: { ...btn, height: 48, gap: 8, backgroundColor: T.solid, marginTop: 4 },
   addToCartText: { fontSize: 14, fontWeight: '800', color: T.onSolid },

   rightPanel: { flex: 1, padding: 16 },
   rightSplit: { maxWidth: 470, padding: 22, backgroundColor: T.surface, borderLeftWidth: 1, borderLeftColor: T.line },
   cartScroll: { flex: 1 },
   emptyCartText: { fontSize: 14, color: T.inkMute, textAlign: 'center', marginTop: 40, lineHeight: 21 },
   cartItemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
   cartItemImg: { width: 44, height: 56, borderRadius: 6 },
   cartItemName: { fontSize: 14, fontWeight: '700', color: T.ink },
   cartItemDetail: { fontSize: 12, color: T.inkMute },
   cartItemPrice: { fontSize: 12, color: T.inkSoft, fontWeight: '600' },
   qtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg },
   qtyBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
   qtyText: { ...display, fontSize: 22, fontWeight: '700', color: T.ink, minWidth: 26, textAlign: 'center' },
   cartItemSubtotal: { ...display, fontSize: 24, lineHeight: 24, fontWeight: '800', color: T.ink, minWidth: 70, textAlign: 'right' },

   checkoutSection: { borderTopWidth: 1, borderTopColor: T.line, paddingTop: 14, marginTop: 8 },
   paymentMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
   paymentBtn: { ...chip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexGrow: 1, flexBasis: '46%', height: 44, backgroundColor: T.bg, borderRadius: 10 },
   paymentBtnText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   customerInputsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
   inputWithIcon: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   smallInput: { flex: 1, fontSize: 13, color: T.ink },
   totalBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
   totalLabel: { fontSize: 13, fontWeight: '800', color: T.inkMute, paddingBottom: 8 },
   totalValue: { ...display, fontSize: 64, lineHeight: 60, fontWeight: '800', color: T.ink },
   
   // Botón verde de Completar y Generar Ticket
   completeSaleBtn: { ...btn, height: 58, gap: 10, backgroundColor: '#2bc526' },
   completeSaleText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
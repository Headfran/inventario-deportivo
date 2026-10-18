import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   ScrollView,
   TouchableOpacity,
   StyleSheet,
   TextInput,
   Image,
   ActivityIndicator,
} from 'react-native';
import {
   ShoppingBag,
   Plus,
   Minus,
   CheckCircle2,
   CreditCard,
   Banknote,
   Smartphone,
   Search,
   User,
   Phone,
} from 'lucide-react-native';
import { Product } from '../types/inventory';
import { Sale, SaleItem, PaymentMethod } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { createSale } from '../services/saleService';
import { showAlert } from '../utils/alert';
import { SaleReceiptModal } from '../components/SaleReceiptModal';

// Paleta de diseño (un solo lugar para cambiar colores)
const C = {
   bg: '#0A0A0A',
   surface: '#121212',
   raised: '#1A1A1A',
   border: '#262626',
   line: '#2E2E2E',
   white: '#FFFFFF',
   light: '#E8E8E8',
   soft: '#BDBDBD',
   mute: '#8A8A8A',
   dim: '#6A6A6A',
};

export const SalesRegisterScreen = () => {
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

         // 1. Construimos el objeto excluyendo llaves con valores undefined
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

         // 2. Guardamos en Firestore
         const saleId = await createSale(saleDataToSave);

         // 3. Guardar para desplegar el comprobante digital
         setLastCompletedSale({
            id: saleId,
            ...saleDataToSave,
            createdAt: { toDate: () => new Date() },
         });

         // 4. Limpiar el carrito y campos
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

   return (
      <View style={styles.container}>
         {/* SECCIÓN IZQUIERDA: CATÁLOGO */}
         <View style={styles.leftPanel}>
            <Text style={styles.panelTitle}>Catálogo de Prendas</Text>

            <View style={styles.searchBar}>
               <Search size={16} color={C.mute} style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por código, marca o nombre..."
                  placeholderTextColor={C.dim}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
               />
            </View>

            <ScrollView style={styles.productsScroll}>
               {filteredProducts.map((product) => (
                  <TouchableOpacity
                     key={product.id || product.code}
                     style={[
                        styles.productCard,
                        selectedProduct?.id === product.id && styles.productCardSelected,
                     ]}
                     onPress={() => handleSelectProduct(product)}
                  >
                     <Image
                        source={{ uri: product.images[0] || 'https://via.placeholder.com/60' }}
                        style={styles.productImg}
                     />
                     <View style={{ flex: 1 }}>
                        <Text style={styles.productBrand}>{product.brand}</Text>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productCode}>SKU: {product.code}</Text>
                     </View>
                     <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                  </TouchableOpacity>
               ))}
            </ScrollView>

            {selectedProduct && (
               <View style={styles.selectionModal}>
                  <Text style={styles.selectionTitle}>
                     Configurar: {selectedProduct.brand} - {selectedProduct.name}
                  </Text>

                  <Text style={styles.subLabel}>Color:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                     {selectedProduct.variants.map((v, idx) => (
                        <TouchableOpacity
                           key={idx}
                           style={[
                              styles.chip,
                              selectedColorIndex === idx && styles.chipActive,
                           ]}
                           onPress={() => {
                              setSelectedColorIndex(idx);
                              const firstStockSize = v.sizes.find((s) => Number(s.stock) > 0)?.size || '';
                              setSelectedSize(firstStockSize);
                           }}
                        >
                           <Text
                              style={[
                                 styles.chipText,
                                 selectedColorIndex === idx && styles.chipTextActive,
                              ]}
                           >
                              {v.color}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>

                  <Text style={styles.subLabel}>Talla disponible:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                     {selectedProduct.variants[selectedColorIndex]?.sizes.map((sObj) => {
                        const hasStock = Number(sObj.stock) > 0;
                        const isSelected = selectedSize === sObj.size;

                        return (
                           <TouchableOpacity
                              key={sObj.size}
                              disabled={!hasStock}
                              style={[
                                 styles.sizeChip,
                                 isSelected && styles.sizeChipActive,
                                 !hasStock && styles.sizeChipDisabled,
                              ]}
                              onPress={() => setSelectedSize(sObj.size)}
                           >
                              <Text
                                 style={[
                                    styles.sizeChipText,
                                    isSelected && styles.sizeChipTextActive,
                                    !hasStock && styles.sizeChipTextDisabled,
                                 ]}
                              >
                                 {sObj.size} ({sObj.stock})
                              </Text>
                           </TouchableOpacity>
                        );
                     })}
                  </ScrollView>

                  <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
                     <Plus size={16} color={C.bg} style={{ marginRight: 6 }} />
                     <Text style={styles.addToCartText}>Agregar al Carrito</Text>
                  </TouchableOpacity>
               </View>
            )}
         </View>

         {/* SECCIÓN DERECHA: CARRITO Y VENTA */}
         <View style={styles.rightPanel}>
            <View style={styles.cartHeader}>
               <ShoppingBag size={20} color={C.light} style={{ marginRight: 8, marginBottom: 12 }} />
               <Text style={styles.panelTitle}>Carrito de Venta</Text>
            </View>

            <ScrollView style={styles.cartScroll}>
               {cart.length === 0 ? (
                  <Text style={styles.emptyCartText}>
                     El carrito está vacío. Selecciona prendas del catálogo para iniciar la venta.
                  </Text>
               ) : (
                  cart.map((item, idx) => (
                     <View key={idx} style={styles.cartItemRow}>
                        <Image
                           source={{ uri: item.productImage || 'https://via.placeholder.com/50' }}
                           style={styles.cartItemImg}
                        />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.cartItemName}>{item.productName}</Text>
                           <Text style={styles.cartItemDetail}>
                              Color: {item.variantColor} • Talla: {item.size}
                           </Text>
                           <Text style={styles.cartItemPrice}>${item.unitPrice.toFixed(2)} c/u</Text>
                        </View>

                        <View style={styles.qtyControls}>
                           <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQuantity(idx, -1)}
                           >
                              <Minus size={12} color={C.light} />
                           </TouchableOpacity>
                           <Text style={styles.qtyText}>{item.quantity}</Text>
                           <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQuantity(idx, 1)}
                           >
                              <Plus size={12} color={C.light} />
                           </TouchableOpacity>
                        </View>

                        <Text style={styles.cartItemSubtotal}>${item.subtotal.toFixed(2)}</Text>
                     </View>
                  ))
               )}
            </ScrollView>

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
                        <TouchableOpacity
                           key={m.id}
                           style={[styles.paymentBtn, isSelected && styles.paymentBtnActive]}
                           onPress={() => setPaymentMethod(m.id as PaymentMethod)}
                        >
                           <IconComp size={14} color={isSelected ? C.bg : C.mute} />
                           <Text style={[styles.paymentBtnText, isSelected && styles.paymentBtnTextActive]}>
                              {m.label}
                           </Text>
                        </TouchableOpacity>
                     );
                  })}
               </View>

               <View style={styles.customerInputsRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                     <View style={styles.inputWithIcon}>
                        <User size={14} color={C.mute} style={{ marginRight: 6 }} />
                        <TextInput
                           style={styles.smallInput}
                           placeholder="Nombre Cliente (Opcional)"
                           placeholderTextColor={C.dim}
                           value={customerName}
                           onChangeText={setCustomerName}
                        />
                     </View>
                  </View>

                  <View style={{ flex: 1 }}>
                     <View style={styles.inputWithIcon}>
                        <Phone size={14} color={C.mute} style={{ marginRight: 6 }} />
                        <TextInput
                           style={styles.smallInput}
                           placeholder="Teléfono (Opcional)"
                           placeholderTextColor={C.dim}
                           value={customerPhone}
                           onChangeText={setCustomerPhone}
                           keyboardType="phone-pad"
                        />
                     </View>
                  </View>
               </View>

               <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
                  <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
               </View>

               <TouchableOpacity
                  style={[styles.completeSaleBtn, processing && { opacity: 0.7 }]}
                  onPress={handleCompleteSale}
                  disabled={processing}
               >
                  {processing ? (
                     <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                     <>
                        <CheckCircle2 size={18} color={C.bg} style={{ marginRight: 8 }} />
                        <Text style={styles.completeSaleText}>Completar y Generar Ticket</Text>
                     </>
                  )}
               </TouchableOpacity>
            </View>
         </View>

         {/* MODAL DEL COMPROBANTE DE VENTA */}
         <SaleReceiptModal
            sale={lastCompletedSale}
            visible={!!lastCompletedSale}
            onClose={() => setLastCompletedSale(null)}
         />
      </View>
   );
};

// Bases compartidas (evitan repetir estilos)
const box = {
   backgroundColor: C.raised,
   borderWidth: 1,
   borderColor: C.line,
   borderRadius: 2,
};
const activeBox = { backgroundColor: C.light, borderColor: C.light };
const activeText = { color: C.bg, fontWeight: '900' as const };
const caps = { textTransform: 'uppercase' as const, letterSpacing: 2 };
const primaryBtn = {
   flexDirection: 'row' as const,
   justifyContent: 'center' as const,
   alignItems: 'center' as const,
   backgroundColor: C.light,
   borderRadius: 2,
};
const primaryText = { ...caps, color: C.bg, fontWeight: '900' as const };

const styles = StyleSheet.create({
   container: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
   leftPanel: { flex: 1.2, padding: 16, borderRightWidth: 1, borderRightColor: '#1E1E1E' },
   rightPanel: { flex: 1, padding: 16, backgroundColor: C.surface, justifyContent: 'space-between' },
   panelTitle: { ...caps, fontSize: 14, fontWeight: '900', color: C.white, marginBottom: 12 },

   searchBar: { ...box, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, marginBottom: 12 },
   searchInput: { flex: 1, fontSize: 13, color: C.white },

   productsScroll: { flex: 1 },
   productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 4,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#1F1F1F',
   },
   productCardSelected: { borderColor: C.light, backgroundColor: C.raised },
   productImg: { width: 44, height: 44, borderRadius: 2, marginRight: 10, backgroundColor: C.raised },
   productBrand: { ...caps, fontSize: 9, fontWeight: 'bold', color: C.mute },
   productName: { fontSize: 13, fontWeight: 'bold', color: C.white },
   productCode: { fontSize: 10, color: C.dim },
   productPrice: { fontSize: 14, fontWeight: '900', color: C.white },

   selectionModal: { backgroundColor: C.surface, borderRadius: 4, borderWidth: 1, borderColor: C.soft, padding: 12, marginTop: 12 },
   selectionTitle: { fontSize: 13, fontWeight: 'bold', color: C.white, marginBottom: 8 },
   subLabel: { ...caps, fontSize: 10, fontWeight: 'bold', color: C.mute, marginBottom: 4 },

   chip: { ...box, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
   chipActive: activeBox,
   chipText: { fontSize: 11, color: C.soft },
   chipTextActive: activeText,

   sizeChip: { ...box, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
   sizeChipActive: activeBox,
   sizeChipDisabled: { opacity: 0.4 },
   sizeChipText: { fontSize: 11, color: C.soft, fontWeight: 'bold' },
   sizeChipTextActive: activeText,
   sizeChipTextDisabled: { color: C.mute, textDecorationLine: 'line-through' },

   addToCartBtn: { ...primaryBtn, paddingVertical: 10, marginTop: 6 },
   addToCartText: { ...primaryText, fontSize: 12 },

   cartHeader: { flexDirection: 'row', alignItems: 'center' },
   cartScroll: { flex: 1, marginVertical: 12 },
   emptyCartText: { fontSize: 13, color: C.dim, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
   cartItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222222' },
   cartItemImg: { width: 40, height: 40, borderRadius: 2, marginRight: 8, backgroundColor: C.raised },
   cartItemName: { fontSize: 12, fontWeight: 'bold', color: C.white },
   cartItemDetail: { fontSize: 10, color: C.mute },
   cartItemPrice: { fontSize: 10, color: C.soft, fontWeight: '600' },
   qtyControls: { ...box, flexDirection: 'row', alignItems: 'center', padding: 2, marginHorizontal: 8 },
   qtyBtn: { padding: 4 },
   qtyText: { fontSize: 12, fontWeight: 'bold', color: C.white, paddingHorizontal: 6 },
   cartItemSubtotal: { fontSize: 13, fontWeight: '900', color: C.white },

   checkoutSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
   paymentMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
   paymentBtn: { ...box, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
   paymentBtnActive: activeBox,
   paymentBtnText: { fontSize: 11, color: C.soft, fontWeight: 'bold' },
   paymentBtnTextActive: activeText,

   customerInputsRow: { flexDirection: 'row', marginBottom: 12 },
   inputWithIcon: { ...box, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 36 },
   smallInput: { flex: 1, fontSize: 11, color: C.white },

   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   totalLabel: { ...caps, fontSize: 11, fontWeight: 'bold', color: C.mute },
   totalValue: { fontSize: 24, fontWeight: '900', color: C.white },
   completeSaleBtn: { ...primaryBtn, paddingVertical: 14 },
   completeSaleText: { ...primaryText, fontSize: 13 },
});
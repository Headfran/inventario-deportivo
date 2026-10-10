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
               <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por código, marca o nombre..."
                  placeholderTextColor="#94a3b8"
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
                     <Plus size={16} color="#ffffff" style={{ marginRight: 6 }} />
                     <Text style={styles.addToCartText}>Agregar al Carrito</Text>
                  </TouchableOpacity>
               </View>
            )}
         </View>

         {/* SECCIÓN DERECHA: CARRITO Y VENTA */}
         <View style={styles.rightPanel}>
            <View style={styles.cartHeader}>
               <ShoppingBag size={20} color="#2563eb" style={{ marginRight: 8 }} />
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
                              <Minus size={12} color="#0f172a" />
                           </TouchableOpacity>
                           <Text style={styles.qtyText}>{item.quantity}</Text>
                           <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQuantity(idx, 1)}
                           >
                              <Plus size={12} color="#0f172a" />
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
                           <IconComp size={14} color={isSelected ? '#ffffff' : '#475569'} />
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
                        <User size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                        <TextInput
                           style={styles.smallInput}
                           placeholder="Nombre Cliente (Opcional)"
                           placeholderTextColor="#94a3b8"
                           value={customerName}
                           onChangeText={setCustomerName}
                        />
                     </View>
                  </View>

                  <View style={{ flex: 1 }}>
                     <View style={styles.inputWithIcon}>
                        <Phone size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                        <TextInput
                           style={styles.smallInput}
                           placeholder="Teléfono (Opcional)"
                           placeholderTextColor="#94a3b8"
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
                     <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                     <>
                        <CheckCircle2 size={18} color="#ffffff" style={{ marginRight: 8 }} />
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

const styles = StyleSheet.create({
   container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
   leftPanel: { flex: 1.2, padding: 16, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
   rightPanel: { flex: 1, padding: 16, backgroundColor: '#ffffff', justifyContent: 'space-between' },
   panelTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
   searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, marginBottom: 12 },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   productsScroll: { flex: 1 },
   productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
   productCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
   productImg: { width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: '#f1f5f9' },
   productBrand: { fontSize: 10, fontWeight: 'bold', color: '#2563eb' },
   productName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   productCode: { fontSize: 10, color: '#64748b' },
   productPrice: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
   selectionModal: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#2563eb', padding: 12, marginTop: 12 },
   selectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
   subLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
   chip: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6 },
   chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   chipText: { fontSize: 11, color: '#334155' },
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
   cartItemImg: { width: 40, height: 40, borderRadius: 6, marginRight: 8 },
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

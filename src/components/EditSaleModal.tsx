import React, { useState, useEffect, useMemo } from 'react';
import {
   View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import {
   X, Plus, Minus, Trash2, Search, Save, ArrowRightLeft,
   AlertTriangle, Coins, ChevronDown, ChevronUp, User, Percent,
} from 'lucide-react-native';
import { Cover } from '../components/Cover';
import { Sale, SaleItem, editSale } from '../services/salesHistoryService';
import { Seller } from '../types/sale';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';
import { subscribeToSellers } from '../services/sellerService';
import { getRates } from '../services/settingsService';
import { showAlert, showConfirm } from '../utils/alert';
import { roundMoney } from '../utils/pricingUtils';
import { MONO as T, display } from '../design';

interface Props {
   sale: Sale | null;
   visible: boolean;
   onClose: () => void;
   onSaved: () => void;
}

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const paymentLabels: Record<string, string> = {
   pago_movil: 'Pago Móvil',
   efectivo: 'Efectivo',
   zelle: 'Zelle',
   binance: 'Binance',
   transferencia: 'Transferencia',
   mixto: 'Mixto',
   punto: 'Punto',
};

export const EditSaleModal: React.FC<Props> = ({ sale, visible, onClose, onSaved }) => {
   const [items, setItems] = useState<SaleItem[]>([]);
   const [discountInput, setDiscountInput] = useState('0');
   const [reason, setReason] = useState('');
   const [adjustmentMethod, setAdjustmentMethod] = useState('efectivo');
   const [saving, setSaving] = useState(false);

   const [products, setProducts] = useState<Product[]>([]);
   const [sellers, setSellers] = useState<Seller[]>([]);
   const [showPicker, setShowPicker] = useState(false);
   const [search, setSearch] = useState('');
   const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

   const [sellerId, setSellerId] = useState('');
   const [sellerName, setSellerName] = useState('');
   const [eurRateInput, setEurRateInput] = useState('');
   const [usdRateInput, setUsdRateInput] = useState('');

   const [isPickerSearchFocused, setIsPickerSearchFocused] = useState(false);

   // Solo bloqueamos si la venta está anulada
   const isVoided = sale?.status === 'voided';

   // Advertencias informativas (no bloquean la edición)
   const hadCombos = !!(sale?.appliedCombos?.length || sale?.appliedCombo);
   const hadSplits = !!(sale?.paymentSplits && sale.paymentSplits.length > 1);

   useEffect(() => {
      if (!visible) return;
      const unsub = subscribeToProducts(setProducts);
      return unsub;
   }, [visible]);

   useEffect(() => {
      if (!visible) return;
      const unsub = subscribeToSellers(setSellers);
      return unsub;
   }, [visible]);

   useEffect(() => {
      if (visible && sale) {
         setItems(sale.items.map((i) => ({ ...i })));
         // A-04: conservar el descuento original en lugar de forzar 0.
         setDiscountInput(String(roundMoney(Number(sale.discount) || 0)));
         setReason('');
         setAdjustmentMethod(sale.paymentMethod === 'pago_movil' ? 'pago_movil' : 'efectivo');
         setShowPicker(false);
         setSearch('');
         setExpandedProductId(null);
         setSellerId(sale.sellerId || '');
         setSellerName(sale.sellerName || '');
         setEurRateInput(sale.eurToBsRate ? String(sale.eurToBsRate) : '');
         setUsdRateInput(sale.usdToBsRate ? String(sale.usdToBsRate) : '');

         // Ventas antiguas sin tasas: ofrecer las centrales de settings/rates.
         if (!sale.eurToBsRate || !sale.usdToBsRate) {
            let cancelled = false;
            void getRates().then((rates) => {
               if (cancelled || !rates) return;
               setEurRateInput((prev) => prev || String(rates.eurToBsRate));
               setUsdRateInput((prev) => prev || String(rates.usdToBsRate));
            });
            return () => { cancelled = true; };
         }
      }
   }, [visible, sale]);

   const newSubtotal = useMemo(
      () => roundMoney(items.reduce((s, i) => s + i.totalPrice, 0)),
      [items]
   );

   // A-04: el descuento original se conserva y solo cambia si el usuario
   // edita explícitamente el campo. Se limita al subtotal para no dejar
   // totales negativos si se eliminan prendas.
   const newDiscount = useMemo(() => {
      const parsed = parseFloat(discountInput);
      if (!Number.isFinite(parsed) || parsed <= 0) return 0;
      return roundMoney(Math.min(newSubtotal, parsed));
   }, [discountInput, newSubtotal]);
   const newTotal = roundMoney(Math.max(0, newSubtotal - newDiscount));

   // Tasas ingresadas: vacío = conservar la tasa original.
   const parsedEurRate = parseFloat(eurRateInput);
   const parsedUsdRate = parseFloat(usdRateInput);
   const effectiveEurRate = Number.isFinite(parsedEurRate) && parsedEurRate > 0 ? parsedEurRate : undefined;
   const effectiveUsdRate = Number.isFinite(parsedUsdRate) && parsedUsdRate > 0 ? parsedUsdRate : undefined;
   const previewTotalBS =
      effectiveUsdRate !== undefined ? roundMoney(newTotal * effectiveUsdRate) : undefined;
   const previewTotalBSRef =
      previewTotalBS !== undefined && effectiveEurRate !== undefined
         ? roundMoney(previewTotalBS / effectiveEurRate)
         : undefined;

   const sellerOptions = useMemo(() => {
      const options = sellers.map((seller) => ({ id: seller.id, name: seller.name }));
      if (sale?.sellerId && !options.some((option) => option.id === sale.sellerId)) {
         options.unshift({ id: sale.sellerId, name: sale.sellerName || 'Vendedor actual' });
      }
      return options;
   }, [sellers, sale]);

   const totalDiff = sale ? roundMoney(newTotal - sale.total) : 0;
   const isRefund = totalDiff < -0.005;
   const isCharge = totalDiff > 0.005;
   const diffAmount = roundMoney(Math.abs(totalDiff));

   const adjustQty = (idx: number, delta: number) => {
      const currentItem = items[idx];
      if (!currentItem) return;

      const newQty = currentItem.quantity + delta;

      if (newQty > 0 && delta > 0) {
         const key = `${currentItem.productId}_${currentItem.color}_${currentItem.size}`;
         const originalItem = sale?.items.find(
            (item) => `${item.productId}_${item.color}_${item.size}` === key
         );
         const originalQty = Number(originalItem?.quantity) || 0;

         const product = products.find(
            (candidate) => (candidate.id || candidate.code) === currentItem.productId
         );
         const variant = product?.variants?.find(
            (candidate) =>
               candidate.color.toLowerCase() === currentItem.color.toLowerCase()
         );
         const sizeObj = variant?.sizes?.find((size) => size.size === currentItem.size);
         const currentStock = Number(sizeObj?.stock) || 0;
         const maxQuantity = originalQty + currentStock;

         if (newQty > maxQuantity) {
            showAlert(
               'Stock insuficiente',
               `Solo puedes agregar ${currentStock} unidad(es) de esta talla ` +
               `(el stock actual es ${currentStock}).`
            );
            return;
         }
      }

      setItems((prev) => {
         const next = [...prev];
         const item = { ...next[idx] };
         if (!item) return prev;
         const quantity = item.quantity + delta;
         if (quantity <= 0) {
            next.splice(idx, 1);
         } else {
            item.quantity = quantity;
            item.totalPrice = roundMoney(item.unitPrice * quantity);
            next[idx] = item;
         }
         return next;
      });
   };

   const removeItem = (idx: number) => {
      setItems((prev) => prev.filter((_, i) => i !== idx));
   };

   const addItem = (product: Product, colorIdx: number, size: string) => {
      const variant = product.variants[colorIdx];
      if (!variant) return;
      const sizeObj = variant.sizes.find((s) => s.size === size);
      const availableStock = Number(sizeObj?.stock) || 0;

      const productId = product.id || product.code || 'unknown';
      const key = `${productId}_${variant.color}_${size}`;
      const existingIdx = items.findIndex((i) => `${i.productId}_${i.color}_${i.size}` === key);

      if (existingIdx > -1) {
         adjustQty(existingIdx, 1);
      } else {
         if (availableStock <= 0) {
            showAlert('Sin stock', 'Esta talla está agotada.');
            return;
         }
         const unitPrice = Number(product.price) || 0;
         const newItem: SaleItem = {
            productId,
            productCode: product.code || 'S/N',
            brand: product.brand || 'Genérico',
            name: product.name,
            color: variant.color,
            size,
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice,
            purchasePrice: Number((product as any).purchasePrice) || undefined,
         };
         setItems((prev) => [...prev, newItem]);
      }
      setShowPicker(false);
      setSearch('');
      setExpandedProductId(null);
   };

   const handleSave = async () => {
      if (!sale || saving) return;
      if (items.length === 0) {
         showAlert('Venta vacía', 'No puedes dejar la venta sin artículos. Usa "Anular" en su lugar.');
         return;
      }
      if (!reason.trim()) {
         showAlert('Motivo requerido', 'Indica el motivo del cambio.');
         return;
      }
      if (eurRateInput.trim() && effectiveEurRate === undefined) {
         showAlert('Tasa inválida', 'La tasa EUR → Bs debe ser un número mayor a 0.');
         return;
      }
      if (usdRateInput.trim() && effectiveUsdRate === undefined) {
         showAlert('Tasa inválida', 'La tasa USD → Bs debe ser un número mayor a 0.');
         return;
      }

      const summary = isRefund
         ? `Se devolverán $${diffAmount.toFixed(2)} al cliente vía ${paymentLabels[adjustmentMethod] || adjustmentMethod}.`
         : isCharge
            ? `Se cobrarán $${diffAmount.toFixed(2)} extra vía ${paymentLabels[adjustmentMethod] || adjustmentMethod}.`
            : 'No hay diferencia de pago.';

      const extraNote = hadCombos
         ? '\n\nNota: los combos aplicados a esta venta se eliminarán y los artículos quedarán a precio normal.'
         : hadSplits
            ? '\n\nNota: los pagos divididos originales quedarán como referencia histórica.'
            : '';

      showConfirm(
         'Confirmar Edición',
         `${summary}${extraNote}\n\n¿Guardar cambios en la venta #${sale.receiptNumber}?`,
         async () => {
            try {
               setSaving(true);
               await editSale({
                  sale,
                  newItems: items,
                  newSubtotal,
                  newDiscount,
                  newTotal,
                  reason: reason.trim(),
                  adjustmentMethod: Math.abs(totalDiff) >= 0.005 ? adjustmentMethod : undefined,
                  newSellerId: sellerId || undefined,
                  newSellerName: sellerName || undefined,
                  newEurToBsRate: effectiveEurRate,
                  newUsdToBsRate: effectiveUsdRate,
               });
               showAlert('Listo', 'La venta fue actualizada y el stock ajustado.');
               onSaved();
               onClose();
            } catch (err: any) {
               showAlert('Error', err?.message || 'No se pudo actualizar la venta.');
            } finally {
               setSaving(false);
            }
         }
      );
   };

   const filteredProducts = useMemo(() => {
      const q = search.toLowerCase().trim();
      if (!q) return products.slice(0, 30);
      return products
         .filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
         )
         .slice(0, 30);
   }, [products, search]);

   if (!sale) return null;

   return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                     <ArrowRightLeft size={20} color={T.onBar} />
                     <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.title}>Editar Venta</Text>
                        <Text style={styles.subtitle}>#{sale.receiptNumber}</Text>
                     </View>
                  </View>
                  <P onPress={onClose} disabled={saving}>
                     <X size={20} color={T.onBar} />
                  </P>
               </View>

               {/* Bloqueo: solo si está anulada */}
               {isVoided && (
                  <View style={styles.blockedBanner}>
                     <AlertTriangle size={16} color="#B45309" />
                     <Text style={styles.blockedText}>
                        Esta venta está anulada y no se puede editar.
                     </Text>
                  </View>
               )}

               {/* Advertencia: si tenía combos o splits (no bloquea) */}
               {!isVoided && (hadCombos || hadSplits) && (
                  <View style={styles.warnBanner}>
                     <AlertTriangle size={16} color="#B45309" />
                     <Text style={styles.warnText}>
                        Esta venta tenía {hadCombos && 'combos aplicados'}{hadCombos && hadSplits && ' y '}{hadSplits && 'pagos divididos'}.
                        Al guardar se recalcularán los totales y los combos se consolidarán en el descuento conservado. Los pagos divididos quedarán como referencia histórica.
                     </Text>
                  </View>
               )}

               {!isVoided && (
                  <>
                     <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                        {/* ITEMS ACTUALES */}
                        <View style={styles.sectionHeaderRow}>
                           <Text style={styles.sectionLabel}>Artículos actuales</Text>
                           <P style={styles.addItemBtn} onPress={() => setShowPicker(!showPicker)}>
                              <Plus size={12} color={T.onSolid} />
                              <Text style={styles.addItemBtnText}>
                                 {showPicker ? 'Cerrar' : 'Agregar prenda'}
                              </Text>
                           </P>
                        </View>

                        {items.map((item, idx) => (
                           <View key={`${item.productId}_${item.color}_${item.size}`} style={styles.itemRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <Text style={styles.itemName} numberOfLines={1}>
                                    {item.brand} - {item.name}
                                 </Text>
                                 <Text style={styles.itemMeta}>
                                    {item.color} · Talla {item.size} · ${item.unitPrice.toFixed(2)}
                                 </Text>
                              </View>
                              <View style={styles.qtyControls}>
                                 <P style={styles.qtyBtn} onPress={() => adjustQty(idx, -1)}>
                                    <Minus size={12} color={T.ink} />
                                 </P>
                                 <Text style={styles.qtyValue}>{item.quantity}</Text>
                                 <P style={styles.qtyBtn} onPress={() => adjustQty(idx, 1)}>
                                    <Plus size={12} color={T.ink} />
                                 </P>
                              </View>
                              <Text style={styles.itemTotal}>${item.totalPrice.toFixed(2)}</Text>
                              <P style={styles.deleteBtn} onPress={() => removeItem(idx)}>
                                 <Trash2 size={12} color="#DC2626" />
                              </P>
                           </View>
                        ))}

                        {/* PICKER DE PRODUCTOS */}
                        {showPicker && (
                           <View style={styles.pickerBox}>
                              <View style={[styles.pickerSearch, isPickerSearchFocused && styles.pickerSearchFocused]}>
                                 <Search size={16} color={isPickerSearchFocused ? T.ink : T.inkMute} />
                                 <TextInput
                                    style={styles.pickerSearchInput}
                                    placeholder="Buscar prenda..."
                                    placeholderTextColor={T.inkMute}
                                    value={search}
                                    onChangeText={setSearch}
                                    onFocus={() => setIsPickerSearchFocused(true)}
                                    onBlur={() => setIsPickerSearchFocused(false)}
                                    autoFocus
                                 />
                                 {search.length > 0 && (
                                    <P onPress={() => setSearch('')}>
                                       <X size={14} color={T.inkMute} />
                                    </P>
                                 )}
                              </View>

                              <ScrollView style={{ maxHeight: 260 }}>
                                 {filteredProducts.length === 0 ? (
                                    <Text style={styles.pickerEmpty}>No hay resultados.</Text>
                                 ) : (
                                    filteredProducts.map((p) => {
                                       const expanded = expandedProductId === (p.id || p.code);
                                       return (
                                          <View key={p.id || p.code} style={styles.pickerItem}>
                                             <P
                                                style={styles.pickerItemRow}
                                                onPress={() => setExpandedProductId(expanded ? null : (p.id || p.code || null))}
                                             >
                                                <Cover
                                                   uri={p.images?.[0]}
                                                   name={p.name}
                                                   bg={T.imgBg}
                                                   fg={T.line}
                                                   style={styles.pickerItemImg}
                                                />
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                   <Text style={styles.pickerItemName} numberOfLines={1}>
                                                      {p.brand} - {p.name}
                                                   </Text>
                                                   <Text style={styles.pickerItemMeta}>
                                                      SKU: {p.code} · ${Number(p.price).toFixed(2)}
                                                   </Text>
                                                </View>
                                                {expanded ? (
                                                   <ChevronUp size={16} color={T.inkMute} />
                                                ) : (
                                                   <ChevronDown size={16} color={T.inkMute} />
                                                )}
                                             </P>
                                             {expanded && (
                                                <View style={styles.pickerVariants}>
                                                   {(p.variants || []).map((v, vIdx) => (
                                                      <View key={vIdx} style={{ marginBottom: 8 }}>
                                                         <Text style={styles.variantColor}>{v.color}</Text>
                                                         <View style={styles.variantSizesRow}>
                                                            {(v.sizes || []).map((sObj) => {
                                                               const stock = Number(sObj.stock) || 0;
                                                               return (
                                                                  <P
                                                                     key={sObj.size}
                                                                     style={[styles.variantSizeChip, stock <= 0 && { opacity: 0.35 }]}
                                                                     onPress={() => stock > 0 && addItem(p, vIdx, sObj.size)}
                                                                     disabled={stock <= 0}
                                                                  >
                                                                     <Text style={styles.variantSizeText}>
                                                                        {sObj.size} ({stock})
                                                                     </Text>
                                                                  </P>
                                                               );
                                                            })}
                                                         </View>
                                                      </View>
                                                   ))}
                                                </View>
                                             )}
                                          </View>
                                       );
                                    })
                                 )}
                              </ScrollView>
                           </View>
                        )}

                        <View style={styles.divider} />

                        {/* VENDEDOR */}
                        <Text style={styles.label}>Vendedor</Text>
                        {sellerOptions.length === 0 ? (
                           <Text style={styles.discountHint}>No hay vendedores configurados.</Text>
                        ) : (
                           <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
                              style={{ marginBottom: 12 }}
                           >
                              {sellerOptions.map((option) => {
                                 const active = sellerId === option.id;
                                 return (
                                    <P
                                       key={option.id}
                                       style={[styles.methodChip, active && styles.methodChipActive, styles.sellerChip]}
                                       onPress={() => {
                                          setSellerId(option.id);
                                          setSellerName(option.name);
                                       }}
                                       disabled={saving}
                                    >
                                       <User size={11} color={active ? T.onSolid : T.inkSoft} />
                                       <Text style={[styles.methodChipText, active && styles.methodChipTextActive]} numberOfLines={1}>
                                          {option.name}
                                       </Text>
                                    </P>
                                 );
                              })}
                           </ScrollView>
                        )}

                        {/* TOTALES COMPARATIVOS */}
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Subtotal artículos:</Text>
                           <Text style={styles.compareValueMuted}>${newSubtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Descuento:</Text>
                           <Text style={[styles.compareValueMuted, { color: '#DC2626' }]}>
                              -${newDiscount.toFixed(2)}
                           </Text>
                        </View>
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Total anterior:</Text>
                           <Text style={styles.compareValueMuted}>${sale.total.toFixed(2)}</Text>
                        </View>
                        <View style={styles.compareRow}>
                           <Text style={styles.compareLabel}>Nuevo total:</Text>
                           <Text style={styles.compareValue}>${newTotal.toFixed(2)}</Text>
                        </View>

                        <Text style={[styles.label, { marginTop: 12 }]}>Descuento aplicado (USD)</Text>
                        <View style={styles.discountEditRow}>
                           <TextInput
                              style={styles.discountInput}
                              value={discountInput}
                              onChangeText={(value) =>
                                 setDiscountInput(value.replace(/[^0-9.]/g, ''))
                              }
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={T.inkMute}
                              editable={!saving}
                           />
                           <P
                              style={styles.restoreDiscountBtn}
                              onPress={() =>
                                 setDiscountInput(String(roundMoney(Math.max(0, Number(sale.discount) || 0))))
                              }
                              disabled={saving}
                           >
                              <Text style={styles.restoreDiscountText}>Restaurar</Text>
                           </P>
                        </View>
                        <Text style={styles.discountHint}>
                           {newDiscount > 0
                              ? `Descuento conservado: $${newDiscount.toFixed(2)}. Edítalo solo si deseas cambiarlo.`
                              : 'Esta venta no tiene descuento aplicado.'}
                        </Text>

                        {/* TASAS APLICADAS */}
                        <View style={styles.rateHeader}>
                           <Percent size={11} color={T.inkMute} />
                           <Text style={styles.label}>Tasas aplicadas (Bs)</Text>
                        </View>
                        <View style={styles.rateRow}>
                           <View style={styles.rateField}>
                              <Text style={styles.rateLabel}>EUR → Bs</Text>
                              <TextInput
                                 style={styles.rateInput}
                                 value={eurRateInput}
                                 onChangeText={(value) => setEurRateInput(value.replace(/[^0-9.]/g, ''))}
                                 keyboardType="decimal-pad"
                                 placeholder="Tasa EUR"
                                 placeholderTextColor={T.inkMute}
                                 editable={!saving}
                              />
                           </View>
                           <View style={styles.rateField}>
                              <Text style={styles.rateLabel}>USD → Bs</Text>
                              <TextInput
                                 style={styles.rateInput}
                                 value={usdRateInput}
                                 onChangeText={(value) => setUsdRateInput(value.replace(/[^0-9.]/g, ''))}
                                 keyboardType="decimal-pad"
                                 placeholder="Tasa USD"
                                 placeholderTextColor={T.inkMute}
                                 editable={!saving}
                              />
                           </View>
                        </View>
                        <Text style={styles.discountHint}>
                           Déjalas vacías para conservar las tasas originales de la venta.
                        </Text>

                        {previewTotalBS !== undefined && (
                           <View style={styles.ratesPreview}>
                              <Text style={styles.ratesPreviewLabel}>Total con nuevas tasas:</Text>
                              <Text style={styles.ratesPreviewValue}>
                                 {previewTotalBS.toFixed(2)} Bs
                              </Text>
                              {previewTotalBSRef !== undefined && (
                                 <Text style={styles.ratesPreviewRef}>
                                    €{previewTotalBSRef.toFixed(2)} ref.
                                 </Text>
                              )}
                           </View>
                        )}

                        {Math.abs(totalDiff) >= 0.005 && (
                           <View style={[
                              styles.diffBox,
                              isRefund ? styles.diffBoxRefund : styles.diffBoxCharge,
                           ]}>
                              <Coins size={16} color={isRefund ? '#DC2626' : '#047857'} />
                              <View style={{ flex: 1 }}>
                                 <Text style={[styles.diffTitle, { color: isRefund ? '#DC2626' : '#047857' }]}>
                                    {isRefund ? 'Reembolso al cliente' : 'Cobro adicional'}
                                 </Text>
                                 <Text style={styles.diffSub}>
                                    ${diffAmount.toFixed(2)} vía {paymentLabels[adjustmentMethod] || adjustmentMethod}
                                 </Text>
                              </View>
                              <Text style={[styles.diffAmount, { color: isRefund ? '#DC2626' : '#047857' }]}>
                                 {isRefund ? '-' : '+'}${diffAmount.toFixed(2)}
                              </Text>
                           </View>
                        )}

                        {Math.abs(totalDiff) >= 0.005 && (
                           <>
                              <Text style={[styles.label, { marginTop: 12 }]}>
                                 Método de {isRefund ? 'reembolso' : 'cobro'}:
                              </Text>
                              <View style={styles.methodsRow}>
                                 {['efectivo', 'pago_movil', 'zelle', 'binance', 'transferencia'].map((m) => (
                                    <P
                                       key={m}
                                       style={[styles.methodChip, adjustmentMethod === m && styles.methodChipActive]}
                                       onPress={() => setAdjustmentMethod(m)}
                                    >
                                       <Text style={[styles.methodChipText, adjustmentMethod === m && styles.methodChipTextActive]}>
                                          {paymentLabels[m]}
                                       </Text>
                                    </P>
                                 ))}
                              </View>
                           </>
                        )}

                        <Text style={[styles.label, { marginTop: 12 }]}>Motivo del cambio *</Text>
                        <TextInput
                           style={styles.reasonInput}
                           value={reason}
                           onChangeText={setReason}
                           placeholder="Ej. Prenda defectuosa, cambio de talla..."
                           placeholderTextColor={T.inkMute}
                           multiline
                           editable={!saving}
                        />
                     </ScrollView>

                     <View style={styles.footer}>
                        <P style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                           <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </P>
                        <P
                           style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                           onPress={handleSave}
                           disabled={saving}
                        >
                           {saving ? (
                              <ActivityIndicator size="small" color={T.onSolid} />
                           ) : (
                              <>
                                 <Save size={14} color={T.onSolid} />
                                 <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                              </>
                           )}
                        </P>
                     </View>
                  </>
               )}

               {isVoided && (
                  <View style={styles.footer}>
                     <P style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cerrar</Text>
                     </P>
                  </View>
               )}
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 500, maxHeight: '92%', backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: T.bar },
   title: { ...display, fontSize: 20, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
   pressed: { opacity: 0.85 },

   blockedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      backgroundColor: '#FFFBEB',
      borderBottomWidth: 1,
      borderBottomColor: '#FDE68A',
   },
   blockedText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '700' },

   warnBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      backgroundColor: '#FFFBEB',
      borderBottomWidth: 1,
      borderBottomColor: '#FDE68A',
   },
   warnText: {
      flex: 1,
      fontSize: 12,
      color: '#B45309',
      fontWeight: '600',
      lineHeight: 16,
   },

   sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
   sectionLabel: { fontSize: 12, fontWeight: '800', color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
   addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.solid, borderRadius: 8 },
   addItemBtnText: { fontSize: 11, fontWeight: '800', color: T.onSolid },

   itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.line },
   itemName: { fontSize: 13, fontWeight: '700', color: T.ink },
   itemMeta: { fontSize: 11, color: T.inkMute, marginTop: 1 },
   qtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.surface },
   qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
   qtyValue: { ...display, fontSize: 14, fontWeight: '800', color: T.ink, minWidth: 22, textAlign: 'center' },
   itemTotal: { fontSize: 13, fontWeight: '800', color: T.ink, minWidth: 62, textAlign: 'right' },
   deleteBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },

   pickerBox: { marginTop: 10, backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.line, padding: 10 },
   pickerEmpty: { fontSize: 12, color: T.inkMute, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
   pickerItem: { borderBottomWidth: 1, borderBottomColor: T.line },
   pickerVariants: { paddingLeft: 22, paddingBottom: 10 },
   pickerSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 10,
      marginBottom: 8,
   },
   pickerSearchFocused: {
      borderColor: T.ink,
      borderWidth: 1.5,
   },
   pickerSearchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      color: T.ink,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      textAlignVertical: 'center',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   pickerItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 4,
   },
   pickerItemImg: {
      width: 40,
      height: 50,
      borderRadius: 6,
   },
   pickerItemName: {
      fontSize: 13,
      fontWeight: '700',
      color: T.ink,
   },
   pickerItemMeta: {
      fontSize: 11,
      color: T.inkMute,
      marginTop: 1,
   },
   variantColor: { fontSize: 11, fontWeight: '700', color: T.inkSoft, marginBottom: 4 },
   variantSizesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
   variantSizeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   variantSizeText: { fontSize: 11, fontWeight: '700', color: T.ink },

   divider: { height: 1, backgroundColor: T.line, marginVertical: 14 },

   compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
   compareLabel: { fontSize: 13, color: T.inkSoft, fontWeight: '600' },
   compareValueMuted: { ...display, fontSize: 20, fontWeight: '800', color: T.inkMute },
   compareValue: { ...display, fontSize: 26, fontWeight: '800', color: T.ink },

   diffBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
   diffBoxRefund: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
   diffBoxCharge: { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' },
   diffTitle: { fontSize: 12, fontWeight: '800' },
   diffSub: { fontSize: 11, color: T.inkMute, marginTop: 1 },
   diffAmount: { ...display, fontSize: 20, fontWeight: '800' },

   label: { fontSize: 11, fontWeight: '800', color: T.inkMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
   methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   methodChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   methodChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   methodChipText: { fontSize: 11, fontWeight: '700', color: T.inkSoft },
   methodChipTextActive: { color: T.onSolid },

   reasonInput: { borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: T.ink, minHeight: 70, textAlignVertical: 'top' },

   discountEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   discountInput: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.bg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '700', color: T.ink },
   restoreDiscountBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface },
   restoreDiscountText: { fontSize: 11, fontWeight: '800', color: T.inkSoft },
   discountHint: { fontSize: 10, color: T.inkMute, marginTop: 5, fontStyle: 'italic' },

   sellerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 180 },
   rateHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, marginBottom: 6 },
   rateRow: { flexDirection: 'row', gap: 8 },
   rateField: { flex: 1 },
   rateLabel: { fontSize: 10, fontWeight: '800', color: T.inkMute, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
   rateInput: { borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.bg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '700', color: T.ink },
   ratesPreview: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
   ratesPreviewLabel: { fontSize: 11, fontWeight: '700', color: T.inkSoft },
   ratesPreviewValue: { ...display, fontSize: 16, fontWeight: '800', color: T.ink },
   ratesPreviewRef: { fontSize: 11, color: T.inkMute },

   footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line },
   cancelBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
   cancelBtnText: { fontSize: 13, fontWeight: '700', color: T.ink },
   saveBtn: { flex: 1, height: 46, borderRadius: 10, backgroundColor: T.solid, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
   saveBtnText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
});

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
   View, Text, ScrollView, Pressable, StyleSheet, TextInput,
   ActivityIndicator, Modal, useWindowDimensions, FlatList, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
   ShoppingBag, Plus, Minus, CheckCircle2, CreditCard, Banknote, Smartphone,
   User, Phone, ChevronLeft, ChevronRight, X, QrCode, Pencil, Trash2, Crown,
   Coins, AlertCircle, Check, ChevronDown, ChevronUp, Settings, Sparkles,
} from 'lucide-react-native';
import { Product } from '../types/inventory';
import { Sale, SaleItem, PaymentMethod, Seller, PaymentSplit, SaleCombo } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { subscribeToSellers, createSeller, updateSeller, deleteSeller } from '../services/sellerService';
import { enqueuePendingSale } from '../services/offlineSyncService';
import { createSale } from '../services/saleService';
import { showAlert, showConfirm } from '../utils/alert';
import { SaleReceiptModal } from '../components/SaleReceiptModal';
import { ProductSearchFilter } from '../components/ProductSearchFilter';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { Cover } from '../components/Cover';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToCombos, checkMultiComboEligibility } from '../services/comboService';
import { Combo, AppliedCombo } from '../types/combo';
import { ComboManagerModal } from '../components/ComboManagerModal';
import { ComboApplyModal } from '../components/ComboApplyModal';
import { MONO as T, display } from '../design';

const ITEMS_PER_PAGE = 10;
const WHOLESALE_THRESHOLD = 6;
const RATE_STORAGE_KEYS = {
   eur: 'jdstore.eur_to_bs_rate',
   usd: 'jdstore.usd_to_bs_rate',
};
const DEFAULT_RATE = 50;

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

const PAYMENT_OPTIONS = [
   { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
   { id: 'efectivo', label: 'Efectivo', icon: Banknote },
   { id: 'zelle', label: 'Zelle', icon: CreditCard },
   { id: 'binance', label: 'Binance', icon: QrCode },
] as const;

const getInitialRate = (which: 'eur' | 'usd'): number => {
   if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(RATE_STORAGE_KEYS[which]);
      const parsed = saved ? Number(saved) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE;
   }
   return DEFAULT_RATE;
};

interface Props {
   isOnline?: boolean;
}

interface PricedItem extends SaleItem {
   bsRefUnit: number;
   bsRefTotal: number;
   bsActualTotal: number;
   isWholesalePrice: boolean;
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
   const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

   const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
   const [eurToBsRate, setEurToBsRate] = useState<number>(() => getInitialRate('eur'));
   const [usdToBsRate, setUsdToBsRate] = useState<number>(() => getInitialRate('usd'));
   const [eurRateInput, setEurRateInput] = useState<string>(() => String(getInitialRate('eur')));
   const [usdRateInput, setUsdRateInput] = useState<string>(() => String(getInitialRate('usd')));

   const [showSplitModal, setShowSplitModal] = useState(false);
   const [newSplitMethod, setNewSplitMethod] = useState<PaymentMethod>('pago_movil');
   const [newSplitAmount, setNewSplitAmount] = useState('');
   const [newSplitRef, setNewSplitRef] = useState('');

   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [notes, setNotes] = useState('');

   const [processing, setProcessing] = useState(false);
   const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

   const [showRatesModal, setShowRatesModal] = useState(false);
   const [showClientSection, setShowClientSection] = useState(false);

   const [viewerImage, setViewerImage] = useState<string | null>(null);
   const [sellerModalOpen, setSellerModalOpen] = useState(false);
   const [sellerModalMode, setSellerModalMode] = useState<'create' | 'edit'>('create');
   const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
   const [sellerNameInput, setSellerNameInput] = useState('');
   const [savingSeller, setSavingSeller] = useState(false);

   const [combos, setCombos] = useState<Combo[]>([]);
   const [appliedCombos, setAppliedCombos] = useState<AppliedCombo[]>([]);
   const [showComboManager, setShowComboManager] = useState(false);
   const [showComboApply, setShowComboApply] = useState(false);

   const insets = useSafeAreaInsets();

   useEffect(() => {
      const unsubProducts = subscribeToProducts(setProducts);
      const unsubSellers = subscribeToSellers((data) => {
         setSellers(data);
         if (data.length > 0 && !selectedSeller) setSelectedSeller(data[0]);
      });
      const unsubCombos = subscribeToCombos(setCombos);
      return () => { unsubProducts(); unsubSellers(); unsubCombos(); };
   }, []);

   // Persistir tasa
   useEffect(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
         window.localStorage.setItem(RATE_STORAGE_KEYS.eur, String(eurToBsRate));
         window.localStorage.setItem(RATE_STORAGE_KEYS.usd, String(usdToBsRate));
      }
   }, [eurToBsRate, usdToBsRate]);

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

   const cartCount = cart.reduce((n, i) => n + i.quantity, 0);
   const isWholesale = cartCount >= WHOLESALE_THRESHOLD;

   // ==========================================
   // PRECIOS CALCULADOS (USD + BS REF + BS ACTUAL)
   // ==========================================
   const pricedCart: PricedItem[] = useMemo(() => {
      return cart.map((item) => {
         const product = products.find((p) => (p.id || p.code) === item.productId);
         const wholesaleUSD = Number((product as any)?.wholesalePrice) || 0;
         const retailUSD = Number(product?.price) || item.unitPrice;
         const wholesaleBS = Number((product as any)?.bolivarWholesalePrice) || 0;
         const retailBS = Number((product as any)?.bolivarPrice) || 0;

         const unitPriceUSD = isWholesale && wholesaleUSD > 0 ? wholesaleUSD : retailUSD;
         const bsRefUnit = isWholesale && wholesaleBS > 0 ? wholesaleBS : retailBS;
         const bsRefTotal = bsRefUnit * item.quantity;
         const bsActualTotal = bsRefTotal * eurToBsRate;   // Bs a cobrar si paga 100% en Bs

         return {
            ...item,
            unitPrice: unitPriceUSD,
            totalPrice: unitPriceUSD * item.quantity,
            bsRefUnit,
            bsRefTotal,
            bsActualTotal,
            isWholesalePrice: isWholesale && wholesaleUSD > 0,
         };
      });
   }, [cart, products, isWholesale, eurToBsRate]);

   const comboInfo = useMemo(() => {
      if (appliedCombos.length === 0) {
         return {
            allEligible: true,
            eligibleCount: 0,
            totalCount: 0,
            totalDiscount: 0,
            appliedResults: [],
            itemComboMap: {},
         };
      }
      return checkMultiComboEligibility(cart, products, combos, appliedCombos);
   }, [appliedCombos, cart, products, combos]);

   const comboDiscount = comboInfo.totalDiscount;

   const rawTotalUSD = pricedCart.reduce((s, i) => s + i.totalPrice, 0);
   const totalUSD = Math.max(0, rawTotalUSD - comboDiscount);

   const rawTotalBSRef = pricedCart.reduce((s, i) => s + i.bsRefTotal, 0);
   const totalBSExpected = rawTotalUSD > 0
      ? rawTotalBSRef * eurToBsRate * (totalUSD / rawTotalUSD)
      : 0;
   const totalBSRef = totalBSExpected / (eurToBsRate || 1);

   useEffect(() => {
      if (appliedCombos.length === 0) return;
      const valid = appliedCombos.filter((a) => combos.some((c) => c.id === a.comboId && c.isActive));
      if (valid.length !== appliedCombos.length) setAppliedCombos(valid);
   }, [combos, appliedCombos]);

   // ==========================================
   // PAGOS
   // ==========================================
   const paidUSD = paymentSplits.filter((s) => s.currency === 'USD').reduce((s, p) => s + p.amount, 0);
   const paidBS = paymentSplits.filter((s) => s.currency === 'BS').reduce((s, p) => s + p.amount, 0);
   const paidInUSDEquiv = paidUSD + (usdToBsRate > 0 ? paidBS / usdToBsRate : 0);
   const remainingInUSDEquiv = Math.max(0, totalUSD - paidInUSDEquiv);
   const isFullyCovered = remainingInUSDEquiv <= 0.01;

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
         const updated = [...cart];
         updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + 1 };
         setCart(updated);
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
   };

   const updateCartQuantity = (index: number, delta: number) => {
      const updated = [...cart];
      const item = updated[index];
      const origProduct = products.find((p) => (p.id || p.code) === item.productId);
      const variant = origProduct?.variants?.find((v) => v.color?.toLowerCase() === item.color?.toLowerCase());
      const sizeObj = variant?.sizes?.find((s) => s.size === item.size);
      const maxStock = Number(sizeObj?.stock) || 0;

      const newQty = item.quantity + delta;
      if (newQty <= 0) updated.splice(index, 1);
      else if (newQty > maxStock) {
         showAlert('Stock insuficiente', `Solo hay ${maxStock} unidades disponibles.`);
         return;
      } else updated[index] = { ...item, quantity: newQty };

      setCart(updated);
   };

   const removeFromCart = (index: number) => {
      const updated = [...cart];
      updated.splice(index, 1);
      setCart(updated);
   };

   const resetCart = () => {
      setCart([]);
      setPaymentSplits([]);
      setAppliedCombos([]);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
   };

   // ==========================================
   // TASA EUR y USD
   // ==========================================
   const makeRateHandler = (
      setter: (n: number) => void,
      inputSetter: (s: string) => void,
   ) => (val: string) => {
      const clean = val.replace(/[^0-9.]/g, '');
      inputSetter(clean);
      const parsed = parseFloat(clean);
      if (Number.isFinite(parsed) && parsed > 0) setter(parsed);
   };

   const handleEurRateChange = makeRateHandler(setEurToBsRate, setEurRateInput);
   const handleUsdRateChange = makeRateHandler(setUsdToBsRate, setUsdRateInput);

   // ==========================================
   // SPLITS DE PAGO
   // ==========================================
   const openSplitModal = () => {
      setNewSplitMethod('pago_movil');
      setNewSplitAmount('');
      setNewSplitRef('');
      setShowSplitModal(true);
   };

   const closeSplitModal = () => {
      setShowSplitModal(false);
      setNewSplitAmount('');
      setNewSplitRef('');
   };

   const handleAddSplit = () => {
      const amount = parseFloat(newSplitAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
         showAlert('Atención', 'Ingresa un monto válido mayor a 0.');
         return;
      }

      // Pago móvil = Bs. Todos los demás métodos = USD.
      const currency: 'USD' | 'BS' = newSplitMethod === 'pago_movil' ? 'BS' : 'USD';

      const newSplit: PaymentSplit = {
         id: `split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
         method: newSplitMethod,
         currency,
         amount,
         ...(newSplitRef.trim() && { reference: newSplitRef.trim() }),
      };

      setPaymentSplits((prev) => [...prev, newSplit]);
      closeSplitModal();
   };

   const removeSplit = (id: string) => {
      setPaymentSplits((prev) => prev.filter((s) => s.id !== id));
   };

   // ==========================================
   // Rendimiento
   // ==========================================
   const openCreateSellerModal = () => {
      setSellerModalMode('create');
      setEditingSeller(null);
      setSellerNameInput('');
      setSavingSeller(false);
      setSellerModalOpen(true);
   };

   const openEditSellerModal = (seller: Seller) => {
      setSellerModalMode('edit');
      setEditingSeller(seller);
      setSellerNameInput(seller.name);
      setSavingSeller(false);
      setSellerModalOpen(true);
   };

   const closeSellerModal = () => {
      setSellerModalOpen(false);
      setEditingSeller(null);
      setSellerModalMode('create');
      setSellerNameInput('');
      setSavingSeller(false);
   };

   const handleSaveSeller = async () => {
      if (savingSeller) return;
      const trimmed = sellerNameInput.trim();
      if (!trimmed) {
         showAlert('Atención', 'El nombre del vendedor no puede estar vacío.');
         return;
      }

      try {
         setSavingSeller(true);
         if (sellerModalMode === 'edit' && editingSeller) {
            await updateSeller(editingSeller.id, trimmed);
            setSelectedSeller({ ...editingSeller, name: trimmed });
         } else {
            const newId = await createSeller(trimmed);
            setSelectedSeller({ id: newId, name: trimmed });
         }
         closeSellerModal();
      } catch {
         showAlert('Error', 'No se pudo guardar el vendedor.');
      } finally {
         setSavingSeller(false);
      }
   };

   const handleDeleteSeller = (seller: Seller) => {
      showConfirm(
         'Eliminar Vendedor',
         `¿Eliminar a "${seller.name}"? Las ventas ya registradas no se verán afectadas.`,
         async () => {
            try {
               await deleteSeller(seller.id);
               if (selectedSeller?.id === seller.id) setSelectedSeller(null);
            } catch {
               showAlert('Error', 'No se pudo eliminar el vendedor.');
            }
         }
      );
   };

   // ==========================================
   // COMPLETAR VENTA
   // ==========================================
   const handleCompleteSale = async () => {
      if (cart.length === 0) {
         showAlert('Carrito vacío', 'Agrega al menos una prenda antes de registrar la venta.');
         return;
      }
      if (!selectedSeller) {
         showAlert('Vendedor requerido', 'Selecciona el vendedor que realizó la venta.');
         return;
      }
      if (paymentSplits.length === 0) {
         showAlert('Sin pagos', 'Agrega al menos un método de pago antes de completar la venta.');
         return;
      }
      if (!isFullyCovered) {
         const confirmPartial = () => {
            showConfirm(
               'Venta parcial',
               `Aún faltan $${remainingInUSDEquiv.toFixed(2)} equivalente en USD. ¿Registrar la venta de todas formas?`,
               () => executeCompleteSale()
            );
         };
         confirmPartial();
         return;
      }
      executeCompleteSale();
   };

   const executeCompleteSale = async () => {
      if (!selectedSeller) return;

      const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const isOffline = !isOnline;

      const primaryMethod: PaymentMethod =
         paymentSplits.length === 1 ? paymentSplits[0].method :
            paymentSplits.length > 1 ? 'mixto' :
               'efectivo';

      const itemsPayload = pricedCart.map((item) => {
         const product = products.find((p) => (p.id || p.code) === item.productId);
         return {
            productId: item.productId,
            brand: item.brand,
            name: item.name,
            productCode: item.productCode,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productImage: item.productImage,
            unitPriceBSRef: item.bsRefUnit,
            totalBSRef: item.bsRefTotal,
            purchasePrice: (product as any)?.purchasePrice,
         };
      });

      const saleDataToSave: any = {
         receiptNumber,
         sellerId: selectedSeller.id,
         sellerName: selectedSeller.name,
         items: itemsPayload,
         subtotal: rawTotalUSD,
         discount: comboDiscount,
         total: totalUSD,
         paymentMethod: primaryMethod,
         paymentSplits,
         totalBS: totalBSExpected,
         totalBSRef,
         eurToBsRate,
         usdToBsRate,
         isWholesale,
      };
      if (customerName.trim()) saleDataToSave.customerName = customerName.trim();
      if (customerPhone.trim()) saleDataToSave.customerPhone = customerPhone.trim();
      if (notes.trim()) saleDataToSave.notes = notes.trim();

      if (comboInfo.eligibleCount > 0) {
         const appliedList: SaleCombo[] = comboInfo.appliedResults
            .filter((r) => r.eligible)
            .map((r) => ({
               comboId: r.comboId,
               comboName: r.comboName,
               comboPrice: r.comboPrice,
               savedAmount: r.discount,
               itemKeys: Array.from(r.itemKeys),
            }));

         if (appliedList.length > 0) {
            saleDataToSave.appliedCombos = appliedList;
         }
      }

      setProcessing(true);

      const buildOfflineSale = () => ({
         id: `OFFLINE-${Date.now()}`,
         ...saleDataToSave,
         createdAt: new Date().toISOString(),
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

   // ==========================================
   // RENDER
   // ==========================================
   const renderProductItem = ({ item }: { item: Product }) => {
      const retail = Number(item.price || 0);
      const wholesale = Number((item as any).wholesalePrice || 0);
      const bsRetail = Number((item as any).bolivarPrice || 0);

      return (
         <P
            style={[styles.productCard, selectedProduct?.id === item.id && styles.productCardSelected]}
            onPress={() => handleSelectProduct(item)}
         >
            <Pressable onPress={() => item.images?.[0] && setViewerImage(item.images[0])}>
               <Cover uri={item.images?.[0]} name={item.name} bg={T.imgBg} fg={T.line} style={styles.productImg} />
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
                     <Text style={styles.wholesalePriceText}>${wholesale.toFixed(2)}</Text>
                     <Text style={styles.wholesaleTag}>6+</Text>
                  </View>
               )}
               {bsRetail > 0 && (
                  <Text style={styles.bsRefSmall}>€{bsRetail.toFixed(2)}</Text>
               )}
            </View>
         </P>
      );
   };

   const checkout = (
      <View style={styles.checkoutSection}>
         {/* VENDEDOR — siempre visible, compacto */}
         <View style={styles.sectionRow}>
            <Text style={styles.sectionMiniLabel}>Vendedor</Text>
            {selectedSeller && (
               <View style={{ flexDirection: 'row', gap: 4 }}>
                  <P style={styles.sellerMiniBtn} onPress={() => openEditSellerModal(selectedSeller)}>
                     <Pencil size={11} color={T.inkSoft} />
                  </P>
                  <P style={styles.sellerMiniBtnDanger} onPress={() => handleDeleteSeller(selectedSeller)}>
                     <Trash2 size={11} color="#DC2626" />
                  </P>
               </View>
            )}
         </View>
         <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12, flexGrow: 0 }}
            contentContainerStyle={{ gap: 6 }}
         >
            {sellers.map((s) => (
               <P
                  key={s.id}
                  style={[styles.chipSmall, selectedSeller?.id === s.id && styles.chipOn]}
                  onPress={() => setSelectedSeller(s)}
               >
                  <Text style={[styles.chipSmallText, selectedSeller?.id === s.id && styles.chipOnText]}>
                     {s.name}
                  </Text>
               </P>
            ))}
            <P style={[styles.chipSmall, styles.chipAdd]} onPress={openCreateSellerModal}>
               <Plus size={10} color={T.ink} />
               <Text style={[styles.chipSmallText, { color: T.ink }]}>Nuevo</Text>
            </P>
         </ScrollView>

         {/* TASA — chip compacto + modal */}
         <P style={styles.ratesChip} onPress={() => setShowRatesModal(true)}>
            <Coins size={13} color="#4338CA" />
            <Text style={styles.ratesChipText}>
               1 USD = {usdToBsRate} Bs · 1 EUR = {eurToBsRate} Bs
            </Text>
            <Settings size={12} color="#4338CA" />
         </P>

         {/* PAGOS — siempre visible */}
         <View style={[styles.sectionRow, { marginTop: 8 }]}>
            <Text style={styles.sectionMiniLabel}>Pagos ({paymentSplits.length})</Text>
            <P style={styles.addSplitBtn} onPress={openSplitModal}>
               <Plus size={11} color={T.ink} />
               <Text style={styles.addSplitText}>Agregar</Text>
            </P>
         </View>

         {paymentSplits.length === 0 ? (
            <Text style={styles.emptySplitsText}>Sin pagos registrados aún.</Text>
         ) : (
            <View style={styles.splitsList}>
               {paymentSplits.map((s) => {
                  const opt = PAYMENT_OPTIONS.find((o) => o.id === s.method);
                  const IconComp = opt?.icon || Banknote;
                  return (
                     <View key={s.id} style={styles.splitRow}>
                        <View style={styles.splitIconBox}>
                           <IconComp size={12} color={T.ink} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                           <Text style={styles.splitMethod} numberOfLines={1}>
                              {opt?.label || s.method} · {s.currency === 'USD' ? 'USD' : 'Bs'}
                           </Text>
                           {s.reference && (
                              <Text style={styles.splitRef} numberOfLines={1}>Ref: {s.reference}</Text>
                           )}
                        </View>
                        <Text style={styles.splitAmount}>
                           {s.currency === 'USD' ? `$${s.amount.toFixed(2)}` : `${s.amount.toFixed(2)} Bs`}
                        </Text>
                        <P style={styles.splitDeleteBtn} onPress={() => removeSplit(s.id)}>
                           <Trash2 size={11} color="#DC2626" />
                        </P>
                     </View>
                  );
               })}
            </View>
         )}

         {/* ESTADO COBERTURA — compacto, una sola línea */}
         {paymentSplits.length > 0 && (
            <View style={[styles.coverageBar, isFullyCovered ? styles.coverageBarOk : styles.coverageBarWarn]}>
               {isFullyCovered ? (
                  <Check size={13} color="#047857" />
               ) : (
                  <AlertCircle size={13} color="#B45309" />
               )}
               <Text
                  style={[styles.coverageText, isFullyCovered ? { color: '#047857' } : { color: '#B45309' }]}
                  numberOfLines={1}
               >
                  {isFullyCovered
                     ? `Cubierto · $${paidUSD.toFixed(2)} + ${paidBS.toFixed(2)} Bs`
                     : `Falta $${remainingInUSDEquiv.toFixed(2)} · $${paidUSD.toFixed(2)} + ${paidBS.toFixed(2)} Bs`}
               </Text>
            </View>
         )}

         {/* CLIENTE Y NOTAS — accordion colapsado */}
         <P style={styles.accordionHeader} onPress={() => setShowClientSection(!showClientSection)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <User size={13} color={T.inkSoft} />
               <Text style={styles.accordionLabel}>
                  Cliente y notas
                  {(customerName || customerPhone || notes) && (
                     <Text style={styles.accordionDot}> ·</Text>
                  )}
               </Text>
            </View>
            {showClientSection ? (
               <ChevronUp size={14} color={T.inkMute} />
            ) : (
               <ChevronDown size={14} color={T.inkMute} />
            )}
         </P>

         {showClientSection && (
            <View style={{ paddingTop: 8, paddingBottom: 4 }}>
               <View style={styles.customerInputsRow}>
                  <View style={styles.inputWithIcon}>
                     <User size={14} color={T.inkMute} />
                     <TextInput
                        style={styles.smallInput}
                        placeholder="Nombre Cliente"
                        placeholderTextColor={T.inkMute}
                        value={customerName}
                        onChangeText={setCustomerName}
                     />
                  </View>
                  <View style={styles.inputWithIcon}>
                     <Phone size={14} color={T.inkMute} />
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
            </View>
         )}

         {comboInfo.eligibleCount > 0 && comboDiscount !== 0 && (
            <View style={styles.comboDiscountLine}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <Crown size={14} color={comboDiscount > 0 ? '#047857' : '#B45309'} />
                  <Text
                     style={[styles.comboDiscountLabel, comboDiscount < 0 && { color: '#B45309' }]}
                     numberOfLines={1}
                  >
                     {comboDiscount > 0 ? 'Descuento Combos' : 'Ajuste Combos'} · {comboInfo.eligibleCount}
                  </Text>
               </View>
               <Text
                  style={[
                     styles.comboDiscountValue,
                     comboDiscount > 0 ? { color: '#047857' } : { color: '#B45309' },
                  ]}
               >
                  {comboDiscount > 0 ? '-' : '+'}${Math.abs(comboDiscount).toFixed(2)}
               </Text>
            </View>
         )}
      </View>
   );

   const showCatalog = split || panel === 'catalog';
   const showCart = split || panel === 'cart';

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
                     ListEmptyComponent={<Text style={styles.emptyCartText}>No se encontraron prendas.</Text>}
                     showsVerticalScrollIndicator={false}
                  />

                  {totalPages > 1 && (
                     <View style={styles.paginationBar}>
                        <P style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavDisabled]} disabled={currentPage === 1} onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                           <ChevronLeft size={18} color={T.ink} />
                           <Text style={styles.pageNavText}>Anterior</Text>
                        </P>
                        <Text style={styles.pageIndicator}>
                           <Text style={{ color: T.ink }}>{currentPage}</Text> / {totalPages}
                        </Text>
                        <P style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavDisabled]} disabled={currentPage === totalPages} onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                           <Text style={styles.pageNavText}>Siguiente</Text>
                           <ChevronRight size={18} color={T.ink} />
                        </P>
                     </View>
                  )}

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
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
                           {(selectedProduct.variants || []).map((v, idx) => (
                              <P
                                 key={idx}
                                 style={[styles.chip, selectedColorIndex === idx && styles.chipOn]}
                                 onPress={() => {
                                    setSelectedColorIndex(idx);
                                    const firstStockSize = v.sizes?.find((s) => Number(s.stock) > 0)?.size || '';
                                    setSelectedSize(firstStockSize);
                                 }}
                              >
                                 <View style={[styles.swatch, { backgroundColor: (v as any).colorHex || '#000' }]} />
                                 <Text style={[styles.chipText, selectedColorIndex === idx && styles.chipOnText]}>{v.color}</Text>
                              </P>
                           ))}
                        </ScrollView>

                        <Text style={styles.subLabel}>Talla disponible:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
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
                                    <Text style={[styles.chipText, isSelected && styles.chipOnText, !hasStock && styles.chipTextDisabled]}>
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
                  {/* HEADER STICKY con total inline */}
                  <View style={styles.cartHeaderSticky}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <ShoppingBag size={20} color={T.ink} />
                        <Text style={styles.cartHeaderTitle} numberOfLines={1}>Carrito</Text>
                        {cartCount > 0 && (
                           <View style={styles.cartHeaderBadge}>
                              <Text style={styles.cartHeaderBadgeText}>{cartCount}</Text>
                           </View>
                        )}
                        {comboInfo.eligibleCount > 0 && (
                           <View style={styles.cartHeaderComboBadge}>
                              <Crown size={10} color="#047857" />
                              <Text style={styles.cartHeaderComboText}>
                                 {comboInfo.eligibleCount} {comboInfo.eligibleCount === 1 ? 'combo' : 'combos'}
                              </Text>
                           </View>
                        )}
                     </View>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <P style={styles.headerActionBtn} onPress={() => setShowComboApply(true)}>
                           <Crown size={13} color={T.ink} />
                        </P>
                        <P style={styles.headerActionBtn} onPress={() => setShowComboManager(true)}>
                           <Settings size={13} color={T.ink} />
                        </P>
                        <Text style={styles.cartHeaderTotal}>${totalUSD.toFixed(2)}</Text>
                     </View>
                  </View>

                  {/* LISTA + SECCIONES SCROLLEABLES CON BARRA VISIBLE */}
                  <ScrollView
                     style={styles.cartScroll}
                     showsVerticalScrollIndicator={true}
                     contentContainerStyle={{ paddingBottom: 24, paddingRight: 4 }}
                     keyboardShouldPersistTaps="handled"
                  >
                     {cart.length === 0 ? (
                        <Text style={styles.emptyCartText}>
                           El carrito está vacío. Selecciona prendas del catálogo para iniciar la venta.
                        </Text>
                     ) : (
                        pricedCart.map((item, idx) => (
                           <View key={`${item.productId}_${item.color}_${item.size}`} style={styles.cartItemRow}>
                              <Pressable onPress={() => item.productImage && setViewerImage(item.productImage)}>
                                 <Cover uri={item.productImage} name={item.name} bg={T.imgBg} fg={T.line} style={styles.cartItemImg} />
                              </Pressable>
                              <View style={{ flex: 1, minWidth: 120 }}>
                                 <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                                 <Text style={styles.cartItemDetail}>Color: {item.color} · Talla: {item.size}</Text>
                                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                                    <Text style={styles.cartItemPrice}>${item.unitPrice.toFixed(2)} c/u</Text>
                                    {item.bsRefUnit > 0 && (
                                       <Text style={styles.cartItemPriceBS}>· €{item.bsRefUnit.toFixed(2)}</Text>
                                    )}
                                    {item.isWholesalePrice && (
                                       <View style={styles.wholesaleItemBadge}>
                                          <Text style={styles.wholesaleItemBadgeText}>MAYOR</Text>
                                       </View>
                                    )}
                                    {comboInfo.itemComboMap[`${item.productId}_${item.color}_${item.size}`] && (
                                       <View style={styles.comboItemBadge}>
                                          <Crown size={8} color="#7C3AED" />
                                          <Text style={styles.comboItemBadgeText}>COMBO</Text>
                                       </View>
                                    )}
                                 </View>
                              </View>

                              <View style={styles.qtyControls}>
                                 <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, -1)}>
                                    <Minus size={13} color={T.ink} />
                                 </P>
                                 <Text style={styles.qtyText}>{item.quantity}</Text>
                                 <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, 1)}>
                                    <Plus size={13} color={T.ink} />
                                 </P>
                              </View>

                              <View style={{ alignItems: 'flex-end', minWidth: 76 }}>
                                 <Text style={styles.cartItemSubtotal}>${item.totalPrice.toFixed(2)}</Text>
                                 {item.bsRefTotal > 0 && (
                                    <Text style={styles.cartItemSubtotalBS}>
                                       {(item.bsRefTotal * eurToBsRate).toFixed(2)} Bs
                                    </Text>
                                 )}
                              </View>

                              <P style={styles.cartDeleteBtn} onPress={() => removeFromCart(idx)}>
                                 <Trash2 size={13} color={T.inkMute} />
                              </P>
                           </View>
                        ))
                     )}

                     {cartCount >= WHOLESALE_THRESHOLD && (
                        <View style={styles.wholesaleBanner}>
                           <Crown size={14} color="#047857" />
                           <View style={{ flex: 1 }}>
                              <Text style={styles.wholesaleBannerTitle}>Modo Mayor Activo</Text>
                              <Text style={styles.wholesaleBannerSub}>
                                 {cartCount} unidades · precios mayor aplicados
                              </Text>
                           </View>
                        </View>
                     )}

                     {checkout}
                  </ScrollView>

                  {/* FOOTER STICKY — solo total Bs + botón */}
                  <View style={styles.cartFooterSticky}>
                     {totalBSRef > 0 && (
                        <View style={styles.cartFooterBSRow}>
                           <Text style={styles.cartFooterBSLabel}>Equiv. Bs:</Text>
                           <Text style={styles.cartFooterBSValue}>
                              {totalBSExpected.toFixed(2)} Bs <Text style={styles.cartFooterBSRef}>(€{totalBSRef.toFixed(2)} @ {eurToBsRate})</Text>
                           </Text>
                        </View>
                     )}

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
               </View>
            )}         </View>

         {/* LIGHTBOX IMAGEN */}
         <Modal visible={!!viewerImage} transparent animationType="fade">
            <View style={styles.viewerOverlay}>
               <Pressable style={styles.viewerClose} onPress={() => setViewerImage(null)}>
                  <X color={T.onBar} size={28} />
               </Pressable>
               {viewerImage && (
                  <Image source={{ uri: viewerImage }} style={{ width: '100%', height: '80%' }} contentFit="contain" />
               )}
            </View>
         </Modal>

         {/* MODAL SPLIT */}
         <Modal visible={showSplitModal} transparent animationType="fade">
            <View style={styles.modalOverlayCenter}>
               <View style={styles.sellerModalCard}>
                  <View style={styles.sellerModalHeader}>
                     <Text style={styles.sellerModalTitle}>Agregar Pago</Text>
                     <P onPress={closeSplitModal}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>
                  <ScrollView style={{ padding: 20 }}>
                     <Text style={styles.subLabel}>Método:</Text>
                     <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {PAYMENT_OPTIONS.map((m) => {
                           const IconComp = m.icon;
                           const active = newSplitMethod === m.id;
                           const isBS = m.id === 'pago_movil';
                           return (
                              <P
                                 key={m.id}
                                 style={[
                                    styles.chip,
                                    active && styles.chipOn,
                                    { flexDirection: 'row', gap: 4, flexGrow: 1, flexBasis: '46%', justifyContent: 'center' },
                                 ]}
                                 onPress={() => setNewSplitMethod(m.id as PaymentMethod)}
                              >
                                 <IconComp size={14} color={active ? T.onSolid : T.inkMute} />
                                 <Text style={[styles.chipText, active && styles.chipOnText]}>
                                    {m.label} {isBS ? '· Bs' : '· USD'}
                                 </Text>
                              </P>
                           );
                        })}
                     </View>

                     {newSplitMethod === 'pago_movil' && (
                        <View style={styles.splitHint}>
                           <Coins size={14} color="#6366F1" />
                           <Text style={styles.splitHintText}>
                              El monto en Bs se convierte a USD usando la tasa del día (1 USD = {usdToBsRate} Bs).
                           </Text>
                        </View>
                     )}

                     <Text style={styles.subLabel}>
                        Monto ({newSplitMethod === 'pago_movil' ? 'Bs' : 'USD $'}):
                     </Text>
                     <TextInput
                        style={styles.sellerInput}
                        value={newSplitAmount}
                        onChangeText={setNewSplitAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={T.inkMute}
                        autoFocus
                     />

                     {/* Preview de conversión */}
                     {newSplitMethod === 'pago_movil' && parseFloat(newSplitAmount) > 0 && (
                        <View style={styles.splitConvertPreview}>
                           <Text style={styles.splitConvertText}>
                              ≈ ${(parseFloat(newSplitAmount) / usdToBsRate).toFixed(2)} USD equivalentes
                           </Text>
                        </View>
                     )}

                     <Text style={[styles.subLabel, { marginTop: 12 }]}>Referencia (opcional):</Text>
                     <TextInput
                        style={styles.sellerInput}
                        value={newSplitRef}
                        onChangeText={setNewSplitRef}
                        placeholder="Nº de referencia, últimos dígitos..."
                        placeholderTextColor={T.inkMute}
                     />

                     <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <P style={styles.sellerCancelBtn} onPress={closeSplitModal}>
                           <Text style={styles.sellerCancelText}>Cancelar</Text>
                        </P>
                        <P style={styles.sellerSaveBtn} onPress={handleAddSplit}>
                           <Text style={styles.sellerSaveText}>Agregar</Text>
                        </P>
                     </View>
                  </ScrollView>
               </View>
            </View>
         </Modal>

         {/* MODAL VENDEDOR */}
         <Modal visible={sellerModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlayCenter}>
               <View style={styles.sellerModalCard}>
                  <View style={styles.sellerModalHeader}>
                     <Text style={styles.sellerModalTitle}>
                        {sellerModalMode === 'edit' ? 'Editar Vendedor' : 'Nuevo Vendedor'}
                     </Text>
                     <P onPress={closeSellerModal}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>
                  <View style={{ padding: 20 }}>
                     <Text style={styles.subLabel}>Nombre completo:</Text>
                     <TextInput
                        style={styles.sellerInput}
                        value={sellerNameInput}
                        onChangeText={setSellerNameInput}
                        placeholder="Ej. María Pérez"
                        placeholderTextColor={T.inkMute}
                        autoFocus
                        editable={!savingSeller}
                     />
                     <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <P style={styles.sellerCancelBtn} onPress={closeSellerModal} disabled={savingSeller}>
                           <Text style={styles.sellerCancelText}>Cancelar</Text>
                        </P>
                        <P style={[styles.sellerSaveBtn, savingSeller && { opacity: 0.6 }]} onPress={handleSaveSeller} disabled={savingSeller}>
                           {savingSeller ? (
                              <ActivityIndicator size="small" color={T.onSolid} />
                           ) : (
                              <Text style={styles.sellerSaveText}>
                                 {sellerModalMode === 'edit' ? 'Guardar Cambios' : 'Crear'}
                              </Text>
                           )}
                        </P>
                     </View>
                  </View>
               </View>
            </View>
         </Modal>

         {/* MODAL TASAS */}
         <Modal visible={showRatesModal} transparent animationType="fade">
            <View style={styles.modalOverlayCenter}>
               <View style={styles.sellerModalCard}>
                  <View style={styles.sellerModalHeader}>
                     <Text style={styles.sellerModalTitle}>Tasas del Día</Text>
                     <P onPress={() => setShowRatesModal(false)}>
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>
                  <View style={{ padding: 20 }}>
                     <Text style={styles.subLabel}>1 EUR =</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <TextInput
                           style={[styles.sellerInput, { flex: 1 }]}
                           value={eurRateInput}
                           onChangeText={handleEurRateChange}
                           keyboardType="decimal-pad"
                           placeholder="50"
                           placeholderTextColor={T.inkMute}
                           selectTextOnFocus
                        />
                        <Text style={{ fontSize: 15, fontWeight: '800', color: T.inkSoft }}>Bs</Text>
                     </View>
                     <Text style={styles.rateRowHint}>
                        Referencia para precios en Bs del catálogo
                     </Text>

                     <Text style={[styles.subLabel, { marginTop: 14 }]}>1 USD =</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <TextInput
                           style={[styles.sellerInput, { flex: 1 }]}
                           value={usdRateInput}
                           onChangeText={handleUsdRateChange}
                           keyboardType="decimal-pad"
                           placeholder="40"
                           placeholderTextColor={T.inkMute}
                           selectTextOnFocus
                        />
                        <Text style={{ fontSize: 15, fontWeight: '800', color: T.inkSoft }}>Bs</Text>
                     </View>
                     <Text style={styles.rateRowHint}>
                        Conversión de pagos en Bs → USD equivalentes
                     </Text>

                     <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
                        <P style={styles.sellerSaveBtn} onPress={() => setShowRatesModal(false)}>
                           <Text style={styles.sellerSaveText}>Listo</Text>
                        </P>
                     </View>
                  </View>
               </View>
            </View>
         </Modal>

         <ComboManagerModal
            visible={showComboManager}
            onClose={() => setShowComboManager(false)}
            combos={combos}
            availableCategories={availableCategories}
         />

         <ComboApplyModal
            visible={showComboApply}
            onClose={() => setShowComboApply(false)}
            combos={combos.filter((c) => c.isActive)}
            cart={cart}
            products={products}
            appliedCombos={appliedCombos}
            onChange={setAppliedCombos}
         />

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
   body: {
      flex: 1,
      width: '100%',
      maxWidth: 1280,
      alignSelf: 'center',
   },
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
   rightPanel: { flex: 1, padding: 16 },
   rightSplit: {
      maxWidth: 470,
      padding: 22,
      backgroundColor: T.surface,
      borderLeftWidth: 1,
      borderLeftColor: T.line,
   },

   productsScroll: { flex: 1 },
   productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, marginBottom: 8, backgroundColor: T.surface, borderWidth: 2, borderColor: 'transparent' },
   productCardSelected: { borderColor: T.ink, backgroundColor: T.bg },
   productImg: { width: 52, height: 66, borderRadius: 8 },
   productBrand: { fontSize: 12, fontWeight: '700', color: T.inkMute },
   productName: { fontSize: 14, fontWeight: '700', color: T.ink },
   productCode: { fontSize: 11, color: T.inkMute },

   priceColumn: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
   productPrice: { ...display, fontSize: 20, lineHeight: 20, fontWeight: '800', color: T.ink, textAlign: 'right' },
   wholesalePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   wholesalePriceText: { ...display, fontSize: 13, lineHeight: 13, fontWeight: '700', color: '#059669' },
   wholesaleTag: { fontSize: 9, fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
   bsRefSmall: { fontSize: 10, color: '#7C3AED', fontWeight: '700' },

   paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 8, marginTop: 8 },
   pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8 },
   pageNavDisabled: { opacity: 0.3 },
   pageNavText: { fontSize: 13, fontWeight: '700', color: T.ink },
   pageIndicator: { ...display, fontSize: 22, fontWeight: '700', color: T.inkMute },

   selectionModal: { backgroundColor: T.bg, borderRadius: 14, borderWidth: 2, borderColor: T.ink, padding: 14, marginTop: 12 },
   selectionTitle: { fontSize: 14, fontWeight: '800', color: T.ink, flex: 1, marginRight: 8 },
   chip: { ...chipBase, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
   chipAdd: { backgroundColor: T.surface },
   chipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   chipDisabled: { opacity: 0.4 },
   chipTextDisabled: { textDecorationLine: 'line-through' },
   swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
   addToCartBtn: { ...btn, height: 48, gap: 8, backgroundColor: T.solid, marginTop: 4 },
   addToCartText: { fontSize: 14, fontWeight: '800', color: T.onSolid },

   cartScroll: { flex: 1 },
   emptyCartText: { fontSize: 14, color: T.inkMute, textAlign: 'center', marginTop: 40, lineHeight: 21 },
   cartItemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
   cartItemImg: { width: 44, height: 56, borderRadius: 6 },
   cartItemName: { fontSize: 14, fontWeight: '700', color: T.ink },
   cartItemDetail: { fontSize: 12, color: T.inkMute },
   cartItemPrice: { fontSize: 12, color: T.inkSoft, fontWeight: '700' },
   cartItemPriceBS: { fontSize: 12, color: '#7C3AED', fontWeight: '700' },
   wholesaleItemBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, borderWidth: 1, borderColor: '#A7F3D0' },
   wholesaleItemBadgeText: { fontSize: 8, fontWeight: '800', color: '#047857' },
   qtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg },
   qtyBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
   qtyText: { ...display, fontSize: 22, fontWeight: '700', color: T.ink, minWidth: 26, textAlign: 'center' },
   cartItemSubtotal: { ...display, fontSize: 20, lineHeight: 20, fontWeight: '800', color: T.ink, textAlign: 'right' },
   cartItemSubtotalBS: { fontSize: 11, color: '#7C3AED', fontWeight: '700', textAlign: 'right', marginTop: 2 },
   cartDeleteBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

   rateRowHint: {
      fontSize: 10,
      color: '#6366F1',
      fontStyle: 'italic',
      marginTop: 4,
      marginBottom: 2,
      marginLeft: 68,
   },

   addSplitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   addSplitText: { fontSize: 11, fontWeight: '800', color: T.ink },
   emptySplitsText: { fontSize: 12, color: T.inkMute, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' },
   splitsList: { gap: 6, marginBottom: 10 },
   splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, borderRadius: 8 },
   splitIconBox: { width: 26, height: 26, borderRadius: 6, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
   splitMethod: { fontSize: 12, fontWeight: '800', color: T.ink },
   splitRef: { fontSize: 10, color: T.inkMute, marginTop: 1 },
   splitAmount: { ...display, fontSize: 14, fontWeight: '800', color: T.ink, minWidth: 80, textAlign: 'right' },
   splitDeleteBtn: { width: 24, height: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },

   customerInputsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
   inputWithIcon: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg },
   smallInput: { flex: 1, fontSize: 14, color: T.ink, paddingVertical: 0, paddingHorizontal: 0, margin: 0, textAlignVertical: 'center', height: '100%', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },

   completeSaleBtn: { ...btn, height: 52, gap: 10, backgroundColor: '#2BC526' },
   completeSaleText: { fontSize: 16, fontWeight: '800', color: T.onSolid },

   checkoutSection: {
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: T.line,
   },

   viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
   viewerClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },

   modalOverlayCenter: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
   sellerModalCard: { width: '100%', maxWidth: 400, backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden', maxHeight: '90%' },
   sellerModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: T.bar },
   sellerModalTitle: { ...display, fontSize: 22, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   sellerInput: { borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink },
   sellerCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: T.line },
   sellerCancelText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   sellerSaveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: T.solid },
   sellerSaveText: { fontSize: 13, fontWeight: '800', color: T.onSolid },

   sellerMiniBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
   sellerMiniBtnDanger: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },

   wholesaleBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981', borderRadius: 10, marginBottom: 12, marginTop: 10 },
   wholesaleBannerTitle: { fontSize: 12, fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 },
   wholesaleBannerSub: { fontSize: 11, color: '#059669', marginTop: 1 },

   splitHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#EEF2FF',
      borderWidth: 1,
      borderColor: '#C7D2FE',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 12,
   },
   splitHintText: {
      flex: 1,
      fontSize: 11,
      color: '#4338CA',
      fontWeight: '600',
      lineHeight: 14,
   },
   splitConvertPreview: {
      marginTop: -4,
      marginBottom: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: T.surface,
      borderWidth: 1,
      borderColor: T.line,
      borderRadius: 6,
   },
   splitConvertText: {
      fontSize: 12,
      fontWeight: '700',
      color: T.inkSoft,
      textAlign: 'center',
   },

   // Header sticky del carrito
   cartHeaderSticky: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: T.line,
      backgroundColor: T.surface,
      gap: 10,
   },
   cartHeaderTitle: {
      ...display,
      fontSize: 18,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'uppercase',
   },
   cartHeaderBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      backgroundColor: T.solid,
      alignItems: 'center',
      justifyContent: 'center',
   },
   cartHeaderBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: T.onSolid,
   },
   cartHeaderTotal: {
      ...display,
      fontSize: 22,
      fontWeight: '800',
      color: T.ink,
   },

   // Footer sticky
   cartFooterSticky: {
      borderTopWidth: 1,
      borderTopColor: T.line,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 14,
      backgroundColor: T.surface,
   },
   cartFooterBSRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
   },
   cartFooterBSLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: T.inkMute,
      textTransform: 'uppercase',
   },
   cartFooterBSValue: {
      ...display,
      fontSize: 16,
      fontWeight: '800',
      color: '#7C3AED',
   },
   cartFooterBSRef: {
      fontSize: 11,
      fontWeight: '600',
      color: '#A78BFA',
   },

   // Secciones compactas
   sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
   },
   sectionMiniLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: T.inkMute,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   chipSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
   },
   chipSmallText: {
      fontSize: 11,
      fontWeight: '700',
      color: T.inkSoft,
   },

   // Chip de tasas
   ratesChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: '#EEF2FF',
      borderWidth: 1,
      borderColor: '#C7D2FE',
      borderRadius: 8,
      marginTop: 6,
      marginBottom: 4,
   },
   ratesChipText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: '#4338CA',
   },

   // Barra de cobertura compacta
   coverageBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      marginTop: 6,
      marginBottom: 6,
   },
   coverageBarOk: {
      backgroundColor: '#F0FDF4',
      borderColor: '#A7F3D0',
   },
   coverageBarWarn: {
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
   },
   coverageText: {
      fontSize: 11,
      fontWeight: '800',
      flex: 1,
   },

   // Accordion
   accordionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginTop: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
   },
   accordionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: T.inkSoft,
   },
   accordionDot: {
      color: '#10B981',
      fontWeight: '800',
   },

   cartHeaderComboBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
   cartHeaderComboText: { fontSize: 9, fontWeight: '800', color: '#047857', textTransform: 'uppercase' },
   headerActionBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },
   comboDiscountLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, marginTop: 8 },
   comboDiscountLabel: { fontSize: 12, fontWeight: '800', color: '#047857', flex: 1 },
   comboDiscountValue: { ...display, fontSize: 16, fontWeight: '800', color: '#047857' },
   comboItemBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
   comboItemBadgeText: { fontSize: 8, fontWeight: '800', color: '#047857' },
});
import React, { useState, useEffect, useMemo } from 'react';
import {
   View,
   Text,
   ScrollView,
   StyleSheet,
   TextInput,
   Modal,
   FlatList,
   Pressable,
   useWindowDimensions,
   Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
   Clock,
   Search,
   Plus,
   Minus,
   User,
   MessageCircle,
   X,
   CreditCard,
   Tag,
   ShieldCheck,
   XCircle,
   Receipt,
   ShoppingBag,
   Shirt,
   Trash2,
   CheckCircle2,
} from 'lucide-react-native';
import {
   Layaway,
   subscribeToLayaways,
   addLayawayPayment,
   cancelLayaway,
   createLayaway,
   officializeLayawaySale,
} from '../services/layawayService';
import { getSaleById } from '../services/salesHistoryService';
import { Product } from '../types/inventory';
import { Sale } from '../types/sale';
import { subscribeToProducts } from '../services/productService';
import { SaleReceiptModal } from '../components/SaleReceiptModal';
import { openExternalLink } from '../utils/htmlUtils';
import { roundMoney } from '../utils/pricingUtils';
import { showAlert, showConfirm } from '../utils/alert';
import { display } from '../design';

// ==========================================
// Paleta y medidas compartidas con SalesRegister
// ==========================================
const C = {
   bg: '#0A0A0A',
   card: '#141414',
   cardAlt: '#181818',
   border: '#262626',
   ink: '#F5F5F5',
   soft: '#D4D4D4',
   mute: '#8A8A8A',
   solid: '#F5F5F5',
   onSolid: '#0A0A0A',
   green: '#4ADE80',
   greenBg: 'rgba(74,222,128,0.12)',
   greenBorder: 'rgba(74,222,128,0.35)',
   red: '#F87171',
   redBg: 'rgba(248,113,113,0.12)',
   redBorder: 'rgba(248,113,113,0.35)',
   amber: '#FBBF24',
   amberBg: 'rgba(251,191,36,0.12)',
   amberBorder: 'rgba(251,191,36,0.35)',
   purple: '#A78BFA',
   overlay: 'rgba(0,0,0,0.84)',
};

const MAX = 1180;

const safeFixed = (val: any, decimals: number = 2): string => {
   const num = Number(val);
   return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const formatDate = (value: any, withTime: boolean = false): string => {
   if (!value) return '—';
   let date: Date;
   if (value instanceof Date) date = value;
   else if (typeof value?.toDate === 'function') date = value.toDate();
   else if (typeof value?.seconds === 'number') date = new Date(value.seconds * 1000);
   else date = new Date(value);
   if (isNaN(date.getTime())) return '—';
   return withTime
      ? date.toLocaleString('es-VE')
      : date.toLocaleDateString('es-VE');
};

/**
 * Normaliza la URL que consume expo-image. Las imágenes de producto ya se
 * guardan como URLs públicas de R2, por lo que se devuelven tal cual.
 */
const getDisplayImageUrl = (url?: string | null): string => String(url || '').trim();

const totalProductStock = (product: Product): number =>
   (product.variants || []).reduce(
      (total, variant) =>
         total +
         (variant.sizes || []).reduce(
            (sum, size) => sum + Math.max(0, Number(size.stock) || 0),
            0
         ),
      0
   );

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

interface Props {
   currentSellerName?: string;
   currentSellerId?: string;
}

export const LayawayScreen: React.FC<Props> = ({
   currentSellerName = 'Vendedor Principal',
   currentSellerId = 'v1',
}) => {
   const { width } = useWindowDimensions();
   const wide = width >= 1000;

   const [layaways, setLayaways] = useState<Layaway[]>([]);
   const [products, setProducts] = useState<Product[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState<string>('active');

   // Modales
   const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);
   const [isNewModalOpen, setIsNewModalOpen] = useState(false);
   const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
   const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
   const [productSearch, setProductSearch] = useState('');

   // Formulario Nuevo Apartado
   const [customerName, setCustomerName] = useState('');
   const [customerPhone, setCustomerPhone] = useState('');
   const [initialPayment, setInitialPayment] = useState('');
   const [paymentMethod, setPaymentMethod] = useState<any>('efectivo');
   const [daysToDue, setDaysToDue] = useState('15');
   const [cartItems, setCartItems] = useState<any[]>([]);

   // Selector visual de producto
   const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<Product | null>(null);
   const [selectedColor, setSelectedColor] = useState('');
   const [selectedSize, setSelectedSize] = useState('');

   // Formulario Nuevo Abono
   const [abonoAmount, setAbonoAmount] = useState('');
   const [abonoMethod, setAbonoMethod] = useState<any>('efectivo');
   const [abonoNotes, setAbonoNotes] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
      const unsubL = subscribeToLayaways(setLayaways);
      const unsubP = subscribeToProducts(setProducts);
      return () => {
         unsubL();
         unsubP();
      };
   }, []);

   const filteredLayaways = layaways.filter((layaway) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQ =
         !q ||
         (layaway.code && layaway.code.toLowerCase().includes(q)) ||
         (layaway.customerName && layaway.customerName.toLowerCase().includes(q)) ||
         (layaway.customerPhone && layaway.customerPhone.includes(q)) ||
         (layaway.sellerName && layaway.sellerName.toLowerCase().includes(q));

      const matchesStatus =
         statusFilter === 'all' || layaway.status === statusFilter;

      return matchesQ && matchesStatus;
   });

   const activeLayaways = useMemo(
      () => layaways.filter((layaway) => layaway.status === 'active'),
      [layaways]
   );
   const totalPending = useMemo(
      () => activeLayaways.reduce((sum, item) => sum + (Number(item.balanceRemaining) || 0), 0),
      [activeLayaways]
   );

   // Buscador real de productos con stock.
   const availableProducts = useMemo(() => {
      const q = productSearch.trim().toLowerCase();
      return products
         .filter((product) => !product.deleted && totalProductStock(product) > 0)
         .filter((product) => {
            if (!q) return true;
            return (
               String(product.name || '').toLowerCase().includes(q) ||
               String(product.brand || '').toLowerCase().includes(q) ||
               String(product.code || '').toLowerCase().includes(q) ||
               String(product.category || '').toLowerCase().includes(q)
            );
         })
         .slice(0, 40);
   }, [products, productSearch]);

   const findProduct = (productId: string): Product | undefined =>
      products.find((product) => (product.id || product.code) === productId);

   const cartQuantityFor = (productId: string, color: string, size: string): number =>
      cartItems
         .filter(
            (item) =>
               item.productId === productId &&
               item.color === color &&
               item.size === size
         )
         .reduce((total, item) => total + (Number(item.quantity) || 0), 0);

   const cartSubtotal = useMemo(
      () => roundMoney(cartItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0)),
      [cartItems]
   );
   const initialPaymentValue = Math.max(0, Number(initialPayment) || 0);
   const cartBalance = Math.max(0, roundMoney(cartSubtotal - initialPaymentValue));

   const selectedVariant = selectedCatalogProduct?.variants?.find(
      (variant) => variant.color === selectedColor
   );
   const selectedSizeStock = Number(
      selectedVariant?.sizes?.find((size) => size.size === selectedSize)?.stock
   ) || 0;
   const selectedInCart = selectedCatalogProduct
      ? cartQuantityFor(
         selectedCatalogProduct.id || selectedCatalogProduct.code,
         selectedColor,
         selectedSize
      )
      : 0;
   const canAddSelected =
      !!selectedCatalogProduct &&
      !!selectedSize &&
      selectedSizeStock > selectedInCart;

   const resetNewForm = () => {
      setCartItems([]);
      setProductSearch('');
      setCustomerName('');
      setCustomerPhone('');
      setInitialPayment('');
      setPaymentMethod('efectivo');
      setDaysToDue('15');
      setSelectedCatalogProduct(null);
      setSelectedColor('');
      setSelectedSize('');
   };

   const handleSelectProduct = (product: Product) => {
      const firstVariant =
         (product.variants || []).find((variant) =>
            (variant.sizes || []).some((size) => Number(size.stock) > 0)
         ) || product.variants?.[0];
      const firstSize =
         firstVariant?.sizes?.find((size) => Number(size.stock) > 0)?.size || '';

      setSelectedCatalogProduct(product);
      setSelectedColor(firstVariant?.color || '');
      setSelectedSize(firstSize);
   };

   const handleAddToCart = (product: Product, color: string, size: string) => {
      const pId = product.id || product.code;
      if (!pId) return;

      const variant = (product.variants || []).find((v) => v.color === color);
      const sizeObj = (variant?.sizes || []).find((s) => s.size === size);
      const availableStock = Math.max(0, Number(sizeObj?.stock) || 0);
      const inCart = cartQuantityFor(pId, color, size);

      if (availableStock <= 0) {
         showAlert('Agotado', 'Esta talla no tiene unidades disponibles.');
         return;
      }
      if (inCart + 1 > availableStock) {
         showAlert(
            'Stock insuficiente',
            `Solo hay ${availableStock} unidad(es) disponibles de esta talla.`
         );
         return;
      }

      const existing = cartItems.find(
         (i) => i.productId === pId && i.color === color && i.size === size
      );

      if (existing) {
         setCartItems((prev) =>
            prev.map((i) =>
               i.productId === pId && i.color === color && i.size === size
                  ? {
                     ...i,
                     quantity: i.quantity + 1,
                     totalPrice: roundMoney((i.quantity + 1) * i.unitPrice),
                  }
                  : i
            )
         );
      } else {
         setCartItems((prev) => [
            ...prev,
            {
               productId: pId,
               productCode: product.code || 'S/N',
               brand: product.brand || 'Genérico',
               name: product.name || 'Prenda',
               color: color || '',
               size: size || '',
               quantity: 1,
               unitPrice: roundMoney(Number(product.price) || 0),
               totalPrice: roundMoney(Number(product.price) || 0),
               productImage: getDisplayImageUrl(product.images?.[0] || ''),
            },
         ]);
      }
   };

   const updateCartQuantity = (index: number, delta: number) => {
      const item = cartItems[index];
      if (!item) return;

      const product = findProduct(item.productId);
      const variant = product?.variants?.find((v) => v.color === item.color);
      const sizeObj = variant?.sizes?.find((s) => s.size === item.size);
      const maxStock = Number(sizeObj?.stock) || 0;
      const nextQuantity = Number(item.quantity || 0) + delta;

      if (nextQuantity <= 0) {
         setCartItems((prev) => prev.filter((_, i) => i !== index));
         return;
      }
      if (delta > 0 && (!product || !sizeObj)) {
         showAlert('Prenda no disponible', 'Esta prenda o talla ya no está en el catálogo.');
         return;
      }
      if (delta > 0 && nextQuantity > maxStock) {
         showAlert(
            'Stock insuficiente',
            `Solo hay ${maxStock} unidad(es) disponibles de esta talla.`
         );
         return;
      }

      setCartItems((prev) =>
         prev.map((cartItem, i) =>
            i === index
               ? {
                  ...cartItem,
                  quantity: nextQuantity,
                  totalPrice: roundMoney(nextQuantity * cartItem.unitPrice),
               }
               : cartItem
         )
      );
   };

   const removeCartItem = (index: number) => {
      setCartItems((prev) => prev.filter((_, i) => i !== index));
   };

   const handleSaveLayaway = async () => {
      if (!customerName.trim() || !customerPhone.trim()) {
         showAlert('Datos Incompletos', 'Ingresa el nombre y teléfono del cliente.');
         return;
      }
      if (cartItems.length === 0) {
         showAlert('Carrito Vacío', 'Agrega al menos una prenda al apartado.');
         return;
      }

      setIsProcessing(true);
      try {
         const dueDate = new Date();
         dueDate.setDate(dueDate.getDate() + (Number(daysToDue) || 15));

         const result = await createLayaway({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            sellerId: currentSellerId,
            sellerName: currentSellerName,
            items: cartItems,
            initialPaymentAmount: Number(initialPayment) || 0,
            paymentMethod,
            dueDate,
         });
         if (result.sale) setReceiptSale(result.sale);

         setIsNewModalOpen(false);
         resetNewForm();
         if (result.sale) {
            showAlert(
               'Apartado Completado',
               'El pago inicial cubrió el total. La venta oficial ya fue generada y el stock quedó reservado.'
            );
         } else {
            showAlert('¡Éxito!', 'El apartado se ha guardado y el stock ha sido reservado.');
         }
      } catch (error: any) {
         console.error('Error al guardar apartado:', error);
         showAlert('Error al guardar', error?.message || 'No se pudo crear el apartado.');
      } finally {
         setIsProcessing(false);
      }
   };

   const handleSaveAbono = async () => {
      if (!selectedLayaway) return;
      const amount = Number(abonoAmount);
      if (!amount || amount <= 0) {
         showAlert('Monto Inválido', 'Ingresa un monto de abono válido.');
         return;
      }

      if (amount > selectedLayaway.balanceRemaining) {
         showAlert(
            'Monto Excedido',
            `El abono no puede superar el saldo pendiente ($${safeFixed(selectedLayaway.balanceRemaining)}).`
         );
         return;
      }

      setIsProcessing(true);
      try {
         const result = await addLayawayPayment(
            selectedLayaway.id,
            amount,
            abonoMethod,
            currentSellerName,
            abonoNotes
         );
         setIsPaymentModalOpen(false);
         setSelectedLayaway(null);
         setAbonoAmount('');
         setAbonoNotes('');

         if (result.completed) {
            let completedSale = result.sale || null;
            if (!completedSale && result.saleId) {
               completedSale = await getSaleById(result.saleId);
            }
            if (completedSale) setReceiptSale(completedSale);
            showAlert(
               'Apartado Completado',
               'El saldo llegó a 0. La venta oficial ya fue generada y está disponible en el Historial.'
            );
         } else {
            showAlert('Abono Registrado', 'El abono fue procesado con éxito.');
         }
      } catch (error: any) {
         showAlert('Error', error?.message || 'No se pudo registrar el abono.');
      } finally {
         setIsProcessing(false);
      }
   };

   const handleViewOrOfficializeSale = async (layaway: Layaway) => {
      if (!layaway?.id || isProcessing) return;
      setIsProcessing(true);
      try {
         // Es idempotente: si ya existe la venta oficial, la devuelve.
         const sale = await officializeLayawaySale(layaway.id);
         setSelectedLayaway((current) =>
            current && current.id === layaway.id
               ? {
                  ...current,
                  saleId: sale.id,
                  saleReceiptNumber: sale.receiptNumber,
               }
               : current
         );
         setReceiptSale(sale);
      } catch (error: any) {
         showAlert(
            'No se pudo abrir la venta',
            error?.message || 'Verifica que el apartado esté pagado por completo.'
         );
      } finally {
         setIsProcessing(false);
      }
   };

   const handleCancelLayaway = async (layaway: Layaway) => {
      showConfirm(
         'Anular Apartado',
         `¿Deseas cancelar el apartado ${layaway.code}? El stock reservado retornará al inventario activo.`,
         async () => {
            try {
               await cancelLayaway(layaway, 'Anulado por el cliente');
               setSelectedLayaway(null);
               showAlert('Apartado Cancelado', 'El stock fue reintegrado al inventario.');
            } catch (error: any) {
               showAlert('Error', error?.message || 'No se pudo cancelar el apartado.');
            }
         }
      );
   };

   const handleSendReminderWA = (layaway: Layaway) => {
      let msg = `🛍️ *RECORDATORIO DE APARTADO*\n`;
      msg += `Hola *${layaway.customerName}*, te recordamos tu apartado *#${layaway.code}*:\n`;
      msg += `• *Total:* $${safeFixed(layaway.totalAmount)}\n`;
      msg += `• *Abonado:* $${safeFixed(layaway.totalPaid)}\n`;
      msg += `• *PENDIENTE:* *$${safeFixed(layaway.balanceRemaining)}*\n`;
      msg += `• *Vence:* ${formatDate(layaway.dueDate)}\n\n`;
      msg += `¡Pasa por la tienda a retirar tus prendas! 😊`;

      const cleanPhone = (layaway.customerPhone || '').replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      void openExternalLink(url);
   };

   const renderProductImage = (product: Product | undefined, style: any) => {
      const uri = product ? getDisplayImageUrl(product.images?.[0] || '') : '';
      if (!uri) {
         return (
            <View style={[style, styles.imageFallback]}>
               <Shirt size={18} color={C.mute} />
            </View>
         );
      }
      return (
         <Image
            source={{ uri }}
            style={style}
            contentFit="cover"
            transition={150}
         />
      );
   };

   const renderCartProductImage = (item: any, style: any) => {
      const product = findProduct(item.productId);
      const uri = product
         ? getDisplayImageUrl(product.images?.[0] || '')
         : item.productImage || '';
      if (!uri) {
         return (
            <View style={[style, styles.imageFallback]}>
               <Shirt size={16} color={C.mute} />
            </View>
         );
      }
      return <Image source={{ uri }} style={style} contentFit="cover" transition={150} />;
   };

   return (
      <View style={styles.container}>
         {/* HEADER */}
         <View style={styles.header}>
            <View style={styles.headerInner}>
               <View style={styles.headerLeft}>
                  <View style={styles.headerIconBox}>
                     <Clock size={20} color={C.ink} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                     <Text style={styles.headerTitle} numberOfLines={1}>Apartados y Pedidos</Text>
                     <Text style={styles.headerSubtitle} numberOfLines={1}>
                        Reserva de stock, abonos y entregas
                     </Text>
                  </View>
               </View>

               <P
                  style={styles.newLayawayBtn}
                  onPress={() => {
                     resetNewForm();
                     setIsNewModalOpen(true);
                  }}
               >
                  <Plus size={16} color={C.onSolid} />
                  <Text style={styles.newLayawayBtnText}>Nuevo Apartado</Text>
               </P>
            </View>

            <View style={[styles.metricsRow, { maxWidth: MAX }]}>
               <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Activos</Text>
                  <Text style={styles.metricValue}>{activeLayaways.length}</Text>
               </View>
               <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Por cobrar</Text>
                  <Text style={[styles.metricValue, { color: C.amber }]}>${safeFixed(totalPending)}</Text>
               </View>
               <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Total registrados</Text>
                  <Text style={styles.metricValue}>{layaways.length}</Text>
               </View>
            </View>
         </View>

         {/* FILTROS */}
         <View style={styles.filterSection}>
            <View style={styles.filterInner}>
               <View style={styles.searchBar}>
                  <Search size={16} color={C.mute} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar por código, cliente o vendedor..."
                     placeholderTextColor={C.mute}
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                     <P onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <X size={14} color={C.mute} />
                     </P>
                  ) : null}
               </View>

               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
               >
                  {[
                     { id: 'active', label: 'Activos / Pendientes' },
                     { id: 'completed', label: 'Entregados / Pagados' },
                     { id: 'cancelled', label: 'Cancelados' },
                     { id: 'all', label: 'Todos' },
                  ].map((chip) => (
                     <P
                        key={chip.id}
                        style={[styles.chip, statusFilter === chip.id && styles.chipOn]}
                        onPress={() => setStatusFilter(chip.id)}
                     >
                        <Text style={[styles.chipText, statusFilter === chip.id && styles.chipTextOn]}>
                           {chip.label}
                        </Text>
                     </P>
                  ))}
               </ScrollView>
            </View>
         </View>

         {/* LISTA */}
         <FlatList
            key={wide ? 'grid-2' : 'list-1'}
            data={filteredLayaways}
            numColumns={wide ? 2 : 1}
            columnWrapperStyle={wide ? styles.gridRow : undefined}
            keyExtractor={(item) => item.id || item.code || 'layaway'}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const isCompleted = item.status === 'completed';
               const isCancelled = item.status === 'cancelled';
               const isActive = item.status === 'active';
               const progressPercent = item.totalAmount > 0
                  ? Math.min(100, Math.round((item.totalPaid / item.totalAmount) * 100))
                  : 0;

               return (
                  <P
                     style={[
                        styles.layawayCard,
                        wide && styles.layawayCardGrid,
                        isCompleted && styles.cardCompleted,
                        isCancelled && styles.cardCancelled,
                     ]}
                     onPress={() => setSelectedLayaway(item)}
                  >
                     <View style={styles.cardHeader}>
                        <View style={styles.codeRow}>
                           <View style={styles.codeIcon}>
                              <Tag size={14} color={isCompleted ? C.green : isCancelled ? C.red : C.ink} />
                           </View>
                           <Text style={styles.layawayCode}>#{item.code || 'N/A'}</Text>
                        </View>

                        <View style={[
                           styles.statusPill,
                           isCompleted && styles.statusPillSuccess,
                           isCancelled && styles.statusPillDanger,
                           isActive && styles.statusPillActive,
                        ]}>
                           <Text style={[
                              styles.statusText,
                              isCompleted && { color: C.green },
                              isCancelled && { color: C.red },
                              isActive && { color: C.ink },
                           ]}>
                              {isCompleted ? 'COMPLETADO' : isCancelled ? 'CANCELADO' : 'ACTIVO'}
                           </Text>
                        </View>
                     </View>

                     <View style={styles.customerBlock}>
                        <View style={styles.customerRow}>
                           <User size={13} color={C.mute} />
                           <Text style={styles.customerName} numberOfLines={1}>
                              {item.customerName || 'Cliente'}
                           </Text>
                           <Text style={styles.customerPhone} numberOfLines={1}>
                              {item.customerPhone || 'Sin teléfono'}
                           </Text>
                        </View>
                        <Text style={styles.sellerText} numberOfLines={1}>
                           Vendedor: {item.sellerName || '—'} · Vence: {formatDate(item.dueDate)}
                        </Text>
                     </View>

                     <View style={styles.progressBlock}>
                        <View style={styles.progressLabels}>
                           <Text style={styles.progressLabel}>
                              Abonado ${safeFixed(item.totalPaid)} de ${safeFixed(item.totalAmount)}
                           </Text>
                           <Text style={styles.progressPercent}>{progressPercent}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                           <View
                              style={[
                                 styles.progressFill,
                                 { width: `${progressPercent}%` },
                                 isCompleted && { backgroundColor: C.green },
                                 isCancelled && { backgroundColor: C.red },
                              ]}
                           />
                        </View>
                     </View>

                     <View style={styles.miniMetricsRow}>
                        <View style={styles.miniMetric}>
                           <Text style={styles.miniMetricLabel}>Total</Text>
                           <Text style={styles.miniMetricValue}>${safeFixed(item.totalAmount)}</Text>
                        </View>
                        <View style={styles.miniMetric}>
                           <Text style={styles.miniMetricLabel}>Abonado</Text>
                           <Text style={[styles.miniMetricValue, { color: C.green }]}>
                              ${safeFixed(item.totalPaid)}
                           </Text>
                        </View>
                        <View style={styles.miniMetric}>
                           <Text style={styles.miniMetricLabel}>Pendiente</Text>
                           <Text style={[
                              styles.miniMetricValue,
                              { color: isCompleted ? C.green : C.red },
                           ]}>
                              ${safeFixed(item.balanceRemaining)}
                           </Text>
                        </View>
                     </View>

                     <View style={styles.cardActions}>
                        {isActive && (
                           <P
                              style={[styles.actionBtn, styles.actionPrimary]}
                              onPress={(e: any) => {
                                 e?.stopPropagation?.();
                                 setSelectedLayaway(item);
                                 setIsPaymentModalOpen(true);
                              }}
                           >
                              <CreditCard size={13} color={C.onSolid} />
                              <Text style={styles.actionPrimaryText}>Abonar</Text>
                           </P>
                        )}

                        {isCompleted && (
                           <P
                              style={[styles.actionBtn, styles.actionGhost]}
                              onPress={(e: any) => {
                                 e?.stopPropagation?.();
                                 void handleViewOrOfficializeSale(item);
                              }}
                              disabled={isProcessing}
                           >
                              <Receipt size={13} color={C.ink} />
                              <Text style={styles.actionGhostText}>
                                 {item.saleId ? 'Ver recibo' : 'Oficializar'}
                              </Text>
                           </P>
                        )}

                        {isActive && (
                           <P
                              style={[styles.actionBtn, styles.actionDanger]}
                              onPress={(e: any) => {
                                 e?.stopPropagation?.();
                                 void handleCancelLayaway(item);
                              }}
                           >
                              <XCircle size={13} color={C.red} />
                              <Text style={styles.actionDangerText}>Cancelar</Text>
                           </P>
                        )}

                        <P
                           style={styles.iconBtn}
                           onPress={(e: any) => {
                              e?.stopPropagation?.();
                              handleSendReminderWA(item);
                           }}
                        >
                           <MessageCircle size={15} color={C.green} />
                        </P>
                     </View>
                  </P>
               );
            }}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBox}>
                     <Clock size={30} color={C.mute} />
                  </View>
                  <Text style={styles.emptyTitle}>No hay apartados registrados</Text>
                  <Text style={styles.emptySubtitle}>
                     Crea un nuevo apartado para reservar prendas del stock y recibir abonos.
                  </Text>
               </View>
            }
         />

         {/* DETALLE DEL APARTADO */}
         <Modal visible={!!selectedLayaway && !isPaymentModalOpen} transparent animationType="slide">
            {selectedLayaway && (
               <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                     <View style={styles.modalHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                           <Text style={styles.modalTitle} numberOfLines={1}>
                              Apartado #{selectedLayaway.code}
                           </Text>
                           <Text style={styles.modalSubtitle} numberOfLines={1}>
                              {selectedLayaway.status === 'active'
                                 ? 'En curso · abonos habilitados'
                                 : selectedLayaway.status === 'completed'
                                    ? 'Completado y entregado'
                                    : 'Cancelado'}
                           </Text>
                        </View>
                        <P onPress={() => setSelectedLayaway(null)} style={styles.closeBtn}>
                           <X size={18} color={C.ink} />
                        </P>
                     </View>

                     <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16 }}>
                        <View style={styles.summaryBox}>
                           <Text style={styles.summaryLabel}>Cliente</Text>
                           <Text style={styles.summaryValue}>{selectedLayaway.customerName}</Text>
                           <View style={styles.summaryDivider} />
                           <View style={styles.summaryRow}>
                              <Text style={styles.summaryMuted}>Teléfono</Text>
                              <Text style={styles.summaryValueSmall}>{selectedLayaway.customerPhone}</Text>
                           </View>
                           <View style={styles.summaryRow}>
                              <Text style={styles.summaryMuted}>Vendedor</Text>
                              <Text style={styles.summaryValueSmall}>{selectedLayaway.sellerName || '—'}</Text>
                           </View>
                           <View style={styles.summaryRow}>
                              <Text style={styles.summaryMuted}>Vence</Text>
                              <Text style={styles.summaryValueSmall}>{formatDate(selectedLayaway.dueDate)}</Text>
                           </View>
                           {selectedLayaway.saleReceiptNumber ? (
                              <View style={styles.summaryRow}>
                                 <Text style={styles.summaryMuted}>Venta oficial</Text>
                                 <Text style={[styles.summaryValueSmall, { color: C.green }]}>
                                    {selectedLayaway.saleReceiptNumber}
                                 </Text>
                              </View>
                           ) : null}
                        </View>

                        <View style={styles.progressBlock}>
                           <View style={styles.progressLabels}>
                              <Text style={styles.progressLabel}>
                                 Abonado ${safeFixed(selectedLayaway.totalPaid)} de ${safeFixed(selectedLayaway.totalAmount)}
                              </Text>
                              <Text style={styles.progressPercent}>
                                 {selectedLayaway.totalAmount > 0
                                    ? Math.min(100, Math.round((selectedLayaway.totalPaid / selectedLayaway.totalAmount) * 100))
                                    : 0}%
                              </Text>
                           </View>
                           <View style={styles.progressTrack}>
                              <View
                                 style={[
                                    styles.progressFill,
                                    {
                                       width: `${selectedLayaway.totalAmount > 0
                                          ? Math.min(100, Math.round((selectedLayaway.totalPaid / selectedLayaway.totalAmount) * 100))
                                          : 0}%`,
                                    },
                                 ]}
                              />
                           </View>
                        </View>

                        <Text style={styles.sectionTitle}>Prendas reservadas</Text>
                        {(selectedLayaway.items || []).map((i: any, idx: number) => {
                           const product = findProduct(i.productId);
                           const code = i.productCode || product?.code || 'S/N';
                           return (
                              <View key={idx} style={styles.itemRow}>
                                 {renderCartProductImage(i, styles.itemImg)}
                                 <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                       <Text style={styles.itemCode}>[{code}] </Text>
                                       {i.brand || ''} {i.name || ''}
                                    </Text>
                                    <Text style={styles.itemMeta} numberOfLines={1}>
                                       {i.color || '—'} · Talla {i.size || '—'} · {i.quantity || 1} ud.
                                    </Text>
                                    <Text style={styles.itemMeta} numberOfLines={1}>
                                       ${safeFixed(i.unitPrice)} c/u
                                    </Text>
                                 </View>
                                 <Text style={styles.itemPrice}>${safeFixed(i.totalPrice)}</Text>
                              </View>
                           );
                        })}

                        <Text style={styles.sectionTitle}>Historial de abonos</Text>
                        {(selectedLayaway.payments || []).length === 0 ? (
                           <Text style={styles.mutedText}>Aún no hay abonos registrados.</Text>
                        ) : (
                           (selectedLayaway.payments || []).map((p: any, idx: number) => (
                              <View key={idx} style={styles.paymentRow}>
                                 <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.paymentAmount}>
                                       +${safeFixed(p.amount)} · {(p.paymentMethod || '').replace('_', ' ').toUpperCase()}
                                    </Text>
                                    <Text style={styles.paymentMeta} numberOfLines={1}>
                                       {formatDate(p.date, true)} · {p.registeredBy || 'Sistema'}
                                    </Text>
                                 </View>
                                 <ShieldCheck size={15} color={C.green} />
                              </View>
                           ))
                        )}

                        <View style={styles.balanceBox}>
                           <View style={styles.balanceRow}>
                              <Text style={styles.balanceLabel}>Monto total</Text>
                              <Text style={styles.balanceValue}>${safeFixed(selectedLayaway.totalAmount)}</Text>
                           </View>
                           <View style={styles.balanceRow}>
                              <Text style={styles.balanceLabel}>Total abonado</Text>
                              <Text style={[styles.balanceValue, { color: C.green }]}>
                                 ${safeFixed(selectedLayaway.totalPaid)}
                              </Text>
                           </View>
                           <View style={[styles.balanceRow, { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                              <Text style={styles.balancePendingLabel}>SALDO PENDIENTE</Text>
                              <Text style={styles.balancePending}>${safeFixed(selectedLayaway.balanceRemaining)}</Text>
                           </View>
                        </View>
                     </ScrollView>

                     <View style={styles.modalFooter}>
                        {selectedLayaway.status === 'active' && (
                           <P
                              style={[styles.footerBtn, styles.footerPrimary]}
                              onPress={() => setIsPaymentModalOpen(true)}
                           >
                              <CreditCard size={15} color={C.onSolid} />
                              <Text style={styles.footerPrimaryText}>Registrar abono</Text>
                           </P>
                        )}

                        {selectedLayaway.status === 'active' && (
                           <P
                              style={[styles.footerBtn, styles.footerDanger]}
                              onPress={() => void handleCancelLayaway(selectedLayaway)}
                           >
                              <XCircle size={15} color={C.red} />
                              <Text style={styles.footerDangerText}>Anular</Text>
                           </P>
                        )}

                        {selectedLayaway.status === 'completed' && (
                           <P
                              style={[styles.footerBtn, styles.footerGhost, isProcessing && { opacity: 0.6 }]}
                              onPress={() => void handleViewOrOfficializeSale(selectedLayaway)}
                              disabled={isProcessing}
                           >
                              <Receipt size={15} color={C.ink} />
                              <Text style={styles.footerGhostText}>
                                 {isProcessing
                                    ? 'Procesando…'
                                    : selectedLayaway.saleId
                                       ? 'Ver recibo'
                                       : 'Oficializar venta'}
                              </Text>
                           </P>
                        )}
                     </View>
                  </View>
               </View>
            )}
         </Modal>

         {/* ABONO */}
         <Modal visible={isPaymentModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
               <View style={styles.smallModalCard}>
                  <View style={styles.modalHeader}>
                     <View>
                        <Text style={styles.modalTitle}>Registrar abono</Text>
                        <Text style={styles.modalSubtitle}>
                           Saldo: ${safeFixed(selectedLayaway?.balanceRemaining)}
                        </Text>
                     </View>
                     <P onPress={() => setIsPaymentModalOpen(false)} style={styles.closeBtn}>
                        <X size={18} color={C.ink} />
                     </P>
                  </View>

                  <View style={{ padding: 16 }}>
                     <Text style={styles.inputLabel}>Monto a abonar ($)</Text>
                     <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        placeholderTextColor={C.mute}
                        keyboardType="decimal-pad"
                        value={abonoAmount}
                        onChangeText={setAbonoAmount}
                     />

                     <Text style={styles.inputLabel}>Método de pago</Text>
                     <View style={styles.methodRow}>
                        {['efectivo', 'pago_movil', 'punto', 'transferencia', 'binance'].map((m) => (
                           <P
                              key={m}
                              style={[styles.methodChip, abonoMethod === m && styles.methodChipOn]}
                              onPress={() => setAbonoMethod(m as any)}
                           >
                              <Text style={[styles.methodText, abonoMethod === m && styles.methodTextOn]}>
                                 {m.replace('_', ' ').toUpperCase()}
                              </Text>
                           </P>
                        ))}
                     </View>

                     <Text style={styles.inputLabel}>Nota (opcional)</Text>
                     <TextInput
                        style={styles.input}
                        placeholder="Referencia o nota del abono"
                        placeholderTextColor={C.mute}
                        value={abonoNotes}
                        onChangeText={setAbonoNotes}
                     />

                     <P
                        style={[styles.saveBtn, isProcessing && { opacity: 0.6 }]}
                        onPress={handleSaveAbono}
                        disabled={isProcessing}
                     >
                        <Text style={styles.saveBtnText}>
                           {isProcessing ? 'Procesando…' : 'Confirmar abono'}
                        </Text>
                     </P>
                  </View>
               </View>
            </View>
         </Modal>

         {/* NUEVO APARTADO */}
         <Modal visible={isNewModalOpen} transparent animationType="slide">
            <View style={styles.modalOverlay}>
               <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                     <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.modalTitle}>Nuevo Apartado</Text>
                        <Text style={styles.modalSubtitle}>Reserva stock y registra el abono inicial</Text>
                     </View>
                     <P onPress={() => setIsNewModalOpen(false)} style={styles.closeBtn}>
                        <X size={18} color={C.ink} />
                     </P>
                  </View>

                  <ScrollView
                     style={styles.modalScroll}
                     contentContainerStyle={{ padding: 16 }}
                     keyboardShouldPersistTaps="handled"
                     nestedScrollEnabled
                  >
                     <Text style={styles.sectionTitleFirst}>Datos del cliente</Text>
                     <View style={styles.formRow}>
                        <View style={{ flex: 1.4 }}>
                           <Text style={styles.inputLabel}>Nombre *</Text>
                           <TextInput
                              style={styles.input}
                              placeholder="Ej. Juan Pérez"
                              placeholderTextColor={C.mute}
                              value={customerName}
                              onChangeText={setCustomerName}
                           />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.inputLabel}>Teléfono *</Text>
                           <TextInput
                              style={styles.input}
                              placeholder="+58 412..."
                              placeholderTextColor={C.mute}
                              keyboardType="phone-pad"
                              value={customerPhone}
                              onChangeText={setCustomerPhone}
                           />
                        </View>
                     </View>

                     <View style={styles.formRow}>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.inputLabel}>Días para vencer</Text>
                           <TextInput
                              style={styles.input}
                              placeholder="15"
                              placeholderTextColor={C.mute}
                              keyboardType="numeric"
                              value={daysToDue}
                              onChangeText={setDaysToDue}
                           />
                        </View>
                        <View style={{ flex: 2 }} />
                     </View>

                     <Text style={styles.sectionTitle}>Seleccionar prendas</Text>
                     <View style={styles.pickerSearchBar}>
                        <Search size={15} color={C.mute} />
                        <TextInput
                           style={styles.pickerSearchInput}
                           placeholder="Buscar por nombre, marca o código..."
                           placeholderTextColor={C.mute}
                           value={productSearch}
                           onChangeText={setProductSearch}
                        />
                        {productSearch ? (
                           <P onPress={() => setProductSearch('')} style={styles.clearBtn}>
                              <X size={14} color={C.mute} />
                           </P>
                        ) : null}
                     </View>

                     <View style={styles.productListBox}>
                        {availableProducts.length === 0 ? (
                           <Text style={styles.emptyPickerText}>
                              No se encontraron prendas con stock disponible.
                           </Text>
                        ) : (
                           availableProducts.map((product) => {
                              const isSelected =
                                 (selectedCatalogProduct?.id || selectedCatalogProduct?.code) ===
                                 (product.id || product.code);
                              const variants = (product.variants || []).filter((variant) =>
                                 (variant.sizes || []).some((size) => Number(size.stock) > 0)
                              );
                              const variant = variants.find((v) => v.color === selectedColor);

                              return (
                                 <View
                                    key={product.id || product.code}
                                    style={[styles.productCard, isSelected && styles.productCardOn]}
                                 >
                                    <P
                                       style={styles.productCardTop}
                                       onPress={() => handleSelectProduct(product)}
                                    >
                                       {renderProductImage(product, styles.productImg)}
                                       <View style={{ flex: 1, minWidth: 0 }}>
                                          <Text style={styles.productBrand} numberOfLines={1}>
                                             {product.brand || 'Genérico'}
                                          </Text>
                                          <Text style={styles.productName} numberOfLines={2}>
                                             <Text style={styles.productCode}>[{product.code || 'S/N'}] </Text>
                                             {product.name}
                                          </Text>
                                          <Text style={styles.productMeta} numberOfLines={1}>
                                             {product.category || 'Prenda'} · Stock total {totalProductStock(product)}
                                          </Text>
                                       </View>
                                       <View style={styles.priceColumn}>
                                          <Text style={styles.productPrice}>${safeFixed(product.price)}</Text>
                                          <Text style={styles.productPriceHint}>Precio</Text>
                                       </View>
                                    </P>

                                    {isSelected && (
                                       <View style={styles.selectedPanel}>
                                          <Text style={styles.subLabel}>Color</Text>
                                          <ScrollView
                                             horizontal
                                             showsHorizontalScrollIndicator={false}
                                             contentContainerStyle={styles.chipsRow}
                                          >
                                             {variants.map((v) => (
                                                <P
                                                   key={v.color}
                                                   style={[
                                                      styles.colorChip,
                                                      selectedColor === v.color && styles.colorChipOn,
                                                   ]}
                                                   onPress={() => {
                                                      setSelectedColor(v.color);
                                                      const nextSize =
                                                         (v.sizes || []).find((s) => Number(s.stock) > 0)?.size || '';
                                                      setSelectedSize(nextSize);
                                                   }}
                                                >
                                                   <View
                                                      style={[
                                                         styles.colorSwatch,
                                                         { backgroundColor: (v as any).colorHex || '#525252' },
                                                      ]}
                                                   />
                                                   <Text
                                                      style={[
                                                         styles.colorChipText,
                                                         selectedColor === v.color && styles.colorChipTextOn,
                                                      ]}
                                                   >
                                                      {v.color}
                                                   </Text>
                                                </P>
                                             ))}
                                          </ScrollView>

                                          <Text style={[styles.subLabel, { marginTop: 8 }]}>Talla / stock</Text>
                                          <ScrollView
                                             horizontal
                                             showsHorizontalScrollIndicator={false}
                                             contentContainerStyle={styles.chipsRow}
                                          >
                                             {(variant?.sizes || []).map((size) => {
                                                const stock = Number(size.stock) || 0;
                                                const disabled = stock <= 0;
                                                return (
                                                   <P
                                                      key={size.size}
                                                      disabled={disabled}
                                                      style={[
                                                         styles.sizeChip,
                                                         selectedSize === size.size && styles.sizeChipOn,
                                                         disabled && styles.chipDisabled,
                                                      ]}
                                                      onPress={() => setSelectedSize(size.size)}
                                                   >
                                                      <Text
                                                         style={[
                                                            styles.sizeChipText,
                                                            selectedSize === size.size && styles.sizeChipTextOn,
                                                            disabled && styles.chipTextDisabled,
                                                         ]}
                                                      >
                                                         {size.size} ({stock})
                                                      </Text>
                                                   </P>
                                                );
                                             })}
                                          </ScrollView>

                                          <View style={styles.selectedFooter}>
                                             <View>
                                                <Text style={styles.selectedStock}>
                                                   Disponible: {selectedSizeStock} · En carrito: {selectedInCart}
                                                </Text>
                                                <Text style={styles.selectedHint}>
                                                   {selectedColor || 'Color'} · Talla {selectedSize || '—'}
                                                </Text>
                                             </View>
                                             <P
                                                style={[
                                                   styles.addCartBtn,
                                                   !canAddSelected && { opacity: 0.4 },
                                                ]}
                                                disabled={!canAddSelected}
                                                onPress={() => {
                                                   if (selectedCatalogProduct) {
                                                      handleAddToCart(
                                                         selectedCatalogProduct,
                                                         selectedColor,
                                                         selectedSize
                                                      );
                                                   }
                                                }}
                                             >
                                                <Plus size={14} color={C.onSolid} />
                                                <Text style={styles.addCartText}>Agregar</Text>
                                             </P>
                                          </View>
                                       </View>
                                    )}
                                 </View>
                              );
                           })
                        )}
                     </View>

                     <Text style={styles.sectionTitle}>Carrito del apartado</Text>
                     {cartItems.length === 0 ? (
                        <View style={styles.cartEmptyBox}>
                           <ShoppingBag size={24} color={C.mute} />
                           <Text style={styles.cartEmptyText}>
                              Agrega prendas para reservar el stock.
                           </Text>
                        </View>
                     ) : (
                        cartItems.map((item: any, idx: number) => {
                           const product = findProduct(item.productId);
                           const code = item.productCode || product?.code || 'S/N';
                           return (
                              <View key={`${item.productId}_${item.color}_${item.size}`} style={styles.cartRow}>
                                 {renderCartProductImage(item, styles.cartImg)}
                                 <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.cartName} numberOfLines={2}>
                                       <Text style={styles.cartCode}>[{code}] </Text>
                                       {item.name}
                                    </Text>
                                    <Text style={styles.cartMeta} numberOfLines={1}>
                                       {item.color} · Talla {item.size} · ${safeFixed(item.unitPrice)} c/u
                                    </Text>
                                 </View>

                                 <View style={styles.qtyControls}>
                                    <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, -1)}>
                                       <Minus size={12} color={C.ink} />
                                    </P>
                                    <Text style={styles.qtyText}>{item.quantity}</Text>
                                    <P style={styles.qtyBtn} onPress={() => updateCartQuantity(idx, 1)}>
                                       <Plus size={12} color={C.ink} />
                                    </P>
                                 </View>

                                 <Text style={styles.cartSubtotal}>${safeFixed(item.totalPrice)}</Text>

                                 <P style={styles.cartDeleteBtn} onPress={() => removeCartItem(idx)}>
                                    <Trash2 size={13} color={C.mute} />
                                 </P>
                              </View>
                           );
                        })
                     )}

                     <View style={styles.cartTotals}>
                        <View style={styles.totalRow}>
                           <Text style={styles.totalLabel}>Subtotal ({cartItems.length} línea(s))</Text>
                           <Text style={styles.totalValue}>${safeFixed(cartSubtotal)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                           <Text style={styles.totalLabel}>Abono inicial</Text>
                           <Text style={[styles.totalValue, { color: C.green }]}>
                              -${safeFixed(Math.min(initialPaymentValue, cartSubtotal))}
                           </Text>
                        </View>
                        <View style={[styles.totalRow, { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                           <Text style={styles.totalMainLabel}>Saldo pendiente</Text>
                           <Text style={styles.totalMainValue}>${safeFixed(cartBalance)}</Text>
                        </View>
                     </View>

                     <Text style={styles.inputLabel}>Abono inicial ($)</Text>
                     <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        placeholderTextColor={C.mute}
                        keyboardType="decimal-pad"
                        value={initialPayment}
                        onChangeText={setInitialPayment}
                     />

                     <Text style={styles.inputLabel}>Método del abono inicial</Text>
                     <View style={styles.methodRow}>
                        {['efectivo', 'pago_movil', 'punto', 'transferencia', 'binance'].map((m) => (
                           <P
                              key={m}
                              style={[styles.methodChip, paymentMethod === m && styles.methodChipOn]}
                              onPress={() => setPaymentMethod(m as any)}
                           >
                              <Text style={[styles.methodText, paymentMethod === m && styles.methodTextOn]}>
                                 {m.replace('_', ' ').toUpperCase()}
                              </Text>
                           </P>
                        ))}
                     </View>
                  </ScrollView>

                  <View style={styles.modalFooter}>
                     <P
                        style={[styles.saveBtn, isProcessing && { opacity: 0.6 }]}
                        onPress={handleSaveLayaway}
                        disabled={isProcessing}
                     >
                        <CheckCircle2 size={16} color={C.onSolid} />
                        <Text style={styles.saveBtnText}>
                           {isProcessing ? 'Reservando stock…' : 'Guardar y reservar stock'}
                        </Text>
                     </P>
                  </View>
               </View>
            </View>
         </Modal>

         <SaleReceiptModal
            sale={receiptSale}
            visible={!!receiptSale}
            onClose={() => setReceiptSale(null)}
         />
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: C.bg },
   pressed: { transform: [{ scale: 0.98 }], opacity: 0.88 },
   imageFallback: { backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },

   header: {
      backgroundColor: C.bg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingBottom: 12,
   },
   headerInner: {
      width: '100%',
      maxWidth: MAX,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
   },
   headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 },
   headerIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
   },
   headerTitle: {
      ...display,
      fontSize: 28,
      lineHeight: 28,
      fontWeight: '800',
      color: C.ink,
      textTransform: 'uppercase',
   },
   headerSubtitle: { fontSize: 12, color: C.mute, marginTop: 3 },
   newLayawayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.solid,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
   },
   newLayawayBtnText: { color: C.onSolid, fontSize: 12, fontWeight: '800' },

   metricsRow: {
      width: '100%',
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 18,
   },
   metricCard: {
      flex: 1,
      minWidth: 92,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
   },
   metricLabel: {
      fontSize: 9,
      color: C.mute,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   metricValue: { ...display, fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 2 },

   filterSection: {
      backgroundColor: C.bg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      width: '100%',
   },
   filterInner: {
      width: '100%',
      maxWidth: MAX,
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 10,
   },
   searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 46,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
   },
   searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      color: C.ink,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   clearBtn: { padding: 4 },
   chipsRow: { flexDirection: 'row', gap: 6, paddingTop: 10, paddingBottom: 2 },
   chip: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
   },
   chipOn: { backgroundColor: C.solid, borderColor: C.solid },
   chipText: { fontSize: 11, color: C.soft, fontWeight: '700' },
   chipTextOn: { color: C.onSolid, fontWeight: '800' },

   listContent: {
      width: '100%',
      maxWidth: MAX,
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 80,
   },
   gridRow: { gap: 12 },
   layawayCard: {
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
   },
   layawayCardGrid: { flex: 1 },
   cardCompleted: { borderColor: C.greenBorder },
   cardCancelled: { borderColor: C.redBorder, opacity: 0.78 },
   cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
   codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
   codeIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
   },
   layawayCode: { ...display, fontSize: 20, fontWeight: '800', color: C.ink },
   statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
   },
   statusPillActive: { backgroundColor: C.bg, borderColor: C.border },
   statusPillSuccess: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
   statusPillDanger: { backgroundColor: C.redBg, borderColor: C.redBorder },
   statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

   customerBlock: { marginTop: 10, gap: 3 },
   customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
   customerName: { fontSize: 13, fontWeight: '700', color: C.ink, flexShrink: 1 },
   customerPhone: { fontSize: 11, color: C.mute },
   sellerText: { fontSize: 11, color: C.mute },

   progressBlock: { marginTop: 12 },
   progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
   progressLabel: { fontSize: 11, color: C.soft, fontWeight: '600' },
   progressPercent: { ...display, fontSize: 14, fontWeight: '800', color: C.ink },
   progressTrack: { height: 8, backgroundColor: C.cardAlt, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
   progressFill: { height: '100%', backgroundColor: C.soft, borderRadius: 4 },

   miniMetricsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
   miniMetric: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
   },
   miniMetricLabel: { fontSize: 9, color: C.mute, fontWeight: '800', textTransform: 'uppercase' },
   miniMetricValue: { ...display, fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 2 },

   cardActions: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      flexWrap: 'wrap',
   },
   actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
   },
   actionPrimary: { backgroundColor: C.solid, borderColor: C.solid, flex: 1 },
   actionPrimaryText: { fontSize: 11, fontWeight: '800', color: C.onSolid },
   actionGhost: { backgroundColor: C.bg, borderColor: C.border, flex: 1 },
   actionGhostText: { fontSize: 11, fontWeight: '800', color: C.ink },
   actionDanger: { backgroundColor: C.redBg, borderColor: C.redBorder },
   actionDangerText: { fontSize: 11, fontWeight: '800', color: C.red },
   iconBtn: {
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
   },

   emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
   emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
   },
   emptyTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
   emptySubtitle: { fontSize: 12, color: C.mute, textAlign: 'center', maxWidth: 300, lineHeight: 18 },

   modalOverlay: {
      flex: 1,
      backgroundColor: C.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
   },
   modalCard: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '92%',
      backgroundColor: C.bg,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
   },
   smallModalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: C.bg,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
   },
   modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 16,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
   },
   modalTitle: { ...display, fontSize: 22, fontWeight: '800', color: C.ink, textTransform: 'uppercase' },
   modalSubtitle: { fontSize: 11, color: C.mute, marginTop: 3 },
   closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
   },
   modalScroll: { flex: 1 },

   summaryBox: {
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
   },
   summaryLabel: { fontSize: 9, color: C.mute, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
   summaryValue: { ...display, fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 2 },
   summaryDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
   summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 2 },
   summaryMuted: { fontSize: 11, color: C.mute },
   summaryValueSmall: { fontSize: 12, color: C.soft, fontWeight: '700', flexShrink: 1, textAlign: 'right' },

   sectionTitle: {
      ...display,
      fontSize: 16,
      fontWeight: '800',
      color: C.ink,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
   },
   sectionTitleFirst: {
      ...display,
      fontSize: 16,
      fontWeight: '800',
      color: C.ink,
      textTransform: 'uppercase',
      marginBottom: 8,
   },
   itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
   },
   itemImg: { width: 44, height: 56, borderRadius: 6, backgroundColor: C.cardAlt },
   itemName: { fontSize: 13, fontWeight: '700', color: C.ink },
   itemCode: { fontSize: 11, fontWeight: '800', color: C.purple },
   itemMeta: { fontSize: 10, color: C.mute, marginTop: 2 },
   itemPrice: { ...display, fontSize: 15, fontWeight: '800', color: C.ink },

   paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      marginBottom: 6,
   },
   paymentAmount: { fontSize: 12, fontWeight: '800', color: C.green },
   paymentMeta: { fontSize: 10, color: C.mute, marginTop: 2 },
   mutedText: { fontSize: 12, color: C.mute, fontStyle: 'italic' },

   balanceBox: {
      marginTop: 12,
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
   },
   balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
   balanceLabel: { fontSize: 11, color: C.mute },
   balanceValue: { fontSize: 12, color: C.ink, fontWeight: '800' },
   balancePendingLabel: { fontSize: 11, color: C.soft, fontWeight: '800', textTransform: 'uppercase' },
   balancePending: { ...display, fontSize: 20, fontWeight: '800', color: C.red },

   modalFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 14,
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
   },
   footerBtn: {
      flex: 1,
      minWidth: 140,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
   },
   footerPrimary: { backgroundColor: C.solid, borderColor: C.solid },
   footerPrimaryText: { fontSize: 12, fontWeight: '800', color: C.onSolid },
   footerGhost: { backgroundColor: C.bg, borderColor: C.border },
   footerGhostText: { fontSize: 12, fontWeight: '800', color: C.ink },
   footerDanger: { backgroundColor: C.redBg, borderColor: C.redBorder, flex: 0 },
   footerDangerText: { fontSize: 12, fontWeight: '800', color: C.red },

   inputLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: C.mute,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 6,
   },
   input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      backgroundColor: C.bg,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: C.ink,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   formRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
   methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
   methodChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
   },
   methodChipOn: { backgroundColor: C.solid, borderColor: C.solid },
   methodText: { fontSize: 10, fontWeight: '800', color: C.soft },
   methodTextOn: { color: C.onSolid },

   pickerSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      marginBottom: 8,
   },
   pickerSearchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      color: C.ink,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   productListBox: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      padding: 8,
   },
   productCard: {
      backgroundColor: C.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 6,
      overflow: 'hidden',
   },
   productCardOn: { borderColor: C.ink, backgroundColor: C.card },
   productCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
   productImg: { width: 48, height: 62, borderRadius: 7, backgroundColor: C.cardAlt },
   productBrand: { fontSize: 10, fontWeight: '800', color: C.mute, textTransform: 'uppercase' },
   productName: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 1 },
   productCode: { fontSize: 11, fontWeight: '800', color: C.purple },
   productMeta: { fontSize: 10, color: C.mute, marginTop: 2 },
   priceColumn: { alignItems: 'flex-end', flexShrink: 0 },
   productPrice: { ...display, fontSize: 17, fontWeight: '800', color: C.ink },
   productPriceHint: { fontSize: 9, color: C.mute, textTransform: 'uppercase', fontWeight: '700' },
   emptyPickerText: { fontSize: 12, color: C.mute, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

   selectedPanel: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingHorizontal: 10,
      paddingBottom: 10,
      paddingTop: 8,
   },
   subLabel: { fontSize: 10, fontWeight: '800', color: C.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
   colorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
   },
   colorChipOn: { backgroundColor: C.solid, borderColor: C.solid },
   colorSwatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: C.border },
   colorChipText: { fontSize: 11, fontWeight: '700', color: C.soft },
   colorChipTextOn: { color: C.onSolid, fontWeight: '800' },
   sizeChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
   },
   sizeChipOn: { backgroundColor: C.solid, borderColor: C.solid },
   sizeChipText: { fontSize: 11, fontWeight: '700', color: C.soft },
   sizeChipTextOn: { color: C.onSolid, fontWeight: '800' },
   chipDisabled: { opacity: 0.35 },
   chipTextDisabled: { textDecorationLine: 'line-through' },
   selectedFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
   },
   selectedStock: { fontSize: 10, color: C.soft, fontWeight: '700' },
   selectedHint: { fontSize: 10, color: C.mute, marginTop: 2 },
   addCartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: C.solid,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 8,
   },
   addCartText: { fontSize: 11, fontWeight: '800', color: C.onSolid },

   cartEmptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 22,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
   },
   cartEmptyText: { fontSize: 11, color: C.mute, fontStyle: 'italic' },
   cartRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      marginBottom: 6,
      flexWrap: 'wrap',
   },
   cartImg: { width: 38, height: 48, borderRadius: 6, backgroundColor: C.cardAlt },
   cartName: { fontSize: 12, fontWeight: '700', color: C.ink },
   cartCode: { fontSize: 10, fontWeight: '800', color: C.purple },
   cartMeta: { fontSize: 10, color: C.mute, marginTop: 2 },
   qtyControls: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      backgroundColor: C.bg,
   },
   qtyBtn: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
   qtyText: { ...display, fontSize: 14, fontWeight: '800', color: C.ink, minWidth: 20, textAlign: 'center' },
   cartSubtotal: { ...display, fontSize: 14, fontWeight: '800', color: C.ink, minWidth: 56, textAlign: 'right' },
   cartDeleteBtn: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },

   cartTotals: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
   },
   totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
   totalLabel: { fontSize: 11, color: C.mute },
   totalValue: { fontSize: 13, color: C.ink, fontWeight: '800' },
   totalMainLabel: { fontSize: 11, color: C.soft, fontWeight: '800', textTransform: 'uppercase' },
   totalMainValue: { ...display, fontSize: 22, fontWeight: '800', color: C.ink },

   saveBtn: {
      flex: 1,
      minWidth: 160,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: C.solid,
      borderRadius: 10,
   },
   saveBtnText: { fontSize: 13, fontWeight: '800', color: C.onSolid },
});

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, FlatList, Animated, useWindowDimensions, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Search, MessageCircle, Lock, X, ShoppingBag, SlidersHorizontal, RotateCcw, Check, Tag, ChevronLeft, ChevronRight, Eye, ShoppingCart, Trash2, Plus, Minus, ZoomIn } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';
import { filterProducts, FilterOptions } from '../utils/productFilters';
import { Cover } from '../components/Cover';
import { LIGHT, Tone, display, ease, nd, reduced, useEnter, getColorHex } from '../design';

// ==========================================
// CONFIGURACIÓN DEL COMERCIO
// ==========================================
const STORE_PHONE = '584222630079';

// ==========================================
// CATEGORÍAS FIJAS (Siempre visibles)
// ==========================================
const STATIC_CATEGORIES = [
   'Franelas',
   'Sudaderas',
   'Monos',
   'Shorts',
   'Chaquetas',
   'Camisas',
   'Camisas AAA',
   'Franelillas AAA',
   'Chemises',
   'Conjuntos',
   'Zapatos',
   'Accesorios',
];

interface Props {
   onOpenStaffAccess: () => void;
   logoUri?: string;
}

interface CartItem {
   cartId: string;
   product: Product;
   color: string;
   size: string;
   quantity: number;
   price: number;
   isWholesale: boolean;
}

const GRAY = {
   900: '#121214',
   800: '#18181B',
   700: '#27272A',
   600: '#3F3F46',
   500: '#52525B',
   400: '#71717A',
   300: '#A1A1AA',
   200: '#E4E4E7',
   100: '#F4F4F5',
};

const DEFAULT_LOGO = 'logo.jpg';

const T: Tone = LIGHT;
const MAX = 1400;
const ITEMS_PER_PAGE = 20;

const BRAND_SLUGS: Record<string, string> = {
   nike: 'nike', adidas: 'adidas', puma: 'puma', underarmour: 'underarmour', ua: 'underarmour', reebok: 'reebok',
   jordan: 'airjordan', newbalance: 'newbalance', nb: 'newbalance', champion: 'champion', fila: 'fila', asics: 'asics',
   converse: 'converse', vans: 'vans', uniqlo: 'uniqlo', uq: 'uniqlo', on: 'onrunning', onrunning: 'onrunning',
   umbro: 'umbro', kappa: 'kappa', lotto: 'lotto', oakley: 'oakley', hummel: 'hummel',
};

const getBrandLogoUrl = (brandName: string): string | null => {
   const slug = BRAND_SLUGS[brandName.toLowerCase().replace(/[^a-z0-9]/g, '')];
   return slug ? `https://cdn.simpleicons.org/${slug}/${T.inkMute.slice(1)}` : null;
};

const BrandLogoItem: React.FC<{ brandName: string; isSelected: boolean }> = ({ brandName, isSelected }) => {
   const [hasError, setHasError] = useState(false);
   const logoUrl = getBrandLogoUrl(brandName);

   if (logoUrl && !hasError) {
      return (
         <Image
            source={{ uri: logoUrl }}
            style={styles.brandLogoImg}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
            onError={() => setHasError(true)}
         />
      );
   }
   return (
      <View style={[styles.avatar, isSelected && { backgroundColor: GRAY[700] }]}>
         <Text style={[styles.avatarText, isSelected && { color: '#FFFFFF' }]}>{brandName.charAt(0).toUpperCase()}</Text>
      </View>
   );
};

// Fondo galáctico con constelaciones
const GalaxyBackground = React.memo(() => {
   const stars = useRef(
      Array.from({ length: 28 }).map(() => ({
         top: Math.random() * 100,
         left: Math.random() * 100,
         size: Math.random() * 3 + 1,
         anim: new Animated.Value(Math.random()),
      }))
   ).current;

   useEffect(() => {
      if (reduced()) return;
      const animations = stars.map((star) =>
         Animated.loop(
            Animated.sequence([
               Animated.timing(star.anim, {
                  toValue: 1,
                  duration: 1500 + Math.random() * 2500,
                  easing: ease,
                  useNativeDriver: nd,
               }),
               Animated.timing(star.anim, {
                  toValue: 0.2,
                  duration: 1500 + Math.random() * 2500,
                  easing: ease,
                  useNativeDriver: nd,
               }),
            ])
         )
      );
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
   }, []);

   return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         {stars.map((star, index) => (
            <Animated.View
               key={index}
               style={{
                  position: 'absolute',
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                  backgroundColor: index % 3 === 0 ? GRAY[200] : GRAY[400],
                  opacity: star.anim,
                  shadowColor: '#FFFFFF',
                  shadowOpacity: 0.4,
                  shadowRadius: 3,
               }}
            />
         ))}
      </View>
   );
});

const totalStock = (p: Product) =>
   (p.variants || []).reduce((a, v) => a + (v.sizes || []).reduce((b, s) => b + (Number(s.stock) || 0), 0), 0);

const sizeRun = (p: Product): [string, boolean][] => {
   const m = new Map<string, boolean>();
   (p.variants || []).forEach((v) => (v.sizes || []).forEach((s) => m.set(s.size, !!m.get(s.size) || Number(s.stock) > 0)));
   return Array.from(m.entries());
};

const Chip = ({ label, active, onPress, left }: { label: string; active: boolean; onPress: () => void; left?: React.ReactNode }) => (
   <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      {left}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
   </Pressable>
);

const ActiveChip = ({ onPress, children }: { onPress: () => void; children: React.ReactNode }) => (
   <Pressable style={styles.activeChip} onPress={onPress}>
      {children}
      <X size={12} color="#FFFFFF" />
   </Pressable>
);

const ProductCard = React.memo(({ item, width, compact, onOpen, onZoom }: { item: Product; width: number; compact: boolean; onOpen: (p: Product) => void; onZoom: (uri: string, name: string) => void }) => {
   const stock = totalStock(item);
   const out = stock === 0;
   const low = stock > 0 && stock <= 3;
   const variants = item.variants || [];
   const run = sizeRun(item).slice(0, 6);
   const mainImgUri = item.images?.[0];
   const retailPrice = Number(item.price || 0);

   return (
      <View style={{ width }}>
         <Pressable style={({ pressed }) => [styles.photo, pressed && styles.pressedCard]} onPress={() => mainImgUri && onZoom(mainImgUri, item.name)}>
            <Cover uri={mainImgUri} name={item.name} bg={GRAY[100]} fg={GRAY[300]} style={[styles.cardImg, out && { opacity: 0.45 }]} />

            {(out || low) && (
               <View style={[styles.badge, out ? { backgroundColor: GRAY[900] } : { backgroundColor: GRAY[700] }]}>
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{out ? 'Agotado' : 'Últimas unidades'}</Text>
               </View>
            )}

            {variants.length > 0 && (
               <View style={styles.swatches}>
                  {variants.slice(0, 4).map((vr, i) => (
                     <View key={i} style={[styles.dot, { backgroundColor: getColorHex(vr.color) }]} />
                  ))}
                  {variants.length > 4 && <Text style={styles.dotsMore}>+{variants.length - 4}</Text>}
               </View>
            )}
         </Pressable>

         <View style={styles.meta}>
            <Text style={styles.cardBrand} numberOfLines={1}>{item.brand}</Text>
            <Text style={[styles.cardName, !compact && { fontSize: 15 }]} numberOfLines={2}>{item.name}</Text>

            {retailPrice > 0 && (
               <Text style={styles.cardPrice}>${retailPrice.toFixed(2)}</Text>
            )}

            {run.length > 0 && (
               <View style={styles.sizes}>
                  {run.map(([sz, ok]) => (
                     <View key={sz} style={[styles.sizeBox, ok ? styles.sizeBoxOk : styles.sizeBoxOff]}>
                        <Text style={[styles.sizeBoxText, !ok && styles.sizeOff]}>{sz}</Text>
                     </View>
                  ))}
               </View>
            )}
         </View>

         <View style={styles.actionRow}>
            <Pressable
               style={({ pressed }) => [styles.detailsBtn, pressed && styles.pressed]}
               onPress={() => onOpen(item)}
            >
               <Eye size={16} color="#FFFFFF" />
               <Text style={styles.detailsBtnText}>Detalles</Text>
            </Pressable>
         </View>
      </View>
   );
});

export const PublicCatalogScreen: React.FC<Props> = ({ onOpenStaffAccess, logoUri }) => {
   const [products, setProducts] = useState<Product[]>([]);
   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
   const [detailProduct, setDetailProduct] = useState<Product | null>(null);
   const [selectedImageIndex, setSelectedImageIndex] = useState(0);
   const [searchFocused, setSearchFocused] = useState(false);
   const [currentPage, setCurrentPage] = useState(1);

   const [detailZoomUri, setDetailZoomUri] = useState<string | null>(null);

   const [cart, setCart] = useState<CartItem[]>([]);
   const [isCartModalOpen, setIsCartModalOpen] = useState(false);
   const [selectedColor, setSelectedColor] = useState<string>('');
   const [selectedSize, setSelectedSize] = useState<string>('');
   const [quantity, setQuantity] = useState<number>(1);

   const [filters, setFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });

   const flatListRef = useRef<FlatList>(null);

   useEffect(() => {
      const unsub = subscribeToProducts(setProducts);
      return () => unsub();
   }, []);

   // BACKEND: Solo prendas ubicadas en Bodega/Vitrina
   const validProducts = useMemo(() => {
      return products.reduce((acc: Product[], p) => {
         const validVariants = (p.variants || []).filter((v: any) => v.locations && v.locations.length > 0);
         if (validVariants.length > 0) {
            acc.push({ ...p, variants: validVariants });
         }
         return acc;
      }, []);
   }, [products]);

   // BACKEND: categorías fijas + dinámicas, 'all' al final
   const { categories, brands, colors, sizes } = useMemo(() => {
      const dynamicCats = validProducts.map((p) => p.category).filter(Boolean) as string[];
      const cats = Array.from(new Set([...STATIC_CATEGORIES, ...dynamicCats]));

      return {
         categories: [...cats, 'all'],
         brands: Array.from(new Set(validProducts.map((p) => p.brand).filter(Boolean))),
         colors: Array.from(new Set(validProducts.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean))),
         sizes: Array.from(new Set(validProducts.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))).filter(Boolean))),
      };
   }, [validProducts]);

   const filteredProducts = useMemo(() => filterProducts(validProducts, filters), [validProducts, filters]);

   const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
   const paginatedProducts = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
   }, [filteredProducts, currentPage]);

   useEffect(() => {
      setCurrentPage(1);
   }, [filters]);

   const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
   };

   const activeFiltersCount = (filters.brand ? 1 : 0) + (filters.color ? 1 : 0) + (filters.size ? 1 : 0) + (filters.category !== 'all' ? 1 : 0);
   const handleResetFilters = () => {
      setFilters({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });
      setCurrentPage(1);
   };

   const openDetail = useCallback((p: Product) => {
      setDetailProduct(p);
      setSelectedImageIndex(0);
      setQuantity(1);
      setDetailZoomUri(null);
      const firstVariant = p.variants?.[0];
      if (firstVariant) {
         setSelectedColor(firstVariant.color);
         const firstAvailableSize = firstVariant.sizes?.find((s) => Number(s.stock) > 0)?.size || firstVariant.sizes?.[0]?.size || '';
         setSelectedSize(firstAvailableSize);
      } else {
         setSelectedColor('');
         setSelectedSize('');
      }
   }, []);

   const handleZoomImage = useCallback((uri: string) => {
      setDetailZoomUri(uri);
   }, []);

   const addToCart = (product: Product) => {
      if (!selectedColor || !selectedSize) return;
      const retailPrice = Number(product.price || 0);
      const wholesalePrice = Number((product as any).wholesalePrice || (product as any).priceWholesale || retailPrice * 0.85);
      const isWholesale = quantity >= 12;
      const effectivePrice = isWholesale ? wholesalePrice : retailPrice;

      const newItem: CartItem = {
         cartId: `${product.id || product.code}-${selectedColor}-${selectedSize}`,
         product,
         color: selectedColor,
         size: selectedSize,
         quantity,
         price: effectivePrice,
         isWholesale,
      };

      setCart((prev) => {
         const existingIndex = prev.findIndex((i) => i.cartId === newItem.cartId);
         if (existingIndex > -1) {
            const updated = [...prev];
            const newTotalQty = updated[existingIndex].quantity + quantity;
            const updatedIsWholesale = newTotalQty >= 12;
            updated[existingIndex].quantity = newTotalQty;
            updated[existingIndex].isWholesale = updatedIsWholesale;
            updated[existingIndex].price = updatedIsWholesale ? wholesalePrice : retailPrice;
            return updated;
         }
         return [...prev, newItem];
      });

      setDetailProduct(null);
      setIsCartModalOpen(true);
   };

   const removeFromCart = (cartId: string) => {
      setCart((prev) => prev.filter((i) => i.cartId !== cartId));
   };

   const updateCartQuantity = (cartId: string, delta: number) => {
      setCart((prev) =>
         prev.map((item) => {
            if (item.cartId !== cartId) return item;
            const newQty = Math.max(1, item.quantity + delta);
            const retailPrice = Number(item.product.price || 0);
            const wholesalePrice = Number((item.product as any).wholesalePrice || (item.product as any).priceWholesale || retailPrice * 0.85);
            const isWholesale = newQty >= 12;
            const price = isWholesale ? wholesalePrice : retailPrice;
            return { ...item, quantity: newQty, isWholesale, price };
         })
      );
   };

   // BACKEND: envío al WhatsApp del comercio usando STORE_PHONE + Linking
   const sendWhatsAppCheckout = () => {
      if (cart.length === 0) return;
      let text = `¡Hola! JDSTORE, me interesan los siguientes productos de mi carrito:\n\n`;
      cart.forEach((item, index) => {
         text += `${index + 1}. *${item.product.name}* (Marca: ${item.product.brand}, Código: ${item.product.code})\n`;
         text += `   - Color: ${item.color} | Talla: ${item.size} | Cantidad: ${item.quantity}\n`;
         text += `   - Tipo: ${item.isWholesale ? '✨ Al Mayor (12+ un)' : 'Al Detal'} | Unitario: $${item.price.toFixed(2)} | Subtotal: $${(item.price * item.quantity).toFixed(2)}\n\n`;
      });
      text += `Quedo atento a la disponibilidad y método de pago. ¡Gracias!`;
      const encoded = encodeURIComponent(text);
      const url = `https://wa.me/${STORE_PHONE}?text=${encoded}`;
      Linking.openURL(url).catch(() => alert('Verifica tener WhatsApp instalado.'));
   };

   const { width } = useWindowDimensions();
   const mobile = width < 600;
   const wide = width >= 800;
   const PAD = mobile ? 16 : 28;
   const GAP = mobile ? 12 : 20;
   const inner = Math.min(width, MAX) - PAD * 2;
   const cols = inner >= 1100 ? 5 : inner >= 800 ? 4 : inner >= 560 ? 3 : 2;
   const cardW = Math.floor((inner - GAP * (cols - 1)) / cols);

   const filterAnim = useEnter(isFilterModalOpen, mobile);
   const detailAnim = useEnter(!!detailProduct, mobile);
   const cartAnim = useEnter(isCartModalOpen, mobile);

   const heroPics = useMemo(() => validProducts.filter((p) => p.images?.[0]).slice(0, 3), [validProducts]);
   const reveal = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
   const played = useRef(false);
   useEffect(() => {
      if (heroPics.length === 0 || played.current) return;
      played.current = true;
      if (reduced()) {
         reveal.forEach((v) => v.setValue(1));
         return;
      }
      Animated.stagger(90, reveal.map((v) => Animated.timing(v, { toValue: 1, duration: 520, easing: ease, useNativeDriver: nd }))).start();
   }, [heroPics.length]);

   const categoryChips = categories.map((cat) => (
      <Chip
         key={cat}
         label={cat === 'all' ? 'Todas' : cat}
         active={filters.category === cat}
         onPress={() => setFilters((prev) => ({ ...prev, category: cat }))}
      />
   ));

   const n = filteredProducts.length;
   const titleSize = wide ? styles.titleLg : mobile ? styles.titleSm : styles.titleMd;

   const header = (
      <View>
         <View style={styles.hero}>
            <GalaxyBackground />
            <View style={[styles.inner, wide ? styles.heroWide : styles.heroCol, { paddingHorizontal: PAD }]}>
               <View style={wide ? { flex: 1, paddingRight: 24 } : undefined}>
                  <View style={styles.countPill}>
                     <Text style={styles.countText}>{n} {n === 1 ? 'modelo' : 'modelos'}</Text>
                  </View>
                  <Text style={[styles.title, titleSize]}>JD STORE</Text>
                  <Text style={styles.heroSubtitle}>Sportswear Store</Text>
                  <Text style={styles.heroSub}>Descubre nuestros modelos disponibles</Text>
               </View>

               {heroPics.length > 0 && (
                  <View style={[styles.prints, wide && styles.printsWide]}>
                     {heroPics.map((p, i) => (
                        <Animated.View
                           key={p.id || p.code}
                           style={{
                              flex: 1,
                              marginTop: wide ? [0, 36, 12][i] : [0, 14, 6][i],
                              opacity: reveal[i],
                              transform: [{ translateY: reveal[i].interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
                           }}
                        >
                           <View style={styles.printBack} />
                           <Pressable onPress={() => p.images?.[0] && setDetailZoomUri(p.images[0])} style={({ pressed }) => [styles.printPhoto, pressed && styles.pressedCard]}>
                              <Cover uri={p.images?.[0]} name={p.name} bg={GRAY[700]} fg={GRAY[600]} style={styles.printImg} />
                           </Pressable>
                        </Animated.View>
                     ))}
                  </View>
               )}
            </View>
            <View style={styles.slant} />
         </View>

         <View style={[styles.inner, styles.filters, { paddingHorizontal: PAD }]}>
            <View style={styles.searchRow}>
               <View style={[styles.searchBar, searchFocused && styles.searchFocused]}>
                  <Search size={18} color={GRAY[800]} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar por modelo, marca o código"
                     placeholderTextColor={GRAY[400]}
                     value={filters.query}
                     onChangeText={(text) => setFilters((prev) => ({ ...prev, query: text }))}
                     onFocus={() => setSearchFocused(true)}
                     onBlur={() => setSearchFocused(false)}
                  />
                  {filters.query ? (
                     <Pressable onPress={() => setFilters((prev) => ({ ...prev, query: '' }))}>
                        <X size={18} color={GRAY[400]} />
                     </Pressable>
                  ) : null}
               </View>

               <Pressable style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]} onPress={() => setIsFilterModalOpen(true)}>
                  <SlidersHorizontal size={16} color="#FFFFFF" />
                  {!mobile && <Text style={styles.filterBtnText}>Filtros</Text>}
                  {activeFiltersCount > 0 && (
                     <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                     </View>
                  )}
               </Pressable>
            </View>

            {mobile ? (
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
                  {categoryChips}
               </ScrollView>
            ) : (
               <View style={styles.wrap}>{categoryChips}</View>
            )}

            {activeFiltersCount > 0 && (
               <View style={styles.activeFiltersRow}>
                  <Text style={styles.activeFiltersLabel}>Filtros activos</Text>

                  {filters.brand ? (
                     <ActiveChip onPress={() => setFilters((prev) => ({ ...prev, brand: '' }))}>
                        <Tag size={12} color="#FFFFFF" />
                        <Text style={styles.activeChipText}>{filters.brand}</Text>
                     </ActiveChip>
                  ) : null}

                  {filters.color ? (
                     <ActiveChip onPress={() => setFilters((prev) => ({ ...prev, color: '' }))}>
                        <View style={[styles.smallDot, { backgroundColor: getColorHex(filters.color) }]} />
                        <Text style={styles.activeChipText}>{filters.color}</Text>
                     </ActiveChip>
                  ) : null}

                  {filters.size ? (
                     <ActiveChip onPress={() => setFilters((prev) => ({ ...prev, size: '' }))}>
                        <Text style={styles.activeChipText}>Talla {filters.size}</Text>
                     </ActiveChip>
                  ) : null}

                  <Pressable onPress={handleResetFilters} style={styles.resetBtn}>
                     <RotateCcw size={12} color={GRAY[500]} />
                     <Text style={styles.resetText}>Limpiar</Text>
                  </Pressable>
               </View>
            )}
         </View>
      </View>
   );

   const renderDetail = (p: Product) => {
      const currentImageUri = p.images?.[selectedImageIndex];
      const retailPrice = Number(p.price || 0);
      const wholesalePrice = Number((p as any).wholesalePrice || (p as any).priceWholesale || retailPrice * 0.85);

      const isWholesale = quantity >= 12;
      const activeUnitPrice = isWholesale ? wholesalePrice : retailPrice;

      const gallery = (
         <View style={{ position: 'relative' }}>
            <Pressable onPress={() => currentImageUri && setDetailZoomUri(currentImageUri)}>
               <Cover uri={currentImageUri} name={p.name} bg={GRAY[100]} fg={GRAY[300]} style={wide ? styles.mainImgWide : styles.mainImg} />
               <Pressable
                  style={styles.zoomButtonFloat}
                  onPress={() => currentImageUri && setDetailZoomUri(currentImageUri)}
               >
                  <ZoomIn size={18} color="#FFFFFF" />
               </Pressable>
            </Pressable>
            {p.images && p.images.length > 1 && (
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.thumbs}>
                  {p.images.map((img, idx) => (
                     <Pressable key={idx} onPress={() => setSelectedImageIndex(idx)} style={[styles.thumb, selectedImageIndex === idx && styles.thumbActive]}>
                        <Image
                           source={{ uri: img }}
                           style={{ width: '100%', height: '100%' }}
                           contentFit="cover"
                           cachePolicy="memory-disk"
                           transition={200}
                        />
                     </Pressable>
                  ))}
               </ScrollView>
            )}
         </View>
      );

      const activeVariant = p.variants?.find((v) => v.color === selectedColor) || p.variants?.[0];

      const info = (
         <View style={{ padding: 24 }}>
            <View style={styles.detailHeaderRow}>
               <Text style={styles.detailBrand}>{p.brand}</Text>
               <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>CÓDIGO #{p.code}</Text>
               </View>
            </View>

            <Text style={styles.detailName}>{p.name}</Text>

            <View style={styles.pricesDetailRow}>
               <View style={[styles.priceBoxModal, !isWholesale && styles.priceBoxActive]}>
                  <Text style={styles.priceModalLabel}>Precio Detal (1-11 un)</Text>
                  <Text style={[styles.priceModalValue, !isWholesale && { color: GRAY[900] }]}>${retailPrice.toFixed(2)}</Text>
               </View>
               <View style={[styles.priceBoxModal, styles.wholesaleBoxModal, isWholesale && styles.priceBoxActiveWholesale]}>
                  <Text style={styles.priceModalLabelWholesale}>Precio al Mayor (12+ un)</Text>
                  <Text style={styles.priceModalValueWholesale}>${wholesalePrice.toFixed(2)}</Text>
               </View>
            </View>

            <Text style={styles.priceNoticeText}>
               {isWholesale
                  ? '✨ ¡Precio al mayor aplicado automáticamente (12 o más unidades)!'
                  : `💡 Agrega ${12 - quantity} unidad${12 - quantity === 1 ? '' : 'es'} más para activar el precio al mayor.`}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Selecciona un color</Text>
            <View style={[styles.wrap, { marginTop: 10, marginBottom: 18 }]}>
               {(p.variants || []).map((v) => {
                  const isSel = selectedColor === v.color;
                  return (
                     <Pressable
                        key={v.color}
                        onPress={() => {
                           setSelectedColor(v.color);
                           const firstAvail = v.sizes?.find((s) => Number(s.stock) > 0)?.size || v.sizes?.[0]?.size || '';
                           setSelectedSize(firstAvail);
                        }}
                        style={[styles.colorChipOption, isSel && styles.colorChipOptionActive]}
                     >
                        <View style={[styles.swatch, { backgroundColor: getColorHex(v.color) }]} />
                        <Text style={[styles.colorChipText, isSel && styles.colorChipTextActive]}>{v.color}</Text>
                     </Pressable>
                  );
               })}
            </View>

            <Text style={styles.sectionTitle}>Selecciona una talla</Text>
            <View style={[styles.wrap, { marginTop: 10, marginBottom: 18 }]}>
               {activeVariant?.sizes?.map((s) => {
                  const available = Number(s.stock) > 0;
                  const isSel = selectedSize === s.size;
                  return (
                     <Pressable
                        key={s.size}
                        disabled={!available}
                        onPress={() => setSelectedSize(s.size)}
                        style={[
                           styles.sizeSelectChip,
                           !available && styles.sizeSelectChipDisabled,
                           isSel && styles.sizeSelectChipActive,
                        ]}
                     >
                        <Text style={[styles.sizeSelectText, !available && styles.sizeSelectTextOff, isSel && styles.sizeSelectTextActive]}>
                           {s.size}
                        </Text>
                     </Pressable>
                  );
               })}
            </View>

            <Text style={styles.sectionTitle}>Cantidad y Accesos Rápidos</Text>
            <View style={styles.quantityContainer}>
               <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus size={16} color={GRAY[800]} />
               </Pressable>
               <Text style={styles.qtyText}>{quantity}</Text>
               <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
                  <Plus size={16} color={GRAY[800]} />
               </Pressable>
               <Pressable style={styles.qtyQuickBtn} onPress={() => setQuantity((q) => q + 10)}>
                  <Text style={styles.qtyQuickText}>+10</Text>
               </Pressable>
               <Pressable style={styles.qtyQuickBtnWholesale} onPress={() => setQuantity(12)}>
                  <Text style={styles.qtyQuickTextWholesale}>12 (Al Mayor)</Text>
               </Pressable>
            </View>

            <View style={styles.totalPreviewRow}>
               <Text style={styles.totalPreviewLabel}>Total estimado:</Text>
               <Text style={styles.totalPreviewValue}>${(activeUnitPrice * quantity).toFixed(2)}</Text>
            </View>
         </View>
      );

      const footer = (
         <View style={styles.detailFooter}>
            <Pressable
               style={({ pressed }) => [styles.waMain, pressed && styles.pressed, (!selectedColor || !selectedSize) && { opacity: 0.5 }]}
               disabled={!selectedColor || !selectedSize}
               onPress={() => addToCart(p)}
            >
               <ShoppingCart size={20} color="#FFFFFF" />
               <Text style={styles.waMainText}>Agregar al Carrito</Text>
            </Pressable>
         </View>
      );

      return wide ? (
         <View style={{ flexDirection: 'row', flex: 1 }}>
            <View style={{ width: '48%' }}>{gallery}</View>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
               <ScrollView style={{ flex: 1 }}>{info}</ScrollView>
               {footer}
            </View>
         </View>
      ) : (
         <>
            <ScrollView style={{ backgroundColor: '#FFFFFF' }}>
               {gallery}
               {info}
            </ScrollView>
            {footer}
         </>
      );
   };

   return (
      <View style={styles.container}>
         <View style={styles.bar}>
            <View style={[styles.inner, styles.barRow, { paddingHorizontal: PAD }]}>
               <View style={styles.brandGroup}>
                  <View style={styles.logoContainerLarge}>
                     {(logoUri || DEFAULT_LOGO) ? (
                        <Image
                           source={{ uri: logoUri || DEFAULT_LOGO }}
                           style={styles.barLogoImg}
                           contentFit="cover"
                           cachePolicy="memory-disk"
                           transition={200}
                        />
                     ) : (
                        <View style={styles.logoPlaceholder}>
                           <ShoppingBag size={28} color="#FFFFFF" />
                        </View>
                     )}
                  </View>
                  <Text style={styles.barTitle} numberOfLines={1}>CATALOGO</Text>
               </View>

               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                     style={({ pressed }) => [styles.cartBarBtn, pressed && styles.pressed]}
                     onPress={() => setIsCartModalOpen(true)}
                  >
                     <ShoppingCart size={18} color="#FFFFFF" />
                     {cart.length > 0 && (
                        <View style={styles.cartCountBadge}>
                           <Text style={styles.cartCountBadgeText}>
                              {cart.reduce((a, b) => a + b.quantity, 0)}
                           </Text>
                        </View>
                     )}
                  </Pressable>

                  <Pressable
                     style={({ pressed }) => [styles.staffBtn, pressed && styles.pressed]}
                     onPress={onOpenStaffAccess}
                     accessibilityLabel="Acceso al Personal"
                  >
                     <Lock size={13} color="#FFFFFF" />
                     <Text style={styles.staffText}>Personal</Text>
                  </Pressable>
               </View>
            </View>
         </View>

         <FlatList
            ref={flatListRef}
            key={cols}
            data={paginatedProducts}
            keyExtractor={(item) => item.id || item.code}
            numColumns={cols}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP * 2, paddingHorizontal: PAD, width: '100%', maxWidth: MAX, alignSelf: 'center' }}
            contentContainerStyle={{ paddingBottom: 56 }}
            renderItem={({ item }) => <ProductCard item={item} width={cardW} compact={mobile} onOpen={openDetail} onZoom={handleZoomImage} />}
            ListHeaderComponent={header}
            ListFooterComponent={
               totalPages > 1 ? (
                  <View style={[styles.inner, styles.paginationContainer, { paddingHorizontal: PAD }]}>
                     <Pressable
                        style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                        disabled={currentPage === 1}
                        onPress={() => handlePageChange(Math.max(currentPage - 1, 1))}
                     >
                        <ChevronLeft size={18} color={currentPage === 1 ? GRAY[300] : GRAY[800]} />
                        <Text style={[styles.pageBtnText, currentPage === 1 && { color: GRAY[300] }]}>Anterior</Text>
                     </Pressable>

                     <Text style={styles.pageIndicator}>
                        Página {currentPage} de {totalPages}
                     </Text>

                     <Pressable
                        style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                        disabled={currentPage === totalPages}
                        onPress={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                     >
                        <Text style={[styles.pageBtnText, currentPage === totalPages && { color: GRAY[300] }]}>Siguiente</Text>
                        <ChevronRight size={18} color={currentPage === totalPages ? GRAY[300] : GRAY[800]} />
                     </Pressable>
                  </View>
               ) : null
            }
            ListEmptyComponent={
               <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No se encontraron prendas</Text>
                  <Text style={styles.emptySub}>Prueba cambiando los filtros de marca, color o talla.</Text>
                  {activeFiltersCount > 0 && (
                     <Pressable style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]} onPress={handleResetFilters}>
                        <Text style={styles.waMainText}>Restablecer filtros</Text>
                     </Pressable>
                  )}
               </View>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
         />

         {/* MODAL DE FILTROS */}
         <Modal visible={isFilterModalOpen} transparent animationType="fade">
            <View style={[styles.overlay, mobile && styles.overlaySheet]}>
               <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalOpen(false)} />
               <Animated.View style={[styles.filterCard, mobile && styles.sheetCard, filterAnim]}>
                  <View style={styles.modalHeader}>
                     <Text style={styles.modalTitle}>Filtros</Text>
                     <Pressable onPress={() => setIsFilterModalOpen(false)}>
                        <X size={22} color="#FFFFFF" />
                     </Pressable>
                  </View>

                  <ScrollView style={{ padding: 20 }}>
                     <Text style={styles.sectionTitleModal}>Marcas</Text>
                     <View style={styles.wrap}>
                        {brands.map((b) => (
                           <Chip
                              key={b}
                              label={b}
                              active={filters.brand === b}
                              left={<BrandLogoItem brandName={b} isSelected={filters.brand === b} />}
                              onPress={() => setFilters((p) => ({ ...p, brand: b }))}
                           />
                        ))}
                        <Chip
                           label="Todas"
                           active={!filters.brand}
                           left={<Tag size={14} color={!filters.brand ? '#FFFFFF' : GRAY[400]} />}
                           onPress={() => setFilters((p) => ({ ...p, brand: '' }))}
                        />
                     </View>

                     <Text style={styles.sectionTitleModal}>Colores disponibles</Text>
                     <View style={styles.wrap}>
                        {colors.map((c) => (
                           <Chip
                              key={c}
                              label={c}
                              active={filters.color === c}
                              left={<View style={[styles.swatch, { backgroundColor: getColorHex(c) }]} />}
                              onPress={() => setFilters((p) => ({ ...p, color: c }))}
                           />
                        ))}
                        <Chip label="Todos" active={!filters.color} onPress={() => setFilters((p) => ({ ...p, color: '' }))} />
                     </View>

                     <Text style={styles.sectionTitleModal}>Talla disponible</Text>
                     <View style={styles.wrap}>
                        {sizes.map((s) => (
                           <Chip key={s} label={s} active={filters.size === s} onPress={() => setFilters((p) => ({ ...p, size: s }))} />
                        ))}
                        <Chip label="Todas" active={!filters.size} onPress={() => setFilters((p) => ({ ...p, size: '' }))} />
                     </View>
                  </ScrollView>

                  <View style={styles.filterFooter}>
                     <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]} onPress={handleResetFilters}>
                        <Text style={styles.ghostText}>Limpiar todo</Text>
                     </Pressable>
                     <Pressable style={({ pressed }) => [styles.mainBtn, pressed && styles.pressed]} onPress={() => setIsFilterModalOpen(false)}>
                        <Check size={16} color="#FFFFFF" />
                        <Text style={styles.waMainText}>Ver {n} resultados</Text>
                     </Pressable>
                  </View>
               </Animated.View>
            </View>
         </Modal>

         {/* MODAL FICHA DE PRODUCTO */}
         <Modal visible={!!detailProduct} transparent animationType="fade">
            <View style={[styles.overlay, mobile && styles.overlaySheet]}>
               <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailProduct(null)} />
               {detailProduct && (
                  <Animated.View style={[styles.detailCard, wide && { maxWidth: 940 }, mobile && styles.sheetCard, detailAnim]}>
                     <Pressable style={styles.closeBtn} onPress={() => setDetailProduct(null)}>
                        <X size={20} color="#FFFFFF" />
                     </Pressable>
                     {renderDetail(detailProduct)}
                  </Animated.View>
               )}
            </View>
         </Modal>

         {/* MODAL LIGHTBOX / ZOOM */}
         <Modal visible={!!detailZoomUri} transparent animationType="fade">
            <View style={styles.lightboxOverlay}>
               <Pressable style={styles.lightboxCloseBtn} onPress={() => setDetailZoomUri(null)}>
                  <X size={28} color="#FFFFFF" />
               </Pressable>
               {detailZoomUri && (
                  <Image
                     source={{ uri: detailZoomUri }}
                     style={styles.lightboxImage}
                     contentFit="contain"
                     cachePolicy="memory-disk"
                     transition={200}
                  />
               )}
            </View>
         </Modal>

         {/* MODAL CARRITO */}
         <Modal visible={isCartModalOpen} transparent animationType="fade">
            <View style={[styles.overlay, mobile && styles.overlaySheet]}>
               <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsCartModalOpen(false)} />
               <Animated.View style={[styles.filterCard, mobile && styles.sheetCard, cartAnim]}>
                  <View style={styles.modalHeader}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ShoppingCart size={22} color="#FFFFFF" />
                        <Text style={styles.modalTitle}>Tu Carrito ({cart.reduce((a, b) => a + b.quantity, 0)} productos)</Text>
                     </View>
                     <Pressable onPress={() => setIsCartModalOpen(false)}>
                        <X size={22} color="#FFFFFF" />
                     </Pressable>
                  </View>

                  <ScrollView style={{ padding: 20, maxHeight: 400 }}>
                     {cart.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                           <ShoppingCart size={48} color={GRAY[300]} />
                           <Text style={[styles.emptyTitle, { fontSize: 20, marginTop: 12 }]}>Tu carrito está vacío</Text>
                           <Text style={styles.emptySub}>Selecciona prendas y añádelas desde los detalles.</Text>
                        </View>
                     ) : (
                        <View style={{ gap: 12 }}>
                           {cart.map((item) => (
                              <View key={item.cartId} style={styles.cartItemRow}>
                                 <Image
                                    source={{ uri: item.product.images?.[0] }}
                                    style={styles.cartItemImg}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                    transition={200}
                                 />
                                 <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.cartItemBrand}>{item.product.brand}</Text>
                                    <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                                    <Text style={styles.cartItemSpecs}>Color: {item.color} | Talla: {item.size}</Text>

                                    <View style={[styles.cartBadgeTag, item.isWholesale ? styles.cartBadgeWholesale : styles.cartBadgeRetail]}>
                                       <Text style={[styles.cartBadgeText, item.isWholesale && { color: '#047857' }]}>
                                          {item.isWholesale ? '✨ PRECIO AL MAYOR (12+ un)' : 'PRECIO AL DETAL (1-11 un)'}
                                       </Text>
                                    </View>

                                    <View style={styles.cartItemBottomRow}>
                                       <View style={styles.cartQtyControl}>
                                          <Pressable style={styles.cartQtyBtn} onPress={() => updateCartQuantity(item.cartId, -1)}>
                                             <Minus size={12} color={GRAY[800]} />
                                          </Pressable>
                                          <Text style={styles.cartQtyNumber}>{item.quantity}</Text>
                                          <Pressable style={styles.cartQtyBtn} onPress={() => updateCartQuantity(item.cartId, 1)}>
                                             <Plus size={12} color={GRAY[800]} />
                                          </Pressable>
                                       </View>
                                       <Text style={styles.cartItemPrice}>${(item.price * item.quantity).toFixed(2)} (${item.price.toFixed(2)} c/u)</Text>
                                    </View>
                                 </View>
                                 <Pressable onPress={() => removeFromCart(item.cartId)} style={styles.cartDeleteBtn}>
                                    <Trash2 size={16} color={GRAY[500]} />
                                 </Pressable>
                              </View>
                           ))}
                        </View>
                     )}
                  </ScrollView>

                  {cart.length > 0 && (
                     <View style={styles.filterFooter}>
                        <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]} onPress={() => setCart([])}>
                           <Text style={styles.ghostText}>Vaciar carrito</Text>
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.mainBtn, pressed && styles.pressed]} onPress={sendWhatsAppCheckout}>
                           <MessageCircle size={18} color="#FFFFFF" />
                           <Text style={styles.waMainText}>Pedir por WhatsApp</Text>
                        </Pressable>
                     </View>
                  )}
               </Animated.View>
            </View>
         </Modal>
      </View>
   );
};

const modalBase = { width: '100%' as const, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' as const };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: GRAY[100] },
   inner: { width: '100%', maxWidth: MAX, alignSelf: 'center' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
   pressedCard: { transform: [{ scale: 0.98 }] },
   wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

   bar: { backgroundColor: GRAY[900], paddingVertical: 12 },
   barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
   brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },

   logoContainerLarge: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: GRAY[800], justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: GRAY[600] },
   barLogoImg: { width: '100%', height: '100%' },
   logoPlaceholder: { width: '100%', height: '100%', backgroundColor: GRAY[800], justifyContent: 'center', alignItems: 'center' },

   barTitle: { ...display, fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
   staffBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 999 },
   staffText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

   cartBarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: GRAY[800], justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: GRAY[600] },
   cartCountBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: GRAY[600], minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
   cartCountBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

   hero: { backgroundColor: GRAY[900], overflow: 'hidden', paddingTop: 32, paddingBottom: 64 },
   heroWide: { flexDirection: 'row', alignItems: 'center' },
   heroCol: { gap: 28 },
   countPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 14 },
   countText: { fontSize: 13, fontWeight: '700', color: GRAY[300] },
   title: { ...display, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },

   heroSubtitle: { ...display, fontSize: 32, fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 6 },

   titleSm: { fontSize: 60, lineHeight: 56 },
   titleMd: { fontSize: 96, lineHeight: 88 },
   titleLg: { fontSize: 132, lineHeight: 118 },
   heroSub: { fontSize: 17, color: GRAY[300], marginTop: 14, maxWidth: 380 },
   prints: { flexDirection: 'row', gap: 16, paddingRight: 10, alignItems: 'flex-start' },
   printsWide: { width: '46%' },
   printBack: { position: 'absolute', top: 10, left: 10, right: -10, bottom: -10, backgroundColor: GRAY[700], borderRadius: 12 },
   printPhoto: { borderRadius: 12, overflow: 'hidden' },
   printImg: { width: '100%', aspectRatio: 3 / 4 },
   slant: { position: 'absolute', left: -30, right: -30, bottom: -34, height: 64, backgroundColor: GRAY[100], transform: [{ rotate: '-1.4deg' }] },

   filters: { gap: 14, marginBottom: 24 },
   searchRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
   searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderBottomWidth: 2, borderBottomColor: GRAY[800] },
   searchFocused: { borderBottomColor: GRAY[600] },
   searchInput: { flex: 1, fontSize: 16, color: GRAY[900] },
   filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, backgroundColor: GRAY[800], borderRadius: 999 },
   filterBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
   filterBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: GRAY[600], justifyContent: 'center', alignItems: 'center' },
   filterBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
   chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: GRAY[200], borderRadius: 999, backgroundColor: '#FFFFFF' },
   chipActive: { backgroundColor: GRAY[800], borderColor: GRAY[800] },
   chipText: { fontSize: 14, color: GRAY[900], fontWeight: '600' },
   chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
   activeFiltersRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
   activeFiltersLabel: { fontSize: 13, color: GRAY[400], fontWeight: '600' },
   activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: GRAY[800], borderRadius: 999 },
   activeChipText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
   resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   resetText: { fontSize: 13, color: GRAY[500], fontWeight: '700' },
   smallDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },

   photo: { borderRadius: 12, overflow: 'hidden', backgroundColor: GRAY[100] },
   cardImg: { width: '100%', aspectRatio: 4 / 5 },
   badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
   badgeText: { fontSize: 11, fontWeight: '800' },
   swatches: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
   dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
   dotsMore: { fontSize: 10, color: GRAY[600], fontWeight: '700' },
   meta: { paddingTop: 12, gap: 4 },
   cardBrand: { fontSize: 12, fontWeight: '800', color: GRAY[600], textTransform: 'uppercase', letterSpacing: 0.5 },
   cardName: { fontSize: 14, fontWeight: '700', color: GRAY[900], minHeight: 36 },
   cardPrice: { fontSize: 32, fontWeight: '800', color: GRAY[900], marginTop: 2 },
   sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
   sizeBox: { minWidth: 26, height: 24, paddingHorizontal: 6, borderRadius: 5, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
   sizeBoxOk: { borderColor: GRAY[300], backgroundColor: '#FFFFFF' },
   sizeBoxOff: { borderColor: GRAY[200], backgroundColor: GRAY[100] },
   sizeBoxText: { fontSize: 11, fontWeight: '700', color: GRAY[800] },
   sizeOff: { color: GRAY[400], textDecorationLine: 'line-through', fontWeight: '500' },

   actionRow: { marginTop: 10 },
   detailsBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 38, backgroundColor: GRAY[700], borderRadius: 8 },
   detailsBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

   paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, marginTop: 10 },
   pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: GRAY[200], borderRadius: 8, backgroundColor: '#FFFFFF' },
   pageBtnDisabled: { opacity: 0.4, borderColor: GRAY[200] },
   pageBtnText: { fontSize: 13, fontWeight: '700', color: GRAY[800] },
   pageIndicator: { fontSize: 13, fontWeight: '600', color: GRAY[500] },

   emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
   emptyTitle: { ...display, fontSize: 32, fontWeight: '800', color: GRAY[900], textTransform: 'uppercase' },
   emptySub: { fontSize: 14, color: GRAY[500], marginTop: 4, textAlign: 'center' },
   emptyBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: GRAY[800], borderRadius: 8 },

   overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   overlaySheet: { justifyContent: 'flex-end', padding: 0 },
   sheetCard: { maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
   filterCard: { ...modalBase, maxWidth: 500, maxHeight: '88%' },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: GRAY[900] },
   modalTitle: { ...display, fontSize: 28, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
   sectionTitleModal: { fontSize: 15, fontWeight: '800', color: GRAY[900], marginTop: 18, marginBottom: 10 },
   swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
   brandLogoImg: { width: 24, height: 24 },
   avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: GRAY[200], justifyContent: 'center', alignItems: 'center' },
   avatarText: { fontSize: 11, fontWeight: 'bold', color: GRAY[600] },
   filterFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: GRAY[100] },
   ghostBtn: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: GRAY[300], borderRadius: 8, backgroundColor: '#FFFFFF' },
   ghostText: { fontSize: 14, fontWeight: '700', color: GRAY[800] },
   mainBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: GRAY[800], borderRadius: 8 },
   waMainText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

   detailCard: { ...modalBase, maxWidth: 480, maxHeight: '92%', position: 'relative' },
   closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: GRAY[900], borderRadius: 18, padding: 7 },
   mainImg: { width: '100%', height: 340, backgroundColor: GRAY[100] },
   mainImgWide: { width: '100%', aspectRatio: 4 / 5, backgroundColor: GRAY[100] },

   zoomButtonFloat: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      borderRadius: 22,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      zIndex: 5,
   },

   lightboxOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.94)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
   },
   lightboxCloseBtn: {
      position: 'absolute',
      top: 24,
      right: 24,
      zIndex: 1000,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderRadius: 24,
      padding: 10,
   },
   lightboxImage: {
      width: '100%',
      height: '85%',
      maxWidth: 900,
   },

   thumbs: { padding: 12, gap: 8 },
   thumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
   thumbActive: { borderColor: GRAY[900] },

   pricesDetailRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 4 },
   priceBoxModal: { flex: 1, backgroundColor: GRAY[100], padding: 10, borderRadius: 8, borderWidth: 2, borderColor: GRAY[200] },
   wholesaleBoxModal: { backgroundColor: GRAY[100], borderColor: GRAY[200] },
   priceBoxActive: { borderColor: GRAY[900], backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
   priceBoxActiveWholesale: { borderColor: '#10B981', backgroundColor: '#ECFDF5', shadowColor: '#10B981', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
   priceModalLabel: { fontSize: 11, fontWeight: '700', color: GRAY[500], textTransform: 'uppercase', marginBottom: 2 },
   priceModalLabelWholesale: { fontSize: 11, fontWeight: '700', color: '#059669', textTransform: 'uppercase', marginBottom: 2 },
   priceModalValue: { fontSize: 18, fontWeight: '800', color: GRAY[500] },
   priceModalValueWholesale: { fontSize: 18, fontWeight: '800', color: '#047857' },
   priceNoticeText: { fontSize: 12, fontWeight: '600', color: GRAY[600], marginTop: 6, fontStyle: 'italic' },
   totalPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, backgroundColor: GRAY[100], padding: 12, borderRadius: 8 },
   totalPreviewLabel: { fontSize: 14, fontWeight: '700', color: GRAY[700] },
   totalPreviewValue: { fontSize: 20, fontWeight: '800', color: GRAY[900] },

   detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
   detailBrand: { fontSize: 13, fontWeight: '800', color: GRAY[500], letterSpacing: 1, textTransform: 'uppercase' },
   codeBadge: { backgroundColor: GRAY[100], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: GRAY[200] },
   codeBadgeText: { fontSize: 11, fontWeight: '700', color: GRAY[600] },
   detailName: { ...display, fontSize: 32, lineHeight: 30, fontWeight: '800', color: GRAY[900], textTransform: 'uppercase' },
   divider: { height: 1, backgroundColor: GRAY[200], marginVertical: 16 },
   sectionTitle: { fontSize: 14, fontWeight: '800', color: GRAY[800], letterSpacing: 0.3, textTransform: 'uppercase' },

   colorChipOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: GRAY[300], backgroundColor: '#FFFFFF' },
   colorChipOptionActive: { backgroundColor: GRAY[900], borderColor: GRAY[900] },
   colorChipText: { fontSize: 13, fontWeight: '700', color: GRAY[800] },
   colorChipTextActive: { color: '#FFFFFF' },

   sizeSelectChip: { minWidth: 42, height: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: GRAY[300], backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
   sizeSelectChipDisabled: { backgroundColor: GRAY[100], borderColor: GRAY[200], opacity: 0.5 },
   sizeSelectChipActive: { backgroundColor: GRAY[900], borderColor: GRAY[900] },
   sizeSelectText: { fontSize: 13, fontWeight: '800', color: GRAY[900] },
   sizeSelectTextOff: { color: GRAY[400], textDecorationLine: 'line-through' },
   sizeSelectTextActive: { color: '#FFFFFF' },

   quantityContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
   qtyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: GRAY[300], justifyContent: 'center', alignItems: 'center', backgroundColor: GRAY[100] },
   qtyText: { fontSize: 16, fontWeight: '800', color: GRAY[900], minWidth: 20, textAlign: 'center' },
   qtyQuickBtn: { paddingHorizontal: 10, height: 36, borderRadius: 8, borderWidth: 1, borderColor: GRAY[300], backgroundColor: GRAY[100], justifyContent: 'center', alignItems: 'center' },
   qtyQuickText: { fontSize: 12, fontWeight: '800', color: GRAY[800] },
   qtyQuickBtnWholesale: { paddingHorizontal: 12, height: 36, borderRadius: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
   qtyQuickTextWholesale: { fontSize: 12, fontWeight: '800', color: '#047857' },

   detailFooter: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: GRAY[200] },
   waMain: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, height: 50, backgroundColor: GRAY[900], borderRadius: 10 },

   cartItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: GRAY[100], padding: 12, borderRadius: 10, borderWidth: 1, borderColor: GRAY[200] },
   cartItemImg: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#FFFFFF' },
   cartItemBrand: { fontSize: 11, fontWeight: '800', color: GRAY[500], textTransform: 'uppercase' },
   cartItemName: { fontSize: 14, fontWeight: '700', color: GRAY[900] },
   cartItemSpecs: { fontSize: 12, color: GRAY[600], marginTop: 2 },
   cartBadgeTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4, marginBottom: 6 },
   cartBadgeRetail: { backgroundColor: GRAY[200] },
   cartBadgeWholesale: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
   cartBadgeText: { fontSize: 10, fontWeight: '800', color: GRAY[700] },
   cartItemBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
   cartQtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GRAY[300], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
   cartQtyBtn: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
   cartQtyNumber: { fontSize: 13, fontWeight: '800', color: GRAY[900], minWidth: 16, textAlign: 'center' },
   cartItemPrice: { fontSize: 13, fontWeight: '800', color: GRAY[900] },
   cartDeleteBtn: { padding: 8 },
});

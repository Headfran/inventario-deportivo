import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
   View,
   Text,
   ScrollView,
   Pressable,
   StyleSheet,
   TextInput,
   Modal,
   FlatList,
   Animated,
   useWindowDimensions,
   ActivityIndicator,
   Linking
} from 'react-native';
import { Image } from 'expo-image';
import { Search, MessageCircle, Lock, X, ShoppingBag, SlidersHorizontal, RotateCcw, Check, Tag, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts } from '../services/productService';
import { filterProducts, FilterOptions } from '../utils/productFilters';

import { Cover } from '../components/Cover';
import { BLUE, LIGHT, DARK, Tone, display, ease, nd, reduced, useEnter, getColorHex } from '../design';

// ==========================================
// CONFIGURACIÓN DEL COMERCIO
// ==========================================
const STORE_PHONE = "584222630079";

// ==========================================
// CATEGORÍAS FIJAS (Siempre visibles)
// ==========================================
// Agrega aquí todas las categorías que tienes en tu formulario para que siempre aparezcan
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
   'Accesorios'
];

interface Props {
   onOpenStaffAccess: () => void;
}

const T: Tone = LIGHT;
const MAX = 1280;
const PAGE_SIZE = 24;

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
      <View style={[styles.avatar, isSelected && { backgroundColor: T.onAccent }]}>
         <Text style={[styles.avatarText, isSelected && { color: T.accent }]}>{brandName.charAt(0).toUpperCase()}</Text>
      </View>
   );
};

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
      <X size={12} color={T.onAccent} />
   </Pressable>
);

const ProductCard = React.memo(({ item, width, compact, onOpen, onShare }: { item: Product; width: number; compact: boolean; onOpen: (p: Product) => void; onShare: (p: Product) => void }) => {
   const stock = totalStock(item);
   const out = stock === 0;
   const low = stock > 0 && stock <= 3;
   const variants = item.variants || [];
   const run = sizeRun(item).slice(0, 6);
   const [int, dec] = item.price.toFixed(2).split('.');

   return (
      <Pressable style={({ pressed }) => [{ width }, pressed && styles.pressedCard]} onPress={() => onOpen(item)}>
         <View style={styles.photo}>
            <Cover uri={item.images?.[0]} name={item.name} bg={T.imgBg} fg={T.line} style={[styles.cardImg, out && { opacity: 0.45 }]} />

            {(out || low) && (
               <View style={[styles.badge, out ? { backgroundColor: T.solid } : { backgroundColor: BLUE[800] }]}>
                  <Text style={[styles.badgeText, { color: out ? T.onSolid : '#FFFFFF' }]}>{out ? 'Agotado' : 'Últimas unidades'}</Text>
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
         </View>

         <View style={styles.meta}>
            <Text style={styles.cardBrand} numberOfLines={1}>{item.brand}</Text>
            <Text style={[styles.cardName, !compact && { fontSize: 15 }]} numberOfLines={2}>{item.name}</Text>

            {run.length > 0 && (
               <View style={styles.sizes}>
                  {run.map(([sz, ok]) => (
                     <View key={sz} style={styles.sizeBox}>
                        <Text style={[styles.sizeBoxText, !ok && styles.sizeOff]}>{sz}</Text>
                     </View>
                  ))}
               </View>
            )}
         </View>

         <View style={styles.priceRow}>
            <Text style={[styles.price, !compact && { fontSize: 38, lineHeight: 36 }]}>
               ${int}
               <Text style={styles.cents}>.{dec}</Text>
            </Text>
            <Pressable
               style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
               accessibilityLabel="Consultar por WhatsApp"
               onPress={(e) => {
                  e.stopPropagation();
                  onShare(item);
               }}
            >
               <MessageCircle size={18} color={T.onAccent} />
            </Pressable>
         </View>
      </Pressable>
   );
});

export const PublicCatalogScreen: React.FC<Props> = ({ onOpenStaffAccess }) => {
   const [products, setProducts] = useState<Product[]>([]);
   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
   const [detailProduct, setDetailProduct] = useState<Product | null>(null);
   const [selectedImageIndex, setSelectedImageIndex] = useState(0);
   const [searchFocused, setSearchFocused] = useState(false);

   // ESTADOS PARA EL CARRITO DE WHATSAPP
   const [selectedColor, setSelectedColor] = useState<string | null>(null);
   const [selectedSize, setSelectedSize] = useState<string | null>(null);

   const [currentPage, setCurrentPage] = useState(1);
   const flatListRef = useRef<FlatList>(null);

   const [filters, setFilters] = useState<FilterOptions>({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });

   useEffect(() => {
      const unsub = subscribeToProducts(setProducts);
      return () => unsub();
   }, []);

   // 1. FILTRO MAESTRO: Solo prendas ubicadas en Bodega/Vitrina
   const validProducts = useMemo(() => {
      return products.reduce((acc: Product[], p) => {
         const validVariants = (p.variants || []).filter(v => v.locations && v.locations.length > 0);
         if (validVariants.length > 0) {
            acc.push({ ...p, variants: validVariants });
         }
         return acc;
      }, []);
   }, [products]);

   // 2. EXTRACCIÓN DINÁMICA DE FILTROS (Con categorías fijas y 'all' al final)
   const { categories, brands, colors, sizes } = useMemo(() => {
      const dynamicCats = validProducts.map((p) => p.category).filter(Boolean);
      // Combinamos las fijas con las dinámicas (por si hay alguna nueva) y eliminamos duplicados
      const cats = Array.from(new Set([...STATIC_CATEGORIES, ...dynamicCats]));

      return {
         categories: [...cats, 'all'], // <-- 'all' al final
         brands: Array.from(new Set(validProducts.map((p) => p.brand).filter(Boolean))),
         colors: Array.from(new Set(validProducts.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean))),
         sizes: Array.from(new Set(validProducts.flatMap((p) => (p.variants || []).flatMap((v) => (v.sizes || []).map((s) => s.size))).filter(Boolean))),
      }
   }, [validProducts]);

   const filteredProducts = useMemo(() => filterProducts(validProducts, filters), [validProducts, filters]);

   useEffect(() => {
      setCurrentPage(1);
   }, [filters]);

   const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;

   const paginatedProducts = useMemo(() => {
      const start = (currentPage - 1) * PAGE_SIZE;
      return filteredProducts.slice(start, start + PAGE_SIZE);
   }, [filteredProducts, currentPage]);

   const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
   };

   const activeFiltersCount = (filters.brand ? 1 : 0) + (filters.color ? 1 : 0) + (filters.size ? 1 : 0) + (filters.category !== 'all' ? 1 : 0);
   const handleResetFilters = () => setFilters({ query: '', category: 'all', brand: '', color: '', size: '', status: 'all' });

   const openDetail = useCallback((p: Product) => {
      setDetailProduct(p);
      setSelectedImageIndex(0);
      setSelectedColor(null);
      setSelectedSize(null);
   }, []);

   // REDIRECCIÓN A WHATSAPP
   const sendToWhatsApp = (p: Product, color?: string | null, size?: string | null) => {
      let msg = `Hola! Me interesa el modelo *${p.brand} - ${p.name}*\nCódigo: ${p.code}`;
      if (color && size) {
         msg += `\nQuisiera pedir el color *${color}* en talla *${size}*.`;
      } else {
         msg += `\n¿Me podrías dar más información sobre su disponibilidad?`;
      }
      const url = `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(msg)}`;
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
   }, [heroPics.length, reveal]);

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
            <View style={[styles.inner, wide ? styles.heroWide : styles.heroCol, { paddingHorizontal: PAD }]}>
               <View style={wide ? { flex: 1, paddingRight: 24 } : undefined}>
                  <View style={styles.countPill}>
                     <Text style={styles.countText}>{n} {n === 1 ? 'modelo' : 'modelos'}</Text>
                  </View>
                  <Text style={[styles.title, titleSize]}>Catálogo{'\n'}de prendas</Text>
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
                           <Pressable onPress={() => openDetail(p)} style={({ pressed }) => [styles.printPhoto, pressed && styles.pressedCard]}>
                              <Cover uri={p.images?.[0]} name={p.name} bg={BLUE[700]} fg={BLUE[600]} style={styles.printImg} />
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
                  <Search size={18} color={T.ink} />
                  <TextInput
                     style={styles.searchInput}
                     placeholder="Buscar por modelo, marca o código"
                     placeholderTextColor={T.inkMute}
                     value={filters.query}
                     onChangeText={(text) => setFilters((prev) => ({ ...prev, query: text }))}
                     onFocus={() => setSearchFocused(true)}
                     onBlur={() => setSearchFocused(false)}
                  />
                  {filters.query ? (
                     <Pressable onPress={() => setFilters((prev) => ({ ...prev, query: '' }))}>
                        <X size={18} color={T.inkMute} />
                     </Pressable>
                  ) : null}
               </View>

               <Pressable style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]} onPress={() => setIsFilterModalOpen(true)}>
                  <SlidersHorizontal size={16} color={T.onSolid} />
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
                        <Tag size={12} color={T.onAccent} />
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
                     <RotateCcw size={12} color={T.inkSoft} />
                     <Text style={styles.resetText}>Limpiar</Text>
                  </Pressable>
               </View>
            )}
         </View>
      </View>
   );

   const paginationFooter = (
      <View style={styles.paginationContainer}>
         {totalPages > 1 && (
            <>
               <Pressable
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  onPress={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
               >
                  <ChevronLeft size={20} color={currentPage === 1 ? T.inkMute : T.ink} />
               </Pressable>

               <Text style={styles.pageText}>Página {currentPage} de {totalPages}</Text>

               <Pressable
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  onPress={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
               >
                  <ChevronRight size={20} color={currentPage === totalPages ? T.inkMute : T.ink} />
               </Pressable>
            </>
         )}
      </View>
   );

   const renderDetail = (p: Product) => {
      const [int, dec] = p.price.toFixed(2).split('.');

      const gallery = (
         <View>
            <Cover uri={p.images?.[selectedImageIndex]} name={p.name} bg={T.imgBg} fg={T.line} style={wide ? styles.mainImgWide : styles.mainImg} />
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

      const info = (
         <View style={{ padding: 24 }}>
            <Text style={styles.detailBrand}>{p.brand}</Text>
            <Text style={styles.detailName}>{p.name}</Text>
            <Text style={styles.detailCode}>Código {p.code}</Text>
            <Text style={styles.detailPrice}>
               ${int}
               <Text style={styles.detailCents}>.{dec}</Text>
            </Text>

            <Text style={styles.sectionTitle}>Colores y tallas</Text>
            <View>
               {(p.variants || []).map((v, idx) => {
                  const allSizes = v.sizes || [];
                  const anyStock = allSizes.some((s) => Number(s.stock) > 0);

                  return (
                     <View key={idx} style={styles.variantRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                           <View style={[styles.swatch, { backgroundColor: getColorHex(v.color) }]} />
                           <Text style={styles.variantColor}>{v.color}</Text>
                        </View>
                        {anyStock ? (
                           <View style={styles.sizesWrap}>
                              {allSizes.map((s) => {
                                 const isSelected = selectedColor === v.color && selectedSize === s.size;
                                 return (
                                    <Pressable
                                       key={s.size}
                                       style={[styles.sizeBox, isSelected && styles.sizeBoxSelected]}
                                       onPress={() => {
                                          if (Number(s.stock) > 0) {
                                             setSelectedColor(v.color);
                                             setSelectedSize(s.size);
                                          }
                                       }}
                                    >
                                       <Text style={[styles.sizeBoxText, Number(s.stock) <= 0 && styles.sizeOff, isSelected && styles.sizeBoxTextSelected]}>
                                          {s.size}
                                       </Text>
                                    </Pressable>
                                 );
                              })}
                           </View>
                        ) : (
                           <Text style={styles.soldOut}>Agotado</Text>
                        )}
                     </View>
                  );
               })}
            </View>
         </View>
      );

      const footer = (
         <View style={styles.detailFooter}>
            <Pressable
               style={({ pressed }) => [styles.waMain, pressed && styles.pressed, (!selectedColor || !selectedSize) && { backgroundColor: T.ink, opacity: 0.95 }]}
               onPress={() => sendToWhatsApp(p, selectedColor, selectedSize)}
            >
               <MessageCircle size={19} color={T.onAccent} />
               <Text style={styles.waMainText}>
                  {selectedColor && selectedSize ? `Pedir ${selectedSize} en ${selectedColor}` : 'Consultar por WhatsApp'}
               </Text>
            </Pressable>
         </View>
      );

      return wide ? (
         <View style={{ flexDirection: 'row', flexShrink: 1 }}>
            <View style={{ width: '46%' }}>{gallery}</View>
            <View style={{ flex: 1, flexShrink: 1 }}>
               <ScrollView style={{ flexShrink: 1 }}>{info}</ScrollView>
               {footer}
            </View>
         </View>
      ) : (
         <>
            <ScrollView style={{ flexShrink: 1 }}>
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
                  <View style={styles.logoBox}>
                     <ShoppingBag size={17} color="#FFFFFF" />
                  </View>
                  <Text style={styles.barTitle} numberOfLines={1}>JDSTORE</Text>
               </View>

               <Pressable
                  style={({ pressed }) => [styles.staffBtn, pressed && styles.pressed]}
                  onPress={onOpenStaffAccess}
                  accessibilityLabel="Acceso al Personal"
               >
                  <Lock size={13} color={T.onBar} />
                  <Text style={styles.staffText}>Personal</Text>
               </Pressable>
            </View>
         </View>

         <FlatList
            ref={flatListRef}
            key={cols}
            data={paginatedProducts}
            keyExtractor={(item) => item.id || item.code}
            numColumns={cols}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP * 2, paddingHorizontal: PAD, width: '100%', maxWidth: MAX, alignSelf: 'center' }}
            renderItem={({ item }) => (
               <ProductCard
                  item={item}
                  width={cardW}
                  compact={mobile}
                  onOpen={openDetail}
                  onShare={(p) => sendToWhatsApp(p)}
               />
            )}
            ListHeaderComponent={header}
            ListFooterComponent={paginationFooter}
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
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
         />

         {/* MODAL DE FILTROS */}
         <Modal visible={isFilterModalOpen} transparent animationType="fade">
            <View style={[styles.overlay, mobile && styles.overlaySheet]}>
               <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalOpen(false)} />
               <Animated.View style={[styles.filterCard, mobile && styles.sheetCard, filterAnim as any]}>
                  <View style={styles.modalHeader}>
                     <Text style={styles.modalTitle}>Filtros</Text>
                     <Pressable onPress={() => setIsFilterModalOpen(false)}>
                        <X size={22} color="#FFFFFF" />
                     </Pressable>
                  </View>

                  <ScrollView style={{ padding: 20 }}>
                     <Text style={styles.sectionTitle}>Marcas</Text>
                     <View style={styles.wrap}>
                        <Chip
                           label="Todas"
                           active={!filters.brand}
                           left={<Tag size={14} color={!filters.brand ? T.onAccent : T.inkMute} />}
                           onPress={() => setFilters((p) => ({ ...p, brand: '' }))}
                        />
                        {brands.map((b) => (
                           <Chip
                              key={b}
                              label={b}
                              active={filters.brand === b}
                              left={<BrandLogoItem brandName={b} isSelected={filters.brand === b} />}
                              onPress={() => setFilters((p) => ({ ...p, brand: b }))}
                           />
                        ))}
                     </View>

                     <Text style={styles.sectionTitle}>Colores disponibles</Text>
                     <View style={styles.wrap}>
                        <Chip label="Todos" active={!filters.color} onPress={() => setFilters((p) => ({ ...p, color: '' }))} />
                        {colors.map((c) => (
                           <Chip
                              key={c}
                              label={c}
                              active={filters.color === c}
                              left={<View style={[styles.swatch, { backgroundColor: getColorHex(c) }]} />}
                              onPress={() => setFilters((p) => ({ ...p, color: c }))}
                           />
                        ))}
                     </View>

                     <Text style={styles.sectionTitle}>Talla disponible</Text>
                     <View style={styles.wrap}>
                        <Chip label="Todas" active={!filters.size} onPress={() => setFilters((p) => ({ ...p, size: '' }))} />
                        {sizes.map((s) => (
                           <Chip key={s} label={s} active={filters.size === s} onPress={() => setFilters((p) => ({ ...p, size: s }))} />
                        ))}
                     </View>
                  </ScrollView>

                  <View style={styles.filterFooter}>
                     <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]} onPress={handleResetFilters}>
                        <Text style={styles.ghostText}>Limpiar todo</Text>
                     </Pressable>
                     <Pressable style={({ pressed }) => [styles.mainBtn, pressed && styles.pressed]} onPress={() => setIsFilterModalOpen(false)}>
                        <Check size={16} color={T.onAccent} />
                        <Text style={styles.waMainText}>Ver {n} resultados</Text>
                     </Pressable>
                  </View>
               </Animated.View>
            </View>
         </Modal>

         {/* MODAL DE DETALLE */}
         <Modal visible={!!detailProduct} transparent animationType="fade">
            <View style={[styles.overlay, mobile && styles.overlaySheet]}>
               <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailProduct(null)} />
               {detailProduct && (
                  <Animated.View style={[styles.detailCard, wide && { maxWidth: 940 }, mobile && styles.sheetCard, detailAnim as any]}>
                     <Pressable style={styles.closeBtn} onPress={() => setDetailProduct(null)}>
                        <X size={20} color={T.onSolid} />
                     </Pressable>
                     {renderDetail(detailProduct)}
                  </Animated.View>
               )}
            </View>
         </Modal>
      </View>
   );
};

const modalBase = { width: '100%' as const, backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' as const };

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: T.bg },
   inner: { width: '100%', maxWidth: MAX, alignSelf: 'center' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
   pressedCard: { transform: [{ scale: 0.98 }] },
   wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

   // Barra superior
   bar: { backgroundColor: T.bar, paddingVertical: 12 },
   barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
   brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
   logoBox: { width: 34, height: 34, backgroundColor: BLUE[700], borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
   barTitle: { ...display, fontSize: 22, fontWeight: '800', color: T.onBar, letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 1 },
   staffBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999 },
   staffText: { fontSize: 13, fontWeight: '600', color: T.onBar },

   // Portada
   hero: { backgroundColor: BLUE[800], overflow: 'hidden', paddingTop: 32, paddingBottom: 64 },
   heroWide: { flexDirection: 'row', alignItems: 'center' },
   heroCol: { gap: 28 },
   countPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 14 },
   countText: { fontSize: 13, fontWeight: '700', color: BLUE[300] },
   title: { ...display, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
   titleSm: { fontSize: 60, lineHeight: 56 },
   titleMd: { fontSize: 96, lineHeight: 88 },
   titleLg: { fontSize: 132, lineHeight: 118 },
   heroSub: { fontSize: 17, color: BLUE[300], marginTop: 14, maxWidth: 380 },
   prints: { flexDirection: 'row', gap: 16, paddingRight: 10, alignItems: 'flex-start' },
   printsWide: { width: '46%' },
   printBack: { position: 'absolute', top: 10, left: 10, right: -10, bottom: -10, backgroundColor: BLUE[600], borderRadius: 12 },
   printPhoto: { borderRadius: 12, overflow: 'hidden' },
   printImg: { width: '100%', aspectRatio: 3 / 4 },
   slant: { position: 'absolute', left: -30, right: -30, bottom: -34, height: 64, backgroundColor: T.bg, transform: [{ rotate: '-1.4deg' }] },

   // Búsqueda y filtros
   filters: { gap: 14, marginBottom: 24 },
   searchRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
   searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderBottomWidth: 2, borderBottomColor: T.ink },
   searchFocused: { borderBottomColor: BLUE[600] },
   searchInput: { flex: 1, fontSize: 16, color: T.ink },
   filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, backgroundColor: T.solid, borderRadius: 999 },
   filterBtnText: { fontSize: 14, fontWeight: '700', color: T.onSolid },
   filterBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: BLUE[600], justifyContent: 'center', alignItems: 'center' },
   filterBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
   chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: T.line, borderRadius: 999, backgroundColor: T.bg },
   chipActive: { backgroundColor: T.accent, borderColor: T.accent },
   chipText: { fontSize: 14, color: T.ink, fontWeight: '600' },
   chipTextActive: { color: T.onAccent, fontWeight: '700' },
   activeFiltersRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
   activeFiltersLabel: { fontSize: 13, color: T.inkMute, fontWeight: '600' },
   activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: T.accent, borderRadius: 999 },
   activeChipText: { fontSize: 13, color: T.onAccent, fontWeight: '600' },
   resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   resetText: { fontSize: 13, color: T.inkSoft, fontWeight: '700' },
   smallDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },

   // Tarjetas
   photo: { borderRadius: 12, overflow: 'hidden', backgroundColor: T.imgBg },
   cardImg: { width: '100%', aspectRatio: 4 / 5 },
   badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
   badgeText: { fontSize: 11, fontWeight: '800' },
   swatches: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.pill, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
   dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
   dotsMore: { fontSize: 10, color: T.inkSoft, fontWeight: '700' },
   meta: { paddingTop: 12, gap: 3 },
   cardBrand: { fontSize: 12, fontWeight: '700', color: BLUE[600] },
   cardName: { fontSize: 14, fontWeight: '700', color: T.ink, minHeight: 36 },
   sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
   sizeBox: { minWidth: 26, height: 24, paddingHorizontal: 5, borderRadius: 5, borderWidth: 1, borderColor: T.line, justifyContent: 'center', alignItems: 'center' },
   sizeBoxSelected: { borderColor: T.accent, backgroundColor: T.accent },
   sizeBoxText: { fontSize: 11, fontWeight: '700', color: T.ink },
   sizeBoxTextSelected: { color: T.onAccent },
   sizeOff: { color: T.inkMute, textDecorationLine: 'line-through', fontWeight: '500', opacity: 0.6 },
   priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
   price: { ...display, fontSize: 32, lineHeight: 30, fontWeight: '800', color: T.ink },
   cents: { fontSize: 16, fontWeight: '700', color: T.inkSoft },
   fab: { width: 42, height: 42, backgroundColor: T.accent, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

   emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
   emptyTitle: { ...display, fontSize: 32, fontWeight: '800', color: T.ink, textTransform: 'uppercase' },
   emptySub: { fontSize: 14, color: T.inkSoft, marginTop: 4, textAlign: 'center' },
   emptyBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: T.accent, borderRadius: 8 },

   // Controles de Paginación
   paginationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 16 },
   pageBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, justifyContent: 'center', alignItems: 'center', elevation: 1 },
   pageBtnDisabled: { opacity: 0.4, backgroundColor: T.bg, elevation: 0 },
   pageText: { fontSize: 14, fontWeight: '700', color: T.ink },

   // Modales
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   overlaySheet: { justifyContent: 'flex-end', padding: 0 },
   sheetCard: { maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
   filterCard: { ...modalBase, maxWidth: 500, maxHeight: '88%' },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: BLUE[800] },
   modalTitle: { ...display, fontSize: 28, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
   sectionTitle: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 18, marginBottom: 10 },
   swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
   brandLogoImg: { width: 18, height: 18 },
   avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: T.line, justifyContent: 'center', alignItems: 'center' },
   avatarText: { fontSize: 10, fontWeight: 'bold', color: T.inkSoft },
   filterFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: T.surface },
   ghostBtn: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: T.bg },
   ghostText: { fontSize: 14, fontWeight: '700', color: T.ink },
   mainBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: T.accent, borderRadius: 8 },
   waMainText: { fontSize: 15, fontWeight: '800', color: T.onAccent },

   // Detalle
   detailCard: { ...modalBase, maxWidth: 480, maxHeight: '92%' },
   closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: T.solid, borderRadius: 18, padding: 7 },
   mainImg: { width: '100%', height: 320, backgroundColor: T.imgBg },
   mainImgWide: { width: '100%', aspectRatio: 4 / 5, backgroundColor: T.imgBg },
   thumbs: { padding: 10, gap: 8 },
   thumb: { width: 54, height: 54, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
   thumbActive: { borderColor: BLUE[600] },
   detailBrand: { fontSize: 14, fontWeight: '700', color: BLUE[600] },
   detailName: { ...display, fontSize: 44, lineHeight: 42, fontWeight: '800', color: T.ink, textTransform: 'uppercase', marginVertical: 4 },
   detailCode: { fontSize: 12, color: T.inkMute, marginBottom: 10 },
   detailPrice: { ...display, fontSize: 60, lineHeight: 58, fontWeight: '800', color: T.ink },
   detailCents: { fontSize: 26, color: T.inkSoft },
   variantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.line },
   variantColor: { fontSize: 15, fontWeight: '700', color: T.ink },
   sizesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flex: 1, marginLeft: 12 },
   soldOut: { fontSize: 13, color: T.inkMute, fontStyle: 'italic' },
   detailFooter: { padding: 16, backgroundColor: T.surface },
   waMain: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, height: 54, backgroundColor: T.accent, borderRadius: 10 },
});

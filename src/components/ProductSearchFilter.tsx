import React, { useState, useRef } from 'react';
import {
   View,
   Text,
   TextInput,
   Pressable,
   ScrollView,
   StyleSheet,
   useWindowDimensions,
   Platform,
} from 'react-native';
import {
   Search, X, Filter, Sparkles, Store, Layers, AlertTriangle,
   Grid, ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import {
   IconTshirt,
   IconHoodie,
   IconJacket,
   IconShorts,
   IconPants,
   IconOutfit,
   IconShoe,
   IconAccessories,
   IconPremium,
} from '../components/CategoryIcons';
import { FilterOptions } from '../utils/productFilters';
import { MONO as T } from '../design';

interface Props {
   filters: FilterOptions;
   onFilterChange: (newFilters: FilterOptions) => void;
   availableCategories: string[];
   availableBrands: string[];
   availableSizes: string[];
   hideStatusFilter?: boolean;
}

const SCROLL_STEP = 200;

// Resolver de icono por nombre de categoría
const getCategoryIcon = (catName: string, isActive: boolean) => {
   const color = isActive ? T.onSolid : T.inkSoft;
   const size = 16;
   const n = catName.toLowerCase().trim();

   if (catName === 'all') return <Grid size={size} color={color} />;

   // Premium
   if (n.includes('aaa')) return <IconPremium size={size} color={color} />;

   // Calzado
   if (n.includes('zapat') || n.includes('calzad')) return <IconShoe size={size} color={color} />;

   // Accesorios
   if (n.includes('accesorio')) return <IconAccessories size={size} color={color} />;

   // Capas gruesas
   if (
      n.includes('sudadera') || n.includes('sudader') ||
      n.includes('sueter') || n.includes('sweater') || n.includes('hoodie')
   ) {
      return <IconHoodie size={size} color={color} />;
   }

   if (n.includes('chaqueta') || n.includes('abrigo')) return <IconJacket size={size} color={color} />;

   // Conjuntos
   if (n.includes('conjunto')) return <IconOutfit size={size} color={color} />;

   // Shorts
   if (n.includes('short') || n.includes('bermuda')) return <IconShorts size={size} color={color} />;

   // Pantalones / monos (joggers) / jeans
   if (
      n.includes('pantalon') || n.includes('mono') ||
      n.includes('jogger') || n.includes('jean')
   ) {
      return <IconPants size={size} color={color} />;
   }

   // Fallback: camisetas (franelas, camisas, franelillas, chemises)
   return <IconTshirt size={size} color={color} />;
};

export const ProductSearchFilter: React.FC<Props> = ({
   filters,
   onFilterChange,
   availableCategories,
   availableBrands,
   availableSizes,
   hideStatusFilter,
}) => {
   const [showMoreFilters, setShowMoreFilters] = useState(false);
   const { width } = useWindowDimensions();

   // Refs + posiciones de scroll para flechas laterales
   const categoryRef = useRef<ScrollView>(null);
   const brandRef = useRef<ScrollView>(null);
   const sizeRef = useRef<ScrollView>(null);

   const [isSearchFocused, setIsSearchFocused] = useState(false);

   const scrollPos = useRef({ category: 0, brand: 0, size: 0 });

   const scrollTo = (which: 'category' | 'brand' | 'size', direction: 'left' | 'right') => {
      const current = scrollPos.current[which];
      const target = direction === 'left'
         ? Math.max(0, current - SCROLL_STEP)
         : current + SCROLL_STEP;

      const refMap = { category: categoryRef, brand: brandRef, size: sizeRef };
      refMap[which].current?.scrollTo({ x: target, animated: true });
      scrollPos.current[which] = target;
   };

   const trackScroll = (which: 'category' | 'brand' | 'size') => (e: any) => {
      scrollPos.current[which] = e.nativeEvent.contentOffset.x;
   };

   const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
      onFilterChange({ ...filters, [key]: value });
   };

   const resetFilters = () => {
      onFilterChange({
         query: '',
         category: 'all',
         brand: '',
         color: '',
         size: '',
         status: 'all',
      });
   };

   const categoriesList = availableCategories.length > 0
      ? ['all', ...availableCategories]
      : ['all', 'Franelas', 'Shorts', 'Pantalones', 'Chaquetas', 'Calzado', 'Accesorios'];

   const statusChips: { id: FilterOptions['status']; label: string; icon: any }[] = [
      { id: 'all', label: 'Todos', icon: Sparkles },
      { id: 'vitrina', label: 'Vitrina', icon: Store },
      { id: 'bodega', label: 'Bodega', icon: Layers },
      { id: 'unassigned', label: 'Sin Ubicar', icon: Filter },
      { id: 'low_stock', label: 'Bajo Stock', icon: AlertTriangle },
   ];

   const categoryChips = categoriesList.map((cat) => {
      const isAll = cat === 'all';
      const isActive = isAll ? filters.category === 'all' || !filters.category : filters.category === cat;

      return (
         <Pressable
            key={cat}
            style={({ pressed }) => [styles.categoryChip, isActive && styles.categoryChipActive, pressed && styles.pressed]}
            onPress={() => updateFilter('category', isAll ? 'all' : cat)}
         >
            {getCategoryIcon(cat, isActive)}
            <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{isAll ? 'Todas' : cat}</Text>
         </Pressable>
      );
   });

   return (
      <View style={styles.container}>
         {/* CATEGORÍAS */}
         <Text style={styles.sectionLabel}>Categorías de prendas</Text>
         {width >= 800 ? (
            <View style={styles.wrap}>{categoryChips}</View>
         ) : (
            <View style={styles.scrollRow}>
               <Pressable
                  style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                  onPress={() => scrollTo('category', 'left')}
                  accessibilityLabel="Desplazar categorías a la izquierda"
               >
                  <ChevronLeft size={18} color={T.inkSoft} />
               </Pressable>
               <ScrollView
                  ref={categoryRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.scrollView}
                  contentContainerStyle={{ gap: 8 }}
                  onScroll={trackScroll('category')}
                  scrollEventThrottle={16}
               >
                  {categoryChips}
               </ScrollView>
               <Pressable
                  style={({ pressed }) => [styles.scrollArrow, pressed && styles.pressed]}
                  onPress={() => scrollTo('category', 'right')}
                  accessibilityLabel="Desplazar categorías a la derecha"
               >
                  <ChevronRight size={18} color={T.inkSoft} />
               </Pressable>
            </View>
         )}

         {/* BÚSQUEDA Y BOTÓN DE FILTROS */}
         <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
            <Search size={18} color={isSearchFocused ? T.ink : T.inkMute} />
            <TextInput
               style={styles.searchInput}
               placeholder="Buscar por nombre, SKU, marca..."
               placeholderTextColor={T.inkMute}
               value={filters.query}
               onChangeText={(text) => updateFilter('query', text)}
               onFocus={() => setIsSearchFocused(true)}
               onBlur={() => setIsSearchFocused(false)}
            />
            {filters.query ? (
               <Pressable onPress={() => updateFilter('query', '')}>
                  <X size={18} color={T.inkMute} />
               </Pressable>
            ) : null}
            <Pressable
               style={({ pressed }) => [styles.toggleBtn, showMoreFilters && styles.toggleBtnActive, pressed && styles.pressed]}
               onPress={() => setShowMoreFilters(!showMoreFilters)}
            >
               <Filter size={16} color={showMoreFilters ? T.onSolid : T.ink} />
            </Pressable>
         </View>

         {/* CHIPS DE ESTADO (opcionales) */}
         {!hideStatusFilter && (
            <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               style={{ flexGrow: 0 }}
               contentContainerStyle={{ gap: 6 }}
            >
               {statusChips.map((chip) => {
                  const IconComp = chip.icon;
                  const isActive = filters.status === chip.id;
                  return (
                     <Pressable
                        key={chip.id}
                        style={({ pressed }) => [styles.statusChip, isActive && styles.statusChipActive, pressed && styles.pressed]}
                        onPress={() => updateFilter('status', chip.id)}
                     >
                        <IconComp size={13} color={isActive ? T.ink : T.inkMute} />
                        <Text style={[styles.statusChipText, isActive && styles.statusChipTextActive]}>{chip.label}</Text>
                     </Pressable>
                  );
               })}
            </ScrollView>
         )}

         {/* PANEL DESPLEGABLE (MARCA Y TALLA) */}
         {showMoreFilters && (
            <View style={styles.panel}>
               <Text style={styles.filterLabel}>Marca</Text>
               <View style={styles.scrollRow}>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrowSmall, pressed && styles.pressed]}
                     onPress={() => scrollTo('brand', 'left')}
                  >
                     <ChevronLeft size={14} color={T.inkSoft} />
                  </Pressable>
                  <ScrollView
                     ref={brandRef}
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     style={styles.scrollView}
                     contentContainerStyle={{ gap: 6 }}
                     onScroll={trackScroll('brand')}
                     scrollEventThrottle={16}
                  >
                     <Pressable
                        style={[styles.subChip, !filters.brand && styles.subChipActive]}
                        onPress={() => updateFilter('brand', '')}
                     >
                        <Text style={[styles.subChipText, !filters.brand && styles.subChipTextActive]}>Todas</Text>
                     </Pressable>
                     {availableBrands.map((b) => (
                        <Pressable
                           key={b}
                           style={[styles.subChip, filters.brand === b && styles.subChipActive]}
                           onPress={() => updateFilter('brand', b)}
                        >
                           <Text style={[styles.subChipText, filters.brand === b && styles.subChipTextActive]}>{b}</Text>
                        </Pressable>
                     ))}
                  </ScrollView>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrowSmall, pressed && styles.pressed]}
                     onPress={() => scrollTo('brand', 'right')}
                  >
                     <ChevronRight size={14} color={T.inkSoft} />
                  </Pressable>
               </View>

               <Text style={[styles.filterLabel, { marginTop: 14 }]}>Talla</Text>
               <View style={styles.scrollRow}>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrowSmall, pressed && styles.pressed]}
                     onPress={() => scrollTo('size', 'left')}
                  >
                     <ChevronLeft size={14} color={T.inkSoft} />
                  </Pressable>
                  <ScrollView
                     ref={sizeRef}
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     style={styles.scrollView}
                     contentContainerStyle={{ gap: 6 }}
                     onScroll={trackScroll('size')}
                     scrollEventThrottle={16}
                  >
                     <Pressable
                        style={[styles.subChip, !filters.size && styles.subChipActive]}
                        onPress={() => updateFilter('size', '')}
                     >
                        <Text style={[styles.subChipText, !filters.size && styles.subChipTextActive]}>Todas</Text>
                     </Pressable>
                     {availableSizes.map((s) => (
                        <Pressable
                           key={s}
                           style={[styles.subChip, filters.size === s && styles.subChipActive]}
                           onPress={() => updateFilter('size', s)}
                        >
                           <Text style={[styles.subChipText, filters.size === s && styles.subChipTextActive]}>{s}</Text>
                        </Pressable>
                     ))}
                  </ScrollView>
                  <Pressable
                     style={({ pressed }) => [styles.scrollArrowSmall, pressed && styles.pressed]}
                     onPress={() => scrollTo('size', 'right')}
                  >
                     <ChevronRight size={14} color={T.inkSoft} />
                  </Pressable>
               </View>

               <Pressable style={styles.resetBtn} onPress={resetFilters}>
                  <X size={14} color={T.inkSoft} />
                  <Text style={styles.resetBtnText}>Limpiar filtros</Text>
               </Pressable>
            </View>
         )}
      </View>
   );
};

const styles = StyleSheet.create({
   container: { gap: 12, marginBottom: 12 },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
   wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   sectionLabel: { fontSize: 13, fontWeight: '700', color: T.inkMute },

   // Fila de scroll horizontal con flechas laterales
   scrollRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
   scrollView: { flex: 1 },
   scrollArrow: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: T.line, backgroundColor: T.surface,
   },
   scrollArrowSmall: {
      width: 26, height: 26, borderRadius: 6,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: T.line, backgroundColor: T.bg,
   },

   // Chips de categoría
   categoryChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 999, borderWidth: 1, borderColor: T.line,
   },
   categoryChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   categoryText: { fontSize: 14, fontWeight: '600', color: T.inkSoft },
   categoryTextActive: { color: T.onSolid, fontWeight: '800' },

   // Búsqueda
   searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      height: 48, paddingLeft: 14, paddingRight: 10,
      borderRadius: 10, backgroundColor: T.surface,
      borderWidth: 1, borderColor: T.line,
   },
   searchBarFocused: {
      borderColor: T.ink,
      borderWidth: 1.5,
   },
   searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      fontSize: 14,
      color: T.ink,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      textAlignVertical: 'center',
      alignSelf: 'stretch',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
   },
   toggleBtn: {
      width: 34, height: 34, borderRadius: 8,
      borderWidth: 1, borderColor: T.line,
      alignItems: 'center', justifyContent: 'center',
   },
   toggleBtnActive: { backgroundColor: T.solid, borderColor: T.solid },

   // Chips de estado
   statusChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 11, paddingVertical: 6,
      borderRadius: 8, borderWidth: 1, borderColor: T.line,
   },
   statusChipActive: { borderColor: T.ink, backgroundColor: T.surface },
   statusChipText: { fontSize: 12, fontWeight: '600', color: T.inkMute },
   statusChipTextActive: { color: T.ink, fontWeight: '700' },

   // Panel avanzado
   panel: { padding: 14, borderRadius: 12, backgroundColor: T.surface },
   filterLabel: { fontSize: 12, fontWeight: '700', color: T.inkMute, marginBottom: 8 },
   subChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: T.line,
   },
   subChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   subChipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   subChipTextActive: { color: T.onSolid, fontWeight: '800' },
   resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 14 },
   resetBtnText: { fontSize: 12, fontWeight: '700', color: T.inkSoft },
});


import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Search, X, Filter, Sparkles, Store, Layers, AlertTriangle, Shirt, Footprints, Grid } from 'lucide-react-native';
import { FilterOptions } from '../utils/productFilters';
import { MONO as T } from '../design';

interface Props {
   filters: FilterOptions;
   onFilterChange: (newFilters: FilterOptions) => void;
   availableCategories: string[];
   availableBrands: string[];
   availableSizes: string[];
}

export const ProductSearchFilter: React.FC<Props> = ({
   filters,
   onFilterChange,
   availableCategories,
   availableBrands,
   availableSizes,
}) => {
   const [showMoreFilters, setShowMoreFilters] = useState(false);
   const { width } = useWindowDimensions();

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

   // Categorías predefinidas o dinámicas con fallback
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
      const iconColor = isActive ? T.onAccent : T.inkSoft;

      return (
         <Pressable
            key={cat}
            style={({ pressed }) => [styles.categoryChip, isActive && styles.categoryChipActive, pressed && styles.pressed]}
            onPress={() => updateFilter('category', isAll ? 'all' : cat)}
         >
            {isAll ? (
               <Grid size={16} color={iconColor} />
            ) : cat.toLowerCase().includes('calzado') ? (
               <Footprints size={16} color={iconColor} />
            ) : (
               <Shirt size={16} color={iconColor} />
            )}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
               {categoryChips}
            </ScrollView>
         )}

         {/* BÚSQUEDA Y BOTÓN DE FILTROS */}
         <View style={styles.searchBar}>
            <Search size={18} color={T.inkMute} />
            <TextInput
               style={styles.searchInput}
               placeholder="Buscar por nombre, SKU, marca..."
               placeholderTextColor={T.inkMute}
               value={filters.query}
               onChangeText={(text) => updateFilter('query', text)}
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
               <Filter size={16} color={showMoreFilters ? T.onAccent : T.ink} />
            </Pressable>
         </View>

         {/* CHIPS DE ESTADO */}
         <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
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

         {/* PANEL DESPLEGABLE (MARCA Y TALLA) */}
         {showMoreFilters && (
            <View style={styles.panel}>
               <Text style={styles.filterLabel}>Marca</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
                  <Pressable style={[styles.subChip, !filters.brand && styles.subChipActive]} onPress={() => updateFilter('brand', '')}>
                     <Text style={[styles.subChipText, !filters.brand && styles.subChipTextActive]}>Todas</Text>
                  </Pressable>
                  {availableBrands.map((b) => (
                     <Pressable key={b} style={[styles.subChip, filters.brand === b && styles.subChipActive]} onPress={() => updateFilter('brand', b)}>
                        <Text style={[styles.subChipText, filters.brand === b && styles.subChipTextActive]}>{b}</Text>
                     </Pressable>
                  ))}
               </ScrollView>

               <Text style={[styles.filterLabel, { marginTop: 14 }]}>Talla</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
                  <Pressable style={[styles.subChip, !filters.size && styles.subChipActive]} onPress={() => updateFilter('size', '')}>
                     <Text style={[styles.subChipText, !filters.size && styles.subChipTextActive]}>Todas</Text>
                  </Pressable>
                  {availableSizes.map((s) => (
                     <Pressable key={s} style={[styles.subChip, filters.size === s && styles.subChipActive]} onPress={() => updateFilter('size', s)}>
                        <Text style={[styles.subChipText, filters.size === s && styles.subChipTextActive]}>{s}</Text>
                     </Pressable>
                  ))}
               </ScrollView>

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

   categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: T.line },
   categoryChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   categoryText: { fontSize: 14, fontWeight: '600', color: T.inkSoft },
   categoryTextActive: { color: T.onSolid, fontWeight: '800' },

   searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 14, paddingRight: 7, borderRadius: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
   searchInput: { flex: 1, fontSize: 14, color: T.ink },
   toggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
   toggleBtnActive: { backgroundColor: T.solid, borderColor: T.solid },

   statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.line },
   statusChipActive: { borderColor: T.ink, backgroundColor: T.surface },
   statusChipText: { fontSize: 12, fontWeight: '600', color: T.inkMute },
   statusChipTextActive: { color: T.ink, fontWeight: '700' },

   panel: { padding: 14, borderRadius: 12, backgroundColor: T.surface },
   filterLabel: { fontSize: 12, fontWeight: '700', color: T.inkMute, marginBottom: 8 },
   subChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.line },
   subChipActive: { backgroundColor: T.solid, borderColor: T.solid },
   subChipText: { fontSize: 12, fontWeight: '600', color: T.inkSoft },
   subChipTextActive: { color: T.onSolid, fontWeight: '800' },
   resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 14 },
   resetBtnText: { fontSize: 12, fontWeight: '700', color: T.inkSoft },
});

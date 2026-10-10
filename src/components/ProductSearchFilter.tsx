import React, { useState } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   ScrollView,
   StyleSheet,
} from 'react-native';
import {
   Search,
   X,
   Filter,
   Sparkles,
   Store,
   Layers,
   AlertTriangle,
   Shirt,
   Footprints,
   Tag,
   Grid,
} from 'lucide-react-native';
import { FilterOptions } from '../utils/productFilters';

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

   return (
      <View style={styles.container}>
         {/* SECCIÓN PRINCIPAL DESTACADA: CATEGORÍAS */}
         <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>CATEGORÍAS DE PRENDAS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
               {categoriesList.map((cat) => {
                  const isAll = cat === 'all';
                  const isActive = isAll ? filters.category === 'all' || !filters.category : filters.category === cat;

                  return (
                     <TouchableOpacity
                        key={cat}
                        activeOpacity={0.8}
                        style={[styles.categoryCard, isActive && styles.categoryCardActive]}
                        onPress={() => updateFilter('category', isAll ? 'all' : cat)}
                     >
                        {isAll ? (
                           <Grid size={18} color={isActive ? '#ffffff' : '#2563eb'} />
                        ) : cat.toLowerCase().includes('calzado') ? (
                           <Footprints size={18} color={isActive ? '#ffffff' : '#2563eb'} />
                        ) : (
                           <Shirt size={18} color={isActive ? '#ffffff' : '#2563eb'} />
                        )}
                        <Text style={[styles.categoryCardText, isActive && styles.categoryCardTextActive]}>
                           {isAll ? 'Todas' : cat}
                        </Text>
                     </TouchableOpacity>
                  );
               })}
            </ScrollView>
         </View>

         {/* BARRA DE BÚSQUEDA Y BOTÓN DE FILTROS ABRIR */}
         <View style={styles.searchBar}>
            <Search size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
               style={styles.searchInput}
               placeholder="Buscar por nombre, SKU, marca..."
               placeholderTextColor="#94a3b8"
               value={filters.query}
               onChangeText={(text) => updateFilter('query', text)}
            />
            {filters.query ? (
               <TouchableOpacity onPress={() => updateFilter('query', '')}>
                  <X size={18} color="#64748b" />
               </TouchableOpacity>
            ) : null}
            <TouchableOpacity
               style={[styles.filterToggleBtn, showMoreFilters && styles.filterToggleBtnActive]}
               onPress={() => setShowMoreFilters(!showMoreFilters)}
            >
               <Filter size={16} color={showMoreFilters ? '#ffffff' : '#475569'} />
            </TouchableOpacity>
         </View>

         {/* CHIPS DE ESTADO */}
         <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {statusChips.map((chip) => {
               const IconComp = chip.icon;
               const isActive = filters.status === chip.id;

               return (
                  <TouchableOpacity
                     key={chip.id}
                     style={[styles.statusChip, isActive && styles.statusChipActive]}
                     onPress={() => updateFilter('status', chip.id)}
                  >
                     <IconComp size={13} color={isActive ? '#ffffff' : '#475569'} style={{ marginRight: 4 }} />
                     <Text style={[styles.statusChipText, isActive && styles.statusChipTextActive]}>
                        {chip.label}
                     </Text>
                  </TouchableOpacity>
               );
            })}
         </ScrollView>

         {/* PANEL DE FILTROS DESPLEGABLE (MARCA Y TALLA) */}
         {showMoreFilters && (
            <View style={styles.advancedFiltersPanel}>
               <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.filterLabel}>Marca:</Text>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                           style={[styles.subChip, !filters.brand && styles.subChipActive]}
                           onPress={() => updateFilter('brand', '')}
                        >
                           <Text style={[styles.subChipText, !filters.brand && styles.subChipTextActive]}>Todas</Text>
                        </TouchableOpacity>
                        {availableBrands.map((b) => (
                           <TouchableOpacity
                              key={b}
                              style={[styles.subChip, filters.brand === b && styles.subChipActive]}
                              onPress={() => updateFilter('brand', b)}
                           >
                              <Text style={[styles.subChipText, filters.brand === b && styles.subChipTextActive]}>{b}</Text>
                           </TouchableOpacity>
                        ))}
                     </ScrollView>
                  </View>
               </View>

               <View style={[styles.advancedRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.filterLabel}>Talla:</Text>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                           style={[styles.subChip, !filters.size && styles.subChipActive]}
                           onPress={() => updateFilter('size', '')}
                        >
                           <Text style={[styles.subChipText, !filters.size && styles.subChipTextActive]}>Todas</Text>
                        </TouchableOpacity>
                        {availableSizes.map((s) => (
                           <TouchableOpacity
                              key={s}
                              style={[styles.subChip, filters.size === s && styles.subChipActive]}
                              onPress={() => updateFilter('size', s)}
                           >
                              <Text style={[styles.subChipText, filters.size === s && styles.subChipTextActive]}>{s}</Text>
                           </TouchableOpacity>
                        ))}
                     </ScrollView>
                  </View>
               </View>

               <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                  <X size={14} color="#ef4444" style={{ marginRight: 4 }} />
                  <Text style={styles.resetBtnText}>Limpiar Filtros</Text>
               </TouchableOpacity>
            </View>
         )}
      </View>
   );
};

const styles = StyleSheet.create({
   container: { marginBottom: 12 },
   categorySection: { marginBottom: 12 },
   categoryTitle: { fontSize: 11, fontWeight: 'bold', color: '#1e293b', letterSpacing: 0.5, marginBottom: 8 },
   categoryScroll: { flexDirection: 'row' },
   categoryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 2,
      borderColor: '#e2e8f0',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginRight: 8,
      gap: 8,
   },
   categoryCardActive: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
   },
   categoryCardText: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
   categoryCardTextActive: { color: '#ffffff' },
   searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
   },
   searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
   filterToggleBtn: { padding: 6, borderRadius: 6, backgroundColor: '#f1f5f9', marginLeft: 8 },
   filterToggleBtnActive: { backgroundColor: '#2563eb' },
   chipScroll: { flexDirection: 'row', marginTop: 8 },
   statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginRight: 6,
   },
   statusChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
   statusChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
   statusChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   advancedFiltersPanel: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
   },
   advancedRow: { flexDirection: 'row' },
   filterLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
   subChip: {
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 6,
   },
   subChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
   subChipText: { fontSize: 11, color: '#334155' },
   subChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
   resetBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 10 },
   resetBtnText: { fontSize: 11, color: '#ef4444', fontWeight: 'bold' },
});
